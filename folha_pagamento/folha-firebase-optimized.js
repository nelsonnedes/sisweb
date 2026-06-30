/**
 * 🔥 FOLHA FIREBASE SERVICE - OTIMIZADO
 * Serviço Firebase especializado para Folha de Pagamento
 * Baseado no Firebase Connection Manager para evitar reconexões múltiplas
 * ✅ VERSÃO OTIMIZADA: Usa singleton pattern e gerenciamento inteligente
 */

// ✅ MAPEAMENTO DE CHAVES PARA FOLHA DE PAGAMENTO
const FOLHA_KEY_MAPPING = {
    'funcionarios': 'funcionarios',
    'cargos': 'cargos', 
    'folhas': 'folhas',
    'configuracoes': 'configuracoes',
    'relatorios': 'relatorios'
};

/**
 * 🔥 CLASSE FIREBASE SERVICE OTIMIZADA
 * Usa o Firebase Connection Manager para evitar duplicações
 */
class FolhaFirebaseService {
    constructor() {
        // Verificar se já existe uma instância
        if (FolhaFirebaseService.instance) {
            console.log('✅ Retornando instância existente do Firebase Service');
            return FolhaFirebaseService.instance;
        }
        
        FolhaFirebaseService.instance = this;
        
        this.isInitialized = false;
        this.manager = null;
        
        this.init();
    }

    /**
     * 🔧 Inicializar serviço Firebase otimizado
     */
    async init() {
        if (this.isInitialized) {
            console.log('✅ Firebase Service já inicializado');
            return;
        }
        
        console.log('🔥 Inicializando Firebase Service otimizado...');
        
        try {
            // Aguardar o Firebase Connection Manager estar disponível
            await this.waitForManager();
            
            // Obter instância do manager
            this.manager = window.getFirebaseManager();
            
            // Configurar listeners de eventos do manager
            this.setupManagerListeners();
            
            this.isInitialized = true;
            console.log('✅ Firebase Service otimizado inicializado');
            
        } catch (error) {
            console.error('❌ Erro ao inicializar Firebase Service:', error);
        }
    }
    
    /**
     * ⏳ Aguardar Firebase Connection Manager
     */
    async waitForManager() {
        const maxAttempts = 50;
        let attempts = 0;
        
        while (attempts < maxAttempts) {
            if (window.getFirebaseManager && window.FirebaseConnectionManager) {
                console.log('✅ Firebase Connection Manager disponível');
                return;
            }
            
            if (attempts % 10 === 0) {
                console.log(`⏳ Aguardando Firebase Manager (${attempts}/${maxAttempts})...`);
            }
            
            await new Promise(resolve => setTimeout(resolve, 100));
            attempts++;
        }
        
        throw new Error('Timeout aguardando Firebase Connection Manager');
    }
    
    /**
     * 🎧 Configurar listeners do manager
     */
    setupManagerListeners() {
        if (!this.manager) return;
        
        // Listener para reconexão
        this.manager.on('connected', () => {
            console.log('🔥 Firebase reconectado - recarregando dados do sistema');
            this.reloadSystemData();
        });
        
        // Listener para desconexão
        this.manager.on('disconnected', () => {
            console.log('🔥 Firebase desconectado - modo offline ativado');
        });
        
        // Listener para mudanças de loading
        this.manager.on('loadingChange', (event) => {
            this.updateLoadingUI(event.detail.path, event.detail.loading);
        });
    }
    
    /**
     * 🔄 Recarregar dados do sistema após reconexão
     */
    async reloadSystemData() {
        console.log('🔄 Recarregando dados do sistema...');
        
        try {
            // Lista de dados essenciais para recarregar
            const essentialData = ['funcionarios', 'cargos', 'folhas'];
            
            // Recarregar com debounce para evitar múltiplas chamadas
            for (const dataType of essentialData) {
                setTimeout(async () => {
                    try {
                        await this.manager.loadData(dataType, { 
                            forceRefresh: true,
                            debounceMs: 500 
                        });
                        
                        // Emitir evento personalizado para notificar módulos
                        this.emitDataReloaded(dataType);
                        
                    } catch (error) {
                        console.error(`❌ Erro ao recarregar ${dataType}:`, error);
                    }
                }, Math.random() * 1000); // Espalhar as chamadas
            }
            
        } catch (error) {
            console.error('❌ Erro ao recarregar dados do sistema:', error);
        }
    }
    
