/**
 * Utilitários Globais para SisWeb
 * Este arquivo contém funções comuns utilizadas em várias partes do sistema
 */

// Namespace próprio de fallback local (escopo fechado — NÃO disputa os globais
// window.getData/window.saveData observados por legacy-deprecation.js).
// Em romaneiopct.html o acesso canônico é o getData Firebase-first de
// romaneiopct_funcoes.js; este fallback local existe para uso explícito.
window.LocalStore = window.LocalStore || (function () {
    function canonicalKeyOf(key) {
        return String(key || '')
            .replace(/^data\/species(\/|$)/, 'especies$1')
            .replace(/^species(\/|$)/, 'especies$1')
            .replace(/^especiesPct(\/|$)/, 'especies$1');
    }
    function getData(key) {
        try {
            const data = localStorage.getItem(canonicalKeyOf(key));
            return data ? JSON.parse(data) : null;
        } catch (e) {
            console.error('Erro ao recuperar dados:', e);
            return null;
        }
    }
    function saveData(key, data) {
        try {
            localStorage.setItem(canonicalKeyOf(key), JSON.stringify(data));
            return true;
        } catch (e) {
            console.error('Erro ao salvar dados:', e);
            return false;
        }
    }
    console.log("📁 utils.js: fallback local exposto em window.LocalStore");
    return { getData, saveData };
})();

/**
 * Formata um valor numérico para o formato de moeda brasileiro
 * @param {number} value - Valor a ser formatado
 * @param {number} decimals - Número de casas decimais (padrão: 2)
 * @returns {string} Valor formatado
 */
function formatCurrency(value, decimals = 2) {
    if (isNaN(value)) value = 0;
    return value.toLocaleString('pt-BR', {
        style: 'currency',
        currency: 'BRL',
        minimumFractionDigits: decimals,
        maximumFractionDigits: decimals
    });
}

/**
 * Extrai valor numérico de um texto formatado como moeda
 * @param {string} formattedValue - Texto formatado (ex: "R$ 1.234,56")
 * @returns {number} Valor numérico
 */
function extractNumericValue(formattedValue) {
    if (!formattedValue) return 0;
    
    // Remove R$, pontos e espaços, e substitui vírgula por ponto
    const numericString = formattedValue
        .replace(/[R$\s.]/g, '')  // Remove R$, espaços e pontos
        .replace(',', '.');       // Substitui vírgula por ponto
        
    return parseFloat(numericString) || 0;
}

/**
 * Formata um campo de entrada como moeda em tempo real
 * @param {HTMLInputElement} input - Elemento de entrada
 */
function formatCurrencyInput(input) {
    // Remove tudo que não é dígito
    let value = input.value.replace(/\D/g, '');
    
    // Converte para número e divide por 100 para considerar os centavos
    value = (parseInt(value) / 100).toFixed(2);
    
    // Se não for um número válido, limpa o campo
    if (isNaN(value)) {
        input.value = '';
        return;
    }
    
    // Formata para o padrão brasileiro
    value = value.replace('.', ',');
    value = value.replace(/(\d)(?=(\d{3})+(?!\d))/g, '$1.');
    
    // Adiciona R$ no início
    input.value = 'R$ ' + value;
}

/**
 * Calcula o volume em metros cúbicos
 * @param {number} espessura - Espessura em centímetros
 * @param {number} largura - Largura em centímetros
 * @param {number} comprimento - Comprimento em centímetros
 * @param {number} quantidade - Quantidade de peças
 * @returns {number} Volume em metros cúbicos
 */
if (typeof window.calcularVolume !== 'function') {
    window.calcularVolume = function(comprimento, largura, espessura) {
        // ✅ FÓRMULA CORRIGIDA: Volume individual sem quantidade
        // Divisão por 1.000.000 converte de cm³ para m³
        const comp = parseFloat(comprimento) || 0;
        const larg = parseFloat(largura) || 0;
        const esp = parseFloat(espessura) || 0;
        
        return (comp * larg * esp) / 1000000;
    };
    
    console.log("✅ calcularVolume criada no utils.js e exposta globalmente");
} else {
    console.log("✅ calcularVolume já existe - reutilizando no utils.js");
}

/**
 * Aplica debounce em uma função para evitar múltiplas chamadas
 * @param {Function} func - Função a ser executada
 * @param {number} wait - Tempo de espera em milissegundos
 * @returns {Function} Função com debounce aplicado
 */
function debounce(func, wait = 100) {
    let timeout;
    return function(...args) {
        clearTimeout(timeout);
        timeout = setTimeout(() => func.apply(this, args), wait);
    };
}

/**
 * Adiciona evento que fecha um modal quando clicado fora
 * @param {HTMLElement} modal - Elemento do modal
 */
function setupModalOutsideClick(modal) {
    window.addEventListener('click', function(event) {
        if (event.target === modal) {
            modal.style.display = 'none';
        }
    });
}

/**
 * Verifica e limpa o localStorage se estiver quase cheio
 * @returns {object} Informações sobre o espaço utilizado
 */
function checkStorageSpace() {
    let total = 0;
    try {
        for (let key in localStorage) {
            if (localStorage.hasOwnProperty(key)) {
                total += (localStorage[key].length * 2) / 1024 / 1024; // MB
            }
        }
    } catch (e) {
        console.error('Erro ao verificar espaço:', e);
    }
    
    const spaceInfo = {
        used: total.toFixed(2),
        percentage: (total / 5 * 100).toFixed(2) // Assumindo limite de 5MB
    };
    
    // Se estiver acima de 80%, avisar
    if (spaceInfo.percentage > 80) {
        console.warn(`Armazenamento local com ${spaceInfo.percentage}% de uso (${spaceInfo.used}MB).`);
    }
    
    return spaceInfo;
}

// Exporta as funções para uso global
if (typeof window.formatCurrency !== 'function') { window.formatCurrency = formatCurrency; }
if (typeof window.extractNumericValue !== 'function') { window.extractNumericValue = extractNumericValue; }
if (typeof window.formatCurrencyInput !== 'function') { window.formatCurrencyInput = formatCurrencyInput; }
window.debounce = debounce;
window.setupModalOutsideClick = setupModalOutsideClick;
window.checkStorageSpace = checkStorageSpace;
// getData/saveData locais vivem em window.LocalStore (sem disputar os globais legados)
