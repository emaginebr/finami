using Finami.Domain.Enums;
using Finami.Domain.Models;
using Finami.Infra.Context;
using Finami.Infra.Repository;
using FluentAssertions;
using Microsoft.EntityFrameworkCore;

namespace Finami.Tests.Integration;

/// <summary>
/// Feature 006 (T011) e 007 (T009): a consulta agrupada de dívidas traduzida pelo Npgsql — empréstimos nos dois
/// sentidos, quitação (inclusive em outra moeda), pagamento ignorado, estorno e conversão ignorada (requer PostgreSQL).
/// </summary>
[Trait("Category", "Integration")]
public class PersonDebtsQueryTests
{
    private static FinamiContext NewContext() => new(new DbContextOptionsBuilder<FinamiContext>()
        .UseNpgsql(Environment.GetEnvironmentVariable(IntegrationFactAttribute.ENV_VAR))
        .Options);

    [IntegrationFact]
    public async Task Debts_are_loans_minus_settlements_per_counterpart_and_debt_currency()
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
            TransferKind? kind = null, Currency? debtCurrency = null, decimal? debtAmount = null,
            decimal? destinationAmount = null, long? reverses = null) => new()
        {
            Type = type, SourceAccountId = source.AccountId, DestinationAccountId = destination.AccountId,
            SourceAmount = amount, DestinationAmount = destinationAmount ?? amount, CreatedByUserId = ana.UserId,
            OccurredAt = DateTime.UtcNow, ReversedTransactionId = reverses,
            TransferKind = kind, DebtCurrency = debtCurrency, DebtAmount = debtAmount
        };
        Transaction Loan(Account source, Account destination, decimal amount) =>
            Tx(TransactionType.Transfer, source, destination, amount, TransferKind.Loan, source.Currency, amount);

        var first = Loan(anaBrl, brunoBrl, 100m);
        context.Transactions.Add(first);
        context.Transactions.Add(Loan(brunoBrl, anaBrl, 30m));
        context.Transactions.Add(Loan(anaBrl, brunoBrl, 50m));
        // Pagamento: não conta.
        context.Transactions.Add(Tx(TransactionType.Transfer, anaBrl, brunoBrl, 500m, TransferKind.Payment));
        context.Transactions.Add(Loan(brunoBtc, anaBtc, 0.0004m));
        // Bruno quita R$ 10,00 da dívida em real com bitcoin.
        context.Transactions.Add(Tx(TransactionType.Transfer, brunoBtc, anaBtc, 0.00002m, TransferKind.Settlement,
            Currency.Brl, 10m));
        // Conversão antiga entre pessoas: sem efeito na dívida, fica de fora.
        context.Transactions.Add(Tx(TransactionType.BtcPurchase, anaBrl, brunoBtc, 500m, destinationAmount: 0.001m));
        await context.SaveChangesAsync();
        // Estorno do primeiro empréstimo (Bruno → Ana, mesmo efeito).
        context.Transactions.Add(Tx(TransactionType.Reversal, brunoBrl, anaBrl, 100m, TransferKind.Loan, Currency.Brl,
            100m, reverses: first.TransactionId));
        await context.SaveChangesAsync();

        var repository = new TransactionRepository(context);
        var forAna = await repository.GetPersonDebtsAsync(ana.UserId);
        var forBruno = await repository.GetPersonDebtsAsync(bruno.UserId);

        // BRL, do ponto de vista de Ana: −100 −50 +30 +100 (estorno) +10 (quitação de Bruno) = −10 (Bruno deve 10).
        forAna.Should().BeEquivalentTo(new[]
        {
            (bruno.UserId, (int)Currency.Brl, -10m),
            (bruno.UserId, (int)Currency.Btc, 0.0004m)
        });
        forBruno.Should().BeEquivalentTo(new[]
        {
            (ana.UserId, (int)Currency.Brl, 10m),
            (ana.UserId, (int)Currency.Btc, -0.0004m)
        });

        (await repository.GetPairDebtAsync(bruno.UserId, ana.UserId, (int)Currency.Brl)).Should().Be(10m);
        (await repository.GetPairDebtAsync(ana.UserId, bruno.UserId, (int)Currency.Brl)).Should().Be(-10m);
        (await repository.GetPairDebtAsync(ana.UserId, bruno.UserId, (int)Currency.Btc)).Should().Be(0.0004m);
    }
}
