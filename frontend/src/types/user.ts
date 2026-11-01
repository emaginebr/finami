/** Tipos de pessoa (data-model §3) */

/** Dados públicos de uma pessoa, como devolvidos pela API */
export interface UserInfo {
  userId: number;
  firstName: string;
  lastName: string;
  /** `null` quando a pessoa foi cadastrada sem email */
  email: string | null;
  /** Tem senha definida (pode entrar com email e senha) */
  hasPassword: boolean;
  /** Tem conta Google vinculada */
  hasGoogle: boolean;
  /** Pode entrar no app (tem senha ou Google) */
  canLogin: boolean;
  /** Quem cadastrou esta pessoa; `null` em auto-cadastro */
  createdByUserId: number | null;
  /** Data de criação (ISO-8601 UTC) */
  createdAt: string;
}

/** Corpo de `POST /api/users` (cadastro de outra pessoa, ex.: sem login) */
export interface UserInsertInfo {
  firstName: string;
  lastName: string;
  email: string | null;
  password: string | null;
}

/** Corpo de `PUT /api/users/{id}` */
export interface UserUpdateInfo {
  firstName: string;
  lastName: string;
  email: string | null;
}

/** Corpo de `PUT /api/users/{id}/password` (`currentPassword` obrigatório se já houver senha) */
export interface PasswordChangeInfo {
  currentPassword: string | null;
  newPassword: string;
}

/** Resultado de `GET /api/users/search?email=` (busca exata) */
export interface UserSearchInfo {
  userId: number;
  firstName: string;
  lastName: string;
}
