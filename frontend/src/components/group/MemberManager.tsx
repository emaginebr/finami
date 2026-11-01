import { useState } from "react";
import type { FormEvent } from "react";
import { ChevronRight, Search, UserPlus } from "lucide-react";
import { useTranslation } from "react-i18next";
import { useGroup } from "../../hooks/useGroup";
import { useUser } from "../../hooks/useUser";
import { isApiError } from "../../types/api";
import type { GroupInfo, GroupMemberInfo } from "../../types/group";
import type { UserSearchInfo } from "../../types/user";
import { errorMessage, notifyError, notifySuccess } from "../../utils/notify";
import { MAX_EMAIL_LENGTH, MAX_NAME_LENGTH, isValidEmail } from "../../utils/validation";
import { Avatar } from "../ui/Avatar";
import { Badge } from "../ui/Badge";
import { Banner } from "../ui/Banner";
import { Button } from "../ui/Button";
import { ConfirmModal } from "../ui/ConfirmModal";
import { TextField } from "../ui/TextField";
import { listRowClasses } from "../ui/listRow";

export interface MemberManagerProps {
  group: GroupInfo;
  currentUserId: number | null;
}

interface PersonErrors {
  firstName: string | null;
  lastName: string | null;
  email: string | null;
}

const NO_PERSON_ERRORS: PersonErrors = { firstName: null, lastName: null, email: null };

const fullName = (person: { firstName: string; lastName: string }) =>
  `${person.firstName} ${person.lastName}`.trim();

/**
 * Membros da família (FR-028): lista para todos; incluir por email, cadastrar pessoa sem
 * login e retirar **só** para o responsável — para os demais essas partes não são renderizadas.
 */