    /**
     * 📡 Emitir evento de dados recarregados
     */
    emitDataReloaded(dataType) {
        const event = new CustomEvent('folhaDataReloaded', {
            detail: { dataType }
        });
        window.dispatchEvent(event);
    }
    
    /**
     * 🎭 Atualizar UI de loading
     */
    updateLoadingUI(path, loading) {
        // Atualizar elementos específicos de loading
        const loadingElements = document.querySelectorAll(`[data-loading="${path}"]`);
        loadingElements.forEach(element => {
            element.classList.toggle('loading', loading);
        });
        
        // Atualizar indicadores gerais
        if (loading) {
            document.body.classList.add('firebase-loading');
        } else {
            // Verificar se ainda há operações de loading ativas
            const stats = this.manager.getStats();
            if (stats.loadingStates.length === 0) {
                document.body.classList.remove('firebase-loading');
            }
        }
    }
    
    /**
     * 📊 Obter estatísticas do Firebase
     */
    getStats() {
        if (!this.manager) {
            return {
                isOnline: false,
                isFirebaseAvailable: false,
                error: 'Manager não inicializado'
            };
        }
        
        return this.manager.getStats();
    }
    
    /**
     * 🧹 Limpeza
     */
    cleanup() {
        if (this.manager) {
            this.manager.cleanup();
        }
        
        FolhaFirebaseService.instance = null;
        console.log('🧹 Firebase Service limpo');
    }

    // Utilidades adicionais para folhas (sem quebrar API atual)
    async getFolhasPorFuncionarioMesAno(funcionarioId, mes, ano) {
        try {
            const all = await (window.getFolhaData ? window.getFolhaData('folhas', { useCache: true }) : getFolhaDataInternal('folhas', { useCache: true }));
            const list = Array.isArray(all) ? all : Object.values(all || {});
            return list.filter(f => (
                (((f && f.referencias && f.referencias.funcionarioId) === funcionarioId) || ((f && f.funcionario && f.funcionario.id) === funcionarioId)) &&
                ((((f && f.referencias && f.referencias.mes) || 0) === Number(mes))) &&
                ((((f && f.referencias && f.referencias.ano) || 0) === Number(ano)))
            ));
        } catch (e) {
            console.error('❌ getFolhasPorFuncionarioMesAno error:', e);
            return [];
        }
    }

    async getFolhasPorMes(mes, ano) {
        try {
            const all = await (window.getFolhaData ? window.getFolhaData('folhas', { useCache: true }) : getFolhaDataInternal('folhas', { useCache: true }));
            const list = Array.isArray(all) ? all : Object.values(all || {});
            return list.filter(f => (
                ((((f && f.referencias && f.referencias.mes) || 0) === Number(mes)) &&
                (((f && f.referencias && f.referencias.ano) || 0) === Number(ano)))
            ));
        } catch (e) {
            console.error('❌ getFolhasPorMes error:', e);
            return [];
        }
    }

    async marcarComoPago(id, dataPagamento = new Date().toISOString()) {
        const manager = window.getFirebaseManager && window.getFirebaseManager();
        if (!manager || !id) return false;
        const resolvePath = (p) => {
            try {
                if (window.FolhaUtils && typeof window.FolhaUtils.resolveFirebasePath === 'function') {
                    return window.FolhaUtils.resolveFirebasePath(p);
                }
                const base = String(p || '');
                if (!base) return base;
                if (/^companies(\/|$)/.test(base) || /^users(\/|$)/.test(base)) return base;
                const svc = window.firebaseService || window.firebaseServiceTL || window.FirebaseService;
                if (svc && typeof svc.getNamespacedPath === 'function') {
                    return svc.getNamespacedPath(base);
                }
                const rawTenant = window.appTenantId || (window.companyInfo && (window.companyInfo.companyId || window.companyInfo.companyID || window.companyInfo.tenantId || window.companyInfo.id));
                if (rawTenant) return `companies/${String(rawTenant)}/${base}`;
                const stored = localStorage.getItem('company_info');
                if (stored) {
                    const obj = JSON.parse(stored);
                    const t = obj && (obj.companyId || obj.companyID || obj.tenantId || obj.id);
                    if (t) return `companies/${String(t)}/${base}`;
                }
            } catch {}
            return p;
        };
        const path = resolvePath(`folhas/${id}`);
        try {
            const current = await manager.loadData(path, { useCache: true });
            const next = {
                ...current,
                status: { ...(((current && current.status) || {})), pago: true, dataPagamento }
            };
            await manager.saveData(path, next);
            return true;
        } catch (e) {
            console.error('❌ marcarComoPago error:', e);
            return false;
        }
    }
}

