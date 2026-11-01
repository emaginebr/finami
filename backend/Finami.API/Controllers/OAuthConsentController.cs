using Finami.Domain.Interfaces;
using Finami.DTO.OAuth;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace Finami.API.Controllers;

/// <summary>
/// Consentimento OAuth pela tela <c>/autorizar</c> do app (contracts/api.md). Exige o JWT do app; o token
/// do MCP é recusado aqui (esquema padrão JwtBearer).
/// </summary>
[Route("api/oauth")]
[Authorize]
public class OAuthConsentController : FinamiControllerBase
{
    private readonly IOAuthService _oauthService;
    private readonly IOAuthConnectionService _connectionService;

    public OAuthConsentController(IOAuthService oauthService, IOAuthConnectionService connectionService)
    {
        _oauthService = oauthService;
        _connectionService = connectionService;
    }

    /// <summary>Pedido de autorização exibido na tela de consentimento.</summary>
    /// <param name="requestKey">Valor do parâmetro <c>pedido</c> da URL <c>/autorizar</c>.</param>
    /// <response code="200">Assistente, domínio de retorno, permissões pedidas e validade.</response>
    /// <response code="404">"Pedido de autorização não encontrado."</response>
    /// <response code="410">Pedido vencido ou já respondido.</response>
    [HttpGet("requests/{requestKey}")]
    public Task<IActionResult> GetRequest(string requestKey) =>
        Execute(async () => Ok(await _oauthService.GetRequestAsync(CurrentUserId, requestKey)));

    /// <summary>
    /// Autoriza o assistente com as permissões escolhidas (subconjunto do pedido; <c>finami:write</c> leva
    /// <c>finami:read</c>). Reautorizar o mesmo assistente substitui as permissões e encerra os tokens antigos.
    /// </summary>
    /// <response code="200"><c>redirectUrl</c> com <c>code</c> e <c>state</c> para o assistente.</response>
    /// <response code="400">Permissões inválidas.</response>
    /// <response code="404">Pedido não encontrado.</response>
    /// <response code="410">Pedido vencido ou já respondido.</response>
    [HttpPost("requests/{requestKey}/approve")]
    public Task<IActionResult> Approve(string requestKey, [FromBody] OAuthApproveInfo info) =>
        Execute(async () => Ok(await _oauthService.ApproveAsync(CurrentUserId, requestKey, info)));

    /// <summary>Nega o acesso: <c>redirectUrl</c> com <c>error=access_denied</c> e <c>state</c>.</summary>
    /// <response code="200"><c>redirectUrl</c> para o assistente.</response>
    /// <response code="404">Pedido não encontrado.</response>
    /// <response code="410">Pedido vencido ou já respondido.</response>
    [HttpPost("requests/{requestKey}/deny")]
    public Task<IActionResult> Deny(string requestKey) =>
        Execute(async () => Ok(await _oauthService.DenyAsync(CurrentUserId, requestKey)));

    /// <summary>Assistentes conectados à sua conta (conexões ativas, mais recentes primeiro).</summary>
    /// <response code="200">Lista de <c>OAuthConnectionInfo</c> (nome, permissões, criação e último uso).</response>
    [HttpGet("connections")]
    public Task<IActionResult> ListConnections() =>
        Execute(async () => Ok(await _connectionService.ListAsync(CurrentUserId)));

    /// <summary>Desconecta um assistente: a conexão e todos os tokens dela deixam de valer na hora.</summary>
    /// <param name="connectionId">Identificador da conexão.</param>
    /// <response code="204">Desconectado.</response>
    /// <response code="404">"Conexão não encontrada." (de outra pessoa ou já desconectada).</response>
    [HttpDelete("connections/{connectionId:long}")]
    public Task<IActionResult> Disconnect(long connectionId) =>
        Execute(async () =>
        {
            await _connectionService.DisconnectAsync(CurrentUserId, connectionId);
            return NoContent();
        });

    /// <summary>Desconecta todos os assistentes da sua conta.</summary>
    /// <response code="204">Desconectados.</response>
    [HttpDelete("connections")]
    public Task<IActionResult> DisconnectAll() =>
        Execute(async () =>
        {
            await _connectionService.DisconnectAllAsync(CurrentUserId);
            return NoContent();
        });

    /// <summary>Endereço do servidor MCP, para copiar e colar no assistente.</summary>
    /// <response code="200"><c>{ "mcpUrl": "https://…/mcp" }</c>.</response>
    [HttpGet("mcp-info")]
    public Task<IActionResult> McpInfo() =>
        Execute(() => Task.FromResult<IActionResult>(Ok(_connectionService.GetMcpInfo())));
}
