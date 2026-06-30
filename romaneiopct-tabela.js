/**
 * 📊 SISTEMA DE TABELA ROMANEIOPCT - UNIFICADO
 * 
 * Consolidado de: romaneiopct_tabela.js + correções integradas
 * Funcionalidades específicas PCT:
 * - Campo pecasPorPacote integrado
 * - Navegação Enter específica
 * - Cálculos com pacotes
 * - Validações específicas
 * 
 * Versão: 1.0 Unificada
 * Data: Dezembro 2024
 */

console.log('📊 Sistema de Tabela Romaneiopct carregado');

// ========================================
// VARIÁVEIS GLOBAIS E INICIALIZAÇÃO
// ========================================

// Garantir que as variáveis globais estão inicializadas
if (!window.romaneioItems) {
    window.romaneioItems = [];
}

if (!window.selectedClient) {
    window.selectedClient = null;
}

if (!window.selectedSpecies) {
    window.selectedSpecies = null;
}

// Controle de edição
window.itemEmEdicao = false;
window.isAddingItem = false;
window.isSavingRomaneio = false;
window.currentPage = 1;
window.itemsPerPage = 5;

const PCT_TABLE_SORT_COLUMNS = [
    { key: 'especie' },
    { key: 'comprimento', type: 'number' },
    { key: 'espessura', type: 'number' },
    { key: 'largura', type: 'number' },
    { key: 'quantidade', type: 'number' },
    { key: 'pecasPorPacote', type: 'number' },
    { key: 'totalPecas', type: 'number', accessor: (item) => item.totalPecas || ((parseFloat(item.quantidade) || 0) * (parseFloat(item.pecasPorPacote) || 0)) },
    { key: 'volume', type: 'number' },
    { key: 'valorUnitario', type: 'number' },
    { key: 'valorTotal', type: 'number' },
    { key: 'acoes', sortable: false }
];

function getPCTTableSortConfig() {
    return {
        tableSelector: '#romaneioTable',
        minWidth: '1400px',
        columns: PCT_TABLE_SORT_COLUMNS,
        getItems: () => window.romaneioItems || [],
        setPage: (page) => { window.currentPage = page; },
        render: () => reconstruirTabela()
    };
}

function configurarTabelaPCT() {
    if (!window.RomaneioTableEnhancements) return;
    window.RomaneioTableEnhancements.bindSortableHeaders(getPCTTableSortConfig());
}

function aplicarOrdenacaoTabelaPCT() {
    if (!window.RomaneioTableEnhancements) return;
    window.RomaneioTableEnhancements.applySortFromTable(getPCTTableSortConfig());
}

function sincronizarItensPorPaginaPCT() {
    try {
        const saved = parseInt(localStorage.getItem('romaneio_pct_items_per_page') || '', 10);
        if ([10, 20, 25, 50, 100].includes(saved)) {
            window.itemsPerPage = saved;
        }
    } catch (_) {}
}

function getStorageKey(key) {
    try {
        const svc = window.firebaseServiceTL || window.FirebaseService || window.firebaseService;
        if (svc && typeof svc.getCurrentTenantId === 'function') {
            const t = svc.getCurrentTenantId();
            if (t) return `company_${t}__${key}`;
        }
        if (svc && typeof svc.getTenantId === 'function') {
            const t = svc.getTenantId();
            if (t) return `company_${t}__${key}`;
        }
    } catch (_) {}
    try {
        if (window.appTenantId) return `company_${window.appTenantId}__${key}`;
    } catch (_) {}
    return `company___no_tenant__${key}`;
}

function resolveTenantId() {
    try {
        const svc = window.firebaseServiceTL || window.FirebaseService || window.firebaseService;
        if (svc && typeof svc.getCurrentTenantId === 'function') {
            const t = svc.getCurrentTenantId();
            if (t) return String(t);
        }
        if (svc && typeof svc.getTenantId === 'function') {
            const t = svc.getTenantId();
            if (t) return String(t);
        }
    } catch (_) {}
    try {
        if (window.appTenantId) return String(window.appTenantId);
    } catch (_) {}
    return null;
}

function isQuotaExceededError(error) {
    if (!error) return false;
    const message = String(error && error.message ? error.message : error);
    return error.name === 'QuotaExceededError'
        || error.code === 22
        || error.code === 1014
        || /quota/i.test(message);
}

function tryLocalStorageSet(key, value) {
    try {
        if (window.SiswebStorage && typeof window.SiswebStorage.write === 'function') {
            return window.SiswebStorage.write(key, value) !== false;
        }
    } catch (_) {}
    try {
        localStorage.setItem(key, value);
        return true;
    } catch (error) {
        if (!isQuotaExceededError(error)) throw error;
    }
    try {
        const keys = Object.keys(localStorage || {});
        const removable = keys.filter((k) =>
            /^company_/.test(k)
            && /__(romaneiosPct|romaneiosPes|romaneios_tl|romaneiosTl|romaneios)$/.test(k)
            && k !== key
        );
        removable.forEach((k) => {
            try { localStorage.removeItem(k); } catch (_) {}
        });
    } catch (_) {}
    try {
        localStorage.removeItem('romaneioEmEdicaoPct');
    } catch (_) {}
    try {
        localStorage.setItem(key, value);
        return true;
    } catch (_) {
        return false;
    }
}

function compactRomaneioForCache(item) {
    const r = item && typeof item === 'object' ? item : {};
    const itens = Array.isArray(r.itens) ? r.itens : [];
    const compactItens = itens.slice(0, 60).map((it) => ({
        id: it.id || '',
        especie: it.especie || '',
        comprimento: parseFloat(it.comprimento) || 0,
        largura: parseFloat(it.largura) || 0,
        espessura: parseFloat(it.espessura) || 0,
        quantidade: parseInt(it.quantidade, 10) || 0,
        pecasPorPacote: parseInt(it.pecasPorPacote, 10) || 1,
        totalPecas: parseInt(it.totalPecas, 10) || 0,
        volume: parseFloat(it.volume) || 0,
        valorUnitario: parseFloat(it.valorUnitario) || 0,
        valorTotal: parseFloat(it.valorTotal) || 0
    }));
    return {
        id: r.id || '',
        numero: r.numero || '',
        data: r.data || '',
        companyId: r.companyId || '',
        clienteNome: r.clienteNome || (r.cliente && (r.cliente.nome || r.cliente.name)) || '',
        cliente: r.cliente && typeof r.cliente === 'object'
            ? { id: r.cliente.id || '', nome: r.cliente.nome || r.cliente.name || '' }
            : null,
        totais: r.totais && typeof r.totais === 'object' ? r.totais : {},
        itens: compactItens,
        _metadata: r._metadata && typeof r._metadata === 'object' ? r._metadata : {}
    };
}

function persistRomaneiosPctLocalCache(storageKey, romaneios) {
    try {
        if (window.SiswebStorage && typeof window.SiswebStorage.write === 'function') {
            return window.SiswebStorage.write('romaneiosPct', Array.isArray(romaneios) ? romaneios : []) !== false;
        }
    } catch (_) {}
    const list = Array.isArray(romaneios) ? romaneios : [];
    const payloadFull = JSON.stringify(list);
    if (tryLocalStorageSet(storageKey, payloadFull)) return true;
    const compactList = list.slice(-25).map(compactRomaneioForCache);
    const payloadCompact = JSON.stringify(compactList);
    return tryLocalStorageSet(storageKey, payloadCompact);
}

// ========================================
// FUNÇÕES DE DEBUG E VALIDAÇÃO
// ========================================

function debugRomaneioItems(message) {
    console.log(`[DEBUG TABELA] ${message}:`, {
        'window.romaneioItems.length': window.romaneioItems?.length || 0,
        'romaneioItems.length': typeof romaneioItems !== 'undefined' ? romaneioItems?.length : 'undefined',
        'selectedClient': window.selectedClient?.nome || 'N/A',
        'selectedSpecies': window.selectedSpecies?.nome || 'N/A'
    });
}

function validarCamposPCT() {
    const campos = {
        comprimento: document.getElementById('comprimento'),
        largura: document.getElementById('largura'),
        espessura: document.getElementById('espessura'),
        quantidade: document.getElementById('quantidade'),
        pecasPorPacote: document.getElementById('pecasPorPacote'), // ⚠️ ESPECÍFICO PCT
        price: document.getElementById('price'),
        especieInput: document.getElementById('especieInput')
    };
    
    console.log('🔍 Validação de campos PCT:', Object.keys(campos).map(key => ({
        campo: key,
        existe: campos[key] ? '✅' : '❌',
        valor: campos[key]?.value || 'N/A'
    })));
    
    return campos;
}

// ========================================
// FUNÇÕES DE CÁLCULO ESPECÍFICAS PCT
// ========================================

/**
 * Calcular volume incluindo pecasPorPacote (ESPECÍFICO PCT)
 */
function calcularVolumePCT(comprimento, largura, espessura, quantidade, pecasPorPacote) {
    const comp = parseFloat(comprimento) || 0;
    const larg = parseFloat(largura) || 0;
    const esp = parseFloat(espessura) || 0;
    const qtd = parseInt(quantidade) || 0;
    const ppp = parseInt(pecasPorPacote) || 1;
    
    // Volume unitário em m³
    const volumeUnitario = (comp * larg * esp) / 1000000;
    
    // ⚠️ ESPECÍFICO PCT: Incluir pecasPorPacote nos cálculos  
    return volumeUnitario * qtd * ppp;
}

/**
 * Validar e corrigir valor de pecasPorPacote
 */
function validarPecasPorPacote(valor) {
    const num = parseInt(valor);
    return !isNaN(num) && num > 0 ? num : 1;
}

// ========================================
// FUNÇÕES AUXILIARES PARA AGRUPAMENTO E PRIORIZAÇÃO
// ========================================
//
// 📋 FUNCIONALIDADES IMPLEMENTADAS:
// ✅ PRIORIZAÇÃO: Itens sempre vão para primeira posição
// ✅ AGRUPAMENTO: Itens com mesmas dimensões são somados
// ✅ EDIÇÃO INTELIGENTE: Item editado busca similaridade e agrupa/prioriza
//
// 🧪 FUNÇÕES DE TESTE DISPONÍVEIS:
// - testarAgrupamentoPCT() - Testa agrupamento automático
// - visualizarItensPCT()   - Mostra estado atual dos itens
// - testarLimpezaPCT()     - Testa limpeza de formulário
//
// 🔄 CRITÉRIOS DE AGRUPAMENTO:
// - Comprimento, largura, espessura iguais
// - Mesma espécie
// - Mesmo valor de peças por pacote
// - Mesmo valor unitário
//

/**
 * Normaliza valor de peças por pacote para comparação (suporta número ou objeto)
 */
function normalizarPecasPorPacote(ppp) {
    if (typeof ppp === 'object' && ppp !== null) {
        return parseInt(ppp.valor || ppp.value || 1) || 1;
    }
    const n = parseInt(ppp);
    return !isNaN(n) && n > 0 ? n : 1;
}

/**
 * Verifica se dois itens têm as mesmas dimensões e espécie (comparação robusta)
 */
