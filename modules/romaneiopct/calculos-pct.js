/**
 * 🧮 MÓDULO: Cálculos Específicos PCT
 * 
 * RESPONSABILIDADES:
 * - Cálculos de volume incluindo pecasPorPacote
 * - Totalizações específicas PCT
 * - Validações de valores de pacotes
 * - Fórmulas preservadas do sistema atual
 * 
 * EXTRAÍDO DE: romaneiopct_modais.js
 * BASEADO EM: 13 linhas de cálculo identificadas
 */

// ============================================================================
// CÁLCULOS PRINCIPAIS PCT
// ============================================================================

/**
 * ✅ FÓRMULA ESPECÍFICA PCT: Volume incluindo pecasPorPacote
 * PRESERVA: Fórmula exata do sistema atual
 * NÃO É IGUAL AO ROMANEIOTL (que não inclui pacotes)
 */
// ✅ CONVERSÃO: Função global (removido export)
function calcularVolumePCT(comprimento, largura, espessura, quantidade, pecasPorPacote) {
    // ✅ CORREÇÃO CRÍTICA: Validação rigorosa contra NaN
    const comp = parseFloat(comprimento);
    const larg = parseFloat(largura);
    const esp = parseFloat(espessura);
    const qtd = parseInt(quantidade);
    
    // ✅ CORREÇÃO CRÍTICA: Lidar com pecasPorPacote como objeto ou número
    let ppp;
    if (typeof pecasPorPacote === 'object' && pecasPorPacote !== null) {
        // Formato objeto: {valido: true, valor: 1}
        ppp = parseInt(pecasPorPacote.valor || 1);
    } else {
        // Formato simples: número
        ppp = parseInt(pecasPorPacote || 1);
    }
    
    // Validar todos os valores são números válidos
    if (isNaN(comp) || isNaN(larg) || isNaN(esp) || isNaN(qtd) || isNaN(ppp)) {
        console.error('❌ calcularVolumePCT: Valores inválidos detectados', {
            comprimento: comp, largura: larg, espessura: esp, quantidade: qtd, 
            pecasPorPacote: ppp, pecasPorPacoteOriginal: pecasPorPacote
        });
        return 0;
    }
    
    if (comp <= 0 || larg <= 0 || esp <= 0 || qtd <= 0 || ppp <= 0) {
        console.error('❌ calcularVolumePCT: Valores devem ser maiores que zero');
        return 0;
    }
    
    // Fórmula específica PCT com validação
    const volumeUnitario = (comp * larg * esp) / 1000000;  // m³
    const volumeTotal = volumeUnitario * qtd * ppp;  // ⚠️ INCLUI PACOTES
    
    // Validar resultado final
    if (isNaN(volumeTotal) || !isFinite(volumeTotal)) {
        console.error('❌ calcularVolumePCT: Resultado inválido', volumeTotal);
        return 0;
    }
    
    return volumeTotal;
}

/**
 * ✅ TOTALIZAÇÃO ESPECÍFICA PCT: Total de peças
 * PRESERVA: Lógica exata encontrada no sistema atual
 */
// ✅ CONVERSÃO: Função global (removido export)
function calcularTotalPecasPCT(itens) {
    return itens.reduce((sum, item) => {
        const qtd = parseInt(item.quantidade || 0);
        const ppp = parseInt(item.pecasPorPacote || 1);
        return sum + (qtd * ppp);  // ⚠️ MULTIPLICAR POR PACOTES
    }, 0);
}

/**
 * ✅ VALIDAÇÃO ESPECÍFICA PCT: Valor de pecasPorPacote
 */
// ✅ CONVERSÃO: Função global (removido export)
function validarPecasPorPacote(valor) {
    const ppp = parseInt(valor);
    
    if (isNaN(ppp) || ppp <= 0) {
        return {
            valido: false,
            erro: 'Peças por pacote deve ser um número maior que zero',
            valorCorrigido: 1
        };
    }
    
    if (ppp > 1000) {
        return {
            valido: false,
            erro: 'Valor muito alto para peças por pacote',
            valorCorrigido: 1000
        };
    }
    
    return {
        valido: true,
        valor: ppp
    };
}

/**
 * ✅ INFORMAÇÃO PARA RELATÓRIOS: Dados de pacotes
 */
// ✅ CONVERSÃO: Função global (removido export)
function gerarDadosPacotes(quantidade, pecasPorPacote) {
    const ppp = parseInt(pecasPorPacote || 1);
    const qtd = parseInt(quantidade || 0);
    
    if (ppp > 1) {
        const totalPecas = qtd * ppp;
        const numPacotes = qtd; // quantidade já representa pacotes
        
        return {
            totalPecas,
            numPacotes,
            pecasPorPacote: ppp,
            info: `${numPacotes} PACOTES C/${ppp}`,
            detalhada: `${totalPecas} peças em ${numPacotes} pacotes de ${ppp}`
        };
    }
    
    return {
        totalPecas: qtd,
        numPacotes: 0,
        pecasPorPacote: 1,
        info: '',
        detalhada: `${qtd} peças`
    };
}

// ============================================================================
// COMPATIBILIDADE GLOBAL
// ============================================================================

// ✅ EXPOSIÇÃO GLOBAL
window.calcularVolumePCT = calcularVolumePCT;
window.calcularTotalPecasPCT = calcularTotalPecasPCT;
window.validarPecasPorPacote = validarPecasPorPacote;
window.gerarDadosPacotes = gerarDadosPacotes;

console.log('✅ Módulo calculos-pct.js carregado e funções expostas globalmente');
