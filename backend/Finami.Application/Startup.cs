using System.Text;
using Finami.Domain.Interfaces;
using Finami.Domain.Models;
using Finami.Domain.Services;
using Finami.DTO.Auth;
using Finami.DTO.Settings;
using Finami.Infra.AppServices;
using Finami.Infra.Context;
using Finami.Infra.Interfaces.AppServices;
using Finami.Infra.Interfaces.Repository;
using Finami.Infra.Repository;
using Microsoft.AspNetCore.Identity;
using FluentValidation;
using Microsoft.AspNetCore.Authentication.JwtBearer;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.IdentityModel.Tokens;

namespace Finami.Application;

public static class Startup
{
    public const int MIN_JWT_SECRET_BYTES = 32;

    public static IServiceCollection ConfigureFinami(this IServiceCollection services, IConfiguration configuration)
    {
        // Settings (IOptions)
        services.Configure<JwtSettings>(configuration.GetSection("Jwt"));
        services.Configure<GoogleSettings>(configuration.GetSection("Google"));
        services.Configure<BtcQuoteSettings>(configuration.GetSection("BtcQuote"));
        services.Configure<CorsSettings>(configuration.GetSection("Cors"));
        services.Configure<DatabaseSettings>(configuration.GetSection("Database"));
        services.Configure<McpSettings>(configuration.GetSection("Mcp"));
        services.Configure<AppSettings>(configuration.GetSection("App"));

        // DbContext
        services.AddDbContext<FinamiContext>(options =>
            options.UseNpgsql(configuration.GetConnectionString("FinamiContext")));

        services.AddMemoryCache();
        services.AddScoped<IUnitOfWork, UnitOfWork>();

        // Validators (FluentValidation) do Domain
        services.AddValidatorsFromAssembly(typeof(Finami.Domain.Services.Money).Assembly);

        // Repositories
        services.AddScoped<IUserRepository<User>, UserRepository>();
        services.AddScoped<IAccountRepository<Account>, AccountRepository>();
        services.AddScoped<ITransactionRepository<Transaction>, TransactionRepository>();
        services.AddScoped<IBtcQuoteRepository<BtcQuote>, BtcQuoteRepository>();
        services.AddScoped<IGroupRepository<Group>, GroupRepository>();
        services.AddScoped<ILedgerRepository<LedgerEntry>, LedgerRepository>();
        services.AddScoped<IGroupInvitationRepository<GroupInvitation>, GroupInvitationRepository>();
        services.AddScoped<INotificationRepository<Notification>, NotificationRepository>();
        services.AddScoped<IOAuthClientRepository<OAuthClient>, OAuthClientRepository>();
        services.AddScoped<IOAuthGrantRepository<OAuthGrant>, OAuthGrantRepository>();
        services.AddScoped<IOAuthRequestRepository<OAuthAuthorizationRequest>, OAuthRequestRepository>();
        services.AddScoped<IOAuthTokenRepository<OAuthToken>, OAuthTokenRepository>();
        services.AddScoped<IMcpIdempotencyRepository<McpIdempotencyKey>, McpIdempotencyRepository>();
        services.AddScoped<IMcpAuditRepository<McpAuditLog>, McpAuditRepository>();
        services.AddScoped<IOAuthCleanupRepository, OAuthCleanupRepository>();

        // AppServices
        services.AddScoped<IGoogleTokenAppService<GoogleUserPayload>, GoogleTokenAppService>();
        services.AddHttpClient<IBtcQuoteAppService<BtcQuote>, BtcQuoteAppService>(client =>
        {
            client.DefaultRequestHeaders.UserAgent.ParseAdd("Finami/1.0");
            client.DefaultRequestHeaders.Accept.ParseAdd("application/json");
        });

        // Domain Services
        services.AddScoped<IPasswordHasher<User>, PasswordHasher<User>>();
        services.AddScoped<ITokenService, TokenService>();
        services.AddScoped<IAuthService, AuthService>();
        services.AddScoped<IAccessPolicy, AccessPolicy>();
        services.AddScoped<IUserService, UserService>();
        services.AddScoped<IGroupService, GroupService>();
        services.AddScoped<IWalletService, WalletService>();
        services.AddScoped<IQuoteService, QuoteService>();
        services.AddScoped<ILedgerService, LedgerService>();
        services.AddScoped<IStatementService, StatementService>();
        services.AddScoped<IBalanceService, BalanceService>();
        services.AddScoped<IInvitationService, InvitationService>();
        services.AddScoped<INotificationService, NotificationService>();
        services.AddSingleton(TimeProvider.System);
        services.AddScoped<IOAuthService, OAuthService>();
        services.AddScoped<IOAuthConnectionService, OAuthConnectionService>();
        services.AddScoped<IMcpIdempotencyService, McpIdempotencyService>();
        services.AddScoped<IMcpAuditService, McpAuditService>();
        services.AddScoped<IOAuthMaintenanceService, OAuthMaintenanceService>();

        services.AddFinamiAuthentication(configuration);
        ValidateMcpPublicUrl(configuration);
        return services;
    }

    /// <summary>FR-026: HTTP só é aceito quando a URL pública do MCP é localhost/loopback.</summary>
    private static void ValidateMcpPublicUrl(IConfiguration configuration)
    {
        var mcp = configuration.GetSection("Mcp").Get<McpSettings>() ?? new McpSettings();
        if (string.IsNullOrWhiteSpace(mcp.PublicUrl))
            return;
        if (!Uri.TryCreate(mcp.PublicUrl, UriKind.Absolute, out var uri)
            || (uri.Scheme != Uri.UriSchemeHttps && !(uri.Scheme == Uri.UriSchemeHttp && uri.IsLoopback)))
            throw new InvalidOperationException(
                "Mcp:PublicUrl deve ser uma URL https (http só em localhost). Ajuste a variável Mcp__PublicUrl.");
    }

    private static void AddFinamiAuthentication(this IServiceCollection services, IConfiguration configuration)
    {
        var jwt = configuration.GetSection("Jwt").Get<JwtSettings>() ?? new JwtSettings();
        if (Encoding.UTF8.GetByteCount(jwt.Secret) < MIN_JWT_SECRET_BYTES)
            throw new InvalidOperationException(
                $"Jwt:Secret deve ter pelo menos {MIN_JWT_SECRET_BYTES} bytes. Defina a variável Jwt__Secret.");

        services.AddAuthentication(JwtBearerDefaults.AuthenticationScheme)
            .AddJwtBearer(options =>
            {
                options.MapInboundClaims = false;
                options.TokenValidationParameters = new TokenValidationParameters
                {
                    ValidateIssuer = true,
                    ValidIssuer = jwt.Issuer,
                    ValidateAudience = true,
                    ValidAudience = jwt.Audience,
                    ValidateLifetime = true,
                    ValidateIssuerSigningKey = true,
                    IssuerSigningKey = new SymmetricSecurityKey(Encoding.UTF8.GetBytes(jwt.Secret)),
                    ClockSkew = TimeSpan.FromMinutes(1),
                    NameClaimType = "name"
                };
            });
        services.AddAuthorization();
    }
}
