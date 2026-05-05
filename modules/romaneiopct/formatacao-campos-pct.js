/**
 * 🎯 FORMATAÇÃO DE CAMPOS ESPECÍFICOS PCT
 * Correção do conflito type="number" vs formatação JavaScript
 * 
 * Baseado no padrão modular do romaneiotl
 */

window.FormatacaoCamposPCT = (function() {
    'use strict';

    // ✅ CONFIGURAÇÕES
    const CONFIG = {
        campos: {
            espessura: 'espessura',
            largura: 'largura',
            comprimento: 'comprimento',
            quantidade: 'quantidade',
            pecasPorPacote: 'pecasPorPacote',
            price: 'price'
        }
    };

    /**
     * ✅ FORMATAR CAMPO NUMÉRICO DECIMAL
     */
    function formatarCampoDecimal(input, decimais = 2) {
        if (!input) return;

        let value = input.value.trim();
        
        // ✅ CORREÇÃO: Se campo está vazio, não fazer nada
        if (value === '') return;
        
        // Remover caracteres não numéricos (exceto vírgula e ponto)
        value = value.replace(/[^0-9,\.]/g, '');
        
        // ✅ CORREÇÃO: Se após limpeza ficou vazio, manter vazio
        if (value === '') {
            input.value = '';
            return;
        }
        
        // Substituir vírgula por ponto para cálculos
        value = value.replace(',', '.');
        
        // Verificar se é um número válido
        const numericValue = parseFloat(value);
        
        if (!isNaN(numericValue) && numericValue >= 0) {
            // ✅ CORREÇÃO CRÍTICA: Respeitar decimais específicos por campo
            const currentFormatted = numericValue.toFixed(decimais);
            const currentWithComma = currentFormatted.replace('.', ',');
            
            // ✅ CORREÇÃO: Evitar loop infinito - só atualizar se valor mudou
            if (input.value !== currentWithComma) {
                // ✅ CORREÇÃO CRÍTICA: Temporariamente desabilitar event listeners para evitar loops
                const originalInput = input.oninput;
                input.oninput = null;
                input.value = currentWithComma;
                setTimeout(() => { input.oninput = originalInput; }, 0);
            }
        } else if (value === '0') {
            input.value = '0';
        }
    }

    /**
     * ✅ CONFIGURAR FORMATAÇÃO AUTOMÁTICA DOS CAMPOS NUMÉRICOS
     */
    function configurarFormatacaoNumerica() {
        console.log('🔧 Configurando formatação numérica PCT...');

        // ✅ CAMPOS DECIMAIS: Remover comprimento para evitar conflito com type="text"
        const camposDecimais = [
            { id: CONFIG.campos.espessura, decimais: 2 },
            { id: CONFIG.campos.largura, decimais: 2 }
            // comprimento removido - será tratado pelo romaneiopct-main.js
        ];
        
        // ✅ LARGURA: Agora incluída nos campos decimais normais

        camposDecimais.forEach(({ id, decimais }) => {
            const input = document.getElementById(id);
            if (input) {
                // ✅ CORREÇÃO CRÍTICA: NÃO CLONAR ELEMENTO para preservar navegação Enter
                // Apenas remover listeners de formatação se existirem
                if (input._formatacaoConfigured) {
                    console.log(`⚠️ Formatação já configurada para ${id}, pulando...`);
                    return;
                }
                
                // ✅ CORREÇÃO: Configurar formatação sem interferir na navegação
                input.addEventListener('input', function(e) {
                    // ✅ CRÍTICO: Evitar conflito com navegação Enter
                    // Usar setTimeout para não interferir com outros event listeners
                    setTimeout(() => {
                        let value = e.target.value;
                        if (value && !/^[\d,\.]*$/.test(value)) {
                            // Remove apenas caracteres inválidos, mantém o que foi digitado
                            e.target.value = value.replace(/[^0-9,\.]/g, '');
                        }
                    }, 0);
                });
                
                input.addEventListener('blur', function() {
                    // ✅ CORREÇÃO: Formatar apenas no blur para não interferir na digitação
                    clearTimeout(this.formatTimer);
                    formatarCampoDecimal(this, decimais);
                });
                
                // Marcar como configurado
                input._formatacaoConfigured = true;
                console.log(`✅ Formatação configurada para ${id} (${decimais} decimais)`);
            }
        });

        // Campos inteiros
        const camposInteiros = [
            CONFIG.campos.quantidade,
            CONFIG.campos.pecasPorPacote
        ];

        camposInteiros.forEach(id => {
            const input = document.getElementById(id);
            if (input) {
                // ✅ CORREÇÃO CRÍTICA: NÃO CLONAR ELEMENTO para preservar navegação Enter
                if (input._formatacaoInteiraConfigured) {
                    console.log(`⚠️ Formatação inteira já configurada para ${id}, pulando...`);
                    return;
                }
                
                input.addEventListener('input', function() {
                    let value = this.value.replace(/[^0-9]/g, '');
                    if (value === '') {
                        this.value = '';
                    } else {
                        const intValue = parseInt(value);
                        this.value = intValue.toString();
                    }
                });
                
                // Marcar como configurado
                input._formatacaoInteiraConfigured = true;
                console.log(`✅ Formatação inteira configurada para ${id}`);
            }
        });
    }

    /**
     * ✅ OBTER VALOR NUMÉRICO DO CAMPO
     */
    function obterValorNumerico(campoId, valorPadrao = 0) {
        const input = document.getElementById(campoId);
        if (!input || !input.value.trim()) {
            return valorPadrao;
        }

        const value = input.value.replace(',', '.');
        const numericValue = parseFloat(value);
        return isNaN(numericValue) ? valorPadrao : numericValue;
    }

    /**
     * ✅ INICIALIZAR FORMATAÇÃO
     */
    function inicializar() {
        console.log('🎯 Inicializando formatação PCT...');
        
        // Aguardar DOM estar pronto
        if (document.readyState === 'loading') {
            document.addEventListener('DOMContentLoaded', configurarFormatacaoNumerica);
        } else {
            configurarFormatacaoNumerica();
        }

        try {
            if (!window.isAllCaps) {
                window.isAllCaps = function(text){
                    if (!text) return false;
                    const letters = String(text).replace(/[^A-Za-zÀ-ÿ]/g, '');
                    if (!letters) return false;
                    return letters === letters.toUpperCase();
                };
            }
            if (!window.toTitleCasePt) {
                window.toTitleCasePt = function(text){
                    if (!text) return text;
                    const acronyms = new Set(['CPF','CNPJ','RG','IE','IM','NF','NFE','NF-E','CTE','PIX','IPTU','IPVA','ISS','ICMS','IPI','PIS','COFINS','CSLL','MEI','ME','LTDA','EIRELI','S/A','SA']);
                    const s = String(text).replace(/\s+/g, ' ').trim();
                    const cap = w => w ? (w.charAt(0).toUpperCase() + w.slice(1).toLowerCase()) : w;
                    return s.split(' ').map(token => {
                        const clean = token.trim();
                        if (acronyms.has(clean.toUpperCase())) return clean.toUpperCase();
                        return clean.split(/([\-\/])/).map(part => (part === '-' || part === '/') ? part : cap(part)).join('');
                    }).join(' ');
                };
            }
            const textNodes = document.querySelectorAll('input[type="text"], textarea');
            textNodes.forEach(el => {
                el.addEventListener('blur', function(){
                    const v = String(this.value || '').trim();
                    if (!v) return;
                    if (window.isAllCaps && window.toTitleCasePt && window.isAllCaps(v)) {
                        this.value = window.toTitleCasePt(v);
                    }
                });
            });
        } catch(_) {}
    }

    // ✅ API PÚBLICA
    return {
        inicializar: inicializar,
        configurarFormatacaoNumerica: configurarFormatacaoNumerica,
        formatarCampoDecimal: formatarCampoDecimal,
        obterValorNumerico: obterValorNumerico
    };

})();

// ✅ EXPOR GLOBALMENTE
window.formatarCampoDecimal = window.FormatacaoCamposPCT.formatarCampoDecimal;
window.obterValorNumericoPCT = window.FormatacaoCamposPCT.obterValorNumerico;

// ✅ INICIALIZAR AUTOMATICAMENTE
window.FormatacaoCamposPCT.inicializar();

console.log('✅ Módulo FormatacaoCamposPCT carregado');
