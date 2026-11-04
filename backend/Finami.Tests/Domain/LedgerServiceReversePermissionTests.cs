using Finami.Domain.Enums;
using Finami.Domain.Exceptions;
using Finami.DTO.Transactions;
using FluentAssertions;

namespace Finami.Tests.Domain;

/// <summary>
/// Feature 008 (T036, US3): estorno exige ser o responsável, ter "Pode estornar" (e ver o lançamento, R-05) ou ser o
/// titular de uma carteira pessoal; os titulares diferentes de quem estornou recebem TransactionReversed.
/// </summary>
public class LedgerServiceReversePermissionTests
{
    private const long ANA = 1;   // responsável pela Silva
    private const long BRUNO = 2; // membro da Silva e da Souza
    private const long CAIO = 3;  // membro da Silva
    private const long EVA = 5;   // responsável pela Souza
    private const long SILVA = 10;
    private const long SOUZA = 20;
    private const string MESSAGE = "Você não tem permissão para estornar lançamentos na família Silva.";

    private readonly LedgerTestContext _ctx = new();

    public LedgerServiceReversePermissionTests()
    {
        foreach (var (id, name) in new[] { (ANA, "Ana"), (BRUNO, "Bruno"), (CAIO, "Caio"), (EVA, "Eva") })
            _ctx.Person(id, name);
        _ctx.Family(SILVA, "Silva", ANA, BRUNO, CAIO);
        _ctx.Family(SOUZA, "Souza", EVA, BRUNO);
        _ctx.FamilyWallet(200, BRUNO, SILVA, Currency.Brl, balance: 100m);
        _ctx.Wallet(201, BRUNO, Currency.Brl, balance: 100m);
        _ctx.FamilyWallet(300, CAIO, SILVA, Currency.Brl, balance: 100m);
        _ctx.FamilyWallet(400, BRUNO, SOUZA, Currency.Brl);
        _ctx.Wallet(500, ANA, Currency.Brl);
    }

    private void Allow(long groupId, long userId) => _ctx.GroupStore[groupId].FindMember(userId)!.CanReverse = true;

    private Task<TransactionInfo> CaioExpenseAsync() =>
        _ctx.CreateServiceWithRealPolicy().ExpenseAsync(CAIO, new ExpenseInfo { WalletId = 300, Amount = 40m });

    [Fact]
    public async Task Member_without_permission_is_refused_even_on_his_own_family_wallet()
    {
        var service = _ctx.CreateServiceWithRealPolicy();
        var own = await service.ExpenseAsync(BRUNO, new ExpenseInfo { WalletId = 200, Amount = 10m });

        var act = () => service.ReverseAsync(BRUNO, own.TransactionId, null);

        await act.Should().ThrowAsync<ForbiddenException>().WithMessage(MESSAGE);
        _ctx.Inserted.Should().ContainSingle();
        _ctx.NotificationsInserted.Should().BeEmpty();
    }

    [Fact]
    public async Task Member_with_permission_reverses_other_member_with_all_members_and_owner_is_notified()
    {
        Allow(SILVA, BRUNO);
        _ctx.GroupStore[SILVA].StatementVisibility = StatementVisibility.AllMembers;
        var expense = await CaioExpenseAsync();
        var service = _ctx.CreateServiceWithRealPolicy();

        (await service.GetAsync(BRUNO, expense.TransactionId)).CanReverse.Should().BeTrue();
        var reversal = await service.ReverseAsync(BRUNO, expense.TransactionId, null);

        _ctx.Balances[300].Should().Be(100m);
        var notification = _ctx.NotificationsInserted.Should().ContainSingle().Subject;
        notification.UserId.Should().Be(CAIO);
        notification.Type.Should().Be(NotificationType.TransactionReversed);
        notification.TransactionId.Should().Be(reversal.TransactionId);
        notification.ActorUserId.Should().Be(BRUNO);
        notification.GroupId.Should().Be(SILVA);
    }

    [Fact]
    public async Task With_responsible_only_visibility_the_member_cannot_see_nor_reverse_other_member()
    {
        Allow(SILVA, BRUNO);
        var expense = await CaioExpenseAsync();
        var service = _ctx.CreateServiceWithRealPolicy();

        var view = () => service.GetAsync(BRUNO, expense.TransactionId);
        var reverse = () => service.ReverseAsync(BRUNO, expense.TransactionId, null);

        await view.Should().ThrowAsync<ForbiddenException>().WithMessage("Você não tem permissão sobre esta transação.");
        await reverse.Should().ThrowAsync<ForbiddenException>().WithMessage(MESSAGE);
    }

    [Fact]
    public async Task Owner_of_a_personal_wallet_reverses_without_notification()
    {
        var service = _ctx.CreateServiceWithRealPolicy();
        var income = await service.IncomeAsync(BRUNO, new IncomeInfo { WalletId = 201, Amount = 10m });

        var reversal = await service.ReverseAsync(BRUNO, income.TransactionId, null);

        reversal.ReversedTransactionId.Should().Be(income.TransactionId);
        _ctx.NotificationsInserted.Should().BeEmpty("quem estornou não é notificado");
    }

    [Fact]
    public async Task Transfer_between_families_needs_permission_in_one_of_them()
    {
        // Caio (Silva) → Bruno (carteira na Souza); Bruno tem "Pode estornar" só na Souza.
        Allow(SOUZA, BRUNO);
        var transfer = await _ctx.CreateServiceWithRealPolicy().TransferAsync(CAIO, new TransferInfo
            { SourceWalletId = 300, DestinationWalletId = 400, Amount = 25m, Kind = "payment" });

        var reversal = await _ctx.CreateServiceWithRealPolicy().ReverseAsync(BRUNO, transfer.TransactionId, null);

        _ctx.NotificationsInserted.Should().ContainSingle(n => n.UserId == CAIO && n.TransactionId == reversal.TransactionId);
    }

    [Fact]
    public async Task Responsible_reversal_notifies_every_other_owner()
    {
        var transfer = await _ctx.CreateServiceWithRealPolicy().TransferAsync(CAIO, new TransferInfo
            { SourceWalletId = 300, DestinationWalletId = 200, Amount = 25m, Kind = "payment" });

        var reversal = await _ctx.CreateServiceWithRealPolicy().ReverseAsync(ANA, transfer.TransactionId, null);

        _ctx.NotificationsInserted.Select(n => n.UserId).Should().BeEquivalentTo(new[] { CAIO, BRUNO });
        _ctx.NotificationsInserted.Should().OnlyContain(n =>
            n.Type == NotificationType.TransactionReversed && n.TransactionId == reversal.TransactionId
            && n.ActorUserId == ANA && n.GroupId == SILVA);
    }

    [Fact]
    public async Task Refused_reversal_does_not_reach_the_ledger()
    {
        var expense = await CaioExpenseAsync();

        var act = () => _ctx.CreateServiceWithRealPolicy().ReverseAsync(EVA, expense.TransactionId, null);

        await act.Should().ThrowAsync<ForbiddenException>().WithMessage(MESSAGE);
        _ctx.Inserted.Should().ContainSingle();
    }
}
