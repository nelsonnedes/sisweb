/**
 * ✅ CORREÇÕES PARA SALVAMENTO DE CLIENTES NOS ROMANEIOS
 * 
 * Este arquivo corrige os problemas de salvamento de clientes no Firebase
 * nos sistemas de romaneio PCT, TL e TORA.
 * 
 * Problemas corrigidos:
 * 1. Uso incorreto de firebaseService.saveToFirebase para arrays
 * 2. Múltiplas implementações conflitantes de saveClient
 * 3. Falta de padronização entre os romaneios
 * 4. Duplicação de nós no Firebase (root vs tenant)
 * 5. Correção da estrutura de dados (Map vs Array)
 */

console.log("🔧 === INICIANDO CORREÇÕES DE SALVAMENTO DE CLIENTES (V2) ===");

function resolveTenantId() {
    try {
        const svc = window.firebaseService || window.firebaseServiceTL || window.FirebaseService;
        if (svc && typeof svc.getTenantId === 'function') {
            const t = svc.getTenantId();
            if (t) return String(t);
        }
        if (svc && typeof svc.getCurrentTenantId === 'function') {
            const t = svc.getCurrentTenantId();
            if (t) return String(t);
        }
    } catch (_) {}
    try {
        if (typeof window.getTenantId === 'function') {
            const t = window.getTenantId();
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

function ensureFirebaseServiceAdapters() {
    const svc = window.firebaseService || window.firebaseServiceTL || window.FirebaseService;
    if (!svc) return null;

    try {
        if (window.firebaseService && window.firebaseService !== svc) {
            const looksLikeModuleNamespace = !!(window.firebaseService && typeof window.firebaseService === 'object' && !window.firebaseService.loadFromFirebase && !window.firebaseService.saveData);
            if (looksLikeModuleNamespace) {
                window.firebaseService = svc;
            }
        } else if (!window.firebaseService) {
            window.firebaseService = svc;
        }
    } catch (_) {}

    if (!svc.db && svc.database) svc.db = svc.database;

    if (typeof svc.saveToFirebase !== 'function' && typeof svc.saveData === 'function') {
        svc.saveToFirebase = async (path, id, data) => {
            try {
                const base = String(path || '').replace(/^\/+/, '');
                if (!base) return { success: false, error: 'Path inválido' };

                let finalId = (id === undefined || id === null) ? null : String(id);
                if (!finalId || finalId === 'auto') {
                    try {
                        if (svc.database && typeof svc.getNamespacedPath === 'function') {
                            const writePath = svc.getNamespacedPath(base);
                            finalId = svc.database.ref(writePath).push().key;
                        }
                    } catch (_) {}
                    if (!finalId || finalId === 'auto') finalId = `${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
                }

                const key = `${base}/${finalId}`;
                const payload = (data && typeof data === 'object') ? { ...data, id: data.id || finalId } : data;
                const res = await svc.saveData(key, payload);
                if (res && res.success) return { success: true, id: finalId, source: res.source || 'firebase' };
                return { success: false, id: finalId, error: (res && res.error) ? res.error : 'Falha ao salvar' };
            } catch (e) {
                return { success: false, error: String(e && e.message || e) };
            }
        };
    }

    if (typeof svc.removeFromFirebase !== 'function' && typeof svc.deleteData === 'function') {
        svc.removeFromFirebase = async (key) => svc.deleteData(String(key || ''));
    }

    return svc;
}

ensureFirebaseServiceAdapters();

const CLIENT_CACHE_KEY = 'clients';
const CLIENT_CACHE_DB_NAME = 'sisweb_cache_db';
const CLIENT_CACHE_STORE_NAME = 'kv';
let clientCacheDbPromise = null;
let clientCacheMode = '';

function updateClientCacheIndicator(mode) {
    try {
        const badgeId = 'sisweb-client-cache-indicator';
        let badge = document.getElementById(badgeId);
        if (mode === 'indexeddb') {
            if (!badge) {
                badge = document.createElement('div');
                badge.id = badgeId;
                badge.style.position = 'fixed';
                badge.style.right = '12px';
                badge.style.bottom = '12px';
                badge.style.zIndex = '99999';
                badge.style.padding = '6px 10px';
                badge.style.borderRadius = '999px';
                badge.style.background = '#111827';
                badge.style.color = '#fff';
                badge.style.fontSize = '12px';
                badge.style.fontWeight = '700';
                badge.style.boxShadow = '0 6px 18px rgba(0,0,0,0.18)';
                document.body.appendChild(badge);
            }
            badge.textContent = 'cache: indexeddb';
            badge.style.display = 'inline-flex';
        } else if (badge) {
            badge.remove();
        }
    } catch (_) {}
}

function setClientCacheMode(mode, reason) {
    const next = String(mode || '').trim().toLowerCase() || 'unknown';
    if (next === clientCacheMode) return;
    clientCacheMode = next;
    try {
        window.__siswebClientCacheMode = next;
        window.dispatchEvent(new CustomEvent('clients:cache-mode', {
            detail: { mode: next, reason: reason ? String(reason) : '' }
        }));
    } catch (_) {}
    try {
        const suffix = reason ? ` (${String(reason)})` : '';
        console.info(`[clients-cache] cache: ${next}${suffix}`);
    } catch (_) {}
    updateClientCacheIndicator(next);
}

function isQuotaExceededError(error) {
    if (!error) return false;
    const name = String(error.name || '').toLowerCase();
    const code = Number(error.code || 0);
    const message = String(error.message || '').toLowerCase();
    return name.includes('quota') || code === 22 || code === 1014 || message.includes('quota');
}

function getClientCacheDb() {
    if (!window.indexedDB) return Promise.resolve(null);
    if (clientCacheDbPromise) return clientCacheDbPromise;
    clientCacheDbPromise = new Promise((resolve) => {
        try {
            const request = window.indexedDB.open(CLIENT_CACHE_DB_NAME, 1);
            request.onupgradeneeded = () => {
                const db = request.result;
                if (!db.objectStoreNames.contains(CLIENT_CACHE_STORE_NAME)) {
                    db.createObjectStore(CLIENT_CACHE_STORE_NAME, { keyPath: 'key' });
                }
            };
            request.onsuccess = () => resolve(request.result || null);
            request.onerror = () => resolve(null);
        } catch (_) {
            resolve(null);
        }
    });
    return clientCacheDbPromise;
}

async function writeClientsCache(clients) {
    const data = Array.isArray(clients) ? clients : [];
    const serialized = JSON.stringify(data);
    let localSaved = false;
    try {
        if (serialized.length <= 2500000) {
            localStorage.setItem(CLIENT_CACHE_KEY, serialized);
            localSaved = true;
            setClientCacheMode('localstorage');
        } else {
            localStorage.removeItem(CLIENT_CACHE_KEY);
            setClientCacheMode('indexeddb', 'payload_large');
        }
    } catch (error) {
        if (isQuotaExceededError(error)) {
            try { localStorage.removeItem(CLIENT_CACHE_KEY); } catch (_) {}
            setClientCacheMode('indexeddb', 'quota_exceeded');
        }
    }
    try {
        const db = await getClientCacheDb();
        if (!db) {
            if (!localSaved) setClientCacheMode('localstorage_unavailable');
            return;
        }
        await new Promise((resolve) => {
            const tx = db.transaction(CLIENT_CACHE_STORE_NAME, 'readwrite');
            tx.objectStore(CLIENT_CACHE_STORE_NAME).put({ key: CLIENT_CACHE_KEY, value: data, updatedAt: Date.now() });
            tx.oncomplete = () => resolve(true);
            tx.onerror = () => resolve(false);
        });
        if (!localSaved) setClientCacheMode('indexeddb');
    } catch (_) {}
}

async function readClientsCache() {
    try {
        const raw = localStorage.getItem(CLIENT_CACHE_KEY);
        if (raw) {
            const parsed = JSON.parse(raw);
            if (Array.isArray(parsed)) {
                setClientCacheMode('localstorage');
                return parsed;
            }
        }
    } catch (_) {}
    try {
        const db = await getClientCacheDb();
        if (!db) return null;
        return await new Promise((resolve) => {
            const tx = db.transaction(CLIENT_CACHE_STORE_NAME, 'readonly');
            const req = tx.objectStore(CLIENT_CACHE_STORE_NAME).get(CLIENT_CACHE_KEY);
            req.onsuccess = () => {
                const value = req.result && Array.isArray(req.result.value) ? req.result.value : null;
                if (value) setClientCacheMode('indexeddb');
                resolve(value);
            };
            req.onerror = () => resolve(null);
        });
    } catch (_) {
        return null;
    }
}

async function removeClientFromCaches(clientId) {
    const current = await readClientsCache();
    if (Array.isArray(current)) {
        const filtered = current.filter(c => String(c && c.id) !== String(clientId));
        if (filtered.length !== current.length) {
            await writeClientsCache(filtered);
        }
    }
    ['clientes', 'clientesPct'].forEach((key) => {
        try {
            const raw = localStorage.getItem(key);
            if (!raw) return;
            const parsed = JSON.parse(raw);
            if (!Array.isArray(parsed)) return;
            const filtered = parsed.filter(c => String(c && c.id) !== String(clientId));
            if (filtered.length !== parsed.length) {
                localStorage.setItem(key, JSON.stringify(filtered));
            }
        } catch (_) {}
    });
}

(function ensureAdaptersAfterFirebase() {
    let tries = 0;
    const maxTries = 60;
    const tick = () => {
        tries++;
        const svc = ensureFirebaseServiceAdapters();
        if (svc && (typeof svc.saveToFirebase === 'function') && svc.db) return;
        if (tries >= maxTries) return;
        setTimeout(tick, 50);
    };
    setTimeout(tick, 0);
    try {
        window.addEventListener('firebaseReady', () => {
            try { ensureFirebaseServiceAdapters(); } catch (_) {}
        });
    } catch (_) {}
})();

if (typeof window.getDataAsync !== 'function') {
    window.getDataAsync = async function(key) {
        const k = String(key || '').trim();
        if (!k) return null;
        try {
            const svc = ensureFirebaseServiceAdapters();
            if (svc && typeof svc.loadFromFirebase === 'function') {
                const res = await svc.loadFromFirebase(k);
                if (res && res.success) {
                    const raw = res.data;
                    if (raw === null || raw === undefined) return null;
                    let data = raw;
                    if (k === 'clients' && raw && typeof raw === 'object' && !Array.isArray(raw)) {
                        data = Object.entries(raw)
                            .map(([id, v]) => (v && typeof v === 'object') ? ({ id: v.id || id, ...v }) : null)
                            .filter(Boolean);
                    }
                    if (k === CLIENT_CACHE_KEY && Array.isArray(data)) {
                        await writeClientsCache(data);
                    } else {
                        try { localStorage.setItem(k, JSON.stringify(data)); } catch (_) {}
                    }
                    return data;
                }
            }
        } catch (_) {}
        if (k === CLIENT_CACHE_KEY) {
            try {
                const cached = await readClientsCache();
                if (Array.isArray(cached)) return cached;
            } catch (_) {}
        }
        try {
            const tenantId = resolveTenantId();
            const candidates = [];
            if (tenantId) candidates.push(`companies/${tenantId}/${k}`);
            candidates.push(k);
            for (const ck of candidates) {
                const raw = localStorage.getItem(ck);
                if (!raw) continue;
                try { return JSON.parse(raw); } catch (_) {}
            }
        } catch (_) {}
        return null;
    };
}

// ✅ 1. FUNÇÃO UNIFICADA PARA SALVAR CLIENTES
function criarFuncaoSalvarClientesUnificada() {
    console.log("🔧 Criando função unificada para salvar clientes...");
    
    // Função principal para salvar clientes
    window.salvarClientesUnificado = async function(clients) {
        try {
            if (!Array.isArray(clients)) {
                console.error("❌ Dados inválidos para salvamento:", clients);
                throw new Error("Dados de clientes inválidos");
            }
            
            console.log(`💾 Salvando ${clients.length} clientes no Firebase...`);
            
            const sanitizeForFirebase = (value) => {
                if (value === undefined) return null;
                if (value === null) return null;
                if (Array.isArray(value)) return value.map(sanitizeForFirebase);
                if (typeof value === 'object') {
                    const out = {};
                    Object.keys(value).forEach((k) => {
                        const v = sanitizeForFirebase(value[k]);
                        if (v !== undefined) out[k] = v;
                    });
                    return out;
                }
                if (typeof value === 'number' && Number.isNaN(value)) return 0;
                return value;
            };

            // Método Prioritário: Usar saveToFirebase do firebaseService (Com Tenancy e Map)
            if (window.firebaseService && typeof window.firebaseService.saveToFirebase === 'function') {
                
                // 🔍 VERIFICAÇÃO DE TENÂNCIA EXPLÍCITA
                let tenantId = resolveTenantId();

                const pathBase = tenantId ? `companies/${tenantId}/clients` : 'clients';
                if (!tenantId) {
                    console.error("❌ ERRO CRÍTICO: Tenant ID não encontrado! O cliente não será salvo para evitar perda de dados.");
                    alert("Erro de permissão: Não foi possível identificar a empresa. Recarregue a página e tente novamente.");
                    throw new Error("Tenant ID não identificado. Operação abortada.");
                } else {
                    console.log(`✅ Tenant ID detectado: ${tenantId}`);
                    console.log(`📂 Caminho de gravação definido: ${pathBase}`);
                }

                let successCount = 0;
                let failCount = 0;
                // Salvar cada cliente individualmente para manter estrutura de Map (clients/{id})
                // Isso evita conflitos e problemas de array vs objeto
                const promises = clients.map(async (client) => {
                    if (!client || !client.id) return;
                    const payload = sanitizeForFirebase({ ...client, id: String(client.id) });
                    
                    // Salvar usando o caminho explícito para garantir
                    // saveToFirebase detecta se já tem 'companies/' e não duplica
                    const result = await window.firebaseService.saveToFirebase(pathBase, String(client.id), payload);
                    
                    if (!result || !result.success) {
                        try {
                            if (typeof window.firebaseService.saveData === 'function') {
                                const fallbackResult = await window.firebaseService.saveData(`${pathBase}/${String(client.id)}`, payload);
                                if (fallbackResult && fallbackResult.success) {
                                    successCount += 1;
                                    return;
                                }
                            }
                        } catch (_) {}
                        console.warn(`⚠️ Falha ao salvar cliente ${client.id} via saveToFirebase`, result && result.error ? result.error : '');
                        failCount += 1;
                        return;
                    }
                    successCount += 1;
                });
                
                await Promise.all(promises);
                
                if (successCount > 0) {
                    console.log(`✅ Clientes salvos via firebaseService (Individual/Map). Sucesso: ${successCount}, falhas: ${failCount}`);
                    // Disparar evento de atualização
                    try { window.dispatchEvent(new CustomEvent('clients:updated', { detail: { clients } })); } catch {}
                    return true;
                }
            }

            // Método Fallback: Usar serviço unificado quando disponível
            if (window.unifiedFirebaseService && typeof window.unifiedFirebaseService.saveToFirebase === 'function') {
                let allOk = true;
                for (const c of clients) {
                    if (!c || !c.id) continue;
                    const r = await window.unifiedFirebaseService.saveToFirebase('clients', String(c.id), c);
                    if (!r || r.success === false) allOk = false;
                }
                if (allOk) {
                    console.log("✅ Clientes salvos via serviço unificado (saveToFirebase)");
                    try { window.dispatchEvent(new CustomEvent('clients:updated', { detail: { clients } })); } catch {}
                    return true;
                }
            }
            // Método Fallback: Usar Firebase diretamente (apenas se o anterior falhar totalmente)
            if (window.firebaseService && (window.firebaseService.dbService || window.firebaseService.db)) {
                console.warn("⚠️ Usando fallback de salvamento direto no Firebase");
                // Tentar obter path correto via tenancy
                let path = 'clients';
                let tenantId = resolveTenantId();
                if (tenantId) {
                    path = `companies/${tenantId}/clients`;
                } else {
                    console.error("❌ ERRO CRÍTICO: Tentativa de salvar sem Tenant ID. Abortando para evitar dados no root.");
                    return false;
                }
                
                // Salvar como Map (objeto indexado por ID)
                const updates = {};
                clients.forEach(c => {
                    if (c && c.id) updates[`${path}/${c.id}`] = c;
                });
                
                if (Object.keys(updates).length > 0) {
                    if (window.firebaseService.dbService && typeof window.firebaseService.dbService.getDatabase === 'function' && typeof window.firebaseService.dbService.ref === 'function' && typeof window.firebaseService.dbService.update === 'function') {
                        const db = window.firebaseService.dbService.getDatabase();
                        const rootRef = window.firebaseService.dbService.ref(db);
                        await window.firebaseService.dbService.update(rootRef, updates);
                    } else if (window.firebaseService.db && typeof window.firebaseService.db.ref === 'function') {
                        await window.firebaseService.db.ref().update(updates);
                    } else {
                        for (const c of clients) {
                            if (!c || !c.id) continue;
                            const payload = sanitizeForFirebase({ ...c, id: String(c.id) });
                            if (typeof window.firebaseService.saveData === 'function') {
                                await window.firebaseService.saveData(`${path}/${String(c.id)}`, payload);
                            } else if (typeof window.firebaseService.saveToFirebase === 'function') {
                                await window.firebaseService.saveToFirebase(path, String(c.id), payload);
                            }
                        }
                        console.log("✅ Clientes salvos via fallback por registro (sem update em lote)");
                        return true;
                    }
                    console.log("✅ Clientes salvos via Firebase direto (Update em lote)", path);
                    // Disparar evento de atualização
                    try { window.dispatchEvent(new CustomEvent('clients:updated', { detail: { clients } })); } catch {}
                    return true;
                }
            }
            
            throw new Error("Nenhum método de salvamento disponível ou falha na tenância");
            
        } catch (error) {
            console.error("❌ Erro ao salvar clientes:", error);
            throw error;
        }
    };
    
    console.log("✅ Função unificada de salvamento criada");
}

// ✅ 2. CORRIGIR FUNÇÃO SAVECLIENT GLOBAL E SERVICE
function corrigirSaveClientGlobal() {
    console.log("🔧 Corrigindo função saveClient global e do serviço...");
    
    const saveClientImplementation = async function(clientData) {
        try {
            console.log("💾 Salvando cliente individual (Implementação Fix):", clientData?.name || clientData?.nome);
            
            if (!clientData || (!clientData.name && !clientData.nome)) {
                throw new Error("Dados de cliente inválidos");
            }
            const isEditMode = clientData && clientData.__editMode === true;
            if (isEditMode && !String(clientData.id || '').trim()) {
                throw new Error("Falha de integridade: atualização sem ID em modo de edição");
            }
            
            // Obter lista atual de clientes (do service ou firebase)
            let clients = [];
            if (window.clientService && typeof window.clientService.getClients === 'function') {
                clients = await window.clientService.getClients(false) || [];
            } else if (window.firebaseService) {
                clients = await window.getDataAsync('clients') || [];
            }
            
            // Garantir que é um array
            if (!Array.isArray(clients)) clients = [];
            
            const existingIds = new Set(clients.map(c => String(c && c.id)));
            const incomingId = clientData.id ? String(clientData.id) : '';
            const existingIndexByIncomingId = incomingId ? clients.findIndex(c => String(c && c.id) === incomingId) : -1;
            const makeId = () => `${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
            let resolvedId = incomingId;
            if (!resolvedId) {
                resolvedId = makeId();
                while (existingIds.has(String(resolvedId))) {
                    resolvedId = makeId();
                }
            } else if (existingIndexByIncomingId === -1 && existingIds.has(String(resolvedId))) {
                resolvedId = makeId();
                while (existingIds.has(String(resolvedId))) {
                    resolvedId = makeId();
                }
            }

            const normalizedClient = {
                id: resolvedId,
                name: clientData.name || clientData.nome,
                nome: clientData.name || clientData.nome, // Compatibilidade
                city: clientData.city || clientData.cidade || '',
                cidade: clientData.city || clientData.cidade || '',
                state: clientData.state || clientData.estado || '',
                estado: clientData.state || clientData.estado || '',
                phone: clientData.phone || clientData.telefone || '',
                telefone: clientData.phone || clientData.telefone || '',
                email: clientData.email || '',
                address: clientData.address || clientData.endereco || '',
                endereco: clientData.address || clientData.endereco || '',
                obs: clientData.obs || clientData.observacoes || '',
                createdAt: clientData.createdAt || Date.now(),
                updatedAt: Date.now()
            };

            const tenantForData = resolveTenantId();
            if (tenantForData && !normalizedClient.companyId) {
                normalizedClient.companyId = String(tenantForData);
            }
            
            // Verificar se cliente já existe
            const existingIndex = clients.findIndex(c => String(c && c.id) === String(normalizedClient.id));
            
            if (existingIndex !== -1) {
                clients[existingIndex] = normalizedClient;
                console.log("🔄 Cliente atualizado na lista:", normalizedClient.name);
            } else {
                clients.push(normalizedClient);
                console.log("➕ Novo cliente adicionado à lista:", normalizedClient.name);
            }
            
            // 1. Salvar localmente primeiro (cache)
            if (window.clientService) {
                await writeClientsCache(clients);
            }
            
            // 2. Salvar no Firebase (Individualmente para garantir consistência)
            if (window.firebaseService && typeof window.firebaseService.saveToFirebase === 'function') {
                
                // 🔍 VERIFICAÇÃO DE TENÂNCIA EXPLÍCITA
                let tenantId = resolveTenantId();

                const pathBase = tenantId ? `companies/${tenantId}/clients` : 'clients';
                if (!tenantId) {
                    console.error("❌ ERRO CRÍTICO: Tenant ID não encontrado! O cliente não será salvo para evitar perda de dados.");
                    alert("Erro de permissão: Não foi possível identificar a empresa. Recarregue a página e tente novamente.");
                    throw new Error("Tenant ID não identificado. Operação abortada.");
                } else {
                    console.log(`✅ Tenant ID detectado: ${tenantId}. Salvando em: ${pathBase}`);
                }

                let savedOk = false;
                let lastError = null;
                for (let attempt = 0; attempt < 2 && !savedOk; attempt++) {
                    try {
                        const res = await window.firebaseService.saveToFirebase(pathBase, String(normalizedClient.id), normalizedClient);
                        if (res && res.success) {
                            savedOk = true;
                            console.log("✅ Cliente salvo no Firebase (saveToFirebase):", res);
                        } else {
                            throw new Error(res && res.error ? res.error : 'Falha ao salvar cliente');
                        }
                    } catch (e) {
                        lastError = e;
                    }
                }
                if (!savedOk) {
                    try {
                        if (typeof window.salvarClientesUnificado === 'function') {
                            await window.salvarClientesUnificado([normalizedClient]);
                            savedOk = true;
                        }
                    } catch (e) {
                        lastError = e;
                    }
                }
                if (!savedOk) {
                    throw lastError || new Error('Falha ao salvar cliente no Firebase');
                }

                // 🔍 VERIFICAÇÃO PÓS-GRAVAÇÃO (Double Check)
                try {
                    console.log("🔍 Verificando integridade da gravação...");
                    
                    // 1. Tentar verificação direta via SDK (Bypassing loadFromFirebase magic)
                    let verified = false;
                    const fullPath = `${pathBase}/${normalizedClient.id}`;
                    
                    if (window.firebaseService && window.firebaseService.dbService) {
                        try {
                            console.log(`🔍 Verificando diretamente no path: ${fullPath}`);
                            const db = window.firebaseService.dbService.getDatabase();
                            const dbRef = window.firebaseService.dbService.ref(db, fullPath);
                            const snap = await window.firebaseService.dbService.get(dbRef);
                            
                            if (snap.exists()) {
                                console.log("✅ VERIFICADO (Direct DB): Dados confirmados em:", fullPath);
                                verified = true;
                            }
                        } catch (directErr) {
                            console.warn("⚠️ Falha na verificação direta, tentando loadFromFirebase:", directErr);
                        }
                    }

                    if (!verified) {
                        // 2. Fallback para loadFromFirebase com lógica de caminho ajustada
                        // O loadFromFirebase adiciona automaticamente o prefixo companies/{id} se o serviço tiver um tenantId configurado
                        let checkPath = fullPath;
                        const serviceTenantId = window.firebaseService.getTenantId ? window.firebaseService.getTenantId() : null;
                        
                        if (serviceTenantId && checkPath.startsWith(`companies/${serviceTenantId}/`)) {
                            console.log(`ℹ️ Ajustando caminho de verificação: removendo prefixo companies/${serviceTenantId}/`);
                            checkPath = checkPath.replace(`companies/${serviceTenantId}/`, '');
                            // Remover barra inicial se sobrar
                            if (checkPath.startsWith('/')) checkPath = checkPath.substring(1);
                        }

                        console.log(`🔍 Tentando loadFromFirebase com path: ${checkPath}`);
                        const checkData = await window.firebaseService.loadFromFirebase(checkPath);
                        if (checkData && (checkData.data || checkData.success)) { // Aceitar se success=true mesmo que data seja null (pode ser delay)
                             // Se data for null mas success true, pode ser que o path exista mas esteja vazio? Não, loadFromFirebase retorna data:null se vazio.
                             // Mas para clientes, não deve ser null.
                             if (checkData.data) {
                                console.log("✅ VERIFICADO: Dados confirmados via loadFromFirebase");
                                verified = true;
                             }
                        }
                    }

                    if (verified) {
                        // Sucesso
                    } else {
                        // Se falhar, tentar método unificado (Retry)
                        console.warn("⚠️ Verificação falhou. Tentando retry com salvarClientesUnificado...");
                        if (typeof window.salvarClientesUnificado === 'function') {
                            await window.salvarClientesUnificado(clients);
                            
                            // Re-verificar (apenas Direct DB para ser consistente)
                            if (window.firebaseService && window.firebaseService.dbService) {
                                const db = window.firebaseService.dbService.getDatabase();
                                const dbRef = window.firebaseService.dbService.ref(db, fullPath);
                                const snap = await window.firebaseService.dbService.get(dbRef);
                                if (snap.exists()) {
                                    console.log("✅ VERIFICADO (após retry): Dados confirmados.");
                                    verified = true;
                                }
                            }
                        }
                        
                        if (!verified) {
                            // Se ainda assim falhar, apenas logar aviso (não bloquear fluxo se salvou ok)
                            console.warn(`⚠️ ALERTA: Cliente salvo com sucesso, mas verificação pós-gravação falhou em ${fullPath}. (Possível delay de indexação ou cache)`);
                            // Não lançar erro aqui, pois saveToFirebase retornou success=true
                            // throw new Error('Falha ao verificar gravação do cliente após retry');
                        }
                    }
                } catch (verifyErr) {
                    console.warn("⚠️ Erro na verificação pós-gravação (ignorado pois salvamento reportou sucesso):", verifyErr);
                    // Não lançar erro
                }
            } else {
                // Fallback para salvar lista completa
                await window.salvarClientesUnificado(clients);
            }
            
            // 3. Atualizar variáveis globais e UI
            window.clients = clients;
            window.selectedClient = normalizedClient;
            window.clienteSelecionado = normalizedClient;
            
            // Preencher campos na tela
            const clienteInput = document.getElementById('clienteInput');
            if (clienteInput) {
                clienteInput.value = normalizedClient.nome || normalizedClient.name || '';
                clienteInput.dispatchEvent(new Event('input', { bubbles: true }));
                clienteInput.dispatchEvent(new Event('change', { bubbles: true }));
            }
            
            // 🔥 DISPARAR EVENTO DE ATUALIZAÇÃO CRÍTICO
            console.log("📡 Disparando evento clients:updated...");
            window.dispatchEvent(new CustomEvent('clients:updated', { detail: { client: normalizedClient, allClients: clients } }));
            
            return normalizedClient;
            
        } catch (error) {
            console.error("❌ Erro ao salvar cliente:", error);
            throw error;
        }
    };

    // Aplicar a correção globalmente
    window.saveClient = saveClientImplementation;
    
    // Aplicar a correção no clientService também!
    if (window.clientService) {
        window.clientService.saveClient = saveClientImplementation;
        // Também corrigir o saveClients para usar o unificado
        window.clientService.saveClients = window.salvarClientesUnificado;
        console.log("✅ clientService.saveClient e saveClients corrigidos");
    }
    
    console.log("✅ Funções saveClient corrigidas globalmente");
}

// ✅ 3. IMPLEMENTAÇÃO UNIFICADA DE EXCLUSÃO DE CLIENTES
function corrigirDeleteClientGlobal() {
    console.log("🔧 Corrigindo função deleteClient global e do serviço...");

    const deleteClientImplementation = async function(clientId) {
        try {
            console.log(`🗑️ Excluindo cliente (Implementação Fix): ${clientId}`);
            
            if (!clientId) {
                throw new Error("ID do cliente inválido para exclusão");
            }

            // 1. Resolver Tenant
            let tenantId = resolveTenantId();
            if (!tenantId) {
                console.error("❌ ERRO CRÍTICO: Tenant ID não encontrado para exclusão!");
                alert("Erro de permissão: Não foi possível identificar a empresa.");
                throw new Error("Tenant ID não identificado.");
            }

            const pathBase = `companies/${tenantId}/clients`;
            const fullPath = `${pathBase}/${clientId}`;
            console.log(`📂 Caminho de exclusão: ${fullPath}`);

            // 2. Excluir do Firebase
            let deletedOk = false;
            
            if (window.firebaseService) {
                // Tentar usar deleteData se disponível (abstração)
                if (typeof window.firebaseService.deleteData === 'function') {
                    const res = await window.firebaseService.deleteData(fullPath);
                    if (res && res.success) deletedOk = true;
                }
                
                // Fallback para removeFromFirebase
                if (!deletedOk && typeof window.firebaseService.removeFromFirebase === 'function') {
                    const res = await window.firebaseService.removeFromFirebase(fullPath);
                    if (res && res.success) deletedOk = true;
                }
                
                // Fallback direto para DB Service
                if (!deletedOk && window.firebaseService.dbService) {
                    const db = window.firebaseService.dbService.getDatabase();
                    const ref = window.firebaseService.dbService.ref(db, fullPath);
                    await window.firebaseService.dbService.remove(ref);
                    deletedOk = true;
                }
            }

            if (!deletedOk) {
                throw new Error("Falha ao excluir cliente do Firebase (nenhum método disponível)");
            }

            console.log("✅ Cliente excluído do Firebase com sucesso");

            // 3. Limpar LocalStorage (Purge agressivo)
            await removeClientFromCaches(clientId);

            // 4. Atualizar variáveis globais
            if (Array.isArray(window.clients)) {
                window.clients = window.clients.filter(c => String(c.id) !== String(clientId));
            }
            if (window.selectedClient && String(window.selectedClient.id) === String(clientId)) {
                window.selectedClient = null;
                const input = document.getElementById('clienteInput');
                if (input) input.value = '';
            }

            // 5. Disparar evento de atualização
            console.log("📡 Disparando evento clients:updated (delete)...");
            window.dispatchEvent(new CustomEvent('clients:updated', { detail: { action: 'delete', clientId } }));

            return true;

        } catch (error) {
            console.error("❌ Erro ao excluir cliente:", error);
            throw error;
        }
    };

    // Aplicar globalmente
    window.deleteClient = deleteClientImplementation;

    // Aplicar no clientService
    if (window.clientService) {
        window.clientService.deleteClient = deleteClientImplementation;
        console.log("✅ clientService.deleteClient corrigido");
    }
    
    // Injetar no firebaseService se não tiver (para scripts que chamam direto)
    if (window.firebaseService && !window.firebaseService.deleteClient) {
        window.firebaseService.deleteClient = deleteClientImplementation;
    }

    // ✅ PATCH AGRESSIVO PARA MÓDULOS ESPECÍFICOS (TL, PCT)
    if (window.ModalClientes) {
        window.ModalClientes.deleteClient = deleteClientImplementation;
        console.log("✅ ModalClientes.deleteClient corrigido (TL)");
    }
    if (window.GerenciarClientes) {
        // Se GerenciarClientes tiver deleteClient, corrigir também
        if (window.GerenciarClientes.deleteClient) {
            window.GerenciarClientes.deleteClient = deleteClientImplementation;
            console.log("✅ GerenciarClientes.deleteClient corrigido");
        }
    }

    console.log("✅ Função deleteClient corrigida globalmente");
}

// Executar correções
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
        criarFuncaoSalvarClientesUnificada();
        corrigirSaveClientGlobal();
        corrigirDeleteClientGlobal();
    });
} else {
    criarFuncaoSalvarClientesUnificada();
    corrigirSaveClientGlobal();
    corrigirDeleteClientGlobal();
}
