using Finami.Domain.Enums;
using Finami.Domain.Exceptions;
using Finami.DTO.Transactions;
using FluentAssertions;
using Moq;

namespace Finami.Tests.Domain;

/// <summary>Feature 007 (T022): quitação na mesma moeda — parcial, quitar tudo, sem dívida, acima da dívida e estorno.</summary>
public class LedgerServiceSettlementTests
{
    private const long ANA = 7;
    private const long BRUNO = 8;
    private readonly LedgerTestContext _ctx = new();

    public LedgerServiceSettlementTests()
    {
        _ctx.Person(ANA, "Ana");
        _ctx.Person(BRUNO, "Bruno");
        _ctx.ShareFamily(ANA, BRUNO);
        _ctx.Wallet(100, ANA, Currency.Brl, balance: 1000m);
        _ctx.Wallet(200, BRUNO, Currency.Brl, balance: 1000m);
        _ctx.Wallet(201, BRUNO, Currency.Brl);
    }

    /// <summary>Ana empresta a Bruno (Bruno passa a dever).</summary>
    private async Task LendAsync(decimal amount) =>
        await _ctx.CreateService().TransferAsync(ANA, new TransferInfo
            { SourceWalletId = 100, DestinationWalletId = 200, Amount = amount, Kind = "loan" });

    private static TransferInfo Settle(decimal? amount = null, bool settleAll = false, long source = 200) => new()
    {
        SourceWalletId = source, DestinationWalletId = 100, Amount = amount, SettleAll = settleAll, Kind = "settlement"
    };

    [Fact]
    public async Task Partial_settlement_reduces_the_debt()
    {
        await LendAsync(100m);
        var service = _ctx.CreateService();

        var result = await service.TransferAsync(BRUNO, Settle(30m));

        result.TransferKind.Should().Be("settlement");
        result.DebtCurrency.Should().Be("BRL");
        result.DebtAmount.Should().Be(30m);
        result.Type.Should().Be("Transfer");
        _ctx.PairDebt(BRUNO, ANA, Currency.Brl).Should().Be(70m);
        _ctx.Balances[100].Should().Be(930m);
        _ctx.UnitOfWork.Verify(u => u.LockDebtPairAsync(BRUNO, ANA), Times.Once);
    }

    [Fact]
    public async Task Settle_all_sends_and_abates_the_exact_debt()
    {
        await LendAsync(100m);
        var service = _ctx.CreateService();
        await service.TransferAsync(BRUNO, Settle(30m));

        var preview = await service.PreviewTransferAsync(BRUNO, Settle(settleAll: true));
        var result = await service.TransferAsync(BRUNO, Settle(settleAll: true));

        preview.SourceAmount.Should().Be(70m);
        preview.Debt!.Before.Should().Be(70m);
        preview.Debt.After.Should().Be(0m);
        result.SourceAmount.Should().Be(70m);
        result.DebtAmount.Should().Be(70m);
        _ctx.PairDebt(BRUNO, ANA, Currency.Brl).Should().Be(0m);
    }

    [Fact]
    public async Task Settlement_from_another_wallet_of_the_debtor_counts_on_the_same_debt()
    {
        await LendAsync(100m);
        var service = _ctx.CreateService();

        await service.TransferAsync(BRUNO, Settle(40m, source: 201));

        _ctx.PairDebt(BRUNO, ANA, Currency.Brl).Should().Be(60m);
    }

    [Fact]
    public async Task Settlement_without_debt_is_rejected()
    {
        var service = _ctx.CreateService();

        var transfer = () => service.TransferAsync(BRUNO, Settle(10m));
        var preview = () => service.PreviewTransferAsync(BRUNO, Settle(settleAll: true));

        await transfer.Should().ThrowAsync<BusinessRuleException>()
            .WithMessage("Você não tem dívida com Ana nesta moeda.");
        await preview.Should().ThrowAsync<BusinessRuleException>()
            .WithMessage("Você não tem dívida com Ana nesta moeda.");
        _ctx.Inserted.Should().BeEmpty();
    }

