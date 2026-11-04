using Finami.API.Mcp.Tools;
using Finami.Domain.Exceptions;
using Finami.Domain.Interfaces;
using Finami.DTO.Transactions;
using Finami.DTO.Wallets;
using FluentAssertions;
using Microsoft.Extensions.Logging.Abstractions;
using Moq;
using static Finami.Tests.API.McpToolTestKit;

namespace Finami.Tests.API;

/// <summary>T038 — lançamentos pelo MCP (US3): userId do token, escopo, mensagens do app, idempotência e auditoria.</summary>
public class McpTransactionToolsTests
{
    private readonly McpToolTestKit _kit = new();
    private readonly Mock<ILedgerService> _ledger = new();
    private readonly Mock<IWalletService> _wallets = new();
    private readonly TransactionTools _tools;

    public McpTransactionToolsTests()
    {
        _tools = new TransactionTools(_ledger.Object, _wallets.Object, _kit.Idempotency, _kit.Audit.Object,
            NullLogger<TransactionTools>.Instance);
        _wallets.Setup(w => w.GetAsync(USER, 5)).ReturnsAsync(new WalletInfo
        {
            WalletId = 5, Name = "Nubank", Currency = "BRL", Balance = 1420m, OwnerUserId = USER
        });
    }

    private static TransactionInfo Transaction(long id, string type, decimal amount) => new()
    {
        TransactionId = id, Type = type, SourceAmount = amount, DestinationAmount = amount,
        Source = new TransactionAccountInfo { Name = type == "Income" ? "Entradas" : "Nubank", Currency = "BRL" },
        Destination = new TransactionAccountInfo { Name = type == "Income" ? "Nubank" : "Saídas", Currency = "BRL" }
    };

    [Fact]
    public async Task Expense_calls_the_service_with_the_token_user_and_summarizes_new_balance()
    {
        _ledger.Setup(l => l.ExpenseAsync(USER, It.Is<ExpenseInfo>(e => e.WalletId == 5 && e.Amount == 80m && e.Description == "Mercado")))
            .ReturnsAsync(Transaction(10, "Expense", 80m));

        var result = await _tools.RegistrarDespesa(Principal(), 5, 80m, "Mercado");

        result.IsError.Should().NotBe(true);
        Text(result).Should().Be("Despesa de R$ 80,00 registrada em Nubank. Saldo: R$ 1.420,00.");
        var data = Structured(result);
        data.GetProperty("transactionId").GetInt64().Should().Be(10);
        data.GetProperty("walletBalance").GetDecimal().Should().Be(1420m);
        _kit.AuditLog.Should().ContainSingle().Which.Should().Be((USER, GRANT, "registrar_despesa", "sucesso", (long?)10));
    }

    [Fact]
    public async Task Income_and_transfer_use_the_token_user()
    {
        _ledger.Setup(l => l.IncomeAsync(USER, It.IsAny<IncomeInfo>())).ReturnsAsync(Transaction(11, "Income", 3500m));
        _ledger.Setup(l => l.TransferAsync(USER, It.Is<TransferInfo>(t => t.SourceWalletId == 5 && t.DestinationWalletId == 8 && t.Amount == 50m)))
            .ReturnsAsync(Transaction(12, "Transfer", 50m));

        Text(await _tools.RegistrarReceita(Principal(), 5, 3500m)).Should().StartWith("Receita de R$ 3.500,00 registrada em Nubank.");
        Text(await _tools.RegistrarTransferencia(Principal(), 5, 8, 50m)).Should().Contain("Transferência de R$ 50,00");

        _ledger.Verify(l => l.IncomeAsync(USER, It.IsAny<IncomeInfo>()), Times.Once);
        _ledger.Verify(l => l.TransferAsync(USER, It.IsAny<TransferInfo>()), Times.Once);
    }

    [Fact]
    public async Task Reverse_calls_the_service_with_reason()
    {
        _ledger.Setup(l => l.ReverseAsync(USER, 10, It.Is<ReverseInfo>(r => r.Description == "Duplicado")))
            .ReturnsAsync(Transaction(13, "Reversal", 80m));

        var result = await _tools.EstornarLancamento(Principal(), 10, "Duplicado");

        Text(result).Should().StartWith("Lançamento 10 estornado pelo lançamento 13");
        _kit.AuditLog.Single().TargetId.Should().Be(13);
    }

