using Finami.Domain.Enums;
using Finami.Domain.Exceptions;
using Finami.Domain.Interfaces;
using Finami.Domain.Models;
using Finami.Domain.Validators;
using Finami.DTO.Groups;
using Finami.DTO.Invitations;
using Finami.DTO.Users;
using Finami.Infra.Interfaces.Repository;
using FluentValidation;

namespace Finami.Domain.Services;

public class GroupService : IGroupService
{
    private readonly IGroupRepository<Group> _groupRepository;
    private readonly IUserRepository<User> _userRepository;
    private readonly IAccountRepository<Account> _accountRepository;
    private readonly IGroupInvitationRepository<GroupInvitation> _invitationRepository;
    private readonly IUnitOfWork _unitOfWork;
    private readonly IValidator<GroupInsertInfo> _insertValidator;
    private readonly IValidator<GroupUpdateInfo> _updateValidator;
    private readonly IValidator<MemberLookupInfo> _lookupValidator;
    private readonly IValidator<NewMemberInfo> _newMemberValidator;

    public const string INVITATION_REQUIRED_MESSAGE = "Essa pessoa precisa ser convidada e aceitar o convite.";
    public const string EMAIL_IN_USE_MESSAGE = "Este email já está em uso.";

    public GroupService(
        IGroupRepository<Group> groupRepository,
        IUserRepository<User> userRepository,
        IAccountRepository<Account> accountRepository,
        IGroupInvitationRepository<GroupInvitation> invitationRepository,
        IUnitOfWork unitOfWork,
        IValidator<GroupInsertInfo> insertValidator,
        IValidator<GroupUpdateInfo> updateValidator,
        IValidator<MemberLookupInfo> lookupValidator,
        IValidator<NewMemberInfo> newMemberValidator)
    {
        _groupRepository = groupRepository;
        _userRepository = userRepository;
        _accountRepository = accountRepository;
        _invitationRepository = invitationRepository;
        _unitOfWork = unitOfWork;
        _insertValidator = insertValidator;
        _updateValidator = updateValidator;
        _lookupValidator = lookupValidator;
        _newMemberValidator = newMemberValidator;
    }

    public async Task<GroupInfo> CreateAsync(long userId, GroupInsertInfo info)
    {
        await _insertValidator.ValidateOrThrowAsync(info);
        var group = new Group { UserId = userId, StatementVisibility = StatementVisibility.ResponsibleOnly };
        group.Rename(info.Name);
        // FR-016: o responsável é sempre membro do próprio grupo.
        group.Members.Add(new GroupMember { UserId = userId, JoinedAt = DateTime.UtcNow });
        await _groupRepository.InsertAsync(group);
        return await ToInfoAsync(userId, group);
    }

    public async Task<List<GroupInfo>> ListMineAsync(long userId)
    {
        var groups = await _groupRepository.ListByMemberAsync(userId);
        var result = new List<GroupInfo>();
        foreach (var group in groups)
            result.Add(await ToInfoAsync(userId, group));
        return result;
    }

    public async Task<GroupInfo> GetAsync(long userId, long groupId)
    {
        var group = await LoadAsync(groupId);
        if (!group.IsMember(userId))
            throw new ForbiddenException("Você não é membro deste grupo.");
        return await ToInfoAsync(userId, group);
    }

    public async Task<GroupInfo> UpdateAsync(long userId, long groupId, GroupUpdateInfo info)
    {
        await _updateValidator.ValidateOrThrowAsync(info);
        var group = await LoadAsync(groupId);
        group.EnsureResponsible(userId);

        if (info.Name != null)
            group.Rename(info.Name);
        if (info.StatementVisibility != null)
            group.SetVisibility(Enum.Parse<StatementVisibility>(info.StatementVisibility, ignoreCase: true));

        await _groupRepository.UpdateAsync(group);
        return await ToInfoAsync(userId, group);
    }

    public async Task<GroupInfo> AddMemberAsync(long userId, long groupId, AddMemberInfo info)
    {
        var group = await LoadAsync(groupId);
        group.EnsureResponsible(userId);
        var target = await _userRepository.GetByIdAsync(info.UserId)
            ?? throw new NotFoundException("Usuário não encontrado.");
        if (group.IsMember(info.UserId))
            throw new ConflictException("O usuário já é membro do grupo.");
        // Feature 003 (research R-03): só entra direto quem foi cadastrado pelo responsável;
        // quem tem conta própria precisa aceitar um convite (FR-012).
        if (target.CreatedByUserId != userId)
            throw new BusinessRuleException(INVITATION_REQUIRED_MESSAGE);

        await _groupRepository.AddMemberAsync(groupId, info.UserId);
        return await GetAsync(userId, groupId);
    }

