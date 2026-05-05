// Script para limpar espécies undefined - Cole este código no console do navegador

// Função para recuperar espécies do localStorage
function getSpecies() {
    try {
        const data = localStorage.getItem('species');
        return data ? JSON.parse(data) : [];
    } catch (e) {
        console.error('Erro ao recuperar espécies:', e);
        return [];
    }
}

// Função para salvar espécies no localStorage
function saveSpecies(species) {
    try {
        if (window.SiswebStorage && typeof window.SiswebStorage.write === 'function') {
            window.SiswebStorage.write('species', species);
        } else {
            localStorage.setItem('species', JSON.stringify(species));
        }
        return true;
    } catch (e) {
        console.error('Erro ao salvar espécies:', e);
        return false;
    }
}

// Obter as espécies atuais
const speciesBefore = getSpecies();
console.log(`Total de espécies antes da limpeza: ${speciesBefore.length}`);

// Identificar espécies inválidas
const invalidSpecies = speciesBefore.filter(specie => 
    (!specie.name && !specie.nome) || 
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
        const nome = specie.nome || specie.name || 'undefined';
        console.log(`${index + 1}. ID: ${specie.id || 'N/A'}, Nome: ${nome}, Descrição: ${specie.description || 'N/A'}`);
    });
    
    // Confirmar a remoção
    if (confirm(`Deseja remover ${invalidSpecies.length} espécies inválidas?`)) {
        // Filtrar apenas as espécies válidas
        const validSpecies = speciesBefore.filter(specie => 
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
