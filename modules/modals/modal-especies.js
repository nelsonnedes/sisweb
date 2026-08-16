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
    const speciesTools = window.SiswebSpecies || {};

    function getSpeciesName(specie) {
        if (speciesTools.getDisplayName) return speciesTools.getDisplayName(specie);
        return String((specie && (specie.especie || specie.nome || specie.name)) || '').trim();
    }

    function getSpeciesScientific(specie) {
        if (speciesTools.getScientificName) return speciesTools.getScientificName(specie);
        return String((specie && (specie.nomeCientifico || specie.scientificName || specie.scientific || specie.descricao || specie.description || specie.decription)) || '').trim();
    }

    function normalizeSpecies(specie, index = 0) {
        if (speciesTools.normalizeRecord) return speciesTools.normalizeRecord(specie, index);
        const name = getSpeciesName(specie) || 'Nome não informado';
        const scientific = getSpeciesScientific(specie);
        return {
            ...(specie || {}),
            id: (specie && (specie.firebaseKey || specie.key || specie.id)) || `SPECIES_${Date.now()}_${index}`,
            especie: name,
            nome: name,
            name,
            nomeComum: (specie && (specie.nomeComum || specie.nome || specie.name)) || name,
            nomeCientifico: scientific,
            scientificName: scientific,
            scientific
        };
    }

    function normalizeSearchKey(value) {
        if (speciesTools.normalizeNameKey) return speciesTools.normalizeNameKey(value);
        return String(value || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().trim();
    }

    function escapeHtml(value) {
        if (speciesTools.escapeHtml) return speciesTools.escapeHtml(value);
        return String(value ?? '').replace(/[&<>"']/g, (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[char]));
    }

    function jsStringArg(value) {
        return escapeHtml(JSON.stringify(String(value || '')));
    }

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
                const id = raw.companyId || raw.companyID || raw.tenantId || raw.id;
                if (id) return String(id);
            }
            const stored = localStorage.getItem('company_info');
            if (stored) {
                const obj = JSON.parse(stored);
                const id = obj && (obj.companyId || obj.companyID || obj.tenantId || obj.id);
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
        const companyId = resolveCompanyId();
        if (!companyId) return [];
        const nsKey = resolveStorageKey(base);
        try {
            const rawNs = localStorage.getItem(nsKey);
            if (rawNs) {
                const parsed = JSON.parse(rawNs);
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
        console.info('[Species] TL modal: carregando especies.');
        
        state.isLoading = true;
        updateLoadingState();
        
        try {
            if (window.SiswebSpeciesStore && typeof window.SiswebSpeciesStore.getAll === 'function') {
                const storeSpecies = await window.SiswebSpeciesStore.getAll({ waitRemote: true, timeoutMs: 5000 });
                state.species = storeSpecies.map((specie, index) => ({
                    ...normalizeSpecies(specie, index),
                    categoria: specie.categoria || specie.category || specie.cat || '',
                    category: specie.categoria || specie.category || specie.cat || '',
                    densidade: specie.densidade || specie.density || specie.dens || null,
                    density: specie.densidade || specie.density || specie.dens || null,
                    origem: specie.origem || specie.origin || specie.ori || '',
                    origin: specie.origem || specie.origin || specie.ori || '',
                    uso: specie.uso || specie.use || specie.utilidade || '',
                    use: specie.uso || specie.use || specie.utilidade || ''
                }));
                state.filteredSpecies = [...state.species];
                state.currentPage = 1;
                console.info(`[Species] TL modal: ${state.species.length} especies carregadas via store compartilhado.`);
                return;
            }

            let species = [];
            
            // Tentar carregar do Firebase primeiro
            if (window.FirebaseService) {
                try {
                    console.log('🔍 DEBUG: Tentando carregar do Firebase...');
                    
                    // ✅ USAR loadFromFirebase COMO ROMANEIOPCT
                    if (typeof window.FirebaseService.loadFromFirebase === 'function') {
                        console.log("🔥 Carregando espécies da coleção 'especies'...");
                        const result = await window.FirebaseService.loadFromFirebase('especies');
                        console.log("✅ loadFromFirebase resultado:", result);
                        
                        if (result && result.success && result.data) {
                            const firebaseData = result.data;
                            console.log(`🔍 DEBUG: Dados brutos do Firebase (especies):`, firebaseData);
                            console.log(`🔍 DEBUG: Tipo de dados:`, typeof firebaseData);
                            console.log(`🔍 DEBUG: Chaves encontradas:`, Object.keys(firebaseData));
                            console.log(`🔍 DEBUG: Total de chaves:`, Object.keys(firebaseData).length);
                            
                            // ✅ PROCESSAMENTO CORRETO - COMO ROMANEIOPCT
                            if (typeof firebaseData === 'object' && !Array.isArray(firebaseData)) {
                                console.log('🔍 DEBUG: Dados são um objeto, convertendo para array');
                                species = Object.keys(firebaseData).map(key => {
                                    const item = firebaseData[key] || {};
                                    console.log(`🔍 DEBUG: Processando item ${key}:`, item);
                                    return {
                                        ...item,
                                        id: key,
                                        key,
                                        firebaseKey: key,
                                        originalId: item.id || item.key || key
                                    };
                                }).filter(item => item && (item.especie || item.nome || item.name));
                            } else if (Array.isArray(firebaseData)) {
                                console.log('🔍 DEBUG: Dados são um array');
                                species = firebaseData.map((item, index) => {
                                    const value = item || {};
                                    const key = String(index);
                                    return {
                                        ...value,
                                        id: key,
                                        key,
                                        firebaseKey: key,
                                        originalId: value.id || value.key || key
                                    };
                                }).filter(item => item && (item.especie || item.nome || item.name));
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
                        
                        const possiblePaths = ['especies'];
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
                                species = firebaseSpecies.map((item, index) => {
                                    const value = item || {};
                                    const key = String(index);
                                    return {
                                        ...value,
                                        id: key,
                                        key,
                                        firebaseKey: key,
                                        originalId: value.id || value.key || key
                                    };
                                }).filter(item => item && (item.especie || item.nome || item.name));
                            } else if (typeof firebaseSpecies === 'object') {
                                console.log('🔍 DEBUG: Dados são um objeto, convertendo para array');
                                species = Object.keys(firebaseSpecies).map(key => {
                                    const item = firebaseSpecies[key] || {};
                                    console.log(`🔍 DEBUG: Processando item ${key}:`, item);
                                    return {
                                        ...item,
                                        id: key,
                                        key,
                                        firebaseKey: key,
                                        originalId: item.id || item.key || key
                                    };
                                }).filter(item => item && (item.especie || item.nome || item.name));
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
                const localSpecies = readLocalArray('especies');
                species = localSpecies;
                console.log(`📦 ${species.length} espécies carregadas do localStorage`);
            }
            
            console.log(`🔍 DEBUG: Total de espécies antes da normalização: ${species.length}`);

            species = species.map((specie, index) => {
                if (specie && (specie.firebaseKey || specie.key)) return specie;
                const value = specie || {};
                const key = String(index);
                return {
                    ...value,
                    id: key,
                    key,
                    firebaseKey: key,
                    originalId: value.id || value.key || key
                };
            });
            
            // Normalizar dados para compatibilidade
            state.species = species.map((specie, index) => {
                const normalizedSpecie = {
                    ...normalizeSpecies(specie, index),
                    categoria: specie.categoria || specie.category || specie.cat || '',
                    category: specie.categoria || specie.category || specie.cat || '',
                    densidade: specie.densidade || specie.density || specie.dens || null,
                    density: specie.densidade || specie.density || specie.dens || null,
                    origem: specie.origem || specie.origin || specie.ori || '',
                    origin: specie.origem || specie.origin || specie.ori || '',
                    uso: specie.uso || specie.use || specie.utilidade || '',
                    use: specie.uso || specie.use || specie.utilidade || ''
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
                const idn = parseFloat(s && (s.originalId || s.id));
                const keyedRecordBias = s && String(s.id || '') === String(s.originalId || '') ? 0.5 : 0;
                if (!isNaN(idn)) return idn + keyedRecordBias;
                return keyedRecordBias;
            };
            state.species.sort((a, b) => parseTime(b) - parseTime(a));
            const seenSpecies = new Set();
            state.species = state.species.filter((specie) => {
                const key = (speciesTools.normalizeNameKey ? speciesTools.normalizeNameKey(getSpeciesName(specie)) : getSpeciesName(specie).normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().trim());
                const id = String(specie.firebaseKey || specie.key || specie.id || specie.originalId || '');
                const dedupeKey = key || id;
                if (!dedupeKey || seenSpecies.has(dedupeKey)) return false;
                seenSpecies.add(dedupeKey);
                return true;
            });
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
                    console.log(`  ${i + 1}. ${getSpeciesName(specie)} (ID: ${specie.id})`);
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
                <td>${escapeHtml(getSpeciesName(specie))}</td>
                <td>${escapeHtml(getSpeciesScientific(specie) || '-')}</td>
                <td style="text-align: center;">
                    <div class="btn-group">
                        <button class="action-button select-button" onclick="window.ModalEspecies.selectSpecie(${jsStringArg(getSpeciesName(specie))})" title="Selecionar Espécie">
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

        const filterText = normalizeSearchKey(filterInput.value);
        
        if (!filterText) {
            state.filteredSpecies = [...state.species];
        } else {
            state.filteredSpecies = state.species.filter(specie => {
                const nome = normalizeSearchKey(getSpeciesName(specie));
                const scientific = normalizeSearchKey(getSpeciesScientific(specie));
                const categoria = normalizeSearchKey(specie.categoria || '');
                const origem = normalizeSearchKey(specie.origem || '');
                
                return nome.includes(filterText) ||
                       scientific.includes(filterText) ||
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
        const selectedSpecie = state.species.find(s => getSpeciesName(s) === specieName);
        if (selectedSpecie) {
            window.selectedSpecies = {
                especie: getSpeciesName(selectedSpecie),
                nome: getSpeciesName(selectedSpecie),
                name: getSpeciesName(selectedSpecie), // Compatibilidade em memória
                id: selectedSpecie.id,
                nomeCientifico: getSpeciesScientific(selectedSpecie),
                scientificName: getSpeciesScientific(selectedSpecie)
            };
            console.log(`✅ window.selectedSpecies atualizado para:`, window.selectedSpecies);
        } else {
            // Fallback: criar objeto básico
            window.selectedSpecies = {
                especie: specieName,
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
        if (window.GerenciarEspecies && typeof window.GerenciarEspecies.openEditSpeciesModal === 'function') {
            window.GerenciarEspecies.openEditSpeciesModal(specieId, { returnToList: true });
        } else if (window.speciesManagerInstance && typeof window.speciesManagerInstance.editSpecies === 'function') {
            window.speciesManagerInstance.editSpecies(specieId);
        } else if (typeof window.editSpeciesFromList === 'function') {
            window.editSpeciesFromList(specieId);
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
            if (filterInput.__speciesDebouncedFilter) {
                filterInput.removeEventListener('input', filterInput.__speciesDebouncedFilter);
            }
            if (filterInput.__speciesEnterFilter) {
                filterInput.removeEventListener('keydown', filterInput.__speciesEnterFilter);
            }
            // ✅ Debounce de 300ms para reduzir re-renderizações
            let filterTimeout;
            const debouncedFilter = () => {
                clearTimeout(filterTimeout);
                filterTimeout = setTimeout(filterSpecies, 300);
            };
            const enterFilter = (e) => {
                if (e.key === 'Enter') {
                    e.preventDefault();
                    clearTimeout(filterTimeout);
                    filterSpecies();
                }
            };
            filterInput.__speciesDebouncedFilter = debouncedFilter;
            filterInput.__speciesEnterFilter = enterFilter;
            filterInput.addEventListener('input', debouncedFilter);
            // Enter aplica imediatamente
            filterInput.addEventListener('keydown', enterFilter);
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
            const modal = document.getElementById(CONFIG.modalId);
            if (!modal || modal.style.display === 'none') return;
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
                <td>${escapeHtml(getSpeciesName(specie))}</td>
                <td>${escapeHtml(getSpeciesScientific(specie) || '-')}</td>
                <td style="text-align: center;">
                    <div class="btn-group">
                        <button class="action-button select-button" onclick="window.ModalEspecies.selectSpecie(${jsStringArg(getSpeciesName(specie))})" title="Selecionar Espécie">
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
