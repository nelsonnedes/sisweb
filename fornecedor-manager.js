/**
 * 🏢 FORNECEDOR MANAGER - SISTEMA UNIFICADO
 * 
 * Este arquivo consolida todas as funcionalidades de fornecedores de:
 * - fornecedor-modals.js
 * - correcao-funcoes-ausentes.js  
 * - romaneiotora_modais.js
 * 
 * ✅ Mantém compatibilidade total com todas as chamadas existentes
 * ✅ Unifica nomenclatura e comportamentos
 * ✅ Elimina conflitos entre arquivos
 */

console.log("🏢 === FORNECEDOR MANAGER - SISTEMA UNIFICADO ===");

class FornecedorManager {
    constructor() {
        this.modalId = 'clientListModal';
        this.tableId = 'clientListTable';
        this.filterId = 'clientListFilter';
        this.initialized = false;
        
        // ✅ CACHE EM MEMÓRIA PARA FILTROS EFICIENTES
        this.allFornecedores = [];
        this.filteredFornecedores = [];
        this.currentFilter = '';
        this.viewType = 'todos'; // todos | fornecedores | clientes
        
        console.log("🏗️ FornecedorManager inicializado");
    }

    persistLocalValue(storageKey, data) {
        try {
            if (window.SiswebStorage && typeof window.SiswebStorage.write === 'function') {
                return window.SiswebStorage.write(storageKey, data) !== false;
            }
        } catch (_) {}
        localStorage.setItem(storageKey, JSON.stringify(data));
        return true;
    }

    // ====================================================================
    // 🎯 CORE FUNCTIONS - Funções principais unificadas
    // ====================================================================

    /**
     * Função unificada para obter dados de fornecedores
     */
    async getData(key) {
        console.log(`📂 FornecedorManager: Carregando dados de ${key}...`);
        
        try {
            let finalKey = key;
            
            // Mapeamento de keys para padrão unificado
            if (key === 'clientesTora') {
                finalKey = 'fornecedores';
                console.log(`🔄 Redirecionando carregamento de '${key}' para 'fornecedores'`);
            }
            
            let data = [];
            
            // 1. Tentar Firebase primeiro (prioridade)
            if (window.firebaseService && typeof window.firebaseService.loadFromFirebase === 'function') {
                try {
                    console.log(`🔥 Carregando ${finalKey} do Firebase...`);
                    const result = await window.firebaseService.loadFromFirebase(finalKey);
                    
                    if (result && result.success && result.data) {
                        const firebaseData = result.data;
                        console.log("✅ Dados do Firebase encontrados:", firebaseData);
                        
                        // Processar dados do Firebase
                        if (Array.isArray(firebaseData)) {
                            data = firebaseData;
                        } else if (typeof firebaseData === 'object') {
                            data = Object.keys(firebaseData).map(clientId => ({
                                id: clientId,
                                originalId: firebaseData[clientId].id || clientId,
                                ...firebaseData[clientId]
                            }));
                        }
                        
                        console.log(`✅ ${data.length} registros carregados do Firebase`);
                        
                        // Atualizar cache local
                        try {
                            this.persistLocalValue(finalKey, data);
                            console.log(`✅ Cache local de ${finalKey} atualizado`);
                        } catch (cacheError) {
                            console.warn(`⚠️ Erro ao atualizar cache local:`, cacheError);
                        }
                        
                    } else if (result && result.data === null) {
                        console.log(`⚠️ ${finalKey} está vazio no Firebase`);
                        data = [];
                    } else {
                        console.warn(`⚠️ ${finalKey} não encontrado no Firebase ou dados inválidos`);
                        data = [];
                    }
                } catch (firebaseError) {
                    console.warn(`⚠️ Erro no Firebase para ${finalKey}: ${firebaseError.message}`);
                    // Fallback para localStorage
                    try {
                        console.log(`🔄 Tentando cache local para ${finalKey}...`);
                        const localData = localStorage.getItem(finalKey);
                        
                        if (localData) {
                            const parsed = JSON.parse(localData);
                            data = Array.isArray(parsed) ? parsed : [parsed];
                            console.log(`✅ ${data.length} registros carregados do cache local`);
                        } else {
                            console.log(`📱 ${finalKey} não encontrado no cache local`);
                            data = [];
                        }
                    } catch (localError) {
                        console.error(`❌ Erro ao carregar cache local:`, localError);
                        data = [];
                    }
                }
            } else {
                // Fallback para localStorage quando Firebase não disponível
                try {
                    console.log(`🔄 Usando cache local como fonte para ${finalKey}...`);
                    const localData = localStorage.getItem(finalKey);
                    
                    if (localData) {
                        const parsed = JSON.parse(localData);
                        data = Array.isArray(parsed) ? parsed : [parsed];
                        console.log(`✅ ${data.length} registros carregados do cache local`);
                    } else {
                        console.log(`📱 ${finalKey} não encontrado no cache local`);
                        data = [];
                    }
                } catch (localError) {
                    console.error(`❌ Erro ao carregar cache local:`, localError);
                    data = [];
                }
            }
            
            // Validação final
            if (data === null || data === undefined) {
                console.log(`📝 ${finalKey} não encontrado, retornando array vazio`);
                return [];
            }
            
            if (Array.isArray(data)) {
                console.log(`✅ ${finalKey} carregado: ${data.length} registros`);
                return data;
            } else {
                console.warn(`⚠️ ${finalKey} tem tipo inesperado: ${typeof data}, convertendo para array`);
                return [data];
            }
            
        } catch (error) {
            console.error(`❌ Erro geral ao carregar ${key}:`, error);
            console.log(`📝 Retornando array vazio para ${key} devido a erro`);
            return [];
        }
    }

