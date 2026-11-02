/** Variantes dos componentes de UI (separadas dos componentes por causa do Fast Refresh) */

export enum ButtonVariant {
  Primary = "primary",
  Secondary = "secondary",
  Ghost = "ghost",
  Destructive = "destructive",
  DestructiveGhost = "destructiveGhost",
}

export enum ButtonSize {
  Md = "md",
  Sm = "sm",
}

export enum ConfirmTone {
  Default = "default",
  Destructive = "destructive",
}

export enum BadgeVariant {
  Virtual = "virtual",
  Stale = "stale",
  Reversed = "reversed",
  Internal = "internal",
  Responsible = "responsible",
  Inactive = "inactive",
  /** Estado final do convite (feature 003) */
  InviteAccepted = "inviteAccepted",
  InviteDeclined = "inviteDeclined",
  InviteCanceled = "inviteCanceled",
  /** Permissão de assistente conectado (feature 004) */
  ScopeReadWrite = "scopeReadWrite",
  ScopeReadOnly = "scopeReadOnly",
}

export enum AvatarVariant {
  /** Cor de apoio por posição na família */
  Family = "family",
  /** Pessoa encontrada / sem índice de família */
  Neutral = "neutral",
  /** Convite pendente (borda tracejada) */
  Pending = "pending",
}

export enum NotificationBellVariant {
  /** Linha do título grande nas abas (celular) */
  Header = "header",
  /** Topo da Sidebar (desktop) */
  Sidebar = "sidebar",
}

export enum BannerTone {
  Error = "error",
  Warning = "warning",
  Info = "info",
  Expired = "expired",
}

export enum AppIconSize {
  Sm = "sm",
  Md = "md",
  Lg = "lg",
}

/** Onde o aviso de nova versão é exibido (feature 005, REVIEW-005 M-6) */
export enum UpdatePromptPlacement {
  /** No `AppShell`: acima da barra de abas (celular) / acima do FAB (desktop) */
  Shell = "shell",
  /** Telas sem abas (entrada, cadastro, autorização, sem internet): perto da borda inferior */
  Bare = "bare",
}
