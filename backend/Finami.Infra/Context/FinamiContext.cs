using Finami.Domain.Enums;
using Finami.Domain.Models;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Storage.ValueConversion;

namespace Finami.Infra.Context;

public class FinamiContext : DbContext
{
    /// <summary>Índice único parcial de convites pendentes; a violação vira 409 (research R-04).</summary>
    public const string GROUP_INVITATIONS_PENDING_INDEX = "ix_group_invitations_pending";

    /// <summary>Uma conexão OAuth ativa por pessoa e assistente (feature 004).</summary>
    public const string OAUTH_GRANTS_ACTIVE_INDEX = "ix_oauth_grants_active";

    /// <summary>Chave de repetição única por pessoa e ferramenta (research R-08).</summary>
    public const string MCP_IDEMPOTENCY_KEYS_UNIQUE_INDEX = "ix_mcp_idempotency_keys_user_tool_key";

    public FinamiContext(DbContextOptions<FinamiContext> options) : base(options)
    {
    }

    public DbSet<User> Users => Set<User>();
    public DbSet<Account> Accounts => Set<Account>();
    public DbSet<Transaction> Transactions => Set<Transaction>();
    public DbSet<LedgerEntry> LedgerEntries => Set<LedgerEntry>();
    public DbSet<BtcQuote> BtcQuotes => Set<BtcQuote>();
    public DbSet<Group> Groups => Set<Group>();
    public DbSet<GroupMember> GroupMembers => Set<GroupMember>();
    public DbSet<GroupInvitation> GroupInvitations => Set<GroupInvitation>();
    public DbSet<Notification> Notifications => Set<Notification>();
    public DbSet<OAuthClient> OAuthClients => Set<OAuthClient>();
    public DbSet<OAuthGrant> OAuthGrants => Set<OAuthGrant>();
    public DbSet<OAuthAuthorizationRequest> OAuthAuthorizationRequests => Set<OAuthAuthorizationRequest>();
    public DbSet<OAuthToken> OAuthTokens => Set<OAuthToken>();
    public DbSet<McpIdempotencyKey> McpIdempotencyKeys => Set<McpIdempotencyKey>();
    public DbSet<McpAuditLog> McpAuditLogs => Set<McpAuditLog>();

    protected override void ConfigureConventions(ModelConfigurationBuilder configurationBuilder)
    {
        // Princípio V: timestamp without time zone, sempre gravado e lido como UTC (research R-14).
        configurationBuilder.Properties<DateTime>()
            .HaveConversion<UtcDateTimeConverter>()
            .HaveColumnType("timestamp without time zone");
        configurationBuilder.Properties<DateTime?>()
            .HaveConversion<NullableUtcDateTimeConverter>()
            .HaveColumnType("timestamp without time zone");
    }

    protected override void OnModelCreating(ModelBuilder modelBuilder)
    {
        base.OnModelCreating(modelBuilder);
        ConfigureUsers(modelBuilder);
        ConfigureAccounts(modelBuilder);
        ConfigureTransactions(modelBuilder);
        ConfigureLedgerEntries(modelBuilder);
        ConfigureBtcQuotes(modelBuilder);
        ConfigureGroups(modelBuilder);
        ConfigureGroupInvitations(modelBuilder);
        ConfigureNotifications(modelBuilder);
        ConfigureOAuth(modelBuilder);
        ConfigureMcp(modelBuilder);
    }

