using Finami.Domain.Enums;
using Finami.Domain.Exceptions;
using Finami.Domain.Interfaces;
using Finami.Domain.Models;
using Finami.Infra.Interfaces.Repository;

namespace Finami.Domain.Services;

public class AccessPolicy : IAccessPolicy
{
    private readonly IGroupRepository<Group> _groupRepository;

    /// <summary>Grupos já lidos nesta requisição (o serviço é scoped), para não repetir a leitura (sem N+1).</summary>
    private readonly Dictionary<long, Group?> _groupCache = new();

    public const string TRANSACTION_FORBIDDEN_MESSAGE = "Você não tem permissão sobre esta transação.";

    public static string CreateForbiddenMessage(string groupName) =>
        $"Você não tem permissão para criar lançamentos na família {groupName}.";

    public static string ReverseForbiddenMessage(string groupName) =>
        $"Você não tem permissão para estornar lançamentos na família {groupName}.";

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
        var group = await GetGroupAsync(wallet.GroupId.Value);
        return group != null && group.IsMember(userId) && group.StatementVisibility == StatementVisibility.AllMembers;
    }

    private async Task<Group?> GetGroupAsync(long groupId)
    {
        if (!_groupCache.TryGetValue(groupId, out var group))
        {
            group = await _groupRepository.GetByIdAsync(groupId);
            _groupCache[groupId] = group;
        }
        return group;
    }

    public async Task<bool> CanCreateTransactionsAsync(long userId, Account wallet)
    {
        if (!await CanControlWalletAsync(userId, wallet))
            return false;
        if (!wallet.GroupId.HasValue)
            return true;
        var group = await GetGroupAsync(wallet.GroupId.Value);
        return group != null && group.CanCreateTransactions(userId);
    }

    public async Task EnsureCanCreateTransactionsAsync(long userId, Account wallet)
    {
        await EnsureCanControlWalletAsync(userId, wallet);
        if (!wallet.GroupId.HasValue)
            return;
        var group = await GetGroupAsync(wallet.GroupId.Value);
        if (group == null)
            throw new ForbiddenException("Você não tem permissão sobre esta carteira.");
        if (!group.CanCreateTransactions(userId))
            throw new ForbiddenException(CreateForbiddenMessage(group.Name));
    }

    public async Task<bool> CanViewTransactionAsync(long userId, IEnumerable<Account> accounts)
    {
        foreach (var account in accounts)
        {
            if (await CanViewWalletStatementAsync(userId, account))
                return true;
        }
        return false;
    }

    public async Task<bool> CanReverseAsync(long userId, Transaction transaction, IEnumerable<Account> accounts,
        bool alreadyReversed)
    {
        if (transaction.Type == TransactionType.Reversal || alreadyReversed)
            return false;
        return await HasReversePermissionAsync(userId, accounts);
    }

    public async Task EnsureCanReverseAsync(long userId, IEnumerable<Account> accounts)
    {
        var list = accounts.ToList();
        if (await HasReversePermissionAsync(userId, list))
            return;
        var familyWallet = list.FirstOrDefault(a => a.IsWallet && a.GroupId.HasValue);
        var group = familyWallet == null ? null : await GetGroupAsync(familyWallet.GroupId!.Value);
        throw new ForbiddenException(group == null ? TRANSACTION_FORBIDDEN_MESSAGE : ReverseForbiddenMessage(group.Name));
    }

    private async Task<bool> HasReversePermissionAsync(long userId, IEnumerable<Account> accounts)
    {
        foreach (var wallet in accounts.Where(a => a.IsWallet))
        {
            if (!wallet.GroupId.HasValue)
            {
                // Carteira pessoal: o titular estorna, como antes (a feature não muda as carteiras pessoais).
                if (await CanControlWalletAsync(userId, wallet))
                    return true;
                continue;
            }

            var group = await GetGroupAsync(wallet.GroupId.Value);
            if (group == null)
                continue;
            if (group.IsResponsible(userId))
                return true;
            // R-05: o membro com "Pode estornar" só estorna o que pode ver.
            if (group.CanReverse(userId) && await CanViewWalletStatementAsync(userId, wallet))
                return true;
        }
        return false;
    }
}
