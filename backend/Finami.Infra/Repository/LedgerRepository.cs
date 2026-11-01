using Finami.Domain.Models;
using Finami.Infra.Context;
using Finami.Infra.Interfaces.Repository;
using Microsoft.EntityFrameworkCore;

namespace Finami.Infra.Repository;

public class LedgerRepository : ILedgerRepository<LedgerEntry>
{
    private readonly FinamiContext _context;

    public LedgerRepository(FinamiContext context)
    {
        _context = context;
    }

    public async Task<Dictionary<int, decimal>> GetOpeningBalancesAsync(IEnumerable<long> accountIds, DateTime beforeUtc)
    {
        var ids = accountIds.Distinct().ToList();
        var sums = await _context.LedgerEntries.AsNoTracking()
            .Where(e => ids.Contains(e.AccountId) && e.OccurredAt < beforeUtc)
            .GroupBy(e => e.Currency)
            .Select(g => new { Currency = g.Key, Sum = g.Sum(e => e.Amount) })
            .ToListAsync();
        return sums.ToDictionary(s => (int)s.Currency, s => s.Sum);
    }

    public Task<List<LedgerEntry>> ListEntriesAsync(IEnumerable<long> accountIds, DateTime fromUtc, DateTime toUtc)
    {
        var ids = accountIds.Distinct().ToList();
        return _context.LedgerEntries.AsNoTracking()
            .Include(e => e.Transaction)
            .Where(e => ids.Contains(e.AccountId) && e.OccurredAt >= fromUtc && e.OccurredAt < toUtc)
            .OrderBy(e => e.OccurredAt).ThenBy(e => e.TransactionId).ThenBy(e => e.LedgerEntryId)
            .ToListAsync();
    }
}
