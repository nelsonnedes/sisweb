/**
 * Script de Limpeza do Armazenamento Local
 * Este script ajuda a otimizar o espaço do localStorage removendo dados desnecessários
 * e compactando os dados existentes.
 */

// Função para obter dados do localStorage
function getData(key) {
    try {
        const data = localStorage.getItem(key);
        return data ? JSON.parse(data) : null;
    } catch (e) {
        console.error(`Erro ao recuperar dados de ${key}:`, e);
        return null;
    }
}

// Função para salvar dados no localStorage
function saveData(key, data) {
    try {
        if (window.SiswebStorage && typeof window.SiswebStorage.write === 'function') {
            window.SiswebStorage.write(key, data);
        } else {
            localStorage.setItem(key, JSON.stringify(data));
        }
        return true;
    } catch (e) {
        console.error(`Erro ao salvar dados em ${key}:`, e);
        return false;
    }
}

// Função para verificar o uso atual do localStorage
function checkStorageUsage() {
    let total = 0;
    let details = {};
    
    for (let key in localStorage) {
        if (localStorage.hasOwnProperty(key)) {
            const size = (localStorage[key].length * 2) / 1024; // KB
            total += size;
            details[key] = size.toFixed(2) + " KB";
        }
    }
    
    return {
        totalKB: total.toFixed(2),
        totalMB: (total / 1024).toFixed(2),
        details: details
    };
}

// Função para limpar orçamentos antigos
function limparOrcamentosAntigos(manterQuantidade = 20) {
    const budgets = getData('budgets') || [];
    if (budgets.length <= manterQuantidade) {
        console.log(`Não há orçamentos para limpar: ${budgets.length} de ${manterQuantidade} orçamentos`);
        return 0;
    }
    
    // Ordenar por data, mais recentes primeiro
    budgets.sort((a, b) => {
        const dateA = new Date(a.date || 0);
        const dateB = new Date(b.date || 0);
        return dateB - dateA;
    });
    
    const removidos = budgets.length - manterQuantidade;
    const novosOrcamentos = budgets.slice(0, manterQuantidade);
    
    if (saveData('budgets', novosOrcamentos)) {
        console.log(`Removidos ${removidos} orçamentos antigos`);
        return removidos;
    }
    
    return 0;
}

// Função para limpar romaneios antigos
function limparRomaneiosAntigos(manterQuantidade = 15) {
    let totalRemovidos = 0;
    
    // Lista de chaves dos diferentes tipos de romaneio
    const romaneiosKeys = ['romaneiosPct', 'romaneiosTl', 'romaneioPes', 'romaneioTora'];
    
    romaneiosKeys.forEach(key => {
        const romaneios = getData(key) || [];
        if (romaneios.length <= manterQuantidade) {
            console.log(`Não há romaneios para limpar em ${key}: ${romaneios.length} de ${manterQuantidade}`);
            return;
        }
        
        // Ordenar por data, mais recentes primeiro
        romaneios.sort((a, b) => {
            const dateA = new Date(a.data || 0);
            const dateB = new Date(b.data || 0);
            return dateB - dateA;
        });
        
        const removidos = romaneios.length - manterQuantidade;
        const novosRomaneios = romaneios.slice(0, manterQuantidade);
        
        if (saveData(key, novosRomaneios)) {
            console.log(`Removidos ${removidos} romaneios antigos de ${key}`);
            totalRemovidos += removidos;
        }
    });
    
    return totalRemovidos;
}

// Função para remover clientes inválidos
function limparClientesInvalidos() {
    const clients = getData('clients') || [];
    
    const clientesValidos = clients.filter(client => {
        return client && client.nome && 
               client.nome !== 'undefined' && 
               client.nome !== undefined;
    });
    
    const removidos = clients.length - clientesValidos.length;
    
    if (removidos > 0 && saveData('clients', clientesValidos)) {
        console.log(`Removidos ${removidos} clientes inválidos`);
    } else {
        console.log('Não foram encontrados clientes inválidos');
    }
    
    return removidos;
}

// Função para limpar espécies inválidas ou duplicadas
function limparEspeciesInvalidas() {
    const species = getData('especies') || [];
    
    // Filtrar espécies inválidas
    const especiesValidas = species.filter(specie => {
        const nome = specie.especie || specie.nome || specie.name;
        return specie && nome &&
               nome !== 'undefined' &&
               nome !== undefined;
    });
    
    // Remover duplicatas pelo nome
    const nomesVistos = {};
    const especiesSemDuplicatas = especiesValidas.filter(specie => {
        const nome = specie.especie || specie.nome || specie.name;
        if (nomesVistos[nome]) {
            return false;
        }
        nomesVistos[nome] = true;
        return true;
    });
    
    const removidos = species.length - especiesSemDuplicatas.length;
    
    if (removidos > 0 && saveData('especies', especiesSemDuplicatas)) {
        console.log(`Removidas ${removidos} espécies inválidas ou duplicadas`);
    } else {
        console.log('Não foram encontradas espécies inválidas ou duplicadas');
    }
    
    return removidos;
}

// Função principal de limpeza
function limparStorage() {
    console.log("Iniciando limpeza do armazenamento local...");
    
    // Verificar uso antes da limpeza
    const usoAntes = checkStorageUsage();
    console.log(`Uso atual: ${usoAntes.totalMB} MB (${usoAntes.totalKB} KB)`);
    
    // Executar limpezas
    const orcamentosRemovidos = limparOrcamentosAntigos();
    const romaneiosRemovidos = limparRomaneiosAntigos();
    const clientesRemovidos = limparClientesInvalidos();
    const especiesRemovidas = limparEspeciesInvalidas();
    
    // Verificar uso após a limpeza
    const usoDepois = checkStorageUsage();
    console.log(`Uso após limpeza: ${usoDepois.totalMB} MB (${usoDepois.totalKB} KB)`);
    console.log(`Economia: ${(usoAntes.totalKB - usoDepois.totalKB).toFixed(2)} KB`);
    
    // Mostrar total de itens removidos
    const totalRemovidos = orcamentosRemovidos + romaneiosRemovidos + clientesRemovidos + especiesRemovidas;
    console.log(`Total de itens removidos: ${totalRemovidos}`);
    
    return {
        antes: usoAntes,
        depois: usoDepois,
        economia: (usoAntes.totalKB - usoDepois.totalKB).toFixed(2) + " KB",
        itemsRemovidos: totalRemovidos
    };
}

// Executar a limpeza se este script for carregado diretamente
if (typeof window !== 'undefined') {
    window.limparStorage = limparStorage;
    window.checkStorageUsage = checkStorageUsage;
} 