    private static void ConfigureOAuth(ModelBuilder modelBuilder)
    {
        modelBuilder.Entity<OAuthClient>(entity =>
        {
            entity.ToTable("oauth_clients");
            entity.HasKey(e => e.OAuthClientId).HasName("oauth_clients_pkey");
            entity.Property(e => e.OAuthClientId).HasColumnName("oauth_client_id").UseIdentityByDefaultColumn();
            entity.Property(e => e.ClientId).HasColumnName("client_id").HasMaxLength(64).IsRequired();
            entity.Property(e => e.ClientSecretHash).HasColumnName("client_secret_hash").HasMaxLength(64);
            entity.Property(e => e.ClientName).HasColumnName("client_name").HasMaxLength(120).IsRequired();
            entity.Property(e => e.RedirectUris).HasColumnName("redirect_uris").HasMaxLength(2000).IsRequired();
            entity.Property(e => e.AuthMethod).HasColumnName("auth_method").HasConversion<int>();
            entity.Property(e => e.IsDynamic).HasColumnName("is_dynamic").HasDefaultValue(true).HasSentinel(true);
            entity.Property(e => e.CreatedAt).HasColumnName("created_at").HasDefaultValueSql("(now() at time zone 'utc')");
            entity.Ignore(e => e.RequiresSecret);

            entity.HasIndex(e => e.ClientId).IsUnique().HasDatabaseName("ix_oauth_clients_client_id");
        });

        modelBuilder.Entity<OAuthGrant>(entity =>
        {
            entity.ToTable("oauth_grants");
            entity.HasKey(e => e.OAuthGrantId).HasName("oauth_grants_pkey");
            entity.Property(e => e.OAuthGrantId).HasColumnName("oauth_grant_id").UseIdentityByDefaultColumn();
            entity.Property(e => e.UserId).HasColumnName("user_id");
            entity.Property(e => e.OAuthClientId).HasColumnName("oauth_client_id");
            entity.Property(e => e.Scopes).HasColumnName("scopes").HasMaxLength(200).IsRequired();
            entity.Property(e => e.Status).HasColumnName("status").HasConversion<int>()
                .HasDefaultValue(OAuthGrantStatus.Active).HasSentinel((OAuthGrantStatus)0);
            entity.Property(e => e.CreatedAt).HasColumnName("created_at").HasDefaultValueSql("(now() at time zone 'utc')");
            entity.Property(e => e.UpdatedAt).HasColumnName("updated_at").HasDefaultValueSql("(now() at time zone 'utc')");
            entity.Property(e => e.LastUsedAt).HasColumnName("last_used_at");
            entity.Property(e => e.RevokedAt).HasColumnName("revoked_at");
            entity.Property(e => e.RevokeReason).HasColumnName("revoke_reason").HasConversion<int?>();
            entity.Ignore(e => e.IsActive);
            entity.Ignore(e => e.ScopeList);

            entity.HasOne<User>().WithMany().HasForeignKey(e => e.UserId)
                .HasConstraintName("fk_user_oauth_grant").OnDelete(DeleteBehavior.ClientSetNull);
            entity.HasOne(e => e.Client).WithMany().HasForeignKey(e => e.OAuthClientId)
                .HasConstraintName("fk_oauth_client_oauth_grant").OnDelete(DeleteBehavior.ClientSetNull);

            // Uma conexão ativa por pessoa e assistente.
            entity.HasIndex(e => new { e.UserId, e.OAuthClientId }).IsUnique()
                .HasFilter("status = 1").HasDatabaseName(OAUTH_GRANTS_ACTIVE_INDEX);
            entity.HasIndex(e => new { e.UserId, e.Status }).HasDatabaseName("ix_oauth_grants_user_id_status");
            entity.HasIndex(e => e.OAuthClientId).HasDatabaseName("ix_oauth_grants_oauth_client_id");
        });

        modelBuilder.Entity<OAuthAuthorizationRequest>(entity =>
        {
            entity.ToTable("oauth_authorization_requests");
            entity.HasKey(e => e.OAuthAuthorizationRequestId).HasName("oauth_authorization_requests_pkey");
            entity.Property(e => e.OAuthAuthorizationRequestId).HasColumnName("oauth_authorization_request_id")
                .UseIdentityByDefaultColumn();
            entity.Property(e => e.RequestKey).HasColumnName("request_key").HasMaxLength(64).IsRequired();
            entity.Property(e => e.OAuthClientId).HasColumnName("oauth_client_id");
            entity.Property(e => e.RedirectUri).HasColumnName("redirect_uri").HasMaxLength(500).IsRequired();
            entity.Property(e => e.ScopesRequested).HasColumnName("scopes_requested").HasMaxLength(200).IsRequired();
            entity.Property(e => e.State).HasColumnName("state").HasMaxLength(500);
            entity.Property(e => e.CodeChallenge).HasColumnName("code_challenge").HasMaxLength(128).IsRequired();
            entity.Property(e => e.Resource).HasColumnName("resource").HasMaxLength(500).IsRequired();
            entity.Property(e => e.Status).HasColumnName("status").HasConversion<int>()
                .HasDefaultValue(OAuthRequestStatus.Pending).HasSentinel((OAuthRequestStatus)0);
            entity.Property(e => e.UserId).HasColumnName("user_id");
            entity.Property(e => e.OAuthGrantId).HasColumnName("oauth_grant_id");
            entity.Property(e => e.CodeHash).HasColumnName("code_hash").HasMaxLength(64);
            entity.Property(e => e.CreatedAt).HasColumnName("created_at").HasDefaultValueSql("(now() at time zone 'utc')");
            entity.Property(e => e.ExpiresAt).HasColumnName("expires_at");
            entity.Property(e => e.RedeemedAt).HasColumnName("redeemed_at");
            entity.Ignore(e => e.ScopeList);

            entity.HasOne(e => e.Client).WithMany().HasForeignKey(e => e.OAuthClientId)
                .HasConstraintName("fk_oauth_client_oauth_authorization_request").OnDelete(DeleteBehavior.ClientSetNull);
            entity.HasOne<User>().WithMany().HasForeignKey(e => e.UserId)
                .HasConstraintName("fk_user_oauth_authorization_request").OnDelete(DeleteBehavior.ClientSetNull);
            entity.HasOne<OAuthGrant>().WithMany().HasForeignKey(e => e.OAuthGrantId)
                .HasConstraintName("fk_oauth_grant_oauth_authorization_request").OnDelete(DeleteBehavior.ClientSetNull);

            entity.HasIndex(e => e.RequestKey).IsUnique().HasDatabaseName("ix_oauth_authorization_requests_request_key");
            entity.HasIndex(e => e.CodeHash).IsUnique().HasFilter("code_hash IS NOT NULL")
                .HasDatabaseName("ix_oauth_authorization_requests_code_hash");
            entity.HasIndex(e => e.OAuthClientId).HasDatabaseName("ix_oauth_authorization_requests_oauth_client_id");
            entity.HasIndex(e => e.UserId).HasDatabaseName("ix_oauth_authorization_requests_user_id");
            entity.HasIndex(e => e.OAuthGrantId).HasDatabaseName("ix_oauth_authorization_requests_oauth_grant_id");
            entity.HasIndex(e => e.ExpiresAt).HasDatabaseName("ix_oauth_authorization_requests_expires_at");
        });

        modelBuilder.Entity<OAuthToken>(entity =>
        {
            entity.ToTable("oauth_tokens");
            entity.HasKey(e => e.OAuthTokenId).HasName("oauth_tokens_pkey");
            entity.Property(e => e.OAuthTokenId).HasColumnName("oauth_token_id").UseIdentityByDefaultColumn();
            entity.Property(e => e.OAuthGrantId).HasColumnName("oauth_grant_id");
            entity.Property(e => e.TokenType).HasColumnName("token_type").HasConversion<int>();
            entity.Property(e => e.TokenHash).HasColumnName("token_hash").HasMaxLength(64).IsRequired();
            entity.Property(e => e.Scopes).HasColumnName("scopes").HasMaxLength(200).IsRequired();
            entity.Property(e => e.ParentTokenId).HasColumnName("parent_token_id");
            entity.Property(e => e.CreatedAt).HasColumnName("created_at").HasDefaultValueSql("(now() at time zone 'utc')");
            entity.Property(e => e.ExpiresAt).HasColumnName("expires_at");
            entity.Property(e => e.UsedAt).HasColumnName("used_at");
            entity.Property(e => e.RevokedAt).HasColumnName("revoked_at");
            entity.Ignore(e => e.IsRevoked);
            entity.Ignore(e => e.IsUsed);

            entity.HasOne(e => e.Grant).WithMany().HasForeignKey(e => e.OAuthGrantId)
                .HasConstraintName("fk_oauth_grant_oauth_token").OnDelete(DeleteBehavior.ClientSetNull);
            entity.HasOne<OAuthToken>().WithMany().HasForeignKey(e => e.ParentTokenId)
                .HasConstraintName("fk_oauth_token_parent").OnDelete(DeleteBehavior.ClientSetNull);

            entity.HasIndex(e => e.TokenHash).IsUnique().HasDatabaseName("ix_oauth_tokens_token_hash");
            entity.HasIndex(e => e.OAuthGrantId).HasDatabaseName("ix_oauth_tokens_oauth_grant_id");
            entity.HasIndex(e => e.ParentTokenId).HasDatabaseName("ix_oauth_tokens_parent_token_id");
            entity.HasIndex(e => e.ExpiresAt).HasDatabaseName("ix_oauth_tokens_expires_at");
        });
    }