    /**
     * Função unificada para salvar dados de fornecedores
     */
    async saveData(key, data) {
        console.log(`💾 === SALVAMENTO INICIADO ===`);
        console.log(`💾 Chave: ${key}`);
        console.log(`💾 Dados:`, data);
        
        try {
            let finalKey = key;
            
            if (data === null || data === undefined) {
                console.warn(`⚠️ Tentativa de salvar dados null/undefined para ${key}`);
                data = [];
            }
            
            // Mapeamento de keys
            if (key === 'clientesTora') {
                finalKey = 'fornecedores';
                console.log(`🔄 Redirecionando salvamento de '${key}' para 'fornecedores'`);
            }
            
            // Tentar salvar no Firebase primeiro
            if (window.firebaseService && typeof window.firebaseService.saveToFirebase === 'function') {
                try {
                    console.log(`🔥 Salvando ${finalKey} no Firebase...`);
                    const result = await window.firebaseService.saveToFirebase(finalKey, null, data);
                    
                    if (result && result.success) {
                        console.log(`✅ ${finalKey} salvo no Firebase com sucesso`);
                        
                        // Backup no localStorage apenas como cache
                        if (!window.deletingRomaneio) {
                            try {
                                this.persistLocalValue(finalKey, data);
                                console.log(`✅ Cache local de ${finalKey} atualizado`);
                            } catch (localError) {
                                console.warn(`⚠️ Cache local falhou para ${finalKey}:`, localError);
                            }
                        } else {
                            console.log(`🗑️ Não atualizando cache local (operação de exclusão)`);
                        }
                        
                        return true;
                    } else {
                        console.warn(`⚠️ Firebase retornou resultado inválido para ${finalKey}:`, result);
                        throw new Error('Firebase retornou resultado inválido');
                    }
                } catch (firebaseError) {
                    console.warn(`⚠️ Erro ao salvar ${finalKey} no Firebase: ${firebaseError.message}`);
                    console.warn("🔄 IMPORTANTE: Firebase não está funcionando corretamente");
                    throw firebaseError;
                }
            } else {
                // Fallback para localStorage apenas
                try {
                    this.persistLocalValue(finalKey, data);
                    console.log(`✅ ${finalKey} salvo no localStorage`);
                    return true;
                } catch (localError) {
                    console.error(`❌ Erro ao salvar ${finalKey} no localStorage:`, localError);
                    throw localError;
                }
            }
            
        } catch (error) {
            console.error(`❌ Erro ao salvar ${key}:`, error);
            throw error;
        }
    }

    // ====================================================================
    // 🎨 MODAL MANAGEMENT - Gestão de modais unificada
    // ====================================================================

    /**
     * Abre o modal de lista de fornecedores (API unificada)
     */
    async openModal(context = 'default') {
        console.log(`🔍 Abrindo modal de lista de fornecedores - Contexto: ${context}`);
        
        let modal = document.getElementById(this.modalId);
        
        if (!modal) {
            console.log("🔧 Modal não encontrado, criando novo modal...");
            modal = this.createModal();
        }
        
        console.log("🔄 Carregando lista de fornecedores...");
        await this.renderList('', context);
        modal.style.display = 'block';
    }

