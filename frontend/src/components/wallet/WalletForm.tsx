import { useId, useState } from "react";
import type { FormEvent } from "react";
import { Lock } from "lucide-react";
import { useTranslation } from "react-i18next";
import { Currency } from "../../types/api";
import type { GroupInfo } from "../../types/group";
import type { WalletInfo } from "../../types/wallet";
import { Banner } from "../ui/Banner";
import { SegmentedControl } from "../ui/SegmentedControl";
import { SelectRow } from "../ui/SelectRow";
import { SwitchRow } from "../ui/Switch";
import { TextField } from "../ui/TextField";

/** Limites (data-model §5) */
const MAX_WALLET_NAME = 120;
const MAX_WALLET_DESCRIPTION = 500;
const NO_GROUP = "";

/** Valores validados do formulário */
export interface WalletFormValues {
  name: string;
  description: string | null;
  currency: Currency;
  isVirtual: boolean;
  groupId: number | null;
  /** Titular quando a pessoa cria para um membro (responsável); `null` = ela mesma */
  ownerUserId: number | null;
}

export interface WalletFormProps {
  /** Id do `<form>` (o botão de enviar fica no rodapé da folha, com `form={formId}`) */
  formId: string;
  /** Carteira em edição; ausente = criação */
  wallet?: WalletInfo;
  /** Famílias da pessoa */
  groups: GroupInfo[];
  currentUserId: number | null;
  /** Família pré-selecionada na criação */
  defaultGroupId?: number | null;
  onSubmit: (values: WalletFormValues) => void;
  disabled?: boolean;
  serverError?: string | null;
}

/**
 * Formulário de carteira (mockup group-manage.html): nome, descrição, moeda só na criação,
 * virtual, família e — quando a pessoa é responsável da família — titular.
 */
export const WalletForm = ({
  formId,
  wallet,
  groups,
  currentUserId,
  defaultGroupId = null,
  onSubmit,
  disabled = false,
  serverError,
}: WalletFormProps) => {
  const { t } = useTranslation();
  const currencyLabelId = useId();
  const isEdit = Boolean(wallet);
  const [name, setName] = useState(wallet?.name ?? "");
  const [description, setDescription] = useState(wallet?.description ?? "");
  const [currency, setCurrency] = useState<Currency>(wallet?.currency ?? Currency.BRL);
  const [isVirtual, setIsVirtual] = useState(wallet?.isVirtual ?? false);
  const [groupValue, setGroupValue] = useState(
    String(wallet ? (wallet.groupId ?? NO_GROUP) : (defaultGroupId ?? NO_GROUP)),
  );
  const [ownerValue, setOwnerValue] = useState(String(currentUserId ?? ""));
  const [nameError, setNameError] = useState<string | null>(null);

  const selectedGroup = groups.find((g) => String(g.groupId) === groupValue) ?? null;
  const canChooseOwner = !isEdit && selectedGroup !== null && selectedGroup.isResponsible;

  const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const trimmed = name.trim();
    const error = !trimmed
      ? t("validation.required")
      : trimmed.length > MAX_WALLET_NAME
        ? t("validation.maxLength", { max: MAX_WALLET_NAME })
        : null;
    setNameError(error);
    if (error) return;
    const owner = canChooseOwner ? Number(ownerValue) : null;
    onSubmit({
      name: trimmed,
      description: description.trim() || null,
      currency,
      isVirtual,
      groupId: groupValue === NO_GROUP ? null : Number(groupValue),
      ownerUserId: owner !== null && owner !== currentUserId ? owner : null,
    });
  };

  return (
    <form id={formId} noValidate onSubmit={submit} className="flex flex-col gap-4">
      {serverError ? (
        <Banner tone="error" role="alert" title={t("wallets.form.errorTitle")}>
          {serverError}
        </Banner>
      ) : null}

      <TextField
        label={t("wallets.form.name")}
        value={name}
        maxLength={MAX_WALLET_NAME}
        error={nameError}
        disabled={disabled}
        data-autofocus=""
        onChange={(event) => setName(event.target.value)}
      />
      <TextField
        label={t("transaction.description")}
        labelSuffix={t("transaction.optional")}
        placeholder={t("wallets.form.descriptionPlaceholder")}
        value={description}
        maxLength={MAX_WALLET_DESCRIPTION}
        disabled={disabled}
        onChange={(event) => setDescription(event.target.value)}
      />

      {isEdit ? (
        <div className="flex flex-col gap-1.5">
          <span className="text-footnote font-medium text-text-muted">{t("wallets.form.currency")}</span>
          <div className="flex min-h-12 items-center gap-2 rounded-md bg-surface px-4 text-body text-text-muted">
            <Lock aria-hidden="true" className="size-4" />
            {t("wallets.form.currencyLocked", { currency: t(`wallets.form.currencyOption.${currency}`) })}
          </div>
        </div>
      ) : (
        <div className="flex flex-col gap-1.5">
          <span id={currencyLabelId} className="text-footnote font-medium text-text-muted">
            {t("wallets.form.currency")}
          </span>
          <SegmentedControl
            ariaLabel={t("wallets.form.currency")}
            value={currency}
            onChange={setCurrency}
            disabled={disabled}
            options={[
              { value: Currency.BRL, label: t("wallets.form.currencyOption.BRL") },
              { value: Currency.BTC, label: t("wallets.form.currencyOption.BTC") },
            ]}
          />
          <span className="text-footnote text-text-muted">{t("wallets.form.currencyHint")}</span>
        </div>
      )}

      <div>
        <div className="overflow-hidden rounded-lg bg-surface">
          <SwitchRow
            label={t("wallets.form.virtual")}
            description={t("wallets.form.virtualHint")}
            checked={isVirtual}
            onChange={setIsVirtual}
            disabled={disabled}
          />
          <SelectRow
            label={t("wallets.form.family")}
            value={groupValue}
            disabled={disabled}
            onChange={(value) => {
              setGroupValue(value);
              setOwnerValue(String(currentUserId ?? ""));
            }}
            options={[
              { value: NO_GROUP, label: t("wallets.form.noFamily") },
              ...groups.map((g) => ({ value: String(g.groupId), label: g.name })),
            ]}
          />
          {canChooseOwner && selectedGroup ? (
            <SelectRow
              label={t("wallets.form.owner")}
              value={ownerValue}
              disabled={disabled}
              onChange={setOwnerValue}
              options={selectedGroup.members.map((m) => ({
                value: String(m.userId),
                label:
                  m.userId === currentUserId
                    ? t("wallets.form.ownerYou", { name: `${m.firstName} ${m.lastName}` })
                    : `${m.firstName} ${m.lastName}`,
              }))}
            />
          ) : null}
        </div>
        {canChooseOwner && selectedGroup ? (
          <p className="m-0 px-4 pt-2 text-footnote text-text-muted">
            {t("wallets.form.ownerHint", { family: selectedGroup.name })}
          </p>
        ) : null}
      </div>
    </form>
  );
};

export default WalletForm;
