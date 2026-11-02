import { ArrowLeftRight, CircleUser, House, WalletCards } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import type { Currency } from "../../types/api";

/** Abas principais (TabBar no celular, Sidebar a partir de 768 px) */
export enum AppTab {
  Home = "home",
  Wallets = "wallets",
  Transfer = "transfer",
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
  { tab: AppTab.Transfer, to: "/transferir", labelKey: "nav.transfer", icon: ArrowLeftRight },
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

/**
 * Rota para onde voltar depois de entrar (ou criar conta): `from` com query e hash
 * — ex.: `/autorizar?pedido=…` (feature 004, T027). Só aceita caminhos internos.
 */
export const returnPathOf = (navState: NavState): string => {
  const from = navState.from;
  if (!from || !from.pathname.startsWith("/") || from.pathname.startsWith("//")) return "/";
  return `${from.pathname}${from.search ?? ""}${from.hash ?? ""}`;
};

/** Estado repassado entre Entrar e Criar conta para não perder a rota de retorno */
export const carryReturnState = (navState: NavState): NavState | undefined =>
  navState.from ? { from: navState.from } : undefined;

/** Aba destacada para uma rota (telas push mantêm a aba de origem) */
export const activeTabFor = (pathname: string, state: unknown): AppTab | null => {
  const origin = readNavState(state).tab;
  if (pathname === "/") return AppTab.Home;
  if (pathname.startsWith("/conta")) return AppTab.Account;
  if (pathname === "/carteiras") return AppTab.Wallets;
  // Transferir é aba do menu; aberto pelo "+", mantém a aba de origem
  if (pathname === "/transferir") return origin ?? AppTab.Transfer;
  // Depositar e Sacar são telas push: mantêm a aba de origem
  if (pathname === "/depositar" || pathname === "/sacar") return origin ?? null;
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
