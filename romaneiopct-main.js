/**
 * 🚀 SISTEMA PRINCIPAL ROMANEIOPCT - UNIFICADO
 * 
 * Consolidado de: 
 * - romaneiopct_init.js (partes essenciais)
 * - correcao-navegacao-enter-pecasPorPacote.js (integrado)
 * - romaneiopct.js (funções auxiliares)
 * - Correções diversas aplicadas
 * 
 * Funcionalidades específicas PCT:
 * - Navegação Enter incluindo pecasPorPacote
 * - Inicialização otimizada
 * - Configuração de eventos
 * - Integração com sistemas unificados
 * 
 * Versão: 1.0 Unificada
 * Data: Dezembro 2024
 */

console.log('🚀 Sistema Principal Romaneiopct carregado');

// ========================================
// CONFIGURAÇÕES E VARIÁVEIS GLOBAIS
// ========================================

const ROMANEIOPCT_CONFIG = {
    version: '1.0.0',
    debug: true,
    autoSave: true,
    navigationTimeout: 100,
    fieldSequence: [
        'espessura', 'largura', 'price', 
        'comprimento', 'quantidade', 'pecasPorPacote' // ⚠️ ESPECÍFICO PCT
    ]
};

function resolveCompanyId() {
    try {
        const svc = window.firebaseService || window.firebaseServiceTL || window.FirebaseService;
        if (svc && typeof svc.getTenantId === 'function') {
            const t = svc.getTenantId();
            if (t) return String(t);
        }
    } catch (_) {}
    try {
        if (window.appTenantId) return String(window.appTenantId);
        if (window.companyInfo) {
            const raw = window.companyInfo;
            const id = raw.id || raw.companyId || raw.slug || raw.nome || raw.name;
            if (id) return String(id);
        }
        const stored = localStorage.getItem('company_info');
        if (stored) {
            const obj = JSON.parse(stored);
            const id = obj && (obj.id || obj.companyId || obj.slug || obj.nome || obj.name);
            if (id) return String(id);
        }
    } catch (_) {}
    return null;
}

function getLocalStorageKeys(key) {
    const keys = [];
    try {
        const base = String(key || '');
        if (!base) return keys;
        const svc = window.firebaseService || window.firebaseServiceTL || window.FirebaseService;
        if (svc && typeof svc.getNamespacedPath === 'function') {
            const ns = svc.getNamespacedPath(base);
            if (ns && ns !== base) {
                keys.push(ns);
                return [...new Set(keys)];
            }
        } else {
            const companyId = resolveCompanyId();
            if (companyId && !/^companies\//.test(base) && !/^users\//.test(base)) {
                keys.push(`companies/${companyId}/${base}`);
                return [...new Set(keys)];
            }
        }
    } catch (_) {}
    return [...new Set(keys)];
}

function readLocalStorageValue(key) {
    for (const k of getLocalStorageKeys(key)) {
        const val = localStorage.getItem(k);
        if (val) return val;
    }
    return null;
}

function removeLocalStorageValue(key) {
    for (const k of getLocalStorageKeys(key)) {
        localStorage.removeItem(k);
    }
}

// Controle de inicialização
let sistemaInicializado = false;
let navigationSetup = false;

// ========================================
// FUNÇÃO PRINCIPAL DE INICIALIZAÇÃO
// ========================================

