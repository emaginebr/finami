// Gera os ícones e as telas de abertura do Finami a partir da logo oficial
// (research R-08 da feature 002; R-09 da feature 005 — PWA, tarefa T008).
//
// Uso: `npm run icons` (dentro de frontend/). Só precisa rodar de novo quando a logo mudar;
// as imagens geradas são versionadas.
//
// O que gera (public/ salvo indicação):
//   apple-touch-icon.png (180)        iOS: quadrado opaco roxo #380159, a casa a 72 %.
//   favicon-32.png (32)               casa quase no quadro inteiro, legível em 32 px.
//   icon-any-192.png / -512.png       manifest purpose "any": cartão roxo #380159 com cantos
//                                     arredondados (squircle 22,37 %) ocupando o quadro, cantos
//                                     transparentes; a casa a 70 %.
//   icon-maskable-192.png / -512.png  manifest purpose "maskable": fundo #12021C cheio, casa
//                                     recortada (sem o retângulo roxo) dentro da zona segura
//                                     (círculo de raio 40 % do lado = 80 % do diâmetro).
//   shortcut-new-transaction-96.png   atalho "Novo lançamento": "+" (como o FAB).
//   shortcut-wallets-96.png           atalho "Carteiras": ícone WalletCards (lucide).
//   splash/apple-splash-{w}x{h}.png   telas de abertura do iOS (retrato), fundo #12021C e a logo
//                                     completa recortada, centralizada.
//   splash/splash-links.txt           as tags <link rel="apple-touch-startup-image"> para colar
//                                     no index.html.
//   src/assets/app-icon.png (512) e app-icon.webp (288), src/assets/logo.webp (640).

import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import { mkdir, writeFile } from 'node:fs/promises';
import sharp from 'sharp';

// ---------------------------------------------------------------------------
// Constantes de recorte (pixels da logo original 2172 × 724)
// ---------------------------------------------------------------------------
// Caixa da casa medida pela diferença de cor em relação ao fundo roxo:
//   x 131–710, y 78–651  (o "F" de "Finami" começa em x 758).
// Recorte = caixa + 7 px de folga de cada lado, ainda 40 px antes do "F".
const CROP = { left: 124, top: 71, width: 594, height: 588 };

// Cores da marca (docs/design/tokens.css)
const BRAND_BG = '#380159'; // --color-brand: fundo dos ícones "any"/iOS
const APP_BG = '#12021C'; // --color-bg: theme/background_color, maskable e splash
const ACCENT = '#6AE005'; // --color-accent: disco dos atalhos (como o FAB)

// Fração do lado do ícone ocupada pelo lado maior do recorte.
//  - IOS: o iOS aplica a máscara "squircle"; 72% deixa a casa inteira com respiro.
//  - ANY: casa dentro do cartão arredondado, com respiro equivalente ao do iOS.
//  - FAVICON: em 32 px a casa precisa ocupar quase tudo para continuar legível.
const SCALE = { ios: 0.72, any: 0.7, favicon: 0.86 };

// Maskable: raio máximo do conteúdo (a partir do centro), como fração do lado.
// A zona segura é um círculo de raio 0,40; usamos 0,385 para sobrar 1,5 % de folga.
const MASKABLE_MAX_RADIUS = 0.385;

// Recorte por cor (chroma key) do fundo roxo da logo: distância RGB ao fundo medido.
// ≤ KEY_LOW → transparente; ≥ KEY_HIGH → opaco; entre os dois, borda suave com a cor
// "desmisturada" do roxo (evita halo roxo sobre o #12021C).
const KEY_LOW = 16;
const KEY_HIGH = 72;

// Largura da logo completa exibida no app (login e barra lateral).
const LOGO_WIDTH = 640;

// AppIcon leve para o app (revisão T091): lado em px e qualidade WebP.
const APP_ICON_WEBP = { size: 288, quality: 82 };

