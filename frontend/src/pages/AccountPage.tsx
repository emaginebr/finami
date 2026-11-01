import { useEffect, useId, useState } from "react";
import type { FormEvent } from "react";
import { Check, ChevronRight, KeyRound, LogOut } from "lucide-react";
import { Link, useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { LargeTitleHeader } from "../components/layout/LargeTitleHeader";
import { AppTab } from "../components/layout/navigation";
import { NotificationBell } from "../components/notification/NotificationBell";
import { NotificationBellVariant } from "../components/ui/variants";
import { Avatar } from "../components/ui/Avatar";
import { Banner } from "../components/ui/Banner";
import { Button } from "../components/ui/Button";
import { ConfirmModal } from "../components/ui/ConfirmModal";
import { PasswordField } from "../components/ui/PasswordField";
import { Sheet } from "../components/ui/Sheet";
import { TextField } from "../components/ui/TextField";
import { listRowClasses } from "../components/ui/listRow";
import { useAuth } from "../hooks/useAuth";
import { useGroup } from "../hooks/useGroup";
import { useUser } from "../hooks/useUser";
import { isApiError } from "../types/api";
import { cn } from "../utils/cn";
import { errorMessage, notifySuccess } from "../utils/notify";
import {
  MAX_EMAIL_LENGTH,
  MAX_NAME_LENGTH,
  MIN_PASSWORD_LENGTH,
  isValidEmail,
} from "../utils/validation";

interface ProfileErrors {
  firstName: string | null;
  lastName: string | null;
  email: string | null;
}

const NO_PROFILE_ERRORS: ProfileErrors = { firstName: null, lastName: null, email: null };

const sectionTitle = "m-0 flex min-h-touch items-center px-4 text-footnote font-semibold tracking-wider text-text-muted uppercase";

/** Aba Conta (rota `/conta`) — US6, mockup account.html */
const AccountPage = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { session, logout, refreshMe } = useAuth();
  const { createdByMe, loadCreatedByMe, updateUser, changePassword } = useUser();
  const { groups, loadGroups } = useGroup();
  const profileFormId = useId();
  const passwordFormId = useId();
  const personalId = useId();
  const securityId = useId();
  const peopleId = useId();

  const [profileOpen, setProfileOpen] = useState(false);
  const [profile, setProfile] = useState({ firstName: "", lastName: "", email: "" });
  const [profileErrors, setProfileErrors] = useState<ProfileErrors>(NO_PROFILE_ERRORS);
  const [profileError, setProfileError] = useState<string | null>(null);
  const [savingProfile, setSavingProfile] = useState(false);

  const [passwordOpen, setPasswordOpen] = useState(false);
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [currentError, setCurrentError] = useState<string | null>(null);
  const [newError, setNewError] = useState<string | null>(null);
  const [passwordError, setPasswordError] = useState<string | null>(null);
  const [savingPassword, setSavingPassword] = useState(false);

  const [logoutOpen, setLogoutOpen] = useState(false);

  useEffect(() => {
    loadCreatedByMe().catch(() => undefined);
    // Famílias das pessoas cadastradas ("sem login · família Silva")
    if (groups.length === 0) loadGroups().catch(() => undefined);
    // Só ao abrir a aba
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loadCreatedByMe]);

  const user = session?.user ?? null;
  const bell = <NotificationBell variant={NotificationBellVariant.Header} className="md:hidden" />;
  if (!user) return <LargeTitleHeader title={t("nav.account")} titleAccessory={bell} />;

  const fullName = `${user.firstName} ${user.lastName}`.trim();
  const passwordTitle = user.hasPassword ? t("account.changePassword") : t("account.setPassword");

  const openProfile = () => {
    setProfile({ firstName: user.firstName, lastName: user.lastName, email: user.email ?? "" });
    setProfileErrors(NO_PROFILE_ERRORS);
    setProfileError(null);
    setProfileOpen(true);
  };

  const openPassword = () => {
    setCurrentPassword("");
    setNewPassword("");
    setCurrentError(null);
    setNewError(null);
    setPasswordError(null);
    setPasswordOpen(true);
  };

  const saveProfile = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const required = (value: string) =>
      !value.trim()
        ? t("validation.required")
        : value.trim().length > MAX_NAME_LENGTH
          ? t("validation.maxLength", { max: MAX_NAME_LENGTH })
          : null;
    const errors: ProfileErrors = {
      firstName: required(profile.firstName),
      lastName: required(profile.lastName),
      email: profile.email.trim() && !isValidEmail(profile.email) ? t("validation.emailInvalid") : null,
    };
    setProfileErrors(errors);
    if (errors.firstName || errors.lastName || errors.email) return;

    setSavingProfile(true);
    setProfileError(null);
    try {
      await updateUser(user.userId, {
        firstName: profile.firstName.trim(),
        lastName: profile.lastName.trim(),
        email: profile.email.trim() || null,
      });
      await refreshMe();
      setProfileOpen(false);
      notifySuccess(t("account.profileSaved"));
    } catch (err) {
      setProfileError(errorMessage(err));
    } finally {
      setSavingProfile(false);
    }
  };

  const savePassword = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const current = user.hasPassword && !currentPassword ? t("validation.required") : null;
    const next =
      newPassword.length < MIN_PASSWORD_LENGTH ? t("validation.passwordMin", { min: MIN_PASSWORD_LENGTH }) : null;
    setCurrentError(current);
    setNewError(next);
    if (current || next) return;

    setSavingPassword(true);
    setPasswordError(null);
    try {
      await changePassword(user.userId, {
        currentPassword: user.hasPassword ? currentPassword : null,
        newPassword,
      });
      if (!user.hasPassword) await refreshMe();
      setPasswordOpen(false);
      notifySuccess(user.hasPassword ? t("account.passwordChanged") : t("account.passwordSet"));
    } catch (err) {
      // Senha atual incorreta: o erro fica ligado ao campo
      if (user.hasPassword && isApiError(err) && err.status >= 400 && err.status < 500) {
        setCurrentError(err.mensagem);
      } else {
        setPasswordError(errorMessage(err));
      }
    } finally {
      setSavingPassword(false);
    }
  };

  const confirmLogout = () => {
    logout();
    navigate("/entrar", { replace: true });
  };

  const valueRow = (label: string, value: string) => (
    <button
      type="button"
      onClick={openProfile}
      className={listRowClasses({ interactive: true })}
    >
      <span className="min-w-0 flex-1 text-body">{label}</span>
      <span className="max-w-[55%] truncate text-body text-text-muted">{value}</span>
      <ChevronRight aria-hidden="true" className="size-[18px] shrink-0 text-text-subtle" />
    </button>
  );

  return (
    <>
      <LargeTitleHeader title={t("nav.account")} titleAccessory={bell} />

      <div className="mt-3 flex items-center gap-4 rounded-lg bg-surface p-4">
        <Avatar name={fullName} colorIndex={0} size="lg" />
        <div className="min-w-0">
          <Link
            to={`/pessoas/${user.userId}`}
            state={{ tab: AppTab.Account, backTo: "/conta", backLabel: t("nav.account"), colorIndex: 0 }}
            className="block truncate text-headline text-text no-underline hover:underline"
          >
            {fullName}
          </Link>
          {user.email ? <p className="m-0 truncate text-footnote text-text-muted">{user.email}</p> : null}
        </div>
      </div>

      <section aria-labelledby={personalId} className="mt-7">
        <h2 id={personalId} className={sectionTitle}>
          {t("account.personal")}
        </h2>
        <div className="overflow-hidden rounded-lg bg-surface">
          {valueRow(t("auth.register.firstName"), user.firstName)}
          {valueRow(t("auth.register.lastName"), user.lastName)}
          {valueRow(t("auth.email"), user.email ?? t("account.noEmail"))}
        </div>
      </section>

      <section aria-labelledby={securityId} className="mt-7">
        <h2 id={securityId} className={sectionTitle}>
          {t("account.security")}
        </h2>
        <div className="overflow-hidden rounded-lg bg-surface">
          <button
            type="button"
            onClick={openPassword}
            className={listRowClasses({ withIcon: true, interactive: true })}
          >
            <span aria-hidden="true" className="grid size-[30px] shrink-0 place-items-center rounded-sm bg-family-yellow text-on-accent">
              <KeyRound className="size-[18px]" strokeWidth={1.75} />
            </span>
            <span className="min-w-0 flex-1 text-body">{passwordTitle}</span>
            <ChevronRight aria-hidden="true" className="size-[18px] shrink-0 text-text-subtle" />
          </button>
          <div className={listRowClasses({ withIcon: true })}>
            <span aria-hidden="true" className="grid size-[30px] shrink-0 place-items-center rounded-sm bg-logo-white">
              {/* "G" oficial multicolorido, decorativo (REVIEW C-3) */}
              <svg viewBox="0 0 48 48" className="size-[18px]" focusable="false">
                <path
                  fill="#EA4335"
                  d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"
                />
                <path
                  fill="#4285F4"
                  d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"
                />
                <path
                  fill="#FBBC05"
                  d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z"
                />
                <path
                  fill="#34A853"
                  d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"
                />
              </svg>
            </span>
            <span className="min-w-0 flex-1 text-body">{t("account.google")}</span>
            <span className={cn("flex items-center gap-1 text-body", user.hasGoogle ? "text-positive" : "text-text-muted")}>
              {user.hasGoogle ? <Check aria-hidden="true" className="size-4" strokeWidth={2.5} /> : null}
              {user.hasGoogle ? t("account.googleLinked") : t("account.googleNotLinked")}
            </span>
          </div>
        </div>
      </section>

      <section aria-labelledby={peopleId} className="mt-7">
        <h2 id={peopleId} className={sectionTitle}>
          {t("account.people")}
        </h2>
        {createdByMe.length > 0 ? (
          <div className="overflow-hidden rounded-lg bg-surface">
            {createdByMe.map((person, index) => (
              <div key={person.userId} className={listRowClasses({ twoLines: true, withIcon: true })}>
                <Avatar name={`${person.firstName} ${person.lastName}`} colorIndex={index + 2} size="sm" />
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-headline">
                    {person.firstName} {person.lastName}
                  </span>
                  <span className="mt-0.5 block truncate text-footnote text-text-muted">
                    {/* "sem login · família Silva" (REVIEW C-2) */}
                    {[
                      person.canLogin ? person.email : t("account.noLogin"),
                      ...groups
                        .filter((g) => g.members.some((m) => m.userId === person.userId))
                        .map((g) => t("account.familyOf", { name: g.name })),
                    ]
                      .filter(Boolean)
                      .join(" · ")}
                  </span>
                </span>
              </div>
            ))}
          </div>
        ) : null}
        <p className="m-0 px-4 pt-2 text-footnote text-text-muted">
          {createdByMe.length > 0 ? t("account.peopleHint") : t("account.peopleEmpty")}
        </p>
      </section>

      <section className="mt-7">
        <div className="overflow-hidden rounded-lg bg-surface">
          <button
            type="button"
            onClick={() => setLogoutOpen(true)}
            className={cn(listRowClasses({ interactive: true }), "justify-center font-semibold")}
          >
            {/* Ação destrutiva em rosa (REVIEW C-1); a cor vai nos filhos para não disputar com text-text da linha */}
            <LogOut aria-hidden="true" className="size-[18px] text-negative" strokeWidth={1.75} />
            <span className="text-negative">{t("actions.signOut")}</span>
          </button>
        </div>
      </section>

      <Sheet
        open={profileOpen}
        onOpenChange={(open) => !savingProfile && setProfileOpen(open)}
        title={t("account.personal")}
        dismissible={!savingProfile}
        footer={
          <Button type="submit" form={profileFormId} block loading={savingProfile} loadingLabel={t("actions.saving")}>
            {t("actions.save")}
          </Button>
        }
      >
        <form id={profileFormId} noValidate onSubmit={(event) => void saveProfile(event)} className="flex flex-col gap-4">
          {profileError ? (
            <Banner tone="error" role="alert">
              {profileError}
            </Banner>
          ) : null}
          <TextField
            label={t("auth.register.firstName")}
            autoComplete="given-name"
            maxLength={MAX_NAME_LENGTH}
            value={profile.firstName}
            error={profileErrors.firstName}
            disabled={savingProfile}
            data-autofocus=""
            onChange={(event) => setProfile((p) => ({ ...p, firstName: event.target.value }))}
          />
          <TextField
            label={t("auth.register.lastName")}
            autoComplete="family-name"
            maxLength={MAX_NAME_LENGTH}
            value={profile.lastName}
            error={profileErrors.lastName}
            disabled={savingProfile}
            onChange={(event) => setProfile((p) => ({ ...p, lastName: event.target.value }))}
          />
          <TextField
            label={t("auth.email")}
            type="email"
            autoComplete="email"
            maxLength={MAX_EMAIL_LENGTH}
            value={profile.email}
            error={profileErrors.email}
            disabled={savingProfile}
            onChange={(event) => setProfile((p) => ({ ...p, email: event.target.value }))}
          />
        </form>
      </Sheet>

      <Sheet
        open={passwordOpen}
        onOpenChange={(open) => !savingPassword && setPasswordOpen(open)}
        title={passwordTitle}
        dismissible={!savingPassword}
        footer={
          <Button type="submit" form={passwordFormId} block loading={savingPassword} loadingLabel={t("actions.saving")}>
            {passwordTitle}
          </Button>
        }
      >
        <form id={passwordFormId} noValidate onSubmit={(event) => void savePassword(event)} className="flex flex-col gap-4">
          {!user.hasPassword ? (
            <Banner tone="info">{t("account.setPasswordHint", { email: user.email ?? "" })}</Banner>
          ) : null}
          {passwordError ? (
            <Banner tone="error" role="alert">
              {passwordError}
            </Banner>
          ) : null}
          {user.hasPassword ? (
            <PasswordField
              label={t("account.currentPassword")}
              autoComplete="current-password"
              value={currentPassword}
              error={currentError}
              disabled={savingPassword}
              data-autofocus=""
              onChange={(event) => setCurrentPassword(event.target.value)}
            />
          ) : null}
          <PasswordField
            label={t("account.newPassword")}
            autoComplete="new-password"
            hint={t("auth.register.passwordHint", { min: MIN_PASSWORD_LENGTH })}
            value={newPassword}
            error={newError}
            disabled={savingPassword}
            onChange={(event) => setNewPassword(event.target.value)}
          />
        </form>
      </Sheet>

      <ConfirmModal
        open={logoutOpen}
        onOpenChange={setLogoutOpen}
        tone="destructive"
        title={t("account.logoutTitle")}
        description={t("account.logoutBody")}
        confirmLabel={t("actions.signOut")}
        onConfirm={confirmLogout}
      />
    </>
  );
};

export default AccountPage;
