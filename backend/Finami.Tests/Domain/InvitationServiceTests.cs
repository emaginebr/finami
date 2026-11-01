using Finami.Domain.Enums;
using Finami.Domain.Exceptions;
using Finami.Domain.Models;
using Finami.Domain.Services;
using Finami.Domain.Validators;
using Finami.DTO.Invitations;
using Finami.Infra.Interfaces.Repository;
using FluentAssertions;
using Moq;

namespace Finami.Tests.Domain;

/// <summary>Cenários de "Testes esperados" de specs/003-family-member-invites/contracts/api.md (convites).</summary>
public class InvitationServiceTests
{
    private const long RESPONSIBLE = 1;   // Ana Silva, responsável pela família
    private const long MEMBER = 2;        // Bruno Silva, membro
    private const long GUEST = 3;         // Carla Lima, cadastrada, fora da família
    private const long OTHER = 4;         // Davi Souza, cadastrado, fora da família
    private const long FAMILY = 10;
    private const long OTHER_FAMILY = 20;

    private readonly Mock<IGroupInvitationRepository<GroupInvitation>> _invitations = new();
    private readonly Mock<INotificationRepository<Notification>> _notifications = new();
    private readonly Mock<IGroupRepository<Group>> _groups = new();
    private readonly Mock<IUserRepository<User>> _users = new();
    private readonly Mock<IUnitOfWork> _unitOfWork = new();

    private readonly Dictionary<long, User> _userStore = new();
    private readonly Dictionary<long, Group> _groupStore = new();
    private readonly Dictionary<long, GroupInvitation> _invitationStore = new();
    private readonly List<Notification> _notificationStore = new();
    private long _nextInvitationId = 100;
    private long _nextNotificationId = 500;

    private readonly InvitationService _service;

    public InvitationServiceTests()
    {
        AddUser(RESPONSIBLE, "Ana", "Silva", "ana@exemplo.com");
        AddUser(MEMBER, "Bruno", "Silva", "bruno@exemplo.com");
        AddUser(GUEST, "Carla", "Lima", "carla@exemplo.com");
        AddUser(OTHER, "Davi", "Souza", "davi@exemplo.com");
        _groupStore[FAMILY] = new Group
        {
            GroupId = FAMILY, Name = "Família Silva", UserId = RESPONSIBLE,
            Members = new List<GroupMember>
            {
                new() { GroupId = FAMILY, UserId = RESPONSIBLE },
                new() { GroupId = FAMILY, UserId = MEMBER }
            }
        };
        _groupStore[OTHER_FAMILY] = new Group
        {
            GroupId = OTHER_FAMILY, Name = "Família Souza", UserId = OTHER,
            Members = new List<GroupMember> { new() { GroupId = OTHER_FAMILY, UserId = OTHER } }
        };

        _users.Setup(u => u.GetByEmailAsync(It.IsAny<string>()))
            .ReturnsAsync((string email) => _userStore.Values.FirstOrDefault(u => u.Email == email));
        _users.Setup(u => u.GetByIdsAsync(It.IsAny<IEnumerable<long>>()))
            .ReturnsAsync((IEnumerable<long> ids) => ids.Distinct().Where(_userStore.ContainsKey).Select(i => _userStore[i]).ToList());

        _groups.Setup(g => g.GetByIdAsync(It.IsAny<long>())).ReturnsAsync((long id) => _groupStore.GetValueOrDefault(id));
        _groups.Setup(g => g.AddMemberAsync(It.IsAny<long>(), It.IsAny<long>()))
            .Callback((long groupId, long userId) =>
                _groupStore[groupId].Members.Add(new GroupMember { GroupId = groupId, UserId = userId }))
            .Returns(Task.CompletedTask);

        _invitations.Setup(i => i.InsertAsync(It.IsAny<GroupInvitation>()))
            .Callback<GroupInvitation>(i =>
            {
                i.GroupInvitationId = _nextInvitationId++;
                _invitationStore[i.GroupInvitationId] = i;
            })
            .ReturnsAsync((GroupInvitation i) => i);
        _invitations.Setup(i => i.UpdateAsync(It.IsAny<GroupInvitation>())).ReturnsAsync((GroupInvitation i) => i);
        _invitations.Setup(i => i.GetByIdAsync(It.IsAny<long>())).ReturnsAsync((long id) => _invitationStore.GetValueOrDefault(id));
        _invitations.Setup(i => i.GetByIdForUpdateAsync(It.IsAny<long>()))
            .ReturnsAsync((long id) => _invitationStore.GetValueOrDefault(id));
        _invitations.Setup(i => i.GetPendingAsync(It.IsAny<long>(), It.IsAny<long>()))
            .ReturnsAsync((long groupId, long userId) => _invitationStore.Values.FirstOrDefault(i =>
                i.GroupId == groupId && i.InvitedUserId == userId && i.Status == GroupInvitationStatus.Pending));
        _invitations.Setup(i => i.ListByGroupAsync(It.IsAny<long>(), It.IsAny<int>()))
            .ReturnsAsync((long groupId, int status) => _invitationStore.Values
                .Where(i => i.GroupId == groupId && (int)i.Status == status)
                .OrderByDescending(i => i.CreatedAt).ThenByDescending(i => i.GroupInvitationId)
                .ToList());

        _notifications.Setup(n => n.InsertAsync(It.IsAny<Notification>()))
            .Callback<Notification>(n =>
            {
                n.NotificationId = _nextNotificationId++;
                _notificationStore.Add(n);
            })
            .ReturnsAsync((Notification n) => n);

        _service = new InvitationService(_invitations.Object, _notifications.Object, _groups.Object, _users.Object,
            _unitOfWork.Object, new GroupInvitationInsertInfoValidator());
    }

