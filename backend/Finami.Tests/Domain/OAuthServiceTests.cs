using Finami.Domain.Enums;
using Finami.Domain.Exceptions;
using Finami.Domain.Models;
using Finami.Domain.Services;
using Finami.Domain.Validators;
using Finami.DTO.OAuth;
using Finami.DTO.Settings;
using Finami.Infra.Context;
using Finami.Infra.Interfaces.Repository;
using Finami.Infra.Repository;
using FluentAssertions;
using Microsoft.AspNetCore.WebUtilities;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Options;
using Moq;

namespace Finami.Tests.Domain;

/// <summary>
/// T014 — OAuthService (contracts/oauth.md, contracts/api.md, research R-02..R-06). Repositórios reais
/// sobre EF InMemory (consultas, hashes e estados de verdade) e IUnitOfWork mockado: o UnitOfWork real
/// usa transações relacionais, que o provedor InMemory não tem.
/// </summary>
public class OAuthServiceTests : IDisposable
{
    private const string BASE = "https://finami.test";
    private const string RESOURCE = BASE + "/mcp";
    private const string CALLBACK = "https://claude.ai/api/mcp/auth_callback";
    private const string STATE = "xyz-123";
    private const long USER = 1;
    private const long OTHER_USER = 2;

    // RFC 7636, apêndice B.
    private const string VERIFIER = "dBjftJeZ4CVP-mB92K27uhbUJU1p1r_wW1gFWFOEjXk";
    private const string CHALLENGE = "E9Melhoa2OwvFrEMTJguCHaoeK1t8URWbuGJSstw-cM";

    private readonly FinamiContext _context;
    private readonly Mock<IUnitOfWork> _unitOfWork = new();
    private readonly TestTimeProvider _time = new(new DateTimeOffset(2026, 11, 1, 18, 0, 0, TimeSpan.Zero));
    private readonly OAuthService _service;

    public OAuthServiceTests()
    {
        _context = NewInMemoryContext();
        _context.Users.AddRange(
            new User { UserId = USER, FirstName = "Ana", LastName = "Silva", Email = "ana@exemplo.com" },
            new User { UserId = OTHER_USER, FirstName = "Bruno", LastName = "Souza", Email = "bruno@exemplo.com" });
        _context.SaveChanges();

        _service = new OAuthService(
            new OAuthClientRepository(_context),
            new OAuthGrantRepository(_context),
            new OAuthRequestRepository(_context),
            new OAuthTokenRepository(_context),
            _unitOfWork.Object,
            new OAuthClientRegistrationInfoValidator(),
            new OAuthApproveInfoValidator(),
            Options.Create(new McpSettings { PublicUrl = BASE + "/" }),
            _time);
    }

    public void Dispose() => _context.Dispose();

    public static FinamiContext NewInMemoryContext() =>
        new(new DbContextOptionsBuilder<FinamiContext>().UseInMemoryDatabase($"oauth-{Guid.NewGuid():N}").Options);

    // ---------------- Auxiliares ----------------

    private Task<OAuthClientRegistrationResult> Register(string method = "none", params string[] redirects) =>
        _service.RegisterClientAsync(new OAuthClientRegistrationInfo
        {
            ClientName = "Claude",
            RedirectUris = redirects.Length == 0 ? new List<string> { CALLBACK } : redirects.ToList(),
            GrantTypes = new List<string> { "authorization_code", "refresh_token" },
            ResponseTypes = new List<string> { "code" },
            TokenEndpointAuthMethod = method
        });

    private static OAuthAuthorizeInfo AuthorizeInfo(string clientId, string redirect = CALLBACK) => new()
    {
        ResponseType = "code",
        ClientId = clientId,
        RedirectUri = redirect,
        CodeChallenge = CHALLENGE,
        CodeChallengeMethod = "S256",
        State = STATE,
        Resource = RESOURCE
    };

    private async Task<string> StartRequest(string clientId, string? scope = null)
    {
        var info = AuthorizeInfo(clientId);
        info.Scope = scope;
        var result = await _service.StartAuthorizationAsync(info);
        result.ErrorRedirectUrl.Should().BeNull();
        return result.RequestKey!;
    }

