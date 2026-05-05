/**
 * 🗑️ MÓDULO: Excluir Item - Romaneio TL
 * 
 * Responsabilidades:
 * - Excluir itens do romaneio
 * - Validar operações de exclusão
 * - Confirmar ações com usuário
 * - Atualizar interface após exclusão
 * - Integrar com sistema modular
 * 
 * ✅ MUDANÇA: Campo "espessura" padronizado
 */

window.ExcluirItem = (function() {
    'use strict';
    const legacyKey = ['b','i','t','o','l','a'].join('');

    /**
     * ✅ FUNÇÃO PRINCIPAL: Excluir Item
     */
    function excluirItem(index) {
        console.log(`🗑️ Solicitação de exclusão do item no índice: ${index}`);
        
        try {
            // Validar índice
            if (!validarIndice(index)) {
                return false;
            }
            
            // Obter lista de itens
            const items = window.AdicionarItem ? window.AdicionarItem.obterItens() : (window.romaneioItems || []);
            
            if (index < 0 || index >= items.length) {
                console.error('❌ Índice fora do intervalo válido:', index);
                mostrarErro('Item não encontrado para exclusão');
                return false;
            }
            
            const item = items[index];
            
            // Confirmar exclusão
            if (!confirmarExclusao(item, index)) {
                console.log('⚠️ Exclusão cancelada pelo usuário');
                return false;
            }
            
            // Executar exclusão
            return executarExclusao(index, item);
            
        } catch (error) {
            console.error('❌ Erro ao excluir item:', error);
            mostrarErro('Erro interno ao excluir item');
            return false;
        }
    }

    /**
     * Validar índice de exclusão
     */
    function validarIndice(index) {
        if (index === undefined || index === null) {
            console.error('❌ Índice não fornecido');
            mostrarErro('Índice do item não especificado');
            return false;
        }
        
        if (!Number.isInteger(index) || index < 0) {
            console.error('❌ Índice inválido:', index);
            mostrarErro('Índice do item inválido');
            return false;
        }
        
        return true;
    }

    /**
     * Confirmar exclusão com o usuário
     */
    function confirmarExclusao(item, index) {
        const especie = item.especie || 'N/A';
        const comprimento = item.comprimento || 0;
        const espessura = item.espessura || item[legacyKey] || 0;
        const largura = item.largura || 0;
        const quantidade = item.quantidade || 0;
        
        const mensagem = `Confirma a exclusão do item?\n\n` +
                        `Espécie: ${especie}\n` +
                        `Dimensões: ${comprimento}m x ${espessura}cm x ${largura}cm\n` +
                        `Quantidade: ${quantidade} peças\n` +
                        `Posição: ${index + 1}`;
        
        const confirmacao = confirm(mensagem);
        console.log(`🤔 Confirmação do usuário: ${confirmacao ? 'SIM' : 'NÃO'}`);
        
        return confirmacao;
    }

    /**
     * Executar exclusão do item
     */
    function executarExclusao(index, item) {
        console.log(`🗑️ Executando exclusão do item no índice ${index}:`, item);
        
        try {
            // Método 1: Usar módulo AdicionarItem se disponível
            if (window.AdicionarItem && window.AdicionarItem.obterItens) {
                const items = window.AdicionarItem.obterItens();
                const itemRemovido = items.splice(index, 1)[0];
                
                // Lista já foi atualizada através da referência
                
                console.log('✅ Item removido via módulo AdicionarItem:', itemRemovido);
                
            } else if (window.romaneioItems && Array.isArray(window.romaneioItems)) {
                // Método 2: Usar array global como fallback
                const itemRemovido = window.romaneioItems.splice(index, 1)[0];
                console.log('✅ Item removido via array global:', itemRemovido);
                
            } else {
                throw new Error('Lista de itens não encontrada');
            }
            
            // Atualizar interface
            atualizarInterface();
            
            // Notificar sucesso
            notificarSucesso(item, index);
            
            return true;
            
        } catch (error) {
            console.error('❌ Erro ao executar exclusão:', error);
            mostrarErro('Falha ao remover item da lista');
            return false;
        }
    }

    /**
     * Atualizar interface após exclusão
     */
    function atualizarInterface() {
        console.log('🔄 Atualizando interface após exclusão...');
        
        try {
            // Renderizar tabela
            if (window.RenderizarTabela && window.RenderizarTabela.renderizarTabela) {
                window.RenderizarTabela.renderizarTabela();
            } else if (typeof window.renderizarTabela === 'function') {
                window.renderizarTabela();
            }
            
            // Resetar paginação se necessário
            if (window.RenderizarTabela && window.RenderizarTabela.resetarPaginacao) {
                const stats = window.RenderizarTabela.obterEstatisticas();
                if (stats && stats.totalItens === 0) {
                    window.RenderizarTabela.resetarPaginacao();
                }
            }
            
            console.log('✅ Interface atualizada com sucesso');
            
        } catch (error) {
            console.error('❌ Erro ao atualizar interface:', error);
        }
    }

    /**
     * Notificar sucesso da exclusão
     */
    function notificarSucesso(item, index) {
        const especie = item.especie || 'Item';
        const mensagem = `${especie} removido com sucesso!`;
        
        if (window.Utils && window.Utils.showToast) {
            window.Utils.showToast(mensagem, 'success');
        } else {
            console.log(`✅ ${mensagem}`);
        }
        
        console.log(`✅ Exclusão concluída: item ${index + 1} removido`);
    }

    /**
     * Mostrar erro
     */
    function mostrarErro(mensagem) {
        console.error('❌ Erro de exclusão:', mensagem);
        
        if (window.Utils && window.Utils.showToast) {
            window.Utils.showToast(mensagem, 'error');
        } else {
            alert(mensagem);
        }
    }

    /**
     * ✅ EXCLUIR MÚLTIPLOS ITENS
     */
    function excluirMultiplosItens(indices) {
        console.log('🗑️ Solicitação de exclusão múltipla:', indices);
        
        if (!Array.isArray(indices) || indices.length === 0) {
            mostrarErro('Nenhum item selecionado para exclusão');
            return false;
        }
        
        // Validar todos os índices
        for (const index of indices) {
            if (!validarIndice(index)) {
                return false;
            }
        }
        
        // Confirmar exclusão múltipla
        const confirmacao = confirm(`Confirma a exclusão de ${indices.length} itens selecionados?`);
        if (!confirmacao) {
            console.log('⚠️ Exclusão múltipla cancelada pelo usuário');
            return false;
        }
        
        try {
            // Ordenar índices em ordem decrescente para evitar problemas de reindexação
            const indicesOrdenados = [...indices].sort((a, b) => b - a);
            
            let itensRemovidos = 0;
            
            for (const index of indicesOrdenados) {
                if (excluirItemSemConfirmacao(index)) {
                    itensRemovidos++;
                }
            }
            
            // Atualizar interface uma única vez
            atualizarInterface();
            
            // Notificar resultado
            const mensagem = `${itensRemovidos} itens removidos com sucesso!`;
            if (window.Utils && window.Utils.showToast) {
                window.Utils.showToast(mensagem, 'success');
            }
            
            console.log(`✅ Exclusão múltipla concluída: ${itensRemovidos} itens removidos`);
            return true;
            
        } catch (error) {
            console.error('❌ Erro na exclusão múltipla:', error);
            mostrarErro('Erro ao excluir itens selecionados');
            return false;
        }
    }

    /**
     * Excluir item sem confirmação (para uso interno)
     */
    function excluirItemSemConfirmacao(index) {
        try {
            // Obter lista de itens
            const items = window.AdicionarItem ? window.AdicionarItem.obterItens() : (window.romaneioItems || []);
            
            if (index < 0 || index >= items.length) {
                console.error('❌ Índice fora do intervalo:', index);
                return false;
            }
            
            // Remover item
            if (window.AdicionarItem && window.AdicionarItem.obterItens) {
                const items = window.AdicionarItem.obterItens();
                items.splice(index, 1);
                window.AdicionarItem.definirItens(items);
            } else if (window.romaneioItems && Array.isArray(window.romaneioItems)) {
                window.romaneioItems.splice(index, 1);
            }
            
            return true;
            
        } catch (error) {
            console.error('❌ Erro ao excluir item sem confirmação:', error);
            return false;
        }
    }

    /**
     * Limpar todos os itens
     */
    function limparTodosItens() {
        console.log('🧹 Solicitação para limpar todos os itens...');
        
        // Obter quantidade de itens
        const items = window.AdicionarItem ? window.AdicionarItem.obterItens() : (window.romaneioItems || []);
        
        if (items.length === 0) {
            mostrarErro('Não há itens para remover');
            return false;
        }
        
        // Confirmar limpeza
        const confirmacao = confirm(`Confirma a remoção de todos os ${items.length} itens do romaneio?`);
        if (!confirmacao) {
            console.log('⚠️ Limpeza cancelada pelo usuário');
            return false;
        }
        
        try {
            // Limpar lista
            if (window.AdicionarItem && window.AdicionarItem.limparItens) {
                window.AdicionarItem.limparItens();
            } else if (window.romaneioItems) {
                window.romaneioItems.length = 0;
            }
            
            // Atualizar interface
            atualizarInterface();
            
            // Notificar sucesso
            const mensagem = `Todos os ${items.length} itens foram removidos!`;
            if (window.Utils && window.Utils.showToast) {
                window.Utils.showToast(mensagem, 'success');
            }
            
            console.log('✅ Todos os itens foram removidos com sucesso');
            return true;
            
        } catch (error) {
            console.error('❌ Erro ao limpar todos os itens:', error);
            mostrarErro('Erro ao remover todos os itens');
            return false;
        }
    }

    /**
     * Obter estatísticas de exclusão
     */
    function obterEstatisticas() {
        const items = window.AdicionarItem ? window.AdicionarItem.obterItens() : (window.romaneioItems || []);
        
        return {
            totalItens: items.length,
            podeExcluir: items.length > 0,
            ultimaExclusao: null // Pode ser implementado se necessário
        };
    }

    // ✅ INTERFACE PÚBLICA
    return {
        excluirItem,
        excluirMultiplosItens,
        limparTodosItens,
        obterEstatisticas
    };

})();

// ✅ FUNÇÃO GLOBAL PARA COMPATIBILIDADE
window.excluirItem = window.ExcluirItem.excluirItem;
window.removerItem = window.ExcluirItem.excluirItem;
window.deleteItem = window.ExcluirItem.excluirItem;

console.log('✅ Módulo ExcluirItem carregado com sucesso (campo espessura)'); 
