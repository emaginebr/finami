using Finami.Domain.Interfaces;
using Finami.DTO.Groups;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace Finami.API.Controllers;

/// <summary>Grupos familiares: responsável, membros e visibilidade do extrato.</summary>
[Route("api/groups")]
[Authorize]
public class GroupsController : FinamiControllerBase
{
    private readonly IGroupService _groupService;
    private readonly IBalanceService _balanceService;

    public GroupsController(IGroupService groupService, IBalanceService balanceService)
    {
        _groupService = groupService;
        _balanceService = balanceService;
    }

    /// <summary>Cria um grupo; você vira o responsável e membro.</summary>
    [HttpPost]
    public Task<IActionResult> Create([FromBody] GroupInsertInfo info) =>
        Execute(async () => StatusCode(StatusCodes.Status201Created, await _groupService.CreateAsync(CurrentUserId, info)));

    /// <summary>Grupos dos quais você é membro ou responsável.</summary>
    [HttpGet]
    public Task<IActionResult> List() =>
        Execute(async () => Ok(await _groupService.ListMineAsync(CurrentUserId)));

    /// <summary>Detalhes e membros do grupo.</summary>
    [HttpGet("{id:long}")]
    public Task<IActionResult> Get(long id) =>
        Execute(async () => Ok(await _groupService.GetAsync(CurrentUserId, id)));

    /// <summary>Renomeia e/ou altera a visibilidade do extrato (apenas o responsável).</summary>
    [HttpPut("{id:long}")]
    public Task<IActionResult> Update(long id, [FromBody] GroupUpdateInfo info) =>
        Execute(async () => Ok(await _groupService.UpdateAsync(CurrentUserId, id, info)));

    /// <summary>Inclui um membro (apenas o responsável).</summary>
    [HttpPost("{id:long}/members")]
    public Task<IActionResult> AddMember(long id, [FromBody] AddMemberInfo info) =>
        Execute(async () => StatusCode(StatusCodes.Status201Created, await _groupService.AddMemberAsync(CurrentUserId, id, info)));

    /// <summary>Retira um membro e desvincula as carteiras dele do grupo (apenas o responsável).</summary>
    [HttpDelete("{id:long}/members/{userId:long}")]
    public Task<IActionResult> RemoveMember(long id, long userId) =>
        Execute(async () => Ok(await _groupService.RemoveMemberAsync(CurrentUserId, id, userId)));

    /// <summary>
    /// Saldo por membro do grupo (FR-029). O nível de detalhe (Full, Summary ou Hidden) depende de quem
    /// pergunta e da visibilidade do extrato; não membro recebe 404. Detalhes em
    /// specs/002-finami-frontend-mobile/contracts/api-additions.md §2.
    /// </summary>
    /// <param name="groupId">Identificador do grupo.</param>
    [HttpGet("{groupId:long}/balances")]
    public Task<IActionResult> Balances(long groupId) =>
        Execute(async () => Ok(await _balanceService.GetGroupBalancesAsync(CurrentUserId, groupId)));
}
