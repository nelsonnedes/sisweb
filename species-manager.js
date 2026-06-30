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
    sources: ['especies']
};

const SPECIES_LIST_MODAL_Z_INDEX = 10000030;
const SPECIES_EDIT_MODAL_Z_INDEX = 10000040;

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
            const id = obj && (obj.companyId || obj.companyID || obj.tenantId || obj.id);
            if (id) return `company_${id}__${key}`;
        }
    } catch (_) {}
    return key;
}

function getStorageKeys(key) {
    const keys = [];
    const push = (value) => {
        const item = String(value || '').trim();
        if (item && !keys.includes(item)) keys.push(item);
    };
    const primary = getStorageKey(key);
    push(primary);
    const tenantMatch = String(primary || '').match(/^company_(.+)__(.+)$/);
    if (tenantMatch && tenantMatch[1]) {
        push(`companies/${tenantMatch[1]}/${key}`);
    }
    return keys;
}

function getTenantIdFromStorageKey() {
    const match = String(getStorageKey('especies') || '').match(/^company_(.+)__especies$/);
    return match && match[1] ? String(match[1]) : '';
}

function filterSpeciesByTenant(list) {
    if (!Array.isArray(list)) return [];
    const tenantId = getTenantIdFromStorageKey();
    if (!tenantId) return list;
    return list.filter((specie) => {
        if (!specie || typeof specie !== 'object') return false;
        const itemTenant = specie.companyId || specie.companyID || specie.tenantId || specie.company_id;
        return itemTenant && String(itemTenant) === tenantId;
    });
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

function normalizeSpeciesNameKey(value) {
    if (window.SiswebSpecies && typeof window.SiswebSpecies.normalizeNameKey === 'function') {
        return window.SiswebSpecies.normalizeNameKey(value);
    }
    return String(value || '')
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, ' ')
        .replace(/\s+/g, ' ')
        .trim();
}

function getSpeciesDisplayName(specie) {
    if (window.SiswebSpecies && typeof window.SiswebSpecies.getDisplayName === 'function') {
        return window.SiswebSpecies.getDisplayName(specie);
    }
    if (!specie) return '';
    return String(specie.especie || specie.nome || specie.name || specie.nomeComum || specie.nomeCientifico || '').trim();
}

function getSpeciesScientificName(specie) {
    if (window.SiswebSpecies && typeof window.SiswebSpecies.getScientificName === 'function') {
        return window.SiswebSpecies.getScientificName(specie);
    }
    if (!specie) return '';
    return String(
        specie.nomeCientifico ||
        specie['nomeCientífico'] ||
        specie.scientificName ||
        specie.scientific ||
        specie.descricao ||
        specie.description ||
        specie.decription ||
        specie.desc ||
        ''
    ).trim();
}

function escapeSpeciesHtml(value) {
    if (window.SiswebSpecies && typeof window.SiswebSpecies.escapeHtml === 'function') {
        return window.SiswebSpecies.escapeHtml(value);
    }
    return String(value ?? '').replace(/[&<>"']/g, (char) => ({
        '&': '&amp;',
        '<': '&lt;',
        '>': '&gt;',
        '"': '&quot;',
        "'": '&#39;'
    }[char]));
}

