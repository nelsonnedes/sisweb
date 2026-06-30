// ✅ CORREÇÃO FINAL DOS MODAIS DE FORNECEDOR - ROMANEIOTORA (VERSÃO LIMPA)
// Solução definitiva para todos os problemas de modal

console.log("🔧 === CORREÇÃO FINAL LIMPA DOS MODAIS DE FORNECEDOR - ROMANEIOTORA ===");

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
            const id = raw.companyId || raw.companyID || raw.tenantId || raw.id;
            if (id) return String(id);
        }
        const stored = localStorage.getItem('company_info');
        if (stored) {
            const obj = JSON.parse(stored);
            const id = obj && (obj.companyId || obj.companyID || obj.tenantId || obj.id);
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
            if (ns && ns !== base) keys.push(ns);
        } else {
            const companyId = resolveCompanyId();
            if (companyId && !/^companies\//.test(base) && !/^users\//.test(base)) {
                keys.push(`companies/${companyId}/${base}`);
            }
        }
        keys.push(base);
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

// ✅ 1. DESATIVAR COMPLETAMENTE O SISTEMA PROBLEMÁTICO
function desativarSistemaProblematico() {
    console.log("🛑 Desativando sistema problemático...");
    
    // Limpar intervalos de monitoramento que causam loop infinito
    if (window.monitoramentoPeriodicoRomaneios) {
        try {
            clearInterval(window.monitoramentoPeriodicoRomaneios);
            window.monitoramentoPeriodicoRomaneios = null;
            console.log("  - ✅ Intervalo de monitoramento limpo");
        } catch (error) {
            console.warn("  - ⚠️ Erro ao limpar intervalo:", error);
        }
    }
    
    // Desativar funções que causam loop infinito
    const funcoesProblematicas = [
        'interceptarTodasFuncoesListaRomaneios',
        'inicializarCorrecoesListaRomaneios',
        'monitoramentoPeriodicoRomaneios'
    ];
    
    funcoesProblematicas.forEach(funcao => {
        if (window[funcao]) {
            window[funcao] = function() {
                console.log(`🛑 Função ${funcao} desativada para evitar loop infinito`);
            };
        }
    });
    
    // Desativar script de diagnóstico que abre modais automaticamente
    if (window.diagnosticoModalTora) {
        window.diagnosticoModalTora.executar = function() {
            console.log("🛑 Diagnóstico automático desativado");
        };
    }
    
    console.log("✅ Sistema problemático desativado");
}

// ✅ 2. AGUARDAR CARREGAMENTO COMPLETO SEM INTERFERIR
function aguardarCarregamentoCompleto() {
    return new Promise((resolve) => {
        if (document.readyState === 'complete') {
            resolve();
        } else {
            window.addEventListener('load', resolve);
        }
    });
}

// ✅ 3. FUNÇÃO SIMPLES PARA ABRIR MODAL DE LISTA DE FORNECEDORES
function abrirModalListaFornecedores() {
    console.log("📋 Abrindo lista de fornecedores...");
    
    // Verificar se o modal existe
    const modal = document.getElementById('clientListModal');
    if (!modal) {
        console.error("❌ Modal de lista não encontrado");
        return;
    }
    
    // Atualizar título para fornecedores
    const title = modal.querySelector('.modal-title');
    if (title) {
        title.textContent = 'Lista de Fornecedores';
    }
    
    // Atualizar botão para fornecedores
    const newButton = modal.querySelector('.btn-save');
    if (newButton) {
        newButton.textContent = 'Novo Fornecedor';
        newButton.onclick = function() {
            modal.style.display = 'none';
            abrirModalNovoFornecedor();
        };
    }
    
    // Carregar e exibir dados
    carregarDadosFornecedores();

    // Configurar filtro dinâmico
    const filtroInput = modal.querySelector('#clientListFilter');
    if (filtroInput) {
        filtroInput.oninput = function() {
            const base = window._listaFornecedoresCache || [];
            const filtrados = filtrarListaFornecedores(this.value, base);
            renderizarTabelaFornecedores(filtrados);
        };
    }
    modal.style.display = 'block';
    
    // Configurar eventos de fechamento
    const closeButtons = modal.querySelectorAll('.close-modal, .close-modal-btn');
    closeButtons.forEach(btn => {
        btn.onclick = function() {
            modal.style.display = 'none';
        };
    });
}