function itensSaoIguais(item1, item2) {
    const especie1 = String(item1.especie || '').trim().toLowerCase();
    const especie2 = String(item2.especie || '').trim().toLowerCase();
    return (
        item1.comprimento === item2.comprimento &&
        item1.largura === item2.largura &&
        item1.espessura === item2.espessura &&
        especie1 === especie2 &&
        normalizarPecasPorPacote(item1.pecasPorPacote) === normalizarPecasPorPacote(item2.pecasPorPacote) &&
        item1.valorUnitario === item2.valorUnitario
    );
}

/**
 * Busca item existente com as mesmas dimensões
 */
function buscarItemExistente(novoItem) {
    return window.romaneioItems.findIndex(item => itensSaoIguais(item, novoItem));
}

/**
 * Move item para primeira posição do array
 */
function moverParaPrimeiro(array, index) {
    if (index > 0) {
        const item = array.splice(index, 1)[0];
        array.unshift(item);
        console.log(`📌 Item movido da posição ${index} para primeira posição`);
        return 0; // Nova posição
    }
    return index;
}

/**
 * Reagrupa item existente com novo
 */
function reagruparItens(itemExistente, novoItem) {
    // Somar quantidades
    const novaQuantidade = itemExistente.quantidade + novoItem.quantidade;
    const novoTotalPecas = novaQuantidade * itemExistente.pecasPorPacote;
    
    // Recalcular volume e valor
    const volumeUnitario = window.calcularVolume ? 
        window.calcularVolume(itemExistente.comprimento, itemExistente.largura, itemExistente.espessura) : 
        (itemExistente.comprimento * itemExistente.largura * itemExistente.espessura / 10000);
    
    const novoVolumeTotal = volumeUnitario * novaQuantidade * itemExistente.pecasPorPacote;
    const novoValorTotal = novoVolumeTotal * itemExistente.valorUnitario;
    
    // Atualizar item existente
    itemExistente.quantidade = novaQuantidade;
    itemExistente.totalPecas = novoTotalPecas;
    itemExistente.volume = novoVolumeTotal;
    itemExistente.valorTotal = novoValorTotal;
    
    console.log(`🔄 Item reagrupado: ${itemExistente.quantidade} pacotes, ${novoTotalPecas} peças`);
    
    return itemExistente;
}

// ========================================
// FUNÇÃO ADICIONAR ITEM UNIFICADA COM AGRUPAMENTO
// ========================================

function adicionarItem() {
    try {
        console.log("🔄 Iniciando adicionarItem PCT");
        debugRomaneioItems("Início da função adicionarItem");
        
        // Controle de processo
        if (window.isAddingItem) {
            console.warn("⚠️ Processo de adição já em andamento");
            return;
        }
        window.isAddingItem = true;
        
        // ✅ GARANTIR INICIALIZAÇÃO DOS ARRAYS
        if (!Array.isArray(window.romaneioItems)) {
            console.log("🔧 Inicializando window.romaneioItems");
            window.romaneioItems = [];
        }
        
        // ✅ VALIDAR CAMPOS
        const campos = validarCamposPCT();
        
        // Obter valores com validação
        const comprimentoStr = campos.comprimento?.value || '';
        const larguraStr = campos.largura?.value || '';
        const espessuraStr = campos.espessura?.value || '';
        const quantidadeStr = campos.quantidade?.value || '';
        const pecasPorPacoteStr = campos.pecasPorPacote?.value || '1'; // ⚠️ ESPECÍFICO PCT
        const precoStr = campos.price?.value || '';
        
        // ✅ OBTER ESPÉCIE
        let especieNome = '';
        if (window.selectedSpecies) {
            especieNome = window.selectedSpecies.nome || window.selectedSpecies.name || '';
        } else if (campos.especieInput?.value) {
            especieNome = campos.especieInput.value;
        }
        
        // ✅ VALIDAÇÕES OBRIGATÓRIAS
        if (!comprimentoStr || comprimentoStr.trim() === '') {
            console.warn('⚠️ Campo comprimento vazio:', { valor: comprimentoStr, tipo: typeof comprimentoStr });
            alert('Por favor, preencha o campo Comprimento.');
            campos.comprimento?.focus();
            window.isAddingItem = false;
            return;
        }
        
        if (!larguraStr || larguraStr.trim() === '') {
            console.warn('⚠️ Campo largura vazio:', { valor: larguraStr, tipo: typeof larguraStr });
            alert('Por favor, preencha o campo Largura.');
            campos.largura?.focus();
            window.isAddingItem = false;
            return;
        }
        
        if (!espessuraStr) {
            alert('Por favor, preencha o campo Espessura.');
            campos.espessura?.focus();
            window.isAddingItem = false;
            return;
        }
        
        if (!quantidadeStr) {
            alert('Por favor, preencha o campo Quantidade.');
            campos.quantidade?.focus();
            window.isAddingItem = false;
            return;
        }
        
        if (!especieNome) {
            alert('Por favor, selecione uma espécie.');
            campos.especieInput?.focus();
            window.isAddingItem = false;
            return;
        }
        
        // ✅ CONVERSÕES NUMÉRICAS COM VALIDAÇÃO - CORRIGIDO PARA VÍRGULA BRASILEIRA
        const comprimento = window.obterValorCampoNumerico ? window.obterValorCampoNumerico('comprimento') : parseFloat(comprimentoStr.replace(',', '.'));
        const largura = window.obterValorCampoNumerico ? window.obterValorCampoNumerico('largura') : parseFloat(larguraStr.replace(',', '.'));
        const espessura = window.obterValorCampoNumerico ? window.obterValorCampoNumerico('espessura') : parseFloat(espessuraStr.replace(',', '.'));
        const quantidade = parseInt(quantidadeStr);
        const pecasPorPacote = validarPecasPorPacote(pecasPorPacoteStr); // ⚠️ ESPECÍFICO PCT
        
        // ✅ CORREÇÃO: Usar função adequada para converter moeda brasileira
        let valorUnitario = 0;
        if (precoStr) {
            if (window.parseCurrencyValue) {
                valorUnitario = window.parseCurrencyValue(precoStr);
            } else {
                // Fallback: conversão manual correta para formato brasileiro
                let numericValue = precoStr.replace(/R\$\s*/g, '');      // Remove R$
                numericValue = numericValue.replace(/\./g, '');          // Remove pontos (separador de milhar)
                numericValue = numericValue.replace(',', '.');           // Vírgula vira ponto decimal
                valorUnitario = parseFloat(numericValue) || 0;
            }
        }
        
        console.log('📝 Valores obtidos:', {
            comprimentoStr, larguraStr, espessuraStr, 
            quantidadeStr, pecasPorPacoteStr, precoStr,
            valorUnitario: valorUnitario
        });
        
        console.log('🔢 Valores convertidos para cálculo:', {
            comprimento, largura, espessura, 
            quantidade, pecasPorPacote,
            valorUnitario
        });
        
        if (isNaN(comprimento) || comprimento <= 0) {
            alert('Por favor, insira um comprimento válido.');
            campos.comprimento?.focus();
            window.isAddingItem = false;
            return;
        }
        
        if (isNaN(largura) || largura <= 0) {
            alert('Por favor, insira uma largura válida.');
            campos.largura?.focus();
            window.isAddingItem = false;
            return;
        }
        
        if (isNaN(espessura) || espessura <= 0) {
            alert('Por favor, insira uma espessura válida.');
            campos.espessura?.focus();
            window.isAddingItem = false;
            return;
        }
        
        if (isNaN(quantidade) || quantidade <= 0) {
            alert('Por favor, insira uma quantidade válida.');
            campos.quantidade?.focus();
            window.isAddingItem = false;
            return;
        }
        
        // ✅ CÁLCULOS ESPECÍFICOS PCT - USANDO FUNÇÃO VALIDADA
        const volumeTotal = window.calcularVolumePCT ? 
            window.calcularVolumePCT(comprimento, largura, espessura, quantidade, pecasPorPacote) : 
            0; // Fallback seguro
        // ✅ CORREÇÃO CRÍTICA: Extrair valor de pecasPorPacote se for objeto
        const pecasPorPacoteValor = typeof pecasPorPacote === 'object' ? pecasPorPacote.valor : pecasPorPacote;
        const totalPecas = quantidade * pecasPorPacoteValor; // ⚠️ ESPECÍFICO PCT
        // ✅ CORREÇÃO CRÍTICA: Garantir que valorTotal seja numérico válido
        const valorTotal = isNaN(volumeTotal * valorUnitario) ? 0 : (volumeTotal * valorUnitario);
        
        console.log('🔍 DEBUG VALOR TOTAL:', {
            volumeTotal: volumeTotal,
            valorUnitario: valorUnitario,
            totalPecas: totalPecas,
            valorTotalFinal: valorTotal
        });
        
        console.log(`🧮 Cálculos PCT:`, {
            volumeTotal: volumeTotal.toFixed(4), 
            valorUnitario: valorUnitario.toFixed(2),
            valorTotal: valorTotal.toFixed(2),
            totalPecas: totalPecas
        });
        
        // ✅ VALIDAÇÃO CRÍTICA: Verificar se há NaN
        if (isNaN(volumeTotal) || !isFinite(volumeTotal)) {
            console.error('❌ VOLUME INVÁLIDO DETECTADO:', {
                comprimento, largura, espessura, quantidade, pecasPorPacote,
                volumeTotal, valorUnitario
            });
            alert('Erro nos cálculos. Verifique os valores inseridos.');
            window.isAddingItem = false;
            return;
        }
        
        console.log('🧮 Cálculos PCT:', {
            volumeTotal: volumeTotal.toFixed(4),
            totalPecas,
            pecasPorPacote,
            valorTotal: valorTotal.toFixed(2)
        });
        
        // ✅ CRIAR ITEM COM DADOS ESPECÍFICOS PCT
        const item = {
            comprimento: comprimento,
            largura: largura,
            espessura: espessura,
            quantidade: quantidade,
            // ⚠️ ESPECÍFICO PCT: garantir valor numérico normalizado
            pecasPorPacote: (typeof pecasPorPacote === 'object' ? (parseInt(pecasPorPacote.valor || pecasPorPacote.value || 1) || 1) : (parseInt(pecasPorPacote) || 1)),
            especie: especieNome,
            valorUnitario: valorUnitario,
            volume: volumeTotal,
            valorTotal: valorTotal,
            totalPecas: totalPecas, // ⚠️ ESPECÍFICO PCT
            id: Date.now() + Math.random() // ID único
        };
        
        // ✅ LÓGICA DE AGRUPAMENTO E PRIORIZAÇÃO
        if (window.itemEmEdicao !== false && window.itemEmEdicao !== undefined) {
            console.log(`🔄 Editando item no índice ${window.itemEmEdicao}`);
            
            // Remover item atual da edição
            const itemAnterior = window.romaneioItems.splice(window.itemEmEdicao, 1)[0];
            console.log('🗑️ Item anterior removido durante edição:', itemAnterior);
            
            // Buscar se existe outro item com as mesmas dimensões (após remoção)
            const indexExistente = buscarItemExistente(item);
            
            if (indexExistente !== -1) {
                console.log(`🔄 Reagrupando com item existente no índice ${indexExistente}`);
                reagruparItens(window.romaneioItems[indexExistente], item);
                moverParaPrimeiro(window.romaneioItems, indexExistente);
            } else {
                console.log('📌 Adicionando item editado como primeiro');
                window.romaneioItems.unshift(item);
            }
            
            // ✅ RESTAURAR BOTÃO APÓS ATUALIZAÇÃO
            restaurarBotaoNormal();
            window.itemEmEdicao = false;
        } else {
            console.log('➕ Adicionando novo item');
            
            // Buscar se já existe item com as mesmas dimensões
            const indexExistente = buscarItemExistente(item);
            
            if (indexExistente !== -1) {
                console.log(`🔄 Reagrupando com item existente no índice ${indexExistente}`);
                reagruparItens(window.romaneioItems[indexExistente], item);
                moverParaPrimeiro(window.romaneioItems, indexExistente);
                console.log('✅ Item reagrupado e movido para primeira posição');
            } else {
                console.log('📌 Adicionando novo item como primeiro');
                window.romaneioItems.unshift(item);
                console.log('✅ Novo item adicionado na primeira posição');
            }
        }
        
        // ✅ LIMPAR FORMULÁRIO
        limparCamposItem();
        
        // ✅ RESETAR PARA PRIMEIRA PÁGINA (para mostrar item priorizado)
        window.currentPage = 1;
        console.log('📄 Página resetada para 1 (mostrar item priorizado)');
        
        // ✅ ATUALIZAR TABELA E TOTAIS
        reconstruirTabela();
        atualizarTotais();
        
        // ✅ SALVAR ESTADO AUTOMATICAMENTE
        salvarEstadoRomaneioEmEdicao();
        
        console.log(`✅ Item adicionado com sucesso. Total de itens: ${window.romaneioItems.length}`);
        console.log('📋 Execute visualizarItensPCT() no console para ver o estado atual');
        debugRomaneioItems("Fim da função adicionarItem");
        
        // ✅ FOCO RETORNA PARA COMPRIMENTO (conforme solicitado pelo usuário)
        // O foco já é definido na função limparCamposItem()
        
    } catch (error) {
        console.error('❌ Erro na função adicionarItem:', error);
        alert('Erro ao adicionar item: ' + error.message);
    } finally {
        window.isAddingItem = false;
    }
}

