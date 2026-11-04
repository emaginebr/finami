using System.ComponentModel;
using System.Security.Claims;
using Finami.Domain.Interfaces;
using Finami.DTO.Groups;
using Finami.DTO.Invitations;
using ModelContextProtocol.Protocol;
using ModelContextProtocol.Server;

namespace Finami.API.Mcp.Tools;

/// <summary>Famílias e membros (US5, contracts/mcp-tools.md), com as regras do <c>GroupsController</c>.</summary>
[McpServerToolType]
public class GroupWriteTools : McpToolBase
{
    private readonly IGroupService _groupService;

    public GroupWriteTools(IGroupService groupService, IMcpIdempotencyService idempotency, IMcpAuditService audit,
        ILogger<GroupWriteTools> logger) : base(logger, idempotency, audit)
    {
        _groupService = groupService;
    }

    [McpServerTool(Name = "criar_familia", Title = "Criar família", ReadOnly = false, Destructive = false,
        Idempotent = false, OpenWorld = false)]
    [Description("Cria uma família; a pessoa conectada vira a responsável e primeiro membro. Ex.: nome " +
                 "\"Família Silva\". Opcional: chave_repeticao (até 64 caracteres) para repetir a chamada sem " +
                 "criar duas famílias.")]
    public Task<CallToolResult> CriarFamilia(ClaimsPrincipal user,
        [Description("Nome da família (ex.: \"Família Silva\").")] string nome,
        [Description("Opcional: chave de repetição segura (até 64 caracteres).")] string? chave_repeticao = null) =>
        ExecuteWriteAsync(user, "criar_familia", chave_repeticao,
            userId => _groupService.CreateAsync(userId, new GroupInsertInfo { Name = nome }),
            g => $"Família {g.Name} (id {g.GroupId}) criada; você é o responsável.",
            g => g.GroupId);

    [McpServerTool(Name = "renomear_familia", Title = "Renomear família", ReadOnly = false, Destructive = false,
        Idempotent = true, OpenWorld = false)]
    [Description("Muda o nome de uma família (apenas o responsável).")]
    public Task<CallToolResult> RenomearFamilia(ClaimsPrincipal user,
        [Description("Id da família (ex.: 3).")] long familia_id,
        [Description("Novo nome (ex.: \"Família Silva Souza\").")] string nome) =>
        ExecuteWriteAsync(user, "renomear_familia", null,
            userId => _groupService.UpdateAsync(userId, familia_id, new GroupUpdateInfo { Name = nome }),
            g => $"Família renomeada para {g.Name}.",
            g => g.GroupId);

    [McpServerTool(Name = "criar_pessoa_na_familia", Title = "Cadastrar pessoa na família", ReadOnly = false,
        Destructive = false, Idempotent = false, OpenWorld = false)]
    [Description("Cadastra uma pessoa nova (ex.: um filho, com ou sem email) e a inclui na família (apenas o " +
                 "responsável). Se o email já for de alguém cadastrado, use convidar_para_familia. Verifique antes " +
                 "com verificar_email_para_familia. Opcional: chave_repeticao (até 64 caracteres).")]
    public Task<CallToolResult> CriarPessoaNaFamilia(ClaimsPrincipal user,
        [Description("Id da família (ex.: 3).")] long familia_id,
        [Description("Nome (ex.: \"Pedro\").")] string nome,
        [Description("Sobrenome (ex.: \"Silva\").")] string sobrenome,
        [Description("Opcional: email da pessoa (ex.: \"pedro@exemplo.com\"); sem email ela não entra no app.")] string? email = null,
        [Description("Opcional: chave de repetição segura (até 64 caracteres).")] string? chave_repeticao = null) =>
        ExecuteWriteAsync(user, "criar_pessoa_na_familia", chave_repeticao,
            userId => _groupService.CreateMemberAsync(userId, familia_id,
                new NewMemberInfo { FirstName = nome, LastName = sobrenome, Email = email }),
            g => $"{nome} {sobrenome} cadastrado(a) e incluído(a) na família {g.Name}.",
            g => g.GroupId);

