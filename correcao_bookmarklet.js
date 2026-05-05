/**
 * 🔖 BOOKMARKLET - CORREÇÃO HÍBRIDA ROMANEIOS
 * 
 * Como usar:
 * 1. Copie todo o código abaixo (a partir de "javascript:")
 * 2. Adicione como um favorito no navegador
 * 3. Acesse vendas.html (ou outra página do sistema)
 * 4. Clique no favorito criado
 * 
 * CÓDIGO DO BOOKMARKLET (copie tudo numa linha):
 */

javascript:(function(){
    console.log('🔧 CORREÇÃO HÍBRIDA INICIADA');

    function persistLocalValue(key, data) {
        try {
            if (window.SiswebStorage && typeof window.SiswebStorage.write === 'function') {
                return window.SiswebStorage.write(key, data) !== false;
            }
        } catch (_) {}
        localStorage.setItem(key, JSON.stringify(data));
        return true;
    }
    
    // Backup funções originais
    const origGetData = window.getData;
    const origSaveData = window.saveData;
    
    // Implementar getData híbrido
    window.getData = async function(key) {
        try {
            // Firebase primeiro
            if (window.firebaseService && window.firebaseService.authService) {
                try {
                    const data = await window.firebaseService.authService.getUserData(key);
                    if (data) {
                        persistLocalValue(key, data);
                        console.log(`✅ ${key}: Firebase (${Array.isArray(data) ? data.length : 'obj'} itens)`);
                        return data;
                    }
                } catch (e) {
                    console.warn(`⚠️ Firebase erro ${key}:`, e.message);
                }
            }
            
            // localStorage fallback
            const local = localStorage.getItem(key);
            if (local) {
                const parsed = JSON.parse(local);
                console.log(`📱 ${key}: localStorage (${Array.isArray(parsed) ? parsed.length : 'obj'} itens)`);
                return parsed;
            }
            
            // Função original
            if (origGetData) {
                const result = await origGetData(key);
                if (result) {
                    console.log(`🔄 ${key}: função original`);
                    return result;
                }
            }
            
            console.log(`ℹ️ ${key}: não encontrado`);
            return null;
        } catch (error) {
            console.error(`❌ ${key}:`, error);
            return null;
        }
    };
    
    // Implementar saveData híbrido
    window.saveData = async function(key, data) {
        try {
            // localStorage primeiro
            persistLocalValue(key, data);
            console.log(`📱 ${key}: salvo localmente`);
            
            // Firebase se disponível
            if (window.firebaseService && window.firebaseService.authService) {
                try {
                    await window.firebaseService.authService.saveUserData(key, data);
                    console.log(`☁️ ${key}: sincronizado Firebase`);
                    return { success: true, source: 'both' };
                } catch (e) {
                    console.warn(`⚠️ Firebase save ${key}:`, e.message);
                    return { success: true, source: 'localStorage' };
                }
            }
            
            return { success: true, source: 'localStorage' };
        } catch (error) {
            console.error(`❌ Save ${key}:`, error);
            return { success: false, error: error.message };
        }
    };
    
    // Verificar dados existentes
    const keys = ['romaneiosPct', 'romaneiosTL', 'romaneiosTora'];
    let total = 0;
    
    keys.forEach(key => {
        try {
            const data = localStorage.getItem(key);
            if (data) {
                const parsed = JSON.parse(data);
                const count = Array.isArray(parsed) ? parsed.length : 0;
                total += count;
                console.log(`📋 ${key}: ${count} itens`);
            } else {
                console.log(`📋 ${key}: vazio`);
            }
        } catch (e) {
            console.log(`📋 ${key}: erro`);
        }
    });
    
    // Atualizar interface se possível
    if (typeof window.carregarRomaneios === 'function') {
        setTimeout(() => {
            window.carregarRomaneios().then(() => {
                console.log('🔄 Interface atualizada');
            }).catch(e => {
                console.warn('⚠️ Erro ao atualizar interface:', e);
            });
        }, 500);
    }
    
    // Resultado
    if (total > 0) {
        alert(`✅ CORREÇÃO APLICADA!\n\n📊 Total: ${total} romaneios\n🔧 Funções híbridas ativadas\n\nOs dados devem aparecer na interface.`);
    } else {
        alert(`⚠️ CORREÇÃO APLICADA!\n\n🔧 Funções híbridas ativadas\n📊 Nenhum dado encontrado\n\nCrie alguns romaneios primeiro.`);
    }
    
    console.log('✅ CORREÇÃO HÍBRIDA COMPLETA!');
})();


/**
 * 📋 INSTRUÇÕES DETALHADAS:
 * 
 * Para criar o bookmarklet:
 * 1. Copie APENAS a linha que começa com "javascript:" acima
 * 2. No navegador, clique com botão direito na barra de favoritos
 * 3. Escolha "Adicionar página" ou "Novo favorito"
 * 4. Nome: "🔧 Corrigir Romaneios"
 * 5. URL: Cole o código copiado
 * 6. Salve
 * 
 * Para usar:
 * 1. Abra vendas.html (ou qualquer página do sistema)
 * 2. Clique no favorito "🔧 Corrigir Romaneios"
 * 3. Aguarde a mensagem de confirmação
 * 4. Atualize a página se necessário (F5)
 * 
 * O que faz:
 * - Implementa estratégia híbrida (Firebase + localStorage)
 * - Corrige funções getData e saveData
 * - Verifica dados existentes
 * - Atualiza interface automaticamente
 * - Mostra relatório de status
 */ 
