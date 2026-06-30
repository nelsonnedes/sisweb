/**
 * Romaneio Firebase Service
 * Serviço especializado para gerenciar dados do sistema de romaneio no Firebase
 */

class RomaneioFirebaseService {
    constructor() {
        this.db = null;
        this.auth = null;
        this.isReady = false;
        this.isOnline = navigator.onLine;
        this.cache = new Map();
        this.syncQueue = [];
        
        this.init();
    }

    async init() {
        try {
            console.log('🔥 Inicializando Romaneio Firebase Service...');
            
            // Verificar se Firebase está disponível
            if (typeof firebase === 'undefined') {
                throw new Error('Firebase SDK não carregado');
            }

            this.db = firebase.database();
            this.auth = firebase.auth();
            
            // Configurar listeners
            this.setupConnectionListener();
            this.setupAuthListener();
            
            this.isReady = true;
            console.log('✅ Romaneio Firebase Service inicializado');
            
            // Disparar evento de pronto
            window.dispatchEvent(new CustomEvent('romaneioFirebaseReady', {
                detail: { service: this }
            }));
            
        } catch (error) {
            console.error('❌ Erro ao inicializar Romaneio Firebase Service:', error);
            this.isReady = false;
        }
    }

    setupConnectionListener() {
        this.db.ref('.info/connected').on('value', (snapshot) => {
            this.isOnline = snapshot.val() === true;
            console.log(`🌐 Firebase ${this.isOnline ? 'conectado' : 'desconectado'}`);
            
            if (this.isOnline) {
                this.syncPendingData();
            }
        });
    }

    setupAuthListener() {
        this.auth.onAuthStateChanged((user) => {
            if (user) {
                console.log('👤 Usuário autenticado:', user.uid);
            } else {
                console.log('👤 Usuário não autenticado, usando modo anônimo');
                // Autenticar anonimamente para ter acesso ao Firebase
                this.auth.signInAnonymously().catch(console.error);
            }
        });
    }

    async waitForReady(timeout = 10000) {
        if (this.isReady) return true;
        
        return new Promise((resolve, reject) => {
            const startTime = Date.now();
            
            const checkReady = () => {
                if (this.isReady) {
                    resolve(true);
                } else if (Date.now() - startTime > timeout) {
                    reject(new Error('Timeout aguardando Firebase'));
                } else {
                    setTimeout(checkReady, 100);
                }
            };
            
            checkReady();
        });
    }

    // Salvar dados com estrutura específica para romaneio
    async saveRomaneioData(key, data) {
        try {
            // Cache local primeiro
            this.cache.set(key, data);
            localStorage.setItem(key, JSON.stringify(data));

            if (!this.isOnline || !this.isReady) {
                console.log(`📱 ${key} salvo localmente (offline)`);
                this.syncQueue.push({ key, data, action: 'save' });
                return { success: true, source: 'local' };
            }

            // Estrutura de dados Firebase
            const firebaseData = {
                data: data,
                timestamp: firebase.database.ServerValue.TIMESTAMP,
                version: '2.0.0',
                type: this.getDataType(key)
            };

            // Salvar no Firebase
            await this.db.ref(`romaneio/${key}`).set(firebaseData);
            console.log(`✅ ${key} salvo no Firebase`);
            
            return { success: true, source: 'firebase' };
            
        } catch (error) {
            console.error(`❌ Erro ao salvar ${key}:`, error);
            
            // Fallback para localStorage
            try {
                localStorage.setItem(key, JSON.stringify(data));
                this.syncQueue.push({ key, data, action: 'save' });
                return { success: true, source: 'local_fallback' };
            } catch (localError) {
                console.error('❌ Erro crítico no fallback:', localError);
                return { success: false, error: localError.message };
            }
        }
    }

    // Carregar dados com fallback inteligente
    async loadRomaneioData(key) {
        try {
            // Verificar cache primeiro
            if (this.cache.has(key)) {
                return { 
                    success: true, 
                    data: this.cache.get(key), 
                    source: 'cache' 
                };
            }

            if (this.isOnline && this.isReady) {
                // Tentar Firebase primeiro
                const snapshot = await this.db.ref(`romaneio/${key}`).once('value');
                
                if (snapshot.exists()) {
                    const firebaseData = snapshot.val();
                    const data = firebaseData.data || firebaseData; // Compatibilidade
                    
                    // Atualizar cache e localStorage
                    this.cache.set(key, data);
                    localStorage.setItem(key, JSON.stringify(data));
                    
                    console.log(`☁️ ${key} carregado do Firebase`);
                    return { success: true, data: data, source: 'firebase' };
                }
            }

            // Fallback para localStorage
            const localData = localStorage.getItem(key);
            if (localData) {
                const data = JSON.parse(localData);
                this.cache.set(key, data);
                console.log(`📱 ${key} carregado do localStorage`);
                return { success: true, data: data, source: 'local' };
            }

            console.log(`ℹ️ ${key} não encontrado`);
            return { success: true, data: null, source: 'empty' };
            
        } catch (error) {
            console.error(`❌ Erro ao carregar ${key}:`, error);
            
            // Último recurso: localStorage
            try {
                const localData = localStorage.getItem(key);
                if (localData) {
                    const data = JSON.parse(localData);
                    return { success: true, data: data, source: 'local_emergency' };
                }
            } catch (localError) {
                console.error('❌ Erro no fallback de emergência:', localError);
            }
            
            return { success: false, error: error.message };
        }
    }

