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

/// <summary>POST api/groups/{groupId}/member-lookup (feature 003, research R-01).</summary>
public class MemberLookupTests
{
    private const long RESPONSIBLE = 1;
    private const long MEMBER = 2;
    private const long REGISTERED = 3;
    private const long INVITED = 4;
    private const long FAMILY = 10;
    private const long PENDING_INVITATION = 77;

    private readonly Mock<IGroupRepository<Group>> _groups = new();
    private readonly Mock<IUserRepository<User>> _users = new();
    private readonly Mock<IGroupInvitationRepository<GroupInvitation>> _invitations = new();
    private readonly Dictionary<string, User> _byEmail = new();
    private readonly GroupService _service;

    public MemberLookupTests()
    {
        AddUser(RESPONSIBLE, "Ana", "Silva", "ana.silva@exemplo.com");
        AddUser(MEMBER, "Bruno", "Silva", "bruno@exemplo.com");
        AddUser(REGISTERED, "Ana", "Souza", "ana@exemplo.com");
        AddUser(INVITED, "Davi", "Lima", "davi@exemplo.com");

        var group = new Group
        {
            GroupId = FAMILY, Name = "Família Silva", UserId = RESPONSIBLE,
            Members = new List<GroupMember>
            {
                new() { GroupId = FAMILY, UserId = RESPONSIBLE },
                new() { GroupId = FAMILY, UserId = MEMBER }
            }
        };
        _groups.Setup(g => g.GetByIdAsync(FAMILY)).ReturnsAsync(group);
        // O repositório real também normaliza; aqui o mock exige o email já normalizado pelo serviço.
        _users.Setup(u => u.GetByEmailAsync(It.IsAny<string>()))
            .ReturnsAsync((string email) => _byEmail.GetValueOrDefault(email));
        _invitations.Setup(i => i.GetPendingAsync(It.IsAny<long>(), It.IsAny<long>()))
            .ReturnsAsync((long groupId, long userId) => groupId == FAMILY && userId == INVITED
                ? new GroupInvitation
                {
                    GroupInvitationId = PENDING_INVITATION, GroupId = FAMILY, InvitedUserId = INVITED,
                    InvitedByUserId = RESPONSIBLE
                }
                : null);

        _service = new GroupService(_groups.Object, _users.Object, new Mock<IAccountRepository<Account>>().Object,
            _invitations.Object, new Mock<IUnitOfWork>().Object, new GroupInsertInfoValidator(),
            new GroupUpdateInfoValidator(), new MemberLookupInfoValidator(), new NewMemberInfoValidator(),
            new MemberPermissionsInfoValidator(), new Mock<INotificationRepository<Notification>>().Object);
    }

    private void AddUser(long id, string first, string last, string email) =>
        _byEmail[email] = new User { UserId = id, FirstName = first, LastName = last, Email = email };

    private Task<MemberLookupResult> Lookup(string email, long caller = RESPONSIBLE, long groupId = FAMILY) =>
        _service.LookupMemberAsync(caller, groupId, new MemberLookupInfo { Email = email });

    [Fact]
    public async Task Unknown_email_is_available_without_user()
    {
        var result = await Lookup("pedro@exemplo.com");

        result.Status.Should().Be(nameof(MemberLookupStatus.Available));
        result.Email.Should().Be("pedro@exemplo.com");
        result.User.Should().BeNull();
        result.InvitationId.Should().BeNull();
    }

    [Fact]
    public async Task Registered_email_returns_only_the_name()
    {
        var result = await Lookup("ana@exemplo.com");

        result.Status.Should().Be(nameof(MemberLookupStatus.Registered));
        result.User!.UserId.Should().Be(REGISTERED);
        result.User.FirstName.Should().Be("Ana");
        result.User.LastName.Should().Be("Souza");
        result.InvitationId.Should().BeNull();
    }

    [Fact]
    public async Task Email_is_normalized_before_lookup()
    {
        var result = await Lookup(" Ana@Exemplo.com ");

        result.Email.Should().Be("ana@exemplo.com");
        result.Status.Should().Be(nameof(MemberLookupStatus.Registered));
        result.User!.UserId.Should().Be(REGISTERED);
    }

    [Fact]
    public async Task Member_email_is_already_member()
    {
        var result = await Lookup("bruno@exemplo.com");

        result.Status.Should().Be(nameof(MemberLookupStatus.AlreadyMember));
        result.User!.UserId.Should().Be(MEMBER);
    }

    [Fact]
    public async Task Responsible_own_email_is_already_member()
    {
        var result = await Lookup("ana.silva@exemplo.com");

        result.Status.Should().Be(nameof(MemberLookupStatus.AlreadyMember));
        result.User!.UserId.Should().Be(RESPONSIBLE);
    }

    [Fact]
    public async Task Pending_invitation_is_reported_with_its_id()
    {
        var result = await Lookup("davi@exemplo.com");

        result.Status.Should().Be(nameof(MemberLookupStatus.PendingInvite));
        result.InvitationId.Should().Be(PENDING_INVITATION);
        result.User!.UserId.Should().Be(INVITED);
    }

    [Fact]
    public async Task Non_responsible_cannot_lookup()
    {
        var act = () => Lookup("ana@exemplo.com", caller: MEMBER);

        await act.Should().ThrowAsync<ForbiddenException>();
        _users.Verify(u => u.GetByEmailAsync(It.IsAny<string>()), Times.Never);
    }

    [Fact]
    public async Task Unknown_group_is_not_found()
    {
        var act = () => Lookup("ana@exemplo.com", groupId: 999);

        await act.Should().ThrowAsync<NotFoundException>();
    }

    [Theory]
    [InlineData("")]
    [InlineData("   ")]
    [InlineData("sem-arroba")]
    public async Task Invalid_email_is_rejected(string email)
    {
        var act = () => Lookup(email);

        await act.Should().ThrowAsync<ValidationException>();
    }

    [Fact]
    public async Task Email_longer_than_254_is_rejected()
    {
        var act = () => Lookup(new string('a', 250) + "@x.com");

        await act.Should().ThrowAsync<ValidationException>();
    }
}
