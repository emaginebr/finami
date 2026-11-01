import { Currency } from "../types/api";
import type { AuthSession } from "../types/auth";
import { StatementVisibility } from "../types/group";
import type { GroupInfo } from "../types/group";
import type { UserInfo } from "../types/user";
import type { WalletInfo } from "../types/wallet";
import { AUTH_STORAGE_KEY } from "../Services/apiHelpers";

export const USER_ID = 7;

export const makeUser = (overrides: Partial<UserInfo> = {}): UserInfo => ({
  userId: USER_ID,
  firstName: "Ana",
  lastName: "Silva",
  email: "ana@ex.com",
  hasPassword: true,
  hasGoogle: false,
  canLogin: true,
  createdByUserId: null,
  createdAt: "2026-01-01T00:00:00Z",
  ...overrides,
});

export const makeSession = (overrides: Partial<AuthSession> = {}): AuthSession => ({
  token: "jwt-token",
  expiresAt: "2999-01-01T00:00:00Z",
  user: makeUser(),
  ...overrides,
});

/** Grava uma sessão válida em `localStorage["finami:auth"]` */
export const storeSession = (session: AuthSession = makeSession()): void => {
  localStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify(session));
};

let nextWalletId = 100;

export const makeWallet = (overrides: Partial<WalletInfo> = {}): WalletInfo => ({
  walletId: nextWalletId++,
  name: "Carteira",
  description: null,
  currency: Currency.BRL,
  isVirtual: false,
  isActive: true,
  ownerUserId: USER_ID,
  ownerName: "Ana Silva",
  groupId: null,
  balance: 0,
  estimatedBrl: null,
  canControl: true,
  createdAt: "2026-01-01T00:00:00Z",
  ...overrides,
});

export const makeGroup = (overrides: Partial<GroupInfo> = {}): GroupInfo => ({
  groupId: 1,
  name: "Família",
  responsibleUserId: USER_ID,
  isResponsible: true,
  statementVisibility: StatementVisibility.AllMembers,
  members: [],
  ...overrides,
});
