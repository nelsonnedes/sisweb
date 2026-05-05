// preromaneio-modals.js
// Handles all modal interactions for the Pre-Romaneio module

/* === FIX: Client & Species Modal Layout === */
/* Ensure modals have correct z-index and display properties */
// (Styles are handled in CSS, this file handles logic)

// Global variables for cached data
let cachedClients = [];
let cachedSuppliers = [];
let cachedSpecies = [];
let cachedRomaneios = [];

// Pagination State
const ITEMS_PER_PAGE = 10;
let currentPageClient = 1;
let currentPageSupplier = 1;
let currentPageSpecies = 1;
let currentPageRomaneios = 1;

// Helper: Render Pagination Controls
function renderPagination(totalItems, currentPage, containerId, onPageChange) {
    const totalPages = Math.ceil(totalItems / ITEMS_PER_PAGE);
    const container = document.getElementById(containerId);
    if (!container) return;

    container.innerHTML = '';
    if (totalPages <= 1) {
        container.style.display = 'none';
        return;
    }
    container.style.display = 'flex';

    const addBtn = (label, page, disabled = false, active = false) => {
        const btn = document.createElement('button');
        btn.textContent = label;
        if (active) btn.classList.add('active');
        btn.disabled = disabled;
        btn.onclick = () => onPageChange(page);
        container.appendChild(btn);
    };

    addBtn('<<<', 1, currentPage === 1);
    addBtn('<', currentPage - 1, currentPage === 1);

    const startPage = Math.max(1, currentPage - 2);
    const endPage = Math.min(totalPages, currentPage + 2);

    if (startPage > 1) {
        addBtn('1', 1, false, currentPage === 1);
        if (startPage > 2) {
            const span = document.createElement('span');
            span.textContent = '...';
            container.appendChild(span);
        }
    }

    for (let i = startPage; i <= endPage; i++) {
        addBtn(String(i), i, false, i === currentPage);
    }

    if (endPage < totalPages) {
        if (endPage < totalPages - 1) {
            const span = document.createElement('span');
            span.textContent = '...';
            container.appendChild(span);
        }
        addBtn(String(totalPages), totalPages, false, currentPage === totalPages);
    }

    addBtn('>', currentPage + 1, currentPage === totalPages);
    addBtn('>>>', totalPages, currentPage === totalPages);
}

// ==========================================
// CLIENT MODALS
// ==========================================

async function openClientListModal() {
    const modal = document.getElementById('clientListModal');
    const tbody = document.getElementById('clientListTable');
    if (!modal || !tbody) return;
    
    modal.style.display = 'block';
    tbody.innerHTML = '<tr><td colspan="3" class="text-center">Carregando...</td></tr>';

    try {
        // Tentar carregar de 'clients' e depois 'clientes'
        let clientsData = await window.firebaseService.loadFromFirebase('clients');
        if (!clientsData || (Array.isArray(clientsData) && clientsData.length === 0)) {
             clientsData = await window.firebaseService.loadFromFirebase('clientes');
        }
        
        if (clientsData && clientsData.data) clientsData = clientsData.data;

        let clientList = [];
        if (clientsData && typeof clientsData === 'object') {
             // Handle both array-like objects and map objects
             clientList = Object.keys(clientsData).map(key => ({
                 id: key,
                 ...clientsData[key]
             }));
        } else if (Array.isArray(clientsData)) {
             clientList = clientsData;
        }
        
        // Filtrar nulos e ordenar
        clientList = clientList.filter(c => c && (c.name || c.nome));
        clientList.sort((a, b) => (a.name || a.nome || '').localeCompare(b.name || b.nome || ''));
        
        // Normalizar nomes
        clientList = clientList.map(c => ({
            ...c,
            name: c.name || c.nome || 'Sem Nome',
            city: c.city || c.cidade || '-'
        }));

        cachedClients = clientList;
        currentPageClient = 1; // Reset to first page
        renderClientList();
    } catch (error) {
        console.error('Erro ao carregar clientes:', error);
        tbody.innerHTML = '<tr><td colspan="3" class="text-center text-danger">Erro ao carregar clientes: ' + error.message + '</td></tr>';
    }
}

