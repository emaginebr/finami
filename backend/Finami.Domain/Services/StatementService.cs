using Finami.Domain.Enums;
using Finami.Domain.Exceptions;
using Finami.Domain.Interfaces;
using Finami.Domain.Models;
using Finami.Domain.Validators;
using Finami.DTO.Statements;
using Finami.Infra.Interfaces.Repository;

namespace Finami.Domain.Services;

/// <summary>Extratos por período por carteira, usuário ou grupo (FR-033/034/035, research R-13).</summary>
public class StatementService : IStatementService
{
    public const int MAX_PERIOD_DAYS = 366;

    private static readonly TimeZoneInfo BRAZIL_TIME_ZONE = ResolveBrazilTimeZone();

    private readonly IAccountRepository<Account> _accountRepository;
    private readonly IGroupRepository<Group> _groupRepository;
    private readonly IUserRepository<User> _userRepository;
    private readonly ILedgerRepository<LedgerEntry> _ledgerRepository;
    private readonly IAccessPolicy _accessPolicy;

    public StatementService(
        IAccountRepository<Account> accountRepository,
        IGroupRepository<Group> groupRepository,
        IUserRepository<User> userRepository,
        ILedgerRepository<LedgerEntry> ledgerRepository,
        IAccessPolicy accessPolicy)
    {
        _accountRepository = accountRepository;
        _groupRepository = groupRepository;
        _userRepository = userRepository;
        _ledgerRepository = ledgerRepository;
        _accessPolicy = accessPolicy;
    }

    public async Task<StatementResult> GetWalletStatementAsync(long userId, long walletId, DateOnly start, DateOnly end)
    {
        ValidatePeriod(start, end);
        var wallet = await _accountRepository.GetByIdAsync(walletId);
        if (wallet == null || !wallet.IsWallet)
            throw new NotFoundException("Carteira não encontrada.");
        if (!await _accessPolicy.CanViewWalletStatementAsync(userId, wallet))
            throw new ForbiddenException("Você não tem permissão para ver o extrato desta carteira.");

        return await BuildAsync("Wallet", walletId, new List<Account> { wallet }, start, end, StatementAccess.Full);
    }

    public async Task<StatementResult> GetUserStatementAsync(long userId, long targetUserId, DateOnly start, DateOnly end)
    {
        ValidatePeriod(start, end);
        _ = await _userRepository.GetByIdAsync(targetUserId) ?? throw new NotFoundException("Usuário não encontrado.");

        var wallets = await _accountRepository.ListByOwnerAsync(targetUserId, includeInactive: true);
        if (targetUserId != userId)
        {
            // De terceiros, só as carteiras que o chamador controla (ex.: vinculadas a grupo do qual é responsável).
            var visible = new List<Account>();
            foreach (var wallet in wallets)
            {
                if (await _accessPolicy.CanControlWalletAsync(userId, wallet))
                    visible.Add(wallet);
            }
            if (visible.Count == 0)
                throw new ForbiddenException("Você não tem permissão para ver o extrato deste usuário.");
            wallets = visible;
        }

        return await BuildAsync("User", targetUserId, wallets, start, end, StatementAccess.Full);
    }

    public async Task<StatementResult> GetGroupStatementAsync(long userId, long groupId, DateOnly start, DateOnly end)
    {
        ValidatePeriod(start, end);
        var group = await _groupRepository.GetByIdAsync(groupId) ?? throw new NotFoundException("Grupo não encontrado.");
        var access = _accessPolicy.GroupStatementAccess(userId, group);
        if (access == StatementAccess.Denied)
            throw new ForbiddenException("A visibilidade deste grupo não permite que você veja o extrato.");

        var wallets = await _accountRepository.ListByGroupsAsync(new[] { groupId }, includeInactive: true);
        return await BuildAsync("Group", groupId, wallets, start, end, access);
    }

    private static void ValidatePeriod(DateOnly start, DateOnly end)
    {
        if (start > end)
            throw new ValidationException("A data inicial deve ser anterior ou igual à data final.");
        if (end.DayNumber - start.DayNumber + 1 > MAX_PERIOD_DAYS)
            throw new ValidationException($"O período máximo do extrato é de {MAX_PERIOD_DAYS} dias.");
    }

    /// <summary>Converte uma data local (America/Sao_Paulo) à meia-noite para UTC.</summary>
    public static DateTime ToUtcStartOfDay(DateOnly date) =>
        TimeZoneInfo.ConvertTimeToUtc(date.ToDateTime(TimeOnly.MinValue, DateTimeKind.Unspecified), BRAZIL_TIME_ZONE);