/**
 * 📊 FUNÇÕES DE DADOS OTIMIZADAS
 * Usam o Firebase Connection Manager com cache e debounce
 */

/**
 * 📥 Carregar dados com cache inteligente
 */
// Renomeado para evitar colisão com window.getData do Manager
async function getFolhaDataInternalCore(key, options = {}) {
    try {
        const mappedKey = FOLHA_KEY_MAPPING[key] || key;
        const manager = (window.getFirebaseManager && window.getFirebaseManager()) || window.firebaseManager || null;

        if (manager && typeof manager.loadData === 'function') {
            // Tentar novo schema primeiro
            try {
                const data = await manager.loadData(`${mappedKey}`, {
                    useCache: true,
                    debounceMs: 300,
                    ...options
                });
                const isEmpty = data == null || (typeof data === 'object' && Object.keys(data).length === 0);
                if (!isEmpty) return data;
            } catch (e) {
                // prosseguir para fallback
            }
            // Fallback para caminho legado (compatibilidade)
            return await manager.loadData(`folha/${mappedKey}`, {
                useCache: true,
                debounceMs: 300,
                ...options
            });
        }

        // Manager indisponível: não usar localStorage como fonte primária em produção
        console.error('❌ Firebase Manager não disponível para leitura');
        throw new Error('Firebase indisponível');

    } catch (error) {
        console.error(`❌ Erro ao carregar dados: ${key}`, error);

        // Fallback para localStorage
        const localData = getFromLocalStorage(key);
        if (localData) {
            console.log(`📦 Usando dados locais para: ${key}`);
            return localData;
        }

        throw error;
    }
}

// Utilitário interno para obter dados quando os aliases globais não estiverem presentes
async function getFolhaDataInternal(key, options = {}) {
    return getFolhaDataInternalCore(key, options);
}

/**
 * 💾 Salvar dados com fila inteligente
 */
async function saveFolhaDataCore(key, data, options = {}) {
    try {
        const mappedKey = FOLHA_KEY_MAPPING[key] || key;

        // Não salvar no localStorage em produção para evitar divergência entre máquinas

        const manager = (window.getFirebaseManager && window.getFirebaseManager()) || window.firebaseManager || null;
        if (manager && typeof manager.saveData === 'function') {
            // Escrever apenas no caminho canônico
            await manager.saveData(`${mappedKey}`, data, options);
            return true;
        }

        console.error('❌ Firebase Manager não disponível, cancelando salvamento remoto');
        throw new Error('Firebase indisponível');

    } catch (error) {
        console.error(`❌ Erro ao salvar dados: ${key}`, error);
        throw error;
    }
}

/**
 * 👂 Configurar listener em tempo real
 */
async function setupFolhaRealtimeListenerCore(key, callback, options = {}) {
    try {
        const mappedKey = FOLHA_KEY_MAPPING[key] || key;
        const manager = (window.getFirebaseManager && window.getFirebaseManager()) || window.firebaseManager || null;

        if (manager && typeof manager.setupRealtimeListener === 'function') {
            // Preferir caminho canônico primeiro; fallback para legado
            try {
                return await manager.setupRealtimeListener(`${mappedKey}`, callback, options);
            } catch (e) {
                return await manager.setupRealtimeListener(`folha/${mappedKey}`, callback, options);
            }
        }

        console.warn('⚠️ Firebase Manager não disponível para listeners');

    } catch (error) {
        console.error(`❌ Erro ao configurar listener: ${key}`, error);
        throw error;
    }
}

