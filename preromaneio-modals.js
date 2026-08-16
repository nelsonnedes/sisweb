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
const ITEMS_PER_PAGE = 4;
let currentPageClient = 1;
let currentPageSupplier = 1;
let currentPageSpecies = 1;
let currentPageRomaneios = 1;

// Estado do cliente em edição (padrão romaneiopct/romaneiopes)
let editingClientId = null;

function parseRomaneioDateCandidate(value) {
    if (!value) return 0;
    if (typeof value === 'number' && isFinite(value)) return value;
    if (value instanceof Date) {
        const t = value.getTime();
        return isNaN(t) ? 0 : t;
    }
    const t = Date.parse(value);
    return isNaN(t) ? 0 : t;
}

function getRomaneioRecencyTimestamp(item) {
    if (!item || typeof item !== 'object') return 0;
    const candidates = [
        item?._metadata?.lastUpdated,
        item.updatedAt,
        item.atualizadoEm,
        item.updated,
        item.lastModified,
        item.modifiedAt,
        item.createdAt,
        item.criadoEm,
        item.created,
        item.dataEmissao,
        item.data,
        item.date,
        item.dataHora,
        item.dataCriacao,
        item.timestamp
    ];
    for (const candidate of candidates) {
        const ts = parseRomaneioDateCandidate(candidate);
        if (ts) return ts;
    }
    const id = String(item.id || item.key || item.firebaseKey || item.numero || '');
    const match = id.match(/(\d{10,})/);
    return match ? Number(match[1]) || 0 : 0;
}

function getRomaneioDisplayDate(item) {
    return item?.dataEmissao || item?.data || item?.date || item?.dataHora || item?.createdAt || item?.criadoEm || item?.created || item?.timestamp || '';
}

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
    tbody.innerHTML = '<tr><td colspan="6" class="text-center">Carregando...</td></tr>';

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
            name: c.name || c.nome || 'Não informado',
            city: c.city || c.cidade || '',
            state: c.state || c.estado || '',
            phone: c.phone || c.telefone || c.celular || '',
            email: c.email || ''
        }));

        cachedClients = clientList;
        currentPageClient = 1; // Reset to first page
        renderClientList();

        // ✅ FOCO AUTOMÁTICO NO CAMPO DE FILTRO
        const filterInput = document.getElementById('clientListFilter');
        if (filterInput) {
            setTimeout(() => filterInput.focus(), 300);
        }
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
        tbody.innerHTML = '<tr><td colspan="6" class="text-center">Nenhum cliente encontrado.</td></tr>';
        document.getElementById('clientListPagination').innerHTML = '';
        return;
    }

    // Pagination Logic
    const start = (currentPageClient - 1) * ITEMS_PER_PAGE;
    const end = start + ITEMS_PER_PAGE;
    const paginatedItems = dataToRender.slice(start, end);

    const clientValue = (...values) => values.find(value => String(value || '').trim()) || 'Não informado';
    const appendCell = (row, value) => {
        const cell = document.createElement('td');
        cell.textContent = value;
        row.appendChild(cell);
    };
    const createClientAction = (className, title, icon, onClick) => {
        const button = document.createElement('button');
        button.type = 'button';
        button.className = `action-button ${className}`;
        button.title = title;
        button.setAttribute('aria-label', title);
        button.innerHTML = `<i class="fas ${icon}" aria-hidden="true"></i>`;
        button.addEventListener('click', onClick);
        return button;
    };

    paginatedItems.forEach(client => {
        const tr = document.createElement('tr');
        appendCell(tr, clientValue(client.name, client.nome));
        appendCell(tr, clientValue(client.city, client.cidade));
        appendCell(tr, clientValue(client.state, client.estado));
        appendCell(tr, clientValue(client.phone, client.telefone, client.celular));
        appendCell(tr, clientValue(client.email));

        const actionsCell = document.createElement('td');
        actionsCell.className = 'text-center actions-cell';
        const actionGroup = document.createElement('div');
        actionGroup.className = 'btn-group';
        actionGroup.appendChild(createClientAction('select-button', 'Selecionar Cliente', 'fa-check', () => selectPreRomaneioClient(client.id, clientValue(client.name, client.nome))));
        actionGroup.appendChild(createClientAction('edit-button', 'Editar Cliente', 'fa-edit', () => editPreRomaneioClient(client.id)));
        actionGroup.appendChild(createClientAction('delete-button', 'Excluir Cliente', 'fa-trash', () => deletePreRomaneioClient(client.id)));
        actionsCell.appendChild(actionGroup);
        tr.appendChild(actionsCell);
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
        [c.name, c.nome, c.city, c.cidade, c.state, c.estado, c.phone, c.telefone, c.celular, c.email]
            .some(value => String(value || '').toLowerCase().includes(term))
    );
    currentPageClient = 1; // Reset page on filter
    renderClientList(filtered);
}

