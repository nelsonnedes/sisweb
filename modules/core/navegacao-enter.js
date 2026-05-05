/**
 * 🚀 MÓDULO: Navegação com Tecla Enter - Romaneio TL
 * 
 * Responsabilidades:
 * - Configurar navegação entre campos com Enter
 * - Gerenciar foco dos elementos
 * - Integração com adição de itens
 * 
 * ✅ ESTRUTURA MODULAR: Seguindo romaneiotl-estruturaçãomodular.txt
 * ✅ BASEADO NO ORIGINAL: Funcionalidades do romaneiotl.js original
 */

window.NavegacaoEnter = (function() {
    'use strict';
    const legacyKey = ['b','i','t','o','l','a'].join('');

    // ✅ CONFIGURAÇÕES
    const CONFIG = {
        elementos: {
            especie: 'especieInput',
            espessura: 'espessura',
            price: 'price',
            comprimento: 'comprimento',
            largura: 'largura',
            quantidade: 'quantidade',
            btnAdicionar: 'addButton'
        },
        // Ordem de navegação: espécie → espessura → preço → comprimento → largura (adicionar) → quantidade (adicionar)
        ordemNavegacao: ['especie', 'espessura', 'price', 'comprimento', 'largura', 'quantidade']
    };

    // ✅ ESTADO
    let eventosConfigurados = false;

    /**
     * ✅ CONFIGURAR NAVEGAÇÃO COM ENTER
     */
    function configurarNavegacao() {
        console.log('🚀 Configurando navegação com tecla Enter...');

        // Verificar se elementos existem
        const elementos = obterElementos();
        const elementosEncontrados = Object.keys(elementos).filter(key => elementos[key]);
        
        console.log(`📋 Elementos encontrados: ${elementosEncontrados.join(', ')}`);
        
        if (elementosEncontrados.length === 0) {
            console.warn('⚠️ Nenhum elemento encontrado para navegação');
            return false;
        }

        // Remover eventos anteriores para evitar duplicação
        removerEventosAnteriores(elementos);

        // Configurar eventos para cada elemento
        configurarEventos(elementos);

        eventosConfigurados = true;
        console.log('✅ Navegação com Enter configurada com sucesso');
        return true;
    }

    /**
     * ✅ OBTER ELEMENTOS DO DOM
     */
    function obterElementos() {
        const elementos = {};
        
        Object.entries(CONFIG.elementos).forEach(([nome, id]) => {
            const elemento = (nome === 'espessura')
                ? (document.getElementById(id) || document.getElementById(legacyKey))
                : document.getElementById(id);
            elementos[nome] = elemento;
            
            if (elemento) {
                console.log(`✅ Elemento '${nome}' (${id}) encontrado`);
            } else {
                console.warn(`⚠️ Elemento '${nome}' (${id}) não encontrado`);
            }
        });

        // Log de debug para verificar todos os elementos
        console.log('🔍 DEBUG - Elementos encontrados:', {
            especie: !!elementos.especie,
            espessura: !!elementos.espessura,
            price: !!elementos.price,
            comprimento: !!elementos.comprimento,
            largura: !!elementos.largura,
            quantidade: !!elementos.quantidade,
            btnAdicionar: !!elementos.btnAdicionar
        });

        return elementos;
    }

    /**
     * ✅ REMOVER EVENTOS ANTERIORES
     */
    function removerEventosAnteriores(elementos) {
        // Não clonar elementos para preservar outros event listeners (formatação, etc.)
        // Os novos event listeners irão sobrescrever os antigos automaticamente
        console.log('🔄 Preparando para reconfigurar eventos de navegação...');
    }

    /**
     * ✅ CONFIGURAR EVENTOS DE TECLADO
     */
    function configurarEventos(elementos) {
        console.log('⚙️ Configurando eventos de navegação...');
        
        CONFIG.ordemNavegacao.forEach((nomeAtual, index) => {
            const elementoAtual = elementos[nomeAtual];
            if (!elementoAtual) {
                console.warn(`⚠️ Elemento '${nomeAtual}' não encontrado para configurar evento`);
                return;
            }

            // Remover event listener anterior se existir
            if (elementoAtual._navegacaoEnterListener) {
                elementoAtual.removeEventListener('keydown', elementoAtual._navegacaoEnterListener);
            }

            // Criar novo event listener
            const navegacaoListener = function(e) {
                if (e.key === 'Enter') {
                    e.preventDefault();
                    console.log(`🔑 Enter pressionado em '${nomeAtual}'`);
                    
                    // Verificar se é um campo que deve adicionar item
                    if (nomeAtual === 'largura' || nomeAtual === 'quantidade') {
                        console.log(`➕ Campo '${nomeAtual}' - adicionando item`);
                        adicionarItemEFocar(elementos);
                        return;
                    }
                    
                    // Determinar próximo elemento
                    const proximoIndex = index + 1;
                    
                    if (proximoIndex < CONFIG.ordemNavegacao.length) {
                        // Navegar para próximo campo
                        const proximoNome = CONFIG.ordemNavegacao[proximoIndex];
                        const proximoElemento = elementos[proximoNome];
                        
                        if (proximoElemento) {
                            console.log(`➡️ Navegando para '${proximoNome}'`);
                            proximoElemento.focus();
                            if (proximoElemento.select) proximoElemento.select();
                        } else {
                            console.warn(`⚠️ Próximo elemento '${proximoNome}' não encontrado`);
                        }
                    } else {
                        // Último campo - adicionar item
                        console.log('➕ Último campo - adicionando item');
                        adicionarItemEFocar(elementos);
                    }
                }
            };

            // Adicionar event listener e salvar referência
            elementoAtual.addEventListener('keydown', navegacaoListener);
            elementoAtual._navegacaoEnterListener = navegacaoListener;
            
            console.log(`✅ Evento configurado para '${nomeAtual}'`);
        });

        // Configurar botão adicionar
        if (elementos.btnAdicionar) {
            // Remover event listener anterior se existir
            if (elementos.btnAdicionar._navegacaoClickListener) {
                elementos.btnAdicionar.removeEventListener('click', elementos.btnAdicionar._navegacaoClickListener);
            }

            const clickListener = function(e) {
                e.preventDefault();
                console.log('🖱️ Botão adicionar clicado');
                adicionarItemEFocar(elementos);
            };

            elementos.btnAdicionar.addEventListener('click', clickListener);
            elementos.btnAdicionar._navegacaoClickListener = clickListener;
            
            console.log('✅ Evento click configurado para botão adicionar');
        } else {
            console.warn('⚠️ Botão adicionar não encontrado');
        }
    }

    /**
     * ✅ ADICIONAR ITEM E FOCAR NO PRIMEIRO CAMPO
     */
    function adicionarItemEFocar(elementos) {
        try {
            console.log('🎯 Iniciando adicionarItemEFocar...');
            
            // Chamar função de adicionar item através do wrapper robusto
            if (typeof window.chamarAdicionarItem === 'function') {
                console.log('📞 Chamando window.chamarAdicionarItem() (wrapper robusto)');
                window.chamarAdicionarItem();
            } else if (window.AdicionarItem && typeof window.AdicionarItem.adicionarItem === 'function') {
                console.log('📞 Fallback: Chamando window.AdicionarItem.adicionarItem()');
                window.AdicionarItem.adicionarItem();
            } else if (typeof window.adicionarItem === 'function') {
                console.log('📞 Fallback: Chamando window.adicionarItem()');
                window.adicionarItem();
            } else {
                console.error('❌ Nenhuma função adicionarItem encontrada');
                return;
            }

            // Focar no campo comprimento após adicionar (conforme sistema original)
            // Aguardar mais tempo para garantir que o item foi adicionado e campos limpos
            setTimeout(() => {
                const comprimentoElemento = elementos['comprimento'];
                if (comprimentoElemento) {
                    comprimentoElemento.focus();
                    console.log(`🎯 Foco retornado para 'comprimento' (conforme sistema original)`);
                } else {
                    // Fallback para primeiro campo se comprimento não estiver disponível
                    const primeiroElemento = elementos[CONFIG.ordemNavegacao[0]];
                    if (primeiroElemento) {
                        primeiroElemento.focus();
                        console.log(`🎯 Foco retornado para '${CONFIG.ordemNavegacao[0]}' (fallback)`);
                    } else {
                        console.warn('⚠️ Nenhum elemento disponível para focar');
                    }
                }
            }, 150); // Aumentado de 100ms para 150ms

        } catch (error) {
            console.error('❌ Erro ao adicionar item:', error);
        }
    }

    /**
     * ✅ RECONFIGURAR NAVEGAÇÃO (para uso após mudanças no DOM)
     */
    function reconfigurar() {
        console.log('🔄 Reconfigurando navegação Enter...');
        eventosConfigurados = false;
        return configurarNavegacao();
    }

    /**
     * ✅ VERIFICAR SE NAVEGAÇÃO ESTÁ CONFIGURADA
     */
    function estaConfigurado() {
        return eventosConfigurados;
    }

    /**
     * ✅ FOCAR NO PRIMEIRO CAMPO (comprimento, conforme sistema original)
     */
    function focarPrimeiroCampo() {
        const elementos = obterElementos();
        
        // Focar no campo comprimento (conforme sistema original)
        const comprimentoElemento = elementos['comprimento'];
        if (comprimentoElemento) {
            comprimentoElemento.focus();
            console.log(`🎯 Foco definido para 'comprimento' (conforme sistema original)`);
            return true;
        }
        
        // Fallback para primeiro campo da ordem de navegação
        const primeiroElemento = elementos[CONFIG.ordemNavegacao[0]];
        if (primeiroElemento) {
            primeiroElemento.focus();
            console.log(`🎯 Foco definido para '${CONFIG.ordemNavegacao[0]}' (fallback)`);
            return true;
        }
        
        console.warn('⚠️ Nenhum campo encontrado para foco');
        return false;
    }

    /**
     * ✅ TESTAR NAVEGAÇÃO (função de debug)
     */
    function testarNavegacao() {
        console.log('🧪 Testando navegação Enter...');
        
        const elementos = obterElementos();
        const elementosValidos = Object.keys(elementos).filter(key => elementos[key]);
        
        console.log(`📊 Resultado do teste:`);
        console.log(`- Elementos válidos: ${elementosValidos.length}/7`);
        console.log(`- Eventos configurados: ${eventosConfigurados}`);
        console.log(`- Elementos válidos:`, elementosValidos);
        
        if (elementosValidos.length === 0) {
            console.error('❌ ERRO: Nenhum elemento encontrado para navegação!');
            return false;
        }
        
        if (!eventosConfigurados) {
            console.warn('⚠️ AVISO: Eventos não foram configurados ainda');
            return false;
        }
        
        console.log('✅ Navegação parece estar configurada corretamente');
        return true;
    }

    /**
     * ✅ INICIALIZAR AUTOMATICAMENTE QUANDO DOM ESTIVER PRONTO
     */
    function inicializar() {
        console.log('🚀 Inicializando módulo NavegacaoEnter...');
        
        if (document.readyState === 'loading') {
            document.addEventListener('DOMContentLoaded', () => {
                setTimeout(configurarNavegacao, 200);
            });
        } else {
            // DOM já carregado - aguardar um pouco mais para outros módulos
            setTimeout(configurarNavegacao, 300);
        }
    }

    // ✅ INTERFACE PÚBLICA
    return {
        configurar: configurarNavegacao,
        reconfigurar,
        estaConfigurado,
        focarPrimeiroCampo,
        inicializar,
        testar: testarNavegacao
    };

})();

// ✅ FUNÇÕES GLOBAIS PARA COMPATIBILIDADE
window.configureEnterKeyNavigation = window.NavegacaoEnter.configurar;
window.repararNavegacaoEnter = window.NavegacaoEnter.reconfigurar;
window.testarNavegacaoEnter = window.NavegacaoEnter.testar; // Função de teste

// ✅ INICIALIZAR AUTOMATICAMENTE
window.NavegacaoEnter.inicializar();

console.log('✅ Módulo NavegacaoEnter carregado com sucesso');
console.log('🧪 Para testar a navegação, digite: testarNavegacaoEnter() no console'); 
