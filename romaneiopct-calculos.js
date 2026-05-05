/**
 * 🧮 SISTEMA DE CÁLCULOS ROMANEIOPCT - ESPECÍFICO
 * 
 * Funcionalidades específicas PCT:
 * - Cálculos incluindo pecasPorPacote
 * - Validações específicas PCT
 * - Fórmulas preservadas do sistema original
 * - Funções auxiliares de conversão
 * 
 * Versão: 1.0 Específica PCT
 * Data: Dezembro 2024
 */

console.log('🧮 Sistema de Cálculos Romaneiopct carregado');

// ========================================
// CONSTANTES E CONFIGURAÇÕES
// ========================================

const CALCULOS_PCT_CONFIG = {
    unidades: {
        volumeFator: 1000000, // Conversão cm³ para m³
        moedaDecimais: 2,
        volumeDecimais: 4
    },
    validacao: {
        minComprimento: 0.1,
        maxComprimento: 10000,
        minLargura: 0.1, 
        maxLargura: 1000,
        minEspessura: 0.1,
        maxEspessura: 1000,
        minQuantidade: 1,
        maxQuantidade: 99999,
        minPecasPorPacote: 1,
        maxPecasPorPacote: 9999
    }
};

// ========================================
// FUNÇÕES DE CÁLCULO BÁSICAS
// ========================================

/**
 * Calcular volume unitário (sem quantidade nem pacotes)
 * @param {number} comprimento - Comprimento em cm
 * @param {number} largura - Largura em cm  
 * @param {number} espessura - Espessura em cm
 * @returns {number} Volume em m³
 */
function calcularVolumeUnitario(comprimento, largura, espessura) {
    const comp = parseFloat(comprimento) || 0;
    const larg = parseFloat(largura) || 0;
    const esp = parseFloat(espessura) || 0;
    
    // Validações básicas
    if (comp <= 0 || larg <= 0 || esp <= 0) {
        return 0;
    }
    
    // Volume em cm³ convertido para m³
    return (comp * larg * esp) / CALCULOS_PCT_CONFIG.unidades.volumeFator;
}

/**
 * Calcular volume total incluindo quantidade e pecasPorPacote (ESPECÍFICO PCT)
 * @param {number} comprimento - Comprimento em cm
 * @param {number} largura - Largura em cm
 * @param {number} espessura - Espessura em cm
 * @param {number} quantidade - Quantidade de pacotes
 * @param {number} pecasPorPacote - Peças por pacote (ESPECÍFICO PCT)
 * @returns {number} Volume total em m³
 */
function calcularVolumePCT(comprimento, largura, espessura, quantidade, pecasPorPacote) {
    const volumeUnitario = calcularVolumeUnitario(comprimento, largura, espessura);
    const qtd = parseInt(quantidade) || 0;
    const ppp = parseInt(pecasPorPacote) || 1;
    
    // ⚠️ ESPECÍFICO PCT: Volume = VolumeUnitário × Quantidade × PecasPorPacote
    return volumeUnitario * qtd * ppp;
}

/**
 * Calcular valor total do item
 * @param {number} volume - Volume total em m³
 * @param {number} valorUnitario - Valor por m³
 * @returns {number} Valor total
 */
function calcularValorTotal(volume, valorUnitario) {
    const vol = parseFloat(volume) || 0;
    const valor = parseFloat(valorUnitario) || 0;
    
    return vol * valor;
}

// ========================================
// FUNÇÕES ESPECÍFICAS PCT
// ========================================

/**
 * Calcular total de peças incluindo pacotes (ESPECÍFICO PCT)
 * @param {number} quantidade - Quantidade de pacotes
 * @param {number} pecasPorPacote - Peças por pacote
 * @returns {number} Total de peças
 */
function calcularTotalPecasPCT(quantidade, pecasPorPacote) {
    const qtd = parseInt(quantidade) || 0;
    const ppp = parseInt(pecasPorPacote) || 1;
    
    // ⚠️ ESPECÍFICO PCT: Total de peças = Quantidade × PecasPorPacote
    return qtd * ppp;
}

