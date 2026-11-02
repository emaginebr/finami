import type { GroupBalancesResult, UserGroupBalancesResult } from "../types/balance";
import { apiFetch } from "./apiHelpers";

/**
 * Balance Service — saldos por membro (contracts/api-additions.md §2–3).
 * O nível de detalhe vem do servidor; o frontend só apresenta o que recebe.
 */
class BalanceService {
  /** Saldo de cada membro da família (`GET /api/groups/{id}/balances`) */
  async getGroupBalances(groupId: number): Promise<GroupBalancesResult> {
    return apiFetch<GroupBalancesResult>(`/api/groups/${groupId}/balances`, { cache: "network-first" });
  }

  /** Carteiras de uma pessoa nas famílias visíveis (`GET /api/users/{id}/group-balances`) */
  async getUserGroupBalances(userId: number): Promise<UserGroupBalancesResult> {
    return apiFetch<UserGroupBalancesResult>(`/api/users/${userId}/group-balances`, {
      cache: "network-first",
    });
  }
}

export const balanceService = new BalanceService();
export default BalanceService;
