import { ConnectivityStatus } from "../types/connectivity";
import type { FreshnessInfo } from "../types/connectivity";

/**
 * Store de conectividade fora do React (feature 005, research R-04). O `apiFetch` reporta o
 * resultado real das chamadas (resposta HTTP → online; falha de rede/timeout → offline) e o
 * `ConnectivityContext` assina o store para a interface.
 *
 * O evento `offline` do navegador marca offline na hora. O evento `online` **não** marca online
 * aqui: o `ConnectivityContext` faz um ping na API antes (Wi-Fi sem internet dá falso positivo).
 */

interface Listener {
  (): void;
}

const initialStatus = (): ConnectivityStatus =>
  typeof navigator !== "undefined" && navigator.onLine === false
    ? ConnectivityStatus.Offline
    : ConnectivityStatus.Online;

let status: ConnectivityStatus = initialStatus();
/** `fetchedAt` stale mais antigo dos dados da navegação atual */
let oldestStaleFetchedAt: string | null = null;
const listeners = new Set<Listener>();

const emit = () => {
  listeners.forEach((listener) => listener());
};

const setStatus = (next: ConnectivityStatus) => {
  if (status === next) return;
  status = next;
  emit();
};

/** Estado atual da conexão */
export const getStatus = (): ConnectivityStatus => status;

/** Houve resposta HTTP (qualquer status) */
export const reportOnline = (): void => setStatus(ConnectivityStatus.Online);

/** Falha de rede, timeout ou evento `offline` do navegador */
export const reportOffline = (): void => setStatus(ConnectivityStatus.Offline);

/** Registra a procedência de um dado; só os stale contam para o indicador */
export const reportFreshness = ({ stale, fetchedAt }: FreshnessInfo): void => {
  if (!stale) return;
  const time = Date.parse(fetchedAt);
  if (Number.isNaN(time)) return;
  if (oldestStaleFetchedAt !== null && Date.parse(oldestStaleFetchedAt) <= time) return;
  oldestStaleFetchedAt = fetchedAt;
  emit();
};

/** Esquece a data dos dados antigos (troca de tela) */
export const resetFreshness = (): void => {
  if (oldestStaleFetchedAt === null) return;
  oldestStaleFetchedAt = null;
  emit();
};

/** Data (ISO) do dado guardado mais antigo exibido na navegação atual, ou `null` */
export const getOldestStaleFetchedAt = (): string | null => oldestStaleFetchedAt;

/** Assina mudanças de estado ou de data; devolve a função que cancela */
export const subscribe = (listener: Listener): (() => void) => {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
};

/** Volta ao estado inicial (`navigator.onLine`, sem data) — usado entre testes */
export const resetConnectivity = (): void => {
  status = initialStatus();
  oldestStaleFetchedAt = null;
  emit();
};

if (typeof window !== "undefined") {
  window.addEventListener("offline", reportOffline);
}
