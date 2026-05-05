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
        showToast('Selecione/defina a empresa antes de gerenciar espécies.', 'warning');
        if (!noRedirect) window.location.href = 'company.html';
        throw new Error('Tenant/company não definido');
    }

    return tenant;
}

// State
let currentSpecies = [];
let editingId = null;
let currentPage = 1;
const itemsPerPage = 10;

// DOM Elements
const elements = {
    tableBody: document.getElementById('speciesTableBody'),
    searchInput: document.getElementById('searchInput'),
    modal: document.getElementById('speciesModal'),
    form: document.getElementById('speciesForm'),
    modalTitle: document.getElementById('modalTitle'),
    nameInput: document.getElementById('name'),
    descriptionInput: document.getElementById('description'),
    saveBtn: document.getElementById('saveBtn'),
    cancelBtn: document.getElementById('cancelBtn'),
    closeBtn: document.querySelector('.close'),
    pagination: document.getElementById('pagination'),
    loadingOverlay: document.getElementById('loadingOverlay'),
    totalRecords: document.getElementById('totalRecords'),
    btnNewSpecies: document.getElementById('btnNewSpecies')
};

// Initialize
(async () => {
    // Setup Listeners
    setupListeners();

    // Load Data
    try { await ensureAuthAndTenant(); } catch (_) { return; }
    await loadSpecies();
})();

function setupListeners() {
    // Search
    elements.searchInput.addEventListener('input', (e) => {
        filterSpecies(e.target.value);
    });

    // Form Submit
    elements.form.addEventListener('submit', handleSave);

    // Modal Controls
    elements.cancelBtn.addEventListener('click', closeModal);
    elements.closeBtn.addEventListener('click', closeModal);
    window.addEventListener('click', (e) => {
        if (e.target === elements.modal) closeModal();
    });

    // Add Button (Global scope for HTML access)
    window.openNewSpeciesModal = () => {
        editingId = null;
        elements.form.reset();
        elements.modalTitle.textContent = 'Nova Espécie';
        elements.saveBtn.textContent = 'Salvar';
        openModal();
    };

    // New Button Listener
    if (elements.btnNewSpecies) {
        elements.btnNewSpecies.addEventListener('click', window.openNewSpeciesModal);
    }
}

// Data Operations
async function loadSpecies() {
    showLoading(true);
    try {
        await ensureAuthAndTenant();
        const result = await window.firebaseService.loadFromFirebase('species');
        if (result.success && result.data) {
            // Convert object to array
            currentSpecies = Object.keys(result.data).map(key => ({
                id: key,
                ...result.data[key]
            }));
            currentSpecies = currentSpecies.map(s => {
                const name = String((s && (s.name ?? s.nome)) ?? '').trim();
                const description = String((s && (s.description ?? s.descricao)) ?? '').trim();
                const next = { ...s };
                if (!next.name && name) next.name = name;
                if (!next.description && description) next.description = description;
                return next;
            });
            const emptyIds = currentSpecies
                .filter(s => !String((s && (s.name ?? s.nome)) ?? '').trim() && !String((s && (s.description ?? s.descricao)) ?? '').trim())
                .map(s => s.id)
                .filter(Boolean);
            if (emptyIds.length) {
                let cleaned = 0;
                const deletedIds = new Set();
                for (const id of emptyIds.slice(0, 50)) {
                    try {
                        const del = await window.firebaseService.deleteData(`species/${id}`);
                        if (del && del.success) {
                            cleaned++;
                            deletedIds.add(id);
                        }
                    } catch (_) {}
                }
                currentSpecies = currentSpecies.filter(s => !deletedIds.has(s.id));
                if (cleaned) showToast(`Removidos ${cleaned} registros vazios.`, 'success');
            }
        } else {
            currentSpecies = [];
        }
        
        // Sort by name
        currentSpecies.sort((a, b) => String((a && (a.name || a.nome)) || '').localeCompare(String((b && (b.name || b.nome)) || '')));
        
        renderTable();
    } catch (error) {
        console.error('Erro ao carregar espécies:', error);
        showToast('Erro ao carregar espécies', 'error');
    } finally {
        showLoading(false);
    }
}