function selectPreRomaneioClient(id, name) {
    const input = document.getElementById('clienteInput') || document.getElementById('clientInput');
    if (input) {
        input.value = name;
        input.dataset.id = id;
        try {
            input.dispatchEvent(new Event('input', { bubbles: true }));
            input.dispatchEvent(new Event('change', { bubbles: true }));
        } catch (_) {}
    }
    const found = cachedClients.find(c => String(c.id) === String(id)) || { id, name, nome: name };
    window.selectedClient = found;
    window.selectedFornecedor = found;
    window.clienteSelecionado = found;

    closeClientListModal();
    // Hide suggestions if open
    const suggestions = document.querySelector('.autocomplete-items');
    if (suggestions) suggestions.remove();
}

function populateClientModal(client) {
    const setField = (fieldId, value) => {
        const field = document.getElementById(fieldId);
        if (field && value !== undefined && value !== null) {
            field.value = value;
        }
    };
    setField('clientName', client.name || client.nome || '');
    setField('clientCnpj', client.cnpj || client.documento || client.document || client.cpf || '');
    setField('clientPersonType', client.tipoPessoa || client.personType || client.fiscalPersonType || '');
    setField('clientIndIEDest', client.indIEDest || client.indicadorInscricaoEstadual || client.ieIndicator || '');
    setField('clientStateRegistration', client.inscricaoEstadual || client.stateRegistration || client.ie || '');
    setField('clientMunicipalRegistration', client.inscricaoMunicipal || client.municipalRegistration || client.im || '');
    setField('clientSuframa', client.suframa || '');
    setField('clientState', client.estado || client.state || '');
    setField('clientPhone', client.phone || client.telefone || '');
    setField('clientEmail', client.email || '');
    setField('clientAddress', client.address || client.endereco || '');
    setField('clientNumber', client.number || client.numero || '');
    setField('clientNeighborhood', client.neighborhood || client.bairro || '');
    setField('clientComplement', client.complemento || client.complement || '');
    setField('clientCep', client.cep || client.postalCode || '');
    setField('clientMunicipalityCode', client.codigoMunicipio || client.municipioCodigo || client.municipalityCode || client.cMun || client.ibgeCode || '');
    setField('clientCountryCode', client.paisCodigo || client.countryCode || client.cPais || '1058');
    setField('clientCountryName', client.pais || client.country || client.countryName || client.xPais || 'Brasil');
    setField('clientObs', client.obs || client.observacoes || client.observations || '');
    const cidade = client.cidade || client.city || '';
    if (cidade) {
        const cityField = document.getElementById('clientCity');
        if (cityField) {
            const cityExists = Array.from(cityField.options).some(o => o.value === cidade);
            if (!cityExists) {
                const option = document.createElement('option');
                option.value = cidade;
                option.textContent = cidade;
                cityField.appendChild(option);
            }
            cityField.value = cidade;
        }
    }
}

function editPreRomaneioClient(id) {
    const client = cachedClients.find(c => String(c.id) === String(id));
    if (!client) {
        alert('Cliente não encontrado.');
        return;
    }
    const form = document.getElementById('clientForm');
    if (form) form.reset();
    const citySelect = document.getElementById('clientCity');
    if (citySelect) citySelect.innerHTML = '<option value="">Selecione primeiro o estado</option>';
    const title = document.getElementById('clientModalTitle');
    if (title) title.textContent = 'Editar Cliente';
    const saveBtn = document.querySelector('#clientModal .btn-save, #clientModal button[type="submit"]');
    if (saveBtn) saveBtn.textContent = 'Atualizar';
    editingClientId = client.id;
    populateClientModal(client);
    const modal = document.getElementById('clientModal');
    if (modal) modal.style.display = 'block';
}

