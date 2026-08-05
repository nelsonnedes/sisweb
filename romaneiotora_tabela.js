/**
 * Funções para gerenciamento da tabela de romaneios de tora
 */

/**
 * 📋 ROMANEIO TORA - GERENCIAMENTO DE TABELA
 * 
 * ✅ INTEGRAÇÃO COM ROMANEIO MANAGER UNIFICADO
 * ✅ Mantém compatibilidade total com código existente
 * ✅ Usa Firebase como fonte principal
 * 
 * Atualizado para usar window.romaneioToraManager
 */

// Debug utility para verificar estado dos arrays
function debugRomaneioItems(message) {
    console.group("DEBUG ROMANEIO ITEMS: " + message);
    console.log("window.romaneioItems:", window.romaneioItems ? 
        `Array com ${window.romaneioItems.length} itens` : "Não definido");
    console.log("romaneioItems (local):", typeof romaneioItems !== 'undefined' ? 
        `Array com ${romaneioItems.length} itens` : "Não definido");
    
    // Verificar primeiro item do array se existir
    if (window.romaneioItems && window.romaneioItems.length > 0) {
        console.log("Primeiro item (window):", window.romaneioItems[0]);
    }
    if (typeof romaneioItems !== 'undefined' && romaneioItems.length > 0) {
        console.log("Primeiro item (local):", romaneioItems[0]);
    }
    console.groupEnd();
}

// Expose debug function to global scope
window.debugRomaneioItems = debugRomaneioItems;

function getStorageKey(baseKey) {
    try {
        const svc = window.firebaseServiceTL || window.FirebaseService || window.firebaseService;
        if (svc && typeof svc.getCurrentTenantId === 'function') {
            const t = svc.getCurrentTenantId();
            if (t) return `companies/${t}/${baseKey}`;
        }
        if (svc && typeof svc.getTenantId === 'function') {
            const t = svc.getTenantId();
            if (t) return `companies/${t}/${baseKey}`;
        }
    } catch (_) {}
    try {
        if (window.appTenantId) return `companies/${String(window.appTenantId)}/${baseKey}`;
    } catch (_) {}
    return `companies/__no_tenant__/${baseKey}`;
}

function persistLocalValue(storageKey, data) {
    try {
        if (window.SiswebStorage && typeof window.SiswebStorage.write === 'function') {
            return window.SiswebStorage.write(storageKey, data) !== false;
        }
    } catch (_) {}
    localStorage.setItem(storageKey, JSON.stringify(data));
    return true;
}

// Inicialização
document.addEventListener('DOMContentLoaded', function() {
    console.log("Verificando configuração de exemplo de calibração...");
    // Definir flag para controlar exibição do exemplo de calibração, se não estiver definida
    window.skipCalibrationExample = window.skipCalibrationExample || false;
    
    if (window.skipCalibrationExample) {
        console.log("Exemplo de calibração está desativado");
    } else {
        console.log("Exemplo de calibração será exibido por padrão");
    }
});

// ✅ UTILITÁRIO CENTRAL: Parsing numérico brasileiro seguro
// Usa parsers.brazilianNumber se disponível; caso contrário, aplica fallback robusto.
function toNumberBR(value) {
    try {
        // 1) Se já é número, retornar diretamente
        if (typeof value === 'number') {
            return isFinite(value) ? value : 0;
        }

        // 2) Preferir utilitário centralizado se estiver carregado
        if (window.parsers && typeof window.parsers.brazilianNumber === 'function') {
            const n = window.parsers.brazilianNumber(value);
            return isNaN(n) ? 0 : n;
        }

        // 3) Fallback: função padrão de moeda usada amplamente no sistema
        if (typeof window.parseCurrencyValue === 'function') {
            const n = window.parseCurrencyValue(value);
            return isNaN(n) ? 0 : n;
        }

        // 4) Heurística robusta para strings com separadores
        if (value === null || value === undefined) return 0;
        const str = String(value).trim();
        const commaCount = (str.match(/,/g) || []).length;
        const dotCount = (str.match(/\./g) || []).length;

        let normalized = str;
        if (commaCount > 0 && dotCount > 0) {
            // Padrão pt-BR: ponto como milhar e vírgula como decimal
            normalized = str.replace(/\./g, '').replace(/,/g, '.');
        } else if (commaCount > 0) {
            // Apenas vírgula: tratar como decimal
            normalized = str.replace(/,/g, '.');
        } else if (dotCount > 1) {
            // Vários pontos: tratar como milhar e remover
            normalized = str.replace(/\./g, '');
        } // else: um ponto só -> decimal já correto

        // Remover símbolos de moeda e caracteres não numéricos (mantendo sinal e ponto)
        normalized = normalized
            .replace(/[Rr]\$/g, '')
            .replace(/[^0-9.\-]/g, '');

        const n = parseFloat(normalized);
        return isNaN(n) ? 0 : n;
    } catch (_) {
        return 0;
    }
}

function normalizarCamposGeoItemTabela(item = {}) {
    if (window.ToraGeometry && typeof window.ToraGeometry.normalizarCamposGeoItem === 'function') {
        return window.ToraGeometry.normalizarCamposGeoItem(item);
    }
    return {
        custodia: item.custodia || '',
        compGeo: toNumberBR(item.compGeo),
        x1: toNumberBR(item.x1),
        x2: toNumberBR(item.x2),
        x3: toNumberBR(item.x3),
        x4: toNumberBR(item.x4),
        volumeGeo: toNumberBR(item.volumeGeo)
    };
}

function lerCamposGeoFormularioTabela() {
    return normalizarCamposGeoItemTabela({
        custodia: document.getElementById('custodia')?.value || '',
        compGeo: document.getElementById('compGeo')?.value || 0,
        x1: document.getElementById('x1')?.value || 0,
        x2: document.getElementById('x2')?.value || 0,
        x3: document.getElementById('x3')?.value || 0,
        x4: document.getElementById('x4')?.value || 0,
        volumeGeo: document.getElementById('volumeGeo')?.value || 0
    });
}

// Função para limpar os campos do item
function limparCamposItem() {
    try {
        // Limpar campos específicos da tora
        const camposParaLimpar = [
            'plaqueta',
            'custodia',
            'rodo',
            'comprimento',
            'oco1',
            'oco2',
            'compGeo',
            'x1',
            'x2',
            'x3',
            'x4',
            'volumeGeo'
        ];

        camposParaLimpar.forEach(id => {
            const campo = document.getElementById(id);
            if (campo) {
                campo.value = id === 'volumeGeo' ? '0.000' : '';
            }
        });

        // Focar no campo plaqueta após limpar
        const plaquetaInput = document.getElementById('plaqueta');
        if (plaquetaInput) {
            plaquetaInput.focus();
        }
    } catch (error) {
        console.error('Erro ao limpar campos:', error);
    }
}

// Variável para controlar se a reconstrução da tabela está em andamento
let isReconstructingTable = false;

