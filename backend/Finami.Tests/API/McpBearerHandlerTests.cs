using System.Text.Encodings.Web;
using Finami.API.Auth;
using Finami.Domain.Enums;
using Finami.Domain.Models;
using Finami.Domain.Services;
using Finami.Domain.Validators;
using Finami.DTO.Settings;
using Finami.Infra.Context;
using Finami.Infra.Interfaces.Repository;
using Finami.Infra.Repository;
using Finami.Tests.Domain;
using FluentAssertions;
using Microsoft.AspNetCore.Authentication;
using Microsoft.AspNetCore.Http;
using Microsoft.Extensions.Logging.Abstractions;
using Microsoft.Extensions.Options;
using Moq;

namespace Finami.Tests.API;

/// <summary>T015 — esquema McpBearer (research R-03, contracts/oauth.md §Desafio no MCP).</summary>
public class McpBearerHandlerTests : IDisposable
{
    private const string BASE = "https://finami.test";
    private const long USER = 7;

    private readonly FinamiContext _context = OAuthServiceTests.NewInMemoryContext();
    private readonly TestTimeProvider _time = new(new DateTimeOffset(2026, 11, 1, 18, 0, 0, TimeSpan.Zero));
    private readonly OAuthService _service;
    private readonly OAuthGrant _grant;

    public McpBearerHandlerTests()
    {
        _context.Users.Add(new User { UserId = USER, FirstName = "Ana", LastName = "Silva" });
        var client = new OAuthClient { ClientId = "fmc_teste", ClientName = "Claude" };
        client.SetRedirectUris(new[] { "https://claude.ai/cb" });
        _context.OAuthClients.Add(client);
        _context.SaveChanges();
        _grant = new OAuthGrant
        {
            UserId = USER, OAuthClientId = client.OAuthClientId, Scopes = "finami:read finami:write",
            Status = OAuthGrantStatus.Active
        };
        _context.OAuthGrants.Add(_grant);
        _context.SaveChanges();

        _service = new OAuthService(
            new OAuthClientRepository(_context), new OAuthGrantRepository(_context),
            new OAuthRequestRepository(_context), new OAuthTokenRepository(_context),
            Mock.Of<IUnitOfWork>(), new OAuthClientRegistrationInfoValidator(), new OAuthApproveInfoValidator(),
            Options.Create(new McpSettings { PublicUrl = BASE }), _time);
    }

    public void Dispose() => _context.Dispose();

    private string AddAccessToken(string scopes = "finami:read finami:write", TimeSpan? lifetime = null)
    {
        var token = OAuthCrypto.GenerateToken(OAuthCrypto.ACCESS_TOKEN_PREFIX);
        var now = _time.GetUtcNow().UtcDateTime;
        _context.OAuthTokens.Add(new OAuthToken
        {
            OAuthGrantId = _grant.OAuthGrantId, TokenType = OAuthTokenType.Access,
            TokenHash = OAuthCrypto.Sha256Hex(token), Scopes = scopes,
            CreatedAt = now, ExpiresAt = now.Add(lifetime ?? TimeSpan.FromHours(1))
        });
        _context.SaveChanges();
        return token;
    }

    private async Task<(McpBearerHandler Handler, HttpContext Http)> NewHandler(string? authorization)
    {
        var options = new Mock<IOptionsMonitor<McpBearerOptions>>();
        options.Setup(o => o.Get(It.IsAny<string>())).Returns(new McpBearerOptions());
        var connections = new OAuthConnectionService(new OAuthGrantRepository(_context), new OAuthTokenRepository(_context),
            Mock.Of<IUnitOfWork>(), _service, _time);
        var handler = new McpBearerHandler(options.Object, NullLoggerFactory.Instance, UrlEncoder.Default, _service, connections);
        var http = new DefaultHttpContext();
        http.Request.Path = "/mcp";
        if (authorization != null)
            http.Request.Headers.Authorization = authorization;
        await handler.InitializeAsync(
            new AuthenticationScheme(McpBearerDefaults.AUTHENTICATION_SCHEME, null, typeof(McpBearerHandler)), http);
        return (handler, http);
    }

    private async Task<AuthenticateResult> Authenticate(string? authorization)
    {
        var (handler, _) = await NewHandler(authorization);
        return await handler.AuthenticateAsync();
    }

    [Fact]
    public async Task Valid_token_builds_principal_with_sub_grant_client_and_scope()
    {
        var token = AddAccessToken("finami:read");

        var result = await Authenticate($"Bearer {token}");

        result.Succeeded.Should().BeTrue();
        var user = result.Principal!;
        user.FindFirst("sub")!.Value.Should().Be(USER.ToString());
        user.FindFirst("grant_id")!.Value.Should().Be(_grant.OAuthGrantId.ToString());
        user.FindFirst("client_id")!.Value.Should().Be("fmc_teste");
        user.FindFirst("scope")!.Value.Should().Be("finami:read");
        user.HasScope(McpScopes.READ).Should().BeTrue();
        user.HasScope(McpScopes.WRITE).Should().BeFalse();
        user.GetGrantId().Should().Be(_grant.OAuthGrantId);
        user.Identity!.AuthenticationType.Should().Be(McpBearerDefaults.AUTHENTICATION_SCHEME);
    }

