using Finami.Domain.Enums;
using Finami.Domain.Exceptions;
using Finami.Domain.Interfaces;
using Finami.Domain.Models;
using Finami.Domain.Services;
using Finami.Infra.Interfaces.Repository;
using FluentAssertions;
using Moq;

namespace Finami.Tests.Domain;

public class StatementServiceTests
{
    private const long RESPONSIBLE = 1;
    private const long MEMBER = 2;
    private const long GROUP = 10;

    private static readonly DateOnly JAN_1 = new(2026, 1, 1);
    private static readonly DateOnly JAN_31 = new(2026, 1, 31);

    private readonly Mock<IAccountRepository<Account>> _accounts = new();
    private readonly Mock<IGroupRepository<Group>> _groups = new();
    private readonly Mock<IUserRepository<User>> _users = new();
    private readonly Mock<ILedgerRepository<LedgerEntry>> _ledger = new();
    private readonly Mock<IAccessPolicy> _policy = new();

    private readonly Dictionary<long, Account> _store = new();
    private readonly List<LedgerEntry> _entries = new();
    private readonly Group _group;
    private long _nextTx = 1;

    public StatementServiceTests()
    {
        Add(new Account { AccountId = 1, Kind = AccountKind.ExternalSource, Currency = Currency.Brl, Name = "Origem externa (BRL)" });
        Add(new Account { AccountId = 2, Kind = AccountKind.ExternalSink, Currency = Currency.Brl, Name = "Destino externo (BRL)" });
        Add(new Account { AccountId = 3, Kind = AccountKind.Exchange, Currency = Currency.Brl, Name = "Câmbio (BRL)" });
        Add(new Account { AccountId = 6, Kind = AccountKind.Exchange, Currency = Currency.Btc, Name = "Câmbio (BTC)" });

        _group = new Group
        {
            GroupId = GROUP, UserId = RESPONSIBLE, Name = "Família",
            Members = new List<GroupMember> { new() { UserId = RESPONSIBLE }, new() { UserId = MEMBER } }
        };
        _groups.Setup(g => g.GetByIdAsync(GROUP)).ReturnsAsync(_group);
        _users.Setup(u => u.GetByIdAsync(It.IsAny<long>())).ReturnsAsync((long id) => new User { UserId = id });

        _accounts.Setup(a => a.GetByIdAsync(It.IsAny<long>())).ReturnsAsync((long id) => _store.GetValueOrDefault(id));
        _accounts.Setup(a => a.GetByIdsAsync(It.IsAny<IEnumerable<long>>()))
            .ReturnsAsync((IEnumerable<long> ids) => ids.Where(_store.ContainsKey).Select(i => _store[i]).ToList());
        _accounts.Setup(a => a.ListByOwnerAsync(It.IsAny<long>(), It.IsAny<bool>()))
            .ReturnsAsync((long owner, bool _) => _store.Values.Where(a => a.IsWallet && a.UserId == owner).ToList());
        _accounts.Setup(a => a.ListByGroupsAsync(It.IsAny<IEnumerable<long>>(), It.IsAny<bool>()))
            .ReturnsAsync((IEnumerable<long> groups, bool _) =>
                _store.Values.Where(a => a.GroupId.HasValue && groups.Contains(a.GroupId.Value)).ToList());

        _ledger.Setup(l => l.GetOpeningBalancesAsync(It.IsAny<IEnumerable<long>>(), It.IsAny<DateTime>()))
            .ReturnsAsync((IEnumerable<long> ids, DateTime before) => _entries
                .Where(e => ids.Contains(e.AccountId) && e.OccurredAt < before)
                .GroupBy(e => (int)e.Currency).ToDictionary(g => g.Key, g => g.Sum(e => e.Amount)));
        _ledger.Setup(l => l.ListEntriesAsync(It.IsAny<IEnumerable<long>>(), It.IsAny<DateTime>(), It.IsAny<DateTime>()))
            .ReturnsAsync((IEnumerable<long> ids, DateTime from, DateTime to) => _entries
                .Where(e => ids.Contains(e.AccountId) && e.OccurredAt >= from && e.OccurredAt < to)
                .OrderBy(e => e.OccurredAt).ToList());

        _policy.Setup(p => p.CanViewWalletStatementAsync(It.IsAny<long>(), It.IsAny<Account>()))
            .ReturnsAsync((long user, Account a) => a.UserId == user);
        _policy.Setup(p => p.CanControlWalletAsync(It.IsAny<long>(), It.IsAny<Account>()))
            .ReturnsAsync((long user, Account a) => a.UserId == user);
        _policy.Setup(p => p.GroupStatementAccess(It.IsAny<long>(), It.IsAny<Group>()))
            .Returns((long user, Group g) => new AccessPolicy(_groups.Object).GroupStatementAccess(user, g));
    }

