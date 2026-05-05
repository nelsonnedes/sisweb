/**
 * 👥 MÓDULO: Gerenciar Clientes - Romaneio TL
 * 
 * Responsabilidades:
 * - Criar novos clientes
 * - Editar clientes existentes
 * - Validar dados de clientes
 * - Integrar com Firebase Service
 * - Modal padronizado de cadastro
 * 
 * ✅ FIREBASE PRIORITY: Firebase primeiro, localStorage como fallback
 * ✅ COMPATIBILIDADE: Funciona com sistema legado
 */

window.GerenciarClientes = (function() {
    'use strict';

    // ✅ CONFIGURAÇÕES
    const MODAL_ID = 'clientModal';
    let isProcessing = false;
    let editingClientId = null;
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

    function readLocalArray(bases) {
        const list = Array.isArray(bases) ? bases : [bases];
        for (const base of list) {
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
        }
        return [];
    }

    function writeLocalArray(base, list) {
        const nsKey = resolveStorageKey(base);
        localStorage.setItem(nsKey, JSON.stringify(list));
    }

    /**
     * ✅ ABRIR MODAL DE NOVO CLIENTE
     */
    function openNewClientModal() {
        console.log('👥 Abrindo modal de novo cliente...');
        
        try {
            // Resetar modo de edição
            editingClientId = null;
            
            // Criar ou obter modal
            const modal = criarOuObterModal();
            
            // Configurar para novo cliente
            configurarModalNovoCliente(modal);
            
            // Exibir modal
            modal.style.display = 'block';
            
            // Focar no primeiro campo
            setTimeout(() => {
                const nomeInput = document.getElementById('clientName');
                if (nomeInput) nomeInput.focus();
            }, 100);
            
            console.log('✅ Modal de novo cliente aberto');
            
        } catch (error) {
            console.error('❌ Erro ao abrir modal de novo cliente:', error);
            mostrarErro('Erro ao abrir cadastro de cliente');
        }
    }

    /**
     * ✅ ABRIR MODAL DE EDIÇÃO DE CLIENTE
     */
    async function openEditClientModal(clientId) {
        console.log(`✏️ Abrindo modal de edição para cliente: ${clientId}`);
        
        try {
            // Definir modo de edição
            editingClientId = clientId;
            
            // Criar ou obter modal
            const modal = criarOuObterModal();
            
            // Configurar para edição
            configurarModalEdicaoCliente(modal);
            
            // Carregar dados do cliente
            const cliente = await carregarDadosCliente(clientId);
            if (!cliente) {
                mostrarErro('Cliente não encontrado');
                return;
            }
            
            // Preencher campos
            await preencherCamposModal(modal, cliente);
            
            // Exibir modal
            modal.style.display = 'block';
            
            console.log('✅ Modal de edição de cliente aberto');
            
        } catch (error) {
            console.error('❌ Erro ao abrir modal de edição:', error);
            mostrarErro('Erro ao carregar dados do cliente');
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
                    <h2 id="modalTitle">Novo Cliente</h2>
                    <span class="close" onclick="window.GerenciarClientes.closeModal()">&times;</span>
                </div>
                <div class="modal-body">
                    <form id="clientForm">
                        <div class="form-row">
                            <div class="form-group">
                                <label for="clientName">Nome/Razão Social *</label>
                                <input type="text" id="clientName" required>
                            </div>
                            <div class="form-group">
                                <label for="clientPhone">Telefone</label>
                                <input type="tel" id="clientPhone">
                            </div>
                        </div>
                        
                        <div class="form-row">
                            <div class="form-group">
                                <label for="clientEmail">Email</label>
                                <input type="email" id="clientEmail">
                            </div>
                            <div class="form-group">
                                <label for="clientAddress">Endereço</label>
                                <input type="text" id="clientAddress">
                            </div>
                        </div>
                        
                        <div class="form-row">
                            <div class="form-group">
                                <label for="clientState">Estado</label>
                                <select id="clientState" onchange="carregarCidadesPorEstado(this.value)">
                                    <option value="">Selecione o estado</option>
                                </select>
                            </div>
                            <div class="form-group">
                                <label for="clientCity">Cidade</label>
                                <select id="clientCity">
                                    <option value="">Selecione primeiro o estado</option>
                                </select>
                            </div>
                        </div>
                        
                        <div class="form-group">
                            <label for="clientObservations">Observações</label>
                            <textarea id="clientObservations" rows="3"></textarea>
                        </div>
                        
                        <input type="hidden" id="clientId">
                    </form>
                </div>
                <div class="modal-footer">
                    <button type="button" class="btn-secondary" onclick="window.GerenciarClientes.closeModal()">
                        Cancelar
                    </button>
                    <button type="button" class="btn-primary" onclick="window.GerenciarClientes.saveClient()">
                        <span id="saveButtonText">Salvar</span>
                    </button>
                </div>
            </div>
        `;
    }

    /**
     * ✅ CONFIGURAR MODAL PARA NOVO CLIENTE
     */
    function configurarModalNovoCliente(modal) {
        const title = modal.querySelector('#modalTitle');
        const saveButtonText = modal.querySelector('#saveButtonText');
        
        if (title) title.textContent = 'Novo Cliente';
        if (saveButtonText) saveButtonText.textContent = 'Salvar';
        
        // Limpar campos
        limparCamposModal(modal);
        
        // Carregar estados
        if (window.popularSelectEstados) {
            window.popularSelectEstados('clientState');
        }
    }

    /**
     * ✅ CONFIGURAR MODAL PARA EDIÇÃO
     */
    async function configurarModalEdicaoCliente(modal) {
        const title = modal.querySelector('#modalTitle');
        const saveButtonText = modal.querySelector('#saveButtonText');
        
        if (title) title.textContent = 'Editar Cliente';
        if (saveButtonText) saveButtonText.textContent = 'Atualizar';
        
        // Carregar estados
        if (window.popularSelectEstados) {
            window.popularSelectEstados('clientState');
        }
    }

    /**
     * ✅ CARREGAR DADOS DO CLIENTE
     */
    async function carregarDadosCliente(clientId) {
        console.log(`📂 Carregando dados do cliente: ${clientId}`);
        console.log(`🔍 DEBUG: Tipo do clientId: ${typeof clientId}`);
        
        try {
            let cliente = null;
            
            if (window.clientService && typeof window.clientService.findClientById === 'function') {
                try {
                    cliente = await window.clientService.findClientById(clientId);
                    if (cliente) {
                        console.log(`✅ Cliente encontrado via clientService:`, cliente);
                    }
                } catch (serviceError) {
                    console.warn('⚠️ Erro ao carregar via clientService:', serviceError);
                }
            }
            
            // Tentar carregar do Firebase primeiro
            if (!cliente && window.FirebaseService) {
                try {
                    const firebaseClients = await window.FirebaseService.loadData('clients') || {};
                    console.log(`🔍 DEBUG: Estrutura Firebase:`, {
                        type: typeof firebaseClients,
                        keys: Object.keys(firebaseClients),
                        keysCount: Object.keys(firebaseClients).length,
                        targetId: clientId,
                        hasDirectKey: clientId in firebaseClients
                    });
                    
                    // Método 1: Buscar por chave direta
                    if (firebaseClients[clientId]) {
                        cliente = {
                            id: clientId,
                            ...firebaseClients[clientId]
                        };
                        console.log(`✅ Cliente encontrado por chave direta:`, cliente);
                    } 
                    // Método 2: Buscar convertendo para array com múltiplas comparações
                    else {
                        const clientsArray = Object.keys(firebaseClients).map(key => {
                            const clientData = firebaseClients[key];
                            return {
                                id: key,
                                originalKey: key,
                                ...clientData
                            };
                        });
                        
                        console.log(`🔍 DEBUG: Array de clientes criado:`, {
                            totalClients: clientsArray.length,
                            sampleIds: clientsArray.slice(0, 5).map(c => ({ id: c.id, type: typeof c.id })),
                            targetId: clientId,
                            targetType: typeof clientId
                        });
                        
                        // Buscar com diferentes critérios
                        cliente = clientsArray.find(c => {
                            return (
                                c.id === clientId ||
                                c.id === clientId.toString() ||
                                c.originalKey === clientId ||
                                c.originalKey === clientId.toString() ||
                                String(c.id) === String(clientId)
                            );
                        });
                        
                        if (cliente) {
                            console.log(`✅ Cliente encontrado no array:`, cliente);
                        } else {
                            console.log(`❌ Cliente não encontrado. Tentativas de busca:`, {
                                directKey: clientId in firebaseClients,
                                stringKey: clientId.toString() in firebaseClients,
                                availableIds: clientsArray.map(c => c.id).slice(0, 10)
                            });
                        }
                    }
                    
                } catch (firebaseError) {
                    console.warn('⚠️ Erro ao carregar do Firebase:', firebaseError);
                }
            }
            
            // Fallback para localStorage se não encontrou no Firebase
            if (!cliente) {
                try {
                    console.log('🔍 DEBUG: Buscando no localStorage...');
                    const localClients = readLocalArray(['clientes', 'clients']);
                    console.log(`🔍 DEBUG: localStorage tem ${localClients.length} clientes`);
                    
                    cliente = localClients.find(c => {
                        return (
                            c.id === clientId ||
                            c.id === clientId.toString() ||
                            String(c.id) === String(clientId)
                        );
                    });
                    
                    if (cliente) {
                        console.log(`✅ Cliente encontrado no localStorage:`, cliente);
                    } else {
                        console.log(`⚠️ Cliente ${clientId} não encontrado no localStorage`);
                        console.log(`🔍 DEBUG: IDs disponíveis no localStorage:`, localClients.map(c => c.id).slice(0, 10));
                    }
                } catch (localError) {
                    console.error('❌ Erro ao buscar no localStorage:', localError);
                }
            }
            
            return cliente;
            
        } catch (error) {
            console.error('❌ Erro ao carregar dados do cliente:', error);
            return null;
        }
    }

    /**
     * ✅ PREENCHER CAMPOS DO MODAL
     */
    async function preencherCamposModal(modal, cliente) {
        console.log(`📝 Preenchendo campos do modal com:`, cliente);
        
        // Mapear campos do cliente para compatibilidade
        const mapeamento = {
            clientName: cliente.nome || cliente.name || '',
            clientPhone: cliente.telefone || cliente.phone || '',
            clientEmail: cliente.email || '',
            clientAddress: cliente.endereco || cliente.address || '',
            clientState: cliente.estado || cliente.state || '',
            clientCity: cliente.cidade || cliente.city || '',
            clientObservations: cliente.observacoes || cliente.observations || '',
            clientId: cliente.id || ''
        };
        
        // Preencher campos
        Object.keys(mapeamento).forEach(fieldId => {
            const field = modal.querySelector(`#${fieldId}`);
            if (field) {
                field.value = mapeamento[fieldId];
                console.log(`✅ Campo ${fieldId} preenchido com: "${mapeamento[fieldId]}"`);
            }
        });
        
        // Carregar cidades se estado estiver definido
        if (mapeamento.clientState) {
            await window.carregarCidadesPorEstado(mapeamento.clientState, 'clientCity');
            
            // Aguardar um pouco para as cidades carregarem
            setTimeout(() => {
                const cidadeSelect = modal.querySelector('#clientCity');
                if (cidadeSelect && mapeamento.clientCity) {
                    cidadeSelect.value = mapeamento.clientCity;
                    console.log(`✅ Cidade selecionada: ${mapeamento.clientCity}`);
                }
            }, 500);
        }
    }

    /**
     * ✅ LIMPAR CAMPOS DO MODAL
     */
    function limparCamposModal(modal) {
        const form = modal.querySelector('#clientForm');
        if (form) {
            form.reset();
            
            // Limpar select de cidades especificamente
            const cidadeSelect = modal.querySelector('#clientCity');
            if (cidadeSelect) {
                cidadeSelect.innerHTML = '<option value="">Selecione primeiro o estado</option>';
            }
        }
        
        editingClientId = null;
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
                salvarCliente();
            }
        });
    }

    /**
     * ✅ SALVAR CLIENTE
     */
    async function salvarCliente() {
        if (isProcessing) {
            console.log('⚠️ Salvamento já em andamento...');
            return;
        }
        
        console.log('💾 Iniciando salvamento de cliente...');
        isProcessing = true;
        
        try {
            // Coletar dados do formulário
            const dadosCliente = coletarDadosFormulario();
            
            if (!dadosCliente) {
                isProcessing = false;
                return;
            }
            
            // Preparar dados para salvamento
            const clienteCompleto = prepararDadosSalvamento(dadosCliente);
            
            // Executar salvamento
            const resultado = await executarSalvamento(clienteCompleto);
            
            if (resultado.success) {
                notificarSucesso(clienteCompleto, editingClientId !== null);
                fecharModal();
                
                // Forçar limpeza do cache para garantir dados atualizados
                if (window.FirebaseService && window.FirebaseService.cache) {
                    window.FirebaseService.cache.delete('clients');
                    console.log('🧹 Cache do Firebase limpo após salvamento');
                }
                
                // Recarregar lista de clientes se estiver aberta - VERIFICAR AMBOS OS MODAIS
                let refreshExecutado = false;
                
                // Tentar refresh do modal TL primeiro
                if (window.ModalClientes && window.ModalClientes.refresh) {
                    console.log('🔄 Recarregando lista de clientes (TL) após salvamento...');
                    try {
                        await window.ModalClientes.refresh();
                        refreshExecutado = true;
                        console.log('✅ Lista de clientes (TL) atualizada com sucesso');
                    } catch (refreshError) {
                        console.warn('⚠️ Erro ao atualizar lista (TL):', refreshError);
                    }
                }
                
                // Tentar refresh do modal PCT também
                if (window.ModalClientesPCT && window.ModalClientesPCT.refresh) {
                    console.log('🔄 Recarregando lista de clientes (PCT) após salvamento...');
                    try {
                        await window.ModalClientesPCT.refresh();
                        refreshExecutado = true;
                        console.log('✅ Lista de clientes (PCT) atualizada com sucesso');
                    } catch (refreshError) {
                        console.warn('⚠️ Erro ao atualizar lista (PCT):', refreshError);
                    }
                }
                
                // Fallback para compatibilidade
                if (!refreshExecutado && window.refreshStandardizedClientList) {
                    console.log('🔄 Usando fallback refreshStandardizedClientList...');
                    window.refreshStandardizedClientList();
                } else if (!refreshExecutado) {
                    console.warn('⚠️ Nenhum método de refresh disponível');
                }
            } else {
                mostrarErro(resultado.error || 'Erro desconhecido ao salvar cliente');
            }
            
        } catch (error) {
            console.error('❌ Erro no salvamento:', error);
            mostrarErro('Erro inesperado ao salvar cliente');
        } finally {
            isProcessing = false;
        }
    }

    /**
     * ✅ COLETAR DADOS DO FORMULÁRIO
     */
    function coletarDadosFormulario() {
        const campos = {
            id: document.getElementById('clientId')?.value || '',
            nome: document.getElementById('clientName')?.value?.trim() || '',
            telefone: document.getElementById('clientPhone')?.value?.trim() || '',
            email: document.getElementById('clientEmail')?.value?.trim() || '',
            endereco: document.getElementById('clientAddress')?.value?.trim() || '',
            estado: document.getElementById('clientState')?.value || '',
            cidade: document.getElementById('clientCity')?.value || '',
            observacoes: document.getElementById('clientObservations')?.value?.trim() || ''
        };
        
        console.log(`📝 Dados coletados do formulário:`, campos);
        console.log(`🔍 ID coletado: "${campos.id}", editingClientId global: "${editingClientId}"`);
        
        // Validar campos obrigatórios
        if (!campos.nome) {
            mostrarErro('Nome/Razão Social é obrigatório');
            return null;
        }
        
        // Validar email se fornecido
        if (campos.email && !validarEmail(campos.email)) {
            mostrarErro('Email inválido');
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
        
        // Determinar ID do cliente
        let clienteId;
        if (editingClientId) {
            clienteId = editingClientId;
            console.log(`🔄 Atualizando cliente existente: ${clienteId}`);
        } else if (dados.id) {
            clienteId = dados.id;
            console.log(`🔄 Usando ID do formulário: ${clienteId}`);
        } else {
            clienteId = gerarIdCliente();
            console.log(`🆕 Criando novo cliente: ${clienteId}`);
        }
        
        console.log(`🔍 DEBUG: ID determinado para salvamento: "${clienteId}"`);
        
        // Criar objeto cliente completo
        const cliente = {
            id: clienteId,
            nome: dados.nome,
            name: dados.nome, // Compatibilidade
            telefone: dados.telefone,
            phone: dados.telefone, // Compatibilidade
            email: dados.email,
            endereco: dados.endereco,
            address: dados.endereco, // Compatibilidade
            estado: dados.estado,
            state: dados.estado, // Compatibilidade
            cidade: dados.cidade,
            city: dados.cidade, // Compatibilidade
            observacoes: dados.observacoes,
            observations: dados.observacoes, // Compatibilidade
            timestamp: agora,
            lastModified: agora,
            companyId: companyId || undefined
        };
        
        console.log(`📦 Cliente preparado para salvamento:`, cliente);
        return cliente;
    }

    /**
     * ✅ EXECUTAR SALVAMENTO
     * 🔧 CORREÇÃO CRÍTICA: Usar client-service.js para preservar todos os clientes
     */
    async function executarSalvamento(cliente) {
        console.log(`💾 Executando salvamento do cliente: ${cliente.id}`);
        
        try {
            // ✅ CORREÇÃO: Usar client-service.js (preserva todos os clientes)
            if (typeof window.saveClient === 'function') {
                console.log(`✅ Usando client-service.js para salvar cliente`);
                const savedClient = await window.saveClient(cliente);
                console.log(`✅ Cliente salvo com sucesso via client-service:`, savedClient);
                return { success: true, client: savedClient };
            }
            
            // Fallback: Usar sistema de array diretamente
            console.log(`⚠️ client-service.js não disponível, usando fallback...`);
            let resultado = null;
            
            // Tentar salvar no Firebase primeiro
            if (window.FirebaseService) {
                try {
                    // 🔧 CRÍTICO: Carregar TODOS os clientes primeiro
                    console.log(`📂 Carregando TODOS os clientes para preservação...`);
                    const todosClientes = await window.FirebaseService.loadData('clients') || {};
                    
                    // Converter para array se for objeto
                    let listaClientes = Array.isArray(todosClientes) ? todosClientes : Object.values(todosClientes);
                    
                    // Verificar se cliente já existe
                    const indiceExistente = listaClientes.findIndex(c => c.id === cliente.id);
                    
                    if (indiceExistente >= 0) {
                        // Atualizar cliente existente
                        listaClientes[indiceExistente] = cliente;
                        console.log(`🔄 Cliente atualizado na lista`);
                    } else {
                        // Adicionar novo cliente
                        listaClientes.push(cliente);
                        console.log(`➕ Cliente adicionado à lista`);
                    }
                    
                    // Salvar LISTA COMPLETA usando saveData unificado (roteia para client-service → por item)
                    console.log(`💾 Salvando LISTA COMPLETA com ${listaClientes.length} clientes (unificado)`);
                    const firebaseResult = await (typeof window.saveData === 'function'
                        ? window.saveData('clients', listaClientes)
                        : window.FirebaseService.saveData('clients', listaClientes));
                    console.log(`📊 Resultado Firebase:`, firebaseResult);
                    
                    if (firebaseResult && firebaseResult.success) {
                        console.log(`✅ Lista completa salva no Firebase com sucesso`);
                        resultado = { success: true };
                    } else {
                        console.warn(`⚠️ Firebase retornou resultado inesperado:`, firebaseResult);
                        throw new Error(firebaseResult?.error || 'Resposta inválida do Firebase');
                    }
                } catch (firebaseError) {
                    console.error('❌ Erro ao salvar no Firebase:', firebaseError);
                    throw firebaseError; // Re-throw para tentar localStorage
                }
            } else {
                console.warn('⚠️ FirebaseService não disponível, usando localStorage');
            }
            
            // Fallback para localStorage se Firebase falhar
            if (!resultado || !resultado.success) {
                console.log(`📦 Salvando no localStorage como fallback...`);
                
                const clientesLocal = readLocalArray(['clientes', 'clients']);
                const indiceExistente = clientesLocal.findIndex(c => c.id === cliente.id);
                
                if (indiceExistente >= 0) {
                    clientesLocal[indiceExistente] = cliente;
                    console.log(`🔄 Cliente atualizado no localStorage`);
                } else {
                    clientesLocal.push(cliente);
                    console.log(`➕ Cliente adicionado ao localStorage`);
                }
                
                writeLocalArray('clientes', clientesLocal);
                console.log(`📦 Cliente salvo no localStorage com sucesso:`, cliente);
                resultado = { success: true };
            }
            
            return resultado;
            
        } catch (error) {
            console.error('❌ Erro ao executar salvamento:', error);
            return { success: false, error: error.message };
        }
    }

    /**
     * ✅ GERAR ID DO CLIENTE
     */
    function gerarIdCliente() {
        return Date.now().toString();
    }

    /**
     * ✅ VALIDAR EMAIL
     */
    function validarEmail(email) {
        const regex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        return regex.test(email);
    }

    /**
     * ✅ NOTIFICAR SUCESSO
     */
    function notificarSucesso(cliente, isEdicao) {
        const acao = isEdicao ? 'atualizado' : 'cadastrado';
        const mensagem = `Cliente "${cliente.nome}" ${acao} com sucesso!`;
        
        if (window.Utils && window.Utils.showToast) {
            window.Utils.showToast(mensagem, 'success');
        } else {
            alert(mensagem);
        }
        
        console.log(`✅ ${mensagem}`);
        try {
            window.dispatchEvent(new CustomEvent('clients:updated', { detail: { client: cliente, isEdicao } }));
        } catch (_) {}
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
        editingClientId = null;
        console.log('✅ Modal de cliente fechado');
    }

    // ✅ INTERFACE PÚBLICA
    return {
        openNewClientModal,
        openEditClientModal,
        closeModal: fecharModal,
        saveClient: salvarCliente
    };

})();

// ✅ FUNÇÕES GLOBAIS PARA COMPATIBILIDADE
window.openNewClientModal = window.GerenciarClientes.openNewClientModal;
window.editClient = window.GerenciarClientes.openEditClientModal;

console.log('✅ Módulo GerenciarClientes carregado com sucesso');
