using System.Text.Json.Serialization;

namespace Finami.DTO.OAuth;

// DTOs das rotas do app /api/oauth/* (camelCase, contracts/api.md).

/// <summary>Pedido de autorização exibido na tela <c>/autorizar</c>.</summary>
public class OAuthRequestInfo
{
    [JsonPropertyName("requestKey")]
    public string RequestKey { get; set; } = string.Empty;

    [JsonPropertyName("clientName")]
    public string ClientName { get; set; } = string.Empty;

    /// <summary>Domínio do endereço de retorno (ex.: <c>claude.ai</c>).</summary>
    [JsonPropertyName("redirectHost")]
    public string RedirectHost { get; set; } = string.Empty;

    [JsonPropertyName("scopesRequested")]
    public List<string> ScopesRequested { get; set; } = new();

    [JsonPropertyName("expiresAt")]
    public DateTime ExpiresAt { get; set; }
}

/// <summary>Corpo de <c>POST /api/oauth/requests/{requestKey}/approve</c>.</summary>
public class OAuthApproveInfo
{
    [JsonPropertyName("scopes")]
    public List<string> Scopes { get; set; } = new();
}

/// <summary>Endereço para onde o frontend deve mandar o navegador (aprovar/negar).</summary>
public class OAuthRedirectResult
{
    [JsonPropertyName("redirectUrl")]
    public string RedirectUrl { get; set; } = string.Empty;
}

/// <summary>Assistente conectado (seção da tela Conta).</summary>
public class OAuthConnectionInfo
{
    [JsonPropertyName("connectionId")]
    public long ConnectionId { get; set; }

    [JsonPropertyName("clientName")]
    public string ClientName { get; set; } = string.Empty;

    [JsonPropertyName("scopes")]
    public List<string> Scopes { get; set; } = new();

    [JsonPropertyName("createdAt")]
    public DateTime CreatedAt { get; set; }

    [JsonPropertyName("lastUsedAt")]
    public DateTime? LastUsedAt { get; set; }
}

/// <summary>Endereço do servidor MCP exibido para copiar.</summary>
public class McpInfoResult
{
    [JsonPropertyName("mcpUrl")]
    public string McpUrl { get; set; } = string.Empty;
}
