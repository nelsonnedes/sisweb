// ✅ CORREÇÃO GLOBAL - Funções críticas expostas no escopo global
// Arquivo criado para resolver erros de funções undefined

// Função para garantir que updateTableBody está disponível globalmente
if (!window.updateTableBody) {
    window.updateTableBody = function updateTableBody(tbody) {
        console.log("✅ updateTableBody chamada via global-functions-fix.js");
        
        if (!tbody) {
            console.error("Elemento tbody não encontrado");
            return;
        }
        
        if (!window.romaneioItems || !Array.isArray(window.romaneioItems)) {
            console.log("Array romaneioItems não encontrado ou vazio, inicializando tabela vazia");
            tbody.innerHTML = '<tr><td colspan="12" style="text-align: center;">Nenhum item adicionado</td></tr>';
            return;
        }
        
        // Limpar conteúdo atual
        tbody.innerHTML = '';
        
        // Inicializar a paginação se ainda não estiver definida
        if (typeof window.itemsPerPage === 'undefined') {
            window.itemsPerPage = 5;  // ✅ PADRONIZADO: 5 itens por página
        }
        if (typeof window.currentPage === 'undefined') {
            window.currentPage = 1;
        }
        
        // Calcular totais
        let totalVolumeBruto = 0;
        let totalVolumeSerraria = 0;
        let totalValor = 0;
        
        // Calcular índices para paginação
        const startIndex = (window.currentPage - 1) * window.itemsPerPage;
        const endIndex = Math.min(startIndex + window.itemsPerPage, window.romaneioItems.length);
        
        // Verificar se há itens
        if (window.romaneioItems.length === 0) {
            const row = document.createElement('tr');
            const cell = document.createElement('td');
            cell.colSpan = 12;
            cell.textContent = 'Nenhum item adicionado';
            cell.style.textAlign = 'center';
            row.appendChild(cell);
            tbody.appendChild(row);
        } else {
            // Gerar linhas para itens na página atual
            for (let i = startIndex; i < endIndex; i++) {
                const item = window.romaneioItems[i];
                
                // Calcular totais
                totalVolumeBruto += item.volumeBruto || 0;
                totalVolumeSerraria += item.volumeSerraria || 0;
                totalValor += (item.preco || 0) * (item.volumeSerraria || 0);
                
                // Criar linha
                const row = document.createElement('tr');
                
                // Função auxiliar para formatar moeda
                const formatCurrencyLocal = (value) => {
                    if (typeof window.formatCurrency === 'function') {
                        return window.formatCurrency(value);
                    }
                    return new Intl.NumberFormat('pt-BR', {
                        style: 'currency',
                        currency: 'BRL'
                    }).format(value);
                };
                
                // Adicionar células
                row.innerHTML = `
                    <td>${i + 1}</td>
                    <td>${item.especie || ''}</td>
                    <td>${item.plaqueta || ''}</td>
                    <td>${item.rodo ? item.rodo.toFixed(2) : '-'}</td>
                    <td>${item.comprimento ? item.comprimento.toFixed(2) : '-'}</td>
                    <td>${item.oco1 ? item.oco1.toFixed(2) : '-'}</td>
                    <td>${item.oco2 ? item.oco2.toFixed(2) : '-'}</td>
                    <td>${item.volumeBruto ? item.volumeBruto.toFixed(3) : '-'}</td>
                    <td>${item.volumeSerraria ? item.volumeSerraria.toFixed(3) : '-'}</td>
                    <td>${item.preco ? formatCurrencyLocal(item.preco) : 'R$ 0,00'}</td>
                    <td>${(item.preco && item.volumeSerraria) ? formatCurrencyLocal(item.preco * item.volumeSerraria) : 'R$ 0,00'}</td>
                    <td>
                        <button class="btn btn-sm btn-outline-primary" 
                                onclick="editarItem(${i})" 
                                title="Editar item">
                            <i class="fas fa-edit"></i>
                        </button>
                        <button class="btn btn-sm btn-outline-danger" 
                                onclick="excluirItem(${i})" 
                                title="Excluir item">
                            <i class="fas fa-trash"></i>
                        </button>
                    </td>
                `;
                
                tbody.appendChild(row);
            }
        }
        
        // Atualizar totais se os elementos existirem
        const totalVBElement = document.getElementById('totalVolumeBruto');
        const totalVSElement = document.getElementById('totalVolumeSerraria');
        const totalValorElement = document.getElementById('totalValor');
        
        if (totalVBElement) totalVBElement.textContent = totalVolumeBruto.toFixed(3);
        if (totalVSElement) totalVSElement.textContent = totalVolumeSerraria.toFixed(3);
        if (totalValorElement) {
            const formatCurrencyLocal = (value) => {
                if (typeof window.formatCurrency === 'function') {
                    return window.formatCurrency(value);
                }
                return new Intl.NumberFormat('pt-BR', {
                    style: 'currency',
                    currency: 'BRL'
                }).format(value);
            };
            totalValorElement.textContent = formatCurrencyLocal(totalValor);
        }
        
        console.log("✅ updateTableBody executada com sucesso");
    };
}

// ====================================================================
// IMPLEMENTAÇÕES CORRIGIDAS PARA ESPÉCIES E MODAIS
// ====================================================================

