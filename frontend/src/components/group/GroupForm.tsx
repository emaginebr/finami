import { useState } from "react";
import type { FormEvent } from "react";
import { useTranslation } from "react-i18next";
import { Banner } from "../ui/Banner";
import { TextField } from "../ui/TextField";

const MAX_GROUP_NAME = 120;

export interface GroupFormProps {
  /** Id do `<form>` (botão de enviar no rodapé da folha com `form={formId}`) */
  formId: string;
  initialName?: string;
  /** Mostra a explicação de que a pessoa será a responsável (criação) */
  showResponsibleHint?: boolean;
  onSubmit: (name: string) => void;
  disabled?: boolean;
  serverError?: string | null;
}

/** Formulário de família: só o nome (mockup group-manage.html) */
export const GroupForm = ({
  formId,
  initialName = "",
  showResponsibleHint = false,
  onSubmit,
  disabled = false,
  serverError,
}: GroupFormProps) => {
  const { t } = useTranslation();
  const [name, setName] = useState(initialName);
  const [error, setError] = useState<string | null>(null);

  const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const trimmed = name.trim();
    const validation = !trimmed
      ? t("validation.required")
      : trimmed.length > MAX_GROUP_NAME
        ? t("validation.maxLength", { max: MAX_GROUP_NAME })
        : null;
    setError(validation);
    if (!validation) onSubmit(trimmed);
  };

  return (
    <form id={formId} noValidate onSubmit={submit} className="flex flex-col gap-4">
      {serverError ? (
        <Banner tone="error" role="alert" title={t("groups.form.errorTitle")}>
          {serverError}
        </Banner>
      ) : null}
      <TextField
        label={t("groups.form.name")}
        value={name}
        maxLength={MAX_GROUP_NAME}
        error={error}
        disabled={disabled}
        data-autofocus=""
        onChange={(event) => setName(event.target.value)}
      />
      {showResponsibleHint ? <Banner tone="info">{t("groups.form.responsibleHint")}</Banner> : null}
    </form>
  );
};

export default GroupForm;
