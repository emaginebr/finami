using System.Data;
using Finami.Infra.Context;
using Finami.Infra.Interfaces.Repository;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Storage;

namespace Finami.Infra.Repository;

public class UnitOfWork : IUnitOfWork
{
    private readonly FinamiContext _context;
    private IDbContextTransaction? _transaction;

    public UnitOfWork(FinamiContext context)
    {
        _context = context;
    }

    public async Task BeginTransactionAsync()
    {
        if (_transaction != null)
            throw new InvalidOperationException("Já existe uma transação aberta.");
        _transaction = await _context.Database.BeginTransactionAsync(IsolationLevel.ReadCommitted);
    }

    public async Task CommitAsync()
    {
        if (_transaction == null) return;
        await _transaction.CommitAsync();
        await _transaction.DisposeAsync();
        _transaction = null;
    }

    public async Task RollbackAsync()
    {
        if (_transaction == null) return;
        await _transaction.RollbackAsync();
        await _transaction.DisposeAsync();
        _transaction = null;
        _context.ChangeTracker.Clear();
    }

    public async Task LockAccountsAsync(IEnumerable<long> accountIds)
    {
        var ids = accountIds.Distinct().OrderBy(id => id).ToArray();
        if (ids.Length == 0) return;
        await _context.Database.ExecuteSqlInterpolatedAsync(
            $"SELECT account_id FROM accounts WHERE account_id = ANY({ids}) ORDER BY account_id FOR UPDATE");
    }

    /// <summary>
    /// Feature 007 (R-03): <c>pg_advisory_xact_lock</c> com a chave <c>(min &lt;&lt; 32) | max</c> dos dois ids,
    /// solto no commit/rollback. Supõe ids de pessoa em 32 bits (escala da app); ids maiores precisariam de
    /// <c>hashtextextended</c> para montar a chave.
    /// </summary>
    public async Task LockDebtPairAsync(long userA, long userB)
    {
        var key = DebtPairLockKey(userA, userB);
        await _context.Database.ExecuteSqlInterpolatedAsync($"SELECT pg_advisory_xact_lock({key})");
    }

    public static long DebtPairLockKey(long userA, long userB)
    {
        var low = Math.Min(userA, userB);
        var high = Math.Max(userA, userB);
        return (low << 32) | (high & 0xFFFFFFFFL);
    }
}
