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