// ✅ 4. FUNÇÃO SIMPLES PARA ABRIR MODAL DE NOVO FORNECEDOR
function abrirModalNovoFornecedor() {
    console.log("📝 Abrindo modal de novo fornecedor...");
    
    const modal = document.getElementById('clientModal');
    if (!modal) {
        console.error("❌ Modal de fornecedor não encontrado");
        return;
    }
    
    // Resetar formulário
    const form = modal.querySelector('#clientForm');
    if (form) {
        form.reset();
    }
    
    // Limpar ID
    const clientId = modal.querySelector('#clientId');
    if (clientId) {
        clientId.value = '';
    }
    
    // Atualizar título
    const title = modal.querySelector('#clientModalTitle');
    if (title) {
        title.textContent = 'Novo Fornecedor';
    }
    
    // Limpar variável de edição
    window.editingClientId = null;
    
    // Abrir modal
    modal.style.display = 'block';
    modal.style.visibility = 'visible';
    modal.style.opacity = '1';
    
    // Focar no campo nome
    setTimeout(() => {
        const nameField = modal.querySelector('#clientName');
        if (nameField) {
            nameField.focus();
        }
    }, 100);
    
    // Configurar eventos de fechamento
    const closeButtons = modal.querySelectorAll('.close-modal, .close-modal-btn');
    closeButtons.forEach(btn => {
        btn.onclick = function() {
            modal.style.display = 'none';
        };
    });
}

// ✅ 5. FUNÇÃO PARA CARREGAR DADOS DE FORNECEDORES
async function loadAllFornecedores() {
    let clients = [], fornecedores = [];
    try {
        if (typeof window.getData === 'function') {
            clients = await window.getData('clients') || [];
            fornecedores = await window.getData('fornecedores') || [];
        } else if (typeof getData === 'function') {
            clients = await getData('clients') || [];
            fornecedores = await getData('fornecedores') || [];
        } else {
            const localClients = readLocalStorageValue('clients');
            const localFornecedores = readLocalStorageValue('fornecedores');
            if (localClients) clients = JSON.parse(localClients);
            if (localFornecedores) fornecedores = JSON.parse(localFornecedores);
        }
    } catch (error) {
        console.error("❌ Erro ao carregar fornecedores unificados:", error);
    }
    const all = [...clients, ...fornecedores];
    const seen = new Set();
    const unique = [];
    function keyFor(f) {
        if (f && f.id) return `id:${String(f.id)}`;
        const cnpj = f && f.cnpj;
        if (cnpj) return `cnpj:${String(cnpj).replace(/\D/g,'')}`;
        const nome = (f && (f.nome || f.name || '')) + '|' + (f && (f.city || f.cidade || '')) + '|' + (f && (f.state || f.estado || ''));
        return `name:${nome.toLowerCase()}`;
    }
    for (const f of all) {
        const k = keyFor(f);
        if (!seen.has(k)) {
            seen.add(k);
            unique.push(f);
        }
    }
    unique.sort((a,b) => (a?.nome || a?.name || '').localeCompare(b?.nome || b?.name || ''));
    return unique;
}

function filtrarListaFornecedores(query, lista) {
    const q = (query || '').trim().toLowerCase();
    if (!q) return lista;
    return (lista || []).filter(f => {
        const campos = [
            f?.nome || f?.name,
            f?.cnpj,
            f?.cidade || f?.city,
            f?.estado || f?.state,
            f?.telefone || f?.phone,
            f?.email
        ];
        return campos.some(v => v && String(v).toLowerCase().includes(q));
    });
}

