using System.Data.Common;
using Finami.Domain.Enums;
using Finami.Infra.Context;
using Finami.Infra.Repository;
using FluentAssertions;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Infrastructure;
using Microsoft.EntityFrameworkCore.Migrations;
using Npgsql;

namespace Finami.Tests.Integration;

/// <summary>
/// Feature 007 (T009, SC-002): semeia transferências, estornos, conversões e lançamentos do mesmo titular no esquema
/// anterior (até AddTransactionAccountIndexes), anota as dívidas pelo cálculo antigo, aplica AddTransferKindAndDebt e
/// confere que o cálculo novo devolve os mesmos saldos. Usa um banco próprio (criado e apagado aqui), porque descer a
/// migration no banco compartilhado atrapalharia os outros testes de integração.
/// </summary>
[Trait("Category", "Integration")]
public class TransferKindBackfillTests
{
    private const string PREVIOUS_MIGRATION = "20261103163054_AddTransactionAccountIndexes";

    private static FinamiContext NewContext(string connectionString) => new(new DbContextOptionsBuilder<FinamiContext>()
        .UseNpgsql(connectionString)
        .Options);

    [IntegrationFact]
    public async Task Debts_shown_before_the_migration_are_the_same_after_it()
    {
        var builder = new NpgsqlConnectionStringBuilder(Environment.GetEnvironmentVariable(IntegrationFactAttribute.ENV_VAR));
        builder.Database = $"{builder.Database}_backfill_{Guid.NewGuid().ToString("N")[..12]}";
        var connectionString = builder.ConnectionString;

        await using var context = NewContext(connectionString);
        try
        {
            await context.GetService<IMigrator>().MigrateAsync(PREVIOUS_MIGRATION);
            var connection = context.Database.GetDbConnection();
            await connection.OpenAsync();

            var ana = await ScalarAsync(connection, "INSERT INTO users (first_name, last_name) VALUES ('Ana', 'Backfill') RETURNING user_id");
            var bruno = await ScalarAsync(connection, "INSERT INTO users (first_name, last_name) VALUES ('Bruno', 'Backfill') RETURNING user_id");
            var caio = await ScalarAsync(connection, "INSERT INTO users (first_name, last_name) VALUES ('Caio', 'Backfill') RETURNING user_id");

            async Task<long> Wallet(long owner, Currency currency) => await ScalarAsync(connection,
                $"INSERT INTO accounts (kind, user_id, currency, name) VALUES (1, {owner}, {(int)currency}, 'W') RETURNING account_id");
            var anaBrl = await Wallet(ana, Currency.Brl);
            var anaSavings = await Wallet(ana, Currency.Brl);
            var anaBtc = await Wallet(ana, Currency.Btc);
            var brunoBrl = await Wallet(bruno, Currency.Brl);
            var brunoBtc = await Wallet(bruno, Currency.Btc);
            var caioBrl = await Wallet(caio, Currency.Brl);
            var externalSource = await ScalarAsync(connection,
                "SELECT account_id FROM accounts WHERE kind = 2 AND currency = 1");

            async Task<long> Tx(TransactionType type, long source, long destination, decimal amount,
                decimal? destinationAmount = null, long? reverses = null) => await ScalarAsync(connection,
                "INSERT INTO transactions (type, source_account_id, destination_account_id, source_amount, " +
                "destination_amount, occurred_at, created_by_user_id, reversed_transaction_id) VALUES " +
                $"({(int)type}, {source}, {destination}, {Sql(amount)}, {Sql(destinationAmount ?? amount)}, " +
                $"now() at time zone 'utc', {ana}, {(reverses.HasValue ? reverses.Value.ToString() : "NULL")}) " +
                "RETURNING transaction_id");

            var first = await Tx(TransactionType.Transfer, anaBrl, brunoBrl, 100m);
            var back = await Tx(TransactionType.Transfer, brunoBrl, anaBrl, 30m);
            var btc = await Tx(TransactionType.Transfer, brunoBtc, anaBtc, 0.0004m);
            var own = await Tx(TransactionType.Transfer, anaBrl, anaSavings, 50m);
            var oldConversion = await Tx(TransactionType.BtcPurchase, anaBrl, brunoBtc, 500m, 0.001m);
            var fromCaio = await Tx(TransactionType.Transfer, caioBrl, brunoBrl, 40m);
            var income = await Tx(TransactionType.ExternalIncome, externalSource, anaBrl, 1000m);
            var reversal = await Tx(TransactionType.Reversal, brunoBrl, anaBrl, 100m, reverses: first);

            var people = new[] { ana, bruno, caio };
            var before = new Dictionary<long, List<(long, int, decimal)>>();
            foreach (var person in people)
                before[person] = await OldPersonDebtsAsync(context, person);

            await context.Database.MigrateAsync();

            var repository = new TransactionRepository(context);
            foreach (var person in people)
            {
                var after = await repository.GetPersonDebtsAsync(person);
                after.Should().BeEquivalentTo(before[person], $"as dívidas da pessoa {person} não podem mudar (SC-002)");
            }
            // Sanidade: o cálculo antigo tinha dívidas. Bruno recebeu 100 de Ana e devolveu 30 + 100 (estorno): Ana deve
            // 30 a Bruno; Bruno enviou ₿ 0,0004 a Ana (Ana deve); Caio enviou 40 a Bruno (Bruno deve).
            before[bruno].Should().BeEquivalentTo(new[]
            {
                (ana, (int)Currency.Brl, -30m),
                (ana, (int)Currency.Btc, -0.0004m),
                (caio, (int)Currency.Brl, 40m)
            });

            var marked = await context.Transactions.AsNoTracking()
                .Where(t => t.DebtAmount != null)
                .Select(t => new { t.TransactionId, t.TransferKind, t.DebtCurrency, t.DebtAmount })
                .ToListAsync();
            marked.Select(t => t.TransactionId).Should().BeEquivalentTo(new[] { first, back, btc, fromCaio, reversal });
            marked.Should().OnlyContain(t => t.TransferKind == TransferKind.Loan);
            marked.Single(t => t.TransactionId == btc).DebtCurrency.Should().Be(Currency.Btc);
            marked.Single(t => t.TransactionId == btc).DebtAmount.Should().Be(0.0004m);
            marked.Single(t => t.TransactionId == back).DebtAmount.Should().Be(30m);
            (await context.Transactions.AsNoTracking()
                    .Where(t => t.TransactionId == own || t.TransactionId == oldConversion || t.TransactionId == income)
                    .CountAsync(t => t.TransferKind == null && t.DebtCurrency == null && t.DebtAmount == null))
                .Should().Be(3);
        }
        finally
        {
            await context.Database.CloseConnectionAsync();
            NpgsqlConnection.ClearAllPools();
            await context.Database.EnsureDeletedAsync();
        }
    }

