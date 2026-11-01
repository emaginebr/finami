using Finami.Domain.Enums;
using Finami.Domain.Models;
using Finami.Infra.Context;
using Finami.Infra.Interfaces.Repository;
using Microsoft.EntityFrameworkCore;

namespace Finami.Infra.Repository;

public class AccountRepository : IAccountRepository<Account>
{
    private readonly FinamiContext _context;

    public AccountRepository(FinamiContext context)
    {
        _context = context;
    }

    public Task<Account?> GetByIdAsync(long accountId) =>
        _context.Accounts.FirstOrDefaultAsync(a => a.AccountId == accountId);

    public Task<List<Account>> GetByIdsAsync(IEnumerable<long> accountIds)
    {
        var ids = accountIds.Distinct().ToList();
        return _context.Accounts.AsNoTracking().Where(a => ids.Contains(a.AccountId)).ToListAsync();
    }

    public Task<List<Account>> ListByOwnerAsync(long userId, bool includeInactive) =>
        _context.Accounts.AsNoTracking()
            .Where(a => a.Kind == AccountKind.Wallet && a.UserId == userId && (includeInactive || a.IsActive))
            .OrderBy(a => a.Name)
            .ToListAsync();

    public Task<List<Account>> ListByGroupsAsync(IEnumerable<long> groupIds, bool includeInactive)
    {
        var ids = groupIds.Distinct().ToList();
        return _context.Accounts.AsNoTracking()
            .Where(a => a.Kind == AccountKind.Wallet && a.GroupId != null && ids.Contains(a.GroupId.Value)
                        && (includeInactive || a.IsActive))
            .OrderBy(a => a.Name)
            .ToListAsync();
    }

    public async Task<Account> GetSystemAccountAsync(int kind, int currency)
    {
        var accountKind = (AccountKind)kind;
        var accountCurrency = (Currency)currency;
        return await _context.Accounts.FirstOrDefaultAsync(a => a.Kind == accountKind && a.Currency == accountCurrency)
            ?? throw new InvalidOperationException($"Conta de sistema {accountKind}/{accountCurrency} não encontrada.");
    }

    public async Task<decimal> GetBalanceAsync(long accountId) =>
        await _context.LedgerEntries.Where(e => e.AccountId == accountId).SumAsync(e => (decimal?)e.Amount) ?? 0m;

    public async Task<Dictionary<long, decimal>> GetBalancesAsync(IEnumerable<long> accountIds)
    {
        var ids = accountIds.Distinct().ToList();
        var sums = await _context.LedgerEntries
            .Where(e => ids.Contains(e.AccountId))
            .GroupBy(e => e.AccountId)
            .Select(g => new { AccountId = g.Key, Balance = g.Sum(e => e.Amount) })
            .ToListAsync();
        var result = ids.ToDictionary(id => id, _ => 0m);
        foreach (var sum in sums) result[sum.AccountId] = sum.Balance;
        return result;
    }

    public Task<bool> HasEntriesAsync(long accountId) =>
        _context.LedgerEntries.AnyAsync(e => e.AccountId == accountId);

    public async Task<Account> InsertAsync(Account account)
    {
        _context.Accounts.Add(account);
        await _context.SaveChangesAsync();
        return account;
    }

    public async Task<Account> UpdateAsync(Account account)
    {
        if (_context.Entry(account).State == EntityState.Detached)
            _context.Accounts.Update(account);
        await _context.SaveChangesAsync();
        return account;
    }

    public async Task DeleteAsync(Account account)
    {
        _context.Accounts.Remove(account);
        await _context.SaveChangesAsync();
    }

    public Task<int> UnlinkFromGroupAsync(long groupId, long ownerUserId) =>
        _context.Accounts
            .Where(a => a.GroupId == groupId && a.UserId == ownerUserId)
            .ExecuteUpdateAsync(s => s.SetProperty(a => a.GroupId, (long?)null));
}
