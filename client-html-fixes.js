/**
 * Correções para client.html - Firebase-First Client Management
 * 
 * Este arquivo contém as correções para garantir que o client.html
 * sempre priorize o Firebase Realtime Database para todas as operações
 */

// ✅ FUNÇÃO CORRIGIDA: Salvar cliente priorizando Firebase
async function saveClientFirebaseFirst(e) {
    e.preventDefault();
    
    try {
        console.log("💾 === SALVANDO CLIENTE (client.html) ===");
        
        const clientData = {
            name: document.getElementById('name').value.trim(),
            cnpj: document.getElementById('cnpj').value.trim(),
            stateRegistration: document.getElementById('stateRegistration').value.trim(),
            address: document.getElementById('address').value.trim(),
            number: document.getElementById('number').value.trim(),
            neighborhood: document.getElementById('neighborhood').value.trim(),
            state: document.getElementById('state').value.trim(),
            city: document.getElementById('city').value.trim(),
            phone: document.getElementById('phone').value.trim(),
            obs: document.getElementById('obs').value.trim()
        };
        
        if (!clientData.name) {
            alert('Nome é obrigatório!');
            return;
        }
        
        // ✅ OBTER LISTA ATUAL DE CLIENTES SEMPRE DO FIREBASE
        let clients = await getData('clients') || [];
        
        // ✅ GARANTIR QUE É ARRAY
        if (!Array.isArray(clients)) {
            if (clients && typeof clients === 'object') {
                clients = Object.keys(clients).map(key => ({
                    id: key,
                    ...clients[key]
                }));
            } else {
                clients = [];
            }
        }
        
        // ✅ VERIFICAR SE ESTÁ EDITANDO OU CRIANDO
        if (editingId) {
            // Editando cliente existente
            const index = clients.findIndex(c => String(c.id) === String(editingId));
            if (index !== -1) {
                clients[index] = {
                    ...clientData,
                    id: editingId
                };
                console.log("✅ Cliente atualizado:", clientData.name);
            } else {
                // ID não encontrado, adicionar como novo
                clientData.id = editingId;
                clients.push(clientData);
                console.log("➕ Cliente adicionado (ID não encontrado):", clientData.name);
            }
        } else {
            // Criando novo cliente
            clientData.id = Date.now().toString();
            clients.push(clientData);
            console.log("➕ Novo cliente criado:", clientData.name);
        }
        
        // ✅ SALVAR NO FIREBASE COM PRIORIDADE
        if (await saveData('clients', clients)) {
            alert('Cliente salvo com sucesso!');
            clearForm();
            await showClientList();
        } else {
            alert('Erro ao salvar cliente');
        }
        
    } catch (error) {
        console.error("❌ Erro ao salvar cliente:", error);
        alert('Erro ao salvar cliente. Verifique sua conexão e tente novamente.');
    }
}

// ✅ FUNÇÃO CORRIGIDA: Excluir cliente priorizando Firebase
async function deleteClientFirebaseFirst(id) {
    if (!id) {
        console.error("❌ ID de cliente inválido para exclusão:", id);
        return;
    }
    
    if (!confirm('Tem certeza que deseja excluir este cliente?')) {
        return;
    }
    
    try {
        console.log("🗑️ === EXCLUINDO CLIENTE (client.html) ===");
        console.log("ID do cliente a ser excluído:", id);
        
        // ✅ OBTER LISTA ATUAL DE CLIENTES SEMPRE DO FIREBASE
        let clients = await getData('clients') || [];
        
        // ✅ GARANTIR QUE É ARRAY
        if (!Array.isArray(clients)) {
            if (clients && typeof clients === 'object') {
                clients = Object.keys(clients).map(key => ({
                    id: key,
                    ...clients[key]
                }));
            } else {
                clients = [];
            }
        }
        
        // ✅ ENCONTRAR E REMOVER CLIENTE
        const clienteParaExcluir = clients.find(c => String(c.id) === String(id));
        if (!clienteParaExcluir) {
            console.warn("⚠️ Cliente não encontrado para exclusão:", id);
            alert('Cliente não encontrado.');
            return;
        }
        
        // ✅ FILTRAR LISTA PARA REMOVER O CLIENTE
        const clientesAtualizados = clients.filter(c => String(c.id) !== String(id));
        
        console.log(`🗑️ Removendo cliente: ${clienteParaExcluir.name}`);
        console.log(`📊 Clientes antes: ${clients.length}, depois: ${clientesAtualizados.length}`);
        
        // ✅ SALVAR LISTA ATUALIZADA NO FIREBASE
        if (await saveData('clients', clientesAtualizados)) {
            await showClientList(currentPage);
            console.log("✅ Cliente excluído com sucesso");
        } else {
            throw new Error("Falha ao salvar no Firebase após exclusão");
        }
        
    } catch (error) {
        console.error("❌ Erro ao excluir cliente:", error);
        alert('Erro ao excluir cliente. Verifique sua conexão e tente novamente.');
    }
}

