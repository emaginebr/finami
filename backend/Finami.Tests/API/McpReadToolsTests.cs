using Finami.API.Mcp;
using Finami.API.Mcp.Tools;
using Finami.Domain.Exceptions;
using Finami.Domain.Interfaces;
using Finami.DTO.Quotes;
using Finami.DTO.Statements;
using Finami.DTO.Wallets;
using FluentAssertions;
using Microsoft.Extensions.Logging.Abstractions;
using Moq;
using static Finami.Tests.API.McpToolTestKit;

namespace Finami.Tests.API;

/// <summary>T030 — ferramentas de leitura (US2): saldo total da Home, extrato paginado, isolamento e erros.</summary>
public class McpReadToolsTests
{
    private static readonly DateOnly START = new(2026, 10, 1);
    private static readonly DateOnly END = new(2026, 10, 31);

    private readonly Mock<IWalletService> _wallets = new();
    private readonly Mock<IQuoteService> _quotes = new();
    private readonly Mock<IBalanceService> _balances = new();
    private readonly Mock<IStatementService> _statements = new();
    private readonly Mock<ILedgerService> _ledger = new();

    private BalanceTools Balance() => new(_wallets.Object, _quotes.Object, _balances.Object, NullLogger<BalanceTools>.Instance);
    private StatementTools Statement() => new(_statements.Object, _ledger.Object, NullLogger<StatementTools>.Instance);
    private WalletReadTools WalletRead() => new(_wallets.Object, NullLogger<WalletReadTools>.Instance);

    private static WalletInfo Wallet(long id, string currency, decimal balance, decimal? estimated = null,
        long owner = USER, bool active = true) => new()
    {
        WalletId = id, Name = $"Carteira {id}", Currency = currency, Balance = balance, EstimatedBrl = estimated,
        OwnerUserId = owner, IsActive = active
    };

    // ---------------- saldo_total ----------------

    [Fact]
    public async Task Saldo_total_matches_the_home_formula()
    {
        _quotes.Setup(q => q.GetCurrentAsync()).ReturnsAsync(new BtcQuoteInfo { PriceBrl = 300000m, Source = "teste" });
        _wallets.Setup(w => w.ListAsync(USER, null, null, false)).ReturnsAsync(new List<WalletInfo>
        {
            Wallet(1, "BRL", 1420.50m),
            Wallet(2, "BRL", 100m),
            Wallet(3, "BTC", 0.01m, estimated: 3000m),
            // Carteira de outro membro (controlada por ser responsável): fora do total da Home.
            Wallet(4, "BRL", 999m, owner: 99),
            Wallet(5, "BRL", 50m, active: false)
        });

        var result = await Balance().SaldoTotal(Principal(READ_ONLY));

        result.IsError.Should().NotBe(true);
        var data = Structured(result);
        data.GetProperty("totalBrl").GetDecimal().Should().Be(1420.50m + 100m + 3000m);
        data.GetProperty("porMoeda").GetProperty("BRL").GetDecimal().Should().Be(1520.50m);
        data.GetProperty("porMoeda").GetProperty("BTC").GetDecimal().Should().Be(0.01m);
        data.GetProperty("cotacao").GetProperty("priceBrl").GetDecimal().Should().Be(300000m);
        data.GetProperty("btcExcluido").GetBoolean().Should().BeFalse();
        data.GetProperty("quantidadeCarteiras").GetInt32().Should().Be(3);
        Text(result).Should().StartWith("Saldo total: R$ 4.520,50");
    }

    [Fact]
    public async Task Saldo_total_without_quote_excludes_btc_like_the_home()
    {
        _quotes.Setup(q => q.GetCurrentAsync()).ThrowsAsync(new QuoteUnavailableException());
        _wallets.Setup(w => w.ListAsync(USER, null, null, false)).ReturnsAsync(new List<WalletInfo>
        {
            Wallet(1, "BRL", 200m),
            Wallet(3, "BTC", 0.5m, estimated: null)
        });

        var data = Structured(await Balance().SaldoTotal(Principal(READ_ONLY)));

        data.GetProperty("totalBrl").GetDecimal().Should().Be(200m);
        data.GetProperty("btcExcluido").GetBoolean().Should().BeTrue();
        data.GetProperty("cotacao").ValueKind.Should().Be(System.Text.Json.JsonValueKind.Null);
    }