/**
 * 🗑️ Deletar dados
 */
async function deleteFolhaDataCore(key) {
    try {
        const mappedKey = FOLHA_KEY_MAPPING[key] || key;

        const manager = (window.getFirebaseManager && window.getFirebaseManager()) || window.firebaseManager || null;
        if (manager && manager.database) {
            const { ref, remove } = await import('https://www.gstatic.com/firebasejs/10.7.1/firebase-database.js');
            try { await remove(ref(manager.database, `folha/${mappedKey}`)); } catch {}
            try { await remove(ref(manager.database, `${mappedKey}`)); } catch {}
            console.log(`🗑️ Dados deletados: ${key}`);
        }
        
        // Remover do localStorage também
        const localKey = `folha_${key}`;
        localStorage.removeItem(localKey);
        
        return true;
        
    } catch (error) {
        console.error(`❌ Erro ao deletar dados: ${key}`, error);
        throw error;
    }
}

/**
 * 💾 FUNÇÕES DE LOCALSTORAGE OTIMIZADAS
 */

function saveToLocalStorage(key, data) {
    try {
        const storageKey = `folha_${key}`;
        const dataWithTimestamp = {
            data,
            timestamp: Date.now(),
            version: '1.0'
        };
        if (window.SiswebStorage && typeof window.SiswebStorage.write === 'function') {
            window.SiswebStorage.write(storageKey, dataWithTimestamp);
        } else {
            localStorage.setItem(storageKey, JSON.stringify(dataWithTimestamp));
        }
        
    } catch (error) {
        console.warn(`⚠️ Erro ao salvar no localStorage: ${key}`, error);
    }
}

function getFromLocalStorage(key) {
    try {
        const storageKey = `folha_${key}`;
        const stored = localStorage.getItem(storageKey);
        
        if (stored) {
            const parsed = JSON.parse(stored);
            
            // Verificar se não está muito antigo (2 horas para dados críticos)
            const maxAge = 2 * 60 * 60 * 1000; // 2 horas
            if (Date.now() - parsed.timestamp < maxAge) {
                return parsed.data;
            } else {
                // Dados muito antigos, remover
                localStorage.removeItem(storageKey);
            }
        }
        
    } catch (error) {
        console.warn(`⚠️ Erro ao ler do localStorage: ${key}`, error);
    }
    
    return null;
}

/**
 * 🔄 SISTEMA DE SINCRONIZAÇÃO INTELIGENTE
 */

class DataSyncManager {
    constructor() {
        this.syncInProgress = false;
        this.lastSyncTime = 0;
        this.syncInterval = 5 * 60 * 1000; // 5 minutos
        
        this.setupAutoSync();
    }
    
    setupAutoSync() {
        // Sincronizar quando a página ganha foco
        window.addEventListener('focus', () => {
            this.syncIfNeeded();
        });
        
        // Sincronizar periodicamente
        setInterval(() => {
            this.syncIfNeeded();
        }, this.syncInterval);
    }
    
    async syncIfNeeded() {
        const now = Date.now();
        
        if (this.syncInProgress || (now - this.lastSyncTime) < this.syncInterval) {
            return;
        }
        
        if (window.firebaseManager && window.firebaseManager.isConnected) {
            await this.performSync();
        }
    }
    