    private static void ConfigureMcp(ModelBuilder modelBuilder)
    {
        modelBuilder.Entity<McpIdempotencyKey>(entity =>
        {
            entity.ToTable("mcp_idempotency_keys");
            entity.HasKey(e => e.McpIdempotencyKeyId).HasName("mcp_idempotency_keys_pkey");
            entity.Property(e => e.McpIdempotencyKeyId).HasColumnName("mcp_idempotency_key_id").UseIdentityByDefaultColumn();
            entity.Property(e => e.UserId).HasColumnName("user_id");
            entity.Property(e => e.ToolName).HasColumnName("tool_name").HasMaxLength(80).IsRequired();
            entity.Property(e => e.IdempotencyKey).HasColumnName("idempotency_key").HasMaxLength(64).IsRequired();
            entity.Property(e => e.Status).HasColumnName("status").HasConversion<int>()
                .HasDefaultValue(IdempotencyStatus.InProgress).HasSentinel((IdempotencyStatus)0);
            entity.Property(e => e.ResultJson).HasColumnName("result_json").HasColumnType("text");
            entity.Property(e => e.CreatedAt).HasColumnName("created_at").HasDefaultValueSql("(now() at time zone 'utc')");

            entity.HasOne<User>().WithMany().HasForeignKey(e => e.UserId)
                .HasConstraintName("fk_user_mcp_idempotency_key").OnDelete(DeleteBehavior.ClientSetNull);

            entity.HasIndex(e => new { e.UserId, e.ToolName, e.IdempotencyKey }).IsUnique()
                .HasDatabaseName(MCP_IDEMPOTENCY_KEYS_UNIQUE_INDEX);
            entity.HasIndex(e => e.CreatedAt).HasDatabaseName("ix_mcp_idempotency_keys_created_at");
        });

        modelBuilder.Entity<McpAuditLog>(entity =>
        {
            entity.ToTable("mcp_audit_logs");
            entity.HasKey(e => e.McpAuditLogId).HasName("mcp_audit_logs_pkey");
            entity.Property(e => e.McpAuditLogId).HasColumnName("mcp_audit_log_id").UseIdentityByDefaultColumn();
            entity.Property(e => e.UserId).HasColumnName("user_id");
            entity.Property(e => e.OAuthGrantId).HasColumnName("oauth_grant_id");
            entity.Property(e => e.ToolName).HasColumnName("tool_name").HasMaxLength(80).IsRequired();
            entity.Property(e => e.Outcome).HasColumnName("outcome").HasMaxLength(40).IsRequired();
            entity.Property(e => e.TargetId).HasColumnName("target_id");
            entity.Property(e => e.CreatedAt).HasColumnName("created_at").HasDefaultValueSql("(now() at time zone 'utc')");

            entity.HasOne<User>().WithMany().HasForeignKey(e => e.UserId)
                .HasConstraintName("fk_user_mcp_audit_log").OnDelete(DeleteBehavior.ClientSetNull);
            entity.HasOne<OAuthGrant>().WithMany().HasForeignKey(e => e.OAuthGrantId)
                .HasConstraintName("fk_oauth_grant_mcp_audit_log").OnDelete(DeleteBehavior.ClientSetNull);

            entity.HasIndex(e => new { e.UserId, e.CreatedAt }).IsDescending(false, true)
                .HasDatabaseName("ix_mcp_audit_logs_user_id_created_at");
            entity.HasIndex(e => e.OAuthGrantId).HasDatabaseName("ix_mcp_audit_logs_oauth_grant_id");
        });
    }

