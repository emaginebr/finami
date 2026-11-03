using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Finami.Infra.Migrations
{
    /// <summary>
    /// Feature 006 (R-11): os índices de source_account_id/destination_account_id já existiam, criados pela
    /// convenção de FK do EF em AddWalletsAndLedger com o nome "IX_..."; aqui passam a ter nome explícito em
    /// snake_case (Princípio V). Só renomeia, sem recriar.
    /// </summary>
    public partial class AddTransactionAccountIndexes : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.RenameIndex(
                name: "IX_transactions_source_account_id",
                table: "transactions",
                newName: "ix_transactions_source_account_id");

            migrationBuilder.RenameIndex(
                name: "IX_transactions_destination_account_id",
                table: "transactions",
                newName: "ix_transactions_destination_account_id");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.RenameIndex(
                name: "ix_transactions_source_account_id",
                table: "transactions",
                newName: "IX_transactions_source_account_id");

            migrationBuilder.RenameIndex(
                name: "ix_transactions_destination_account_id",
                table: "transactions",
                newName: "IX_transactions_destination_account_id");
        }
    }
}