async function inicializarSistemaPCT() {
    try {
        console.log('🔄 Iniciando Sistema Principal PCT...');
        
        // Evitar inicialização dupla
        if (sistemaInicializado) {
            console.log('⚠️ Sistema já inicializado');
            return true;
        }
        
        // ✅ AGUARDAR CARREGAMENTO COMPLETO
        await aguardarCarregamento();
        
        // ✅ INICIALIZAÇÃO POR ETAPAS
        const etapas = [
            { nome: 'Variáveis Globais', funcao: inicializarVariaveisGlobais },
            { nome: 'Navegação Enter PCT', funcao: setupNavegacaoEnterPCT },
            { nome: 'Event Listeners', funcao: configurarEventListeners },
            { nome: 'Interface', funcao: configurarInterface },
            { nome: 'Carregamento de Dados', funcao: carregarDadosIniciais },
            { nome: 'Estado Anterior', funcao: restaurarEstadoAnterior }
        ];
        
        for (const etapa of etapas) {
            try {
                console.log(`🔧 Executando: ${etapa.nome}`);
                await etapa.funcao();
                console.log(`✅ ${etapa.nome} - Concluído`);
            } catch (error) {
                console.error(`❌ Erro em ${etapa.nome}:`, error);
                // Continuar com as próximas etapas mesmo se uma falhar
            }
        }
        
        sistemaInicializado = true;
        console.log('🎉 Sistema Principal PCT inicializado com sucesso!');
        
        return true;
        
    } catch (error) {
        console.error('❌ Erro na inicialização do sistema PCT:', error);
        return false;
    }
}

// ========================================
// FUNÇÕES DE INICIALIZAÇÃO
// ========================================

function aguardarCarregamento() {
    return new Promise((resolve) => {
        if (document.readyState === 'complete') {
            resolve();
        } else {
            window.addEventListener('load', resolve);
        }
    });
}

function inicializarVariaveisGlobais() {
    console.log('🔧 Inicializando variáveis globais PCT');
    
    // ✅ ARRAYS PRINCIPAIS
    if (!window.romaneioItems) window.romaneioItems = [];
    if (!window.clientes) window.clientes = [];
    if (!window.especies) window.especies = [];
    
    // ✅ SELEÇÕES ATUAIS
    if (!window.selectedClient) window.selectedClient = null;
    if (!window.selectedSpecies) window.selectedSpecies = null;
    
    // ✅ CONTROLES DE ESTADO
    if (!window.itemEmEdicao) window.itemEmEdicao = false;
    if (!window.romaneioEmEdicao) window.romaneioEmEdicao = null;
    
    // ✅ CONTROLES DE PROCESSO
    window.isAddingItem = false;
    window.isSavingRomaneio = false;
    window.isNavigating = false;
    
    // ✅ PAGINAÇÃO
    window.currentPage = 1;
    window.itemsPerPage = 5;  // ✅ PADRONIZADO: 5 itens por página (tabela de itens)
    
    console.log('✅ Variáveis globais inicializadas');
}

// ========================================
// NAVEGAÇÃO ENTER ESPECÍFICA PCT
// ========================================

