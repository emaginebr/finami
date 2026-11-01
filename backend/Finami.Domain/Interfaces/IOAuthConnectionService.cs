using Finami.DTO.OAuth;

namespace Finami.Domain.Interfaces;

/// <summary>"Assistentes conectados" da tela Conta (US4, contracts/api.md) e último uso das conexões.</summary>
public interface IOAuthConnectionService
{
    /// <summary>Conexões ativas da pessoa, mais recentes primeiro.</summary>
    Task<List<OAuthConnectionInfo>> ListAsync(long userId);

    /// <summary>Revoga a conexão e todos os tokens dela (<c>UserDisconnected</c>); 404 se não for da pessoa ou já revogada.</summary>
    Task DisconnectAsync(long userId, long connectionId);

    /// <summary>Revoga todas as conexões ativas da pessoa (<c>UserDisconnectedAll</c>); devolve quantas.</summary>
    Task<int> DisconnectAllAsync(long userId);

    /// <summary>
    /// Atualiza <c>last_used_at</c> da conexão no máximo 1 vez por minuto: com <paramref name="lastUsedAt"/>
    /// recente, nada é gravado. Devolve <c>true</c> quando gravou.
    /// </summary>
    Task<bool> TouchLastUsedAsync(long connectionId, DateTime? lastUsedAt);

    /// <summary>Endereço do servidor MCP para copiar (<c>{Mcp:PublicUrl}/mcp</c>).</summary>
    McpInfoResult GetMcpInfo();
}
