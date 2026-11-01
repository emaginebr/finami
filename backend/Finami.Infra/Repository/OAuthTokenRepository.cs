using Finami.Domain.Models;
using Finami.Infra.Context;
using Finami.Infra.Interfaces.Repository;
using Microsoft.EntityFrameworkCore;

namespace Finami.Infra.Repository;

public class OAuthTokenRepository : IOAuthTokenRepository<OAuthToken>
{
    private readonly FinamiContext _context;

    public OAuthTokenRepository(FinamiContext context)
    {
        _context = context;
    }

    public Task<OAuthToken?> GetByHashAsync(string tokenHash) =>
        _context.OAuthTokens.AsNoTracking()
            .Include(t => t.Grant).ThenInclude(g => g!.Client)
            .FirstOrDefaultAsync(t => t.TokenHash == tokenHash);

    public async Task<OAuthToken?> GetByHashForUpdateAsync(string tokenHash)
    {
        var token = await RowLock.FirstForUpdateAsync<OAuthToken>(_context,
            $"SELECT * FROM oauth_tokens WHERE token_hash = {tokenHash} FOR UPDATE",
            t => t.TokenHash == tokenHash);
        if (token != null)
        {
            await _context.Entry(token).Reference(t => t.Grant).LoadAsync();
            if (token.Grant != null)
                await _context.Entry(token.Grant).Reference(g => g.Client).LoadAsync();
        }
        return token;
    }

    public async Task<OAuthToken> InsertAsync(OAuthToken token)
    {
        _context.OAuthTokens.Add(token);
        await _context.SaveChangesAsync();
        return token;
    }

    public async Task<OAuthToken> UpdateAsync(OAuthToken token)
    {
        if (_context.Entry(token).State == EntityState.Detached)
            _context.OAuthTokens.Update(token);
        await _context.SaveChangesAsync();
        return token;
    }

    public async Task<int> RevokeByGrantAsync(long grantId, DateTime now)
    {
        // Só os ainda válidos (poucos por conexão): carrega e grava pelo modelo, mantendo o conversor UTC.
        var tokens = await _context.OAuthTokens
            .Where(t => t.OAuthGrantId == grantId && t.RevokedAt == null && t.ExpiresAt > now)
            .ToListAsync();
        foreach (var token in tokens)
            token.Revoke(now);
        await _context.SaveChangesAsync();
        return tokens.Count;
    }
}
