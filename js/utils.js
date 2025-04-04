/**
 * Utilitários diversos para a aplicação SisWeb
 */

/**
 * Gera um ID único
 * @returns {string} ID único
 */
function generateUUID() {
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
        const r = Math.random() * 16 | 0;
        const v = c === 'x' ? r : (r & 0x3 | 0x8);
        return v.toString(16);
    });
}

/**
 * Formata uma data para exibição
 * @param {string|Date} date - Data a ser formatada
 * @param {string} format - Formato desejado (default: 'dd/MM/yyyy')
 * @returns {string} Data formatada
 */
function formatDate(date, format = 'dd/MM/yyyy') {
    if (!date) return '';
    
    const d = new Date(date);
    if (isNaN(d.getTime())) return '';
    
    const day = d.getDate().toString().padStart(2, '0');
    const month = (d.getMonth() + 1).toString().padStart(2, '0');
    const year = d.getFullYear();
    const hours = d.getHours().toString().padStart(2, '0');
    const minutes = d.getMinutes().toString().padStart(2, '0');
    const seconds = d.getSeconds().toString().padStart(2, '0');
    
    return format
        .replace('dd', day)
        .replace('MM', month)
        .replace('yyyy', year)
        .replace('HH', hours)
        .replace('mm', minutes)
        .replace('ss', seconds);
}

/**
 * Converte uma string para formato de URL amigável (slug)
 * @param {string} text - Texto a ser convertido
 * @returns {string} Slug
 */
function slugify(text) {
    return text
        .toString()
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .toLowerCase()
        .trim()
        .replace(/\s+/g, '-')
        .replace(/[^\w-]+/g, '')
        .replace(/--+/g, '-');
}

/**
 * Trunca um texto para determinado comprimento
 * @param {string} text - Texto a ser truncado
 * @param {number} length - Comprimento máximo
 * @param {string} suffix - Sufixo a ser adicionado (default: '...')
 * @returns {string} Texto truncado
 */
function truncateText(text, length, suffix = '...') {
    if (!text || text.length <= length) {
        return text;
    }
    return text.substring(0, length - suffix.length) + suffix;
}

/**
 * Valida um CNPJ
 * @param {string} cnpj - CNPJ a ser validado
 * @returns {boolean} true se válido
 */
function validarCNPJ(cnpj) {
    cnpj = cnpj.replace(/[^\d]/g, '');
    
    if (cnpj.length !== 14) return false;
    
    // Elimina CNPJs inválidos conhecidos
    if (/^(\d)\1+$/.test(cnpj)) return false;
    
    // Validação do primeiro dígito verificador
    let tamanho = cnpj.length - 2;
    let numeros = cnpj.substring(0, tamanho);
    const digitos = cnpj.substring(tamanho);
    let soma = 0;
    let pos = tamanho - 7;
    
    for (let i = tamanho; i >= 1; i--) {
        soma += numeros.charAt(tamanho - i) * pos--;
        if (pos < 2) pos = 9;
    }
    
    let resultado = soma % 11 < 2 ? 0 : 11 - soma % 11;
    if (resultado !== parseInt(digitos.charAt(0))) return false;
    
    // Validação do segundo dígito verificador
    tamanho++;
    numeros = cnpj.substring(0, tamanho);
    soma = 0;
    pos = tamanho - 7;
    
    for (let i = tamanho; i >= 1; i--) {
        soma += numeros.charAt(tamanho - i) * pos--;
        if (pos < 2) pos = 9;
    }
    
    resultado = soma % 11 < 2 ? 0 : 11 - soma % 11;
    if (resultado !== parseInt(digitos.charAt(1))) return false;
    
    return true;
}

/**
 * Valida um CPF
 * @param {string} cpf - CPF a ser validado
 * @returns {boolean} true se válido
 */
function validarCPF(cpf) {
    cpf = cpf.replace(/[^\d]/g, '');
    
    if (cpf.length !== 11) return false;
    
    // Elimina CPFs inválidos conhecidos
    if (/^(\d)\1+$/.test(cpf)) return false;
    
    // Validação do primeiro dígito verificador
    let soma = 0;
    for (let i = 0; i < 9; i++) {
        soma += parseInt(cpf.charAt(i)) * (10 - i);
    }
    let resto = 11 - (soma % 11);
    let dv1 = resto > 9 ? 0 : resto;
    
    if (dv1 !== parseInt(cpf.charAt(9))) return false;
    
    // Validação do segundo dígito verificador
    soma = 0;
    for (let i = 0; i < 10; i++) {
        soma += parseInt(cpf.charAt(i)) * (11 - i);
    }
    resto = 11 - (soma % 11);
    let dv2 = resto > 9 ? 0 : resto;
    
    if (dv2 !== parseInt(cpf.charAt(10))) return false;
    
    return true;
}

