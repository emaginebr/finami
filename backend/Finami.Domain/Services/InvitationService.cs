using Finami.Domain.Enums;
using Finami.Domain.Exceptions;
using Finami.Domain.Interfaces;
using Finami.Domain.Models;
using Finami.Domain.Validators;
using Finami.DTO.Invitations;
using Finami.DTO.Users;
using Finami.Infra.Interfaces.Repository;
using FluentValidation;
using ValidationException = Finami.Domain.Exceptions.ValidationException;

namespace Finami.Domain.Services;

/// <summary>
/// Convites para a família (research R-04). Aceitar, recusar e cancelar rodam em transação com a
/// linha do convite bloqueada (SELECT ... FOR UPDATE); as notificações são gravadas na mesma transação.
/// </summary>
public class InvitationService : IInvitationService
{
    public const string ALREADY_MEMBER_MESSAGE = "Essa pessoa já é membro desta família.";
    public const string PENDING_EXISTS_MESSAGE = "Já existe um convite pendente para essa pessoa nesta família.";
    public const string UNKNOWN_EMAIL_MESSAGE = "Nenhuma pessoa com esse email.";

    private readonly IGroupInvitationRepository<GroupInvitation> _invitationRepository;
    private readonly INotificationRepository<Notification> _notificationRepository;
    private readonly IGroupRepository<Group> _groupRepository;
    private readonly IUserRepository<User> _userRepository;
    private readonly IUnitOfWork _unitOfWork;
    private readonly IValidator<GroupInvitationInsertInfo> _insertValidator;

    public InvitationService(
        IGroupInvitationRepository<GroupInvitation> invitationRepository,
        INotificationRepository<Notification> notificationRepository,
        IGroupRepository<Group> groupRepository,
        IUserRepository<User> userRepository,
        IUnitOfWork unitOfWork,
        IValidator<GroupInvitationInsertInfo> insertValidator)
    {
        _invitationRepository = invitationRepository;
        _notificationRepository = notificationRepository;
        _groupRepository = groupRepository;
        _userRepository = userRepository;
        _unitOfWork = unitOfWork;
        _insertValidator = insertValidator;
    }

    public async Task<GroupInvitationInfo> InviteAsync(long userId, long groupId, GroupInvitationInsertInfo info)
    {
        await _insertValidator.ValidateOrThrowAsync(info);
        var group = await LoadGroupAsync(groupId);
        group.EnsureResponsible(userId);

        var invitee = await _userRepository.GetByEmailAsync(User.NormalizeEmail(info.Email)!)
            ?? throw new NotFoundException(UNKNOWN_EMAIL_MESSAGE);
        if (group.IsMember(invitee.UserId))
            throw new ConflictException(ALREADY_MEMBER_MESSAGE);
        if (await _invitationRepository.GetPendingAsync(groupId, invitee.UserId) != null)
            throw new ConflictException(PENDING_EXISTS_MESSAGE);

        var now = DateTime.UtcNow;
        var invitation = new GroupInvitation
        {
            GroupId = groupId,
            InvitedUserId = invitee.UserId,
            InvitedByUserId = userId,
            Status = GroupInvitationStatus.Pending,
            CreatedAt = now
        };

        await _unitOfWork.BeginTransactionAsync();
        try
        {
            await _invitationRepository.InsertAsync(invitation);
            await _notificationRepository.InsertAsync(new Notification
            {
                UserId = invitee.UserId,
                Type = NotificationType.GroupInvitationReceived,
                GroupId = groupId,
                GroupInvitationId = invitation.GroupInvitationId,
                ActorUserId = userId,
                CreatedAt = now
            });
            await _unitOfWork.CommitAsync();
        }
        catch (Exception ex)
        {
            await _unitOfWork.RollbackAsync();
            // FR-010 em corrida (duplo toque): o índice único parcial barra o segundo convite.
            if (UniqueViolation.Is(ex, UniqueViolation.GROUP_INVITATIONS_PENDING_INDEX))
                throw new ConflictException(PENDING_EXISTS_MESSAGE);
            throw;
        }

        return await ToInfoAsync(invitation, group.Name);
    }

    public async Task<List<GroupInvitationInfo>> ListByGroupAsync(long userId, long groupId, string? status)
    {
        var group = await LoadGroupAsync(groupId);
        group.EnsureResponsible(userId);
        var filter = ParseStatus(status);

        var invitations = await _invitationRepository.ListByGroupAsync(groupId, (int)filter);
        var users = await LoadUsersAsync(invitations.SelectMany(i => new[] { i.InvitedUserId, i.InvitedByUserId }));
        return invitations.Select(i => ToInfo(i, group.Name, users)).ToList();
    }

    public async Task<GroupInvitationInfo> CancelAsync(long userId, long groupId, long invitationId)
    {
        var group = await LoadGroupAsync(groupId);
        group.EnsureResponsible(userId);

        GroupInvitation invitation;
        await _unitOfWork.BeginTransactionAsync();
        try
        {
            invitation = await _invitationRepository.GetByIdForUpdateAsync(invitationId)
                ?? throw new NotFoundException("Convite não encontrado.");
            if (invitation.GroupId != groupId)
                throw new NotFoundException("Convite não encontrado.");
            invitation.Cancel(DateTime.UtcNow);
            await _invitationRepository.UpdateAsync(invitation);
            await _unitOfWork.CommitAsync();
        }
        catch
        {
            await _unitOfWork.RollbackAsync();
            throw;
        }

        return await ToInfoAsync(invitation, group.Name);
    }

