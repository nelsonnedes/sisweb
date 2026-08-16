/**
 * 🌿 MÓDULO: Gerenciar Espécies - Romaneio TL
 * 
 * Responsabilidades:
 * - Criar novas espécies
 * - Editar espécies existentes
 * - Validar dados de espécies
 * - Integrar com Firebase Service
 * - Modal padronizado de cadastro
 * 
 * ✅ FIREBASE PRIORITY: Firebase primeiro, localStorage como fallback
 * ✅ COMPATIBILIDADE: Funciona com sistema legado
 */

window.GerenciarEspecies = (function() {
    'use strict';

    // ✅ CONFIGURAÇÕES
    const MODAL_ID = 'speciesModal';
    let isProcessing = false;
    let editingSpeciesId = null;
    let returnToSpeciesListModal = false;
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
        return String((specie && (specie.especie || specie.nome || specie.name || specie.nomeComum)) || '').trim();
    }

    function getSpeciesScientific(specie) {
        if (speciesTools.getScientificName) return speciesTools.getScientificName(specie);
        return String((specie && (specie.nomeCientifico || specie.scientificName || specie.scientific || specie.descricao || specie.description || specie.decription)) || '').trim();
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
        const nsKey = resolveStorageKey(base);
        try {
            const rawNs = localStorage.getItem(nsKey);
            if (rawNs) {
                const parsed = JSON.parse(rawNs);
                if (Array.isArray(parsed)) return parsed;
                if (parsed && typeof parsed === 'object') {
                    return Object.keys(parsed).map(k => ({ ...parsed[k], id: k, key: k, firebaseKey: k }));
                }
            }
        } catch (_) {}
        try {
            const raw = localStorage.getItem(base);
            if (raw) {
                const parsed = JSON.parse(raw);
                if (Array.isArray(parsed)) return parsed;
                if (parsed && typeof parsed === 'object') {
                    return Object.keys(parsed).map(k => ({ ...parsed[k], id: k, key: k, firebaseKey: k }));
                }
            }
        } catch (_) {}
        return [];
    }

    function writeLocalArray(base, list) {
        const nsKey = resolveStorageKey(base);
        localStorage.setItem(nsKey, JSON.stringify(list));
    }

    function aprimorarModalEspecie(modal) {
        if (modal) modal.classList.add('species-standard-modal');
        if (window.SiswebSpeciesModal && typeof window.SiswebSpeciesModal.enhance === 'function') {
            window.SiswebSpeciesModal.enhance({
                modal,
                getSpeciesList: () => readLocalArray('especies')
            });
        }
    }

    /**
     * ✅ ABRIR MODAL DE NOVA ESPÉCIE
     */
    function openNewSpeciesModal() {
        console.log('🌿 Abrindo modal de nova espécie...');
        returnToSpeciesListModal = false;
        
        try {
            const listModal = document.getElementById('speciesListModal');
            if (listModal && (listModal.style.display === 'block' || listModal.style.display === 'flex')) {
                listModal.style.display = 'none';
                console.log('✅ Lista de Espécies fechada automaticamente ao abrir "Nova Espécie"');
            }
            editingSpeciesId = null;
            
            const modal = criarOuObterModal();
            configurarModalNovaEspecie(modal);
            aprimorarModalEspecie(modal);
            
            if (window.SiswebSpeciesModal && typeof window.SiswebSpeciesModal.showModal === 'function') {
                window.SiswebSpeciesModal.showModal(modal);
            } else {
                modal.style.display = 'flex';
                modal.setAttribute('aria-hidden', 'false');
            }
            
            setTimeout(() => {
                const nomeInput = document.getElementById('speciesName');
                if (nomeInput) nomeInput.focus();
            }, 100);
            
            console.log('✅ Modal de nova espécie aberto');
            
        } catch (error) {
            console.error('❌ Erro ao abrir modal de nova espécie:', error);
            mostrarErro('Erro ao abrir cadastro de espécie');
        }
    }

    /**
     * ✅ ABRIR MODAL DE EDIÇÃO DE ESPÉCIE
     */
    async function openEditSpeciesModal(speciesId, options = {}) {
        console.log(`✏️ Abrindo modal de edição para espécie: ${speciesId}`);
        returnToSpeciesListModal = Boolean(options && options.returnToList);
        
        try {
            editingSpeciesId = normalizeSpeciesId(speciesId);
            const modal = criarOuObterModal();
            configurarModalEdicaoEspecie(modal);
            
            const especie = await carregarDadosEspecie(editingSpeciesId);
            if (!especie) {
                mostrarErro('Espécie não encontrada');
                return;
            }
            
            preencherCamposModal(modal, especie);
            aprimorarModalEspecie(modal);
            
            if (window.SiswebSpeciesModal && typeof window.SiswebSpeciesModal.showModal === 'function') {
                window.SiswebSpeciesModal.showModal(modal);
            } else {
                modal.style.display = 'flex';
                modal.setAttribute('aria-hidden', 'false');
            }
            
            console.log('✅ Modal de edição de espécie aberto');
            
        } catch (error) {
            console.error('❌ Erro ao abrir modal de edição:', error);
            mostrarErro('Erro ao carregar dados da espécie');
        }
    }

    /**
     * ✅ CRIAR OU OBTER MODAL
     */
    function criarOuObterModal() {
        let modal = document.getElementById(MODAL_ID);
        
        if (!modal) {
            modal = document.createElement('div');
            modal.id = MODAL_ID;
            modal.className = 'modal species-standard-modal';
            modal.setAttribute('aria-hidden', 'true');
            modal.innerHTML = criarHtmlModal();
            document.body.appendChild(modal);
            configurarEventosModal(modal);
        }
        
        return modal;
    }

    /**
     * ✅ CRIAR HTML DO MODAL
     */
    function criarHtmlModal() {
        return `
            <div class="modal-content species-standard-modal-content">
                <div class="modal-header species-standard-header">
                    <h2 id="modalTitle" class="modal-title species-standard-title">Nova Espécie</h2>
                    <button type="button" class="close species-standard-close" onclick="window.GerenciarEspecies.closeModal()" aria-label="Fechar modal">&times;</button>
                </div>
                <div class="modal-body">
                    <form id="speciesForm" class="species-standard-form">
                        <input type="hidden" id="speciesId" name="speciesId">
                        <div class="form-group species-standard-field">
                            <label for="speciesName" class="species-standard-label">Nome da Espécie:</label>
                            <input type="text" id="speciesName" name="speciesName" class="species-standard-input" placeholder="Ex.: Ipê, Cedro, Tauari" required autocomplete="off">
                            <div id="speciesNameSuggestionsReserve" class="species-name-suggestions-reserve" aria-hidden="true"></div>
                            <div id="speciesNameDuplicateHint" class="species-duplicate-hint" aria-live="polite"></div>
                        </div>

                        <div class="form-group species-standard-field">
                            <label for="speciesDescription" class="species-standard-label">Nome Científico:</label>
                            <textarea id="speciesDescription" name="speciesDescription" class="species-standard-textarea" rows="3" placeholder="Ex.: Handroanthus albus"></textarea>
                        </div>
                    </form>
                </div>
                <div class="modal-footer species-standard-actions">
                    <button type="button" class="back-button close-modal-btn" onclick="window.GerenciarEspecies.closeModal()">
                        <i class="fas fa-times"></i> Cancelar
                    </button>
                    <button type="button" class="btn-save" onclick="window.GerenciarEspecies.saveSpecies()">
                        <i class="fas fa-save"></i> <span id="btnSaveText">Salvar Espécie</span>
                    </button>
                </div>
            </div>
        `;
    }

    /**
     * ✅ CONFIGURAR PARA NOVA ESPÉCIE
     */
    function configurarModalNovaEspecie(modal) {
        const title = modal.querySelector('#modalTitle');
        const btnSaveText = modal.querySelector('#btnSaveText');
        
        if (title) title.textContent = 'Nova Espécie';
        if (btnSaveText) btnSaveText.textContent = 'Salvar Espécie';
        
        limparCamposModal(modal);
    }

    /**
     * ✅ CONFIGURAR PARA EDIÇÃO
     */
    function configurarModalEdicaoEspecie(modal) {
        const title = modal.querySelector('#modalTitle');
        const btnSaveText = modal.querySelector('#btnSaveText');
        
        if (title) title.textContent = 'Editar Espécie';
        if (btnSaveText) btnSaveText.textContent = 'Atualizar Espécie';
    }

    /**
     * ✅ CARREGAR DADOS DA ESPÉCIE
     */
    async function carregarDadosEspecie(speciesId) {
        console.log(`🔍 Carregando dados da espécie: ${speciesId}`);
        
        try {
            let especie = null;
            
            // Prioridade Firebase
            const svc = window.FirebaseService || window.firebaseService || window.firebaseServiceTL;
            if (svc && typeof svc.loadFromFirebase === 'function') {
                try {
                    const result = await svc.loadFromFirebase('especies', { forceRefresh: true });
                    const firebaseSpecies = (result && result.success && result.data) ? result.data : result;
                    
                    const normalizeArrayItem = (item, index) => {
                        const value = item || {};
                        const key = String(index);
                        return {
                            ...value,
                            id: key,
                            key,
                            firebaseKey: key,
                            originalId: value.id || value.key || key
                        };
                    };

                    especie = Array.isArray(firebaseSpecies)
                        ? firebaseSpecies.map(normalizeArrayItem).find(s => matchesSpeciesId(s, speciesId))
                        : firebaseSpecies[speciesId];

                    if (especie && !Array.isArray(firebaseSpecies)) {
                        const item = especie || {};
                        especie = {
                            ...item,
                            id: speciesId,
                            key: speciesId,
                            firebaseKey: speciesId,
                            originalId: item.id || item.key || speciesId
                        };
                    }
                    
                    if (!especie) {
                        const speciesArray = Array.isArray(firebaseSpecies) ? firebaseSpecies.map(normalizeArrayItem) : Object.keys(firebaseSpecies || {}).map(key => {
                            const item = firebaseSpecies[key] || {};
                            return {
                                ...item,
                                id: key,
                                key,
                                firebaseKey: key,
                                originalId: item.id || item.key || key
                            };
                        });
                        
                        especie = speciesArray.find(s => matchesSpeciesId(s, speciesId));
                    }
                    
                } catch (firebaseError) {
                    console.warn('⚠️ Erro ao carregar do Firebase:', firebaseError);
                }
            }
            
            // Fallback para localStorage
            if (!especie) {
                try {
                    const localSpecies = readLocalArray('especies');
                    especie = localSpecies.find(s => matchesSpeciesId(s, speciesId));
                } catch (localError) {
                    console.error('❌ Erro ao buscar no localStorage:', localError);
                }
            }
            
            return especie;
            
        } catch (error) {
            console.error('❌ Erro ao carregar dados da espécie:', error);
            return null;
        }
    }

    /**
     * ✅ PREENCHER CAMPOS DO MODAL
     */
    function preencherCamposModal(modal, especie) {
        console.log(`📝 Preenchendo campos do modal com:`, especie);
        
        const mapeamento = {
            speciesName: getSpeciesName(especie),
            speciesDescription: getSpeciesScientific(especie),
            speciesId: getSpeciesRecordId(especie) || normalizeSpeciesId(editingSpeciesId)
        };
        
        Object.keys(mapeamento).forEach(fieldId => {
            const field = modal.querySelector(`#${fieldId}`);
            if (field) {
                field.value = mapeamento[fieldId];
            }
        });
    }

    /**
     * ✅ LIMPAR CAMPOS DO MODAL
     */
    function limparCamposModal(modal) {
        const form = modal.querySelector('#speciesForm');
        if (form) {
            form.reset();
        }
        editingSpeciesId = null;
    }

    /**
     * ✅ CONFIGURAR EVENTOS DO MODAL
     */
    function configurarEventosModal(modal) {
        window.onclick = (event) => {
            if (event.target === modal) {
                fecharModal();
            }
        };
        
        modal.addEventListener('keydown', (event) => {
            if (event.key === 'Enter' && !event.shiftKey && event.target && event.target.tagName !== 'TEXTAREA') {
                event.preventDefault();
                salvarEspecie();
            }
        });
    }

    /**
     * ✅ SALVAR ESPÉCIE
     */
    async function salvarEspecie() {
        if (isProcessing) {
            console.log('⚠️ Salvamento já em andamento...');
            return;
        }
        
        console.log('💾 Iniciando salvamento de espécie...');
        isProcessing = true;
        
        try {
            const dadosEspecie = coletarDadosFormulario();
            if (!dadosEspecie) {
                isProcessing = false;
                return;
            }
            
            const especieCompleta = prepararDadosSalvamento(dadosEspecie);
            const resultado = await executarSalvamento(especieCompleta);
            
            if (resultado && resultado.success) {
                notificarSucesso(especieCompleta, editingSpeciesId !== null);
                
                const especieInput = document.getElementById('especieInput');
                if (especieInput) {
                    especieInput.value = getSpeciesName(especieCompleta);
                    especieInput.dispatchEvent(new Event('input', { bubbles: true }));
                    especieInput.dispatchEvent(new Event('change', { bubbles: true }));
                }
                
                try {
                    window.dispatchEvent(new CustomEvent('species:updated', { detail: { id: especieCompleta.id, nome: getSpeciesName(especieCompleta) } }));
                } catch (_) {}
                
                fecharModal();
                
                if (returnToSpeciesListModal && window.ModalEspecies && typeof window.ModalEspecies.openModal === 'function') {
                    returnToSpeciesListModal = false;
                    console.log('🔄 Reabrindo lista de espécies após salvar edição...');
                    await window.ModalEspecies.openModal();
                } else if (window.ModalEspecies && typeof window.ModalEspecies.refresh === 'function') {
                    console.log('🔄 Recarregando lista de espécies...');
                    await window.ModalEspecies.refresh();
                }
            } else {
                mostrarErro(resultado?.error || 'Erro desconhecido ao salvar espécie');
            }
            
        } catch (error) {
            console.error('❌ Erro no salvamento:', error);
            mostrarErro('Erro inesperado ao salvar espécie');
        } finally {
            isProcessing = false;
        }
    }

    /**
     * ✅ COLETAR DADOS DO FORMULÁRIO
     */
    function coletarDadosFormulario() {
        const campos = {
            id: document.getElementById('speciesId')?.value || editingSpeciesId || '',
            nome: document.getElementById('speciesName')?.value?.trim() || '',
            nomeCientifico: document.getElementById('speciesDescription')?.value?.trim() || ''
        };
        
        console.log(`📝 Dados coletados do formulário:`, campos);
        
        if (!campos.nome) {
            mostrarErro('Nome da espécie é obrigatório');
            return null;
        }

        if (window.SiswebSpeciesModal && typeof window.SiswebSpeciesModal.getExactDuplicate === 'function') {
            const currentId = campos.id || editingSpeciesId;
            const duplicate = window.SiswebSpeciesModal.getExactDuplicate(campos.nome, currentId);
            if (duplicate) {
                mostrarErro(`Espécie já cadastrada: ${getSpeciesName(duplicate)}. Use o cadastro existente para evitar duplicidade.`);
                return null;
            }
        }
        
        return campos;
    }

    /**
     * ✅ PREPARAR DADOS PARA SALVAMENTO
     */
    function prepararDadosSalvamento(dados) {
        const agora = new Date().toISOString();
        const companyId = resolveCompanyId();
        
        let especieId;
        if (editingSpeciesId) {
            especieId = normalizeSpeciesId(editingSpeciesId);
            console.log(`🔄 Atualizando espécie existente: ${especieId}`);
        } else if (dados.id) {
            especieId = normalizeSpeciesId(dados.id);
            console.log(`🔄 Usando ID do formulário: ${especieId}`);
        } else {
            especieId = gerarIdEspecie();
            console.log(`🆕 Criando nova espécie: ${especieId}`);
        }
        
        const base = {
            id: especieId,
            especie: dados.nome,
            nomeCientifico: dados.nomeCientifico,
            timestamp: agora,
            lastModified: agora,
            updatedAt: agora,
            companyId: companyId || undefined
        };

        const especie = speciesTools.toCanonicalRecord
            ? speciesTools.toCanonicalRecord(base, 0, { id: especieId, updatedAt: agora })
            : base;
        
        return especie;
    }

    /**
     * ✅ EXECUTAR SALVAMENTO
     */
    async function executarSalvamento(especie) {
        console.log(`💾 Executando salvamento da espécie: ${especie.id}`);
        
        try {
            let resultado = null;
            const svc = window.FirebaseService || window.firebaseService || window.firebaseServiceTL;
            
            if (svc || window.databaseAdapter) {
                try {
                    console.log(`🔥 Salvando no Firebase: especies/${especie.id}`);
                    let firebaseResult = null;
                    if (svc && typeof svc.saveToFirebase === 'function') {
                        firebaseResult = await svc.saveToFirebase('especies', especie.id, especie);
                    } else if (svc && typeof svc.saveData === 'function') {
                        firebaseResult = await svc.saveData(`especies/${especie.id}`, especie);
                    } else if (window.databaseAdapter && typeof window.databaseAdapter.saveData === 'function') {
                        firebaseResult = await window.databaseAdapter.saveData(`especies/${especie.id}`, especie);
                    }
                    
                    if (firebaseResult && firebaseResult.success) {
                        console.log(`✅ Espécie salva no Firebase com sucesso:`, firebaseResult);
                        resultado = { success: true };
                        if (svc && typeof svc.invalidateCollectionCache === 'function') {
                            svc.invalidateCollectionCache('especies');
                        }
                        if (window.SiswebSpeciesStore && typeof window.SiswebSpeciesStore.invalidate === 'function') {
                            window.SiswebSpeciesStore.invalidate();
                        }
                    } else {
                        throw new Error(firebaseResult?.error || 'Resposta inválida do Firebase');
                    }
                } catch (firebaseError) {
                    console.error('❌ Erro ao salvar no Firebase:', firebaseError);
                    throw firebaseError;
                }
            }
            
            if (!resultado || !resultado.success) {
                console.log(`📦 Salvando no localStorage como fallback...`);
                const especiesLocal = readLocalArray('especies');
                const indiceExistente = especiesLocal.findIndex(e => matchesSpeciesId(e, especie.id));
                
                if (indiceExistente >= 0) {
                    especiesLocal[indiceExistente] = especie;
                } else {
                    especiesLocal.push(especie);
                }
                
                writeLocalArray('especies', especiesLocal);
                resultado = { success: true };
            }
            
            return resultado;
            
        } catch (error) {
            console.error('❌ Erro ao executar salvamento:', error);
            return { success: false, error: error.message };
        }
    }

    function gerarIdEspecie() {
        return Date.now().toString();
    }

    function notificarSucesso(especie, isEdicao) {
        const acao = isEdicao ? 'atualizada' : 'cadastrada';
        const mensagem = `Espécie "${getSpeciesName(especie)}" ${acao} com sucesso!`;
        
        if (window.Utils && window.Utils.showToast) {
            window.Utils.showToast(mensagem, 'success');
        } else {
            alert(mensagem);
        }
    }

    function mostrarErro(mensagem) {
        if (window.Utils && window.Utils.showToast) {
            window.Utils.showToast(mensagem, 'error');
        } else {
            alert('Erro: ' + mensagem);
        }
        console.error(`❌ ${mensagem}`);
    }

    function fecharModal() {
        const modal = document.getElementById(MODAL_ID);
        if (modal) {
            if (window.SiswebSpeciesModal && typeof window.SiswebSpeciesModal.hideModal === 'function') {
                window.SiswebSpeciesModal.hideModal(modal);
            } else {
                modal.style.display = 'none';
                modal.setAttribute('aria-hidden', 'true');
            }
            limparCamposModal(modal);
        }
        
        isProcessing = false;
        editingSpeciesId = null;
    }

    // ✅ INTERFACE PÚBLICA
    return {
        openNewSpeciesModal,
        openEditSpeciesModal,
        closeModal: fecharModal,
        saveSpecies: salvarEspecie
    };

})();

// ✅ FUNÇÕES GLOBAIS PARA COMPATIBILIDADE
window.openNewSpeciesModal = window.GerenciarEspecies.openNewSpeciesModal;
window.editSpecies = window.GerenciarEspecies.openEditSpeciesModal;

console.log('✅ Módulo GerenciarEspecies carregado com sucesso');
