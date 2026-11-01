using Finami.Domain.Enums;
using Finami.Infra.Context;
using Finami.Infra.Interfaces.Repository;
using Microsoft.EntityFrameworkCore;

namespace Finami.Infra.Repository;

/// <summary>
/// Limpeza em lote (research R-10) com <c>ExecuteUpdate</c>/<c>ExecuteDelete</c>: comparações de data no WHERE
/// passam pelo conversor UTC do modelo (Princípio V).
/// </summary>
public class OAuthCleanupRepository : IOAuthCleanupRepository
{
    private readonly FinamiContext _context;

    public OAuthCleanupRepository(FinamiContext context)
    {
        _context = context;
    }

    public Task<int> DeleteExpiredRequestsAsync(DateTime expiredBefore) =>
        _context.OAuthAuthorizationRequests
            .Where(r => r.ExpiresAt < expiredBefore)
            .ExecuteDeleteAsync();

    public async Task<int> DeleteOldTokensAsync(DateTime accessExpiredBefore, DateTime refreshInactiveBefore)
    {
        var deletable = _context.OAuthTokens.Where(t =>
            (t.TokenType == OAuthTokenType.Access && t.ExpiresAt < accessExpiredBefore)
            || (t.TokenType == OAuthTokenType.Refresh
                && (t.ExpiresAt < refreshInactiveBefore
                    || (t.RevokedAt != null && t.RevokedAt < refreshInactiveBefore))));
        var deletableIds = deletable.Select(t => t.OAuthTokenId);

        // fk_oauth_token_parent: filhos (que podem ficar) deixam de apontar para o pai que será apagado.
        await _context.OAuthTokens
            .Where(t => t.ParentTokenId != null && deletableIds.Contains(t.ParentTokenId.Value))
            .ExecuteUpdateAsync(s => s.SetProperty(t => t.ParentTokenId, (long?)null));

        return await deletable.ExecuteDeleteAsync();
    }

    public Task<int> DeleteIdempotencyKeysAsync(DateTime createdBefore) =>
        _context.McpIdempotencyKeys
            .Where(k => k.CreatedAt < createdBefore)
            .ExecuteDeleteAsync();

    public Task<int> DeleteUnusedDynamicClientsAsync(DateTime createdBefore) =>
        _context.OAuthClients
            .Where(c => c.IsDynamic && c.CreatedAt < createdBefore
                        && !_context.OAuthGrants.Any(g => g.OAuthClientId == c.OAuthClientId)
                        && !_context.OAuthAuthorizationRequests.Any(r => r.OAuthClientId == c.OAuthClientId))
            .ExecuteDeleteAsync();

    public Task<int> DeleteAuditLogsAsync(DateTime createdBefore) =>
        _context.McpAuditLogs
            .Where(l => l.CreatedAt < createdBefore)
            .ExecuteDeleteAsync();
}