    private static void ConfigureGroupInvitations(ModelBuilder modelBuilder)
    {
        modelBuilder.Entity<GroupInvitation>(entity =>
        {
            entity.ToTable("group_invitations");
            entity.HasKey(e => e.GroupInvitationId).HasName("group_invitations_pkey");
            entity.Property(e => e.GroupInvitationId).HasColumnName("group_invitation_id").UseIdentityByDefaultColumn();
            entity.Property(e => e.GroupId).HasColumnName("group_id");
            entity.Property(e => e.InvitedUserId).HasColumnName("invited_user_id");
            entity.Property(e => e.InvitedByUserId).HasColumnName("invited_by_user_id");
            entity.Property(e => e.Status).HasColumnName("status").HasConversion<int>()
                .HasDefaultValue(GroupInvitationStatus.Pending).HasSentinel((GroupInvitationStatus)0);
            entity.Property(e => e.CreatedAt).HasColumnName("created_at").HasDefaultValueSql("(now() at time zone 'utc')");
            entity.Property(e => e.RespondedAt).HasColumnName("responded_at");
            entity.Ignore(e => e.IsPending);

            entity.HasOne<Group>().WithMany().HasForeignKey(e => e.GroupId)
                .HasConstraintName("fk_group_group_invitation").OnDelete(DeleteBehavior.ClientSetNull);
            entity.HasOne<User>().WithMany().HasForeignKey(e => e.InvitedUserId)
                .HasConstraintName("fk_user_group_invitation_invited").OnDelete(DeleteBehavior.ClientSetNull);
            entity.HasOne<User>().WithMany().HasForeignKey(e => e.InvitedByUserId)
                .HasConstraintName("fk_user_group_invitation_inviter").OnDelete(DeleteBehavior.ClientSetNull);

            // FR-010: no máximo um convite pendente por pessoa e família.
            entity.HasIndex(e => new { e.GroupId, e.InvitedUserId }).IsUnique()
                .HasFilter("status = 1").HasDatabaseName(GROUP_INVITATIONS_PENDING_INDEX);
            entity.HasIndex(e => e.InvitedUserId).HasDatabaseName("ix_group_invitations_invited_user_id");
            entity.HasIndex(e => e.InvitedByUserId).HasDatabaseName("ix_group_invitations_invited_by_user_id");
            entity.HasIndex(e => new { e.GroupId, e.Status }).HasDatabaseName("ix_group_invitations_group_id_status");
        });
    }

