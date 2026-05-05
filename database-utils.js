/**
 * Database Utils - Utilitários para transição do localStorage para Firebase
 * 
 * Este arquivo fornece funções compatíveis que funcionam tanto com localStorage
 * quanto com Firebase, facilitando a migração gradual sem quebrar o código existente.
 */

// Importar o firebaseService quando disponível
let firebaseService = null;
try {
    if (window.firebaseService) {
        firebaseService = window.firebaseService;
    }
} catch (error) {
    console.warn('Firebase service não disponível:', error.message);
}
const runtimeMemoryStore = new Map();

function getRuntimeFirebaseService() {
    try {
        const candidates = [window.firebaseService, window.firebaseServiceTL, window.unifiedFirebaseService, window.FirebaseService].filter(Boolean);
        for (const svc of candidates) {
            const hasIo = typeof svc.loadFromFirebase === 'function' || typeof svc.saveToFirebase === 'function' || typeof svc.saveData === 'function';
            if (hasIo) return svc;
        }
    } catch (_) {}
    return firebaseService;
}

function isFirebaseOperationalNow(svc) {
    try {
        if (!svc) return false;
        if (typeof svc.isFirebaseOperational === 'function') return !!svc.isFirebaseOperational();
        if (typeof svc.isOperational === 'function') return !!svc.isOperational();
        return true;
    } catch (_) {
        return false;
    }
}

function isTenantScopedKey(key) {
    const k = String(key || '').trim();
    return [
        'clients',
        'clientesTora',
        'clientes',
        'species',
        'especies',
        'romaneiosPct',
        'romaneiosTora',
        'romaneiosTl',
        'contasReceber',
        'contasPagar',
        'romaneios/pct',
        'romaneios/tl',
        'romaneios/pes',
        'romaneios/tora',
        'financas/pagar',
        'financas/receber'
    ].includes(k);
}

function isAdminLikeSession() {
    try {
        const current = JSON.parse(localStorage.getItem('currentUser') || 'null') || {};
        const persistent = JSON.parse(localStorage.getItem('persistentUser') || 'null') || {};
        const uid = String(current.uid || current.id || current.userId || persistent.uid || persistent.id || persistent.userId || '').trim();
        const allow = new Set(['HfrQ6ObQq2aSEoeEE4Ng9jpAolB3']);
        if (!uid || !allow.has(uid)) return false;
        return !!(
            current.superadmin === true
            || (current.claims && current.claims.superadmin === true)
            || persistent.superadmin === true
            || (persistent.claims && persistent.claims.superadmin === true)
        );
    } catch (_) {
        return false;
    }
}

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
            const id = raw.id || raw.companyId || raw.slug || raw.nome || raw.name;
            if (id) return String(id);
        }
        const stored = localStorage.getItem('company_info');
        if (stored) {
            const obj = JSON.parse(stored);
            const id = obj && (obj.id || obj.companyId || obj.slug || obj.nome || obj.name);
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
    try {
        const mem = runtimeMemoryStore.get(String(key || ''));
        if (mem && typeof mem.payload === 'string') return mem.payload;
    } catch (_) {}
    for (const k of getLocalStorageKeys(key)) {
        try {
            const sessionVal = sessionStorage.getItem(k);
            if (sessionVal) {
                runtimeMemoryStore.set(String(key || ''), { payload: sessionVal, updatedAt: Date.now() });
                return sessionVal;
            }
        } catch (_) {}
        try {
            const val = localStorage.getItem(k);
            if (val) {
                runtimeMemoryStore.set(String(key || ''), { payload: val, updatedAt: Date.now() });
                try { sessionStorage.setItem(k, val); } catch (_) {}
                return val;
            }
        } catch (_) {}
    }
    return null;
}

function isQuotaExceededError(error) {
    if (!error) return false;
    const message = String(error && error.message ? error.message : error);
    return error.name === 'QuotaExceededError'
        || error.code === 22
        || error.code === 1014
        || /quota/i.test(message);
}

