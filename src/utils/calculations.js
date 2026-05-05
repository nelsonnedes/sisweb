/**
 * SISTEMA DE CÁLCULOS PROFISSIONAL
 * Cálculos precisos para volumes e valores do sistema
 * 
 * @author Sistema de Excelência Firebase
 * @version 2.0.0
 * @created 2024
 */

import { VOLUME_CALCULATIONS } from '../constants/app-constants.js';
import logger from './logger.js';

// =============================================================================
// CONSTANTES DE CÁLCULO
// =============================================================================

// Fatores de conversão para diferentes unidades
const CONVERSION_FACTORS = {
    // Metros para centímetros
    M_TO_CM: 100,
    // Centímetros para metros
    CM_TO_M: 0.01,
    // Metros cúbicos para litros
    M3_TO_L: 1000,
    // Litros para metros cúbicos
    L_TO_M3: 0.001
};

// Precisão padrão para cálculos
const DEFAULT_PRECISION = {
    VOLUME: 4,
    CURRENCY: 2,
    PERCENTAGE: 2,
    WEIGHT: 3
};

// =============================================================================
// CLASSE PRINCIPAL DE CÁLCULOS
// =============================================================================

class Calculator {
    constructor() {
        this.precision = { ...DEFAULT_PRECISION };
        this.calibrationFactor = VOLUME_CALCULATIONS.CALIBRATION_FACTOR;
    }

    /**
     * Define fator de calibração personalizado
     */
    setCalibrationFactor(factor) {
        if (typeof factor !== 'number' || factor <= 0) {
            logger.warn(`Fator de calibração inválido: ${factor}`, 'CALC');
            return;
        }
        
        this.calibrationFactor = factor;
        logger.debug(`Fator de calibração atualizado: ${factor}`, 'CALC');
    }

    /**
     * Define precisão para um tipo de cálculo
     */
    setPrecision(type, digits) {
        if (typeof digits === 'number' && digits >= 0) {
            this.precision[type.toUpperCase()] = digits;
        }
    }

    /**
     * Arredonda número com precisão específica
     */
    round(value, precision = null) {
        try {
            if (precision === null) {
                precision = this.precision.VOLUME;
            }
            
            const factor = Math.pow(10, precision);
            return Math.round(value * factor) / factor;
        } catch (error) {
            logger.error('Erro no arredondamento', 'CALC', error);
            return 0;
        }
    }

    // =========================================================================
    // CÁLCULOS DE VOLUME
    // =========================================================================

    /**
     * Calcula volume básico (altura × comprimento × largura)
     */
    calculateBasicVolume(altura, comprimento, largura, unidade = 'm') {
        try {
            // Validação de entrada
            if (!this.validateDimensions(altura, comprimento, largura)) {
                logger.warn('Dimensões inválidas para cálculo de volume', 'CALC');
                return 0;
            }

            // Converte todas as dimensões para metros se necessário
            const alturaM = this.convertToMeters(altura, unidade);
            const comprimentoM = this.convertToMeters(comprimento, unidade);
            const larguraM = this.convertToMeters(largura, unidade);

            // Calcula volume básico
            const volumeBasico = alturaM * comprimentoM * larguraM;

            // Log do cálculo
            logger.calculation(
                'Volume Básico',
                { altura: alturaM, comprimento: comprimentoM, largura: larguraM },
                volumeBasico
            );

            return this.round(volumeBasico, this.precision.VOLUME);
        } catch (error) {
            logger.error('Erro no cálculo de volume básico', 'CALC', error);
            return 0;
        }
    }

    /**
     * Calcula volume calibrado (volume básico × fator de calibração)
     */
    calculateCalibratedVolume(altura, comprimento, largura, unidade = 'm') {
        try {
            const volumeBasico = this.calculateBasicVolume(altura, comprimento, largura, unidade);
            const volumeCalibrado = volumeBasico * this.calibrationFactor;

            logger.calculation(
                'Volume Calibrado',
                { volumeBasico, fator: this.calibrationFactor },
                volumeCalibrado
            );

            return this.round(volumeCalibrado, this.precision.VOLUME);
        } catch (error) {
            logger.error('Erro no cálculo de volume calibrado', 'CALC', error);
            return 0;
        }
    }

