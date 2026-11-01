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

/** Titular fixo (responsável criando para um membro na página da pessoa) */
export interface WalletFormFixedOwner {
  userId: number;
  name: string;
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
  /** Titular fixo: esconde o seletor de titular e mostra "Titular · {nome}" (só na criação) */
  fixedOwner?: WalletFormFixedOwner | null;
  /**
   * Família obrigatória entre `groups` (sem a opção "Nenhuma"). Com uma família só, ela já
   * vem selecionada.
   */
  requireGroup?: boolean;
}

/** Família inicial: a da carteira, a padrão ou — família obrigatória e única — a única */
const initialGroupValue = (
  wallet: WalletInfo | undefined,
  groups: GroupInfo[],
  defaultGroupId: number | null,
  requireGroup: boolean,
): string => {
  if (wallet) return String(wallet.groupId ?? NO_GROUP);
  if (defaultGroupId !== null) return String(defaultGroupId);
  const only = requireGroup && groups.length === 1 ? groups[0] : undefined;
  return only ? String(only.groupId) : NO_GROUP;
};

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
  fixedOwner = null,
  requireGroup = false,
}: WalletFormProps) => {
  const { t } = useTranslation();
  const currencyLabelId = useId();
  const groupErrorId = useId();
  const isEdit = Boolean(wallet);
  const [name, setName] = useState(wallet?.name ?? "");
  const [description, setDescription] = useState(wallet?.description ?? "");
  const [currency, setCurrency] = useState<Currency>(wallet?.currency ?? Currency.BRL);
  const [isVirtual, setIsVirtual] = useState(wallet?.isVirtual ?? false);
  const [groupValue, setGroupValue] = useState(() =>
    initialGroupValue(wallet, groups, defaultGroupId, requireGroup),
  );
  const [ownerValue, setOwnerValue] = useState(String(currentUserId ?? ""));
  const [nameError, setNameError] = useState<string | null>(null);
  const [groupError, setGroupError] = useState<string | null>(null);

  const selectedGroup = groups.find((g) => String(g.groupId) === groupValue) ?? null;
  const showFixedOwner = !isEdit && fixedOwner !== null;
  const canChooseOwner = !isEdit && !showFixedOwner && selectedGroup !== null && selectedGroup.isResponsible;

  const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const trimmed = name.trim();
    const error = !trimmed
      ? t("validation.required")
      : trimmed.length > MAX_WALLET_NAME
        ? t("validation.maxLength", { max: MAX_WALLET_NAME })
        : null;
    const missingGroup = requireGroup && !isEdit && groupValue === NO_GROUP ? t("wallets.form.familyRequired") : null;
    setNameError(error);
    setGroupError(missingGroup);
    if (error || missingGroup) return;
    const owner = showFixedOwner && fixedOwner ? fixedOwner.userId : canChooseOwner ? Number(ownerValue) : null;
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
              if (value !== NO_GROUP) setGroupError(null);
            }}
            describedBy={groupError ? groupErrorId : undefined}
            invalid={groupError !== null}
            options={[
              // Família obrigatória: sem "Nenhuma"; o marcador "Escolha" só enquanto nada foi escolhido
              ...(requireGroup && !isEdit
                ? groupValue === NO_GROUP
                  ? [{ value: NO_GROUP, label: t("wallets.form.chooseFamily") }]
                  : []
                : [{ value: NO_GROUP, label: t("wallets.form.noFamily") }]),
              ...groups.map((g) => ({ value: String(g.groupId), label: g.name })),
            ]}
          />
          {showFixedOwner && fixedOwner ? (
            <div className="list-row relative flex min-h-row w-full items-center gap-3 px-4 py-2">
              <span className="flex-1 text-body">{t("wallets.form.owner")}</span>
              <span className="sr-only">: </span>
              <span className="max-w-[60%] truncate text-body text-text-muted">{fixedOwner.name}</span>
            </div>
          ) : null}
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
        {groupError ? (
          <p id={groupErrorId} role="alert" className="m-0 px-4 pt-2 text-footnote text-negative">
            {groupError}
          </p>
        ) : null}
        {canChooseOwner && selectedGroup ? (
          <p className="m-0 px-4 pt-2 text-footnote text-text-muted">
            {t("wallets.form.ownerHint", { family: selectedGroup.name })}
          </p>
        ) : null}
        {showFixedOwner && fixedOwner ? (
          <p className="m-0 px-4 pt-2 text-footnote text-text-muted">
            {t("wallets.form.fixedOwnerHint", { name: fixedOwner.name })}
          </p>
        ) : null}
      </div>
    </form>
  );
};

export default WalletForm;
