using Finami.Domain.Enums;
using Finami.Domain.Exceptions;
using Finami.DTO.Transactions;
using FluentAssertions;
using Moq;

namespace Finami.Tests.Domain;

/// <summary>Feature 007 (T029): quitação em outra moeda pela cotação atual (tabela de R-04).</summary>
public class LedgerServiceSettlementConversionTests
{
    private const long ANA = 7;
    private const long BRUNO = 8;
    private const long ANA_BRL = 100;
    private const long ANA_BTC = 101;
    private const long BRUNO_BRL = 200;
    private const long BRUNO_BTC = 201;
    private readonly LedgerTestContext _ctx = new();

    public LedgerServiceSettlementConversionTests()
    {
        _ctx.Person(ANA, "Ana");
        _ctx.Person(BRUNO, "Bruno");
        _ctx.ShareFamily(ANA, BRUNO);
        _ctx.Wallet(ANA_BRL, ANA, Currency.Brl, balance: 1000m);
        _ctx.Wallet(ANA_BTC, ANA, Currency.Btc, balance: 1m);
        _ctx.Wallet(BRUNO_BRL, BRUNO, Currency.Brl, balance: 1000m);
        _ctx.Wallet(BRUNO_BTC, BRUNO, Currency.Btc, balance: 1m);
    }

    private async Task LendBrlAsync(decimal amount) =>
        await _ctx.CreateService().TransferAsync(ANA, new TransferInfo
            { SourceWalletId = ANA_BRL, DestinationWalletId = BRUNO_BRL, Amount = amount, Kind = "loan" });

    private async Task LendBtcAsync(decimal amount) =>
        await _ctx.CreateService().TransferAsync(ANA, new TransferInfo
            { SourceWalletId = ANA_BTC, DestinationWalletId = BRUNO_BTC, Amount = amount, Kind = "loan" });

    /// <summary>Dívida em real quitada com bitcoin (carteira BTC de Bruno → carteira BTC de Ana).</summary>
    private static TransferInfo BrlDebtPaidInBtc(decimal? amount = null, bool settleAll = false) => new()
    {
        SourceWalletId = BRUNO_BTC, DestinationWalletId = ANA_BTC, Amount = amount, SettleAll = settleAll,
        Kind = "settlement", DebtCurrency = "BRL"
    };

    /// <summary>Dívida em bitcoin quitada com real (carteira BRL de Bruno → carteira BRL de Ana).</summary>
    private static TransferInfo BtcDebtPaidInBrl(decimal? amount = null, bool settleAll = false) => new()
    {
        SourceWalletId = BRUNO_BRL, DestinationWalletId = ANA_BRL, Amount = amount, SettleAll = settleAll,
        Kind = "settlement", DebtCurrency = "BTC"
    };

    [Fact]
    public async Task Brl_debt_paid_in_btc_abates_truncated_reais()
    {
        await LendBrlAsync(100m);
        _ctx.SetQuote(500_000m);
        var service = _ctx.CreateService();

        var result = await service.TransferAsync(BRUNO, BrlDebtPaidInBtc(0.0001m));

        result.SourceAmount.Should().Be(0.0001m);
        result.DebtCurrency.Should().Be("BRL");
        result.DebtAmount.Should().Be(50m);
        _ctx.PairDebt(BRUNO, ANA, Currency.Brl).Should().Be(50m);
        _ctx.Balances[ANA_BTC].Should().Be(1.0001m);
    }

    [Fact]
    public async Task Brl_abatement_is_truncated_never_rounded_up()
    {
        await LendBrlAsync(100m);
        _ctx.SetQuote(333_333.33m);
        var service = _ctx.CreateService();

        // 0,00012345 × 333.333,33 = 41,1499999... → R$ 41,14
        var result = await service.TransferAsync(BRUNO, BrlDebtPaidInBtc(0.00012345m));

        result.DebtAmount.Should().Be(41.14m);
    }

    [Fact]
    public async Task Btc_debt_paid_in_brl_abates_truncated_bitcoin()
    {
        await LendBtcAsync(0.001m);
        _ctx.SetQuote(500_000m);
        var service = _ctx.CreateService();

        var preview = await service.PreviewTransferAsync(BRUNO, BtcDebtPaidInBrl(250m));
        var result = await service.TransferAsync(BRUNO, BtcDebtPaidInBrl(250m));

        preview.SourceAmount.Should().Be(250m);
        preview.Debt!.Amount.Should().Be(0.0005m);
        preview.Debt.Currency.Should().Be("BTC");
        preview.Quote!.PriceBrl.Should().Be(500_000m);
        result.DebtAmount.Should().Be(0.0005m);
        _ctx.PairDebt(BRUNO, ANA, Currency.Btc).Should().Be(0.0005m);
    }

    [Fact]
    public async Task Settle_all_brl_debt_in_btc_rounds_sent_up_and_zeroes_the_debt()
    {
        await LendBrlAsync(70m);
        _ctx.SetQuote(300_000m); // 70 / 300.000 = 0,000233333... → ₿ 0,00023334
        var service = _ctx.CreateService();

        var preview = await service.PreviewTransferAsync(BRUNO, BrlDebtPaidInBtc(settleAll: true));
        var result = await service.TransferAsync(BRUNO, BrlDebtPaidInBtc(settleAll: true));

        preview.SourceAmount.Should().Be(0.00023334m);
        preview.Debt!.Amount.Should().Be(70m);
        preview.Debt.Before.Should().Be(70m);
        preview.Debt.After.Should().Be(0m);
        result.SourceAmount.Should().Be(0.00023334m);
        result.DebtAmount.Should().Be(70m);
        _ctx.PairDebt(BRUNO, ANA, Currency.Brl).Should().Be(0m);
    }

