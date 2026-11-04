using System.ComponentModel;
using System.Security.Claims;
using Finami.Domain.Interfaces;
using Finami.DTO.Groups;
using ModelContextProtocol.Protocol;
using ModelContextProtocol.Server;

namespace Finami.API.Mcp.Tools;

/// <summary>Consulta de famílias e das pessoas cadastradas pela pessoa conectada (contracts/mcp-tools.md).</summary>
[McpServerToolType]
public class GroupReadTools : McpToolBase
{
    private readonly IGroupService _groupService;
    private readonly IUserService _userService;

    public GroupReadTools(IGroupService groupService, IUserService userService, ILogger<GroupReadTools> logger)
        : base(logger)
    {
        _groupService = groupService;
        _userService = userService;
    }

    [McpServerTool(Name = "listar_familias", Title = "Listar famílias", ReadOnly = true, Destructive = false,
        Idempotent = true, OpenWorld = false)]
    [Description("Lista as famílias de que a pessoa é membro ou responsável, com id, nome, responsável, " +
                 "visibilidade do extrato e membros. Use para descobrir o familia_id.")]
    public Task<CallToolResult> ListarFamilias(ClaimsPrincipal user) =>
        ExecuteReadAsync(user, "listar_familias",
            userId => _groupService.ListMineAsync(userId),
            groups => groups.Count == 0
                ? "Você não participa de nenhuma família."
                : $"{McpFormat.Count(groups.Count, "família", "famílias")}: " +
                  string.Join("; ", groups.Select(Describe)) + ".");

    [McpServerTool(Name = "obter_familia", Title = "Obter família", ReadOnly = true, Destructive = false,
        Idempotent = true, OpenWorld = false)]
    [Description("Detalhes de uma família: nome, responsável, visibilidade do extrato e membros (id, nome e se " +
                 "podem entrar no app), com as permissões de cada membro (pode_lancar: criar receitas, despesas e " +
                 "transferências nas carteiras da família; pode_estornar: estornar lançamentos delas) e as suas " +
                 "(minhas_permissoes). O responsável tem sempre as duas; só ele muda as dos outros, com " +
                 "alterar_permissoes_membro.")]
    public Task<CallToolResult> ObterFamilia(ClaimsPrincipal user,
        [Description("Id da família (ex.: 3).")] long familia_id) =>
        ExecuteReadAsync(user, "obter_familia",
            async userId => McpGroupResult.From(await _groupService.GetAsync(userId, familia_id)),
            group => $"Família {Describe(group)}. Membros: " +
                     string.Join(", ", group.Members.Select(m =>
                         $"{m.FirstName} {m.LastName} (id {m.UserId}, {PermissionsText(m, group)})")) +
                     $". Suas permissões: {PermissionsText(group.MyPermissions.CanCreateTransactions, group.MyPermissions.CanReverse)}.");

    [McpServerTool(Name = "listar_pessoas_criadas_por_mim", Title = "Listar pessoas cadastradas por mim",
        ReadOnly = true, Destructive = false, Idempotent = true, OpenWorld = false)]
    [Description("Lista as pessoas que a pessoa conectada cadastrou no app (ex.: filhos sem login), com id, nome " +
                 "e email (quando houver).")]
    public Task<CallToolResult> ListarPessoasCriadasPorMim(ClaimsPrincipal user) =>
        ExecuteReadAsync(user, "listar_pessoas_criadas_por_mim",
            userId => _userService.ListCreatedByMeAsync(userId),
            people => people.Count == 0
                ? "Você não cadastrou nenhuma pessoa."
                : $"{McpFormat.Count(people.Count, "pessoa cadastrada", "pessoas cadastradas")}: " +
                  string.Join(", ", people.Select(p => $"{p.FirstName} {p.LastName} (id {p.UserId})")) + ".");

    /// <summary>Feature 008: "pode lançar · não pode estornar", "só consulta · pode estornar" etc.</summary>
    internal static string PermissionsText(bool canCreateTransactions, bool canReverse) =>
        (canCreateTransactions ? "pode lançar" : "só consulta") + " · " +
        (canReverse ? "pode estornar" : "não pode estornar");

    private static string PermissionsText(GroupMemberInfo member, GroupInfo group) =>
        member.UserId == group.ResponsibleUserId
            ? "responsável, todas as permissões"
            : PermissionsText(member.CanCreateTransactions, member.CanReverse);

    internal static string Describe(GroupInfo group) =>
        $"{group.Name} (id {group.GroupId}, {McpFormat.Count(group.Members.Count, "membro", "membros")}" +
        (group.IsResponsible ? ", você é o responsável" : string.Empty) + ")";
}
