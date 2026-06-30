/**
 * Utilitários para padronização de clientes no sistema
 */

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
    const payload = typeof data === 'string' ? data : JSON.stringify(data);
    for (const k of getLocalStorageKeys(key)) {
        localStorage.setItem(k, payload);
    }
}

// Normaliza dados de clientes para garantir consistência
function normalizeClientData(client) {
    // Normalizar ID para formato numérico
    if (client.id && isNaN(Number(client.id))) {
        client.id = Date.now() + Math.floor(Math.random() * 1000);
    } else if (!client.id) {
        client.id = Date.now() + Math.floor(Math.random() * 1000);
    } else {
        client.id = Number(client.id);
    }
    
    // Garantir que tenha nome/name
    if (client.nome && !client.name) {
        client.name = client.nome;
    } else if (client.name && !client.nome) {
        client.nome = client.name;
    } else if (!client.nome && !client.name) {
        client.nome = "Sem nome";
        client.name = "Sem nome";
    }
    
    // Garantir consistência de cidade/city
    if (client.cidade && !client.city) {
        client.city = client.cidade;
    } else if (client.city && !client.cidade) {
        client.cidade = client.city;
    }
    
    // Garantir consistência de estado/state
    if (client.estado && !client.state) {
        client.state = client.estado;
    } else if (client.state && !client.estado) {
        client.estado = client.state;
    }
    
    // Garantir consistência de telefone/phone
    if (client.telefone && !client.phone) {
        client.phone = client.telefone;
    } else if (client.phone && !client.telefone) {
        client.telefone = client.phone;
    }
    
    // Garantir consistência de observações
    if (client.observacoes && !client.obs) {
        client.obs = client.observacoes;
    } else if (client.obs && !client.observacoes) {
        client.observacoes = client.obs;
    }
    
    // Garantir consistência de endereço
    if (client.endereco && !client.address) {
        client.address = client.endereco;
    } else if (client.address && !client.endereco) {
        client.endereco = client.address;
    }
    
    return client;
}

// Normaliza todos os clientes no localStorage
function normalizeAllClients() {
    try {
        // Obter clientes do localStorage
        const clientsData = readLocalStorageValue('clients');
        if (!clientsData) return { success: true, modified: 0 };
        
        const clients = JSON.parse(clientsData);
        let modifiedCount = 0;
        
        // Normalizar cada cliente
        const normalizedClients = clients.map(client => {
            const oldId = client.id;
            const normalizedClient = normalizeClientData(client);
            
            // Verificar se houve alteração no ID
            if (String(oldId) !== String(normalizedClient.id)) {
                modifiedCount++;
            }
            
            return normalizedClient;
        });
        
        // Salvar clientes normalizados de volta no localStorage
        writeLocalStorageValue('clients', normalizedClients);
        
        return {
            success: true,
            modified: modifiedCount
        };
    } catch (error) {
        console.error("Erro ao normalizar clientes:", error);
        return {
            success: false,
            error: error.message
        };
    }
}

// Encontrar cliente por ID com tratamento seguro de tipos
function findClientById(id, clients) {
    return clients.find(c => String(c.id) === String(id));
}

// Criar ou atualizar cliente com dados normalizados
function saveNormalizedClient(clientData, editingId = null) {
    try {
        // Obter clientes existentes
        const clientsData = readLocalStorageValue('clients');
        const clients = clientsData ? JSON.parse(clientsData) : [];
        
        // Normalizar dados do cliente
        const normalizedClient = normalizeClientData({
            ...clientData,
            id: editingId || Date.now()
        });
        
        // Se estiver editando um cliente existente
        if (editingId) {
            const index = clients.findIndex(c => String(c.id) === String(editingId));
            if (index !== -1) {
                clients[index] = normalizedClient;
            } else {
                clients.push(normalizedClient);
            }
        } else {
            clients.push(normalizedClient);
        }
        
        // Salvar no localStorage
        writeLocalStorageValue('clients', clients);
        
        return {
            success: true,
            client: normalizedClient
        };
    } catch (error) {
        console.error("Erro ao salvar cliente:", error);
        return {
            success: false,
            error: error.message
        };
    }
} 
