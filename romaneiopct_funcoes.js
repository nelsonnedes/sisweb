/**
 * Funções de armazenamento e manipulação de dados
 * para o sistema de Romaneio de Pacotes
 */

/**
 * Sistema de Controle de Módulos - romaneiopct_funcoes.js
 * Evita conflitos e duplicações entre múltiplos arquivos JavaScript
 */

// Sistema de controle de módulos para evitar conflitos
window.ROMANEIOPCT_MODULES = window.ROMANEIOPCT_MODULES || {
    loaded: new Set(),
    functions: new Map(),
    priority: {
        'romaneiopct_tabela.js': 1,    // Maior prioridade - funções principais
        'romaneiopct_init.js': 2,      // Inicialização
        'romaneiopct_modais.js': 3,    // Modais
        'romaneiopct_back.js': 4,      // Backup/alternativo
        'romaneiopct_new.js': 5,       // Novo/alternativo
        'romaneiopct_salvar.js': 6,    // Salvar alternativo
        'romaneiopct_add.js': 7        // Adicionar alternativo
    }
};

function getRomaneioFirebaseService() {
    try {
        const candidates = [window.firebaseService, window.firebaseServiceTL, window.unifiedFirebaseService, window.FirebaseService].filter(Boolean);
        for (const svc of candidates) {
            const canLoad = typeof svc.loadFromFirebase === 'function';
            const canSave = typeof svc.saveToFirebase === 'function' || typeof svc.saveData === 'function';
            if (canLoad && canSave) return svc;
        }
    } catch (_) {}
    return null;
}

function ensureRomaneioFirebaseBindings() {
    try {
        const svc = getRomaneioFirebaseService();
        if (!svc) return;
        window.firebaseService = window.firebaseService || {};
        if (typeof window.firebaseService.loadFromFirebase !== 'function' && typeof svc.loadFromFirebase === 'function') {
            window.firebaseService.loadFromFirebase = svc.loadFromFirebase.bind(svc);
        }
        if (typeof window.firebaseService.saveToFirebase !== 'function') {
            if (typeof svc.saveToFirebase === 'function') {
                window.firebaseService.saveToFirebase = svc.saveToFirebase.bind(svc);
            } else if (typeof svc.saveData === 'function') {
                window.firebaseService.saveToFirebase = async function(path, key, data) {
                    const fullPath = key !== null && key !== undefined ? `${String(path || '').replace(/\/+$/, '')}/${key}` : String(path || '');
                    return svc.saveData(fullPath, data);
                };
            }
        }
        if (typeof window.firebaseService.getNamespacedPath !== 'function' && typeof svc.getNamespacedPath === 'function') {
            window.firebaseService.getNamespacedPath = svc.getNamespacedPath.bind(svc);
        }
        if (typeof window.firebaseService.getTenantId !== 'function' && typeof svc.getTenantId === 'function') {
            window.firebaseService.getTenantId = svc.getTenantId.bind(svc);
        }
    } catch (_) {}
}

ensureRomaneioFirebaseBindings();

/**
 * Registra uma função no sistema de módulos
 * @param {string} moduleName - Nome do módulo
 * @param {string} functionName - Nome da função
 * @param {Function} functionRef - Referência da função
 */
function registerModuleFunction(moduleName, functionName, functionRef) {
    const currentPriority = window.ROMANEIOPCT_MODULES.priority[moduleName] || 999;
    const existingEntry = window.ROMANEIOPCT_MODULES.functions.get(functionName);
    
    if (!existingEntry || currentPriority < existingEntry.priority) {
        window.ROMANEIOPCT_MODULES.functions.set(functionName, {
            function: functionRef,
            module: moduleName,
            priority: currentPriority
        });
        
        // Expor no escopo global
        window[functionName] = functionRef;
        
        console.log(`✅ Função ${functionName} registrada pelo módulo ${moduleName} (prioridade: ${currentPriority})`);
    } else {
        console.log(`⚠️ Função ${functionName} já registrada pelo módulo ${existingEntry.module} com prioridade maior`);
    }
}

/**
 * Marca um módulo como carregado
 * @param {string} moduleName - Nome do módulo
 */
function markModuleLoaded(moduleName) {
    window.ROMANEIOPCT_MODULES.loaded.add(moduleName);
    console.log(`📦 Módulo ${moduleName} carregado`);
}

/**
 * Verifica se um módulo foi carregado
 * @param {string} moduleName - Nome do módulo
 * @returns {boolean}
 */
function isModuleLoaded(moduleName) {
    return window.ROMANEIOPCT_MODULES.loaded.has(moduleName);
}

/**
 * Lista todos os módulos carregados
 */
function listLoadedModules() {
    console.log("📋 Módulos carregados:", Array.from(window.ROMANEIOPCT_MODULES.loaded));
    console.log("🔧 Funções registradas:", Array.from(window.ROMANEIOPCT_MODULES.functions.keys()));
}

// Expor funções de controle globalmente
window.registerModuleFunction = registerModuleFunction;
window.markModuleLoaded = markModuleLoaded;
window.isModuleLoaded = isModuleLoaded;
window.listLoadedModules = listLoadedModules;

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

function writeLocalStorageValue(key, data) {
    const payload = typeof data === 'string' ? data : JSON.stringify(data);
    for (const k of getLocalStorageKeys(key)) {
        localStorage.setItem(k, payload);
    }
}

function removeLocalStorageValue(key) {
    for (const k of getLocalStorageKeys(key)) {
        try { localStorage.removeItem(k); } catch (_) {}
    }
}

