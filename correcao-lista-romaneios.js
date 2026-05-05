/**
 * 🔧 CORREÇÃO LISTA ROMANEIOS - UTF-8 E DADOS
 * 
 * Este arquivo corrige dois problemas principais:
 * 1. Codificação UTF-8 incorreta nos textos
 * 2. Carregamento inadequado dos dados dos romaneios
 * 
 * @version 1.0.0
 * @created 2024
 */

// ✅ SCRIPT DESATIVADO PARA EVITAR LOOP INFINITO
// Este script estava causando problemas de performance e abertura automática de modais
// Desativado temporariamente até correção completa

console.log("🛑 === SCRIPT CORRECAO-LISTA-ROMANEIOS.JS DESATIVADO ===");
console.log("🛑 Motivo: Causando loop infinito e abertura automática de modais");
console.log("🛑 Use o script romaneiotora_modal_fix_final_cleaned.js para correções");

// Sair imediatamente sem executar nada
return;

console.log('🔧 Carregando correções para Lista de Romaneios...');

// Aguardar interface corrigida
async function aguardarInterfaceCorrigida() {
    console.log('🔧 Aguardando interface do DatabaseAdapter ser corrigida...');
    
    let tentativas = 0;
    const maxTentativas = 20; // 10 segundos
    
    while (tentativas < maxTentativas) {
        if (window.databaseAdapter && 
            typeof window.databaseAdapter.loadData === 'function' &&
            typeof window.databaseAdapter.saveData === 'function') {
            console.log('✅ Interface do DatabaseAdapter está pronta!');
            return true;
        }
        
        console.log(`⏳ Tentativa ${tentativas + 1}/${maxTentativas} - DatabaseAdapter não está pronto`);
        await new Promise(resolve => setTimeout(resolve, 500));
        tentativas++;
    }
    
    console.warn('⚠️ Timeout aguardando DatabaseAdapter');
    return false;
}

// Função corrigida para abrir lista de romaneios
async function abrirListaRomaneiosCorrigida() {
    console.log('📋 Abrindo Lista de Romaneios (VERSÃO CORRIGIDA)');
    
    try {
        // Usar o modal existente
        let modal = document.getElementById('listaModal');
        
        if (!modal) {
            console.error('❌ Modal listaModal não encontrado');
            return;
        }
        
        // Atualizar o conteúdo do modal com textos corretos E CONTROLES DE PAGINAÇÃO
        const modalBody = modal.querySelector('.modal-body');
        if (modalBody) {
            modalBody.innerHTML = `
                <div style="margin-bottom: 15px;">
                    <input type="text" id="romaneioListFilter" placeholder="Filtrar por fornecedor, espécie ou data..." 
                           style="width: 100%; padding: 10px; border: 1px solid #ddd; border-radius: 4px; font-size: 14px;">
                </div>
                <div class="table-container" style="max-height: 500px; overflow-y: auto; overflow-x: visible; position: relative;">
                    <table class="table" style="width: 100%;">
                        <thead style="position: sticky; top: 0; background-color: #2c3e50; color: white; z-index: 1;">
                            <tr>
                                <th style="padding: 10px;">Data</th>
                                <th style="padding: 10px;">Fornecedor</th>
                                <th style="padding: 10px;">Espécies</th>
                                <th style="padding: 10px;">Itens</th>
                                <th style="padding: 10px;">Volume (m³)</th>
                                <th style="padding: 10px;">Valor Total</th>
                                <th style="padding: 10px; width: 120px; text-align: center;">Ações</th>
                            </tr>
                        </thead>
                        <tbody id="romaneioListTable">
                            <tr>
                                <td colspan="7" style="text-align: center; padding: 20px;">
                                    <i class="fas fa-spinner fa-spin"></i> Carregando romaneios...
                                </td>
                            </tr>
                        </tbody>
                    </table>
                </div>
                
                <!-- ✅ CONTROLES DE PAGINAÇÃO PRESERVADOS -->
                <div id="paginationControls" style="display: none; justify-content: center; margin-top: 15px; gap: 5px;">
                    <!-- Os botões serão criados dinamicamente pela função updatePaginationControls -->
                </div>
            `;
        }
        
        // Configurar eventos do modal
        const closeBtn = modal.querySelector('.close-modal');
        if (closeBtn) {
            closeBtn.onclick = () => {
                modal.style.display = 'none';
            };
        }
        
        const closeBtns = modal.querySelectorAll('.close-modal-btn');
        closeBtns.forEach(btn => {
            btn.onclick = () => {
                modal.style.display = 'none';
            };
        });
        
        // Configurar filtro
        const filterInput = modal.querySelector('#romaneioListFilter');
        if (filterInput) {
            filterInput.addEventListener('input', function() {
                renderRomaneioListCorrigida(this.value);
            });
        }
        
        // Fechar ao clicar fora
        modal.onclick = function(e) {
            if (e.target === modal) {
                modal.style.display = 'none';
            }
        };
        
        // Renderizar lista
        await renderRomaneioListCorrigida('');
        
        // ✅ INTEGRAR COM SISTEMA DE PAGINAÇÃO DO RomaneioToraManager
        if (window.romaneioToraManager) {
            console.log('🔗 Integrando com sistema de paginação...');
            
            // Aguardar um momento para garantir que o modal foi renderizado
            setTimeout(() => {
                // Verificar se os controles de paginação foram criados
                const paginationControls = document.getElementById('paginationControls');
                if (paginationControls) {
                    console.log('✅ Controles de paginação encontrados, ativando funcionalidade...');
                    
                    // Forçar recálculo da paginação
                    if (typeof window.romaneioToraManager.calculateTotalPages === 'function') {
                        window.romaneioToraManager.calculateTotalPages();
                    }
                    
                    // Atualizar controles
                    if (typeof window.romaneioToraManager.updatePaginationControls === 'function') {
                        window.romaneioToraManager.updatePaginationControls();
                    }
                    
                    console.log('✅ Sistema de paginação integrado com sucesso!');
                } else {
                    console.warn('⚠️ Controles de paginação não encontrados após renderização');
                }
            }, 100);
        }
        
        // Mostrar modal
        modal.style.display = 'block';
        
    } catch (error) {
        console.error('❌ Erro ao abrir lista corrigida:', error);
        alert('Erro ao carregar lista de romaneios: ' + error.message);
    }
}