    [Fact]
    public async Task Settlement_by_the_creditor_is_rejected_as_no_debt()
    {
        await LendAsync(100m);
        var service = _ctx.CreateService();

        // Ana é a credora: ela não deve nada a Bruno.
        var act = () => service.TransferAsync(ANA, new TransferInfo
            { SourceWalletId = 100, DestinationWalletId = 200, Amount = 10m, Kind = "settlement" });

        await act.Should().ThrowAsync<BusinessRuleException>()
            .WithMessage("Você não tem dívida com Bruno nesta moeda.");
    }

    [Fact]
    public async Task Settlement_above_the_debt_is_rejected_with_the_formatted_debt()
    {
        await LendAsync(100m);
        var service = _ctx.CreateService();
        await service.TransferAsync(BRUNO, Settle(30m));

        var act = () => service.TransferAsync(BRUNO, Settle(80m));

        await act.Should().ThrowAsync<BusinessRuleException>()
            .WithMessage("O valor é maior que a dívida (R$ 70,00).");
        _ctx.Inserted.Should().HaveCount(2);
    }

    [Fact]
    public async Task Debt_in_the_other_currency_does_not_count()
    {
        await LendAsync(100m);
        var service = _ctx.CreateService();

        var act = () => service.TransferAsync(BRUNO, new TransferInfo
        {
            SourceWalletId = 200, DestinationWalletId = 100, Amount = 10m, Kind = "settlement", DebtCurrency = "BTC"
        });

        await act.Should().ThrowAsync<BusinessRuleException>()
            .WithMessage("Você não tem dívida com Ana nesta moeda.");
    }

    [Fact]
    public async Task Settlement_is_revalidated_inside_the_pair_lock()
    {
        await LendAsync(100m);
        var service = _ctx.CreateService();
        // Uma quitação concorrente entra entre a validação e o lock: quando o lock é obtido, a dívida já caiu.
        _ctx.UnitOfWork.Setup(u => u.LockDebtPairAsync(BRUNO, ANA)).Returns(async () =>
        {
            _ctx.UnitOfWork.Setup(u => u.LockDebtPairAsync(BRUNO, ANA)).Returns(Task.CompletedTask);
            await _ctx.CreateService().TransferAsync(BRUNO, Settle(80m, source: 201));
        });

        var act = () => service.TransferAsync(BRUNO, Settle(50m));

        await act.Should().ThrowAsync<BusinessRuleException>()
            .WithMessage("O valor é maior que a dívida (R$ 20,00).");
        _ctx.UnitOfWork.Verify(u => u.RollbackAsync(), Times.AtLeastOnce);
        _ctx.PairDebt(BRUNO, ANA, Currency.Brl).Should().Be(20m);
    }

    [Fact]
    public async Task Reversal_of_a_settlement_returns_the_abated_value_to_the_debt()
    {
        await LendAsync(100m);
        var service = _ctx.CreateService();
        var settlement = await service.TransferAsync(BRUNO, Settle(30m));

        // O estorno sai da carteira de Ana (destino da quitação).
        var reversal = await service.ReverseAsync(ANA, settlement.TransactionId, null);

        reversal.TransferKind.Should().Be("settlement");
        reversal.DebtAmount.Should().Be(30m);
        _ctx.PairDebt(BRUNO, ANA, Currency.Brl).Should().Be(100m);
    }

    [Fact]
    public async Task Preview_of_a_partial_settlement_shows_before_and_after()
    {
        await LendAsync(100m);
        var service = _ctx.CreateService();

        var preview = await service.PreviewTransferAsync(BRUNO, Settle(30m));

        preview.Kind.Should().Be("settlement");
        preview.Quote.Should().BeNull();
        preview.Debt.Should().BeEquivalentTo(new TransferDebtEffect
        {
            Currency = "BRL", Amount = 30m, Before = 100m, After = 70m,
            DebtorUserId = BRUNO, CreditorUserId = ANA, DebtorFirstName = "Bruno", CreditorFirstName = "Ana"
        });
        _ctx.Inserted.Should().HaveCount(1);
    }

    [Fact]
    public async Task Settle_all_with_an_amount_is_a_validation_error()
    {
        var service = _ctx.CreateService();

        var act = () => service.TransferAsync(BRUNO, new TransferInfo
            { SourceWalletId = 200, DestinationWalletId = 100, Amount = 10m, Kind = "settlement", SettleAll = true });

        await act.Should().ThrowAsync<ValidationException>()
            .WithMessage("Informe o valor em bitcoin ou em reais, ou quite tudo.");
    }
}