    // ---------------- extrato paginado ----------------

    private static StatementResult FullStatement(int entries) => new()
    {
        Scope = "Wallet", ScopeId = 5, Start = START, End = END, DetailLevel = "Full",
        Totals = new List<StatementTotalInfo>
        {
            new() { Currency = "BRL", OpeningBalance = 1000m, TotalIn = 500m, TotalOut = 200m, ClosingBalance = 1300m }
        },
        Entries = Enumerable.Range(1, entries).Select(i => new StatementEntryInfo
        {
            TransactionId = i, Currency = "BRL", Amount = i, Type = "Income"
        }).ToList()
    };

    [Fact]
    public async Task Extrato_pages_concatenate_to_the_full_statement_and_keep_totals()
    {
        _statements.Setup(s => s.GetWalletStatementAsync(USER, 5, START, END)).ReturnsAsync(FullStatement(45));
        var collected = new List<long>();
        string? cursor = null;
        var pages = 0;

        do
        {
            var result = await Statement().ExtratoCarteira(Principal(READ_ONLY), 5, "2026-10-01", "2026-10-31", 20, cursor);
            result.IsError.Should().NotBe(true);
            var data = Structured(result);
            data.GetProperty("totals")[0].GetProperty("openingBalance").GetDecimal().Should().Be(1000m);
            data.GetProperty("totals")[0].GetProperty("closingBalance").GetDecimal().Should().Be(1300m);
            data.GetProperty("totalEntries").GetInt32().Should().Be(45);
            collected.AddRange(data.GetProperty("entries").EnumerateArray().Select(e => e.GetProperty("transactionId").GetInt64()));
            var next = data.GetProperty("proximoCursor");
            cursor = next.ValueKind == System.Text.Json.JsonValueKind.Null ? null : next.GetString();
            pages++;
        } while (cursor != null);

        pages.Should().Be(3);
        collected.Should().Equal(Enumerable.Range(1, 45).Select(i => (long)i));
    }

    [Fact]
    public async Task Extrato_default_limit_is_20()
    {
        _statements.Setup(s => s.GetWalletStatementAsync(USER, 5, START, END)).ReturnsAsync(FullStatement(30));

        var data = Structured(await Statement().ExtratoCarteira(Principal(READ_ONLY), 5, "2026-10-01", "2026-10-31"));

        data.GetProperty("entries").GetArrayLength().Should().Be(20);
    }

    [Theory]
    [InlineData("lixo")]
    [InlineData("djF8MjAyNi0wOS0wMXwyMDI2LTA5LTMwfDIw")] // v1|2026-09-01|2026-09-30|20 (outro período)
    public async Task Invalid_cursor_is_a_validation_error(string cursor)
    {
        _statements.Setup(s => s.GetWalletStatementAsync(USER, 5, START, END)).ReturnsAsync(FullStatement(30));

        var result = await Statement().ExtratoCarteira(Principal(READ_ONLY), 5, "2026-10-01", "2026-10-31", null, cursor);

        Code(result).Should().Be("validacao");
        Text(result).Should().Be(McpPaging.INVALID_CURSOR_MESSAGE);
        _statements.Verify(s => s.GetWalletStatementAsync(It.IsAny<long>(), It.IsAny<long>(), It.IsAny<DateOnly>(), It.IsAny<DateOnly>()), Times.Never);
    }

    [Theory]
    [InlineData(0)]
    [InlineData(51)]
    public async Task Limit_outside_1_to_50_is_a_validation_error(int limit)
    {
        var result = await Statement().ExtratoCarteira(Principal(READ_ONLY), 5, "2026-10-01", "2026-10-31", limit);

        Code(result).Should().Be("validacao");
        Text(result).Should().Be("O limite deve estar entre 1 e 50.");
    }