/**
 * Formata um CNPJ
 * @param {string} cnpj - CNPJ a ser formatado
 * @returns {string} CNPJ formatado
 */
function formatarCNPJ(cnpj) {
    cnpj = cnpj.replace(/[^\d]/g, '');
    
    if (cnpj.length !== 14) return cnpj;
    
    return cnpj.replace(/(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})/, '$1.$2.$3/$4-$5');
}

/**
 * Formata um CPF
 * @param {string} cpf - CPF a ser formatado
 * @returns {string} CPF formatado
 */
function formatarCPF(cpf) {
    cpf = cpf.replace(/[^\d]/g, '');
    
    if (cpf.length !== 11) return cpf;
    
    return cpf.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, '$1.$2.$3-$4');
}

/**
 * Formata um número de telefone
 * @param {string} telefone - Telefone a ser formatado
 * @returns {string} Telefone formatado
 */
function formatarTelefone(telefone) {
    telefone = telefone.replace(/[^\d]/g, '');
    
    if (telefone.length === 11) {
        return telefone.replace(/(\d{2})(\d{1})(\d{4})(\d{4})/, '($1) $2 $3-$4');
    } else if (telefone.length === 10) {
        return telefone.replace(/(\d{2})(\d{4})(\d{4})/, '($1) $2-$3');
    }
    
    return telefone;
}

/**
 * Valida um email
 * @param {string} email - Email a ser validado
 * @returns {boolean} true se válido
 */
function validarEmail(email) {
    const re = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;
    return re.test(email);
}

/**
 * Converte uma string para número
 * @param {string} valor - String a ser convertida
 * @param {number} padrao - Valor padrão se conversão falhar
 * @returns {number} Número convertido ou valor padrão
 */
function converterParaNumero(valor, padrao = 0) {
    if (typeof valor === 'number') return valor;
    
    if (typeof valor === 'string') {
        // Remover caracteres não numéricos, exceto ponto e vírgula
        valor = valor.replace(/[^\d.,]/g, '');
        
        // Substituir vírgula por ponto
        valor = valor.replace(',', '.');
        
        const numero = parseFloat(valor);
        return isNaN(numero) ? padrao : numero;
    }
    
    return padrao;
}

/**
 * Valida campos obrigatórios de um formulário
 * @param {Object} form - Objeto do formulário
 * @param {Array} requiredFields - Array com nomes dos campos obrigatórios
 * @returns {boolean} true se todos campos obrigatórios estão preenchidos
 */
function validarCamposObrigatorios(form, requiredFields) {
    for (const field of requiredFields) {
        if (!form[field] || form[field].trim() === '') {
            return false;
        }
    }
    return true;
}

/**
 * Debounce para evitar múltiplas chamadas de função
 * @param {Function} func - Função a ser executada
 * @param {number} wait - Tempo de espera em ms
 * @returns {Function} Função com debounce
 */
function debounce(func, wait) {
    let timeout;
    return function(...args) {
        const context = this;
        clearTimeout(timeout);
        timeout = setTimeout(() => func.apply(context, args), wait);
    };
}

/**
 * Funções utilitárias do SisWeb
 * Contém validadores, formatadores e outras funções de uso geral
 */

/**
 * Validação de strings
 * @param {string} value - Valor a ser validado
 * @param {number} [minLength=1] - Comprimento mínimo
 * @param {number} [maxLength=Infinity] - Comprimento máximo
 * @returns {boolean} Se o valor é válido
 */
function isValidString(value, minLength = 1, maxLength = Infinity) {
    if (typeof value !== 'string') return false;
    const length = value.trim().length;
    return length >= minLength && length <= maxLength;
}

/**
 * Validação de números
 * @param {any} value - Valor a ser validado
 * @param {number} [min=-Infinity] - Valor mínimo
 * @param {number} [max=Infinity] - Valor máximo
 * @returns {boolean} Se o valor é válido
 */
function isValidNumber(value, min = -Infinity, max = Infinity) {
    if (value === null || value === undefined || value === '') return false;
    
    const num = Number(value);
    return !isNaN(num) && isFinite(num) && num >= min && num <= max;
}

/**
 * Validação de e-mail
 * @param {string} email - E-mail a ser validado
 * @returns {boolean} Se o e-mail é válido
 */
function isValidEmail(email) {
    if (!email || typeof email !== 'string') return false;
    
    // Expressão regular para validar e-mail
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
}

/**
 * Validação de CPF
 * @param {string} cpf - CPF a ser validado
 * @returns {boolean} Se o CPF é válido
 */
