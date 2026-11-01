import { useEffect, useId, useRef, useState } from "react";
import type { FormEvent, RefObject } from "react";
import {
  Check,
  ExternalLink,
  Eye,
  LoaderCircle,
  ShieldCheck,
  TriangleAlert,
  WifiOff,
} from "lucide-react";
import { Navigate, useLocation, useSearchParams } from "react-router-dom";
import { Trans, useTranslation } from "react-i18next";
import { Logo } from "../components/brand/Logo";
import { AuthLayout } from "../components/layout/AuthLayout";
import type { NavState } from "../components/layout/navigation";
import { PageLoading } from "../components/layout/PageLoading";
import { Avatar } from "../components/ui/Avatar";
import { Banner } from "../components/ui/Banner";
import { Button } from "../components/ui/Button";
import { RetryBanner } from "../components/ui/RetryBanner";
import { Skeleton } from "../components/ui/Skeleton";
import { useAuth } from "../hooks/useAuth";
import { useOAuthRequest } from "../hooks/useOAuthRequest";
import { ApiError, GENERIC_ERROR_MESSAGE, isApiError } from "../types/api";
import { AuthStatus } from "../types/auth";
import { READ_ONLY_SCOPES, READ_WRITE_SCOPES, hasWriteScope } from "../types/oauthRequest";
import type { OAuthRequestInfo } from "../types/oauthRequest";
import { cn } from "../utils/cn";
import { redirectTo } from "../utils/redirect";

/** Parâmetro da query com a chave do pedido (`/autorizar?pedido=…`) */
const REQUEST_PARAM = "pedido";

const HTTP_NOT_FOUND = 404;
const HTTP_GONE = 410;

/** Etapa do envio da resposta */
enum Phase {
  Idle = "idle",
  Approving = "approving",
  Denying = "denying",
  /** Resposta aceita pela API; indo para o `redirectUrl` */
  Returning = "returning",
}

/** Escolha do grupo de rádio */
enum ScopeChoice {
  Read = "read",
  ReadWrite = "readWrite",
}

enum SubmitAction {
  Approve = "approve",
  Deny = "deny",
}

const toApiError = (err: unknown): ApiError =>
  isApiError(err) ? err : new ApiError(500, GENERIC_ERROR_MESSAGE);

const isTerminalStatus = (status: number) => status === HTTP_NOT_FOUND || status === HTTP_GONE;

const sectionHeading =
  "m-0 block w-full px-4 py-[13px] text-footnote font-semibold tracking-[.06em] text-text-muted uppercase";

const BrandHeader = () => (
  <div className="mt-2 mb-7 flex justify-center">
    <Logo className="h-12" containerClassName="rounded-[12px]" />
  </div>
);

/** 404/410/sem `pedido`: alerta centralizado, sem botões de ação */
const TerminalState = ({ status }: { status: number }) => {
  const { t } = useTranslation();
  return (
    <div role="alert" className="mt-4 flex flex-col items-center text-center">
      <span
        aria-hidden="true"
        className="mb-4 grid size-[72px] place-items-center rounded-pill bg-warning-soft text-warning"
      >
        <TriangleAlert className="size-9" strokeWidth={1.75} />
      </span>
      <h1 className="m-0 mb-2 text-title-3 font-semibold">
        {status === HTTP_GONE ? t("oauth.expiredTitle") : t("oauth.notFoundTitle")}
      </h1>
      <p className="m-0 max-w-[34ch] text-subhead text-text-muted">{t("oauth.goBackToAssistant")}</p>
    </div>
  );
};

const LoadingState = () => {
  const { t } = useTranslation();
  return (
    <div aria-busy="true">
      <span className="sr-only">{t("app.loading")}</span>
      <Skeleton className="mb-2 h-7 w-[88%]" />
      <Skeleton className="mb-3 h-7 w-[52%]" />
      <Skeleton className="mb-5 h-4 w-1/2" />
      <Skeleton className="h-16 w-full rounded-lg" />
      <Skeleton className="mt-6 mb-3 h-4 w-1/3" />
      <Skeleton className="h-[150px] w-full rounded-lg" />
      <Skeleton className="mt-6 h-12 w-full rounded-md" />
      <Skeleton className="mt-2 h-12 w-full rounded-md" />
    </div>
  );
};

interface ConsentContentProps {
  requestKey: string | null;
  userName: string;
  onSwitchAccount: () => void;
}

