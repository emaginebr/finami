import type { ReactNode } from "react";

/** Moldura das telas de entrada e cadastro: cartão de até 384 px, centralizado no desktop */
export const AuthLayout = ({ children }: { children: ReactNode }) => (
  <main className="min-h-dvh px-gutter pt-safe pb-safe md:grid md:place-items-center md:py-8">
    <div className="mx-auto w-full max-w-auth pt-6 pb-8">{children}</div>
  </main>
);

export default AuthLayout;
