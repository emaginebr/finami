import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { Toaster } from "sonner";
import i18n from "./i18n";
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
import { InvitationProvider } from "./Contexts/InvitationContext.tsx";
import { NotificationProvider } from "./Contexts/NotificationContext.tsx";
import { OAuthConnectionProvider } from "./Contexts/OAuthConnectionContext.tsx";

const rootElement = document.getElementById("root");
if (!rootElement) throw new Error("Elemento #root não encontrado em index.html");

// Ordem dos providers: data-model §10 (UiProvider por último).
// TransactionProvider depende do WalletProvider (refreshWallets após gravar).
// Invitation/Notification (feature 003) ficam dentro do GroupProvider.
// OAuthConnection (feature 004) só depende do AuthProvider; fica junto ao UiProvider.
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
                    <InvitationProvider>
                      <NotificationProvider>
                        <OAuthConnectionProvider>
                          <UiProvider>
                            <App />
                            {/* Região `aria-live="polite"` do sonner com rótulo em português (T041) */}
                            <Toaster
                              theme="dark"
                              position="top-center"
                              richColors
                              closeButton
                              containerAriaLabel={i18n.t("app.toasts")}
                            />
                          </UiProvider>
                        </OAuthConnectionProvider>
                      </NotificationProvider>
                    </InvitationProvider>
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