    async performSync() {
        this.syncInProgress = true;
        console.log('🔄 Iniciando sincronização de dados...');
        
        try {
            const resolvePath = (p) => {
                try {
                    if (window.FolhaUtils && typeof window.FolhaUtils.resolveFirebasePath === 'function') {
                        return window.FolhaUtils.resolveFirebasePath(p);
                    }
                    const base = String(p || '');
                    if (!base) return base;
                    if (/^companies(\/|$)/.test(base) || /^users(\/|$)/.test(base)) return base;
                    const svc = window.firebaseService || window.firebaseServiceTL || window.FirebaseService;
                    if (svc && typeof svc.getNamespacedPath === 'function') {
                        return svc.getNamespacedPath(base);
                    }
                    const rawTenant = window.appTenantId || (window.companyInfo && (window.companyInfo.companyId || window.companyInfo.companyID || window.companyInfo.tenantId || window.companyInfo.id));
                    if (rawTenant) return `companies/${String(rawTenant)}/${base}`;
                    const stored = localStorage.getItem('company_info');
                    if (stored) {
                        const obj = JSON.parse(stored);
                        const t = obj && (obj.companyId || obj.companyID || obj.tenantId || obj.id);
                        if (t) return `companies/${String(t)}/${base}`;
                    }
                } catch {}
                return p;
            };
            const keysToSync = Object.keys(FOLHA_KEY_MAPPING);
            for (const key of keysToSync) {
                const localData = getFromLocalStorage(key);
                const remoteData = await getFolhaDataInternalCore(key, { useCache: false });
                const remoteEmpty = (remoteData == null) || (Array.isArray(remoteData) ? remoteData.length === 0 : Object.keys(remoteData || {}).length === 0);
                if (remoteEmpty) {
                    if (this.shouldSyncData(localData, remoteData)) {
                        await saveFolhaDataCore(key, localData);
                        console.log(`🔄 Dados sincronizados (preencher vazio): ${key}`);
                    }
                } else if (key === 'folhas') {
                    const listLocal = Array.isArray(localData) ? localData : Object.values(localData || {});
                    const mapRemote = (remoteData && !Array.isArray(remoteData)) ? remoteData : (Array.isArray(remoteData) ? Object.fromEntries(remoteData.map(it => [String((it && it.id) || (it && it.key) || ''), it])) : {});
                    for (const item of listLocal) {
                        const id = String((item && (item.id || item.key)) || '');
                        if (!id) continue;
                        const r = mapRemote[id];
                        const ta = new Date((item && (item.updatedAt || item.dataCriacao)) || 0).getTime();
                        const tb = new Date((r && (r.updatedAt || r.dataCriacao)) || 0).getTime();
                        const shouldUpsert = !r || (ta && (!tb || ta > tb));
                        if (shouldUpsert) {
                            const manager = (window.getFirebaseManager && window.getFirebaseManager()) || null;
                            if (manager && typeof manager.saveData === 'function') {
                                const resolved = resolvePath(`folhas/${id}`);
                                await manager.saveData(resolved, item);
                                console.log(`🔄 Folha sincronizada por item: ${id}`);
                            }
                        }
                    }
                }
            }
            
            this.lastSyncTime = Date.now();
            console.log('✅ Sincronização concluída');
        
        } catch (error) {
            console.error('❌ Erro na sincronização:', error);
        } finally {
            this.syncInProgress = false;
        }
    }
    
    shouldSyncData(localData, remoteData) {
        // Sincronizar apenas quando há dados locais e remoto está vazio
        const remoteEmpty = (remoteData == null) || (Array.isArray(remoteData) ? remoteData.length === 0 : Object.keys(remoteData || {}).length === 0);
        return !!localData && remoteEmpty;
    }
}

// ✅ EXPORTAR CLASSES E FUNÇÕES
window.FolhaFirebaseService = FolhaFirebaseService;
// Não sobrescrever utilitários globais do manager; exportar apenas namespace Folha*
window.getFolhaData = getFolhaDataInternalCore;
window.saveFolhaData = saveFolhaDataCore;
window.deleteFolhaData = deleteFolhaDataCore;
window.setupFolhaRealtimeListener = setupFolhaRealtimeListenerCore;

// ✅ INICIALIZAÇÃO AUTOMÁTICA OTIMIZADA
document.addEventListener('DOMContentLoaded', () => {
    (async () => {
        try {
            const firebaseService = new FolhaFirebaseService();
            window.folhaFirebaseService = firebaseService;
            window.dataSyncManager = new DataSyncManager();
            console.log('✅ Firebase Service e Sync Manager inicializados');
        } catch (error) {
            console.error('❌ Erro ao inicializar serviços:', error);
        }
    })();
});

console.log('🔥 Firebase Service otimizado carregado');
