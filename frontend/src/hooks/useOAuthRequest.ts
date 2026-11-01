import { useCallback, useEffect, useRef, useState } from "react";
import { oauthRequestService } from "../Services/oauthRequestService";
import { ApiError, GENERIC_ERROR_MESSAGE, isApiError } from "../types/api";
import type { OAuthRedirectResult, OAuthRequestInfo } from "../types/oauthRequest";

const toApiError = (err: unknown): ApiError =>
  isApiError(err) ? err : new ApiError(500, err instanceof Error && err.message ? err.message : GENERIC_ERROR_MESSAGE);

const isAbort = (err: unknown): boolean => err instanceof DOMException && err.name === "AbortError";

export interface UseOAuthRequestResult {
  /** Pedido carregado (`null` enquanto carrega ou em erro) */
  request: OAuthRequestInfo | null;
  loading: boolean;
  /** Erro do último carregamento (status 404/410/0…); mantido durante uma nova tentativa */
  error: ApiError | null;
  /** Refaz o `GET` (botão "Tentar de novo") */
  reload: () => Promise<void>;
  /** Autoriza com os escopos escolhidos; lança `ApiError` */
  approve: (scopes: string[]) => Promise<OAuthRedirectResult>;
  /** Nega o pedido; lança `ApiError` */
  deny: () => Promise<OAuthRedirectResult>;
}

/**
 * Pedido de autorização da tela `/autorizar` (uso pontual, sem Context — tasks T025).
 * Com `requestKey` nulo não chama a API.
 */
export const useOAuthRequest = (requestKey: string | null): UseOAuthRequestResult => {
  const [request, setRequest] = useState<OAuthRequestInfo | null>(null);
  const [loading, setLoading] = useState(requestKey !== null);
  const [error, setError] = useState<ApiError | null>(null);
  const controllerRef = useRef<AbortController | null>(null);

  const load = useCallback(async (): Promise<void> => {
    if (requestKey === null) return;
    controllerRef.current?.abort();
    const controller = new AbortController();
    controllerRef.current = controller;
    try {
      // O erro anterior só sai no sucesso: em "Tentar de novo" a faixa (e o botão focado) continua montada
      setLoading(true);
      const result = await oauthRequestService.get(requestKey, controller.signal);
      if (controller.signal.aborted) return;
      setRequest(result);
      setError(null);
    } catch (err) {
      if (isAbort(err) || controller.signal.aborted) return;
      setRequest(null);
      setError(toApiError(err));
    } finally {
      if (!controller.signal.aborted) setLoading(false);
    }
  }, [requestKey]);

  useEffect(() => {
    void load();
    return () => controllerRef.current?.abort();
  }, [load]);

  const approve = useCallback(
    (scopes: string[]): Promise<OAuthRedirectResult> => {
      if (requestKey === null) return Promise.reject(new ApiError(404, GENERIC_ERROR_MESSAGE));
      return oauthRequestService.approve(requestKey, scopes);
    },
    [requestKey],
  );

  const deny = useCallback((): Promise<OAuthRedirectResult> => {
    if (requestKey === null) return Promise.reject(new ApiError(404, GENERIC_ERROR_MESSAGE));
    return oauthRequestService.deny(requestKey);
  }, [requestKey]);

  return { request, loading, error, reload: load, approve, deny };
};

export default useOAuthRequest;
