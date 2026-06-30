
// 🛡️ PROTEÇÃO ANTI-LOOP DEFINITIVA
let modalProcessingActive = false;
let modalLastProcess = 0;
const MODAL_COOLDOWN = 3000; // 3 segundos
let modalProcessCount = 0;
const MAX_MODAL_PROCESS = 3; // Máximo 3 processamentos

function podeProcessarModal() {
    const now = Date.now();
    const tempoDecorrido = now - modalLastProcess;
    
    if (modalProcessingActive) {
        console.log('🛡️ Modal já em processamento - bloqueado');
        return false;
    }
    
    if (tempoDecorrido < MODAL_COOLDOWN) {
        console.log(`🛡️ Cooldown ativo: ${Math.ceil((MODAL_COOLDOWN - tempoDecorrido) / 1000)}s restantes`);
        return false;
    }
    
    if (modalProcessCount >= MAX_MODAL_PROCESS) {
        console.log('🛡️ Limite de processamentos atingido - bloqueado');
        return false;
    }
    
    return true;
}

function iniciarProcessamentoModal() {
    modalProcessingActive = true;
    modalLastProcess = Date.now();
    modalProcessCount++;
    console.log(`🔄 Iniciando processamento modal ${modalProcessCount}/${MAX_MODAL_PROCESS}`);
}

function finalizarProcessamentoModal() {
    modalProcessingActive = false;
    console.log('✅ Processamento modal finalizado');
    
    // Reset contador após um período
    setTimeout(() => {
        modalProcessCount = Math.max(0, modalProcessCount - 1);
    }, 10000); // 10 segundos
}
    

// 🛡️ PROTEÇÃO ANTI-LOOP MELHORADA
let modalProcessingLock = false;
let lastModalProcessTime = 0;
const MODAL_PROCESS_COOLDOWN = 1000; // 1 segundo de cooldown

function shouldProcessModal() {
    const now = Date.now();
    if (modalProcessingLock || (now - lastModalProcessTime) < MODAL_PROCESS_COOLDOWN) {
        console.log('🛡️ Modal processamento bloqueado - aguardando cooldown');
        return false;
    }
    return true;
}

function setModalProcessingLock(state) {
    modalProcessingLock = state;
    if (state) {
        lastModalProcessTime = Date.now();
    }
}
    
/**
 * Sistema Padronizado de Modal de Lista de Clientes
 * 
 * Este arquivo padroniza todos os modais de "Lista de Clientes" em:
 * - romaneiotl.html
 * - romaneiopct.html  
 * - romaneiotora.html (Lista de Fornecedores)
 * - client.html
 * 
 * Características:
 * - Firebase Realtime Database como única fonte de dados
 * - Paginação após 5 itens
 * - Ícones e cores padronizados
 * - Filtro de busca unificado
 * - Altura consistente das linhas
 * - Formatação de texto padronizada com quebra de linha
 */

// ✅ CONFIGURAÇÕES GLOBAIS
const CLIENT_MODAL_CONFIG = {
    itemsPerPage: 5,
    firebaseCollection: 'clients',
    modalId: 'clientListModal',
    tableId: 'clientListTable',
    filterId: 'clientListFilter',
    paginationId: 'clientListPagination'
};

// ✅ ESTADO GLOBAL DO MODAL
let clientModalState = {
    currentPage: 1,
    filterText: '',
    clients: [],
    filteredClients: [],
    isLoading: false,
    isInitialized: false,
    useNativeModal: false // Flag para detectar se deve usar modal HTML nativo
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
            if (ns && ns !== base) keys.push(ns);
        } else {
            const companyId = resolveCompanyId();
            if (companyId && !/^companies\//.test(base) && !/^users\//.test(base)) {
                keys.push(`companies/${companyId}/${base}`);
            }
        }
        keys.push(base);
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

// ✅ CONTROLE DE PROTEÇÃO CONTRA LOOPS - MELHORADO
let protectionActive = false;
let protectionTimer = null;
let protectionCount = 0;
let lastProtectionTime = 0;

// ✅ FUNÇÃO PARA DETECTAR SE EXISTE MODAL HTML NATIVO
function detectNativeModal() {
    const nativeModal = document.getElementById('clientListModal');
    if (nativeModal && !nativeModal.classList.contains('standardized-client-modal')) {
        console.log("🔍 Modal HTML nativo detectado, usando modo híbrido");
        clientModalState.useNativeModal = true;
        return true;
    }
    return false;
}

