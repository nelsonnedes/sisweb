/**
 * 👥 MÓDULO: Modal de Clientes - Romaneio PCT
 * 
 * Responsabilidades:
 * - Gerenciar modal de lista de clientes específico para PCT
 * - Paginação e filtros
 * - Integração com Firebase
 * - Compatibilidade com sistema padronizado
 * 
 * ✅ BASEADO EM: modules/modals/modal-clientes.js (romaneiotl)
 * ✅FIREBASE PRIORITY: Firebase primeiro, localStorage como fallback
 * ✅ PRESERVA: Todas as funcionalidades PCT específicas
 * 
 * 🔄 VERSÃO: 2.1 - Conflitos de função resolvidos
 */

window.ModalClientesPCT = (function() {
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
     * ✅ ABRIR MODAL DE LISTA DE CLIENTES
     */
    async function openModal() {
        console.log('👥 PCT: Abrindo modal de lista de clientes...');
        
        try {
            const modal = document.getElementById(CONFIG.modalId);
            if (!modal) {
                console.error('❌ PCT: Modal de clientes não encontrado no DOM');
                return;
            }

            // Exibir modal
            forceShowModal(modal);
            if (typeof window.debugModalGeometry === 'function') {
                setTimeout(() => window.debugModalGeometry(CONFIG.modalId), 50);
            }
            
            // Carregar dados
            await loadClients();
            
            // Renderizar lista
            renderClientList();
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
            
            console.log('✅ PCT: Modal de clientes aberto com sucesso');
            
        } catch (error) {
            console.error('❌ PCT: Erro ao abrir modal de clientes:', error);
            showError('Erro ao carregar lista de clientes');
        }
    }

    /**
     * ✅ CARREGAR CLIENTES DO FIREBASE
     */
    async function loadClients(force = false) {
        console.log('📂 PCT: Carregando clientes do Firebase...', force ? '(Forçando atualização)' : '');
        
        state.isLoading = true;
        updateLoadingState();
        
        try {
            let clients = [];
            
            if (window.clientService && typeof window.clientService.getClients === 'function') {
                clients = await window.clientService.getClients(force);
                console.log(`✅ PCT: ${clients.length} clientes carregados via clientService`);
            } else if (window.firebaseService && typeof window.firebaseService.loadFromFirebase === 'function') {
                try {
                    console.log('🔥 PCT: Tentando carregar via firebaseService...');
                    console.log("🔥 PCT: Carregando clientes da coleção 'clients'...");
                    const result = await window.firebaseService.loadFromFirebase('clients');
                    console.log("✅ PCT: loadFromFirebase resultado:", result);
                    if (result && result.success && result.data) {
                        const firebaseData = result.data;
                        console.log(`🔍 PCT: Dados brutos do Firebase (clients):`, firebaseData);
                        if (typeof firebaseData === 'object' && !Array.isArray(firebaseData)) {
                            console.log('🔍 PCT: Dados são um objeto, convertendo para array');
                            clients = Object.keys(firebaseData).map(key => {
                                const item = firebaseData[key];
                                return { id: key, ...item };
                            }).filter(item => item && (item.nome || item.name));
                        } else if (Array.isArray(firebaseData)) {
                            console.log('🔍 PCT: Dados são um array');
                            clients = firebaseData.filter(item => item && (item.nome || item.name));
                        }
                        console.log(`✅ PCT: ${clients.length} clientes processados do Firebase`);
                    } else {
                        console.warn('⚠️ PCT: Nenhum dado encontrado no Firebase');
                        throw new Error('Dados não encontrados no Firebase');
                    }
                } catch (firebaseError) {
                    console.warn('⚠️ PCT: Erro ao carregar do Firebase:', firebaseError);
                    const parseArr = (s) => { try { const a = JSON.parse(s || '[]'); return Array.isArray(a) ? a : []; } catch(_) { return []; } };
                    const aStr = readLocalStorageValue('clients');
                    const bStr = readLocalStorageValue('clientesPct');
                    const cStr = readLocalStorageValue('clientes');
                    const combined = [].concat(parseArr(aStr), parseArr(bStr), parseArr(cStr));
                    const byId = new Map();
                    const out = [];
                    combined.forEach(item => {
                        if (!item) return;
                        const id = String(item.id || '').trim();
                        if (id && !byId.has(id)) { byId.set(id, true); out.push(item); }
                    });
                    clients = out;
                    console.log(`⚠️ PCT: ${clients.length} clientes carregados do localStorage (fallback unificado)`);
                }
            } else {
                console.log('📦 PCT: firebaseService não disponível, usando fallback unificado');
                const parseArr = (s) => { try { const a = JSON.parse(s || '[]'); return Array.isArray(a) ? a : []; } catch(_) { return []; } };
                const aStr = readLocalStorageValue('clients');
                const bStr = readLocalStorageValue('clientesPct');
                const cStr = readLocalStorageValue('clientes');
                const combined = [].concat(parseArr(aStr), parseArr(bStr), parseArr(cStr));
                const byId = new Map();
                const out = [];
                combined.forEach(item => {
                    if (!item) return;
                    const id = String(item.id || '').trim();
                    if (id && !byId.has(id)) { byId.set(id, true); out.push(item); }
                });
                clients = out;
                console.log(`📦 PCT: ${clients.length} clientes carregados do localStorage (unificado)`);
            }
            
            // Normalizar dados para compatibilidade PCT sem descartar campos fiscais.
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
                    id: client.id || `CLIENT_PCT_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
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

            const parseTime = (c) => {
                const m = c && c._metadata && c._metadata.lastUpdated;
                if (typeof m === 'number') return m;
                if (typeof m === 'string') { const t = Date.parse(m); if (!isNaN(t)) return t; }
                if (c && typeof c.updatedAt === 'number') return c.updatedAt;
                if (c && typeof c.updatedAt === 'string') { const t = Date.parse(c.updatedAt); if (!isNaN(t)) return t; }
                if (c && typeof c.createdAt === 'number') return c.createdAt;
                if (c && typeof c.createdAt === 'string') { const t = Date.parse(c.createdAt); if (!isNaN(t)) return t; }
                if (c && typeof c.timestamp === 'number') return c.timestamp;
                if (c && typeof c.timestamp === 'string') { const t = Date.parse(c.timestamp); if (!isNaN(t)) return t; }
                const idn = parseFloat(c && c.id); if (!isNaN(idn)) return idn;
                return 0;
            };

            state.clients.sort((a, b) => parseTime(b) - parseTime(a));
            state.filteredClients = [...state.clients];
            state.currentPage = 1;
            
            console.log(`✅ PCT: ${state.clients.length} clientes processados e normalizados`);
            
        } catch (error) {
            console.error('❌ PCT: Erro ao carregar clientes:', error);
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
            console.error('❌ PCT: Tabela de clientes não encontrada');
            return;
        }

        // Calcular itens da página atual
        const itemsPerPage = getItemsPerPage();
        const startIndex = (state.currentPage - 1) * itemsPerPage;
        const endIndex = startIndex + itemsPerPage;
        const clientsToShow = state.filteredClients.slice(startIndex, endIndex);

        // ✅ DEBUG CRÍTICO: Comparar dados de renderização vs seleção
        console.log(`🔍 PCT: RENDERIZAÇÃO - state.clients.length:`, state.clients?.length || 0);
        console.log(`🔍 PCT: RENDERIZAÇÃO - state.filteredClients.length:`, state.filteredClients?.length || 0);
        console.log(`🔍 PCT: RENDERIZAÇÃO - clientsToShow.length:`, clientsToShow.length);
        
        if (clientsToShow.length > 0) {
            const firstClient = clientsToShow[0];
            console.log(`🔍 PCT: RENDERIZAÇÃO - Primeiro cliente:`, {
                id: firstClient.id,
                idType: typeof firstClient.id,
                nome: firstClient.nome
            });
        }

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
                <td>${client.nome}</td>
                <td>${client.cidade}</td>
                <td>${client.estado}</td>
                <td>${client.telefone}</td>
                <td>${client.email}</td>
                <td style="text-align: center;">
                    <div class="btn-group">
                        <button class="action-button select-button" onclick="selectClientPCT('${client.id}')" title="Selecionar Cliente">
                            <i class="fas fa-check"></i>
                        </button>
                        <button class="action-button edit-button" onclick="editClientPCT('${client.id}')" title="Editar Cliente">
                            <i class="fas fa-edit"></i>
                        </button>
                        <button class="action-button delete-button" onclick="deleteClientPCT('${client.id}', '${client.nome || client.name}')" title="Excluir Cliente">
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
     * ✅ RENDERIZAR PAGINAÇÃO - MELHORADA COM UX APRIMORADA
     */
    function renderPagination() {
        const container = document.getElementById(CONFIG.paginationId);
        if (!container) {
            console.warn('⚠️ PCT: Container de paginação não encontrado');
            return;
        }

        const itemsPerPage = getItemsPerPage();

        // ✅ PADRONIZAÇÃO: Usar a barra centralizada de RomaneioListColumns (Exibir/Densidade/paginação)
        if (window.RomaneioListColumns && typeof window.RomaneioListColumns.renderPaginationBar === 'function') {
            container.style.display = 'flex';
            window.RomaneioListColumns.renderPaginationBar(container, {
                totalItems: state.filteredClients.length,
                currentPage: state.currentPage,
                pageSize: itemsPerPage,
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

        const totalPages = Math.ceil(state.filteredClients.length / itemsPerPage);
        const totalItems = state.filteredClients.length;
        
        console.log(`📄 PCT: Renderizando paginação - Página ${state.currentPage}/${totalPages} (${totalItems} itens)`);

        // ✅ OCULTAR PAGINAÇÃO SE HOUVER 1 PÁGINA OU MENOS
        if (totalPages <= 1) {
            container.style.display = 'none';
            return;
        }

        // ✅ VALIDAR PÁGINA ATUAL ANTES DE RENDERIZAR
        if (state.currentPage > totalPages && totalPages > 0) {
            console.warn(`⚠️ PCT: Página atual (${state.currentPage}) maior que total (${totalPages}). Corrigindo...`);
            state.currentPage = totalPages;
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

        // ✅ INFORMAÇÕES DA PAGINAÇÃO REMOVIDAS CONFORME SOLICITADO
        
        // Manter variáveis apenas para log de debug
        const startItem = (state.currentPage - 1) * itemsPerPage + 1;
        const endItem = Math.min(state.currentPage * itemsPerPage, totalItems);
        console.log(`✅ PCT: Paginação renderizada - ${startItem}-${endItem} de ${totalItems} clientes`);
    }

    /**
     * ✅ NAVEGAR PARA PÁGINA - CORRIGIDO COM VALIDAÇÕES
     */
    function goToPage(page) {
        console.log(`📄 PCT: Navegando para página ${page}`);
        
        // ✅ VALIDAÇÕES ROBUSTAS
        const totalPages = Math.ceil(state.filteredClients.length / getItemsPerPage());
        
        // Validar se página é um número válido
        if (isNaN(page) || !Number.isInteger(page)) {
            console.warn(`⚠️ PCT: Página inválida (não é número): ${page}`);
            return;
        }
        
        // Validar limites da página
        if (page < 1) {
            console.warn(`⚠️ PCT: Página menor que 1: ${page}`);
            page = 1;
        } else if (page > totalPages && totalPages > 0) {
            console.warn(`⚠️ PCT: Página maior que total (${totalPages}): ${page}`);
            page = totalPages;
        }
        
        // Verificar se realmente precisa mudar
        if (state.currentPage === page) {
            console.log(`📄 PCT: Já na página ${page}, não é necessário navegar`);
            return;
        }
        
        // Atualizar página atual
        const oldPage = state.currentPage;
        state.currentPage = page;
        
        console.log(`📄 PCT: Página alterada de ${oldPage} para ${page} (total: ${totalPages})`);
        
        // Re-renderizar lista e paginação
        renderClientList();
        renderPagination();
        
        // ✅ SCROLL PARA O TOPO DA TABELA APÓS MUDANÇA DE PÁGINA
        const tableContainer = document.querySelector('#clientListModal .table-container');
        if (tableContainer) {
            tableContainer.scrollTop = 0;
        }
    }

    /**
     * ✅ FILTRAR CLIENTES - MELHORADO COM DEBOUNCE E LOGS
     */
    function filterClients() {
        const filterInput = document.getElementById(CONFIG.filterId);
        if (!filterInput) {
            console.warn('⚠️ PCT: Campo de filtro não encontrado');
            return;
        }

        const filterText = filterInput.value.toLowerCase().trim();
        const originalCount = state.clients.length;
        
        console.log(`🔍 PCT: Filtrando clientes com termo: "${filterText}"`);
        
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

        const filteredCount = state.filteredClients.length;
        console.log(`🔍 PCT: Filtro aplicado - ${filteredCount}/${originalCount} clientes encontrados`);

        // ✅ SEMPRE RESETAR PARA PRIMEIRA PÁGINA APÓS FILTRO
        state.currentPage = 1;
        
        // Re-renderizar lista e paginação
        renderClientList();
        renderPagination();
        updateModalInfo();
        
        // ✅ FEEDBACK VISUAL SE NENHUM RESULTADO
        if (filteredCount === 0 && filterText) {
            console.log('📭 PCT: Nenhum cliente encontrado com o filtro aplicado');
        }
    }

    /**
     * ✅ SELECIONAR CLIENTE (ESPECÍFICO PCT)
     */
    function selectClient(clientId) {
        console.log(`✅ PCT: Selecionando cliente: ${clientId}`);
        console.log(`🔍 PCT: Tipo do clientId: ${typeof clientId}`);
        
        // ✅ VERIFICAÇÃO CRÍTICA IMEDIATA
        console.log(`🔍 PCT: state existe?`, !!state);
        console.log(`🔍 PCT: state.clients existe?`, !!state.clients);
        console.log(`🔍 PCT: Total de clientes disponíveis:`, state.clients ? state.clients.length : 'UNDEFINED');
        
        // ✅ LOG DETALHADO DO STATE
        if (state && state.clients) {
            console.log(`🔍 PCT: Primeiro cliente do state:`, state.clients[0]);
            console.log(`🔍 PCT: Tipo do primeiro ID:`, typeof state.clients[0]?.id);
        }
        
        // ✅ DIAGNÓSTICO DETALHADO: Verificar se os dados estão no estado
        if (!state.clients || state.clients.length === 0) {
            console.error('❌ PCT: Estado de clientes vazio! Tentando recarregar...');
            console.error('❌ PCT: Detalhes do estado:', {
                stateExists: !!state,
                clientsExists: !!state?.clients,
                clientsLength: state?.clients?.length || 0,
                clientsType: typeof state?.clients
            });
            
            loadClients().then(() => {
                console.log('🔄 PCT: Dados recarregados, tentando seleção novamente...');
                selectClient(clientId);
            });
            return;
        }
        
        console.log(`🔍 PCT: ✅ State válido, prosseguindo com busca...`);
        
        // ✅ CORREÇÃO CRÍTICA: Usar os mesmos dados da renderização
        console.log(`🔍 PCT: SELEÇÃO - state.clients.length:`, state.clients?.length || 0);
        console.log(`🔍 PCT: SELEÇÃO - state.filteredClients.length:`, state.filteredClients?.length || 0);
        
        // Usar state.filteredClients (mesmo usado na renderização) ou fallback para state.clients
        const clientsToSearch = state.filteredClients?.length > 0 ? state.filteredClients : state.clients;
        console.log(`🔍 PCT: Usando para busca:`, clientsToSearch?.length > 0 ? 'filteredClients' : 'clients');
        
        // ✅ DEBUG DETALHADO: Comparar ID procurado com IDs disponíveis
        console.log(`🔍 PCT: Procurando cliente com ID: "${clientId}" (tipo: ${typeof clientId})`);
        console.log(`🔍 PCT: Total de clientes para busca: ${clientsToSearch.length}`);
        console.log(`🔍 PCT: Primeiros 10 clientes disponíveis:`);
        clientsToSearch.slice(0, 10).forEach((c, index) => {
            const match = c.id === clientId || String(c.id) === String(clientId) || parseInt(c.id) === parseInt(clientId);
            console.log(`  ${index + 1}. ID: "${c.id}" (${typeof c.id}) - Nome: "${c.nome}" ${match ? '✅ MATCH!' : ''}`);
        });
        
        // ✅ CORREÇÃO: Buscar cliente com comparação flexível usando os mesmos dados da renderização
        let client = null;
        let matchMethod = '';
        
        // Primeiro tentar busca exata
        client = clientsToSearch.find(c => c.id === clientId);
        if (client) {
            matchMethod = 'busca exata';
            console.log('✅ PCT: Cliente encontrado com busca exata');
        } else {
            // Tentar conversão para string
            client = clientsToSearch.find(c => String(c.id) === String(clientId));
            if (client) {
                matchMethod = 'conversão string';
                console.log('✅ PCT: Cliente encontrado com conversão string');
            } else {
                // Tentar conversão numérica
                const numericClientId = parseInt(clientId);
                const numericIdIsValid = !isNaN(numericClientId);
                if (numericIdIsValid) {
                    client = clientsToSearch.find(c => parseInt(c.id) === numericClientId);
                    if (client) {
                        matchMethod = 'conversão numérica';
                        console.log('✅ PCT: Cliente encontrado com conversão numérica');
                    }
                }
                
                // ✅ ÚLTIMO RECURSO: Busca por aproximação
                if (!client) {
                    console.log('🔍 PCT: Tentando busca por aproximação...');
                    const clientIdStr = String(clientId);
                    client = clientsToSearch.find(c => {
                        const cIdStr = String(c.id);
                        return cIdStr.includes(clientIdStr) || clientIdStr.includes(cIdStr);
                    });
                    
                    if (client) {
                        matchMethod = 'busca por aproximação';
                        console.log(`✅ PCT: Cliente encontrado por aproximação: "${client.id}"`);
                    }
                }
            }
        }
        
        if (!client) {
            console.error('❌ PCT: Cliente não encontrado:', clientId);
            console.log('🔍 PCT: Todos os IDs disponíveis na fonte de busca:');
            clientsToSearch.forEach((c, index) => {
                if (index < 15) { // Mostrar mais IDs para debug
                    console.log(`  - [${index}] ID: "${c.id}" (${typeof c.id}) - Nome: "${c.nome}"`);
                }
            });
            
            console.log(`🔍 PCT: Resumo da busca:`)
            console.log(`  - ID procurado: "${clientId}" (${typeof clientId})`);
            console.log(`  - Total de clientes na busca: ${clientsToSearch.length}`);
            console.log(`  - Fonte de dados: ${clientsToSearch === state.filteredClients ? 'filteredClients' : 'clients'}`);
            
            showError(`Cliente não encontrado: ${clientId}`);
            return;
        }
        
        console.log(`✅ PCT: Cliente encontrado via ${matchMethod}:`, {id: client.id, nome: client.nome});

        // ✅ ESPECÍFICO PCT: Preencher campo clienteInput
        const clienteInput = document.getElementById('clienteInput');
        if (clienteInput) {
            let nome = client.nome || client.name || '';
            if (window.isAllCaps && window.toTitleCasePt && window.isAllCaps(nome)) {
                nome = window.toTitleCasePt(nome);
            }
            clienteInput.value = nome;
            console.log(`✅ PCT: Campo clienteInput preenchido com "${nome}"`);
            
            // Trigger events para garantir que outros sistemas detectem a mudança
            clienteInput.dispatchEvent(new Event('input', { bubbles: true }));
            clienteInput.dispatchEvent(new Event('change', { bubbles: true }));
        } else {
            console.warn('⚠️ PCT: Campo clienteInput não encontrado');
        }

        // ✅ CORREÇÃO CRÍTICA: Armazenar cliente globalmente (padrão romaneiotl)
        window.selectedClient = client;
        window.selectedFornecedor = client; // Compatibilidade
        window.clienteSelecionado = client; // Compatibilidade adicional
        
        console.log(`✅ PCT: Cliente armazenado globalmente:`, {
            nome: client.nome,
            id: client.id,
            windowSelectedClient: !!window.selectedClient
        });

        // Fechar modal
        closeModal();
        
        // Notificar seleção
        console.log(`✅ PCT: Cliente "${client.nome}" selecionado com sucesso via ${matchMethod}`);
        
        // ✅ ESPECÍFICO PCT: Disparar evento personalizado se necessário
        if (window.onClientSelectedPCT && typeof window.onClientSelectedPCT === 'function') {
            window.onClientSelectedPCT(client);
        }
    }

    /**
     * ✅ EDITAR CLIENTE
     */
    function editClient(clientId) {
        console.log(`✏️ PCT: Editando cliente: ${clientId}`);
        
        // Fechar modal de lista
        closeModal();
        
        // ✅ DIAGNÓSTICO: Verificar disponibilidade das funções
        console.log('🔍 PCT: Verificando funções disponíveis:');
        console.log('- window.openNewClientModal:', typeof window.openNewClientModal);
        console.log('- window.openClientModal:', typeof window.openClientModal);
        console.log('- window.editClient:', typeof window.editClient);
        
        // ✅ ESPECÍFICO PCT: Tentar múltiplas opções de edição
        if (window.openNewClientModal && typeof window.openNewClientModal === 'function') {
            console.log('✅ PCT: Usando openNewClientModal');
            
            // Buscar cliente primeiro (com sistema robusto)
            let client = state.clients.find(c => c.id === clientId);
            if (!client) {
                client = state.clients.find(c => String(c.id) === String(clientId));
            }
            if (!client && !isNaN(parseInt(clientId))) {
                client = state.clients.find(c => parseInt(c.id) === parseInt(clientId));
            }
            
            if (client) {
                console.log(`🔄 PCT: Abrindo modal para editar cliente: ${client.nome}`);
                window.openNewClientModal(clientId); // Passar ID para função
                
                // Aguardar modal abrir e preencher campos
                setTimeout(() => {
                    const clientForm = document.getElementById('clientForm');
                    const clientModal = document.getElementById('clientModal');
                    
                    if (clientForm) {
                        console.log(`🔄 PCT: Preenchendo dados do cliente "${client.nome}" para edição`);
                        
                        // ✅ CORREÇÃO: PASSO 1 - Preencher campos básicos primeiro (exceto estado e cidade)
                        const basicFields = {
                            'clientId': client.id,
                            'clientName': client.nome,
                            'clientCnpj': client.documento || client.document || client.cnpj || client.cpf,
                            'clientPersonType': client.tipoPessoa || client.personType || client.fiscalPersonType,
                            'clientIndIEDest': client.indIEDest || client.indicadorInscricaoEstadual || client.ieIndicator,
                            'clientStateRegistration': client.inscricaoEstadual || client.stateRegistration || client.ie,
                            'clientMunicipalRegistration': client.inscricaoMunicipal || client.municipalRegistration,
                            'clientSuframa': client.suframa,
                            'clientCep': client.cep || client.postalCode,
                            'clientPhone': client.telefone,
                            'clientEmail': client.email,
                            'clientAddress': client.endereco,
                            'clientNumber': client.numero || client.number,
                            'clientNeighborhood': client.bairro || client.neighborhood,
                            'clientComplement': client.complemento || client.complement,
                            'clientMunicipalityCode': client.codigoMunicipio || client.municipioCodigo || client.municipalityCode || client.cMun || client.ibgeCode,
                            'clientCountryCode': client.paisCodigo || client.countryCode || client.cPais || '1058',
                            'clientCountryName': client.pais || client.country || client.countryName || client.xPais || 'Brasil'
                        };
                        
                        Object.entries(basicFields).forEach(([fieldId, value]) => {
                            const field = document.getElementById(fieldId);
                            if (field && value) {
                                field.value = value;
                                console.log(`✅ Campo ${fieldId} preenchido com: ${value}`);
                            }
                        });
                        
                        // ✅ CORREÇÃO: PASSO 2 - Preencher estado e carregar cidades
                        const stateField = document.getElementById('clientState');
                        if (stateField && client.estado) {
                            stateField.value = client.estado;
                            console.log(`✅ Estado preenchido: ${client.estado}`);
                            
                            // ✅ CORREÇÃO: PASSO 3 - Carregar cidades e depois preencher cidade
                            if (client.cidade) {
                                if (window.carregarCidadesPorEstado) {
                                    console.log(`🔄 Carregando cidades para estado: ${client.estado}`);
                                    window.carregarCidadesPorEstado(client.estado);
                                    
                                    // ✅ AGUARDAR CIDADES CARREGAREM E ENTÃO PREENCHER CIDADE
                                    setTimeout(() => {
                                        const cityField = document.getElementById('clientCity');
                                        if (cityField && client.cidade) {
                                            // ✅ TENTAR PREENCHER CIDADE
                                            cityField.value = client.cidade;
                                            console.log(`✅ Cidade preenchida: ${client.cidade}`);
                                            
                                            // ✅ VERIFICAR SE A CIDADE FOI ENCONTRADA NAS OPÇÕES
                                            const cityOption = Array.from(cityField.options).find(option => option.value === client.cidade);
                                            if (!cityOption && client.cidade.trim() !== '') {
                                                console.warn(`⚠️ Cidade "${client.cidade}" não encontrada nas opções. Adicionando manualmente.`);
                                                
                                                // Adicionar cidade manualmente se não estiver na lista
                                                const option = document.createElement('option');
                                                option.value = client.cidade;
                                                option.textContent = client.cidade;
                                                option.selected = true;
                                                cityField.appendChild(option);
                                                
                                                console.log(`✅ Cidade "${client.cidade}" adicionada manualmente às opções`);
                                            }
                                        }
                                    }, 1500); // Aguardar API do IBGE carregar as cidades
                                } else {
                                    // ✅ FALLBACK: Se função de carregar cidades não existe, preencher diretamente
                                    console.warn('⚠️ Função carregarCidadesPorEstado não disponível. Preenchendo cidade diretamente.');
                                    setTimeout(() => {
                                        const cityField = document.getElementById('clientCity');
                                        if (cityField && client.cidade) {
                                            // Adicionar cidade como opção manual
                                            const option = document.createElement('option');
                                            option.value = client.cidade;
                                            option.textContent = client.cidade;
                                            option.selected = true;
                                            cityField.appendChild(option);
                                            
                                            cityField.value = client.cidade;
                                            console.log(`✅ Cidade "${client.cidade}" adicionada e selecionada (fallback)`);
                                        }
                                    }, 200);
                                }
                            }
                        }
                        
                        // ✅ ATUALIZAR TÍTULO DO MODAL
                        const modalTitle = document.getElementById('clientModalTitle');
                        if (modalTitle) {
                            modalTitle.textContent = 'Editar Cliente';
                        }
                        const saveBtn = document.getElementById('saveClientBtn') || document.querySelector('#clientModal .btn-save');
                        if (saveBtn) {
                            saveBtn.textContent = 'Atualizar';
                        }
                        
                        console.log(`✅ PCT: Cliente "${client.nome}" carregado para edição com sequência corrigida`);
                    } else if (clientModal) {
                        console.log('⚠️ PCT: Modal aberto mas formulário não encontrado');
                    } else {
                        console.error('❌ PCT: Modal de cliente não encontrado');
                    }
                }, 300); // Tempo maior para garantir que o modal abra
            } else {
                console.error('❌ PCT: Cliente não encontrado para edição:', clientId);
                showError('Cliente não encontrado para edição');
            }
        } else if (window.openClientModal && typeof window.openClientModal === 'function') {
            console.log('✅ PCT: Usando openClientModal como fallback');
            window.openClientModal(clientId);
        } else {
            console.error('❌ PCT: Nenhuma função de edição disponível');
            console.log('🔍 PCT: Funções window disponíveis relacionadas a cliente:');
            Object.keys(window).filter(key => key.toLowerCase().includes('client')).forEach(key => {
                console.log(`  - ${key}: ${typeof window[key]}`);
            });
            
            // Fallback final - mostrar dados do cliente
            const client = state.clients.find(c => 
                c.id === clientId || String(c.id) === String(clientId) || parseInt(c.id) === parseInt(clientId)
            );
            
            if (client) {
                const msg = `Dados do cliente:\nNome: ${client.nome}\nCidade: ${client.cidade}\nEstado: ${client.estado}\nTelefone: ${client.telefone}\nEmail: ${client.email}`;
                alert(msg);
            } else {
                showError('Funcionalidade de edição não disponível');
            }
        }
    }

    /**
     * ✅ EXCLUIR CLIENTE
     */
    async function deleteClient(clientId, clientName) {
        console.log(`🗑️ PCT: Excluindo cliente: ${clientId}`);
        
        if (!confirm(`Tem certeza que deseja excluir o cliente "${clientName}"?\n\nEsta ação não pode ser desfeita.`)) {
            return;
        }

        try {
            let deleteSuccess = false;
            
            if (window.clientService && typeof window.clientService.deleteClient === 'function') {
                deleteSuccess = await window.clientService.deleteClient(clientId);
                if (deleteSuccess) {
                    console.log(`✅ PCT: Cliente "${clientName}" excluído via clientService`);
                }
            } else if (window.firebaseService && typeof window.firebaseService.removeFromFirebase === 'function') {
                try {
                    const result = await window.firebaseService.removeFromFirebase(`clients/${clientId}`);
                    if (result && result.success) {
                        deleteSuccess = true;
                        console.log(`✅ PCT: Cliente "${clientName}" excluído do Firebase`);
                    }
                } catch (firebaseError) {
                    console.warn('⚠️ PCT: Erro ao excluir do Firebase:', firebaseError);
                }
            }
            
            // Se Firebase não funcionou, tentar localStorage
            if (!deleteSuccess) {
                try {
                    const clientesLocal = JSON.parse(readLocalStorageValue('clientes') || '[]');
                    const clientesFiltrados = clientesLocal.filter(c => c.id != clientId);
                    writeLocalStorageValue('clientes', JSON.stringify(clientesFiltrados));
                    deleteSuccess = true;
                    console.log(`✅ PCT: Cliente removido do localStorage`);
                } catch (localError) {
                    console.error('❌ PCT: Erro ao remover do localStorage:', localError);
                }
            }
            
            if (deleteSuccess) {
                // Recarregar lista para refletir a exclusão
                console.log('🔄 PCT: Recarregando lista após exclusão...');
                await refresh();
                
                showSuccess(`Cliente "${clientName}" excluído com sucesso.`);
                console.log(`🎉 PCT: Exclusão de cliente concluída com sucesso`);
            } else {
                throw new Error('Falha ao excluir cliente de todas as fontes');
            }
            
        } catch (error) {
            console.error('❌ PCT: Erro ao excluir cliente:', error);
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
        try { document.body.style.overflow = ''; } catch (_) {}
        }
        
        // ✅ LIMPAR CAMPO DE FILTRO AO FECHAR
        const filterInput = document.getElementById(CONFIG.filterId);
        if (filterInput) {
            filterInput.value = '';
            // Resetar filtro
            state.filteredClients = [...state.clients];
            state.currentPage = 1;
        }
        
        console.log('✅ PCT: Modal de clientes fechado e filtro limpo');
    }

    /**
     * ✅ CONFIGURAR EVENT LISTENERS
     */
    function setupEventListeners() {
        const modal = document.getElementById(CONFIG.modalId);
        if (!modal) return;

        // ✅ FILTRO DE BUSCA COM DEBOUNCE MELHORADO
        const filterInput = document.getElementById(CONFIG.filterId);
        if (filterInput) {
            filterInput.removeEventListener('input', filterClients); // Remover listener anterior
            
            let filterTimeout;
            const debouncedFilter = () => {
                clearTimeout(filterTimeout);
                filterTimeout = setTimeout(filterClients, 300); // Debounce de 300ms
            };
            
            filterInput.addEventListener('input', debouncedFilter);
            
            // ✅ NAVEGAÇÃO POR TECLADO NO FILTRO
            filterInput.addEventListener('keydown', (e) => {
                if (e.key === 'Enter') {
                    e.preventDefault();
                    clearTimeout(filterTimeout);
                    filterClients(); // Filtrar imediatamente ao pressionar Enter
                }
            });
        }

        // ✅ NAVEGAÇÃO POR TECLADO GLOBAL NO MODAL
        const handleKeyNavigation = (e) => {
            // Não interferir se estiver digitando no campo de filtro
            if (e.target === filterInput) return;
            
            const totalPages = Math.ceil(state.filteredClients.length / getItemsPerPage());
            
            switch(e.key) {
                case 'ArrowLeft':
                case 'PageUp':
                    e.preventDefault();
                    if (state.currentPage > 1) {
                        goToPage(state.currentPage - 1);
                    }
                    break;
                    
                case 'ArrowRight':
                case 'PageDown':
                    e.preventDefault();
                    if (state.currentPage < totalPages) {
                        goToPage(state.currentPage + 1);
                    }
                    break;
                    
                case 'Home':
                    e.preventDefault();
                    if (totalPages > 1) {
                        goToPage(1);
                    }
                    break;
                    
                case 'End':
                    e.preventDefault();
                    if (totalPages > 1) {
                        goToPage(totalPages);
                    }
                    break;
                    
                case 'Escape':
                    closeModal();
                    break;
            }
        };

        // Remover listener antigo se existir
        if (modal._keyNavigationHandler) {
            modal.removeEventListener('keydown', modal._keyNavigationHandler);
        }
        
        // Adicionar novo listener de teclado
        modal._keyNavigationHandler = handleKeyNavigation;
        modal.addEventListener('keydown', handleKeyNavigation);

        // ✅ BOTÕES DE FECHAR
        const closeButtons = modal.querySelectorAll('.close-modal, .close-modal-btn');
        closeButtons.forEach(btn => {
            btn.onclick = closeModal;
        });

        // ✅ FECHAR AO CLICAR FORA
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
        
        console.log('✅ PCT: Event listeners configurados com navegação por teclado aprimorada');
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
            console.error('PCT:', message);
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
            console.log('PCT:', message);
            alert('Sucesso: ' + message);
        }
    }

    /**
     * ✅ RECARREGAR DADOS
     */
    async function refresh() {
        console.log('🔄 PCT: Recarregando dados dos clientes...');
        
        try {
            // Verificar se o modal está aberto
            const modal = document.getElementById(CONFIG.modalId);
            const isModalOpen = modal && modal.style.display === 'block';
            
            console.log(`🔍 PCT: Modal está aberto? ${isModalOpen}`);
            
            // Limpar cache do Firebase para forçar reload
            if (window.firebaseService && window.firebaseService.cache) {
                window.firebaseService.cache.delete('clients');
            }
            
            const prevClients = Array.isArray(state.clients) ? [...state.clients] : [];
            const prevFiltered = Array.isArray(state.filteredClients) ? [...state.filteredClients] : [];
            const prevPage = state.currentPage;

            await loadClients(true);
            
            if (isModalOpen) {
                renderClientList();
                renderPagination();
                updateModalInfo();
                console.log('✅ PCT: Interface atualizada (modal estava aberto)');
            } else {
                state.clients = prevClients;
                state.filteredClients = prevFiltered;
                state.currentPage = prevPage;
                console.log('⏩ PCT: Interface NÃO atualizada (modal estava fechado)');
            }
            
            console.log('✅ PCT: Dados dos clientes recarregados com sucesso');
            
        } catch (error) {
            console.error('❌ PCT: Erro ao recarregar dados:', error);
            showError('Erro ao recarregar lista de clientes');
        }
    }

    // 📡 Atualizar lista quando houver evento de clientes atualizados (com throttle)
    window.addEventListener('clients:updated', async function(e) {
        try {
            if (!window.__pctClientsRefreshTimer) {
                window.__pctClientsRefreshTimer = setTimeout(async () => {
                    window.__pctClientsRefreshTimer = null;
                    await refresh();
                    console.log('📡 PCT: Lista de clientes atualizada via evento clients:updated');
                }, 300);
            }
        } catch (err) {
            console.warn('⚠️ PCT: Falha ao atualizar lista de clientes via evento:', err);
        }
    });

    // ✅ INTERFACE PÚBLICA
    return {
        openModal,
        closeModal,
        selectClient,
        editClient,
        deleteClient,
        refresh,
        loadClients
    };

})();

// ✅ FUNÇÕES ESPECÍFICAS PCT - SEM CONFLITOS
console.log('🔧 PCT: Definindo funções específicas PCT...');

window.selectClientPCT = function(clientId) {
    console.log('🎯 selectClientPCT CHAMADO - FUNÇÃO ESPECÍFICA PCT');
    return window.ModalClientesPCT.selectClient(clientId);
};

window.editClientPCT = function(clientId) {
    console.log('✏️ editClientPCT CHAMADO - FUNÇÃO ESPECÍFICA PCT');
    return window.ModalClientesPCT.editClient(clientId);
};

window.deleteClientPCT = function(clientId, clientName) {
    console.log('🗑️ deleteClientPCT CHAMADO - FUNÇÃO ESPECÍFICA PCT');
    return window.ModalClientesPCT.deleteClient(clientId, clientName);
};

console.log('✅ PCT: Funções específicas definidas:', {
    selectClientPCT: typeof window.selectClientPCT,
    editClientPCT: typeof window.editClientPCT,
    deleteClientPCT: typeof window.deleteClientPCT
});

// ✅ FUNÇÕES GLOBAIS PARA COMPATIBILIDADE (podem ser sobrescritas)
window.openClientListModal = window.ModalClientesPCT.openModal;
window.refreshClientListPCT = window.ModalClientesPCT.refresh;

// ✅ CORREÇÃO CRÍTICA: NÃO SOBRESCREVER window.selectClient
// Manter compatibilidade sem conflitos com outros módulos
if (typeof window.selectClient === 'undefined') {
    window.selectClient = function(client) {
        console.log('🔗 window.selectClient chamado (padrão romaneiotl):', client);
        
        if (typeof client === 'string' || typeof client === 'number') {
            // Se recebeu um ID, usar selectClientPCT
            return window.selectClientPCT(client);
        } else if (client && typeof client === 'object') {
            // Se recebeu objeto cliente diretamente, armazenar globalmente
            window.selectedClient = client;
            window.selectedFornecedor = client;
            window.clienteSelecionado = client;
            
            // Preencher campo se existir
            const clienteInput = document.getElementById('clienteInput');
            if (clienteInput && client.nome) {
                clienteInput.value = client.nome;
                clienteInput.dispatchEvent(new Event('input', { bubbles: true }));
                clienteInput.dispatchEvent(new Event('change', { bubbles: true }));
            }
            
            console.log('✅ Cliente selecionado via window.selectClient:', client.nome);
            return true;
        } else {
            console.error('❌ Parâmetro inválido para selectClient:', client);
            return false;
        }
    };
} else {
    console.log('⚠️ PCT: window.selectClient já existe, mantendo definição existente');
}

// ✅ SISTEMA DE PROTEÇÃO CONTRA SOBRESCRITA (evitar redeclaração)
if (typeof window.pctClientFunctions === 'undefined') {
    window.pctClientFunctions = {
        'selectClientPCT': window.selectClientPCT,
        'editClientPCT': window.editClientPCT,
        'deleteClientPCT': window.deleteClientPCT
    };
    
    // ✅ SINALIZAÇÃO DE PRONTIDÃO PARA SUPRIMIR LOGS DURANTE CARREGAMENTO INICIAL
    if (typeof window.__pctClientFunctionsReady === 'undefined') {
        window.__pctClientFunctionsReady = false;
        // Tornar "pronto" após load ou após pequeno atraso (fallback)
        window.addEventListener('load', function() {
            window.__pctClientFunctionsReady = true;
        });
        setTimeout(function(){ window.__pctClientFunctionsReady = true; }, 2000);
    }

    // ✅ MONITOR DE SOBRESCRITA - DETECTAR QUANDO ACONTECE (após pronto)
    Object.keys(window.pctClientFunctions).forEach(funcName => {
        Object.defineProperty(window, funcName, {
            get: function() {
                return window.pctClientFunctions[funcName];
            },
            set: function(newValue) {
                if (newValue !== window.pctClientFunctions[funcName]) {
                    // Permitir sobrescrita sempre; só avisar se já estiver "pronto"
                    if (window.__pctClientFunctionsReady) {
                        console.warn(`🔧 PCT: Função ${funcName} foi redefinida após carregamento`);
                    }
                    window.pctClientFunctions[funcName] = newValue;
                }
            },
            configurable: true,
            enumerable: true
        });
    });
    
    console.log('🛡️ PCT: Sistema de monitoramento de funções ativo');
}

function protectPCTClientFunctions() {
    let needsRestore = false;
    
    Object.entries(window.pctClientFunctions).forEach(([name, originalFunc]) => {
        if (typeof window[name] !== 'function' || window[name] !== originalFunc) {
            if (!needsRestore) {
                console.warn(`⚠️ PCT: Detectada sobrescrita de funções, restaurando...`);
                needsRestore = true;
            }
            window[name] = originalFunc;
        }
    });
    
    if (needsRestore) {
        console.log(`✅ PCT: Funções restauradas: ${Object.keys(window.pctClientFunctions).join(', ')}`);
    }
}

// Proteção inicial
protectPCTClientFunctions();

// Proteção periódica menos frequente (5s em vez de 2s)
setInterval(protectPCTClientFunctions, 5000);

console.log('✅ Módulo ModalClientesPCT carregado com funções específicas protegidas');
