import {
  copyFileSync,
  existsSync,
  mkdirSync,
  readFileSync,
  rmSync,
  statSync,
} from 'node:fs';
import { dirname, isAbsolute, relative, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

const scriptDir = dirname(fileURLToPath(import.meta.url));
const projectDir = resolve(scriptDir, '..');
const outputDir = resolve(projectDir, 'hosting-dist');
const manifestPath = resolve(projectDir, 'hosting-files.json');

function assertInside(parent, candidate, label) {
  const relativePath = relative(parent, candidate);
  if (
    relativePath === '' ||
    relativePath === '..' ||
    relativePath.startsWith(`..${sep}`) ||
    isAbsolute(relativePath)
  ) {
    throw new Error(`${label} fora do diretorio permitido: ${candidate}`);
  }
}

const files = JSON.parse(readFileSync(manifestPath, 'utf8'));
if (!Array.isArray(files) || files.length === 0) {
  throw new Error('hosting-files.json deve conter uma lista nao vazia.');
}

if (outputDir !== resolve(projectDir, 'hosting-dist')) {
  throw new Error('Diretorio de saida inesperado.');
}

rmSync(outputDir, { recursive: true, force: true });
mkdirSync(outputDir, { recursive: true });

let totalBytes = 0;
for (const entry of files) {
  if (
    typeof entry !== 'string' ||
    entry.length === 0 ||
    entry.includes('\\') ||
    isAbsolute(entry)
  ) {
    throw new Error(`Entrada invalida no manifesto: ${String(entry)}`);
  }

  const source = resolve(projectDir, entry);
  const destination = resolve(outputDir, entry);
  assertInside(projectDir, source, 'Arquivo de origem');
  assertInside(outputDir, destination, 'Arquivo de destino');

  if (!existsSync(source) || !statSync(source).isFile()) {
    throw new Error(`Arquivo do Hosting nao encontrado: ${entry}`);
  }

  mkdirSync(dirname(destination), { recursive: true });
  copyFileSync(source, destination);
  totalBytes += statSync(source).size;
}

console.log(
  `Hosting preparado: ${files.length} arquivos, ${totalBytes} bytes em hosting-dist.`,
);
