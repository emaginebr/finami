namespace Finami.Domain.Models;

/// <summary>Auditoria de ferramenta de escrita do MCP (FR-024): sem argumentos brutos nem tokens.</summary>
public class McpAuditLog
{
    public const string SUCCESS = "sucesso";

    public long McpAuditLogId { get; set; }
    public long UserId { get; set; }
    public long OAuthGrantId { get; set; }
    public string ToolName { get; set; } = string.Empty;
    public string Outcome { get; set; } = SUCCESS;
    public long? TargetId { get; set; }
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
}