function compactDataForStorage(key, value) {
    const k = String(key || '');
    if (!value || typeof value !== 'object') return value;
    const list = Array.isArray(value) ? value : null;
    if (!list) return value;
    if (['romaneiosPct', 'romaneiosPes', 'romaneiosTl', 'romaneios_tl', 'romaneios'].includes(k)) {
        return list.slice(-25).map((row) => {
            const r = row && typeof row === 'object' ? row : {};
            const itens = Array.isArray(r.itens) ? r.itens : [];
            return {
                id: r.id || '',
                numero: r.numero || '',
                data: r.data || '',
                companyId: r.companyId || '',
                clienteNome: r.clienteNome || (r.cliente && (r.cliente.nome || r.cliente.name)) || '',
                totais: r.totais && typeof r.totais === 'object' ? r.totais : {},
                itens: itens.slice(0, 60).map((it) => ({
                    id: it.id || '',
                    especie: it.especie || '',
                    comprimento: parseFloat(it.comprimento) || 0,
                    largura: parseFloat(it.largura) || 0,
                    espessura: parseFloat(it.espessura || it.b || it.bitola) || 0,
                    quantidade: parseInt(it.quantidade, 10) || 0,
                    volume: parseFloat(it.volume || 0) || 0,
                    valorUnitario: parseFloat(it.valorUnitario || it.preco || 0) || 0,
                    valorTotal: parseFloat(it.valorTotal || 0) || 0
                })),
                _metadata: r._metadata && typeof r._metadata === 'object' ? r._metadata : {}
            };
        });
    }
    return value;
}

function writeLocalStorageValue(key, data) {
    const keyName = String(key || '');
    const keys = getLocalStorageKeys(keyName);
    const writeToAll = (payload) => {
        for (const k of keys) {
            localStorage.setItem(k, payload);
        }
    };
    const originalValue = typeof data === 'string' ? data : JSON.stringify(data);
    runtimeMemoryStore.set(keyName, { payload: originalValue, updatedAt: Date.now() });
    for (const k of keys) {
        try { sessionStorage.setItem(k, originalValue); } catch (_) {}
    }
    try {
        writeToAll(originalValue);
        return true;
    } catch (error) {
        if (!isQuotaExceededError(error)) throw error;
    }
    let parsed = data;
    if (typeof data === 'string') {
        try { parsed = JSON.parse(data); } catch (_) { parsed = data; }
    }
    const compactValue = compactDataForStorage(keyName, parsed);
    const compactPayload = typeof compactValue === 'string' ? compactValue : JSON.stringify(compactValue);
    runtimeMemoryStore.set(keyName, { payload: compactPayload, updatedAt: Date.now() });
    try {
        writeToAll(compactPayload);
        for (const k of keys) {
            try { sessionStorage.setItem(k, compactPayload); } catch (_) {}
        }
        return true;
    } catch (error) {
        if (!isQuotaExceededError(error)) throw error;
        try {
            Object.keys(localStorage || {}).forEach((k) => {
                if (/^company_/.test(k) && /__(romaneiosPct|romaneiosPes|romaneios_tl|romaneiosTl|romaneios)$/.test(k) && !keys.includes(k)) {
                    try { localStorage.removeItem(k); } catch (_) {}
                }
            });
            writeToAll(compactPayload);
            for (const k of keys) {
                try { sessionStorage.setItem(k, compactPayload); } catch (_) {}
            }
            return true;
        } catch (finalError) {
            if (!isQuotaExceededError(finalError)) throw finalError;
            return false;
        }
    }
}

/**
 * Função para obter dados - compatível com código existente
 * Funciona tanto de forma síncrona (localStorage) quanto assíncrona (Firebase)
 */
function getData(key) {
    // Se chamada sem await, funciona com localStorage (compatibilidade)
    try {
        const data = readLocalStorageValue(key);
        return data ? JSON.parse(data) : null;
    } catch (error) {
        console.error(`Erro ao obter dados de ${key}:`, error);
        return null;
    }
}

/**
 * Função assíncrona para obter dados do Firebase primeiro, com fallback para localStorage
 */