    private static void ConfigureNotifications(ModelBuilder modelBuilder)
    {
        modelBuilder.Entity<Notification>(entity =>
        {
            entity.ToTable("notifications");
            entity.HasKey(e => e.NotificationId).HasName("notifications_pkey");
            entity.Property(e => e.NotificationId).HasColumnName("notification_id").UseIdentityByDefaultColumn();
            entity.Property(e => e.UserId).HasColumnName("user_id");
            entity.Property(e => e.Type).HasColumnName("type").HasConversion<int>();
            entity.Property(e => e.GroupId).HasColumnName("group_id");
            entity.Property(e => e.GroupInvitationId).HasColumnName("group_invitation_id");
            entity.Property(e => e.ActorUserId).HasColumnName("actor_user_id");
            entity.Property(e => e.CreatedAt).HasColumnName("created_at").HasDefaultValueSql("(now() at time zone 'utc')");
            entity.Property(e => e.ReadAt).HasColumnName("read_at");
            entity.Ignore(e => e.IsRead);

            entity.HasOne<User>().WithMany().HasForeignKey(e => e.UserId)
                .HasConstraintName("fk_user_notification").OnDelete(DeleteBehavior.ClientSetNull);
            entity.HasOne(e => e.Group).WithMany().HasForeignKey(e => e.GroupId)
                .HasConstraintName("fk_group_notification").OnDelete(DeleteBehavior.ClientSetNull);
            entity.HasOne(e => e.Invitation).WithMany().HasForeignKey(e => e.GroupInvitationId)
                .HasConstraintName("fk_group_invitation_notification").OnDelete(DeleteBehavior.ClientSetNull);
            entity.HasOne(e => e.Actor).WithMany().HasForeignKey(e => e.ActorUserId)
                .HasConstraintName("fk_user_notification_actor").OnDelete(DeleteBehavior.ClientSetNull);

            entity.HasIndex(e => new { e.UserId, e.NotificationId }).IsDescending(false, true)
                .HasDatabaseName("ix_notifications_user_id_notification_id");
            entity.HasIndex(e => e.UserId).HasFilter("read_at IS NULL").HasDatabaseName("ix_notifications_unread");
            entity.HasIndex(e => e.GroupId).HasDatabaseName("ix_notifications_group_id");
            entity.HasIndex(e => e.GroupInvitationId).HasDatabaseName("ix_notifications_group_invitation_id");
            entity.HasIndex(e => e.ActorUserId).HasDatabaseName("ix_notifications_actor_user_id");
        });
    }