    private static Dictionary<string, string> Query(string url) =>
        QueryHelpers.ParseQuery(new Uri(url).Query).ToDictionary(p => p.Key, p => p.Value.ToString());

    private async Task<string> ApproveCode(string clientId, params string[] scopes)
    {
        var key = await StartRequest(clientId);
        var redirect = await _service.ApproveAsync(USER, key,
            new OAuthApproveInfo { Scopes = scopes.Length == 0 ? OAuthScopes.All.ToList() : scopes.ToList() });
        return Query(redirect.RedirectUrl)["code"];
    }

    private Task<OAuthTokenResult> Exchange(string clientId, string code, string verifier = VERIFIER,
        string redirect = CALLBACK, string? secret = null) =>
        _service.ExchangeCodeAsync(new OAuthTokenRequestInfo
        {
            GrantType = "authorization_code", ClientId = clientId, ClientSecret = secret, Code = code,
            CodeVerifier = verifier, RedirectUri = redirect, Resource = RESOURCE
        });

    private Task<OAuthTokenResult> Refresh(string clientId, string refreshToken, string? scope = null) =>
        _service.RefreshAsync(new OAuthTokenRequestInfo
        {
            GrantType = "refresh_token", ClientId = clientId, RefreshToken = refreshToken, Scope = scope
        });

    private async Task<(string ClientId, OAuthTokenResult Tokens)> Connect(params string[] scopes)
    {
        var client = await Register();
        var code = await ApproveCode(client.ClientId, scopes);
        return (client.ClientId, await Exchange(client.ClientId, code));
    }

    private static async Task ShouldFailWith(Func<Task> act, string code, int status = 400)
    {
        var ex = (await act.Should().ThrowAsync<OAuthProtocolException>()).Which;
        ex.Code.Should().Be(code);
        ex.StatusCode.Should().Be(status);
    }

    private OAuthGrant SingleGrant() => _context.OAuthGrants.AsNoTracking().Single();

    // ---------------- Descoberta ----------------

    [Fact]
    public void Metadata_uses_public_url_without_trailing_slash()
    {
        var server = _service.GetAuthorizationServerMetadata();
        server.Issuer.Should().Be(BASE);
        server.TokenEndpoint.Should().Be(BASE + "/oauth/token");
        server.CodeChallengeMethodsSupported.Should().Equal("S256");

        var resource = _service.GetProtectedResourceMetadata();
        resource.Resource.Should().Be(RESOURCE);
        resource.AuthorizationServers.Should().Equal(BASE);
        resource.ScopesSupported.Should().Equal("finami:read", "finami:write");
    }

    // ---------------- Registro ----------------

    [Fact]
    public async Task Register_public_client_returns_client_id_without_secret()
    {
        var result = await Register();

        result.ClientId.Should().StartWith(OAuthCrypto.CLIENT_ID_PREFIX);
        result.ClientSecret.Should().BeNull();
        result.TokenEndpointAuthMethod.Should().Be("none");
        result.RedirectUris.Should().Equal(CALLBACK);
        var stored = _context.OAuthClients.Single();
        stored.AuthMethod.Should().Be(OAuthClientAuthMethod.None);
        stored.ClientSecretHash.Should().BeNull();
    }

    [Theory]
    [InlineData("client_secret_post", OAuthClientAuthMethod.ClientSecretPost)]
    [InlineData("client_secret_basic", OAuthClientAuthMethod.ClientSecretBasic)]
    public async Task Register_confidential_client_returns_secret_once_and_stores_only_hash(string method,
        OAuthClientAuthMethod expected)
    {
        var result = await Register(method);

        result.ClientSecret.Should().StartWith(OAuthCrypto.CLIENT_SECRET_PREFIX);
        result.ClientSecretExpiresAt.Should().Be(0);
        var stored = _context.OAuthClients.Single();
        stored.AuthMethod.Should().Be(expected);
        stored.ClientSecretHash.Should().Be(OAuthCrypto.Sha256Hex(result.ClientSecret!));
        stored.ClientSecretHash.Should().NotContain(result.ClientSecret!);
    }

