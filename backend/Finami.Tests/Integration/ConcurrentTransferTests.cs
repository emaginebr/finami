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

/// <summary>Concorrência real com SELECT ... FOR UPDATE e invariante SC-002 (requer PostgreSQL).</summary>
[Trait("Category", "Integration")]
public class ConcurrentTransferTests
{
    private static FinamiContext NewContext() => new(new DbContextOptionsBuilder<FinamiContext>()
        .UseNpgsql(Environment.GetEnvironmentVariable(IntegrationFactAttribute.ENV_VAR))
        .Options);

    private static LedgerService NewLedger(FinamiContext context) => new(
        new AccountRepository(context),
        new TransactionRepository(context),
        new UserRepository(context),
        new UnitOfWork(context),
        new AccessPolicyForOwner(),
        new AmountInfoValidator(),
        new TransferInfoValidator(),
        Mock.Of<IQuoteService>(),
        new BtcQuoteRepository(context));

    [IntegrationFact]
    public async Task Parallel_transfers_exceeding_balance_are_all_posted_and_ledger_stays_balanced()
    {
        long userId, sourceId, destinationId;
        await using (var setup = NewContext())
        {
            await setup.Database.MigrateAsync();
            var user = new User { FirstName = "Teste", LastName = $"Concorrência {Guid.NewGuid():N}" };
            setup.Users.Add(user);
            await setup.SaveChangesAsync();
            userId = user.UserId;

            var source = new Account { Kind = AccountKind.Wallet, UserId = userId, Currency = Currency.Brl, Name = "Origem" };
            var destination = new Account { Kind = AccountKind.Wallet, UserId = userId, Currency = Currency.Brl, Name = "Destino" };
            setup.Accounts.AddRange(source, destination);
            await setup.SaveChangesAsync();
            sourceId = source.AccountId;
            destinationId = destination.AccountId;

            await NewLedger(setup).IncomeAsync(userId, new IncomeInfo { WalletId = sourceId, Amount = 100m });
        }

        async Task<bool> TryTransfer()
        {
            await using var context = NewContext();
            try
            {
                await NewLedger(context).TransferAsync(userId, new TransferInfo
                    { SourceWalletId = sourceId, DestinationWalletId = destinationId, Amount = 70m });
                return true;
            }
            catch (BusinessRuleException)
            {
                return false;
            }
        }

        var results = await Task.WhenAll(TryTransfer(), TryTransfer());

        // Saldo pode ficar negativo: as duas transferências entram, sem perder nenhuma
        results.Should().OnlyContain(ok => ok);
        await using var check = NewContext();
        var balance = await new AccountRepository(check).GetBalanceAsync(sourceId);
        balance.Should().Be(-40m);

        var unbalanced = await check.LedgerEntries
            .GroupBy(e => new { e.TransactionId, e.Currency })
            .Where(g => g.Sum(e => e.Amount) != 0m)
            .CountAsync();
        unbalanced.Should().Be(0);
    }

    private sealed class AccessPolicyForOwner : IAccessPolicy
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

        public Task<bool> CanViewUserAsync(long userId, User target) => Task.FromResult(target.UserId == userId);

        public StatementAccess GroupStatementAccess(long userId, Group group) =>
            group.IsResponsible(userId) ? StatementAccess.Full : StatementAccess.Denied;

        public Task<bool> CanViewWalletStatementAsync(long userId, Account wallet) => CanControlWalletAsync(userId, wallet);
    }
}
