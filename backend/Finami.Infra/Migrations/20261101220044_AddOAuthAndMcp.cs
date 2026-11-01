using System;
using Microsoft.EntityFrameworkCore.Migrations;
using Npgsql.EntityFrameworkCore.PostgreSQL.Metadata;

#nullable disable

namespace Finami.Infra.Migrations
{
    /// <inheritdoc />
    public partial class AddOAuthAndMcp : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.CreateTable(
                name: "mcp_idempotency_keys",
                columns: table => new
                {
                    mcp_idempotency_key_id = table.Column<long>(type: "bigint", nullable: false)
                        .Annotation("Npgsql:ValueGenerationStrategy", NpgsqlValueGenerationStrategy.IdentityByDefaultColumn),
                    user_id = table.Column<long>(type: "bigint", nullable: false),
                    tool_name = table.Column<string>(type: "character varying(80)", maxLength: 80, nullable: false),
                    idempotency_key = table.Column<string>(type: "character varying(64)", maxLength: 64, nullable: false),
                    status = table.Column<int>(type: "integer", nullable: false, defaultValue: 1),
                    result_json = table.Column<string>(type: "text", nullable: true),
                    created_at = table.Column<DateTime>(type: "timestamp without time zone", nullable: false, defaultValueSql: "(now() at time zone 'utc')")
                },
                constraints: table =>
                {
                    table.PrimaryKey("mcp_idempotency_keys_pkey", x => x.mcp_idempotency_key_id);
                    table.ForeignKey(
                        name: "fk_user_mcp_idempotency_key",
                        column: x => x.user_id,
                        principalTable: "users",
                        principalColumn: "user_id");
                });

            migrationBuilder.CreateTable(
                name: "oauth_clients",
                columns: table => new
                {
                    oauth_client_id = table.Column<long>(type: "bigint", nullable: false)
                        .Annotation("Npgsql:ValueGenerationStrategy", NpgsqlValueGenerationStrategy.IdentityByDefaultColumn),
                    client_id = table.Column<string>(type: "character varying(64)", maxLength: 64, nullable: false),
                    client_secret_hash = table.Column<string>(type: "character varying(64)", maxLength: 64, nullable: true),
                    client_name = table.Column<string>(type: "character varying(120)", maxLength: 120, nullable: false),
                    redirect_uris = table.Column<string>(type: "character varying(2000)", maxLength: 2000, nullable: false),
                    auth_method = table.Column<int>(type: "integer", nullable: false),
                    is_dynamic = table.Column<bool>(type: "boolean", nullable: false, defaultValue: true),
                    created_at = table.Column<DateTime>(type: "timestamp without time zone", nullable: false, defaultValueSql: "(now() at time zone 'utc')")
                },
                constraints: table =>
                {
                    table.PrimaryKey("oauth_clients_pkey", x => x.oauth_client_id);
                });