// Função corrigida para renderizar lista de romaneios
async function renderRomaneioListCorrigida(filter = '') {
    console.log('📋 Iniciando renderização da lista (UTF-8)...');
    
    // Aguardar interface corrigida
    const interfacePronta = await aguardarInterfaceCorrigida();
    if (!interfacePronta) {
        console.warn('⚠️ DatabaseAdapter não está disponível, usando fallback');
    }
    
    // Procurar o tbody correto - pode estar em diferentes modais
    let tbody = document.querySelector('#romaneioListTable');
    if (!tbody) {
        tbody = document.querySelector('#listaModal tbody');
    }
    if (!tbody) {
        tbody = document.querySelector('#modalListaRomaneios tbody');
    }
    
    if (!tbody) {
        console.error('❌ Elemento tbody não encontrado em nenhum modal');
        return;
    }

    console.log('✅ Tbody encontrado:', tbody.parentElement.parentElement.id || 'sem ID');

    // Mostrar carregando
    tbody.innerHTML = '<tr><td colspan="7" style="text-align: center; padding: 20px;">🔄 Carregando dados...</td></tr>';

    try {
        let dados = null;
        
        // ✅ VERIFICAR SE É NECESSÁRIO FORÇAR DADOS FRESCOS
        const necessitaDadosFrescos = window.romaneioListaNecessitaAtualizacao || 
                                     window.ultimaAtualizacaoRomaneio ||
                                     (typeof filter === 'string' && filter === 'force-refresh');
        
        if (necessitaDadosFrescos) {
            console.log("🔄 Detectada necessidade de dados frescos - forçando carregamento direto");
            try {
                dados = await carregarDadosFrescos('romaneiosTora');
                if (dados) {
                    // Marcar que os dados foram atualizados
                    window.romaneioListaNecessitaAtualizacao = false;
                    window.ultimaAtualizacaoListaRomaneios = new Date().toISOString();
                    console.log("✅ Dados frescos carregados com sucesso");
                }
            } catch (freshError) {
                console.warn("⚠️ Erro ao carregar dados frescos, usando método normal:", freshError);
                dados = null;
            }
        }
        
        // Tentar carregar com databaseAdapter primeiro (se não carregou dados frescos)
        if (!dados && window.databaseAdapter && typeof window.databaseAdapter.loadData === 'function') {
            console.log('📊 Carregando dados via DatabaseAdapter...');
            try {
                dados = await window.databaseAdapter.loadData('romaneiosTora');
                console.log('✅ Dados carregados via DatabaseAdapter:', dados);
            } catch (error) {
                console.warn('⚠️ Erro no DatabaseAdapter:', error);
                dados = null;
            }
        }
        
        // Fallback para getData se databaseAdapter falhar
        if (!dados && typeof getData === 'function') {
            console.log('📊 Fallback: carregando dados via getData...');
            try {
                dados = await getData('romaneios/tora');
                console.log('✅ Dados carregados via getData:', dados);
            } catch (error) {
                console.error('❌ Erro no getData:', error);
                dados = null;
            }
        }
        
        if (!dados) {
            throw new Error('Não foi possível carregar os dados');
        }

        // Converter dados para array se necessário
        let romaneios = [];
        
        if (dados && typeof dados === 'object') {
            // Se é um objeto de resposta com 'data'
            if (dados.data !== undefined) {
                const dadosReais = dados.data;
                romaneios = Array.isArray(dadosReais) ? dadosReais : 
                           (typeof dadosReais === 'object' && dadosReais !== null ? Object.values(dadosReais) : []);
                console.log('✅ Dados extraídos da propriedade "data":', romaneios.length, 'romaneios');
            }
            // Se é um array diretamente
            else if (Array.isArray(dados)) {
                romaneios = dados;
                console.log('✅ Dados já são um array:', romaneios.length, 'romaneios');
            }
            // Se é um objeto direto com romaneios
            else {
                romaneios = Object.values(dados);
                console.log('✅ Dados convertidos de objeto para array:', romaneios.length, 'romaneios');
            }
        } else {
            romaneios = [];
            console.warn('⚠️ Dados não são um objeto válido:', typeof dados);
        }

        console.log(`📊 ${romaneios.length} romaneios encontrados`);

        // Validar e filtrar romaneios
        const romaneiosValidos = romaneios.filter(romaneio => {
            if (!romaneio || typeof romaneio !== 'object') {
                console.log('❌ Romaneio rejeitado: não é objeto', romaneio);
                return false;
            }
            
            // Aceitar se tem ID ou firebaseKey
            if (!romaneio.id && !romaneio.firebaseKey) {
                console.log('❌ Romaneio rejeitado: sem ID ou firebaseKey', romaneio);
                return false;
            }
            
            console.log('✅ Romaneio válido aceito:', { 
                id: romaneio.id, 
                firebaseKey: romaneio.firebaseKey,
                fornecedor: romaneio.fornecedor?.nome,
                itens: romaneio.itens?.length 
            });
            
            // Aplicar filtro de busca
            if (filter && !filter.includes('force') && !filter.includes('refresh')) {
                const textoFiltro = filter.toLowerCase();
                const conteudo = JSON.stringify(romaneio).toLowerCase();
                return conteudo.includes(textoFiltro);
            }
            
            return true;
        });

        console.log(`✅ ${romaneiosValidos.length} romaneios válidos após filtro`);

        // ✅ SINCRONIZAR DADOS COM RomaneioToraManager PARA PAGINAÇÃO
        if (window.romaneioToraManager) {
            console.log('🔗 Sincronizando dados com RomaneioToraManager...');
            
            // Atualizar os dados no manager
            window.romaneioToraManager.allRomaneios = romaneiosValidos;
            window.romaneioToraManager.filteredRomaneios = romaneiosValidos;
            
            // Aplicar filtro se necessário
            if (filter && !filter.includes('force') && !filter.includes('refresh')) {
                window.romaneioToraManager.applyFilter(filter);
            } else {
                window.romaneioToraManager.applyFilter('');
            }
            
            // Recalcular paginação
            if (typeof window.romaneioToraManager.calculateTotalPages === 'function') {
                window.romaneioToraManager.calculateTotalPages();
            }
            
            // Se há dados suficientes para paginação, usar o sistema de paginação
            if (romaneiosValidos.length > window.romaneioToraManager.itemsPerPage) {
                console.log('📄 Dados suficientes para paginação, usando sistema paginado...');
                
                // Usar renderFilteredTable do manager em vez de renderização manual
                setTimeout(() => {
                    if (typeof window.romaneioToraManager.renderFilteredTable === 'function') {
                        window.romaneioToraManager.renderFilteredTable();
                        console.log('✅ Tabela renderizada com paginação pelo RomaneioToraManager');
                    }
                }, 50);
                
                return; // Sair aqui para deixar o manager cuidar da renderização
            } else {
                console.log('📄 Poucos dados, renderizando diretamente sem paginação...');
            }
        }

        // Renderizar lista
        if (romaneiosValidos.length === 0) {
            tbody.innerHTML = '<tr><td colspan="6" style="text-align: center; padding: 20px; color: #666;">📝 Nenhum romaneio encontrado</td></tr>';
            return;
        }

        // Ordenar por data (mais recente primeiro)
        romaneiosValidos.sort((a, b) => {
            const dataA = new Date(a.data || '1900-01-01');
            const dataB = new Date(b.data || '1900-01-01');
            return dataB - dataA;
        });
        
        // Gerar HTML das linhas
        let html = '';
        
        romaneiosValidos.forEach((romaneio, index) => {
            // Determinar ID correto
            const romaneioId = romaneio.id || romaneio.firebaseKey || romaneio.romaneioId;
            
            // Calcular totais - CORRIGIDO PARA ROMANEIO DE TORA
            const itens = romaneio.itens || [];
            
            // Para romaneio de tora, usar a estrutura específica
            let volumeTotal = 0;
            let valorTotal = 0;
            
            if (romaneio.totais && romaneio.totais.volumeSerraria && romaneio.totais.valorTotal) {
                // Se já tem os totais calculados, usar eles
                volumeTotal = parseFloat(romaneio.totais.volumeSerraria) || 0;
                valorTotal = parseFloat(romaneio.totais.valorTotal) || 0;
            } else {
                // Calcular dos itens para romaneio de tora
                itens.forEach(item => {
                    // Volume: usar volumeSerraria ou volumeLiquido 
                    const volume = parseFloat(item.volumeSerraria || item.volumeLiquido || item.volume) || 0;
                    volumeTotal += volume;
                    
                    // Valor: calcular como volume * preço
                    const preco = parseFloat(item.preco || item.precoUnitario) || 0;
                    const valor = volume * preco;
                    valorTotal += valor;
                });
            }
            
            // Obter espécies únicas
            const especies = [...new Set(itens.map(item => item.especie).filter(e => e))];
            const especiesText = especies.length > 0 ? especies.join(', ') : 'N/A';
            
            // Formatação
            const dataFormatada = romaneio.data || romaneio.dataHora || romaneio.dataFormatada || 'Não informado';
            const fornecedorNome = romaneio.fornecedor?.nome || romaneio.fornecedor || 'Não informado';
            const volumeFormatado = volumeTotal.toLocaleString('pt-BR', { minimumFractionDigits: 3, maximumFractionDigits: 3 });
            const valorFormatado = valorTotal.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
            
            html += `
                <tr style="cursor: pointer;" onmouseover="this.style.backgroundColor='#f8f9fa'" onmouseout="this.style.backgroundColor=''">
                    <td style="padding: 8px;">${dataFormatada}</td>
                    <td style="padding: 8px;">${fornecedorNome}</td>
                    <td style="padding: 8px;" title="${especiesText}">${especiesText.length > 30 ? especiesText.substring(0, 30) + '...' : especiesText}</td>
                    <td style="padding: 8px; text-align: center;">${itens.length}</td>
                    <td style="padding: 8px; text-align: right;">${volumeFormatado}</td>
                    <td style="padding: 8px; text-align: right;">${valorFormatado}</td>
                    <td style="padding: 8px; text-align: center;">
                        <div class="action-buttons-container" style="display: flex; justify-content: center; align-items: center; gap: 4px; flex-wrap: nowrap; min-height: 40px; padding: 2px;">
                            <!-- Dropdown de impressão -->
                            <div class="print-dropdown" style="position: relative; display: inline-block;">
                                <button class="client-action-button print-btn" title="Imprimir" 
                                        onclick="togglePrintMenuTora(this, '${romaneioId}', ${index})"
                                        style="display: inline-flex; justify-content: center; align-items: center; width: 32px; height: 32px; padding: 0; border-radius: 4px; border: 1px solid #28a745; background-color: #fff; color: #28a745; transition: all 0.2s ease; cursor: pointer;"
                                        onmouseover="this.style.backgroundColor='#28a745'; this.style.color='white';" 
                                        onmouseout="this.style.backgroundColor='#fff'; this.style.color='#28a745';">
                                    <i class="fas fa-print" style="font-size: 14px; width: 14px; height: 14px;"></i>
                                </button>
                                <div class="print-menu" style="position: absolute; z-index: 999999; background: white; border: 1px solid rgba(0,0,0,0.15); border-radius: 0.25rem; min-width: 220px; box-shadow: 0 4px 15px rgba(0,0,0,0.25); display: none; white-space: nowrap;">
                                    <button onclick="imprimirRomaneioToraTora('${romaneioId}', ${index}, 'completo')" 
                                            style="display: block; width: 100%; padding: 0.6rem 1rem; background: none; border: none; text-align: left; cursor: pointer; font-size: 0.9rem; transition: all 0.2s ease; border-bottom: 1px solid rgba(0,0,0,0.08); color: #333;"
                                            onmouseover="this.style.backgroundColor='#f0f8ff'; this.style.color='#2980b9'" 
                                            onmouseout="this.style.backgroundColor=''; this.style.color='#333'">
                                        <i class="fas fa-file-alt" style="margin-right: 0.6rem; width: 16px; text-align: center; color: #3498db;"></i> Completo
                                    </button>
                                    <button onclick="imprimirRomaneioToraTora('${romaneioId}', ${index}, 'sem-preco-unitario')" 
                                            style="display: block; width: 100%; padding: 0.6rem 1rem; background: none; border: none; text-align: left; cursor: pointer; font-size: 0.9rem; transition: all 0.2s ease; border-bottom: 1px solid rgba(0,0,0,0.08); color: #333;"
                                            onmouseover="this.style.backgroundColor='#f0f8ff'; this.style.color='#2980b9'" 
                                            onmouseout="this.style.backgroundColor=''; this.style.color='#333'">
                                        <i class="fas fa-file-invoice" style="margin-right: 0.6rem; width: 16px; text-align: center; color: #3498db;"></i> Sem Preço Unit.
                                    </button>
                                    <button onclick="imprimirRomaneioToraTora('${romaneioId}', ${index}, 'sem-preco')" 
                                            style="display: block; width: 100%; padding: 0.6rem 1rem; background: none; border: none; text-align: left; cursor: pointer; font-size: 0.9rem; transition: all 0.2s ease; color: #333;"
                                            onmouseover="this.style.backgroundColor='#f0f8ff'; this.style.color='#2980b9'" 
                                            onmouseout="this.style.backgroundColor=''; this.style.color='#333'">
                                        <i class="fas fa-file" style="margin-right: 0.6rem; width: 16px; text-align: center; color: #3498db;"></i> Sem Preço
                                    </button>
                                </div>
                            </div>
                            
                            <!-- Botão de edição -->
                            <button class="client-action-button" title="Editar" onclick="editarRomaneio('${romaneioId}')"
                                    style="display: inline-flex; justify-content: center; align-items: center; width: 32px; height: 32px; padding: 0; border-radius: 4px; border: 1px solid #007bff; background-color: #fff; color: #007bff; transition: all 0.2s ease; cursor: pointer;"
                                    onmouseover="this.style.backgroundColor='#007bff'; this.style.color='white';" 
                                    onmouseout="this.style.backgroundColor='#fff'; this.style.color='#007bff';">
                                <i class="fas fa-edit" style="font-size: 14px; width: 14px; height: 14px;"></i>
                            </button>
                            
                            <!-- Botão de exclusão -->
                            <button class="client-action-button delete-button" title="Excluir" onclick="excluirRomaneio('${romaneioId}')"
                                    style="display: inline-flex; justify-content: center; align-items: center; width: 32px; height: 32px; padding: 0; border-radius: 4px; border: 1px solid #dc3545; background-color: #dc3545; color: white; transition: all 0.2s ease; cursor: pointer;"
                                    onmouseover="this.style.backgroundColor='#c82333'; this.style.borderColor='#c82333';" 
                                    onmouseout="this.style.backgroundColor='#dc3545'; this.style.borderColor='#dc3545';">
                                <i class="fas fa-trash-alt" style="font-size: 14px; width: 14px; height: 14px;"></i>
                            </button>
                        </div>
                    </td>
                </tr>
            `;
        });
        
        tbody.innerHTML = html;
        console.log(`✅ Lista renderizada com ${romaneiosValidos.length} romaneios`);
        
    } catch (error) {
        console.error('❌ Erro ao renderizar lista:', error);
        tbody.innerHTML = `
            <tr>
                <td colspan="7" style="text-align: center; padding: 20px; color: #e74c3c;">
                    <i class="fas fa-exclamation-triangle"></i> Erro ao renderizar: ${error.message}
                </td>
            </tr>
        `;
    }
}

