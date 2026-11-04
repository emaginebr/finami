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

    /// <summary>Feature 007: tipo da transferência entre titulares diferentes (copiado pelo estorno).</summary>
    public TransferKind? TransferKind { get; set; }

    /// <summary>
    /// Feature 007 (R-01): moeda e valor do efeito na dívida, no sentido "o titular do destino deve ao da origem".
    /// Preenchidos em empréstimos, quitações e nos estornos deles; nulos nos demais lançamentos.
    /// </summary>
    public Currency? DebtCurrency { get; set; }

    public decimal? DebtAmount { get; set; }

    public List<LedgerEntry> Entries { get; set; } = new();

    public bool HasDebtEffect => DebtCurrency.HasValue && DebtAmount.HasValue;

    /// <summary>
    /// Compra/venda de bitcoin, ou o estorno de uma. O estorno de uma transferência na mesma moeda que gravou cotação
    /// (bitcoin informado em reais, quitação em outra moeda) não é conversão: os lançamentos ficam numa moeda só.
    /// Sem os lançamentos carregados, vale a comparação dos valores (na mesma moeda, saída = entrada).
    /// </summary>
    public bool IsConversion => Type is TransactionType.BtcPurchase or TransactionType.BtcSale
        || (Type == TransactionType.Reversal && QuotePriceBrl.HasValue
            && (Entries.Count > 0
                ? Entries.Select(e => e.Currency).Distinct().Count() > 1
                : SourceAmount != DestinationAmount));
}
