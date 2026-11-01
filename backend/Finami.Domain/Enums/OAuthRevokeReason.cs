namespace Finami.Domain.Enums;

/// <summary>Motivo da revogação de uma conexão OAuth.</summary>
public enum OAuthRevokeReason
{
    UserDisconnected = 1,
    UserDisconnectedAll = 2,
    Reauthorized = 3,
    RefreshTokenReuse = 4,
    ClientRevoked = 5,
    AuthorizationCodeReuse = 6
}
