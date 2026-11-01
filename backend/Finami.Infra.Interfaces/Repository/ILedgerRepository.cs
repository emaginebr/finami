namespace Finami.Infra.Interfaces.Repository;

public interface ILedgerRepository<TEntry> where TEntry : class
{
    /// <summary>Soma dos lançamentos anteriores a <paramref name="beforeUtc"/>, por moeda (código int).</summary>
    Task<Dictionary<int, decimal>> GetOpeningBalancesAsync(IEnumerable<long> accountIds, DateTime beforeUtc);

    /// <summary>Lançamentos em [fromUtc, toUtc), com o cabeçalho da transação, em ordem cronológica.</summary>
    Task<List<TEntry>> ListEntriesAsync(IEnumerable<long> accountIds, DateTime fromUtc, DateTime toUtc);
}
