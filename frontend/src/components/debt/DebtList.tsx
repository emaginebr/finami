import { useEffect, useId, useRef } from "react";
import type { ReactNode } from "react";
import { ChevronRight, WifiOff } from "lucide-react";
import { Link } from "react-router-dom";
import { Trans, useTranslation } from "react-i18next";
import { Currency, isOfflineError } from "../../types/api";
import { DebtDirection } from "../../types/debt";
import type { PersonDebt } from "../../types/debt";
import { cn } from "../../utils/cn";
import { formatSigned, hidesInDisplay } from "../../utils/money";
import { errorMessage } from "../../utils/notify";
import { AppTab } from "../layout/navigation";
import type { NavState } from "../layout/navigation";
import { Avatar } from "../ui/Avatar";
import { RetryBanner } from "../ui/RetryBanner";
import { Skeleton } from "../ui/Skeleton";
import { listRowClasses } from "../ui/listRow";

/** Pessoa dona da página (`/pessoas/:userId`): o ponto de vista do sinal e das frases */
export interface DebtPerson {
  userId: number;
  firstName: string;
  /** A pessoa da página é a pessoa logada ("deve a você" / "Você deve a") */
  isSelf: boolean;
}

export interface DebtListProps {
  person: DebtPerson;
  /** `null` enquanto carrega (ou sem dado, com erro) */
  debts: PersonDebt[] | null;
  /** Erro da última carga; o resto da página continua de pé */
  error: unknown;
  /** Nova tentativa em andamento (a faixa de erro continua montada) */
  retrying: boolean;
  onRetry: () => void;
  /** Aba de origem, repassada para a página da contraparte */
  tab?: AppTab;
}

/**
 * Valor do ponto de vista da pessoa da página: "+R$ 70,00" a receber, "−R$ 30,00" a pagar.
 * Bitcoin com 5 casas, como no app; se isso zerasse o valor, mostra as 8 casas (components.md §10).
 */
const formatDebtAmount = (debt: PersonDebt): string => {
  const signed = debt.direction === DebtDirection.Owed ? Math.abs(debt.amount) : -Math.abs(debt.amount);
  const full = debt.currency === Currency.BTC && hidesInDisplay(debt.amount, Currency.BTC);
  return formatSigned(signed, debt.currency, full);
};

const NAME_CLASS = "font-semibold";

/** Frase da linha: nome da contraparte em destaque; "você" só na página da pessoa logada */
const DebtPhrase = ({ debt, person }: { debt: PersonDebt; person: DebtPerson }) => {
  const owed = debt.direction === DebtDirection.Owed;
  const counterpart = debt.counterpartFirstName;

  if (person.isSelf) {
    return (
      <Trans
        i18nKey={owed ? "debts.owedToYou" : "debts.youOwe"}
        values={{ name: counterpart }}
        components={{ b: <b className={NAME_CLASS} /> }}
      />
    );
  }

  return (
    <Trans
      i18nKey="debts.owesTo"
      values={{
        debtor: owed ? counterpart : person.firstName,
        creditor: owed ? person.firstName : counterpart,
      }}
      components={{
        debtor: owed ? <b className={NAME_CLASS} /> : <span />,
        creditor: owed ? <span /> : <b className={NAME_CLASS} />,
      }}
    />
  );
};