    [McpServerTool(Name = "retirar_membro", Title = "Retirar membro da família", ReadOnly = false,
        Destructive = true, Idempotent = true, OpenWorld = false)]
    [Description("Retira um membro da família (apenas o responsável); as carteiras dele deixam de ficar " +
                 "vinculadas à família. Confirme com a pessoa antes.")]
    public Task<CallToolResult> RetirarMembro(ClaimsPrincipal user,
        [Description("Id da família (ex.: 3).")] long familia_id,
        [Description("Id da pessoa a retirar (ex.: 12). Use obter_familia.")] long pessoa_id) =>
        ExecuteWriteAsync(user, "retirar_membro", null,
            userId => _groupService.RemoveMemberAsync(userId, familia_id, pessoa_id),
            g => $"Membro {pessoa_id} retirado da família {g.Name}.",
            _ => pessoa_id);

    [McpServerTool(Name = "alterar_permissoes_membro", Title = "Alterar permissões de um membro", ReadOnly = false,
        Destructive = false, Idempotent = true, OpenWorld = false)]
    [Description("Liga ou desliga as permissões de um membro da família: lançar (receitas, despesas e " +
                 "transferências nas carteiras da família) e estornar (qualquer lançamento das carteiras da " +
                 "família). Só o responsável pela família pode usar. Sem 'lançar', o membro fica só consultando " +
                 "aquela família. Confirme com a pessoa antes de mudar.")]
    public Task<CallToolResult> AlterarPermissoesMembro(ClaimsPrincipal user,
        [Description("Id da família (ex.: 3). Use listar_familias.")] long familia_id,
        [Description("Id do membro (ex.: 12). Use obter_familia.")] long pessoa_id,
        [Description("Pode criar lançamentos (receitas, despesas e transferências) na família.")] bool pode_lancar,
        [Description("Pode estornar lançamentos das carteiras da família.")] bool pode_estornar) =>
        ExecuteWriteAsync(user, "alterar_permissoes_membro", null,
            async userId => McpGroupResult.From(await _groupService.SetMemberPermissionsAsync(userId, familia_id,
                pessoa_id, new MemberPermissionsInfo { CanCreateTransactions = pode_lancar, CanReverse = pode_estornar })),
            g =>
            {
                var member = g.Members.FirstOrDefault(m => m.UserId == pessoa_id);
                var name = member == null ? $"Membro {pessoa_id}" : member.FirstName;
                var state = member == null
                    ? GroupReadTools.PermissionsText(pode_lancar, pode_estornar)
                    : GroupReadTools.PermissionsText(member.CanCreateTransactions, member.CanReverse);
                return $"{name} agora: {state}. Família {g.Name}.";
            },
            _ => pessoa_id);

    [McpServerTool(Name = "verificar_email_para_familia", Title = "Verificar email para a família", ReadOnly = true,
        Destructive = false, Idempotent = true, OpenWorld = false)]
    [Description("Verifica um email antes de incluir alguém na família (apenas o responsável). status: " +
                 "Available (ninguém com esse email: use criar_pessoa_na_familia), Registered (pessoa já " +
                 "cadastrada: use convidar_para_familia), AlreadyMember ou PendingInvite (já há convite pendente).")]
    public Task<CallToolResult> VerificarEmailParaFamilia(ClaimsPrincipal user,
        [Description("Id da família (ex.: 3).")] long familia_id,
        [Description("Email a verificar (ex.: \"bruno@exemplo.com\").")] string email) =>
        ExecuteReadAsync(user, "verificar_email_para_familia",
            userId => _groupService.LookupMemberAsync(userId, familia_id, new MemberLookupInfo { Email = email }),
            r => r.Status switch
            {
                "Available" => $"Nenhuma pessoa com o email {r.Email}: dá para cadastrá-la com criar_pessoa_na_familia.",
                "Registered" => $"{r.User?.FirstName} {r.User?.LastName} já tem cadastro: envie um convite com convidar_para_familia.",
                "AlreadyMember" => $"{r.User?.FirstName} {r.User?.LastName} já é membro desta família.",
                "PendingInvite" => $"Já existe um convite pendente para {r.Email} (convite {r.InvitationId}).",
                _ => $"Status: {r.Status}."
            });
}
