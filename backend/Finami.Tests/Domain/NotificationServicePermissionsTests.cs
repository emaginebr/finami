using Finami.Domain.Enums;
using Finami.Domain.Models;
using Finami.Domain.Services;
using Finami.Domain.Validators;
using Finami.Infra.Interfaces.Repository;
using FluentAssertions;
using Moq;

namespace Finami.Tests.Domain;

/// <summary>Feature 008 (T045, US5): mapeamento das notificações MemberPermissionsChanged e TransactionReversed.</summary>
public class NotificationServicePermissionsTests
{
    private const long ANA = 1;
    private const long BRUNO = 2;
    private const long CAIO = 3;

    private readonly Mock<INotificationRepository<Notification>> _repository = new();
    private readonly Mock<IAccountRepository<Account>> _accounts = new();
    private readonly List<Notification> _store = new();
    private readonly NotificationService _service;

    public NotificationServicePermissionsTests()
    {
        var group = new Group { GroupId = 10, Name = "Silva", UserId = ANA };
        var ana = new User { UserId = ANA, FirstName = "Ana", LastName = "Silva" };
        var caio = new User { UserId = CAIO, FirstName = "Caio", LastName = "Silva" };

        // Bruno teve duas mudanças; o estado atual dele é o da segunda, mas cada notificação mostra a sua.
        _store.Add(new Notification
        {
            NotificationId = 1, UserId = BRUNO, Type = NotificationType.MemberPermissionsChanged, GroupId = 10,
            Group = group, ActorUserId = ANA, Actor = ana, PermissionChangeId = 70,
            PermissionChange = new GroupMemberPermissionChange
            {
                GroupMemberPermissionChangeId = 70, GroupId = 10, MemberUserId = BRUNO, ChangedByUserId = ANA,
                BeforeCanCreateTransactions = true, BeforeCanReverse = false,
                AfterCanCreateTransactions = true, AfterCanReverse = true
            }
        });
        _store.Add(new Notification
        {
            NotificationId = 2, UserId = BRUNO, Type = NotificationType.MemberPermissionsChanged, GroupId = 10,
            Group = group, ActorUserId = ANA, Actor = ana, PermissionChangeId = 71,
            PermissionChange = new GroupMemberPermissionChange
            {
                GroupMemberPermissionChangeId = 71, GroupId = 10, MemberUserId = BRUNO, ChangedByUserId = ANA,
                BeforeCanCreateTransactions = true, BeforeCanReverse = true,
                AfterCanCreateTransactions = false, AfterCanReverse = false
            }
        });
        // Caio estornou uma transferência de Bruno (carteira 200, Mesada) para Caio (300).
        _store.Add(new Notification
        {
            NotificationId = 3, UserId = BRUNO, Type = NotificationType.TransactionReversed, GroupId = 10,
            Group = group, ActorUserId = CAIO, Actor = caio, TransactionId = 55,
            Transaction = new Transaction
            {
                TransactionId = 55, Type = TransactionType.Reversal, SourceAccountId = 300, DestinationAccountId = 200,
                ReversedTransactionId = 54
            }
        });

        _repository.Setup(r => r.ListAsync(It.IsAny<long>(), It.IsAny<long?>(), It.IsAny<int>()))
            .ReturnsAsync((long userId, long? beforeId, int limit) => _store
                .Where(n => n.UserId == userId && (beforeId == null || n.NotificationId < beforeId))
                .OrderByDescending(n => n.NotificationId)
                .Take(limit)
                .ToList());
        _accounts.Setup(a => a.GetByIdsAsync(It.IsAny<IEnumerable<long>>()))
            .ReturnsAsync(new List<Account>
            {
                new() { AccountId = 200, Kind = AccountKind.Wallet, UserId = BRUNO, Name = "Mesada", Currency = Currency.Brl },
                new() { AccountId = 300, Kind = AccountKind.Wallet, UserId = CAIO, Name = "Caio", Currency = Currency.Brl }
            });

        _service = new NotificationService(_repository.Object, new MarkReadInfoValidator(), _accounts.Object);
    }

    [Fact]
    public async Task Member_permissions_changed_shows_the_state_after_each_recorded_change()
    {
        var page = await _service.ListAsync(BRUNO, null, null);

        var first = page.Items.Single(n => n.NotificationId == 1);
        first.Type.Should().Be("MemberPermissionsChanged");
        first.Actor!.FirstName.Should().Be("Ana");
        first.Group!.Name.Should().Be("Silva");
        (first.Permissions!.CanCreateTransactions, first.Permissions.CanReverse).Should().Be((true, true),
            "o histórico daquela mudança, não o estado atual");
        var second = page.Items.Single(n => n.NotificationId == 2);
        (second.Permissions!.CanCreateTransactions, second.Permissions.CanReverse).Should().Be((false, false));
        first.TransactionId.Should().BeNull();
        first.WalletId.Should().BeNull();
        first.WalletName.Should().BeNull();
    }

    [Fact]
    public async Task Transaction_reversed_has_the_reversal_id_and_the_recipient_wallet()
    {
        var page = await _service.ListAsync(BRUNO, null, null);

        var reversed = page.Items.Single(n => n.NotificationId == 3);
        reversed.Type.Should().Be("TransactionReversed");
        reversed.TransactionId.Should().Be(55);
        reversed.WalletId.Should().Be(200);
        reversed.WalletName.Should().Be("Mesada");
        reversed.Actor!.FirstName.Should().Be("Caio");
        reversed.Permissions.Should().BeNull();
    }

    [Fact]
    public async Task Accounts_are_read_once_per_page()
    {
        await _service.ListAsync(BRUNO, null, null);

        _accounts.Verify(a => a.GetByIdsAsync(It.IsAny<IEnumerable<long>>()), Times.Once);
    }
}
