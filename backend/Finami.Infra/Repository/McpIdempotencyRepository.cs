using Finami.Domain.Models;
using Finami.Infra.Context;
using Finami.Infra.Interfaces.Repository;
using Microsoft.EntityFrameworkCore;

namespace Finami.Infra.Repository;

public class McpIdempotencyRepository : IMcpIdempotencyRepository<McpIdempotencyKey>
{
    private readonly FinamiContext _context;

    public McpIdempotencyRepository(FinamiContext context)
    {
        _context = context;
    }

    public Task<McpIdempotencyKey?> GetAsync(long userId, string toolName, string idempotencyKey) =>
        _context.McpIdempotencyKeys.AsNoTracking()
            .FirstOrDefaultAsync(k => k.UserId == userId && k.ToolName == toolName && k.IdempotencyKey == idempotencyKey);

    public async Task<McpIdempotencyKey> InsertAsync(McpIdempotencyKey key)
    {
        _context.McpIdempotencyKeys.Add(key);
        try
        {
            await _context.SaveChangesAsync();
        }
        catch
        {
            // Não deixa a entidade com falha pendurada no contexto (a próxima SaveChanges a repetiria).
            _context.Entry(key).State = EntityState.Detached;
            throw;
        }
        return key;
    }

    public async Task<McpIdempotencyKey> UpdateAsync(McpIdempotencyKey key)
    {
        if (_context.Entry(key).State == EntityState.Detached)
            _context.McpIdempotencyKeys.Update(key);
        await _context.SaveChangesAsync();
        return key;
    }

    public async Task DeleteAsync(McpIdempotencyKey key)
    {
        // Chamado quando a operação falhou: não regrava o que ela deixou pendente.
        PendingChanges.Discard(_context);
        _context.McpIdempotencyKeys.Remove(key);
        await _context.SaveChangesAsync();
    }
}
