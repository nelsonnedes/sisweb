import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import vm from 'node:vm';

const html = readFileSync('mdf-e.html', 'utf8');
const js = readFileSync('mdf-e.js', 'utf8');
const builder = readFileSync('mdfe-xml-builder.js', 'utf8');
const functions = readFileSync('functions/mdfe-functions.js', 'utf8');
const index = readFileSync('functions/index.js', 'utf8');

test('MDF-e usa somente o JS executável consolidado', () => {
  assert.match(html, /<script type="text\/plain" id="legacy-mdfe-implementation">/);
  assert.match(html, /<script src="mdf-e\.js\?v=[^"]+"><\/script>/);
  assert.match(js, /function showTab\(tabName, tabTrigger\)/);
  assert.doesNotMatch(js, /event\.target/);
  assert.match(html, /window\.firebaseService = \{ \.\.\.\(window\.firebaseService \|\| \{\}\), authService, isFirebaseOperational \};/);
});

test('MDF-e prepara consulta e documentos para cards mobile', () => {
  assert.match(html, /<table class="data-table mdfe-table">/);
  assert.match(html, /\.mdfe-table thead\s*\{[\s\S]*display: none/);
  assert.match(html, /\.nf-document-row > div::before\s*\{[\s\S]*content: attr\(data-label\)/);
  for (const label of ['Número', 'Série', 'Data', 'Placa', 'Condutor', 'UF origem/destino', 'Status', 'Ações']) {
    assert.match(js, new RegExp(`data-label="${label}"`), `rótulo ausente: ${label}`);
  }
});

test('MDF-e preserva a inicialização de estados e cidades', () => {
  assert.match(js, /function configurarLocalizacaoMdfe\(\)/);
  assert.match(js, /criarSelectEstados\(origemUf\.id/);
  assert.match(js, /criarSelectEstados\(destinoUf\.id/);
  assert.match(js, /popularCidades\(origemCidade\.id, uf\)/);
  assert.match(js, /popularCidades\(destinoCidade\.id, uf\)/);
});

test('MDF-e persiste por tenant no Firebase sem usar localStorage como fonte', () => {
  assert.match(js, /resolveAuthenticatedTenant\(\{ timeoutMs: 5000, reason: 'mdfe_init' \}\)/);
  assert.match(js, /companies\/\$\{tenantIdMdfe\}\/fiscal\/mdfe/);
  assert.match(js, /await svc\.saveToFirebase\(`companies\/\$\{tenantIdMdfe\}\/fiscal\/mdfe`/);
  assert.doesNotMatch(js, /localStorage\.getItem\(['"]mdfes['"]\)/);
  assert.doesNotMatch(js, /localStorage\.setItem\(['"]mdfes['"]/);
});

test('MDF-e gera XML modelo 58 com codigo IBGE e documentos vinculados', () => {
  assert.match(html, /mdfe-xml-builder\.js\?v=[0-9a-f]{12}/);
  assert.match(builder, /<MDFe xmlns=/);
  assert.match(builder, /<infMDFe Id="MDFe\$\{keyInfo\.chave\}" versao="3\.00">/);
  assert.match(builder, /<cMunCarrega>\$\{origemCode\}<\/cMunCarrega>/);
  assert.match(builder, /<chNFe>\$\{key\}<\/chNFe>/);
  assert.match(js, /obterCodigoMunicipioIBGE/);
  assert.match(html, /id="mdfeSenhaA1"/);
  assert.match(html, /id="mdfeSenhaA1Encerramento"/);
});

test('builder MDF-e produz chave de 44 dígitos e XML mínimo válido', () => {
  const context = { window: {} };
  vm.runInNewContext(builder, context);
  const result = context.window.MdfeXmlBuilder.buildMdfe({
    numero: 1,
    serie: '1',
    dataEmissao: '2026-08-27T10:00',
    ufInicio: 'SP',
    ufFim: 'RJ',
    municipioCarregamento: 'São Paulo',
    municipioDescarregamento: 'Rio de Janeiro',
    codigoMunicipioCarregamento: '3550308',
    codigoMunicipioDescarregamento: '3304557',
    veiculo: { placa: 'ABC1234', tara: 1000 },
    condutor: { nome: 'Motorista Teste', cpf: '11122233344' },
    documentos: [{ chave: '1'.repeat(44) }],
    valorTotal: 100,
    pesoTotal: 10,
    emit: {
      cnpj: '12345678000195',
      ie: '123456789',
      razaoSocial: 'Empresa Teste',
      endereco: { logradouro: 'Rua A', numero: '1', bairro: 'Centro', codigoMunicipio: '3550308', municipio: 'São Paulo', uf: 'SP' },
    },
  });
  assert.match(result.chave, /^\d{44}$/);
  assert.match(result.xml, /<mod>58<\/mod>/);
  assert.match(result.xml, /<cMunCarrega>3550308<\/cMunCarrega>/);
  assert.match(result.xml, /<chNFe>1{44}<\/chNFe>/);
});

test('MDF-e usa Functions fiscais sem expor certificado ou transmitir no navegador', () => {
  for (const name of ['mdfe_reservarNumero', 'mdfe_emitir', 'mdfe_consultar', 'mdfe_encerrar']) {
    assert.match(functions, new RegExp(`exports\\.${name}`));
    assert.match(index, new RegExp(`exports\\.${name}`));
  }
  assert.match(functions, /descriptografarPFXdoStorage/);
  assert.match(functions, /assinarXMLcomForge\(xml, pfx/);
  assert.match(functions, /MDFeRecepcaoSinc/);
  assert.match(functions, /MDFeRecepcaoEvento/);
  assert.match(functions, /MDFeConsulta/);
  assert.doesNotMatch(js, /pfx|encryptedPfx|privateKey/i);
  assert.doesNotMatch(js, /gerarProtocolo|gerarChaveAcesso|Simular chave/);
});
