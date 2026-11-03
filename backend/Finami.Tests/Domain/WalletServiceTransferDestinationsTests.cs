using Finami.Domain.Enums;
using Finami.Domain.Exceptions;
using Finami.Domain.Interfaces;
using Finami.Domain.Models;
using Finami.Domain.Services;
using Finami.Domain.Validators;
using Finami.Infra.Context;
using Finami.Infra.Repository;
using FluentAssertions;
using Microsoft.EntityFrameworkCore;
using Moq;

namespace Finami.Tests.Domain;

/// <summary>
/// Feature 006 (T003/T023): <c>ownerFirstName</c> no WalletInfo e opções do campo Para. Usa os repositórios reais
/// sobre EF InMemory e o <see cref="AccessPolicy"/> real, para cobrir também a consulta de famílias.
/// </summary>
public class WalletServiceTransferDestinationsTests : IDisposable
{
    private const long ANA = 1;     // titular da origem; responsável pela FAMILY
    private const long BRUNO = 2;   // membro da FAMILY e dos FRIENDS (não pode repetir)
    private const long DORA = 3;    // só dos FRIENDS (visibilidade AllMembers)
    private const long CARLA = 4;   // fora das famílias de Ana
    private const long FAMILY = 10;
    private const long FRIENDS = 20;
    private const long CARLA_GROUP = 30;

    private readonly FinamiContext _context;

    public WalletServiceTransferDestinationsTests()
    {
        _context = new FinamiContext(new DbContextOptionsBuilder<FinamiContext>()
            .UseInMemoryDatabase($"destinations-{Guid.NewGuid():N}").Options);

        AddUser(ANA, "Ana", "Silva");
        AddUser(BRUNO, "Bruno", "Souza");
        AddUser(DORA, "Dora", "Lima");
        AddUser(CARLA, "Carla", "Alves");
        AddGroup(FAMILY, ANA, StatementVisibility.ResponsibleOnly, ANA, BRUNO);
        AddGroup(FRIENDS, BRUNO, StatementVisibility.AllMembers, BRUNO, ANA, DORA);
        AddGroup(CARLA_GROUP, CARLA, StatementVisibility.AllMembers, CARLA, BRUNO);

        Wallet(100, ANA, Currency.Brl, "Nubank", 1000m);
        Wallet(101, ANA, Currency.Brl, "Poupança", 300m);
        Wallet(102, ANA, Currency.Btc, "Ledger", 0.01m);
        Wallet(103, ANA, Currency.Brl, "Antiga", 0m, active: false);
        Wallet(104, ANA, Currency.Brl, "Desativada", 0m, active: false);
        Wallet(200, BRUNO, Currency.Brl, "Mesada", 50m);                      // pessoal: saldo oculto para Ana
        Wallet(201, BRUNO, Currency.Btc, "Cold", 0.2m);                       // outra moeda de outra pessoa: fora
        Wallet(202, BRUNO, Currency.Brl, "Casa", 70m, groupId: FAMILY);       // Ana é responsável: saldo visível
        Wallet(203, BRUNO, Currency.Brl, "Inativa", 0m, active: false);
        Wallet(300, DORA, Currency.Brl, "Viagem", 20m, groupId: FRIENDS);     // AllMembers: saldo visível
        Wallet(400, CARLA, Currency.Brl, "Fora", 999m);                       // fora da família de Ana
        _context.SaveChanges();
    }

    public void Dispose() => _context.Dispose();

    private WalletService Service()
    {
        var groups = new GroupRepository(_context);
        var quotes = new Mock<IQuoteService>();
        quotes.Setup(q => q.TryGetCurrentAsync()).ReturnsAsync((BtcQuote?)null);
        return new WalletService(new AccountRepository(_context), new UserRepository(_context), groups,
            new AccessPolicy(groups), quotes.Object, new WalletInsertInfoValidator(), new WalletUpdateInfoValidator());
    }

    private void AddUser(long id, string first, string last) =>
        _context.Users.Add(new User { UserId = id, FirstName = first, LastName = last });

    private void AddGroup(long id, long responsible, StatementVisibility visibility, params long[] members) =>
        _context.Groups.Add(new Group
        {
            GroupId = id, Name = $"Grupo {id}", UserId = responsible, StatementVisibility = visibility,
            Members = members.Select(m => new GroupMember { GroupId = id, UserId = m }).ToList()
        });

