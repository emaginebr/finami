using System.Net;
using System.Net.Http.Headers;
using System.Net.Http.Json;
using System.Text;
using System.Text.Json;
using Finami.Domain.Interfaces;
using Finami.Domain.Models;
using Finami.Domain.Services;
using Finami.Infra.Context;
using Finami.Infra.Interfaces.Repository;
using FluentAssertions;
using Microsoft.AspNetCore.Hosting;
using Microsoft.AspNetCore.Mvc.Testing;
using Microsoft.AspNetCore.WebUtilities;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Infrastructure;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.DependencyInjection.Extensions;
using Microsoft.Extensions.Logging.Abstractions;
using ModelContextProtocol.Client;

namespace Finami.Tests.API;

/// <summary>
/// API real em memória para os testes do MCP: <see cref="WebApplicationFactory{TEntryPoint}"/> com o
/// <see cref="FinamiContext"/> trocado por EF InMemory e um <see cref="IUnitOfWork"/> sem transação
/// (o provedor InMemory não tem transações relacionais nem SELECT ... FOR UPDATE; os repositórios OAuth caem
/// para consultas comuns). Não depende de PostgreSQL nem do banco de homolog.
/// </summary>
public class FinamiApiFactory : WebApplicationFactory<Program>
{
    public const string PUBLIC_URL = "http://localhost";
    public const string APP_URL = "http://app.test";

    private readonly string _database = $"finami-api-{Guid.NewGuid():N}";

    /// <summary>Configurações extras (ex.: limites de taxa) aplicadas por uma factory derivada.</summary>
    protected virtual IDictionary<string, string?> ExtraSettings => new Dictionary<string, string?>();

    protected override void ConfigureWebHost(IWebHostBuilder builder)
    {
        builder.UseEnvironment("Development");
        // Limites de taxa desligados (0) e sem limpeza em segundo plano: os testes não dependem de ordem nem de tempo.
        builder.UseSetting("Mcp:RateLimitPerMinute", "0");
        builder.UseSetting("Mcp:RegisterRateLimitPerHour", "0");
        builder.UseSetting("Mcp:TokenRateLimitPerMinute", "0");
        builder.UseSetting("Mcp:CleanupEnabled", "false");
        foreach (var (key, value) in ExtraSettings)
            builder.UseSetting(key, value);
        builder.UseSetting("Mcp:PublicUrl", PUBLIC_URL);
        builder.UseSetting("App:PublicUrl", APP_URL);
        builder.UseSetting("Database:MigrateOnStartup", "false");
        builder.ConfigureServices(services =>
        {
            services.RemoveAll<DbContextOptions<FinamiContext>>();
            services.RemoveAll<IDbContextOptionsConfiguration<FinamiContext>>();
            services.AddDbContext<FinamiContext>(options => options.UseInMemoryDatabase(_database));
            services.RemoveAll<IUnitOfWork>();
            services.AddScoped<IUnitOfWork, NoTransactionUnitOfWork>();
        });
    }

    /// <summary>Cria a pessoa no banco e devolve o JWT do app (mesmo emissor do login).</summary>
    public (long UserId, string Jwt) CreateUserWithAppJwt(string firstName, string lastName, string email)
    {
        using var scope = Services.CreateScope();
        var context = scope.ServiceProvider.GetRequiredService<FinamiContext>();
        var user = new User { FirstName = firstName, LastName = lastName, Email = email };
        context.Users.Add(user);
        context.SaveChanges();
        var (token, _) = scope.ServiceProvider.GetRequiredService<ITokenService>().Generate(user);
        return (user.UserId, token);
    }

    /// <summary>
    /// Conexão + token de acesso gravados direto no banco (sem passar pelo fluxo OAuth), para testar as
    /// ferramentas com o escopo desejado.
    /// </summary>
    public (long GrantId, string AccessToken) CreateMcpAccessToken(long userId, string scopes = "finami:read finami:write")
    {
        using var scope = Services.CreateScope();
        var context = scope.ServiceProvider.GetRequiredService<FinamiContext>();
        var client = new OAuthClient { ClientId = OAuthCrypto.GenerateToken(OAuthCrypto.CLIENT_ID_PREFIX), ClientName = "Teste" };
        client.SetRedirectUris(new[] { "http://127.0.0.1/callback" });
        context.OAuthClients.Add(client);
        context.SaveChanges();
        var grant = new OAuthGrant { UserId = userId, OAuthClientId = client.OAuthClientId, Scopes = scopes };
        context.OAuthGrants.Add(grant);
        context.SaveChanges();
        var token = OAuthCrypto.GenerateToken(OAuthCrypto.ACCESS_TOKEN_PREFIX);
        context.OAuthTokens.Add(new OAuthToken
        {
            OAuthGrantId = grant.OAuthGrantId,
            TokenType = Finami.Domain.Enums.OAuthTokenType.Access,
            TokenHash = OAuthCrypto.Sha256Hex(token),
            Scopes = scopes,
            ExpiresAt = DateTime.UtcNow.AddHours(1)
        });
        context.SaveChanges();
        return (grant.OAuthGrantId, token);
    }

