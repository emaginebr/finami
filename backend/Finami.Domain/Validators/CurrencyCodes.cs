using Finami.Domain.Enums;

namespace Finami.Domain.Validators;

/// <summary>Conversão entre o código da API ("BRL"/"BTC") e o enum Currency.</summary>
public static class CurrencyCodes
{
    public static bool TryParse(string? code, out Currency currency)
    {
        switch (code?.Trim().ToUpperInvariant())
        {
            case "BRL":
                currency = Currency.Brl;
                return true;
            case "BTC":
                currency = Currency.Btc;
                return true;
            default:
                currency = default;
                return false;
        }
    }

    public static string ToCode(this Currency currency) => currency == Currency.Brl ? "BRL" : "BTC";
}
