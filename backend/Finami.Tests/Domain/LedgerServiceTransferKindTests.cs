using Finami.Domain.Enums;
using Finami.Domain.Exceptions;
using Finami.Domain.Models;
using Finami.DTO.Transactions;
using FluentAssertions;
using Moq;

namespace Finami.Tests.Domain;

/// <summary>Feature 007 (T011): tipo da transferência entre pessoas — empréstimo, pagamento e estorno.</summary>
public class LedgerServiceTransferKindTests
{
    private const long ANA = 7;
    private const long BRUNO = 8;
    private readonly LedgerTestContext _ctx = new();

    public LedgerServiceTransferKindTests()
    {
        _ctx.Person(ANA, "Ana");
        _ctx.Person(BRUNO, "Bruno");
        _ctx.ShareFamily(ANA, BRUNO);
        _ctx.Wallet(100, ANA, Currency.Brl, balance: 500m);
        _ctx.Wallet(101, ANA, Currency.Brl);
        _ctx.Wallet(102, ANA, Currency.Btc);
        _ctx.Wallet(200, BRUNO, Currency.Brl);
    }

    [Fact]
    public async Task Transfer_between_people_without_kind_is_a_loan_with_debt_effect()
    {
        var service = _ctx.CreateService();

        var result = await service.TransferAsync(ANA, new TransferInfo
            { SourceWalletId = 100, DestinationWalletId = 200, Amount = 100m });

        result.TransferKind.Should().Be("loan");
        result.DebtCurrency.Should().Be("BRL");
        result.DebtAmount.Should().Be(100m);
        var tx = _ctx.Inserted.Single();
        tx.TransferKind.Should().Be(TransferKind.Loan);
        tx.DebtCurrency.Should().Be(Currency.Brl);
        tx.DebtAmount.Should().Be(100m);
        _ctx.PairDebt(BRUNO, ANA, Currency.Brl).Should().Be(100m);
        _ctx.UnitOfWork.Verify(u => u.LockDebtPairAsync(ANA, BRUNO), Times.Once);
    }

    [Fact]
    public async Task Payment_moves_money_without_debt_effect_or_pair_lock()
    {
        var service = _ctx.CreateService();

        var result = await service.TransferAsync(ANA, new TransferInfo
            { SourceWalletId = 100, DestinationWalletId = 200, Amount = 50m, Kind = "payment" });

        result.TransferKind.Should().Be("payment");
        result.DebtAmount.Should().BeNull();
        result.DebtCurrency.Should().BeNull();
        var tx = _ctx.Inserted.Single();
        tx.TransferKind.Should().Be(TransferKind.Payment);
        tx.DebtAmount.Should().BeNull();
        _ctx.Balances[200].Should().Be(50m);
        _ctx.PairDebt(BRUNO, ANA, Currency.Brl).Should().Be(0m);
        _ctx.UnitOfWork.Verify(u => u.LockDebtPairAsync(It.IsAny<long>(), It.IsAny<long>()), Times.Never);
    }

    [Theory]
    [InlineData("loan", null, false)]
    [InlineData("payment", null, false)]
    [InlineData("settlement", null, false)]
    [InlineData("settlement", "BRL", false)]
    [InlineData("settlement", null, true)]
    public async Task Kind_fields_between_own_wallets_are_rejected(string kind, string? debtCurrency, bool settleAll)
    {
        var service = _ctx.CreateService();
        var info = new TransferInfo
        {
            SourceWalletId = 100, DestinationWalletId = 101, Kind = kind, DebtCurrency = debtCurrency,
            SettleAll = settleAll, Amount = settleAll ? null : 10m
        };

        var transfer = () => service.TransferAsync(ANA, info);
        var preview = () => service.PreviewTransferAsync(ANA, info);

        await transfer.Should().ThrowAsync<ValidationException>()
            .WithMessage("O tipo só vale para transferência entre pessoas diferentes.");
        await preview.Should().ThrowAsync<ValidationException>()
            .WithMessage("O tipo só vale para transferência entre pessoas diferentes.");
        _ctx.Inserted.Should().BeEmpty();
    }

    [Fact]
    public async Task Own_transfer_and_conversion_have_no_kind_nor_effect()
    {
        _ctx.SetQuote(500_000m);
        var service = _ctx.CreateService();

        var own = await service.TransferAsync(ANA, new TransferInfo
            { SourceWalletId = 100, DestinationWalletId = 101, Amount = 10m });
        var conversion = await service.TransferAsync(ANA, new TransferInfo
            { SourceWalletId = 100, DestinationWalletId = 102, Amount = 100m });
        var preview = await service.PreviewTransferAsync(ANA, new TransferInfo
            { SourceWalletId = 100, DestinationWalletId = 102, Amount = 100m });

        own.TransferKind.Should().BeNull();
        conversion.TransferKind.Should().BeNull();
        conversion.Type.Should().Be("BtcPurchase");
        _ctx.Inserted.Should().OnlyContain(t => t.TransferKind == null && t.DebtAmount == null && t.DebtCurrency == null);
        preview.Kind.Should().BeNull();
        preview.Debt.Should().BeNull();
        _ctx.UnitOfWork.Verify(u => u.LockDebtPairAsync(It.IsAny<long>(), It.IsAny<long>()), Times.Never);
    }

