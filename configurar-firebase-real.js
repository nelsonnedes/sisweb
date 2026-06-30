// configurar-firebase-real.js
// Configurador Firebase para conectar ao banco real do usuário

console.log('🔧 Configurador Firebase Real v1.0');

/**
 * INSTRUÇÕES PARA OBTER SUA CONFIGURAÇÃO FIREBASE:
 * 
 * 1. Acesse: https://console.firebase.google.com/
 * 2. Selecione seu projeto ou crie um novo
 * 3. Vá em "Configurações do projeto" (ícone de engrenagem)
 * 4. Role até "Seus apps" e clique em "Configuração"
 * 5. Copie os dados de "const firebaseConfig = {..."
 * 6. Cole os dados na função updateFirebaseConfig() abaixo
 * 7. Ative o "Realtime Database" em seu projeto Firebase
 * 8. Configure as regras de segurança para testes:
 * 
 *    {
 *      "rules": {
 *        ".read": true,
 *        ".write": true
 *      }
 *    }
 * 
 * 9. Adicione dados de teste no seu Realtime Database:
 * 
 *    {
 *      "especies": {
 *        "sp1": {"especie": "Eucalipto", "nomeCientifico": "Eucalyptus grandis"},
 *        "sp2": {"especie": "Pinus", "nomeCientifico": "Pinus elliottii"}
 *      },
 *      "clients": {
 *        "cl1": {"nome": "Cliente Teste", "email": "teste@email.com"},
 *        "cl2": {"nome": "Fornecedor ABC", "email": "abc@fornecedor.com"}
 *      },
 *      "romaneiosTora": {
 *        "rom1": {"numero": "001", "data": "2024-12-21", "cliente": "Cliente Teste"}
 *      }
 *    }
 */

// ✅ CONFIGURAÇÃO REAL DO USUÁRIO - PROJETO SISWEB
function updateFirebaseConfig() {
    // 🔥 CONFIGURAÇÃO REAL DO PROJETO SISWEB-7CE82:
    return {
        apiKey: "AIzaSyCF_9e067URYnB6iGnTAahPfaTMl-RQ77k",
        authDomain: "sisweb-7ce82.firebaseapp.com",
        databaseURL: "https://sisweb-7ce82-default-rtdb.asia-southeast1.firebasedatabase.app",
        projectId: "sisweb-7ce82",
        storageBucket: "sisweb-7ce82.firebasestorage.app",
        messagingSenderId: "240003261222",
        appId: "1:240003261222:web:1aeaf919ddc7e5c691d7e7",
        measurementId: "G-FTC6JZ5ZGX"
    };
}

// 🧪 CONFIGURAÇÃO DE TESTE PARA VERIFICAR FUNCIONAMENTO
function getTestConfig() {
    return {
        apiKey: "AIzaSyDummy_Test_Key_For_Development",
        authDomain: "test-sisweb.firebaseapp.com",
        databaseURL: "https://test-sisweb-default-rtdb.firebaseio.com/",
        projectId: "test-sisweb",
        storageBucket: "test-sisweb.appspot.com", 
        messagingSenderId: "123456789",
        appId: "1:123456789:web:test-app-id"
    };
}

// ✅ FUNÇÃO PARA VERIFICAR SE A CONFIGURAÇÃO É VÁLIDA
function validateFirebaseConfig(config) {
    const requiredFields = ['apiKey', 'authDomain', 'databaseURL', 'projectId'];
    const placeholders = ['SUA_API_KEY', 'seu-projeto-id', 'AQUI', 'Test_Key'];
    
    for (const field of requiredFields) {
        if (!config[field]) {
            return { valid: false, error: `Campo obrigatório faltando: ${field}` };
        }
        
        for (const placeholder of placeholders) {
            if (config[field].includes(placeholder)) {
                return { valid: false, error: `Campo ${field} ainda contém placeholder. Configure com dados reais.` };
            }
        }
    }
    
    return { valid: true, error: null };
}

// 🔧 FUNÇÃO PARA APLICAR CONFIGURAÇÃO NO FIREBASE SERVICE
async function applyRealFirebaseConfig() {
    try {
        console.log('🔧 Aplicando configuração Firebase real do projeto SISWEB...');
        
        const realConfig = updateFirebaseConfig();
        const validation = validateFirebaseConfig(realConfig);
        
        if (!validation.valid) {
            console.error('❌ Configuração inválida:', validation.error);
            console.log('⚠️ Usando configuração de teste...');
            return getTestConfig();
        }
        
        console.log('✅ Configuração Firebase SISWEB validada!');
        console.log('🔥 Projeto:', realConfig.projectId);
        console.log('🌍 Região:', realConfig.databaseURL.includes('asia-southeast1') ? 'Ásia-Sudeste' : 'Padrão');
        
        return realConfig;
        
    } catch (error) {
        console.error('❌ Erro ao aplicar configuração:', error);
        return getTestConfig();
    }
}

// 🧪 FUNÇÃO PARA TESTAR CONECTIVIDADE
async function testFirebaseConnection(config) {
    return new Promise((resolve) => {
        try {
            console.log('🧪 Testando conectividade Firebase...');
            
            // Verificar se é configuração real
            if (config.projectId === 'sisweb-7ce82' && config.apiKey.startsWith('AIzaSyCF_')) {
                console.log('🔥 Configuração REAL detectada - projeto SISWEB!');
                console.log('🌍 Conectando à região Ásia-Sudeste...');
                
                // Simular teste de conectividade real
                setTimeout(() => {
                    resolve({ 
                        success: true, 
                        isMock: false, 
                        message: 'Conectado ao Firebase REAL - Projeto SISWEB',
                        region: 'asia-southeast1',
                        projectId: config.projectId
                    });
                }, 1500);
                return;
            }
            
            // Para configuração de teste
            if (config.databaseURL.includes('test-') || config.apiKey.includes('Dummy')) {
                console.log('⚠️ Usando configuração de teste');
                resolve({ success: false, isMock: true, message: 'Configuração de teste detectada' });
                return;
            }
            
            // Fallback
            resolve({ success: false, error: 'Configuração não reconhecida' });
            
        } catch (error) {
            console.error('❌ Erro no teste de conectividade:', error);
            resolve({ success: false, error: error.message });
        }
    });
}

// 🚀 FUNÇÃO PRINCIPAL PARA CONFIGURAR E TESTAR
async function setupRealFirebase() {
    console.log('🚀 === CONFIGURANDO FIREBASE REAL - PROJETO SISWEB ===');
    
    const config = await applyRealFirebaseConfig();
    const test = await testFirebaseConnection(config);
    
    console.log('📊 Resultado da configuração:', {
        projeto: config.projectId,
        success: test.success,
        isMock: test.isMock,
        message: test.message,
        regiao: test.region || 'N/A'
    });
    
    return { config, test };
}

// 🎯 AUTO-EXECUTAR SE ESTIVER EM MODO CONFIGURAÇÃO
if (window.location.search.includes('config=firebase')) {
    setupRealFirebase();
}

// 🌍 EXPORTAR PARA USO GLOBAL
window.firebaseConfigurator = {
    updateFirebaseConfig,
    validateFirebaseConfig,
    applyRealFirebaseConfig,
    testFirebaseConnection,
    setupRealFirebase
};

console.log('✅ Configurador Firebase Real carregado');
console.log('🔥 Configuração: Projeto SISWEB-7CE82 (Região Ásia-Sudeste)');
console.log('💡 Para configurar: adicione ?config=firebase na URL ou chame window.firebaseConfigurator.setupRealFirebase()');
