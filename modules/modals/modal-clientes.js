/**
 * 👥 MÓDULO: Modal de Clientes - Romaneio TL
 * 
 * Responsabilidades:
 * - Gerenciar modal de lista de clientes
 * - Paginação e filtros
 * - Integração com Firebase
 * - Compatibilidade com sistema padronizado
 * 
 * ✅ ESTRUTURA MODULAR: Seguindo romaneiotl-estruturaçãomodular.txt
 * ✅ FIREBASE PRIORITY: Firebase primeiro, localStorage como fallback
 */

window.ModalClientes = (function() {
    'use strict';

    // ✅ CONFIGURAÇÕES
    const CONFIG = {
        modalId: 'clientListModal',
        tableId: 'clientListTable',
        filterId: 'clientListFilter',
        paginationId: 'clientListPagination',
        itemsPerPage: 4,
        pageKey: 'clientes'
    };

    /**
     * ✅ ITENS POR PÁGINA - sincronizado com RomaneioListColumns (persistência por tenant/usuário)
     */
    function getItemsPerPage() {
        if (window.RomaneioListColumns && typeof window.RomaneioListColumns.getPageSize === 'function') {
            return window.RomaneioListColumns.getPageSize(CONFIG.pageKey, CONFIG.itemsPerPage);
        }
        return CONFIG.itemsPerPage;
    }

    // ✅ ESTADO DO MODAL
    let state = {
        currentPage: 1,
        clients: [],
        filteredClients: [],
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
        if (/^companies\//.test(base)) return base;
        return null;
    }

    function readLocalArray(bases) {
        const list = Array.isArray(bases) ? bases : [bases];
        for (const base of list) {
            const nsKey = resolveStorageKey(base);
            if (!nsKey || !/^companies\//.test(String(nsKey))) continue;
            try {
                const rawNs = localStorage.getItem(nsKey);
                if (rawNs) {
                    const parsed = JSON.parse(rawNs);
                    if (Array.isArray(parsed)) return parsed;
                }
            } catch (_) {}
        }
        return [];
    }

    /**
     * ✅ ABRIR MODAL DE LISTA DE CLIENTES
     */
    async function openModal() {
        console.log('👥 Abrindo modal de lista de clientes...');
        
        try {
            const modal = document.getElementById(CONFIG.modalId);
            if (!modal) {
                console.error('❌ Modal de clientes não encontrado no DOM');
                return;
            }

            // Exibir modal
            modal.style.display = 'block';
            
            // Carregar dados
            await loadClients();
            
            // Renderizar lista
            renderClientList();
            renderPagination();
            
            // Configurar eventos
            setupEventListeners();

            const filterInput = document.getElementById(CONFIG.filterId);
            if (filterInput) {
                setTimeout(() => {
                    filterInput.focus();
                }, 300);
            }
            
            console.log('✅ Modal de clientes aberto com sucesso');
            
        } catch (error) {
            console.error('❌ Erro ao abrir modal de clientes:', error);
            showError('Erro ao carregar lista de clientes');
        }
    }

    /**
     * ✅ CARREGAR CLIENTES DO FIREBASE
     */
    async function loadClients() {
        console.log('📂 Carregando clientes do Firebase...');
        
        state.isLoading = true;
        updateLoadingState();
        
        try {
            let clients = [];
            
            // Tentar carregar do Firebase primeiro
            if (window.clientService && typeof window.clientService.getClients === 'function') {
                try {
                    clients = await window.clientService.getClients(false);
                    console.log(`✅ ${clients.length} clientes carregados via clientService`);
                } catch (serviceError) {
                    console.warn('⚠️ Erro ao carregar via clientService:', serviceError);
                    clients = [];
                }
            } else if (window.FirebaseService) {
                try {
                    const firebaseClients = await window.FirebaseService.loadData('clients') || {};
                    console.log(`🔍 DEBUG: Estrutura Firebase clients:`, {
                        type: typeof firebaseClients,
                        keys: Object.keys(firebaseClients),
                        keysCount: Object.keys(firebaseClients).length,
                        sampleData: Object.values(firebaseClients).slice(0, 2)
                    });
                    
                    // Converter objeto Firebase para array
                    clients = Object.keys(firebaseClients).map(key => {
                        const clientData = firebaseClients[key];
                        return {
                            id: key,
                            ...clientData
                        };
                    });
                    
                    console.log(`✅ ${clients.length} clientes carregados do Firebase`);
                    console.log(`🔍 DEBUG: Primeiros 3 clientes:`, clients.slice(0, 3));
                } catch (firebaseError) {
                    console.warn('⚠️ Erro ao carregar do Firebase:', firebaseError);
                    
                    // Fallback para localStorage
                    const localClients = readLocalArray(['clientes', 'clients']);
                    clients = localClients;
                    console.log(`⚠️ ${clients.length} clientes carregados do localStorage (fallback)`);
                }
            } else {
                // Apenas localStorage se Firebase não estiver disponível
                const localClients = readLocalArray(['clientes', 'clients']);
                clients = localClients;
                console.log(`📦 ${clients.length} clientes carregados do localStorage`);
            }
            
            // Normalizar dados para compatibilidade sem descartar campos fiscais.
            state.clients = clients.map(client => {
                const documento = client.documento || client.document || client.cnpj || client.cpf || '';
                const inscricaoEstadual = client.inscricaoEstadual || client.stateRegistration || client.ie || '';
                const inscricaoMunicipal = client.inscricaoMunicipal || client.municipalRegistration || client.im || '';
                const indIEDest = client.indIEDest || client.indicadorInscricaoEstadual || client.ieIndicator || '';
                const codigoMunicipio = client.codigoMunicipio || client.municipioCodigo || client.municipalityCode || client.cMun || client.ibgeCode || '';
                const paisCodigo = client.paisCodigo || client.countryCode || client.cPais || '1058';
                const pais = client.pais || client.country || client.countryName || client.xPais || 'Brasil';
                return {
                    ...client,
                    id: client.id || `CLIENT_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
                    nome: client.nome || client.name || 'Nome não informado',
                    name: client.nome || client.name || 'Nome não informado', // Compatibilidade
                    documento,
                    document: documento,
                    cnpj: documento,
                    tipoPessoa: client.tipoPessoa || client.personType || client.fiscalPersonType || '',
                    personType: client.tipoPessoa || client.personType || client.fiscalPersonType || '',
                    inscricaoEstadual,
                    stateRegistration: inscricaoEstadual,
                    inscricaoMunicipal,
                    municipalRegistration: inscricaoMunicipal,
                    indIEDest,
                    indicadorInscricaoEstadual: indIEDest,
                    ieIndicator: indIEDest,
                    suframa: client.suframa || '',
                    cep: client.cep || client.postalCode || '',
                    postalCode: client.cep || client.postalCode || '',
                    cidade: client.cidade || client.city || '',
                    city: client.cidade || client.city || '', // Compatibilidade
                    estado: client.estado || client.state || '',
                    state: client.estado || client.state || '', // Compatibilidade
                    telefone: client.telefone || client.phone || '',
                    phone: client.telefone || client.phone || '', // Compatibilidade
                    email: client.email || '',
                    endereco: client.endereco || client.address || '',
                    address: client.endereco || client.address || '', // Compatibilidade
                    numero: client.numero || client.number || '',
                    number: client.numero || client.number || '',
                    bairro: client.bairro || client.neighborhood || '',
                    neighborhood: client.bairro || client.neighborhood || '',
                    complemento: client.complemento || client.complement || '',
                    complement: client.complemento || client.complement || '',
                    codigoMunicipio,
                    municipioCodigo: codigoMunicipio,
                    municipalityCode: codigoMunicipio,
                    cMun: codigoMunicipio,
                    ibgeCode: codigoMunicipio,
                    paisCodigo,
                    countryCode: paisCodigo,
                    cPais: paisCodigo,
                    pais,
                    country: pais,
                    countryName: pais,
                    xPais: pais
                };
            });
            
            state.filteredClients = [...state.clients];
            state.currentPage = 1;
            
            console.log(`✅ ${state.clients.length} clientes processados e normalizados`);
            
        } catch (error) {
            console.error('❌ Erro ao carregar clientes:', error);
            state.clients = [];
            state.filteredClients = [];
            showError('Erro ao carregar dados dos clientes');
        } finally {
            state.isLoading = false;
            updateLoadingState();
        }
    }

    /**
     * ✅ RENDERIZAR LISTA DE CLIENTES
     */
    function renderClientList() {
        const tbody = document.getElementById(CONFIG.tableId);
        if (!tbody) {
            console.error('❌ Tabela de clientes não encontrada');
            return;
        }

        // Calcular itens da página atual
        const itemsPerPage = getItemsPerPage();
        const startIndex = (state.currentPage - 1) * itemsPerPage;
        const endIndex = startIndex + itemsPerPage;
        const clientsToShow = state.filteredClients.slice(startIndex, endIndex);

        if (state.isLoading) {
            tbody.innerHTML = `
                <tr>
                    <td colspan="6" style="text-align: center; padding: 20px;">
                        <i class="fas fa-spinner fa-spin"></i> Carregando clientes...
                    </td>
                </tr>
            `;
            return;
        }

        if (clientsToShow.length === 0) {
            tbody.innerHTML = `
                <tr>
                    <td colspan="6" style="text-align: center; padding: 20px; color: #666;">
                        <i class="fas fa-users"></i><br>
                        ${state.filteredClients.length === 0 ? 'Nenhum cliente cadastrado' : 'Nenhum cliente encontrado com os filtros aplicados'}
                    </td>
                </tr>
            `;
            return;
        }

        tbody.innerHTML = clientsToShow.map(client => `
            <tr>
                <td data-label="Nome">${client.nome}</td>
                <td data-label="Cidade">${client.cidade}</td>
                <td data-label="Estado">${client.estado}</td>
                <td data-label="Telefone">${client.telefone}</td>
                <td data-label="Email">${client.email}</td>
                <td data-label="Ações" style="text-align: center;">
                    <div class="btn-group">
                        <button class="action-button select-button" onclick="window.ModalClientes.selectClient('${client.id}')" title="Selecionar Cliente">
                            <i class="fas fa-check"></i>
                        </button>
                        <button class="action-button edit-button" onclick="window.ModalClientes.editClient('${client.id}')" title="Editar Cliente">
                            <i class="fas fa-edit"></i>
                        </button>
                        <button class="action-button delete-button" onclick="window.ModalClientes.deleteClient('${client.id}', '${client.nome || client.name}')" title="Excluir Cliente">
                            <i class="fas fa-trash"></i>
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

        // ✅ PADRONIZAÇÃO: Usar a barra centralizada de RomaneioListColumns (Exibir/Densidade/paginação)
        if (window.RomaneioListColumns && typeof window.RomaneioListColumns.renderPaginationBar === 'function') {
            container.style.display = 'flex';
            window.RomaneioListColumns.renderPaginationBar(container, {
                totalItems: state.filteredClients.length,
                currentPage: state.currentPage,
                pageSize: getItemsPerPage(),
                pageKey: CONFIG.pageKey,
                onPageChange: (newPage) => goToPage(newPage),
                onPageSizeChange: (newSize) => {
                    CONFIG.itemsPerPage = newSize;
                    state.currentPage = 1;
                    renderClientList();
                    renderPagination();
                },
                onDensityChange: () => {}
            });
            return;
        }

        const itemsPerPage = getItemsPerPage();
        const totalPages = Math.ceil(state.filteredClients.length / itemsPerPage);

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
        renderClientList();
        renderPagination();
    }

    /**
     * ✅ FILTRAR CLIENTES
     */
    function filterClients() {
        const filterInput = document.getElementById(CONFIG.filterId);
        if (!filterInput) return;

        const filterText = filterInput.value.toLowerCase().trim();
        
        if (!filterText) {
            state.filteredClients = [...state.clients];
        } else {
            state.filteredClients = state.clients.filter(client => {
                const nome = (client.nome || '').toLowerCase();
                const cidade = (client.cidade || '').toLowerCase();
                const estado = (client.estado || '').toLowerCase();
                const telefone = (client.telefone || '').toLowerCase();
                const email = (client.email || '').toLowerCase();
                
                return nome.includes(filterText) || 
                       cidade.includes(filterText) || 
                       estado.includes(filterText) || 
                       telefone.includes(filterText) || 
                       email.includes(filterText);
            });
        }

        state.currentPage = 1;
        renderClientList();
        renderPagination();
    }

    /**
     * ✅ SELECIONAR CLIENTE
     */
    function selectClient(clientId) {
        console.log(`✅ Selecionando cliente: ${clientId}`);
        
        const client = state.clients.find(c => c.id === clientId);
        if (!client) {
            console.error('❌ Cliente não encontrado:', clientId);
            return;
        }

        // Preencher campo de cliente no formulário
        const clienteInput = document.getElementById('clienteInput');
        if (clienteInput) {
            let nome = client.nome || client.name || '';
            if (window.isAllCaps && window.toTitleCasePt && window.isAllCaps(nome)) {
                nome = window.toTitleCasePt(nome);
            }
            clienteInput.value = nome;
            
            // ✅ PADRONIZAÇÃO: Armazenar objeto completo para salvamento rico
            window.selectedClient = client;
            
            // Adicionar listener para limpar seleção se usuário alterar texto
            if (!clienteInput.hasAttribute('data-selection-listener')) {
                clienteInput.setAttribute('data-selection-listener', 'true');
                clienteInput.addEventListener('input', function() {
                    // Se o texto mudou, não é mais o cliente selecionado do objeto (pode ser um novo ou edição)
                    // Mantemos window.selectedClient mas marcamos como "dirty" ou limpamos?
                    // Se limparmos, perdemos o ID. Se mantivermos, podemos salvar ID errado com nome novo.
                    // Melhor estratégia: Verificar se o nome bate no momento de salvar.
                    // Mas aqui, vamos apenas garantir que a variável global esteja disponível.
                });
            }
        }

        // Fechar modal
        closeModal();
        
        // Notificar seleção
        console.log(`✅ Cliente "${client.nome}" selecionado`);
    }

    /**
     * ✅ EDITAR CLIENTE
     */
    function editClient(clientId) {
        console.log(`✏️ Editando cliente: ${clientId}`);
        
        // Fechar modal de lista
        closeModal();
        
        // Abrir modal de edição via módulo CRUD
        if (window.GerenciarClientes && window.GerenciarClientes.openEditClientModal) {
            window.GerenciarClientes.openEditClientModal(clientId);
        } else {
            console.error('❌ Módulo GerenciarClientes não disponível');
            showError('Funcionalidade de edição não disponível');
        }
    }

    /**
     * ✅ EXCLUIR CLIENTE
     */
    async function deleteClient(clientId, clientName) {
        console.log(`🗑️ Excluindo cliente: ${clientId}`);
        
        if (!confirm(`Tem certeza que deseja excluir o cliente "${clientName}"?\n\nEsta ação não pode ser desfeita.`)) {
            return;
        }

        try {
            let result = null;
            if (window.clientService && typeof window.clientService.deleteClient === 'function') {
                const ok = await window.clientService.deleteClient(clientId);
                result = { success: !!ok };
            } else if (window.FirebaseService && typeof window.FirebaseService.deleteData === 'function') {
                result = await window.FirebaseService.deleteData(`clients/${clientId}`);
            } else if (window.firebaseService && typeof window.firebaseService.removeFromFirebase === 'function') {
                result = await window.firebaseService.removeFromFirebase(`clients/${clientId}`);
            } else {
                showError('Serviço de armazenamento não disponível.');
                return;
            }
            
            if (result.success) {
                console.log(`✅ Cliente "${clientName}" excluído com sucesso do Firebase`);
                
                // Também remover do localStorage
                try {
                    const purgeBy = (arr) => arr.filter(x => String(x && x.id) !== String(clientId));
                    const keys = ['clients','clientesPct','clientes'];
                    keys.forEach(k => {
                        const nsKey = resolveStorageKey(k);
                        const storageKeys = [nsKey, k].filter((value, index, self) => value && self.indexOf(value) === index);
                        storageKeys.forEach(storageKey => {
                            const s = localStorage.getItem(storageKey);
                            if (s && s.trim() !== '') {
                                const a = JSON.parse(s);
                                if (Array.isArray(a)) localStorage.setItem(storageKey, JSON.stringify(purgeBy(a)));
                            }
                        });
                    });
                    console.log(`✅ Cliente removido de localStorage (todas as chaves conhecidas)`);
                } catch (localError) {
                    console.warn('⚠️ Erro ao remover do localStorage:', localError);
                }
                
                // Forçar limpeza do cache para garantir dados atualizados
                if (window.FirebaseService && window.FirebaseService.cache) {
                    window.FirebaseService.cache.delete('clients');
                    console.log('🧹 Cache do Firebase limpo');
                }
                
                // Recarregar lista para refletir a exclusão
                console.log('🔄 Recarregando lista após exclusão...');
                const filterInput = document.getElementById(CONFIG.filterId);
                const currentFilter = filterInput ? filterInput.value : '';
                await refresh(currentFilter);
                
                showSuccess(`Cliente "${clientName}" excluído com sucesso.`);
                console.log(`🎉 Exclusão de cliente concluída com sucesso`);
            } else {
                throw new Error(result.error || 'Erro desconhecido');
            }
        } catch (error) {
            console.error('❌ Erro ao excluir cliente:', error);
            showError(`Erro ao excluir cliente: ${error.message}`);
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
        console.log('✅ Modal de clientes fechado');
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
            filterInput.removeEventListener('input', filterClients); // Remover listener anterior
            filterInput.addEventListener('input', filterClients);
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
        renderClientList();
    }

    /**
     * ✅ ATUALIZAR INFORMAÇÕES DO MODAL
     */
    function updateModalInfo() {
        const info = document.getElementById('clientModalInfo');
        if (info) {
            const total = state.filteredClients.length;
            info.textContent = `${total} cliente${total !== 1 ? 's' : ''} encontrado${total !== 1 ? 's' : ''}`;
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
     * ✅ MOSTRAR SUCESSO
     */
    function showSuccess(message) {
        if (window.Utils && window.Utils.showToast) {
            window.Utils.showToast(message, 'success');
        } else {
            alert('Sucesso: ' + message);
        }
    }

    /**
     * ✅ RECARREGAR DADOS (NOVO MÉTODO)
     */
    async function refresh(currentFilter) {
        console.log('🔄 TL: Recarregando dados dos clientes...');
        
        try {
            // Verificar se o modal está aberto
            const modal = document.getElementById(CONFIG.modalId);
            const isModalOpen = modal && modal.style.display === 'block';
            
            console.log(`🔍 TL: Modal está aberto? ${isModalOpen}`);
            
            // Limpar cache do FirebaseService para forçar reload
                if (window.FirebaseService && window.FirebaseService.cache) {
                    window.FirebaseService.cache.delete('clients');
            }
            
            // Recarregar dados
            await loadClients();
            // Reaplicar filtro atual, se fornecido
            if (typeof currentFilter === 'string') {
                const filterInput = document.getElementById(CONFIG.filterId);
                if (filterInput) filterInput.value = currentFilter;
                filterClients();
            }
            
            // Re-renderizar interface APENAS se o modal estiver aberto
            if (isModalOpen) {
                renderClientList();
                renderPagination();
                updateModalInfo();
                console.log('✅ TL: Interface atualizada (modal estava aberto)');
            } else {
                console.log('⏩ TL: Interface NÃO atualizada (modal estava fechado)');
            }
            
            console.log('✅ TL: Dados dos clientes recarregados com sucesso');
            
        } catch (error) {
            console.error('❌ TL: Erro ao recarregar dados:', error);
            showError('Erro ao recarregar lista de clientes');
        }
    }

    // ✅ INTERFACE PÚBLICA
    return {
        openModal,
        closeModal,
        selectClient,
        editClient,
        deleteClient,
        refresh, // ✅ ADICIONADO: Método refresh
        loadClients
    };

})();

// ✅ FUNÇÕES GLOBAIS PARA COMPATIBILIDADE
window.openClientListModal = window.ModalClientes.openModal;
window.selectClient = window.ModalClientes.selectClient;
window.refreshStandardizedClientList = window.ModalClientes.refresh;

// 📡 Atualizar lista quando houver evento de clientes atualizados (com throttle)
window.addEventListener('clients:updated', async function(e) {
    try {
        if (!window.__tlClientsRefreshTimer) {
            window.__tlClientsRefreshTimer = setTimeout(async () => {
                window.__tlClientsRefreshTimer = null;
                if (window.ModalClientes && typeof window.ModalClientes.refresh === 'function') {
                    await window.ModalClientes.refresh();
                    console.log('📡 TL: Lista de clientes atualizada via evento clients:updated');
                }
            }, 300);
        }
    } catch (err) {
        console.warn('⚠️ TL: Falha ao atualizar lista de clientes via evento:', err);
    }
});

console.log('✅ Módulo ModalClientes carregado com sucesso');