    private StatementService Service() =>
        new(_accounts.Object, _groups.Object, _users.Object, _ledger.Object, _policy.Object);

    private void Add(Account account) => _store[account.AccountId] = account;

    private Account Wallet(long id, long owner, Currency currency, long? group = null)
    {
        var wallet = new Account
            { AccountId = id, Kind = AccountKind.Wallet, UserId = owner, Currency = currency, Name = $"W{id}", GroupId = group };
        Add(wallet);
        return wallet;
    }

    /// <summary>Registra uma transação já lançada (2 ou 4 lançamentos) em uma data local.</summary>
    private void Post(DateOnly date, TransactionType type, long source, long destination, decimal sourceAmount,
        decimal destinationAmount, decimal? quote = null)
    {
        var at = StatementService.ToUtcStartOfDay(date).AddHours(12);
        var tx = new Transaction
        {
            TransactionId = _nextTx++, Type = type, SourceAccountId = source, DestinationAccountId = destination,
            SourceAmount = sourceAmount, DestinationAmount = destinationAmount, QuotePriceBrl = quote, OccurredAt = at
        };
        var src = _store[source];
        var dst = _store[destination];
        void Entry(long account, decimal amount, Currency currency) =>
            _entries.Add(new LedgerEntry
                { TransactionId = tx.TransactionId, AccountId = account, Amount = amount, Currency = currency, OccurredAt = at, Transaction = tx });
        Entry(source, -sourceAmount, src.Currency);
        if (src.Currency != dst.Currency)
        {
            Entry(src.Currency == Currency.Brl ? 3 : 6, sourceAmount, src.Currency);
            Entry(dst.Currency == Currency.Brl ? 3 : 6, -destinationAmount, dst.Currency);
        }
        Entry(destination, destinationAmount, dst.Currency);
    }

    [Fact]
    public async Task Wallet_statement_has_opening_closing_and_totals()
    {
        Wallet(100, MEMBER, Currency.Brl);
        Post(new DateOnly(2025, 12, 20), TransactionType.ExternalIncome, 1, 100, 1000m, 1000m);
        Post(new DateOnly(2026, 1, 5), TransactionType.ExternalIncome, 1, 100, 500m, 500m);
        Post(new DateOnly(2026, 1, 10), TransactionType.ExternalExpense, 100, 2, 200m, 200m);
        Post(new DateOnly(2026, 2, 1), TransactionType.ExternalIncome, 1, 100, 999m, 999m);

        var result = await Service().GetWalletStatementAsync(MEMBER, 100, JAN_1, JAN_31);

        var brl = result.Totals.Single();
        brl.OpeningBalance.Should().Be(1000m);
        brl.TotalIn.Should().Be(500m);
        brl.TotalOut.Should().Be(200m);
        brl.ClosingBalance.Should().Be(1300m);
        result.Entries.Should().HaveCount(2);
        result.Entries.Should().BeInAscendingOrder(e => e.OccurredAt);
    }

    [Fact]
    public async Task Same_currency_transfer_inside_group_is_internal_and_excluded_from_totals()
    {
        Wallet(100, RESPONSIBLE, Currency.Brl, GROUP);
        Wallet(200, MEMBER, Currency.Brl, GROUP);
        Post(new DateOnly(2026, 1, 2), TransactionType.ExternalIncome, 1, 100, 1000m, 1000m);
        Post(new DateOnly(2026, 1, 3), TransactionType.Transfer, 100, 200, 100m, 100m);

        var result = await Service().GetGroupStatementAsync(RESPONSIBLE, GROUP, JAN_1, JAN_31);

        var brl = result.Totals.Single();
        brl.TotalIn.Should().Be(1000m);
        brl.TotalOut.Should().Be(0m);
        brl.ClosingBalance.Should().Be(1000m);
        result.Entries.Where(e => e.Type == "Transfer").Should().HaveCount(2).And.OnlyContain(e => e.Internal);
    }

