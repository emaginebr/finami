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

    public LedgerService CreateService() => new(Accounts.Object, Transactions.Object, Users.Object,
        UnitOfWork.Object, AccessPolicy.Object, new AmountInfoValidator(), new TransferInfoValidator(),
        Quotes.Object, QuoteRepository.Object);
}
