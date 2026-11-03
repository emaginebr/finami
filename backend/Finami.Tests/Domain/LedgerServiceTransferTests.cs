using Finami.Domain.Enums;
using Finami.Domain.Exceptions;
using System.Globalization;
using Finami.Domain.Models;
using Finami.DTO.Transactions;
using FluentAssertions;
using Moq;

namespace Finami.Tests.Domain;

public class LedgerServiceTransferTests
{
    private const long ANA = 7;
    private const long PEDRO = 8;
    private const long CAIO = 9;      // dependente; a responsável (ANA) controla a carteira dele
    private const long CARLA = 10;    // fora da família de Caio
    private readonly LedgerTestContext _ctx = new();

    [Fact]
    public async Task Purchase_converts_at_quote_and_creates_four_entries_balanced_per_currency()
    {
        _ctx.Wallet(100, ANA, Currency.Brl, balance: 1000m);
        _ctx.Wallet(101, ANA, Currency.Btc);
        _ctx.SetQuote(500_000m);
        var service = _ctx.CreateService();

        var result = await service.TransferAsync(ANA, new TransferInfo
            { SourceWalletId = 100, DestinationWalletId = 101, Amount = 1000m });

        result.Type.Should().Be("BtcPurchase");
        result.DestinationAmount.Should().Be(0.002m);
        result.Quote!.PriceBrl.Should().Be(500_000m);
        var tx = _ctx.Inserted.Single();
        tx.BtcQuoteId.Should().Be(99);
        tx.Entries.Should().HaveCount(4);
        tx.Entries.GroupBy(e => e.Currency).Should().OnlyContain(g => g.Sum(e => e.Amount) == 0m);
        _ctx.Balances[100].Should().Be(0m);
        _ctx.Balances[101].Should().Be(0.002m);
    }

    [Fact]
    public async Task Sale_converts_btc_to_brl_at_quote()
    {
        _ctx.Wallet(100, ANA, Currency.Brl);
        _ctx.Wallet(101, ANA, Currency.Btc, balance: 0.01m);
        _ctx.SetQuote(500_000m);
        var service = _ctx.CreateService();

        var result = await service.TransferAsync(ANA, new TransferInfo
            { SourceWalletId = 101, DestinationWalletId = 100, Amount = 0.01m });

        result.Type.Should().Be("BtcSale");
        result.DestinationAmount.Should().Be(5000m);
        _ctx.Balances[100].Should().Be(5000m);
    }

    [Fact]
    public async Task Conversion_truncates_and_never_rounds_up()
    {
        _ctx.Wallet(100, ANA, Currency.Brl, balance: 100m);
        _ctx.Wallet(101, ANA, Currency.Btc);
        _ctx.SetQuote(300_000m); // 100 / 300000 = 0.000333333...
        var service = _ctx.CreateService();

        var result = await service.TransferAsync(ANA, new TransferInfo
            { SourceWalletId = 100, DestinationWalletId = 101, Amount = 100m });

        result.DestinationAmount.Should().Be(0.00033333m);
        (result.DestinationAmount * 300_000m).Should().BeLessThanOrEqualTo(100m);
    }

    [Fact]
    public async Task Purchase_that_truncates_to_zero_is_rejected()
    {
        _ctx.Wallet(100, ANA, Currency.Brl, balance: 1m);
        _ctx.Wallet(101, ANA, Currency.Btc);
        _ctx.SetQuote(500_000_000m);
        var service = _ctx.CreateService();

        var act = () => service.TransferAsync(ANA, new TransferInfo
            { SourceWalletId = 100, DestinationWalletId = 101, Amount = 0.01m });

        await act.Should().ThrowAsync<BusinessRuleException>();
        _ctx.Inserted.Should().BeEmpty();
    }

    [Fact]
    public async Task Stale_quote_blocks_conversion_but_not_same_currency_transfer()
    {
        _ctx.Wallet(100, ANA, Currency.Brl, balance: 1000m);
        _ctx.Wallet(101, ANA, Currency.Btc);
        _ctx.Wallet(102, ANA, Currency.Brl);
        _ctx.Quotes.Setup(q => q.GetForConversionAsync()).ThrowsAsync(new QuoteUnavailableException());
        var service = _ctx.CreateService();

        var conversion = () => service.TransferAsync(ANA, new TransferInfo
            { SourceWalletId = 100, DestinationWalletId = 101, Amount = 10m });
        await conversion.Should().ThrowAsync<QuoteUnavailableException>();

        var sameCurrency = await service.TransferAsync(ANA, new TransferInfo
            { SourceWalletId = 100, DestinationWalletId = 102, Amount = 10m });
        sameCurrency.Type.Should().Be("Transfer");
    }