/** Conteúdo da tela com sessão ativa (carrega o pedido e envia a resposta) */
const ConsentContent = ({ requestKey, userName, onSwitchAccount }: ConsentContentProps) => {
  const { t } = useTranslation();
  const titleId = useId();
  const scopeTitleId = useId();
  const { request, loading, error, reload, approve, deny } = useOAuthRequest(requestKey);

  const [choice, setChoice] = useState<ScopeChoice | null>(null);
  const [phase, setPhase] = useState<Phase>(Phase.Idle);
  const [submitError, setSubmitError] = useState<ApiError | null>(null);
  const [terminalStatus, setTerminalStatus] = useState<number | null>(null);
  const [redirectUrl, setRedirectUrl] = useState<string | null>(null);
  const authorizeRef = useRef<HTMLButtonElement>(null);
  const denyRef = useRef<HTMLButtonElement>(null);
  const lastAction = useRef<SubmitAction | null>(null);

  // `document.title`: "Autorizar {clientName} — Finami"; sem pedido (carregando, erro, 404/410),
  // "Autorizar assistente — Finami" (WCAG 2.4.2)
  const clientName = request?.clientName ?? null;
  useEffect(() => {
    const previous = document.title;
    document.title = clientName
      ? t("oauth.documentTitle", { client: clientName })
      : t("oauth.documentTitleGeneric");
    return () => {
      document.title = previous;
    };
  }, [clientName, t]);

  // O texto "Voltando para…" é exibido antes de sair da SPA
  useEffect(() => {
    if (redirectUrl) redirectTo(redirectUrl);
  }, [redirectUrl]);

  // Erro ao enviar: o foco fica no botão tocado (components.md §8)
  useEffect(() => {
    if (!submitError) return;
    const target = lastAction.current === SubmitAction.Deny ? denyRef.current : authorizeRef.current;
    target?.focus();
  }, [submitError]);

  if (requestKey === null) return <TerminalState status={HTTP_NOT_FOUND} />;
  if (terminalStatus !== null) return <TerminalState status={terminalStatus} />;
  // Em "Tentar de novo" o erro continua montado (o botão entra em loading no lugar)
  if (loading && !request && !error) return <LoadingState />;

  if (error || !request) {
    if (error && isTerminalStatus(error.status)) return <TerminalState status={error.status} />;
    const isNetwork = error?.isNetworkError ?? false;
    return (
      <div>
        <h1 className="sr-only">{t("oauth.pageTitle")}</h1>
        <RetryBanner
          icon={isNetwork ? WifiOff : undefined}
          title={t("oauth.loadErrorTitle")}
          retryLabel={t("oauth.retry")}
          retrying={loading}
          onRetry={() => void reload()}
        >
          {isNetwork ? t("oauth.loadErrorBody") : (error?.mensagem ?? GENERIC_ERROR_MESSAGE)}
        </RetryBanner>
      </div>
    );
  }

  return (
    <ConsentForm
      request={request}
      titleId={titleId}
      scopeTitleId={scopeTitleId}
      userName={userName}
      choice={choice}
      phase={phase}
      submitError={submitError}
      authorizeRef={authorizeRef}
      denyRef={denyRef}
      onChoice={setChoice}
      onSwitchAccount={onSwitchAccount}
      onSubmit={async (action, scopes) => {
        if (phase !== Phase.Idle) return;
        lastAction.current = action;
        setSubmitError(null);
        setPhase(action === SubmitAction.Approve ? Phase.Approving : Phase.Denying);
        try {
          const result = action === SubmitAction.Approve ? await approve(scopes) : await deny();
          setPhase(Phase.Returning);
          setRedirectUrl(result.redirectUrl);
        } catch (err) {
          const apiError = toApiError(err);
          setPhase(Phase.Idle);
          if (isTerminalStatus(apiError.status)) setTerminalStatus(apiError.status);
          else setSubmitError(apiError);
        }
      }}
    />
  );
};

interface ConsentFormProps {
  request: OAuthRequestInfo;
  titleId: string;
  scopeTitleId: string;
  userName: string;
  choice: ScopeChoice | null;
  phase: Phase;
  submitError: ApiError | null;
  authorizeRef: RefObject<HTMLButtonElement>;
  denyRef: RefObject<HTMLButtonElement>;
  onChoice: (choice: ScopeChoice) => void;
  onSwitchAccount: () => void;
  onSubmit: (action: SubmitAction, scopes: string[]) => Promise<void>;
}

