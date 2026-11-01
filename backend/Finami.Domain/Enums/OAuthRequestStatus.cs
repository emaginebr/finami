namespace Finami.Domain.Enums;

/// <summary>Pedido de autorização: Pending → Approved → CodeRedeemed, ou Pending → Denied.</summary>
public enum OAuthRequestStatus
{
    Pending = 1,
    Approved = 2,
    Denied = 3,
    CodeRedeemed = 4
}
