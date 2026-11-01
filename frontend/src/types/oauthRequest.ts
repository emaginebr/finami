/** Tipos do pedido de autorização OAuth (specs/004 contracts/api.md "Consentimento") */

/** Escopos que um assistente pode pedir */
export enum OAuthScope {
  /** Consultar saldos, carteiras, extratos, família e notificações */
  Read = "finami:read",
  /** Lançar e gerenciar (sempre acompanhado de `finami:read`) */
  Write = "finami:write",
}

/** Pedido de autorização pendente (`GET /api/oauth/requests/{requestKey}`) */
export interface OAuthRequestInfo {
  /** Chave opaca do pedido (vem em `/autorizar?pedido=`) */
  requestKey: string;
  /** Nome do assistente que pediu acesso (ex.: "Claude") */
  clientName: string;
  /** Host para onde a pessoa volta depois de responder (ex.: "claude.ai") */
  redirectHost: string;
  /** Escopos pedidos pelo assistente */
  scopesRequested: string[];
  /** Quando o pedido vence (ISO 8601) */
  expiresAt: string;
}

/** Corpo de `POST /api/oauth/requests/{requestKey}/approve` (subconjunto não vazio do pedido) */
export interface OAuthApproveInfo {
  scopes: string[];
}

/** Resposta de approve/deny: endereço de retorno ao assistente */
export interface OAuthRedirectResult {
  redirectUrl: string;
}

/** Escopos efetivos da escolha "Consultar" */
export const READ_ONLY_SCOPES: string[] = [OAuthScope.Read];

/** Escopos efetivos da escolha "Consultar e fazer alterações" */
export const READ_WRITE_SCOPES: string[] = [OAuthScope.Read, OAuthScope.Write];

/** `true` quando a lista de escopos inclui `finami:write` */
export const hasWriteScope = (scopes: string[]): boolean => scopes.includes(OAuthScope.Write);
