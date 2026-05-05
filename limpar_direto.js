// Script para limpar clientes undefined - Cole este código no console do navegador

// Função para recuperar clientes do localStorage
function getClients() {
    try {
        const data = localStorage.getItem('clients');
        return data ? JSON.parse(data) : [];
    } catch (e) {
        console.error('Erro ao recuperar clientes:', e);
        return [];
    }
}

// Função para salvar clientes no localStorage
function saveClients(clients) {
    try {
        if (window.SiswebStorage && typeof window.SiswebStorage.write === 'function') {
            window.SiswebStorage.write('clients', clients);
        } else {
            localStorage.setItem('clients', JSON.stringify(clients));
        }
        return true;
    } catch (e) {
        console.error('Erro ao salvar clientes:', e);
        return false;
    }
}

// Obter os clientes atuais
const clientsBefore = getClients();
console.log(`Total de clientes antes da limpeza: ${clientsBefore.length}`);

// Identificar clientes inválidos
const invalidClients = clientsBefore.filter(client => 
    !client.name || 
    client.name === 'undefined' || 
    client.name === undefined
);

console.log(`Clientes inválidos encontrados: ${invalidClients.length}`);

if (invalidClients.length > 0) {
    // Listar os clientes inválidos que serão removidos
    console.log('Clientes que serão removidos:');
    invalidClients.forEach((client, index) => {
        console.log(`${index + 1}. ID: ${client.id || 'N/A'}, Nome: ${client.name || 'undefined'}, Cidade: ${client.city || 'N/A'}`);
    });
    
    // Confirmar a remoção
    if (confirm(`Deseja remover ${invalidClients.length} clientes inválidos?`)) {
        // Filtrar apenas os clientes válidos
        const validClients = clientsBefore.filter(client => 
            client.name && 
            client.name !== 'undefined' && 
            client.name !== undefined
        );
        
        // Salvar os clientes válidos
        if (saveClients(validClients)) {
            console.log(`Limpeza concluída! Foram removidos ${invalidClients.length} clientes inválidos.`);
            console.log(`Total de clientes após a limpeza: ${validClients.length}`);
            alert(`Limpeza concluída com sucesso!\nForam removidos ${invalidClients.length} clientes inválidos.`);
        } else {
            console.error('Erro ao salvar as alterações.');
            alert('Erro ao salvar as alterações. Verifique o console para mais detalhes.');
        }
    } else {
        console.log('Operação cancelada pelo usuário.');
    }
} else {
    console.log('Não foram encontrados clientes inválidos para remover.');
    alert('Não foram encontrados clientes inválidos para remover.');
} 