    /**
     * Cria o modal de fornecedores
     */
    createModal() {
        console.log("🏗️ Criando modal de lista de fornecedores...");
        
        const modal = document.createElement('div');
        modal.id = this.modalId;
        modal.className = 'modal';
        modal.style.cssText = `
            display: none;
            position: fixed;
            z-index: 1000;
            left: 0;
            top: 0;
            width: 100%;
            height: 100%;
            background-color: rgba(0,0,0,0.5);
        `;
        
        modal.innerHTML = `
            <div class="modal-content" style="background-color: white; margin: 2% auto; padding: 0; border-radius: 8px; width: 90%; max-width: 900px; max-height: 90%; overflow-y: auto;">
                <div class="modal-header" style="padding: 20px; border-bottom: 1px solid #ddd; display: flex; justify-content: space-between; align-items: center;">
                    <h3 class="modal-title" style="margin: 0; font-size: 18px; font-weight: 600;">Lista de Fornecedores</h3>
                    <span class="close" onclick="document.getElementById('${this.modalId}').style.display='none'" style="font-size: 28px; font-weight: bold; cursor: pointer;">&times;</span>
                </div>
                <div class="modal-body">
                    <div id="clientListControls" style="display:flex;gap:8px;align-items:center;justify-content:space-between;margin:10px 0;">
                        <div>
                            <button type="button" id="viewAllBtn" style="background:#2c3e50;color:#fff;border:none;border-radius:4px;padding:6px 10px;cursor:pointer;margin-right:6px;">Todos</button>
                            <button type="button" id="viewSuppliersBtn" style="background:#374151;color:#fff;border:none;border-radius:4px;padding:6px 10px;cursor:pointer;margin-right:6px;">Fornecedores</button>
                            <button type="button" id="viewClientsBtn" style="background:#374151;color:#fff;border:none;border-radius:4px;padding:6px 10px;cursor:pointer;">Clientes</button>
                        </div>
                        <input type="text" id="${this.filterId}" placeholder="🔍 Buscar por nome, CNPJ, cidade..." 
                               style="flex:1;margin:0; padding: 10px 12px; border: 2px solid #e0e0e0; border-radius: 8px; font-size: 14px; outline: none;">
                    </div>
                    <table class="table">
                        <thead>
                            <tr style="background-color: #2c3e50; color: white;">
                                <th style="padding: 12px; text-align: left;">Nome</th>
                                <th style="padding: 12px; text-align: left;">CNPJ</th>
                                <th style="padding: 12px; text-align: left;">Cidade</th>
                                <th style="padding: 12px; text-align: left;">Estado</th>
                                <th style="padding: 12px; text-align: left;">Telefone</th>
                                <th style="padding: 12px; text-align: left;">Email</th>
                                <th style="padding: 12px; text-align: center;">Ações</th>
                            </tr>
                        </thead>
                        <tbody id="${this.tableId}"></tbody>
                    </table>
                </div>
                <div class="modal-footer" style="padding: 15px 20px; border-top: 1px solid #ddd; text-align: right;">
                    <button type="button" onclick="document.getElementById('${this.modalId}').style.display='none'" 
                            style="background-color: #6c757d; color: white; padding: 8px 16px; border: none; border-radius: 4px; cursor: pointer; margin-right: 10px;">
                        Fechar
                    </button>
                    <button type="button" onclick="fornecedorManager.openNewModal()" 
                            style="background-color: #007bff; color: white; padding: 8px 16px; border: none; border-radius: 4px; cursor: pointer;">
                        Novo Fornecedor
                    </button>
                </div>
            </div>
        `;
        
        document.body.appendChild(modal);
        
        // ✅ CONFIGURAÇÃO DE FILTRO OTIMIZADA (SIMILAR AO SISTEMA DE ESPÉCIES)
        const filterInput = document.getElementById(this.filterId);
        if (filterInput) {
            // ✅ Evento de input para filtro em tempo real
            filterInput.addEventListener('input', (e) => {
                const filterValue = e.target.value;
                console.log(`🔍 Filtro de fornecedores aplicado: "${filterValue}"`);
                
                // Aplicar filtro e re-renderizar apenas a tabela (sem recarregar dados)
                this.applyFilter(filterValue);
                this.renderFilteredTable();
            });
            
            // Tecla Escape para limpar filtro
            filterInput.addEventListener('keydown', (e) => {
                if (e.key === 'Escape') {
                    e.target.value = '';
                    this.applyFilter('');
                    this.renderFilteredTable();
                }
            });
            
            console.log("✅ Event listeners do filtro de fornecedores configurados");
        } else {
            console.error("❌ Campo de filtro de fornecedores não encontrado");
        }
        
        // Controles de visualização (Todos/Fornecedores/Clientes)
        const viewAllBtn = modal.querySelector('#viewAllBtn');
        const viewSuppliersBtn = modal.querySelector('#viewSuppliersBtn');
        const viewClientsBtn = modal.querySelector('#viewClientsBtn');
        const setActive = (type) => {
            this.viewType = type;
            // feedback visual simples
            [viewAllBtn, viewSuppliersBtn, viewClientsBtn].forEach(btn => btn && (btn.style.background = '#374151'));
            if (type === 'todos' && viewAllBtn) viewAllBtn.style.background = '#2c3e50';
            if (type === 'fornecedores' && viewSuppliersBtn) viewSuppliersBtn.style.background = '#2c3e50';
            if (type === 'clientes' && viewClientsBtn) viewClientsBtn.style.background = '#2c3e50';
            this.applyFilter(this.currentFilter);
            this.renderFilteredTable();
        };
        if (viewAllBtn) viewAllBtn.addEventListener('click', () => setActive('todos'));
        if (viewSuppliersBtn) viewSuppliersBtn.addEventListener('click', () => setActive('fornecedores'));
        if (viewClientsBtn) viewClientsBtn.addEventListener('click', () => setActive('clientes'));
        setActive('todos');
        
        // Fechar modal ao clicar fora
        modal.addEventListener('click', (e) => {
            if (e.target === modal) {
                modal.style.display = 'none';
            }
        });
        
        console.log("✅ Modal de fornecedores criado com sucesso");
        return modal;
    }