function setupNavegacaoEnterPCT() {
    console.log('⌨️ Configurando navegação Enter PCT específica');
    
    if (navigationSetup) {
        console.log('⚠️ Navegação já configurada');
        return;
    }
    
    try {
        const sequence = ROMANEIOPCT_CONFIG.fieldSequence;
        console.log('📋 Sequência de campos PCT:', sequence);
        
        // ✅ REMOVER LISTENERS EXISTENTES PARA EVITAR DUPLICAÇÃO
        sequence.forEach(fieldId => {
            const field = document.getElementById(fieldId);
            if (field) {
                // Clonar elemento para remover todos os listeners
                const newField = field.cloneNode(true);
                field.parentNode.replaceChild(newField, field);
            }
        });
        
        // ✅ CONFIGURAR NAVEGAÇÃO PARA CADA CAMPO
        sequence.forEach((fieldId, index) => {
            const field = document.getElementById(fieldId);
            if (!field) {
                console.warn(`⚠️ Campo ${fieldId} não encontrado`);
                return;
            }
            
            field.addEventListener('keydown', function(event) {
                if (event.key === 'Enter') {
                    event.preventDefault();
                    event.stopPropagation();
                    event.stopImmediatePropagation();
                    
                    // Evitar processamento múltiplo
                    if (window.isNavigating) return;
                    window.isNavigating = true;
                    
                    setTimeout(() => {
                        window.isNavigating = false;
                    }, ROMANEIOPCT_CONFIG.navigationTimeout);
                    
                    console.log(`⌨️ Enter detectado em: ${fieldId}`);
                    
                    // ✅ LÓGICA ESPECÍFICA PCT - ADICIONAR ITEM COM ENTER
                    if (fieldId === 'quantidade' || fieldId === 'pecasPorPacote') {
                        // ✅ CAMPOS QUE PODEM ADICIONAR ITEM: quantidade ou pecasPorPacote
                        console.log(`🎯 Campo '${fieldId}' - adicionando item PCT`);
                        
                        // Validar campo pecasPorPacote se for o caso
                        if (fieldId === 'pecasPorPacote') {
                            const valor = parseInt(field.value);
                            if (isNaN(valor) || valor <= 0) {
                                field.value = '1';
                                console.log('🔧 Valor de pecasPorPacote corrigido para 1');
                            }
                        }
                        
                        // Validar campo quantidade se for o caso
                        if (fieldId === 'quantidade') {
                            const valor = parseInt(field.value);
                            if (isNaN(valor) || valor <= 0) {
                                console.warn('⚠️ Quantidade inválida - não adicionando item');
                                return;
                            }
                        }
                        
                        // Chamar função adicionarItem se disponível
                        if (typeof window.adicionarItem === 'function') {
                            window.adicionarItem();
                            console.log('✅ Item adicionado com sucesso');
                            
                            // ✅ RETORNAR FOCO PARA CAMPO COMPRIMENTO APÓS ADICIONAR ITEM
                            setTimeout(() => {
                                const campoComprimento = document.getElementById('comprimento');
                                if (campoComprimento) {
                                    campoComprimento.focus();
                                    // ✅ CORREÇÃO: Não selecionar texto automaticamente para evitar apagar acidentalmente
                                    console.log('🔄 Foco retornado para comprimento para novo item');
                                }
                            }, 150); // Delay para permitir que a adição seja concluída
                            
                        } else if (typeof adicionarItem === 'function') {
                            adicionarItem();
                            console.log('✅ Item adicionado com sucesso');
                            
                            // ✅ RETORNAR FOCO PARA CAMPO COMPRIMENTO APÓS ADICIONAR ITEM  
                            setTimeout(() => {
                                const campoComprimento = document.getElementById('comprimento');
                                if (campoComprimento) {
                                    campoComprimento.focus();
                                    // ✅ CORREÇÃO: Não selecionar texto automaticamente para evitar apagar acidentalmente
                                    console.log('🔄 Foco retornado para comprimento para novo item');
                                }
                            }, 150);
                            
                        } else {
                            console.error('❌ Função adicionarItem não encontrada');
                            alert('Erro: Função adicionarItem não disponível');
                        }
                    } else {
                        // ✅ NAVEGAR PARA PRÓXIMO CAMPO
                        const nextIndex = index + 1;
                        if (nextIndex < sequence.length) {
                            const nextFieldId = sequence[nextIndex];
                            const nextField = document.getElementById(nextFieldId);
                            
                            if (nextField) {
                                console.log(`➡️ Navegando para: ${nextFieldId}`);
                                nextField.focus();
                                
                                // ✅ SELECIONAR TEXTO APENAS PARA CAMPOS ESPECÍFICOS (evitar seleção no comprimento)
                                if (['espessura', 'largura', 'quantidade', 'pecasPorPacote'].includes(nextFieldId)) {
                                    nextField.select();
                                }
                                // ✅ COMPRIMENTO: apenas focar sem selecionar para evitar apagar dados
                                if (nextFieldId === 'comprimento') {
                                    // Apenas focar, não selecionar
                                    console.log('🎯 Foco no comprimento sem seleção automática');
                                }
                            } else {
                                console.warn(`⚠️ Próximo campo ${nextFieldId} não encontrado`);
                            }
                        }
                    }
                }
            });
            
            // ✅ CONFIGURAR VALIDAÇÃO ESPECÍFICA PARA PECASPORPACOTE
            if (fieldId === 'pecasPorPacote') {
                field.addEventListener('blur', function() {
                    const valor = parseInt(field.value);
                    if (isNaN(valor) || valor <= 0) {
                        field.value = '1';
                        console.log('🔧 Valor de pecasPorPacote corrigido para 1 (blur)');
                    }
                });
                
                field.addEventListener('input', function() {
                    const valor = parseInt(field.value);
                    if (field.value && (isNaN(valor) || valor <= 0)) {
                        // Não limpar durante digitação, apenas marcar como inválido
                        field.style.borderColor = '#ff4444';
                    } else {
                        field.style.borderColor = '';
                    }
                });
            }
            
            console.log(`✅ Navegação configurada para ${fieldId}`);
        });
        
        navigationSetup = true;
        console.log('🎯 Navegação Enter PCT configurada com sucesso');
        
    } catch (error) {
        console.error('❌ Erro ao configurar navegação Enter:', error);
    }
}