    [Fact]
    public async Task Btc_purchase_inside_scope_counts_as_brl_out_and_btc_in()
    {
        Wallet(100, MEMBER, Currency.Brl);
        Wallet(101, MEMBER, Currency.Btc);
        Post(new DateOnly(2026, 1, 2), TransactionType.ExternalIncome, 1, 100, 1000m, 1000m);
        Post(new DateOnly(2026, 1, 3), TransactionType.BtcPurchase, 100, 101, 1000m, 0.002m, 500_000m);

        var result = await Service().GetUserStatementAsync(MEMBER, MEMBER, JAN_1, JAN_31);

        var brl = result.Totals.Single(t => t.Currency == "BRL");
        var btc = result.Totals.Single(t => t.Currency == "BTC");
        brl.TotalOut.Should().Be(1000m);
        brl.ClosingBalance.Should().Be(0m);
        btc.TotalIn.Should().Be(0.002m);
        btc.ClosingBalance.Should().Be(0.002m);
        result.Entries.Should().OnlyContain(e => !e.Internal);
        foreach (var total in result.Totals)
            total.ClosingBalance.Should().Be(total.OpeningBalance + total.TotalIn - total.TotalOut);
    }

    [Fact]
    public async Task Empty_period_has_opening_equal_to_closing()
    {
        Wallet(100, MEMBER, Currency.Brl);
        Post(new DateOnly(2025, 12, 20), TransactionType.ExternalIncome, 1, 100, 1000m, 1000m);

        var result = await Service().GetWalletStatementAsync(MEMBER, 100, JAN_1, JAN_31);

        result.Entries.Should().BeEmpty();
        result.Totals.Single().ClosingBalance.Should().Be(result.Totals.Single().OpeningBalance);
    }

    [Fact]
    public async Task Start_after_end_is_rejected()
    {
        Wallet(100, MEMBER, Currency.Brl);

        var act = () => Service().GetWalletStatementAsync(MEMBER, 100, JAN_31, JAN_1);

        await act.Should().ThrowAsync<ValidationException>();
    }

    [Fact]
    public async Task Period_longer_than_limit_is_rejected()
    {
        Wallet(100, MEMBER, Currency.Brl);

        var act = () => Service().GetWalletStatementAsync(MEMBER, 100, new DateOnly(2025, 1, 1), new DateOnly(2026, 6, 1));

        await act.Should().ThrowAsync<ValidationException>();
    }

    [Fact]
    public async Task Member_visibility_rules_for_group_statement()
    {
        Wallet(100, RESPONSIBLE, Currency.Brl, GROUP);
        Post(new DateOnly(2026, 1, 2), TransactionType.ExternalIncome, 1, 100, 1000m, 1000m);
        var service = Service();

        _group.StatementVisibility = StatementVisibility.ResponsibleOnly;
        var denied = () => service.GetGroupStatementAsync(MEMBER, GROUP, JAN_1, JAN_31);
        await denied.Should().ThrowAsync<ForbiddenException>();

        _group.StatementVisibility = StatementVisibility.MembersSummary;
        var summary = await service.GetGroupStatementAsync(MEMBER, GROUP, JAN_1, JAN_31);
        summary.DetailLevel.Should().Be("Summary");
        summary.Entries.Should().BeEmpty();
        summary.Totals.Single().TotalIn.Should().Be(1000m);

        _group.StatementVisibility = StatementVisibility.AllMembers;
        var full = await service.GetGroupStatementAsync(MEMBER, GROUP, JAN_1, JAN_31);
        full.DetailLevel.Should().Be("Full");
        full.Entries.Should().NotBeEmpty();
    }

    [Fact]
    public async Task Outsider_cannot_see_group_or_wallet_statement()
    {
        Wallet(100, RESPONSIBLE, Currency.Brl, GROUP);

        var group = () => Service().GetGroupStatementAsync(99, GROUP, JAN_1, JAN_31);
        var wallet = () => Service().GetWalletStatementAsync(99, 100, JAN_1, JAN_31);

        await group.Should().ThrowAsync<ForbiddenException>();
        await wallet.Should().ThrowAsync<ForbiddenException>();
    }

    [Fact]
    public async Task Local_dates_are_interpreted_in_sao_paulo_time()
    {
        // 31/01 23:30 em São Paulo = 01/02 02:30 UTC: ainda pertence a janeiro.
        StatementService.ToUtcStartOfDay(new DateOnly(2026, 2, 1))
            .Should().Be(new DateTime(2026, 2, 1, 3, 0, 0, DateTimeKind.Utc));
        await Task.CompletedTask;
    }
}
