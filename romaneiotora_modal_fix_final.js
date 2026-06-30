// ✅ CORREÇÃO FINAL DOS MODAIS DE FORNECEDOR - ROMANEIOTORA
// Baseado no padrão bem-sucedido do romaneiopct.html

console.log("🔧 === CORREÇÃO FINAL DE MODAIS DE FORNECEDOR - ROMANEIOTORA ===");

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

// ✅ 1. DESATIVAR SISTEMA DE INTERCEPTAÇÃO PROBLEMÁTICO
function desativarInterceptacaoProblematica() {
    console.log("🛑 Desativando sistema de interceptação problemático...");
    
    // Limpar intervalos de monitoramento
    if (window.monitoramentoPeriodicoRomaneios) {
        try {
            clearInterval(window.monitoramentoPeriodicoRomaneios);
            window.monitoramentoPeriodicoRomaneios = null;
            console.log("  - ✅ Intervalo de monitoramento limpo");
        } catch (error) {
            console.warn("  - ⚠️ Erro ao limpar intervalo:", error);
        }
    }
    
    // Desativar funções problemáticas
    if (window.interceptarTodasFuncoesListaRomaneios) {
        window.interceptarTodasFuncoesListaRomaneios = function() {
            console.log("🛑 Função interceptarTodasFuncoesListaRomaneios desativada");
        };
    }
    
    if (window.inicializarCorrecoesListaRomaneios) {
        window.inicializarCorrecoesListaRomaneios = function() {
            console.log("🛑 Função inicializarCorrecoesListaRomaneios desativada");
        };
    }
    
    console.log("✅ Sistema de interceptação problemático desativado");
}

// ✅ 2. AGUARDAR CARREGAMENTO COMPLETO
function aguardarCarregamento() {
    return new Promise((resolve) => {
        if (document.readyState === 'complete') {
            resolve();
        } else {
            window.addEventListener('load', resolve);
        }
    });
}

// ✅ 3. FUNÇÃO PARA USAR MODAL PADRONIZADO DO ROMANEIOPCT
function abrirModalFornecedorPadronizado() {
    console.log("📝 Abrindo modal de fornecedor usando padrão do romaneiopct...");
    
    // Verificar se o sistema padronizado está disponível
    if (typeof window.openStandardizedClientModal === 'function') {
        console.log("✅ Usando sistema padronizado (standardized-client-modal.js)");
        
        // Configurar para romaneiotora (fornecedores)
        const config = {
            modalId: 'clientListModal',
            title: 'Lista de Fornecedores',
            newButtonText: 'Novo Fornecedor',
            newButtonCallback: 'openNewClientModal'
        };
        
        window.openStandardizedClientModal(config);
        return;
    }
    
    // Fallback: usar modal nativo se existir
    const modal = document.getElementById('clientListModal');
    if (modal) {
        console.log("✅ Usando modal nativo existente");
        
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
        
        // Carregar dados e abrir modal
        carregarListaFornecedores();
        modal.style.display = 'block';
        
        // Configurar eventos de fechamento
        const closeButtons = modal.querySelectorAll('.close-modal, .close-modal-btn');
        closeButtons.forEach(btn => {
            btn.onclick = function() {
                modal.style.display = 'none';
            };
        });
        
        return;
    }
    
    console.error("❌ Nenhum sistema de modal disponível");
    alert("Erro: Sistema de modal não disponível. Verifique se todos os scripts foram carregados.");
}

// ✅ 4. FUNÇÃO PARA ABRIR MODAL DE NOVO FORNECEDOR
function abrirModalNovoFornecedor() {
    console.log("📝 Abrindo modal de novo fornecedor...");
    
    // Fallback: usar modal nativo
    const modal = document.getElementById('clientModal');
    if (modal) {
        console.log("✅ Usando modal nativo para novo fornecedor");
        
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
        
        return;
    }
    
    console.error("❌ Modal de fornecedor não encontrado");
    alert("Erro: Modal de fornecedor não encontrado.");
}

