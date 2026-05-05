/**
 * 🌳 MÓDULO: Modal de Espécies - Romaneio TL
 * 
 * Responsabilidades:
 * - Gerenciar modal de lista de espécies
 * - Paginação e filtros
 * - Integração com Firebase
 * - Compatibilidade com sistema padronizado
 * 
 * ✅ ESTRUTURA MODULAR: Seguindo romaneiotl-estruturaçãomodular.txt
 * ✅ FIREBASE PRIORITY: Firebase primeiro, localStorage como fallback
 */

window.ModalEspecies = (function() {
    'use strict';

    // ✅ CONFIGURAÇÕES
    const CONFIG = {
        modalId: 'speciesListModal',
        tableId: 'speciesListTable',
        filterId: 'speciesListFilter',
        paginationId: 'speciesListPagination',
        itemsPerPage: 5
    };

    // ✅ ESTADO DO MODAL
    let state = {
        currentPage: 1,
        species: [],
        filteredSpecies: [],
        isLoading: false
    };
    function resolveCompanyId() {
        try {
            const svc = window.firebaseService || window.firebaseServiceTL || window.FirebaseService;
            if (svc && typeof svc.getTenantId === 'function') {
                const t = svc.getTenantId();
                if (t) return String(t);
            }
        } catch (_) {}
        try {
            if (window.appTenantId) return String(window.appTenantId);
            if (window.companyInfo) {
                const raw = window.companyInfo;
                const id = raw.id || raw.companyId || raw.slug || raw.nome || raw.name;
                if (id) return String(id);
            }
            const stored = localStorage.getItem('company_info');
            if (stored) {
                const obj = JSON.parse(stored);
                const id = obj && (obj.id || obj.companyId || obj.slug || obj.nome || obj.name);
                if (id) return String(id);
            }
        } catch (_) {}
        return null;
    }

    function resolveStorageKey(base) {
        try {
            const svc = window.firebaseServiceTL || window.firebaseService || window.FirebaseService;
            if (svc && typeof svc.getNamespacedPath === 'function') {
                const ns = svc.getNamespacedPath(base);
                if (ns) return ns;
            }
        } catch (_) {}
        const companyId = resolveCompanyId();
        if (companyId && !/^companies\//.test(base) && !/^users\//.test(base)) {
            return `companies/${companyId}/${base}`;
        }
        return base;
    }

    function readLocalArray(base) {
        const nsKey = resolveStorageKey(base);
        try {
            const rawNs = localStorage.getItem(nsKey);
            if (rawNs) {
                const parsed = JSON.parse(rawNs);
                if (Array.isArray(parsed)) return parsed;
            }
        } catch (_) {}
        try {
            const raw = localStorage.getItem(base);
            if (raw) {
                const parsed = JSON.parse(raw);
                if (Array.isArray(parsed)) return parsed;
            }
        } catch (_) {}
        return [];
    }

    /**
     * ✅ ABRIR MODAL DE LISTA DE ESPÉCIES
     */
    async function openModal() {
        console.log('🌳 Abrindo modal de lista de espécies...');
        
        try {
            const modal = document.getElementById(CONFIG.modalId);
            if (!modal) {
                console.error('❌ Modal de espécies não encontrado no DOM');
                return;
            }

            // Exibir modal
            modal.style.display = 'block';
            
            // Carregar dados
            await loadSpecies();
            
            // Renderizar lista
            renderSpeciesList();
            renderPagination();
            
            // Configurar eventos
            setupEventListeners();

            const filterInput = document.getElementById(CONFIG.filterId);
            if (filterInput) {
                setTimeout(() => {
                    filterInput.focus();
                }, 300);
            }
            
            console.log('✅ Modal de espécies aberto com sucesso');
            
        } catch (error) {
            console.error('❌ Erro ao abrir modal de espécies:', error);
            showError('Erro ao carregar lista de espécies');
        }
    }

    /**
     * ✅ CARREGAR ESPÉCIES DO FIREBASE
     */
    async function loadSpecies() {
        console.log('📂 Carregando espécies do Firebase...');
        console.log('🔍 DEBUG: Iniciando carregamento de espécies');
        
        state.isLoading = true;
        updateLoadingState();
        
        try {
            let species = [];
            
            // Tentar carregar do Firebase primeiro
            if (window.FirebaseService) {
                try {
                    console.log('🔍 DEBUG: Tentando carregar do Firebase...');
                    
                    // ✅ USAR loadFromFirebase COMO ROMANEIOPCT
                    if (typeof window.FirebaseService.loadFromFirebase === 'function') {
                        console.log("🔥 Carregando espécies da coleção 'species'...");
                        const result = await window.FirebaseService.loadFromFirebase('species');
                        console.log("✅ loadFromFirebase resultado:", result);
                        
                        if (result && result.success && result.data) {
                            const firebaseData = result.data;
                            console.log(`🔍 DEBUG: Dados brutos do Firebase (species):`, firebaseData);
                            console.log(`🔍 DEBUG: Tipo de dados:`, typeof firebaseData);
                            console.log(`🔍 DEBUG: Chaves encontradas:`, Object.keys(firebaseData));
                            console.log(`🔍 DEBUG: Total de chaves:`, Object.keys(firebaseData).length);
                            
                            // ✅ PROCESSAMENTO CORRETO - COMO ROMANEIOPCT
                            if (typeof firebaseData === 'object' && !Array.isArray(firebaseData)) {
                                console.log('🔍 DEBUG: Dados são um objeto, convertendo para array');
                                species = Object.keys(firebaseData).map(key => {
                                    const item = firebaseData[key];
                                    console.log(`🔍 DEBUG: Processando item ${key}:`, item);
                                    return {
                                        id: key,
                                        ...item
                                    };
                                }).filter(item => item && (item.nome || item.name));
                            } else if (Array.isArray(firebaseData)) {
                                console.log('🔍 DEBUG: Dados são um array');
                                species = firebaseData.filter(item => item && (item.nome || item.name));
                            }
                            
                            console.log(`✅ DEBUG: ${species.length} espécies processadas do Firebase`);
                            console.log('🔍 DEBUG: Primeiras 3 espécies:', species.slice(0, 3));
                            
                        } else {
                            console.warn('⚠️ DEBUG: Nenhum dado encontrado no Firebase ou erro na consulta');
                            throw new Error('Dados não encontrados no Firebase');
                        }
                        
                    } else {
                        // Fallback para loadData se loadFromFirebase não estiver disponível
                        console.log('🔍 DEBUG: loadFromFirebase não disponível, usando loadData...');
                        
                        // Tentar diferentes caminhos possíveis no Firebase
                        const possiblePaths = ['species', 'especies', 'Species', 'Especies'];
                        let firebaseSpecies = null;
                        let usedPath = '';
                        
                        for (const path of possiblePaths) {
                            console.log(`🔍 DEBUG: Tentando caminho "${path}"...`);
                            try {
                                const data = await window.FirebaseService.loadData(path);
                                if (data && Object.keys(data).length > 0) {
                                    firebaseSpecies = data;
                                    usedPath = path;
                                    console.log(`✅ DEBUG: Dados encontrados no caminho "${path}"`);
                                    break;
                                }
                            } catch (pathError) {
                                console.log(`⚠️ DEBUG: Erro no caminho "${path}":`, pathError);
                            }
                        }
                        
                        if (firebaseSpecies) {
                            console.log(`🔍 DEBUG: Dados brutos do Firebase (${usedPath}):`, firebaseSpecies);
                            console.log(`🔍 DEBUG: Tipo de dados:`, typeof firebaseSpecies);
                            console.log(`🔍 DEBUG: Chaves encontradas:`, Object.keys(firebaseSpecies));
                            console.log(`🔍 DEBUG: Total de chaves:`, Object.keys(firebaseSpecies).length);
                            
                            // Verificar se é um objeto com chaves ou um array
                            if (Array.isArray(firebaseSpecies)) {
                                console.log('🔍 DEBUG: Dados são um array');
                                species = firebaseSpecies.filter(item => item && (item.nome || item.name));
                            } else if (typeof firebaseSpecies === 'object') {
                                console.log('🔍 DEBUG: Dados são um objeto, convertendo para array');
                                species = Object.keys(firebaseSpecies).map(key => {
                                    const item = firebaseSpecies[key];
                                    console.log(`🔍 DEBUG: Processando item ${key}:`, item);
                                    return {
                                        id: key,
                                        ...item
                                    };
                                }).filter(item => item && (item.nome || item.name));
                            }
                            
                            console.log(`✅ DEBUG: ${species.length} espécies processadas do Firebase`);
                            console.log('🔍 DEBUG: Primeiras 3 espécies:', species.slice(0, 3));
                            
                        } else {
                            console.warn('⚠️ DEBUG: Nenhum dado encontrado em nenhum caminho do Firebase');
                            throw new Error('Dados não encontrados no Firebase');
                        }
                    }
                    
                } catch (firebaseError) {
                    console.warn('⚠️ Erro ao carregar do Firebase:', firebaseError);
                    console.log('🔍 DEBUG: Detalhes do erro Firebase:', firebaseError);
                    
                    // Fallback para localStorage
                    console.log('🔍 DEBUG: Tentando fallback para localStorage...');
                    const localSpecies = readLocalArray('especies');
                    species = localSpecies;
                    console.log(`⚠️ ${species.length} espécies carregadas do localStorage (fallback)`);
                }
            } else {
                console.log('🔍 DEBUG: FirebaseService não disponível, usando localStorage');
                // Apenas localStorage se Firebase não estiver disponível
                const localSpecies = readLocalArray('species');
                species = localSpecies;
                console.log(`📦 ${species.length} espécies carregadas do localStorage`);
            }
            
            console.log(`🔍 DEBUG: Total de espécies antes da normalização: ${species.length}`);
            
            // Normalizar dados para compatibilidade
            state.species = species.map((specie, index) => {
                const normalizedSpecie = {
                    id: specie.id || specie.key || `SPECIES_${Date.now()}_${index}`,
                    nome: specie.nome || specie.name || specie.especie || 'Nome não informado',
                    name: specie.nome || specie.name || specie.especie || 'Nome não informado', // Compatibilidade
                    descricao: specie.descricao || specie.description || specie.desc || '',
                    description: specie.descricao || specie.description || specie.desc || '', // Compatibilidade
                    categoria: specie.categoria || specie.category || specie.cat || '',
                    category: specie.categoria || specie.category || specie.cat || '', // Compatibilidade
                    densidade: specie.densidade || specie.density || specie.dens || null,
                    density: specie.densidade || specie.density || specie.dens || null, // Compatibilidade
                    origem: specie.origem || specie.origin || specie.ori || '',
                    origin: specie.origem || specie.origin || specie.ori || '', // Compatibilidade
                    uso: specie.uso || specie.use || specie.utilidade || '',
                    use: specie.uso || specie.use || specie.utilidade || '' // Compatibilidade
                };
                
                if (index < 5) {
                    console.log(`🔍 DEBUG: Espécie ${index} normalizada:`, normalizedSpecie);
                }
                
                return normalizedSpecie;
            });
            
            // ✅ ORDENAR por última atualização (prioriza updatedAt/createdAt e fallbacks)
            const parseTime = (s) => {
                const u = s && s.updatedAt;
                if (typeof u === 'number') return u;
                if (typeof u === 'string') { const t = Date.parse(u); if (!isNaN(t)) return t; }
                const c = s && s.createdAt;
                if (typeof c === 'number') return c;
                if (typeof c === 'string') { const t = Date.parse(c); if (!isNaN(t)) return t; }
                const idn = parseFloat(s && s.id);
                if (!isNaN(idn)) return idn;
                return 0;
            };
            state.species.sort((a, b) => parseTime(b) - parseTime(a));
            state.filteredSpecies = [...state.species];
            state.currentPage = 1;
            
            console.log(`✅ ${state.species.length} espécies processadas e normalizadas`);
            console.log('🔍 DEBUG: Estado final das espécies:', {
                total: state.species.length,
                filtered: state.filteredSpecies.length,
                currentPage: state.currentPage,
                itemsPerPage: CONFIG.itemsPerPage
            });
            
            // Log das primeiras espécies para verificação
            if (state.species.length > 0) {
                console.log('🔍 DEBUG: Primeiras 5 espécies normalizadas:');
                state.species.slice(0, 5).forEach((specie, i) => {
                    console.log(`  ${i + 1}. ${specie.nome} (ID: ${specie.id})`);
                });
            }
            
        } catch (error) {
            console.error('❌ Erro ao carregar espécies:', error);
            console.log('🔍 DEBUG: Stack trace do erro:', error.stack);
            state.species = [];
            state.filteredSpecies = [];
            showError('Erro ao carregar dados das espécies');
        } finally {
            state.isLoading = false;
            updateLoadingState();
            console.log('🔍 DEBUG: Carregamento finalizado');
        }
    }

    /**
     * ✅ RENDERIZAR LISTA DE ESPÉCIES
     */
    function renderSpeciesList() {
        const tbody = document.getElementById(CONFIG.tableId);
        if (!tbody) {
            console.error('❌ Tabela de espécies não encontrada');
            return;
        }

        // Calcular itens da página atual
        const startIndex = (state.currentPage - 1) * CONFIG.itemsPerPage;
        const endIndex = startIndex + CONFIG.itemsPerPage;
        const speciesToShow = state.filteredSpecies.slice(startIndex, endIndex);

        if (state.isLoading) {
            tbody.innerHTML = `
                <tr>
                    <td colspan="3" style="text-align: center; padding: 20px;">
                        <i class="fas fa-spinner fa-spin"></i> Carregando espécies...
                    </td>
                </tr>
            `;
            return;
        }

        if (speciesToShow.length === 0) {
            tbody.innerHTML = `
                <tr>
                    <td colspan="3" style="text-align: center; padding: 20px; color: #666;">
                        <i class="fas fa-tree"></i><br>
                        ${state.filteredSpecies.length === 0 ? 'Nenhuma espécie cadastrada' : 'Nenhuma espécie encontrada com os filtros aplicados'}
                    </td>
                </tr>
            `;
            return;
        }

        tbody.innerHTML = speciesToShow.map(specie => `
            <tr>
                <td>${specie.nome}</td>
                <td>${specie.descricao}</td>
                <td style="text-align: center;">
                    <div class="btn-group">
                        <button class="action-button select-button" onclick="window.ModalEspecies.selectSpecie('${specie.nome}')" title="Selecionar Espécie">
                            <i class="fas fa-check"></i>
                        </button>
                        <button class="action-button edit-button" onclick="window.ModalEspecies.editSpecie('${specie.id}')" title="Editar Espécie">
                            <i class="fas fa-edit"></i>
                        </button>
                    </div>
                </td>
            </tr>
        `).join('');

        // Atualizar informações do modal
        updateModalInfo();
    }

    /**
     * ✅ RENDERIZAR PAGINAÇÃO
     */
    function renderPagination() {
        const container = document.getElementById(CONFIG.paginationId);
        if (!container) return;

        const totalPages = Math.ceil(state.filteredSpecies.length / CONFIG.itemsPerPage);

        if (totalPages <= 1) {
            container.style.display = 'none';
            return;
        }

        container.style.display = 'flex';
        container.innerHTML = '';

        const addBtn = (label, page, disabled = false, active = false) => {
            const btn = document.createElement('button');
            btn.textContent = label;
            if (active) btn.classList.add('active');
            btn.disabled = disabled;
            btn.onclick = () => goToPage(page);
            container.appendChild(btn);
        };

        addBtn('<<<', 1, state.currentPage === 1);
        addBtn('<', state.currentPage - 1, state.currentPage === 1);

        const startPage = Math.max(1, state.currentPage - 2);
        const endPage = Math.min(totalPages, state.currentPage + 2);

        if (startPage > 1) {
            addBtn('1', 1, false, state.currentPage === 1);
            if (startPage > 2) {
                const span = document.createElement('span');
                span.textContent = '...';
                container.appendChild(span);
            }
        }

        for (let i = startPage; i <= endPage; i++) {
            addBtn(String(i), i, false, i === state.currentPage);
        }

        if (endPage < totalPages) {
            if (endPage < totalPages - 1) {
                const span = document.createElement('span');
                span.textContent = '...';
                container.appendChild(span);
            }
            addBtn(String(totalPages), totalPages, false, state.currentPage === totalPages);
        }

        addBtn('>', state.currentPage + 1, state.currentPage === totalPages);
        addBtn('>>>', totalPages, state.currentPage === totalPages);
    }

    /**
     * ✅ NAVEGAR PARA PÁGINA
     */
    function goToPage(page) {
        state.currentPage = page;
        renderSpeciesList();
        renderPagination();
    }

    /**
     * ✅ FILTRAR ESPÉCIES
     */
    function filterSpecies() {
        const filterInput = document.getElementById(CONFIG.filterId);
        if (!filterInput) return;

        const filterText = filterInput.value.toLowerCase().trim();
        
        if (!filterText) {
            state.filteredSpecies = [...state.species];
        } else {
            state.filteredSpecies = state.species.filter(specie => {
                const nome = (specie.nome || '').toLowerCase();
                const descricao = (specie.descricao || '').toLowerCase();
                const categoria = (specie.categoria || '').toLowerCase();
                const origem = (specie.origem || '').toLowerCase();
                
                return nome.includes(filterText) || 
                       descricao.includes(filterText) || 
                       categoria.includes(filterText) || 
                       origem.includes(filterText);
            });
        }

        state.currentPage = 1;
        renderSpeciesList();
        renderPagination();
    }

    /**
     * ✅ SELECIONAR ESPÉCIE - CORRIGIDO PARA ATUALIZAR WINDOW.SELECTEDSPECIES
     */
    function selectSpecie(specieName) {
        console.log(`✅ Selecionando espécie: ${specieName}`);
        
        // Preencher campo de espécie no formulário
        const especieInput = document.getElementById('especieInput');
        if (especieInput) {
            let nome = specieName || '';
            if (window.isAllCaps && window.toTitleCasePt && window.isAllCaps(nome)) {
                nome = window.toTitleCasePt(nome);
            }
            especieInput.value = nome;
            console.log(`✅ Campo especieInput preenchido com "${nome}"`);
        }

        // ✅ CORREÇÃO CRÍTICA: Atualizar window.selectedSpecies
        const selectedSpecie = state.species.find(s => s.nome === specieName);
        if (selectedSpecie) {
            window.selectedSpecies = {
                nome: selectedSpecie.nome,
                name: selectedSpecie.nome, // Compatibilidade
                id: selectedSpecie.id,
                descricao: selectedSpecie.descricao
            };
            console.log(`✅ window.selectedSpecies atualizado para:`, window.selectedSpecies);
        } else {
            // Fallback: criar objeto básico
            window.selectedSpecies = {
                nome: specieName,
                name: specieName
            };
            console.log(`✅ window.selectedSpecies definido (fallback) para:`, window.selectedSpecies);
        }

        // Fechar modal
        closeModal();
        
        // Notificar seleção
        console.log(`✅ Espécie "${specieName}" selecionada e window.selectedSpecies atualizado`);
    }

    /**
     * ✅ EDITAR ESPÉCIE
     */
    function editSpecie(specieId) {
        console.log(`✏️ Editando espécie: ${specieId}`);
        
        // Fechar modal de lista
        closeModal();
        
        // Abrir modal de edição via módulo CRUD
        if (window.GerenciarEspecies && window.GerenciarEspecies.openEditSpeciesModal) {
            window.GerenciarEspecies.openEditSpeciesModal(specieId);
        } else {
            console.error('❌ Módulo GerenciarEspecies não disponível');
            showError('Funcionalidade de edição não disponível');
        }
    }

    /**
     * ✅ FECHAR MODAL
     */
    function closeModal() {
        const modal = document.getElementById(CONFIG.modalId);
        if (modal) {
            modal.style.display = 'none';
        }
        console.log('✅ Modal de espécies fechado');
    }

    /**
     * ✅ CONFIGURAR EVENT LISTENERS
     */
    function setupEventListeners() {
        const modal = document.getElementById(CONFIG.modalId);
        if (!modal) return;

        // Filtro de busca
        const filterInput = document.getElementById(CONFIG.filterId);
        if (filterInput) {
            filterInput.removeEventListener('input', filterSpecies); // Remover listener anterior
            // ✅ Debounce de 300ms para reduzir re-renderizações
            let filterTimeout;
            const debouncedFilter = () => {
                clearTimeout(filterTimeout);
                filterTimeout = setTimeout(filterSpecies, 300);
            };
            filterInput.addEventListener('input', debouncedFilter);
            // Enter aplica imediatamente
            filterInput.addEventListener('keydown', (e) => {
                if (e.key === 'Enter') {
                    e.preventDefault();
                    clearTimeout(filterTimeout);
                    filterSpecies();
                }
            });
        }

        // Botões de fechar
        const closeButtons = modal.querySelectorAll('.close-modal, .close-modal-btn');
        closeButtons.forEach(btn => {
            btn.onclick = closeModal;
        });

        // Fechar ao clicar fora
        window.onclick = (event) => {
            if (event.target === modal) {
                closeModal();
            }
        };
    }

    /**
     * ✅ ATUALIZAR ESTADO DE CARREGAMENTO
     */
    function updateLoadingState() {
        renderSpeciesList();
    }

    /**
     * ✅ ATUALIZAR INFORMAÇÕES DO MODAL
     */
    function updateModalInfo() {
        const info = document.getElementById('speciesModalInfo');
        if (info) {
            const total = state.filteredSpecies.length;
            info.textContent = `${total} espécie${total !== 1 ? 's' : ''} encontrada${total !== 1 ? 's' : ''}`;
        }
    }

    /**
     * ✅ MOSTRAR ERRO
     */
    function showError(message) {
        if (window.Utils && window.Utils.showToast) {
            window.Utils.showToast(message, 'error');
        } else {
            alert('Erro: ' + message);
        }
    }

    /**
     * ✅ RECARREGAR LISTA
     */
    async function refresh() {
        console.log('🔄 Recarregando lista de espécies...');
        await loadSpecies();
        renderSpeciesList();
        renderPagination();
    }

    // 📡 Atualizar lista quando houver evento de espécies atualizadas (com throttle)
    window.addEventListener('species:updated', async function(e) {
        try {
            if (!window.__tlSpeciesRefreshTimer) {
                window.__tlSpeciesRefreshTimer = setTimeout(async () => {
                    window.__tlSpeciesRefreshTimer = null;
                    await refresh();
                    console.log('📡 TL: Lista de espécies atualizada via evento species:updated');
                }, 300);
            }
        } catch (err) {
            console.warn('⚠️ TL: Falha ao atualizar lista de espécies via evento:', err);
        }
    });

    /**
     * ✅ MOSTRAR TODAS AS ESPÉCIES (SEM PAGINAÇÃO)
     */
    function showAllSpecies() {
        console.log('📋 Mostrando todas as espécies...');
        
        const tbody = document.getElementById(CONFIG.tableId);
        if (!tbody) {
            console.error('❌ Tabela de espécies não encontrada');
            return;
        }

        if (state.isLoading) {
            tbody.innerHTML = `
                <tr>
                    <td colspan="3" style="text-align: center; padding: 20px;">
                        <i class="fas fa-spinner fa-spin"></i> Carregando espécies...
                    </td>
                </tr>
            `;
            return;
        }

        if (state.filteredSpecies.length === 0) {
            tbody.innerHTML = `
                <tr>
                    <td colspan="3" style="text-align: center; padding: 20px; color: #666;">
                        <i class="fas fa-tree"></i><br>
                        Nenhuma espécie cadastrada
                    </td>
                </tr>
            `;
            return;
        }

        // Mostrar TODAS as espécies filtradas
        tbody.innerHTML = state.filteredSpecies.map(specie => `
            <tr>
                <td>${specie.nome}</td>
                <td>${specie.descricao}</td>
                <td style="text-align: center;">
                    <div class="btn-group">
                        <button class="action-button select-button" onclick="window.ModalEspecies.selectSpecie('${specie.nome}')" title="Selecionar Espécie">
                            <i class="fas fa-check"></i>
                        </button>
                        <button class="action-button edit-button" onclick="window.ModalEspecies.editSpecie('${specie.id}')" title="Editar Espécie">
                            <i class="fas fa-edit"></i>
                        </button>
                    </div>
                </td>
            </tr>
        `).join('');

        // Ocultar paginação
        const paginationContainer = document.getElementById(CONFIG.paginationId);
        if (paginationContainer) {
            paginationContainer.style.display = 'none';
        }

        // Atualizar informações do modal
        updateModalInfo();
        
        console.log(`✅ Todas as ${state.filteredSpecies.length} espécies exibidas`);
    }

    // ✅ INTERFACE PÚBLICA
    return {
        openModal,
        closeModal,
        selectSpecie,
        editSpecie,
        refresh,
        loadSpecies,
        showAllSpecies
    };

})();

// ✅ FUNÇÕES GLOBAIS PARA COMPATIBILIDADE
window.openSpeciesListModal = window.ModalEspecies.openModal;
window.selectSpecies = window.ModalEspecies.selectSpecie;
window.renderSpeciesList = window.ModalEspecies.refresh;

console.log('✅ Módulo ModalEspecies carregado com sucesso');
