namespace Finami.Infra.Interfaces.Repository;

public interface IAccountRepository<TModel> where TModel : class
{
    Task<TModel?> GetByIdAsync(long accountId);
    Task<List<TModel>> GetByIdsAsync(IEnumerable<long> accountIds);
    Task<List<TModel>> ListByOwnerAsync(long userId, bool includeInactive);
    Task<List<TModel>> ListByGroupsAsync(IEnumerable<long> groupIds, bool includeInactive);
    Task<TModel> GetSystemAccountAsync(int kind, int currency);
    Task<decimal> GetBalanceAsync(long accountId);
    Task<Dictionary<long, decimal>> GetBalancesAsync(IEnumerable<long> accountIds);
    Task<bool> HasEntriesAsync(long accountId);
    Task<TModel> InsertAsync(TModel account);
    Task<TModel> UpdateAsync(TModel account);
    Task DeleteAsync(TModel account);
    Task<int> UnlinkFromGroupAsync(long groupId, long ownerUserId);
}
