import { useCallback, useEffect, useId, useRef, useState } from "react";
import { Bot, Copy, Unplug, WifiOff } from "lucide-react";
import { useTranslation } from "react-i18next";
import { Badge } from "../ui/Badge";
import { Button } from "../ui/Button";
import { ConfirmModal } from "../ui/ConfirmModal";
import { RetryBanner } from "../ui/RetryBanner";
import { Skeleton } from "../ui/Skeleton";
import { TextField } from "../ui/TextField";
import { listRowClasses } from "../ui/listRow";
import { BadgeVariant, ButtonVariant, ConfirmTone } from "../ui/variants";
import { useOAuthConnection } from "../../hooks/useOAuthConnection";
import { isApiError } from "../../types/api";
import type { OAuthConnectionInfo } from "../../types/oauthConnection";
import { hasWriteScope } from "../../types/oauthRequest";
import { cn } from "../../utils/cn";
import { formatDate, formatRelativeOrDate, toIsoInstant } from "../../utils/dates";
import { errorMessage, notifyError, notifyErrorMessage, notifySuccess } from "../../utils/notify";

const sectionTitle =
  "m-0 flex min-h-touch items-center px-4 text-footnote font-semibold tracking-wider text-text-muted uppercase";

/** Foco pendente depois de desconectar: posição do item removido */
type PendingFocus = number | null;

/**
 * Conta → "Assistentes conectados" (US4) — mockup docs/design/mockups/account-connections.html,
 * components.md §8. Carrega sozinha; o resto da Conta não espera.
 */