/**
 * Calcular total de peças de uma lista de itens (ESPECÍFICO PCT)
 * @param {Array} itens - Array de itens
 * @returns {number} Total de peças de todos os itens
 */
function calcularTotalPecasLista(itens) {
    if (!Array.isArray(itens)) return 0;
    
    return itens.reduce((total, item) => {
        const qtd = parseInt(item.quantidade) || 0;
        const ppp = parseInt(item.pecasPorPacote) || 1;
        return total + (qtd * ppp);
    }, 0);
}

/**
 * Calcular total de pacotes de uma lista de itens
 * @param {Array} itens - Array de itens
 * @returns {number} Total de pacotes
 */
function calcularTotalPacotes(itens) {
    if (!Array.isArray(itens)) return 0;
    
    return itens.reduce((total, item) => {
        const qtd = parseInt(item.quantidade) || 0;
        return total + qtd;
    }, 0);
}

/**
 * Calcular volume total de uma lista de itens (ESPECÍFICO PCT)
 * @param {Array} itens - Array de itens
 * @returns {number} Volume total em m³
 */
function calcularVolumeTotalLista(itens) {
    if (!Array.isArray(itens)) return 0;
    
    return itens.reduce((total, item) => {
        const volume = calcularVolumePCT(
            item.comprimento,
            item.largura, 
            item.espessura,
            item.quantidade,
            item.pecasPorPacote
        );
        return total + volume;
    }, 0);
}

/**
 * Calcular valor total de uma lista de itens
 * @param {Array} itens - Array de itens
 * @returns {number} Valor total
 */
function calcularValorTotalLista(itens) {
    if (!Array.isArray(itens)) return 0;
    
    return itens.reduce((total, item) => {
        const volume = calcularVolumePCT(
            item.comprimento,
            item.largura,
            item.espessura, 
            item.quantidade,
            item.pecasPorPacote
        );
        const valor = volume * (parseFloat(item.valorUnitario) || 0); 
        return total + valor;
    }, 0);
}

// ========================================
// FUNÇÕES DE VALIDAÇÃO ESPECÍFICAS PCT
// ========================================

/**
 * Validar valor de pecasPorPacote (ESPECÍFICO PCT)
 * @param {any} valor - Valor a ser validado
 * @returns {number} Valor válido ou 1 como padrão
 */
function validarPecasPorPacote(valor) {
    const num = parseInt(valor);
    const config = CALCULOS_PCT_CONFIG.validacao;
    
    if (isNaN(num) || num < config.minPecasPorPacote || num > config.maxPecasPorPacote) {
        console.warn(`⚠️ Valor inválido para pecasPorPacote: ${valor}. Usando padrão: 1`);
        return 1;
    }
    
    return num;
}

/**
 * Validar dimensões
 * @param {number} comprimento - Comprimento em cm
 * @param {number} largura - Largura em cm
 * @param {number} espessura - Espessura em cm
 * @returns {Object} Resultado da validação
 */
function validarDimensoes(comprimento, largura, espessura) {
    const config = CALCULOS_PCT_CONFIG.validacao;
    const erros = [];
    
    const comp = parseFloat(comprimento);
    const larg = parseFloat(largura);
    const esp = parseFloat(espessura);
    
    if (isNaN(comp) || comp < config.minComprimento || comp > config.maxComprimento) {
        erros.push(`Comprimento inválido: ${comprimento} (deve estar entre ${config.minComprimento} e ${config.maxComprimento})`);
    }
    
    if (isNaN(larg) || larg < config.minLargura || larg > config.maxLargura) {
        erros.push(`Largura inválida: ${largura} (deve estar entre ${config.minLargura} e ${config.maxLargura})`);
    }
    
    if (isNaN(esp) || esp < config.minEspessura || esp > config.maxEspessura) {
        erros.push(`Espessura inválida: ${espessura} (deve estar entre ${config.minEspessura} e ${config.maxEspessura})`);
    }
    
    return {
        valido: erros.length === 0,
        erros: erros,
        valores: { comprimento: comp, largura: larg, espessura: esp }
    };
}