    [Fact]
    public async Task Reversal_of_a_loan_copies_the_effect_inverted_and_undoes_the_debt()
    {
        var service = _ctx.CreateService();
        var loan = await service.TransferAsync(ANA, new TransferInfo
            { SourceWalletId = 100, DestinationWalletId = 200, Amount = 100m, Kind = "loan" });

        // Ana controla só a carteira dela; o estorno sai da carteira de Bruno, então quem estorna é Bruno.
        var reversal = await service.ReverseAsync(BRUNO, loan.TransactionId, null);

        reversal.TransferKind.Should().Be("loan");
        reversal.DebtAmount.Should().Be(100m);
        reversal.DebtCurrency.Should().Be("BRL");
        var tx = _ctx.Inserted.Last();
        tx.SourceAccountId.Should().Be(200);
        tx.DestinationAccountId.Should().Be(100);
        _ctx.PairDebt(BRUNO, ANA, Currency.Brl).Should().Be(0m);
        _ctx.UnitOfWork.Verify(u => u.LockDebtPairAsync(BRUNO, ANA), Times.Once);
    }

    [Fact]
    public async Task Reversal_of_a_payment_has_no_effect()
    {
        var service = _ctx.CreateService();
        var payment = await service.TransferAsync(ANA, new TransferInfo
            { SourceWalletId = 100, DestinationWalletId = 200, Amount = 30m, Kind = "payment" });

        var reversal = await service.ReverseAsync(BRUNO, payment.TransactionId, null);

        reversal.TransferKind.Should().Be("payment");
        reversal.DebtAmount.Should().BeNull();
    }

    [Fact]
    public async Task Preview_of_a_loan_returns_kind_and_debt_before_and_after()
    {
        var service = _ctx.CreateService();
        await service.TransferAsync(ANA, new TransferInfo
            { SourceWalletId = 100, DestinationWalletId = 200, Amount = 30m, Kind = "loan" });

        var preview = await service.PreviewTransferAsync(ANA, new TransferInfo
            { SourceWalletId = 100, DestinationWalletId = 200, Amount = 100m, Kind = "loan" });

        preview.Kind.Should().Be("loan");
        preview.Debt.Should().BeEquivalentTo(new TransferDebtEffect
        {
            Currency = "BRL", Amount = 100m, Before = 30m, After = 130m,
            DebtorUserId = BRUNO, CreditorUserId = ANA, DebtorFirstName = "Bruno", CreditorFirstName = "Ana"
        });
        _ctx.Inserted.Should().HaveCount(1);
    }

    [Fact]
    public async Task Preview_of_a_payment_has_kind_and_no_debt()
    {
        var service = _ctx.CreateService();

        var preview = await service.PreviewTransferAsync(ANA, new TransferInfo
            { SourceWalletId = 100, DestinationWalletId = 200, Amount = 100m, Kind = "payment" });

        preview.Kind.Should().Be("payment");
        preview.Debt.Should().BeNull();
    }

    [Theory]
    [InlineData("doacao", "Tipo de transferência inválido.")]
    [InlineData("LOANS", "Tipo de transferência inválido.")]
    public async Task Invalid_kind_is_a_validation_error(string kind, string message)
    {
        var service = _ctx.CreateService();

        var act = () => service.TransferAsync(ANA, new TransferInfo
            { SourceWalletId = 100, DestinationWalletId = 200, Amount = 10m, Kind = kind });

        await act.Should().ThrowAsync<ValidationException>().WithMessage(message);
    }

    [Fact]
    public async Task Settlement_fields_without_settlement_are_a_validation_error()
    {
        var service = _ctx.CreateService();

        var act = () => service.TransferAsync(ANA, new TransferInfo
            { SourceWalletId = 100, DestinationWalletId = 200, Amount = 10m, Kind = "loan", DebtCurrency = "BRL" });

        await act.Should().ThrowAsync<ValidationException>()
            .WithMessage("Moeda da dívida e quitar tudo só valem para quitação.");
    }

    [Fact]
    public void Reversal_of_transfer_with_quote_but_same_currency_is_not_a_conversion()
    {
        Transaction Reversal(params Currency[] currencies) => new()
        {
            Type = TransactionType.Reversal, QuotePriceBrl = 500_000m, SourceAmount = 0.0002m,
            DestinationAmount = 0.0002m,
            Entries = currencies.Select(c => new LedgerEntry { Currency = c }).ToList()
        };

        Reversal(Currency.Btc, Currency.Btc).IsConversion.Should().BeFalse();
        Reversal(Currency.Btc, Currency.Btc, Currency.Brl, Currency.Brl).IsConversion.Should().BeTrue();
        // Sem os lançamentos carregados: mesma moeda movimenta o mesmo valor dos dois lados.
        Reversal().IsConversion.Should().BeFalse();
        new Transaction { Type = TransactionType.Reversal, QuotePriceBrl = 500_000m, SourceAmount = 0.002m, DestinationAmount = 1000m }
            .IsConversion.Should().BeTrue();
        new Transaction { Type = TransactionType.BtcPurchase }.IsConversion.Should().BeTrue();
        new Transaction { Type = TransactionType.Transfer, QuotePriceBrl = 500_000m }.IsConversion.Should().BeFalse();
    }
}