    private void AddUser(long id, string first, string last, string email) =>
        _userStore[id] = new User { UserId = id, FirstName = first, LastName = last, Email = email };

    private Task<GroupInvitationInfo> Invite(string email = "carla@exemplo.com", long caller = RESPONSIBLE, long groupId = FAMILY) =>
        _service.InviteAsync(caller, groupId, new GroupInvitationInsertInfo { Email = email });

    // ---------------- Convidar ----------------

    [Fact]
    public async Task Invite_creates_pending_invitation_and_notifies_the_invitee()
    {
        var info = await Invite();

        info.Status.Should().Be("Pending");
        info.GroupId.Should().Be(FAMILY);
        info.GroupName.Should().Be("Família Silva");
        info.InvitedUser.UserId.Should().Be(GUEST);
        info.InvitedUser.FirstName.Should().Be("Carla");
        info.InvitedBy.UserId.Should().Be(RESPONSIBLE);
        info.RespondedAt.Should().BeNull();

        var notification = _notificationStore.Should().ContainSingle().Subject;
        notification.UserId.Should().Be(GUEST);
        notification.Type.Should().Be(NotificationType.GroupInvitationReceived);
        notification.ActorUserId.Should().Be(RESPONSIBLE);
        notification.GroupId.Should().Be(FAMILY);
        notification.GroupInvitationId.Should().Be(info.InvitationId);
        _unitOfWork.Verify(u => u.CommitAsync(), Times.Once);
        _groupStore[FAMILY].IsMember(GUEST).Should().BeFalse("só entra na família ao aceitar (FR-012)");
    }

    [Fact]
    public async Task Invite_normalizes_the_email()
    {
        var info = await Invite(" Carla@Exemplo.COM ");

        info.InvitedUser.UserId.Should().Be(GUEST);
    }

    [Fact]
    public async Task Duplicate_pending_invitation_is_a_conflict()
    {
        await Invite();

        var act = () => Invite();

        await act.Should().ThrowAsync<ConflictException>();
        _invitationStore.Should().HaveCount(1);
        _notificationStore.Should().HaveCount(1);
    }