// Telas de abertura do iOS (retrato). device = pontos CSS; dpr = densidade.
// Fonte: tamanhos de tela da Apple (iPhone 8/SE até iPhone 17 e iPad atuais).
const SPLASH = [
  { device: [440, 956], dpr: 3, label: 'iPhone 16 Pro Max, 17 Pro Max' },
  { device: [402, 874], dpr: 3, label: 'iPhone 16 Pro, 17, 17 Pro' },
  { device: [420, 912], dpr: 3, label: 'iPhone Air' },
  { device: [430, 932], dpr: 3, label: 'iPhone 14 Pro Max, 15 Plus, 15 Pro Max, 16 Plus' },
  { device: [393, 852], dpr: 3, label: 'iPhone 14 Pro, 15, 15 Pro, 16' },
  { device: [390, 844], dpr: 3, label: 'iPhone 12, 12 Pro, 13, 13 Pro, 14, 16e' },
  { device: [428, 926], dpr: 3, label: 'iPhone 12 Pro Max, 13 Pro Max, 14 Plus' },
  { device: [375, 812], dpr: 3, label: 'iPhone X, XS, 11 Pro, 12 mini, 13 mini' },
  { device: [414, 896], dpr: 3, label: 'iPhone XS Max, 11 Pro Max' },
  { device: [414, 896], dpr: 2, label: 'iPhone XR, 11' },
  { device: [375, 667], dpr: 2, label: 'iPhone 8, SE (2ª e 3ª geração)' },
  { device: [1032, 1376], dpr: 2, label: 'iPad Pro 13" (M4)' },
  { device: [1024, 1366], dpr: 2, label: 'iPad Pro 12,9", iPad Air 13"' },
  { device: [834, 1210], dpr: 2, label: 'iPad Pro 11" (M4)' },
  { device: [834, 1194], dpr: 2, label: 'iPad Pro 11", iPad Air 11"' },
  { device: [820, 1180], dpr: 2, label: 'iPad Air (4ª e 5ª geração), iPad (10ª geração e A16)' },
  { device: [744, 1133], dpr: 2, label: 'iPad mini (6ª geração e A17 Pro)' },
  { device: [810, 1080], dpr: 2, label: 'iPad (9ª geração)' },
];
// Largura da logo na tela de abertura, como fração da largura da tela.
const SPLASH_LOGO = { phone: 0.62, tablet: 0.4 };

// ---------------------------------------------------------------------------
// Caminhos relativos a este script
// ---------------------------------------------------------------------------
const here = dirname(fileURLToPath(import.meta.url));
const frontendDir = resolve(here, '..');
const repoDir = resolve(frontendDir, '..');
const SOURCE = resolve(repoDir, 'docs/logos/logo.png');
const PUBLIC_DIR = resolve(frontendDir, 'public');
const SPLASH_DIR = resolve(PUBLIC_DIR, 'splash');
const ASSETS_DIR = resolve(frontendDir, 'src/assets');

const rel = (file) => file.replace(frontendDir, 'frontend').replaceAll('\\', '/');
const log = (file, w, h = w) => console.log(`  ✓ ${rel(file)} (${w}×${h})`);

// ---------------------------------------------------------------------------
// Ícones opacos sobre o roxo da marca (iOS, favicon, AppIcon do app) — como antes
// ---------------------------------------------------------------------------
async function renderOpaque(houseBuffer, { file, size, scale }) {
  const box = Math.round(size * scale);
  const house = await sharp(houseBuffer)
    .resize(box, box, { fit: 'contain', background: BRAND_BG })
    .flatten({ background: BRAND_BG })
    .toBuffer();
  const meta = await sharp(house).metadata();

  await sharp({ create: { width: size, height: size, channels: 3, background: BRAND_BG } })
    .composite([
      { input: house, left: Math.round((size - meta.width) / 2), top: Math.round((size - meta.height) / 2) },
    ])
    .removeAlpha()
    .png({ compressionLevel: 9 })
    .toFile(file);
  log(file, size);
}

