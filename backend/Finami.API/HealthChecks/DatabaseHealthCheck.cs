using Finami.Infra.Context;
using Microsoft.Extensions.Diagnostics.HealthChecks;

namespace Finami.API.HealthChecks;

/// <summary>Verifica se a API consegue abrir conexão com o PostgreSQL (usado por GET /health).</summary>
public class DatabaseHealthCheck : IHealthCheck
{
    private readonly FinamiContext _context;

    public DatabaseHealthCheck(FinamiContext context)
    {
        _context = context;
    }

    public async Task<HealthCheckResult> CheckHealthAsync(HealthCheckContext context, CancellationToken cancellationToken = default)
    {
        try
        {
            return await _context.Database.CanConnectAsync(cancellationToken)
                ? HealthCheckResult.Healthy("Banco de dados acessível.")
                : HealthCheckResult.Unhealthy("Não foi possível conectar ao banco de dados.");
        }
        catch (Exception ex)
        {
            return HealthCheckResult.Unhealthy("Falha ao verificar o banco de dados.", ex);
        }
    }
}
