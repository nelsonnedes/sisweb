// Gera data/municipios-ibge.json a partir da API oficial do IBGE.
// Uso: node tools/fetch-municipios-ibge.mjs
// Re-gerar ~1x/ano (códigos IBGE são estáveis).
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const UFS = ['AC','AL','AP','AM','BA','CE','DF','ES','GO','MA','MT','MS','MG',
  'PA','PB','PR','PE','PI','RJ','RN','RS','RO','RR','SC','SP','SE','TO'];

const out = {};
for (const uf of UFS) {
  const res = await fetch(`https://servicodados.ibge.gov.br/api/v1/localidades/estados/${uf}/municipios`);
  if (!res.ok) throw new Error(`IBGE ${uf}: HTTP ${res.status}`);
  const arr = await res.json();
  out[uf] = arr
    .map((c) => ({ id: Number(c.id), nome: String(c.nome) }))
    .sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR'));
  console.log(`${uf}: ${out[uf].length} municípios`);
}

const root = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const dest = path.join(root, 'data', 'municipios-ibge.json');
fs.mkdirSync(path.dirname(dest), { recursive: true });
fs.writeFileSync(dest, JSON.stringify(out));
const total = Object.values(out).reduce((s, a) => s + a.length, 0);
console.log(`OK: ${total} municípios em ${dest} (${(fs.statSync(dest).size / 1024).toFixed(0)} KB)`);
