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
