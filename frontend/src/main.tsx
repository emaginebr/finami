import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { Toaster } from "sonner";
import i18n from "./i18n";
import "./index.css";
import App from "./App.tsx";
import { ConnectivityProvider } from "./Contexts/ConnectivityContext.tsx";
import { InstallProvider } from "./Contexts/InstallContext.tsx";
import { AuthProvider } from "./Contexts/AuthContext.tsx";
import { QuoteProvider } from "./Contexts/QuoteContext.tsx";
import { UserProvider } from "./Contexts/UserContext.tsx";
import { GroupProvider } from "./Contexts/GroupContext.tsx";
import { WalletProvider } from "./Contexts/WalletContext.tsx";
import { TransactionProvider } from "./Contexts/TransactionContext.tsx";
import { StatementProvider } from "./Contexts/StatementContext.tsx";
import { BalanceProvider } from "./Contexts/BalanceContext.tsx";
import { InvitationProvider } from "./Contexts/InvitationContext.tsx";
import { NotificationProvider } from "./Contexts/NotificationContext.tsx";
import { OAuthConnectionProvider } from "./Contexts/OAuthConnectionContext.tsx";

const rootElement = document.getElementById("root");
if (!rootElement) throw new Error("Elemento #root não encontrado em index.html");

// Ordem dos providers: data-model §10.
// TransactionProvider depende do WalletProvider (refreshWallets após gravar).
// Invitation/Notification (feature 003) ficam dentro do GroupProvider.
// OAuthConnection (feature 004) só depende do AuthProvider.
// Connectivity/Install (feature 005) não dependem de ninguém e ficam acima dos providers de
// dados, que vão assinar `onReconnected` para recarregar ao voltar a conexão.
createRoot(rootElement).render(
  <StrictMode>
    <ConnectivityProvider>
      <InstallProvider>
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
                                <App />
                                {/* Região `aria-live="polite"` do sonner com rótulo em português (T041) */}
                                <Toaster
                                  theme="dark"
                                  position="top-center"
                                  richColors
                                  closeButton
                                  containerAriaLabel={i18n.t("app.toasts")}
                                  // Feature 005: no celular o toast nunca cobre a faixa "Sem internet"
                                  mobileOffset={{
                                    // A altura da faixa já inclui a área segura: não somar duas vezes (REVIEW-005 M-7)
                                    top: "calc(max(env(safe-area-inset-top), var(--offline-banner-h, 0px)) + 8px)",
                                  }}
                                />
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
      </InstallProvider>
    </ConnectivityProvider>
  </StrictMode>,
);
