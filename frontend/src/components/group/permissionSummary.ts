import type { TFunction } from "i18next";
import type { MemberPermissions } from "../../types/group";

/**
 * Partes do resumo curto das permissões de um membro (lista Membros, components.md §12):
 * ["Pode lançar", "Pode estornar"], ["Pode lançar"], ["Pode estornar"] ou ["Somente leitura"].
 * Na tela as partes são unidas por " · " (cada uma sem quebra interna); no nome acessível, por ", "
 * (REVIEW-008 I-1/M-1).
 */
export const permissionParts = (t: TFunction, permissions: MemberPermissions): string[] => {
  const parts: string[] = [];
  if (permissions.canCreateTransactions) parts.push(t("groups.permissions.create"));
  if (permissions.canReverse) parts.push(t("groups.permissions.reverse"));
  return parts.length > 0 ? parts : [t("groups.permissions.readOnly")];
};

/** Resumo curto em texto corrido: "Pode lançar · Pode estornar" ou "Somente leitura" */
export const permissionSummary = (t: TFunction, permissions: MemberPermissions): string =>
  permissionParts(t, permissions).join(t("groups.permissions.separator"));

/**
 * Partes do resumo da notificação `MemberPermissionsChanged`, sempre com os dois lados e em minúsculas
 * (["pode lançar", "não pode estornar"]); os dois desligados = ["somente leitura"] (components.md §12).
 */
export const notificationPermissionParts = (t: TFunction, permissions: MemberPermissions): string[] => {
  if (!permissions.canCreateTransactions && !permissions.canReverse) {
    return [t("notifications.permissionSummary.readOnly")];
  }
  return [
    t(
      permissions.canCreateTransactions
        ? "notifications.permissionSummary.canCreate"
        : "notifications.permissionSummary.cannotCreate",
    ),
    t(
      permissions.canReverse
        ? "notifications.permissionSummary.canReverse"
        : "notifications.permissionSummary.cannotReverse",
    ),
  ];
};
