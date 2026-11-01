namespace Finami.Infra.Interfaces.Repository;

/// <summary>Chaves de repetição das ferramentas de escrita do MCP (research R-08).</summary>
public interface IMcpIdempotencyRepository<TModel> where TModel : class
{
    Task<TModel?> GetAsync(long userId, string toolName, string idempotencyKey);

    /// <summary>Insere a chave; viola o índice único se ela já existir.</summary>
    Task<TModel> InsertAsync(TModel key);

    Task<TModel> UpdateAsync(TModel key);
    Task DeleteAsync(TModel key);
}
