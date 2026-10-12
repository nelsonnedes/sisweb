import test from 'node:test';
import assert from 'node:assert';
import fs from 'node:fs';

// Destinatário + rascunhos NF-e (relatos 2026-10-11):
// botoes 38px, editar com cliente de rascunho, sem duplicar,
// excluir rascunho, natureza restaurada, carregar robusto.

const nf = fs.readFileSync('notas-fiscais.html', 'utf8');

test('destinatário: botoes e editar funcionam', async (t) => {  await t.test('botoes Novo/Editar 38px no desktop', () => {
    assert.ok(nf.includes('nf-cust-btn'), 'classe de padronização');
    assert.ok(nf.includes('height: 38px !important;'), 'altura 38px');
  });

  await t.test('editar resolve cliente de rascunho (opção temporária)', () => {
    assert.ok(nf.includes('opção temporária de rascunho'), 'fallback documentado');
    assert.ok(nf.includes('opt.dataset.cnpj'), 'usa dados da opção');
  });
});

test('rascunhos: sem duplicar, com excluir, natureza restaurada', async (t) => {
  await t.test('id do rascunho rastreado e preservado no save', () => {
    assert.ok(nf.includes('let _rascunhoEditandoId = null;'), 'estado declarado');
    assert.ok(nf.includes("_rascunhoEditandoId = modo === 'editar' ? nfId : null"), 'fixado na edição (nulo ao clonar)');
    assert.ok(nf.includes('if (_rascunhoEditandoId) nfeData.id = _rascunhoEditandoId;'),
      'save atualiza em vez de duplicar');
  });

  await t.test('clonar nota reutiliza a carga (modo clonar) e tem botão', () => {
    assert.ok(nf.includes('function clonarNotaNF'), 'função clonar');
    assert.ok(nf.includes("editarRascunho(nfId, 'clonar')"), 'delega com modo clonar');
    assert.ok(nf.includes('onclick="clonarNotaNF('), 'botão na lista');
    assert.ok(nf.includes('window.clonarNotaNF'), 'exposição global');
  });

  await t.test('inutilização reflete nas notas locais (status + filtro)', () => {
    assert.ok(nf.includes("inutilizada:['⛔ Inutilizada'"), 'pill de status');
    assert.ok(nf.includes('<option value="inutilizada">Inutilizada</option>'), 'filtro');
    assert.ok(nf.includes("atualizarStatus(tid, 55, n.id, 'inutilizada'"), 'marca a faixa');
  });

  await t.test('botão excluir rascunho com confirm danger', () => {
    assert.ok(nf.includes("onclick=\"excluirRascunhoNF('${n.id}')\""), 'botão na lista');
    assert.ok(nf.includes('window.excluirRascunhoNF'), 'exposição global');
    assert.ok(nf.includes("title: 'Excluir rascunho'"), 'confirm padronizado');
    assert.ok(nf.includes('removerNF(tid, 55, nfId)'), 'remove via storage');
  });

  await t.test('natureza visível sincronizada na edição', () => {
    assert.ok(nf.includes("getElementById('nfNatOpSelect')"), 'select sincronizado');
    assert.ok(nf.includes('nfAplicarNatOp(natSel)'), 'dependentes aplicados');
  });

  await t.test('carregar tenta 65 e distingue permissão', () => {
    assert.ok(nf.includes('carregarNF(tid, 65, nfId)'), 'fallback NFC-e');
    assert.ok(nf.includes('Sem permissão para ler rascunhos'), 'mensagem de permissão');
  });
});

test('certificado espelhado na config do validador', async (t) => {
  await t.test('upload sincroniza fiscal/config', () => {
    assert.ok(nf.includes('sincronizarCertificadoNaConfig(tid,'), 'upload sincroniza');
    assert.ok(nf.includes("saveConfigSection(tid, 'certificado'"), 'via seção segura');
    assert.ok(nf.includes('recarregarConfig'), 'config recarregada');
  });

  await t.test('boot reconcilia instalações antigas e remover limpa', () => {
    assert.ok(nf.includes('reconciliarCertificadoConfig(tid)'), 'reconciliação no init');
    assert.ok(nf.includes("tipo: null, titular: ''"), 'remoção limpa espelho');
  });
});

test('numeração única e aguardando com saída', async (t) => {
  await t.test('config sincroniza contador sem retroceder', () => {
    assert.ok(nf.includes('cfg.numeros = {'), 'contador na config salva');
    assert.ok(nf.includes('Math.max(desejado, atual'), 'nunca retrocede');
    assert.ok(nf.includes('para não duplicar número fiscal'), 'avisa ao manter');
    assert.ok(nf.includes('salvarNumeroInicial(tid, 55, alvo)'), 'grava direto no contador');
  });

  await t.test('aguardando/erro_envio têm Consultar SEFAZ', () => {
    assert.ok(nf.includes("onclick=\"consultarStatusSefazNF('${n.id}')\""), 'botão na lista');
    assert.ok(nf.includes('window.consultarStatusSefazNF'), 'exposição global');
    assert.ok(nf.includes('nf_consultarNFe'), 'usa function deployada');
    assert.ok(nf.includes('solicitarSenhaA1NF'), 'senha via modal próprio');
    assert.ok(nf.includes('window.promptDialog'), 'delega ao promptDialog central');
    assert.ok(nf.includes('status: \'autorizada\''), 'promove com protocolo');
  });
});

test('numeração: contador escrito direto e exportado', async (t) => {
  const sto = fs.readFileSync('nf-storage.js', 'utf8');
  await t.test('salvarNumeroInicial escreve no mesmo path que a emissão lê', () => {
    assert.ok(sto.includes('function salvarNumeroInicial'), 'definida');
    assert.ok(sto.includes('proximoNumero: Number(numero)'), 'aceita número');
    assert.ok(sto.includes("configPath(tenantId, `numeros/${modKey}`)"), 'mesmo path do contador');
    assert.ok(sto.includes('salvarNumeroInicial,'), 'exportada');
  });

  await t.test('IE do destinatário no XML e consulta pós-emissão', () => {
    assert.ok(nf.includes("ie,"), 'montarDestFromForm retorna ie');
    assert.ok(nf.includes('document.getElementById(\'nfClienteIE\')'), 'lê campo IE');
    assert.ok(nf.includes('montarInfoAdicionalNF'), 'infAdic inclui reboques');
    assert.ok(nf.includes("showTab('consulta')"), 'consulta após emissão');
    assert.ok(nf.includes('consultarNotas()'), 'recarrega após emissão');
    const xml = fs.readFileSync('nf-xml-builder.js', 'utf8');
    assert.ok(xml.includes('<IE>${esc(dest.ie)}</IE>'), 'XML inclui IE');
  });
});
