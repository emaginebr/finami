using Finami.Domain.Enums;
using Finami.Domain.Models;
using Finami.Infra.Context;
using Finami.Infra.Repository;
using FluentAssertions;
using Microsoft.EntityFrameworkCore;

namespace Finami.Tests.Integration;

/// <summary>
/// Feature 006 (T011): a consulta agrupada de dívidas traduzida pelo Npgsql — transferências nos dois sentidos,
/// estorno e conversão ignorada (requer PostgreSQL).
/// </summary>
[Trait("Category", "Integration")]
public class PersonDebtsQueryTests
{
    private static FinamiContext NewContext() => new(new DbContextOptionsBuilder<FinamiContext>()
        .UseNpgsql(Environment.GetEnvironmentVariable(IntegrationFactAttribute.ENV_VAR))
        .Options);

    [IntegrationFact]
    public async Task Debts_are_net_per_counterpart_and_currency_with_reversals_and_without_conversions()
    {
        await using var context = NewContext();
        await context.Database.MigrateAsync();

        var suffix = Guid.NewGuid().ToString("N");
        var ana = new User { FirstName = "Ana", LastName = $"Dívidas {suffix}" };
        var bruno = new User { FirstName = "Bruno", LastName = $"Dívidas {suffix}" };
        context.Users.AddRange(ana, bruno);
        await context.SaveChangesAsync();

        Account Wallet(User owner, Currency currency) =>
            new() { Kind = AccountKind.Wallet, UserId = owner.UserId, Currency = currency, Name = $"{owner.FirstName} {currency}" };
        var anaBrl = Wallet(ana, Currency.Brl);
        var anaBtc = Wallet(ana, Currency.Btc);
        var brunoBrl = Wallet(bruno, Currency.Brl);
        var brunoBtc = Wallet(bruno, Currency.Btc);
        context.Accounts.AddRange(anaBrl, anaBtc, brunoBrl, brunoBtc);
        await context.SaveChangesAsync();

        Transaction Tx(TransactionType type, Account source, Account destination, decimal amount,
            decimal? destinationAmount = null, long? reverses = null) => new()
        {
            Type = type, SourceAccountId = source.AccountId, DestinationAccountId = destination.AccountId,
            SourceAmount = amount, DestinationAmount = destinationAmount ?? amount, CreatedByUserId = ana.UserId,
            OccurredAt = DateTime.UtcNow, ReversedTransactionId = reverses
        };

        var first = Tx(TransactionType.Transfer, anaBrl, brunoBrl, 100m);
        context.Transactions.Add(first);
        context.Transactions.Add(Tx(TransactionType.Transfer, brunoBrl, anaBrl, 30m));
        context.Transactions.Add(Tx(TransactionType.Transfer, anaBrl, brunoBrl, 50m));
        context.Transactions.Add(Tx(TransactionType.Transfer, brunoBtc, anaBtc, 0.0004m));
        // Conversão antiga entre pessoas: moedas diferentes, fica de fora.
        context.Transactions.Add(Tx(TransactionType.BtcPurchase, anaBrl, brunoBtc, 500m, 0.001m));
        await context.SaveChangesAsync();
        // Estorno da primeira (Bruno → Ana, mesmo valor).
        context.Transactions.Add(Tx(TransactionType.Reversal, brunoBrl, anaBrl, 100m, reverses: first.TransactionId));
        await context.SaveChangesAsync();

        var repository = new TransactionRepository(context);
        var forAna = await repository.GetPersonDebtsAsync(ana.UserId);
        var forBruno = await repository.GetPersonDebtsAsync(bruno.UserId);

        // Ana: enviou 100 + 50, recebeu 30 + 100 (estorno) → saldo = 130 − 150 = −20 (Bruno deve 20).
        forAna.Should().BeEquivalentTo(new[]
        {
            (bruno.UserId, (int)Currency.Brl, -20m),
            (bruno.UserId, (int)Currency.Btc, 0.0004m)
        });
        forBruno.Should().BeEquivalentTo(new[]
        {
            (ana.UserId, (int)Currency.Brl, 20m),
            (ana.UserId, (int)Currency.Btc, -0.0004m)
        });
    }
}