    // ====================================================================
    // 📊 TABLE RENDERING - Renderização de tabelas unificada
    // ====================================================================

    /**
     * Renderiza a lista de fornecedores (API unificada)
     */
    async renderList(filter = '', context = 'default') {
        console.log(`🔍 === RENDERIZANDO LISTA DE FORNECEDORES - ${context.toUpperCase()} ===`);
        console.log(`🔍 Filtro aplicado:`, filter);
        
        const tableBody = document.getElementById(this.tableId);
        if (!tableBody) {
            console.error(`❌ Tabela ${this.tableId} não encontrada`);
            return;
        }
        
        try {
            console.log("🔥 === CARREGAMENTO HÍBRIDO: FORNECEDORES + CLIENTES ===");
            
            // Carregar fornecedores e clientes separadamente
            const fornecedores = await this.getData('fornecedores');
            const clientes = await this.getData('clients');
            
            const normalize = (item, index, tipo) => ({
                id: item.id || `${tipo}_temp_${index}`,
                originalId: item.originalId || item.id,
                nome: item.nome || item.name || 'Nome não informado',
                cnpj: item.cnpj || '',
                cidade: item.cidade || '',
                estado: item.estado || '',
                telefone: item.telefone || '',
                email: item.email || '',
                tipo, // 'fornecedor' | 'cliente'
                ...item
            });
            
            const listFornecedores = (Array.isArray(fornecedores) ? fornecedores : []).map((item, i) => normalize(item, i, 'fornecedor'));
            const listClientes = (Array.isArray(clientes) ? clientes : []).map((item, i) => normalize(item, i, 'cliente'));
            
            // Unificar mantendo ordem: fornecedores primeiro por prioridade
            this.allFornecedores = [...listFornecedores, ...listClientes];
            console.log(`✅ Híbrido carregado: ${this.allFornecedores.length} registros (${listFornecedores.length} fornecedores, ${listClientes.length} clientes)`);
            
            this.applyFilter(filter);
            this.renderFilteredTable();
            
        } catch (error) {
            console.error("❌ Erro ao renderizar lista de fornecedores:", error);
            
            // Fallback para lista vazia
            const tr = document.createElement('tr');
            const td = document.createElement('td');
            td.colSpan = 7;
            td.className = 'text-center';
            td.textContent = 'Erro ao carregar fornecedores. Tente novamente.';
            tr.appendChild(td);
            tableBody.innerHTML = '';
            tableBody.appendChild(tr);
        }
    }