    [Fact]
    public async Task Pending_unique_index_violation_is_a_conflict_and_rolls_back()
    {
        _invitations.Setup(i => i.InsertAsync(It.IsAny<GroupInvitation>())).ThrowsAsync(new InvalidOperationException(
            "An error occurred while saving the entity changes.",
            new Exception("23505: duplicate key value violates unique constraint \"ix_group_invitations_pending\"")));

        var act = () => Invite();

        await act.Should().ThrowAsync<ConflictException>();
        _unitOfWork.Verify(u => u.RollbackAsync(), Times.Once);
        _unitOfWork.Verify(u => u.CommitAsync(), Times.Never);
        _notificationStore.Should().BeEmpty();
    }

    [Fact]
    public async Task Inviting_a_member_is_a_conflict()
    {
        var act = () => Invite("bruno@exemplo.com");

        await act.Should().ThrowAsync<ConflictException>();
        _invitationStore.Should().BeEmpty();
    }

    [Fact]
    public async Task Inviting_unknown_email_is_not_found()
    {
        var act = () => Invite("ninguem@exemplo.com");

        (await act.Should().ThrowAsync<NotFoundException>()).WithMessage("Nenhuma pessoa com esse email.");
    }

    [Fact]
    public async Task Non_responsible_cannot_invite()
    {
        var act = () => Invite(caller: MEMBER);

        await act.Should().ThrowAsync<ForbiddenException>();
        _invitationStore.Should().BeEmpty();
    }

    [Fact]
    public async Task Inviting_to_unknown_group_is_not_found()
    {
        var act = () => Invite(groupId: 999);

        await act.Should().ThrowAsync<NotFoundException>();
    }

    [Fact]
    public async Task Invalid_email_is_rejected()
    {
        var act = () => Invite("invalido");

        await act.Should().ThrowAsync<ValidationException>();
    }

    [Fact]
    public async Task Same_person_can_have_pending_invitations_in_different_families()
    {
        await Invite();
        var other = await Invite(caller: OTHER, groupId: OTHER_FAMILY);

        other.Status.Should().Be("Pending");
        _invitationStore.Should().HaveCount(2);
    }

    // ---------------- Aceitar ----------------

    [Fact]
    public async Task Accept_makes_the_invitee_a_member_and_notifies_the_inviter()
    {
        var invitation = await Invite();

        var info = await _service.AcceptAsync(GUEST, invitation.InvitationId);

        info.Status.Should().Be("Accepted");
        info.RespondedAt.Should().NotBeNull();
        _groupStore[FAMILY].IsMember(GUEST).Should().BeTrue();
        _invitations.Verify(i => i.GetByIdForUpdateAsync(invitation.InvitationId), Times.Once);

        var notification = _notificationStore.Last();
        notification.UserId.Should().Be(RESPONSIBLE);
        notification.Type.Should().Be(NotificationType.GroupInvitationAccepted);
        notification.ActorUserId.Should().Be(GUEST);
        notification.GroupInvitationId.Should().Be(invitation.InvitationId);
        _unitOfWork.Verify(u => u.CommitAsync(), Times.Exactly(2));
    }

    [Fact]
    public async Task Accepting_twice_is_a_conflict()
    {
        var invitation = await Invite();
        await _service.AcceptAsync(GUEST, invitation.InvitationId);

        var act = () => _service.AcceptAsync(GUEST, invitation.InvitationId);

        (await act.Should().ThrowAsync<ConflictException>()).WithMessage("Este convite não está mais disponível.");
        _groups.Verify(g => g.AddMemberAsync(FAMILY, GUEST), Times.Once);
        _unitOfWork.Verify(u => u.RollbackAsync(), Times.Once);
    }

    [Fact]
    public async Task Only_the_invitee_can_accept()
    {
        var invitation = await Invite();

        var act = () => _service.AcceptAsync(OTHER, invitation.InvitationId);

        await act.Should().ThrowAsync<ForbiddenException>();
        _invitationStore[invitation.InvitationId].Status.Should().Be(GroupInvitationStatus.Pending);
        _groupStore[FAMILY].IsMember(OTHER).Should().BeFalse();
    }

    [Fact]
    public async Task Accepting_unknown_invitation_is_not_found()
    {
        var act = () => _service.AcceptAsync(GUEST, 999);

        await act.Should().ThrowAsync<NotFoundException>();
    }

