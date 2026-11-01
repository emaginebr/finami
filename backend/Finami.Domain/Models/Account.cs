using Finami.Domain.Enums;
using Finami.Domain.Exceptions;

namespace Finami.Domain.Models;

/// <summary>Conta do plano de contas: carteira de usuário ou conta de sistema (externa/câmbio).</summary>
public class Account
{
    public long AccountId { get; set; }
    public AccountKind Kind { get; set; } = AccountKind.Wallet;
    public long? UserId { get; set; }
    public long? GroupId { get; set; }
    public string Name { get; set; } = string.Empty;
    public string? Description { get; set; }
    public Currency Currency { get; set; }
    public bool IsVirtual { get; set; }
    public bool IsActive { get; set; } = true;
    public long? CreatedByUserId { get; set; }
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;

    public bool IsWallet => Kind == AccountKind.Wallet;

    public void UpdateDetails(string name, string? description, bool isVirtual)
    {
        if (string.IsNullOrWhiteSpace(name))
            throw new ValidationException("Nome da carteira é obrigatório.");
        Name = name.Trim();
        Description = string.IsNullOrWhiteSpace(description) ? null : description.Trim();
        IsVirtual = isVirtual;
    }

    public void Deactivate()
    {
        if (!IsWallet)
            throw new BusinessRuleException("Contas de sistema não podem ser desativadas.");
        IsActive = false;
    }

    public void EnsureActive()
    {
        if (!IsActive)
            throw new BusinessRuleException($"A carteira \"{Name}\" está desativada.");
    }

    public void LinkToGroup(long? groupId) => GroupId = groupId;
}
