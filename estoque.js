/**
 * Sistema de Estoque de Toras - JavaScript
 * Controle de entrada, saída e consulta de estoque de toras
 */

// Variáveis globais
function parseDateLocalSafe(str) {
    if (window.parseDateLocal) return window.parseDateLocal(str);
    if (!str) return null;
    if (str instanceof Date) return str;
    let s = String(str).trim();
    const m1 = s.match(/^(\d{4})-(\d{2})-(\d{2})/);
    if (m1) return new Date(parseInt(m1[1],10), parseInt(m1[2],10)-1, parseInt(m1[3],10));
    return new Date(s);
}

let estoqueAtual = [];
let movimentacoes = [];
let fornecedores = [];
let torasSelecionadasBaixa = [];
let torasSelecionadasModal = [];
let itensEntrada = []; // Itens temporários para entrada
let romaneiosDisponiveis = []; // Cache de romaneios
let romaneioSelecionadoId = null; // ID do romaneio selecionado
let romaneiosSaidaDisponiveis = [];
let romaneiosSaidaSelecionados = [];
let paginaAtualEntrada = 1;
const itensPorPagina = 10;
let paginaAtualSaida = 1;
let paginaAtualEstoque = 1;
let paginaAtualMovimentacoes = 1;
let paginaAtualComprasMov = 1;
let estoqueFiltrado = [];
let movimentacoesFiltradas = [];
let comprasMovFiltrados = [];
let filtroEstoqueAtual = {};
let filtroMovimentacoesAtual = {};
let filtroComprasMovAtual = {};
let toraEmEdicao = null;
let saidaModo = 'lote';
let toraEncontradaBaixa = null;
let resumoMovimentacoesSeq = 0;
const resumoMovimentacoesCache = new Map();
let filtrosTorasModalState = { especie: '', rodo: '', comprimento: '' };
let estoqueRuntimeState = { mode: 'ok', message: '' };

function logEstoqueEvent(scope, message, extra = null, level = 'info') {
    const stamp = new Date().toISOString();
    const payload = { stamp, scope, message, extra };
    try {
        if (level === 'error') console.error('[ESTOQUE]', payload);
        else if (level === 'warn') console.warn('[ESTOQUE]', payload);
        else console.info('[ESTOQUE]', payload);
    } catch (_) {}
    try {
        const key = 'estoque_runtime_logs';
        const prev = JSON.parse(localStorage.getItem(key) || '[]');
        prev.push(payload);
        if (prev.length > 200) prev.splice(0, prev.length - 200);
        localStorage.setItem(key, JSON.stringify(prev));
    } catch (_) {}
}

function setEstoqueRuntimeStatus(mode, message) {
    estoqueRuntimeState = { mode, message: message || '' };
    let host = document.getElementById('estoqueRuntimeStatus');
    if (!host) {
        const h1 = document.querySelector('.container h1');
        if (!h1 || !h1.parentNode) return;
        host = document.createElement('div');
        host.id = 'estoqueRuntimeStatus';
        host.style.margin = '8px 0 12px';
        host.style.padding = '8px 10px';
        host.style.borderRadius = '6px';
        host.style.fontSize = '12px';
        host.style.display = 'none';
        h1.insertAdjacentElement('afterend', host);
    }
    if (mode === 'ok') {
        host.style.display = 'none';
        host.textContent = '';
        return;
    }
    host.style.display = 'block';
    if (mode === 'warn') {
        host.style.background = '#fff7e6';
        host.style.border = '1px solid #ffd591';
        host.style.color = '#8c5a00';
    } else {
        host.style.background = '#fff1f0';
        host.style.border = '1px solid #ffa39e';
        host.style.color = '#a8071a';
    }
    host.textContent = message || 'Atenção no carregamento do estoque';
}

// Inicialização
document.addEventListener('DOMContentLoaded', function() {
    inicializarSistema();
});

// Funções de inicialização
function inicializarSistema() {
    logEstoqueEvent('init', 'Inicializando sistema de estoque');
    
    // Configurar data atual
    const hoje = new Date().toISOString().split('T')[0];
    ['entradaData', 'saidaData', 'filtroDataInicio', 'filtroDataFim', 'relDataInicio', 'relDataFim'].forEach((id) => {
        const el = document.getElementById(id);
        if (el) el.value = hoje;
    });
    
    // Carregar dados
    carregarDados();
    
    // Configurar eventos
    configurarEventos();
    
    // Atualizar estatísticas
    atualizarEstatisticas();
}

async function ensureTenantContext(timeoutMs = 10000) {
    const start = Date.now();
    const getTenant = () => {
        try {
            const svc = window.firebaseService || window.firebaseServiceTL || window.FirebaseService;
            if (svc && typeof svc.getTenantId === 'function') {
                const t = svc.getTenantId();
                if (t) return String(t);
            }
            if (svc && typeof svc.getCurrentTenantId === 'function') {
                const t = svc.getCurrentTenantId();
                if (t) return String(t);
            }
        } catch (_) {}
        try {
            if (window.appTenantId) return String(window.appTenantId);
            const raw = localStorage.getItem('company_info');
            if (raw) {
                const obj = JSON.parse(raw);
                const id = obj && (obj.companyId || obj.companyID || obj.tenantId || obj.id);
                if (id) return String(id);
            }
        } catch (_) {}
        return null;
    };

    let tenant = getTenant();
    if (tenant) {
        try {
            const svc = window.firebaseService || window.firebaseServiceTL || window.FirebaseService;
            if (svc && typeof svc.setTenantId === 'function') svc.setTenantId(tenant);
        } catch (_) {}
        return tenant;
    }

    while (!tenant && (Date.now() - start) < timeoutMs) {
        try {
            const svc = window.firebaseService || window.firebaseServiceTL || window.FirebaseService;
            let user = null;
            if (svc && svc.authService && typeof svc.authService.getCurrentUser === 'function') {
                user = await svc.authService.getCurrentUser();
            } else if (typeof firebase !== 'undefined' && firebase.auth && firebase.auth().currentUser) {
                user = firebase.auth().currentUser;
            }
            if (user && user.uid) {
                let companyId = null;
                try {
                    if (svc && typeof svc.loadFromFirebase === 'function') {
                        const profileRes = await svc.loadFromFirebase(`users/${user.uid}`);
                        const profile = profileRes && profileRes.success ? profileRes.data : profileRes;
                        companyId = profile && (profile.companyId || profile.companyID || profile.tenantId) || null;
                    }
                } catch (_) {}
                if (!companyId) {
                    try {
                        if (typeof user.getIdTokenResult === 'function') {
                            const token = await user.getIdTokenResult(true);
                            companyId = token && token.claims && (token.claims.companyId || token.claims.companyID || token.claims.tenantId) || null;
                        }
                    } catch (_) {}
                }
                if (companyId) {
                    tenant = String(companyId);
                    try {
                        if (svc && typeof svc.setTenantId === 'function') svc.setTenantId(tenant);
                        window.appTenantId = tenant;
                        const raw = localStorage.getItem('company_info');
                        const prev = raw ? JSON.parse(raw) : {};
                        const next = { ...prev, companyId: tenant, id: prev.id || tenant };
                        localStorage.setItem('company_info', JSON.stringify(next));
                        window.companyInfo = next;
                    } catch (_) {}
                }
            }
        } catch (_) {}
        if (tenant) break;
        await new Promise((resolve) => setTimeout(resolve, 250));
        tenant = getTenant();
    }
    return tenant;
}

async function carregarDados() {
    try {
        logEstoqueEvent('data-load', 'Início do carregamento');
        setEstoqueRuntimeStatus('ok', '');
        // Indicadores visuais de carregamento
        const selForn = document.getElementById('fornecedorSelect');
        const selRom = document.getElementById('romaneioEntradaSelect');
        if (selForn) {
            selForn.innerHTML = '<option value="">Carregando fornecedores...</option>';
            selForn.disabled = true;
        }
        if (selRom) {
            selRom.innerHTML = '<option value="">Carregando romaneios...</option>';
            selRom.disabled = true;
        }

        // Aguardar carregamento do FirebaseService
        let tentativas = 0;
        while ((!window.firebaseService || typeof window.firebaseService.loadFromFirebase !== 'function') && tentativas < 30) {
            console.log(`⏳ Aguardando FirebaseService... (${tentativas + 1}/30)`);
            await new Promise(resolve => setTimeout(resolve, 200));
            tentativas++;
        }

        const firebaseAvailable = !!(window.firebaseService && typeof window.firebaseService.loadFromFirebase === 'function');
        if (!firebaseAvailable) {
            logEstoqueEvent('data-load', 'FirebaseService indisponível, usando contingência local', null, 'warn');
            setEstoqueRuntimeStatus('warn', 'Modo contingência ativo: conexão Firebase indisponível. Exibindo dados locais.');
        }

        const tenant = await ensureTenantContext();
        if (!tenant) {
            logEstoqueEvent('tenant', 'Tenant não identificado', null, 'warn');
            setEstoqueRuntimeStatus('warn', 'Empresa não identificada no estoque. Verifique autenticação e contexto da empresa.');
        }

        // Carregamento Paralelo (Melhor Prática de Performance)
        const [estoqueRes, movRes, fornRes, romRes] = await Promise.all([
            firebaseAvailable ? window.firebaseService.loadFromFirebase('estoqueTorasAtual') : getDataAsync('estoqueTorasAtual'),
            getDataAsync('movimentacoesToras'),
            firebaseAvailable ? window.firebaseService.loadFromFirebase('fornecedores') : getDataAsync('fornecedores'),
            firebaseAvailable ? window.firebaseService.loadFromFirebase('romaneios/tora') : getDataAsync('romaneios/tora')
        ]);

        // Processar Estoque
        let rawEstoque = estoqueRes ? (estoqueRes.data !== undefined ? estoqueRes.data : estoqueRes) : [];
        estoqueAtual = rawEstoque ? (Array.isArray(rawEstoque) ? rawEstoque : Object.values(rawEstoque)) : [];
        estoqueAtual = estoqueAtual.filter(item => item && typeof item === 'object');

        // Processar Movimentações
        movimentacoes = movRes ? (Array.isArray(movRes) ? movRes : Object.values(movRes)) : [];
        movimentacoes = movimentacoes.filter(item => item && typeof item === 'object');

        // Processar Fornecedores
        let rawForn = fornRes ? (fornRes.data !== undefined ? fornRes.data : fornRes) : [];
        if (rawForn) {
            if (Array.isArray(rawForn)) {
                fornecedores = rawForn;
            } else if (typeof rawForn === 'object') {
                fornecedores = Object.values(rawForn);
            } else {
                fornecedores = [];
            }
        } else {
            fornecedores = [];
        }

        // Processar Romaneios (Cache Global)
        const romData = romRes ? (romRes.data !== undefined ? romRes.data : romRes) : null;
        if (romData) {
            let listaRom = [];
            if (Array.isArray(romData)) {
                listaRom = romData;
            } else if (typeof romData === 'object') {
                listaRom = Object.values(romData);
            }
            // Filtrar e ordenar
            romaneiosDisponiveis = listaRom.filter(r => r && typeof r === 'object' && (r.id || r.firebaseKey));
            romaneiosDisponiveis.sort((a, b) => new Date(b.data || b.dataHora) - new Date(a.data || a.dataHora));
        } else {
            romaneiosDisponiveis = [];
        }
        
        // Carregar Espécies (pode ser rápido ou cacheado)
        await carregarEspeciesParaDatalist();

        // Habilitar e atualizar Selects
        if (selForn) selForn.disabled = false;
        if (selRom) selRom.disabled = false;

        atualizarSelectFornecedores();
        
        // Inicializar com "Todos" ou vazio, sem filtrar ainda
        carregarRomaneiosParaSelect(""); 
        await carregarRomaneiosSaidaSelect();
        
        atualizarFiltros();
        
        // Carregar tabelas
        carregarTabelaEstoque();
        carregarTabelaMovimentacoes();
        
        configurarEventosCalculoAutomatico();
        configurarNavegacaoEnter();

        if (firebaseAvailable && tenant) setEstoqueRuntimeStatus('ok', '');
        logEstoqueEvent('data-load', 'Carga concluída', {
            estoque: estoqueAtual.length,
            movimentacoes: movimentacoes.length,
            fornecedores: fornecedores.length,
            romaneios: romaneiosDisponiveis.length,
            firebaseAvailable,
            tenant: !!tenant
        });
    } catch (error) {
        logEstoqueEvent('data-load', 'Falha ao carregar dados', { error: String(error && error.message || error) }, 'error');
        setEstoqueRuntimeStatus('error', 'Falha ao carregar dados do estoque. Recarregue e, se persistir, acione suporte.');
    }
}

async function carregarEspeciesParaDatalist() {
    try {
        let especies = [];
        // Tentar usar o gerenciador de espécies se disponível
        if (window.speciesManagerInstance) {
            especies = await window.speciesManagerInstance.loadSpeciesData();
        } else if (window.firebaseService) {
            const result = await window.firebaseService.loadFromFirebase('species');
            if (result && result.data) {
                especies = Array.isArray(result.data) ? result.data : Object.values(result.data);
            } else {
                // Fallback para 'especies' (legado)
                 const resultLegado = await window.firebaseService.loadFromFirebase('especies');
                 if (resultLegado && resultLegado.data) {
                    especies = Array.isArray(resultLegado.data) ? resultLegado.data : Object.values(resultLegado.data);
                 }
            }
        }
        
        const datalist = document.getElementById('listaEspecies');
        if (datalist) {
            datalist.innerHTML = '';
            especies.forEach(e => {
                const opt = document.createElement('option');
                opt.value = e.nome || e.name;
                datalist.appendChild(opt);
            });
        }
    } catch (e) {
        console.error("Erro ao carregar espécies:", e);
    }
}

function configurarEventosCalculoAutomatico() {
    const inputs = ['diametroEntrada', 'comprimentoEntrada', 'oco1Entrada', 'oco2Entrada'];
    inputs.forEach(id => {
        const el = document.getElementById(id);
        if (el) {
            el.addEventListener('input', calcularVolumesAutomatico);
            el.addEventListener('blur', calcularVolumesAutomatico);
        }
    });
}

function calcularVolumesAutomatico() {
    const diametro = parseFloat(document.getElementById('diametroEntrada').value) || 0;
    const comprimento = parseFloat(document.getElementById('comprimentoEntrada').value) || 0;
    const oco1 = parseFloat(document.getElementById('oco1Entrada').value) || 0;
    const oco2 = parseFloat(document.getElementById('oco2Entrada').value) || 0;

    if (diametro > 0 && comprimento > 0) {
        const volBruto = calcularVolumeTora(diametro, comprimento);
        const desconto = calcularDescontoOco(oco1, oco2, comprimento);
        const volLiq = Math.max(0, volBruto - desconto);

        document.getElementById('m3BrutoEntrada').value = formatNumber(volBruto, 3);
        document.getElementById('m3LiquidoEntrada').value = formatNumber(volLiq, 3);
    }
}

function configurarNavegacaoEnter() {
    const campos = [
        'entradaData', 'fornecedorSelect', 'romaneioEntradaSelect', 
        'plaquetaEntrada', 'especieEntrada', 'diametroEntrada', 'comprimentoEntrada', 
        'oco1Entrada', 'oco2Entrada', 'precoEntrada', 'm3BrutoEntrada', 'm3LiquidoEntrada'
    ];
    
    // Adicionar listener para cada campo
    campos.forEach((id, index) => {
        const el = document.getElementById(id);
        if (el) {
            el.addEventListener('keydown', function(e) {
                if (e.key === 'Enter') {
                    e.preventDefault();
                    // Se for o último campo ou botão de adicionar
                    if (index === campos.length - 1) {
                         // Tentar clicar no botão adicionar
                         adicionarItemEntrada();
                    } else {
                        // Mover para o próximo campo
                        const nextId = campos[index + 1];
                        const nextEl = document.getElementById(nextId);
                        if (nextEl) nextEl.focus();
                    }
                }
            });
        }
    });
    
    // Listener especial para o botão "Adicionar Item" se focado via tab
    // Mas o fluxo acima já cobre inputs. O botão adicionarItemEntrada já foca em Plaqueta no final.
}

function atualizarSelectFornecedores() {
    const select = document.getElementById('fornecedorSelect');
    if (!select) return;
    
    select.innerHTML = '<option value="">Selecione um fornecedor</option>';
    
    // Adicionar listener para filtrar romaneios
    select.onchange = function(e) {
        const val = e.target.value;
        console.log("Fornecedor selecionado:", val);
        carregarRomaneiosParaSelect(val);
    };
    
    fornecedores.forEach(f => {
        const option = document.createElement('option');
        option.value = f.id;
        option.textContent = f.nome || f.name || 'Fornecedor sem nome';
        select.appendChild(option);
    });
}

function configurarEventos() {
    // Evento de submit da entrada
    const entradaForm = document.getElementById('entradaForm');
    if (entradaForm) entradaForm.addEventListener('submit', registrarEntrada);
    
    // Evento de submit da saída
    const saidaForm = document.getElementById('saidaForm');
    if (saidaForm) saidaForm.addEventListener('submit', registrarSaida);
    
    // Listener para novas espécies criadas pelo SpeciesManager
    window.addEventListener('species:updated', async (e) => {
        console.log("🌿 Nova espécie detectada:", e.detail);
        await carregarEspeciesParaDatalist(); // Recarregar lista
        
        // Se o evento tiver nome, preencher o campo
        if (e.detail && e.detail.nome) {
            const input = document.getElementById('especieEntrada');
            if (input) {
                input.value = e.detail.nome;
                // Disparar evento de input para validações visuais se houver
                input.dispatchEvent(new Event('input', { bubbles: true }));
            }
        }
    });
    
    // Eventos de formatação monetária
    const camposMonetarios = ['precoEntrada'];
    camposMonetarios.forEach(campoId => {
        const campo = document.getElementById(campoId);
        if (campo) {
            campo.addEventListener('blur', function() {
                this.value = formatCurrency(parseCurrencyValue(this.value));
            });
        }
    });
}

// Funções de navegação entre tabs
function showTab(tabName) {
    // Ocultar todas as tabs
    const tabContents = document.querySelectorAll('.tab-content');
    tabContents.forEach(tab => tab.classList.remove('active'));
    
    // Remover classe active de todas as tabs
    const tabs = document.querySelectorAll('.tab');
    tabs.forEach(tab => tab.classList.remove('active'));
    
    // Mostrar tab selecionada
    document.getElementById(tabName).classList.add('active');
    
    // Adicionar classe active na tab clicada
    const clickedRaw = (typeof event !== 'undefined' && event && event.target) ? event.target : document.querySelector(`.tab[onclick="showTab('${tabName}')"]`);
    const clicked = clickedRaw && clickedRaw.closest ? clickedRaw.closest('.tab') : clickedRaw;
    if (clicked) clicked.classList.add('active');
    logEstoqueEvent('tab', `Aba ativada: ${tabName}`);
    
    // Carregar dados específicos da tab
    if (tabName === 'consulta') {
        atualizarEstatisticas();
        carregarTabelaEstoque();
    } else if (tabName === 'movimentacao') {
        carregarTabelaMovimentacoes();
    } else if (tabName === 'produtos') {
        carregarEstoqueProdutos();
    }
}

// Funções de entrada de estoque

