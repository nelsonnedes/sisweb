/**
 * SISTEMA DE VALIDAÇÃO PROFISSIONAL
 * Validadores reutilizáveis para todo o sistema
 * 
 * @author Sistema de Excelência Firebase
 * @version 2.0.0
 * @created 2024
 */

import { VALIDATION_CONFIG } from '../constants/app-constants.js';
import logger from './logger.js';

// =============================================================================
// TIPOS DE VALIDAÇÃO
// =============================================================================
const VALIDATION_TYPES = {
    REQUIRED: 'required',
    MIN_LENGTH: 'minLength',
    MAX_LENGTH: 'maxLength',
    PATTERN: 'pattern',
    EMAIL: 'email',
    CPF: 'cpf',
    CNPJ: 'cnpj',
    PHONE: 'phone',
    NUMBER: 'number',
    POSITIVE_NUMBER: 'positiveNumber',
    CURRENCY: 'currency',
    DATE: 'date',
    DIMENSIONS: 'dimensions',
    CUSTOM: 'custom'
};

// =============================================================================
// MENSAGENS DE ERRO PADRÃO
// =============================================================================
const DEFAULT_MESSAGES = {
    required: 'Este campo é obrigatório',
    minLength: 'Mínimo de {min} caracteres',
    maxLength: 'Máximo de {max} caracteres',
    pattern: 'Formato inválido',
    email: 'E-mail inválido',
    cpf: 'CPF inválido',
    cnpj: 'CNPJ inválido',
    phone: 'Telefone inválido',
    number: 'Deve ser um número válido',
    positiveNumber: 'Deve ser um número positivo',
    currency: 'Valor monetário inválido',
    date: 'Data inválida',
    dimensions: 'Dimensões inválidas',
    custom: 'Valor inválido'
};

// =============================================================================
// CLASSE PRINCIPAL DE VALIDAÇÃO
// =============================================================================
class Validator {
    constructor() {
        this.rules = new Map();
        this.errors = new Map();
    }

    // =========================================================================
    // VALIDADORES BÁSICOS
    // =========================================================================

    /**
     * Verifica se o valor não está vazio
     */
    isRequired(value) {
        if (value === null || value === undefined) return false;
        if (typeof value === 'string') return value.trim().length > 0;
        if (Array.isArray(value)) return value.length > 0;
        return true;
    }

    /**
     * Verifica comprimento mínimo
     */
    hasMinLength(value, min) {
        if (!value) return false;
        return value.toString().length >= min;
    }

    /**
     * Verifica comprimento máximo
     */
    hasMaxLength(value, max) {
        if (!value) return true;
        return value.toString().length <= max;
    }

    /**
     * Verifica padrão regex
     */
    matchesPattern(value, pattern) {
        if (!value) return true;
        const regex = new RegExp(pattern);
        return regex.test(value);
    }

    // =========================================================================
    // VALIDADORES ESPECÍFICOS
    // =========================================================================

    /**
     * Valida e-mail
     */
    isValidEmail(email) {
        if (!email) return false;
        return this.matchesPattern(email, VALIDATION_CONFIG.PATTERNS.EMAIL);
    }

    /**
     * Valida CPF
     */
    isValidCPF(cpf) {
        if (!cpf) return false;
        
        // Remove formatação
        const cleanCPF = cpf.replace(/[^\d]/g, '');
        
        // Verifica se tem 11 dígitos
        if (cleanCPF.length !== 11) return false;
        
        // Verifica se não são todos iguais
        if (/^(\d)\1{10}$/.test(cleanCPF)) return false;
        
        // Calcula dígitos verificadores
        let sum = 0;
        for (let i = 0; i < 9; i++) {
            sum += parseInt(cleanCPF[i]) * (10 - i);
        }
        let digit1 = 11 - (sum % 11);
        if (digit1 >= 10) digit1 = 0;
        
        sum = 0;
        for (let i = 0; i < 10; i++) {
            sum += parseInt(cleanCPF[i]) * (11 - i);
        }
        let digit2 = 11 - (sum % 11);
        if (digit2 >= 10) digit2 = 0;
        
        return digit1 === parseInt(cleanCPF[9]) && digit2 === parseInt(cleanCPF[10]);
    }