function closeClientListModal() {
    const modal = document.getElementById('clientListModal');
    if (modal) modal.style.display = 'none';
}

function renderClientList(list = null) {
    const tbody = document.getElementById('clientListTable');
    if (!tbody) return;
    
    // Use cached list if not provided (for pagination)
    const dataToRender = list || cachedClients;
    
    tbody.innerHTML = '';

    if (dataToRender.length === 0) {
        tbody.innerHTML = '<tr><td colspan="3" class="text-center">Nenhum cliente encontrado.</td></tr>';
        document.getElementById('clientListPagination').innerHTML = '';
        return;
    }

    // Pagination Logic
    const start = (currentPageClient - 1) * ITEMS_PER_PAGE;
    const end = start + ITEMS_PER_PAGE;
    const paginatedItems = dataToRender.slice(start, end);

    paginatedItems.forEach(client => {
        const tr = document.createElement('tr');
        tr.innerHTML = `
            <td>${client.name || 'Sem Nome'}</td>
            <td>${client.city || '-'}</td>
            <td class="text-center actions-cell">
                <div class="actions-container">
                    <button class="btn-selecionar" onclick="selectPreRomaneioClient('${client.id}', '${client.name}')" title="Selecionar">
                        <i class="fas fa-check"></i>
                    </button>
                </div>
            </td>
        `;
        tbody.appendChild(tr);
    });

    renderPagination(dataToRender.length, currentPageClient, 'clientListPagination', (newPage) => {
        currentPageClient = newPage;
        renderClientList(dataToRender);
    });
}

function filterClientList() {
    const term = document.getElementById('clientListFilter').value.toLowerCase();
    const filtered = cachedClients.filter(c => 
        (c.name && c.name.toLowerCase().includes(term)) || 
        (c.city && c.city.toLowerCase().includes(term))
    );
    currentPageClient = 1; // Reset page on filter
    renderClientList(filtered);
}

function selectPreRomaneioClient(id, name) {
    const input = document.getElementById('clienteInput');
    if (input) {
        input.value = name;
        input.dataset.id = id;
    }
    closeClientListModal();
    // Hide suggestions if open
    const suggestions = document.querySelector('.autocomplete-items');
    if (suggestions) suggestions.remove();
}

function openNewClientModal() {
    const modal = document.getElementById('clientModal');
    if (!modal) return;
    try {
        const form = document.getElementById('clientForm');
        if (form) form.reset();
        const citySelect = document.getElementById('clientCity');
        if (citySelect) citySelect.innerHTML = '<option value="">Selecione primeiro o estado</option>';
        const stateSelect = document.getElementById('clientState');
        if (stateSelect) {
            stateSelect.removeEventListener('change', updateClientCities);
            stateSelect.addEventListener('change', updateClientCities);
        }
    } catch (_) {}
    modal.style.display = 'block';
}

function closeNewClientModal() {
    const modal = document.getElementById('clientModal');
    if (modal) modal.style.display = 'none';
    const form = document.getElementById('clientForm');
    if (form) form.reset();
    const citySelect = document.getElementById('clientCity');
    if (citySelect) citySelect.innerHTML = '<option value="">Selecione primeiro o estado</option>';
}

// ... (existing code)

