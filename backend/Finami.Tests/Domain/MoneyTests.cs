using Finami.Domain.Enums;
using Finami.Domain.Exceptions;
using Finami.Domain.Services;
using FluentAssertions;

namespace Finami.Tests.Domain;

public class MoneyTests
{
    [Theory]
    [InlineData(Currency.Brl, 2)]
    [InlineData(Currency.Btc, 8)]
    public void Precision_per_currency(Currency currency, int expected) =>
        Money.Precision(currency).Should().Be(expected);

    [Theory]
    [InlineData("10.999", Currency.Brl, "10.99")]
    [InlineData("0.123456789", Currency.Btc, "0.12345678")]
    [InlineData("0.009", Currency.Brl, "0")]
    [InlineData("5", Currency.Brl, "5")]
    public void Truncate_never_rounds_up(string value, Currency currency, string expected) =>
        Money.Truncate(decimal.Parse(value, System.Globalization.CultureInfo.InvariantCulture), currency)
            .Should().Be(decimal.Parse(expected, System.Globalization.CultureInfo.InvariantCulture));

    [Fact]
    public void HasValidScale_rejects_extra_decimals()
    {
        Money.HasValidScale(10.12m, Currency.Brl).Should().BeTrue();
        Money.HasValidScale(10.123m, Currency.Brl).Should().BeFalse();
        Money.HasValidScale(0.00000001m, Currency.Btc).Should().BeTrue();
        Money.HasValidScale(0.000000001m, Currency.Btc).Should().BeFalse();
    }

    [Fact]
    public void EnsurePositive_rejects_zero_negative_and_bad_scale()
    {
        FluentActions.Invoking(() => Money.EnsurePositive(0m, Currency.Brl)).Should().Throw<ValidationException>();
        FluentActions.Invoking(() => Money.EnsurePositive(-1m, Currency.Brl)).Should().Throw<ValidationException>();
        FluentActions.Invoking(() => Money.EnsurePositive(1.001m, Currency.Brl)).Should().Throw<ValidationException>();
        FluentActions.Invoking(() => Money.EnsurePositive(1.01m, Currency.Brl)).Should().NotThrow();
    }
}
