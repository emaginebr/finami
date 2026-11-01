namespace Finami.Domain.Enums;

/// <summary>Estado de uma chave de repetição do MCP (research R-08).</summary>
public enum IdempotencyStatus
{
    InProgress = 1,
    Completed = 2
}