// ✅ FUNÇÃO PARA INJETAR ESTILOS CSS DO MODAL PADRONIZADO
function injectClientModalStyles() {
    // Verificar se os estilos já foram injetados
    if (document.getElementById('standardized-client-modal-styles')) {
        console.log("🎨 Estilos do modal padronizado já injetados");
        return;
    }
    
    console.log("🎨 Injetando estilos CSS do modal padronizado...");
    
    const style = document.createElement('style');
    style.id = 'standardized-client-modal-styles';
    style.textContent = `
        /* ✅ ESTILOS PARA MODAL PADRONIZADO DE CLIENTES */
        .standardized-client-modal {
            display: none;
            position: fixed;
            z-index: 1000;
            left: 0;
            top: 0;
            width: 100%;
            height: 100%;
            overflow: auto;
            background-color: rgba(0, 0, 0, 0.4);
            animation: fadeIn 0.3s ease;
        }
        
        .standardized-client-modal.show {
            display: block !important;
        }
        
        .standardized-client-modal-content {
            background-color: #fefefe;
            margin: 2% auto;
            padding: 0;
            border: 1px solid #888;
            width: 96%;
            max-width: 1400px;
            border-radius: 8px;
            box-shadow: 0 4px 20px rgba(0, 0, 0, 0.15);
            animation: slideIn 0.3s ease;
        }
        
        .standardized-client-modal-header {
            background: linear-gradient(135deg, #2c3e50 0%, #34495e 100%);
            color: white;
            padding: 20px;
            border-radius: 8px 8px 0 0;
            display: flex;
            justify-content: space-between;
            align-items: center;
        }
        
        .standardized-client-modal-title {
            margin: 0;
            font-size: 20px;
            font-weight: 600;
        }
        
        .standardized-client-modal-close {
            background: none;
            border: none;
            color: white;
            font-size: 28px;
            font-weight: bold;
            cursor: pointer;
            padding: 0;
            width: 32px;
            height: 32px;
            display: flex;
            align-items: center;
            justify-content: center;
            border-radius: 50%;
            transition: background-color 0.2s ease;
        }
        
        .standardized-client-modal-close:hover {
            background-color: rgba(255, 255, 255, 0.1);
        }
        
        .standardized-client-modal-body {
            padding: 25px;
            max-height: 70vh;
            overflow-y: auto;
        }
        
        .standardized-client-modal-footer {
            background-color: #f8f9fa;
            padding: 18px 25px;
            border-radius: 0 0 8px 8px;
            display: flex;
            justify-content: space-between;
            align-items: center;
        }
        
        .standardized-client-modal-filter {
            width: 100%;
            padding: 14px 18px;
            margin-bottom: 22px;
            border: 2px solid #e0e0e0;
            border-radius: 8px;
            font-size: 15px;
            outline: none;
            transition: border-color 0.2s ease;
        }
        
        .standardized-client-modal-filter:focus {
            border-color: #3498db;
            box-shadow: 0 0 8px rgba(52, 152, 219, 0.3);
        }
        
        .standardized-client-modal-table {
            width: 100%;
            border-collapse: collapse;
            margin-bottom: 22px;
            table-layout: fixed;
        }
        
        .standardized-client-modal-table th {
            background: linear-gradient(135deg, #34495e 0%, #2c3e50 100%);
            color: white;
            padding: 16px 14px;
            text-align: left;
            font-weight: 600;
            border: none;
            position: sticky;
            top: 0;
            z-index: 10;
            font-size: 14px;
            height: 50px;
        }
        
        /* ✅ LARGURAS ESPECÍFICAS PARA CADA COLUNA */
        .standardized-client-modal-table th:nth-child(1),
        .standardized-client-modal-table td:nth-child(1) {
            width: 20%;
            min-width: 160px;
        }
        
        .standardized-client-modal-table th:nth-child(2),
        .standardized-client-modal-table td:nth-child(2) {
            width: 18%;
            min-width: 140px;
        }
        
        .standardized-client-modal-table th:nth-child(3),
        .standardized-client-modal-table td:nth-child(3) {
            width: 16%;
            min-width: 120px;
        }
        
        .standardized-client-modal-table th:nth-child(4),
        .standardized-client-modal-table td:nth-child(4) {
            width: 8%;
            min-width: 60px;
            text-align: center;
        }
        
        .standardized-client-modal-table th:nth-child(5),
        .standardized-client-modal-table td:nth-child(5) {
            width: 18%;
            min-width: 140px;
        }
        
        .standardized-client-modal-table th:nth-child(6),
        .standardized-client-modal-table td:nth-child(6) {
            width: 20%;
            min-width: 160px;
        }
        
        .standardized-client-modal-table th:nth-child(7),
        .standardized-client-modal-table td:nth-child(7) {
            width: 12%;
            min-width: 120px;
            text-align: center;
        }
        
        /* ✅ LARGURAS ESPECÍFICAS PARA TABELAS DE FORNECEDORES (7 colunas) */
        .standardized-client-modal-table.suppliers-table th:nth-child(1),
        .standardized-client-modal-table.suppliers-table td:nth-child(1) {
            width: 18%;
            min-width: 140px;
        }
        
        .standardized-client-modal-table.suppliers-table th:nth-child(2),
        .standardized-client-modal-table.suppliers-table td:nth-child(2) {
            width: 15%;
            min-width: 120px;
        }
        
        .standardized-client-modal-table.suppliers-table th:nth-child(3),
        .standardized-client-modal-table.suppliers-table td:nth-child(3) {
            width: 14%;
            min-width: 110px;
        }
        
        .standardized-client-modal-table.suppliers-table th:nth-child(4),
        .standardized-client-modal-table.suppliers-table td:nth-child(4) {
            width: 7%;
            min-width: 50px;
            text-align: center;
        }
        
        .standardized-client-modal-table.suppliers-table th:nth-child(5),
        .standardized-client-modal-table.suppliers-table td:nth-child(5) {
            width: 16%;
            min-width: 120px;
        }
        
        .standardized-client-modal-table.suppliers-table th:nth-child(6),
        .standardized-client-modal-table.suppliers-table td:nth-child(6) {
            width: 18%;
            min-width: 140px;
        }
        
        .standardized-client-modal-table.suppliers-table th:nth-child(7),
        .standardized-client-modal-table.suppliers-table td:nth-child(7) {
            width: 12%;
            min-width: 120px;
            text-align: center;
        }
        
        /* ✅ LARGURAS ESPECÍFICAS PARA TABELAS DE CLIENTES (6 colunas) */
        .standardized-client-modal-table.clients-table th:nth-child(1),
        .standardized-client-modal-table.clients-table td:nth-child(1) {
            width: 22%;
            min-width: 180px;
        }
        
        .standardized-client-modal-table.clients-table th:nth-child(2),
        .standardized-client-modal-table.clients-table td:nth-child(2) {
            width: 18%;
            min-width: 140px;
        }
        
        .standardized-client-modal-table.clients-table th:nth-child(3),
        .standardized-client-modal-table.clients-table td:nth-child(3) {
            width: 10%;
            min-width: 80px;
            text-align: center;
        }
        
        .standardized-client-modal-table.clients-table th:nth-child(4),
        .standardized-client-modal-table.clients-table td:nth-child(4) {
            width: 18%;
            min-width: 140px;
        }
        
        .standardized-client-modal-table.clients-table th:nth-child(5),
        .standardized-client-modal-table.clients-table td:nth-child(5) {
            width: 20%;
            min-width: 160px;
        }
        
        .standardized-client-modal-table.clients-table th:nth-child(6),
        .standardized-client-modal-table.clients-table td:nth-child(6) {
            width: 12%;
            min-width: 120px;
            text-align: center;
        }
        
        .standardized-client-modal-table td {
            padding: 14px;
            border-bottom: 1px solid #dee2e6;
            vertical-align: middle;
            height: 54px;
            font-size: 14px;
            line-height: 1.4;
            /* ✅ FORMATAÇÃO PADRONIZADA PARA QUEBRA DE LINHA */
            word-wrap: break-word;
            white-space: normal;
            overflow-wrap: break-word;
        }
        
        .standardized-client-modal-table td:nth-child(4) {
            text-align: center;
            font-weight: bold;
            font-size: 15px;
        }
        
        .standardized-client-modal-table td:nth-child(7) {
            text-align: center;
        }
        
        .standardized-client-modal-table tr:hover {
            background-color: #f8f9fa;
            transition: background-color 0.2s ease;
        }
        
        .standardized-client-modal-btn {
            display: inline-flex;
            align-items: center;
            justify-content: center;
            padding: 8px 10px;
            margin: 0 3px;
            border: none;
            border-radius: 4px;
            cursor: pointer;
            font-size: 13px;
            font-weight: 500;
            text-decoration: none;
            transition: all 0.2s ease;
            min-width: 34px;
            height: 34px;
        }
        
        .standardized-client-modal-btn.primary {
            background-color: #007bff;
            color: white;
        }
        
        .standardized-client-modal-btn.primary:hover {
            background-color: #0056b3;
        }
        
        .standardized-client-modal-btn.secondary {
            background-color: #6c757d;
            color: white;
        }
        
        .standardized-client-modal-btn.secondary:hover {
            background-color: #545b62;
        }
        
        .standardized-client-modal-btn.success {
            background-color: #28a745;
            color: white;
        }
        
        .standardized-client-modal-btn.success:hover {
            background-color: #1e7e34;
        }
        
        .standardized-client-modal-btn.danger {
            background-color: #dc3545;
            color: white;
        }
        
        .standardized-client-modal-btn.danger:hover {
            background-color: #c82333;
        }
        
        .standardized-client-modal-pagination {
            display: flex;
            justify-content: center;
            align-items: center;
            gap: 6px;
            margin-top: 22px;
        }
        
        .standardized-client-modal-pagination button {
            padding: 10px 14px;
            border: 1px solid #dee2e6;
            background: white;
            color: #495057;
            cursor: pointer;
            border-radius: 4px;
            transition: all 0.2s;
            font-size: 14px;
            min-width: 40px;
            height: 40px;
        }
        
        .standardized-client-modal-pagination button:hover {
            background-color: #e9ecef;
            border-color: #adb5bd;
        }
        
        .standardized-client-modal-pagination button.active {
            background-color: #007bff;
            border-color: #007bff;
            color: white;
        }
        
        .standardized-client-modal-pagination button:disabled {
            background-color: #f8f9fa;
            border-color: #dee2e6;
            color: #6c757d;
            cursor: not-allowed;
        }
        
        .standardized-client-modal-info {
            color: #6c757d;
            font-size: 15px;
            display: flex;
            align-items: center;
            gap: 10px;
        }
        
        /* ✅ ESTILOS PARA MODAIS NATIVOS - PADRONIZAÇÃO COMPLETA */
        #clientListModal .modal-content,
        #clientModal .modal-content {
            border-radius: 8px !important;
            box-shadow: 0 4px 20px rgba(0, 0, 0, 0.15) !important;
            width: 96% !important;
            max-width: 1400px !important;
            margin: 2% auto !important;
        }
        
        #clientListModal .modal-header,
        #clientModal .modal-header {
            background: linear-gradient(135deg, #2c3e50, #34495e) !important;
            color: white !important;
            padding: 20px !important;
            border-radius: 8px 8px 0 0 !important;
        }
        
        #clientListModal .modal-title,
        #clientModal .modal-title {
            color: white !important;
            font-size: 20px !important;
            font-weight: 600 !important;
        }
        
        #clientListModal .close-modal,
        #clientModal .close-modal {
            color: white !important;
            font-size: 28px !important;
            font-weight: bold !important;
            cursor: pointer !important;
            background: none !important;
            border: none !important;
            padding: 0 !important;
            width: 32px !important;
            height: 32px !important;
            display: flex !important;
            align-items: center !important;
            justify-content: center !important;
            border-radius: 50% !important;
            transition: background-color 0.2s ease !important;
        }
        
        #clientListModal .close-modal:hover,
        #clientModal .close-modal:hover {
            background-color: rgba(255, 255, 255, 0.1) !important;
        }
        
        #clientListModal .modal-body,
        #clientModal .modal-body {
            padding: 25px !important;
            max-height: 70vh !important;
            overflow-y: auto !important;
        }
        
        #clientListModal .modal-footer,
        #clientModal .modal-footer {
            background-color: #f8f9fa !important;
            padding: 18px 25px !important;
            border-radius: 0 0 8px 8px !important;
        }
        
        #clientListModal .table,
        #clientModal .table {
            width: 100% !important;
            border-collapse: collapse !important;
            margin-bottom: 22px !important;
            table-layout: fixed !important;
        }
        
        #clientListModal .table th,
        #clientModal .table th {
            background: linear-gradient(135deg, #34495e 0%, #2c3e50 100%) !important;
            color: white !important;
            padding: 16px 14px !important;
            font-weight: 600 !important;
            border: none !important;
            position: sticky !important;
            top: 0 !important;
            z-index: 10 !important;
            font-size: 14px !important;
            height: 50px !important;
        }
        
        #clientListModal .table td,
        #clientModal .table td {
            padding: 14px !important;
            border-bottom: 1px solid #dee2e6 !important;
            vertical-align: middle !important;
            height: 54px !important;
            font-size: 14px !important;
            line-height: 1.4 !important;
            /* ✅ FORMATAÇÃO PADRONIZADA PARA QUEBRA DE LINHA */
            word-wrap: break-word !important;
            white-space: normal !important;
            overflow-wrap: break-word !important;
        }
        
        /* ✅ LARGURAS ESPECÍFICAS PARA TABELAS NATIVAS */
        #clientListModal .table th:nth-child(1),
        #clientListModal .table td:nth-child(1),
        #clientModal .table th:nth-child(1),
        #clientModal .table td:nth-child(1) {
            width: 20% !important;
            min-width: 160px !important;
        }
        
        #clientListModal .table th:nth-child(2),
        #clientListModal .table td:nth-child(2),
        #clientModal .table th:nth-child(2),
        #clientModal .table td:nth-child(2) {
            width: 18% !important;
            min-width: 140px !important;
        }
        
        #clientListModal .table th:nth-child(3),
        #clientListModal .table td:nth-child(3),
        #clientModal .table th:nth-child(3),
        #clientModal .table td:nth-child(3) {
            width: 16% !important;
            min-width: 120px !important;
        }
        
        #clientListModal .table th:nth-child(4),
        #clientListModal .table td:nth-child(4),
        #clientModal .table th:nth-child(4),
        #clientModal .table td:nth-child(4) {
            width: 8% !important;
            min-width: 60px !important;
            text-align: center !important;
            font-weight: bold !important;
            font-size: 15px !important;
        }
        
        #clientListModal .table th:nth-child(5),
        #clientListModal .table td:nth-child(5),
        #clientModal .table th:nth-child(5),
        #clientModal .table td:nth-child(5) {
            width: 18% !important;
            min-width: 140px !important;
        }
        
        #clientListModal .table th:nth-child(6),
        #clientListModal .table td:nth-child(6),
        #clientModal .table th:nth-child(6),
        #clientModal .table td:nth-child(6) {
            width: 20% !important;
            min-width: 160px !important;
        }
        
        #clientListModal .table th:nth-child(7),
        #clientListModal .table td:nth-child(7),
        #clientModal .table th:nth-child(7),
        #clientModal .table td:nth-child(7) {
            width: 12% !important;
            min-width: 120px !important;
            text-align: center !important;
        }
        
        /* ✅ LARGURAS ESPECÍFICAS PARA TABELAS NATIVAS DE FORNECEDORES (7 colunas) */
        #clientListModal .table.suppliers-table th:nth-child(1),
        #clientListModal .table.suppliers-table td:nth-child(1) {
            width: 18% !important;
            min-width: 140px !important;
        }
        
        #clientListModal .table.suppliers-table th:nth-child(2),
        #clientListModal .table.suppliers-table td:nth-child(2) {
            width: 15% !important;
            min-width: 120px !important;
        }
        
        #clientListModal .table.suppliers-table th:nth-child(3),
        #clientListModal .table.suppliers-table td:nth-child(3) {
            width: 14% !important;
            min-width: 110px !important;
        }
        
        #clientListModal .table.suppliers-table th:nth-child(4),
        #clientListModal .table.suppliers-table td:nth-child(4) {
            width: 7% !important;
            min-width: 50px !important;
            text-align: center !important;
            font-weight: bold !important;
            font-size: 15px !important;
        }
        
        #clientListModal .table.suppliers-table th:nth-child(5),
        #clientListModal .table.suppliers-table td:nth-child(5) {
            width: 16% !important;
            min-width: 120px !important;
        }
        
        #clientListModal .table.suppliers-table th:nth-child(6),
        #clientListModal .table.suppliers-table td:nth-child(6) {
            width: 18% !important;
            min-width: 140px !important;
        }
        
        #clientListModal .table.suppliers-table th:nth-child(7),
        #clientListModal .table.suppliers-table td:nth-child(7) {
            width: 12% !important;
            min-width: 120px !important;
            text-align: center !important;
        }
        
        /* ✅ LARGURAS ESPECÍFICAS PARA TABELAS NATIVAS DE CLIENTES (6 colunas) */
        #clientListModal .table.clients-table th:nth-child(1),
        #clientListModal .table.clients-table td:nth-child(1) {
            width: 22% !important;
            min-width: 180px !important;
        }
        
        #clientListModal .table.clients-table th:nth-child(2),
        #clientListModal .table.clients-table td:nth-child(2) {
            width: 18% !important;
            min-width: 140px !important;
        }
        
        #clientListModal .table.clients-table th:nth-child(3),
        #clientListModal .table.clients-table td:nth-child(3) {
            width: 10% !important;
            min-width: 80px !important;
            text-align: center !important;
            font-weight: bold !important;
            font-size: 15px !important;
        }
        
        #clientListModal .table.clients-table th:nth-child(4),
        #clientListModal .table.clients-table td:nth-child(4) {
            width: 18% !important;
            min-width: 140px !important;
        }
        
        #clientListModal .table.clients-table th:nth-child(5),
        #clientListModal .table.clients-table td:nth-child(5) {
            width: 20% !important;
            min-width: 160px !important;
        }
        
        #clientListModal .table.clients-table th:nth-child(6),
        #clientListModal .table.clients-table td:nth-child(6) {
            width: 12% !important;
            min-width: 120px !important;
            text-align: center !important;
        }
        
        #clientListModal .table tr:hover,
        #clientModal .table tr:hover {
            background-color: #f8f9fa !important;
            transition: background-color 0.2s ease !important;
        }
        
        /* ✅ ESTILOS PARA BOTÕES DE AÇÃO - PADRONIZAÇÃO COMPLETA */
        .btn-success {
            background: #28a745 !important;
            color: white !important;
            border: none !important;
            padding: 8px 10px !important;
            border-radius: 4px !important;
            cursor: pointer !important;
            font-size: 13px !important;
            transition: all 0.2s ease !important;
            min-width: 34px !important;
            height: 34px !important;
            display: inline-flex !important;
            align-items: center !important;
            justify-content: center !important;
            margin: 0 3px !important;
        }
        
        .btn-success:hover {
            background: #1e7e34 !important;
        }
        
        .btn-primary {
            background: #007bff !important;
            color: white !important;
            border: none !important;
            padding: 8px 10px !important;
            border-radius: 4px !important;
            cursor: pointer !important;
            font-size: 13px !important;
            transition: all 0.2s ease !important;
            min-width: 34px !important;
            height: 34px !important;
            display: inline-flex !important;
            align-items: center !important;
            justify-content: center !important;
            margin: 0 3px !important;
        }
        
        .btn-primary:hover {
            background: #0056b3 !important;
        }
        
        .btn-danger {
            background: #dc3545 !important;
            color: white !important;
            border: none !important;
            padding: 8px 10px !important;
            border-radius: 4px !important;
            cursor: pointer !important;
            font-size: 13px !important;
            transition: all 0.2s ease !important;
            min-width: 34px !important;
            height: 34px !important;
            display: inline-flex !important;
            align-items: center !important;
            justify-content: center !important;
            margin: 0 3px !important;
        }
        
        .btn-danger:hover {
            background: #c82333 !important;
        }
        
        .btn-sm {
            padding: 6px 8px !important;
            font-size: 12px !important;
            min-width: 30px !important;
            height: 30px !important;
        }
        
        /* ✅ ESTILOS PARA BOTÕES DO FOOTER - PADRONIZAÇÃO COMPLETA */
        #clientListModal .modal-footer .btn,
        #clientModal .modal-footer .btn {
            padding: 10px 20px !important;
            border-radius: 4px !important;
            font-size: 14px !important;
            font-weight: 500 !important;
            transition: all 0.2s ease !important;
            margin: 0 5px !important;
            min-width: 120px !important;
            height: 42px !important;
            display: inline-flex !important;
            align-items: center !important;
            justify-content: center !important;
            gap: 8px !important;
        }
        
        #clientListModal .modal-footer .btn-secondary,
        #clientModal .modal-footer .btn-secondary {
            background: #6c757d !important;
            color: white !important;
            border: none !important;
        }
        
        #clientListModal .modal-footer .btn-secondary:hover,
        #clientModal .modal-footer .btn-secondary:hover {
            background: #545b62 !important;
        }
        
        #clientListModal .modal-footer .btn-primary,
        #clientModal .modal-footer .btn-primary {
            background: #007bff !important;
            color: white !important;
            border: none !important;
        }
        
        #clientListModal .modal-footer .btn-primary:hover,
        #clientModal .modal-footer .btn-primary:hover {
            background: #0056b3 !important;
        }
        
        /* ✅ ANIMAÇÕES */
        @keyframes fadeIn {
            from { opacity: 0; }
            to { opacity: 1; }
        }
        
        @keyframes slideIn {
            from { 
                opacity: 0;
                transform: translateY(-50px);
            }
            to { 
                opacity: 1;
                transform: translateY(0);
            }
        }
        
        /* ✅ RESPONSIVIDADE APRIMORADA */
        @media (max-width: 1200px) {
            .standardized-client-modal-content,
            #clientListModal .modal-content,
            #clientModal .modal-content {
                width: 98% !important;
                max-width: none !important;
            }
        }
        
        @media (max-width: 768px) {
            .standardized-client-modal-content,
            #clientListModal .modal-content,
            #clientModal .modal-content {
                width: 99% !important;
                margin: 1% auto !important;
            }
            
            .standardized-client-modal-header,
            #clientListModal .modal-header,
            #clientModal .modal-header {
                padding: 15px !important;
            }
            
            .standardized-client-modal-title,
            #clientListModal .modal-title,
            #clientModal .modal-title {
                font-size: 18px !important;
            }
            
            .standardized-client-modal-body,
            #clientListModal .modal-body,
            #clientModal .modal-body {
                padding: 15px !important;
            }
            
            .standardized-client-modal-table th,
            .standardized-client-modal-table td,
            #clientListModal .table th,
            #clientListModal .table td,
            #clientModal .table th,
            #clientModal .table td {
                padding: 10px 8px !important;
                font-size: 12px !important;
                height: 48px !important;
            }
            
            .standardized-client-modal-btn,
            .btn-success,
            .btn-primary,
            .btn-danger {
                padding: 6px 8px !important;
                font-size: 12px !important;
                min-width: 30px !important;
                height: 30px !important;
                margin: 0 2px !important;
            }
            
            .standardized-client-modal-filter,
            #clientListModal #clientListFilter,
            #clientModal #clientListFilter {
                padding: 12px 15px !important;
                font-size: 14px !important;
            }
        }
    `;
    
    document.head.appendChild(style);
    console.log("✅ Estilos CSS do modal padronizado injetados com sucesso");
}

// ✅ FUNÇÃO PARA CARREGAR CLIENTES DO FIREBASE
function normalizeClientModalRecord(client) {
    const documento = client.documento || client.document || client.cnpj || client.cpf || 'CNPJ não informado';
    const inscricaoEstadual = client.inscricaoEstadual || client.stateRegistration || client.ie || '';
    const inscricaoMunicipal = client.inscricaoMunicipal || client.municipalRegistration || client.im || '';
    const indIEDest = client.indIEDest || client.indicadorInscricaoEstadual || client.ieIndicator || '';
    const codigoMunicipio = client.codigoMunicipio || client.municipioCodigo || client.municipalityCode || client.cMun || client.ibgeCode || '';
    const paisCodigo = client.paisCodigo || client.countryCode || client.cPais || '1058';
    const pais = client.pais || client.country || client.countryName || client.xPais || 'Brasil';
    return {
        ...client,
        id: client.id || client.clientId || Date.now(),
        nome: client.nome || client.name || client.clientName || 'Nome não informado',
        name: client.nome || client.name || client.clientName || 'Nome não informado',
        cidade: client.cidade || client.city || 'Cidade não informada',
        city: client.cidade || client.city || '',
        estado: client.estado || client.state || client.uf || 'Estado não informado',
        state: client.estado || client.state || client.uf || '',
        telefone: client.telefone || client.phone || client.tel || 'Telefone não informado',
        phone: client.telefone || client.phone || client.tel || '',
        email: client.email || client.mail || 'Email não informado',
        cnpj: documento,
        documento,
        document: documento,
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
        endereco: client.endereco || client.address || 'Endereço não informado',
        address: client.endereco || client.address || '',
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
        xPais: pais,
        observacoes: client.observacoes || client.obs || client.notes || '',
        obs: client.observacoes || client.obs || client.notes || ''
    };
}

