/**
 * Sai da SPA para um endereço externo (ex.: retorno ao assistente após o consentimento OAuth).
 * Isolado num módulo para os testes simularem a navegação (`vi.mock`).
 */
export const redirectTo = (url: string): void => {
  window.location.assign(url);
};