    /**
     * Calcula volume total de uma lista de itens
     */
    calculateTotalVolume(itens, useCalibration = true) {
        try {
            if (!Array.isArray(itens) || itens.length === 0) {
                logger.warn('Lista de itens inválida para cálculo de volume total', 'CALC');
                return 0;
            }

            let volumeTotal = 0;

            for (const item of itens) {
                if (!item.altura || !item.comprimento || !item.largura) {
                    logger.warn('Item com dimensões incompletas', 'CALC', item);
                    continue;
                }

                const quantidade = parseFloat(item.quantidade) || 1;
                
                const volumeUnitario = useCalibration
                    ? this.calculateCalibratedVolume(item.altura, item.comprimento, item.largura)
                    : this.calculateBasicVolume(item.altura, item.comprimento, item.largura);

                const volumeItem = volumeUnitario * quantidade;
                volumeTotal += volumeItem;
            }

            logger.calculation('Volume Total', { itens: itens.length }, volumeTotal);
            return this.round(volumeTotal, this.precision.VOLUME);
        } catch (error) {
            logger.error('Erro no cálculo de volume total', 'CALC', error);
            return 0;
        }
    }

    // =========================================================================
    // CÁLCULOS FINANCEIROS
    // =========================================================================

    /**
     * Calcula valor de um item
     */
    calculateItemValue(volume, valorUnitario, quantidade = 1) {
        try {
            const vol = parseFloat(volume) || 0;
            const valor = parseFloat(valorUnitario) || 0;
            const qtd = parseFloat(quantidade) || 1;

            if (vol <= 0 || valor <= 0 || qtd <= 0) {
                logger.warn('Valores inválidos para cálculo financeiro', 'CALC');
                return 0;
            }

            const valorTotal = vol * valor * qtd;

            logger.calculation(
                'Valor Item',
                { volume: vol, valorUnitario: valor, quantidade: qtd },
                valorTotal
            );

            return this.round(valorTotal, this.precision.CURRENCY);
        } catch (error) {
            logger.error('Erro no cálculo de valor do item', 'CALC', error);
            return 0;
        }
    }

    /**
     * Calcula valor total de uma lista de itens
     */
    calculateTotalValue(itens) {
        try {
            if (!Array.isArray(itens) || itens.length === 0) {
                logger.warn('Lista de itens inválida para cálculo de valor total', 'CALC');
                return 0;
            }

            let valorTotal = 0;

            for (const item of itens) {
                const volume = item.volume || this.calculateCalibratedVolume(
                    item.altura, item.comprimento, item.largura
                );
                
                const valorItem = this.calculateItemValue(
                    volume,
                    item.valorUnitario,
                    item.quantidade
                );

                valorTotal += valorItem;
            }

            logger.calculation('Valor Total', { itens: itens.length }, valorTotal);
            return this.round(valorTotal, this.precision.CURRENCY);
        } catch (error) {
            logger.error('Erro no cálculo de valor total', 'CALC', error);
            return 0;
        }
    }

    /**
     * Calcula preço médio por m³
     */
    calculateAveragePrice(valorTotal, volumeTotal) {
        try {
            const valor = parseFloat(valorTotal) || 0;
            const volume = parseFloat(volumeTotal) || 0;

            if (volume <= 0) {
                logger.warn('Volume inválido para cálculo de preço médio', 'CALC');
                return 0;
            }

            const precoMedio = valor / volume;

            logger.calculation(
                'Preço Médio',
                { valorTotal: valor, volumeTotal: volume },
                precoMedio
            );

            return this.round(precoMedio, this.precision.CURRENCY);
        } catch (error) {
            logger.error('Erro no cálculo de preço médio', 'CALC', error);
            return 0;
        }
    }

    // =========================================================================
    // CÁLCULOS ESTATÍSTICOS
    // =========================================================================

    /**
     * Calcula estatísticas de um romaneio
     */
    calculateRomaneioStats(romaneio) {
        try {
            if (!romaneio || !romaneio.itens || !Array.isArray(romaneio.itens)) {
                logger.warn('Romaneio inválido para cálculo de estatísticas', 'CALC');
                return this.getEmptyStats();
            }

            const itens = romaneio.itens;
            const totalItens = itens.length;

            if (totalItens === 0) {
                return this.getEmptyStats();
            }

            // Cálculos básicos
            const volumeTotal = this.calculateTotalVolume(itens);
            const valorTotal = this.calculateTotalValue(itens);
            const precoMedio = this.calculateAveragePrice(valorTotal, volumeTotal);

            // Quantidade total
            const quantidadeTotal = itens.reduce((sum, item) => {
                return sum + (parseFloat(item.quantidade) || 0);
            }, 0);

            // Volume médio por item
            const volumeMedio = totalItens > 0 ? volumeTotal / totalItens : 0;

            // Valor médio por item
            const valorMedio = totalItens > 0 ? valorTotal / totalItens : 0;

            // Espécies únicas
            const especies = [...new Set(itens.map(item => item.especie))].filter(Boolean);

            // Distribuição por espécie
            const distribuicaoPorEspecie = this.calculateSpeciesDistribution(itens);

            const stats = {
                totalItens,
                quantidadeTotal: this.round(quantidadeTotal, 0),
                volumeTotal: this.round(volumeTotal, this.precision.VOLUME),
                valorTotal: this.round(valorTotal, this.precision.CURRENCY),
                precoMedio: this.round(precoMedio, this.precision.CURRENCY),
                volumeMedio: this.round(volumeMedio, this.precision.VOLUME),
                valorMedio: this.round(valorMedio, this.precision.CURRENCY),
                totalEspecies: especies.length,
                especies,
                distribuicaoPorEspecie
            };

            logger.calculation('Estatísticas Romaneio', { romaneioId: romaneio.id }, stats);
            return stats;
        } catch (error) {
            logger.error('Erro no cálculo de estatísticas', 'CALC', error);
            return this.getEmptyStats();
        }
    }

