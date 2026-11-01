using Finami.Domain.Enums;
using Finami.Domain.Models;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Storage.ValueConversion;

namespace Finami.Infra.Context;

public class FinamiContext : DbContext
{
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
