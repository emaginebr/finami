using Finami.Domain.Enums;

namespace Finami.Domain.Models;

/// <summary>Chave de repetição segura de uma ferramenta de escrita do MCP (research R-08), válida por 24 h.</summary>
public class McpIdempotencyKey
{
    public long McpIdempotencyKeyId { get; set; }
    public long UserId { get; set; }
    public string ToolName { get; set; } = string.Empty;
    public string IdempotencyKey { get; set; } = string.Empty;
    public IdempotencyStatus Status { get; set; } = IdempotencyStatus.InProgress;
    public string? ResultJson { get; set; }
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;

    public void Complete(string resultJson)
    {
        Status = IdempotencyStatus.Completed;
        ResultJson = resultJson;
    }
}
