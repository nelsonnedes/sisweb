/**
 * Script de inicialização do banco de dados
 * Cria a estrutura inicial do banco de dados e adiciona dados iniciais
 */

import { db, rtdb } from './firebase-config.js';
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
        console.log("Iniciando inicialização do banco de dados...");
        
        // Verificar se estamos usando Firestore ou Realtime Database
        let firestore = false;
        let realtimeDB = false;
        
        // Tentar inicializar Realtime Database
        try {
            console.log("Tentando inicializar Realtime Database...");
            const rtdbResult = await initializeRealtimeDatabase();
            if (rtdbResult.success) {
                console.log("Realtime Database inicializado com sucesso:", rtdbResult.message);
                realtimeDB = true;
            } else {
                console.warn("Aviso ao inicializar Realtime Database:", rtdbResult.message);
            }
        } catch (rtdbError) {
            console.error("Erro ao inicializar Realtime Database:", rtdbError);
        }
        
        // Tentar inicializar Firestore se necessário
        if (!realtimeDB) {
            try {
                console.log("Tentando inicializar Firestore...");
                // Verificar se o banco está acessível
                try {
                    console.log("Verificando acesso ao Firestore...");
                    const settingsRef = doc(db, "settings", "check");
                    await getDoc(settingsRef);
                    console.log("Acesso ao Firestore confirmado!");
                    firestore = true;
                } catch (accessError) {
                    console.error("Erro ao acessar Firestore:", accessError);
                    return { 
                        success: false, 
                        message: "Erro ao acessar o Firestore. Verifique a conexão com a internet e as configurações do Firebase." 
                    };
                }
                
                // Verificar se o usuário admin já existe
                const adminExists = await checkAdminExists();
                console.log(`Verificação de admin existente: ${adminExists}`);
                
                if (!adminExists) {
                    // Criar usuário admin
                    await createAdminUser();
                }
                
                // Criar coleções iniciais se não existirem
                await initializeCollections();
                
                // Inicializar dados de demonstração
                await initializeDemoData();
                
                console.log("Firestore inicializado com sucesso!");
                firestore = true;
            } catch (firestoreError) {
                console.error("Erro ao inicializar Firestore:", firestoreError);
            }
        }
        
        if (realtimeDB || firestore) {
            console.log("Banco de dados inicializado com sucesso!");
            return { success: true, message: "Banco de dados inicializado com sucesso!" };
        } else {
            console.error("Nenhum banco de dados foi inicializado!");
            return { success: false, message: "Falha ao inicializar o banco de dados. Nenhum banco disponível." };
        }
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
        const q = query(
            collection(db, "users"),
            where("role", "==", "admin"),
            limit(1)
        );
        
        const querySnapshot = await getDocs(q);
        return !querySnapshot.empty;
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