async function getDataAsync(key) {
    try {
        const svc = getRuntimeFirebaseService();
        // Tentar Firebase primeiro se disponível
        if (svc && isFirebaseOperationalNow(svc) && typeof svc.loadFromFirebase === 'function') {
            const loadResult = await svc.loadFromFirebase(key);
            if (loadResult && loadResult.success) {
                const result = loadResult.data;
                if (result !== null && result !== undefined) {
                    // Cache no localStorage para acesso rápido
                    writeLocalStorageValue(key, JSON.stringify(result));
                    return result;
                }
            } else if (loadResult && !loadResult.success) {
                console.log(`Firebase retornou erro para ${key}:`, loadResult.error);
            }
        }
        
        // Fallback para localStorage
        const localData = readLocalStorageValue(key);
        return localData ? JSON.parse(localData) : null;
        
    } catch (error) {
        console.error(`Erro ao obter dados de ${key}:`, error);
        
        // Último fallback para localStorage
        try {
            const localData = readLocalStorageValue(key);
            return localData ? JSON.parse(localData) : null;
        } catch (fallbackError) {
            console.error(`Erro no fallback para ${key}:`, fallbackError);
            return null;
        }
    }
}

/**
 * Função para salvar dados - compatível com código existente
 * Funciona tanto de forma síncrona (localStorage) quanto assíncrona (Firebase)
 */
function saveData(key, data) {
    try {
        // Sempre salvar no localStorage primeiro (funcionalidade offline)
        writeLocalStorageValue(key, JSON.stringify(data));
        
        // Tentar salvar no Firebase em background se disponível
        if (firebaseService && firebaseService.isOperational && firebaseService.isOperational()) {
            firebaseService.saveUserData(key, data).catch(error => {
                console.warn(`Erro ao salvar ${key} no Firebase (em background):`, error.message);
            });
        }
        
        return true;
    } catch (error) {
        console.error(`Erro ao salvar dados de ${key}:`, error);
        return false;
    }
}

/**
 * Função assíncrona para salvar dados no Firebase primeiro, com fallback para localStorage
 */
async function saveDataAsync(key, data) {
    try {
        // Sempre salvar no localStorage primeiro (cache local)
        writeLocalStorageValue(key, JSON.stringify(data));
        
        // Tentar salvar no Firebase
        const svc = getRuntimeFirebaseService();
        if (svc && isFirebaseOperationalNow(svc) && typeof svc.saveToFirebase === 'function') {
            const saveResult = await svc.saveToFirebase(key, null, data);
            if (saveResult && saveResult.success === false) {
                throw new Error(saveResult.error || `Falha ao salvar ${key} no Firebase`);
            }
            console.log(`✅ ${key} salvo no Firebase e localStorage`);
        } else {
            console.log(`📱 ${key} salvo apenas no localStorage (Firebase indisponível)`);
        }
        
        return true;
    } catch (error) {
        console.error(`Erro ao salvar dados de ${key}:`, error);
        
        // Garantir que pelo menos foi salvo no localStorage
        try {
            writeLocalStorageValue(key, JSON.stringify(data));
            return true;
        } catch (fallbackError) {
            console.error(`Erro crítico ao salvar ${key}:`, fallbackError);
            return false;
        }
    }
}

/**
 * Função para remover dados
 */
function removeData(key) {
    try {
        try { runtimeMemoryStore.delete(String(key || '')); } catch (_) {}
        for (const k of getLocalStorageKeys(key)) {
            localStorage.removeItem(k);
            try { sessionStorage.removeItem(k); } catch (_) {}
        }
        
        // Tentar remover do Firebase em background se disponível
        if (firebaseService && firebaseService.isOperational && firebaseService.isOperational()) {
            firebaseService.removeFromFirebase(key).catch(error => {
                console.warn(`Erro ao remover ${key} do Firebase (em background):`, error.message);
            });
        }
        
        return true;
    } catch (error) {
        console.error(`Erro ao remover dados de ${key}:`, error);
        return false;
    }
}

/**
 * Função assíncrona para remover dados
 */
