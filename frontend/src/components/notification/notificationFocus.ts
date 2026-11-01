/** Id do elemento que recebe o foco de uma notificação (após responder ou "Carregar mais") */
export const notificationFocusId = (notificationId: number): string => `notificacao-${notificationId}`;

/** Leva o foco ao item da notificação, se ele estiver na tela */
export const focusNotification = (notificationId: number): void => {
  document.getElementById(notificationFocusId(notificationId))?.focus();
};
