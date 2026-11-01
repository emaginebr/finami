using System.Text.Json.Serialization;

namespace Finami.DTO.Balances;

/// <summary>Nível de detalhe dos saldos de um grupo, definido pelo servidor (contracts/api-additions.md §2).</summary>
[JsonConverter(typeof(JsonStringEnumConverter))]
public enum DetailLevel
{
    /// <summary>Totais por membro e carteiras.</summary>
    Full = 1,

    /// <summary>Totais por membro, sem carteiras.</summary>
    Summary = 2,

    /// <summary>Só a lista de membros; valores nulos.</summary>
    Hidden = 3
}

/// <summary>Cotação usada nas estimativas; desatualizada é aceita e sinalizada em <see cref="IsStale"/>.</summary>
public class BalanceQuoteInfo
{
    [JsonPropertyName("priceBrl")]
    public decimal PriceBrl { get; set; }

    [JsonPropertyName("quotedAt")]
    public DateTime QuotedAt { get; set; }

    [JsonPropertyName("isStale")]
    public bool IsStale { get; set; }
}

/// <summary>Saldo de uma carteira ativa (só em <see cref="DetailLevel.Full"/>).</summary>
public class WalletBalanceInfo
{
    [JsonPropertyName("walletId")]
    public long WalletId { get; set; }

    [JsonPropertyName("name")]
    public string Name { get; set; } = string.Empty;

    /// <summary>"BRL" ou "BTC".</summary>
    [JsonPropertyName("currency")]
    public string Currency { get; set; } = string.Empty;

    [JsonPropertyName("isVirtual")]
    public bool IsVirtual { get; set; }

    [JsonPropertyName("balance")]
    public decimal Balance { get; set; }

    /// <summary>Só BTC: saldo × cotação, truncado em 2 casas; null sem cotação.</summary>
    [JsonPropertyName("estimatedBrl")]
    public decimal? EstimatedBrl { get; set; }

    /// <summary>Quem pergunta pode abrir GET /api/statements/wallets/{id}.</summary>
    [JsonPropertyName("canViewStatement")]
    public bool CanViewStatement { get; set; }
}

/// <summary>GET /api/groups/{groupId}/balances — saldo por membro (FR-029).</summary>
public class GroupBalancesResult
{
    [JsonPropertyName("groupId")]
    public long GroupId { get; set; }

    [JsonPropertyName("name")]
    public string Name { get; set; } = string.Empty;

    /// <summary>"ResponsibleOnly", "AllMembers" ou "MembersSummary".</summary>
    [JsonPropertyName("statementVisibility")]
    public string StatementVisibility { get; set; } = string.Empty;

    [JsonPropertyName("isResponsible")]
    public bool IsResponsible { get; set; }

    [JsonPropertyName("detailLevel")]
    public DetailLevel DetailLevel { get; set; }

    /// <summary>Null se nunca houve cotação.</summary>
    [JsonPropertyName("quote")]
    public BalanceQuoteInfo? Quote { get; set; }

    /// <summary>True quando há saldo BTC e não há cotação: o BTC fica fora de totalBrl.</summary>
    [JsonPropertyName("btcExcluded")]
    public bool BtcExcluded { get; set; }

    /// <summary>Null quando detailLevel = Hidden.</summary>
    [JsonPropertyName("totalBrl")]
    public decimal? TotalBrl { get; set; }

    [JsonPropertyName("members")]
    public List<MemberBalanceInfo> Members { get; set; } = new();
}

/// <summary>Saldo de um membro no grupo; valores null em <see cref="DetailLevel.Hidden"/>.</summary>
public class MemberBalanceInfo
{
    [JsonPropertyName("userId")]
    public long UserId { get; set; }

    [JsonPropertyName("firstName")]
    public string FirstName { get; set; } = string.Empty;

    [JsonPropertyName("lastName")]
    public string LastName { get; set; } = string.Empty;

    [JsonPropertyName("isResponsible")]
    public bool IsResponsible { get; set; }

    [JsonPropertyName("balanceBrl")]
    public decimal? BalanceBrl { get; set; }

    [JsonPropertyName("balanceBtc")]
    public decimal? BalanceBtc { get; set; }

    /// <summary>balanceBtc × cotação, truncado em 2 casas; null em Hidden ou sem cotação.</summary>
    [JsonPropertyName("estimatedBrl")]
    public decimal? EstimatedBrl { get; set; }

    /// <summary>balanceBrl + estimatedBrl (sem o BTC se btcExcluded); null em Hidden.</summary>
    [JsonPropertyName("totalBrl")]
    public decimal? TotalBrl { get; set; }

    [JsonPropertyName("wallets")]
    public List<WalletBalanceInfo> Wallets { get; set; } = new();
}

/// <summary>GET /api/users/{userId}/group-balances — carteiras do membro nas famílias (FR-030).</summary>
public class UserGroupBalancesResult
{
    [JsonPropertyName("userId")]
    public long UserId { get; set; }

    [JsonPropertyName("firstName")]
    public string FirstName { get; set; } = string.Empty;

    [JsonPropertyName("lastName")]
    public string LastName { get; set; } = string.Empty;

    [JsonPropertyName("btcExcluded")]
    public bool BtcExcluded { get; set; }

    /// <summary>Soma dos totalBrl dos grupos listados.</summary>
    [JsonPropertyName("totalBrl")]
    public decimal TotalBrl { get; set; }

    [JsonPropertyName("groups")]
    public List<UserGroupBalanceInfo> Groups { get; set; } = new();
}

/// <summary>Saldo do membro em um grupo (nunca Hidden: grupos ocultos não são listados).</summary>
public class UserGroupBalanceInfo
{
    [JsonPropertyName("groupId")]
    public long GroupId { get; set; }

    [JsonPropertyName("name")]
    public string Name { get; set; } = string.Empty;

    [JsonPropertyName("detailLevel")]
    public DetailLevel DetailLevel { get; set; }

    [JsonPropertyName("balanceBrl")]
    public decimal BalanceBrl { get; set; }

    [JsonPropertyName("balanceBtc")]
    public decimal BalanceBtc { get; set; }

    /// <summary>balanceBtc × cotação, truncado em 2 casas; null sem cotação.</summary>
    [JsonPropertyName("estimatedBrl")]
    public decimal? EstimatedBrl { get; set; }

    [JsonPropertyName("totalBrl")]
    public decimal TotalBrl { get; set; }

    [JsonPropertyName("wallets")]
    public List<WalletBalanceInfo> Wallets { get; set; } = new();
}
