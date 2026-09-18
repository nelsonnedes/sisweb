import { existsSync, mkdirSync, readdirSync, statSync, writeFileSync, rmSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';

// Disable sharp file-cache to prevent file-locking on Windows
sharp.cache(false);

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

function safeWriteFileSync(targetPath, buffer, retries = 5) {
  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      writeFileSync(targetPath, buffer);
      return;
    } catch (err) {
      if (attempt === retries) throw err;
      const end = Date.now() + 150 * attempt;
      while (Date.now() < end) {}
    }
  }
}

for (const file of files) {
  const input = path.join(sourceDir, file);
  const optimizedPng = path.join(dryDir, file);
  const inputBuffer = readFileSync(input);
  const originalSize = inputBuffer.length;
  before += originalSize;

  const optimizedPngBuffer = await sharp(inputBuffer, { limitInputPixels: false })
    .png({
      compressionLevel: 9,
      effort: 10,
      palette: true,
      quality: 92,
      dither: 0
    })
    .toBuffer();

  safeWriteFileSync(optimizedPng, optimizedPngBuffer);
  const optimizedSize = optimizedPngBuffer.length;
  afterPng += Math.min(originalSize, optimizedSize);

  let webpSize = 0;
  if (webp) {
    const webpFile = path.join(sourceDir, file.replace(/\.png$/i, '.webp'));
    const candidateWebp = path.join(dryDir, file.replace(/\.png$/i, '.webp'));
    const candidateWebpBuffer = await sharp(inputBuffer, { limitInputPixels: false })
      .webp({ quality: 82, effort: 6, smartSubsample: true })
      .toBuffer();
    safeWriteFileSync(candidateWebp, candidateWebpBuffer);
    webpSize = candidateWebpBuffer.length;
    if (apply && webpSize < Math.min(originalSize, optimizedSize)) {
      safeWriteFileSync(webpFile, candidateWebpBuffer);
      afterWebp += webpSize;
    } else {
      if (existsSync(webpFile)) rmSync(webpFile, { force: true });
      afterWebp += Math.min(originalSize, optimizedSize);
    }
  }

  if (apply && optimizedSize < originalSize) {
    safeWriteFileSync(input, optimizedPngBuffer);
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
