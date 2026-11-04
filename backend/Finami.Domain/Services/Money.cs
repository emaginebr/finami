using Finami.Domain.Enums;
using Finami.Domain.Exceptions;

namespace Finami.Domain.Services;

/// <summary>Regras de precisão e arredondamento por moeda (research R-08).</summary>
public static class Money
{
    public const int BRL_PRECISION = 2;
    public const int BTC_PRECISION = 8;

    public static int Precision(Currency currency) => currency switch
    {
        Currency.Brl => BRL_PRECISION,
        Currency.Btc => BTC_PRECISION,
        _ => throw new ArgumentOutOfRangeException(nameof(currency))
    };

    /// <summary>Trunca (arredonda em direção a zero) para a precisão da moeda.</summary>
    public static decimal Truncate(decimal value, Currency currency)
    {
        var factor = Pow10(Precision(currency));
        return decimal.Truncate(value * factor) / factor;
    }

    /// <summary>
    /// Arredonda para cima (em direção a +∞) até a menor unidade da moeda (centavo ou satoshi). Usado no "quitar tudo"
    /// em outra moeda (feature 007, R-04), para que o valor enviado zere a dívida.
    /// </summary>
    public static decimal Ceiling(decimal value, Currency currency)
    {
        var factor = Pow10(Precision(currency));
        return decimal.Ceiling(value * factor) / factor;
    }

    /// <summary>
    /// Valor formatado em pt-BR com a precisão da moeda: <c>R$ 1.234,56</c> ou <c>₿ 0,00050000</c>. Montado à mão
    /// para não depender dos dados de cultura do ICU no container.
    /// </summary>
    public static string Format(decimal value, Currency currency)
    {
        var format = currency == Currency.Btc ? "#,0.00000000" : "#,0.00";
        var text = Math.Abs(value).ToString(format, PT_BR);
        var symbol = currency == Currency.Btc ? "₿" : "R$";
        return value < 0 ? $"-{symbol} {text}" : $"{symbol} {text}";
    }

    private static readonly System.Globalization.NumberFormatInfo PT_BR = new()
    {
        NumberDecimalSeparator = ",",
        NumberGroupSeparator = ".",
        NumberGroupSizes = new[] { 3 }
    };

    public static bool HasValidScale(decimal value, Currency currency)
        => Truncate(value, currency) == value;

    public static void EnsurePositive(decimal value, Currency currency)
    {
        if (value <= 0)
            throw new ValidationException("O valor deve ser maior que zero.");
        if (!HasValidScale(value, currency))
            throw new ValidationException(
                $"O valor excede a precisão da moeda ({Precision(currency)} casas decimais).");
    }

    private static decimal Pow10(int exponent)
    {
        decimal result = 1m;
        for (var i = 0; i < exponent; i++) result *= 10m;
        return result;
    }
}