async function carregarDadosFornecedores() {
    console.log("📊 Carregando dados de fornecedores...");
    
    try {
        const fornecedores = await loadAllFornecedores();
        window._listaFornecedoresCache = fornecedores;
        const filtroAtual = document.getElementById('clientListFilter')?.value || '';
        const filtrados = filtrarListaFornecedores(filtroAtual, fornecedores);
        
        console.log(`✅ ${fornecedores.length} fornecedores carregados (após filtro: ${filtrados.length})`);
        
        // Renderizar na tabela
        renderizarTabelaFornecedores(filtrados);
        
    } catch (error) {
        console.error("❌ Erro ao carregar fornecedores:", error);
    }
}

// ✅ 6. FUNÇÃO PARA RENDERIZAR TABELA DE FORNECEDORES
function renderizarTabelaFornecedores(fornecedores) {
    console.log("🔄 Renderizando tabela de fornecedores...");
    
    const tbody = document.querySelector('#clientListTable');
    if (!tbody) {
        console.error("❌ Tabela de fornecedores não encontrada");
        return;
    }
    
    if (!fornecedores || fornecedores.length === 0) {
        tbody.innerHTML = '<tr><td colspan="7" style="text-align: center; padding: 20px;">Nenhum fornecedor encontrado</td></tr>';
        return;
    }
    
    let html = '';
    fornecedores.forEach(fornecedor => {
        html += `
            <tr>
                <td>${fornecedor.nome || fornecedor.name || 'Sem nome'}</td>
                <td>${fornecedor.cnpj || ''}</td>
                <td>${fornecedor.cidade || fornecedor.city || ''}</td>
                <td>${fornecedor.estado || fornecedor.state || ''}</td>
                <td>${fornecedor.telefone || fornecedor.phone || ''}</td>
                <td>${fornecedor.email || ''}</td>
                <td>
                    <button class="btn btn-sm btn-primary" onclick="selecionarFornecedor('${fornecedor.id}')">
                        <i class="fas fa-check"></i> Selecionar
                    </button>
                    <button class="btn btn-sm btn-warning" onclick="editarFornecedor('${fornecedor.id}')">
                        <i class="fas fa-edit"></i> Editar
                    </button>
                </td>
            </tr>
        `;
    });
    
    tbody.innerHTML = html;
    console.log(`✅ Tabela renderizada com ${fornecedores.length} fornecedores`);
}

// ✅ 7. FUNÇÃO PARA SELECIONAR FORNECEDOR
async function selecionarFornecedor(id) {
    console.log("✅ Selecionando fornecedor:", id);
    
    try {
        // Carregar dados unificados
        const fornecedores = await loadAllFornecedores();
        
        // Encontrar fornecedor
        const fornecedor = fornecedores.find(f => String(f.id) === String(id));
        if (!fornecedor) {
            console.error("❌ Fornecedor não encontrado:", id);
            return;
        }
        
        // Atualizar campo de entrada
        const clienteInput = document.getElementById('clienteInput');
        if (clienteInput) {
            clienteInput.value = fornecedor.nome || fornecedor.name || '';
        }
        
        // Salvar seleção global
        window.selectedClient = fornecedor;
        
        // Fechar modal
        const modal = document.getElementById('clientListModal');
        if (modal) {
            modal.style.display = 'none';
        }
        
        console.log("✅ Fornecedor selecionado:", fornecedor.nome);
        
    } catch (error) {
        console.error("❌ Erro ao selecionar fornecedor:", error);
    }
}

