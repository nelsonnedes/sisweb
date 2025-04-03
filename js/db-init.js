/**
 * Script de inicialização do banco de dados
 * Cria a estrutura inicial do banco de dados e adiciona dados iniciais
 */

import { db, rtdb, auth } from './firebase-config.js';
import { 
    collection, 
    doc, 
    setDoc, 
    getDocs, 
    query, 
    where, 
    limit, 
    serverTimestamp,
    getDoc
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

import { initializeRealtimeDatabase } from './rtdb-init.js';

/**
 * Inicializa o banco de dados com coleções necessárias
 * @returns {Promise<Object>} Status da inicialização
 */
export async function initializeDatabase() {
    try {
        console.log("[DB-INIT] Iniciando inicialização do banco de dados...");
        
        // Verificar se estamos usando Firestore ou Realtime Database
        let firestore = false;
        let realtimeDB = false;
        let initResult = {
            success: false,
            message: "Falha ao inicializar o banco de dados.",
            details: [],
            databases: {
                firestore: false,
                realtimeDB: false
            }
        };
        
        // Tentar inicializar Realtime Database
        try {
            console.log("[DB-INIT] Tentando inicializar Realtime Database...");
            const rtdbResult = await initializeRealtimeDatabase();
            if (rtdbResult.success) {
                console.log("[DB-INIT] Realtime Database inicializado com sucesso:", rtdbResult.message);
                realtimeDB = true;
                initResult.databases.realtimeDB = true;
                initResult.details.push("Realtime Database iniciado com sucesso");
            } else {
                console.warn("[DB-INIT] Aviso ao inicializar Realtime Database:", rtdbResult.message);
                initResult.details.push("Aviso Realtime Database: " + rtdbResult.message);
            }
        } catch (rtdbError) {
            console.error("[DB-INIT] Erro ao inicializar Realtime Database:", rtdbError);
            initResult.details.push("Erro Realtime Database: " + rtdbError.message);
        }
        
        // Tentar inicializar Firestore 
        try {
            console.log("[DB-INIT] Tentando inicializar Firestore...");
            // Verificar se o banco está acessível
            try {
                console.log("[DB-INIT] Verificando acesso ao Firestore...");
                if (!db) {
                    throw new Error("Instância do Firestore indisponível");
                }
                
                const settingsRef = doc(db, "settings", "check");
                await getDoc(settingsRef);
                console.log("[DB-INIT] Acesso ao Firestore confirmado!");
                firestore = true;
                initResult.databases.firestore = true;
                initResult.details.push("Firestore acessível");
                
                // Verificar se o usuário admin já existe
                const adminExists = await checkAdminExists();
                console.log(`[DB-INIT] Verificação de admin existente: ${adminExists}`);
                
                if (!adminExists) {
                    // Criar usuário admin
                    await createAdminUser();
                    initResult.details.push("Usuário admin criado");
                } else {
                    initResult.details.push("Usuário admin já existe");
                }
                
                // Criar coleções iniciais se não existirem
                await initializeCollections();
                initResult.details.push("Coleções inicializadas");
                
                // Inicializar dados de demonstração
                await initializeDemoData();
                initResult.details.push("Dados de demonstração criados");
                
                console.log("[DB-INIT] Firestore inicializado com sucesso!");
            } catch (accessError) {
                console.error("[DB-INIT] Erro ao acessar Firestore:", accessError);
                initResult.details.push("Erro ao acessar Firestore: " + accessError.message);
            }
        } catch (firestoreError) {
            console.error("[DB-INIT] Erro ao inicializar Firestore:", firestoreError);
            initResult.details.push("Erro ao inicializar Firestore: " + firestoreError.message);
        }
        
        // Determinar resultado final
        if (realtimeDB || firestore) {
            initResult.success = true;
            initResult.message = "Banco de dados inicializado com sucesso.";
            if (realtimeDB && firestore) {
                initResult.message += " Ambos Firestore e Realtime Database estão disponíveis.";
            } else if (realtimeDB) {
                initResult.message += " Apenas Realtime Database está disponível.";
            } else {
                initResult.message += " Apenas Firestore está disponível.";
            }
        } else {
            initResult.message = "Falha ao inicializar ambos os bancos de dados. Verifique a conexão e tente novamente.";
        }
        
        console.log("[DB-INIT] Resultado da inicialização:", initResult);
        return initResult;
        
    } catch (error) {
        console.error("[DB-INIT] ERRO CRÍTICO na inicialização do banco de dados:", error);
        return { 
            success: false, 
            message: "Erro crítico ao inicializar o banco de dados: " + error.message,
            details: [error.message, error.stack],
            databases: {
                firestore: false,
                realtimeDB: false
            }
        };
    }
}

/**
 * Verifica se o usuário admin já existe
 * @returns {Promise<boolean>}
 */
async function checkAdminExists() {
    try {
        // Verificar no Firestore
        const adminQuery = query(collection(db, "users"), where("username", "==", "admin"), limit(1));
        const querySnapshot = await getDocs(adminQuery);
        
        return !querySnapshot.empty;
    } catch (error) {
        console.error("[DB-INIT] Erro ao verificar usuário admin:", error);
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
            created: serverTimestamp(),
            lastLogin: null,
            emailVerified: true
        };
        
        // Salvar no Firestore
        await setDoc(doc(db, "users", "admin"), adminUser);
        
        console.log("Usuário administrador criado com sucesso!");
    } catch (error) {
        console.error("Erro ao criar usuário admin:", error);
        throw error;
    }
}