// ========================================
// CONFIGURAÇÃO DE EVENT LISTENERS
// ========================================

function configurarEventListeners() {
    console.log('🔧 Configurando event listeners gerais');
    
    // ✅ BOTÕES PRINCIPAIS
    const botoes = {
        btnAdicionarItem: 'adicionarItem',
        btnSalvarRomaneio: 'salvarRomaneio', 
        btnLimparFormulario: 'limparFormulario',
        btnNovoCliente: 'openNewClientModal',
        btnListaClientes: 'openClientListModal',
        btnNovaEspecie: 'openNewSpeciesModal',
        btnListaEspecies: 'openSpeciesListModal',
        btnListaRomaneios: 'abrirListaRomaneios'
    };
    
    Object.entries(botoes).forEach(([btnId, funcaoNome]) => {
        const botao = document.getElementById(btnId);
        if (botao && typeof window[funcaoNome] === 'function') {
            botao.addEventListener('click', function(e) {
                e.preventDefault();
                console.log(`🔘 Botão ${btnId} clicado`);
                window[funcaoNome]();
            });
            console.log(`✅ Event listener configurado para ${btnId}`);
        }
    });
    
    // ✅ CONFIGURAR VALIDAÇÕES DE CAMPOS NUMÉRICOS - CORRIGIDO
    const camposNumericos = ['espessura', 'largura', 'quantidade', 'pecasPorPacote'];
    camposNumericos.forEach(campoId => {
        const campo = document.getElementById(campoId);
        if (campo) {
            campo.addEventListener('input', function() {
                // Permitir apenas números e vírgulas/pontos
                this.value = this.value.replace(/[^0-9.,]/g, '');
            });
        }
    });
    
    // ✅ CONFIGURAÇÃO ESPECÍFICA PARA COMPRIMENTO (sem formatação restritiva)
    const campoComprimento = document.getElementById('comprimento');
    if (campoComprimento) {
        // Permitir apenas números, vírgulas e pontos durante digitação
        campoComprimento.addEventListener('input', function() {
            // Permitir apenas números, vírgula e ponto
            let valor = this.value.replace(/[^0-9.,]/g, '');
            
            // Permitir apenas uma vírgula ou ponto
            const matches = valor.match(/[.,]/g);
            if (matches && matches.length > 1) {
                // Manter apenas o primeiro separador decimal
                const firstSeparator = valor.indexOf(',') !== -1 ? ',' : '.';
                const parts = valor.split(/[.,]/);
                valor = parts[0] + firstSeparator + parts.slice(1).join('');
            }
            
            this.value = valor;
        });
        
        // Validação suave no blur, sem interferir na digitação
        campoComprimento.addEventListener('blur', function() {
            if (!this.value.trim()) return; // Se vazio, não validar
            
            const valor = parseFloat(this.value.replace(',', '.'));
            if (isNaN(valor) || valor <= 0) {
                this.style.borderColor = '#ff4444';
                this.title = 'Digite um valor válido (ex: 350 ou 350,5)';
                console.warn('⚠️ Valor inválido no campo comprimento:', this.value);
            } else {
                this.style.borderColor = '';
                this.title = 'Comprimento em centímetros';
                console.log('✅ Comprimento válido:', valor);
            }
        });
        
        console.log('✅ Campo comprimento configurado sem formatação restritiva');
    }
    
    // ✅ CONFIGURAR FORMATAÇÃO DE PREÇO
    const campoPreco = document.getElementById('price');
    if (campoPreco && typeof window.formatCurrencyInput === 'function') {
        campoPreco.addEventListener('input', function() {
            window.formatCurrencyInput(this);
        });
    }
    
    // ✅ CONFIGURAR AUTOCOMPLETAR CLIENTES
    const campoCliente = document.getElementById('clienteInput');
    if (campoCliente && typeof window.showClientSuggestions === 'function') {
        campoCliente.addEventListener('input', function() {
            window.showClientSuggestions(this);
        });
        campoCliente.addEventListener('blur', function(){
            const v = String(this.value || '').trim();
            if (!v) return;
            if (window.isAllCaps && window.toTitleCasePt && window.isAllCaps(v)) {
                this.value = window.toTitleCasePt(v);
            }
        });
    }
    
    // ✅ CONFIGURAR AUTOCOMPLETAR ESPÉCIES
    const campoEspecie = document.getElementById('especieInput');
    if (campoEspecie && typeof window.showSpeciesSuggestions === 'function') {
        campoEspecie.addEventListener('input', function() {
            window.showSpeciesSuggestions(this);
        });
        campoEspecie.addEventListener('blur', function(){
            const v = String(this.value || '').trim();
            if (!v) return;
            if (window.isAllCaps && window.toTitleCasePt && window.isAllCaps(v)) {
                this.value = window.toTitleCasePt(v);
            }
        });
    }

    window.addEventListener('clients:updated', async function() {
        try {
            if (window.clientService && typeof window.clientService.getClients === 'function') {
                const clientes = await window.clientService.getClients(true);
                window.clientes = clientes || [];
                console.log(`✅ ${window.clientes.length} clientes recarregados via clientService`);
            } else if (typeof window.getData === 'function') {
                const clientes = await window.getData('clients');
                window.clientes = clientes || [];
                console.log(`✅ ${window.clientes.length} clientes recarregados via getData`);
            }
        } catch (error) {
            console.warn('⚠️ Erro ao recarregar clientes após atualização:', error);
        }
    });
    
    console.log('✅ Event listeners configurados');
}

