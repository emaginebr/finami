namespace Finami.Infra.Interfaces.Repository;

/// <summary>Pedidos de autorização OAuth e códigos emitidos — feature 004.</summary>
public interface IOAuthRequestRepository<TModel> where TModel : class
{
    /// <summary>Pedido pela chave pública (<c>/autorizar?pedido=</c>), com o cliente carregado.</summary>
    Task<TModel?> GetByRequestKeyAsync(string requestKey);

    /// <summary>Lê e bloqueia o pedido (SELECT ... FOR UPDATE), com o cliente carregado; exige transação aberta.</summary>
    Task<TModel?> GetByRequestKeyForUpdateAsync(string requestKey);

    /// <summary>Lê e bloqueia o pedido pelo hash do código, com o cliente carregado; exige transação aberta.</summary>
    Task<TModel?> GetByCodeHashForUpdateAsync(string codeHash);

    Task<TModel> InsertAsync(TModel request);
    Task<TModel> UpdateAsync(TModel request);
}