/**
 * Inicializa as coleções necessárias
 * @returns {Promise<void>}
 */
async function initializeCollections() {
    try {
        // Lista de coleções a serem criadas
        const collections = [
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
        
        // Verificar cada coleção
        for (const collectionName of collections) {
            await checkCollection(collectionName);
        }
        
        // Adicionar configurações iniciais
        await initializeSettings();
        
    } catch (error) {
        console.error("Erro ao inicializar coleções:", error);
        throw error;
    }
}

/**
 * Verifica se uma coleção já existe e cria um documento vazio se necessário
 * @param {string} collectionName - Nome da coleção
 * @returns {Promise<void>}
 */
async function checkCollection(collectionName) {
    try {
        // Verificar se a coleção tem documentos
        const querySnapshot = await getDocs(collection(db, collectionName));
        
        // Se não tiver documentos, criar um documento inicial
        if (querySnapshot.empty && collectionName !== "users") {
            await setDoc(doc(db, collectionName, "initial"), {
                created: serverTimestamp(),
                description: `Documento inicial para coleção ${collectionName}`
            });
            console.log(`Coleção ${collectionName} inicializada`);
        }
    } catch (error) {
        console.error(`Erro ao verificar coleção ${collectionName}:`, error);
    }
}

/**
 * Inicializa as configurações do sistema
 * @returns {Promise<void>}
 */
async function initializeSettings() {
    try {
        // Verificar se já existem configurações
        const settingsDoc = doc(db, "settings", "general");
        
        // Configurações iniciais
        const initialSettings = {
            systemName: "SisWeb - Sistema de Gestão de Madeiras",
            version: "1.0.0",
            defaultCurrency: "BRL",
            defaultVolumeUnit: "m³",
            lastUpdate: serverTimestamp(),
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
        
        // Verificar se já existe
        const settingsSnapshot = await getDoc(settingsDoc);
        if (!settingsSnapshot.exists()) {
            await setDoc(settingsDoc, initialSettings);
            console.log("Configurações iniciais criadas");
        }
    } catch (error) {
        console.error("Erro ao inicializar configurações:", error);
    }
}

/**
 * Inicializa dados de demonstração
 * @returns {Promise<void>}
 */
async function initializeDemoData() {
    try {
        // Verificar se existem clientes
        const clientsSnapshot = await getDocs(collection(db, "clients"));
        
        // Se não houver clientes (exceto o documento inicial), criar alguns exemplos
        if (clientsSnapshot.size <= 1) {
            console.log("Criando clientes de demonstração...");
            
            // Cliente 1
            await setDoc(doc(db, "clients", "demo1"), {
                name: "Madeireira Exemplo Ltda",
                email: "contato@madeireiraexemplo.com.br",
                phone: "(11) 98765-4321",
                address: "Rua das Madeiras, 123",
                city: "São Paulo",
                state: "SP",
                created: serverTimestamp()
            });
            
            // Cliente 2
            await setDoc(doc(db, "clients", "demo2"), {
                name: "Construtora Modelo S.A.",
                email: "contato@construtoramodelo.com.br",
                phone: "(11) 91234-5678",
                address: "Av. das Construções, 456",
                city: "São Paulo",
                state: "SP",
                created: serverTimestamp()
            });
            
            console.log("Clientes de demonstração criados");
        }
        
        // Verificar se existem espécies
        const speciesSnapshot = await getDocs(collection(db, "species"));
        
        // Se não houver espécies (exceto o documento inicial), criar alguns exemplos
        if (speciesSnapshot.size <= 1) {
            console.log("Criando espécies de demonstração...");
            
            // Espécie 1
            await setDoc(doc(db, "species", "demo1"), {
                name: "Cedro",
                scientificName: "Cedrela fissilis",
                density: 550,
                price: 250.00,
                unit: "m³"
            });
            
            // Espécie 2
            await setDoc(doc(db, "species", "demo2"), {
                name: "Ipê",
                scientificName: "Handroanthus sp.",
                density: 1050,
                price: 450.00,
                unit: "m³"
            });
            
            console.log("Espécies de demonstração criadas");
        }
    } catch (error) {
        console.error("Erro ao criar dados de demonstração:", error);
    }
}

// Exportar função principal
export { initializeDatabase }; 