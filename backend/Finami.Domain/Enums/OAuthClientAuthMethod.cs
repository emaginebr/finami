namespace Finami.Domain.Enums;

/// <summary>Autenticação do cliente no endpoint de token (RFC 7591 token_endpoint_auth_method).</summary>
public enum OAuthClientAuthMethod
{
    None = 1,
    ClientSecretPost = 2,
    ClientSecretBasic = 3
}