// ---------------------------------------------------------------------------
// Recorte por cor: devolve um PNG RGBA sem o fundo roxo da logo
// ---------------------------------------------------------------------------
async function measureBackground() {
  const { data, info } = await sharp(SOURCE).removeAlpha().raw().toBuffer({ resolveWithObject: true });
  const sum = [0, 0, 0];
  let n = 0;
  // Quatro cantos (40×40), longe da casa e do texto.
  const corners = [
    [8, 8],
    [info.width - 48, 8],
    [8, info.height - 48],
    [info.width - 48, info.height - 48],
  ];
  for (const [x0, y0] of corners) {
    for (let y = y0; y < y0 + 40; y++) {
      for (let x = x0; x < x0 + 40; x++) {
        const i = (y * info.width + x) * 3;
        sum[0] += data[i];
        sum[1] += data[i + 1];
        sum[2] += data[i + 2];
        n++;
      }
    }
  }
  return sum.map((v) => v / n);
}

async function keyOut(input, bg) {
  const { data, info } = await sharp(input).removeAlpha().raw().toBuffer({ resolveWithObject: true });
  const out = Buffer.alloc(info.width * info.height * 4);
  for (let p = 0, q = 0; p < data.length; p += 3, q += 4) {
    const r = data[p];
    const g = data[p + 1];
    const b = data[p + 2];
    const d = Math.hypot(r - bg[0], g - bg[1], b - bg[2]);
    let a = (d - KEY_LOW) / (KEY_HIGH - KEY_LOW);
    a = Math.min(1, Math.max(0, a));
    if (a > 0 && a < 1) {
      // desmistura: c = (p − (1 − a)·bg) / a
      out[q] = clamp((r - (1 - a) * bg[0]) / a);
      out[q + 1] = clamp((g - (1 - a) * bg[1]) / a);
      out[q + 2] = clamp((b - (1 - a) * bg[2]) / a);
    } else {
      out[q] = r;
      out[q + 1] = g;
      out[q + 2] = b;
    }
    out[q + 3] = Math.round(a * 255);
  }
  return sharp(out, { raw: { width: info.width, height: info.height, channels: 4 } })
    .png()
    .toBuffer();
}

const clamp = (v) => Math.max(0, Math.min(255, Math.round(v)));

// Caixa do conteúdo (alfa > limite) e maior distância de um pixel visível ao centro da caixa.
async function contentGeometry(pngRgba, alphaMin = 24) {
  const { data, info } = await sharp(pngRgba).raw().toBuffer({ resolveWithObject: true });
  let x0 = info.width;
  let y0 = info.height;
  let x1 = -1;
  let y1 = -1;
  for (let y = 0; y < info.height; y++) {
    for (let x = 0; x < info.width; x++) {
      if (data[(y * info.width + x) * 4 + 3] > alphaMin) {
        if (x < x0) x0 = x;
        if (x > x1) x1 = x;
        if (y < y0) y0 = y;
        if (y > y1) y1 = y;
      }
    }
  }
  const cx = (x0 + x1 + 1) / 2;
  const cy = (y0 + y1 + 1) / 2;
  let r2 = 0;
  for (let y = y0; y <= y1; y++) {
    for (let x = x0; x <= x1; x++) {
      if (data[(y * info.width + x) * 4 + 3] > alphaMin) {
        const dx = Math.max(Math.abs(x - cx), Math.abs(x + 1 - cx));
        const dy = Math.max(Math.abs(y - cy), Math.abs(y + 1 - cy));
        r2 = Math.max(r2, dx * dx + dy * dy);
      }
    }
  }
  return { box: { left: x0, top: y0, width: x1 - x0 + 1, height: y1 - y0 + 1 }, radius: Math.sqrt(r2) };
}

// Redimensiona um PNG RGBA e o centraliza num quadro (fundo opcional) — devolve o buffer.
async function centerOn(png, { width, height, contentWidth, contentHeight, background }) {
  const resized = await sharp(png)
    .resize(contentWidth, contentHeight, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 }, kernel: 'lanczos3' })
    .toBuffer();
  const meta = await sharp(resized).metadata();
  const base = background
    ? { width, height, channels: 4, background }
    : { width, height, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 0 } };
  return sharp({ create: base })
    .composite([{ input: resized, left: Math.round((width - meta.width) / 2), top: Math.round((height - meta.height) / 2) }])
    .png()
    .toBuffer();
}

