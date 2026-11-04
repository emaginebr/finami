namespace Finami.Domain.Enums;

/// <summary>
/// Tipo da transferência entre carteiras de titulares diferentes (feature 007, R-01). Só empréstimos e quitações
/// mexem na dívida; pagamentos não.
/// </summary>
public enum TransferKind
{
    Loan = 1,
    Settlement = 2,
    Payment = 3
}

/// <summary>Conversão entre o código da API (<c>loan</c>/<c>settlement</c>/<c>payment</c>) e o enum.</summary>
public static class TransferKindCodes
{
    public const string LOAN = "loan";
    public const string SETTLEMENT = "settlement";
    public const string PAYMENT = "payment";

    public static bool TryParse(string? code, out TransferKind kind)
    {
        switch (code?.Trim().ToLowerInvariant())
        {
            case LOAN:
                kind = TransferKind.Loan;
                return true;
            case SETTLEMENT:
                kind = TransferKind.Settlement;
                return true;
            case PAYMENT:
                kind = TransferKind.Payment;
                return true;
            default:
                kind = default;
                return false;
        }
    }

    public static string ToCode(this TransferKind kind) => kind switch
    {
        TransferKind.Loan => LOAN,
        TransferKind.Settlement => SETTLEMENT,
        TransferKind.Payment => PAYMENT,
        _ => throw new ArgumentOutOfRangeException(nameof(kind))
    };
}
