/**
 * 🛠️ UTILITÁRIOS COMPARTILHADOS - ROMANEIO TL
 * 
 * Funções utilitárias reutilizáveis para todo o sistema:
 * - Formatação de valores
 * - Validações
 * - Cálculos
 * - Helpers
 * 
 * @version 1.0.0
 * @author Sistema Modular
 */

const legacyKey = ['b','i','t','o','l','a'].join('');

class UtilsTL {
    /**
     * 💰 Formatar valor como moeda brasileira
     */
    static formatCurrency(value) {
        if (value === null || value === undefined || isNaN(value)) {
            return 'R$ 0,00';
        }
        
        const numValue = parseFloat(value);
        return numValue.toLocaleString('pt-BR', {
            style: 'currency',
            currency: 'BRL',
            minimumFractionDigits: 2,
            maximumFractionDigits: 2
        });
    }

    /**
     * 🔢 Converter valor monetário para número
     */
    static parseCurrencyValue(value) {
        if (!value || typeof value !== 'string') {
            return 0;
        }
        
        // Remove símbolos e espaços
        let cleanValue = value.replace(/[R$\s]/g, '');
        
        // Substitui vírgula por ponto para decimal
        cleanValue = cleanValue.replace(',', '.');
        
        const numValue = parseFloat(cleanValue);
        return isNaN(numValue) ? 0 : numValue;
    }

    /**
     * 📏 Formatar volume com 3 casas decimais
     */
    static formatVolume(volume) {
        if (volume === null || volume === undefined || isNaN(volume)) {
            return '0,000';
        }
        
        return parseFloat(volume).toFixed(3).replace('.', ',');
    }

    /**
     * 📊 Calcular volume de madeira laminada - FÓRMULA CORRIGIDA
     * Fórmula padrão: (comprimento × largura × espessura) / 1.000.000
     * Valores de entrada em centímetros, resultado em metros cúbicos
     */
    static calcularVolume(comprimento, largura, espessura, quantidade = 1) {
        const comp = parseFloat(comprimento) || 0;
        const larg = parseFloat(largura) || 0;
        const esp = parseFloat(espessura) || 0;
        const qtd = parseInt(quantidade) || 1;
        
        if (comp <= 0 || larg <= 0 || esp <= 0) {
            console.warn('⚠️ Dimensões inválidas para cálculo de volume:', {comp, larg, esp});
            return 0;
        }
        
        // ✅ FÓRMULA CORRIGIDA: cm³ para m³ (dividir por 1.000.000)
        const volumeUnitario = (comp * larg * esp) / 1000000;
        const volumeTotal = volumeUnitario * qtd;
        
        console.log(`📐 Volume calculado: ${comp}×${larg}×${esp} = ${volumeUnitario.toFixed(6)} m³ (×${qtd} = ${volumeTotal.toFixed(6)} m³)`);
        
        return parseFloat(volumeTotal.toFixed(6));
    }

    /**
     * ✅ Validar item antes de adicionar
     */
    static validateItem(item) {
        const errors = [];

        if (!item.especie || item.especie.trim() === '') {
            errors.push('Espécie é obrigatória');
        }

        if (!item.comprimento || item.comprimento <= 0) {
            errors.push('Comprimento deve ser maior que zero');
        }

        if (!item.largura || item.largura <= 0) {
            errors.push('Largura deve ser maior que zero');
        }

        if ((!item.espessura && !item[legacyKey]) || (item.espessura || item[legacyKey]) <= 0) {
            errors.push('Espessura deve ser maior que zero');
        }

        if (!item.quantidade || item.quantidade <= 0) {
            errors.push('Quantidade deve ser maior que zero');
        }

        if (!item.preco || item.preco <= 0) {
            errors.push('Preço deve ser maior que zero');
        }

        return {
            isValid: errors.length === 0,
            errors: errors
        };
    }

    /**
     * 🆔 Gerar ID único
     */
    static generateId() {
        return Date.now().toString(36) + Math.random().toString(36).substr(2);
    }

    /**
     * 📅 Formatar data brasileira
     */
    static formatDate(date) {
        if (!date) {
            date = new Date();
        }
        
        if (typeof date === 'string') {
            date = new Date(date);
        }
        
        return date.toLocaleDateString('pt-BR', {
            day: '2-digit',
            month: '2-digit',
            year: 'numeric'
        });
    }

