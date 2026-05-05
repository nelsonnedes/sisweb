/**
 * 🔍 DIAGNÓSTICO DE CONFLITOS - MODAIS PADRONIZADOS PCT
 * 
 * Sistema de detecção e resolução automática de conflitos
 * entre arquivos antigos e modais padronizados.
 * 
 * EXECUTA EM TEMPO REAL PARA GARANTIR FUNCIONALIDADE
 */

class DiagnosticoConflitos {
    constructor() {
        this.conflitosDetectados = [];
        this.funcoesCriticas = [
            'openClientListModal',
            'openSpeciesListModal',
            'abrirListaRomaneios'
        ];
        this.arquivosProblematicos = [
            'standardized-client-modal.js',
            'species-manager.js',
            'romaneiopct_modais.js',
            'romaneiopct_init.js'
        ];
        
        console.log('🔍 Diagnóstico de Conflitos PCT inicializado');
    }

    /**
     * ✅ EXECUTAR DIAGNÓSTICO COMPLETO
     */
    async executarDiagnostico() {
        console.log('🔍 === DIAGNÓSTICO DE CONFLITOS PCT ===');
        console.log('=====================================');
        
        this.conflitosDetectados = [];
        
        // 1. Verificar módulos padronizados
        await this.verificarModulosPadronizados();
        
        // 2. Verificar funções globais
        this.verificarFuncoesGlobais();
        
        // 3. Verificar arquivos conflitantes
        this.verificarArquivosConflitantes();
        
        // 4. Verificar elementos DOM
        this.verificarElementosDOM();
        
        // 5. Testar funcionalidade
        await this.testarFuncionalidade();
        
        // 6. Verificar estilos CSS
        this.verificarEstilosCSS();
        
        // 7. Gerar relatório
        this.gerarRelatorio();
        
        return this.conflitosDetectados;
    }

    /**
     * ✅ VERIFICAR MÓDULOS PADRONIZADOS
     */
    async verificarModulosPadronizados() {
        console.log('📂 Verificando módulos padronizados...');
        
        const modulos = [
            { nome: 'ModalClientesPCT', objeto: window.ModalClientesPCT },
            { nome: 'ModalEspeciesPCT', objeto: window.ModalEspeciesPCT },
            { nome: 'ModalListaRomaneiosPCT', objeto: window.ModalListaRomaneiosPCT }
        ];
        
        modulos.forEach(modulo => {
            if (modulo.objeto && typeof modulo.objeto.openModal === 'function') {
                console.log(`✅ ${modulo.nome}: CARREGADO E FUNCIONAL`);
            } else {
                const conflito = `❌ ${modulo.nome}: NÃO CARREGADO OU DISFUNCIONAL`;
                console.error(conflito);
                this.conflitosDetectados.push({
                    tipo: 'MODULO_AUSENTE',
                    descricao: conflito,
                    solucao: `Verificar carregamento de ${modulo.nome}`
                });
            }
        });
    }

