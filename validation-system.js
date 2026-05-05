/**
 * Sistema de Validação Avançado - SISWEB
 * 
 * PRÁTICAS DE PROGRAMAÇÃO SEGURA:
 * - Validação rigorosa de entrada
 * - Sanitização com preservação UTF-8
 * - Prevenção de XSS e injeção
 * - Formatação consistente
 */

/**
 * VALIDADORES PRINCIPAIS
 */
class ValidationSystem {
    constructor() {
        this.errors = new Map();
        this.rules = new Map();
        this.formatters = new Map();
        
        this.initializeDefaultRules();
        this.initializeFormatters();
    }
    
    /**
     * REGRAS DE VALIDAÇÃO PADRÃO
     */
    initializeDefaultRules() {
        // Números
        this.addRule('number', (value, options = {}) => {
            const num = parseFloat(String(value).replace(',', '.'));
            if (isNaN(num)) throw new Error('Valor numérico inválido');
            if (options.min !== undefined && num < options.min) {
                throw new Error(`Valor deve ser maior que ${options.min}`);
            }
            if (options.max !== undefined && num > options.max) {
                throw new Error(`Valor deve ser menor que ${options.max}`);
            }
            return num;
        });
        
        // Texto com segurança UTF-8
        this.addRule('text', (value, options = {}) => {
            if (typeof value !== 'string') {
                value = String(value);
            }
            
            // Preservar UTF-8 mas remover tags perigosas
            let sanitized = value
                .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
                .replace(/<iframe\b[^<]*(?:(?!<\/iframe>)<[^<]*)*<\/iframe>/gi, '')
                .replace(/javascript:/gi, '')
                .replace(/on\w+\s*=/gi, '');
            
            if (options.minLength && sanitized.length < options.minLength) {
                throw new Error(`Texto deve ter pelo menos ${options.minLength} caracteres`);
            }
            
            if (options.maxLength && sanitized.length > options.maxLength) {
                throw new Error(`Texto deve ter no máximo ${options.maxLength} caracteres`);
            }
            
            return sanitized.trim();
        });
        
        // Email
        this.addRule('email', (value) => {
            const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
            const cleaned = String(value).trim().toLowerCase();
            if (!emailRegex.test(cleaned)) {
                throw new Error('Email inválido');
            }
            return cleaned;
        });
        
        // Telefone brasileiro
        this.addRule('phone', (value) => {
            const cleaned = String(value).replace(/\D/g, '');
            if (cleaned.length < 10 || cleaned.length > 11) {
                throw new Error('Telefone deve ter 10 ou 11 dígitos');
            }
            return cleaned;
        });
        
        // CNPJ
        this.addRule('cnpj', (value) => {
            const cleaned = String(value).replace(/\D/g, '');
            if (cleaned.length !== 14) {
                throw new Error('CNPJ deve ter 14 dígitos');
            }
            // Validação básica de CNPJ
            if (!/^\d{14}$/.test(cleaned)) {
                throw new Error('CNPJ inválido');
            }
            return cleaned;
        });
        
        // CPF
        this.addRule('cpf', (value) => {
            const cleaned = String(value).replace(/\D/g, '');
            if (cleaned.length !== 11) {
                throw new Error('CPF deve ter 11 dígitos');
            }
            return cleaned;
        });
        
        // Moeda
        this.addRule('currency', (value) => {
            const cleaned = String(value)
                .replace(/[^\d,.-]/g, '')
                .replace(',', '.');
            const num = parseFloat(cleaned);
            if (isNaN(num) || num < 0) {
                throw new Error('Valor monetário inválido');
            }
            return num;
        });
        
        // Data
        this.addRule('date', (value) => {
            const date = new Date(value);
            if (isNaN(date.getTime())) {
                throw new Error('Data inválida');
            }
            return date;
        });
    }
    
    /**
     * FORMATADORES
     */
    initializeFormatters() {
        // Formatação de moeda
        this.addFormatter('currency', (value) => {
            return new Intl.NumberFormat('pt-BR', {
                style: 'currency',
                currency: 'BRL'
            }).format(value);
        });
        
        // Formatação de telefone
        this.addFormatter('phone', (value) => {
            const cleaned = String(value).replace(/\D/g, '');
            if (cleaned.length === 11) {
                return cleaned.replace(/(\d{2})(\d{5})(\d{4})/, '($1) $2-$3');
            } else if (cleaned.length === 10) {
                return cleaned.replace(/(\d{2})(\d{4})(\d{4})/, '($1) $2-$3');
            }
            return value;
        });
        
        // Formatação de CNPJ
        this.addFormatter('cnpj', (value) => {
            const cleaned = String(value).replace(/\D/g, '');
            return cleaned.replace(/(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})/, '$1.$2.$3/$4-$5');
        });
        
