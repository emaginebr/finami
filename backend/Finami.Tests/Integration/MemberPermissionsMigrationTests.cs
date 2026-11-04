using System.Data.Common;
using Finami.Domain.Enums;
using Finami.Domain.Models;
using Finami.Infra.Context;
using Finami.Infra.Repository;
using FluentAssertions;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Infrastructure;
using Microsoft.EntityFrameworkCore.Migrations;
using Npgsql;

namespace Finami.Tests.Integration;

/// <summary>
/// Feature 008 (T012, SC-006): semeia famílias no esquema anterior (até AddTransferKindAndDebt), aplica
/// AddMemberPermissions e confere que os membros atuais ficam com "Pode lançar" ligada e "Pode estornar" desligada,
/// que o histórico e as notificações novas gravam e que o Down volta ao esquema anterior. Usa um banco próprio (criado
/// e apagado aqui), como o <see cref="TransferKindBackfillTests"/>.
/// </summary>
[Trait("Category", "Integration")]
public class MemberPermissionsMigrationTests
{
    private const string PREVIOUS_MIGRATION = "20261103230514_AddTransferKindAndDebt";

    private static FinamiContext NewContext(string connectionString) => new(new DbContextOptionsBuilder<FinamiContext>()
        .UseNpgsql(connectionString)
        .Options);

    [IntegrationFact]
    public async Task Existing_members_keep_creating_and_cannot_reverse_after_the_migration()
    {
        var builder = new NpgsqlConnectionStringBuilder(Environment.GetEnvironmentVariable(IntegrationFactAttribute.ENV_VAR));
        builder.Database = $"{builder.Database}_permissions_{Guid.NewGuid().ToString("N")[..12]}";
        var connectionString = builder.ConnectionString;

        await using var context = NewContext(connectionString);
        try
        {
            var migrator = context.GetService<IMigrator>();
            await migrator.MigrateAsync(PREVIOUS_MIGRATION);
            var connection = context.Database.GetDbConnection();
            await connection.OpenAsync();

            var ana = await ScalarAsync(connection, "INSERT INTO users (first_name, last_name) VALUES ('Ana', 'Perm') RETURNING user_id");
            var bruno = await ScalarAsync(connection, "INSERT INTO users (first_name, last_name) VALUES ('Bruno', 'Perm') RETURNING user_id");
            var caio = await ScalarAsync(connection, "INSERT INTO users (first_name, last_name) VALUES ('Caio', 'Perm') RETURNING user_id");
            var group = await ScalarAsync(connection,
                $"INSERT INTO groups (name, user_id) VALUES ('Silva', {ana}) RETURNING group_id");
            foreach (var member in new[] { ana, bruno, caio })
                await ScalarAsync(connection,
                    $"INSERT INTO group_members (group_id, user_id) VALUES ({group}, {member}) RETURNING group_member_id");

            await context.Database.MigrateAsync();

            var rows = await context.GroupMembers.AsNoTracking().Where(m => m.GroupId == group).ToListAsync();
            rows.Should().HaveCount(3);
            rows.Should().OnlyContain(m => m.CanCreateTransactions && !m.CanReverse, "padrões da migration (Q2)");

            // O domínio, com o grupo lido pelo repositório: o responsável tem tudo; membros podem lançar e não estornar.
            var loaded = (await new GroupRepository(context).GetByIdAsync(group))!;
            loaded.CanCreateTransactions(ana).Should().BeTrue();
            loaded.CanReverse(ana).Should().BeTrue();
            loaded.CanCreateTransactions(bruno).Should().BeTrue();
            loaded.CanReverse(bruno).Should().BeFalse();

            // Mudança persistida + histórico + notificação ligada ao histórico.
            var repository = new GroupRepository(context);
            var change = loaded.SetMemberPermissions(ana, caio, canCreateTransactions: false, canReverse: true)!;
            await repository.UpdateAsync(loaded);
            await repository.InsertPermissionChangeAsync(change);
            change.GroupMemberPermissionChangeId.Should().BePositive();
            context.Notifications.Add(new Notification
            {
                UserId = caio, Type = NotificationType.MemberPermissionsChanged, GroupId = group, ActorUserId = ana,
                PermissionChangeId = change.GroupMemberPermissionChangeId
            });
            await context.SaveChangesAsync();
            context.ChangeTracker.Clear();

            var caioRow = await context.GroupMembers.AsNoTracking().SingleAsync(m => m.GroupId == group && m.UserId == caio);
            (caioRow.CanCreateTransactions, caioRow.CanReverse).Should().Be((false, true));
            var notification = await context.Notifications.AsNoTracking().Include(n => n.PermissionChange)
                .SingleAsync(n => n.UserId == caio);
            notification.PermissionChange!.AfterCanReverse.Should().BeTrue();

            // Membro novo (fora do EF, como uma linha antiga) também entra com os padrões.
            var dora = await ScalarAsync(connection, "INSERT INTO users (first_name, last_name) VALUES ('Dora', 'Perm') RETURNING user_id");
            await ScalarAsync(connection,
                $"INSERT INTO group_members (group_id, user_id) VALUES ({group}, {dora}) RETURNING group_member_id");
            (await ScalarAsync(connection,
                    $"SELECT count(*) FROM group_members WHERE user_id = {dora} AND can_create_transactions AND NOT can_reverse"))
                .Should().Be(1);

            // Down: volta ao esquema anterior sem perder membros.
            await migrator.MigrateAsync(PREVIOUS_MIGRATION);
            (await ScalarAsync(connection,
                    "SELECT count(*) FROM information_schema.columns WHERE table_name = 'group_members' " +
                    "AND column_name IN ('can_create_transactions', 'can_reverse')"))
                .Should().Be(0);
            (await ScalarAsync(connection,
                    "SELECT count(*) FROM information_schema.columns WHERE table_name = 'notifications' " +
                    "AND column_name IN ('permission_change_id', 'transaction_id')"))
                .Should().Be(0);
            (await ScalarAsync(connection,
                    "SELECT count(*) FROM information_schema.tables WHERE table_name = 'group_member_permission_changes'"))
                .Should().Be(0);
            (await ScalarAsync(connection, $"SELECT count(*) FROM group_members WHERE group_id = {group}")).Should().Be(4);
        }
        finally
        {
            await context.Database.CloseConnectionAsync();
            NpgsqlConnection.ClearAllPools();
            await context.Database.EnsureDeletedAsync();
        }
    }

    private static async Task<long> ScalarAsync(DbConnection connection, string sql)
    {
        await using var command = connection.CreateCommand();
        command.CommandText = sql;
        return Convert.ToInt64(await command.ExecuteScalarAsync());
    }
}
