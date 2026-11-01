/** Tipos de "Assistentes conectados" (specs/004 contracts/api.md) */

/** Conexão ativa de um assistente (`GET /api/oauth/connections`) */
export interface OAuthConnectionInfo {
  connectionId: number;
  /** Nome do assistente (ex.: "Claude") */
  clientName: string;
  /** Escopos concedidos (`finami:read`, `finami:write`) */
  scopes: string[];
  /** Quando a pessoa autorizou (ISO 8601) */
  createdAt: string;
  /** Último uso pelo assistente; `null` se ainda não usado */
  lastUsedAt: string | null;
}

/** Endereço do MCP para copiar (`GET /api/oauth/mcp-info`) */
export interface McpInfo {
  mcpUrl: string;
}
