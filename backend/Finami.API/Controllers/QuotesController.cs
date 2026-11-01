using Finami.Domain.Interfaces;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace Finami.API.Controllers;

/// <summary>Cotação do bitcoin.</summary>
[Route("api/quotes")]
[Authorize]
public class QuotesController : FinamiControllerBase
{
    private readonly IQuoteService _quoteService;

    public QuotesController(IQuoteService quoteService)
    {
        _quoteService = quoteService;
    }

    /// <summary>
    /// Preço de 1 BTC em Real. Se a fonte estiver indisponível, devolve a última cotação conhecida
    /// com isStale = true; se nunca houve cotação, 503.
    /// </summary>
    [HttpGet("btc")]
    public Task<IActionResult> GetBtc() =>
        Execute(async () => Ok(await _quoteService.GetCurrentAsync()));
}
