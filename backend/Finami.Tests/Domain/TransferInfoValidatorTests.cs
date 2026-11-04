using Finami.Domain.Validators;
using Finami.DTO.Transactions;
using FluentAssertions;

namespace Finami.Tests.Domain;

/// <summary>Feature 006 (T035): amount xor amountBrl, valores positivos e 2 casas em reais.</summary>
public class TransferInfoValidatorTests
{
    private readonly TransferInfoValidator _validator = new();

    private static TransferInfo Info(decimal? amount, decimal? amountBrl) => new()
        { SourceWalletId = 1, DestinationWalletId = 2, Amount = amount, AmountBrl = amountBrl };

    [Fact]
    public void Amount_only_is_valid() => _validator.Validate(Info(10m, null)).IsValid.Should().BeTrue();

    [Fact]
    public void Amount_in_brl_only_is_valid() => _validator.Validate(Info(null, 200.5m)).IsValid.Should().BeTrue();

    [Theory]
    [InlineData(false, false)]
    [InlineData(true, true)]
    public void Exactly_one_amount_is_required(bool withAmount, bool withAmountBrl)
    {
        var result = _validator.Validate(Info(withAmount ? 1m : null, withAmountBrl ? 1m : null));

        result.IsValid.Should().BeFalse();
        result.Errors.Select(e => e.ErrorMessage).Should().Contain("Informe o valor em bitcoin ou em reais, ou quite tudo.");
    }

    [Fact]
    public void Amount_in_brl_must_be_positive_with_two_decimals()
    {
        _validator.Validate(Info(null, 0m)).IsValid.Should().BeFalse();
        _validator.Validate(Info(null, -5m)).IsValid.Should().BeFalse();
        _validator.Validate(Info(null, 10.123m)).Errors.Select(e => e.ErrorMessage)
            .Should().Contain("O valor em reais deve ter no máximo 2 casas decimais.");
    }

    [Fact]
    public void Amount_must_be_positive() =>
        _validator.Validate(Info(0m, null)).Errors.Select(e => e.ErrorMessage)
            .Should().Contain("O valor deve ser maior que zero.");

    // ---------------- Feature 007 (T012): tipo e campos da quitação ----------------

    private static TransferInfo Kind(string? kind, string? debtCurrency = null, bool settleAll = false,
        decimal? amount = 10m, decimal? amountBrl = null) => new()
    {
        SourceWalletId = 1, DestinationWalletId = 2, Kind = kind, DebtCurrency = debtCurrency,
        SettleAll = settleAll, Amount = amount, AmountBrl = amountBrl
    };

    private List<string> Errors(TransferInfo info) => _validator.Validate(info).Errors.Select(e => e.ErrorMessage).ToList();

    [Theory]
    [InlineData("loan")]
    [InlineData("settlement")]
    [InlineData("payment")]
    [InlineData("Payment")]
    [InlineData(null)]
    public void Known_kinds_are_valid(string? kind) => _validator.Validate(Kind(kind)).IsValid.Should().BeTrue();

    [Theory]
    [InlineData("emprestimo")]
    [InlineData("")]
    [InlineData("gift")]
    public void Unknown_kind_is_invalid(string kind) =>
        Errors(Kind(kind)).Should().Contain("Tipo de transferência inválido.");

    [Theory]
    [InlineData(null, "BRL", false)]
    [InlineData("loan", "BRL", false)]
    [InlineData("payment", null, true)]
    [InlineData(null, null, true)]
    public void Debt_currency_and_settle_all_only_with_settlement(string? kind, string? debtCurrency, bool settleAll) =>
        Errors(Kind(kind, debtCurrency, settleAll, amount: settleAll ? null : 10m))
            .Should().Contain("Moeda da dívida e quitar tudo só valem para quitação.");

    [Fact]
    public void Settlement_with_debt_currency_and_settle_all_is_valid()
    {
        _validator.Validate(Kind("settlement", "BTC", settleAll: true, amount: null)).IsValid.Should().BeTrue();
        _validator.Validate(Kind("settlement", "BRL")).IsValid.Should().BeTrue();
    }

    [Fact]
    public void Unknown_debt_currency_is_invalid() =>
        Errors(Kind("settlement", "USD")).Should().Contain("Moeda da dívida inválida. Use BRL ou BTC.");

    [Theory]
    [InlineData(true, false, true)]
    [InlineData(false, true, true)]
    [InlineData(true, true, true)]
    [InlineData(false, false, false)]
    [InlineData(true, true, false)]
    public void Amount_combinations_with_settle_all_are_invalid(bool withAmount, bool withAmountBrl, bool settleAll) =>
        Errors(Kind("settlement", settleAll: settleAll, amount: withAmount ? 1m : null, amountBrl: withAmountBrl ? 1m : null))
            .Should().Contain("Informe o valor em bitcoin ou em reais, ou quite tudo.");
}
