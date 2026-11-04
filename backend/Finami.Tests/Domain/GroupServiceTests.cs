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

public class GroupServiceTests
{
    private const long RESPONSIBLE = 1;
    private const long MEMBER = 2;
    private const long NEWCOMER = 3;
    private const long NEW_USER = 50;

    private readonly Mock<IGroupRepository<Group>> _groups = new();
    private readonly Mock<IUserRepository<User>> _users = new();
    private readonly Mock<IAccountRepository<Account>> _accounts = new();
    private readonly Mock<IUnitOfWork> _unitOfWork = new();
    private readonly Mock<IGroupInvitationRepository<GroupInvitation>> _invitations = new();
    private readonly Group _group;
    private readonly GroupService _service;

    public GroupServiceTests()
    {
        _group = new Group
        {
            GroupId = 10, Name = "Família", UserId = RESPONSIBLE,
            Members = new List<GroupMember>
            {
                new() { GroupId = 10, UserId = RESPONSIBLE },
                new() { GroupId = 10, UserId = MEMBER }
            }
        };
        _groups.Setup(g => g.GetByIdAsync(10)).ReturnsAsync(_group);
        _groups.Setup(g => g.InsertAsync(It.IsAny<Group>())).ReturnsAsync((Group g) => g);
        _users.Setup(u => u.GetByIdsAsync(It.IsAny<IEnumerable<long>>())).ReturnsAsync(new List<User>());
        _users.Setup(u => u.GetByIdAsync(It.IsAny<long>()))
            .ReturnsAsync((long id) => new User { UserId = id, FirstName = "U", LastName = "U" });
        _users.Setup(u => u.InsertAsync(It.IsAny<User>()))
            .Callback<User>(u => u.UserId = NEW_USER).ReturnsAsync((User u) => u);
        _service = new GroupService(_groups.Object, _users.Object, _accounts.Object, _invitations.Object,
            _unitOfWork.Object, new GroupInsertInfoValidator(), new GroupUpdateInfoValidator(),
            new MemberLookupInfoValidator(), new NewMemberInfoValidator(), new MemberPermissionsInfoValidator(),
            new Mock<INotificationRepository<Notification>>().Object);
    }

    [Fact]
    public async Task Creator_becomes_responsible_and_member()
    {
        Group? saved = null;
        _groups.Setup(g => g.InsertAsync(It.IsAny<Group>())).Callback<Group>(g => saved = g).ReturnsAsync((Group g) => g);

        var info = await _service.CreateAsync(RESPONSIBLE, new GroupInsertInfo { Name = "Família Silva" });

        saved!.UserId.Should().Be(RESPONSIBLE);
        saved.Members.Should().ContainSingle(m => m.UserId == RESPONSIBLE);
        info.IsResponsible.Should().BeTrue();
        info.StatementVisibility.Should().Be("ResponsibleOnly");
    }

    [Fact]
    public async Task Non_responsible_cannot_add_members()
    {
        var act = () => _service.AddMemberAsync(MEMBER, 10, new AddMemberInfo { UserId = NEWCOMER });

        await act.Should().ThrowAsync<ForbiddenException>();
        _groups.Verify(g => g.AddMemberAsync(It.IsAny<long>(), It.IsAny<long>()), Times.Never);
    }

    [Fact]
    public async Task Adding_existing_member_is_a_conflict()
    {
        var act = () => _service.AddMemberAsync(RESPONSIBLE, 10, new AddMemberInfo { UserId = MEMBER });

        await act.Should().ThrowAsync<ConflictException>();
    }

    [Fact]
    public async Task Responsible_cannot_be_removed()
    {
        var act = () => _service.RemoveMemberAsync(RESPONSIBLE, 10, RESPONSIBLE);

        await act.Should().ThrowAsync<BusinessRuleException>();
    }

    [Fact]
    public async Task Removing_member_unlinks_their_wallets_in_a_transaction()
    {
        var info = await _service.RemoveMemberAsync(RESPONSIBLE, 10, MEMBER);

        _groups.Verify(g => g.RemoveMemberAsync(10, MEMBER), Times.Once);
        _accounts.Verify(a => a.UnlinkFromGroupAsync(10, MEMBER), Times.Once);
        _unitOfWork.Verify(u => u.CommitAsync(), Times.Once);
        info.Members.Should().NotContain(m => m.UserId == MEMBER);
    }

