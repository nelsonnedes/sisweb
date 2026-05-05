/**
 * SISTEMA DE FORMATAÇÃO PROFISSIONAL
 * Formatadores reutilizáveis para todo o sistema
 * 
 * @author Sistema de Excelência Firebase
 * @version 2.0.0
 * @created 2024
 */

import { FORMAT_CONFIG } from '../constants/app-constants.js';
import logger from './logger.js';

// =============================================================================
// FORMATADORES DE NÚMERO
// =============================================================================

/**
 * Formata número como moeda brasileira
 */
export function formatCurrency(value, options = {}) {
    try {
        const config = {
            ...FORMAT_CONFIG.CURRENCY,
            ...options
        };

        // Converte para número se necessário
        const numValue = typeof value === 'string' ? parseFloat(value.replace(',', '.')) : value;
        
        if (isNaN(numValue)) {
            logger.warn(`Valor inválido para formatação de moeda: ${value}`, 'FORMATTER');
            return config.SYMBOL + ' 0,00';
        }

        return new Intl.NumberFormat(config.LOCALE, {
            style: 'currency',
            currency: config.CODE,
            minimumFractionDigits: config.DECIMAL_PLACES,
            maximumFractionDigits: config.DECIMAL_PLACES
        }).format(numValue);
    } catch (error) {
        logger.error('Erro ao formatar moeda', 'FORMATTER', error);
        return 'R$ 0,00';
    }
}

/**
 * Formata número decimal
 */
export function formatNumber(value, decimals = 2, options = {}) {
    try {
        const config = {
            locale: FORMAT_CONFIG.LOCALE,
            ...options
        };

        const numValue = typeof value === 'string' ? parseFloat(value.replace(',', '.')) : value;
        
        if (isNaN(numValue)) {
            logger.warn(`Valor inválido para formatação de número: ${value}`, 'FORMATTER');
            return '0' + ',00'.substring(0, decimals > 0 ? decimals + 1 : 0);
        }

        return new Intl.NumberFormat(config.locale, {
            minimumFractionDigits: decimals,
            maximumFractionDigits: decimals
        }).format(numValue);
    } catch (error) {
        logger.error('Erro ao formatar número', 'FORMATTER', error);
        return '0,00';
    }
}

/**
 * Formata porcentagem
 */
export function formatPercentage(value, decimals = 1) {
    try {
        const numValue = typeof value === 'string' ? parseFloat(value.replace(',', '.')) : value;
        
        if (isNaN(numValue)) {
            logger.warn(`Valor inválido para formatação de porcentagem: ${value}`, 'FORMATTER');
            return '0%';
        }

        return new Intl.NumberFormat(FORMAT_CONFIG.LOCALE, {
            style: 'percent',
            minimumFractionDigits: decimals,
            maximumFractionDigits: decimals
        }).format(numValue / 100);
    } catch (error) {
        logger.error('Erro ao formatar porcentagem', 'FORMATTER', error);
        return '0%';
    }
}

/**
 * Formata volume em m³
 */
export function formatVolume(value, decimals = 4) {
    try {
        const formattedNumber = formatNumber(value, decimals);
        return `${formattedNumber} m³`;
    } catch (error) {
        logger.error('Erro ao formatar volume', 'FORMATTER', error);
        return '0,0000 m³';
    }
}

/**
 * Formata dimensões (altura x comprimento x largura)
 */
export function formatDimensions(altura, comprimento, largura, decimals = 2) {
    try {
        const a = formatNumber(altura, decimals);
        const c = formatNumber(comprimento, decimals);
        const l = formatNumber(largura, decimals);
        return `${a} × ${c} × ${l}`;
    } catch (error) {
        logger.error('Erro ao formatar dimensões', 'FORMATTER', error);
        return '0,00 × 0,00 × 0,00';
    }
}

// =============================================================================
// FORMATADORES DE DATA
// =============================================================================

/**
 * Formata data brasileira
 */
export function formatDate(date, options = {}) {
    try {
        const config = {
            ...FORMAT_CONFIG.DATE,
            ...options
        };

        let dateObj;
        
        if (typeof date === 'string') {
            dateObj = new Date(date);
        } else if (date instanceof Date) {
            dateObj = date;
        } else {
            logger.warn(`Tipo de data inválido: ${typeof date}`, 'FORMATTER');
            return 'Data inválida';
        }

        if (isNaN(dateObj.getTime())) {
            logger.warn(`Data inválida: ${date}`, 'FORMATTER');
            return 'Data inválida';
        }

        return new Intl.DateTimeFormat(config.LOCALE, {
            day: '2-digit',
            month: '2-digit',
            year: 'numeric',
            timeZone: config.TIMEZONE
        }).format(dateObj);
    } catch (error) {
        logger.error('Erro ao formatar data', 'FORMATTER', error);
        return 'Data inválida';
    }
}