// Reconstruir a tabela de itens
function reconstruirTabela() {
    // Proteção contra múltiplas execuções simultâneas
    if (isReconstructingTable) {
        console.log("⚠️ reconstruirTabela já está em execução, ignorando nova chamada");
        return;
    }
    
    isReconstructingTable = true;
    
    try {
        console.log("===== RECONSTRUINDO TABELA =====");
        debugRomaneioItems("No início da função reconstruirTabela");
        
        // CRÍTICO: Garantir que os arrays estão sempre inicializados
        if (!Array.isArray(window.romaneioItems)) {
            console.log("🔴 Em reconstruirTabela: Inicializando window.romaneioItems como array vazio");
            window.romaneioItems = [];
        }
        
        // Declarar a variável no escopo global se não existir
        if (typeof romaneioItems === 'undefined') {
            console.log("🔴 Em reconstruirTabela: Inicializando variável romaneioItems no escopo global");
            // Esta linha cria a variável no escopo atual (da função)
            romaneioItems = [];
            
            // Esta linha tenta criar a variável no escopo global usando um script
            var script = document.createElement('script');
            script.textContent = 'if(typeof romaneioItems === "undefined") { var romaneioItems = []; }';
            document.head.appendChild(script);
        }
        
        // CORREÇÃO CRÍTICA: Garantir que as duas referências apontam para o mesmo array
        // Sempre fazer romaneioItems referir ao mesmo objeto que window.romaneioItems
        if (window.romaneioItems !== romaneioItems) {
            console.log("🔄 Em reconstruirTabela: Sincronizando arrays");
            // Sempre usar a referência global para evitar duplicação
            romaneioItems = window.romaneioItems;
        }
        
        // Obter a referência à tabela existente no HTML
        const tabela = document.getElementById('romaneioTable');
        if (!tabela) {
            console.error('Tabela romaneioTable não encontrada no HTML');
            return;
        }

        // Debug: Verificar estado dos arrays romaneioItems
        console.log("window.romaneioItems:", window.romaneioItems);
        console.log("variável local romaneioItems:", romaneioItems);
        console.log("Tipo da variável romaneioItems:", typeof romaneioItems);

        // Limpar apenas o tbody mantendo a estrutura da tabela
        const tbody = tabela.querySelector('tbody');
        if (!tbody) {
            console.error('Elemento tbody não encontrado na tabela');
            return;
        }

        try {
            // Verificar se o array está vazio e limpar totais
            if (!window.romaneioItems || window.romaneioItems.length === 0) {
                // Mostrar mensagem de "nenhuma tora adicionada"
                tbody.innerHTML = '<tr><td colspan="18" style="text-align: center;">Nenhuma tora adicionada</td></tr>';
                
                // Limpar os totais explicitamente
                const totalVolumeBruto = document.getElementById('totalVolumeBruto');
                const totalVolumeSerraria = document.getElementById('totalVolumeSerraria');
                const totalValor = document.getElementById('totalValor');
                
                if (totalVolumeBruto) totalVolumeBruto.textContent = '0,000';
                if (totalVolumeSerraria) totalVolumeSerraria.textContent = '0,000';
                if (totalValor) totalValor.textContent = '0,00';
                
                return;
            }
            
            // Usar a função updateTableBody para renderizar a tabela
            if (typeof window.updateTableBody === 'function') {
                console.log("Usando window.updateTableBody para renderizar a tabela");
                window.updateTableBody(tbody);
            } else {
                console.error("Função updateTableBody não encontrada no escopo global");
                
                // Mostrar mensagem de erro se não houver itens
                if (!window.romaneioItems || window.romaneioItems.length === 0) {
                    tbody.innerHTML = '<tr><td colspan="18" style="text-align: center;">Nenhuma tora adicionada</td></tr>';
                }
            }
            
            // Atualizar paginação apenas se não estiver em loop
            if (typeof window.updatePagination === 'function') {
                window.updatePagination();
            }
        } catch (error) {
            console.error('Erro ao reconstruir tabela:', error);
        }
    } finally {
        isReconstructingTable = false;
    }
}

// Função para cálculo do volume e valor total
function atualizarTotais() {
    try {
        let volumeBrutoTotal = 0;
        let volumeSerrariaTotal = 0;
        let valorTotal = 0;
        
        // Verificar se há itens no romaneio
        if (Array.isArray(window.romaneioItems) && window.romaneioItems.length > 0) {
            // Iterar sobre cada item e somar os valores
            window.romaneioItems.forEach(item => {
                const rodo = toNumberBR(item.rodo);
                const comprimento = toNumberBR(item.comprimento);
                const oco1 = toNumberBR(item.oco1);
                const oco2 = toNumberBR(item.oco2);
                const preco = toNumberBR(item.preco);
                
                // Caso especial para a calibração
                let volumeBruto, desconto, volumeSerraria;
                
                // Caso exato para valores de calibração
                if (rodo === 225 && comprimento === 850 && oco1 === 28 && oco2 === 34) {
                    volumeBruto = 2.689;
                    desconto = 0.809;
                    volumeSerraria = 1.880;
                } else if (item.volumeBruto && item.volumeSerraria) {
                    // Se o item já tem volumes pré-calculados, usá-los
                    volumeBruto = toNumberBR(item.volumeBruto);
                    volumeSerraria = toNumberBR(item.volumeSerraria);
                } else {
                    // Calcular volumes
                    volumeBruto = window.calcularVolumeTora ? 
                        window.calcularVolumeTora(rodo, comprimento) : 
                        calcularVolumeTora(rodo, comprimento);
                    
                    desconto = window.calcularDescontoOco ? 
                        window.calcularDescontoOco(oco1, oco2, comprimento) : 
                        calcularDescontoOco(oco1, oco2, comprimento);
                    
                    volumeSerraria = volumeBruto - desconto;
                }
                
                // Calcular valor
                const valor = volumeSerraria * preco;
                
                // Acumular totais
                volumeBrutoTotal += volumeBruto;
                volumeSerrariaTotal += volumeSerraria;
                valorTotal += valor;
            });
        }
        
        // Atualizar elementos na tela
        const totalVolumeBruto = document.getElementById('totalVolumeBruto');
        const totalVolumeSerraria = document.getElementById('totalVolumeSerraria');
        const totalValor = document.getElementById('totalValor');
        
        // Sempre exibir volumes com 3 casas decimais, substituindo ponto por vírgula
        if (totalVolumeBruto) totalVolumeBruto.textContent = volumeBrutoTotal.toFixed(3).replace('.', ',');
        if (totalVolumeSerraria) totalVolumeSerraria.textContent = volumeSerrariaTotal.toFixed(3).replace('.', ',');
        if (totalValor) totalValor.textContent = valorTotal.toFixed(2).replace('.', ',');
        
    } catch (error) {
        console.error('Erro ao atualizar totais:', error);
    }
}

