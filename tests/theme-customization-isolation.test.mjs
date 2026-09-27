import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const read = (rel) => fs.readFileSync(path.join(process.cwd(), rel), 'utf8');

test('Configurações de Tema: cobertura exaustiva de variáveis e categorias', () => {
  const themeJs = read('js/sisweb-theme.js');
  const tokensCss = read('styles/sisweb-tokens.css');

  // Verifica que todas as variáveis essenciais de detalhes estão em CUSTOM_VARS
  const expectedVars = [
    '--sw-brand',
    '--sw-brand-light',
    '--sw-brand-dark',
    '--sw-brand-soft',
    '--sw-on-brand',
    '--sw-focus',
    '--sw-bg',
    '--sw-surface',
    '--sw-surface-2',
    '--sw-border',
    '--sw-hover',
    '--sw-chrome-bg',
    '--sw-island-border',
    '--sw-island-ink',
    '--sw-island-muted',
    '--sw-island-icon',
    '--sw-island-link',
    '--sw-text-1',
    '--sw-text-2',
    '--sw-text-3',
    '--sw-label',
    '--sw-link',
    '--sw-input-bg',
    '--sw-input-border',
    '--sw-input-placeholder',
    '--sw-pill-ink',
    '--sw-pill-bg',
    '--sw-pill-border',
    '--sw-alert-bg',
    '--sw-alert-title',
    '--sw-alert-msg',
    '--sw-alert-link',
    '--sw-success',
    '--sw-warning',
    '--sw-danger',
    '--sw-info'
  ];

  for (const v of expectedVars) {
    assert.ok(themeJs.includes(`'${v}'`) || themeJs.includes(`"${v}"`), `CUSTOM_VARS deve conter a variável: ${v}`);
    assert.ok(tokensCss.includes(`${v}:`), `tokens.css deve conter a variável: ${v}`);
  }
});