    [Theory]
    [InlineData("http://exemplo.com/callback")]          // http fora de loopback
    [InlineData("https://exemplo.com/callback#frag")]    // fragmento
    [InlineData("javascript:alert(1)")]                  // esquema sem ponto
    public async Task Register_rejects_invalid_redirect_uri(string redirect)
    {
        await ShouldFailWith(() => Register("none", redirect), OAuthProtocolException.INVALID_REDIRECT_URI);
    }

    [Fact]
    public async Task Register_rejects_more_than_five_redirect_uris()
    {
        var uris = Enumerable.Range(1, 6).Select(i => $"https://exemplo.com/cb{i}").ToArray();
        await ShouldFailWith(() => Register("none", uris), OAuthProtocolException.INVALID_REDIRECT_URI);
    }

    [Theory]
    [InlineData("http://localhost:3000/callback")]
    [InlineData("http://127.0.0.1/callback")]
    [InlineData("com.exemplo.app:/oauth/cb")]
    public async Task Register_accepts_loopback_and_native_scheme(string redirect)
    {
        var result = await Register("none", redirect);
        result.RedirectUris.Should().Equal(redirect);
    }

    [Fact]
    public async Task Register_rejects_missing_name_and_unsupported_metadata()
    {
        await ShouldFailWith(() => _service.RegisterClientAsync(new OAuthClientRegistrationInfo
            { RedirectUris = new List<string> { CALLBACK } }), OAuthProtocolException.INVALID_CLIENT_METADATA);
        await ShouldFailWith(() => _service.RegisterClientAsync(new OAuthClientRegistrationInfo
        {
            ClientName = "X", RedirectUris = new List<string> { CALLBACK },
            GrantTypes = new List<string> { "client_credentials" }
        }), OAuthProtocolException.INVALID_CLIENT_METADATA);
        await ShouldFailWith(() => _service.RegisterClientAsync(new OAuthClientRegistrationInfo
        {
            ClientName = "X", RedirectUris = new List<string> { CALLBACK }, TokenEndpointAuthMethod = "private_key_jwt"
        }), OAuthProtocolException.INVALID_CLIENT_METADATA);
    }

    // ---------------- Autorização ----------------

    [Fact]
    public async Task Authorize_unknown_client_fails_without_redirect()
    {
        var act = () => _service.StartAuthorizationAsync(AuthorizeInfo("fmc_desconhecido"));
        var ex = (await act.Should().ThrowAsync<OAuthProtocolException>()).Which;
        ex.Description.Should().Be("Assistente não registrado.");
    }

    [Fact]
    public async Task Authorize_unregistered_redirect_fails_without_redirect()
    {
        var client = await Register();
        var act = () => _service.StartAuthorizationAsync(AuthorizeInfo(client.ClientId, "https://evil.example/cb"));
        var ex = (await act.Should().ThrowAsync<OAuthProtocolException>()).Which;
        ex.Description.Should().Be("Endereço de retorno não autorizado.");
    }

    [Fact]
    public async Task Authorize_accepts_loopback_with_another_port()
    {
        var client = await Register("none", "http://127.0.0.1:3000/callback");
        var result = await _service.StartAuthorizationAsync(AuthorizeInfo(client.ClientId, "http://127.0.0.1:51234/callback"));
        result.RequestKey.Should().NotBeNullOrEmpty();

        var otherPath = await FluentActions.Awaiting(() =>
                _service.StartAuthorizationAsync(AuthorizeInfo(client.ClientId, "http://127.0.0.1:51234/outro")))
            .Should().ThrowAsync<OAuthProtocolException>();
        otherPath.Which.Code.Should().Be(OAuthProtocolException.INVALID_REQUEST);
    }