    public Task<GroupInvitationInfo> AcceptAsync(long userId, long invitationId) =>
        RespondAsync(userId, invitationId, accept: true);

    public Task<GroupInvitationInfo> DeclineAsync(long userId, long invitationId) =>
        RespondAsync(userId, invitationId, accept: false);

    /// <summary>
    /// Aceite/recusa pelo convidado. Se a família não existe mais ou quem convidou deixou de ser o
    /// responsável (FR-016), o convite é gravado como Canceled e a resposta é 409.
    /// </summary>
    private async Task<GroupInvitationInfo> RespondAsync(long userId, long invitationId, bool accept)
    {
        GroupInvitation invitation;
        Group? group;
        var unavailable = false;

        await _unitOfWork.BeginTransactionAsync();
        try
        {
            invitation = await _invitationRepository.GetByIdForUpdateAsync(invitationId)
                ?? throw new NotFoundException("Convite não encontrado.");
            if (invitation.InvitedUserId != userId)
                throw new ForbiddenException("Somente a pessoa convidada pode responder a este convite.");
            if (!invitation.IsPending)
                throw new ConflictException(GroupInvitation.UNAVAILABLE_MESSAGE);

            var now = DateTime.UtcNow;
            group = await _groupRepository.GetByIdAsync(invitation.GroupId);
            if (group == null || !group.IsResponsible(invitation.InvitedByUserId))
            {
                invitation.Cancel(now);
                await _invitationRepository.UpdateAsync(invitation);
                unavailable = true;
            }
            else
            {
                if (accept)
                {
                    invitation.Accept(now);
                    await _invitationRepository.UpdateAsync(invitation);
                    if (!group.IsMember(userId))
                        await _groupRepository.AddMemberAsync(group.GroupId, userId);
                }
                else
                {
                    invitation.Decline(now);
                    await _invitationRepository.UpdateAsync(invitation);
                }

                await _notificationRepository.InsertAsync(new Notification
                {
                    UserId = invitation.InvitedByUserId,
                    Type = accept ? NotificationType.GroupInvitationAccepted : NotificationType.GroupInvitationDeclined,
                    GroupId = group.GroupId,
                    GroupInvitationId = invitation.GroupInvitationId,
                    ActorUserId = userId,
                    CreatedAt = now
                });
            }

            await _unitOfWork.CommitAsync();
        }
        catch
        {
            await _unitOfWork.RollbackAsync();
            throw;
        }

        if (unavailable)
            throw new ConflictException(GroupInvitation.UNAVAILABLE_MESSAGE);
        return await ToInfoAsync(invitation, group!.Name);
    }

    private static GroupInvitationStatus ParseStatus(string? status)
    {
        if (string.IsNullOrWhiteSpace(status))
            return GroupInvitationStatus.Pending;
        // Só nomes (não números), sem diferenciar maiúsculas.
        var name = Enum.GetNames<GroupInvitationStatus>()
            .FirstOrDefault(n => string.Equals(n, status.Trim(), StringComparison.OrdinalIgnoreCase));
        if (name == null)
            throw new ValidationException("Status inválido. Use Pending, Accepted, Declined ou Canceled.");
        return Enum.Parse<GroupInvitationStatus>(name);
    }

    private async Task<Group> LoadGroupAsync(long groupId) =>
        await _groupRepository.GetByIdAsync(groupId) ?? throw new NotFoundException("Grupo não encontrado.");

    private async Task<Dictionary<long, User>> LoadUsersAsync(IEnumerable<long> userIds) =>
        (await _userRepository.GetByIdsAsync(userIds.Distinct())).ToDictionary(u => u.UserId);

    private async Task<GroupInvitationInfo> ToInfoAsync(GroupInvitation invitation, string groupName)
    {
        var users = await LoadUsersAsync(new[] { invitation.InvitedUserId, invitation.InvitedByUserId });
        return ToInfo(invitation, groupName, users);
    }

    private static GroupInvitationInfo ToInfo(GroupInvitation invitation, string groupName, Dictionary<long, User> users) => new()
    {
        InvitationId = invitation.GroupInvitationId,
        GroupId = invitation.GroupId,
        GroupName = groupName,
        InvitedUser = Summary(invitation.InvitedUserId, users),
        InvitedBy = Summary(invitation.InvitedByUserId, users),
        Status = invitation.Status.ToString(),
        CreatedAt = invitation.CreatedAt,
        RespondedAt = invitation.RespondedAt
    };

    private static UserSummaryInfo Summary(long userId, Dictionary<long, User> users)
    {
        users.TryGetValue(userId, out var user);
        return new UserSummaryInfo
        {
            UserId = userId,
            FirstName = user?.FirstName ?? string.Empty,
            LastName = user?.LastName ?? string.Empty
        };
    }
}