// ✅ CORREÇÃO: Carrega os clientes do Firebase (prioridade) e localStorage (fallback)
async function carregarClientes() {
    try {
        console.log("🔄 Carregando clientes do Firebase...");
        
        let clients = [];
        if (window.clientService && typeof window.clientService.getClients === 'function') {
            clients = await window.clientService.getClients(true);
        } else if (window.firebaseService && typeof window.firebaseService.loadFromFirebase === 'function') {
            try {
                const svc = window.firebaseService;
                const tenant = (typeof svc.getCurrentTenantId === 'function') ? svc.getCurrentTenantId() : null;
                const uid = (typeof svc.getCurrentUid === 'function') ? svc.getCurrentUid() : null;
                const candidatePaths = [];
                if (tenant) candidatePaths.push(`companies/${tenant}/clients`);
                // if (uid) candidatePaths.push(`users/${uid}/clients`); // 🔒 DESATIVADO: Prevenir leitura de dados legados de usuário
                candidatePaths.push('clients');
                console.log('🔎 [romaneiopct] Clientes - caminhos candidatos:', candidatePaths);
                const merged = [];
                const seenIds = new Set();
                for (const p of candidatePaths) {
                    try {
                        const res = await svc.loadFromFirebase(p);
                        if (res && res.success && res.data) {
                            const data = res.data;
                            const arr = Array.isArray(data) ? data : Object.values(data || {});
                            arr.forEach(item => {
                                if (!item) return;
                                const id = String(item.id || '').trim() || null;
                                if (id && !seenIds.has(id)) { merged.push(item); seenIds.add(id); }
                            });
                            console.log(`🟢 [romaneiopct] Path ${p} → ${arr.length} itens`);
                        } else {
                            console.log(`ℹ️ [romaneiopct] Path ${p} vazio`);
                        }
                    } catch(e) { console.warn(`⚠️ [romaneiopct] Falha ao ler ${p}:`, e?.message || e); }
                }
                clients = merged;
            } catch (firebaseError) {
                console.error("❌ Erro no Firebase:", firebaseError);
                const localData = readLocalStorageValue('clients');
                clients = localData ? JSON.parse(localData) : [];
                console.log(`📦 ${clients.length} clientes carregados do localStorage (fallback)`);
            }
        } else {
            console.error("❌ Firebase Service não disponível");
            const localData = readLocalStorageValue('clients');
            clients = localData ? JSON.parse(localData) : [];
            console.log(`📦 ${clients.length} clientes carregados do localStorage (sem Firebase)`);
        }
        
        // ✅ ATUALIZAR VARIÁVEIS GLOBAIS
        window.clients = clients;
        
        // ✅ ATUALIZAR CACHE LOCAL
        try {
            writeLocalStorageValue('clients', JSON.stringify(clients));
            console.log("✅ Cache local de clientes atualizado");
        } catch (cacheError) {
            console.warn("⚠️ Erro ao atualizar cache local:", cacheError);
        }
        
        console.log(`✅ Total de ${clients.length} clientes carregados`);
        return clients;
        
    } catch (error) {
        console.error("❌ Erro geral ao carregar clientes:", error);
        // Último recurso: localStorage
        const localData = readLocalStorageValue('clients') || readLocalStorageValue('clientesPct');
        const clients = localData ? JSON.parse(localData) : [];
        window.clients = clients;
        return clients;
    }
}

// ✅ CORREÇÃO: Carrega as espécies do Firebase (prioridade) e localStorage (fallback)
async function carregarEspecies() {
    try {
        console.log("🌿 === CARREGANDO ESPÉCIES DO FIREBASE ===");
        
        let species = [];
        
        // ✅ PRIORIDADE 100% FIREBASE
        if (window.firebaseService && typeof window.firebaseService.loadFromFirebase === 'function') {
            try {
                console.log("🔥 Carregando espécies da coleção 'especies'...");
            const result = await window.firebaseService.loadFromFirebase('especies');
                console.log("✅ loadFromFirebase resultado:", result);
                
                if (result && result.success && result.data) {
                    const firebaseData = result.data;
                    console.log("✅ Dados do Firebase encontrados:", firebaseData);
                    console.log("✅ Tipo dos dados:", typeof firebaseData);
                    console.log("✅ É array?", Array.isArray(firebaseData));
                    
                    // ✅ PROCESSAMENTO CORRETO - APENAS VALORES DIRETOS
                    if (typeof firebaseData === 'object' && !Array.isArray(firebaseData)) {
                        // Se retornou um objeto (formato Firebase), converter para array
                        species = Object.keys(firebaseData).map(key => ({
                            id: key,
                            ...firebaseData[key]
                        }));
                        console.log(`✅ ${species.length} espécies convertidas do objeto Firebase`);
                    } else if (Array.isArray(firebaseData)) {
                        species = firebaseData;
                        console.log(`✅ ${species.length} espécies já em formato array`);
                    }
                } else {
                    console.log("⚠️ Nenhuma espécie encontrada no Firebase");
                    species = [];
                }
            } catch (firebaseError) {
                console.error("❌ Erro no Firebase:", firebaseError);
                // Fallback para localStorage em caso de erro
                const localData = readLocalStorageValue('especies');
                species = localData ? JSON.parse(localData) : [];
                console.log(`📦 ${species.length} espécies carregadas do localStorage (fallback)`);
            }
            } else {
            console.error("❌ Firebase Service não disponível");
            // Fallback para localStorage
            const localData = readLocalStorageValue('especies');
            species = localData ? JSON.parse(localData) : [];
            console.log(`📦 ${species.length} espécies carregadas do localStorage (sem Firebase)`);
        }
        
        // ✅ VALIDAÇÃO E CORREÇÃO DE DADOS
        species = species.map(specie => {
            if (!specie.id) {
                specie.id = 'temp_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
            }
            const nome = String(specie.especie || specie.nome || specie.name || 'Sem nome');
            const nomeCientifico = String(specie.nomeCientifico || specie.scientificName || specie.scientific || specie.descricao || specie.description || '');
            return {
                ...specie,
                especie: nome,
                nome,
                name: nome,
                nomeCientifico
            };
        });
        
        // ✅ ATUALIZAR VARIÁVEIS GLOBAIS
        window.species = species;
        
        // ✅ ATUALIZAR CACHE LOCAL
        try {
            writeLocalStorageValue('especies', JSON.stringify(species));
            console.log("✅ Cache local de espécies atualizado");
        } catch (cacheError) {
            console.warn("⚠️ Erro ao atualizar cache local:", cacheError);
        }
        
        console.log(`✅ Total de ${species.length} espécies carregadas`);
        return species;
        
    } catch (error) {
        console.error("❌ Erro geral ao carregar espécies:", error);
        // Último recurso: localStorage
        const localData = readLocalStorageValue('especies');
        const species = localData ? JSON.parse(localData) : [];
        window.species = species;
        return species;
    }
}

// ✅ FUNÇÃO AUXILIAR: Aguardar Firebase estar pronto - CORRIGIDA
async function waitForFirebaseService(maxWaitTime = 5000) {
    console.log("⏳ Verificando disponibilidade do Firebase Service...");
    
    const startTime = Date.now();
    
    while (Date.now() - startTime < maxWaitTime) {
        // ✅ VERIFICAÇÃO PRINCIPAL - FIREBASESERVICE COMPLETO  
        if (window.firebaseService && 
            typeof window.firebaseService.saveToFirebase === 'function' && 
            typeof window.firebaseService.loadFromFirebase === 'function') {
            
            console.log("✅ Firebase Service completamente disponível!");
            return true;
        }
        
        // ✅ VERIFICAÇÃO ALTERNATIVA - FIREBASE CONECTADO
        if (window.firebase && 
            window.firebase.database && 
            window.firebaseService) {
            
            console.log("✅ Firebase básico disponível!");
            return true;
        }
        
        // ✅ VERIFICAÇÃO DE CONECTIVIDADE - se Firebase conectou via logs
        if (window.firebaseConnected === true && window.firebaseService) {
            console.log("✅ Firebase conectado via flag!");
            return true;
        }
        
        await new Promise(resolve => setTimeout(resolve, 100)); // Verificação mais rápida
    }
    
    // ✅ VERIFICAÇÃO FINAL MAIS PERMISSIVA
    if (window.firebaseService) {
        console.log("✅ Firebase Service encontrado (verificação permissiva)");
        return true;
    }
    
    console.warn("⚠️ Timeout aguardando Firebase Service - usando localStorage");
    return false;
}

