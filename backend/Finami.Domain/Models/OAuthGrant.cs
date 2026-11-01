using Finami.Domain.Enums;

namespace Finami.Domain.Models;

/// <summary>Conexão entre a pessoa e um assistente; no máximo uma ativa por par (índice único parcial).</summary>
public class OAuthGrant
{
    public long OAuthGrantId { get; set; }
    public long UserId { get; set; }
    public long OAuthClientId { get; set; }
    public string Scopes { get; set; } = string.Empty;
    public OAuthGrantStatus Status { get; set; } = OAuthGrantStatus.Active;
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
    public DateTime UpdatedAt { get; set; } = DateTime.UtcNow;
    public DateTime? LastUsedAt { get; set; }
    public DateTime? RevokedAt { get; set; }
    public OAuthRevokeReason? RevokeReason { get; set; }

    public OAuthClient? Client { get; set; }

    public bool IsActive => Status == OAuthGrantStatus.Active;

    public List<string> ScopeList => OAuthScopes.Parse(Scopes);

    /// <summary>Reautorização: substitui os escopos (os tokens antigos são revogados pelo serviço).</summary>
    public void ReplaceScopes(IEnumerable<string> scopes, DateTime now)
    {
        Scopes = OAuthScopes.Join(scopes);
        UpdatedAt = now;
    }

    /// <summary>Revoga a conexão; idempotente (mantém o primeiro motivo).</summary>
    public void Revoke(OAuthRevokeReason reason, DateTime now)
    {
        if (!IsActive)
            return;
        Status = OAuthGrantStatus.Revoked;
        RevokedAt = now;
        RevokeReason = reason;
        UpdatedAt = now;
    }
}
