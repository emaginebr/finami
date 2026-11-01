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

        services.AddFinamiAuthentication(configuration);
        return services;
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