if (!window.SiswebSpecies) {
    const speciesWriteExcludedFields = new Set([
        'key', 'firebaseKey', 'nome', 'name', 'nomeComum', 'commonName',
        'description', 'descricao', 'decription', 'desc',
        'scientificName', 'scientific', 'nomeCientífico'
    ]);
    window.SiswebSpecies = {
        canonicalCollection: 'especies',
        collectionAliases: ['especies'],
        legacyCollectionAliases: ['species', 'especiesPct', 'data/species'],
        normalizeNameKey: (value) => String(value || '')
            .normalize('NFD')
            .replace(/[\u0300-\u036f]/g, '')
            .toLowerCase()
            .replace(/[^a-z0-9]+/g, ' ')
            .replace(/\s+/g, ' ')
            .trim(),
        getDisplayName: (specie) => {
            if (!specie) return '';
            return String(specie.especie || specie.nome || specie.name || specie.nomeComum || specie.commonName || specie.nomeCientifico || '').trim();
        },
        getScientificName: (specie) => {
            if (!specie) return '';
            return String(
                specie.nomeCientifico ||
                specie['nomeCientífico'] ||
                specie.scientificName ||
                specie.scientific ||
                specie.descricao ||
                specie.description ||
                specie.decription ||
                specie.desc ||
                ''
            ).trim();
        },
        normalizeRecord: (specie, index = 0) => {
            const displayName = window.SiswebSpecies.getDisplayName(specie) || 'Nome não informado';
            const scientificName = window.SiswebSpecies.getScientificName(specie);
            return {
                ...(specie || {}),
                id: (specie && (specie.firebaseKey || specie.key || specie.id)) || `specie_${index}`,
                especie: displayName,
                nome: displayName,
                name: displayName,
                nomeComum: (specie && (specie.nomeComum || specie.nome || specie.name)) || displayName,
                nomeCientifico: scientificName,
                scientific: scientificName,
                scientificName: scientificName
            };
        },
        toCanonicalRecord: (specie, index = 0, options = {}) => {
            const source = specie && typeof specie === 'object' ? specie : {};
            const displayName = window.SiswebSpecies.getDisplayName(source) || '';
            const scientificName = window.SiswebSpecies.getScientificName(source);
            const id = options.id || source.firebaseKey || source.key || source.id || `specie_${index}`;
            const now = options.now || new Date().toISOString();
            const out = {};
            Object.keys(source).forEach((key) => {
                if (key.startsWith('__') || speciesWriteExcludedFields.has(key)) return;
                if (source[key] !== undefined) out[key] = source[key];
            });
            out.id = id;
            out.especie = displayName;
            out.nomeCientifico = scientificName;
            out.ativo = source.ativo !== false;
            out.createdAt = source.createdAt || source.created || now;
            out.updatedAt = options.updatedAt || source.updatedAt || source.updated || now;
            return out;
        },
        normalizeList: (rawData) => {
            const list = Array.isArray(rawData)
                ? rawData.map((item, index) => {
                    const value = item && typeof item === 'object' ? item : {};
                    const key = String(index);
                    return {
                        ...value,
                        id: key,
                        key,
                        firebaseKey: key,
                        originalId: value.id || value.key || key
                    };
                })
                : Object.keys(rawData || {}).map((key) => {
                    const value = rawData[key] && typeof rawData[key] === 'object' ? rawData[key] : {};
                    return {
                        ...value,
                        id: key,
                        key,
                        firebaseKey: key,
                        originalId: value.id || value.key || key
                    };
                });
            const seen = new Set();
            const parseRecordTime = (item) => {
                const updated = item && item.updatedAt;
                if (typeof updated === 'number') return updated;
                if (typeof updated === 'string') {
                    const parsed = Date.parse(updated);
                    if (!Number.isNaN(parsed)) return parsed;
                }
                const created = item && item.createdAt;
                if (typeof created === 'number') return created;
                if (typeof created === 'string') {
                    const parsed = Date.parse(created);
                    if (!Number.isNaN(parsed)) return parsed;
                }
                const numericId = parseFloat((item && (item.originalId || item.id)) || '');
                const keyedRecordBias = item && String(item.id || '') === String(item.originalId || '') ? 0.5 : 0;
                return Number.isNaN(numericId) ? keyedRecordBias : numericId + keyedRecordBias;
            };
            return list
                .map((item, index) => window.SiswebSpecies.normalizeRecord(item, index))
                .sort((a, b) => parseRecordTime(b) - parseRecordTime(a))
                .filter((item) => {
                    const key = window.SiswebSpecies.normalizeNameKey(window.SiswebSpecies.getDisplayName(item));
                    const id = String(item.firebaseKey || item.key || item.id || item.originalId || '');
                    const dedupeKey = key || id;
                    if (!dedupeKey || seen.has(dedupeKey)) return false;
                    seen.add(dedupeKey);
                    return true;
                });
        },
        escapeHtml: (value) => String(value ?? '').replace(/[&<>"']/g, (char) => ({
            '&': '&amp;',
            '<': '&lt;',
            '>': '&gt;',
            '"': '&quot;',
            "'": '&#39;'
        }[char]))
    };
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
        this.lastLoadFailed = false;
        
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
        this.lastLoadFailed = false;
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
                            const result = await window.databaseAdapter.loadData('especies');
                            if (result && Array.isArray(result) && result.length > 0) {
                                allSpecies = result;
                                console.log(`✅ ${allSpecies.length} espécies carregadas via DatabaseAdapter.`);
                            }
                        } catch(e) { console.warn("Erro ao carregar via adapter:", e); }
                    }

                    if (allSpecies.length === 0) {
                        console.log('🔥 Tentando carregar espécies do FirebaseService direto...');
                        let result = await window.firebaseService.loadFromFirebase('especies');
                        
                        if (result && result.success && result.data) {
                            const firebaseData = result.data;
                            
                            // ✅ PROCESSAMENTO CORRETO - APENAS VALORES DIRETOS
                            if (typeof firebaseData === 'object' && !Array.isArray(firebaseData)) {
                                // Se retornou um objeto (formato Firebase), converter para array
                                const firebaseSpecies = Object.keys(firebaseData).map(key => {
                                    const item = firebaseData[key] || {};
                                    return {
                                        ...item,
                                        id: key,
                                        key,
                                        firebaseKey: key,
                                        originalId: item.id || item.key || key
                                    };
                                });
                                allSpecies = firebaseSpecies;
                            } else if (Array.isArray(firebaseData)) {
                                allSpecies = firebaseData.map((item, index) => {
                                    const value = item && typeof item === 'object' ? item : {};
                                    const key = String(index);
                                    return {
                                        ...value,
                                        id: key,
                                        key,
                                        firebaseKey: key,
                                        originalId: value.id || value.key || key
                                    };
                                });
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
                const sources = ['especies', 'especies_cache'];
                for (const source of sources) {
                    try {
                        const storageKeys = getStorageKeys(source);
                        let stored = null;
                        for (const storageKey of storageKeys) {
                            stored = localStorage.getItem(storageKey);
                            if (stored) break;
                        }
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
                     allSpecies = filterSpeciesByTenant(window.species);
                }
            }
            
            // 5. Normalizar dados
            this.species = this.normalizeSpeciesData(allSpecies);
            this.filteredSpecies = [...this.species];
            
            // 6. Disponibilizar globalmente
            window.species = this.species;
            
            // Salvar cache atualizado
            if (this.species.length > 0) {
                persistLocalValue(getStorageKey('especies_cache'), this.species);
            }
            
            console.log(`📊 === DADOS CARREGADOS FINAL ===`);
            console.log(`   Total: ${this.species.length} espécies`);
            
            return this.species;
            
        } catch (error) {
            console.error("❌ Erro fatal ao carregar dados de espécies:", error);
            this.lastLoadFailed = true;
            this.species = [];
            this.filteredSpecies = [];
            return [];
        }
    }

    // ✅ NORMALIZAÇÃO DE DADOS
    normalizeSpeciesData(rawData) {
        if (!Array.isArray(rawData)) return [];
        if (window.SiswebSpecies && typeof window.SiswebSpecies.normalizeList === 'function') {
            return window.SiswebSpecies.normalizeList(rawData);
        }
        
        return rawData.map((specie, index) => {
            const source = specie && (specie.firebaseKey || specie.key)
                ? specie
                : {
                    ...(specie || {}),
                    id: String(index),
                    key: String(index),
                    firebaseKey: String(index),
                    originalId: (specie && (specie.id || specie.key)) || String(index)
                };
            const displayName = getSpeciesDisplayName(source) || 'Nome não informado';
            const scientificName = getSpeciesScientificName(source);
            const normalized = {
                // Manter campos originais para compatibilidade
                ...source,
                id: source.firebaseKey || source.key || source.id || `specie_${index}`,
                nome: displayName,
                name: displayName,
                nomeComum: source.nomeComum || source.nome || source.name || displayName,
                nomeCientifico: scientificName,
                scientific: scientificName,
                scientificName: scientificName,
                familia: source.familia || source.family || '',
                grupo: source.grupo || source.group || '',
                ativo: source.ativo !== false, // default true
                createdAt: source.createdAt || source.created || new Date().toISOString(),
                updatedAt: source.updatedAt || source.updated || new Date().toISOString()
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
            <div class="modal-content species-list-modal-content">
                <div class="modal-header">
                    <h3 class="modal-title">🌳 Lista de Espécies</h3>
                    <span class="close-modal" style="cursor: pointer; font-size: 24px;">&times;</span>
                </div>
                <div class="modal-body">
                    <div style="margin-bottom: 15px;">
                        <input type="text" 
                               id="${SPECIES_CONFIG.filterId}" 
                               placeholder="Filtrar por nome ou nome científico..."
                               class="species-list-filter-input">
                    </div>
                    <div class="table-container species-list-table-container">
                        <table class="table">
                            <thead>
                                <tr>
                                    <th>Nome</th>
                                    <th>Nome Científico</th>
                                    <th>Ações</th>
                                </tr>
                            </thead>
                            <tbody id="${SPECIES_CONFIG.tableId}">
                                <tr>
                                    <td colspan="3" style="text-align: center; padding: 20px;">
                                        Carregando espécies...
                                    </td>
                                </tr>
                            </tbody>
                        </table>
                    </div>
                </div>
                <div class="modal-footer" style="text-align: right; padding: 15px; border-top: 1px solid #ddd;">
                    <button type="button" class="btn btn-secondary back-button" style="margin-right: 10px; padding: 8px 16px; background: #6c757d; color: white; border: none; border-radius: 4px; cursor: pointer;">Fechar</button>
                    <button type="button" class="btn btn-primary btn-save" style="padding: 8px 16px; background: #007bff; color: white; border: none; border-radius: 4px; cursor: pointer;">Nova Espécie</button>
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
            z-index: ${SPECIES_LIST_MODAL_Z_INDEX};
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
                        ${filter ? 'Nenhuma espécie encontrada para o filtro' : 'Nenhuma espécie cadastrada'}
                    </td>
                `;
                tableBody.appendChild(tr);
                return;
            }
            
            // Renderizar espécies
            this.filteredSpecies.forEach((specie, index) => {
                const speciesName = getSpeciesDisplayName(specie);
                const scientificName = getSpeciesScientificName(specie) || '-';
                const tr = document.createElement('tr');
                tr.style.cssText = 'border-bottom: 1px solid #dee2e6; transition: background-color 0.2s; cursor: pointer;';
                tr.onmouseenter = () => tr.style.backgroundColor = '#f8f9fa';
                tr.onmouseleave = () => tr.style.backgroundColor = '';
                
                // Adicionar evento de clique na linha para selecionar automaticamente
                tr.onclick = (e) => {
                    // Verificar se o clique não foi em um botão
                    if (!e.target.classList.contains('species-action-btn')) {
                        console.log(`🌿 Linha clicada - Selecionando espécie: ${speciesName}`);
                        this.selectSpecies(specie.id, speciesName);
                    }
                };
                
                tr.innerHTML = `
                    <td style="padding: 12px; font-weight: 500;">${escapeSpeciesHtml(speciesName)}</td>
                    <td style="padding: 12px; color: #555;">${escapeSpeciesHtml(scientificName)}</td>
                    <td style="padding: 12px; text-align: center;">
                        <div style="display: flex; gap: 5px; justify-content: center;">
                            <button class="client-action-button species-action-btn species-select-btn" 
                                    data-id="${specie.id}" 
                                    data-name="${escapeSpeciesHtml(speciesName)}"
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
            const searchTerm = normalizeSpeciesNameKey(filter);
            this.filteredSpecies = this.species.filter(specie => {
                const searchable = [
                    getSpeciesDisplayName(specie),
                    getSpeciesScientificName(specie),
                    specie.nomeComum,
                    specie.especie
                ].map(normalizeSpeciesNameKey).join(' ');
                return searchable.includes(searchTerm);
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
                    ${this.currentFilter ? 'Nenhuma espécie encontrada para o filtro' : 'Nenhuma espécie cadastrada'}
                </td>
            `;
            tableBody.appendChild(tr);
            return;
        }
        
        // Renderizar espécies filtradas
        this.filteredSpecies.forEach((specie, index) => {
            const speciesName = getSpeciesDisplayName(specie);
            const scientificName = getSpeciesScientificName(specie) || '-';
            const tr = document.createElement('tr');
            tr.style.cssText = 'border-bottom: 1px solid #dee2e6; transition: background-color 0.2s; cursor: pointer;';
            tr.onmouseenter = () => tr.style.backgroundColor = '#f8f9fa';
            tr.onmouseleave = () => tr.style.backgroundColor = '';
            
            // Adicionar evento de clique na linha para selecionar automaticamente
            tr.onclick = (e) => {
                // Verificar se o clique não foi em um botão
                if (!e.target.classList.contains('species-action-btn')) {
                    console.log(`🌿 Linha clicada - Selecionando espécie: ${speciesName}`);
                    this.selectSpecies(specie.id, speciesName);
                }
            };
            
            tr.innerHTML = `
                <td style="padding: 12px; font-weight: 500;">${escapeSpeciesHtml(speciesName)}</td>
                <td style="padding: 12px; color: #555;">${escapeSpeciesHtml(scientificName)}</td>
                <td style="padding: 12px; text-align: center;">
                    <div style="display: flex; gap: 5px; justify-content: center;">
                        <button class="client-action-button species-action-btn species-select-btn" 
                                data-id="${specie.id}" 
                                data-name="${escapeSpeciesHtml(speciesName)}"
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
    selectSpecies(id, name, targetInput = null) {
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
            const matchesSpeciesId = (species, targetId) => {
                const normalizedTargetId = String(targetId || '').trim();
                return Boolean(normalizedTargetId && [species && species.id, species && species.key, species && species.firebaseKey, species && species.originalId]
                    .map(value => String(value || '').trim())
                    .filter(Boolean)
                    .includes(normalizedTargetId));
            };
            const specie = this.species.find(s =>
                matchesSpeciesId(s, id)
            );
            const finalName = specie ? getSpeciesDisplayName(specie) : name;
            
            // Atualizar campo de input
            window.__speciesSuppressSuggestionsUntil = Date.now() + 300;
            const especieInput = getSpeciesAutocompleteInput(targetInput);
            if (especieInput) {
                especieInput.value = finalName;
                if (typeof window.setActiveSpeciesAutocompleteInput === 'function') {
                    window.setActiveSpeciesAutocompleteInput(especieInput);
                }

                if (especieInput.id === 'speciesName') {
                    const scientificField = document.getElementById('speciesDescription');
                    const scientificName = getSpeciesScientificName(specie);
                    if (scientificField && scientificName) {
                        scientificField.value = scientificName;
                    }
                    this.updateSpeciesNameDuplicateHint();
                }
                
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
            const matchesSpeciesId = (species, targetId) => {
                const normalizedTargetId = String(targetId || '').trim();
                return Boolean(normalizedTargetId && [species && species.id, species && species.key, species && species.firebaseKey, species && species.originalId]
                    .map(value => String(value || '').trim())
                    .filter(Boolean)
                    .includes(normalizedTargetId));
            };
            const specie = this.species.find(s =>
                matchesSpeciesId(s, id)
            );
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
            modal.className = 'modal species-standard-modal';
            modal.setAttribute('aria-hidden', 'true');
            modal.style.cssText = `
                position: fixed;
                top: 0;
                left: 0;
                width: 100%;
                height: 100%;
                background-color: rgba(0, 0, 0, 0.5);
                display: none;
                z-index: ${SPECIES_EDIT_MODAL_Z_INDEX};
                justify-content: center;
                align-items: center;
            `;
            modal.innerHTML = `
                <div class="modal-content species-standard-modal-content">
                    <div class="modal-header species-standard-header">
                        <h2 id="speciesModalTitle" class="modal-title species-standard-title">Editar Espécie</h2>
                        <button type="button" class="close species-standard-close" onclick="document.getElementById('speciesModal').style.display='none'" aria-label="Fechar modal">&times;</button>
                    </div>
                    <div class="modal-body">
                        <form id="speciesForm" class="species-standard-form" onsubmit="return window.speciesManagerInstance.saveSpecies(event)">
                            <input type="hidden" id="speciesId">
                            <div class="form-group species-standard-field">
                                <label for="speciesName" class="species-standard-label">Nome da Espécie:</label>
                                <input type="text"
                                       id="speciesName"
                                       class="species-standard-input autocomplete-input"
                                       data-species-autocomplete="true"
                                       data-species-layout="reserved"
                                       data-species-reserve="speciesNameSuggestionsReserve"
                                       autocomplete="off"
                                       aria-autocomplete="list"
                                       aria-expanded="false"
                                       aria-controls="especieSuggestions"
                                       role="combobox"
                                       required>
                                <div id="speciesNameSuggestionsReserve" class="species-suggestions-reserve species-name-suggestions-reserve" aria-hidden="true"></div>
                                <div id="speciesNameDuplicateHint" class="species-duplicate-hint" aria-live="polite"></div>
                            </div>
                            <div class="form-group species-standard-field">
                                <label for="speciesDescription" class="species-standard-label">Nome Científico:</label>
                                <textarea id="speciesDescription"
                                          class="species-standard-textarea"
                                          rows="3"
                                          placeholder="Ex.: Handroanthus albus"></textarea>
                            </div>
                            <div class="form-actions species-standard-actions">
                                <button type="button" class="btn btn-secondary back-button" onclick="document.getElementById('speciesModal').style.display='none'">Cancelar</button>
                                <button type="submit" id="saveSpeciesBtn" class="btn btn-primary btn-save">Atualizar Espécie</button>
                            </div>
                        </form>
                    </div>
                </div>
            `;
            document.body.appendChild(modal);
        }

        const currentTarget = getSpeciesAutocompleteInput();
        if (currentTarget && currentTarget.id && currentTarget.id !== 'speciesName') {
            this.speciesModalReturnInputId = currentTarget.id;
        }
        
        // Preencher com dados da espécie
        if (specie) {
            const speciesRecordId = specie.firebaseKey || specie.key || specie.id || specie.originalId || '';
            document.getElementById('speciesId').value = speciesRecordId;
            document.getElementById('speciesName').value = getSpeciesDisplayName(specie);
            document.getElementById('speciesDescription').value = getSpeciesScientificName(specie);
            document.getElementById('speciesModalTitle').textContent = 'Editar Espécie';
            const saveButton = document.getElementById('saveSpeciesBtn') || document.querySelector('#speciesModal button[type="submit"], #speciesModal .btn-save');
            if (saveButton) saveButton.textContent = 'Atualizar Espécie';
            window.editingSpeciesId = speciesRecordId;
        } else {
            document.getElementById('speciesId').value = '';
            document.getElementById('speciesName').value = '';
            document.getElementById('speciesDescription').value = '';
            document.getElementById('speciesModalTitle').textContent = 'Nova Espécie';
            const saveButton = document.getElementById('saveSpeciesBtn') || document.querySelector('#speciesModal button[type="submit"], #speciesModal .btn-save');
            if (saveButton) saveButton.textContent = 'Salvar Espécie';
            window.editingSpeciesId = null;
        }
        
        // Fechar modal de lista
        const listModal = document.getElementById(SPECIES_CONFIG.modalId);
        if (listModal) listModal.style.display = 'none';
        
        if (window.SiswebSpeciesModal && typeof window.SiswebSpeciesModal.enhance === 'function') {
            window.SiswebSpeciesModal.enhance({ modal });
        }
        modal.querySelectorAll('.close-modal, .close, .close-modal-btn, .back-button').forEach((button) => {
            if (button.__speciesManagerCloseBound) return;
            button.addEventListener('click', () => {
                if (window.SiswebSpeciesModal && typeof window.SiswebSpeciesModal.hideModal === 'function') {
                    window.SiswebSpeciesModal.hideModal(modal);
                } else {
                    modal.style.display = 'none';
                    modal.setAttribute('aria-hidden', 'true');
                }
            });
            button.__speciesManagerCloseBound = true;
        });

        // Mostrar modal de edição
        if (window.SiswebSpeciesModal && typeof window.SiswebSpeciesModal.showModal === 'function') {
            window.SiswebSpeciesModal.showModal(modal);
        } else {
            modal.style.display = 'flex';
            modal.setAttribute('aria-hidden', 'false');
        }
        this.setupSpeciesNameAutocomplete();
        this.updateSpeciesNameDuplicateHint();

        if (this.species.length === 0) {
            const reloadPromise = this.speciesLoadedPromise || this.loadSpeciesData();
            reloadPromise.then(() => {
                const nameField = document.getElementById('speciesName');
                if (document.activeElement === nameField && typeof window.showSpeciesSuggestions === 'function') {
                    window.showSpeciesSuggestions(nameField);
                }
                this.updateSpeciesNameDuplicateHint();
            }).catch(() => {});
        }
        
        // Focar no campo nome
        setTimeout(() => {
            const nameField = document.getElementById('speciesName');
            if (nameField) nameField.focus();
        }, 100);
    }

    setupSpeciesNameAutocomplete() {
        const nameField = document.getElementById('speciesName');
        if (!nameField || nameField.__speciesNameAutocompleteBound) return;

        const openSuggestions = () => {
            if (typeof window.setActiveSpeciesAutocompleteInput === 'function') {
                window.setActiveSpeciesAutocompleteInput(nameField);
            } else if (nameField.id) {
                window.__activeSpeciesAutocompleteInputId = nameField.id;
            }
            if (typeof window.showSpeciesSuggestions === 'function') {
                window.showSpeciesSuggestions(nameField);
            }
            this.updateSpeciesNameDuplicateHint();
        };

        nameField.addEventListener('focus', openSuggestions);
        nameField.addEventListener('input', openSuggestions);
        nameField.addEventListener('change', () => this.updateSpeciesNameDuplicateHint());
        nameField.addEventListener('blur', () => {
            setTimeout(() => {
                const reserve = document.getElementById('speciesNameSuggestionsReserve');
                const suggestions = document.getElementById('especieSuggestions');
                const active = document.activeElement;
                if (active === nameField) return;
                if (reserve && reserve.contains(active)) return;
                if (suggestions && suggestions.contains(active)) return;
                if (typeof window.hideSpeciesSuggestions === 'function') {
                    window.hideSpeciesSuggestions(nameField);
                }
            }, 160);
        });

        nameField.__speciesNameAutocompleteBound = true;
    }

    updateSpeciesNameDuplicateHint() {
        const nameField = document.getElementById('speciesName');
        const idField = document.getElementById('speciesId');
        const hint = document.getElementById('speciesNameDuplicateHint');
        if (!nameField || !hint) return null;

        const value = nameField.value || '';
        const normalizedName = normalizeSpeciesNameKey(value);
        const currentId = idField ? String(idField.value || '').trim() : '';
        if (!normalizedName) {
            hint.textContent = '';
            hint.classList.remove('is-visible');
            return null;
        }

        const duplicate = this.species.find((s) => {
            const sameName = normalizeSpeciesNameKey(getSpeciesDisplayName(s)) === normalizedName;
            const specieIds = [s && s.id, s && s.key, s && s.firebaseKey, s && s.originalId]
                .map(value => String(value || '').trim())
                .filter(Boolean);
            return sameName && (!currentId || !specieIds.includes(currentId));
        });

        if (duplicate) {
            const duplicateName = getSpeciesDisplayName(duplicate);
            hint.textContent = `Espécie já cadastrada: ${duplicateName}. Selecione a opção existente para evitar duplicidade.`;
            hint.classList.add('is-visible');
            return duplicate;
        }

        hint.textContent = '';
        hint.classList.remove('is-visible');
        return null;
    }

    // ✅ SALVAR ESPÉCIE (integrado)
    async saveSpecies(event) {
        if (event) event.preventDefault();
        
        console.log("💾 Salvando espécie v2.0...");
        
        try {
            const id = String(document.getElementById('speciesId').value || '').trim();
            const name = document.getElementById('speciesName').value;
            const scientificName = document.getElementById('speciesDescription').value;
            const matchesSpeciesId = (species, targetId) => {
                const normalizedTargetId = String(targetId || '').trim();
                if (!normalizedTargetId) return false;
                return [species && species.id, species && species.key, species && species.firebaseKey, species && species.originalId]
                    .map(value => String(value || '').trim())
                    .filter(Boolean)
                    .includes(normalizedTargetId);
            };
            
            if (!name.trim()) {
                try {
                    const msg = "Por favor, informe o nome da espécie.";
                    if (typeof window.__toast === 'function') window.__toast(msg, 'warning');
                    else if (window.Utils && window.Utils.showToast) window.Utils.showToast(msg, 'warning');
                } catch (_) {}
                return false;
            }

            const normalizedName = normalizeSpeciesNameKey(name);
            const duplicate = this.species.find((s) => {
                const sameName = normalizeSpeciesNameKey(getSpeciesDisplayName(s)) === normalizedName;
                const sameId = matchesSpeciesId(s, id);
                return sameName && !sameId;
            });

            if (duplicate) {
                const duplicateName = getSpeciesDisplayName(duplicate);
                try {
                    const msg = `A espécie "${duplicateName}" já existe no cadastro. Usando o cadastro existente para evitar duplicidade.`;
                    if (typeof window.__toast === 'function') window.__toast(msg, 'warning', { duration: 5000 });
                    else if (window.Utils && window.Utils.showToast) window.Utils.showToast(msg, 'warning');
                    else alert(msg);
                } catch (_) {}

                if (!id) {
                    const duplicateModal = document.getElementById('speciesModal');
                    if (window.SiswebSpeciesModal && typeof window.SiswebSpeciesModal.hideModal === 'function') {
                        window.SiswebSpeciesModal.hideModal(duplicateModal);
                    } else if (duplicateModal) {
                        duplicateModal.style.display = 'none';
                        duplicateModal.setAttribute('aria-hidden', 'true');
                    }
                    this.selectSpecies(duplicate.id || duplicate.key, duplicateName, this.speciesModalReturnInputId || null);
                }
                return false;
            }
            
            const specieData = (window.SiswebSpecies && typeof window.SiswebSpecies.toCanonicalRecord === 'function')
                ? window.SiswebSpecies.toCanonicalRecord({
                    id: id || Date.now().toString(),
                    especie: name.trim(),
                    nomeCientifico: scientificName.trim()
                }, 0, { updatedAt: new Date().toISOString() })
                : {
                    id: id || Date.now().toString(),
                    especie: name.trim(),
                    nomeCientifico: scientificName.trim(),
                    ativo: true,
                    updatedAt: new Date().toISOString()
                };
            
            // Se for nova espécie, adicionar createdAt
            if (!id) {
                specieData.createdAt = new Date().toISOString();
            }
            
            // Atualizar dados locais
            let savedRecord = specieData;
            const existingIndex = id ? this.species.findIndex(s => matchesSpeciesId(s, id)) : -1;
            if (existingIndex >= 0) {
                // Atualizar existente
                this.species[existingIndex] = { ...this.species[existingIndex], ...specieData, id };
                savedRecord = this.species[existingIndex];
                console.log("✅ Espécie atualizada:", specieData);
            } else {
                savedRecord = id ? { ...specieData, id } : specieData;
                this.species.push(savedRecord);
                console.log("✅ Nova espécie adicionada:", specieData);
            }
            
            // Atualizar filteredSpecies
            this.filteredSpecies = [...this.species];

            // Disparar evento global para atualização de listas com throttle
            try { window.dispatchEvent(new CustomEvent('species:updated', { detail: { id: specieData.id, nome: getSpeciesDisplayName(specieData) } })); } catch {}
            
            // Salvar no storage
            try {
                // Atualizar window.species
                window.species = this.species;
                
                const canonicalSpecies = this.species.map((specie, index) => (
                    window.SiswebSpecies && typeof window.SiswebSpecies.toCanonicalRecord === 'function'
                        ? window.SiswebSpecies.toCanonicalRecord(specie, index)
                        : specie
                ));

                // Salvar no localStorage (apenas chave canônica)
                const canonicalStorageKey = getStorageKey('especies');
                persistLocalValue(canonicalStorageKey, canonicalSpecies);
                // Remover chaves legadas se existirem para limpar lixo
                localStorage.removeItem(getStorageKey('species'));
                localStorage.removeItem(getStorageKey('especiesPct'));
                localStorage.removeItem(getStorageKey('data/species'));
                localStorage.removeItem('species');
                localStorage.removeItem('especiesPct');
                localStorage.removeItem('data/species');
                if (canonicalStorageKey !== 'especies') {
                    localStorage.removeItem('especies');
                }
                
                const canonicalRecord = window.SiswebSpecies && typeof window.SiswebSpecies.toCanonicalRecord === 'function'
                    ? window.SiswebSpecies.toCanonicalRecord(savedRecord, 0, { id: savedRecord.id || specieData.id, updatedAt: new Date().toISOString() })
                    : savedRecord;

                // Tentar salvar no Firebase apenas no registro correto em especies/{id}
                if (window.firebaseService && typeof window.firebaseService.saveToFirebase === 'function') {
                    await window.firebaseService.saveToFirebase('especies', canonicalRecord.id, canonicalRecord);
                    console.log(`✅ Espécie salva via firebaseService em especies/${canonicalRecord.id}`);
                } else if (window.firebaseService && typeof window.firebaseService.saveData === 'function') {
                    await window.firebaseService.saveData(`especies/${canonicalRecord.id}`, canonicalRecord);
                    console.log(`✅ Espécie salva via firebaseService.saveData em especies/${canonicalRecord.id}`);
                } else if (window.databaseAdapter && typeof window.databaseAdapter.saveData === 'function') {
                    await window.databaseAdapter.saveData(`especies/${canonicalRecord.id}`, canonicalRecord);
                    console.log(`✅ Espécie salva via databaseAdapter em especies/${canonicalRecord.id}`);
                }
            } catch (error) {
                console.error("❌ Erro ao salvar no storage:", error);
                throw error;
            }
            
            // Fechar modal
            const speciesModal = document.getElementById('speciesModal');
            if (window.SiswebSpeciesModal && typeof window.SiswebSpeciesModal.hideModal === 'function') {
                window.SiswebSpeciesModal.hideModal(speciesModal);
            } else if (speciesModal) {
                speciesModal.style.display = 'none';
                speciesModal.setAttribute('aria-hidden', 'true');
            }
            
            // Selecionar a espécie recém salva
            this.selectSpecies(specieData.id, getSpeciesDisplayName(specieData), this.speciesModalReturnInputId || null);
            
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
            const saveButton = document.getElementById('saveSpeciesBtn') || document.querySelector('#speciesModal button[type="submit"], #speciesModal .btn-save');
            if (saveButton) saveButton.textContent = 'Salvar Espécie';
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
        
        const matchesSpeciesId = (species, targetId) => {
            const normalizedTargetId = String(targetId || '').trim();
            return Boolean(normalizedTargetId && [species && species.id, species && species.key, species && species.firebaseKey, species && species.originalId]
                .map(value => String(value || '').trim())
                .filter(Boolean)
                .includes(normalizedTargetId));
        };
        const specie = window.speciesManagerInstance.species.find(s => 
            matchesSpeciesId(s, id)
        );
        
        if (specie) {
            window.speciesManagerInstance.selectSpecies(id, getSpeciesDisplayName(specie));
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

function isSpeciesAutocompleteInput(el) {
    return !!(el && el.matches && (
        el.matches('[data-species-autocomplete="true"]') ||
        el.id === SPECIES_CONFIG.inputId ||
        el.id === 'especieEntrada'
    ));
}

function getSpeciesAutocompleteInput(inputOrId = null) {
    if (inputOrId && typeof inputOrId === 'object' && inputOrId.nodeType === 1) {
        return isSpeciesAutocompleteInput(inputOrId) ? inputOrId : null;
    }
    if (inputOrId && typeof inputOrId === 'string') {
        const byId = document.getElementById(inputOrId);
        if (isSpeciesAutocompleteInput(byId)) return byId;
    }
    if (isSpeciesAutocompleteInput(document.activeElement)) return document.activeElement;
    if (window.__activeSpeciesAutocompleteInputId) {
        const activeById = document.getElementById(window.__activeSpeciesAutocompleteInputId);
        if (isSpeciesAutocompleteInput(activeById)) return activeById;
    }
    const configured = document.getElementById(SPECIES_CONFIG.inputId);
    if (isSpeciesAutocompleteInput(configured)) return configured;
    const entrada = document.getElementById('especieEntrada');
    if (isSpeciesAutocompleteInput(entrada)) return entrada;
    return document.querySelector('[data-species-autocomplete="true"]');
}

const SPECIES_AUTOCOMPLETE_Z_INDEX = 10000020;
const SPECIES_RESERVED_AUTOCOMPLETE_MAX_HEIGHT = 220;

window.setActiveSpeciesAutocompleteInput = function(inputOrId) {
    const input = getSpeciesAutocompleteInput(inputOrId);
    if (!input) return null;
    if (input.id) window.__activeSpeciesAutocompleteInputId = input.id;
    setSpeciesAutocompleteExpanded(input, input.getAttribute('aria-expanded') === 'true');
    return input;
};

window.getActiveSpeciesAutocompleteInput = function() {
    return getSpeciesAutocompleteInput();
};

function isSpeciesReservedLayout(input) {
    return !!(input && input.dataset && input.dataset.speciesLayout === 'reserved');
}

function collapseSpeciesSuggestionsReserve(reserve) {
    if (!reserve) return;
    reserve.classList.remove('is-open');
    reserve.setAttribute('aria-hidden', 'true');
    reserve.style.display = 'none';
}

function collapseInactiveSpeciesSuggestionsReserves(activeReserve = null) {
    document.querySelectorAll('.species-suggestions-reserve.is-open').forEach((reserve) => {
        if (reserve !== activeReserve) collapseSpeciesSuggestionsReserve(reserve);
    });
}

function getSpeciesSuggestionsReserve(input, create = false) {
    if (!isSpeciesReservedLayout(input)) return null;
    const reserveId = input.dataset.speciesReserve || (input.id ? `${input.id}SuggestionsReserve` : '');
    let reserve = reserveId ? document.getElementById(reserveId) : null;
    if (!reserve && create) {
        reserve = document.createElement('div');
        if (reserveId) reserve.id = reserveId;
        reserve.className = 'species-suggestions-reserve';
        reserve.setAttribute('aria-hidden', 'true');
        const host = input.closest('.search-box') || input.closest('.form-group') || input.parentNode || document.body;
        host.appendChild(reserve);
    }
    if (reserve) reserve.classList.add('species-suggestions-reserve');
    return reserve;
}

function getSpeciesSuggestionsHost(input, create = false) {
    return getSpeciesSuggestionsReserve(input, create) || document.body;
}

function getSpeciesSuggestionsContainer(input, create = false) {
    let suggestionsContainer = document.getElementById('especieSuggestions');
    const host = input ? getSpeciesSuggestionsHost(input, create) : document.body;
    if (!suggestionsContainer && create && input) {
        suggestionsContainer = document.createElement('div');
        suggestionsContainer.id = 'especieSuggestions';
        suggestionsContainer.className = 'autocomplete-suggestions';
        suggestionsContainer.setAttribute('role', 'listbox');
        suggestionsContainer.style.display = 'none';
        suggestionsContainer.style.cssText = `
            position: fixed;
            background: white;
            border: 1px solid #ddd;
            border-top: none;
            max-height: 200px;
            overflow-y: auto;
            z-index: ${SPECIES_AUTOCOMPLETE_Z_INDEX};
            box-shadow: 0 2px 4px rgba(0,0,0,0.1);
            display: none;
        `;
        host.appendChild(suggestionsContainer);
    } else if (suggestionsContainer && create && host && suggestionsContainer.parentNode !== host) {
        const previousReserve = suggestionsContainer.parentElement && suggestionsContainer.parentElement.classList.contains('species-suggestions-reserve')
            ? suggestionsContainer.parentElement
            : null;
        if (previousReserve) collapseSpeciesSuggestionsReserve(previousReserve);
        host.appendChild(suggestionsContainer);
    }
    collapseInactiveSpeciesSuggestionsReserves(host && host.classList && host.classList.contains('species-suggestions-reserve') ? host : null);
    return suggestionsContainer;
}

function positionSpeciesSuggestionsContainer(input, suggestionsContainer) {
    if (!input || !suggestionsContainer) return;
    const reserve = getSpeciesSuggestionsReserve(input, false);
    if (reserve && suggestionsContainer.parentElement === reserve) {
        reserve.classList.add('is-open');
        reserve.setAttribute('aria-hidden', 'false');
        reserve.style.display = 'block';

        suggestionsContainer.style.setProperty('position', 'static', 'important');
        suggestionsContainer.style.setProperty('left', 'auto', 'important');
        suggestionsContainer.style.setProperty('top', 'auto', 'important');
        suggestionsContainer.style.setProperty('right', 'auto', 'important');
        suggestionsContainer.style.setProperty('width', '100%', 'important');
        suggestionsContainer.style.setProperty('max-height', `${SPECIES_RESERVED_AUTOCOMPLETE_MAX_HEIGHT}px`, 'important');
        suggestionsContainer.style.setProperty('z-index', String(SPECIES_AUTOCOMPLETE_Z_INDEX), 'important');
        return;
    }

    const rect = input.getBoundingClientRect();
    const viewportWidth = window.innerWidth || document.documentElement.clientWidth || 0;
    const viewportHeight = window.innerHeight || document.documentElement.clientHeight || 0;
    const margin = 8;
    const belowSpace = Math.max(0, viewportHeight - rect.bottom - margin);
    const aboveSpace = Math.max(0, rect.top - margin);
    const openAbove = belowSpace < 160 && aboveSpace > belowSpace;
    const maxHeight = Math.max(120, Math.min(260, openAbove ? aboveSpace : belowSpace || 200));
    const width = Math.max(180, Math.min(rect.width, viewportWidth - (margin * 2)));
    const left = Math.max(margin, Math.min(rect.left, viewportWidth - width - margin));
    const top = openAbove ? Math.max(margin, rect.top - maxHeight) : Math.min(rect.bottom, viewportHeight - margin);

    suggestionsContainer.style.setProperty('position', 'fixed', 'important');
    suggestionsContainer.style.setProperty('left', `${left}px`, 'important');
    suggestionsContainer.style.setProperty('top', `${top}px`, 'important');
    suggestionsContainer.style.setProperty('right', 'auto', 'important');
    suggestionsContainer.style.setProperty('width', `${width}px`, 'important');
    suggestionsContainer.style.setProperty('max-height', `${maxHeight}px`, 'important');
    suggestionsContainer.style.setProperty('z-index', String(SPECIES_AUTOCOMPLETE_Z_INDEX), 'important');
}

function setSpeciesAutocompleteExpanded(input, expanded) {
    if (!input) return;
    input.setAttribute('aria-expanded', expanded ? 'true' : 'false');
    input.setAttribute('aria-controls', 'especieSuggestions');
    input.setAttribute('aria-haspopup', 'listbox');
    input.setAttribute('role', 'combobox');
}

window.hideSpeciesSuggestions = function(input = getSpeciesAutocompleteInput()) {
    try { clearTimeout(window.__speciesSuggestTimer); } catch {}
    const suggestionsContainer = document.getElementById('especieSuggestions');
    if (suggestionsContainer) {
        suggestionsContainer.style.display = 'none';
        const reserve = suggestionsContainer.parentElement && suggestionsContainer.parentElement.classList.contains('species-suggestions-reserve')
            ? suggestionsContainer.parentElement
            : null;
        collapseSpeciesSuggestionsReserve(reserve);
    }
    setSpeciesAutocompleteExpanded(input, false);
};

function createSpeciesSuggestionOption(specie, onSelect) {
    const div = document.createElement('div');
    div.className = 'autocomplete-suggestion';
    div.setAttribute('role', 'option');
    div.tabIndex = -1;
    const displayName = getSpeciesDisplayName(specie);
    const scientificName = getSpeciesScientificName(specie);
    div.setAttribute('aria-label', scientificName ? `${displayName}, ${scientificName}` : displayName);
    div.innerHTML = `
        <div class="species-suggestion-name">${escapeSpeciesHtml(displayName)}</div>
        ${scientificName ? `<div class="species-suggestion-scientific">${escapeSpeciesHtml(scientificName)}</div>` : ''}
    `;
    div.style.cssText = `
        padding: 10px;
        cursor: pointer;
        border-bottom: 1px solid #eee;
        transition: background-color 0.2s;
    `;
    let selected = false;
    const runSelect = () => {
        if (selected) return;
        selected = true;
        onSelect(specie);
    };
    div.addEventListener('pointerdown', (event) => {
        event.preventDefault();
        runSelect();
    });
    div.addEventListener('click', runSelect);
    div.addEventListener('mouseenter', () => {
        div.style.backgroundColor = '#f8f9fa';
    });
    div.addEventListener('mouseleave', () => {
        div.style.backgroundColor = '';
    });
    return div;
}

// ✅ FUNÇÃO showSpeciesSuggestions UNIFICADA (para resolver autocomplete)
window.showSpeciesSuggestions = function(input) {
    input = window.setActiveSpeciesAutocompleteInput(input);
    if (!input) return;
    if (Date.now() < (window.__speciesSuppressSuggestionsUntil || 0)) {
        window.hideSpeciesSuggestions(input);
        return;
    }
    if (document.activeElement !== input) {
        window.hideSpeciesSuggestions(input);
        return;
    }

    const value = normalizeSpeciesNameKey(input.value || '');
    try { clearTimeout(window.__speciesSuggestTimer); } catch {}

    window.__speciesSuggestTimer = setTimeout(() => {
        if (document.activeElement !== input) {
            window.hideSpeciesSuggestions(input);
            return;
        }

        const suggestionsContainer = getSpeciesSuggestionsContainer(input, true);
        if (!suggestionsContainer) return;
        suggestionsContainer.innerHTML = '';
        suggestionsContainer.style.display = 'none';
        setSpeciesAutocompleteExpanded(input, false);

        const managerSpecies = window.speciesManagerInstance && Array.isArray(window.speciesManagerInstance.species)
            ? window.speciesManagerInstance.species
            : [];
        const speciesBase = managerSpecies.length > 0 ? managerSpecies : (window.species || []);
        const parseTime = (s) => {
            const u = s && s.updatedAt;
            if (typeof u === 'number') return u;
            if (typeof u === 'string') {
                const t = Date.parse(u);
                if (!isNaN(t)) return t;
            }
            const c = s && s.createdAt;
            if (typeof c === 'number') return c;
            if (typeof c === 'string') {
                const t = Date.parse(c);
                if (!isNaN(t)) return t;
            }
            const idn = parseFloat(s && s.id);
            return !isNaN(idn) ? idn : 0;
        };
        const species = [...speciesBase].sort((a, b) => parseTime(b) - parseTime(a));
        const showContainer = () => {
            if (document.activeElement !== input || suggestionsContainer.childElementCount === 0) {
                window.hideSpeciesSuggestions(input);
                return;
            }
            positionSpeciesSuggestionsContainer(input, suggestionsContainer);
            suggestionsContainer.style.display = 'block';
            setSpeciesAutocompleteExpanded(input, true);
        };
        const selectSuggestedSpecies = (specie) => {
            const finalName = getSpeciesDisplayName(specie);
            window.__speciesSuppressSuggestionsUntil = Date.now() + 300;
            if (window.speciesManagerInstance && typeof window.speciesManagerInstance.selectSpecies === 'function') {
                window.speciesManagerInstance.selectSpecies(specie.firebaseKey || specie.key || specie.id || specie.originalId, finalName);
            } else {
                input.value = finalName;
                input.dispatchEvent(new Event('change', { bubbles: true }));
                input.dispatchEvent(new Event('input', { bubbles: true }));
                window.selectedSpecies = specie || { nome: finalName };
            }
            window.hideSpeciesSuggestions(input);
        };

        if (value.length === 0) {
            species.slice(0, 10).forEach(specie => {
                suggestionsContainer.appendChild(createSpeciesSuggestionOption(specie, selectSuggestedSpecies));
            });
            showContainer();
            return;
        }

        if (value.length < 2) {
            species.slice(0, 5).forEach(specie => {
                suggestionsContainer.appendChild(createSpeciesSuggestionOption(specie, selectSuggestedSpecies));
            });
            showContainer();
            return;
        }

        const filteredSpecies = species.filter(specie => {
            const searchable = [
                getSpeciesDisplayName(specie),
                getSpeciesScientificName(specie),
                specie.nomeComum,
                specie.especie
            ].map(normalizeSpeciesNameKey).join(' ');
            return searchable.includes(value);
        });
        if (filteredSpecies.length === 0) {
            const div = document.createElement('div');
            div.className = 'autocomplete-suggestion autocomplete-empty';
            div.style.cssText = `
                padding: 10px;
                font-style: italic;
                color: #666;
                text-align: center;
            `;
            const msg = document.createElement('div');
            msg.style.marginBottom = '5px';
            msg.textContent = 'Nenhuma espécie encontrada';
            const btn = document.createElement('button');
            btn.type = 'button';
            btn.textContent = 'Ver lista completa';
            btn.style.cssText = 'padding: 4px 8px; background: #007bff; color: white; border: none; border-radius: 3px; cursor: pointer; font-size: 11px;';
            btn.addEventListener('pointerdown', (event) => {
                event.preventDefault();
                window.hideSpeciesSuggestions(input);
                if (window.speciesManagerInstance && typeof window.speciesManagerInstance.openModal === 'function') {
                    window.speciesManagerInstance.openModal();
                }
            });
            div.append(msg, btn);
            suggestionsContainer.appendChild(div);
            showContainer();
            return;
        }

        filteredSpecies.slice(0, 20).forEach(specie => {
            suggestionsContainer.appendChild(createSpeciesSuggestionOption(specie, selectSuggestedSpecies));
        });
        showContainer();
    }, 120);
};

// ✅ FECHAR SUGESTÕES QUANDO O CAMPO PERDE CONTEXTO
document.addEventListener('pointerdown', function(e) {
    const especieSuggestions = document.getElementById('especieSuggestions');
    const especieInput = getSpeciesAutocompleteInput();
    if (!especieSuggestions || !especieInput || especieSuggestions.style.display === 'none') return;
    if (isSpeciesAutocompleteInput(e.target) || especieSuggestions.contains(e.target)) return;
    window.hideSpeciesSuggestions(especieInput);
}, true);

document.addEventListener('focusin', function(e) {
    const especieSuggestions = document.getElementById('especieSuggestions');
    const especieInput = getSpeciesAutocompleteInput();
    if (!especieSuggestions || !especieInput || isSpeciesAutocompleteInput(e.target) || especieSuggestions.contains(e.target)) return;
    window.hideSpeciesSuggestions(especieInput);
}, true);

document.addEventListener('keydown', function(e) {
    const especieSuggestions = document.getElementById('especieSuggestions');
    const especieInput = getSpeciesAutocompleteInput();
    if (!especieInput || !especieSuggestions) return;
    if ((e.key === 'Escape' || e.key === 'Tab') && (e.target === especieInput || especieSuggestions.contains(e.target))) {
        window.hideSpeciesSuggestions(especieInput);
    }
});

window.addEventListener('blur', function() {
    window.hideSpeciesSuggestions(getSpeciesAutocompleteInput());
});

function repositionOpenSpeciesSuggestions() {
    const especieSuggestions = document.getElementById('especieSuggestions');
    const especieInput = getSpeciesAutocompleteInput();
    if (!especieSuggestions || !especieInput || especieSuggestions.style.display === 'none') return;
    if (document.activeElement !== especieInput) {
        window.hideSpeciesSuggestions(especieInput);
        return;
    }
    positionSpeciesSuggestionsContainer(especieInput, especieSuggestions);
}

window.addEventListener('resize', repositionOpenSpeciesSuggestions);
window.addEventListener('scroll', repositionOpenSpeciesSuggestions, true);

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
#speciesListModal {
    z-index: ${SPECIES_LIST_MODAL_Z_INDEX} !important;
}

#speciesModal {
    z-index: ${SPECIES_EDIT_MODAL_Z_INDEX} !important;
}

.species-list-modal-content {
    max-width: 860px !important;
    width: min(94vw, 860px) !important;
    border-radius: 8px !important;
    overflow: hidden !important;
}

.species-list-filter-input {
    width: 100% !important;
    min-height: 38px !important;
    padding: 9px 11px !important;
    border: 1px solid #d1d5db !important;
    border-radius: 6px !important;
    background: #fff !important;
    color: #111827 !important;
    font-size: 14px !important;
    line-height: 1.35 !important;
    box-sizing: border-box !important;
    outline: none !important;
}

.species-list-filter-input:focus {
    border-color: #2563eb !important;
    box-shadow: 0 0 0 3px rgba(37, 99, 235, 0.14) !important;
}

#speciesListModal .table-container,
#speciesListModal .modal-table-scroll,
#speciesListModal .species-list-table-container {
    width: 100% !important;
    max-height: 400px !important;
    overflow-x: auto !important;
    overflow-y: auto !important;
    border: 1px solid #ddd !important;
    border-radius: 4px !important;
}

#speciesListModal #speciesListFilter {
    width: 100% !important;
    min-height: 38px !important;
    padding: 9px 11px !important;
    border: 1px solid #d1d5db !important;
    border-radius: 6px !important;
    background: #fff !important;
    color: #111827 !important;
    font-size: 14px !important;
    line-height: 1.35 !important;
    box-sizing: border-box !important;
    outline: none !important;
}

#speciesListModal #speciesListFilter:focus {
    border-color: #2563eb !important;
    box-shadow: 0 0 0 3px rgba(37, 99, 235, 0.14) !important;
}

#speciesListModal .table {
    width: 100% !important;
    margin: 0 !important;
    border-collapse: collapse !important;
    table-layout: fixed !important;
}

#speciesListModal .table th,
#speciesListModal .table td {
    vertical-align: middle !important;
}

#speciesListModal .table th:nth-child(1),
#speciesListModal .table td:nth-child(1) {
    width: 30% !important;
}

#speciesListModal .table th:nth-child(2),
#speciesListModal .table td:nth-child(2) {
    width: calc(70% - 92px) !important;
    white-space: normal !important;
    overflow-wrap: anywhere !important;
}

#speciesListModal .table th:last-child,
#speciesListModal .table td:last-child {
    width: 92px !important;
    min-width: 92px !important;
    max-width: 92px !important;
    text-align: center !important;
    padding-left: 6px !important;
    padding-right: 6px !important;
    white-space: nowrap !important;
}

