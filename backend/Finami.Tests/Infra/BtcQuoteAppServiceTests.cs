using System.Net;
using Finami.DTO.Settings;
using Finami.Infra.AppServices;
using FluentAssertions;
using Microsoft.Extensions.Logging.Abstractions;
using Microsoft.Extensions.Options;

namespace Finami.Tests.Infra;

public class BtcQuoteAppServiceTests
{
    private const string PRIMARY = "https://primary.test/price";
    private const string FALLBACK = "https://fallback.test/ticker";

    private static BtcQuoteAppService Create(Func<HttpRequestMessage, HttpResponseMessage> responder)
    {
        var client = new HttpClient(new FakeHandler(responder));
        var settings = Options.Create(new BtcQuoteSettings { PrimaryUrl = PRIMARY, FallbackUrl = FALLBACK, TimeoutSeconds = 5 });
        return new BtcQuoteAppService(client, settings, NullLogger<BtcQuoteAppService>.Instance);
    }

    private static HttpResponseMessage Json(string body) =>
        new(HttpStatusCode.OK) { Content = new StringContent(body, System.Text.Encoding.UTF8, "application/json") };

    [Fact]
    public async Task Parses_coingecko_response()
    {
        var service = Create(_ => Json("{\"bitcoin\":{\"brl\":512345.67,\"last_updated_at\":1761998530}}"));

        var quote = await service.FetchAsync();

        quote!.PriceBrl.Should().Be(512345.67m);
        quote.Source.Should().Be(BtcQuoteAppService.SOURCE_COINGECKO);
        quote.QuotedAt.Should().Be(DateTimeOffset.FromUnixTimeSeconds(1761998530).UtcDateTime);
    }

    [Fact]
    public async Task Falls_back_to_mercado_bitcoin_when_primary_fails()
    {
        var service = Create(request => request.RequestUri!.ToString() == PRIMARY
            ? new HttpResponseMessage(HttpStatusCode.TooManyRequests)
            : Json("[{\"pair\":\"BTC-BRL\",\"last\":\"498000.50\",\"date\":1761998500}]"));

        var quote = await service.FetchAsync();

        quote!.PriceBrl.Should().Be(498000.50m);
        quote.Source.Should().Be(BtcQuoteAppService.SOURCE_MERCADO_BITCOIN);
    }

    [Fact]
    public async Task Returns_null_when_both_sources_fail()
    {
        var service = Create(_ => new HttpResponseMessage(HttpStatusCode.InternalServerError));

        var quote = await service.FetchAsync();

        quote.Should().BeNull();
    }

    [Fact]
    public async Task Invalid_payload_is_treated_as_failure()
    {
        var service = Create(_ => Json("{\"unexpected\":true}"));

        var quote = await service.FetchAsync();

        quote.Should().BeNull();
    }

    private sealed class FakeHandler : HttpMessageHandler
    {
        private readonly Func<HttpRequestMessage, HttpResponseMessage> _responder;

        public FakeHandler(Func<HttpRequestMessage, HttpResponseMessage> responder)
        {
            _responder = responder;
        }

        protected override Task<HttpResponseMessage> SendAsync(HttpRequestMessage request, CancellationToken cancellationToken) =>
            Task.FromResult(_responder(request));
    }
}