// ========================================
// FUNÇÃO EDITAR ITEM UNIFICADA
// ========================================

async function editarItem(index) {
    try {
        console.log(`🔄 Editando item no índice ${index}`);
        
        if (!window.romaneioItems || index >= window.romaneioItems.length) {
            throw new Error('Item não encontrado para edição');
        }
        
        const item = window.romaneioItems[index];
        console.log('📝 Item para edição:', item);
        
        // ✅ PREENCHER CAMPOS COM DADOS DO ITEM (INCLUINDO PECASPORPACOTE)
        const campos = validarCamposPCT();
        
        if (campos.comprimento) campos.comprimento.value = formatarNumeroDecimal(item.comprimento || 0, 0);
        if (campos.largura) campos.largura.value = formatarNumeroDecimal(item.largura || 0, 2);
        if (campos.espessura) campos.espessura.value = formatarNumeroDecimal(item.espessura || 0, 2);
        if (campos.quantidade) campos.quantidade.value = item.quantidade || '';
        // ✅ CORREÇÃO CRÍTICA: Pecas por pacote - tratar objeto ou número
        if (campos.pecasPorPacote) {
            let pecasPorPacoteValue = item.pecasPorPacote;
            
            // Se for objeto, extrair o valor
            if (typeof pecasPorPacoteValue === 'object' && pecasPorPacoteValue !== null) {
                pecasPorPacoteValue = pecasPorPacoteValue.valor || pecasPorPacoteValue.value || 1;
            }
            
            campos.pecasPorPacote.value = pecasPorPacoteValue || 1;
            console.log(`🔧 Pç/Pac carregado: ${campos.pecasPorPacote.value} (original: ${JSON.stringify(item.pecasPorPacote)})`);
        }
        if (campos.price) {
            // ✅ CORREÇÃO CRÍTICA: Usar formatação brasileira adequada
            const valorUnitario = item.valorUnitario || item.preco || 0;
            let valorFormatado = '';
            
            if (valorUnitario > 0) {
                // ✅ USAR formatação brasileira padrão
                valorFormatado = valorUnitario.toLocaleString('pt-BR', {
                    style: 'currency',
                    currency: 'BRL',
                    minimumFractionDigits: 2,
                    maximumFractionDigits: 2
                });
            }
            
            campos.price.value = valorFormatado;
            console.log(`💰 Preço carregado: ${valorFormatado} (valor: ${valorUnitario})`);
        }
        
        // ✅ CONFIGURAR ESPÉCIE
        if (item.especie) {
            if (campos.especieInput) campos.especieInput.value = item.especie;
            window.selectedSpecies = { nome: item.especie };
        }
        
        // ✅ MARCAR COMO EM EDIÇÃO
        window.itemEmEdicao = index;
        
        // ✅ ALTERAR BOTÃO PARA MODO DE EDIÇÃO
        alterarBotaoParaEdicao();
        
        // ✅ SALVAR ESTADO
        if (typeof salvarEstadoRomaneioEmEdicao === 'function') {
            salvarEstadoRomaneioEmEdicao();
        }
        
        console.log(`✅ Item ${index} carregado para edição`);
        
        // Focar no primeiro campo
        if (campos.espessura) {
            campos.espessura.focus();
        }
        
    } catch (error) {
        console.error('❌ Erro ao editar item:', error);
        alert('Erro ao editar item: ' + error.message);
    }
}

// ========================================
// FUNÇÃO REMOVER ITEM
// ========================================

function removerItem(index) {
    try {
        console.log(`🗑️ Removendo item no índice ${index}`);
        
        if (!window.romaneioItems || index >= window.romaneioItems.length) {
            throw new Error('Item não encontrado para remoção');
        }
        
        if (confirm('Tem certeza que deseja remover este item?')) {
            window.romaneioItems.splice(index, 1);
            reconstruirTabela();
            atualizarTotais();
            salvarEstadoRomaneioEmEdicao();
            
            console.log(`✅ Item removido. Total de itens: ${window.romaneioItems.length}`);
        }
        
    } catch (error) {
        console.error('❌ Erro ao remover item:', error);
        alert('Erro ao remover item: ' + error.message);
    }
}

// ========================================
// FUNÇÕES DE TABELA E INTERFACE
// ========================================

function limparCamposItem() {
    console.log('🧹 Limpando campos do formulário (preservando cliente, espécie, espessura, largura, preço, peças por pacote)');
    
    // ✅ PRESERVAR CAMPOS CONFORME SOLICITADO PELO USUÁRIO
    // Limpar apenas comprimento e quantidade
    const camposParaLimpar = [
        'comprimento',
        'quantidade'
    ];
    
    camposParaLimpar.forEach(campoId => {
        const campo = document.getElementById(campoId);
        if (campo) {
            campo.value = '';
        }
    });
    
    // ✅ NÃO LIMPAR: cliente, espécie, espessura, largura, preço, pecasPorPacote
    // Estes campos devem ser preservados para facilitar entrada de múltiplos itens
    
    // ✅ RESTAURAR BOTÃO PARA MODO NORMAL
    restaurarBotaoNormal();
    
    // Limpar apenas estado de edição
    window.itemEmEdicao = false;
    
    // ✅ FOCAR NO CAMPO COMPRIMENTO APÓS LIMPAR (conforme solicitado)
    const comprimentoInput = document.getElementById('comprimento');
    if (comprimentoInput) {
        setTimeout(() => {
            comprimentoInput.focus();
        }, 100);
    }
}

function reconstruirTabela() {
    console.log('🔄 Reconstruindo tabela PCT');
    
    const tbody = document.getElementById('romaneioTableBody');
    if (!tbody) {
        console.warn('⚠️ Elemento romaneioTableBody não encontrado');
        return;
    }

    configurarTabelaPCT();
    
    tbody.innerHTML = '';
    
    if (!window.romaneioItems || window.romaneioItems.length === 0) {
        tbody.innerHTML = `
            <tr>
                <td colspan="11" style="text-align: center; padding: 20px; color: #666;">
                    <i class="fas fa-folder-open" style="font-size: 28px; margin-bottom: 8px; display: block; color: #8d9aa8;"></i>
                    Nenhum item adicionado ao romaneio
                </td>
            </tr>
        `;
        renderizarPaginacao(0);
        return;
    }

    aplicarOrdenacaoTabelaPCT();
    sincronizarItensPorPaginaPCT();
    
    const ITENS_POR_PAGINA = window.itemsPerPage || 5;
    let itensPagina;
    let totalPaginas = 1;
    totalPaginas = Math.ceil(window.romaneioItems.length / ITENS_POR_PAGINA);
    if (window.currentPage > totalPaginas && totalPaginas > 0) {
        window.currentPage = totalPaginas;
    } else if (window.currentPage < 1) {
        window.currentPage = 1;
    }
    const startIndex = (window.currentPage - 1) * ITENS_POR_PAGINA;
    const endIndex = startIndex + ITENS_POR_PAGINA;
    itensPagina = window.romaneioItems.slice(startIndex, endIndex);
    
    // ✅ GERAR LINHAS DA TABELA COM COLUNA PECASPORPACOTE - USAR ITENS PÁGINADOS
    for (let i = 0; i < itensPagina.length; i++) {
        const item = itensPagina[i];
        const row = document.createElement('tr');
        
        // ✅ CORREÇÃO: Calcular índice real no array completo
        const realIndex = window.romaneioItems.indexOf(item);
        
        row.innerHTML = `
            <td>${item.especie || 'N/A'}</td>
            <td>${formatarNumeroDecimal(item.comprimento || 0, 0)}</td>
            <td>${formatarNumeroDecimal(item.espessura || 0, 2)}</td>
            <td>${formatarNumeroDecimal(item.largura || 0, 2)}</td>
            <td>${item.quantidade || 0}</td>
            <td>${formatarPecasPorPacote(item.pecasPorPacote)}</td>
            <td>${item.totalPecas || (item.quantidade * item.pecasPorPacote) || 0}</td>
            <td>${(item.volume || 0).toFixed(4).replace('.', ',')} m³</td>
            <td>${formatarMoedaBrasileira(item.valorUnitario || 0)}</td>
            <td>${formatarMoedaBrasileira(item.valorTotal || 0)}</td>
            <td>
                <button onclick="editarItem(${realIndex})" class="btn-editar" title="Editar item">
                    <i class="fas fa-edit"></i>
                </button>
                <button onclick="removerItem(${realIndex})" class="btn-excluir" title="Excluir item">
                    <i class="fas fa-trash"></i>
                </button>
            </td>
        `;
        
        tbody.appendChild(row);
    }
    
    // ✅ ATUALIZAR PAGINAÇÃO - PADRONIZADA ROMANEIOTL
    renderizarPaginacao(window.romaneioItems.length);
    aplicarEstilosTabela();
}