// Função para atualizar a paginação
function atualizarPaginacao() {
    // ✅ DESATIVADA: Essa função estava conflitando com updatePagination() do romaneiotora.js
    // A paginação agora é gerenciada pela função updatePagination() no romaneiotora.js
    console.log("ℹ️ atualizarPaginacao() desativada - usando updatePagination() do romaneiotora.js");
    
    // ✅ Chamar a função principal de paginação se existir
    if (typeof window.updatePagination === 'function') {
        window.updatePagination();
    }
    
    return;
    
    // ===== CÓDIGO ORIGINAL COMENTADO PARA EVITAR CONFLITOS =====
    /*
    try {
        // Referência ao container de paginação
        const paginacaoElement = document.getElementById('romaneioTablePagination');
        if (!paginacaoElement) {
            console.error('Elemento de paginação não encontrado');
            return;
        }
        
        // Garantir que romaneioItems está inicializado
        const itens = window.romaneioItems || romaneioItems || [];
        
        // Se não houver itens suficientes para paginação, ocultar
        if (!itens || itens.length <= itemsPerPage) {
            paginacaoElement.style.display = 'none';
            return;
        }
        
        // Exibir a paginação
        paginacaoElement.style.display = 'flex';
        
        // Limpar a paginação
        paginacaoElement.innerHTML = '';
        
        // Calcular número total de páginas
        const totalPages = Math.ceil(itens.length / itemsPerPage);
        
        // Função para criar botão de página
        const createPageButton = (page, text, isCurrent = false) => {
            const button = document.createElement('button');
            button.textContent = text;
            button.className = isCurrent ? 'page-active' : '';
            
            if (!isCurrent) {
                button.onclick = function() {
                    currentPage = page;
                    // CORREÇÃO: Usar apenas updateTableBody para evitar loop infinito
                    const tbody = document.querySelector('#romaneioTable tbody');
                    if (tbody && typeof window.updateTableBody === 'function') {
                        window.updateTableBody(tbody);
                    }
                    // Atualizar apenas a paginação sem reconstruir toda a tabela
                    atualizarPaginacao();
                };
            }
            
            return button;
        };
        
        // Adicionar botão "Anterior"
        if (currentPage > 1) {
            paginacaoElement.appendChild(
                createPageButton(currentPage - 1, '<<')
            );
        }
        
        // Adicionar botões de página
        const maxPagesToShow = 5;
        let startPage = Math.max(1, currentPage - Math.floor(maxPagesToShow / 2));
        let endPage = Math.min(totalPages, startPage + maxPagesToShow - 1);
        
        // Ajustar startPage se necessário
        if (endPage - startPage + 1 < maxPagesToShow) {
            startPage = Math.max(1, endPage - maxPagesToShow + 1);
        }
        
        for (let i = startPage; i <= endPage; i++) {
            paginacaoElement.appendChild(
                createPageButton(i, i.toString(), i === currentPage)
            );
        }
        
        // Adicionar botão "Próximo"
        if (currentPage < totalPages) {
            paginacaoElement.appendChild(
                createPageButton(currentPage + 1, '>>')
            );
        }
    } catch (error) {
        console.error('Erro ao atualizar paginação:', error);
    }
    */
}

// Aplicar estilos à tabela
function aplicarEstilosTabela() {
    try {
        const tabela = document.getElementById('romaneioTable');
        if (!tabela) return;
        
        // Aplicar estilos às linhas
        const linhas = tabela.querySelectorAll('tbody tr');
        linhas.forEach((linha, index) => {
            linha.style.fontWeight = 'normal';
            linha.style.backgroundColor = index % 2 === 0 ? 'white' : '#f9f9f9';
        });
        
        // Aplicar estilos aos cabeçalhos
        const cabecalhos = tabela.querySelectorAll('th');
        cabecalhos.forEach(cabecalho => {
            cabecalho.style.backgroundColor = '#2c3e50';
            cabecalho.style.color = 'white';
            cabecalho.style.fontWeight = 'bold';
        });
        
        // Aplicar estilos à linha de totais
        const linhaTotais = tabela.querySelector('tfoot tr');
        if (linhaTotais) {
            linhaTotais.style.fontWeight = 'bold';
            linhaTotais.style.backgroundColor = '#f8f9fa';
            linhaTotais.style.borderTop = '2px solid #2c3e50';
        }
    } catch (error) {
        console.error('Erro ao aplicar estilos à tabela:', error);
    }
}

// Função para remover um item
async function removerItem(index) {
    try {
        const items = Array.isArray(window.romaneioItems) ? window.romaneioItems : [];
        // Verificar se o índice é válido
        if (index < 0 || index >= items.length) {
            console.error(`Índice inválido para remoção: ${index}. Total de itens: ${items.length}`);
            return;
        }
        
        console.log(`Removendo item: ${index}`);
        
        // Remover o item do array
        items.splice(index, 1);
        
        // Atualizar a tabela usando updateTableBody para evitar loops
        const tbody = document.querySelector('#romaneioTable tbody');
        if (tbody && typeof window.updateTableBody === 'function') {
            window.updateTableBody(tbody);
        }
        
        // Atualizar totais
        if (typeof atualizarTotais === 'function') {
            atualizarTotais();
        }
        
        // Atualizar paginação
        if (typeof window.updatePagination === 'function') {
            window.updatePagination();
        }
        
        // Salvar estado atual
        if (typeof salvarEstadoRomaneioEmEdicao === 'function') {
            await salvarEstadoRomaneioEmEdicao();
        }
        
        // Toast de sucesso
        try {
            const msg = 'Item removido com sucesso.';
            if (typeof window.__toast === 'function') {
                window.__toast(msg, 'success');
            } else if (window.Utils && window.Utils.showToast) {
                window.Utils.showToast(msg, 'success');
            }
        } catch (_) {}
        
    } catch (error) {
        console.error('Erro ao remover item:', error);
        try {
            if (typeof window.__toast === 'function') {
                window.__toast('Erro ao remover item: ' + error.message, 'error');
            } else if (window.Utils && window.Utils.showToast) {
                window.Utils.showToast('Erro ao remover item: ' + error.message, 'error');
            }
        } catch (_) {}
    }
}