// ---------------------------------------------------------------------------
// Ícones do manifest
// ---------------------------------------------------------------------------
async function renderAny(houseKeyed, houseBox, size, file) {
  // Cartão roxo com cantos arredondados (mesmo raio do AppIcon: 22,37 %) ocupando o quadro.
  const radius = (size * 0.2237).toFixed(2);
  const tile = Buffer.from(
    `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}"><rect width="${size}" height="${size}" rx="${radius}" ry="${radius}" fill="${BRAND_BG}"/></svg>`,
  );
  const side = Math.round(size * SCALE.any);
  const k = side / Math.max(houseBox.width, houseBox.height);
  const house = await centerOn(houseKeyed, {
    width: size,
    height: size,
    contentWidth: Math.round(houseBox.width * k),
    contentHeight: Math.round(houseBox.height * k),
  });
  await sharp(tile).composite([{ input: house }]).png({ compressionLevel: 9 }).toFile(file);
  log(file, size);
}

async function renderMaskable(houseKeyed, houseGeo, size, file) {
  const k = (MASKABLE_MAX_RADIUS * size) / houseGeo.radius;
  const buf = await centerOn(houseKeyed, {
    width: size,
    height: size,
    contentWidth: Math.round(houseGeo.box.width * k),
    contentHeight: Math.round(houseGeo.box.height * k),
    background: APP_BG,
  });
  await sharp(buf).flatten({ background: APP_BG }).removeAlpha().png({ compressionLevel: 9 }).toFile(file);
  log(file, size);
}

