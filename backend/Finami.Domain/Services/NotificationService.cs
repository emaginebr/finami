using Finami.Domain.Interfaces;
using Finami.Domain.Models;
using Finami.Domain.Validators;
using Finami.DTO.Notifications;
using Finami.DTO.Users;
using Finami.Infra.Interfaces.Repository;
using FluentValidation;
using ValidationException = Finami.Domain.Exceptions.ValidationException;

namespace Finami.Domain.Services;

/// <summary>Notificações do próprio usuário (research R-05, FR-020/021/024).</summary>
public class NotificationService : INotificationService
{
    public const int DEFAULT_LIMIT = 20;
    public const int MAX_LIMIT = 50;

    private readonly INotificationRepository<Notification> _notificationRepository;
    private readonly IValidator<MarkReadInfo> _markReadValidator;

    public NotificationService(
        INotificationRepository<Notification> notificationRepository,
        IValidator<MarkReadInfo> markReadValidator)
    {
        _notificationRepository = notificationRepository;
        _markReadValidator = markReadValidator;
    }

    public async Task<NotificationPage> ListAsync(long userId, long? beforeId, int? limit)
    {
        var size = limit ?? DEFAULT_LIMIT;
        if (size < 1 || size > MAX_LIMIT)
            throw new ValidationException($"limit deve estar entre 1 e {MAX_LIMIT}.");

        // Busca um item a mais para saber se existe próxima página.
        var notifications = await _notificationRepository.ListAsync(userId, beforeId, size + 1);
        var hasMore = notifications.Count > size;
        var items = notifications.Take(size).Select(ToInfo).ToList();
        return new NotificationPage
        {
            Items = items,
            NextBeforeId = hasMore ? items[^1].NotificationId : null
        };
    }

    public async Task<UnreadCountResult> CountUnreadAsync(long userId) =>
        new() { Unread = await _notificationRepository.CountUnreadAsync(userId) };

    public async Task MarkReadAsync(long userId, MarkReadInfo info)
    {
        await _markReadValidator.ValidateOrThrowAsync(info);
        // FR-024: o repositório só altera notificações do próprio usuário; as demais são ignoradas.
        await _notificationRepository.MarkReadAsync(userId, info.NotificationIds.Distinct().ToList(), DateTime.UtcNow);
    }

    /// <summary>O estado do convite vem da navegação (join), nunca de uma cópia gravada na notificação.</summary>
    private static NotificationInfo ToInfo(Notification notification) => new()
    {
        NotificationId = notification.NotificationId,
        Type = notification.Type.ToString(),
        CreatedAt = notification.CreatedAt,
        IsRead = notification.IsRead,
        Group = notification.Group == null
            ? null
            : new NotificationGroupInfo { GroupId = notification.Group.GroupId, Name = notification.Group.Name },
        Actor = notification.Actor == null
            ? null
            : new UserSummaryInfo
            {
                UserId = notification.Actor.UserId,
                FirstName = notification.Actor.FirstName,
                LastName = notification.Actor.LastName
            },
        Invitation = notification.Invitation == null
            ? null
            : new NotificationInvitationInfo
            {
                InvitationId = notification.Invitation.GroupInvitationId,
                Status = notification.Invitation.Status.ToString()
            }
    };
}
