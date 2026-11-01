using Finami.Domain.Enums;
using Finami.Domain.Exceptions;
using Finami.Domain.Interfaces;
using Finami.Domain.Models;
using Finami.Domain.Services;
using Finami.DTO.Balances;
using Finami.DTO.Quotes;
using Finami.Infra.Interfaces.Repository;
using FluentAssertions;
using Moq;

namespace Finami.Tests.Domain;

/// <summary>Cenários de "Testes esperados" de contracts/api-additions.md (§2–3).</summary>
public class BalanceServiceTests
{
    private const long RESPONSIBLE = 1;   // Ana, responsável pelos dois grupos
    private const long MEMBER = 2;        // Bruno, membro dos dois grupos
    private const long KID = 3;           // Pedro, membro só da família, sem carteiras
    private const long OUTSIDER = 4;      // Carla, sem grupo em comum
    private const long LONELY = 5;        // Davi, sem grupos

    private const long FAMILY = 10;
    private const long FRIENDS = 20;

    private const decimal PRICE = 500000m;

    private readonly Mock<IGroupRepository<Group>> _groups = new();
    private readonly Mock<IAccountRepository<Account>> _accounts = new();
    private readonly Mock<IUserRepository<User>> _users = new();
    private readonly Mock<IQuoteService> _quotes = new();

    private readonly Dictionary<long, Group> _groupStore = new();
    private readonly Dictionary<long, Account> _walletStore = new();
    private readonly Dictionary<long, decimal> _balances = new();
    private readonly Dictionary<long, User> _userStore = new();

    public BalanceServiceTests()
    {
        AddUser(RESPONSIBLE, "Ana", "Silva");
        AddUser(MEMBER, "Bruno", "Silva");
        AddUser(KID, "Aaron", "Silva"); // nome "menor" que o da responsável: testa a ordenação
        AddUser(OUTSIDER, "Carla", "Souza");
        AddUser(LONELY, "Davi", "Lima");

        AddGroup(FAMILY, "Família Silva", RESPONSIBLE, StatementVisibility.ResponsibleOnly, RESPONSIBLE, MEMBER, KID);
        AddGroup(FRIENDS, "Amigos", RESPONSIBLE, StatementVisibility.AllMembers, RESPONSIBLE, MEMBER);

        Wallet(100, RESPONSIBLE, Currency.Brl, 300m, FAMILY, "Conta");
        Wallet(101, MEMBER, Currency.Brl, 100m, FAMILY, "Mesada");
        Wallet(102, MEMBER, Currency.Btc, 0.0003m, FAMILY, "Ledger");
        Wallet(103, MEMBER, Currency.Brl, 999m, FAMILY, "Antiga", active: false);
        Wallet(104, MEMBER, Currency.Brl, 50m, FRIENDS, "Viagem");
        Wallet(105, MEMBER, Currency.Brl, 70m, null, "Pessoal");
        Wallet(106, OUTSIDER, Currency.Brl, 1000m, null, "Outra");

        _groups.Setup(g => g.GetByIdAsync(It.IsAny<long>())).ReturnsAsync((long id) => _groupStore.GetValueOrDefault(id));
        _groups.Setup(g => g.ListByMemberAsync(It.IsAny<long>()))
            .ReturnsAsync((long user) => _groupStore.Values.Where(g => g.IsMember(user)).ToList());
        _groups.Setup(g => g.GetResponsibleUserIdAsync(It.IsAny<long>()))
            .ReturnsAsync((long id) => _groupStore.TryGetValue(id, out var g) ? g.UserId : null);
        _groups.Setup(g => g.IsMemberAsync(It.IsAny<long>(), It.IsAny<long>()))
            .ReturnsAsync((long id, long user) => _groupStore.TryGetValue(id, out var g) && g.IsMember(user));

        _accounts.Setup(a => a.GetByIdAsync(It.IsAny<long>())).ReturnsAsync((long id) => _walletStore.GetValueOrDefault(id));
        _accounts.Setup(a => a.ListByGroupsAsync(It.IsAny<IEnumerable<long>>(), It.IsAny<bool>()))
            .ReturnsAsync((IEnumerable<long> ids, bool includeInactive) => _walletStore.Values
                .Where(w => w.GroupId.HasValue && ids.Contains(w.GroupId.Value) && (includeInactive || w.IsActive))
                .ToList());
        _accounts.Setup(a => a.ListByOwnerAsync(It.IsAny<long>(), It.IsAny<bool>()))
            .ReturnsAsync((long owner, bool includeInactive) => _walletStore.Values
                .Where(w => w.UserId == owner && (includeInactive || w.IsActive))
                .ToList());
        _accounts.Setup(a => a.GetBalancesAsync(It.IsAny<IEnumerable<long>>()))
            .ReturnsAsync((IEnumerable<long> ids) => ids.Distinct().ToDictionary(id => id, id => _balances.GetValueOrDefault(id)));

        _users.Setup(u => u.GetByIdAsync(It.IsAny<long>())).ReturnsAsync((long id) => _userStore.GetValueOrDefault(id));
        _users.Setup(u => u.GetByIdsAsync(It.IsAny<IEnumerable<long>>()))
            .ReturnsAsync((IEnumerable<long> ids) => ids.Where(_userStore.ContainsKey).Select(i => _userStore[i]).ToList());

        SetQuote(PRICE);
    }