/**
 * Formata data e hora
 */
export function formatDateTime(date, options = {}) {
    try {
        const config = {
            ...FORMAT_CONFIG.DATE,
            ...options
        };

        let dateObj;
        
        if (typeof date === 'string') {
            dateObj = new Date(date);
        } else if (date instanceof Date) {
            dateObj = date;
        } else {
            return 'Data/hora inválida';
        }

        if (isNaN(dateObj.getTime())) {
            return 'Data/hora inválida';
        }

        return new Intl.DateTimeFormat(config.LOCALE, {
            day: '2-digit',
            month: '2-digit',
            year: 'numeric',
            hour: '2-digit',
            minute: '2-digit',
            timeZone: config.TIMEZONE
        }).format(dateObj);
    } catch (error) {
        logger.error('Erro ao formatar data/hora', 'FORMATTER', error);
        return 'Data/hora inválida';
    }
}

/**
 * Formata timestamp para relatórios
 */
export function formatTimestamp(timestamp) {
    try {
        const date = new Date(timestamp);
        return formatDateTime(date);
    } catch (error) {
        logger.error('Erro ao formatar timestamp', 'FORMATTER', error);
        return 'Timestamp inválido';
    }
}

// =============================================================================
// FORMATADORES DE DOCUMENTO
// =============================================================================

/**
 * Formata CPF (000.000.000-00)
 */
export function formatCPF(cpf) {
    try {
        if (!cpf) return '';
        
        // Remove caracteres não numéricos
        const cleanCPF = cpf.replace(/\D/g, '');
        
        // Aplica máscara
        return cleanCPF.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, '$1.$2.$3-$4');
    } catch (error) {
        logger.error('Erro ao formatar CPF', 'FORMATTER', error);
        return cpf;
    }
}

/**
 * Formata CNPJ (00.000.000/0000-00)
 */
export function formatCNPJ(cnpj) {
    try {
        if (!cnpj) return '';
        
        // Remove caracteres não numéricos
        const cleanCNPJ = cnpj.replace(/\D/g, '');
        
        // Aplica máscara
        return cleanCNPJ.replace(/(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})/, '$1.$2.$3/$4-$5');
    } catch (error) {
        logger.error('Erro ao formatar CNPJ', 'FORMATTER', error);
        return cnpj;
    }
}

/**
 * Formata telefone
 */
export function formatPhone(phone) {
    try {
        if (!phone) return '';
        
        // Remove caracteres não numéricos
        const cleanPhone = phone.replace(/\D/g, '');
        
        // Aplica máscara baseada no tamanho
        if (cleanPhone.length === 10) {
            // Telefone fixo: (00) 0000-0000
            return cleanPhone.replace(/(\d{2})(\d{4})(\d{4})/, '($1) $2-$3');
        } else if (cleanPhone.length === 11) {
            // Celular: (00) 00000-0000
            return cleanPhone.replace(/(\d{2})(\d{5})(\d{4})/, '($1) $2-$3');
        }
        
        return phone;
    } catch (error) {
        logger.error('Erro ao formatar telefone', 'FORMATTER', error);
        return phone;
    }
}

// =============================================================================
// FORMATADORES DE TEXTO
// =============================================================================

/**
 * Capitaliza primeira letra de cada palavra
 */
export function capitalize(text) {
    try {
        if (!text) return '';
        
        return text
            .toLowerCase()
            .replace(/(?:^|\s)\S/g, (char) => char.toUpperCase());
    } catch (error) {
        logger.error('Erro ao capitalizar texto', 'FORMATTER', error);
        return text || '';
    }
}

/**
 * Formata nome próprio
 */
export function formatName(name) {
    try {
        if (!name) return '';
        
        // Palavras que devem permanecer em minúsculo
        const lowerCaseWords = ['de', 'da', 'do', 'das', 'dos', 'e'];
        
        return name
            .toLowerCase()
            .split(' ')
            .map((word, index) => {
                // Primeira palavra sempre maiúscula
                if (index === 0) {
                    return word.charAt(0).toUpperCase() + word.slice(1);
                }
                
                // Verifica se é uma palavra que deve ficar minúscula
                if (lowerCaseWords.includes(word)) {
                    return word;
                }
                
                return word.charAt(0).toUpperCase() + word.slice(1);
            })
            .join(' ');
    } catch (error) {
        logger.error('Erro ao formatar nome', 'FORMATTER', error);
        return name || '';
    }
}

