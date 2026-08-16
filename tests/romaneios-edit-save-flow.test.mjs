import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const read = (file) => fs.readFileSync(path.join(process.cwd(), file), 'utf8');

test('Fluxo de Edição e Salvamento de Romaneios em todas as 5 abas', async (t) => {

  await t.test('1. Pré-Romaneio: Lista -> Editar -> Salvar preservando ID', () => {
    const html = read('preromaneio.html');
    const modalsJs = read('preromaneio-modals.js');
    const preJs = read('preromaneio.js');

    // Botão de listar existe
    assert.match(html, /onclick="abrirLista\(\)"/, 'Botão Meus Romaneios deve chamar abrirLista');
    // Botão de editar na lista chama carregarPreRomaneio
    assert.match(modalsJs, /carregarPreRomaneio\('\$\{item\.id\}'\)/, 'Ação de editar na lista deve chamar carregarPreRomaneio com ID');
    // carregarPreRomaneio chama loadPreRomaneioData e fecha o modal
    assert.match(modalsJs, /loadPreRomaneioData\(item\)/, 'carregarPreRomaneio deve repassar item para loadPreRomaneioData');
    assert.match(modalsJs, /closeListaModal\(\)/, 'carregarPreRomaneio deve fechar o modal da lista');
    // loadPreRomaneioData preserva romaneioId e preRomaneioEmEdicao
    assert.match(preJs, /romaneioId = data\.id/, 'loadPreRomaneioData deve setar romaneioId');
    assert.match(preJs, /preRomaneioEmEdicao = data/, 'loadPreRomaneioData deve setar preRomaneioEmEdicao');
    // salvarPreRomaneio usa romaneioId existente para atualizar sem duplicar
    assert.match(preJs, /id:\s*romaneioId\s*\|\|\s*Date\.now\(\)\.toString\(\)/, 'salvarPreRomaneio deve manter o ID existente na edição');
  });

  await t.test('2. Romaneio TL: Lista -> Editar -> Salvar preservando ID e integridade financeira', () => {
    const html = read('romaneiotl.html');
    const listModalJs = read('modules/modals/modal-lista-romaneios.js');
    const saveJs = read('modules/romaneio/salvar-romaneio.js');

    // Botão de listar existe
    assert.match(html, /onclick="abrirListaRomaneios\(\)"/, 'Botão Listar deve chamar abrirListaRomaneios');
    // Botão de editar na lista chama editRomaneio
    assert.match(listModalJs, /editRomaneio\('\$\{romaneio\.id\}'\)/, 'Botão editar deve chamar editRomaneio com ID');
    // editRomaneio chama carregarRomaneioParaEdicao
    assert.match(listModalJs, /window\.SalvarRomaneio\.carregarRomaneioParaEdicao\(romaneioId,\s*romaneio\)/, 'editRomaneio deve acionar carregarRomaneioParaEdicao com dados pre-carregados');
    // carregarRomaneioParaEdicao define currentRomaneioId
    assert.match(saveJs, /currentRomaneioId = String\(/, 'carregarRomaneioParaEdicao deve definir currentRomaneioId');
    // salvarRomaneio preserva o ID e atualiza registro
    assert.match(saveJs, /const romaneioId = isEdicao \? currentRomaneioId : gerarIdRomaneio\(\)/, 'salvarRomaneio deve manter currentRomaneioId ao editar');
  });

  await t.test('3. Romaneio PCT: Lista -> Editar -> Salvar preservando ID', () => {
    const html = read('romaneiopct.html');
    const listModalJs = read('modules/romaneiopct/modal-lista-romaneios-pct.js');
    const loadJs = read('modules/romaneiopct/carregar-romaneio-pct.js');
    const tableJs = read('romaneiopct-tabela.js');

    // Botão de listar existe
    assert.match(html, /onclick="abrirListaRomaneios\(\)"/, 'Botão Listar deve chamar abrirListaRomaneios');
    // Botão de editar chama editRomaneio
    assert.match(listModalJs, /editRomaneio\('\$\{romaneio\.id\}'\)/, 'Botão editar deve chamar editRomaneio com ID');
    // editRomaneio chama window.carregarRomaneio
    assert.match(listModalJs, /window\.carregarRomaneio\(romaneioId,\s*null,\s*romaneio\)/, 'editRomaneio deve chamar carregarRomaneio com dados pre-carregados');
    // carregarRomaneio define window.romaneioEmEdicao
    assert.match(loadJs, /window\.romaneioEmEdicao = \{/, 'carregarRomaneio deve setar window.romaneioEmEdicao');
    // salvarRomaneio usa window.romaneioEmEdicao?.id
    assert.match(tableJs, /id:\s*window\.romaneioEmEdicao\?\.id\s*\|\|\s*generatedId/, 'salvarRomaneio deve usar id em edição');
  });

  await t.test('4. Romaneio PES: Lista -> Editar -> Salvar preservando ID', () => {
    const html = read('romaneiopes.html');

    // Botão de listar existe
    assert.match(html, /id="btnListar"/, 'Botão Listar deve existir');
    assert.match(html, /showRomaneiosList/, 'Função showRomaneiosList deve existir');
    // Botão de editar chama editRomaneio
    assert.match(html, /editRomaneio\(\$\{index\}\)/, 'Botão editar deve chamar editRomaneio com index');
    // editRomaneio seta romaneioEmEdicao
    assert.match(html, /romaneioEmEdicao = String\(alvo\.id\)/, 'editRomaneio deve setar romaneioEmEdicao com alvo.id');
    // Tabela de itens tem botão e função de editar item
    assert.match(html, /editarItem\(\$\{indexReal\}\)/, 'Tabela de itens deve renderizar botão de editar item');
    assert.match(html, /function editarItem\(index\)/, 'Função editarItem deve existir para carregar o item no formulário');
    // Modais de listagem têm loading reativo
    assert.match(html, /clientListLoading/, 'openClientListModal deve ter controle de carregamento reativo');
    // salvarRomaneio usa id de registroEmEdicao se existir
    assert.match(html, /id: \(registroEmEdicao && registroEmEdicao\.id\) \? String\(registroEmEdicao\.id\)/, 'salvarRomaneio deve manter o id existente');
  });

  await t.test('5. Romaneio Tora: Lista -> Editar -> Salvar preservando ID', () => {
    const html = read('romaneiotora.html');
    const managerJs = read('romaneio-manager.js');
    const tableJs = read('romaneiotora_tabela.js');

    // Botão de listar existe
    assert.match(html, /onclick="abrirListaRomaneios\(\)"/, 'Botão Listar deve chamar abrirListaRomaneios');
    // Botão de editar chama editarRomaneioTora
    assert.match(managerJs, /onclick="window\.editarRomaneioTora\(\$\{actionId\}\)"/, 'Botão editar deve chamar editarRomaneioTora');
    // editarRomaneioTora seta window.romaneioEditandoId
    assert.match(managerJs, /window\.romaneioEditandoId = romaneio\.id/, 'editarRomaneioTora deve setar window.romaneioEditandoId');
    // salvarRomaneio usa window.romaneioEditandoId se isEdicao
    assert.match(tableJs, /const isEdicao = window\.romaneioEditandoId/, 'salvarRomaneio deve identificar isEdicao');
    assert.match(tableJs, /const romaneioId = isEdicao \? window\.romaneioEditandoId : `TORA-\$\{timestamp\}`/, 'salvarRomaneio deve preservar o romaneioId na edição');
  });

});