// ========================================
// CONFIGURAÇÃO DE INTERFACE
// ========================================

function configurarInterface() {
    console.log('🎨 Configurando interface PCT');
    
    try {
        // ✅ CONFIGURAR VALORES PADRÃO
        const campoPecasPorPacote = document.getElementById('pecasPorPacote');
        if (campoPecasPorPacote && !campoPecasPorPacote.value) {
            campoPecasPorPacote.value = '1';
            console.log('✅ Valor padrão definido para pecasPorPacote: 1');
        }
        
        // ✅ CONFIGURAR PLACEHOLDERS
        const placeholders = {
            'espessura': 'Ex: 5,0',
            'largura': 'Ex: 20,0', 
            'comprimento': 'Ex: 300',
            'quantidade': 'Ex: 10',
            'pecasPorPacote': '1',
            'price': 'R$ 0,00'
        };
        
        Object.entries(placeholders).forEach(([campoId, placeholder]) => {
            const campo = document.getElementById(campoId);
            if (campo && !campo.placeholder) {
                campo.placeholder = placeholder;
            }
        });
        
        // ✅ CONFIGURAR TOOLTIPS ESPECÍFICOS PCT
        const tooltips = {
            'pecasPorPacote': 'Quantidade de peças por pacote (específico PCT)',
            'quantidade': 'Quantidade de pacotes',
            'espessura': 'Espessura em centímetros',
            'largura': 'Largura em centímetros',
            'comprimento': 'Comprimento em centímetros'
        };
        
        Object.entries(tooltips).forEach(([campoId, tooltip]) => {
            const campo = document.getElementById(campoId);
            if (campo) {
                campo.title = tooltip;
            }
        });
        
        // ✅ CONFIGURAR FOCO INICIAL
        const primeiroCampo = document.getElementById('espessura');
        if (primeiroCampo) {
            setTimeout(() => primeiroCampo.focus(), 500);
        }
        
        console.log('✅ Interface configurada');
        
    } catch (error) {
        console.error('❌ Erro ao configurar interface:', error);
    }
}

