/**
 * Serviço centralizado para gerenciamento de clientes
 * Este arquivo fornece funções unificadas para operações com clientes no sistema
 * 
 * IMPORTANTE: Este serviço utiliza Firebase como fonte primária
 * e localStorage apenas como backup de emergência
 */

// Chave de armazenamento unificada
const CLIENT_STORAGE_KEY = 'clients';

// Cache para melhorar desempenho
let clientsCache = null;
let cacheTimestamp = 0;
const CACHE_MAX_AGE = 2000; // 2 segundos

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
            if (ns && ns !== base) {
                keys.push(ns);
                return [...new Set(keys)];
            }
        } else {
            const companyId = resolveCompanyId();
            if (companyId && !/^companies\//.test(base) && !/^users\//.test(base)) {
                keys.push(`companies/${companyId}/${base}`);
                return [...new Set(keys)];
            }
        }
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
    try {
        if (window.SiswebStorage && typeof window.SiswebStorage.write === 'function') {
            window.SiswebStorage.write(key, data);
            return;
        }
    } catch (_) {}
    const payload = typeof data === 'string' ? data : JSON.stringify(data);
    for (const k of getLocalStorageKeys(key)) {
        localStorage.setItem(k, payload);
    }
}

function removeLocalStorageValue(key) {
    for (const k of getLocalStorageKeys(key)) {
        localStorage.removeItem(k);
    }
}

async function ensureAuthenticated() {
    try {
        const svc = window.firebaseService;
        if (!svc || typeof svc.isFirebaseOperational !== 'function' || !svc.authService) {
            throw new Error('Serviço de autenticação indisponível');
        }
        const status = svc.isFirebaseOperational();
        if (!status.operational) {
            throw new Error('Firebase não operacional');
        }
        let user = await svc.authService.getCurrentUser();
        if (!user && typeof window !== 'undefined' && window.firebaseAuthUser) {
            user = window.firebaseAuthUser;
        }
        if (!user && window.ENABLE_ANON_AUTH === true) {
            await new Promise(r => setTimeout(r, 1000));
            user = await svc.authService.getCurrentUser();
        }
        if (!user) {
            throw new Error('Usuário não autenticado');
        }
        return user;
    } catch (e) {
        throw e;
    }
}

/**
 * Obtém todos os clientes disponíveis - PRIORIDADE 100% FIREBASE
 * @param {boolean} [forceRefresh=false] Se true, ignora o cache e obtém dados frescos
 * @returns {Array} Lista de clientes
 */