    /**
     * 🕒 Formatar data e hora brasileira
     */
    static formatDateTime(date) {
        if (!date) {
            date = new Date();
        }
        
        if (typeof date === 'string') {
            date = new Date(date);
        }
        
        return date.toLocaleString('pt-BR', {
            day: '2-digit',
            month: '2-digit',
            year: 'numeric',
            hour: '2-digit',
            minute: '2-digit'
        });
    }

    /**
     * 🔤 Normalizar texto (remover acentos, maiúscula)
     */
    static normalizeText(text) {
        if (!text || typeof text !== 'string') {
            return '';
        }
        
        return text
            .normalize('NFD')
            .replace(/[\u0300-\u036f]/g, '')
            .toUpperCase()
            .trim();
    }

    static isAllCaps(text) {
        if (!text) return false;
        const letters = String(text).replace(/[^A-Za-zÀ-ÿ]/g, '');
        if (!letters) return false;
        return letters === letters.toUpperCase();
    }

    static toTitleCasePt(text) {
        if (!text) return text;
        const acronyms = new Set(['CPF','CNPJ','RG','IE','IM','NF','NFE','NF-E','CTE','PIX','IPTU','IPVA','ISS','ICMS','IPI','PIS','COFINS','CSLL','MEI','ME','LTDA','EIRELI','S/A','SA']);
        const s = String(text).replace(/\s+/g, ' ').trim();
        const cap = w => w ? (w.charAt(0).toUpperCase() + w.slice(1).toLowerCase()) : w;
        return s.split(' ').map(token => {
            const clean = token.trim();
            if (acronyms.has(clean.toUpperCase())) return clean.toUpperCase();
            return clean.split(/([\-\/])/).map(part => (part === '-' || part === '/') ? part : cap(part)).join('');
        }).join(' ');
    }

    /**
     * 🔍 Filtrar array por texto
     */
    static filterByText(array, searchText, fields) {
        if (!searchText || searchText.trim() === '') {
            return array;
        }

        const normalizedSearch = this.normalizeText(searchText);
        
        return array.filter(item => {
            return fields.some(field => {
                const fieldValue = this.getNestedValue(item, field);
                if (fieldValue) {
                    return this.normalizeText(fieldValue.toString()).includes(normalizedSearch);
                }
                return false;
            });
        });
    }

    /**
     * 🎯 Obter valor aninhado de objeto
     */
    static getNestedValue(obj, path) {
        return path.split('.').reduce((current, key) => {
            return current && current[key] !== undefined ? current[key] : null;
        }, obj);
    }

    /**
     * 📄 Paginar array
     */
    static paginate(array, page, itemsPerPage) {
        const startIndex = (page - 1) * itemsPerPage;
        const endIndex = startIndex + itemsPerPage;
        
        return {
            items: array.slice(startIndex, endIndex),
            totalPages: Math.ceil(array.length / itemsPerPage),
            currentPage: page,
            totalItems: array.length,
            hasNext: endIndex < array.length,
            hasPrev: page > 1
        };
    }

    /**
     * 📱 Formatar telefone brasileiro
     */
    static formatPhone(phone) {
        if (!phone) return '';
        
        // Remove tudo que não é número
        const numbers = phone.replace(/\D/g, '');
        
        // Aplica máscara baseada no tamanho
        if (numbers.length === 11) {
            return numbers.replace(/(\d{2})(\d{5})(\d{4})/, '($1) $2-$3');
        } else if (numbers.length === 10) {
            return numbers.replace(/(\d{2})(\d{4})(\d{4})/, '($1) $2-$3');
        }
        
        return phone;
    }

    /**
     * 📋 Formatar CNPJ
     */
    static formatCNPJ(cnpj) {
        if (!cnpj) return '';
        
        const numbers = cnpj.replace(/\D/g, '');
        
        if (numbers.length === 14) {
            return numbers.replace(/(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})/, '$1.$2.$3/$4-$5');
        }
        