// ✅ FUNÇÃO SAVEDATA CORRIGIDA: Prioriza Firebase e notifica falhas
async function saveData(key, data) {
    console.log(`💾 === SALVAMENTO INICIADO ===`);
    console.log(`💾 Chave: ${key}`);
    console.log(`💾 Dados:`, data);
    
    try {
        // ✅ VALIDAÇÃO INICIAL
        if (!key || typeof key !== 'string') {
            throw new Error("Chave inválida para salvamento");
        }
        
        if (data === null || data === undefined) {
            console.warn(`⚠️ Tentativa de salvar dados null/undefined para ${key}`);
            data = [];
        }
        
        // ✅ PADRONIZAR CHAVE: sempre usar 'clients' para fornecedores
        let finalKey = key;
        if (key === 'fornecedores' || key === 'clientesTora' || key === 'clientesPct') {
            finalKey = 'clients';
            console.log(`🔄 Redirecionando salvamento de '${key}' para 'clients'`);
        }
        if (key === 'species' || key === 'especiesPct') {
            finalKey = 'especies';
            console.log(`🔄 Redirecionando salvamento de '${key}' para 'especies'`);
        }
        if (key === 'romaneiosPacotes' || key === 'pacotes') {
            finalKey = 'romaneiosPct';
            console.log(`🔄 Redirecionando salvamento de '${key}' para 'romaneiosPct'`);
        }
        
        // ✅ SERIALIZAR DADOS ANTECIPADAMENTE
        let serializedData;
        try {
            serializedData = JSON.stringify(data);
            console.log(`✅ Dados serializados com sucesso: ${serializedData.length} caracteres`);
        } catch (serializationError) {
            console.error(`❌ Erro na serialização de ${finalKey}:`, serializationError);
            throw new Error(`Dados não podem ser serializados: ${serializationError.message}`);
        }
        
        // ✅ AGUARDAR FIREBASE ESTAR PRONTO
        console.log("⏳ Verificando disponibilidade do Firebase...");
        const firebaseReady = await waitForFirebaseService(15000);
        
        let firebaseSaved = false;
        let firebaseError = null;
        
        if (firebaseReady) {
            // ✅ TENTAR SALVAR NO FIREBASE PRIMEIRO (PRIORIDADE)
            try {
                console.log(`🔥 Salvando ${finalKey} no Firebase...`);
                
                let result;
                
                // Verificar se saveToFirebase está disponível
                if (window.firebaseService && typeof window.firebaseService.saveToFirebase === 'function') {
                    // ✅ SALVAMENTO POR REGISTRO PARA EVITAR SOBRESCRITA DE COLEÇÃO
                    if (finalKey === 'romaneiosPct') {
                        console.log('🛡️ Salvando romaneiosPct por registro (evitar overwrite)');
                        const registros = Array.isArray(data) ? data : (typeof data === 'object' && data !== null ? [data] : []);
                        let okCount = 0;
                        for (const registro of registros) {
                            if (!registro || !registro.id) continue;
                            // Remover campos undefined do registro
                            const payload = { ...registro };
                            Object.keys(payload).forEach(k => { if (payload[k] === undefined) delete payload[k]; });
                            const res = await window.firebaseService.saveToFirebase(finalKey, String(registro.id), payload);
                            if (res && res.success) okCount++;
                        }
                        result = { success: okCount > 0, saved: okCount };
                    } else {
                        // Para outras chaves, manter comportamento existente
                        result = await window.firebaseService.saveToFirebase(finalKey, null, data);
                    }
                } else if (window.firebaseService && typeof window.firebaseService.updateFirebase === 'function') {
                    // Tentar função alternativa
                    console.log('🔄 Usando updateFirebase como alternativa...');
                    result = await window.firebaseService.updateFirebase(finalKey, data);
                } else if (typeof window.saveToFirebase === 'function') {
                    // Tentar função global
                    console.log('🔄 Usando saveToFirebase global...');
                    if (finalKey === 'romaneiosPct') {
                        const registros = Array.isArray(data) ? data : (typeof data === 'object' && data !== null ? [data] : []);
                        let okCount = 0;
                        for (const registro of registros) {
                            if (!registro || !registro.id) continue;
                            const payload = { ...registro };
                            Object.keys(payload).forEach(k => { if (payload[k] === undefined) delete payload[k]; });
                            const res = await window.saveToFirebase(finalKey, String(registro.id), payload);
                            if (res && res.success) okCount++;
                        }
                        result = { success: okCount > 0, saved: okCount };
                    } else {
                        result = await window.saveToFirebase(finalKey, null, data);
                    }
                } else {
                    throw new Error('Nenhuma função de salvamento Firebase disponível');
                }
                
                if (result && result.success) {
                    console.log(`✅ ${finalKey} salvo no Firebase com sucesso`);
                    firebaseSaved = true;
                    
                    // ✅ BACKUP NO LOCALSTORAGE COMO CACHE
                    try {
                        writeLocalStorageValue(finalKey, serializedData);
                        console.log(`✅ Cache local de ${finalKey} atualizado`);
                    } catch (localError) {
                        console.warn(`⚠️ Cache local falhou para ${finalKey}:`, localError);
                    }
                    
                } else {
                    console.warn(`⚠️ Firebase retornou resultado inválido para ${finalKey}:`, result);
                    firebaseError = new Error('Firebase retornou resultado inválido');
                }
            } catch (error) {
                console.error(`❌ Erro ao salvar ${finalKey} no Firebase: ${error.message}`);
                firebaseError = error;
            }
        } else {
            console.warn(`⚠️ Firebase não está disponível para salvamento de ${finalKey}`);
            firebaseError = new Error('Firebase não está disponível');
        }
        
        // ✅ SE FIREBASE FALHOU, USAR LOCALSTORAGE COMO FALLBACK E NOTIFICAR USUÁRIO
        if (!firebaseSaved) {
            try {
                writeLocalStorageValue(finalKey, serializedData);
                console.log(`📦 ${finalKey} salvo no localStorage como fallback`);
                
                // ✅ NOTIFICAR USUÁRIO SOBRE PROBLEMA DE SINCRONIZAÇÃO
                if (finalKey === 'romaneiosPct') {
                    const userMessage = `⚠️ ATENÇÃO: Romaneio salvo localmente devido a problema de conexão com o servidor.\n\n` +
                                      `Motivo: ${firebaseError?.message || 'Erro desconhecido'}\n\n` +
                                      `Seus dados estão seguros no dispositivo, mas podem não estar sincronizados com outros dispositivos.\n\n` +
                                      `Recomendamos verificar sua conexão com a internet e tentar salvar novamente.`;
                    
                    // Mostrar alerta para romaneios
                    if (confirm(userMessage + '\n\nDeseja tentar salvar novamente no servidor?')) {
                        // Tentar salvar novamente
                        console.log('🔄 Tentando salvar novamente no Firebase...');
                        return await saveData(key, data);
                    }
                } else {
                    console.warn(`⚠️ ${finalKey} salvo apenas localmente devido a erro no Firebase: ${firebaseError?.message}`);
                }
                
                return true;
            } catch (localError) {
                console.error(`❌ Erro ao salvar no localStorage:`, localError);
                
                // ✅ FALHA CRÍTICA - NOTIFICAR USUÁRIO
                const criticalMessage = `❌ ERRO CRÍTICO: Não foi possível salvar os dados!\n\n` +
                                      `Erro Firebase: ${firebaseError?.message || 'Indisponível'}\n` +
                                      `Erro Local: ${localError.message}\n\n` +
                                      `Por favor, verifique sua conexão e tente novamente.`;
                
                try {
                    if (typeof window.__toast === 'function') {
                        window.__toast(criticalMessage.replace(/\n+/g, ' • '), 'error', { duration: 0 });
                    } else if (window.Utils && window.Utils.showToast) {
                        window.Utils.showToast(criticalMessage.replace(/\n+/g, ' • '), 'error');
                    }
                } catch (_) {}
                throw new Error(`Falha crítica no salvamento: Firebase e localStorage falharam`);
            }
        }
        
        return true;
        
    } catch (error) {
        console.error(`❌ Erro geral ao salvar ${key}:`, error);
        
        // ✅ ÚLTIMO RECURSO: TENTAR LOCALSTORAGE SEM NOTIFICAÇÃO
        try {
            const serializedData = JSON.stringify(data);
            writeLocalStorageValue(key, serializedData);
            console.log(`🆘 ${key} salvo no localStorage como último recurso`);
            
            // Notificar sobre salvamento de emergência
                if (key === 'romaneiosPct') {
                    try {
                        const msg = `SALVAMENTO DE EMERGÊNCIA • Seus dados foram salvos localmente, mas podem não estar sincronizados com o servidor. • Erro: ${error.message}`;
                        if (typeof window.__toast === 'function') window.__toast(msg, 'warning', { duration: 6000 });
                        else if (window.Utils && window.Utils.showToast) window.Utils.showToast(msg, 'warning');
                    } catch (_) {}
                }
            
            return true;
        } catch (lastResortError) {
            console.error(`❌ Último recurso falhou:`, lastResortError);
            
            // Notificar falha total
            try {
                const msg = `❌ FALHA TOTAL NO SALVAMENTO • Não foi possível salvar os dados em lugar algum. • Erro: ${error.message} • Por favor, anote os dados e tente novamente.`;
                if (typeof window.__toast === 'function') window.__toast(msg, 'error', { duration: 0 });
                else if (window.Utils && window.Utils.showToast) window.Utils.showToast(msg, 'error');
            } catch (_) {}
            
            throw error; // Lançar o erro original
        }
    }
}

