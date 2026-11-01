using Finami.Domain.Exceptions;
using Finami.Domain.Interfaces;
using Finami.Domain.Models;
using Finami.DTO.Quotes;
using Finami.DTO.Settings;
using Finami.Infra.Interfaces.AppServices;
using Finami.Infra.Interfaces.Repository;
using Microsoft.Extensions.Caching.Memory;
using Microsoft.Extensions.Options;

namespace Finami.Domain.Services;

/// <summary>Cotação do bitcoin com cache em memória e persistência da última conhecida (research R-09).</summary>
public class QuoteService : IQuoteService
{
    public const string CACHE_KEY = "finami:btc-quote";

    private readonly IBtcQuoteAppService<BtcQuote> _appService;
    private readonly IBtcQuoteRepository<BtcQuote> _repository;
    private readonly IMemoryCache _cache;
    private readonly BtcQuoteSettings _settings;

    public QuoteService(
        IBtcQuoteAppService<BtcQuote> appService,
        IBtcQuoteRepository<BtcQuote> repository,
        IMemoryCache cache,
        IOptions<BtcQuoteSettings> settings)
    {
        _appService = appService;
        _repository = repository;
        _cache = cache;
        _settings = settings.Value;
    }

    private TimeSpan MaxAge => TimeSpan.FromSeconds(_settings.StaleAfterSeconds);

    public async Task<BtcQuoteInfo> GetCurrentAsync()
    {
        var quote = await TryGetCurrentAsync()
            ?? throw new QuoteUnavailableException();
        return new BtcQuoteInfo
        {
            PriceBrl = quote.PriceBrl,
            QuotedAt = quote.QuotedAt,
            Source = quote.Source,
            IsStale = quote.IsStale(DateTime.UtcNow, MaxAge)
        };
    }

    public async Task<BtcQuote> GetForConversionAsync()
    {
        var quote = await TryGetCurrentAsync();
        if (quote == null || quote.IsStale(DateTime.UtcNow, MaxAge))
            throw new QuoteUnavailableException(
                "Cotação do bitcoin indisponível ou desatualizada; tente novamente em instantes.");
        return quote;
    }

    public async Task<BtcQuote?> TryGetCurrentAsync()
    {
        if (_cache.TryGetValue(CACHE_KEY, out BtcQuote? cached) && cached != null)
            return cached;

        var fetched = await _appService.FetchAsync();
        BtcQuote? quote;
        if (fetched != null)
        {
            quote = await _repository.InsertAsync(fetched);
        }
        else
        {
            quote = await _repository.GetLatestAsync();
        }

        if (quote != null)
            _cache.Set(CACHE_KEY, quote, TimeSpan.FromSeconds(Math.Max(1, _settings.CacheSeconds)));
        return quote;
    }
}
