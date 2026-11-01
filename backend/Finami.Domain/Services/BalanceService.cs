using Finami.Domain.Enums;
using Finami.Domain.Exceptions;
using Finami.Domain.Interfaces;
using Finami.Domain.Models;
using Finami.Domain.Validators;
using Finami.DTO.Balances;
using Finami.Infra.Interfaces.Repository;

namespace Finami.Domain.Services;

/// <summary>
/// Saldos por membro de grupo e por usuário nas famílias (FR-029/FR-030, contracts/api-additions.md §2–3).
/// Só leitura: considera apenas carteiras ativas ligadas ao grupo e estima o BTC em Real com a
/// cotação do <see cref="IQuoteService"/>, aceitando cotação desatualizada (sinalizada em isStale).
/// </summary>
public class BalanceService : IBalanceService
{
    private readonly IGroupRepository<Group> _groupRepository;
    private readonly IAccountRepository<Account> _accountRepository;
    private readonly IUserRepository<User> _userRepository;
    private readonly IAccessPolicy _accessPolicy;
    private readonly IQuoteService _quoteService;

    public BalanceService(
        IGroupRepository<Group> groupRepository,
        IAccountRepository<Account> accountRepository,
        IUserRepository<User> userRepository,
        IAccessPolicy accessPolicy,
        IQuoteService quoteService)
    {
        _groupRepository = groupRepository;
        _accountRepository = accountRepository;
        _userRepository = userRepository;
        _accessPolicy = accessPolicy;
        _quoteService = quoteService;
    }

    public async Task<GroupBalancesResult> GetGroupBalancesAsync(long userId, long groupId)
    {
        var group = await _groupRepository.GetByIdAsync(groupId);
        // Não membro recebe 404 para não revelar a existência do grupo.
        if (group == null || !group.IsMember(userId))
            throw new NotFoundException("Grupo não encontrado.");

        var level = DetailLevelFor(userId, group);
        var quote = await TryGetQuoteAsync();

        var memberIds = group.Members.Select(m => m.UserId).Append(group.UserId).Distinct().ToList();
        var users = (await _userRepository.GetByIdsAsync(memberIds)).ToDictionary(u => u.UserId);

        var result = new GroupBalancesResult
        {
            GroupId = group.GroupId,
            Name = group.Name,
            StatementVisibility = group.StatementVisibility.ToString(),
            IsResponsible = group.IsResponsible(userId),
            DetailLevel = level,
            Quote = quote
        };

        List<Account> wallets = new();
        Dictionary<long, decimal> balances = new();
        if (level != DetailLevel.Hidden)
        {
            wallets = (await _accountRepository.ListByGroupsAsync(new[] { groupId }, includeInactive: false))
                .Where(w => w.IsWallet && w.IsActive && w.GroupId == groupId)
                .ToList();
            balances = await LoadBalancesAsync(wallets);
        }

        foreach (var memberId in memberIds)
        {
            users.TryGetValue(memberId, out var user);
            var member = new MemberBalanceInfo
            {
                UserId = memberId,
                FirstName = user?.FirstName ?? string.Empty,
                LastName = user?.LastName ?? string.Empty,
                IsResponsible = group.IsResponsible(memberId)
            };

            if (level != DetailLevel.Hidden)
            {
                var own = wallets.Where(w => w.UserId == memberId).ToList();
                var totals = Summarize(own, balances, quote);
                member.BalanceBrl = totals.Brl;
                member.BalanceBtc = totals.Btc;
                member.EstimatedBrl = totals.EstimatedBrl;
                member.TotalBrl = totals.TotalBrl;
                result.BtcExcluded |= totals.BtcExcluded;
                if (level == DetailLevel.Full)
                    member.Wallets = await ToWalletInfosAsync(userId, own, balances, quote);
            }

            result.Members.Add(member);
        }

        result.Members = result.Members
            .OrderByDescending(m => m.IsResponsible)
            .ThenBy(m => m.FirstName, StringComparer.CurrentCultureIgnoreCase)
            .ThenBy(m => m.LastName, StringComparer.CurrentCultureIgnoreCase)
            .ThenBy(m => m.UserId)
            .ToList();
        if (level != DetailLevel.Hidden)
            result.TotalBrl = result.Members.Sum(m => m.TotalBrl ?? 0m);
        return result;
    }