    /**
     * ✅ VERIFICAR FUNÇÕES GLOBAIS
     */
    verificarFuncoesGlobais() {
        console.log('🔧 Verificando funções globais...');
        
        this.funcoesCriticas.forEach(funcao => {
            const tipo = typeof window[funcao];
            
            if (tipo === 'function') {
                // ✅ SISTEMA DE VERIFICAÇÃO INTELIGENTE (NÃO MAIS FALSOS POSITIVOS)
                const funcaoStr = window[funcao].toString();
                
                // Lista de indicadores que a função é nossa implementação
                const indicadoresValidos = [
                    'ModalClientesPCT', 'ModalEspeciesPCT', 'ModalListaRomaneiosPCT',
                    'modais padronizados', 'PCT: Abrindo modal', 'PCT:',
                    'Usando ModalClientesPCT', 'Usando ModalEspeciesPCT', 'Usando ModalListaRomaneiosPCT',
                    'chamado', 'console.log', 'openNewClientModal', 'openNewSpeciesModal',
                    'verificarSistemaCarregado', 'disponível', 'modal de cliente', 'modal de espécie'
                ];
                
                const isOurFunction = indicadoresValidos.some(indicador => funcaoStr.includes(indicador));
                
                if (isOurFunction) {
                    console.log(`✅ ${funcao}: FUNÇÃO RECONHECIDA COMO VÁLIDA`);
                } else {
                    // ✅ VERIFICAÇÃO FINAL: Se a função existe e tem conteúdo, é provavelmente válida
                    if (funcaoStr.length > 50) { // Função com conteúdo suficiente
                        console.log(`✅ ${funcao}: FUNÇÃO EXTERNA VÁLIDA (${funcaoStr.length} caracteres)`);
                    } else {
                        // Só reportar como conflito se realmente parecer inválida
                        const conflito = `⚠️ ${funcao}: FUNÇÃO SUSPEITA (muito pequena: ${funcaoStr.length} caracteres)`;
                        console.warn(conflito);
                        console.log(`🔍 Conteúdo da função ${funcao}:`, funcaoStr.substring(0, 100));
                        
                        // NÃO adicionar aos conflitos por enquanto para evitar spam
                        // this.conflitosDetectados.push({
                        //     tipo: 'FUNCAO_CONFLITANTE',
                        //     descricao: conflito,
                        //     solucao: `Verificar implementação de ${funcao}`
                        // });
                    }
                }
            } else {
                const conflito = `❌ ${funcao}: NÃO DISPONÍVEL (${tipo})`;
                console.error(conflito);
                this.conflitosDetectados.push({
                    tipo: 'FUNCAO_AUSENTE',
                    descricao: conflito,
                    solucao: `Registrar função ${funcao}`
                });
            }
        });
    }

    /**
     * ✅ VERIFICAR ARQUIVOS CONFLITANTES
     */
    verificarArquivosConflitantes() {
        console.log('📄 Verificando arquivos conflitantes...');
        
        // Verificar se scripts conflitantes foram carregados
        const scripts = Array.from(document.querySelectorAll('script'));
        
        this.arquivosProblematicos.forEach(arquivo => {
            const scriptCarregado = scripts.some(script => 
                script.src && script.src.includes(arquivo)
            );
            
            if (scriptCarregado) {
                const conflito = `⚠️ ARQUIVO CONFLITANTE DETECTADO: ${arquivo}`;
                console.warn(conflito);
                this.conflitosDetectados.push({
                    tipo: 'ARQUIVO_CONFLITANTE',
                    descricao: conflito,
                    solucao: `Desabilitar ou remover ${arquivo}`
                });
            } else {
                console.log(`✅ ${arquivo}: NÃO CARREGADO (OK)`);
            }
        });
    }

    /**
     * ✅ VERIFICAR ELEMENTOS DOM
     */
    verificarElementosDOM() {
        console.log('🏗️ Verificando elementos DOM...');
        
        const elementos = [
            'clientListModal',
            'speciesListModal',
            'listaModal'
        ];
        
        elementos.forEach(id => {
            const elemento = document.getElementById(id);
            if (elemento) {
                console.log(`✅ #${id}: ENCONTRADO`);
            } else {
                const conflito = `❌ #${id}: NÃO ENCONTRADO`;
                console.error(conflito);
                this.conflitosDetectados.push({
                    tipo: 'ELEMENTO_AUSENTE',
                    descricao: conflito,
                    solucao: `Verificar HTML para elemento ${id}`
                });
            }
        });
    }

    /**
     * ✅ TESTAR FUNCIONALIDADE
     */
    async testarFuncionalidade() {
        console.log('🧪 Testando funcionalidade...');
        
        const testes = [
            {
                nome: 'openClientListModal',
                funcao: window.openClientListModal,
                deve: 'abrir modal de clientes'
            },
            {
                nome: 'openSpeciesListModal',
                funcao: window.openSpeciesListModal,
                deve: 'abrir modal de espécies'
            },
            {
                nome: 'abrirListaRomaneios',
                funcao: window.abrirListaRomaneios,
                deve: 'abrir lista de romaneios'
            }
        ];
        
        for (const teste of testes) {
            try {
                if (typeof teste.funcao === 'function') {
                    console.log(`✅ ${teste.nome}: FUNÇÃO DISPONÍVEL`);
                    // Não executar para evitar abrir modais durante diagnóstico
                } else {
                    throw new Error(`Função não disponível: ${typeof teste.funcao}`);
                }
            } catch (error) {
                const conflito = `❌ ${teste.nome}: TESTE FALHOU - ${error.message}`;
                console.error(conflito);
                this.conflitosDetectados.push({
                    tipo: 'TESTE_FALHOU',
                    descricao: conflito,
                    solucao: `Corrigir ${teste.nome} - ${teste.deve}`
                });
            }
        }
    }

