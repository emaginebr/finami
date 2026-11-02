import { createContext, useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { ReactNode } from "react";
import { quoteService } from "../Services/quoteService";
import { OFFLINE_CONTENT_MESSAGE, isApiError } from "../types/api";
import { QuoteStatus } from "../types/quote";
import type { BtcQuoteInfo } from "../types/quote";
import { errorMessage } from "../utils/notify";
import { useOnReconnected } from "../hooks/useOnReconnected";
import { useOnUserChange } from "../hooks/useOnUserChange";

/** Intervalo de atualização automática da cotação (só com a aba visível) */
export const QUOTE_REFRESH_MS = 60_000;

export interface QuoteContextType {
  quote: BtcQuoteInfo | null;
  status: QuoteStatus;
  loading: boolean;
  error: string | null;
  /** O último erro foi "sem internet e sem dado guardado" (feature 005) */
  offline: boolean;
  /** A cotação exibida veio do cache local (sem internet) — mostrar a data dela (T042) */
  cached: boolean;
  /** Busca a cotação; nunca lança (o estado reflete a falha) */
  loadQuote: () => Promise<void>;
  clearError: () => void;
}

const QuoteContext = createContext<QuoteContextType | undefined>(undefined);

export const QuoteProvider = ({ children }: { children: ReactNode }) => {
  const [quote, setQuote] = useState<BtcQuoteInfo | null>(null);
  const [status, setStatus] = useState<QuoteStatus>(QuoteStatus.Loading);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [cached, setCached] = useState(false);
  const quoteRef = useRef<BtcQuoteInfo | null>(null);

  const userId = useOnUserChange(() => {
    quoteRef.current = null;
    setQuote(null);
    setStatus(QuoteStatus.Loading);
    setError(null);
    setCached(false);
  });

  const loadQuote = useCallback(async (): Promise<void> => {
    try {
      setLoading(true);
      setError(null);
      let fromCache = false;
      const result = await quoteService.getBtc((info) => {
        fromCache = info.stale;
      });
      quoteRef.current = result;
      setQuote(result);
      setCached(fromCache);
      // Cotação guardada (sem internet) é sempre tratada como desatualizada
      setStatus(result.isStale || fromCache ? QuoteStatus.Stale : QuoteStatus.Available);
    } catch (err) {
      setError(errorMessage(err));
      if (isApiError(err) && err.status === 503) {
        quoteRef.current = null;
        setQuote(null);
        setStatus(QuoteStatus.Unavailable);
      } else if (quoteRef.current) {
        // Falha momentânea: mantém a última cotação, marcada como desatualizada
        setStatus(QuoteStatus.Stale);
      } else {
        setStatus(QuoteStatus.Unavailable);
      }
    } finally {
      setLoading(false);
    }
  }, []);

  // Atualiza a cada 60 s só com a aba visível; ao voltar para a aba, atualiza na hora
  useEffect(() => {
    if (userId === null) return undefined;
    const refreshIfVisible = () => {
      if (document.visibilityState === "visible") void loadQuote();
    };
    const timer = window.setInterval(refreshIfVisible, QUOTE_REFRESH_MS);
    document.addEventListener("visibilitychange", refreshIfVisible);
    return () => {
      window.clearInterval(timer);
      document.removeEventListener("visibilitychange", refreshIfVisible);
    };
  }, [userId, loadQuote]);

  // Conexão voltou: cotação em dia (a do cache fica marcada como desatualizada até lá)
  useOnReconnected(() => {
    if (userId !== null) void loadQuote();
  });

  const clearError = useCallback(() => setError(null), []);
  const offline = error === OFFLINE_CONTENT_MESSAGE;

  const value = useMemo<QuoteContextType>(
    () => ({ quote, status, loading, error, offline, cached, loadQuote, clearError }),
    [quote, status, loading, error, offline, cached, loadQuote, clearError],
  );

  return <QuoteContext.Provider value={value}>{children}</QuoteContext.Provider>;
};

export default QuoteContext;