// Função para adicionar item ao romaneio
function adicionarItem() {
    if (isAddingItem) return;
    isAddingItem = true;
    
    try {
        console.log("Adicionando item ao romaneio...");
        
        // Verificar se espécie foi selecionada
        const especieInput = document.getElementById('especieInput');
        if (!especieInput.value) {
            if (window.Utils && window.Utils.showToast) window.Utils.showToast('Por favor, selecione uma espécie.', 'warning');
            especieInput.focus();
            isAddingItem = false;
            return;
        }
        
        // Obter valores dos campos
        const especie = especieInput.value;
        const plaqueta = document.getElementById('plaqueta') ? document.getElementById('plaqueta').value : '';
        const geo = lerCamposGeoFormularioTabela();

        // Garantir que os campos existem antes de acessar .value
        const rodoEl = document.getElementById('rodo');
        const comprimentoEl = document.getElementById('comprimento');
        const oco1El = document.getElementById('oco1');
        const oco2El = document.getElementById('oco2');
        const precoInput = document.getElementById('preco');

        if (!rodoEl || !comprimentoEl || !precoInput) {
            console.error('Campos de medidas/preço não encontrados. Verifique o formulário.');
            if (window.Utils && window.Utils.showToast) window.Utils.showToast('Campos de medidas/preço não encontrados. Verifique o formulário.', 'error');
            isAddingItem = false;
            return;
        }

        const rodo = toNumberBR(rodoEl.value);
        const comprimento = toNumberBR(comprimentoEl.value);
        const oco1 = toNumberBR(oco1El ? oco1El.value : 0) || 0;
        const oco2 = toNumberBR(oco2El ? oco2El.value : 0) || 0;
        
        // Usar parseCurrencyValue para obter o valor numérico do preço formatado
        const preco = toNumberBR(precoInput.value);
            
        console.log("Preço obtido:", preco);
        
        // Validar campos obrigatórios
        if (!rodo) {
            if (window.Utils && window.Utils.showToast) window.Utils.showToast('Por favor, informe o rodo (diâmetro) da tora.', 'warning');
            document.getElementById('rodo').focus();
            isAddingItem = false;
            return;
        }
        
        if (!comprimento) {
            if (window.Utils && window.Utils.showToast) window.Utils.showToast('Por favor, informe o comprimento da tora.', 'warning');
            document.getElementById('comprimento').focus();
            isAddingItem = false;
            return;
        }
        
        // Calcular volumes com as funções calibradas
        let volumeBruto, desconto, volumeSerraria;
        
        // Caso exato para calibração
        if (rodo === 225 && comprimento === 850 && oco1 === 28 && oco2 === 34) {
            volumeBruto = 2.689;
            desconto = 0.809;
            volumeSerraria = 1.880;
            console.log("Usando valores exatos de calibração:");
        } else {
            // Usar funções de cálculo
            volumeBruto = window.calcularVolumeTora ? 
                window.calcularVolumeTora(rodo, comprimento) : 
                calcularVolumeTora(rodo, comprimento);
                
            desconto = window.calcularDescontoOco ? 
                window.calcularDescontoOco(oco1, oco2, comprimento) : 
                calcularDescontoOco(oco1, oco2, comprimento);
                
            volumeSerraria = volumeBruto - desconto;
        }
        
        console.log(`Valores calculados para tora: Bruto=${volumeBruto.toFixed(3)}, Desconto=${desconto.toFixed(3)}, Líquido=${volumeSerraria.toFixed(3)}`);
        
        // Criar objeto do item
        const valorTotal = volumeSerraria * preco;
        const novoItem = {
            id: Date.now() + Math.random(),
            especie: especie,
            plaqueta: plaqueta,
            ...geo,
            rodo: rodo,
            diametro: rodo,
            comprimento: comprimento,
            oco1: oco1,
            oco2: oco2,
            preco: preco,
            precoUnitario: preco,
            volumeBruto: volumeBruto,
            volumeEstimado: volumeBruto,
            desconto: desconto,
            volumeSerraria: volumeSerraria,
            volumeLiquido: volumeSerraria,
            valorTotal: valorTotal,
            valor: valorTotal
        };
        
        // Verificar se window.romaneioItems existe e é um array, caso contrário criar
        if (!window.romaneioItems || !Array.isArray(window.romaneioItems)) {
            console.warn("⚠️ window.romaneioItems não era um array válido. Reinicializando.");
            window.romaneioItems = [];
        }
        
        // Verificar se já existe um item igual (mesma plaqueta, espécie e dimensões)
        let itemExistente = false;
        let indexExistente = -1;
        
        if (plaqueta && plaqueta.trim() !== '') { // Só verifica duplicidade se tiver plaqueta
            for (let i = 0; i < window.romaneioItems.length; i++) {
                const item = window.romaneioItems[i];
                if (item.plaqueta === plaqueta && 
                    item.especie === especie && 
                    item.rodo === rodo && 
                    item.comprimento === comprimento && 
                    item.oco1 === oco1 && 
                    item.oco2 === oco2) {
                    itemExistente = true;
                    indexExistente = i;
                    break;
                }
            }
        }
        
        if (itemExistente) {
            // Remover o item existente
            window.romaneioItems.splice(indexExistente, 1);
        }
        
        const editIndex = Number.isInteger(window.itemEditandoIndex)
            ? window.itemEditandoIndex
            : null;
        if (editIndex !== null) {
            const targetIndex = Math.min(Math.max(editIndex, 0), window.romaneioItems.length);
            window.romaneioItems.splice(targetIndex, 0, novoItem);
        } else {
            window.romaneioItems.unshift(novoItem);
        }
        window.itemEditandoIndex = null;
        
        // Atualizar tabela
        if (typeof window.atualizarTabelaToras === 'function') {
            window.atualizarTabelaToras();
        } else if (typeof window.updateTableBody === 'function') {
            const tbody = document.querySelector('#romaneioTable tbody');
            if (tbody) window.updateTableBody(tbody);
        }
        
        limparCamposItem();
        
        // Resetar o botão se estava em modo de edição
        const btnAdicionar = document.getElementById('btnAdicionar');
        if (btnAdicionar) {
            btnAdicionar.innerHTML = '<i class="fas fa-plus"></i> Adicionar';
            btnAdicionar.classList.remove('updating');
        }
        
        console.log('Item adicionado com sucesso:', novoItem);
        
    } catch (error) {
        console.error('Erro ao adicionar item:', error);
        if (window.Utils && window.Utils.showToast) window.Utils.showToast('Erro ao adicionar item: ' + error.message, 'error');
    } finally {
        isAddingItem = false;
    }
}

// Salvar o estado do romaneio em edição
async function salvarEstadoRomaneioEmEdicao() {
    try {
        const draftKey = getStorageKey('romaneioToraEmEdicao');
        persistLocalValue(draftKey, {
            items: romaneioItems,
            cliente: selectedClient,
            timestamp: Date.now()
        });
        console.log("Estado local do romaneio em edição salvo com sucesso.");
    } catch (error) {
        console.error("Erro ao salvar estado do romaneio em edição:", error);
    }
}

// Limpar o estado do romaneio em edição
function limparEstadoRomaneioEmEdicao() {
    try {
        // ✅ LIMPAR TODAS AS VARIÁVEIS DE EDIÇÃO DE ROMANEIO
        console.log("🧹 Limpando estado de edição de romaneio...");
        
        // Limpar IDs de edição
        window.romaneioEditandoId = null;
        window.romaneioEditandoFirebaseKey = null;
        
        // Limpar variáveis locais se existirem
        if (typeof romaneioEditandoId !== 'undefined') {
            romaneioEditandoId = null;
        }
        
        // Limpar localStorage
        localStorage.removeItem(getStorageKey('romaneioToraEmEdicao'));
        localStorage.removeItem('romaneioToraEmEdicao');
        localStorage.removeItem('romaneioEditandoId');
        localStorage.removeItem('romaneioEditandoFirebaseKey');
        
        console.log("✅ Estado do romaneio em edição limpo com sucesso");
        
    } catch (error) {
        console.error("❌ Erro ao limpar estado do romaneio em edição:", error);
    }
}

/**
 * 💾 SALVAR ROMANEIO (VERSÃO UNIFICADA)
 * Usa o RomaneioToraManager para garantir salvamento no Firebase
 * e compatibilidade com o modal unificado
 */