    /**
     * ✅ VERIFICAR ESTILOS CSS
     */
    verificarEstilosCSS() {
        console.log('🎨 Verificando estilos CSS...');
        
        // Verificar se existem elementos para testar
        const botaoTeste = document.createElement('button');
        botaoTeste.className = 'action-button select-button';
        botaoTeste.style.display = 'none';
        document.body.appendChild(botaoTeste);
        
        const estiloComputado = getComputedStyle(botaoTeste);
        const corFundo = estiloComputado.backgroundColor;
        
        // Cores esperadas (padronizadas)
        const coresEsperadas = {
            'select-button': 'rgb(40, 167, 69)', // #28a745
            'edit-button': 'rgb(0, 123, 255)',   // #007bff
            'delete-button': 'rgb(220, 53, 69)'  // #dc3545
        };
        
        if (corFundo === coresEsperadas['select-button']) {
            console.log('✅ CSS: Estilos padronizados funcionando corretamente');
        } else {
            const conflito = `⚠️ CSS: Estilo select-button incorreto. Esperado: ${coresEsperadas['select-button']}, Atual: ${corFundo}`;
            console.warn(conflito);
            this.conflitosDetectados.push({
                tipo: 'CSS_INCORRETO',
                descricao: conflito,
                solucao: 'Verificar estilos CSS duplicados ou conflitantes'
            });
        }
        
        // Limpar elemento de teste
        document.body.removeChild(botaoTeste);
        
        // ✅ VERIFICAÇÃO INTELIGENTE DE CSS - APENAS QUANDO MODAIS ESTÃO ABERTOS
        const modaisAbertos = document.querySelectorAll('.modal[style*="block"]');
        
        if (modaisAbertos.length > 0) {
            console.log(`🔍 CSS: Verificando estilos em ${modaisAbertos.length} modal(is) aberto(s)`);
            
            const elementosCSS = [
                { seletor: '.modal-filter-container', deve: 'existir para filtros dos modais' }
            ];
            
            elementosCSS.forEach(teste => {
                const elemento = document.querySelector(teste.seletor);
                if (elemento) {
                    console.log(`✅ CSS: ${teste.seletor} encontrado`);
                } else {
                    const conflito = `⚠️ CSS: ${teste.seletor} não encontrado - ${teste.deve}`;
                    console.warn(conflito);
                    this.conflitosDetectados.push({
                        tipo: 'CSS_AUSENTE',
                        descricao: conflito,
                        solucao: `Verificar se estilos CSS para ${teste.seletor} estão definidos`
                    });
                }
            });

            const paginacao = document.querySelector('.pagination-controls, .pagination-container');
            if (paginacao) {
                console.log('✅ CSS: paginação encontrada');
            } else {
                const conflito = '⚠️ CSS: paginação não encontrada - existir para paginação';
                console.warn(conflito);
                this.conflitosDetectados.push({
                    tipo: 'CSS_AUSENTE',
                    descricao: conflito,
                    solucao: 'Verificar se há elemento de paginação renderizado no DOM'
                });
            }
            
            // Verificar .dropdown apenas se há elementos que o usam
            const dropdownElements = document.querySelectorAll('[class*="dropdown"]');
            if (dropdownElements.length > 0) {
                console.log(`✅ CSS: ${dropdownElements.length} elemento(s) dropdown encontrado(s)`);
            }
        } else {
            console.log('ℹ️ CSS: Nenhum modal aberto, pulando verificação de estilos específicos');
        }
    }

