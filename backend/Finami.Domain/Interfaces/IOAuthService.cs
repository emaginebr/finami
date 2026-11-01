using Finami.DTO.OAuth;

namespace Finami.Domain.Interfaces;

/// <summary>
/// Servidor de autorização OAuth 2.1 do MCP (research R-02..R-06, contracts/oauth.md).
/// Erros de protocolo saem como <see cref="Exceptions.OAuthProtocolException"/>; erros das rotas do app
/// (<c>/api/oauth/*</c>) saem como <see cref="Exceptions.DomainException"/>.
/// </summary>
public interface IOAuthService
{
    /// <summary>URL pública do servidor (issuer), sem barra final.</summary>
    string Issuer { get; }

    /// <summary>Recurso protegido: <c>{Issuer}/mcp</c>.</summary>
    string ResourceUrl { get; }

    AuthorizationServerMetadata GetAuthorizationServerMetadata();
    ProtectedResourceMetadata GetProtectedResourceMetadata();

    /// <summary>Registro dinâmico de cliente (RFC 7591).</summary>
    Task<OAuthClientRegistrationResult> RegisterClientAsync(OAuthClientRegistrationInfo info);

    /// <summary>
    /// Valida o pedido de <c>/oauth/authorize</c>. Cliente desconhecido ou <c>redirect_uri</c> não registrado
    /// lançam <see cref="Exceptions.OAuthProtocolException"/> (página de erro, sem redirecionar); os demais
    /// erros voltam em <see cref="OAuthAuthorizeResult.ErrorRedirectUrl"/>.
    /// </summary>
    Task<OAuthAuthorizeResult> StartAuthorizationAsync(OAuthAuthorizeInfo info);

    /// <summary>Pedido exibido na tela de consentimento (404 / 410).</summary>
    Task<OAuthRequestInfo> GetRequestAsync(long userId, string requestKey);

    /// <summary>Aprova: cria/atualiza a conexão, emite o código e devolve o redirect para o cliente.</summary>
    Task<OAuthRedirectResult> ApproveAsync(long userId, string requestKey, OAuthApproveInfo info);

    /// <summary>Nega: devolve o redirect com <c>error=access_denied</c>.</summary>
    Task<OAuthRedirectResult> DenyAsync(long userId, string requestKey);

    /// <summary><c>grant_type=authorization_code</c>.</summary>
    Task<OAuthTokenResult> ExchangeCodeAsync(OAuthTokenRequestInfo info);

    /// <summary><c>grant_type=refresh_token</c>, com rotação e detecção de reuso.</summary>
    Task<OAuthTokenResult> RefreshAsync(OAuthTokenRequestInfo info);

    /// <summary>RFC 7009: renovação revoga a conexão; acesso revoga só o token. Token desconhecido é ignorado.</summary>
    Task RevokeTokenAsync(OAuthTokenRequestInfo info);

    /// <summary>Valida um token de acesso do MCP; <c>null</c> se inválido, vencido, revogado ou com conexão revogada.</summary>
    Task<OAuthAccessTokenInfo?> ValidateAccessTokenAsync(string accessToken);
}
