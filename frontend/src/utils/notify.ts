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

/** Toast de erro com um texto pronto (falhas locais, ex.: área de transferência) */
export const notifyErrorMessage = (message: string): void => {
  toast.error(message);
};

/** Toast de erro com a mensagem do `ApiError` ou a mensagem genérica de rede */
export const notifyError = (err: unknown): void => {
  toast.error(errorMessage(err));
};
