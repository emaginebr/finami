using System.ComponentModel;
using System.Security.Claims;
using Finami.Domain.Exceptions;
using Finami.Domain.Interfaces;
using Finami.DTO.Transactions;
using ModelContextProtocol.Protocol;
using ModelContextProtocol.Server;

namespace Finami.API.Mcp.Tools;

/// <summary>
/// Receitas, despesas, transferências e estornos (US3, contracts/mcp-tools.md). Mesmos serviços e mensagens do
/// <c>TransactionsController</c>; o resumo traz o saldo novo da carteira afetada.
/// </summary>
[McpServerToolType]
public class TransactionTools : McpToolBase
{
    private const string KEY_HINT =
        "Opcional: chave_repeticao (até 64 caracteres, ex.: um UUID) torna a chamada segura para repetir: " +
        "com a mesma chave, o lançamento é feito uma vez só e as repetições devolvem o mesmo resultado.";

    private readonly ILedgerService _ledgerService;
    private readonly IWalletService _walletService;

    public TransactionTools(ILedgerService ledgerService, IWalletService walletService,
        IMcpIdempotencyService idempotency, IMcpAuditService audit, ILogger<TransactionTools> logger)
        : base(logger, idempotency, audit)
    {
        _ledgerService = ledgerService;
        _walletService = walletService;
    }

    [McpServerTool(Name = "registrar_receita", Title = "Registrar receita", ReadOnly = false, Destructive = false,
        Idempotent = false, OpenWorld = false)]
    [Description("Registra uma entrada de dinheiro vinda de fora do app (salário, venda, presente) numa carteira. " +
                 "O valor é na moeda da carteira: reais com até 2 casas (ex.: 3500.00) ou bitcoin com até 8 " +
                 "(ex.: 0.0015). Confirme carteira e valor com a pessoa antes. " + KEY_HINT)]
    public Task<CallToolResult> RegistrarReceita(ClaimsPrincipal user,
        [Description("Id da carteira que recebe (ex.: 5). Use listar_carteiras.")] long carteira_id,
        [Description("Valor positivo na moeda da carteira (ex.: 3500.00).")] decimal valor,
        [Description("Opcional: descrição (ex.: \"Salário de outubro\").")] string? descricao = null,
        [Description("Opcional: chave de repetição segura (até 64 caracteres).")] string? chave_repeticao = null) =>
        ExecuteWriteAsync(user, "registrar_receita", chave_repeticao,
            async userId => await WithBalanceAsync(userId, carteira_id,
                await _ledgerService.IncomeAsync(userId,
                    new IncomeInfo { WalletId = carteira_id, Amount = valor, Description = descricao })),
            t => $"Receita de {McpFormat.Money(t.DestinationAmount, t.Destination.Currency)} registrada em " +
                 $"{t.Destination.Name}.{BalanceText(t)}",
            t => t.TransactionId);

    [McpServerTool(Name = "registrar_despesa", Title = "Registrar despesa", ReadOnly = false, Destructive = false,
        Idempotent = false, OpenWorld = false)]
    [Description("Registra uma saída de dinheiro para fora do app (compra, conta, pagamento) de uma carteira. " +
                 "O valor é na moeda da carteira: reais com até 2 casas (ex.: 80.00) ou bitcoin com até 8. O " +
                 "saldo não pode ficar negativo. Confirme carteira e valor com a pessoa antes. " + KEY_HINT)]
    public Task<CallToolResult> RegistrarDespesa(ClaimsPrincipal user,
        [Description("Id da carteira que paga (ex.: 5). Use listar_carteiras.")] long carteira_id,
        [Description("Valor positivo na moeda da carteira (ex.: 80.00).")] decimal valor,
        [Description("Opcional: descrição (ex.: \"Mercado\").")] string? descricao = null,
        [Description("Opcional: chave de repetição segura (até 64 caracteres).")] string? chave_repeticao = null) =>
        ExecuteWriteAsync(user, "registrar_despesa", chave_repeticao,
            async userId => await WithBalanceAsync(userId, carteira_id,
                await _ledgerService.ExpenseAsync(userId,
                    new ExpenseInfo { WalletId = carteira_id, Amount = valor, Description = descricao })),
            t => $"Despesa de {McpFormat.Money(t.SourceAmount, t.Source.Currency)} registrada em " +
                 $"{t.Source.Name}.{BalanceText(t)}",
            t => t.TransactionId);

