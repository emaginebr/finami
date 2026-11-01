using System.ComponentModel;
using System.Security.Claims;
using Finami.Domain.Interfaces;
using Finami.DTO.Invitations;
using ModelContextProtocol.Protocol;
using ModelContextProtocol.Server;

namespace Finami.API.Mcp.Tools;

/// <summary>Convites para a família (US5, regras da feature 003).</summary>
[McpServerToolType]
public class InvitationTools : McpToolBase
{
    private readonly IInvitationService _invitationService;

    public InvitationTools(IInvitationService invitationService, IMcpIdempotencyService idempotency,
        IMcpAuditService audit, ILogger<InvitationTools> logger) : base(logger, idempotency, audit)
    {
        _invitationService = invitationService;
    }

    [McpServerTool(Name = "listar_convites_da_familia", Title = "Listar convites da família", ReadOnly = true,
        Destructive = false, Idempotent = true, OpenWorld = false)]
    [Description("Convites de uma família, mais recentes primeiro (apenas o responsável). status: Pending " +
                 "(padrão), Accepted, Declined ou Canceled.")]
    public Task<CallToolResult> ListarConvitesDaFamilia(ClaimsPrincipal user,
        [Description("Id da família (ex.: 3).")] long familia_id,
        [Description("Opcional: Pending (padrão), Accepted, Declined ou Canceled.")] string? status = null) =>
        ExecuteReadAsync(user, "listar_convites_da_familia",
            userId => _invitationService.ListByGroupAsync(userId, familia_id, status),
            list => list.Count == 0
                ? "Nenhum convite encontrado."
                : $"{McpFormat.Count(list.Count, "convite", "convites")}: " +
                  string.Join("; ", list.Select(i =>
                      $"{i.InvitedUser.FirstName} {i.InvitedUser.LastName} (convite {i.InvitationId}, {i.Status})")) + ".");

    [McpServerTool(Name = "convidar_para_familia", Title = "Convidar para a família", ReadOnly = false,
        Destructive = false, Idempotent = false, OpenWorld = false)]
    [Description("Convida uma pessoa já cadastrada, pelo email, para a família (apenas o responsável). Ela recebe " +
                 "uma notificação e só vira membro ao aceitar. Opcional: chave_repeticao (até 64 caracteres).")]
    public Task<CallToolResult> ConvidarParaFamilia(ClaimsPrincipal user,
        [Description("Id da família (ex.: 3).")] long familia_id,
        [Description("Email da pessoa convidada (ex.: \"bruno@exemplo.com\").")] string email,
        [Description("Opcional: chave de repetição segura (até 64 caracteres).")] string? chave_repeticao = null) =>
        ExecuteWriteAsync(user, "convidar_para_familia", chave_repeticao,
            userId => _invitationService.InviteAsync(userId, familia_id, new GroupInvitationInsertInfo { Email = email }),
            i => $"Convite enviado para {i.InvitedUser.FirstName} {i.InvitedUser.LastName} entrar na família {i.GroupName}.",
            i => i.InvitationId);

    [McpServerTool(Name = "cancelar_convite", Title = "Cancelar convite", ReadOnly = false, Destructive = true,
        Idempotent = true, OpenWorld = false)]
    [Description("Cancela um convite pendente da família (apenas o responsável).")]
    public Task<CallToolResult> CancelarConvite(ClaimsPrincipal user,
        [Description("Id da família (ex.: 3).")] long familia_id,
        [Description("Id do convite (ex.: 9). Use listar_convites_da_familia.")] long convite_id) =>
        ExecuteWriteAsync(user, "cancelar_convite", null,
            userId => _invitationService.CancelAsync(userId, familia_id, convite_id),
            i => $"Convite de {i.InvitedUser.FirstName} {i.InvitedUser.LastName} para a família {i.GroupName} cancelado.",
            i => i.InvitationId);

    [McpServerTool(Name = "aceitar_convite", Title = "Aceitar convite", ReadOnly = false, Destructive = false,
        Idempotent = true, OpenWorld = false)]
    [Description("Aceita um convite recebido: a pessoa conectada vira membro da família e quem convidou é " +
                 "avisado. O id do convite vem de listar_notificacoes (invitation.invitationId). Confirme antes.")]
    public Task<CallToolResult> AceitarConvite(ClaimsPrincipal user,
        [Description("Id do convite (ex.: 9).")] long convite_id) =>
        ExecuteWriteAsync(user, "aceitar_convite", null,
            userId => _invitationService.AcceptAsync(userId, convite_id),
            i => $"Convite aceito: agora você faz parte da família {i.GroupName}.",
            i => i.InvitationId);

    [McpServerTool(Name = "recusar_convite", Title = "Recusar convite", ReadOnly = false, Destructive = true,
        Idempotent = true, OpenWorld = false)]
    [Description("Recusa um convite recebido: a pessoa não entra na família e quem convidou é avisado. O id do " +
                 "convite vem de listar_notificacoes. Confirme antes.")]
    public Task<CallToolResult> RecusarConvite(ClaimsPrincipal user,
        [Description("Id do convite (ex.: 9).")] long convite_id) =>
        ExecuteWriteAsync(user, "recusar_convite", null,
            userId => _invitationService.DeclineAsync(userId, convite_id),
            i => $"Convite para a família {i.GroupName} recusado.",
            i => i.InvitationId);
}