    /// <summary>Cálculo da feature 006 (GetPersonDebtsAsync antes desta feature), copiado sem mudanças.</summary>
    private static async Task<List<(long, int, decimal)>> OldPersonDebtsAsync(FinamiContext context, long userId)
    {
        var rows = await (
                from t in context.Transactions
                join source in context.Accounts on t.SourceAccountId equals source.AccountId
                join destination in context.Accounts on t.DestinationAccountId equals destination.AccountId
                where source.Kind == AccountKind.Wallet && destination.Kind == AccountKind.Wallet
                      && source.Currency == destination.Currency
                      && source.UserId != null && destination.UserId != null
                      && source.UserId != destination.UserId
                      && (source.UserId == userId || destination.UserId == userId)
                select new
                {
                    CounterpartUserId = source.UserId == userId ? destination.UserId!.Value : source.UserId!.Value,
                    source.Currency,
                    Signed = destination.UserId == userId ? t.DestinationAmount : -t.SourceAmount
                })
            .GroupBy(x => new { x.CounterpartUserId, x.Currency })
            .Select(g => new { g.Key.CounterpartUserId, g.Key.Currency, Balance = g.Sum(x => x.Signed) })
            .ToListAsync();
        return rows.Select(r => (r.CounterpartUserId, (int)r.Currency, r.Balance)).ToList();
    }

    private static string Sql(decimal value) => value.ToString(System.Globalization.CultureInfo.InvariantCulture);

    private static async Task<long> ScalarAsync(DbConnection connection, string sql)
    {
        await using var command = connection.CreateCommand();
        command.CommandText = sql;
        return Convert.ToInt64(await command.ExecuteScalarAsync());
    }
}
