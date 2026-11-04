using Finami.Domain.Enums;
using Finami.Domain.Exceptions;
using Finami.Domain.Interfaces;
using Finami.Domain.Models;
using Finami.Domain.Services;
using Finami.DTO.Debts;
using Finami.Infra.Context;
using Finami.Infra.Repository;
using FluentAssertions;
using Microsoft.EntityFrameworkCore;
using Moq;

namespace Finami.Tests.Domain;

/// <summary>
/// Feature 006 (T009) e 007 (T034): dívidas entre pessoas derivadas dos efeitos na dívida (empréstimo − quitação). Usa o <see cref="TransactionRepository"/> real
/// sobre EF InMemory, então os cenários cobrem também a consulta agrupada.
/// </summary>
public class DebtServiceTests : IDisposable
{
    private const long ANA = 1;
    private const long BRUNO = 2;
    private const long CAIO = 3;      // dependente de Ana
    private const long CARLA = 4;     // sem permissão de ver Ana
    private const long ZECA = 5;

    private readonly FinamiContext _context;
    private readonly Mock<IAccessPolicy> _policy = new();
    private readonly HashSet<(long Viewer, long Target)> _hidden = new();
    private long _nextAccountId = 1000;

    public DebtServiceTests()
    {
        _context = new FinamiContext(new DbContextOptionsBuilder<FinamiContext>()
            .UseInMemoryDatabase($"debts-{Guid.NewGuid():N}").Options);
        AddUser(ANA, "Ana", "Silva");
        AddUser(BRUNO, "Bruno", "Souza");
        AddUser(CAIO, "Caio", "Silva");
        AddUser(CARLA, "Carla", "Lima");
        AddUser(ZECA, "Zeca", "Alves");
        _context.SaveChanges();

        _policy.Setup(p => p.CanViewUserAsync(It.IsAny<long>(), It.IsAny<User>()))
            .ReturnsAsync((long viewer, User target) => !_hidden.Contains((viewer, target.UserId)));
    }

    public void Dispose() => _context.Dispose();

    private DebtService Service() =>
        new(new TransactionRepository(_context), new UserRepository(_context), _policy.Object);

    private void AddUser(long id, string first, string last) =>
        _context.Users.Add(new User { UserId = id, FirstName = first, LastName = last });

    private Account Wallet(long owner, Currency currency = Currency.Brl)
    {
        var wallet = new Account
        {
            AccountId = _nextAccountId++, Kind = AccountKind.Wallet, UserId = owner, Currency = currency,
            Name = $"Carteira {owner}"
        };
        _context.Accounts.Add(wallet);
        _context.SaveChanges();
        return wallet;
    }

    private Account SystemAccount(AccountKind kind, Currency currency)
    {
        var account = new Account { AccountId = _nextAccountId++, Kind = kind, Currency = currency, Name = kind.ToString() };
        _context.Accounts.Add(account);
        _context.SaveChanges();
        return account;
    }

    private Transaction Post(TransactionType type, Account source, Account destination, decimal amount,
        decimal? destinationAmount = null, long? createdBy = null, long? reverses = null,
        TransferKind? kind = null, Currency? debtCurrency = null, decimal? debtAmount = null)
    {
        var transaction = new Transaction
        {
            Type = type,
            SourceAccountId = source.AccountId,
            DestinationAccountId = destination.AccountId,
            SourceAmount = amount,
            DestinationAmount = destinationAmount ?? amount,
            CreatedByUserId = createdBy ?? source.UserId ?? ANA,
            ReversedTransactionId = reverses,
            TransferKind = kind,
            DebtCurrency = debtCurrency,
            DebtAmount = debtAmount
        };
        _context.Transactions.Add(transaction);
        _context.SaveChanges();
        return transaction;
    }

    /// <summary>Empréstimo como o LedgerService grava (e como a migration marca as transferências antigas).</summary>
    private Transaction Transfer(Account source, Account destination, decimal amount, long? createdBy = null) =>
        Post(TransactionType.Transfer, source, destination, amount, createdBy: createdBy,
            kind: TransferKind.Loan, debtCurrency: source.Currency, debtAmount: amount);

    private Transaction Payment(Account source, Account destination, decimal amount) =>
        Post(TransactionType.Transfer, source, destination, amount, kind: TransferKind.Payment);

    /// <summary>Quitação: abate <paramref name="abated"/> (moeda da dívida) da dívida da origem com o destino.</summary>
    private Transaction Settlement(Account source, Account destination, decimal sent, Currency debtCurrency, decimal abated) =>
        Post(TransactionType.Transfer, source, destination, sent,
            kind: TransferKind.Settlement, debtCurrency: debtCurrency, debtAmount: abated);

