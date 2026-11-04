using System.Text.Json.Serialization;

namespace Finami.DTO.Wallets;

public class WalletInfo
{
    [JsonPropertyName("walletId")]
    public long WalletId { get; set; }

    [JsonPropertyName("name")]
    public string Name { get; set; } = string.Empty;

    [JsonPropertyName("description")]
    public string? Description { get; set; }

    /// <summary>"BRL" ou "BTC".</summary>
    [JsonPropertyName("currency")]
    public string Currency { get; set; } = string.Empty;

    [JsonPropertyName("isVirtual")]
    public bool IsVirtual { get; set; }

    [JsonPropertyName("isActive")]
    public bool IsActive { get; set; }

    [JsonPropertyName("ownerUserId")]
    public long OwnerUserId { get; set; }

    [JsonPropertyName("ownerName")]
    public string OwnerName { get; set; } = string.Empty;

    /// <summary>Primeiro nome do titular (campo De da transferência, feature 006).</summary>
    [JsonPropertyName("ownerFirstName")]
    public string OwnerFirstName { get; set; } = string.Empty;

    [JsonPropertyName("groupId")]
    public long? GroupId { get; set; }

    [JsonPropertyName("balance")]
    public decimal Balance { get; set; }

    /// <summary>Somente BTC: saldo × cotação atual; null sem cotação.</summary>
    [JsonPropertyName("estimatedBrl")]
    public decimal? EstimatedBrl { get; set; }

    [JsonPropertyName("canControl")]
    public bool CanControl { get; set; }

    /// <summary>
    /// Feature 008 (R-07): quem consulta pode lançar com origem nesta carteira (depósito, saque, transferência).
    /// </summary>
    [JsonPropertyName("canCreateTransactions")]
    public bool CanCreateTransactions { get; set; }

    [JsonPropertyName("createdAt")]
    public DateTime CreatedAt { get; set; }
}

public class WalletInsertInfo
{
    [JsonPropertyName("name")]
    public string Name { get; set; } = string.Empty;

    [JsonPropertyName("description")]
    public string? Description { get; set; }

    /// <summary>"BRL" ou "BTC".</summary>
    [JsonPropertyName("currency")]
    public string Currency { get; set; } = string.Empty;

    [JsonPropertyName("isVirtual")]
    public bool IsVirtual { get; set; }

    /// <summary>Titular; omitido = o próprio usuário.</summary>
    [JsonPropertyName("ownerUserId")]
    public long? OwnerUserId { get; set; }

    [JsonPropertyName("groupId")]
    public long? GroupId { get; set; }
}

public class WalletUpdateInfo
{
    [JsonPropertyName("name")]
    public string Name { get; set; } = string.Empty;

    [JsonPropertyName("description")]
    public string? Description { get; set; }

    [JsonPropertyName("isVirtual")]
    public bool IsVirtual { get; set; }
}

/// <summary>Dados mínimos de uma carteira de terceiro, para confirmar o destino (FR-026a).</summary>
public class WalletPublicInfo
{
    [JsonPropertyName("walletId")]
    public long WalletId { get; set; }

    [JsonPropertyName("name")]
    public string Name { get; set; } = string.Empty;

    [JsonPropertyName("currency")]
    public string Currency { get; set; } = string.Empty;

    [JsonPropertyName("ownerName")]
    public string OwnerName { get; set; } = string.Empty;

    [JsonPropertyName("isActive")]
    public bool IsActive { get; set; }
}

public class WalletGroupInfo
{
    [JsonPropertyName("groupId")]
    public long? GroupId { get; set; }
}

/// <summary>Opção do campo Para da transferência (feature 006, contracts/api.md).</summary>
public class TransferDestinationInfo
{
    [JsonPropertyName("walletId")]
    public long WalletId { get; set; }

    [JsonPropertyName("name")]
    public string Name { get; set; } = string.Empty;

    /// <summary>"BRL" ou "BTC".</summary>
    [JsonPropertyName("currency")]
    public string Currency { get; set; } = string.Empty;

    [JsonPropertyName("ownerUserId")]
    public long OwnerUserId { get; set; }

    [JsonPropertyName("ownerFirstName")]
    public string OwnerFirstName { get; set; } = string.Empty;

    /// <summary>Carteira do mesmo titular da origem.</summary>
    [JsonPropertyName("isOwn")]
    public bool IsOwn { get; set; }

    /// <summary>Null quando quem consulta não pode ver o extrato da carteira (saldo oculto).</summary>
    [JsonPropertyName("balance")]
    public decimal? Balance { get; set; }
}

public class TransferDestinationsResult
{
    [JsonPropertyName("sourceWalletId")]
    public long SourceWalletId { get; set; }

    /// <summary>Mesma moeda da origem: carteiras do titular e das pessoas da família, sem a origem.</summary>
    [JsonPropertyName("sameCurrency")]
    public List<TransferDestinationInfo> SameCurrency { get; set; } = new();

    /// <summary>Carteiras do próprio titular na outra moeda (conversão).</summary>
    [JsonPropertyName("conversion")]
    public List<TransferDestinationInfo> Conversion { get; set; } = new();
}
