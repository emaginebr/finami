namespace Finami.Infra.Interfaces.Repository;

/// <summary>Limpeza periódica das tabelas do OAuth/MCP (research R-10). Cada método devolve quantas linhas apagou.</summary>
public interface IOAuthCleanupRepository
{
    /// <summary>Pedidos de autorização (e códigos) vencidos antes de <paramref name="expiredBefore"/>.</summary>
    Task<int> DeleteExpiredRequestsAsync(DateTime expiredBefore);

    /// <summary>
    /// Tokens de acesso vencidos antes de <paramref name="accessExpiredBefore"/> e tokens de renovação vencidos ou
    /// revogados antes de <paramref name="refreshInactiveBefore"/>. Anula antes o <c>parent_token_id</c> dos filhos
    /// (FK <c>fk_oauth_token_parent</c>).
    /// </summary>
    Task<int> DeleteOldTokensAsync(DateTime accessExpiredBefore, DateTime refreshInactiveBefore);

    /// <summary>Chaves de repetição criadas antes de <paramref name="createdBefore"/>.</summary>
    Task<int> DeleteIdempotencyKeysAsync(DateTime createdBefore);

    /// <summary>Clientes dinâmicos criados antes de <paramref name="createdBefore"/> sem nenhuma conexão nem pedido.</summary>
    Task<int> DeleteUnusedDynamicClientsAsync(DateTime createdBefore);

    /// <summary>Linhas de auditoria criadas antes de <paramref name="createdBefore"/>.</summary>
    Task<int> DeleteAuditLogsAsync(DateTime createdBefore);
}
