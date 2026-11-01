using System.Text.Json.Serialization;

namespace Finami.DTO.Groups;

public class GroupInfo
{
    [JsonPropertyName("groupId")]
    public long GroupId { get; set; }

    [JsonPropertyName("name")]
    public string Name { get; set; } = string.Empty;

    [JsonPropertyName("responsibleUserId")]
    public long ResponsibleUserId { get; set; }

    [JsonPropertyName("isResponsible")]
    public bool IsResponsible { get; set; }

    /// <summary>"ResponsibleOnly", "AllMembers" ou "MembersSummary".</summary>
    [JsonPropertyName("statementVisibility")]
    public string StatementVisibility { get; set; } = string.Empty;

    [JsonPropertyName("members")]
    public List<GroupMemberInfo> Members { get; set; } = new();

    [JsonPropertyName("createdAt")]
    public DateTime CreatedAt { get; set; }
}

public class GroupMemberInfo
{
    [JsonPropertyName("userId")]
    public long UserId { get; set; }

    [JsonPropertyName("firstName")]
    public string FirstName { get; set; } = string.Empty;

    [JsonPropertyName("lastName")]
    public string LastName { get; set; } = string.Empty;

    [JsonPropertyName("canLogin")]
    public bool CanLogin { get; set; }

    [JsonPropertyName("joinedAt")]
    public DateTime JoinedAt { get; set; }
}

public class GroupInsertInfo
{
    [JsonPropertyName("name")]
    public string Name { get; set; } = string.Empty;
}

public class GroupUpdateInfo
{
    [JsonPropertyName("name")]
    public string? Name { get; set; }

    /// <summary>"ResponsibleOnly", "AllMembers" ou "MembersSummary".</summary>
    [JsonPropertyName("statementVisibility")]
    public string? StatementVisibility { get; set; }
}

public class AddMemberInfo
{
    [JsonPropertyName("userId")]
    public long UserId { get; set; }
}
