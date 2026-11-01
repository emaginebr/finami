using Finami.Domain.Interfaces;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace Finami.API.Controllers;

/// <summary>Resposta do convidado a um convite para a família (feature 003).</summary>
[Route("api/invitations")]
[Authorize]
public class InvitationsController : FinamiControllerBase
{
    private readonly IInvitationService _invitationService;

    public InvitationsController(IInvitationService invitationService)
    {
        _invitationService = invitationService;
    }

    /// <summary>
    /// Aceita o convite: você vira membro do grupo e quem convidou recebe a notificação
    /// GroupInvitationAccepted.
    /// </summary>
    /// <param name="invitationId">Identificador do convite.</param>
    /// <response code="200">Convite com status Accepted.</response>
    /// <response code="403">O convite não é seu.</response>
    /// <response code="404">Convite não encontrado.</response>
    /// <response code="409">
    /// "Este convite não está mais disponível." — já respondido/cancelado, grupo inexistente ou quem
    /// convidou não é mais o responsável (nesses dois casos o convite passa a Canceled).
    /// </response>
    [HttpPost("{invitationId:long}/accept")]
    public Task<IActionResult> Accept(long invitationId) =>
        Execute(async () => Ok(await _invitationService.AcceptAsync(CurrentUserId, invitationId)));

    /// <summary>
    /// Recusa o convite: você não entra no grupo e quem convidou recebe a notificação
    /// GroupInvitationDeclined.
    /// </summary>
    /// <param name="invitationId">Identificador do convite.</param>
    /// <response code="200">Convite com status Declined.</response>
    /// <response code="403">O convite não é seu.</response>
    /// <response code="404">Convite não encontrado.</response>
    /// <response code="409">"Este convite não está mais disponível." (mesmos casos do aceite).</response>
    [HttpPost("{invitationId:long}/decline")]
    public Task<IActionResult> Decline(long invitationId) =>
        Execute(async () => Ok(await _invitationService.DeclineAsync(CurrentUserId, invitationId)));
}
