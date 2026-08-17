/**
 * 📋 ROMANEIO MANAGER UNIFICADO - SISTEMA TORA/PCT/TL/PES
 * 
 * Este arquivo consolida a gestão de TODOS os tipos de romaneios em uma única classe genérica.
 * 
 * ✅ Padrão Unificado: Usa a mesma lógica para Tora, PCT, TL e PES
 * ✅ Multi-Tenancy: Respeita a separação por empresa via firebaseService
 * ✅ Cache Inteligente: Prioriza Firebase mas mantém cache local seguro
 * ✅ Interface Padronizada: Modal, tabela e filtros consistentes
 * ✅ Retrocompatibilidade: Mantém funções de UI específicas do módulo Tora (Restauradas)
 */

console.log("📋 === ROMANEIO MANAGER UNIFICADO (v2.2 - Full UI) ===");

function escapeRomaneioHtml(value) {
    return String(value ?? '')
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#039;');
}

function toInlineRomaneioArg(value) {
    return escapeRomaneioHtml(JSON.stringify(String(value ?? '')));
}

// Helper para chaves de storage
function getStorageKey(key) {
    const clean = String(key || '').replace(/^\/+/, '');
    if (!clean) return null;
    if (/^companies\//.test(clean)) return clean;
    if (/^users\//.test(clean)) return null;
    try {
        const svc = window.firebaseService || window.FirebaseService;
        if (svc && typeof svc.getCurrentTenantId === 'function') {
            const t = svc.getCurrentTenantId();
            if (t) return `companies/${t}/${clean}`;
        }
        if (svc && typeof svc.getTenantId === 'function') {
            const t = svc.getTenantId();
            if (t) return `companies/${t}/${clean}`;
        }
    } catch (_) {}
    try {
        if (window.appTenantId) return `companies/${window.appTenantId}/${clean}`;
        const raw = localStorage.getItem('company_info');
        if (raw) {
            const obj = JSON.parse(raw);
            const id = obj && (obj.companyId || obj.companyID || obj.tenantId || obj.id);
            if (id) return `companies/${id}/${clean}`;
        }
    } catch (_) {}
    return null;
}

class RomaneioManager {
    constructor(type = 'tora') {
        this.type = type.toLowerCase();
        this.collectionKey = this._getCollectionKey(this.type);
        this.firebasePath = `romaneios/${this.type}`;
        this.storageKey = this.collectionKey;
        
        this.modalId = 'listaModal';
        this.tableId = 'romaneioListTable';
        this.filterId = 'romaneioListFilter';
        this.title = this._getTitle(this.type);
        
        this.allRomaneios = [];
        this.filteredRomaneios = [];
        this.currentFilter = '';
        this.currentPage = 1;
        this.loadUserPreferences();
        
        this.deletedKey = `${this.collectionKey}_deletedIds`;
        
        console.log(`🏗️ Manager inicializado para: ${this.type.toUpperCase()} (${this.collectionKey})`);
        this.setupRealtimeRomaneios();
    }

    get itemsPerPage() {
        return (window.RomaneioListColumns && typeof window.RomaneioListColumns.getPageSize === 'function')
            ? window.RomaneioListColumns.getPageSize(this.type || 'tora', 10)
            : 10;
    }
    
    _getCollectionKey(type) {
        const map = { 'tora': 'romaneios/tora', 'pct': 'romaneios/pct', 'tl': 'romaneios/tl', 'pes': 'romaneios/pes' };
        return map[type] || `romaneios${type.charAt(0).toUpperCase() + type.slice(1)}`;
    }
    
    _getTitle(type) {
        const map = { 'tora': 'Lista de Romaneios de Tora', 'pct': 'Romaneios PCT', 'tl': 'Romaneios TL', 'pes': 'Romaneios PES' };
        return map[type] || `Romaneios ${type.toUpperCase()}`;
    }

    async getData(forceRefresh = false) {
        const key = this.collectionKey;
        try {
            let data = [];

            if (window.firebaseService && typeof window.firebaseService.loadFromFirebase === 'function') {
                try {
                    const result = await window.firebaseService.loadFromFirebase(key);
                    if (result && result.success) {
                        const firebaseData = result.data;
                        if (window.RomaneioDataUtils && typeof window.RomaneioDataUtils.normalizeRomaneioCollection === 'function') {
                            data = window.RomaneioDataUtils.normalizeRomaneioCollection(firebaseData, { type: this.type });
                        } else if (Array.isArray(firebaseData)) {
                            data = firebaseData.filter(item => item && typeof item === 'object' && (item.id || item.firebaseKey || item.numero));
                        } else if (firebaseData && typeof firebaseData === 'object') {
                            data = Object.entries(firebaseData)
                                .map(([k, item]) => item && typeof item === 'object' ? ({ id: item.id || k, firebaseKey: k, ...item }) : null)
                                .filter(item => item && (item.id || item.firebaseKey || item.numero));
                        }
                        
                        try {
                            const tombKey = getStorageKey(this.deletedKey);
                            const tomb = tombKey ? JSON.parse(localStorage.getItem(tombKey) || '[]').map(String) : [];
                            if (tomb.length > 0) data = data.filter(r => !tomb.includes(String(r.id)) && !tomb.includes(String(r.firebaseKey)));
                        } catch (_) {}
                        
                        data.sort((a, b) => this.parseTime(b) - this.parseTime(a));
                        
                    } else if (result && result.data === null) {
                        data = [];
                    }
                } catch (err) {
                    console.error(`❌ [${this.type}] Erro crítico no loadFromFirebase:`, err);
                    data = [];
                }
            } else {
                data = [];
            }
            
            data = this.validateData(data);
            this.allRomaneios = data;
            return data;
        } catch (error) {
            console.error(`❌ [${this.type}] Erro ao carregar:`, error);
            return [];
        }
    }
    
    async loadFromLocalStorage() {
        try {
            const sk = getStorageKey(this.collectionKey);
            if (!sk) return [];
            const raw = localStorage.getItem(sk);
            if (raw) return JSON.parse(raw);
        } catch (_) {}
        return [];
    }
    
    validateData(data) {
        if (!Array.isArray(data)) return [];
        if (window.RomaneioDataUtils && typeof window.RomaneioDataUtils.isValidRomaneioRecord === 'function') {
            return data.filter(item => window.RomaneioDataUtils.isValidRomaneioRecord(item, item && (item.firebaseKey || item.key || item.id)));
        }
        return data.filter(item => item && (item.id || item.firebaseKey));
    }
    
    parseTime(r) {
        if (window.RomaneioDataUtils && typeof window.RomaneioDataUtils.parseRomaneioTimestamp === 'function') {
            return window.RomaneioDataUtils.parseRomaneioTimestamp(r);
        }
        const candidates = [
            r?._metadata?.lastUpdated,
            r?.updatedAt,
            r?.updated,
            r?.lastModified,
            r?.dataEmissao,
            r?.data,
            r?.dataHora,
            r?.dataCriacao,
            r?.createdAt,
            r?.created,
            r?.timestamp
        ];
        for (const candidate of candidates) {
            if (!candidate) continue;
            const ts = typeof candidate === 'number' ? candidate : Date.parse(candidate);
            if (!isNaN(ts)) return ts;
        }
        const id = String(r?.id || r?.romaneioId || r?.firebaseKey || r?.key || r?.numero || r?.numeroRomaneio || '');
        const match = id.match(/(\d{10,})/);
        return match ? Number(match[1]) || 0 : 0;
    }

    async saveData(arg1, arg2) {
        try {
            // ✅ CORREÇÃO: Suporte a assinaturas (data) e (key, data)
            let data = arg1;
            if (typeof arg1 === 'string' && arg2) {
                // Chamada legado: saveData('key', data)
                console.warn(`⚠️ [${this.type}] saveData chamado com (key, data). Ajustando...`);
                data = arg2;
            }

            // ✅ VALIDAÇÃO CRÍTICA: Impedir salvamento de strings como dados
            if (typeof data === 'string') {
                console.error(`❌ [${this.type}] Erro crítico: Tentativa de salvar string como array de dados!`, data);
                return false;
            }

            if (!Array.isArray(data)) data = data ? [data] : [];
            let count = 0;
            
            // ✅ ATUALIZAÇÃO LOCAL IMEDIATA (Optimistic UI)
            // Isso previne o "sumiço" do romaneio enquanto o Firebase sincroniza
            const sk = getStorageKey(this.collectionKey);
            let localData = [];
            try {
                localData = sk ? JSON.parse(localStorage.getItem(sk) || '[]') : [];
            } catch (_) {}
            
            for (const item of data) {
                if (!item) continue;
                
                // ✅ VALIDAÇÃO EXTRA: Garantir que o item é um objeto válido
                if (typeof item !== 'object') {
                    console.warn(`⚠️ [${this.type}] Ignorando item inválido (não é objeto):`, item);
                    continue;
                }
                
                const id = item.id || item.firebaseKey || `${this.type.toUpperCase()}_${Date.now()}_${Math.random().toString(36).substr(2,5)}`;
                const record = { ...item, id, _metadata: { lastUpdated: Date.now(), source: 'romaneio-manager-unified', type: this.type } };
                
                // Salvar no Firebase
                if (window.firebaseService) {
                    if (typeof window.firebaseService.saveToFirebase === 'function') {
                        await window.firebaseService.saveToFirebase(this.collectionKey, String(id), record, { silent: true });
                    } else if (typeof window.firebaseService.saveData === 'function') {
                        await window.firebaseService.saveData(`${this.collectionKey}/${id}`, record);
                    }
                    count++;
                }
                
                // Atualizar cache local imediatamente
                const idx = localData.findIndex(r => r.id === id || r.firebaseKey === id);
                if (idx >= 0) localData[idx] = record;
                else localData.push(record);
                
                // Atualizar também a lista em memória
                const memIdx = this.allRomaneios.findIndex(r => r.id === id || r.firebaseKey === id);
                if (memIdx >= 0) this.allRomaneios[memIdx] = record;
                else this.allRomaneios.unshift(record);
            }
            
            // Persistir cache local atualizado
            if (count > 0 && sk) {
                localStorage.setItem(sk, JSON.stringify(localData));
                this.applyFilter(this.currentFilter);
                this.renderFilteredTable();
            }
            
            return count > 0;
        } catch (e) {
            console.error(`❌ [${this.type}] Erro ao salvar:`, e);
            throw e;
        }
    }
    
    async deleteData(id) {
        try {
            const sid = String(id);
            const rec = this.allRomaneios.find(r => String(r?.id) === sid || String(r?.firebaseKey) === sid) || null;
            const deleteKey = String((rec && (rec.firebaseKey || rec.id)) || sid);

            const tombKey = getStorageKey(this.deletedKey);
            const tomb = tombKey ? JSON.parse(localStorage.getItem(tombKey) || '[]').map(String) : [];
            if (!tomb.includes(deleteKey)) {
                tomb.push(deleteKey);
                if (tombKey) localStorage.setItem(tombKey, JSON.stringify(tomb));
            }
            if (window.firebaseService) {
                if (typeof window.firebaseService.saveToFirebase === 'function') {
                    await window.firebaseService.saveToFirebase(this.collectionKey, deleteKey, null, { silent: true });
                } else if (typeof window.firebaseService.updatePaths === 'function') {
                    await window.firebaseService.updatePaths({ [`${this.collectionKey}/${deleteKey}`]: null });
                } else if (typeof window.firebaseService.deleteData === 'function') {
                    await window.firebaseService.deleteData(`${this.collectionKey}/${deleteKey}`);
                }
            }

            try {
                const sk = getStorageKey(this.collectionKey);
                if (!sk) return;
                const raw = localStorage.getItem(sk);
                if (raw) {
                    const localData = JSON.parse(raw);
                    if (Array.isArray(localData)) {
                        const cleaned = localData.filter(r => String(r?.id) !== deleteKey && String(r?.firebaseKey) !== deleteKey);
                        localStorage.setItem(sk, JSON.stringify(cleaned));
                    } else if (localData && typeof localData === 'object') {
                        if (localData[deleteKey]) {
                            delete localData[deleteKey];
                            localStorage.setItem(sk, JSON.stringify(localData));
                        }
                    }
                }
            } catch (_) {}

            this.allRomaneios = this.allRomaneios.filter(r => String(r?.id) !== deleteKey && String(r?.firebaseKey) !== deleteKey);
            this.applyFilter(this.currentFilter);
            this.renderFilteredTable();
            // Disparar evento para atualizar UI externa se necessário
            try { window.dispatchEvent(new CustomEvent('romaneiosTora:updated', { detail: { id: deleteKey, action: 'delete', type: this.type } })); } catch {}
            try { window.dispatchEvent(new CustomEvent('romaneios:updated', { detail: { id: deleteKey, action: 'delete', type: this.type } })); } catch {}
            return true;
        } catch (e) {
            console.error(`❌ [${this.type}] Erro ao excluir:`, e);
            throw e;
        }
    }

    async forceRefreshList() {
        if (window.DEBUG_ROMANEIOS === true) console.log(`🔄 [${this.type}] Forçando atualização da lista via forceRefreshList()...`);
        await this.getData(true);
        this.applyFilter(this.currentFilter);
        this.renderFilteredTable();
        return true;
    }

    // UI
    async openModal(context = 'default') {
        this.createModal();
        const modal = document.getElementById(this.modalId);
        if (!modal) return;
        
        const titleEl = modal.querySelector('.modal-title');
        if (titleEl) titleEl.textContent = `📋 ${this.title}`;
        
        const tbody = document.getElementById(this.tableId);
        if (tbody) tbody.innerHTML = '<tr><td colspan="7" class="text-center p-4"><i class="fas fa-spinner fa-spin"></i> Carregando...</td></tr>';
        
        const filterInput = document.getElementById(this.filterId);
        if (filterInput) { filterInput.value = ''; filterInput.focus(); }
        this.currentFilter = '';
        this.currentPage = 1;
        
        modal.style.display = 'block';

        // Inicializar redimensionamento de colunas e altura de linhas
        const table = modal.querySelector('table');
        if (table && window.RomaneioListColumns && typeof window.RomaneioListColumns.initTable === 'function') {
            window.RomaneioListColumns.initTable(table, this.type || 'tora');
        }

        this.updatePaginationUI();

        await this.getData(true);
        this.applyFilter('');
        this.renderFilteredTable();
    }
    
    createModal() {
        let modal = document.getElementById(this.modalId);
        if (!modal) {
            // Injetar estilos específicos se não existirem
            if (!document.getElementById('romaneio-manager-styles')) {
                const style = document.createElement('style');
                style.id = 'romaneio-manager-styles';
                style.textContent = `
                    #${this.modalId} .modal-content {
                        width: 90%;
                        max-width: 1200px;
                        border-radius: 8px;
                        padding: 0;
                        box-shadow: 0 4px 20px rgba(0,0,0,0.2);
                        border: none;
                        overflow: hidden;
                    }
                    #${this.modalId} .modal-header {
                        display: flex;
                        justify-content: space-between;
                        align-items: center;
                        gap: 12px;
                        padding: 15px 20px;
                        margin: 0;
                        border-bottom: 1px solid #ddd;
                        background: linear-gradient(135deg, #2c3e50 0%, #34495e 100%);
                        color: white;
                        border-radius: 8px 8px 0 0;
                        overflow: hidden;
                    }
                    #${this.modalId} .modal-title {
                        margin: 0;
                        flex: 1 1 auto;
                        min-width: 0;
                        overflow: hidden;
                        text-overflow: ellipsis;
                        white-space: nowrap;
                        display: flex;
                        align-items: center;
                        gap: 8px;
                        line-height: 1.2;
                        color: white !important;
                        font-weight: bold;
                        font-size: 1.25rem;
                        text-shadow: 1px 1px 2px rgba(0,0,0,0.3);
                    }
                    #${this.modalId} .close-modal {
                        color: white !important;
                        opacity: 0.8;
                        font-size: 1.5rem;
                        cursor: pointer;
                        transition: opacity 0.2s;
                        background: none;
                        border: none;
                        padding: 0;
                        flex: 0 0 auto;
                        line-height: 1;
                    }
                    #${this.modalId} .close-modal:hover {
                        opacity: 1;
                    }

                    @media (max-width: 520px) {
                        #${this.modalId} .modal-header {
                            align-items: flex-start;
                        }
                        #${this.modalId} .modal-title {
                            white-space: normal;
                            line-height: 1.2;
                        }
                    }
                    #${this.modalId} .table-responsive {
                        border: 1px solid #ddd;
                        border-radius: 4px;
                        box-shadow: 0 2px 4px rgba(0,0,0,0.05);
                    }
                    #${this.modalId} table {
                        margin-bottom: 0;
                        width: 100%;
                        border-collapse: collapse;
                    }
                    #${this.modalId} thead th {
                        background-color: #2c3e50;
                        color: white;
                        position: sticky;
                        top: 0;
                        z-index: 10;
                        padding: 12px 10px;
                        font-weight: 600;
                        text-transform: uppercase;
                        font-size: 0.85rem;
                        letter-spacing: 0.5px;
                        border-bottom: 2px solid #1a252f;
                    }
                    #${this.modalId} tbody td {
                        padding: 10px;
                        vertical-align: middle;
                        border-bottom: 1px solid #eee;
                        color: #333;
                        font-size: 0.9rem;
                    }
                    #${this.modalId} tbody tr:hover {
                        background-color: #f1f7fb;
                    }
                    #${this.modalId} .btn-action,
                    #${this.modalId} .actions-container .btn {
                        margin: 0 2px;
                        width: 32px;
                        height: 32px;
                        padding: 0;
                        display: inline-flex;
                        align-items: center;
                        justify-content: center;
                        border-radius: 4px;
                        transition: all 0.2s;
                    }
                    #${this.modalId} .btn-action:hover,
                    #${this.modalId} .actions-container .btn:hover {
                        transform: translateY(-1px);
                        box-shadow: 0 2px 4px rgba(0,0,0,0.1);
                    }
                    #${this.modalId} .modal-footer {
                        display: flex;
                        justify-content: space-between;
                        align-items: center;
                        padding: 12px 16px;
                        margin: 0;
                        border-top: 1px solid #e5e7eb;
                        background: #f8fafc;
                    }
                    #${this.modalId} .modal-body {
                        padding: 14px 16px;
                    }
                    #${this.modalId} .modal-info {
                        color: #666;
                        font-size: 0.9rem;
                    }
                    #${this.modalId} .close-btn-footer {
                        background-color: #6c757d;
                        color: white;
                        border: none;
                        padding: 8px 20px;
                        border-radius: 4px;
                        font-weight: 500;
                        cursor: pointer;
                        transition: background 0.2s;
                    }
                    #${this.modalId} button:not(:disabled) {
                        cursor: pointer;
                    }
                    #${this.modalId} button:disabled {
                        cursor: not-allowed;
                    }
                    #${this.modalId} .close-btn-footer:hover {
                        background-color: #5a6268;
                    }
                    #${this.modalId} .filter-input {
                        width: 100%;
                        padding: 10px 15px;
                        border: 1px solid #ced4da;
                        border-radius: 4px;
                        font-size: 0.95rem;
                        transition: border-color 0.2s;
                    }
                    #${this.modalId} .filter-input:focus {
                        border-color: #3498db;
                        outline: none;
                        box-shadow: 0 0 0 3px rgba(52, 152, 219, 0.1);
                    }
                    #paginationControls_${this.modalId}.pagination-controls {
                        display: flex;
                        gap: 6px;
                        justify-content: center;
                        align-items: center;
                        margin: 12px 0 4px;
                        flex-wrap: wrap;
                        width: 100%;
                    }
                    #paginationControls_${this.modalId}.pagination-controls button {
                        border: 1px solid #d0d7de;
                        background: #fff;
                        color: #2c3e50;
                        padding: 6px 10px;
                        border-radius: 4px;
                        cursor: pointer;
                        font-size: 12px;
                    }
                    #paginationControls_${this.modalId}.pagination-controls button.active {
                        background: #2c3e50;
                        color: #fff;
                        border-color: #2c3e50;
                    }
                    #paginationControls_${this.modalId}.pagination-controls button:disabled {
                        opacity: 0.5;
                        cursor: not-allowed;
                    }
                    #paginationControls_${this.modalId}.pagination-controls span {
                        padding: 0 4px;
                        color: #6c757d;
                    }
                `;
                document.head.appendChild(style);
            }

            modal = document.createElement('div');
            modal.id = this.modalId;
            modal.className = 'modal';
            modal.style.cssText = 'display: none; position: fixed; z-index: 9999; left: 0; top: 0; width: 100%; height: 100%; overflow: auto; background-color: rgba(0,0,0,0.5); backdrop-filter: blur(2px);';
            
            modal.innerHTML = `
                <div class="modal-content">
                    <div class="modal-header">
                        <h3 class="modal-title">📋 ${this.title}</h3>
                        <button type="button" class="close-modal">&times;</button>
                    </div>
                    <div class="modal-body">
                        <div class="filter-container mb-3">
                            <input type="text" id="${this.filterId}" class="filter-input" placeholder="🔍 Pesquisar por cliente, data ou observações...">
                        </div>
                        <div class="table-responsive">
                            <table class="table">
                                <thead>
                                    <tr>
                                        <th style="width: 15%">Data</th>
                                        <th style="width: 25%">Fornecedor/Cliente</th>
                                        <th style="width: 16%">Resumo</th>
                                        <th class="text-center" style="width: 10%">Itens</th>
                                        <th class="text-end" style="width: 10%">Volume</th>
                                        <th class="text-end" style="width: 10%">Valor Total</th>
                                        <th class="text-center" style="width: 14%">Ações</th>
                                    </tr>
                                </thead>
                                <tbody id="${this.tableId}"></tbody>
                            </table>
                        </div>
                        <div id="paginationControls_${this.modalId}" class="pagination-controls" style="display: none;"></div>
                    </div>
                    <div class="modal-footer">
                        <div class="modal-info">
                            <i class="fas fa-info-circle me-1"></i> <span id="romaneioModalInfo_${this.modalId}">Carregando...</span>
                        </div>
                        <div class="modal-footer-buttons" style="display: flex; gap: 8px; align-items: center;">
                            <button type="button" class="romaneio-print-config-trigger" onclick="window.RomaneioPrintConfig && window.RomaneioPrintConfig.openModal('${String(this.type || 'tora').toUpperCase()}')" title="Configurar colunas impressas">
                                <i class="fas fa-cog"></i> Configurar Impressão
                            </button>
                            <button class="back-button close-modal-btn">
                                <i class="fas fa-times"></i> Fechar
                            </button>
                        </div>
                    </div>
                </div>
            `;
            document.body.appendChild(modal);
            const close = () => modal.style.display = 'none';
            modal.querySelectorAll('.close-modal, .close-modal-btn').forEach(b => b.onclick = close);
            modal.onclick = (e) => { if (e.target === modal) close(); };
            const filter = modal.querySelector(`#${this.filterId}`);
            if (filter) filter.addEventListener('input', (e) => { this.applyFilter(e.target.value); this.renderFilteredTable(); });
        }
    }

    applyFilter(filter) {
        this.currentFilter = filter || '';
        if (!this.currentFilter) {
            this.filteredRomaneios = [...this.allRomaneios];
        } else {
            const lower = this.currentFilter.toLowerCase();
            this.filteredRomaneios = this.allRomaneios.filter(r => {
                const fornecedorValue = r.fornecedor?.nome || r.cliente?.nome || r.fornecedor || r.cliente || '';
                const fornecedor = String(typeof fornecedorValue === 'object' ? '' : fornecedorValue).toLowerCase();
                const obs = String(r.observacoes || '').toLowerCase();
                const data = String(r.dataHora || '').toLowerCase();
                return fornecedor.includes(lower) || obs.includes(lower) || data.includes(lower);
            });
        }
        this.calculateTotalPages();
    }

    renderFilteredTable() {
        const tbody = document.getElementById(this.tableId);
        const infoSpan = document.getElementById(`romaneioModalInfo_${this.modalId}`) || document.getElementById('romaneioModalInfo');
        
        if (!tbody) return;
        
        const total = this.filteredRomaneios.length;
        const pageSize = this.itemsPerPage;
        const start = total === 0 ? 0 : (this.currentPage - 1) * pageSize + 1;
        const end = Math.min(this.currentPage * pageSize, total);

        if (infoSpan) {
            infoSpan.textContent = `Mostrando ${start > 0 ? (start + '-' + end) : 0} de ${total} romaneio${total !== 1 ? 's' : ''}`;
        }

        if (this.filteredRomaneios.length === 0) {
            tbody.innerHTML = '<tr><td colspan="7" class="text-center p-4 text-muted"><i class="fas fa-search me-2"></i>Nenhum registro encontrado.</td></tr>';
            this.updatePaginationUI();
            return;
        }
        
        const startIdx = (this.currentPage - 1) * this.itemsPerPage;
        const pageItems = this.filteredRomaneios.slice(startIdx, startIdx + this.itemsPerPage);
        
        tbody.innerHTML = pageItems.map((r, idx) => {
            const globalIdx = startIdx + idx;
            const dataFmt = r.dataHora ? new Date(r.dataHora).toLocaleDateString('pt-BR') : '-';
            const nomeValue = r.fornecedor?.nome || r.cliente?.nome || r.fornecedor || r.cliente || 'Não informado';
            const nome = typeof nomeValue === 'object' ? 'Não informado' : String(nomeValue);
            const actionId = toInlineRomaneioArg(r.id);
            
            let resumo = '-';
            let qtd = 0;
            let vol = 0;
            let val = 0;
            if (r.itens) {
                const itens = Array.isArray(r.itens) ? r.itens : Object.values(r.itens);
                qtd = itens.length;
                resumo = [...new Set(itens.map(i => i.especie || i.descricao || 'Item'))].join(', ');
                vol = r.totais?.volumeSerraria || r.totais?.volumeTotal || itens.reduce((acc, i) => acc + (parseFloat(i.volumeLiquido)||0), 0);
                val = r.totais?.valorTotal || itens.reduce((acc, i) => acc + (parseFloat(i.valorTotal)||parseFloat(i.valor)||0), 0);
            }
            
            // Renderização condicional de botões baseada no tipo
            let actions = '';
            
            if (this.type === 'tora') {
                 actions = `
                    <div class="btn-group">
                        <button class="action-button edit-button" onclick="window.editarRomaneioTora(${actionId})" title="Editar Romaneio">
                            <i class="fas fa-edit"></i>
                        </button>
                        <button class="action-button clone-button" onclick="window.clonarRomaneioTora(${actionId})" title="Clonar Romaneio">
                            <i class="fas fa-copy"></i>
                        </button>
                        <div class="print-dropdown" style="display: inline-block; position: relative;">
                            <button class="action-button print-button" onclick="window.togglePrintMenuTora(this, ${actionId}, ${globalIdx})" title="Imprimir Romaneio">
                                <i class="fas fa-print"></i>
                            </button>
                        </div>
                        <button class="action-button delete-button" onclick="window.excluirRomaneioTora(${actionId})" title="Excluir Romaneio">
                            <i class="fas fa-trash"></i>
                        </button>
                    </div>
                `;
            } else {
                 actions = `
                    <div class="btn-group">
                        <button class="action-button edit-button" onclick="window.editarRomaneioGeneric('${this.type}', ${actionId})" title="Editar Romaneio">
                            <i class="fas fa-edit"></i>
                        </button>
                        <button class="action-button print-button" onclick="window.imprimirRomaneioGeneric('${this.type}', ${actionId})" title="Imprimir Romaneio">
                            <i class="fas fa-print"></i>
                        </button>
                        <button class="action-button delete-button" onclick="window.excluirRomaneioGeneric('${this.type}', ${actionId})" title="Excluir Romaneio">
                            <i class="fas fa-trash"></i>
                        </button>
                    </div>
                `;
            }

            return `
                <tr>
                    <td class="fw-bold text-dark">${escapeRomaneioHtml(dataFmt)}</td>
                    <td>${escapeRomaneioHtml(nome)}</td>
                    <td><small class="text-muted">${escapeRomaneioHtml(resumo.substring(0, 30))}${resumo.length > 30 ? '...' : ''}</small></td>
                    <td class="text-center"><span class="badge bg-light text-dark border">${qtd}</span></td>
                    <td class="text-end fw-bold">${vol.toFixed(3)} m³</td>
                    <td class="text-end text-success fw-bold">R$ ${val.toLocaleString('pt-BR', {minimumFractionDigits: 2})}</td>
                    <td class="actions-col text-center">${actions}</td>
                </tr>
            `;
        }).join('');
        this.updatePaginationUI();
    }
    
    calculateTotalPages() {
        this.totalPages = Math.ceil(this.filteredRomaneios.length / this.itemsPerPage) || 1;
        if (this.currentPage > this.totalPages) this.currentPage = this.totalPages;
    }
    
    updatePaginationUI() {
        const container = document.getElementById(`paginationControls_${this.modalId}`) || document.getElementById('romaneioListPagination') || document.getElementById('paginationControls');
        if (!container) return;

        if (window.RomaneioListColumns && typeof window.RomaneioListColumns.renderPaginationBar === 'function') {
            container.style.display = 'flex';
            window.RomaneioListColumns.renderPaginationBar(container, {
                totalItems: this.filteredRomaneios.length,
                currentPage: this.currentPage,
                pageSize: this.itemsPerPage,
                pageKey: this.type || 'tora',
                onPageChange: (newPage) => {
                    this.currentPage = newPage;
                    this.renderFilteredTable();
                },
                onPageSizeChange: () => {
                    this.currentPage = 1;
                    this.renderFilteredTable();
                },
                onDensityChange: () => {}
            });
            return;
        }

        if (this.totalPages <= 1) {
            container.style.display = 'none';
            container.innerHTML = '';
            return;
        }
        container.style.display = 'flex';
        container.innerHTML = '';
        const addBtn = (label, page, disabled = false, active = false) => {
            const btn = document.createElement('button');
            btn.textContent = label;
            if (active) btn.classList.add('active');
            btn.disabled = disabled;
            btn.onclick = () => window.romaneioManagerGoToPage(this.type, page);
            container.appendChild(btn);
        };
        addBtn('<<<', 1, this.currentPage === 1);
        addBtn('<', this.currentPage - 1, this.currentPage === 1);
        const startPage = Math.max(1, this.currentPage - 2);
        const endPage = Math.min(this.totalPages, this.currentPage + 2);
        if (startPage > 1) {
            addBtn('1', 1, false, this.currentPage === 1);
            if (startPage > 2) {
                const span = document.createElement('span');
                span.textContent = '...';
                container.appendChild(span);
            }
        }
        for (let i = startPage; i <= endPage; i++) {
            addBtn(String(i), i, false, i === this.currentPage);
        }
        if (endPage < this.totalPages) {
            if (endPage < this.totalPages - 1) {
                const span = document.createElement('span');
                span.textContent = '...';
                container.appendChild(span);
            }
            addBtn(String(this.totalPages), this.totalPages, false, this.currentPage === this.totalPages);
        }
        addBtn('>', this.currentPage + 1, this.currentPage === this.totalPages);
        addBtn('>>>', this.totalPages, this.currentPage === this.totalPages);
    }
    
    navigate(direction) { this.currentPage += direction; this.renderFilteredTable(); }
    loadUserPreferences() { try { const p = JSON.parse(localStorage.getItem('romaneio_prefs')||'{}'); this.itemsPerPage = p.itemsPerPage || 5; } catch (_) {} }
    setupRealtimeRomaneios() { /* Implementação simplificada */ }
}

// Instâncias Globais
window.romaneioToraManager = new RomaneioManager('tora');
window.romaneioPctManager = new RomaneioManager('pct');
window.romaneioTlManager = new RomaneioManager('tl');
window.romaneioPesManager = new RomaneioManager('pes');

window.getRomaneioManager = (type) => {
    switch (type?.toLowerCase()) {
        case 'pct': return window.romaneioPctManager;
        case 'tl': return window.romaneioTlManager;
        case 'pes': return window.romaneioPesManager;
        default: return window.romaneioToraManager;
    }
};

// Funções de Abertura
window.abrirListaRomaneiosTora = () => window.romaneioToraManager.openModal();
window.abrirListaRomaneiosPct = () => window.romaneioPctManager.openModal();
window.abrirListaRomaneiosTl = () => window.romaneioTlManager.openModal();
window.abrirListaRomaneiosPes = () => window.romaneioPesManager.openModal();

window.romaneioToraManager.openModal = window.romaneioToraManager.openModal.bind(window.romaneioToraManager);
window.abrirListaRomaneios = window.abrirListaRomaneiosTora;

// Funções Genéricas
window.editarRomaneioGeneric = (type, id) => { if (type === 'tora') window.editarRomaneioTora(id); else console.log('Edit', type, id); };
window.excluirRomaneioGeneric = (type, id) => { if (confirm('Excluir?')) window.getRomaneioManager(type).deleteData(id); };
window.imprimirRomaneioGeneric = (type, id) => { if (type === 'tora') window.imprimirRomaneioTora(id); };
window.romaneioManagerNavigate = (type, dir) => window.getRomaneioManager(type).navigate(dir);
window.romaneioManagerGoToPage = (type, page) => {
    const manager = window.getRomaneioManager(type);
    if (!manager) return;
    const target = Number(page) || 1;
    if (target < 1 || target > manager.totalPages) return;
    manager.currentPage = target;
    manager.renderFilteredTable();
};

// ====================================================================
// 🔙 COMPATIBILIDADE LEGADA - UI ESPECÍFICA DO TORA (RESTAURADA)
// ====================================================================

window.togglePrintMenuTora = function(button, romaneioId, index) {
    if (!button) return;
    document.querySelectorAll('.external-print-menu').forEach(menu => menu.remove());
    const externalMenu = document.createElement('div');
    externalMenu.className = 'external-print-menu';
    externalMenu.style.cssText = `
        position: fixed;
        z-index: 10000050;
        background: #fff;
        border: 1px solid #cbd5e1;
        padding: 10px;
        box-shadow: 0 10px 28px rgba(15, 23, 42, 0.28);
        border-radius: 6px;
        min-width: 180px;
        pointer-events: auto;
    `;
    externalMenu.innerHTML = `
        <div style="font-weight: bold; margin-bottom: 5px;">Imprimir</div>
        <button style="display:block; width:100%; text-align:left; border:none; background:none; padding: 5px; cursor:pointer" onclick="window.imprimirRomaneioTora('${romaneioId}', 'completo')">Completo</button>
        <button style="display:block; width:100%; text-align:left; border:none; background:none; padding: 5px; cursor:pointer" onclick="window.imprimirRomaneioTora('${romaneioId}', 'sem_preco_unitario')">Sem Preço Unit.</button>
        <button style="display:block; width:100%; text-align:left; border:none; background:none; padding: 5px; cursor:pointer" onclick="window.imprimirRomaneioTora('${romaneioId}', 'sem_preco')">Sem Preço</button>
    `;
    const rect = button.getBoundingClientRect();
    document.body.appendChild(externalMenu);
    const menuWidth = Math.max(180, externalMenu.offsetWidth || 180);
    const menuHeight = Math.max(120, externalMenu.offsetHeight || 120);
    const top = rect.bottom + 5 + menuHeight > window.innerHeight - 12
        ? Math.max(12, rect.top - menuHeight - 5)
        : rect.bottom + 5;
    const left = Math.min(
        Math.max(12, rect.left),
        Math.max(12, window.innerWidth - menuWidth - 12)
    );
    externalMenu.style.top = `${top}px`;
    externalMenu.style.left = `${left}px`;
    setTimeout(() => {
        document.addEventListener('click', function close(e) {
            if (!externalMenu.contains(e.target) && e.target !== button) {
                externalMenu.remove();
                document.removeEventListener('click', close);
            }
        });
    }, 100);
};

window.imprimirRomaneioTora = async function(romaneioId, tipo = 'completo') {
    document.querySelectorAll('.external-print-menu').forEach(m => m.remove());
    
    // ✅ DELEGAÇÃO PARA O MÓDULO DE IMPRESSÃO ESPECIALIZADO
    if (window.ImprimirRomaneio && typeof window.ImprimirRomaneio.imprimirRomaneioTora === 'function') {
        console.log(`🖨️ Delegando impressão Tora para módulo especializado: ${romaneioId}`);
        return window.ImprimirRomaneio.imprimirRomaneioTora(romaneioId, tipo);
    }
    
    // Fallback de segurança (apenas se o módulo não estiver carregado)
    console.warn('⚠️ Módulo ImprimirRomaneio não encontrado. Usando fallback básico.');
    
    // Buscar dados do manager
    const romaneios = await window.romaneioToraManager.getData();
    const romaneio = romaneios.find(r => r.id === romaneioId || r.firebaseKey === romaneioId);
    
    if (!romaneio) { alert('Romaneio não encontrado'); return; }
    const companyInfo = (() => {
        try {
            const raw = localStorage.getItem('company_info') || localStorage.getItem('companyInfo');
            if (!raw) return {};
            return JSON.parse(raw) || {};
        } catch (_) {
            return {};
        }
    })();
    const companyName = companyInfo.name || companyInfo.nome || companyInfo.companyName || 'Empresa não informada';
    const companyCnpj = companyInfo.cnpj || companyInfo.document || companyInfo.cpfCnpj || '-';
    const companyPhone = companyInfo.phone || companyInfo.telefone || '-';
    const companyLogo = companyInfo.logo || companyInfo.logoUrl || '';
    
    // Lógica de Impressão Restaurada (Simplificada para HTML)
    const w = window.open('', '_blank');
    if(!w) { alert('Popup bloqueado'); return; }
    
    const itensHtml = (romaneio.itens || []).map(i => `
        <tr>
            <td>${i.plaqueta || '-'}</td>
            <td>${i.especie || '-'}</td>
            <td>${i.comprimento || 0}</td>
            <td>${i.diametro || 0}</td>
            <td>${i.volumeLiquido || 0}</td>
        </tr>`).join('');
        
    const html = `
        <html>
        <head><title>Romaneio ${romaneioId}</title>
        <style>table{width:100%;border-collapse:collapse} th,td{border:1px solid #ddd;padding:8px}.hdr{display:flex;gap:12px;align-items:center;margin-bottom:12px}.hdr-logo{width:72px;height:72px;border:1px solid #ddd;border-radius:6px;overflow:hidden;display:flex;align-items:center;justify-content:center}.hdr-logo img{width:100%;height:100%;object-fit:contain}.hdr-fallback{background:#0d2339;color:#fff;width:100%;height:100%;display:flex;align-items:center;justify-content:center;font-weight:700}.hdr-info{font-size:12px;line-height:1.35}.hdr-name{font-size:18px;font-weight:700}</style>
        </head>
        <body>
            <div class="hdr">
                <div class="hdr-logo">${companyLogo ? `<img src="${companyLogo}" alt="Logo">` : '<div class="hdr-fallback">SW</div>'}</div>
                <div class="hdr-info">
                    <div class="hdr-name">${companyName}</div>
                    <div>CNPJ: ${companyCnpj}</div>
                    <div>Telefone: ${companyPhone}</div>
                </div>
            </div>
            <h1>Romaneio ${romaneioId}</h1>
            <p><strong>Fornecedor:</strong> ${romaneio.fornecedor?.nome || romaneio.cliente?.nome}</p>
            <p><strong>Data:</strong> ${romaneio.dataHora}</p>
            <table>
                <thead><tr><th>Plaqueta</th><th>Espécie</th><th>Comp.</th><th>Diam.</th><th>Vol.</th></tr></thead>
                <tbody>${itensHtml}</tbody>
            </table>
            <script>window.onload = () => window.print();</script>
        </body>
        </html>
    `;
    w.document.write(html);
    w.document.close();
};

window.editarRomaneioTora = async function(romaneioId, dadosPreCarregados = null) {
    const manager = window.romaneioToraManager;
    const sid = String(romaneioId || '').trim();
    let romaneio = dadosPreCarregados || null;
    
    if (!romaneio && manager && typeof manager.getData === 'function') {
        const romaneios = await manager.getData();
        romaneio = (Array.isArray(romaneios) ? romaneios : []).find(r => String(r && (r.id || r.firebaseKey || r.numero)) === sid);
    }
    
    if (!romaneio && window.firebaseService && typeof window.firebaseService.loadFromFirebase === 'function') {
        try {
            const res = await window.firebaseService.loadFromFirebase('romaneios/tora');
            if (res && res.success && res.data) {
                const lista = Array.isArray(res.data) ? res.data : Object.entries(res.data).map(([k, v]) => ({ id: (v && v.id) || k, firebaseKey: k, ...(v || {}) }));
                romaneio = lista.find(r => String(r && (r.id || r.firebaseKey || r.numero)) === sid);
            }
        } catch (_) {}
    }
    
    if (!romaneio) { alert('Romaneio não encontrado!'); return; }
    
    console.log("Carregando para edição:", romaneio);
    
    // Preencher campos globais que o formulário Tora espera
    window.romaneioEditandoId = romaneio.id;
    window.romaneioOriginalDataHora = romaneio.dataHora;
    window.romaneioOriginalDataFormatada = romaneio.dataFormatada;
    window.romaneioOriginalHoraFormatada = romaneio.horaFormatada;
    window.romaneioOriginalCriadoEm = romaneio.criadoEm;
    
    window.clienteSelecionado = romaneio.fornecedor || romaneio.cliente;
    
    // ✅ CORREÇÃO: Normalizar itens para garantir que seja um array
    let itensNormalizados = [];
    if (romaneio.itens) {
        if (Array.isArray(romaneio.itens)) {
            itensNormalizados = romaneio.itens;
        } else if (typeof romaneio.itens === 'object') {
            itensNormalizados = Object.values(romaneio.itens);
        }
    }
    window.romaneioItems = itensNormalizados;
    
    // ✅ ATUALIZAR UI PARA MODO EDIÇÃO (Sincronizado com romaneiotora.js)
    const btnSalvar = document.getElementById('btnSalvar');
    if (btnSalvar) {
        btnSalvar.innerHTML = '<i class="fas fa-sync-alt"></i> Atualizar';
        btnSalvar.classList.add('btn-atualizar'); 
    }
    
    const tituloPagina = document.querySelector('.main-title, h1, h2');
    if (tituloPagina) {
        tituloPagina.innerHTML = `✏️ Editando Romaneio: ${romaneio.numero || romaneio.id}`;
    }
    
    // Atualizar UI do formulário (se existir na página)
    if (document.getElementById('clienteInput')) {
        document.getElementById('clienteInput').value = window.clienteSelecionado?.nome || '';
    }
    
    // Atualizar Tabela de Itens (função global do romaneiotora.js)
    if (typeof window.updateTableBody === 'function') window.updateTableBody();
    if (typeof window.atualizarTotais === 'function') window.atualizarTotais();
    
    // Fechar modal
    const modal = document.getElementById(manager.modalId);
    if (modal) modal.style.display = 'none';
    
    const form = document.querySelector('form');
    if (form) form.scrollIntoView({behavior: 'smooth'});
    
    // Feedback
    if(window.Utils?.showToast) window.Utils.showToast('Carregado para edição', 'success');
};

window.excluirRomaneioTora = function(id) {
    if (confirm('Excluir romaneio Tora?')) {
        window.romaneioToraManager.deleteData(id);
    }
};

window.clonarRomaneioTora = async function(romaneioId, dadosPreCarregados = null) {
    const manager = window.romaneioToraManager;
    const sid = String(romaneioId || '').trim();
    let romaneio = dadosPreCarregados || null;
    
    if (!romaneio && manager && typeof manager.getData === 'function') {
        const romaneios = await manager.getData();
        romaneio = (Array.isArray(romaneios) ? romaneios : []).find(r => String(r && (r.id || r.firebaseKey || r.numero)) === sid);
    }
    
    if (!romaneio && window.firebaseService && typeof window.firebaseService.loadFromFirebase === 'function') {
        try {
            const res = await window.firebaseService.loadFromFirebase('romaneios/tora');
            if (res && res.success && res.data) {
                const lista = Array.isArray(res.data) ? res.data : Object.entries(res.data).map(([k, v]) => ({ id: (v && v.id) || k, firebaseKey: k, ...(v || {}) }));
                romaneio = lista.find(r => String(r && (r.id || r.firebaseKey || r.numero)) === sid);
            }
        } catch (_) {}
    }
    
    if (!romaneio) { alert('Romaneio não encontrado para clonagem!'); return; }
    
    console.log("📋 Clonando Romaneio Tora:", romaneio);
    
    // Limpar campos de edição para salvar como novo
    window.romaneioEditandoId = null;
    window.romaneioOriginalDataHora = null;
    window.romaneioOriginalDataFormatada = null;
    window.romaneioOriginalHoraFormatada = null;
    window.romaneioOriginalCriadoEm = null;
    
    window.clienteSelecionado = romaneio.fornecedor || romaneio.cliente;
    
    let itensNormalizados = [];
    if (romaneio.itens) {
        if (Array.isArray(romaneio.itens)) {
            itensNormalizados = romaneio.itens.map(it => ({ ...it }));
        } else if (typeof romaneio.itens === 'object') {
            itensNormalizados = Object.values(romaneio.itens).map(it => ({ ...it }));
        }
    }
    window.romaneioItems = itensNormalizados;
    
    const btnSalvar = document.getElementById('btnSalvar');
    if (btnSalvar) {
        btnSalvar.innerHTML = '<i class="fas fa-save"></i> Salvar Romaneio';
        btnSalvar.classList.remove('btn-atualizar'); 
    }
    
    const tituloPagina = document.querySelector('.main-title, h1, h2');
    if (tituloPagina) {
        tituloPagina.innerHTML = `Romaneio de Toras`;
    }
    
    if (document.getElementById('clienteInput')) {
        document.getElementById('clienteInput').value = window.clienteSelecionado?.nome || window.clienteSelecionado?.name || '';
    }
    if (document.getElementById('fornecedorInput')) {
        document.getElementById('fornecedorInput').value = window.clienteSelecionado?.nome || window.clienteSelecionado?.name || '';
    }
    if (document.getElementById('motoristaInput') && romaneio.motorista) {
        document.getElementById('motoristaInput').value = romaneio.motorista;
    }
    if (document.getElementById('placaInput') && romaneio.placa) {
        document.getElementById('placaInput').value = romaneio.placa;
    }
    
    if (typeof window.updateTableBody === 'function') window.updateTableBody();
    if (typeof window.atualizarTotais === 'function') window.atualizarTotais();
    if (typeof window.renderizarTabela === 'function') window.renderizarTabela();
    
    const modal = document.getElementById(manager ? manager.modalId : 'romaneioListModal');
    if (modal) modal.style.display = 'none';
    
    const form = document.querySelector('form');
    if (form) form.scrollIntoView({behavior: 'smooth'});
    
    const msg = 'Romaneio clonado com sucesso! Pronto para salvar como novo.';
    if (window.Utils?.showToast) {
        window.Utils.showToast(msg, 'success');
    } else if (typeof window.__toast === 'function') {
        window.__toast(msg, 'success');
    } else {
        alert(msg);
    }
};

console.log("✅ Romaneio Manager Unificado carregado com sucesso!");
