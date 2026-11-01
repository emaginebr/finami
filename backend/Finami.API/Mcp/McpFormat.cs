using System.Globalization;
using Finami.Domain.Exceptions;

namespace Finami.API.Mcp;

/// <summary>
/// Formatação dos resumos em pt-BR e leitura de datas <c>AAAA-MM-DD</c> (contracts/mcp-tools.md §Regras comuns).
/// O formato numérico é montado à mão para não depender dos dados de cultura do ICU no container.
/// </summary>
public static class McpFormat
{
    public const string DATE_FORMAT = "yyyy-MM-dd";
    public const string BRL = "BRL";
    public const string BTC = "BTC";

    private static readonly NumberFormatInfo PT_BR = new()
    {
        NumberDecimalSeparator = ",",
        NumberGroupSeparator = ".",
        NumberGroupSizes = new[] { 3 },
        NegativeSign = "-"
    };

    /// <summary><c>R$ 1.420,00</c> ou <c>0,00123456 BTC</c>.</summary>
    public static string Money(decimal value, string? currency) =>
        string.Equals(currency, BTC, StringComparison.OrdinalIgnoreCase)
            ? $"{value.ToString("#,0.########", PT_BR)} BTC"
            : value < 0
                ? $"-R$ {Math.Abs(value).ToString("#,0.00", PT_BR)}"
                : $"R$ {value.ToString("#,0.00", PT_BR)}";

    /// <summary><c>01/11/2026</c>.</summary>
    public static string Date(DateOnly date) => date.ToString("dd/MM/yyyy", CultureInfo.InvariantCulture);

    private static readonly Lazy<TimeZoneInfo> SAO_PAULO = new(() =>
    {
        foreach (var id in new[] { "America/Sao_Paulo", "E. South America Standard Time" })
        {
            try
            {
                return TimeZoneInfo.FindSystemTimeZoneById(id);
            }
            catch (TimeZoneNotFoundException)
            {
            }
        }
        return TimeZoneInfo.CreateCustomTimeZone("BRT", TimeSpan.FromHours(-3), "BRT", "BRT");
    });

    private static DateTime ToLocal(DateTime utc) =>
        TimeZoneInfo.ConvertTimeFromUtc(DateTime.SpecifyKind(utc, DateTimeKind.Utc), SAO_PAULO.Value);

    /// <summary>Data e hora UTC no fuso de São Paulo: <c>01/11/2026 15:30</c>.</summary>
    public static string LocalDateTime(DateTime utc) =>
        ToLocal(utc).ToString("dd/MM/yyyy HH:mm", CultureInfo.InvariantCulture);

    /// <summary>Dia corrente em São Paulo.</summary>
    public static DateOnly LocalDate(DateTime utc) => DateOnly.FromDateTime(ToLocal(utc));

    /// <summary>Lê uma data <c>AAAA-MM-DD</c>; inválida → <c>validacao</c> com exemplo.</summary>
    public static DateOnly ParseDate(string? value, string parameter)
    {
        if (string.IsNullOrWhiteSpace(value)
            || !DateOnly.TryParseExact(value.Trim(), DATE_FORMAT, CultureInfo.InvariantCulture, DateTimeStyles.None, out var date))
            throw new ValidationException($"Data inválida em '{parameter}': use AAAA-MM-DD (ex.: 2026-11-01).");
        return date;
    }

    /// <summary>"1 item" / "3 itens".</summary>
    public static string Count(int count, string singular, string plural) =>
        count == 1 ? $"1 {singular}" : $"{count} {plural}";
}
