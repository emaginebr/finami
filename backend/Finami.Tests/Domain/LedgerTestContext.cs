using Finami.Domain.Enums;
using Finami.Domain.Interfaces;
using Finami.Domain.Models;
using Finami.Domain.Services;
using Finami.Domain.Validators;
using Finami.Infra.Interfaces.Repository;
using Moq;

namespace Finami.Tests.Domain;

/// <summary>Monta um LedgerService com repositórios em memória (mocks) e saldos controlados.</summary>
public class LedgerTestContext
{
    public Mock<IAccountRepository<Account>> Accounts { get; } = new();
    public Mock<ITransactionRepository<Transaction>> Transactions { get; } = new();
    public Mock<IUserRepository<User>> Users { get; } = new();
    public Mock<IUnitOfWork> UnitOfWork { get; } = new();
    public Mock<IAccessPolicy> AccessPolicy { get; } = new();
    public Mock<INotificationRepository<Notification>> Notifications { get; } = new();

    /// <summary>Notificações gravadas (feature 008: estorno feito por outra pessoa).</summary>
    public List<Notification> NotificationsInserted { get; } = new();

    public Dictionary<long, Account> AccountStore { get; } = new();
    public Dictionary<long, decimal> Balances { get; } = new();
    public List<Transaction> Inserted { get; } = new();

    /// <summary>Pares de titulares com ao menos uma família em comum (feature 006).</summary>
    public HashSet<(long, long)> Families { get; } = new();

    /// <summary>Coloca os titulares numa família em comum.</summary>
    public void ShareFamily(long userId, long otherUserId)
    {
        Families.Add((userId, otherUserId));
        Families.Add((otherUserId, userId));
    }

