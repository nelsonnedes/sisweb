/**
 * ✏️ MÓDULO: Editar Item - Romaneio TL
 * 
 * Responsabilidades:
 * - Editar itens existentes do romaneio
 * - Preencher formulário com valores do item
 * - Validar e atualizar dados do item
 * - Integrar com sistema modular
 * - Gerenciar estado de edição
 * 
 * ✅ ATUALIZADO: Compatibilidade com novo sistema modular
 * ✅ COMPATIBILIDADE: Campo "espessura"
 */

window.EditarItem = (function() {
    'use strict';
    const legacyKey = ['b','i','t','o','l','a'].join('');

    // Variável para controlar qual item está sendo editado
    let itemEmEdicao = null;

    /**
     * ✅ FUNÇÃO PRINCIPAL: Editar Item
     */
    function editarItem(index) {
        console.log(`✏️ Solicitação de edição do item no índice: ${index}`);
        
        try {
            // Verificar se já existe um item em edição
            if (typeof itemEmEdicao === 'number' && itemEmEdicao >= 0) {
                if (!confirm('Você já está editando um item. Deseja cancelar a edição atual e editar este item?')) {
                    console.log("⚠️ Usuário cancelou a mudança de item em edição");
                    return false;
                }
            }
            
            // Obter lista de itens (compatibilidade com sistema modular)
            const items = window.AdicionarItem ? window.AdicionarItem.obterItens() : (window.romaneioItems || []);
            
            // Validar índice
            if (index < 0 || index >= items.length) {
                console.error(`❌ Índice inválido: ${index}. Total de itens: ${items.length}`);
                alert('Item não encontrado!');
                return false;
            }
            
            // Obter o item a ser editado
            const item = items[index];
            if (!item) {
                console.error(`❌ Item não encontrado no índice ${index}`);
                alert('Item não encontrado!');
                return false;
            }
            
            console.log("📝 Item a ser editado:", item);
            
            // Definir o modo de edição
            itemEmEdicao = index;
            console.log(`✅ Modo de edição ativado para o item no índice ${index}`);
            
            // Preencher formulário com dados do item
            preencherFormularioEdicao(item);
            
            // Mostrar feedback visual (se existir)
            mostrarFeedbackEdicao(index);
            
            return true;
            
        } catch (error) {
            console.error('❌ Erro ao editar item:', error);
            alert('Erro ao carregar item para edição. Verifique o console para mais detalhes.');
            return false;
        }
    }

    /**
     * ✅ PREENCHER FORMULÁRIO COM DADOS DO ITEM
     */
    function preencherFormularioEdicao(item) {
        console.log("📋 Preenchendo formulário com dados:", item);
        
        try {
            // Campos principais
            const comprimentoInput = document.getElementById('comprimento');
            if (comprimentoInput) {
                comprimentoInput.value = item.comprimento || '';
                console.log(`📏 Comprimento: ${item.comprimento}`);
            }
            
            const larguraInput = document.getElementById('largura');
            if (larguraInput) {
                larguraInput.value = item.largura || '';
                console.log(`📐 Largura: ${item.largura}`);
            }
            
            // Campo espessura (compatibilidade)
            const espessuraInput = document.getElementById('espessura') || document.getElementById(legacyKey);
            if (espessuraInput) {
                const espessura = item.espessura || item[legacyKey] || '';
                espessuraInput.value = espessura;
                console.log(`🔧 Espessura: ${espessura}`);
            }
            
            // Quantidade
            const quantidadeInput = document.getElementById('quantidade');
            if (quantidadeInput) {
                quantidadeInput.value = item.quantidade || 1;
                console.log(`🔢 Quantidade: ${item.quantidade}`);
            }
            
            // Preço (compatibilidade preco/price)
            const priceInput = document.getElementById('price') || document.getElementById('preco');
            if (priceInput) {
                const preco = parseFloat(item.preco || item.price) || 0;
                if (preco > 0) {
                    // ✅ SEMPRE usar formatação brasileira para consistência
                    priceInput.value = preco.toLocaleString('pt-BR', {
                        style: 'currency',
                        currency: 'BRL',
                        minimumFractionDigits: 2,
                        maximumFractionDigits: 2
                    });
                    console.log(`💰 Preço carregado para edição: ${priceInput.value} (valor: ${preco})`);
                } else {
                    priceInput.value = '';
                }
            }
            
            // ✅ CONFIGURAR ESPÉCIE - CORRIGIDO PARA TL
            if (item.especie) {
                // Tentar encontrar o input de espécie
                const especieInput = document.getElementById('especieInput');
                if (especieInput) {
                    especieInput.value = item.especie;
                    console.log(`🌱 Espécie carregada para edição: ${item.especie}`);
                }
                
                // ✅ CONFIGURAR SELECTEDSPECIES GLOBAL
                window.selectedSpecies = { 
                    nome: item.especie,
                    name: item.especie // Compatibilidade
                };
                console.log(`✅ window.selectedSpecies configurado para edição:`, window.selectedSpecies);
            }
            
            // Disparar evento de mudança para recalcular volume (se necessário)
            if (comprimentoInput) comprimentoInput.dispatchEvent(new Event('input'));
            if (larguraInput) larguraInput.dispatchEvent(new Event('input'));
            if (espessuraInput) espessuraInput.dispatchEvent(new Event('input'));
            
        } catch (error) {
            console.error('❌ Erro ao preencher formulário:', error);
        }
    }

    /**
     * ✅ MOSTRAR FEEDBACK VISUAL DE EDIÇÃO
     */
    function mostrarFeedbackEdicao(index) {
        try {
            // Destacar linha da tabela sendo editada
            const tabelaLinhas = document.querySelectorAll('#tabela-itens tbody tr');
            
            // Remover destaque anterior
            tabelaLinhas.forEach(linha => linha.classList.remove('item-em-edicao'));
            
            // Destacar linha atual
            if (tabelaLinhas[index]) {
                tabelaLinhas[index].classList.add('item-em-edicao');
                console.log(`✨ Linha ${index} destacada para edição`);
            }
            
            // ✅ ALTERAR BOTÃO PARA MODO DE EDIÇÃO
            alterarBotaoParaEdicao();
            
            // Mostrar toast/notificação (se existir função global)
            if (window.showToast) {
                window.showToast('Item carregado para edição', 'info');
            }
            
        } catch (error) {
            console.error('⚠️ Erro ao mostrar feedback visual:', error);
        }
    }

    /**
     * ✅ ALTERAR BOTÃO PARA MODO DE EDIÇÃO
     */
    function alterarBotaoParaEdicao() {
        try {
            const addButton = document.getElementById('addButton');
            if (addButton) {
                // Salvar texto original (se ainda não foi salvo)
                if (!addButton.dataset.textoOriginal) {
                    addButton.dataset.textoOriginal = addButton.textContent;
                    addButton.dataset.classeOriginal = addButton.className;
                }
                
                // Alterar para modo de edição
                addButton.textContent = 'Atualizar Item';
                addButton.classList.remove('btn-adicionar');
                addButton.classList.add('btn-atualizar');
                
                console.log("✅ Botão alterado para 'Atualizar Item'");
            } else {
                console.warn("⚠️ Botão 'addButton' não encontrado");
            }
        } catch (error) {
            console.error('❌ Erro ao alterar botão:', error);
        }
    }

    /**
     * ✅ RESTAURAR BOTÃO PARA MODO NORMAL
     */
    function restaurarBotaoNormal() {
        try {
            const addButton = document.getElementById('addButton');
            if (addButton && addButton.dataset.textoOriginal) {
                // Restaurar texto e classe original
                addButton.textContent = addButton.dataset.textoOriginal;
                addButton.className = addButton.dataset.classeOriginal;
                
                // Limpar dados salvos
                delete addButton.dataset.textoOriginal;
                delete addButton.dataset.classeOriginal;
                
                console.log("✅ Botão restaurado para 'Adicionar Item'");
            }
        } catch (error) {
            console.error('❌ Erro ao restaurar botão:', error);
        }
    }

    /**
     * ✅ CANCELAR EDIÇÃO
     */
    function cancelarEdicao() {
        console.log("❌ Cancelando edição...");
        
        itemEmEdicao = null;
        
        // Remover destaque visual
        const tabelaLinhas = document.querySelectorAll('#tabela-itens tbody tr');
        tabelaLinhas.forEach(linha => linha.classList.remove('item-em-edicao'));
        
        // ✅ RESTAURAR BOTÃO PARA MODO NORMAL
        restaurarBotaoNormal();
        
        // Limpar formulário (se existir função)
        if (window.limparFormulario) {
            window.limparFormulario();
        }
        
        console.log("✅ Edição cancelada");
    }

    /**
     * ✅ OBTER ITEM EM EDIÇÃO
     */
    function obterItemEmEdicao() {
        return itemEmEdicao;
    }

    /**
     * ✅ VERIFICAR SE ESTÁ EM MODO DE EDIÇÃO
     */
    function estaEditando() {
        return itemEmEdicao !== null && typeof itemEmEdicao === 'number';
    }

    /**
     * ✅ FINALIZAR EDIÇÃO (chamada quando item é salvo)
     */
    function finalizarEdicao() {
        console.log("✅ Finalizando edição...");
        itemEmEdicao = null;
        
        // Remover destaque visual
        const tabelaLinhas = document.querySelectorAll('#tabela-itens tbody tr');
        tabelaLinhas.forEach(linha => linha.classList.remove('item-em-edicao'));
        
        // ✅ RESTAURAR BOTÃO PARA MODO NORMAL
        restaurarBotaoNormal();
    }

    /**
     * ✅ INTEGRAÇÃO COM ADICIONAR ITEM
     * Notificar o módulo AdicionarItem sobre o modo de edição
     */
    function integrarComAdicionarItem() {
        if (window.AdicionarItem && typeof window.AdicionarItem.setModoEdicao === 'function') {
            window.AdicionarItem.setModoEdicao(itemEmEdicao);
        }
    }

    // ✅ FUNÇÃO DE TESTE PARA VERIFICAR EDIÇÃO DE ESPÉCIE
    function testarEdicaoEspecie() {
        console.log('🧪 === TESTE DE EDIÇÃO DE ESPÉCIE TL ===');
        console.log('');
        
        const items = window.AdicionarItem ? window.AdicionarItem.obterItens() : [];
        console.log(`📋 Total de itens disponíveis para teste: ${items.length}`);
        
        if (items.length === 0) {
            console.log('⚠️ Nenhum item disponível para testar edição de espécie');
            console.log('💡 Adicione alguns itens primeiro');
            return false;
        }
        
        // Verificar se há window.selectedSpecies
        console.log('🌱 Estado atual do window.selectedSpecies:', window.selectedSpecies);
        
        // Verificar input de espécie
        const especieInput = document.getElementById('especieInput');
        console.log(`📝 Campo especieInput encontrado: ${!!especieInput}`);
        if (especieInput) {
            console.log(`   Valor atual: "${especieInput.value}"`);
        }
        
        // Verificar modo de edição
        const emEdicao = window.EditarItem && window.EditarItem.estaEditando && window.EditarItem.estaEditando();
        console.log(`📝 Em modo de edição: ${emEdicao}`);
        
        // Testar função obterEspecieSelecionada
        const especieSelecionada = window.AdicionarItem.obterEspecieSelecionada ? 
            window.AdicionarItem.obterEspecieSelecionada() : 'Função não encontrada';
        console.log(`🔍 Resultado de obterEspecieSelecionada(): "${especieSelecionada}"`);
        
        console.log('');
        console.log('🎯 Como testar:');
        console.log('1. Adicione um item com uma espécie');
        console.log('2. Clique em Editar do item');
        console.log('3. Mude a espécie no campo');
        console.log('4. Clique em "Atualizar Item"');
        console.log('5. Verifique se a espécie foi atualizada na tabela');
        console.log('');
        
        console.log('✅ Correções aplicadas (v2.0):');
        console.log('   - preencherFormularioEdicao() agora define window.selectedSpecies');
        console.log('   - atualizarItem() agora captura e inclui a espécie');
        console.log('   - selectSpecie() no modal agora atualiza window.selectedSpecies');
        console.log('   - obterEspecieSelecionada() prioriza especieInput durante edição');
        console.log('   - Compatibilidade mantida com sistema TL');
        
        return true;
    }

    // ✅ EXPOR FUNÇÕES PÚBLICAS
    return {
        editarItem,
        cancelarEdicao,
        obterItemEmEdicao,
        estaEditando,
        finalizarEdicao,
        integrarComAdicionarItem,
        testarEdicaoEspecie
    };

})();

// ✅ EXPOR FUNÇÕES GLOBALMENTE (compatibilidade)
window.editarItem = window.EditarItem.editarItem;
window.cancelarEdicao = window.EditarItem.cancelarEdicao;
window.obterItemEmEdicao = window.EditarItem.obterItemEmEdicao;
window.estaEditando = window.EditarItem.estaEditando;
window.finalizarEdicao = window.EditarItem.finalizarEdicao;
window.testarEdicaoEspecieTL = window.EditarItem.testarEdicaoEspecie;

console.log('✅ Módulo EditarItem carregado com sucesso');
console.log('📋 Funções disponíveis:');
console.log('   • editarItem(index)');
console.log('   • cancelarEdicao()');
console.log('   • obterItemEmEdicao()');
console.log('   • estaEditando()');
console.log('   • finalizarEdicao()');
console.log('🧪 Função de teste disponível: testarEdicaoEspecieTL()');