    [Theory]
    [InlineData(null, "S256", null, null, "invalid_request")]                 // sem PKCE
    [InlineData(CHALLENGE, "plain", null, null, "invalid_request")]           // método plain
    [InlineData(CHALLENGE, "S256", "finami:admin", null, "invalid_scope")]    // escopo desconhecido
    [InlineData(CHALLENGE, "S256", null, "https://outro.test/mcp", "invalid_target")] // resource errado
    public async Task Authorize_errors_after_redirect_validation_go_back_to_client(string? challenge, string method,
        string? scope, string? resource, string expectedError)
    {
        var client = await Register();
        var info = AuthorizeInfo(client.ClientId);
        info.CodeChallenge = challenge;
        info.CodeChallengeMethod = method;
        info.Scope = scope;
        if (resource != null) info.Resource = resource;

        var result = await _service.StartAuthorizationAsync(info);

        result.RequestKey.Should().BeNull();
        result.ErrorRedirectUrl.Should().StartWith(CALLBACK + "?");
        var query = Query(result.ErrorRedirectUrl!);
        query["error"].Should().Be(expectedError);
        query["state"].Should().Be(STATE);
        _context.OAuthAuthorizationRequests.Should().BeEmpty();
    }

    [Fact]
    public async Task Authorize_valid_request_is_stored_for_ten_minutes_with_default_scopes()
    {
        var client = await Register();
        var key = await StartRequest(client.ClientId);

        var info = await _service.GetRequestAsync(USER, key);

        info.ClientName.Should().Be("Claude");
        info.RedirectHost.Should().Be("claude.ai");
        info.ScopesRequested.Should().Equal("finami:read", "finami:write");
        info.ExpiresAt.Should().Be(_time.GetUtcNow().UtcDateTime.AddMinutes(10));
    }

    [Fact]
    public async Task Get_request_unknown_is_404_and_expired_is_410()
    {
        await FluentActions.Awaiting(() => _service.GetRequestAsync(USER, "nao-existe"))
            .Should().ThrowAsync<NotFoundException>();

        var client = await Register();
        var key = await StartRequest(client.ClientId);
        _time.Advance(TimeSpan.FromMinutes(11));

        await FluentActions.Awaiting(() => _service.GetRequestAsync(USER, key))
            .Should().ThrowAsync<GoneException>().WithMessage(OAuthAuthorizationRequest.EXPIRED_MESSAGE);
    }

    // ---------------- Aprovar / negar ----------------

    [Fact]
    public async Task Approve_creates_connection_and_redirects_with_code_and_state()
    {
        var client = await Register();
        var key = await StartRequest(client.ClientId);

        var redirect = await _service.ApproveAsync(USER, key, new OAuthApproveInfo { Scopes = OAuthScopes.All.ToList() });

        redirect.RedirectUrl.Should().StartWith(CALLBACK + "?");
        var query = Query(redirect.RedirectUrl);
        query["state"].Should().Be(STATE);
        query["code"].Should().NotBeNullOrEmpty();
        var grant = SingleGrant();
        grant.UserId.Should().Be(USER);
        grant.Status.Should().Be(OAuthGrantStatus.Active);
        grant.Scopes.Should().Be("finami:read finami:write");
        var request = _context.OAuthAuthorizationRequests.AsNoTracking().Single();
        request.Status.Should().Be(OAuthRequestStatus.Approved);
        request.CodeHash.Should().Be(OAuthCrypto.Sha256Hex(query["code"]));
    }

    [Fact]
    public async Task Approve_read_only_issues_read_only_tokens()
    {
        var (_, tokens) = await Connect(OAuthScopes.READ);

        SingleGrant().Scopes.Should().Be("finami:read");
        tokens.Scope.Should().Be("finami:read");
        var info = await _service.ValidateAccessTokenAsync(tokens.AccessToken);
        info!.Scopes.Should().Equal("finami:read");
    }

    [Fact]
    public async Task Approve_write_without_read_is_completed_with_read()
    {
        var (_, tokens) = await Connect(OAuthScopes.WRITE);
        tokens.Scope.Should().Be("finami:read finami:write");
    }

    [Fact]
    public async Task Approve_rejects_scopes_beyond_the_request_and_empty_scopes()
    {
        var client = await Register();
        var key = await StartRequest(client.ClientId, OAuthScopes.READ);

        await FluentActions.Awaiting(() => _service.ApproveAsync(USER, key,
                new OAuthApproveInfo { Scopes = new List<string> { OAuthScopes.WRITE } }))
            .Should().ThrowAsync<ValidationException>();
        await FluentActions.Awaiting(() => _service.ApproveAsync(USER, key, new OAuthApproveInfo()))
            .Should().ThrowAsync<ValidationException>();
        _context.OAuthGrants.Should().BeEmpty();
    }

