import type {
  TransferDestinationsResult,
  WalletGroupInfo,
  WalletInfo,
  WalletInsertInfo,
  WalletListFilters,
  WalletUpdateInfo,
} from "../types/wallet";
import { apiFetch } from "./apiHelpers";

const API_BASE = "/api/wallets";

const toQuery = (filters: WalletListFilters): string => {
  const params = new URLSearchParams();
  if (filters.groupId !== undefined) params.set("groupId", String(filters.groupId));
  if (filters.ownerUserId !== undefined) params.set("ownerUserId", String(filters.ownerUserId));
  if (filters.includeInactive) params.set("includeInactive", "true");
  const query = params.toString();
  return query ? `?${query}` : "";
};

/**
 * Wallet Service — rotas de `/api/wallets`.
 * Devolve o DTO direto e lança `ApiError` em não-2xx (research R-02).
 */
class WalletService {
  /** Carteiras que a pessoa controla (`GET /api/wallets`) */
  async list(filters: WalletListFilters = {}): Promise<WalletInfo[]> {
    return apiFetch<WalletInfo[]>(`${API_BASE}${toQuery(filters)}`, { cache: "network-first" });
  }

  /** Uma carteira (`GET /api/wallets/{id}`) */
  async get(walletId: number): Promise<WalletInfo> {
    return apiFetch<WalletInfo>(`${API_BASE}/${walletId}`, { cache: "network-first" });
  }

  /** Cria uma carteira (`POST /api/wallets`) */
  async create(data: WalletInsertInfo): Promise<WalletInfo> {
    return apiFetch<WalletInfo>(API_BASE, { method: "POST", body: data });
  }

  /** Atualiza nome, descrição e virtual (`PUT /api/wallets/{id}`) */
  async update(walletId: number, data: WalletUpdateInfo): Promise<WalletInfo> {
    return apiFetch<WalletInfo>(`${API_BASE}/${walletId}`, { method: "PUT", body: data });
  }

  /** Vincula ou desvincula a família (`PUT /api/wallets/{id}/group`) */
  async setGroup(walletId: number, data: WalletGroupInfo): Promise<WalletInfo> {
    return apiFetch<WalletInfo>(`${API_BASE}/${walletId}/group`, { method: "PUT", body: data });
  }

  /** Desativa (`POST /api/wallets/{id}/deactivate`) */
  async deactivate(walletId: number): Promise<WalletInfo | undefined> {
    return apiFetch<WalletInfo | undefined>(`${API_BASE}/${walletId}/deactivate`, { method: "POST" });
  }

  /** Exclui; 422 quando há lançamentos (`DELETE /api/wallets/{id}`) */
  async delete(walletId: number): Promise<void> {
    await apiFetch<void>(`${API_BASE}/${walletId}`, { method: "DELETE" });
  }

  /**
   * Opções do campo Para para a origem `walletId` (`GET /api/wallets/{id}/transfer-destinations`):
   * grupos "Família" (mesma moeda) e "Converter". Guardada no cache da sessão para uso offline.
   */
  async getTransferDestinations(walletId: number): Promise<TransferDestinationsResult> {
    return apiFetch<TransferDestinationsResult>(`${API_BASE}/${walletId}/transfer-destinations`, {
      cache: "network-first",
    });
  }
}

export const walletService = new WalletService();
export default WalletService;
