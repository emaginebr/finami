using System.Text.Json.Serialization;
using Finami.DTO.Users;

namespace Finami.DTO.Auth;

public class RegisterInfo
{
    [JsonPropertyName("firstName")]
    public string FirstName { get; set; } = string.Empty;

    [JsonPropertyName("lastName")]
    public string LastName { get; set; } = string.Empty;

    [JsonPropertyName("email")]
    public string Email { get; set; } = string.Empty;

    [JsonPropertyName("password")]
    public string Password { get; set; } = string.Empty;
}

public class LoginInfo
{
    [JsonPropertyName("email")]
    public string Email { get; set; } = string.Empty;

    [JsonPropertyName("password")]
    public string Password { get; set; } = string.Empty;
}

public class GoogleLoginInfo
{
    [JsonPropertyName("idToken")]
    public string IdToken { get; set; } = string.Empty;
}

public class AuthResult
{
    [JsonPropertyName("token")]
    public string Token { get; set; } = string.Empty;

    [JsonPropertyName("expiresAt")]
    public DateTime ExpiresAt { get; set; }

    [JsonPropertyName("isNewUser")]
    public bool IsNewUser { get; set; }

    [JsonPropertyName("user")]
    public UserInfo User { get; set; } = new();
}

/// <summary>Dados extraídos de um ID token do Google já validado.</summary>
public class GoogleUserPayload
{
    [JsonPropertyName("subject")]
    public string Subject { get; set; } = string.Empty;

    [JsonPropertyName("email")]
    public string Email { get; set; } = string.Empty;

    [JsonPropertyName("emailVerified")]
    public bool EmailVerified { get; set; }

    [JsonPropertyName("givenName")]
    public string? GivenName { get; set; }

    [JsonPropertyName("familyName")]
    public string? FamilyName { get; set; }
}