    /**
     * Calcula distribuição por espécie
     */
    calculateSpeciesDistribution(itens) {
        try {
            const distribuicao = {};

            for (const item of itens) {
                const especie = item.especie || 'Não informado';
                
                if (!distribuicao[especie]) {
                    distribuicao[especie] = {
                        quantidade: 0,
                        volume: 0,
                        valor: 0,
                        itens: 0
                    };
                }

                const quantidade = parseFloat(item.quantidade) || 0;
                const volume = item.volume || this.calculateCalibratedVolume(
                    item.altura, item.comprimento, item.largura
                );
                const valor = this.calculateItemValue(volume, item.valorUnitario, quantidade);

                distribuicao[especie].quantidade += quantidade;
                distribuicao[especie].volume += volume * quantidade;
                distribuicao[especie].valor += valor;
                distribuicao[especie].itens += 1;
            }

            // Arredonda valores
            for (const especie in distribuicao) {
                distribuicao[especie].quantidade = this.round(distribuicao[especie].quantidade, 0);
                distribuicao[especie].volume = this.round(distribuicao[especie].volume, this.precision.VOLUME);
                distribuicao[especie].valor = this.round(distribuicao[especie].valor, this.precision.CURRENCY);
            }

            return distribuicao;
        } catch (error) {
            logger.error('Erro no cálculo de distribuição por espécie', 'CALC', error);
            return {};
        }
    }

    // =========================================================================
    // UTILITÁRIOS
    // =========================================================================

    /**
     * Converte dimensão para metros
     */
    convertToMeters(value, unidade) {
        const num = parseFloat(value) || 0;
        
        switch (unidade.toLowerCase()) {
            case 'cm':
                return num * CONVERSION_FACTORS.CM_TO_M;
            case 'm':
            default:
                return num;
        }
    }

    /**
     * Valida dimensões
     */
    validateDimensions(altura, comprimento, largura) {
        const a = parseFloat(altura);
        const c = parseFloat(comprimento);
        const l = parseFloat(largura);

        return !isNaN(a) && !isNaN(c) && !isNaN(l) && 
               a > 0 && c > 0 && l > 0 &&
               a <= VOLUME_CALCULATIONS.VALIDATION.MAX_DIMENSION &&
               c <= VOLUME_CALCULATIONS.VALIDATION.MAX_DIMENSION &&
               l <= VOLUME_CALCULATIONS.VALIDATION.MAX_DIMENSION;
    }

    /**
     * Retorna estatísticas vazias
     */
    getEmptyStats() {
        return {
            totalItens: 0,
            quantidadeTotal: 0,
            volumeTotal: 0,
            valorTotal: 0,
            precoMedio: 0,
            volumeMedio: 0,
            valorMedio: 0,
            totalEspecies: 0,
            especies: [],
            distribuicaoPorEspecie: {}
        };
    }

    // =========================================================================
    // VALIDAÇÕES DE NEGÓCIO
    // =========================================================================