    private BalanceService Service() =>
        new(_groups.Object, _accounts.Object, _users.Object, new AccessPolicy(_groups.Object), _quotes.Object);

    private void AddUser(long id, string firstName, string lastName) =>
        _userStore[id] = new User { UserId = id, FirstName = firstName, LastName = lastName };

    private void AddGroup(long id, string name, long responsible, StatementVisibility visibility, params long[] members) =>
        _groupStore[id] = new Group
        {
            GroupId = id, Name = name, UserId = responsible, StatementVisibility = visibility,
            Members = members.Select(m => new GroupMember { GroupId = id, UserId = m }).ToList()
        };

    private void Wallet(long id, long owner, Currency currency, decimal balance, long? group, string name, bool active = true)
    {
        _walletStore[id] = new Account
        {
            AccountId = id, Kind = AccountKind.Wallet, UserId = owner, Currency = currency, Name = name,
            GroupId = group, IsActive = active, IsVirtual = id == 101
        };
        _balances[id] = balance;
    }

    private void SetVisibility(long groupId, StatementVisibility visibility) =>
        _groupStore[groupId].StatementVisibility = visibility;

    private void SetQuote(decimal price, bool stale = false) =>
        _quotes.Setup(q => q.GetCurrentAsync()).ReturnsAsync(new BtcQuoteInfo
        {
            PriceBrl = price, QuotedAt = new DateTime(2026, 11, 1, 14, 2, 10, DateTimeKind.Utc), Source = "test", IsStale = stale
        });

    private void RemoveQuote() =>
        _quotes.Setup(q => q.GetCurrentAsync()).ThrowsAsync(new QuoteUnavailableException());

    // ---------------------------------------------------------------- GET /api/groups/{id}/balances

