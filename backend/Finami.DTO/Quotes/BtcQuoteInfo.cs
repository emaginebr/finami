using System.Text.Json.Serialization;

namespace Finami.DTO.Quotes;

public class BtcQuoteInfo
{
    [JsonPropertyName("priceBrl")]
    public decimal PriceBrl { get; set; }

    [JsonPropertyName("quotedAt")]
    public DateTime QuotedAt { get; set; }

    [JsonPropertyName("source")]
    public string Source { get; set; } = string.Empty;

    [JsonPropertyName("isStale")]
    public bool IsStale { get; set; }
}
