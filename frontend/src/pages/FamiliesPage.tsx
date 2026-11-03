import { useCallback, useEffect, useId, useMemo, useState } from "react";
import { ChevronRight, Plus, Users } from "lucide-react";
import { Link } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { GroupForm } from "../components/group/GroupForm";
import { LargeTitleHeader } from "../components/layout/LargeTitleHeader";
import { AppTab, FAMILIES_PATH } from "../components/layout/navigation";
import type { NavState } from "../components/layout/navigation";
import { NotificationBell } from "../components/notification/NotificationBell";
import { OfflineContent } from "../components/pwa/OfflineContent";
import { Badge } from "../components/ui/Badge";
import { Button } from "../components/ui/Button";
import { EmptyState } from "../components/ui/EmptyState";
import { ErrorState } from "../components/ui/ErrorState";
import { Sheet } from "../components/ui/Sheet";
import { Skeleton } from "../components/ui/Skeleton";
import { listRowClasses } from "../components/ui/listRow";
import { NotificationBellVariant } from "../components/ui/variants";
import { useBalance } from "../hooks/useBalance";
import { useGroup } from "../hooks/useGroup";
import { useOnReconnected } from "../hooks/useOnReconnected";
import { useOnlineAction } from "../hooks/useOnlineAction";
import { useTransaction } from "../hooks/useTransaction";
import { isOfflineError } from "../types/api";
import type { GroupBalancesResult } from "../types/balance";
import type { GroupInfo } from "../types/group";
import { cn } from "../utils/cn";
import { familyColorClass } from "../utils/familyColors";
import { EMPTY_VALUE, formatBrl } from "../utils/money";
import { errorMessage, notifySuccess } from "../utils/notify";
import GroupPage from "./GroupPage";

enum LoadPhase {
  Loading = "loading",
  Ready = "ready",
  Error = "error",
}

/** Saldo de cada família da lista: carregando, carregado ou indisponível (falha ou sem permissão) */
type FamilyTotal = GroupBalancesResult | "loading" | "unavailable";

const collator = new Intl.Collator("pt-BR");

const responsibleName = (group: GroupInfo) => {
  const responsible = group.members.find((m) => m.userId === group.responsibleUserId);
  return responsible ? `${responsible.firstName} ${responsible.lastName}` : "";
};

interface FamilyRowProps {
  group: GroupInfo;
  colorIndex: number;
  total: FamilyTotal;
  linkState: NavState;
}

/** Linha da lista: família (cor, nome, membros, responsável) e o total em reais */
const FamilyRow = ({ group, colorIndex, total, linkState }: FamilyRowProps) => {
  const { t } = useTranslation();
  const totalBrl = typeof total === "object" ? total.totalBrl : null;
  return (
    <Link
      to={`${FAMILIES_PATH}/${group.groupId}`}
      state={linkState}
      className={listRowClasses({ twoLines: true, withIcon: true, interactive: true })}
    >
      <span
        aria-hidden="true"
        className={cn("grid size-9 shrink-0 place-items-center rounded-md text-on-family", familyColorClass(colorIndex))}
      >
        <Users className="size-5" strokeWidth={1.75} />
      </span>
      <span className="min-w-0 flex-1">
        <h2 className="m-0 line-clamp-2 text-headline break-words hyphens-auto">{group.name}</h2>
        <span className="mt-0.5 block truncate text-footnote text-text-muted">
          {t("groups.memberCount", { count: group.members.length })}
          {" · "}
          {group.isResponsible ? (
            <Badge variant="responsible">{t("badges.responsible")}</Badge>
          ) : (
            t("groups.responsibleIs", { name: responsibleName(group) })
          )}
        </span>
      </span>
      {total === "loading" ? (
        <Skeleton className="h-4 w-20 shrink-0" />
      ) : totalBrl === null ? (
        <span className="shrink-0 text-text-subtle">
          <span aria-hidden="true">{EMPTY_VALUE}</span>
          <span className="sr-only">{t("balances.hiddenValue")}</span>
        </span>
      ) : (
        <span className={cn("shrink-0 text-headline whitespace-nowrap tabular-nums", totalBrl < 0 && "text-negative")}>
          {formatBrl(totalBrl)}
        </span>
      )}
      <ChevronRight aria-hidden="true" className="size-[18px] shrink-0 text-text-subtle" />
    </Link>
  );
};

/**
 * Aba Família (rota `/familias`): com mais de uma família, a lista com o saldo de cada uma;
 * com uma só, a própria tela da família; sem nenhuma, o convite para criar.
 */