    public async Task<UserGroupBalancesResult> GetUserGroupBalancesAsync(long viewerId, long userId)
    {
        var user = await _userRepository.GetByIdAsync(userId)
            ?? throw new NotFoundException("Usuário não encontrado.");
        var isSelf = viewerId == userId;

        // Grupos do usuário visíveis para quem pergunta (o próprio vê todos em Full).
        var visible = new List<(Group Group, DetailLevel Level)>();
        foreach (var group in await _groupRepository.ListByMemberAsync(userId))
        {
            if (!group.IsMember(userId))
                continue;
            if (isSelf)
            {
                visible.Add((group, DetailLevel.Full));
                continue;
            }
            if (!group.IsMember(viewerId))
                continue;
            var level = DetailLevelFor(viewerId, group);
            if (level != DetailLevel.Hidden)
                visible.Add((group, level));
        }

        // Não revela o vínculo quando nada é visível para terceiros.
        if (!isSelf && visible.Count == 0)
            throw new NotFoundException("Usuário não encontrado.");

        var result = new UserGroupBalancesResult
        {
            UserId = user.UserId,
            FirstName = user.FirstName,
            LastName = user.LastName
        };
        if (visible.Count == 0)
            return result;

        var groupIds = visible.Select(v => v.Group.GroupId).ToHashSet();
        var wallets = (await _accountRepository.ListByOwnerAsync(userId, includeInactive: false))
            .Where(w => w.IsWallet && w.IsActive && w.GroupId.HasValue && groupIds.Contains(w.GroupId.Value))
            .ToList();
        var balances = await LoadBalancesAsync(wallets);
        var quote = await TryGetQuoteAsync();

        foreach (var (group, level) in visible)
        {
            var inGroup = wallets.Where(w => w.GroupId == group.GroupId).ToList();
            var totals = Summarize(inGroup, balances, quote);
            result.BtcExcluded |= totals.BtcExcluded;
            result.Groups.Add(new UserGroupBalanceInfo
            {
                GroupId = group.GroupId,
                Name = group.Name,
                DetailLevel = level,
                BalanceBrl = totals.Brl,
                BalanceBtc = totals.Btc,
                EstimatedBrl = totals.EstimatedBrl,
                TotalBrl = totals.TotalBrl,
                Wallets = level == DetailLevel.Full
                    ? await ToWalletInfosAsync(viewerId, inGroup, balances, quote)
                    : new List<WalletBalanceInfo>()
            });
        }

        result.Groups = result.Groups
            .OrderBy(g => g.Name, StringComparer.CurrentCultureIgnoreCase)
            .ThenBy(g => g.GroupId)
            .ToList();
        result.TotalBrl = result.Groups.Sum(g => g.TotalBrl);
        return result;
    }

    /// <summary>Tabela da §2: mesmo critério de <see cref="IAccessPolicy.GroupStatementAccess"/>, com Denied → Hidden.</summary>
    private DetailLevel DetailLevelFor(long userId, Group group) =>
        _accessPolicy.GroupStatementAccess(userId, group) switch
        {
            StatementAccess.Full => DetailLevel.Full,
            StatementAccess.Summary => DetailLevel.Summary,
            _ => DetailLevel.Hidden
        };

    /// <summary>Cotação atual ou a última conhecida (mesmo se desatualizada); null se nunca houve cotação.</summary>
    private async Task<BalanceQuoteInfo?> TryGetQuoteAsync()
    {
        try
        {
            var quote = await _quoteService.GetCurrentAsync();
            return new BalanceQuoteInfo { PriceBrl = quote.PriceBrl, QuotedAt = quote.QuotedAt, IsStale = quote.IsStale };
        }
        catch (Exception)
        {
            // Como em WalletInfo: a consulta de saldos nunca falha por causa da cotação.
            return null;
        }
    }

    private async Task<Dictionary<long, decimal>> LoadBalancesAsync(List<Account> wallets) =>
        wallets.Count == 0
            ? new Dictionary<long, decimal>()
            : await _accountRepository.GetBalancesAsync(wallets.Select(w => w.AccountId));

    private static decimal? EstimateBrl(decimal btc, BalanceQuoteInfo? quote) =>
        quote == null ? null : Money.Truncate(btc * quote.PriceBrl, Currency.Brl);

    private static BalanceTotals Summarize(List<Account> wallets, Dictionary<long, decimal> balances, BalanceQuoteInfo? quote)
    {
        var brl = wallets.Where(w => w.Currency == Currency.Brl).Sum(w => balances.GetValueOrDefault(w.AccountId));
        var btc = wallets.Where(w => w.Currency == Currency.Btc).Sum(w => balances.GetValueOrDefault(w.AccountId));
        var estimated = EstimateBrl(btc, quote);
        return new BalanceTotals(brl, btc, estimated, brl + (estimated ?? 0m), quote == null && btc != 0m);
    }

    private async Task<List<WalletBalanceInfo>> ToWalletInfosAsync(long viewerId, List<Account> wallets,
        Dictionary<long, decimal> balances, BalanceQuoteInfo? quote)
    {
        var result = new List<WalletBalanceInfo>();
        foreach (var wallet in wallets.OrderBy(w => w.Name, StringComparer.CurrentCultureIgnoreCase).ThenBy(w => w.AccountId))
        {
            var balance = balances.GetValueOrDefault(wallet.AccountId);
            result.Add(new WalletBalanceInfo
            {
                WalletId = wallet.AccountId,
                Name = wallet.Name,
                Currency = wallet.Currency.ToCode(),
                IsVirtual = wallet.IsVirtual,
                Balance = balance,
                EstimatedBrl = wallet.Currency == Currency.Btc ? EstimateBrl(balance, quote) : null,
                CanViewStatement = await _accessPolicy.CanViewWalletStatementAsync(viewerId, wallet)
            });
        }
        return result;
    }

    private readonly record struct BalanceTotals(decimal Brl, decimal Btc, decimal? EstimatedBrl, decimal TotalBrl, bool BtcExcluded);
}