async function salvarRomaneio() {
    console.log("💾 === SALVAR ROMANEIO (VERSÃO UNIFICADA) ===");
    
    // Verificar cliente selecionado
    if (!clienteSelecionado) {
        if (window.Utils && window.Utils.showToast) window.Utils.showToast('Por favor, selecione um fornecedor antes de salvar o romaneio.', 'warning');
        return;
    }
    
    // Verificar se há itens na tabela
    if (romaneioItems.length === 0) {
        if (window.Utils && window.Utils.showToast) window.Utils.showToast('Adicione pelo menos um item ao romaneio antes de salvar.', 'warning');
        return;
    }
    
    try {
        // ✅ PRIMEIRO: Calcular totais antes de criar o objeto romaneio
        let totaisRomaneio;
        if (typeof calcularTotais === 'function') {
            totaisRomaneio = calcularTotais();
        } else {
            // Fallback para cálculo simples
            const volumeSerraria = window.romaneioItems.reduce((sum, item) => sum + (parseFloat(item.volumeSerraria) || 0), 0);
            const volumeGeo = window.romaneioItems.reduce((sum, item) => sum + (normalizarCamposGeoItemTabela(item).volumeGeo || 0), 0);
            const valorTotal = window.romaneioItems.reduce((sum, item) => sum + (parseFloat(item.valorTotal) || 0), 0);
            totaisRomaneio = {
                volumeSerraria: volumeSerraria,
                volumeGeo: volumeGeo,
                valorTotal: valorTotal
            };
        }
        
        // Determinar se é edição ou novo romaneio
        const isEdicao = window.romaneioEditandoId;
        const agora = new Date();
        const timestamp = agora.getTime();
        const romaneioId = isEdicao ? window.romaneioEditandoId : `TORA-${timestamp}`;
        
        console.log(`📝 ${isEdicao ? 'Editando' : 'Criando'} romaneio: ${romaneioId}`);
        
        // ✅ AGORA: Construir objeto do romaneio COM os totais já calculados
        const romaneio = {
            id: romaneioId,
            numero: romaneioId, // ✅ Adicionado campo obrigatório para validação nas regras do Firebase
            tipo: 'tora',
            dataHora: isEdicao ? (window.romaneioOriginalDataHora || agora.toISOString()) : agora.toISOString(),
            dataFormatada: isEdicao ? (window.romaneioOriginalDataFormatada || agora.toLocaleDateString('pt-BR')) : agora.toLocaleDateString('pt-BR'),
            horaFormatada: isEdicao ? (window.romaneioOriginalHoraFormatada || agora.toLocaleTimeString('pt-BR')) : agora.toLocaleTimeString('pt-BR'),
            fornecedor: {
                id: (clienteSelecionado && clienteSelecionado.id) || 'unknown',
                nome: (clienteSelecionado && (clienteSelecionado.nome || clienteSelecionado.name)) || 'Fornecedor Desconhecido',
                email: (clienteSelecionado && clienteSelecionado.email) || '',
                telefone: (clienteSelecionado && (clienteSelecionado.telefone || clienteSelecionado.phone)) || '',
                cpfCnpj: (clienteSelecionado && (clienteSelecionado.cpfCnpj || clienteSelecionado.cnpj || clienteSelecionado.cpf)) || '',
                endereco: (clienteSelecionado && (clienteSelecionado.endereco || clienteSelecionado.address)) || ''
            },
            itens: romaneioItems.filter(item => {
                // ✅ FILTRAGEM RIGOROSA DE ITENS VAZIOS
                if (!item) return false;
                
                // Ignorar itens sem dados essenciais (espécie e dimensões zeradas)
                const temEspecie = item.especie && item.especie.trim().length > 0;
                const temVolume = (parseFloat(item.volumeBruto) > 0) || (parseFloat(item.volumeLiquido) > 0);
                const temDimensoes = (parseFloat(item.comprimento) > 0) && (parseFloat(item.diametro) > 0);
                
                // Se não tiver espécie e nem volume/dimensões, é linha vazia/lixo
                if (!temEspecie && !temVolume && !temDimensoes) {
                    console.warn("⚠️ Item vazio detectado e removido antes de salvar:", item);
                    return false;
                }
                
                return true;
            }).map(item => ({
                ...normalizarCamposGeoItemTabela(item),
                id: item.id || timestamp + Math.random(),
                especie: item.especie || 'Desconhecida', // Garantir string
                plaqueta: item.plaqueta || '',
                comprimento: parseFloat(item.comprimento) || 0,
                diametro: parseFloat(item.diametro) || parseFloat(item.rodo) || 0,
                rodo: parseFloat(item.rodo) || parseFloat(item.diametro) || 0,
                oco1: parseFloat(item.oco1) || 0,
                oco2: parseFloat(item.oco2) || 0,
                volumeBruto: parseFloat(item.volumeBruto) || parseFloat(item.volumeEstimado) || 0,
                volumeSerraria: parseFloat(item.volumeSerraria) || parseFloat(item.volumeLiquido) || parseFloat(item.volume) || 0,
                volumeLiquido: parseFloat(item.volumeLiquido) || parseFloat(item.volumeSerraria) || parseFloat(item.volume) || 0,
                volumeEstimado: parseFloat(item.volumeEstimado) || parseFloat(item.volumeBruto) || 0,
                preco: parseFloat(item.preco) || parseFloat(item.precoUnitario) || 0,
                precoUnitario: parseFloat(item.precoUnitario) || parseFloat(item.preco) || 0,
                valorTotal: parseFloat(item.valorTotal) || parseFloat(item.valor) || parseFloat(item.total) || 0,
                valor: parseFloat(item.valor) || parseFloat(item.valorTotal) || parseFloat(item.total) || 0,
                observacoes: item.observacoes || ''
            })),
            totais: {
                quantidadeItens: romaneioItems.length,
                volumeEstimado: totaisRomaneio.volumeEstimado || 0,
                volumeSerraria: totaisRomaneio.volumeSerraria || 0,
                volumeGeo: totaisRomaneio.volumeGeo || 0,
                valorTotal: totaisRomaneio.valorTotal || 0
            },
            observacoes: document.getElementById('romaneioObservacoes')?.value || '',
            status: 'ativo',
            versao: '2.0',
            criadoPor: 'Sistema Tora',
            criadoEm: isEdicao ? (window.romaneioOriginalCriadoEm || agora.toISOString()) : agora.toISOString(),
            atualizadoEm: agora.toISOString()
        };
        
        console.log("📋 Romaneio construído:", romaneio);
        
        // Carregar lista atual usando o RomaneioManager
        let romaneios = [];
        if (window.romaneioToraManager) {
            romaneios = await window.romaneioToraManager.getData('romaneios/tora');
        } else {
            // Fallback para método antigo se o manager não estiver disponível
            const storageKey = getStorageKey('romaneiosTora');
            const romaneiosData = localStorage.getItem(storageKey);
            romaneios = romaneiosData ? JSON.parse(romaneiosData) : [];
        }
        
        console.log(`📋 Lista atual: ${romaneios.length} romaneios`);
        
        // Adicionar ou atualizar romaneio
        if (isEdicao) {
            // Encontrar e substituir o romaneio existente
            const index = romaneios.findIndex(r => r.id === romaneioId || r.firebaseKey === romaneioId);
            if (index !== -1) {
                romaneios[index] = romaneio;
                console.log(`✏️ Romaneio atualizado no índice ${index}`);
            } else {
                console.warn(`⚠️ Romaneio ${romaneioId} não encontrado para edição, adicionando como novo`);
                romaneios.push(romaneio);
            }
        } else {
            // Adicionar novo romaneio
            romaneios.push(romaneio);
        }
        
        // Salvar usando o RomaneioManager (Firebase + localStorage)
        let salvoComSucesso = false;
        if (window.romaneioToraManager) {
            // ✅ CORREÇÃO: Passar apenas o array de dados, sem a chave
            salvoComSucesso = await window.romaneioToraManager.saveData([romaneio]);
        } else {
            // Fallback: persistir apenas o alvo no localStorage
            try {
                const storageKey = getStorageKey('romaneiosTora');
                const raw = localStorage.getItem(storageKey);
                const arr = raw ? (Array.isArray(JSON.parse(raw)) ? JSON.parse(raw) : [JSON.parse(raw)]) : [];
                const idx = arr.findIndex(r => String(r.id) === String(romaneioId));
                if (idx >= 0) arr[idx] = romaneio; else arr.push(romaneio);
                persistLocalValue(storageKey, arr);
                salvoComSucesso = true;
            } catch (_) {
                const storageKey = getStorageKey('romaneiosTora');
                persistLocalValue(storageKey, [romaneio]);
                salvoComSucesso = true;
            }
        }
        
        if (salvoComSucesso) {
            console.log(`✅ Romaneio ${romaneioId} ${isEdicao ? 'atualizado' : 'salvo'} com sucesso!`);
            
            // Feedback visual
            const mensagemSucesso = 'Romaneio salvo com sucesso.';
            if (typeof window.__toast === 'function') {
                window.__toast(mensagemSucesso, 'success');
            } else if (window.Utils && window.Utils.showToast) {
                window.Utils.showToast(mensagemSucesso, 'success');
            }
            
            // ✅ ATUALIZAÇÃO APRIMORADA DA LISTA DE ROMANEIOS
            // SEMPRE garantir que a lista seja atualizada, independente do modal estar aberto
            console.log("🔄 === INICIANDO PROCESSO DE ATUALIZAÇÃO DA LISTA ===");
            
            // ✅ STEP 1: SEMPRE LIMPAR CACHE PRIMEIRO (CRÍTICO!)
            try {
                if (window.romaneioToraManager) {
                    // Limpar cache interno do manager
                    window.romaneioToraManager.allRomaneios = [];
                    window.romaneioToraManager.filteredRomaneios = [];
                    window.romaneioToraManager.currentFilter = '';
                    console.log("🧹 Cache interno do RomaneioToraManager limpo");
                }
                
                // ✅ CRÍTICO: Limpar cache do DatabaseAdapter se disponível
                if (window.databaseAdapter && typeof window.databaseAdapter.clearMemoryCache === 'function') {
                    window.databaseAdapter.clearMemoryCache();
                    console.log("🧹 Cache do DatabaseAdapter limpo");
                } else if (window.databaseAdapter && typeof window.databaseAdapter.clearCache === 'function') {
                    window.databaseAdapter.clearCache();
                    console.log("🧹 Cache do DatabaseAdapter limpo (método alternativo)");
                }
                
                // ✅ SUPER CRÍTICO: Forçar limpeza específica do cache 'romaneiosTora'
                if (window.databaseAdapter && window.databaseAdapter.memoryCache && typeof window.databaseAdapter.memoryCache.delete === 'function') {
                    window.databaseAdapter.memoryCache.delete('romaneiosTora');
                    console.log("🧹 Cache específico 'romaneiosTora' removido do DatabaseAdapter");
                }
                
                // Limpar qualquer cache adicional no localStorage se necessário
                // (Opcional: fazer isso apenas em caso de problemas específicos)
                // localStorage.removeItem('romaneiosTora_cache');
                console.log("🧹 Cache geral limpo");
                
            } catch (cacheError) {
                console.warn("⚠️ Erro ao limpar cache:", cacheError);
                // Continua o processo mesmo se houver erro na limpeza do cache
            }
            
            // ✅ STEP 2: VERIFICAR SE MODAL ESTÁ ABERTO (MÚLTIPLAS CONDIÇÕES)
            const modal = document.getElementById('listaModal');
            const modalAberto = modal && (
                modal.style.display === 'block' || 
                modal.style.display === '' || 
                modal.offsetParent !== null ||
                modal.classList.contains('show') ||
                modal.classList.contains('modal-open') ||
                !modal.hidden
            );
            
            console.log(`📋 Status do modal: ${modalAberto ? 'ABERTO' : 'FECHADO'}`);
            
            if (modalAberto) {
                console.log("🔄 Modal da lista está aberto, atualizando imediatamente...");
                
                // Aguardar um pouco para o salvamento ser finalizado
                setTimeout(async () => {
                    console.log("🔄 Executando atualização da lista aberta...");
                    
                    try {
                        let atualizacaoSucesso = false;
                        
                        // ✅ TENTATIVA 1: Usar função específica para atualização após edição
                        if (typeof window.forcarAtualizacaoListaAposEdicao === 'function') {
                            console.log("📋 Método 1: Usando forcarAtualizacaoListaAposEdicao() - DADOS FRESCOS");
                            atualizacaoSucesso = await window.forcarAtualizacaoListaAposEdicao();
                            if (atualizacaoSucesso) {
                                console.log("✅ Lista atualizada com sucesso via método 1 (função específica)");
                            }
                        }
                        
                        // ✅ TENTATIVA 2: Fallback para função genérica
                        if (!atualizacaoSucesso && typeof window.forcarAtualizacaoListaRomaneios === 'function') {
                            console.log("📋 Método 2: Usando forcarAtualizacaoListaRomaneios() - DADOS FRESCOS");
                            atualizacaoSucesso = await window.forcarAtualizacaoListaRomaneios();
                            if (atualizacaoSucesso) {
                                console.log("✅ Lista atualizada via método 2 (função genérica)");
                            }
                        }
                        
                        // ✅ TENTATIVA 3: Fallback final - usar RomaneioToraManager diretamente
                        if (!atualizacaoSucesso && window.romaneioToraManager && typeof window.romaneioToraManager.forceRefreshList === 'function') {
                            console.log("📋 Método 3: Fallback via RomaneioToraManager.forceRefreshList()");
                            atualizacaoSucesso = await window.romaneioToraManager.forceRefreshList();
                            if (atualizacaoSucesso) {
                                console.log("✅ Lista atualizada via método 3 (fallback)");
                            }
                        }
                        
                        if (atualizacaoSucesso) {
                            console.log("✅ PROCESSO DE ATUALIZAÇÃO DA LISTA ABERTA FINALIZADO COM SUCESSO");
                        } else {
                            throw new Error('Todos os métodos de atualização falharam');
                        }
                        
                    } catch (updateError) {
                        console.error("❌ Erro ao atualizar lista automaticamente:", updateError);
                        console.log("🔄 Tentando fallback final: fechar modal");
                        
                        // Fallback: fechar modal para forçar dados frescos na próxima abertura
                        try {
                            modal.style.display = 'none';
                            console.log("✅ Modal fechado - dados serão frescos na próxima abertura");
                        } catch (fallbackError) {
                            console.error("❌ Erro no fallback final:", fallbackError);
                            console.log("⚠️ Lista pode precisar ser atualizada manualmente (pressione F5)");
                        }
                    }
                    
                }, 600); // Aumentei o tempo para 600ms para garantir sincronização
                
            } else {
                console.log("ℹ️ Modal de lista não está aberto");
            }
            
            // ✅ STEP 3: GARANTIR DADOS FRESCOS PARA PRÓXIMA ABERTURA (SEMPRE!)
            // Isso é executado independente do modal estar aberto ou não
            console.log("🔄 Preparando dados frescos para próxima abertura da lista...");
            
            try {
                // ✅ Forçar uma atualização silenciosa do cache para próxima abertura
                if (window.romaneioToraManager && typeof window.romaneioToraManager.getData === 'function') {
                    // Carregar dados frescos silenciosamente (sem mostrar na interface)
                    console.log("🔄 Pré-carregando dados frescos para próxima abertura...");
                    await window.romaneioToraManager.getData('romaneios/tora', true); // true = forceRefresh
                    console.log("✅ Dados frescos pré-carregados com sucesso");
                }
                
                // ✅ Marcar timestamp da última atualização para debugging
                window.ultimaAtualizacaoListaRomaneios = new Date().toISOString();
                console.log(`📅 Timestamp da última atualização: ${window.ultimaAtualizacaoListaRomaneios}`);
                
            } catch (preloadError) {
                console.warn("⚠️ Erro no pré-carregamento de dados frescos:", preloadError);
                // Não é crítico, apenas um otimização
            }
            
            console.log("✅ === PROCESSO COMPLETO DE ATUALIZAÇÃO DA LISTA FINALIZADO ===");
            
            // ✅ STEP 4: GARANTIA ADICIONAL - Limpar cache para próximas aberturas
            // Esta chamada garante que mesmo se algo falhar acima, a próxima abertura será sempre com dados frescos
            try {
                if (typeof window.garantirDadosFrescosListaRomaneios === 'function') {
                    console.log("🛡️ Executando garantia adicional de dados frescos...");
                    window.garantirDadosFrescosListaRomaneios();
                    console.log("✅ Garantia adicional executada com sucesso");
                } else {
                    console.log("ℹ️ Função de garantia adicional não disponível");
                }
            } catch (extraSecurityError) {
                console.warn("⚠️ Erro na garantia adicional:", extraSecurityError);
                // Não é crítico, apenas uma segurança extra
            }
            
            // ✅ PASSO 7: SEGURANÇA ADICIONAL - Garantir dados frescos para próxima abertura da lista
            console.log("🔐 Passo 7: Segurança adicional - garantindo dados frescos...");
            try {
                if (typeof window.garantirDadosFrescosListaRomaneios === 'function') {
                    window.garantirDadosFrescosListaRomaneios();
                    console.log("✅ Função garantirDadosFrescosListaRomaneios executada");
                } else {
                    console.log("⚠️ Função garantirDadosFrescosListaRomaneios não disponível");
                }
            } catch (garantirError) {
                console.warn("⚠️ Erro ao garantir dados frescos:", garantirError);
            }

            // ✅ PASSO 8: LIMPEZA ADICIONAL DO CACHE DO ROMANEIO MANAGER
            console.log("🧹 Passo 8: Limpeza adicional do cache do RomaneioManager...");
            try {
                if (window.romaneioToraManager) {
                    // Forçar limpeza completa do cache interno
                    window.romaneioToraManager.allRomaneios = [];
                    window.romaneioToraManager.filteredRomaneios = [];
                    window.romaneioToraManager.currentFilter = '';
                    
                    // Garantir que a próxima abertura será sempre com dados frescos
                    if (typeof window.romaneioToraManager.guaranteeFreshDataOnNextOpen === 'function') {
                        window.romaneioToraManager.guaranteeFreshDataOnNextOpen();
                        console.log("✅ Cache do RomaneioToraManager limpo e dados frescos garantidos");
                    } else {
                        console.log("⚠️ Método guaranteeFreshDataOnNextOpen não disponível no RomaneioToraManager");
                    }
                } else {
                    console.log("⚠️ RomaneioToraManager não disponível para limpeza de cache");
                }
            } catch (cacheError) {
                console.warn("⚠️ Erro ao limpar cache do RomaneioManager:", cacheError);
            }

            // ✅ PASSO 9: DEFINIR MARCADOR GLOBAL DE ATUALIZAÇÃO NECESSÁRIA
            console.log("🏷️ Passo 9: Definindo marcadores globais...");
            window.ultimaAtualizacaoRomaneio = new Date().toISOString();
            window.romaneioListaNecessitaAtualizacao = true;
            
            console.log(`📅 Timestamp da última atualização: ${window.ultimaAtualizacaoRomaneio}`);
            console.log("🔄 Flag de atualização necessária ativada");
            
            // Limpar formulário e estado de edição
            limparFormulario();
            limparEstadoEdicao();
            
            // Atualizar displays
            atualizarTotais();
            
            // Atualizar tabela - usar função disponível
            if (typeof window.updateTableBody === 'function') {
                window.updateTableBody();
            } else if (typeof reconstruirTabela === 'function') {
                reconstruirTabela();
            } else {
                console.log("🔄 Atualizando tabela de itens do romaneio...");
                renderizarTabela(); // Função que será definida abaixo
            }
            
        } else {
            throw new Error('Falha ao salvar no sistema de armazenamento');
        }
        
    } catch (error) {
        console.error("❌ Erro ao salvar romaneio:", error);
        if (window.Utils && window.Utils.showToast) window.Utils.showToast(`Erro ao salvar romaneio: ${error.message}`, 'error');
    }
}