// Função para toggle do dropdown de impressão (versão melhorada)
function togglePrintMenuTora(button, romaneioId, index) {
    console.log("Alternando visibilidade do menu de impressão - Tora");
    
    // Verificar se o botão existe
    if (!button) {
        console.error("Botão não fornecido para togglePrintMenuTora");
        return;
    }
    
    // Fechar todos os outros menus primeiro
    document.querySelectorAll('.external-print-menu').forEach(menu => {
        menu.remove();
    });
    
    // Verificar se já existe um menu para este botão
    const existingMenu = document.querySelector(`.external-print-menu[data-romaneio="${romaneioId}"]`);
    if (existingMenu) {
        existingMenu.remove();
        return;
    }
    
    // ✅ CRIAR DROPDOWN EXTERNO (FORA DA TABELA)
    const externalMenu = document.createElement('div');
    externalMenu.className = 'external-print-menu';
    externalMenu.setAttribute('data-romaneio', romaneioId);
    
    // ✅ CONFIGURAR ESTILOS DO DROPDOWN EXTERNO
    externalMenu.style.cssText = `
        position: fixed !important;
        z-index: 999999 !important;
        background: white !important;
        border: 1px solid rgba(0,0,0,0.15) !important;
        border-radius: 0.25rem !important;
        min-width: 220px !important;
        box-shadow: 0 8px 25px rgba(0,0,0,0.3) !important;
        padding: 0 !important;
        margin: 0 !important;
        display: block !important;
        animation: fadeInDropdown 0.2s ease !important;
    `;
    
    // ✅ CRIAR CONTEÚDO DO DROPDOWN
    externalMenu.innerHTML = `
        <button onclick="imprimirRomaneioToraExternal('${romaneioId}', ${index}, 'completo'); removeExternalMenu('${romaneioId}')" 
                style="display: block; width: 100%; padding: 0.7rem 1.2rem; background: none; border: none; text-align: left; cursor: pointer; font-size: 0.9rem; transition: all 0.2s ease; border-bottom: 1px solid rgba(0,0,0,0.08); color: #333; white-space: nowrap;"
                onmouseover="this.style.backgroundColor='#f0f8ff'; this.style.color='#2980b9'" 
                onmouseout="this.style.backgroundColor=''; this.style.color='#333'">
            <i class="fas fa-file-alt" style="margin-right: 0.7rem; width: 16px; text-align: center; color: #3498db;"></i> Completo
        </button>
        <button onclick="imprimirRomaneioToraExternal('${romaneioId}', ${index}, 'sem-preco-unitario'); removeExternalMenu('${romaneioId}')" 
                style="display: block; width: 100%; padding: 0.7rem 1.2rem; background: none; border: none; text-align: left; cursor: pointer; font-size: 0.9rem; transition: all 0.2s ease; border-bottom: 1px solid rgba(0,0,0,0.08); color: #333; white-space: nowrap;"
                onmouseover="this.style.backgroundColor='#f0f8ff'; this.style.color='#2980b9'" 
                onmouseout="this.style.backgroundColor=''; this.style.color='#333'">
            <i class="fas fa-file-invoice" style="margin-right: 0.7rem; width: 16px; text-align: center; color: #3498db;"></i> Sem Preço Unit.
        </button>
        <button onclick="imprimirRomaneioToraExternal('${romaneioId}', ${index}, 'sem-preco'); removeExternalMenu('${romaneioId}')" 
                style="display: block; width: 100%; padding: 0.7rem 1.2rem; background: none; border: none; text-align: left; cursor: pointer; font-size: 0.9rem; transition: all 0.2s ease; color: #333; white-space: nowrap;"
                onmouseover="this.style.backgroundColor='#f0f8ff'; this.style.color='#2980b9'" 
                onmouseout="this.style.backgroundColor=''; this.style.color='#333'">
            <i class="fas fa-file" style="margin-right: 0.7rem; width: 16px; text-align: center; color: #3498db;"></i> Sem Preço
        </button>
    `;
    
    // ✅ CALCULAR POSIÇÃO DO BOTÃO NA TELA
    const buttonRect = button.getBoundingClientRect();
    const menuWidth = 220;
    const menuHeight = 150;
    
    // ✅ CALCULAR POSIÇÃO HORIZONTAL
    let leftPosition = buttonRect.right - menuWidth; // Alinhar à direita do botão
    
    // Verificar se vai sair da tela à esquerda
    if (leftPosition < 10) {
        leftPosition = buttonRect.left; // Alinhar à esquerda do botão
    }
    
    // Verificar se vai sair da tela à direita
    if (leftPosition + menuWidth > window.innerWidth - 10) {
        leftPosition = window.innerWidth - menuWidth - 10;
    }
    
    // ✅ CALCULAR POSIÇÃO VERTICAL
    let topPosition = buttonRect.bottom + 8; // Abaixo do botão
    
    // Verificar se vai sair da tela por baixo
    if (topPosition + menuHeight > window.innerHeight - 10) {
        topPosition = buttonRect.top - menuHeight - 8; // Acima do botão
        externalMenu.style.borderRadius = '0.25rem 0.25rem 0.25rem 0.25rem';
    }
    
    // ✅ VERIFICAR SE É DISPOSITIVO MÓVEL
    if (window.innerWidth <= 768) {
        // No mobile, centralizar na tela
        externalMenu.style.left = '50%';
        externalMenu.style.top = '50%';
        externalMenu.style.transform = 'translate(-50%, -50%)';
        externalMenu.style.maxWidth = '90vw';
        externalMenu.style.borderRadius = '0.5rem';
        
        // Adicionar overlay escuro
        const overlay = document.createElement('div');
        overlay.className = 'mobile-overlay';
        overlay.style.cssText = `
            position: fixed !important;
            top: 0 !important;
            left: 0 !important;
            right: 0 !important;
            bottom: 0 !important;
            background: rgba(0,0,0,0.5) !important;
            z-index: 999998 !important;
        `;
        overlay.onclick = () => removeExternalMenu(romaneioId);
        document.body.appendChild(overlay);
        externalMenu.setAttribute('data-has-overlay', 'true');
    } else {
        // Desktop: aplicar posições calculadas
        externalMenu.style.left = leftPosition + 'px';
        externalMenu.style.top = topPosition + 'px';
    }
    
    // ✅ ADICIONAR O DROPDOWN AO BODY (FORA DE TODOS OS CONTAINERS)
    document.body.appendChild(externalMenu);
    
    console.log(`Menu externo criado para romaneio ${romaneioId} em: left=${leftPosition}px, top=${topPosition}px`);
    
    // ✅ ADICIONAR EVENTOS PARA FECHAR
    setTimeout(() => {
        const clickHandler = function(e) {
            // Verificar se o clique foi fora do dropdown e do botão
            if (!button.contains(e.target) && !externalMenu.contains(e.target)) {
                removeExternalMenu(romaneioId);
                document.removeEventListener('click', clickHandler);
                document.removeEventListener('scroll', scrollHandler);
            }
        };
        
        const scrollHandler = function() {
            removeExternalMenu(romaneioId);
            document.removeEventListener('click', clickHandler);
            document.removeEventListener('scroll', scrollHandler);
        };
        
        document.addEventListener('click', clickHandler);
        document.addEventListener('scroll', scrollHandler, true);
    }, 100);
}

// ✅ FUNÇÃO PARA REMOVER MENU EXTERNO
window.removeExternalMenu = function(romaneioId) {
    const menu = document.querySelector(`.external-print-menu[data-romaneio="${romaneioId}"]`);
    if (menu) {
        // Remover overlay se existir
        if (menu.getAttribute('data-has-overlay') === 'true') {
            const overlay = document.querySelector('.mobile-overlay');
            if (overlay) overlay.remove();
        }
        menu.remove();
        console.log(`Menu externo removido para romaneio ${romaneioId}`);
    }
};

// ✅ FUNÇÃO PARA IMPRIMIR (EXTERNA) - IMPLEMENTAÇÃO COMPLETA
window.imprimirRomaneioToraExternal = async function(romaneioId, index, tipo = 'completo') {
    console.log(`🖨️ Imprimindo romaneio tora ${romaneioId}, tipo: ${tipo}`);
    
    try {
        // Aguardar interface corrigida
        const interfacePronta = await aguardarInterfaceCorrigida();
        
        // ✅ CARREGAR DADOS DO FIREBASE
        let dados = null;
        
        // Tentar carregar com databaseAdapter primeiro
        if (window.databaseAdapter && typeof window.databaseAdapter.loadData === 'function') {
            console.log('📊 Carregando dados via DatabaseAdapter...');
            try {
                dados = await window.databaseAdapter.loadData('romaneiosTora');
                console.log('✅ Dados carregados via DatabaseAdapter:', dados);
            } catch (error) {
                console.warn('⚠️ Erro no DatabaseAdapter:', error);
                dados = null;
            }
        }
        
        // Fallback para getData se databaseAdapter falhar
        if (!dados && typeof getData === 'function') {
            console.log('📊 Fallback: carregando dados via getData...');
            try {
                dados = await getData('romaneios/tora');
                console.log('✅ Dados carregados via getData:', dados);
            } catch (error) {
                console.error('❌ Erro no getData:', error);
                dados = null;
            }
        }
        
        if (!dados) {
            throw new Error('Não foi possível carregar os dados');
        }

        // Converter dados para array se necessário
        let romaneios = [];
        
        if (dados && typeof dados === 'object') {
            if (dados.data !== undefined) {
                const dadosReais = dados.data;
                romaneios = Array.isArray(dadosReais) ? dadosReais : 
                           (typeof dadosReais === 'object' && dadosReais !== null ? Object.values(dadosReais) : []);
            } else if (Array.isArray(dados)) {
                romaneios = dados;
            } else {
                romaneios = Object.values(dados);
            }
        }

        // ✅ BUSCAR O ROMANEIO ESPECÍFICO
        let romaneioParaImprimir = null;
        
        romaneios.forEach(romaneio => {
            if (romaneio && 
                (romaneio.id === romaneioId || 
                 romaneio.firebaseKey === romaneioId ||
                 romaneio.romaneioId === romaneioId)) {
                romaneioParaImprimir = romaneio;
            }
        });
        
        if (!romaneioParaImprimir) {
            console.error(`❌ Romaneio ${romaneioId} não encontrado`);
            alert("Romaneio não encontrado");
            return;
        }
        
        console.log("✅ Romaneio encontrado:", romaneioParaImprimir);
        
        // ✅ OBTER DADOS DA EMPRESA
        const dadosEmpresa = await obterDadosEmpresa();
        
        // ✅ PROCESSAR DADOS DO ROMANEIO
        const resultado = await processarDadosRomaneio(romaneioParaImprimir, tipo);
        
        // ✅ GERAR E EXIBIR O RELATÓRIO
        const htmlCompleto = gerarHtmlCompleto(romaneioParaImprimir, resultado, dadosEmpresa, tipo);
        
        // ✅ ABRIR JANELA DE IMPRESSÃO
        const printWindow = window.open('', '_blank');
        printWindow.document.write(htmlCompleto);
        printWindow.document.close();
        
        // Aguardar carregar e imprimir
        printWindow.onload = function() {
            setTimeout(() => {
                printWindow.focus();
                printWindow.print();
            }, 500);
        };
        
    } catch (error) {
        console.error('❌ Erro ao imprimir romaneio:', error);
        alert('Erro ao imprimir romaneio: ' + error.message);
    }
};

// ✅ FUNÇÃO PARA OBTER DADOS DA EMPRESA
async function obterDadosEmpresa() {
    console.log('🏢 Obtendo dados da empresa...');
    
    try {
        // Tentar diferentes métodos para obter dados da empresa
        let dadosEmpresa = null;
        
        // 1. Tentar usar a função getCompanyDataFirebase se disponível
        if (typeof getCompanyDataFirebase === 'function') {
            dadosEmpresa = await getCompanyDataFirebase();
            console.log('✅ Dados obtidos via getCompanyDataFirebase:', dadosEmpresa);
        } 
        // 2. Tentar usar getData('companies') diretamente
        else if (typeof getData === 'function') {
            try {
                const companies = await getData('companies') || [];
                dadosEmpresa = companies.length > 0 ? companies[0] : null;
                console.log('✅ Dados obtidos via getData(companies):', dadosEmpresa);
            } catch (error) {
                console.warn('⚠️ Erro ao obter dados via getData(companies):', error);
            }
        }
        // 3. Tentar usar databaseAdapter se disponível
        else if (window.databaseAdapter && typeof window.databaseAdapter.loadData === 'function') {
            dadosEmpresa = await window.databaseAdapter.loadData('empresa');
            console.log('✅ Dados obtidos via databaseAdapter:', dadosEmpresa);
        }
        
        // Se não encontrou dados válidos, usar dados padrão da empresa
        if (!dadosEmpresa || typeof dadosEmpresa !== 'object') {
            console.log('⚠️ Usando dados padrão da empresa');
            dadosEmpresa = {
                nome: "Empresa não informada",
                name: "Empresa não informada",
                cnpj: "-",
                endereco: "-",
                address: "-",
                cidade: "-",
                city: "-",
                estado: "-",
                state: "-",
                telefone: "-",
                phone: "-",
                logo: null,
                logoSvg: true
            };
        } else {
            // Normalizar campos para compatibilidade
            dadosEmpresa = {
                nome: dadosEmpresa.nome || dadosEmpresa.name || "Empresa não informada",
                name: dadosEmpresa.name || dadosEmpresa.nome || "Empresa não informada",
                cnpj: dadosEmpresa.cnpj || "-",
                endereco: dadosEmpresa.endereco || dadosEmpresa.address || "-",
                address: dadosEmpresa.address || dadosEmpresa.endereco || "-",
                cidade: dadosEmpresa.cidade || dadosEmpresa.city || "-",
                city: dadosEmpresa.city || dadosEmpresa.cidade || "-",
                estado: dadosEmpresa.estado || dadosEmpresa.state || "-",
                state: dadosEmpresa.state || dadosEmpresa.estado || "-",
                telefone: dadosEmpresa.telefone || dadosEmpresa.phone || "-",
                phone: dadosEmpresa.phone || dadosEmpresa.telefone || "-",
                logo: dadosEmpresa.logo || null,
                logoSvg: !dadosEmpresa.logo || dadosEmpresa.logo.trim() === ''
            };
        }
        
        console.log('✅ Dados da empresa processados:', dadosEmpresa);
        return dadosEmpresa;
        
    } catch (error) {
        console.warn('⚠️ Erro ao obter dados da empresa:', error);
        return {
            nome: "Empresa não informada",
            name: "Empresa não informada",
            cnpj: "-",
            endereco: "-",
            address: "-",
            cidade: "-",
            city: "-",
            estado: "-",
            state: "-",
            telefone: "-",
            phone: "-",
            logo: null,
            logoSvg: true
        };
    }
}