    /**
     * Valida CNPJ
     */
    isValidCNPJ(cnpj) {
        if (!cnpj) return false;
        
        // Remove formatação
        const cleanCNPJ = cnpj.replace(/[^\d]/g, '');
        
        // Verifica se tem 14 dígitos
        if (cleanCNPJ.length !== 14) return false;
        
        // Verifica se não são todos iguais
        if (/^(\d)\1{13}$/.test(cleanCNPJ)) return false;
        
        // Calcula primeiro dígito verificador
        const weights1 = [5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2];
        let sum = 0;
        for (let i = 0; i < 12; i++) {
            sum += parseInt(cleanCNPJ[i]) * weights1[i];
        }
        let digit1 = sum % 11;
        digit1 = digit1 < 2 ? 0 : 11 - digit1;
        
        // Calcula segundo dígito verificador
        const weights2 = [6, 5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2];
        sum = 0;
        for (let i = 0; i < 13; i++) {
            sum += parseInt(cleanCNPJ[i]) * weights2[i];
        }
        let digit2 = sum % 11;
        digit2 = digit2 < 2 ? 0 : 11 - digit2;
        
        return digit1 === parseInt(cleanCNPJ[12]) && digit2 === parseInt(cleanCNPJ[13]);
    }

    /**
     * Valida telefone
     */
    isValidPhone(phone) {
        if (!phone) return false;
        const cleanPhone = phone.replace(/[^\d]/g, '');
        return cleanPhone.length >= 10 && cleanPhone.length <= 11;
    }

    /**
     * Valida número
     */
    isValidNumber(value) {
        if (value === null || value === undefined || value === '') return false;
        return !isNaN(value) && isFinite(value);
    }

    /**
     * Valida número positivo
     */
    isPositiveNumber(value) {
        if (!this.isValidNumber(value)) return false;
        return parseFloat(value) > 0;
    }

    /**
     * Valida valor monetário
     */
    isValidCurrency(value) {
        if (!value) return false;
        const pattern = /^\d+([.,]\d{1,2})?$/;
        return pattern.test(value.toString().replace(/\s/g, ''));
    }

    /**
     * Valida data
     */
    isValidDate(dateString) {
        if (!dateString) return false;
        const date = new Date(dateString);
        return date instanceof Date && !isNaN(date);
    }

    /**
     * Valida dimensões (altura, comprimento, largura)
     */
    isValidDimensions(value) {
        if (!this.isValidNumber(value)) return false;
        const num = parseFloat(value);
        return num > 0 && num <= VALIDATION_CONFIG.DIMENSION_LIMITS.MAX_DIMENSION;
    }

    // =========================================================================
    // VALIDADORES DE NEGÓCIO
    // =========================================================================

    /**
     * Valida dados do romaneio
     */
    validateRomaneio(romaneio) {
        const errors = [];

        // Valida campos obrigatórios
        if (!this.isRequired(romaneio.fornecedor)) {
            errors.push({ field: 'fornecedor', message: 'Fornecedor é obrigatório' });
        }

        if (!this.isRequired(romaneio.dataEmissao)) {
            errors.push({ field: 'dataEmissao', message: 'Data de emissão é obrigatória' });
        }

        if (!romaneio.itens || romaneio.itens.length === 0) {
            errors.push({ field: 'itens', message: 'Pelo menos um item é obrigatório' });
        }

        // Valida itens
        if (romaneio.itens) {
            romaneio.itens.forEach((item, index) => {
                const itemErrors = this.validateRomaneioItem(item, index);
                errors.push(...itemErrors);
            });
        }

        return {
            isValid: errors.length === 0,
            errors: errors
        };
    }