// --- Lógica de Romaneios ---
async function carregarRomaneiosParaSelect(fornecedorIdFiltro = null) {
    const select = document.getElementById('romaneioEntradaSelect');
    if (!select) return;
    
    // Se o filtro for passado como evento (pode acontecer em alguns handlers), ignorar
    if (fornecedorIdFiltro && typeof fornecedorIdFiltro === 'object' && fornecedorIdFiltro.target) {
        fornecedorIdFiltro = fornecedorIdFiltro.target.value;
    }

    // Se não tiver dados cacheados, carregar (fallback)
    if (!romaneiosDisponiveis || romaneiosDisponiveis.length === 0) {
        select.innerHTML = '<option value="">Carregando...</option>';
        try {
            let romaneios = [];
            if (window.firebaseService) {
                const result = await window.firebaseService.loadFromFirebase('romaneios/tora');
                const data = result ? (result.data !== undefined ? result.data : result) : null;
                
                if (data) {
                    if (Array.isArray(data)) {
                        romaneios = data;
                    } else if (typeof data === 'object') {
                        romaneios = Object.values(data);
                    }
                }
            } else {
                romaneios = JSON.parse(localStorage.getItem('romaneiosTora') || '[]');
            }
            // Filtrar e ordenar
            romaneiosDisponiveis = romaneios.filter(r => r && typeof r === 'object' && (r.id || r.firebaseKey));
            romaneiosDisponiveis.sort((a, b) => new Date(b.data || b.dataHora) - new Date(a.data || a.dataHora));
        } catch (e) {
            console.error("Erro ao carregar romaneios (fallback):", e);
        }
    }
    
    // Filtrar por fornecedor se fornecido
    let listaExibicao = romaneiosDisponiveis;
    // Forçar conversão para string e remover espaços
    const filtroStr = String(fornecedorIdFiltro || '').trim();
    
    // Log para depuração
    console.log(`🔍 Filtrando romaneios. Filtro (ID): "${filtroStr}"`);
    
    if (filtroStr !== "") {
        // Encontrar o fornecedor selecionado para obter dados adicionais (Nome, Legacy IDs)
        const fornecedorSelecionado = fornecedores.find(f => String(f.id) === filtroStr);
        
        const nomeFornecedorFiltro = fornecedorSelecionado ? (fornecedorSelecionado.nome || fornecedorSelecionado.name || '').trim().toLowerCase() : '';
        // IDs alternativos para compatibilidade com legado
        const idsAlternativos = [];
        if (fornecedorSelecionado) {
             if (fornecedorSelecionado.legacyId) idsAlternativos.push(String(fornecedorSelecionado.legacyId));
             if (fornecedorSelecionado.oldId) idsAlternativos.push(String(fornecedorSelecionado.oldId));
             if (fornecedorSelecionado.codigo) idsAlternativos.push(String(fornecedorSelecionado.codigo));
        }

        console.log(`   Fornecedor Selecionado: ${nomeFornecedorFiltro} (IDs Alt: ${idsAlternativos.join(', ')})`);

        // Debug: Mostrar estrutura do primeiro romaneio para diagnóstico
        if (romaneiosDisponiveis.length > 0) {
            const sample = romaneiosDisponiveis[0];
            console.log("   [DEBUG] Estrutura do 1º Romaneio:", {
                id: sample.id,
                fornecedor: sample.fornecedor,
                fornecedorId: sample.fornecedorId,
                cliente: sample.cliente
            });
        }

        listaExibicao = romaneiosDisponiveis.filter(r => {
            // Tentar obter o ID do fornecedor do romaneio de todas as formas possíveis
            let rFornId = null;
            let rFornNome = null;
            
            // 1. Objeto fornecedor completo (Padrão romaneiotora.js)
            if (r.fornecedor && typeof r.fornecedor === 'object') {
                rFornId = r.fornecedor.id || r.fornecedor.firebaseKey;
                rFornNome = r.fornecedor.nome || r.fornecedor.name;
            } 
            // 2. Propriedade direta fornecedorId (Padrão Estoque antigo)
            else if (r.fornecedorId) {
                rFornId = r.fornecedorId;
            }
            // 3. Propriedade direta fornecedor (se for ID string/number ou NOME)
            else if (r.fornecedor && (typeof r.fornecedor === 'string' || typeof r.fornecedor === 'number')) {
                rFornId = r.fornecedor;
                // Se parece um nome (contém letras e espaços, não é só número ou hash curto), usar como nome também
                if (typeof r.fornecedor === 'string' && r.fornecedor.length > 5 && isNaN(Number(r.fornecedor))) {
                    rFornNome = r.fornecedor;
                }
            }
            // 4. Fallback para 'cliente' (alguns módulos antigos usam cliente para fornecedor)
            else if (r.cliente && typeof r.cliente === 'object') {
                rFornId = r.cliente.id || r.cliente.firebaseKey;
                rFornNome = r.cliente.nome || r.cliente.name;
            }
            else if (r.clienteId) {
                rFornId = r.clienteId;
            }
            // 5. Fallback para 'cliente' string
            else if (r.cliente && typeof r.cliente === 'string') {
                rFornNome = r.cliente;
            }

            // Normalizar ID do romaneio para comparação
            const rFornIdStr = String(rFornId || '').trim();
            
            // 1ª Tentativa: Match por ID Principal
            if (rFornIdStr === filtroStr) return true;

            // 1.5ª Tentativa: Match por IDs Alternativos (Legado)
            if (idsAlternativos.some(altId => altId === rFornIdStr)) return true;

            // 2ª Tentativa: Match por Nome (se ID falhou e temos um nome para comparar)
            if (nomeFornecedorFiltro && rFornNome) {
                const rNomeLower = String(rFornNome).trim().toLowerCase();
                if (rNomeLower === nomeFornecedorFiltro) return true;
                // Match parcial seguro (nome do romaneio contém nome do filtro ou vice-versa)
                if (rNomeLower.includes(nomeFornecedorFiltro) || nomeFornecedorFiltro.includes(rNomeLower)) return true;
            }
            
            return false;
        });
        
        console.log(`   Resultados encontrados: ${listaExibicao.length}`);
    } else {
        console.log("   Sem filtro de fornecedor (exibindo todos)");
    }
    
    // Popular Select
    select.innerHTML = '<option value="">Selecione um romaneio</option>';
    
    if (listaExibicao.length === 0) {
        const opt = document.createElement('option');
        // Se estiver filtrando e não achou, avisa. Se não estiver filtrando e lista vazia, avisa.
        if (filtroStr !== "") {
            opt.text = "Nenhum romaneio para este fornecedor";
        } else {
            opt.text = "Nenhum romaneio disponível no sistema";
        }
        select.add(opt);
        return;
    }
    
    listaExibicao.forEach(r => {
        const opt = document.createElement('option');
        opt.value = r.id;
        const data = formatDate(r.data || r.dataHora);
        
        // Tentar obter nome do fornecedor para exibição
        let nomeFornecedor = 'N/A';
        if (r.fornecedor && typeof r.fornecedor === 'object' && r.fornecedor.nome) {
            nomeFornecedor = r.fornecedor.nome;
        } else if (r.fornecedorNome) {
            nomeFornecedor = r.fornecedorNome;
        } else if (r.fornecedor && (typeof r.fornecedor === 'string' || typeof r.fornecedor === 'number')) {
            // Tentar achar na lista global de fornecedores
            const f = fornecedores.find(f => String(f.id) == String(r.fornecedor));
            nomeFornecedor = f ? (f.nome || f.name) : String(r.fornecedor);
        } else if (r.cliente && typeof r.cliente === 'object' && r.cliente.nome) {
            nomeFornecedor = r.cliente.nome; // Fallback para cliente
        } else if (r.cliente && typeof r.cliente === 'string') {
            nomeFornecedor = r.cliente;
        }
        
        const itens = r.itens ? (Array.isArray(r.itens) ? r.itens : Object.values(r.itens)) : [];
        const volumeTotal = itens.reduce((acc, i) => acc + (parseFloat(i.volumeSerraria || i.volumeLiquido || 0)), 0);
        const numero = r.numero || r.numeroRomaneio || 'S/N';
        
        opt.text = `${data} - ${nomeFornecedor} - Romaneio: ${numero} - ${itens.length} itens (${formatNumber(volumeTotal, 3)} m³)`;
        select.add(opt);
    });
}

async function carregarRomaneiosSaidaSelect() {
    const select = document.getElementById('romaneiosSaidaSelect');
    if (!select) return;

    const normalizeList = (raw, tipo) => {
        let lista = [];
        if (Array.isArray(raw)) {
            lista = raw;
        } else if (raw && typeof raw === 'object') {
            lista = Object.values(raw);
        }
        return lista
            .filter(r => r && typeof r === 'object' && (r.id || r.firebaseKey))
            .map(r => ({ ...r, tipo: (r.tipo || tipo || '').toUpperCase(), id: r.id || r.firebaseKey }));
    };

    const loadFromFirebase = async (key) => {
        if (!window.firebaseService || typeof window.firebaseService.loadFromFirebase !== 'function') return null;
        const result = await window.firebaseService.loadFromFirebase(key);
        return result ? (result.data !== undefined ? result.data : result) : null;
    };

    const loadFromLocal = (keys) => {
        const candidateKeys = [];
        const tenant = resolveCompanyId();
        for (const k of keys) {
            if (tenant) candidateKeys.push(`companies/${tenant}/${k}`);
            candidateKeys.push(k);
        }
        for (const k of candidateKeys) {
            const raw = localStorage.getItem(k);
            if (raw) {
                try { return JSON.parse(raw); } catch (_) {}
            }
        }
        return null;
    };

    let lista = [];
    try {
        const [pctRaw, tlRaw, pesRaw] = await Promise.all([
            loadFromFirebase('romaneios/pct'),
            loadFromFirebase('romaneiosTL'),
            loadFromFirebase('romaneios/pes')
        ]);
        lista = [
            ...normalizeList(pctRaw, 'PCT'),
            ...normalizeList(tlRaw, 'TL'),
            ...normalizeList(pesRaw, 'PES')
        ];
    } catch (_) {}

    if (lista.length === 0) {
        const pctLocal = loadFromLocal(['romaneiosPct', 'romaneios_pct']);
        const tlLocal = loadFromLocal(['romaneiosTL', 'romaneios_tl']);
        const pesLocal = loadFromLocal(['romaneiosPes', 'romaneios_pes', 'romaneios']);
        lista = [
            ...normalizeList(pctLocal, 'PCT'),
            ...normalizeList(tlLocal, 'TL'),
            ...normalizeList(pesLocal, 'PES')
        ];
    }

    romaneiosSaidaDisponiveis = lista;
    select.innerHTML = '';
    if (lista.length === 0) {
        const opt = document.createElement('option');
        opt.value = '';
        opt.text = 'Nenhum romaneio disponível';
        select.add(opt);
        return;
    }

    const formatDataBR = (d) => {
        if (!d) return '';
        const dt = new Date(d);
        if (isNaN(dt.getTime())) return String(d);
        return dt.toLocaleDateString('pt-BR');
    };
    const getRomaneioDate = (r) => r.updatedAt || r.updated || r.data || r.dataHora || r.created || r.timestamp || 0;
    const getRomaneioPessoa = (r) => {
        return String(r?.clienteNome || r?.cliente?.nome || r?.fornecedorNome || r?.fornecedor?.nome || r?.cliente || r?.fornecedor || 'N/A');
    };
    const getRomaneioItens = (r) => {
        const itensRaw = r ? (r.itens || r.items || r.romaneioItems || []) : [];
        return Array.isArray(itensRaw) ? itensRaw : (itensRaw && typeof itensRaw === 'object' ? Object.values(itensRaw) : []);
    };
    const getRomaneioVolume = (r) => {
        if (!r) return 0;
        const itens = getRomaneioItens(r);
        return Number(
            (r.totais && (r.totais.volumeSerraria || r.totais.volumeTotal || r.totais.volume)) ||
            r.totalVolume ||
            r.volumeSerraria ||
            r.volumeTotal ||
            r.volume ||
            itens.reduce((acc, i) => acc + (parseFloat(i.volumeSerraria || i.volumeLiquido || i.volumeTotal || i.volume || 0) || 0), 0)
        ) || 0;
    };
    const getRomaneioValor = (r) => {
        if (!r) return 0;
        const itens = getRomaneioItens(r);
        return Number(
            (r.totais && (r.totais.valorTotal || r.totais.valor)) ||
            r.totalValor ||
            r.valorTotal ||
            r.valor ||
            itens.reduce((acc, i) => acc + (parseFloat(i.valorTotal || i.valor || i.total || i.precoTotal || 0) || 0), 0)
        ) || 0;
    };
    const formatRomaneioLabelDetalhado = (r) => {
        const data = formatDataBR(getRomaneioDate(r));
        const pessoa = getRomaneioPessoa(r);
        const vol = getRomaneioVolume(r);
        const valor = getRomaneioValor(r);
        return `${data} - ${pessoa} - ${formatNumber(vol, 3)} m³ - ${formatCurrency(valor)}`;
    };

    lista.sort((a, b) => new Date(getRomaneioDate(b)) - new Date(getRomaneioDate(a)));
    lista.forEach(r => {
        const opt = document.createElement('option');
        opt.value = r.id;
        opt.dataset.tipo = r.tipo || '';
        opt.text = formatRomaneioLabelDetalhado(r);
        select.add(opt);
    });
    renderizarRomaneiosSaidaSelecionados();
}

function carregarItensDoRomaneioSelecionado() {
    const select = document.getElementById('romaneioEntradaSelect');
    const id = select.value;
    
    if (!id) {
        alert('Selecione um romaneio primeiro.');
        return;
    }
    
    const romaneio = romaneiosDisponiveis.find(r => r.id === id);
    if (!romaneio) return;
    
    // Tentar preencher fornecedor se não estiver selecionado
    const selectForn = document.getElementById('fornecedorSelect');
    if (selectForn.value === "" && romaneio.fornecedor && romaneio.fornecedor.id) {
        // Verificar se opção existe, senão adicionar temporariamente
        if (![...selectForn.options].some(o => o.value === romaneio.fornecedor.id)) {
            const opt = document.createElement('option');
            opt.value = romaneio.fornecedor.id;
            opt.text = romaneio.fornecedor.nome;
            selectForn.add(opt);
        }
        selectForn.value = romaneio.fornecedor.id;
    }
    
    if (romaneio.data) {
        document.getElementById('entradaData').value = romaneio.data.split('T')[0];
    }
    
    romaneioSelecionadoId = id;
    
    // Adicionar itens à tabela de entrada
    if (romaneio.itens) {
        let itensArray = Array.isArray(romaneio.itens) ? romaneio.itens : Object.values(romaneio.itens);
        
        // Filtrar itens inválidos para evitar linhas vazias na tabela
        itensArray = itensArray.filter(item => item && typeof item === 'object');

        if (itensArray.length > 0) {
            // Converter itens do romaneio para formato de estoque/tabela
            const novosItens = itensArray.map(item => ({
                ...item,
                id: generateUniqueId('ITEM'), // Novo ID para o estoque
                origemRomaneioId: id,
                // Garantir campos
                volumeLiquido: parseFloat(item.volumeLiquido || item.volumeSerraria || 0),
                volumeBruto: parseFloat(item.volumeBruto || 0),
                preco: parseFloat(item.preco || item.precoCusto || 0),
                valor: parseFloat(item.valor || (item.volumeLiquido * item.preco) || 0)
            }));
            
            itensEntrada = [...itensEntrada, ...novosItens];
            paginaAtualEntrada = 1; // Resetar paginação ao carregar novos itens
            renderizarTabelaEntrada();
            alert(`Carregados ${novosItens.length} itens do romaneio.`);
        } else {
            alert('Este romaneio não possui itens.');
        }
    } else {
        alert('Este romaneio não possui itens.');
    }
}

// --- Lógica Manual ---
function adicionarItemEntrada() {
    const plaqueta = document.getElementById('plaquetaEntrada').value;
    const especie = document.getElementById('especieEntrada').value;
    const diametro = parseFloat(document.getElementById('diametroEntrada').value) || 0;
    const comprimento = parseFloat(document.getElementById('comprimentoEntrada').value) || 0;
    const oco1 = parseFloat(document.getElementById('oco1Entrada').value) || 0;
    const oco2 = parseFloat(document.getElementById('oco2Entrada').value) || 0;
    const preco = parseCurrencyValue(document.getElementById('precoEntrada').value);
    
    // Novos campos M3
    let volBrutoInput = parseFloat(document.getElementById('m3BrutoEntrada').value) || 0;
    let volLiqInput = parseFloat(document.getElementById('m3LiquidoEntrada').value) || 0;
    
    if (!especie) { alert('Informe a espécie'); return; }
    
    // Cálculos
    // Se dimensões forem fornecidas, calcular. Se não, usar inputs manuais de volume se existirem.
    let volBruto = 0;
    let volLiq = 0;
    let desconto = 0;
    
    if (diametro > 0 && comprimento > 0) {
        volBruto = calcularVolumeTora(diametro, comprimento);
        desconto = calcularDescontoOco(oco1, oco2, comprimento);
        volLiq = Math.max(0, volBruto - desconto);
    } else {
        // Usar valores manuais se dimensões não forem completas
        volBruto = volBrutoInput;
        volLiq = volLiqInput;
        desconto = Math.max(0, volBruto - volLiq);
    }
    
    // Se o usuário digitou volumes manualmente e são diferentes do calculado, respeitar o manual?
    // Vamos priorizar o input manual se ele foi preenchido explicitamente e é diferente de 0, 
    // ou se não houve cálculo por falta de dimensões.
    // Mas se calculou, atualiza os inputs?
    // Melhor: se calculou, usa o calculado. Opcionalmente poderia atualizar os inputs visuais antes de adicionar.
    
    const valorTotal = volLiq * preco;
    
    const item = {
        id: generateUniqueId('MANUAL'),
        plaqueta,
        especie,
        diametro, rodo: diametro,
        comprimento,
        oco1,
        oco2,
        volumeBruto: volBruto,
        volumeDesconto: desconto,
        desconto: desconto,
        volumeLiquido: volLiq,
        volumeSerraria: volLiq,
        precoCusto: preco,
        preco: preco,
        valor: valorTotal,
        localizacao: '', // Campo removido do formulário
        origem: 'manual'
    };
    
    itensEntrada.push(item);
    renderizarTabelaEntrada();
    limparCamposEntrada();
}

function limparCamposEntrada() {
    // Helper para limpar com segurança
    const safeClear = (id) => {
        const el = document.getElementById(id);
        if (el) el.value = '';
    };

    // Manter persistência temporária de Data, Fornecedor e Espécie
    safeClear('plaquetaEntrada');
    // document.getElementById('especieEntrada').value = ''; // Mantido
    // document.getElementById('entradaData').value = ''; // Mantido
    // document.getElementById('fornecedorSelect').value = ''; // Mantido
    
    safeClear('diametroEntrada');
    safeClear('comprimentoEntrada');
    safeClear('oco1Entrada');
    safeClear('oco2Entrada');
    safeClear('m3BrutoEntrada');
    safeClear('m3LiquidoEntrada');
    // Preço mantido
    
    const plaqueta = document.getElementById('plaquetaEntrada');
    if (plaqueta) plaqueta.focus();

    const aviso = document.getElementById('editToraAviso');
    if (aviso) aviso.style.display = 'none';
    toraEmEdicao = null;
}

function abrirHistoricoEstoque() {
    showTab('movimentacao');
}

function renderizarPaginacaoPadrao(containerId, totalItems, paginaAtual, itensPorPagina, onPageFn) {
    const container = document.getElementById(containerId);
    if (!container) return;
    const totalPaginas = Math.ceil(totalItems / itensPorPagina);
    if (!totalPaginas || totalPaginas <= 1) {
        container.innerHTML = '';
        return;
    }
    container.innerHTML = '';
    const handler = (typeof onPageFn === 'function') ? onPageFn : window[onPageFn];
    const addBtn = (label, page, disabled = false, active = false) => {
        const btn = document.createElement('button');
        btn.textContent = label;
        if (active) btn.classList.add('active');
        btn.disabled = disabled;
        btn.onclick = () => { if (typeof handler === 'function') handler(page); };
        container.appendChild(btn);
    };

    addBtn('<<<', 1, paginaAtual === 1);
    addBtn('<', paginaAtual - 1, paginaAtual === 1);

    const startPage = Math.max(1, paginaAtual - 2);
    const endPage = Math.min(totalPaginas, paginaAtual + 2);

    if (startPage > 1) {
        addBtn('1', 1, false, paginaAtual === 1);
        if (startPage > 2) {
            const span = document.createElement('span');
            span.textContent = '...';
            container.appendChild(span);
        }
    }

    for (let i = startPage; i <= endPage; i++) {
        addBtn(String(i), i, false, i === paginaAtual);
    }

    if (endPage < totalPaginas) {
        if (endPage < totalPaginas - 1) {
            const span = document.createElement('span');
            span.textContent = '...';
            container.appendChild(span);
        }
        addBtn(String(totalPaginas), totalPaginas, false, paginaAtual === totalPaginas);
    }

    addBtn('>', paginaAtual + 1, paginaAtual === totalPaginas);
    addBtn('>>>', totalPaginas, paginaAtual === totalPaginas);
}

