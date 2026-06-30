import { existsSync, mkdirSync, readdirSync, statSync, copyFileSync, rmSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.resolve(__dirname, '..', '..');

const apply = process.argv.includes('--apply');
const webp = process.argv.includes('--webp') || process.env.SISWEB_OPTIMIZE_WEBP === '1';
const sourceDir = path.resolve(projectRoot, process.env.SISWEB_IMAGE_DIR || 'assets/help-manual');
const dryDir = path.resolve(projectRoot, process.env.SISWEB_OPTIMIZE_OUT_DIR || 'tmp/help-manual-optimized');

const fmt = (bytes) => `${(bytes / 1024).toFixed(1)} KB`;

if (!existsSync(sourceDir)) {
  throw new Error(`Diretorio nao encontrado: ${sourceDir}`);
}

const files = readdirSync(sourceDir).filter((file) => file.toLowerCase().endsWith('.png')).sort();
mkdirSync(dryDir, { recursive: true });

let before = 0;
let afterPng = 0;
let afterWebp = 0;
let changed = 0;

for (const file of files) {
  const input = path.join(sourceDir, file);
  const optimizedPng = path.join(dryDir, file);
  const originalSize = statSync(input).size;
  before += originalSize;

  await sharp(input, { limitInputPixels: false })
    .png({
      compressionLevel: 9,
      effort: 10,
      palette: true,
      quality: 92,
      dither: 0
    })
    .toFile(optimizedPng);

  const optimizedSize = statSync(optimizedPng).size;
  afterPng += Math.min(originalSize, optimizedSize);

  let webpSize = 0;
  if (webp) {
    const webpFile = path.join(sourceDir, file.replace(/\.png$/i, '.webp'));
    const candidateWebp = path.join(dryDir, file.replace(/\.png$/i, '.webp'));
    await sharp(input, { limitInputPixels: false })
      .webp({ quality: 82, effort: 6, smartSubsample: true })
      .toFile(candidateWebp);
    webpSize = statSync(candidateWebp).size;
    if (apply && webpSize < Math.min(originalSize, optimizedSize)) {
      copyFileSync(candidateWebp, webpFile);
      afterWebp += webpSize;
    } else {
      if (existsSync(webpFile)) rmSync(webpFile, { force: true });
      afterWebp += Math.min(originalSize, optimizedSize);
    }
  }

  if (apply && optimizedSize < originalSize) {
    copyFileSync(optimizedPng, input);
    changed += 1;
  }

  const parts = [`${file}: ${fmt(originalSize)} -> ${fmt(optimizedSize)}`];
  if (webp) parts.push(webpSize < Math.min(originalSize, optimizedSize) ? `webp ${fmt(webpSize)}` : 'webp descartado');
  if (apply && optimizedSize < originalSize) parts.push('aplicado');
  console.log(parts.join(' | '));
}

console.log(JSON.stringify({
  files: files.length,
  apply,
  pngChanged: changed,
  before: fmt(before),
  optimizedPngEstimate: fmt(afterPng),
  webpComparableTotal: webp ? fmt(afterWebp) : null
}, null, 2));
