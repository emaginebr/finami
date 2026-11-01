using System.ComponentModel;
using System.Security.Claims;
using Finami.Domain.Exceptions;
using Finami.Domain.Interfaces;
using Finami.DTO.Balances;
using Finami.DTO.Quotes;
using ModelContextProtocol.Protocol;
using ModelContextProtocol.Server;

namespace Finami.API.Mcp.Tools;

/// <summary>Saldos: total da Home, por família e por pessoa (contracts/mcp-tools.md).</summary>
[McpServerToolType]
public class BalanceTools : McpToolBase
{
    private readonly IWalletService _walletService;
    private readonly IQuoteService _quoteService;
    private readonly IBalanceService _balanceService;

    public BalanceTools(IWalletService walletService, IQuoteService quoteService, IBalanceService balanceService,
        ILogger<BalanceTools> logger) : base(logger)
    {
        _walletService = walletService;
        _quoteService = quoteService;
        _balanceService = balanceService;
    }

    [McpServerTool(Name = "saldo_total", Title = "Saldo total", ReadOnly = true, Destructive = false,
        Idempotent = true, OpenWorld = false)]
    [Description("Saldo total da pessoa conectada, igual ao da tela inicial do app: soma, em reais (BRL), das " +
                 "carteiras ativas de que ela é titular, convertendo bitcoin (BTC) pela cotação atual. Devolve " +
                 "totalBrl (ex.: 1420.50), o saldo por moeda (porMoeda.BRL, porMoeda.BTC) e a cotação usada. " +
                 "Sem cotação, o BTC fica fora do total e btcExcluido = true.")]
    public Task<CallToolResult> SaldoTotal(ClaimsPrincipal user) =>
        ExecuteReadAsync(user, "saldo_total", ComputeTotalAsync, total =>
        {
            var text = $"Saldo total: {McpFormat.Money(total.TotalBrl, McpFormat.BRL)}";
            if (total.PorMoeda.TryGetValue(McpFormat.BTC, out var btc) && btc != 0)
                text += total.BtcExcluido
                    ? $" (sem os {McpFormat.Money(btc, McpFormat.BTC)}: cotação do bitcoin indisponível)"
                    : $" (inclui {McpFormat.Money(btc, McpFormat.BTC)} a {McpFormat.Money(total.Cotacao!.PriceBrl, McpFormat.BRL)} por BTC)";
            return text + $" em {McpFormat.Count(total.QuantidadeCarteiras, "carteira", "carteiras")}.";
        });

    /// <summary>Mesma fórmula do <c>computeHomeTotal</c> do frontend (carteiras ativas próprias; BTC por <c>estimatedBrl</c>).</summary>
    private async Task<McpTotalBalanceResult> ComputeTotalAsync(long userId)
    {
        BtcQuoteInfo? quote;
        try
        {
            quote = await _quoteService.GetCurrentAsync();
        }
        catch (QuoteUnavailableException)
        {
            quote = null;
        }

        var wallets = (await _walletService.ListAsync(userId, null, null, false))
            .Where(w => w.IsActive && w.OwnerUserId == userId)
            .ToList();

        var result = new McpTotalBalanceResult
        {
            Cotacao = quote,
            QuantidadeCarteiras = wallets.Count,
            PorMoeda = new Dictionary<string, decimal> { [McpFormat.BRL] = 0m, [McpFormat.BTC] = 0m }
        };
        foreach (var wallet in wallets)
        {
            if (wallet.Currency == McpFormat.BTC)
            {
                result.PorMoeda[McpFormat.BTC] += wallet.Balance;
                if (quote != null && wallet.EstimatedBrl.HasValue)
                    result.TotalBrl += wallet.EstimatedBrl.Value;
                else
                    result.BtcExcluido = true;
            }
            else
            {
                result.PorMoeda[McpFormat.BRL] += wallet.Balance;
                result.TotalBrl += wallet.Balance;
            }
        }
        return result;
    }

    [McpServerTool(Name = "saldos_da_familia", Title = "Saldos da família", ReadOnly = true, Destructive = false,
        Idempotent = true, OpenWorld = false)]
    [Description("Saldo de cada membro de uma família, em reais (BRL) e bitcoin (BTC), com o total da família em " +
                 "reais. O nível de detalhe (Full, Summary ou Hidden) segue a visibilidade configurada na família. " +
                 "Use listar_familias para descobrir o id.")]
    public Task<CallToolResult> SaldosDaFamilia(ClaimsPrincipal user,
        [Description("Id da família (ex.: 3).")] long familia_id) =>
        ExecuteReadAsync(user, "saldos_da_familia",
            userId => _balanceService.GetGroupBalancesAsync(userId, familia_id),
            result => result.DetailLevel == DetailLevel.Hidden || result.TotalBrl == null
                ? $"Família {result.Name}: {McpFormat.Count(result.Members.Count, "membro", "membros")}; os saldos não estão visíveis para você."
                : $"Família {result.Name}: total de {McpFormat.Money(result.TotalBrl.Value, McpFormat.BRL)} entre " +
                  $"{McpFormat.Count(result.Members.Count, "membro", "membros")}." +
                  (result.BtcExcluded ? " O bitcoin ficou fora do total (cotação indisponível)." : string.Empty));

    [McpServerTool(Name = "saldos_da_pessoa", Title = "Saldos da pessoa", ReadOnly = true, Destructive = false,
        Idempotent = true, OpenWorld = false)]
    [Description("Carteiras e saldos de uma pessoa em cada família visível para você, com o total em reais (BRL). " +
                 "Para você mesmo, informe o seu id (veja obter_perfil). Ids de membros vêm de obter_familia.")]
    public Task<CallToolResult> SaldosDaPessoa(ClaimsPrincipal user,
        [Description("Id da pessoa (ex.: 12).")] long pessoa_id) =>
        ExecuteReadAsync(user, "saldos_da_pessoa",
            userId => _balanceService.GetUserGroupBalancesAsync(userId, pessoa_id),
            result => $"{result.FirstName} {result.LastName}: {McpFormat.Money(result.TotalBrl, McpFormat.BRL)} em " +
                      $"{McpFormat.Count(result.Groups.Count, "família", "famílias")}." +
                      (result.BtcExcluded ? " O bitcoin ficou fora do total (cotação indisponível)." : string.Empty));
}