    [Fact]
    public async Task Read_only_connection_gets_insufficient_scope_and_service_is_not_called()
    {
        var principal = Principal(READ_ONLY);

        var results = new[]
        {
            await _tools.RegistrarReceita(principal, 5, 10m),
            await _tools.RegistrarDespesa(principal, 5, 10m),
            await _tools.RegistrarTransferencia(principal, 5, 8, 10m),
            await _tools.EstornarLancamento(principal, 10)
        };

        results.Should().OnlyContain(r => Code(r) == "permissao_insuficiente");
        Text(results[0]).Should().Be("Esta conexão só permite consultas. Reconecte o assistente permitindo alterações.");
        _ledger.VerifyNoOtherCalls();
        _kit.AuditLog.Should().HaveCount(4).And.OnlyContain(a => a.Outcome == "permissao_insuficiente");
    }

    [Fact]
    public async Task Business_rule_keeps_the_app_message_and_is_audited()
    {
        _ledger.Setup(l => l.ExpenseAsync(USER, It.IsAny<ExpenseInfo>()))
            .ThrowsAsync(new BusinessRuleException("Saldo insuficiente na carteira de origem."));

        var result = await _tools.RegistrarDespesa(Principal(), 5, 99999m);

        Code(result).Should().Be("regra_de_negocio");
        Text(result).Should().Be("Saldo insuficiente na carteira de origem.");
        _kit.AuditLog.Single().Should().Be((USER, GRANT, "registrar_despesa", "regra_de_negocio", (long?)null));
    }

    [Fact]
    public async Task Preview_requires_only_read_and_is_not_audited()
    {
        _ledger.Setup(l => l.PreviewTransferAsync(USER, It.IsAny<TransferInfo>())).ReturnsAsync(new TransferPreviewResult
        {
            Type = "BtcPurchase", SourceAmount = 300m, DestinationAmount = 0.001m,
            Quote = new QuoteRefInfo { PriceBrl = 300000m }
        });

        var result = await _tools.PreviaTransferencia(Principal(READ_ONLY), 5, 9, 300m);

        result.IsError.Should().NotBe(true);
        Structured(result).GetProperty("destinationAmount").GetDecimal().Should().Be(0.001m);
        Text(result).Should().Contain("R$ 300.000,00");
        _kit.AuditLog.Should().BeEmpty();
    }

    // ---------------- Feature 006: valor_em_reais e regras novas ----------------

    [Fact]
    public async Task Preview_and_transfer_pass_valor_em_reais_as_amount_brl()
    {
        _ledger.Setup(l => l.PreviewTransferAsync(USER, It.Is<TransferInfo>(t =>
                t.SourceWalletId == 5 && t.DestinationWalletId == 9 && t.Amount == null && t.AmountBrl == 200m)))
            .ReturnsAsync(new TransferPreviewResult
            {
                Type = "Transfer", SourceAmount = 0.0004m, DestinationAmount = 0.0004m,
                Quote = new QuoteRefInfo { PriceBrl = 500000m }
            });
        _ledger.Setup(l => l.TransferAsync(USER, It.Is<TransferInfo>(t => t.Amount == null && t.AmountBrl == 200m)))
            .ReturnsAsync(new TransactionInfo
            {
                TransactionId = 40, Type = "Transfer", SourceAmount = 0.0004m, DestinationAmount = 0.0004m,
                Source = new TransactionAccountInfo { Name = "Ledger", Currency = "BTC" },
                Destination = new TransactionAccountInfo { Name = "Cold", Currency = "BTC" },
                Quote = new QuoteRefInfo { PriceBrl = 500000m }
            });

        var preview = await _tools.PreviaTransferencia(Principal(READ_ONLY), 5, 9, valor_em_reais: 200m);
        var transfer = await _tools.RegistrarTransferencia(Principal(), 5, 9, valor_em_reais: 200m);

        Structured(preview).GetProperty("sourceAmount").GetDecimal().Should().Be(0.0004m);
        Text(preview).Should().Contain("R$ 500.000,00");
        Text(transfer).Should().StartWith("Transferência de 0,0004 BTC de Ledger para Cold (cotação 1 BTC = R$ 500.000,00) registrada.");
        Structured(transfer).GetProperty("quote").GetProperty("priceBrl").GetDecimal().Should().Be(500000m);
    }

