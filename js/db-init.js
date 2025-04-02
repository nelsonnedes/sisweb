/**
 * Script de inicialização do banco de dados Firestore
 * Cria a estrutura inicial do banco de dados e adiciona dados iniciais
 */

import { db } from './firebase-config.js';
import { 
    collection, 
    doc, 
    setDoc, 
    getDocs, 
    query, 
    where, 
    limit, 
    serverTimestamp 
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

/**
 * Inicializa o banco de dados com coleções necessárias
 * @returns {Promise<Object>} Status da inicialização
 */
export async function initializeDatabase() {
    try {
        console.log("Inicializando banco de dados...");
        
        // Verificar se o usuário admin já existe
        const adminExists = await checkAdminExists();
        
        if (!adminExists) {
            // Criar usuário admin
            await createAdminUser();
        }
        
        // Criar coleções iniciais se não existirem
        await initializeCollections();
        
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
        
        // Salvar configurações
        await setDoc(settingsDoc, initialSettings);
        
        console.log("Configurações inicializadas com sucesso!");
    } catch (error) {
        console.error("Erro ao inicializar configurações:", error);
    }
}

/**
 * Inicializa dados de demonstração para teste
 * @returns {Promise<void>}
 */
async function initializeDemoData() {
    try {
        // Verificar se já existem dados de demonstração
        const demoFlagRef = doc(db, "settings", "demoData");
        
        // Criar espécies de madeira de exemplo
        const especiesData = [
            { 
                name: "Pinus", 
                description: "Madeira macia, fácil de trabalhar",
                density: 480,
                averagePrice: 1200.00,
                unit: "m³",
                category: "Madeira de reflorestamento",
                active: true
            },
            { 
                name: "Eucalipto", 
                description: "Alta resistência, versátil",
                density: 650,
                averagePrice: 1500.00,
                unit: "m³",
                category: "Madeira de reflorestamento",
                active: true
            },
            { 
                name: "Cedro", 
                description: "Madeira nobre, resistente a insetos",
                density: 600,
                averagePrice: 3500.00,
                unit: "m³",
                category: "Madeira nobre",
                active: true
            }
        ];
        
        // Salvar as espécies
        for (let i = 0; i < especiesData.length; i++) {
            const especieDoc = {
                ...especiesData[i],
                created: serverTimestamp(),
                updated: serverTimestamp()
            };
            
            await setDoc(doc(db, "species", `demo-especie-${i+1}`), especieDoc);
        }
        
        // Salvar flag de dados de demonstração
        await setDoc(demoFlagRef, {
            created: serverTimestamp(),
            hasDemo: true
        });
        
        console.log("Dados de demonstração inicializados com sucesso!");
    } catch (error) {
        console.error("Erro ao criar dados de demonstração:", error);
    }
}

// Exportar função principal
export { initializeDatabase }; 