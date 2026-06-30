// Script para limpar espécies undefined - Cole este código no console do navegador

function resolveTenantId() {
    try {
        const services = [window.firebaseService, window.FirebaseService, window.firebaseServiceTL].filter(Boolean);
        for (const service of services) {
            if (typeof service.getCurrentTenantId === 'function') {
                const id = service.getCurrentTenantId();
                if (id) return String(id);
            }
            if (typeof service.getTenantId === 'function') {
                const id = service.getTenantId();
                if (id) return String(id);
            }
        }
        if (window.appTenantId) return String(window.appTenantId);
        if (window.companyInfo) {
            const id = window.companyInfo.companyId || window.companyInfo.companyID || window.companyInfo.tenantId || window.companyInfo.id;
            if (id) return String(id);
        }
        for (const key of ['company_info', 'companyInfo', 'currentUser', 'persistentUser']) {
            const raw = localStorage.getItem(key);
            if (!raw) continue;
            const info = JSON.parse(raw);
            const id = info && (info.companyId || info.companyID || info.tenantId || info.id || info.company_id);
            if (id) return String(id);
        }
    } catch (_) {}
    return '';
}

function getSpeciesStorageKeys() {
    const tenantId = resolveTenantId();
    if (!tenantId) return ['companies/__no_tenant__/especies'];
    return [
        `companies/${tenantId}/especies`,
        `company_${tenantId}__especies`,
        `company_${tenantId}__especies_cache`
    ];
}

function normalizeStoredSpecies(data) {
    if (Array.isArray(data)) return data;
    if (data && typeof data === 'object') {
        return Object.keys(data).map(id => ({ id, key: id, firebaseKey: id, ...data[id] }));
    }
    return [];
}

// Função para recuperar espécies do localStorage
function getSpecies() {
    try {
        for (const key of getSpeciesStorageKeys()) {
            const data = localStorage.getItem(key);
            if (!data) continue;
            return normalizeStoredSpecies(JSON.parse(data));
        }
        return [];
    } catch (e) {
        console.error('Erro ao recuperar espécies:', e);
        return [];
    }
}

// Função para salvar espécies no localStorage
function saveSpecies(species) {
    try {
        if (window.SiswebStorage && typeof window.SiswebStorage.write === 'function') {
            window.SiswebStorage.write('especies', species);
        } else {
            const payload = JSON.stringify(species);
            getSpeciesStorageKeys().forEach(key => localStorage.setItem(key, payload));
        }
        localStorage.removeItem('species');
        localStorage.removeItem('especies');
        localStorage.removeItem('especiesPct');
        localStorage.removeItem('data/species');
        return true;
    } catch (e) {
        console.error('Erro ao salvar espécies:', e);
        return false;
    }
}

// Obter as espécies atuais
if (!resolveTenantId()) {
    alert('Empresa/tenant não identificado. Limpeza cancelada para evitar alteração global de espécies.');
    throw new Error('Limpeza de espécies bloqueada: tenant/companyId indisponível.');
}

const speciesBefore = getSpecies();
console.log(`Total de espécies antes da limpeza: ${speciesBefore.length}`);

// Identificar espécies inválidas
const invalidSpecies = speciesBefore.filter(specie => 
    (!specie.especie && !specie.name && !specie.nome) ||
    specie.name === 'undefined' || 
    specie.name === undefined ||
    specie.nome === 'undefined' || 
    specie.nome === undefined
);

console.log(`Espécies inválidas encontradas: ${invalidSpecies.length}`);

if (invalidSpecies.length > 0) {
    // Listar as espécies inválidas que serão removidas
    console.log('Espécies que serão removidas:');
    invalidSpecies.forEach((specie, index) => {
        const nome = specie.especie || specie.nome || specie.name || 'undefined';
        console.log(`${index + 1}. ID: ${specie.id || 'N/A'}, Nome: ${nome}, Nome Científico: ${specie.nomeCientifico || specie.description || specie.descricao || 'N/A'}`);
    });
    
    // Confirmar a remoção
    if (confirm(`Deseja remover ${invalidSpecies.length} espécies inválidas?`)) {
        // Filtrar apenas as espécies válidas
        const validSpecies = speciesBefore.filter(specie => 
            (specie.especie && specie.especie !== 'undefined' && specie.especie !== undefined) ||
            (specie.name && specie.name !== 'undefined' && specie.name !== undefined) ||
            (specie.nome && specie.nome !== 'undefined' && specie.nome !== undefined)
        );
        
        // Salvar as espécies válidas
        if (saveSpecies(validSpecies)) {
            console.log(`Limpeza concluída! Foram removidas ${invalidSpecies.length} espécies inválidas.`);
            console.log(`Total de espécies após a limpeza: ${validSpecies.length}`);
            alert(`Limpeza concluída com sucesso!\nForam removidas ${invalidSpecies.length} espécies inválidas.`);
        } else {
            console.error('Erro ao salvar as alterações.');
            alert('Erro ao salvar as alterações. Verifique o console para mais detalhes.');
        }
    } else {
        console.log('Operação cancelada pelo usuário.');
    }
} else {
    console.log('Não foram encontradas espécies inválidas para remover.');
    alert('Não foram encontradas espécies inválidas para remover.');
} 