/**
 * Validar quantidade
 * @param {any} quantidade - Quantidade a ser validada
 * @returns {Object} Resultado da validação
 */
function validarQuantidade(quantidade) {
    const config = CALCULOS_PCT_CONFIG.validacao;
    const num = parseInt(quantidade);
    
    if (isNaN(num) || num < config.minQuantidade || num > config.maxQuantidade) {
        return {
            valido: false,
            erro: `Quantidade inválida: ${quantidade} (deve estar entre ${config.minQuantidade} e ${config.maxQuantidade})`,
            valor: config.minQuantidade
        };
    }
    
    return {
        valido: true,
        valor: num
    };
}

/**
 * Validar item completo (ESPECÍFICO PCT)
 * @param {Object} item - Item a ser validado
 * @returns {Object} Resultado da validação
 */
function validarItemPCT(item) {
    const erros = [];
    
    // Validar dimensões
    const validacaoDimensoes = validarDimensoes(item.comprimento, item.largura, item.espessura);
    if (!validacaoDimensoes.valido) {
        erros.push(...validacaoDimensoes.erros);
    }
    
    // Validar quantidade
    const validacaoQuantidade = validarQuantidade(item.quantidade);
    if (!validacaoQuantidade.valido) {
        erros.push(validacaoQuantidade.erro);
    }
    
    // Validar pecasPorPacote (ESPECÍFICO PCT)
    const pecasPorPacoteValido = validarPecasPorPacote(item.pecasPorPacote);
    if (pecasPorPacoteValido === 1 && item.pecasPorPacote != 1) {
        erros.push(`PecasPorPacote inválido: ${item.pecasPorPacote}. Corrigido para: 1`);
    }
    
    // Validar espécie
    if (!item.especie || item.especie.trim() === '') {
        erros.push('Espécie é obrigatória');
    }
    
    return {
        valido: erros.length === 0,
        erros: erros,
        itemCorrigido: {
            ...item,
            comprimento: validacaoDimensoes.valido ? validacaoDimensoes.valores.comprimento : 0,
            largura: validacaoDimensoes.valido ? validacaoDimensoes.valores.largura : 0,
            espessura: validacaoDimensoes.valido ? validacaoDimensoes.valores.espessura : 0,
            quantidade: validacaoQuantidade.valido ? validacaoQuantidade.valor : 1,
            pecasPorPacote: pecasPorPacoteValido
        }
    };
}

// ========================================
// FUNÇÕES DE FORMATAÇÃO
// ========================================

/**
 * Formatar volume para exibição
 * @param {number} volume - Volume em m³
 * @returns {string} Volume formatado
 */
function formatarVolume(volume) {
    const vol = parseFloat(volume) || 0;
    return `${vol.toFixed(CALCULOS_PCT_CONFIG.unidades.volumeDecimais)} m³`;
}

/**
 * Formatar valor monetário para exibição
 * @param {number} valor - Valor numérico
 * @returns {string} Valor formatado
 */
function formatarValor(valor) {
    const val = parseFloat(valor) || 0;
    return `R$ ${val.toFixed(CALCULOS_PCT_CONFIG.unidades.moedaDecimais).replace('.', ',')}`;
}

/**
 * Formatar número de peças para exibição (ESPECÍFICO PCT)
 * @param {number} quantidade - Quantidade de pacotes
 * @param {number} pecasPorPacote - Peças por pacote
 * @returns {string} Formatação completa
 */
function formatarPecasPCT(quantidade, pecasPorPacote) {
    const qtd = parseInt(quantidade) || 0;
    const ppp = parseInt(pecasPorPacote) || 1;
    const totalPecas = qtd * ppp;
    
    if (ppp === 1) {
        return `${totalPecas} peças`;
    } else {
        return `${totalPecas} peças (${qtd} pacotes × ${ppp})`;
    }
}

