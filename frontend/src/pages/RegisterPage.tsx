import { useRef, useState } from "react";
import type { FormEvent } from "react";
import { ChevronLeft } from "lucide-react";
import { Link, Navigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { AppIcon } from "../components/brand/AppIcon";
import { AuthLayout } from "../components/layout/AuthLayout";
import { Banner } from "../components/ui/Banner";
import { Button } from "../components/ui/Button";
import { PasswordField } from "../components/ui/PasswordField";
import { TextField } from "../components/ui/TextField";
import { useAuth } from "../hooks/useAuth";
import { useGoogleSignIn } from "../hooks/useGoogleSignIn";
import { isApiError } from "../types/api";
import { AuthStatus } from "../types/auth";
import { errorMessage, notifySuccess } from "../utils/notify";
import {
  MAX_EMAIL_LENGTH,
  MAX_NAME_LENGTH,
  MIN_PASSWORD_LENGTH,
  isValidEmail,
  parseFieldError,
} from "../utils/validation";

interface RegisterFields {
  firstName: string;
  lastName: string;
  email: string;
  password: string;
}

interface RegisterErrors {
  firstName: string | null;
  lastName: string | null;
  email: string | null;
  password: string | null;
}

const EMPTY_FIELDS: RegisterFields = { firstName: "", lastName: "", email: "", password: "" };
const NO_ERRORS: RegisterErrors = { firstName: null, lastName: null, email: null, password: null };
const FIELD_NAMES: Array<keyof RegisterFields> = ["firstName", "lastName", "email", "password"];

const isFieldName = (value: string): value is keyof RegisterFields =>
  (FIELD_NAMES as string[]).includes(value);

/** Tela "Criar conta" (rota `/cadastro`) — mockup docs/design/mockups/register.html */
const RegisterPage = () => {
  const { t } = useTranslation();
  const { status, register, loginWithGoogle } = useAuth();
  const [fields, setFields] = useState<RegisterFields>(EMPTY_FIELDS);
  const [errors, setErrors] = useState<RegisterErrors>(NO_ERRORS);
  const [serverError, setServerError] = useState<string | null>(null);
  const [emailTaken, setEmailTaken] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const googleRef = useRef<HTMLDivElement>(null);

  const google = useGoogleSignIn({
    containerRef: googleRef,
    text: "signup_with",
    onCredential: (idToken) => {
      setServerError(null);
      setSubmitting(true);
      loginWithGoogle({ idToken })
        .catch((err: unknown) => setServerError(errorMessage(err) || t("auth.googleError")))
        .finally(() => setSubmitting(false));
    },
  });

  if (status === AuthStatus.Authenticated) return <Navigate to="/" replace />;

  const update = (name: keyof RegisterFields, value: string) => {
    setFields((prev) => ({ ...prev, [name]: value }));
    if (errors[name]) setErrors((prev) => ({ ...prev, [name]: null }));
  };

  const validate = (): RegisterErrors => {
    const requiredOrMax = (value: string, max: number) =>
      !value.trim()
        ? t("validation.required")
        : value.trim().length > max
          ? t("validation.maxLength", { max })
          : null;
    return {
      firstName: requiredOrMax(fields.firstName, MAX_NAME_LENGTH),
      lastName: requiredOrMax(fields.lastName, MAX_NAME_LENGTH),
      email: !fields.email.trim()
        ? t("validation.required")
        : !isValidEmail(fields.email)
          ? t("validation.emailInvalid")
          : null,
      password:
        fields.password.length < MIN_PASSWORD_LENGTH
          ? t("validation.passwordMin", { min: MIN_PASSWORD_LENGTH })
          : null,
    };
  };

  const onSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (submitting) return;
    const nextErrors = validate();
    setErrors(nextErrors);
    setEmailTaken(false);
    setServerError(null);
    if (Object.values(nextErrors).some(Boolean)) return;

    setSubmitting(true);
    try {
      await register({
        firstName: fields.firstName.trim(),
        lastName: fields.lastName.trim(),
        email: fields.email.trim(),
        password: fields.password,
      });
      notifySuccess(t("auth.register.welcome"));
    } catch (err) {
      if (isApiError(err) && err.status === 409) {
        setEmailTaken(true);
        setErrors((prev) => ({ ...prev, email: t("auth.register.emailTakenField") }));
      } else {
        // Erros de validação do servidor ("Campo: mensagem") vão para os campos
        const unmatched: string[] = [];
        const serverFieldErrors: Partial<RegisterErrors> = {};
        for (const item of isApiError(err) ? err.erros : []) {
          const parsed = parseFieldError(item);
          if (parsed && isFieldName(parsed.field)) serverFieldErrors[parsed.field] = parsed.message;
          else unmatched.push(item);
        }
        setErrors((prev) => ({ ...prev, ...serverFieldErrors }));
        const hasFieldErrors = Object.keys(serverFieldErrors).length > 0;
        setServerError(
          unmatched.length > 0 ? unmatched.join(" ") : hasFieldErrors ? null : errorMessage(err),
        );
      }
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <AuthLayout>
      <div className="-mx-2 flex min-h-header items-center">
        <Link
          to="/entrar"
          aria-label={t("nav.backTo", { label: t("auth.register.backToLogin") })}
          className="inline-flex min-h-touch min-w-touch items-center gap-0.5 pr-2 text-body text-accent no-underline"
        >
          <ChevronLeft aria-hidden="true" className="size-6" strokeWidth={1.75} />
          <span aria-hidden="true">{t("auth.register.backToLogin")}</span>
        </Link>
      </div>

      <div className="mt-2 mb-1 flex items-center gap-3">
        <AppIcon size="sm" className="size-12" />
        <h1 className="m-0 font-display text-large-title">{t("auth.register.title")}</h1>
      </div>
      <p className="m-0 mb-5 text-subhead text-text-muted">{t("auth.register.subtitle")}</p>

      {emailTaken ? (
        <Banner tone="error" role="alert" title={t("auth.register.emailTakenTitle")} className="mb-4">
          {t("auth.register.emailTakenBody")}{" "}
          <Link to="/entrar" className="text-inherit underline">
            {t("auth.register.emailTakenLink")}
          </Link>
          .
        </Banner>
      ) : null}
      {serverError ? (
        <Banner tone="error" role="alert" title={t("auth.register.errorTitle")} className="mb-4">
          {serverError}
        </Banner>
      ) : null}

      <form noValidate onSubmit={(event) => void onSubmit(event)} className="flex flex-col gap-4">
        <div className="grid grid-cols-1 gap-4 min-[360px]:grid-cols-2 min-[360px]:gap-3">
          <TextField
            label={t("auth.register.firstName")}
            autoComplete="given-name"
            maxLength={MAX_NAME_LENGTH}
            value={fields.firstName}
            error={errors.firstName}
            disabled={submitting}
            onChange={(event) => update("firstName", event.target.value)}
          />
          <TextField
            label={t("auth.register.lastName")}
            autoComplete="family-name"
            maxLength={MAX_NAME_LENGTH}
            value={fields.lastName}
            error={errors.lastName}
            disabled={submitting}
            onChange={(event) => update("lastName", event.target.value)}
          />
        </div>
        <TextField
          label={t("auth.email")}
          type="email"
          autoComplete="email"
          inputMode="email"
          placeholder={t("auth.emailPlaceholder")}
          maxLength={MAX_EMAIL_LENGTH}
          value={fields.email}
          error={errors.email}
          disabled={submitting}
          onChange={(event) => update("email", event.target.value)}
        />
        <PasswordField
          label={t("auth.password")}
          autoComplete="new-password"
          hint={t("auth.register.passwordHint", { min: MIN_PASSWORD_LENGTH })}
          value={fields.password}
          error={errors.password}
          disabled={submitting}
          onChange={(event) => update("password", event.target.value)}
        />
        <Button
          type="submit"
          block
          className="mt-2"
          loading={submitting}
          loadingLabel={t("auth.register.submitting")}
        >
          {t("auth.register.submit")}
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
    </AuthLayout>
  );
};

export default RegisterPage;