async function updateClientCities() {
    const stateSelect = document.getElementById('clientState');
    const citySelect = document.getElementById('clientCity');
    if (!stateSelect || !citySelect) return;

    const selectedState = stateSelect.value;
    if (!selectedState) {
        citySelect.innerHTML = '<option value="">Selecione primeiro o estado</option>';
        return;
    }

    citySelect.innerHTML = '<option value="">Carregando cidades...</option>';

    try {
        const response = await fetch(`https://servicodados.ibge.gov.br/api/v1/localidades/estados/${selectedState}/municipios`);
        if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
        const cities = await response.json();
        const cityNames = cities.map(city => city.nome).sort((a, b) => a.localeCompare(b, 'pt-BR'));
        citySelect.innerHTML = '<option value="">Selecione a cidade</option>';
        cityNames.forEach(city => {
            const option = document.createElement('option');
            option.value = city;
            option.textContent = city;
            citySelect.appendChild(option);
        });
    } catch (_) {
        const citiesByState = {
            'PA': ['Belém', 'Ananindeua', 'Santarém', 'Marabá', 'Parauapebas', 'Castanhal', 'Abaetetuba', 'Cametá', 'Bragança', 'Altamira', 'São Miguel do Guamá'],
            'SP': ['São Paulo', 'Guarulhos', 'Campinas', 'São Bernardo do Campo', 'Santo André', 'Osasco', 'Ribeirão Preto', 'Sorocaba'],
            'RJ': ['Rio de Janeiro', 'São Gonçalo', 'Duque de Caxias', 'Nova Iguaçu', 'Niterói', 'Belford Roxo', 'São João de Meriti'],
            'MG': ['Belo Horizonte', 'Uberlândia', 'Contagem', 'Juiz de Fora', 'Betim', 'Montes Claros', 'Ribeirão das Neves']
        };
        const cities = citiesByState[selectedState] || [];
        citySelect.innerHTML = '<option value="">Selecione a cidade</option>';
        cities.forEach(city => {
            const option = document.createElement('option');
            option.value = city;
            option.textContent = city;
            citySelect.appendChild(option);
        });
    }
}

// Handle New Client Form Submit
const clientForm = document.getElementById('clientForm');
if (clientForm) {
    clientForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        
        const name = document.getElementById('clientName').value;
        const cnpj = document.getElementById('clientCnpj')?.value || '';
        const phone = document.getElementById('clientPhone')?.value || '';
        const address = document.getElementById('clientAddress')?.value || '';
        const number = document.getElementById('clientNumber')?.value || '';
        const neighborhood = document.getElementById('clientNeighborhood')?.value || '';
        const state = document.getElementById('clientState')?.value || '';
        const city = document.getElementById('clientCity')?.value || '';
        const obs = document.getElementById('clientObs')?.value || '';

        if (!name || !String(name).trim()) {
            alert('Nome é obrigatório.');
            return;
        }
        if (!state || !city) {
            alert('Selecione Estado e Cidade.');
            return;
        }

        const nowIso = new Date().toISOString();
        const newClient = {
            name: String(name).trim(),
            nome: String(name).trim(),
            cnpj: String(cnpj).trim(),
            phone: String(phone).trim(),
            telefone: String(phone).trim(),
            address: String(address).trim(),
            endereco: String(address).trim(),
            number: String(number).trim(),
            numero: String(number).trim(),
            neighborhood: String(neighborhood).trim(),
            bairro: String(neighborhood).trim(),
            state: String(state).trim(),
            estado: String(state).trim(),
            city: String(city).trim(),
            cidade: String(city).trim(),
            obs: String(obs).trim(),
            createdAt: nowIso,
            updatedAt: nowIso
        };

        try {
            const svc = window.firebaseService;
            let id = null;
            try {
                if (svc && svc.database && typeof svc.database.ref === 'function') {
                    id = svc.database.ref('clients').push().key;
                }
            } catch (_) {}
            if (!id) id = `${Date.now()}`;
            const dataToSave = { ...newClient, id };

            let result = null;
            if (svc && typeof svc.saveData === 'function') {
                result = await svc.saveData(`clients/${id}`, dataToSave);
            } else if (svc && typeof svc.saveToFirebase === 'function') {
                result = await svc.saveToFirebase(`clients/${id}`, dataToSave);
            } else {
                throw new Error('Serviço de salvamento não disponível');
            }

            if (result && result.success) {
                selectPreRomaneioClient(id, dataToSave.name);
                closeNewClientModal();
                alert('Cliente cadastrado com sucesso!');
            } else {
                throw new Error('Erro ao salvar');
            }
        } catch (error) {
            console.error(error);
            alert('Erro ao cadastrar cliente.');
        }
    });
}