    /// <summary>Estorno como o LedgerService grava: sai do destino original, volta para a origem e copia o efeito.</summary>
    private void Reverse(Transaction original, Account originalSource, Account originalDestination) =>
        Post(TransactionType.Reversal, originalDestination, originalSource, original.DestinationAmount,
            original.SourceAmount, reverses: original.TransactionId, kind: original.TransferKind,
            debtCurrency: original.DebtCurrency, debtAmount: original.DebtAmount);

    private static PersonDebtInfo Single(PersonDebtsResult result) => result.Debts.Should().ContainSingle().Subject;

    [Fact]
    public async Task Transfer_creates_debt_of_receiver_with_sender()
    {
        var ana = Wallet(ANA);
        var bruno = Wallet(BRUNO);
        Transfer(ana, bruno, 100m);

        var forBruno = Single(await Service().GetPersonDebtsAsync(BRUNO, BRUNO));
        forBruno.CounterpartUserId.Should().Be(ANA);
        forBruno.CounterpartName.Should().Be("Ana Silva");
        forBruno.CounterpartFirstName.Should().Be("Ana");
        forBruno.Currency.Should().Be("BRL");
        forBruno.Amount.Should().Be(100m);
        forBruno.Direction.Should().Be(DebtDirections.OWES);

        var forAna = Single(await Service().GetPersonDebtsAsync(ANA, ANA));
        forAna.CounterpartUserId.Should().Be(BRUNO);
        forAna.Amount.Should().Be(100m);
        forAna.Direction.Should().Be(DebtDirections.OWED);
    }

    [Fact]
    public async Task Opposite_transfer_offsets_and_can_switch_direction()
    {
        var ana = Wallet(ANA);
        var bruno = Wallet(BRUNO);
        Transfer(ana, bruno, 100m);
        Transfer(bruno, ana, 30m);

        Single(await Service().GetPersonDebtsAsync(ANA, BRUNO)).Amount.Should().Be(70m);

        Transfer(bruno, ana, 100m);

        var debt = Single(await Service().GetPersonDebtsAsync(ANA, BRUNO));
        debt.Amount.Should().Be(30m);
        debt.Direction.Should().Be(DebtDirections.OWED, "agora Ana deve a Bruno");
    }

    [Fact]
    public async Task Settled_pair_does_not_appear()
    {
        var ana = Wallet(ANA);
        var bruno = Wallet(BRUNO);
        Transfer(ana, bruno, 100m);
        Transfer(bruno, ana, 100m);

        (await Service().GetPersonDebtsAsync(ANA, ANA)).Debts.Should().BeEmpty();
    }

    [Fact]
    public async Task Reversal_undoes_the_debt_even_after_direction_changed()
    {
        var ana = Wallet(ANA);
        var bruno = Wallet(BRUNO);
        var first = Transfer(ana, bruno, 100m);
        Transfer(bruno, ana, 150m); // Ana deve 50

        Reverse(first, ana, bruno);  // desfaz os 100 de Ana → Bruno: Ana deve 150

        var debt = Single(await Service().GetPersonDebtsAsync(ANA, ANA));
        debt.Amount.Should().Be(150m);
        debt.Direction.Should().Be(DebtDirections.OWES);
    }

    [Fact]
    public async Task Own_wallets_income_expense_and_conversions_do_not_create_debt()
    {
        var anaBrl = Wallet(ANA);
        var anaSavings = Wallet(ANA);
        var anaBtc = Wallet(ANA, Currency.Btc);
        var brunoBtc = Wallet(BRUNO, Currency.Btc);
        Transfer(anaBrl, anaSavings, 50m);
        Post(TransactionType.ExternalIncome, SystemAccount(AccountKind.ExternalSource, Currency.Brl), anaBrl, 1000m);
        Post(TransactionType.ExternalExpense, anaBrl, SystemAccount(AccountKind.ExternalSink, Currency.Brl), 10m);
        Post(TransactionType.BtcPurchase, anaBrl, anaBtc, 500m, 0.001m);
        // Conversão antiga entre pessoas (antes da feature): moedas diferentes ficam fora.
        Post(TransactionType.BtcPurchase, anaBrl, brunoBtc, 500m, 0.001m);

        (await Service().GetPersonDebtsAsync(ANA, ANA)).Debts.Should().BeEmpty();
    }

