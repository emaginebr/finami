/** Tipos comuns da API do Finami (data-model §1) */

/** Moedas suportadas pelas carteiras */
export enum Currency {
  BRL = "BRL",
  BTC = "BTC",
}

/** Envelope devolvido pelo backend em toda resposta não-2xx */
export interface ErrorResult {
  sucesso: boolean;
  mensagem: string;
  erros: string[] | null;
}

/** Mensagem exibida quando o servidor não devolve um envelope legível */
export const GENERIC_ERROR_MESSAGE = "Algo deu errado. Tente novamente.";

/** Mensagem exibida quando a requisição nem chega ao servidor */
export const NETWORK_ERROR_MESSAGE =
  "Não foi possível conectar ao servidor. Verifique sua conexão.";

/** Status usado em `ApiError` para falhas de rede (sem resposta HTTP) */
export const NETWORK_ERROR_STATUS = 0;

/** Consulta sem internet e sem dado guardado (feature 005, contracts/offline-cache.md) */
export const OFFLINE_CONTENT_MESSAGE = "Este conteúdo não está disponível sem internet.";

/** Escrita bloqueada antes do envio porque a conexão está offline (feature 005, R-05) */
export const OFFLINE_WRITE_MESSAGE = "Sem internet. Conecte-se para fazer lançamentos.";

/** Opções extras de `ApiError` */
export interface ApiErrorOptions {
  /**
   * `true` quando a falha é "sem internet" já tratada pelo app: consulta sem dado guardado
   * ou escrita bloqueada antes do envio. Queda de rede durante uma escrita fica `false`.
   */
  offline?: boolean;
}

/** Erro lançado pelos Services quando a API responde fora da faixa 2xx (ou a rede falha) */
export class ApiError extends Error {
  /** Status HTTP da resposta (0 = falha de rede) */
  readonly status: number;
  /** Mensagem pronta para exibir à pessoa */
  readonly mensagem: string;
  /** Detalhes de validação (campo + mensagem), quando houver */
  readonly erros: string[];
  /** Falha "sem internet" tratada pelo app (ver `ApiErrorOptions.offline`) */
  readonly offline: boolean;

  constructor(status: number, mensagem: string, erros: string[] = [], options: ApiErrorOptions = {}) {
    super(mensagem);
    this.name = "ApiError";
    this.status = status;
    this.mensagem = mensagem;
    this.erros = erros;
    this.offline = options.offline ?? false;
  }

  /** `true` quando a requisição falhou antes de obter resposta */
  get isNetworkError(): boolean {
    return this.status === NETWORK_ERROR_STATUS;
  }
}

/** Type guard para `ApiError` */
export const isApiError = (err: unknown): err is ApiError => err instanceof ApiError;

/** `true` para a falha "sem internet" tratada pelo app (consulta sem dado guardado, escrita bloqueada) */
export const isOfflineError = (err: unknown): boolean => isApiError(err) && err.offline;

/**
 * Queda de rede durante uma escrita (a requisição saiu e não houve resposta): o servidor pode
 * ter gravado ou não — nunca reenviar automaticamente (FR-011).
 */
export const isUnconfirmedWriteError = (err: unknown): boolean =>
  isApiError(err) && err.isNetworkError && !err.offline;
