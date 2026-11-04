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
                 "(ex.: 0.0015). " + CREATE_PERMISSION_HINT + " Confirme carteira e valor com a pessoa antes. " +
                 KEY_HINT)]
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
                 "saldo não pode ficar negativo. " + CREATE_PERMISSION_HINT + " Confirme carteira e valor com a " +
                 "pessoa antes. " + KEY_HINT)]
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

    /// <summary>Feature 008 (contracts/mcp.md): permissão de lançar na família da carteira (de origem).</summary>
    internal const string CREATE_PERMISSION_HINT =
        "Se a carteira (de origem) é de uma família, é preciso ter permissão de lançar nela (o responsável sempre " +
        "tem); sem ela, a resposta é sem_permissao com a mensagem do app. Receber numa carteira nunca depende de " +
        "permissão.";

    /// <summary>Feature 007 (contracts/mcp.md): texto de regras das duas ferramentas de transferência.</summary>
    internal const string TRANSFER_RULES =
        "Regras: o destino deve ser da própria pessoa ou de alguém da família (use destinos_de_transferencia); " +
        "conversão entre real e bitcoin só entre carteiras da mesma pessoa. Entre pessoas diferentes, confirme o " +
        "tipo com a pessoa: emprestimo (quem recebe passa a dever), quitacao (paga uma dívida de quem envia com " +
        "quem recebe, total ou parcial; pode quitar dívida em real com bitcoin e vice-versa, pela cotação atual) " +
        "ou pagamento (sem dívida). Veja dividas_da_pessoa antes de quitar.";

    private const string DESTINATION_HINT =
        "Id da carteira de destino (ex.: 8); deve ser da própria pessoa ou de alguém da família; use destinos_de_transferencia.";

    private const string AMOUNT_HINT =
        "Opcional: valor na moeda da carteira de origem (ex.: 500.00). Informe valor ou valor_em_reais, nunca os " +
        "dois (ou nenhum, com quitar_tudo).";

    private const string AMOUNT_BRL_HINT =
        "Opcional: valor em reais para transferir bitcoin (origem e destino em bitcoin); o Finami converte pela " +
        "cotação atual. Informe valor ou valor_em_reais, nunca os dois.";

    private const string KIND_HINT =
        "Opcional: tipo quando o destino é de outra pessoa: emprestimo, quitacao ou pagamento (sem ele, vale " +
        "emprestimo). Não use entre carteiras da mesma pessoa.";

    private const string DEBT_CURRENCY_HINT =
        "Opcional, só para quitacao: moeda da dívida que está sendo quitada (BRL ou BTC); padrão = moeda das carteiras.";

    private const string SETTLE_ALL_HINT =
        "Opcional, só para quitacao: true quita a dívida inteira; não informe valor nem valor_em_reais.";

    [McpServerTool(Name = "previa_transferencia", Title = "Prévia de transferência", ReadOnly = true,
        Destructive = false, Idempotent = true, OpenWorld = false)]
    [Description("Simula uma transferência sem gravar nada: mostra o tipo (Transfer, BtcPurchase ou BtcSale), o " +
                 "valor que sai da origem, o valor que chega no destino, a cotação usada quando há conversão " +
                 "entre BRL e BTC ou quando o valor foi convertido, e, entre pessoas, o tipo e o efeito na dívida " +
                 "(antes e depois). Use antes de registrar_transferencia para confirmar com a pessoa. " +
                 TRANSFER_RULES + " " + CREATE_PERMISSION_HINT)]
    public Task<CallToolResult> PreviaTransferencia(ClaimsPrincipal user,
        [Description("Id da carteira de origem (ex.: 5).")] long carteira_origem_id,
        [Description(DESTINATION_HINT)] long carteira_destino_id,
        [Description(AMOUNT_HINT)] decimal? valor = null,
        [Description(AMOUNT_BRL_HINT)] decimal? valor_em_reais = null,
        [Description("Opcional: descrição.")] string? descricao = null,
        [Description(KIND_HINT)] string? tipo = null,
        [Description(DEBT_CURRENCY_HINT)] string? moeda_da_divida = null,
        [Description(SETTLE_ALL_HINT)] bool? quitar_tudo = null) =>
        ExecuteReadAsync(user, "previa_transferencia",
            userId => _ledgerService.PreviewTransferAsync(userId,
                Transfer(carteira_origem_id, carteira_destino_id, valor, valor_em_reais, descricao,
                    tipo, moeda_da_divida, quitar_tudo)),
            PreviewText);

    [McpServerTool(Name = "registrar_transferencia", Title = "Registrar transferência", ReadOnly = false,
        Destructive = false, Idempotent = false, OpenWorld = false)]
    [Description("Transfere entre carteiras da própria pessoa ou para a carteira de alguém da família. O valor é na " +
                 "moeda da carteira de origem; BRL→BTC vira compra e BTC→BRL vira venda na cotação atual. Entre " +
                 "carteiras de bitcoin, dá para informar valor_em_reais. O saldo pode ficar negativo. Use " +
                 "previa_transferencia e confirme com a pessoa antes. " + TRANSFER_RULES + " " +
                 CREATE_PERMISSION_HINT + " " + KEY_HINT)]
    public Task<CallToolResult> RegistrarTransferencia(ClaimsPrincipal user,
        [Description("Id da carteira de origem (ex.: 5).")] long carteira_origem_id,
        [Description(DESTINATION_HINT)] long carteira_destino_id,
        [Description(AMOUNT_HINT)] decimal? valor = null,
        [Description(AMOUNT_BRL_HINT)] decimal? valor_em_reais = null,
        [Description("Opcional: descrição (ex.: \"Mesada\").")] string? descricao = null,
        [Description("Opcional: chave de repetição segura (até 64 caracteres).")] string? chave_repeticao = null,
        [Description(KIND_HINT)] string? tipo = null,
        [Description(DEBT_CURRENCY_HINT)] string? moeda_da_divida = null,
        [Description(SETTLE_ALL_HINT)] bool? quitar_tudo = null) =>
        ExecuteWriteAsync(user, "registrar_transferencia", chave_repeticao,
            async userId => await WithBalanceAsync(userId, carteira_origem_id,
                await _ledgerService.TransferAsync(userId,
                    Transfer(carteira_origem_id, carteira_destino_id, valor, valor_em_reais, descricao,
                        tipo, moeda_da_divida, quitar_tudo))),
            t => $"Transferência de {McpFormat.Money(t.SourceAmount, t.Source.Currency)} de {t.Source.Name} para " +
                 $"{t.Destination.Name}" +
                 (t.Source.Currency != t.Destination.Currency
                     ? $" ({McpFormat.Money(t.DestinationAmount, t.Destination.Currency)} no destino)"
                     : string.Empty) +
                 (t.Quote != null && t.Source.Currency == t.Destination.Currency
                     ? $" (cotação 1 BTC = {McpFormat.Money(t.Quote.PriceBrl, McpFormat.BRL)})"
                     : string.Empty) +
                 $" registrada.{KindText(t)}{BalanceText(t)}",
            t => t.TransactionId);

    [McpServerTool(Name = "estornar_lancamento", Title = "Estornar lançamento", ReadOnly = false,
        Destructive = true, Idempotent = true, OpenWorld = false)]
    [Description("Estorna qualquer tipo de lançamento: cria um lançamento inverso que desfaz o efeito no saldo e " +
                 "na dívida (o original nunca é apagado). Precisa ser o responsável pela família, ter permissão de " +
                 "estornar nela ou ser o titular de uma carteira pessoal do lançamento. Um lançamento só pode ser " +
                 "estornado uma vez e um estorno não pode ser estornado. Confirme com a pessoa antes.")]
    public Task<CallToolResult> EstornarLancamento(ClaimsPrincipal user,
        [Description("Id do lançamento a estornar (transactionId, ex.: 120).")] long lancamento_id,
        [Description("Opcional: motivo do estorno (ex.: \"Lançado em duplicidade\").")] string? motivo = null) =>
        ExecuteWriteAsync(user, "estornar_lancamento", null,
            userId => _ledgerService.ReverseAsync(userId, lancamento_id, new ReverseInfo { Description = motivo }),
            t => $"Lançamento {lancamento_id} estornado pelo lançamento {t.TransactionId}: " +
                 $"{McpFormat.Money(t.SourceAmount, t.Source.Currency)} voltaram de {t.Source.Name} para {t.Destination.Name}.",
            t => t.TransactionId);

    private static TransferInfo Transfer(long source, long destination, decimal? amount, decimal? amountBrl,
        string? description, string? kind = null, string? debtCurrency = null, bool? settleAll = null) => new()
    {
        SourceWalletId = source,
        DestinationWalletId = destination,
        Amount = amount,
        AmountBrl = amountBrl,
        Description = description,
        Kind = KindCode(kind),
        DebtCurrency = string.IsNullOrWhiteSpace(debtCurrency) ? null : debtCurrency.Trim().ToUpperInvariant(),
        SettleAll = settleAll ?? false
    };

    /// <summary>Feature 007: <c>emprestimo → loan</c>, <c>quitacao → settlement</c>, <c>pagamento → payment</c>.</summary>
    internal static string? KindCode(string? tipo)
    {
        if (string.IsNullOrWhiteSpace(tipo))
            return null;
        return tipo.Trim().ToLowerInvariant() switch
        {
            "emprestimo" or "empréstimo" => "loan",
            "quitacao" or "quitação" => "settlement",
            "pagamento" => "payment",
            _ => throw new ValidationException(INVALID_KIND_MESSAGE, new[] { INVALID_KIND_MESSAGE })
        };
    }

    internal const string INVALID_KIND_MESSAGE = "Tipo inválido em 'tipo': use emprestimo, quitacao ou pagamento.";

    private static string KindLabel(string? kind) => kind switch
    {
        "loan" => "Empréstimo",
        "settlement" => "Quitação",
        "payment" => "Pagamento",
        _ => string.Empty
    };

    /// <summary>
    /// Texto da prévia: valores, cotação e, entre pessoas, o tipo e o efeito na dívida (contracts/mcp.md), ex.:
    /// "Quitação: abate R$ 100,00 da dívida de Bruno com Ana (de R$ 100,00 para R$ 0,00), pela cotação ₿ 1 = R$ 500.000,00.".
    /// </summary>
    internal static string PreviewText(TransferPreviewResult p)
    {
        var text = p.Quote == null
            ? $"Prévia ({p.Type}): sai {McpFormat.Money(p.SourceAmount, null)} da origem e chega o mesmo valor no destino."
            : $"Prévia ({p.Type}): sai {p.SourceAmount} da origem e chegam {p.DestinationAmount} no destino, " +
              $"com 1 BTC = {McpFormat.Money(p.Quote.PriceBrl, McpFormat.BRL)}.";
        var debt = p.Debt;
        switch (p.Kind)
        {
            case "payment":
                return $"{text} Pagamento: não gera dívida.";
            case "loan" when debt != null:
                return $"{text} Empréstimo: {debt.DebtorFirstName} passa a dever " +
                       $"{McpFormat.Money(debt.Amount, debt.Currency)} a {debt.CreditorFirstName} " +
                       $"(dívida de {McpFormat.Money(debt.Before, debt.Currency)} para " +
                       $"{McpFormat.Money(debt.After, debt.Currency)}).";
            case "settlement" when debt != null:
                return $"{text} Quitação: abate {McpFormat.Money(debt.Amount, debt.Currency)} da dívida de " +
                       $"{debt.DebtorFirstName} com {debt.CreditorFirstName} " +
                       $"(de {McpFormat.Money(debt.Before, debt.Currency)} para " +
                       $"{McpFormat.Money(debt.After, debt.Currency)})" +
                       (p.Quote != null ? $", pela cotação ₿ 1 = {McpFormat.Money(p.Quote.PriceBrl, McpFormat.BRL)}" : string.Empty) +
                       ".";
            default:
                return text;
        }
    }

    /// <summary>Tipo e efeito na dívida no resumo do registro (feature 007).</summary>
    private static string KindText(McpTransactionResult t) => t.TransferKind switch
    {
        "loan" when t.DebtAmount.HasValue =>
            $" {KindLabel(t.TransferKind)}: gera dívida de {McpFormat.Money(t.DebtAmount.Value, t.DebtCurrency)}.",
        "settlement" when t.DebtAmount.HasValue =>
            $" {KindLabel(t.TransferKind)}: abate {McpFormat.Money(t.DebtAmount.Value, t.DebtCurrency)} da dívida.",
        "payment" => " Pagamento: não gera dívida.",
        _ => string.Empty
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