// ✅ FUNÇÃO GETDATA CORRIGIDA: Prioriza Firebase sobre localStorage
async function getData(key) {
    console.log(`📂 Carregando dados de ${key}...`);
    
    try {
        // ✅ VALIDAÇÃO DA CHAVE
        if (!key || typeof key !== 'string') {
            console.error("❌ Chave inválida para carregamento");
            return [];
        }
        
        // ✅ PADRONIZAR CHAVE
        let finalKey = key;
        if (key === 'fornecedores' || key === 'clientesTora' || key === 'clientesPct') {
            finalKey = 'clients';
            console.log(`🔄 Redirecionando carregamento de '${key}' para 'clients'`);
        }
        if (key === 'species' || key === 'especiesPct') {
            finalKey = 'especies';
            console.log(`🔄 Redirecionando carregamento de '${key}' para 'especies'`);
        }
        if (key === 'romaneiosPacotes' || key === 'pacotes') {
            finalKey = 'romaneiosPct';
            console.log(`🔄 Redirecionamento de '${key}' para 'romaneiosPct'`);
        }
        
        let data = null;
        let firebaseSuccess = false;
        
        // ✅ TENTAR CARREGAR DO FIREBASE PRIMEIRO (PRIORIDADE)
        if (window.firebaseService && typeof window.firebaseService.loadFromFirebase === 'function') {
            try {
                console.log(`🔥 Tentando carregar ${finalKey} do Firebase...`);
                let result;
                if (typeof window.firebaseService.loadData === 'function') {
                    let options = {};
                    if (finalKey === 'romaneiosTora' || finalKey === 'romaneiosPct') {
                        options = { limitToLast: 50, orderByChild: 'timestamp' };
                        console.log(`⚡ Aplicação de Paginação (BLAZE LIMIT PCT): ${finalKey}`);
                    }
                    result = await window.firebaseService.loadData(finalKey, options);
                } else {
                    result = await window.firebaseService.loadFromFirebase(finalKey);
                }
                
                if (result && result.success && result.data !== null && result.data !== undefined) {
                    data = result.data;
                    firebaseSuccess = true;
                    console.log(`✅ ${finalKey} carregado do Firebase:`, Array.isArray(data) ? `${data.length} itens` : 'dados válidos');
                    
                    // ✅ ATUALIZAR CACHE LOCAL COM DADOS MAIS RECENTES DO FIREBASE
                    try {
                        writeLocalStorageValue(finalKey, JSON.stringify(data));
                        console.log(`✅ Cache local de ${finalKey} atualizado com dados do Firebase`);
                    } catch (cacheError) {
                        console.warn(`⚠️ Erro ao atualizar cache local:`, cacheError);
                    }
                    
                } else if (result && result.data === null) {
                    console.log(`⚠️ ${finalKey} está vazio no Firebase`);
                    data = [];
                    firebaseSuccess = true;
                } else {
                    console.warn(`⚠️ ${finalKey} não encontrado no Firebase ou dados inválidos`);
                    // Não definir firebaseSuccess = true aqui, para tentar localStorage
                }
            } catch (firebaseError) {
                console.error(`❌ Erro ao carregar ${finalKey} do Firebase: ${firebaseError.message}`);
                // Continuar para tentar localStorage
            }
        } else {
            console.warn(`⚠️ Firebase Service não disponível para carregamento de ${finalKey}`);
        }
        
        // ✅ SE FIREBASE FALHOU, TENTAR CACHE LOCAL COMO FALLBACK
        if (!firebaseSuccess) {
            try {
                console.log(`🔄 Tentando carregar ${finalKey} do cache local...`);
                const localData = readLocalStorageValue(finalKey) || readLocalStorageValue(key);
                
                if (localData) {
                    try {
                        data = JSON.parse(localData);
                        console.log(`📦 ${finalKey} carregado do cache local:`, Array.isArray(data) ? `${data.length} itens` : 'dados válidos');
                        
                        // ✅ AVISAR USUÁRIO QUE ESTÁ USANDO DADOS OFFLINE (APENAS PARA ROMANEIOS)
                        if (finalKey === 'romaneiosPct' && Array.isArray(data) && data.length > 0) {
                            console.warn(`⚠️ ATENÇÃO: Carregando romaneios do cache local. Dados podem estar desatualizados.`);
                            // Não mostrar alerta aqui para não incomodar o usuário constantemente
                            // Apenas loggar para debug
                        }
                        
                    } catch (parseError) {
                        console.error(`❌ Erro ao parsear ${finalKey} do cache local:`, parseError);
                        removeLocalStorageValue(finalKey);
                        data = [];
                    }
                } else {
                    console.log(`📱 ${finalKey} não encontrado no cache local`);
                    data = [];
                }
            } catch (localError) {
                console.error(`❌ Erro ao acessar cache local para ${finalKey}:`, localError);
                data = [];
            }
        }
        
        // ✅ GARANTIR RETORNO VÁLIDO COMO ARRAY
        if (!Array.isArray(data)) {
            if (data === null || data === undefined) {
                console.log(`📋 ${finalKey} é null/undefined, retornando array vazio`);
                data = [];
            } else if (typeof data === 'object') {
                console.warn(`⚠️ Dados de ${finalKey} são objeto, convertendo para array...`);
                data = Object.keys(data).map(key => ({ 
                    id: key, 
                    ...data[key] 
                }));
                console.log(`✅ Convertido para array com ${data.length} itens`);
            } else {
                console.warn(`⚠️ Dados de ${finalKey} são tipo ${typeof data}, retornando array vazio`);
                data = [];
            }
        }
        
        console.log(`📋 Retornando ${data.length} itens para ${key} (fonte: ${firebaseSuccess ? 'Firebase' : 'localStorage'})`);
        return data;
        
    } catch (error) {
        console.error(`❌ Erro geral ao carregar ${key}:`, error);
        return [];
    }
}