    private static void ConfigureGroups(ModelBuilder modelBuilder)
    {
        modelBuilder.Entity<Group>(entity =>
        {
            entity.ToTable("groups");
            entity.HasKey(e => e.GroupId).HasName("groups_pkey");
            entity.Property(e => e.GroupId).HasColumnName("group_id").UseIdentityByDefaultColumn();
            entity.Property(e => e.Name).HasColumnName("name").HasMaxLength(120).IsRequired();
            entity.Property(e => e.UserId).HasColumnName("user_id");
            entity.Property(e => e.StatementVisibility).HasColumnName("statement_visibility").HasConversion<int>()
                .HasDefaultValue(StatementVisibility.ResponsibleOnly).HasSentinel((StatementVisibility)0);
            entity.Property(e => e.CreatedAt).HasColumnName("created_at").HasDefaultValueSql("(now() at time zone 'utc')");

            entity.HasOne<User>().WithMany().HasForeignKey(e => e.UserId)
                .HasConstraintName("fk_user_group").OnDelete(DeleteBehavior.ClientSetNull);
            entity.HasMany(e => e.Members).WithOne().HasForeignKey(m => m.GroupId)
                .HasConstraintName("fk_group_group_member").OnDelete(DeleteBehavior.ClientSetNull);
            entity.HasIndex(e => e.UserId).HasDatabaseName("ix_groups_user_id");
        });

        modelBuilder.Entity<GroupMember>(entity =>
        {
            entity.ToTable("group_members");
            entity.HasKey(e => e.GroupMemberId).HasName("group_members_pkey");
            entity.Property(e => e.GroupMemberId).HasColumnName("group_member_id").UseIdentityByDefaultColumn();
            entity.Property(e => e.GroupId).HasColumnName("group_id");
            entity.Property(e => e.UserId).HasColumnName("user_id");
            entity.Property(e => e.JoinedAt).HasColumnName("joined_at").HasDefaultValueSql("(now() at time zone 'utc')");

            entity.HasOne<User>().WithMany().HasForeignKey(e => e.UserId)
                .HasConstraintName("fk_user_group_member").OnDelete(DeleteBehavior.ClientSetNull);
            entity.HasIndex(e => new { e.GroupId, e.UserId }).IsUnique().HasDatabaseName("ix_group_members_group_user");
            entity.HasIndex(e => e.UserId).HasDatabaseName("ix_group_members_user_id");
        });

        modelBuilder.Entity<Account>()
            .HasOne<Group>().WithMany().HasForeignKey(e => e.GroupId)
            .HasConstraintName("fk_group_account").OnDelete(DeleteBehavior.ClientSetNull);
    }

    private static void ConfigureBtcQuotes(ModelBuilder modelBuilder)
    {
        modelBuilder.Entity<BtcQuote>(entity =>
        {
            entity.ToTable("btc_quotes");
            entity.HasKey(e => e.BtcQuoteId).HasName("btc_quotes_pkey");
            entity.Property(e => e.BtcQuoteId).HasColumnName("btc_quote_id").UseIdentityByDefaultColumn();
            entity.Property(e => e.PriceBrl).HasColumnName("price_brl").HasColumnType("numeric(20,8)");
            entity.Property(e => e.QuotedAt).HasColumnName("quoted_at");
            entity.Property(e => e.FetchedAt).HasColumnName("fetched_at");
            entity.Property(e => e.Source).HasColumnName("source").HasMaxLength(40).IsRequired();
            entity.HasIndex(e => e.QuotedAt).HasDatabaseName("ix_btc_quotes_quoted_at");
        });

        modelBuilder.Entity<Transaction>()
            .HasOne<BtcQuote>().WithMany().HasForeignKey(e => e.BtcQuoteId)
            .HasConstraintName("fk_btc_quote_transaction").OnDelete(DeleteBehavior.ClientSetNull);
    }

    /// <summary>Contas de sistema semeadas: origem externa, destino externo e câmbio, por moeda (research R-06).</summary>
    public static readonly Account[] SystemAccounts =
    {
        SystemAccount(1, AccountKind.ExternalSource, Currency.Brl, "Origem externa (BRL)"),
        SystemAccount(2, AccountKind.ExternalSink, Currency.Brl, "Destino externo (BRL)"),
        SystemAccount(3, AccountKind.Exchange, Currency.Brl, "Câmbio (BRL)"),
        SystemAccount(4, AccountKind.ExternalSource, Currency.Btc, "Origem externa (BTC)"),
        SystemAccount(5, AccountKind.ExternalSink, Currency.Btc, "Destino externo (BTC)"),
        SystemAccount(6, AccountKind.Exchange, Currency.Btc, "Câmbio (BTC)")
    };

    private static Account SystemAccount(long id, AccountKind kind, Currency currency, string name) => new()
    {
        AccountId = id,
        Kind = kind,
        Currency = currency,
        Name = name,
        IsActive = true,
        IsVirtual = false,
        CreatedAt = new DateTime(2026, 1, 1, 0, 0, 0, DateTimeKind.Utc)
    };

