// Função para verificar espaço disponível no localStorage
function checkLocalStorageSpace() {
    let total = 0;
    try {
        for (let key in localStorage) {
            if (localStorage.hasOwnProperty(key)) {
                total += (localStorage[key].length * 2) / 1024 / 1024; // MB
            }
        }
    } catch (e) {
        console.error('Erro ao verificar espaço:', e);
    }
    
    return {
        used: total.toFixed(2),
        percentage: (total / 5 * 100).toFixed(2) // Assumindo limite de 5MB
    };
}

// Função para limpar dados antigos quando espaço estiver crítico
function cleanOldData() {
    try {
        // Tentar limpar orçamentos antigos primeiro
        const budgets = getData('budgets') || [];
        if (budgets.length > 20) { // Manter apenas os 20 mais recentes
            budgets.sort((a, b) => {
                const dateA = new Date(a.date || 0);
                const dateB = new Date(b.date || 0);
                return dateB - dateA; // Ordenação decrescente por data
            });
            
            // Manter apenas os 20 mais recentes
            const newBudgets = budgets.slice(0, 20);
            saveData('budgets', newBudgets, false); // Usar false para evitar recursão
            console.log(`Limpeza: ${budgets.length - newBudgets.length} orçamentos antigos removidos`);
        }
        
        // Limpar romaneios antigos também
        ['romaneiosPct', 'romaneiosTl', 'romaneioPes', 'romaneioTora'].forEach(key => {
            const items = getData(key) || [];
            if (items.length > 15) { // Manter apenas os 15 mais recentes
                items.sort((a, b) => {
                    const dateA = new Date(a.data || 0);
                    const dateB = new Date(b.data || 0);
                    return dateB - dateA;
                });
                
                const newItems = items.slice(0, 15);
                saveData(key, newItems, false);
                console.log(`Limpeza: ${items.length - newItems.length} itens antigos removidos de ${key}`);
            }
        });
    } catch (e) {
        console.error('Erro ao limpar dados antigos:', e);
    }
}

// Função para obter dados do localStorage
function canonicalizeDataKey(key) {
    return String(key || '')
        .replace(/^data\/species(\/|$)/, 'especies$1')
        .replace(/^species(\/|$)/, 'especies$1')
        .replace(/^especiesPct(\/|$)/, 'especies$1');
}

function getData(key) {
    try {
        const canonicalKey = canonicalizeDataKey(key);
        console.log("Obtendo dados para chave:", canonicalKey);
        const data = localStorage.getItem(canonicalKey);
        return data ? JSON.parse(data) : [];
    } catch (error) {
        console.error("Erro ao obter dados para chave " + key + ":", error);
        return [];
    }
}

// Função para salvar dados no localStorage
function saveData(key, data, checkSpace = true) {
    try {
        // Verificar espaço antes de salvar, se solicitado
        if (checkSpace) {
            const space = checkLocalStorageSpace();
            if (space.percentage > 80) {
                console.warn(`Armazenamento local com ${space.percentage}% de uso (${space.used}MB). Tentando limpar dados antigos.`);
                cleanOldData();
            }
        }
        
        const canonicalKey = canonicalizeDataKey(key);
        console.log("Salvando dados para chave:", canonicalKey);
        localStorage.setItem(canonicalKey, JSON.stringify(data));
        return true;
    } catch (error) {
        console.error("Erro ao salvar dados para chave " + key + ":", error);
        
        // Se for erro de cota excedida, tentar limpar dados antigos
        if (error.name === 'QuotaExceededError' || error.name === 'NS_ERROR_DOM_QUOTA_REACHED') {
            alert('Armazenamento do navegador cheio. Alguns dados antigos serão removidos automaticamente.');
            
            // Tentar limpar dados antigos
            cleanOldData();
            
            // Tentar salvar novamente
            try {
                localStorage.setItem(canonicalizeDataKey(key), JSON.stringify(data));
                return true;
            } catch (retryError) {
                alert('Não foi possível salvar os dados. Recomendamos exportar seus dados importantes.');
                console.error('Erro após tentativa de limpeza:', retryError);
                return false;
            }
        }
        return false;
    }
}

// Expor funções para o escopo global
window.getData = getData;
window.saveData = saveData;
window.checkLocalStorageSpace = checkLocalStorageSpace;
window.cleanOldData = cleanOldData;