    [Theory]
    [InlineData(StatementVisibility.ResponsibleOnly)]
    [InlineData(StatementVisibility.AllMembers)]
    [InlineData(StatementVisibility.MembersSummary)]
    public async Task Responsible_sees_full_detail_in_every_visibility(StatementVisibility visibility)
    {
        SetVisibility(FAMILY, visibility);

        var result = await Service().GetGroupBalancesAsync(RESPONSIBLE, FAMILY);

        result.DetailLevel.Should().Be(DetailLevel.Full);
        result.IsResponsible.Should().BeTrue();
        result.StatementVisibility.Should().Be(visibility.ToString());
        result.Name.Should().Be("Família Silva");
        result.TotalBrl.Should().Be(550m); // 300 + 100 + 0,0003 × 500.000
        result.BtcExcluded.Should().BeFalse();
        result.Quote.Should().NotBeNull();
        result.Quote!.PriceBrl.Should().Be(PRICE);
        result.Quote.IsStale.Should().BeFalse();

        var bruno = result.Members.Single(m => m.UserId == MEMBER);
        bruno.BalanceBrl.Should().Be(100m);
        bruno.BalanceBtc.Should().Be(0.0003m);
        bruno.EstimatedBrl.Should().Be(150m);
        bruno.TotalBrl.Should().Be(250m);
        bruno.Wallets.Select(w => w.Name).Should().Equal("Ledger", "Mesada"); // por nome

        var ledger = bruno.Wallets.Single(w => w.WalletId == 102);
        ledger.Currency.Should().Be("BTC");
        ledger.Balance.Should().Be(0.0003m);
        ledger.EstimatedBrl.Should().Be(150m);
        ledger.CanViewStatement.Should().BeTrue(); // responsável controla carteiras do grupo

        var mesada = bruno.Wallets.Single(w => w.WalletId == 101);
        mesada.EstimatedBrl.Should().BeNull();
        mesada.IsVirtual.Should().BeTrue();
    }

    [Fact]
    public async Task Members_are_ordered_responsible_first_then_by_name()
    {
        var result = await Service().GetGroupBalancesAsync(RESPONSIBLE, FAMILY);

        result.Members.Select(m => m.UserId).Should().Equal(RESPONSIBLE, KID, MEMBER);
        result.Members[0].IsResponsible.Should().BeTrue();
        result.Members.Skip(1).Should().OnlyContain(m => !m.IsResponsible);
    }

    [Fact]
    public async Task Member_with_AllMembers_sees_full_detail()
    {
        SetVisibility(FAMILY, StatementVisibility.AllMembers);

        var result = await Service().GetGroupBalancesAsync(KID, FAMILY);

        result.DetailLevel.Should().Be(DetailLevel.Full);
        result.IsResponsible.Should().BeFalse();
        result.TotalBrl.Should().Be(550m);
        var bruno = result.Members.Single(m => m.UserId == MEMBER);
        bruno.Wallets.Should().HaveCount(2);
        bruno.Wallets.Should().OnlyContain(w => w.CanViewStatement); // AllMembers → extrato liberado
        result.Members.Single(m => m.UserId == RESPONSIBLE).Wallets.Should().ContainSingle(w => w.WalletId == 100);
    }

    [Fact]
    public async Task Member_with_MembersSummary_sees_totals_without_wallets()
    {
        SetVisibility(FAMILY, StatementVisibility.MembersSummary);

        var result = await Service().GetGroupBalancesAsync(MEMBER, FAMILY);

        result.DetailLevel.Should().Be(DetailLevel.Summary);
        result.TotalBrl.Should().Be(550m);
        result.Members.Should().OnlyContain(m => m.Wallets.Count == 0);
        var ana = result.Members.Single(m => m.UserId == RESPONSIBLE);
        ana.BalanceBrl.Should().Be(300m);
        ana.TotalBrl.Should().Be(300m);
        result.Members.Single(m => m.UserId == MEMBER).TotalBrl.Should().Be(250m);
    }

    [Fact]
    public async Task Member_with_ResponsibleOnly_sees_only_the_member_list()
    {
        SetVisibility(FAMILY, StatementVisibility.ResponsibleOnly);

        var result = await Service().GetGroupBalancesAsync(MEMBER, FAMILY);

        result.DetailLevel.Should().Be(DetailLevel.Hidden);
        result.TotalBrl.Should().BeNull();
        result.BtcExcluded.Should().BeFalse();
        result.Members.Select(m => m.UserId).Should().BeEquivalentTo(new[] { RESPONSIBLE, MEMBER, KID });
        result.Members.Should().OnlyContain(m =>
            m.BalanceBrl == null && m.BalanceBtc == null && m.EstimatedBrl == null && m.TotalBrl == null && m.Wallets.Count == 0);
        result.Members.Single(m => m.UserId == MEMBER).FirstName.Should().Be("Bruno");
    }

    [Fact]
    public async Task Non_member_gets_not_found()
    {
        var act = () => Service().GetGroupBalancesAsync(OUTSIDER, FAMILY);

        await act.Should().ThrowAsync<NotFoundException>();
    }

