using Finami.Domain.Enums;
using Finami.Domain.Exceptions;
using Finami.Domain.Services;
using Finami.DTO.Transactions;
using FluentAssertions;

namespace Finami.Tests.Domain;

/// <summary>Feature 008 (T021, US2): membro sem "Pode lançar" não lança com origem nas carteiras da família.</summary>
public class LedgerServiceCreatePermissionTests
{
    private const long ANA = 1;   // responsável
    private const long BRUNO = 2; // membro sem "Pode lançar"
    private const long SILVA = 10;
    private const string MESSAGE = "Você não tem permissão para criar lançamentos na família Silva.";

    private readonly LedgerTestContext _ctx = new();
    private readonly LedgerService _service;

    public LedgerServiceCreatePermissionTests()
    {
        _ctx.Person(ANA, "Ana");
        _ctx.Person(BRUNO, "Bruno");
        var family = _ctx.Family(SILVA, "Silva", ANA, BRUNO);
        family.FindMember(BRUNO)!.CanCreateTransactions = false;
        _ctx.FamilyWallet(100, ANA, SILVA, Currency.Brl, balance: 1000m);
        _ctx.FamilyWallet(200, BRUNO, SILVA, Currency.Brl, balance: 100m);
        _ctx.Wallet(201, BRUNO, Currency.Brl, balance: 50m);
        _service = _ctx.CreateServiceWithRealPolicy();
    }

    [Fact]
    public async Task Income_expense_transfer_and_preview_from_the_family_wallet_are_forbidden()
    {
        var actions = new Func<Task>[]
        {
            () => _service.IncomeAsync(BRUNO, new IncomeInfo { WalletId = 200, Amount = 10m }),
            () => _service.ExpenseAsync(BRUNO, new ExpenseInfo { WalletId = 200, Amount = 10m }),
            () => _service.TransferAsync(BRUNO, new TransferInfo { SourceWalletId = 200, DestinationWalletId = 201, Amount = 10m }),
            () => _service.PreviewTransferAsync(BRUNO, new TransferInfo { SourceWalletId = 200, DestinationWalletId = 201, Amount = 10m })
        };

        foreach (var action in actions)
            await action.Should().ThrowAsync<ForbiddenException>().WithMessage(MESSAGE);
        _ctx.Inserted.Should().BeEmpty();
    }

    [Fact]
    public async Task Receiving_in_the_family_wallet_does_not_depend_on_permission()
    {
        var fromAna = await _service.TransferAsync(ANA, new TransferInfo
            { SourceWalletId = 100, DestinationWalletId = 200, Amount = 30m, Kind = "payment" });
        var fromOwnPersonal = await _service.TransferAsync(BRUNO, new TransferInfo
            { SourceWalletId = 201, DestinationWalletId = 200, Amount = 20m });

        fromAna.Destination.AccountId.Should().Be(200);
        fromOwnPersonal.Destination.AccountId.Should().Be(200);
        _ctx.Balances[200].Should().Be(150m);
    }

    [Fact]
    public async Task Personal_wallet_is_not_affected()
    {
        var income = await _service.IncomeAsync(BRUNO, new IncomeInfo { WalletId = 201, Amount = 10m });
        var expense = await _service.ExpenseAsync(BRUNO, new ExpenseInfo { WalletId = 201, Amount = 5m });

        income.Type.Should().Be("ExternalIncome");
        expense.Type.Should().Be("ExternalExpense");
    }

    [Fact]
    public async Task Responsible_posts_in_the_member_wallet()
    {
        var income = await _service.IncomeAsync(ANA, new IncomeInfo { WalletId = 200, Amount = 10m });
        var preview = await _service.PreviewTransferAsync(ANA, new TransferInfo
            { SourceWalletId = 200, DestinationWalletId = 100, Amount = 5m, Kind = "payment" });

        income.CreatedByUserId.Should().Be(ANA);
        preview.SourceAmount.Should().Be(5m);
    }

    [Fact]
    public async Task Permission_turned_back_on_works_on_the_next_request()
    {
        _ctx.GroupStore[SILVA].FindMember(BRUNO)!.CanCreateTransactions = true;

        var income = await _ctx.CreateServiceWithRealPolicy()
            .IncomeAsync(BRUNO, new IncomeInfo { WalletId = 200, Amount = 10m });

        income.Destination.AccountId.Should().Be(200);
    }
}
