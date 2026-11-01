using Finami.Domain.Enums;
using Finami.Domain.Exceptions;
using Finami.Domain.Interfaces;
using Finami.Domain.Models;
using Finami.Domain.Validators;
using Finami.DTO.Wallets;
using Finami.Infra.Interfaces.Repository;
using FluentValidation;

namespace Finami.Domain.Services;

public class WalletService : IWalletService
{
    private readonly IAccountRepository<Account> _accountRepository;
    private readonly IUserRepository<User> _userRepository;
    private readonly IGroupRepository<Group> _groupRepository;
    private readonly IAccessPolicy _accessPolicy;
    private readonly IQuoteService _quoteService;
    private readonly IValidator<WalletInsertInfo> _insertValidator;
    private readonly IValidator<WalletUpdateInfo> _updateValidator;

    public WalletService(
        IAccountRepository<Account> accountRepository,
        IUserRepository<User> userRepository,
        IGroupRepository<Group> groupRepository,
        IAccessPolicy accessPolicy,
        IQuoteService quoteService,
        IValidator<WalletInsertInfo> insertValidator,
        IValidator<WalletUpdateInfo> updateValidator)
    {
        _quoteService = quoteService;
        _accountRepository = accountRepository;
        _userRepository = userRepository;
        _groupRepository = groupRepository;
        _accessPolicy = accessPolicy;
        _insertValidator = insertValidator;
        _updateValidator = updateValidator;
    }

    public async Task<WalletInfo> CreateAsync(long userId, WalletInsertInfo info)
    {
        await _insertValidator.ValidateOrThrowAsync(info);
        CurrencyCodes.TryParse(info.Currency, out var currency);

        var ownerUserId = info.OwnerUserId ?? userId;
        if (info.GroupId.HasValue)
        {
            var group = await _groupRepository.GetByIdAsync(info.GroupId.Value)
                ?? throw new NotFoundException("Grupo não encontrado.");
            // FR-019c: só o responsável cria carteira para outro membro.
            if (ownerUserId != userId && !group.IsResponsible(userId))
                throw new ForbiddenException("Apenas o responsável pelo grupo pode criar carteiras para outros membros.");
            if (!group.IsMember(ownerUserId))
                throw new BusinessRuleException("O titular da carteira precisa ser membro do grupo.");
        }
        else if (ownerUserId != userId)
        {
            throw new ForbiddenException(
                "Para criar uma carteira para outro usuário, informe um grupo do qual você é responsável.");
        }

        _ = await _userRepository.GetByIdAsync(ownerUserId) ?? throw new NotFoundException("Usuário não encontrado.");

        var wallet = new Account
        {
            Kind = AccountKind.Wallet,
            UserId = ownerUserId,
            Currency = currency,
            GroupId = info.GroupId,
            CreatedByUserId = userId,
            IsActive = true
        };
        wallet.UpdateDetails(info.Name, info.Description, info.IsVirtual);
        await _accountRepository.InsertAsync(wallet);
        return await ToInfoAsync(userId, wallet);
    }

    public async Task<List<WalletInfo>> ListAsync(long userId, long? ownerUserId, long? groupId, bool includeInactive)
    {
        // Carteiras próprias + carteiras vinculadas a grupos dos quais o usuário é responsável (FR-019b).
        var wallets = await _accountRepository.ListByOwnerAsync(userId, includeInactive);
        var responsibleGroups = await _groupRepository.ListResponsibleGroupIdsAsync(userId);
        if (responsibleGroups.Count > 0)
        {
            var groupWallets = await _accountRepository.ListByGroupsAsync(responsibleGroups, includeInactive);
            wallets = wallets.Concat(groupWallets)
                .GroupBy(w => w.AccountId).Select(g => g.First())
                .OrderBy(w => w.Name)
                .ToList();
        }
        if (ownerUserId.HasValue)
            wallets = wallets.Where(w => w.UserId == ownerUserId).ToList();
        if (groupId.HasValue)
            wallets = wallets.Where(w => w.GroupId == groupId).ToList();
        return await ToInfoListAsync(userId, wallets);
    }

    public async Task<WalletInfo> GetAsync(long userId, long walletId)
    {
        var wallet = await LoadControlledAsync(userId, walletId);
        return await ToInfoAsync(userId, wallet);
    }

    public async Task<WalletInfo> UpdateAsync(long userId, long walletId, WalletUpdateInfo info)
    {
        await _updateValidator.ValidateOrThrowAsync(info);
        var wallet = await LoadControlledAsync(userId, walletId);
        wallet.UpdateDetails(info.Name, info.Description, info.IsVirtual);
        await _accountRepository.UpdateAsync(wallet);
        return await ToInfoAsync(userId, wallet);
    }

