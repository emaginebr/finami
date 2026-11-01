/** Tipos de autenticação e sessão (data-model §2) */
import type { UserInfo } from "./user";

/** Sessão persistida em `localStorage["finami:auth"]` */
export interface AuthSession {
  /** JWT enviado em `Authorization: Bearer` */
  token: string;
  /** Expiração do token (ISO-8601 UTC) */
  expiresAt: string;
  /** Pessoa autenticada */
  user: UserInfo;
}

/** Resposta de `POST /api/auth/login`, `/register` e `/google` */
export interface AuthResult {
  token: string;
  expiresAt: string;
  /** `true` quando a conta foi criada nesta chamada (login Google) */
  isNewUser: boolean;
  user: UserInfo;
}

/** Corpo de `POST /api/auth/login` */
export interface LoginInfo {
  email: string;
  password: string;
}

/** Corpo de `POST /api/auth/register` */
export interface RegisterInfo {
  firstName: string;
  lastName: string;
  email: string;
  password: string;
}

/** Corpo de `POST /api/auth/google` */
export interface GoogleLoginInfo {
  /** ID token (credential) devolvido pelo Google Identity Services */
  idToken: string;
}

/** Estado da sessão no app */
export enum AuthStatus {
  Checking = "checking",
  Anonymous = "anonymous",
  Authenticated = "authenticated",
}
