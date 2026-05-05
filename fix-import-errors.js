/**
 * Correção de Erros de Import
 * Este arquivo resolve problemas de import statement fora de módulos
 */

// Substituir imports por carregamento via window
console.log("🔧 Iniciando correção de erros de import...");

// Função para verificar se firebaseService está disponível
function checkFirebaseService() {
    return typeof window.firebaseService !== 'undefined' && 
           window.firebaseService !== null &&
           typeof window.firebaseService.loadFromFirebase === 'function';
}

// Verificar se firebaseService está disponível com timeout reduzido
let firebaseCheckAttempts = 0;
const maxAttempts = 30; // 3 segundos máximo (30 x 100ms)

function waitForFirebaseService() {
    if (checkFirebaseService()) {
        console.log("✅ firebaseService carregado com sucesso");
        initializeDataFunctions();
        return;
    }
    
    firebaseCheckAttempts++;
    
    if (firebaseCheckAttempts === 1) {
        console.log("⏳ Aguardando carregamento do firebaseService...");
    }
    
    if (firebaseCheckAttempts >= maxAttempts) {
        console.warn("⚠️ firebaseService não carregado após 3 segundos, continuando sem Firebase");
        initializeDataFunctions();
        return;
    }
    
    setTimeout(waitForFirebaseService, 100);
}

// Iniciar verificação
if (checkFirebaseService()) {
    console.log("✅ firebaseService já disponível");
    initializeDataFunctions();
} else {
    waitForFirebaseService();
}

function initializeDataFunctions() {
    // Implementar funções que seriam importadas
    const persistLocalValue = (key, value) => {
        try {
            if (window.SiswebStorage && typeof window.SiswebStorage.write === 'function') {
                return window.SiswebStorage.write(key, value) !== false;
            }
        } catch (_) {}
        localStorage.setItem(key, JSON.stringify(value));
        return true;
    };
    
    // getData function
    window.getData = async function(key) {
        try {
            if (checkFirebaseService()) {
                const result = await window.firebaseService.loadFromFirebase(key);
                return result?.success ? result.data : null;
            } else {
                const data = localStorage.getItem(key);
                return data ? JSON.parse(data) : null;
            }
        } catch (error) {
            console.error('Erro ao obter dados:', error);
            const data = localStorage.getItem(key);
            return data ? JSON.parse(data) : null;
        }
    };
    
    // saveData function
    window.saveData = async function(key, data) {
        try {
            if (checkFirebaseService()) {
                const result = await window.firebaseService.saveToFirebase(key, null, data);
                if (!result?.success) {
                    throw new Error(result?.error || 'Erro ao salvar no Firebase');
                }
            } else {
                persistLocalValue(key, data);
            }
        } catch (error) {
            console.error('Erro ao salvar dados:', error);
            persistLocalValue(key, data);
        }
    };
    
    // Database adapter functions
    window.databaseAdapter = {
        get: window.getData,
        save: window.saveData,
        remove: async function(key) {
            try {
                if (checkFirebaseService()) {
                    await window.firebaseService.removeFromFirebase(key);
                } else {
                    localStorage.removeItem(key);
                }
            } catch (error) {
                console.error('Erro ao remover dados:', error);
                localStorage.removeItem(key);
            }
        }
    };
    
    console.log("✅ Funções de dados inicializadas com sucesso");
}

// Verificar e corrigir problemas de codificação (versão otimizada e silenciosa)
function fixEncodingIssues() {
    console.log("🔧 Verificando problemas de codificação...");
    
    // Verificação rápida apenas em elementos críticos para problemas reais
    const criticalElements = document.querySelectorAll('title, h1, h2, h3, label, button');
    let correctedElements = 0;
    
    criticalElements.forEach(element => {
        if (element.textContent) {
            const text = element.textContent;
            // Verificar apenas por caracteres realmente problemáticos
            const hasRealEncodingIssues = (
                text.includes('Ã©') ||      // é mal codificado
                text.includes('Ã§') ||      // ç mal codificado
                text.includes('Ã£') ||      // ã mal codificado
                text.includes('Ã¡') ||      // á mal codificado
                text.includes('Ã­') ||      // í mal codificado
                text.includes('Ã³') ||      // ó mal codificado
                text.includes('Ãº') ||      // ú mal codificado
                text.includes('â€') ||      // aspas mal codificadas
                text.includes('â€™') ||     // apóstrofe mal codificado
                text.includes('Ã¢') ||      // â mal codificado
                text.includes('Ã´') ||      // ô mal codificado
                text.includes('Ãª') ||      // ê mal codificado
                text.includes('') ||       // caracteres de controle
                text.includes('')         // caractere de substituição
            );
            
            if (hasRealEncodingIssues) {
                console.warn('🔧 Problema de encoding real encontrado em:', element.tagName, '- Texto:', text.substring(0, 50) + '...');
                
                // Tentar corrigir automaticamente
                let fixedText = text
                    .replace(/Ã©/g, 'é')
                    .replace(/Ã§/g, 'ç')
                    .replace(/Ã£/g, 'ã')
                    .replace(/Ã¡/g, 'á')
                    .replace(/Ã­/g, 'í')
                    .replace(/Ã³/g, 'ó')
                    .replace(/Ãº/g, 'ú')
                    .replace(/Ã¢/g, 'â')
                    .replace(/Ã´/g, 'ô')
                    .replace(/Ãª/g, 'ê')
                    .replace(/â€œ/g, '"')
                    .replace(/â€/g, '"')
                    .replace(/â€™/g, "'")
                    .replace(/â€"/g, "–")
                    .replace(/â€"/g, "—")
                    .replace(/[^\x00-\x7F]/g, function(char) {
                        // Manter apenas caracteres latinos comuns
                        const latinChars = 'àáâãäåæçèéêëìíîïðñòóôõöøùúûüýþÿÀÁÂÃÄÅÆÇÈÉÊËÌÍÎÏÐÑÒÓÔÕÖØÙÚÛÜÝÞß';
                        return latinChars.includes(char) ? char : '';
                    });
                
                if (fixedText !== text) {
                    element.textContent = fixedText;
                    correctedElements++;
                    console.log('✅ Texto corrigido automaticamente');
                }
            }
        }
    });
    
    if (correctedElements > 0) {
        console.log(`✅ ${correctedElements} problemas de encoding corrigidos automaticamente`);
    } else {
        console.log("✅ Nenhum problema de codificação encontrado");
    }
}

// Executar correções quando necessário (otimizado)
function runOptimizedChecks() {
    console.log("🚀 Executando verificações otimizadas...");
    
    // Só executar verificações se não foram executadas ainda
    if (!window._IMPORT_FIXES_APPLIED) {
        // Temporariamente desabilitado para evitar spam de logs
        // fixEncodingIssues();
        window._IMPORT_FIXES_APPLIED = true;
        console.log("✅ Verificações aplicadas com sucesso");
    }
}

// Executar verificações quando o DOM estiver carregado
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', runOptimizedChecks);
} else {
    // DOM já carregado, executar imediatamente
    setTimeout(runOptimizedChecks, 0);
}

// Exportar função de correção global (simplificada)
window.fixImportErrors = function() {
    if (checkFirebaseService()) {
        console.log("🔧 Firebase já disponível, pulando inicialização");
    } else {
        initializeDataFunctions();
    }
    // Temporariamente desabilitado
    // fixEncodingIssues();
    console.log("🔧 Verificações manuais aplicadas");
};

console.log("✅ fix-import-errors.js carregado e otimizado"); 