async function loadClientsFromFirebase() {
    console.log("🔥 Carregando clientes do Firebase...");
    
    clientModalState.isLoading = true;
    
    try {
        let clients = [];
        
        // Tentar usar função getData se disponível
        if (typeof window.getData === 'function') {
            console.log("✅ Usando função getData para carregar clientes");
            clients = await window.getData(CLIENT_MODAL_CONFIG.firebaseCollection);
        } else {
            console.warn("⚠️ Função getData não disponível, usando fallback");
            
            // Fallback: tentar carregar do localStorage
            const localData = readLocalStorageValue('clients');
            if (localData) {
                clients = JSON.parse(localData);
                console.log("✅ Clientes carregados do localStorage");
            } else {
                console.warn("⚠️ Nenhum dado encontrado no localStorage");
                clients = [];
            }
        }
        
        // Normalizar dados
        if (Array.isArray(clients)) {
            clientModalState.clients = clients.map(normalizeClientModalRecord);
        } else {
            console.warn("⚠️ Dados não são um array, convertendo objeto para array");
            clientModalState.clients = Object.values(clients || {}).map(normalizeClientModalRecord);
        }
        
        // Filtrar clientes válidos
        clientModalState.clients = clientModalState.clients.filter(client => 
            client.nome && client.nome !== 'Nome não informado'
        );
        
        // Ordenar por nome
        clientModalState.clients.sort((a, b) => a.nome.localeCompare(b.nome));
        
        // Inicializar clientes filtrados
        clientModalState.filteredClients = clientModalState.clients;
        
        console.log(`✅ ${clientModalState.clients.length} clientes carregados com sucesso`);
        
    } catch (error) {
        console.error("❌ Erro ao carregar clientes:", error);
        
        // Fallback: dados de exemplo
        clientModalState.clients = [
            {
                id: 1,
                nome: 'Cliente Exemplo',
                cidade: 'Cidade Exemplo',
                estado: 'SP',
                telefone: '(11) 99999-9999',
                email: 'exemplo@email.com',
                cnpj: '00.000.000/0001-00',
                endereco: 'Rua Exemplo, 123',
                observacoes: 'Cliente de exemplo'
            }
        ];
        clientModalState.filteredClients = clientModalState.clients;
        
        console.log("⚠️ Usando dados de exemplo devido ao erro");
    } finally {
        clientModalState.isLoading = false;
    }
}

// ✅ FUNÇÃO PARA RENDERIZAR TABELA NO MODAL NATIVO - CORRIGIDA
function renderNativeClientTable() {
    console.log("🔄 Renderizando tabela no modal nativo...");
    
    const tableBody = document.querySelector('#clientListModal tbody') || 
                     document.querySelector('#clientListModal #clientListTableBody');
    
    if (!tableBody) {
        console.error("❌ Tbody não encontrado no modal nativo");
        return;
    }
    
    // Verificar se é modal de fornecedores ou clientes
    const pageConfig = getPageConfig();
    const isFornecedor = pageConfig.title.includes('Fornecedor');
    
    // Limpar tabela
    tableBody.innerHTML = '';
    
    if (clientModalState.isLoading) {
        const colspan = isFornecedor ? "7" : "6";
        tableBody.innerHTML = `
            <tr>
                <td colspan="${colspan}" style="text-align: center; padding: 30px; color: #666;">
                    <i class="fas fa-spinner fa-spin" style="font-size: 24px; margin-bottom: 10px;"></i><br>
                    Carregando ${isFornecedor ? 'fornecedores' : 'clientes'}...
                </td>
            </tr>
        `;
        return;
    }
    
    if (clientModalState.filteredClients.length === 0) {
        const colspan = isFornecedor ? "7" : "6";
        tableBody.innerHTML = `
            <tr>
                <td colspan="${colspan}" style="text-align: center; padding: 30px; color: #666;">
                    <i class="fas fa-info-circle" style="font-size: 24px; margin-bottom: 10px;"></i><br>
                    Nenhum ${isFornecedor ? 'fornecedor' : 'cliente'} encontrado
                </td>
            </tr>
        `;
        return;
    }
    
    // Calcular itens da página atual
    const startIndex = (clientModalState.currentPage - 1) * CLIENT_MODAL_CONFIG.itemsPerPage;
    const endIndex = startIndex + CLIENT_MODAL_CONFIG.itemsPerPage;
    const currentPageClients = clientModalState.filteredClients.slice(startIndex, endIndex);
    
    // Renderizar clientes/fornecedores
    currentPageClients.forEach(client => {
        const row = document.createElement('tr');
        
        if (isFornecedor) {
            // ✅ ESTRUTURA PARA FORNECEDORES (7 colunas)
            row.innerHTML = `
                <td style="padding: 14px; vertical-align: middle; font-weight: 600; word-wrap: break-word; white-space: normal;">${client.nome}</td>
                <td style="padding: 14px; vertical-align: middle; font-size: 13px; word-wrap: break-word; white-space: normal;">${client.cnpj}</td>
                <td style="padding: 14px; vertical-align: middle; word-wrap: break-word; white-space: normal;">${client.cidade}</td>
                <td style="padding: 14px; vertical-align: middle; text-align: center; font-weight: bold; font-size: 15px;">${client.estado}</td>
                <td style="padding: 14px; vertical-align: middle; word-wrap: break-word; white-space: normal;">${client.telefone}</td>
                <td style="padding: 14px; vertical-align: middle; font-size: 13px; word-wrap: break-word; white-space: normal;">${client.email}</td>
                <td style="padding: 14px; vertical-align: middle; text-align: center;">
                    <div style="display: flex; gap: 3px; justify-content: center; align-items: center;">
                        <button class="btn btn-sm btn-success" onclick="selectStandardizedClient('${client.id}')" title="Selecionar fornecedor">
                            <i class="fas fa-check"></i>
                        </button>
                        <button class="btn btn-sm btn-primary" onclick="editStandardizedClient('${client.id}')" title="Editar fornecedor">
                            <i class="fas fa-edit"></i>
                        </button>
                        <button class="btn btn-sm btn-danger" onclick="deleteStandardizedClient('${client.id}')" title="Excluir fornecedor">
                            <i class="fas fa-trash"></i>
                        </button>
                    </div>
                </td>
            `;
        } else {
            // ✅ ESTRUTURA PARA CLIENTES (6 colunas) - CORRIGIDA
            row.innerHTML = `
                <td style="padding: 14px; vertical-align: middle; font-weight: 600; word-wrap: break-word; white-space: normal;">${client.nome}</td>
                <td style="padding: 14px; vertical-align: middle; word-wrap: break-word; white-space: normal;">${client.cidade}</td>
                <td style="padding: 14px; vertical-align: middle; text-align: center; font-weight: bold; font-size: 15px;">${client.estado}</td>
                <td style="padding: 14px; vertical-align: middle; word-wrap: break-word; white-space: normal;">${client.telefone}</td>
                <td style="padding: 14px; vertical-align: middle; font-size: 13px; word-wrap: break-word; white-space: normal;">${client.email}</td>
                <td style="padding: 14px; vertical-align: middle; text-align: center;">
                    <div style="display: flex; gap: 3px; justify-content: center; align-items: center;">
                        <button class="btn btn-sm btn-success" onclick="selectStandardizedClient('${client.id}')" title="Selecionar cliente">
                            <i class="fas fa-check"></i>
                        </button>
                        <button class="btn btn-sm btn-primary" onclick="editStandardizedClient('${client.id}')" title="Editar cliente">
                            <i class="fas fa-edit"></i>
                        </button>
                        <button class="btn btn-sm btn-danger" onclick="deleteStandardizedClient('${client.id}')" title="Excluir cliente">
                            <i class="fas fa-trash"></i>
                        </button>
                    </div>
                </td>
            `;
        }
        
        tableBody.appendChild(row);
    });
    
    // Renderizar paginação para modal nativo
    renderNativeClientPagination();
    
    console.log(`✅ Tabela renderizada com ${currentPageClients.length} ${isFornecedor ? 'fornecedores' : 'clientes'}`);
}

// ✅ FUNÇÃO PARA RENDERIZAR PAGINAÇÃO NO MODAL NATIVO
function renderNativeClientPagination() {
    console.log("🔄 Renderizando paginação no modal nativo...");
    
    // Buscar ou criar container de paginação
    let paginationContainer = document.getElementById('nativeClientPagination');
    if (!paginationContainer) {
        // Criar container de paginação se não existir
        const modalBody = document.querySelector('#clientListModal .modal-body');
        if (modalBody) {
            paginationContainer = document.createElement('div');
            paginationContainer.id = 'nativeClientPagination';
            paginationContainer.style.cssText = `
                display: flex;
                justify-content: center;
                align-items: center;
                gap: 5px;
                margin-top: 20px;
                padding: 10px;
            `;
            modalBody.appendChild(paginationContainer);
        } else {
            return;
        }
    }
    
    // Limpar paginação
    paginationContainer.innerHTML = '';
    
    const totalPages = Math.ceil(clientModalState.filteredClients.length / CLIENT_MODAL_CONFIG.itemsPerPage);
    
    if (totalPages <= 1) {
        console.log("✅ Paginação desnecessária (1 página ou menos)");
        return;
    }
    
    // Estilo para botões
    const buttonStyle = `
        padding: 8px 12px;
        border: 1px solid #dee2e6;
        background: white;
        color: #495057;
        cursor: pointer;
        border-radius: 4px;
        transition: all 0.2s;
        font-size: 14px;
        margin: 0 2px;
    `;
    
    const activeButtonStyle = `
        ${buttonStyle}
        background: #007bff;
        border-color: #007bff;
        color: white;
    `;
    
    const disabledButtonStyle = `
        ${buttonStyle}
        background: #f8f9fa;
        border-color: #dee2e6;
        color: #6c757d;
        cursor: not-allowed;
    `;
    
    // Botão "Primeira"
    const firstBtn = document.createElement('button');
    firstBtn.innerHTML = '<i class="fas fa-angle-double-left"></i>';
    firstBtn.style.cssText = clientModalState.currentPage === 1 ? disabledButtonStyle : buttonStyle;
    firstBtn.disabled = clientModalState.currentPage === 1;
    firstBtn.onclick = () => goToClientPage(1);
    firstBtn.title = 'Primeira página';
    paginationContainer.appendChild(firstBtn);
    
    // Botão "Anterior"
    const prevBtn = document.createElement('button');
    prevBtn.innerHTML = '<i class="fas fa-angle-left"></i>';
    prevBtn.style.cssText = clientModalState.currentPage === 1 ? disabledButtonStyle : buttonStyle;
    prevBtn.disabled = clientModalState.currentPage === 1;
    prevBtn.onclick = () => goToClientPage(clientModalState.currentPage - 1);
    prevBtn.title = 'Página anterior';
    paginationContainer.appendChild(prevBtn);
    
    // Botões de páginas (máximo 5 visíveis)
    const startPage = Math.max(1, clientModalState.currentPage - 2);
    const endPage = Math.min(totalPages, startPage + 4);
    
    for (let i = startPage; i <= endPage; i++) {
        const pageBtn = document.createElement('button');
        pageBtn.textContent = i;
        pageBtn.style.cssText = i === clientModalState.currentPage ? activeButtonStyle : buttonStyle;
        pageBtn.onclick = () => goToClientPage(i);
        pageBtn.title = `Página ${i}`;
        paginationContainer.appendChild(pageBtn);
    }
    
    // Botão "Próxima"
    const nextBtn = document.createElement('button');
    nextBtn.innerHTML = '<i class="fas fa-angle-right"></i>';
    nextBtn.style.cssText = clientModalState.currentPage === totalPages ? disabledButtonStyle : buttonStyle;
    nextBtn.disabled = clientModalState.currentPage === totalPages;
    nextBtn.onclick = () => goToClientPage(clientModalState.currentPage + 1);
    nextBtn.title = 'Próxima página';
    paginationContainer.appendChild(nextBtn);
    
    // Botão "Última"
    const lastBtn = document.createElement('button');
    lastBtn.innerHTML = '<i class="fas fa-angle-double-right"></i>';
    lastBtn.style.cssText = clientModalState.currentPage === totalPages ? disabledButtonStyle : buttonStyle;
    lastBtn.disabled = clientModalState.currentPage === totalPages;
    lastBtn.onclick = () => goToClientPage(totalPages);
    lastBtn.title = 'Última página';
    paginationContainer.appendChild(lastBtn);
    
    console.log(`✅ Paginação renderizada (${clientModalState.currentPage}/${totalPages})`);
}

// ✅ FUNÇÃO PARA CRIAR MODAL PADRONIZADO
function createStandardizedClientModal(config = {}) {
    console.log("🔨 Criando modal padronizado...");
    
    const pageConfig = config || getPageConfig();
    const modalId = pageConfig.modalId || CLIENT_MODAL_CONFIG.modalId;
    const isFornecedor = pageConfig.title.includes('Fornecedor');
    
    // Remover modal existente se houver
    const existingModal = document.getElementById(modalId);
    if (existingModal) {
        existingModal.remove();
    }
    
    // Criar modal
    const modal = document.createElement('div');
    modal.id = modalId;
    modal.className = 'standardized-client-modal';
    
    // Definir headers baseado no tipo
    let tableHeaders = '';
    if (isFornecedor) {
        tableHeaders = `
            <tr>
                <th>Nome</th>
                <th>CNPJ</th>
                <th>Cidade</th>
                <th>Estado</th>
                <th>Telefone</th>
                <th>Email</th>
                <th>Ações</th>
            </tr>
        `;
    } else {
        tableHeaders = `
            <tr>
                <th>Nome</th>
                <th>Cidade</th>
                <th>Estado</th>
                <th>Telefone</th>
                <th>Email</th>
                <th>Ações</th>
            </tr>
        `;
    }
    
    modal.innerHTML = `
        <div class="standardized-client-modal-content">
            <div class="standardized-client-modal-header">
                <h3 class="standardized-client-modal-title">${pageConfig.title || 'Lista de Clientes'}</h3>
                <button type="button" class="standardized-client-modal-close">
                    <i class="fas fa-times"></i>
                </button>
            </div>
            <div class="standardized-client-modal-body">
                <input type="text" id="${CLIENT_MODAL_CONFIG.filterId}" class="standardized-client-modal-filter" 
                       placeholder="🔍 Filtrar por nome, cidade, estado, telefone ou email...">
                <div class="table-responsive">
                    <table class="standardized-client-modal-table ${isFornecedor ? 'suppliers-table' : 'clients-table'}" id="${CLIENT_MODAL_CONFIG.tableId}">
                        <thead>
                            ${tableHeaders}
                        </thead>
                        <tbody>
                            <tr>
                                <td colspan="${isFornecedor ? '7' : '6'}" style="text-align: center; padding: 30px; color: #666;">
                                    <i class="fas fa-spinner fa-spin" style="font-size: 24px; margin-bottom: 10px;"></i><br>
                                    Carregando ${isFornecedor ? 'fornecedores' : 'clientes'}...
                                </td>
                            </tr>
                        </tbody>
                    </table>
                </div>
                <div id="${CLIENT_MODAL_CONFIG.paginationId}" class="standardized-client-modal-pagination"></div>
            </div>
            <div class="standardized-client-modal-footer">
                <div id="clientModalInfo" class="standardized-client-modal-info">
                    <i class="fas fa-info-circle"></i> Carregando...
                </div>
                <div>
                    <button type="button" class="standardized-client-modal-btn secondary" onclick="closeStandardizedClientModal()">
                        <i class="fas fa-times"></i> Fechar
                    </button>
                    <button type="button" class="standardized-client-modal-btn primary" onclick="window.${pageConfig.newButtonCallback || 'openNewClientModal'}()">
                        <i class="fas fa-plus"></i> ${pageConfig.newButtonText || 'Novo Cliente'}
                    </button>
                </div>
            </div>
        </div>
    `;
    
    // Adicionar ao DOM
    document.body.appendChild(modal);
    
    // Configurar event listeners
    setupStandardizedModalEventListeners(modal);
    
    console.log("✅ Modal padronizado criado com sucesso");
    return modal;
}