async function getClients(forceRefresh = false) {
    // Verificar se podemos usar o cache
    const now = Date.now();
    if (!forceRefresh && clientsCache && (now - cacheTimestamp < CACHE_MAX_AGE)) {
        console.log("📋 Usando cache de clientes");
        // ✅ Garantir que o cache é um array
        if (Array.isArray(clientsCache)) {
            return clientsCache;
        } else {
            console.warn("⚠️ Cache corrupto (não é array), forçando reload");
            clientsCache = null;
        }
    }
    
    try {
        let clients = [];
        
        // 🔥 PRIORIDADE ABSOLUTA: Firebase (sistema online)
        if (window.firebaseService && typeof window.firebaseService.loadFromFirebase === 'function') {
            try {
                const upper = await window.firebaseService.loadFromFirebase('clients');
                const toArray = (data) => {
                    if (!data) return [];
                    if (Array.isArray(data)) return data;
                    if (typeof data === 'object') {
                        return Object.keys(data)
                            .filter(key => key !== '_metadata')
                            .map(itemKey => {
                                const val = data[itemKey];
                                if (!val || typeof val !== 'object') return null; // Ignorar entradas inválidas (como IDs salvos incorretamente)
                                return {
                                    id: (val.id) ? String(val.id) : String(itemKey),
                                    ...val
                                };
                            })
                            .filter(item => item !== null); // Remover nulos
                    }
                    return [];
                };
                const upperArr = upper && upper.success ? toArray(upper.data) : [];
                let combined = upperArr;
                if (!forceRefresh) {
                    const aStr = readLocalStorageValue('clients');
                    const bStr = readLocalStorageValue('clientesPct');
                    const cStr = readLocalStorageValue('clientes');
                    const aArr = aStr && aStr.trim() !== '' ? (Array.isArray(JSON.parse(aStr)) ? JSON.parse(aStr) : []) : [];
                    const bArr = bStr && bStr.trim() !== '' ? (Array.isArray(JSON.parse(bStr)) ? JSON.parse(bStr) : []) : [];
                    const cArr = cStr && cStr.trim() !== '' ? (Array.isArray(JSON.parse(cStr)) ? JSON.parse(cStr) : []) : [];
                    combined = upperArr.concat(aArr, bArr, cArr);
                }
                const byId = new Map();
                clients = [];
                for (const item of combined) {
                    if (!item) continue;
                    const normalizedItem = normalizeClient(item);
                    const id = String(normalizedItem.id || '').trim();
                    if (id && !byId.has(id)) { byId.set(id, true); clients.push(normalizedItem); }
                }
                clients = clients.filter(c => String(c.name || c.nome || '').trim());
                try { writeLocalStorageValue(CLIENT_STORAGE_KEY, clients); } catch (_) {}
                clientsCache = clients;
                cacheTimestamp = now;
                return clients;
            } catch (firebaseError) {
                console.warn("⚠️ Firebase temporariamente indisponível:", firebaseError.message);
            }
        } else {
            console.warn("⚠️ FirebaseService não disponível ou função loadFromFirebase não encontrada");
        }
        
        // 📂 Backup de emergência: localStorage (se Firebase retornar vazio ou indisponível)
        console.warn("ℹ️ Usando backup local (clients / clientesPct / clientes)");
        try {
            const aStr = readLocalStorageValue('clients');
            const bStr = readLocalStorageValue('clientesPct');
            const cStr = readLocalStorageValue('clientes');
            const a = aStr && aStr.trim() !== '' ? JSON.parse(aStr) : [];
            const b = bStr && bStr.trim() !== '' ? JSON.parse(bStr) : [];
            const c = cStr && cStr.trim() !== '' ? JSON.parse(cStr) : [];
            const combined = []
                .concat(Array.isArray(a) ? a : [], Array.isArray(b) ? b : [], Array.isArray(c) ? c : []);
            const byId = new Map();
            const byName = new Set();
            const out = [];
            for (const item of combined) {
                if (!item) continue;
                const normalizedItem = normalizeClient(item);
                const id = String(normalizedItem.id || '').trim();
                const name = String(normalizedItem.name || normalizedItem.nome || '').toLowerCase().trim();
                if (id && !byId.has(id)) { byId.set(id, true); out.push(normalizedItem); if (name) byName.add(name); continue; }
                if (!id && name && !byName.has(name)) { byName.add(name); out.push(normalizedItem); }
            }
            clients = out.filter(c => String(c.name || c.nome || '').trim());
            console.log("📂 Clientes carregados do backup local:", clients.length);
        } catch (parseError) {
            console.error("❌ Erro ao ler backup local:", parseError);
            clients = [];
        }
        
        // Atualizar o cache
        clientsCache = clients;
        cacheTimestamp = now;

        return clients;
    } catch (error) {
        console.error("❌ Erro crítico ao obter clientes:", error);
        return [];
    }
}

/**
 * Salva a lista completa de clientes no Firebase
 * @param {Array} clients - Lista de clientes para salvar
 * @returns {Promise<boolean>} - True se salvou com sucesso
 */