    private static void ConfigureAccounts(ModelBuilder modelBuilder)
    {
        modelBuilder.Entity<Account>(entity =>
        {
            entity.ToTable("accounts", t => t.HasCheckConstraint("ck_accounts_owner",
                "(kind = 1 AND user_id IS NOT NULL) OR (kind <> 1 AND user_id IS NULL AND group_id IS NULL)"));
            entity.HasKey(e => e.AccountId).HasName("accounts_pkey");
            entity.Property(e => e.AccountId).HasColumnName("account_id")
                .UseIdentityByDefaultColumn()
                .HasIdentityOptions(startValue: 100);
            entity.Property(e => e.Kind).HasColumnName("kind").HasConversion<int>().HasDefaultValue(AccountKind.Wallet)
                .HasSentinel((AccountKind)0);
            entity.Property(e => e.UserId).HasColumnName("user_id");
            entity.Property(e => e.GroupId).HasColumnName("group_id");
            entity.Property(e => e.Name).HasColumnName("name").HasMaxLength(120).IsRequired();
            entity.Property(e => e.Description).HasColumnName("description").HasMaxLength(500);
            entity.Property(e => e.Currency).HasColumnName("currency").HasConversion<int>();
            entity.Property(e => e.IsVirtual).HasColumnName("is_virtual").HasDefaultValue(false);
            entity.Property(e => e.IsActive).HasColumnName("is_active").HasDefaultValue(true).HasSentinel(true);
            entity.Property(e => e.CreatedByUserId).HasColumnName("created_by_user_id");
            entity.Property(e => e.CreatedAt).HasColumnName("created_at").HasDefaultValueSql("(now() at time zone 'utc')");
            entity.Ignore(e => e.IsWallet);

            entity.HasOne<User>().WithMany().HasForeignKey(e => e.UserId)
                .HasConstraintName("fk_user_account").OnDelete(DeleteBehavior.ClientSetNull);
            entity.HasOne<User>().WithMany().HasForeignKey(e => e.CreatedByUserId)
                .HasConstraintName("fk_user_account_creator").OnDelete(DeleteBehavior.ClientSetNull);

            entity.HasIndex(e => e.UserId).HasDatabaseName("ix_accounts_user_id");
            entity.HasIndex(e => e.GroupId).HasDatabaseName("ix_accounts_group_id");

            entity.HasData(SystemAccounts);
        });
    }

    private static void ConfigureTransactions(ModelBuilder modelBuilder)
    {
        modelBuilder.Entity<Transaction>(entity =>
        {
            entity.ToTable("transactions");
            entity.HasKey(e => e.TransactionId).HasName("transactions_pkey");
            entity.Property(e => e.TransactionId).HasColumnName("transaction_id").UseIdentityByDefaultColumn();
            entity.Property(e => e.Type).HasColumnName("type").HasConversion<int>();
            entity.Property(e => e.SourceAccountId).HasColumnName("source_account_id");
            entity.Property(e => e.DestinationAccountId).HasColumnName("destination_account_id");
            entity.Property(e => e.SourceAmount).HasColumnName("source_amount").HasColumnType("numeric(20,8)");
            entity.Property(e => e.DestinationAmount).HasColumnName("destination_amount").HasColumnType("numeric(20,8)");
            entity.Property(e => e.BtcQuoteId).HasColumnName("btc_quote_id");
            entity.Property(e => e.QuotePriceBrl).HasColumnName("quote_price_brl").HasColumnType("numeric(20,8)");
            entity.Property(e => e.Description).HasColumnName("description").HasMaxLength(500);
            entity.Property(e => e.OccurredAt).HasColumnName("occurred_at");
            entity.Property(e => e.CreatedByUserId).HasColumnName("created_by_user_id");
            entity.Property(e => e.ReversedTransactionId).HasColumnName("reversed_transaction_id");
            entity.Ignore(e => e.IsConversion);

            entity.HasOne<Account>().WithMany().HasForeignKey(e => e.SourceAccountId)
                .HasConstraintName("fk_account_transaction_source").OnDelete(DeleteBehavior.ClientSetNull);
            entity.HasOne<Account>().WithMany().HasForeignKey(e => e.DestinationAccountId)
                .HasConstraintName("fk_account_transaction_destination").OnDelete(DeleteBehavior.ClientSetNull);
            entity.HasOne<User>().WithMany().HasForeignKey(e => e.CreatedByUserId)
                .HasConstraintName("fk_user_transaction").OnDelete(DeleteBehavior.ClientSetNull);
            entity.HasOne<Transaction>().WithMany().HasForeignKey(e => e.ReversedTransactionId)
                .HasConstraintName("fk_transaction_reversal").OnDelete(DeleteBehavior.ClientSetNull);

            entity.HasMany(e => e.Entries).WithOne(e => e.Transaction).HasForeignKey(e => e.TransactionId)
                .HasConstraintName("fk_transaction_ledger_entry").OnDelete(DeleteBehavior.ClientSetNull);

            entity.HasIndex(e => e.ReversedTransactionId).IsUnique()
                .HasFilter("reversed_transaction_id IS NOT NULL")
                .HasDatabaseName("ix_transactions_reversed_transaction_id");
            entity.HasIndex(e => e.OccurredAt).HasDatabaseName("ix_transactions_occurred_at");
            // Feature 006 (R-11): dívidas entre pessoas e destinos de transferência.
            entity.HasIndex(e => e.SourceAccountId).HasDatabaseName("ix_transactions_source_account_id");
            entity.HasIndex(e => e.DestinationAccountId).HasDatabaseName("ix_transactions_destination_account_id");
        });
    }

