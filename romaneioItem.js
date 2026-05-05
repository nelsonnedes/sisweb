function calcularMetragem() {
    console.log("Calculando metragem...");
    try {
        const comprimento = parseFloat(document.getElementById('comprimento').value.replace(',', '.')) || 0;
        const largura = parseFloat(document.getElementById('largura').value.replace(',', '.')) || 0;
        const espessura = parseFloat(document.getElementById('espessura').value.replace(',', '.')) || 0;
        const quantidade = parseInt(document.getElementById('quantidade').value) || 0;
        
        console.log(`Valores para cálculo - Comprimento: ${comprimento}, Largura: ${largura}, Espessura: ${espessura}, Quantidade: ${quantidade}`);
        
        // Cálculo da metragem (em metros cúbicos)
        let metragem = 0;
        if (comprimento > 0 && largura > 0 && espessura > 0 && quantidade > 0) {
            // Convertendo para metros se necessário (assumindo que os valores são em centímetros)
            const comprimentoM = comprimento / 100;
            const larguraM = largura / 100;
            const espessuraM = espessura / 100;
            
            // Cálculo do volume de um item (metros cúbicos)
            const volumeUnitario = comprimentoM * larguraM * espessuraM;
            
            // Volume total considerando a quantidade
            metragem = volumeUnitario * quantidade;
            
            console.log(`Cálculo detalhado: (${comprimentoM} * ${larguraM} * ${espessuraM}) * ${quantidade} = ${metragem}`);
        } else {
            console.log("Pelo menos um dos valores é zero ou inválido");
        }
        
        // Formatação para exibição (fixando 4 casas decimais e usando vírgula como separador decimal)
        const metragemFormatada = metragem.toFixed(4).replace('.', ',');
        document.getElementById('metragem').value = metragemFormatada;
        
        // Calcular valor total considerando o preço unitário
        calcularValorTotal();
        
        return metragem;
    } catch (error) {
        console.error("Erro ao calcular metragem:", error);
        return 0;
    }
}

function calcularValorTotal() {
    console.log("Calculando valor total...");
    try {
        // Obter o valor unitário (preço por metro cúbico)
        const valorUnitario = parseFloat(document.getElementById('valorUnitario').value.replace(',', '.')) || 0;
        
        // Pegar a metragem já calculada (em metros cúbicos)
        const metragem = parseFloat(document.getElementById('metragem').value.replace(',', '.')) || 0;
        
        console.log(`Valores para cálculo - Valor Unitário: ${valorUnitario}, Metragem: ${metragem}`);
        
        // Cálculo do valor total
        let valorTotal = 0;
        if (valorUnitario > 0 && metragem > 0) {
            valorTotal = valorUnitario * metragem;
            console.log(`Cálculo detalhado: ${valorUnitario} * ${metragem} = ${valorTotal}`);
        } else {
            console.log("Valor unitário ou metragem é zero ou inválido");
        }
        
        // Formatação para exibição (fixando 2 casas decimais para moeda e usando vírgula como separador decimal)
        const valorTotalFormatado = valorTotal.toFixed(2).replace('.', ',');
        document.getElementById('valorTotal').value = valorTotalFormatado;
        
        return valorTotal;
    } catch (error) {
        console.error("Erro ao calcular valor total:", error);
        return 0;
    }
}

// Configurar Event Listeners para os campos
function configurarEventListenersCampos() {
    console.log("Configurando event listeners para os campos...");
    
    try {
        // Campos que afetam o cálculo da metragem
        const camposDimensao = ['comprimento', 'largura', 'espessura', 'quantidade'];
        camposDimensao.forEach(id => {
            const campo = document.getElementById(id);
            if (campo) {
                // Remover listeners anteriores para evitar duplicação (se houver)
                const novoElemento = campo.cloneNode(true);
                campo.parentNode.replaceChild(novoElemento, campo);
                
                // Adicionar novo listener
                novoElemento.addEventListener('input', function() {
                    console.log(`Campo ${id} alterado, recalculando metragem...`);
                    calcularMetragem();
                });
                console.log(`Event listener configurado para o campo ${id}`);
            } else {
                console.warn(`Campo com ID '${id}' não encontrado`);
            }
        });
        
        // Campo para valorUnitario (afeta apenas o cálculo do valor total)
        const campoValorUnitario = document.getElementById('valorUnitario');
        if (campoValorUnitario) {
            // Remover listeners anteriores para evitar duplicação (se houver)
            const novoElemento = campoValorUnitario.cloneNode(true);
            campoValorUnitario.parentNode.replaceChild(novoElemento, campoValorUnitario);
            
            // Adicionar novo listener
            novoElemento.addEventListener('input', function() {
                console.log("Campo valorUnitario alterado, recalculando valor total...");
                calcularValorTotal();
            });
            console.log("Event listener configurado para o campo valorUnitario");
        } else {
            console.warn("Campo com ID 'valorUnitario' não encontrado");
        }
        
        console.log("Configuração de event listeners concluída");
        return true;
    } catch (error) {
        console.error("Erro ao configurar event listeners:", error);
        return false;
    }
}

// Executar quando o documento estiver carregado
document.addEventListener('DOMContentLoaded', function() {
    console.log("Documento carregado, inicializando handlers para cálculos...");
    configurarEventListenersCampos();
    
    // Verificar se os campos têm valores iniciais e calcular se necessário
    if (document.getElementById('comprimento').value || 
        document.getElementById('largura').value || 
        document.getElementById('espessura').value || 
        document.getElementById('quantidade').value) {
        calcularMetragem();
    }
    
    // Configurar observador de mutação para reconfigurar event listeners se necessário
    const observerConfig = { childList: true, subtree: true };
    const targetNode = document.querySelector('.container') || document.body;
    
    const observer = new MutationObserver(function(mutations) {
        for (const mutation of mutations) {
            if (mutation.type === 'childList' && mutation.addedNodes.length > 0) {
                // Verificar mudanças significativas que possam requerer reconfiguração
                for (let i = 0; i < mutation.addedNodes.length; i++) {
                    const node = mutation.addedNodes[i];
                    if (node.nodeType === 1) { // Elemento
                        if (node.id === 'modalNovoItem' || 
                            node.classList && node.classList.contains('item-row') ||
                            node.querySelector && (
                                node.querySelector('#comprimento') || 
                                node.querySelector('#largura') || 
                                node.querySelector('#espessura') || 
                                node.querySelector('#quantidade') ||
                                node.querySelector('#valorUnitario')
                            )) {
                            console.log("Detectada mudança na DOM relacionada aos campos, reconfigurando event listeners...");
                            setTimeout(configurarEventListenersCampos, 100);
                            break;
                        }
                    }
                }
            }
        }
    });
    
    observer.observe(targetNode, observerConfig);
}); 
