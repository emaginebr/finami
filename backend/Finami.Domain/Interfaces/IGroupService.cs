using Finami.DTO.Groups;

namespace Finami.Domain.Interfaces;

public interface IGroupService
{
    Task<GroupInfo> CreateAsync(long userId, GroupInsertInfo info);
    Task<List<GroupInfo>> ListMineAsync(long userId);
    Task<GroupInfo> GetAsync(long userId, long groupId);
    Task<GroupInfo> UpdateAsync(long userId, long groupId, GroupUpdateInfo info);
    Task<GroupInfo> AddMemberAsync(long userId, long groupId, AddMemberInfo info);
    Task<GroupInfo> RemoveMemberAsync(long userId, long groupId, long memberUserId);
}
