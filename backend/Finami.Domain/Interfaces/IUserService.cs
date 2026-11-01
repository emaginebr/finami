using Finami.DTO.Users;

namespace Finami.Domain.Interfaces;

public interface IUserService
{
    Task<UserInfo> CreateAsync(long userId, UserInsertInfo info);
    Task<UserInfo> GetAsync(long userId, long targetUserId);
    Task<UserInfo> UpdateAsync(long userId, long targetUserId, UserUpdateInfo info);
    Task ChangePasswordAsync(long userId, long targetUserId, PasswordUpdateInfo info);
    Task<List<UserInfo>> ListCreatedByMeAsync(long userId);
    Task<UserSummaryInfo> SearchByEmailAsync(string email);
}