async function saveClients(clients) {
    try {
        if (!Array.isArray(clients)) {
            console.error("❌ saveClients recebeu dados inválidos:", clients);
            return false;
        }
        
        await ensureAuthenticated();
        let firebaseSaveSuccess = false;
        
        // 🔥 SALVAR NO FIREBASE POR ITEM (clients/{id}) PARA ATENDER ÀS REGRAS
        try {
            if (window.firebaseService && typeof window.firebaseService.saveToFirebase === 'function') {
                let allOk = true;
                for (const client of clients) {
                    if (!client || !client.id) continue;
                    const res = await window.firebaseService.saveToFirebase('clients', String(client.id), client);
                    if (!res || !res.success) {
                        allOk = false;
                        console.warn('⚠️ Falha ao salvar cliente individualmente:', client?.id, res);
                    }
                }
                if (allOk) {
                    console.log("🔥 ✅ Clientes salvos no Firebase (por item clients/{id})", clients.length);
                    firebaseSaveSuccess = true;
                }
            } else if (window.unifiedFirebaseService) {
                const tenantId = resolveCompanyId();
                if (!tenantId) throw new Error('Tenant não identificado para salvar clientes');
                if (typeof window.unifiedFirebaseService.saveToFirebase === 'function') {
                    let allOk = true;
                    for (const c of clients) {
                        if (!c || !c.id) continue;
                        const r = await window.unifiedFirebaseService.saveToFirebase('clients', String(c.id), c);
                        if (!r || r.success === false) allOk = false;
                    }
                    if (!allOk) throw new Error('Falha parcial ao salvar clientes no serviço unificado');
                } else {
                    const path = `companies/${tenantId}/clients`;
                    const updates = {};
                    clients.forEach(c => { if (c && c.id) updates[`${path}/${String(c.id)}`] = c; });
                    if (window.unifiedFirebaseService.db && typeof window.unifiedFirebaseService.db.ref === 'function') {
                        await window.unifiedFirebaseService.db.ref().update(updates);
                    } else {
                        throw new Error('API Firebase indisponível para update em lote');
                    }
                }
                console.log("🔥 ✅ Clientes salvos via serviço unificado", clients.length);
                firebaseSaveSuccess = true;
            }
        } catch (firebaseError) {
            console.error("❌ Erro ao salvar no Firebase:", firebaseError.message);
            // Continua para backup local
        }
        
        // 📂 Backup local sempre (para cache e emergência)
        try {
            writeLocalStorageValue(CLIENT_STORAGE_KEY, clients);
            console.log("📂 Backup local atualizado");
        } catch (localError) {
            console.warn("⚠️ Erro ao salvar backup local:", localError.message);
        }
        
        // Atualizar cache se Firebase foi bem-sucedido
        if (firebaseSaveSuccess) {
            clientsCache = clients;
            cacheTimestamp = Date.now();
        }
        
        if (firebaseSaveSuccess) {
            return true;
        } else {
            console.error("❌ Falha crítica: Firebase indisponível para salvamento");
            throw new Error("Não foi possível salvar no Firebase. Verifique sua conexão.");
        }
        
    } catch (error) {
        console.error("❌ Erro crítico ao salvar clientes:", error);
        throw error;
    }
}

/**
 * Salva ou atualiza um único cliente - PRIORIDADE 100% FIREBASE
 * @param {Object} client Cliente para salvar/atualizar
 * @returns {Object} Cliente salvo com ID atualizado
 * @throws {Error} Lança erro se não conseguir salvar
 */
async function saveClient(client) {
    if (!client || (!client.name && !client.nome)) {
        throw new Error("Dados de cliente inválidos: nome é obrigatório");
    }
    
    try {
        await ensureAuthenticated();
        console.log("🔄 Iniciando salvamento de cliente:", client.name || client.nome);
        
        // Obter clientes existentes priorizando cache/local para reduzir latência
        const clients = await getClients(false);
        
        // Verificar se o cliente já existe (por ID)
        const existingIndex = client.id 
            ? clients.findIndex(c => String(c.id) === String(client.id))
            : -1;
        
        // Verificar se existe cliente com o mesmo nome, mas ID diferente
        const clientName = (client.name || client.nome || '').toLowerCase().trim();
        const nameConflictIndex = existingIndex === -1 && clientName 
            ? clients.findIndex(c => {
                const cName = ((c.name || c.nome || '')).toLowerCase().trim();
                return cName === clientName;
            })
            : -1;
            
        // Se encontrou cliente com mesmo nome mas ID diferente
        if (nameConflictIndex !== -1 && existingIndex === -1) {
            console.log(`⚠️ Cliente com nome "${clientName}" já existe`);
            
            const confirmOverwrite = window.confirm(
                `Um cliente com o nome "${client.name || client.nome}" já existe. ` +
                `Deseja atualizar o cadastro existente?`
            );
            
            if (confirmOverwrite) {
                // Usar o ID existente, mas atualizar os dados
                client.id = clients[nameConflictIndex].id;
                clients[nameConflictIndex] = normalizeClient(client);
                console.log("🔄 Atualizando cliente existente com novo dados");
            } else {
                // Usuário cancelou - não salvar
                throw new Error("Operação cancelada pelo usuário");
            }
        } else if (existingIndex !== -1) {
            // Atualizar cliente existente
            clients[existingIndex] = normalizeClient(client);
            console.log("🔄 Atualizando cliente existente:", client.id);
        } else {
            // Adicionar novo cliente
            if (!client.id) {
                client.id = Date.now().toString();
            }
            clients.push(normalizeClient(client));
            console.log("➕ Criando novo cliente:", client.id);
        }
        
        // Atualizar backup local e cache imediatamente para resposta rápida
        try {
            writeLocalStorageValue(CLIENT_STORAGE_KEY, clients);
            clientsCache = clients;
            cacheTimestamp = Date.now();
        } catch (_) {}

        // 🔥 Salvar no Firebase de forma assíncrona (não bloquear UI)
        try {
            saveClients(clients).catch((e) => console.warn('⚠️ Falha ao salvar no Firebase (assíncrono):', e?.message || e));
        } catch (_) {}
        
        const savedClient = normalizeClient(client);
        console.log("✅ Cliente salvo (local e sync em background):", savedClient.name || savedClient.nome);
        try { window.dispatchEvent(new CustomEvent('clients:updated', { detail: { client: savedClient } })); } catch (_) {}
        return savedClient;
        
    } catch (error) {
        console.error("❌ Erro ao salvar cliente:", error);
        
        // Propagar erro específico para a interface
        if (error.message === "Operação cancelada pelo usuário") {
            throw error;
        } else if (error.message.includes("Firebase")) {
            throw new Error("Erro de conexão. Verifique sua internet e tente novamente.");
        } else {
            throw new Error(`Erro ao salvar cliente: ${error.message}`);
        }
    }
}