    [Fact]
    public async Task Transfer_to_wallet_of_family_member_is_allowed()
    {
        _ctx.Wallet(100, ANA, Currency.Brl, balance: 500m);
        _ctx.Wallet(200, PEDRO, Currency.Brl);
        _ctx.ShareFamily(ANA, PEDRO);
        var service = _ctx.CreateService();

        var result = await service.TransferAsync(ANA, new TransferInfo
            { SourceWalletId = 100, DestinationWalletId = 200, Amount = 100m });

        result.Type.Should().Be("Transfer");
        _ctx.Balances[200].Should().Be(100m);
        _ctx.Balances[100].Should().Be(400m);
    }

    [Fact]
    public async Task Transfer_from_wallet_of_another_user_is_forbidden()
    {
        _ctx.Wallet(100, ANA, Currency.Brl, balance: 500m);
        _ctx.Wallet(200, PEDRO, Currency.Brl, balance: 500m);
        var service = _ctx.CreateService();

        var act = () => service.TransferAsync(ANA, new TransferInfo
            { SourceWalletId = 200, DestinationWalletId = 100, Amount = 100m });

        await act.Should().ThrowAsync<ForbiddenException>();
    }

    [Fact]
    public async Task Transfer_to_inactive_wallet_is_rejected()
    {
        _ctx.Wallet(100, ANA, Currency.Brl, balance: 500m);
        _ctx.Wallet(200, PEDRO, Currency.Brl, active: false);
        var service = _ctx.CreateService();

        var act = () => service.TransferAsync(ANA, new TransferInfo
            { SourceWalletId = 100, DestinationWalletId = 200, Amount = 100m });

        await act.Should().ThrowAsync<BusinessRuleException>();
    }

    [Fact]
    public async Task Transfer_above_balance_leaves_source_negative()
    {
        _ctx.Wallet(100, ANA, Currency.Brl, balance: 50m);
        _ctx.Wallet(102, ANA, Currency.Brl);
        var service = _ctx.CreateService();

        await service.TransferAsync(ANA, new TransferInfo
            { SourceWalletId = 100, DestinationWalletId = 102, Amount = 50.01m });

        _ctx.Balances[100].Should().Be(-0.01m);
        _ctx.Balances[102].Should().Be(50.01m);
    }

    [Fact]
    public async Task Preview_does_not_persist()
    {
        _ctx.Wallet(100, ANA, Currency.Brl, balance: 1000m);
        _ctx.Wallet(101, ANA, Currency.Btc);
        _ctx.SetQuote(500_000m);
        var service = _ctx.CreateService();

        var preview = await service.PreviewTransferAsync(ANA, new TransferInfo
            { SourceWalletId = 100, DestinationWalletId = 101, Amount = 1000m });

        preview.Type.Should().Be("BtcPurchase");
        preview.DestinationAmount.Should().Be(0.002m);
        _ctx.Inserted.Should().BeEmpty();
        _ctx.UnitOfWork.Verify(u => u.BeginTransactionAsync(), Times.Never);
    }

    [Fact]
    public async Task Reversal_inverts_original_reuses_quote_and_cannot_be_repeated()
    {
        _ctx.Wallet(100, ANA, Currency.Brl, balance: 1000m);
        _ctx.Wallet(101, ANA, Currency.Btc);
        _ctx.SetQuote(500_000m);
        var service = _ctx.CreateService();
        var purchase = await service.TransferAsync(ANA, new TransferInfo
            { SourceWalletId = 100, DestinationWalletId = 101, Amount = 1000m });
        _ctx.SetQuote(900_000m); // cotação mudou; o estorno deve usar a original

        var reversal = await service.ReverseAsync(ANA, purchase.TransactionId, null);

        reversal.Type.Should().Be("Reversal");
        reversal.ReversedTransactionId.Should().Be(purchase.TransactionId);
        reversal.Quote!.PriceBrl.Should().Be(500_000m);
        _ctx.Balances[100].Should().Be(1000m);
        _ctx.Balances[101].Should().Be(0m);

        var again = () => service.ReverseAsync(ANA, purchase.TransactionId, null);
        await again.Should().ThrowAsync<ConflictException>();

        var reverseReversal = () => service.ReverseAsync(ANA, reversal.TransactionId, null);
        await reverseReversal.Should().ThrowAsync<BusinessRuleException>();
    }

