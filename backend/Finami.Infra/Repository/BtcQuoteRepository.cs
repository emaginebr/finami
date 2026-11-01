using Finami.Domain.Models;
using Finami.Infra.Context;
using Finami.Infra.Interfaces.Repository;
using Microsoft.EntityFrameworkCore;

namespace Finami.Infra.Repository;

public class BtcQuoteRepository : IBtcQuoteRepository<BtcQuote>
{
    private readonly FinamiContext _context;

    public BtcQuoteRepository(FinamiContext context)
    {
        _context = context;
    }

    public async Task<BtcQuote> InsertAsync(BtcQuote quote)
    {
        _context.BtcQuotes.Add(quote);
        await _context.SaveChangesAsync();
        return quote;
    }

    public Task<BtcQuote?> GetLatestAsync() =>
        _context.BtcQuotes.AsNoTracking().OrderByDescending(q => q.QuotedAt).ThenByDescending(q => q.BtcQuoteId)
            .FirstOrDefaultAsync();

    public Task<BtcQuote?> GetByIdAsync(long btcQuoteId) =>
        _context.BtcQuotes.AsNoTracking().FirstOrDefaultAsync(q => q.BtcQuoteId == btcQuoteId);
}
