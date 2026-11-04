using System;
using Microsoft.EntityFrameworkCore.Migrations;
using Npgsql.EntityFrameworkCore.PostgreSQL.Metadata;

#nullable disable

namespace Finami.Infra.Migrations
{
    /// <summary>
    /// Feature 008 (R-01/R-02/R-06): permissões por membro em group_members (os padrões do banco deixam todos os
    /// membros atuais com "Pode lançar" ligada e "Pode estornar" desligada, Q2), o histórico imutável
    /// group_member_permission_changes e as ligações das notificações novas (FK com SET NULL). O Down remove tudo;
    /// os lançamentos não são afetados.
    /// </summary>
    public partial class AddMemberPermissions : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<long>(
                name: "permission_change_id",
                table: "notifications",
                type: "bigint",
                nullable: true);

            migrationBuilder.AddColumn<long>(
                name: "transaction_id",
                table: "notifications",
                type: "bigint",
                nullable: true);

            migrationBuilder.AddColumn<bool>(
                name: "can_create_transactions",
                table: "group_members",
                type: "boolean",
                nullable: false,
                defaultValue: true);

            migrationBuilder.AddColumn<bool>(
                name: "can_reverse",
                table: "group_members",
                type: "boolean",
                nullable: false,
                defaultValue: false);

            migrationBuilder.CreateTable(
                name: "group_member_permission_changes",
                columns: table => new
                {
                    group_member_permission_change_id = table.Column<long>(type: "bigint", nullable: false)
                        .Annotation("Npgsql:ValueGenerationStrategy", NpgsqlValueGenerationStrategy.IdentityByDefaultColumn),
                    group_id = table.Column<long>(type: "bigint", nullable: false),
                    member_user_id = table.Column<long>(type: "bigint", nullable: false),
                    changed_by_user_id = table.Column<long>(type: "bigint", nullable: false),
                    changed_at = table.Column<DateTime>(type: "timestamp without time zone", nullable: false),
                    before_can_create_transactions = table.Column<bool>(type: "boolean", nullable: false),
                    before_can_reverse = table.Column<bool>(type: "boolean", nullable: false),
                    after_can_create_transactions = table.Column<bool>(type: "boolean", nullable: false),
                    after_can_reverse = table.Column<bool>(type: "boolean", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("group_member_permission_changes_pkey", x => x.group_member_permission_change_id);
                    table.ForeignKey(
                        name: "fk_group_member_permission_changes_changed_by",
                        column: x => x.changed_by_user_id,
                        principalTable: "users",
                        principalColumn: "user_id",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "fk_group_member_permission_changes_group",
                        column: x => x.group_id,
                        principalTable: "groups",
                        principalColumn: "group_id",
                        onDelete: ReferentialAction.Cascade);
                    table.ForeignKey(
                        name: "fk_group_member_permission_changes_member",
                        column: x => x.member_user_id,
                        principalTable: "users",
                        principalColumn: "user_id",
                        onDelete: ReferentialAction.Restrict);
                });

            migrationBuilder.CreateIndex(
                name: "ix_notifications_permission_change_id",
                table: "notifications",
                column: "permission_change_id");

            migrationBuilder.CreateIndex(
                name: "ix_notifications_transaction_id",
                table: "notifications",
                column: "transaction_id");

            migrationBuilder.CreateIndex(
                name: "ix_group_member_permission_changes_changed_by_user_id",
                table: "group_member_permission_changes",
                column: "changed_by_user_id");

            migrationBuilder.CreateIndex(
                name: "ix_group_member_permission_changes_group_member",
                table: "group_member_permission_changes",
                columns: new[] { "group_id", "member_user_id", "changed_at" });

            migrationBuilder.CreateIndex(
                name: "ix_group_member_permission_changes_member_user_id",
                table: "group_member_permission_changes",
                column: "member_user_id");

            migrationBuilder.AddForeignKey(
                name: "fk_group_member_permission_change_notification",
                table: "notifications",
                column: "permission_change_id",
                principalTable: "group_member_permission_changes",
                principalColumn: "group_member_permission_change_id",
                onDelete: ReferentialAction.SetNull);

            migrationBuilder.AddForeignKey(
                name: "fk_transaction_notification",
                table: "notifications",
                column: "transaction_id",
                principalTable: "transactions",
                principalColumn: "transaction_id",
                onDelete: ReferentialAction.SetNull);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropForeignKey(
                name: "fk_group_member_permission_change_notification",
                table: "notifications");

            migrationBuilder.DropForeignKey(
                name: "fk_transaction_notification",
                table: "notifications");

            migrationBuilder.DropTable(
                name: "group_member_permission_changes");

            migrationBuilder.DropIndex(
                name: "ix_notifications_permission_change_id",
                table: "notifications");

            migrationBuilder.DropIndex(
                name: "ix_notifications_transaction_id",
                table: "notifications");

            migrationBuilder.DropColumn(
                name: "permission_change_id",
                table: "notifications");

            migrationBuilder.DropColumn(
                name: "transaction_id",
                table: "notifications");

            migrationBuilder.DropColumn(
                name: "can_create_transactions",
                table: "group_members");

            migrationBuilder.DropColumn(
                name: "can_reverse",
                table: "group_members");
        }
    }
}
