namespace Finami.Infra.Interfaces.Repository;

/// <summary>Auditoria das ferramentas de escrita do MCP (research R-09).</summary>
public interface IMcpAuditRepository<TModel> where TModel : class
{
    Task<TModel> InsertAsync(TModel log);
}
