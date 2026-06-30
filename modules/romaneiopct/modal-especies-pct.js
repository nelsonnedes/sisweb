/**
 * 🌳 MÓDULO: Modal de Espécies - Romaneio PCT
 * 
 * Responsabilidades:
 * - Gerenciar modal de lista de espécies específico para PCT
 * - Paginação e filtros
 * - Integração com Firebase
 * - Compatibilidade com sistema padronizado
 * 
 * ✅ BASEADO EM: modules/modals/modal-especies.js (romaneiotl)
 * ✅ FIREBASE PRIORITY: Firebase primeiro, localStorage como fallback
 * ✅ PRESERVA: Todas as funcionalidades PCT específicas
 * 
 * 🔄 VERSÃO: 3.1 - Modal de lista padronizado EXATAMENTE igual ao ROMANEIOTL
 * 🆕 NOVIDADES: 
 *   - Modal dedicado para criação/edição (em vez de prompts)
 *   - Integração com openSpeciesCreationModal e openSpeciesEditModal
 *   - Fallbacks robustos para compatibilidade
 */

window.ModalEspeciesPCT = (function() {
    'use strict';

    function forceShowModal(modal) {
        if (!modal) return;
        try {
            if (modal.parentElement !== document.body) {
                document.body.appendChild(modal);
            }
            modal.style.setProperty('display', 'block', 'important');
            modal.style.setProperty('position', 'fixed', 'important');
            modal.style.setProperty('top', '0', 'important');
            modal.style.setProperty('left', '0', 'important');
            modal.style.setProperty('width', '100%', 'important');
            modal.style.setProperty('height', '100%', 'important');
            modal.style.setProperty('visibility', 'visible', 'important');
            modal.style.setProperty('opacity', '1', 'important');
            modal.style.setProperty('pointer-events', 'auto', 'important');
            modal.style.setProperty('z-index', '9999999', 'important');
            document.body.style.overflow = 'hidden';
        } catch (_) {}
    }

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

    function normalizeSpeciesId(value) {
        return String(value || '').trim();
    }

    function getSpeciesIdentifiers(specie) {
        return [specie && specie.id, specie && specie.key, specie && specie.firebaseKey, specie && specie.originalId]
            .map(normalizeSpeciesId)
            .filter(Boolean);
    }

    function getSpeciesRecordId(specie) {
        return normalizeSpeciesId(specie && (specie.firebaseKey || specie.key || specie.id || specie.originalId));
    }

    function matchesSpeciesId(specie, targetId) {
        const normalizedTargetId = normalizeSpeciesId(targetId);
        return Boolean(normalizedTargetId && getSpeciesIdentifiers(specie).includes(normalizedTargetId));
    }

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
            id: (specie && (specie.firebaseKey || specie.key || specie.id)) || `SPECIES_PCT_${Date.now()}_${index}`,
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

    function getLocalStorageKeys(key) {
        const keys = [];
        try {
            const base = String(key || '');
            if (!base) return keys;
            const svc = window.firebaseService || window.firebaseServiceTL || window.FirebaseService;
            if (svc && typeof svc.getNamespacedPath === 'function') {
                const ns = svc.getNamespacedPath(base);
                if (ns && ns !== base) {
                    keys.push(ns);
                    return [...new Set(keys)];
                }
            } else {
                const companyId = resolveCompanyId();
                if (companyId && !/^companies\//.test(base) && !/^users\//.test(base)) {
                    keys.push(`companies/${companyId}/${base}`);
                    return [...new Set(keys)];
                }
            }
        } catch (_) {}
        return [...new Set(keys)];
    }

    function readLocalStorageValue(key) {
        for (const k of getLocalStorageKeys(key)) {
            const val = localStorage.getItem(k);
            if (val) return val;
        }
        return null;
    }

    function writeLocalStorageValue(key, data) {
        const payload = typeof data === 'string' ? data : JSON.stringify(data);
        for (const k of getLocalStorageKeys(key)) {
            localStorage.setItem(k, payload);
        }
    }

    /**
     * ✅ ABRIR MODAL DE LISTA DE ESPÉCIES
     */
    async function openModal() {
        console.log('🌳 PCT: Abrindo modal de lista de espécies...');
        
        try {
            const modal = document.getElementById(CONFIG.modalId);
            if (!modal) {
                console.error('❌ PCT: Modal de espécies não encontrado no DOM');
                return;
            }

            // Exibir modal
            forceShowModal(modal);
            // Carregar dados
            await loadSpecies();
            
            // Renderizar lista
            renderSpeciesList();
            renderPagination();
            
            // Configurar eventos
            setupEventListeners();
            
            // ✅ FOCO AUTOMÁTICO NO CAMPO DE FILTRO
            const filterInput = document.getElementById(CONFIG.filterId);
            if (filterInput) {
                setTimeout(() => {
                    filterInput.focus();
                }, 300); // Delay para garantir que o modal esteja visível
            }
            
            console.log('✅ PCT: Modal de espécies aberto com sucesso');
            
        } catch (error) {
            console.error('❌ PCT: Erro ao abrir modal de espécies:', error);
            showError('Erro ao carregar lista de espécies');
        }
    }

    /**
     * ✅ CARREGAR ESPÉCIES DO FIREBASE
     */
    async function loadSpecies() {
        console.info('[Species] PCT modal: carregando especies.');
        
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
                console.info(`[Species] PCT modal: ${state.species.length} especies carregadas via store compartilhado.`);
                return;
            }

            let species = [];
            
            // Tentar carregar do Firebase primeiro
            if (window.firebaseService) {
                try {
                    console.log('🔍 PCT: Tentando carregar do Firebase...');
                    
                    // ✅ ESPECÍFICO PCT: Usar loadFromFirebase se disponível
                    if (typeof window.firebaseService.loadFromFirebase === 'function') {
                        console.log("🔥 PCT: Carregando espécies da coleção 'especies'...");
                        const result = await window.firebaseService.loadFromFirebase('especies');
                        console.log("✅ PCT: loadFromFirebase resultado:", result);
                        
                        if (result && result.success && result.data) {
                            const firebaseData = result.data;
                            console.log(`🔍 PCT: Dados brutos do Firebase (especies):`, firebaseData);
                            
                            // ✅ PROCESSAMENTO CORRETO
                            if (typeof firebaseData === 'object' && !Array.isArray(firebaseData)) {
                                console.log('🔍 PCT: Dados são um objeto, convertendo para array');
                                species = Object.keys(firebaseData).map(key => {
                                    const item = firebaseData[key] || {};
                                    return {
                                        ...item,
                                        id: key,
                                        key,
                                        firebaseKey: key,
                                        originalId: item.id || item.key || key
                                    };
                                }).filter(item => item && (item.especie || item.nome || item.name));
                            } else if (Array.isArray(firebaseData)) {
                                console.log('🔍 PCT: Dados são um array');
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
                            
                            console.log(`✅ PCT: ${species.length} espécies processadas do Firebase`);
                            
                        } else {
                            console.warn('⚠️ PCT: Nenhum dado encontrado no Firebase');
                            throw new Error('Dados não encontrados no Firebase');
                        }
                        
                    } else {
                        // Fallback para métodos alternativos
                        console.log('🔍 PCT: loadFromFirebase não disponível, tentando getData...');
                        
                        if (typeof window.getData === 'function') {
                            const firebaseSpecies = await window.getData('especies') || [];
                            species = Array.isArray(firebaseSpecies) ? firebaseSpecies.map((item, index) => {
                                const value = item || {};
                                const key = String(index);
                                return {
                                    ...value,
                                    id: key,
                                    key,
                                    firebaseKey: key,
                                    originalId: value.id || value.key || key
                                };
                            }) :
                                     typeof firebaseSpecies === 'object' ? Object.keys(firebaseSpecies).map(key => {
                                        const item = firebaseSpecies[key] || {};
                                        return {
                                            ...item,
                                            id: key,
                                            key,
                                            firebaseKey: key,
                                            originalId: item.id || item.key || key
                                        };
                                     }) : [];
                            console.log(`✅ PCT: ${species.length} espécies carregadas via getData`);
                        } else {
                            throw new Error('Nenhum método de carregamento Firebase disponível');
                        }
                    }
                    
                } catch (firebaseError) {
                    console.warn('⚠️ PCT: Erro ao carregar do Firebase:', firebaseError);
                    
                    // Fallback para localStorage
                    console.log('🔍 PCT: Tentando fallback para localStorage...');
                    const localSpecies = JSON.parse(readLocalStorageValue('especies') || '[]');
                    species = localSpecies;
                    console.log(`⚠️ PCT: ${species.length} espécies carregadas do localStorage (fallback)`);
                }
            } else {
                console.log('🔍 PCT: firebaseService não disponível, usando localStorage');
                // Apenas localStorage se Firebase não estiver disponível
                const localSpecies = JSON.parse(readLocalStorageValue('especies') || '[]');
                species = localSpecies;
                console.log(`📦 PCT: ${species.length} espécies carregadas do localStorage`);
            }
            
            console.log(`🔍 PCT: Total de espécies antes da normalização: ${species.length}`);

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
            
            // Normalizar dados para compatibilidade PCT
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
                
                return normalizedSpecie;
            });
            
            // ✅ ORDENAR por última atualização (prioriza updatedAt/createdAt e fallbacks)
            const parseTime = (s) => {
                const u = s && (s.updatedAt || (s._metadata && s._metadata.lastUpdated));
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
                const key = normalizeSearchKey(getSpeciesName(specie));
                const id = String(specie.firebaseKey || specie.key || specie.id || specie.originalId || '');
                const dedupeKey = key || id;
                if (!dedupeKey || seenSpecies.has(dedupeKey)) return false;
                seenSpecies.add(dedupeKey);
                return true;
            });
            state.filteredSpecies = [...state.species];
            state.currentPage = 1;
            
            console.log(`✅ PCT: ${state.species.length} espécies processadas e normalizadas`);
            console.log('🔍 PCT: Estado final das espécies:', {
                total: state.species.length,
                filtered: state.filteredSpecies.length,
                currentPage: state.currentPage,
                itemsPerPage: CONFIG.itemsPerPage
            });
            
        } catch (error) {
            console.error('❌ PCT: Erro ao carregar espécies:', error);
            state.species = [];
            state.filteredSpecies = [];
            showError('Erro ao carregar dados das espécies');
        } finally {
            state.isLoading = false;
            updateLoadingState();
            console.log('🔍 PCT: Carregamento finalizado');
        }
    }

    /**
     * ✅ RENDERIZAR LISTA DE ESPÉCIES
     */
    function renderSpeciesList() {
        const tbody = document.getElementById(CONFIG.tableId);
        if (!tbody) {
            console.error('❌ PCT: Tabela de espécies não encontrada');
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
                        <button class="action-button select-button" onclick="window.ModalEspeciesPCT.selectSpecie(${jsStringArg(getSpeciesName(specie))})" title="Selecionar Espécie">
                            <i class="fas fa-check"></i>
                        </button>
                        <button class="action-button edit-button" onclick="window.ModalEspeciesPCT.editSpecie('${specie.id}')" title="Editar Espécie">
                            <i class="fas fa-edit"></i>
                        </button>
                    </div>
                </td>
            </tr>
        `).join('');

        // ✅ REMOVIDO: Botão "Nova Espécie" dentro da tabela. Padronizado no footer.

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
     * ✅ SELECIONAR ESPÉCIE (ESPECÍFICO PCT) - CORRIGIDO PARA ATUALIZAR WINDOW.SELECTEDSPECIES
     */
    function selectSpecie(specieName) {
        console.log(`✅ PCT: Selecionando espécie: ${specieName}`);
        
        // ✅ ESPECÍFICO PCT: Preencher campo especieInput
        const especieInput = document.getElementById('especieInput');
        if (especieInput) {
            let nome = specieName || '';
            if (window.isAllCaps && window.toTitleCasePt && window.isAllCaps(nome)) {
                nome = window.toTitleCasePt(nome);
            }
            especieInput.value = nome;
            console.log(`✅ PCT: Campo especieInput preenchido com "${nome}"`);
        } else {
            console.warn('⚠️ PCT: Campo especieInput não encontrado');
        }

        // ✅ CORREÇÃO CRÍTICA: Atualizar window.selectedSpecies (consistente com TL)
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
            console.log(`✅ PCT: window.selectedSpecies atualizado para:`, window.selectedSpecies);
        } else {
            // Fallback: criar objeto básico
            window.selectedSpecies = {
                especie: specieName,
                nome: specieName,
                name: specieName
            };
            console.log(`✅ PCT: window.selectedSpecies definido (fallback) para:`, window.selectedSpecies);
        }

        // Fechar modal
        closeModal();
        
        // Notificar seleção
        console.log(`✅ PCT: Espécie "${specieName}" selecionada e window.selectedSpecies atualizado`);
        
        // ✅ ESPECÍFICO PCT: Disparar evento personalizado se necessário
        if (window.onSpeciesSelectedPCT && typeof window.onSpeciesSelectedPCT === 'function') {
            const specie = state.species.find(s => getSpeciesName(s) === specieName);
            window.onSpeciesSelectedPCT(specie);
        }
    }

    /**
     * ✅ EDITAR ESPÉCIE (Modal Padronizado - Seguindo Padrão ROMANEIOTL)
     */
    function editSpecie(specieId) {
        console.log(`✏️ PCT: Editando espécie: ${specieId}`);
        
        // Buscar espécie nos dados
        const specie = state.species.find(s => matchesSpeciesId(s, specieId));
        if (!specie) {
            console.error('❌ PCT: Espécie não encontrada:', specieId);
            showError('Espécie não encontrada');
            return;
        }
        
        console.log(`🔍 PCT: Espécie encontrada para edição:`, specie);
        console.log(`📝 PCT: Abrindo modal padronizado para editar "${getSpeciesName(specie)}"`);
        
        // ✅ PADRONIZAÇÃO: Usar modal dedicado em vez de prompt
        if (window.openSpeciesEditModal && typeof window.openSpeciesEditModal === 'function') {
            console.log('✅ PCT: Usando modal padronizado de edição');
            
            // Fechar modal de lista primeiro
            closeModal();
            
            // Abrir modal de edição com dados da espécie
            window.openSpeciesEditModal(specieId, specie);
            
        } else {
            console.warn('⚠️ PCT: Modal padronizado não disponível, usando fallback prompt');
            
            // Fallback para prompt (caso o modal não esteja disponível)
            setTimeout(() => {
                const novoNome = prompt(`🌿 EDITAR ESPÉCIE\n\nNome atual: ${getSpeciesName(specie)}\n\nDigite o novo nome:`, getSpeciesName(specie));
                
                if (novoNome === null) {
                    console.log('✅ PCT: Edição cancelada pelo usuário');
                    return;
                }
                
                if (novoNome.trim() === '') {
                    alert('❌ Nome da espécie não pode estar vazio!');
                    return;
                }
                
                if (novoNome.trim() === getSpeciesName(specie)) {
                    console.log('✅ PCT: Nenhuma alteração feita');
                    return;
                }
                
                // Salvar via função dedicada do HTML
                if (window.saveSpeciesPCT) {
                    // Simular evento de formulário
                    const fakeEvent = {
                        preventDefault: () => {},
                        target: {
                            speciesName: { value: novoNome.trim() },
                            speciesDescription: { value: getSpeciesScientific(specie) || '' }
                        }
                    };
                    window.editingSpeciesIdPCT = specieId;
                    window.saveSpeciesPCT(fakeEvent);
                    closeModal();
                }
            }, 100);
        }
    }
    
    /**
     * ✅ SALVAR ESPÉCIE EDITADA NO FIREBASE
     */
    async function salvarEspecieEditada(specie) {
        console.log(`💾 PCT: Salvando espécie editada:`, specie);
        
        try {
            const specieId = getSpeciesRecordId(specie);
            if (!specieId) {
                throw new Error('ID da espécie não encontrado para atualização');
            }

            if (window.firebaseService && typeof window.firebaseService.saveToFirebase === 'function') {
                console.log('🔥 PCT: Salvando no Firebase...');
                const companyId = resolveCompanyId();
                // CORREÇÃO: Passar ID como chave (segundo argumento) e dados como terceiro
                const payload = speciesTools.toCanonicalRecord
                    ? speciesTools.toCanonicalRecord({
                        ...specie,
                        especie: getSpeciesName(specie),
                        nomeCientifico: getSpeciesScientific(specie),
                        companyId: companyId || specie.companyId || undefined
                    }, 0, { id: specieId })
                    : {
                        ...specie,
                        id: specieId,
                        especie: getSpeciesName(specie),
                        nomeCientifico: getSpeciesScientific(specie),
                        ativo: specie.ativo !== false,
                        companyId: companyId || specie.companyId || undefined
                    };
                const result = await window.firebaseService.saveToFirebase('especies', specieId, {
                    ...payload,
                    id: specieId,
                    companyId: companyId || specie.companyId || undefined
                });
                
                if (result && result.success) {
                    console.log('✅ PCT: Espécie salva no Firebase com sucesso');
                    return result;
                } else {
                    throw new Error('Falha ao salvar no Firebase');
                }
            } else {
                // Fallback para localStorage
                console.log('📦 PCT: Salvando no localStorage...');
                const especies = JSON.parse(readLocalStorageValue('especies') || '[]');
                const index = especies.findIndex(e => matchesSpeciesId(e, specieId));
                const record = { ...specie, id: specieId };
                
                if (index >= 0) {
                    especies[index] = record;
                } else {
                    especies.push(record);
                }
                
                writeLocalStorageValue('especies', JSON.stringify(especies));
                console.log('✅ PCT: Espécie salva no localStorage');
                return { success: true };
            }
        } catch (error) {
            console.error('❌ PCT: Erro ao salvar espécie:', error);
            throw error;
        }
    }

    /**
     * ✅ FECHAR MODAL
     */
    function closeModal() {
        const modal = document.getElementById(CONFIG.modalId);
        if (modal) {
            modal.style.display = 'none';
        try { document.body.style.overflow = ''; } catch (_) {}
        }
        
        // ✅ LIMPAR CAMPO DE FILTRO AO FECHAR
        const filterInput = document.getElementById(CONFIG.filterId);
        if (filterInput) {
            filterInput.value = '';
            // Resetar filtro
            state.filteredSpecies = [...state.species];
            state.currentPage = 1;
        }
        
        console.log('✅ PCT: Modal de espécies fechado e filtro limpo');
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
            // ✅ Debounce de 300ms, e Enter aplica imediatamente
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
            filterInput.addEventListener('keydown', enterFilter);
        }

        // Botões de fechar
        const closeButtons = modal.querySelectorAll('.close-modal, .close-modal-btn');
        closeButtons.forEach(btn => {
            btn.onclick = closeModal;
        });

        // Fechar ao clicar fora
        const handleOutsideClick = (event) => {
            if (event.target === modal) {
                closeModal();
            }
        };
        
        // Remover listener antigo se existir
        if (modal._outsideClickHandler) {
            window.removeEventListener('click', modal._outsideClickHandler);
        }
        
        // Adicionar novo listener
        modal._outsideClickHandler = handleOutsideClick;
        window.addEventListener('click', handleOutsideClick);
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

    // 📡 Atualizar lista quando houver evento de espécies atualizadas (com throttle)
    window.addEventListener('species:updated', async function(e) {
        try {
            const modal = document.getElementById(CONFIG.modalId);
            if (!modal || modal.style.display === 'none') return;
            if (!window.__pctSpeciesRefreshTimer) {
                window.__pctSpeciesRefreshTimer = setTimeout(async () => {
                    window.__pctSpeciesRefreshTimer = null;
                    await refresh();
                    console.log('📡 PCT: Lista de espécies atualizada via evento species:updated');
                }, 300);
            }
        } catch (err) {
            console.warn('⚠️ PCT: Falha ao atualizar lista de espécies via evento:', err);
        }
    });

    /**
     * ✅ MOSTRAR ERRO
     */
    function showError(message) {
        if (window.Utils && window.Utils.showToast) {
            window.Utils.showToast(message, 'error');
        } else {
            console.error('PCT:', message);
            alert('Erro: ' + message);
        }
    }

    /**
     * ✅ RECARREGAR LISTA
     */
    async function refresh() {
        console.log('🔄 PCT: Recarregando lista de espécies...');
        await loadSpecies();
        renderSpeciesList();
        renderPagination();
    }

    /**
     * ✅ MOSTRAR TODAS AS ESPÉCIES (SEM PAGINAÇÃO)
     */
    function showAllSpecies() {
        console.log('📋 PCT: Mostrando todas as espécies...');
        
        const tbody = document.getElementById(CONFIG.tableId);
        if (!tbody) {
            console.error('❌ PCT: Tabela de espécies não encontrada');
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
                        <button class="action-button select-button" onclick="window.ModalEspeciesPCT.selectSpecie(${jsStringArg(getSpeciesName(specie))})" title="Selecionar Espécie">
                            <i class="fas fa-check"></i>
                        </button>
                        <button class="action-button edit-button" onclick="window.ModalEspeciesPCT.editSpecie('${specie.id}')" title="Editar Espécie">
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
        
        console.log(`✅ PCT: Todas as ${state.filteredSpecies.length} espécies exibidas`);
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

// ✅ FUNÇÕES GLOBAIS PARA COMPATIBILIDADE PCT
window.openSpeciesListModal = window.ModalEspeciesPCT.openModal;
window.selectSpecies = window.ModalEspeciesPCT.selectSpecie;
window.renderSpeciesListPCT = window.ModalEspeciesPCT.refresh;

console.log('✅ Módulo ModalEspeciesPCT carregado com sucesso');
