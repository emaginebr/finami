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

/** Erro lançado pelos Services quando a API responde fora da faixa 2xx (ou a rede falha) */
export class ApiError extends Error {
  /** Status HTTP da resposta (0 = falha de rede) */
  readonly status: number;
  /** Mensagem pronta para exibir à pessoa */
  readonly mensagem: string;
  /** Detalhes de validação (campo + mensagem), quando houver */
  readonly erros: string[];

  constructor(status: number, mensagem: string, erros: string[] = []) {
    super(mensagem);
    this.name = "ApiError";
    this.status = status;
    this.mensagem = mensagem;
    this.erros = erros;
  }

  /** `true` quando a requisição falhou antes de obter resposta */
  get isNetworkError(): boolean {
    return this.status === NETWORK_ERROR_STATUS;
  }
}

/** Type guard para `ApiError` */
export const isApiError = (err: unknown): err is ApiError => err instanceof ApiError;
