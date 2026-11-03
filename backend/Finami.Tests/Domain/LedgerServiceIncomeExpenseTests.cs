using Finami.Domain.Enums;
using Finami.Domain.Exceptions;
using Finami.Domain.Services;
using Finami.DTO.Transactions;
using FluentAssertions;
using Moq;

namespace Finami.Tests.Domain;

public class LedgerServiceIncomeExpenseTests
{
    private const long OWNER = 7;
    private readonly LedgerTestContext _ctx = new();

    [Fact]
    public async Task Income_creates_two_entries_that_sum_to_zero_and_increase_balance()
    {
        _ctx.Wallet(100, OWNER, Currency.Brl);
        var service = _ctx.CreateService();

        var result = await service.IncomeAsync(OWNER, new IncomeInfo { WalletId = 100, Amount = 5000m });

        result.Type.Should().Be("ExternalIncome");
        var tx = _ctx.Inserted.Single();
        tx.Entries.Should().HaveCount(2);
        tx.Entries.Sum(e => e.Amount).Should().Be(0m);
        tx.SourceAccountId.Should().Be(1); // origem externa BRL
        _ctx.Balances[100].Should().Be(5000m);
        _ctx.UnitOfWork.Verify(u => u.CommitAsync(), Times.Once);
    }

    [Fact]
    public async Task Expense_above_balance_leaves_wallet_negative()
    {
        _ctx.Wallet(100, OWNER, Currency.Brl, balance: 100m);
        var service = _ctx.CreateService();

        await service.ExpenseAsync(OWNER, new ExpenseInfo { WalletId = 100, Amount = 100.01m });

        _ctx.Balances[100].Should().Be(-0.01m);
        _ctx.UnitOfWork.Verify(u => u.CommitAsync(), Times.Once);
    }

    [Fact]
    public async Task Expense_within_balance_decreases_balance()
    {
        _ctx.Wallet(100, OWNER, Currency.Brl, balance: 100m);
        var service = _ctx.CreateService();

        await service.ExpenseAsync(OWNER, new ExpenseInfo { WalletId = 100, Amount = 40m });

        _ctx.Balances[100].Should().Be(60m);
        _ctx.Inserted.Single().DestinationAccountId.Should().Be(2); // destino externo BRL
    }

    [Fact]
    public async Task Inactive_wallet_does_not_accept_transactions()
    {
        _ctx.Wallet(100, OWNER, Currency.Brl, active: false);
        var service = _ctx.CreateService();

        var act = () => service.IncomeAsync(OWNER, new IncomeInfo { WalletId = 100, Amount = 10m });

        await act.Should().ThrowAsync<BusinessRuleException>();
        _ctx.Inserted.Should().BeEmpty();
    }

    [Fact]
    public async Task Non_owner_cannot_move_wallet()
    {
        _ctx.Wallet(100, OWNER, Currency.Brl, balance: 100m);
        var service = _ctx.CreateService();

        var act = () => service.ExpenseAsync(999, new ExpenseInfo { WalletId = 100, Amount = 10m });

        await act.Should().ThrowAsync<ForbiddenException>();
    }

    [Fact]
    public async Task Amount_with_too_many_decimals_is_rejected()
    {
        _ctx.Wallet(100, OWNER, Currency.Brl);
        var service = _ctx.CreateService();

        var act = () => service.IncomeAsync(OWNER, new IncomeInfo { WalletId = 100, Amount = 10.001m });

        await act.Should().ThrowAsync<ValidationException>();
    }
}
