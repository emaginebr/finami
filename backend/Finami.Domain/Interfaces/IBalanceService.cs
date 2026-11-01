using Finami.DTO.Balances;

namespace Finami.Domain.Interfaces;

/// <summary>Saldos por membro de grupo e por usuário nas famílias (FR-029/FR-030, contracts/api-additions.md §2–3).</summary>
public interface IBalanceService
{
    /// <summary>Saldo por membro do grupo; quem pergunta precisa ser membro (senão NotFoundException).</summary>
    Task<GroupBalancesResult> GetGroupBalancesAsync(long userId, long groupId);

    /// <summary>Carteiras de <paramref name="userId"/> nos grupos visíveis para <paramref name="viewerId"/>.</summary>
    Task<UserGroupBalancesResult> GetUserGroupBalancesAsync(long viewerId, long userId);
}
