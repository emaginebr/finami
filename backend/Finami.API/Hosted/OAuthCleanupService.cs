using Finami.Domain.Interfaces;

namespace Finami.API.Hosted;

/// <summary>
/// Limpeza horária do OAuth/MCP (research R-10): roda <see cref="IOAuthMaintenanceService.CleanupAsync"/> num
/// escopo novo a cada hora; falhas são registradas e a próxima rodada tenta de novo.
/// </summary>
public class OAuthCleanupService : BackgroundService
{
    public static readonly TimeSpan INTERVAL = TimeSpan.FromHours(1);
    public static readonly TimeSpan INITIAL_DELAY = TimeSpan.FromMinutes(1);

    private readonly IServiceScopeFactory _scopeFactory;
    private readonly ILogger<OAuthCleanupService> _logger;

    public OAuthCleanupService(IServiceScopeFactory scopeFactory, ILogger<OAuthCleanupService> logger)
    {
        _scopeFactory = scopeFactory;
        _logger = logger;
    }

    protected override async Task ExecuteAsync(CancellationToken stoppingToken)
    {
        try
        {
            // Não disputa o banco com as migrations e o aquecimento da subida.
            await Task.Delay(INITIAL_DELAY, stoppingToken);
            using var timer = new PeriodicTimer(INTERVAL);
            do
            {
                await RunOnceAsync();
            } while (await timer.WaitForNextTickAsync(stoppingToken));
        }
        catch (OperationCanceledException) when (stoppingToken.IsCancellationRequested)
        {
            // Desligando.
        }
    }

    /// <summary>Uma rodada de limpeza; nunca lança.</summary>
    public async Task<OAuthCleanupResult?> RunOnceAsync()
    {
        try
        {
            using var scope = _scopeFactory.CreateScope();
            var result = await scope.ServiceProvider.GetRequiredService<IOAuthMaintenanceService>().CleanupAsync();
            if (result.Total > 0)
                _logger.LogInformation(
                    "Limpeza OAuth/MCP: {Requests} pedidos, {Tokens} tokens, {Keys} chaves de repetição, {Clients} clientes, {Audit} auditorias.",
                    result.Requests, result.Tokens, result.IdempotencyKeys, result.Clients, result.AuditLogs);
            return result;
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Falha na limpeza periódica do OAuth/MCP.");
            return null;
        }
    }
}
