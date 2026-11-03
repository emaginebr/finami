using System.ComponentModel;
using System.Globalization;
using ModelContextProtocol.Server;

namespace Finami.API.Mcp.Prompts;

/// <summary>Prompts prontos (contracts/mcp-tools.md §Prompts): só texto-guia, sem acesso a dados.</summary>
[McpServerPromptType]
public class FinamiPrompts
{
    private readonly TimeProvider _time;

    public FinamiPrompts(TimeProvider time)
    {
        _time = time;
    }

    [McpServerPrompt(Name = "resumo_do_mes", Title = "Resumo do mês")]
    [Description("Monta um resumo financeiro do mês: saldo total, extrato de cada carteira e maiores despesas.")]
    public string ResumoDoMes(
        [Description("Opcional: mês no formato AAAA-MM (ex.: 2026-10); padrão = mês atual.")] string? mes = null)
    {
        var month = ParseMonth(mes) ?? CurrentMonth();
        var start = new DateOnly(month.Year, month.Month, 1);
        var end = start.AddMonths(1).AddDays(-1);
        var startText = start.ToString(McpFormat.DATE_FORMAT, CultureInfo.InvariantCulture);
        var endText = end.ToString(McpFormat.DATE_FORMAT, CultureInfo.InvariantCulture);
        return $"""
            Faça um resumo das minhas finanças no Finami em {start:MM/yyyy}.
            1. Chame saldo_total para o saldo atual.
            2. Chame listar_carteiras e, para cada carteira ativa, extrato_carteira com inicio {startText} e fim {endText}
               (siga o proximoCursor até o fim de cada extrato).
            3. Mostre, por carteira, saldo inicial, entradas, saídas e saldo final do mês.
            4. Liste as 5 maiores despesas do mês (valor, carteira, descrição e data).
            Valores em reais no formato R$ 1.234,56; bitcoin com 5 casas (ex.: ₿ 0,12345). Não altere nenhum dado.
            """;
    }

    [McpServerPrompt(Name = "registrar_gasto", Title = "Registrar gasto")]
    [Description("Guia para registrar uma despesa: achar a carteira, confirmar com a pessoa e lançar.")]
    public string RegistrarGasto(
        [Description("O que foi comprado ou pago (ex.: \"Mercado\").")] string descricao,
        [Description("Valor na moeda da carteira (ex.: 80.00).")] string valor,
        [Description("Opcional: nome da carteira (ex.: \"Nubank\").")] string? carteira = null) =>
        $"""
        Quero registrar um gasto no Finami: "{descricao}", valor {valor}.
        1. Chame listar_carteiras e encontre a carteira{(string.IsNullOrWhiteSpace(carteira) ? "" : $" \"{carteira}\"")}; se houver dúvida, pergunte qual usar.
        2. Antes de lançar, confirme comigo carteira, valor e descrição.
        3. Depois da confirmação, chame registrar_despesa com carteira_id, valor, descricao e uma chave_repeticao nova
           (ex.: um UUID), para que uma repetição não lance o gasto duas vezes.
        4. Mostre o saldo novo da carteira.
        """;

    [McpServerPrompt(Name = "revisar_convites", Title = "Revisar convites")]
    [Description("Lista os convites de família pendentes recebidos e pergunta o que fazer com cada um.")]
    public string RevisarConvites() =>
        """
        Revise meus convites de família no Finami.
        1. Chame listar_notificacoes (siga o proximoCursor) e separe as do tipo GroupInvitationReceived cujo
           convite ainda está Pending.
        2. Para cada convite, mostre quem convidou e a família, e pergunte se devo aceitar ou recusar.
        3. Só depois da minha resposta, chame aceitar_convite ou recusar_convite com o invitationId.
        4. No fim, marque essas notificações como lidas com marcar_notificacoes_como_lidas.
        """;

    private DateOnly CurrentMonth() => McpFormat.LocalDate(_time.GetUtcNow().UtcDateTime);

    private static DateOnly? ParseMonth(string? value) =>
        !string.IsNullOrWhiteSpace(value)
        && DateOnly.TryParseExact(value.Trim() + "-01", McpFormat.DATE_FORMAT, CultureInfo.InvariantCulture,
            DateTimeStyles.None, out var date)
            ? date
            : null;
}
