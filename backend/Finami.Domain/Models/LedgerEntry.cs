using Finami.Domain.Enums;

namespace Finami.Domain.Models;

/// <summary>Lançamento imutável: valor assinado (negativo = saída, positivo = entrada) numa conta.</summary>
public class LedgerEntry
{
    public long LedgerEntryId { get; set; }
    public long TransactionId { get; set; }
    public long AccountId { get; set; }
    public decimal Amount { get; set; }
    public Currency Currency { get; set; }
    public DateTime OccurredAt { get; set; }

    public Transaction? Transaction { get; set; }
}