    [Fact]
    public async Task Valid_token_touches_last_used_at_at_most_once_per_minute()
    {
        var token = AddAccessToken();
        var start = _time.GetUtcNow().UtcDateTime;

        (await Authenticate($"Bearer {token}")).Succeeded.Should().BeTrue();
        Reload().LastUsedAt.Should().Be(start);

        _time.Advance(TimeSpan.FromSeconds(30));
        (await Authenticate($"Bearer {token}")).Succeeded.Should().BeTrue();
        Reload().LastUsedAt.Should().Be(start, "dentro de 1 minuto não grava de novo");

        _time.Advance(TimeSpan.FromSeconds(31));
        (await Authenticate($"Bearer {token}")).Succeeded.Should().BeTrue();
        Reload().LastUsedAt.Should().Be(start.AddSeconds(61));
    }

    private OAuthGrant Reload()
    {
        _context.ChangeTracker.Clear();
        return _context.OAuthGrants.Single(g => g.OAuthGrantId == _grant.OAuthGrantId);
    }

    [Fact]
    public async Task Expired_token_fails()
    {
        var token = AddAccessToken(lifetime: TimeSpan.FromMinutes(1));
        _time.Advance(TimeSpan.FromMinutes(2));

        (await Authenticate($"Bearer {token}")).Succeeded.Should().BeFalse();
    }

    [Fact]
    public async Task Revoked_token_fails()
    {
        var token = AddAccessToken();
        _context.OAuthTokens.Single().Revoke(_time.GetUtcNow().UtcDateTime);
        _context.SaveChanges();

        (await Authenticate($"Bearer {token}")).Succeeded.Should().BeFalse();
    }

    [Fact]
    public async Task Token_of_revoked_connection_fails()
    {
        var token = AddAccessToken();
        _grant.Revoke(OAuthRevokeReason.UserDisconnected, _time.GetUtcNow().UtcDateTime);
        _context.SaveChanges();

        (await Authenticate($"Bearer {token}")).Succeeded.Should().BeFalse();
    }

    [Fact]
    public async Task App_jwt_is_refused_without_looking_up_the_database()
    {
        var oauth = new Mock<Finami.Domain.Interfaces.IOAuthService>();
        var options = new Mock<IOptionsMonitor<McpBearerOptions>>();
        options.Setup(o => o.Get(It.IsAny<string>())).Returns(new McpBearerOptions());
        var handler = new McpBearerHandler(options.Object, NullLoggerFactory.Instance, UrlEncoder.Default, oauth.Object,
            Mock.Of<Finami.Domain.Interfaces.IOAuthConnectionService>());
        var http = new DefaultHttpContext();
        http.Request.Headers.Authorization = "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxIn0.assinatura";
        await handler.InitializeAsync(
            new AuthenticationScheme(McpBearerDefaults.AUTHENTICATION_SCHEME, null, typeof(McpBearerHandler)), http);

        var result = await handler.AuthenticateAsync();

        result.Succeeded.Should().BeFalse();
        result.Failure.Should().NotBeNull();
        oauth.Verify(o => o.ValidateAccessTokenAsync(It.IsAny<string>()), Times.Never);
    }

    [Fact]
    public async Task Missing_header_is_no_result()
    {
        var result = await Authenticate(null);
        result.None.Should().BeTrue();
    }

    [Fact]
    public async Task Challenge_without_token_points_to_resource_metadata()
    {
        var (handler, http) = await NewHandler(null);
        await handler.AuthenticateAsync();

        await handler.ChallengeAsync(new AuthenticationProperties());

        http.Response.StatusCode.Should().Be(401);
        var header = http.Response.Headers.WWWAuthenticate.ToString();
        header.Should().Be($"Bearer resource_metadata=\"{BASE}/.well-known/oauth-protected-resource\"");
    }

    [Fact]
    public async Task Challenge_with_invalid_token_adds_invalid_token_error()
    {
        var (handler, http) = await NewHandler("Bearer fma_invalido");
        await handler.AuthenticateAsync();

        await handler.ChallengeAsync(new AuthenticationProperties());

        http.Response.StatusCode.Should().Be(401);
        var header = http.Response.Headers.WWWAuthenticate.ToString();
        header.Should().StartWith($"Bearer resource_metadata=\"{BASE}/.well-known/oauth-protected-resource\"");
        header.Should().Contain("error=\"invalid_token\"");
        header.All(c => c < 128).Should().BeTrue("cabeçalhos HTTP só aceitam ASCII");
    }
}
