import type { McpInfo, OAuthConnectionInfo } from "../types/oauthConnection";
import { apiFetch } from "./apiHelpers";

const BASE = "/api/oauth";

/**
 * OAuth Connection Service — assistentes conectados (specs/004 contracts/api.md).
 * Devolve o DTO direto e lança `ApiError` em não-2xx.
 */
class OAuthConnectionService {
  /** Conexões ativas, mais recentes primeiro (`GET /api/oauth/connections`) */
  async list(): Promise<OAuthConnectionInfo[]> {
    return apiFetch<OAuthConnectionInfo[]>(`${BASE}/connections`);
  }

  /** Revoga uma conexão e os tokens dela (`DELETE /api/oauth/connections/{id}` → 204) */
  async disconnect(connectionId: number): Promise<void> {
    await apiFetch<void>(`${BASE}/connections/${connectionId}`, { method: "DELETE" });
  }

  /** Revoga todas as conexões ativas da pessoa (`DELETE /api/oauth/connections` → 204) */
  async disconnectAll(): Promise<void> {
    await apiFetch<void>(`${BASE}/connections`, { method: "DELETE" });
  }

  /** Endereço público do MCP (`GET /api/oauth/mcp-info`) */
  async mcpInfo(): Promise<McpInfo> {
    return apiFetch<McpInfo>(`${BASE}/mcp-info`);
  }
}

export const oauthConnectionService = new OAuthConnectionService();
export default OAuthConnectionService;
