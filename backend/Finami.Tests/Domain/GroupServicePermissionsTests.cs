using Finami.Domain.Enums;
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

/// <summary>Feature 008 (T022, US2): <see cref="GroupService.SetMemberPermissionsAsync"/> e as permissões no GroupInfo.</summary>
public class GroupServicePermissionsTests
{
    private const long ANA = 1;   // responsável
    private const long BRUNO = 2; // membro
    private const long OUTSIDER = 9;
    private const long GROUP = 10;

    private readonly Mock<IGroupRepository<Group>> _groups = new();
    private readonly Mock<IUserRepository<User>> _users = new();
    private readonly Mock<IUnitOfWork> _unitOfWork = new();
    private readonly Mock<INotificationRepository<Notification>> _notifications = new();
    private readonly List<GroupMemberPermissionChange> _changes = new();
    private readonly List<Notification> _inserted = new();
    private readonly Group _group;
    private readonly GroupService _service;

    public GroupServicePermissionsTests()
    {
        _group = new Group { GroupId = GROUP, Name = "Silva", UserId = ANA };
        _group.Members.Add(new GroupMember { GroupId = GROUP, UserId = ANA });
        _group.Members.Add(new GroupMember { GroupId = GROUP, UserId = BRUNO });
        _groups.Setup(g => g.GetByIdAsync(GROUP)).ReturnsAsync(_group);
        _groups.Setup(g => g.UpdateAsync(It.IsAny<Group>())).ReturnsAsync((Group g) => g);
        _groups.Setup(g => g.InsertPermissionChangeAsync(It.IsAny<GroupMemberPermissionChange>()))
            .Callback<GroupMemberPermissionChange>(c =>
            {
                c.GroupMemberPermissionChangeId = 70 + _changes.Count;
                _changes.Add(c);
            })
            .Returns(Task.CompletedTask);
        _notifications.Setup(n => n.InsertAsync(It.IsAny<Notification>()))
            .Callback<Notification>(_inserted.Add)
            .ReturnsAsync((Notification n) => n);
        _users.Setup(u => u.GetByIdsAsync(It.IsAny<IEnumerable<long>>())).ReturnsAsync(new List<User>
        {
            new() { UserId = ANA, FirstName = "Ana", LastName = "Silva" },
            new() { UserId = BRUNO, FirstName = "Bruno", LastName = "Silva" }
        });
        _service = new GroupService(_groups.Object, _users.Object, new Mock<IAccountRepository<Account>>().Object,
            new Mock<IGroupInvitationRepository<GroupInvitation>>().Object, _unitOfWork.Object,
            new GroupInsertInfoValidator(), new GroupUpdateInfoValidator(), new MemberLookupInfoValidator(),
            new NewMemberInfoValidator(), new MemberPermissionsInfoValidator(), _notifications.Object);
    }

    private static MemberPermissionsInfo Info(bool? create, bool? reverse) =>
        new() { CanCreateTransactions = create, CanReverse = reverse };

    [Fact]
    public async Task Change_is_persisted_recorded_and_notified_in_one_transaction()
    {
        var info = await _service.SetMemberPermissionsAsync(ANA, GROUP, BRUNO, Info(false, true));

        var change = _changes.Should().ContainSingle().Subject;
        change.MemberUserId.Should().Be(BRUNO);
        change.ChangedByUserId.Should().Be(ANA);
        (change.BeforeCanCreateTransactions, change.BeforeCanReverse).Should().Be((true, false));
        (change.AfterCanCreateTransactions, change.AfterCanReverse).Should().Be((false, true));

        var notification = _inserted.Should().ContainSingle().Subject;
        notification.UserId.Should().Be(BRUNO);
        notification.Type.Should().Be(NotificationType.MemberPermissionsChanged);
        notification.PermissionChangeId.Should().Be(change.GroupMemberPermissionChangeId);
        notification.ActorUserId.Should().Be(ANA);
        notification.GroupId.Should().Be(GROUP);

        _groups.Verify(g => g.UpdateAsync(_group), Times.Once);
        _unitOfWork.Verify(u => u.BeginTransactionAsync(), Times.Once);
        _unitOfWork.Verify(u => u.CommitAsync(), Times.Once);

        var bruno = info.Members.Single(m => m.UserId == BRUNO);
        (bruno.CanCreateTransactions, bruno.CanReverse).Should().Be((false, true));
    }