async function deletePreRomaneioClient(id) {
    const client = cachedClients.find(c => String(c.id) === String(id));
    const clientName = client ? (client.name || client.nome || id) : id;
    if (!confirm(`Tem certeza que deseja excluir o cliente "${clientName}"?\n\nEsta ação não pode ser desfeita.`)) {
        return;
    }
    try {
        const ok = await (window.deleteClient
            ? window.deleteClient(id)
            : (window.clientService && window.clientService.deleteClient
                ? window.clientService.deleteClient(id)
                : false));
        if (ok) {
            cachedClients = cachedClients.filter(c => String(c.id) !== String(id));
            renderClientList();
        }
    } catch (error) {
        console.error('Erro ao excluir cliente:', error);
        alert('Erro ao excluir cliente: ' + (error.message || error));
    }
}

function openNewClientModal() {
    const listModal = document.getElementById('clientListModal');
    if (listModal) listModal.style.display = 'none';

    const modal = document.getElementById('clientModal');
    if (!modal) return;
    editingClientId = null;
    const title = document.getElementById('clientModalTitle');
    if (title) title.textContent = 'Novo Cliente';
    const saveBtn = document.querySelector('#clientModal .btn-save, #clientModal button[type="submit"]');
    if (saveBtn) saveBtn.textContent = 'Salvar';
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
            const editingId = editingClientId ? String(editingClientId) : null;
            if (!editingId) {
                try {
                    if (svc && svc.database && typeof svc.database.ref === 'function') {
                        id = svc.database.ref('clients').push().key;
                    }
                } catch (_) {}
                if (!id) id = `${Date.now()}`;
            } else {
                id = editingId;
            }
            const existing = editingId
                ? (cachedClients.find(c => String(c.id) === editingId) || {})
                : {};
            const dataToSave = {
                ...newClient,
                id,
                createdAt: existing.createdAt || nowIso,
                updatedAt: nowIso
            };

            let result = null;
            if (svc && typeof svc.saveData === 'function') {
                result = await svc.saveData(`clients/${id}`, dataToSave);
            } else if (svc && typeof svc.saveToFirebase === 'function') {
                result = await svc.saveToFirebase(`clients/${id}`, dataToSave);
            } else {
                throw new Error('Serviço de salvamento não disponível');
            }

            if (result && result.success) {
                if (editingId) {
                    const idx = cachedClients.findIndex(c => String(c.id) === editingId);
                    if (idx >= 0) {
                        cachedClients[idx] = dataToSave;
                    } else {
                        cachedClients.push(dataToSave);
                    }
                    cachedClients.sort((a, b) => (a.name || a.nome || '').localeCompare(b.name || b.nome || ''));
                    renderClientList();
                    alert('Cliente atualizado com sucesso!');
                }
                selectPreRomaneioClient(id, dataToSave.name);
                closeNewClientModal();
            } else {
                throw new Error('Erro ao salvar');
            }
        } catch (error) {
            console.error(error);
            alert('Erro ao salvar cliente.');
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
        let speciesList = [];
        if (window.SiswebSpeciesStore && typeof window.SiswebSpeciesStore.getAll === 'function') {
            speciesList = await window.SiswebSpeciesStore.getAll({ waitRemote: true, timeoutMs: 5000 });
        } else if (window.firebaseService && typeof window.firebaseService.loadFromFirebase === 'function') {
            let speciesData = await window.firebaseService.loadFromFirebase('especies');
            if (speciesData && speciesData.data) speciesData = speciesData.data;
            if (speciesData && typeof speciesData === 'object' && !Array.isArray(speciesData)) {
                speciesList = Object.keys(speciesData).map(key => ({
                    id: key,
                    key,
                    firebaseKey: key,
                    originalId: speciesData[key] && (speciesData[key].id || speciesData[key].key || key),
                    ...speciesData[key]
                }));
            } else if (Array.isArray(speciesData)) {
                speciesList = speciesData;
            }
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
        const displayName = item.especie || item.nome || item.name || 'Sem Nome';
        const displayDesc = item.nomeCientifico || item.scientificName || item.descricao || item.description || '-';
        // Preço ainda é necessário para a seleção, mas não exibido na coluna
        const price = item.price || item.preco || '0,00';
        
        const tr = document.createElement('tr');
        tr.innerHTML = `
            <td>${displayName}</td>
            <td>${displayDesc}</td>
            <td class="text-center">
                <div class="btn-group">
                    <button class="action-button select-button" onclick="selectSpecies('${displayName}', '${price}')" title="Selecionar Espécie">
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
        ((s.especie || s.nome || s.name || '').toLowerCase().includes(term)) ||
        ((s.nomeCientifico || s.scientificName || s.descricao || s.description || '').toLowerCase().includes(term))
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
    
    if (input) {
        input.value = name;
        try {
            input.dispatchEvent(new Event('input', { bubbles: true }));
            input.dispatchEvent(new Event('change', { bubbles: true }));
        } catch (_) {}
    }
    if (priceInput) {
        priceInput.value = price;
        try {
            priceInput.dispatchEvent(new Event('input', { bubbles: true }));
            priceInput.dispatchEvent(new Event('change', { bubbles: true }));
        } catch (_) {}
    }
    
    closeSpeciesListModal();
    // Hide suggestions
    const suggestions = document.querySelectorAll('.autocomplete-items');
    if (suggestions) suggestions.forEach(s => s.remove());
}

function openNewSpeciesModal() {
    const modal = document.getElementById('speciesModal');
    if (modal) {
        if (window.SiswebSpeciesModal && typeof window.SiswebSpeciesModal.enhance === 'function') {
            window.SiswebSpeciesModal.enhance({ modal });
        }
        modal.style.display = 'block';
    }
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
        const scientificInput = document.getElementById('speciesDescription') || document.getElementById('speciesDesc');
        const nomeCientifico = scientificInput ? scientificInput.value : '';

        if (window.SiswebSpeciesModal && typeof window.SiswebSpeciesModal.getExactDuplicate === 'function') {
            const duplicate = window.SiswebSpeciesModal.getExactDuplicate(name);
            if (duplicate) {
                alert(`Espécie já cadastrada: ${window.SiswebSpeciesModal.getDisplayName(duplicate)}. Use o cadastro existente para evitar duplicidade.`);
                document.getElementById('speciesName').focus();
                return;
            }
        }

        const now = new Date().toISOString();
        const speciesId = `ESP_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
        const newSpecies = window.SiswebSpecies && typeof window.SiswebSpecies.toCanonicalRecord === 'function'
            ? window.SiswebSpecies.toCanonicalRecord({ id: speciesId, especie: name, nomeCientifico, createdAt: now }, 0, { id: speciesId, updatedAt: now })
            : { id: speciesId, especie: name, nomeCientifico, createdAt: now, updatedAt: now };

        try {
            const result = await window.firebaseService.saveData(`especies/${speciesId}`, newSpecies);
            if (result && result.success) {
                selectSpecies(name, '');
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

        const normalizeTipoPreRomaneio = (value) => {
            const raw = value == null ? '' : String(value).trim().toUpperCase();
            if (!raw) return '';
            if (raw === 'TORA' || raw === 'TORAS') return 'TORA';
            if (raw === 'TL' || raw === 'TODA LARGURA' || raw === 'TODA_LARGURA') return 'TL';
            if (raw === 'PCT' || raw === 'PACOTE' || raw === 'PACOTES') return 'PCT';
            if (raw === 'PES' || raw === 'PÉS' || raw === 'PE') return 'PES';
            return raw;
        };
        const nonRecordKeys = new Set(['cliente', 'fornecedor', 'empresa', 'itens', 'items', 'romaneioitens', 'romaneioitems', 'toraitens', 'toraitems', 'totais', 'total', 'metadata', '_metadata']);
        const isTechnicalKey = (key) => String(key || '').trim().startsWith('_');
        const isRecordKey = (key) => {
            const k = String(key || '').trim();
            return !!k && !isTechnicalKey(k) && !nonRecordKeys.has(k.toLowerCase()) && (/^\d{8,}$/.test(k) || /^pre[-_]?romaneio/i.test(k) || /^pr[-_]/i.test(k));
        };
        const extractItens = (item) => {
            if (!item || typeof item !== 'object') return [];
            const raw = item.itens ?? item.items ?? item.romaneioItens ?? item.romaneioItems ?? item.toraItens ?? item.toraItems;
            if (Array.isArray(raw)) return raw;
            if (raw && typeof raw === 'object') return Object.values(raw);
            return [];
        };
        const normalizeItem = (id, item, tipoFallback = '') => {
            if (!item || typeof item !== 'object') return null;
            if (isTechnicalKey(id) || nonRecordKeys.has(String(id || '').trim().toLowerCase())) return null;
            const rawId = item.id || item.key || item.firebaseKey || item.numero || (isRecordKey(id) ? id : '');
            if (!rawId) return null;
            const tipo = normalizeTipoPreRomaneio(item.tipo || item.tipoRomaneio || item.romaneioTipo || item.categoria || item.modulo || tipoFallback);
            const hasItems = extractItens(item).length > 0 || !!(item.itens || item.items || item.romaneioItens || item.romaneioItems || item.toraItens || item.toraItems);
            const hasDate = !!(item.data || item.dataEmissao || item.date || item.dataHora || item.dataCriacao || item.criadoEm || item.createdAt || item.updatedAt || item.atualizadoEm);
            const hasParty = !!(item.cliente || item.clienteNome || item.fornecedor || item.fornecedorNome || item.nomeCliente);
            const hasTotals = !!(item.totais || item.totalVolume || item.volumeTotal || item.volume || item.totalValor || item.valorTotal || item.valor);
            const hasAnyKey = hasItems || tipo || (hasDate && (hasParty || hasTotals || rawId)) || (isRecordKey(id) && (hasParty || hasTotals));
            if (!hasAnyKey) return null;
            return { ...item, id: String(rawId), numero: item.numero || String(rawId), tipo: item.tipo || tipo || undefined };
        };
        const normalizeCollection = (raw) => {
            const records = [];
            const push = (id, item, tipoFallback = '') => {
                const normalized = normalizeItem(id, item, tipoFallback);
                if (normalized) records.push(normalized);
            };
            if (Array.isArray(raw)) {
                raw.forEach((item, idx) => push(item?.id || idx, item));
            } else if (raw && typeof raw === 'object') {
                push(raw.id || raw.numero || '', raw);
                Object.entries(raw).forEach(([id, item]) => {
                    if (!item || typeof item !== 'object' || isTechnicalKey(id) || nonRecordKeys.has(String(id).toLowerCase())) return;
                    const bucketTipo = normalizeTipoPreRomaneio(id);
                    const normalized = normalizeItem(id, item, bucketTipo);
                    if (normalized) {
                        records.push(normalized);
                    } else if (bucketTipo || Object.values(item).some(v => v && typeof v === 'object')) {
                        Object.entries(item).forEach(([childId, childItem]) => push(childId, childItem, bucketTipo));
                    }
                });
            }
            const byId = new Map();
            records.forEach((record) => {
                const id = String(record.id || record.numero || '').trim();
                if (!id || isTechnicalKey(id)) return;
                const existing = byId.get(id);
                if (!existing) {
                    byId.set(id, record);
                    return;
                }
                const existingTs = getRomaneioRecencyTimestamp(existing);
                const recordTs = getRomaneioRecencyTimestamp(record);
                const preferRecord = recordTs > existingTs || (
                    recordTs === existingTs &&
                    Object.keys(record).length + extractItens(record).length >= Object.keys(existing).length + extractItens(existing).length
                );
                const merged = preferRecord ? { ...existing, ...record, id } : { ...record, ...existing, id };
                merged.companyId = merged.companyId || existing.companyId || record.companyId;
                merged.companyID = merged.companyID || existing.companyID || record.companyID;
                merged.tenantId = merged.tenantId || existing.tenantId || record.tenantId;
                byId.set(id, merged);
            });
            return Array.from(byId.values());
        };

        cachedRomaneios = normalizeCollection(data);
        if ((!cachedRomaneios || cachedRomaneios.length === 0) && activeTenant) {
            try {
                const nsKey = `companies/${String(activeTenant)}/preromaneios`;
                const rawLocal = localStorage.getItem(nsKey);
                const parsedLocal = rawLocal ? JSON.parse(rawLocal) : null;
                cachedRomaneios = normalizeCollection(parsedLocal);
            } catch (_) {}
        }
        if (activeTenant) {
            cachedRomaneios = cachedRomaneios.filter((item) => {
                const cid = item && (item.companyId || item.companyID || item.tenantId);
                return cid ? String(cid) === String(activeTenant) : false;
            });
        }
        
        // Mais recentes primeiro, aceitando datas de emissao, atualizacao e criacao.
        cachedRomaneios.sort((a, b) => getRomaneioRecencyTimestamp(b) - getRomaneioRecencyTimestamp(a));

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
        const dateValue = getRomaneioDisplayDate(item);
        const dateObj = dateValue ? new Date(dateValue) : null;
        const date = dateObj && !isNaN(dateObj.getTime()) ? dateObj.toLocaleDateString('pt-BR', { timeZone: 'UTC' }) : '-';
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
                <div class="btn-group">
                    <button class="action-button edit-button" onclick="carregarPreRomaneio('${item.id}')" title="Editar Romaneio">
                        <i class="fas fa-edit"></i>
                    </button>
                    <button class="action-button delete-button" onclick="excluirPreRomaneio('${item.id}')" title="Excluir Romaneio">
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