// ✅ FUNÇÃO PARA GERAR LOGO SVG PADRÃO
function gerarLogoSvgPadrao() {
    const svgContent = `
        <svg width="80" height="80" viewBox="0 0 80 80" xmlns="http://www.w3.org/2000/svg">
            <rect width="80" height="80" fill="#2c3e50"/>
            <rect x="10" y="10" width="60" height="60" fill="#34495e" stroke="#ecf0f1" stroke-width="2"/>
            <circle cx="40" cy="30" r="8" fill="#e74c3c"/>
            <rect x="25" y="45" width="30" height="4" fill="#27ae60"/>
            <rect x="25" y="52" width="30" height="4" fill="#f39c12"/>
            <rect x="25" y="59" width="30" height="4" fill="#3498db"/>
            <text x="40" y="72" text-anchor="middle" fill="#ecf0f1" font-family="Arial" font-size="8" font-weight="bold">SISWEB</text>
        </svg>
    `;
    
    // Converter para base64
    return btoa(unescape(encodeURIComponent(svgContent)));
}

// ✅ FUNÇÃO PARA PROCESSAR DADOS DO ROMANEIO
async function processarDadosRomaneio(romaneio, tipo) {
    console.log('⚙️ Processando dados do romaneio...');
    
    // Verificar e processar itens
    const itensOriginais = romaneio.itens || [];
    if (!Array.isArray(itensOriginais) || itensOriginais.length === 0) {
        throw new Error("Não há itens para imprimir neste romaneio");
    }
    
    // Normalizar os itens com cálculos precisos
    const itensNormalizados = itensOriginais.map(item => {
        const diametro = parseFloat(item.diametro || item.rodo || 0);
        const comprimento = parseFloat(item.comprimento || 0);
        const oco1 = parseFloat(item.oco1 || 0);
        const oco2 = parseFloat(item.oco2 || 0);
        const preco = parseFloat(item.preco || item.precoUnitario || 0);
        
        let volumeBruto = parseFloat(item.volumeBruto || 0);
        let volumeDesconto = parseFloat(item.volumeDesconto || item.desconto || 0);
        let volumeLiquido = parseFloat(item.volumeLiquido || item.volumeSerraria || 0);
        
        // Calcular volume bruto se não existir
        if (!volumeBruto) {
            volumeBruto = Math.PI * Math.pow((diametro/100)/2, 2) * (comprimento/100);
        }
        
        // Calcular desconto se não existir
        if (!volumeDesconto && oco1 > 0 && oco2 > 0) {
            volumeDesconto = (oco1/100) * (oco2/100) * (comprimento/100);
        }
        
        // Calcular volume líquido se não existir
        if (!volumeLiquido) {
            volumeLiquido = volumeBruto - volumeDesconto;
        }
        
        const valor = item.valor ? parseFloat(item.valor) : (volumeLiquido * preco);
        
        return {
            plaqueta: item.plaqueta || '',
            especie: item.especie || '',
            diametro,
            comprimento,
            oco1,
            oco2,
            volumeBruto,
            volumeDesconto,
            volumeLiquido,
            preco,
            valor
        };
    });
    
    // Calcular totais gerais
    let volumeBrutoTotal = 0;
    let volumeDescontoTotal = 0;
    let volumeLiquidoTotal = 0;
    let valorTotal = 0;
    
    itensNormalizados.forEach(item => {
        volumeBrutoTotal += item.volumeBruto;
        volumeDescontoTotal += item.volumeDesconto;
        volumeLiquidoTotal += item.volumeLiquido;
        valorTotal += item.valor;
    });
    
    // Calcular estatísticas por espécie
    const estatisticasPorEspecie = calcularEstatisticasPorEspecie(itensNormalizados);
    
    return {
        itens: itensNormalizados,
        totais: {
            quantidade: itensNormalizados.length,
            volumeBruto: volumeBrutoTotal,
            volumeDesconto: volumeDescontoTotal,
            volumeLiquido: volumeLiquidoTotal,
            valor: valorTotal,
            precoMedio: volumeLiquidoTotal > 0 ? valorTotal / volumeLiquidoTotal : 0
        },
        estatisticasPorEspecie
    };
}

// ✅ FUNÇÃO PARA CALCULAR ESTATÍSTICAS POR ESPÉCIE
function calcularEstatisticasPorEspecie(itens) {
    const estatisticas = {};
    
    itens.forEach(item => {
        const especie = item.especie || 'Sem espécie';
        
        if (!estatisticas[especie]) {
            estatisticas[especie] = {
                especie,
                quantidade: 0,
                volumeBrutoTotal: 0,
                volumeDescontoTotal: 0,
                volumeLiquidoTotal: 0,
                valorTotal: 0,
                precoMedio: 0
            };
        }
        
        estatisticas[especie].quantidade++;
        estatisticas[especie].volumeBrutoTotal += item.volumeBruto;
        estatisticas[especie].volumeDescontoTotal += item.volumeDesconto;
        estatisticas[especie].volumeLiquidoTotal += item.volumeLiquido;
        estatisticas[especie].valorTotal += item.valor;
    });
    
    // Calcular preço médio para cada espécie
    Object.values(estatisticas).forEach(especie => {
        if (especie.volumeLiquidoTotal > 0) {
            especie.precoMedio = especie.valorTotal / especie.volumeLiquidoTotal;
        }
    });
    
    return Object.values(estatisticas);
}

// ✅ FUNÇÃO PARA GERAR HTML COMPLETO
function gerarHtmlCompleto(romaneio, resultado, dadosEmpresa, tipo) {
    // Formatar data - CORRIGIDO para verificar múltiplos campos
    let dataFormatada = 'N/A';
    
    // Verificar múltiplos campos de data possíveis
    const campoData = romaneio.data || romaneio.dataHora || romaneio.dataFormatada || romaneio.timestamp || romaneio.createdAt || null;
    
    if (campoData) {
        try {
            // Se já é uma string formatada (dataFormatada)
            if (typeof campoData === 'string' && campoData.includes('/')) {
                dataFormatada = campoData;
            } else {
                // Tentar converter para Date
                const data = new Date(campoData);
                if (!isNaN(data.getTime())) {
                    dataFormatada = data.toLocaleDateString('pt-BR');
                } else {
                    // Se não conseguiu converter, usar o valor original
                    dataFormatada = String(campoData);
                }
            }
        } catch (e) {
            // Se deu erro, usar o valor original
            dataFormatada = String(campoData);
        }
    }
    
    console.log('📅 Data formatada:', {
        original: campoData,
        formatada: dataFormatada,
        campos: {
            data: romaneio.data,
            dataHora: romaneio.dataHora,
            dataFormatada: romaneio.dataFormatada,
            timestamp: romaneio.timestamp,
            createdAt: romaneio.createdAt
        }
    });

    // Informações do fornecedor/cliente
    const fornecedor = romaneio.fornecedor || romaneio.cliente || null;
    const fornecedorInfo = fornecedor ? `
        <div class="info-row">
            <div class="info-label">Fornecedor:</div>
            <div>${fornecedor.nome || 'Não informado'}</div>
        </div>
        ${fornecedor.cnpj ? `
        <div class="info-row">
            <div class="info-label">CNPJ:</div>
            <div>${fornecedor.cnpj}</div>
        </div>` : ''}
        ${fornecedor.cidade || fornecedor.estado ? `
        <div class="info-row">
            <div class="info-label">Cidade:</div>
            <div>${fornecedor.cidade || ''} ${fornecedor.estado ? `- ${fornecedor.estado}` : ''}</div>
        </div>` : ''}
    ` : '';
    
    // Gerar cabeçalho da tabela
    const cabecalhoTabela = gerarCabecalhoTabelaImpressao(tipo);
    
    // Gerar linhas dos itens
    const linhasItens = resultado.itens.map((item, index) => 
        gerarLinhaItemImpressao(item, index, tipo)
    ).join('');
    
    // Gerar linha de total
    const linhaTotalGeral = gerarLinhaTotalGeralImpressao(resultado.totais, tipo);
    
    // Gerar resumo por espécie
    const resumoPorEspecie = gerarResumoPorEspecieImpressao(resultado.estatisticasPorEspecie, resultado.totais, tipo);
    
    return `
        <!DOCTYPE html>
        <html lang="pt-BR">
        <head>
            <meta charset="UTF-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <title>Romaneio de Tora - ${romaneio.id} - ${dataFormatada}</title>
            <style>
                ${gerarEstilosCSSImpressao(tipo)}
            </style>
        </head>
        <body>
            <div class="page-wrapper">
                <div class="page-content">
                    <!-- Cabeçalho da Empresa -->
                    ${gerarCabecalhoEmpresaImpressao(dadosEmpresa)}
                    
                    <!-- Título do Romaneio -->
                    <div class="romaneio-title">
                        ROMANEIO DE TORA - ${romaneio.id || romaneio.firebaseKey}
                    </div>
                    
                    <!-- Informações do Romaneio -->
                    <div class="info-block">
                        <div class="info-row">
                            <div class="info-label">Data:</div>
                            <div>${dataFormatada}</div>
                        </div>
                        ${fornecedorInfo}
                    </div>
                    
                    <!-- Tabela Principal -->
                    <div class="table-container">
                        <table class="main-table">
                            ${cabecalhoTabela}
                            <tbody>
                                ${linhasItens}
                                ${linhaTotalGeral}
                            </tbody>
                        </table>
                    </div>
                    
                    <!-- Resumo por Espécie -->
                    ${resumoPorEspecie}
                    
                    <!-- Assinaturas -->
                    <div class="assinaturas">
                        <div class="assinatura">
                            <div class="linha-assinatura">Responsável Técnico</div>
                        </div>
                        <div class="assinatura">
                            <div class="linha-assinatura">Fornecedor / Cliente</div>
                        </div>
                    </div>
                    
                    <!-- Rodapé -->
                    <div class="footer">
                        Relatório gerado em ${new Date().toLocaleDateString('pt-BR')} às ${new Date().toLocaleTimeString('pt-BR')}
                    </div>
                </div>
            </div>
        </body>
        </html>
    `;
}

// ✅ FUNÇÕES AUXILIARES DE FORMATAÇÃO
function formatInt(val) {
    return Math.round(parseFloat(val) || 0);
}

function formatDecimal(val, decimals = 2) {
    return (parseFloat(val) || 0).toFixed(decimals).replace('.', ',');
}

function formatVolume(val) {
    return (parseFloat(val) || 0).toFixed(3).replace('.', ',');
}

function formatCurrencyValue(val) {
    return (parseFloat(val) || 0).toLocaleString('pt-BR', {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2
    });
}

// ✅ FUNÇÃO PARA GERAR CABEÇALHO DA EMPRESA
function gerarCabecalhoEmpresaImpressao(dadosEmpresa) {
    // Gerar logo SVG padrão se não houver logo da empresa
    const logoSvgBase64 = gerarLogoSvgPadrao();
    
    return `
        <div class="company-header">
            <div class="company-logo-container">
                ${dadosEmpresa.logo 
                    ? `<img src="${dadosEmpresa.logo}" class="company-logo" alt="${dadosEmpresa.nome}" onerror="this.style.display='none'">`
                    : `<img src="data:image/svg+xml;base64,${logoSvgBase64}" class="company-logo" alt="${dadosEmpresa.nome}">`
                }
            </div>
            <div class="company-info">
                <div class="company-name">${dadosEmpresa.nome}</div>
                <div class="company-details">
                    ${dadosEmpresa.cnpj ? `CNPJ: ${dadosEmpresa.cnpj}<br>` : ''}
                    ${dadosEmpresa.endereco ? `Endereço: ${dadosEmpresa.endereco}<br>` : ''}
                    ${dadosEmpresa.cidade || dadosEmpresa.estado ? `Cidade: ${dadosEmpresa.cidade || ''} ${dadosEmpresa.estado ? `- Estado: ${dadosEmpresa.estado}` : ''}<br>` : ''}
                    ${dadosEmpresa.telefone ? `Telefone: ${dadosEmpresa.telefone}` : ''}
                </div>
            </div>
        </div>
    `;
}