    [Fact]
    public async Task Same_permissions_write_nothing()
    {
        var info = await _service.SetMemberPermissionsAsync(ANA, GROUP, BRUNO, Info(true, false));

        info.GroupId.Should().Be(GROUP);
        _changes.Should().BeEmpty();
        _inserted.Should().BeEmpty();
        _groups.Verify(g => g.UpdateAsync(It.IsAny<Group>()), Times.Never);
        _unitOfWork.Verify(u => u.BeginTransactionAsync(), Times.Never);
    }

    [Fact]
    public async Task Failure_rolls_back()
    {
        _notifications.Setup(n => n.InsertAsync(It.IsAny<Notification>())).ThrowsAsync(new InvalidOperationException("db"));

        var act = () => _service.SetMemberPermissionsAsync(ANA, GROUP, BRUNO, Info(false, false));

        await act.Should().ThrowAsync<InvalidOperationException>();
        _unitOfWork.Verify(u => u.RollbackAsync(), Times.Once);
        _unitOfWork.Verify(u => u.CommitAsync(), Times.Never);
    }

    [Theory]
    [InlineData(null, true)]
    [InlineData(true, null)]
    [InlineData(null, null)]
    public async Task Missing_permission_is_a_validation_error(bool? create, bool? reverse)
    {
        var act = () => _service.SetMemberPermissionsAsync(ANA, GROUP, BRUNO, Info(create, reverse));

        var error = await act.Should().ThrowAsync<ValidationException>().WithMessage("Informe as duas permissões.");
        error.Which.Errors.Should().Equal("Informe as duas permissões.");
    }

    [Fact]
    public async Task Member_is_forbidden()
    {
        var act = () => _service.SetMemberPermissionsAsync(BRUNO, GROUP, BRUNO, Info(true, true));

        await act.Should().ThrowAsync<ForbiddenException>()
            .WithMessage("Apenas o responsável pelo grupo pode realizar esta operação.");
        _changes.Should().BeEmpty();
    }

    [Fact]
    public async Task Unknown_member_and_unknown_group_are_not_found()
    {
        var member = () => _service.SetMemberPermissionsAsync(ANA, GROUP, OUTSIDER, Info(true, true));
        var group = () => _service.SetMemberPermissionsAsync(ANA, 999, BRUNO, Info(true, true));

        await member.Should().ThrowAsync<NotFoundException>().WithMessage("Membro não encontrado.");
        await group.Should().ThrowAsync<NotFoundException>().WithMessage("Grupo não encontrado.");
    }

    [Fact]
    public async Task Responsible_permissions_cannot_be_changed()
    {
        var act = () => _service.SetMemberPermissionsAsync(ANA, GROUP, ANA, Info(false, false));

        await act.Should().ThrowAsync<BusinessRuleException>()
            .WithMessage("As permissões do responsável não podem ser alteradas.");
    }

    [Fact]
    public async Task Group_info_has_member_permissions_and_my_permissions()
    {
        _group.FindMember(BRUNO)!.CanReverse = true;
        _group.FindMember(ANA)!.CanReverse = false; // ignorado: o responsável tem tudo

        var asAna = await _service.GetAsync(ANA, GROUP);
        var asBruno = await _service.GetAsync(BRUNO, GROUP);

        var ana = asAna.Members.Single(m => m.UserId == ANA);
        (ana.CanCreateTransactions, ana.CanReverse).Should().Be((true, true));
        var bruno = asAna.Members.Single(m => m.UserId == BRUNO);
        (bruno.CanCreateTransactions, bruno.CanReverse).Should().Be((true, true));
        (asAna.MyPermissions.CanCreateTransactions, asAna.MyPermissions.CanReverse).Should().Be((true, true));

        _group.FindMember(BRUNO)!.CanCreateTransactions = false;
        asBruno = await _service.GetAsync(BRUNO, GROUP);
        (asBruno.MyPermissions.CanCreateTransactions, asBruno.MyPermissions.CanReverse).Should().Be((false, true));
    }
}
