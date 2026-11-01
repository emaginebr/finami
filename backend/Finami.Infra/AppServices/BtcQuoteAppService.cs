using System.Globalization;
using System.Text.Json;
using Finami.Domain.Models;
using Finami.DTO.Settings;
using Finami.Infra.Interfaces.AppServices;
using Microsoft.Extensions.Logging;
using Microsoft.Extensions.Options;

namespace Finami.Infra.AppServices;

/// <summary>Cotação BTC/BRL: CoinGecko com fallback para Mercado Bitcoin (research R-09).</summary>
public class BtcQuoteAppService : IBtcQuoteAppService<BtcQuote>
{
    public const string SOURCE_COINGECKO = "coingecko";
    public const string SOURCE_MERCADO_BITCOIN = "mercadobitcoin";

    private readonly HttpClient _httpClient;
    private readonly BtcQuoteSettings _settings;
    private readonly ILogger<BtcQuoteAppService> _logger;

    public BtcQuoteAppService(HttpClient httpClient, IOptions<BtcQuoteSettings> settings, ILogger<BtcQuoteAppService> logger)
    {
        _httpClient = httpClient;
        _settings = settings.Value;
        _logger = logger;
    }

    public async Task<BtcQuote?> FetchAsync(CancellationToken cancellationToken = default)
    {
        return await TryFetchAsync(SOURCE_COINGECKO, _settings.PrimaryUrl, ParseCoinGecko, cancellationToken)
               ?? await TryFetchAsync(SOURCE_MERCADO_BITCOIN, _settings.FallbackUrl, ParseMercadoBitcoin, cancellationToken);
    }

    private async Task<BtcQuote?> TryFetchAsync(string source, string url, Func<JsonElement, (decimal Price, DateTime? QuotedAt)> parse,
        CancellationToken cancellationToken)
    {
        if (string.IsNullOrWhiteSpace(url)) return null;
        try
        {
            using var timeout = CancellationTokenSource.CreateLinkedTokenSource(cancellationToken);
            timeout.CancelAfter(TimeSpan.FromSeconds(Math.Max(1, _settings.TimeoutSeconds)));

            using var response = await _httpClient.GetAsync(url, timeout.Token);
            response.EnsureSuccessStatusCode();
            await using var stream = await response.Content.ReadAsStreamAsync(timeout.Token);
            using var document = await JsonDocument.ParseAsync(stream, cancellationToken: timeout.Token);

            var (price, quotedAt) = parse(document.RootElement);
            if (price <= 0) throw new InvalidOperationException("Preço inválido.");

            var now = DateTime.UtcNow;
            return new BtcQuote
            {
                PriceBrl = price,
                QuotedAt = quotedAt.HasValue && quotedAt.Value <= now ? quotedAt.Value : now,
                FetchedAt = now,
                Source = source
            };
        }
        catch (Exception ex)
        {
            _logger.LogWarning(ex, "Falha ao obter cotação do bitcoin em {Source}", source);
            return null;
        }
    }

    // {"bitcoin":{"brl":512345.67,"last_updated_at":1761998530}}
    internal static (decimal Price, DateTime? QuotedAt) ParseCoinGecko(JsonElement root)
    {
        var bitcoin = root.GetProperty("bitcoin");
        var price = bitcoin.GetProperty("brl").GetDecimal();
        DateTime? quotedAt = bitcoin.TryGetProperty("last_updated_at", out var updated) && updated.TryGetInt64(out var unix)
            ? DateTimeOffset.FromUnixTimeSeconds(unix).UtcDateTime
            : null;
        return (price, quotedAt);
    }

    // [{"pair":"BTC-BRL","last":"512345.67","date":1761998530, ...}]
    internal static (decimal Price, DateTime? QuotedAt) ParseMercadoBitcoin(JsonElement root)
    {
        var ticker = root.ValueKind == JsonValueKind.Array ? root[0] : root;
        var last = ticker.GetProperty("last");
        var price = last.ValueKind == JsonValueKind.String
            ? decimal.Parse(last.GetString()!, NumberStyles.Number, CultureInfo.InvariantCulture)
            : last.GetDecimal();
        DateTime? quotedAt = ticker.TryGetProperty("date", out var date) && date.TryGetInt64(out var unix)
            ? DateTimeOffset.FromUnixTimeSeconds(unix).UtcDateTime
            : null;
        return (price, quotedAt);
    }
}