// ✅ FUNÇÃO CORRIGIDA: Editar cliente priorizando Firebase
async function editClientFirebaseFirst(id) {
    try {
        console.log("✏️ === EDITANDO CLIENTE (client.html) ===");
        
        // ✅ OBTER LISTA ATUAL DE CLIENTES SEMPRE DO FIREBASE
        let clients = await getData('clients') || [];
        
        // ✅ GARANTIR QUE É ARRAY
        if (!Array.isArray(clients)) {
            if (clients && typeof clients === 'object') {
                clients = Object.keys(clients).map(key => ({
                    id: key,
                    ...clients[key]
                }));
            } else {
                clients = [];
            }
        }
        
        // ✅ ENCONTRAR CLIENTE
        const client = clients.find(c => String(c.id) === String(id));
        
        if (client) {
            // ✅ PREENCHER FORMULÁRIO COM DADOS DO CLIENTE
            document.getElementById('name').value = client.name || client.nome || '';
            document.getElementById('cnpj').value = client.cnpj || '';
            document.getElementById('stateRegistration').value = client.stateRegistration || client.inscricaoEstadual || '';
            document.getElementById('address').value = client.address || client.endereco || '';
            document.getElementById('number').value = client.number || client.numero || '';
            document.getElementById('neighborhood').value = client.neighborhood || client.bairro || '';
            document.getElementById('state').value = client.state || client.estado || '';
            
            // ✅ CARREGAR CIDADES SE ESTADO ESTIVER PREENCHIDO
            if (client.state || client.estado) {
                await populateCitySelect(client.state || client.estado);
            }
            
            document.getElementById('city').value = client.city || client.cidade || '';
            document.getElementById('phone').value = client.phone || client.telefone || '';
            document.getElementById('obs').value = client.obs || client.observacoes || '';
            
            editingId = id;
            document.querySelector('button[type="submit"]').textContent = 'Atualizar Cliente';
            closeModal();
            
            console.log("✅ Formulário preenchido para edição:", client.name);
        } else {
            console.error("❌ Cliente não encontrado para edição:", id);
            alert('Cliente não encontrado.');
        }
        
    } catch (error) {
        console.error("❌ Erro ao editar cliente:", error);
        alert('Erro ao carregar dados do cliente. Verifique sua conexão e tente novamente.');
    }
}

// ✅ FUNÇÃO PARA APLICAR AS CORREÇÕES NO CLIENT.HTML
function applyClientHtmlFixes() {
    console.log("🔧 === APLICANDO CORREÇÕES CLIENT.HTML ===");
    
    // ✅ SOBRESCREVER FUNÇÃO saveClient
    if (typeof window.saveClient === 'function') {
        window.saveClientOriginal = window.saveClient;
        window.saveClient = saveClientFirebaseFirst;
        console.log("✅ Função saveClient substituída por versão Firebase-first");
    }
    
    // ✅ SOBRESCREVER FUNÇÃO deleteClient
    if (typeof window.deleteClient === 'function') {
        window.deleteClientOriginal = window.deleteClient;
        window.deleteClient = deleteClientFirebaseFirst;
        console.log("✅ Função deleteClient substituída por versão Firebase-first");
    }
    
    // ✅ SOBRESCREVER FUNÇÃO editClient
    if (typeof window.editClient === 'function') {
        window.editClientOriginal = window.editClient;
        window.editClient = editClientFirebaseFirst;
        console.log("✅ Função editClient substituída por versão Firebase-first");
    }
    
    // ✅ ADICIONAR FUNÇÕES AUXILIARES
    window.saveClientFirebaseFirst = saveClientFirebaseFirst;
    window.deleteClientFirebaseFirst = deleteClientFirebaseFirst;
    window.editClientFirebaseFirst = editClientFirebaseFirst;
    
    console.log("🎉 Correções do client.html aplicadas com sucesso!");
}

// ✅ APLICAR CORREÇÕES AUTOMATICAMENTE
if (typeof window !== 'undefined') {
    // Aplicar correções quando o DOM estiver carregado
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', applyClientHtmlFixes);
    } else {
        applyClientHtmlFixes();
    }
}

// ✅ EXPORTAR FUNÇÕES PARA USO EXTERNO
if (typeof module !== 'undefined' && module.exports) {
    module.exports = {
        saveClientFirebaseFirst,
        deleteClientFirebaseFirst,
        editClientFirebaseFirst,
        applyClientHtmlFixes
    };
} 