namespace Finami.Infra.Interfaces.Repository;

/// <summary>Transações são imutáveis: apenas inserção e consulta (FR-030).</summary>
public interface ITransactionRepository<TModel> where TModel : class
{
    Task<TModel> InsertWithEntriesAsync(TModel transaction);
    Task<TModel?> GetByIdAsync(long transactionId);
    Task<TModel?> GetReversalOfAsync(long transactionId);
}