// ✅ 8. FUNÇÃO PARA EDITAR FORNECEDOR
async function editarFornecedor(id) {
    console.log("✏️ Editando fornecedor:", id);
    
    try {
        // Carregar dados unificados
        const fornecedores = await loadAllFornecedores();
        
        // Encontrar fornecedor
        const fornecedor = fornecedores.find(f => String(f.id) === String(id));
        if (!fornecedor) {
            console.error("❌ Fornecedor não encontrado:", id);
            return;
        }
        
        // Fechar modal de lista
        const listModal = document.getElementById('clientListModal');
        if (listModal) {
            listModal.style.display = 'none';
        }
        
        // Abrir modal de edição
        const modal = document.getElementById('clientModal');
        if (modal) {
            // Resetar formulário
            const form = modal.querySelector('#clientForm');
            if (form) {
                form.reset();
            }
            
            // Preencher campos
            const fields = {
                clientId: fornecedor.id,
                clientName: fornecedor.nome || fornecedor.name || '',
                clientCnpj: fornecedor.cnpj || '',
                clientStateRegistration: fornecedor.inscricaoEstadual || fornecedor.stateRegistration || '',
                clientAddress: fornecedor.endereco || fornecedor.address || '',
                clientNumber: fornecedor.numero || fornecedor.number || '',
                clientNeighborhood: fornecedor.bairro || fornecedor.neighborhood || '',
                clientState: fornecedor.estado || fornecedor.state || '',
                clientCity: fornecedor.cidade || fornecedor.city || '',
                clientPhone: fornecedor.telefone || fornecedor.phone || '',
                clientEmail: fornecedor.email || '',
                clientObs: fornecedor.observacoes || fornecedor.observations || fornecedor.obs || ''
            };
            
            Object.keys(fields).forEach(fieldId => {
                const field = modal.querySelector(`#${fieldId}`);
                if (field) {
                    field.value = fields[fieldId];
                }
            });
            
            // Atualizar título
            const title = modal.querySelector('#clientModalTitle');
            if (title) {
                title.textContent = 'Editar Fornecedor';
            }
            
            // Definir ID de edição
            window.editingClientId = fornecedor.id;
            
            // Abrir modal
            modal.style.display = 'block';
            modal.style.visibility = 'visible';
            modal.style.opacity = '1';
            
            // Focar no campo nome
            setTimeout(() => {
                const nameField = modal.querySelector('#clientName');
                if (nameField) {
                    nameField.focus();
                }
            }, 100);
            
            console.log("✅ Modal de edição aberto para:", fornecedor.nome);
        }
        
    } catch (error) {
        console.error("❌ Erro ao editar fornecedor:", error);
    }
}

// ✅ 9. SUBSTITUIR FUNÇÕES GLOBAIS DE FORMA SEGURA
function substituirFuncoesGlobais() {
    console.log("🔄 Substituindo funções globais de forma segura...");
    
    // Substituir openClientListModal apenas se não for nossa função
    if (!window.openClientListModal || !window.openClientListModal._isFixed) {
        window.openClientListModal = function() {
            console.log("📋 openClientListModal redirecionado para modal de fornecedores");
            abrirModalListaFornecedores();
        };
        window.openClientListModal._isFixed = true;
    }
    
    // Substituir openNewClientModal apenas se não for nossa função
    if (!window.openNewClientModal || !window.openNewClientModal._isFixed) {
        window.openNewClientModal = function() {
            console.log("📝 openNewClientModal redirecionado para novo fornecedor");
            abrirModalNovoFornecedor();
        };
        window.openNewClientModal._isFixed = true;
    }
    
    // Criar openNewFornecedorModal se não existir
    if (!window.openNewFornecedorModal) {
        window.openNewFornecedorModal = function() {
            console.log("📝 openNewFornecedorModal executado");
            abrirModalNovoFornecedor();
        };
    }
    
    // ✅ CORREÇÃO: Usar função do fornecedor-modals.js para edição
    if (!window.editClientFromList || !window.editClientFromList._isFixed) {
        // Verificar se a função do fornecedor-modals.js está disponível
        if (window.fornecedorModals && typeof window.fornecedorModals.editClientFromList === 'function') {
            console.log("✅ Usando função editClientFromList do fornecedor-modals.js");
            window.editClientFromList = window.fornecedorModals.editClientFromList;
        } else if (typeof window.loadClientForEdit === 'function') {
            console.log("✅ Usando função loadClientForEdit como fallback");
            window.editClientFromList = async function(id) {
                console.log("✏️ editClientFromList redirecionado para loadClientForEdit");
                
                try {
                    // Carregar dados do fornecedor
                    let fornecedores = [];
                    if (typeof window.getData === 'function') {
                        fornecedores = await window.getData('fornecedores') || [];
                    }
                    
                    const fornecedor = fornecedores.find(f => String(f.id) === String(id));
                    if (fornecedor) {
                        await window.loadClientForEdit(fornecedor);
                    } else {
                        console.error("❌ Fornecedor não encontrado:", id);
                        alert('Fornecedor não encontrado!');
                    }
                } catch (error) {
                    console.error("❌ Erro ao editar fornecedor:", error);
                    alert('Erro ao editar fornecedor: ' + error.message);
                }
            };
        } else {
            console.log("⚠️ Usando função editarFornecedor local como último recurso");
            window.editClientFromList = function(id) {
                console.log("✏️ editClientFromList redirecionado para editar fornecedor");
                editarFornecedor(id);
            };
        }
        window.editClientFromList._isFixed = true;
    }
    
    // Expor funções globalmente
    window.selecionarFornecedor = selecionarFornecedor;
    window.editarFornecedor = editarFornecedor;
    window.abrirModalListaFornecedores = abrirModalListaFornecedores;
    window.abrirModalNovoFornecedor = abrirModalNovoFornecedor;
    
    console.log("✅ Funções globais substituídas com segurança");
}