    [Fact]
    public async Task Responsible_posting_for_dependent_creates_debt_between_owners()
    {
        var caio = Wallet(CAIO);
        var bruno = Wallet(BRUNO);
        Transfer(caio, bruno, 40m, createdBy: ANA);

        var forBruno = Single(await Service().GetPersonDebtsAsync(BRUNO, BRUNO));
        forBruno.CounterpartUserId.Should().Be(CAIO);
        forBruno.Direction.Should().Be(DebtDirections.OWES);
        (await Service().GetPersonDebtsAsync(ANA, ANA)).Debts.Should().BeEmpty();
    }

    [Fact]
    public async Task Brl_and_btc_are_separate_and_ordered_by_name_then_brl_first()
    {
        var anaBrl = Wallet(ANA);
        var anaBtc = Wallet(ANA, Currency.Btc);
        var brunoBrl = Wallet(BRUNO);
        var brunoBtc = Wallet(BRUNO, Currency.Btc);
        var zecaBrl = Wallet(ZECA);
        Transfer(zecaBrl, anaBrl, 5m);
        Transfer(brunoBtc, anaBtc, 0.0004m);
        Transfer(anaBrl, brunoBrl, 70m);

        var debts = (await Service().GetPersonDebtsAsync(ANA, ANA)).Debts;

        debts.Select(d => (d.CounterpartFirstName, d.Currency, d.Amount, d.Direction)).Should().Equal(
            ("Bruno", "BRL", 70m, DebtDirections.OWED),
            ("Bruno", "BTC", 0.0004m, DebtDirections.OWES),
            ("Zeca", "BRL", 5m, DebtDirections.OWES));
    }

    [Fact]
    public async Task Person_that_cannot_be_viewed_is_not_found()
    {
        var ana = Wallet(ANA);
        Transfer(ana, Wallet(BRUNO), 10m);
        _hidden.Add((CARLA, ANA));

        var hidden = () => Service().GetPersonDebtsAsync(CARLA, ANA);
        var missing = () => Service().GetPersonDebtsAsync(ANA, 999);

        await hidden.Should().ThrowAsync<NotFoundException>();
        await missing.Should().ThrowAsync<NotFoundException>();
    }

    // ---------------- Feature 007 (T034): empréstimo − quitação; pagamento ignorado ----------------

    [Fact]
    public async Task Payments_do_not_count_and_settlements_reduce_the_debt()
    {
        var ana = Wallet(ANA);
        var bruno = Wallet(BRUNO);
        Transfer(ana, bruno, 100m);
        Payment(ana, bruno, 50m);
        Settlement(bruno, ana, 30m, Currency.Brl, 30m);

        var debt = Single(await Service().GetPersonDebtsAsync(BRUNO, BRUNO));
        debt.Amount.Should().Be(70m);
        debt.Direction.Should().Be(DebtDirections.OWES);
        debt.CounterpartUserId.Should().Be(ANA);
    }

    [Fact]
    public async Task Only_payments_leave_no_debt()
    {
        var ana = Wallet(ANA);
        var bruno = Wallet(BRUNO);
        Payment(ana, bruno, 50m);
        Payment(bruno, ana, 10m);

        (await Service().GetPersonDebtsAsync(ANA, ANA)).Debts.Should().BeEmpty();
    }

    [Fact]
    public async Task Settlement_in_the_other_currency_counts_on_the_debt_currency()
    {
        var anaBrl = Wallet(ANA);
        var anaBtc = Wallet(ANA, Currency.Btc);
        var brunoBrl = Wallet(BRUNO);
        var brunoBtc = Wallet(BRUNO, Currency.Btc);
        Transfer(anaBrl, brunoBrl, 100m);
        // Bruno paga ₿ 0,0001 (R$ 50,00 pela cotação) para quitar a dívida em real.
        Settlement(brunoBtc, anaBtc, 0.0001m, Currency.Brl, 50m);

        var debt = Single(await Service().GetPersonDebtsAsync(BRUNO, BRUNO));
        debt.Currency.Should().Be("BRL");
        debt.Amount.Should().Be(50m);
    }

    [Fact]
    public async Task Reversal_of_a_settlement_restores_the_debt()
    {
        var ana = Wallet(ANA);
        var bruno = Wallet(BRUNO);
        Transfer(ana, bruno, 100m);
        var settlement = Settlement(bruno, ana, 100m, Currency.Brl, 100m);
        (await Service().GetPersonDebtsAsync(BRUNO, BRUNO)).Debts.Should().BeEmpty();

        Reverse(settlement, bruno, ana);

        Single(await Service().GetPersonDebtsAsync(BRUNO, BRUNO)).Amount.Should().Be(100m);
    }
}
