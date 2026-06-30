import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import assert from 'node:assert/strict';

const read = (path) => readFileSync(new URL(`../${path}`, import.meta.url), 'utf8');

test('resumo da folha formata valores como moeda BRL e limpa labels dos totais', () => {
  const folhaRelatorios = read('folha_pagamento/folha-relatorios.js');

  assert.match(folhaRelatorios, /const fmtMoedaResumo = \(valor\) =>/);
  assert.match(folhaRelatorios, /new Intl\.NumberFormat\('pt-BR', \{ style: 'currency', currency: 'BRL' \}\)\.format\(seguro\)/);
  assert.match(folhaRelatorios, /const val = \(typeof r\[k\] === 'number'\) \? fmtMoedaResumo\(r\[k\]\) : \(r\[k\] \|\| ''\)/);
  assert.match(folhaRelatorios, /const fmt = \(n\) => fmtMoedaResumo\(n\)/);
  assert.match(folhaRelatorios, /const v = fmtMoedaResumo\(totals\[k\] \|\| 0\)/);
  assert.match(folhaRelatorios, /const totalAcrescimosReal = selecionados\.reduce\(\(sum, r\) => sum \+ \(Number\(r\.totalAcrescimos\)\|\|0\), 0\)/);
  assert.match(folhaRelatorios, /const totalDescontosReal = selecionados\.reduce\(\(sum, r\) => sum \+ \(Number\(r\.totalDescontos\)\|\|0\), 0\)/);
  assert.match(folhaRelatorios, /const totalLiquidoReal = selecionados\.reduce\(\(sum, r\) => sum \+ \(Number\(r\.salarioLiquido\)\|\|0\), 0\)/);
  assert.match(folhaRelatorios, /const creditKeys = \['salarioBase','valorHorasExtras','bonificacoes','periculosidade','adicionalNoturno','insalubridade','salarioFamilia','premioAssiduidade','totalAcrescimos'\]/);
  assert.match(folhaRelatorios, /const neutralKeys = \['valorQuinzena'\]/);
  assert.doesNotMatch(folhaRelatorios, /const creditKeys = \[[^\]]*valorQuinzena/);
  assert.match(folhaRelatorios, /<div class="label">Total Acr\u00e9scimos<\/div>/);
  assert.match(folhaRelatorios, /<div class="label">Total Descontos<\/div>/);
  assert.match(folhaRelatorios, /\.total-card \{[^}]*gap: 12px;/);
  assert.match(folhaRelatorios, /\.total-card \.value \{[^}]*margin-left: 8px;[^}]*white-space: nowrap;/);
  assert.doesNotMatch(folhaRelatorios, /Total Acr\u00e9scimos \(selecionados\)/);
  assert.doesNotMatch(folhaRelatorios, /Total Descontos \(selecionados\)/);
});

test('folhas fechadas preserva filtro Mes/Ano ao recarregar apos estorno', () => {
  const folhaLancamentos = read('folha_pagamento/folha-lancamentos.js');

  assert.match(folhaLancamentos, /this\._folhasFechadasFiltrosAtivos = \{ mesAno: '', funcionario: '' \}/);
  assert.match(folhaLancamentos, /_getMesAnoPadraoFolhasFechadas\(\) \{[\s\S]*document\.getElementById\('mesAno'\)/);
  assert.match(folhaLancamentos, /_setFolhasFechadasFiltrosToDom\(\{[\s\S]*mesAno: this\._getMesAnoPadraoFolhasFechadas\(\)/);
  assert.match(folhaLancamentos, /loadFolhasFechadas\(opcoes = \{\}\) \{[\s\S]*opcoes\.aplicarFiltros \|\| this\._isFolhasFechadasModalAberto\(\)[\s\S]*this\._renderFolhasFechadasComFiltros/);
  assert.match(folhaLancamentos, /this\._folhasFechadasFiltrosAtivos = filtros;[\s\S]*this\._renderFolhasFechadasTable\(filtradas, mensagemVazia\)/);
  assert.match(folhaLancamentos, /if \(modal && modal\.style\.display === 'block' && typeof this\.filtrarFolhasFechadas === 'function'\) \{\s*this\.filtrarFolhasFechadas\(\);/);
  assert.doesNotMatch(folhaLancamentos, /if \(modal && modal\.style\.display === 'block' && typeof this\.loadFolhasFechadas === 'function'\) \{\s*this\.loadFolhasFechadas\(\);/);
});

test('folha mobile PWA nao deixa lancamentos escondidos se inicializacao atrasar', () => {
  const folhaUtils = read('folha_pagamento/folha-utils.js');
  const folhaMain = read('folha_pagamento/folha-main.js');

  assert.match(folhaUtils, /static ensureFolhaMainSectionsVisible\(\) \{/);
  assert.match(folhaUtils, /const tabelaSection = document\.getElementById\('tabela-folhas-section'\)/);
  assert.match(folhaUtils, /window\.getComputedStyle && window\.getComputedStyle\(el\)\.display === 'none'/);
  assert.match(folhaUtils, /if \(isHidden\(tabelaSection\)\) \{\s*tabelaSection\.style\.display = 'block';/);
  assert.match(folhaUtils, /if \(isHidden\(totaisSection\)\) \{\s*totaisSection\.style\.display = 'block';/);
  assert.match(folhaUtils, /FolhaUtils\.ensureFolhaMainSectionsVisible\(\);\s*const tbody = document\.getElementById\('folhasTableBody'\)/);
  assert.match(folhaMain, /mostrarSecoesPrincipaisFolha\(\) \{/);
  assert.match(folhaMain, /window\.FolhaUtils\.ensureFolhaMainSectionsVisible\(\);/);
  assert.match(folhaMain, /catch \(error\) \{[\s\S]*mostrarSecoesPrincipaisFolha\(\)/);
  assert.match(folhaMain, /window\.addEventListener\('tabelaFolhasRenderizada'[\s\S]*this\.mostrarSecoesPrincipaisFolha\(\);/);
});
