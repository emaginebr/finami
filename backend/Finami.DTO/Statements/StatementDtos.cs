using System.Text.Json.Serialization;

namespace Finami.DTO.Statements;

public class StatementQuery
{
    [JsonPropertyName("start")]
    public DateOnly Start { get; set; }

    [JsonPropertyName("end")]
    public DateOnly End { get; set; }
}

public class StatementResult
{
    /// <summary>"Wallet", "User" ou "Group".</summary>
    [JsonPropertyName("scope")]
    public string Scope { get; set; } = string.Empty;

    [JsonPropertyName("scopeId")]
    public long ScopeId { get; set; }

    [JsonPropertyName("start")]
    public DateOnly Start { get; set; }

    [JsonPropertyName("end")]
    public DateOnly End { get; set; }

    /// <summary>"Full" ou "Summary" (somente totais).</summary>
    [JsonPropertyName("detailLevel")]
    public string DetailLevel { get; set; } = string.Empty;

    [JsonPropertyName("totals")]
    public List<StatementTotalInfo> Totals { get; set; } = new();

    [JsonPropertyName("entries")]
    public List<StatementEntryInfo> Entries { get; set; } = new();
}

public class StatementTotalInfo
{
    [JsonPropertyName("currency")]
    public string Currency { get; set; } = string.Empty;

    [JsonPropertyName("openingBalance")]
    public decimal OpeningBalance { get; set; }

    [JsonPropertyName("totalIn")]
    public decimal TotalIn { get; set; }

    [JsonPropertyName("totalOut")]
    public decimal TotalOut { get; set; }

    [JsonPropertyName("closingBalance")]
    public decimal ClosingBalance { get; set; }
}

public class StatementEntryInfo
{
    [JsonPropertyName("transactionId")]
    public long TransactionId { get; set; }

    [JsonPropertyName("occurredAt")]
    public DateTime OccurredAt { get; set; }

    [JsonPropertyName("type")]
    public string Type { get; set; } = string.Empty;

    [JsonPropertyName("accountId")]
    public long AccountId { get; set; }

    [JsonPropertyName("sourceName")]
    public string SourceName { get; set; } = string.Empty;

    [JsonPropertyName("destinationName")]
    public string DestinationName { get; set; } = string.Empty;

    [JsonPropertyName("currency")]
    public string Currency { get; set; } = string.Empty;

    /// <summary>Efeito no escopo nesta moeda (negativo = saída).</summary>
    [JsonPropertyName("amount")]
    public decimal Amount { get; set; }

    [JsonPropertyName("quotePriceBrl")]
    public decimal? QuotePriceBrl { get; set; }

    [JsonPropertyName("description")]
    public string? Description { get; set; }

    /// <summary>Transferência na mesma moeda entre contas do próprio escopo (não soma nos totais).</summary>
    [JsonPropertyName("internal")]
    public bool Internal { get; set; }
}
