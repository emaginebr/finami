using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Finami.Infra.Migrations
{
    /// <summary>
    /// Feature 007 (R-01/R-02): tipo da transferência e efeito na dívida em transactions. O backfill marca como
    /// empréstimo as transferências (e estornos) entre carteiras de titulares diferentes na mesma moeda, com o mesmo
    /// filtro do cálculo de dívidas da feature 006, para que as dívidas exibidas não mudem (SC-002).
    /// </summary>
    public partial class AddTransferKindAndDebt : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<decimal>(
                name: "debt_amount",
                table: "transactions",
                type: "numeric(20,8)",
                nullable: true);

            migrationBuilder.AddColumn<short>(
                name: "debt_currency",
                table: "transactions",
                type: "smallint",
                nullable: true);

            migrationBuilder.AddColumn<short>(
                name: "transfer_kind",
                table: "transactions",
                type: "smallint",
                nullable: true);

            // Backfill (data-model.md): kind 1 = Wallet; transfer_kind 1 = Loan.
            migrationBuilder.Sql(@"
UPDATE transactions t
SET transfer_kind = 1, debt_currency = s.currency, debt_amount = t.source_amount
FROM accounts s, accounts d
WHERE s.account_id = t.source_account_id AND d.account_id = t.destination_account_id
  AND s.kind = 1 AND d.kind = 1
  AND s.currency = d.currency
  AND s.user_id IS NOT NULL AND d.user_id IS NOT NULL AND s.user_id <> d.user_id;");

            migrationBuilder.AddCheckConstraint(
                name: "ck_transactions_debt_effect",
                table: "transactions",
                sql: "(debt_currency IS NULL) = (debt_amount IS NULL) AND (debt_amount IS NULL OR debt_amount > 0)");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropCheckConstraint(
                name: "ck_transactions_debt_effect",
                table: "transactions");

            migrationBuilder.DropColumn(
                name: "debt_amount",
                table: "transactions");

            migrationBuilder.DropColumn(
                name: "debt_currency",
                table: "transactions");

            migrationBuilder.DropColumn(
                name: "transfer_kind",
                table: "transactions");
        }
    }
}