// --- Tabela e Paginação (Padrão RomaneioPCT) ---
function renderizarTabelaEntrada() {
    const tbody = document.getElementById('tbodyEntrada');
    const paginacaoEl = document.getElementById('paginacaoEntrada');
    
    const ITENS_POR_PAGINA = 10;
    
    // Totais Gerais
    const volTotal = itensEntrada.reduce((acc, i) => acc + (i.volumeLiquido || 0), 0);
    const valTotal = itensEntrada.reduce((acc, i) => acc + (i.valor || 0), 0);
    
    // Container do resumo (criar se não existir)
    let summaryContainer = document.getElementById('resumoEntradaContainer');
    if (!summaryContainer && paginacaoEl) {
        summaryContainer = document.createElement('div');
        summaryContainer.id = 'resumoEntradaContainer';
        summaryContainer.style.marginTop = '20px';
        paginacaoEl.parentNode.insertBefore(summaryContainer, paginacaoEl.nextSibling);
    }

    if (itensEntrada.length === 0) {
        tbody.innerHTML = '<tr><td colspan="12" class="text-center">Nenhum item adicionado</td></tr>';
        if (paginacaoEl) paginacaoEl.innerHTML = '';
        if(summaryContainer) summaryContainer.innerHTML = '';
        return;
    }
    
    const totalPaginas = Math.max(1, Math.ceil(itensEntrada.length / ITENS_POR_PAGINA));
    if (paginaAtualEntrada > totalPaginas) paginaAtualEntrada = totalPaginas;
    if (paginaAtualEntrada < 1) paginaAtualEntrada = 1;
    const inicio = (paginaAtualEntrada - 1) * ITENS_POR_PAGINA;
    const itensPagina = itensEntrada.slice(inicio, inicio + ITENS_POR_PAGINA);
    
    // Renderizar Itens
    tbody.innerHTML = itensPagina.map((item, idx) => {
        const realIndex = inicio + idx;
        return `
            <tr>
                <td class="text-center"><input type="checkbox" class="check-item-entrada" data-index="${realIndex}"></td>
                <td>${item.plaqueta || '-'}</td>
                <td>${item.especie}</td>
                <td class="text-center">${formatNumber(item.diametro || item.rodo, 1)}</td>
                <td class="text-center">${formatNumber(item.comprimento, 1)}</td>
                <td class="text-center">${item.oco1 ? formatNumber(item.oco1, 1) : '-'}</td>
                <td class="text-center">${item.oco2 ? formatNumber(item.oco2, 1) : '-'}</td>
                <td class="text-center">${item.desconto ? formatNumber(item.desconto, 3) : '-'}</td>
                <td class="text-right">${formatNumber(item.volumeLiquido, 3)}</td>
                <td class="text-right">${formatCurrency(item.preco || item.precoCusto)}</td>
                <td class="text-right">${formatCurrency(item.valor)}</td>
                <td class="text-center actions-cell">
                    <button onclick="removerItemEntrada(${realIndex})" class="btn-danger btn-small"><i class="fas fa-trash"></i></button>
                </td>
            </tr>
        `;
    }).join('');

    renderizarPaginacaoPadrao('paginacaoEntrada', itensEntrada.length, paginaAtualEntrada, ITENS_POR_PAGINA, 'mudarPaginaEntrada');

    // --- Renderizar Resumo ---
    if (summaryContainer) {
        // Calcular Médias por Espécie
        const speciesStats = {};
        itensEntrada.forEach(item => {
            const esp = item.especie || 'Outros';
            const rodo = parseFloat(item.diametro || item.rodo || 0);
            const volume = parseFloat(item.volumeLiquido || item.volumeSerraria || 0);
            
            if (!speciesStats[esp]) speciesStats[esp] = { totalRodo: 0, totalVolume: 0, count: 0 };
            
            if (rodo > 0) {
                speciesStats[esp].totalRodo += rodo;
                speciesStats[esp].count++;
            }
            if (volume > 0) {
                speciesStats[esp].totalVolume += volume;
            }
        });

        let speciesHtml = '';
        Object.keys(speciesStats).sort().forEach(esp => {
            const stats = speciesStats[esp];
            const avgRodo = stats.count > 0 ? (stats.totalRodo / stats.count) : 0;
            const avgVol = stats.count > 0 ? (stats.totalVolume / stats.count) : 0;
            
            speciesHtml += `
                <div style="background: #fff; padding: 10px; border-radius: 4px; border: 1px solid #ddd; text-align: center; min-width: 140px; box-shadow: 0 1px 3px rgba(0,0,0,0.1);">
                    <div style="font-weight: bold; color: #2c3e50; margin-bottom: 8px; border-bottom: 1px solid #eee; padding-bottom: 5px;">${esp}</div>
                    <div style="font-size: 13px; color: #7f8c8d; margin-bottom: 3px;">Média Rodo: <strong>${formatNumber(avgRodo, 1)} cm</strong></div>
                    <div style="font-size: 13px; color: #7f8c8d;">Média Volu: <strong>${formatNumber(avgVol, 3)} m³</strong></div>
                </div>
            `;
        });

        summaryContainer.innerHTML = `
            <div class="summary-box" style="background-color: #f8f9fa; border: 1px solid #e9ecef; padding: 20px;">
                <div style="display: flex; justify-content: space-around; flex-wrap: wrap; margin-bottom: 20px; border-bottom: 1px solid #ddd; padding-bottom: 20px;">
                    <div class="text-center">
                        <div style="font-size: 14px; color: #7f8c8d; text-transform: uppercase; letter-spacing: 1px;">Quantidade de Toras</div>
                        <div style="font-size: 24px; font-weight: bold; color: #2c3e50;">${itensEntrada.length}</div>
                    </div>
                    <div class="text-center">
                        <div style="font-size: 14px; color: #7f8c8d; text-transform: uppercase; letter-spacing: 1px;">Volume Total</div>
                        <div style="font-size: 24px; font-weight: bold; color: #2c3e50;">${formatNumber(volTotal, 3)} m³</div>
                    </div>
                    <div class="text-center">
                        <div style="font-size: 14px; color: #7f8c8d; text-transform: uppercase; letter-spacing: 1px;">Valor Total</div>
                        <div style="font-size: 24px; font-weight: bold; color: #27ae60;">${formatCurrency(valTotal)}</div>
                    </div>
                </div>
                
                <h4 style="margin-bottom: 15px; font-size: 16px; color: #34495e; border-left: 4px solid #3498db; padding-left: 10px;">Médias de Rodo e Volume por Espécie</h4>
                <div style="display: flex; gap: 15px; overflow-x: auto; padding-bottom: 10px;">
                    ${speciesHtml || '<div style="color: #999; font-style: italic;">Nenhuma espécie com rodo informado</div>'}
                </div>
            </div>
        `;
    }
}

function mudarPaginaEntrada(p) {
    paginaAtualEntrada = p;
    renderizarTabelaEntrada();
}

function removerItemEntrada(index) {
    itensEntrada.splice(index, 1);
    renderizarTabelaEntrada();
}

function limparTabelaEntrada() {
    if (confirm('Deseja limpar todos os itens da lista de entrada?')) {
        itensEntrada = [];
        renderizarTabelaEntrada();
    }
}

function toggleTodosEntrada() {
    const master = document.getElementById('checkTodosEntrada');
    const checks = document.querySelectorAll('.check-item-entrada');
    checks.forEach(c => c.checked = master.checked);
}

// --- Registrar Entrada (Final) ---
async function registrarEntrada(event) {
    event.preventDefault();
    
    if (itensEntrada.length === 0) {
        alert('Adicione itens à lista antes de salvar.');
        return;
    }
    
    const dataEntrada = document.getElementById('entradaData').value;
    const fornecedorId = document.getElementById('fornecedorSelect').value;
    const fornecedorNome = fornecedores.find(f => f.id === fornecedorId)?.nome || 'Fornecedor Desconhecido';
    const obsGeral = document.getElementById('observacoesEntrada')?.value || '';
    const documento = romaneioSelecionadoId ? `Romaneio ${romaneioSelecionadoId}` : 'Entrada Manual';
    
    if (!fornecedorId) {
        alert('Selecione um fornecedor.');
        return;
    }
    
    // Mostrar loading
    showLoading('Preparando dados para gravação...');
    
    try {
        const updates = {};
        const newItems = [];
        const newMovs = [];
        const totalItens = itensEntrada.length;
        
        // Processar itens
        itensEntrada.forEach((item, index) => {
            // Normalizar e limpar campos
            const itemLimpo = {
                id: generateUniqueId('EST') + index, // Garantir unicidade no batch
                data: dataEntrada,
                fornecedorId: String(fornecedorId),
                fornecedor: { id: String(fornecedorId), nome: fornecedorNome },
                documento: documento,
                plaqueta: String(item.plaqueta || generateUniqueId('PQ') + index),
                especie: String(item.especie || 'N/A'),
                diametro: parseFloat(item.diametro || item.rodo || 0),
                comprimento: parseFloat(item.comprimento || 0),
                oco1: parseFloat(item.oco1 || 0),
                oco2: parseFloat(item.oco2 || 0),
                precoCusto: parseFloat(item.preco || item.precoCusto || 0),
                localizacao: String(item.localizacao || (document.getElementById('localizacaoEntrada') ? document.getElementById('localizacaoEntrada').value : '')),
                observacoes: String(obsGeral),
                
                // Volumes
                volumeBruto: parseFloat(item.volumeBruto || 0),
                volumeDesconto: parseFloat(item.desconto || item.volumeDesconto || 0),
                volumeLiquido: parseFloat(item.volumeLiquido || item.volumeSerraria || 0),
                
                status: 'disponivel',
                origemRomaneioId: item.origemRomaneioId ? String(item.origemRomaneioId) : null,
                created: new Date().toISOString()
            };
            
            // Criar movimentação
            const mov = {
                id: generateUniqueId('MOV') + index, // Garantir unicidade no batch
                data: dataEntrada,
                tipo: 'entrada',
                toraId: itemLimpo.id,
                plaqueta: itemLimpo.plaqueta,
                especie: itemLimpo.especie,
                volume: itemLimpo.volumeLiquido,
                documento: documento,
                observacoes: `Entrada Estoque - ${obsGeral}`,
                created: new Date().toISOString()
            };
            
            // Adicionar ao batch de updates
            updates[`estoqueTorasAtual/${itemLimpo.id}`] = itemLimpo;
            updates[`movimentacoesToras/${mov.id}`] = mov;
            
            newItems.push(itemLimpo);
            newMovs.push(mov);
        });
        
        // Atualizar arrays locais (Optimistic Update)
        estoqueAtual.push(...newItems);
        movimentacoes.push(...newMovs);
        
        document.getElementById('loadingMessage').textContent = `Salvando ${totalItens} itens...`;
        
        // Salvar no Firebase
        if (window.firebaseService && typeof window.firebaseService.updatePaths === 'function') {
            await window.firebaseService.updatePaths(updates);
        } else if (window.firebaseService && typeof window.firebaseService.saveToFirebase === 'function') {
            // Fallback para saveToFirebase em loop se updatePaths não existir
            let salvos = 0;
            for (let i = 0; i < newItems.length; i++) {
                document.getElementById('loadingProgress').textContent = `${i+1}/${totalItens}`;
                await window.firebaseService.saveToFirebase('estoqueTorasAtual', String(newItems[i].id), newItems[i]);
                await window.firebaseService.saveToFirebase('movimentacoesToras', String(newMovs[i].id), newMovs[i]);
                salvos++;
            }
        } else {
            // LocalStorage fallback
            await saveDataAsync('estoqueTorasAtual', estoqueAtual);
            await saveDataAsync('movimentacoesToras', movimentacoes);
        }
        
        hideLoading();
        alert(`Entrada de ${totalItens} toras realizada com sucesso!`);
        
        // Limpar tudo
        itensEntrada = [];
        renderizarTabelaEntrada();
        limparCamposEntrada();
        const romaneioInput = document.getElementById('romaneioEntrada');
        if (romaneioInput) {
            romaneioInput.value = '';
        }
        const romaneioSelect = document.getElementById('romaneioEntradaSelect');
        if (romaneioSelect) {
            romaneioSelect.value = '';
        }
        romaneioSelecionadoId = null;
        
        // Atualizar telas
        atualizarEstatisticas();
        carregarTabelaEstoque();
        
    } catch (error) {
        hideLoading();
        console.error('Erro ao registrar entrada:', error);
        alert('Erro ao processar entrada: ' + error.message);
    }
}

function limparFormularioEntrada() {
    document.getElementById('entradaForm').reset();
    document.getElementById('entradaData').value = new Date().toISOString().split('T')[0];
    itensEntrada = [];
    renderizarTabelaEntrada();
    const aviso = document.getElementById('editToraAviso');
    if (aviso) aviso.style.display = 'none';
    toraEmEdicao = null;
}

// Funções de saída de estoque
function abrirBaixaPorLote() {
    const container = document.getElementById('saidaFormContainer');
    const jaAberto = container && container.style.display !== 'none';
    if (jaAberto && (torasSelecionadasBaixa.length > 0 || romaneiosSaidaSelecionados.length > 0)) {
        saidaModo = 'lote';
        abrirSelecaoTorasParaAdicionar();
        return;
    }
    if (container) container.style.display = 'block';
    const dataEl = document.getElementById('saidaData');
    if (dataEl && !dataEl.value) dataEl.value = new Date().toISOString().split('T')[0];
    torasSelecionadasBaixa = [];
    torasSelecionadasModal = [];
    saidaModo = 'lote';
    const aviso = document.getElementById('saidaIndividualAviso');
    if (aviso) aviso.style.display = 'none';
    limparSelecaoRomaneiosSaida();
    limparBuscaPlaquetaSaida();
    atualizarTabelaTorasSaida();
    abrirSelecaoTorasParaAdicionar();
}

function abrirBaixaIndividual() {
    document.getElementById('saidaFormContainer').style.display = 'block';
    document.getElementById('saidaData').value = new Date().toISOString().split('T')[0];
    torasSelecionadasBaixa = [];
    saidaModo = 'individual';
    const aviso = document.getElementById('saidaIndividualAviso');
    if (aviso) aviso.style.display = 'block';
    limparSelecaoRomaneiosSaida();
    limparBuscaPlaquetaSaida();
    atualizarTabelaTorasSaida();
    
    // Focar no primeiro campo
    const busca = document.getElementById('saidaPlaquetaBusca');
    if (busca) busca.focus();
}

function carregarTorasDisponiveis() {
    const tbody = document.getElementById('torasDisponiveisTable');
    const especieFiltro = String((document.getElementById('filtroTorasEspecieModal') || {}).value || '').toLowerCase().trim();
    const rodoFiltro = String((document.getElementById('filtroTorasRodoModal') || {}).value || '').toLowerCase().trim();
    const comprimentoFiltro = String((document.getElementById('filtroTorasComprimentoModal') || {}).value || '').toLowerCase().trim();
    let torasDisponiveis = estoqueAtual.filter(tora => tora.status === 'disponivel');

    if (especieFiltro) {
        torasDisponiveis = torasDisponiveis.filter(tora =>
            String(tora.especie || '').toLowerCase().includes(especieFiltro) ||
            String(tora.plaqueta || '').toLowerCase().includes(especieFiltro)
        );
    }
    if (rodoFiltro) {
        torasDisponiveis = torasDisponiveis.filter(tora => {
            const rodo = Number(tora.diametro || 0);
            if (!Number.isFinite(rodo) || rodo <= 0) return false;
            const variants = [String(rodo), String(Math.trunc(rodo)), rodo.toFixed(1)];
            return variants.some(v => v.includes(rodoFiltro));
        });
    }
    if (comprimentoFiltro) {
        torasDisponiveis = torasDisponiveis.filter(tora => {
            const comp = Number(tora.comprimento || 0);
            if (!Number.isFinite(comp) || comp <= 0) return false;
            const variants = [String(comp), String(Math.trunc(comp)), comp.toFixed(1)];
            return variants.some(v => v.includes(comprimentoFiltro));
        });
    }
    
    if (torasDisponiveis.length === 0) {
        tbody.innerHTML = '<tr><td colspan="12" style="text-align: center;">Nenhuma tora disponível</td></tr>';
        const checkboxTodas = document.getElementById('selecionarTodas');
        if (checkboxTodas) checkboxTodas.checked = false;
        return;
    }

    const selecionadasSet = new Set(torasSelecionadasModal.map(t => String(t.id)));
    tbody.innerHTML = torasDisponiveis.map(tora => {
        const checked = selecionadasSet.has(String(tora.id)) ? 'checked' : '';
        return `
        <tr>
            <td>
                <input type="checkbox" value="${tora.id}" ${checked} onchange="toggleToraSelecao('${tora.id}', this.checked)">
            </td>
            <td>${tora.plaqueta}</td>
            <td>${tora.especie}</td>
            <td style="text-align: center;">${formatNumber(tora.diametro, 1)} cm</td>
            <td style="text-align: center;">${formatNumber(tora.comprimento, 1)} cm</td>
            <td style="text-align: center;">${tora.oco1 ? formatNumber(tora.oco1, 1) + ' cm' : '-'}</td>
            <td style="text-align: center;">${tora.oco2 ? formatNumber(tora.oco2, 1) + ' cm' : '-'}</td>
            <td style="text-align: center;">${tora.volumeDesconto ? formatNumber(tora.volumeDesconto, 3) : '-'}</td>
            <td style="text-align: right;">${formatNumber(tora.volumeLiquido, 3)} m³</td>
            <td style="text-align: right;">${formatCurrency(tora.precoCusto)}</td>
            <td style="text-align: right;">${formatCurrency((tora.volumeLiquido || 0) * (tora.precoCusto || 0))}</td>
            <td>${tora.localizacao || ''}</td>
        </tr>
    `;
    }).join('');

    const checkboxes = document.querySelectorAll('#torasDisponiveisTable input[type="checkbox"]');
    const checkboxTodas = document.getElementById('selecionarTodas');
    if (checkboxTodas) {
        checkboxTodas.checked = checkboxes.length > 0 && Array.from(checkboxes).every(cb => cb.checked);
    }
}

function filtrarTorasDisponiveis() {
    const sanitizeNumericFilterInput = (el) => {
        if (!el) return '';
        let v = String(el.value || '');
        v = v.replace(/[^0-9,.\s]/g, '').replace(/\s+/g, '');
        const firstSepIdx = v.search(/[,.]/);
        if (firstSepIdx >= 0) {
            const intPart = v.slice(0, firstSepIdx).replace(/[^0-9]/g, '');
            const fracPart = v.slice(firstSepIdx + 1).replace(/[,.]/g, '').replace(/[^0-9]/g, '');
            v = fracPart ? `${intPart}.${fracPart}` : intPart;
        }
        el.value = v;
        return v;
    };
    const rodoEl = document.getElementById('filtroTorasRodoModal');
    const compEl = document.getElementById('filtroTorasComprimentoModal');
    const rodoSan = sanitizeNumericFilterInput(rodoEl);
    const compSan = sanitizeNumericFilterInput(compEl);
    filtrosTorasModalState = {
        especie: String((document.getElementById('filtroTorasEspecieModal') || {}).value || ''),
        rodo: rodoSan,
        comprimento: compSan
    };
    carregarTorasDisponiveis();
}

function onBuscaTorasEnter(event) {
    if (!event || event.key !== 'Enter') return;
    event.preventDefault();
    filtrarTorasDisponiveis();
    const checkboxes = Array.from(document.querySelectorAll('#torasDisponiveisTable input[type="checkbox"]'));
    checkboxes.forEach((checkbox) => {
        if (!checkbox.checked) {
            checkbox.checked = true;
            toggleToraSelecao(checkbox.value, true, false);
        }
    });
    const especieEl = document.getElementById('filtroTorasEspecieModal');
    if (especieEl) especieEl.value = '';
    filtrosTorasModalState = {
        especie: '',
        rodo: String((document.getElementById('filtroTorasRodoModal') || {}).value || ''),
        comprimento: String((document.getElementById('filtroTorasComprimentoModal') || {}).value || '')
    };
    carregarTorasDisponiveis();
    const checkboxTodas = document.getElementById('selecionarTodas');
    if (checkboxTodas) checkboxTodas.checked = true;
}

