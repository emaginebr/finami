using System;
using Microsoft.EntityFrameworkCore.Migrations;
using Npgsql.EntityFrameworkCore.PostgreSQL.Metadata;

#nullable disable

#pragma warning disable CA1814 // Prefer jagged arrays over multidimensional

namespace Finami.Infra.Migrations
{
    /// <inheritdoc />
    public partial class AddWalletsAndLedger : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.CreateTable(
                name: "accounts",
                columns: table => new
                {
                    account_id = table.Column<long>(type: "bigint", nullable: false)
                        .Annotation("Npgsql:IdentitySequenceOptions", "'100', '1', '', '', 'False', '1'")
                        .Annotation("Npgsql:ValueGenerationStrategy", NpgsqlValueGenerationStrategy.IdentityByDefaultColumn),
                    kind = table.Column<int>(type: "integer", nullable: false, defaultValue: 1),
                    user_id = table.Column<long>(type: "bigint", nullable: true),
                    group_id = table.Column<long>(type: "bigint", nullable: true),
                    name = table.Column<string>(type: "character varying(120)", maxLength: 120, nullable: false),
                    description = table.Column<string>(type: "character varying(500)", maxLength: 500, nullable: true),
                    currency = table.Column<int>(type: "integer", nullable: false),
                    is_virtual = table.Column<bool>(type: "boolean", nullable: false, defaultValue: false),
                    is_active = table.Column<bool>(type: "boolean", nullable: false, defaultValue: true),
                    created_by_user_id = table.Column<long>(type: "bigint", nullable: true),
                    created_at = table.Column<DateTime>(type: "timestamp without time zone", nullable: false, defaultValueSql: "(now() at time zone 'utc')")
                },
                constraints: table =>
                {
                    table.PrimaryKey("accounts_pkey", x => x.account_id);
                    table.CheckConstraint("ck_accounts_owner", "(kind = 1 AND user_id IS NOT NULL) OR (kind <> 1 AND user_id IS NULL AND group_id IS NULL)");
                    table.ForeignKey(
                        name: "fk_user_account",
                        column: x => x.user_id,
                        principalTable: "users",
                        principalColumn: "user_id");
                    table.ForeignKey(
                        name: "fk_user_account_creator",
                        column: x => x.created_by_user_id,
                        principalTable: "users",
                        principalColumn: "user_id");
                });

