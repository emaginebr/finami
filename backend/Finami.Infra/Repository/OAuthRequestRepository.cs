using Finami.Domain.Models;
using Finami.Infra.Context;
using Finami.Infra.Interfaces.Repository;
using Microsoft.EntityFrameworkCore;

namespace Finami.Infra.Repository;

public class OAuthRequestRepository : IOAuthRequestRepository<OAuthAuthorizationRequest>
{
    private readonly FinamiContext _context;

    public OAuthRequestRepository(FinamiContext context)
    {
        _context = context;
    }

    public Task<OAuthAuthorizationRequest?> GetByRequestKeyAsync(string requestKey) =>
        _context.OAuthAuthorizationRequests.AsNoTracking().Include(r => r.Client)
            .FirstOrDefaultAsync(r => r.RequestKey == requestKey);

    public async Task<OAuthAuthorizationRequest?> GetByRequestKeyForUpdateAsync(string requestKey)
    {
        var request = await RowLock.FirstForUpdateAsync<OAuthAuthorizationRequest>(_context,
            $"SELECT * FROM oauth_authorization_requests WHERE request_key = {requestKey} FOR UPDATE",
            r => r.RequestKey == requestKey);
        return await WithClientAsync(request);
    }

    public async Task<OAuthAuthorizationRequest?> GetByCodeHashForUpdateAsync(string codeHash)
    {
        var request = await RowLock.FirstForUpdateAsync<OAuthAuthorizationRequest>(_context,
            $"SELECT * FROM oauth_authorization_requests WHERE code_hash = {codeHash} FOR UPDATE",
            r => r.CodeHash == codeHash);
        return await WithClientAsync(request);
    }

    public async Task<OAuthAuthorizationRequest> InsertAsync(OAuthAuthorizationRequest request)
    {
        _context.OAuthAuthorizationRequests.Add(request);
        await _context.SaveChangesAsync();
        return request;
    }

    public async Task<OAuthAuthorizationRequest> UpdateAsync(OAuthAuthorizationRequest request)
    {
        if (_context.Entry(request).State == EntityState.Detached)
            _context.OAuthAuthorizationRequests.Update(request);
        await _context.SaveChangesAsync();
        return request;
    }

    private async Task<OAuthAuthorizationRequest?> WithClientAsync(OAuthAuthorizationRequest? request)
    {
        if (request != null)
            await _context.Entry(request).Reference(r => r.Client).LoadAsync();
        return request;
    }
}