    private void Wallet(long id, long owner, Currency currency, string name, decimal balance, long? groupId = null,
        bool active = true)
    {
        _context.Accounts.Add(new Account
        {
            AccountId = id, Kind = AccountKind.Wallet, UserId = owner, Currency = currency, Name = name,
            GroupId = groupId, IsActive = active
        });
        if (balance != 0m)
            _context.LedgerEntries.Add(new LedgerEntry
                { AccountId = id, Amount = balance, Currency = currency, OccurredAt = DateTime.UtcNow });
    }

    [Fact]
    public async Task Wallet_info_has_owner_first_name()
    {
        var wallets = await Service().ListAsync(ANA, null, null, false);

        wallets.Should().Contain(w => w.WalletId == 100).Which.OwnerFirstName.Should().Be("Ana");
        wallets.Should().Contain(w => w.WalletId == 202, "Ana é responsável pela família da carteira")
            .Which.OwnerFirstName.Should().Be("Bruno");
        (await Service().GetAsync(ANA, 100)).OwnerFirstName.Should().Be("Ana");
    }

    [Fact]
    public async Task Same_currency_has_own_wallets_first_then_family_without_source_inactive_or_outsiders()
    {
        var result = await Service().GetTransferDestinationsAsync(ANA, 100);

        result.SourceWalletId.Should().Be(100);
        result.SameCurrency.Select(d => d.WalletId).Should().Equal(101, 202, 200, 300);
        result.SameCurrency.Should().OnlyContain(d => d.Currency == "BRL");
        result.SameCurrency.Select(d => d.WalletId).Should().OnlyHaveUniqueItems("Bruno está em duas famílias");
        var own = result.SameCurrency[0];
        own.IsOwn.Should().BeTrue();
        own.OwnerFirstName.Should().Be("Ana");
        own.Name.Should().Be("Poupança");
        result.SameCurrency.Skip(1).Should().OnlyContain(d => !d.IsOwn);
        result.SameCurrency.Single(d => d.WalletId == 300).OwnerFirstName.Should().Be("Dora");
    }

    [Fact]
    public async Task Conversion_lists_only_own_wallets_in_the_other_currency()
    {
        var result = await Service().GetTransferDestinationsAsync(ANA, 100);

        result.Conversion.Select(d => d.WalletId).Should().Equal(102);
        result.Conversion.Single().IsOwn.Should().BeTrue();
        result.Conversion.Single().Balance.Should().Be(0.01m);
    }

    [Fact]
    public async Task Balance_is_hidden_when_statement_is_not_visible()
    {
        var result = await Service().GetTransferDestinationsAsync(ANA, 100);

        result.SameCurrency.Single(d => d.WalletId == 101).Balance.Should().Be(300m);
        result.SameCurrency.Single(d => d.WalletId == 202).Balance.Should().Be(70m);
        result.SameCurrency.Single(d => d.WalletId == 300).Balance.Should().Be(20m);
        result.SameCurrency.Single(d => d.WalletId == 200).Balance.Should().BeNull();
    }

    [Fact]
    public async Task Btc_source_lists_btc_of_family_and_own_brl_for_conversion()
    {
        var result = await Service().GetTransferDestinationsAsync(ANA, 102);

        result.SameCurrency.Select(d => d.WalletId).Should().Equal(201);
        result.SameCurrency.Single().Balance.Should().BeNull();
        result.Conversion.Select(d => d.WalletId).Should().Equal(100, 101);
    }

    [Fact]
    public async Task Owner_without_family_only_sees_own_wallets()
    {
        _context.Accounts.Add(new Account
            { AccountId = 500, Kind = AccountKind.Wallet, UserId = 99, Currency = Currency.Brl, Name = "Só" });
        _context.Users.Add(new User { UserId = 99, FirstName = "Sozinho", LastName = "X" });
        await _context.SaveChangesAsync();

        var result = await Service().GetTransferDestinationsAsync(99, 500);

        result.SameCurrency.Should().BeEmpty();
        result.Conversion.Should().BeEmpty();
    }

    [Fact]
    public async Task Without_control_of_the_source_is_forbidden()
    {
        var act = () => Service().GetTransferDestinationsAsync(CARLA, 100);

        await act.Should().ThrowAsync<ForbiddenException>()
            .WithMessage("Você não tem permissão sobre esta carteira.");
    }

    [Fact]
    public async Task Inactive_source_is_rejected_and_unknown_source_is_not_found()
    {
        var inactive = () => Service().GetTransferDestinationsAsync(ANA, 103);
        var missing = () => Service().GetTransferDestinationsAsync(ANA, 9999);

        await inactive.Should().ThrowAsync<BusinessRuleException>();
        await missing.Should().ThrowAsync<NotFoundException>();
    }
}
