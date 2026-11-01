using System.ComponentModel;
using System.Globalization;
using System.Security.Claims;
using Finami.Domain.Exceptions;
using Finami.Domain.Interfaces;
using Finami.DTO.Notifications;
using ModelContextProtocol.Protocol;
using ModelContextProtocol.Server;

namespace Finami.API.Mcp.Tools;

/// <summary>Notificações da própria pessoa (US5, contracts/mcp-tools.md).</summary>
[McpServerToolType]
public class NotificationTools : McpToolBase
{
    public const int MAX_MARK_READ = 100;
    public const string MARK_READ_COUNT_MESSAGE = "Informe de 1 a 100 ids de notificação.";

    private readonly INotificationService _notificationService;

    public NotificationTools(INotificationService notificationService, IMcpIdempotencyService idempotency,
        IMcpAuditService audit, ILogger<NotificationTools> logger) : base(logger, idempotency, audit)
    {
        _notificationService = notificationService;
    }

    [McpServerTool(Name = "listar_notificacoes", Title = "Listar notificações", ReadOnly = true, Destructive = false,
        Idempotent = true, OpenWorld = false)]
    [Description("Notificações da pessoa conectada, da mais recente para a mais antiga (convites recebidos, " +
                 "aceitos e recusados, com o estado atual do convite e o invitationId). Paginado: limite de 1 a " +
                 "50 (padrão 20); para a próxima página, passe cursor = proximoCursor (null na última).")]
    public Task<CallToolResult> ListarNotificacoes(ClaimsPrincipal user,
        [Description("Opcional: notificações por página, de 1 a 50 (padrão 20).")] int? limite = null,
        [Description("Opcional: proximoCursor devolvido pela página anterior.")] string? cursor = null) =>
        ExecuteReadAsync(user, "listar_notificacoes",
            async userId =>
            {
                var limit = McpPaging.NormalizeLimit(limite);
                long? beforeId = null;
                if (!string.IsNullOrWhiteSpace(cursor))
                {
                    if (!long.TryParse(cursor.Trim(), NumberStyles.None, CultureInfo.InvariantCulture, out var id))
                        throw new ValidationException(McpPaging.INVALID_CURSOR_MESSAGE);
                    beforeId = id;
                }
                var page = await _notificationService.ListAsync(userId, beforeId, limit);
                return new McpNotificationPage
                {
                    Items = page.Items,
                    NextBeforeId = page.NextBeforeId,
                    ProximoCursor = page.NextBeforeId?.ToString(CultureInfo.InvariantCulture)
                };
            },
            page => page.Items.Count == 0
                ? "Nenhuma notificação."
                : $"{McpFormat.Count(page.Items.Count, "notificação", "notificações")} " +
                  $"({page.Items.Count(n => !n.IsRead)} não lidas nesta página): " +
                  string.Join("; ", page.Items.Select(Describe)) + "." +
                  (page.ProximoCursor != null ? " Há mais: chame de novo com cursor = proximoCursor." : string.Empty));

    [McpServerTool(Name = "contar_notificacoes_nao_lidas", Title = "Contar notificações não lidas", ReadOnly = true,
        Destructive = false, Idempotent = true, OpenWorld = false)]
    [Description("Quantidade de notificações ainda não lidas da pessoa conectada (o número do sino no app).")]
    public Task<CallToolResult> ContarNotificacoesNaoLidas(ClaimsPrincipal user) =>
        ExecuteReadAsync(user, "contar_notificacoes_nao_lidas",
            userId => _notificationService.CountUnreadAsync(userId),
            r => r.Unread == 0 ? "Nenhuma notificação não lida." : $"{McpFormat.Count(r.Unread, "notificação não lida", "notificações não lidas")}.");

    [McpServerTool(Name = "marcar_notificacoes_como_lidas", Title = "Marcar notificações como lidas",
        ReadOnly = false, Destructive = false, Idempotent = true, OpenWorld = false)]
    [Description("Marca notificações como lidas (de 1 a 100 ids, ex.: [41, 42]); ids de outras pessoas são " +
                 "ignorados. Devolve quantas continuam não lidas.")]
    public Task<CallToolResult> MarcarNotificacoesComoLidas(ClaimsPrincipal user,
        [Description("Ids das notificações (notificationId de listar_notificacoes), de 1 a 100.")] long[] notificacao_ids) =>
        ExecuteWriteAsync(user, "marcar_notificacoes_como_lidas", null,
            async userId =>
            {
                if (notificacao_ids == null || notificacao_ids.Length == 0 || notificacao_ids.Length > MAX_MARK_READ)
                    throw new ValidationException(MARK_READ_COUNT_MESSAGE);
                await _notificationService.MarkReadAsync(userId, new MarkReadInfo { NotificationIds = notificacao_ids.ToList() });
                return await _notificationService.CountUnreadAsync(userId);
            },
            r => $"Notificações marcadas como lidas. Não lidas agora: {r.Unread}.");

    internal static string Describe(NotificationInfo n)
    {
        var actor = n.Actor == null ? "alguém" : $"{n.Actor.FirstName} {n.Actor.LastName}";
        var group = n.Group?.Name ?? "uma família";
        var text = n.Type switch
        {
            "GroupInvitationReceived" => $"{actor} convidou você para a família {group}",
            "GroupInvitationAccepted" => $"{actor} aceitou o convite para a família {group}",
            "GroupInvitationDeclined" => $"{actor} recusou o convite para a família {group}",
            _ => n.Type
        };
        if (n.Invitation != null)
            text += $" (convite {n.Invitation.InvitationId}, {n.Invitation.Status})";
        return n.IsRead ? text : text + " [não lida]";
    }
}
