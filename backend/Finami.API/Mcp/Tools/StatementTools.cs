using System.ComponentModel;
using System.Security.Claims;
using Finami.Domain.Interfaces;
using Finami.DTO.Statements;
using ModelContextProtocol.Protocol;
using ModelContextProtocol.Server;

namespace Finami.API.Mcp.Tools;

/// <summary>
/// Extratos paginados e detalhe de lançamento (contracts/mcp-tools.md). O domínio devolve o período inteiro; a
/// ferramenta pagina com <see cref="McpPaging"/> e mantém os totais (saldo inicial e final) em todas as páginas.
/// </summary>
[McpServerToolType]
public class StatementTools : McpToolBase
{
    private const string PERIOD_HINT =
        "Datas no formato AAAA-MM-DD, no fuso de São Paulo, inclusivas (ex.: inicio 2026-10-01, fim 2026-10-31); " +
        "período de no máximo 1 ano. Paginado: limite de 1 a 50 (padrão 20); para a próxima página, repita a " +
        "chamada com o mesmo período e cursor = proximoCursor (null na última).";

    private readonly IStatementService _statementService;
    private readonly ILedgerService _ledgerService;

    public StatementTools(IStatementService statementService, ILedgerService ledgerService,
        ILogger<StatementTools> logger) : base(logger)
    {
        _statementService = statementService;
        _ledgerService = ledgerService;
    }

    [McpServerTool(Name = "extrato_carteira", Title = "Extrato da carteira", ReadOnly = true, Destructive = false,
        Idempotent = true, OpenWorld = false)]
    [Description("Extrato de uma carteira no período: saldo inicial, entradas, saídas, saldo final (na moeda da " +
                 "carteira) e os lançamentos (valor negativo = saída). " + PERIOD_HINT)]
    public Task<CallToolResult> ExtratoCarteira(ClaimsPrincipal user,
        [Description("Id da carteira (ex.: 5).")] long carteira_id,
        [Description("Primeiro dia do período, AAAA-MM-DD (ex.: 2026-10-01).")] string inicio,
        [Description("Último dia do período, AAAA-MM-DD (ex.: 2026-10-31).")] string fim,
        [Description("Opcional: lançamentos por página, de 1 a 50 (padrão 20).")] int? limite = null,
        [Description("Opcional: proximoCursor devolvido pela página anterior.")] string? cursor = null) =>
        Statement(user, "extrato_carteira", inicio, fim, limite, cursor,
            (userId, start, end) => _statementService.GetWalletStatementAsync(userId, carteira_id, start, end));

    [McpServerTool(Name = "extrato_pessoa", Title = "Extrato da pessoa", ReadOnly = true, Destructive = false,
        Idempotent = true, OpenWorld = false)]
    [Description("Extrato de todas as carteiras de uma pessoa no período (você mesmo, alguém que você cadastrou " +
                 "ou um membro de família cujo extrato é visível para você), com totais por moeda. " + PERIOD_HINT)]
    public Task<CallToolResult> ExtratoPessoa(ClaimsPrincipal user,
        [Description("Id da pessoa (ex.: 12). Para você mesmo, use o id de obter_perfil.")] long pessoa_id,
        [Description("Primeiro dia do período, AAAA-MM-DD (ex.: 2026-10-01).")] string inicio,
        [Description("Último dia do período, AAAA-MM-DD (ex.: 2026-10-31).")] string fim,
        [Description("Opcional: lançamentos por página, de 1 a 50 (padrão 20).")] int? limite = null,
        [Description("Opcional: proximoCursor devolvido pela página anterior.")] string? cursor = null) =>
        Statement(user, "extrato_pessoa", inicio, fim, limite, cursor,
            (userId, start, end) => _statementService.GetUserStatementAsync(userId, pessoa_id, start, end));

