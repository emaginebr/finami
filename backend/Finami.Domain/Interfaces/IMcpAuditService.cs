namespace Finami.Domain.Interfaces;

/// <summary>Auditoria das ferramentas de escrita do MCP (research R-09, FR-024).</summary>
public interface IMcpAuditService
{
    /// <summary>
    /// Registra uma execução: pessoa, conexão, ferramenta, resultado (<c>sucesso</c> ou código de erro) e id
    /// afetado. Nunca recebe argumentos brutos nem tokens.
    /// </summary>
    Task RecordAsync(long userId, long grantId, string toolName, string outcome, long? targetId);
}
