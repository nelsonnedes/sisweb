/**
 * Romaneio - Utilitários e Funções Comuns
 * Este arquivo contém funções compartilhadas entre os diferentes tipos de romaneio
 */

// Garantir que não serão definidas novamente se já existirem
if (typeof window.formatarDimensao !== 'function') {
    /**
     * Formata uma dimensão para exibição
     * @param {number|string} dimensao - Dimensão a ser formatada
     * @returns {string} Dimensão formatada com 2 casas decimais
     */
    window.formatarDimensao = function(dimensao) {
        if (dimensao === undefined || dimensao === null) return "0,00";
        let valor = dimensao;
        if (typeof dimensao === 'string') {
            valor = parseFloat(dimensao.replace(',', '.'));
        }
        if (isNaN(valor)) return "0,00";
        return valor.toFixed(2).replace('.', ',');
    };
    console.log("✅ Função formatarDimensao registrada globalmente");
}

if (typeof window.formatarVolume !== 'function') {
    /**
     * Formata um volume para exibição
     * @param {number|string} volume - Volume a ser formatado
     * @returns {string} Volume formatado com 3 casas decimais e unidade m³
     */
    window.formatarVolume = function(volume) {
        if (volume === undefined || volume === null) return "0,000 m³";
        let valor = volume;
        if (typeof volume === 'string') {
            valor = parseFloat(volume.replace(',', '.'));
        }
        if (isNaN(valor)) return "0,000 m³";
        return valor.toFixed(3).replace('.', ',') + " m³";
    };
    console.log("✅ Função formatarVolume registrada globalmente");
}

if (typeof window.formatNumber !== 'function') {
    /**
     * Formata um número para exibição com separador de milhar e decimal
     * @param {number} value - Valor a ser formatado
     * @param {number} decimals - Número de casas decimais (padrão 2)
     * @returns {string} Valor formatado
     */
    window.formatNumber = function(value, decimals = 2) {
        if (value === undefined || value === null || isNaN(value)) return "0";
        return parseFloat(value).toLocaleString('pt-BR', {
            minimumFractionDigits: decimals,
            maximumFractionDigits: decimals
        });
    };
    console.log("✅ Função formatNumber registrada globalmente");
}

if (typeof window.formatCurrency !== 'function') {
    /**
     * Formata um valor monetário para exibição (BRL)
     * @param {number} value - Valor a ser formatado
     * @returns {string} Valor formatado como moeda
     */
    window.formatCurrency = function(value) {
        if (value === undefined || value === null || isNaN(value)) return "R$ 0,00";
        return parseFloat(value).toLocaleString('pt-BR', {
            style: 'currency',
            currency: 'BRL'
        });
    };
    console.log("✅ Função formatCurrency registrada globalmente");
}

if (typeof window.inicializarAplicacao !== 'function') {
    /**
     * Inicializa a aplicação de romaneio
     * Esta função é chamada ao carregar o documento
     */
    window.inicializarAplicacao = async function() {
        console.log('🚀 Inicializando aplicação Romaneio...');
        
        if (window._INICIALIZAR_APLICACAO_DONE || window._INICIALIZAR_APLICACAO_RUNNING) {
            console.log('⚠️ inicializarAplicacao já foi executada ou está em execução. Ignorando.');
            return;
        }
        window._INICIALIZAR_APLICACAO_RUNNING = true;
        
        // Verificar se Firebase está pronto
        if (window._BLOCK_INIT) {
            console.log('🚫 Inicialização bloqueada - aguardando Firebase...');
            return;
        }
        
        if (!window._FIREBASE_READY) {
            console.log('⚠️ Firebase não está pronto, mas continuando...');
        }
        
        try {
            console.log('🔧 Iniciando configurações...');
            
            // Configurar data atual
            const dataField = document.getElementById('dataRomaneio');
            if (dataField && !dataField.value) {
                const hoje = new Date().toISOString().split('T')[0];
                dataField.value = hoje;
                console.log('📅 Data atual configurada:', hoje);
            }
            
            // Aguardar um pouco mais se Firebase ainda não estiver pronto
            if (window.firebaseService && !window._FIREBASE_READY) {
                console.log('⏳ Aguardando Firebase finalizar inicialização...');
                await new Promise(resolve => setTimeout(resolve, 2000));
            }
            
            // Carregar dados apenas se Firebase estiver funcionando E as funções estiverem disponíveis
            if (window.firebaseService && window._FIREBASE_READY) {
                console.log('📊 Carregando dados do Firebase...');
                
                // ✅ CORREÇÃO: Verificar se as funções existem antes de chamar
                if (typeof window.carregarClientes === 'function') {
                    try {
                        await window.carregarClientes();
                        console.log('✅ Clientes carregados');
                    } catch (error) {
                        console.warn('⚠️ Erro ao carregar clientes:', error.message);
                    }
                } else {
                    console.log('⚠️ Função carregarClientes não disponível ainda');
                }
                
                if (typeof window.carregarEspecies === 'function') {
                    try {
                        await window.carregarEspecies();
                        console.log('✅ Espécies carregadas');
                    } catch (error) {
                        console.warn('⚠️ Erro ao carregar espécies:', error.message);
                    }
                } else {
                    console.log('⚠️ Função carregarEspecies não disponível ainda');
                }
            } else {
                console.log('⚠️ Firebase não está pronto - dados não serão carregados agora');
            }
            
            // Configurações da interface
            console.log('🎨 Configurando interface...');
            
            // Limpar tabela
            if (!window.romaneioItems) {
                window.romaneioItems = [];
            }
            
            if (typeof window.renderizarTabela === 'function') {
                try {
                    window.renderizarTabela();
                    console.log('✅ Tabela renderizada');
                } catch (error) {
                    console.warn('⚠️ Erro ao renderizar tabela:', error.message);
                }
            } else if (typeof updateTableBody === 'function') {
                const tbody = document.querySelector('#romaneioTable tbody');
                if (tbody) {
                    updateTableBody(tbody);
                }
            }
            
            console.log('✅ Aplicação inicializada com sucesso!');
            
        } catch (error) {
            console.error('❌ Erro durante inicialização:', error);
        } finally {
            window._INICIALIZAR_APLICACAO_RUNNING = false;
            window._INICIALIZAR_APLICACAO_DONE = true;
        }
    };
    console.log("✅ Função inicializarAplicacao registrada globalmente");
}

// Funções de cálculo compartilhadas
if (typeof window.calcularVolumeTora !== 'function') {
    /**
     * Calcula o volume de uma tora
     * @param {number} diametro - Diâmetro da tora em cm
     * @param {number} comprimento - Comprimento da tora em metros
     * @returns {number} Volume da tora em m³
     */
    window.calcularVolumeTora = function(diametro, comprimento) {
        if (!diametro || !comprimento) return 0;
        
        const raio = diametro / 2 / 100; // converter cm para metros
        const volume = Math.PI * raio * raio * comprimento;
        return volume;
    };
    console.log("✅ Função calcularVolumeTora registrada globalmente");
}

console.log("✅ romaneio-utils.js carregado com sucesso"); 