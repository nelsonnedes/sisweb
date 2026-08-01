const authService = window.firebaseService.authService;

async function ensureAuthAndTenant() {
    const noRedirect = (() => {
        try { return new URLSearchParams(window.location.search).get('noRedirect') === 'true'; } catch (_) { return false; }
    })();
    const svc = window.firebaseService || window.firebaseServiceTL || window.FirebaseService;
    if (!svc) throw new Error('Serviço Firebase não disponível');
    if (!svc.authService || typeof svc.authService.getCurrentUser !== 'function') {
        throw new Error('Serviço de autenticação não disponível');
    }

    const user = await svc.authService.getCurrentUser();
    if (!user) {
        if (!noRedirect) window.location.href = 'login.html';
        throw new Error('Usuário não autenticado');
    }

    let tenant = (typeof svc.getTenantId === 'function') ? svc.getTenantId() : (window.appTenantId || null);
    if (!tenant) {
        try {
            if (typeof firebase !== 'undefined' && firebase.auth && firebase.auth().currentUser) {
                const token = await firebase.auth().currentUser.getIdTokenResult();
                const companyId = token && token.claims && (token.claims.companyId || token.claims.companyID || token.claims.tenantId);
                if (companyId && typeof svc.setTenantId === 'function') {
                    svc.setTenantId(companyId);
                    try {
                        const raw = localStorage.getItem('company_info');
                        const prev = raw ? JSON.parse(raw) : {};
                        localStorage.setItem('company_info', JSON.stringify({ ...prev, companyId: String(companyId), id: prev.id || String(companyId) }));
                    } catch (_) {}
                }
            }
        } catch (_) {}
        tenant = (typeof svc.getTenantId === 'function') ? svc.getTenantId() : (window.appTenantId || null);
    }

    if (!tenant) {
        try {
            const userPath = `users/${user.uid}`;
            const profileRes = await svc.loadFromFirebase(userPath);
            const profile = profileRes && profileRes.success ? profileRes.data : null;
            const companyId = profile && (profile.companyId || profile.companyID || profile.tenantId);
            if (companyId && typeof svc.setTenantId === 'function') {
                svc.setTenantId(companyId);
                try {
                    const raw = localStorage.getItem('company_info');
                    const prev = raw ? JSON.parse(raw) : {};
                    localStorage.setItem('company_info', JSON.stringify({ ...prev, companyId: String(companyId), id: prev.id || String(companyId) }));
                } catch (_) {}
            }
        } catch (_) {}
        tenant = (typeof svc.getTenantId === 'function') ? svc.getTenantId() : (window.appTenantId || null);
    }

    if (!tenant) {
        showToast('Selecione/defina a empresa antes de salvar clientes.', 'warning');
        if (!noRedirect) window.location.href = 'company.html';
        throw new Error('Tenant/company não definido');
    }

    return tenant;
}

// State
let currentList = [];
let editingId = null;
let currentPage = 1;
const itemsPerPage = 10;

function escapeHtml(value) {
    return String(value ?? '')
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
}

