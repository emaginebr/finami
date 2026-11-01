using System.ComponentModel;
using System.Security.Claims;
using Finami.Domain.Interfaces;
using Finami.DTO.Wallets;
using ModelContextProtocol.Protocol;
using ModelContextProtocol.Server;

namespace Finami.API.Mcp.Tools;

/// <summary>Gestão de carteiras (US6, contracts/mcp-tools.md), com as regras do <c>WalletsController</c>.</summary>
[McpServerToolType]
public class WalletWriteTools : McpToolBase
{
    private readonly IWalletService _walletService;

    public WalletWriteTools(IWalletService walletService, IMcpIdempotencyService idempotency, IMcpAuditService audit,
        ILogger<WalletWriteTools> logger) : base(logger, idempotency, audit)
    {
        _walletService = walletService;
    }

    [McpServerTool(Name = "criar_carteira", Title = "Criar carteira", ReadOnly = false, Destructive = false,
        Idempotent = false, OpenWorld = false)]
    [Description("Cria uma carteira em reais (BRL) ou bitcoin (BTC), começando com saldo zero. Pode ser pessoal " +
                 "ou vinculada a uma família; para criar a carteira de outro membro, informe a família (da qual " +
                 "você é responsável) e o dono. Ex.: nome \"Nubank\", moeda \"BRL\". Opcional: chave_repeticao " +
                 "(até 64 caracteres) para repetir a chamada sem criar duas carteiras.")]
    public Task<CallToolResult> CriarCarteira(ClaimsPrincipal user,
        [Description("Nome da carteira (ex.: \"Nubank\").")] string nome,
        [Description("Moeda: \"BRL\" (reais) ou \"BTC\" (bitcoin). Não pode ser alterada depois.")] string moeda,
        [Description("Opcional: descrição (ex.: \"Conta corrente\").")] string? descricao = null,
        [Description("Opcional: id da família à qual a carteira fica vinculada (ex.: 3).")] long? familia_id = null,
        [Description("Opcional: id do titular, quando for de outro membro da família (ex.: 12).")] long? dono_id = null,
        [Description("Opcional: true para carteira virtual (separação de dinheiro, ex.: \"Reserva\"); padrão false.")] bool? @virtual = null,
        [Description("Opcional: chave de repetição segura (até 64 caracteres).")] string? chave_repeticao = null) =>
        ExecuteWriteAsync(user, "criar_carteira", chave_repeticao,
            userId => _walletService.CreateAsync(userId, new WalletInsertInfo
            {
                Name = nome,
                Currency = moeda?.Trim().ToUpperInvariant() ?? string.Empty,
                Description = descricao,
                GroupId = familia_id,
                OwnerUserId = dono_id,
                IsVirtual = @virtual ?? false
            }),
            w => $"Carteira {w.Name} ({w.Currency}, id {w.WalletId}) criada para {w.OwnerName}.",
            w => w.WalletId);

    [McpServerTool(Name = "atualizar_carteira", Title = "Atualizar carteira", ReadOnly = false, Destructive = false,
        Idempotent = true, OpenWorld = false)]
    [Description("Altera nome, descrição e/ou a indicação de carteira virtual. Campos não informados ficam como " +
                 "estão; a moeda não pode ser alterada.")]
    public Task<CallToolResult> AtualizarCarteira(ClaimsPrincipal user,
        [Description("Id da carteira (ex.: 5).")] long carteira_id,
        [Description("Opcional: novo nome (ex.: \"Nubank PJ\").")] string? nome = null,
        [Description("Opcional: nova descrição; texto vazio apaga a descrição.")] string? descricao = null,
        [Description("Opcional: true para virtual, false para real.")] bool? @virtual = null) =>
        ExecuteWriteAsync(user, "atualizar_carteira", null,
            async userId =>
            {
                var current = await _walletService.GetAsync(userId, carteira_id);
                return await _walletService.UpdateAsync(userId, carteira_id, new WalletUpdateInfo
                {
                    Name = nome ?? current.Name,
                    Description = descricao == null ? current.Description : descricao.Length == 0 ? null : descricao,
                    IsVirtual = @virtual ?? current.IsVirtual
                });
            },
            w => $"Carteira {w.Name} (id {w.WalletId}) atualizada.",
            w => w.WalletId);

    [McpServerTool(Name = "mover_carteira_de_familia", Title = "Mover carteira de família", ReadOnly = false,
        Destructive = false, Idempotent = true, OpenWorld = false)]
    [Description("Vincula a carteira a uma família (apenas o titular, que precisa ser membro) ou, sem familia_id, " +
                 "a torna pessoal (apenas o responsável pela família atual). Para trocar de família, desvincule " +
                 "antes.")]
    public Task<CallToolResult> MoverCarteiraDeFamilia(ClaimsPrincipal user,
        [Description("Id da carteira (ex.: 5).")] long carteira_id,
        [Description("Opcional: id da família de destino (ex.: 3); omita para tornar a carteira pessoal.")] long? familia_id = null) =>
        ExecuteWriteAsync(user, "mover_carteira_de_familia", null,
            userId => _walletService.SetGroupAsync(userId, carteira_id, new WalletGroupInfo { GroupId = familia_id }),
            w => w.GroupId.HasValue
                ? $"Carteira {w.Name} vinculada à família {w.GroupId}."
                : $"Carteira {w.Name} agora é pessoal.",
            w => w.WalletId);

    [McpServerTool(Name = "desativar_carteira", Title = "Desativar carteira", ReadOnly = false, Destructive = true,
        Idempotent = true, OpenWorld = false)]
    [Description("Desativa a carteira: ela some das listas e não aceita novos lançamentos, mas o histórico é " +
                 "mantido. Confirme com a pessoa antes.")]
    public Task<CallToolResult> DesativarCarteira(ClaimsPrincipal user,
        [Description("Id da carteira (ex.: 5).")] long carteira_id) =>
        ExecuteWriteAsync(user, "desativar_carteira", null,
            userId => _walletService.DeactivateAsync(userId, carteira_id),
            w => $"Carteira {w.Name} desativada.",
            w => w.WalletId);

    [McpServerTool(Name = "excluir_carteira", Title = "Excluir carteira", ReadOnly = false, Destructive = true,
        Idempotent = false, OpenWorld = false)]
    [Description("Exclui a carteira de vez, somente se ela nunca teve lançamentos; com lançamentos, use " +
                 "desativar_carteira. Confirme com a pessoa antes.")]
    public Task<CallToolResult> ExcluirCarteira(ClaimsPrincipal user,
        [Description("Id da carteira (ex.: 5).")] long carteira_id) =>
        ExecuteWriteAsync(user, "excluir_carteira", null,
            async userId =>
            {
                // Mesma regra do DELETE /api/wallets/{id}: só quem controla e só sem lançamentos.
                var wallet = await _walletService.GetAsync(userId, carteira_id);
                await _walletService.DeleteAsync(userId, carteira_id);
                return new McpWalletDeletedResult { WalletId = wallet.WalletId, Name = wallet.Name, Deleted = true };
            },
            r => $"Carteira {r.Name} excluída.",
            r => r.WalletId);
}
