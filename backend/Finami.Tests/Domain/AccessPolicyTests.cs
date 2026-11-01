using Finami.Domain.Enums;
using Finami.Domain.Exceptions;
using Finami.Domain.Models;
using Finami.Domain.Services;
using Finami.Infra.Interfaces.Repository;
using FluentAssertions;
using Moq;

namespace Finami.Tests.Domain;

public class AccessPolicyTests
{
    private const long RESPONSIBLE = 1;
    private const long MEMBER = 2;
    private const long OUTSIDER = 3;
    private const long GROUP = 10;

    private readonly Mock<IGroupRepository<Group>> _groups = new();
    private readonly AccessPolicy _policy;

    public AccessPolicyTests()
    {
        _groups.Setup(g => g.GetResponsibleUserIdAsync(GROUP)).ReturnsAsync(RESPONSIBLE);
        _policy = new AccessPolicy(_groups.Object);
    }

    private static Account Wallet(long owner, long? groupId = null) =>
        new() { AccountId = 100, Kind = AccountKind.Wallet, UserId = owner, GroupId = groupId, Currency = Currency.Brl };

    [Fact]
    public async Task Owner_controls_own_wallet() =>
        (await _policy.CanControlWalletAsync(MEMBER, Wallet(MEMBER))).Should().BeTrue();

    [Fact]
    public async Task Responsible_controls_wallet_linked_to_group() =>
        (await _policy.CanControlWalletAsync(RESPONSIBLE, Wallet(MEMBER, GROUP))).Should().BeTrue();

    [Fact]
    public async Task Responsible_does_not_control_personal_wallet_of_member() =>
        (await _policy.CanControlWalletAsync(RESPONSIBLE, Wallet(MEMBER))).Should().BeFalse();

    [Fact]
    public async Task Outsider_does_not_control_group_wallet()
    {
        (await _policy.CanControlWalletAsync(OUTSIDER, Wallet(MEMBER, GROUP))).Should().BeFalse();
        var act = () => _policy.EnsureCanControlWalletAsync(OUTSIDER, Wallet(MEMBER, GROUP));
        await act.Should().ThrowAsync<ForbiddenException>();
    }

    [Fact]
    public async Task System_accounts_are_never_controlled()
    {
        var system = new Account { AccountId = 1, Kind = AccountKind.ExternalSource, Currency = Currency.Brl };
        (await _policy.CanControlWalletAsync(RESPONSIBLE, system)).Should().BeFalse();
    }

    [Fact]
    public void Creator_can_edit_profile_of_user_without_login()
    {
        var child = new User { UserId = 50, FirstName = "Pedro", LastName = "Silva", CreatedByUserId = RESPONSIBLE };

        _policy.CanEditUserProfile(RESPONSIBLE, child).Should().BeTrue();
        _policy.CanEditUserProfile(child.UserId, child).Should().BeTrue();
        _policy.CanEditUserProfile(OUTSIDER, child).Should().BeFalse();
    }

    [Fact]
    public async Task Users_sharing_a_group_can_view_each_other()
    {
        var target = new User { UserId = MEMBER, FirstName = "B", LastName = "B" };
        _groups.Setup(g => g.ShareGroupAsync(RESPONSIBLE, MEMBER)).ReturnsAsync(true);

        (await _policy.CanViewUserAsync(RESPONSIBLE, target)).Should().BeTrue();
        (await _policy.CanViewUserAsync(OUTSIDER, target)).Should().BeFalse();
    }
}
