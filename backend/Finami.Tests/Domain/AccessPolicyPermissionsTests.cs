using Finami.Domain.Enums;
using Finami.Domain.Exceptions;
using Finami.Domain.Models;
using Finami.Domain.Services;
using Finami.Infra.Interfaces.Repository;
using FluentAssertions;
using Moq;

namespace Finami.Tests.Domain;

/// <summary>Feature 008 (T011): regras de lançar, ver e estornar no <see cref="AccessPolicy"/> (R-03/R-04/R-05).</summary>
public class AccessPolicyPermissionsTests
{
    private const long ANA = 1;      // responsável pela família Silva
    private const long BRUNO = 2;    // membro
    private const long CAIO = 3;     // membro
    private const long DORA = 4;     // ex-membro (removida, a carteira ainda aponta para a família)
    private const long EVA = 5;      // responsável pela família Souza
    private const long SILVA = 10;
    private const long SOUZA = 20;

    private readonly Mock<IGroupRepository<Group>> _groups = new();
    private readonly Dictionary<long, Group> _store = new();
    private readonly AccessPolicy _policy;

    public AccessPolicyPermissionsTests()
    {
        _store[SILVA] = Group(SILVA, "Silva", ANA, BRUNO, CAIO);
        _store[SOUZA] = Group(SOUZA, "Souza", EVA, BRUNO);
        _groups.Setup(g => g.GetByIdAsync(It.IsAny<long>())).ReturnsAsync((long id) => _store.GetValueOrDefault(id));
        _groups.Setup(g => g.GetResponsibleUserIdAsync(It.IsAny<long>()))
            .ReturnsAsync((long id) => _store.TryGetValue(id, out var g) ? g.UserId : null);
        _policy = new AccessPolicy(_groups.Object);
    }

    private static Group Group(long id, string name, long responsible, params long[] members)
    {
        var group = new Group { GroupId = id, Name = name, UserId = responsible };
        group.Members.Add(new GroupMember { GroupId = id, UserId = responsible });
        foreach (var member in members)
            group.Members.Add(new GroupMember { GroupId = id, UserId = member });
        return group;
    }

    private GroupMember Member(long groupId, long userId) => _store[groupId].FindMember(userId)!;

    private static long _nextId = 100;

    private static Account Wallet(long owner, long? groupId = null) => new()
    {
        AccountId = Interlocked.Increment(ref _nextId), Kind = AccountKind.Wallet, UserId = owner,
        GroupId = groupId, Currency = Currency.Brl, Name = "W"
    };

    private static readonly Account EXTERNAL = new() { AccountId = 1, Kind = AccountKind.ExternalSource, Currency = Currency.Brl };

    private static Transaction Tx(TransactionType type = TransactionType.Transfer) => new() { TransactionId = 1, Type = type };

    // ---------------- Criar lançamentos (R-03) ----------------

    [Fact]
    public async Task Personal_wallet_owner_can_create()
    {
        (await _policy.CanCreateTransactionsAsync(BRUNO, Wallet(BRUNO))).Should().BeTrue();
        await _policy.EnsureCanCreateTransactionsAsync(BRUNO, Wallet(BRUNO));
    }

    [Fact]
    public async Task Responsible_creates_in_member_wallet_even_with_member_permission_off()
    {
        Member(SILVA, BRUNO).CanCreateTransactions = false;

        (await _policy.CanCreateTransactionsAsync(ANA, Wallet(BRUNO, SILVA))).Should().BeTrue();
        (await _policy.CanCreateTransactionsAsync(ANA, Wallet(ANA, SILVA))).Should().BeTrue();
    }

    [Fact]
    public async Task Member_with_permission_creates_in_own_family_wallet()
    {
        (await _policy.CanCreateTransactionsAsync(BRUNO, Wallet(BRUNO, SILVA))).Should().BeTrue();
    }

    [Fact]
    public async Task Member_without_permission_cannot_create_and_gets_the_family_message()
    {
        Member(SILVA, BRUNO).CanCreateTransactions = false;

        (await _policy.CanCreateTransactionsAsync(BRUNO, Wallet(BRUNO, SILVA))).Should().BeFalse();
        var act = () => _policy.EnsureCanCreateTransactionsAsync(BRUNO, Wallet(BRUNO, SILVA));
        await act.Should().ThrowAsync<ForbiddenException>()
            .WithMessage("Você não tem permissão para criar lançamentos na família Silva.");

        // A carteira pessoal dele não é afetada.
        (await _policy.CanCreateTransactionsAsync(BRUNO, Wallet(BRUNO))).Should().BeTrue();
    }

    [Fact]
    public async Task Without_control_the_message_is_the_wallet_one()
    {
        var act = () => _policy.EnsureCanCreateTransactionsAsync(CAIO, Wallet(BRUNO, SILVA));

        await act.Should().ThrowAsync<ForbiddenException>().WithMessage("Você não tem permissão sobre esta carteira.");
    }

    [Fact]
    public async Task Removed_member_cannot_create_in_wallet_still_linked_to_the_family()
    {
        (await _policy.CanCreateTransactionsAsync(DORA, Wallet(DORA, SILVA))).Should().BeFalse();
    }