    [Fact]
    public async Task Accept_after_inviter_stopped_being_responsible_cancels_the_invitation()
    {
        var invitation = await Invite();
        _groupStore[FAMILY].UserId = MEMBER; // responsabilidade passou para outra pessoa

        var act = () => _service.AcceptAsync(GUEST, invitation.InvitationId);

        (await act.Should().ThrowAsync<ConflictException>()).WithMessage("Este convite não está mais disponível.");
        var stored = _invitationStore[invitation.InvitationId];
        stored.Status.Should().Be(GroupInvitationStatus.Canceled);
        stored.RespondedAt.Should().NotBeNull();
        _invitations.Verify(i => i.UpdateAsync(stored), Times.Once);
        _unitOfWork.Verify(u => u.CommitAsync(), Times.Exactly(2), "o cancelamento é gravado antes do 409");
        _unitOfWork.Verify(u => u.RollbackAsync(), Times.Never);
        _groupStore[FAMILY].IsMember(GUEST).Should().BeFalse();
        _notificationStore.Should().ContainSingle("nenhuma notificação de aceite é gerada");
    }

    [Fact]
    public async Task Accept_when_family_no_longer_exists_cancels_the_invitation()
    {
        var invitation = await Invite();
        _groupStore.Remove(FAMILY);

        var act = () => _service.AcceptAsync(GUEST, invitation.InvitationId);

        await act.Should().ThrowAsync<ConflictException>();
        _invitationStore[invitation.InvitationId].Status.Should().Be(GroupInvitationStatus.Canceled);
    }

    [Fact]
    public async Task Canceled_invitation_cannot_be_accepted()
    {
        var invitation = await Invite();
        await _service.CancelAsync(RESPONSIBLE, FAMILY, invitation.InvitationId);

        var act = () => _service.AcceptAsync(GUEST, invitation.InvitationId);

        await act.Should().ThrowAsync<ConflictException>();
        _groupStore[FAMILY].IsMember(GUEST).Should().BeFalse();
    }

    // ---------------- Recusar ----------------

    [Fact]
    public async Task Decline_keeps_the_invitee_out_and_notifies_the_inviter()
    {
        var invitation = await Invite();

        var info = await _service.DeclineAsync(GUEST, invitation.InvitationId);

        info.Status.Should().Be("Declined");
        info.RespondedAt.Should().NotBeNull();
        _groupStore[FAMILY].IsMember(GUEST).Should().BeFalse();
        var notification = _notificationStore.Last();
        notification.UserId.Should().Be(RESPONSIBLE);
        notification.Type.Should().Be(NotificationType.GroupInvitationDeclined);
        notification.ActorUserId.Should().Be(GUEST);
    }

    [Fact]
    public async Task After_decline_the_responsible_can_invite_again()
    {
        var invitation = await Invite();
        await _service.DeclineAsync(GUEST, invitation.InvitationId);

        var again = await Invite();

        again.InvitationId.Should().NotBe(invitation.InvitationId);
        again.Status.Should().Be("Pending");
    }

    [Fact]
    public async Task Only_the_invitee_can_decline()
    {
        var invitation = await Invite();

        var act = () => _service.DeclineAsync(RESPONSIBLE, invitation.InvitationId);

        await act.Should().ThrowAsync<ForbiddenException>();
    }

    [Fact]
    public async Task Declining_an_answered_invitation_is_a_conflict()
    {
        var invitation = await Invite();
        await _service.AcceptAsync(GUEST, invitation.InvitationId);

        var act = () => _service.DeclineAsync(GUEST, invitation.InvitationId);

        await act.Should().ThrowAsync<ConflictException>();
        _invitationStore[invitation.InvitationId].Status.Should().Be(GroupInvitationStatus.Accepted);
    }

    // ---------------- Cancelar ----------------

    [Fact]
    public async Task Cancel_marks_the_invitation_as_canceled_without_new_notification()
    {
        var invitation = await Invite();

        var info = await _service.CancelAsync(RESPONSIBLE, FAMILY, invitation.InvitationId);

        info.Status.Should().Be("Canceled");
        _invitationStore[invitation.InvitationId].Status.Should().Be(GroupInvitationStatus.Canceled);
        _invitations.Verify(i => i.GetByIdForUpdateAsync(invitation.InvitationId), Times.Once);
        _notificationStore.Should().ContainSingle("só a notificação do convite recebido existe");
    }

