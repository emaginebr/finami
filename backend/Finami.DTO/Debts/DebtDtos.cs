using System.Text.Json.Serialization;

namespace Finami.DTO.Debts;

/// <summary>Sentido de uma dívida do ponto de vista da pessoa consultada (feature 006).</summary>
public static class DebtDirections
{
    /// <summary>A pessoa consultada deve à contraparte.</summary>
    public const string OWES = "owes";

    /// <summary>A contraparte deve à pessoa consultada.</summary>
    public const string OWED = "owed";
}

/// <summary>Saldo líquido entre a pessoa e uma contraparte, numa moeda (data-model.md §PersonDebt).</summary>
public class PersonDebtInfo
{
    [JsonPropertyName("counterpartUserId")]
    public long CounterpartUserId { get; set; }

    [JsonPropertyName("counterpartName")]
    public string CounterpartName { get; set; } = string.Empty;

    [JsonPropertyName("counterpartFirstName")]
    public string CounterpartFirstName { get; set; } = string.Empty;

    /// <summary>"BRL" ou "BTC".</summary>
    [JsonPropertyName("currency")]
    public string Currency { get; set; } = string.Empty;

    /// <summary>Valor absoluto (sempre &gt; 0).</summary>
    [JsonPropertyName("amount")]
    public decimal Amount { get; set; }

    /// <summary><c>owes</c> = a pessoa deve à contraparte; <c>owed</c> = a contraparte deve a ela.</summary>
    [JsonPropertyName("direction")]
    public string Direction { get; set; } = string.Empty;
}

public class PersonDebtsResult
{
    [JsonPropertyName("userId")]
    public long UserId { get; set; }

    [JsonPropertyName("debts")]
    public List<PersonDebtInfo> Debts { get; set; } = new();
}