// ✅ FUNÇÃO PARA GERAR CABEÇALHO DA TABELA
function gerarCabecalhoTabelaImpressao(tipo) {
    const mostrarPreco = tipo !== 'sem-preco';
    const mostrarPrecoUnitario = tipo !== 'sem-preco' && tipo !== 'sem-preco-unitario';
    
    return `
        <thead>
            <tr>
                <th style="width: 10%;">Plaqueta</th>
                <th style="width: ${mostrarPreco ? '15%' : '20%'};">Espécie</th>
                <th style="width: 8%;">Diâm. (cm)</th>
                <th style="width: 8%;">Comp. (cm)</th>
                <th style="width: 8%;">Oco 1 (cm)</th>
                <th style="width: 8%;">Oco 2 (cm)</th>
                <th style="width: 8%;">M³ Bruto</th>
                <th style="width: 8%;">M³ Desc.</th>
                <th style="width: 8%;">M³ Líq.</th>
                ${mostrarPrecoUnitario ? `<th style="width: 9%;" class="preco-coluna">Preço (R$)</th>` : ''}
                ${mostrarPreco ? `<th style="width: 10%;" class="valor-coluna">Valor (R$)</th>` : ''}
            </tr>
        </thead>
    `;
}

// ✅ FUNÇÃO PARA GERAR LINHA DE ITEM
function gerarLinhaItemImpressao(item, index, tipo) {
    const mostrarPreco = tipo !== 'sem-preco';
    const mostrarPrecoUnitario = tipo !== 'sem-preco' && tipo !== 'sem-preco-unitario';
    
    return `
        <tr>
            <td style="text-align: center;">${item.plaqueta || (index + 1)}</td>
            <td style="text-align: left;">${item.especie || ''}</td>
            <td style="text-align: center;">${formatInt(item.diametro)}</td>
            <td style="text-align: center;">${formatInt(item.comprimento)}</td>
            <td style="text-align: center;">${item.oco1 > 0 ? formatInt(item.oco1) : '-'}</td>
            <td style="text-align: center;">${item.oco2 > 0 ? formatInt(item.oco2) : '-'}</td>
            <td style="text-align: right;">${formatVolume(item.volumeBruto)}</td>
            <td style="text-align: right;">${formatVolume(item.volumeDesconto)}</td>
            <td style="text-align: right;">${formatVolume(item.volumeLiquido)}</td>
            ${mostrarPrecoUnitario ? `<td style="text-align: right;" class="preco-coluna">R$ ${formatCurrencyValue(item.preco)}</td>` : ''}
            ${mostrarPreco ? `<td style="text-align: right;" class="valor-coluna">R$ ${formatCurrencyValue(item.valor)}</td>` : ''}
        </tr>
    `;
}

// ✅ FUNÇÃO PARA GERAR LINHA DE TOTAL GERAL
function gerarLinhaTotalGeralImpressao(totais, tipo) {
    const mostrarPreco = tipo !== 'sem-preco';
    const mostrarPrecoUnitario = tipo !== 'sem-preco' && tipo !== 'sem-preco-unitario';
    
    let colspanBase = 6; // Plaqueta + Espécie + Diâmetro + Comprimento + Oco1 + Oco2
    
    return `
        <tr class="total-geral-row">
            <td colspan="${colspanBase}" style="text-align: right; font-weight: bold;">Total Geral:</td>
            <td style="text-align: right; font-weight: bold;">${formatVolume(totais.volumeBruto)}</td>
            <td style="text-align: right; font-weight: bold;">${formatVolume(totais.volumeDesconto)}</td>
            <td style="text-align: right; font-weight: bold;">${formatVolume(totais.volumeLiquido)}</td>
            ${mostrarPrecoUnitario ? `<td style="text-align: right; font-weight: bold;" class="preco-coluna">R$ ${formatCurrencyValue(totais.precoMedio)}</td>` : ''}
            ${mostrarPreco ? `<td style="text-align: right; font-weight: bold;" class="valor-coluna">R$ ${formatCurrencyValue(totais.valor)}</td>` : ''}
        </tr>
    `;
}

// ✅ FUNÇÃO PARA GERAR RESUMO POR ESPÉCIE
function gerarResumoPorEspecieImpressao(estatisticas, totais, tipo) {
    const mostrarPreco = tipo !== 'sem-preco';
    const mostrarPrecoUnitario = tipo !== 'sem-preco' && tipo !== 'sem-preco-unitario';
    
    const cabecalho = `
        <tr>
            <th>Espécie</th>
            <th>Qtd. Toras</th>
            <th>M³ Bruto</th>
            <th>M³ Desc.</th>
            <th>M³ Líq.</th>
            ${mostrarPrecoUnitario ? `<th>Preço Médio</th>` : ''}
            ${mostrarPreco ? `<th>Valor Total</th>` : ''}
        </tr>
    `;
    
    const linhas = estatisticas.map(especie => `
        <tr>
            <td>${especie.especie}</td>
            <td style="text-align: center;">${especie.quantidade}</td>
            <td style="text-align: right;">${formatVolume(especie.volumeBrutoTotal)}</td>
            <td style="text-align: right;">${formatVolume(especie.volumeDescontoTotal)}</td>
            <td style="text-align: right;">${formatVolume(especie.volumeLiquidoTotal)}</td>
            ${mostrarPrecoUnitario ? `<td style="text-align: right;">R$ ${formatDecimal(especie.precoMedio)}</td>` : ''}
            ${mostrarPreco ? `<td style="text-align: right;">R$ ${formatDecimal(especie.valorTotal)}</td>` : ''}
        </tr>
    `).join('');
    
    const linhaTotais = `
        <tr class="total-row">
            <td style="font-weight: bold;">Total:</td>
            <td style="text-align: center; font-weight: bold;">${totais.quantidade}</td>
            <td style="text-align: right; font-weight: bold;">${formatVolume(totais.volumeBruto)}</td>
            <td style="text-align: right; font-weight: bold;">${formatVolume(totais.volumeDesconto)}</td>
            <td style="text-align: right; font-weight: bold;">${formatVolume(totais.volumeLiquido)}</td>
            ${mostrarPrecoUnitario ? `<td style="text-align: right; font-weight: bold;">R$ ${formatDecimal(totais.precoMedio)}</td>` : ''}
            ${mostrarPreco ? `<td style="text-align: right; font-weight: bold;">R$ ${formatDecimal(totais.valor)}</td>` : ''}
        </tr>
    `;
    
    return `
        <div class="resumo-especie">
            <h3>Resumo por Espécie</h3>
            <table class="resumo-table">
                <thead>
                    ${cabecalho}
                </thead>
                <tbody>
                    ${linhas}
                </tbody>
                <tfoot>
                    ${linhaTotais}
                </tfoot>
            </table>
        </div>
    `;
}

// ✅ FUNÇÃO PARA GERAR ESTILOS CSS
function gerarEstilosCSSImpressao(tipo) {
    return `
        /* Reset e estilos gerais */
        * {
            box-sizing: border-box;
            margin: 0;
            padding: 0;
        }
        
        body {
            font-family: Arial, sans-serif;
            line-height: 1.4;
            color: #333;
            font-size: 12px;
        }
        
        /* Estrutura de página */
        .page-wrapper {
            width: 100%;
            position: relative;
            min-height: 100vh;
        }
        
        .page-content {
            padding: 20px;
            position: relative;
            min-height: calc(100vh - 40px);
        }
        
        /* Cabeçalho da empresa */
        .company-header {
            display: flex;
            align-items: center;
            margin-bottom: 20px;
            width: 100%;
        }
        
        .company-logo-container {
            width: 80px;
            height: 80px;
            display: flex;
            align-items: center;
            justify-content: center;
            margin-right: 20px;
        }
        
        .company-logo {
            max-width: 100%;
            max-height: 100%;
        }
        
        .company-logo-placeholder {
            color: #666;
            font-size: 12px;
            text-align: center;
        }
        
        .company-info {
            flex: 1;
        }
        
        .company-name {
            font-size: 18px;
            font-weight: bold;
            margin-bottom: 8px;
        }
        
        .company-details {
            font-size: 12px;
            line-height: 1.4;
        }
        
        /* Título do romaneio */
        .romaneio-title {
            font-size: 16px;
            font-weight: bold;
            text-align: center;
            margin: 20px 0;
            border-bottom: 2px solid #333;
            padding-bottom: 8px;
        }
        
        /* Bloco de informações */
        .info-block {
            margin-bottom: 20px;
            padding: 10px;
            border: 1px solid #ddd;
            background-color: #f9f9f9;
        }
        
        .info-row {
            display: flex;
            margin-bottom: 5px;
        }
        
        .info-label {
            font-weight: bold;
            width: 120px;
            flex-shrink: 0;
        }
        
        /* Tabelas */
        h3 {
            font-size: 14px;
            margin: 20px 0 10px;
            color: #333;
        }
        
        .table-container {
            margin-bottom: 20px;
            width: 100%;
        }
        
        table {
            width: 100%;
            border-collapse: collapse;
        }
        
        .main-table {
            margin-bottom: 20px;
        }
        
        thead th {
            background-color: #f0f0f0;
            border: 1px solid #333;
            padding: 8px 4px;
            font-size: 11px;
            font-weight: bold;
            text-align: center;
        }
        
        tbody td {
            border: 1px solid #666;
            padding: 6px 4px;
            font-size: 10px;
        }
        
        tbody tr:nth-child(even) {
            background-color: #f9f9f9;
        }
        
        .total-geral-row {
            background-color: #e0e0e0 !important;
            font-weight: bold;
        }
        
        .total-geral-row td {
            border: 2px solid #333 !important;
        }
        
        /* Resumo por espécie */
        .resumo-especie {
            margin: 30px 0;
            page-break-before: always; /* Força quebra de página antes do resumo */
            page-break-inside: avoid;
        }
        
        .resumo-table {
            margin-top: 10px;
        }
        
        .resumo-table thead th {
            background-color: #e8e8e8;
            border: 1px solid #333;
            padding: 6px 4px;
            font-size: 11px;
        }
        
        .resumo-table tbody td {
            border: 1px solid #666;
            padding: 5px 4px;
            font-size: 10px;
        }
        
        .resumo-table tfoot tr {
            background-color: #e0e0e0;
            font-weight: bold;
        }
        
        .resumo-table tfoot td {
            border: 2px solid #333;
        }
        
        /* Assinaturas */
        .assinaturas {
            margin-top: 40px;
            display: flex;
            justify-content: space-between;
            page-break-inside: avoid;
        }
        
        .assinatura {
            width: 45%;
            text-align: center;
        }
        
        .linha-assinatura {
            border-top: 1px solid #000;
            margin-top: 60px;
            padding-top: 5px;
            font-size: 11px;
        }
        
        /* Rodapé */
        .footer {
            margin-top: 30px;
            padding-top: 10px;
            border-top: 1px solid #ccc;
            font-size: 10px;
            text-align: center;
            color: #666;
        }
        
        /* Controles baseados no tipo de impressão */
        ${tipo === 'sem-preco-unitario' ? `
            .preco-coluna {
                display: none !important;
            }
        ` : ''}
        
        ${tipo === 'sem-preco' ? `
            .preco-coluna,
            .valor-coluna {
                display: none !important;
            }
        ` : ''}
        
        /* Estilos para impressão */
        @media print {
            body {
                margin: 0;
                font-size: 11px;
            }
            
            .page-content {
                padding: 15px;
            }
            
            table {
                font-size: 9px;
            }
            
            thead th {
                padding: 4px 2px;
                font-size: 9px;
            }
            
            tbody td {
                padding: 3px 2px;
                font-size: 9px;
            }
            
            .company-name {
                font-size: 16px;
            }
            
            .romaneio-title {
                font-size: 14px;
            }
            
            h3 {
                font-size: 12px;
            }
        }
    `;
}

