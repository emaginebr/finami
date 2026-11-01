using Finami.Domain.Enums;

namespace Finami.Domain.Models;

/// <summary>Cabeçalho imutável de uma transação: uma conta de saída e uma de entrada (FR-024).</summary>
public class Transaction
{
    public long TransactionId { get; set; }
    public TransactionType Type { get; set; }
    public long SourceAccountId { get; set; }
    public long DestinationAccountId { get; set; }
    public decimal SourceAmount { get; set; }
    public decimal DestinationAmount { get; set; }
    public long? BtcQuoteId { get; set; }
    public decimal? QuotePriceBrl { get; set; }
    public string? Description { get; set; }
    public DateTime OccurredAt { get; set; } = DateTime.UtcNow;
    public long CreatedByUserId { get; set; }
    public long? ReversedTransactionId { get; set; }

    public List<LedgerEntry> Entries { get; set; } = new();

    public bool IsConversion => Type is TransactionType.BtcPurchase or TransactionType.BtcSale
        || (Type == TransactionType.Reversal && QuotePriceBrl.HasValue);
}
