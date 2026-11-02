import { useEffect, useId, useRef, useState } from "react";
import type { FormEvent, ReactNode } from "react";
import { ChevronLeft, ChevronRight, Clock, Mail, Send, UserCheck, UserPlus, X } from "lucide-react";
import { useTranslation } from "react-i18next";
import { useAuth } from "../../hooks/useAuth";
import { useInvitation } from "../../hooks/useInvitation";
import { useOnlineAction } from "../../hooks/useOnlineAction";
import { isApiError } from "../../types/api";
import { MemberLookupStatus } from "../../types/invitation";
import type { GroupInvitationInfo, MemberLookupResult, NewMemberInfo, UserSummaryInfo } from "../../types/invitation";
import { formatShortDate } from "../../utils/dates";
import { errorMessage, notifyError, notifySuccess } from "../../utils/notify";
import { MAX_EMAIL_LENGTH, MAX_NAME_LENGTH, isValidEmail } from "../../utils/validation";
import { Avatar } from "../ui/Avatar";
import { Banner } from "../ui/Banner";
import { Button } from "../ui/Button";
import { ConfirmModal } from "../ui/ConfirmModal";
import { Sheet, SheetHeaderButton } from "../ui/Sheet";
import { TextField } from "../ui/TextField";
import { listRowClasses } from "../ui/listRow";
import { AvatarVariant, BannerTone, ButtonVariant, ConfirmTone } from "../ui/variants";

export interface AddMemberSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  groupId: number;
  groupName: string;
  /** Convites pendentes da família (para mostrar a data no passo `pendingInvite`) */
  pendingInvitations: GroupInvitationInfo[];
  /** Chamado após criar, convidar ou cancelar (recarregar membros, saldos e pendentes) */
  onChanged: () => void;
}

/** Passos da folha (máquina de estados de data-model.md) */
enum Step {
  Email = "email",
  NewPerson = "newPerson",
  Registered = "registered",
  AlreadyMember = "alreadyMember",
  PendingInvite = "pendingInvite",
}

/** Envio em curso (bloqueia a folha e evita duplo envio — FR-025) */
enum Busy {
  Lookup = "lookup",
  Create = "create",
  Invite = "invite",
}

interface PersonErrors {
  firstName: string | null;
  lastName: string | null;
}

const NO_PERSON_ERRORS: PersonErrors = { firstName: null, lastName: null };

const fullName = (person: UserSummaryInfo) => `${person.firstName} ${person.lastName}`.trim();

const STEP_FOR_STATUS: Record<MemberLookupStatus, Step> = {
  [MemberLookupStatus.Available]: Step.NewPerson,
  [MemberLookupStatus.Registered]: Step.Registered,
  [MemberLookupStatus.AlreadyMember]: Step.AlreadyMember,
  [MemberLookupStatus.PendingInvite]: Step.PendingInvite,
};

interface PersonCardProps {
  name: string;
  subtitle: ReactNode;
  variant: AvatarVariant;
}

/** Cartão da pessoa encontrada (só nome — FR-008) */
const PersonCard = ({ name, subtitle, variant }: PersonCardProps) => (
  <div className="mb-4 flex items-center gap-3 rounded-lg bg-surface px-4 py-3">
    <Avatar name={name} variant={variant} />
    <span className="min-w-0 flex-1">
      <span className="line-clamp-2 text-headline break-words hyphens-auto">{name}</span>
      <span className="mt-0.5 block text-footnote text-text-muted">{subtitle}</span>
    </span>
  </div>
);

/**
 * Folha "Adicionar membro" (specs/003 R-08, components.md §7): começa pelo email, verifica
 * (`member-lookup`) e segue para cadastrar + incluir, convidar, avisar que já é membro ou
 * que já há convite pendente. "Adicionar sem email" vai direto a nome e sobrenome.
 * Para reiniciar o fluxo, quem usa monta com uma `key` nova a cada abertura.
 */
