using System.ComponentModel;
using System.Security.Claims;
using Finami.Domain.Interfaces;
using Finami.DTO.Wallets;
using ModelContextProtocol.Protocol;
using ModelContextProtocol.Server;

namespace Finami.API.Mcp.Tools;

/// <summary>Consulta de carteiras (contracts/mcp-tools.md).</summary>
[McpServerToolType]
public class WalletReadTools : McpToolBase
{
    private readonly IWalletService _walletService;

    public WalletReadTools(IWalletService walletService, ILogger<WalletReadTools> logger) : base(logger)
    {
        _walletService = walletService;
    }

    [McpServerTool(Name = "listar_carteiras", Title = "Listar carteiras", ReadOnly = true, Destructive = false,
        Idempotent = true, OpenWorld = false)]
    [Description("Lista as carteiras que a pessoa controla (as próprias e as das famílias de que é responsável), " +
                 "com id, nome, moeda (BRL ou BTC), saldo e valor estimado em reais das carteiras BTC. Use para " +
                 "descobrir o carteira_id antes de lançar receitas, despesas e transferências.")]
    public Task<CallToolResult> ListarCarteiras(ClaimsPrincipal user,
        [Description("Opcional: só as carteiras vinculadas a esta família (ex.: 3).")] long? familia_id = null,
        [Description("Opcional: só as carteiras deste titular (ex.: 12).")] long? dono_id = null,
        [Description("Opcional: true para incluir carteiras desativadas (padrão false).")] bool? incluir_inativas = null) =>
        ExecuteReadAsync(user, "listar_carteiras",
            userId => _walletService.ListAsync(userId, dono_id, familia_id, incluir_inativas ?? false),
            wallets => wallets.Count == 0
                ? "Nenhuma carteira encontrada."
                : $"{McpFormat.Count(wallets.Count, "carteira", "carteiras")}: " +
                  string.Join("; ", wallets.Select(Describe)) + ".");

    [McpServerTool(Name = "obter_carteira", Title = "Obter carteira", ReadOnly = true, Destructive = false,
        Idempotent = true, OpenWorld = false)]
    [Description("Detalhes e saldo de uma carteira que a pessoa controla: nome, descrição, moeda (BRL ou BTC), " +
                 "titular, família, saldo e valor estimado em reais (BTC).")]
    public Task<CallToolResult> ObterCarteira(ClaimsPrincipal user,
        [Description("Id da carteira (ex.: 5). Use listar_carteiras para descobrir.")] long carteira_id) =>
        ExecuteReadAsync(user, "obter_carteira",
            userId => _walletService.GetAsync(userId, carteira_id),
            wallet => $"Carteira {Describe(wallet)}.");

    internal static string Describe(WalletInfo wallet)
    {
        var text = $"{wallet.Name} (id {wallet.WalletId}): {McpFormat.Money(wallet.Balance, wallet.Currency)}";
        if (wallet.Currency == McpFormat.BTC && wallet.EstimatedBrl.HasValue)
            text += $" ≈ {McpFormat.Money(wallet.EstimatedBrl.Value, McpFormat.BRL)}";
        if (!wallet.IsActive)
            text += ", desativada";
        return text;
    }
}
