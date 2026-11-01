using System;
using Microsoft.EntityFrameworkCore.Migrations;
using Npgsql.EntityFrameworkCore.PostgreSQL.Metadata;

#nullable disable

namespace Finami.Infra.Migrations
{
    /// <inheritdoc />
    public partial class AddBtcQuotes : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.CreateTable(
                name: "btc_quotes",
                columns: table => new
                {
                    btc_quote_id = table.Column<long>(type: "bigint", nullable: false)
                        .Annotation("Npgsql:ValueGenerationStrategy", NpgsqlValueGenerationStrategy.IdentityByDefaultColumn),
                    price_brl = table.Column<decimal>(type: "numeric(20,8)", nullable: false),
                    quoted_at = table.Column<DateTime>(type: "timestamp without time zone", nullable: false),
                    fetched_at = table.Column<DateTime>(type: "timestamp without time zone", nullable: false),
                    source = table.Column<string>(type: "character varying(40)", maxLength: 40, nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("btc_quotes_pkey", x => x.btc_quote_id);
                });

            migrationBuilder.CreateIndex(
                name: "IX_transactions_btc_quote_id",
                table: "transactions",
                column: "btc_quote_id");

            migrationBuilder.CreateIndex(
                name: "ix_btc_quotes_quoted_at",
                table: "btc_quotes",
                column: "quoted_at");

            migrationBuilder.AddForeignKey(
                name: "fk_btc_quote_transaction",
                table: "transactions",
                column: "btc_quote_id",
                principalTable: "btc_quotes",
                principalColumn: "btc_quote_id");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropForeignKey(
                name: "fk_btc_quote_transaction",
                table: "transactions");

            migrationBuilder.DropTable(
                name: "btc_quotes");

            migrationBuilder.DropIndex(
                name: "IX_transactions_btc_quote_id",
                table: "transactions");
        }
    }
}
