import type { ReactNode } from "react";
import { UpdatePrompt } from "../pwa/UpdatePrompt";
import { UpdatePromptPlacement } from "../ui/variants";

/**
 * Moldura das telas de entrada, cadastro e autorização: cartão de até 384 px, centralizado no
 * desktop. Com o aviso de nova versão visível, reserva o espaço dele no fim da rolagem para não
 * cobrir os botões (REVIEW-005 M-6).
 */
export const AuthLayout = ({ children }: { children: ReactNode }) => (
  <>
    <main className="min-h-dvh px-gutter pt-safe pb-[calc(env(safe-area-inset-bottom)+var(--update-prompt-h,0px)+min(var(--update-prompt-h,0px),1px)*24)] md:grid md:place-items-center md:py-8">
      <div className="mx-auto w-full max-w-auth pt-6 pb-8">{children}</div>
    </main>
    <UpdatePrompt placement={UpdatePromptPlacement.Bare} />
  </>
);

export default AuthLayout;
