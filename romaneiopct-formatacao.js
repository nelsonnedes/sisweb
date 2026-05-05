/**
 * 💰 SISTEMA DE FORMATAÇÃO ROMANEIOPCT - UNIFICADO
 * 
 * Sistema específico para formatação de campos no romaneiopct.
 * Resolve conflitos com múltiplas implementações de formatação.
 * 
 * Funcionalidades:
 * - Formatação de campos monetários (formatCurrencyInput)
 * - Formatação de valores para exibição (formatCurrency)
 * - Conversão de valores formatados (parseCurrencyValue)
 * - Formatação de volume (formatVolume)
 * - Formatação específica PCT (peças por pacote)
 * 
 * Versão: 1.0 Unificada
 * Data: Dezembro 2024
 */

console.log('💰 Sistema de Formatação PCT carregado');

// ========================================
// CONFIGURAÇÕES
// ========================================

const FORMATACAO_PCT_CONFIG = {
    moeda: {
        locale: 'pt-BR',
        currency: 'BRL',
        minimumFractionDigits: 2,
        maximumFractionDigits: 2
    },
    volume: {
        decimais: 4,
        unidade: 'm³'
    },
    debug: true
};

// ========================================
// SISTEMA DE FORMATAÇÃO PRINCIPAL
// ========================================

const FormatacaoPCT = {
    
    /**
     * 💰 FORMATAÇÃO DE INPUT DE MOEDA
     * Função principal chamada pelo HTML: onInput="formatCurrencyInput(this)"
     * 
     * @param {HTMLInputElement} input - Campo de input
     */
    formatCurrencyInput: function(input) {
        try {
            if (!input || !input.value) {
                return;
            }
            
            // Remover todos os caracteres não numéricos
            let value = input.value.replace(/\D/g, '');
            
            if (value.length === 0) {
                input.value = '';
                return;
            }
            
            // Converter para centavos
            value = parseInt(value);
            
            // Formatar como moeda brasileira
            const formattedValue = (value / 100).toLocaleString(
                FORMATACAO_PCT_CONFIG.moeda.locale, {
                    style: 'currency',
                    currency: FORMATACAO_PCT_CONFIG.moeda.currency,
                    minimumFractionDigits: FORMATACAO_PCT_CONFIG.moeda.minimumFractionDigits,
                    maximumFractionDigits: FORMATACAO_PCT_CONFIG.moeda.maximumFractionDigits
                }
            );
            
            input.value = formattedValue;
            
            if (FORMATACAO_PCT_CONFIG.debug) {
                console.log(`💰 [PCT] Input formatado: ${formattedValue}`);
            }
            
        } catch (error) {
            console.error('❌ [PCT] Erro ao formatar input monetário:', error);
            // Não alterar o input em caso de erro para evitar perda de dados
        }
    },
    
    /**
     * 💰 FORMATAÇÃO DE VALOR PARA EXIBIÇÃO
     * Converte número para formato de moeda brasileira
     * 
     * @param {number|string} value - Valor a ser formatado
     * @returns {string} Valor formatado como moeda
     */
    formatCurrency: function(value) {
        try {
            if (value === undefined || value === null) {
                return 'R$ 0,00';
            }
            
            // Garantir que value seja um número
            let numValue;
            if (typeof value === 'string') {
                // Remover formatação existente e converter
                numValue = parseFloat(
                    value.replace(/[^\d.,]/g, '').replace(',', '.')
                );
            } else {
                numValue = parseFloat(value);
            }
            
            // Verificar se é um número válido
            if (isNaN(numValue)) {
                console.warn(`⚠️ [PCT] Valor inválido para formatação: ${value}`);
                return 'R$ 0,00';
            }
            
            // Formatar como moeda
            const formatted = numValue.toLocaleString(
                FORMATACAO_PCT_CONFIG.moeda.locale, {
                    style: 'currency',
                    currency: FORMATACAO_PCT_CONFIG.moeda.currency,
                    minimumFractionDigits: FORMATACAO_PCT_CONFIG.moeda.minimumFractionDigits,
                    maximumFractionDigits: FORMATACAO_PCT_CONFIG.moeda.maximumFractionDigits
                }
            );
            
            if (FORMATACAO_PCT_CONFIG.debug && Math.abs(numValue) > 1000) {
                console.log(`💰 [PCT] Valor grande formatado: ${numValue} → ${formatted}`);
            }
            
            return formatted;
            
        } catch (error) {
            console.error('❌ [PCT] Erro ao formatar valor monetário:', error);
            return 'R$ 0,00';
        }
    },
    
    /**
     * 🔢 CONVERSÃO DE VALOR FORMATADO PARA NÚMERO
     * Converte string formatada como moeda para número
     * 
     * @param {string} value - Valor formatado
     * @returns {number} Valor numérico
     */
    parseCurrencyValue: function(value) {
        try {
            if (!value) {
                return 0;
            }
            
            // ✅ CORREÇÃO: Usar lógica correta para formato monetário brasileiro
            // Remover símbolo de moeda (R$) e espaços
            let numericValue = value.toString().replace(/R\$\s*/g, '');
            
            // Substituir ponto por nada (formato brasileiro usa ponto como separador de milhar)
            numericValue = numericValue.replace(/\./g, '');
            
            // Substituir vírgula por ponto (formato brasileiro usa vírgula como separador decimal)
            numericValue = numericValue.replace(',', '.');
            
            // Converter para número
            const numValue = parseFloat(numericValue);
            
            const result = isNaN(numValue) ? 0 : numValue;
            
            if (FORMATACAO_PCT_CONFIG.debug && result !== numValue) {
                console.log(`🔢 [PCT] Conversão: "${value}" → ${result}`);
            }
            
            return result;
            
        } catch (error) {
            console.error('❌ [PCT] Erro ao converter valor monetário:', error);
            return 0;
        }
    },
    
    /**
     * 📏 FORMATAÇÃO DE VOLUME
     * Formata volume com precisão adequada para madeira
     * 
     * @param {number} volume - Volume em m³
     * @returns {string} Volume formatado
     */
    formatVolume: function(volume) {
        try {
            const numValue = parseFloat(volume) || 0;
            const decimais = FORMATACAO_PCT_CONFIG.volume.decimais;
            const unidade = FORMATACAO_PCT_CONFIG.volume.unidade;
            
            return `${numValue.toFixed(decimais)} ${unidade}`;
            
        } catch (error) {
            console.error('❌ [PCT] Erro ao formatar volume:', error);
            return '0,0000 m³';
        }
    },
    
    /**
     * 📦 FORMATAÇÃO ESPECÍFICA PCT - PEÇAS POR PACOTE
     * Formata quantidade de peças por pacote no padrão PCT
     * 
     * @param {number} quantidade - Quantidade de pacotes
     * @param {number} pecasPorPacote - Peças por pacote
     * @returns {string} Formatação PCT
     */
    formatPecasPorPacote: function(quantidade, pecasPorPacote) {
        try {
            const qtd = parseInt(quantidade) || 0;
            const pecas = parseInt(pecasPorPacote) || 1;
            
            return `${qtd} PACOTES C/${pecas}`;
            
        } catch (error) {
            console.error('❌ [PCT] Erro ao formatar peças por pacote:', error);
            return '0 PACOTES C/1';
        }
    },
    
    /**
     * 🔢 FORMATAÇÃO DE NÚMERO SIMPLES
     * Formata número com decimais específicos
     * 
     * @param {number} value - Valor numérico
     * @param {number} decimals - Número de decimais (padrão: 2)
     * @returns {string} Número formatado
     */
    formatNumber: function(value, decimals = 2) {
        try {
            const numValue = parseFloat(value) || 0;
            return numValue.toFixed(decimals);
            
        } catch (error) {
            console.error('❌ [PCT] Erro ao formatar número:', error);
            return '0.00';
        }
    },
    
    /**
     * 📊 FORMATAÇÃO PARA TABELA
     * Formata valores para exibição em tabelas
     * 
     * @param {Object} item - Item do romaneio
     * @returns {Object} Item com valores formatados
     */
    formatItemForTable: function(item) {
        try {
            return {
                ...item,
                volumeFormatado: this.formatVolume(item.volume),
                valorFormatado: this.formatCurrency(item.valorTotal),
                pecasFormatado: this.formatPecasPorPacote(item.quantidade, item.pecasPorPacote),
                precoFormatado: this.formatCurrency(item.valorUnitario)
            };
            
        } catch (error) {
            console.error('❌ [PCT] Erro ao formatar item para tabela:', error);
            return item;
        }
    }
};

