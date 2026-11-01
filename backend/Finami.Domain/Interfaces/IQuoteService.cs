using Finami.Domain.Models;
using Finami.DTO.Quotes;

namespace Finami.Domain.Interfaces;

public interface IQuoteService
{
    /// <summary>Cotação atual; se a fonte falhar, a última conhecida marcada como desatualizada (FR-032).</summary>
    Task<BtcQuoteInfo> GetCurrentAsync();

    /// <summary>Cotação válida para conversão (≤ StaleAfterSeconds); senão QuoteUnavailableException (FR-029).</summary>
    Task<BtcQuote> GetForConversionAsync();

    /// <summary>Cotação atual sem lançar exceção (null se não houver nenhuma).</summary>
    Task<BtcQuote?> TryGetCurrentAsync();
}