// ✅ FUNÇÃO PARA CONFIGURAR EVENT LISTENERS DO MODAL PADRONIZADO
function setupStandardizedModalEventListeners(modal) {
    console.log("🔧 Configurando event listeners do modal padronizado...");
    
    // Botão fechar do header
    const closeButton = modal.querySelector('.standardized-client-modal-close');
    if (closeButton) {
        closeButton.addEventListener('click', closeStandardizedClientModal);
    }
    
    // Clicar fora do modal
    modal.addEventListener('click', function(event) {
        if (event.target === modal) {
            closeStandardizedClientModal();
        }
    });
    
    // Tecla ESC
    const escapeHandler = function(event) {
        if (event.key === 'Escape' && modal.style.display === 'block') {
            closeStandardizedClientModal();
        }
    };
    
    document.addEventListener('keydown', escapeHandler);
    modal._escapeHandler = escapeHandler;
    
    // Filtro
    const filterInput = modal.querySelector(`#${CLIENT_MODAL_CONFIG.filterId}`);
    if (filterInput) {
        filterInput.addEventListener('input', function(event) {
            filterStandardizedClients(event.target.value);
        });
    }
    
    console.log("✅ Event listeners configurados");
}

// ✅ FUNÇÃO PARA RENDERIZAR TABELA PADRONIZADA - CORRIGIDA
function renderStandardizedClientTable() {
    console.log("🔄 Renderizando tabela padronizada...");
    
    const tableBody = document.querySelector(`#${CLIENT_MODAL_CONFIG.tableId} tbody`);
    if (!tableBody) {
        console.error("❌ Tbody não encontrado na tabela padronizada");
        return;
    }
    
    // Verificar se é modal de fornecedores ou clientes
    const pageConfig = getPageConfig();
    const isFornecedor = pageConfig.title.includes('Fornecedor');
    
    // Limpar tabela
    tableBody.innerHTML = '';
    
    if (clientModalState.isLoading) {
        const colspan = isFornecedor ? "7" : "6";
        tableBody.innerHTML = `
            <tr>
                <td colspan="${colspan}" style="text-align: center; padding: 30px; color: #666;">
                    <i class="fas fa-spinner fa-spin" style="font-size: 24px; margin-bottom: 10px;"></i><br>
                    Carregando ${isFornecedor ? 'fornecedores' : 'clientes'}...
                </td>
            </tr>
        `;
        return;
    }
    
    if (clientModalState.filteredClients.length === 0) {
        const colspan = isFornecedor ? "7" : "6";
        tableBody.innerHTML = `
            <tr>
                <td colspan="${colspan}" style="text-align: center; padding: 30px; color: #666;">
                    <i class="fas fa-info-circle" style="font-size: 24px; margin-bottom: 10px;"></i><br>
                    Nenhum ${isFornecedor ? 'fornecedor' : 'cliente'} encontrado
                </td>
            </tr>
        `;
        return;
    }
    
    // Calcular itens da página atual
    const startIndex = (clientModalState.currentPage - 1) * CLIENT_MODAL_CONFIG.itemsPerPage;
    const endIndex = startIndex + CLIENT_MODAL_CONFIG.itemsPerPage;
    const currentPageClients = clientModalState.filteredClients.slice(startIndex, endIndex);
    
    // Renderizar clientes/fornecedores
    currentPageClients.forEach(client => {
        const row = document.createElement('tr');
        
        if (isFornecedor) {
            // ✅ ESTRUTURA PARA FORNECEDORES (7 colunas)
            row.innerHTML = `
                <td>${client.nome}</td>
                <td style="font-size: 13px;">${client.cnpj}</td>
                <td>${client.cidade}</td>
                <td style="text-align: center; font-weight: bold; font-size: 15px;">${client.estado}</td>
                <td>${client.telefone}</td>
                <td style="font-size: 13px;">${client.email}</td>
                <td style="text-align: center;">
                    <button class="standardized-client-modal-btn success" onclick="selectStandardizedClient('${client.id}')" title="Selecionar fornecedor">
                        <i class="fas fa-check"></i>
                    </button>
                    <button class="standardized-client-modal-btn primary" onclick="editStandardizedClient('${client.id}')" title="Editar fornecedor">
                        <i class="fas fa-edit"></i>
                    </button>
                    <button class="standardized-client-modal-btn danger" onclick="deleteStandardizedClient('${client.id}')" title="Excluir fornecedor">
                        <i class="fas fa-trash"></i>
                    </button>
                </td>
            `;
        } else {
            // ✅ ESTRUTURA PARA CLIENTES (6 colunas) - CORRIGIDA
            row.innerHTML = `
                <td>${client.nome}</td>
                <td>${client.cidade}</td>
                <td style="text-align: center; font-weight: bold; font-size: 15px;">${client.estado}</td>
                <td>${client.telefone}</td>
                <td style="font-size: 13px;">${client.email}</td>
                <td style="text-align: center;">
                    <button class="standardized-client-modal-btn success" onclick="selectStandardizedClient('${client.id}')" title="Selecionar cliente">
                        <i class="fas fa-check"></i>
                    </button>
                    <button class="standardized-client-modal-btn primary" onclick="editStandardizedClient('${client.id}')" title="Editar cliente">
                        <i class="fas fa-edit"></i>
                    </button>
                    <button class="standardized-client-modal-btn danger" onclick="deleteStandardizedClient('${client.id}')" title="Excluir cliente">
                        <i class="fas fa-trash"></i>
                    </button>
                </td>
            `;
        }
        
        tableBody.appendChild(row);
    });
    
    console.log(`✅ Tabela padronizada renderizada com ${currentPageClients.length} ${isFornecedor ? 'fornecedores' : 'clientes'}`);
}

// ✅ FUNÇÃO PARA RENDERIZAR PAGINAÇÃO PADRONIZADA
function renderStandardizedClientPagination() {
    console.log("🔄 Renderizando paginação padronizada...");
    
    const paginationContainer = document.getElementById(CLIENT_MODAL_CONFIG.paginationId);
    if (!paginationContainer) {
        console.error("❌ Container de paginação não encontrado");
        return;
    }
    
    // Limpar paginação
    paginationContainer.innerHTML = '';
    
    const totalPages = Math.ceil(clientModalState.filteredClients.length / CLIENT_MODAL_CONFIG.itemsPerPage);
    
    if (totalPages <= 1) {
        console.log("✅ Paginação desnecessária (1 página ou menos)");
        return;
    }
    
    // Botão "Primeira"
    const firstBtn = document.createElement('button');
    firstBtn.innerHTML = '<i class="fas fa-angle-double-left"></i>';
    firstBtn.disabled = clientModalState.currentPage === 1;
    firstBtn.onclick = () => goToClientPage(1);
    firstBtn.title = 'Primeira página';
    paginationContainer.appendChild(firstBtn);
    
    // Botão "Anterior"
    const prevBtn = document.createElement('button');
    prevBtn.innerHTML = '<i class="fas fa-angle-left"></i>';
    prevBtn.disabled = clientModalState.currentPage === 1;
    prevBtn.onclick = () => goToClientPage(clientModalState.currentPage - 1);
    prevBtn.title = 'Página anterior';
    paginationContainer.appendChild(prevBtn);
    
    // Botões de páginas (máximo 5 visíveis)
    const startPage = Math.max(1, clientModalState.currentPage - 2);
    const endPage = Math.min(totalPages, startPage + 4);
    
    for (let i = startPage; i <= endPage; i++) {
        const pageBtn = document.createElement('button');
        pageBtn.textContent = i;
        pageBtn.className = i === clientModalState.currentPage ? 'active' : '';
        pageBtn.onclick = () => goToClientPage(i);
        pageBtn.title = `Página ${i}`;
        paginationContainer.appendChild(pageBtn);
    }
    
    // Botão "Próxima"
    const nextBtn = document.createElement('button');
    nextBtn.innerHTML = '<i class="fas fa-angle-right"></i>';
    nextBtn.disabled = clientModalState.currentPage === totalPages;
    nextBtn.onclick = () => goToClientPage(clientModalState.currentPage + 1);
    nextBtn.title = 'Próxima página';
    paginationContainer.appendChild(nextBtn);
    
    // Botão "Última"
    const lastBtn = document.createElement('button');
    lastBtn.innerHTML = '<i class="fas fa-angle-double-right"></i>';
    lastBtn.disabled = clientModalState.currentPage === totalPages;
    lastBtn.onclick = () => goToClientPage(totalPages);
    lastBtn.title = 'Última página';
    paginationContainer.appendChild(lastBtn);
    
    console.log(`✅ Paginação padronizada renderizada (${clientModalState.currentPage}/${totalPages})`);
}

// ✅ FUNÇÃO PARA FECHAR MODAL - VERSÃO HÍBRIDA MELHORADA
function closeStandardizedClientModal(modalId = CLIENT_MODAL_CONFIG.modalId) {
    console.log("🚪 Fechando modal padronizado:", modalId);
    
    let modalFechado = false;
    
    // Primeiro tentar fechar modal específico por ID
    const modal = document.getElementById(modalId);
    if (modal) {
        console.log("🎯 Fechando modal específico:", modalId);
        
        // Fechar usando múltiplos métodos para garantir
        modal.style.display = 'none';
        modal.style.visibility = 'hidden';
        modal.style.opacity = '0';
        modal.classList.remove('show');
        modal.classList.add('hidden');
        
        // Remover event listeners para evitar memory leaks
        if (modal._escapeHandler) {
            document.removeEventListener('keydown', modal._escapeHandler);
        }
        
        console.log("✅ Modal específico fechado:", modalId);
        modalFechado = true;
    }
    
    // Fallback: fechar qualquer modal de cliente visível
    const allModals = document.querySelectorAll('.modal, .standardized-client-modal');
    allModals.forEach(modal => {
        if (modal.id.includes('client') || modal.id.includes('Client')) {
            const computedStyle = window.getComputedStyle(modal);
            if (modal.style.display === 'block' || 
                modal.style.display === '' || 
                computedStyle.display === 'block' ||
                computedStyle.visibility === 'visible') {
                
                console.log("🔄 Fechando modal adicional:", modal.id);
                modal.style.display = 'none';
                modal.style.visibility = 'hidden';
                modal.style.opacity = '0';
                modal.classList.remove('show');
                modal.classList.add('hidden');
                
                // Remover event listeners
                if (modal._escapeHandler) {
                    document.removeEventListener('keydown', modal._escapeHandler);
                }
                
                modalFechado = true;
            }
        }
    });
    
    // Remover overlay se existir
    const overlays = document.querySelectorAll('.modal-backdrop, .modal-overlay');
    overlays.forEach(overlay => {
        overlay.remove();
        console.log("🗑️ Overlay removido");
    });
    
    // Restaurar scroll do body
    document.body.style.overflow = '';
    document.body.classList.remove('modal-open');
    
    console.log(modalFechado ? "✅ Modal fechado com sucesso" : "⚠️ Nenhum modal encontrado para fechar");
    return modalFechado;
}

// ✅ FUNÇÃO PARA SELECIONAR CLIENTE - VERSÃO HÍBRIDA CORRIGIDA
function selectStandardizedClient(clientId) {
    console.log("✅ Selecionando cliente:", clientId);
    
    const client = clientModalState.clients.find(c => String(c.id) === String(clientId));
    if (!client) {
        console.error("❌ Cliente não encontrado:", clientId);
        try {
            if (typeof window.__toast === 'function') {
                window.__toast('Cliente não encontrado.', 'error', { duration: 5000 });
            } else if (window.Utils && window.Utils.showToast) {
                window.Utils.showToast('Cliente não encontrado.', 'error');
            }
        } catch (_) {}
        return;
    }
    
    // FORÇAR FECHAMENTO DO MODAL IMEDIATAMENTE
    console.log("🚪 FORÇANDO fechamento do modal ANTES de preencher campos...");
    
    // Método 1: Fechar usando nossa função
    closeStandardizedClientModal();
    
    // Método 2: Fechar usando função nativa se existir
    if (typeof window.closeClientListModal === 'function') {
        try {
            window.closeClientListModal();
            console.log("✅ Modal fechado usando função nativa");
        } catch (error) {
            console.warn("⚠️ Erro ao usar função nativa:", error);
        }
    }
    
    // Método 3: Fechar forçadamente todos os modais relacionados
    const modalsToClose = document.querySelectorAll('#clientListModal, #fornecedorListModal, .standardized-client-modal');
    modalsToClose.forEach(modal => {
        modal.style.display = 'none';
        modal.style.visibility = 'hidden';
        modal.style.opacity = '0';
        modal.classList.remove('show');
        modal.classList.add('hidden');
        console.log("🔒 Modal forçadamente fechado:", modal.id);
    });
    
    // Aguardar um pouco para garantir que o modal foi fechado
    setTimeout(() => {
        console.log("🔄 Processando seleção do cliente:", client.nome);
        
        // Tentar usar funções específicas da página primeiro
        if (typeof window.selectClient === 'function') {
            console.log("✅ Usando função selectClient");
            try {
                window.selectClient(client);
                return;
            } catch (error) {
                console.error("❌ Erro na função selectClient:", error);
            }
        }
        
        if (typeof window.selectClientFromList === 'function') {
            console.log("✅ Usando função selectClientFromList");
            try {
                window.selectClientFromList(clientId);
                return;
            } catch (error) {
                console.error("❌ Erro na função selectClientFromList:", error);
            }
        }
        
        if (typeof window.selectFornecedorFromList === 'function') {
            console.log("✅ Usando função selectFornecedorFromList");
            try {
                window.selectFornecedorFromList(clientId);
                return;
            } catch (error) {
                console.error("❌ Erro na função selectFornecedorFromList:", error);
            }
        }
        
        // Fallback manual - tentar múltiplos IDs de campos
        console.log("✅ Usando fallback manual para seleção");
        const fieldIds = ['clienteInput', 'inputCliente', 'cliente', 'nomeCliente', 'clientName'];
        let fieldsUpdated = 0;
        
        fieldIds.forEach(fieldId => {
            const field = document.getElementById(fieldId);
            if (field) {
                field.value = client.nome;
                fieldsUpdated++;
                console.log(`✅ Campo ${fieldId} atualizado:`, client.nome);
                
                // Disparar múltiplos eventos para garantir atualização
                ['change', 'input', 'blur', 'keyup'].forEach(eventType => {
                    const event = new Event(eventType, { bubbles: true });
                    field.dispatchEvent(event);
                });
            }
        });
        
        // Atualizar campo de ID se existir
        const idField = document.getElementById('clienteId');
        if (idField) {
            idField.value = client.id;
            console.log("✅ Campo clienteId atualizado:", client.id);
        }
        
        // Salvar cliente selecionado globalmente
        window.selectedClient = client;
        
        console.log(`✅ Cliente selecionado: ${client.nome} (${fieldsUpdated} campos atualizados)`);
        
        // Mostrar feedback visual se nenhum campo foi atualizado
        if (fieldsUpdated === 0) {
            console.warn("⚠️ Nenhum campo de cliente encontrado para atualizar");
            try {
                const msg = `Cliente "${client.nome}" selecionado, mas os campos não foram encontrados na página.`;
                if (typeof window.__toast === 'function') {
                    window.__toast(msg, 'warning');
                } else if (window.Utils && window.Utils.showToast) {
                    window.Utils.showToast(msg, 'warning');
                }
            } catch (_) {}
        }
        
        // Verificar se modal ainda está visível e forçar fechamento novamente
        setTimeout(() => {
            const stillVisible = document.querySelector('#clientListModal[style*="display: block"], #clientListModal[style*="display:block"]');
            if (stillVisible) {
                console.warn("⚠️ Modal ainda visível, forçando fechamento final");
                stillVisible.style.display = 'none';
                stillVisible.style.visibility = 'hidden';
                stillVisible.style.opacity = '0';
            }
        }, 100);
        
    }, 100);
}

