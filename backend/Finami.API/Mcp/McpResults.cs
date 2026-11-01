using System.Text.Json;
using System.Text.Json.Serialization;
using Finami.DTO.Notifications;
using Finami.DTO.Quotes;
using Finami.DTO.Statements;
using Finami.DTO.Transactions;

namespace Finami.API.Mcp;

// Resultados estruturados que só o MCP devolve. Herdam o DTO do domínio quando há um (mesmos campos camelCase da
// API) e acrescentam o que a ferramenta precisa: cursor da próxima página ou saldo novo da carteira.

/// <summary><c>saldo_total</c>: mesmo cálculo da Home (research R-12).</summary>
public class McpTotalBalanceResult
{
    /// <summary>Soma em reais das carteiras ativas de que a pessoa é titular (BTC convertido pela cotação).</summary>
    [JsonPropertyName("totalBrl")]
    public decimal TotalBrl { get; set; }

    /// <summary>Saldo somado em cada moeda: <c>{ "BRL": 1420.00, "BTC": 0.0123 }</c>.</summary>
    [JsonPropertyName("porMoeda")]
    public Dictionary<string, decimal> PorMoeda { get; set; } = new();

    /// <summary>Cotação usada na conversão; null quando indisponível.</summary>
    [JsonPropertyName("cotacao")]
    public BtcQuoteInfo? Cotacao { get; set; }

    /// <summary>True quando há BTC e não há cotação: o BTC ficou fora de <c>totalBrl</c>.</summary>
    [JsonPropertyName("btcExcluido")]
    public bool BtcExcluido { get; set; }

    [JsonPropertyName("quantidadeCarteiras")]
    public int QuantidadeCarteiras { get; set; }
}

/// <summary>Página de extrato: o <see cref="StatementResult"/> do domínio com só os lançamentos da página.</summary>
public class McpStatementPage : StatementResult
{
    /// <summary>Quantidade de lançamentos do período inteiro.</summary>
    [JsonPropertyName("totalEntries")]
    public int TotalEntries { get; set; }

    [JsonPropertyName("proximoCursor")]
    public string? ProximoCursor { get; set; }
}

/// <summary>Página de notificações com o cursor no padrão do MCP.</summary>
public class McpNotificationPage : NotificationPage
{
    [JsonPropertyName("proximoCursor")]
    public string? ProximoCursor { get; set; }
}

/// <summary>Lançamento gravado + saldo novo da carteira afetada (para o resumo em português).</summary>
public class McpTransactionResult : TransactionInfo
{
    [JsonPropertyName("walletId")]
    public long? WalletId { get; set; }

    [JsonPropertyName("walletName")]
    public string? WalletName { get; set; }

    [JsonPropertyName("walletBalance")]
    public decimal? WalletBalance { get; set; }

    [JsonPropertyName("walletCurrency")]
    public string? WalletCurrency { get; set; }

    /// <summary>Copia o DTO do domínio (mesma serialização da API).</summary>
    public static McpTransactionResult From(TransactionInfo info) =>
        JsonSerializer.Deserialize<McpTransactionResult>(JsonSerializer.Serialize(info))!;
}

/// <summary><c>excluir_carteira</c>: a API devolve 204; o MCP confirma o que foi excluído.</summary>
public class McpWalletDeletedResult
{
    [JsonPropertyName("walletId")]
    public long WalletId { get; set; }

    [JsonPropertyName("name")]
    public string Name { get; set; } = string.Empty;

    [JsonPropertyName("deleted")]
    public bool Deleted { get; set; }
}

/// <summary><c>finami://notificacoes/nao-lidas</c>.</summary>
public class McpUnreadNotificationsResult
{
    [JsonPropertyName("unread")]
    public int Unread { get; set; }

    [JsonPropertyName("items")]
    public List<NotificationInfo> Items { get; set; } = new();
}
