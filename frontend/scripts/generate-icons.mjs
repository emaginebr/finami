// Gera os ícones do Finami a partir da logo oficial (research R-08, tarefa T010).
//
// Uso: `npm run icons` (dentro de frontend/). Só precisa rodar de novo quando a logo mudar;
// as imagens geradas são versionadas.
//
// O que faz:
//   1. Recorta a casa com a família de docs/logos/logo.png (sem o texto "Finami").
//   2. Centraliza o recorte num quadrado opaco com o roxo da marca (#380159),
//      respeitando a margem de segurança de cada destino (iOS, maskable, favicon).
//   3. Grava os PNGs em public/ e src/assets/ e a logo completa em WebP.
//   4. Grava src/assets/app-icon.webp (288 px, leve) — a versão usada pelo app no
//      login, cadastro, 404 e carregamento (maior uso: 96 px CSS × 3 = 288 px).

import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import { mkdir } from 'node:fs/promises';
import sharp from 'sharp';

// ---------------------------------------------------------------------------
// Constantes de recorte (pixels da logo original 2172 × 724)
// ---------------------------------------------------------------------------
// Caixa da casa medida pela diferença de cor em relação ao fundo roxo:
//   x 131–710, y 78–651  (o "F" de "Finami" começa em x 758).
// Recorte = caixa + 7 px de folga de cada lado, ainda 40 px antes do "F".
const CROP = { left: 124, top: 71, width: 594, height: 588 };

// Cor de fundo dos ícones (roxo da logo = --color-brand).
const BRAND_BG = '#380159';

// Fração do lado do ícone ocupada pelo lado maior do recorte.
//  - IOS: o iOS aplica a máscara "squircle"; 72% deixa a casa inteira com respiro
//    equivalente à grade de ícones da Apple.
//  - MASKABLE: a zona segura do maskable é um círculo de raio 40% do lado; com 58%
//    a meia-diagonal da casa fica em ~39,8% do lado, dentro do círculo.
//  - FAVICON: em 32 px a casa precisa ocupar quase tudo para continuar legível.
const SCALE = { ios: 0.72, maskable: 0.58, favicon: 0.86 };

// Largura da logo completa exibida no app (login e barra lateral).
const LOGO_WIDTH = 640;

// AppIcon leve para o app (revisão T091): lado em px e qualidade WebP.
// 288 = maior exibição (96 px CSS) em tela 3x; alvo < 20 KB.
const APP_ICON_WEBP = { size: 288, quality: 82 };

// ---------------------------------------------------------------------------
// Caminhos relativos a este script
// ---------------------------------------------------------------------------
const here = dirname(fileURLToPath(import.meta.url));
const frontendDir = resolve(here, '..');
const repoDir = resolve(frontendDir, '..');
const SOURCE = resolve(repoDir, 'docs/logos/logo.png');
const PUBLIC_DIR = resolve(frontendDir, 'public');
const ASSETS_DIR = resolve(frontendDir, 'src/assets');

const OUTPUTS = [
  { file: resolve(PUBLIC_DIR, 'apple-touch-icon.png'), size: 180, scale: SCALE.ios },
  { file: resolve(PUBLIC_DIR, 'icon-192.png'), size: 192, scale: SCALE.maskable },
  { file: resolve(PUBLIC_DIR, 'icon-512.png'), size: 512, scale: SCALE.maskable },
  { file: resolve(PUBLIC_DIR, 'favicon-32.png'), size: 32, scale: SCALE.favicon },
  { file: resolve(ASSETS_DIR, 'app-icon.png'), size: 512, scale: SCALE.ios },
];

async function renderIcon(houseBuffer, { file, size, scale }) {
  const box = Math.round(size * scale);
  const house = await sharp(houseBuffer)
    .resize(box, box, { fit: 'contain', background: BRAND_BG })
    .flatten({ background: BRAND_BG })
    .toBuffer();
  const meta = await sharp(house).metadata();

  await sharp({
    create: { width: size, height: size, channels: 3, background: BRAND_BG },
  })
    .composite([
      {
        input: house,
        left: Math.round((size - meta.width) / 2),
        top: Math.round((size - meta.height) / 2),
      },
    ])
    .removeAlpha()
    .png({ compressionLevel: 9 })
    .toFile(file);

  console.log(`  ✓ ${file.replace(frontendDir, 'frontend')} (${size}×${size})`);
}

async function main() {
  await mkdir(PUBLIC_DIR, { recursive: true });
  await mkdir(ASSETS_DIR, { recursive: true });

  const meta = await sharp(SOURCE).metadata();
  if (CROP.left + CROP.width > meta.width || CROP.top + CROP.height > meta.height) {
    throw new Error(
      `Recorte ${JSON.stringify(CROP)} fora da imagem ${meta.width}×${meta.height}.`,
    );
  }

  console.log(`Logo: ${SOURCE} (${meta.width}×${meta.height})`);
  console.log(`Recorte da casa: ${JSON.stringify(CROP)}`);

  const houseBuffer = await sharp(SOURCE).extract(CROP).flatten({ background: BRAND_BG }).toBuffer();

  for (const output of OUTPUTS) {
    await renderIcon(houseBuffer, output);
  }

  // AppIcon leve: reduz o PNG de 512 px recém-gerado e grava em WebP.
  const appIconPng = resolve(ASSETS_DIR, 'app-icon.png');
  const appIconWebp = resolve(ASSETS_DIR, 'app-icon.webp');
  await sharp(appIconPng)
    .resize(APP_ICON_WEBP.size, APP_ICON_WEBP.size, { kernel: 'lanczos3' })
    .webp({ quality: APP_ICON_WEBP.quality, effort: 6, smartSubsample: true })
    .toFile(appIconWebp);
  console.log(`  ✓ ${appIconWebp.replace(frontendDir, 'frontend')} (${APP_ICON_WEBP.size}×${APP_ICON_WEBP.size})`);

  const logoFile = resolve(ASSETS_DIR, 'logo.webp');
  await sharp(SOURCE).resize({ width: LOGO_WIDTH }).webp({ quality: 90 }).toFile(logoFile);
  console.log(`  ✓ ${logoFile.replace(frontendDir, 'frontend')} (largura ${LOGO_WIDTH})`);
}

main().catch((error) => {
  console.error('Falha ao gerar os ícones:', error);
  process.exit(1);
});
