import { createContext, useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { ReactNode } from "react";
import { quoteService } from "../Services/quoteService";
import { isApiError } from "../types/api";
import { QuoteStatus } from "../types/quote";
import type { BtcQuoteInfo } from "../types/quote";
import { errorMessage } from "../utils/notify";
import { useOnUserChange } from "../hooks/useOnUserChange";

/** Intervalo de atualização automática da cotação (só com a aba visível) */
export const QUOTE_REFRESH_MS = 60_000;

export interface QuoteContextType {
  quote: BtcQuoteInfo | null;
  status: QuoteStatus;
  loading: boolean;
  error: string | null;
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
  const quoteRef = useRef<BtcQuoteInfo | null>(null);

  const userId = useOnUserChange(() => {
    quoteRef.current = null;
    setQuote(null);
    setStatus(QuoteStatus.Loading);
    setError(null);
  });

  const loadQuote = useCallback(async (): Promise<void> => {
    try {
      setLoading(true);
      setError(null);
      const result = await quoteService.getBtc();
      quoteRef.current = result;
      setQuote(result);
      setStatus(result.isStale ? QuoteStatus.Stale : QuoteStatus.Available);
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

  const clearError = useCallback(() => setError(null), []);

  const value = useMemo<QuoteContextType>(
    () => ({ quote, status, loading, error, loadQuote, clearError }),
    [quote, status, loading, error, loadQuote, clearError],
  );

  return <QuoteContext.Provider value={value}>{children}</QuoteContext.Provider>;
};

export default QuoteContext;