function limparFiltrosTorasDisponiveisModal() {
    const especieEl = document.getElementById('filtroTorasEspecieModal');
    const rodoEl = document.getElementById('filtroTorasRodoModal');
    const compEl = document.getElementById('filtroTorasComprimentoModal');
    if (especieEl) especieEl.value = '';
    if (rodoEl) rodoEl.value = '';
    if (compEl) compEl.value = '';
    filtrosTorasModalState = { especie: '', rodo: '', comprimento: '' };
    carregarTorasDisponiveis();
}

function atualizarFiltrosTorasDisponiveisModal() {
    const especieEl = document.getElementById('filtroTorasEspecieModal');
    const rodoEl = document.getElementById('filtroTorasRodoModal');
    const compEl = document.getElementById('filtroTorasComprimentoModal');
    if (!especieEl || !rodoEl || !compEl) return;
    especieEl.value = String(filtrosTorasModalState.especie || '');
    rodoEl.value = String(filtrosTorasModalState.rodo || '');
    compEl.value = String(filtrosTorasModalState.comprimento || '');
}

function selecionarTodasToras() {
    const checkboxTodas = document.getElementById('selecionarTodas');
    const checkboxes = document.querySelectorAll('#torasDisponiveisTable input[type="checkbox"]');
    
    checkboxes.forEach(checkbox => {
        checkbox.checked = checkboxTodas.checked;
        toggleToraSelecao(checkbox.value, checkboxTodas.checked, false);
    });
}

function toggleToraSelecao(toraId, isChecked, updateCheckbox = true) {
    const tora = estoqueAtual.find(t => t.id === toraId);
    if (!tora) return;
    
    const index = torasSelecionadasModal.findIndex(t => t.id === toraId);
    
    if (isChecked) {
        const jaNaTabela = torasSelecionadasBaixa.some(t => String(t.id) === String(toraId));
        if (jaNaTabela && updateCheckbox) {
            if (window.ToastManager && typeof window.ToastManager.warning === 'function') {
                window.ToastManager.warning(`A tora ${tora.plaqueta || toraId} já está carregada na baixa`, 'Duplicidade');
            } else {
                alert(`A tora ${tora.plaqueta || toraId} já está carregada na baixa.`);
            }
        }
        if (index === -1 && !jaNaTabela) {
            torasSelecionadasModal.push(tora);
        }
    } else {
        if (index !== -1) {
            torasSelecionadasModal.splice(index, 1);
        }
    }
    
    // Atualizar checkbox "Selecionar Todas"
    if (updateCheckbox) {
        const checkboxes = document.querySelectorAll('#torasDisponiveisTable input[type="checkbox"]');
        const checkboxTodas = document.getElementById('selecionarTodas');
        const todasSelecionadas = Array.from(checkboxes).every(cb => cb.checked);
        checkboxTodas.checked = todasSelecionadas;
    }
}

function confirmarSelecaoToras() {
    if (torasSelecionadasModal.length === 0) {
        alert('Selecione pelo menos uma tora para baixa');
        return;
    }

    const map = new Map();
    (torasSelecionadasBaixa || []).forEach(t => { if (t && t.id != null) map.set(String(t.id), t); });
    (torasSelecionadasModal || []).forEach(t => { if (t && t.id != null) map.set(String(t.id), t); });
    torasSelecionadasBaixa = Array.from(map.values());
    torasSelecionadasModal = [];
    fecharModal('selecaoTorasModal');
    atualizarTabelaTorasSaida();
}

