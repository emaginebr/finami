/** Tipos da instalação do app (feature 005, research R-08) */

/** Escolha da pessoa no diálogo nativo de instalação */
export type InstallChoiceOutcome = "accepted" | "dismissed";

/** Resultado de `promptInstall()` */
export enum InstallOutcome {
  Accepted = "accepted",
  Dismissed = "dismissed",
  /** Navegador sem diálogo nativo disponível */
  Unavailable = "unavailable",
}

/** Evento `beforeinstallprompt` (Chrome/Edge; ainda fora do lib DOM do TypeScript) */
export interface BeforeInstallPromptEvent extends Event {
  readonly platforms: string[];
  readonly userChoice: Promise<{ outcome: InstallChoiceOutcome; platform: string }>;
  prompt: () => Promise<void>;
}

/** `navigator.standalone` do Safari iOS */
export interface NavigatorWithStandalone extends Navigator {
  standalone?: boolean;
}
