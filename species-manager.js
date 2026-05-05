// ========================================
// GERENCIADOR UNIFICADO DE ESPÉCIES v2.0
// ========================================
// Data: ${new Date().toISOString()}
// Propósito: Solução DEFINITIVA e UNIFICADA para gestão de espécies
// Remove dependência de correcao-funcoes-ausentes.js

console.log("🌿 === GERENCIADOR UNIFICADO DE ESPÉCIES v2.0 CARREGANDO ===");

// ========================================
// CONFIGURAÇÃO GLOBAL
// ========================================

const SPECIES_CONFIG = {
    modalId: 'speciesListModal',
    tableId: 'speciesListTable',
    inputId: 'especieInput',
    filterId: 'speciesListFilter',
    debug: true,
    sources: ['species', 'especies', 'especiesPct']
};

function getStorageKey(key) {
    try {
        const svc = window.firebaseService || window.FirebaseService;
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
        const raw = localStorage.getItem('company_info');
        if (raw) {
            const obj = JSON.parse(raw);
            const id = obj && (obj.id || obj.companyId || obj.slug || obj.nome || obj.name);
            if (id) return `company_${id}__${key}`;
        }
    } catch (_) {}
    return key;
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

// ========================================
// FUNÇÕES AUXILIARES INTEGRADAS
// ========================================

// ✅ FUNÇÃO updateTableBody (integrada do correcao-funcoes-ausentes.js)
function updateTableBody() {
    console.log("🔄 Atualizando corpo da tabela...");
    
    try {
        const tbody = document.querySelector('#romaneioTable tbody');
        if (!tbody) {
            console.warn("⚠️ Tbody não encontrado");
            return;
        }
        
        // Lógica de atualização simplificada
        const existingRows = tbody.querySelectorAll('tr');
        if (existingRows.length === 0) {
            const emptyRow = document.createElement('tr');
            emptyRow.innerHTML = '<td colspan="100%" style="text-align: center; padding: 20px; color: #666;">Nenhum item adicionado</td>';
            tbody.appendChild(emptyRow);
        }
        
        console.log("✅ Tabela atualizada com sucesso");
        
    } catch (error) {
        console.error("❌ Erro ao atualizar tabela:", error);
    }
}

function formatCurrencyInput(inputOrEvent, value) {
    try {
        let el = null;
        if (inputOrEvent && inputOrEvent.target && typeof inputOrEvent.target.value !== 'undefined') {
            el = inputOrEvent.target;
        } else if (inputOrEvent && typeof inputOrEvent.value !== 'undefined') {
            el = inputOrEvent;
        }

        let source = value;
        if (source == null) {
            if (el) source = el.value;
            else if (typeof inputOrEvent === 'string' || typeof inputOrEvent === 'number') source = inputOrEvent;
            else source = '';
        }
        const rawStr = typeof source === 'string' ? source : String(source ?? '');
        const digits = rawStr ? rawStr.replace(/\D/g, '') : '';

        if (!digits) {
            if (el) el.value = '';
            return el ? undefined : '';
        }

        const centsNumber = parseInt(digits, 10);
        if (!Number.isFinite(centsNumber)) {
            if (el) el.value = '';
            return el ? undefined : '';
        }

        const num = centsNumber / 100;
        const formatted = new Intl.NumberFormat('pt-BR', {
            style: 'currency',
            currency: 'BRL',
            minimumFractionDigits: 2,
            maximumFractionDigits: 2
        }).format(num);

        if (el) {
            el.value = formatted;
            try {
                const len = el.value.length;
                if (typeof el.setSelectionRange === 'function') {
                    el.setSelectionRange(len, len);
                }
            } catch {}
            return undefined;
        }
        return formatted;
    } catch (error) {
        try {
            if (inputOrEvent && typeof inputOrEvent.value !== 'undefined') {
                inputOrEvent.value = (inputOrEvent.value ?? '').toString();
            } else if (inputOrEvent && inputOrEvent.target && typeof inputOrEvent.target.value !== 'undefined') {
                inputOrEvent.target.value = (inputOrEvent.target.value ?? '').toString();
            }
        } catch {}
        return '';
    }
}

// ========================================
// GERENCIADOR PRINCIPAL
// ========================================

class SpeciesManager {
    constructor() {
        this.species = [];
        this.filteredSpecies = [];
        this.currentFilter = '';
        this.isLoading = false;
        this.modalCreated = false;
        
        console.log("🌿 SpeciesManager v2.0 inicializado");
        
        // Auto-carregar dados na inicialização e criar promessa global
        this.speciesLoadedPromise = this.loadSpeciesData().catch(error => {
            console.warn("⚠️ Erro no carregamento inicial:", error.message);
            return []; // Resolver com array vazio em caso de erro
        });
        window.speciesLoaded = this.speciesLoadedPromise;
    }

    // ✅ CARREGAMENTO UNIFICADO DE DADOS
    async loadSpeciesData() {
        console.log("DEBUG: Início de loadSpeciesData. window.species inicial:", window.species ? window.species.length : 'undefined');
        console.log("📊 === CARREGANDO DADOS DE ESPÉCIES ===");
        let allSpecies = [];
        
        try {
            // Configuração de tentativas
            const MAX_ATTEMPTS = 50; 
            const RETRY_INTERVAL = 200;

            // Esperar pelo Firebase estar pronto antes de tentar carregar
            let firebaseReadyAttempts = 0;
            
            while ((!window.firebaseService || (!window.firebaseService.db && !window.firebaseService.database && !(window.firebaseService.dbService && typeof window.firebaseService.dbService.getDatabase === 'function')) || typeof window.firebaseService.loadFromFirebase !== 'function') && firebaseReadyAttempts < MAX_ATTEMPTS) {
                if (firebaseReadyAttempts % 10 === 0) console.log(`⏳ Aguardando FirebaseService... Tentativa ${firebaseReadyAttempts + 1}/${MAX_ATTEMPTS}`);
                await new Promise(resolve => setTimeout(resolve, RETRY_INTERVAL));
                firebaseReadyAttempts++;
            }

            const firebaseReady = (window.firebaseService && (window.firebaseService.db || window.firebaseService.database || (window.firebaseService.dbService && typeof window.firebaseService.dbService.getDatabase === 'function')));
            if (!firebaseReady) {
                console.warn(`⚠️ FirebaseService não pronto após ${MAX_ATTEMPTS} tentativas. Usando fallback.`);
            }
            
            // 2. Tentar Firebase - verificar ambas as tabelas para resolver inconsistência
            if (firebaseReady) {
                try {
                    // Tentar usar DatabaseAdapter primeiro (melhor cache)
                    if (window.databaseAdapter && typeof window.databaseAdapter.loadData === 'function') {
                        try {
                            const result = await window.databaseAdapter.loadData('species');
                            if (result && Array.isArray(result) && result.length > 0) {
                                allSpecies = result;
                                console.log(`✅ ${allSpecies.length} espécies carregadas via DatabaseAdapter.`);
                            }
                        } catch(e) { console.warn("Erro ao carregar via adapter:", e); }
                    }

                    if (allSpecies.length === 0) {
                        console.log('🔥 Tentando carregar espécies do FirebaseService direto...');
                        // Tentar carregar de 'species' primeiro (usado pelo romaneiopct)
                        let result = await window.firebaseService.loadFromFirebase('species');
                        
                        // Se não encontrou em 'species', tentar 'especies' (usado pelo romaneiotora)
                        if (!result || !result.success || !result.data) {
                            console.log("🔥 Tentando carregar da coleção 'especies'...");
                            result = await window.firebaseService.loadFromFirebase('especies');
                        }
                        
                        if (result && result.success && result.data) {
                            const firebaseData = result.data;
                            
                            // ✅ PROCESSAMENTO CORRETO - APENAS VALORES DIRETOS
                            if (typeof firebaseData === 'object' && !Array.isArray(firebaseData)) {
                                // Se retornou um objeto (formato Firebase), converter para array
                                const firebaseSpecies = Object.keys(firebaseData).map(key => ({
                                    id: key,
                                    ...firebaseData[key]
                                }));
                                allSpecies = firebaseSpecies;
                            } else if (Array.isArray(firebaseData)) {
                                allSpecies = firebaseData;
                            }
                            
                            console.log(`✅ ${allSpecies.length} espécies carregadas do FirebaseService`);
                        }
                    }
                } catch (error) {
                    console.error('❌ Erro ao carregar espécies do Firebase:', error);
                }
            }
            
            // 3. Fallbacks (localStorage, getData global, window.species)
            if (allSpecies.length === 0) {
                console.log('ℹ️ Nenhuma espécie do Firebase. Tentando fallbacks...');
                
                // Tentar localStorage
                const sources = ['species', 'especies', 'especiesPct'];
                for (const source of sources) {
                    try {
                        const storageKey = getStorageKey(source);
                        const allowLegacy = storageKey === source;
                        const stored = localStorage.getItem(storageKey) || (allowLegacy ? localStorage.getItem(source) : null);
                        if (stored) {
                            const data = JSON.parse(stored);
                            if (Array.isArray(data) && data.length > 0) {
                                allSpecies = data;
                                console.log(`✅ Carregado de localStorage('${source}'): ${allSpecies.length} espécies`);
                                break;
                            }
                        }
                    } catch (error) {}
                }
                
                // Última tentativa: window.species existente
                if (allSpecies.length === 0 && window.species && Array.isArray(window.species) && window.species.length > 0) {
                     allSpecies = [...window.species];
                }
            }
            
            // 5. Normalizar dados
            this.species = this.normalizeSpeciesData(allSpecies);
            this.filteredSpecies = [...this.species];
            
            // 6. Disponibilizar globalmente
            window.species = this.species;
            
            // Salvar cache atualizado
            if (this.species.length > 0) {
                persistLocalValue('species_cache', this.species);
            }
            
            console.log(`📊 === DADOS CARREGADOS FINAL ===`);
            console.log(`   Total: ${this.species.length} espécies`);
            
            return this.species;
            
        } catch (error) {
            console.error("❌ Erro fatal ao carregar dados de espécies:", error);
            this.species = [];
            this.filteredSpecies = [];
            return [];
        }
    }

    // ✅ NORMALIZAÇÃO DE DADOS
    normalizeSpeciesData(rawData) {
        if (!Array.isArray(rawData)) return [];
        
        return rawData.map((specie, index) => {
            const normalized = {
                id: specie.id || specie.key || `specie_${index}`,
                nome: specie.nome || specie.name || specie.nomeComum || specie.nomeCientifico || 'Nome não informado',
                nomeComum: specie.nomeComum || specie.nome || specie.name || '',
                nomeCientifico: specie.nomeCientifico || specie.scientific || '',
                descricao: specie.descricao || specie.description || specie.desc || '',
                familia: specie.familia || specie.family || '',
                grupo: specie.grupo || specie.group || '',
                ativo: specie.ativo !== false, // default true
                createdAt: specie.createdAt || specie.created || new Date().toISOString(),
                updatedAt: specie.updatedAt || specie.updated || new Date().toISOString(),
                
                // Manter campos originais para compatibilidade
                ...specie
            };
            
            return normalized;
        });
    }

    // ✅ CRIAÇÃO DO MODAL UNIFICADO
    createModal() {
        if (this.modalCreated) {
            console.log("ℹ️ Modal já criado");
            return document.getElementById(SPECIES_CONFIG.modalId);
        }
        
        console.log("🔨 Criando modal unificado de espécies...");
        
        // Remover modais existentes para evitar conflitos
        const existingModal = document.getElementById(SPECIES_CONFIG.modalId);
        if (existingModal) {
            existingModal.remove();
        }
        
        const modal = document.createElement('div');
        modal.id = SPECIES_CONFIG.modalId;
        modal.className = 'modal';
        modal.innerHTML = `
            <div class="modal-content" style="max-width: 800px; width: 90%;">
                <div class="modal-header">
                    <h3 class="modal-title">🌿 Lista de Espécies</h3>
                    <span class="close-modal" style="cursor: pointer; font-size: 24px;">&times;</span>
                </div>
                <div class="modal-body">
                    <div style="margin-bottom: 15px;">
                        <input type="text" 
                               id="${SPECIES_CONFIG.filterId}" 
                               placeholder="🔍 Filtrar espécies por nome..." 
                               style="width: 100%; padding: 10px; border: 1px solid #ddd; border-radius: 4px; font-size: 14px;">
                    </div>
                    <div style="max-height: 400px; overflow-y: auto; border: 1px solid #ddd; border-radius: 4px;">
                        <table class="table" style="width: 100%; margin: 0; border-collapse: collapse;">
                            <thead style="background-color: #f8f9fa; position: sticky; top: 0;">
                                <tr>
                                    <th style="padding: 12px; text-align: left; border-bottom: 2px solid #dee2e6; width: 30%;">Nome</th>
                                    <th style="padding: 12px; text-align: left; border-bottom: 2px solid #dee2e6; width: 50%;">Descrição</th>
                                    <th style="padding: 12px; text-align: center; border-bottom: 2px solid #dee2e6; width: 20%;">Ações</th>
                                </tr>
                            </thead>
                            <tbody id="${SPECIES_CONFIG.tableId}">
                                <tr>
                                    <td colspan="3" style="text-align: center; padding: 20px;">
                                        🔄 Carregando espécies...
                                    </td>
                                </tr>
                            </tbody>
                        </table>
                    </div>
                </div>
                <div class="modal-footer" style="text-align: right; padding: 15px; border-top: 1px solid #ddd;">
                    <button type="button" class="btn btn-secondary back-button" style="margin-right: 10px; padding: 8px 16px; background: #6c757d; color: white; border: none; border-radius: 4px; cursor: pointer;">❌ Fechar</button>
                    <button type="button" class="btn btn-primary btn-save" style="padding: 8px 16px; background: #007bff; color: white; border: none; border-radius: 4px; cursor: pointer;">🌱 Nova Espécie</button>
                </div>
            </div>
        `;
        
        // Aplicar estilos ao modal
        modal.style.cssText = `
            position: fixed;
            top: 0;
            left: 0;
            width: 100%;
            height: 100%;
            background-color: rgba(0, 0, 0, 0.5);
            display: none;
            z-index: 10000;
            justify-content: center;
            align-items: center;
        `;
        
        document.body.appendChild(modal);
        this.setupModalEvents(modal);
        this.modalCreated = true;
        
        console.log("✅ Modal unificado criado com sucesso");
        return modal;
    }

    // ✅ CONFIGURAÇÃO DE EVENTOS DO MODAL
    setupModalEvents(modal) {
        // Fechar modal
        const closeElements = modal.querySelectorAll('.close-modal, .back-button');
        closeElements.forEach(element => {
            element.onclick = () => this.closeModal();
        });
        
        // Nova espécie
        const newSpecieBtn = modal.querySelector('.btn-save');
        if (newSpecieBtn) {
            newSpecieBtn.onclick = () => this.openNewSpeciesModal();
        }
        
        // ✅ CORREÇÃO DO FILTRO - RE-RENDERIZAR TABELA QUANDO FILTRO MUDA
        const filterInput = modal.querySelector(`#${SPECIES_CONFIG.filterId}`);
        if (filterInput) {
            // ✅ Usar addEventListener para melhor compatibilidade
            filterInput.addEventListener('input', (e) => {
                const filterValue = e.target.value;
                console.log(`🔍 Filtro de espécies aplicado: "${filterValue}"`);
                
                // Aplicar filtro E re-renderizar tabela
                this.applyFilter(filterValue);
                this.renderFilteredSpeciesTable();
            });
            
            // Tecla Escape para limpar filtro
            filterInput.addEventListener('keydown', (e) => {
                if (e.key === 'Escape') {
                    e.target.value = '';
                    this.applyFilter('');
                    this.renderFilteredSpeciesTable();
                }
            });
            
            console.log("✅ Event listeners do filtro de espécies configurados");
        } else {
            console.error("❌ Campo de filtro de espécies não encontrado");
        }
        
        // Fechar ao clicar fora
        modal.onclick = (e) => {
            if (e.target === modal) this.closeModal();
        };
    }

    // ✅ RENDERIZAÇÃO UNIFICADA
    async renderSpeciesList(filter = '') {
        console.log("🌿 === RENDERIZAÇÃO UNIFICADA DE ESPÉCIES v2.0 ===");
        console.log("🔍 Filtro:", filter);
        
        const tableBody = document.getElementById(SPECIES_CONFIG.tableId);
        if (!tableBody) {
            console.error("❌ Tabela não encontrada:", SPECIES_CONFIG.tableId);
            return;
        }
        
        this.isLoading = true;
        
        try {
            // Carregar dados se necessário
            if (this.species.length === 0) {
                await this.loadSpeciesData();
            }
            
            // Aplicar filtro
            this.applyFilter(filter);
            
            // Limpar tabela
            tableBody.innerHTML = '';
            
            // Verificar se há espécies para exibir
            if (this.filteredSpecies.length === 0) {
                const tr = document.createElement('tr');
                tr.innerHTML = `
                    <td colspan="3" style="text-align: center; padding: 20px; color: #666;">
                        ${filter ? '🔍 Nenhuma espécie encontrada para o filtro' : '📝 Nenhuma espécie cadastrada'}
                    </td>
                `;
                tableBody.appendChild(tr);
                return;
            }
            
            // Renderizar espécies
            this.filteredSpecies.forEach((specie, index) => {
                const tr = document.createElement('tr');
                tr.style.cssText = 'border-bottom: 1px solid #dee2e6; transition: background-color 0.2s; cursor: pointer;';
                tr.onmouseenter = () => tr.style.backgroundColor = '#f8f9fa';
                tr.onmouseleave = () => tr.style.backgroundColor = '';
                
                // Adicionar evento de clique na linha para selecionar automaticamente
                tr.onclick = (e) => {
                    // Verificar se o clique não foi em um botão
                    if (!e.target.classList.contains('species-action-btn')) {
                        console.log(`🌿 Linha clicada - Selecionando espécie: ${specie.nome}`);
                        this.selectSpecies(specie.id, specie.nome);
                    }
                };
                
                tr.innerHTML = `
                    <td style="padding: 12px; font-weight: 500;">${specie.nome}</td>
                    <td style="padding: 12px; color: #555;">${specie.descricao || specie.nomeCientifico || 'Sem descrição'}</td>
                    <td style="padding: 12px; text-align: center;">
                        <div style="display: flex; gap: 5px; justify-content: center;">
                            <button class="client-action-button species-action-btn species-select-btn" 
                                    data-id="${specie.id}" 
                                    data-name="${specie.nome}"
                                    title="Selecionar espécie"
                                    style="display: inline-flex; align-items: center; justify-content: center; width: 24px; height: 24px; margin: 0 1px; border: none; border-radius: 3px; cursor: pointer; background-color: #3498db; color: white; font-size: 12px; transition: all 0.2s ease;">
                                <i class="fas fa-check"></i>
                            </button>
                            <button class="client-action-button species-action-btn species-edit-btn" 
                                    data-id="${specie.id}"
                                    title="Editar espécie"
                                    style="display: inline-flex; align-items: center; justify-content: center; width: 24px; height: 24px; margin: 0 1px; border: none; border-radius: 3px; cursor: pointer; background-color: #3498db; color: white; font-size: 12px; transition: all 0.2s ease;">
                                <i class="fas fa-edit"></i>
                            </button>
                        </div>
                    </td>
                `;
                
                tableBody.appendChild(tr);
            });
            
            // Configurar eventos dos botões
            this.setupActionButtons();
            
            console.log(`✅ ${this.filteredSpecies.length} espécies renderizadas`);
            
        } catch (error) {
            console.error("❌ Erro na renderização:", error);
            tableBody.innerHTML = `
                <tr>
                    <td colspan="3" style="text-align: center; padding: 20px; color: red;">
                        ❌ Erro ao carregar espécies: ${error.message}
                    </td>
                </tr>
            `;
        } finally {
            this.isLoading = false;
        }
    }

    // ✅ CONFIGURAÇÃO DOS BOTÕES DE AÇÃO
    setupActionButtons() {
        // Botões de selecionar
        document.querySelectorAll('.species-select-btn').forEach(btn => {
            btn.onclick = (e) => {
                e.preventDefault();
                e.stopPropagation(); // Impedir que o evento se propague para a linha
                const id = btn.dataset.id;
                const name = btn.dataset.name;
                console.log(`🌿 Botão Selecionar clicado: ID="${id}", Nome="${name}"`);
                this.selectSpecies(id, name);
            };
            
            // Hover effects iguais aos fornecedores
            btn.onmouseenter = () => {
                btn.style.backgroundColor = '#2980b9';
            };
            btn.onmouseleave = () => {
                btn.style.backgroundColor = '#3498db';
            };
        });
        
        // Botões de editar
        document.querySelectorAll('.species-edit-btn').forEach(btn => {
            btn.onclick = (e) => {
                e.preventDefault();
                e.stopPropagation(); // Impedir que o evento se propague para a linha
                const id = btn.dataset.id;
                console.log(`✏️ Botão Editar clicado: ID="${id}"`);
                this.editSpecies(id);
            };
            
            // Hover effects iguais aos fornecedores
            btn.onmouseenter = () => {
                btn.style.backgroundColor = '#2980b9';
            };
            btn.onmouseleave = () => {
                btn.style.backgroundColor = '#3498db';
            };
        });
    }

    // ✅ APLICAR FILTRO
    applyFilter(filter) {
        this.currentFilter = filter;
        
        if (!filter || filter.trim() === '') {
            this.filteredSpecies = [...this.species];
        } else {
            const searchTerm = filter.toLowerCase();
            this.filteredSpecies = this.species.filter(specie => {
                return specie.nome.toLowerCase().includes(searchTerm) ||
                       specie.nomeCientifico.toLowerCase().includes(searchTerm) ||
                       specie.nomeComum.toLowerCase().includes(searchTerm) ||
                       specie.descricao.toLowerCase().includes(searchTerm);
            });
        }
        
        console.log(`🔍 Filtro aplicado: ${this.species.length} -> ${this.filteredSpecies.length} espécies`);
    }

    // ✅ NOVA FUNÇÃO: RENDERIZAR APENAS A TABELA FILTRADA (SEM RECARREGAR DADOS)
    renderFilteredSpeciesTable() {
        console.log("🔄 Re-renderizando tabela filtrada de espécies...");
        
        const tableBody = document.getElementById(SPECIES_CONFIG.tableId);
        if (!tableBody) {
            console.error("❌ Tabela não encontrada:", SPECIES_CONFIG.tableId);
            return;
        }
        
        // Limpar tabela
        tableBody.innerHTML = '';
        
        // Verificar se há espécies para exibir
        if (this.filteredSpecies.length === 0) {
            const tr = document.createElement('tr');
            tr.innerHTML = `
                <td colspan="3" style="text-align: center; padding: 20px; color: #666;">
                    ${this.currentFilter ? '🔍 Nenhuma espécie encontrada para o filtro' : '📝 Nenhuma espécie cadastrada'}
                </td>
            `;
            tableBody.appendChild(tr);
            return;
        }
        
        // Renderizar espécies filtradas
        this.filteredSpecies.forEach((specie, index) => {
            const tr = document.createElement('tr');
            tr.style.cssText = 'border-bottom: 1px solid #dee2e6; transition: background-color 0.2s; cursor: pointer;';
            tr.onmouseenter = () => tr.style.backgroundColor = '#f8f9fa';
            tr.onmouseleave = () => tr.style.backgroundColor = '';
            
            // Adicionar evento de clique na linha para selecionar automaticamente
            tr.onclick = (e) => {
                // Verificar se o clique não foi em um botão
                if (!e.target.classList.contains('species-action-btn')) {
                    console.log(`🌿 Linha clicada - Selecionando espécie: ${specie.nome}`);
                    this.selectSpecies(specie.id, specie.nome);
                }
            };
            
            tr.innerHTML = `
                <td style="padding: 12px; font-weight: 500;">${specie.nome}</td>
                <td style="padding: 12px; color: #555;">${specie.descricao || specie.nomeCientifico || 'Sem descrição'}</td>
                <td style="padding: 12px; text-align: center;">
                    <div style="display: flex; gap: 5px; justify-content: center;">
                        <button class="client-action-button species-action-btn species-select-btn" 
                                data-id="${specie.id}" 
                                data-name="${specie.nome}"
                                title="Selecionar espécie"
                                style="display: inline-flex; align-items: center; justify-content: center; width: 24px; height: 24px; margin: 0 1px; border: none; border-radius: 3px; cursor: pointer; background-color: #3498db; color: white; font-size: 12px; transition: all 0.2s ease;">
                            <i class="fas fa-check"></i>
                        </button>
                        <button class="client-action-button species-action-btn species-edit-btn" 
                                data-id="${specie.id}"
                                title="Editar espécie"
                                style="display: inline-flex; align-items: center; justify-content: center; width: 24px; height: 24px; margin: 0 1px; border: none; border-radius: 3px; cursor: pointer; background-color: #3498db; color: white; font-size: 12px; transition: all 0.2s ease;">
                            <i class="fas fa-edit"></i>
                        </button>
                    </div>
                </td>
            `;
            
            tableBody.appendChild(tr);
        });
        
        // Configurar eventos dos botões
        this.setupActionButtons();
        
        console.log(`✅ ${this.filteredSpecies.length} espécies filtradas renderizadas`);
    }

    // ✅ ABRIR MODAL
    async openModal() {
        console.log("🌿 === ABRINDO MODAL DE ESPÉCIES v2.0 ===");
        
        try {
            // Criar modal se necessário
            let modal = document.getElementById(SPECIES_CONFIG.modalId);
            if (!modal) {
                modal = this.createModal();
            }
            
            // Exibir modal
            modal.style.display = 'flex';
            
            // Carregar e renderizar dados
            await this.renderSpeciesList(this.currentFilter);
            
            // Focar no filtro
            setTimeout(() => {
                const filterInput = document.getElementById(SPECIES_CONFIG.filterId);
                if (filterInput) {
                    filterInput.focus();
                    filterInput.select();
                }
            }, 100);
            
            console.log("✅ Modal de espécies v2.0 aberto com sucesso");
            
        } catch (error) {
            console.error("❌ Erro ao abrir modal de espécies:", error);
            try {
                const msg = "Erro ao abrir lista de espécies: " + error.message;
                if (typeof window.__toast === 'function') window.__toast(msg, 'error', { duration: 5000 });
                else if (window.Utils && window.Utils.showToast) window.Utils.showToast(msg, 'error');
            } catch (_) {}
        }
    }

    // ✅ FECHAR MODAL
    closeModal() {
        const modal = document.getElementById(SPECIES_CONFIG.modalId);
        if (modal) {
            modal.style.display = 'none';
            console.log("✅ Modal de espécies fechado");
        }
    }

    // ✅ SELECIONAR ESPÉCIE
    selectSpecies(id, name) {
        console.log(`🌿 === SELECIONANDO ESPÉCIE v2.0 ===`);
        console.log(`   ID: "${id}"`);
        console.log(`   Nome: "${name}"`);
        
        try {
            // Validar parâmetros
            if (!name || name === 'undefined' || typeof name === 'undefined') {
                console.error("❌ Nome da espécie inválido");
                try {
                    const msg = "Erro: Nome da espécie não disponível. Tente recarregar a lista.";
                    if (typeof window.__toast === 'function') window.__toast(msg, 'warning');
                    else if (window.Utils && window.Utils.showToast) window.Utils.showToast(msg, 'warning');
                } catch (_) {}
                return;
            }
            
            // Buscar espécie completa
            const specie = this.species.find(s => s.id === id || String(s.id) === String(id));
            const finalName = specie ? specie.nome : name;
            
            // Atualizar campo de input
            const especieInput = document.getElementById(SPECIES_CONFIG.inputId);
            if (especieInput) {
                especieInput.value = finalName;
                
                // Disparar eventos de mudança
                especieInput.dispatchEvent(new Event('change', { bubbles: true }));
                especieInput.dispatchEvent(new Event('input', { bubbles: true }));
                
                console.log(`✅ Campo atualizado: "${finalName}"`);
            } else {
                console.error(`❌ Campo ${SPECIES_CONFIG.inputId} não encontrado`);
            }
            
            // Atualizar variável global para compatibilidade
            window.selectedSpecies = specie || { id, nome: finalName };
            
            // Fechar modal
            this.closeModal();
            
            console.log(`✅ Espécie "${finalName}" selecionada com sucesso!`);
            
        } catch (error) {
            console.error("❌ Erro ao selecionar espécie:", error);
            try {
                const msg = "Erro ao selecionar espécie: " + error.message;
                if (typeof window.__toast === 'function') window.__toast(msg, 'error', { duration: 5000 });
                else if (window.Utils && window.Utils.showToast) window.Utils.showToast(msg, 'error');
            } catch (_) {}
        }
    }

    // ✅ EDITAR ESPÉCIE
    editSpecies(id) {
        console.log(`✏️ Editando espécie v2.0: ${id}`);
        
        try {
            const specie = this.species.find(s => s.id === id);
            if (!specie) {
                try {
                    const msg = "Espécie não encontrada para edição.";
                    if (typeof window.__toast === 'function') window.__toast(msg, 'error', { duration: 5000 });
                    else if (window.Utils && window.Utils.showToast) window.Utils.showToast(msg, 'error');
                } catch (_) {}
                return;
            }
            
            // Chamar função de edição unificada
            this.openEditSpeciesModal(specie);
            
        } catch (error) {
            console.error("❌ Erro ao editar espécie:", error);
            try {
                const msg = "Erro ao editar espécie: " + error.message;
                if (typeof window.__toast === 'function') window.__toast(msg, 'error', { duration: 5000 });
                else if (window.Utils && window.Utils.showToast) window.Utils.showToast(msg, 'error');
            } catch (_) {}
        }
    }

    // ✅ MODAL DE EDIÇÃO DE ESPÉCIES (integrado)
    openEditSpeciesModal(specie) {
        console.log("🔧 openEditSpeciesModal v2.0 chamado:", specie);
        
        // Criar o modal de edição se não existir
        let modal = document.getElementById('speciesModal');
        if (!modal) {
            modal = document.createElement('div');
            modal.id = 'speciesModal';
            modal.className = 'modal';
            modal.style.cssText = `
                position: fixed;
                top: 0;
                left: 0;
                width: 100%;
                height: 100%;
                background-color: rgba(0, 0, 0, 0.5);
                display: none;
                z-index: 10001;
                justify-content: center;
                align-items: center;
            `;
            modal.innerHTML = `
                <div class="modal-content" style="background: white; padding: 20px; border-radius: 8px; max-width: 500px; width: 90%;">
                    <div class="modal-header" style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 20px;">
                        <h2 id="speciesModalTitle">Editar Espécie</h2>
                        <span class="close" onclick="document.getElementById('speciesModal').style.display='none'" style="cursor: pointer; font-size: 24px;">&times;</span>
                    </div>
                    <div class="modal-body">
                        <form id="speciesForm" onsubmit="return window.speciesManagerInstance.saveSpecies(event)">
                            <input type="hidden" id="speciesId">
                            <div class="form-group" style="margin-bottom: 15px;">
                                <label for="speciesName" style="display: block; margin-bottom: 5px; font-weight: bold;">Nome da Espécie:</label>
                                <input type="text" id="speciesName" required style="width: 100%; padding: 8px; border: 1px solid #ddd; border-radius: 4px;">
                            </div>
                            <div class="form-group" style="margin-bottom: 15px;">
                                <label for="speciesDescription" style="display: block; margin-bottom: 5px; font-weight: bold;">Descrição:</label>
                                <textarea id="speciesDescription" rows="3" style="width: 100%; padding: 8px; border: 1px solid #ddd; border-radius: 4px; resize: vertical;"></textarea>
                            </div>
                            <div class="form-actions" style="text-align: right; margin-top: 20px;">
                                <button type="button" onclick="document.getElementById('speciesModal').style.display='none'" style="margin-right: 10px; padding: 8px 16px; border: 1px solid #ddd; background: #f8f9fa; border-radius: 4px; cursor: pointer;">Cancelar</button>
                                <button type="submit" style="padding: 8px 16px; background: #007bff; color: white; border: none; border-radius: 4px; cursor: pointer;">Salvar</button>
                            </div>
                        </form>
                    </div>
                </div>
            `;
            document.body.appendChild(modal);
        }
        
        // Preencher com dados da espécie
        if (specie) {
            document.getElementById('speciesId').value = specie.id || specie.key || '';
            document.getElementById('speciesName').value = specie.nome || specie.name || '';
            document.getElementById('speciesDescription').value = specie.descricao || specie.description || '';
            document.getElementById('speciesModalTitle').textContent = 'Editar Espécie';
            window.editingSpeciesId = specie.id || specie.key;
        }
        
        // Fechar modal de lista
        const listModal = document.getElementById(SPECIES_CONFIG.modalId);
        if (listModal) listModal.style.display = 'none';
        
        // Mostrar modal de edição
        modal.style.display = 'flex';
        
        // Focar no campo nome
        setTimeout(() => {
            const nameField = document.getElementById('speciesName');
            if (nameField) nameField.focus();
        }, 100);
    }

    // ✅ SALVAR ESPÉCIE (integrado)
    async saveSpecies(event) {
        if (event) event.preventDefault();
        
        console.log("💾 Salvando espécie v2.0...");
        
        try {
            const id = document.getElementById('speciesId').value;
            const name = document.getElementById('speciesName').value;
            const description = document.getElementById('speciesDescription').value;
            
            if (!name.trim()) {
                try {
                    const msg = "Por favor, informe o nome da espécie.";
                    if (typeof window.__toast === 'function') window.__toast(msg, 'warning');
                    else if (window.Utils && window.Utils.showToast) window.Utils.showToast(msg, 'warning');
                } catch (_) {}
                return false;
            }
            
            const specieData = {
                id: id || Date.now().toString(),
                nome: name.trim(),
                name: name.trim(),
                descricao: description.trim(),
                description: description.trim(),
                nomeComum: name.trim(),
                nomeCientifico: '',
                updatedAt: new Date().toISOString()
            };
            
            // Se for nova espécie, adicionar createdAt
            if (!id) {
                specieData.createdAt = new Date().toISOString();
            }
            
            // Atualizar dados locais
            if (id && this.species.find(s => s.id === id || s.key === id)) {
                // Atualizar existente
                const index = this.species.findIndex(s => s.id === id || s.key === id);
                this.species[index] = { ...this.species[index], ...specieData };
                console.log("✅ Espécie atualizada:", specieData);
            } else {
                // Adicionar nova
                this.species.push(specieData);
                console.log("✅ Nova espécie adicionada:", specieData);
            }
            
            // Atualizar filteredSpecies
            this.filteredSpecies = [...this.species];

            // Disparar evento global para atualização de listas com throttle
            try { window.dispatchEvent(new CustomEvent('species:updated', { detail: { id: specieData.id, nome: specieData.nome } })); } catch {}
            
            // Salvar no storage
            try {
                // Atualizar window.species
                window.species = this.species;
                
                // Salvar no localStorage (apenas chave correta)
                persistLocalValue(getStorageKey('species'), this.species);
                // Remover chaves legadas se existirem para limpar lixo
                localStorage.removeItem(getStorageKey('especies'));
                localStorage.removeItem(getStorageKey('especiesPct'));
                localStorage.removeItem('especies');
                localStorage.removeItem('especiesPct');
                
                // Tentar salvar no Firebase apenas na tabela correta
                if (window.databaseAdapter && typeof window.databaseAdapter.saveData === 'function') {
                    await window.databaseAdapter.saveData('species', this.species);
                    console.log("✅ Dados salvos via databaseAdapter em species");
                } else if (window.firebaseService && typeof window.firebaseService.saveToFirebase === 'function') {
                    // Salvar apenas em species
                    await window.firebaseService.saveToFirebase('species', null, this.species);
                    console.log("✅ Dados salvos via firebaseService em species");
                }
            } catch (error) {
                console.error("❌ Erro ao salvar no storage:", error);
            }
            
            // Fechar modal
            document.getElementById('speciesModal').style.display = 'none';
            
            // Selecionar a espécie recém salva
            this.selectSpecies(specieData.id, specieData.nome);
            
            // Atualizar lista se estiver aberta
            const listModal = document.getElementById(SPECIES_CONFIG.modalId);
            if (listModal && listModal.style.display === 'flex') {
                await this.renderSpeciesList('');
            }
            
            try {
                const msg = "Espécie salva com sucesso!";
                if (typeof window.__toast === 'function') window.__toast(msg, 'success');
                else if (window.Utils && window.Utils.showToast) window.Utils.showToast(msg, 'success');
            } catch (_) {}
            
        } catch (error) {
            console.error("❌ Erro ao salvar espécie:", error);
            try {
                const msg = "Erro ao salvar espécie: " + error.message;
                if (typeof window.__toast === 'function') window.__toast(msg, 'error', { duration: 5000 });
                else if (window.Utils && window.Utils.showToast) window.Utils.showToast(msg, 'error');
            } catch (_) {}
        }
        
        return false;
    }

    // ✅ NOVA ESPÉCIE
    openNewSpeciesModal() {
        console.log("🌱 Abrindo modal de nova espécie v2.0");
        
        try {
            // Fechar modal de lista
            this.closeModal();
            
            // Abrir modal de edição sem dados (nova espécie)
            this.openEditSpeciesModal(null);
            
            // Ajustar título e limpar campos
            document.getElementById('speciesModalTitle').textContent = 'Nova Espécie';
            document.getElementById('speciesId').value = '';
            document.getElementById('speciesName').value = '';
            document.getElementById('speciesDescription').value = '';
            window.editingSpeciesId = null;
            
        } catch (error) {
            console.error("❌ Erro ao abrir nova espécie:", error);
            try {
                const msg = "Erro ao abrir cadastro de espécie: " + error.message;
                if (typeof window.__toast === 'function') window.__toast(msg, 'error', { duration: 5000 });
                else if (window.Utils && window.Utils.showToast) window.Utils.showToast(msg, 'error');
            } catch (_) {}
        }
    }
}

// ========================================
// INSTÂNCIA GLOBAL E FUNÇÕES EXPOSTAS
// ========================================

// Criar instância global
console.log("🌿 Criando instância global do SpeciesManager...");
window.speciesManagerInstance = new SpeciesManager();

// ✅ EXPOSIÇÃO DE FUNÇÕES GLOBAIS PARA COMPATIBILIDADE COM TODOS OS SISTEMAS
// Verificar se estamos no romaneiopct.html para evitar conflitos
const isPctContext = window.location.pathname.includes('romaneiopct.html') || 
                    document.title.includes('PCT') ||
                    document.querySelector('script[src*="romaneiopct"]');

console.log("🔍 Contexto detectado:", isPctContext ? "PCT" : "Outros sistemas");

// ✅ SEMPRE DEFINIR GLOBAIS - REMOVIDO BLOQUEIO DO PCT
console.log("🚫 PCT detectado - MAS EXPONDO FUNÇÕES GLOBAIS para evitar erros");
{
    // ✅ DEFINIR GLOBAIS PARA TODOS OS CONTEXTOS
    window.openSpeciesListModal = async function() {
        console.log("🌿 openSpeciesListModal v2.0 UNIFICADO chamado");
        await window.speciesManagerInstance.openModal();
    };

    window.renderSpeciesList = async function(filter = '') {
        console.log("🌿 renderSpeciesList v2.0 UNIFICADO chamado");
        await window.speciesManagerInstance.renderSpeciesList(filter);
    };

    window.selectSpeciesFromList = function(id) {
        console.log("🌿 selectSpeciesFromList v2.0 UNIFICADO chamado");
        
        const specie = window.speciesManagerInstance.species.find(s => 
            s.id === id || 
            String(s.id) === String(id) ||
            s.key === id ||
            String(s.key) === String(id)
        );
        
        if (specie) {
            window.speciesManagerInstance.selectSpecies(id, specie.nome);
        } else {
            console.error("Espécie não encontrada:", id);
            try {
                const msg = "Espécie não encontrada.";
                if (typeof window.__toast === 'function') window.__toast(msg, 'error', { duration: 5000 });
                else if (window.Utils && window.Utils.showToast) window.Utils.showToast(msg, 'error');
            } catch (_) {}
        }
    };

    window.selectSpecies = function(id, name) {
        console.log("🌿 selectSpecies v2.0 UNIFICADO chamado");
        window.speciesManagerInstance.selectSpecies(id, name);
    };

    window.editSpeciesFromList = function(id) {
        console.log("🌿 editSpeciesFromList v2.0 UNIFICADO chamado");
        window.speciesManagerInstance.editSpecies(id);
    };

    window.openNewSpeciesModal = function() {
        console.log("🌿 openNewSpeciesModal v2.0 UNIFICADO chamado");
        window.speciesManagerInstance.openNewSpeciesModal();
    };

    window.openEditSpeciesModal = function(specie) {
        console.log("🌿 openEditSpeciesModal v2.0 UNIFICADO chamado");
        window.speciesManagerInstance.openEditSpeciesModal(specie);
    };

    window.saveSpecies = function(event) {
        console.log("🌿 saveSpecies v2.0 UNIFICADO chamado");
        return window.speciesManagerInstance.saveSpecies(event);
    };
}

// ✅ FUNÇÕES AUXILIARES EXPOSTAS GLOBALMENTE
window.updateTableBody = updateTableBody;
if (typeof window.formatCurrencyInput !== 'function') { window.formatCurrencyInput = formatCurrencyInput; }

// ✅ FUNÇÃO showSpeciesSuggestions UNIFICADA (para resolver autocomplete)
window.showSpeciesSuggestions = function(input) {
    console.log("🔍 showSpeciesSuggestions v2.0 UNIFICADO chamado");
    
    const value = (input.value || '').toLowerCase();
    // Debounce interno para reduzir trabalho em digitação rápida
    try { clearTimeout(window.__speciesSuggestTimer); } catch{}
    window.__speciesSuggestTimer = setTimeout(() => {
    let suggestionsContainer = document.getElementById('especieSuggestions');
    
    if (!suggestionsContainer) {
        console.log("Container de sugestões de espécie não encontrado, criando novo");
        suggestionsContainer = document.createElement('div');
        suggestionsContainer.id = 'especieSuggestions';
        suggestionsContainer.className = 'autocomplete-suggestions';
        suggestionsContainer.style.cssText = `
            position: absolute;
            top: 100%;
            left: 0;
            right: 0;
            background: white;
            border: 1px solid #ddd;
            border-top: none;
            max-height: 200px;
            overflow-y: auto;
            z-index: 1000;
            box-shadow: 0 2px 4px rgba(0,0,0,0.1);
        `;
        input.parentNode.appendChild(suggestionsContainer);
    }
    
    // Limpar sugestões
    suggestionsContainer.innerHTML = '';
    suggestionsContainer.style.display = 'none';

    console.log("🔍 Buscando espécies com:", value);
    
    // Carregar espécies do sistema unificado e ordenar por updatedAt/createdAt
    const speciesBase = window.speciesManagerInstance ? window.speciesManagerInstance.species : (window.species || []);
    const parseTime = (s) => {
        const u = s && s.updatedAt; if (typeof u === 'number') return u; if (typeof u === 'string') { const t = Date.parse(u); if (!isNaN(t)) return t; }
        const c = s && s.createdAt; if (typeof c === 'number') return c; if (typeof c === 'string') { const t = Date.parse(c); if (!isNaN(t)) return t; }
        const idn = parseFloat(s && s.id); if (!isNaN(idn)) return idn; return 0;
    };
    const species = [...speciesBase].sort((a, b) => parseTime(b) - parseTime(a));
    
    // Se o valor estiver vazio, mostrar as 10 primeiras espécies
    if (value.length === 0) {
        if (species.length > 0) {
            species.slice(0, 10).forEach(specie => {
                const div = document.createElement('div');
                div.className = 'autocomplete-suggestion';
                div.style.cssText = `
                    padding: 10px;
                    cursor: pointer;
                    border-bottom: 1px solid #eee;
                    transition: background-color 0.2s;
                `;
                div.textContent = specie.nome || specie.name;
                div.addEventListener('click', function() {
                    // Usar a função unificada de seleção
                    window.speciesManagerInstance.selectSpecies(specie.id, specie.nome);
                    // Fechar sugestões
                    suggestionsContainer.style.display = 'none';
                });
                div.addEventListener('mouseenter', () => {
                    div.style.backgroundColor = '#f8f9fa';
                });
                div.addEventListener('mouseleave', () => {
                    div.style.backgroundColor = '';
                });
                suggestionsContainer.appendChild(div);
            });
            suggestionsContainer.style.display = 'block';
        }
        return;
    }

    // Se o valor for pequeno, verificar se queremos filtrar ainda
    if (value.length < 2) {
        console.log("Texto muito curto para filtrar, exibindo algumas espécies");
        if (species.length > 0) {
            species.slice(0, 5).forEach(specie => {
                const div = document.createElement('div');
                div.className = 'autocomplete-suggestion';
                div.style.cssText = `
                    padding: 10px;
                    cursor: pointer;
                    border-bottom: 1px solid #eee;
                    transition: background-color 0.2s;
                `;
                div.textContent = specie.nome || specie.name;
                div.addEventListener('click', function() {
                    // Usar a função unificada de seleção
                    window.speciesManagerInstance.selectSpecies(specie.id, specie.nome);
                    // Fechar sugestões
                    suggestionsContainer.style.display = 'none';
                });
                div.addEventListener('mouseenter', () => {
                    div.style.backgroundColor = '#f8f9fa';
                });
                div.addEventListener('mouseleave', () => {
                    div.style.backgroundColor = '';
                });
                suggestionsContainer.appendChild(div);
            });
            suggestionsContainer.style.display = 'block';
        }
        return;
    }

    console.log("Total de espécies:", species.length);

    const filteredSpecies = species.filter(specie => {
        const name = (specie.nome || specie.name || '').toLowerCase();
        return name.includes(value);
    });

    console.log("Espécies filtradas:", filteredSpecies.length);

    if (filteredSpecies.length === 0) {
        // Se não houver resultados, mostrar mensagem e botão para abrir modal
        const div = document.createElement('div');
        div.className = 'autocomplete-suggestion';
        div.style.cssText = `
            padding: 10px;
            font-style: italic;
            color: #999;
            text-align: center;
        `;
        div.innerHTML = `
            <div style="margin-bottom: 5px;">Nenhuma espécie encontrada</div>
            <button onclick="window.speciesManagerInstance.openModal()" style="padding: 4px 8px; background: #007bff; color: white; border: none; border-radius: 3px; cursor: pointer; font-size: 11px;">
                📋 Ver Lista Completa
            </button>
        `;
        suggestionsContainer.appendChild(div);
        suggestionsContainer.style.display = 'block';
        return;
    }

    filteredSpecies.forEach(specie => {
        const div = document.createElement('div');
        div.className = 'autocomplete-suggestion';
        div.style.cssText = `
            padding: 10px;
            cursor: pointer;
            border-bottom: 1px solid #eee;
            transition: background-color 0.2s;
        `;
        div.textContent = specie.nome || specie.name;
        div.addEventListener('click', function() {
            // Usar a função unificada de seleção
            window.speciesManagerInstance.selectSpecies(specie.id, specie.nome);
            // Fechar sugestões
            suggestionsContainer.style.display = 'none';
        });
        div.addEventListener('mouseenter', () => {
            div.style.backgroundColor = '#f8f9fa';
        });
        div.addEventListener('mouseleave', () => {
            div.style.backgroundColor = '';
        });
        suggestionsContainer.appendChild(div);
    });

    suggestionsContainer.style.display = 'block';
    }, 200);
};

// ✅ FECHAR SUGESTÕES QUANDO CLICAR FORA
document.addEventListener('click', function(e) {
    const especieSuggestions = document.getElementById('especieSuggestions');
    const especieInput = document.getElementById('especieInput');
    
    if (especieSuggestions && especieInput && 
        e.target !== especieInput && 
        !especieSuggestions.contains(e.target)) {
        especieSuggestions.style.display = 'none';
    }
});

// ========================================
// LOG FINAL
// ========================================

console.log("✅ === GERENCIADOR UNIFICADO DE ESPÉCIES v2.0 CARREGADO ===");
console.log("📋 Funções disponíveis:");
console.log("  - openSpeciesListModal() - Abrir lista de espécies");
console.log("  - renderSpeciesList(filter) - Renderizar lista");
console.log("  - selectSpeciesFromList(id) - Selecionar por ID");
console.log("  - selectSpecies(id, name) - Selecionar direto");
console.log("  - editSpeciesFromList(id) - Editar espécie");
console.log("  - openNewSpeciesModal() - Nova espécie");
console.log("  - openEditSpeciesModal(specie) - Editar modal");
console.log("  - saveSpecies(event) - Salvar espécie");
console.log("  - updateTableBody() - Atualizar tabela");
console.log("  - formatCurrencyInput() - Formatar moeda");
console.log("🌿 Instância global: window.speciesManagerInstance");
console.log("🎯 STATUS: SISTEMA UNIFICADO E LIMPO - SEM CONFLITOS");

// ========================================
// 🎨 CSS INJECTION - ESTILOS PADRONIZADOS UNIFICADOS
// ========================================

const style = document.createElement('style');
style.id = 'unified-action-buttons-styles';
style.textContent = `
/* 🎨 ESTILOS UNIFICADOS PARA BOTÕES DE AÇÃO - FORNECEDORES E ESPÉCIES */

/* Botões de ação padrão */
.client-action-button {
    display: inline-flex !important;
    align-items: center !important;
    justify-content: center !important;
    width: 24px !important;
    height: 24px !important;
    margin: 0 1px !important;
    border: none !important;
    border-radius: 3px !important;
    cursor: pointer !important;
    background-color: #3498db !important;
    color: white !important;
    font-size: 12px !important;
    transition: all 0.2s ease !important;
    padding: 0 !important;
    box-sizing: border-box !important;
}

.client-action-button:hover {
    background-color: #2980b9 !important;
}

.client-action-button i {
    font-size: 12px !important;
    width: 12px !important;
    height: 12px !important;
    display: inline-block !important;
}

/* Estilos específicos para espécies */
.species-action-btn.species-select-btn {
    background-color: #3498db !important;
    color: white !important;
}

.species-action-btn.species-select-btn:hover {
    background-color: #2980b9 !important;
}

.species-action-btn.species-edit-btn {
    background-color: #3498db !important;
    color: white !important;
}

.species-action-btn.species-edit-btn:hover {
    background-color: #2980b9 !important;
}

/* Container para os botões */
.action-buttons-container {
    display: flex !important;
    align-items: center !important;
    justify-content: center !important;
    gap: 5px !important;
}

/* Estilos para tabelas */
.table thead th {
    background-color: #2c3e50 !important;
    color: white !important;
    font-weight: 600 !important;
    position: sticky !important;
    top: 0 !important;
    z-index: 10 !important;
    padding: 12px !important;
    text-align: left !important;
    border: 1px solid #1a2942 !important;
    font-size: 13px !important;
}

.table tbody td {
    padding: 12px !important;
    text-align: left !important;
    border-bottom: 1px solid #e0e0e0 !important;
    vertical-align: middle !important;
    font-size: 13px !important;
}

.table tbody tr:hover {
    background-color: #f8f9fa !important;
    transition: background-color 0.2s ease !important;
}

/* Coluna de ações com largura fixa */
.table th:last-child,
.table td:last-child {
    width: 80px !important;
    min-width: 80px !important;
    max-width: 80px !important;
    text-align: center !important;
}

/* Responsivo */
@media (max-width: 768px) {
    .client-action-button {
        width: 20px !important;
        height: 20px !important;
        font-size: 10px !important;
    }
    
    .client-action-button i {
        font-size: 10px !important;
    }
    
    .table {
        font-size: 11px !important;
    }
    
    .table thead th,
    .table tbody td {
        padding: 8px !important;
    }
}

/* Garantir que os botões não sejam sobrescritos */
button.client-action-button {
    background-color: #3498db !important;
}

button.client-action-button:hover {
    background-color: #2980b9 !important;
}

/* Compatibilidade com diferentes frameworks */
.btn.client-action-button,
.button.client-action-button {
    background-color: #3498db !important;
    color: white !important;
    border: none !important;
}

/* Estilos para autocomplete de espécies */
.autocomplete-suggestions {
    position: absolute !important;
    top: 100% !important;
    left: 0 !important;
    right: 0 !important;
    background: white !important;
    border: 1px solid #ddd !important;
    border-top: none !important;
    max-height: 200px !important;
    overflow-y: auto !important;
    z-index: 1000 !important;
    box-shadow: 0 2px 4px rgba(0,0,0,0.1) !important;
}

.autocomplete-suggestion {
    padding: 10px !important;
    cursor: pointer !important;
    border-bottom: 1px solid #eee !important;
    transition: background-color 0.2s !important;
}

.autocomplete-suggestion:hover {
    background-color: #f8f9fa !important;
}

.autocomplete-suggestion:last-child {
    border-bottom: none !important;
}
`;

// Remover estilo existente se houver
const existingStyle = document.getElementById('unified-action-buttons-styles');
if (existingStyle) {
    existingStyle.remove();
}

// Adicionar novo estilo
document.head.appendChild(style);

console.log("🎨 === CSS UNIFICADO APLICADO - BOTÕES PADRONIZADOS ===");