    [Fact]
    public async Task Non_responsible_cannot_change_visibility()
    {
        var act = () => _service.UpdateAsync(MEMBER, 10, new GroupUpdateInfo { StatementVisibility = "AllMembers" });

        await act.Should().ThrowAsync<ForbiddenException>();
    }

    [Fact]
    public async Task Responsible_changes_visibility()
    {
        var info = await _service.UpdateAsync(RESPONSIBLE, 10, new GroupUpdateInfo { StatementVisibility = "MembersSummary" });

        _group.StatementVisibility.Should().Be(StatementVisibility.MembersSummary);
        info.StatementVisibility.Should().Be("MembersSummary");
    }

    [Fact]
    public async Task Invalid_visibility_is_rejected()
    {
        var act = () => _service.UpdateAsync(RESPONSIBLE, 10, new GroupUpdateInfo { StatementVisibility = "Everyone" });

        await act.Should().ThrowAsync<ValidationException>();
    }

    // ---- Feature 003: regra nova de AddMemberAsync (research R-03) ----

    [Fact]
    public async Task Add_member_accepts_user_created_by_the_caller()
    {
        _users.Setup(u => u.GetByIdAsync(NEWCOMER))
            .ReturnsAsync(new User { UserId = NEWCOMER, FirstName = "Lia", LastName = "Silva", CreatedByUserId = RESPONSIBLE });

        await _service.AddMemberAsync(RESPONSIBLE, 10, new AddMemberInfo { UserId = NEWCOMER });

        _groups.Verify(g => g.AddMemberAsync(10, NEWCOMER), Times.Once);
    }

    [Theory]
    [InlineData(null)]
    [InlineData(MEMBER)]
    public async Task Add_member_requires_invitation_for_user_not_created_by_the_caller(long? createdBy)
    {
        _users.Setup(u => u.GetByIdAsync(NEWCOMER))
            .ReturnsAsync(new User { UserId = NEWCOMER, FirstName = "Bruno", LastName = "Lima", CreatedByUserId = createdBy });

        var act = () => _service.AddMemberAsync(RESPONSIBLE, 10, new AddMemberInfo { UserId = NEWCOMER });

        (await act.Should().ThrowAsync<BusinessRuleException>())
            .WithMessage("Essa pessoa precisa ser convidada e aceitar o convite.");
        _groups.Verify(g => g.AddMemberAsync(It.IsAny<long>(), It.IsAny<long>()), Times.Never);
    }

    // ---- Feature 003: POST api/groups/{groupId}/members/new (research R-02) ----

    [Fact]
    public async Task Create_member_with_email_creates_user_and_member_in_one_transaction()
    {
        User? created = null;
        _users.Setup(u => u.InsertAsync(It.IsAny<User>()))
            .Callback<User>(u => { u.UserId = NEW_USER; created = u; }).ReturnsAsync((User u) => u);
        var sequence = new List<string>();
        _unitOfWork.Setup(u => u.BeginTransactionAsync()).Callback(() => sequence.Add("begin")).Returns(Task.CompletedTask);
        _groups.Setup(g => g.AddMemberAsync(10, NEW_USER)).Callback(() => sequence.Add("member")).Returns(Task.CompletedTask);
        _unitOfWork.Setup(u => u.CommitAsync()).Callback(() => sequence.Add("commit")).Returns(Task.CompletedTask);

        await _service.CreateMemberAsync(RESPONSIBLE, 10,
            new NewMemberInfo { FirstName = " Pedro ", LastName = "Silva", Email = " Pedro@Exemplo.com " });

        created!.CreatedByUserId.Should().Be(RESPONSIBLE);
        created.Email.Should().Be("pedro@exemplo.com");
        created.FirstName.Should().Be("Pedro");
        sequence.Should().Equal("begin", "member", "commit");
        _unitOfWork.Verify(u => u.RollbackAsync(), Times.Never);
    }