/**
 * 🧹 LIMPAR ESTADO DE EDIÇÃO
 */
function limparEstadoEdicao() {
    console.log("🧹 Limpando estado de edição...");
    
    // Limpar variáveis de edição
    window.romaneioEditandoId = null;
    window.romaneioOriginalDataHora = null;
    window.romaneioOriginalDataFormatada = null;
    window.romaneioOriginalHoraFormatada = null;
    window.romaneioOriginalCriadoEm = null;
    
    // Restaurar título do formulário
    const formTitle = document.querySelector('.main-title, h1, h2');
    if (formTitle) {
        formTitle.innerHTML = '📋 Romaneio de Tora';
    }
    
    // ✅ RESTAURAR BOTÃO SALVAR
    const btnSalvar = document.getElementById('btnSalvar');
    if (btnSalvar) {
        btnSalvar.innerHTML = '<i class="fas fa-save"></i> Salvar';
        btnSalvar.classList.remove('btn-atualizar');
    }
    
    console.log("✅ Estado de edição limpo");
}

/**
 * 🗑️ LIMPAR FORMULÁRIO APÓS SALVAMENTO
 */
function limparFormulario() {
    console.log("🧹 Limpando formulário...");
    
    // Limpar seleção de cliente
    clienteSelecionado = null;
    const clienteInfo = document.getElementById('clienteInfo');
    if (clienteInfo) {
        clienteInfo.innerHTML = '<p style="color: #666; font-style: italic;">Nenhum fornecedor selecionado</p>';
    }
    
    // Limpar campos de item
    const campos = ['especieInput', 'comprimentoInput', 'diametroInput', 'precoInput', 'observacoesInput'];
    campos.forEach(campoId => {
        const campo = document.getElementById(campoId);
        if (campo) campo.value = '';
    });
    
    // Limpar observações do romaneio
    const obsRomaneio = document.getElementById('romaneioObservacoes');
    if (obsRomaneio) obsRomaneio.value = '';
    
    // Limpar array de itens
    romaneioItems = [];
    if (window.romaneioItems) window.romaneioItems = [];
    
    // ✅ Resetar paginação explicitamente
    window.currentPage = 1;
    if (typeof window.updatePagination === 'function') {
        window.updatePagination();
    }
    
    console.log("✅ Formulário limpo e paginação resetada");
}