    [Fact]
    public async Task New_transfer_rules_keep_the_app_message()
    {
        _ledger.Setup(l => l.TransferAsync(USER, It.IsAny<TransferInfo>()))
            .ThrowsAsync(new BusinessRuleException("Só é possível transferir para pessoas da sua família."));
        _ledger.Setup(l => l.PreviewTransferAsync(USER, It.IsAny<TransferInfo>()))
            .ThrowsAsync(new ValidationException("Informe o valor em bitcoin ou em reais.",
                new[] { "Informe o valor em bitcoin ou em reais." }));

        var transfer = await _tools.RegistrarTransferencia(Principal(), 5, 30, 10m);
        var preview = await _tools.PreviaTransferencia(Principal(READ_ONLY), 5, 9);

        Code(transfer).Should().Be("regra_de_negocio");
        Text(transfer).Should().Be("Só é possível transferir para pessoas da sua família.");
        _kit.AuditLog.Single().Outcome.Should().Be("regra_de_negocio");
        Code(preview).Should().Be("validacao");
        Text(preview).Should().Be("Informe o valor em bitcoin ou em reais.");
    }

    // ---------------- Feature 007 (T035): tipo, moeda_da_divida e quitar_tudo ----------------

    [Theory]
    [InlineData("emprestimo", "loan")]
    [InlineData("quitacao", "settlement")]
    [InlineData("Quitação", "settlement")]
    [InlineData("pagamento", "payment")]
    public async Task Tipo_is_mapped_to_the_transfer_kind(string tipo, string kind)
    {
        _ledger.Setup(l => l.TransferAsync(USER, It.IsAny<TransferInfo>())).ReturnsAsync(Transaction(50, "Transfer", 10m));

        await _tools.RegistrarTransferencia(Principal(), 5, 8, 10m, tipo: tipo);

        _ledger.Verify(l => l.TransferAsync(USER, It.Is<TransferInfo>(t => t.Kind == kind && t.DebtCurrency == null && !t.SettleAll)));
    }

    [Fact]
    public async Task Moeda_da_divida_and_quitar_tudo_go_to_the_transfer_info()
    {
        _ledger.Setup(l => l.PreviewTransferAsync(USER, It.IsAny<TransferInfo>())).ReturnsAsync(new TransferPreviewResult());
        _ledger.Setup(l => l.TransferAsync(USER, It.IsAny<TransferInfo>())).ReturnsAsync(Transaction(51, "Transfer", 10m));

        await _tools.PreviaTransferencia(Principal(READ_ONLY), 5, 8, tipo: "quitacao", moeda_da_divida: "brl", quitar_tudo: true);
        await _tools.RegistrarTransferencia(Principal(), 5, 8, tipo: "quitacao", moeda_da_divida: "BTC", quitar_tudo: true);

        _ledger.Verify(l => l.PreviewTransferAsync(USER, It.Is<TransferInfo>(t =>
            t.Kind == "settlement" && t.DebtCurrency == "BRL" && t.SettleAll && t.Amount == null && t.AmountBrl == null)));
        _ledger.Verify(l => l.TransferAsync(USER, It.Is<TransferInfo>(t =>
            t.Kind == "settlement" && t.DebtCurrency == "BTC" && t.SettleAll)));
    }

    [Fact]
    public async Task Invalid_tipo_is_a_validation_error_and_the_service_is_not_called()
    {
        var preview = await _tools.PreviaTransferencia(Principal(READ_ONLY), 5, 8, 10m, tipo: "doacao");
        var transfer = await _tools.RegistrarTransferencia(Principal(), 5, 8, 10m, tipo: "doacao");

        Code(preview).Should().Be("validacao");
        Text(preview).Should().Be("Tipo inválido em 'tipo': use emprestimo, quitacao ou pagamento.");
        Code(transfer).Should().Be("validacao");
        _ledger.VerifyNoOtherCalls();
    }

    [Fact]
    public async Task Preview_text_shows_the_settlement_effect_and_quote()
    {
        _ledger.Setup(l => l.PreviewTransferAsync(USER, It.IsAny<TransferInfo>())).ReturnsAsync(new TransferPreviewResult
        {
            Type = "Transfer", SourceAmount = 0.0002m, DestinationAmount = 0.0002m,
            Quote = new QuoteRefInfo { PriceBrl = 500000m },
            Kind = "settlement",
            Debt = new TransferDebtEffect
            {
                Currency = "BRL", Amount = 100m, Before = 100m, After = 0m, DebtorUserId = 9, CreditorUserId = 7,
                DebtorFirstName = "Bruno", CreditorFirstName = "Ana"
            }
        });

        var result = await _tools.PreviaTransferencia(Principal(READ_ONLY), 5, 9, tipo: "quitacao", moeda_da_divida: "BRL",
            quitar_tudo: true);

        Text(result).Should().EndWith(
            "Quitação: abate R$ 100,00 da dívida de Bruno com Ana (de R$ 100,00 para R$ 0,00), pela cotação ₿ 1 = R$ 500.000,00.");
        var debt = Structured(result).GetProperty("debt");
        debt.GetProperty("after").GetDecimal().Should().Be(0m);
        Structured(result).GetProperty("kind").GetString().Should().Be("settlement");
    }

