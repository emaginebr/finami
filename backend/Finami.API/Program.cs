using Finami.API.Extensions;
using Finami.API.HealthChecks;
using Finami.Application;
using Finami.DTO;
using Finami.DTO.Settings;
using Finami.Infra.Context;
using Microsoft.AspNetCore.HttpOverrides;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Microsoft.OpenApi.Models;

const string CORS_POLICY = "FinamiCors";

var builder = WebApplication.CreateBuilder(args);

builder.Services.ConfigureFinami(builder.Configuration);

builder.Services.AddControllers()
    .AddJsonOptions(options =>
    {
        // Enums como texto e NumberHandling = JsonNumberHandling.AllowReadingFromString (contracts/api-additions.md §1).
        options.JsonSerializerOptions.ConfigureFinamiJson();
    })
    .ConfigureApiBehaviorOptions(options =>
    {
        // Erros de model binding (JSON malformado, tipos inválidos) também usam o envelope { sucesso, mensagem, erros }.
        options.InvalidModelStateResponseFactory = context => new BadRequestObjectResult(new ErrorResult
        {
            Sucesso = false,
            Mensagem = "Requisição inválida.",
            Erros = context.ModelState
                .Where(e => e.Value?.Errors.Count > 0)
                .SelectMany(e => e.Value!.Errors.Select(err =>
                    string.IsNullOrWhiteSpace(err.ErrorMessage) ? $"Valor inválido em '{e.Key}'." : err.ErrorMessage))
                .ToList()
        });
    });

builder.Services.AddCors(options =>
{
    options.AddPolicy(CORS_POLICY, policy =>
    {
        if (builder.Environment.IsDevelopment())
        {
            // Princípio VI: AllowAnyOrigin apenas em Development.
            policy.AllowAnyOrigin().AllowAnyHeader().AllowAnyMethod();
        }
        else
        {
            var cors = builder.Configuration.GetSection("Cors").Get<CorsSettings>() ?? new CorsSettings();
            policy.WithOrigins(cors.AllowedOrigins).AllowAnyHeader().AllowAnyMethod();
        }
    });
});

// Homolog/prod rodam atrás de um proxy (Caddy/nginx) na rede interna do compose: confia em
// X-Forwarded-For/Proto vindos de qualquer origem, pois a API não é exposta diretamente.
builder.Services.Configure<ForwardedHeadersOptions>(options =>
{
    options.ForwardedHeaders = ForwardedHeaders.XForwardedFor | ForwardedHeaders.XForwardedProto;
    options.KnownNetworks.Clear();
    options.KnownProxies.Clear();
});

// GET /health (healthcheck do compose): inclui a conexão com o PostgreSQL.
builder.Services.AddHealthChecks()
    .AddCheck<DatabaseHealthCheck>("database");

builder.Services.AddEndpointsApiExplorer();
builder.Services.AddSwaggerGen(options =>
{
    options.SwaggerDoc("v1", new OpenApiInfo { Title = "Finami API", Version = "v1" });
    var xmlFile = Path.Combine(AppContext.BaseDirectory, $"{typeof(Program).Assembly.GetName().Name}.xml");
    if (File.Exists(xmlFile))
        options.IncludeXmlComments(xmlFile);
    var scheme = new OpenApiSecurityScheme
    {
        Name = "Authorization",
        Type = SecuritySchemeType.Http,
        Scheme = "bearer",
        BearerFormat = "JWT",
        In = ParameterLocation.Header,
        Description = "Informe o token JWT (sem o prefixo Bearer).",
        Reference = new OpenApiReference { Type = ReferenceType.SecurityScheme, Id = "Bearer" }
    };
    options.AddSecurityDefinition("Bearer", scheme);
    options.AddSecurityRequirement(new OpenApiSecurityRequirement { { scheme, Array.Empty<string>() } });
});

var app = builder.Build();

if (app.Environment.IsDevelopment())
{
    app.UseSwagger();
    app.UseSwaggerUI();
}
else
{
    // Precisa vir antes de UseHttpsRedirection para o esquema https do proxy ser respeitado.
    app.UseForwardedHeaders();
}

app.UseHttpsRedirection();
app.UseCors(CORS_POLICY);
app.UseAuthentication();
app.UseAuthorization();
app.MapControllers();
app.MapHealthChecks("/health").AllowAnonymous();

var databaseSettings = app.Configuration.GetSection("Database").Get<DatabaseSettings>() ?? new DatabaseSettings();
if (databaseSettings.MigrateOnStartup)
{
    using var scope = app.Services.CreateScope();
    var logger = scope.ServiceProvider.GetRequiredService<ILogger<Program>>();
    var context = scope.ServiceProvider.GetRequiredService<FinamiContext>();
    logger.LogInformation("Database:MigrateOnStartup=true: aplicando migrations pendentes do FinamiContext...");
    await context.Database.MigrateAsync();
    logger.LogInformation("Migrations aplicadas.");
}

app.Run();

public partial class Program
{
}
