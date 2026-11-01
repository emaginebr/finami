using System.Security.Claims;
using System.Text.Json;
using System.Text.Json.Nodes;
using Finami.API.Auth;
using Finami.API.Extensions;
using Finami.Domain.Exceptions;
using Finami.Domain.Interfaces;
using Finami.Domain.Models;
using ModelContextProtocol.Protocol;

namespace Finami.API.Mcp;

/// <summary>Códigos de erro das ferramentas MCP (contracts/mcp-tools.md §Regras comuns).</summary>
public static class McpErrorCodes
{
    public const string VALIDATION = "validacao";
    public const string NOT_FOUND = "nao_encontrado";
    public const string FORBIDDEN = "sem_permissao";
    public const string CONFLICT = "conflito";
    public const string BUSINESS_RULE = "regra_de_negocio";
    public const string QUOTE_UNAVAILABLE = "cotacao_indisponivel";
    public const string INSUFFICIENT_SCOPE = "permissao_insuficiente";
    public const string RATE_LIMITED = "limite_excedido";
    public const string INTERNAL = "erro_interno";

    public const string INSUFFICIENT_SCOPE_MESSAGE =
        "Esta conexão só permite consultas. Reconecte o assistente permitindo alterações.";
    public const string INTERNAL_MESSAGE = "Erro interno. Tente novamente.";

    /// <summary>Mesmo mapeamento de status do <c>FinamiControllerBase.Execute</c>, em códigos do MCP.</summary>
    public static string For(DomainException ex) => ex switch
    {
        ValidationException => VALIDATION,
        NotFoundException => NOT_FOUND,
        ForbiddenException or UnauthorizedException => FORBIDDEN,
        ConflictException or GoneException => CONFLICT,
        BusinessRuleException => BUSINESS_RULE,
        QuoteUnavailableException => QUOTE_UNAVAILABLE,
        _ => VALIDATION
    };
}

/// <summary>
/// Base das ferramentas MCP (research R-07): identifica a pessoa pelo token (<c>sub</c>), exige o escopo,
/// converte <see cref="DomainException"/> em resultado <c>isError</c> com a mesma mensagem do app e
/// monta o sucesso com <c>structuredContent</c> (DTO do domínio) + resumo em pt-BR.
/// </summary>
public abstract class McpToolBase
{
    /// <summary>Mesmas opções JSON da API: camelCase via <c>[JsonPropertyName]</c>, enums como texto.</summary>
    public static readonly JsonSerializerOptions JSON_OPTIONS =
        new JsonSerializerOptions(JsonSerializerDefaults.Web).ConfigureFinamiJson();

    private readonly ILogger _logger;
    private readonly IMcpIdempotencyService? _idempotency;
    private readonly IMcpAuditService? _audit;

    /// <summary>Ferramentas só de leitura.</summary>
    protected McpToolBase(ILogger logger)
    {
        _logger = logger;
    }

    /// <summary>Ferramentas de escrita: repetição segura (R-08) e auditoria (R-09).</summary>
    protected McpToolBase(ILogger logger, IMcpIdempotencyService idempotency, IMcpAuditService audit)
    {
        _logger = logger;
        _idempotency = idempotency;
        _audit = audit;
    }

    /// <summary>Executa uma ferramenta de leitura (<c>finami:read</c>).</summary>
    protected Task<CallToolResult> ExecuteReadAsync<T>(ClaimsPrincipal user, string toolName,
        Func<long, Task<T>> action, Func<T, string> summarize) =>
        ExecuteAsync(user, toolName, McpScopes.READ, action, summarize);

    /// <summary>
    /// Executa a ação com o <c>userId</c> do token se a conexão tiver <paramref name="requiredScope"/>; sem o
    /// escopo, nada é executado e a resposta é <c>permissao_insuficiente</c>.
    /// </summary>
    protected async Task<CallToolResult> ExecuteAsync<T>(ClaimsPrincipal user, string toolName, string requiredScope,
        Func<long, Task<T>> action, Func<T, string> summarize)
    {
        try
        {
            if (!user.HasScope(requiredScope))
                return Error(McpErrorCodes.INSUFFICIENT_SCOPE, McpErrorCodes.INSUFFICIENT_SCOPE_MESSAGE);
            var data = await action(user.GetUserId());
            return Success(data, summarize(data));
        }
        catch (DomainException ex)
        {
            return Error(McpErrorCodes.For(ex), ex.Message, ex.Errors);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Erro interno na ferramenta MCP {Tool}.", toolName);
            return Error(McpErrorCodes.INTERNAL, McpErrorCodes.INTERNAL_MESSAGE);
        }
    }

