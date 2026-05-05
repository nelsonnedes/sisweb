const authService = window.firebaseService.authService;

// State
let currentList = [];
let editingId = null;
let currentPage = 1;
const itemsPerPage = 10;
let tenantReadyPromise = null;

function resolveTenantIdLocal() {
    try {
        if (window.firebaseService && typeof window.firebaseService.getTenantId === 'function') {
            const byService = window.firebaseService.getTenantId();
            if (byService) return String(byService);
        }
    } catch (_) {}
    try {
        if (window.appTenantId) return String(window.appTenantId);
    } catch (_) {}
    try {
        const raw = localStorage.getItem('company_info');
        if (raw) {
            const info = JSON.parse(raw);
            const id = info && (info.companyId || info.companyID || info.tenantId || info.id);
            if (id) return String(id);
        }
    } catch (_) {}
    return null;
}

async function ensureTenantContext() {
    const immediate = resolveTenantIdLocal();
    if (immediate) {
        try {
            if (window.firebaseService && typeof window.firebaseService.setTenantId === 'function') {
                window.firebaseService.setTenantId(immediate);
            }
        } catch (_) {}
        return immediate;
    }
    if (tenantReadyPromise) return tenantReadyPromise;
    tenantReadyPromise = (async () => {
        const fromAuth = await (async () => {
            try {
                if (authService && typeof authService.getCurrentUser === 'function') {
                    const user = await authService.getCurrentUser();
                    if (!user) return null;
                    let companyId = null;
                    try {
                        if (typeof user.getIdTokenResult === 'function') {
                            const token = await user.getIdTokenResult();
                            companyId = token && token.claims && (token.claims.companyId || token.claims.companyID || token.claims.tenantId);
                        }
                    } catch (_) {}
                    if (!companyId && window.firebaseService && typeof window.firebaseService.loadFromFirebase === 'function' && user.uid) {
                        try {
                            const res = await window.firebaseService.loadFromFirebase(`users/${user.uid}`);
                            const profile = res && res.data ? res.data : null;
                            companyId = profile && (profile.companyId || profile.companyID || profile.tenantId);
                        } catch (_) {}
                    }
                    return companyId ? String(companyId) : null;
                }
            } catch (_) {}
            return null;
        })();
        if (fromAuth) {
            try {
                if (window.firebaseService && typeof window.firebaseService.setTenantId === 'function') {
                    window.firebaseService.setTenantId(fromAuth);
                }
                window.appTenantId = fromAuth;
                const raw = localStorage.getItem('company_info');
                const prev = raw ? JSON.parse(raw) : {};
                const next = { ...prev, companyId: fromAuth, id: prev.id || fromAuth };
                localStorage.setItem('company_info', JSON.stringify(next));
            } catch (_) {}
            return fromAuth;
        }
        const waited = await new Promise((resolve) => {
            let done = false;
            const finish = (value) => {
                if (done) return;
                done = true;
                try { window.removeEventListener('tenantContextReady', onTenantReady); } catch (_) {}
                try { window.removeEventListener('firebaseReady', onFirebaseReady); } catch (_) {}
                resolve(value || null);
            };
            const onTenantReady = () => {
                const t = resolveTenantIdLocal();
                if (t) finish(t);
            };
            const onFirebaseReady = () => {
                const t = resolveTenantIdLocal();
                if (t) finish(t);
            };
            try { window.addEventListener('tenantContextReady', onTenantReady); } catch (_) {}
            try { window.addEventListener('firebaseReady', onFirebaseReady); } catch (_) {}
            setTimeout(() => finish(resolveTenantIdLocal()), 2500);
        });
        if (waited) {
            try {
                if (window.firebaseService && typeof window.firebaseService.setTenantId === 'function') {
                    window.firebaseService.setTenantId(waited);
                }
            } catch (_) {}
        }
        return waited;
    })();
    return tenantReadyPromise;
}