test('Configurações de Tema: shiftLightness milimétrico e linear', () => {
  const themeJs = read('js/sisweb-theme.js');

  // Extrai a função shiftLightness de js/sisweb-theme.js para teste isolado
  const fnMatch = themeJs.match(/function shiftLightness\([\s\S]*?\n  \}/);
  assert.ok(fnMatch, 'função shiftLightness deve existir');

  const shiftLightness = new Function(`${fnMatch[0]}; return shiftLightness;`)();

  // 1. Delta 0 retorna o próprio hex
  assert.equal(shiftLightness('#fe6a00', 0), '#fe6a00');
  assert.equal(shiftLightness('#121417', 0), '#121417');

  // 2. Precisão milimétrica: variações microscópicas (0.5 / 0.1) alteram o hex sem deadzone
  const brandSubtlePlus = shiftLightness('#fe6a00', 0.5);
  assert.notEqual(brandSubtlePlus, '#fe6a00', 'Delta 0.5 na marca deve mudar o valor hex');
  assert.match(brandSubtlePlus, /^#[0-9a-f]{6}$/, 'Deve ser hex válido');

  const brandSubtleMinus = shiftLightness('#fe6a00', -0.5);
  assert.notEqual(brandSubtleMinus, '#fe6a00', 'Delta -0.5 na marca deve mudar o valor hex');

  const darkSubtlePlus = shiftLightness('#121417', 0.5);
  assert.notEqual(darkSubtlePlus, '#121417', 'Delta 0.5 no fundo escuro deve clarear');

  // 3. Limites de saturação e valores extremos não geram NaN nem erro
  assert.match(shiftLightness('#ffffff', -50), /^#[0-9a-f]{6}$/);
  assert.match(shiftLightness('#000000', 50), /^#[0-9a-f]{6}$/);
  assert.match(shiftLightness('#123456', 50), /^#[0-9a-f]{6}$/);
  assert.match(shiftLightness('#123456', -50), /^#[0-9a-f]{6}$/);
});

test('Configurações de Tema: isolamento estrito entre temas Claro e Escuro', () => {
  const themeJs = read('js/sisweb-theme.js');

  // Garante que o isolamento de reset e target existe no código
  assert.ok(themeJs.includes("custom[theme] = {};"), 'resetCustomVars por tema limpa exclusivamente o tema alvo');
  assert.ok(themeJs.includes("applyCustomTheme();"), 'applyCustomTheme re-executa a cada mudança de modo');
  assert.ok(themeJs.includes("root.style.removeProperty(key)"), 'applyCustomTheme limpa propriedades não customizadas do tema ativo');
  assert.ok(themeJs.includes("root.style.setProperty(key, custom[key])"), 'applyCustomTheme aplica exclusivamente as do tema ativo');
  assert.ok(themeJs.includes("updateBrandDerivatives"), 'derivados de marca atualizam automaticamente');
});

test('Configurações de Tema: menu do topo e dropdown seguem a Marca & Identidade', () => {
  const shellCss = read('styles/shell-theme.css');

  // Barra do menu em gradiente da marca com sombra da marca (bitemático)
  assert.ok(shellCss.includes('main-menu .sisweb-menu-shell {'), 'shell do menu existe');
  assert.match(shellCss, /sisweb-menu-shell \{[\s\S]*?background: var\(--sw-gradient\)/, 'fundo do menu = gradiente da marca');
  assert.match(shellCss, /sisweb-menu-shell \{[\s\S]*?box-shadow: var\(--sw-shadow-brand\)/, 'sombra do menu = sombra da marca');

  // Itens e triggers na tinta sobre a marca, hover translúcido + transição suave
  assert.match(shellCss, /menu-item \{[\s\S]*?color: var\(--sw-on-brand\)/, 'texto dos itens sobre a marca');
  assert.match(shellCss, /menu-item:hover,[\s\S]*?background: rgba\(255,\s*255,\s*255,\s*0\.16\)/, 'hover translúcido sobre a marca');

  // Item ativo = pílula sobre a marca com texto da marca
  assert.match(shellCss, /menu-item\.active,[\s\S]*?background: var\(--sw-on-brand\)/, 'ativo em pílula sobre a marca');
  assert.match(shellCss, /menu-item\.active,[\s\S]*?color: var\(--sw-brand\)/, 'texto do ativo na marca');

  // Dropdown legível com borda/sombra da marca e hover em fundo suave da marca
  assert.match(shellCss, /dropdown-content \{[\s\S]*?box-shadow: var\(--sw-shadow-brand\)/, 'sombra do dropdown na marca');
  assert.match(shellCss, /dropdown-content a:hover,[\s\S]*?background: var\(--sw-brand-soft\)/, 'hover do dropdown em fundo suave');
  assert.match(shellCss, /dropdown-content a:hover,[\s\S]*?color: var\(--sw-brand\)/, 'texto do hover na marca');
});

test('Configurações de Tema: opção ativa do Tema nunca fica invisível (pílula em gradiente)', () => {
  const shellCss = read('styles/shell-theme.css');

  // Ativo = pílula em gradiente da marca com tinta sobre a marca (legível em qualquer painel)
  assert.match(shellCss, /theme-option\.is-active \{[\s\S]*?background: var\(--sw-gradient\)/, 'ativo do Tema em gradiente');
  assert.match(shellCss, /theme-option\.is-active \{[\s\S]*?color: var\(--sw-on-brand\)/, 'texto do ativo sobre a marca');
  assert.match(shellCss, /theme-option\.is-active i \{[\s\S]*?color: var\(--sw-on-brand\)/, 'ícone do ativo sobre a marca');

  // Textos sobre fundos da marca usam a tinta global (nunca branco fixo)
  for (const [f, sel] of [
    ['folha_pagamento/folha.css', 'thead'],
    ['ajuda.html', '.manual-hero'],
    ['user-profile.html', '.profile-header'],
    ['company.html', 'button'],
    ['subscription-status.html', '.status-header']
  ]) {
    assert.ok(read(f).includes(sel), `${f} contém ${sel}`);
  }
  assert.match(read('folha_pagamento/folha.css'), /thead \{\r?\n\s*background-color: var\(--primary-color\);\r?\n\s*color: var\(--sw-on-brand\);/, 'thead da Folha na tinta global');
  assert.ok(!/\.theme-option\.is-active \{\s*\n?\s*color: var\(--sw-brand\);/.test(shellCss), 'sem texto marca-sobre-transparente no ativo');
});

test('Configurações de Tema: formulários e campos aplicam var(--sw-input-bg) bitematicamente', () => {
  const contentCss = read('styles/content-theme.css');

  // Verifica que inputs, selects e textareas aplicam var(--sw-input-bg) sob html[data-theme]
  assert.ok(contentCss.includes('html[data-theme] input:not([type="checkbox"])'), 'inputs cobertos bitematicamente');
  assert.ok(contentCss.includes('html[data-theme] select,'), 'selects cobertos bitematicamente');
  assert.ok(contentCss.includes('html[data-theme] textarea,'), 'textareas cobertos bitematicamente');
  assert.ok(contentCss.includes('background: var(--sw-input-bg) !important;'), 'fundo de input usa var(--sw-input-bg) com autoridade');
  assert.ok(contentCss.includes('border: 1px solid var(--sw-input-border) !important;'), 'borda de input usa var(--sw-input-border)');
  assert.ok(contentCss.includes('color: var(--sw-text-1) !important;'), 'texto de input usa var(--sw-text-1)');
  assert.ok(contentCss.includes('color: var(--sw-input-placeholder) !important;'), 'placeholder de input usa var(--sw-input-placeholder)');
});