    /**
     * Renderiza as linhas da tabela
     */
    renderTableRows(tableBody, fornecedorList) {
        console.log(`🔧 Renderizando ${fornecedorList.length} fornecedores na tabela`);
        
        tableBody.innerHTML = '';
        
        if (!fornecedorList || fornecedorList.length === 0) {
            const tr = document.createElement('tr');
            const td = document.createElement('td');
            td.colSpan = 7;
            td.className = 'text-center';
            td.textContent = 'Nenhum fornecedor encontrado';
            tr.appendChild(td);
            tableBody.appendChild(tr);
            console.log("📝 Exibindo mensagem: nenhum fornecedor encontrado");
            return;
        }
        
        // Renderizar cada fornecedor
        fornecedorList.forEach((fornecedor, index) => {
            const fornecedorId = fornecedor.id || `temp_${index}`;
            
            const tr = document.createElement('tr');
            tr.style.borderBottom = '1px solid #e0e0e0';
            
            // Nome (primeira coluna)
            const tdNome = document.createElement('td');
            tdNome.style.padding = '12px';
            tdNome.style.verticalAlign = 'middle';
            tdNome.style.fontSize = '13px';
            tdNome.textContent = fornecedor.nome || 'Nome não informado';
            tr.appendChild(tdNome);
            
            // CNPJ (segunda coluna)
            const tdCnpj = document.createElement('td');
            tdCnpj.style.padding = '12px';
            tdCnpj.style.verticalAlign = 'middle';
            tdCnpj.style.fontSize = '13px';
            tdCnpj.textContent = fornecedor.cnpj || '';
            tr.appendChild(tdCnpj);
            
            // Cidade (terceira coluna)
            const tdCidade = document.createElement('td');
            tdCidade.style.padding = '12px';
            tdCidade.style.verticalAlign = 'middle';
            tdCidade.style.fontSize = '13px';
            tdCidade.textContent = fornecedor.cidade || '';
            tr.appendChild(tdCidade);
            
            // Estado (quarta coluna)
            const tdEstado = document.createElement('td');
            tdEstado.style.padding = '12px';
            tdEstado.style.verticalAlign = 'middle';
            tdEstado.style.fontSize = '13px';
            tdEstado.textContent = fornecedor.estado || '';
            tr.appendChild(tdEstado);
            
            // Telefone (quinta coluna)
            // Telefone (quinta coluna)
            const tdTelefone = document.createElement('td');
            tdTelefone.style.padding = '12px';
            tdTelefone.style.verticalAlign = 'middle';
            tdTelefone.style.fontSize = '13px';
            tdTelefone.textContent = fornecedor.telefone || '';
            tr.appendChild(tdTelefone);
            
            // Ações (sexta coluna)
            const tdAcoes = document.createElement('td');
            tdAcoes.style.padding = '12px';
            tdAcoes.style.verticalAlign = 'middle';
            tdAcoes.style.textAlign = 'center';
            
            // Criar container para os botões (IMPORTANTE para CSS)
            const actionContainer = document.createElement('div');
            actionContainer.className = 'action-buttons-container';
            
            // ✅ PADRONIZAÇÃO: Usar os mesmos estilos da Lista de Espécies
            const btnSelecionar = document.createElement('button');
            btnSelecionar.className = 'client-action-button btn-selecionar btn-success';
            btnSelecionar.title = 'Selecionar fornecedor';
            btnSelecionar.innerHTML = '<i class="fas fa-check"></i>';
            btnSelecionar.onclick = (e) => {
                if (e && e.stopPropagation) e.stopPropagation();
                this.selectFromList(fornecedorId);
            };
            
            const btnEditar = document.createElement('button');
            btnEditar.className = 'client-action-button btn-editar btn-warning';
            btnEditar.title = 'Editar fornecedor';
            btnEditar.innerHTML = '<i class="fas fa-edit"></i>';
            btnEditar.onclick = (e) => {
                if (e && e.stopPropagation) e.stopPropagation();
                this.editFromList(fornecedorId);
            };
            
            actionContainer.appendChild(btnSelecionar);
            actionContainer.appendChild(btnEditar);
            tdAcoes.appendChild(actionContainer);
            tr.appendChild(tdAcoes);
            
            // Hover effect
            tr.addEventListener('mouseenter', () => {
                tr.style.backgroundColor = '#f8f9fa';
            });
            tr.addEventListener('mouseleave', () => {
                tr.style.backgroundColor = '';
            });
            
            tableBody.appendChild(tr);
        });
        
        console.log(`✅ ${fornecedorList.length} fornecedores renderizados na tabela`);
    }

    // ====================================================================
    // 🎯 ACTION HANDLERS - Manipuladores de ações unificados
    // ====================================================================

    /**
     * Seleciona um fornecedor da lista (API unificada)
     */
    async selectFromList(id) {
        console.log("🔄 === SELECIONANDO FORNECEDOR ===");
        console.log("🔄 ID recebido:", id);
        
        try {
            let fornecedor = null;
            const fornecedorList = this.allFornecedores && this.allFornecedores.length
                ? this.allFornecedores
                : [...(await this.getData('fornecedores')), ...(await this.getData('clients'))].map((item, idx) => ({ ...item, id: item.id || `temp_${idx}`}));
            
            console.log(`📊 LISTA FINAL PARA SELEÇÃO: ${fornecedorList.length} fornecedores`);
            
            // ✅ BUSCAR FORNECEDOR COM ID CORRETO
            if (fornecedorList.length > 0) {
                // Busca por ID direto
                fornecedor = fornecedorList.find(f => String(f.id) === String(id));
                
                if (!fornecedor) {
                    // Busca por ID original
                    fornecedor = fornecedorList.find(f => f.originalId && String(f.originalId) === String(id));
                }
                
                if (!fornecedor) {
                    // Busca por índice (fallback para temp_X)
                    if (String(id).startsWith('temp_')) {
                        const index = parseInt(id.replace('temp_', ''));
                        if (!isNaN(index) && index >= 0 && index < fornecedorList.length) {
                            fornecedor = fornecedorList[index];
                            console.log("✅ Encontrado por índice temp:", fornecedor);
                        }
                    }
                }
            }
            
            if (fornecedor) {
                console.log("✅ Fornecedor encontrado para seleção:", fornecedor.nome || fornecedor.name);
                this.selectFornecedor(fornecedor);
            } else {
                console.error("❌ Fornecedor não encontrado com ID:", id);
                console.log("📋 IDs disponíveis:", fornecedorList.map(f => f.id));
                alert('Fornecedor não encontrado. A lista foi atualizada do Firebase.');
            }
            
        } catch (error) {
            console.error("❌ Erro ao selecionar fornecedor:", error);
            alert('Erro ao carregar dados do fornecedor. Tente novamente.');
        }
    }