// Função para formatar input de moeda
function formatCurrencyInput(input) {
    try {
        if (!input || !input.value) {
            return;
        }
        
        // Remover todos os caracteres não numéricos
        let value = input.value.replace(/\D/g, '');
        if (value.length === 0) {
            input.value = '';
            return;
        }
        
        // Converter para centavos
        value = parseInt(value);
        
        // Formatar como moeda brasileira
        const formattedValue = (value / 100).toLocaleString('pt-BR', {
            style: 'currency',
            currency: 'BRL',
            minimumFractionDigits: 2,
            maximumFractionDigits: 2
        });
        
        input.value = formattedValue;
    } catch (error) {
        console.error("Erro ao formatar valor monetário:", error);
        // Não alterar o input em caso de erro
    }
}

// Função para converter valor formatado como moeda para número
function parseCurrencyValue(value) {
    if (!value) return 0;
    
    try {
        // Remover símbolo de moeda (R$) e espaços
        let numericValue = value.replace(/R\$\s*/g, '');
        
        // Substituir ponto por nada (formato brasileiro usa ponto como separador de milhar)
        numericValue = numericValue.replace(/\./g, '');
        
        // Substituir vírgula por ponto (formato brasileiro usa vírgula como separador decimal)
        numericValue = numericValue.replace(',', '.');
        
        // Converter para número
        const result = parseFloat(numericValue);
        
        // Verificar se é um número válido
        if (isNaN(result)) {
            console.error("Falha ao converter valor monetário:", value);
            return 0;
        }
        
        return result;
    } catch (error) {
        console.error("Erro ao converter valor monetário:", value, error);
        return 0;
    }
}

// Função para calcular o volume (só criar se não existir)
if (typeof window.calcularVolume !== 'function') {
    // Se não existe, criar nossa própria implementação
    window.calcularVolume = function(comprimento, largura, espessura) {
        // ✅ FÓRMULA UNIFICADA: Volume individual sem quantidade
        const comp = parseFloat(comprimento) || 0;
        const larg = parseFloat(largura) || 0;
        const esp = parseFloat(espessura) || 0;
        
        // Dividir por 1.000.000 para converter cm³ para m³
        return (comp * larg * esp) / 1000000;
    };
    
    console.log("✅ calcularVolume criada e exposta globalmente no romaneiopct_funcoes.js");
} else {
    console.log("✅ calcularVolume já existe globalmente - reutilizando no romaneiopct_funcoes.js");
}

// Função para calcular o valor total
function calcularValorTotal(volume, valorUnitario) {
    return volume * valorUnitario;
}

// Função para formatar um valor monetário
function formatCurrency(value) {
    if (value === undefined || value === null) return 'R$ 0,00';
    
    // Garantir que value seja um número
    const numValue = typeof value === 'string' ? parseFloat(value.replace(/[^\d.,]/g, '').replace(',', '.')) : parseFloat(value);
    
    // Verificar se é um número válido após a conversão
    if (isNaN(numValue)) return 'R$ 0,00';
    
    // Formatar como moeda
    return numValue.toLocaleString('pt-BR', {
        style: 'currency',
        currency: 'BRL'
    });
}

// Função para mostrar/esconder menu de impressão
function togglePrintMenu(button) {
    console.log("Alternando menu de impressão");
    
    const menu = button.nextElementSibling;
    if (!menu) {
        console.error("Menu dropdown não encontrado");
        return;
    }
    
    const allMenus = document.querySelectorAll('.print-menu');
    
    // Fechar todos os outros menus
    allMenus.forEach(m => {
        if (m !== menu) {
            m.classList.remove('show');
        }
    });
    
    // Alternar a visibilidade do menu atual
    menu.classList.toggle('show');
    
    // Fechar ao clicar fora
    document.addEventListener('click', function closeMenu(e) {
        if (!button.contains(e.target) && !menu.contains(e.target)) {
            menu.classList.remove('show');
            document.removeEventListener('click', closeMenu);
        }
    }, { once: true });
}

