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
    /// Feature 007: uma consulta agrupada sobre transactions ⨝ accounts (origem) ⨝ accounts (destino), só com os
    /// lançamentos que têm efeito na dívida (debt_amount preenchido); usa os índices
    /// ix_transactions_source_account_id / ix_transactions_destination_account_id. O efeito é sempre "o titular do
    /// destino deve ao da origem": empréstimo e quitação somam no mesmo sentido, e o estorno (origem e destino
    /// invertidos, mesmo efeito) desfaz. Pagamentos, conversões e lançamentos do mesmo titular ficam de fora.
    /// </summary>
    public async Task<List<(long CounterpartUserId, int Currency, decimal Balance)>> GetPersonDebtsAsync(long userId)
    {
        var rows = await (
                from effect in DebtEffects()
                where effect.SourceUserId == userId || effect.DestinationUserId == userId
                select new
                {
                    CounterpartUserId = effect.SourceUserId == userId ? effect.DestinationUserId : effect.SourceUserId,
                    effect.Currency,
                    Signed = effect.DestinationUserId == userId ? effect.Amount : -effect.Amount
                })
            .GroupBy(x => new { x.CounterpartUserId, x.Currency })
            .Select(g => new { g.Key.CounterpartUserId, g.Key.Currency, Balance = g.Sum(x => x.Signed) })
            .ToListAsync();
        return rows.Select(r => (r.CounterpartUserId, (int)r.Currency, r.Balance)).ToList();
    }

    public async Task<decimal> GetPairDebtAsync(long debtorUserId, long creditorUserId, int currency)
    {
        var debtCurrency = (Currency)currency;
        return await (
                from effect in DebtEffects()
                where effect.Currency == debtCurrency
                      && ((effect.DestinationUserId == debtorUserId && effect.SourceUserId == creditorUserId)
                          || (effect.SourceUserId == debtorUserId && effect.DestinationUserId == creditorUserId))
                select effect.DestinationUserId == debtorUserId ? effect.Amount : -effect.Amount)
            .SumAsync();
    }

    private sealed class DebtEffect
    {
        public long SourceUserId { get; init; }
        public long DestinationUserId { get; init; }
        public Currency Currency { get; init; }
        public decimal Amount { get; init; }
    }

    /// <summary>Lançamentos com efeito na dívida, com os titulares da origem e do destino.</summary>
    private IQueryable<DebtEffect> DebtEffects() =>
        from t in _context.Transactions
        join source in _context.Accounts on t.SourceAccountId equals source.AccountId
        join destination in _context.Accounts on t.DestinationAccountId equals destination.AccountId
        where t.DebtAmount != null && t.DebtCurrency != null
              && source.UserId != null && destination.UserId != null
              && source.UserId != destination.UserId
        select new DebtEffect
        {
            SourceUserId = source.UserId!.Value,
            DestinationUserId = destination.UserId!.Value,
            Currency = t.DebtCurrency!.Value,
            Amount = t.DebtAmount!.Value
        };
}