function adicionarToraManualSaida() {
    const plaquetaEl = document.getElementById('manualPlaquetaSaida');
    const especieEl = document.getElementById('manualEspecieSaida');
    const rodoEl = document.getElementById('manualRodoSaida');
    const compEl = document.getElementById('manualComprimentoSaida');
    const oco1El = document.getElementById('manualOco1Saida');
    const oco2El = document.getElementById('manualOco2Saida');

    const plaqueta = String((plaquetaEl && plaquetaEl.value) || '').trim();
    const especie = String((especieEl && especieEl.value) || '').trim();
    const diametro = parseFloat((rodoEl && rodoEl.value) || 0) || 0;
    const comprimento = parseFloat((compEl && compEl.value) || 0) || 0;
    const oco1 = parseFloat((oco1El && oco1El.value) || 0) || 0;
    const oco2 = parseFloat((oco2El && oco2El.value) || 0) || 0;

    if (!plaqueta || !especie || diametro <= 0 || comprimento <= 0) {
        alert('Preencha Plaqueta, Espécie, Rodo e Comprimento para adicionar manualmente.');
        return;
    }

    const jaExistePlaqueta = (torasSelecionadasBaixa || []).some(t => String((t && t.plaqueta) || '').toLowerCase() === plaqueta.toLowerCase());
    if (jaExistePlaqueta) {
        if (window.ToastManager && typeof window.ToastManager.warning === 'function') {
            window.ToastManager.warning(`A plaqueta ${plaqueta} já está na tabela de baixa`, 'Duplicidade');
        } else {
            alert(`A plaqueta ${plaqueta} já está na tabela de baixa.`);
        }
        return;
    }

    const volumeBruto = calcularVolumeTora(diametro, comprimento);
    const volumeDesconto = calcularDescontoOco(oco1, oco2, comprimento);
    const volumeLiquido = Math.max(0, (parseFloat(volumeBruto) || 0) - (parseFloat(volumeDesconto) || 0));

    const toraManual = {
        id: `MANUAL_SAIDA_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
        plaqueta,
        especie,
        diametro,
        comprimento,
        oco1: oco1 > 0 ? oco1 : null,
        oco2: oco2 > 0 ? oco2 : null,
        volumeDesconto: volumeDesconto > 0 ? volumeDesconto : 0,
        volumeLiquido,
        precoCusto: 0,
        localizacao: 'Manual (fora do estoque)',
        manualForaEstoque: true
    };

    torasSelecionadasBaixa.push(toraManual);
    atualizarTabelaTorasSaida();

    if (plaquetaEl) plaquetaEl.value = '';
    if (especieEl) especieEl.value = '';
    if (rodoEl) rodoEl.value = '';
    if (compEl) compEl.value = '';
    if (oco1El) oco1El.value = '';
    if (oco2El) oco2El.value = '';
}

function abrirSelecaoTorasParaAdicionar() {
    torasSelecionadasModal = (torasSelecionadasBaixa || []).slice();
    const modal = document.getElementById('selecaoTorasModal');
    if (modal) modal.style.display = 'block';
    atualizarFiltrosTorasDisponiveisModal();
    carregarTorasDisponiveis();
}

function atualizarTabelaTorasSaida() {
    const tbody = document.getElementById('torasSaidaTable');
    const paginacaoEl = document.getElementById('paginacaoSaida');
    
    if (torasSelecionadasBaixa.length === 0) {
        tbody.innerHTML = '<tr><td colspan="12" style="text-align: center;">Nenhuma tora selecionada</td></tr>';
        atualizarResumoSaida();
        if (paginacaoEl) paginacaoEl.innerHTML = '';
        return;
    }

    const itensPorPaginaSaida = 10;
    const totalPaginas = Math.max(1, Math.ceil(torasSelecionadasBaixa.length / itensPorPaginaSaida));
    if (paginaAtualSaida > totalPaginas) paginaAtualSaida = totalPaginas;
    if (paginaAtualSaida < 1) paginaAtualSaida = 1;
    const inicio = (paginaAtualSaida - 1) * itensPorPaginaSaida;
    const itensPagina = torasSelecionadasBaixa.slice(inicio, inicio + itensPorPaginaSaida);

    tbody.innerHTML = itensPagina.map(tora => {
        const manualBadge = tora && tora.manualForaEstoque
            ? ' <span style="display:inline-block;padding:2px 6px;border-radius:10px;background:#fff3cd;color:#856404;font-size:11px;font-weight:600;">Manual</span>'
            : '';
        return `
        <tr>
            <td>${tora.plaqueta}${manualBadge}</td>
            <td>${tora.especie}</td>
            <td style="text-align: center;">${formatNumber(tora.diametro, 1)} cm</td>
            <td style="text-align: center;">${formatNumber(tora.comprimento, 1)} cm</td>
            <td style="text-align: center;">${tora.oco1 ? formatNumber(tora.oco1, 1) + ' cm' : '-'}</td>
            <td style="text-align: center;">${tora.oco2 ? formatNumber(tora.oco2, 1) + ' cm' : '-'}</td>
            <td style="text-align: center;">${tora.volumeDesconto ? formatNumber(tora.volumeDesconto, 3) : '-'}</td>
            <td style="text-align: right;">${formatNumber(tora.volumeLiquido, 3)} m³</td>
            <td style="text-align: right;">${formatCurrency(tora.precoCusto)}</td>
            <td style="text-align: right;">${formatCurrency((tora.volumeLiquido || 0) * (tora.precoCusto || 0))}</td>
            <td>${tora.localizacao || ''}</td>
            <td class="text-center actions-cell">
                <button type="button" onclick="removerToraSaida('${tora.id}')" class="btn-danger btn-small">
                    <i class="fas fa-trash"></i>
                </button>
            </td>
        </tr>
    `;
    }).join('');
    renderizarPaginacaoPadrao('paginacaoSaida', torasSelecionadasBaixa.length, paginaAtualSaida, itensPorPaginaSaida, 'mudarPaginaSaida');
    atualizarResumoSaida();
}

function mudarPaginaSaida(p) {
    paginaAtualSaida = p;
    atualizarTabelaTorasSaida();
}

function removerToraSaida(toraId) {
    torasSelecionadasBaixa = torasSelecionadasBaixa.filter(t => t.id !== toraId);
    atualizarTabelaTorasSaida();
}

function atualizarResumoSaida() {
    const qtdEl = document.getElementById('saidaResumoQtd');
    const volEl = document.getElementById('saidaResumoVolume');
    const qtd = torasSelecionadasBaixa.length;
    const total = torasSelecionadasBaixa.reduce((acc, t) => acc + (parseFloat(t.volumeLiquido) || 0), 0);
    if (qtdEl) qtdEl.textContent = String(qtd);
    if (volEl) volEl.textContent = `${formatNumber(total, 3)} m³`;
}

function limparSelecaoRomaneiosSaida() {
    const select = document.getElementById('romaneiosSaidaSelect');
    if (select) select.value = '';
    romaneiosSaidaSelecionados = [];
    renderizarRomaneiosSaidaSelecionados();
}

function obterRomaneiosSaidaSelecionados() {
    return romaneiosSaidaSelecionados.map(r => ({ ...r }));
}

function adicionarRomaneioSaidaSelecionado() {
    const select = document.getElementById('romaneiosSaidaSelect');
    if (!select) return;
    const id = select.value;
    if (!id) return;
    const jaExiste = romaneiosSaidaSelecionados.some(r => String(r.id) === String(id));
    if (jaExiste) return;
    const r = romaneiosSaidaDisponiveis.find(x => String(x.id) === String(id));
    const itensRaw = r ? (r.itens || r.items || r.romaneioItems || []) : [];
    const itens = Array.isArray(itensRaw) ? itensRaw : (itensRaw && typeof itensRaw === 'object' ? Object.values(itensRaw) : []);
    const dataRom = r?.updatedAt || r?.updated || r?.data || r?.dataHora || r?.created || r?.timestamp || '';
    const pessoaRom = String(r?.clienteNome || r?.cliente?.nome || r?.fornecedorNome || r?.fornecedor?.nome || r?.cliente || r?.fornecedor || 'N/A');
    const volumeRom =
        (r && r.totais && (r.totais.volumeSerraria || r.totais.volumeTotal || r.totais.volume)) ||
        r?.totalVolume ||
        r?.volumeSerraria ||
        r?.volumeTotal ||
        r?.volume ||
        itens.reduce((acc, i) => acc + (parseFloat(i.volumeSerraria || i.volumeLiquido || i.volumeTotal || i.volume || 0) || 0), 0);
    const valorRom = Number(
        (r && r.totais && (r.totais.valorTotal || r.totais.valor)) ||
        r?.totalValor ||
        r?.valorTotal ||
        r?.valor ||
        itens.reduce((acc, i) => acc + (parseFloat(i.valorTotal || i.valor || i.total || i.precoTotal || 0) || 0), 0)
    ) || 0;
    const label = r
        ? `${formatDate(dataRom)} - ${pessoaRom} - ${formatNumber(Number(volumeRom) || 0, 3)} m³ - ${formatCurrency(valorRom)}`
        : (select.options[select.selectedIndex]?.textContent || id);
    romaneiosSaidaSelecionados.push({
        id,
        tipo: r?.tipo || '',
        label,
        volumeSerraria: Number(volumeRom) || 0,
        valorTotal: valorRom,
        data: dataRom,
        clienteNome: pessoaRom
    });
    select.value = '';
    renderizarRomaneiosSaidaSelecionados();
}

function removerRomaneioSaidaSelecionado(id) {
    romaneiosSaidaSelecionados = romaneiosSaidaSelecionados.filter(r => String(r.id) !== String(id));
    renderizarRomaneiosSaidaSelecionados();
}

function renderizarRomaneiosSaidaSelecionados() {
    const container = document.getElementById('romaneiosSaidaSelecionados');
    if (!container) return;
    if (romaneiosSaidaSelecionados.length === 0) {
        container.innerHTML = '<div style="color:#999;">Nenhum romaneio selecionado</div>';
        return;
    }
    container.innerHTML = romaneiosSaidaSelecionados.map(r => `
        <div class="romaneio-chip">
            <span class="romaneio-chip-label" title="${r.label}">${r.label}</span>
            <button type="button" onclick="removerRomaneioSaidaSelecionado('${String(r.id).replace(/'/g, "\\'")}')" class="btn-danger btn-small">
                <i class="fas fa-trash"></i>
            </button>
        </div>
    `).join('');
}

function montarResumoRomaneioObservacao(lista) {
    const roms = Array.isArray(lista) ? lista : [];
    if (!roms.length) return '';
    return roms.map(r => {
        const label = String((r && r.label) || '').trim();
        const parts = label ? label.split(' - ').map(p => String(p || '').trim()) : [];
        const tipo = String((r && r.tipo) || parts[0] || 'ROM').toUpperCase();
        const data = String(r?.data || r?.updatedAt || r?.created || parts[1] || '').trim();
        const cliente = String(r?.clienteNome || r?.cliente?.nome || r?.fornecedorNome || r?.fornecedor?.nome || parts[2] || '').trim();
        return `Romaneio ${tipo} - ${cliente || 'N/A'}${data ? ` - ${data}` : ''}`;
    }).filter(Boolean).join(' | ');
}

async function registrarSaida(event) {
    event.preventDefault();
    
    try {
        if (torasSelecionadasBaixa.length === 0) {
            alert('Selecione pelo menos uma tora para baixa');
            return;
        }
        
        const saidaData = document.getElementById('saidaData').value;
        const documento = saidaModo === 'individual' ? 'Baixa Individual' : 'Baixa por Lote';
        const tipoSaida = document.getElementById('tipoSaida').value;
        const motivo = document.getElementById('motivoSaida').value;
        const romaneiosRelacionados = obterRomaneiosSaidaSelecionados();
        const resumoRomaneiosObs = montarResumoRomaneioObservacao(romaneiosRelacionados);
        const remessaId = generateUniqueId('REM');
        
        if (!tipoSaida) {
            alert('Selecione o tipo de saída');
            return;
        }
        
        const novasMovimentacoes = [];
        // Processar cada tora selecionada
        for (const tora of torasSelecionadasBaixa) {
            const ehManualForaEstoque = !!(tora && tora.manualForaEstoque);
            const toraEstoque = ehManualForaEstoque ? null : estoqueAtual.find(t => t.id === tora.id);
            if (toraEstoque) {
                toraEstoque.status = 'baixada';
                toraEstoque.dataBaixa = saidaData;
                toraEstoque.motivoBaixa = motivo;
                toraEstoque.romaneiosRelacionados = romaneiosRelacionados;
                toraEstoque.remessaId = remessaId;
            }
            
            // Registrar movimentação
            const observacoesParts = [String(tipoSaida || '').toUpperCase()];
            if (resumoRomaneiosObs) observacoesParts.push(resumoRomaneiosObs);
            if (motivo && String(motivo).trim()) observacoesParts.push(String(motivo).trim());
            const observacoes = observacoesParts.filter(Boolean).join(' - ');
            const movimentacao = {
                id: generateUniqueId('MOV'),
                data: saidaData,
                tipo: 'saida',
                tipoSaida: tipoSaida,
                toraId: tora.id,
                plaqueta: tora.plaqueta,
                especie: tora.especie,
                volume: tora.volumeLiquido,
                documento: documento,
                observacoes: observacoes,
                romaneiosRelacionados: romaneiosRelacionados,
                remessaId: remessaId,
                toraManualForaEstoque: ehManualForaEstoque,
                created: new Date().toISOString()
            };
            
            movimentacoes.push(movimentacao);
            novasMovimentacoes.push(movimentacao);
        }
        
        // Salvar dados (por registro quando disponível)
        if (window.firebaseService && typeof window.firebaseService.updatePaths === 'function') {
            const updates = {};
            const alteradas = new Set(torasSelecionadasBaixa.filter(t => !(t && t.manualForaEstoque)).map(t => t.id));
            for (const tora of estoqueAtual) {
                if (alteradas.has(tora.id)) {
                    updates[`estoqueTorasAtual/${String(tora.id)}`] = tora;
                }
            }
            novasMovimentacoes.forEach(mov => {
                updates[`movimentacoesToras/${String(mov.id)}`] = mov;
            });
            await window.firebaseService.updatePaths(updates);
        } else if (window.firebaseService && typeof window.firebaseService.saveToFirebase === 'function') {
            const alteradas = new Set(torasSelecionadasBaixa.filter(t => !(t && t.manualForaEstoque)).map(t => t.id));
            const ops = [];
            for (const tora of estoqueAtual) {
                if (alteradas.has(tora.id)) {
                    ops.push(window.firebaseService.saveToFirebase('estoqueTorasAtual', String(tora.id), tora));
                }
            }
            novasMovimentacoes.forEach(mov => {
                ops.push(window.firebaseService.saveToFirebase('movimentacoesToras', String(mov.id), mov));
            });
            await Promise.all(ops);
        } else {
            await saveDataAsync('estoqueTorasAtual', estoqueAtual);
            await saveDataAsync('movimentacoesToras', movimentacoes);
        }
        
        const qtdManuais = torasSelecionadasBaixa.filter(t => t && t.manualForaEstoque).length;
        const qtdEstoque = torasSelecionadasBaixa.length - qtdManuais;
        if (qtdManuais > 0) {
            alert(`Baixa registrada com sucesso! ${qtdEstoque} tora(s) baixada(s) do estoque e ${qtdManuais} tora(s) manual(is) registrada(s) no histórico.`);
        } else {
            alert(`Baixa registrada com sucesso! ${qtdEstoque} tora(s) removida(s) do estoque.`);
        }
        
        // Limpar seleção e formulário
        cancelarSaida();
        
        // Atualizar dados
        atualizarEstatisticas();
        carregarTabelaEstoque();
        
    } catch (error) {
        console.error('Erro ao registrar saída:', error);
        alert('Erro ao registrar saída: ' + error.message);
    }
}

function cancelarSaida() {
    document.getElementById('saidaFormContainer').style.display = 'none';
    document.getElementById('saidaForm').reset();
    torasSelecionadasBaixa = [];
    saidaModo = 'lote';
    limparBuscaPlaquetaSaida();
    limparSelecaoRomaneiosSaida();
    const aviso = document.getElementById('saidaIndividualAviso');
    if (aviso) aviso.style.display = 'none';
    atualizarTabelaTorasSaida();
}

async function estornarRemessaBaixa() {
    try {
        const input = document.getElementById('filtroRemessaBaixa');
        const remessa = input ? String(input.value || '').trim() : '';
        if (!remessa) {
            alert('Informe a Remessa de Baixa (Ex: REM...) para estornar.');
            if (input) input.focus();
            return;
        }
        const remessaNorm = remessa.toLowerCase();
        const candidatos = movimentacoes.filter(m => m && String(m.remessaId || '').toLowerCase() === remessaNorm && m.tipo === 'saida');
        if (!candidatos.length) {
            alert('Nenhuma baixa encontrada para esta remessa.');
            return;
        }
        const confirmMsg = `Encontradas ${candidatos.length} movimentações de SAÍDA para a remessa ${remessa}.\n\n` +
            'O estorno irá devolver as toras ao estoque e remover estas movimentações.\n\n' +
            'Deseja realmente estornar esta remessa?';
        if (!confirm(confirmMsg)) return;
        const idsMov = new Set(candidatos.map(m => String(m.id)));
        const idsToras = new Set(candidatos.map(m => m.toraId).filter(Boolean));
        const alteradas = [];
        estoqueAtual.forEach(tora => {
            if (!tora || !idsToras.has(tora.id)) return;
            tora.status = 'disponivel';
            delete tora.dataBaixa;
            delete tora.motivoBaixa;
            delete tora.romaneiosRelacionados;
            delete tora.remessaId;
            alteradas.push(tora);
        });
        if (!alteradas.length) {
            alert('Nenhuma tora correspondente encontrada no estoque. Estorno cancelado.');
            return;
        }
        const movAntes = movimentacoes.length;
        movimentacoes = movimentacoes.filter(m => !idsMov.has(String(m.id)));
        const removidas = movAntes - movimentacoes.length;
        if (window.firebaseService && typeof window.firebaseService.updatePaths === 'function') {
            const updates = {};
            alteradas.forEach(tora => {
                updates[`estoqueTorasAtual/${String(tora.id)}`] = tora;
            });
            candidatos.forEach(mov => {
                updates[`movimentacoesToras/${String(mov.id)}`] = null;
            });
            await window.firebaseService.updatePaths(updates);
        } else if (window.firebaseService && typeof window.firebaseService.saveToFirebase === 'function') {
            const ops = [];
            alteradas.forEach(tora => {
                ops.push(window.firebaseService.saveToFirebase('estoqueTorasAtual', String(tora.id), tora));
            });
            candidatos.forEach(mov => {
                ops.push(window.firebaseService.saveToFirebase('movimentacoesToras', String(mov.id), null));
            });
            await Promise.all(ops);
        } else {
            await saveDataAsync('estoqueTorasAtual', estoqueAtual);
            await saveDataAsync('movimentacoesToras', movimentacoes);
        }
        alert(`Remessa ${remessa} estornada com sucesso!\nToras restauradas: ${alteradas.length}\nMovimentações removidas: ${removidas}`);
        filtrarMovimentacoes();
        atualizarEstatisticas();
        carregarTabelaEstoque();
    } catch (error) {
        console.error('Erro ao estornar remessa:', error);
        alert('Erro ao estornar remessa: ' + error.message);
    }
}

function limparBuscaPlaquetaSaida() {
    const input = document.getElementById('saidaPlaquetaBusca');
    if (input) input.value = '';
    toraEncontradaBaixa = null;
    const info = document.getElementById('saidaToraInfo');
    if (info) info.textContent = '';
}

function buscarToraPorPlaqueta() {
    const input = document.getElementById('saidaPlaquetaBusca');
    const info = document.getElementById('saidaToraInfo');
    if (!input) return;
    const termo = String(input.value || '').trim().toLowerCase();
    if (!termo) {
        toraEncontradaBaixa = null;
        if (info) info.textContent = '';
        return;
    }
    const disponiveis = estoqueAtual.filter(t => t.status === 'disponivel');
    let candidatos = disponiveis.filter(t => String(t.plaqueta || '').toLowerCase().includes(termo));
    if (candidatos.length === 0) {
        toraEncontradaBaixa = null;
        if (info) info.textContent = 'Nenhuma tora encontrada';
        return;
    }
    const exata = candidatos.find(t => String(t.plaqueta || '').toLowerCase() === termo);
    const selecionada = exata || (candidatos.length === 1 ? candidatos[0] : null);
    if (!selecionada) {
        toraEncontradaBaixa = null;
        if (info) info.textContent = `Encontradas ${candidatos.length} toras, refine a busca`;
        return;
    }
    toraEncontradaBaixa = selecionada;
    if (info) {
        const vol = formatNumber(selecionada.volumeLiquido || 0, 3);
        const preco = formatCurrency(selecionada.precoCusto || 0);
        info.textContent = `${selecionada.plaqueta} | ${selecionada.especie} | ${vol} m³ | ${preco}`;
    }
}

function adicionarToraBaixaPorPlaqueta() {
    if (!toraEncontradaBaixa) {
        alert('Busque uma plaqueta válida antes de adicionar.');
        return;
    }
    const exists = torasSelecionadasBaixa.some(t => String(t.id) === String(toraEncontradaBaixa.id));
    if (exists) {
        alert('Esta tora já está na lista de baixa.');
        return;
    }
    torasSelecionadasBaixa.push(toraEncontradaBaixa);
    atualizarTabelaTorasSaida();
    limparBuscaPlaquetaSaida();
}

function onSaidaPlaquetaKeydown(event) {
    if (!event || event.key !== 'Enter') return;
    event.preventDefault();
    buscarToraPorPlaqueta();
    adicionarToraBaixaPorPlaqueta();
}

function onManualSaidaKeydown(event, nextFieldId = '') {
    if (!event || event.key !== 'Enter') return;
    event.preventDefault();
    if (nextFieldId) {
        const nextEl = document.getElementById(nextFieldId);
        if (nextEl) {
            nextEl.focus();
            if (typeof nextEl.select === 'function') nextEl.select();
        }
        return;
    }
    adicionarToraManualSaida();
    const firstEl = document.getElementById('manualPlaquetaSaida');
    if (firstEl) firstEl.focus();
}

// Funções de consulta de estoque
function atualizarEstatisticas() {
    const torasDisponiveis = estoqueAtual.filter(t => t.status === 'disponivel');
    
    // Total de toras
    document.getElementById('totalToras').textContent = torasDisponiveis.length;
    
    // Volume total
    const volumeTotal = torasDisponiveis.reduce((total, tora) => total + (tora.volumeLiquido || 0), 0);
    document.getElementById('volumeTotal').textContent = formatNumber(volumeTotal, 3) + ' m³';
    
    // Valor do estoque
    const valorTotal = torasDisponiveis.reduce((total, tora) => total + ((tora.volumeLiquido || 0) * (tora.precoCusto || 0)), 0);
    document.getElementById('valorEstoque').textContent = formatCurrency(valorTotal);
    
    // Espécies únicas
    const especies = [...new Set(torasDisponiveis.map(tora => tora.especie))];
    document.getElementById('especiesUnicas').textContent = especies.length;
}

function carregarTabelaEstoque(filtro = {}) {
    const tbody = document.getElementById('estoqueTable');
    filtroEstoqueAtual = filtro || {};
    let torasDisponiveis = estoqueAtual.filter(t => t.status === 'disponivel');
    
    // Aplicar filtros
    if (filtro.especie) {
        torasDisponiveis = torasDisponiveis.filter(t => t.especie === filtro.especie);
    }
    
    if (filtro.localizacao) {
        torasDisponiveis = torasDisponiveis.filter(t => t.localizacao === filtro.localizacao);
    }
    
    if (filtro.busca) {
        const buscaLower = filtro.busca.toLowerCase();
        torasDisponiveis = torasDisponiveis.filter(t => 
            t.plaqueta.toLowerCase().includes(buscaLower) ||
            t.especie.toLowerCase().includes(buscaLower) ||
            (t.localizacao && t.localizacao.toLowerCase().includes(buscaLower))
        );
    }
    
    // Ordenar por data de entrada (mais recentes primeiro)
    torasDisponiveis.sort((a, b) => new Date(b.data) - new Date(a.data));

    estoqueFiltrado = torasDisponiveis.slice();
    const resumoEl = document.getElementById('resumoEstoque');
    const totalVol = estoqueFiltrado.reduce((acc, t) => acc + (t.volumeLiquido || 0), 0);
    const totalVal = estoqueFiltrado.reduce((acc, t) => acc + ((t.volumeLiquido || 0) * (t.precoCusto || 0)), 0);
    if (resumoEl) {
        resumoEl.innerHTML = `
            <div class="summary-row">
                <span>Total de Toras:</span>
                <span>${estoqueFiltrado.length}</span>
            </div>
            <div class="summary-row">
                <span>Volume Líquido Total:</span>
                <span>${formatNumber(totalVol, 3)} m³</span>
            </div>
            <div class="summary-row">
                <span>Valor Total:</span>
                <span>${formatCurrency(totalVal)}</span>
            </div>
        `;
    }

    if (torasDisponiveis.length === 0) {
        tbody.innerHTML = '<tr><td colspan="10" style="text-align: center;">Nenhuma tora encontrada no estoque</td></tr>';
        renderizarPaginacaoPadrao('paginacaoEstoque', 0, 1, 10, 'mudarPaginaEstoque');
        return;
    }

    const itensPorPaginaEstoque = 10;
    const totalPaginas = Math.max(1, Math.ceil(torasDisponiveis.length / itensPorPaginaEstoque));
    if (paginaAtualEstoque > totalPaginas) paginaAtualEstoque = totalPaginas;
    if (paginaAtualEstoque < 1) paginaAtualEstoque = 1;
    const inicio = (paginaAtualEstoque - 1) * itensPorPaginaEstoque;
    const pagina = torasDisponiveis.slice(inicio, inicio + itensPorPaginaEstoque);

    tbody.innerHTML = pagina.map(tora => `
        <tr>
            <td>${tora.plaqueta}</td>
            <td>${tora.especie}</td>
            <td style="text-align: center;">${formatNumber(tora.diametro, 1)}</td>
            <td style="text-align: center;">${formatNumber(tora.comprimento, 1)}</td>
            <td style="text-align: right;">${formatNumber(tora.volumeBruto, 3)}</td>
            <td style="text-align: right;">${formatNumber(tora.volumeLiquido, 3)}</td>
            <td style="text-align: right;">${formatCurrency(tora.precoCusto)}</td>
            <td>${tora.localizacao || ''}</td>
            <td style="text-align: center;">${formatDate(tora.data)}</td>
            <td class="text-center actions-cell">
                <button onclick="editarTora('${tora.id}')" class="btn-primary btn-small">
                    <i class="fas fa-edit"></i>
                </button>
                <button onclick="excluirTora('${tora.id}')" class="btn-danger btn-small">
                    <i class="fas fa-trash"></i>
                </button>
            </td>
        </tr>
    `).join('');
    renderizarPaginacaoPadrao('paginacaoEstoque', torasDisponiveis.length, paginaAtualEstoque, itensPorPaginaEstoque, 'mudarPaginaEstoque');
}

function mudarPaginaEstoque(p) {
    paginaAtualEstoque = p;
    carregarTabelaEstoque(filtroEstoqueAtual);
}

function editarTora(toraId) {
    const tora = estoqueAtual.find(t => String(t.id) === String(toraId));
    if (!tora) return;
    toraEmEdicao = tora;
    showTab('entrada');
    const aviso = document.getElementById('editToraAviso');
    if (aviso) aviso.style.display = 'block';
    const entradaData = document.getElementById('entradaData');
    if (entradaData) entradaData.value = tora.data || new Date().toISOString().split('T')[0];
    const plaqueta = document.getElementById('plaquetaEntrada');
    if (plaqueta) plaqueta.value = tora.plaqueta || '';
    const especie = document.getElementById('especieEntrada');
    if (especie) especie.value = tora.especie || '';
    const diametro = document.getElementById('diametroEntrada');
    if (diametro) diametro.value = tora.diametro || '';
    const comprimento = document.getElementById('comprimentoEntrada');
    if (comprimento) comprimento.value = tora.comprimento || '';
    const oco1 = document.getElementById('oco1Entrada');
    if (oco1) oco1.value = tora.oco1 || '';
    const oco2 = document.getElementById('oco2Entrada');
    if (oco2) oco2.value = tora.oco2 || '';
    const preco = document.getElementById('precoEntrada');
    if (preco) preco.value = formatCurrency(tora.precoCusto || 0);
    const m3Bruto = document.getElementById('m3BrutoEntrada');
    if (m3Bruto) m3Bruto.value = tora.volumeBruto || '';
    const m3Liquido = document.getElementById('m3LiquidoEntrada');
    if (m3Liquido) m3Liquido.value = tora.volumeLiquido || '';
    const foco = document.getElementById('plaquetaEntrada');
    if (foco) foco.focus();
}

function filtrarEstoque() {
    const filtro = {
        especie: document.getElementById('filtroEspecie').value,
        localizacao: document.getElementById('filtroLocalizacao').value,
        busca: document.getElementById('searchEstoque').value
    };
    paginaAtualEstoque = 1;
    carregarTabelaEstoque(filtro);
}

function atualizarFiltros() {
    if (!Array.isArray(estoqueAtual)) return;

    // Atualizar filtro de espécies
    const especies = [...new Set(estoqueAtual.filter(t => t && t.status === 'disponivel').map(t => t.especie))];
    const selectEspecie = document.getElementById('filtroEspecie');
    if (selectEspecie) {
        selectEspecie.innerHTML = '<option value="">Todas as espécies</option>';
        especies.filter(e => e).sort().forEach(especie => {
            const option = document.createElement('option');
            option.value = especie;
            option.textContent = especie;
            selectEspecie.appendChild(option);
        });
    }
    
    // Atualizar filtro de localizações
    const localizacoes = [...new Set(estoqueAtual.filter(t => t && t.status === 'disponivel' && t.localizacao).map(t => t.localizacao))];
    const selectLocalizacao = document.getElementById('filtroLocalizacao');
    if (selectLocalizacao) {
        selectLocalizacao.innerHTML = '<option value="">Todas as localizações</option>';
        localizacoes.filter(l => l).sort().forEach(localizacao => {
            const option = document.createElement('option');
            option.value = localizacao;
            option.textContent = localizacao;
            selectLocalizacao.appendChild(option);
        });
    }
}

async function excluirTora(toraId) {
    if (!confirm('Deseja excluir esta tora do estoque? Esta ação não pode ser desfeita.')) {
        return;
    }
    
    try {
        // Capturar tora antes de remover para registrar movimentação corretamente
        const toraOriginal = estoqueAtual.find(t => t.id === toraId);
        // Remover do estoque
        estoqueAtual = estoqueAtual.filter(t => t.id !== toraId);
        
        // Registrar movimentação de exclusão
        if (toraOriginal) {
            const movimentacao = {
                id: generateUniqueId('MOV'),
                data: new Date().toISOString().split('T')[0],
                tipo: 'exclusao',
                toraId: toraId,
                plaqueta: toraOriginal.plaqueta,
                especie: toraOriginal.especie,
                volume: toraOriginal.volumeLiquido,
                observacoes: 'Exclusão do sistema',
                created: new Date().toISOString()
            };
            movimentacoes.push(movimentacao);
        }
        
        // Salvar dados (por registro quando disponível)
        if (window.firebaseService && typeof window.firebaseService.saveToFirebase === 'function') {
            await window.firebaseService.saveToFirebase('estoqueTorasAtual', String(toraId), null);
            const mov = movimentacoes[movimentacoes.length - 1];
            if (mov) {
                await window.firebaseService.saveToFirebase('movimentacoesToras', String(mov.id), mov);
            }
        } else {
            await saveData('estoqueTorasAtual', estoqueAtual);
            await saveData('movimentacoesToras', movimentacoes);
        }
        
        // Atualizar interface
        atualizarEstatisticas();
        carregarTabelaEstoque();
        atualizarFiltros();
        
        alert('Tora excluída com sucesso!');
        
    } catch (error) {
        console.error('Erro ao excluir tora:', error);
        alert('Erro ao excluir tora: ' + error.message);
    }
}

// Funções de movimentações
function isCarregoPedidoLike(r) {
    if (!r) return false;
    const parts = [];
    if (typeof r === 'string') {
        parts.push(r);
    } else if (typeof r === 'object') {
        parts.push(r.tipo, r.origem, r.label, r.documento, r.descricao, r.nome);
    }
    const joined = parts.filter(Boolean).map(s => String(s).toLowerCase()).join(' ');
    if (!joined) return false;
    if (joined.includes('carrego')) return true;
    if (joined.includes('carregamento')) return true;
    return false;
}

async function calcularResumoMovimentacoes(lista) {
    const totalVol = lista.reduce((acc, m) => acc + (m.volume || 0), 0);
    const totalEntradas = lista.filter(m => m.tipo === 'entrada').length;
    const totalSaidas = lista.filter(m => m.tipo === 'saida').length;
    const saidas = lista.filter(m => m.tipo === 'saida');
    const volumeTorasSaidas = saidas.reduce((acc, m) => acc + (m.volume || 0), 0);
    const extractRomaneioIdsFromLabel = (label) => {
        const s = String(label || '');
        const ids = [];
        const re = /([A-Z]{2,5}[_-]\d{10,}[_A-Za-z0-9-]+)/g;
        let match;
        while ((match = re.exec(s)) !== null) {
            if (match[1]) ids.push(match[1]);
        }
        return ids;
    };
    const isCarregoItem = (item) => {
        if (!item) return false;
        const parts = [
            item.tipo,
            item.origem,
            item.descricao,
            item.produtoNome,
            item.nome,
            item.observacoes
        ].filter(Boolean).map(v => String(v).toLowerCase());
        if (!parts.length) return false;
        const joined = parts.join(' ');
        return joined.includes('carrego') || joined.includes('carregamento');
    };
    const getRomaneioItems = (r) => {
        if (!r || typeof r !== 'object') return [];
        const raw = r.itens || r.items || r.romaneioItems || [];
        if (Array.isArray(raw)) return raw;
        if (raw && typeof raw === 'object') return Object.values(raw);
        return [];
    };
    const isRomaneioLike = (r) => {
        if (!r || typeof r !== 'object') return false;
        const tipo = String(r.tipo || r.origem || '').toUpperCase();
        if (['TORA','TL','PCT','PES','ROM','ROMANEIO','ROMANEIO_TL','ROMANEIO_PCT','ROMANEIO_PES','ROMANEIO_TORA'].includes(tipo)) return true;
        const hasId = !!(r.romaneioId || r.numeroRomaneio);
        const itens = getRomaneioItems(r);
        const hasRomItem = itens.some(i => i && (i.volumeSerraria !== undefined || i.volumeLiquido !== undefined || i.espessura !== undefined || i.largura !== undefined || i.comprimento !== undefined));
        return hasId && hasRomItem;
    };
    const labelLooksRomaneio = (label) => {
        const s = String(label || '').trim();
        return /^(ROM|TORA|TL|PCT|PES)\b/i.test(s);
    };
    const tipoFromLabel = (label) => {
        const s = String(label || '').trim().toUpperCase();
        if (!s) return '';
        if (s.startsWith('TL')) return 'TL';
        if (s.startsWith('PCT')) return 'PCT';
        if (s.startsWith('PES')) return 'PES';
        if (s.startsWith('TORA')) return 'TORA';
        return '';
    };
    const isSerradoTipo = (tipo) => {
        const t = String(tipo || '').toUpperCase();
        return t === 'TL' || t === 'PCT' || t === 'PES' || t === 'ROMANEIO_TL' || t === 'ROMANEIO_PCT' || t === 'ROMANEIO_PES';
    };
    const romaneiosAll = []
        .concat(Array.isArray(romaneiosSaidaDisponiveis) ? romaneiosSaidaDisponiveis : [])
        .concat(Array.isArray(romaneiosDisponiveis) ? romaneiosDisponiveis : []);
    const romaneioMap = new Map();
    romaneiosAll.forEach(r => {
        const keys = [r && r.id, r && r.romaneioId, r && r.key, r && r.firebaseKey, r && r.uniqueKey, r && r.numero, r && r.numeroRomaneio].filter(Boolean);
        keys.forEach(k => romaneioMap.set(String(k), r));
    });
    const refs = [];
    const idsFromRefs = new Set();
    saidas.forEach(m => {
        const listaRel = Array.isArray(m.romaneiosRelacionados) ? m.romaneiosRelacionados : [];
        listaRel.forEach(r => {
            if (isCarregoPedidoLike(r)) return;
            const id = (r && typeof r === 'object')
                ? (r.id || r.romaneioId || r.value || r.key || r.firebaseKey || r.uniqueKey)
                : r;
            const label = (r && r.label) ? r.label : '';
            const labelIds = label ? extractRomaneioIdsFromLabel(label) : [];
            if (id !== undefined && id !== null && String(id).trim()) idsFromRefs.add(String(id));
            labelIds.forEach(x => idsFromRefs.add(String(x)));
            refs.push({ r, id: id !== undefined && id !== null ? String(id) : '', label, labelIds });
        });
    });
    const remessasSaida = new Set(saidas.map(m => String(m.remessaId || '').trim()).filter(Boolean));
    if (remessasSaida.size > 0 && Array.isArray(estoqueAtual)) {
        estoqueAtual.forEach(t => {
            const rem = String(t && t.remessaId || '').trim();
            if (!rem || !remessasSaida.has(rem)) return;
            const listaRel = Array.isArray(t.romaneiosRelacionados) ? t.romaneiosRelacionados : [];
            listaRel.forEach(r => {
                if (isCarregoPedidoLike(r)) return;
                const id = (r && typeof r === 'object')
                    ? (r.id || r.romaneioId || r.value || r.key || r.firebaseKey || r.uniqueKey)
                    : r;
                const label = (r && r.label) ? r.label : '';
                const labelIds = label ? extractRomaneioIdsFromLabel(label) : [];
                if (id !== undefined && id !== null && String(id).trim()) idsFromRefs.add(String(id));
                labelIds.forEach(x => idsFromRefs.add(String(x)));
                refs.push({ r, id: id !== undefined && id !== null ? String(id) : '', label, labelIds });
            });
        });
    }
    const missingIds = Array.from(idsFromRefs).filter(id => !romaneioMap.has(String(id)));
    if (missingIds.length) {
        const normalizeList = (raw, tipo) => {
            let listaN = [];
            if (Array.isArray(raw)) {
                listaN = raw;
            } else if (raw && typeof raw === 'object') {
                listaN = Object.entries(raw).map(([k, v]) => {
                    if (v && typeof v === 'object') {
                        return { ...v, firebaseKey: v.firebaseKey || k };
                    }
                    return v;
                });
            }
            return listaN
                .filter(r => r && typeof r === 'object' && (r.id || r.firebaseKey || r.key || r.romaneioId))
                .map(r => ({ ...r, tipo: (r.tipo || tipo || '').toUpperCase(), id: r.id || r.romaneioId || r.firebaseKey || r.key }));
        };
        try {
            const loadAny = async (key) => {
                if (window.firebaseService && typeof window.firebaseService.loadFromFirebase === 'function') {
                    const result = await window.firebaseService.loadFromFirebase(key);
                    return result ? (result.data !== undefined ? result.data : result) : null;
                }
                if (window.databaseAdapter && typeof window.databaseAdapter.loadData === 'function') {
                    const result = await window.databaseAdapter.loadData(key);
                    return result && result.success ? result.data : null;
                }
                return null;
            };
            const [toraRaw, pctRaw, tlRaw, pesRaw, tlAltRaw, tlCamelRaw] = await Promise.all([
                loadAny('romaneiosTora'),
                loadAny('romaneiosPct'),
                loadAny('romaneiosTL'),
                loadAny('romaneiosPes'),
                loadAny('romaneios_tl'),
                loadAny('romaneiosTl')
            ]);
            const countOf = (x) => Array.isArray(x) ? x.length : (x && typeof x === 'object' ? Object.keys(x).length : 0);
            const tlSource = countOf(tlRaw) > 0 ? tlRaw : (countOf(tlCamelRaw) > 0 ? tlCamelRaw : tlAltRaw);
            const fetched = []
                .concat(normalizeList(toraRaw, 'TORA'))
                .concat(normalizeList(pctRaw, 'PCT'))
                .concat(normalizeList(tlSource, 'TL'))
                .concat(normalizeList(pesRaw, 'PES'));
            fetched.forEach(r => {
                const keys = [r && r.id, r && r.romaneioId, r && r.key, r && r.firebaseKey, r && r.uniqueKey, r && r.numero, r && r.numeroRomaneio].filter(Boolean);
                keys.forEach(k => romaneioMap.set(String(k), r));
            });
        } catch (_) {}
    }
    const romaneioIds = new Set();
    const romaneiosContados = new Set();
    let volumeRomaneiosDireto = 0;
    refs.forEach(({ r, id, label, labelIds }) => {
        const fromMap = id ? romaneioMap.get(String(id)) : null;
        if (isCarregoPedidoLike(r) || isCarregoPedidoLike(fromMap) || isCarregoPedidoLike(label)) return;
        const labelTipo = tipoFromLabel(label);
        const localTipo = r && r.tipo ? r.tipo : (fromMap && fromMap.tipo) || labelTipo;
        const localKey = id || (fromMap && (fromMap.id || fromMap.romaneioId || fromMap.key || fromMap.firebaseKey || fromMap.uniqueKey)) || '';
        if (r && typeof r.volumeSerraria === 'number' && r.volumeSerraria > 0 && isSerradoTipo(localTipo)) {
            const key = String(localKey || id || label || '').trim();
            if (!key || romaneiosContados.has(key)) return;
            volumeRomaneiosDireto += Number(r.volumeSerraria) || 0;
            romaneiosContados.add(key);
            return;
        }
        const romaneioRef = fromMap || (isRomaneioLike(r) ? r : null);
        const keyCandidates = [
            id,
            romaneioRef && (romaneioRef.id || romaneioRef.romaneioId || romaneioRef.key || romaneioRef.firebaseKey || romaneioRef.uniqueKey || romaneioRef.numero || romaneioRef.numeroRomaneio),
            Array.isArray(labelIds) && labelIds.length ? labelIds[0] : null,
            label
        ].filter(v => v !== undefined && v !== null && String(v).trim() !== '').map(v => String(v));
        const key = keyCandidates.length ? keyCandidates[0] : null;
        if (key && romaneiosContados.has(key)) return;
        if (!romaneioRef) {
            if (id && String(id).trim()) romaneioIds.add(String(id));
            if (Array.isArray(labelIds) && labelLooksRomaneio(label)) {
                labelIds.forEach(x => romaneioIds.add(String(x)));
            }
            return;
        }
        if (romaneioRef && !isSerradoTipo(romaneioRef.tipo)) {
            return;
        }
        const itens = getRomaneioItems(romaneioRef);
        if (itens.length > 0) {
            const filtrados = itens.filter(i => !isCarregoItem(i));
            if (filtrados.length > 0) {
                const soma = filtrados.reduce((acc, i) => acc + (parseFloat(i.volumeSerraria || i.volumeLiquido || i.volumeTotal || i.volume || 0) || 0), 0);
                volumeRomaneiosDireto += soma;
                if (key) romaneiosContados.add(key);
                return;
            }
        }
        const total = (romaneioRef.totais && (romaneioRef.totais.volumeSerraria || romaneioRef.totais.volumeTotal || romaneioRef.totais.volume)) || romaneioRef.totalVolume || romaneioRef.volumeSerraria || romaneioRef.volumeTotal || romaneioRef.volume;
        if (total) {
            volumeRomaneiosDireto += Number(total) || 0;
            if (key) romaneiosContados.add(key);
            return;
        }
        if (id && String(id).trim()) romaneioIds.add(String(id));
        if (Array.isArray(labelIds) && labelLooksRomaneio(label)) {
            labelIds.forEach(x => romaneioIds.add(String(x)));
        }
    });
    const getRomaneioVolume = (r) => {
        if (!r) return 0;
        const itens = getRomaneioItems(r);
        if (itens.length > 0) {
            const filtrados = itens.filter(i => !isCarregoItem(i));
            if (filtrados.length > 0) {
                return filtrados.reduce((acc, i) => acc + (parseFloat(i.volumeSerraria || i.volumeLiquido || i.volumeTotal || i.volume || 0) || 0), 0);
            }
        }
        const total = (r.totais && (r.totais.volumeSerraria || r.totais.volumeTotal || r.totais.volume)) || r.totalVolume || r.volumeSerraria || r.volumeTotal || r.volume;
        if (total) return Number(total) || 0;
        return itens.reduce((acc, i) => acc + (parseFloat(i.volumeSerraria || i.volumeLiquido || i.volumeTotal || i.volume || 0) || 0), 0);
    };
    const volumeRomaneiosLookup = Array.from(romaneioIds).reduce((acc, id) => {
        const key = String(id);
        if (romaneiosContados.has(key)) return acc;
        const r = romaneioMap.get(key);
        if (isCarregoPedidoLike(r)) return acc;
        const vol = r ? getRomaneioVolume(r) : 0;
        if (vol > 0) romaneiosContados.add(key);
        return acc + vol;
    }, 0);
    const volumeRomaneios = volumeRomaneiosDireto + volumeRomaneiosLookup;
    const rendimento = volumeTorasSaidas > 0 ? (volumeRomaneios / volumeTorasSaidas) * 100 : 0;
    return { totalVol, totalEntradas, totalSaidas, volumeRomaneios, rendimento };
}

async function carregarTabelaMovimentacoes(filtro = {}) {
    const tbody = document.getElementById('movimentacaoTable');
    if (tbody) {
        tbody.innerHTML = '<tr><td colspan="8" style="text-align: center; color: #666;">Carregando movimentações...</td></tr>';
    }
    const resumoEl = document.getElementById('resumoMovimentacoes');
    if (resumoEl) {
        resumoEl.innerHTML = '<div class="summary-row"><span>Carregando...</span></div>';
    }
    let movFiltradas = [...movimentacoes];
    filtroMovimentacoesAtual = filtro || {};
    
    if (!filtro.tipo) {
        if (tbody) tbody.innerHTML = '<tr><td colspan="8" style="text-align: center;">Selecione o tipo para carregar as movimentações</td></tr>';
        const resumoEl = document.getElementById('resumoMovimentacoes');
        if (resumoEl) resumoEl.innerHTML = '';
        renderizarPaginacaoPadrao('paginacaoMovimentacoes', 0, 1, 10, 'mudarPaginaMovimentacoes');
        movimentacoesFiltradas = [];
        return;
    }
    // Aplicar filtros
    if (filtro.dataInicio) {
        movFiltradas = movFiltradas.filter(m => m.data >= filtro.dataInicio);
    }
    
    if (filtro.dataFim) {
        movFiltradas = movFiltradas.filter(m => m.data <= filtro.dataFim);
    }
    
    if (filtro.tipo) {
        movFiltradas = movFiltradas.filter(m => m.tipo === filtro.tipo);
    }
    if (filtro.remessa) {
        const rem = String(filtro.remessa).toLowerCase();
        movFiltradas = movFiltradas.filter(m => {
            const remessa = String(m.remessaId || '').toLowerCase();
            const doc = String(m.documento || '').toLowerCase();
            return remessa.includes(rem) || doc.includes(rem);
        });
    }
    
    // Ordenar por data (mais recentes primeiro) e remessa
    movFiltradas.sort((a, b) => {
        const da = new Date(a.data);
        const db = new Date(b.data);
        if (db - da !== 0) return db - da;
        const ra = String(a.remessaId || '').localeCompare(String(b.remessaId || ''), 'pt-BR');
        if (ra !== 0) return ra;
        return String(a.plaqueta || '').localeCompare(String(b.plaqueta || ''), 'pt-BR');
    });

    if (movFiltradas.length === 0) {
        tbody.innerHTML = '<tr><td colspan="8" style="text-align: center;">Nenhuma movimentação encontrada</td></tr>';
        renderizarPaginacaoPadrao('paginacaoMovimentacoes', 0, 1, 10, 'mudarPaginaMovimentacoes');
        if (resumoEl) resumoEl.innerHTML = '';
        return;
    }

    const itensPorPaginaMov = 10;
    const totalPaginas = Math.max(1, Math.ceil(movFiltradas.length / itensPorPaginaMov));
    if (paginaAtualMovimentacoes > totalPaginas) paginaAtualMovimentacoes = totalPaginas;
    if (paginaAtualMovimentacoes < 1) paginaAtualMovimentacoes = 1;
    const inicio = (paginaAtualMovimentacoes - 1) * itensPorPaginaMov;
    const pagina = movFiltradas.slice(inicio, inicio + itensPorPaginaMov);

    tbody.innerHTML = pagina.map(mov => {
        const manualBadge = mov && mov.toraManualForaEstoque
            ? ' <span style="display:inline-block;padding:2px 6px;border-radius:10px;background:#fff3cd;color:#856404;font-size:11px;font-weight:600;">Manual</span>'
            : '';
        const observacoes = mov && mov.toraManualForaEstoque
            ? `MANUAL FORA ESTOQUE - ${mov.observacoes || ''}`.trim()
            : (mov.observacoes || '');
        return `
        <tr>
            <td>${formatDate(mov.data)}</td>
            <td>
                <span class="status-indicator status-${mov.tipo === 'entrada' ? 'alto' : 'baixo'}">
                    ${mov.tipo.toUpperCase()}
                </span>
            </td>
            <td>${mov.plaqueta}${manualBadge}</td>
            <td>${mov.especie}</td>
            <td style="text-align: right;">${formatNumber(mov.volume, 3)} m³</td>
            <td>${mov.documento || ''}</td>
            <td>${mov.remessaId || '-'}</td>
            <td>${observacoes}</td>
        </tr>
    `;
    }).join('');
    renderizarPaginacaoPadrao('paginacaoMovimentacoes', movFiltradas.length, paginaAtualMovimentacoes, itensPorPaginaMov, 'mudarPaginaMovimentacoes');
    movimentacoesFiltradas = movFiltradas.slice();
    const resumoSeq = ++resumoMovimentacoesSeq;
    const cacheKey = JSON.stringify({
        tipo: filtroMovimentacoesAtual.tipo || '',
        dataInicio: filtroMovimentacoesAtual.dataInicio || '',
        dataFim: filtroMovimentacoesAtual.dataFim || '',
        remessa: filtroMovimentacoesAtual.remessa || '',
        total: movimentacoesFiltradas.length
    });
    if (resumoEl && resumoMovimentacoesCache.has(cacheKey)) {
        const resumo = resumoMovimentacoesCache.get(cacheKey);
        const { totalVol, totalEntradas, totalSaidas, volumeRomaneios, rendimento } = resumo;
        resumoEl.innerHTML = `
            <div class="summary-row">
                <span>Total de Movimentações:</span>
                <span>${movimentacoesFiltradas.length}</span>
            </div>
            <div class="summary-row">
                <span>Entradas:</span>
                <span>${totalEntradas}</span>
            </div>
            <div class="summary-row">
                <span>Saídas:</span>
                <span>${totalSaidas}</span>
            </div>
            <div class="summary-row">
                <span>Volume Total:</span>
                <span>${formatNumber(totalVol, 3)} m³</span>
            </div>
            <div class="summary-row">
                <span>Volume serrado (romaneios):</span>
                <span>${formatNumber(volumeRomaneios, 3)} m³</span>
            </div>
            <div class="summary-row">
                <span>Rendimento:</span>
                <span>${formatNumber(rendimento, 2)}%</span>
            </div>
            <div class="summary-row" style="font-size: 12px; color: #7f8c8d;">
                <span>Atualizando resumo...</span>
            </div>
        `;
    } else if (resumoEl) {
        resumoEl.innerHTML = '<div class="summary-row" style="font-size: 12px; color: #7f8c8d;"><span>Atualizando resumo...</span></div>';
    }
    calcularResumoMovimentacoes(movimentacoesFiltradas).then(resumo => {
        if (resumoSeq !== resumoMovimentacoesSeq) return;
        resumoMovimentacoesCache.set(cacheKey, resumo);
        if (!resumoEl) return;
        const { totalVol, totalEntradas, totalSaidas, volumeRomaneios, rendimento } = resumo;
        resumoEl.innerHTML = `
            <div class="summary-row">
                <span>Total de Movimentações:</span>
                <span>${movimentacoesFiltradas.length}</span>
            </div>
            <div class="summary-row">
                <span>Entradas:</span>
                <span>${totalEntradas}</span>
            </div>
            <div class="summary-row">
                <span>Saídas:</span>
                <span>${totalSaidas}</span>
            </div>
            <div class="summary-row">
                <span>Volume Total:</span>
                <span>${formatNumber(totalVol, 3)} m³</span>
            </div>
            <div class="summary-row">
                <span>Volume serrado (romaneios):</span>
                <span>${formatNumber(volumeRomaneios, 3)} m³</span>
            </div>
            <div class="summary-row">
                <span>Rendimento:</span>
                <span>${formatNumber(rendimento, 2)}%</span>
            </div>
        `;
    }).catch(() => {});
}

function filtrarMovimentacoes() {
    const filtro = {
        dataInicio: document.getElementById('filtroDataInicio').value,
        dataFim: document.getElementById('filtroDataFim').value,
        tipo: document.getElementById('filtroTipoMov').value,
        remessa: document.getElementById('filtroRemessaBaixa')?.value || ''
    };
    paginaAtualMovimentacoes = 1;
    carregarTabelaMovimentacoes(filtro);
}

function mudarPaginaMovimentacoes(p) {
    paginaAtualMovimentacoes = p;
    carregarTabelaMovimentacoes(filtroMovimentacoesAtual);
}

// Funções de relatórios
async function gerarRelatorio() {
    const tipoRelatorio = document.getElementById('tipoRelatorio').value;
    const dataInicio = document.getElementById('relDataInicio').value;
    const dataFim = document.getElementById('relDataFim').value;

    const options = {
        tipo: (document.getElementById('relFiltroTipo')?.value || '').trim(),
        agruparPorResponsavel: !!document.getElementById('relAgruparResponsavel')?.checked
    };

    const conteudo = await obterConteudoRelatorio(tipoRelatorio, dataInicio, dataFim, options);
    window.__ultimoRelatorioEstoque = { tipoRelatorio, dataInicio, dataFim, conteudo, options };
    document.getElementById('relatorioContent').innerHTML = conteudo;
    document.getElementById('relatorioResult').style.display = 'block';
}

async function obterConteudoRelatorio(tipoRelatorio, dataInicio, dataFim, options = {}) {
    switch (tipoRelatorio) {
        case 'posicao':
            return gerarRelatorioPosicao();
        case 'movimentacao':
            return gerarRelatorioMovimentacao(dataInicio, dataFim);
        case 'especies':
            return gerarRelatorioPorEspecies();
        case 'localizacao':
            return gerarRelatorioPorLocalizacao();
        case 'produtos_saldo':
            if (typeof window.gerarRelatorioProdutosSaldo === 'function') {
                return await window.gerarRelatorioProdutosSaldo();
            }
            return '<p class="text-danger">Módulo de produtos não carregado.</p>';
        case 'produtos_movimentacao':
            if (typeof window.gerarRelatorioProdutosMovimentacao === 'function') {
                return await window.gerarRelatorioProdutosMovimentacao(dataInicio, dataFim, options);
            }
            return '<p class="text-danger">Módulo de produtos não carregado.</p>';
        default:
            return '';
    }
}

try {
    document.addEventListener('DOMContentLoaded', () => {
        const el = document.getElementById('tipoRelatorio');
        if (el) {
            el.addEventListener('change', updateRelatoriosProdutosFiltersUI);
            updateRelatoriosProdutosFiltersUI();
        }

        const tipoFiltro = document.getElementById('relFiltroTipo');
        if (tipoFiltro && !tipoFiltro._listenerConfigured) {
            tipoFiltro.addEventListener('change', () => {
                const tipoRelatorio = document.getElementById('tipoRelatorio')?.value || '';
                const result = document.getElementById('relatorioResult');
                if (tipoRelatorio === 'produtos_movimentacao' && result && result.style.display !== 'none') {
                    gerarRelatorio();
                }
            });
            tipoFiltro._listenerConfigured = true;
        }

        const agruparChk = document.getElementById('relAgruparResponsavel');
        if (agruparChk && !agruparChk._listenerConfigured) {
            agruparChk.addEventListener('change', () => {
                const tipoRelatorio = document.getElementById('tipoRelatorio')?.value || '';
                const result = document.getElementById('relatorioResult');
                if (tipoRelatorio === 'produtos_movimentacao' && result && result.style.display !== 'none') {
                    gerarRelatorio();
                }
            });
            agruparChk._listenerConfigured = true;
        }
    });
} catch (_) {}

function updateRelatoriosProdutosFiltersUI() {
    const tipoRelatorio = document.getElementById('tipoRelatorio')?.value || '';
    const show = tipoRelatorio === 'produtos_movimentacao';
    const tipoGroup = document.getElementById('relFiltroTipoGroup');
    const agruparGroup = document.getElementById('relAgruparResponsavelGroup');
    if (tipoGroup) tipoGroup.style.display = show ? 'block' : 'none';
    if (agruparGroup) agruparGroup.style.display = show ? 'block' : 'none';
    if (!show) {
        const tipoEl = document.getElementById('relFiltroTipo');
        const chk = document.getElementById('relAgruparResponsavel');
        if (tipoEl) tipoEl.value = '';
        if (chk) chk.checked = false;
    }
}

function obterTituloRelatorioEstoque(tipo) {
    const map = {
        posicao: 'Posição do Estoque de Toras',
        movimentacao: 'Movimentação de Toras',
        especies: 'Estoque por Espécie (Toras)',
        localizacao: 'Estoque por Localização (Toras)',
        produtos_saldo: 'Saldo de Produtos (Almoxarifado)',
        produtos_movimentacao: 'Movimentação de Produtos (Almoxarifado)'
    };
    return map[tipo] || 'Relatório de Estoque';
}

async function obterDadosEmpresaRelatorio() {
    try {
        const pickCompanyFromPayload = (payload) => {
            if (!payload) return {};
            if (Array.isArray(payload)) return payload[0] || {};
            if (typeof payload !== 'object') return {};
            const values = Object.values(payload).filter(v => v && typeof v === 'object');
            if (values.length > 0) return values[0] || {};
            return payload;
        };

        let empresa = {};
        try {
            if (typeof getDataAsync === 'function') {
                const companiesPayload = await getDataAsync('companies');
                empresa = pickCompanyFromPayload(companiesPayload);
            } else {
                const companiesPayload = await getData('companies');
                empresa = pickCompanyFromPayload(companiesPayload);
            }
        } catch (_) {}

        if (!empresa || (!empresa.nome && !empresa.name)) {
            try {
                const raw = localStorage.getItem('company_info');
                if (raw) empresa = JSON.parse(raw) || empresa;
            } catch (_) {}
        }

        return empresa || {};
    } catch (_) {
        return {};
    }
}

function obterLogoEmpresaSrc(empresa) {
    const logo = empresa.logoBase64 || empresa.logo || '';
    if (!logo) return '';
    if (logo.startsWith('data:image')) return logo;
    if (logo.startsWith('http') || logo.startsWith('blob:') || logo.startsWith('file:')) return logo;
    if (logo.length > 100) return `data:image/png;base64,${logo}`;
    return logo;
}

function montarRelatorioHtml(empresa, titulo, periodo, corpo, rodape) {
    const nome = empresa.nome || empresa.name || 'Empresa';
    const cnpj = empresa.cnpj || '';
    const endereco = empresa.endereco || empresa.address || '';
    const cidade = empresa.cidade || empresa.city || '';
    const estado = empresa.estado || empresa.state || '';
    const telefone = empresa.telefone || empresa.phone || '';
    const logoSrc = obterLogoEmpresaSrc(empresa);
    const emissao = `${new Date().toLocaleDateString('pt-BR')} ${new Date().toLocaleTimeString('pt-BR')}`;
    const periodoHtml = periodo ? `<div>Período: ${periodo}</div>` : '';
    return `
        <div class="relatorio-profissional">
            <div class="relatorio-header">
                <div class="relatorio-logo">${logoSrc ? `<img src="${logoSrc}">` : ''}</div>
                <div class="relatorio-empresa">
                    <div class="nome">${nome}</div>
                    <div>${cnpj ? `CNPJ: ${cnpj}` : ''}</div>
                    <div>${endereco}</div>
                    <div>${cidade}${estado ? ` - ${estado}` : ''}</div>
                    <div>${telefone}</div>
                </div>
                <div class="relatorio-meta">
                    <div class="titulo">${titulo}</div>
                    ${periodoHtml}
                    <div>Emissão: ${emissao}</div>
                </div>
            </div>
            ${corpo}
            ${rodape || ''}
        </div>
    `;
}

function obterRelatorioStylesImpressao() {
    return `
        body { font-family: Arial, sans-serif; color: #111827; padding: 20px; }
        .no-print { display: none !important; }
        .relatorio-profissional { border: 1px solid #e5e7eb; border-radius: 8px; padding: 18px; }
        .relatorio-header { display: grid; grid-template-columns: 120px 1fr 1fr; gap: 12px; align-items: center; border-bottom: 2px solid #e5e7eb; padding-bottom: 12px; margin-bottom: 12px; }
        .relatorio-logo img { max-width: 120px; max-height: 80px; object-fit: contain; }
        .relatorio-empresa .nome { font-size: 16px; font-weight: bold; }
        .relatorio-meta { text-align: right; font-size: 13px; }
        .relatorio-meta .titulo { font-size: 16px; font-weight: bold; }
        .table { width: 100%; border-collapse: collapse; margin-top: 12px; }
        .table th, .table td { border: 1px solid #e5e7eb; padding: 8px; font-size: 12px; }
        .table th { background: #f3f4f6; text-align: left; }
        .table-container { max-height: none; overflow: visible; border: none; padding: 0; }
        .summary-box { background: #f8f9fa; border: 1px solid #e9ecef; padding: 12px; border-radius: 6px; margin-top: 12px; }
        .summary-row { display: flex; justify-content: space-between; padding: 4px 0; font-size: 12px; }
        .text-right { text-align: right; }
        .text-center { text-align: center; }
        .relatorio-rodape { margin-top: 12px; border-top: 2px solid #e5e7eb; padding-top: 10px; }
    `;
}

async function imprimirRelatorioEstoque() {
    const content = document.getElementById('relatorioContent');
    if (!content) return;
    const data = window.__ultimoRelatorioEstoque || {};
    const tipoRelatorio = data.tipoRelatorio || document.getElementById('tipoRelatorio').value;
    const dataInicio = data.dataInicio || document.getElementById('relDataInicio').value;
    const dataFim = data.dataFim || document.getElementById('relDataFim').value;
    const options = data.options || {
        tipo: (document.getElementById('relFiltroTipo')?.value || '').trim(),
        agruparPorResponsavel: !!document.getElementById('relAgruparResponsavel')?.checked
    };
    const conteudo = data.conteudo || await obterConteudoRelatorio(tipoRelatorio, dataInicio, dataFim, options);
    const empresa = await obterDadosEmpresaRelatorio();
    const titulo = obterTituloRelatorioEstoque(tipoRelatorio);
    const periodo = dataInicio && dataFim ? `${formatDate(dataInicio)} a ${formatDate(dataFim)}` : '';
    const rodape = await gerarRodapeRelatorio(tipoRelatorio, dataInicio, dataFim, options);
    const html = montarRelatorioHtml(empresa, titulo, periodo, conteudo, rodape);
    const win = window.open('', '_blank', 'width=900,height=700');
    win.document.write(`
        <html>
        <head>
            <meta charset="UTF-8">
            <title>${titulo}</title>
            <style>${obterRelatorioStylesImpressao()}</style>
        </head>
        <body>${html}</body>
        </html>
    `);
    win.document.close();
    win.onload = function() { win.print(); };
}

function montarTabelaHtml(colunas, linhas) {
    const head = colunas.map(c => `<th>${c}</th>`).join('');
    const body = linhas.map(l => `<tr>${l.map(c => `<td>${c}</td>`).join('')}</tr>`).join('');
    return `<table class="table"><thead><tr>${head}</tr></thead><tbody>${body}</tbody></table>`;
}

async function imprimirConsultaEstoque() {
    const lista = estoqueFiltrado.length ? estoqueFiltrado : estoqueAtual.filter(t => t.status === 'disponivel');
    const colunas = ['Plaqueta', 'Espécie', 'Diâmetro (cm)', 'Comprimento (cm)', 'Volume Bruto (m³)', 'Volume Líquido (m³)', 'Preço Custo', 'Localização', 'Data Entrada'];
    const linhas = lista.map(t => [
        t.plaqueta || '',
        t.especie || '',
        formatNumber(t.diametro, 1),
        formatNumber(t.comprimento, 1),
        formatNumber(t.volumeBruto, 3),
        formatNumber(t.volumeLiquido, 3),
        formatCurrency(t.precoCusto),
        t.localizacao || '',
        formatDate(t.data)
    ]);
    const totalVol = lista.reduce((acc, t) => acc + (t.volumeLiquido || 0), 0);
    const totalVal = lista.reduce((acc, t) => acc + ((t.volumeLiquido || 0) * (t.precoCusto || 0)), 0);
    const rodape = `
        <div class="relatorio-rodape summary-box">
            <div class="summary-row"><span>Total de Toras:</span><span>${lista.length}</span></div>
            <div class="summary-row"><span>Volume Líquido Total:</span><span>${formatNumber(totalVol, 3)} m³</span></div>
            <div class="summary-row"><span>Valor Total:</span><span>${formatCurrency(totalVal)}</span></div>
        </div>
    `;
    const empresa = await obterDadosEmpresaRelatorio();
    const html = montarRelatorioHtml(empresa, 'Consulta de Estoque', '', montarTabelaHtml(colunas, linhas), rodape);
    const win = window.open('', '_blank', 'width=900,height=700');
    win.document.write(`
        <html>
        <head>
            <meta charset="UTF-8">
            <title>Consulta de Estoque</title>
            <style>${obterRelatorioStylesImpressao()}</style>
        </head>
        <body>${html}</body>
        </html>
    `);
    win.document.close();
    win.onload = function() { win.print(); };
}

async function imprimirEstoqueProdutos() {
    const lista = (typeof produtosFiltrados !== 'undefined' && Array.isArray(produtosFiltrados) && produtosFiltrados.length >= 0)
        ? produtosFiltrados
        : (typeof estoqueProdutos !== 'undefined' ? estoqueProdutos : []);
    const colunas = ['Produto', 'Unidade', 'Quantidade', 'Preço Médio', 'Total', 'Última Atualização'];
    const linhas = lista.map(p => {
        const total = (p.quantidade || 0) * (p.precoMedio || 0);
        const dataFmt = p.ultimaAtualizacao ? new Date(p.ultimaAtualizacao).toLocaleDateString('pt-BR') : '-';
        return [
            p.nome || '',
            p.unidade || 'un',
            formatNumber(p.quantidade, 2),
            formatCurrency(p.precoMedio),
            formatCurrency(total),
            dataFmt
        ];
    });
    const totalQtd = lista.reduce((acc, p) => acc + (p.quantidade || 0), 0);
    const totalVal = lista.reduce((acc, p) => acc + ((p.quantidade || 0) * (p.precoMedio || 0)), 0);
    const rodape = `
        <div class="relatorio-rodape summary-box">
            <div class="summary-row"><span>Total de Itens:</span><span>${lista.length}</span></div>
            <div class="summary-row"><span>Quantidade Total:</span><span>${formatNumber(totalQtd, 2)}</span></div>
            <div class="summary-row"><span>Valor Total:</span><span>${formatCurrency(totalVal)}</span></div>
        </div>
    `;
    const empresa = await obterDadosEmpresaRelatorio();
    const html = montarRelatorioHtml(empresa, 'Estoque de Almoxarifado', '', montarTabelaHtml(colunas, linhas), rodape);
    const win = window.open('', '_blank', 'width=900,height=700');
    win.document.write(`
        <html>
        <head>
            <meta charset="UTF-8">
            <title>Estoque de Almoxarifado</title>
            <style>${obterRelatorioStylesImpressao()}</style>
        </head>
        <body>${html}</body>
        </html>
    `);
    win.document.close();
    win.onload = function() { win.print(); };
}

async function imprimirMovimentacoesEstoque() {
    const aplicarFiltroMovimentacoes = (base, filtro) => {
        let out = [...base];
        if (filtro.dataInicio) out = out.filter(m => m.data >= filtro.dataInicio);
        if (filtro.dataFim) out = out.filter(m => m.data <= filtro.dataFim);
        if (filtro.tipo) out = out.filter(m => m.tipo === filtro.tipo);
        if (filtro.remessa) {
            const rem = String(filtro.remessa).toLowerCase();
            out = out.filter(m => {
                const remessa = String(m.remessaId || '').toLowerCase();
                const doc = String(m.documento || '').toLowerCase();
                return remessa.includes(rem) || doc.includes(rem);
            });
        }
        return out;
    };
    const filtro = filtroMovimentacoesAtual || {};
    const hasFiltro = !!(filtro.tipo || filtro.dataInicio || filtro.dataFim || filtro.remessa);
    let lista = [];
    if (hasFiltro) {
        if (!filtro.tipo) {
            lista = [];
        } else {
            lista = aplicarFiltroMovimentacoes(movimentacoes, filtro);
        }
    } else if (movimentacoesFiltradas.length) {
        lista = movimentacoesFiltradas.slice();
    } else {
        lista = movimentacoes.slice();
    }
    lista.sort((a, b) => {
        const da = new Date(a.data);
        const db = new Date(b.data);
        if (db - da !== 0) return db - da;
        const ra = String(a.remessaId || '').localeCompare(String(b.remessaId || ''), 'pt-BR');
        if (ra !== 0) return ra;
        return String(a.plaqueta || '').localeCompare(String(b.plaqueta || ''), 'pt-BR');
    });
    const colunas = ['Data', 'Tipo', 'Plaqueta', 'Espécie', 'Volume', 'Documento', 'Remessa', 'Observações'];
    const linhas = lista.map(m => [
        formatDate(m.data),
        m.tipo ? m.tipo.toUpperCase() : '',
        m.plaqueta || '',
        m.especie || '',
        `${formatNumber(m.volume, 3)} m³`,
        m.documento || '',
        m.remessaId || '',
        m.observacoes || ''
    ]);
    const resumo = await calcularResumoMovimentacoes(lista);
    const { totalVol, totalEntradas, totalSaidas, volumeRomaneios, rendimento } = resumo;
    const rodape = `
        <div class="relatorio-rodape summary-box">
            <div class="summary-row"><span>Total de Movimentações:</span><span>${lista.length}</span></div>
            <div class="summary-row"><span>Entradas:</span><span>${totalEntradas}</span></div>
            <div class="summary-row"><span>Saídas:</span><span>${totalSaidas}</span></div>
            <div class="summary-row"><span>Volume Total:</span><span>${formatNumber(totalVol, 3)} m³</span></div>
            <div class="summary-row"><span>Volume serrado (romaneios):</span><span>${formatNumber(volumeRomaneios, 3)} m³</span></div>
            <div class="summary-row"><span>Rendimento:</span><span>${formatNumber(rendimento, 2)}%</span></div>
        </div>
    `;
    const empresa = await obterDadosEmpresaRelatorio();
    const html = montarRelatorioHtml(empresa, 'Histórico de Movimentações', '', montarTabelaHtml(colunas, linhas), rodape);
    const win = window.open('', '_blank', 'width=900,height=700');
    win.document.write(`
        <html>
        <head>
            <meta charset="UTF-8">
            <title>Histórico de Movimentações</title>
            <style>${obterRelatorioStylesImpressao()}</style>
        </head>
        <body>${html}</body>
        </html>
    `);
    win.document.close();
    win.onload = function() { win.print(); };
}

async function gerarRodapeRelatorio(tipoRelatorio, dataInicio, dataFim, options = {}) {
    if (tipoRelatorio === 'posicao') {
        const torasDisponiveis = estoqueAtual.filter(t => t.status === 'disponivel');
        const volumeTotal = torasDisponiveis.reduce((total, tora) => total + (tora.volumeLiquido || 0), 0);
        const valorTotal = torasDisponiveis.reduce((total, tora) => total + ((tora.volumeLiquido || 0) * (tora.precoCusto || 0)), 0);
        return `
            <div class="relatorio-rodape summary-box">
                <div class="summary-row"><span>Total de Toras:</span><span>${torasDisponiveis.length}</span></div>
                <div class="summary-row"><span>Volume Total:</span><span>${formatNumber(volumeTotal, 3)} m³</span></div>
                <div class="summary-row"><span>Valor Total:</span><span>${formatCurrency(valorTotal)}</span></div>
            </div>
        `;
    }
    if (tipoRelatorio === 'movimentacao') {
        const movPeriodo = movimentacoes.filter(m => {
            if (!dataInicio && !dataFim) return true;
            const d = m.data ? parseDateLocalSafe(m.data) : null;
            if (!d) return false;
            if (dataInicio && d < parseDateLocalSafe(dataInicio)) return false;
            if (dataFim && d > parseDateLocalSafe(dataFim + 'T23:59:59')) return false;
            return true;
        });
        const entradas = movPeriodo.filter(m => m.tipo === 'entrada');
        const saidas = movPeriodo.filter(m => m.tipo === 'saida');
        const volumeEntradas = entradas.reduce((total, m) => total + (m.volume || 0), 0);
        const volumeSaidas = saidas.reduce((total, m) => total + (m.volume || 0), 0);
        return `
            <div class="relatorio-rodape summary-box">
                <div class="summary-row"><span>Entradas:</span><span>${entradas.length} movimentações - ${formatNumber(volumeEntradas, 3)} m³</span></div>
                <div class="summary-row"><span>Saídas:</span><span>${saidas.length} movimentações - ${formatNumber(volumeSaidas, 3)} m³</span></div>
                <div class="summary-row"><span>Saldo:</span><span>${formatNumber(volumeEntradas - volumeSaidas, 3)} m³</span></div>
            </div>
        `;
    }
    if (tipoRelatorio === 'especies' || tipoRelatorio === 'localizacao') {
        const torasDisponiveis = estoqueAtual.filter(t => t.status === 'disponivel');
        const totalQtd = torasDisponiveis.length;
        const totalVolume = torasDisponiveis.reduce((acc, t) => acc + (t.volumeLiquido || 0), 0);
        const totalValor = torasDisponiveis.reduce((acc, t) => acc + ((t.volumeLiquido || 0) * (t.precoCusto || 0)), 0);
        return `
            <div class="relatorio-rodape summary-box">
                <div class="summary-row"><span>Total:</span><span>${totalQtd} toras</span></div>
                <div class="summary-row"><span>Volume:</span><span>${formatNumber(totalVolume, 3)} m³</span></div>
                <div class="summary-row"><span>Valor:</span><span>${formatCurrency(totalValor)}</span></div>
            </div>
        `;
    }
    if (tipoRelatorio === 'produtos_saldo') {
        const produtos = await getData('estoqueProdutos') || [];
        const totalItens = produtos.length;
        const totalQtd = produtos.reduce((acc, p) => acc + (p.quantidade || 0), 0);
        const totalValor = produtos.reduce((acc, p) => acc + ((p.quantidade || 0) * (p.precoMedio || 0)), 0);
        return `
            <div class="relatorio-rodape summary-box">
                <div class="summary-row"><span>Itens diferentes:</span><span>${totalItens}</span></div>
                <div class="summary-row"><span>Quantidade total:</span><span>${formatNumber(totalQtd, 2)}</span></div>
                <div class="summary-row"><span>Valor total:</span><span>${formatCurrency(totalValor)}</span></div>
            </div>
        `;
    }
    if (tipoRelatorio === 'produtos_movimentacao') {
        const movimentos = await getData('movimentacoesProdutos') || [];
        const filtrados = movimentos.filter(m => {
            if (!dataInicio && !dataFim) return true;
            const d = m.data ? parseDateLocalSafe(m.data) : null;
            if (!d) return false;
            if (dataInicio && d < parseDateLocalSafe(dataInicio)) return false;
            if (dataFim && d > parseDateLocalSafe(dataFim + 'T23:59:59')) return false;
            return true;
        });
        const tipoFiltro = (options && options.tipo) ? String(options.tipo).trim() : '';
        const filtradosTipo = tipoFiltro ? filtrados.filter(m => String(m.tipo || '').toLowerCase() === tipoFiltro.toLowerCase()) : filtrados;
        let entradas = 0;
        let saidas = 0;
        filtradosTipo.forEach(m => {
            if (m.tipo === 'entrada') entradas++;
            else if (m.tipo === 'saida') saidas++;
        });
        return `
            <div class="relatorio-rodape summary-box">
                <div class="summary-row"><span>Total de Movimentações:</span><span>${filtradosTipo.length}</span></div>
                <div class="summary-row"><span>Entradas:</span><span>${entradas}</span></div>
                <div class="summary-row"><span>Saídas:</span><span>${saidas}</span></div>
            </div>
        `;
    }
    return '';
}

function gerarRelatorioPosicao() {
    const torasDisponiveis = estoqueAtual.filter(t => t.status === 'disponivel');
    const volumeTotal = torasDisponiveis.reduce((total, tora) => total + tora.volumeLiquido, 0);
    const valorTotal = torasDisponiveis.reduce((total, tora) => total + (tora.volumeLiquido * (tora.precoCusto || 0)), 0);
    const linhas = torasDisponiveis.map(t => `
        <tr>
            <td>${t.plaqueta || '-'}</td>
            <td>${t.especie || '-'}</td>
            <td class="text-right">${formatNumber(t.volumeLiquido || 0, 3)} m³</td>
            <td class="text-right">${formatCurrency(t.precoCusto || 0)}</td>
            <td class="text-right">${formatCurrency((t.volumeLiquido || 0) * (t.precoCusto || 0))}</td>
            <td>${t.localizacao || '-'}</td>
            <td>${formatDate(t.data)}</td>
        </tr>
    `).join('');
    return `
        <div class="summary-box">
            <div class="summary-row"><span>Total de Toras:</span><span>${torasDisponiveis.length}</span></div>
            <div class="summary-row"><span>Volume Total:</span><span>${formatNumber(volumeTotal, 3)} m³</span></div>
            <div class="summary-row"><span>Valor Total:</span><span>${formatCurrency(valorTotal)}</span></div>
        </div>
        <div class="table-container">
            <table class="table">
                <colgroup>
                    <col class="codigo">
                    <col class="nome">
                    <col class="volume">
                    <col class="preco">
                    <col class="valor">
                    <col class="local">
                    <col class="data">
                </colgroup>
                <thead>
                    <tr>
                        <th>Plaqueta</th>
                        <th>Espécie</th>
                        <th class="text-right">Volume Líquido</th>
                        <th class="text-right">Preço Custo</th>
                        <th class="text-right">Valor</th>
                        <th>Localização</th>
                        <th>Data Entrada</th>
                    </tr>
                </thead>
                <tbody>${linhas || '<tr><td colspan="7">Nenhuma tora disponível</td></tr>'}</tbody>
            </table>
        </div>
    `;
}

function gerarRelatorioMovimentacao(dataInicio, dataFim) {
    if (!dataInicio || !dataFim) {
        return '<p>Informe o período para o relatório de movimentação.</p>';
    }
    
    const movPeriodo = movimentacoes.filter(m => m.data >= dataInicio && m.data <= dataFim);
    const entradas = movPeriodo.filter(m => m.tipo === 'entrada');
    const saidas = movPeriodo.filter(m => m.tipo === 'saida');
    
    const volumeEntradas = entradas.reduce((total, m) => total + m.volume, 0);
    const volumeSaidas = saidas.reduce((total, m) => total + m.volume, 0);
    const linhas = movPeriodo.sort((a,b)=> new Date(b.data) - new Date(a.data)).map(m => `
        <tr>
            <td>${formatDate(m.data)}</td>
            <td>${String(m.tipo || '').toUpperCase()}</td>
            <td>${m.plaqueta || '-'}</td>
            <td>${m.especie || '-'}</td>
            <td class="text-right">${formatNumber(m.volume || 0, 3)} m³</td>
            <td>${m.documento || ''}</td>
            <td>${m.remessaId || ''}</td>
            <td>${m.observacoes || ''}</td>
        </tr>
    `).join('');
    return `
        <div class="summary-box">
            <div class="summary-row"><span>Entradas:</span><span>${entradas.length} movimentações - ${formatNumber(volumeEntradas, 3)} m³</span></div>
            <div class="summary-row"><span>Saídas:</span><span>${saidas.length} movimentações - ${formatNumber(volumeSaidas, 3)} m³</span></div>
            <div class="summary-row"><span>Saldo:</span><span>${formatNumber(volumeEntradas - volumeSaidas, 3)} m³</span></div>
        </div>
        <div class="table-container">
            <table class="table">
                <colgroup>
                    <col class="data">
                    <col class="codigo">
                    <col class="codigo">
                    <col class="nome">
                    <col class="volume">
                    <col class="codigo">
                    <col class="nome">
                </colgroup>
                <thead>
                    <tr>
                        <th>Data</th>
                        <th>Tipo</th>
                        <th>Plaqueta</th>
                        <th>Espécie</th>
                        <th class="text-right">Volume</th>
                        <th>Documento</th>
                        <th>Observações</th>
                    </tr>
                </thead>
                <tbody>${linhas || '<tr><td colspan="7">Nenhuma movimentação</td></tr>'}</tbody>
            </table>
        </div>
    `;
}

function gerarRelatorioPorEspecies() {
    const torasDisponiveis = estoqueAtual.filter(t => t.status === 'disponivel');
    const especiesMap = {};
    
    torasDisponiveis.forEach(tora => {
        if (!especiesMap[tora.especie]) {
            especiesMap[tora.especie] = {
                quantidade: 0,
                volume: 0,
                valor: 0
            };
        }
        
        especiesMap[tora.especie].quantidade++;
        especiesMap[tora.especie].volume += tora.volumeLiquido;
        especiesMap[tora.especie].valor += tora.volumeLiquido * (tora.precoCusto || 0);
    });
    
    const linhas = Object.entries(especiesMap).map(([especie, dados]) => `
        <tr>
            <td>${especie}</td>
            <td class="text-right">${dados.quantidade}</td>
            <td class="text-right">${formatNumber(dados.volume, 3)} m³</td>
            <td class="text-right">${formatCurrency(dados.valor)}</td>
        </tr>
    `).join('');
    return `
        <div class="table-container">
            <table class="table">
                <colgroup>
                    <col class="nome">
                    <col class="quantidade">
                    <col class="volume">
                    <col class="valor">
                </colgroup>
                <thead>
                    <tr>
                        <th>Espécie</th>
                        <th class="text-right">Quantidade</th>
                        <th class="text-right">Volume</th>
                        <th class="text-right">Valor</th>
                    </tr>
                </thead>
                <tbody>${linhas || '<tr><td colspan="4">Nenhum registro</td></tr>'}</tbody>
            </table>
        </div>
    `;
}

function gerarRelatorioPorLocalizacao() {
    const torasDisponiveis = estoqueAtual.filter(t => t.status === 'disponivel');
    const localizacaoMap = {};
    
    torasDisponiveis.forEach(tora => {
        const loc = tora.localizacao || 'Sem localização';
        
        if (!localizacaoMap[loc]) {
            localizacaoMap[loc] = {
                quantidade: 0,
                volume: 0,
                valor: 0
            };
        }
        
        localizacaoMap[loc].quantidade++;
        localizacaoMap[loc].volume += tora.volumeLiquido;
        localizacaoMap[loc].valor += tora.volumeLiquido * (tora.precoCusto || 0);
    });
    
    const linhas = Object.entries(localizacaoMap).map(([localizacao, dados]) => `
        <tr>
            <td>${localizacao}</td>
            <td class="text-right">${dados.quantidade}</td>
            <td class="text-right">${formatNumber(dados.volume, 3)} m³</td>
            <td class="text-right">${formatCurrency(dados.valor)}</td>
        </tr>
    `).join('');
    return `
        <div class="table-container">
            <table class="table">
                <colgroup>
                    <col class="local">
                    <col class="quantidade">
                    <col class="volume">
                    <col class="valor">
                </colgroup>
                <thead>
                    <tr>
                        <th>Localização</th>
                        <th class="text-right">Quantidade</th>
                        <th class="text-right">Volume</th>
                        <th class="text-right">Valor</th>
                    </tr>
                </thead>
                <tbody>${linhas || '<tr><td colspan="4">Nenhum registro</td></tr>'}</tbody>
            </table>
        </div>
    `;
}

// Funções auxiliares
function showLoading(message) {
    console.log(`[LOADING] ${message || 'Processando...'}`);
    // Preload overlays visuais removidos para melhorar performance
}

function hideLoading() {
    // Preload overlays visuais removidos
}

// Função duplicada removida


function fecharModal(modalId) {
    document.getElementById(modalId).style.display = 'none';
    if (modalId === 'selecaoTorasModal') {
        torasSelecionadasModal = [];
        const checkboxTodas = document.getElementById('selecionarTodas');
        if (checkboxTodas) checkboxTodas.checked = false;
    }
}

// Funções de cálculo (reutilizando do sistema de romaneio)
function calcularVolumeTora(diametro, comprimento) {
    if (!diametro || !comprimento) return 0;
    
    const diametroMetros = Math.abs(parseFloat(diametro)) / 100;
    const compMetros = Math.abs(parseFloat(comprimento)) / 100;
    
    // Usar a mesma fórmula do sistema de romaneio
    const volumeBase = Math.PI * Math.pow(diametroMetros/2, 2) * compMetros;
    const fator = 0.07958; // Fator de ajuste calibrado
    
    return volumeBase * fator;
}

function calcularDescontoOco(oco1, oco2, comprimento) {
    if (!oco1 || !oco2 || !comprimento) return 0;
    
    const o1Metros = Math.abs(parseFloat(oco1)) / 100;
    const o2Metros = Math.abs(parseFloat(oco2)) / 100;
    const compMetros = Math.abs(parseFloat(comprimento)) / 100;
    
    return o1Metros * o2Metros * compMetros;
}

// Funções de formatação
function formatCurrency(value) {
    if (value === undefined || value === null) return 'R$ 0,00';
    const numValue = typeof value === 'string' ? parseFloat(value.replace(/[^\d.,]/g, '').replace(',', '.')) : parseFloat(value);
    if (isNaN(numValue)) return 'R$ 0,00';
    return numValue.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

function parseCurrencyValue(value) {
    if (!value) return 0;
    if (typeof value === 'number') return value;
    
    const numericValue = value.toString()
        .replace(/[^\d,.-]/g, '')
        .replace(/\./g, '')
        .replace(',', '.');
    
    return parseFloat(numericValue) || 0;
}

function formatNumber(value, decimals = 3) {
    if (isNaN(value) || value === null || value === undefined) return '0';
    return parseFloat(value).toLocaleString('pt-BR', {
        minimumFractionDigits: decimals,
        maximumFractionDigits: decimals
    });
}

function formatDate(dateString) {
    if (!dateString) return '';
    const date = new Date(dateString);
    return date.toLocaleDateString('pt-BR');
}

function generateUniqueId(prefix = '') {
    const timestamp = new Date().getTime();
    const random = Math.floor(Math.random() * 10000);
    return `${prefix}${timestamp}${random}`;
}

function abrirNovaEspecie() {
    if (window.speciesManagerInstance) {
        window.speciesManagerInstance.openNewSpeciesModal();
    } else {
        console.warn("SpeciesManager não encontrado, tentando carregar via window...");
        // Fallback simples se o manager não estiver pronto
        const nome = prompt("Nome da nova espécie:");
        if (nome) {
             // Lógica simplificada ou alerta
             alert("Por favor, aguarde o carregamento completo do gerenciador de espécies.");
        }
    }
}

// Funções de armazenamento
function resolveCompanyId() {
    try {
        const svc = window.firebaseService || window.firebaseServiceTL || window.FirebaseService;
        if (svc && typeof svc.getTenantId === 'function') {
            const t = svc.getTenantId();
            if (t) return String(t);
        }
        if (svc && typeof svc.getCurrentTenantId === 'function') {
            const t = svc.getCurrentTenantId();
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

function writeLocalStorageValue(key, data) {
    try {
        if (window.SiswebStorage && typeof window.SiswebStorage.write === 'function') {
            window.SiswebStorage.write(key, data);
            return;
        }
    } catch (_) {}
    const payload = typeof data === 'string' ? data : JSON.stringify(data);
    for (const k of getLocalStorageKeys(key)) {
        localStorage.setItem(k, payload);
    }
}

async function getData(key) {
    try {
        if (window.firebaseService && window.firebaseService.authService) {
            try {
                const response = await window.firebaseService.loadFromFirebase(key);
                // Extrair dados do wrapper se existir
                const data = response ? (response.data !== undefined ? response.data : response) : null;
                
                if (data) {
                    if (Array.isArray(data)) return data;
                    if (typeof data === 'object') return Object.values(data);
                    return data;
                }
            } catch (firebaseError) {
                console.warn(`Erro ao carregar ${key} do Firebase:`, firebaseError);
            }
        }
        
        const data = readLocalStorageValue(key);
        return data ? JSON.parse(data) : null;
    } catch (error) {
        console.error(`Erro ao recuperar dados de '${key}':`, error);
        return null;
    }
}

async function saveDataAsync(key, data) {
    try {
        writeLocalStorageValue(key, JSON.stringify(data));
        
        if (window.firebaseService && window.firebaseService.authService) {
            try {
                await window.firebaseService.saveToFirebase(key, null, data);
                console.log(`${key} salvo no Firebase com sucesso`);
            } catch (firebaseError) {
                console.warn(`Erro ao salvar ${key} no Firebase:`, firebaseError);
            }
        }
        
        return true;
    } catch (error) {
        console.error(`Erro ao salvar dados em '${key}':`, error);
        return false;
    }
}

async function getDataAsync(key) {
    return getData(key);
}

// Expor funções globalmente
window.showTab = showTab;
window.limparFormularioEntrada = limparFormularioEntrada;
window.abrirBaixaPorLote = abrirBaixaPorLote;
window.abrirBaixaIndividual = abrirBaixaIndividual;
window.filtrarTorasDisponiveis = filtrarTorasDisponiveis;
window.selecionarTodasToras = selecionarTodasToras;
window.toggleToraSelecao = toggleToraSelecao;
window.confirmarSelecaoToras = confirmarSelecaoToras;
window.adicionarToraManualSaida = adicionarToraManualSaida;
window.removerToraSaida = removerToraSaida;
window.cancelarSaida = cancelarSaida;
window.buscarToraPorPlaqueta = buscarToraPorPlaqueta;
window.adicionarToraBaixaPorPlaqueta = adicionarToraBaixaPorPlaqueta;
window.onSaidaPlaquetaKeydown = onSaidaPlaquetaKeydown;
window.onManualSaidaKeydown = onManualSaidaKeydown;
window.adicionarRomaneioSaidaSelecionado = adicionarRomaneioSaidaSelecionado;
window.removerRomaneioSaidaSelecionado = removerRomaneioSaidaSelecionado;
window.filtrarEstoque = filtrarEstoque;
window.editarTora = editarTora;
window.excluirTora = excluirTora;
window.filtrarMovimentacoes = filtrarMovimentacoes;
window.gerarRelatorio = gerarRelatorio;
window.imprimirRelatorioEstoque = imprimirRelatorioEstoque;
window.imprimirConsultaEstoque = imprimirConsultaEstoque;
window.imprimirEstoqueProdutos = imprimirEstoqueProdutos;
window.imprimirMovimentacoesEstoque = imprimirMovimentacoesEstoque;
window.fecharModal = fecharModal; 
window.filtrarComprasMov = filtrarComprasMov;
window.estornarRemessaBaixa = estornarRemessaBaixa;

// Novas funções exportadas
window.carregarRomaneiosParaSelect = carregarRomaneiosParaSelect;
window.carregarItensDoRomaneioSelecionado = carregarItensDoRomaneioSelecionado;
window.abrirHistoricoEstoque = abrirHistoricoEstoque;
window.adicionarItemEntrada = adicionarItemEntrada;
window.mudarPaginaEntrada = mudarPaginaEntrada;
window.mudarPaginaSaida = mudarPaginaSaida;
window.mudarPaginaEstoque = mudarPaginaEstoque;
window.mudarPaginaMovimentacoes = mudarPaginaMovimentacoes;
window.mudarPaginaComprasMov = mudarPaginaComprasMov;
window.abrirNovaEspecie = abrirNovaEspecie;
window.removerItemEntrada = removerItemEntrada;
window.limparTabelaEntrada = limparTabelaEntrada;
window.toggleTodosEntrada = toggleTodosEntrada;
window.limparCamposEntrada = limparCamposEntrada;
window.showLoading = showLoading;
window.hideLoading = hideLoading;
// ===== Entradas por Compras =====
let comprasMovimentos = [];

async function carregarComprasMov(filtro = {}) {
    try {
        comprasMovimentos = await getData('estoqueComprasMov') || [];
        renderizarComprasMov(filtro);
    } catch (e) {
        console.warn('⚠️ Erro ao carregar movimentos de compras:', e);
        comprasMovimentos = [];
        renderizarComprasMov(filtro);
    }
}

function formatCurrencyBR(value) {
    const n = parseFloat(value) || 0;
    return n.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

function renderizarComprasMov(filtro = {}) {
    const tbody = document.getElementById('comprasMovTable');
    const volEl = document.getElementById('comprasTotalVolume');
    const valEl = document.getElementById('comprasTotalValor');
    if (!tbody) return;
    filtroComprasMovAtual = filtro || {};
    let lista = Array.isArray(comprasMovimentos) ? comprasMovimentos.slice() : [];
    const statusSelecionado = (filtro.status || document.getElementById('comprasStatusFiltro')?.value || 'pendente');

    // Aplicar filtros
    if (filtro.dataInicio) {
        const di = new Date(filtro.dataInicio);
        lista = lista.filter(m => m.data && new Date(m.data) >= di);
    }
    if (filtro.dataFim) {
        const df = new Date(filtro.dataFim); df.setHours(23,59,59,999);
        lista = lista.filter(m => m.data && new Date(m.data) <= df);
    }
    if (filtro.fornecedor) {
        const fLower = String(filtro.fornecedor).toLowerCase();
        lista = lista.filter(m => String(m.fornecedorNome || '').toLowerCase().includes(fLower));
    }
    if (statusSelecionado) {
        const sLower = String(statusSelecionado).toLowerCase();
        lista = lista.filter(m => String(m.status || '').toLowerCase() === sLower);
    }

    // Ordenar por data desc
    lista.sort((a,b) => new Date(b.data) - new Date(a.data));
    comprasMovFiltrados = lista.slice();

    if (lista.length === 0) {
        const tr = document.createElement('tr');
        tr.innerHTML = '<td colspan="6" style="text-align:center;color:#666;">Nenhum movimento encontrado</td>';
        tbody.innerHTML = '';
        tbody.appendChild(tr);
        renderizarPaginacaoPadrao('paginacaoComprasMov', 0, 1, 10, 'mudarPaginaComprasMov');
    } else {
        let totalVol = 0; let totalVal = 0;
        lista.forEach(m => {
            totalVol += (parseFloat(m.totalVolume) || 0);
            totalVal += (parseFloat(m.totalValor) || 0);
        });
        if (volEl) volEl.textContent = `${totalVol.toFixed(3)} m³`;
        if (valEl) valEl.textContent = formatCurrencyBR(totalVal);
        const itensPorPagina = 10;
        const totalPaginas = Math.max(1, Math.ceil(lista.length / itensPorPagina));
        if (paginaAtualComprasMov > totalPaginas) paginaAtualComprasMov = totalPaginas;
        if (paginaAtualComprasMov < 1) paginaAtualComprasMov = 1;
        const inicio = (paginaAtualComprasMov - 1) * itensPorPagina;
        const pagina = lista.slice(inicio, inicio + itensPorPagina);
        tbody.innerHTML = pagina.map(m => `
            <tr>
                <td>${m.data || '-'}</td>
                <td>${m.fornecedorNome || '-'}</td>
                <td>${(parseFloat(m.totalVolume)||0).toFixed(3)}</td>
                <td>${formatCurrencyBR(m.totalValor || 0)}</td>
                <td>${m.origem || '-'}</td>
                <td>${m.status || '-'}</td>
            </tr>
        `).join('');
        renderizarPaginacaoPadrao('paginacaoComprasMov', lista.length, paginaAtualComprasMov, itensPorPagina, 'mudarPaginaComprasMov');
    }
}

function filtrarComprasMov() {
    const filtro = {
        dataInicio: document.getElementById('comprasDataInicio')?.value || '',
        dataFim: document.getElementById('comprasDataFim')?.value || '',
        fornecedor: document.getElementById('comprasFornecedorFiltro')?.value || '',
        status: document.getElementById('comprasStatusFiltro')?.value || 'pendente'
    };
    paginaAtualComprasMov = 1;
    renderizarComprasMov(filtro);
}

function mudarPaginaComprasMov(p) {
    paginaAtualComprasMov = p;
    renderizarComprasMov(filtroComprasMovAtual);
}