// ========================================
// EXPOSIÇÃO GLOBAL DAS FUNÇÕES
// ========================================

// ✅ FUNÇÕES PRINCIPAIS (chamadas pelo HTML)
window.formatCurrencyInput = FormatacaoPCT.formatCurrencyInput;
window.formatCurrency = FormatacaoPCT.formatCurrency;
window.parseCurrencyValue = FormatacaoPCT.parseCurrencyValue;

// ✅ FUNÇÕES AUXILIARES
window.formatVolume = FormatacaoPCT.formatVolume;
window.formatPecasPorPacote = FormatacaoPCT.formatPecasPorPacote;
window.formatNumber = FormatacaoPCT.formatNumber;

// ✅ FUNÇÕES ESPECÍFICAS PCT
window.formatItemForTable = FormatacaoPCT.formatItemForTable;

// ✅ OBJETO COMPLETO PARA ACESSO AVANÇADO
window.FormatacaoPCT = FormatacaoPCT;

// ========================================
// INICIALIZAÇÃO E VALIDAÇÃO
// ========================================

// Verificar se todas as funções foram expostas corretamente
const funcoesEssenciais = [
    'formatCurrencyInput',
    'formatCurrency', 
    'parseCurrencyValue',
    'formatVolume'
];

let funcoesCarregadas = 0;
funcoesEssenciais.forEach(funcao => {
    if (typeof window[funcao] === 'function') {
        funcoesCarregadas++;
        if (FORMATACAO_PCT_CONFIG.debug) {
            console.log(`✅ [PCT] ${funcao} disponível globalmente`);
        }
    } else {
        console.error(`❌ [PCT] ${funcao} NÃO foi exposta globalmente`);
    }
});

// Log de status final
if (funcoesCarregadas === funcoesEssenciais.length) {
    console.log(`🎉 [PCT] Sistema de Formatação carregado com sucesso! (${funcoesCarregadas}/${funcoesEssenciais.length} funções)`);
} else {
    console.error(`❌ [PCT] Sistema de Formatação com problemas! (${funcoesCarregadas}/${funcoesEssenciais.length} funções)`);
}

// ========================================
// COMPATIBILIDADE E FALLBACKS
// ========================================

// Garantir compatibilidade com implementações antigas
if (!window.formatarVolume) {
    window.formatarVolume = FormatacaoPCT.formatVolume;
    console.log('✅ [PCT] Compatibilidade: formatarVolume definida');
}

if (!window.formatarValor) {
    window.formatarValor = FormatacaoPCT.formatCurrency;
    console.log('✅ [PCT] Compatibilidade: formatarValor definida');
}

// Marcar sistema como carregado
window.FORMATACAO_PCT_CARREGADA = true;
window.FORMATACAO_PCT_VERSION = '1.0.0';

console.log('💰 Sistema de Formatação PCT inicializado completamente');