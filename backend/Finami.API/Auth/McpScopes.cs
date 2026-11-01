using System.Security.Claims;
using Finami.Domain.Models;

namespace Finami.API.Auth;

/// <summary>Escopos e claims do token do MCP (research R-03/R-06).</summary>
public static class McpScopes
{
    public const string READ = OAuthScopes.READ;
    public const string WRITE = OAuthScopes.WRITE;

    public const string SUB_CLAIM = "sub";
    public const string GRANT_ID_CLAIM = "grant_id";
    public const string CLIENT_ID_CLAIM = "client_id";
    public const string CLIENT_NAME_CLAIM = "client_name";

    /// <summary>Escopos separados por espaço, num único claim (RFC 8693 §4.2).</summary>
    public const string SCOPE_CLAIM = "scope";

    public static bool HasScope(this ClaimsPrincipal principal, string scope) =>
        principal.FindAll(SCOPE_CLAIM).Any(c => OAuthScopes.Has(c.Value, scope));

    public static long GetGrantId(this ClaimsPrincipal principal) =>
        long.TryParse(principal.FindFirstValue(GRANT_ID_CLAIM), out var id) ? id : 0;
}
