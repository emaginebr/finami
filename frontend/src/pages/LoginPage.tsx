import { useRef, useState } from "react";
import type { FormEvent } from "react";
import { Link, Navigate, useLocation } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { AppIcon } from "../components/brand/AppIcon";
import { Logo } from "../components/brand/Logo";
import { AuthLayout } from "../components/layout/AuthLayout";
import { readNavState } from "../components/layout/navigation";
import { Banner } from "../components/ui/Banner";
import { Button } from "../components/ui/Button";
import { PasswordField } from "../components/ui/PasswordField";
import { TextField } from "../components/ui/TextField";
import { useAuth } from "../hooks/useAuth";
import { useGoogleSignIn } from "../hooks/useGoogleSignIn";
import { AuthStatus } from "../types/auth";
import { errorMessage } from "../utils/notify";
import { MAX_EMAIL_LENGTH, isValidEmail } from "../utils/validation";

interface LoginFieldErrors {
  email: string | null;
  password: string | null;
}

const NO_ERRORS: LoginFieldErrors = { email: null, password: null };

/** Tela "Entrar" (rota `/entrar`) — mockup docs/design/mockups/login.html */
const LoginPage = () => {
  const { t } = useTranslation();
  const location = useLocation();
  const { status, login, loginWithGoogle, logoutReason } = useAuth();
  const navState = readNavState(location.state);
  const from = navState.from
    ? `${navState.from.pathname}${navState.from.search ?? ""}${navState.from.hash ?? ""}`
    : "/";
  const reason = navState.reason ?? logoutReason;

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [fieldErrors, setFieldErrors] = useState<LoginFieldErrors>(NO_ERRORS);
  const [serverError, setServerError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const passwordRef = useRef<HTMLInputElement>(null);
  const googleRef = useRef<HTMLDivElement>(null);

  const google = useGoogleSignIn({
    containerRef: googleRef,
    text: "signin_with",
    onCredential: (idToken) => {
      setServerError(null);
      setSubmitting(true);
      loginWithGoogle({ idToken })
        .catch((err: unknown) => setServerError(errorMessage(err) || t("auth.googleError")))
        .finally(() => setSubmitting(false));
    },
  });

  if (status === AuthStatus.Authenticated) return <Navigate to={from} replace />;

  const validate = (): LoginFieldErrors => ({
    email: !email.trim()
      ? t("validation.required")
      : !isValidEmail(email)
        ? t("validation.emailInvalid")
        : null,
    password: password ? null : t("validation.required"),
  });

  const onSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (submitting) return;
    const errors = validate();
    setFieldErrors(errors);
    if (errors.email || errors.password) return;

    setSubmitting(true);
    setServerError(null);
    try {
      await login({ email: email.trim(), password });
      // O redirecionamento acontece quando o status vira "authenticated"
    } catch (err) {
      setServerError(errorMessage(err));
      setPassword("");
      setFieldErrors({ email: null, password: t("auth.login.retypePassword") });
      passwordRef.current?.focus();
    } finally {
      setSubmitting(false);
    }
  };

  const showReason = Boolean(reason) && !serverError;

  return (
    <AuthLayout>
      <div className="mt-6 mb-8 flex flex-col items-center gap-4">
        <AppIcon size="lg" />
        <Logo className="h-14" containerClassName="rounded-lg" />
      </div>

      {showReason ? (
        <Banner tone="expired" role="status" title={t("auth.login.sessionExpiredTitle")} className="mb-4">
          {t("auth.login.sessionExpiredBody")}
        </Banner>
      ) : null}

      <h1 className="m-0 mb-5 font-display text-[1.75rem] leading-[2.125rem] font-bold">
        {t("auth.login.title")}
      </h1>

      {serverError ? (
        <Banner tone="error" role="alert" title={t("auth.login.errorTitle")} className="mb-4">
          {serverError}
        </Banner>
      ) : null}

      <form noValidate onSubmit={(event) => void onSubmit(event)} className="flex flex-col gap-4">
        <TextField
          label={t("auth.email")}
          type="email"
          autoComplete="email"
          inputMode="email"
          placeholder={t("auth.emailPlaceholder")}
          maxLength={MAX_EMAIL_LENGTH}
          value={email}
          error={fieldErrors.email}
          disabled={submitting}
          onChange={(event) => setEmail(event.target.value)}
        />
        <PasswordField
          ref={passwordRef}
          label={t("auth.password")}
          autoComplete="current-password"
          placeholder={t("auth.login.passwordPlaceholder")}
          value={password}
          error={fieldErrors.password}
          disabled={submitting}
          onChange={(event) => setPassword(event.target.value)}
        />
        <Button
          type="submit"
          block
          className="mt-2"
          loading={submitting}
          loadingLabel={t("auth.login.submitting")}
        >
          {t("auth.login.submit")}
        </Button>
      </form>

      {google.enabled && !google.failed ? (
        <>
          <div className="my-5 flex items-center gap-3 text-footnote text-text-muted before:flex-1 before:border-t before:border-separator before:content-[''] after:flex-1 after:border-t after:border-separator after:content-['']">
            {t("auth.or")}
          </div>
          <div ref={googleRef} data-google-button="" className="flex min-h-12 w-full justify-center" />
        </>
      ) : null}

      <p className="mt-6 text-center text-subhead text-text-muted">
        {t("auth.login.noAccount")}{" "}
        <Link to="/cadastro" className="inline-flex min-h-touch items-center font-semibold text-accent no-underline">
          {t("auth.login.createAccount")}
        </Link>
      </p>
    </AuthLayout>
  );
};

export default LoginPage;