/**
 * Trunca texto com reticências
 */
export function truncateText(text, maxLength, suffix = '...') {
    try {
        if (!text) return '';
        
        if (text.length <= maxLength) {
            return text;
        }
        
        return text.substring(0, maxLength - suffix.length) + suffix;
    } catch (error) {
        logger.error('Erro ao truncar texto', 'FORMATTER', error);
        return text || '';
    }
}

// =============================================================================
// FORMATADORES DE DADOS
// =============================================================================

/**
 * Formata bytes em formato legível
 */
export function formatBytes(bytes, decimals = 2) {
    try {
        if (bytes === 0) return '0 Bytes';
        
        const k = 1024;
        const dm = decimals < 0 ? 0 : decimals;
        const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
        
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        
        return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + ' ' + sizes[i];
    } catch (error) {
        logger.error('Erro ao formatar bytes', 'FORMATTER', error);
        return '0 Bytes';
    }
}

/**
 * Formata ID do Firebase (apenas últimos 8 caracteres)
 */
export function formatFirebaseId(id) {
    try {
        if (!id) return '';
        
        if (id.length <= 8) {
            return id;
        }
        
        return '...' + id.slice(-8);
    } catch (error) {
        logger.error('Erro ao formatar ID do Firebase', 'FORMATTER', error);
        return id || '';
    }
}

// =============================================================================
// FORMATADORES ESPECÍFICOS DO SISTEMA
// =============================================================================

/**
 * Formata dados do romaneio para exibição
 */
export function formatRomaneioDisplay(romaneio) {
    try {
        return {
            id: formatFirebaseId(romaneio.id),
            fornecedor: formatName(romaneio.fornecedor),
            dataEmissao: formatDate(romaneio.dataEmissao),
            totalVolume: formatVolume(romaneio.totalVolume),
            totalValor: formatCurrency(romaneio.totalValor),
            quantidadeItens: romaneio.itens ? romaneio.itens.length : 0,
            status: romaneio.status || 'Ativo'
        };
    } catch (error) {
        logger.error('Erro ao formatar dados do romaneio', 'FORMATTER', error);
        return romaneio;
    }
}

/**
 * Formata item do romaneio para exibição
 */
export function formatRomaneioItem(item, index) {
    try {
        return {
            numero: index + 1,
            especie: formatName(item.especie),
            dimensoes: formatDimensions(item.altura, item.comprimento, item.largura),
            quantidade: formatNumber(item.quantidade, 0),
            volume: formatVolume(item.volume),
            valorUnitario: formatCurrency(item.valorUnitario),
            valorTotal: formatCurrency(item.valorTotal)
        };
    } catch (error) {
        logger.error('Erro ao formatar item do romaneio', 'FORMATTER', error);
        return item;
    }
}

/**
 * Formata dados para relatório
 */
export function formatReportData(data) {
    try {
        return {
            ...data,
            dataGeracao: formatDateTime(new Date()),
            totalFormatado: formatCurrency(data.total),
            volumeFormatado: formatVolume(data.volume),
            periodo: data.dataInicio && data.dataFim 
                ? `${formatDate(data.dataInicio)} a ${formatDate(data.dataFim)}`
                : 'Período não especificado'
        };
    } catch (error) {
        logger.error('Erro ao formatar dados do relatório', 'FORMATTER', error);
        return data;
    }
}

// =============================================================================
// PARSERS (CONVERSORES)
// =============================================================================

/**
 * Converte string formatada em número
 */
export function parseFormattedNumber(formattedValue) {
    try {
        if (!formattedValue) return 0;
        
        // Remove formatação e converte
        const cleanValue = formattedValue
            .toString()
            .replace(/[^\d,-]/g, '')  // Remove tudo exceto dígitos, vírgula e hífen
            .replace(',', '.');        // Substitui vírgula por ponto
        
        const parsed = parseFloat(cleanValue);
        return isNaN(parsed) ? 0 : parsed;
    } catch (error) {
        logger.error('Erro ao converter número formatado', 'FORMATTER', error);
        return 0;
    }
}

