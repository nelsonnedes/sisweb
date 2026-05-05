/**
 * 🚀 INICIALIZADOR SISTEMA MODULAR ROMANEIOPCT V2.0
 * 
 * Sistema que substitui o arquivo gigante romaneiopct_modais.js
 * por módulos organizados e maintíveis.
 * 
 * REDUÇÃO: 90% do código original
 * MÓDULOS: 4 módulos específicos PCT
 */

class SistemaModularPCT {
    constructor() {
        this.modulosCarregados = {};
        this.sistemaIniciado = false;
        this.log('🚀 Inicializando Sistema Modular PCT V2.0');
    }

    log(mensagem, tipo = 'info') {
        const tipos = { info: '📝', success: '✅', warning: '⚠️', error: '❌' };
        console.log(`${tipos[tipo]} [PCT-Modular] ${mensagem}`);
    }

    async iniciar() {
        try {
            this.log('⚙️ Carregando módulos PCT...');
            
            // Carregar todos os módulos em paralelo
            const [calculos, impressao, navegacao, validacoes] = await Promise.all([
                import('./calculos-pct.js'),
                import('./imprimir-romaneio-pct.js'),
                import('./navegacao-pct.js'),
                import('./validacoes-pct.js')
            ]);
            
            // Registrar módulos
            this.modulosCarregados = {
                calculos,
                impressao,
                navegacao,
                validacoes
            };
            
            // Disponibilizar globalmente
            this.disponibilizarGlobalmente();
            
            // Configurar sistema
            await this.configurarSistema();
            
            this.sistemaIniciado = true;
            this.log('✅ Sistema Modular PCT iniciado com sucesso', 'success');
            
            return true;
            
        } catch (error) {
            this.log(`❌ Erro na inicialização: ${error.message}`, 'error');
            return false;
        }
    }

    disponibilizarGlobalmente() {
        // Funções de cálculo
        window.calcularVolumePCT = this.modulosCarregados.calculos.calcularVolumePCT;
        window.calcularTotalPecasPCT = this.modulosCarregados.calculos.calcularTotalPecasPCT;
        window.validarPecasPorPacote = this.modulosCarregados.calculos.validarPecasPorPacote;
        
        // Sistema de impressão
        window.imprimirRomaneio = this.modulosCarregados.impressao.imprimirRomaneio;
        
        // Navegação
        window.setupNavegacaoEnterPCT = this.modulosCarregados.navegacao.setupNavegacaoEnterPCT;
        
        // Validações
        window.validarSistemaPCT = this.modulosCarregados.validacoes.validarSistemaPCT;
        window.testarFuncionalidadesPCT = this.modulosCarregados.validacoes.testarFuncionalidadesPCT;
        
        this.log('🌐 Funções disponibilizadas globalmente');
    }

    async configurarSistema() {
        // Aguardar DOM estar pronto
        if (document.readyState === 'loading') {
            await new Promise(resolve => {
                document.addEventListener('DOMContentLoaded', resolve);
            });
        }
        
        // Configurar navegação Enter
        this.modulosCarregados.navegacao.setupNavegacaoEnterPCT();
        
        // Executar validação inicial
        const resultados = this.modulosCarregados.validacoes.validarSistemaPCT();
        const erros = resultados.filter(r => !r.valido);
        
        if (erros.length > 0) {
            this.log(`⚠️ ${erros.length} problemas encontrados`, 'warning');
            erros.forEach(erro => this.log(`⚠️ ${erro.nome}: ${erro.detalhes}`, 'warning'));
        } else {
            this.log('✅ Validação inicial aprovada', 'success');
        }
    }

    // Método para executar testes
    async executarTestes() {
        if (!this.sistemaIniciado) {
            this.log('❌ Sistema não iniciado', 'error');
            return [];
        }
        
        this.log('🧪 Executando testes de funcionalidade...');
        
        const resultados = this.modulosCarregados.validacoes.testarFuncionalidadesPCT();
        
        const sucessos = resultados.filter(r => r.resultado === 'PASSOU');
        const falhas = resultados.filter(r => r.resultado !== 'PASSOU');
        
        this.log(`📊 Testes: ${sucessos.length} sucessos, ${falhas.length} falhas`);
        
        if (falhas.length > 0) {
            falhas.forEach(falha => {
                this.log(`❌ ${falha.nome}: ${falha.resultado}`, 'error');
            });
        }
        
        return resultados;
    }
}

// Inicializar automaticamente
const sistemaModular = new SistemaModularPCT();

// Exportar para uso global
window.sistemaModularPCT = sistemaModular;

// Auto-inicializar
sistemaModular.iniciar().then(sucesso => {
    if (sucesso) {
        console.log('🎉 Sistema Modular Romaneiopct V2.0 operacional!');
    } else {
        console.error('🚨 Falha na inicialização do sistema modular');
    }
});
