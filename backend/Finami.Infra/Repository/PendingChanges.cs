using Finami.Infra.Context;
using Microsoft.EntityFrameworkCore;

namespace Finami.Infra.Repository;

/// <summary>
/// Gravações "laterais" do MCP (auditoria, chave de repetição) acontecem também depois de uma operação que
/// falhou; descarta alterações pendentes dessa operação para que o <c>SaveChanges</c> seguinte não as repita.
/// </summary>
internal static class PendingChanges
{
    public static void Discard(FinamiContext context)
    {
        foreach (var entry in context.ChangeTracker.Entries()
                     .Where(e => e.State is EntityState.Added or EntityState.Modified or EntityState.Deleted)
                     .ToList())
            entry.State = EntityState.Detached;
    }
}