    [Fact]
    public async Task Preview_text_shows_loan_and_payment()
    {
        _ledger.SetupSequence(l => l.PreviewTransferAsync(USER, It.IsAny<TransferInfo>()))
            .ReturnsAsync(new TransferPreviewResult
            {
                Type = "Transfer", SourceAmount = 100m, DestinationAmount = 100m, Kind = "loan",
                Debt = new TransferDebtEffect
                {
                    Currency = "BRL", Amount = 100m, Before = 0m, After = 100m,
                    DebtorFirstName = "Bruno", CreditorFirstName = "Ana"
                }
            })
            .ReturnsAsync(new TransferPreviewResult { Type = "Transfer", SourceAmount = 50m, DestinationAmount = 50m, Kind = "payment" });

        var loan = await _tools.PreviaTransferencia(Principal(READ_ONLY), 5, 9, 100m, tipo: "emprestimo");
        var payment = await _tools.PreviaTransferencia(Principal(READ_ONLY), 5, 9, 50m, tipo: "pagamento");

        Text(loan).Should().EndWith("Empréstimo: Bruno passa a dever R$ 100,00 a Ana (dívida de R$ 0,00 para R$ 100,00).");
        Text(payment).Should().EndWith("Pagamento: não gera dívida.");
    }

    [Fact]
    public async Task Transfer_summary_mentions_the_kind_and_effect()
    {
        var settlement = Transaction(60, "Transfer", 30m);
        settlement.TransferKind = "settlement";
        settlement.DebtCurrency = "BRL";
        settlement.DebtAmount = 30m;
        _ledger.Setup(l => l.TransferAsync(USER, It.IsAny<TransferInfo>())).ReturnsAsync(settlement);

        var result = await _tools.RegistrarTransferencia(Principal(), 5, 9, 30m, tipo: "quitacao");

        Text(result).Should().Contain("registrada. Quitação: abate R$ 30,00 da dívida.");
        Structured(result).GetProperty("transferKind").GetString().Should().Be("settlement");
        Structured(result).GetProperty("debtAmount").GetDecimal().Should().Be(30m);
    }

    [Fact]
    public async Task Same_repeat_key_100_times_registers_one_expense()
    {
        var calls = 0;
        _ledger.Setup(l => l.ExpenseAsync(USER, It.IsAny<ExpenseInfo>()))
            .ReturnsAsync(() => Transaction(100 + ++calls, "Expense", 80m));

        for (var i = 0; i < 100; i++)
        {
            var result = await _tools.RegistrarDespesa(Principal(), 5, 80m, "Mercado", "uuid-123");
            Structured(result).GetProperty("transactionId").GetInt64().Should().Be(101);
            Text(result).Should().Contain("R$ 80,00");
        }

        calls.Should().Be(1);
        _kit.AuditLog.Should().HaveCount(100);
    }

    [Fact]
    public async Task Failed_write_with_repeat_key_can_be_retried()
    {
        _ledger.SetupSequence(l => l.ExpenseAsync(USER, It.IsAny<ExpenseInfo>()))
            .ThrowsAsync(new QuoteUnavailableException())
            .ReturnsAsync(Transaction(20, "Expense", 80m));

        Code(await _tools.RegistrarDespesa(Principal(), 5, 80m, null, "k")).Should().Be("cotacao_indisponivel");
        Code(await _tools.RegistrarDespesa(Principal(), 5, 80m, null, "k")).Should().BeNull();
    }

    [Fact]
    public async Task Audit_failure_does_not_change_the_result()
    {
        _kit.Audit.Reset();
        _kit.Audit.Setup(a => a.RecordAsync(It.IsAny<long>(), It.IsAny<long>(), It.IsAny<string>(), It.IsAny<string>(), It.IsAny<long?>()))
            .ThrowsAsync(new InvalidOperationException("banco fora"));
        _ledger.Setup(l => l.IncomeAsync(USER, It.IsAny<IncomeInfo>())).ReturnsAsync(Transaction(30, "Income", 1m));

        (await _tools.RegistrarReceita(Principal(), 5, 1m)).IsError.Should().NotBe(true);
    }
}
