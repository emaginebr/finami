using System.Text.Json.Serialization;

namespace Finami.DTO.Transactions;

public class TransferInfo
{
    [JsonPropertyName("sourceWalletId")]
    public long SourceWalletId { get; set; }

    [JsonPropertyName("destinationWalletId")]
    public long DestinationWalletId { get; set; }

    /// <summary>Valor na moeda da carteira de origem; informe este ou <see cref="AmountBrl"/>.</summary>
    [JsonPropertyName("amount")]
    public decimal? Amount { get; set; }

    /// <summary>Valor em reais, só para transferência entre carteiras de bitcoin (convertido pela cotação atual).</summary>
    [JsonPropertyName("amountBrl")]
    public decimal? AmountBrl { get; set; }

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