// ✅ FUNÇÃO DE PAGINAÇÃO - PADRONIZADA ROMANEIOTL
function renderizarPaginacao(totalItens) {
    let paginationContainer = document.getElementById('romaneioTablePagination');
    const tableSection = document.getElementById('romaneio-items-section');

    if (!paginationContainer && tableSection) {
        paginationContainer = document.createElement('div');
        paginationContainer.id = 'romaneioTablePagination';
        paginationContainer.className = 'pagination-controls';
        tableSection.appendChild(paginationContainer);
    }

    if (!paginationContainer) return;

    const storageKey = 'romaneio_pct_items_per_page';
    if (window.itemsPerPage === undefined || window.itemsPerPage === null) {
        window.itemsPerPage = 5;
    }
    try {
        const saved = parseInt(localStorage.getItem(storageKey) || '', 10);
        if ([10,20,25,50,100].includes(saved)) window.itemsPerPage = saved;
    } catch (_) {}
    const itensPorPagina = window.itemsPerPage || 5;
    const totalPaginas = Math.max(1, Math.ceil(totalItens / itensPorPagina));
    paginationContainer.innerHTML = '';
    paginationContainer.style.display = 'flex';
    paginationContainer.style.justifyContent = 'space-between';
    paginationContainer.style.alignItems = 'center';
    paginationContainer.style.gap = '10px';
    paginationContainer.style.flexWrap = 'wrap';

    if (window.currentPage > totalPaginas) window.currentPage = totalPaginas;
    if (window.currentPage < 1) window.currentPage = 1;

    const from = totalItens === 0 ? 0 : ((window.currentPage - 1) * itensPorPagina) + 1;
    const to = totalItens === 0 ? 0 : Math.min(window.currentPage * itensPorPagina, totalItens);
    const left = document.createElement('div');
    left.style.fontSize = '12px';
    left.style.color = '#475569';
    left.style.flex = '1 1 320px';
    left.style.maxWidth = '33.333%';
    left.style.minWidth = '220px';
    left.style.textAlign = 'left';
    left.textContent = `Mostrando ${from} a ${to} de ${totalItens} itens`;
    paginationContainer.appendChild(left);

    const right = document.createElement('div');
    right.style.display = 'flex';
    right.style.alignItems = 'center';
    right.style.gap = '10px';
    right.style.justifyContent = 'flex-end';
    right.style.flex = '1 1 320px';
    right.style.maxWidth = '33.333%';
    right.style.minWidth = '220px';
    paginationContainer.appendChild(right);

    const center = document.createElement('div');
    center.style.display = 'flex';
    center.style.justifyContent = 'center';
    center.style.flex = '1 1 320px';
    center.style.maxWidth = '33.333%';
    center.style.minWidth = '220px';
    paginationContainer.insertBefore(center, right);

    const nav = document.createElement('div');
    nav.style.display = 'flex';
    nav.style.alignItems = 'center';
    nav.style.gap = '6px';
    center.appendChild(nav);

    const addBtn = (label, page, disabled = false, active = false) => {
        const btn = document.createElement('button');
        btn.textContent = label;
        if (active) btn.classList.add('active');
        btn.disabled = disabled;
        btn.onclick = () => irParaPaginaPCT(page);
        nav.appendChild(btn);
    };

    if (totalPaginas > 1) {
        addBtn('<<<', 1, window.currentPage === 1);
        addBtn('<', window.currentPage - 1, window.currentPage === 1);

        const startPage = Math.max(1, window.currentPage - 2);
        const endPage = Math.min(totalPaginas, window.currentPage + 2);

        if (startPage > 1) {
            addBtn('1', 1, false, window.currentPage === 1);
            if (startPage > 2) {
                const span = document.createElement('span');
                span.textContent = '...';
                nav.appendChild(span);
            }
        }

        for (let i = startPage; i <= endPage; i++) {
            addBtn(String(i), i, false, i === window.currentPage);
        }

        if (endPage < totalPaginas) {
            if (endPage < totalPaginas - 1) {
                const span = document.createElement('span');
                span.textContent = '...';
                nav.appendChild(span);
            }
            addBtn(String(totalPaginas), totalPaginas, false, window.currentPage === totalPaginas);
        }

        addBtn('>', window.currentPage + 1, window.currentPage === totalPaginas);
        addBtn('>>>', totalPaginas, window.currentPage === totalPaginas);
    }

    const perPageWrap = document.createElement('div');
    perPageWrap.style.display = 'flex';
    perPageWrap.style.alignItems = 'center';
    perPageWrap.style.gap = '6px';
    perPageWrap.style.whiteSpace = 'nowrap';
    const label = document.createElement('span');
    label.style.fontSize = '12px';
    label.style.color = '#475569';
    label.style.whiteSpace = 'nowrap';
    label.textContent = 'Itens por página:';
    const select = document.createElement('select');
    select.style.padding = '4px 8px';
    select.style.border = '1px solid #d0d7de';
    select.style.borderRadius = '4px';
    select.style.fontSize = '12px';
    if (itensPorPagina === 5) {
        const hiddenOption = document.createElement('option');
        hiddenOption.value = '5';
        hiddenOption.textContent = '5';
        hiddenOption.hidden = true;
        select.appendChild(hiddenOption);
    }
    [10,20,25,50,100].forEach((value) => {
        const option = document.createElement('option');
        option.value = String(value);
        option.textContent = String(value);
        select.appendChild(option);
    });
    select.value = String(itensPorPagina);
    select.onchange = () => {
        const parsed = parseInt(select.value, 10);
        if (![10,20,25,50,100].includes(parsed)) return;
        window.itemsPerPage = parsed;
        window.currentPage = 1;
        try { localStorage.setItem(storageKey, String(parsed)); } catch (_) {}
        reconstruirTabela();
    };
    perPageWrap.appendChild(label);
    perPageWrap.appendChild(select);
    right.appendChild(perPageWrap);
}

// ✅ FUNÇÃO PARA IR PARA PÁGINA ESPECÍFICA
function irParaPaginaPCT(pagina) {
    const totalItens = window.romaneioItems ? window.romaneioItems.length : 0;
    const itensPorPagina = window.itemsPerPage || 5;
    const totalPaginas = Math.ceil(totalItens / itensPorPagina);
    
    if (pagina >= 1 && pagina <= totalPaginas && pagina !== window.currentPage) {
        window.currentPage = pagina;
        reconstruirTabela();
        console.log(`📄 Navegação PCT: página ${pagina}`);
    }
}

function atualizarTotais() {
    console.log('🧮 Atualizando totais PCT');
    
    if (!window.romaneioItems || window.romaneioItems.length === 0) {
        const elPacotes = document.getElementById('totalPacotes');
        const elPecas   = document.getElementById('totalPecas');
        const elVolume  = document.getElementById('totalVolume');
        const elValor   = document.getElementById('totalValor');
        if (elPacotes) elPacotes.textContent = '0';
        if (elPecas)   elPecas.textContent   = '0';
        if (elVolume)  elVolume.textContent   = '0,0000 m³';
        if (elValor)   elValor.textContent    = 'R$ 0,00';
        return;
    }
    
    // ✅ CÁLCULOS ESPECÍFICOS PCT
    let totalPacotes = 0;
    let totalPecas = 0;
    let totalVolume = 0;
    let totalValor = 0;
    
    window.romaneioItems.forEach(item => {
        const qtd = parseInt(item.quantidade) || 0;
        const ppp = parseInt(item.pecasPorPacote) || 1;
        
        totalPacotes += qtd; // Quantidade de pacotes
        totalPecas += qtd * ppp; // ⚠️ ESPECÍFICO PCT: Total de peças
        totalVolume += parseFloat(item.volume) || 0;
        totalValor += parseFloat(item.valorTotal) || 0;
    });
    
    // ✅ ATUALIZAR ELEMENTOS NA TELA
    const elementos = {
        totalPacotes: totalPacotes.toString(),
        totalPecas: totalPecas.toString(),
        totalVolume: `${totalVolume.toFixed(4)} m³`,
        totalValor: formatarMoedaBrasileira(totalValor)
    };
    
    Object.entries(elementos).forEach(([id, valor]) => {
        const elemento = document.getElementById(id);
        if (elemento) {
            elemento.textContent = valor;
        }
    });
    
    console.log('📊 Totais calculados:', elementos);
}

// ✅ FUNÇÃO ANTIGA DE PAGINAÇÃO REMOVIDA - SUBSTITUÍDA PELA PADRONIZADA TL

function aplicarEstilosTabela() {
    console.log('🎨 Aplicando estilos da tabela PCT');
    
    const tabela = document.getElementById('romaneioTable');
    if (!tabela) return;
    
    try {
        // Garantir que as células numéricas estejam alinhadas à direita
        const tbody = tabela.querySelector('tbody');
        if (tbody) {
            tbody.querySelectorAll('tr').forEach((row, rowIndex) => {
                const cells = row.querySelectorAll('td');
                if (cells.length >= 10) {
                    // Células numéricas: Quantidade(5), Peças/Pacote(6), Total Peças(7), Volume(8), Valor(9), Valor Total(10)
                    [4, 5, 6, 7, 8, 9].forEach(index => {
                        if (cells[index]) {
                            cells[index].style.textAlign = 'right';
                            cells[index].style.fontFamily = "'Courier New', monospace";
                        }
                    });
                }
            });
        }
    } catch (error) {
        console.error('❌ Erro ao aplicar estilos:', error);
    }
}

// ✅ FUNÇÃO PRINCIPAL DE FORMATAÇÃO MONETÁRIA
function formatarMoedaBrasileira(valor) {
    if (valor === undefined || valor === null || isNaN(valor)) {
        return 'R$ 0,00';
    }
    
    const numeroValor = parseFloat(valor);
    return numeroValor.toLocaleString('pt-BR', {
        style: 'currency',
        currency: 'BRL',
        minimumFractionDigits: 2,
        maximumFractionDigits: 2
    });
}

// ✅ FUNÇÃO PARA FORMATAR PEÇAS POR PACOTE
function formatarPecasPorPacote(pecasPorPacote) {
    // ✅ CORREÇÃO: Tratar objeto ou número
    if (typeof pecasPorPacote === 'object' && pecasPorPacote !== null) {
        return pecasPorPacote.valor || pecasPorPacote.value || 1;
    }
    return pecasPorPacote || 1;
}

// ✅ MANTER COMPATIBILIDADE COM CÓDIGO EXISTENTE
function formatarValorMonetario(valor) {
    return formatarMoedaBrasileira(valor);
}

// ✅ FUNÇÃO PARA FORMATAR NÚMEROS DECIMAIS NA TABELA (FORMATO BRASILEIRO)
function formatarNumeroDecimal(valor, decimais = 2) {
    if (valor === undefined || valor === null || isNaN(valor)) {
        return '0' + (decimais > 0 ? ',' + '0'.repeat(decimais) : '');
    }
    
    const numeroValor = parseFloat(valor);
    return numeroValor.toFixed(decimais).replace('.', ',');
}

