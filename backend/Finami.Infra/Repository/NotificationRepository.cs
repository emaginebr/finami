using Finami.Domain.Models;
using Finami.Infra.Context;
using Finami.Infra.Interfaces.Repository;
using Microsoft.EntityFrameworkCore;

namespace Finami.Infra.Repository;

public class NotificationRepository : INotificationRepository<Notification>
{
    private readonly FinamiContext _context;

    public NotificationRepository(FinamiContext context)
    {
        _context = context;
    }

    public async Task<Notification> InsertAsync(Notification notification)
    {
        _context.Notifications.Add(notification);
        await _context.SaveChangesAsync();
        return notification;
    }

    public Task<List<Notification>> ListAsync(long userId, long? beforeId, int limit) =>
        _context.Notifications.AsNoTracking()
            .Include(n => n.Invitation)
            .Include(n => n.Group)
            .Include(n => n.Actor)
            .Where(n => n.UserId == userId && (beforeId == null || n.NotificationId < beforeId))
            .OrderByDescending(n => n.NotificationId)
            .Take(limit)
            .ToListAsync();

    public Task<int> CountUnreadAsync(long userId) =>
        _context.Notifications.CountAsync(n => n.UserId == userId && n.ReadAt == null);

    public Task<int> MarkReadAsync(long userId, IEnumerable<long> notificationIds, DateTime now)
    {
        var ids = notificationIds.Distinct().ToList();
        if (ids.Count == 0)
            return Task.FromResult(0);
        // Princípio V: timestamp sem fuso — o ExecuteUpdate não passa pelo conversor do modelo.
        var readAt = DateTime.SpecifyKind(now.Kind == DateTimeKind.Local ? now.ToUniversalTime() : now,
            DateTimeKind.Unspecified);
        return _context.Notifications
            .Where(n => n.UserId == userId && ids.Contains(n.NotificationId) && n.ReadAt == null)
            .ExecuteUpdateAsync(s => s.SetProperty(n => n.ReadAt, readAt));
    }
}