    [McpServerTool(Name = "extrato_familia", Title = "Extrato da família", ReadOnly = true, Destructive = false,
        Idempotent = true, OpenWorld = false)]
    [Description("Extrato das carteiras vinculadas a uma família no período, conforme a visibilidade da família " +
                 "(detailLevel Summary traz só os totais). " + PERIOD_HINT)]
    public Task<CallToolResult> ExtratoFamilia(ClaimsPrincipal user,
        [Description("Id da família (ex.: 3).")] long familia_id,
        [Description("Primeiro dia do período, AAAA-MM-DD (ex.: 2026-10-01).")] string inicio,
        [Description("Último dia do período, AAAA-MM-DD (ex.: 2026-10-31).")] string fim,
        [Description("Opcional: lançamentos por página, de 1 a 50 (padrão 20).")] int? limite = null,
        [Description("Opcional: proximoCursor devolvido pela página anterior.")] string? cursor = null) =>
        Statement(user, "extrato_familia", inicio, fim, limite, cursor,
            (userId, start, end) => _statementService.GetGroupStatementAsync(userId, familia_id, start, end));

    [McpServerTool(Name = "obter_lancamento", Title = "Obter lançamento", ReadOnly = true, Destructive = false,
        Idempotent = true, OpenWorld = false)]
    [Description("Detalhes de um lançamento (receita, despesa, transferência, compra/venda de bitcoin ou " +
                 "estorno): origem, destino, valores, cotação usada, descrição, data e estorno vinculado.")]
    public Task<CallToolResult> ObterLancamento(ClaimsPrincipal user,
        [Description("Id do lançamento (transactionId do extrato, ex.: 120).")] long lancamento_id) =>
        ExecuteReadAsync(user, "obter_lancamento",
            userId => _ledgerService.GetAsync(userId, lancamento_id),
            t => $"Lançamento {t.TransactionId} ({t.Type}) de {McpFormat.LocalDateTime(t.OccurredAt)}: " +
                 $"{McpFormat.Money(t.SourceAmount, t.Source.Currency)} de {t.Source.Name} para {t.Destination.Name}." +
                 (t.ReversedByTransactionId.HasValue ? $" Estornado pelo lançamento {t.ReversedByTransactionId}." : string.Empty));

    private Task<CallToolResult> Statement(ClaimsPrincipal user, string toolName, string inicio, string fim,
        int? limite, string? cursor, Func<long, DateOnly, DateOnly, Task<StatementResult>> load) =>
        ExecuteReadAsync(user, toolName, async userId =>
        {
            var start = McpFormat.ParseDate(inicio, "inicio");
            var end = McpFormat.ParseDate(fim, "fim");
            // Valida limite e cursor antes de consultar.
            McpPaging.NormalizeLimit(limite);
            McpPaging.DecodeCursor(cursor, start, end);
            var full = await load(userId, start, end);
            return ToPage(full, start, end, limite, cursor);
        }, Summarize);

    internal static McpStatementPage ToPage(StatementResult full, DateOnly start, DateOnly end, int? limit, string? cursor)
    {
        var (entries, next) = McpPaging.Slice(full.Entries, start, end, limit, cursor);
        return new McpStatementPage
        {
            Scope = full.Scope,
            ScopeId = full.ScopeId,
            Start = full.Start,
            End = full.End,
            DetailLevel = full.DetailLevel,
            Totals = full.Totals,
            Entries = entries,
            TotalEntries = full.Entries.Count,
            ProximoCursor = next
        };
    }

    private static string Summarize(McpStatementPage page)
    {
        var totals = page.Totals.Count == 0
            ? "sem movimentação"
            : string.Join("; ", page.Totals.Select(t =>
                $"{t.Currency}: saldo inicial {McpFormat.Money(t.OpeningBalance, t.Currency)}, entradas " +
                $"{McpFormat.Money(t.TotalIn, t.Currency)}, saídas {McpFormat.Money(t.TotalOut, t.Currency)}, " +
                $"saldo final {McpFormat.Money(t.ClosingBalance, t.Currency)}"));
        var text = $"Extrato de {McpFormat.Date(page.Start)} a {McpFormat.Date(page.End)} — {totals}. " +
                   $"{McpFormat.Count(page.Entries.Count, "lançamento", "lançamentos")} nesta página, de {page.TotalEntries}.";
        if (page.ProximoCursor != null)
            text += " Há mais lançamentos: chame de novo com cursor = proximoCursor.";
        return text;
    }
}