    public LedgerTestContext()
    {
        long id = 1;
        foreach (var currency in new[] { Currency.Brl, Currency.Btc })
        foreach (var kind in new[] { AccountKind.ExternalSource, AccountKind.ExternalSink, AccountKind.Exchange })
            Add(new Account { AccountId = id++, Kind = kind, Currency = currency, Name = $"{kind} {currency}" });

        Accounts.Setup(r => r.GetByIdAsync(It.IsAny<long>()))
            .ReturnsAsync((long accountId) => AccountStore.GetValueOrDefault(accountId));
        Accounts.Setup(r => r.GetByIdsAsync(It.IsAny<IEnumerable<long>>()))
            .ReturnsAsync((IEnumerable<long> ids) => ids.Where(AccountStore.ContainsKey).Select(i => AccountStore[i]).ToList());
        Accounts.Setup(r => r.GetSystemAccountAsync(It.IsAny<int>(), It.IsAny<int>()))
            .ReturnsAsync((int kind, int currency) =>
                AccountStore.Values.Single(a => (int)a.Kind == kind && (int)a.Currency == currency));
        Accounts.Setup(r => r.GetBalanceAsync(It.IsAny<long>()))
            .ReturnsAsync((long accountId) => Balances.GetValueOrDefault(accountId));

        Transactions.Setup(r => r.InsertWithEntriesAsync(It.IsAny<Transaction>()))
            .ReturnsAsync((Transaction t) =>
            {
                t.TransactionId = Inserted.Count + 1;
                Inserted.Add(t);
                foreach (var entry in t.Entries)
                    Balances[entry.AccountId] = Balances.GetValueOrDefault(entry.AccountId) + entry.Amount;
                return t;
            });
        Transactions.Setup(r => r.GetByIdAsync(It.IsAny<long>()))
            .ReturnsAsync((long txId) => Inserted.FirstOrDefault(t => t.TransactionId == txId));
        Transactions.Setup(r => r.GetReversalOfAsync(It.IsAny<long>()))
            .ReturnsAsync((long txId) => Inserted.FirstOrDefault(t => t.ReversedTransactionId == txId));

        // Feature 007: dívida do par pela mesma regra do repositório, sobre os lançamentos gravados.
        Transactions.Setup(r => r.GetPairDebtAsync(It.IsAny<long>(), It.IsAny<long>(), It.IsAny<int>()))
            .ReturnsAsync((long debtor, long creditor, int currency) => PairDebt(debtor, creditor, (Currency)currency));

        Users.Setup(r => r.GetByIdsAsync(It.IsAny<IEnumerable<long>>()))
            .ReturnsAsync((IEnumerable<long> ids) => ids.Distinct().Where(UserStore.ContainsKey).Select(i => UserStore[i]).ToList());
        Users.Setup(r => r.GetByIdAsync(It.IsAny<long>()))
            .ReturnsAsync((long id) => UserStore.GetValueOrDefault(id));

        // Por padrão, só o titular controla a carteira.
        AccessPolicy.Setup(p => p.CanControlWalletAsync(It.IsAny<long>(), It.IsAny<Account>()))
            .ReturnsAsync((long userId, Account a) => a.IsWallet && a.UserId == userId);
        AccessPolicy.Setup(p => p.EnsureCanControlWalletAsync(It.IsAny<long>(), It.IsAny<Account>()))
            .Returns((long userId, Account a) => a.IsWallet && a.UserId == userId
                ? Task.CompletedTask
                : throw new Finami.Domain.Exceptions.ForbiddenException());
        AccessPolicy.Setup(p => p.AreFamilyAsync(It.IsAny<long>(), It.IsAny<long>()))
            .ReturnsAsync((long owner, long other) => owner == other || Families.Contains((owner, other)));

        // Feature 008: sem famílias, as regras novas equivalem às de controle do titular (o responsável e as
        // permissões da família são testados com a política real em AccessPolicyPermissionsTests).
        AccessPolicy.Setup(p => p.CanCreateTransactionsAsync(It.IsAny<long>(), It.IsAny<Account>()))
            .ReturnsAsync((long userId, Account a) => a.IsWallet && a.UserId == userId);
        AccessPolicy.Setup(p => p.EnsureCanCreateTransactionsAsync(It.IsAny<long>(), It.IsAny<Account>()))
            .Returns((long userId, Account a) => AccessPolicy.Object.EnsureCanControlWalletAsync(userId, a));
        AccessPolicy.Setup(p => p.CanViewTransactionAsync(It.IsAny<long>(), It.IsAny<IEnumerable<Account>>()))
            .ReturnsAsync((long userId, IEnumerable<Account> accounts) =>
                accounts.Any(a => a.IsWallet && a.UserId == userId));
        AccessPolicy.Setup(p => p.CanReverseAsync(It.IsAny<long>(), It.IsAny<Transaction>(),
                It.IsAny<IEnumerable<Account>>(), It.IsAny<bool>()))
            .ReturnsAsync((long userId, Transaction t, IEnumerable<Account> accounts, bool reversed) =>
                t.Type != TransactionType.Reversal && !reversed && accounts.Any(a => a.IsWallet && a.UserId == userId));
        AccessPolicy.Setup(p => p.EnsureCanReverseAsync(It.IsAny<long>(), It.IsAny<IEnumerable<Account>>()))
            .Returns((long userId, IEnumerable<Account> accounts) => accounts.Any(a => a.IsWallet && a.UserId == userId)
                ? Task.CompletedTask
                : throw new Finami.Domain.Exceptions.ForbiddenException("Você não tem permissão sobre esta transação."));

        Notifications.Setup(r => r.InsertAsync(It.IsAny<Notification>()))
            .ReturnsAsync((Notification n) =>
            {
                n.NotificationId = NotificationsInserted.Count + 1;
                NotificationsInserted.Add(n);
                return n;
            });
    }

    public Dictionary<long, User> UserStore { get; } = new();

    /// <summary>Cadastra a pessoa (nome usado nas mensagens e no efeito na dívida).</summary>
    public void Person(long userId, string firstName) =>
        UserStore[userId] = new User { UserId = userId, FirstName = firstName, LastName = "Teste" };

    /// <summary>Saldo "devedor deve a credor" na moeda: Σ efeito com destino = devedor − Σ com origem = devedor.</summary>
    public decimal PairDebt(long debtor, long creditor, Currency currency) => Inserted
        .Where(t => t.DebtAmount.HasValue && t.DebtCurrency == currency)
        .Select(t => (Source: AccountStore[t.SourceAccountId].UserId, Destination: AccountStore[t.DestinationAccountId].UserId,
            Amount: t.DebtAmount!.Value))
        .Sum(e => e.Destination == debtor && e.Source == creditor ? e.Amount
            : e.Source == debtor && e.Destination == creditor ? -e.Amount
            : 0m);

