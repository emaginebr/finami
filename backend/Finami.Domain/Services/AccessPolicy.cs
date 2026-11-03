using Finami.Domain.Enums;
using Finami.Domain.Exceptions;
using Finami.Domain.Interfaces;
using Finami.Domain.Models;
using Finami.Infra.Interfaces.Repository;

namespace Finami.Domain.Services;

public class AccessPolicy : IAccessPolicy
{
    private readonly IGroupRepository<Group> _groupRepository;

    public AccessPolicy(IGroupRepository<Group> groupRepository)
    {
        _groupRepository = groupRepository;
    }

    public async Task<bool> CanControlWalletAsync(long userId, Account wallet)
    {
        if (!wallet.IsWallet)
            return false;
        if (wallet.UserId == userId)
            return true;
        if (!wallet.GroupId.HasValue)
            return false;
        return await _groupRepository.GetResponsibleUserIdAsync(wallet.GroupId.Value) == userId;
    }

    public async Task EnsureCanControlWalletAsync(long userId, Account wallet)
    {
        if (!await CanControlWalletAsync(userId, wallet))
            throw new ForbiddenException("Você não tem permissão sobre esta carteira.");
    }

    public bool CanEditUserProfile(long userId, User target) =>
        target.UserId == userId || target.CreatedByUserId == userId;

    public void EnsureCanEditUserProfile(long userId, User target)
    {
        if (!CanEditUserProfile(userId, target))
            throw new ForbiddenException("Você não tem permissão para alterar este usuário.");
    }

    public async Task<bool> CanViewUserAsync(long userId, User target) =>
        CanEditUserProfile(userId, target) || await _groupRepository.ShareGroupAsync(userId, target.UserId);

    public async Task<bool> AreFamilyAsync(long ownerUserId, long otherUserId) =>
        ownerUserId == otherUserId || await _groupRepository.ShareGroupAsync(ownerUserId, otherUserId);

    public StatementAccess GroupStatementAccess(long userId, Group group)
    {
        if (group.IsResponsible(userId))
            return StatementAccess.Full;
        if (!group.IsMember(userId))
            return StatementAccess.Denied;
        return group.StatementVisibility switch
        {
            StatementVisibility.AllMembers => StatementAccess.Full,
            StatementVisibility.MembersSummary => StatementAccess.Summary,
            _ => StatementAccess.Denied
        };
    }

    public async Task<bool> CanViewWalletStatementAsync(long userId, Account wallet)
    {
        if (await CanControlWalletAsync(userId, wallet))
            return true;
        if (!wallet.IsWallet || !wallet.GroupId.HasValue)
            return false;
        var group = await _groupRepository.GetByIdAsync(wallet.GroupId.Value);
        return group != null && group.IsMember(userId) && group.StatementVisibility == StatementVisibility.AllMembers;
    }
}
