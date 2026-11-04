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

    [Theory]
    [InlineData("0.000233333", Currency.Btc, "0.00023334")]
    [InlineData("0.0002", Currency.Btc, "0.0002")]
    [InlineData("333.33333", Currency.Brl, "333.34")]
    [InlineData("10.001", Currency.Brl, "10.01")]
    [InlineData("5", Currency.Brl, "5")]
    public void Ceiling_rounds_up_to_the_smallest_unit(string value, Currency currency, string expected) =>
        Money.Ceiling(decimal.Parse(value, System.Globalization.CultureInfo.InvariantCulture), currency)
            .Should().Be(decimal.Parse(expected, System.Globalization.CultureInfo.InvariantCulture));

    [Theory]
    [InlineData("70", Currency.Brl, "R$ 70,00")]
    [InlineData("1234567.5", Currency.Brl, "R$ 1.234.567,50")]
    [InlineData("0.0005", Currency.Btc, "₿ 0,00050000")]
    [InlineData("1.5", Currency.Btc, "₿ 1,50000000")]
    [InlineData("-30", Currency.Brl, "-R$ 30,00")]
    public void Format_uses_pt_br_and_the_currency_precision(string value, Currency currency, string expected) =>
        Money.Format(decimal.Parse(value, System.Globalization.CultureInfo.InvariantCulture), currency)
            .Should().Be(expected);
}
