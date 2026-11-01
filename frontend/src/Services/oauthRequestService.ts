import type { OAuthApproveInfo, OAuthRedirectResult, OAuthRequestInfo } from "../types/oauthRequest";
import { apiFetch } from "./apiHelpers";

const BASE = "/api/oauth/requests";

const requestPath = (requestKey: string) => `${BASE}/${encodeURIComponent(requestKey)}`;

/**
 * OAuth Request Service — tela de consentimento (specs/004 contracts/api.md).
 * Devolve o DTO direto e lança `ApiError` em não-2xx (404 inexistente, 410 vencido).
 */
class OAuthRequestService {
  /** Dados do pedido pendente (`GET /api/oauth/requests/{requestKey}`) */
  async get(requestKey: string, signal?: AbortSignal): Promise<OAuthRequestInfo> {
    return apiFetch<OAuthRequestInfo>(requestPath(requestKey), { signal });
  }

  /** Autoriza com os escopos escolhidos (`POST …/approve`) */
  async approve(requestKey: string, scopes: string[]): Promise<OAuthRedirectResult> {
    const body: OAuthApproveInfo = { scopes };
    return apiFetch<OAuthRedirectResult>(`${requestPath(requestKey)}/approve`, { method: "POST", body });
  }

  /** Nega o pedido (`POST …/deny`); a URL de retorno leva `error=access_denied` */
  async deny(requestKey: string): Promise<OAuthRedirectResult> {
    return apiFetch<OAuthRedirectResult>(`${requestPath(requestKey)}/deny`, { method: "POST" });
  }
}

export const oauthRequestService = new OAuthRequestService();
export default OAuthRequestService;
