using Finami.Domain.Enums;
using Finami.Domain.Exceptions;
using Finami.Domain.Models;
using Finami.Domain.Services;
using Finami.Domain.Validators;
using Finami.DTO.Groups;
using Finami.Infra.Interfaces.Repository;
using FluentAssertions;
using Moq;

namespace Finami.Tests.Domain;

public class GroupServiceTests
{
    private const long RESPONSIBLE = 1;
    private const long MEMBER = 2;
    private const long NEWCOMER = 3;

    private readonly Mock<IGroupRepository<Group>> _groups = new();
    private readonly Mock<IUserRepository<User>> _users = new();
    private readonly Mock<IAccountRepository<Account>> _accounts = new();
    private readonly Mock<IUnitOfWork> _unitOfWork = new();
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
        _service = new GroupService(_groups.Object, _users.Object, _accounts.Object, _unitOfWork.Object,
            new GroupInsertInfoValidator(), new GroupUpdateInfoValidator());
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
}