    /**
     * Edita um fornecedor da lista (API unificada)
     */
    async editFromList(id) {
        console.log("🔄 === EDITANDO FORNECEDOR ===");
        console.log("🔄 ID recebido:", id);
        
        try {
            let fornecedor = null;
            const fornecedorList = this.allFornecedores && this.allFornecedores.length
                ? this.allFornecedores
                : [...(await this.getData('fornecedores')), ...(await this.getData('clients'))].map((item, idx) => ({ ...item, id: item.id || `temp_${idx}`}));
            
            // ✅ BUSCAR FORNECEDOR COM ID CORRETO
            if (fornecedorList.length > 0) {
                // Busca por ID direto
                fornecedor = fornecedorList.find(f => String(f.id) === String(id));
                
                if (!fornecedor) {
                    // Busca por ID original
                    fornecedor = fornecedorList.find(f => f.originalId && String(f.originalId) === String(id));
                }
                
                if (!fornecedor) {
                    // Busca por índice (fallback para temp_X)
                    if (String(id).startsWith('temp_')) {
                        const index = parseInt(id.replace('temp_', ''));
                        if (!isNaN(index) && index >= 0 && index < fornecedorList.length) {
                            fornecedor = fornecedorList[index];
                            console.log("✅ Encontrado por índice temp:", fornecedor);
                        }
                    }
                }
            }
            
            if (fornecedor) {
                console.log("✅ Fornecedor encontrado para edição:", fornecedor.nome || fornecedor.name);
                
                // ✅ FECHAR MODAL DE LISTA
                const listModal = document.getElementById(this.modalId);
                if (listModal) {
                    listModal.style.display = 'none';
                    console.log("✅ Modal de lista fechado");
                }
                
                // ✅ CARREGAR FORNECEDOR NO CAMPO
                const targetInput = document.getElementById('fornecedorInput') || document.getElementById('clienteInput');
                if (targetInput) {
                    targetInput.value = fornecedor.nome || fornecedor.name || '';
                    try {
                        targetInput.dispatchEvent(new Event('input', { bubbles: true }));
                        targetInput.dispatchEvent(new Event('change', { bubbles: true }));
                    } catch (_) {}
                    console.log("✅ Fornecedor carregado no campo de entrada");
                }
                
                // Definir fornecedor selecionado globalmente
                window.selectedFornecedor = fornecedor;
                window.selectedClient = fornecedor;
                
                // ✅ USAR A MESMA LÓGICA DO ÍCONE DO CAMPO
                console.log("✅ Chamando modal de edição de fornecedor...");
                if (typeof window.openEditFornecedorModal === 'function') {
                    await window.openEditFornecedorModal(fornecedor);
                } else if (typeof window.openEditClientModal === 'function') {
                    await window.openEditClientModal();
                } else {
                    console.warn("⚠️ Fallback para openEditModal");
                    this.openEditModal(fornecedor);
                }
                
            } else {
                console.error("❌ Fornecedor não encontrado com ID:", id);
                console.log("📋 IDs disponíveis:", fornecedorList.map(f => f.id));
                alert('Fornecedor não encontrado. A lista foi atualizada do Firebase.');
            }
            
        } catch (error) {
            console.error("❌ Erro ao editar fornecedor:", error);
            alert('Erro ao carregar dados do fornecedor. Tente novamente.');
        }
    }

    /**
     * Seleciona um fornecedor (preenche campo)
     */
    selectFornecedor(fornecedor) {
        console.log("🔄 Selecionando fornecedor na interface:", fornecedor.nome || fornecedor.name);
        
        window.selectedFornecedor = fornecedor;
        
        // Preencher campo de entrada
        const clientInput = document.getElementById('clienteInput');
        if (clientInput) {
            clientInput.value = fornecedor.nome || fornecedor.name || '';
            console.log("✅ Campo clienteInput preenchido");
        }
        
        // ✅ FECHAR MODAL APÓS SELEÇÃO
        const modal = document.getElementById(this.modalId);
        if (modal) {
            modal.style.display = 'none';
            console.log("✅ Modal fechado após seleção");
        }
        
        console.log("✅ Fornecedor selecionado com sucesso");
    }