#speciesListModal .btn-group,
#speciesListModal .actions-container,
#speciesListModal .action-buttons-container {
    display: inline-flex !important;
    align-items: center !important;
    justify-content: center !important;
    flex-wrap: nowrap !important;
    gap: 6px !important;
    width: auto !important;
    min-width: 66px !important;
    margin: 0 auto !important;
}

#speciesListModal .action-button,
#speciesListModal .client-action-button,
#speciesListModal .btn-selecionar,
#speciesListModal .species-action-btn {
    width: 30px !important;
    min-width: 30px !important;
    height: 30px !important;
    padding: 0 !important;
    display: inline-flex !important;
    align-items: center !important;
    justify-content: center !important;
}

.species-name-suggestions-reserve {
    width: 100% !important;
    margin-top: 6px !important;
}

.species-duplicate-hint {
    display: none !important;
    margin-top: 6px !important;
    padding: 8px 10px !important;
    border: 1px solid #f59e0b !important;
    border-radius: 6px !important;
    background: #fffbeb !important;
    color: #92400e !important;
    font-size: 12px !important;
    line-height: 1.35 !important;
}

.species-duplicate-hint.is-visible {
    display: block !important;
}

.species-modal-actions {
    display: flex !important;
    justify-content: flex-end !important;
    gap: 10px !important;
    margin-top: 4px !important;
}