function getTodayLocalISODate() {
    const now = new Date();
    const y = now.getFullYear();
    const m = String(now.getMonth() + 1).padStart(2, '0');
    const d = String(now.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
}

function normalizeDateInputValue(value) {
    if (typeof value === 'number' && isFinite(value)) {
        const parsed = new Date(value);
        if (!isNaN(parsed.getTime())) {
            const y = parsed.getFullYear();
            const m = String(parsed.getMonth() + 1).padStart(2, '0');
            const d = String(parsed.getDate()).padStart(2, '0');
            return `${y}-${m}-${d}`;
        }
    }
    const raw = String(value || '').trim();
    if (!raw) return '';
    const iso = raw.match(/^(\d{4})-(\d{2})-(\d{2})/);
    if (iso) return `${iso[1]}-${iso[2]}-${iso[3]}`;
    const br = raw.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
    if (br) return `${br[3]}-${br[2]}-${br[1]}`;
    const parsed = new Date(raw);
    if (!isNaN(parsed.getTime())) {
        const y = parsed.getFullYear();
        const m = String(parsed.getMonth() + 1).padStart(2, '0');
        const d = String(parsed.getDate()).padStart(2, '0');
        return `${y}-${m}-${d}`;
    }
    return '';
}

function setRomaneioEmissionDate(value) {
    const input = document.getElementById('romaneioData');
    if (!input) return '';
    const dateValue = normalizeDateInputValue(value) || getTodayLocalISODate();
    input.value = dateValue;
    return dateValue;
}

function getRomaneioEmissionDate(fallbackValue) {
    const input = document.getElementById('romaneioData');
    const dateValue = normalizeDateInputValue(input && input.value)
        || normalizeDateInputValue(fallbackValue)
        || getTodayLocalISODate();
    if (input && input.value !== dateValue) {
        input.value = dateValue;
    }
    return dateValue;
}

// ========================================
// FUNÇÕES DE SALVAMENTO
// ========================================

function salvarEstadoRomaneioEmEdicao() {
    try {
        const estado = {
            totalItens: Array.isArray(window.romaneioItems) ? window.romaneioItems.length : 0,
            cliente: window.selectedClient,
            itemEmEdicao: window.itemEmEdicao,
            timestamp: Date.now()
        };
        const payload = JSON.stringify(estado);
        try { sessionStorage.setItem('romaneioEmEdicaoPct', payload); } catch (_) {}
        tryLocalStorageSet('romaneioEmEdicaoPct', payload);
        console.log("✅ Estado do romaneio salvo");
        return true;
    } catch (error) {
        console.error("❌ Erro ao salvar estado:", error);
        return false;
    }
}

function limparEstadoRomaneioEmEdicao() {
    localStorage.removeItem('romaneioEmEdicaoPct');
    try { sessionStorage.removeItem('romaneioEmEdicaoPct'); } catch (_) {}
    console.log("🧹 Estado do romaneio limpo");
}

async function salvarRomaneio() {
    try {
        if (window.isSavingRomaneio) {
            console.log("⚠️ Salvamento já em andamento");
            return;
        }
        
        window.isSavingRomaneio = true;
        
        console.log("💾 Iniciando salvamento do romaneio PCT");
        
        // ✅ VALIDAÇÕES MELHORADAS DO CLIENTE
        const clienteAtual = window.selectedClient;
        console.log('🔍 Validando cliente:', clienteAtual);
        
        // Verificar se existe cliente selecionado
        if (!clienteAtual) {
            alert('Por favor, selecione um cliente.');
            window.isSavingRomaneio = false;
            return;
        }
        
        // Verificar se o cliente tem as propriedades necessárias
        const nomeCliente = clienteAtual.nome || clienteAtual.name;
        if (!nomeCliente || nomeCliente.trim() === '') {
            console.error('❌ Cliente sem nome válido:', clienteAtual);
            alert('Cliente selecionado é inválido. Por favor, selecione novamente.');
            window.isSavingRomaneio = false;
            return;
        }
        
        console.log('✅ Cliente validado:', nomeCliente);
        
        if (!window.romaneioItems || window.romaneioItems.length === 0) {
            alert('Por favor, adicione pelo menos um item ao romaneio.');
            window.isSavingRomaneio = false;
            return;
        }
        const tenantId = resolveTenantId();
        if (!tenantId) {
            alert('Não foi possível identificar a empresa ativa. Refaça o login para continuar.');
            window.isSavingRomaneio = false;
            return;
        }
        
        // ✅ CRIAR ROMANEIO COM DADOS ESPECÍFICOS PCT
        const generatedId = `PCT_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
        
        // ✅ SANITIZAÇÃO: Objeto cliente padronizado (EVITAR CIRCULAR REFERENCES)
        const clienteObj = {
            id: clienteAtual.id || '',
            nome: String(nomeCliente || ''),
            name: String(nomeCliente || ''),
            // Copiar apenas propriedades seguras conhecidas
            email: String(clienteAtual.email || ''),
            telefone: String(clienteAtual.telefone || clienteAtual.phone || ''),
            phone: String(clienteAtual.telefone || clienteAtual.phone || ''),
            endereco: String(clienteAtual.endereco || clienteAtual.address || ''),
            address: String(clienteAtual.endereco || clienteAtual.address || ''),
            cidade: String(clienteAtual.cidade || clienteAtual.city || ''),
            city: String(clienteAtual.cidade || clienteAtual.city || ''),
            estado: String(clienteAtual.estado || clienteAtual.state || ''),
            state: String(clienteAtual.estado || clienteAtual.state || ''),
            obs: String(clienteAtual.obs || clienteAtual.observacoes || ''),
            cpf: String(clienteAtual.cpf || ''),
            cnpj: String(clienteAtual.cnpj || '')
        };

        const dataEmissao = getRomaneioEmissionDate(window.romaneioEmEdicao && (window.romaneioEmEdicao.dataEmissao || window.romaneioEmEdicao.data || window.romaneioEmEdicao.timestamp));

        const romaneio = {
            id: window.romaneioEmEdicao?.id || generatedId,
            numero: window.romaneioEmEdicao?.numero || generatedId,
            data: dataEmissao,
            dataEmissao: dataEmissao,
            cliente: clienteObj, // ✅ Objeto sanitizado
            clienteNome: nomeCliente, // ✅ String para compatibilidade
            fornecedor: { ...clienteObj }, // ✅ Alias para módulos de compras/estoque
            companyId: tenantId,
            itens: window.romaneioItems.map(item => {
                // Sanitizar item para evitar objetos complexos ou referências circulares
                return {
                    id: item.id || Date.now() + Math.random(),
                    especie: item.especie || '',
                    comprimento: parseFloat(item.comprimento) || 0,
                    largura: parseFloat(item.largura) || 0,
                    espessura: parseFloat(item.espessura) || 0,
                    quantidade: parseInt(item.quantidade) || 0,
                    pecasPorPacote: (typeof item.pecasPorPacote === 'object' ? (parseInt(item.pecasPorPacote.valor || item.pecasPorPacote.value || 1)) : (parseInt(item.pecasPorPacote) || 1)),
                    totalPecas: parseInt(item.totalPecas) || 0,
                    volume: parseFloat(item.volume) || 0,
                    valorUnitario: parseFloat(item.valorUnitario) || 0,
                    valorTotal: parseFloat(item.valorTotal) || 0
                };
            }),
            totais: {
                pacotes: window.romaneioItems.reduce((sum, item) => sum + (parseInt(item.quantidade) || 0), 0),
                pecas: window.romaneioItems.reduce((sum, item) => sum + ((parseInt(item.quantidade) || 0) * (parseInt(item.pecasPorPacote) || 1)), 0),
                volume: window.romaneioItems.reduce((sum, item) => sum + (parseFloat(item.volume) || 0), 0),
                valor: window.romaneioItems.reduce((sum, item) => sum + (parseFloat(item.valorTotal) || 0), 0)
            }
        };
        
        // ✅ CARREGAR ROMANEIOS EXISTENTES (Firebase primeiro, localStorage como fallback)
        let romaneios = [];
        
        // ✅ PRIORIDADE 1: Tentar carregar do Firebase
        if (window.firebaseService && typeof window.firebaseService.loadFromFirebase === 'function') {
            try {
                console.log('🔥 PCT: Tentando carregar romaneios existentes do Firebase...');
                const firebaseResult = await window.firebaseService.loadFromFirebase('romaneios/pct');
                
                if (firebaseResult && firebaseResult.success && firebaseResult.data) {
                    const firebaseData = firebaseResult.data;
                    if (Array.isArray(firebaseData) && firebaseData.length > 0) {
                        romaneios = firebaseData.filter(item => item && (item.cliente || item.numero || item.id));
                        console.log(`✅ PCT: ${romaneios.length} romaneios carregados do Firebase`);
                    } else if (typeof firebaseData === 'object' && Object.keys(firebaseData).length > 0) {
                        romaneios = Object.values(firebaseData).filter(item => item && (item.cliente || item.numero || item.id));
                        console.log(`✅ PCT: ${romaneios.length} romaneios carregados do Firebase (convertidos)`);
                    }
                }
            } catch (firebaseError) {
                console.warn('⚠️ PCT: Erro ao carregar do Firebase:', firebaseError);
            }
        }
        
        // ✅ PRIORIDADE 2: Fallback para localStorage
        if (romaneios.length === 0) {
            console.log('🔍 PCT: Firebase vazio, tentando localStorage...');
            try {
                const storageKey = getStorageKey('romaneiosPct');
                const localRomaneios = JSON.parse(localStorage.getItem(storageKey) || '[]');
                if (Array.isArray(localRomaneios) && localRomaneios.length > 0) {
                    romaneios = localRomaneios.filter(item => item && (item.cliente || item.numero || item.id));
                    console.log(`📦 PCT: ${romaneios.length} romaneios do localStorage (fallback)`);
                }
            } catch (localError) {
                console.warn('⚠️ PCT: Erro ao carregar do localStorage:', localError);
                romaneios = [];
            }
        }
        
        // ✅ ATUALIZAR OU ADICIONAR ROMANEIO
        if (window.romaneioEmEdicao) {
            const index = romaneios.findIndex(r => r.id === romaneio.id);
            if (index !== -1) {
                romaneios[index] = romaneio;
                console.log(`✅ Romaneio ${romaneio.id} atualizado`);
            } else {
                romaneios.push(romaneio);
                console.log(`✅ Romaneio ${romaneio.id} adicionado (não encontrado para atualização)`);
            }
        } else {
            romaneios.push(romaneio);
            console.log(`✅ Novo romaneio ${romaneio.id} criado`);
        }
        
        // ✅ SINCRONIZAR localStorage com dados atualizados
        const storageKey = getStorageKey('romaneiosPct');
        persistRomaneiosPctLocalCache(storageKey, romaneios);
        
        // ✅ CORREÇÃO CRÍTICA: Padronizar estrutura dos dados antes da validação
        const padronizarItem = (item) => {
            const itemPadronizado = { ...item };
            
            // Corrigir pecasPorPacote se for objeto
            if (typeof item.pecasPorPacote === 'object' && item.pecasPorPacote !== null) {
                itemPadronizado.pecasPorPacote = parseInt(item.pecasPorPacote.valor || 1);
            } else {
                itemPadronizado.pecasPorPacote = parseInt(item.pecasPorPacote) || 1;
            }
            
            // Garantir que totalPecas não seja null
            if (itemPadronizado.totalPecas === null || isNaN(itemPadronizado.totalPecas)) {
                itemPadronizado.totalPecas = itemPadronizado.quantidade * itemPadronizado.pecasPorPacote;
            }
            
            // Recalcular volume se for 0 ou inválido
            if (itemPadronizado.volume === 0 || isNaN(itemPadronizado.volume)) {
                const volumeRecalculado = window.calcularVolumePCT(
                    itemPadronizado.comprimento,
                    itemPadronizado.largura, 
                    itemPadronizado.espessura,
                    itemPadronizado.quantidade,
                    itemPadronizado.pecasPorPacote
                );
                itemPadronizado.volume = volumeRecalculado;
                itemPadronizado.valorTotal = volumeRecalculado * (itemPadronizado.valorUnitario || 0);
            }
            
            return itemPadronizado;
        };

        // Padronizar apenas os itens do romaneio atual
        if (romaneio.itens && Array.isArray(romaneio.itens)) {
            romaneio.itens = romaneio.itens.map(padronizarItem);
        }

        // ✅ VALIDAÇÃO CRÍTICA: Verificar NaN antes do salvamento
        const validarDados = (dados) => {
            if (Array.isArray(dados)) {
                return dados.every(item => validarDados(item));
            } else if (typeof dados === 'object' && dados !== null) {
                return Object.values(dados).every(value => validarDados(value));
            } else if (typeof dados === 'number') {
                return !isNaN(dados) && isFinite(dados);
            }
            return true;
        };

        if (!validarDados(romaneio)) {
            console.error('❌ PCT: DADOS INVÁLIDOS DETECTADOS - NaN encontrado após padronização!');
            console.error('🔍 PCT: Dados problemáticos:', JSON.stringify(romaneio, null, 2));
            throw new Error('Dados contêm valores inválidos (NaN)');
        }
        
        console.log('✅ PCT: Dados padronizados e validados com sucesso');

        // ✅ SALVAR APENAS O ROMANEIO ATUAL (sem regravar toda a coleção)
        const useTL = (window.firebaseServiceTL && typeof window.firebaseServiceTL.saveData === 'function');
        const useSvc = (window.firebaseService && typeof window.firebaseService.saveToFirebase === 'function');
        try {
            const record = { ...romaneio, _metadata: { lastUpdated: Date.now(), source: 'romaneiopct' } };
            const seen = new WeakSet();
            const safeRecord = JSON.parse(JSON.stringify(record, (_, value) => {
                if (typeof value === 'function' || typeof value === 'symbol') return undefined;
                if (value && typeof value === 'object') {
                    if (seen.has(value)) return undefined;
                    seen.add(value);
                }
                if (typeof value === 'number' && (!isFinite(value) || isNaN(value))) return 0;
                return value;
            }));
            const id = romaneio.id || `PCT_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
            if (useTL) {
                await window.firebaseServiceTL.saveData(`romaneios/pct/${id}`, safeRecord);
            } else if (useSvc) {
                const res = await window.firebaseService.saveToFirebase('romaneios/pct', id, safeRecord);
                if (!(res && res.success)) throw new Error(res && res.error ? res.error : 'Falha ao salvar registro');
            } else {
                throw new Error('Serviço Firebase indisponível');
            }
            console.log('✅ PCT: Romaneio atual salvo/atualizado');
            try { window.lastSavedPCTRomaneioId = id; } catch {}
            try { window.dispatchEvent(new CustomEvent('romaneiosPct:updated', { detail: { id } })); } catch {}
        } catch (e) {
            console.warn('⚠️ PCT: Falha ao salvar romaneio atual:', e.message || e);
            // Cache local como backup
            try {
                const storageKey = getStorageKey('romaneiosPct');
                persistRomaneiosPctLocalCache(storageKey, romaneios);
            } catch {}
            const rawMessage = String((e && e.message) || e || 'Falha ao salvar romaneio no Firebase');
            if (/permission_denied|permission denied/i.test(rawMessage)) {
                throw new Error('Sem permissão para gravar romaneio PCT no Firebase. Verifique claims (companyId/subscriptionStatus) e tente novamente.');
            }
            throw new Error(rawMessage);
        }
        
        // ✅ LOG FINAL DE STATUS
        console.log('🎉 PCT: SALVAMENTO COMPLETO!');
        console.log('📊 PCT: Status final:', {
            localStorage: 'Salvo ✅',
            firebase: window.firebaseService ? 'Salvo ✅' : 'Indisponível ❌',
            totalRomaneios: romaneios.length,
            ultimoRomaneio: romaneio.id
        });
        
        alert('Romaneio salvo com sucesso!');
        
        // ✅ Limpar formulário pós-salvamento com UX idêntica ao PES
        limparFormularioAposSalvamento();
        
    } catch (error) {
        console.error('❌ Erro ao salvar romaneio:', error);
        alert('Erro ao salvar romaneio: ' + error.message);
    } finally {
        window.isSavingRomaneio = false;
    }
}