    [Fact]
    public async Task Groups_are_read_once_per_request()
    {
        for (var i = 0; i < 5; i++)
            await _policy.CanCreateTransactionsAsync(BRUNO, Wallet(BRUNO, SILVA));

        _groups.Verify(g => g.GetByIdAsync(SILVA), Times.Once);
    }

    // ---------------- Ver o lançamento (R-05) ----------------

    [Fact]
    public async Task Member_views_transaction_of_other_member_only_with_all_members_visibility()
    {
        var accounts = new[] { Wallet(CAIO, SILVA), EXTERNAL };

        (await _policy.CanViewTransactionAsync(BRUNO, accounts)).Should().BeFalse();
        _store[SILVA].StatementVisibility = StatementVisibility.AllMembers;
        (await _policy.CanViewTransactionAsync(BRUNO, accounts)).Should().BeTrue();
        (await _policy.CanViewTransactionAsync(EVA, accounts)).Should().BeFalse();
    }

    // ---------------- Estornar (R-04) ----------------

    [Fact]
    public async Task Personal_wallet_owner_reverses()
    {
        (await _policy.CanReverseAsync(BRUNO, Tx(), new[] { Wallet(BRUNO), EXTERNAL }, false)).Should().BeTrue();
    }

    [Fact]
    public async Task Responsible_reverses_anything_in_the_family()
    {
        (await _policy.CanReverseAsync(ANA, Tx(), new[] { Wallet(CAIO, SILVA), EXTERNAL }, false)).Should().BeTrue();
    }

    [Fact]
    public async Task Member_without_permission_cannot_reverse_even_own_family_wallet()
    {
        var accounts = new[] { Wallet(BRUNO, SILVA), EXTERNAL };

        (await _policy.CanReverseAsync(BRUNO, Tx(), accounts, false)).Should().BeFalse();
        var act = () => _policy.EnsureCanReverseAsync(BRUNO, accounts);
        await act.Should().ThrowAsync<ForbiddenException>()
            .WithMessage("Você não tem permissão para estornar lançamentos na família Silva.");
    }

    [Fact]
    public async Task Member_with_permission_reverses_own_family_wallet()
    {
        Member(SILVA, BRUNO).CanReverse = true;

        (await _policy.CanReverseAsync(BRUNO, Tx(), new[] { Wallet(BRUNO, SILVA), EXTERNAL }, false)).Should().BeTrue();
    }

    [Fact]
    public async Task Member_with_permission_reverses_other_member_only_when_he_can_see_it()
    {
        Member(SILVA, BRUNO).CanReverse = true;
        var accounts = new[] { Wallet(CAIO, SILVA), EXTERNAL };

        // ResponsibleOnly: não vê o extrato da carteira de Caio, então não estorna.
        (await _policy.CanReverseAsync(BRUNO, Tx(), accounts, false)).Should().BeFalse();

        _store[SILVA].StatementVisibility = StatementVisibility.AllMembers;
        (await _policy.CanReverseAsync(BRUNO, Tx(), accounts, false)).Should().BeTrue();
    }

    [Fact]
    public async Task Removed_member_cannot_reverse()
    {
        _store[SILVA].StatementVisibility = StatementVisibility.AllMembers;

        (await _policy.CanReverseAsync(DORA, Tx(), new[] { Wallet(DORA, SILVA), EXTERNAL }, false)).Should().BeFalse();
    }

    [Fact]
    public async Task Transfer_between_families_needs_permission_in_only_one_of_them()
    {
        // Caio (Silva) → Bruno (carteira na Souza). Bruno só tem "Pode estornar" na Souza.
        Member(SOUZA, BRUNO).CanReverse = true;
        var accounts = new[] { Wallet(CAIO, SILVA), Wallet(BRUNO, SOUZA) };

        (await _policy.CanReverseAsync(BRUNO, Tx(), accounts, false)).Should().BeTrue();
        // Eva, responsável pela Souza, também estorna.
        (await _policy.CanReverseAsync(EVA, Tx(), accounts, false)).Should().BeTrue();
    }

    [Fact]
    public async Task Transfer_with_one_personal_wallet_of_the_user_is_reversible_by_him()
    {
        // Caio (sem permissão na Silva) recebeu na carteira pessoal dele.
        var accounts = new[] { Wallet(BRUNO, SILVA), Wallet(CAIO) };

        (await _policy.CanReverseAsync(CAIO, Tx(), accounts, false)).Should().BeTrue();
    }

    [Fact]
    public async Task Reversals_and_already_reversed_transactions_are_never_reversible()
    {
        var accounts = new[] { Wallet(ANA, SILVA), EXTERNAL };

        (await _policy.CanReverseAsync(ANA, Tx(TransactionType.Reversal), accounts, false)).Should().BeFalse();
        (await _policy.CanReverseAsync(ANA, Tx(), accounts, alreadyReversed: true)).Should().BeFalse();
    }

    [Fact]
    public async Task Personal_wallets_of_someone_else_give_the_transaction_message()
    {
        var act = () => _policy.EnsureCanReverseAsync(CAIO, new[] { Wallet(BRUNO), EXTERNAL });

        await act.Should().ThrowAsync<ForbiddenException>().WithMessage("Você não tem permissão sobre esta transação.");
    }
}
