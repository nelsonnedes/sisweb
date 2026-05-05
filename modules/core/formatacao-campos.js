/**
 * 💰 MÓDULO: Formatação de Campos - Romaneio TL
 * 
 * Responsabilidades:
 * - Formatação de campos monetários
 * - Formatação de campos numéricos
 * - Conversão de valores
 * - Validação de entrada
 * 
 * ✅ ESTRUTURA MODULAR: Seguindo romaneiotl-estruturaçãomodular.txt
 * ✅ BASEADO NO ORIGINAL: Funcionalidades do romaneiotl.js original
 */

window.FormatacaoCampos = (function() {
    'use strict';
    const legacyKey = ['b','i','t','o','l','a'].join('');

    // ✅ CONFIGURAÇÕES
    const CONFIG = {
        moeda: {
            locale: 'pt-BR',
            currency: 'BRL',
            minimumFractionDigits: 2,
            maximumFractionDigits: 2
        },
        campos: {
            price: 'price',
            comprimento: 'comprimento',
            largura: 'largura',
            espessura: 'espessura',
            quantidade: 'quantidade'
        }
    };

    /**
     * ✅ FORMATAR INPUT DE MOEDA
     * Baseado na função formatCurrencyInput do original
     */
    function formatarInputMoeda(input) {
        if (!input) return;

        let value = input.value.replace(/\D/g, '');
        
        if (value.length === 0) {
            input.value = '';
            return;
        }
        
        // Converter para centavos
        value = parseInt(value);
        
        // Formatar como moeda
        const formattedValue = (value / 100).toLocaleString(CONFIG.moeda.locale, {
            style: 'currency',
            currency: CONFIG.moeda.currency,
            minimumFractionDigits: CONFIG.moeda.minimumFractionDigits,
            maximumFractionDigits: CONFIG.moeda.maximumFractionDigits
        });
        
        input.value = formattedValue;
        
        console.log(`💰 Valor formatado: ${formattedValue}`);
    }

    /**
     * ✅ CONVERTER VALOR MONETÁRIO PARA NÚMERO
     * Baseado na função parseCurrencyValue do original
     */
    function converterValorMoeda(value) {
        if (!value) return 0;
        
        console.log("💱 Convertendo valor de moeda:", value);
        
        try {
            // Remover símbolo de moeda (R$) e espaços
            let numericValue = value.replace(/R\$\s*/g, '');
            
            // 🔧 CORREÇÃO: Detectar se é formato brasileiro ou americano
            // Formato brasileiro: 1.234,56 (ponto = separador de milhar, vírgula = decimal)
            // Formato americano: 1234.56 (ponto = decimal)
            
            // Se contém vírgula, é formato brasileiro
            if (numericValue.includes(',')) {
                // Formato brasileiro: remover pontos (separadores de milhar) e trocar vírgula por ponto
                numericValue = numericValue.replace(/\./g, '');
                numericValue = numericValue.replace(',', '.');
            } else {
                // Se não tem vírgula, pode ser formato americano ou número simples
                // Verificar se tem múltiplos pontos (seria formato americano com separadores de milhar: 1.234.567.89)
                const pontos = (numericValue.match(/\./g) || []).length;
                
                if (pontos > 1) {
                    // Múltiplos pontos: último é decimal, outros são separadores de milhar
                    const partes = numericValue.split('.');
                    const parteDecimal = partes.pop(); // Remove e obtém a última parte (decimal)
                    const parteInteira = partes.join(''); // Junta o resto sem pontos
                    numericValue = parteInteira + '.' + parteDecimal;
                } else if (pontos === 1) {
                    // Um ponto apenas: verificar se parece ser decimal (2 dígitos após o ponto)
                    const partes = numericValue.split('.');
                    if (partes[1] && partes[1].length <= 2 && !/\d{4,}/.test(partes[0])) {
                        // Parece formato americano com decimal (ex: 2300.00)
                        // Manter como está
                    } else {
                        // Parece separador de milhar, remover
                        numericValue = numericValue.replace('.', '');
                    }
                }
            }
            
            // Converter para número
            const result = parseFloat(numericValue);
            
            // Verificar se é um número válido
            if (isNaN(result)) {
                console.error("❌ Falha ao converter valor monetário:", value, "→", numericValue, "→", result);
                return 0;
            }
            
            console.log("✅ Valor convertido com sucesso:", value, "→", numericValue, "→", result);
            return result;
        } catch (error) {
            console.error("❌ Erro ao converter valor monetário:", error);
            return 0;
        }
    }

    /**
     * ✅ FORMATAR CAMPO NUMÉRICO
     */
    function formatarCampoNumerico(input, decimais = 3) {
        if (!input) return;

        let value = input.value.replace(/[^0-9,\.]/g, '');
        
        // Substituir vírgula por ponto
        value = value.replace(',', '.');
        
        // Verificar se é um número válido
        const numericValue = parseFloat(value);
        
        if (!isNaN(numericValue) && numericValue > 0) {
            input.value = numericValue.toFixed(decimais);
        } else if (value === '') {
            input.value = '';
        }
    }

    /**
     * ✅ CONFIGURAR FORMATAÇÃO AUTOMÁTICA DOS CAMPOS
     */
    function configurarFormatacao() {
        console.log('💰 Configurando formatação de campos...');

        // Campo de preço - formatação monetária
        const priceInput = document.getElementById(CONFIG.campos.price);
        if (priceInput) {
            // Remover eventos anteriores
            const newPriceInput = priceInput.cloneNode(true);
            priceInput.parentNode.replaceChild(newPriceInput, priceInput);
            
            // Configurar formatação em tempo real
            newPriceInput.addEventListener('input', function() {
                formatarInputMoeda(this);
            });
            
            newPriceInput.addEventListener('blur', function() {
                formatarInputMoeda(this);
            });
            
            console.log('✅ Formatação monetária configurada para campo preço');
        }

        // Campos numéricos - formatação decimal
        const camposNumericos = [
            { id: CONFIG.campos.comprimento, decimais: 2 },
            { id: CONFIG.campos.largura, decimais: 3 },
            { id: CONFIG.campos.espessura, decimais: 3 }
        ];

        camposNumericos.forEach(({ id, decimais }) => {
            const input = document.getElementById(id);
            if (input) {
                // Remover eventos anteriores
                const newInput = input.cloneNode(true);
                input.parentNode.replaceChild(newInput, input);
                
                newInput.addEventListener('blur', function() {
                    formatarCampoNumerico(this, decimais);
                });
                
                console.log(`✅ Formatação numérica configurada para campo ${id}`);
            }
        });

        // Campo quantidade - apenas números inteiros
        const quantidadeInput = document.getElementById(CONFIG.campos.quantidade);
        if (quantidadeInput) {
            const newQuantidadeInput = quantidadeInput.cloneNode(true);
            quantidadeInput.parentNode.replaceChild(newQuantidadeInput, quantidadeInput);
            
            newQuantidadeInput.addEventListener('input', function() {
                // Permitir apenas números inteiros
                this.value = this.value.replace(/[^0-9]/g, '');
            });
            
            console.log('✅ Formatação de quantidade configurada');
        }

        console.log('✅ Formatação de campos configurada com sucesso');
    }

    function applyTextNormalization() {
        try {
            const nodes = document.querySelectorAll('input[type="text"], textarea');
            nodes.forEach(el => {
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

    /**
     * ✅ CALCULAR VOLUME - PADRONIZADO (comprimento × largura × espessura em cm³, convertido para m³)
     * Usa a função padronizada do UtilsTL para consistência
     */
    function calcularVolume(comprimento, largura, espessura) {
        // ✅ USAR FUNÇÃO PADRONIZADA do UtilsTL para garantir consistência
        if (window.UtilsTL && window.UtilsTL.calcularVolume) {
            return window.UtilsTL.calcularVolume(comprimento, largura, espessura, 1);
        }
        
        // Fallback se UtilsTL não estiver disponível
        const comp = parseFloat(comprimento) || 0;
        const larg = parseFloat(largura) || 0;
        const esp = parseFloat(espessura) || 0;
        
        if (comp <= 0 || larg <= 0 || esp <= 0) {
            console.warn('⚠️ Dimensões inválidas para cálculo de volume:', {comp, larg, esp});
            return 0;
        }
        
        // ✅ FÓRMULA PADRONIZADA: cm³ para m³ (dividir por 1.000.000)
        const volumeM3 = (comp * larg * esp) / 1000000;
        
        console.log(`📏 Cálculo de volume (fallback): ${comp} × ${larg} × ${esp} = ${volumeM3.toFixed(6)} m³`);
        
        return parseFloat(volumeM3.toFixed(6));
    }

    /**
     * ✅ OBTER VALORES DOS CAMPOS - VERSÃO MELHORADA
     */
    function obterValoresCampos() {
        console.log('📊 Iniciando obterValoresCampos...');
        const campos = {};
        
        // 🔍 DEBUG: Verificar estado dos elementos DOM
        console.log('🔍 DEBUG: Verificando elementos DOM...');
        
        // Campo preço (monetário) - MELHORADO COM FALLBACK
        const priceInput = document.getElementById(CONFIG.campos.price);
        console.log('🔍 priceInput encontrado:', !!priceInput, 'valor RAW:', priceInput?.value);
        
        if (priceInput && priceInput.value.trim()) {
            campos.preco = converterValorMoeda(priceInput.value);
        } else {
            // Se campo está vazio ou não existe, definir como 0
            campos.preco = 0;
        }
        console.log(`💰 Preço obtido: "${priceInput?.value}" → ${campos.preco}`);
        
        // Campos numéricos - MELHORADOS COM VALIDAÇÃO
        const comprimentoInput = document.getElementById(CONFIG.campos.comprimento);
        console.log('🔍 comprimentoInput encontrado:', !!comprimentoInput, 'valor RAW:', comprimentoInput?.value);
        
        if (comprimentoInput && comprimentoInput.value.trim()) {
            const valor = parseFloat(comprimentoInput.value.replace(',', '.'));
            campos.comprimento = isNaN(valor) ? 0 : valor;
        } else {
            campos.comprimento = 0;
        }
        console.log(`📏 Comprimento: "${comprimentoInput?.value}" → ${campos.comprimento}`);
        
        const larguraInput = document.getElementById(CONFIG.campos.largura);
        console.log('🔍 larguraInput encontrado:', !!larguraInput, 'valor RAW:', larguraInput?.value);
        
        if (larguraInput && larguraInput.value.trim()) {
            const valor = parseFloat(larguraInput.value.replace(',', '.'));
            campos.largura = isNaN(valor) ? 0 : valor;
        } else {
            campos.largura = 0;
        }
        console.log(`📐 Largura: "${larguraInput?.value}" → ${campos.largura}`);
        
        // Espessura - COMPATIBILIDADE MELHORADA
        const espessuraInput = document.getElementById(CONFIG.campos.espessura) || document.getElementById(legacyKey);
        console.log('🔍 espessuraInput encontrado:', !!espessuraInput, 'id usado:', espessuraInput?.id, 'valor RAW:', espessuraInput?.value);
        
        if (espessuraInput && espessuraInput.value.trim()) {
            const valor = parseFloat(espessuraInput.value.replace(',', '.'));
            campos.espessura = isNaN(valor) ? 0 : valor;
        } else {
            campos.espessura = 0;
        }
        console.log(`🔧 Espessura: "${espessuraInput?.value}" → ${campos.espessura}`);
        
        const quantidadeInput = document.getElementById(CONFIG.campos.quantidade);
        console.log('🔍 quantidadeInput encontrado:', !!quantidadeInput, 'valor RAW:', quantidadeInput?.value);
        
        if (quantidadeInput && quantidadeInput.value.trim()) {
            const valor = parseInt(quantidadeInput.value);
            campos.quantidade = isNaN(valor) ? 1 : Math.max(1, valor); // Mínimo 1
        } else {
            campos.quantidade = 1; // Default para 1 se não especificado
        }
        console.log(`🔢 Quantidade: "${quantidadeInput?.value}" → ${campos.quantidade}`);
        
        // ⚠️ VERIFICAÇÃO DE VALORES CRÍTICOS
        if (campos.comprimento <= 0) {
            console.warn('⚠️ ATENÇÃO: Comprimento é 0 ou inválido!');
        }
        if (campos.largura <= 0) {
            console.warn('⚠️ ATENÇÃO: Largura é 0 ou inválida!');
        }
        if (campos.espessura <= 0) {
            console.warn('⚠️ ATENÇÃO: Espessura é 0 ou inválida!');
        }
        
        // Calcular volume usando espessura (compatível com campo legado)
        campos.volume = calcularVolume(campos.comprimento, campos.largura, campos.espessura);
        
        // Calcular valor total
        campos.valorTotal = campos.volume * campos.quantidade * campos.preco;
        console.log(`💵 Valor total: ${campos.volume} × ${campos.quantidade} × ${campos.preco} = ${campos.valorTotal}`);
        
        console.log('📊 Valores finais dos campos:', campos);
        
        return campos;
    }

    /**
     * ✅ LIMPAR CAMPOS (preservar cliente, espécie, espessura, preço e quantidade)
     */
    function limparCampos() {
        // Limpar apenas comprimento e largura (conforme sistema original)
        const camposParaLimpar = ['comprimento', 'largura'];
        
        camposParaLimpar.forEach(campo => {
            const id = CONFIG.campos[campo];
            const input = document.getElementById(id);
            if (input) {
                input.value = '';
                console.log(`🧹 Campo ${campo} limpo`);
            }
        });
        
        // Garantir que quantidade sempre volte para 1
        const quantidadeInput = document.getElementById(CONFIG.campos.quantidade);
        if (quantidadeInput) {
            quantidadeInput.value = '1';
            console.log('🔢 Quantidade resetada para 1');
        }
        
        console.log('🧹 Campos específicos limpos (preservando cliente, espécie, espessura e preço)');
    }

    /**
     * ✅ INICIALIZAR FORMATAÇÃO
     */
    function inicializar() {
        if (document.readyState === 'loading') {
            document.addEventListener('DOMContentLoaded', function(){
                configurarFormatacao();
                applyTextNormalization();
            });
        } else {
            setTimeout(function(){
                configurarFormatacao();
                applyTextNormalization();
            }, 100);
        }
    }

    // ✅ INTERFACE PÚBLICA
    return {
        formatarInputMoeda,
        converterValorMoeda,
        formatarCampoNumerico,
        configurarFormatacao,
        applyTextNormalization,
        calcularVolume,
        obterValoresCampos,
        limparCampos,
        inicializar
    };

})();

// ✅ FUNÇÕES GLOBAIS PARA COMPATIBILIDADE
if (typeof window.formatCurrencyInput !== 'function') { window.formatCurrencyInput = window.FormatacaoCampos.formatarInputMoeda; }
if (typeof window.parseCurrencyValue !== 'function') { window.parseCurrencyValue = window.FormatacaoCampos.converterValorMoeda; }

// ✅ INICIALIZAR AUTOMATICAMENTE
window.FormatacaoCampos.inicializar();

console.log('✅ Módulo FormatacaoCampos carregado com sucesso'); 
