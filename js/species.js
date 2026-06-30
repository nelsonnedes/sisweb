const authService = window.firebaseService.authService;
const speciesTools = window.SiswebSpecies || {};

function getSpeciesName(specie) {
    if (speciesTools.getDisplayName) return speciesTools.getDisplayName(specie);
    return String((specie && (specie.especie || specie.name || specie.nome || specie.nomeComum)) || '').trim();
}

function getSpeciesScientific(specie) {
    if (speciesTools.getScientificName) return speciesTools.getScientificName(specie);
    return String((specie && (specie.nomeCientifico || specie.scientificName || specie.scientific || specie.description || specie.descricao || specie.decription)) || '').trim();
}

function normalizeSpecies(specie, index = 0) {
    if (speciesTools.normalizeRecord) return speciesTools.normalizeRecord(specie, index);
    const name = getSpeciesName(specie) || 'Nome não informado';
    const scientific = getSpeciesScientific(specie);
    return {
        ...(specie || {}),
        id: (specie && (specie.firebaseKey || specie.key || specie.id)) || `specie_${index}`,
        especie: name,
        name,
        nome: name,
        nomeComum: (specie && (specie.nomeComum || specie.nome || specie.name)) || name,
        nomeCientifico: scientific,
        scientificName: scientific,
        scientific
    };
}

function toCanonicalSpecies(specie, index = 0, options = {}) {
    if (speciesTools.toCanonicalRecord) return speciesTools.toCanonicalRecord(specie, index, options);
    const now = options.updatedAt || new Date().toISOString();
    return {
        id: options.id || specie.firebaseKey || specie.key || specie.id || `specie_${index}`,
        especie: getSpeciesName(specie),
        nomeCientifico: getSpeciesScientific(specie),
        ativo: specie.ativo !== false,
        createdAt: specie.createdAt || now,
        updatedAt: now
    };
}

