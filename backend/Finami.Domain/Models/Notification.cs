using Finami.Domain.Enums;

namespace Finami.Domain.Models;

/// <summary>
/// Notificação de um usuário (research R-05). Não copia o estado do convite: a navegação
/// <see cref="Invitation"/> traz o estado atual na leitura.
/// </summary>
public class Notification
{
    public long NotificationId { get; set; }
    public long UserId { get; set; }
    public NotificationType Type { get; set; }
    public long? GroupId { get; set; }
    public long? GroupInvitationId { get; set; }
    public long? ActorUserId { get; set; }
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
    public DateTime? ReadAt { get; set; }

    public Group? Group { get; set; }
    public GroupInvitation? Invitation { get; set; }
    public User? Actor { get; set; }

    public bool IsRead => ReadAt.HasValue;

    public void MarkRead(DateTime now)
    {
        if (!IsRead)
            ReadAt = now;
    }
}
