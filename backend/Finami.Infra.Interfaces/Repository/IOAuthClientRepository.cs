namespace Finami.Infra.Interfaces.Repository;

/// <summary>Clientes OAuth (assistentes registrados) — feature 004.</summary>
public interface IOAuthClientRepository<TModel> where TModel : class
{
    Task<TModel?> GetByIdAsync(long oauthClientId);

    /// <summary>Cliente pelo <c>client_id</c> público.</summary>
    Task<TModel?> GetByClientIdAsync(string clientId);

    Task<TModel> InsertAsync(TModel client);
}
