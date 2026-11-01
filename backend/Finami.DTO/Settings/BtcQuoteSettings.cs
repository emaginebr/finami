namespace Finami.DTO.Settings;

public class BtcQuoteSettings
{
    public string PrimaryUrl { get; set; } =
        "https://api.coingecko.com/api/v3/simple/price?ids=bitcoin&vs_currencies=brl&include_last_updated_at=true";
    public string FallbackUrl { get; set; } = "https://api.mercadobitcoin.net/api/v4/tickers?symbols=BTC-BRL";
    public int CacheSeconds { get; set; } = 60;
    public int StaleAfterSeconds { get; set; } = 300;
    public int TimeoutSeconds { get; set; } = 5;
}
