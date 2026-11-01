using System.Text.Json.Serialization;

namespace Finami.DTO.Transactions;

public class TransferInfo
{
    [JsonPropertyName("sourceWalletId")]
    public long SourceWalletId { get; set; }

    [JsonPropertyName("destinationWalletId")]
    public long DestinationWalletId { get; set; }

    /// <summary>Valor na moeda da carteira de origem.</summary>
    [JsonPropertyName("amount")]
    public decimal Amount { get; set; }

    [JsonPropertyName("description")]
    public string? Description { get; set; }
}

public class TransferPreviewResult
{
    [JsonPropertyName("type")]
    public string Type { get; set; } = string.Empty;

    [JsonPropertyName("sourceAmount")]
    public decimal SourceAmount { get; set; }

    [JsonPropertyName("destinationAmount")]
    public decimal DestinationAmount { get; set; }

    [JsonPropertyName("quote")]
    public QuoteRefInfo? Quote { get; set; }
}

public class ReverseInfo
{
    [JsonPropertyName("description")]
    public string? Description { get; set; }
}
