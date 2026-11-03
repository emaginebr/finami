using System.Reflection;
using Finami.API.Auth;
using ModelContextProtocol.Protocol;

namespace Finami.API.Mcp;

/// <summary>
/// Servidor MCP do Finami (research R-01): SDK oficial, Streamable HTTP stateless em <c>/mcp</c>, esquema
/// <c>McpBearer</c> só nessa rota e CORS público sem credenciais em <c>/mcp</c>, <c>/oauth/*</c> e
/// <c>/.well-known/*</c> (Complexity Tracking VI).
/// </summary>
public static class McpServerSetup
{
    public const string MCP_PATH = "/mcp";

    /// <summary>Qualquer origem, sem credenciais, expõe <c>WWW-Authenticate</c>.</summary>
    public const string CORS_POLICY = "McpPublic";

    public const string SERVER_NAME = "finami";
    public const string SERVER_TITLE = "Finami";

    public const string INSTRUCTIONS =
        "Finami é o app de finanças da família. Valores em reais (BRL) e bitcoin (BTC). " +
        "Antes de alterar dados, confirme com a pessoa. Use listar_carteiras para descobrir ids. " +
        Prompts.FinamiPrompts.TRANSFER_GUIDANCE;

    public static IServiceCollection AddFinamiMcp(this IServiceCollection services)
    {
        services.AddAuthentication()
            .AddScheme<McpBearerOptions, McpBearerHandler>(McpBearerDefaults.AUTHENTICATION_SCHEME, _ => { });
        services.AddAuthorization(options =>
            options.AddPolicy(McpBearerDefaults.POLICY, policy => policy
                .AddAuthenticationSchemes(McpBearerDefaults.AUTHENTICATION_SCHEME)
                .RequireAuthenticatedUser()));

        services.AddCors(options => options.AddPolicy(CORS_POLICY, policy => policy
            .AllowAnyOrigin()
            .AllowAnyHeader()
            .AllowAnyMethod()
            .WithExposedHeaders("WWW-Authenticate", "Mcp-Session-Id", "Mcp-Protocol-Version")));

        services.AddMcpServer(options =>
            {
                options.ServerInfo = new Implementation
                {
                    Name = SERVER_NAME,
                    Title = SERVER_TITLE,
                    Version = typeof(McpServerSetup).Assembly.GetName().Version?.ToString(3) ?? "1.0.0"
                };
                options.ServerInstructions = INSTRUCTIONS;
            })
            .WithHttpTransport(options => options.Stateless = true)
            .AddAuthorizationFilters()
            .WithToolsFromAssembly(Assembly.GetExecutingAssembly())
            .WithResourcesFromAssembly(Assembly.GetExecutingAssembly())
            .WithPromptsFromAssembly(Assembly.GetExecutingAssembly());

        return services;
    }

    /// <summary>Mapeia <c>/mcp</c> exigindo o token do MCP (nunca o JWT do app).</summary>
    public static IEndpointConventionBuilder MapFinamiMcp(this IEndpointRouteBuilder endpoints) =>
        endpoints.MapMcp(MCP_PATH)
            .RequireAuthorization(McpBearerDefaults.POLICY)
            .RequireCors(CORS_POLICY);
}
