/**
 * Database Adapter - Substituto inteligente para localStorage
 * 
 * Este módulo fornece uma API compatível com localStorage que utiliza
 * Firebase como backend principal e localStorage como fallback/cache.
 * 
 * Funcionalidades:
 * - API idêntica ao localStorage para compatibilidade total
 * - Firebase como armazenamento principal
 * - localStorage como cache/fallback para operação offline
 * - Sincronização automática bidirecional
 * - Tratamento inteligente de erros
 */

// Importar o firebaseService
import { firebaseService } from './firebaseService.js';

/**
 * Classe DatabaseAdapter - substituto inteligente para localStorage
 */
class DatabaseAdapter {
    constructor() {
        this.prefix = 'sisweb_';
        this.syncQueue = new Set();
        this.isOnline = navigator.onLine;
        this.pendingOperations = new Map();
        
        // Monitorar status de conexão
        this.setupConnectionMonitoring();
        
        // Sincronizar dados na inicialização
        this.initializeSync();
    }

    getTenantId() {
        try {
            if (firebaseService && typeof firebaseService.getCurrentTenantId === 'function') {
                const t = firebaseService.getCurrentTenantId();
                if (t) return String(t);
            }
            if (firebaseService && typeof firebaseService.getTenantId === 'function') {
                const t = firebaseService.getTenantId();
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
    
    /**
     * Configurar monitoramento de conexão
     */
    setupConnectionMonitoring() {
        // Monitorar conexão com a internet
        window.addEventListener('online', () => {
            console.log('🌐 Conexão com internet restaurada - sincronizando...');
            this.isOnline = true;
            this.processPendingOperations();
        });
        
        window.addEventListener('offline', () => {
            console.log('📴 Conexão com internet perdida - modo offline');
            this.isOnline = false;
        });
        
        // Monitorar status do Firebase
        window.addEventListener('firebaseReconnected', () => {
            console.log('🔥 Firebase reconectado - processando operações pendentes');
            this.processPendingOperations();
        });
    }
    
    /**
     * Inicializar sincronização
     */
    async initializeSync() {
        try {
            await this.syncFromFirebaseToLocal();
        } catch (error) {
            console.warn('⚠️ Erro na sincronização inicial:', error.message);
        }
    }
    
    /**
     * Obter item - compatível com localStorage.getItem()
     */
    async getItem(key) {
        try {
            // Primeiro, tentar obter do Firebase
            if (firebaseService && firebaseService.isOperational()) {
                const firebaseData = await firebaseService.getFromFirebase(this.getFirebasePath(key));
                
                if (firebaseData && firebaseData.success && firebaseData.data !== null) {
                    // Dados encontrados no Firebase - cache local
                    const serializedData = JSON.stringify(firebaseData.data);
                    localStorage.setItem(this.getLocalKey(key), serializedData);
                    
                    return serializedData;
                }
            }
            
            // Fallback para localStorage
            const primary = localStorage.getItem(this.getLocalKey(key));
            if (primary !== null && primary !== undefined) return primary;
            const legacyKey = this.getLegacyLocalKey(key);
            if (legacyKey !== this.getLocalKey(key)) {
                const legacy = localStorage.getItem(legacyKey);
                if (legacy !== null && legacy !== undefined) {
                    localStorage.setItem(this.getLocalKey(key), legacy);
                    localStorage.removeItem(legacyKey);
                    return legacy;
                }
            }
            return null;
            
        } catch (error) {
            console.warn(`⚠️ Erro ao obter ${key} do Firebase, usando cache local:`, error.message);
            const primary = localStorage.getItem(this.getLocalKey(key));
            if (primary !== null && primary !== undefined) return primary;
            const legacyKey = this.getLegacyLocalKey(key);
            return legacyKey !== this.getLocalKey(key) ? localStorage.getItem(legacyKey) : null;
        }
    }
    
    /**
     * Salvar item - compatível com localStorage.setItem()
     */
    async setItem(key, value) {
        try {
            // Sempre salvar no localStorage primeiro (cache local)
            localStorage.setItem(this.getLocalKey(key), value);
            const legacyKey = this.getLegacyLocalKey(key);
            if (legacyKey !== this.getLocalKey(key)) {
                localStorage.removeItem(legacyKey);
            }
            
            // Tentar salvar no Firebase
            if (firebaseService && firebaseService.isOperational()) {
                const data = JSON.parse(value);
                const result = await firebaseService.saveToFirebase(this.getFirebasePath(key), null, data);
                
                if (result && result.success) {
                    console.log(`✅ ${key} salvo no Firebase e cache local`);
                    return;
                }
            }
            
            // Se não conseguiu salvar no Firebase, adicionar à fila de sincronização
            this.addToPendingOperations('set', key, value);
            console.log(`📱 ${key} salvo no cache local, pendente sincronização Firebase`);
            
        } catch (error) {
            console.warn(`⚠️ Erro ao salvar ${key}:`, error.message);
            // Garantir que pelo menos foi salvo localmente
            localStorage.setItem(this.getLocalKey(key), value);
            const legacyKey = this.getLegacyLocalKey(key);
            if (legacyKey !== this.getLocalKey(key)) {
                localStorage.removeItem(legacyKey);
            }
            this.addToPendingOperations('set', key, value);
        }
    }
    
    /**
     * Remover item - compatível com localStorage.removeItem()
     */
    async removeItem(key) {
        try {
            // Remover do localStorage
            localStorage.removeItem(this.getLocalKey(key));
            const legacyKey = this.getLegacyLocalKey(key);
            if (legacyKey !== this.getLocalKey(key)) {
                localStorage.removeItem(legacyKey);
            }
            
            // Tentar remover do Firebase
            if (firebaseService && firebaseService.isOperational()) {
                const result = await firebaseService.removeFromFirebase(this.getFirebasePath(key));
                
                if (result && result.success) {
                    console.log(`🗑️ ${key} removido do Firebase e cache local`);
                    return;
                }
            }
            
            // Se não conseguiu remover do Firebase, adicionar à fila
            this.addToPendingOperations('remove', key);
            console.log(`📱 ${key} removido do cache local, remoção Firebase pendente`);
            
        } catch (error) {
            console.warn(`⚠️ Erro ao remover ${key}:`, error.message);
            // Garantir que foi removido localmente
            localStorage.removeItem(this.getLocalKey(key));
            const legacyKey = this.getLegacyLocalKey(key);
            if (legacyKey !== this.getLocalKey(key)) {
                localStorage.removeItem(legacyKey);
            }
            this.addToPendingOperations('remove', key);
        }
    }
    
    /**
     * Limpar todos os dados - compatível com localStorage.clear()
     */
    async clear() {
        try {
            // Obter todas as chaves do nosso prefixo
            const keysToRemove = [];
            for (let i = 0; i < localStorage.length; i++) {
                const key = localStorage.key(i);
                if (key && key.startsWith(this.prefix)) {
                    keysToRemove.push(key.replace(this.prefix, ''));
                }
            }
            
            // Remover cada item
            for (const key of keysToRemove) {
                await this.removeItem(key);
            }
            
            console.log(`🧹 ${keysToRemove.length} itens removidos`);
            
        } catch (error) {
            console.error('❌ Erro ao limpar dados:', error);
        }
    }
    
    /**
     * Obter número de itens - compatível com localStorage.length
     */
    get length() {
        let count = 0;
        for (let i = 0; i < localStorage.length; i++) {
            const key = localStorage.key(i);
            if (key && key.startsWith(this.prefix)) {
                count++;
            }
        }
        return count;
    }
    
    /**
     * Obter chave por índice - compatível com localStorage.key()
     */
    key(index) {
        let count = 0;
        for (let i = 0; i < localStorage.length; i++) {
            const key = localStorage.key(i);
            if (key && key.startsWith(this.prefix)) {
                if (count === index) {
                    const raw = key.replace(this.prefix, '');
                    const tenant = this.getTenantId();
                    const tenantPrefix = tenant ? `company_${tenant}__` : null;
                    if (tenantPrefix && raw.startsWith(tenantPrefix)) {
                        return raw.slice(tenantPrefix.length);
                    }
                    return raw;
                }
                count++;
            }
        }
        return null;
    }
    
    /**
     * Obter chave local com prefixo
     */
    getLocalKey(key) {
        const tenant = this.getTenantId();
        if (tenant) return this.prefix + `company_${tenant}__${key}`;
        return this.prefix + key;
    }

    getLegacyLocalKey(key) {
        return this.prefix + key;
    }
    
    /**
     * Obter caminho do Firebase
     */
    getFirebasePath(key) {
        // Mapear chaves específicas para caminhos organizados
        const pathMap = {
            'clients': 'data/clients',
            'clientesTora': 'data/clients',
            'clientes': 'data/clients',
            'species': 'data/species',
            'especies': 'data/species',
            'romaneiosPct': 'data/romaneiosPct',
            'romaneiosTora': 'data/romaneios/tora',
            'romaneiosTl': 'data/romaneios/tl',
            'companies': 'data/companies',
            'empresaInfo': 'data/companies',
            'users': 'auth/users',
            'currentUser': 'auth/currentUser',
            'systemConfig': 'config/system',
            'activityLogs': 'logs/activity',
            'userSessions': 'auth/sessions'
        };
        
        return pathMap[key] || `data/misc/${key}`;
    }
    
    /**
     * Adicionar operação às pendências
     */
    addToPendingOperations(operation, key, value = null) {
        this.pendingOperations.set(key, { operation, key, value, timestamp: Date.now() });
    }
    
    /**
     * Processar operações pendentes
     */
    async processPendingOperations() {
        if (this.pendingOperations.size === 0) {
            return;
        }
        
        console.log(`🔄 Processando ${this.pendingOperations.size} operações pendentes...`);
        
        const operations = Array.from(this.pendingOperations.values());
        this.pendingOperations.clear();
        
        for (const op of operations) {
            try {
                if (op.operation === 'set') {
                    await this.setItem(op.key, op.value);
                } else if (op.operation === 'remove') {
                    await this.removeItem(op.key);
                }
            } catch (error) {
                console.warn(`⚠️ Erro ao processar operação pendente para ${op.key}:`, error.message);
                // Re-adicionar à fila se ainda houver erro
                this.addToPendingOperations(op.operation, op.key, op.value);
            }
        }
    }
    
    /**
     * Sincronizar do Firebase para local
     */
    async syncFromFirebaseToLocal() {
        if (!firebaseService || !firebaseService.isOperational()) {
            return;
        }
        
        try {
            console.log('⬇️ Sincronizando dados do Firebase...');
            
            // Lista de chaves principais para sincronizar
            const keysToSync = [
                'clients', 'species', 'romaneiosPct', 'romaneiosTora', 
                'romaneiosTl', 'companies', 'systemConfig'
            ];
            
            for (const key of keysToSync) {
                try {
                    const result = await firebaseService.getFromFirebase(this.getFirebasePath(key));
                    
                    if (result && result.success && result.data !== null) {
                        const serializedData = JSON.stringify(result.data);
                        localStorage.setItem(this.getLocalKey(key), serializedData);
                        console.log(`✅ ${key} sincronizado do Firebase`);
                    }
                } catch (error) {
                    console.warn(`⚠️ Erro ao sincronizar ${key}:`, error.message);
                }
            }
            
            console.log('✅ Sincronização inicial concluída');
            
        } catch (error) {
            console.warn('⚠️ Erro na sincronização inicial:', error.message);
        }
    }
    
    /**
     * Obter estatísticas de uso
     */
    getStats() {
        return {
            localItems: this.length,
            pendingOperations: this.pendingOperations.size,
            isOnline: this.isOnline,
            firebaseOperational: firebaseService?.isOperational() || false
        };
    }
}

// Criar instância global
const databaseAdapter = new DatabaseAdapter();

/**
 * Funções de compatibilidade para substituição direta do localStorage
 */

/**
 * getData - função compatível com o sistema atual
 */
export async function getData(key) {
    try {
        const data = await databaseAdapter.getItem(key);
        return data ? JSON.parse(data) : null;
    } catch (error) {
        console.error(`❌ Erro ao obter dados de ${key}:`, error);
        return null;
    }
}

/**
 * saveData - função compatível com o sistema atual
 */
export async function saveData(key, data) {
    try {
        const serializedData = JSON.stringify(data);
        await databaseAdapter.setItem(key, serializedData);
        return true;
    } catch (error) {
        console.error(`❌ Erro ao salvar dados de ${key}:`, error);
        return false;
    }
}

/**
 * removeData - função para remover dados
 */
export async function removeData(key) {
    try {
        await databaseAdapter.removeItem(key);
        return true;
    } catch (error) {
        console.error(`❌ Erro ao remover dados de ${key}:`, error);
        return false;
    }
}

/**
 * clearAllData - função para limpar todos os dados
 */
export async function clearAllData() {
    try {
        await databaseAdapter.clear();
        return true;
    } catch (error) {
        console.error('❌ Erro ao limpar todos os dados:', error);
        return false;
    }
}

/**
 * Substituto direto para localStorage (para compatibilidade total)
 */
export const smartStorage = {
    async getItem(key) {
        return await databaseAdapter.getItem(key);
    },
    
    async setItem(key, value) {
        return await databaseAdapter.setItem(key, value);
    },
    
    async removeItem(key) {
        return await databaseAdapter.removeItem(key);
    },
    
    async clear() {
        return await databaseAdapter.clear();
    },
    
    get length() {
        return databaseAdapter.length;
    },
    
    key(index) {
        return databaseAdapter.key(index);
    },
    
    getStats() {
        return databaseAdapter.getStats();
    }
};

// Exportar instância e funções
export { databaseAdapter };
export default databaseAdapter;

// Expor globalmente para facilitar a migração
window.databaseAdapter = databaseAdapter;
window.smartStorage = smartStorage;
window.getData = getData;
window.saveData = saveData;
window.removeData = removeData;
window.clearAllData = clearAllData;

console.log('✅ Database Adapter inicializado - substituto inteligente para localStorage');