    // Excluir dados
    async deleteRomaneioData(key) {
        try {
            // Remover do cache
            this.cache.delete(key);
            localStorage.removeItem(key);

            if (this.isOnline && this.isReady) {
                await this.db.ref(`romaneio/${key}`).remove();
                console.log(`🗑️ ${key} removido do Firebase`);
            } else {
                this.syncQueue.push({ key, action: 'delete' });
                console.log(`📱 ${key} marcado para remoção (offline)`);
            }
            
            return { success: true };
            
        } catch (error) {
            console.error(`❌ Erro ao excluir ${key}:`, error);
            return { success: false, error: error.message };
        }
    }

    // Sincronizar dados pendentes
    async syncPendingData() {
        if (!this.isOnline || !this.isReady || this.syncQueue.length === 0) {
            return;
        }

        console.log(`🔄 Sincronizando ${this.syncQueue.length} operações pendentes...`);
        
        const operations = [...this.syncQueue];
        this.syncQueue = [];

        for (const operation of operations) {
            try {
                if (operation.action === 'save') {
                    await this.saveRomaneioData(operation.key, operation.data);
                } else if (operation.action === 'delete') {
                    await this.deleteRomaneioData(operation.key);
                }
            } catch (error) {
                console.error(`❌ Erro na sincronização de ${operation.key}:`, error);
                // Recolocar na fila para tentar novamente
                this.syncQueue.push(operation);
            }
        }
        
        console.log('✅ Sincronização concluída');
    }

    // Determinar tipo de dados baseado na chave
    getDataType(key) {
        if (key.includes('romaneio')) return 'romaneio';
        if (key.includes('client')) return 'client';
        if (key.includes('species') || key.includes('especie')) return 'especies';
        if (key.includes('company')) return 'company';
        return 'general';
    }

    // Listar todos os romaneios
    async listAllRomaneios() {
        try {
            if (this.isOnline && this.isReady) {
                const snapshot = await this.db.ref('romaneio').orderByKey().once('value');
                const data = snapshot.val() || {};
                
                // Filtrar apenas chaves de romaneio
                const romaneios = {};
                Object.keys(data).forEach(key => {
                    if (key.includes('romaneio') || key.includes('TL') || key.includes('Tora')) {
                        romaneios[key] = data[key].data || data[key];
                    }
                });
                
                return { success: true, data: romaneios, source: 'firebase' };
            }

            // Fallback para localStorage
            const localRomaneios = {};
            for (let i = 0; i < localStorage.length; i++) {
                const key = localStorage.key(i);
                if (key && (key.includes('romaneio') || key.includes('TL') || key.includes('Tora'))) {
                    try {
                        localRomaneios[key] = JSON.parse(localStorage.getItem(key));
                    } catch (e) {
                        console.warn(`Erro ao parsear ${key}:`, e);
                    }
                }
            }
            
            return { success: true, data: localRomaneios, source: 'local' };
            
        } catch (error) {
            console.error('❌ Erro ao listar romaneios:', error);
            return { success: false, error: error.message };
        }
    }

    // Backup de dados
    async createBackup() {
        try {
            const backup = {
                timestamp: new Date().toISOString(),
                version: '2.0.0',
                data: {}
            };

            // Coletar dados do localStorage
            for (let i = 0; i < localStorage.length; i++) {
                const key = localStorage.key(i);
                if (key && (key.includes('romaneio') || key.includes('client') || key.includes('species'))) {
                    try {
                        backup.data[key] = JSON.parse(localStorage.getItem(key));
                    } catch (e) {
                        console.warn(`Erro no backup de ${key}:`, e);
                    }
                }
            }

            // Salvar backup no Firebase
            if (this.isOnline && this.isReady) {
                const backupKey = `backup_${Date.now()}`;
                await this.db.ref(`backups/${backupKey}`).set(backup);
                console.log(`✅ Backup criado: ${backupKey}`);
            }

            return { success: true, backup: backup };
            
        } catch (error) {
            console.error('❌ Erro ao criar backup:', error);
            return { success: false, error: error.message };
        }
    }

    // Verificar integridade dos dados
    async checkDataIntegrity() {
        const report = {
            timestamp: new Date().toISOString(),
            firebase: { status: 'unknown', count: 0 },
            localStorage: { status: 'unknown', count: 0 },
            issues: []
        };

        try {
            // Verificar Firebase
            if (this.isOnline && this.isReady) {
                const snapshot = await this.db.ref('romaneio').once('value');
                const firebaseData = snapshot.val() || {};
                report.firebase.status = 'ok';
                report.firebase.count = Object.keys(firebaseData).length;
            } else {
                report.firebase.status = 'offline';
            }

            // Verificar localStorage
            let localCount = 0;
            for (let i = 0; i < localStorage.length; i++) {
                const key = localStorage.key(i);
                if (key && (key.includes('romaneio') || key.includes('client') || key.includes('species'))) {
                    localCount++;
                    
                    try {
                        JSON.parse(localStorage.getItem(key));
                    } catch (e) {
                        report.issues.push(`Dados corrompidos em localStorage: ${key}`);
                    }
                }
            }
            report.localStorage.status = 'ok';
            report.localStorage.count = localCount;

            console.log('📊 Relatório de integridade:', report);
            return { success: true, report: report };
            
        } catch (error) {
            console.error('❌ Erro na verificação de integridade:', error);
            report.issues.push(`Erro na verificação: ${error.message}`);
            return { success: false, report: report };
        }
    }
}

// Instanciar e exportar o serviço
const romaneioFirebaseService = new RomaneioFirebaseService();

// Compatibilidade com código existente
window.romaneioFirebaseService = romaneioFirebaseService;

// Funções de compatibilidade
window.saveData = async function(key, data) {
    const result = await romaneioFirebaseService.saveRomaneioData(key, data);
    return result.success;
};

window.getData = async function(key) {
    const result = await romaneioFirebaseService.loadRomaneioData(key);
    return result.success ? result.data : null;
};

export { romaneioFirebaseService };
export default romaneioFirebaseService;
