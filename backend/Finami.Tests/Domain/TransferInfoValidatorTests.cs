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
        result.Errors.Select(e => e.ErrorMessage).Should().Contain("Informe o valor em bitcoin ou em reais.");
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
}