export const MemberManager = ({ group, currentUserId }: MemberManagerProps) => {
  const { t } = useTranslation();
  const { addMember, removeMember } = useGroup();
  const { searchByEmail, createUser } = useUser();
  const canManage = group.isResponsible;

  const [email, setEmail] = useState("");
  const [emailError, setEmailError] = useState<string | null>(null);
  const [searching, setSearching] = useState(false);
  const [found, setFound] = useState<UserSearchInfo | null>(null);
  const [notFound, setNotFound] = useState(false);
  const [adding, setAdding] = useState(false);
  const [addError, setAddError] = useState<string | null>(null);

  const [personOpen, setPersonOpen] = useState(false);
  const [person, setPerson] = useState({ firstName: "", lastName: "", email: "" });
  const [personErrors, setPersonErrors] = useState<PersonErrors>(NO_PERSON_ERRORS);
  const [personSaving, setPersonSaving] = useState(false);
  const [personError, setPersonError] = useState<string | null>(null);

  const [removing, setRemoving] = useState<GroupMemberInfo | null>(null);
  const [removeBusy, setRemoveBusy] = useState(false);

  const addErrorMessage = (err: unknown) =>
    isApiError(err) && err.status === 409 ? t("groups.members.alreadyMember") : errorMessage(err);

  const search = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setFound(null);
    setNotFound(false);
    setAddError(null);
    if (!isValidEmail(email)) {
      setEmailError(t("validation.emailInvalid"));
      return;
    }
    setEmailError(null);
    setSearching(true);
    try {
      const result = await searchByEmail(email.trim());
      setFound(result);
      setNotFound(result === null);
    } catch (err) {
      setAddError(errorMessage(err));
    } finally {
      setSearching(false);
    }
  };

  const include = async (target: UserSearchInfo) => {
    setAdding(true);
    setAddError(null);
    try {
      await addMember(group.groupId, target.userId);
      notifySuccess(t("groups.members.added", { name: fullName(target), family: group.name }));
      setFound(null);
      setEmail("");
    } catch (err) {
      setAddError(addErrorMessage(err));
    } finally {
      setAdding(false);
    }
  };

  const createPerson = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const required = (value: string) =>
      !value.trim()
        ? t("validation.required")
        : value.trim().length > MAX_NAME_LENGTH
          ? t("validation.maxLength", { max: MAX_NAME_LENGTH })
          : null;
    const errors: PersonErrors = {
      firstName: required(person.firstName),
      lastName: required(person.lastName),
      email: person.email.trim() && !isValidEmail(person.email) ? t("validation.emailInvalid") : null,
    };
    setPersonErrors(errors);
    if (errors.firstName || errors.lastName || errors.email) return;

    setPersonSaving(true);
    setPersonError(null);
    try {
      const created = await createUser({
        firstName: person.firstName.trim(),
        lastName: person.lastName.trim(),
        email: person.email.trim() || null,
        password: null,
      });
      await addMember(group.groupId, created.userId);
      notifySuccess(t("groups.members.added", { name: fullName(created), family: group.name }));
      setPerson({ firstName: "", lastName: "", email: "" });
      setPersonOpen(false);
    } catch (err) {
      setPersonError(addErrorMessage(err));
    } finally {
      setPersonSaving(false);
    }
  };

  const confirmRemove = async () => {
    if (!removing) return;
    setRemoveBusy(true);
    try {
      await removeMember(group.groupId, removing.userId);
      notifySuccess(t("groups.members.removed", { name: fullName(removing) }));
    } catch (err) {
      notifyError(err);
      throw err;
    } finally {
      setRemoveBusy(false);
    }
  };

  const memberSubtitle = (member: GroupMemberInfo) => {
    const parts: string[] = [];
    if (member.userId === currentUserId) parts.push(t("groups.members.you"));
    else if (member.userId !== group.responsibleUserId) parts.push(t("groups.members.member"));
    return parts.join(" · ");
  };

  return (
    <div className="flex flex-col gap-6">
      <section aria-labelledby={`members-${group.groupId}`}>
        <h3
          id={`members-${group.groupId}`}
          className="m-0 mb-2 px-4 text-footnote font-semibold tracking-wider text-text-muted uppercase"
        >
          {t("groups.members.title", { count: group.members.length })}
        </h3>
        <div className="overflow-hidden rounded-lg bg-surface">
          {group.members.map((member, index) => {
            const isResponsible = member.userId === group.responsibleUserId;
            const subtitle = memberSubtitle(member);
            return (
              <div key={member.userId} className={listRowClasses({ twoLines: true, withIcon: true })}>
                <Avatar name={fullName(member)} colorIndex={index} />
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-headline">{fullName(member)}</span>
                  {isResponsible || subtitle ? (
                    <span className="mt-0.5 block truncate text-footnote text-text-muted">
                      {isResponsible ? <Badge variant="responsible">{t("badges.responsible")}</Badge> : null}
                      {isResponsible && subtitle ? " · " : null}
                      {subtitle}
                    </span>
                  ) : null}
                </span>
                {canManage && !isResponsible ? (
                  <Button
                    variant="destructiveGhost"
                    size="sm"
                    aria-label={t("groups.members.removeAria", { name: fullName(member) })}
                    onClick={() => setRemoving(member)}
                  >
                    {t("groups.members.remove")}
                  </Button>
                ) : null}
              </div>
            );
          })}
        </div>
        {!canManage ? (
          <p className="m-0 px-4 pt-2 text-footnote text-text-muted">{t("groups.members.onlyResponsible")}</p>
        ) : null}
      </section>

      {canManage ? (
        <section aria-labelledby={`include-${group.groupId}`}>
          <h3
            id={`include-${group.groupId}`}
            className="m-0 mb-2 px-4 text-footnote font-semibold tracking-wider text-text-muted uppercase"
          >
            {t("groups.members.include")}
          </h3>
          <div className="rounded-lg bg-surface p-4">
            <form noValidate onSubmit={(event) => void search(event)} className="flex items-start gap-2">
              <TextField
                label={t("groups.members.searchLabel")}
                containerClassName="flex-1"
                type="email"
                inputMode="email"
                autoComplete="off"
                maxLength={MAX_EMAIL_LENGTH}
                value={email}
                error={emailError}
                onChange={(event) => {
                  setEmail(event.target.value);
                  setFound(null);
                  setNotFound(false);
                }}
              />
              <Button
                type="submit"
                variant="secondary"
                className="mt-[1.6875rem]"
                aria-label={t("groups.members.searchButton")}
                loading={searching}
              >
                <Search aria-hidden="true" className="size-[18px]" strokeWidth={1.75} />
              </Button>
            </form>

            {notFound ? (
              <p role="status" className="m-0 mt-3 text-footnote text-text-muted">
                {t("groups.members.notFound")}
              </p>
            ) : null}

            {found ? (
              <div className="mt-3 flex items-center gap-3">
                <Avatar name={fullName(found)} colorIndex={0} size="sm" />
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-headline">{fullName(found)}</span>
                  <span className="block text-footnote text-text-muted">{t("groups.members.found")}</span>
                </span>
                <Button
                  size="sm"
                  icon={<UserPlus className="size-[18px]" strokeWidth={1.75} />}
                  aria-label={t("groups.members.includeAria", { name: fullName(found) })}
                  loading={adding}
                  onClick={() => void include(found)}
                >
                  {t("groups.members.includeButton")}
                </Button>
              </div>
            ) : null}

            {addError ? (
              <Banner tone="error" role="alert" className="mt-3">
                {addError}
              </Banner>
            ) : null}
          </div>

          <div className="mt-3 overflow-hidden rounded-lg bg-surface">
            <button
              type="button"
              aria-expanded={personOpen}
              onClick={() => setPersonOpen((open) => !open)}
              className={listRowClasses({ twoLines: true, withIcon: true, interactive: true })}
            >
              <span aria-hidden="true" className="grid size-8 shrink-0 place-items-center rounded-sm bg-surface-2 text-accent">
                <UserPlus className="size-[18px]" strokeWidth={1.75} />
              </span>
              <span className="min-w-0 flex-1">
                <span className="block text-body text-accent">{t("groups.members.createPerson")}</span>
                <span className="mt-0.5 block text-footnote text-text-muted">
                  {t("groups.members.createPersonHint")}
                </span>
              </span>
              <ChevronRight
                aria-hidden="true"
                className={"size-[18px] shrink-0 text-text-subtle motion-safe:transition-transform" + (personOpen ? " rotate-90" : "")}
              />
            </button>
          </div>

          {personOpen ? (
            <form noValidate onSubmit={(event) => void createPerson(event)} className="mt-3">
              <fieldset className="m-0 flex flex-col gap-4 rounded-lg border-0 bg-surface p-4">
                <legend className="sr-only">{t("groups.members.personTitle")}</legend>
                {personError ? (
                  <Banner tone="error" role="alert">
                    {personError}
                  </Banner>
                ) : null}
                <div className="grid grid-cols-1 gap-4 min-[360px]:grid-cols-2 min-[360px]:gap-3">
                  <TextField
                    label={t("auth.register.firstName")}
                    autoComplete="off"
                    maxLength={MAX_NAME_LENGTH}
                    value={person.firstName}
                    error={personErrors.firstName}
                    onChange={(event) => setPerson((p) => ({ ...p, firstName: event.target.value }))}
                  />
                  <TextField
                    label={t("auth.register.lastName")}
                    autoComplete="off"
                    maxLength={MAX_NAME_LENGTH}
                    value={person.lastName}
                    error={personErrors.lastName}
                    onChange={(event) => setPerson((p) => ({ ...p, lastName: event.target.value }))}
                  />
                </div>
                <TextField
                  label={t("auth.email")}
                  labelSuffix={t("transaction.optional")}
                  type="email"
                  autoComplete="off"
                  maxLength={MAX_EMAIL_LENGTH}
                  value={person.email}
                  error={personErrors.email}
                  onChange={(event) => setPerson((p) => ({ ...p, email: event.target.value }))}
                />
                <Banner tone="info">{t("groups.members.personHint")}</Banner>
                <Button type="submit" block loading={personSaving} loadingLabel={t("actions.saving")}>
                  {t("groups.members.personSubmit")}
                </Button>
              </fieldset>
            </form>
          ) : null}
        </section>
      ) : null}

      <ConfirmModal
        open={removing !== null}
        onOpenChange={(open) => {
          if (!open) setRemoving(null);
        }}
        tone="destructive"
        loading={removeBusy}
        title={removing ? t("groups.members.removeTitle", { name: fullName(removing) }) : ""}
        description={
          removing
            ? t("groups.members.removeBody", { name: removing.firstName, family: group.name })
            : undefined
        }
        confirmLabel={t("groups.members.remove")}
        onConfirm={confirmRemove}
      />
    </div>
  );
};

export default MemberManager;
