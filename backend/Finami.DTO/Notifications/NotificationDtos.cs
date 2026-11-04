using System.Text.Json.Serialization;
using Finami.DTO.Groups;
using Finami.DTO.Users;

namespace Finami.DTO.Notifications;

public class NotificationInfo
{
    [JsonPropertyName("notificationId")]
    public long NotificationId { get; set; }

    /// <summary>
    /// "GroupInvitationReceived", "GroupInvitationAccepted", "GroupInvitationDeclined", "MemberPermissionsChanged"
    /// ou "TransactionReversed".
    /// </summary>
    [JsonPropertyName("type")]
    public string Type { get; set; } = string.Empty;

    [JsonPropertyName("createdAt")]
    public DateTime CreatedAt { get; set; }

    [JsonPropertyName("isRead")]
    public bool IsRead { get; set; }

    [JsonPropertyName("group")]
    public NotificationGroupInfo? Group { get; set; }

    [JsonPropertyName("actor")]
    public UserSummaryInfo? Actor { get; set; }

    [JsonPropertyName("invitation")]
    public NotificationInvitationInfo? Invitation { get; set; }

    /// <summary>
    /// Feature 008: em MemberPermissionsChanged, as permissões DEPOIS da mudança registrada no histórico (não o
    /// estado atual).
    /// </summary>
    [JsonPropertyName("permissions")]
    public MemberPermissionsResult? Permissions { get; set; }

    /// <summary>Feature 008: em TransactionReversed, o id do estorno.</summary>
    [JsonPropertyName("transactionId")]
    public long? TransactionId { get; set; }

    /// <summary>Feature 008: em TransactionReversed, id da carteira do destinatário afetada pelo estorno.</summary>
    [JsonPropertyName("walletId")]
    public long? WalletId { get; set; }

    /// <summary>Feature 008: em TransactionReversed, nome da carteira do destinatário afetada pelo estorno.</summary>
    [JsonPropertyName("walletName")]
    public string? WalletName { get; set; }
}

public class NotificationGroupInfo
{
    [JsonPropertyName("groupId")]
    public long GroupId { get; set; }

    [JsonPropertyName("name")]
    public string Name { get; set; } = string.Empty;
}

public class NotificationInvitationInfo
{
    [JsonPropertyName("invitationId")]
    public long InvitationId { get; set; }

    /// <summary>Estado atual do convite: "Pending", "Accepted", "Declined" ou "Canceled".</summary>
    [JsonPropertyName("status")]
    public string Status { get; set; } = string.Empty;
}

public class NotificationPage
{
    [JsonPropertyName("items")]
    public List<NotificationInfo> Items { get; set; } = new();

    /// <summary>Cursor da próxima página (passe em beforeId); null quando não há mais itens.</summary>
    [JsonPropertyName("nextBeforeId")]
    public long? NextBeforeId { get; set; }
}

public class UnreadCountResult
{
    [JsonPropertyName("unread")]
    public int Unread { get; set; }
}

public class MarkReadInfo
{
    [JsonPropertyName("notificationIds")]
    public List<long> NotificationIds { get; set; } = new();
}