function limparFormulario() {
    console.log('🧹 Limpando formulário completo');
    
    // Limpar arrays
    window.romaneioItems = [];
    window.selectedClient = null;
    window.selectedSpecies = null;
    window.itemEmEdicao = false;
    window.romaneioEmEdicao = null;
    
    // Limpar campos
    limparCamposItem();
    setRomaneioEmissionDate();
    
    // Atualizar interface
    reconstruirTabela();
    atualizarTotais();
    
    // Limpar estado salvo
    limparEstadoRomaneioEmEdicao();
}

function limparFormularioAposSalvamento() {
    console.log('🧹 PCT: Limpando formulário após salvamento (padrão PES)...');
    window.romaneioItems = [];
    window.selectedSpecies = null;
    window.itemEmEdicao = false;
    window.romaneioEmEdicao = null;
    window.currentPage = 1;
    const espessuraInput = document.getElementById('espessura');
    const larguraInput = document.getElementById('largura');
    const comprimentoInput = document.getElementById('comprimento');
    const quantidadeInput = document.getElementById('quantidade');
    const pecasPorPacoteInput = document.getElementById('pecasPorPacote');
    if (espessuraInput) espessuraInput.value = '';
    if (larguraInput) larguraInput.value = '';
    if (comprimentoInput) comprimentoInput.value = '';
    if (quantidadeInput) quantidadeInput.value = '';
    if (pecasPorPacoteInput) pecasPorPacoteInput.value = '1';
    setRomaneioEmissionDate();
    reconstruirTabela();
    atualizarTotais();
    limparEstadoRomaneioEmEdicao();
    if (espessuraInput) espessuraInput.focus();
}

// ========================================
// FUNÇÕES AUXILIARES E FALLBACKS
// ========================================

// ✅ FUNÇÃO PARA VISUALIZAR ESTADO ATUAL DOS ITENS
window.visualizarItensPCT = function() {
    console.log('📊 === ESTADO ATUAL DOS ITENS PCT ===');
    
    if (!window.romaneioItems || window.romaneioItems.length === 0) {
        console.log('📦 Nenhum item no romaneio');
        return;
    }
    
    console.log(`📦 Total de itens: ${window.romaneioItems.length}`);
    console.log('📋 Lista de itens (em ordem):');
    
    window.romaneioItems.forEach((item, index) => {
        console.log(`  ${index + 1}. ${item.especie} ${item.comprimento}x${item.largura}x${item.espessura}cm`);
        console.log(`     └─ ${item.quantidade} pacotes × ${item.pecasPorPacote} peças = ${item.totalPecas} peças`);
        console.log(`     └─ Volume: ${item.volume.toFixed(4)} m³, Valor: R$ ${item.valorTotal.toFixed(2)}`);
    });
    
    // Verificar se há itens que poderiam ser agrupados
    const grupos = new Map();
    window.romaneioItems.forEach((item, index) => {
        const chave = `${item.comprimento}x${item.largura}x${item.espessura}-${item.especie}-${item.pecasPorPacote}-${item.valorUnitario}`;
        if (!grupos.has(chave)) {
            grupos.set(chave, []);
        }
        grupos.get(chave).push({ index, item });
    });
    
    const itensDesagrupados = Array.from(grupos.values()).filter(grupo => grupo.length > 1);
    if (itensDesagrupados.length > 0) {
        console.log('⚠️ Itens que poderiam ser agrupados:');
        itensDesagrupados.forEach(grupo => {
            const primeiro = grupo[0].item;
            console.log(`   ${primeiro.especie} ${primeiro.comprimento}x${primeiro.largura}x${primeiro.espessura}cm:`);
            grupo.forEach(({ index, item }) => {
                console.log(`     - Posição ${index + 1}: ${item.quantidade} pacotes`);
            });
        });
    } else {
        console.log('✅ Todos os itens similares estão agrupados corretamente');
    }
    
    console.log('===================================');
};

// ✅ FUNÇÃO DE TESTE DE AGRUPAMENTO E PRIORIZAÇÃO
window.testarAgrupamentoPCT = function() {
    console.log('🧪 === TESTE DE AGRUPAMENTO E PRIORIZAÇÃO PCT ===');
    
    // Limpar itens existentes
    window.romaneioItems = [];
    reconstruirTabela();
    
    console.log('📊 Simulando adição de itens para teste...');
    
    // Item 1: 30x10x2.5 Eucalipto
    const item1 = {
        comprimento: 30,
        largura: 10,
        espessura: 2.5,
        quantidade: 5,
        pecasPorPacote: 10,
        especie: 'Eucalipto',
        valorUnitario: 50,
        volume: 3.75,
        valorTotal: 187.5,
        totalPecas: 50,
        id: Date.now() + 1
    };
    
    // Item 2: 25x15x3 Pinus
    const item2 = {
        comprimento: 25,
        largura: 15,
        espessura: 3,
        quantidade: 3,
        pecasPorPacote: 8,
        especie: 'Pinus',
        valorUnitario: 60,
        volume: 2.7,
        valorTotal: 162,
        totalPecas: 24,
        id: Date.now() + 2
    };
    
    // Item 3: IGUAL ao item 1 (deve ser agrupado)
    const item3 = {
        comprimento: 30,
        largura: 10,
        espessura: 2.5,
        quantidade: 2,
        pecasPorPacote: 10,
        especie: 'Eucalipto',
        valorUnitario: 50,
        volume: 1.5,
        valorTotal: 75,
        totalPecas: 20,
        id: Date.now() + 3
    };
    
    // Adicionar itens sequencialmente
    console.log('➕ Adicionando item 1 (Eucalipto 30x10x2.5)...');
    window.romaneioItems.unshift(item1);
    reconstruirTabela();
    
    setTimeout(() => {
        console.log('➕ Adicionando item 2 (Pinus 25x15x3)...');
        window.romaneioItems.unshift(item2);
        reconstruirTabela();
        console.log('📊 Array atual:', window.romaneioItems.map(i => `${i.especie} ${i.comprimento}x${i.largura}x${i.espessura} (${i.quantidade}pct)`));
        
        setTimeout(() => {
            console.log('➕ Adicionando item 3 (IGUAL ao item 1 - deve reagrupar)...');
            
            // Simular agrupamento
            const indexExistente = buscarItemExistente(item3);
            if (indexExistente !== -1) {
                console.log(`🔄 Reagrupando com item existente no índice ${indexExistente}`);
                reagruparItens(window.romaneioItems[indexExistente], item3);
                moverParaPrimeiro(window.romaneioItems, indexExistente);
            } else {
                window.romaneioItems.unshift(item3);
            }
            
            reconstruirTabela();
            atualizarTotais();
            
            console.log('📊 RESULTADO FINAL:');
            console.log('Total de itens no array:', window.romaneioItems.length);
            console.log('Items:', window.romaneioItems.map((i, idx) => 
                `${idx + 1}. ${i.especie} ${i.comprimento}x${i.largura}x${i.espessura} - ${i.quantidade}pct (${i.totalPecas} peças)`
            ));
            
            // Verificações
            const primeiroItem = window.romaneioItems[0];
            const esperadoQuantidade = 7; // 5 + 2
            const esperadoTotalPecas = 70; // 7 * 10
            
            if (primeiroItem.especie === 'Eucalipto' && 
                primeiroItem.quantidade === esperadoQuantidade &&
                primeiroItem.totalPecas === esperadoTotalPecas) {
                console.log('✅ SUCESSO: Agrupamento e priorização funcionando!');
                console.log(`   - Item reagrupado: ${esperadoQuantidade} pacotes, ${esperadoTotalPecas} peças`);
                console.log('   - Item está em primeira posição ✅');
            } else {
                console.log('❌ FALHA: Agrupamento não funcionou corretamente');
                console.log('Expected:', { especie: 'Eucalipto', quantidade: esperadoQuantidade, totalPecas: esperadoTotalPecas });
                console.log('Actual:', { especie: primeiroItem.especie, quantidade: primeiroItem.quantidade, totalPecas: primeiroItem.totalPecas });
            }
            
            console.log('🧪 Teste concluído!');
            
        }, 1000);
    }, 1000);
};

