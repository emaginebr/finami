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

        Users.Setup(r => r.GetByIdsAsync(It.IsAny<IEnumerable<long>>())).ReturnsAsync(new List<User>());

        // Por padrão, só o titular controla a carteira.
        AccessPolicy.Setup(p => p.CanControlWalletAsync(It.IsAny<long>(), It.IsAny<Account>()))
            .ReturnsAsync((long userId, Account a) => a.IsWallet && a.UserId == userId);
        AccessPolicy.Setup(p => p.EnsureCanControlWalletAsync(It.IsAny<long>(), It.IsAny<Account>()))
            .Returns((long userId, Account a) => a.IsWallet && a.UserId == userId
                ? Task.CompletedTask
                : throw new Finami.Domain.Exceptions.ForbiddenException());
    }

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