    [Fact]
    public async Task Unknown_group_gets_not_found()
    {
        var act = () => Service().GetGroupBalancesAsync(RESPONSIBLE, 999);

        await act.Should().ThrowAsync<NotFoundException>();
    }

    [Fact]
    public async Task Inactive_and_other_group_wallets_are_left_out()
    {
        var result = await Service().GetGroupBalancesAsync(RESPONSIBLE, FAMILY);

        var bruno = result.Members.Single(m => m.UserId == MEMBER);
        bruno.BalanceBrl.Should().Be(100m); // sem a inativa (999), a do outro grupo (50) e a pessoal (70)
        bruno.Wallets.Select(w => w.WalletId).Should().NotContain(new[] { 103L, 104L, 105L });
    }

    [Fact]
    public async Task Member_without_wallets_shows_zero()
    {
        var result = await Service().GetGroupBalancesAsync(RESPONSIBLE, FAMILY);

        var kid = result.Members.Single(m => m.UserId == KID);
        kid.BalanceBrl.Should().Be(0m);
        kid.BalanceBtc.Should().Be(0m);
        kid.EstimatedBrl.Should().Be(0m);
        kid.TotalBrl.Should().Be(0m);
        kid.Wallets.Should().BeEmpty();
    }

    [Fact]
    public async Task Without_quote_btc_is_excluded_and_totals_are_brl_only()
    {
        RemoveQuote();

        var result = await Service().GetGroupBalancesAsync(RESPONSIBLE, FAMILY);

        result.Quote.Should().BeNull();
        result.BtcExcluded.Should().BeTrue();
        result.TotalBrl.Should().Be(400m);
        var bruno = result.Members.Single(m => m.UserId == MEMBER);
        bruno.BalanceBtc.Should().Be(0.0003m);
        bruno.EstimatedBrl.Should().BeNull();
        bruno.TotalBrl.Should().Be(100m);
        bruno.Wallets.Single(w => w.WalletId == 102).EstimatedBrl.Should().BeNull();
    }

    [Fact]
    public async Task Without_quote_and_without_btc_balance_nothing_is_excluded()
    {
        RemoveQuote();
        _balances[102] = 0m;

        var result = await Service().GetGroupBalancesAsync(RESPONSIBLE, FAMILY);

        result.BtcExcluded.Should().BeFalse();
        result.TotalBrl.Should().Be(400m);
    }

    [Fact]
    public async Task Stale_quote_is_accepted_and_flagged()
    {
        SetQuote(PRICE, stale: true);

        var result = await Service().GetGroupBalancesAsync(RESPONSIBLE, FAMILY);

        result.Quote!.IsStale.Should().BeTrue();
        result.BtcExcluded.Should().BeFalse();
        result.TotalBrl.Should().Be(550m);
    }

    [Fact]
    public async Task Estimated_brl_is_truncated_to_two_places()
    {
        SetQuote(512345.67m);
        _balances[102] = 0.00012345m; // 63,2490729615 → 63,24 (arredondando seria 63,25)

        var result = await Service().GetGroupBalancesAsync(RESPONSIBLE, FAMILY);

        var bruno = result.Members.Single(m => m.UserId == MEMBER);
        bruno.EstimatedBrl.Should().Be(63.24m);
        bruno.Wallets.Single(w => w.WalletId == 102).EstimatedBrl.Should().Be(63.24m);
        bruno.TotalBrl.Should().Be(163.24m);
    }

    // ---------------------------------------------------------------- GET /api/users/{id}/group-balances