        // Formatação de CPF
        this.addFormatter('cpf', (value) => {
            const cleaned = String(value).replace(/\D/g, '');
            return cleaned.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, '$1.$2.$3-$4');
        });
        
        // Formatação de números
        this.addFormatter('number', (value, decimals = 2) => {
            return parseFloat(value).toFixed(decimals);
        });
        
        // Formatação de data
        this.addFormatter('date', (value) => {
            const date = new Date(value);
            return date.toLocaleDateString('pt-BR');
        });
        
        // Formatação de data e hora
        this.addFormatter('datetime', (value) => {
            const date = new Date(value);
            return date.toLocaleString('pt-BR');
        });
    }
    
    /**
     * MÉTODOS PÚBLICOS
     */
    addRule(name, validator) {
        this.rules.set(name, validator);
    }
    
    addFormatter(name, formatter) {
        this.formatters.set(name, formatter);
    }
    
    validate(value, type, options = {}) {
        try {
            const rule = this.rules.get(type);
            if (!rule) {
                throw new Error(`Tipo de validação '${type}' não encontrado`);
            }
            
            // Verificar se é obrigatório
            if (options.required && (value === null || value === undefined || String(value).trim() === '')) {
                throw new Error('Campo obrigatório');
            }
            
            // Se não é obrigatório e está vazio, retornar null
            if (!options.required && (value === null || value === undefined || String(value).trim() === '')) {
                return null;
            }
            
            return rule(value, options);
            
        } catch (error) {
            throw error;
        }
    }
    
    format(value, type, ...args) {
        const formatter = this.formatters.get(type);
        if (!formatter) {
            return value;
        }
        return formatter(value, ...args);
    }
    
    /**
     * VALIDAÇÃO EM LOTE
     */
    validateForm(data, schema) {
        const results = {};
        const errors = {};
        
        for (const [field, rules] of Object.entries(schema)) {
            try {
                const value = data[field];
                results[field] = this.validate(value, rules.type, rules.options || {});
            } catch (error) {
                errors[field] = error.message;
            }
        }
        
        return {
            isValid: Object.keys(errors).length === 0,
            data: results,
            errors: errors
        };
    }
    
    /**
     * SANITIZAÇÃO AVANÇADA PARA SEGURANÇA
     */
    sanitizeHTML(html) {
        // Preservar UTF-8 mas remover conteúdo perigoso
        return html
            .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
            .replace(/<iframe\b[^<]*(?:(?!<\/iframe>)<[^<]*)*<\/iframe>/gi, '')
            .replace(/<object\b[^<]*(?:(?!<\/object>)<[^<]*)*<\/object>/gi, '')
            .replace(/<embed\b[^<]*(?:(?!<\/embed>)<[^<]*)*<\/embed>/gi, '')
            .replace(/javascript:/gi, '')
            .replace(/on\w+\s*=/gi, '');
    }
    
    /**
     * VALIDAÇÃO DE ARQUIVOS
     */
    validateFile(file, options = {}) {
        if (!file) {
            throw new Error('Nenhum arquivo selecionado');
        }
        
        // Validar tamanho
        if (options.maxSize && file.size > options.maxSize) {
            throw new Error(`Arquivo muito grande. Máximo: ${this.formatFileSize(options.maxSize)}`);
        }
        
        // Validar tipo
        if (options.allowedTypes && !options.allowedTypes.includes(file.type)) {
            throw new Error(`Tipo de arquivo não permitido. Permitidos: ${options.allowedTypes.join(', ')}`);
        }
        
        // Validar extensão
        if (options.allowedExtensions) {
            const extension = file.name.split('.').pop().toLowerCase();
            if (!options.allowedExtensions.includes(extension)) {
                throw new Error(`Extensão não permitida. Permitidas: ${options.allowedExtensions.join(', ')}`);
            }
        }
        
        return true;
    }
    
    formatFileSize(bytes) {
        if (bytes === 0) return '0 Bytes';
        const k = 1024;
        const sizes = ['Bytes', 'KB', 'MB', 'GB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
    }
}

