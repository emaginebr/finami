using Finami.Domain.Models;
using Finami.Infra.Context;
using Finami.Infra.Interfaces.Repository;
using Microsoft.EntityFrameworkCore;

namespace Finami.Infra.Repository;

public class TransactionRepository : ITransactionRepository<Transaction>
{
    private readonly FinamiContext _context;

    public TransactionRepository(FinamiContext context)
    {
        _context = context;
    }

    /// <summary>Insere cabeçalho e lançamentos no mesmo SaveChanges (dentro da transação do IUnitOfWork).</summary>
    public async Task<Transaction> InsertWithEntriesAsync(Transaction transaction)
    {
        _context.Transactions.Add(transaction);
        await _context.SaveChangesAsync();
        return transaction;
    }

    public Task<Transaction?> GetByIdAsync(long transactionId) =>
        _context.Transactions.AsNoTracking()
            .Include(t => t.Entries)
            .FirstOrDefaultAsync(t => t.TransactionId == transactionId);

    public Task<Transaction?> GetReversalOfAsync(long transactionId) =>
        _context.Transactions.AsNoTracking()
            .FirstOrDefaultAsync(t => t.ReversedTransactionId == transactionId);
}