// ==========================================
// FORNECEDOR MODALS (DELEGADO PARA fornecedor-modals.js)
// ==========================================
// A lógica de Fornecedores agora é gerida pelo script fornecedor-modals.js
// para garantir consistência e robustez na listagem e cadastro.



// ==========================================
// SPECIES MODALS
// ==========================================

async function openSpeciesListModal() {
    const modal = document.getElementById('speciesListModal');
    const tbody = document.getElementById('speciesListTable');
    if (!modal || !tbody) return;

    modal.style.display = 'block';
    tbody.innerHTML = '<tr><td colspan="3" class="text-center">Carregando...</td></tr>';

    try {
        let speciesData = await window.firebaseService.loadFromFirebase('species');
        if (!speciesData || (speciesData.data && Object.keys(speciesData.data).length === 0) || (Array.isArray(speciesData.data) && speciesData.data.length === 0)) {
            speciesData = await window.firebaseService.loadFromFirebase('especies');
        }

        if (speciesData && speciesData.data) speciesData = speciesData.data;

        let speciesList = [];
        if (speciesData && typeof speciesData === 'object' && !Array.isArray(speciesData)) {
            speciesList = Object.keys(speciesData).map(key => ({
                id: key,
                ...speciesData[key]
            }));
        } else if (Array.isArray(speciesData)) {
            speciesList = speciesData;
        }

        cachedSpecies = speciesList;
        currentPageSpecies = 1;
        renderSpeciesList();
    } catch (error) {
        console.error('Erro ao carregar espécies:', error);
        tbody.innerHTML = '<tr><td colspan="3" class="text-center text-danger">Erro ao carregar espécies.</td></tr>';
    }
}

function closeSpeciesListModal() {
    const modal = document.getElementById('speciesListModal');
    if (modal) modal.style.display = 'none';
}

function renderSpeciesList(list = null) {
    const tbody = document.getElementById('speciesListTable');
    if (!tbody) return;

    const dataToRender = list || cachedSpecies;
    tbody.innerHTML = '';

    if (dataToRender.length === 0) {
        tbody.innerHTML = '<tr><td colspan="3" class="text-center">Nenhuma espécie encontrada.</td></tr>';
        document.getElementById('speciesListPagination').innerHTML = '';
        return;
    }

    const start = (currentPageSpecies - 1) * ITEMS_PER_PAGE;
    const end = start + ITEMS_PER_PAGE;
    const paginatedItems = dataToRender.slice(start, end);

    paginatedItems.forEach(item => {
        // Fallback robusto para nome e descrição
        const displayName = item.nome || item.name || item.especie || 'Sem Nome';
        const displayDesc = item.descricao || item.description || item.scientificName || '-';
        // Preço ainda é necessário para a seleção, mas não exibido na coluna
        const price = item.price || item.preco || '0,00';
        
        const tr = document.createElement('tr');
        tr.innerHTML = `
            <td>${displayName}</td>
            <td>${displayDesc}</td>
            <td class="text-center">
                <div class="actions-container">
                    <button class="btn-selecionar" onclick="selectSpecies('${displayName}', '${price}')" title="Selecionar">
                        <i class="fas fa-check"></i>
                    </button>
                </div>
            </td>
        `;
        tbody.appendChild(tr);
    });

    renderPagination(dataToRender.length, currentPageSpecies, 'speciesListPagination', (newPage) => {
        currentPageSpecies = newPage;
        renderSpeciesList(dataToRender);
    });
}

function filterSpeciesList() {
    const term = document.getElementById('speciesListFilter').value.toLowerCase();
    const filtered = cachedSpecies.filter(s => 
        (s.name && s.name.toLowerCase().includes(term))
    );
    currentPageSpecies = 1;
    renderSpeciesList(filtered);
}

