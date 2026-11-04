import { Trans, useTranslation } from "react-i18next";
import { TransactionType, TransferKind } from "../../types/transaction";
import type { TransactionInfo } from "../../types/transaction";
import { formatMoneyFull } from "../../utils/money";

export interface ReverseEffectProps {
  /** Lançamento a estornar */
  transaction: TransactionInfo;
}

interface EffectSentence {
  key: string;
  values: Record<string, string>;
}

/** Primeiro nome do titular; sem ele, o nome da carteira */
const firstNameOf = (ownerName: string | null, fallback: string): string =>
  ownerName?.trim().split(/\s+/)[0] || fallback;

/**
 * Frases do efeito do estorno, calculadas a partir do lançamento original (components.md §12):
 * o dinheiro volta (despesa), sai (receita) ou volta e sai (transferências e conversões); em
 * empréstimo e quitação, a dívida diminui ou aumenta. Bitcoin sempre com 8 casas.
 */
const effectSentences = (tx: TransactionInfo): EffectSentence[] => {
  const sourceAmount = formatMoneyFull(tx.sourceAmount, tx.source.currency);
  const destinationAmount = formatMoneyFull(tx.destinationAmount, tx.destination.currency);

  if (tx.type === TransactionType.ExternalExpense) {
    return [{ key: "statement.reverseEffect.returnTo", values: { amount: sourceAmount, wallet: tx.source.name } }];
  }
  if (tx.type === TransactionType.ExternalIncome) {
    return [
      { key: "statement.reverseEffect.leaveFrom", values: { amount: destinationAmount, wallet: tx.destination.name } },
    ];
  }

  const sentences: EffectSentence[] = [
    {
      key: "statement.reverseEffect.transfer",
      values: {
        returned: sourceAmount,
        source: tx.source.name,
        left: destinationAmount,
        destination: tx.destination.name,
      },
    },
  ];

  const kind = tx.transferKind ?? null;
  if (
    (kind === TransferKind.Loan || kind === TransferKind.Settlement) &&
    tx.debtAmount != null &&
    tx.debtCurrency != null
  ) {
    const sourceOwner = firstNameOf(tx.source.ownerName, tx.source.name);
    const destinationOwner = firstNameOf(tx.destination.ownerName, tx.destination.name);
    const amount = formatMoneyFull(tx.debtAmount, tx.debtCurrency);
    // Empréstimo: o titular do Para deve ao do De, e o estorno diminui a dívida.
    // Quitação: o titular do De devia ao do Para, e o estorno devolve o valor à dívida.
    sentences.push(
      kind === TransferKind.Loan
        ? {
            key: "statement.reverseEffect.debtDown",
            values: { debtor: destinationOwner, creditor: sourceOwner, amount },
          }
        : {
            key: "statement.reverseEffect.debtUp",
            values: { debtor: sourceOwner, creditor: destinationOwner, amount },
          },
    );
  }
  return sentences;
};

/** Bloco "O que acontece" da confirmação do estorno (`details` do ConfirmModal) */
export const ReverseEffect = ({ transaction }: ReverseEffectProps) => {
  const { t } = useTranslation();
  const sentences = effectSentences(transaction);

  return (
    // `<div>`, não `<section>` com nome: não vira landmark "região" dentro do alertdialog (REVIEW-008 M-5)
    <div className="mt-4 rounded-lg bg-surface px-4 py-3">
      <h3 className="m-0 mb-1 text-footnote font-semibold tracking-wide text-text-muted uppercase">
        {t("statement.reverseEffect.title")}
      </h3>
      <div className="flex flex-col gap-1">
        {sentences.map((sentence) => (
          <p key={sentence.key} className="m-0 text-body text-text">
            <Trans
              i18nKey={sentence.key}
              values={sentence.values}
              components={{ b: <span className="font-semibold whitespace-nowrap tabular-nums" /> }}
            />
          </p>
        ))}
      </div>
    </div>
  );
};

export default ReverseEffect;
