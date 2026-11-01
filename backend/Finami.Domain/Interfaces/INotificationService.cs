using Finami.DTO.Notifications;

namespace Finami.Domain.Interfaces;

/// <summary>Notificações do próprio usuário (research R-05).</summary>
public interface INotificationService
{
    Task<NotificationPage> ListAsync(long userId, long? beforeId, int? limit);
    Task<UnreadCountResult> CountUnreadAsync(long userId);
    Task MarkReadAsync(long userId, MarkReadInfo info);
}
