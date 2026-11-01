namespace Finami.DTO.Settings;

public class JwtSettings
{
    public string Secret { get; set; } = string.Empty;
    public string Issuer { get; set; } = "finami";
    public string Audience { get; set; } = "finami";
    public int ExpirationMinutes { get; set; } = 480;
}