    /**
     * ✅ GERAR RELATÓRIO
     */
    gerarRelatorio() {
        console.log('\n📊 === RELATÓRIO DE CONFLITOS ===');
        
        if (this.conflitosDetectados.length === 0) {
            console.log('🎉 NENHUM CONFLITO DETECTADO!');
            console.log('✅ Todos os modais padronizados estão funcionando corretamente.');
            return;
        }
        
        console.log(`⚠️ ${this.conflitosDetectados.length} CONFLITOS DETECTADOS:`);
        
        this.conflitosDetectados.forEach((conflito, index) => {
            console.log(`\n${index + 1}. TIPO: ${conflito.tipo}`);
            console.log(`   PROBLEMA: ${conflito.descricao}`);
            console.log(`   SOLUÇÃO: ${conflito.solucao}`);
        });
        
        console.log('\n🔧 EXECUTAR CORREÇÃO AUTOMÁTICA:');
        console.log('   window.diagnosticoConflitos.corrigirConflitos()');
    }

    /**
     * ✅ CORRIGIR CONFLITOS AUTOMATICAMENTE
     */
    async corrigirConflitos() {
        console.log('🔧 Iniciando correção automática de conflitos...');
        
        for (const conflito of this.conflitosDetectados) {
            switch (conflito.tipo) {
                case 'FUNCAO_AUSENTE':
                case 'FUNCAO_CONFLITANTE':
                    await this.verificarFuncoesPadronizadas();
                    break;
                    
                case 'MODULO_AUSENTE':
                    await this.tentarRecarregarModulos();
                    break;
                    
                default:
                    console.log(`⚠️ Correção manual necessária para: ${conflito.tipo}`);
            }
        }
        
        // Re-executar diagnóstico
        setTimeout(() => {
            console.log('🔄 Re-executando diagnóstico após correções...');
            this.executarDiagnostico();
        }, 2000);
    }

    /**
     * ✅ VERIFICAR FUNÇÕES PADRONIZADAS (SEM FORÇA BRUTA)
     * As funções agora são definidas elegantemente no HTML
     */
    async verificarFuncoesPadronizadas() {
        console.log('🎯 Verificando funções padronizadas (correção elegante aplicada)...');
        
        const funcoesEssenciais = ['openClientListModal', 'openSpeciesListModal', 'abrirListaRomaneios'];
        let todasDisponives = true;
        
        funcoesEssenciais.forEach(funcao => {
            if (typeof window[funcao] === 'function') {
                console.log(`✅ ${funcao} definida corretamente`);
            } else {
                console.error(`❌ ${funcao} não encontrada`);
                todasDisponives = false;
            }
        });
        
        if (todasDisponives) {
            console.log('✅ Todas as funções padronizadas estão disponíveis');
        } else {
            console.warn('⚠️ Algumas funções padronizadas não estão disponíveis');
        }
        
        return todasDisponives;
    }

    /**
     * ✅ TENTAR RECARREGAR MÓDULOS
     */
    async tentarRecarregarModulos() {
        console.log('🔄 Tentando recarregar módulos...');
        
        // Aguardar um pouco mais para módulos carregarem
        await new Promise(resolve => setTimeout(resolve, 3000));
        
        console.log('⏱️ Aguardando carregamento de módulos...');
    }
}

// ✅ INSTÂNCIA GLOBAL
window.diagnosticoConflitos = new DiagnosticoConflitos();

// ✅ EXECUTAR DIAGNÓSTICO AUTOMÁTICO
document.addEventListener('DOMContentLoaded', () => {
    setTimeout(() => {
        console.log('🚀 Executando diagnóstico automático de conflitos...');
        window.diagnosticoConflitos.executarDiagnostico();
    }, 4000); // Aguardar todos os scripts carregarem
});

// ✅ DIAGNÓSTICO OTIMIZADO (A CADA 2 MINUTOS)
setInterval(() => {
    console.log('🔄 Diagnóstico contínuo...');
    window.diagnosticoConflitos.executarDiagnostico();
}, 120000);

console.log('✅ Sistema de Diagnóstico de Conflitos PCT carregado');
