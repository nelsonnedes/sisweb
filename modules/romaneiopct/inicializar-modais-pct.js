/**
 * 🚀 INICIALIZADOR DE MODAIS ROMANEIOPCT V1.0
 * 
 * Sistema que carrega e inicializa todos os modais padronizados
 * específicos para o sistema Romaneio PCT.
 * 
 * FUNCIONALIDADES:
 * - Carregamento dinâmico de modais
 * - Verificação de dependências
 * - Configuração de eventos globais
 * - Compatibilidade com sistema existente
 * 
 * ✅ BASEADO EM: Estrutura modular do romaneiotl
 * ✅ PRESERVA: Todas as funcionalidades PCT específicas
 */

class InicializadorModaisPCT {
    constructor() {
        this.modalModules = {};
        this.initialized = false;
        this.log('🚀 Iniciando Inicializador de Modais PCT');
    }

    log(mensagem, tipo = 'info') {
        const tipos = { info: '📝', success: '✅', warning: '⚠️', error: '❌' };
        console.log(`${tipos[tipo]} [Modais-PCT] ${mensagem}`);
    }

    /**
     * ✅ INICIALIZAR TODOS OS MODAIS PCT
     */
    async inicializar() {
        if (this.initialized) {
            this.log('⚠️ Modais PCT já foram inicializados', 'warning');
            return;
        }

        try {
            this.log('⚙️ Carregando módulos de modais PCT...');
            
            // Aguardar DOM estar pronto
            await this.aguardarDOM();
            
            // Verificar dependências críticas
            this.verificarDependencias();
            
            // Carregar módulos de modais
            await this.carregarModais();
            
            // Configurar eventos globais
            this.configurarEventosGlobais();
            
            // Configurar funções de compatibilidade
            this.configurarCompatibilidade();
            
            this.initialized = true;
            this.log('✅ Todos os modais PCT inicializados com sucesso', 'success');
            
        } catch (error) {
            this.log(`❌ Erro ao inicializar modais PCT: ${error.message}`, 'error');
            console.error('Erro detalhado:', error);
        }
    }

    /**
     * ✅ AGUARDAR DOM ESTAR PRONTO
     */
    async aguardarDOM() {
        return new Promise((resolve) => {
            if (document.readyState === 'loading') {
                document.addEventListener('DOMContentLoaded', resolve);
            } else {
                resolve();
            }
        });
    }

    /**
     * ✅ VERIFICAR DEPENDÊNCIAS CRÍTICAS
     */
    verificarDependencias() {
        const dependencias = [
            { nome: 'document', objeto: document },
            { nome: 'console', objeto: console }
        ];

        let dependenciasFaltando = [];

        dependencias.forEach(dep => {
            if (!dep.objeto) {
                dependenciasFaltando.push(dep.nome);
            }
        });

        if (dependenciasFaltando.length > 0) {
            throw new Error(`Dependências críticas faltando: ${dependenciasFaltando.join(', ')}`);
        }

        // Verificar elementos HTML essenciais
        const elementosEssenciais = [
            'clientListModal',
            'speciesListModal', 
            'listaModal'
        ];

        let elementosFaltando = [];

        elementosEssenciais.forEach(id => {
            if (!document.getElementById(id)) {
                elementosFaltando.push(id);
            }
        });

        if (elementosFaltando.length > 0) {
            this.log(`⚠️ Elementos HTML não encontrados: ${elementosFaltando.join(', ')}`, 'warning');
            this.log('⚠️ Alguns modais podem não funcionar corretamente', 'warning');
        }

        this.log('✅ Verificação de dependências concluída');
    }

    /**
     * ✅ CARREGAR MÓDULOS DE MODAIS
     */
    async carregarModais() {
        this.log('📂 Carregando módulos de modais...');

        // Definir módulos a serem carregados
        const modulos = [
            {
                nome: 'ModalClientesPCT',
                caminho: './modules/romaneiopct/modal-clientes-pct.js',
                global: 'ModalClientesPCT'
            },
            {
                nome: 'ModalEspeciesPCT',
                caminho: './modules/romaneiopct/modal-especies-pct.js',
                global: 'ModalEspeciesPCT'
            },
            {
                nome: 'ModalListaRomaneiosPCT',
                caminho: './modules/romaneiopct/modal-lista-romaneios-pct.js',
                global: 'ModalListaRomaneiosPCT'
            }
        ];

        // Carregar módulos
        for (const modulo of modulos) {
            try {
                this.log(`📁 Carregando ${modulo.nome}...`);
                
                // Carregar via script tag para garantir compatibilidade
                await this.carregarScript(modulo.caminho);
                
                // Verificar se o módulo foi carregado corretamente
                if (window[modulo.global]) {
                    this.modalModules[modulo.nome] = window[modulo.global];
                    this.log(`✅ ${modulo.nome} carregado com sucesso`);
                } else {
                    this.log(`⚠️ ${modulo.nome} não encontrado no escopo global`, 'warning');
                }
                
            } catch (error) {
                this.log(`❌ Erro ao carregar ${modulo.nome}: ${error.message}`, 'error');
            }
        }
    }