    /**
     * Abre modal para novo fornecedor
     */
    openNewModal() {
        console.log("➕ Abrindo modal para novo fornecedor");
        
        // Fechar modal de lista
        const listModal = document.getElementById(this.modalId);
        if (listModal) {
            listModal.style.display = 'none';
        }
        
        // Chamar função para novo cliente se disponível
        if (typeof window.openNewClientModal === 'function') {
            // Direcionar novo cadastro para coleção 'fornecedores' se configurável
            try {
                if (window.CLIENT_MODAL_CONFIG) {
                    window.CLIENT_MODAL_CONFIG.firebaseCollection = 'fornecedores';
                    console.log("✅ CLIENT_MODAL_CONFIG.firebaseCollection = 'fornecedores'");
                }
            } catch {}
            window.openNewClientModal();
        } else {
            console.warn("⚠️ openNewClientModal não disponível");
            alert('Função para criar novo fornecedor não está disponível.');
        }
    }

    /**
     * Abre modal de edição (fallback)
     */
    openEditModal(fornecedor) {
        console.log("✏️ Abrindo modal de edição (fallback)");
        
        // Implementação básica de fallback
        if (typeof window.openClientModal === 'function') {
            window.openClientModal('edit', fornecedor);
        } else {
            console.warn("⚠️ Função de edição não disponível");
            alert('Função de edição não está disponível.');
        }
    }

    // ✅ NOVA FUNÇÃO: APLICAR FILTRO EM MEMÓRIA
    applyFilter(filter) {
        this.currentFilter = filter;
        
        const baseList = [...this.allFornecedores].filter(item => {
            if (this.viewType === 'fornecedores') return item.tipo === 'fornecedor';
            if (this.viewType === 'clientes') return item.tipo === 'cliente';
            return true; // todos
        });
        
        if (!filter || filter.trim() === '') {
            this.filteredFornecedores = baseList;
        } else {
            const searchTerm = filter.toLowerCase().trim();
            this.filteredFornecedores = baseList.filter(fornecedor =>
                (fornecedor.nome || '').toLowerCase().includes(searchTerm) ||
                (fornecedor.cnpj || '').toLowerCase().includes(searchTerm) ||
                (fornecedor.cidade || '').toLowerCase().includes(searchTerm) ||
                (fornecedor.estado || '').toLowerCase().includes(searchTerm) ||
                (fornecedor.telefone || '').toLowerCase().includes(searchTerm) ||
                (fornecedor.email || '').toLowerCase().includes(searchTerm)
            );
        }
        
        console.log(`🔍 Filtro aplicado: ${this.allFornecedores.length} -> ${this.filteredFornecedores.length} fornecedores`);
    }

    // ✅ NOVA FUNÇÃO: RENDERIZAR APENAS A TABELA FILTRADA (SEM RECARREGAR DADOS)
    renderFilteredTable() {
        console.log("🔄 Re-renderizando tabela filtrada de fornecedores...");
        
        const tableBody = document.getElementById(this.tableId);
        if (!tableBody) {
            console.error("❌ Tabela não encontrada:", this.tableId);
            return;
        }
        
        // Usar a função existente renderTableRows
        this.renderTableRows(tableBody, this.filteredFornecedores);
        
        console.log(`✅ ${this.filteredFornecedores.length} fornecedores filtrados renderizados`);
    }
}

// ====================================================================
// 🔄 COMPATIBILITY LAYER - Camada de compatibilidade
// ====================================================================

// Criar instância global
const fornecedorManager = new FornecedorManager();
window.fornecedorManager = fornecedorManager;

// ===== APIs DE COMPATIBILIDADE TOTAL =====

// 1. APIs principais (fornecedor-modals.js)
// window.openClientListModal = () => fornecedorManager.openModal('default'); // REMOVIDO - agora usa standardized-client-modal.js
// window.renderClientList = (filter) => fornecedorManager.renderList(filter, 'default'); // REMOVIDO - agora usa standardized-client-modal.js
window.selectClientFromList = (id) => fornecedorManager.selectFromList(id);
window.editClientFromList = (id) => fornecedorManager.editFromList(id);
window.selectClient = (fornecedor) => fornecedorManager.selectFornecedor(fornecedor);

// 2. APIs específicas do romaneio (romaneiotora_modais.js)
window.openFornecedorListModal = () => fornecedorManager.openModal('romaneio');
window.renderFornecedorList = (filter) => fornecedorManager.renderList(filter, 'romaneio');
window.selectFornecedorFromList = (id) => fornecedorManager.selectFromList(id);
window.editFornecedorFromList = (id) => fornecedorManager.editFromList(id);
window.selectFornecedor = (fornecedor) => fornecedorManager.selectFornecedor(fornecedor);