async function handleSave(e) {
    e.preventDefault();
    
    const name = elements.nameInput.value.trim();
    const description = elements.descriptionInput.value.trim();
    
    if (!name) {
        showToast('O nome é obrigatório', 'warning');
        return;
    }

    showLoading(true);

    const speciesData = {
        name,
        nome: name,
        description,
        descricao: description,
        updatedAt: new Date().toISOString()
    };

    if (!editingId) {
        speciesData.createdAt = new Date().toISOString();
    }

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
                if (window.firebaseService.database) {
                    // Criar referência para gerar ID sem criar registro vazio
                    finalId = window.firebaseService.database.ref('species').push().key;
                } else {
                    finalId = Date.now().toString();
                }
            }
            // Adicionar o ID ao objeto de dados para garantir consistência
            const dataToSave = { ...speciesData, id: finalId };
            result = await saveMethod.call(window.firebaseService, `species/${finalId}`, dataToSave);
        } else {
            let finalId = id;
            if (finalId === 'auto') {
                if (window.firebaseService.database) {
                    finalId = window.firebaseService.database.ref('species').push().key;
                } else {
                    finalId = Date.now().toString();
                }
            }
            const dataToSave = { ...speciesData, id: finalId };
            result = await saveMethod.call(window.firebaseService, 'species', finalId, dataToSave);
        }
        
        if (result.success) {
            showToast(editingId ? 'Espécie atualizada!' : 'Espécie criada!', 'success');
            closeModal();
            await loadSpecies();
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

window.editSpecies = (id) => {
    const species = currentSpecies.find(s => s.id === id);
    if (!species) return;

    editingId = id;
    elements.nameInput.value = species.name || species.nome || '';
    elements.descriptionInput.value = species.description || species.descricao || '';
    
    elements.modalTitle.textContent = 'Editar Espécie';
    elements.saveBtn.textContent = 'Atualizar';
    
    openModal();
};

window.deleteSpecies = async (id) => {
    if (!confirm('Tem certeza que deseja excluir esta espécie?')) return;

    showLoading(true);
    try {
        const tenant = await ensureAuthAndTenant();
        // Only delete from 'species'
        // Note: deleteData in firebaseService might need 'species/ID'
        const result = await window.firebaseService.deleteData(`species/${id}`);
        
        if (result.success) {
            currentSpecies = currentSpecies.filter(s => s.id !== id);
            try {
                if (window.firebaseService && typeof window.firebaseService.removeLocalStorage === 'function') {
                    window.firebaseService.removeLocalStorage('species');
                    window.firebaseService.removeLocalStorage(`companies/${tenant}/species`);
                    window.firebaseService.removeLocalStorage(`species/${id}`);
                    window.firebaseService.removeLocalStorage(`companies/${tenant}/species/${id}`);
                }
            } catch (_) {}
            showToast('Espécie excluída!', 'success');
            await loadSpecies();
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

// UI Helpers
function renderTable(list = currentSpecies) {
    const start = (currentPage - 1) * itemsPerPage;
    const end = start + itemsPerPage;
    const paginatedItems = list.slice(start, end);
    
    elements.tableBody.innerHTML = paginatedItems.map(item => `
        <tr>
            <td>${item.name || item.nome || '-'}</td>
            <td>${item.description || item.descricao || '-'}</td>
            <td class="actions-cell">
                <button onclick="editSpecies('${item.id}')" class="btn btn-sm btn-primary" title="Editar">
                    <i class="fas fa-edit"></i>
                </button>
                <button onclick="deleteSpecies('${item.id}')" class="btn btn-sm btn-danger" title="Excluir">
                    <i class="fas fa-trash"></i>
                </button>
            </td>
        </tr>
    `).join('');

    if (list.length === 0) {
        elements.tableBody.innerHTML = '<tr><td colspan="3" class="text-center">Nenhuma espécie encontrada</td></tr>';
    }

    elements.totalRecords.textContent = `Total: ${list.length}`;
    renderPagination(list.length);
}

function renderPagination(totalItems) {
    const totalPages = Math.ceil(totalItems / itemsPerPage);
    let html = '';
    
    if (totalPages > 1) {
        html += `<button onclick="changePage(1)" ${currentPage === 1 ? 'disabled' : ''}>&laquo;&laquo;</button>`;
        html += `<button onclick="changePage(${currentPage - 1})" ${currentPage === 1 ? 'disabled' : ''}>&lt;</button>`;
        
        for (let i = 1; i <= totalPages; i++) {
            if (i === 1 || i === totalPages || (i >= currentPage - 2 && i <= currentPage + 2)) {
                html += `<button onclick="changePage(${i})" class="${i === currentPage ? 'active' : ''}">${i}</button>`;
            } else if (i === currentPage - 3 || i === currentPage + 3) {
                html += `<span>...</span>`;
            }
        }
        
        html += `<button onclick="changePage(${currentPage + 1})" ${currentPage === totalPages ? 'disabled' : ''}>&gt;</button>`;
        html += `<button onclick="changePage(${totalPages})" ${currentPage === totalPages ? 'disabled' : ''}>&raquo;&raquo;</button>`;
    }
    
    elements.pagination.innerHTML = html;
}

window.changePage = (page) => {
    const filtered = filterList(currentSpecies, elements.searchInput.value);
    const totalPages = Math.max(1, Math.ceil(filtered.length / itemsPerPage));
    const next = Math.min(totalPages, Math.max(1, Number(page) || 1));
    currentPage = next;
    renderTable(filtered);
};

function filterSpecies(text) {
    currentPage = 1;
    const filtered = filterList(currentSpecies, text);
    renderTable(filtered);
}

function filterList(list, text) {
    if (!text) return list;
    const lower = text.toLowerCase();
    return list.filter(item => 
        (item.name && item.name.toLowerCase().includes(lower)) ||
        (item.nome && item.nome.toLowerCase().includes(lower)) ||
        (item.description && item.description.toLowerCase().includes(lower)) ||
        (item.descricao && item.descricao.toLowerCase().includes(lower))
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
    // Reuse existing toast logic if available or simple alert fallback
    // Assuming showToast is global or we create a simple container
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
