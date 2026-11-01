using Finami.Domain.Interfaces;
using Finami.Infra.Interfaces.Repository;

namespace Finami.Domain.Services;

/// <summary>
/// Regras de retenção (research R-10): pedidos vencidos; tokens de acesso vencidos há mais de 1 dia; tokens de
/// renovação vencidos ou revogados há mais de 30 dias; chaves de repetição com mais de 24 h; clientes dinâmicos
/// sem conexão há 30 dias; auditoria por 1 ano.
/// </summary>
public class OAuthMaintenanceService : IOAuthMaintenanceService
{
    public static readonly TimeSpan ACCESS_TOKEN_RETENTION = TimeSpan.FromDays(1);
    public static readonly TimeSpan REFRESH_TOKEN_RETENTION = TimeSpan.FromDays(30);
    public static readonly TimeSpan UNUSED_CLIENT_RETENTION = TimeSpan.FromDays(30);
    public static readonly TimeSpan AUDIT_RETENTION = TimeSpan.FromDays(365);

    private readonly IOAuthCleanupRepository _repository;
    private readonly TimeProvider _time;

    public OAuthMaintenanceService(IOAuthCleanupRepository repository, TimeProvider? time = null)
    {
        _repository = repository;
        _time = time ?? TimeProvider.System;
    }

    public async Task<OAuthCleanupResult> CleanupAsync()
    {
        var now = _time.GetUtcNow().UtcDateTime;
        // Pedidos antes dos clientes: um pedido vencido ainda segura o cliente pela FK.
        var requests = await _repository.DeleteExpiredRequestsAsync(now);
        var tokens = await _repository.DeleteOldTokensAsync(now - ACCESS_TOKEN_RETENTION, now - REFRESH_TOKEN_RETENTION);
        var keys = await _repository.DeleteIdempotencyKeysAsync(now - McpIdempotencyService.KEY_LIFETIME);
        var clients = await _repository.DeleteUnusedDynamicClientsAsync(now - UNUSED_CLIENT_RETENTION);
        var audit = await _repository.DeleteAuditLogsAsync(now - AUDIT_RETENTION);
        return new OAuthCleanupResult(requests, tokens, keys, clients, audit);
    }
}
