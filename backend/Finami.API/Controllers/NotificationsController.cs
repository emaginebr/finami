using Finami.Domain.Interfaces;
using Finami.DTO.Notifications;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace Finami.API.Controllers;

/// <summary>Notificações do usuário autenticado (feature 003); ninguém vê as de outra pessoa.</summary>
[Route("api/notifications")]
[Authorize]
public class NotificationsController : FinamiControllerBase
{
    private readonly INotificationService _notificationService;

    public NotificationsController(INotificationService notificationService)
    {
        _notificationService = notificationService;
    }

    /// <summary>
    /// Suas notificações, da mais recente para a mais antiga, paginadas por cursor. Notificações de
    /// convite trazem o estado <b>atual</b> do convite.
    /// </summary>
    /// <param name="beforeId">Cursor: devolve só notificações com id menor (use o nextBeforeId da página anterior).</param>
    /// <param name="limit">Tamanho da página, de 1 a 50 (padrão 20).</param>
    /// <response code="200">Página de notificações; nextBeforeId é null na última.</response>
    /// <response code="400">limit fora de 1–50.</response>
    [HttpGet]
    public Task<IActionResult> List([FromQuery] long? beforeId = null, [FromQuery] int? limit = null) =>
        Execute(async () => Ok(await _notificationService.ListAsync(CurrentUserId, beforeId, limit)));

    /// <summary>Quantidade de notificações não lidas (contador do sino).</summary>
    /// <response code="200"><c>{ "unread": n }</c>.</response>
    [HttpGet("unread-count")]
    public Task<IActionResult> UnreadCount() =>
        Execute(async () => Ok(await _notificationService.CountUnreadAsync(CurrentUserId)));

    /// <summary>Marca notificações como lidas; ids de outras pessoas são ignorados.</summary>
    /// <param name="info">De 1 a 100 ids.</param>
    /// <response code="204">Marcadas.</response>
    /// <response code="400">Lista vazia ou com mais de 100 ids.</response>
    [HttpPost("read")]
    public Task<IActionResult> MarkRead([FromBody] MarkReadInfo info) =>
        Execute(async () =>
        {
            await _notificationService.MarkReadAsync(CurrentUserId, info);
            return NoContent();
        });
}
