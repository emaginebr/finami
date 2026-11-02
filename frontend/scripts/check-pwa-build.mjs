#!/usr/bin/env node
// Verifica o build PWA (feature 005, T022). Rodar depois de `npm run build`:
//   npm run check:pwa
// Confere o manifest gerado (contracts/ui.md §Manifest), a existência e o tamanho de todo ícone,
// atalho e screenshot referenciado, o index.html com o <link rel="manifest"> e o sw.js com o
// denylist do fallback de navegação (FR-016) e sem screenshots/splash no precache.
import { existsSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const DIST = join(ROOT, "dist");
const THEME_COLOR = "#12021c";

const errors = [];
const fail = (message) => errors.push(message);
const check = (condition, message) => {
  if (!condition) fail(message);
};

/** Lê largura × altura do cabeçalho IHDR de um PNG */
const pngSize = (file) => {
  const buffer = readFileSync(file);
  const signature = buffer.subarray(0, 8).toString("hex");
  if (signature !== "89504e470d0a1a0a") return null;
  return `${buffer.readUInt32BE(16)}x${buffer.readUInt32BE(20)}`;
};

/** Confere que `src` existe em dist/ e, se for PNG, que bate com `sizes` */
const checkAsset = (src, sizes, label) => {
  if (typeof src !== "string" || !src.startsWith("/")) {
    fail(`${label}: src inválido (${String(src)})`);
    return;
  }
  const file = join(DIST, src.replace(/^\//, "").split("?")[0]);
  if (!existsSync(file)) {
    fail(`${label}: arquivo ${src} não existe em dist/`);
    return;
  }
  if (sizes && file.toLowerCase().endsWith(".png")) {
    const actual = pngSize(file);
    check(actual === sizes, `${label}: ${src} tem ${actual ?? "formato inválido"}, esperado ${sizes}`);
  }
};

const readJson = (file) => {
  try {
    return JSON.parse(readFileSync(file, "utf8"));
  } catch (err) {
    fail(`${file}: não foi possível ler (${err instanceof Error ? err.message : String(err)})`);
    return null;
  }
};

if (!existsSync(DIST)) {
  console.error("dist/ não encontrado. Rode `npm run build` antes de `npm run check:pwa`.");
  process.exit(1);
}

// --- manifest.webmanifest -------------------------------------------------------

const manifestFile = join(DIST, "manifest.webmanifest");
const manifest = existsSync(manifestFile) ? readJson(manifestFile) : (fail("dist/manifest.webmanifest não existe"), null);

if (manifest) {
  const expected = {
    id: "/",
    name: "Finami",
    short_name: "Finami",
    description: "Finanças da família: saldos, carteiras e extratos.",
    start_url: "/?source=pwa",
    scope: "/",
    display: "standalone",
    lang: "pt-BR",
  };
  for (const [field, value] of Object.entries(expected)) {
    check(manifest[field] === value, `manifest.${field} = ${JSON.stringify(manifest[field])}, esperado ${JSON.stringify(value)}`);
  }
  check(
    Array.isArray(manifest.display_override) && manifest.display_override.includes("standalone"),
    'manifest.display_override deve incluir "standalone"',
  );
  check(String(manifest.theme_color).toLowerCase() === THEME_COLOR, `manifest.theme_color deve ser ${THEME_COLOR}`);
  check(String(manifest.background_color).toLowerCase() === THEME_COLOR, `manifest.background_color deve ser ${THEME_COLOR}`);
  check(Array.isArray(manifest.categories) && manifest.categories.includes("finance"), 'manifest.categories deve incluir "finance"');
  check(manifest.orientation === undefined, "manifest.orientation não deve ser fixada (research R-09)");

  // Ícones: any 192/512 + maskable 192/512
  const icons = Array.isArray(manifest.icons) ? manifest.icons : [];
  for (const purpose of ["any", "maskable"]) {
    for (const size of ["192x192", "512x512"]) {
      const found = icons.some((icon) => icon.sizes === size && String(icon.purpose ?? "any").split(" ").includes(purpose));
      check(found, `manifest.icons sem ícone ${purpose} ${size}`);
    }
  }
  icons.forEach((icon, index) => checkAsset(icon.src, icon.sizes, `icons[${index}]`));

  // Atalhos
  const shortcuts = Array.isArray(manifest.shortcuts) ? manifest.shortcuts : [];
  for (const url of ["/depositar", "/carteiras"]) {
    const shortcut = shortcuts.find((item) => item.url === url);
    if (!shortcut) {
      fail(`manifest.shortcuts sem o atalho ${url}`);
      continue;
    }
    check(typeof shortcut.name === "string" && shortcut.name.length > 0, `atalho ${url} sem name`);
    const shortcutIcons = Array.isArray(shortcut.icons) ? shortcut.icons : [];
    check(shortcutIcons.some((icon) => icon.sizes === "96x96"), `atalho ${url} sem ícone 96x96`);
    shortcutIcons.forEach((icon, index) => checkAsset(icon.src, icon.sizes, `atalho ${url} icons[${index}]`));
  }

  // Screenshots: 2 narrow 1080x1920 + 1 wide 1920x1080, com label
  const screenshots = Array.isArray(manifest.screenshots) ? manifest.screenshots : [];
  const narrow = screenshots.filter((item) => item.form_factor === "narrow" && item.sizes === "1080x1920");
  const wide = screenshots.filter((item) => item.form_factor === "wide" && item.sizes === "1920x1080");
  check(narrow.length >= 2, `manifest.screenshots: ${narrow.length} narrow 1080x1920, esperado 2`);
  check(wide.length >= 1, `manifest.screenshots: ${wide.length} wide 1920x1080, esperado 1`);
  screenshots.forEach((item, index) => {
    check(typeof item.label === "string" && item.label.length > 0, `screenshots[${index}] sem label`);
    checkAsset(item.src, item.sizes, `screenshots[${index}]`);
  });
}

// --- index.html -----------------------------------------------------------------

const indexFile = join(DIST, "index.html");
if (existsSync(indexFile)) {
  const html = readFileSync(indexFile, "utf8");
  check(/<link[^>]+rel="manifest"[^>]+manifest\.webmanifest/.test(html), 'dist/index.html sem <link rel="manifest">');
  check((html.match(/rel="manifest"/g) ?? []).length === 1, 'dist/index.html deve ter um único <link rel="manifest">');
  // Telas de abertura do iOS (T047): todas as referenciadas existem
  const splashHrefs = [...html.matchAll(/rel="apple-touch-startup-image"[^>]*href="([^"]+)"/g)].map((m) => m[1]);
  check(splashHrefs.length > 0, "dist/index.html sem apple-touch-startup-image");
  splashHrefs.forEach((href, index) => checkAsset(href, null, `apple-touch-startup-image[${index}]`));
} else {
  fail("dist/index.html não existe");
}

// --- sw.js ----------------------------------------------------------------------

const swFile = join(DIST, "sw.js");
if (existsSync(swFile)) {
  const sw = readFileSync(swFile, "utf8");
  const denylist = ["/^\\/api\\//", "/^\\/mcp/", "/^\\/oauth\\//", "/^\\/\\.well-known\\//"];
  for (const pattern of denylist) {
    check(sw.includes(pattern), `dist/sw.js sem ${pattern} no navigateFallbackDenylist`);
  }
  check(sw.includes("index.html"), "dist/sw.js sem o fallback de navegação para index.html");
  check(!/["']screenshots\//.test(sw), "dist/sw.js não deve pré-carregar screenshots/");
  check(!/["']splash\//.test(sw), "dist/sw.js não deve pré-carregar splash/");
  check(!/splash-links\.txt/.test(sw), "dist/sw.js não deve pré-carregar splash-links.txt");
} else {
  fail("dist/sw.js não existe");
}

// --- Resultado ------------------------------------------------------------------

if (errors.length > 0) {
  console.error(`check:pwa falhou (${errors.length}):`);
  errors.forEach((message) => console.error(`  - ${message}`));
  process.exit(1);
}

console.log("check:pwa ok — manifest, ícones, atalhos, screenshots e sw.js conferidos.");