    private async Task<StatementResult> BuildAsync(string scope, long scopeId, List<Account> scopeAccounts,
        DateOnly start, DateOnly end, StatementAccess access)
    {
        var result = new StatementResult
        {
            Scope = scope,
            ScopeId = scopeId,
            Start = start,
            End = end,
            DetailLevel = access == StatementAccess.Full ? "Full" : "Summary"
        };
        if (scopeAccounts.Count == 0)
            return result;

        var fromUtc = ToUtcStartOfDay(start);
        var toUtc = ToUtcStartOfDay(end.AddDays(1));
        var scopeIds = scopeAccounts.Select(a => a.AccountId).ToHashSet();

        var opening = await _ledgerRepository.GetOpeningBalancesAsync(scopeIds, fromUtc);
        var entries = await _ledgerRepository.ListEntriesAsync(scopeIds, fromUtc, toUtc);

        // Nomes das contas de saída/entrada (inclui contas fora do escopo).
        var referencedIds = entries
            .SelectMany(e => new[] { e.Transaction!.SourceAccountId, e.Transaction.DestinationAccountId })
            .Distinct();
        var accounts = (await _accountRepository.GetByIdsAsync(referencedIds)).ToDictionary(a => a.AccountId);
        // Feature 007: primeiro nome dos titulares, para "Empréstimo para Bruno"
        var ownerIds = accounts.Values.Where(a => a.UserId.HasValue).Select(a => a.UserId!.Value).Distinct().ToList();
        var ownerFirstNames = ownerIds.Count == 0
            ? new Dictionary<long, string>()
            : (await _userRepository.GetByIdsAsync(ownerIds)).ToDictionary(u => u.UserId, u => u.FirstName);
        string? OwnerFirstName(Account? account) =>
            account?.UserId is long ownerId && ownerFirstNames.TryGetValue(ownerId, out var name) ? name : null;

        var items = entries.Select(entry =>
        {
            var tx = entry.Transaction!;
            accounts.TryGetValue(tx.SourceAccountId, out var source);
            accounts.TryGetValue(tx.DestinationAccountId, out var destination);
            var sameCurrency = source != null && destination != null && source.Currency == destination.Currency;
            return new StatementEntryInfo
            {
                TransactionId = tx.TransactionId,
                OccurredAt = entry.OccurredAt,
                Type = tx.Type.ToString(),
                AccountId = entry.AccountId,
                SourceName = source?.Name ?? string.Empty,
                DestinationName = destination?.Name ?? string.Empty,
                Currency = entry.Currency.ToCode(),
                Amount = entry.Amount,
                QuotePriceBrl = tx.QuotePriceBrl,
                Description = tx.Description,
                // Feature 007: tipo e efeito na dívida, para o rótulo "Empréstimo para Bruno" sem chamada extra.
                TransferKind = tx.TransferKind?.ToCode(),
                DebtCurrency = tx.DebtCurrency?.ToCode(),
                DebtAmount = tx.DebtAmount,
                SourceOwnerFirstName = OwnerFirstName(source),
                DestinationOwnerFirstName = OwnerFirstName(destination),
                // FR-034: mesma moeda, origem e destino no escopo → os dois lançamentos se anulam.
                Internal = sameCurrency && scopeIds.Contains(tx.SourceAccountId) && scopeIds.Contains(tx.DestinationAccountId)
            };
        }).ToList();

        var currencies = scopeAccounts.Select(a => a.Currency).Distinct().OrderBy(c => c);
        foreach (var currency in currencies)
        {
            var code = currency.ToCode();
            var inCurrency = items.Where(i => i.Currency == code).ToList();
            var openingBalance = opening.GetValueOrDefault((int)currency);
            var totalIn = inCurrency.Where(i => !i.Internal && i.Amount > 0).Sum(i => i.Amount);
            var totalOut = inCurrency.Where(i => !i.Internal && i.Amount < 0).Sum(i => -i.Amount);
            result.Totals.Add(new StatementTotalInfo
            {
                Currency = code,
                OpeningBalance = openingBalance,
                TotalIn = totalIn,
                TotalOut = totalOut,
                ClosingBalance = openingBalance + inCurrency.Sum(i => i.Amount)
            });
        }

        if (access == StatementAccess.Full)
            result.Entries = items;
        return result;
    }

    private static TimeZoneInfo ResolveBrazilTimeZone()
    {
        foreach (var id in new[] { "America/Sao_Paulo", "E. South America Standard Time" })
        {
            try
            {
                return TimeZoneInfo.FindSystemTimeZoneById(id);
            }
            catch (TimeZoneNotFoundException)
            {
            }
            catch (InvalidTimeZoneException)
            {
            }
        }
        // Brasil sem horário de verão desde 2019.
        return TimeZoneInfo.CreateCustomTimeZone("BRT", TimeSpan.FromHours(-3), "BRT", "BRT");
    }
}