async function removeDataAsync(key) {
    try {
        for (const k of getLocalStorageKeys(key)) {
            localStorage.removeItem(k);
        }
        
        // Tentar remover do Firebase
        if (firebaseService && firebaseService.isOperational && firebaseService.isOperational()) {
            await firebaseService.removeFromFirebase(key);
            console.log(`🗑️ ${key} removido do Firebase e localStorage`);
        } else {
            console.log(`📱 ${key} removido apenas do localStorage (Firebase indisponível)`);
        }
        
        return true;
    } catch (error) {
        console.error(`Erro ao remover dados de ${key}:`, error);
        return false;
    }
}

/**
 * Função para sincronizar dados entre localStorage e Firebase
 */
async function syncData(key) {
    try {
        const firebaseService = getRuntimeFirebaseService();
        if (!firebaseService || !isFirebaseOperationalNow(firebaseService)) {
            console.log(`Sync ${key}: Firebase indisponível`);
            return false;
        }
        if (isTenantScopedKey(key) && !resolveCompanyId()) {
            console.log(`Sync ${key}: tenant indisponível, sincronização adiada`);
            return false;
        }
        if ((key === 'companies' || key === 'empresaInfo' || key === 'systemConfig') && !isAdminLikeSession()) {
            console.log(`Sync ${key}: sessão sem privilégio administrativo, sincronização ignorada`);
            return false;
        }
        
        // Obter dados do localStorage
        const localData = readLocalStorageValue(key);
        const localParsed = localData ? JSON.parse(localData) : null;
        
        // ✅ CORREÇÃO: Usar loadFromFirebase ao invés de getUserData
        let firebaseData = null;
        if (firebaseService.loadFromFirebase) {
            const result = await firebaseService.loadFromFirebase(key);
            if (result && result.success) {
                firebaseData = result.data;
            } else if (result && !result.success) {
                console.log(`Firebase retornou erro para ${key}:`, result.error);
            }
        }
        
        // Se há dados no Firebase mas não no localStorage, baixar
        if (firebaseData && !localParsed) {
            writeLocalStorageValue(key, firebaseData);
            console.log(`⬇️ ${key} sincronizado do Firebase para localStorage`);
            return true;
        }
        
        // Se há dados no localStorage mas não no Firebase, upload
        if (localParsed && !firebaseData) {
            // ✅ CORREÇÃO: Usar saveToFirebase ao invés de saveUserData
            if (firebaseService.saveToFirebase) {
                const perRecordKeys = new Set(['romaneiosPct', 'contasReceber', 'contasPagar']);
                if (Array.isArray(localParsed) && perRecordKeys.has(String(key))) {
                    let ok = 0;
                    for (const item of localParsed) {
                        if (!item || !item.id) continue;
                        const payload = { ...item };
                        Object.keys(payload).forEach(k => { if (payload[k] === undefined) delete payload[k]; });
                        const res = await firebaseService.saveToFirebase(String(key), String(item.id), payload);
                        if (res && res.success) ok++;
                    }
                    console.log(`⬆️ ${key} sincronizado por registro (${ok} itens)`);
                } else {
                    await firebaseService.saveToFirebase(key, null, localParsed);
                    console.log(`⬆️ ${key} sincronizado do localStorage para Firebase`);
                }
                return true;
            }
        }
        
        // Se ambos existem, usar o mais recente (se houver timestamp)
        if (localParsed && firebaseData) {
            const localTimestamp = localParsed.lastModified || localParsed.updated || 0;
            const firebaseTimestamp = firebaseData.lastModified || firebaseData.updated || 0;
            
            if (firebaseTimestamp > localTimestamp) {
                writeLocalStorageValue(key, firebaseData);
                console.log(`⬇️ ${key} atualizado do Firebase (mais recente)`);
            } else if (localTimestamp > firebaseTimestamp) {
                if (firebaseService.saveToFirebase) {
                    const perRecordKeys = new Set(['romaneiosPct', 'contasReceber', 'contasPagar']);
                    if (Array.isArray(localParsed) && perRecordKeys.has(String(key))) {
                        let ok2 = 0;
                        for (const item of localParsed) {
                            if (!item || !item.id) continue;
                            const payload = { ...item };
                            Object.keys(payload).forEach(k => { if (payload[k] === undefined) delete payload[k]; });
                            const res = await firebaseService.saveToFirebase(String(key), String(item.id), payload);
                            if (res && res.success) ok2++;
                        }
                        console.log(`⬆️ ${key} atualizado por registro (${ok2} itens)`);
                    } else {
                        await firebaseService.saveToFirebase(key, null, localParsed);
                        console.log(`⬆️ ${key} atualizado no Firebase (mais recente)`);
                    }
                }
            } else {
                console.log(`✅ ${key} já sincronizado`);
            }
            return true;
        }
        
        return false;
    } catch (error) {
        console.error(`Erro ao sincronizar ${key}:`, error);
        return false;
    }
}

