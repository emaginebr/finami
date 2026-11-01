using Finami.Domain.Models;
using Finami.Infra.Context;
using Finami.Infra.Interfaces.Repository;
using Microsoft.EntityFrameworkCore;

namespace Finami.Infra.Repository;

public class OAuthClientRepository : IOAuthClientRepository<OAuthClient>
{
    private readonly FinamiContext _context;

    public OAuthClientRepository(FinamiContext context)
    {
        _context = context;
    }

    public Task<OAuthClient?> GetByIdAsync(long oauthClientId) =>
        _context.OAuthClients.AsNoTracking().FirstOrDefaultAsync(c => c.OAuthClientId == oauthClientId);

    public Task<OAuthClient?> GetByClientIdAsync(string clientId) =>
        _context.OAuthClients.AsNoTracking().FirstOrDefaultAsync(c => c.ClientId == clientId);

    public async Task<OAuthClient> InsertAsync(OAuthClient client)
    {
        _context.OAuthClients.Add(client);
        await _context.SaveChangesAsync();
        return client;
    }
}
