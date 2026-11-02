import type { StatementResult } from "../types/statement";
import { apiFetch } from "./apiHelpers";
import type { ApiFetchOptions } from "./apiHelpers";

const API_BASE = "/api/statements";
/** Extratos ficam guardados para uso offline (feature 005) */
const NETWORK_FIRST: ApiFetchOptions = { cache: "network-first" };

const period = (start: string, end: string): string =>
  `?${new URLSearchParams({ start, end }).toString()}`;

/**
 * Statement Service — extratos por período (`yyyy-MM-dd`, fuso de São Paulo).
 * Devolve o DTO direto e lança `ApiError` em não-2xx (research R-02).
 */
class StatementService {
  /** Extrato de uma carteira (`GET /api/statements/wallets/{id}`) */
  async getWallet(walletId: number, start: string, end: string): Promise<StatementResult> {
    return apiFetch<StatementResult>(`${API_BASE}/wallets/${walletId}${period(start, end)}`, NETWORK_FIRST);
  }

  /** Extrato de uma pessoa (`GET /api/statements/users/{id}`) */
  async getUser(userId: number, start: string, end: string): Promise<StatementResult> {
    return apiFetch<StatementResult>(`${API_BASE}/users/${userId}${period(start, end)}`, NETWORK_FIRST);
  }

  /** Extrato de uma família (`GET /api/statements/groups/{id}`) */
  async getGroup(groupId: number, start: string, end: string): Promise<StatementResult> {
    return apiFetch<StatementResult>(`${API_BASE}/groups/${groupId}${period(start, end)}`, NETWORK_FIRST);
  }
}

export const statementService = new StatementService();
export default StatementService;
