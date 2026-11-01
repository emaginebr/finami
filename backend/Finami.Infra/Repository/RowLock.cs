using System.Linq.Expressions;
using Finami.Infra.Context;
using Microsoft.EntityFrameworkCore;

namespace Finami.Infra.Repository;

/// <summary>
/// Leitura com bloqueio de linha (SELECT ... FOR UPDATE) no PostgreSQL. Em provedores não relacionais
/// (EF InMemory dos testes de integração da API) cai para uma consulta comum.
/// </summary>
internal static class RowLock
{
    public static async Task<T?> FirstForUpdateAsync<T>(FinamiContext context, FormattableString sql,
        Expression<Func<T, bool>> fallback) where T : class
    {
        var set = context.Set<T>();
        var entity = context.Database.IsRelational()
            ? (await set.FromSqlInterpolated(sql).ToListAsync()).FirstOrDefault()
            : await set.FirstOrDefaultAsync(fallback);
        // Se a entidade já estava rastreada, o EF devolve a instância antiga: relê após o bloqueio.
        if (entity != null)
            await context.Entry(entity).ReloadAsync();
        return entity;
    }
}