    /// <summary>Cliente MCP do SDK autenticado com o token informado.</summary>
    public Task<McpClient> CreateMcpClientAsync(string accessToken)
    {
        var transport = new HttpClientTransport(new HttpClientTransportOptions
        {
            Endpoint = new Uri(Server.BaseAddress, "/mcp"),
            TransportMode = HttpTransportMode.StreamableHttp,
            AdditionalHeaders = new Dictionary<string, string> { ["Authorization"] = $"Bearer {accessToken}" }
        }, CreateClient(), NullLoggerFactory.Instance, ownsHttpClient: true);
        return McpClient.CreateAsync(transport);
    }

    private sealed class NoTransactionUnitOfWork : IUnitOfWork
    {
        public Task BeginTransactionAsync() => Task.CompletedTask;
        public Task CommitAsync() => Task.CompletedTask;
        public Task RollbackAsync() => Task.CompletedTask;
        public Task LockAccountsAsync(IEnumerable<long> accountIds) => Task.CompletedTask;
    }
}

/// <summary>
/// T016 — fluxo completo: 401 sem token → descoberta → registro → authorize (302 para /autorizar) →
/// aprovação com o JWT do app → token → cliente MCP do SDK (tools/list e obter_perfil) → separação dos
/// tokens (MCP ≠ app) → revogação → 401.
/// </summary>
public class McpOAuthFlowTests : IClassFixture<FinamiApiFactory>
{
    private const string CALLBACK = "http://127.0.0.1:33418/callback";
    private const string STATE = "estado-123";
    private const string VERIFIER = "dBjftJeZ4CVP-mB92K27uhbUJU1p1r_wW1gFWFOEjXk";

    private readonly FinamiApiFactory _factory;
    private readonly HttpClient _http;

    public McpOAuthFlowTests(FinamiApiFactory factory)
    {
        _factory = factory;
        _http = factory.CreateClient(new WebApplicationFactoryClientOptions { AllowAutoRedirect = false });
    }

    private static HttpRequestMessage McpPost(string? bearer)
    {
        var request = new HttpRequestMessage(HttpMethod.Post, "/mcp")
        {
            Content = new StringContent(
                """{"jsonrpc":"2.0","id":1,"method":"tools/list","params":{}}""", Encoding.UTF8, "application/json")
        };
        request.Headers.Accept.ParseAdd("application/json");
        request.Headers.Accept.ParseAdd("text/event-stream");
        if (bearer != null)
            request.Headers.Authorization = new AuthenticationHeaderValue("Bearer", bearer);
        return request;
    }

    private async Task<JsonElement> Json(HttpResponseMessage response) =>
        JsonDocument.Parse(await response.Content.ReadAsStringAsync()).RootElement;