const FamiliesPage = () => {
  const { t } = useTranslation();
  const { groups, loadGroups, createGroup } = useGroup();
  const { getGroupBalances } = useBalance();
  const { ledgerVersion } = useTransaction();
  const onlineAction = useOnlineAction();
  const groupFormId = useId();

  const [phase, setPhase] = useState<LoadPhase>(LoadPhase.Loading);
  const [loadError, setLoadError] = useState<unknown>(null);
  const [totals, setTotals] = useState<Record<number, FamilyTotal>>({});
  const [sheetOpen, setSheetOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setPhase((current) => (current === LoadPhase.Ready ? current : LoadPhase.Loading));
    try {
      await loadGroups();
      setLoadError(null);
      setPhase(LoadPhase.Ready);
    } catch (err) {
      setLoadError(err);
      setPhase(LoadPhase.Error);
    }
  }, [loadGroups]);

  useEffect(() => {
    void load();
  }, [load]);

  // Conexão voltou: recarrega a lista (FR-012)
  useOnReconnected(() => {
    void load();
  });

  const sortedGroups = useMemo(() => [...groups].sort((a, b) => collator.compare(a.name, b.name)), [groups]);
  const groupIdsKey = sortedGroups.map((g) => g.groupId).join(",");

  // Saldo de cada família, só quando há mais de uma (com uma, a tela da família carrega o dela).
  // Recarrega quando há lançamentos novos (ledgerVersion).
  useEffect(() => {
    if (phase !== LoadPhase.Ready || sortedGroups.length < 2) return;
    let cancelled = false;
    setTotals((prev) =>
      Object.fromEntries(sortedGroups.map((g) => [g.groupId, prev[g.groupId] ?? "loading"])) as Record<
        number,
        FamilyTotal
      >,
    );
    const ids = sortedGroups.map((g) => g.groupId);
    void Promise.allSettled(ids.map((id) => getGroupBalances(id))).then((results) => {
      if (cancelled) return;
      setTotals(
        Object.fromEntries(
          ids.map((id, index) => {
            const result = results[index];
            return [id, result?.status === "fulfilled" ? result.value : "unavailable"];
          }),
        ) as Record<number, FamilyTotal>,
      );
    });
    return () => {
      cancelled = true;
    };
    // groupIdsKey resume a lista; sortedGroups muda de identidade a cada render do contexto
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase, groupIdsKey, getGroupBalances, ledgerVersion]);

  // Criar família exige internet (feature 005): aria-disabled + aviso
  const openSheet = onlineAction.guard(() => {
    setFormError(null);
    setSheetOpen(true);
  });

  const submitGroup = async (name: string) => {
    setSaving(true);
    setFormError(null);
    try {
      const created = await createGroup({ name });
      setSheetOpen(false);
      notifySuccess(t("groups.created", { name: created.name }));
    } catch (err) {
      setFormError(errorMessage(err));
    } finally {
      setSaving(false);
    }
  };

  const createSheet = (
    <Sheet
      open={sheetOpen}
      onOpenChange={(open) => !saving && setSheetOpen(open)}
      title={t("groups.new")}
      dismissible={!saving}
      footer={
        <Button type="submit" form={groupFormId} block loading={saving} loadingLabel={t("actions.saving")}>
          {t("groups.create")}
        </Button>
      }
    >
      <GroupForm
        formId={groupFormId}
        showResponsibleHint
        onSubmit={(name) => void submitGroup(name)}
        disabled={saving}
        serverError={formError}
      />
    </Sheet>
  );

  // Uma família só: a própria tela dela, na raiz da aba (sem voltar)
  const only = sortedGroups.length === 1 ? sortedGroups[0] : undefined;
  if (phase === LoadPhase.Ready && only) {
    return <GroupPage key={only.groupId} groupId={only.groupId} />;
  }

  // "Sem internet" fica na tela durante a nova tentativa (REVIEW-005 M-5)
  const offlineRetry = phase === LoadPhase.Loading && isOfflineError(loadError);
  const showOffline = (phase === LoadPhase.Error || offlineRetry) && isOfflineError(loadError);
  const many = phase === LoadPhase.Ready && sortedGroups.length > 1;
  const linkState: NavState = { tab: AppTab.Family, backTo: FAMILIES_PATH, backLabel: t("groups.families") };

  return (
    <>
      <LargeTitleHeader
        title={many ? t("groups.families") : t("nav.family")}
        titleAccessory={<NotificationBell variant={NotificationBellVariant.Header} className="md:hidden" />}
      />

      {showOffline ? (
        <OfflineContent className="pt-16" retrying={offlineRetry} onRetry={() => void load()} />
      ) : phase === LoadPhase.Error ? (
        <ErrorState className="pt-16" error={loadError} onRetry={() => void load()} />
      ) : phase === LoadPhase.Loading ? (
        <div aria-busy="true" className="mt-4">
          <span className="sr-only" role="status">
            {t("app.loading")}
          </span>
          <div aria-hidden="true" className="overflow-hidden rounded-lg bg-surface">
            <Skeleton className="m-4 h-9 w-2/3" />
            <Skeleton className="m-4 h-9 w-1/2" />
          </div>
        </div>
      ) : many ? (
        <>
          <div className="mt-3 mb-1 flex flex-wrap gap-3">
            <Button
              variant="secondary"
              size="sm"
              icon={<Plus className="size-5" strokeWidth={1.75} />}
              {...onlineAction.offlineProps}
              onClick={openSheet}
            >
              {t("groups.new")}
            </Button>
          </div>
          <div className="mt-4 overflow-hidden rounded-lg bg-surface">
            {sortedGroups.map((group, index) => (
              <FamilyRow
                key={group.groupId}
                group={group}
                colorIndex={index}
                total={totals[group.groupId] ?? "loading"}
                linkState={linkState}
              />
            ))}
          </div>
        </>
      ) : (
        <EmptyState
          icon={Users}
          className="pt-16"
          title={t("groups.emptyTitle")}
          description={t("groups.emptyBody")}
          action={
            <Button
              size="sm"
              icon={<Plus className="size-5" strokeWidth={1.75} />}
              {...onlineAction.offlineProps}
              onClick={openSheet}
            >
              {t("groups.create")}
            </Button>
          }
        />
      )}

      {createSheet}
    </>
  );
};

export default FamiliesPage;