// ===== FUNÇÕES DE AÇÃO DOS BOTÕES =====

// Função para editar romaneio
window.editarRomaneio = function(romaneioId) {
    console.log(`✏️ Editando romaneio ${romaneioId}`);
    
    // Fechar modal de lista
    const modal = document.getElementById('listaModal');
    if (modal) modal.style.display = 'none';
    
    // Se existe função específica para edição de tora, usar ela
    if (typeof window.editarRomaneioTora === 'function') {
        return window.editarRomaneioTora(romaneioId);
    }
    
    // Senão, implementar edição básica
    alert(`Função de edição será implementada. ID: ${romaneioId}`);
};

// Função para excluir romaneio - CORRIGIDA
window.excluirRomaneio = async function(romaneioId) {
    console.log(`🗑️ Excluindo romaneio ${romaneioId}`);
    
    // Fechar dropdowns
    document.querySelectorAll('.dropdown-menu, .external-print-menu').forEach(menu => {
        menu.remove();
    });
    
    // Confirmar exclusão
    if (!confirm('Tem certeza que deseja excluir este romaneio? Esta ação não pode ser desfeita.')) {
        return;
    }
    
    try {
        console.log(`🗑️ Iniciando exclusão do romaneio ${romaneioId}...`);
        
        // ✅ CARREGAR DADOS ATUAIS
        let dados = null;
        
        // Tentar carregar com databaseAdapter primeiro
        if (window.databaseAdapter && typeof window.databaseAdapter.loadData === 'function') {
            try {
                dados = await window.databaseAdapter.loadData('romaneiosTora');
                console.log('✅ Dados carregados via DatabaseAdapter para exclusão');
            } catch (error) {
                console.warn('⚠️ Erro no DatabaseAdapter:', error);
                dados = null;
            }
        }
        
        // Fallback para getData se databaseAdapter falhar
        if (!dados && typeof getData === 'function') {
            try {
                dados = await getData('romaneios/tora');
                console.log('✅ Dados carregados via getData para exclusão');
            } catch (error) {
                console.error('❌ Erro no getData:', error);
                dados = null;
            }
        }
        
        if (!dados) {
            throw new Error('Não foi possível carregar os dados para exclusão');
        }
        
        // ✅ CONVERTER DADOS PARA ARRAY
        let romaneios = [];
        if (dados && typeof dados === 'object') {
            if (dados.data !== undefined) {
                const dadosReais = dados.data;
                romaneios = Array.isArray(dadosReais) ? dadosReais : 
                           (typeof dadosReais === 'object' && dadosReais !== null ? Object.values(dadosReais) : []);
            } else if (Array.isArray(dados)) {
                romaneios = dados;
            } else {
                romaneios = Object.values(dados);
            }
        }
        
        console.log(`📊 ${romaneios.length} romaneios encontrados antes da exclusão`);
        
        // ✅ ENCONTRAR E REMOVER O ROMANEIO - VERSÃO MELHORADA
        const romaneiosIniciais = romaneios.length;
        
        console.log(`🔍 Procurando romaneio com ID: "${romaneioId}"`);
        console.log('📋 IDs disponíveis na lista:');
        romaneios.forEach((r, idx) => {
            const id = r.id || r.firebaseKey || r.romaneioId;
            console.log(`  [${idx}] ID: "${id}" | firebaseKey: "${r.firebaseKey}" | romaneioId: "${r.romaneioId}"`);
        });
        
        const novaLista = romaneios.filter(r => {
            // Múltiplas formas de comparação
            const id = r.id || r.firebaseKey || r.romaneioId;
            const match = (
                id === romaneioId ||                    // Comparação direta
                r.id === romaneioId ||                  // Comparação por r.id
                r.firebaseKey === romaneioId ||         // Comparação por firebaseKey  
                r.romaneioId === romaneioId ||          // Comparação por romaneioId
                String(id) === String(romaneioId) ||    // Comparação como string
                id?.toString() === romaneioId?.toString() // Comparação forçada string
            );
            
            if (match) {
                console.log(`🎯 Romaneio encontrado para exclusão: "${id}"`);
                return false; // Remove da lista
            }
            
            return true; // Mantém na lista
        });
        
        if (novaLista.length === romaneiosIniciais) {
            throw new Error('Romaneio não encontrado na lista');
        }
        
        console.log(`📊 ${novaLista.length} romaneios restantes após exclusão`);
        
        // ✅ SALVAR LISTA ATUALIZADA
        if (window.databaseAdapter && typeof window.databaseAdapter.saveData === 'function') {
            try {
                await window.databaseAdapter.saveData('romaneiosTora', novaLista);
                console.log('✅ Lista atualizada salva via DatabaseAdapter');
            } catch (error) {
                console.warn('⚠️ Erro ao salvar via DatabaseAdapter:', error);
                // Fallback para saveData se disponível
                if (typeof saveData === 'function') {
                    await saveData('romaneiosTora', novaLista);
                    console.log('✅ Lista atualizada salva via saveData');
                }
            }
        } else if (typeof saveData === 'function') {
            await saveData('romaneiosTora', novaLista);
            console.log('✅ Lista atualizada salva via saveData');
        } else {
            throw new Error('Não foi possível salvar os dados atualizados');
        }
        
        console.log(`✅ Romaneio ${romaneioId} excluído com sucesso`);
        alert(`✅ Romaneio ${romaneioId} excluído com sucesso!`);
        
        // ✅ MARCAR PARA FORÇAR ATUALIZAÇÃO E ATUALIZAR APENAS SE MODAL ESTIVER ABERTO
        window.romaneioListaNecessitaAtualizacao = true;
        window.ultimaAtualizacaoRomaneio = new Date().toISOString();
        
        // Verificar se a lista corrigida está aberta
        const modal = document.getElementById('listaModal');
        const modalAberto = modal && (
            modal.style.display === 'block' || 
            modal.style.display === '' || 
            modal.offsetParent !== null
        );
        
        if (modalAberto) {
            console.log('📋 Modal da lista corrigida está aberto - atualizando com dados frescos');
            await renderRomaneioListCorrigida('force-refresh');
        } else {
            console.log('ℹ️ Modal não está aberto - dados frescos serão carregados na próxima abertura');
        }
        
    } catch (error) {
        console.error('❌ Erro ao excluir romaneio:', error);
        alert('❌ Erro ao excluir romaneio: ' + error.message);
    }
};

// Substituir a função original
if (typeof window.abrirListaRomaneios === 'function') {
    window.abrirListaRomaneiosOriginal = window.abrirListaRomaneios;
}
window.abrirListaRomaneios = abrirListaRomaneiosCorrigida;

// 🔄 FUNÇÃO PARA FORÇAR DADOS FRESCOS (SEM CACHE)
async function carregarDadosFrescos(chave) {
    console.log(`🔄 === FORÇANDO DADOS FRESCOS PARA: ${chave} ===`);
    
    try {
        // ✅ STEP 1: Limpar TODOS os caches primeiro
        if (window.databaseAdapter) {
            // Limpar cache geral
            if (typeof window.databaseAdapter.clearCache === 'function') {
                window.databaseAdapter.clearCache();
                console.log("🧹 Cache geral do DatabaseAdapter limpo");
            }
            
            // Limpar cache de memória
            if (typeof window.databaseAdapter.clearMemoryCache === 'function') {
                window.databaseAdapter.clearMemoryCache();
                console.log("🧹 Cache de memória do DatabaseAdapter limpo");
            }
            
            // Limpar cache específico da chave
            if (window.databaseAdapter.memoryCache && typeof window.databaseAdapter.memoryCache.delete === 'function') {
                window.databaseAdapter.memoryCache.delete(chave);
                console.log(`🧹 Cache específico '${chave}' removido`);
            }
        }
        
        // ✅ STEP 2: Forçar carregamento direto do Firebase
        let dadosFrescos = null;
        
        // Tentar carregar direto do Firebase via firebaseService
        if (window.firebaseService && typeof window.firebaseService.loadFromFirebase === 'function') {
            console.log(`📡 Carregando dados frescos via firebaseService: ${chave}`);
            dadosFrescos = await window.firebaseService.loadFromFirebase(chave);
            console.log(`✅ Dados frescos carregados via firebaseService:`, dadosFrescos ? dadosFrescos.length || 'objeto' : 'null');
        }
        
        // Fallback: usar databaseAdapter com força
        if (!dadosFrescos && window.databaseAdapter && typeof window.databaseAdapter.loadData === 'function') {
            console.log(`📡 Fallback: carregando via databaseAdapter com força: ${chave}`);
            const resultado = await window.databaseAdapter.loadData(chave, { forceRefresh: true, ignoreCache: true });
            dadosFrescos = resultado?.data || resultado;
            console.log(`✅ Dados frescos carregados via databaseAdapter:`, dadosFrescos ? dadosFrescos.length || 'objeto' : 'null');
        }
        
        console.log(`✅ === DADOS FRESCOS CARREGADOS PARA: ${chave} ===`);
        return dadosFrescos;
        
    } catch (error) {
        console.error(`❌ Erro ao carregar dados frescos para ${chave}:`, error);
        throw error;
    }
}

/**
 * 🔄 FORÇAR ATUALIZAÇÃO DA LISTA APÓS EDIÇÃO
 * Esta função é chamada especificamente após salvar edições de romaneios
 */
window.forcarAtualizacaoListaAposEdicao = async function() {
    console.log("🔄 === FORÇANDO ATUALIZAÇÃO DA LISTA APÓS EDIÇÃO ===");
    
    try {
        // Marcar que dados precisam ser frescos
        window.romaneioListaNecessitaAtualizacao = true;
        window.ultimaAtualizacaoRomaneio = new Date().toISOString();
        
        // Verificar se o modal está aberto
        const modal = document.getElementById('listaModal');
        const modalAberto = modal && (
            modal.style.display === 'block' || 
            modal.style.display === '' || 
            modal.offsetParent !== null ||
            modal.classList.contains('show')
        );
        
        if (modalAberto) {
            console.log("📋 Modal está aberto - atualizando imediatamente com dados frescos");
            
            // Forçar re-renderização com dados frescos
            await renderRomaneioListCorrigida('force-refresh');
            
            console.log("✅ Lista atualizada com dados frescos");
            return true;
        } else {
            console.log("ℹ️ Modal não está aberto - dados frescos serão carregados na próxima abertura");
            return true;
        }
        
    } catch (error) {
        console.error("❌ Erro ao forçar atualização da lista após edição:", error);
        return false;
    }
};

// Expor a função globalmente para compatibilidade
window.forcarAtualizacaoListaRomaneios = window.forcarAtualizacaoListaAposEdicao;

// ✅ FUNÇÃO DE COMPATIBILIDADE PARA O DROPDOWN ANTIGO
window.imprimirRomaneioTora = function(romaneioId, index, tipo = 'completo') {
    console.log(`🖨️ [Compatibilidade] Redirecionando impressão: ${romaneioId}, tipo: ${tipo}`);
    
    // Fechar todos os dropdowns antigos
    document.querySelectorAll('.print-menu').forEach(menu => {
        menu.style.display = 'none';
    });
    
    // Redirecionar para a função externa
    return window.imprimirRomaneioToraExternal(romaneioId, index, tipo);
};

// ✅ CONECTAR À FUNÇÃO PRINCIPAL DE IMPRESSÃO SE EXISTIR
if (typeof window.imprimirRomaneio !== 'function') {
    window.imprimirRomaneio = function(romaneioId, tipo = 'completo') {
        console.log(`🖨️ [Função Principal] Imprimindo romaneio: ${romaneioId}, tipo: ${tipo}`);
        return window.imprimirRomaneioToraExternal(romaneioId, 0, tipo);
    };
}

// ✅ INTERCEPTAR E REDIRECIONAR FUNÇÕES DO ROMANEIO MANAGER
// Para garantir que sempre use a função corrigida de listagem