    [Fact]
    public async Task Canceling_a_non_pending_invitation_is_a_conflict()
    {
        var invitation = await Invite();
        await _service.CancelAsync(RESPONSIBLE, FAMILY, invitation.InvitationId);

        var act = () => _service.CancelAsync(RESPONSIBLE, FAMILY, invitation.InvitationId);

        await act.Should().ThrowAsync<ConflictException>();
    }

    [Fact]
    public async Task Non_responsible_cannot_cancel()
    {
        var invitation = await Invite();

        var act = () => _service.CancelAsync(MEMBER, FAMILY, invitation.InvitationId);

        await act.Should().ThrowAsync<ForbiddenException>();
        _invitationStore[invitation.InvitationId].Status.Should().Be(GroupInvitationStatus.Pending);
    }

    [Fact]
    public async Task Canceling_an_invitation_of_another_family_is_not_found()
    {
        var invitation = await Invite(caller: OTHER, groupId: OTHER_FAMILY);

        var act = () => _service.CancelAsync(RESPONSIBLE, FAMILY, invitation.InvitationId);

        await act.Should().ThrowAsync<NotFoundException>();
        _invitationStore[invitation.InvitationId].Status.Should().Be(GroupInvitationStatus.Pending);
    }

    // ---------------- Listar pendentes ----------------

    [Fact]
    public async Task Responsible_lists_pending_invitations_newest_first()
    {
        var first = await Invite();
        _invitationStore[first.InvitationId].CreatedAt = DateTime.UtcNow.AddMinutes(-5);
        var second = await Invite("davi@exemplo.com");
        var declined = await Invite(caller: OTHER, groupId: OTHER_FAMILY);
        await _service.DeclineAsync(GUEST, declined.InvitationId);

        var list = await _service.ListByGroupAsync(RESPONSIBLE, FAMILY, null);

        list.Select(i => i.InvitationId).Should().Equal(second.InvitationId, first.InvitationId);
        list.Should().OnlyContain(i => i.Status == "Pending");
        list[0].InvitedUser.FirstName.Should().Be("Davi");
    }

    [Fact]
    public async Task List_accepts_an_explicit_status()
    {
        var invitation = await Invite();
        await _service.CancelAsync(RESPONSIBLE, FAMILY, invitation.InvitationId);

        var list = await _service.ListByGroupAsync(RESPONSIBLE, FAMILY, "canceled");

        list.Should().ContainSingle(i => i.InvitationId == invitation.InvitationId && i.Status == "Canceled");
    }

    [Fact]
    public async Task Only_the_responsible_lists_invitations()
    {
        var act = () => _service.ListByGroupAsync(MEMBER, FAMILY, null);

        await act.Should().ThrowAsync<ForbiddenException>();
    }

    [Theory]
    [InlineData("Expired")]
    [InlineData("1")]
    public async Task Invalid_status_filter_is_rejected(string status)
    {
        var act = () => _service.ListByGroupAsync(RESPONSIBLE, FAMILY, status);

        await act.Should().ThrowAsync<ValidationException>();
    }

    // ---------------- Modelo ----------------

    [Theory]
    [InlineData(GroupInvitationStatus.Accepted)]
    [InlineData(GroupInvitationStatus.Declined)]
    [InlineData(GroupInvitationStatus.Canceled)]
    public void Invitation_leaves_pending_only_once(GroupInvitationStatus finalStatus)
    {
        var invitation = new GroupInvitation { Status = finalStatus };
        var now = DateTime.UtcNow;

        invitation.Invoking(i => i.Accept(now)).Should().Throw<ConflictException>()
            .WithMessage("Este convite não está mais disponível.");
        invitation.Invoking(i => i.Decline(now)).Should().Throw<ConflictException>();
        invitation.Invoking(i => i.Cancel(now)).Should().Throw<ConflictException>();
        invitation.Status.Should().Be(finalStatus);
    }
}