// ✅ FUNÇÃO PARA EDITAR CLIENTE - VERSÃO HÍBRIDA MELHORADA
function editStandardizedClient(clientId) {
    console.log("✏️ === EDITANDO CLIENTE/FORNECEDOR ===", clientId);
    
    const client = clientModalState.clients.find(c => String(c.id) === String(clientId));
    if (!client) {
        console.error("❌ Cliente não encontrado:", clientId);
        try {
            if (typeof window.__toast === 'function') {
                window.__toast('Cliente não encontrado.', 'error', { duration: 5000 });
            } else if (window.Utils && window.Utils.showToast) {
                window.Utils.showToast('Cliente não encontrado.', 'error');
            }
        } catch (_) {}
        return;
    }
    
    // Fechar modal de lista ANTES de abrir modal de edição
    closeStandardizedClientModal();
    
    // Aguardar fechamento e então abrir modal de edição
    setTimeout(() => {
        console.log("🔄 Abrindo modal de edição para:", client.nome);
        
        // Estratégia 1: Tentar usar funções específicas da página (funções originais salvas)
        const editFunctionsToTry = [
            'editClientFromListOriginal',
            'editClientFromList',
            'editFornecedorFromList',
            'editFornecedorFromListOriginal',
            'editClientOriginal',
            'editClient'
        ];
        
        for (const funcName of editFunctionsToTry) {
            if (typeof window[funcName] === 'function') {
                console.log(`✅ Usando função ${funcName} para edição`);
                try {
                    window[funcName](clientId);
                    return;
                } catch (error) {
                    console.error(`❌ Erro na função ${funcName}:`, error);
                }
            }
        }
        
        // Estratégia 2: Para romaneiopct - abrir modal nativo diretamente
        const pageConfig = getPageConfig();
        if (pageConfig === PAGE_CONFIGS.romaneiopct) {
            console.log("🔄 Usando estratégia específica para romaneiopct");
            
            const modal = document.getElementById('clientModal');
            if (modal) {
                // Resetar formulário primeiro
                const form = modal.querySelector('#clientForm');
                if (form) {
                    form.reset();
                }
                
                // Preencher campos
                const fieldsUpdated = fillEditFields(client, modal);
                
                if (fieldsUpdated > 0) {
                    // Atualizar título
                    const modalTitle = modal.querySelector('#clientModalTitle');
                    if (modalTitle) {
                        modalTitle.textContent = 'Editar Cliente';
                    }
                    
                    // Definir ID de edição
                    window.editingClientId = client.id;
                    
                    // Abrir modal
                    modal.style.display = 'block';
                    modal.style.visibility = 'visible';
                    modal.style.opacity = '1';
                    modal.classList.remove('hidden');
                    modal.classList.add('show');
                    
                    // Focar no campo de nome
                    setTimeout(() => {
                        const nameField = modal.querySelector('#clientName');
                        if (nameField) {
                            nameField.focus();
                        }
                    }, 100);
                    
                    console.log(`✅ Modal romaneiopct aberto com ${fieldsUpdated} campos preenchidos`);
                    return;
                }
            }
        }
        
        // Estratégia 3: Tentar abrir modal de cliente e preencher com dados
        const modalIds = ['clientModal', 'fornecedorModal', 'newClientModal'];
        
        for (const modalId of modalIds) {
            const modal = document.getElementById(modalId);
            if (modal) {
                console.log(`✅ Abrindo modal ${modalId} para edição`);
                
                // Resetar formulário primeiro
                const form = modal.querySelector('form');
                if (form) {
                    form.reset();
                }
                
                // Preencher campos antes de abrir
                const fieldsUpdated = fillEditFields(client, modal);
                
                if (fieldsUpdated > 0) {
                    // Abrir modal
                    modal.style.display = 'block';
                    modal.style.visibility = 'visible';
                    modal.style.opacity = '1';
                    modal.classList.remove('hidden');
                    modal.classList.add('show');
                    
                    // Focar no campo de nome
                    setTimeout(() => {
                        const nameField = modal.querySelector('#clientName, [name="clientName"]');
                        if (nameField) {
                            nameField.focus();
                        }
                    }, 100);
                    
                    console.log(`✅ Modal de edição ${modalId} aberto com ${fieldsUpdated} campos preenchidos`);
                    return;
                }
            }
        }
        
        // Estratégia 4: Fallback - mostrar modal informativo
        console.warn("⚠️ Nenhum modal de edição encontrado");
        showEditFallback(client);
        
    }, 150);
}

// ✅ FUNÇÃO AUXILIAR PARA PREENCHER CAMPOS DE EDIÇÃO - MELHORADA
function fillEditFields(client, modal = null) {
    console.log("📝 Preenchendo campos de edição para:", client.nome);
    
    // Se modal não foi especificado, procurar em toda a página
    const container = modal || document;
    
    const fieldMappings = [
        { selectors: ['#clientId', '[name="clientId"]'], value: client.id },
        { selectors: ['#clientName', '[name="clientName"]'], value: client.nome },
        { selectors: ['#clientCnpj', '[name="clientCnpj"]'], value: client.documento || client.document || client.cnpj || client.cpf },
        { selectors: ['#clientPersonType', '[name="clientPersonType"]'], value: client.tipoPessoa || client.personType || client.fiscalPersonType },
        { selectors: ['#clientIndIEDest', '[name="clientIndIEDest"]'], value: client.indIEDest || client.indicadorInscricaoEstadual || client.ieIndicator },
        { selectors: ['#clientStateRegistration', '[name="clientStateRegistration"]'], value: client.inscricaoEstadual || client.stateRegistration || client.ie },
        { selectors: ['#clientMunicipalRegistration', '[name="clientMunicipalRegistration"]'], value: client.inscricaoMunicipal || client.municipalRegistration },
        { selectors: ['#clientSuframa', '[name="clientSuframa"]'], value: client.suframa },
        { selectors: ['#clientCep', '[name="clientCep"]'], value: client.cep || client.postalCode },
        { selectors: ['#clientPhone', '[name="clientPhone"]'], value: client.telefone },
        { selectors: ['#clientEmail', '[name="clientEmail"]'], value: client.email },
        { selectors: ['#clientAddress', '[name="clientAddress"]'], value: client.endereco },
        { selectors: ['#clientNumber', '[name="clientNumber"]'], value: client.numero || client.number },
        { selectors: ['#clientNeighborhood', '[name="clientNeighborhood"]'], value: client.bairro || client.neighborhood },
        { selectors: ['#clientComplement', '[name="clientComplement"]'], value: client.complemento || client.complement },
        { selectors: ['#clientObs', '[name="clientObs"]'], value: client.observacoes },
        { selectors: ['#clientState', '[name="clientState"]'], value: client.estado },
        { selectors: ['#clientCity', '[name="clientCity"]'], value: client.cidade },
        { selectors: ['#clientMunicipalityCode', '[name="clientMunicipalityCode"]'], value: client.codigoMunicipio || client.municipioCodigo || client.municipalityCode || client.cMun || client.ibgeCode },
        { selectors: ['#clientCountryCode', '[name="clientCountryCode"]'], value: client.paisCodigo || client.countryCode || client.cPais || '1058' },
        { selectors: ['#clientCountryName', '[name="clientCountryName"]'], value: client.pais || client.country || client.countryName || client.xPais || 'Brasil' }
    ];
    
    let fieldsFound = 0;
    
    fieldMappings.forEach(mapping => {
        if (!mapping.value) return; // Pular campos vazios
        
        for (const selector of mapping.selectors) {
            const field = container.querySelector(selector);
            if (field) {
                field.value = mapping.value;
                fieldsFound++;
                console.log(`✅ Campo ${selector} preenchido:`, mapping.value);
                
                // Disparar eventos para garantir atualização
                ['change', 'input', 'blur'].forEach(eventType => {
                    const event = new Event(eventType, { bubbles: true });
                    field.dispatchEvent(event);
                });
                
                break; // Parar após encontrar o primeiro campo válido
            }
        }
    });
    
    // Atualizar título do modal
    const modalTitle = container.querySelector('.modal-title, #clientModalTitle');
    if (modalTitle) {
        modalTitle.textContent = 'Editar Cliente';
        console.log("✅ Título do modal atualizado");
    }
    
    // Definir ID de edição globalmente
    window.editingClientId = client.id;
    
    console.log(`✅ ${fieldsFound} campos preenchidos para edição`);
    
    return fieldsFound;
}

// ✅ FUNÇÃO PARA MOSTRAR FALLBACK DE EDIÇÃO - MELHORADA
function showEditFallback(client) {
    console.log("📝 Mostrando fallback de edição para:", client.nome);
    
    // Tentar preencher campos de edição manualmente em toda a página
    const fieldsUpdated = fillEditFields(client);
    
    if (fieldsUpdated === 0) {
        // Se nenhum campo foi encontrado, mostrar modal informativo
        const modalHTML = `
            <div id="tempEditClientModal" class="modal standardized-client-modal" style="display: block;">
                <div class="standardized-client-modal-content">
                    <div class="standardized-client-modal-header">
                        <h3 class="standardized-client-modal-title">Editar Cliente</h3>
                        <button type="button" class="standardized-client-modal-close" onclick="document.getElementById('tempEditClientModal').remove()">
                            <i class="fas fa-times"></i>
                        </button>
                    </div>
                    <div class="standardized-client-modal-body">
                        <p><strong>Nome:</strong> ${client.nome}</p>
                        <p><strong>Cidade:</strong> ${client.cidade}</p>
                        <p><strong>Estado:</strong> ${client.estado}</p>
                        <p><strong>Telefone:</strong> ${client.telefone}</p>
                        <p><strong>Email:</strong> ${client.email}</p>
                        <br>
                        <p>⚠️ Função de edição não está disponível nesta página.</p>
                        <p>Os campos de edição não foram encontrados.</p>
                        <p>Verifique se todos os scripts foram carregados corretamente.</p>
                    </div>
                    <div class="standardized-client-modal-footer">
                        <button type="button" class="standardized-client-modal-btn secondary" onclick="document.getElementById('tempEditClientModal').remove()">
                            Fechar
                        </button>
                        <button type="button" class="standardized-client-modal-btn primary" onclick="window.location.href='${isFornecedor ? 'fornecedor.html' : 'client.html'}'">
                            ${isFornecedor ? 'Ir para Fornecedores' : 'Ir para Clientes'}
                        </button>
                    </div>
                </div>
            </div>
        `;
        document.body.insertAdjacentHTML('beforeend', modalHTML);
        
        // Adicionar event listener para fechar
        const tempModal = document.getElementById('tempEditClientModal');
        if (tempModal) {
            tempModal.addEventListener('click', function(event) {
                if (event.target === tempModal) {
                    tempModal.remove();
                }
            });
        }
    } else {
        console.log(`✅ ${fieldsUpdated} campos preenchidos para edição`);
        
        // Tentar abrir modal de edição se existir
        const editModal = document.getElementById('clientModal');
        if (editModal) {
            editModal.style.display = 'block';
            console.log("✅ Modal de edição aberto");
        }
    }
}

// ✅ FUNÇÃO PARA APLICAR CLASSES CSS CORRETAS AOS MODAIS NATIVOS - MELHORADA
function applyNativeModalClasses() {
    console.log("🎨 Aplicando classes CSS aos modais nativos...");
    
    const pageConfig = getPageConfig();
    const isFornecedor = pageConfig.title.includes('Fornecedor');
    
    // Aplicar classe à tabela nativa
    const nativeTable = document.querySelector('#clientListModal table');
    if (nativeTable) {
        nativeTable.classList.remove('suppliers-table', 'clients-table');
        nativeTable.classList.add(isFornecedor ? 'suppliers-table' : 'clients-table');
        console.log(`✅ Classe ${isFornecedor ? 'suppliers-table' : 'clients-table'} aplicada à tabela nativa`);
    }
    
    // Verificar se o header da tabela está correto
    const tableHeader = document.querySelector('#clientListModal thead tr');
    if (tableHeader) {
        if (isFornecedor) {
            // Verificar se tem 7 colunas para fornecedores
            const headerCells = tableHeader.querySelectorAll('th');
            if (headerCells.length === 6) {
                console.log("🔄 Ajustando header para fornecedores (7 colunas)");
                tableHeader.innerHTML = `
                    <th>Nome</th>
                    <th>CNPJ</th>
                    <th>Cidade</th>
                    <th>Estado</th>
                    <th>Telefone</th>
                    <th>Email</th>
                    <th>Ações</th>
                `;
            }
        } else {
            // Verificar se tem 6 colunas para clientes
            const headerCells = tableHeader.querySelectorAll('th');
            if (headerCells.length === 7) {
                console.log("🔄 Ajustando header para clientes (6 colunas)");
                tableHeader.innerHTML = `
                    <th>Nome</th>
                    <th>Cidade</th>
                    <th>Estado</th>
                    <th>Telefone</th>
                    <th>Email</th>
                    <th>Ações</th>
                `;
            }
        }
    }
    
    // ✅ GARANTIR BOTÃO "NOVO CLIENTE/FORNECEDOR" NO FOOTER
    ensureNewClientButtonInFooter(isFornecedor);
}

