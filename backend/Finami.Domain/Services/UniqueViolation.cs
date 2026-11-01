namespace Finami.Domain.Services;

/// <summary>
/// Detecta violação de índice único do PostgreSQL (SQLSTATE 23505) sem acoplar o Domain ao Npgsql:
/// percorre as exceções internas (DbUpdateException → PostgresException) procurando o código e o índice.
/// </summary>
public static class UniqueViolation
{
    public const string SQLSTATE = "23505";
    public const string USERS_EMAIL_INDEX = "ix_users_email";
    public const string GROUP_INVITATIONS_PENDING_INDEX = "ix_group_invitations_pending";
    public const string OAUTH_GRANTS_ACTIVE_INDEX = "ix_oauth_grants_active";
    public const string MCP_IDEMPOTENCY_KEYS_UNIQUE_INDEX = "ix_mcp_idempotency_keys_user_tool_key";

    public static bool Is(Exception ex, string indexName)
    {
        for (var current = ex; current != null; current = current.InnerException)
        {
            if (current.Message.Contains(SQLSTATE, StringComparison.Ordinal)
                && current.Message.Contains(indexName, StringComparison.OrdinalIgnoreCase))
                return true;
        }
        return false;
    }
}