export const AddMemberSheet = ({
  open,
  onOpenChange,
  groupId,
  groupName,
  pendingInvitations,
  onChanged,
}: AddMemberSheetProps) => {
  const { t } = useTranslation();
  const { lookupMember, createMember, invite, cancel } = useInvitation();
  const { session } = useAuth();
  const formId = useId();
  // Convidar e cancelar convite exigem internet (feature 005)
  const onlineAction = useOnlineAction();

  const [step, setStep] = useState<Step>(Step.Email);
  const [email, setEmail] = useState("");
  const [emailError, setEmailError] = useState<string | null>(null);
  const [lookup, setLookup] = useState<MemberLookupResult | null>(null);
  const [withEmail, setWithEmail] = useState(true);
  const [person, setPerson] = useState({ firstName: "", lastName: "" });
  const [personErrors, setPersonErrors] = useState<PersonErrors>(NO_PERSON_ERRORS);
  const [busy, setBusy] = useState<Busy | null>(null);
  const [serverError, setServerError] = useState<string | null>(null);
  const [cancelOpen, setCancelOpen] = useState(false);
  const [canceling, setCanceling] = useState(false);

  const headingRef = useRef<HTMLHeadingElement>(null);
  const emailRef = useRef<HTMLInputElement>(null);
  const previousStep = useRef<Step>(step);
  const selectEmailOnReturn = useRef(false);
  const cancelDone = useRef(false);

  const isBusy = busy !== null;

  // Ao trocar de passo, o foco vai para o título do passo (anuncia o resultado) ou volta ao
  // campo de email. `setTimeout` deixa o modal de confirmação devolver o foco antes.
  useEffect(() => {
    if (previousStep.current === step) return undefined;
    previousStep.current = step;
    const timer = window.setTimeout(() => {
      if (step === Step.Email) {
        emailRef.current?.focus();
        if (selectEmailOnReturn.current) emailRef.current?.select();
        selectEmailOnReturn.current = false;
      } else {
        headingRef.current?.focus();
      }
    }, 0);
    return () => window.clearTimeout(timer);
  }, [step]);

  const applyLookup = (result: MemberLookupResult) => {
    setLookup(result);
    setServerError(null);
    if (result.status === MemberLookupStatus.Available) setWithEmail(true);
    setStep(STEP_FOR_STATUS[result.status]);
  };

  const backToEmail = (selectText: boolean) => {
    selectEmailOnReturn.current = selectText;
    setServerError(null);
    setPersonErrors(NO_PERSON_ERRORS);
    setStep(Step.Email);
  };

  const startWithoutEmail = () => {
    setLookup(null);
    setWithEmail(false);
    setEmailError(null);
    setServerError(null);
    setStep(Step.NewPerson);
  };

  // ---------------------------------------------------------------------------
  // Ações
  // ---------------------------------------------------------------------------

  const submitEmail = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (isBusy) return;
    setServerError(null);
    if (!isValidEmail(email)) {
      setEmailError(t("validation.emailInvalid"));
      emailRef.current?.focus();
      return;
    }
    setEmailError(null);
    setBusy(Busy.Lookup);
    try {
      applyLookup(await lookupMember(groupId, email.trim()));
    } catch (err) {
      if (isApiError(err) && err.status === 400) {
        setEmailError(err.mensagem);
        emailRef.current?.focus();
      } else {
        setServerError(errorMessage(err));
      }
    } finally {
      setBusy(null);
    }
  };

  const submitPerson = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (isBusy) return;
    const validate = (value: string) =>
      !value.trim()
        ? t("validation.required")
        : value.trim().length > MAX_NAME_LENGTH
          ? t("validation.maxLength", { max: MAX_NAME_LENGTH })
          : null;
    const errors: PersonErrors = { firstName: validate(person.firstName), lastName: validate(person.lastName) };
    setPersonErrors(errors);
    if (errors.firstName || errors.lastName) return;

    const info: NewMemberInfo = {
      firstName: person.firstName.trim(),
      lastName: person.lastName.trim(),
      email: withEmail && lookup ? lookup.email : null,
    };
    setBusy(Busy.Create);
    setServerError(null);
    try {
      await createMember(groupId, info);
      notifySuccess(t("groups.addMember.created", { name: `${info.firstName} ${info.lastName}` }));
      onChanged();
      onOpenChange(false);
    } catch (err) {
      // Corrida: alguém cadastrou o email agora — refaz a verificação e cai no convite
      if (isApiError(err) && err.status === 409 && info.email) {
        try {
          const again = await lookupMember(groupId, info.email);
          if (again.status !== MemberLookupStatus.Available) {
            applyLookup(again);
            return;
          }
        } catch {
          // Mantém a mensagem do 409 abaixo
        }
      }
      setServerError(errorMessage(err));
    } finally {
      setBusy(null);
    }
  };

  const invitePerson = async () => {
    if (isBusy || !lookup) return;
    setBusy(Busy.Invite);
    setServerError(null);
    try {
      await invite(groupId, lookup.email);
      notifySuccess(t("groups.addMember.invited", { name: lookup.user ? fullName(lookup.user) : lookup.email }));
      onChanged();
      onOpenChange(false);
    } catch (err) {
      setServerError(errorMessage(err));
    } finally {
      setBusy(null);
    }
  };

  const confirmCancel = async () => {
    if (!lookup?.invitationId) return;
    setCanceling(true);
    try {
      await cancel(groupId, lookup.invitationId);
      notifySuccess(t("groups.invitations.canceled"));
      cancelDone.current = true;
      onChanged();
    } catch (err) {
      notifyError(err);
      throw err;
    } finally {
      setCanceling(false);
    }
  };

  // ---------------------------------------------------------------------------
  // Render
  // ---------------------------------------------------------------------------

  const personName = lookup?.user ? fullName(lookup.user) : (lookup?.email ?? "");
  /** O email informado é o da própria pessoa logada (REVIEW B-2) */
  const isSelf = Boolean(lookup?.user && session && lookup.user.userId === session.user.userId);
  const pendingSince = (() => {
    const invitation = pendingInvitations.find((item) => item.invitationId === lookup?.invitationId);
    return invitation
      ? t("groups.addMember.pendingSince", { date: formatShortDate(invitation.createdAt) })
      : t("groups.addMember.pendingNoDate");
  })();

  const stepHeading = (text: string) => (
    <h3
      ref={headingRef}
      tabIndex={-1}
      className="m-0 mt-2 mb-1 text-title-3 font-semibold focus:outline-none"
    >
      {text}
    </h3>
  );

  const errorBanner = serverError ? (
    <Banner tone={BannerTone.Error} role="alert" className="mb-4">
      {serverError}
    </Banner>
  ) : null;

  const leading =
    step === Step.Email ? undefined : (
      <SheetHeaderButton onClick={() => backToEmail(false)} disabled={isBusy}>
        <ChevronLeft aria-hidden="true" className="size-6" strokeWidth={1.75} />
        {t("nav.back")}
      </SheetHeaderButton>
    );

  const anotherEmailButton = (
    <Button variant={ButtonVariant.Secondary} block onClick={() => backToEmail(true)}>
      {t("groups.addMember.useAnotherEmail")}
    </Button>
  );

  let body: ReactNode = null;
  let footer: ReactNode = null;

  switch (step) {
    case Step.Email:
      body = (
        <>
          <form id={formId} noValidate onSubmit={(event) => void submitEmail(event)}>
            {errorBanner}
            <p className="m-0 mb-4 text-subhead text-text-muted">{t("groups.addMember.emailIntro")}</p>
            <TextField
              ref={emailRef}
              label={t("groups.addMember.emailLabel")}
              type="email"
              inputMode="email"
              autoComplete="email"
              autoCapitalize="none"
              spellCheck={false}
              maxLength={MAX_EMAIL_LENGTH}
              value={email}
              error={emailError}
              disabled={isBusy}
              data-autofocus=""
              onChange={(event) => {
                setEmail(event.target.value);
                if (emailError) setEmailError(null);
              }}
            />
          </form>
          <div aria-hidden="true" className="my-4 flex items-center gap-3 text-footnote text-text-muted">
            <span className="h-px flex-1 bg-separator" />
            {t("groups.addMember.or")}
            <span className="h-px flex-1 bg-separator" />
          </div>
          <div className="overflow-hidden rounded-lg bg-surface">
            <button
              type="button"
              disabled={isBusy}
              onClick={startWithoutEmail}
              className={listRowClasses({ twoLines: true, withIcon: true, interactive: !isBusy })}
            >
              <span
                aria-hidden="true"
                className="grid size-8 shrink-0 place-items-center rounded-sm bg-surface-2 text-accent"
              >
                <UserPlus className="size-[18px]" strokeWidth={1.75} />
              </span>
              <span className="min-w-0 flex-1">
                <span className="block text-headline font-semibold text-accent">
                  {t("groups.addMember.withoutEmail")}
                </span>
                <span className="mt-0.5 block text-footnote text-text-muted">
                  {t("groups.addMember.withoutEmailHint")}
                </span>
              </span>
              <ChevronRight aria-hidden="true" className="size-[18px] shrink-0 text-text-subtle" />
            </button>
          </div>
        </>
      );
      footer = (
        <Button
          type="submit"
          form={formId}
          block
          loading={busy === Busy.Lookup}
          loadingLabel={t("groups.addMember.checking")}
        >
          {t("groups.addMember.continue")}
        </Button>
      );
      break;

    case Step.NewPerson:
      body = (
        <form id={formId} noValidate onSubmit={(event) => void submitPerson(event)}>
          {errorBanner}
          {stepHeading(
            withEmail ? t("groups.addMember.newPersonTitle") : t("groups.addMember.newPersonNoEmailTitle"),
          )}
          <p className="m-0 mb-4 text-subhead text-text-muted">
            {withEmail
              ? t("groups.addMember.newPersonBody", { family: groupName })
              : t("groups.addMember.newPersonNoEmailBody")}
          </p>
          {withEmail && lookup ? (
            <p className="m-0 mb-4 flex min-h-12 items-center gap-3 rounded-md bg-surface px-4 text-body text-text-muted">
              <Mail aria-hidden="true" className="size-[18px] shrink-0" strokeWidth={1.75} />
              <span className="sr-only">{t("groups.addMember.emailRow")}: </span>
              <span className="min-w-0 truncate">{lookup.email}</span>
            </p>
          ) : null}
          <div className="grid grid-cols-1 gap-4 min-[360px]:grid-cols-2 min-[360px]:gap-3">
            <TextField
              label={t("auth.register.firstName")}
              autoComplete="off"
              maxLength={MAX_NAME_LENGTH}
              value={person.firstName}
              error={personErrors.firstName}
              disabled={isBusy}
              onChange={(event) => setPerson((p) => ({ ...p, firstName: event.target.value }))}
            />
            <TextField
              label={t("auth.register.lastName")}
              autoComplete="off"
              maxLength={MAX_NAME_LENGTH}
              value={person.lastName}
              error={personErrors.lastName}
              disabled={isBusy}
              onChange={(event) => setPerson((p) => ({ ...p, lastName: event.target.value }))}
            />
          </div>
        </form>
      );
      footer = (
        <Button
          type="submit"
          form={formId}
          block
          loading={busy === Busy.Create}
          loadingLabel={t("groups.addMember.creating")}
        >
          {t("groups.addMember.submitCreate")}
        </Button>
      );
      break;

    case Step.Registered:
      body = (
        <>
          {errorBanner}
          {stepHeading(t("groups.addMember.registeredTitle"))}
          <PersonCard
            name={personName}
            subtitle={t("groups.addMember.hasAccount")}
            variant={AvatarVariant.Neutral}
          />
          <p className="m-0 mb-4 text-body text-text">
            {t("groups.addMember.registeredBody", { name: personName })}
          </p>
          <Banner tone={BannerTone.Info}>{t("groups.addMember.registeredHint")}</Banner>
        </>
      );
      footer = (
        <Button
          block
          icon={<Send className="size-5" strokeWidth={1.75} />}
          loading={busy === Busy.Invite}
          loadingLabel={t("groups.addMember.inviting")}
          {...onlineAction.offlineProps}
          onClick={onlineAction.guard(() => void invitePerson())}
        >
          {t("groups.addMember.invite")}
        </Button>
      );
      break;

    case Step.AlreadyMember:
      body = (
        <>
          {stepHeading(t("groups.addMember.alreadyMemberTitle"))}
          <PersonCard
            name={personName}
            subtitle={t("groups.addMember.memberOf", { family: groupName })}
            variant={AvatarVariant.Neutral}
          />
          <Banner tone={BannerTone.Info} role="status" icon={UserCheck}>
            {isSelf
              ? t("groups.addMember.alreadyMemberSelf")
              : t("groups.addMember.alreadyMember", { name: personName })}
          </Banner>
        </>
      );
      footer = anotherEmailButton;
      break;

    case Step.PendingInvite:
      body = (
        <>
          {stepHeading(t("groups.addMember.pendingTitle"))}
          <PersonCard name={personName} subtitle={pendingSince} variant={AvatarVariant.Pending} />
          <Banner tone={BannerTone.Warning} role="status" icon={Clock}>
            {t("groups.addMember.pending", { name: personName })}
          </Banner>
          {lookup?.invitationId ? (
            <Button
              variant={ButtonVariant.DestructiveGhost}
              className="mt-2 -ml-1 px-1!"
              icon={<X className="size-[18px]" strokeWidth={1.75} />}
              {...onlineAction.offlineProps}
              onClick={onlineAction.guard(() => setCancelOpen(true))}
            >
              {t("groups.addMember.cancelInvite")}
            </Button>
          ) : null}
        </>
      );
      footer = anotherEmailButton;
      break;
  }

  return (
    <>
      <Sheet
        open={open}
        onOpenChange={(next) => {
          if (!isBusy) onOpenChange(next);
        }}
        title={t("groups.addMember.title")}
        tall
        dismissible={!isBusy}
        busy={isBusy}
        leading={leading}
        footer={footer}
      >
        {body}
      </Sheet>

      <ConfirmModal
        open={cancelOpen}
        onOpenChange={(next) => {
          setCancelOpen(next);
          if (!next && cancelDone.current) {
            cancelDone.current = false;
            setLookup(null);
            backToEmail(true);
          }
        }}
        tone={ConfirmTone.Destructive}
        loading={canceling}
        title={t("groups.invitations.cancelTitle", { name: personName })}
        description={t("groups.invitations.cancelBody", { name: personName, family: groupName })}
        confirmLabel={t("groups.invitations.cancelConfirm")}
        cancelLabel={t("groups.invitations.keep")}
        onConfirm={confirmCancel}
      />
    </>
  );
};

export default AddMemberSheet;