    /**
     * Valida se um item está dentro dos limites permitidos
     */
    validateItem(item) {
        const errors = [];

        // Valida dimensões
        if (!this.validateDimensions(item.altura, item.comprimento, item.largura)) {
            errors.push('Dimensões inválidas ou fora dos limites permitidos');
        }

        // Valida quantidade
        const quantidade = parseFloat(item.quantidade);
        if (isNaN(quantidade) || quantidade <= 0) {
            errors.push('Quantidade deve ser maior que zero');
        }

        // Valida valor unitário
        const valorUnitario = parseFloat(item.valorUnitario);
        if (isNaN(valorUnitario) || valorUnitario <= 0) {
            errors.push('Valor unitário deve ser maior que zero');
        }

        // Valida limites de valor
        const volume = this.calculateCalibratedVolume(item.altura, item.comprimento, item.largura);
        const valorTotal = this.calculateItemValue(volume, valorUnitario, quantidade);
        
        if (valorTotal > VOLUME_CALCULATIONS.VALIDATION.MAX_VALUE) {
            errors.push(`Valor total do item excede o limite de R$ ${VOLUME_CALCULATIONS.VALIDATION.MAX_VALUE.toLocaleString('pt-BR')}`);
        }

        return {
            isValid: errors.length === 0,
            errors: errors
        };
    }

    /**
     * Valida romaneio completo
     */
    validateRomaneio(romaneio) {
        const errors = [];

        if (!romaneio.itens || !Array.isArray(romaneio.itens) || romaneio.itens.length === 0) {
            errors.push('Romaneio deve ter pelo menos um item');
            return { isValid: false, errors: errors };
        }

        // Valida cada item
        let totalValue = 0;
        romaneio.itens.forEach((item, index) => {
            const itemValidation = this.validateItem(item);
            if (!itemValidation.isValid) {
                itemValidation.errors.forEach(error => {
                    errors.push(`Item ${index + 1}: ${error}`);
                });
            } else {
                const volume = this.calculateCalibratedVolume(item.altura, item.comprimento, item.largura);
                totalValue += this.calculateItemValue(volume, item.valorUnitario, item.quantidade);
            }
        });

        // Valida valor total do romaneio
        if (totalValue > VOLUME_CALCULATIONS.VALIDATION.MAX_TOTAL_VALUE) {
            errors.push(`Valor total do romaneio excede o limite de R$ ${VOLUME_CALCULATIONS.VALIDATION.MAX_TOTAL_VALUE.toLocaleString('pt-BR')}`);
        }

        return {
            isValid: errors.length === 0,
            errors: errors,
            totalValue: totalValue
        };
    }
}

// =============================================================================
// FUNÇÕES UTILITÁRIAS RÁPIDAS
// =============================================================================

/**
 * Calcula volume rápido (função estática)
 */
export function quickVolumeCalculation(altura, comprimento, largura, calibrated = true) {
    const calc = new Calculator();
    return calibrated 
        ? calc.calculateCalibratedVolume(altura, comprimento, largura)
        : calc.calculateBasicVolume(altura, comprimento, largura);
}

/**
 * Calcula valor rápido (função estática)
 */
export function quickValueCalculation(volume, valorUnitario, quantidade = 1) {
    const calc = new Calculator();
    return calc.calculateItemValue(volume, valorUnitario, quantidade);
}

/**
 * Processa item completo (calcula volume e valor)
 */
export function processItem(item) {
    try {
        const calc = new Calculator();
        
        // Calcula volume
        const volume = calc.calculateCalibratedVolume(
            item.altura, 
            item.comprimento, 
            item.largura
        );
        
        // Calcula valor total
        const valorTotal = calc.calculateItemValue(
            volume, 
            item.valorUnitario, 
            item.quantidade
        );

        return {
            ...item,
            volume: volume,
            valorTotal: valorTotal
        };
    } catch (error) {
        logger.error('Erro ao processar item', 'CALC', error);
        return item;
    }
}

/**
 * Processa romaneio completo
 */
export function processRomaneio(romaneio) {
    try {
        const calc = new Calculator();
        
        // Processa cada item
        const itensProcessados = romaneio.itens.map(item => processItem(item));
        
        // Calcula totais
        const stats = calc.calculateRomaneioStats({
            ...romaneio,
            itens: itensProcessados
        });

        return {
            ...romaneio,
            itens: itensProcessados,
            totalVolume: stats.volumeTotal,
            totalValor: stats.valorTotal,
            quantidadeTotal: stats.quantidadeTotal,
            stats: stats
        };
    } catch (error) {
        logger.error('Erro ao processar romaneio', 'CALC', error);
        return romaneio;
    }
}

// =============================================================================
// INSTÂNCIA GLOBAL
// =============================================================================
const calculator = new Calculator();

// =============================================================================
// EXPORTAÇÕES
// =============================================================================
export default Calculator;

// Exportar instância global
export { calculator };

// Exportar funções específicas
export const {
    calculateBasicVolume,
    calculateCalibratedVolume,
    calculateTotalVolume,
    calculateItemValue,
    calculateTotalValue,
    calculateAveragePrice,
    calculateRomaneioStats,
    validateItem,
    validateRomaneio,
    round
} = calculator; 