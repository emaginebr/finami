using System.Text.Json.Serialization;

namespace Finami.DTO.OAuth;

// DTOs do protocolo OAuth: nomes snake_case exigidos pelos RFCs (Princípio IV, plan.md).

/// <summary>Pedido de registro dinâmico de cliente (RFC 7591 §2).</summary>
public class OAuthClientRegistrationInfo
{
    [JsonPropertyName("client_name")]
    public string? ClientName { get; set; }

    [JsonPropertyName("redirect_uris")]
    public List<string>? RedirectUris { get; set; }

    [JsonPropertyName("grant_types")]
    public List<string>? GrantTypes { get; set; }

    [JsonPropertyName("response_types")]
    public List<string>? ResponseTypes { get; set; }

    [JsonPropertyName("token_endpoint_auth_method")]
    public string? TokenEndpointAuthMethod { get; set; }

    [JsonPropertyName("scope")]
    public string? Scope { get; set; }
}

/// <summary>Resposta do registro dinâmico (RFC 7591 §3.2.1).</summary>
public class OAuthClientRegistrationResult
{
    [JsonPropertyName("client_id")]
    public string ClientId { get; set; } = string.Empty;

    [JsonPropertyName("client_id_issued_at")]
    public long ClientIdIssuedAt { get; set; }

    /// <summary>Devolvido uma única vez, só para métodos com segredo.</summary>
    [JsonPropertyName("client_secret")]
    [JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingNull)]
    public string? ClientSecret { get; set; }

    [JsonPropertyName("client_secret_expires_at")]
    [JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingNull)]
    public long? ClientSecretExpiresAt { get; set; }

    [JsonPropertyName("client_name")]
    public string ClientName { get; set; } = string.Empty;

    [JsonPropertyName("redirect_uris")]
    public List<string> RedirectUris { get; set; } = new();

    [JsonPropertyName("grant_types")]
    public List<string> GrantTypes { get; set; } = new();

    [JsonPropertyName("response_types")]
    public List<string> ResponseTypes { get; set; } = new();

    [JsonPropertyName("token_endpoint_auth_method")]
    public string TokenEndpointAuthMethod { get; set; } = string.Empty;

    [JsonPropertyName("scope")]
    [JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingNull)]
    public string? Scope { get; set; }
}

/// <summary>Parâmetros de <c>GET /oauth/authorize</c>.</summary>
public class OAuthAuthorizeInfo
{
    public string? ResponseType { get; set; }
    public string? ClientId { get; set; }
    public string? RedirectUri { get; set; }
    public string? CodeChallenge { get; set; }
    public string? CodeChallengeMethod { get; set; }
    public string? Scope { get; set; }
    public string? State { get; set; }
    public string? Resource { get; set; }
}

/// <summary>
/// Resultado do início da autorização: <see cref="RequestKey"/> quando o pedido foi gravado (vai para
/// <c>/autorizar</c>) ou <see cref="ErrorRedirectUrl"/> quando o erro volta ao cliente pelo redirect_uri.
/// </summary>
public class OAuthAuthorizeResult
{
    public string? RequestKey { get; set; }
    public string? ErrorRedirectUrl { get; set; }
}

/// <summary>Formulário de <c>POST /oauth/token</c> e <c>POST /oauth/revoke</c> (com o cliente já extraído).</summary>
public class OAuthTokenRequestInfo
{
    public string? GrantType { get; set; }
    public string? Code { get; set; }
    public string? RedirectUri { get; set; }
    public string? CodeVerifier { get; set; }
    public string? RefreshToken { get; set; }
    public string? Scope { get; set; }
    public string? Resource { get; set; }
    public string? ClientId { get; set; }
    public string? ClientSecret { get; set; }

    /// <summary>Como o cliente se autenticou: <c>none</c>, <c>client_secret_post</c> ou <c>client_secret_basic</c>.</summary>
    public string? ClientAuthMethod { get; set; }