    /// <summary>
    /// Executa uma ferramenta de escrita: exige <c>finami:write</c> (sem ele nada é executado e a resposta é
    /// <c>permissao_insuficiente</c>), aplica a <c>chave_repeticao</c> quando informada (research R-08) e grava
    /// uma linha de auditoria com o resultado (<c>sucesso</c> ou o código do erro) e o id afetado (R-09).
    /// </summary>
    protected async Task<CallToolResult> ExecuteWriteAsync<T>(ClaimsPrincipal user, string toolName,
        string? idempotencyKey, Func<long, Task<T>> action, Func<T, string> summarize,
        Func<T, long?>? targetId = null)
    {
        if (_idempotency == null || _audit == null)
            throw new InvalidOperationException($"{GetType().Name} precisa dos serviços de escrita (idempotência e auditoria).");

        long userId = 0;
        long? target = null;
        string outcome;
        CallToolResult result;
        try
        {
            userId = user.GetUserId();
            if (!user.HasScope(McpScopes.WRITE))
            {
                outcome = McpErrorCodes.INSUFFICIENT_SCOPE;
                result = Error(McpErrorCodes.INSUFFICIENT_SCOPE, McpErrorCodes.INSUFFICIENT_SCOPE_MESSAGE);
            }
            else
            {
                var id = userId;
                var data = await _idempotency.ExecuteAsync(id, toolName, idempotencyKey, () => action(id));
                target = targetId?.Invoke(data);
                outcome = McpAuditLog.SUCCESS;
                result = Success(data, summarize(data));
            }
        }
        catch (DomainException ex)
        {
            outcome = McpErrorCodes.For(ex);
            result = Error(outcome, ex.Message, ex.Errors);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Erro interno na ferramenta MCP {Tool}.", toolName);
            outcome = McpErrorCodes.INTERNAL;
            result = Error(McpErrorCodes.INTERNAL, McpErrorCodes.INTERNAL_MESSAGE);
        }

        if (userId > 0)
            await AuditAsync(userId, user.GetGrantId(), toolName, outcome, target);
        return result;
    }

    private async Task AuditAsync(long userId, long grantId, string toolName, string outcome, long? targetId)
    {
        try
        {
            await _audit!.RecordAsync(userId, grantId, toolName, outcome, targetId);
        }
        catch (Exception ex)
        {
            // A auditoria nunca muda o resultado entregue ao assistente.
            _logger.LogError(ex, "Falha ao gravar a auditoria da ferramenta MCP {Tool}.", toolName);
        }
    }

    /// <summary>
    /// Sucesso: <c>structuredContent</c> = DTO serializado (listas e valores simples vão em
    /// <c>{ "itens": … }</c> / <c>{ "valor": … }</c>, pois o MCP exige objeto) e <c>content[0].text</c> = resumo.
    /// </summary>
    public static CallToolResult Success<T>(T data, string text)
    {
        var node = JsonSerializer.SerializeToNode(data, JSON_OPTIONS);
        JsonObject structured = node switch
        {
            JsonObject obj => obj,
            JsonArray array => new JsonObject { ["itens"] = array },
            _ => new JsonObject { ["valor"] = node }
        };
        return new CallToolResult
        {
            Content = new List<ContentBlock> { new TextContentBlock { Text = text } },
            StructuredContent = JsonSerializer.SerializeToElement(structured, JSON_OPTIONS),
            IsError = false
        };
    }

    /// <summary>Erro: <c>isError: true</c>, texto = mensagem, <c>structuredContent = { codigo, mensagem, erros }</c>.</summary>
    public static CallToolResult Error(string code, string message, IEnumerable<string>? errors = null)
    {
        var structured = new JsonObject
        {
            ["codigo"] = code,
            ["mensagem"] = message,
            ["erros"] = new JsonArray((errors ?? Enumerable.Empty<string>()).Select(e => (JsonNode?)JsonValue.Create(e)).ToArray())
        };
        return new CallToolResult
        {
            Content = new List<ContentBlock> { new TextContentBlock { Text = message } },
            StructuredContent = JsonSerializer.SerializeToElement(structured, JSON_OPTIONS),
            IsError = true
        };
    }
}