    [Fact]
    public async Task Create_member_without_email_creates_user_without_login()
    {
        User? created = null;
        _users.Setup(u => u.InsertAsync(It.IsAny<User>()))
            .Callback<User>(u => { u.UserId = NEW_USER; created = u; }).ReturnsAsync((User u) => u);

        await _service.CreateMemberAsync(RESPONSIBLE, 10, new NewMemberInfo { FirstName = "Lia", LastName = "Silva", Email = null });

        created!.Email.Should().BeNull();
        created.CanLogin.Should().BeFalse();
        created.CreatedByUserId.Should().Be(RESPONSIBLE);
        _groups.Verify(g => g.AddMemberAsync(10, NEW_USER), Times.Once);
        _users.Verify(u => u.ExistsEmailAsync(It.IsAny<string>(), It.IsAny<long?>()), Times.Never);
    }

    [Fact]
    public async Task Create_member_with_registered_email_is_a_conflict()
    {
        _users.Setup(u => u.ExistsEmailAsync("ana@exemplo.com", null)).ReturnsAsync(true);

        var act = () => _service.CreateMemberAsync(RESPONSIBLE, 10,
            new NewMemberInfo { FirstName = "Ana", LastName = "Souza", Email = "Ana@Exemplo.com" });

        await act.Should().ThrowAsync<ConflictException>();
        _users.Verify(u => u.InsertAsync(It.IsAny<User>()), Times.Never);
    }

    [Fact]
    public async Task Create_member_race_on_unique_email_is_a_conflict_and_rolls_back()
    {
        _users.Setup(u => u.InsertAsync(It.IsAny<User>())).ThrowsAsync(new InvalidOperationException(
            "An error occurred while saving the entity changes.",
            new Exception("23505: duplicate key value violates unique constraint \"ix_users_email\"")));

        var act = () => _service.CreateMemberAsync(RESPONSIBLE, 10,
            new NewMemberInfo { FirstName = "Ana", LastName = "Souza", Email = "ana@exemplo.com" });

        await act.Should().ThrowAsync<ConflictException>();
        _unitOfWork.Verify(u => u.RollbackAsync(), Times.Once);
        _unitOfWork.Verify(u => u.CommitAsync(), Times.Never);
        _groups.Verify(g => g.AddMemberAsync(It.IsAny<long>(), It.IsAny<long>()), Times.Never);
    }

    [Fact]
    public async Task Create_member_failure_when_adding_member_rolls_back_the_user()
    {
        _groups.Setup(g => g.AddMemberAsync(10, NEW_USER)).ThrowsAsync(new InvalidOperationException("falha"));

        var act = () => _service.CreateMemberAsync(RESPONSIBLE, 10, new NewMemberInfo { FirstName = "Lia", LastName = "Silva" });

        await act.Should().ThrowAsync<InvalidOperationException>();
        _unitOfWork.Verify(u => u.RollbackAsync(), Times.Once);
        _unitOfWork.Verify(u => u.CommitAsync(), Times.Never);
    }

    [Fact]
    public async Task Non_responsible_cannot_create_members()
    {
        var act = () => _service.CreateMemberAsync(MEMBER, 10, new NewMemberInfo { FirstName = "Lia", LastName = "Silva" });

        await act.Should().ThrowAsync<ForbiddenException>();
        _users.Verify(u => u.InsertAsync(It.IsAny<User>()), Times.Never);
    }

    [Fact]
    public async Task Create_member_in_unknown_group_is_not_found()
    {
        var act = () => _service.CreateMemberAsync(RESPONSIBLE, 999, new NewMemberInfo { FirstName = "Lia", LastName = "Silva" });

        await act.Should().ThrowAsync<NotFoundException>();
    }

    [Theory]
    [InlineData("", "Silva", null)]
    [InlineData("Lia", "", null)]
    [InlineData("Lia", "Silva", "email-invalido")]
    public async Task Create_member_validates_input(string firstName, string lastName, string? email)
    {
        var act = () => _service.CreateMemberAsync(RESPONSIBLE, 10,
            new NewMemberInfo { FirstName = firstName, LastName = lastName, Email = email });

        await act.Should().ThrowAsync<ValidationException>();
        _users.Verify(u => u.InsertAsync(It.IsAny<User>()), Times.Never);
    }
}
