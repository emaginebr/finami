namespace Finami.Infra.Interfaces.Repository;

/// <summary>Transações são imutáveis: apenas inserção e consulta (FR-030).</summary>
public interface ITransactionRepository<TModel> where TModel : class
{
    Task<TModel> InsertWithEntriesAsync(TModel transaction);
    Task<TModel?> GetByIdAsync(long transactionId);
    Task<TModel?> GetReversalOfAsync(long transactionId);

    /// <summary>
    /// Saldo entre a pessoa e cada contraparte, por moeda da dívida (feature 007, data-model.md): soma só os
    /// lançamentos com efeito na dívida (empréstimos, quitações e estornos deles) entre carteiras de titulares
    /// diferentes em que a pessoa é titular de um dos lados.
    /// <c>Balance = Σ efeito em que a pessoa é o destino − Σ efeito em que é a origem</c> (&gt; 0: a pessoa deve).
    /// <c>Currency</c> é o código int da moeda da dívida. Pares com saldo zero podem vir na lista.
    /// </summary>
    Task<List<(long CounterpartUserId, int Currency, decimal Balance)>> GetPersonDebtsAsync(long userId);

    /// <summary>
    /// Saldo "devedor deve a credor" numa moeda da dívida (código int), pela mesma regra de
    /// <see cref="GetPersonDebtsAsync"/>. ≤ 0 = o devedor não deve nada (negativo: é o credor quem deve).
    /// </summary>
    Task<decimal> GetPairDebtAsync(long debtorUserId, long creditorUserId, int currency);
}
