using Finami.Domain.Enums;
using Finami.Domain.Exceptions;

namespace Finami.Domain.Models;

/// <summary>
/// Pedido de autorização (tela <c>/autorizar</c>) e, depois de aprovado, o código emitido.
/// Transições: Pending → Approved → CodeRedeemed; Pending → Denied.
/// </summary>
public class OAuthAuthorizationRequest
{
    public const string EXPIRED_MESSAGE =
        "Este pedido de autorização venceu. Volte ao assistente e tente conectar de novo.";

    public long OAuthAuthorizationRequestId { get; set; }
    public string RequestKey { get; set; } = string.Empty;
    public long OAuthClientId { get; set; }
    public string RedirectUri { get; set; } = string.Empty;
    public string ScopesRequested { get; set; } = string.Empty;
    public string? State { get; set; }
    public string CodeChallenge { get; set; } = string.Empty;
    public string Resource { get; set; } = string.Empty;
    public OAuthRequestStatus Status { get; set; } = OAuthRequestStatus.Pending;
    public long? UserId { get; set; }
    public long? OAuthGrantId { get; set; }
    public string? CodeHash { get; set; }
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
    public DateTime ExpiresAt { get; set; }
    public DateTime? RedeemedAt { get; set; }

    public OAuthClient? Client { get; set; }

    public List<string> ScopeList => OAuthScopes.Parse(ScopesRequested);

    public bool IsExpired(DateTime now) => ExpiresAt <= now;

    /// <summary>Ainda pode ser respondido pela pessoa: pendente e dentro da validade.</summary>
    public bool IsAnswerable(DateTime now) => Status == OAuthRequestStatus.Pending && !IsExpired(now);

    public void Approve(long userId, long grantId, string codeHash, DateTime now, TimeSpan codeLifetime)
    {
        EnsureAnswerable(now);
        Status = OAuthRequestStatus.Approved;
        UserId = userId;
        OAuthGrantId = grantId;
        CodeHash = codeHash;
        ExpiresAt = now.Add(codeLifetime);
    }

    public void Deny(long userId, DateTime now)
    {
        EnsureAnswerable(now);
        Status = OAuthRequestStatus.Denied;
        UserId = userId;
    }

    public void Redeem(DateTime now)
    {
        Status = OAuthRequestStatus.CodeRedeemed;
        RedeemedAt = now;
    }

    private void EnsureAnswerable(DateTime now)
    {
        if (!IsAnswerable(now))
            throw new GoneException(EXPIRED_MESSAGE);
    }
}