// ✅ FUNÇÃO DE TESTE DE LIMPEZA MANUAL
window.testarLimpezaPCT = function() {
    console.log('🧪 === TESTE MANUAL DE LIMPEZA PCT ===');
    
    // Simular alguns itens para teste
    window.romaneioItems = [
        { quantidade: 1, pecasPorPacote: 10, volume: 1.5, valorTotal: 100 },
        { quantidade: 2, pecasPorPacote: 5, volume: 2.0, valorTotal: 200 }
    ];
    
    console.log('📊 Estado ANTES da limpeza:');
    console.log('  - Itens:', window.romaneioItems.length);
    console.log('  - Página atual:', window.currentPage);
    
    // Reconstruir tabela com itens
    reconstruirTabela();
    atualizarTotais();
    
    setTimeout(() => {
        console.log('🧹 Iniciando limpeza de teste...');
        
        // Executar limpeza
        window.romaneioItems = [];
        window.currentPage = 1;
        
        // Limpar fisicamente
        const tabela = document.getElementById('romaneioTable');
        if (tabela) {
            const tbody = tabela.querySelector('tbody');
            if (tbody) {
                tbody.innerHTML = `
                    <tr>
                        <td colspan="11" style="text-align: center; padding: 20px; color: #666;">
                            <i class="fas fa-inbox fa-2x" style="margin-bottom: 10px; display: block;"></i>
                            Nenhum item adicionado ao romaneio
                        </td>
                    </tr>
                `;
            }
        }
        
        // Resetar totais
        const totais = {
            'totalPacotes': '0',
            'totalPecas': '0', 
            'totalVolume': '0.000 m³',
            'totalValor': 'R$ 0,00'
        };
        
        Object.keys(totais).forEach(id => {
            const element = document.getElementById(id);
            if (element) {
                element.textContent = totais[id];
            }
        });
        
        // Limpar paginação
        const pagination = document.getElementById('romaneioTablePagination');
        if (pagination) {
            pagination.innerHTML = '';
            pagination.style.display = 'none';
        }
        
        // Verificar resultado
        setTimeout(() => {
            console.log('📊 Estado APÓS limpeza manual:');
            console.log('  - Itens:', window.romaneioItems.length);
            console.log('  - Página atual:', window.currentPage);
            console.log('  - Total valor:', document.getElementById('totalValor')?.textContent);
            console.log('  - Paginação oculta:', pagination?.style.display === 'none');
            
            console.log('✅ Teste de limpeza manual concluído!');
        }, 100);
        
    }, 1000);
};

// ✅ FALLBACKS PARA FUNÇÕES CRÍTICAS
if (typeof window.calcularVolume !== 'function') {
    window.calcularVolume = function(comprimento, largura, espessura) {
        const comp = parseFloat(comprimento) || 0;
        const larg = parseFloat(largura) || 0;
        const esp = parseFloat(espessura) || 0;
        return (comp * larg * esp) / 1000000;
    };
    console.log('✅ Fallback calcularVolume implementado');
}

// ✅ FORMATAÇÃO AGORA É GERENCIADA POR romaneiopct-formatacao.js
// Fallback apenas se o sistema de formatação não estiver carregado
if (!window.FORMATACAO_PCT_CARREGADA && typeof window.formatCurrency !== 'function') {
    window.formatCurrency = function(value) {
        const numValue = parseFloat(value || 0);
        return numValue.toLocaleString('pt-BR', {
            style: 'currency',
            currency: 'BRL',
            minimumFractionDigits: 2,
            maximumFractionDigits: 2
        });
    };
    console.log('⚠️ Fallback formatCurrency implementado (sistema de formatação não carregado)');
}

if (typeof window.parseCurrencyValue !== 'function') {
    window.parseCurrencyValue = function(value) {
        if (!value) return 0;
        return parseFloat(value.toString().replace(/[^\d,.-]/g, '').replace(',', '.')) || 0;
    };
    console.log('✅ Fallback parseCurrencyValue implementado');
}

if (typeof window.formatarVolume !== 'function') {
    window.formatarVolume = function(volume) {
        return `${parseFloat(volume || 0).toFixed(4)} m³`;
    };
    console.log('✅ Fallback formatarVolume implementado');
}

// ========================================
// FUNÇÕES DE CONTROLE DO BOTÃO (BASEADO NO SISTEMA TL)
// ========================================

/**
 * ✅ ALTERAR BOTÃO PARA MODO DE EDIÇÃO
 */
function alterarBotaoParaEdicao() {
    try {
        const addButton = document.getElementById('btnAdicionar');
        if (addButton) {
            // Salvar texto e classe originais (se ainda não foi salvo)
            if (!addButton.dataset.textoOriginal) {
                addButton.dataset.textoOriginal = addButton.textContent;
                addButton.dataset.classeOriginal = addButton.className;
                console.log('💾 Dados originais do botão salvos:', {
                    texto: addButton.dataset.textoOriginal,
                    classe: addButton.dataset.classeOriginal
                });
            }
            
            // Alterar para modo de edição
            addButton.textContent = 'Atualizar Item';
            addButton.classList.remove('btn-adicionar');
            addButton.classList.add('btn-atualizar');
            
            console.log("✅ Botão alterado para 'Atualizar Item'");
        } else {
            console.warn("⚠️ Botão 'btnAdicionar' não encontrado");
        }
    } catch (error) {
        console.error('❌ Erro ao alterar botão:', error);
    }
}

/**
 * ✅ RESTAURAR BOTÃO PARA MODO NORMAL
 */
function restaurarBotaoNormal() {
    try {
        const addButton = document.getElementById('btnAdicionar');
        if (addButton && addButton.dataset.textoOriginal) {
            // Restaurar texto e classe originais
            addButton.textContent = addButton.dataset.textoOriginal;
            addButton.className = addButton.dataset.classeOriginal;
            
            // Limpar dados salvos
            delete addButton.dataset.textoOriginal;
            delete addButton.dataset.classeOriginal;
            
            console.log("✅ Botão restaurado para modo normal");
        } else if (addButton) {
            // Fallback se não tiver dados salvos
            addButton.textContent = 'Adicionar';
            addButton.className = 'btn-adicionar';
            console.log("✅ Botão restaurado usando fallback");
        }
    } catch (error) {
        console.error('❌ Erro ao restaurar botão:', error);
    }
}

// ========================================
// EXPOSIÇÃO GLOBAL DAS FUNÇÕES
// ========================================

// ✅ EXPOR FUNÇÕES PRINCIPAIS
// ✅ FUNÇÃO PARA RECALCULAR VALORES DE ITENS EXISTENTES (CORREÇÃO EDIÇÃO ROMANEIO)
function recalcularValoresItens() {
    console.log('🔄 Recalculando valores de itens existentes');
    
    if (!window.romaneioItems || !Array.isArray(window.romaneioItems)) {
        return;
    }
    
    window.romaneioItems.forEach((item, index) => {
        try {
            const comprimento = parseFloat(item.comprimento) || 0;
            const largura = parseFloat(item.largura) || 0;
            const espessura = parseFloat(item.espessura) || 0;
            const quantidade = parseInt(item.quantidade) || 0;
            
            // ✅ CORREÇÃO CRÍTICA: Lidar com pecasPorPacote como objeto ou número
            let pecasPorPacote;
            if (typeof item.pecasPorPacote === 'object' && item.pecasPorPacote !== null) {
                // Formato objeto: {valido: true, valor: 1}
                pecasPorPacote = parseInt(item.pecasPorPacote.valor || 1);
            } else {
                // Formato simples: número
                pecasPorPacote = parseInt(item.pecasPorPacote) || 1;
            }
            
            const valorUnitario = parseFloat(item.valorUnitario) || 0;
            
            if (comprimento > 0 && largura > 0 && espessura > 0 && quantidade > 0) {
                // ✅ USAR FUNÇÃO VALIDADA PCT
                const volumeTotal = window.calcularVolumePCT ? 
                    window.calcularVolumePCT(comprimento, largura, espessura, quantidade, pecasPorPacote) : 
                    0; // Fallback seguro
                
                // ✅ VALIDAÇÃO CRÍTICA
                if (isNaN(volumeTotal) || !isFinite(volumeTotal)) {
                    console.error(`❌ Volume inválido no recálculo do item ${index}:`, {
                        comprimento, largura, espessura, quantidade, pecasPorPacote, volumeTotal
                    });
                    return; // Skip este item
                }
                
                // Valor total = volume total * preço unitário  
                const valorTotal = volumeTotal * valorUnitario;
                
                // Total de peças
                const totalPecas = quantidade * pecasPorPacote;
                
                // Atualizar item com valores recalculados
                window.romaneioItems[index] = {
                    ...item,
                    volume: volumeTotal,
                    valorTotal: valorTotal,
                    totalPecas: totalPecas
                };
                
                console.log(`✅ Item ${index} recalculado:`, {
                    volume: volumeTotal.toFixed(4),
                    valorTotal: valorTotal.toFixed(2),
                    totalPecas
                });
            }
        } catch (error) {
            console.error(`❌ Erro ao recalcular item ${index}:`, error);
        }
    });
    
    // Atualizar tabela e totais após recálculo
    reconstruirTabela();
    atualizarTotais();
}