    /// <summary>Só no revoke (RFC 7009).</summary>
    public string? Token { get; set; }
    public string? TokenTypeHint { get; set; }
}

/// <summary>Resposta de sucesso do endpoint de token (RFC 6749 §5.1).</summary>
public class OAuthTokenResult
{
    [JsonPropertyName("access_token")]
    public string AccessToken { get; set; } = string.Empty;

    [JsonPropertyName("token_type")]
    public string TokenType { get; set; } = "Bearer";

    [JsonPropertyName("expires_in")]
    public int ExpiresIn { get; set; }

    [JsonPropertyName("refresh_token")]
    public string RefreshToken { get; set; } = string.Empty;

    [JsonPropertyName("scope")]
    public string Scope { get; set; } = string.Empty;
}

/// <summary>Erro do protocolo OAuth (RFC 6749 §5.2).</summary>
public class OAuthErrorResult
{
    [JsonPropertyName("error")]
    public string Error { get; set; } = string.Empty;

    [JsonPropertyName("error_description")]
    [JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingNull)]
    public string? ErrorDescription { get; set; }
}

/// <summary>Metadados do servidor de autorização (RFC 8414).</summary>
public class AuthorizationServerMetadata
{
    [JsonPropertyName("issuer")]
    public string Issuer { get; set; } = string.Empty;

    [JsonPropertyName("authorization_endpoint")]
    public string AuthorizationEndpoint { get; set; } = string.Empty;

    [JsonPropertyName("token_endpoint")]
    public string TokenEndpoint { get; set; } = string.Empty;

    [JsonPropertyName("registration_endpoint")]
    public string RegistrationEndpoint { get; set; } = string.Empty;

    [JsonPropertyName("revocation_endpoint")]
    public string RevocationEndpoint { get; set; } = string.Empty;

    [JsonPropertyName("response_types_supported")]
    public List<string> ResponseTypesSupported { get; set; } = new();

    [JsonPropertyName("grant_types_supported")]
    public List<string> GrantTypesSupported { get; set; } = new();

    [JsonPropertyName("code_challenge_methods_supported")]
    public List<string> CodeChallengeMethodsSupported { get; set; } = new();

    [JsonPropertyName("token_endpoint_auth_methods_supported")]
    public List<string> TokenEndpointAuthMethodsSupported { get; set; } = new();

    [JsonPropertyName("revocation_endpoint_auth_methods_supported")]
    public List<string> RevocationEndpointAuthMethodsSupported { get; set; } = new();

    [JsonPropertyName("scopes_supported")]
    public List<string> ScopesSupported { get; set; } = new();
}

/// <summary>Metadados do recurso protegido <c>/mcp</c> (RFC 9728).</summary>
public class ProtectedResourceMetadata
{
    [JsonPropertyName("resource")]
    public string Resource { get; set; } = string.Empty;

    [JsonPropertyName("authorization_servers")]
    public List<string> AuthorizationServers { get; set; } = new();

    [JsonPropertyName("scopes_supported")]
    public List<string> ScopesSupported { get; set; } = new();

    [JsonPropertyName("bearer_methods_supported")]
    public List<string> BearerMethodsSupported { get; set; } = new();

    [JsonPropertyName("resource_name")]
    public string ResourceName { get; set; } = string.Empty;
}

/// <summary>Resultado da validação de um token de acesso do MCP (esquema McpBearer).</summary>
public class OAuthAccessTokenInfo
{
    public long UserId { get; set; }
    public long GrantId { get; set; }
    public string ClientId { get; set; } = string.Empty;
    public string ClientName { get; set; } = string.Empty;
    public List<string> Scopes { get; set; } = new();
    public DateTime ExpiresAt { get; set; }

    /// <summary>Último uso registrado da conexão (para atualizar no máximo 1×/min).</summary>
    public DateTime? GrantLastUsedAt { get; set; }
}
