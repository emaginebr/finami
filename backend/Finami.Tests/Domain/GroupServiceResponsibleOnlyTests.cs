using Finami.Domain.Exceptions;
using Finami.Domain.Models;
using Finami.Domain.Services;
using Finami.Domain.Validators;
using Finami.DTO.Groups;
using Finami.DTO.Invitations;
using Finami.Infra.Interfaces.Repository;
using FluentAssertions;
using Moq;

namespace Finami.Tests.Domain;

/// <summary>Feature 008 (T039, US4): só o responsável gerencia membros e permissões.</summary>
public class GroupServiceResponsibleOnlyTests
{
    private const long ANA = 1;
    private const long BRUNO = 2;
    private const long CAIO = 3;
    private const long GROUP = 10;
    private const string MESSAGE = "Apenas o responsável pelo grupo pode realizar esta operação.";

    private readonly Mock<IGroupRepository<Group>> _groups = new();
    private readonly Mock<IUserRepository<User>> _users = new();
    private readonly Mock<IAccountRepository<Account>> _accounts = new();
    private readonly Mock<IGroupInvitationRepository<GroupInvitation>> _invitations = new();
    private readonly Mock<INotificationRepository<Notification>> _notifications = new();
    private readonly Mock<IUnitOfWork> _unitOfWork = new();
    private readonly GroupService _service;
    private readonly InvitationService _invitationService;

    public GroupServiceResponsibleOnlyTests()
    {
        var group = new Group { GroupId = GROUP, Name = "Silva", UserId = ANA };
        group.Members.Add(new GroupMember { GroupId = GROUP, UserId = ANA });
        group.Members.Add(new GroupMember { GroupId = GROUP, UserId = BRUNO, CanCreateTransactions = true, CanReverse = true });
        group.Members.Add(new GroupMember { GroupId = GROUP, UserId = CAIO });
        _groups.Setup(g => g.GetByIdAsync(GROUP)).ReturnsAsync(group);
        _users.Setup(u => u.GetByIdAsync(It.IsAny<long>()))
            .ReturnsAsync((long id) => new User { UserId = id, FirstName = "U", LastName = "U", CreatedByUserId = BRUNO });

        _service = new GroupService(_groups.Object, _users.Object, _accounts.Object, _invitations.Object,
            _unitOfWork.Object, new GroupInsertInfoValidator(), new GroupUpdateInfoValidator(),
            new MemberLookupInfoValidator(), new NewMemberInfoValidator(), new MemberPermissionsInfoValidator(),
            _notifications.Object);
        _invitationService = new InvitationService(_invitations.Object, _notifications.Object, _groups.Object,
            _users.Object, _unitOfWork.Object, new GroupInvitationInsertInfoValidator());
    }

    [Fact]
    public async Task Member_with_every_permission_still_cannot_manage_members()
    {
        var actions = new Func<Task>[]
        {
            () => _service.AddMemberAsync(BRUNO, GROUP, new AddMemberInfo { UserId = 50 }),
            () => _service.CreateMemberAsync(BRUNO, GROUP, new NewMemberInfo { FirstName = "Pedro", LastName = "Silva" }),
            () => _service.RemoveMemberAsync(BRUNO, GROUP, CAIO),
            () => _invitationService.InviteAsync(BRUNO, GROUP, new GroupInvitationInsertInfo { Email = "x@exemplo.com" }),
            () => _service.SetMemberPermissionsAsync(BRUNO, GROUP, CAIO,
                new MemberPermissionsInfo { CanCreateTransactions = false, CanReverse = false })
        };

        foreach (var action in actions)
            await action.Should().ThrowAsync<ForbiddenException>().WithMessage(MESSAGE);

        _groups.Verify(g => g.AddMemberAsync(It.IsAny<long>(), It.IsAny<long>()), Times.Never);
        _groups.Verify(g => g.RemoveMemberAsync(It.IsAny<long>(), It.IsAny<long>()), Times.Never);
        _groups.Verify(g => g.InsertPermissionChangeAsync(It.IsAny<GroupMemberPermissionChange>()), Times.Never);
        _users.Verify(u => u.InsertAsync(It.IsAny<User>()), Times.Never);
        _invitations.Verify(i => i.InsertAsync(It.IsAny<GroupInvitation>()), Times.Never);
        _notifications.Verify(n => n.InsertAsync(It.IsAny<Notification>()), Times.Never);
    }
}