    private async Task<(string ClientId, JsonElement Tokens, string Jwt)> ConnectAsync(string email)
    {
        var (_, jwt) = _factory.CreateUserWithAppJwt("Ana", "Silva", email);

        var register = await _http.PostAsJsonAsync("/oauth/register", new
        {
            client_name = "MCP Inspector",
            redirect_uris = new[] { "http://127.0.0.1/callback" },
            grant_types = new[] { "authorization_code", "refresh_token" },
            response_types = new[] { "code" },
            token_endpoint_auth_method = "none"
        });
        register.StatusCode.Should().Be(HttpStatusCode.Created);
        var clientId = (await Json(register)).GetProperty("client_id").GetString()!;

        var challenge = OAuthCrypto.ComputeS256Challenge(VERIFIER);
        var authorize = await _http.GetAsync(QueryHelpers.AddQueryString("/oauth/authorize", new Dictionary<string, string?>
        {
            ["response_type"] = "code",
            ["client_id"] = clientId,
            ["redirect_uri"] = CALLBACK, // loopback com outra porta (RFC 8252)
            ["code_challenge"] = challenge,
            ["code_challenge_method"] = "S256",
            ["scope"] = "finami:read finami:write",
            ["state"] = STATE,
            ["resource"] = FinamiApiFactory.PUBLIC_URL + "/mcp"
        }));
        authorize.StatusCode.Should().Be(HttpStatusCode.Redirect);
        var location = authorize.Headers.Location!.ToString();
        location.Should().StartWith(FinamiApiFactory.APP_URL + "/autorizar?pedido=");
        var requestKey = QueryHelpers.ParseQuery(new Uri(location).Query)["pedido"].ToString();

        using var getRequest = new HttpRequestMessage(HttpMethod.Get, $"/api/oauth/requests/{requestKey}");
        getRequest.Headers.Authorization = new AuthenticationHeaderValue("Bearer", jwt);
        var info = await _http.SendAsync(getRequest);
        info.StatusCode.Should().Be(HttpStatusCode.OK);
        var infoJson = await Json(info);
        infoJson.GetProperty("clientName").GetString().Should().Be("MCP Inspector");
        infoJson.GetProperty("redirectHost").GetString().Should().Be("127.0.0.1");

        using var approve = new HttpRequestMessage(HttpMethod.Post, $"/api/oauth/requests/{requestKey}/approve")
        {
            Content = JsonContent.Create(new { scopes = new[] { "finami:read", "finami:write" } })
        };
        approve.Headers.Authorization = new AuthenticationHeaderValue("Bearer", jwt);
        var approved = await _http.SendAsync(approve);
        approved.StatusCode.Should().Be(HttpStatusCode.OK);
        var redirectUrl = (await Json(approved)).GetProperty("redirectUrl").GetString()!;
        redirectUrl.Should().StartWith(CALLBACK + "?");
        var query = QueryHelpers.ParseQuery(new Uri(redirectUrl).Query);
        query["state"].ToString().Should().Be(STATE);

        var token = await _http.PostAsync("/oauth/token", new FormUrlEncodedContent(new Dictionary<string, string>
        {
            ["grant_type"] = "authorization_code",
            ["code"] = query["code"].ToString(),
            ["redirect_uri"] = CALLBACK,
            ["code_verifier"] = VERIFIER,
            ["client_id"] = clientId,
            ["resource"] = FinamiApiFactory.PUBLIC_URL + "/mcp"
        }));
        token.StatusCode.Should().Be(HttpStatusCode.OK);
        token.Headers.CacheControl!.NoStore.Should().BeTrue();
        return (clientId, await Json(token), jwt);
    }

    private async Task<McpClient> NewMcpClient(string accessToken)
    {
        var transport = new HttpClientTransport(new HttpClientTransportOptions
        {
            Endpoint = new Uri(_factory.Server.BaseAddress, "/mcp"),
            TransportMode = HttpTransportMode.StreamableHttp,
            AdditionalHeaders = new Dictionary<string, string> { ["Authorization"] = $"Bearer {accessToken}" }
        }, _factory.CreateClient(), NullLoggerFactory.Instance, ownsHttpClient: true);
        return await McpClient.CreateAsync(transport);
    }

    [Fact]
    public async Task Mcp_without_token_is_401_with_resource_metadata_challenge()
    {
        var response = await _http.SendAsync(McpPost(null));

        response.StatusCode.Should().Be(HttpStatusCode.Unauthorized);
        response.Headers.WwwAuthenticate.ToString().Should()
            .Contain($"resource_metadata=\"{FinamiApiFactory.PUBLIC_URL}/.well-known/oauth-protected-resource\"");
    }

    [Fact]
    public async Task Discovery_metadata_is_public()
    {
        var resource = await Json(await _http.GetAsync("/.well-known/oauth-protected-resource"));
        resource.GetProperty("resource").GetString().Should().Be(FinamiApiFactory.PUBLIC_URL + "/mcp");
        resource.GetProperty("authorization_servers")[0].GetString().Should().Be(FinamiApiFactory.PUBLIC_URL);

        var suffixed = await _http.GetAsync("/.well-known/oauth-protected-resource/mcp");
        suffixed.StatusCode.Should().Be(HttpStatusCode.OK);

        var server = await Json(await _http.GetAsync("/.well-known/oauth-authorization-server"));
        server.GetProperty("issuer").GetString().Should().Be(FinamiApiFactory.PUBLIC_URL);
        server.GetProperty("registration_endpoint").GetString().Should().Be(FinamiApiFactory.PUBLIC_URL + "/oauth/register");
        server.GetProperty("code_challenge_methods_supported")[0].GetString().Should().Be("S256");
    }