function selectSpecies(name, price) {
    // Determinar qual input preencher baseado na aba visível
    const contentToras = document.getElementById('content-toras');
    const isToras = contentToras && contentToras.style.display === 'block';

    const inputId = isToras ? 'especieToraInput' : 'especieInput';
    const priceId = isToras ? 'precoTora' : 'price';

    const input = document.getElementById(inputId);
    const priceInput = document.getElementById(priceId);
    
    if (input) input.value = name;
    if (priceInput) {
        priceInput.value = price;
    }
    
    closeSpeciesListModal();
    // Hide suggestions
    const suggestions = document.querySelectorAll('.autocomplete-items');
    if (suggestions) suggestions.forEach(s => s.remove());
}

function openNewSpeciesModal() {
    const modal = document.getElementById('speciesModal');
    if (modal) modal.style.display = 'block';
}

function closeNewSpeciesModal() {
    const modal = document.getElementById('speciesModal');
    if (modal) modal.style.display = 'none';
    const form = document.getElementById('speciesForm');
    if (form) form.reset();
}

const speciesForm = document.getElementById('speciesForm');
if (speciesForm) {
    speciesForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        
        const name = document.getElementById('speciesName').value;
        const desc = document.getElementById('speciesDesc').value;
        const price = document.getElementById('speciesPrice').value;

        const newSpecies = {
            name,
            descricao: desc,
            scientificName: desc, // Compatibilidade
            price,
            createdAt: new Date().toISOString()
        };

        try {
            const result = await window.firebaseService.saveData('species', newSpecies);
            if (result && result.success) {
                selectSpecies(name, price);
                closeNewSpeciesModal();
                // Refresh list if open
                const listModal = document.getElementById('speciesListModal');
                if (listModal && listModal.style.display === 'block') {
                    openSpeciesListModal();
                }
                alert('Espécie cadastrada com sucesso!');
            } else {
                throw new Error('Erro ao salvar');
            }
        } catch (error) {
            console.error(error);
            alert('Erro ao cadastrar espécie.');
        }
    });
}


// ==========================================
// ROMANEIOS LIST MODAL
// ==========================================