function isValidCPF(cpf) {
    if (!cpf || typeof cpf !== 'string') return false;
    
    // Remover caracteres não numéricos
    cpf = cpf.replace(/[^\d]/g, '');
    
    // Verificar se tem 11 dígitos
    if (cpf.length !== 11) return false;
    
    // Verificar se todos os dígitos são iguais
    if (/^(\d)\1+$/.test(cpf)) return false;
    
    // Validar dígitos verificadores
    let sum = 0;
    let remainder;
    
    // Primeiro dígito verificador
    for (let i = 1; i <= 9; i++) {
        sum += parseInt(cpf.substring(i - 1, i)) * (11 - i);
    }
    
    remainder = (sum * 10) % 11;
    if (remainder === 10 || remainder === 11) remainder = 0;
    if (remainder !== parseInt(cpf.substring(9, 10))) return false;
    
    // Segundo dígito verificador
    sum = 0;
    for (let i = 1; i <= 10; i++) {
        sum += parseInt(cpf.substring(i - 1, i)) * (12 - i);
    }
    
    remainder = (sum * 10) % 11;
    if (remainder === 10 || remainder === 11) remainder = 0;
    if (remainder !== parseInt(cpf.substring(10, 11))) return false;
    
    return true;
}

/**
 * Validação de CNPJ
 * @param {string} cnpj - CNPJ a ser validado
 * @returns {boolean} Se o CNPJ é válido
 */
function isValidCNPJ(cnpj) {
    if (!cnpj || typeof cnpj !== 'string') return false;
    
    // Remover caracteres não numéricos
    cnpj = cnpj.replace(/[^\d]/g, '');
    
    // Verificar se tem 14 dígitos
    if (cnpj.length !== 14) return false;
    
    // Verificar se todos os dígitos são iguais
    if (/^(\d)\1+$/.test(cnpj)) return false;
    
    // Validar dígitos verificadores
    let tamanho = cnpj.length - 2;
    let numeros = cnpj.substring(0, tamanho);
    const digitos = cnpj.substring(tamanho);
    let soma = 0;
    let pos = tamanho - 7;
    
    // Primeiro dígito verificador
    for (let i = tamanho; i >= 1; i--) {
        soma += numeros.charAt(tamanho - i) * pos--;
        if (pos < 2) pos = 9;
    }
    
    let resultado = soma % 11 < 2 ? 0 : 11 - soma % 11;
    if (resultado !== parseInt(digitos.charAt(0))) return false;
    
    // Segundo dígito verificador
    tamanho = tamanho + 1;
    numeros = cnpj.substring(0, tamanho);
    soma = 0;
    pos = tamanho - 7;
    
    for (let i = tamanho; i >= 1; i--) {
        soma += numeros.charAt(tamanho - i) * pos--;
        if (pos < 2) pos = 9;
    }
    
    resultado = soma % 11 < 2 ? 0 : 11 - soma % 11;
    if (resultado !== parseInt(digitos.charAt(1))) return false;
    
    return true;
}

/**
 * Validação de telefone
 * @param {string} phone - Telefone a ser validado
 * @returns {boolean} Se o telefone é válido
 */
function isValidPhone(phone) {
    if (!phone || typeof phone !== 'string') return false;
    
    // Remover caracteres não numéricos
    phone = phone.replace(/[^\d]/g, '');
    
    // Verificar se tem entre 10 e 11 dígitos (com ou sem DDD)
    return phone.length >= 10 && phone.length <= 11;
}

/**
 * Validação de CEP
 * @param {string} cep - CEP a ser validado
 * @returns {boolean} Se o CEP é válido
 */
function isValidCEP(cep) {
    if (!cep || typeof cep !== 'string') return false;
    
    // Remover caracteres não numéricos
    cep = cep.replace(/[^\d]/g, '');
    
    // Verificar se tem 8 dígitos
    return cep.length === 8;
}

/**
 * Formata um número para exibição
 * @param {number} value - Valor a ser formatado
 * @param {number} [decimals=2] - Número de casas decimais
 * @param {string} [decimalSeparator=','] - Separador decimal
 * @param {string} [thousandsSeparator='.'] - Separador de milhar
 * @returns {string} Valor formatado
 */
function formatNumber(value, decimals = 2, decimalSeparator = ',', thousandsSeparator = '.') {
    if (!isValidNumber(value)) return '0' + decimalSeparator + '0'.repeat(decimals);
    
    // Formatar o número com casas decimais e separadores
    return Number(value).toLocaleString('pt-BR', {
        minimumFractionDigits: decimals,
        maximumFractionDigits: decimals
    });
}

/**
 * Formata um valor monetário
 * @param {number} value - Valor a ser formatado
 * @param {string} [currency='R$'] - Símbolo da moeda
 * @returns {string} Valor formatado
 */
