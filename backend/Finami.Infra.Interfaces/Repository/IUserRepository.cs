namespace Finami.Infra.Interfaces.Repository;

public interface IUserRepository<TModel> where TModel : class
{
    Task<TModel?> GetByIdAsync(long userId);
    Task<List<TModel>> GetByIdsAsync(IEnumerable<long> userIds);
    Task<TModel?> GetByEmailAsync(string email);
    Task<TModel?> GetByGoogleSubjectAsync(string subject);
    Task<bool> ExistsEmailAsync(string email, long? exceptUserId = null);
    Task<TModel> InsertAsync(TModel user);
    Task<TModel> UpdateAsync(TModel user);
    Task<List<TModel>> ListCreatedByAsync(long userId);
}