// ========================================
// CARREGAMENTO DE DADOS INICIAIS
// ========================================

async function carregarDadosIniciais() {
    console.log('📊 Carregando dados iniciais PCT');
    
    try {
        // ✅ TENTAR USAR FUNÇÃO getData UNIFICADA
        if (window.clientService && typeof window.clientService.getClients === 'function') {
            try {
                const clientes = await window.clientService.getClients(false);
                window.clientes = clientes || [];
                console.log(`✅ ${window.clientes.length} clientes carregados via clientService`);
            } catch (error) {
                console.warn('⚠️ Erro ao carregar clientes via clientService:', error);
                window.clientes = [];
            }
        } else if (typeof window.getData === 'function') {
            console.log('📦 Usando getData unificada para carregar dados');
            
            try {
                const clientes = await window.getData('clients');
                window.clientes = clientes || [];
                console.log(`✅ ${window.clientes.length} clientes carregados`);
            } catch (error) {
                console.warn('⚠️ Erro ao carregar clientes:', error);
                window.clientes = [];
            }
        } else {
            // ✅ FALLBACK PARA LOCALSTORAGE
            console.log('📦 Usando fallback localStorage');
            
            window.clientes = JSON.parse(readLocalStorageValue('clients') || '[]');
            window.especies = JSON.parse(readLocalStorageValue('especies') || '[]');
            
            console.log(`📦 Fallback: ${window.clientes.length} clientes, ${window.especies.length} espécies`);
        }

        if (typeof window.getData === 'function') {
            try {
                const especies = await window.getData('especies');
                window.especies = especies || [];
                console.log(`✅ ${window.especies.length} espécies carregadas`);
            } catch (error) {
                console.warn('⚠️ Erro ao carregar espécies:', error);
                window.especies = [];
            }
        } else if (!Array.isArray(window.especies)) {
            window.especies = JSON.parse(readLocalStorageValue('especies') || '[]');
            console.log(`📦 Fallback espécies: ${window.especies.length} itens`);
        }
        
        console.log('✅ Dados iniciais carregados');
        
    } catch (error) {
        console.error('❌ Erro ao carregar dados iniciais:', error);
        
        // ✅ FALLBACK FINAL
        window.clientes = [];
        window.especies = [];
    }
}

// ========================================
// RESTAURAÇÃO DE ESTADO ANTERIOR
// ========================================

