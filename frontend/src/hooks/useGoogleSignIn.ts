import { useEffect, useRef, useState } from "react";
import type { RefObject } from "react";

/** Script do Google Identity Services (research R-05) */
export const GOOGLE_GSI_SRC = "https://accounts.google.com/gsi/client";

interface GoogleCredentialResponse {
  /** ID token (JWT) a enviar para `POST /api/auth/google` */
  credential: string;
}

interface GoogleIdConfiguration {
  client_id: string;
  callback: (response: GoogleCredentialResponse) => void;
  ux_mode?: "popup" | "redirect";
  auto_select?: boolean;
  cancel_on_tap_outside?: boolean;
}

interface GoogleButtonConfiguration {
  type?: "standard" | "icon";
  theme?: "outline" | "filled_blue" | "filled_black";
  size?: "large" | "medium" | "small";
  text?: "signin_with" | "signup_with" | "continue_with" | "signin";
  shape?: "rectangular" | "pill" | "circle" | "square";
  logo_alignment?: "left" | "center";
  width?: number;
  locale?: string;
}

interface GoogleAccountsId {
  initialize: (config: GoogleIdConfiguration) => void;
  renderButton: (parent: HTMLElement, options: GoogleButtonConfiguration) => void;
}

interface GoogleNamespace {
  accounts: { id: GoogleAccountsId };
}

declare global {
  interface Window {
    google?: GoogleNamespace;
  }
}

let scriptPromise: Promise<GoogleNamespace> | null = null;

/** Carrega o script do Google uma única vez, sob demanda */
const loadGoogleScript = (): Promise<GoogleNamespace> => {
  if (window.google?.accounts?.id) return Promise.resolve(window.google);
  if (scriptPromise) return scriptPromise;
  scriptPromise = new Promise<GoogleNamespace>((resolve, reject) => {
    const script = document.createElement("script");
    script.src = GOOGLE_GSI_SRC;
    script.async = true;
    script.defer = true;
    script.onload = () => {
      if (window.google?.accounts?.id) resolve(window.google);
      else reject(new Error("Google Identity Services indisponível"));
    };
    script.onerror = () => {
      scriptPromise = null;
      reject(new Error("Falha ao carregar o Google Identity Services"));
    };
    document.head.appendChild(script);
  });
  return scriptPromise;
};

export interface UseGoogleSignInOptions {
  /** Contêiner onde o botão oficial é desenhado */
  containerRef: RefObject<HTMLElement | null>;
  /** Recebe o ID token do Google */
  onCredential: (idToken: string) => void;
  /** Texto do botão oficial */
  text?: GoogleButtonConfiguration["text"];
}

export interface UseGoogleSignInResult {
  /** Há `VITE_GOOGLE_CLIENT_ID`: o botão deve ser exibido */
  enabled: boolean;
  /** O script não carregou (rede bloqueada etc.) */
  failed: boolean;
}

/**
 * Botão "Fazer login com o Google" (tema `filled_black`, `pt-BR`, largura do contêiner).
 * Sem `VITE_GOOGLE_CLIENT_ID` não faz nada e `enabled` = false.
 */
export const useGoogleSignIn = ({
  containerRef,
  onCredential,
  text = "signin_with",
}: UseGoogleSignInOptions): UseGoogleSignInResult => {
  const clientId = import.meta.env.VITE_GOOGLE_CLIENT_ID?.trim() ?? "";
  const enabled = clientId.length > 0;
  const [failed, setFailed] = useState(false);
  const callbackRef = useRef(onCredential);
  callbackRef.current = onCredential;

  useEffect(() => {
    if (!enabled) return undefined;
    let cancelled = false;

    loadGoogleScript()
      .then((google) => {
        const container = containerRef.current;
        if (cancelled || !container) return;
        google.accounts.id.initialize({
          client_id: clientId,
          callback: (response) => callbackRef.current(response.credential),
          ux_mode: "popup",
          cancel_on_tap_outside: true,
        });
        container.replaceChildren();
        google.accounts.id.renderButton(container, {
          type: "standard",
          theme: "filled_black",
          size: "large",
          shape: "pill",
          text,
          logo_alignment: "center",
          locale: "pt-BR",
          width: Math.min(400, Math.max(200, Math.round(container.clientWidth || 320))),
        });
      })
      .catch(() => {
        if (!cancelled) setFailed(true);
      });

    return () => {
      cancelled = true;
    };
  }, [enabled, clientId, containerRef, text]);

  return { enabled, failed };
};

export default useGoogleSignIn;