async function abrirLista() {
    const modal = document.getElementById('listaModal');
    const tbody = document.getElementById('listaRomaneiosTable');
    if (!modal || !tbody) return;

    modal.style.display = 'block';
    tbody.innerHTML = '<tr><td colspan="6" class="text-center">Carregando...</td></tr>';

    try {
        let activeTenant = null;
        try {
            const svcTenant = window.firebaseServiceTL || window.firebaseService || window.FirebaseService;
            if (svcTenant && typeof svcTenant.getTenantId === 'function') {
                activeTenant = svcTenant.getTenantId();
            }
            if (!activeTenant && svcTenant && typeof svcTenant.getCurrentTenantId === 'function') {
                activeTenant = svcTenant.getCurrentTenantId();
            }
            if (!activeTenant && window.appTenantId) {
                activeTenant = window.appTenantId;
            }
            if (!activeTenant) {
                const rawInfo = localStorage.getItem('company_info');
                const info = rawInfo ? JSON.parse(rawInfo) : null;
                activeTenant = info && (info.companyId || info.companyID || info.tenantId || info.id);
            }
            if (activeTenant && svcTenant && typeof svcTenant.setTenantId === 'function') {
                svcTenant.setTenantId(String(activeTenant));
            }
        } catch (_) {}

        // Load from 'preromaneios'
        const result = await window.firebaseService.loadFromFirebase('preromaneios');
        // Garantir que estamos pegando os dados corretos, evitando metadados como 'isMock' ou 'success'
        const data = (result && typeof result === 'object' && 'data' in result) ? result.data : result;

        const normalizeItem = (id, item) => {
            if (!item || typeof item !== 'object') return null;
            const rawId = item.id || item.numero || id;
            if (!rawId) return null;
            const hasAnyKey = !!(item.data || item.date || item.tipo || item.itens || item.cliente || item.clienteNome || item.fornecedorNome);
            if (!hasAnyKey) return null;
            return { id: String(rawId), ...item };
        };

        if (Array.isArray(data)) {
            cachedRomaneios = data.map((item, idx) => normalizeItem(item?.id || idx, item)).filter(Boolean);
        } else {
            cachedRomaneios = Object.entries(data || {}).map(([id, item]) => {
                if (id === 'isMock' || id === 'success' || id === '_metadata') return null;
                return normalizeItem(id, item);
            }).filter(Boolean);
        }
        if ((!cachedRomaneios || cachedRomaneios.length === 0) && activeTenant) {
            try {
                const nsKey = `companies/${String(activeTenant)}/preromaneios`;
                const rawLocal = localStorage.getItem(nsKey) || localStorage.getItem('preromaneios');
                const parsedLocal = rawLocal ? JSON.parse(rawLocal) : null;
                if (Array.isArray(parsedLocal)) {
                    cachedRomaneios = parsedLocal.map((item, idx) => normalizeItem(item?.id || idx, item)).filter(Boolean);
                } else if (parsedLocal && typeof parsedLocal === 'object') {
                    cachedRomaneios = Object.entries(parsedLocal).map(([id, item]) => normalizeItem(id, item)).filter(Boolean);
                }
            } catch (_) {}
        }
        if (activeTenant) {
            cachedRomaneios = cachedRomaneios.filter((item) => {
                const cid = item && (item.companyId || item.companyID || item.tenantId);
                return cid ? String(cid) === String(activeTenant) : false;
            });
        }
        
        // Sort by date desc
        cachedRomaneios.sort((a, b) => new Date(b.data || b.date || 0) - new Date(a.data || a.date || 0));

        const activeTab = (typeof window.currentTab === 'string' && window.currentTab) ? window.currentTab : null;
        if (activeTab) {
            cachedRomaneios = cachedRomaneios.filter(r => String(r.tipo || '').toUpperCase() === String(activeTab).toUpperCase());
        }

        currentPageRomaneios = 1;
        renderRomaneiosList();
    } catch (error) {
        console.error('Erro ao carregar romaneios:', error);
        tbody.innerHTML = '<tr><td colspan="6" class="text-center text-danger">Erro ao carregar dados.</td></tr>';
    }
}

function closeListaModal() {
    const modal = document.getElementById('listaModal');
    if (modal) modal.style.display = 'none';
}

function renderRomaneiosList(list = null) {
    const tbody = document.getElementById('listaRomaneiosTable');
    if (!tbody) return;

    const dataToRender = list || cachedRomaneios;
    tbody.innerHTML = '';

    if (dataToRender.length === 0) {
        tbody.innerHTML = '<tr><td colspan="6" class="text-center">Nenhum registro encontrado.</td></tr>';
        document.getElementById('listaRomaneiosPagination').innerHTML = '';
        return;
    }

    const start = (currentPageRomaneios - 1) * ITEMS_PER_PAGE;
    const end = start + ITEMS_PER_PAGE;
    const paginatedItems = dataToRender.slice(start, end);

    paginatedItems.forEach(item => {
        const tr = document.createElement('tr');
        const date = item.data ? new Date(item.data).toLocaleDateString('pt-BR', { timeZone: 'UTC' }) : '-';
        // Ajuste para pegar nome do cliente/fornecedor
        const client = item.clienteNome || (item.cliente ? item.cliente.nome : '') || item.fornecedorNome || '-';
        const type = item.tipo || 'PCT';
        
        // Ajuste para totais
        let volume = '0.000';
        let value = 'R$ 0,00';
        
        if (item.totais) {
            volume = (item.totais.volume !== undefined) ? parseFloat(item.totais.volume).toFixed(3) : '0.000';
            value = (item.totais.valor !== undefined) ? item.totais.valor.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }) : 'R$ 0,00';
        } else {
            // Fallback para estrutura antiga
            volume = (item.totalVolume || 0).toString();
            value = (item.totalValue || 0).toString();
        }

        tr.innerHTML = `
            <td>${date}</td>
            <td>${client}</td>
            <td>${type}</td>
            <td class="text-right">${volume} ${type === 'PES' ? 'pés³' : 'm³'}</td>
            <td class="text-right">${value}</td>
            <td class="text-center">
                <div class="actions-container">
                    <button class="btn-editar" onclick="carregarPreRomaneio('${item.id}')" title="Editar">
                        <i class="fas fa-edit"></i>
                    </button>
                    <button class="btn-excluir" onclick="excluirPreRomaneio('${item.id}')" title="Excluir">
                        <i class="fas fa-trash"></i>
                    </button>
                </div>
            </td>
        `;
        tbody.appendChild(tr);
    });

    renderPagination(dataToRender.length, currentPageRomaneios, 'listaRomaneiosPagination', (newPage) => {
        currentPageRomaneios = newPage;
        renderRomaneiosList(dataToRender);
    });
}

