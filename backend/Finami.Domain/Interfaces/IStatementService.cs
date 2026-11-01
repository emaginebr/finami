using Finami.DTO.Statements;

namespace Finami.Domain.Interfaces;

public interface IStatementService
{
    Task<StatementResult> GetWalletStatementAsync(long userId, long walletId, DateOnly start, DateOnly end);
    Task<StatementResult> GetUserStatementAsync(long userId, long targetUserId, DateOnly start, DateOnly end);
    Task<StatementResult> GetGroupStatementAsync(long userId, long groupId, DateOnly start, DateOnly end);
}