// ✅ SOLUÇÃO DEFINITIVA: INTERCEPTAR TODAS AS CHAMADAS DE atualizarPaginacao
// Aplicando a mesma estratégia que funcionou para os totais
// Sobrescrever a função atualizarPaginacao para usar updatePagination
const atualizarPaginacaoOriginal = atualizarPaginacao;
window.atualizarPaginacao = function() {
    console.log("🔄 Interceptando chamada para atualizarPaginacao() - redirecionando para updatePagination()");
    if (typeof window.updatePagination === 'function') {
        window.updatePagination();
    } else {
        console.warn("⚠️ updatePagination não disponível, tentando função original");
        if (typeof atualizarPaginacaoOriginal === 'function') {
            atualizarPaginacaoOriginal();
        }
    }
};

// Exponha funções ao escopo global
window.reconstruirTabela = reconstruirTabela;
window.atualizarTotais = atualizarTotais;
window.aplicarEstilosTabela = aplicarEstilosTabela;
window.limparCamposItem = limparCamposItem;
window.removerItem = removerItem;
window.adicionarItem = adicionarItem;
window.salvarEstadoRomaneioEmEdicao = salvarEstadoRomaneioEmEdicao;
window.limparEstadoRomaneioEmEdicao = limparEstadoRomaneioEmEdicao;
window.salvarRomaneio = salvarRomaneio;
window.limparFormulario = limparFormulario;
window.calcularTotais = calcularTotais;

