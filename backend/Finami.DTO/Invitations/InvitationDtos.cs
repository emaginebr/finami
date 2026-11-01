using System.Text.Json.Serialization;
using Finami.DTO.Users;

namespace Finami.DTO.Invitations;

/// <summary>Entrada de POST api/groups/{groupId}/member-lookup.</summary>
public class MemberLookupInfo
{
    [JsonPropertyName("email")]
    public string Email { get; set; } = string.Empty;
}

/// <summary>Resultado da verificação de email no fluxo "Adicionar membro".</summary>
public class MemberLookupResult
{
    /// <summary>"Available", "Registered", "AlreadyMember" ou "PendingInvite".</summary>
    [JsonPropertyName("status")]
    public string Status { get; set; } = string.Empty;

    /// <summary>Email normalizado (trim + minúsculas).</summary>
    [JsonPropertyName("email")]
    public string Email { get; set; } = string.Empty;

    /// <summary>Nome da pessoa encontrada; null quando Available.</summary>
    [JsonPropertyName("user")]
    public UserSummaryInfo? User { get; set; }

    /// <summary>Convite pendente, quando PendingInvite.</summary>
    [JsonPropertyName("invitationId")]
    public long? InvitationId { get; set; }
}

/// <summary>Entrada de POST api/groups/{groupId}/members/new: cria a pessoa e a inclui na família.</summary>
public class NewMemberInfo
{
    [JsonPropertyName("firstName")]
    public string FirstName { get; set; } = string.Empty;

    [JsonPropertyName("lastName")]
    public string LastName { get; set; } = string.Empty;

    [JsonPropertyName("email")]
    public string? Email { get; set; }
}

/// <summary>Entrada de POST api/groups/{groupId}/invitations.</summary>
public class GroupInvitationInsertInfo
{
    [JsonPropertyName("email")]
    public string Email { get; set; } = string.Empty;
}

public class GroupInvitationInfo
{
    [JsonPropertyName("invitationId")]
    public long InvitationId { get; set; }

    [JsonPropertyName("groupId")]
    public long GroupId { get; set; }

    [JsonPropertyName("groupName")]
    public string GroupName { get; set; } = string.Empty;

    [JsonPropertyName("invitedUser")]
    public UserSummaryInfo InvitedUser { get; set; } = new();

    [JsonPropertyName("invitedBy")]
    public UserSummaryInfo InvitedBy { get; set; } = new();

    /// <summary>"Pending", "Accepted", "Declined" ou "Canceled".</summary>
    [JsonPropertyName("status")]
    public string Status { get; set; } = string.Empty;

    [JsonPropertyName("createdAt")]
    public DateTime CreatedAt { get; set; }

    [JsonPropertyName("respondedAt")]
    public DateTime? RespondedAt { get; set; }
}