    [Fact]
    public async Task Reauthorization_replaces_scopes_and_revokes_previous_tokens()
    {
        var (clientId, first) = await Connect();

        var code = await ApproveCode(clientId, OAuthScopes.READ);
        var second = await Exchange(clientId, code);

        _context.OAuthGrants.Should().ContainSingle();
        SingleGrant().Scopes.Should().Be("finami:read");
        (await _service.ValidateAccessTokenAsync(first.AccessToken)).Should().BeNull();
        await ShouldFailWith(() => Refresh(clientId, first.RefreshToken), OAuthProtocolException.INVALID_GRANT);
        (await _service.ValidateAccessTokenAsync(second.AccessToken))!.Scopes.Should().Equal("finami:read");
    }

    [Fact]
    public async Task Approve_expired_or_already_answered_request_is_410()
    {
        var client = await Register();
        var expired = await StartRequest(client.ClientId);
        _time.Advance(TimeSpan.FromMinutes(11));
        await FluentActions.Awaiting(() => _service.ApproveAsync(USER, expired,
                new OAuthApproveInfo { Scopes = OAuthScopes.All.ToList() }))
            .Should().ThrowAsync<GoneException>();

        var answered = await StartRequest(client.ClientId);
        await _service.ApproveAsync(USER, answered, new OAuthApproveInfo { Scopes = OAuthScopes.All.ToList() });
        // Pedido de outra pessoa já aprovado também é 410 para quem chega depois.
        await FluentActions.Awaiting(() => _service.GetRequestAsync(OTHER_USER, answered))
            .Should().ThrowAsync<GoneException>();
        await FluentActions.Awaiting(() => _service.ApproveAsync(OTHER_USER, answered,
                new OAuthApproveInfo { Scopes = OAuthScopes.All.ToList() }))
            .Should().ThrowAsync<GoneException>();
    }

    [Fact]
    public async Task Deny_redirects_with_access_denied_and_state()
    {
        var client = await Register();
        var key = await StartRequest(client.ClientId);

        var redirect = await _service.DenyAsync(USER, key);

        var query = Query(redirect.RedirectUrl);
        query["error"].Should().Be("access_denied");
        query["state"].Should().Be(STATE);
        query.Should().ContainKey("error_description");
        _context.OAuthAuthorizationRequests.AsNoTracking().Single().Status.Should().Be(OAuthRequestStatus.Denied);
        _context.OAuthGrants.Should().BeEmpty();
        await FluentActions.Awaiting(() => _service.DenyAsync(USER, key)).Should().ThrowAsync<GoneException>();
    }

    // ---------------- Token (authorization_code) ----------------

    [Fact]
    public async Task Exchange_valid_code_issues_opaque_tokens_stored_only_as_hash()
    {
        var (_, tokens) = await Connect();

        tokens.AccessToken.Should().StartWith(OAuthCrypto.ACCESS_TOKEN_PREFIX);
        tokens.RefreshToken.Should().StartWith(OAuthCrypto.REFRESH_TOKEN_PREFIX);
        tokens.TokenType.Should().Be("Bearer");
        tokens.ExpiresIn.Should().Be(3600);
        var stored = _context.OAuthTokens.AsNoTracking().ToList();
        stored.Should().HaveCount(2);
        stored.Select(t => t.TokenHash).Should().BeEquivalentTo(new[]
            { OAuthCrypto.Sha256Hex(tokens.AccessToken), OAuthCrypto.Sha256Hex(tokens.RefreshToken) });
        stored.Single(t => t.TokenType == OAuthTokenType.Refresh).ExpiresAt
            .Should().Be(_time.GetUtcNow().UtcDateTime.AddDays(30));

        var info = await _service.ValidateAccessTokenAsync(tokens.AccessToken);
        info!.UserId.Should().Be(USER);
        info.GrantId.Should().Be(SingleGrant().OAuthGrantId);
        info.ClientName.Should().Be("Claude");
        _context.OAuthAuthorizationRequests.AsNoTracking().Single().Status.Should().Be(OAuthRequestStatus.CodeRedeemed);
    }

