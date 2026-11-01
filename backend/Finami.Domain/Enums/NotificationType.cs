namespace Finami.Domain.Enums;

/// <summary>Tipo da notificação (gravado como integer em notifications.type).</summary>
public enum NotificationType
{
    GroupInvitationReceived = 1,
    GroupInvitationAccepted = 2,
    GroupInvitationDeclined = 3
}