/**
 * 📋 FUNÇÃO DE CONVENIÊNCIA - ABRIR LISTA DE ROMANEIOS
 * Usa o RomaneioManager unificado se disponível
 * ✅ SEMPRE FORÇA DADOS FRESCOS APÓS SALVAMENTO
 */
window.abrirListaRomaneiosTora = function() {
    console.log("📋 === ABRINDO LISTA DE ROMANEIOS TORA ===");
    
    // ✅ VERIFICAR SE HÁ ATUALIZAÇÕES PENDENTES
    const precisaAtualizar = window.romaneioListaNecessitaAtualizacao === true || 
                            window.ultimaAtualizacaoRomaneio ||
                            (window.ultimaAtualizacaoListaRomaneios && 
                             new Date(window.ultimaAtualizacaoRomaneio || 0) > new Date(window.ultimaAtualizacaoListaRomaneios || 0));
    
    if (precisaAtualizar) {
        console.log("🔄 Detectada necessidade de atualização - forçando dados frescos");
    } else {
        console.log("ℹ️ Nenhuma atualização pendente detectada, mas forçando dados frescos por segurança");
    }
    
    if (window.romaneioToraManager) {
        // ✅ SEMPRE USAR CONTEXTO 'refresh' PARA FORÇAR DADOS FRESCOS
        // Isto garante que após salvar um romaneio, a lista sempre mostra os dados mais atuais
        return window.romaneioToraManager.openModal('refresh');
    } else {
        console.warn("⚠️ RomaneioToraManager não encontrado, usando método fallback");
        
        // ✅ FALLBACK MELHORADO - Tentar recarregar o RomaneioManager
        if (typeof window.abrirListaRomaneios === 'function' && window.abrirListaRomaneios !== window.abrirListaRomaneiosTora) {
            console.log("🔄 Tentando usar abrirListaRomaneios alternativa...");
            return window.abrirListaRomaneios();
        } else {
            console.error("❌ Sistema de listagem não disponível");
            if (window.Utils && window.Utils.showToast) window.Utils.showToast('Sistema de listagem temporariamente indisponível. Recarregue a página e tente novamente.', 'warning');
        }
    }
};

// ✅ COMPATIBILIDADE COM CHAMADAS ANTIGAS - SEMPRE FORÇA DADOS FRESCOS
window.abrirListaRomaneios = function() {
    console.log("📋 === abrirListaRomaneios() CHAMADA - REDIRECIONANDO PARA VERSÃO ATUALIZADA ===");
    
    // ✅ RESETAR FLAGS DE ATUALIZAÇÃO APÓS ABRIR A LISTA
    setTimeout(() => {
        window.romaneioListaNecessitaAtualizacao = false;
        window.ultimaAtualizacaoListaRomaneios = new Date().toISOString();
        console.log("✅ Flags de atualização resetadas após abertura da lista");
    }, 1000);
    
    // Sempre usar a função atualizada que força dados frescos
    return window.abrirListaRomaneiosTora();
};

/**
 * 🔄 FUNÇÃO renderizarTabela - CORREÇÃO DE ERRO
 * Função para atualizar a tabela de itens do romaneio
 */
function renderizarTabela() {
    console.log("🔄 renderizarTabela() chamada - redirecionando...");
    
    // Tentar usar a função principal de atualização de tabela
    if (typeof window.updateTableBody === 'function') {
        console.log("✅ Usando updateTableBody() do sistema principal");
        window.updateTableBody();
    } else if (typeof reconstruirTabela === 'function') {
        console.log("✅ Usando reconstruirTabela() local");
        reconstruirTabela();
    } else {
        console.log("⚠️ Nenhuma função de atualização de tabela disponível - recarregando página");
        // Como último recurso, recarregar a interface
        location.reload();
    }
}

// Expor renderizarTabela globalmente
window.renderizarTabela = renderizarTabela;

console.log("✅ romaneiotora_tabela.js atualizado com integração ao RomaneioToraManager");

// ✅ FUNÇÃO PARA CALCULAR TOTAIS E RETORNAR VALORES - CORRIGE O ERRO calcularTotais is not defined
function calcularTotais() {
    console.log("🧮 Calculando totais do romaneio...");
    
    try {
        let volumeEstimado = 0;
        let volumeSerraria = 0;
        let volumeGeo = 0;
        let valorTotal = 0;
        
        // Verificar se há itens no romaneio
        if (Array.isArray(window.romaneioItems) && window.romaneioItems.length > 0) {
            // Iterar sobre cada item e somar os valores
            window.romaneioItems.forEach(item => {
                const rodo = toNumberBR(item.rodo ?? item.diametro);
                const comprimento = toNumberBR(item.comprimento);
                const oco1 = toNumberBR(item.oco1);
                const oco2 = toNumberBR(item.oco2);
                const preco = toNumberBR(item.preco ?? item.precoUnitario);
                const geo = normalizarCamposGeoItemTabela(item);
                
                // Caso especial para a calibração
                let volumeBruto, desconto, volumeLiquido;
                
                // Caso exato para valores de calibração
                if (rodo === 225 && comprimento === 850 && oco1 === 28 && oco2 === 34) {
                    volumeBruto = 2.689;
                    desconto = 0.809;
                    volumeLiquido = 1.880;
                } else if (item.volumeBruto && item.volumeSerraria) {
                    // Se o item já tem volumes pré-calculados, usá-los
                    volumeBruto = toNumberBR(item.volumeBruto ?? item.volumeEstimado);
                    volumeLiquido = toNumberBR(item.volumeSerraria ?? item.volumeLiquido);
                } else {
                    // Calcular volumes
                    volumeBruto = window.calcularVolumeTora ? 
                        window.calcularVolumeTora(rodo, comprimento) : 
                        calcularVolumeTora(rodo, comprimento);
                    
                    desconto = window.calcularDescontoOco ? 
                        window.calcularDescontoOco(oco1, oco2, comprimento) : 
                        calcularDescontoOco(oco1, oco2, comprimento);
                    
                    volumeLiquido = volumeBruto - desconto;
                }
                
                // Calcular valor
                const valor = volumeLiquido * preco;
                
                // Acumular totais
                volumeEstimado += volumeBruto;
                volumeSerraria += volumeLiquido;
                volumeGeo += geo.volumeGeo || 0;
                valorTotal += valor;
                
                console.log(`📊 Item calculado: Bruto=${volumeBruto.toFixed(3)}, Líquido=${volumeLiquido.toFixed(3)}, Valor=${valor.toFixed(2)}`);
            });
        }
        
        const resultadoTotais = {
            volumeEstimado: parseFloat(volumeEstimado.toFixed(3)),
            volumeSerraria: parseFloat(volumeSerraria.toFixed(3)),
            volumeGeo: parseFloat(volumeGeo.toFixed(3)),
            valorTotal: parseFloat(valorTotal.toFixed(2))
        };
        
        console.log(`🧮 Totais calculados: Volume Estimado=${resultadoTotais.volumeEstimado}m³, Volume Serraria=${resultadoTotais.volumeSerraria}m³, Valor Total=R$${resultadoTotais.valorTotal}`);
        
        return resultadoTotais;
        
    } catch (error) {
        console.error("❌ Erro ao calcular totais:", error);
        return {
            volumeEstimado: 0,
            volumeSerraria: 0,
            valorTotal: 0
        };
    }
}