// ✅ NOVA FUNÇÃO PARA GARANTIR BOTÃO "NOVO CLIENTE/FORNECEDOR" - CORRIGIDA
function ensureNewClientButtonInFooter(isFornecedor = false) {
    console.log("🔘 Garantindo botão 'Novo Cliente/Fornecedor' no footer...");
    
    const modalFooter = document.querySelector('#clientListModal .modal-footer');
    if (!modalFooter) {
        console.warn("⚠️ Footer do modal não encontrado");
        return;
    }
    
    // ✅ VERIFICAR E REMOVER BOTÕES DUPLICADOS PRIMEIRO
    const existingButtons = modalFooter.querySelectorAll('.btn-primary, .btn-save');
    let hasNewButton = false;
    
    existingButtons.forEach(button => {
        if (button.textContent.includes('Novo')) {
            if (hasNewButton) {
                // Se já tem um botão "Novo", remover este duplicado
                console.log("🗑️ Removendo botão 'Novo' duplicado");
                button.remove();
            } else {
                hasNewButton = true;
                console.log("✅ Botão 'Novo' já existe no footer");
            }
        }
    });
    
    // Se já tem botão, não criar outro
    if (hasNewButton) {
        return;
    }
    
    // Criar botão "Novo Cliente/Fornecedor" apenas se não existir
    const newButton = document.createElement('button');
    newButton.type = 'button';
    newButton.className = 'btn btn-primary';
    newButton.innerHTML = `<i class="fas fa-plus"></i> ${isFornecedor ? 'Novo Fornecedor' : 'Novo Cliente'}`;
    newButton.onclick = () => {
        console.log(`🔘 Clique no botão ${isFornecedor ? 'Novo Fornecedor' : 'Novo Cliente'}`);
        
        // Fechar modal atual
        closeStandardizedClientModal();
        
        // Aguardar fechamento e abrir modal de novo cliente/fornecedor
        setTimeout(() => {
            openStandardizedNewClientModal();
        }, 200);
    };
    
    // Adicionar botão ao footer
    modalFooter.appendChild(newButton);
    
    console.log(`✅ Botão '${isFornecedor ? 'Novo Fornecedor' : 'Novo Cliente'}' adicionado ao footer`);
}

// ✅ NOVA FUNÇÃO PADRONIZADA PARA ABRIR MODAL DE NOVO CLIENTE/FORNECEDOR
function openStandardizedNewClientModal() {
    console.log("📝 === ABRINDO MODAL DE NOVO CLIENTE/FORNECEDOR PADRONIZADO ===");
    
    const pageConfig = getPageConfig();
    const isFornecedor = pageConfig.title.includes('Fornecedor');
    
    // Estratégia 1: Tentar usar função original salva
    if (typeof window.openNewClientModalOriginal === 'function' && 
        !window.openNewClientModalOriginal._isStandardizedFunction) {
        console.log("✅ Usando função openNewClientModal original");
        try {
            window.openNewClientModalOriginal();
            window.__stdOpenNewClientModalRunning = false;
            return;
        } catch (error) {
            console.error("❌ Erro na função original:", error);
        }
    }
    
    // Estratégia 2: Para romaneiopct - abrir modal nativo diretamente
    if (pageConfig === PAGE_CONFIGS.romaneiopct) {
        console.log("🔄 Usando estratégia específica para romaneiopct");
        
        const modal = document.getElementById('clientModal');
        if (modal) {
            // Resetar formulário
            const form = modal.querySelector('#clientForm');
            if (form) {
                form.reset();
                console.log("✅ Formulário resetado");
            }
            
            // Limpar ID de cliente
            const clientIdField = modal.querySelector('#clientId');
            if (clientIdField) {
                clientIdField.value = '';
            }
            
            // Atualizar título
            const modalTitle = modal.querySelector('#clientModalTitle');
            if (modalTitle) {
                modalTitle.textContent = 'Novo Cliente';
            }
            
            // Limpar variável de edição
            window.editingClientId = null;
            
            // Abrir modal
            modal.style.display = 'block';
            modal.style.visibility = 'visible';
            modal.style.opacity = '1';
            modal.classList.remove('hidden');
            modal.classList.add('show');
            
            // Focar no campo de nome
            setTimeout(() => {
                const nameField = modal.querySelector('#clientName');
                if (nameField) {
                    nameField.focus();
                    console.log("✅ Foco no campo de nome");
                }
            }, 100);
            
            console.log("✅ Modal romaneiopct aberto para novo cliente");
            return;
        } else {
            console.warn("⚠️ Modal clientModal não encontrado em romaneiopct");
        }
    }
    
    // Estratégia 3: Tentar funções específicas da página
    const functionsToTry = [
        'openClientModal',
        'openFornecedorModal', 
        'openNewFornecedorModal',
        'abrirModalNovoFornecedor'
    ];
    
    for (const funcName of functionsToTry) {
        if (typeof window[funcName] === 'function') {
            console.log(`✅ Usando função ${funcName} alternativa`);
            try {
                window[funcName]();
                return;
            } catch (error) {
                console.error(`❌ Erro na função ${funcName}:`, error);
            }
        }
    }
    
    // Estratégia 4: Tentar abrir modal HTML diretamente
    const modalIds = ['clientModal', 'fornecedorModal', 'newClientModal'];
    
    for (const modalId of modalIds) {
        const modal = document.getElementById(modalId);
        if (modal) {
            console.log(`✅ Abrindo modal ${modalId} diretamente`);
            
            // Resetar formulário se existir
            const form = modal.querySelector('form');
            if (form) {
                form.reset();
                console.log("✅ Formulário resetado");
            }
            
            // Limpar ID de cliente
            const clientIdField = modal.querySelector('#clientId');
            if (clientIdField) {
                clientIdField.value = '';
            }
            
            // Atualizar título
            const modalTitle = modal.querySelector('.modal-title, #clientModalTitle');
            if (modalTitle) {
                modalTitle.textContent = isFornecedor ? 'Novo Fornecedor' : 'Novo Cliente';
            }
            
            // Limpar variável de edição
            window.editingClientId = null;
            
            // Mostrar modal
            modal.style.display = 'block';
            modal.style.visibility = 'visible';
            modal.style.opacity = '1';
            modal.classList.remove('hidden');
            modal.classList.add('show');
            
            // Focar no campo de nome
            setTimeout(() => {
                const nameField = modal.querySelector('#clientName, [name="clientName"]');
                if (nameField) {
                    nameField.focus();
                    console.log("✅ Foco no campo de nome");
                }
            }, 100);
            
            console.log(`✅ Modal ${modalId} aberto diretamente`);
            return;
        }
    }
    
    // Estratégia 5: Fallback - criar modal básico informativo
    console.error("❌ Nenhuma função de modal de novo cliente encontrada");
    
    const modalHTML = `
        <div id="tempNewClientModal" class="modal standardized-client-modal" style="display: block;">
            <div class="standardized-client-modal-content">
                <div class="standardized-client-modal-header">
                    <h3 class="standardized-client-modal-title">${isFornecedor ? 'Novo Fornecedor' : 'Novo Cliente'}</h3>
                    <button type="button" class="standardized-client-modal-close" onclick="document.getElementById('tempNewClientModal').remove()">
                        <i class="fas fa-times"></i>
                    </button>
                </div>
                <div class="standardized-client-modal-body">
                    <p><strong>⚠️ Modal de ${isFornecedor ? 'novo fornecedor' : 'novo cliente'} não está disponível nesta página.</strong></p>
                    <p>Possíveis causas:</p>
                    <ul>
                        <li>Scripts não foram carregados completamente</li>
                        <li>Modal HTML não está presente na página</li>
                        <li>Função openNewClientModal não foi definida</li>
                    </ul>
                    <br>
                    <p><strong>Sugestão:</strong> Vá para a página de ${isFornecedor ? 'fornecedores (fornecedor.html)' : 'clientes (client.html)'} para cadastrar novos ${isFornecedor ? 'fornecedores' : 'clientes'}.</p>
                </div>
                <div class="standardized-client-modal-footer">
                    <button type="button" class="standardized-client-modal-btn secondary" onclick="document.getElementById('tempNewClientModal').remove()">
                        Fechar
                    </button>
                    <button type="button" class="standardized-client-modal-btn primary" onclick="window.location.href='${isFornecedor ? 'fornecedor.html' : 'client.html'}'">
                        ${isFornecedor ? 'Ir para Fornecedores' : 'Ir para Clientes'}
                    </button>
                </div>
            </div>
        </div>
    `;
    document.body.insertAdjacentHTML('beforeend', modalHTML);
    
    // Adicionar event listener para fechar
    const tempModal = document.getElementById('tempNewClientModal');
    if (tempModal) {
        tempModal.addEventListener('click', function(event) {
            if (event.target === tempModal) {
                tempModal.remove();
            }
        });
    }
}

// ✅ FUNÇÃO PARA CONFIGURAR EVENT LISTENERS NO MODAL NATIVO - MELHORADA
function setupNativeModalEventListeners() {
    console.log("🔧 Configurando event listeners no modal nativo");
    
    const modal = document.getElementById('clientListModal');
    if (!modal) return;
    
    // Aplicar classes CSS corretas
    applyNativeModalClasses();
    
    // Função para fechar modal
    const closeModal = () => {
        console.log("🚪 Fechando modal via event listener nativo");
        closeStandardizedClientModal();
    };
    
    // Event listener para botão X do header
    const closeButton = modal.querySelector('.close-modal');
    if (closeButton && !closeButton._standardizedListener) {
        closeButton.addEventListener('click', function(event) {
            event.preventDefault();
            event.stopPropagation();
            console.log("🚪 Clique no botão X do header (nativo)");
            closeModal();
        });
        closeButton._standardizedListener = true;
        console.log("✅ Event listener do botão X (nativo) adicionado");
    }
    
    // Event listener para botão Fechar do footer
    const footerCloseButton = modal.querySelector('.close-modal-btn, .back-button');
    if (footerCloseButton && !footerCloseButton._standardizedListener) {
        footerCloseButton.addEventListener('click', function(event) {
            event.preventDefault();
            event.stopPropagation();
            console.log("🚪 Clique no botão Fechar do footer (nativo)");
            closeModal();
        });
        footerCloseButton._standardizedListener = true;
        console.log("✅ Event listener do botão Fechar (nativo) adicionado");
    }
    
    // Event listener para clicar fora do modal
    if (!modal._outsideClickListener) {
        modal.addEventListener('click', function(event) {
            if (event.target === modal) {
                console.log("🚪 Clique fora do modal (nativo)");
                closeModal();
            }
        });
        modal._outsideClickListener = true;
        console.log("✅ Event listener para clicar fora (nativo) adicionado");
    }
    
    // Event listener para ESC key
    if (!modal._escapeHandler) {
        const escapeHandler = function(event) {
            if (event.key === 'Escape' && modal.style.display === 'block') {
                console.log("🚪 Tecla ESC pressionada (nativo)");
                closeModal();
            }
        };
        
        document.addEventListener('keydown', escapeHandler);
        modal._escapeHandler = escapeHandler;
        console.log("✅ Event listener para ESC (nativo) adicionado");
    }
    
    // ✅ CONFIGURAR EVENT LISTENERS PARA MODAL DE EDIÇÃO
    setupEditModalEventListeners();
}

// ✅ NOVA FUNÇÃO PARA CONFIGURAR EVENT LISTENERS DO MODAL DE EDIÇÃO
function setupEditModalEventListeners() {
    console.log("🔧 Configurando event listeners no modal de edição");
    
    const editModal = document.getElementById('clientModal');
    if (!editModal) return;
    
    // Função para fechar modal de edição
    const closeEditModal = () => {
        console.log("🚪 Fechando modal de edição");
        editModal.style.display = 'none';
        editModal.style.visibility = 'hidden';
        editModal.style.opacity = '0';
        editModal.classList.remove('show');
        editModal.classList.add('hidden');
        
        // Limpar formulário
        const form = editModal.querySelector('#clientForm');
        if (form) form.reset();
        
        // Limpar variáveis de edição
        window.editingClientId = null;
        
        console.log("✅ Modal de edição fechado");
    };
    
    // Event listener para botão X do header
    const closeButton = editModal.querySelector('.close-modal');
    if (closeButton && !closeButton._editStandardizedListener) {
        closeButton.addEventListener('click', function(event) {
            event.preventDefault();
            event.stopPropagation();
            console.log("🚪 Clique no botão X do header (edição)");
            closeEditModal();
        });
        closeButton._editStandardizedListener = true;
        console.log("✅ Event listener do botão X (edição) adicionado");
    }
    
    // Event listener para botão Cancelar do footer
    const cancelButton = editModal.querySelector('.close-modal-btn, .back-button');
    if (cancelButton && !cancelButton._editStandardizedListener) {
        cancelButton.addEventListener('click', function(event) {
            event.preventDefault();
            event.stopPropagation();
            console.log("🚪 Clique no botão Cancelar do footer (edição)");
            closeEditModal();
        });
        cancelButton._editStandardizedListener = true;
        console.log("✅ Event listener do botão Cancelar (edição) adicionado");
    }
    
    // Event listener para clicar fora do modal
    if (!editModal._outsideClickListener) {
        editModal.addEventListener('click', function(event) {
            if (event.target === editModal) {
                console.log("🚪 Clique fora do modal (edição)");
                closeEditModal();
            }
        });
        editModal._outsideClickListener = true;
        console.log("✅ Event listener para clicar fora (edição) adicionado");
    }
    
    // Event listener para ESC key
    if (!editModal._escapeHandler) {
        const escapeHandler = function(event) {
            if (event.key === 'Escape' && editModal.style.display === 'block') {
                console.log("🚪 Tecla ESC pressionada (edição)");
                closeEditModal();
            }
        };
        
        document.addEventListener('keydown', escapeHandler);
        editModal._escapeHandler = escapeHandler;
        console.log("✅ Event listener para ESC (edição) adicionado");
    }
}

// ✅ FUNÇÃO PARA NAVEGAR ENTRE PÁGINAS - MELHORADA
function goToClientPage(page) {
    const totalPages = Math.ceil(clientModalState.filteredClients.length / CLIENT_MODAL_CONFIG.itemsPerPage);
    
    if (page < 1 || page > totalPages) return;
    
    clientModalState.currentPage = page;
    
    if (clientModalState.useNativeModal) {
        renderNativeClientTable();
        // Paginação já é renderizada dentro de renderNativeClientTable
    } else {
        renderStandardizedClientTable();
        renderStandardizedClientPagination();
    }
    updateClientModalInfo();
}

// ✅ FUNÇÃO PARA FILTRAR CLIENTES - MELHORADA
function filterStandardizedClients(filterText) {
    clientModalState.filterText = filterText.toLowerCase().trim();
    clientModalState.currentPage = 1;

    if (!clientModalState.filterText) {
        clientModalState.filteredClients = clientModalState.clients;
    } else {
        clientModalState.filteredClients = clientModalState.clients.filter(client => 
            client.nome.toLowerCase().includes(clientModalState.filterText) ||
            client.cidade.toLowerCase().includes(clientModalState.filterText) ||
            client.estado.toLowerCase().includes(clientModalState.filterText) ||
            client.telefone.toLowerCase().includes(clientModalState.filterText) ||
            client.email.toLowerCase().includes(clientModalState.filterText) ||
            client.cnpj.toLowerCase().includes(clientModalState.filterText)
        );
    }

    if (clientModalState.useNativeModal) {
        renderNativeClientTable();
        // Paginação já é renderizada dentro de renderNativeClientTable
    } else {
        renderStandardizedClientTable();
        renderStandardizedClientPagination();
    }
    updateClientModalInfo();
}

