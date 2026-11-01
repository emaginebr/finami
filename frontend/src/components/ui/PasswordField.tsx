import { forwardRef, useState } from "react";
import { Eye, EyeOff } from "lucide-react";
import { useTranslation } from "react-i18next";
import { TextField } from "./TextField";
import type { TextFieldProps } from "./TextField";

export interface PasswordFieldProps extends Omit<TextFieldProps, "type" | "trailing"> {
  autoComplete?: "current-password" | "new-password";
}

/** Campo de senha com botão de mostrar/ocultar (44 px, `aria-pressed`) */
export const PasswordField = forwardRef<HTMLInputElement, PasswordFieldProps>((props, ref) => {
  const { t } = useTranslation();
  const [visible, setVisible] = useState(false);

  return (
    <TextField
      ref={ref}
      {...props}
      type={visible ? "text" : "password"}
      trailing={
        <button
          type="button"
          onClick={() => setVisible((v) => !v)}
          aria-label={visible ? t("actions.hidePassword") : t("actions.showPassword")}
          aria-pressed={visible}
          disabled={props.disabled}
          className="grid size-11 place-items-center rounded-pill text-text-muted hover:text-text disabled:text-text-disabled"
        >
          {visible ? (
            <EyeOff aria-hidden="true" className="size-5" strokeWidth={1.75} />
          ) : (
            <Eye aria-hidden="true" className="size-5" strokeWidth={1.75} />
          )}
        </button>
      }
    />
  );
});

PasswordField.displayName = "PasswordField";

export default PasswordField;