    /**
     * ✅ CARREGAR SCRIPT DINAMICAMENTE
     */
    async carregarScript(src) {
        return new Promise((resolve, reject) => {
            const normalizeSrc = (value) => {
                try {
                    const url = new URL(String(value || ''), document.baseURI);
                    return `${url.origin}${url.pathname}`;
                } catch (_) {
                    return String(value || '');
                }
            };
            const targetSrc = normalizeSrc(src);
            const existingScript = Array.from(document.querySelectorAll('script[src]')).find((scriptTag) => {
                const raw = scriptTag.getAttribute('src') || '';
                return normalizeSrc(raw) === targetSrc;
            });
            if (existingScript) {
                resolve();
                return;
            }

            const script = document.createElement('script');
            script.src = src;
            script.onload = resolve;
            script.onerror = () => reject(new Error(`Falha ao carregar script: ${src}`));
            document.head.appendChild(script);
        });
    }

    /**
     * ✅ CONFIGURAR EVENTOS GLOBAIS
     */
    configurarEventosGlobais() {
        this.log('⚙️ Configurando eventos globais...');
        if (window.__PCT_GLOBAL_MODAL_EVENTS_BOUND__) {
            this.log('⚠️ Eventos globais já configurados anteriormente', 'warning');
            return;
        }
        window.__PCT_GLOBAL_MODAL_EVENTS_BOUND__ = true;

        // Configurar eventos de fechamento global
        document.addEventListener('keydown', (event) => {
            if (event.key === 'Escape') {
                this.fecharTodosModais();
            }
        });

        // Configurar eventos de clique em overlay
        document.addEventListener('click', (event) => {
            if (event.target.classList.contains('modal') && 
                event.target.style.display === 'block') {
                this.log('🖱️ Clique em overlay detectado, fechando modal');
                event.target.style.display = 'none';
            }
        });

        this.log('✅ Eventos globais configurados');
    }

    /**
     * ✅ CONFIGURAR COMPATIBILIDADE SIMPLIFICADA
     * As funções agora são definidas elegantemente no HTML, sem necessidade de força bruta
     */
    configurarCompatibilidade() {
        this.log('🎯 Compatibilidade simplificada - funções definidas no HTML');
        
        // ✅ APENAS VERIFICAR se as funções estão disponíveis
        const funcoesEssenciais = ['openClientListModal', 'openSpeciesListModal', 'abrirListaRomaneios'];
        
        funcoesEssenciais.forEach(funcao => {
            if (typeof window[funcao] === 'function') {
                this.log(`✅ ${funcao} disponível`);
            } else {
                this.log(`⚠️ ${funcao} não encontrada`, 'warn');
            }
        });
        
        this.log('✅ Verificação de compatibilidade concluída');
    }

    /**
     * ✅ VERIFICAR SE FUNÇÕES GLOBAIS ESTÃO DISPONÍVEIS
     */
    verificarFuncoesGlobais() {
        this.log('🔍 Verificando funções globais...');
        
        const funcoes = ['openClientListModal', 'openSpeciesListModal', 'abrirListaRomaneios'];
        
        funcoes.forEach(nome => {
            if (typeof window[nome] === 'function') {
                this.log(`✅ ${nome} disponível`, 'success');
            } else {
                this.log(`❌ ${nome} NÃO disponível`, 'error');
            }
        });
    }

    /**
     * ✅ FECHAR TODOS OS MODAIS
     */
    fecharTodosModais() {
        this.log('🚪 Fechando todos os modais...');

        const modalIds = ['clientListModal', 'speciesListModal', 'listaModal', 'clientModal'];
        
        modalIds.forEach(modalId => {
            const modal = document.getElementById(modalId);
            if (modal && modal.style.display === 'block') {
                modal.style.display = 'none';
                this.log(`✅ Modal ${modalId} fechado`);
            }
        });
    }

    /**
     * ✅ VERIFICAR STATUS DOS MODAIS
     */
    verificarStatus() {
        this.log('📊 Status dos modais PCT:');
        
        Object.keys(this.modalModules).forEach(nome => {
            const status = this.modalModules[nome] ? '✅ Carregado' : '❌ Não carregado';
            this.log(`  ${nome}: ${status}`);
        });

        return {
            initialized: this.initialized,
            modules: Object.keys(this.modalModules),
            totalModules: Object.keys(this.modalModules).length
        };
    }

    /**
     * ✅ RECARREGAR TODOS OS MODAIS
     */
    async recarregarTodos() {
        this.log('🔄 Recarregando todos os modais...');

        const promessas = Object.values(this.modalModules)
            .filter(modal => modal && typeof modal.refresh === 'function')
            .map(modal => modal.refresh());

        try {
            await Promise.all(promessas);
            this.log('✅ Todos os modais recarregados com sucesso', 'success');
        } catch (error) {
            this.log(`❌ Erro ao recarregar modais: ${error.message}`, 'error');
        }
    }
}

// ✅ INSTÂNCIA GLOBAL
window.inicializadorModaisPCT = window.inicializadorModaisPCT || new InicializadorModaisPCT();

// ✅ INICIALIZAÇÃO AUTOMÁTICA
if (!window.__PCT_MODAL_AUTO_INIT_BOUND__) {
    window.__PCT_MODAL_AUTO_INIT_BOUND__ = true;
document.addEventListener('DOMContentLoaded', async () => {
    try {
        await window.inicializadorModaisPCT.inicializar();
    } catch (error) {
        console.error('❌ Erro na inicialização automática dos modais PCT:', error);
    }
});
}

// ✅ COMPATIBILIDADE: Função global para inicialização manual
window.inicializarModaisPCT = async () => {
    return await window.inicializadorModaisPCT.inicializar();
};

console.log('✅ Inicializador de Modais PCT carregado com sucesso');
