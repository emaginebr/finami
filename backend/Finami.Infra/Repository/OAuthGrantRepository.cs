using Finami.Domain.Enums;
using Finami.Domain.Models;
using Finami.Infra.Context;
using Finami.Infra.Interfaces.Repository;
using Microsoft.EntityFrameworkCore;

namespace Finami.Infra.Repository;

public class OAuthGrantRepository : IOAuthGrantRepository<OAuthGrant>
{
    private readonly FinamiContext _context;

    public OAuthGrantRepository(FinamiContext context)
    {
        _context = context;
    }

    public Task<OAuthGrant?> GetByIdAsync(long grantId) =>
        _context.OAuthGrants.Include(g => g.Client).FirstOrDefaultAsync(g => g.OAuthGrantId == grantId);

    public Task<OAuthGrant?> GetActiveAsync(long userId, long oauthClientId) =>
        _context.OAuthGrants.FirstOrDefaultAsync(g => g.UserId == userId
                                                      && g.OAuthClientId == oauthClientId
                                                      && g.Status == OAuthGrantStatus.Active);

    public Task<List<OAuthGrant>> ListActiveByUserAsync(long userId) =>
        _context.OAuthGrants.AsNoTracking().Include(g => g.Client)
            .Where(g => g.UserId == userId && g.Status == OAuthGrantStatus.Active)
            .OrderByDescending(g => g.CreatedAt).ThenByDescending(g => g.OAuthGrantId)
            .ToListAsync();

    public async Task<OAuthGrant> InsertAsync(OAuthGrant grant)
    {
        _context.OAuthGrants.Add(grant);
        await _context.SaveChangesAsync();
        return grant;
    }

    public async Task<OAuthGrant> UpdateAsync(OAuthGrant grant)
    {
        if (_context.Entry(grant).State == EntityState.Detached)
            _context.OAuthGrants.Update(grant);
        await _context.SaveChangesAsync();
        return grant;
    }
}