/**
 * Exclui um cliente pelo ID
 * @param {string|number} id ID do cliente a ser excluído
 * @returns {boolean} True se o cliente foi excluído com sucesso
 */
async function deleteClient(id) {
    if (!id) {
        console.error("ID de cliente inválido para exclusão:", id);
        return false;
    }
    
    try {
        await ensureAuthenticated();
        // Garantir que estamos trabalhando com string para comparação consistente
        const clientId = String(id);
        
        // Obter clientes do armazenamento
        let clients = await getClients(true);
        
        // Verificar se o cliente existe
        const initialCount = clients.length;
        const removedClient = clients.find(c => String(c.id) === clientId) || null;
        
        // Filtrar lista para remover o cliente com o ID especificado
        clients = clients.filter(client => String(client.id) !== clientId);
        
        if (clients.length === initialCount) {
            console.warn(`Cliente com ID ${clientId} não encontrado para exclusão`);
            return false;
        }
        
        let remoteDeleted = false;
        try {
            if (window.firebaseService && typeof window.firebaseService.removeFromFirebase === 'function') {
                const res = await window.firebaseService.removeFromFirebase(`clients/${clientId}`);
                remoteDeleted = !!(res && res.success);
            }
        } catch (_) {}
        try {
            writeLocalStorageValue(CLIENT_STORAGE_KEY, clients);
            clientsCache = clients;
            cacheTimestamp = Date.now();
        } catch (_) {}
        if (remoteDeleted) {
            try {
                if (window.firebaseService && typeof window.firebaseService.removeFromFirebase === 'function') {
                    await window.firebaseService.removeFromFirebase(`clients/${clientId}`);
                    if (removedClient) {
                        const lower = await window.firebaseService.loadFromFirebase('clients');
                        const data = (lower && lower.success && lower.data) ? lower.data : null;
                        if (data && typeof data === 'object') {
                            const nameLower = String(removedClient.name || removedClient.nome || '').toLowerCase().trim();
                            for (const k of Object.keys(data)) {
                                const v = data[k];
                                const vn = String((v && (v.name || v.nome)) || '').toLowerCase().trim();
                                if (vn && nameLower && vn === nameLower) {
                                    await window.firebaseService.removeFromFirebase(`clients/${k}`);
                                }
                            }
                        }
                    }
                }
                try {
                    const purgeBy = (arr) => arr.filter(x => x && String(x.id) !== clientId && String((x.name||x.nome||'')).toLowerCase().trim() !== String((removedClient && (removedClient.name||removedClient.nome)||'')).toLowerCase().trim());
                    const lsKeys = ['clients','clientesPct','clientes'];
                    for (const k of lsKeys) {
                        for (const storageKey of getLocalStorageKeys(k)) {
                            const s = localStorage.getItem(storageKey);
                            if (s && s.trim() !== '') {
                                const a = JSON.parse(s);
                                if (Array.isArray(a)) {
                                    localStorage.setItem(storageKey, JSON.stringify(purgeBy(a)));
                                }
                            }
                        }
                    }
                } catch (_) {}
            } catch (_) {}
            return true;
        }
        return false;
    } catch (error) {
        console.error("Erro ao excluir cliente:", error);
        return false;
    }
}

/**
 * Busca um cliente pelo ID
 * @param {string|number} id ID do cliente
 * @returns {Object|null} Cliente encontrado ou null
 */