    [Fact]
    public async Task Own_user_sees_all_groups_in_full_ordered_by_name()
    {
        var result = await Service().GetUserGroupBalancesAsync(MEMBER, MEMBER);

        result.UserId.Should().Be(MEMBER);
        result.FirstName.Should().Be("Bruno");
        result.Groups.Select(g => g.Name).Should().Equal("Amigos", "Família Silva");
        result.Groups.Should().OnlyContain(g => g.DetailLevel == DetailLevel.Full);

        var family = result.Groups.Single(g => g.GroupId == FAMILY);
        family.BalanceBrl.Should().Be(100m);
        family.BalanceBtc.Should().Be(0.0003m);
        family.EstimatedBrl.Should().Be(150m);
        family.TotalBrl.Should().Be(250m);
        family.Wallets.Select(w => w.Name).Should().Equal("Ledger", "Mesada");

        var friends = result.Groups.Single(g => g.GroupId == FRIENDS);
        friends.TotalBrl.Should().Be(50m);
        friends.Wallets.Should().ContainSingle(w => w.WalletId == 104);

        result.TotalBrl.Should().Be(300m);
        result.BtcExcluded.Should().BeFalse();
    }

    [Fact]
    public async Task Own_user_without_groups_gets_empty_list()
    {
        var result = await Service().GetUserGroupBalancesAsync(LONELY, LONELY);

        result.Groups.Should().BeEmpty();
        result.TotalBrl.Should().Be(0m);
        result.FirstName.Should().Be("Davi");
    }

    [Fact]
    public async Task Responsible_sees_member_in_full_in_every_group()
    {
        var result = await Service().GetUserGroupBalancesAsync(RESPONSIBLE, MEMBER);

        result.Groups.Should().HaveCount(2);
        result.Groups.Should().OnlyContain(g => g.DetailLevel == DetailLevel.Full && g.Wallets.Count > 0);
        result.TotalBrl.Should().Be(300m);
    }

    [Fact]
    public async Task Fellow_member_with_MembersSummary_sees_summary_without_wallets()
    {
        SetVisibility(FAMILY, StatementVisibility.MembersSummary);

        var result = await Service().GetUserGroupBalancesAsync(KID, MEMBER);

        var family = result.Groups.Should().ContainSingle().Subject; // KID não é membro de "Amigos"
        family.GroupId.Should().Be(FAMILY);
        family.DetailLevel.Should().Be(DetailLevel.Summary);
        family.Wallets.Should().BeEmpty();
        family.TotalBrl.Should().Be(250m);
        result.TotalBrl.Should().Be(250m);
    }

    [Fact]
    public async Task Hidden_groups_are_not_listed_and_no_visible_group_gets_not_found()
    {
        SetVisibility(FAMILY, StatementVisibility.ResponsibleOnly);

        var act = () => Service().GetUserGroupBalancesAsync(KID, MEMBER);

        await act.Should().ThrowAsync<NotFoundException>();
    }

    [Fact]
    public async Task Hidden_group_is_omitted_when_another_group_is_visible()
    {
        SetVisibility(FAMILY, StatementVisibility.ResponsibleOnly);
        _groupStore[FRIENDS].Members.Add(new GroupMember { GroupId = FRIENDS, UserId = KID });

        var result = await Service().GetUserGroupBalancesAsync(KID, MEMBER);

        result.Groups.Should().ContainSingle(g => g.GroupId == FRIENDS);
        result.TotalBrl.Should().Be(50m);
    }

    [Fact]
    public async Task User_without_shared_group_gets_not_found()
    {
        var act = () => Service().GetUserGroupBalancesAsync(OUTSIDER, MEMBER);

        await act.Should().ThrowAsync<NotFoundException>();
    }

    [Fact]
    public async Task Unknown_user_gets_not_found()
    {
        var act = () => Service().GetUserGroupBalancesAsync(RESPONSIBLE, 999);

        await act.Should().ThrowAsync<NotFoundException>();
    }

    [Fact]
    public async Task User_balances_without_quote_exclude_btc()
    {
        RemoveQuote();

        var result = await Service().GetUserGroupBalancesAsync(MEMBER, MEMBER);

        result.BtcExcluded.Should().BeTrue();
        var family = result.Groups.Single(g => g.GroupId == FAMILY);
        family.EstimatedBrl.Should().BeNull();
        family.TotalBrl.Should().Be(100m);
        result.TotalBrl.Should().Be(150m);
    }
}