// ✅ FUNÇÃO PARA ATUALIZAR INFORMAÇÕES DO MODAL - MELHORADA
function updateClientModalInfo(customMessage = null) {
    const infoElement = document.getElementById('clientModalInfo');
    if (!infoElement) {
        // Se não existir elemento de info, criar um para modal nativo
        const modalFooter = document.querySelector('#clientListModal .modal-footer');
        if (modalFooter && clientModalState.useNativeModal) {
            const infoDiv = document.createElement('div');
            infoDiv.id = 'clientModalInfo';
            infoDiv.style.cssText = `
                color: #6c757d;
                font-size: 14px;
                display: flex;
                align-items: center;
                gap: 8px;
                margin-right: auto;
            `;
            infoDiv.innerHTML = '<i class="fas fa-info-circle"></i> <span>Carregando...</span>';
            modalFooter.insertBefore(infoDiv, modalFooter.firstChild);
        }
        return;
    }

    if (customMessage) {
        infoElement.textContent = customMessage;
        return;
    }

    if (clientModalState.isLoading) {
        infoElement.textContent = 'Carregando clientes...';
        return;
    }

    const total = clientModalState.filteredClients.length;
    const start = (clientModalState.currentPage - 1) * CLIENT_MODAL_CONFIG.itemsPerPage + 1;
    const end = Math.min(start + CLIENT_MODAL_CONFIG.itemsPerPage - 1, total);

    if (total === 0) {
        infoElement.textContent = 'Nenhum cliente encontrado';
    } else if (total <= CLIENT_MODAL_CONFIG.itemsPerPage) {
        infoElement.textContent = `${total} cliente${total > 1 ? 's' : ''} encontrado${total > 1 ? 's' : ''}`;
    } else {
        infoElement.textContent = `Mostrando ${start}-${end} de ${total} clientes`;
    }
}

// ✅ FUNÇÃO PARA ABRIR MODAL PADRONIZADO - VERSÃO HÍBRIDA MELHORADA
async function openStandardizedClientModal(config = {}) {
    console.log("📋 === ABRINDO MODAL PADRONIZADO DE CLIENTES ===");
    
    // Prevenir múltiplas chamadas simultâneas
    if (clientModalState.isLoading) {
        console.log("⏳ Modal já está carregando, aguardando...");
        return;
    }
    
    try {
        // Detectar se existe modal nativo
        const useNativeModal = detectNativeModal();
        
        // Injetar estilos se não existirem
        injectClientModalStyles();
        
        // Criar modal se não existir (ou configurar o nativo)
        const modalId = config.modalId || CLIENT_MODAL_CONFIG.modalId;
        let modal = document.getElementById(modalId);
        
        if (!modal || (!useNativeModal && !modal.classList.contains('standardized-client-modal'))) {
            modal = createStandardizedClientModal(config);
        } else if (useNativeModal) {
            setupNativeModalEventListeners();
        }
        
        // Resetar estado
        clientModalState.currentPage = 1;
        clientModalState.filterText = '';
        
        // ✅ CONFIGURAR CAMPO DE FILTRO - MELHORADO
        let filterInput = null;
        
        if (clientModalState.useNativeModal) {
            // Para modal nativo, configurar ou criar campo de filtro
            filterInput = setupNativeModalFilter();
        } else {
            // Para modal padronizado, usar o campo existente
            filterInput = document.getElementById(CLIENT_MODAL_CONFIG.filterId);
        }
        
        // Limpar filtro
        if (filterInput) {
            filterInput.value = '';
            console.log("✅ Filtro limpo");
        }
        
        // Carregar clientes
        await loadClientsFromFirebase();
        
        // Renderizar tabela e paginação
        if (clientModalState.useNativeModal) {
            renderNativeClientTable();
            // Paginação já é renderizada dentro de renderNativeClientTable
        } else {
            renderStandardizedClientTable();
            renderStandardizedClientPagination();
        }
        updateClientModalInfo();
        
        // Exibir modal
        modal.style.display = 'block';
        modal.style.visibility = 'visible';
        modal.style.opacity = '1';
        modal.classList.remove('hidden');
        modal.classList.add('show');
        
        // Focar no filtro
        setTimeout(() => {
            if (filterInput) {
                filterInput.focus();
                console.log("✅ Foco no filtro");
            }
        }, 100);
        
        console.log("✅ Modal padronizado aberto com sucesso");
        
    } catch (error) {
        console.error("❌ Erro ao abrir modal padronizado:", error);
        
        // Fallback: tentar usar função original se existir
        if (typeof window.openClientListModalOriginal === 'function') {
            console.log("🔄 Usando função original como fallback");
            window.openClientListModalOriginal();
        } else {
            try {
                const msg = 'Erro ao abrir lista de clientes. Verifique sua conexão e tente novamente.';
                if (typeof window.__toast === 'function') {
                    window.__toast(msg, 'error', { duration: 5000 });
                } else if (window.Utils && window.Utils.showToast) {
                    window.Utils.showToast(msg, 'error');
                }
            } catch (_) {}
        }
    }
}

// ✅ NOVA FUNÇÃO PARA CONFIGURAR FILTRO EM MODAL NATIVO - CORRIGIDA
function setupNativeModalFilter() {
    console.log("🔧 Configurando filtro para modal nativo");
    
    const modal = document.getElementById('clientListModal');
    if (!modal) {
        console.warn("⚠️ Modal nativo não encontrado");
        return;
    }
    
    // Tentar encontrar campo de filtro existente com diferentes IDs
    const possibleFilterIds = ['clientListFilter', 'searchClientInput', 'clientFilter', 'filterClientInput'];
    let filterInput = null;
    
    for (const filterId of possibleFilterIds) {
        filterInput = document.getElementById(filterId);
        if (filterInput) {
            console.log(`✅ Campo de filtro encontrado: ${filterId}`);
            break;
        }
    }
    
    // Se não encontrou campo de filtro, criar um
    if (!filterInput) {
        console.log("🔧 Criando campo de filtro para modal nativo");
        
        const modalBody = modal.querySelector('.modal-body');
        if (modalBody) {
            // Criar container para o filtro
            const filterContainer = document.createElement('div');
            filterContainer.style.cssText = `
                margin-bottom: 15px;
                padding: 0 5px;
            `;
            
            // Criar campo de filtro
            filterInput = document.createElement('input');
            filterInput.type = 'text';
            filterInput.id = 'clientListFilter';
            filterInput.className = 'autocomplete-input';
            filterInput.placeholder = '🔍 Filtrar por nome, cidade, estado, telefone ou email...';
            filterInput.style.cssText = `
                width: 100%;
                padding: 12px 15px;
                border: 2px solid #e0e0e0;
                border-radius: 8px;
                font-size: 14px;
                outline: none;
                transition: border-color 0.2s ease;
                box-sizing: border-box;
            `;
            
            // Adicionar evento de focus
            filterInput.addEventListener('focus', function() {
                this.style.borderColor = '#3498db';
                this.style.boxShadow = '0 0 8px rgba(52, 152, 219, 0.3)';
            });
            
            filterInput.addEventListener('blur', function() {
                this.style.borderColor = '#e0e0e0';
                this.style.boxShadow = 'none';
            });
            
            filterContainer.appendChild(filterInput);
            
            // Inserir no início do modal-body
            modalBody.insertBefore(filterContainer, modalBody.firstChild);
            
            console.log("✅ Campo de filtro criado com sucesso");
        } else {
            console.error("❌ Modal-body não encontrado para criar campo de filtro");
            return;
        }
    }
    
    // Remover event listeners antigos
    if (filterInput._standardizedFilterListener) {
        filterInput.removeEventListener('input', filterInput._standardizedFilterListener);
    }
    
    // Adicionar novo event listener
    const filterListener = function(event) {
        const filterText = event.target.value;
        console.log("🔍 Filtrando clientes (nativo):", filterText);
        filterStandardizedClients(filterText);
    };
    
    filterInput.addEventListener('input', filterListener);
    filterInput._standardizedFilterListener = filterListener;
    
    console.log("✅ Filtro configurado para modal nativo");
    
    return filterInput;
}

// ✅ FUNÇÃO PARA EXCLUIR CLIENTE
async function deleteStandardizedClient(clientId) {
    console.log("🗑️ Excluindo cliente:", clientId);
    
    const client = clientModalState.clients.find(c => String(c.id) === String(clientId));
    if (!client) {
        console.error("❌ Cliente não encontrado:", clientId);
        return;
    }
    
    if (!confirm(`Tem certeza que deseja excluir o cliente "${client.nome}"?`)) {
        return;
    }
    
    try {
        // Tentar usar funções específicas da página
        if (typeof deleteClient === 'function') {
            await deleteClient(clientId);
        } else if (typeof deleteClientFirebaseFirst === 'function') {
            await deleteClientFirebaseFirst(clientId);
        } else {
            // Fallback: excluir diretamente
            const updatedClients = clientModalState.clients.filter(c => String(c.id) !== String(clientId));
            
            if (await saveData(CLIENT_MODAL_CONFIG.firebaseCollection, updatedClients)) {
                console.log("✅ Cliente excluído com sucesso");
            } else {
                throw new Error("Falha ao salvar no Firebase");
            }
        }
        
        // Recarregar lista
        await loadClientsFromFirebase();
        
        if (clientModalState.useNativeModal) {
            renderNativeClientTable();
        } else {
            renderStandardizedClientTable();
            renderStandardizedClientPagination();
        }
        updateClientModalInfo();
        
    } catch (error) {
        console.error("❌ Erro ao excluir cliente:", error);
        try {
            const msg = 'Erro ao excluir cliente. Verifique sua conexão e tente novamente.';
            if (typeof window.__toast === 'function') {
                window.__toast(msg, 'error', { duration: 5000 });
            } else if (window.Utils && window.Utils.showToast) {
                window.Utils.showToast(msg, 'error');
            }
        } catch (_) {}
    }
}

// ✅ FUNÇÃO PARA RECARREGAR LISTA DE CLIENTES - MELHORADA
async function refreshStandardizedClientList() {
    console.log("🔄 Recarregando lista de clientes...");
    
    await loadClientsFromFirebase();
    
    // Aplicar filtro atual se existir
    if (clientModalState.filterText) {
        filterStandardizedClients(clientModalState.filterText);
    } else {
        if (clientModalState.useNativeModal) {
            renderNativeClientTable();
            // Paginação já é renderizada dentro de renderNativeClientTable
        } else {
            renderStandardizedClientTable();
            renderStandardizedClientPagination();
        }
        updateClientModalInfo();
    }
}

// ✅ CONFIGURAÇÕES ESPECÍFICAS POR PÁGINA
const PAGE_CONFIGS = {
    romaneiotl: {
        modalId: 'clientListModal',
        title: 'Lista de Clientes',
        newButtonText: 'Novo Cliente',
        newButtonCallback: 'openNewClientModal'
    },
    romaneiopct: {
        modalId: 'clientListModal',
        title: 'Lista de Clientes',
        newButtonText: 'Novo Cliente',
        newButtonCallback: 'openNewClientModal'
    },
    romaneiotora: {
        modalId: 'clientListModal',
        title: 'Lista de Fornecedores',
        newButtonText: 'Novo Fornecedor',
        newButtonCallback: 'openNewClientModal'
    },
    client: {
        modalId: 'clientListModal',
        title: 'Lista de Clientes',
        newButtonText: 'Novo Cliente',
        newButtonCallback: 'openNewClientModal'
    }
};

// ✅ FUNÇÃO PARA DETECTAR PÁGINA ATUAL E APLICAR CONFIGURAÇÃO
function getPageConfig() {
    const path = window.location.pathname;
    const filename = path.split('/').pop();
    
    console.log("🔍 Detectando página:", filename);
    
    if (filename.includes('romaneiotl')) {
        console.log("✅ Página romaneiotl detectada");
        return PAGE_CONFIGS.romaneiotl;
    } else if (filename.includes('romaneiopct')) {
        console.log("✅ Página romaneiopct detectada");
        return PAGE_CONFIGS.romaneiopct;
    } else if (filename.includes('romaneiotora')) {
        console.log("✅ Página romaneiotora detectada");
        return PAGE_CONFIGS.romaneiotora;
    } else if (filename.includes('client')) {
        console.log("✅ Página client detectada");
        return PAGE_CONFIGS.client;
    }
    
    console.log("⚠️ Página não reconhecida, usando configuração padrão");
    return PAGE_CONFIGS.romaneiotl; // Default
}

// ✅ FUNÇÃO PARA REMOVER MODAIS HTML EXISTENTES
function removeExistingClientModals() {
    console.log("🗑️ Removendo modais HTML existentes...");
    
    // IDs de modais que devem ser removidos
    const modalIds = [
        'clientListModal',
        'clientModal',
        'fornecedorListModal',
        'fornecedorModal'
    ];
    
    modalIds.forEach(modalId => {
        const existingModal = document.getElementById(modalId);
        if (existingModal && existingModal.classList.contains('standardized-client-modal')) {
            console.log(`🗑️ Removendo modal padronizado: ${modalId}`);
            // Remover event listeners antes de remover o modal
            if (existingModal._escapeHandler) {
                document.removeEventListener('keydown', existingModal._escapeHandler);
            }
            existingModal.remove();
        }
    });
    
    console.log("✅ Modais HTML padronizados removidos");
}

// ✅ FUNÇÃO PARA SUBSTITUIR MODAIS EXISTENTES - VERSÃO HÍBRIDA
function replaceExistingClientModals() {
    console.log("🔄 Substituindo modais existentes...");
    
    // Detectar se existe modal nativo
    const hasNativeModal = detectNativeModal();
    
    if (hasNativeModal) {
        console.log("🔄 Modal nativo detectado, configurando modo híbrido");
        setupNativeModalEventListeners();
    } else {
        // Remover apenas modais padronizados antigos
        removeExistingClientModals();
    }
    
    // Função para criar wrapper seguro
    const createSafeWrapper = (config, modalType = 'clientes') => {
        return async function() {
            console.log(`📋 === ABRINDO MODAL PADRONIZADO DE ${modalType.toUpperCase()} ===`);
            
            // Prevenir loops infinitos
            if (protectionActive) {
                console.log("🛡️ Proteção ativa, evitando loop");
                return;
            }
            
            try {
                protectionActive = true;
                
                // Abrir modal padronizado
                await openStandardizedClientModal(config);
                
            } catch (error) {
                console.error("❌ Erro ao abrir modal padronizado:", error);
                
                // Fallback para função original se existir
                if (modalType === 'clientes' && typeof window.openClientListModalOriginal === 'function') {
                    window.openClientListModalOriginal();
                } else if (modalType === 'fornecedores' && typeof window.openFornecedorListModalOriginal === 'function') {
                    window.openFornecedorListModalOriginal();
                } else {
                    try {
                        const msg = 'Erro ao abrir lista de clientes. Verifique sua conexão e tente novamente.';
                        if (typeof window.__toast === 'function') {
                            window.__toast(msg, 'error', { duration: 5000 });
                        } else if (window.Utils && window.Utils.showToast) {
                            window.Utils.showToast(msg, 'error');
                        }
                    } catch (_) {}
                }
            } finally {
                // Resetar proteção após um tempo
                setTimeout(() => {
                    protectionActive = false;
                }, 1000);
            }
        };
    };
    
    // Salvar funções originais se existirem
    if (typeof window.openClientListModal === 'function') {
        console.log("📝 Salvando função openClientListModal original");
        window.openClientListModalOriginal = window.openClientListModal;
    }
    
    if (typeof window.openFornecedorListModal === 'function') {
        console.log("📝 Salvando função openFornecedorListModal original");
        window.openFornecedorListModalOriginal = window.openFornecedorListModal;
    }
    
    // Salvar função openNewClientModal original APENAS se não for nossa função
    if (typeof window.openNewClientModal === 'function' && 
        !window.openNewClientModal._isStandardizedFunction) {
        console.log("📝 Salvando função openNewClientModal original");
        window.openNewClientModalOriginal = window.openNewClientModal;
    } else if (window.openNewClientModalOriginal && 
               window.openNewClientModalOriginal._isStandardizedFunction) {
        // Se a função original é nossa própria função, limpar a referência
        console.log("🧹 Limpando referência circular da função original");
        window.openNewClientModalOriginal = null;
    }
    
    // Salvar funções de edição originais se existirem
    if (typeof window.editClient === 'function') {
        console.log("📝 Salvando função editClient original");
        window.editClientOriginal = window.editClient;
    }
    
    if (typeof window.editClientFromList === 'function') {
        console.log("📝 Salvando função editClientFromList original");
        window.editClientFromListOriginal = window.editClientFromList;
    }
    
    if (typeof window.editFornecedorFromList === 'function') {
        console.log("📝 Salvando função editFornecedorFromList original");
        window.editFornecedorFromListOriginal = window.editFornecedorFromList;
    }
    
    // Substituir funções
    window.openClientListModal = createSafeWrapper(getPageConfig(), 'clientes');
    window.openFornecedorListModal = window.openFornecedorListModalOriginal || window.openFornecedorListModal;

    // Criar função segura para abrir modal de novo cliente/fornecedor - CORRIGIDA
    window.openNewClientModal = function() {
        console.log("📝 Abrindo modal de novo cliente/fornecedor...");
        
        // Verificar se existe função específica da página (original salva)
        // E garantir que não é nossa própria função
        if (typeof window.openNewClientModalOriginal === 'function' && 
            !window.openNewClientModalOriginal._isStandardizedFunction) {
            console.log("✅ Usando função openNewClientModal original");
            try {
                window.openNewClientModalOriginal();
                return;
            } catch (error) {
                console.error("❌ Erro na função original:", error);
            }
        }
        
        // Usar nossa função padronizada
        openStandardizedNewClientModal();
    };
    
    // Marcar nossa função como função padronizada para evitar loop
    window.openNewClientModal._isStandardizedFunction = true;
    
    console.log("✅ Modais substituídos com sucesso");
}

