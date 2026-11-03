using Finami.Domain.Enums;
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

    /// <summary>
    /// Uma consulta agrupada sobre transactions ⨝ accounts (origem) ⨝ accounts (destino); usa os índices
    /// ix_transactions_source_account_id / ix_transactions_destination_account_id. Estornos de transferências
    /// entram com o sentido invertido e compensam sozinhos; conversões (moedas diferentes) ficam de fora.
    /// </summary>
    public async Task<List<(long CounterpartUserId, int Currency, decimal Balance)>> GetPersonDebtsAsync(long userId)
    {
        var rows = await (
                from t in _context.Transactions
                join source in _context.Accounts on t.SourceAccountId equals source.AccountId
                join destination in _context.Accounts on t.DestinationAccountId equals destination.AccountId
                where source.Kind == AccountKind.Wallet && destination.Kind == AccountKind.Wallet
                      && source.Currency == destination.Currency
                      && source.UserId != null && destination.UserId != null
                      && source.UserId != destination.UserId
                      && (source.UserId == userId || destination.UserId == userId)
                select new
                {
                    CounterpartUserId = source.UserId == userId ? destination.UserId!.Value : source.UserId!.Value,
                    source.Currency,
                    Signed = destination.UserId == userId ? t.DestinationAmount : -t.SourceAmount
                })
            .GroupBy(x => new { x.CounterpartUserId, x.Currency })
            .Select(g => new { g.Key.CounterpartUserId, g.Key.Currency, Balance = g.Sum(x => x.Signed) })
            .ToListAsync();
        return rows.Select(r => (r.CounterpartUserId, (int)r.Currency, r.Balance)).ToList();
    }
}