    [Fact]
    public async Task Reversal_of_expense_returns_funds_to_wallet()
    {
        _ctx.Wallet(100, ANA, Currency.Brl, balance: 100m);
        var service = _ctx.CreateService();
        var expense = await service.ExpenseAsync(ANA, new ExpenseInfo { WalletId = 100, Amount = 30m });

        await service.ReverseAsync(ANA, expense.TransactionId, new ReverseInfo { Description = "lançado errado" });

        _ctx.Balances[100].Should().Be(100m);
    }

    [Fact]
    public async Task Reversal_by_user_without_permission_is_forbidden()
    {
        _ctx.Wallet(100, ANA, Currency.Brl, balance: 100m);
        var service = _ctx.CreateService();
        var expense = await service.ExpenseAsync(ANA, new ExpenseInfo { WalletId = 100, Amount = 30m });

        var act = () => service.ReverseAsync(PEDRO, expense.TransactionId, null);

        await act.Should().ThrowAsync<ForbiddenException>();
    }

    // ---------------- Feature 006: só para a família (US2) ----------------

    [Fact]
    public async Task Transfer_outside_the_family_is_rejected_without_posting()
    {
        _ctx.Wallet(100, ANA, Currency.Brl, balance: 500m);
        _ctx.Wallet(300, CARLA, Currency.Brl);
        var service = _ctx.CreateService();

        var transfer = () => service.TransferAsync(ANA, new TransferInfo
            { SourceWalletId = 100, DestinationWalletId = 300, Amount = 100m });
        var preview = () => service.PreviewTransferAsync(ANA, new TransferInfo
            { SourceWalletId = 100, DestinationWalletId = 300, Amount = 100m });

        await transfer.Should().ThrowAsync<BusinessRuleException>()
            .WithMessage("Só é possível transferir para pessoas da sua família.");
        await preview.Should().ThrowAsync<BusinessRuleException>()
            .WithMessage("Só é possível transferir para pessoas da sua família.");
        _ctx.Inserted.Should().BeEmpty();
        _ctx.UnitOfWork.Verify(u => u.BeginTransactionAsync(), Times.Never);
    }

    [Fact]
    public async Task Transfer_between_own_wallets_does_not_need_a_family()
    {
        _ctx.Wallet(100, ANA, Currency.Brl, balance: 500m);
        _ctx.Wallet(101, ANA, Currency.Brl);
        var service = _ctx.CreateService();

        var result = await service.TransferAsync(ANA, new TransferInfo
            { SourceWalletId = 100, DestinationWalletId = 101, Amount = 10m });

        result.Type.Should().Be("Transfer");
    }

    [Fact]
    public async Task Family_rule_is_evaluated_for_the_owner_of_the_source_not_for_who_posts()
    {
        _ctx.Wallet(400, CAIO, Currency.Brl, balance: 100m);
        _ctx.Wallet(300, CARLA, Currency.Brl);
        _ctx.Wallet(200, PEDRO, Currency.Brl);
        // A responsável (ANA) controla a carteira do dependente e é da família de Carla; Caio não é.
        _ctx.AccessPolicy.Setup(p => p.EnsureCanControlWalletAsync(ANA, It.Is<Account>(a => a.AccountId == 400)))
            .Returns(Task.CompletedTask);
        _ctx.ShareFamily(ANA, CARLA);
        _ctx.ShareFamily(CAIO, PEDRO);
        var service = _ctx.CreateService();

        var toCarla = () => service.TransferAsync(ANA, new TransferInfo
            { SourceWalletId = 400, DestinationWalletId = 300, Amount = 10m });
        await toCarla.Should().ThrowAsync<BusinessRuleException>()
            .WithMessage("Só é possível transferir para pessoas da sua família.");

        var toPedro = await service.TransferAsync(ANA, new TransferInfo
            { SourceWalletId = 400, DestinationWalletId = 200, Amount = 10m });
        toPedro.Type.Should().Be("Transfer");
        _ctx.Inserted.Single().CreatedByUserId.Should().Be(ANA);
        _ctx.AccessPolicy.Verify(p => p.AreFamilyAsync(CAIO, CARLA), Times.Once);
        _ctx.AccessPolicy.Verify(p => p.AreFamilyAsync(ANA, It.IsAny<long>()), Times.Never);
    }