/**
 * FUNÇÕES DE FORMATAÇÃO AUTOMÁTICA PARA INPUTS
 */
class InputFormatters {
    static formatCurrency(input) {
        let value = input.value.replace(/\D/g, '');
        value = (parseInt(value) / 100).toFixed(2);
        value = value.replace('.', ',');
        value = value.replace(/(\d)(?=(\d{3})+(?!\d))/g, '$1.');
        input.value = 'R$ ' + value;
    }
    
    static formatPhone(input) {
        let value = input.value.replace(/\D/g, '');
        if (value.length <= 11) {
            if (value.length === 11) {
                value = value.replace(/(\d{2})(\d{5})(\d{4})/, '($1) $2-$3');
            } else if (value.length === 10) {
                value = value.replace(/(\d{2})(\d{4})(\d{4})/, '($1) $2-$3');
            }
            input.value = value;
        }
    }
    
    static formatCNPJ(input) {
        let value = input.value.replace(/\D/g, '');
        if (value.length <= 14) {
            value = value.replace(/(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})/, '$1.$2.$3/$4-$5');
            input.value = value;
        }
    }
    
    static formatCPF(input) {
        let value = input.value.replace(/\D/g, '');
        if (value.length <= 11) {
            value = value.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, '$1.$2.$3-$4');
            input.value = value;
        }
    }
    
    static formatDecimal(input, decimals = 2) {
        let value = input.value.replace(/[^\d,.-]/g, '');
        const parts = value.split(/[,.]/);
        if (parts.length > 2) {
            value = parts[0] + '.' + parts.slice(1).join('');
        }
        const num = parseFloat(value.replace(',', '.'));
        if (!isNaN(num)) {
            input.value = num.toFixed(decimals).replace('.', ',');
        }
    }
}

/**
 * UTILITÁRIOS DE VALIDAÇÃO
 */
class ValidationUtils {
    static showFieldError(fieldId, message) {
        const field = document.getElementById(fieldId);
        if (!field) return;
        
        // Remover erro anterior
        const oldError = field.parentElement.querySelector('.validation-error');
        if (oldError) oldError.remove();
        
        // Adicionar classe de erro
        field.classList.add('error');
        
        // Criar elemento de erro
        const errorElement = document.createElement('div');
        errorElement.className = 'validation-error';
        errorElement.style.cssText = 'color: #e74c3c; font-size: 12px; margin-top: 5px;';
        errorElement.textContent = message;
        
        field.parentElement.appendChild(errorElement);
    }
    
    static clearFieldError(fieldId) {
        const field = document.getElementById(fieldId);
        if (!field) return;
        
        field.classList.remove('error');
        const errorElement = field.parentElement.querySelector('.validation-error');
        if (errorElement) errorElement.remove();
    }
    
    static clearAllErrors(containerId = null) {
        const container = containerId ? document.getElementById(containerId) : document;
        const errorElements = container.querySelectorAll('.validation-error');
        const errorFields = container.querySelectorAll('.error');
        
        errorElements.forEach(el => el.remove());
        errorFields.forEach(el => el.classList.remove('error'));
    }
    
    static validateFormFields(formId, schema) {
        const form = document.getElementById(formId);
        if (!form) return { isValid: false, errors: ['Formulário não encontrado'] };
        
        const formData = new FormData(form);
        const data = {};
        
        // Converter FormData para objeto
        for (const [key, value] of formData.entries()) {
            data[key] = value;
        }
        
        // Incluir campos que não estão no FormData
        for (const field of Object.keys(schema)) {
            if (!data.hasOwnProperty(field)) {
                const element = form.querySelector(`[name="${field}"], #${field}`);
                if (element) {
                    data[field] = element.value;
                }
            }
        }
        
        const validation = validator.validateForm(data, schema);
        
        // Limpar erros anteriores
        ValidationUtils.clearAllErrors(formId);
        
        // Mostrar novos erros
        if (!validation.isValid) {
            for (const [field, error] of Object.entries(validation.errors)) {
                ValidationUtils.showFieldError(field, error);
            }
        }
        
        return validation;
    }
}

// Instância global do validador
const validator = new ValidationSystem();

// Exportar para uso global
window.ValidationSystem = ValidationSystem;
window.InputFormatters = InputFormatters;
window.ValidationUtils = ValidationUtils;
window.validator = validator;

console.log('✅ Sistema de Validação Avançado carregado - UTF-8 Seguro'); 