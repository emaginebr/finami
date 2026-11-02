import { createElement } from "react";
import { Wifi, WifiOff } from "lucide-react";
import { toast } from "sonner";
import { GENERIC_ERROR_MESSAGE, isApiError } from "../types/api";

/** Mensagem legível para qualquer erro (ApiError traz a mensagem do servidor ou a de rede) */
export const errorMessage = (err: unknown): string => {
  if (isApiError(err)) return err.mensagem;
  if (err instanceof Error && err.message) return err.message;
  return GENERIC_ERROR_MESSAGE;
};

/** Toast de sucesso (anunciado por leitores de tela via aria-live do sonner) */
export const notifySuccess = (message: string): void => {
  toast.success(message);
};

/** Toast informativo de reconexão ("Conexão restabelecida.", ícone `Wifi` — components.md §9) */
export const notifyInfo = (message: string): void => {
  toast.info(message, {
    icon: createElement(Wifi, { "aria-hidden": true, className: "size-5 text-positive", strokeWidth: 1.75 }),
  });
};

/** Toast neutro de orientação (ex.: como instalar pelo menu do navegador) */
export const notifyMessage = (message: string): void => {
  toast(message, { id: message });
};

/**
 * Toast de aviso "Sem internet…" (ícone `WifiOff` em `text-warning` — components.md §9).
 * O `id` igual à mensagem substitui o anterior: tocar várias vezes não empilha (REVIEW-005 B-1).
 */
export const notifyWarning = (message: string): void => {
  toast.warning(message, {
    id: message,
    icon: createElement(WifiOff, { "aria-hidden": true, className: "size-5 text-warning", strokeWidth: 1.75 }),
  });
};

/** Toast de erro com um texto pronto (falhas locais, ex.: área de transferência) */
export const notifyErrorMessage = (message: string): void => {
  toast.error(message);
};

/** Toast de erro com a mensagem do `ApiError` ou a mensagem genérica de rede */
export const notifyError = (err: unknown): void => {
  toast.error(errorMessage(err));
};