    private static void ConfigureLedgerEntries(ModelBuilder modelBuilder)
    {
        modelBuilder.Entity<LedgerEntry>(entity =>
        {
            entity.ToTable("ledger_entries");
            entity.HasKey(e => e.LedgerEntryId).HasName("ledger_entries_pkey");
            entity.Property(e => e.LedgerEntryId).HasColumnName("ledger_entry_id").UseIdentityByDefaultColumn();
            entity.Property(e => e.TransactionId).HasColumnName("transaction_id");
            entity.Property(e => e.AccountId).HasColumnName("account_id");
            entity.Property(e => e.Amount).HasColumnName("amount").HasColumnType("numeric(20,8)");
            entity.Property(e => e.Currency).HasColumnName("currency").HasConversion<int>();
            entity.Property(e => e.OccurredAt).HasColumnName("occurred_at");

            entity.HasOne<Account>().WithMany().HasForeignKey(e => e.AccountId)
                .HasConstraintName("fk_account_ledger_entry").OnDelete(DeleteBehavior.ClientSetNull);

            entity.HasIndex(e => new { e.AccountId, e.OccurredAt }).HasDatabaseName("ix_ledger_entries_account_occurred");
        });
    }

    private static void ConfigureUsers(ModelBuilder modelBuilder)
    {
        modelBuilder.Entity<User>(entity =>
        {
            entity.ToTable("users");
            entity.HasKey(e => e.UserId).HasName("users_pkey");
            entity.Property(e => e.UserId).HasColumnName("user_id").UseIdentityByDefaultColumn();
            entity.Property(e => e.FirstName).HasColumnName("first_name").HasMaxLength(120).IsRequired();
            entity.Property(e => e.LastName).HasColumnName("last_name").HasMaxLength(120).IsRequired();
            entity.Property(e => e.Email).HasColumnName("email").HasMaxLength(254);
            entity.Property(e => e.PasswordHash).HasColumnName("password_hash").HasMaxLength(500);
            entity.Property(e => e.GoogleSubject).HasColumnName("google_subject").HasMaxLength(64);
            entity.Property(e => e.CreatedByUserId).HasColumnName("created_by_user_id");
            entity.Property(e => e.CreatedAt).HasColumnName("created_at").HasDefaultValueSql("(now() at time zone 'utc')");
            entity.Property(e => e.UpdatedAt).HasColumnName("updated_at");

            entity.HasIndex(e => e.Email).IsUnique().HasFilter("email IS NOT NULL").HasDatabaseName("ix_users_email");
            entity.HasIndex(e => e.GoogleSubject).IsUnique().HasFilter("google_subject IS NOT NULL")
                .HasDatabaseName("ix_users_google_subject");

            entity.HasOne<User>()
                .WithMany()
                .HasForeignKey(e => e.CreatedByUserId)
                .HasConstraintName("fk_user_created_user")
                .OnDelete(DeleteBehavior.ClientSetNull);

            entity.Ignore(e => e.CanLogin);
            entity.Ignore(e => e.HasPassword);
            entity.Ignore(e => e.HasGoogle);
            entity.Ignore(e => e.FullName);
        });
    }

    private sealed class UtcDateTimeConverter : ValueConverter<DateTime, DateTime>
    {
        public UtcDateTimeConverter() : base(
            v => DateTime.SpecifyKind(v.Kind == DateTimeKind.Local ? v.ToUniversalTime() : v, DateTimeKind.Unspecified),
            v => DateTime.SpecifyKind(v, DateTimeKind.Utc))
        {
        }
    }

    private sealed class NullableUtcDateTimeConverter : ValueConverter<DateTime?, DateTime?>
    {
        public NullableUtcDateTimeConverter() : base(
            v => v.HasValue
                ? DateTime.SpecifyKind(v.Value.Kind == DateTimeKind.Local ? v.Value.ToUniversalTime() : v.Value, DateTimeKind.Unspecified)
                : v,
            v => v.HasValue ? DateTime.SpecifyKind(v.Value, DateTimeKind.Utc) : v)
        {
        }
    }
}
