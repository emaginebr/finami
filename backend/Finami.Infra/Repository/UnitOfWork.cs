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
}