// 3. APIs de dados unificadas
window.getData = (key) => fornecedorManager.getData(key);
window.saveData = (key, data) => fornecedorManager.saveData(key, data);

// 4. Fallbacks (correcao-funcoes-ausentes.js)
window.renderClientListFallback = (filter) => fornecedorManager.renderList(filter, 'fallback');

console.log("✅ === FORNECEDOR MANAGER INICIALIZADO COM SUCESSO ===");
console.log("✅ Todas as APIs de compatibilidade configuradas");
console.log("✅ Conflitos entre arquivos eliminados");
console.log("✅ Sistema unificado e operacional");

// ====================================================================
// 🎨 CSS INJECTION - Estilos padronizados
// ====================================================================

// Injetar estilos CSS unificados
const style = document.createElement('style');
style.id = 'fornecedor-manager-styles';
style.textContent = `
/* Estilos unificados para o Fornecedor Manager */
.client-action-button {
    display: inline-flex !important;
    align-items: center !important;
    justify-content: center !important;
    width: 26px !important;
    height: 26px !important;
    margin-right: 5px !important;
    border: 1px solid #ccc !important;
    border-radius: 3px !important;
    background-color: #f8f9fa !important;
    color: #495057 !important;
    cursor: pointer !important;
    font-size: 12px !important;
    transition: all 0.2s ease !important;
    padding: 0 !important;
}

.client-action-button:last-child {
    margin-right: 0 !important;
}

.client-action-button:hover {
    background-color: #e9ecef !important;
    border-color: #adb5bd !important;
    transform: scale(1.05) !important;
}

.action-buttons-container {
    display: flex !important;
    align-items: center !important;
    justify-content: center !important;
    gap: 5px !important;
}

/* Estilos específicos da tabela de fornecedores */
#clientListTable {
    width: 100% !important;
    border-collapse: collapse !important;
}

#clientListTable th,
#clientListTable td {
    padding: 8px 12px !important;
    text-align: left !important;
    border-bottom: 1px solid #e0e0e0 !important;
    vertical-align: middle !important;
    font-size: 13px !important;
}

#clientListTable th {
    background-color: #2c3e50 !important;
    color: white !important;
    font-weight: 600 !important;
    position: sticky !important;
    top: 0 !important;
    z-index: 10 !important;
}

#clientListTable tr:hover {
    background-color: #f8f9fa !important;
    transition: background-color 0.2s ease !important;
}

/* Coluna de ações com largura adequada */
#clientListTable th:nth-child(6),
#clientListTable td:nth-child(6),
#clientListTable th:last-child,
#clientListTable td:last-child {
    width: 130px !important;
    min-width: 130px !important;
    text-align: center !important;
    white-space: nowrap !important;
}

/* Modal responsivo */
@media (max-width: 768px) {
    .modal-content {
        width: 95% !important;
        margin: 1% auto !important;
    }
    
    #clientListTable {
        font-size: 11px !important;
    }
    
    .client-action-button {
        width: 22px !important;
        height: 22px !important;
        font-size: 10px !important;
    }
}
`;

if (!document.getElementById('fornecedor-manager-styles')) {
    document.head.appendChild(style);
    console.log("✅ Estilos CSS unificados injetados");
}

// ====================================================================
// 🧪 DIAGNOSTIC FUNCTIONS - Funções de diagnóstico
// ====================================================================

window.diagnosticoFornecedorManager = function() {
    console.log("🔍 === DIAGNÓSTICO FORNECEDOR MANAGER ===");
    console.log("✅ FornecedorManager:", typeof fornecedorManager);
    console.log("✅ openClientListModal:", typeof window.openClientListModal);
    console.log("✅ renderClientList:", typeof window.renderClientList);
    console.log("✅ openFornecedorListModal:", typeof window.openFornecedorListModal);
    console.log("✅ renderFornecedorList:", typeof window.renderFornecedorList);
    console.log("✅ selectClientFromList:", typeof window.selectClientFromList);
    console.log("✅ editClientFromList:", typeof window.editClientFromList);
    console.log("✅ selectFornecedorFromList:", typeof window.selectFornecedorFromList);
    console.log("✅ editFornecedorFromList:", typeof window.editFornecedorFromList);
    console.log("✅ getData:", typeof window.getData);
    console.log("✅ saveData:", typeof window.saveData);
    console.log("🎯 === TODAS AS APIS DISPONÍVEIS ===");
};

// Auto-diagnóstico na inicialização
window.diagnosticoFornecedorManager();