    // ---------------- Feature 006: conversão só na mesma pessoa (US3) ----------------

    [Theory]
    [InlineData(Currency.Brl, Currency.Btc)]
    [InlineData(Currency.Btc, Currency.Brl)]
    public async Task Conversion_to_another_owner_is_rejected_before_fetching_the_quote(Currency from, Currency to)
    {
        _ctx.Wallet(100, ANA, from, balance: 1m);
        _ctx.Wallet(200, PEDRO, to);
        _ctx.ShareFamily(ANA, PEDRO);
        _ctx.SetQuote(500_000m);
        var service = _ctx.CreateService();

        var transfer = () => service.TransferAsync(ANA, new TransferInfo
            { SourceWalletId = 100, DestinationWalletId = 200, Amount = 0.5m });
        var preview = () => service.PreviewTransferAsync(ANA, new TransferInfo
            { SourceWalletId = 100, DestinationWalletId = 200, Amount = 0.5m });

        await transfer.Should().ThrowAsync<BusinessRuleException>()
            .WithMessage("Conversão entre real e bitcoin só entre carteiras da mesma pessoa.");
        await preview.Should().ThrowAsync<BusinessRuleException>()
            .WithMessage("Conversão entre real e bitcoin só entre carteiras da mesma pessoa.");
        _ctx.Quotes.Verify(q => q.GetForConversionAsync(), Times.Never);
        _ctx.Inserted.Should().BeEmpty();
    }

    [Fact]
    public async Task Conversion_rule_comes_before_the_family_rule()
    {
        _ctx.Wallet(100, ANA, Currency.Brl, balance: 100m);
        _ctx.Wallet(300, CARLA, Currency.Btc);
        var service = _ctx.CreateService();

        var act = () => service.TransferAsync(ANA, new TransferInfo
            { SourceWalletId = 100, DestinationWalletId = 300, Amount = 10m });

        await act.Should().ThrowAsync<BusinessRuleException>()
            .WithMessage("Conversão entre real e bitcoin só entre carteiras da mesma pessoa.");
        _ctx.AccessPolicy.Verify(p => p.AreFamilyAsync(It.IsAny<long>(), It.IsAny<long>()), Times.Never);
    }

    // ---------------- Feature 006: bitcoin informado em reais (US4) ----------------

    [Fact]
    public async Task Btc_transfer_in_brl_converts_at_quote_and_records_it()
    {
        _ctx.Wallet(500, ANA, Currency.Btc, balance: 0.01m);
        _ctx.Wallet(501, PEDRO, Currency.Btc);
        _ctx.ShareFamily(ANA, PEDRO);
        _ctx.SetQuote(500_000m);
        var service = _ctx.CreateService();

        var result = await service.TransferAsync(ANA, new TransferInfo
            { SourceWalletId = 500, DestinationWalletId = 501, AmountBrl = 200m });

        result.Type.Should().Be("Transfer");
        result.SourceAmount.Should().Be(0.0004m);
        result.DestinationAmount.Should().Be(0.0004m);
        result.Quote!.PriceBrl.Should().Be(500_000m);
        var tx = _ctx.Inserted.Single();
        tx.BtcQuoteId.Should().Be(99);
        tx.QuotePriceBrl.Should().Be(500_000m);
        tx.Entries.Should().HaveCount(2);
        _ctx.Balances[500].Should().Be(0.0096m);
        _ctx.Balances[501].Should().Be(0.0004m);
    }