    [McpServerTool(Name = "previa_transferencia", Title = "Prévia de transferência", ReadOnly = true,
        Destructive = false, Idempotent = true, OpenWorld = false)]
    [Description("Simula uma transferência sem gravar nada: mostra o tipo (Transfer, BtcPurchase ou BtcSale), o " +
                 "valor que sai da origem, o valor que chega no destino e a cotação usada quando há conversão " +
                 "entre BRL e BTC. Use antes de registrar_transferencia para confirmar com a pessoa.")]
    public Task<CallToolResult> PreviaTransferencia(ClaimsPrincipal user,
        [Description("Id da carteira de origem (ex.: 5).")] long carteira_origem_id,
        [Description("Id da carteira de destino (ex.: 8); pode ser de outra pessoa.")] long carteira_destino_id,
        [Description("Valor na moeda da carteira de origem (ex.: 500.00).")] decimal valor,
        [Description("Opcional: descrição.")] string? descricao = null) =>
        ExecuteReadAsync(user, "previa_transferencia",
            userId => _ledgerService.PreviewTransferAsync(userId, Transfer(carteira_origem_id, carteira_destino_id, valor, descricao)),
            p => p.Quote == null
                ? $"Prévia ({p.Type}): sai {McpFormat.Money(p.SourceAmount, null)} da origem e chega o mesmo valor no destino."
                : $"Prévia ({p.Type}): sai {p.SourceAmount} da origem e chegam {p.DestinationAmount} no destino, " +
                  $"com 1 BTC = {McpFormat.Money(p.Quote.PriceBrl, McpFormat.BRL)}.");

    [McpServerTool(Name = "registrar_transferencia", Title = "Registrar transferência", ReadOnly = false,
        Destructive = false, Idempotent = false, OpenWorld = false)]
    [Description("Transfere entre carteiras (inclusive para a carteira de outra pessoa). O valor é na moeda da " +
                 "carteira de origem; BRL→BTC vira compra e BTC→BRL vira venda na cotação atual. A origem não " +
                 "pode ficar negativa. Use previa_transferencia e confirme com a pessoa antes. " + KEY_HINT)]
    public Task<CallToolResult> RegistrarTransferencia(ClaimsPrincipal user,
        [Description("Id da carteira de origem (ex.: 5).")] long carteira_origem_id,
        [Description("Id da carteira de destino (ex.: 8).")] long carteira_destino_id,
        [Description("Valor na moeda da carteira de origem (ex.: 500.00).")] decimal valor,
        [Description("Opcional: descrição (ex.: \"Mesada\").")] string? descricao = null,
        [Description("Opcional: chave de repetição segura (até 64 caracteres).")] string? chave_repeticao = null) =>
        ExecuteWriteAsync(user, "registrar_transferencia", chave_repeticao,
            async userId => await WithBalanceAsync(userId, carteira_origem_id,
                await _ledgerService.TransferAsync(userId, Transfer(carteira_origem_id, carteira_destino_id, valor, descricao))),
            t => $"Transferência de {McpFormat.Money(t.SourceAmount, t.Source.Currency)} de {t.Source.Name} para " +
                 $"{t.Destination.Name}" +
                 (t.Source.Currency != t.Destination.Currency
                     ? $" ({McpFormat.Money(t.DestinationAmount, t.Destination.Currency)} no destino)"
                     : string.Empty) +
                 $" registrada.{BalanceText(t)}",
            t => t.TransactionId);

    [McpServerTool(Name = "estornar_lancamento", Title = "Estornar lançamento", ReadOnly = false,
        Destructive = true, Idempotent = true, OpenWorld = false)]
    [Description("Estorna um lançamento: cria um lançamento inverso que desfaz o efeito no saldo (o original nunca " +
                 "é apagado). Um lançamento só pode ser estornado uma vez e um estorno não pode ser estornado. " +
                 "Confirme com a pessoa antes.")]
    public Task<CallToolResult> EstornarLancamento(ClaimsPrincipal user,
        [Description("Id do lançamento a estornar (transactionId, ex.: 120).")] long lancamento_id,
        [Description("Opcional: motivo do estorno (ex.: \"Lançado em duplicidade\").")] string? motivo = null) =>
        ExecuteWriteAsync(user, "estornar_lancamento", null,
            userId => _ledgerService.ReverseAsync(userId, lancamento_id, new ReverseInfo { Description = motivo }),
            t => $"Lançamento {lancamento_id} estornado pelo lançamento {t.TransactionId}: " +
                 $"{McpFormat.Money(t.SourceAmount, t.Source.Currency)} voltaram de {t.Source.Name} para {t.Destination.Name}.",
            t => t.TransactionId);

    private static TransferInfo Transfer(long source, long destination, decimal amount, string? description) => new()
    {
        SourceWalletId = source,
        DestinationWalletId = destination,
        Amount = amount,
        Description = description
    };

    /// <summary>Acrescenta o saldo novo da carteira; se ela não puder ser lida, o lançamento continua valendo.</summary>
    private async Task<McpTransactionResult> WithBalanceAsync(long userId, long walletId, TransactionInfo info)
    {
        var result = McpTransactionResult.From(info);
        try
        {
            var wallet = await _walletService.GetAsync(userId, walletId);
            result.WalletId = wallet.WalletId;
            result.WalletName = wallet.Name;
            result.WalletBalance = wallet.Balance;
            result.WalletCurrency = wallet.Currency;
        }
        catch (DomainException)
        {
            // Sem saldo no resumo.
        }
        return result;
    }

    private static string BalanceText(McpTransactionResult t) =>
        t.WalletBalance.HasValue ? $" Saldo: {McpFormat.Money(t.WalletBalance.Value, t.WalletCurrency)}." : string.Empty;
}
