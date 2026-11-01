using Finami.Domain.Enums;
using Finami.Domain.Exceptions;
using Finami.Domain.Interfaces;
using Finami.Domain.Models;
using Finami.DTO.OAuth;
using Finami.Infra.Interfaces.Repository;

namespace Finami.Domain.Services;

/// <summary>
/// Gestão das conexões pela pessoa (US4). Desconectar revoga a conexão e os tokens na mesma transação: a
/// próxima chamada do assistente recebe 401 e a renovação falha (revogação imediata, research R-03).
/// </summary>
public class OAuthConnectionService : IOAuthConnectionService
{
    public const string CONNECTION_NOT_FOUND_MESSAGE = "Conexão não encontrada.";
    public static readonly TimeSpan TOUCH_INTERVAL = TimeSpan.FromMinutes(1);

    private readonly IOAuthGrantRepository<OAuthGrant> _grantRepository;
    private readonly IOAuthTokenRepository<OAuthToken> _tokenRepository;
    private readonly IUnitOfWork _unitOfWork;
    private readonly IOAuthService _oauthService;
    private readonly TimeProvider _time;

    public OAuthConnectionService(
        IOAuthGrantRepository<OAuthGrant> grantRepository,
        IOAuthTokenRepository<OAuthToken> tokenRepository,
        IUnitOfWork unitOfWork,
        IOAuthService oauthService,
        TimeProvider? time = null)
    {
        _grantRepository = grantRepository;
        _tokenRepository = tokenRepository;
        _unitOfWork = unitOfWork;
        _oauthService = oauthService;
        _time = time ?? TimeProvider.System;
    }

    private DateTime Now => _time.GetUtcNow().UtcDateTime;

    public async Task<List<OAuthConnectionInfo>> ListAsync(long userId)
    {
        var grants = await _grantRepository.ListActiveByUserAsync(userId);
        return grants.Select(g => new OAuthConnectionInfo
        {
            ConnectionId = g.OAuthGrantId,
            ClientName = g.Client?.ClientName ?? string.Empty,
            Scopes = g.ScopeList,
            CreatedAt = g.CreatedAt,
            LastUsedAt = g.LastUsedAt
        }).ToList();
    }

    public async Task DisconnectAsync(long userId, long connectionId)
    {
        await _unitOfWork.BeginTransactionAsync();
        try
        {
            var grant = await _grantRepository.GetByIdAsync(connectionId);
            if (grant == null || grant.UserId != userId || !grant.IsActive)
                throw new NotFoundException(CONNECTION_NOT_FOUND_MESSAGE);
            await RevokeAsync(grant, OAuthRevokeReason.UserDisconnected, Now);
            await _unitOfWork.CommitAsync();
        }
        catch
        {
            await _unitOfWork.RollbackAsync();
            throw;
        }
    }

    public async Task<int> DisconnectAllAsync(long userId)
    {
        var now = Now;
        var active = await _grantRepository.ListActiveByUserAsync(userId);
        if (active.Count == 0)
            return 0;

        await _unitOfWork.BeginTransactionAsync();
        try
        {
            var count = 0;
            foreach (var item in active)
            {
                var grant = await _grantRepository.GetByIdAsync(item.OAuthGrantId);
                if (grant == null || grant.UserId != userId || !grant.IsActive)
                    continue;
                await RevokeAsync(grant, OAuthRevokeReason.UserDisconnectedAll, now);
                count++;
            }
            await _unitOfWork.CommitAsync();
            return count;
        }
        catch
        {
            await _unitOfWork.RollbackAsync();
            throw;
        }
    }

    public async Task<bool> TouchLastUsedAsync(long connectionId, DateTime? lastUsedAt)
    {
        var now = Now;
        if (lastUsedAt.HasValue && now - lastUsedAt.Value < TOUCH_INTERVAL)
            return false;

        var grant = await _grantRepository.GetByIdAsync(connectionId);
        if (grant == null || !grant.IsActive)
            return false;
        // Outra requisição pode ter gravado entre a validação do token e aqui.
        if (grant.LastUsedAt.HasValue && now - grant.LastUsedAt.Value < TOUCH_INTERVAL)
            return false;
        grant.LastUsedAt = now;
        await _grantRepository.UpdateAsync(grant);
        return true;
    }

    public McpInfoResult GetMcpInfo() => new() { McpUrl = _oauthService.ResourceUrl };

    private async Task RevokeAsync(OAuthGrant grant, OAuthRevokeReason reason, DateTime now)
    {
        grant.Revoke(reason, now);
        await _grantRepository.UpdateAsync(grant);
        await _tokenRepository.RevokeByGrantAsync(grant.OAuthGrantId, now);
    }
}
