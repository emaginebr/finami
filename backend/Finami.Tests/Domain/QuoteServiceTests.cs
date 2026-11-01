using Finami.Domain.Exceptions;
using Finami.Domain.Models;
using Finami.Domain.Services;
using Finami.DTO.Settings;
using Finami.Infra.Interfaces.AppServices;
using Finami.Infra.Interfaces.Repository;
using FluentAssertions;
using Microsoft.Extensions.Caching.Memory;
using Microsoft.Extensions.Options;
using Moq;

namespace Finami.Tests.Domain;

public class QuoteServiceTests
{
    private readonly Mock<IBtcQuoteAppService<BtcQuote>> _source = new();
    private readonly Mock<IBtcQuoteRepository<BtcQuote>> _repository = new();
    private readonly MemoryCache _cache = new(new MemoryCacheOptions());

    private QuoteService Create() => new(_source.Object, _repository.Object, _cache,
        Options.Create(new BtcQuoteSettings { CacheSeconds = 60, StaleAfterSeconds = 300 }));

    private static BtcQuote Quote(decimal price, TimeSpan age) =>
        new() { BtcQuoteId = 1, PriceBrl = price, QuotedAt = DateTime.UtcNow - age, Source = "test" };

    [Fact]
    public async Task Fresh_quote_is_persisted_and_returned_not_stale()
    {
        _source.Setup(s => s.FetchAsync(It.IsAny<CancellationToken>())).ReturnsAsync(Quote(500_000m, TimeSpan.FromSeconds(30)));
        _repository.Setup(r => r.InsertAsync(It.IsAny<BtcQuote>())).ReturnsAsync((BtcQuote q) => q);

        var info = await Create().GetCurrentAsync();

        info.PriceBrl.Should().Be(500_000m);
        info.IsStale.Should().BeFalse();
        _repository.Verify(r => r.InsertAsync(It.IsAny<BtcQuote>()), Times.Once);
    }

    [Fact]
    public async Task Cache_hit_does_not_call_the_source_again()
    {
        _source.Setup(s => s.FetchAsync(It.IsAny<CancellationToken>())).ReturnsAsync(Quote(500_000m, TimeSpan.Zero));
        _repository.Setup(r => r.InsertAsync(It.IsAny<BtcQuote>())).ReturnsAsync((BtcQuote q) => q);
        var service = Create();

        await service.GetCurrentAsync();
        await service.GetCurrentAsync();

        _source.Verify(s => s.FetchAsync(It.IsAny<CancellationToken>()), Times.Once);
    }

    [Fact]
    public async Task Source_failure_returns_last_known_quote_flagged_as_stale()
    {
        _source.Setup(s => s.FetchAsync(It.IsAny<CancellationToken>())).ReturnsAsync((BtcQuote?)null);
        _repository.Setup(r => r.GetLatestAsync()).ReturnsAsync(Quote(480_000m, TimeSpan.FromHours(2)));

        var info = await Create().GetCurrentAsync();

        info.PriceBrl.Should().Be(480_000m);
        info.IsStale.Should().BeTrue();
    }

    [Fact]
    public async Task No_quote_at_all_throws_unavailable()
    {
        _source.Setup(s => s.FetchAsync(It.IsAny<CancellationToken>())).ReturnsAsync((BtcQuote?)null);
        _repository.Setup(r => r.GetLatestAsync()).ReturnsAsync((BtcQuote?)null);

        var act = () => Create().GetCurrentAsync();

        await act.Should().ThrowAsync<QuoteUnavailableException>();
    }

    [Fact]
    public async Task Conversion_rejects_quote_older_than_five_minutes()
    {
        _source.Setup(s => s.FetchAsync(It.IsAny<CancellationToken>())).ReturnsAsync((BtcQuote?)null);
        _repository.Setup(r => r.GetLatestAsync()).ReturnsAsync(Quote(480_000m, TimeSpan.FromMinutes(6)));

        var act = () => Create().GetForConversionAsync();

        await act.Should().ThrowAsync<QuoteUnavailableException>();
    }

    [Fact]
    public async Task Conversion_accepts_recent_quote()
    {
        _source.Setup(s => s.FetchAsync(It.IsAny<CancellationToken>())).ReturnsAsync(Quote(500_000m, TimeSpan.FromMinutes(4)));
        _repository.Setup(r => r.InsertAsync(It.IsAny<BtcQuote>())).ReturnsAsync((BtcQuote q) => q);

        var quote = await Create().GetForConversionAsync();

        quote.PriceBrl.Should().Be(500_000m);
    }
}
