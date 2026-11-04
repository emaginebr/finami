using Finami.Domain.Enums;
using Finami.Domain.Exceptions;
using Finami.Domain.Services;
using Finami.DTO.Transactions;
using FluentAssertions;
using Moq;

namespace Finami.Tests.Domain;

/// <summary>
/// Feature 008 (T013, US1): o responsável estorna todos os tipos de lançamento; o estorno inverte os valores, copia a
/// cotação (sem nova consulta) e o efeito na dívida, e <see cref="TransactionInfo.CanReverse"/> é calculado para quem
/// consulta.
/// </summary>
public class LedgerServiceReversalAllTypesTests
{
    private const long ANA = 1;   // responsável
    private const long BRUNO = 2; // membro
    private const long SILVA = 10;
    private const decimal PRICE = 500_000m;

    private readonly LedgerTestContext _ctx = new();
    private readonly LedgerService _service;

    public LedgerServiceReversalAllTypesTests()
    {
        _ctx.Person(ANA, "Ana");
        _ctx.Person(BRUNO, "Bruno");
        _ctx.Family(SILVA, "Silva", ANA, BRUNO);
        _ctx.FamilyWallet(100, ANA, SILVA, Currency.Brl, balance: 5000m);
        _ctx.FamilyWallet(101, ANA, SILVA, Currency.Brl);
        _ctx.FamilyWallet(102, ANA, SILVA, Currency.Btc, balance: 0.01m);
        _ctx.FamilyWallet(200, BRUNO, SILVA, Currency.Brl, balance: 300m);
        _ctx.SetQuote(PRICE);
        _service = _ctx.CreateServiceWithRealPolicy();
    }

    private async Task AssertReversedAsync(TransactionInfo original)
    {
        var balances = new Dictionary<long, decimal>(_ctx.Balances);
        var originalTx = _ctx.Inserted.Single(t => t.TransactionId == original.TransactionId);
        // Saldos antes do original: desfaz os lançamentos dele.
        foreach (var entry in originalTx.Entries)
            balances[entry.AccountId] -= entry.Amount;

        var reversal = await _service.ReverseAsync(ANA, original.TransactionId, null);

        reversal.Type.Should().Be("Reversal");
        reversal.ReversedTransactionId.Should().Be(original.TransactionId);
        reversal.Source.AccountId.Should().Be(original.Destination.AccountId);
        reversal.Destination.AccountId.Should().Be(original.Source.AccountId);
        reversal.SourceAmount.Should().Be(original.DestinationAmount);
        reversal.DestinationAmount.Should().Be(original.SourceAmount);
        reversal.Quote?.PriceBrl.Should().Be(original.Quote?.PriceBrl);
        reversal.TransferKind.Should().Be(original.TransferKind);
        reversal.DebtCurrency.Should().Be(original.DebtCurrency);
        reversal.DebtAmount.Should().Be(original.DebtAmount);
        reversal.CanReverse.Should().BeFalse("um estorno não pode ser estornado");

        foreach (var (accountId, balance) in balances)
            _ctx.Balances.GetValueOrDefault(accountId).Should().Be(balance, $"saldo da conta {accountId}");

        var after = await _service.GetAsync(ANA, original.TransactionId);
        after.ReversedByTransactionId.Should().Be(reversal.TransactionId);
        after.CanReverse.Should().BeFalse("já foi estornado");
    }

    [Fact]
    public async Task Income_is_reversed()
    {
        var income = await _service.IncomeAsync(ANA, new IncomeInfo { WalletId = 100, Amount = 250m });
        income.CanReverse.Should().BeTrue();

        await AssertReversedAsync(income);
    }

    [Fact]
    public async Task Expense_is_reversed()
    {
        await AssertReversedAsync(await _service.ExpenseAsync(ANA, new ExpenseInfo { WalletId = 100, Amount = 80m }));
    }

    [Fact]
    public async Task Transfer_between_wallets_of_the_same_person_is_reversed()
    {
        await AssertReversedAsync(await _service.TransferAsync(ANA, new TransferInfo
            { SourceWalletId = 100, DestinationWalletId = 101, Amount = 120m }));
    }

    [Fact]
    public async Task Btc_purchase_and_sale_are_reversed_without_a_new_quote()
    {
        var purchase = await _service.TransferAsync(ANA, new TransferInfo
            { SourceWalletId = 100, DestinationWalletId = 102, Amount = 1000m });
        var sale = await _service.TransferAsync(ANA, new TransferInfo
            { SourceWalletId = 102, DestinationWalletId = 101, Amount = 0.001m });
        purchase.Type.Should().Be("BtcPurchase");
        sale.Type.Should().Be("BtcSale");

        await AssertReversedAsync(purchase);
        await AssertReversedAsync(sale);

        _ctx.Quotes.Verify(q => q.GetForConversionAsync(), Times.Exactly(2), "só as conversões consultam a cotação");
    }

    [Theory]
    [InlineData("loan")]
    [InlineData("payment")]
    public async Task Loan_and_payment_are_reversed(string kind)
    {
        var transfer = await _service.TransferAsync(ANA, new TransferInfo
            { SourceWalletId = 100, DestinationWalletId = 200, Amount = 100m, Kind = kind });

        await AssertReversedAsync(transfer);

        _ctx.PairDebt(BRUNO, ANA, Currency.Brl).Should().Be(0m);
    }

    [Fact]
    public async Task Settlement_is_reversed_and_the_debt_comes_back()
    {
        await _service.TransferAsync(ANA, new TransferInfo
            { SourceWalletId = 100, DestinationWalletId = 200, Amount = 100m, Kind = "loan" });
        var settlement = await _service.TransferAsync(BRUNO, new TransferInfo
            { SourceWalletId = 200, DestinationWalletId = 100, Amount = 40m, Kind = "settlement" });
        _ctx.PairDebt(BRUNO, ANA, Currency.Brl).Should().Be(60m);

        await AssertReversedAsync(settlement);

        _ctx.PairDebt(BRUNO, ANA, Currency.Brl).Should().Be(100m);
    }

    [Fact]
    public async Task Reversing_a_reversal_or_twice_is_refused()
    {
        var income = await _service.IncomeAsync(ANA, new IncomeInfo { WalletId = 100, Amount = 10m });
        var reversal = await _service.ReverseAsync(ANA, income.TransactionId, null);

        var again = () => _service.ReverseAsync(ANA, income.TransactionId, null);
        var ofReversal = () => _service.ReverseAsync(ANA, reversal.TransactionId, null);

        await again.Should().ThrowAsync<ConflictException>().WithMessage("Esta transação já foi estornada.");
        await ofReversal.Should().ThrowAsync<BusinessRuleException>().WithMessage("Um estorno não pode ser estornado.");
    }

    [Fact]
    public async Task Can_reverse_is_computed_for_the_viewer()
    {
        var expense = await _service.ExpenseAsync(BRUNO, new ExpenseInfo { WalletId = 200, Amount = 10m });

        expense.CanReverse.Should().BeFalse("Bruno não tem \"Pode estornar\" (padrão desligada)");
        (await _service.GetAsync(ANA, expense.TransactionId)).CanReverse.Should().BeTrue("Ana é a responsável");
    }
}
