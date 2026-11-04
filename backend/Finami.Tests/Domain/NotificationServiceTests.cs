using Finami.Domain.Enums;
using Finami.Domain.Exceptions;
using Finami.Domain.Models;
using Finami.Domain.Services;
using Finami.Domain.Validators;
using Finami.DTO.Notifications;
using Finami.Infra.Interfaces.Repository;
using FluentAssertions;
using Moq;

namespace Finami.Tests.Domain;

/// <summary>Cenários de "Testes esperados" de specs/003-family-member-invites/contracts/api.md (notificações).</summary>
public class NotificationServiceTests
{
    private const long ANA = 1;
    private const long BRUNO = 2;

    private readonly Mock<INotificationRepository<Notification>> _repository = new();
    private readonly List<Notification> _store = new();
    private readonly NotificationService _service;

    public NotificationServiceTests()
    {
        var group = new Group { GroupId = 10, Name = "Família Silva", UserId = ANA };
        var ana = new User { UserId = ANA, FirstName = "Ana", LastName = "Silva", Email = "ana@exemplo.com" };
        var bruno = new User { UserId = BRUNO, FirstName = "Bruno", LastName = "Lima", Email = "bruno@exemplo.com" };
        var invitation = new GroupInvitation
        {
            GroupInvitationId = 12, GroupId = 10, InvitedUserId = BRUNO, InvitedByUserId = ANA,
            Status = GroupInvitationStatus.Pending
        };

        // Bruno: 5 notificações (ids 1..5), a 5 é o convite recebido; Ana: a 6 (aceite) e a 7.
        for (var id = 1; id <= 4; id++)
            _store.Add(new Notification { NotificationId = id, UserId = BRUNO, Type = NotificationType.GroupInvitationDeclined });
        _store.Add(new Notification
        {
            NotificationId = 5, UserId = BRUNO, Type = NotificationType.GroupInvitationReceived,
            GroupId = 10, Group = group, GroupInvitationId = 12, Invitation = invitation, ActorUserId = ANA, Actor = ana
        });
        _store.Add(new Notification
        {
            NotificationId = 6, UserId = ANA, Type = NotificationType.GroupInvitationAccepted,
            GroupId = 10, Group = group, GroupInvitationId = 12, Invitation = invitation, ActorUserId = BRUNO, Actor = bruno
        });
        _store.Add(new Notification { NotificationId = 7, UserId = ANA, Type = NotificationType.GroupInvitationDeclined });

        // Simula o repositório: filtra pelo dono, cursor exclusivo e ordem decrescente.
        _repository.Setup(r => r.ListAsync(It.IsAny<long>(), It.IsAny<long?>(), It.IsAny<int>()))
            .ReturnsAsync((long userId, long? beforeId, int limit) => _store
                .Where(n => n.UserId == userId && (beforeId == null || n.NotificationId < beforeId))
                .OrderByDescending(n => n.NotificationId)
                .Take(limit)
                .ToList());
        _repository.Setup(r => r.CountUnreadAsync(It.IsAny<long>()))
            .ReturnsAsync((long userId) => _store.Count(n => n.UserId == userId && n.ReadAt == null));
        _repository.Setup(r => r.MarkReadAsync(It.IsAny<long>(), It.IsAny<IEnumerable<long>>(), It.IsAny<DateTime>()))
            .ReturnsAsync((long userId, IEnumerable<long> ids, DateTime now) =>
            {
                var targets = _store.Where(n => n.UserId == userId && ids.Contains(n.NotificationId) && n.ReadAt == null).ToList();
                targets.ForEach(n => n.MarkRead(now));
                return targets.Count;
            });

        _service = new NotificationService(_repository.Object, new MarkReadInfoValidator(),
            new Mock<IAccountRepository<Account>>().Object);
    }

    [Fact]
    public async Task Lists_only_own_notifications_newest_first()
    {
        var page = await _service.ListAsync(BRUNO, null, null);

        page.Items.Select(i => i.NotificationId).Should().Equal(5, 4, 3, 2, 1);
        page.NextBeforeId.Should().BeNull();
        _repository.Verify(r => r.ListAsync(BRUNO, null, 21), Times.Once, "limite padrão 20 + 1 para saber se há mais");
    }

    [Fact]
    public async Task Paginates_by_before_id()
    {
        var first = await _service.ListAsync(BRUNO, null, 2);
        first.Items.Select(i => i.NotificationId).Should().Equal(5, 4);
        first.NextBeforeId.Should().Be(4);

        var second = await _service.ListAsync(BRUNO, first.NextBeforeId, 2);
        second.Items.Select(i => i.NotificationId).Should().Equal(3, 2);
        second.NextBeforeId.Should().Be(2);

        var last = await _service.ListAsync(BRUNO, second.NextBeforeId, 2);
        last.Items.Select(i => i.NotificationId).Should().Equal(1);
        last.NextBeforeId.Should().BeNull();
    }

