using System.ComponentModel;
using System.Security.Claims;
using Finami.Domain.Interfaces;
using ModelContextProtocol.Protocol;
using ModelContextProtocol.Server;

namespace Finami.API.Mcp.Tools;

/// <summary>Cotação do bitcoin (contracts/mcp-tools.md).</summary>
[McpServerToolType]
public class QuoteTools : McpToolBase
{
    private readonly IQuoteService _quoteService;

    public QuoteTools(IQuoteService quoteService, ILogger<QuoteTools> logger) : base(logger)
    {
        _quoteService = quoteService;
    }

    [McpServerTool(Name = "cotacao_bitcoin", Title = "Cotação do bitcoin", ReadOnly = true, Destructive = false,
        Idempotent = true, OpenWorld = false)]
    [Description("Preço de 1 bitcoin (BTC) em reais (BRL), com a data da cotação e a fonte (ex.: priceBrl " +
                 "350000.00). Se a fonte estiver fora do ar, devolve a última cotação conhecida com isStale = true.")]
    public Task<CallToolResult> CotacaoBitcoin(ClaimsPrincipal user) =>
        ExecuteReadAsync(user, "cotacao_bitcoin",
            _ => _quoteService.GetCurrentAsync(),
            quote => $"1 BTC = {McpFormat.Money(quote.PriceBrl, McpFormat.BRL)} ({quote.Source}, " +
                     $"{McpFormat.LocalDateTime(quote.QuotedAt)})" +
                     (quote.IsStale ? ". Atenção: cotação desatualizada." : "."));
}
