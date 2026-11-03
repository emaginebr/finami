using System.ComponentModel;
using System.Security.Claims;
using Finami.API.Extensions;
using Finami.Domain.Interfaces;
using Finami.DTO.Debts;
using ModelContextProtocol.Protocol;
using ModelContextProtocol.Server;

namespace Finami.API.Mcp.Tools;

/// <summary>Dívidas entre pessoas (feature 006, contracts/mcp.md).</summary>
[McpServerToolType]
public class DebtTools : McpToolBase
{
    private readonly IDebtService _debtService;

    public DebtTools(IDebtService debtService, ILogger<DebtTools> logger) : base(logger)
    {
        _debtService = debtService;
    }

    [McpServerTool(Name = "dividas_da_pessoa", Title = "Dívidas da pessoa", ReadOnly = true, Destructive = false,
        Idempotent = true, OpenWorld = false)]
    [Description("Mostra quanto a pessoa deve a cada pessoa da família e quanto cada uma deve a ela, separado por " +
                 "moeda. Toda transferência entre pessoas diferentes vira dívida de quem recebeu com quem enviou; " +
                 "transferências no sentido contrário compensam. direction = owes (a pessoa deve) ou owed (devem a ela).")]
    public Task<CallToolResult> DividasDaPessoa(ClaimsPrincipal user,
        [Description("Opcional: id da pessoa (ex.: 12); padrão = a pessoa conectada. Ids de membros vêm de obter_familia.")]
        long? pessoa_id = null) =>
        ExecuteReadAsync(user, "dividas_da_pessoa",
            userId => _debtService.GetPersonDebtsAsync(userId, pessoa_id ?? userId),
            result => Summarize(result, result.UserId == user.GetUserId()));

    internal static string Summarize(PersonDebtsResult result, bool self)
    {
        if (result.Debts.Count == 0)
            return "Nenhuma dívida em aberto.";
        var lines = result.Debts.Select(d =>
        {
            var amount = McpFormat.Money(d.Amount, d.Currency);
            var name = string.IsNullOrWhiteSpace(d.CounterpartFirstName) ? d.CounterpartName : d.CounterpartFirstName;
            return d.Direction == DebtDirections.OWES
                ? self ? $"você deve {amount} a {name}" : $"deve {amount} a {name}"
                : self ? $"{name} deve {amount} a você" : $"{name} deve {amount} a ela";
        });
        return $"{McpFormat.Count(result.Debts.Count, "dívida", "dívidas")}: {string.Join("; ", lines)}.";
    }
}
