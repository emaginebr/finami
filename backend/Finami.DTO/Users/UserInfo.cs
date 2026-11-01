using System.Text.Json.Serialization;

namespace Finami.DTO.Users;

public class UserInfo
{
    [JsonPropertyName("userId")]
    public long UserId { get; set; }

    [JsonPropertyName("firstName")]
    public string FirstName { get; set; } = string.Empty;

    [JsonPropertyName("lastName")]
    public string LastName { get; set; } = string.Empty;

    [JsonPropertyName("email")]
    public string? Email { get; set; }

    [JsonPropertyName("hasPassword")]
    public bool HasPassword { get; set; }

    [JsonPropertyName("hasGoogle")]
    public bool HasGoogle { get; set; }

    [JsonPropertyName("canLogin")]
    public bool CanLogin { get; set; }

    [JsonPropertyName("createdByUserId")]
    public long? CreatedByUserId { get; set; }

    [JsonPropertyName("createdAt")]
    public DateTime CreatedAt { get; set; }
}