// Interceptar a função openModal do RomaneioToraManager
if (window.romaneioToraManager && typeof window.romaneioToraManager.openModal === 'function') {
    console.log('🔄 Interceptando RomaneioToraManager.openModal para usar função corrigida');
    window.romaneioToraManager.openModalOriginal = window.romaneioToraManager.openModal;
    
    window.romaneioToraManager.openModal = function(context = 'default') {
        console.log(`🔄 Redirecionando RomaneioToraManager.openModal para abrirListaRomaneiosCorrigida (context: ${context})`);
        return abrirListaRomaneiosCorrigida();
    };
}

// Interceptar a função renderList do RomaneioToraManager
if (window.romaneioToraManager && typeof window.romaneioToraManager.renderList === 'function') {
    console.log('🔄 Interceptando RomaneioToraManager.renderList para usar função corrigida');
    window.romaneioToraManager.renderListOriginal = window.romaneioToraManager.renderList;
    
    window.romaneioToraManager.renderList = function(filter = '', context = 'default') {
        console.log(`🔄 Redirecionando RomaneioToraManager.renderList para renderRomaneioListCorrigida (filter: ${filter}, context: ${context})`);
        return renderRomaneioListCorrigida(filter);
    };
}

// Interceptar função de forçar atualização
if (window.romaneioToraManager && typeof window.romaneioToraManager.forceRefreshList === 'function') {
    console.log('🔄 Interceptando RomaneioToraManager.forceRefreshList para usar função corrigida');
    window.romaneioToraManager.forceRefreshListOriginal = window.romaneioToraManager.forceRefreshList;
    
    window.romaneioToraManager.forceRefreshList = function() {
        console.log('🔄 Redirecionando RomaneioToraManager.forceRefreshList para função corrigida');
        return window.forcarAtualizacaoListaAposEdicao();
    };
}

// ✅ FUNÇÃO PARA RESTAURAR INTERCEPTAÇÕES (SE NECESSÁRIO)
window.restaurarFuncoesOriginaisRomaneioManager = function() {
    console.log('🔄 Restaurando funções originais do RomaneioToraManager');
    
    if (window.romaneioToraManager) {
        if (window.romaneioToraManager.openModalOriginal) {
            window.romaneioToraManager.openModal = window.romaneioToraManager.openModalOriginal;
            delete window.romaneioToraManager.openModalOriginal;
        }
        
        if (window.romaneioToraManager.renderListOriginal) {
            window.romaneioToraManager.renderList = window.romaneioToraManager.renderListOriginal;
            delete window.romaneioToraManager.renderListOriginal;
        }
        
        if (window.romaneioToraManager.forceRefreshListOriginal) {
            window.romaneioToraManager.forceRefreshList = window.romaneioToraManager.forceRefreshListOriginal;
            delete window.romaneioToraManager.forceRefreshListOriginal;
        }
    }
    
    console.log('✅ Funções originais restauradas');
};

// ✅ FUNÇÃO DE INICIALIZAÇÃO PARA GARANTIR INTERCEPTAÇÕES
window.inicializarCorrecoesListaRomaneios = function() {
    console.log('🚀 Inicializando correções para Lista de Romaneios...');
    
    // Aguardar um pouco para garantir que todos os objetos estejam carregados
    setTimeout(() => {
        // Verificar se existem objetos relacionados a romaneios
        if (window.romaneioToraManager) {
            console.log('📋 RomaneioToraManager encontrado, aplicando interceptações...');
            
            // Interceptar função openModal
            if (typeof window.romaneioToraManager.openModal === 'function' && !window.romaneioToraManager.openModalOriginal) {
                console.log('🔄 Interceptando RomaneioToraManager.openModal');
                window.romaneioToraManager.openModalOriginal = window.romaneioToraManager.openModal;
                
                window.romaneioToraManager.openModal = function(context = 'default') {
                    console.log(`🔄 Redirecionando RomaneioToraManager.openModal para abrirListaRomaneiosCorrigida (context: ${context})`);
                    return abrirListaRomaneiosCorrigida();
                };
            }
            
            // Interceptar função renderList
            if (typeof window.romaneioToraManager.renderList === 'function' && !window.romaneioToraManager.renderListOriginal) {
                console.log('🔄 Interceptando RomaneioToraManager.renderList');
                window.romaneioToraManager.renderListOriginal = window.romaneioToraManager.renderList;
                
                window.romaneioToraManager.renderList = function(filter = '', context = 'default') {
                    console.log(`🔄 Redirecionando RomaneioToraManager.renderList para renderRomaneioListCorrigida (filter: ${filter}, context: ${context})`);
                    return renderRomaneioListCorrigida(filter);
                };
            }
            
            // Interceptar função forceRefreshList
            if (typeof window.romaneioToraManager.forceRefreshList === 'function' && !window.romaneioToraManager.forceRefreshListOriginal) {
                console.log('🔄 Interceptando RomaneioToraManager.forceRefreshList');
                window.romaneioToraManager.forceRefreshListOriginal = window.romaneioToraManager.forceRefreshList;
                
                window.romaneioToraManager.forceRefreshList = function() {
                    console.log('🔄 Redirecionando RomaneioToraManager.forceRefreshList para função corrigida');
                    return window.forcarAtualizacaoListaAposEdicao();
                };
            }
        }
        
        // Verificar outras possíveis funções globais relacionadas
        if (window.excluirRomaneioTora && typeof window.excluirRomaneioTora === 'function') {
            console.log('🗑️ Função excluirRomaneioTora encontrada, redirecionando para função corrigida...');
            window.excluirRomaneioToraOriginal = window.excluirRomaneioTora;
            
            window.excluirRomaneioTora = function(romaneioId, index) {
                console.log(`🗑️ Redirecionando excluirRomaneioTora para função corrigida (ID: ${romaneioId})`);
                
                // Usar a função de exclusão corrigida que garante dados frescos
                return window.excluirRomaneio(romaneioId);
            };
        }
        
        // Interceptar função de confirmação de exclusão se existir
        if (window.excluirRomaneioConfirmado && typeof window.excluirRomaneioConfirmado === 'function') {
            console.log('🗑️ Função excluirRomaneioConfirmado encontrada, interceptando...');
            window.excluirRomaneioConfirmadoOriginal = window.excluirRomaneioConfirmado;
            
            window.excluirRomaneioConfirmado = async function(romaneioId, index) {
                console.log(`🗑️ Interceptando excluirRomaneioConfirmado (ID: ${romaneioId})`);
                
                try {
                    // Executar exclusão original
                    const resultado = await window.excluirRomaneioConfirmadoOriginal(romaneioId, index);
                    
                    // ✅ GARANTIR DADOS FRESCOS APÓS EXCLUSÃO
                    console.log('🔄 Forçando dados frescos após exclusão confirmada...');
                    
                    // Aguardar um momento para sincronização
                    await new Promise(resolve => setTimeout(resolve, 500));
                    
                    // Verificar se modal está aberto e forçar dados frescos
                    const modal = document.getElementById('listaModal');
                    const modalAberto = modal && (
                        modal.style.display === 'block' || 
                        modal.style.display === '' || 
                        modal.offsetParent !== null ||
                        modal.classList.contains('show')
                    );
                    
                    if (modalAberto) {
                        console.log('📋 Modal aberto - forçando atualização com dados frescos');
                        
                        // Usar função corrigida que força dados frescos
                        await renderRomaneioListCorrigida('force-refresh');
                        
                        // Double-check: se o manager está disponível, também forçar refresh lá
                        if (window.romaneioToraManager && typeof window.romaneioToraManager.forceRefreshList === 'function') {
                            await window.romaneioToraManager.forceRefreshList();
                        }
                    }
                    
                    return resultado;
                    
                } catch (error) {
                    console.error('❌ Erro na interceptação de exclusão:', error);
                    throw error;
                }
            };
        }
        
        console.log('✅ Inicialização das correções concluída!');
    }, 1000);
};

// ✅ EXECUTAR INICIALIZAÇÃO QUANDO A PÁGINA CARREGA
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', window.inicializarCorrecoesListaRomaneios);
} else {
    window.inicializarCorrecoesListaRomaneios();
}

// ✅ TAMBÉM EXECUTAR QUANDO A JANELA CARREGA COMPLETAMENTE
window.addEventListener('load', window.inicializarCorrecoesListaRomaneios);

console.log('✅ Correções para Lista de Romaneios carregadas com sucesso!'); 

// ✅ MONITORAMENTO E INTERCEPTAÇÃO COMPLETA
window.interceptarTodasFuncoesListaRomaneios = function() {
    console.log('🔍 Iniciando monitoramento completo de funções de lista de romaneios...');
    
    // Lista de possíveis nomes de funções que podem abrir a lista
    const possiveisFuncoes = [
        'listarRomaneios',
        'listarRomaneiosTora', 
        'abrirListaRomaneios',
        'abrirListaRomaneiosTora',
        'openRomaneioList',
        'showRomaneioList',
        'displayRomaneioList',
        'renderRomaneioList'
    ];
    
    possiveisFuncoes.forEach(nomeFuncao => {
        if (window[nomeFuncao] && typeof window[nomeFuncao] === 'function') {
            console.log(`🔄 Interceptando função global: ${nomeFuncao}`);
            
            // Salvar função original
            window[nomeFuncao + '_original'] = window[nomeFuncao];
            
            // Substituir pela função corrigida
            window[nomeFuncao] = function(...args) {
                console.log(`🔄 Redirecionando ${nomeFuncao} para abrirListaRomaneiosCorrigida (args:`, args, ')');
                return abrirListaRomaneiosCorrigida();
            };
        }
    });
    
    // Interceptar métodos de objeto romaneioManager se existir
    if (window.romaneioManager) {
        console.log('📋 Objeto romaneioManager encontrado, interceptando métodos...');
        
        const metodosParaInterceptar = ['openModal', 'renderList', 'showList', 'displayList'];
        
        metodosParaInterceptar.forEach(metodo => {
            if (typeof window.romaneioManager[metodo] === 'function') {
                console.log(`🔄 Interceptando romaneioManager.${metodo}`);
                
                if (!window.romaneioManager[metodo + '_original']) {
                    window.romaneioManager[metodo + '_original'] = window.romaneioManager[metodo];
                    
                    window.romaneioManager[metodo] = function(...args) {
                        console.log(`🔄 Redirecionando romaneioManager.${metodo} para função corrigida (args:`, args, ')');
                        return abrirListaRomaneiosCorrigida();
                    };
                }
            }
        });
    }
    
    console.log('✅ Monitoramento e interceptação completa configurada!');
};

// ✅ FUNÇÃO PARA EXECUTAR INTERCEPTAÇÃO PERIÓDICA
window.monitoramentoPeriodicoRomaneios = function() {
    console.log('🔄 Executando verificação periódica de interceptações...');
    
    // Executar interceptações principais
    window.interceptarTodasFuncoesListaRomaneios();
    
    // Executar interceptações específicas do RomaneioToraManager
    if (window.romaneioToraManager && !window.romaneioToraManager.openModalOriginal) {
        if (typeof window.romaneioToraManager.openModal === 'function') {
            console.log('🔄 Re-interceptando RomaneioToraManager.openModal');
            window.romaneioToraManager.openModalOriginal = window.romaneioToraManager.openModal;
            
            window.romaneioToraManager.openModal = function(context = 'default') {
                console.log(`🔄 Redirecionando RomaneioToraManager.openModal para abrirListaRomaneiosCorrigida (context: ${context})`);
                return abrirListaRomaneiosCorrigida();
            };
        }
    }
    
    console.log('✅ Verificação periódica concluída!');
};

// ✅ EXECUTAR MONITORAMENTO PERIÓDICO A CADA 5 SEGUNDOS
setInterval(window.monitoramentoPeriodicoRomaneios, 5000);

