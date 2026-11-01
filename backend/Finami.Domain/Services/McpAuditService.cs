using Finami.Domain.Interfaces;
using Finami.Domain.Models;
using Finami.Infra.Interfaces.Repository;

namespace Finami.Domain.Services;

/// <summary>Uma linha de auditoria por ferramenta de escrita executada (research R-09); retida por 1 ano.</summary>
public class McpAuditService : IMcpAuditService
{
    public const int MAX_OUTCOME_LENGTH = 40;

    private readonly IMcpAuditRepository<McpAuditLog> _repository;
    private readonly TimeProvider _time;

    public McpAuditService(IMcpAuditRepository<McpAuditLog> repository, TimeProvider? time = null)
    {
        _repository = repository;
        _time = time ?? TimeProvider.System;
    }

    public Task RecordAsync(long userId, long grantId, string toolName, string outcome, long? targetId)
    {
        var text = string.IsNullOrWhiteSpace(outcome) ? McpAuditLog.SUCCESS : outcome.Trim();
        return _repository.InsertAsync(new McpAuditLog
        {
            UserId = userId,
            OAuthGrantId = grantId,
            ToolName = toolName,
            Outcome = text.Length > MAX_OUTCOME_LENGTH ? text[..MAX_OUTCOME_LENGTH] : text,
            TargetId = targetId,
            CreatedAt = _time.GetUtcNow().UtcDateTime
        });
    }
}