    /// <summary>FR-019d: o titular vincula a um grupo do qual é membro; só o responsável desvincula.</summary>
    public async Task<WalletInfo> SetGroupAsync(long userId, long walletId, WalletGroupInfo info)
    {
        var wallet = await _accountRepository.GetByIdAsync(walletId);
        if (wallet == null || !wallet.IsWallet)
            throw new NotFoundException("Carteira não encontrada.");

        if (info.GroupId == null)
        {
            if (wallet.GroupId == null)
                return await ToInfoAsync(userId, wallet);
            var responsibleId = await _groupRepository.GetResponsibleUserIdAsync(wallet.GroupId.Value);
            if (responsibleId != userId)
                throw new ForbiddenException("Apenas o responsável pelo grupo pode desvincular a carteira.");
            wallet.LinkToGroup(null);
        }
        else
        {
            if (wallet.UserId != userId)
                throw new ForbiddenException("Apenas o titular pode vincular a carteira a um grupo.");
            if (wallet.GroupId == info.GroupId)
                return await ToInfoAsync(userId, wallet);
            if (wallet.GroupId != null)
                throw new BusinessRuleException(
                    "A carteira já está vinculada a outro grupo; peça ao responsável para desvinculá-la.");
            if (!await _groupRepository.IsMemberAsync(info.GroupId.Value, userId))
                throw new BusinessRuleException("Você precisa ser membro do grupo para vincular a carteira.");
            wallet.LinkToGroup(info.GroupId);
        }

        await _accountRepository.UpdateAsync(wallet);
        return await ToInfoAsync(userId, wallet);
    }

    public async Task<WalletInfo> DeactivateAsync(long userId, long walletId)
    {
        var wallet = await LoadControlledAsync(userId, walletId);
        wallet.Deactivate();
        await _accountRepository.UpdateAsync(wallet);
        return await ToInfoAsync(userId, wallet);
    }

    public async Task DeleteAsync(long userId, long walletId)
    {
        var wallet = await LoadControlledAsync(userId, walletId);
        if (await _accountRepository.HasEntriesAsync(walletId))
            throw new BusinessRuleException("A carteira possui transações e não pode ser excluída; desative-a.");
        await _accountRepository.DeleteAsync(wallet);
    }

    public async Task<WalletPublicInfo> GetPublicAsync(long walletId)
    {
        var wallet = await _accountRepository.GetByIdAsync(walletId);
        if (wallet == null || !wallet.IsWallet)
            throw new NotFoundException("Carteira não encontrada.");
        var owner = await _userRepository.GetByIdAsync(wallet.UserId!.Value);
        return new WalletPublicInfo
        {
            WalletId = wallet.AccountId,
            Name = wallet.Name,
            Currency = wallet.Currency.ToCode(),
            OwnerName = owner?.FullName ?? string.Empty,
            IsActive = wallet.IsActive
        };
    }

    private async Task<Account> LoadControlledAsync(long userId, long walletId)
    {
        var wallet = await _accountRepository.GetByIdAsync(walletId);
        if (wallet == null || !wallet.IsWallet)
            throw new NotFoundException("Carteira não encontrada.");
        await _accessPolicy.EnsureCanControlWalletAsync(userId, wallet);
        return wallet;
    }

    private async Task<WalletInfo> ToInfoAsync(long userId, Account wallet) =>
        (await ToInfoListAsync(userId, new List<Account> { wallet })).Single();

    private async Task<List<WalletInfo>> ToInfoListAsync(long userId, List<Account> wallets)
    {
        if (wallets.Count == 0) return new List<WalletInfo>();

        var balances = await _accountRepository.GetBalancesAsync(wallets.Select(w => w.AccountId));
        var owners = (await _userRepository.GetByIdsAsync(wallets.Select(w => w.UserId!.Value)))
            .ToDictionary(u => u.UserId);

        // US5: valor estimado em BRL das carteiras BTC; nunca falha a listagem por causa da cotação.
        BtcQuote? quote = null;
        if (wallets.Any(w => w.Currency == Currency.Btc))
        {
            try
            {
                quote = await _quoteService.TryGetCurrentAsync();
            }
            catch (Exception)
            {
                quote = null;
            }
        }

        var result = new List<WalletInfo>();
        foreach (var wallet in wallets)
        {
            owners.TryGetValue(wallet.UserId!.Value, out var owner);
            result.Add(new WalletInfo
            {
                WalletId = wallet.AccountId,
                Name = wallet.Name,
                Description = wallet.Description,
                Currency = wallet.Currency.ToCode(),
                IsVirtual = wallet.IsVirtual,
                IsActive = wallet.IsActive,
                OwnerUserId = wallet.UserId!.Value,
                OwnerName = owner?.FullName ?? string.Empty,
                GroupId = wallet.GroupId,
                Balance = balances.GetValueOrDefault(wallet.AccountId),
                EstimatedBrl = wallet.Currency == Currency.Btc && quote != null
                    ? Money.Truncate(balances.GetValueOrDefault(wallet.AccountId) * quote.PriceBrl, Currency.Brl)
                    : null,
                CanControl = await _accessPolicy.CanControlWalletAsync(userId, wallet),
                CreatedAt = wallet.CreatedAt
            });
        }
        return result;
    }
}