    public Account Add(Account account)
    {
        AccountStore[account.AccountId] = account;
        return account;
    }

    public Account Wallet(long id, long ownerId, Currency currency, decimal balance = 0m, bool active = true)
    {
        Balances[id] = balance;
        return Add(new Account
        {
            AccountId = id, Kind = AccountKind.Wallet, UserId = ownerId, Currency = currency,
            Name = $"W{id}", IsActive = active
        });
    }

    public Mock<IQuoteService> Quotes { get; } = new();
    public Mock<IBtcQuoteRepository<BtcQuote>> QuoteRepository { get; } = new();

    /// <summary>Define a cotação usada nas conversões.</summary>
    public BtcQuote SetQuote(decimal priceBrl)
    {
        var quote = new BtcQuote { BtcQuoteId = 99, PriceBrl = priceBrl, QuotedAt = DateTime.UtcNow, Source = "test" };
        Quotes.Setup(q => q.GetForConversionAsync()).ReturnsAsync(quote);
        QuoteRepository.Setup(r => r.GetByIdAsync(99)).ReturnsAsync(quote);
        return quote;
    }

    // ---------------- Feature 008: política real com famílias em memória ----------------

    public Mock<IGroupRepository<Group>> Groups { get; } = new();
    public Dictionary<long, Group> GroupStore { get; } = new();

    /// <summary>
    /// Cria a família (o responsável entra como membro, como no app) e devolve o grupo para ajustar permissões e
    /// visibilidade. Os membros entram com os padrões da migration (pode lançar, não pode estornar).
    /// </summary>
    public Group Family(long groupId, string name, long responsibleId, params long[] memberIds)
    {
        var group = new Group { GroupId = groupId, Name = name, UserId = responsibleId };
        group.Members.Add(new GroupMember { GroupId = groupId, UserId = responsibleId });
        foreach (var memberId in memberIds)
            group.Members.Add(new GroupMember { GroupId = groupId, UserId = memberId });
        GroupStore[groupId] = group;
        return group;
    }

    /// <summary>Carteira vinculada a uma família.</summary>
    public Account FamilyWallet(long id, long ownerId, long groupId, Currency currency = Currency.Brl,
        decimal balance = 0m)
    {
        var wallet = Wallet(id, ownerId, currency, balance);
        wallet.GroupId = groupId;
        return wallet;
    }

    /// <summary>LedgerService com o <see cref="Finami.Domain.Services.AccessPolicy"/> real sobre <see cref="GroupStore"/>.</summary>
    public LedgerService CreateServiceWithRealPolicy()
    {
        Groups.Setup(g => g.GetByIdAsync(It.IsAny<long>()))
            .ReturnsAsync((long groupId) => GroupStore.GetValueOrDefault(groupId));
        Groups.Setup(g => g.GetResponsibleUserIdAsync(It.IsAny<long>()))
            .ReturnsAsync((long groupId) => GroupStore.TryGetValue(groupId, out var g) ? g.UserId : null);
        Groups.Setup(g => g.ShareGroupAsync(It.IsAny<long>(), It.IsAny<long>()))
            .ReturnsAsync((long a, long b) => Families.Contains((a, b))
                || GroupStore.Values.Any(g => g.IsMember(a) && g.IsMember(b)));
        var policy = new Finami.Domain.Services.AccessPolicy(Groups.Object);
        return new LedgerService(Accounts.Object, Transactions.Object, Users.Object, UnitOfWork.Object, policy,
            new AmountInfoValidator(), new TransferInfoValidator(), Quotes.Object, QuoteRepository.Object,
            Notifications.Object);
    }

    public LedgerService CreateService() => new(Accounts.Object, Transactions.Object, Users.Object,
        UnitOfWork.Object, AccessPolicy.Object, new AmountInfoValidator(), new TransferInfoValidator(),
        Quotes.Object, QuoteRepository.Object, Notifications.Object);
}
