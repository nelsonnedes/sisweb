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

    function writeLocalArray(base, list) {
        const nsKey = resolveStorageKey(base);
        localStorage.setItem(nsKey, JSON.stringify(list));
    }

    /**
     * ✅ ABRIR MODAL DE NOVA ESPÉCIE
     */
    function openNewSpeciesModal() {
        console.log('🌿 Abrindo modal de nova espécie...');
        
        try {
            // ✅ Fechar lista de espécies se estiver aberta (padronização UX)
            const listModal = document.getElementById('speciesListModal');
            if (listModal && (listModal.style.display === 'block' || listModal.style.display === 'flex')) {
                listModal.style.display = 'none';
                console.log('✅ Lista de Espécies fechada automaticamente ao abrir "Nova Espécie"');
            }
            // Resetar modo de edição
            editingSpeciesId = null;
            
            // Criar ou obter modal
            const modal = criarOuObterModal();
            
            // Configurar para nova espécie
            configurarModalNovaEspecie(modal);
            
            // Exibir modal
            modal.style.display = 'block';
            
            // Focar no primeiro campo
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
    async function openEditSpeciesModal(speciesId) {
        console.log(`✏️ Abrindo modal de edição para espécie: ${speciesId}`);
        
        try {
            // Definir modo de edição
            editingSpeciesId = speciesId;
            
            // Criar ou obter modal
            const modal = criarOuObterModal();
            
            // Configurar para edição
            configurarModalEdicaoEspecie(modal);
            
            // Carregar dados da espécie
            const especie = await carregarDadosEspecie(speciesId);
            if (!especie) {
                mostrarErro('Espécie não encontrada');
                return;
            }
            
            // Preencher campos
            preencherCamposModal(modal, especie);
            
            // Exibir modal
            modal.style.display = 'block';
            
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
            modal.className = 'modal';
            modal.innerHTML = criarHtmlModal();
            document.body.appendChild(modal);
            
            // Configurar eventos
            configurarEventosModal(modal);
        }
        
        return modal;
    }

    /**
     * ✅ CRIAR HTML DO MODAL
     */
    function criarHtmlModal() {
        return `
            <div class="modal-content">
                <div class="modal-header">
                    <h2 id="modalTitle">Nova Espécie</h2>
                    <span class="close" onclick="window.GerenciarEspecies.closeModal()">&times;</span>
                </div>
                <div class="modal-body">
                    <form id="speciesForm">
                        <div class="form-group">
                            <label for="speciesName">Nome da Espécie *</label>
                            <input type="text" id="speciesName" required>
                        </div>
                        
                        <div class="form-row">
                            <div class="form-group">
                                <label for="speciesCategory">Categoria</label>
                                <select id="speciesCategory">
                                    <option value="">Selecione uma categoria</option>
                                    <option value="Madeira Nobre">Madeira Nobre</option>
                                    <option value="Madeira Comum">Madeira Comum</option>
                                    <option value="Madeira Exótica">Madeira Exótica</option>
                                    <option value="Madeira de Lei">Madeira de Lei</option>
                                    <option value="Compensado">Compensado</option>
                                    <option value="MDF">MDF</option>
                                    <option value="Outros">Outros</option>
                                </select>
                            </div>
                            <div class="form-group">
                                <label for="speciesPrice">Preço (R$/m³)</label>
                                <input type="text" id="speciesPrice" placeholder="R$ 0,00">
                            </div>
                        </div>
                        
                        <div class="form-group">
                            <label for="speciesDescription">Descrição</label>
                            <textarea id="speciesDescription" rows="3" placeholder="Descrição da espécie (opcional)"></textarea>
                        </div>
                        
                        <input type="hidden" id="speciesId">
                    </form>
                </div>
                <div class="modal-footer">
                    <button type="button" class="btn-secondary" onclick="window.GerenciarEspecies.closeModal()">
                        Cancelar
                    </button>
                    <button type="button" class="btn-primary" onclick="window.GerenciarEspecies.saveSpecies()">
                        <span id="saveButtonText">Salvar</span>
                    </button>
                </div>
            </div>
        `;
    }

    /**
     * ✅ CONFIGURAR MODAL PARA NOVA ESPÉCIE
     */
    function configurarModalNovaEspecie(modal) {
        const title = modal.querySelector('#modalTitle');
        const saveButtonText = modal.querySelector('#saveButtonText');
        
        if (title) title.textContent = 'Nova Espécie';
        if (saveButtonText) saveButtonText.textContent = 'Salvar';
        
        // Limpar campos
        limparCamposModal(modal);
    }

    /**
     * ✅ CONFIGURAR MODAL PARA EDIÇÃO
     */
    function configurarModalEdicaoEspecie(modal) {
        const title = modal.querySelector('#modalTitle');
        const saveButtonText = modal.querySelector('#saveButtonText');
        
        if (title) title.textContent = 'Editar Espécie';
        if (saveButtonText) saveButtonText.textContent = 'Atualizar';
    }

    /**
     * ✅ CARREGAR DADOS DA ESPÉCIE
     */
    async function carregarDadosEspecie(speciesId) {
        console.log(`📂 Carregando dados da espécie: ${speciesId}`);
        
        try {
            let especie = null;
            
            // Tentar carregar do Firebase primeiro
            if (window.FirebaseService) {
                try {
                    const firebaseSpecies = await window.FirebaseService.loadData('species') || {};
                    especie = firebaseSpecies[speciesId];
                    
                    if (!especie) {
                        const speciesArray = Object.keys(firebaseSpecies).map(key => ({
                            id: key,
                            ...firebaseSpecies[key]
                        }));
                        
                        especie = speciesArray.find(s => 
                            s.id === speciesId || 
                            s.id === speciesId.toString()
                        );
                    }
                    
                    if (especie) {
                        console.log(`✅ Espécie encontrada no Firebase:`, especie);
                    }
                    
                } catch (firebaseError) {
                    console.warn('⚠️ Erro ao carregar do Firebase:', firebaseError);
                }
            }
            
            // Fallback para localStorage
            if (!especie) {
                try {
                    const localSpecies = readLocalArray('species');
                    especie = localSpecies.find(s => 
                        s.id === speciesId || 
                        s.id === speciesId.toString()
                    );
                    
                    if (especie) {
                        console.log(`✅ Espécie encontrada no localStorage:`, especie);
                    }
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
            speciesName: especie.nome || especie.name || '',
            speciesCategory: especie.categoria || especie.category || '',
            speciesPrice: especie.preco || especie.price || '',
            speciesDescription: especie.descricao || especie.description || '',
            speciesId: especie.id || ''
        };
        
        Object.keys(mapeamento).forEach(fieldId => {
            const field = modal.querySelector(`#${fieldId}`);
            if (field) {
                field.value = mapeamento[fieldId];
                console.log(`✅ Campo ${fieldId} preenchido com: "${mapeamento[fieldId]}"`);
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
        // Fechar ao clicar fora
        window.onclick = (event) => {
            if (event.target === modal) {
                fecharModal();
            }
        };
        
        // Enter para salvar
        modal.addEventListener('keydown', (event) => {
            if (event.key === 'Enter' && !event.shiftKey) {
                event.preventDefault();
                salvarEspecie();
            }
        });
        
        // Formatação do preço
        const priceInput = modal.querySelector('#speciesPrice');
        if (priceInput) {
            priceInput.addEventListener('input', function() {
                if (window.FormatacaoCampos && window.FormatacaoCampos.formatarInputMoeda) {
                    window.FormatacaoCampos.formatarInputMoeda(this);
                }
            });
        }
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
            // Coletar dados do formulário
            const dadosEspecie = coletarDadosFormulario();
            
            if (!dadosEspecie) {
                isProcessing = false;
                return;
            }
            
            // Preparar dados para salvamento
            const especieCompleta = prepararDadosSalvamento(dadosEspecie);
            
            // Executar salvamento
            const resultado = await executarSalvamento(especieCompleta);
            
            if (resultado.success) {
                notificarSucesso(especieCompleta, editingSpeciesId !== null);
                // ✅ Preencher automaticamente o campo especieInput se existir
                const especieInput = document.getElementById('especieInput');
                if (especieInput) {
                    especieInput.value = especieCompleta.nome;
                    especieInput.dispatchEvent(new Event('input', { bubbles: true }));
                    especieInput.dispatchEvent(new Event('change', { bubbles: true }));
                    console.log(`✅ Campo especieInput preenchido com "${especieCompleta.nome}"`);
                }
                // ✅ Disparar evento global para atualização das listas com throttle
                try { window.dispatchEvent(new CustomEvent('species:updated', { detail: { id: especieCompleta.id, nome: especieCompleta.nome } })); } catch {}
                fecharModal();
                
                // Recarregar lista de espécies se estiver aberta
                if (window.ModalEspecies && window.ModalEspecies.refresh) {
                    console.log('🔄 Recarregando lista de espécies...');
                    await window.ModalEspecies.refresh();
                }
            } else {
                mostrarErro(resultado.error || 'Erro desconhecido ao salvar espécie');
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
            id: document.getElementById('speciesId')?.value || '',
            nome: document.getElementById('speciesName')?.value?.trim() || '',
            categoria: document.getElementById('speciesCategory')?.value || '',
            preco: document.getElementById('speciesPrice')?.value?.trim() || '',
            descricao: document.getElementById('speciesDescription')?.value?.trim() || ''
        };
        
        console.log(`📝 Dados coletados do formulário:`, campos);
        
        // Validar campos obrigatórios
        if (!campos.nome) {
            mostrarErro('Nome da espécie é obrigatório');
            return null;
        }
        
        return campos;
    }

    /**
     * ✅ PREPARAR DADOS PARA SALVAMENTO
     */
    function prepararDadosSalvamento(dados) {
        const agora = new Date().toISOString();
        const companyId = resolveCompanyId();
        
        // Determinar ID da espécie
        let especieId;
        if (editingSpeciesId) {
            especieId = editingSpeciesId;
            console.log(`🔄 Atualizando espécie existente: ${especieId}`);
        } else if (dados.id) {
            especieId = dados.id;
            console.log(`🔄 Usando ID do formulário: ${especieId}`);
        } else {
            especieId = gerarIdEspecie();
            console.log(`🆕 Criando nova espécie: ${especieId}`);
        }
        
        // Criar objeto espécie completo
        const especie = {
            id: especieId,
            nome: dados.nome,
            name: dados.nome, // Compatibilidade
            categoria: dados.categoria,
            category: dados.categoria, // Compatibilidade
            preco: dados.preco,
            price: dados.preco, // Compatibilidade
            descricao: dados.descricao,
            description: dados.descricao, // Compatibilidade
            timestamp: agora,
            lastModified: agora,
            companyId: companyId || undefined
        };
        
        console.log(`📦 Espécie preparada para salvamento:`, especie);
        return especie;
    }

    /**
     * ✅ EXECUTAR SALVAMENTO
     */
    async function executarSalvamento(especie) {
        console.log(`💾 Executando salvamento da espécie: ${especie.id}`);
        
        try {
            let resultado = null;
            
            // Tentar salvar no Firebase primeiro
            if (window.FirebaseService) {
                try {
                    console.log(`🔥 Salvando no Firebase: species/${especie.id}`);
                    const firebaseResult = await window.FirebaseService.saveData(`species/${especie.id}`, especie);
                    
                    if (firebaseResult && firebaseResult.success) {
                        console.log(`✅ Espécie salva no Firebase com sucesso:`, firebaseResult);
                        resultado = { success: true };
                    } else {
                        console.warn(`⚠️ Firebase retornou resultado inesperado:`, firebaseResult);
                        throw new Error(firebaseResult?.error || 'Resposta inválida do Firebase');
                    }
                } catch (firebaseError) {
                    console.error('❌ Erro ao salvar no Firebase:', firebaseError);
                    throw firebaseError;
                }
            } else {
                console.warn('⚠️ FirebaseService não disponível, usando localStorage');
            }
            
            // Fallback para localStorage se Firebase falhar
            if (!resultado || !resultado.success) {
                console.log(`📦 Salvando no localStorage como fallback...`);
                
                const especiesLocal = readLocalArray('species');
                const indiceExistente = especiesLocal.findIndex(e => e.id === especie.id);
                
                if (indiceExistente >= 0) {
                    especiesLocal[indiceExistente] = especie;
                    console.log(`🔄 Espécie atualizada no localStorage`);
                } else {
                    especiesLocal.push(especie);
                    console.log(`➕ Espécie adicionada ao localStorage`);
                }
                
                writeLocalArray('species', especiesLocal);
                console.log(`📦 Espécie salva no localStorage com sucesso:`, especie);
                resultado = { success: true };
            }
            
            return resultado;
            
        } catch (error) {
            console.error('❌ Erro ao executar salvamento:', error);
            return { success: false, error: error.message };
        }
    }

    /**
     * ✅ GERAR ID DA ESPÉCIE
     */
    function gerarIdEspecie() {
        return Date.now().toString();
    }

    /**
     * ✅ NOTIFICAR SUCESSO
     */
    function notificarSucesso(especie, isEdicao) {
        const acao = isEdicao ? 'atualizada' : 'cadastrada';
        const mensagem = `Espécie "${especie.nome}" ${acao} com sucesso!`;
        
        if (window.Utils && window.Utils.showToast) {
            window.Utils.showToast(mensagem, 'success');
        } else {
            alert(mensagem);
        }
        
        console.log(`✅ ${mensagem}`);
    }

    /**
     * ✅ MOSTRAR ERRO
     */
    function mostrarErro(mensagem) {
        if (window.Utils && window.Utils.showToast) {
            window.Utils.showToast(mensagem, 'error');
        } else {
            alert('Erro: ' + mensagem);
        }
        
        console.error(`❌ ${mensagem}`);
    }

    /**
     * ✅ FECHAR MODAL
     */
    function fecharModal() {
        const modal = document.getElementById(MODAL_ID);
        if (modal) {
            modal.style.display = 'none';
            limparCamposModal(modal);
        }
        
        isProcessing = false;
        editingSpeciesId = null;
        console.log('✅ Modal de espécie fechado');
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