    [Fact]
    public async Task Invalid_date_is_a_validation_error_with_example()
    {
        var result = await Statement().ExtratoPessoa(Principal(READ_ONLY), USER, "01/10/2026", "2026-10-31");

        Code(result).Should().Be("validacao");
        Text(result).Should().Contain("AAAA-MM-DD").And.Contain("inicio");
    }

    [Fact]
    public async Task Statement_service_errors_keep_the_app_message()
    {
        _statements.Setup(s => s.GetGroupStatementAsync(USER, 3, START, END))
            .ThrowsAsync(new ValidationException("O período não pode passar de 1 ano."));

        var result = await Statement().ExtratoFamilia(Principal(READ_ONLY), 3, "2026-10-01", "2026-10-31");

        Code(result).Should().Be("validacao");
        Text(result).Should().Be("O período não pode passar de 1 ano.");
    }

    // ---------------- isolamento e mapeamento de erros ----------------

    [Fact]
    public async Task Someone_elses_wallet_is_not_found_and_uses_the_token_user()
    {
        _wallets.Setup(w => w.GetAsync(USER, 999)).ThrowsAsync(new NotFoundException("Carteira não encontrada."));

        var result = await WalletRead().ObterCarteira(Principal(READ_ONLY), 999);

        Code(result).Should().Be("nao_encontrado");
        Text(result).Should().Be("Carteira não encontrada.");
        Structured(result).GetProperty("mensagem").GetString().Should().Be("Carteira não encontrada.");
        _wallets.Verify(w => w.GetAsync(USER, 999), Times.Once);
    }

    [Fact]
    public async Task Someone_elses_statement_is_forbidden()
    {
        _statements.Setup(s => s.GetUserStatementAsync(USER, 42, START, END))
            .ThrowsAsync(new ForbiddenException("Você não tem acesso ao extrato desta pessoa."));

        var result = await Statement().ExtratoPessoa(Principal(READ_ONLY), 42, "2026-10-01", "2026-10-31");

        Code(result).Should().Be("sem_permissao");
        Text(result).Should().Be("Você não tem acesso ao extrato desta pessoa.");
    }

    [Fact]
    public async Task Quote_unavailable_maps_to_cotacao_indisponivel()
    {
        _quotes.Setup(q => q.GetCurrentAsync()).ThrowsAsync(new QuoteUnavailableException());
        var tools = new QuoteTools(_quotes.Object, NullLogger<QuoteTools>.Instance);

        var result = await tools.CotacaoBitcoin(Principal(READ_ONLY));

        Code(result).Should().Be("cotacao_indisponivel");
        Text(result).Should().Be("Cotação do bitcoin indisponível no momento.");
    }

    [Fact]
    public async Task Unexpected_errors_become_erro_interno_without_details()
    {
        _wallets.Setup(w => w.ListAsync(USER, null, null, false)).ThrowsAsync(new InvalidOperationException("SQL secreto"));

        var result = await WalletRead().ListarCarteiras(Principal(READ_ONLY));

        Code(result).Should().Be("erro_interno");
        Text(result).Should().Be("Erro interno. Tente novamente.").And.NotContain("SQL");
    }

    [Fact]
    public async Task List_results_are_wrapped_in_itens_with_filters_passed_through()
    {
        _wallets.Setup(w => w.ListAsync(USER, 12, 3, true)).ReturnsAsync(new List<WalletInfo> { Wallet(1, "BTC", 0.00123456m, 400m) });

        var result = await WalletRead().ListarCarteiras(Principal(READ_ONLY), familia_id: 3, dono_id: 12, incluir_inativas: true);

        Structured(result).GetProperty("itens").GetArrayLength().Should().Be(1);
        Text(result).Should().Contain("0,00123456 BTC").And.Contain("R$ 400,00");
    }
}
