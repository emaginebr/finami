import type { ReactNode } from "react";
import { cn } from "../../utils/cn";

export interface WalletRowContentProps {
  name: string;
  /** Itens da linha 2 (moeda, selos, titular), na ordem; o último pode truncar */
  subtitle: ReactNode;
  balanceText: string;
  negative: boolean;
  /** Linha abaixo do saldo (ex.: "≈ R$ 1.250,00" ou "sem cotação") */
  secondary?: ReactNode;
  /** Esmaece (carteira inativa) */
  dim?: boolean;
}

/**
 * Nome + saldo de uma linha de carteira (REVIEW H-1): o nome tem largura mínima e quebra
 * entre palavras (até 2 linhas); quando o valor não cabe ao lado, desce para uma segunda linha
 * alinhada à direita — nenhum valor é cortado e nenhum nome é picotado.
 */
export const WalletRowContent = ({
  name,
  subtitle,
  balanceText,
  negative,
  secondary,
  dim = false,
}: WalletRowContentProps) => (
  <span className="flex min-w-0 flex-1 flex-wrap items-center gap-x-3 gap-y-1">
    <span className={cn("min-w-[7.5rem] flex-[1_1_7.5rem]", dim && "opacity-60")}>
      <span className="line-clamp-2 text-headline break-words hyphens-auto">{name}</span>
      <span className="mt-0.5 flex min-w-0 items-center gap-1 text-footnote text-text-muted">{subtitle}</span>
    </span>
    <span className="ms-auto shrink-0 text-right">
      <span
        className={cn(
          "block text-headline whitespace-nowrap tabular-nums",
          negative && "text-negative",
          dim && "opacity-60",
        )}
      >
        {balanceText}
      </span>
      {secondary ? (
        <span className="mt-0.5 block text-footnote whitespace-nowrap text-text-subtle tabular-nums">
          {secondary}
        </span>
      ) : null}
    </span>
  </span>
);

/** Separador " · " que não encolhe */
export const Dot = () => (
  <span aria-hidden="true" className="shrink-0">
    ·
  </span>
);

export default WalletRowContent;