// ✅ 10. FUNÇÃO PRINCIPAL DE INICIALIZAÇÃO
async function inicializarCorrecaoFinalLimpa() {
    console.log("🚀 Iniciando correção final limpa dos modais de fornecedor...");
    
    try {
        // 1. Desativar sistema problemático PRIMEIRO
        desativarSistemaProblematico();
        
        // 2. Aguardar carregamento completo
        await aguardarCarregamentoCompleto();
        
        // 3. Aguardar um pouco para estabilizar
        await new Promise(resolve => setTimeout(resolve, 1000));
        
        // 4. Substituir funções globais
        substituirFuncoesGlobais();
        
        // 5. Verificar se tudo está funcionando
        setTimeout(() => {
            console.log("🔍 Verificando funções corrigidas...");
            
            const funcoes = [
                'openClientListModal',
                'openNewClientModal', 
                'openNewFornecedorModal',
                'editClientFromList',
                'selecionarFornecedor',
                'editarFornecedor'
            ];
            
            funcoes.forEach(funcao => {
                const disponivel = typeof window[funcao] === 'function';
                console.log(`  - ${funcao}:`, disponivel ? '✅ Disponível' : '❌ Não disponível');
            });
            
            console.log("✅ === CORREÇÃO FINAL LIMPA CONCLUÍDA ===");
            console.log("💡 Agora você pode:");
            console.log("  - Clicar no ícone de lista para abrir a lista de fornecedores");
            console.log("  - Clicar no ícone de + para criar novo fornecedor");
            console.log("  - Editar fornecedores na lista");
            console.log("  - Selecionar fornecedores da lista");
            
        }, 500);
        
    } catch (error) {
        console.error("❌ Erro na correção final:", error);
    }
}

// ✅ 11. EXECUTAR CORREÇÃO AUTOMATICAMENTE APENAS UMA VEZ
if (!window._CORRECAO_FINAL_EXECUTADA) {
    window._CORRECAO_FINAL_EXECUTADA = true;
    
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', inicializarCorrecaoFinalLimpa);
    } else {
        inicializarCorrecaoFinalLimpa();
    }
}

// ✅ 12. EXPOR FUNÇÃO PARA EXECUÇÃO MANUAL
window.corrigirModaisFornecedorFinalLimpa = inicializarCorrecaoFinalLimpa;

console.log("💡 Para executar a correção manualmente, digite: corrigirModaisFornecedorFinalLimpa()");