    public async Task<MemberLookupResult> LookupMemberAsync(long userId, long groupId, MemberLookupInfo info)
    {
        await _lookupValidator.ValidateOrThrowAsync(info);
        var group = await LoadAsync(groupId);
        group.EnsureResponsible(userId);

        var email = User.NormalizeEmail(info.Email)!;
        var result = new MemberLookupResult { Email = email, Status = nameof(MemberLookupStatus.Available) };
        var user = await _userRepository.GetByEmailAsync(email);
        if (user == null)
            return result;

        // FR-008: devolve só nome e sobrenome do dono do email.
        result.User = new UserSummaryInfo { UserId = user.UserId, FirstName = user.FirstName, LastName = user.LastName };
        if (group.IsMember(user.UserId))
        {
            result.Status = nameof(MemberLookupStatus.AlreadyMember);
            return result;
        }

        var pending = await _invitationRepository.GetPendingAsync(groupId, user.UserId);
        if (pending != null)
        {
            result.Status = nameof(MemberLookupStatus.PendingInvite);
            result.InvitationId = pending.GroupInvitationId;
            return result;
        }

        result.Status = nameof(MemberLookupStatus.Registered);
        return result;
    }

    public async Task<GroupInfo> CreateMemberAsync(long userId, long groupId, NewMemberInfo info)
    {
        await _newMemberValidator.ValidateOrThrowAsync(info);
        var group = await LoadAsync(groupId);
        group.EnsureResponsible(userId);

        var email = User.NormalizeEmail(info.Email);
        // FR-004: email único; a corrida é coberta pelo índice ix_users_email (tratado abaixo).
        if (email != null && await _userRepository.ExistsEmailAsync(email))
            throw new ConflictException(EMAIL_IN_USE_MESSAGE);

        var user = new User { CreatedByUserId = userId };
        user.UpdateName(info.FirstName, info.LastName);
        user.SetEmail(email);
        user.UpdatedAt = null;

        // research R-02: criar a pessoa e incluí-la são atômicos.
        await _unitOfWork.BeginTransactionAsync();
        try
        {
            await _userRepository.InsertAsync(user);
            await _groupRepository.AddMemberAsync(groupId, user.UserId);
            await _unitOfWork.CommitAsync();
        }
        catch (Exception ex)
        {
            await _unitOfWork.RollbackAsync();
            if (UniqueViolation.Is(ex, UniqueViolation.USERS_EMAIL_INDEX))
                throw new ConflictException(EMAIL_IN_USE_MESSAGE);
            throw;
        }

        return await GetAsync(userId, groupId);
    }

    public async Task<GroupInfo> RemoveMemberAsync(long userId, long groupId, long memberUserId)
    {
        var group = await LoadAsync(groupId);
        group.EnsureResponsible(userId);
        if (group.IsResponsible(memberUserId))
            throw new BusinessRuleException("O responsável não pode ser retirado do próprio grupo.");
        if (!group.IsMember(memberUserId))
            throw new NotFoundException("O usuário não é membro do grupo.");

        // FR-019d: as carteiras do membro vinculadas ao grupo voltam a ser pessoais.
        await _unitOfWork.BeginTransactionAsync();
        try
        {
            await _groupRepository.RemoveMemberAsync(groupId, memberUserId);
            await _accountRepository.UnlinkFromGroupAsync(groupId, memberUserId);
            await _unitOfWork.CommitAsync();
        }
        catch
        {
            await _unitOfWork.RollbackAsync();
            throw;
        }

        group.Members.RemoveAll(m => m.UserId == memberUserId);
        return await ToInfoAsync(userId, group);
    }

    private async Task<Group> LoadAsync(long groupId) =>
        await _groupRepository.GetByIdAsync(groupId) ?? throw new NotFoundException("Grupo não encontrado.");

    private async Task<GroupInfo> ToInfoAsync(long userId, Group group)
    {
        var users = (await _userRepository.GetByIdsAsync(group.Members.Select(m => m.UserId)))
            .ToDictionary(u => u.UserId);
        return new GroupInfo
        {
            GroupId = group.GroupId,
            Name = group.Name,
            ResponsibleUserId = group.UserId,
            IsResponsible = group.IsResponsible(userId),
            StatementVisibility = group.StatementVisibility.ToString(),
            CreatedAt = group.CreatedAt,
            Members = group.Members
                .OrderBy(m => m.JoinedAt)
                .Select(m =>
                {
                    users.TryGetValue(m.UserId, out var user);
                    return new GroupMemberInfo
                    {
                        UserId = m.UserId,
                        FirstName = user?.FirstName ?? string.Empty,
                        LastName = user?.LastName ?? string.Empty,
                        CanLogin = user?.CanLogin ?? false,
                        JoinedAt = m.JoinedAt
                    };
                })
                .ToList()
        };
    }
}