function normalizeSearchKey(value) {
    if (speciesTools.normalizeNameKey) return speciesTools.normalizeNameKey(value);
    return String(value || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().trim();
}

function escapeHtml(value) {
    if (speciesTools.escapeHtml) return speciesTools.escapeHtml(value);
    return String(value ?? '').replace(/[&<>"']/g, (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[char]));
}

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
    nameInput: document.getElementById('speciesName') || document.getElementById('name'),
    scientificNameInput: document.getElementById('scientificName'),
    speciesIdInput: document.getElementById('speciesId'),
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
        if (elements.speciesIdInput) elements.speciesIdInput.value = '';
        elements.modalTitle.textContent = 'Nova Espécie';
        elements.saveBtn.textContent = 'Salvar Espécie';
        enhanceSpeciesModal();
        openModal();
    };

    // New Button Listener
    if (elements.btnNewSpecies) {
        elements.btnNewSpecies.addEventListener('click', window.openNewSpeciesModal);
    }
}

function enhanceSpeciesModal() {
    if (window.SiswebSpeciesModal && typeof window.SiswebSpeciesModal.enhance === 'function') {
        window.SiswebSpeciesModal.enhance({
            modal: elements.modal,
            nameInput: elements.nameInput,
            scientificInput: elements.scientificNameInput,
            getSpeciesList: () => currentSpecies
        });
    }
}

// Data Operations
async function loadSpecies() {
    showLoading(true);
    try {
        await ensureAuthAndTenant();
        const result = await window.firebaseService.loadFromFirebase('especies');
        if (result.success && result.data) {
            // Convert object to array
            currentSpecies = (speciesTools.normalizeList
                ? speciesTools.normalizeList(result.data)
                : Object.keys(result.data).map((key, index) => {
                    const item = result.data[key] || {};
                    return normalizeSpecies({
                        ...item,
                        id: key,
                        key,
                        firebaseKey: key,
                        originalId: item.id || item.key || key
                    }, index);
                }));
            const emptyIds = currentSpecies
                .filter(s => !getSpeciesName(s) && !getSpeciesScientific(s))
                .map(s => s.id)
                .filter(Boolean);
            if (emptyIds.length) {
                let cleaned = 0;
                const deletedIds = new Set();
                for (const id of emptyIds.slice(0, 50)) {
                    try {
                        const del = await window.firebaseService.deleteData(`especies/${id}`);
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
        currentSpecies.sort((a, b) => getSpeciesName(a).localeCompare(getSpeciesName(b)));
        
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
    const scientificName = elements.scientificNameInput.value.trim();
    
    if (!name) {
        showToast('O nome é obrigatório', 'warning');
        return;
    }

    if (window.SiswebSpeciesModal && typeof window.SiswebSpeciesModal.getExactDuplicate === 'function') {
        const duplicate = window.SiswebSpeciesModal.getExactDuplicate(name, editingId, () => currentSpecies);
        if (duplicate) {
            showToast(`Espécie já cadastrada: ${getSpeciesName(duplicate)}. Use o cadastro existente para evitar duplicidade.`, 'warning');
            elements.nameInput.focus();
            return;
        }
    }

    showLoading(true);

    const now = new Date().toISOString();
    const speciesData = toCanonicalSpecies({
        id: editingId || undefined,
        especie: name,
        nomeCientifico: scientificName,
        updatedAt: now
    }, 0, { updatedAt: now });

    if (!editingId) {
        speciesData.createdAt = now;
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
                    finalId = window.firebaseService.database.ref('especies').push().key;
                } else {
                    finalId = Date.now().toString();
                }
            }
            // Adicionar o ID ao objeto de dados para garantir consistência
            const dataToSave = { ...speciesData, id: finalId };
            result = await saveMethod.call(window.firebaseService, `especies/${finalId}`, dataToSave);
        } else {
            let finalId = id;
            if (finalId === 'auto') {
                if (window.firebaseService.database) {
                    finalId = window.firebaseService.database.ref('especies').push().key;
                } else {
                    finalId = Date.now().toString();
                }
            }
            const dataToSave = { ...speciesData, id: finalId };
            result = await saveMethod.call(window.firebaseService, 'especies', finalId, dataToSave);
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
    const normalizedId = String(id || '').trim();
    const species = currentSpecies.find(s => [s && s.id, s && s.key, s && s.firebaseKey, s && s.originalId]
        .map(value => String(value || '').trim())
        .filter(Boolean)
        .includes(normalizedId));
    if (!species) return;

    editingId = String((species.firebaseKey || species.key || species.id || id) || '').trim();
    if (elements.speciesIdInput) elements.speciesIdInput.value = editingId;
    elements.nameInput.value = getSpeciesName(species);
    elements.scientificNameInput.value = getSpeciesScientific(species);
    
    elements.modalTitle.textContent = 'Editar Espécie';
    elements.saveBtn.textContent = 'Atualizar Espécie';
    enhanceSpeciesModal();
    
    openModal();
};

window.deleteSpecies = async (id) => {
    if (!confirm('Tem certeza que deseja excluir esta espécie?')) return;

    showLoading(true);
    try {
        const tenant = await ensureAuthAndTenant();
        // Excluir no caminho canônico.
        const result = await window.firebaseService.deleteData(`especies/${id}`);
        
        if (result.success) {
            currentSpecies = currentSpecies.filter(s => s.id !== id);
            try {
                if (window.firebaseService && typeof window.firebaseService.removeLocalStorage === 'function') {
                    window.firebaseService.removeLocalStorage('especies');
                    window.firebaseService.removeLocalStorage(`companies/${tenant}/especies`);
                    window.firebaseService.removeLocalStorage(`especies/${id}`);
                    window.firebaseService.removeLocalStorage(`companies/${tenant}/especies/${id}`);
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
            <td>${escapeHtml(getSpeciesName(item) || '-')}</td>
            <td>${escapeHtml(getSpeciesScientific(item) || '-')}</td>
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
    const lower = normalizeSearchKey(text);
    return list.filter(item => {
        const haystack = [
            getSpeciesName(item),
            getSpeciesScientific(item),
            item.nomeComum,
            item.commonName
        ].map(normalizeSearchKey).join(' ');
        return haystack.includes(lower);
    });
}

function openModal() {
    elements.modal.style.display = 'flex';
    elements.modal.setAttribute('aria-hidden', 'false');
    elements.nameInput.focus();
}

function closeModal() {
    elements.modal.style.display = 'none';
    elements.modal.setAttribute('aria-hidden', 'true');
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