    [Fact]
    public async Task Full_flow_connects_an_mcp_client_and_tokens_stay_separated()
    {
        var (clientId, tokens, jwt) = await ConnectAsync("ana.fluxo@exemplo.com");
        var accessToken = tokens.GetProperty("access_token").GetString()!;
        tokens.GetProperty("token_type").GetString().Should().Be("Bearer");
        tokens.GetProperty("scope").GetString().Should().Be("finami:read finami:write");

        await using (var mcp = await NewMcpClient(accessToken))
        {
            mcp.ServerInfo!.Name.Should().Be("finami");
            mcp.ServerInstructions.Should().Contain("Finami");

            var tools = await mcp.ListToolsAsync();
            var profile = tools.Single(t => t.Name == "obter_perfil");
            profile.ProtocolTool.Annotations!.ReadOnlyHint.Should().BeTrue();
            profile.Description.Should().Contain("pessoa conectada");
            profile.JsonSchema.GetRawText().Should().NotContain("user", "ClaimsPrincipal vem do token, não do assistente");

            var result = await mcp.CallToolAsync("obter_perfil", new Dictionary<string, object?>());
            result.IsError.Should().NotBe(true);
            var structured = result.StructuredContent!.Value;
            structured.GetProperty("firstName").GetString().Should().Be("Ana");
            structured.GetProperty("email").GetString().Should().Be("ana.fluxo@exemplo.com");
            result.Content.OfType<ModelContextProtocol.Protocol.TextContentBlock>().Single().Text
                .Should().Contain("Ana Silva");
        }

        // FR-009: token do MCP não vale no app; JWT do app não vale no MCP.
        using (var me = new HttpRequestMessage(HttpMethod.Get, "/api/auth/me"))
        {
            me.Headers.Authorization = new AuthenticationHeaderValue("Bearer", accessToken);
            (await _http.SendAsync(me)).StatusCode.Should().Be(HttpStatusCode.Unauthorized);
        }
        using (var meWithJwt = new HttpRequestMessage(HttpMethod.Get, "/api/auth/me"))
        {
            meWithJwt.Headers.Authorization = new AuthenticationHeaderValue("Bearer", jwt);
            (await _http.SendAsync(meWithJwt)).StatusCode.Should().Be(HttpStatusCode.OK);
        }
        var mcpWithJwt = await _http.SendAsync(McpPost(jwt));
        mcpWithJwt.StatusCode.Should().Be(HttpStatusCode.Unauthorized);
        mcpWithJwt.Headers.WwwAuthenticate.ToString().Should().Contain("invalid_token");

        // Revogar a renovação encerra a conexão: o token de acesso deixa de valer na hora.
        var revoke = await _http.PostAsync("/oauth/revoke", new FormUrlEncodedContent(new Dictionary<string, string>
        {
            ["token"] = tokens.GetProperty("refresh_token").GetString()!,
            ["token_type_hint"] = "refresh_token",
            ["client_id"] = clientId
        }));
        revoke.StatusCode.Should().Be(HttpStatusCode.OK);
        (await _http.SendAsync(McpPost(accessToken))).StatusCode.Should().Be(HttpStatusCode.Unauthorized);
    }

    [Fact]
    public async Task Refresh_through_the_token_endpoint_rotates_tokens()
    {
        var (clientId, tokens, _) = await ConnectAsync("ana.renova@exemplo.com");

        var refreshed = await _http.PostAsync("/oauth/token", new FormUrlEncodedContent(new Dictionary<string, string>
        {
            ["grant_type"] = "refresh_token",
            ["refresh_token"] = tokens.GetProperty("refresh_token").GetString()!,
            ["client_id"] = clientId
        }));

        refreshed.StatusCode.Should().Be(HttpStatusCode.OK);
        var json = await Json(refreshed);
        json.GetProperty("refresh_token").GetString().Should().NotBe(tokens.GetProperty("refresh_token").GetString());
        (await _http.SendAsync(McpPost(json.GetProperty("access_token").GetString()))).StatusCode
            .Should().Be(HttpStatusCode.OK);
    }