// ✅ FUNÇÃO PARA GARANTIR CONSISTÊNCIA APÓS OPERAÇÕES
window.garantirListaCorrigidaAposOperacao = function(operacao = 'operação') {
    console.log(`🔄 Garantindo que lista corrigida seja aberta após: ${operacao}`);
    
    // Aguardar um momento para garantir que a operação foi concluída
    setTimeout(() => {
        // Verificar se alguma lista de romaneios está aberta
        const modalAberto = document.querySelector('.modal:not([style*="display: none"])');
        const containerLista = document.querySelector('#romaneio-list-container, #romaneio-container, .romaneio-list, .lista-romaneios');
        
        if (modalAberto || containerLista) {
            console.log('📋 Modal ou container de lista detectado, substituindo por versão corrigida...');
            
            // Fechar modal atual se existir
            if (modalAberto) {
                modalAberto.style.display = 'none';
            }
            
            // Limpar container se existir
            if (containerLista) {
                containerLista.innerHTML = '';
            }
            
            // Abrir versão corrigida
            setTimeout(() => {
                abrirListaRomaneiosCorrigida();
            }, 100);
        } else {
            console.log('📋 Nenhuma lista detectada, abrindo versão corrigida...');
            abrirListaRomaneiosCorrigida();
        }
    }, 200);
};

// ✅ INTERCEPTAR EVENTOS DE CLIQUE EM BOTÕES DE EXCLUSÃO
document.addEventListener('click', function(event) {
    const target = event.target;
    
    // Verificar se o clique foi em um botão de exclusão de romaneio
    if (target.classList.contains('btn-delete-romaneio') || 
        target.classList.contains('delete-romaneio') ||
        target.getAttribute('onclick')?.includes('excluir') ||
        target.getAttribute('onclick')?.includes('delete')) {
        
        console.log('🗑️ Clique em botão de exclusão detectado, preparando para garantir lista corrigida...');
        
        // Aguardar um momento após o clique para garantir que a lista corrigida seja aberta
        setTimeout(() => {
            window.garantirListaCorrigidaAposOperacao('exclusão');
        }, 1000);
    }
});

// ✅ FUNÇÃO DE ATIVAÇÃO MANUAL (CASO NECESSÁRIO)
window.ativarCorrecoesListaRomaneios = function() {
    console.log('🚀 Ativando correções manualmente...');
    
    // Executar todas as interceptações
    window.inicializarCorrecoesListaRomaneios();
    window.interceptarTodasFuncoesListaRomaneios();
    
    console.log('✅ Correções ativadas manualmente!');
};

// ✅ FUNÇÃO DE DIAGNÓSTICO PARA DEBUG
window.diagnosticarListaRomaneios = function() {
    console.log('🔍 === DIAGNÓSTICO DE LISTA DE ROMANEIOS ===');
    
    console.log('📋 Objetos disponíveis:');
    console.log('- romaneioToraManager:', !!window.romaneioToraManager);
    console.log('- romaneioManager:', !!window.romaneioManager);
    
    console.log('🔧 Funções interceptadas:');
    if (window.romaneioToraManager) {
        console.log('- openModalOriginal:', !!window.romaneioToraManager.openModalOriginal);
        console.log('- renderListOriginal:', !!window.romaneioToraManager.renderListOriginal);
    }
    
    console.log('🎯 Funções corrigidas:');
    console.log('- abrirListaRomaneiosCorrigida:', !!window.abrirListaRomaneiosCorrigida);
    console.log('- renderRomaneioListCorrigida:', !!window.renderRomaneioListCorrigida);
    
    console.log('🔄 Monitoramento ativo:', !!window.monitoramentoPeriodicoRomaneios);
    
    console.log('✅ Diagnóstico concluído!');
};

// ✅ ATIVAR CORREÇÕES IMEDIATAMENTE
window.ativarCorrecoesListaRomaneios();

console.log('🎉 Sistema de correções completo para Lista de Romaneios ativado!');
console.log('💡 Use window.diagnosticarListaRomaneios() para debug');
console.log('🔧 Use window.ativarCorrecoesListaRomaneios() para reativar se necessário');

// ✅ INTERCEPTAR EVENTOS GLOBAIS DE EXCLUSÃO PARA GARANTIR DADOS FRESCOS
window.interceptarEventosExclusao = function() {
    console.log('🔍 Configurando interceptação global de eventos de exclusão...');
    
    // Interceptar chamadas de confirm() para exclusão de romaneios
    const confirmOriginal = window.confirm;
    window.confirm = function(message) {
        const resultado = confirmOriginal.call(this, message);
        
        // Se é confirmação de exclusão de romaneio e foi confirmada
        if (resultado && message && (
            message.includes('excluir') || 
            message.includes('delete') || 
            message.includes('romaneio')
        )) {
            console.log('🗑️ Confirmação de exclusão detectada, marcando para atualização...');
            
            // Marcar que dados precisam ser frescos
            window.romaneioListaNecessitaAtualizacao = true;
            window.ultimaAtualizacaoRomaneio = new Date().toISOString();
            
            // Configurar timeout para forçar atualização após exclusão
            setTimeout(async () => {
                console.log('🔄 Timeout de exclusão executado - verificando se modal está aberto...');
                
                const modal = document.getElementById('listaModal');
                const modalAberto = modal && (
                    modal.style.display === 'block' || 
                    modal.style.display === '' || 
                    modal.offsetParent !== null ||
                    modal.classList.contains('show')
                );
                
                if (modalAberto) {
                    console.log('📋 Modal aberto após exclusão - forçando dados frescos');
                    await renderRomaneioListCorrigida('force-refresh');
                }
            }, 1000);
        }
        
        return resultado;
    };
    
    console.log('✅ Interceptação global de eventos de exclusão configurada');
};

// ✅ OBSERVER PARA MUDANÇAS NO DOM DA LISTA
window.configurarObserverListaRomaneios = function() {
    console.log('👁️ Configurando observer para mudanças na lista...');
    
    // Observer para detectar quando a lista é modificada
    const observerConfig = {
        childList: true,
        subtree: true,
        attributes: true,
        attributeFilter: ['style', 'class']
    };
    
    const observer = new MutationObserver((mutations) => {
        mutations.forEach((mutation) => {
            // Detectar se algum botão de exclusão foi clicado
            if (mutation.type === 'childList') {
                const addedNodes = Array.from(mutation.addedNodes);
                const removedNodes = Array.from(mutation.removedNodes);
                
                // Se foi removida uma linha da tabela (possível exclusão)
                removedNodes.forEach(node => {
                    if (node.tagName === 'TR' && node.textContent && node.textContent.includes('excluir')) {
                        console.log('🗑️ Linha de romaneio removida detectada - marcando para refresh');
                        window.romaneioListaNecessitaAtualizacao = true;
                    }
                });
            }
            
            // Detectar mudanças de visibilidade do modal
            if (mutation.type === 'attributes' && 
                (mutation.attributeName === 'style' || mutation.attributeName === 'class')) {
                
                const target = mutation.target;
                if (target.id === 'listaModal') {
                    const isVisible = target.style.display !== 'none' && 
                                    !target.classList.contains('d-none') &&
                                    target.offsetParent !== null;
                    
                    if (isVisible && window.romaneioListaNecessitaAtualizacao) {
                        console.log('👁️ Modal tornou-se visível e necessita atualização - forçando dados frescos');
                        setTimeout(() => {
                            renderRomaneioListCorrigida('force-refresh');
                        }, 100);
                    }
                }
            }
        });
    });
    
    // Observar o documento inteiro
    observer.observe(document.body, observerConfig);
    
    console.log('✅ Observer configurado para detectar mudanças na lista');
    return observer;
};

// ✅ EXECUTAR INTERCEPTAÇÕES E OBSERVER
window.interceptarEventosExclusao();
window.configurarObserverListaRomaneios();

// ✅ VERIFICAÇÃO AUTOMÁTICA DE CONSISTÊNCIA DA LISTA
window.verificarConsistenciaListaRomaneios = async function() {
    try {
        // Verificar se o modal está aberto
        const modal = document.getElementById('listaModal');
        const modalAberto = modal && (
            modal.style.display === 'block' || 
            modal.style.display === '' || 
            modal.offsetParent !== null ||
            modal.classList.contains('show')
        );
        
        if (!modalAberto) {
            return; // Não fazer nada se modal não está aberto
        }
        
        console.log('🔍 Verificando consistência da lista de romaneios...');
        
        // Contar quantos romaneios estão sendo exibidos na tabela
        const tbody = document.querySelector('#listaModal tbody') || document.querySelector('#romaneioListTable');
        if (!tbody) return;
        
        const linhasVisiveis = tbody.querySelectorAll('tr:not([style*="display: none"])');
        const romaneiosVisiveis = Array.from(linhasVisiveis).filter(tr => {
            const td = tr.querySelector('td');
            return td && !td.textContent.includes('Carregando') && !td.textContent.includes('Nenhum romaneio');
        }).length;
        
        console.log(`📊 Romaneios visíveis na tabela: ${romaneiosVisiveis}`);
        
        // Carregar dados frescos diretamente do Firebase para comparar
        let dadosFrescos = null;
        try {
            if (window.firebaseService && typeof window.firebaseService.loadFromFirebase === 'function') {
                const result = await window.firebaseService.loadFromFirebase('romaneios/tora');
                if (result && result.success && result.data) {
                    dadosFrescos = result.data;
                    const romaneiosFirebase = Array.isArray(dadosFrescos) ? 
                        dadosFrescos.length : 
                        (typeof dadosFrescos === 'object' ? Object.keys(dadosFrescos).length : 0);
                    
                    console.log(`📊 Romaneios no Firebase: ${romaneiosFirebase}`);
                    
                    // Se há discrepância significativa (mais de 1 romaneio de diferença)
                    if (Math.abs(romaneiosVisiveis - romaneiosFirebase) > 0) {
                        console.log('⚠️ INCONSISTÊNCIA DETECTADA - forçando atualização da lista');
                        console.log(`📊 Visíveis: ${romaneiosVisiveis}, Firebase: ${romaneiosFirebase}`);
                        
                        // Forçar atualização imediata
                        window.romaneioListaNecessitaAtualizacao = true;
                        await renderRomaneioListCorrigida('force-refresh');
                        
                        console.log('✅ Lista atualizada para corrigir inconsistência');
                        return true;
                    } else {
                        console.log('✅ Lista está consistente com Firebase');
                        return false;
                    }
                }
            }
        } catch (error) {
            console.warn('⚠️ Erro ao verificar consistência:', error);
        }
        
        return false;
        
    } catch (error) {
        console.error('❌ Erro na verificação de consistência:', error);
        return false;
    }
};

// ✅ EXECUTAR VERIFICAÇÃO PERIÓDICA
setInterval(async () => {
    if (window.romaneioListaNecessitaAtualizacao) {
        console.log('🔄 Verificação periódica detectou necessidade de atualização');
        await window.verificarConsistenciaListaRomaneios();
    }
}, 3000); // Verificar a cada 3 segundos

// ✅ FUNÇÃO FINAL DE CORREÇÃO ROBUSTA
window.garantirListaAtualizadaAposExclusao = async function(tentativas = 3) {
    console.log(`🔄 Garantindo lista atualizada após exclusão (tentativa ${4 - tentativas}/3)...`);
    
    if (tentativas <= 0) {
        console.log('❌ Máximo de tentativas excedido');
        return false;
    }
    
    try {
        // Verificar consistência
        const inconsistente = await window.verificarConsistenciaListaRomaneios();
        
        if (inconsistente) {
            // Se ainda há inconsistência, tentar novamente
            await new Promise(resolve => setTimeout(resolve, 1000));
            return await window.garantirListaAtualizadaAposExclusao(tentativas - 1);
        } else {
            console.log('✅ Lista está corretamente atualizada');
            return true;
        }
        
    } catch (error) {
        console.error('❌ Erro ao garantir lista atualizada:', error);
        
        // Tentar novamente em caso de erro
        if (tentativas > 1) {
            await new Promise(resolve => setTimeout(resolve, 1000));
            return await window.garantirListaAtualizadaAposExclusao(tentativas - 1);
        } else {
            return false;
        }
    }
};

console.log('🎯 Sistema avançado de consistência de lista ativado!');