    [Fact]
    public async Task Settle_all_btc_debt_in_brl_rounds_sent_up_to_the_cent()
    {
        await LendBtcAsync(0.001m);
        _ctx.SetQuote(333_333.33m); // 0,001 × 333.333,33 = 333,33333 → R$ 333,34
        var service = _ctx.CreateService();

        var result = await service.TransferAsync(BRUNO, BtcDebtPaidInBrl(settleAll: true));

        result.SourceAmount.Should().Be(333.34m);
        result.DebtAmount.Should().Be(0.001m);
        _ctx.PairDebt(BRUNO, ANA, Currency.Btc).Should().Be(0m);
    }

    [Fact]
    public async Task Abatement_converted_to_zero_is_rejected()
    {
        await LendBrlAsync(100m);
        _ctx.SetQuote(500_000m); // ₿ 0,00000001 = R$ 0,005 → R$ 0,00
        var service = _ctx.CreateService();

        var act = () => service.TransferAsync(BRUNO, BrlDebtPaidInBtc(0.00000001m));

        await act.Should().ThrowAsync<BusinessRuleException>().WithMessage("Valor pequeno demais para conversão.");
    }

    [Fact]
    public async Task Abatement_above_the_debt_after_conversion_is_rejected()
    {
        await LendBrlAsync(100m);
        _ctx.SetQuote(500_000m);
        var service = _ctx.CreateService();

        var act = () => service.TransferAsync(BRUNO, BrlDebtPaidInBtc(0.0003m)); // R$ 150,00

        await act.Should().ThrowAsync<BusinessRuleException>().WithMessage("O valor é maior que a dívida (R$ 100,00).");
    }

    [Fact]
    public async Task Btc_debt_above_message_uses_bitcoin_format()
    {
        await LendBtcAsync(0.001m);
        _ctx.SetQuote(500_000m);
        var service = _ctx.CreateService();

        var act = () => service.TransferAsync(BRUNO, BtcDebtPaidInBrl(600m)); // ₿ 0,0012

        await act.Should().ThrowAsync<BusinessRuleException>().WithMessage("O valor é maior que a dívida (₿ 0,00100000).");
    }

    [Fact]
    public async Task Quote_is_recorded_and_accounting_type_stays_transfer_with_two_entries()
    {
        await LendBrlAsync(100m);
        _ctx.SetQuote(500_000m);
        var service = _ctx.CreateService();

        var result = await service.TransferAsync(BRUNO, BrlDebtPaidInBtc(0.0001m));

        result.Type.Should().Be("Transfer");
        result.Quote!.PriceBrl.Should().Be(500_000m);
        var tx = _ctx.Inserted.Last();
        tx.BtcQuoteId.Should().Be(99);
        tx.QuotePriceBrl.Should().Be(500_000m);
        tx.Entries.Should().HaveCount(2).And.OnlyContain(e => e.Currency == Currency.Btc);
        tx.IsConversion.Should().BeFalse();
    }

    [Fact]
    public async Task Reversal_returns_the_recorded_abatement_without_a_new_quote_and_is_not_a_conversion()
    {
        await LendBrlAsync(100m);
        _ctx.SetQuote(500_000m);
        var service = _ctx.CreateService();
        var settlement = await service.TransferAsync(BRUNO, BrlDebtPaidInBtc(settleAll: true));
        _ctx.SetQuote(900_000m);

        var reversal = await service.ReverseAsync(ANA, settlement.TransactionId, null);

        reversal.Type.Should().Be("Reversal");
        reversal.DebtAmount.Should().Be(100m);
        reversal.DebtCurrency.Should().Be("BRL");
        reversal.Quote!.PriceBrl.Should().Be(500_000m);
        _ctx.PairDebt(BRUNO, ANA, Currency.Brl).Should().Be(100m);
        var tx = _ctx.Inserted.Last();
        tx.Entries.Should().HaveCount(2);
        tx.IsConversion.Should().BeFalse();
    }

    [Fact]
    public async Task Amount_in_brl_can_settle_a_btc_debt()
    {
        await LendBtcAsync(0.001m);
        _ctx.SetQuote(500_000m);
        var service = _ctx.CreateService();

        var result = await service.TransferAsync(BRUNO, new TransferInfo
        {
            SourceWalletId = BRUNO_BTC, DestinationWalletId = ANA_BTC, AmountBrl = 250m, Kind = "settlement"
        });

        result.SourceAmount.Should().Be(0.0005m);
        result.DebtCurrency.Should().Be("BTC");
        result.DebtAmount.Should().Be(0.0005m);
        result.Quote!.PriceBrl.Should().Be(500_000m);
        _ctx.PairDebt(BRUNO, ANA, Currency.Btc).Should().Be(0.0005m);
    }

    [Fact]
    public async Task Unavailable_quote_blocks_settlement_in_the_other_currency_only()
    {
        await LendBrlAsync(100m);
        _ctx.Quotes.Setup(q => q.GetForConversionAsync()).ThrowsAsync(new QuoteUnavailableException());
        var service = _ctx.CreateService();

        var other = () => service.PreviewTransferAsync(BRUNO, BrlDebtPaidInBtc(0.0001m));
        await other.Should().ThrowAsync<QuoteUnavailableException>();

        var same = await service.TransferAsync(BRUNO, new TransferInfo
            { SourceWalletId = BRUNO_BRL, DestinationWalletId = ANA_BRL, Amount = 10m, Kind = "settlement" });
        same.DebtAmount.Should().Be(10m);
    }
}