// Atalhos: fundo roxo cheio (quadro inteiro, funciona com ou sem máscara), disco verde
// (raio 30 % — dentro da zona segura de 40 %) e o símbolo em #12021C, traço lucide.
async function renderShortcut(glyph, file, size = 96) {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 96 96">
  <rect width="96" height="96" fill="${BRAND_BG}"/>
  <circle cx="48" cy="48" r="29" fill="${ACCENT}"/>
  <g transform="translate(31 31) scale(1.4167)" fill="none" stroke="${APP_BG}" stroke-linecap="round" stroke-linejoin="round" stroke-width="${glyph.stroke}">${glyph.paths}</g>
</svg>`;
  await sharp(Buffer.from(svg)).png({ compressionLevel: 9 }).toFile(file);
  log(file, size);
}

const GLYPHS = {
  plus: { stroke: 2.5, paths: '<path d="M5 12h14"/><path d="M12 5v14"/>' },
  walletCards: {
    stroke: 2,
    paths:
      '<rect width="18" height="18" x="3" y="3" rx="2"/><path d="M3 9a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2"/><path d="M3 11h3c.8 0 1.6.3 2.1.9l1.1.9c1.6 1.6 4.1 1.6 5.7 0l1.1-.9c.5-.5 1.3-.9 2.1-.9H21"/>',
  },
};

// ---------------------------------------------------------------------------
// Telas de abertura do iOS
// ---------------------------------------------------------------------------
async function renderSplashes(logoKeyed, logoBox) {
  await mkdir(SPLASH_DIR, { recursive: true });
  const logoTrim = await sharp(logoKeyed).extract(logoBox).png().toBuffer();
  const links = [
    '<!-- Telas de abertura do iOS (gerado por scripts/generate-icons.mjs — não editar à mão).',
    '     Colar no <head> do frontend/index.html, depois do apple-touch-icon. -->',
  ];
  for (const { device, dpr, label } of SPLASH) {
    const [dw, dh] = device;
    const width = dw * dpr;
    const height = dh * dpr;
    const isTablet = dw >= 700;
    const contentWidth = Math.round(width * (isTablet ? SPLASH_LOGO.tablet : SPLASH_LOGO.phone));
    const contentHeight = Math.round((contentWidth * logoBox.height) / logoBox.width);
    const name = `apple-splash-${width}x${height}.png`;
    const file = resolve(SPLASH_DIR, name);
    const buf = await centerOn(logoTrim, { width, height, contentWidth, contentHeight, background: APP_BG });
    await sharp(buf).flatten({ background: APP_BG }).removeAlpha().png({ compressionLevel: 9 }).toFile(file);
    log(file, width, height);
    links.push(
      `<!-- ${label} -->`,
      `<link rel="apple-touch-startup-image" media="screen and (device-width: ${dw}px) and (device-height: ${dh}px) and (-webkit-device-pixel-ratio: ${dpr}) and (orientation: portrait)" href="/splash/${name}" />`,
    );
  }
  const linksFile = resolve(SPLASH_DIR, 'splash-links.txt');
  await writeFile(linksFile, `${links.join('\n')}\n`, 'utf8');
  console.log(`  ✓ ${rel(linksFile)}`);
}

// ---------------------------------------------------------------------------
async function main() {
  await mkdir(PUBLIC_DIR, { recursive: true });
  await mkdir(ASSETS_DIR, { recursive: true });

  const meta = await sharp(SOURCE).metadata();
  if (CROP.left + CROP.width > meta.width || CROP.top + CROP.height > meta.height) {
    throw new Error(`Recorte ${JSON.stringify(CROP)} fora da imagem ${meta.width}×${meta.height}.`);
  }
  console.log(`Logo: ${SOURCE} (${meta.width}×${meta.height})`);
  console.log(`Recorte da casa: ${JSON.stringify(CROP)}`);

  // 1. Ícones opacos sobre o roxo (iOS, favicon, AppIcon do app)
  const houseBuffer = await sharp(SOURCE).extract(CROP).flatten({ background: BRAND_BG }).toBuffer();
  await renderOpaque(houseBuffer, { file: resolve(PUBLIC_DIR, 'apple-touch-icon.png'), size: 180, scale: SCALE.ios });
  await renderOpaque(houseBuffer, { file: resolve(PUBLIC_DIR, 'favicon-32.png'), size: 32, scale: SCALE.favicon });
  await renderOpaque(houseBuffer, { file: resolve(ASSETS_DIR, 'app-icon.png'), size: 512, scale: SCALE.ios });

  // 2. Recortes sem o fundo roxo (casa e logo completa)
  const bg = await measureBackground();
  console.log(`Fundo da logo medido: rgb(${bg.map((v) => v.toFixed(1)).join(', ')})`);
  const houseKeyedFull = await keyOut(await sharp(SOURCE).extract(CROP).toBuffer(), bg);
  const houseGeoFull = await contentGeometry(houseKeyedFull);
  const houseKeyed = await sharp(houseKeyedFull).extract(houseGeoFull.box).png().toBuffer();
  const houseGeo = await contentGeometry(houseKeyed);
  const logoKeyed = await keyOut(SOURCE, bg);
  const logoGeo = await contentGeometry(logoKeyed);

  // 3. Manifest: "any" e "maskable" separados
  for (const size of [192, 512]) {
    await renderAny(houseKeyed, houseGeo.box, size, resolve(PUBLIC_DIR, `icon-any-${size}.png`));
    await renderMaskable(houseKeyed, houseGeo, size, resolve(PUBLIC_DIR, `icon-maskable-${size}.png`));
  }

  // 4. Atalhos
  await renderShortcut(GLYPHS.plus, resolve(PUBLIC_DIR, 'shortcut-new-transaction-96.png'));
  await renderShortcut(GLYPHS.walletCards, resolve(PUBLIC_DIR, 'shortcut-wallets-96.png'));

  // 5. Telas de abertura do iOS
  await renderSplashes(logoKeyed, logoGeo.box);

  // 6. Assets do app
  const appIconPng = resolve(ASSETS_DIR, 'app-icon.png');
  const appIconWebp = resolve(ASSETS_DIR, 'app-icon.webp');
  await sharp(appIconPng)
    .resize(APP_ICON_WEBP.size, APP_ICON_WEBP.size, { kernel: 'lanczos3' })
    .webp({ quality: APP_ICON_WEBP.quality, effort: 6, smartSubsample: true })
    .toFile(appIconWebp);
  log(appIconWebp, APP_ICON_WEBP.size);

  const logoFile = resolve(ASSETS_DIR, 'logo.webp');
  await sharp(SOURCE).resize({ width: LOGO_WIDTH }).webp({ quality: 90 }).toFile(logoFile);
  console.log(`  ✓ ${rel(logoFile)} (largura ${LOGO_WIDTH})`);
}

main().catch((error) => {
  console.error('Falha ao gerar os ícones:', error);
  process.exit(1);
});
