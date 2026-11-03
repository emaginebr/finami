using Finami.DTO.Wallets;

namespace Finami.Domain.Interfaces;

public interface IWalletService
{
    Task<WalletInfo> CreateAsync(long userId, WalletInsertInfo info);
    Task<List<WalletInfo>> ListAsync(long userId, long? ownerUserId, long? groupId, bool includeInactive);
    Task<WalletInfo> GetAsync(long userId, long walletId);
    Task<WalletInfo> UpdateAsync(long userId, long walletId, WalletUpdateInfo info);
    Task<WalletInfo> SetGroupAsync(long userId, long walletId, WalletGroupInfo info);
    Task<WalletInfo> DeactivateAsync(long userId, long walletId);
    Task DeleteAsync(long userId, long walletId);
    Task<WalletPublicInfo> GetPublicAsync(long walletId);

    /// <summary>Opções do campo Para da transferência a partir da carteira de origem (feature 006).</summary>
    Task<TransferDestinationsResult> GetTransferDestinationsAsync(long userId, long walletId);
}