/**
 * Função para sincronizar todas as chaves principais
 */
async function syncAllData() {
    try {
        const path = String((window.location && window.location.pathname) || '').toLowerCase();
        if (path.includes('login.html') || path.includes('subscription.html') || path.includes('subscription-status.html')) {
            console.log('🔄 Sincronização completa ignorada nesta página de autenticação/assinatura');
            return 0;
        }
    } catch (_) {}
    const keysToSync = [
        'clients',
        'species',
        'romaneios/pct', 'romaneios/tora', 'romaneios/tl', 'romaneios/pes',
        'financas/pagar', 'financas/receber',
        'companies', 'systemConfig'
    ];
    
    console.log('🔄 Iniciando sincronização completa...');
    
    let syncedCount = 0;
    for (const key of keysToSync) {
        try {
            const synced = await syncData(key);
            if (synced) syncedCount++;
        } catch (error) {
            console.warn(`Erro ao sincronizar ${key}:`, error.message);
        }
    }
    
    console.log(`✅ Sincronização concluída: ${syncedCount}/${keysToSync.length} chaves sincronizadas`);
    return syncedCount;
}

/**
 * Wrapper para compatibilidade total com o código existente
 */
function ensureDataCompatibility() {
    // Se as funções globais não existem, criar versões compatíveis
    if (!window.getData) {
        window.getData = getData;
    }
    
    if (!window.saveData) {
        window.saveData = saveData;
    }
    
    if (!window.removeData) {
        window.removeData = removeData;
    }
    
    // Versões assíncronas
    window.getDataAsync = getDataAsync;
    window.saveDataAsync = saveDataAsync;
    window.removeDataAsync = removeDataAsync;
    window.syncData = syncData;
    window.syncAllData = syncAllData;
    window.SiswebStorage = {
        read: readLocalStorageValue,
        write: writeLocalStorageValue,
        compact: compactDataForStorage,
        remove: removeData
    };
    
    console.log('✅ Compatibilidade de dados garantida');
}

// Inicializar compatibilidade quando carregado
if (typeof window !== 'undefined') {
    ensureDataCompatibility();
    
    // Tentar sincronização inicial após um delay
    setTimeout(async () => {
        try {
            await syncAllData();
        } catch (error) {
            console.warn('Erro na sincronização inicial:', error.message);
        }
    }, 3000);
}

// Exportar funções
export {
    getData,
    getDataAsync,
    saveData,
    saveDataAsync,
    removeData,
    removeDataAsync,
    syncData,
    syncAllData,
    ensureDataCompatibility
};

console.log('✅ Database Utils carregado - compatibilidade localStorage + Firebase');

async function syncToFirebase(key) {
    try {
        console.log(`🔄 Sincronizando ${key}...`);
        
        // ✅ CORREÇÃO: Usar loadFromFirebase ao invés de getUserData
        let result = null;
        if (window.firebaseService && window.firebaseService.loadFromFirebase) {
            const loadResult = await window.firebaseService.loadFromFirebase(key);
            if (loadResult && loadResult.success) {
                result = loadResult.data;
            } else if (loadResult && !loadResult.success) {
                console.log(`Firebase retornou erro para ${key}:`, loadResult.error);
            }
        } else {
            console.log(`Firebase indisponível para ${key}`);
        }
        
        return { success: true, data: result };
    } catch (error) {
        console.error(`❌ Erro ao sincronizar ${key}:`, error);
        return { success: false, error: error.message };
    }
}
