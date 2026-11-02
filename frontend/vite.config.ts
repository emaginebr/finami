import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import { VitePWA } from "vite-plugin-pwa";

/** = --color-bg (docs/design/tokens.css) */
const THEME_COLOR = "#12021C";

// https://vite.dev/config/ — bloco `test` é lido pelo Vitest
export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
    // Feature 005 (research R-01, R-07, R-09): SW com precache da "casca" e manifest gerado no build.
    // O registro é feito pelo app (`UpdatePrompt` → `virtual:pwa-register/react`); em dev não há SW.
    VitePWA({
      registerType: "prompt",
      injectRegister: false,
      strategies: "generateSW",
      devOptions: { enabled: false },
      // Os PNGs de `public/` entram pelo `globPatterns` (evita entradas duplicadas no precache)
      includeManifestIcons: false,
      workbox: {
        // Casca enxuta (T049): JS/CSS (traduções vão dentro do JS), HTML, fontes, ícones e imagens do app
        globPatterns: ["**/*.{js,css,html,svg,png,webp,woff2,json}"],
        // Screenshots e telas de abertura do iOS (~2,6 MB, inclui splash-links.txt) só servem na instalação
        globIgnores: ["**/node_modules/**/*", "screenshots/**", "splash/**"],
        navigateFallback: "/index.html",
        // Rotas da API/OAuth/MCP na mesma origem nunca são servidas pelo SW (FR-016)
        navigateFallbackDenylist: [
          /^\/api\//,
          /^\/mcp/,
          /^\/oauth\//,
          /^\/\.well-known\//,
          /^\/health/,
          /^\/healthz/,
        ],
        cleanupOutdatedCaches: true,
      },
      manifest: {
        id: "/",
        name: "Finami",
        short_name: "Finami",
        description: "Finanças da família: saldos, carteiras e extratos.",
        lang: "pt-BR",
        dir: "ltr",
        start_url: "/?source=pwa",
        scope: "/",
        display: "standalone",
        display_override: ["standalone"],
        theme_color: THEME_COLOR,
        background_color: THEME_COLOR,
        categories: ["finance"],
        icons: [
          { src: "/icon-any-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
          { src: "/icon-any-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
          { src: "/icon-maskable-192.png", sizes: "192x192", type: "image/png", purpose: "maskable" },
          { src: "/icon-maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
        ],
        shortcuts: [
          {
            name: "Novo lançamento",
            short_name: "Lançar",
            description: "Registrar uma entrada, saída ou transferência",
            url: "/?acao=novo-lancamento",
            icons: [{ src: "/shortcut-new-transaction-96.png", sizes: "96x96", type: "image/png" }],
          },
          {
            name: "Carteiras",
            short_name: "Carteiras",
            description: "Ver suas carteiras e extratos",
            url: "/carteiras",
            icons: [{ src: "/shortcut-wallets-96.png", sizes: "96x96", type: "image/png" }],
          },
        ],
        screenshots: [
          {
            src: "/screenshots/home-narrow.png",
            sizes: "1080x1920",
            type: "image/png",
            form_factor: "narrow",
            label: "Home com o saldo total e as carteiras da família",
          },
          {
            src: "/screenshots/wallets-narrow.png",
            sizes: "1080x1920",
            type: "image/png",
            form_factor: "narrow",
            label: "Lista de carteiras em reais e em bitcoin",
          },
          {
            src: "/screenshots/home-wide.png",
            sizes: "1920x1080",
            type: "image/png",
            form_factor: "wide",
            label: "Finami no computador com o saldo total e as carteiras",
          },
        ],
      },
    }),
  ],
  server: {
    port: 5173,
  },
  test: {
    environment: "jsdom",
    setupFiles: "./src/test/setup.ts",
    globals: true,
    css: false,
    // Testes de página com axe passam de 5 s quando a suíte inteira roda em paralelo
    testTimeout: 15000,
    // Registro do SW simulado nos testes (T005); caminho relativo à raiz do projeto
    alias: [{ find: "virtual:pwa-register/react", replacement: "/src/test/pwaRegisterMock.ts" }],
  },
});