    /**
     * Valida item do romaneio
     */
    validateRomaneioItem(item, index = 0) {
        const errors = [];
        const prefix = `item[${index}]`;

        // Valida espécie
        if (!this.isRequired(item.especie)) {
            errors.push({ field: `${prefix}.especie`, message: 'Espécie é obrigatória' });
        }

        // Valida dimensões
        if (!this.isValidDimensions(item.altura)) {
            errors.push({ field: `${prefix}.altura`, message: 'Altura inválida' });
        }

        if (!this.isValidDimensions(item.comprimento)) {
            errors.push({ field: `${prefix}.comprimento`, message: 'Comprimento inválido' });
        }

        if (!this.isValidDimensions(item.largura)) {
            errors.push({ field: `${prefix}.largura`, message: 'Largura inválida' });
        }

        // Valida quantidade
        if (!this.isPositiveNumber(item.quantidade)) {
            errors.push({ field: `${prefix}.quantidade`, message: 'Quantidade deve ser positiva' });
        }

        // Valida valor unitário
        if (!this.isPositiveNumber(item.valorUnitario)) {
            errors.push({ field: `${prefix}.valorUnitario`, message: 'Valor unitário deve ser positivo' });
        }

        return errors;
    }

    /**
     * Valida dados do cliente/fornecedor
     */
    validateCliente(cliente) {
        const errors = [];

        // Nome obrigatório
        if (!this.isRequired(cliente.nome)) {
            errors.push({ field: 'nome', message: 'Nome é obrigatório' });
        }

        // CPF ou CNPJ
        if (cliente.cpf && !this.isValidCPF(cliente.cpf)) {
            errors.push({ field: 'cpf', message: 'CPF inválido' });
        }

        if (cliente.cnpj && !this.isValidCNPJ(cliente.cnpj)) {
            errors.push({ field: 'cnpj', message: 'CNPJ inválido' });
        }

        // Email
        if (cliente.email && !this.isValidEmail(cliente.email)) {
            errors.push({ field: 'email', message: 'E-mail inválido' });
        }

        // Telefone
        if (cliente.telefone && !this.isValidPhone(cliente.telefone)) {
            errors.push({ field: 'telefone', message: 'Telefone inválido' });
        }

        return {
            isValid: errors.length === 0,
            errors: errors
        };
    }

    // =========================================================================
    // SISTEMA DE REGRAS
    // =========================================================================

    /**
     * Adiciona uma regra de validação
     */
    addRule(field, type, options = {}) {
        if (!this.rules.has(field)) {
            this.rules.set(field, []);
        }

        this.rules.get(field).push({
            type,
            options,
            message: options.message || DEFAULT_MESSAGES[type]
        });

        return this;
    }

    /**
     * Valida um campo baseado nas regras definidas
     */
    validateField(field, value) {
        const rules = this.rules.get(field) || [];
        const errors = [];

        for (const rule of rules) {
            let isValid = true;
            let message = rule.message;

            switch (rule.type) {
                case VALIDATION_TYPES.REQUIRED:
                    isValid = this.isRequired(value);
                    break;
                case VALIDATION_TYPES.MIN_LENGTH:
                    isValid = this.hasMinLength(value, rule.options.min);
                    message = message.replace('{min}', rule.options.min);
                    break;
                case VALIDATION_TYPES.MAX_LENGTH:
                    isValid = this.hasMaxLength(value, rule.options.max);
                    message = message.replace('{max}', rule.options.max);
                    break;
                case VALIDATION_TYPES.PATTERN:
                    isValid = this.matchesPattern(value, rule.options.pattern);
                    break;
                case VALIDATION_TYPES.EMAIL:
                    isValid = this.isValidEmail(value);
                    break;
                case VALIDATION_TYPES.CPF:
                    isValid = this.isValidCPF(value);
                    break;
                case VALIDATION_TYPES.CNPJ:
                    isValid = this.isValidCNPJ(value);
                    break;
                case VALIDATION_TYPES.PHONE:
                    isValid = this.isValidPhone(value);
                    break;
                case VALIDATION_TYPES.NUMBER:
                    isValid = this.isValidNumber(value);
                    break;
                case VALIDATION_TYPES.POSITIVE_NUMBER:
                    isValid = this.isPositiveNumber(value);
                    break;
                case VALIDATION_TYPES.CURRENCY:
                    isValid = this.isValidCurrency(value);
                    break;
                case VALIDATION_TYPES.DATE:
                    isValid = this.isValidDate(value);
                    break;
                case VALIDATION_TYPES.DIMENSIONS:
                    isValid = this.isValidDimensions(value);
                    break;
                case VALIDATION_TYPES.CUSTOM:
                    isValid = rule.options.validator(value);
                    break;
            }

            if (!isValid) {
                errors.push(message);
            }

            // Log da validação
            logger.validation(field, value, isValid, message);
        }

        // Atualiza erros do campo
        if (errors.length > 0) {
            this.errors.set(field, errors);
        } else {
            this.errors.delete(field);
        }

        return {
            isValid: errors.length === 0,
            errors: errors
        };
    }