/** Estado "pronto" — mockup docs/design/mockups/oauth-consent.html */
const ConsentForm = ({
  request,
  titleId,
  scopeTitleId,
  userName,
  choice,
  phase,
  submitError,
  authorizeRef,
  denyRef,
  onChoice,
  onSwitchAccount,
  onSubmit,
}: ConsentFormProps) => {
  const { t } = useTranslation();
  const canWrite = hasWriteScope(request.scopesRequested);
  // Padrão = o que foi pedido
  const selected = choice ?? (canWrite ? ScopeChoice.ReadWrite : ScopeChoice.Read);
  const scopes = canWrite && selected === ScopeChoice.ReadWrite ? READ_WRITE_SCOPES : READ_ONLY_SCOPES;
  const busy = phase !== Phase.Idle;
  const returning = phase === Phase.Returning;

  const liveText =
    phase === Phase.Approving
      ? t("oauth.connecting")
      : phase === Phase.Denying
        ? t("oauth.denying")
        : returning
          ? t("oauth.returning", { host: request.redirectHost })
          : "";

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    void onSubmit(SubmitAction.Approve, scopes);
  };

  const options = [
    { value: ScopeChoice.Read, title: t("oauth.scopeRead"), description: t("oauth.scopeReadDescription") },
    { value: ScopeChoice.ReadWrite, title: t("oauth.scopeWrite"), description: t("oauth.scopeWriteDescription") },
  ];

  return (
    <form noValidate aria-labelledby={titleId} onSubmit={handleSubmit}>
      <h1
        id={titleId}
        className="m-0 mb-1.5 font-display text-[28px] leading-[34px] font-normal [overflow-wrap:anywhere]"
      >
        <b className="font-bold">{request.clientName}</b>
        {t("oauth.titleSuffix")}
      </h1>
      <p className="m-0 mb-5 flex items-start gap-1.5 text-subhead text-text-muted">
        <ExternalLink aria-hidden="true" className="mt-0.5 size-4 shrink-0" strokeWidth={1.75} />
        <span>
          {t("oauth.returnTo")}
          <b className="font-semibold text-text [overflow-wrap:anywhere]">{request.redirectHost}</b>
        </span>
      </p>

      <div className="flex min-h-16 flex-wrap items-center gap-x-3 rounded-lg bg-surface py-2 pr-1 pl-4">
        <Avatar name={userName} colorIndex={0} size="md" />
        <p className="m-0 min-w-0 flex-[1_1_6.5rem]">
          <span className="block text-footnote whitespace-nowrap text-text-muted">{t("oauth.signedInAs")}</span>
          <span className="block truncate text-headline">{userName}</span>
        </p>
        <Button variant="ghost" size="sm" className="ml-auto px-3" disabled={busy} onClick={onSwitchAccount}>
          {t("oauth.switchAccount")}
        </Button>
      </div>

      {canWrite ? (
        <fieldset disabled={busy} className="m-0 mt-6 min-w-0 border-0 p-0">
          <legend className={sectionHeading}>{t("oauth.scopeLegend")}</legend>
          <div className="overflow-hidden rounded-lg bg-surface">
            {options.map((option) => {
              const checked = selected === option.value;
              return (
                <label
                  key={option.value}
                  className={cn(
                    "list-row flex min-h-[60px] items-start gap-3 px-4 py-3.5 motion-safe:transition-colors",
                    "has-[input:focus-visible]:rounded-[12px] has-[input:focus-visible]:outline-2",
                    "has-[input:focus-visible]:outline-offset-[-2px] has-[input:focus-visible]:outline-focus",
                    // Desabilitado durante o envio: sem hover (mockup `.opt:has(input:disabled)`)
                    busy ? "cursor-not-allowed" : "cursor-pointer hover:bg-surface-3",
                  )}
                >
                  <input
                    type="radio"
                    name="scope"
                    value={option.value}
                    checked={checked}
                    onChange={() => onChoice(option.value)}
                    className="sr-only"
                  />
                  <span
                    aria-hidden="true"
                    className={cn(
                      "mt-px grid size-[22px] shrink-0 place-items-center rounded-pill",
                      checked ? "border border-accent bg-accent text-on-accent" : "border-2 border-border",
                      busy && "opacity-50",
                    )}
                  >
                    {checked ? <Check className="size-3.5" strokeWidth={3} /> : null}
                  </span>
                  {/* Desabilitado: título e descrição em `text-disabled` (3,91:1 sobre `surface`, isento) */}
                  <span className="min-w-0 flex-1">
                    <span className={cn("block text-headline", busy && "text-text-disabled")}>{option.title}</span>{" "}
                    <span
                      className={cn("mt-0.5 block text-footnote", busy ? "text-text-disabled" : "text-text-muted")}
                    >
                      {option.description}
                    </span>
                  </span>
                </label>
              );
            })}
          </div>
        </fieldset>
      ) : (
        <section aria-labelledby={scopeTitleId} className="mt-6">
          <h2 id={scopeTitleId} className={sectionHeading}>
            {t("oauth.scopeStaticTitle")}
          </h2>
          <ul className="m-0 list-none overflow-hidden rounded-lg bg-surface p-0">
            <li className="flex min-h-[60px] items-start gap-3 px-4 py-3.5">
              <span
                aria-hidden="true"
                className="grid size-8 shrink-0 place-items-center rounded-sm bg-info-soft text-info"
              >
                <Eye className="size-[18px]" strokeWidth={1.75} />
              </span>
              <span className="min-w-0 flex-1">
                <span className="block text-headline">{t("oauth.scopeRead")}</span>{" "}
                <span className="mt-0.5 block text-footnote text-text-muted">{t("oauth.scopeReadDescription")}</span>
              </span>
            </li>
          </ul>
          <p className="m-0 px-4 pt-2 text-footnote text-text-muted">{t("oauth.readOnlyFooter")}</p>
        </section>
      )}

      <Banner tone="info" icon={ShieldCheck} className="mt-4">
        <Trans i18nKey="oauth.disconnectNotice" components={{ b: <b className="inline font-semibold text-text" /> }} />
      </Banner>

      {submitError ? (
        <Banner
          tone="error"
          role="alert"
          icon={submitError.isNetworkError ? WifiOff : undefined}
          title={t("oauth.sendErrorTitle")}
          className="mt-4"
        >
          {submitError.isNetworkError ? t("oauth.sendErrorBody") : submitError.mensagem}
        </Banner>
      ) : null}

      <div className="mt-6 flex flex-col gap-2">
        <Button
          ref={authorizeRef}
          type="submit"
          block
          loading={phase === Phase.Approving}
          loadingLabel={t("oauth.connecting")}
          disabled={busy}
        >
          {t("oauth.authorize")}
        </Button>
        <Button
          ref={denyRef}
          variant="secondary"
          block
          loading={phase === Phase.Denying}
          loadingLabel={t("oauth.denying")}
          disabled={busy}
          onClick={() => void onSubmit(SubmitAction.Deny, scopes)}
        >
          {t("oauth.deny")}
        </Button>
      </div>

      {/* Região viva sempre montada; ao voltar, vira a linha visível "Voltando para…" */}
      <p
        role="status"
        aria-live="polite"
        className={
          returning
            ? "m-0 mt-2 flex min-h-11 items-center justify-center gap-2 text-subhead text-text-muted"
            : "sr-only"
        }
      >
        {returning ? <LoaderCircle aria-hidden="true" className="size-[18px] motion-safe:animate-spin" /> : null}
        {liveText}
      </p>
    </form>
  );
};

/**
 * Tela de consentimento OAuth (rota `/autorizar?pedido={requestKey}`), fora das abas —
 * specs/004 contracts/ui.md e components.md §8. Sem sessão vai ao login guardando a rota
 * com a query; "Trocar de conta" encerra a sessão e cai no mesmo caminho.
 */
const AuthorizePage = () => {
  const location = useLocation();
  const [params] = useSearchParams();
  const { status, session, logout, logoutReason } = useAuth();
  const requestKey = params.get(REQUEST_PARAM)?.trim() || null;

  if (status === AuthStatus.Checking) return <PageLoading fullScreen />;

  if (status === AuthStatus.Anonymous || !session) {
    const state: NavState = {
      from: { pathname: location.pathname, search: location.search, hash: location.hash },
      reason: logoutReason,
    };
    return <Navigate to="/entrar" replace state={state} />;
  }

  const userName = `${session.user.firstName} ${session.user.lastName}`.trim();

  return (
    <AuthLayout>
      <BrandHeader />
      <ConsentContent key={requestKey ?? ""} requestKey={requestKey} userName={userName} onSwitchAccount={logout} />
    </AuthLayout>
  );
};

export default AuthorizePage;