    [Fact]
    public async Task Btc_preview_in_brl_returns_btc_amounts_and_quote_and_truncates()
    {
        _ctx.Wallet(500, ANA, Currency.Btc);
        _ctx.Wallet(502, ANA, Currency.Btc);
        _ctx.SetQuote(300_000m); // 100 / 300000 = 0.000333333...
        var service = _ctx.CreateService();

        var preview = await service.PreviewTransferAsync(ANA, new TransferInfo
            { SourceWalletId = 500, DestinationWalletId = 502, AmountBrl = 100m });

        preview.Type.Should().Be("Transfer");
        preview.SourceAmount.Should().Be(0.00033333m);
        preview.DestinationAmount.Should().Be(0.00033333m);
        preview.Quote!.PriceBrl.Should().Be(300_000m);
        _ctx.Inserted.Should().BeEmpty();
    }

    [Theory]
    [InlineData(Currency.Brl, Currency.Brl)]
    [InlineData(Currency.Btc, Currency.Brl)]
    [InlineData(Currency.Brl, Currency.Btc)]
    public async Task Amount_in_brl_outside_btc_to_btc_is_a_validation_error(Currency from, Currency to)
    {
        _ctx.Wallet(100, ANA, from);
        _ctx.Wallet(101, ANA, to);
        _ctx.SetQuote(500_000m);
        var service = _ctx.CreateService();

        var act = () => service.PreviewTransferAsync(ANA, new TransferInfo
            { SourceWalletId = 100, DestinationWalletId = 101, AmountBrl = 50m });

        await act.Should().ThrowAsync<ValidationException>()
            .WithMessage("Valor em reais só vale para transferência entre carteiras de bitcoin.");
    }

    [Theory]
    [InlineData(null, null)]
    [InlineData("0.001", "50")]
    public async Task Exactly_one_amount_is_required(string? amount, string? amountBrl)
    {
        _ctx.Wallet(500, ANA, Currency.Btc);
        _ctx.Wallet(502, ANA, Currency.Btc);
        var service = _ctx.CreateService();

        var act = () => service.TransferAsync(ANA, new TransferInfo
        {
            SourceWalletId = 500, DestinationWalletId = 502,
            Amount = amount == null ? null : decimal.Parse(amount, CultureInfo.InvariantCulture),
            AmountBrl = amountBrl == null ? null : decimal.Parse(amountBrl, CultureInfo.InvariantCulture)
        });

        await act.Should().ThrowAsync<ValidationException>().WithMessage("Informe o valor em bitcoin ou em reais.");
        _ctx.Inserted.Should().BeEmpty();
    }

    [Fact]
    public async Task Amount_in_brl_too_small_is_rejected()
    {
        _ctx.Wallet(500, ANA, Currency.Btc);
        _ctx.Wallet(502, ANA, Currency.Btc);
        _ctx.SetQuote(500_000_000m);
        var service = _ctx.CreateService();

        var act = () => service.TransferAsync(ANA, new TransferInfo
            { SourceWalletId = 500, DestinationWalletId = 502, AmountBrl = 0.01m });

        await act.Should().ThrowAsync<BusinessRuleException>().WithMessage("Valor pequeno demais para conversão.");
        _ctx.Inserted.Should().BeEmpty();
    }

    [Fact]
    public async Task Amount_in_brl_without_quote_is_unavailable()
    {
        _ctx.Wallet(500, ANA, Currency.Btc);
        _ctx.Wallet(502, ANA, Currency.Btc);
        _ctx.Quotes.Setup(q => q.GetForConversionAsync()).ThrowsAsync(new QuoteUnavailableException());
        var service = _ctx.CreateService();

        var act = () => service.PreviewTransferAsync(ANA, new TransferInfo
            { SourceWalletId = 500, DestinationWalletId = 502, AmountBrl = 200m });

        await act.Should().ThrowAsync<QuoteUnavailableException>();
    }

    [Fact]
    public async Task Btc_transfer_in_btc_does_not_fetch_quote()
    {
        _ctx.Wallet(500, ANA, Currency.Btc, balance: 0.01m);
        _ctx.Wallet(502, ANA, Currency.Btc);
        var service = _ctx.CreateService();

        var result = await service.TransferAsync(ANA, new TransferInfo
            { SourceWalletId = 500, DestinationWalletId = 502, Amount = 0.001m });

        result.Quote.Should().BeNull();
        _ctx.Quotes.Verify(q => q.GetForConversionAsync(), Times.Never);
    }
}