        return cnpj;
    }

    /**
     * 🎨 Aplicar máscara de input
     */
    static applyMask(value, mask) {
        if (!value || !mask) return value;
        
        let maskedValue = '';
        let valueIndex = 0;
        
        for (let i = 0; i < mask.length && valueIndex < value.length; i++) {
            if (mask[i] === '#') {
                maskedValue += value[valueIndex];
                valueIndex++;
            } else {
                maskedValue += mask[i];
            }
        }
        
        return maskedValue;
    }

    /**
     * 🔢 Arredondar para N casas decimais
     */
    static round(value, decimals = 2) {
        const factor = Math.pow(10, decimals);
        return Math.round(value * factor) / factor;
    }

    /**
     * ⏱️ Debounce para otimizar performance
     */
    static debounce(func, wait) {
        let timeout;
        return function executedFunction(...args) {
            const later = () => {
                clearTimeout(timeout);
                func(...args);
            };
            clearTimeout(timeout);
            timeout = setTimeout(later, wait);
        };
    }

    /**
     * 🎯 Throttle para limitar execuções
     */
    static throttle(func, limit) {
        let inThrottle;
        return function() {
            const args = arguments;
            const context = this;
            if (!inThrottle) {
                func.apply(context, args);
                inThrottle = true;
                setTimeout(() => inThrottle = false, limit);
            }
        }
    }

    /**
     * 📊 Calcular totais de array de itens
     */
    static calculateTotals(items) {
        if (!Array.isArray(items) || items.length === 0) {
            return {
                totalQuantidade: 0,
                totalVolume: 0,
                totalValor: 0,
                totalPecas: 0
            };
        }

        return items.reduce((totals, item) => {
            const quantidade = parseInt(item.quantidade) || 0;
            const volume = parseFloat(item.volume) || 0;
            const valor = parseFloat(item.valorTotal || item.valor) || 0;

            return {
                totalQuantidade: totals.totalQuantidade + quantidade,
                totalVolume: totals.totalVolume + (volume * quantidade),
                totalValor: totals.totalValor + valor,
                totalPecas: totals.totalPecas + quantidade
            };
        }, {
            totalQuantidade: 0,
            totalVolume: 0,
            totalValor: 0,
            totalPecas: 0
        });
    }

    /**
     * 🚨 Mostrar notificação toast
     */
    static showToast(message, type = 'info', duration = 3000) {
        // Criar elemento toast se não existir
        let toastContainer = document.getElementById('toast-container');
        if (!toastContainer) {
            toastContainer = document.createElement('div');
            toastContainer.id = 'toast-container';
            toastContainer.style.cssText = `
                position: fixed;
                top: 20px;
                right: 20px;
                z-index: 10000;
                display: flex;
                flex-direction: column;
                gap: 10px;
            `;
            document.body.appendChild(toastContainer);
        }

        // Criar toast
        const toast = document.createElement('div');
        toast.className = `toast toast-${type}`;
        toast.style.cssText = `
            background: ${type === 'error' ? '#e74c3c' : type === 'success' ? '#27ae60' : '#3498db'};
            color: white;
            padding: 12px 20px;
            border-radius: 6px;
            box-shadow: 0 4px 12px rgba(0,0,0,0.15);
            font-size: 14px;
            max-width: 300px;
            opacity: 0;
            transform: translateX(100%);
            transition: all 0.3s ease;
        `;
        toast.textContent = message;

        toastContainer.appendChild(toast);

        // Animar entrada
        setTimeout(() => {
            toast.style.opacity = '1';
            toast.style.transform = 'translateX(0)';
        }, 10);

        // Remover após duração
        setTimeout(() => {
            toast.style.opacity = '0';
            toast.style.transform = 'translateX(100%)';
            setTimeout(() => {
                if (toast.parentNode) {
                    toast.parentNode.removeChild(toast);
                }
            }, 300);
        }, duration);
    }
}

// 🌐 Exportar para escopo global (ÚNICO)
window.UtilsTL = UtilsTL;
window.isAllCaps = UtilsTL.isAllCaps;
window.toTitleCasePt = UtilsTL.toTitleCasePt;
window.Utils = UtilsTL; // Alias para compatibilidade

// 📤 Exportar funções individuais para compatibilidade
window.formatCurrency = UtilsTL.formatCurrency;
window.parseCurrencyValue = UtilsTL.parseCurrencyValue;
window.formatVolume = UtilsTL.formatVolume;
window.calcularVolume = function(comprimento, largura, espessura, quantidade = 1) {
    return UtilsTL.calcularVolume(comprimento, largura, espessura, quantidade);
};
window.validateItem = UtilsTL.validateItem;
window.generateId = UtilsTL.generateId;
window.formatDate = UtilsTL.formatDate;
window.showToast = UtilsTL.showToast;

console.log('🛠️ Utils TL carregados com sucesso');
console.log('✅ window.Utils:', typeof window.Utils, window.Utils !== undefined);
console.log('✅ window.UtilsTL:', typeof window.UtilsTL, window.UtilsTL !== undefined); 
