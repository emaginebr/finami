using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Design;

namespace Finami.Infra.Context;

/// <summary>Usado pelo dotnet ef em tempo de design.</summary>
public class FinamiContextFactory : IDesignTimeDbContextFactory<FinamiContext>
{
    public FinamiContext CreateDbContext(string[] args)
    {
        var connectionString = Environment.GetEnvironmentVariable("ConnectionStrings__FinamiContext")
            ?? "Host=localhost;Port=5432;Database=finami;Username=finami;Password=finami";
        var options = new DbContextOptionsBuilder<FinamiContext>()
            .UseNpgsql(connectionString)
            .Options;
        return new FinamiContext(options);
    }
}