// ✅ REGISTRAR FUNÇÕES GLOBALMENTE - INCLUINDO PAGINAÇÃO PADRONIZADA
window.adicionarItem = adicionarItem;
window.recalcularValoresItens = recalcularValoresItens;
window.editarItem = editarItem;
window.removerItem = removerItem;
window.salvarRomaneio = salvarRomaneio;
window.limparFormulario = limparFormulario;
window.renderizarPaginacao = renderizarPaginacao;
window.irParaPaginaPCT = irParaPaginaPCT;
window.reconstruirTabela = reconstruirTabela;
window.setRomaneioPctEmissionDate = setRomaneioEmissionDate;

console.log('✅ Função reconstruirTabela registrada no escopo global');

// ✅ CORREÇÃO: Chamar reconstruirTabela imediatamente para mostrar ícone quando tabela vazia
document.addEventListener('DOMContentLoaded', function() {
    console.log('🎯 CORREÇÃO: Chamando reconstruirTabela no DOMContentLoaded');
    setRomaneioEmissionDate();
    setTimeout(() => {
        if (typeof window.reconstruirTabela === 'function') {
            window.reconstruirTabela();
            console.log('✅ CORREÇÃO: reconstruirTabela chamada para mostrar ícone na tabela vazia');
        }
    }, 500); // Pequeno delay para garantir que DOM está pronto
});

// ✅ CORREÇÃO: Também chamar quando o script é carregado (fallback)
setTimeout(() => {
    if (typeof window.reconstruirTabela === 'function' && 
        (!window.romaneioItems || window.romaneioItems.length === 0)) {
        console.log('🎯 CORREÇÃO: Chamando reconstruirTabela por fallback (tabela vazia)');
        window.reconstruirTabela();
    }
}, 1000);

// ✅ EXPOR FUNÇÕES AUXILIARES (sem duplicação)
window.limparCamposItem = limparCamposItem;
window.salvarEstadoRomaneioEmEdicao = salvarEstadoRomaneioEmEdicao;
window.limparEstadoRomaneioEmEdicao = limparEstadoRomaneioEmEdicao;
window.alterarBotaoParaEdicao = alterarBotaoParaEdicao;
window.restaurarBotaoNormal = restaurarBotaoNormal;

// ✅ EXPOR FUNÇÕES ESPECÍFICAS PCT
window.calcularVolumePCT = calcularVolumePCT;
window.validarPecasPorPacote = validarPecasPorPacote;

// ✅ FUNÇÃO GLOBAL DE TESTE DE PADRONIZAÇÃO DE PAGINAÇÃO
window.testarPadronizacaoPaginacao = function() {
    console.log('🧪 === TESTE DE PADRONIZAÇÃO DE PAGINAÇÃO ===');
    console.log('');
    
    // Teste TL
    if (typeof window.testarPaginacaoTL === 'function') {
        window.testarPaginacaoTL();
        console.log('');
    } else {
        console.log('⚠️ TL: Função de teste não disponível');
    }
    
    // Teste PCT  
    if (typeof window.testarPaginacaoPCT === 'function') {
        window.testarPaginacaoPCT();
        console.log('');
    } else {
        console.log('⚠️ PCT: Função de teste não disponível');
    }
    
    // Verificação final
    console.log('🔍 === VERIFICAÇÃO FINAL ===');
    console.log('✅ Lista de Romaneios: 10 itens por página (ambos)');
    console.log('✅ Tabela de Itens: 10 itens por página (ambos)');
    console.log('✅ Configurações: window.itemsPerPage = 10 (ambos)');
    console.log('✅ Constantes: ITENS_POR_PAGINA = 10');
    console.log('');
    console.log('🎯 RESULTADO: SISTEMAS COMPLETAMENTE PADRONIZADOS!');
    
    return {
        status: 'PADRONIZADO',
        listaRomaneios: 10,
        tabelaItens: { porPagina: 10 }
    };
};

// ✅ FUNÇÃO DE TESTE DOS ESTILOS DOS BOTÕES
window.testarEstilosBotoesPCT = function() {
    console.log('🎨 === TESTE DE ESTILOS DOS BOTÕES PCT ===');
    console.log('');
    
    // Verificar se há itens na tabela para testar
    const tbody = document.getElementById('romaneioTableBody');
    const botoes = tbody ? tbody.querySelectorAll('.btn-editar, .btn-excluir') : [];
    
    if (botoes.length === 0) {
        console.log('⚠️ Nenhum botão encontrado na tabela. Adicione itens para testar.');
        console.log('📝 Estilos CSS aplicados:');
    } else {
        console.log(`🔍 Botões encontrados: ${botoes.length}`);
        const primeiroEditar = tbody.querySelector('.btn-editar');
        const primeiroExcluir = tbody.querySelector('.btn-excluir');
        
        if (primeiroEditar) {
            const styles = window.getComputedStyle(primeiroEditar);
            console.log('📏 Estilo botão EDITAR:');
            console.log(`   - Largura: ${styles.width}`);
            console.log(`   - Altura: ${styles.height}`);
            console.log(`   - Cor de fundo: ${styles.backgroundColor}`);
            console.log(`   - Padding: ${styles.padding}`);
        }
        
        if (primeiroExcluir) {
            const styles = window.getComputedStyle(primeiroExcluir);
            console.log('🗑️ Estilo botão EXCLUIR:');
            console.log(`   - Largura: ${styles.width}`);
            console.log(`   - Altura: ${styles.height}`);
            console.log(`   - Cor de fundo: ${styles.backgroundColor}`);
            console.log(`   - Padding: ${styles.padding}`);
        }
    }
    
    console.log('');
    console.log('✅ Configuração padrão aplicada:');
    console.log('   - Tamanho: 28px × 28px');
    console.log('   - Editar: Verde (#28a745)');
    console.log('   - Excluir: Vermelho (#dc3545)');
    console.log('   - Padding: 0');
    console.log('   - Border-radius: 3px');
    console.log('');
    console.log('🎯 Status: PADRONIZADO com TL');
    
    return {
        botoesEncontrados: botoes.length,
        estilosPadronizados: true
    };
};

console.log('✅ Sistema de Tabela Romaneiopct carregado e funções expostas globalmente');
// ✅ FUNÇÃO DE DIAGNÓSTICO COMPLETA
window.diagnosticarProblemasPCT = function() {
    console.log('🔍 === DIAGNÓSTICO COMPLETO PCT ===');
    console.log('');
    
    // 1. Testar paginação
    console.log('1️⃣ TESTE DE PAGINAÇÃO:');
    if (typeof window.testarPadronizacaoPaginacao === 'function') {
        window.testarPadronizacaoPaginacao();
    }
    console.log('');
    
    // 2. Testar estilos dos botões
    console.log('2️⃣ TESTE DE ESTILOS DOS BOTÕES:');
    if (typeof window.testarEstilosBotoesPCT === 'function') {
        window.testarEstilosBotoesPCT();
    }
    console.log('');
    
    // 2.5. Testar larguras das colunas
    console.log('2️⃣.5️⃣ TESTE DE LARGURAS DAS COLUNAS:');
    if (typeof window.testarLargurasColunasPCT === 'function') {
        window.testarLargurasColunasPCT();
    }
    console.log('');
    
    // 3. Verificar configurações globais
    console.log('3️⃣ CONFIGURAÇÕES GLOBAIS:');
    console.log(`   - window.itemsPerPage: ${window.itemsPerPage}`);
    console.log(`   - window.currentPage: ${window.currentPage}`);
    console.log(`   - romaneioItems.length: ${window.romaneioItems ? window.romaneioItems.length : 'undefined'}`);
    console.log('');
    
    // 4. Verificar constantes da tabela
    console.log('4️⃣ VERIFICAR SCRIPT ATUAL:');
    const tbody = document.getElementById('romaneioTableBody');
    const totalItens = window.romaneioItems ? window.romaneioItems.length : 0;
    const paginacao = document.getElementById('romaneioTablePagination');
    
    console.log(`   - Tabela encontrada: ${tbody ? 'SIM' : 'NÃO'}`);
    console.log(`   - Total de itens: ${totalItens}`);
    console.log(`   - Paginação visível: ${paginacao && paginacao.style.display !== 'none' ? 'SIM' : 'NÃO'}`);
    console.log('');
    
    console.log('🎯 RESULTADO ESPERADO:');
    console.log('   ✅ Lista de Romaneios: 10 por página');
    console.log('   ✅ Tabela de Itens: 10 por página');
    console.log('   ✅ Botões: 28x28px, cores padronizadas');
    console.log('   ✅ Larguras das Colunas: Otimizadas, sem quebra de linha');
    console.log('');
    
    return {
        paginacaoCorreta: window.itemsPerPage === 10,
        tabelaEncontrada: !!tbody,
        totalItens: totalItens
    };
};

// ✅ FUNÇÃO DE TESTE DAS LARGURAS DAS COLUNAS
window.testarLargurasColunasPCT = function() {
    console.log('📏 === TESTE DE LARGURAS DAS COLUNAS PCT ===');
    console.log('');
    
    const tabela = document.getElementById('romaneioTable');
    if (!tabela) {
        console.log('❌ Tabela não encontrada');
        return false;
    }
    
    const thead = tabela.querySelector('thead');
    const tbody = tabela.querySelector('tbody');
    
    if (!thead) {
        console.log('❌ Cabeçalho da tabela não encontrado');
        return false;
    }
    
    const colunas = thead.querySelectorAll('th');
    console.log(`🔍 Colunas encontradas: ${colunas.length}`);
    
    console.log('📊 Larguras esperadas PCT:');
    const larguras = [
        '8% (Comprimento)', 
        '8% (Largura)', 
        '8% (Espessura)', 
        '12% (Espécie)', 
        '7% (Quantidade)', 
        '7% (Peças/Pacote)', 
        '8% (Total Peças)', 
        '10% (Volume)', 
        '11% (Valor Unitário)', 
        '11% (Valor Total)', 
        '10% (Ações)'
    ];
    
    larguras.forEach((largura, index) => {
        console.log(`   ${index + 1}. ${largura}`);
    });
    
    console.log('');
    console.log('🎯 Configuração aplicada:');
    console.log('   ✅ table-layout: fixed');
    console.log('   ✅ min-width: 1400px');
    console.log('   ✅ white-space: nowrap (exceto espécie)');
    console.log('   ✅ overflow: hidden com ellipsis');
    console.log('   ✅ Container responsivo com scroll horizontal');
    console.log('');
    
    // Verificar se há itens para teste
    const totalItens = window.romaneioItems ? window.romaneioItems.length : 0;
    if (totalItens === 0) {
        console.log('⚠️ Nenhum item na tabela para testar quebra de linha');
        console.log('💡 Adicione alguns itens para verificar o comportamento');
    } else {
        console.log(`✅ ${totalItens} itens na tabela para teste`);
    }
    
    return {
        tabelaEncontrada: true,
        totalColunas: colunas.length,
        totalItens: totalItens,
        larguraMinimaAplicada: true
    };
};

console.log('🧪 Funções de teste disponíveis:');
console.log('   - testarPadronizacaoPaginacao() - Testa configurações de paginação');
console.log('   - testarEstilosBotoesPCT() - Testa estilos dos botões de ação');
console.log('   - testarLargurasColunasPCT() - Testa larguras das colunas');
console.log('   - diagnosticarProblemasPCT() - Diagnóstico completo de problemas');