    [Fact]
    public async Task Exchange_with_wrong_pkce_verifier_fails()
    {
        var client = await Register();
        var code = await ApproveCode(client.ClientId);
        await ShouldFailWith(() => Exchange(client.ClientId, code, verifier: new string('a', 43)),
            OAuthProtocolException.INVALID_GRANT);
    }

    [Fact]
    public async Task Exchange_with_different_redirect_uri_fails()
    {
        var client = await Register("none", CALLBACK, "https://claude.ai/outro");
        var code = await ApproveCode(client.ClientId);
        await ShouldFailWith(() => Exchange(client.ClientId, code, redirect: "https://claude.ai/outro"),
            OAuthProtocolException.INVALID_GRANT);
    }

    [Fact]
    public async Task Exchange_expired_code_fails()
    {
        var client = await Register();
        var code = await ApproveCode(client.ClientId);
        _time.Advance(TimeSpan.FromMinutes(11));
        await ShouldFailWith(() => Exchange(client.ClientId, code), OAuthProtocolException.INVALID_GRANT);
    }

    [Fact]
    public async Task Reused_code_fails_and_revokes_the_connection()
    {
        var client = await Register();
        var code = await ApproveCode(client.ClientId);
        var tokens = await Exchange(client.ClientId, code);

        await ShouldFailWith(() => Exchange(client.ClientId, code), OAuthProtocolException.INVALID_GRANT);

        var grant = SingleGrant();
        grant.Status.Should().Be(OAuthGrantStatus.Revoked);
        grant.RevokeReason.Should().Be(OAuthRevokeReason.AuthorizationCodeReuse);
        (await _service.ValidateAccessTokenAsync(tokens.AccessToken)).Should().BeNull();
    }

    [Fact]
    public async Task Code_of_another_client_fails()
    {
        var client = await Register();
        var other = await Register();
        var code = await ApproveCode(client.ClientId);
        await ShouldFailWith(() => Exchange(other.ClientId, code), OAuthProtocolException.INVALID_GRANT);
    }

    [Fact]
    public async Task Confidential_client_must_authenticate()
    {
        var client = await Register("client_secret_post");
        var code = await ApproveCode(client.ClientId);

        await ShouldFailWith(() => Exchange(client.ClientId, code, secret: "fms_errado"),
            OAuthProtocolException.INVALID_CLIENT, 401);
        await ShouldFailWith(() => Exchange(client.ClientId, code), OAuthProtocolException.INVALID_CLIENT, 401);

        var tokens = await Exchange(client.ClientId, code, secret: client.ClientSecret);
        tokens.AccessToken.Should().NotBeNullOrEmpty();
    }

    // ---------------- Token (refresh_token) ----------------

    [Fact]
    public async Task Refresh_rotates_the_pair_and_marks_the_old_refresh_as_used()
    {
        var (clientId, first) = await Connect();
        _time.Advance(TimeSpan.FromMinutes(5));

        var second = await Refresh(clientId, first.RefreshToken);

        second.AccessToken.Should().NotBe(first.AccessToken);
        second.RefreshToken.Should().NotBe(first.RefreshToken);
        second.Scope.Should().Be("finami:read finami:write");
        var old = _context.OAuthTokens.AsNoTracking().Single(t => t.TokenHash == OAuthCrypto.Sha256Hex(first.RefreshToken));
        old.UsedAt.Should().NotBeNull();
        var renewed = _context.OAuthTokens.AsNoTracking().Single(t => t.TokenHash == OAuthCrypto.Sha256Hex(second.RefreshToken));
        renewed.ParentTokenId.Should().Be(old.OAuthTokenId);
        renewed.ExpiresAt.Should().Be(_time.GetUtcNow().UtcDateTime.AddDays(30)); // expiração deslizante
        (await _service.ValidateAccessTokenAsync(second.AccessToken)).Should().NotBeNull();
    }