async function carregarPreRomaneio(id) {
    const item = cachedRomaneios.find(r => r.id === id);
    if (item) {
        // Call function in preromaneio.js to load data
        if (typeof loadPreRomaneioData === 'function') {
            loadPreRomaneioData(item);
            closeListaModal();
        } else {
            console.error('Função loadPreRomaneioData não encontrada em preromaneio.js');
        }
    }
}

async function excluirPreRomaneio(id) {
    if (!confirm('Tem certeza que deseja excluir este Pré-Romaneio?')) return;

    try {
        // Check if deleteData exists, otherwise try removeData or direct firebase
        if (window.firebaseService.deleteData) {
            await window.firebaseService.deleteData(`preromaneios/${id}`);
        } else if (window.firebaseService.removeData) {
            await window.firebaseService.removeData(`preromaneios/${id}`);
        } else {
            throw new Error('Método de exclusão não encontrado no serviço Firebase');
        }
        
        // Remove from cache and re-render
        cachedRomaneios = cachedRomaneios.filter(r => r.id !== id);
        renderRomaneiosList(cachedRomaneios); 
    } catch (error) {
        console.error('Erro ao excluir:', error);
        alert('Erro ao excluir registro: ' + error.message);
    }
}

// Close modals when clicking outside
window.onclick = function(event) {
    if (event.target.classList.contains('modal')) {
        event.target.style.display = 'none';
    }
}

// Expose functions globally
window.openClientListModal = openClientListModal;
window.closeClientListModal = closeClientListModal;
window.filterClientList = filterClientList;
window.selectPreRomaneioClient = selectPreRomaneioClient;
window.openNewClientModal = openNewClientModal;
window.closeNewClientModal = closeNewClientModal;

// Fornecedor functions are now handled by fornecedor-modals.js
if (typeof window.closeNewFornecedorModal !== 'function') {
    window.closeNewFornecedorModal = function() {
        try {
            const modal = document.getElementById('fornecedorModal');
            if (modal) modal.style.display = 'none';
            const form = document.getElementById('fornecedorForm');
            if (form) form.reset();
            const idInput = document.getElementById('fornecedorId');
            if (idInput) idInput.value = '';
        } catch (_) {}
    };
}

window.openSpeciesListModal = openSpeciesListModal;
window.closeSpeciesListModal = closeSpeciesListModal;
window.filterSpeciesList = filterSpeciesList;
window.selectSpecies = selectSpecies;
window.openNewSpeciesModal = openNewSpeciesModal;
window.closeNewSpeciesModal = closeNewSpeciesModal;

window.abrirLista = abrirLista;
window.closeListaModal = closeListaModal;
window.carregarPreRomaneio = carregarPreRomaneio;
window.excluirPreRomaneio = excluirPreRomaneio;
