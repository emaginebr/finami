namespace Finami.Domain.Enums;

/// <summary>Tipo da notificação (gravado como integer em notifications.type).</summary>
public enum NotificationType
{
    GroupInvitationReceived = 1,
    GroupInvitationAccepted = 2,
    GroupInvitationDeclined = 3,

    /// <summary>Feature 008 (R-06): o responsável mudou as permissões do membro (aponta para o histórico).</summary>
    MemberPermissionsChanged = 4,

    /// <summary>Feature 008 (R-06): outra pessoa estornou um lançamento de carteira do destinatário.</summary>
    TransactionReversed = 5
}
