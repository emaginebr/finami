using Finami.Domain.Interfaces;
using Finami.DTO.Wallets;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace Finami.API.Controllers;

/// <summary>Carteiras (contas do plano de contas).</summary>
[Route("api/wallets")]
[Authorize]
public class WalletsController : FinamiControllerBase
{
    private readonly IWalletService _walletService;

    public WalletsController(IWalletService walletService)
    {
        _walletService = walletService;
    }

    /// <summary>Cria uma carteira (própria, ou para um membro de grupo do qual você é responsável).</summary>
    [HttpPost]
    public Task<IActionResult> Create([FromBody] WalletInsertInfo info) =>
        Execute(async () => StatusCode(StatusCodes.Status201Created, await _walletService.CreateAsync(CurrentUserId, info)));

    /// <summary>Lista as carteiras que você controla.</summary>
    [HttpGet]
    public Task<IActionResult> List([FromQuery] long? ownerUserId, [FromQuery] long? groupId,
        [FromQuery] bool includeInactive = false) =>
        Execute(async () => Ok(await _walletService.ListAsync(CurrentUserId, ownerUserId, groupId, includeInactive)));

    /// <summary>Detalhes e saldo de uma carteira.</summary>
    [HttpGet("{id:long}")]
    public Task<IActionResult> Get(long id) =>
        Execute(async () => Ok(await _walletService.GetAsync(CurrentUserId, id)));

    /// <summary>Atualiza nome, descrição e indicação de virtual (moeda é imutável).</summary>
    [HttpPut("{id:long}")]
    public Task<IActionResult> Update(long id, [FromBody] WalletUpdateInfo info) =>
        Execute(async () => Ok(await _walletService.UpdateAsync(CurrentUserId, id, info)));

    /// <summary>Vincula a carteira a um grupo ou a desvincula (groupId null).</summary>
    [HttpPut("{id:long}/group")]
    public Task<IActionResult> SetGroup(long id, [FromBody] WalletGroupInfo info) =>
        Execute(async () => Ok(await _walletService.SetGroupAsync(CurrentUserId, id, info)));

    /// <summary>Desativa a carteira (não aceita novas transações).</summary>
    [HttpPost("{id:long}/deactivate")]
    public Task<IActionResult> Deactivate(long id) =>
        Execute(async () => Ok(await _walletService.DeactivateAsync(CurrentUserId, id)));

    /// <summary>Exclui a carteira, somente se não houver transações.</summary>
    [HttpDelete("{id:long}")]
    public Task<IActionResult> Delete(long id) =>
        Execute(async () =>
        {
            await _walletService.DeleteAsync(CurrentUserId, id);
            return NoContent();
        });

    /// <summary>Dados mínimos de qualquer carteira, para confirmar o destino de uma transferência.</summary>
    [HttpGet("{id:long}/public")]
    public Task<IActionResult> GetPublic(long id) =>
        Execute(async () => Ok(await _walletService.GetPublicAsync(id)));
}
