using Finami.Domain.Enums;
using Finami.Domain.Exceptions;
using Finami.DTO.Transactions;
using FluentAssertions;
using Moq;

namespace Finami.Tests.Domain;

public class LedgerServiceTransferTests
{
    private const long ANA = 7;
    private const long PEDRO = 8;
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
    public async Task Transfer_to_wallet_of_another_user_is_allowed()
    {
        _ctx.Wallet(100, ANA, Currency.Brl, balance: 500m);
        _ctx.Wallet(200, PEDRO, Currency.Brl);
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
}