function escapeJsString(value) {
    return String(value ?? '')
        .replace(/\\/g, '\\\\')
        .replace(/'/g, "\\'")
        .replace(/\r?\n/g, ' ');
}

function notifyParentClientsUpdated(detail = {}) {
    try {
        window.dispatchEvent(new CustomEvent('clients:updated', { detail }));
    } catch (_) {}
    try {
        if (window.parent && window.parent !== window) {
            window.parent.postMessage({
                source: 'sisweb-commerce-embedded',
                type: 'sisweb:clients:updated',
                detail
            }, window.location.origin);
        }
    } catch (_) {}
}

function refreshResponsiveTables() {
    try {
        if (window.SiswebCommerceResponsive && typeof window.SiswebCommerceResponsive.enhanceAll === 'function') {
            window.SiswebCommerceResponsive.enhanceAll();
        }
    } catch (_) {}
}

function textValue(...values) {
    for (const value of values) {
        const clean = String(value || '').trim();
        if (clean) return clean;
    }
    return '';
}

function buildFiscalFields(item = {}) {
    const documento = textValue(item.documento, item.document, item.cnpj, item.cpf);
    const tipoPessoa = textValue(item.tipoPessoa, item.personType, item.fiscalPersonType);
    const inscricaoEstadual = textValue(item.inscricaoEstadual, item.stateRegistration, item.ie);
    const inscricaoMunicipal = textValue(item.inscricaoMunicipal, item.municipalRegistration, item.im);
    const indIEDest = textValue(item.indIEDest, item.indicadorInscricaoEstadual, item.ieIndicator);
    const cep = textValue(item.cep, item.postalCode, item.zipCode);
    const complemento = textValue(item.complemento, item.complement);
    const codigoMunicipio = textValue(item.codigoMunicipio, item.municipioCodigo, item.municipalityCode, item.cMun, item.ibgeCode);
    const paisCodigo = textValue(item.paisCodigo, item.countryCode, item.cPais) || '1058';
    const pais = textValue(item.pais, item.country, item.countryName, item.xPais) || 'Brasil';
    const suframa = textValue(item.suframa, item.SUFRAMA);

    return {
        documento,
        document: documento,
        cnpj: documento,
        tipoPessoa,
        personType: tipoPessoa,
        fiscalPersonType: tipoPessoa,
        inscricaoEstadual,
        stateRegistration: inscricaoEstadual,
        ie: inscricaoEstadual,
        inscricaoMunicipal,
        municipalRegistration: inscricaoMunicipal,
        indIEDest,
        indicadorInscricaoEstadual: indIEDest,
        ieIndicator: indIEDest,
        cep,
        postalCode: cep,
        complemento,
        complement: complemento,
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
        xPais: pais,
        suframa
    };
}

function syncSelectedMunicipalityCode() {
    const codeInput = elements.municipalityCodeInput;
    const citySelect = elements.citySelect;
    if (!codeInput || !citySelect || codeInput.value) return;
    const selected = citySelect.options[citySelect.selectedIndex];
    const ibgeCode = selected && selected.dataset ? selected.dataset.ibgeCode : '';
    if (ibgeCode) codeInput.value = ibgeCode;
}

function restoreFiscalDefaults() {
    if (elements.countryCodeInput && !elements.countryCodeInput.value) elements.countryCodeInput.value = '1058';
    if (elements.countryNameInput && !elements.countryNameInput.value) elements.countryNameInput.value = 'Brasil';
}

function normalizeClient(item, fallbackId = null) {
    const nome = String(item?.name || item?.nome || '').trim();
    const estado = String(item?.state || item?.estado || '').trim();
    const cidade = String(item?.city || item?.cidade || '').trim();
    const telefone = String(item?.phone || item?.telefone || '').trim();
    const endereco = String(item?.address || item?.endereco || '').trim();
    const numero = String(item?.number || item?.numero || '').trim();
    const bairro = String(item?.neighborhood || item?.bairro || '').trim();
    const obs = String(item?.obs || item?.observacoes || item?.observations || '').trim();
    const id = String(item?.id || fallbackId || '').trim();
    const createdAt = item?.createdAt || item?.created || null;
    const updatedAt = item?.updatedAt || item?.updated || null;
    const fiscal = buildFiscalFields(item);
    return {
        id,
        nome,
        name: nome,
        nomeCompleto: String(item?.nomeCompleto || nome).trim(),
        ...fiscal,
        estado,
        state: estado,
        cidade,
        city: cidade,
        telefone,
        phone: telefone,
        email: String(item?.email || '').trim(),
        endereco,
        address: endereco,
        numero,
        number: numero,
        bairro,
        neighborhood: bairro,
        complemento: fiscal.complemento,
        complement: fiscal.complement,
        obs,
        observacoes: obs,
        observations: obs,
        tipo: 'cliente',
        category: 'cliente',
        status: String(item?.status || 'ativo').trim(),
        createdAt: createdAt || new Date().toISOString(),
        updatedAt: updatedAt || new Date().toISOString(),
        created: createdAt || new Date().toISOString(),
        updated: updatedAt || new Date().toISOString()
    };
}

// DOM Elements
const elements = {
    tableBody: document.getElementById('tableBody'),
    searchInput: document.getElementById('searchInput'),
    modal: document.getElementById('modalForm'),
    form: document.getElementById('mainForm'),
    modalTitle: document.getElementById('modalTitle'),
    
    // Form Inputs
    nameInput: document.getElementById('name'),
    cnpjInput: document.getElementById('cnpj'),
    emailInput: document.getElementById('email'),
    phoneInput: document.getElementById('phone'),
    personTypeInput: document.getElementById('personType'),
    ieIndicatorInput: document.getElementById('ieIndicator'),
    stateRegistrationInput: document.getElementById('stateRegistration'),
    municipalRegistrationInput: document.getElementById('municipalRegistration'),
    suframaInput: document.getElementById('suframa'),
    postalCodeInput: document.getElementById('postalCode'),
    addressInput: document.getElementById('address'),
    numberInput: document.getElementById('number'),
    neighborhoodInput: document.getElementById('neighborhood'),
    complementInput: document.getElementById('complement'),
    stateSelect: document.getElementById('state'),
    citySelect: document.getElementById('city'),
    municipalityCodeInput: document.getElementById('municipalityCode'),
    countryCodeInput: document.getElementById('countryCode'),
    countryNameInput: document.getElementById('countryName'),
    obsInput: document.getElementById('obs'),
    
    saveBtn: document.getElementById('saveBtn'),
    cancelBtn: document.getElementById('cancelBtn'),
    closeBtn: document.querySelector('.close-modal'),
    pagination: document.getElementById('pagination'),
    loadingOverlay: document.getElementById('loadingOverlay'),
    totalRecords: document.getElementById('totalRecords'),
    btnNewClient: document.getElementById('btnNewClient')
};

// Initialize
(async () => {
    setupListeners();
    setupMasks();
    try { await ensureAuthAndTenant(); } catch (_) { return; }
    await loadData();
})();

function setupListeners() {
    elements.searchInput.addEventListener('input', (e) => filterData(e.target.value));
    elements.form.addEventListener('submit', handleSave);
    elements.cancelBtn.addEventListener('click', closeModal);
    elements.closeBtn.addEventListener('click', closeModal);
    window.addEventListener('click', (e) => {
        if (e.target === elements.modal) closeModal();
    });

    // City Loading Logic
    elements.stateSelect.addEventListener('change', (e) => {
        loadCities(e.target.value);
    });
    elements.citySelect.addEventListener('change', syncSelectedMunicipalityCode);

    window.openNewModal = () => {
        editingId = null;
        elements.form.reset();
        restoreFiscalDefaults();
        elements.modalTitle.textContent = 'Novo Cliente';
        elements.saveBtn.textContent = 'Salvar';
        elements.citySelect.innerHTML = '<option value="">Selecione primeiro o estado</option>';
        openModal();
    };

    if (elements.btnNewClient) {
        elements.btnNewClient.addEventListener('click', window.openNewModal);
    }
}

function setupMasks() {
    // CNPJ Mask
    elements.cnpjInput.addEventListener('input', (e) => {
        let x = e.target.value.replace(/\D/g, '').match(/(\d{0,2})(\d{0,3})(\d{0,3})(\d{0,4})(\d{0,2})/);
        e.target.value = !x[2] ? x[1] : x[1] + '.' + x[2] + '.' + x[3] + '/' + x[4] + (x[5] ? '-' + x[5] : '');
    });
    
    // Phone Mask
    elements.phoneInput.addEventListener('input', (e) => {
        let x = e.target.value.replace(/\D/g, '').match(/(\d{0,2})(\d{0,5})(\d{0,4})/);
        e.target.value = !x[2] ? x[1] : '(' + x[1] + ') ' + x[2] + (x[3] ? '-' + x[3] : '');
    });

    if (elements.postalCodeInput) {
        elements.postalCodeInput.addEventListener('input', (e) => {
            const x = e.target.value.replace(/\D/g, '').slice(0, 8).match(/(\d{0,5})(\d{0,3})/);
            e.target.value = !x[2] ? x[1] : `${x[1]}-${x[2]}`;
        });
    }
}

async function loadCities(uf, selectedCity = null) {
    if (!uf) {
        elements.citySelect.innerHTML = '<option value="">Selecione primeiro o estado</option>';
        return;
    }
    
    elements.citySelect.innerHTML = '<option value="">Carregando...</option>';
    
    try {
        const response = await fetch(`https://servicodados.ibge.gov.br/api/v1/localidades/estados/${uf}/municipios`);
        const cities = await response.json();
        
        elements.citySelect.innerHTML = '<option value="">Selecione a cidade</option>';
        cities.sort((a, b) => a.nome.localeCompare(b.nome)).forEach(city => {
            const option = document.createElement('option');
            option.value = city.nome;
            option.textContent = city.nome;
            option.dataset.ibgeCode = String(city.id || '');
            elements.citySelect.appendChild(option);
        });

        if (selectedCity) {
            elements.citySelect.value = selectedCity;
            syncSelectedMunicipalityCode();
        }
    } catch (error) {
        console.error('Erro ao carregar cidades:', error);
        elements.citySelect.innerHTML = '<option value="">Erro ao carregar</option>';
    }
}

// Data Operations
async function loadData() {
    showLoading(true);
    try {
        await ensureAuthAndTenant();
        const result = await window.firebaseService.loadFromFirebase('clients');
        if (result.success && result.data) {
            currentList = Object.keys(result.data).map(key => normalizeClient(result.data[key], key));
        } else {
            currentList = [];
        }
        currentList = currentList.filter(item => String(item.name || item.nome || '').trim());
        currentList.sort((a, b) => String(a.name || a.nome || '').localeCompare(String(b.name || b.nome || ''), 'pt-BR'));
        
        renderTable();
    } catch (error) {
        console.error('Erro ao carregar dados:', error);
        showToast('Erro ao carregar dados', 'error');
    } finally {
        showLoading(false);
    }
}

async function handleSave(e) {
    e.preventDefault();
    
    const name = elements.nameInput.value.trim();
    if (!name) {
        showToast('O nome é obrigatório', 'warning');
        return;
    }

    showLoading(true);
    try { await ensureAuthAndTenant(); } catch (_) { showLoading(false); return; }

    const isEditMode = !!editingId;
    if (isEditMode && !String(editingId || '').trim()) {
        showToast('Falha de integridade: edição sem ID do cliente', 'error');
        showLoading(false);
        return;
    }
    const existingItem = isEditMode ? currentList.find((item) => String(item.id) === String(editingId)) : null;
    const nowIso = new Date().toISOString();
    const data = normalizeClient({
        id: isEditMode ? String(editingId) : undefined,
        nome: name,
        name,
        cnpj: elements.cnpjInput.value.trim(),
        documento: elements.cnpjInput.value.trim(),
        document: elements.cnpjInput.value.trim(),
        email: elements.emailInput?.value.trim() || '',
        tipoPessoa: elements.personTypeInput?.value.trim() || '',
        personType: elements.personTypeInput?.value.trim() || '',
        indIEDest: elements.ieIndicatorInput?.value.trim() || '',
        indicadorInscricaoEstadual: elements.ieIndicatorInput?.value.trim() || '',
        ieIndicator: elements.ieIndicatorInput?.value.trim() || '',
        inscricaoEstadual: elements.stateRegistrationInput?.value.trim() || '',
        stateRegistration: elements.stateRegistrationInput?.value.trim() || '',
        inscricaoMunicipal: elements.municipalRegistrationInput?.value.trim() || '',
        municipalRegistration: elements.municipalRegistrationInput?.value.trim() || '',
        suframa: elements.suframaInput?.value.trim() || '',
        cep: elements.postalCodeInput?.value.trim() || '',
        postalCode: elements.postalCodeInput?.value.trim() || '',
        telefone: elements.phoneInput.value.trim(),
        phone: elements.phoneInput.value.trim(),
        endereco: elements.addressInput.value.trim(),
        address: elements.addressInput.value.trim(),
        numero: elements.numberInput.value.trim(),
        number: elements.numberInput.value.trim(),
        bairro: elements.neighborhoodInput.value.trim(),
        neighborhood: elements.neighborhoodInput.value.trim(),
        complemento: elements.complementInput?.value.trim() || '',
        complement: elements.complementInput?.value.trim() || '',
        estado: elements.stateSelect.value,
        state: elements.stateSelect.value,
        cidade: elements.citySelect.value,
        city: elements.citySelect.value,
        codigoMunicipio: elements.municipalityCodeInput?.value.trim() || '',
        municipioCodigo: elements.municipalityCodeInput?.value.trim() || '',
        municipalityCode: elements.municipalityCodeInput?.value.trim() || '',
        cMun: elements.municipalityCodeInput?.value.trim() || '',
        paisCodigo: elements.countryCodeInput?.value.trim() || '1058',
        countryCode: elements.countryCodeInput?.value.trim() || '1058',
        cPais: elements.countryCodeInput?.value.trim() || '1058',
        pais: elements.countryNameInput?.value.trim() || 'Brasil',
        country: elements.countryNameInput?.value.trim() || 'Brasil',
        countryName: elements.countryNameInput?.value.trim() || 'Brasil',
        xPais: elements.countryNameInput?.value.trim() || 'Brasil',
        obs: elements.obsInput.value.trim(),
        observacoes: elements.obsInput.value.trim(),
        observations: elements.obsInput.value.trim(),
        createdAt: isEditMode ? (existingItem?.createdAt || existingItem?.created || nowIso) : nowIso,
        updatedAt: nowIso
    }, isEditMode ? String(editingId) : undefined);

    try {
        const isEditMode = !!editingId;
        const finalId = isEditMode
            ? String(editingId)
            : (window.firebaseService && window.firebaseService.database
                ? window.firebaseService.database.ref('clients').push().key
                : `${Date.now()}_${Math.random().toString(36).slice(2, 8)}`);

        const dataToSave = normalizeClient({ ...data, id: finalId }, finalId);

        let result;
        if (typeof window.saveClient === 'function') {
            await window.saveClient({ ...dataToSave, __editMode: isEditMode });
            result = { success: true };
        } else if (window.clientService && typeof window.clientService.saveClient === 'function') {
            await window.clientService.saveClient({ ...dataToSave, __editMode: isEditMode });
            result = { success: true };
        } else if (window.firebaseService && typeof window.firebaseService.saveData === 'function') {
            result = await window.firebaseService.saveData(`clients/${finalId}`, dataToSave);
        } else if (window.firebaseService && typeof window.firebaseService.saveToFirebase === 'function') {
            result = await window.firebaseService.saveToFirebase(`clients/${finalId}`, null, dataToSave);
        } else {
            throw new Error('Serviço de salvamento não disponível');
        }
        
        showToast(isEditMode ? 'Cliente atualizado!' : 'Cliente criado!', 'success');
        notifyParentClientsUpdated({ id: finalId, client: dataToSave });
        closeModal();
        try {
            if (window.firebaseService && typeof window.firebaseService.invalidateCache === 'function') {
                window.firebaseService.invalidateCache('clients');
            }
        } catch (_) {}
        await loadData();
    } catch (error) {
        console.error('Erro ao salvar:', error);
        showToast('Erro ao salvar: ' + error.message, 'error');
    } finally {
        showLoading(false);
    }
}

window.editItem = async (id) => {
    const item = currentList.find(s => s.id === id);
    if (!item) return;

    editingId = id;
    elements.nameInput.value = item.name || item.nome || '';
    elements.cnpjInput.value = item.documento || item.document || item.cnpj || item.cpf || '';
    if (elements.emailInput) elements.emailInput.value = item.email || '';
    if (elements.personTypeInput) elements.personTypeInput.value = item.tipoPessoa || item.personType || item.fiscalPersonType || '';
    if (elements.ieIndicatorInput) elements.ieIndicatorInput.value = item.indIEDest || item.indicadorInscricaoEstadual || item.ieIndicator || '';
    if (elements.stateRegistrationInput) elements.stateRegistrationInput.value = item.inscricaoEstadual || item.stateRegistration || item.ie || '';
    if (elements.municipalRegistrationInput) elements.municipalRegistrationInput.value = item.inscricaoMunicipal || item.municipalRegistration || '';
    if (elements.suframaInput) elements.suframaInput.value = item.suframa || '';
    if (elements.postalCodeInput) elements.postalCodeInput.value = item.cep || item.postalCode || '';
    elements.phoneInput.value = item.phone || item.telefone || '';
    elements.addressInput.value = item.address || item.endereco || '';
    elements.numberInput.value = item.number || item.numero || '';
    elements.neighborhoodInput.value = item.neighborhood || item.bairro || '';
    if (elements.complementInput) elements.complementInput.value = item.complemento || item.complement || '';
    elements.stateSelect.value = item.state || item.estado || '';
    if (elements.municipalityCodeInput) elements.municipalityCodeInput.value = item.codigoMunicipio || item.municipioCodigo || item.municipalityCode || item.cMun || item.ibgeCode || '';
    if (elements.countryCodeInput) elements.countryCodeInput.value = item.paisCodigo || item.countryCode || item.cPais || '1058';
    if (elements.countryNameInput) elements.countryNameInput.value = item.pais || item.country || item.countryName || item.xPais || 'Brasil';
    elements.obsInput.value = item.obs || '';
    
    if (item.state || item.estado) {
        await loadCities(item.state || item.estado, item.city || item.cidade);
    } else {
        elements.citySelect.innerHTML = '<option value="">Selecione primeiro o estado</option>';
    }
    
    elements.modalTitle.textContent = 'Editar Cliente';
    elements.saveBtn.textContent = 'Atualizar';
    
    openModal();
};

window.deleteItem = async (id) => {
    const cleanId = String(id || '').trim();
    if (!cleanId || cleanId === 'undefined' || cleanId === 'null') {
        showToast('ID do cliente inválido para exclusão', 'error');
        return;
    }
    if (!confirm('Tem certeza que deseja excluir este cliente?')) return;

    showLoading(true);
    try {
        await ensureAuthAndTenant();
        console.log('🗑️ Excluindo cliente via window.deleteClient:', cleanId);
        
        // Usar a função global corrigida que lida com multi-tenancy e limpeza de cache
        if (typeof window.deleteClient === 'function') {
            await window.deleteClient(cleanId);
        } else if (window.clientService && typeof window.clientService.deleteClient === 'function') {
            await window.clientService.deleteClient(cleanId);
        } else {
            // Fallback
            const result = await window.firebaseService.deleteData(`clients/${cleanId}`);
            if (!result.success) throw new Error(result.error);
        }
        
        showToast('Cliente excluído!', 'success');
        notifyParentClientsUpdated({ id: cleanId, deletedId: cleanId });
        try {
            if (window.firebaseService && typeof window.firebaseService.invalidateCache === 'function') {
                window.firebaseService.invalidateCache('clients');
            }
        } catch (_) {}
        await loadData();
    } catch (error) {
        console.error('Erro ao excluir:', error);
        showToast('Erro ao excluir: ' + (error.message || error), 'error');
    } finally {
        showLoading(false);
    }
};

// UI Helpers
function renderTable(list = currentList) {
    const start = (currentPage - 1) * itemsPerPage;
    const end = start + itemsPerPage;
    const paginatedItems = list.slice(start, end);
    
    elements.tableBody.innerHTML = paginatedItems.map(item => `
        <tr>
            <td data-label="Nome / Razão Social"><strong>${escapeHtml(item.name || item.nome || '-')}</strong></td>
            <td data-label="CNPJ / CPF">${escapeHtml(item.cnpj || '-')}</td>
            <td data-label="Telefone">${escapeHtml(item.phone || item.telefone || '-')}</td>
            <td data-label="Localização">${escapeHtml((item.city || item.cidade || '') + ' / ' + (item.state || item.estado || ''))}</td>
            <td data-label="Ações" class="actions-cell commerce-actions-cell">
                <div class="commerce-actions-wrap">
                <button onclick="editItem('${escapeJsString(item.id)}')" class="btn btn-sm btn-primary" title="Editar" aria-label="Editar cliente">
                    <i class="fas fa-edit"></i>
                </button>
                <button onclick="deleteItem('${escapeJsString(item.id)}')" class="btn btn-sm btn-danger" title="Excluir" aria-label="Excluir cliente">
                    <i class="fas fa-trash"></i>
                </button>
                </div>
            </td>
        </tr>
    `).join('');

    if (list.length === 0) {
        elements.tableBody.innerHTML = '<tr><td colspan="5" class="text-center">Nenhum cliente encontrado</td></tr>';
    }

    elements.totalRecords.textContent = `Total: ${list.length}`;
    renderPagination(list.length);
    refreshResponsiveTables();
}

function renderPagination(totalItems) {
    const totalPages = Math.ceil(totalItems / itemsPerPage);
    let html = '';
    
    if (totalPages > 1) {
        html += `<button onclick="changePage(1)" ${currentPage === 1 ? 'disabled' : ''}>&laquo;&laquo;&laquo;</button>`;
        html += `<button onclick="changePage(${currentPage - 1})" ${currentPage === 1 ? 'disabled' : ''}>&lt;</button>`;
        
        for (let i = 1; i <= totalPages; i++) {
            if (i === 1 || i === totalPages || (i >= currentPage - 2 && i <= currentPage + 2)) {
                html += `<button onclick="changePage(${i})" class="${i === currentPage ? 'active' : ''}">${i}</button>`;
            } else if (i === currentPage - 3 || i === currentPage + 3) {
                html += `<span>...</span>`;
            }
        }
        
        html += `<button onclick="changePage(${currentPage + 1})" ${currentPage === totalPages ? 'disabled' : ''}>&gt;</button>`;
        html += `<button onclick="changePage(${totalPages})" ${currentPage === totalPages ? 'disabled' : ''}>&raquo;&raquo;&raquo;</button>`;
    }
    
    elements.pagination.innerHTML = html;
}

window.changePage = (page) => {
    const filtered = filterList(currentList, elements.searchInput.value);
    const totalPages = Math.max(1, Math.ceil(filtered.length / itemsPerPage));
    const next = Math.min(totalPages, Math.max(1, Number(page) || 1));
    currentPage = next;
    renderTable(filtered);
};

function filterData(text) {
    currentPage = 1;
    const filtered = filterList(currentList, text);
    renderTable(filtered);
}

function filterList(list, text) {
    if (!text) return list;
    const lower = text.toLowerCase();
    return list.filter(item => 
        ((item.name || item.nome) && (item.name || item.nome).toLowerCase().includes(lower)) ||
        (item.cnpj && item.cnpj.includes(text)) ||
        ((item.city || item.cidade) && (item.city || item.cidade).toLowerCase().includes(lower))
    );
}

function openModal() {
    elements.modal.style.display = 'block';
    elements.nameInput.focus();
}

function closeModal() {
    editingId = null;
    if (elements.form) elements.form.reset();
    elements.modal.style.display = 'none';
}

function showLoading(show) {
    elements.loadingOverlay.style.display = show ? 'flex' : 'none';
}

function showToast(message, type = 'info') {
    const container = document.getElementById('toast-container');
    if (!container) return alert(message);
    
    const toast = document.createElement('div');
    toast.className = `toast ${type}`;
    toast.textContent = message;
    container.appendChild(toast);
    
    setTimeout(() => {
        toast.remove();
    }, 3000);
}