            migrationBuilder.CreateTable(
                name: "transactions",
                columns: table => new
                {
                    transaction_id = table.Column<long>(type: "bigint", nullable: false)
                        .Annotation("Npgsql:ValueGenerationStrategy", NpgsqlValueGenerationStrategy.IdentityByDefaultColumn),
                    type = table.Column<int>(type: "integer", nullable: false),
                    source_account_id = table.Column<long>(type: "bigint", nullable: false),
                    destination_account_id = table.Column<long>(type: "bigint", nullable: false),
                    source_amount = table.Column<decimal>(type: "numeric(20,8)", nullable: false),
                    destination_amount = table.Column<decimal>(type: "numeric(20,8)", nullable: false),
                    btc_quote_id = table.Column<long>(type: "bigint", nullable: true),
                    quote_price_brl = table.Column<decimal>(type: "numeric(20,8)", nullable: true),
                    description = table.Column<string>(type: "character varying(500)", maxLength: 500, nullable: true),
                    occurred_at = table.Column<DateTime>(type: "timestamp without time zone", nullable: false),
                    created_by_user_id = table.Column<long>(type: "bigint", nullable: false),
                    reversed_transaction_id = table.Column<long>(type: "bigint", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("transactions_pkey", x => x.transaction_id);
                    table.ForeignKey(
                        name: "fk_account_transaction_destination",
                        column: x => x.destination_account_id,
                        principalTable: "accounts",
                        principalColumn: "account_id");
                    table.ForeignKey(
                        name: "fk_account_transaction_source",
                        column: x => x.source_account_id,
                        principalTable: "accounts",
                        principalColumn: "account_id");
                    table.ForeignKey(
                        name: "fk_transaction_reversal",
                        column: x => x.reversed_transaction_id,
                        principalTable: "transactions",
                        principalColumn: "transaction_id");
                    table.ForeignKey(
                        name: "fk_user_transaction",
                        column: x => x.created_by_user_id,
                        principalTable: "users",
                        principalColumn: "user_id");
                });

            migrationBuilder.CreateTable(
                name: "ledger_entries",
                columns: table => new
                {
                    ledger_entry_id = table.Column<long>(type: "bigint", nullable: false)
                        .Annotation("Npgsql:ValueGenerationStrategy", NpgsqlValueGenerationStrategy.IdentityByDefaultColumn),
                    transaction_id = table.Column<long>(type: "bigint", nullable: false),
                    account_id = table.Column<long>(type: "bigint", nullable: false),
                    amount = table.Column<decimal>(type: "numeric(20,8)", nullable: false),
                    currency = table.Column<int>(type: "integer", nullable: false),
                    occurred_at = table.Column<DateTime>(type: "timestamp without time zone", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("ledger_entries_pkey", x => x.ledger_entry_id);
                    table.ForeignKey(
                        name: "fk_account_ledger_entry",
                        column: x => x.account_id,
                        principalTable: "accounts",
                        principalColumn: "account_id");
                    table.ForeignKey(
                        name: "fk_transaction_ledger_entry",
                        column: x => x.transaction_id,
                        principalTable: "transactions",
                        principalColumn: "transaction_id");
                });

            migrationBuilder.InsertData(
                table: "accounts",
                columns: new[] { "account_id", "created_at", "created_by_user_id", "currency", "description", "group_id", "is_active", "kind", "name", "user_id" },
                values: new object[,]
                {
                    { 1L, new DateTime(2026, 1, 1, 0, 0, 0, 0, DateTimeKind.Unspecified), null, 1, null, null, true, 2, "Origem externa (BRL)", null },
                    { 2L, new DateTime(2026, 1, 1, 0, 0, 0, 0, DateTimeKind.Unspecified), null, 1, null, null, true, 3, "Destino externo (BRL)", null },
                    { 3L, new DateTime(2026, 1, 1, 0, 0, 0, 0, DateTimeKind.Unspecified), null, 1, null, null, true, 4, "Câmbio (BRL)", null },
                    { 4L, new DateTime(2026, 1, 1, 0, 0, 0, 0, DateTimeKind.Unspecified), null, 2, null, null, true, 2, "Origem externa (BTC)", null },
                    { 5L, new DateTime(2026, 1, 1, 0, 0, 0, 0, DateTimeKind.Unspecified), null, 2, null, null, true, 3, "Destino externo (BTC)", null },
                    { 6L, new DateTime(2026, 1, 1, 0, 0, 0, 0, DateTimeKind.Unspecified), null, 2, null, null, true, 4, "Câmbio (BTC)", null }
                });

            migrationBuilder.CreateIndex(
                name: "IX_accounts_created_by_user_id",
                table: "accounts",
                column: "created_by_user_id");

            migrationBuilder.CreateIndex(
                name: "ix_accounts_group_id",
                table: "accounts",
                column: "group_id");

            migrationBuilder.CreateIndex(
                name: "ix_accounts_user_id",
                table: "accounts",
                column: "user_id");

            migrationBuilder.CreateIndex(
                name: "ix_ledger_entries_account_occurred",
                table: "ledger_entries",
                columns: new[] { "account_id", "occurred_at" });

            migrationBuilder.CreateIndex(
                name: "IX_ledger_entries_transaction_id",
                table: "ledger_entries",
                column: "transaction_id");

            migrationBuilder.CreateIndex(
                name: "IX_transactions_created_by_user_id",
                table: "transactions",
                column: "created_by_user_id");

            migrationBuilder.CreateIndex(
                name: "IX_transactions_destination_account_id",
                table: "transactions",
                column: "destination_account_id");

            migrationBuilder.CreateIndex(
                name: "ix_transactions_occurred_at",
                table: "transactions",
                column: "occurred_at");

            migrationBuilder.CreateIndex(
                name: "ix_transactions_reversed_transaction_id",
                table: "transactions",
                column: "reversed_transaction_id",
                unique: true,
                filter: "reversed_transaction_id IS NOT NULL");

            migrationBuilder.CreateIndex(
                name: "IX_transactions_source_account_id",
                table: "transactions",
                column: "source_account_id");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "ledger_entries");

            migrationBuilder.DropTable(
                name: "transactions");

            migrationBuilder.DropTable(
                name: "accounts");
        }
    }
}
