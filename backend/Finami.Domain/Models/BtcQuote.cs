namespace Finami.Domain.Models;

/// <summary>Cotação de 1 BTC em Real obtida de uma fonte externa.</summary>
public class BtcQuote
{
    public long BtcQuoteId { get; set; }
    public decimal PriceBrl { get; set; }
    public DateTime QuotedAt { get; set; }
    public DateTime FetchedAt { get; set; } = DateTime.UtcNow;
    public string Source { get; set; } = string.Empty;

    public bool IsStale(DateTime nowUtc, TimeSpan maxAge) => nowUtc - QuotedAt > maxAge;
}
