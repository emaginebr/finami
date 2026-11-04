using Finami.Domain.Exceptions;
using Finami.Domain.Models;
using FluentAssertions;

namespace Finami.Tests.Domain;

/// <summary>Feature 008 (T010): permissões por membro no modelo <see cref="Group"/> (data-model.md §Domínio).</summary>
public class GroupPermissionsTests
{
    private const long ANA = 1;
    private const long BRUNO = 2;
    private const long CAIO = 3;
    private const long OUTSIDER = 9;

    private static Group Family()
    {
        var group = new Group { GroupId = 10, Name = "Silva", UserId = ANA };
        group.Members.Add(new GroupMember { GroupId = 10, UserId = ANA });
        group.Members.Add(new GroupMember { GroupId = 10, UserId = BRUNO });
        group.Members.Add(new GroupMember { GroupId = 10, UserId = CAIO, CanCreateTransactions = false, CanReverse = true });
        return group;
    }

    [Fact]
    public void New_member_defaults_to_can_create_and_cannot_reverse()
    {
        var member = new GroupMember();

        member.CanCreateTransactions.Should().BeTrue();
        member.CanReverse.Should().BeFalse();
    }

    [Fact]
    public void Responsible_always_has_both_permissions_even_if_the_row_says_otherwise()
    {
        var group = Family();
        var row = group.FindMember(ANA)!;
        row.CanCreateTransactions = false;
        row.CanReverse = false;

        group.CanCreateTransactions(ANA).Should().BeTrue();
        group.CanReverse(ANA).Should().BeTrue();
    }

    [Fact]
    public void Member_permissions_come_from_the_member_row()
    {
        var group = Family();

        group.CanCreateTransactions(BRUNO).Should().BeTrue();
        group.CanReverse(BRUNO).Should().BeFalse();
        group.CanCreateTransactions(CAIO).Should().BeFalse();
        group.CanReverse(CAIO).Should().BeTrue();
    }

    [Fact]
    public void Non_member_has_no_permission()
    {
        var group = Family();

        group.FindMember(OUTSIDER).Should().BeNull();
        group.CanCreateTransactions(OUTSIDER).Should().BeFalse();
        group.CanReverse(OUTSIDER).Should().BeFalse();
    }

    [Fact]
    public void Responsible_changes_member_permissions_and_gets_the_history_record()
    {
        var group = Family();

        var change = group.SetMemberPermissions(ANA, BRUNO, canCreateTransactions: false, canReverse: true);

        change.Should().NotBeNull();
        change!.GroupId.Should().Be(10);
        change.MemberUserId.Should().Be(BRUNO);
        change.ChangedByUserId.Should().Be(ANA);
        change.BeforeCanCreateTransactions.Should().BeTrue();
        change.BeforeCanReverse.Should().BeFalse();
        change.AfterCanCreateTransactions.Should().BeFalse();
        change.AfterCanReverse.Should().BeTrue();
        group.CanCreateTransactions(BRUNO).Should().BeFalse();
        group.CanReverse(BRUNO).Should().BeTrue();
    }

    [Fact]
    public void Same_permissions_return_null_and_change_nothing()
    {
        var group = Family();

        group.SetMemberPermissions(ANA, BRUNO, canCreateTransactions: true, canReverse: false).Should().BeNull();
        group.FindMember(BRUNO)!.CanCreateTransactions.Should().BeTrue();
    }

    [Fact]
    public void Only_the_responsible_changes_permissions()
    {
        var group = Family();

        var act = () => group.SetMemberPermissions(BRUNO, CAIO, true, true);

        act.Should().Throw<ForbiddenException>()
            .WithMessage("Apenas o responsável pelo grupo pode realizar esta operação.");
        group.CanCreateTransactions(CAIO).Should().BeFalse();
    }

    [Fact]
    public void Responsible_permissions_cannot_be_changed()
    {
        var act = () => Family().SetMemberPermissions(ANA, ANA, false, false);

        act.Should().Throw<BusinessRuleException>()
            .WithMessage("As permissões do responsável não podem ser alteradas.");
    }

    [Fact]
    public void Unknown_member_is_not_found()
    {
        var act = () => Family().SetMemberPermissions(ANA, OUTSIDER, false, false);

        act.Should().Throw<NotFoundException>().WithMessage("Membro não encontrado.");
    }
}
