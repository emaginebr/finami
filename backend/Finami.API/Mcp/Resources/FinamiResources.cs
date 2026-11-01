using System.ComponentModel;
using System.Security.Claims;
using System.Text.Json;
using Finami.API.Auth;
using Finami.API.Extensions;
using Finami.Domain.Exceptions;
using Finami.Domain.Interfaces;
using ModelContextProtocol;
using ModelContextProtocol.Protocol;
using ModelContextProtocol.Server;

namespace Finami.API.Mcp.Resources;

/// <summary>
/// Recursos de leitura (contracts/mcp-tools.md §Recursos): o mesmo conteúdo das ferramentas, em JSON camelCase,
/// sempre da pessoa do token.
/// </summary>
[McpServerResourceType]
public class FinamiResources
{
    public const string MIME_TYPE = "application/json";
    public const int UNREAD_PREVIEW = 20;
    private const int MAX_NOTIFICATION_PAGES = 10;

    private readonly IAuthService _authService;
    private readonly IWalletService _walletService;
    private readonly IGroupService _groupService;
    private readonly INotificationService _notificationService;

    public FinamiResources(IAuthService authService, IWalletService walletService, IGroupService groupService,
        INotificationService notificationService)
    {
        _authService = authService;
        _walletService = walletService;
        _groupService = groupService;
        _notificationService = notificationService;
    }

    [McpServerResource(UriTemplate = "finami://perfil", Name = "perfil", Title = "Perfil", MimeType = MIME_TYPE)]
    [Description("Dados da pessoa conectada (id, nome, sobrenome, email) — o mesmo de obter_perfil.")]
    public Task<TextResourceContents> Perfil(ClaimsPrincipal user) =>
        Read(user, "finami://perfil", userId => _authService.GetMeAsync(userId));

    [McpServerResource(UriTemplate = "finami://carteiras", Name = "carteiras", Title = "Carteiras",
        MimeType = MIME_TYPE)]
    [Description("Carteiras ativas que a pessoa controla, com saldo (BRL ou BTC) e valor estimado em reais.")]
    public Task<TextResourceContents> Carteiras(ClaimsPrincipal user) =>
        Read(user, "finami://carteiras", userId => _walletService.ListAsync(userId, null, null, false));

    [McpServerResource(UriTemplate = "finami://familias", Name = "familias", Title = "Famílias", MimeType = MIME_TYPE)]
    [Description("Famílias de que a pessoa participa, com os membros.")]
    public Task<TextResourceContents> Familias(ClaimsPrincipal user) =>
        Read(user, "finami://familias", userId => _groupService.ListMineAsync(userId));

    [McpServerResource(UriTemplate = "finami://notificacoes/nao-lidas", Name = "notificacoes-nao-lidas",
        Title = "Notificações não lidas", MimeType = MIME_TYPE)]
    [Description("Quantidade de notificações não lidas e as 20 mais recentes delas.")]
    public Task<TextResourceContents> NotificacoesNaoLidas(ClaimsPrincipal user) =>
        Read(user, "finami://notificacoes/nao-lidas", async userId =>
        {
            var result = new McpUnreadNotificationsResult
            {
                Unread = (await _notificationService.CountUnreadAsync(userId)).Unread
            };
            long? beforeId = null;
            for (var page = 0; page < MAX_NOTIFICATION_PAGES && result.Items.Count < Math.Min(result.Unread, UNREAD_PREVIEW); page++)
            {
                var items = await _notificationService.ListAsync(userId, beforeId, McpPaging.MAX_LIMIT);
                result.Items.AddRange(items.Items.Where(n => !n.IsRead).Take(UNREAD_PREVIEW - result.Items.Count));
                if (items.NextBeforeId == null)
                    break;
                beforeId = items.NextBeforeId;
            }
            return result;
        });

    private static async Task<TextResourceContents> Read<T>(ClaimsPrincipal user, string uri, Func<long, Task<T>> load)
    {
        if (!user.HasScope(McpScopes.READ))
            throw new McpException(McpErrorCodes.INSUFFICIENT_SCOPE_MESSAGE);
        try
        {
            var data = await load(user.GetUserId());
            return new TextResourceContents
            {
                Uri = uri,
                MimeType = MIME_TYPE,
                Text = JsonSerializer.Serialize(data, McpToolBase.JSON_OPTIONS)
            };
        }
        catch (DomainException ex)
        {
            // Mesma mensagem do app; o SDK devolve como erro JSON-RPC.
            throw new McpException(ex.Message);
        }
    }
}
