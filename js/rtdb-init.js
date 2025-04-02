/**
 * Script de inicialização do Realtime Database
 * Cria a estrutura inicial do banco de dados e adiciona dados iniciais
 */

import { rtdb, auth } from './firebase-config.js';
import { 
    ref, 
    set, 
    get, 
    child, 
    update, 
    serverTimestamp 
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-database.js";

/**
 * Inicializa o banco de dados com estruturas necessárias
 * @returns {Promise<Object>} Status da inicialização
 */
export async function initializeRealtimeDatabase() {
    try {
        console.log("Iniciando inicialização do Realtime Database...");
        
        // Verificar se o banco está acessível
        try {
            console.log("Verificando acesso ao Realtime Database...");
            const dbRef = ref(rtdb);
            await get(child(dbRef, 'settings/check'));
            console.log("Acesso ao Realtime Database confirmado!");
        } catch (accessError) {
            console.warn("Erro ao acessar Realtime Database:", accessError);
            console.log("Criando estrutura inicial no Realtime Database...");
            
            // Criar um nó de verificação para futuras verificações
            await set(ref(rtdb, 'settings/check'), {
                created: Date.now(),
                status: 'ok'
            });
        }
        
        // Verificar se o usuário admin já existe
        const adminExists = await checkAdminExists();
        console.log(`Verificação de admin existente: ${adminExists}`);
        
        if (!adminExists) {
            // Criar usuário admin
            await createAdminUser();
        }
        
        // Criar estruturas iniciais se não existirem
        await initializeStructures();
        
        // Inicializar dados de demonstração
        await initializeDemoData();
        
        console.log("Banco de dados inicializado com sucesso!");
        return { success: true, message: "Banco de dados inicializado com sucesso!" };
    } catch (error) {
        console.error("Erro ao inicializar banco de dados:", error);
        return { success: false, message: "Erro ao inicializar banco de dados: " + error.message };
    }
}

/**
 * Verifica se o usuário admin já existe
 * @returns {Promise<boolean>}
 */
async function checkAdminExists() {
    try {
        const dbRef = ref(rtdb);
        const snapshot = await get(child(dbRef, 'users/admin'));
        return snapshot.exists();
    } catch (error) {
        console.error("Erro ao verificar usuário admin:", error);
        return false;
    }
}

/**
 * Cria o usuário administrador
 * @returns {Promise<void>}
 */
async function createAdminUser() {
    try {
        console.log("Criando usuário administrador...");
        
        // Dados do usuário admin
        const adminUser = {
            username: "admin",
            name: "Administrador",
            email: "admin@sisweb.com.br",
            role: "admin",
            created: Date.now(),
            lastLogin: null,
            emailVerified: true
        };
        
        // Salvar no Realtime Database
        await set(ref(rtdb, 'users/admin'), adminUser);
        
        console.log("Usuário administrador criado com sucesso!");
    } catch (error) {
        console.error("Erro ao criar usuário admin:", error);
        throw error;
    }
}

/**
 * Inicializa as estruturas necessárias
 * @returns {Promise<void>}
 */
async function initializeStructures() {
    try {
        // Lista de estruturas a serem criadas
        const structures = [
            "users",         // Usuários do sistema
            "clients",       // Clientes
            "species",       // Espécies de madeira
            "romaneios",     // Romaneios
            "inventory",     // Estoque
            "orders",        // Pedidos
            "financial",     // Financeiro (contas a pagar/receber)
            "logs",          // Logs do sistema
            "company",       // Dados da empresa
            "settings",      // Configurações do sistema
            "subscriptions"  // Assinaturas
        ];
        
        // Verificar cada estrutura
        for (const structureName of structures) {
            await checkStructure(structureName);
        }
        
        // Adicionar configurações iniciais
        await initializeSettings();
        
    } catch (error) {
        console.error("Erro ao inicializar estruturas:", error);
        throw error;
    }
}

/**
 * Verifica se uma estrutura já existe e cria um documento vazio se necessário
 * @param {string} structureName - Nome da estrutura
 * @returns {Promise<void>}
 */
async function checkStructure(structureName) {
    try {
        // Verificar se a estrutura tem dados
        const dbRef = ref(rtdb);
        const snapshot = await get(child(dbRef, structureName));
        
        // Se não tiver dados, criar um nó inicial
        if (!snapshot.exists() && structureName !== "users") {
            await set(ref(rtdb, `${structureName}/initial`), {
                created: Date.now(),
                description: `Documento inicial para estrutura ${structureName}`
            });
            console.log(`Estrutura ${structureName} inicializada`);
        } else {
            console.log(`Estrutura ${structureName} já existe`);
        }
    } catch (error) {
        console.error(`Erro ao verificar estrutura ${structureName}:`, error);
    }
}

/**
 * Inicializa as configurações do sistema
 * @returns {Promise<void>}
 */
async function initializeSettings() {
    try {
        // Verificar se já existem configurações
        const dbRef = ref(rtdb);
        const snapshot = await get(child(dbRef, 'settings/general'));
        
        if (!snapshot.exists()) {
            // Configurações iniciais
            const initialSettings = {
                systemName: "SisWeb - Sistema de Gestão de Madeiras",
                version: "1.0.0",
                defaultCurrency: "BRL",
                defaultVolumeUnit: "m³",
                lastUpdate: Date.now(),
                features: {
                    enableBackup: true,
                    enableNotifications: true,
                    enableReports: true,
                    enableOfflineMode: true
                },
                ui: {
                    theme: "light",
                    language: "pt_BR",
                    dateFormat: "DD/MM/YYYY",
                    decimalSeparator: ","
                }
            };
            
            await set(ref(rtdb, 'settings/general'), initialSettings);
            console.log("Configurações iniciais criadas");
        } else {
            console.log("Configurações já existem");
        }
    } catch (error) {
        console.error("Erro ao inicializar configurações:", error);
    }
}

/**
 * Inicializa dados de demonstração para o sistema
 * @returns {Promise<void>}
 */
async function initializeDemoData() {
    try {
        // Verificar se já existem dados de demonstração
        const dbRef = ref(rtdb);
        const snapshot = await get(child(dbRef, 'demo'));
        
        if (!snapshot.exists()) {
            console.log("Criando dados de demonstração...");
            
            // Criar alguns clientes de demonstração
            await set(ref(rtdb, 'clients/demo1'), {
                name: "Madeireira Exemplo Ltda",
                email: "contato@madeireiraexemplo.com.br",
                phone: "(11) 98765-4321",
                address: "Rua das Madeiras, 123",
                city: "São Paulo",
                state: "SP",
                created: Date.now()
            });
            
            await set(ref(rtdb, 'clients/demo2'), {
                name: "Construtora Modelo S.A.",
                email: "contato@construtoramodelo.com.br",
                phone: "(11) 91234-5678",
                address: "Av. das Construções, 456",
                city: "São Paulo",
                state: "SP",
                created: Date.now()
            });
            
            // Criar algumas espécies de madeira de demonstração
            await set(ref(rtdb, 'species/demo1'), {
                name: "Cedro",
                scientificName: "Cedrela fissilis",
                density: 550,
                price: 250.00,
                unit: "m³"
            });
            
            await set(ref(rtdb, 'species/demo2'), {
                name: "Ipê",
                scientificName: "Handroanthus sp.",
                density: 1050,
                price: 450.00,
                unit: "m³"
            });
            
            // Marcar que os dados de demonstração foram criados
            await set(ref(rtdb, 'demo'), {
                created: Date.now(),
                status: 'demo data created'
            });
            
            console.log("Dados de demonstração criados com sucesso");
        } else {
            console.log("Dados de demonstração já existem");
        }
    } catch (error) {
        console.error("Erro ao criar dados de demonstração:", error);
    }
} 