function formatCurrency(value, currency = 'R$') {
    if (!isValidNumber(value)) return currency + ' 0,00';
    
    return currency + ' ' + formatNumber(value, 2);
}

/**
 * Formata um número de telefone
 * @param {string} phone - Telefone a ser formatado
 * @returns {string} Telefone formatado
 */
function formatPhone(phone) {
    if (!phone) return '';
    
    // Remover caracteres não numéricos
    phone = phone.replace(/[^\d]/g, '');
    
    // Formatar de acordo com o comprimento
    if (phone.length === 11) {
        // Celular com DDD: (99) 99999-9999
        return `(${phone.substring(0, 2)}) ${phone.substring(2, 7)}-${phone.substring(7)}`;
    } else if (phone.length === 10) {
        // Fixo com DDD: (99) 9999-9999
        return `(${phone.substring(0, 2)}) ${phone.substring(2, 6)}-${phone.substring(6)}`;
    } else {
        // Retornar sem formatação se não se encaixar nos padrões
        return phone;
    }
}

/**
 * Formata um CPF
 * @param {string} cpf - CPF a ser formatado
 * @returns {string} CPF formatado
 */
function formatCPF(cpf) {
    if (!cpf) return '';
    
    // Remover caracteres não numéricos
    cpf = cpf.replace(/[^\d]/g, '');
    
    // Formatar: 999.999.999-99
    if (cpf.length === 11) {
        return `${cpf.substring(0, 3)}.${cpf.substring(3, 6)}.${cpf.substring(6, 9)}-${cpf.substring(9)}`;
    } else {
        return cpf;
    }
}

/**
 * Formata um CNPJ
 * @param {string} cnpj - CNPJ a ser formatado
 * @returns {string} CNPJ formatado
 */
function formatCNPJ(cnpj) {
    if (!cnpj) return '';
    
    // Remover caracteres não numéricos
    cnpj = cnpj.replace(/[^\d]/g, '');
    
    // Formatar: 99.999.999/9999-99
    if (cnpj.length === 14) {
        return `${cnpj.substring(0, 2)}.${cnpj.substring(2, 5)}.${cnpj.substring(5, 8)}/${cnpj.substring(8, 12)}-${cnpj.substring(12)}`;
    } else {
        return cnpj;
    }
}

/**
 * Formata um CEP
 * @param {string} cep - CEP a ser formatado
 * @returns {string} CEP formatado
 */
function formatCEP(cep) {
    if (!cep) return '';
    
    // Remover caracteres não numéricos
    cep = cep.replace(/[^\d]/g, '');
    
    // Formatar: 99999-999
    if (cep.length === 8) {
        return `${cep.substring(0, 5)}-${cep.substring(5)}`;
    } else {
        return cep;
    }
}

/**
 * Formata uma data para exibição
 * @param {Date|string} date - Data a ser formatada
 * @param {string} [format='DD/MM/YYYY'] - Formato da data
 * @returns {string} Data formatada
 */
function formatDate(date, format = 'DD/MM/YYYY') {
    if (!date) return '';
    
    const d = date instanceof Date ? date : new Date(date);
    
    if (isNaN(d.getTime())) return '';
    
    const day = d.getDate().toString().padStart(2, '0');
    const month = (d.getMonth() + 1).toString().padStart(2, '0');
    const year = d.getFullYear();
    const hours = d.getHours().toString().padStart(2, '0');
    const minutes = d.getMinutes().toString().padStart(2, '0');
    const seconds = d.getSeconds().toString().padStart(2, '0');
    
    return format
        .replace('DD', day)
        .replace('MM', month)
        .replace('YYYY', year)
        .replace('HH', hours)
        .replace('mm', minutes)
        .replace('ss', seconds);
}

/**
 * Trunca um texto se for maior que o tamanho especificado
 * @param {string} text - Texto a ser truncado
 * @param {number} [maxLength=100] - Tamanho máximo
 * @param {string} [suffix='...'] - Sufixo a ser adicionado
 * @returns {string} Texto truncado
 */
function truncateText(text, maxLength = 100, suffix = '...') {
    if (!text) return '';
    
    if (text.length <= maxLength) return text;
    
    return text.substring(0, maxLength - suffix.length) + suffix;
}

/**
 * Gera um ID único
 * @returns {string} ID gerado
 */
function generateId() {
    return Date.now().toString(36) + Math.random().toString(36).substring(2);
}

// Exportar todas as funções
export {
    isValidString,
    isValidNumber,
    isValidEmail,
    isValidCPF,
    isValidCNPJ,
    isValidPhone,
    isValidCEP,
    formatNumber,
    formatCurrency,
    formatPhone,
    formatCPF,
    formatCNPJ,
    formatCEP,
    formatDate,
    truncateText,
    generateId
};