async function restaurarEstadoAnterior() {
    console.log('🔄 Restaurando estado anterior');
    
    try {
        // ✅ VERIFICAR SE HÁ ESTADO SALVO
        const estadoSalvo = readLocalStorageValue('romaneioEmEdicaoPct');
        if (!estadoSalvo) {
            console.log('💭 Nenhum estado anterior encontrado');
            return;
        }
        
        const estado = JSON.parse(estadoSalvo);
        console.log('📋 Estado anterior encontrado:', {
            itens: estado.itens?.length || 0,
            cliente: estado.cliente?.nome || 'N/A',
            timestamp: new Date(estado.timestamp).toLocaleString()
        });
        
        // ✅ PERGUNTAR AO USUÁRIO SE QUER RESTAURAR
        if (confirm('Foi encontrado um romaneio em edição anterior. Deseja continuar editando?')) {
            
            // Restaurar itens
            if (estado.itens && Array.isArray(estado.itens)) {
                window.romaneioItems = estado.itens;
                console.log(`✅ ${estado.itens.length} itens restaurados`);
            }
            
            // Restaurar cliente
            if (estado.cliente) {
                window.selectedClient = estado.cliente;
                const campoCliente = document.getElementById('clienteInput');
                if (campoCliente) {
                    campoCliente.value = estado.cliente.nome || estado.cliente.name || '';
                }
                console.log(`✅ Cliente restaurado: ${estado.cliente.nome || estado.cliente.name}`);
            }
            
            // Restaurar estado de edição
            if (estado.romaneioEmEdicao) {
                window.romaneioEmEdicao = estado.romaneioEmEdicao;
                console.log('✅ Modo de edição restaurado');
            }
            
            // ✅ ATUALIZAR INTERFACE
            if (typeof window.reconstruirTabela === 'function') {
                window.reconstruirTabela();
            }
            
            if (typeof window.atualizarTotais === 'function') {
                window.atualizarTotais();
            }
            
            console.log('✅ Estado anterior restaurado com sucesso');
            
        } else {
            // Limpar estado salvo se usuário não quiser restaurar
            removeLocalStorageValue('romaneioEmEdicaoPct');
            console.log('🧹 Estado anterior removido por solicitação do usuário');
        }
        
    } catch (error) {
        console.error('❌ Erro ao restaurar estado anterior:', error);
        // Limpar estado corrompido
        removeLocalStorageValue('romaneioEmEdicaoPct');
    }
}

// ========================================
// FUNÇÕES AUXILIARES
// ========================================

function validarSistemaPCT() {
    console.log('🔍 Validando sistema PCT');
    
    const validacoes = [
        {
            nome: 'Campo pecasPorPacote',
            teste: () => !!document.getElementById('pecasPorPacote')
        },
        {
            nome: 'Navegação Enter configurada', 
            teste: () => navigationSetup
        },
        {
            nome: 'Função adicionarItem',
            teste: () => typeof window.adicionarItem === 'function'
        },
        {
            nome: 'Função salvarRomaneio',
            teste: () => typeof window.salvarRomaneio === 'function'
        },
        {
            nome: 'Arrays globais inicializados',
            teste: () => Array.isArray(window.romaneioItems)
        }
    ];
    
    const resultados = validacoes.map(validacao => {
        const passou = validacao.teste();
        console.log(`${passou ? '✅' : '❌'} ${validacao.nome}: ${passou ? 'OK' : 'FALHOU'}`);
        return passou;
    });
    
    const sucessos = resultados.filter(r => r).length;
    console.log(`📊 Validação: ${sucessos}/${validacoes.length} testes passaram`);
    
    return sucessos === validacoes.length;
}

function obterStatusSistema() {
    return {
        inicializado: sistemaInicializado,
        navegacaoConfigurada: navigationSetup,
        itensCarregados: window.romaneioItems?.length || 0,
        clienteSelecionado: !!window.selectedClient,
        especieSelecionada: !!window.selectedSpecies,
        versao: ROMANEIOPCT_CONFIG.version
    };
}

// ========================================
// EXPOSIÇÃO GLOBAL
// ========================================

// ✅ EXPOR FUNÇÕES PRINCIPAIS
window.inicializarSistemaPCT = inicializarSistemaPCT;
window.setupNavegacaoEnterPCT = setupNavegacaoEnterPCT;
window.validarSistemaPCT = validarSistemaPCT;
window.obterStatusSistema = obterStatusSistema;

// ✅ EXPOR CONFIGURAÇÕES
window.ROMANEIOPCT_CONFIG = ROMANEIOPCT_CONFIG;

// ========================================
// AUTO-INICIALIZAÇÃO
// ========================================

// ✅ INICIALIZAR AUTOMATICAMENTE QUANDO DOCUMENTO ESTIVER PRONTO
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', inicializarSistemaPCT);
} else {
    // Documento já carregado, inicializar imediatamente
    setTimeout(inicializarSistemaPCT, 100);
}

console.log('✅ Sistema Principal Romaneiopct carregado e configurado para auto-inicialização');