    [Fact]
    public async Task Exact_page_size_has_no_next_cursor()
    {
        var page = await _service.ListAsync(BRUNO, null, 5);

        page.Items.Should().HaveCount(5);
        page.NextBeforeId.Should().BeNull();
    }

    [Theory]
    [InlineData(0)]
    [InlineData(51)]
    [InlineData(-1)]
    public async Task Limit_outside_1_to_50_is_rejected(int limit)
    {
        var act = () => _service.ListAsync(BRUNO, null, limit);

        await act.Should().ThrowAsync<ValidationException>();
    }

    [Fact]
    public async Task Invitation_notification_reflects_the_current_invitation_state()
    {
        var pending = (await _service.ListAsync(BRUNO, null, 1)).Items.Single();
        pending.Type.Should().Be("GroupInvitationReceived");
        pending.IsRead.Should().BeFalse();
        pending.Group!.GroupId.Should().Be(10);
        pending.Group.Name.Should().Be("Família Silva");
        pending.Actor!.FirstName.Should().Be("Ana");
        pending.Actor.LastName.Should().Be("Silva");
        pending.Invitation!.InvitationId.Should().Be(12);
        pending.Invitation.Status.Should().Be("Pending");

        // O convite foi aceito depois: a mesma notificação passa a mostrar o estado final (FR-019).
        _store.Single(n => n.NotificationId == 5).Invitation!.Accept(DateTime.UtcNow);

        var accepted = (await _service.ListAsync(BRUNO, null, 1)).Items.Single();
        accepted.Invitation!.Status.Should().Be("Accepted");
    }

    [Fact]
    public async Task Notification_without_references_maps_to_nulls()
    {
        var item = (await _service.ListAsync(ANA, null, 1)).Items.Single();

        item.NotificationId.Should().Be(7);
        item.Group.Should().BeNull();
        item.Actor.Should().BeNull();
        item.Invitation.Should().BeNull();
    }

    [Fact]
    public async Task Counts_unread_notifications()
    {
        (await _service.CountUnreadAsync(BRUNO)).Unread.Should().Be(5);
        (await _service.CountUnreadAsync(ANA)).Unread.Should().Be(2);
    }

    [Fact]
    public async Task Mark_read_only_affects_own_notifications()
    {
        await _service.MarkReadAsync(BRUNO, new MarkReadInfo { NotificationIds = new List<long> { 5, 4, 6, 4 } });

        _store.Single(n => n.NotificationId == 5).IsRead.Should().BeTrue();
        _store.Single(n => n.NotificationId == 4).IsRead.Should().BeTrue();
        _store.Single(n => n.NotificationId == 6).IsRead.Should().BeFalse("é da Ana e é ignorada");
        (await _service.CountUnreadAsync(BRUNO)).Unread.Should().Be(3);
        (await _service.CountUnreadAsync(ANA)).Unread.Should().Be(2);
        _repository.Verify(r => r.MarkReadAsync(BRUNO,
            It.Is<IEnumerable<long>>(ids => ids.OrderBy(i => i).SequenceEqual(new long[] { 4, 5, 6 })),
            It.IsAny<DateTime>()), Times.Once);
    }

    [Fact]
    public async Task Listed_notification_shows_read_state()
    {
        await _service.MarkReadAsync(BRUNO, new MarkReadInfo { NotificationIds = new List<long> { 5 } });

        var item = (await _service.ListAsync(BRUNO, null, 1)).Items.Single();

        item.IsRead.Should().BeTrue();
    }

    [Fact]
    public async Task Mark_read_requires_between_1_and_100_ids()
    {
        var empty = () => _service.MarkReadAsync(BRUNO, new MarkReadInfo());
        var tooMany = () => _service.MarkReadAsync(BRUNO,
            new MarkReadInfo { NotificationIds = Enumerable.Range(1, 101).Select(i => (long)i).ToList() });

        await empty.Should().ThrowAsync<ValidationException>();
        await tooMany.Should().ThrowAsync<ValidationException>();
        _repository.Verify(r => r.MarkReadAsync(It.IsAny<long>(), It.IsAny<IEnumerable<long>>(), It.IsAny<DateTime>()),
            Times.Never);
    }

    [Fact]
    public void Mark_read_keeps_the_first_read_time()
    {
        var first = new DateTime(2026, 11, 1, 10, 0, 0, DateTimeKind.Utc);
        var notification = new Notification();

        notification.MarkRead(first);
        notification.MarkRead(first.AddHours(1));

        notification.ReadAt.Should().Be(first);
    }
}
