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
                                <label for="clientCnpj">CPF / CNPJ</label>
                                <input type="text" id="clientCnpj">
                            </div>
                            <div class="form-group">
                                <label for="clientPersonType">Tipo de pessoa</label>
                                <select id="clientPersonType">
                                    <option value="">Não informado</option>
                                    <option value="juridica">Pessoa jurídica</option>
                                    <option value="fisica">Pessoa física</option>
                                    <option value="estrangeiro">Estrangeiro</option>
                                </select>
                            </div>
                        </div>

                        <div class="form-row">
                            <div class="form-group">
                                <label for="clientIndIEDest">Indicador IE</label>
                                <select id="clientIndIEDest">
                                    <option value="">Não informado</option>
                                    <option value="1">Contribuinte ICMS</option>
                                    <option value="2">Contribuinte isento</option>
                                    <option value="9">Não contribuinte</option>
                                </select>
                            </div>
                            <div class="form-group">
                                <label for="clientStateRegistration">Inscrição Estadual</label>
                                <input type="text" id="clientStateRegistration">
                            </div>
                        </div>

                        <div class="form-row">
                            <div class="form-group">
                                <label for="clientMunicipalRegistration">Inscrição Municipal</label>
                                <input type="text" id="clientMunicipalRegistration">
                            </div>
                            <div class="form-group">
                                <label for="clientSuframa">SUFRAMA</label>
                                <input type="text" id="clientSuframa">
                            </div>
                        </div>
                        
                        <div class="form-row">
                            <div class="form-group">
                                <label for="clientEmail">Email</label>
                                <input type="email" id="clientEmail">
                            </div>
                            <div class="form-group">
                                <label for="clientCep">CEP</label>
                                <input type="text" id="clientCep">
                            </div>
                        </div>

                        <div class="form-row">
                            <div class="form-group">
                                <label for="clientAddress">Endereço</label>
                                <input type="text" id="clientAddress">
                            </div>
                            <div class="form-group">
                                <label for="clientNumber">Número</label>
                                <input type="text" id="clientNumber">
                            </div>
                        </div>

                        <div class="form-row">
                            <div class="form-group">
                                <label for="clientNeighborhood">Bairro</label>
                                <input type="text" id="clientNeighborhood">
                            </div>
                            <div class="form-group">
                                <label for="clientComplement">Complemento</label>
                                <input type="text" id="clientComplement">
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

                        <div class="form-row">
                            <div class="form-group">
                                <label for="clientMunicipalityCode">Código IBGE do município</label>
                                <input type="text" id="clientMunicipalityCode">
                            </div>
                            <div class="form-group">
                                <label for="clientCountryCode">Código do país</label>
                                <input type="text" id="clientCountryCode" value="1058">
                            </div>
                            <div class="form-group">
                                <label for="clientCountryName">País</label>
                                <input type="text" id="clientCountryName" value="Brasil">
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
                    <button type="button" class="back-button close-modal-btn" onclick="window.GerenciarClientes.closeModal()">
                        Cancelar
                    </button>
                    <button type="button" class="btn-save" onclick="window.GerenciarClientes.saveClient()">
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
            clientCnpj: cliente.documento || cliente.document || cliente.cnpj || cliente.cpf || '',
            clientPersonType: cliente.tipoPessoa || cliente.personType || cliente.fiscalPersonType || '',
            clientIndIEDest: cliente.indIEDest || cliente.indicadorInscricaoEstadual || cliente.ieIndicator || '',
            clientStateRegistration: cliente.inscricaoEstadual || cliente.stateRegistration || cliente.ie || '',
            clientMunicipalRegistration: cliente.inscricaoMunicipal || cliente.municipalRegistration || '',
            clientSuframa: cliente.suframa || '',
            clientPhone: cliente.telefone || cliente.phone || '',
            clientEmail: cliente.email || '',
            clientCep: cliente.cep || cliente.postalCode || '',
            clientAddress: cliente.endereco || cliente.address || '',
            clientNumber: cliente.numero || cliente.number || '',
            clientNeighborhood: cliente.bairro || cliente.neighborhood || '',
            clientComplement: cliente.complemento || cliente.complement || '',
            clientState: cliente.estado || cliente.state || '',
            clientCity: cliente.cidade || cliente.city || '',
            clientMunicipalityCode: cliente.codigoMunicipio || cliente.municipioCodigo || cliente.municipalityCode || cliente.cMun || cliente.ibgeCode || '',
            clientCountryCode: cliente.paisCodigo || cliente.countryCode || cliente.cPais || '1058',
            clientCountryName: cliente.pais || cliente.country || cliente.countryName || cliente.xPais || 'Brasil',
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
                
                // Preencher e selecionar automaticamente o cliente na tela principal
                try {
                    const clienteInput = document.getElementById('clienteInput') || document.getElementById('clientInput');
                    if (clienteInput) {
                        let nome = clienteCompleto.nome || clienteCompleto.name || '';
                        if (window.isAllCaps && window.toTitleCasePt && window.isAllCaps(nome)) {
                            nome = window.toTitleCasePt(nome);
                        }
                        clienteInput.value = nome;
                        clienteInput.dispatchEvent(new Event('input', { bubbles: true }));
                        clienteInput.dispatchEvent(new Event('change', { bubbles: true }));
                    }
                    window.selectedClient = clienteCompleto;
                    window.clienteSelecionado = clienteCompleto;
                } catch (selErr) {
                    console.warn('⚠️ Erro ao selecionar cliente após salvar:', selErr);
                }

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
        const documento = document.getElementById('clientCnpj')?.value?.trim() || '';
        const tipoPessoa = document.getElementById('clientPersonType')?.value || '';
        const indIEDest = document.getElementById('clientIndIEDest')?.value || '';
        const inscricaoEstadual = document.getElementById('clientStateRegistration')?.value?.trim() || '';
        const inscricaoMunicipal = document.getElementById('clientMunicipalRegistration')?.value?.trim() || '';
        const cep = document.getElementById('clientCep')?.value?.trim() || '';
        const complemento = document.getElementById('clientComplement')?.value?.trim() || '';
        const codigoMunicipio = document.getElementById('clientMunicipalityCode')?.value?.trim() || '';
        const paisCodigo = document.getElementById('clientCountryCode')?.value?.trim() || '1058';
        const pais = document.getElementById('clientCountryName')?.value?.trim() || 'Brasil';
        const campos = {
            id: document.getElementById('clientId')?.value || '',
            nome: document.getElementById('clientName')?.value?.trim() || '',
            cnpj: documento,
            documento,
            document: documento,
            tipoPessoa,
            personType: tipoPessoa,
            fiscalPersonType: tipoPessoa,
            indIEDest,
            indicadorInscricaoEstadual: indIEDest,
            ieIndicator: indIEDest,
            inscricaoEstadual,
            stateRegistration: inscricaoEstadual,
            inscricaoMunicipal,
            municipalRegistration: inscricaoMunicipal,
            suframa: document.getElementById('clientSuframa')?.value?.trim() || '',
            cep,
            postalCode: cep,
            telefone: document.getElementById('clientPhone')?.value?.trim() || '',
            email: document.getElementById('clientEmail')?.value?.trim() || '',
            endereco: document.getElementById('clientAddress')?.value?.trim() || '',
            address: document.getElementById('clientAddress')?.value?.trim() || '',
            numero: document.getElementById('clientNumber')?.value?.trim() || '',
            number: document.getElementById('clientNumber')?.value?.trim() || '',
            bairro: document.getElementById('clientNeighborhood')?.value?.trim() || '',
            neighborhood: document.getElementById('clientNeighborhood')?.value?.trim() || '',
            complemento,
            complement: complemento,
            estado: document.getElementById('clientState')?.value || '',
            cidade: document.getElementById('clientCity')?.value || '',
            codigoMunicipio,
            municipioCodigo: codigoMunicipio,
            municipalityCode: codigoMunicipio,
            cMun: codigoMunicipio,
            paisCodigo,
            countryCode: paisCodigo,
            cPais: paisCodigo,
            pais,
            country: pais,
            countryName: pais,
            xPais: pais,
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
