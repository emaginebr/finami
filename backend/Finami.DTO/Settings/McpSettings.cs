namespace Finami.DTO.Settings;

/// <summary>Servidor MCP e OAuth do Finami (research R-03, R-09, R-11).</summary>
public class McpSettings
{
    /// <summary>URL pública da API (issuer do OAuth e base do recurso <c>{PublicUrl}/mcp</c>), sem barra final.</summary>
    public string PublicUrl { get; set; } = string.Empty;

    public int AccessTokenMinutes { get; set; } = 60;
    public int RefreshTokenDays { get; set; } = 30;

    /// <summary>Validade do pedido de autorização e do código emitido.</summary>
    public int CodeMinutes { get; set; } = 10;

    /// <summary>Chamadas por minuto por conexão em <c>/mcp</c> (FR-023); 0 desliga o limite.</summary>
    public int RateLimitPerMinute { get; set; } = 60;

    /// <summary>Registros de cliente por hora por IP em <c>/oauth/register</c>; 0 desliga o limite.</summary>
    public int RegisterRateLimitPerHour { get; set; } = 10;

    /// <summary>Chamadas por minuto por IP em <c>/oauth/token</c>; 0 desliga o limite.</summary>
    public int TokenRateLimitPerMinute { get; set; } = 30;

    /// <summary>Liga a limpeza horária de pedidos, tokens, chaves de repetição e auditoria (research R-10).</summary>
    public bool CleanupEnabled { get; set; } = true;
}
