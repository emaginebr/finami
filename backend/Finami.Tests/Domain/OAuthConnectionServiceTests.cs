using Finami.Domain.Enums;
using Finami.Domain.Exceptions;
using Finami.Domain.Interfaces;
using Finami.Domain.Models;
using Finami.Domain.Services;
using Finami.Domain.Validators;
using Finami.DTO.OAuth;
using Finami.DTO.Settings;
using Finami.Infra.Context;
using Finami.Infra.Interfaces.Repository;
using Finami.Infra.Repository;
using FluentAssertions;
using Microsoft.Extensions.Options;
using Moq;

namespace Finami.Tests.Domain;

/// <summary>T043 — "Assistentes conectados" (US4, contracts/api.md) sobre repositórios reais em EF InMemory.</summary>
public class OAuthConnectionServiceTests : IDisposable
{
    private const string BASE = "https://finami.test";
    private const long USER = 1;
    private const long OTHER = 2;

    private readonly FinamiContext _context = OAuthServiceTests.NewInMemoryContext();
    private readonly TestTimeProvider _time = new(new DateTimeOffset(2026, 11, 1, 18, 0, 0, TimeSpan.Zero));
    private readonly OAuthService _oauth;
    private readonly OAuthConnectionService _service;

    public OAuthConnectionServiceTests()
    {
        _context.Users.AddRange(
            new User { UserId = USER, FirstName = "Ana", LastName = "Silva" },
            new User { UserId = OTHER, FirstName = "Bruno", LastName = "Souza" });
        _context.SaveChanges();

        _oauth = new OAuthService(
            new OAuthClientRepository(_context), new OAuthGrantRepository(_context),
            new OAuthRequestRepository(_context), new OAuthTokenRepository(_context),
            Mock.Of<IUnitOfWork>(), new OAuthClientRegistrationInfoValidator(), new OAuthApproveInfoValidator(),
            Options.Create(new McpSettings { PublicUrl = BASE }), _time);
        _service = new OAuthConnectionService(new OAuthGrantRepository(_context), new OAuthTokenRepository(_context),
            Mock.Of<IUnitOfWork>(), _oauth, _time);
    }

    public void Dispose() => _context.Dispose();

    private DateTime Now => _time.GetUtcNow().UtcDateTime;

    private sealed record Connection(OAuthGrant Grant, OAuthClient Client, string AccessToken, string RefreshToken);

    private Connection Connect(long userId, string clientName = "Claude", string scopes = "finami:read finami:write")
    {
        var client = new OAuthClient { ClientId = OAuthCrypto.GenerateToken(OAuthCrypto.CLIENT_ID_PREFIX), ClientName = clientName };
        client.SetRedirectUris(new[] { "https://claude.ai/cb" });
        _context.OAuthClients.Add(client);
        _context.SaveChanges();
        var grant = new OAuthGrant { UserId = userId, OAuthClientId = client.OAuthClientId, Scopes = scopes, CreatedAt = Now };
        _context.OAuthGrants.Add(grant);
        _context.SaveChanges();

        var access = OAuthCrypto.GenerateToken(OAuthCrypto.ACCESS_TOKEN_PREFIX);
        var refresh = OAuthCrypto.GenerateToken(OAuthCrypto.REFRESH_TOKEN_PREFIX);
        _context.OAuthTokens.AddRange(
            new OAuthToken { OAuthGrantId = grant.OAuthGrantId, TokenType = OAuthTokenType.Access, TokenHash = OAuthCrypto.Sha256Hex(access), Scopes = scopes, CreatedAt = Now, ExpiresAt = Now.AddHours(1) },
            new OAuthToken { OAuthGrantId = grant.OAuthGrantId, TokenType = OAuthTokenType.Refresh, TokenHash = OAuthCrypto.Sha256Hex(refresh), Scopes = scopes, CreatedAt = Now, ExpiresAt = Now.AddDays(30) });
        _context.SaveChanges();
        return new Connection(grant, client, access, refresh);
    }

    private Task<OAuthTokenResult> Refresh(Connection connection) =>
        _oauth.RefreshAsync(new OAuthTokenRequestInfo
        {
            GrantType = "refresh_token", RefreshToken = connection.RefreshToken, ClientId = connection.Client.ClientId
        });

    [Fact]
    public async Task List_returns_only_own_active_connections_newest_first()
    {
        var older = Connect(USER, "Claude");
        _time.Advance(TimeSpan.FromMinutes(5));
        var newer = Connect(USER, "ChatGPT", "finami:read");
        Connect(OTHER, "Claude");
        var revoked = Connect(USER, "Antigo");
        revoked.Grant.Revoke(OAuthRevokeReason.UserDisconnected, Now);
        _context.SaveChanges();

        var list = await _service.ListAsync(USER);

        list.Select(c => c.ConnectionId).Should().Equal(newer.Grant.OAuthGrantId, older.Grant.OAuthGrantId);
        list[0].ClientName.Should().Be("ChatGPT");
        list[0].Scopes.Should().Equal("finami:read");
        list[1].Scopes.Should().Equal("finami:read", "finami:write");
    }