const DebtRow = ({ debt, person, tab }: { debt: PersonDebt; person: DebtPerson; tab?: AppTab }) => {
  const owed = debt.direction === DebtDirection.Owed;
  const linkState: NavState = {
    tab: tab ?? AppTab.Wallets,
    backTo: `/pessoas/${person.userId}`,
    backLabel: person.firstName,
    colorIndex: debt.counterpartUserId,
  };

  // Sem aria-label: o nome acessível é o texto visível ("Bruno deve a você, +R$ 70,00" — WCAG 2.5.3)
  return (
    <Link
      to={`/pessoas/${debt.counterpartUserId}`}
      state={linkState}
      className={listRowClasses({ twoLines: true, withIcon: true, interactive: true })}
    >
      <Avatar name={debt.counterpartName} colorIndex={debt.counterpartUserId} size="md" />
      {/*
        Frase + valor quebram como bloco (REVIEW-006 B-2): a frase nunca é cortada; em 320 px / zoom 200 %
        o valor desce para baixo dela, alinhado à direita, e a linha cresce (min-h-row-2).
      */}
      <span className="flex min-w-0 flex-1 flex-wrap items-baseline justify-between gap-x-3 gap-y-0.5">
        <span className="min-w-[9rem] flex-1 text-body break-words text-text">
          <DebtPhrase debt={debt} person={person} />
          {/* Pausa para leitores de tela colada à frase: sem espaço antes da vírgula no nome (M-4) */}
          <span className="sr-only">,</span>
        </span>{" "}
        <span
          className={cn(
            "ml-auto shrink-0 text-headline font-semibold whitespace-nowrap tabular-nums",
            owed ? "text-positive" : "text-negative",
          )}
        >
          {formatDebtAmount(debt)}
        </span>
      </span>
      <ChevronRight aria-hidden="true" className="size-[18px] shrink-0 text-text-subtle" />
    </Link>
  );
};

const DebtSkeleton = () => (
  <div className="overflow-hidden rounded-lg bg-surface">
    {[0, 1].map((index) => (
      <div key={index} aria-hidden="true" className={listRowClasses({ twoLines: true, withIcon: true })}>
        <Skeleton className="size-10 shrink-0" rounded="rounded-pill" />
        <Skeleton className="h-3.5 w-40" />
        <Skeleton className="ml-auto h-4 w-[4.5rem]" />
      </div>
    ))}
  </div>
);

/**
 * Seção "Dívidas" da página da pessoa (feature 006, contracts/ui.md e components.md §10):
 * uma linha por contraparte e moeda, com frase + valor com sinal (não depende só da cor).
 * Carregando: 2 linhas-esqueleto; vazio: texto discreto; erro: `RetryBanner` sem derrubar a página.
 */
export const DebtList = ({ person, debts, error, retrying, onRetry, tab }: DebtListProps) => {
  const { t } = useTranslation();
  const titleId = useId();
  const titleRef = useRef<HTMLHeadingElement>(null);
  const loading = debts === null && !error;

  // "Tentar de novo" deu certo: a faixa (com o foco dentro) some; o foco vai para o título da seção (M-2).
  // Se falhar, o próprio RetryBanner devolve o foco ao botão.
  const retryRequested = useRef(false);
  useEffect(() => {
    if (!retryRequested.current || retrying) return;
    retryRequested.current = false;
    if (!error) titleRef.current?.focus();
  }, [error, retrying]);

  let content: ReactNode;
  if (error) {
    const offline = isOfflineError(error);
    content = (
      <RetryBanner
        icon={offline ? WifiOff : undefined}
        retryLabel={t("pwa.offline.retry")}
        retrying={retrying}
        onRetry={() => {
          retryRequested.current = true;
          onRetry();
        }}
      >
        {offline ? t("pwa.offline.contentUnavailable") : errorMessage(error)}
      </RetryBanner>
    );
  } else if (debts === null) {
    content = (
      <>
        <span className="sr-only" role="status">
          {t("app.loading")}
        </span>
        <DebtSkeleton />
      </>
    );
  } else if (debts.length === 0) {
    content = <p className="m-0 rounded-lg bg-surface px-4 py-3 text-subhead text-text-muted">{t("debts.empty")}</p>;
  } else {
    content = (
      <div className="overflow-hidden rounded-lg bg-surface">
        {debts.map((debt) => (
          <DebtRow key={`${debt.counterpartUserId}-${debt.currency}`} debt={debt} person={person} tab={tab} />
        ))}
      </div>
    );
  }

  return (
    <section aria-labelledby={titleId} aria-busy={loading || undefined} className="mt-7">
      <h2
        id={titleId}
        ref={titleRef}
        tabIndex={-1}
        className="m-0 flex outline-none min-h-touch items-center px-4 py-[13px] text-footnote font-semibold tracking-wider text-text-muted uppercase"
      >
        {t("debts.title")}
      </h2>
      {content}
    </section>
  );
};

export default DebtList;
