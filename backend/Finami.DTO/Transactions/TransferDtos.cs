using System.Text.Json.Serialization;

namespace Finami.DTO.Transactions;

public class TransferInfo
{
    [JsonPropertyName("sourceWalletId")]
    public long SourceWalletId { get; set; }

    [JsonPropertyName("destinationWalletId")]
    public long DestinationWalletId { get; set; }

    /// <summary>Valor na moeda da carteira de origem; informe este ou <see cref="AmountBrl"/>.</summary>
    [JsonPropertyName("amount")]
    public decimal? Amount { get; set; }

    /// <summary>Valor em reais, só para transferência entre carteiras de bitcoin (convertido pela cotação atual).</summary>
    [JsonPropertyName("amountBrl")]
    public decimal? AmountBrl { get; set; }

    /// <summary>
    /// Feature 007: <c>loan</c>, <c>settlement</c> ou <c>payment</c>. Só entre titulares diferentes (padrão
    /// <c>loan</c>); entre carteiras do mesmo titular precisa estar ausente.
    /// </summary>
    [JsonPropertyName("kind")]
    public string? Kind { get; set; }

    /// <summary>Feature 007: moeda da dívida quitada (<c>BRL</c>/<c>BTC</c>), só em quitação; padrão = moeda das carteiras.</summary>
    [JsonPropertyName("debtCurrency")]
    public string? DebtCurrency { get; set; }

    /// <summary>Feature 007: quita a dívida inteira (só em quitação); exclui <see cref="Amount"/> e <see cref="AmountBrl"/>.</summary>
    [JsonPropertyName("settleAll")]
    public bool SettleAll { get; set; }

    [JsonPropertyName("description")]
    public string? Description { get; set; }
}

/// <summary>Feature 007: efeito de um empréstimo ou de uma quitação na dívida entre as duas pessoas.</summary>
public class TransferDebtEffect
{
    /// <summary>Moeda da dívida (<c>BRL</c>/<c>BTC</c>).</summary>
    [JsonPropertyName("currency")]
    public string Currency { get; set; } = string.Empty;

    /// <summary>Valor emprestado ou abatido, na moeda da dívida.</summary>
    [JsonPropertyName("amount")]
    public decimal Amount { get; set; }

    /// <summary>Saldo "devedor deve a credor" antes do lançamento (negativo: era o credor quem devia).</summary>
    [JsonPropertyName("before")]
    public decimal Before { get; set; }

    /// <summary>O mesmo saldo depois do lançamento (0 em "quitar tudo").</summary>
    [JsonPropertyName("after")]
    public decimal After { get; set; }

    [JsonPropertyName("debtorUserId")]
    public long DebtorUserId { get; set; }

    [JsonPropertyName("creditorUserId")]
    public long CreditorUserId { get; set; }

    /// <summary>Primeiro nome do devedor, para o texto "Bruno deve a Ana" (MCP e app).</summary>
    [JsonPropertyName("debtorFirstName")]
    public string DebtorFirstName { get; set; } = string.Empty;

    [JsonPropertyName("creditorFirstName")]
    public string CreditorFirstName { get; set; } = string.Empty;
}

public class TransferPreviewResult
{
    [JsonPropertyName("type")]
    public string Type { get; set; } = string.Empty;

    [JsonPropertyName("sourceAmount")]
    public decimal SourceAmount { get; set; }

    [JsonPropertyName("destinationAmount")]
    public decimal DestinationAmount { get; set; }

    [JsonPropertyName("quote")]
    public QuoteRefInfo? Quote { get; set; }

    /// <summary>Feature 007: <c>loan</c>/<c>settlement</c>/<c>payment</c>; null entre carteiras do mesmo titular.</summary>
    [JsonPropertyName("kind")]
    public string? Kind { get; set; }

    /// <summary>Feature 007: efeito na dívida; null em pagamento e entre carteiras do mesmo titular.</summary>
    [JsonPropertyName("debt")]
    public TransferDebtEffect? Debt { get; set; }
}

public class ReverseInfo
{
    [JsonPropertyName("description")]
    public string? Description { get; set; }
}