// ✅ 5. FUNÇÃO PARA CARREGAR LISTA DE FORNECEDORES
async function carregarListaFornecedores() {
    console.log("📊 Carregando lista de fornecedores...");
    
    try {
        // Tentar carregar via getData
        let fornecedores = [];
        
        if (window.clientService && typeof window.clientService.getClients === 'function') {
            fornecedores = await window.clientService.getClients(false);
        } else if (typeof window.getData === 'function') {
            fornecedores = await window.getData('clients') || [];
        } else if (typeof getData === 'function') {
            fornecedores = await getData('clients') || [];
        } else {
            // Fallback para localStorage
            const localData = readLocalStorageValue('clients');
            if (localData) {
                fornecedores = JSON.parse(localData);
            }
        }
        
        console.log(`✅ ${fornecedores.length} fornecedores carregados`);
        
        // Renderizar na tabela
        renderizarTabelaFornecedores(fornecedores);
        
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
        // Carregar dados exclusivamente de 'fornecedores'
        let fornecedores = [];
        if (window.clientService && typeof window.clientService.getClients === 'function') {
            fornecedores = await window.clientService.getClients(false);
        } else if (typeof window.getData === 'function') {
            fornecedores = await window.getData('clients') || [];
        } else if (typeof getData === 'function') {
            fornecedores = await getData('clients') || [];
        } else {
            try {
                const s = readLocalStorageValue('clients');
                fornecedores = s ? JSON.parse(s) : [];
            } catch(_) { fornecedores = []; }
        }
        
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
        // Carregar dados
        let fornecedores = [];
        if (typeof window.getData === 'function') {
            fornecedores = await window.getData('clients') || [];
        } else if (typeof getData === 'function') {
            fornecedores = await getData('clients') || [];
        }
        
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

// ✅ 9. SUBSTITUIR FUNÇÕES GLOBAIS
function substituirFuncoesGlobais() {
    console.log("🔄 Substituindo funções globais...");
    
    // Substituir openClientListModal
    window.openClientListModal = function() {
        console.log("📋 openClientListModal redirecionado para modal de fornecedores");
        abrirModalFornecedorPadronizado();
    };
    
    // Substituir openNewClientModal
    window.openNewClientModal = function() {
        console.log("📝 openNewClientModal redirecionado para novo fornecedor");
        abrirModalNovoFornecedor();
    };
    
    // Criar openNewFornecedorModal
    window.openNewFornecedorModal = function() {
        console.log("📝 openNewFornecedorModal executado");
        abrirModalNovoFornecedor();
    };
    
    // Substituir editClientFromList
    window.editClientFromList = function(id) {
        console.log("✏️ editClientFromList redirecionado para editar fornecedor");
        editarFornecedor(id);
    };
    
    // Expor funções globalmente
    window.selecionarFornecedor = selecionarFornecedor;
    window.editarFornecedor = editarFornecedor;
    window.abrirModalFornecedorPadronizado = abrirModalFornecedorPadronizado;
    window.abrirModalNovoFornecedor = abrirModalNovoFornecedor;
    
    console.log("✅ Funções globais substituídas");
}

// ✅ 10. FUNÇÃO PRINCIPAL DE INICIALIZAÇÃO
async function inicializarCorrecaoFinal() {
    console.log("🚀 Iniciando correção final dos modais de fornecedor...");
    
    try {
        // 1. Aguardar carregamento completo
        await aguardarCarregamento();
        
        // 2. Desativar sistema problemático
        desativarInterceptacaoProblematica();
        
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
            
            console.log("✅ === CORREÇÃO FINAL CONCLUÍDA ===");
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

// ✅ 11. EXECUTAR CORREÇÃO AUTOMATICAMENTE
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', inicializarCorrecaoFinal);
} else {
    inicializarCorrecaoFinal();
}

// ✅ 12. EXPOR FUNÇÃO PARA EXECUÇÃO MANUAL
window.corrigirModaisFornecedorFinal = inicializarCorrecaoFinal;

console.log("💡 Para executar a correção manualmente, digite: corrigirModaisFornecedorFinal()"); 