/**
 * Alias claro para parsing de números brasileiros (12,50 → 12.5)
 */
export function parseBrazilianNumber(value) {
    return parseFormattedNumber(value);
}

/**
 * Converte data brasileira para ISO
 */
export function parseBrazilianDate(dateString) {
    try {
        if (!dateString) return null;
        
        // Formato DD/MM/YYYY
        const parts = dateString.split('/');
        if (parts.length === 3) {
            const [day, month, year] = parts;
            return new Date(year, month - 1, day);
        }
        
        return new Date(dateString);
    } catch (error) {
        logger.error('Erro ao converter data brasileira', 'FORMATTER', error);
        return null;
    }
}

// =============================================================================
// UTILITÁRIOS DE FORMATAÇÃO
// =============================================================================

/**
 * Aplica formatação baseada no tipo de dado
 */
export function autoFormat(value, type, options = {}) {
    try {
        switch (type.toLowerCase()) {
            case 'currency':
            case 'money':
                return formatCurrency(value, options);
            case 'number':
                return formatNumber(value, options.decimals, options);
            case 'percentage':
                return formatPercentage(value, options.decimals);
            case 'date':
                return formatDate(value, options);
            case 'datetime':
                return formatDateTime(value, options);
            case 'cpf':
                return formatCPF(value);
            case 'cnpj':
                return formatCNPJ(value);
            case 'phone':
                return formatPhone(value);
            case 'name':
                return formatName(value);
            case 'volume':
                return formatVolume(value, options.decimals);
            case 'dimensions':
                return formatDimensions(
                    options.altura, 
                    options.comprimento, 
                    options.largura, 
                    options.decimals
                );
            default:
                return value;
        }
    } catch (error) {
        logger.error(`Erro na formatação automática (tipo: ${type})`, 'FORMATTER', error);
        return value;
    }
}

/**
 * Cria um formatador personalizado
 */
export function createCustomFormatter(template, mappings = {}) {
    return function(data) {
        try {
            let formatted = template;
            
            for (const [key, formatter] of Object.entries(mappings)) {
                const value = data[key];
                const formattedValue = typeof formatter === 'function' 
                    ? formatter(value) 
                    : autoFormat(value, formatter);
                
                formatted = formatted.replace(new RegExp(`\\{${key}\\}`, 'g'), formattedValue);
            }
            
            return formatted;
        } catch (error) {
            logger.error('Erro no formatador personalizado', 'FORMATTER', error);
            return template;
        }
    };
}

// =============================================================================
// VALIDAÇÃO DE FORMATAÇÃO
// =============================================================================

/**
 * Verifica se um valor está corretamente formatado
 */
export function isValidFormat(value, type) {
    try {
        switch (type.toLowerCase()) {
            case 'cpf':
                return /^\d{3}\.\d{3}\.\d{3}-\d{2}$/.test(value);
            case 'cnpj':
                return /^\d{2}\.\d{3}\.\d{3}\/\d{4}-\d{2}$/.test(value);
            case 'phone':
                return /^\(\d{2}\) \d{4,5}-\d{4}$/.test(value);
            case 'currency':
                return /^R\$\s[\d.,]+$/.test(value);
            case 'date':
                return /^\d{2}\/\d{2}\/\d{4}$/.test(value);
            default:
                return true;
        }
    } catch (error) {
        logger.error('Erro na validação de formato', 'FORMATTER', error);
        return false;
    }
}

// =============================================================================
// EXPORTAÇÕES AGRUPADAS
// =============================================================================
export const formatters = {
    // Números
    currency: formatCurrency,
    number: formatNumber,
    percentage: formatPercentage,
    volume: formatVolume,
    dimensions: formatDimensions,
    
    // Datas
    date: formatDate,
    dateTime: formatDateTime,
    timestamp: formatTimestamp,
    
    // Documentos
    cpf: formatCPF,
    cnpj: formatCNPJ,
    phone: formatPhone,
    
    // Texto
    capitalize,
    name: formatName,
    truncate: truncateText,
    
    // Sistema
    bytes: formatBytes,
    firebaseId: formatFirebaseId,
    romaneio: formatRomaneioDisplay,
    romaneioItem: formatRomaneioItem,
    report: formatReportData,
    
    // Utilitários
    auto: autoFormat,
    custom: createCustomFormatter
};

export const parsers = {
    number: parseFormattedNumber,
    brazilianNumber: parseBrazilianNumber,
    date: parseBrazilianDate
};

export const validators = {
    format: isValidFormat
};