// ✅ FUNÇÃO DE DIAGNÓSTICO E SINCRONIZAÇÃO DE DADOS
async function diagnosticarESincronizarDados() {
    console.log('🔍 === DIAGNÓSTICO DE SINCRONIZAÇÃO DE DADOS ===');
    
    const diagnostico = {
        firebase: {
            disponivel: false,
            romaneios: 0,
            clientes: 0,
            especies: 0
        },
        localStorage: {
            romaneios: 0,
            clientes: 0,
            especies: 0
        },
        problemas: [],
        acoesTomadas: []
    };
    
    try {
        // ✅ VERIFICAR DISPONIBILIDADE DO FIREBASE
        diagnostico.firebase.disponivel = !!(window.firebaseService && 
            typeof window.firebaseService.loadFromFirebase === 'function' &&
            typeof window.firebaseService.saveToFirebase === 'function');
        
        console.log(`🔥 Firebase disponível: ${diagnostico.firebase.disponivel}`);
        
        // ✅ VERIFICAR DADOS NO LOCALSTORAGE (Firebase primeiro, localStorage como fallback)
        console.log('📦 PCT: Verificando dados no localStorage...');
        
        const localRomaneios = readLocalStorageValue('romaneiosPct');
        const localClientes = readLocalStorageValue('clients');
        const localEspecies = readLocalStorageValue('especies');
        
        if (localRomaneios) {
            try {
                const romaneios = JSON.parse(localRomaneios);
                if (Array.isArray(romaneios) && romaneios.length > 0) {
                    // ✅ VALIDAR DADOS DO LOCALSTORAGE
                    const romaneiosValidos = romaneios.filter(item => item && (item.cliente || item.numero || item.id));
                    diagnostico.localStorage.romaneios = romaneiosValidos.length;
                    console.log(`✅ PCT: ${romaneiosValidos.length} romaneios válidos no localStorage`);
                } else if (typeof romaneios === 'object' && Object.keys(romaneios).length > 0) {
                    const romaneiosValidos = Object.values(romaneios).filter(item => item && (item.cliente || item.numero || item.id));
                    diagnostico.localStorage.romaneios = romaneiosValidos.length;
                    console.log(`✅ PCT: ${romaneiosValidos.length} romaneios válidos no localStorage (convertidos)`);
                } else {
                    diagnostico.localStorage.romaneios = 0;
                    console.log('ℹ️ PCT: Nenhum romaneio válido no localStorage');
                }
            } catch (e) {
                console.error('❌ PCT: Erro ao parsear romaneios do localStorage:', e);
                diagnostico.problemas.push('Erro ao parsear romaneios do localStorage');
                diagnostico.localStorage.romaneios = 0;
            }
        } else {
            diagnostico.localStorage.romaneios = 0;
            console.log('ℹ️ PCT: Nenhum romaneio encontrado no localStorage');
        }
        
        if (localClientes) {
            try {
                const clientes = JSON.parse(localClientes);
                diagnostico.localStorage.clientes = Array.isArray(clientes) ? clientes.length : 0;
                console.log(`✅ PCT: ${diagnostico.localStorage.clientes} clientes no localStorage`);
            } catch (e) {
                console.error('❌ PCT: Erro ao parsear clientes do localStorage:', e);
                diagnostico.problemas.push('Erro ao parsear clientes do localStorage');
                diagnostico.localStorage.clientes = 0;
            }
        } else {
            diagnostico.localStorage.clientes = 0;
            console.log('ℹ️ PCT: Nenhum cliente encontrado no localStorage');
        }
        
        if (localEspecies) {
            try {
                const especies = JSON.parse(localEspecies);
                diagnostico.localStorage.especies = Array.isArray(especies) ? especies.length : 0;
                console.log(`✅ PCT: ${diagnostico.localStorage.especies} espécies no localStorage`);
            } catch (e) {
                console.error('❌ PCT: Erro ao parsear espécies do localStorage:', e);
                diagnostico.problemas.push('Erro ao parsear espécies do localStorage');
                diagnostico.localStorage.especies = 0;
            }
        } else {
            diagnostico.localStorage.especies = 0;
            console.log('ℹ️ PCT: Nenhuma espécie encontrada no localStorage');
        }
        
        // ✅ VERIFICAR DADOS NO FIREBASE (SE DISPONÍVEL)
        if (diagnostico.firebase.disponivel) {
            try {
                console.log('🔥 PCT: Verificando dados no Firebase...');
                
                // ✅ Verificar romaneios no Firebase
                const resultRomaneios = await window.firebaseService.loadFromFirebase('romaneios/pct');
                if (resultRomaneios && resultRomaneios.success && resultRomaneios.data) {
                    const firebaseData = resultRomaneios.data;
                    if (Array.isArray(firebaseData) && firebaseData.length > 0) {
                        const romaneiosValidos = firebaseData.filter(item => item && (item.cliente || item.numero || item.id));
                        diagnostico.firebase.romaneios = romaneiosValidos.length;
                        console.log(`✅ PCT: ${romaneiosValidos.length} romaneios válidos encontrados no Firebase`);
                    } else if (typeof firebaseData === 'object' && Object.keys(firebaseData).length > 0) {
                        const romaneiosValidos = Object.values(firebaseData).filter(item => item && (item.cliente || item.numero || item.id));
                        diagnostico.firebase.romaneios = romaneiosValidos.length;
                        console.log(`✅ PCT: ${romaneiosValidos.length} romaneios válidos encontrados no Firebase (convertidos)`);
                    } else {
                        diagnostico.firebase.romaneios = 0;
                        console.log('ℹ️ PCT: Nenhum romaneio válido encontrado no Firebase');
                    }
                } else {
                    diagnostico.firebase.romaneios = 0;
                    console.log('ℹ️ PCT: Firebase retornou dados vazios ou inválidos para romaneios');
                }
                
                // ✅ Verificar clientes no Firebase
                const resultClientes = await window.firebaseService.loadFromFirebase('clients');
                if (resultClientes && resultClientes.success && resultClientes.data) {
                    const clientes = Array.isArray(resultClientes.data) ? resultClientes.data : 
                                    Object.keys(resultClientes.data || {});
                    diagnostico.firebase.clientes = clientes.length;
                    console.log(`✅ PCT: ${clientes.length} clientes encontrados no Firebase`);
                } else {
                    diagnostico.firebase.clientes = 0;
                    console.log('ℹ️ PCT: Firebase retornou dados vazios ou inválidos para clientes');
                }
                
                // ✅ Verificar espécies no Firebase
                const resultEspecies = await window.firebaseService.loadFromFirebase('especies');
                if (resultEspecies && resultEspecies.success && resultEspecies.data) {
                    const especies = Array.isArray(resultEspecies.data) ? resultEspecies.data : 
                                    Object.keys(resultEspecies.data || {});
                    diagnostico.firebase.especies = especies.length;
                    console.log(`✅ PCT: ${especies.length} espécies encontradas no Firebase`);
                } else {
                    diagnostico.firebase.especies = 0;
                    console.log('ℹ️ PCT: Firebase retornou dados vazios ou inválidos para espécies');
                }
                
            } catch (firebaseError) {
                console.error('❌ PCT: Erro ao acessar Firebase:', firebaseError);
                diagnostico.problemas.push(`Erro ao acessar Firebase: ${firebaseError.message}`);
            }
        }
        
        // ✅ IDENTIFICAR PROBLEMAS DE SINCRONIZAÇÃO
        if (diagnostico.localStorage.romaneios > 0 && diagnostico.firebase.romaneios === 0) {
            diagnostico.problemas.push(`${diagnostico.localStorage.romaneios} romaneios encontrados apenas no localStorage`);
        }
        
        if (diagnostico.localStorage.clientes > 0 && diagnostico.firebase.clientes === 0) {
            diagnostico.problemas.push(`${diagnostico.localStorage.clientes} clientes encontrados apenas no localStorage`);
        }
        
        if (diagnostico.localStorage.especies > 0 && diagnostico.firebase.especies === 0) {
            diagnostico.problemas.push(`${diagnostico.localStorage.especies} espécies encontradas apenas no localStorage`);
        }
        
        // ✅ TENTAR SINCRONIZAR DADOS DO LOCALSTORAGE PARA FIREBASE
        if (diagnostico.firebase.disponivel && diagnostico.problemas.length > 0) {
            console.log('🔄 Tentando sincronizar dados do localStorage para Firebase...');
            
            // ✅ Sincronizar romaneios (Firebase primeiro, localStorage como fallback)
            if (diagnostico.localStorage.romaneios > 0 && diagnostico.firebase.romaneios === 0) {
                try {
                    console.log('🔄 PCT: Sincronizando romaneios do localStorage para Firebase...');
                    const romaneios = JSON.parse(readLocalStorageValue('romaneiosPct') || '[]');
                    
                    if (Array.isArray(romaneios) && romaneios.length > 0) {
                        // ✅ VALIDAR DADOS ANTES DE SINCRONIZAR
                        const romaneiosValidos = romaneios.filter(item => item && (item.cliente || item.numero || item.id));
                        console.log(`✅ PCT: ${romaneiosValidos.length} romaneios válidos para sincronização`);
                        
                        // ✅ SALVAR POR REGISTRO PARA EVITAR SOBRESCRITA
                        let okCount = 0;
                        for (const reg of romaneiosValidos) {
                            if (!reg || !reg.id) continue;
                            const payload = { ...reg };
                            Object.keys(payload).forEach(k => { if (payload[k] === undefined) delete payload[k]; });
                            const res = await window.firebaseService.saveToFirebase('romaneiosPct', String(reg.id), payload);
                            if (res && res.success) okCount++;
                        }
                        if (okCount > 0) {
                            diagnostico.acoesTomadas.push(`${okCount} romaneios sincronizados para Firebase`);
                            console.log('✅ PCT: Sincronização de romaneios concluída com sucesso');
                        } else {
                            throw new Error('Falha na sincronização por registro');
                        }
                    } else {
                        console.warn('⚠️ PCT: Nenhum romaneio válido encontrado no localStorage para sincronização');
                    }
                } catch (e) {
                    console.error('❌ PCT: Erro ao sincronizar romaneios:', e);
                    diagnostico.problemas.push(`Erro ao sincronizar romaneios: ${e.message}`);
                }
            }
            
            // Sincronizar clientes (por registro - evitar sobrescrita da coleção)
            if (diagnostico.localStorage.clientes > 0 && diagnostico.firebase.clientes === 0) {
                try {
                    const clientes = JSON.parse(readLocalStorageValue('clients')) || [];
                    if (Array.isArray(clientes) && clientes.length > 0) {
                        let ok = 0;
                        for (const c of clientes) {
                            if (!c || !c.id) continue;
                            const payload = { ...c };
                            Object.keys(payload).forEach(k => { if (payload[k] === undefined) delete payload[k]; });
                            const res = await window.firebaseService.saveToFirebase('clients', String(c.id), payload);
                            if (res && res.success) ok++;
                        }
                        if (ok > 0) diagnostico.acoesTomadas.push(`${ok} clientes sincronizados para Firebase`);
                    }
                } catch (e) {
                    diagnostico.problemas.push(`Erro ao sincronizar clientes: ${e.message}`);
                }
            }
            
            // Sincronizar espécies
            if (diagnostico.localStorage.especies > 0 && diagnostico.firebase.especies === 0) {
                try {
                    const especies = JSON.parse(readLocalStorageValue('especies') || '[]');
                    let ok = 0;
                    for (let i = 0; i < especies.length; i += 1) {
                        const item = especies[i];
                        if (!item || typeof item !== 'object') continue;
                        const id = String(item.firebaseKey || item.key || item.id || `ESP_${Date.now()}_${i}`).trim();
                        const payload = window.SiswebSpecies && typeof window.SiswebSpecies.toCanonicalRecord === 'function'
                            ? window.SiswebSpecies.toCanonicalRecord({ ...item, id }, i, { id })
                            : { ...item, id };
                        const result = await window.firebaseService.saveToFirebase('especies', id, payload);
                        if (result && result.success) ok++;
                    }
                    if (ok > 0) {
                        diagnostico.acoesTomadas.push(`${ok} espécies sincronizadas para Firebase`);
                    }
                } catch (e) {
                    diagnostico.problemas.push(`Erro ao sincronizar espécies: ${e.message}`);
                }
            }
        }
        
        // ✅ EXIBIR RELATÓRIO
        console.log('📊 === RELATÓRIO DE DIAGNÓSTICO ===');
        console.log('🔥 Firebase:', diagnostico.firebase);
        console.log('📦 localStorage:', diagnostico.localStorage);
        console.log('⚠️ Problemas:', diagnostico.problemas);
        console.log('✅ Ações tomadas:', diagnostico.acoesTomadas);
        
        // ✅ NOTIFICAR USUÁRIO SE NECESSÁRIO
        if (diagnostico.problemas.length > 0 || diagnostico.acoesTomadas.length > 0) {
            let mensagem = '🔍 DIAGNÓSTICO DE SINCRONIZAÇÃO\n\n';
            
            if (diagnostico.firebase.disponivel) {
                mensagem += `📊 DADOS NO SERVIDOR:\n`;
                mensagem += `• Romaneios: ${diagnostico.firebase.romaneios}\n`;
                mensagem += `• Clientes: ${diagnostico.firebase.clientes}\n`;
                mensagem += `• Espécies: ${diagnostico.firebase.especies}\n\n`;
            } else {
                mensagem += `⚠️ SERVIDOR INDISPONÍVEL\n\n`;
            }
            
            mensagem += `📱 DADOS LOCAIS:\n`;
            mensagem += `• Romaneios: ${diagnostico.localStorage.romaneios}\n`;
            mensagem += `• Clientes: ${diagnostico.localStorage.clientes}\n`;
            mensagem += `• Espécies: ${diagnostico.localStorage.especies}\n\n`;
            
            if (diagnostico.problemas.length > 0) {
                mensagem += `⚠️ PROBLEMAS ENCONTRADOS:\n`;
                diagnostico.problemas.forEach(problema => {
                    mensagem += `• ${problema}\n`;
                });
                mensagem += '\n';
            }
            
            if (diagnostico.acoesTomadas.length > 0) {
                mensagem += `✅ AÇÕES REALIZADAS:\n`;
                diagnostico.acoesTomadas.forEach(acao => {
                    mensagem += `• ${acao}\n`;
                });
                mensagem += '\n';
            }
            
            console.log(mensagem);
            
            // Mostrar alerta apenas se houver problemas críticos
            if (diagnostico.localStorage.romaneios > 0 && diagnostico.firebase.romaneios === 0 && diagnostico.firebase.disponivel) {
                if (confirm(mensagem + 'Deseja tentar sincronizar os dados novamente?')) {
                    return await diagnosticarESincronizarDados();
                }
            }
        }
        
        return diagnostico;
        
    } catch (error) {
        console.error('❌ Erro no diagnóstico:', error);
        diagnostico.problemas.push(`Erro no diagnóstico: ${error.message}`);
        return diagnostico;
    }
}