    [Fact]
    public async Task Reused_refresh_token_fails_and_revokes_the_connection()
    {
        var (clientId, first) = await Connect();
        var second = await Refresh(clientId, first.RefreshToken);

        await ShouldFailWith(() => Refresh(clientId, first.RefreshToken), OAuthProtocolException.INVALID_GRANT);

        SingleGrant().RevokeReason.Should().Be(OAuthRevokeReason.RefreshTokenReuse);
        (await _service.ValidateAccessTokenAsync(second.AccessToken)).Should().BeNull();
        await ShouldFailWith(() => Refresh(clientId, second.RefreshToken), OAuthProtocolException.INVALID_GRANT);
    }

    [Fact]
    public async Task Refresh_fails_when_the_connection_was_revoked()
    {
        var (clientId, tokens) = await Connect();
        var grant = _context.OAuthGrants.Single();
        grant.Revoke(OAuthRevokeReason.UserDisconnected, _time.GetUtcNow().UtcDateTime);
        _context.SaveChanges();

        await ShouldFailWith(() => Refresh(clientId, tokens.RefreshToken), OAuthProtocolException.INVALID_GRANT);
        (await _service.ValidateAccessTokenAsync(tokens.AccessToken)).Should().BeNull();
    }

    [Fact]
    public async Task Refresh_can_only_reduce_scopes()
    {
        var (clientId, tokens) = await Connect();

        var reduced = await Refresh(clientId, tokens.RefreshToken, OAuthScopes.READ);
        reduced.Scope.Should().Be("finami:read");

        await ShouldFailWith(() => Refresh(clientId, reduced.RefreshToken, "finami:read finami:write"),
            OAuthProtocolException.INVALID_SCOPE);
    }

    // ---------------- Revogação e validação ----------------

    [Fact]
    public async Task Revoking_access_token_revokes_only_it()
    {
        var (clientId, tokens) = await Connect();

        await _service.RevokeTokenAsync(new OAuthTokenRequestInfo { ClientId = clientId, Token = tokens.AccessToken });

        (await _service.ValidateAccessTokenAsync(tokens.AccessToken)).Should().BeNull();
        SingleGrant().Status.Should().Be(OAuthGrantStatus.Active);
        (await Refresh(clientId, tokens.RefreshToken)).AccessToken.Should().NotBeNullOrEmpty();
    }

    [Fact]
    public async Task Revoking_refresh_token_revokes_the_connection()
    {
        var (clientId, tokens) = await Connect();

        await _service.RevokeTokenAsync(new OAuthTokenRequestInfo { ClientId = clientId, Token = tokens.RefreshToken });

        SingleGrant().RevokeReason.Should().Be(OAuthRevokeReason.ClientRevoked);
        (await _service.ValidateAccessTokenAsync(tokens.AccessToken)).Should().BeNull();
    }

    [Fact]
    public async Task Revoking_unknown_token_is_silent()
    {
        var client = await Register();
        await FluentActions.Awaiting(() => _service.RevokeTokenAsync(
                new OAuthTokenRequestInfo { ClientId = client.ClientId, Token = "fma_desconhecido" }))
            .Should().NotThrowAsync();
    }

    [Fact]
    public async Task Expired_access_token_is_invalid()
    {
        var (_, tokens) = await Connect();
        _time.Advance(TimeSpan.FromMinutes(61));
        (await _service.ValidateAccessTokenAsync(tokens.AccessToken)).Should().BeNull();
    }

    [Fact]
    public async Task Refresh_token_or_app_jwt_is_not_an_access_token()
    {
        var (_, tokens) = await Connect();
        (await _service.ValidateAccessTokenAsync(tokens.RefreshToken)).Should().BeNull();
        (await _service.ValidateAccessTokenAsync("eyJhbGciOiJIUzI1NiJ9.e30.x")).Should().BeNull();
    }
}

/// <summary>Relógio controlável para os testes de validade.</summary>
public sealed class TestTimeProvider : TimeProvider
{
    private DateTimeOffset _now;

    public TestTimeProvider(DateTimeOffset now)
    {
        _now = now;
    }

    public override DateTimeOffset GetUtcNow() => _now;

    public void Advance(TimeSpan delta) => _now = _now.Add(delta);
}
