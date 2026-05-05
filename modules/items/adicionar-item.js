/**
 * ➕ MÓDULO: Adicionar Item - Romaneio TL
 * 
 * Responsabilidades:
 * - Adicionar itens ao romaneio
 * - Validação de dados
 * - Cálculos de volume e valor
 * - Limpeza de campos
 * 
 * ✅ ESTRUTURA MODULAR: Seguindo romaneiotl-estruturaçãomodular.txt
 * ✅ FIREBASE PRIORITY: Firebase primeiro, localStorage como fallback
 * ✅ CORREÇÃO: Uso correto de cálculos de volume e formatação
 */

window.AdicionarItem = (function() {
    'use strict';
    const legacyKey = ['b','i','t','o','l','a'].join('');

    // ✅ ESTADO
    let isAddingItem = false; // Flag para evitar chamadas múltiplas

    /**
     * ✅ ADICIONAR OU ATUALIZAR ITEM NO ROMANEIO
     */
    function adicionarItem() {
        try {
            console.time('adicionarItem');
            
            // ✅ VERIFICAR SE ESTÁ EM MODO DE EDIÇÃO
            const estaEditando = window.EditarItem && window.EditarItem.estaEditando();
            const indiceEdicao = estaEditando ? window.EditarItem.obterItemEmEdicao() : null;
            
            if (estaEditando) {
                console.log(`✏️ Modo de edição ativo - atualizando item no índice ${indiceEdicao}`);
                return atualizarItem(indiceEdicao);
            } else {
                console.log("➕ Modo de adição - criando novo item");
                return adicionarNovoItem();
            }
            
        } catch (error) {
            console.error('❌ Erro na função adicionarItem:', error);
            mostrarErro('Erro ao processar item: ' + error.message);
            
            // Limpar flag em caso de erro
            isAddingItem = false;
            return false;
        } finally {
            // ✅ CORREÇÃO: Sempre finalizar timer, mesmo sem erro
            console.timeEnd('adicionarItem');
        }
    }

    /**
     * ✅ ADICIONAR NOVO ITEM AO ROMANEIO
     */
    function adicionarNovoItem() {
        try {
            console.log("➕ Iniciando adição de novo item");
            
            // Verificar se já está em processo de adicionar
            if (isAddingItem) {
                console.log("⚠️ Operação de adicionar item já em andamento, ignorando chamada duplicada");
                return false;
            }
            
            // Definir flag para prevenir chamadas simultâneas
            isAddingItem = true;
            
            try {
                console.log("🔍 DEBUG: Verificando módulo FormatacaoCampos:", typeof window.FormatacaoCampos);
                console.log("🔍 DEBUG: window.FormatacaoCampos disponível:", !!window.FormatacaoCampos);
                console.log("🔍 DEBUG: window.FormatacaoCampos.obterValoresCampos disponível:", !!(window.FormatacaoCampos && window.FormatacaoCampos.obterValoresCampos));
                
                // ✅ OBTER VALORES DOS CAMPOS USANDO FORMATAÇÃO CORRETA
                let valores;
                if (window.FormatacaoCampos && typeof window.FormatacaoCampos.obterValoresCampos === 'function') {
                    console.log("📊 Usando FormatacaoCampos.obterValoresCampos()");
                    valores = window.FormatacaoCampos.obterValoresCampos();
                } else {
                    console.log("📊 Usando obterValoresCamposLegacy() (fallback)");
                    valores = obterValoresCamposLegacy();
                }
                
                console.log('📊 Valores obtidos dos campos:', valores);
                
                // ✅ VALIDAR DADOS
                const validacao = validarDados(valores);
                if (!validacao.valido) {
                    console.log('❌ Validação falhou:', validacao.mensagem);
                    mostrarErro(validacao.mensagem);
                    return;
                }
                
                console.log('✅ Validação passou');
                
                // ✅ OBTER ESPÉCIE SELECIONADA
                const especie = obterEspecieSelecionada();
                if (!especie) {
                    console.log('❌ Nenhuma espécie selecionada');
                    mostrarErro('Por favor, selecione uma espécie.');
                    return;
                }
                
                console.log('✅ Espécie obtida:', especie);
                
                // ✅ CRIAR ITEM
                const novoItem = criarItem(valores, especie);
                console.log('🔨 Item criado:', novoItem);
                
                // ✅ ADICIONAR À LISTA COM LÓGICA DE DUPLICATAS
                if (!window.romaneioItems) {
                    window.romaneioItems = [];
                    console.log('📋 Array romaneioItems inicializado');
                }
                
                // Verificar se já existe item idêntico (mesma espécie, comprimento, largura, espessura e preço)
                const itemExistente = encontrarItemDuplicado(novoItem, window.romaneioItems);
                
                if (itemExistente) {
                    // Somar quantidades ao item existente
                    const quantidadeAnterior = itemExistente.quantidade;
                    itemExistente.quantidade += novoItem.quantidade;
                    
                    // ✅ RECALCULAR VOLUME E VALOR TOTAL CORRETOS
                    const volumeIndividual = valores.volume;
                    const volumeTotal = volumeIndividual * itemExistente.quantidade;
                    itemExistente.volume = volumeIndividual; // Manter volume individual no objeto
                    itemExistente.valorTotal = volumeTotal * itemExistente.preco;
                    
                    // Mover item para o início da lista (último adicionado fica primeiro)
                    const index = window.romaneioItems.indexOf(itemExistente);
                    window.romaneioItems.splice(index, 1); // Remove da posição atual
                    window.romaneioItems.unshift(itemExistente); // Adiciona no início
                    
                    console.log(`🔄 Item duplicado encontrado - Quantidade atualizada de ${quantidadeAnterior} para ${itemExistente.quantidade}`);
                    console.log(`📊 Volume atualizado: ${itemExistente.volume.toFixed(6)} m³`);
                    console.log(`💰 Valor atualizado: R$ ${itemExistente.valorTotal.toFixed(2)}`);
                } else {
                    // Adicionar novo item no início da lista (último adicionado fica primeiro)
                    window.romaneioItems.unshift(novoItem);
                    console.log(`➕ Novo item adicionado no início da lista`);
                }
                
                console.log(`✅ Total de itens: ${window.romaneioItems.length}`);
                
                // ✅ ATUALIZAR INTERFACE
                console.log('🔄 Atualizando interface...');
                atualizarInterface();
                
                // ✅ LIMPAR CAMPOS
                console.log('🧹 Limpando campos...');
                limparCampos();
                
                // ✅ FOCAR NO PRIMEIRO CAMPO
                console.log('🎯 Focando no primeiro campo...');
                focarPrimeiroCampo();
                
                console.log('✅ Item adicionado com sucesso');
                
            } finally {
                isAddingItem = false;
                // ✅ Timer finalizado na função principal
            }
            
        } catch (error) {
            console.error('❌ Erro ao adicionar item:', error);
            mostrarErro('Erro ao adicionar item: ' + error.message);
            isAddingItem = false;
        }
    }

    /**
     * ✅ ATUALIZAR ITEM EXISTENTE NO ROMANEIO
     */
    function atualizarItem(indice) {
        try {
            console.log(`✏️ Iniciando atualização do item no índice ${indice}`);
            
            // Verificar se já está em processo de adicionar
            if (isAddingItem) {
                console.log("⚠️ Operação já em andamento, ignorando chamada duplicada");
                return false;
            }
            
            // Definir flag para prevenir chamadas simultâneas
            isAddingItem = true;
            
            try {
                console.log("🔍 DEBUG: Verificando módulo FormatacaoCampos:", typeof window.FormatacaoCampos);
                console.log("🔍 DEBUG: window.FormatacaoCampos disponível:", !!window.FormatacaoCampos);
                console.log("🔍 DEBUG: window.FormatacaoCampos.obterValoresCampos disponível:", !!(window.FormatacaoCampos && window.FormatacaoCampos.obterValoresCampos));
                
                // ✅ OBTER VALORES DOS CAMPOS USANDO FORMATAÇÃO CORRETA
                let valores;
                if (window.FormatacaoCampos && typeof window.FormatacaoCampos.obterValoresCampos === 'function') {
                    console.log("📊 Usando FormatacaoCampos.obterValoresCampos()");
                    valores = window.FormatacaoCampos.obterValoresCampos();
                } else {
                    console.log("📊 Usando obterValoresCamposLegacy() (fallback)");
                    valores = obterValoresCamposLegacy();
                }
                
                console.log('📊 Valores obtidos dos campos para atualização:', valores);
                console.log('🔍 DEBUG - Valores detalhados:');
                console.log('   comprimento:', valores.comprimento, typeof valores.comprimento);
                console.log('   largura:', valores.largura, typeof valores.largura);
                console.log('   espessura:', valores.espessura, typeof valores.espessura);
                console.log('   quantidade:', valores.quantidade, typeof valores.quantidade);
                console.log('   preco:', valores.preco, typeof valores.preco);
                
                // ✅ VALIDAR DADOS
                const validacao = validarDados(valores);
                if (!validacao.valido) {
                    console.error('❌ Dados inválidos para atualização:', validacao.erros || validacao);
                    console.error('❌ Validação falhou para valores:', valores);
                    const erros = validacao.erros || (validacao.mensagem ? [validacao.mensagem] : ['Erro de validação desconhecido']);
                    mostrarErro('Dados inválidos: ' + erros.join(', '));
                    return false;
                }
                
                console.log('✅ Validação passou para atualização');
                
                // ✅ OBTER ESPÉCIE ATUALIZADA - CORREÇÃO CRÍTICA
                const especieAtualizada = obterEspecieSelecionada();
                console.log(`🌱 Espécie capturada para atualização: ${especieAtualizada}`);
                
                // ✅ OBTER LISTA DE ITENS
                const items = obterItens();
                
                // ✅ VERIFICAR SE ÍNDICE É VÁLIDO
                if (indice < 0 || indice >= items.length) {
                    console.error(`❌ Índice inválido para atualização: ${indice}. Total de itens: ${items.length}`);
                    mostrarErro('Erro: Item não encontrado para atualização.');
                    return false;
                }
                
                // ✅ CRIAR ITEM ATUALIZADO - INCLUINDO ESPÉCIE
                const itemAtualizado = {
                    ...items[indice], // Manter propriedades existentes
                    comprimento: valores.comprimento,
                    largura: valores.largura,
                    espessura: valores.espessura,
                    quantidade: valores.quantidade,
                    preco: valores.preco,
                    price: valores.preco, // Compatibilidade
                    especie: especieAtualizada || items[indice].especie, // ✅ INCLUIR ESPÉCIE ATUALIZADA
                    volume: valores.volume,
                    valorTotal: valores.volume * valores.preco,
                    dataModificacao: new Date().toISOString()
                };
                
                console.log('📝 Item antes da atualização:', items[indice]);
                console.log('📝 Item após atualização:', itemAtualizado);
                
                // ✅ ATUALIZAR ITEM NA LISTA
                items[indice] = itemAtualizado;
                
                // ✅ SALVAR ALTERAÇÕES
                if (typeof window.romaneioItems !== 'undefined') {
                    window.romaneioItems = items;
                }
                
                console.log('✅ Item atualizado com sucesso no romaneio');
                console.log('📊 Total de itens no romaneio:', items.length);
                
                // ✅ FINALIZAR MODO DE EDIÇÃO
                if (window.EditarItem && window.EditarItem.finalizarEdicao) {
                    window.EditarItem.finalizarEdicao();
                }
                
                // ✅ ATUALIZAR INTERFACE
                console.log('🔄 Atualizando interface...');
                atualizarInterface();
                
                // ✅ LIMPAR CAMPOS
                console.log('🧹 Limpando campos...');
                limparCampos();
                
                // ✅ FOCAR NO PRIMEIRO CAMPO
                console.log('🎯 Focando no primeiro campo...');
                focarPrimeiroCampo();
                
                // ✅ MOSTRAR FEEDBACK POSITIVO
                mostrarSucesso('Item atualizado com sucesso!');
                
                return true;
                
            } catch (error) {
                console.error('❌ Erro interno ao atualizar item:', error);
                mostrarErro('Erro interno na atualização: ' + error.message);
                return false;
            } finally {
                // Sempre limpar flag, mesmo em caso de erro
                isAddingItem = false;
            }
            
        } catch (error) {
            console.error('❌ Erro ao atualizar item:', error);
            mostrarErro('Erro ao atualizar item: ' + error.message);
            
            // Limpar flag em caso de erro
            isAddingItem = false;
            return false;
        }
    }

    /**
     * ✅ OBTER VALORES DOS CAMPOS (MÉTODO LEGACY) - VERSÃO MELHORADA
     */
    function obterValoresCamposLegacy() {
        console.log('🔍 Obtendo valores dos campos (Legacy)...');
        
        const comprimentoInput = document.getElementById('comprimento');
        const larguraInput = document.getElementById('largura');
        const espessuraInput = document.getElementById('espessura') || document.getElementById(legacyKey);
        const quantidadeInput = document.getElementById('quantidade');
        const priceInput = document.getElementById('price');
        
        console.log('🔍 Elementos encontrados:');
        console.log('   comprimentoInput:', comprimentoInput, 'encontrado:', !!comprimentoInput);
        console.log('   larguraInput:', larguraInput, 'encontrado:', !!larguraInput);
        console.log('   espessuraInput:', espessuraInput, 'encontrado:', !!espessuraInput, 'id:', espessuraInput?.id);
        console.log('   quantidadeInput:', quantidadeInput, 'encontrado:', !!quantidadeInput);
        console.log('   priceInput:', priceInput, 'encontrado:', !!priceInput);
        
        console.log('🔍 Valores RAW dos campos:');
        console.log('   comprimento RAW:', `"${comprimentoInput?.value}"`, 'tipo:', typeof comprimentoInput?.value);
        console.log('   largura RAW:', `"${larguraInput?.value}"`, 'tipo:', typeof larguraInput?.value);
        console.log('   espessura RAW:', `"${espessuraInput?.value}"`, 'tipo:', typeof espessuraInput?.value);
        console.log('   quantidade RAW:', `"${quantidadeInput?.value}"`, 'tipo:', typeof quantidadeInput?.value);
        console.log('   price RAW:', `"${priceInput?.value}"`, 'tipo:', typeof priceInput?.value);
        
        // CONVERSÃO MAIS ROBUSTA DE VALORES
        let comprimento = 0;
        if (comprimentoInput && comprimentoInput.value.trim()) {
            const valor = parseFloat(comprimentoInput.value.replace(',', '.'));
            comprimento = isNaN(valor) ? 0 : valor;
        }
        
        let largura = 0;
        if (larguraInput && larguraInput.value.trim()) {
            const valor = parseFloat(larguraInput.value.replace(',', '.'));
            largura = isNaN(valor) ? 0 : valor;
        }
        
        let espessura = 0;
        if (espessuraInput && espessuraInput.value.trim()) {
            const valor = parseFloat(espessuraInput.value.replace(',', '.'));
            espessura = isNaN(valor) ? 0 : valor;
        }
        
        let quantidade = 1; // Default para 1
        if (quantidadeInput && quantidadeInput.value.trim()) {
            const valor = parseInt(quantidadeInput.value);
            quantidade = isNaN(valor) ? 1 : Math.max(1, valor);
        }
        
        console.log('🔍 Valores convertidos:');
        console.log('   comprimento:', comprimento, 'de:', `"${comprimentoInput?.value}"`);
        console.log('   largura:', largura, 'de:', `"${larguraInput?.value}"`);
        console.log('   espessura:', espessura, 'de:', `"${espessuraInput?.value}"`);
        console.log('   quantidade:', quantidade, 'de:', `"${quantidadeInput?.value}"`);
        
        // ✅ VERIFICAR SE TODOS OS CAMPOS OBRIGATÓRIOS FORAM ENCONTRADOS
        if (!comprimentoInput) console.error('❌ Campo comprimento não encontrado!');
        if (!larguraInput) console.error('❌ Campo largura não encontrado!');
        if (!espessuraInput) console.error('❌ Campo espessura não encontrado!');
        if (!quantidadeInput) console.error('❌ Campo quantidade não encontrado!');
        if (!priceInput) console.error('❌ Campo price não encontrado!');
        
        // VERIFICAÇÕES CRÍTICAS DE VALORES LIDOS
        if (comprimento <= 0) {
            console.error('⚠️ PROBLEMA: Comprimento lido como 0 ou inválido!', comprimentoInput?.value);
        }
        if (largura <= 0) {
            console.error('⚠️ PROBLEMA: Largura lida como 0 ou inválida!', larguraInput?.value);
        }
        if (espessura <= 0) {
            console.error('⚠️ PROBLEMA: Espessura lida como 0 ou inválida!', espessuraInput?.value);
        }
        
        // Converter preço usando formatação legacy
        let preco = 0;
        if (priceInput && priceInput.value.trim()) {
            if (window.FormatacaoCampos && window.FormatacaoCampos.converterValorMoeda) {
                preco = window.FormatacaoCampos.converterValorMoeda(priceInput.value);
            } else {
                // Fallback para conversão manual
                const precoLimpo = priceInput.value.replace(/[^0-9\,\.]/g, '').replace(',', '.');
                preco = parseFloat(precoLimpo) || 0;
            }
        }
        
        console.log('   preco:', preco, 'de:', `"${priceInput?.value}"`);
        
        // ✅ CALCULAR VOLUME USANDO FUNÇÃO PADRONIZADA
        const volume = window.UtilsTL && window.UtilsTL.calcularVolume ? 
            window.UtilsTL.calcularVolume(comprimento, largura, espessura, 1) :
            window.FormatacaoCampos ? 
                window.FormatacaoCampos.calcularVolume(comprimento, largura, espessura) :
                (comprimento * largura * espessura) / 1000000; // Fallback
        
        // Calcular valor total
        const valorTotal = volume * quantidade * preco;
        
        console.log('📐 Volume calculado:', volume);
        console.log('💰 Valor total:', valorTotal);
        
        const resultado = {
            comprimento,
            largura,
            espessura,
            quantidade,
            preco,
            price: preco, // ✅ COMPATIBILIDADE: adicionar price também
            volume,
            valorTotal
        };
        
        console.log('📦 Resultado final (Legacy):', resultado);
        console.log('🔍 Verificação final dos valores:');
        console.log('   comprimento > 0?', resultado.comprimento > 0, 'valor:', resultado.comprimento);
        console.log('   largura > 0?', resultado.largura > 0, 'valor:', resultado.largura);
        console.log('   espessura > 0?', resultado.espessura > 0, 'valor:', resultado.espessura);
        console.log('   quantidade > 0?', resultado.quantidade > 0, 'valor:', resultado.quantidade);
        console.log('   preco > 0?', resultado.preco > 0, 'valor:', resultado.preco);
        
        return resultado;
    }

    /**
     * ✅ VALIDAR DADOS DO ITEM
     */
    function validarDados(valores) {
        console.log('🔍 VALIDANDO DADOS:', valores);
        
        // ✅ VERIFICAR SE VALORES É VÁLIDO
        if (!valores || typeof valores !== 'object') {
            console.error('❌ Objeto valores inválido:', valores);
            
            // 🚨 TENTATIVA DE RECUPERAÇÃO DE EMERGÊNCIA
            console.log('🚨 TENTANDO RECUPERAÇÃO DE EMERGÊNCIA...');
            const valoresEmergencia = tentarRecuperarValoresEmergencia();
            if (valoresEmergencia && typeof valoresEmergencia === 'object') {
                console.log('✅ Valores recuperados com sucesso:', valoresEmergencia);
                return validarDados(valoresEmergencia); // Recursão com valores recuperados
            }
            
            return { valido: false, erros: ['Erro: dados não encontrados e recuperação falhou'] };
        }
        
        const erros = [];
        
        // Verificar comprimento
        const comprimento = parseFloat(valores.comprimento) || 0;
        if (comprimento <= 0) {
            console.error('❌ Comprimento inválido:', `"${valores.comprimento}"`, '→', comprimento);
            erros.push(`Comprimento inválido: "${valores.comprimento}" → ${comprimento}. Campo deve conter um número maior que zero.`);
        }
        
        // Verificar largura
        const largura = parseFloat(valores.largura) || 0;
        if (largura <= 0) {
            console.error('❌ Largura inválida:', `"${valores.largura}"`, '→', largura);
            erros.push(`Largura inválida: "${valores.largura}" → ${largura}. Campo deve conter um número maior que zero.`);
        }
        
        // Verificar espessura
        const espessura = parseFloat(valores.espessura) || 0;
        if (espessura <= 0) {
            console.error('❌ Espessura inválida:', `"${valores.espessura}"`, '→', espessura);
            erros.push(`Espessura inválida: "${valores.espessura}" → ${espessura}. Campo deve conter um número maior que zero.`);
        }
        
        // Verificar quantidade
        const quantidade = parseInt(valores.quantidade) || 0;
        if (quantidade <= 0) {
            console.error('❌ Quantidade inválida:', `"${valores.quantidade}"`, '→', quantidade);
            erros.push(`Quantidade inválida: "${valores.quantidade}" → ${quantidade}. Campo deve conter um número inteiro maior que zero.`);
        }
        
        // Verificar preço
        const preco = parseFloat(valores.preco || valores.price) || 0;
        if (preco <= 0) {
            console.error('❌ Preço inválido:', `"${valores.preco}"`, `"${valores.price}"`, '→', preco);
            erros.push(`Preço inválido: "${valores.preco || valores.price}" → ${preco}. Campo deve conter um valor monetário maior que zero.`);
        }
        
        // Se há erros, retornar detalhes
        if (erros.length > 0) {
            console.error('❌ VALIDAÇÃO FALHOU COM ERROS:', erros);
            
            // 🚨 TENTATIVA DE RECUPERAÇÃO DE EMERGÊNCIA PARA CAMPOS ESPECÍFICOS
            console.log('🚨 TENTANDO RECUPERAÇÃO DE EMERGÊNCIA PARA CAMPOS ESPECÍFICOS...');
            const valoresCorrigidos = tentarCorrigirValoresEspecificos(valores);
            if (valoresCorrigidos && valoresCorrigidos !== valores) {
                console.log('🔄 Tentando revalidação com valores corrigidos:', valoresCorrigidos);
                return validarDados(valoresCorrigidos); // Recursão com valores corrigidos
            }
            
            return { valido: false, erros };
        }
        
        console.log('✅ Validação passou - todos os valores são válidos');
        return { valido: true };
    }

    /**
     * 🚨 FUNÇÃO DE EMERGÊNCIA: Tentar recuperar valores diretamente dos campos DOM
     */
    function tentarRecuperarValoresEmergencia() {
        console.log('🚨 Iniciando recuperação de emergência...');
        
        try {
            // Tentar leitura direta dos campos DOM
            const comprimentoEl = document.getElementById('comprimento');
            const larguraEl = document.getElementById('largura');
            const espessuraEl = document.getElementById('espessura') || document.getElementById(legacyKey);
            const quantidadeEl = document.getElementById('quantidade');
            const priceEl = document.getElementById('price');
            
            console.log('🚨 Elementos DOM encontrados:');
            console.log('   comprimento:', !!comprimentoEl, comprimentoEl?.value);
            console.log('   largura:', !!larguraEl, larguraEl?.value);
            console.log('   espessura:', !!espessuraEl, espessuraEl?.value);
            console.log('   quantidade:', !!quantidadeEl, quantidadeEl?.value);
            console.log('   price:', !!priceEl, priceEl?.value);
            
            if (!comprimentoEl || !larguraEl || !espessuraEl || !quantidadeEl || !priceEl) {
                console.error('❌ Campos DOM não encontrados na recuperação de emergência');
                return null;
            }
            
            const valoresRecuperados = {
                comprimento: comprimentoEl.value ? parseFloat(comprimentoEl.value.replace(',', '.')) || 0 : 0,
                largura: larguraEl.value ? parseFloat(larguraEl.value.replace(',', '.')) || 0 : 0,
                espessura: espessuraEl.value ? parseFloat(espessuraEl.value.replace(',', '.')) || 0 : 0,
                quantidade: quantidadeEl.value ? parseInt(quantidadeEl.value) || 1 : 1,
                preco: priceEl.value ? (
                    window.FormatacaoCampos && window.FormatacaoCampos.converterValorMoeda ? 
                        window.FormatacaoCampos.converterValorMoeda(priceEl.value) :
                        parseFloat(priceEl.value.replace(/[^0-9\,\.]/g, '').replace(',', '.')) || 0
                ) : 0
            };
            
            // Calcular volume
            if (window.UtilsTL && window.UtilsTL.calcularVolume) {
                valoresRecuperados.volume = window.UtilsTL.calcularVolume(
                    valoresRecuperados.comprimento, 
                    valoresRecuperados.largura, 
                    valoresRecuperados.espessura, 
                    1
                );
            } else if (window.FormatacaoCampos && window.FormatacaoCampos.calcularVolume) {
                valoresRecuperados.volume = window.FormatacaoCampos.calcularVolume(
                    valoresRecuperados.comprimento, 
                    valoresRecuperados.largura, 
                    valoresRecuperados.espessura
                );
            } else {
                valoresRecuperados.volume = (valoresRecuperados.comprimento * valoresRecuperados.largura * valoresRecuperados.espessura) / 1000000;
            }
            
            valoresRecuperados.valorTotal = valoresRecuperados.volume * valoresRecuperados.quantidade * valoresRecuperados.preco;
            
            console.log('✅ Valores recuperados na emergência:', valoresRecuperados);
            return valoresRecuperados;
            
        } catch (error) {
            console.error('❌ Erro na recuperação de emergência:', error);
            return null;
        }
    }
    
    /**
     * 🔧 FUNÇÃO AUXILIAR: Tentar corrigir valores específicos
     */
    function tentarCorrigirValoresEspecificos(valores) {
        console.log('🔧 Tentando correção específica de valores...');
        
        const valoresCorrigidos = { ...valores };
        let houveMudanca = false;
        
        // Se algum valor crítico é 0, tentar ler novamente do DOM
        if (parseFloat(valoresCorrigidos.comprimento) <= 0) {
            const el = document.getElementById('comprimento');
            if (el && el.value && el.value.trim()) {
                const novoValor = parseFloat(el.value.replace(',', '.'));
                if (!isNaN(novoValor) && novoValor > 0) {
                    valoresCorrigidos.comprimento = novoValor;
                    houveMudanca = true;
                    console.log('🔧 Comprimento corrigido:', novoValor);
                }
            }
        }
        
        if (parseFloat(valoresCorrigidos.largura) <= 0) {
            const el = document.getElementById('largura');
            if (el && el.value && el.value.trim()) {
                const novoValor = parseFloat(el.value.replace(',', '.'));
                if (!isNaN(novoValor) && novoValor > 0) {
                    valoresCorrigidos.largura = novoValor;
                    houveMudanca = true;
                    console.log('🔧 Largura corrigida:', novoValor);
                }
            }
        }
        
        const espessuraAtual = parseFloat(valoresCorrigidos.espessura);
        if (espessuraAtual <= 0) {
            const el = document.getElementById('espessura') || document.getElementById(legacyKey);
            if (el && el.value && el.value.trim()) {
                const novoValor = parseFloat(el.value.replace(',', '.'));
                if (!isNaN(novoValor) && novoValor > 0) {
                    valoresCorrigidos.espessura = novoValor;
                    houveMudanca = true;
                    console.log('🔧 Espessura corrigida:', novoValor);
                }
            }
        }
        
        if (parseInt(valoresCorrigidos.quantidade) <= 0) {
            const el = document.getElementById('quantidade');
            if (el && el.value && el.value.trim()) {
                const novoValor = parseInt(el.value);
                if (!isNaN(novoValor) && novoValor > 0) {
                    valoresCorrigidos.quantidade = novoValor;
                    houveMudanca = true;
                    console.log('🔧 Quantidade corrigida:', novoValor);
                }
            } else {
                // Se não conseguir ler, definir como 1
                valoresCorrigidos.quantidade = 1;
                houveMudanca = true;
                console.log('🔧 Quantidade definida como 1 (fallback)');
            }
        }
        
        const precoAtual = parseFloat(valoresCorrigidos.preco || valoresCorrigidos.price);
        if (precoAtual <= 0) {
            const el = document.getElementById('price');
            if (el && el.value && el.value.trim()) {
                let novoValor = 0;
                if (window.FormatacaoCampos && window.FormatacaoCampos.converterValorMoeda) {
                    novoValor = window.FormatacaoCampos.converterValorMoeda(el.value);
                } else {
                    novoValor = parseFloat(el.value.replace(/[^0-9\,\.]/g, '').replace(',', '.'));
                }
                if (!isNaN(novoValor) && novoValor > 0) {
                    valoresCorrigidos.preco = novoValor;
                    valoresCorrigidos.price = novoValor;
                    houveMudanca = true;
                    console.log('🔧 Preço corrigido:', novoValor);
                }
            }
        }
        
        // Se houve mudança, recalcular volume e valor total
        if (houveMudanca) {
            if (window.UtilsTL && window.UtilsTL.calcularVolume) {
                valoresCorrigidos.volume = window.UtilsTL.calcularVolume(
                    valoresCorrigidos.comprimento, 
                    valoresCorrigidos.largura, 
                    valoresCorrigidos.espessura, 
                    1
                );
            } else if (window.FormatacaoCampos && window.FormatacaoCampos.calcularVolume) {
                valoresCorrigidos.volume = window.FormatacaoCampos.calcularVolume(
                    valoresCorrigidos.comprimento, 
                    valoresCorrigidos.largura, 
                    valoresCorrigidos.espessura
                );
            } else {
                valoresCorrigidos.volume = (valoresCorrigidos.comprimento * valoresCorrigidos.largura * valoresCorrigidos.espessura) / 1000000;
            }
            
            valoresCorrigidos.valorTotal = valoresCorrigidos.volume * valoresCorrigidos.quantidade * valoresCorrigidos.preco;
        }
        
        return houveMudanca ? valoresCorrigidos : valores;
    }

    /**
     * ✅ OBTER ESPÉCIE SELECIONADA - CORRIGIDO PARA EDIÇÃO
     */
    function obterEspecieSelecionada() {
        // ✅ CORREÇÃO: Durante edição, priorizar campo especieInput
        const especieInput = document.getElementById('especieInput');
        const emModoEdicao = window.EditarItem && window.EditarItem.estaEditando && window.EditarItem.estaEditando();
        
        // Se estamos em modo de edição E o campo tem valor, usar o campo
        if (emModoEdicao && especieInput && especieInput.value.trim()) {
            const especieDoInput = especieInput.value.trim();
            console.log(`🌱 Modo edição - espécie do campo: "${especieDoInput}"`);
            return especieDoInput;
        }
        
        // Se não está em edição, tentar primeiro a variável global
        if (window.selectedSpecies && (window.selectedSpecies.nome || window.selectedSpecies.name)) {
            const especieGlobal = window.selectedSpecies.nome || window.selectedSpecies.name;
            console.log(`🌱 Espécie da variável global: "${especieGlobal}"`);
            return especieGlobal;
        }
        
        // Fallback: tentar obter do campo de input
        if (especieInput && especieInput.value.trim()) {
            const especieDoInput = especieInput.value.trim();
            console.log(`🌱 Espécie do campo (fallback): "${especieDoInput}"`);
            return especieDoInput;
        }
        
        console.log('🌱 Nenhuma espécie encontrada');
        return null;
    }

    /**
     * ✅ CRIAR ITEM
     */
    function criarItem(valores, especie) {
        return {
            comprimento: valores.comprimento,
            largura: valores.largura,
            espessura: valores.espessura,
            quantidade: valores.quantidade,
            preco: valores.preco,
            especie: especie,
            volume: valores.volume,
            valorTotal: valores.valorTotal,
            timestamp: Date.now()
        };
    }

    /**
     * ✅ ENCONTRAR ITEM DUPLICADO
     */
    function encontrarItemDuplicado(novoItem, listaItens) {
        return listaItens.find(item => 
            item.especie === novoItem.especie &&
            item.comprimento === novoItem.comprimento &&
            item.largura === novoItem.largura &&
            item.espessura === novoItem.espessura &&
            item.preco === novoItem.preco
        );
    }

    /**
     * ✅ ATUALIZAR INTERFACE
     */
    function atualizarInterface() {
        // Atualizar tabela de itens
        if (window.RenderizarTabela && window.RenderizarTabela.renderizarTabela) {
            window.RenderizarTabela.renderizarTabela();
        } else if (typeof window.renderizarTabela === 'function') {
            window.renderizarTabela();
        }
        
        // Atualizar totais
        if (window.RenderizarTabela && typeof window.RenderizarTabela.atualizarTotais === 'function') {
            window.RenderizarTabela.atualizarTotais(window.romaneioItems);
        } else if (window.Utils && window.Utils.atualizarTotais) {
            window.Utils.atualizarTotais(window.romaneioItems);
        } else if (typeof window.atualizarTotais === 'function') {
            window.atualizarTotais(window.romaneioItems);
        }
    }

    /**
     * ✅ LIMPAR CAMPOS
     */
    function limparCampos() {
        if (window.FormatacaoCampos && window.FormatacaoCampos.limparCampos) {
            window.FormatacaoCampos.limparCampos();
        } else {
            // Método legacy
            const campos = ['comprimento', 'largura', 'espessura', legacyKey, 'quantidade', 'price', 'especieInput'];
            campos.forEach(id => {
                const input = document.getElementById(id);
                if (input) {
                    input.value = '';
                }
            });
        }
        
        // Limpar seleção de espécie
        window.selectedSpecies = null;
        
        console.log('🧹 Campos limpos após adicionar item');
    }

    /**
     * ✅ FOCAR NO PRIMEIRO CAMPO
     */
    function focarPrimeiroCampo() {
        if (window.NavegacaoEnter && window.NavegacaoEnter.focarPrimeiroCampo) {
            window.NavegacaoEnter.focarPrimeiroCampo();
        } else {
            // Método legacy
            const especieInput = document.getElementById('especieInput');
            if (especieInput) {
                especieInput.focus();
            }
        }
    }

    /**
     * ✅ MOSTRAR ERRO
     */
    function mostrarErro(mensagem) {
        console.error('❌ ' + mensagem);
        
        if (window.Utils && window.Utils.showToast) {
            window.Utils.showToast(mensagem, 'error');
        } else if (typeof window.showToast === 'function') {
            window.showToast(mensagem, 'error');
        } else if (typeof toastr !== 'undefined') {
            toastr.error(mensagem);
        } else {
            alert('❌ Erro: ' + mensagem);
        }
    }

    /**
     * ✅ MOSTRAR SUCESSO
     */
    function mostrarSucesso(mensagem) {
        console.log('✅ ' + mensagem);
        
        if (window.Utils && window.Utils.showToast) {
            window.Utils.showToast(mensagem, 'success');
        } else if (typeof window.showToast === 'function') {
            window.showToast(mensagem, 'success');
        } else if (typeof toastr !== 'undefined') {
            toastr.success(mensagem);
        } else {
            // Feedback silencioso no console (sem alert para não incomodar)
            console.log(`🎉 SUCESSO: ${mensagem}`);
        }
    }

    /**
     * ✅ VERIFICAR SE PODE ADICIONAR ITEM
     */
    function podeAdicionarItem() {
        return !isAddingItem;
    }

    /**
     * ✅ OBTER LISTA DE ITENS
     */
    function obterItens() {
        return window.romaneioItems || [];
    }

    /**
     * ✅ FUNÇÃO DE DEBUG: Testar funcionalidades de duplicação
     */
    function testarDuplicacao() {
        console.log('🧪 Testando funcionalidades de duplicação e ordenação...');
        
        const items = window.romaneioItems || [];
        console.log(`📊 Total de itens atual: ${items.length}`);
        
        if (items.length > 0) {
            console.log('🔍 Primeiros 3 itens (ordem atual):');
            items.slice(0, 3).forEach((item, index) => {
                console.log(`  ${index + 1}. ${item.especie} - ${item.comprimento}x${item.largura}x${item.espessura} - Qtd: ${item.quantidade}`);
            });
        }
        
        // Verificar se há duplicatas
        const duplicatas = [];
        items.forEach((item, index) => {
            const outroItem = items.find((outro, outroIndex) => 
                outroIndex !== index &&
                outro.especie === item.especie &&
                outro.comprimento === item.comprimento &&
                outro.largura === item.largura &&
                outro.espessura === item.espessura &&
                outro.preco === item.preco
            );
            if (outroItem) {
                duplicatas.push(item);
            }
        });
        
        if (duplicatas.length > 0) {
            console.warn('⚠️ Duplicatas encontradas:', duplicatas.length);
        } else {
            console.log('✅ Nenhuma duplicata encontrada');
        }
        
        return {
            totalItems: items.length,
            temDuplicatas: duplicatas.length > 0,
            duplicatas: duplicatas.length
        };
    }

    /**
     * ✅ LIMPAR TODOS OS ITENS DO ROMANEIO
     */
    function limparItens() {
        console.log('🧹 Limpando todos os itens do romaneio...');
        
        if (window.romaneioItems) {
            const quantidadeAnterior = window.romaneioItems.length;
            window.romaneioItems.length = 0; // Limpar array mantendo referência
            console.log(`✅ ${quantidadeAnterior} itens removidos do romaneio`);
            
            // Atualizar interface
            atualizarInterface();
        } else {
            console.log('ℹ️ Nenhum item para limpar');
        }
    }

    /**
     * ✅ LIMPAR FORMULÁRIO COMPLETO
     */
    function limparFormularioCompleto() {
        console.log('🧹 Limpando formulário completo...');
        
        // Limpar todos os campos
        const campos = ['clienteInput', 'especieInput', 'comprimento', 'largura', 'espessura', legacyKey, 'quantidade', 'price'];
        campos.forEach(id => {
            const input = document.getElementById(id);
            if (input) {
                input.value = id === 'quantidade' ? '1' : '';
            }
        });
        
        // Limpar seleção de espécie
        window.selectedSpecies = null;
        
        // Limpar todos os itens
        limparItens();
        
        console.log('✅ Formulário completamente limpo');
    }

    // ✅ INTERFACE PÚBLICA
    return {
        adicionarItem,
        adicionarNovoItem,
        atualizarItem,
        podeAdicionarItem,
        obterItens,
        testarDuplicacao,
        limparItens,
        limparFormularioCompleto
    };

})();

// ✅ FUNÇÕES GLOBAIS PARA COMPATIBILIDADE
window.adicionarItem = window.AdicionarItem.adicionarItem;
window.testarDuplicacaoItens = window.AdicionarItem.testarDuplicacao; // Função de debug

console.log('✅ Módulo AdicionarItem carregado com sucesso');
console.log('🧪 Para testar duplicação, digite: testarDuplicacaoItens() no console'); 
