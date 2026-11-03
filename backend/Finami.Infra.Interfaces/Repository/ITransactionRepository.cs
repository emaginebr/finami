namespace Finami.Infra.Interfaces.Repository;

/// <summary>Transações são imutáveis: apenas inserção e consulta (FR-030).</summary>
public interface ITransactionRepository<TModel> where TModel : class
{
    Task<TModel> InsertWithEntriesAsync(TModel transaction);
    Task<TModel?> GetByIdAsync(long transactionId);
    Task<TModel?> GetReversalOfAsync(long transactionId);

    /// <summary>
    /// Saldo entre a pessoa e cada contraparte, por moeda (feature 006, R-01): transações entre carteiras de
    /// titulares diferentes e mesma moeda em que a pessoa é titular de um dos lados.
    /// <c>Balance = Σ recebido da contraparte − Σ enviado a ela</c> (&gt; 0: a pessoa deve). <c>Currency</c> é o
    /// código int da moeda. Pares com saldo zero podem vir na lista.
    /// </summary>
    Task<List<(long CounterpartUserId, int Currency, decimal Balance)>> GetPersonDebtsAsync(long userId);
}
