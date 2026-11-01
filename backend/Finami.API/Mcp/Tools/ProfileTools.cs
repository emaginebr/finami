using System.ComponentModel;
using System.Security.Claims;
using Finami.Domain.Interfaces;
using Finami.DTO.Users;
using ModelContextProtocol.Protocol;
using ModelContextProtocol.Server;

namespace Finami.API.Mcp.Tools;

/// <summary>Perfil da pessoa conectada (contracts/mcp-tools.md).</summary>
[McpServerToolType]
public class ProfileTools : McpToolBase
{
    private readonly IAuthService _authService;
    private readonly IUserService _userService;

    public ProfileTools(IAuthService authService, IUserService userService, IMcpIdempotencyService idempotency,
        IMcpAuditService audit, ILogger<ProfileTools> logger) : base(logger, idempotency, audit)
    {
        _authService = authService;
        _userService = userService;
    }

    [McpServerTool(Name = "obter_perfil", Title = "Obter perfil", ReadOnly = true, Destructive = false,
        Idempotent = true, OpenWorld = false)]
    [Description("Mostra os dados da pessoa conectada no Finami: id, nome, sobrenome e email. " +
                 "Use para saber em nome de quem o assistente está agindo.")]
    public Task<CallToolResult> ObterPerfil(ClaimsPrincipal user) =>
        ExecuteReadAsync(user, "obter_perfil",
            userId => _authService.GetMeAsync(userId),
            me => string.IsNullOrEmpty(me.Email)
                ? $"Você está conectado como {me.FirstName} {me.LastName}."
                : $"Você está conectado como {me.FirstName} {me.LastName} ({me.Email}).");

    [McpServerTool(Name = "atualizar_perfil", Title = "Atualizar perfil", ReadOnly = false, Destructive = false,
        Idempotent = true, OpenWorld = false)]
    [Description("Altera o nome e o sobrenome da própria pessoa conectada (ex.: nome \"Ana\", sobrenome " +
                 "\"Silva Souza\"). O email, a senha e os dados de outras pessoas não mudam por aqui. Confirme " +
                 "com a pessoa antes.")]
    public Task<CallToolResult> AtualizarPerfil(ClaimsPrincipal user,
        [Description("Novo nome (ex.: \"Ana\").")] string nome,
        [Description("Novo sobrenome (ex.: \"Silva Souza\").")] string sobrenome) =>
        ExecuteWriteAsync(user, "atualizar_perfil", null,
            async userId =>
            {
                // Sempre o próprio userId do token; o email atual é mantido.
                var me = await _authService.GetMeAsync(userId);
                return await _userService.UpdateAsync(userId, userId,
                    new UserUpdateInfo { FirstName = nome, LastName = sobrenome, Email = me.Email });
            },
            me => $"Perfil atualizado: {me.FirstName} {me.LastName}.",
            me => me.UserId);
}
