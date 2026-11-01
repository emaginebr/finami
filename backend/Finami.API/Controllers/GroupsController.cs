using Finami.Domain.Interfaces;
using Finami.DTO.Groups;
using Finami.DTO.Invitations;
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
    private readonly IInvitationService _invitationService;

    public GroupsController(IGroupService groupService, IBalanceService balanceService, IInvitationService invitationService)
    {
        _groupService = groupService;
        _balanceService = balanceService;
        _invitationService = invitationService;
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

    /// <summary>
    /// Inclui diretamente um membro (apenas o responsável). Desde a feature 003, só aceita pessoas
    /// cadastradas pelo próprio responsável; para outras devolve 422 ("Essa pessoa precisa ser convidada
    /// e aceitar o convite.") — use <c>POST api/groups/{groupId}/invitations</c>.
    /// </summary>
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

    /// <summary>
    /// Verifica um email no fluxo "Adicionar membro" (apenas o responsável). O email é normalizado
    /// (trim + minúsculas) e o status é Available, Registered, AlreadyMember ou PendingInvite (com
    /// invitationId). Quando o email existe, devolve só nome e sobrenome da pessoa.
    /// </summary>
    /// <param name="groupId">Identificador do grupo.</param>
    /// <param name="info">Email a verificar.</param>
    /// <response code="200">Resultado da verificação.</response>
    /// <response code="400">Email ausente ou inválido.</response>
    /// <response code="403">Você não é o responsável pelo grupo.</response>
    /// <response code="404">Grupo não encontrado.</response>
    [HttpPost("{groupId:long}/member-lookup")]
    public Task<IActionResult> LookupMember(long groupId, [FromBody] MemberLookupInfo info) =>
        Execute(async () => Ok(await _groupService.LookupMemberAsync(CurrentUserId, groupId, info)));

    /// <summary>
    /// Cadastra uma pessoa nova (com ou sem email) e a inclui no grupo na mesma transação (apenas o
    /// responsável). A pessoa fica com createdByUserId = você.
    /// </summary>
    /// <param name="groupId">Identificador do grupo.</param>
    /// <param name="info">Nome, sobrenome e email opcional.</param>
    /// <response code="201">Grupo atualizado, já com o novo membro.</response>
    /// <response code="400">Dados inválidos.</response>
    /// <response code="403">Você não é o responsável pelo grupo.</response>
    /// <response code="404">Grupo não encontrado.</response>
    /// <response code="409">Email já cadastrado (use o convite).</response>
    [HttpPost("{groupId:long}/members/new")]
    public Task<IActionResult> CreateMember(long groupId, [FromBody] NewMemberInfo info) =>
        Execute(async () => StatusCode(StatusCodes.Status201Created,
            await _groupService.CreateMemberAsync(CurrentUserId, groupId, info)));

    /// <summary>
    /// Convida uma pessoa já cadastrada, pelo email, para o grupo (apenas o responsável). Gera a
    /// notificação GroupInvitationReceived para o convidado, que só vira membro ao aceitar.
    /// </summary>
    /// <param name="groupId">Identificador do grupo.</param>
    /// <param name="info">Email da pessoa convidada.</param>
    /// <response code="201">Convite pendente criado.</response>
    /// <response code="400">Email inválido.</response>
    /// <response code="403">Você não é o responsável pelo grupo.</response>
    /// <response code="404">Grupo não encontrado ou nenhuma pessoa com esse email.</response>
    /// <response code="409">A pessoa já é membro ou já tem convite pendente neste grupo.</response>
    [HttpPost("{groupId:long}/invitations")]
    public Task<IActionResult> Invite(long groupId, [FromBody] GroupInvitationInsertInfo info) =>
        Execute(async () => StatusCode(StatusCodes.Status201Created,
            await _invitationService.InviteAsync(CurrentUserId, groupId, info)));

    /// <summary>Convites do grupo, mais recentes primeiro (apenas o responsável).</summary>
    /// <param name="groupId">Identificador do grupo.</param>
    /// <param name="status">Pending (padrão), Accepted, Declined ou Canceled.</param>
    /// <response code="200">Lista de convites.</response>
    /// <response code="400">Status inválido.</response>
    /// <response code="403">Você não é o responsável pelo grupo.</response>
    /// <response code="404">Grupo não encontrado.</response>
    [HttpGet("{groupId:long}/invitations")]
    public Task<IActionResult> ListInvitations(long groupId, [FromQuery] string? status = null) =>
        Execute(async () => Ok(await _invitationService.ListByGroupAsync(CurrentUserId, groupId, status)));

    /// <summary>Cancela um convite pendente do grupo (apenas o responsável).</summary>
    /// <param name="groupId">Identificador do grupo.</param>
    /// <param name="invitationId">Identificador do convite.</param>
    /// <response code="200">Convite com status Canceled.</response>
    /// <response code="403">Você não é o responsável pelo grupo.</response>
    /// <response code="404">Grupo ou convite não encontrado.</response>
    /// <response code="409">O convite não está mais pendente.</response>
    [HttpDelete("{groupId:long}/invitations/{invitationId:long}")]
    public Task<IActionResult> CancelInvitation(long groupId, long invitationId) =>
        Execute(async () => Ok(await _invitationService.CancelAsync(CurrentUserId, groupId, invitationId)));
}
