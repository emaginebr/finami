using Finami.Domain.Models;
using Finami.Infra.Context;
using Finami.Infra.Interfaces.Repository;

namespace Finami.Infra.Repository;

public class McpAuditRepository : IMcpAuditRepository<McpAuditLog>
{
    private readonly FinamiContext _context;

    public McpAuditRepository(FinamiContext context)
    {
        _context = context;
    }

    public async Task<McpAuditLog> InsertAsync(McpAuditLog log)
    {
        PendingChanges.Discard(_context);
        _context.McpAuditLogs.Add(log);
        await _context.SaveChangesAsync();
        return log;
    }
}