async function findClientById(id) {
    if (!id) return null;
    
    try {
        const clientId = String(id);
        const clients = await getClients();
        
        return clients.find(c => String(c.id) === clientId) || null;
    } catch (error) {
        console.error("Erro ao buscar cliente por ID:", error);
        return null;
    }
}

/**
 * Busca clientes pelo nome (parcial)
 * @param {string} name Nome ou parte do nome para buscar
 * @returns {Array} Lista de clientes que correspondem à busca
 */
async function findClientsByName(name) {
    if (!name) return [];
    
    try {
        const searchTerm = name.toLowerCase();
        const clients = await getClients();
        
        return clients.filter(c => 
            (c.name && c.name.toLowerCase().includes(searchTerm)) || 
            (c.nome && c.nome.toLowerCase().includes(searchTerm))
        );
    } catch (error) {
        console.error("Erro ao buscar clientes por nome:", error);
        return [];
    }
}

/**
 * Normaliza um objeto cliente para garantir propriedades consistentes
 * @param {Object} client Cliente a ser normalizado
 * @returns {Object} Cliente normalizado
 */
function normalizeClient(client) {
    if (!client) return null;
    const nowIso = new Date().toISOString();
    const nome = String(client.name || client.nome || '').trim();
    const estado = String(client.state || client.estado || '').trim();
    const cidade = String(client.city || client.cidade || '').trim();
    const telefone = String(client.phone || client.telefone || '').trim();
    const endereco = String(client.address || client.endereco || '').trim();
    const numero = String(client.number || client.numero || '').trim();
    const bairro = String(client.neighborhood || client.bairro || '').trim();
    const obs = String(client.obs || client.observacoes || client.observations || '').trim();
    const createdAt = client.createdAt || client.created || nowIso;
    const updatedAt = client.updatedAt || client.updated || nowIso;

    return {
        ...client,
        id: String(client.id || Date.now()),
        nome,
        name: nome,
        nomeCompleto: String(client.nomeCompleto || nome).trim(),
        cnpj: String(client.cnpj || '').trim(),
        estado,
        state: estado,
        cidade,
        city: cidade,
        telefone,
        phone: telefone,
        email: String(client.email || '').trim(),
        endereco,
        address: endereco,
        numero,
        number: numero,
        bairro,
        neighborhood: bairro,
        obs,
        observacoes: obs,
        observations: obs,
        tipo: String(client.tipo || 'cliente').trim(),
        category: String(client.category || 'cliente').trim(),
        status: String(client.status || 'ativo').trim(),
        createdAt,
        updatedAt: nowIso,
        created: createdAt,
        updated: nowIso,
        inscricaoEstadual: String(client.inscricaoEstadual || client.stateRegistration || '').trim(),
        stateRegistration: String(client.stateRegistration || client.inscricaoEstadual || '').trim()
    };
}

/**
 * Migra clientes de chaves legadas para a chave unificada
 * Esta função deve ser executada apenas uma vez durante a migração inicial automática,
 * ou manualmente através da função de limpeza.
 * @param {boolean} [respectExisting=false] Se true, prioriza os clientes já existentes na chave unificada
 * @returns {Object} Resultado da migração
 */
