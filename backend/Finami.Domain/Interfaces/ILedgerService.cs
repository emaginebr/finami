using Finami.DTO.Transactions;

namespace Finami.Domain.Interfaces;

public interface ILedgerService
{
    Task<TransactionInfo> IncomeAsync(long userId, IncomeInfo info);
    Task<TransactionInfo> ExpenseAsync(long userId, ExpenseInfo info);
    Task<TransactionInfo> TransferAsync(long userId, TransferInfo info);
    Task<TransferPreviewResult> PreviewTransferAsync(long userId, TransferInfo info);
    Task<TransactionInfo> ReverseAsync(long userId, long transactionId, ReverseInfo? info);
    Task<TransactionInfo> GetAsync(long userId, long transactionId);
}