            migrationBuilder.CreateTable(
                name: "oauth_grants",
                columns: table => new
                {
                    oauth_grant_id = table.Column<long>(type: "bigint", nullable: false)
                        .Annotation("Npgsql:ValueGenerationStrategy", NpgsqlValueGenerationStrategy.IdentityByDefaultColumn),
                    user_id = table.Column<long>(type: "bigint", nullable: false),
                    oauth_client_id = table.Column<long>(type: "bigint", nullable: false),
                    scopes = table.Column<string>(type: "character varying(200)", maxLength: 200, nullable: false),
                    status = table.Column<int>(type: "integer", nullable: false, defaultValue: 1),
                    created_at = table.Column<DateTime>(type: "timestamp without time zone", nullable: false, defaultValueSql: "(now() at time zone 'utc')"),
                    updated_at = table.Column<DateTime>(type: "timestamp without time zone", nullable: false, defaultValueSql: "(now() at time zone 'utc')"),
                    last_used_at = table.Column<DateTime>(type: "timestamp without time zone", nullable: true),
                    revoked_at = table.Column<DateTime>(type: "timestamp without time zone", nullable: true),
                    revoke_reason = table.Column<int>(type: "integer", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("oauth_grants_pkey", x => x.oauth_grant_id);
                    table.ForeignKey(
                        name: "fk_oauth_client_oauth_grant",
                        column: x => x.oauth_client_id,
                        principalTable: "oauth_clients",
                        principalColumn: "oauth_client_id");
                    table.ForeignKey(
                        name: "fk_user_oauth_grant",
                        column: x => x.user_id,
                        principalTable: "users",
                        principalColumn: "user_id");
                });

            migrationBuilder.CreateTable(
                name: "mcp_audit_logs",
                columns: table => new
                {
                    mcp_audit_log_id = table.Column<long>(type: "bigint", nullable: false)
                        .Annotation("Npgsql:ValueGenerationStrategy", NpgsqlValueGenerationStrategy.IdentityByDefaultColumn),
                    user_id = table.Column<long>(type: "bigint", nullable: false),
                    oauth_grant_id = table.Column<long>(type: "bigint", nullable: false),
                    tool_name = table.Column<string>(type: "character varying(80)", maxLength: 80, nullable: false),
                    outcome = table.Column<string>(type: "character varying(40)", maxLength: 40, nullable: false),
                    target_id = table.Column<long>(type: "bigint", nullable: true),
                    created_at = table.Column<DateTime>(type: "timestamp without time zone", nullable: false, defaultValueSql: "(now() at time zone 'utc')")
                },
                constraints: table =>
                {
                    table.PrimaryKey("mcp_audit_logs_pkey", x => x.mcp_audit_log_id);
                    table.ForeignKey(
                        name: "fk_oauth_grant_mcp_audit_log",
                        column: x => x.oauth_grant_id,
                        principalTable: "oauth_grants",
                        principalColumn: "oauth_grant_id");
                    table.ForeignKey(
                        name: "fk_user_mcp_audit_log",
                        column: x => x.user_id,
                        principalTable: "users",
                        principalColumn: "user_id");
                });

            migrationBuilder.CreateTable(
                name: "oauth_authorization_requests",
                columns: table => new
                {
                    oauth_authorization_request_id = table.Column<long>(type: "bigint", nullable: false)
                        .Annotation("Npgsql:ValueGenerationStrategy", NpgsqlValueGenerationStrategy.IdentityByDefaultColumn),
                    request_key = table.Column<string>(type: "character varying(64)", maxLength: 64, nullable: false),
                    oauth_client_id = table.Column<long>(type: "bigint", nullable: false),
                    redirect_uri = table.Column<string>(type: "character varying(500)", maxLength: 500, nullable: false),
                    scopes_requested = table.Column<string>(type: "character varying(200)", maxLength: 200, nullable: false),
                    state = table.Column<string>(type: "character varying(500)", maxLength: 500, nullable: true),
                    code_challenge = table.Column<string>(type: "character varying(128)", maxLength: 128, nullable: false),
                    resource = table.Column<string>(type: "character varying(500)", maxLength: 500, nullable: false),
                    status = table.Column<int>(type: "integer", nullable: false, defaultValue: 1),
                    user_id = table.Column<long>(type: "bigint", nullable: true),
                    oauth_grant_id = table.Column<long>(type: "bigint", nullable: true),
                    code_hash = table.Column<string>(type: "character varying(64)", maxLength: 64, nullable: true),
                    created_at = table.Column<DateTime>(type: "timestamp without time zone", nullable: false, defaultValueSql: "(now() at time zone 'utc')"),
                    expires_at = table.Column<DateTime>(type: "timestamp without time zone", nullable: false),
                    redeemed_at = table.Column<DateTime>(type: "timestamp without time zone", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("oauth_authorization_requests_pkey", x => x.oauth_authorization_request_id);
                    table.ForeignKey(
                        name: "fk_oauth_client_oauth_authorization_request",
                        column: x => x.oauth_client_id,
                        principalTable: "oauth_clients",
                        principalColumn: "oauth_client_id");
                    table.ForeignKey(
                        name: "fk_oauth_grant_oauth_authorization_request",
                        column: x => x.oauth_grant_id,
                        principalTable: "oauth_grants",
                        principalColumn: "oauth_grant_id");
                    table.ForeignKey(
                        name: "fk_user_oauth_authorization_request",
                        column: x => x.user_id,
                        principalTable: "users",
                        principalColumn: "user_id");
                });

            migrationBuilder.CreateTable(
                name: "oauth_tokens",
                columns: table => new
                {
                    oauth_token_id = table.Column<long>(type: "bigint", nullable: false)
                        .Annotation("Npgsql:ValueGenerationStrategy", NpgsqlValueGenerationStrategy.IdentityByDefaultColumn),
                    oauth_grant_id = table.Column<long>(type: "bigint", nullable: false),
                    token_type = table.Column<int>(type: "integer", nullable: false),
                    token_hash = table.Column<string>(type: "character varying(64)", maxLength: 64, nullable: false),
                    scopes = table.Column<string>(type: "character varying(200)", maxLength: 200, nullable: false),
                    parent_token_id = table.Column<long>(type: "bigint", nullable: true),
                    created_at = table.Column<DateTime>(type: "timestamp without time zone", nullable: false, defaultValueSql: "(now() at time zone 'utc')"),
                    expires_at = table.Column<DateTime>(type: "timestamp without time zone", nullable: false),
                    used_at = table.Column<DateTime>(type: "timestamp without time zone", nullable: true),
                    revoked_at = table.Column<DateTime>(type: "timestamp without time zone", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("oauth_tokens_pkey", x => x.oauth_token_id);
                    table.ForeignKey(
                        name: "fk_oauth_grant_oauth_token",
                        column: x => x.oauth_grant_id,
                        principalTable: "oauth_grants",
                        principalColumn: "oauth_grant_id");
                    table.ForeignKey(
                        name: "fk_oauth_token_parent",
                        column: x => x.parent_token_id,
                        principalTable: "oauth_tokens",
                        principalColumn: "oauth_token_id");
                });

            migrationBuilder.CreateIndex(
                name: "ix_mcp_audit_logs_oauth_grant_id",
                table: "mcp_audit_logs",
                column: "oauth_grant_id");

            migrationBuilder.CreateIndex(
                name: "ix_mcp_audit_logs_user_id_created_at",
                table: "mcp_audit_logs",
                columns: new[] { "user_id", "created_at" },
                descending: new[] { false, true });

            migrationBuilder.CreateIndex(
                name: "ix_mcp_idempotency_keys_created_at",
                table: "mcp_idempotency_keys",
                column: "created_at");

            migrationBuilder.CreateIndex(
                name: "ix_mcp_idempotency_keys_user_tool_key",
                table: "mcp_idempotency_keys",
                columns: new[] { "user_id", "tool_name", "idempotency_key" },
                unique: true);

            migrationBuilder.CreateIndex(
                name: "ix_oauth_authorization_requests_code_hash",
                table: "oauth_authorization_requests",
                column: "code_hash",
                unique: true,
                filter: "code_hash IS NOT NULL");

            migrationBuilder.CreateIndex(
                name: "ix_oauth_authorization_requests_expires_at",
                table: "oauth_authorization_requests",
                column: "expires_at");

            migrationBuilder.CreateIndex(
                name: "ix_oauth_authorization_requests_oauth_client_id",
                table: "oauth_authorization_requests",
                column: "oauth_client_id");

            migrationBuilder.CreateIndex(
                name: "ix_oauth_authorization_requests_oauth_grant_id",
                table: "oauth_authorization_requests",
                column: "oauth_grant_id");

            migrationBuilder.CreateIndex(
                name: "ix_oauth_authorization_requests_request_key",
                table: "oauth_authorization_requests",
                column: "request_key",
                unique: true);

            migrationBuilder.CreateIndex(
                name: "ix_oauth_authorization_requests_user_id",
                table: "oauth_authorization_requests",
                column: "user_id");

            migrationBuilder.CreateIndex(
                name: "ix_oauth_clients_client_id",
                table: "oauth_clients",
                column: "client_id",
                unique: true);

            migrationBuilder.CreateIndex(
                name: "ix_oauth_grants_active",
                table: "oauth_grants",
                columns: new[] { "user_id", "oauth_client_id" },
                unique: true,
                filter: "status = 1");

            migrationBuilder.CreateIndex(
                name: "ix_oauth_grants_oauth_client_id",
                table: "oauth_grants",
                column: "oauth_client_id");

            migrationBuilder.CreateIndex(
                name: "ix_oauth_grants_user_id_status",
                table: "oauth_grants",
                columns: new[] { "user_id", "status" });

            migrationBuilder.CreateIndex(
                name: "ix_oauth_tokens_expires_at",
                table: "oauth_tokens",
                column: "expires_at");

            migrationBuilder.CreateIndex(
                name: "ix_oauth_tokens_oauth_grant_id",
                table: "oauth_tokens",
                column: "oauth_grant_id");

            migrationBuilder.CreateIndex(
                name: "ix_oauth_tokens_parent_token_id",
                table: "oauth_tokens",
                column: "parent_token_id");

            migrationBuilder.CreateIndex(
                name: "ix_oauth_tokens_token_hash",
                table: "oauth_tokens",
                column: "token_hash",
                unique: true);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "mcp_audit_logs");

            migrationBuilder.DropTable(
                name: "mcp_idempotency_keys");

            migrationBuilder.DropTable(
                name: "oauth_authorization_requests");

            migrationBuilder.DropTable(
                name: "oauth_tokens");

            migrationBuilder.DropTable(
                name: "oauth_grants");

            migrationBuilder.DropTable(
                name: "oauth_clients");
        }
    }
}
