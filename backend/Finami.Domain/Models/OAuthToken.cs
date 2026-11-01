using Finami.Domain.Enums;

namespace Finami.Domain.Models;

/// <summary>Token de acesso ou de renovação, guardado só como SHA-256 (research R-03).</summary>
public class OAuthToken
{
    public long OAuthTokenId { get; set; }
    public long OAuthGrantId { get; set; }
    public OAuthTokenType TokenType { get; set; }
    public string TokenHash { get; set; } = string.Empty;
    public string Scopes { get; set; } = string.Empty;
    public long? ParentTokenId { get; set; }
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
    public DateTime ExpiresAt { get; set; }
    public DateTime? UsedAt { get; set; }
    public DateTime? RevokedAt { get; set; }

    public OAuthGrant? Grant { get; set; }

    public bool IsExpired(DateTime now) => ExpiresAt <= now;
    public bool IsRevoked => RevokedAt.HasValue;
    public bool IsUsed => UsedAt.HasValue;

    public void Revoke(DateTime now) => RevokedAt ??= now;

    public void MarkUsed(DateTime now) => UsedAt ??= now;
}
