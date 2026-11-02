/// <reference types="vite/client" />
/// <reference types="vite-plugin-pwa/react" />
/// <reference types="vite-plugin-pwa/info" />

interface ImportMetaEnv {
  /** URL base da API backend (obrigatória) */
  readonly VITE_API_URL: string;
  /** Base path do React Router (opcional) */
  readonly VITE_SITE_BASENAME?: string;
  /** OAuth Client ID público do Google (opcional) */
  readonly VITE_GOOGLE_CLIENT_ID?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
