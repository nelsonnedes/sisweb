import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';

const read = (path) => readFileSync(new URL(`../${path}`, import.meta.url), 'utf8');

test('company logo flow is Storage-first and does not persist new base64 payloads', () => {
  const companyHtml = read('company.html');
  const adminMain = read('scripts/admin/admin-main.js');
  const functionsIndex = read('functions/index.js');

  assert.match(companyHtml, /uploadCompanyLogo/);
  assert.match(companyHtml, /logoStoragePath/);
  assert.match(adminMain, /uploadCompanyLogo/);
  assert.match(adminMain, /logoStoragePath/);
  assert.doesNotMatch(companyHtml, /readFileAsDataURL|readAsDataURL/);
  assert.doesNotMatch(adminMain, /readFileAsDataURL|readAsDataURL/);
  assert.doesNotMatch(adminMain, /logoBase64\s*:/);
  assert.doesNotMatch(companyHtml, /salvando logo como base64/i);
  assert.doesNotMatch(companyHtml, /usando armazenamento local/i);
  assert.doesNotMatch(functionsIndex, /payload\.logoBase64|input\.logoBase64/);
});

test('company logo DataURL callable is tenant-scoped and avoids browser Storage CORS', () => {
  const functionsIndex = read('functions/index.js');
  const firebaseService = read('firebaseService.js');

  assert.match(functionsIndex, /function resolveDefaultStorageBucketName\(\)/);
  assert.match(functionsIndex, /function resolveDefaultDatabaseURL\(\)/);
  assert.match(functionsIndex, /process\.env\.FIREBASE_CONFIG/);
  assert.match(functionsIndex, /\$\{projectId\}\.firebasestorage\.app/);
  assert.match(functionsIndex, /adminAppOptions\.storageBucket = DEFAULT_STORAGE_BUCKET/);
  assert.match(functionsIndex, /adminAppOptions\.databaseURL = DEFAULT_DATABASE_URL/);
  assert.match(functionsIndex, /sisweb-7ce82-default-rtdb\.asia-southeast1\.firebasedatabase\.app/);
  assert.match(functionsIndex, /admin\.initializeApp\(Object\.keys\(adminAppOptions\)\.length \? adminAppOptions : undefined\)/);
  assert.match(functionsIndex, /exports\.getCompanyLogoDataUrl\s*=\s*https\.onCall/);
  assert.match(functionsIndex, /extractFirebaseStoragePathFromUrlServer/);
  assert.match(functionsIndex, /expectedPrefix = `companies\/\$\{companyId\}\/profile\/logo\/`/);
  assert.match(functionsIndex, /storagePath\.startsWith\(expectedPrefix\)/);
  assert.match(functionsIndex, /admin\.storage\(\)\.bucket\(\)\.file\(storagePath\)/);
  assert.match(functionsIndex, /Bucket de Storage não configurado para carregar logo da empresa/);
  assert.match(functionsIndex, /Falha ao baixar logo da empresa do Storage para impressão/);
  assert.match(functionsIndex, /console\.error\('Falha ao baixar logo da empresa do Storage'/);
  assert.match(functionsIndex, /contentType[\s\S]*image\\\/\(png\|jpe\?g\|webp\)/);
  assert.match(functionsIndex, /dataUrl: `data:\$\{contentType\};base64,\$\{buffer\.toString\('base64'\)\}`/);

  assert.match(firebaseService, /callFunction\('getCompanyLogoDataUrl'/);
  assert.match(firebaseService, /Logo da empresa indisponível pelo backend/);
});

test('storage rules allow tenant-scoped logo upload and delete without base64', () => {
  const rules = read('storage.rules');

  assert.match(rules, /match \/companies\/\{companyId\}\/profile\/logo\/\{fileName\}/);
  assert.match(rules, /request\.resource == null/);
  assert.match(rules, /request\.resource\.contentType\.matches\('image\/\.\*'\)/);
  assert.match(rules, /request\.auth\.token\.companyId == companyId/);
  assert.match(rules, /request\.auth\.token\.companyID == companyId/);
  assert.match(rules, /request\.auth\.token\.tenantId == companyId/);
});

test('company logo migration is explicit apply and cleanup guarded', () => {
  const migration = read('scripts/migrate-company-logos-to-storage.cjs');
  const pkg = JSON.parse(read('package.json'));

  assert.equal(pkg.scripts['migrate:company-logos'], 'node scripts/migrate-company-logos-to-storage.cjs');
  assert.match(migration, /--apply/);
  assert.match(migration, /--cleanup-base64/);
  assert.match(migration, /apply: false/);
  assert.match(migration, /cleanupBase64: false/);
  assert.match(migration, /firebaseStorageDownloadTokens/);
  assert.match(migration, /companies\/\$\{safeCompanyId\}\/profile\/logo\/migrated-/);
  assert.match(migration, /if \(!options\.apply\)/);
  assert.match(migration, /cleaned-existing-storage-base64/);
  assert.match(migration, /buildCleanupBase64Updates/);
});

test('fiscal files use Storage helpers without new base64 database fallback', () => {
  const storageService = read('storageService.js');
  const firebaseService = read('firebaseService.js');
  const nfStorage = read('nf-storage.js');
  const nfCert = read('nf-cert.js');
  const nfConfig = read('nf-config.js');
  const nfPreferencias = read('nf-preferencias.js');
  const notasFiscais = read('notas-fiscais.html');
  const rules = read('storage.rules');

  assert.match(firebaseService, /getBytes/);
  assert.match(firebaseService, /async function getStorageDataURL/);
  assert.match(firebaseService, /function extractFirebaseStoragePathFromUrl/);
  assert.match(firebaseService, /const storagePathFromUrl = extractFirebaseStoragePathFromUrl\(raw\)/);
  assert.match(firebaseService, /getBytes\(storageRef\(storage, safePath\), maxBytes\)/);
  assert.match(firebaseService, /async function callFunction/);
  assert.match(storageService, /async upload\(path, data, contentTypeOrOptions/);
  assert.match(storageService, /async download\(pathOrUrl\)/);
  assert.match(nfStorage, /async function carregarXML/);
  assert.match(notasFiscais, /storageService\.js/);
  assert.match(notasFiscais, /uploadFile/);
  assert.doesNotMatch(nfStorage, /salvando XML no DB|saveToFirebase\(\s*`companies\/\$\{tenantId\}\/fiscal\/xmls`/);
  assert.doesNotMatch(nfCert, /btoa\(String\.fromCharCode\(\.\.\.new Uint8Array\(encrypted\)\)\)/);
  assert.match(nfCert, /chamarCloudFunction\('nf_uploadCertificadoA1'/);
  assert.match(nfCert, /chamarCloudFunction\('nf_obterResumoCertificadoFiscal'/);
  assert.doesNotMatch(nfCert, /storageService\.upload/);
  assert.match(nfCert, /loadFromFirebase\(`companies\/\$\{tenantId\}\/fiscal\/certificado`\)/);
  assert.match(nfConfig, /callFunction\('nf_obterConfiguracaoFiscal'/);
  assert.match(nfConfig, /callFunction\('nf_salvarConfiguracaoFiscal'/);
  assert.match(nfConfig, /loadFromFirebase\(getConfigPath\(tenantId\)\)/);
  assert.doesNotMatch(nfConfig, /saveToFirebase\(/);
  assert.match(nfPreferencias, /window\.NFConfigService\.loadConfig/);
  assert.match(nfPreferencias, /window\.NFConfigService\.saveConfigSection/);
  assert.doesNotMatch(nfPreferencias, /loadFromFirebase\(/);
  assert.doesNotMatch(nfPreferencias, /saveToFirebase\(/);
  assert.match(rules, /match \/companies\/\{companyId\}\/fiscal\/\{allPaths=\*\*\}/);
  assert.match(rules, /match \/tenants\/\{tenantId\}\/certificados\/\{allPaths=\*\*\}/);
});

test('A3 token/card flow does not pretend browser auto-detection is enough', () => {
  const notasFiscais = read('notas-fiscais.html');
  const nfCert = read('nf-cert.js');
  const nfFunctions = read('functions/nf-functions.js');

  assert.match(notasFiscais, /A3 Token \/ Cartão \(requer ponte local\)/);
  assert.match(notasFiscais, /Verificar Ponte Local/);
  assert.doesNotMatch(notasFiscais, /Detecção Automática|Web Crypto API ou solicitará o PIN|certTokenPin|certTokenLib|certTokenSlot/);
  assert.doesNotMatch(notasFiscais, /subtle\.generateKey/);
  assert.match(nfCert, /verificarPonteA3Local/);
  assert.match(nfCert, /salvarReferenciaA3Token/);
  assert.match(nfCert, /ponte_local_requerida/);
  assert.match(nfFunctions, /A3 Token\/Cartão exige ponte local ou assinatura remota homologada/);
});

test('folha BH reports use batch reads and avoid heavy tenant localStorage cache', () => {
  const folhaRelatorios = read('folha_pagamento/folha-relatorios.js');
  const bhFirebase = read('folha_pagamento/banco-horas-firebase.js');
  const bhRelatorios = read('folha_pagamento/banco-horas-relatorios.js');
  const manager = read('folha_pagamento/folha-firebase-manager.js');

  assert.match(folhaRelatorios, /_bhFuncionarioChaves/);
  assert.match(folhaRelatorios, /gerarRelatorioExtratoBH[\s\S]*bhListLancamentosBatch/);
  assert.match(folhaRelatorios, /bh-extrato-report/);
  assert.match(folhaRelatorios, /bh-extrato-table/);
  assert.match(folhaRelatorios, /<colgroup>[\s\S]*width:18%[\s\S]*width:25%/);
  assert.match(folhaRelatorios, /Movimento <span class="th-sub">\(HH:MM\)<\/span>/);
  assert.match(folhaRelatorios, /Folhas fechadas removidas dos dados base do relatório/);
  assert.doesNotMatch(folhaRelatorios, /await window\.getData\(`companies\/\$\{tenantId\}`\)/);
  assert.doesNotMatch(bhRelatorios, /window\.getData\(`companies\/\$\{tenantId\}`\)/);

  assert.match(bhFirebase, /BH_LANCAMENTOS_BATCH_CACHE_TTL_MS/);
  assert.match(bhFirebase, /skipLocalStorage: true/);
  assert.match(bhFirebase, /bhRunLimited\(ids, 6/);
  assert.match(bhFirebase, /bhClearLancamentosBatchCache/);

  assert.match(manager, /skipLocalStorage = false/);
  assert.match(manager, /shouldSkipLocalStorage/);
  assert.ok(manager.includes('const rootCompanyPathPattern = /^companies\\/[^/]+$/;'));
  assert.match(manager, /payload-too-large/);
  assert.match(manager, /QuotaExceededError/);
});

test('folha generic reports allow print orientation and keep totals readable', () => {
  const folhaRelatorios = read('folha_pagamento/folha-relatorios.js');

  assert.match(folhaRelatorios, /id="relatorioOrientacaoImpressao"/);
  assert.match(folhaRelatorios, /getRelatorioPrintOptions/);
  assert.match(folhaRelatorios, /getRelatorioOrientationOverrideCSS/);
  assert.match(folhaRelatorios, /getRelatorioAdaptivePrintScript/);
  assert.match(folhaRelatorios, /data-print-orientation/);
  assert.match(folhaRelatorios, /omitPageSize/);
  assert.match(folhaRelatorios, /getReciboAutoFitStyles/);
  assert.match(folhaRelatorios, /getReciboAutoFitScript/);
  assert.match(folhaRelatorios, /--recibo-print-scale/);
  assert.match(folhaRelatorios, /--recibo-print-scale-portrait/);
  assert.match(folhaRelatorios, /--recibo-print-scale-landscape/);
  assert.match(folhaRelatorios, /Math\.min\(1, escalaW, escalaH\)/);
  assert.match(folhaRelatorios, /calcularAjusteParaOrientacao\(conteudo, pagina, getPageMetrics\(false\)\)/);
  assert.match(folhaRelatorios, /calcularAjusteParaOrientacao\(conteudo, pagina, getPageMetrics\(true\)\)/);
  assert.match(folhaRelatorios, /setRootVar\('--recibo-content-width-' \+ nome/);
  assert.match(folhaRelatorios, /removeRootVar\('--recibo-print-scale'\)/);
  assert.match(folhaRelatorios, /removeRootVar\('--recibo-content-width'\)/);
  assert.match(folhaRelatorios, /setInterval\(ajustarEscalaParaA4, 450\)/);
  assert.match(folhaRelatorios, /--fs-portrait/);
  assert.match(folhaRelatorios, /--fs-landscape/);
  assert.match(folhaRelatorios, /setInterval\(ajustarFonteRelatorio, 450\)/);
  assert.match(folhaRelatorios, /removeRootVar\('--fs'\)/);
  assert.match(folhaRelatorios, /this\.imprimirRelatorio\(relatorioHTML, titulo, tipoRelatorio, printOptions\)/);
  assert.match(folhaRelatorios, /this\.exportarPDF\(relatorioHTML, nomeArquivo, tipoRelatorio, printOptions\)/);
  assert.match(folhaRelatorios, /@page \{ size: A4 \$\{options\.orientation\}; margin: \$\{options\.margin\}; \}/);
  assert.match(folhaRelatorios, /relatorio-table tfoot td[\s\S]*text-overflow: clip/);
  assert.match(folhaRelatorios, /totais-table td[\s\S]*overflow: visible/);
  assert.match(folhaRelatorios, /window\.open\('', '_blank'\)/);
  assert.doesNotMatch(folhaRelatorios, /popup=yes/);

  const commonCssSection = folhaRelatorios.slice(
    folhaRelatorios.indexOf('getRelatorioCSS(printOptions = {})'),
    folhaRelatorios.indexOf('async gerarDemonstrativoIndividual')
  );
  assert.doesNotMatch(commonCssSection, /@media print and \(orientation: landscape\)[\s\S]*@page \{ size: A4 landscape/);
});

test('folha resumo selecionavel permite imprimir somente lancamentos em aberto', () => {
  const folhaRelatorios = read('folha_pagamento/folha-relatorios.js');

  assert.match(folhaRelatorios, /id="resumoSomenteAbertos"/);
  assert.match(folhaRelatorios, /somenteAbertos/);
  assert.match(folhaRelatorios, /const mesTela = document\.getElementById\('mesAno'\)/);
  assert.match(folhaRelatorios, /lancamentoContaNoResumo/);
  assert.match(folhaRelatorios, /selecionadosBase\.filter\(r => r\.contaNoResumo !== false\)/);
  assert.match(folhaRelatorios, /Filtro aplicado: exibindo apenas lançamentos em aberto/);
  assert.match(folhaRelatorios, /Total em Aberto/);
});

test('folha edit keeps lancamento identity and targets funcionario selection correctly', () => {
  const folhaLancamentos = read('folha_pagamento/folha-lancamentos.js');
  const folhaFuncionarios = read('folha_pagamento/folha-funcionarios.js');
  const folhaHtml = read('folha_pagamento/folha.html');

  assert.match(folhaLancamentos, /_ensureEditLancamentoIdentity/);
  assert.match(folhaLancamentos, /_resolveEditLancamentoId/);
  assert.match(folhaLancamentos, /this\._editLancamentoId = lancamento\.id \|\| lancamento\.key/);
  assert.match(folhaLancamentos, /this\._ensureEditLancamentoIdentity\(data\);[\s\S]*await window\.saveData\(`folhas\/\$\{data\.id\}`/);
  assert.match(folhaLancamentos, /_syncFuncionarioAtivoFlag/);

  assert.match(folhaFuncionarios, /_prepareFuncionarioSelectionTarget/);
  assert.match(folhaFuncionarios, /_isModalVisible\('folhaModal'\)[\s\S]*_setFuncionarioTargetField\('folhaFuncionario'\)/);
  assert.match(folhaFuncionarios, /filtroFechadasFuncionario/);
  assert.match(folhaFuncionarios, /event\.target === funcionarioAtivo/);
  assert.match(folhaHtml, /targetField = 'folhaFuncionario'/);
  assert.match(folhaHtml, /targetField = 'funcionarioFiltro'/);
});

test('login clears transient Firebase connection warnings after reconnect', () => {
  const login = read('login.html');
  const firebaseService = read('firebaseService.js');

  assert.match(firebaseService, /notifyConnectionChange/);
  assert.match(firebaseService, /sisweb:firebase-connection/);
  assert.match(firebaseService, /connected: isConnected/);
  assert.match(login, /function clearTransientConnectionWarnings/);
  assert.match(login, /hasExplicitMaintenanceContext/);
  assert.match(login, /window\.addEventListener\('sisweb:firebase-connection'/);
  assert.match(login, /event\.detail\.connected === true/);
  assert.match(login, /clearTransientConnectionWarnings\(\)/);
  assert.match(login, /hideMaintenanceMessage\(\);/);
});

test('NF-e transport and volumes flow to XML, validator and DANFE layout', () => {
  const notasFiscais = read('notas-fiscais.html');
  const nfService = read('nf-service.js');
  const nfConfig = read('nf-config.js');
  const nfStorage = read('nf-storage.js');
  const nfXmlBuilder = read('nf-xml-builder.js');
  const nfDanfe = read('nf-danfe.js');
  const nfValidator = read('nf-validator.js');
  const nfPreferencias = read('nf-preferencias.js');

  assert.match(notasFiscais, /id="nfTranspNome"/);
  assert.match(notasFiscais, /id="nfVeiculoPlaca"/);
  assert.match(notasFiscais, /id="nfVeiculoRNTC"/);
  assert.match(notasFiscais, /id="nfVolQVol"/);
  assert.match(notasFiscais, /id="nfVolLacres"/);
  assert.match(notasFiscais, /id="nfVolumesLista"/);
  assert.match(notasFiscais, /function adicionarVolumeNF/);
  assert.match(notasFiscais, /function removerVolumeNF/);
  assert.match(notasFiscais, /Dados da transportadora/);
  assert.match(notasFiscais, /Veículo e ANTT\/RNTC/);
  assert.match(notasFiscais, /Volumes e pesos/);
  assert.match(notasFiscais, /Quantidade de volumes não é quantidade comercial do item/);
  assert.match(notasFiscais, /function montarTransporteFromForm/);
  assert.match(nfService, /function normalizarTransporte/);
  assert.match(nfXmlBuilder, /function buildTransporta/);
  assert.match(nfXmlBuilder, /buildVeiculo\('veicTransp'/);
  assert.match(nfXmlBuilder, /<RNTC>\$\{rntc\}<\/RNTC>/);
  assert.match(nfXmlBuilder, /<qVol>\$\{qVol\}<\/qVol>/);
  assert.doesNotMatch(nfXmlBuilder, /3550308/);
  assert.match(nfDanfe, /TRANSPORTADOR \/ VOLUMES TRANSPORTADOS/);
  assert.match(nfDanfe, /CÓDIGO ANTT\/RNTC/);
  assert.match(nfDanfe, /PLACA DO VEÍCULO/);
  assert.match(nfDanfe, /lacresResumo/);
  assert.match(nfDanfe, /totalQVol/);
  assert.match(nfDanfe, /CODE128_PATTERNS/);
  assert.match(nfDanfe, /function drawCode128C/);
  assert.match(nfDanfe, /CHAVE DE ACESSO/);
  assert.match(nfDanfe, /CONTROLE DO FISCO/);
  assert.match(nfDanfe, /Consulta de autenticidade no portal nacional da NF-e/);
  assert.match(nfDanfe, /FATURAS/);
  assert.match(nfDanfe, /CÁLCULO DO ISSQN/);
  assert.match(nfDanfe, /RESERVADO AO FISCO/);
  assert.match(nfDanfe, /NCM\/SH/);
  assert.match(nfDanfe, /VLR\. UNIT\./);
  assert.match(nfDanfe, /ALÍQ\. IPI/);
  assert.match(nfDanfe, /function drawProdutosHeader/);
  assert.match(nfDanfe, /produtosMinBottom/);
  assert.match(nfDanfe, /function itemTaxValue/);
  assert.match(nfDanfe, /const codigoDanfe = String\(item\.nItem \|\| idx \+ 1\)/);
  assert.match(nfDanfe, /DANFE - CONTINUAÇÃO/);
  assert.match(nfDanfe, /function splitTextForWidth/);
  assert.match(nfDanfe, /maxDescLinesPerChunk/);
  assert.match(nfDanfe, /function parseNFeXmlToDanfeData/);
  assert.match(nfDanfe, /function normalizarNFeParaDANFE/);
  assert.match(nfDanfe, /function pickDanfeAssetFields/);
  assert.match(nfDanfe, /async function carregarLogoDANFE/);
  assert.match(nfDanfe, /async function prepararDANFEComAssets/);
  assert.match(nfDanfe, /DOMParser/);
  assert.match(nfValidator, /function validarTransporte/);
  assert.match(nfValidator, /function validarCodigoMunicipio/);
  assert.match(nfValidator, /function validarPlaca/);
  assert.match(nfValidator, /lacre \${lacIdx \+ 1} deve ter no máximo 60 caracteres/);
  assert.match(nfStorage, /carregarXML/);
  assert.match(nfService, /xmlStoragePath/);
  assert.match(nfService, /pickLogoFieldsFromCompany/);
  assert.match(nfService, /calcularIPI/);
  assert.match(nfConfig, /function calcularIPI/);
  assert.match(nfXmlBuilder, /function buildIPI/);
  assert.match(nfXmlBuilder, /vProd \+ vIPI - vDesc \+ vFrete/);
  assert.match(nfValidator, /somaItens \+ vIPI - vDesc \+ vFrete/);
  assert.match(notasFiscais, /NFStorage\.carregarXML\(tid, nfId/);
  assert.match(notasFiscais, /async function nfAplicarLogoEmpresaAoDanfe/);
  assert.match(notasFiscais, /nfResolveLogoUrlForDanfe/);
  assert.match(notasFiscais, /getStorageDataURL/);
  assert.match(notasFiscais, /source\?\.profile/);
  assert.match(nfPreferencias, /transportePadrao/);
  assert.match(nfPreferencias, /prefModFretePadrao/);
  assert.match(nfPreferencias, /NFConfigService\.saveConfigSection\(tenantId, 'preferencias'/);

  const serviceContext = { window: {}, console };
  vm.runInNewContext(nfService, serviceContext);
  const normalized = serviceContext.window.NFService.normalizarTransporte({
    transp: {
      modFrete: 1,
      transporta: {
        CNPJ: '07641300000107',
        xNome: 'JOANES NOBRE JOSE',
        IE: '241066859',
        xEnder: 'RUA JUVENAL MENDONCA, S/N',
        xMun: 'União dos Palmares',
        UF: 'AL',
      },
      veicTransp: { placa: 'QLD9056', UF: 'AL', RNTC: '044277243' },
      vol: [
        { qVol: '10', esp: 'Pacote', marca: 'SERRADA', pesoB: '10.000,000', pesoL: '9.500,000', lacres: ['LACRE-A'] },
        { qVol: '8', esp: 'Pacote', marca: 'SERRADA', pesoB: '9.000,000', pesoL: '8.500,000', lacres: ['LACRE-B', 'LACRE-C'] },
      ],
    },
  });
  assert.equal(normalized.modFrete, 1);
  assert.equal(normalized.veicTransp.placa, 'QLD9056');
  assert.equal(normalized.vol.length, 2);
  assert.equal(normalized.vol[0].pesoB, 10000);
  assert.equal(normalized.vol[1].lacres[1], 'LACRE-C');

  const configContext = { window: {}, console, structuredClone };
  vm.runInNewContext(nfConfig, configContext);
  const ipiCalc = configContext.window.NFConfigService.calcularIPI({
    empresa: { regime: 'lucroPresumido' },
    impostos: { ipi: { habilitado: true, cst: '99', aliquota: 5, cEnq: '999' } },
  }, 100);
  assert.equal(ipiCalc.cST, '99');
  assert.equal(ipiCalc.CST, '99');
  assert.equal(ipiCalc.cEnq, '999');
  assert.equal(ipiCalc.vBC, 100);
  assert.equal(ipiCalc.pIPI, 5);
  assert.equal(ipiCalc.vIPI, 5);
  assert.equal(configContext.window.NFConfigService.calcularIPI({
    empresa: { regime: 'simplesNacional' },
    impostos: { ipi: { habilitado: false, aliquota: 5 } },
  }, 100), null);

  const validatorContext = { window: {}, console };
  vm.runInNewContext(nfValidator, validatorContext);
  assert.equal(validatorContext.window.NFValidator.validarTransporte(normalized).valid, true);
  assert.equal(validatorContext.window.NFValidator.validarTransporte({
    modFrete: 1,
    vol: [{ qVol: '1', lacres: ['X'.repeat(61)] }],
  }).valid, false);
  assert.equal(validatorContext.window.NFValidator.validarCodigoMunicipio('1507607'), true);
  assert.equal(validatorContext.window.NFValidator.validarCodigoMunicipio('355030'), false);
  assert.equal(validatorContext.window.NFValidator.validarIde({
    mod: 55,
    serie: 1,
    nNF: 1,
    dhEmi: '2026-03-04T08:25:22-03:00',
    tpNF: 1,
    tpAmb: 2,
    cMunFG: '',
  }).valid, false);
  assert.equal(validatorContext.window.NFValidator.validarConfigParaEmissao({
    empresa: {
      cnpj: '18615107000100',
      razaoSocial: 'JN - IND COM EXP DE MADEIRAS LTDA',
      endereco: { uf: 'PA' },
    },
    certificado: { tipo: 'A1' },
  }).valid, false);

  const xmlContext = { window: {}, console };
  vm.runInNewContext(nfXmlBuilder, xmlContext);
  const totaisComIpi = xmlContext.window.NFXmlBuilder.calcularTotais([
    {
      vProd: 100,
      imposto: {
        icms: { vBC: 100, vICMS: 18 },
        pis: { vPIS: 0.65 },
        cofins: { vCOFINS: 3 },
        ipi: { vIPI: 5 },
      },
    },
  ], 0, 0);
  assert.equal(totaisComIpi.vIPI, 5);
  assert.equal(totaisComIpi.vNF, 105);
  assert.throws(() => xmlContext.window.NFXmlBuilder.buildNFeXML({
    ide: {
      mod: 55,
      serie: 1,
      nNF: 1666,
      dhEmi: '2026-03-04T08:25:22-03:00',
      tpNF: 1,
      tpAmb: 2,
      natOp: 'VENDA DE MERCADORIA',
      cMunFG: '1507607',
    },
    emit: {
      cnpj: '18615107000100',
      razaoSocial: 'JN - IND COM EXP DE MADEIRAS LTDA',
      ie: '154190837',
      crt: 3,
      endereco: { uf: 'PA', codigoMunicipio: '1507607', logradouro: 'TRAVESSA DOMINGOS MIRANDA CARNEIRO', numero: '02', municipio: 'São Miguel do Guamá', cep: '68660000' },
    },
    dest: {
      cnpj: '07641300000107',
      nome: 'JOANES NOBRE JOSE',
      endereco: { logradouro: 'RUA JUVENAL MENDONCA', numero: 'S/N', municipio: 'União dos Palmares', uf: 'AL', cep: '57800000' },
      indIEDest: 1,
    },
    det: [],
    total: { vProd: 0, vBC: 0, vICMS: 0, vPIS: 0, vCOFINS: 0, vDesc: 0, vFrete: 0, vNF: 0 },
    transp: { modFrete: 9 },
    pag: [{ tPag: '90', vPag: 0 }],
    infAdic: '',
  }), /Código IBGE do município do destinatário/);
  const { xml } = xmlContext.window.NFXmlBuilder.buildNFeXML({
    ide: {
      mod: 55,
      serie: 1,
      nNF: 1667,
      dhEmi: '2026-03-04T08:25:22-03:00',
      tpNF: 1,
      tpAmb: 2,
      natOp: 'VENDA DE MERCADORIA',
      cMunFG: '1507607',
    },
    emit: {
      cnpj: '18615107000100',
      razaoSocial: 'JN - IND COM EXP DE MADEIRAS LTDA',
      ie: '154190837',
      crt: 3,
      endereco: { uf: 'PA', codigoMunicipio: '1507607', logradouro: 'TRAVESSA DOMINGOS MIRANDA CARNEIRO', numero: '02', municipio: 'São Miguel do Guamá', cep: '68660000' },
    },
    dest: {
      cnpj: '07641300000107',
      nome: 'JOANES NOBRE JOSE',
      endereco: { logradouro: 'RUA JUVENAL MENDONCA', numero: 'S/N', municipio: 'União dos Palmares', uf: 'AL', cep: '57800000', codigoMunicipio: '2709303' },
      indIEDest: 1,
    },
    det: [],
    total: { vProd: 0, vBC: 0, vICMS: 0, vPIS: 0, vCOFINS: 0, vDesc: 0, vFrete: 0, vNF: 0 },
    transp: normalized,
    pag: [{ tPag: '90', vPag: 0 }],
    infAdic: '',
  });
  assert.match(xml, /<transporta><CNPJ>07641300000107<\/CNPJ>/);
  assert.match(xml, /<veicTransp><placa>QLD9056<\/placa><UF>AL<\/UF><RNTC>044277243<\/RNTC><\/veicTransp>/);
  assert.equal((xml.match(/<vol>/g) || []).length, 2);
  assert.match(xml, /<vol><qVol>10<\/qVol><esp>Pacote<\/esp><marca>SERRADA<\/marca><pesoL>9500\.000<\/pesoL><pesoB>10000\.000<\/pesoB><lacres><nLacre>LACRE-A<\/nLacre><\/lacres><\/vol>/);
  assert.match(xml, /<lacres><nLacre>LACRE-C<\/nLacre><\/lacres>/);
  const { xml: xmlIpi } = xmlContext.window.NFXmlBuilder.buildNFeXML({
    ide: {
      mod: 55,
      serie: 1,
      nNF: 1668,
      dhEmi: '2026-03-04T08:25:22-03:00',
      tpNF: 1,
      tpAmb: 2,
      natOp: 'VENDA DE MERCADORIA',
      cMunFG: '1507607',
    },
    emit: {
      cnpj: '18615107000100',
      razaoSocial: 'JN - IND COM EXP DE MADEIRAS LTDA',
      ie: '154190837',
      crt: 3,
      endereco: { uf: 'PA', codigoMunicipio: '1507607', logradouro: 'TRAVESSA DOMINGOS MIRANDA CARNEIRO', numero: '02', municipio: 'São Miguel do Guamá', cep: '68660000' },
    },
    dest: {
      cnpj: '07641300000107',
      nome: 'JOANES NOBRE JOSE',
      endereco: { logradouro: 'RUA JUVENAL MENDONCA', numero: 'S/N', municipio: 'União dos Palmares', uf: 'AL', cep: '57800000', codigoMunicipio: '2709303' },
      indIEDest: 1,
    },
    det: [{
      cProd: 'P1',
      xProd: 'MADEIRA SERRADA',
      ncm: '44079990',
      cfop: '5102',
      uCom: 'M3',
      qCom: 1,
      vUnCom: 100,
      vProd: 100,
      imposto: {
        icms: { cst: '00', orig: 0, modBC: 3, vBC: 100, pICMS: 18, vICMS: 18 },
        pis: { cST: '01', vBC: 100, pPIS: 0.65, vPIS: 0.65 },
        cofins: { cST: '01', vBC: 100, pCOFINS: 3, vCOFINS: 3 },
        ipi: { cST: '99', cEnq: '999', vBC: 100, pIPI: 5, vIPI: 5 },
      },
    }],
    total: totaisComIpi,
    transp: { modFrete: 9 },
    pag: [{ tPag: '90', vPag: 0 }],
    infAdic: '',
  });
  assert.match(xmlIpi, /<IPI><cEnq>999<\/cEnq><IPITrib><CST>99<\/CST><vBC>100\.00<\/vBC><pIPI>5\.00<\/pIPI><vIPI>5\.00<\/vIPI><\/IPITrib><\/IPI>/);
  assert.match(xmlIpi, /<vIPI>5\.00<\/vIPI>/);
  assert.match(xmlIpi, /<vNF>105\.00<\/vNF>/);

  class FakeDoc {
    constructor() {
      this.page = 1;
      this.pages = 1;
      this.calls = [];
      this.internal = { getNumberOfPages: () => this.pages };
    }
    setFillColor(...args) { this.calls.push({ type: 'setFillColor', args, page: this.page }); }
    setDrawColor(...args) { this.calls.push({ type: 'setDrawColor', args, page: this.page }); }
    setTextColor(...args) { this.calls.push({ type: 'setTextColor', args, page: this.page }); }
    setFontSize(size) { this.calls.push({ type: 'setFontSize', size, page: this.page }); }
    setFont(...args) { this.calls.push({ type: 'setFont', args, page: this.page }); }
    rect(x, y, w, h, style) { this.calls.push({ type: 'rect', x, y, w, h, style, page: this.page }); }
    text(text, x, y, options) { this.calls.push({ type: 'text', text: String(text), x, y, options, page: this.page }); }
    line(x1, y1, x2, y2) { this.calls.push({ type: 'line', x1, y1, x2, y2, page: this.page }); }
    addImage(...args) { this.calls.push({ type: 'addImage', args, page: this.page }); }
    addPage() { this.pages += 1; this.page = this.pages; this.calls.push({ type: 'addPage', page: this.page }); }
    setPage(page) { this.page = page; this.calls.push({ type: 'setPage', page }); }
  }

  const danfeContext = { window: { jspdf: { jsPDF: FakeDoc } }, console };
  vm.runInNewContext(nfDanfe, danfeContext);
  const fakeDoc = danfeContext.window.NFDanfe.gerarDANFE({
    chave: '15260318615107000100550010000016671252229617',
    numero: '1667',
    ide: {
      mod: 55,
      serie: 1,
      nNF: 1667,
      dhEmi: '2026-03-04T08:25:22-03:00',
      tpNF: 1,
      tpAmb: 2,
      natOp: 'VENDA DE MERCADORIA',
    },
    emit: {
      cnpj: '18615107000100',
      razaoSocial: 'JN - IND COM EXP DE MADEIRAS LTDA',
      logoDataUrl: 'data:image/png;base64,iVBORw0KGgo=',
      endereco: { logradouro: 'TRAVESSA DOMINGOS MIRANDA CARNEIRO', numero: '02', municipio: 'São Miguel do Guamá', uf: 'PA' },
    },
    dest: {
      cnpj: '07641300000107',
      nome: 'JOANES NOBRE JOSE',
      endereco: { logradouro: 'RUA JUVENAL MENDONCA', numero: 'S/N', municipio: 'União dos Palmares', uf: 'AL', cep: '57800000' },
    },
    det: Array.from({ length: 45 }, (_, index) => ({
      cProd: index === 0 ? 'MANUAL_1778273467922' : `P${index + 1}`,
      xProd: `MADEIRA SERRADA ${index + 1}`,
      ncm: '44079990',
      cfop: '5102',
      uCom: 'M3',
      qCom: 1,
      vUnCom: 100,
      vProd: 100,
      imposto: { icms: { vBC: 100, vICMS: 0, pICMS: 0 }, ipi: { vIPI: 0, pIPI: 0 } },
    })),
    total: { vProd: 4500, vBC: 0, vICMS: 0, vPIS: 0, vCOFINS: 0, vDesc: 0, vFrete: 0, vNF: 4500 },
    transp: normalized,
    pag: [{ tPag: '90', vPag: 0 }],
  });
  assert.ok(fakeDoc.calls.filter((call) => call.type === 'rect' && call.style === 'F' && call.h >= 8.5 && call.h <= 9.5).length > 30);
  assert.ok(fakeDoc.calls.filter((call) => call.type === 'rect' && call.style === 'S').length > 100);
  assert.ok(fakeDoc.calls.some((call) => call.type === 'text' && call.text.includes('CONTROLE DO FISCO')));
  assert.ok(fakeDoc.calls.some((call) => call.type === 'text' && call.text.includes('CÁLCULO DO IMPOSTO')));
  assert.ok(fakeDoc.calls.some((call) => call.type === 'text' && call.text.includes('TRANSPORTADOR / VOLUMES TRANSPORTADOS')));
  assert.ok(fakeDoc.calls.some((call) => call.type === 'addImage'));
  assert.ok(fakeDoc.calls.some((call) => call.type === 'text' && call.text === '1'));
  assert.ok(!fakeDoc.calls.some((call) => call.type === 'text' && call.text.includes('MANUAL_1778273467922')));
  assert.ok(fakeDoc.calls.some((call) => call.type === 'text' && call.text.includes('DANFE - CONTINUAÇÃO')));
  assert.ok(fakeDoc.calls.some((call) => call.type === 'text' && call.text.includes('DADOS DOS PRODUTOS / SERVIÇOS - CONTINUAÇÃO')));
});

test('NF-e emission screen uses guided steps and fiscal review before A1 password', () => {
  const notasFiscais = read('notas-fiscais.html');

  assert.match(notasFiscais, /id="nfStepper"/);
  assert.match(notasFiscais, /id="nfSummaryBar"/);
  assert.match(notasFiscais, /id="nfSummaryValidacao"/);
  assert.match(notasFiscais, /data-nf-step="operacao"/);
  assert.match(notasFiscais, /data-nf-step="destinatario"/);
  assert.match(notasFiscais, /data-nf-step="itens"/);
  assert.match(notasFiscais, /data-nf-step="transporte"/);
  assert.match(notasFiscais, /data-nf-step="pagamento"/);
  assert.match(notasFiscais, /data-nf-step="revisao"/);
  assert.match(notasFiscais, /id="nfReviewSection"/);
  assert.match(notasFiscais, /Revisão Fiscal/);
  assert.match(notasFiscais, /Confirmar revisão e informar senha/);
  assert.match(notasFiscais, /function irParaEtapaNF/);
  assert.match(notasFiscais, /function atualizarResumoFiscalNF/);
  assert.match(notasFiscais, /function registrarErroCampoNF/);
  assert.match(notasFiscais, /function renderizarRevisaoFiscal/);
  assert.match(notasFiscais, /async function liberarSenhaEmissao/);
  assert.match(notasFiscais, /function preencherDataEmissaoPadraoNF/);
  assert.match(notasFiscais, /document\.addEventListener\('DOMContentLoaded', \(\) => \{[\s\S]*preencherDataEmissaoPadraoNF\(\)/);
  assert.match(notasFiscais, /function limparFormularioNF\(\) \{[\s\S]*preencherDataEmissaoPadraoNF\(\)/);
  assert.match(notasFiscais, /classList\.add\('has-error'\)/);
  assert.match(notasFiscais, /className = 'field-error'/);
  assert.match(notasFiscais, /Prévia fiscal montada/);
  assert.match(notasFiscais, /_revisaoFiscalStatus\.errors/);
  assert.match(notasFiscais, /box\.style\.display = 'block'/);
  assert.match(notasFiscais, /editarClienteSelecionadoNF/);
  assert.match(notasFiscais, /nfEditClientModal/);
  assert.match(notasFiscais, /editarItemNF/);
  assert.match(notasFiscais, /nfEditItemModal/);
  assert.match(notasFiscais, /recalcularImpostosItemNF/);
  assert.match(notasFiscais, /abrirModalCartaCorrecaoNF/);
  assert.match(notasFiscais, /abrirModalInutilizacaoNF/);
  assert.match(notasFiscais, /nf_cartaCorrecaoNFe/);
  assert.match(notasFiscais, /nf_inutilizarNumeracao/);
  assert.match(notasFiscais, /Cloud Function nf_cartaCorrecaoNFe já foi implantada/);
});