    /**
     * Valida um objeto completo
     */
    validateObject(obj) {
        const allErrors = {};
        let isValid = true;

        // Valida cada campo que tem regras
        for (const [field] of this.rules) {
            const value = this.getNestedValue(obj, field);
            const result = this.validateField(field, value);
            
            if (!result.isValid) {
                allErrors[field] = result.errors;
                isValid = false;
            }
        }

        return {
            isValid,
            errors: allErrors
        };
    }

    /**
     * Obtém valor aninhado de um objeto (ex: 'user.address.city')
     */
    getNestedValue(obj, path) {
        return path.split('.').reduce((current, key) => {
            return current && current[key] !== undefined ? current[key] : undefined;
        }, obj);
    }

    /**
     * Limpa todas as regras
     */
    clearRules() {
        this.rules.clear();
        this.errors.clear();
        return this;
    }

    /**
     * Limpa erros de um campo específico
     */
    clearFieldError(field) {
        this.errors.delete(field);
        return this;
    }

    /**
     * Obtém erros de um campo
     */
    getFieldErrors(field) {
        return this.errors.get(field) || [];
    }

    /**
     * Obtém todos os erros
     */
    getAllErrors() {
        return Object.fromEntries(this.errors);
    }

    /**
     * Verifica se há erros
     */
    hasErrors() {
        return this.errors.size > 0;
    }
}

// =============================================================================
// FUNÇÕES UTILITÁRIAS
// =============================================================================

/**
 * Cria um validador com regras predefinidas para romaneio
 */
export function createRomaneioValidator() {
    const validator = new Validator();
    
    validator
        .addRule('fornecedor', VALIDATION_TYPES.REQUIRED)
        .addRule('fornecedor', VALIDATION_TYPES.MIN_LENGTH, { min: 2 })
        .addRule('dataEmissao', VALIDATION_TYPES.REQUIRED)
        .addRule('dataEmissao', VALIDATION_TYPES.DATE);

    return validator;
}

/**
 * Cria um validador com regras predefinidas para cliente
 */
export function createClienteValidator() {
    const validator = new Validator();
    
    validator
        .addRule('nome', VALIDATION_TYPES.REQUIRED)
        .addRule('nome', VALIDATION_TYPES.MIN_LENGTH, { min: 2 })
        .addRule('nome', VALIDATION_TYPES.MAX_LENGTH, { max: 100 })
        .addRule('email', VALIDATION_TYPES.EMAIL)
        .addRule('telefone', VALIDATION_TYPES.PHONE);

    return validator;
}

/**
 * Validação rápida de um valor
 */
export function quickValidate(value, type, options = {}) {
    const validator = new Validator();
    const result = validator.validateField('temp', value);
    validator.addRule('temp', type, options);
    return result;
}

// =============================================================================
// EXPORTAÇÕES
// =============================================================================
export default Validator;
export { VALIDATION_TYPES }; 