// ✅ FUNÇÃO PARA FORÇAR SUBSTITUIÇÃO SEGURA - SIMPLIFICADA
function forceReplaceClientModals() {
    console.log("🔄 Substituição segura de modais - MODO SIMPLES");
    
    // Verificação simples para evitar loops infinitos
    const now = Date.now();
    if (window._lastModalReplace && (now - window._lastModalReplace) < 5000) {
        console.log("🛡️ Substituição muito recente, aguardando...");
        return;
    }
    
    window._lastModalReplace = now;
    
    try {
        // Parar proteção anterior se existir
        if (protectionTimer) {
            clearInterval(protectionTimer);
            protectionTimer = null;
        }
        
        // Detectar modal nativo
        const hasNativeModal = detectNativeModal();
        
        if (hasNativeModal) {
            console.log("🔄 Modal nativo detectado, configurando event listeners");
            setupNativeModalEventListeners();
        } else {
            // Remover apenas modais padronizados antigos
            removeExistingClientModals();
        }
        
        // Função para criar wrapper protegido
        const createProtectedFunction = (config, modalType = 'clientes') => {
            return async function() {
                console.log(`📋 === ABRINDO MODAL PADRONIZADO DE ${modalType.toUpperCase()} ===`);
                
                // Prevenir loops infinitos
                if (protectionActive && Date.now() - lastProtectionTime < 2000) {
                    console.log("🛡️ Proteção ativa, evitando loop");
                    return;
                }
                
                try {
                    await openStandardizedClientModal(config);
                } catch (error) {
                    console.error("❌ Erro ao abrir modal:", error);
                    try {
                        const msg = 'Erro ao abrir lista de clientes. Verifique sua conexão e tente novamente.';
                        if (typeof window.__toast === 'function') {
                            window.__toast(msg, 'error', { duration: 5000 });
                        } else if (window.Utils && window.Utils.showToast) {
                            window.Utils.showToast(msg, 'error');
                        }
                    } catch (_) {}
                }
            };
        };
        
        // Usar try-catch para evitar erros de redefinição
        try {
            // Tentar redefinir com Object.defineProperty
            Object.defineProperty(window, 'openClientListModal', {
                value: createProtectedFunction(getPageConfig(), 'clientes'),
                writable: true,
                configurable: true
            });
        } catch (error) {
            console.warn("⚠️ Não foi possível redefinir openClientListModal:", error);
            // Fallback: atribuição direta
            window.openClientListModal = createProtectedFunction(getPageConfig(), 'clientes');
        }
        
        try {
            window.openFornecedorListModal = window.openFornecedorListModalOriginal || window.openFornecedorListModal;
        } catch (error) {
            console.warn("⚠️ Não foi possível restaurar openFornecedorListModal:", error);
        }
        
        console.log("✅ Substituição segura aplicada");
        
    } finally {
        // Resetar proteção após um pequeno delay
        setTimeout(() => {
            protectionActive = false;
        }, 1000);
    }
}

// ✅ FUNÇÃO PARA MONITORAR E PROTEGER MODALS - DESABILITADA PARA EVITAR LOOPS
function startModalProtection() {
    console.log("🛡️ Sistema de proteção de modais DESABILITADO - evitando loops infinitos");
    
    // Limpar qualquer timer anterior se existir
    if (protectionTimer) {
        clearInterval(protectionTimer);
        protectionTimer = null;
    }
    
    // Configurar modal nativo uma vez apenas
    const existingModal = document.getElementById('clientListModal');
    if (existingModal && !existingModal.classList.contains('standardized-client-modal')) {
        console.log("🔄 Modal nativo detectado, configurando uma única vez");
        setupNativeModalEventListeners();
    }
    
    console.log("✅ Configuração de modal concluída sem loops");
}

// ✅ FUNÇÃO DE DEBUG MELHORADA
function debugStandardizedModal() {
    console.log("🔍 === DEBUG DO MODAL PADRONIZADO ===");
    
    // Informações da página
    const path = window.location.pathname;
    const filename = path.split('/').pop();
    console.log("📄 Página atual:", filename);
    
    // Verificar configuração da página
    const config = getPageConfig();
    console.log("⚙️ Configuração detectada:", config);
    
    // Verificar se os estilos estão injetados
    const stylesElement = document.getElementById('standardized-client-modal-styles');
    console.log("🎨 Estilos injetados:", !!stylesElement);
    
    // Verificar funções disponíveis
    console.log("🔧 Funções disponíveis:");
    console.log("  - openStandardizedClientModal:", typeof window.openStandardizedClientModal === 'function');
    console.log("  - openClientListModal:", typeof window.openClientListModal === 'function');
    console.log("  - openFornecedorListModal:", typeof window.openFornecedorListModal === 'function');
    
    // Verificar modais HTML existentes
    console.log("📋 Modais HTML existentes:");
    const modalIds = ['clientListModal', 'clientModal', 'fornecedorListModal', 'fornecedorModal'];
    modalIds.forEach(modalId => {
        const modal = document.getElementById(modalId);
        if (modal) {
            const isStandardized = modal.classList.contains('standardized-client-modal');
            console.log(`  - ${modalId}: ${isStandardized ? '✅ PADRONIZADO' : '🔄 NATIVO'}`);
        } else {
            console.log(`  - ${modalId}: ❌ NÃO ENCONTRADO`);
        }
    });
    
    // Verificar estado do clientModalState
    console.log("📊 Estado do modal:");
    console.log("  - Página atual:", clientModalState.currentPage);
    console.log("  - Filtro atual:", clientModalState.filterText);
    console.log("  - Total de clientes:", clientModalState.clients.length);
    console.log("  - Clientes filtrados:", clientModalState.filteredClients.length);
    console.log("  - Proteção ativa:", protectionActive);
    console.log("  - Usando modal nativo:", clientModalState.useNativeModal);
    
    console.log("🔍 === FIM DO DEBUG ===");
    
    // Retornar informações para uso programático
    return {
        page: filename,
        config: config,
        stylesInjected: !!stylesElement,
        protectionActive: protectionActive,
        useNativeModal: clientModalState.useNativeModal,
        functionsAvailable: {
            openStandardizedClientModal: typeof window.openStandardizedClientModal === 'function',
            openClientListModal: typeof window.openClientListModal === 'function',
            openFornecedorListModal: typeof window.openFornecedorListModal === 'function'
        },
        clientsLoaded: clientModalState.clients.length,
        currentPage: clientModalState.currentPage
    };
}

// Expor função de debug globalmente
window.debugStandardizedModal = debugStandardizedModal;

// ✅ INICIALIZAÇÃO AUTOMÁTICA COM MÚLTIPLAS ESTRATÉGIAS MELHORADAS
if (typeof window !== 'undefined') {
    console.log("🚀 Iniciando sistema de modal padronizado...");
    
    // Estratégia 1: Substituição imediata
    console.log("📌 Estratégia 1: Substituição imediata");
    replaceExistingClientModals();
    
    // Estratégia 2: Substituição no DOMContentLoaded
    if (document.readyState === 'loading') {
        console.log("📌 Estratégia 2: Aguardando DOMContentLoaded");
        document.addEventListener('DOMContentLoaded', () => {
            console.log("📌 DOMContentLoaded acionado - aplicando substituições");
            replaceExistingClientModals();
            
            // Estratégia 3: Substituição com delay para scripts tardios
            setTimeout(() => {
                console.log("📌 Estratégia 3: Substituição com delay (500ms)");
                forceReplaceClientModals();
                startModalProtection();
            }, 500);
        });
    } else {
        console.log("📌 DOM já carregado - aplicando estratégias imediatas");
        // Estratégia 4: Substituição imediata se DOM já carregado
        replaceExistingClientModals();
        setTimeout(() => {
            console.log("📌 Estratégia 4: Substituição com delay (500ms)");
            forceReplaceClientModals();
            startModalProtection();
        }, 500);
    }
    
    // Estratégia 5: Substituição após carregamento completo da página
    window.addEventListener('load', () => {
        setTimeout(() => {
            console.log("📌 Estratégia 5: Substituição final após carregamento completo");
            forceReplaceClientModals();
            console.log("🔄 Substituição final após carregamento completo da página");
        }, 1000);
    });
}

// ✅ EXPORTAR FUNÇÕES PARA USO EXTERNO
if (typeof module !== 'undefined' && module.exports) {
    module.exports = {
        openStandardizedClientModal,
        closeStandardizedClientModal,
        selectStandardizedClient,
        editStandardizedClient,
        deleteStandardizedClient,
        refreshStandardizedClientList,
        replaceExistingClientModals
    };
}

// ✅ GARANTIR QUE FUNÇÕES ESSENCIAIS ESTEJAM SEMPRE DISPONÍVEIS
window.openStandardizedClientModal = openStandardizedClientModal;
window.closeStandardizedClientModal = closeStandardizedClientModal;
window.selectStandardizedClient = selectStandardizedClient;
window.editStandardizedClient = editStandardizedClient;
window.deleteStandardizedClient = deleteStandardizedClient;
window.refreshStandardizedClientList = refreshStandardizedClientList;
window.replaceExistingClientModals = replaceExistingClientModals;
window.openStandardizedNewClientModal = openStandardizedNewClientModal;

// ✅ FUNÇÕES GLOBAIS PARA COMPATIBILIDADE
window.closeClientListModal = closeStandardizedClientModal;
window.closeFornecedorListModal = closeStandardizedClientModal;

console.log("✅ Funções globais do modal padronizado garantidas"); 

// 📡 Atualizar lista padronizada quando clientes forem atualizados (com throttle)
try {
  window.addEventListener('clients:updated', async function(e) {
    try {
      if (!window.__stdClientsRefreshTimer) {
        window.__stdClientsRefreshTimer = setTimeout(async () => {
          window.__stdClientsRefreshTimer = null;
          if (typeof window.refreshStandardizedClientList === 'function') {
            await window.refreshStandardizedClientList();
            console.log('📡 Standardized: Lista de clientes atualizada via clients:updated');
          } else {
            // Fallback: se não houver refresh exposto, tentar fechar/reabrir se estiver visível
            const list = document.getElementById('clientListModal');
            if (list && list.style.display === 'block') {
              list.style.display = 'none';
              setTimeout(() => list.style.display = 'block', 100);
              console.log('📡 Standardized: Fallback de refresh aplicado (fechar/abrir)');
            }
          }
        }, 300);
      }
    } catch (err) {
      console.warn('⚠️ Standardized: Falha ao atualizar lista via clients:updated:', err);
    }
  });
} catch (_) {}

// ✅ FUNÇÃO GLOBAL PARA COMPATIBILIDADE COM ROMANEIOTL
window.filterClientList = function() {
    console.log("🔍 Função filterClientList chamada");
    
    // Tentar encontrar o campo de filtro com diferentes IDs
    const possibleInputIds = ['searchClientInput', 'clientListFilter', 'clientFilter'];
    let filterInput = null;
    
    for (const inputId of possibleInputIds) {
        filterInput = document.getElementById(inputId);
        if (filterInput) {
            console.log(`✅ Campo de filtro encontrado: ${inputId}`);
            break;
        }
    }
    
    if (!filterInput) {
        console.warn("⚠️ Campo de filtro não encontrado");
        return;
    }
    
    const filterValue = filterInput.value;
    console.log("🔍 Filtrando com valor:", filterValue);
    
    // Se estivermos usando o sistema padronizado, usar a função padronizada
    if (typeof filterStandardizedClients === 'function') {
        filterStandardizedClients(filterValue);
    } else {
        // Fallback para sistema tradicional de filtro por linhas da tabela
        const table = document.getElementById('clientListTable');
        if (!table) {
            console.warn("⚠️ Tabela de clientes não encontrada");
            return;
        }
        
        const filter = filterValue.toLowerCase();
        const tbody = table.querySelector('tbody');
        if (!tbody) {
            console.warn("⚠️ Tbody da tabela não encontrado");
            return;
        }
        
        const rows = tbody.getElementsByTagName('tr');
        
        for (let i = 0; i < rows.length; i++) {
            const cells = rows[i].getElementsByTagName('td');
            if (cells.length > 0) {
                // Filtrar por múltiplos campos: nome, cidade, estado, telefone, email
                const name = (cells[0]?.textContent || '').toLowerCase();
                const city = (cells[1]?.textContent || '').toLowerCase();
                const state = (cells[2]?.textContent || '').toLowerCase();
                const phone = (cells[3]?.textContent || '').toLowerCase();
                const email = (cells[4]?.textContent || '').toLowerCase();
                
                if (name.includes(filter) ||
                    city.includes(filter) ||
                    state.includes(filter) ||
                    phone.includes(filter) ||
                    email.includes(filter)) {
                    rows[i].style.display = '';
                } else {
                    rows[i].style.display = 'none';
                }
            }
        }
        
        console.log(`✅ Filtro aplicado na tabela: "${filter}"`);
    }
};
