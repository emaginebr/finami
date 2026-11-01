namespace Finami.Infra.Interfaces.Repository;

/// <summary>Conexões pessoa ↔ assistente — feature 004.</summary>
public interface IOAuthGrantRepository<TModel> where TModel : class
{
    /// <summary>Conexão pelo id, com o cliente carregado.</summary>
    Task<TModel?> GetByIdAsync(long grantId);

    /// <summary>Conexão ativa da pessoa com o assistente, se houver (rastreada para atualização).</summary>
    Task<TModel?> GetActiveAsync(long userId, long oauthClientId);

    /// <summary>Conexões ativas da pessoa, mais recentes primeiro, com o cliente carregado.</summary>
    Task<List<TModel>> ListActiveByUserAsync(long userId);

    Task<TModel> InsertAsync(TModel grant);
    Task<TModel> UpdateAsync(TModel grant);
}