// ✅ Função corrigida para abrir lista de espécies
function openSpeciesListModal() {
    console.log("🌿 Abrindo lista de espécies...");
    
    // Verificar se a implementação principal existe
    if (window.openSpeciesListModal && typeof window.openSpeciesListModal === 'function') {
        console.log("✅ Usando implementação principal de openSpeciesListModal");
        return window.openSpeciesListModal();
    }
    
    // Implementação básica se não houver a principal
    console.log("⚠️ Implementação principal não encontrada, usando fallback");
    
    try {
        // Tentar encontrar o modal de espécies
        let modal = document.getElementById('speciesListModal');
        if (!modal) {
            console.log("🔄 Modal de espécies não encontrado, tentando criar estrutura básica");
            // Criar modal básico se não existir
            modal = document.createElement('div');
            modal.id = 'speciesListModal';
            modal.className = 'modal';
            modal.innerHTML = `
                <div class="modal-content">
                    <div class="modal-header">
                        <h2>Lista de Espécies</h2>
                        <span class="close" onclick="closeSpeciesListModal()">&times;</span>
                    </div>
                    <div class="modal-body">
                        <p>Carregando espécies...</p>
                        <div id="speciesListContainer"></div>
                    </div>
                </div>
            `;
            document.body.appendChild(modal);
        }
        
        modal.style.display = 'block';
        console.log("✅ Modal de espécies aberto (fallback)");
        
    } catch (error) {
        console.error("❌ Erro ao abrir modal de espécies:", error);
        alert('Erro ao abrir lista de espécies. Recarregue a página.');
    }
}

// ✅ Função corrigida para abrir novo modal de espécie
function openNewSpeciesModal() {
    console.log("🌿 Abrindo modal para nova espécie...");
    
    // Verificar se a implementação principal existe
    if (window.openNewSpeciesModal && typeof window.openNewSpeciesModal === 'function') {
        console.log("✅ Usando implementação principal de openNewSpeciesModal");
        return window.openNewSpeciesModal();
    }
    
    // Implementação básica se não houver a principal
    console.log("⚠️ Implementação principal não encontrada, usando fallback");
    
    try {
        // Tentar encontrar o modal de nova espécie
        let modal = document.getElementById('speciesModal');
        if (!modal) {
            console.log("🔄 Modal de nova espécie não encontrado, tentando criar estrutura básica");
            // Criar modal básico se não existir
            modal = document.createElement('div');
            modal.id = 'speciesModal';
            modal.className = 'modal';
            modal.innerHTML = `
                <div class="modal-content">
                    <div class="modal-header">
                        <h2 id="speciesModalTitle">Nova Espécie</h2>
                        <span class="close" onclick="closeSpeciesModal()">&times;</span>
                    </div>
                    <div class="modal-body">
                        <form id="speciesForm">
                            <input type="hidden" id="speciesId">
                            <div class="form-group">
                                <label for="speciesName">Nome da Espécie:</label>
                                <input type="text" id="speciesName" required>
                            </div>
                            <div class="form-group">
                                <label for="speciesDescription">Descrição:</label>
                                <textarea id="speciesDescription"></textarea>
                            </div>
                            <div class="form-actions">
                                <button type="submit">Salvar</button>
                                <button type="button" onclick="closeSpeciesModal()">Cancelar</button>
                            </div>
                        </form>
                    </div>
                </div>
            `;
            document.body.appendChild(modal);
        }
        
        // Resetar formulário
        const form = document.getElementById('speciesForm');
        if (form) form.reset();
        
        // Limpar ID (nova espécie)
        const idInput = document.getElementById('speciesId');
        if (idInput) idInput.value = '';
        
        // Atualizar título
        const title = document.getElementById('speciesModalTitle');
        if (title) title.textContent = 'Nova Espécie';
        
        modal.style.display = 'block';
        
        // Focar no campo de nome
        setTimeout(() => {
            const nameInput = document.getElementById('speciesName');
            if (nameInput) nameInput.focus();
        }, 100);
        
        console.log("✅ Modal de nova espécie aberto (fallback)");
        
    } catch (error) {
        console.error("❌ Erro ao abrir modal de nova espécie:", error);
        alert('Erro ao abrir modal de nova espécie. Recarregue a página.');
    }
}

// ✅ Funções auxiliares para fechar modais
function closeSpeciesListModal() {
    const modal = document.getElementById('speciesListModal');
    if (modal) {
        modal.style.display = 'none';
        console.log("✅ Modal de lista de espécies fechado");
    }
}

function closeSpeciesModal() {
    const modal = document.getElementById('speciesModal');
    if (modal) {
        modal.style.display = 'none';
        console.log("✅ Modal de espécie fechado");
    }
}

// Aguardar carregamento das funções do arquivo principal
document.addEventListener('DOMContentLoaded', function() {
    setTimeout(() => {
        // ✅ EXPOR FUNÇÕES DE ESPÉCIES CORRIGIDAS GLOBALMENTE
        window.openSpeciesListModal = openSpeciesListModal;
        window.openNewSpeciesModal = openNewSpeciesModal;
        window.closeSpeciesListModal = closeSpeciesListModal;
        window.closeSpeciesModal = closeSpeciesModal;
        
        console.log("✅ Funções de espécies expostas globalmente");
        
        // Expor funções de clientes/fornecedores se existirem no escopo local
        if (typeof openClientListModal !== 'undefined' && !window.openClientListModal) {
            window.openClientListModal = openClientListModal;
            console.log("✅ openClientListModal exposta globalmente");
        }
        
        if (typeof openNewClientModal !== 'undefined' && !window.openNewClientModal) {
            window.openNewClientModal = openNewClientModal;
            console.log("✅ openNewClientModal exposta globalmente");
        }
        
        if (typeof openEditClientModal !== 'undefined' && !window.openEditClientModal) {
            window.openEditClientModal = openEditClientModal;
            console.log("✅ openEditClientModal exposta globalmente");
        }
        
        console.log("✅ global-functions-fix.js: Verificação de funções concluída");
    }, 100);
});

console.log("✅ global-functions-fix.js carregado"); 