// ========================================
// FUNÇÃO DE CÁLCULO COMPLETO DO ITEM
// ========================================

/**
 * Calcular todos os valores de um item (ESPECÍFICO PCT)
 * @param {Object} dadosItem - Dados básicos do item
 * @returns {Object} Item com todos os cálculos
 */
function calcularItemCompleto(dadosItem) {
    console.log('🧮 Calculando item completo PCT:', dadosItem);
    
    // Validar item
    const validacao = validarItemPCT(dadosItem);
    if (!validacao.valido) {
        console.warn('⚠️ Item com problemas de validação:', validacao.erros);
    }
    
    const item = validacao.itemCorrigido;
    
    // ✅ CALCULAR TODOS OS VALORES
    const volumeUnitario = calcularVolumeUnitario(item.comprimento, item.largura, item.espessura);
    const volumeTotal = calcularVolumePCT(item.comprimento, item.largura, item.espessura, item.quantidade, item.pecasPorPacote);
    const totalPecas = calcularTotalPecasPCT(item.quantidade, item.pecasPorPacote);
    const valorUnitario = parseFloat(item.valorUnitario) || 0;
    const valorTotal = calcularValorTotal(volumeTotal, valorUnitario);
    
    const itemCalculado = {
        ...item,
        // Cálculos básicos
        volumeUnitario: volumeUnitario,
        volume: volumeTotal,
        totalPecas: totalPecas,
        valorTotal: valorTotal,
        
        // Formatações para exibição
        volumeFormatado: formatarVolume(volumeTotal),
        valorFormatado: formatarValor(valorTotal),
        pecasFormatado: formatarPecasPCT(item.quantidade, item.pecasPorPacote),
        
        // Metadados
        calculadoEm: new Date().toISOString(),
        valido: validacao.valido,
        errosValidacao: validacao.erros
    };
    
    console.log('📊 Item calculado:', {
        volume: itemCalculado.volume.toFixed(4),
        totalPecas: itemCalculado.totalPecas,
        valorTotal: itemCalculado.valorTotal.toFixed(2)
    });
    
    return itemCalculado;
}

// ========================================
// EXPOSIÇÃO GLOBAL
// ========================================

// ✅ FUNÇÕES BÁSICAS
window.calcularVolumeUnitario = calcularVolumeUnitario;
window.calcularVolumePCT = calcularVolumePCT;
window.calcularValorTotal = calcularValorTotal;

// ✅ FUNÇÕES ESPECÍFICAS PCT
window.calcularTotalPecasPCT = calcularTotalPecasPCT;
window.calcularTotalPecasLista = calcularTotalPecasLista;
window.calcularTotalPacotes = calcularTotalPacotes;
window.calcularVolumeTotalLista = calcularVolumeTotalLista;
window.calcularValorTotalLista = calcularValorTotalLista;

// ✅ FUNÇÕES DE VALIDAÇÃO
window.validarPecasPorPacote = validarPecasPorPacote;
window.validarDimensoes = validarDimensoes;
window.validarQuantidade = validarQuantidade;
window.validarItemPCT = validarItemPCT;

// ✅ FUNÇÕES DE FORMATAÇÃO
window.formatarVolume = formatarVolume;
window.formatarValor = formatarValor;
window.formatarPecasPCT = formatarPecasPCT;

// ✅ FUNÇÃO PRINCIPAL
window.calcularItemCompleto = calcularItemCompleto;

// ✅ COMPATIBILIDADE COM SISTEMA ANTERIOR
if (!window.calcularVolume) {
    window.calcularVolume = calcularVolumeUnitario;
    console.log('✅ Compatibilidade: calcularVolume definida como calcularVolumeUnitario');
}

// ✅ CONFIGURAÇÕES
window.CALCULOS_PCT_CONFIG = CALCULOS_PCT_CONFIG;

console.log('✅ Sistema de Cálculos Romaneiopct carregado e funções expostas globalmente');