// ✅ FUNÇÃO PARA FORÇAR SINCRONIZAÇÃO DE ROMANEIOS
async function forcarSincronizacaoRomaneios() {
    console.log('🔄 === FORÇANDO SINCRONIZAÇÃO DE ROMANEIOS ===');
    
    try {
        // Verificar dados locais
        const localRomaneios = readLocalStorageValue('romaneiosPct');
        if (!localRomaneios) {
            try {
                const msg = 'Nenhum romaneio encontrado no armazenamento local.';
                if (typeof window.__toast === 'function') window.__toast(msg, 'warning');
                else if (window.Utils && window.Utils.showToast) window.Utils.showToast(msg, 'warning');
            } catch (_) {}
            return false;
        }
        
        const romaneios = JSON.parse(localRomaneios);
        if (!Array.isArray(romaneios) || romaneios.length === 0) {
            try {
                const msg = 'Nenhum romaneio válido encontrado no armazenamento local.';
                if (typeof window.__toast === 'function') window.__toast(msg, 'warning');
                else if (window.Utils && window.Utils.showToast) window.Utils.showToast(msg, 'warning');
            } catch (_) {}
            return false;
        }
        
        // Verificar Firebase
        if (!window.firebaseService || typeof window.firebaseService.saveToFirebase !== 'function') {
            try {
                const msg = 'Firebase não está disponível. Verifique sua conexão com a internet.';
                if (typeof window.__toast === 'function') window.__toast(msg, 'error', { duration: 5000 });
                else if (window.Utils && window.Utils.showToast) window.Utils.showToast(msg, 'error');
            } catch (_) {}
            return false;
        }
        
        // Confirmar com usuário
        if (!confirm(`Encontrados ${romaneios.length} romaneios no armazenamento local.\n\nDeseja sincronizar todos com o servidor?`)) {
            return false;
        }
        
        // Tentar sincronizar
        console.log(`🔄 Sincronizando ${romaneios.length} romaneios...`);
        let okCount = 0; let failCount = 0;
        for (const reg of romaneios) {
            try {
                if (!reg || !reg.id) continue;
                const payload = { ...reg };
                Object.keys(payload).forEach(k => { if (payload[k] === undefined) delete payload[k]; });
                const res = await window.firebaseService.saveToFirebase('romaneiosPct', String(reg.id), payload);
                if (res && res.success) okCount++; else failCount++;
            } catch (e) {
                console.warn('⚠️ Falha ao sincronizar registro:', reg?.id, e.message);
                failCount++;
            }
        }
        if (okCount > 0 && failCount === 0) {
            try {
                const msg = `Sucesso! ${okCount} romaneio(s) sincronizados com o servidor.`;
                if (typeof window.__toast === 'function') window.__toast(msg, 'success');
                else if (window.Utils && window.Utils.showToast) window.Utils.showToast(msg, 'success');
            } catch (_) {}
            console.log('✅ Sincronização por registro concluída com sucesso');
            return true;
        } else if (okCount > 0) {
            try {
                const msg = `Parcial: ${okCount} sincronizado(s), ${failCount} falha(s).`;
                if (typeof window.__toast === 'function') window.__toast(msg, 'warning');
                else if (window.Utils && window.Utils.showToast) window.Utils.showToast(msg, 'warning');
            } catch (_) {}
            return true;
        } else {
            try {
                const msg = `Falha na sincronização.`;
                if (typeof window.__toast === 'function') window.__toast(msg, 'error', { duration: 5000 });
                else if (window.Utils && window.Utils.showToast) window.Utils.showToast(msg, 'error');
            } catch (_) {}
            return false;
        }
        
    } catch (error) {
        console.error('❌ Erro na sincronização forçada:', error);
        try {
            const msg = `Erro na sincronização: ${error.message}`;
            if (typeof window.__toast === 'function') window.__toast(msg, 'error', { duration: 5000 });
            else if (window.Utils && window.Utils.showToast) window.Utils.showToast(msg, 'error');
        } catch (_) {}
        return false;
    }
}

// ✅ EXPOR FUNÇÕES PARA USO GLOBAL
window.diagnosticarESincronizarDados = diagnosticarESincronizarDados;
window.forcarSincronizacaoRomaneios = forcarSincronizacaoRomaneios;

// Exportar funções para o escopo global
window.carregarClientes = carregarClientes;
window.carregarEspecies = carregarEspecies;
if (typeof window.formatCurrencyInput !== 'function') { window.formatCurrencyInput = formatCurrencyInput; }
if (typeof window.parseCurrencyValue !== 'function') { window.parseCurrencyValue = parseCurrencyValue; }
window.calcularVolume = window.calcularVolume;
window.calcularValorTotal = calcularValorTotal;
if (typeof window.formatCurrency !== 'function') { window.formatCurrency = formatCurrency; }
window.togglePrintMenu = togglePrintMenu;
