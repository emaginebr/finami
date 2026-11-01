using System.Text.Json;
using Finami.API.Extensions;
using Finami.DTO.Transactions;
using FluentAssertions;

namespace Finami.Tests.API;

/// <summary>contracts/api-additions.md §1: valores aceitos como número ou string JSON.</summary>
public class JsonNumberHandlingTests
{
    // Mesmas opções da API: padrões Web do ASP.NET Core + ConfigureFinamiJson (Program.cs).
    private static readonly JsonSerializerOptions OPTIONS =
        new JsonSerializerOptions(JsonSerializerDefaults.Web).ConfigureFinamiJson();

    [Theory]
    [InlineData("\"0.00000001\"", "0.00000001")]
    [InlineData("1000.5", "1000.5")]
    [InlineData("\"1000.5\"", "1000.5")]
    public void Income_amount_accepts_number_or_string(string amountJson, string expected)
    {
        var json = $"{{ \"walletId\": 100, \"amount\": {amountJson}, \"description\": \"Aporte\" }}";

        var info = JsonSerializer.Deserialize<IncomeInfo>(json, OPTIONS);

        info.Should().NotBeNull();
        info!.WalletId.Should().Be(100);
        info.Amount.Should().Be(decimal.Parse(expected, System.Globalization.CultureInfo.InvariantCulture));
        info.Description.Should().Be("Aporte");
    }

    [Theory]
    [InlineData("\"0.00000001\"", "0.00000001")]
    [InlineData("1000.5", "1000.5")]
    public void Expense_amount_accepts_number_or_string(string amountJson, string expected)
    {
        var json = $"{{ \"walletId\": 100, \"amount\": {amountJson} }}";

        var info = JsonSerializer.Deserialize<ExpenseInfo>(json, OPTIONS);

        info!.Amount.Should().Be(decimal.Parse(expected, System.Globalization.CultureInfo.InvariantCulture));
    }

    [Theory]
    [InlineData("\"0.00000001\"", "0.00000001")]
    [InlineData("1000.5", "1000.5")]
    public void Transfer_amount_accepts_number_or_string(string amountJson, string expected)
    {
        var json = $"{{ \"sourceWalletId\": 1, \"destinationWalletId\": 2, \"amount\": {amountJson} }}";

        var info = JsonSerializer.Deserialize<TransferInfo>(json, OPTIONS);

        info.Should().NotBeNull();
        info!.SourceWalletId.Should().Be(1);
        info.DestinationWalletId.Should().Be(2);
        info.Amount.Should().Be(decimal.Parse(expected, System.Globalization.CultureInfo.InvariantCulture));
    }

    [Fact]
    public void Invalid_numeric_string_is_rejected()
    {
        var act = () => JsonSerializer.Deserialize<IncomeInfo>("{ \"walletId\": 1, \"amount\": \"abc\" }", OPTIONS);

        act.Should().Throw<JsonException>();
    }

    [Fact]
    public void Responses_keep_numbers_as_json_numbers()
    {
        var json = JsonSerializer.Serialize(new TransferInfo { SourceWalletId = 1, DestinationWalletId = 2, Amount = 0.00000001m }, OPTIONS);

        json.Should().Contain("\"amount\":0.00000001");
    }
}
