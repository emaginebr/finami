using System.Security.Claims;
using System.Text.Encodings.Web;
using Finami.Domain.Interfaces;
using Finami.Domain.Services;
using Microsoft.AspNetCore.Authentication;
using Microsoft.Extensions.Options;
using Microsoft.Net.Http.Headers;

namespace Finami.API.Auth;

public static class McpBearerDefaults
{
    /// <summary>Esquema do token opaco do MCP, separado do JwtBearer do app (FR-009).</summary>
    public const string AUTHENTICATION_SCHEME = "McpBearer";

    /// <summary>Política aplicada só a <c>/mcp</c>.</summary>
    public const string POLICY = "McpBearerPolicy";
}

public class McpBearerOptions : AuthenticationSchemeOptions
{
}

/// <summary>
/// Valida o token opaco <c>fma_…</c> (uma consulta indexada ao hash) e monta o principal com
/// <c>sub</c>, <c>grant_id</c>, <c>client_id</c> e <c>scope</c>. O JWT do app nunca passa aqui e o token
/// do MCP nunca passa no JwtBearer das rotas <c>/api/*</c>. O desafio 401 aponta os metadados do
/// recurso protegido (RFC 9728 §5.1).
/// </summary>
public class McpBearerHandler : AuthenticationHandler<McpBearerOptions>
{
    private const string BEARER_PREFIX = "Bearer ";
    private const string TOKEN_PRESENTED_ITEM = "McpBearer.TokenPresented";

    private readonly IOAuthService _oauthService;
    private readonly IOAuthConnectionService _connectionService;

    public McpBearerHandler(
        IOptionsMonitor<McpBearerOptions> options,
        ILoggerFactory logger,
        UrlEncoder encoder,
        IOAuthService oauthService,
        IOAuthConnectionService connectionService)
        : base(options, logger, encoder)
    {
        _oauthService = oauthService;
        _connectionService = connectionService;
    }

    protected override async Task<AuthenticateResult> HandleAuthenticateAsync()
    {
        string? header = Request.Headers.Authorization;
        if (string.IsNullOrEmpty(header) || !header.StartsWith(BEARER_PREFIX, StringComparison.OrdinalIgnoreCase))
            return AuthenticateResult.NoResult();

        Context.Items[TOKEN_PRESENTED_ITEM] = true;
        var token = header[BEARER_PREFIX.Length..].Trim();
        if (!token.StartsWith(OAuthCrypto.ACCESS_TOKEN_PREFIX, StringComparison.Ordinal))
            return AuthenticateResult.Fail("Token não é um token de acesso do MCP.");

        var info = await _oauthService.ValidateAccessTokenAsync(token);
        if (info == null)
            return AuthenticateResult.Fail("Token inválido, vencido ou revogado.");

        await TouchLastUsedAsync(info.GrantId, info.GrantLastUsedAt);

        var claims = new List<Claim>
        {
            new(McpScopes.SUB_CLAIM, info.UserId.ToString()),
            new(McpScopes.GRANT_ID_CLAIM, info.GrantId.ToString()),
            new(McpScopes.CLIENT_ID_CLAIM, info.ClientId),
            new(McpScopes.CLIENT_NAME_CLAIM, info.ClientName),
            new(McpScopes.SCOPE_CLAIM, string.Join(' ', info.Scopes))
        };
        var identity = new ClaimsIdentity(claims, Scheme.Name, McpScopes.SUB_CLAIM, null);
        return AuthenticateResult.Success(new AuthenticationTicket(new ClaimsPrincipal(identity), Scheme.Name));
    }

    /// <summary>R-09: <c>last_used_at</c> no máximo 1×/min; falha aqui nunca derruba a chamada.</summary>
    private async Task TouchLastUsedAsync(long grantId, DateTime? lastUsedAt)
    {
        try
        {
            await _connectionService.TouchLastUsedAsync(grantId, lastUsedAt);
        }
        catch (Exception ex)
        {
            Logger.LogWarning(ex, "Não foi possível atualizar o último uso da conexão {GrantId}.", grantId);
        }
    }

    protected override Task HandleChallengeAsync(AuthenticationProperties properties)
    {
        Response.StatusCode = StatusCodes.Status401Unauthorized;
        Response.Headers.Append(HeaderNames.WWWAuthenticate, BuildChallenge());
        return Task.CompletedTask;
    }

    /// <summary><c>Bearer resource_metadata="…"</c>, com <c>error="invalid_token"</c> quando houve token.</summary>
    private string BuildChallenge()
    {
        var metadataUrl = $"{_oauthService.Issuer}/.well-known/oauth-protected-resource";
        var challenge = $"Bearer resource_metadata=\"{metadataUrl}\"";
        if (Context.Items.ContainsKey(TOKEN_PRESENTED_ITEM))
            // Cabeçalho HTTP só aceita ASCII: descrição sem acentos.
            challenge += ", error=\"invalid_token\", error_description=\"Token invalido, vencido ou revogado\"";
        return challenge;
    }
}
