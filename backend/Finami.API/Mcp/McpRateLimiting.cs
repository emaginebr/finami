using System.Globalization;
using System.Threading.RateLimiting;
using Finami.API.Auth;
using Finami.DTO.Settings;
using Microsoft.AspNetCore.RateLimiting;
using Microsoft.Extensions.Options;
using Microsoft.Net.Http.Headers;

namespace Finami.API.Mcp;

/// <summary>
/// Limites de taxa do MCP/OAuth (research R-09, FR-023) com o RateLimiter nativo, em janela fixa:
/// <c>/mcp</c> por conexão (<c>grant_id</c>), <c>/oauth/register</c> e <c>/oauth/token</c> por IP. Os valores vêm
/// de <see cref="McpSettings"/> (0 desliga o limite). Acima do limite: 429 com <c>Retry-After</c>.
/// </summary>
public static class McpRateLimiting
{
    public const string MCP_POLICY = "mcp";
    public const string REGISTER_POLICY = "oauth-register";
    public const string TOKEN_POLICY = "oauth-token";

    public const string REJECTED_MESSAGE = "Muitas chamadas em pouco tempo. Aguarde e tente novamente.";

    public static IServiceCollection AddFinamiRateLimiting(this IServiceCollection services)
    {
        services.AddRateLimiter(options =>
        {
            options.RejectionStatusCode = StatusCodes.Status429TooManyRequests;
            options.OnRejected = OnRejectedAsync;

            // /mcp: o UseRateLimiter roda depois do UseAuthorization, então o principal do McpBearer já existe.
            options.AddPolicy(MCP_POLICY, context => Window(context,
                $"grant:{context.User.GetGrantId()}",
                settings => settings.RateLimitPerMinute, TimeSpan.FromMinutes(1)));

            options.AddPolicy(REGISTER_POLICY, context => Window(context,
                $"ip:{ClientIp(context)}",
                settings => settings.RegisterRateLimitPerHour, TimeSpan.FromHours(1)));

            options.AddPolicy(TOKEN_POLICY, context => Window(context,
                $"ip:{ClientIp(context)}",
                settings => settings.TokenRateLimitPerMinute, TimeSpan.FromMinutes(1)));
        });
        return services;
    }

    private static RateLimitPartition<string> Window(HttpContext context, string key,
        Func<McpSettings, int> limit, TimeSpan window)
    {
        var permits = limit(context.RequestServices.GetRequiredService<IOptions<McpSettings>>().Value);
        if (permits <= 0)
            return RateLimitPartition.GetNoLimiter(key);
        return RateLimitPartition.GetFixedWindowLimiter(key, _ => new FixedWindowRateLimiterOptions
        {
            PermitLimit = permits,
            Window = window,
            QueueLimit = 0,
            AutoReplenishment = true
        });
    }

    /// <summary>IP do cliente (já corrigido pelo <c>X-Forwarded-For</c> atrás do Caddy).</summary>
    private static string ClientIp(HttpContext context) =>
        context.Connection.RemoteIpAddress?.ToString() ?? "desconhecido";

    private static async ValueTask OnRejectedAsync(OnRejectedContext context, CancellationToken cancellationToken)
    {
        var response = context.HttpContext.Response;
        var seconds = context.Lease.TryGetMetadata(MetadataName.RetryAfter, out var retryAfter)
            ? Math.Max(1, (int)Math.Ceiling(retryAfter.TotalSeconds))
            : 60;
        response.StatusCode = StatusCodes.Status429TooManyRequests;
        response.Headers[HeaderNames.RetryAfter] = seconds.ToString(CultureInfo.InvariantCulture);
        response.Headers[HeaderNames.CacheControl] = "no-store";
        await response.WriteAsJsonAsync(new
        {
            error = "too_many_requests",
            error_description = REJECTED_MESSAGE,
            codigo = McpErrorCodes.RATE_LIMITED,
            mensagem = REJECTED_MESSAGE
        }, cancellationToken);
    }
}
