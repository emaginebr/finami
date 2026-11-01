import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { Toaster } from "sonner";
import "./i18n";
import "./index.css";
import App from "./App.tsx";
import { AuthProvider } from "./Contexts/AuthContext.tsx";
import { QuoteProvider } from "./Contexts/QuoteContext.tsx";
import { UserProvider } from "./Contexts/UserContext.tsx";
import { GroupProvider } from "./Contexts/GroupContext.tsx";
import { WalletProvider } from "./Contexts/WalletContext.tsx";
import { TransactionProvider } from "./Contexts/TransactionContext.tsx";
import { StatementProvider } from "./Contexts/StatementContext.tsx";
import { BalanceProvider } from "./Contexts/BalanceContext.tsx";
import { UiProvider } from "./Contexts/UiContext.tsx";

const rootElement = document.getElementById("root");
if (!rootElement) throw new Error("Elemento #root não encontrado em index.html");

// Ordem dos providers: data-model §10 (UiProvider por último).
// TransactionProvider depende do WalletProvider (refreshWallets após gravar).
createRoot(rootElement).render(
  <StrictMode>
    <AuthProvider>
      <QuoteProvider>
        <UserProvider>
          <GroupProvider>
            <WalletProvider>
              <TransactionProvider>
                <StatementProvider>
                  <BalanceProvider>
                    <UiProvider>
                      <App />
                      <Toaster theme="dark" position="top-center" richColors closeButton />
                    </UiProvider>
                  </BalanceProvider>
                </StatementProvider>
              </TransactionProvider>
            </WalletProvider>
          </GroupProvider>
        </UserProvider>
      </QuoteProvider>
    </AuthProvider>
  </StrictMode>,
);