.species-modal-actions .btn {
    min-height: 36px !important;
    padding: 8px 14px !important;
    border-radius: 6px !important;
    border: 1px solid #d1d5db !important;
    cursor: pointer !important;
}

.species-modal-actions .btn-primary {
    border-color: #2563eb !important;
    background: #2563eb !important;
    color: #fff !important;
}

.species-modal-actions .btn-secondary {
    background: #f9fafb !important;
    color: #374151 !important;
}

.species-suggestion-name {
    color: #111827 !important;
    font-weight: 600 !important;
    line-height: 1.25 !important;
}

.species-suggestion-scientific {
    margin-top: 2px !important;
    color: #6b7280 !important;
    font-size: 12px !important;
    line-height: 1.25 !important;
}

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

    .species-modal-actions {
        flex-wrap: wrap !important;
    }

    .species-modal-actions .btn {
        flex: 1 1 130px !important;
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
    position: fixed !important;
    right: auto !important;
    background: white !important;
    border: 1px solid #ddd !important;
    border-top: none !important;
    max-height: 200px !important;
    overflow-y: auto !important;
    z-index: 10000020 !important;
    box-shadow: 0 2px 4px rgba(0,0,0,0.1) !important;
}

.species-suggestions-reserve {
    display: none;
    width: min(420px, 100%);
    max-width: 100%;
    margin-top: 8px;
}

.species-suggestions-reserve.is-open {
    display: block;
}

.species-suggestions-reserve .autocomplete-suggestions {
    position: static !important;
    left: auto !important;
    top: auto !important;
    right: auto !important;
    width: 100% !important;
    max-height: 220px !important;
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