function normalizeFornecedor(item, fallbackId = null) {
    const nome = String(item?.name || item?.nome || '').trim();
    const estado = String(item?.state || item?.estado || '').trim();
    const cidade = String(item?.city || item?.cidade || '').trim();
    const telefone = String(item?.phone || item?.telefone || '').trim();
    const endereco = String(item?.address || item?.endereco || '').trim();
    const id = String(item?.id || fallbackId || '').trim();
    const createdAt = item?.createdAt || item?.created || null;
    const updatedAt = item?.updatedAt || item?.updated || null;
    return {
        id,
        name: nome,
        nome,
        cnpj: String(item?.cnpj || '').trim(),
        email: String(item?.email || '').trim(),
        phone: telefone,
        telefone,
        address: endereco,
        endereco,
        city: cidade,
        cidade,
        state: estado,
        estado,
        createdAt: createdAt || new Date().toISOString(),
        updatedAt: updatedAt || new Date().toISOString()
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
    addressInput: document.getElementById('address'),
    citySelect: document.getElementById('city'),
    stateSelect: document.getElementById('state'),
    
    saveBtn: document.getElementById('saveBtn'),
    cancelBtn: document.getElementById('cancelBtn'),
    closeBtn: document.querySelector('.close'),
    pagination: document.getElementById('pagination'),
    loadingOverlay: document.getElementById('loadingOverlay'),
    totalRecords: document.getElementById('totalRecords'),
    btnNewFornecedor: document.getElementById('btnNewFornecedor')
};

// Initialize
(async () => {
    setupListeners();
    setupMasks();
    await ensureTenantContext();
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

    window.openNewModal = () => {
        editingId = null;
        elements.form.reset();
        elements.modalTitle.textContent = 'Novo Fornecedor';
        elements.saveBtn.textContent = 'Salvar';
        elements.citySelect.innerHTML = '<option value="">Selecione primeiro o estado</option>';
        openModal();
    };

    if (elements.btnNewFornecedor) {
        elements.btnNewFornecedor.addEventListener('click', window.openNewModal);
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
            elements.citySelect.appendChild(option);
        });

        if (selectedCity) {
            elements.citySelect.value = selectedCity;
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
        await ensureTenantContext();
        const fornecedoresResult = await window.firebaseService.loadFromFirebase('fornecedores');
        const fornecedoresList = extractListFromResult(fornecedoresResult);
        let loadedList = fornecedoresList;
        if (!loadedList.length) {
            const clientsResult = await window.firebaseService.loadFromFirebase('clients');
            loadedList = extractListFromResult(clientsResult);
        }
        currentList = loadedList.map(item => normalizeFornecedor(item, item.id));
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
    await ensureTenantContext();
    const existingItem = editingId ? currentList.find((item) => String(item.id) === String(editingId)) : null;

    const nowIso = new Date().toISOString();
    const data = normalizeFornecedor({
        id: editingId || undefined,
        name,
        nome: name,
        cnpj: elements.cnpjInput.value.trim(),
        email: elements.emailInput.value.trim(),
        phone: elements.phoneInput.value.trim(),
        telefone: elements.phoneInput.value.trim(),
        address: elements.addressInput.value.trim(),
        endereco: elements.addressInput.value.trim(),
        city: elements.citySelect.value,
        cidade: elements.citySelect.value,
        state: elements.stateSelect.value,
        estado: elements.stateSelect.value,
        createdAt: editingId ? (existingItem?.createdAt || existingItem?.created || nowIso) : nowIso,
        updatedAt: nowIso
    }, editingId || undefined);

    try {
        const id = editingId || 'auto';
        const saveMethod = window.firebaseService.saveToFirebase || window.firebaseService.saveData;
        
        if (typeof saveMethod !== 'function') {
            throw new Error('Serviço de salvamento não disponível');
        }

        // Se o método for saveData, precisamos construir o caminho com ID
        // Se o ID for 'auto', precisamos gerar um novo ID primeiro
        let result;
        if (saveMethod.name === 'saveData' || saveMethod === window.firebaseService.saveData) {
            let finalId = id;
            if (finalId === 'auto') {
                // Gerar ID usando push().key se possível, ou timestamp
                if (window.firebaseService.database) {
                    // Criar referência para gerar ID sem criar registro vazio
                    finalId = window.firebaseService.database.ref('fornecedores').push().key;
                } else {
                    finalId = Date.now().toString();
                }
            }
            // Chamar saveData com o caminho completo
            // Adicionar o ID ao objeto de dados para garantir consistência
            const dataToSave = normalizeFornecedor({ ...data, id: finalId }, finalId);
            result = await saveMethod.call(window.firebaseService, `fornecedores/${finalId}`, dataToSave);
        } else {
            // Fallback para saveToFirebase (legado)
            const finalId = id === 'auto' ? String(Date.now()) : String(id);
            const dataToSave = normalizeFornecedor({ ...data, id: finalId }, finalId);
            result = await saveMethod.call(window.firebaseService, 'fornecedores', finalId, dataToSave);
        }
        
        if (result.success) {
            showToast(editingId ? 'Fornecedor atualizado!' : 'Fornecedor criado!', 'success');
            closeModal();
            await loadData();
        } else {
            throw new Error(result.error);
        }
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
    elements.cnpjInput.value = item.cnpj || '';
    elements.emailInput.value = item.email || '';
    elements.phoneInput.value = item.phone || item.telefone || '';
    elements.addressInput.value = item.address || item.endereco || '';
    elements.stateSelect.value = item.state || item.estado || '';
    
    if (item.state || item.estado) {
        await loadCities(item.state || item.estado, item.city || item.cidade);
    } else {
        elements.citySelect.innerHTML = '<option value="">Selecione primeiro o estado</option>';
    }
    
    elements.modalTitle.textContent = 'Editar Fornecedor';
    elements.saveBtn.textContent = 'Atualizar';
    
    openModal();
};

window.deleteItem = async (id) => {
    if (!confirm('Tem certeza que deseja excluir este fornecedor?')) return;

    showLoading(true);
    try {
        await ensureTenantContext();
        const result = await window.firebaseService.deleteData(`fornecedores/${id}`);
        
        if (result.success) {
            showToast('Fornecedor excluído!', 'success');
            await loadData();
        } else {
            throw new Error(result.error);
        }
    } catch (error) {
        console.error('Erro ao excluir:', error);
        showToast('Erro ao excluir: ' + error.message, 'error');
    } finally {
        showLoading(false);
    }
};

function extractListFromResult(result) {
    if (!result || !result.success || !result.data) return [];
    const data = result.data;
    if (Array.isArray(data)) {
        return data
            .filter(item => item && typeof item === 'object')
            .map((item, index) => ({ id: String(item.id || index), ...item }));
    }
    if (typeof data === 'object') {
        return Object.keys(data).map(key => ({ id: String(key), ...(data[key] || {}) }));
    }
    return [];
}

// UI Helpers
function renderTable(list = currentList) {
    const start = (currentPage - 1) * itemsPerPage;
    const end = start + itemsPerPage;
    const paginatedItems = list.slice(start, end);
    
    elements.tableBody.innerHTML = paginatedItems.map(item => `
        <tr>
            <td><strong>${item.name || item.nome || '-'}</strong></td>
            <td>${item.cnpj || '-'}</td>
            <td>${item.phone || item.telefone || '-'}</td>
            <td>${item.city || item.cidade || ''} / ${item.state || item.estado || ''}</td>
            <td class="actions-cell">
                <button onclick="editItem('${item.id}')" class="btn btn-sm btn-primary" title="Editar">
                    <i class="fas fa-edit"></i>
                </button>
                <button onclick="deleteItem('${item.id}')" class="btn btn-sm btn-danger" title="Excluir">
                    <i class="fas fa-trash"></i>
                </button>
            </td>
        </tr>
    `).join('');

    if (list.length === 0) {
        elements.tableBody.innerHTML = '<tr><td colspan="5" class="text-center">Nenhum fornecedor encontrado</td></tr>';
    }

    elements.totalRecords.textContent = `Total: ${list.length}`;
    renderPagination(list.length);
}

function renderPagination(totalItems) {
    const totalPages = Math.ceil(totalItems / itemsPerPage);
    elements.pagination.innerHTML = '';
    if (totalPages <= 1) return;

    const addBtn = (label, page, disabled = false, active = false) => {
        const btn = document.createElement('button');
        btn.textContent = label;
        if (active) btn.classList.add('active');
        btn.disabled = disabled;
        btn.onclick = () => changePage(page);
        elements.pagination.appendChild(btn);
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
            elements.pagination.appendChild(span);
        }
    }

    for (let i = startPage; i <= endPage; i++) {
        addBtn(String(i), i, false, i === currentPage);
    }

    if (endPage < totalPages) {
        if (endPage < totalPages - 1) {
            const span = document.createElement('span');
            span.textContent = '...';
            elements.pagination.appendChild(span);
        }
        addBtn(String(totalPages), totalPages, false, currentPage === totalPages);
    }

    addBtn('>', currentPage + 1, currentPage === totalPages);
    addBtn('>>>', totalPages, currentPage === totalPages);
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
        ((item.name || item.nome) && String(item.name || item.nome).toLowerCase().includes(lower)) ||
        (item.cnpj && item.cnpj.includes(text)) ||
        (item.email && item.email.toLowerCase().includes(lower))
    );
}

function openModal() {
    elements.modal.style.display = 'block';
    elements.nameInput.focus();
}

function closeModal() {
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
