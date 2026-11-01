import { CircleUser, House, WalletCards } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import type { Currency } from "../../types/api";

/** Abas principais (TabBar no celular, Sidebar a partir de 768 px) */
export enum AppTab {
  Home = "home",
  Wallets = "wallets",
  Account = "account",
}

export interface NavItem {
  tab: AppTab;
  to: string;
  /** Chave i18n do rótulo */
  labelKey: string;
  icon: LucideIcon;
}

export const NAV_ITEMS: NavItem[] = [
  { tab: AppTab.Home, to: "/", labelKey: "nav.home", icon: House },
  { tab: AppTab.Wallets, to: "/carteiras", labelKey: "nav.wallets", icon: WalletCards },
  { tab: AppTab.Account, to: "/conta", labelKey: "nav.account", icon: CircleUser },
];

/** Rota da área de notificações (feature 003) */
export const NOTIFICATIONS_PATH = "/notificacoes";

/** Estado de navegação usado entre telas (`location.state`) */
export interface NavState {
  /** Aba de origem de uma tela "push" (mantém a aba destacada) */
  tab?: AppTab;
  /** Rota que pediu login (RequireAuth → LoginPage) */
  from?: { pathname: string; search?: string; hash?: string };
  /** Motivo de ter caído no login (ex.: "Sua sessão expirou") */
  reason?: string | null;
  /** Tela anterior para o botão voltar de telas push */
  backTo?: string;
  backLabel?: string;
  /** Resumo da carteira aberta a partir de outra tela (extrato de carteira de terceiro) */
  walletSummary?: WalletSummary;
  /** Cor do avatar na tela de origem, para a pessoa manter a mesma cor (REVIEW M-2) */
  colorIndex?: number;
}

/** Dados mínimos de uma carteira para o cabeçalho do extrato */
export interface WalletSummary {
  name: string;
  currency: Currency;
  balance: number;
}

/** Lê `location.state` com segurança */
export const readNavState = (state: unknown): NavState =>
  typeof state === "object" && state !== null ? (state as NavState) : {};

/** Aba destacada para uma rota (telas push mantêm a aba de origem) */
export const activeTabFor = (pathname: string, state: unknown): AppTab | null => {
  const origin = readNavState(state).tab;
  if (pathname === "/") return AppTab.Home;
  if (pathname.startsWith("/conta")) return AppTab.Account;
  if (pathname === "/carteiras") return AppTab.Wallets;
  // Notificações mantêm a aba de onde o sino foi tocado (components.md §7)
  if (pathname === NOTIFICATIONS_PATH) return origin ?? AppTab.Home;
  if (
    pathname.startsWith("/carteiras/") ||
    pathname.startsWith("/familias/") ||
    pathname.startsWith("/pessoas/")
  ) {
    return origin ?? AppTab.Wallets;
  }
  return null;
};
