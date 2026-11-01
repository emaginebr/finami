namespace Finami.Domain.Interfaces;

/// <summary>Resultado de uma rodada de limpeza (quantidades apagadas).</summary>
public record OAuthCleanupResult(int Requests, int Tokens, int IdempotencyKeys, int Clients, int AuditLogs)
{
    public int Total => Requests + Tokens + IdempotencyKeys + Clients + AuditLogs;
}

/// <summary>Limpeza periódica do OAuth/MCP (research R-10).</summary>
public interface IOAuthMaintenanceService
{
    Task<OAuthCleanupResult> CleanupAsync();
}
