using Finami.Domain.Enums;
using Finami.Domain.Exceptions;
using Finami.Domain.Interfaces;
using Finami.Domain.Models;
using Finami.Domain.Services;
using Finami.Domain.Validators;
using Finami.DTO.Transactions;
using Finami.Infra.Context;
using Finami.Infra.Repository;
using FluentAssertions;
using Microsoft.EntityFrameworkCore;
using Moq;

namespace Finami.Tests.Integration;

/// <summary>
/// Feature 007 (T023, R-03, SC-005): quitações paralelas de carteiras diferentes do mesmo devedor cuja soma passa da
/// dívida — o lock consultivo do par serializa o registro e a revalidação dentro dele recusa a segunda (requer PostgreSQL).
/// </summary>
[Trait("Category", "Integration")]
public class ConcurrentSettlementTests
{
    private static FinamiContext NewContext() => new(new DbContextOptionsBuilder<FinamiContext>()
        .UseNpgsql(Environment.GetEnvironmentVariable(IntegrationFactAttribute.ENV_VAR))
        .Options);

    private static LedgerService NewLedger(FinamiContext context) => new(
        new AccountRepository(context),
        new TransactionRepository(context),
        new UserRepository(context),
        new UnitOfWork(context),
        new FamilyPolicy(),
        new AmountInfoValidator(),
        new TransferInfoValidator(),
        Mock.Of<IQuoteService>(),
        new BtcQuoteRepository(context));

    [IntegrationFact]
    public async Task Parallel_settlements_above_the_debt_register_only_one()
    {
        // Algumas rodadas para aumentar a chance de as duas quitações passarem juntas pela validação inicial.
        for (var round = 0; round < 5; round++)
        {
            long ana, bruno, anaWallet, brunoWalletA, brunoWalletB;
            await using (var setup = NewContext())
            {
                await setup.Database.MigrateAsync();
                var suffix = Guid.NewGuid().ToString("N");
                var anaUser = new User { FirstName = "Ana", LastName = $"Quitação {suffix}" };
                var brunoUser = new User { FirstName = "Bruno", LastName = $"Quitação {suffix}" };
                setup.Users.AddRange(anaUser, brunoUser);
                await setup.SaveChangesAsync();
                ana = anaUser.UserId;
                bruno = brunoUser.UserId;

                Account Wallet(long owner, string name) =>
                    new() { Kind = AccountKind.Wallet, UserId = owner, Currency = Currency.Brl, Name = name };
                var anaW = Wallet(ana, "Nubank");
                var brunoA = Wallet(bruno, "Mesada");
                var brunoB = Wallet(bruno, "Cofrinho");
                setup.Accounts.AddRange(anaW, brunoA, brunoB);
                await setup.SaveChangesAsync();
                anaWallet = anaW.AccountId;
                brunoWalletA = brunoA.AccountId;
                brunoWalletB = brunoB.AccountId;

                await NewLedger(setup).TransferAsync(ana, new TransferInfo
                    { SourceWalletId = anaWallet, DestinationWalletId = brunoWalletA, Amount = 100m, Kind = "loan" });
            }

            async Task<string?> TrySettle(long sourceWallet)
            {
                await using var context = NewContext();
                try
                {
                    await NewLedger(context).TransferAsync(bruno, new TransferInfo
                    {
                        SourceWalletId = sourceWallet, DestinationWalletId = anaWallet, Amount = 70m, Kind = "settlement"
                    });
                    return null;
                }
                catch (BusinessRuleException ex)
                {
                    return ex.Message;
                }
            }

            var results = await Task.WhenAll(TrySettle(brunoWalletA), TrySettle(brunoWalletB));

            results.Count(r => r == null).Should().Be(1, $"rodada {round}: só uma quitação cabe na dívida");
            results.Single(r => r != null).Should().Be("O valor é maior que a dívida (R$ 30,00).");
            await using var check = NewContext();
            var debt = await new TransactionRepository(check).GetPairDebtAsync(bruno, ana, (int)Currency.Brl);
            debt.Should().Be(30m);
        }
    }

    [Fact]
    public void Pair_lock_key_does_not_depend_on_the_order_of_the_ids()
    {
        UnitOfWork.DebtPairLockKey(7, 9).Should().Be(UnitOfWork.DebtPairLockKey(9, 7));
        UnitOfWork.DebtPairLockKey(7, 9).Should().Be((7L << 32) | 9L);
        UnitOfWork.DebtPairLockKey(7, 9).Should().NotBe(UnitOfWork.DebtPairLockKey(7, 10));
    }

    /// <summary>Cada titular controla as próprias carteiras; todos são da mesma família.</summary>
    private sealed class FamilyPolicy : IAccessPolicy
    {
        public Task<bool> CanControlWalletAsync(long userId, Account wallet) =>
            Task.FromResult(wallet.IsWallet && wallet.UserId == userId);

        public Task EnsureCanControlWalletAsync(long userId, Account wallet) =>
            wallet.IsWallet && wallet.UserId == userId ? Task.CompletedTask : throw new ForbiddenException();

        public bool CanEditUserProfile(long userId, User target) => target.UserId == userId;

        public void EnsureCanEditUserProfile(long userId, User target)
        {
            if (!CanEditUserProfile(userId, target)) throw new ForbiddenException();
        }

        public Task<bool> CanViewUserAsync(long userId, User target) => Task.FromResult(true);

        public Task<bool> AreFamilyAsync(long ownerUserId, long otherUserId) => Task.FromResult(true);

        public StatementAccess GroupStatementAccess(long userId, Group group) => StatementAccess.Full;

        public Task<bool> CanViewWalletStatementAsync(long userId, Account wallet) => CanControlWalletAsync(userId, wallet);
    }
}