function migrateClientData(respectExisting = false) {
    console.log("Iniciando migração de dados de clientes...");
    
    try {
        // Obter clientes de todas as fontes possíveis
        const clientsFromClientsKey = JSON.parse(readLocalStorageValue('clients') || '[]');
        const clientsFromClientesPctKey = JSON.parse(readLocalStorageValue('clientesPct') || '[]');
        
        console.log(`Encontrados ${clientsFromClientsKey.length} clientes na chave 'clients'`);
        console.log(`Encontrados ${clientsFromClientesPctKey.length} clientes na chave 'clientesPct'`);
        
        // Se devemos respeitar os clientes existentes (modo de sincronização manual), usamos apenas a chave unificada
        let allClients = [];
        
        if (respectExisting && clientsFromClientsKey.length > 0) {
            console.log("Modo de sincronização respeitando clientes existentes ativado - priorizando chave unificada");
            // Usar apenas os clientes da chave unificada
            allClients = [...clientsFromClientsKey];
            
            // Salvar esta lista limpa em ambas as chaves para garantir consistência
            writeLocalStorageValue('clientesPct', allClients);
            
            // Atualizar cache
            clientsCache = allClients;
            cacheTimestamp = Date.now();
            
            console.log(`Sincronização concluída. ${allClients.length} clientes foram preservados.`);
            
            return {
                success: true,
                uniqueCount: allClients.length,
                duplicatesRemoved: 0,
                message: `Sincronização concluída com sucesso. ${allClients.length} clientes foram preservados.`
            };
        } else {
            // Modo de migração completa (padrão na primeira execução)
            // Combinar todos os clientes para migração
            allClients = [...clientsFromClientsKey, ...clientsFromClientesPctKey];
        }
        
        // Deduplica clientes por ID e nome
        const uniqueById = new Map();
        const uniqueByName = new Map();
        const uniqueClients = [];
        let duplicatesRemoved = 0;
        
        // Primeiro passe - priorizar IDs únicos
        allClients.forEach(client => {
            if (!client) return;
            
            const id = String(client.id || '');
            if (id && !uniqueById.has(id)) {
                uniqueById.set(id, normalizeClient(client));
            } else if (id) {
                duplicatesRemoved++;
            }
        });
        
        // Segundo passe - adicionar clientes únicos por ID
        uniqueById.forEach(client => {
            uniqueClients.push(client);
            
            // Registrar nome para o próximo passo
            const name = (client.name || client.nome || '').toLowerCase();
            if (name) {
                uniqueByName.set(name, true);
            }
        });
        
        // Terceiro passe - adicionar clientes sem ID mas com nome único
        allClients.forEach(client => {
            if (!client) return;
            
            const id = String(client.id || '');
            const name = (client.name || client.nome || '').toLowerCase();
            
            // Se não tem ID ou não foi adicionado por ID, verificar por nome
            if ((!id || !uniqueById.has(id)) && name && !uniqueByName.has(name)) {
                uniqueByName.set(name, true);
                const normalizedClient = normalizeClient(client);
                if (!normalizedClient.id) {
                    normalizedClient.id = String(Date.now() + uniqueClients.length);
                }
                uniqueClients.push(normalizedClient);
            } else if (name && !id) {
                duplicatesRemoved++;
            }
        });
        
        // Limpar os dados antes de salvar para garantir que não há duplicidades
        // de clientes entre as diferentes chaves de armazenamento
        removeLocalStorageValue('clients');
        removeLocalStorageValue('clientesPct');
        
        // Salvar clientes unificados
        writeLocalStorageValue(CLIENT_STORAGE_KEY, uniqueClients);
        
        // Atualizar também clientesPct para consistência entre módulos antigos
        writeLocalStorageValue('clientesPct', uniqueClients);
        
        // Atualizar cache
        clientsCache = uniqueClients;
        cacheTimestamp = Date.now();
        
        console.log(`Migração concluída. ${uniqueClients.length} clientes únicos salvos, ${duplicatesRemoved} duplicações removidas.`);
        
        return {
            success: true,
            uniqueCount: uniqueClients.length,
            duplicatesRemoved,
            message: `Migração concluída com sucesso. ${uniqueClients.length} clientes únicos salvos.`
        };
    } catch (error) {
        console.error("Erro durante migração de dados de clientes:", error);
        return {
            success: false,
            error: error.message,
            message: `Erro durante migração: ${error.message}`
        };
    }
}

// Compatibilidade com funções legadas - estas funções são apenas wrappers
// para manter compatibilidade com código existente
async function getData(key) {
    if (key === 'clients' || key === 'clientesPct') {
        return await getClients();
    }
    
    // Para outras chaves, usar localStorage diretamente
    try {
        const data = readLocalStorageValue(key);
        return data ? JSON.parse(data) : null;
    } catch (error) {
        console.error(`Erro ao ler dados de '${key}':`, error);
        return null;
    }
}

async function saveData(key, data) {
    if (key === 'clients' || key === 'clientesPct') {
        return await saveClients(data);
    }
    
    // Para outras chaves, usar localStorage diretamente
    try {
        writeLocalStorageValue(key, data);
        return true;
    } catch (error) {
        console.error(`Erro ao salvar dados em '${key}':`, error);
        return false;
    }
}

// Exportar funções para uso global
window.clientService = {
    getClients,
    saveClient,
    deleteClient,
    findClientById,
    findClientsByName,
    migrateClientData,
    normalizeClient,
    getData,
    saveData
};

// Compatibilidade com código existente
window.getClients = getClients;
window.saveClient = saveClient;
window.deleteClient = deleteClient;
window.findClientById = findClientById;
window.getData = getData;
window.saveData = saveData;

// Migração automática desabilitada para evitar duplicações e reinserções
