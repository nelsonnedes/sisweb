/**
 * DEEP CLEAN UTILITY
 * Realiza uma limpeza completa dos dados do navegador para resetar o estado da aplicação.
 */

async function deepCleanAndReload() {
    console.log("🧹 Iniciando limpeza profunda do sistema...");
    
    const statusDiv = document.createElement('div');
    statusDiv.style.position = 'fixed';
    statusDiv.style.top = '0';
    statusDiv.style.left = '0';
    statusDiv.style.width = '100%';
    statusDiv.style.height = '100%';
    statusDiv.style.backgroundColor = 'rgba(0,0,0,0.8)';
    statusDiv.style.color = 'white';
    statusDiv.style.zIndex = '99999';
    statusDiv.style.display = 'flex';
    statusDiv.style.flexDirection = 'column';
    statusDiv.style.alignItems = 'center';
    statusDiv.style.justifyContent = 'center';
    statusDiv.style.fontFamily = 'monospace';
    statusDiv.innerHTML = '<h2>Limpando Sistema...</h2><div id="clean-log" style="text-align:left; max-height:80vh; overflow:auto;"></div>';
    document.body.appendChild(statusDiv);
    
    const log = (msg) => {
        console.log(msg);
        const logEl = document.getElementById('clean-log');
        if (logEl) {
            logEl.innerHTML += `<div>${msg}</div>`;
            logEl.scrollTop = logEl.scrollHeight;
        }
    };

    try {
        // 1. Limpar LocalStorage e SessionStorage
        log("🗑️ Limpando Storage...");
        localStorage.clear();
        sessionStorage.clear();
        log("✅ Storage limpo.");

        // 2. Limpar Cookies
        log("🍪 Limpando Cookies...");
        document.cookie.split(";").forEach((c) => {
            document.cookie = c.replace(/^ +/, "").replace(/=.*/, "=;expires=" + new Date().toUTCString() + ";path=/");
        });
        log("✅ Cookies limpos.");

        // 3. Desregistrar Service Workers
        log("👷 Verificando Service Workers...");
        if ('serviceWorker' in navigator) {
            const registrations = await navigator.serviceWorker.getRegistrations();
            for (const registration of registrations) {
                await registration.unregister();
                log(`✅ Service Worker desregistrado: ${registration.scope}`);
            }
        }

        // 4. Limpar Cache API
        log("📦 Limpando Cache Storage...");
        if ('caches' in window) {
            const keys = await caches.keys();
            for (const key of keys) {
                await caches.delete(key);
                log(`✅ Cache deletado: ${key}`);
            }
        }

        // 5. Limpar IndexedDB (Firebase Persistence)
        log("🗄️ Limpando IndexedDB...");
        if (window.indexedDB) {
            const dbs = await window.indexedDB.databases ? await window.indexedDB.databases() : [];
            // Se databases() não for suportado, tenta nomes comuns do Firebase
            const dbNames = dbs.map(db => db.name).concat([
                'firebase-local-storage', 
                'firebase-heartbeat-database',
                'firebase-installations-database',
                'undefined', // Às vezes criado por erro
                'sisweb-7ce82-default-rtdb' // Possível nome interno
            ]);
            
            // Deduplicar
            const uniqueDbNames = [...new Set(dbNames)];

            for (const name of uniqueDbNames) {
                if (!name) continue;
                try {
                    await new Promise((resolve, reject) => {
                        const req = window.indexedDB.deleteDatabase(name);
                        req.onsuccess = () => {
                            log(`✅ Banco deletado: ${name}`);
                            resolve();
                        };
                        req.onerror = (e) => {
                            log(`⚠️ Erro ao deletar banco ${name}: ${e.target.error}`);
                            resolve(); // Continua mesmo com erro
                        };
                        req.onblocked = () => {
                            log(`⚠️ Banco bloqueado (feche outras abas): ${name}`);
                            resolve();
                        };
                    });
                } catch (e) {
                    log(`⚠️ Falha ao tentar deletar ${name}: ${e.message}`);
                }
            }
        }

        log("✨ Limpeza concluída! Reiniciando em 3 segundos...");
        
        setTimeout(() => {
            // Forçar recarregamento ignorando cache
            window.location.reload(true);
        }, 3000);

    } catch (error) {
        log(`❌ Erro fatal durante limpeza: ${error.message}`);
        setTimeout(() => window.location.reload(), 5000);
    }
}

// Expor globalmente
window.deepCleanAndReload = deepCleanAndReload;
