/** Mínimo de caracteres da senha (MIN_PASSWORD_LENGTH do backend) */
export const MIN_PASSWORD_LENGTH = 8;

/** Limites de texto (data-model §3) */
export const MAX_NAME_LENGTH = 120;
export const MAX_EMAIL_LENGTH = 254;

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/** Formato básico de email (a validação definitiva é do servidor) */
export const isValidEmail = (email: string): boolean => EMAIL_PATTERN.test(email.trim());

/** Erro de campo vindo do servidor no formato "campo: mensagem" */
export interface FieldErrorEntry {
  field: string;
  message: string;
}

/** Separa "Email: Email já cadastrado." em campo e mensagem; `null` se não houver campo */
export const parseFieldError = (text: string): FieldErrorEntry | null => {
  const match = /^\s*([A-Za-z][\w.]*)\s*:\s*(.+)$/.exec(text);
  if (!match || !match[1] || !match[2]) return null;
  const field = match[1].split(".").pop() ?? match[1];
  return { field: field.charAt(0).toLowerCase() + field.slice(1), message: match[2].trim() };
};
