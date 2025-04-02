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
