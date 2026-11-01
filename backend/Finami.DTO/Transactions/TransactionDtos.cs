using System.Text.Json.Serialization;

namespace Finami.DTO.Transactions;

/// <summary>Movimento entre uma carteira e o mundo externo.</summary>
public class WalletMovementInfo
{
    [JsonPropertyName("walletId")]
    public long WalletId { get; set; }

    [JsonPropertyName("amount")]
    public decimal Amount { get; set; }

    [JsonPropertyName("description")]
    public string? Description { get; set; }
}

/// <summary>Entrada de fundos de fora do sistema (salário etc.).</summary>
public class IncomeInfo : WalletMovementInfo
{
}

/// <summary>Saída de fundos para fora do sistema (despesas etc.).</summary>
public class ExpenseInfo : WalletMovementInfo
{
}

public class TransactionAccountInfo
{
    [JsonPropertyName("accountId")]
    public long AccountId { get; set; }

    [JsonPropertyName("name")]
    public string Name { get; set; } = string.Empty;

    /// <summary>"Wallet", "ExternalSource", "ExternalSink" ou "Exchange".</summary>
    [JsonPropertyName("kind")]
    public string Kind { get; set; } = string.Empty;

    [JsonPropertyName("currency")]
    public string Currency { get; set; } = string.Empty;

    [JsonPropertyName("ownerName")]
    public string? OwnerName { get; set; }
}

public class QuoteRefInfo
{
    [JsonPropertyName("priceBrl")]
    public decimal PriceBrl { get; set; }

    [JsonPropertyName("quotedAt")]
    public DateTime? QuotedAt { get; set; }

    [JsonPropertyName("source")]
    public string? Source { get; set; }
}

public class TransactionInfo
{
    [JsonPropertyName("transactionId")]
    public long TransactionId { get; set; }

    [JsonPropertyName("type")]
    public string Type { get; set; } = string.Empty;

    [JsonPropertyName("source")]
    public TransactionAccountInfo Source { get; set; } = new();

    [JsonPropertyName("destination")]
    public TransactionAccountInfo Destination { get; set; } = new();

    [JsonPropertyName("sourceAmount")]
    public decimal SourceAmount { get; set; }

    [JsonPropertyName("destinationAmount")]
    public decimal DestinationAmount { get; set; }

    [JsonPropertyName("quote")]
    public QuoteRefInfo? Quote { get; set; }

    [JsonPropertyName("description")]
    public string? Description { get; set; }

    [JsonPropertyName("occurredAt")]
    public DateTime OccurredAt { get; set; }

    [JsonPropertyName("createdByUserId")]
    public long CreatedByUserId { get; set; }

    [JsonPropertyName("reversedTransactionId")]
    public long? ReversedTransactionId { get; set; }

    [JsonPropertyName("reversedByTransactionId")]
    public long? ReversedByTransactionId { get; set; }
}