    [Fact]
    public async Task Token_endpoint_errors_use_oauth_format()
    {
        var unknownGrant = await _http.PostAsync("/oauth/token", new FormUrlEncodedContent(new Dictionary<string, string>
        {
            ["grant_type"] = "password", ["client_id"] = "fmc_x"
        }));
        unknownGrant.StatusCode.Should().Be(HttpStatusCode.BadRequest);
        (await Json(unknownGrant)).GetProperty("error").GetString().Should().Be("unsupported_grant_type");

        var badClient = await _http.PostAsync("/oauth/token", new FormUrlEncodedContent(new Dictionary<string, string>
        {
            ["grant_type"] = "authorization_code", ["client_id"] = "fmc_desconhecido", ["code"] = "x"
        }));
        badClient.StatusCode.Should().Be(HttpStatusCode.Unauthorized);
        (await Json(badClient)).GetProperty("error").GetString().Should().Be("invalid_client");

        var badRegister = await _http.PostAsJsonAsync("/oauth/register", new
        {
            client_name = "X", redirect_uris = new[] { "http://exemplo.com/cb" }
        });
        badRegister.StatusCode.Should().Be(HttpStatusCode.BadRequest);
        (await Json(badRegister)).GetProperty("error").GetString().Should().Be("invalid_redirect_uri");
    }

    [Fact]
    public async Task Authorize_with_unknown_client_shows_html_error_page()
    {
        var response = await _http.GetAsync(
            "/oauth/authorize?response_type=code&client_id=fmc_nao_existe&redirect_uri=https://x.test/cb");

        response.StatusCode.Should().Be(HttpStatusCode.BadRequest);
        response.Content.Headers.ContentType!.MediaType.Should().Be("text/html");
        var html = await response.Content.ReadAsStringAsync();
        html.Should().Contain("lang=\"pt-BR\"");
        html.Should().Contain("Não foi possível conectar este assistente.");
        html.Should().Contain("Assistente não registrado.");
        html.Should().NotContain("&#xE3;", "o motivo mantém as letras acentuadas legíveis no HTML cru");
        html.Should().NotContain("{{REASON}}</span>");
    }

    [Fact]
    public async Task Swagger_document_still_generates_with_oauth_and_mcp_endpoints()
    {
        var response = await _http.GetAsync("/swagger/v1/swagger.json");

        response.StatusCode.Should().Be(HttpStatusCode.OK);
        var paths = (await Json(response)).GetProperty("paths");
        paths.TryGetProperty("/api/oauth/requests/{requestKey}/approve", out _).Should().BeTrue();
        paths.TryGetProperty("/oauth/token", out _).Should().BeTrue();
    }

    [Fact]
    public async Task Consent_routes_require_the_app_jwt()
    {
        (await _http.GetAsync("/api/oauth/requests/qualquer")).StatusCode.Should().Be(HttpStatusCode.Unauthorized);

        var (_, jwt) = _factory.CreateUserWithAppJwt("Bia", "Lima", "bia.consent@exemplo.com");
        using var request = new HttpRequestMessage(HttpMethod.Get, "/api/oauth/requests/nao-existe");
        request.Headers.Authorization = new AuthenticationHeaderValue("Bearer", jwt);
        var response = await _http.SendAsync(request);
        response.StatusCode.Should().Be(HttpStatusCode.NotFound);
        (await Json(response)).GetProperty("mensagem").GetString().Should().Be("Pedido de autorização não encontrado.");
    }

    [Fact]
    public async Task Mcp_cors_preflight_allows_any_origin_without_credentials()
    {
        using var preflight = new HttpRequestMessage(HttpMethod.Options, "/mcp");
        preflight.Headers.Add("Origin", "https://claude.ai");
        preflight.Headers.Add("Access-Control-Request-Method", "POST");
        preflight.Headers.Add("Access-Control-Request-Headers", "authorization,content-type");

        var response = await _http.SendAsync(preflight);

        response.StatusCode.Should().Be(HttpStatusCode.NoContent);
        response.Headers.GetValues("Access-Control-Allow-Origin").Should().Equal("*");
        response.Headers.Contains("Access-Control-Allow-Credentials").Should().BeFalse();

        using var unauthorized = McpPost(null);
        unauthorized.Headers.Add("Origin", "https://claude.ai");
        var challenge = await _http.SendAsync(unauthorized);
        challenge.Headers.GetValues("Access-Control-Expose-Headers").Single().Should().Contain("WWW-Authenticate");
    }
}
