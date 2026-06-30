import { readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.resolve(__dirname, '..', '..');
const routesPath = path.join(__dirname, 'routes.full-training.generated.json');
const outputPath = path.join(projectRoot, 'assets', 'help-manual', 'help-gallery.generated.js');

const routes = JSON.parse(readFileSync(routesPath, 'utf8'));

function topicForRoute(route) {
  if (route === 'index.html' || route === 'login.html') return 'navegacao';
  if (route === 'company.html') return 'empresa';
  if (['client.html', 'fornecedor.html', 'species.html', 'importar_especies.html'].includes(route)) return 'cadastros';
  if (route === 'ajudabitolas.html') return 'romaneios';
  if (/^romaneio|^preromaneio/.test(route)) return 'romaneios';
  if (route === 'vendas.html') return 'vendas';
  if (route === 'compras.html') return 'compras';
  if (route === 'estoque.html') return 'estoque';
  if (route === 'financas.html') return 'financas';
  if (route === 'folha_pagamento/folha.html') return 'folha';
  if (['notas-fiscais.html', 'mdf-e.html'].includes(route)) return 'fiscal';
  if (['subscription-status.html', 'subscription.html'].includes(route)) return 'assinatura';
  if (route === 'user-profile.html') return 'perfil';
  if (route === 'ajuda.html') return 'suporte';
  return 'inicio';
}

function isUseful(route) {
  if (!route || route.path === 'oauth-callback.html') return false;
  return true;
}

const grouped = {};
for (const route of routes.filter(isUseful)) {
  const topic = topicForRoute(route.path);
  if (!grouped[topic]) grouped[topic] = [];
  grouped[topic].push({
    title: route.title || route.id,
    caption: 'Print real do layout em ambiente de treinamento, com dados fictícios.',
    image: `assets/help-manual/${route.id}.png`,
    alt: `Print sanitizado: ${route.title || route.id}`
  });
}

const payload = `// Arquivo gerado por tools/help-screenshots/build-help-gallery.mjs\nwindow.SISWEB_HELP_FULL_GALLERY = ${JSON.stringify(grouped, null, 2)};\n`;
writeFileSync(outputPath, payload, 'utf8');
console.log(`[gallery] ${outputPath}`);
console.log(JSON.stringify(Object.fromEntries(Object.entries(grouped).map(([key, value]) => [key, value.length])), null, 2));