export const ConnectedAssistants = () => {
  const { t } = useTranslation();
  const titleId = useId();
  const descriptionId = useId();
  const { connections, loaded, mcpUrl, loadConnections, disconnect, disconnectAll, loadMcpInfo } =
    useOAuthConnection();

  const [loadError, setLoadError] = useState<string | null>(null);
  const [loadErrorIsNetwork, setLoadErrorIsNetwork] = useState(false);
  const [target, setTarget] = useState<OAuthConnectionInfo | null>(null);
  const [itemOpen, setItemOpen] = useState(false);
  const [allOpen, setAllOpen] = useState(false);
  const [allCount, setAllCount] = useState(0);
  const [busy, setBusy] = useState(false);
  const [retrying, setRetrying] = useState(false);
  const [mcpLoading, setMcpLoading] = useState(false);
  const [mcpError, setMcpError] = useState(false);

  const buttonRefs = useRef(new Map<number, HTMLButtonElement>());
  const emptyHeadingRef = useRef<HTMLHeadingElement>(null);
  const addressRef = useRef<HTMLInputElement>(null);
  const pendingFocus = useRef<PendingFocus>(null);

  // O erro só sai no sucesso: em "Tentar de novo" a faixa (e o botão focado) continua montada
  const load = useCallback(async () => {
    try {
      await loadConnections();
      setLoadError(null);
    } catch (err) {
      setLoadErrorIsNetwork(isApiError(err) && err.isNetworkError);
      setLoadError(errorMessage(err));
    }
  }, [loadConnections]);

  useEffect(() => {
    void load();
  }, [load]);

  const retryLoad = () => {
    setRetrying(true);
    void load().finally(() => setRetrying(false));
  };

  const isEmpty = loaded && connections.length === 0;

  const fetchMcpInfo = useCallback(async () => {
    setMcpLoading(true);
    try {
      await loadMcpInfo();
      setMcpError(false);
    } catch {
      setMcpError(true);
    } finally {
      setMcpLoading(false);
    }
  }, [loadMcpInfo]);

  // Endereço do MCP só é necessário no estado vazio
  useEffect(() => {
    if (isEmpty) void fetchMcpInfo();
  }, [isEmpty, fetchMcpInfo]);

  // Foco depois de desconectar (após o modal fechar e devolver o foco)
  useEffect(() => {
    if (itemOpen || allOpen || pendingFocus.current === null) return undefined;
    const timer = window.setTimeout(() => {
      const index = pendingFocus.current;
      pendingFocus.current = null;
      if (index === null) return;
      if (connections.length === 0) {
        emptyHeadingRef.current?.focus();
        return;
      }
      const next = connections[Math.min(index, connections.length - 1)];
      if (next) buttonRefs.current.get(next.connectionId)?.focus();
    }, 0);
    return () => window.clearTimeout(timer);
  }, [itemOpen, allOpen, connections]);

  const askDisconnect = (connection: OAuthConnectionInfo) => {
    setTarget(connection);
    setItemOpen(true);
  };

  const askDisconnectAll = () => {
    setAllCount(connections.length);
    setAllOpen(true);
  };

  const confirmDisconnect = async () => {
    if (!target) return;
    const index = connections.findIndex((item) => item.connectionId === target.connectionId);
    setBusy(true);
    try {
      await disconnect(target.connectionId);
      pendingFocus.current = Math.max(0, index);
      notifySuccess(t("oauth.connections.disconnected", { name: target.clientName }));
    } catch (err) {
      notifyError(err);
      throw err;
    } finally {
      setBusy(false);
    }
  };

  const confirmDisconnectAll = async () => {
    setBusy(true);
    try {
      await disconnectAll();
      pendingFocus.current = 0;
      notifySuccess(t("oauth.connections.disconnectedAll"));
    } catch (err) {
      notifyError(err);
      throw err;
    } finally {
      setBusy(false);
    }
  };

  const copyAddress = async () => {
    if (!mcpUrl) return;
    try {
      const clipboard = typeof navigator !== "undefined" ? navigator.clipboard : undefined;
      if (!clipboard) throw new Error("clipboard indisponível");
      await clipboard.writeText(mcpUrl);
      notifySuccess(t("oauth.connections.copied"));
    } catch {
      addressRef.current?.focus();
      addressRef.current?.select();
      notifyErrorMessage(t("oauth.connections.copyFailed"));
    }
  };

  const now = new Date();

  const renderBody = () => {
    if (!loaded && loadError) {
      return (
        <RetryBanner
          icon={loadErrorIsNetwork ? WifiOff : undefined}
          title={t("oauth.connections.loadErrorTitle")}
          retryLabel={t("oauth.connections.retry")}
          retrying={retrying}
          onRetry={retryLoad}
        >
          {loadErrorIsNetwork ? t("oauth.connections.loadErrorBody") : loadError}
        </RetryBanner>
      );
    }

    if (!loaded) {
      return (
        <div aria-busy="true" className="overflow-hidden rounded-lg bg-surface">
          <span className="sr-only">{t("app.loading")}</span>
          {[0, 1].map((key) => (
            <div key={key} className="flex items-center gap-3 px-4 py-3.5">
              <Skeleton className="size-9 shrink-0 rounded-[10px]" />
              <div className="flex-1">
                <Skeleton className="mb-2 h-4 w-1/2" />
                <Skeleton className="h-3 w-3/4" />
              </div>
            </div>
          ))}
        </div>
      );
    }

    if (connections.length === 0) {
      return (
        <div className="rounded-lg bg-surface p-4">
          <h3 ref={emptyHeadingRef} tabIndex={-1} className="m-0 mb-1 text-headline font-semibold">
            {t("oauth.connections.emptyTitle")}
          </h3>
          <p className="m-0 mb-4 text-subhead text-text-muted">{t("oauth.connections.emptyBody")}</p>
          {mcpUrl ? (
            <div className="flex flex-wrap items-end gap-2 md:flex-nowrap">
              <TextField
                ref={addressRef}
                label={t("oauth.connections.mcpAddress")}
                readOnly
                value={mcpUrl}
                spellCheck={false}
                onFocus={(event) => event.currentTarget.select()}
                containerClassName="basis-full md:basis-auto md:flex-1 min-w-0"
                className="font-mono read-only:border-border! read-only:bg-surface-2!"
              />
              <Button
                variant="secondary"
                size="sm"
                className="md:min-h-12"
                aria-label={t("oauth.connections.copyAria")}
                icon={<Copy className="size-[18px]" strokeWidth={1.75} />}
                onClick={() => void copyAddress()}
              >
                {t("oauth.connections.copy")}
              </Button>
            </div>
          ) : mcpError ? (
            <RetryBanner
              retryLabel={t("oauth.connections.retry")}
              retrying={mcpLoading}
              onRetry={() => void fetchMcpInfo()}
            >
              {t("oauth.connections.mcpLoadError")}
            </RetryBanner>
          ) : (
            <div aria-busy="true">
              <span className="sr-only">{t("app.loading")}</span>
              {/* Rótulo + campo (h-12) do "Endereço do MCP" */}
              <Skeleton className="mb-1.5 h-4 w-1/3" />
              <Skeleton className="h-12 w-full rounded-md" />
            </div>
          )}
        </div>
      );
    }

    return (
      <>
        <ul className="m-0 list-none overflow-hidden rounded-lg bg-surface p-0">
          {connections.map((connection) => {
            const canWrite = hasWriteScope(connection.scopes);
            return (
              <li
                key={connection.connectionId}
                className={cn(
                  "list-row has-icon flex flex-wrap items-start gap-x-3 px-4 pt-3.5 pb-1.5",
                  "md:flex-nowrap md:items-center md:py-3 md:pr-2",
                )}
              >
                <span
                  aria-hidden="true"
                  className="mt-0.5 grid size-9 shrink-0 place-items-center rounded-[10px] bg-surface-2 text-accent md:mt-0"
                >
                  <Bot className="size-5" strokeWidth={1.75} />
                </span>
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                    <h3 className="m-0 text-headline font-semibold [overflow-wrap:anywhere]">
                      {connection.clientName}
                    </h3>
                    <Badge variant={canWrite ? BadgeVariant.ScopeReadWrite : BadgeVariant.ScopeReadOnly}>
                      {canWrite ? t("oauth.connections.scopeReadWrite") : t("oauth.connections.scopeReadOnly")}
                    </Badge>
                  </div>
                  <p className="m-0 mt-1 flex flex-wrap gap-x-1.5 text-footnote text-text-muted">
                    <span>
                      {t("oauth.connections.connectedAt")}{" "}
                      <time dateTime={toIsoInstant(connection.createdAt)}>{formatDate(connection.createdAt)}</time>
                    </span>
                    <span aria-hidden="true">·</span>
                    {connection.lastUsedAt ? (
                      <span>
                        {t("oauth.connections.lastUsed")}{" "}
                        <time dateTime={toIsoInstant(connection.lastUsedAt)}>
                          {formatRelativeOrDate(
                            connection.lastUsedAt,
                            now,
                            t("oauth.connections.lastUsedJustNow"),
                          )}
                        </time>
                      </span>
                    ) : (
                      <span>{t("oauth.connections.neverUsed")}</span>
                    )}
                  </p>
                </div>
                <div className="basis-full pl-8 md:basis-auto md:pl-0">
                  <Button
                    ref={(node) => {
                      if (node) buttonRefs.current.set(connection.connectionId, node);
                      else buttonRefs.current.delete(connection.connectionId);
                    }}
                    variant={ButtonVariant.DestructiveGhost}
                    size="sm"
                    className="px-4"
                    aria-label={t("oauth.connections.disconnectAria", { name: connection.clientName })}
                    aria-haspopup="dialog"
                    onClick={() => askDisconnect(connection)}
                  >
                    {t("oauth.connections.disconnect")}
                  </Button>
                </div>
              </li>
            );
          })}
        </ul>

        {connections.length >= 2 ? (
          <div className="mt-4 overflow-hidden rounded-lg bg-surface">
            <button
              type="button"
              aria-haspopup="dialog"
              onClick={askDisconnectAll}
              className={cn(listRowClasses({ withIcon: true, interactive: true }), "font-semibold")}
            >
              <Unplug aria-hidden="true" className="size-5 shrink-0 text-negative" strokeWidth={1.75} />
              <span className="text-negative">{t("oauth.connections.disconnectAll")}</span>
            </button>
          </div>
        ) : null}
      </>
    );
  };

  return (
    <section aria-labelledby={titleId} aria-describedby={descriptionId} className="mt-7">
      <h2 id={titleId} className={sectionTitle}>
        {t("oauth.connections.title")}
      </h2>
      <p id={descriptionId} className="m-0 -mt-1 mb-2 px-4 text-footnote text-text-muted">
        {t("oauth.connections.description")}
      </p>

      {renderBody()}

      <ConfirmModal
        open={itemOpen}
        onOpenChange={setItemOpen}
        tone={ConfirmTone.Destructive}
        title={t("oauth.connections.disconnectTitle", { name: target?.clientName ?? "" })}
        description={t("oauth.connections.disconnectBody")}
        confirmLabel={t("oauth.connections.disconnect")}
        loading={busy}
        loadingLabel={t("oauth.connections.disconnecting")}
        onConfirm={confirmDisconnect}
      />
      <ConfirmModal
        open={allOpen}
        onOpenChange={setAllOpen}
        tone={ConfirmTone.Destructive}
        title={t("oauth.connections.disconnectAllTitle")}
        description={t("oauth.connections.disconnectAllBody", { count: allCount })}
        confirmLabel={t("oauth.connections.disconnectAll")}
        loading={busy}
        loadingLabel={t("oauth.connections.disconnecting")}
        onConfirm={confirmDisconnectAll}
      />
    </section>
  );
};

export default ConnectedAssistants;