    [Fact]
    public async Task Disconnect_revokes_connection_and_tokens_immediately()
    {
        var connection = Connect(USER);
        (await _oauth.ValidateAccessTokenAsync(connection.AccessToken)).Should().NotBeNull();

        await _service.DisconnectAsync(USER, connection.Grant.OAuthGrantId);

        _context.ChangeTracker.Clear();
        var grant = _context.OAuthGrants.Single(g => g.OAuthGrantId == connection.Grant.OAuthGrantId);
        grant.Status.Should().Be(OAuthGrantStatus.Revoked);
        grant.RevokeReason.Should().Be(OAuthRevokeReason.UserDisconnected);
        _context.OAuthTokens.Where(t => t.OAuthGrantId == grant.OAuthGrantId).Should().OnlyContain(t => t.RevokedAt != null);
        (await _oauth.ValidateAccessTokenAsync(connection.AccessToken)).Should().BeNull();
        await FluentActions.Awaiting(() => Refresh(connection)).Should().ThrowAsync<OAuthProtocolException>();
        (await _service.ListAsync(USER)).Should().BeEmpty();
    }

    [Fact]
    public async Task Disconnecting_someone_elses_or_revoked_connection_is_404()
    {
        var other = Connect(OTHER);
        var own = Connect(USER);
        await _service.DisconnectAsync(USER, own.Grant.OAuthGrantId);

        var foreign = () => _service.DisconnectAsync(USER, other.Grant.OAuthGrantId);
        var again = () => _service.DisconnectAsync(USER, own.Grant.OAuthGrantId);
        var missing = () => _service.DisconnectAsync(USER, 9999);

        (await foreign.Should().ThrowAsync<NotFoundException>()).WithMessage("Conexão não encontrada.");
        await again.Should().ThrowAsync<NotFoundException>();
        await missing.Should().ThrowAsync<NotFoundException>();
        (await _oauth.ValidateAccessTokenAsync(other.AccessToken)).Should().NotBeNull("a conexão de outra pessoa continua");
    }

    [Fact]
    public async Task Disconnect_all_revokes_only_own_connections()
    {
        var first = Connect(USER, "Claude");
        var second = Connect(USER, "ChatGPT");
        var other = Connect(OTHER);

        var count = await _service.DisconnectAllAsync(USER);

        count.Should().Be(2);
        (await _oauth.ValidateAccessTokenAsync(first.AccessToken)).Should().BeNull();
        (await _oauth.ValidateAccessTokenAsync(second.AccessToken)).Should().BeNull();
        (await _oauth.ValidateAccessTokenAsync(other.AccessToken)).Should().NotBeNull();
        _context.ChangeTracker.Clear();
        _context.OAuthGrants.Where(g => g.UserId == USER)
            .Should().OnlyContain(g => g.RevokeReason == OAuthRevokeReason.UserDisconnectedAll);
        (await _service.DisconnectAllAsync(USER)).Should().Be(0);
    }

    [Fact]
    public async Task Touch_updates_last_used_at_at_most_once_per_minute()
    {
        var connection = Connect(USER);
        var id = connection.Grant.OAuthGrantId;
        var start = Now;

        (await _service.TouchLastUsedAsync(id, null)).Should().BeTrue();
        _time.Advance(TimeSpan.FromSeconds(40));
        (await _service.TouchLastUsedAsync(id, start)).Should().BeFalse("o token informa uso recente");
        (await _service.TouchLastUsedAsync(id, null)).Should().BeFalse("o banco já tem uso recente");
        _time.Advance(TimeSpan.FromSeconds(30));
        (await _service.TouchLastUsedAsync(id, start)).Should().BeTrue();

        (await _service.ListAsync(USER)).Single().LastUsedAt.Should().Be(start.AddSeconds(70));
    }

    [Fact]
    public async Task Touch_ignores_revoked_connections()
    {
        var connection = Connect(USER);
        await _service.DisconnectAsync(USER, connection.Grant.OAuthGrantId);

        (await _service.TouchLastUsedAsync(connection.Grant.OAuthGrantId, null)).Should().BeFalse();
    }

    [Fact]
    public void Mcp_info_is_the_protected_resource()
    {
        _service.GetMcpInfo().McpUrl.Should().Be(BASE + "/mcp");
    }
}

/// <summary>T058 — regras de retenção da limpeza (research R-10).</summary>
public class OAuthMaintenanceServiceTests
{
    [Fact]
    public async Task Cleanup_applies_each_retention_rule_in_order()
    {
        var now = new DateTimeOffset(2026, 11, 1, 12, 0, 0, TimeSpan.Zero);
        var utc = now.UtcDateTime;
        var repository = new Mock<IOAuthCleanupRepository>(MockBehavior.Strict);
        var sequence = new MockSequence();
        repository.InSequence(sequence).Setup(r => r.DeleteExpiredRequestsAsync(utc)).ReturnsAsync(3);
        repository.InSequence(sequence).Setup(r => r.DeleteOldTokensAsync(utc.AddDays(-1), utc.AddDays(-30))).ReturnsAsync(5);
        repository.InSequence(sequence).Setup(r => r.DeleteIdempotencyKeysAsync(utc.AddHours(-24))).ReturnsAsync(7);
        repository.InSequence(sequence).Setup(r => r.DeleteUnusedDynamicClientsAsync(utc.AddDays(-30))).ReturnsAsync(1);
        repository.InSequence(sequence).Setup(r => r.DeleteAuditLogsAsync(utc.AddDays(-365))).ReturnsAsync(2);

        var result = await new OAuthMaintenanceService(repository.Object, new TestTimeProvider(now)).CleanupAsync();

        result.Should().Be(new OAuthCleanupResult(3, 5, 7, 1, 2));
        result.Total.Should().Be(18);
        repository.VerifyAll();
    }
}
