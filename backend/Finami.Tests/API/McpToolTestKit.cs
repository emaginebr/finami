using System.Security.Claims;
using System.Text.Json;
using Finami.API.Auth;
using Finami.Domain.Interfaces;
using Finami.Domain.Models;
using Finami.Domain.Services;
using Finami.Infra.Interfaces.Repository;
using ModelContextProtocol.Protocol;
using Moq;

namespace Finami.Tests.API;

/// <summary>
/// Apoio aos testes unitários das ferramentas MCP: principal com escopos (como o <c>McpBearerHandler</c> monta),
/// idempotência real sobre um repositório em memória e auditoria capturada.
/// </summary>
public sealed class McpToolTestKit
{
    public const long USER = 7;
    public const long GRANT = 70;
    public const string READ_WRITE = "finami:read finami:write";
    public const string READ_ONLY = "finami:read";

    public InMemoryIdempotencyRepository IdempotencyRepository { get; } = new();
    public McpIdempotencyService Idempotency { get; }
    public Mock<IMcpAuditService> Audit { get; } = new();
    public List<(long UserId, long GrantId, string Tool, string Outcome, long? TargetId)> AuditLog { get; } = new();

    public McpToolTestKit()
    {
        Idempotency = new McpIdempotencyService(IdempotencyRepository);
        Audit.Setup(a => a.RecordAsync(It.IsAny<long>(), It.IsAny<long>(), It.IsAny<string>(), It.IsAny<string>(), It.IsAny<long?>()))
            .Callback<long, long, string, string, long?>((u, g, t, o, id) => AuditLog.Add((u, g, t, o, id)))
            .Returns(Task.CompletedTask);
    }

    public static ClaimsPrincipal Principal(string scopes = READ_WRITE, long userId = USER, long grantId = GRANT) =>
        new(new ClaimsIdentity(new[]
        {
            new Claim(McpScopes.SUB_CLAIM, userId.ToString()),
            new Claim(McpScopes.GRANT_ID_CLAIM, grantId.ToString()),
            new Claim(McpScopes.CLIENT_ID_CLAIM, "fmc_teste"),
            new Claim(McpScopes.SCOPE_CLAIM, scopes)
        }, McpBearerDefaults.AUTHENTICATION_SCHEME, McpScopes.SUB_CLAIM, null));

    public static string Text(CallToolResult result) => result.Content.OfType<TextContentBlock>().Single().Text;

    public static JsonElement Structured(CallToolResult result) => result.StructuredContent!.Value;

    /// <summary>Código de erro (<c>structuredContent.codigo</c>) ou null em sucesso.</summary>
    public static string? Code(CallToolResult result) =>
        result.IsError == true ? Structured(result).GetProperty("codigo").GetString() : null;
}

/// <summary>Repositório de chaves de repetição em memória, com a mesma semântica do índice único.</summary>
public sealed class InMemoryIdempotencyRepository : IMcpIdempotencyRepository<McpIdempotencyKey>
{
    private long _nextId = 1;
    public List<McpIdempotencyKey> Keys { get; } = new();

    public Task<McpIdempotencyKey?> GetAsync(long userId, string toolName, string idempotencyKey) =>
        Task.FromResult(Keys.FirstOrDefault(k => k.UserId == userId && k.ToolName == toolName && k.IdempotencyKey == idempotencyKey));

    public Task<McpIdempotencyKey> InsertAsync(McpIdempotencyKey key)
    {
        if (Keys.Any(k => k.UserId == key.UserId && k.ToolName == key.ToolName && k.IdempotencyKey == key.IdempotencyKey))
            throw new InvalidOperationException(
                $"23505: duplicate key value violates unique constraint \"{UniqueViolation.MCP_IDEMPOTENCY_KEYS_UNIQUE_INDEX}\"");
        key.McpIdempotencyKeyId = _nextId++;
        Keys.Add(key);
        return Task.FromResult(key);
    }

    public Task<McpIdempotencyKey> UpdateAsync(McpIdempotencyKey key) => Task.FromResult(key);

    public Task DeleteAsync(McpIdempotencyKey key)
    {
        Keys.Remove(key);
        return Task.CompletedTask;
    }
}
