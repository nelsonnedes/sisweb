// garantia-fluxo-fornecedor.js - v1.0
// Script para garantir que o fluxo Salvar Fornecedor → Listar Fornecedores funcione 100%

console.log('🔧 Garantindo funcionamento do fluxo de fornecedores...');

// Função para formatar telefone (corrigir erro)
if (!window.formatarTelefone) {
    window.formatarTelefone = function(input) {
        if (!input || !input.value) return;
        
        // Remove tudo que não é dígito
        let telefone = input.value.replace(/\D/g, '');
        
        // Aplica máscara conforme o tamanho
        if (telefone.length <= 10) {
            // Telefone fixo: (XX) XXXX-XXXX
            telefone = telefone.replace(/(\d{2})(\d{4})(\d{4})/, '($1) $2-$3');
        } else {
            // Celular: (XX) 9XXXX-XXXX
            telefone = telefone.replace(/(\d{2})(\d{5})(\d{4})/, '($1) $2-$3');
        }
        
        input.value = telefone;
    };
    console.log('✅ Função formatarTelefone adicionada');
}

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

function writeLocalStorageValue(key, data) {
    const payload = typeof data === 'string' ? data : JSON.stringify(data);
    for (const k of getLocalStorageKeys(key)) {
        localStorage.setItem(k, payload);
    }
}

function removeLocalStorageValue(key) {
    for (const k of getLocalStorageKeys(key)) {
        localStorage.removeItem(k);
    }
}

// Sistema de garantia do fluxo de fornecedores
window.garantiaFornecedor = {
    
    // Verificar se todas as dependências estão disponíveis
    verificarDependencias() {
        console.log('🔍 === VERIFICANDO DEPENDÊNCIAS DO SISTEMA ===');
        
        const checks = {
            firebaseService: !!window.firebaseService,
            firebaseServiceSaveToFirebase: !!(window.firebaseService && typeof window.firebaseService.saveToFirebase === 'function'),
            firebaseServiceSaveData: !!(window.firebaseService && typeof window.firebaseService.saveData === 'function'),
            firebaseServiceLoadData: !!(window.firebaseService && typeof window.firebaseService.loadData === 'function'),
            databaseAdapter: !!window.databaseAdapter,
            firebaseConfig: !!(window.firebase && window.firebase.apps && window.firebase.apps.length > 0),
            modalSalvar: !!document.getElementById('clientModal'),
            modalListar: !!document.getElementById('clientListModal'),
            funcaoSaveClient: typeof window.saveClient === 'function',
            funcaoRenderList: typeof window.renderClientList === 'function' || typeof window.renderFornecedorList === 'function'
        };
        
        console.log('📊 Status das dependências:', checks);
        
        // Analisar prioridades de salvamento
        const sistemaSalvamento = checks.firebaseServiceSaveToFirebase || checks.firebaseServiceSaveData || checks.databaseAdapter;
        console.log(`💾 Sistema de salvamento disponível: ${sistemaSalvamento ? '✅ SIM' : '❌ NÃO'}`);
        
        if (checks.firebaseServiceSaveToFirebase) {
            console.log('  - Prioridade 1: ✅ firebaseService.saveToFirebase');
        } else if (checks.firebaseServiceSaveData) {
            console.log('  - Prioridade 2: ✅ firebaseService.saveData');
        } else if (checks.databaseAdapter) {
            console.log('  - Prioridade 3: ✅ databaseAdapter');
        }
        
        const problemas = Object.entries(checks)
            .filter(([key, value]) => !value && !['modalSalvar', 'modalListar'].includes(key))
            .map(([key]) => key);
            
        if (problemas.length > 0) {
            console.warn('⚠️ Problemas encontrados:', problemas);
            
            // Se não tiver sistema de salvamento, é crítico
            if (!sistemaSalvamento) {
                console.error('🚨 CRÍTICO: Nenhum sistema de salvamento disponível!');
                return { sucesso: false, problemas, critico: true };
            }
            
            return { sucesso: false, problemas, critico: false };
        }
        
        console.log('✅ Todas as dependências estão OK');
        return { sucesso: true, problemas: [] };
    },
    
    // Garantir que a função saveClient funcione corretamente
    async garantirSaveClient() {
        console.log('💾 === GARANTINDO FUNÇÃO SAVE CLIENT ===');
        
        // Sobrescrever a função saveClient para garantir funcionamento
        window.saveClient = async function(event) {
            if (event) {
                event.preventDefault();
                event.stopPropagation();
            }
            
            console.log('💾 === INICIANDO SALVAMENTO DE FORNECEDOR ===');
            
            try {
                // Verificar se o formulário existe
                const form = document.getElementById('clientForm');
                if (!form) {
                    throw new Error('Formulário de fornecedor não encontrado');
                }
                
                // Obter dados do formulário
                const dados = {
                    id: document.getElementById('clientId')?.value?.trim() || '',
                    nome: document.getElementById('clientName')?.value?.trim() || '',
                    cnpj: document.getElementById('clientCnpj')?.value?.trim() || '',
                    inscricaoEstadual: document.getElementById('clientStateRegistration')?.value?.trim() || '',
                    estado: document.getElementById('clientState')?.value?.trim() || '',
                    cidade: document.getElementById('clientCity')?.value?.trim() || '',
                    telefone: document.getElementById('clientPhone')?.value?.trim() || '',
                    email: document.getElementById('clientEmail')?.value?.trim() || '',
                    endereco: document.getElementById('clientAddress')?.value?.trim() || '',
                    numero: document.getElementById('clientNumber')?.value?.trim() || '',
                    bairro: document.getElementById('clientNeighborhood')?.value?.trim() || '',
                    observacoes: document.getElementById('clientObs')?.value?.trim() || ''
                };
                
                // Validações básicas
                if (!dados.nome) {
                    alert('Nome do fornecedor é obrigatório!');
                    document.getElementById('clientName')?.focus();
                    return false;
                }
                
                if (!dados.estado) {
                    alert('Estado é obrigatório!');
                    document.getElementById('clientState')?.focus();
                    return false;
                }
                
                if (!dados.cidade) {
                    alert('Cidade é obrigatória!');
                    document.getElementById('clientCity')?.focus();
                    return false;
                }
                
                console.log('📝 Dados do fornecedor:', dados);
                
                // Preparar dados para salvamento
                const isEdit = Boolean(dados.id);
                const fornecedorData = {
                    ...dados,
                    id: dados.id || `fornecedor_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
                    createdAt: dados.id ? undefined : new Date().toISOString(),
                    updatedAt: new Date().toISOString(),
                    ativo: true
                };
                
                console.log(`${isEdit ? '✏️ Editando' : '🆕 Criando'} fornecedor:`, fornecedorData.nome);
                
                // Salvar via Firebase
                let sucesso = false;
                
                // PRIORIDADE 1: Usar firebaseService.saveToFirebase (novo método compatível)
                if (window.firebaseService && typeof window.firebaseService.saveToFirebase === 'function') {
                    try {
                        console.log('🔥 Salvando via firebaseService.saveToFirebase...');
                        const resultado = await window.firebaseService.saveToFirebase(
                            `clients/${fornecedorData.id}`, 
                            null, 
                            fornecedorData
                        );
                        
                        if (resultado && resultado.success) {
                            console.log('✅ Fornecedor salvo via firebaseService.saveToFirebase');
                            sucesso = true;
                        } else {
                            throw new Error(resultado?.error || 'Erro ao salvar via firebaseService.saveToFirebase');
                        }
                    } catch (firebaseError) {
                        console.error('❌ Erro firebaseService.saveToFirebase:', firebaseError);
                        throw firebaseError;
                    }
                }
                
                // PRIORIDADE 2: Usar firebaseService.saveData (método direto)
                else if (window.firebaseService && typeof window.firebaseService.saveData === 'function') {
                    try {
                        console.log('🔥 Salvando via firebaseService.saveData...');
                        const resultado = await window.firebaseService.saveData(
                            `clients/${fornecedorData.id}`, 
                            fornecedorData
                        );
                        
                        if (resultado && resultado.success) {
                            console.log('✅ Fornecedor salvo via firebaseService.saveData');
                            sucesso = true;
                        } else {
                            throw new Error(resultado?.error || 'Erro ao salvar via firebaseService.saveData');
                        }
                    } catch (firebaseError) {
                        console.error('❌ Erro firebaseService.saveData:', firebaseError);
                        throw firebaseError;
                    }
                }
                
                // PRIORIDADE 3: Usar databaseAdapter (fallback)
                else if (window.databaseAdapter && typeof window.databaseAdapter.saveData === 'function') {
                    try {
                        console.log('💽 Salvando via DatabaseAdapter...');
                        const clientsData = await window.databaseAdapter.loadData('clients') || { data: [] };
                        let clients = Array.isArray(clientsData.data) ? clientsData.data : [];
                        
                        if (isEdit) {
                            const index = clients.findIndex(c => c.id === dados.id);
                            if (index !== -1) {
                                clients[index] = fornecedorData;
                            } else {
                                clients.push(fornecedorData);
                            }
                        } else {
                            clients.push(fornecedorData);
                        }
                        
                        const resultado = await window.databaseAdapter.saveData('clients', clients);
                        if (resultado && resultado.success) {
                            console.log('✅ Fornecedor salvo via DatabaseAdapter');
                            sucesso = true;
                        } else {
                            throw new Error(resultado?.error || 'Erro ao salvar via DatabaseAdapter');
                        }
                    } catch (adapterError) {
                        console.error('❌ Erro DatabaseAdapter:', adapterError);
                        throw adapterError;
                    }
                } else {
                    console.error('❌ Nenhum sistema de salvamento disponível:');
                    console.error('  - firebaseService.saveToFirebase:', typeof window.firebaseService?.saveToFirebase);
                    console.error('  - firebaseService.saveData:', typeof window.firebaseService?.saveData);
                    console.error('  - databaseAdapter.saveData:', typeof window.databaseAdapter?.saveData);
                    throw new Error('Nenhum sistema de salvamento disponível');
                }
                
                if (sucesso) {
                    // Atualizar cache local
                    try {
                        let clients = JSON.parse(readLocalStorageValue('clients') || '[]');
                        if (isEdit) {
                            const index = clients.findIndex(c => c.id === dados.id);
                            if (index !== -1) {
                                clients[index] = fornecedorData;
                            } else {
                                clients.push(fornecedorData);
                            }
                        } else {
                            clients.push(fornecedorData);
                        }
                        writeLocalStorageValue('clients', clients);
                        window.clients = clients;
                        console.log('✅ Cache local atualizado');
                    } catch (cacheError) {
                        console.warn('⚠️ Erro ao atualizar cache:', cacheError);
                    }
                    
                    // Fechar modal
                    const modal = document.getElementById('clientModal');
                    if (modal) modal.style.display = 'none';
                    
                    // Atualizar campo se necessário
                    const clientInput = document.getElementById('clienteInput');
                    if (clientInput && (!clientInput.value || isEdit)) {
                        clientInput.value = fornecedorData.nome;
                        window.selectedClient = fornecedorData;
                    }
                    
                    // Recarregar lista se estiver aberta
                    const listModal = document.getElementById('clientListModal');
                    if (listModal && listModal.style.display === 'block') {
                        console.log('🔄 Recarregando lista de fornecedores...');
                        if (typeof window.renderClientList === 'function') {
                            await window.renderClientList('');
                        } else if (typeof window.renderFornecedorList === 'function') {
                            await window.renderFornecedorList('');
                        }
                    }
                    
                    // Recarregar dados globais
                    if (typeof window.carregarClientes === 'function') {
                        console.log('🔄 Recarregando clientes globalmente...');
                        await window.carregarClientes();
                    }
                    
                    // Notificar usuário
                    const mensagem = isEdit ? 
                        `Fornecedor "${dados.nome}" atualizado com sucesso!` : 
                        `Fornecedor "${dados.nome}" cadastrado com sucesso!`;
                    alert(mensagem);
                    
                    console.log('✅ FORNECEDOR SALVO COM SUCESSO');
                    return true;
                }
                
            } catch (error) {
                console.error('❌ Erro ao salvar fornecedor:', error);
                alert(`Erro ao salvar fornecedor: ${error.message}`);
                return false;
            }
        };
        
        console.log('✅ Função saveClient garantida');
    },
    
    // Garantir que a função de listar fornecedores funcione
    async garantirListarFornecedores() {
        console.log('📋 === GARANTINDO FUNÇÃO LISTAR FORNECEDORES ===');
        
        // FUNÇÃO REMOVIDA: renderClientList - agora usa standardized-client-modal.js
        // window.renderClientList = async function(filter = '') { ... }
        
        // FUNÇÃO REMOVIDA: renderFornecedorList - agora usa standardized-client-modal.js
        // window.renderFornecedorList = window.renderClientList;
        
        console.log('✅ Função listar fornecedores garantida (agora usa standardized-client-modal.js)');
    },
    
    // Selecionar fornecedor da lista
    async selecionarFornecedor(id) {
        console.log('✅ Selecionando fornecedor:', id);
        
        try {
            // Buscar o fornecedor
            let fornecedores = [];
            
            if (window.firebaseService && window.firebaseService.loadFromFirebase) {
                const resultado = await window.firebaseService.loadFromFirebase('clients');
                if (resultado && resultado.success && resultado.data) {
                    if (Array.isArray(resultado.data)) {
                        fornecedores = resultado.data;
                    } else if (typeof resultado.data === 'object') {
                        fornecedores = Object.keys(resultado.data).map(key => ({
                            id: key,
                            ...resultado.data[key]
                        }));
                    }
                }
            }
            
            const fornecedor = fornecedores.find(f => f.id === id);
            
            if (!fornecedor) {
                alert('Fornecedor não encontrado!');
                return;
            }
            
            // Selecionar o fornecedor
            const clientInput = document.getElementById('clienteInput');
            if (clientInput) {
                clientInput.value = fornecedor.nome;
            }
            window.selectedClient = fornecedor;
            
            // Fechar modal
            const modal = document.getElementById('clientListModal');
            if (modal) modal.style.display = 'none';
            
            console.log('✅ Fornecedor selecionado:', fornecedor.nome);
            
        } catch (error) {
            console.error('❌ Erro ao selecionar fornecedor:', error);
            alert('Erro ao selecionar fornecedor!');
        }
    },
    
    // Editar fornecedor
    async editarFornecedor(id) {
        console.log('✏️ Editando fornecedor:', id);
        
        try {
            // Buscar o fornecedor
            let fornecedores = [];
            
            if (window.firebaseService && window.firebaseService.loadFromFirebase) {
                const resultado = await window.firebaseService.loadFromFirebase('clients');
                if (resultado && resultado.success && resultado.data) {
                    if (Array.isArray(resultado.data)) {
                        fornecedores = resultado.data;
                    } else if (typeof resultado.data === 'object') {
                        fornecedores = Object.keys(resultado.data).map(key => ({
                            id: key,
                            ...resultado.data[key]
                        }));
                    }
                }
            }
            
            const fornecedor = fornecedores.find(f => f.id === id);
            
            if (!fornecedor) {
                alert('❌ Fornecedor não encontrado!');
                console.error('Fornecedor não encontrado:', id);
                return;
            }
            
            console.log('📝 Dados do fornecedor para edição:', fornecedor);
            
            // Fechar modal de lista
            const listModal = document.getElementById('clientListModal');
            if (listModal) {
                listModal.style.display = 'none';
                console.log('✅ Modal de lista fechado');
            }
            
            // Garantir que o modal de edição existe
            let editModal = document.getElementById('clientModal');
            if (!editModal) {
                console.log('🔧 Criando modal de edição...');
                window.openNewClientModal();
                editModal = document.getElementById('clientModal');
            }
            
            if (editModal) {
                editModal.style.display = 'block';
                console.log('✅ Modal de edição aberto');
                
                // Aguardar um pouco para garantir que o DOM foi atualizado
                setTimeout(() => {
                    // Preencher campos
                    const campos = [
                        { id: 'clientId', valor: fornecedor.id },
                        { id: 'clientName', valor: fornecedor.nome || '' },
                        { id: 'clientCnpj', valor: fornecedor.cnpj || '' },
                        { id: 'clientStateRegistration', valor: fornecedor.inscricaoEstadual || '' },
                        { id: 'clientState', valor: fornecedor.estado || '' },
                        { id: 'clientCity', valor: fornecedor.cidade || '' },
                        { id: 'clientPhone', valor: fornecedor.telefone || '' },
                        { id: 'clientEmail', valor: fornecedor.email || '' },
                        { id: 'clientAddress', valor: fornecedor.endereco || '' },
                        { id: 'clientNumber', valor: fornecedor.numero || '' },
                        { id: 'clientNeighborhood', valor: fornecedor.bairro || '' },
                        { id: 'clientObs', valor: fornecedor.observacoes || '' }
                    ];
                    
                    let camposPreenchidos = 0;
                    campos.forEach(campo => {
                        const elemento = document.getElementById(campo.id);
                        if (elemento) {
                            elemento.value = campo.valor;
                            camposPreenchidos++;
                        } else {
                            console.warn(`⚠️ Campo não encontrado: ${campo.id}`);
                        }
                    });
                    
                    console.log(`✅ ${camposPreenchidos}/${campos.length} campos preenchidos`);
                    
                    // Atualizar título do modal
                    const modalTitle = document.getElementById('clientModalTitle');
                    if (modalTitle) {
                        modalTitle.textContent = `✏️ Editar Fornecedor - ${fornecedor.nome}`;
                        console.log('✅ Título do modal atualizado');
                    }
                    
                    // Focar no primeiro campo
                    const nomeField = document.getElementById('clientName');
                    if (nomeField) {
                        nomeField.focus();
                        console.log('✅ Foco definido no campo nome');
                    }
                    
                }, 150);
            } else {
                throw new Error('Não foi possível criar o modal de edição');
            }
            
            console.log(`✅ Edição iniciada para: ${fornecedor.nome}`);
            
        } catch (error) {
            console.error('❌ Erro ao editar fornecedor:', error);
            alert(`❌ Erro ao editar fornecedor: ${error.message}`);
        }
    },
    
    // Executar todas as garantias
    async aplicarTodasGarantias() {
        console.log('🚀 === APLICANDO TODAS AS GARANTIAS ===');
        
        const dependencias = this.verificarDependencias();
        if (!dependencias.sucesso) {
            console.warn('⚠️ Algumas dependências não estão disponíveis:', dependencias.problemas);
        }
        
        await this.garantirSaveClient();
        await this.garantirListarFornecedores();
        
        console.log('✅ TODAS AS GARANTIAS APLICADAS - SISTEMA PRONTO!');
        
        return {
            sucesso: true,
            saveClient: typeof window.saveClient === 'function',
            renderList: typeof window.renderClientList === 'function',
            dependencias: dependencias.sucesso
        };
    },
    
    // Resolver problemas de storage
    async resolverProblemasStorage() {
        console.log('🔧 === RESOLVENDO PROBLEMAS DE STORAGE ===');
        
        try {
            // Testar localStorage
            const testKey = 'storage_test_' + Date.now();
            writeLocalStorageValue(testKey, 'test');
            const testValue = readLocalStorageValue(testKey);
            removeLocalStorageValue(testKey);
            
            if (testValue === 'test') {
                console.log('✅ LocalStorage funcionando normalmente');
                return { localStorage: true, problema: null };
            } else {
                throw new Error('LocalStorage não está retornando valores corretos');
            }
            
        } catch (error) {
            console.error('❌ Problema com localStorage:', error.message);
            
            // Mostrar instruções para o usuário
            const instrucoes = `
🚨 PROBLEMA DE STORAGE DETECTADO!

🛠️ SOLUÇÕES:

1️⃣ MICROSOFT EDGE:
   • Clique no 🛡️ ícone do escudo na barra de endereços
   • Selecione "Desativar proteção para este site"
   • Recarregue a página (F5)

2️⃣ FIREFOX:
   • Clique no 🛡️ ícone do escudo
   • Selecione "Desativar proteção aprimorada"
   • Recarregue a página (F5)

3️⃣ CHROME:
   • Vá em Configurações → Privacidade e segurança
   • Desative "Bloquear cookies de terceiros"
   • Recarregue a página (F5)

4️⃣ ALTERNATIVA:
   • Use modo anônimo/privado
   • Ou use outro navegador

⚠️ Sem localStorage, o sistema não pode salvar dados!
            `;
            
            console.log(instrucoes);
            alert('🚨 Problema de Storage Detectado!\n\nVeja o console (F12) para instruções de como resolver.');
            
            return { localStorage: false, problema: error.message, instrucoes };
        }
    },
    
    // Teste completo do sistema
    async testeCompleto() {
        console.log('🧪 === TESTE COMPLETO DO SISTEMA ===');
        
        // 1. Verificar storage
        const storageTest = await this.resolverProblemasStorage();
        console.log('📱 Storage:', storageTest.localStorage ? '✅ OK' : '❌ PROBLEMA');
        
        // 2. Verificar dependências
        const deps = this.verificarDependencias();
        console.log('🔧 Dependências:', deps.sucesso ? '✅ OK' : '⚠️ PARCIAL');
        
        // 3. Aplicar garantias
        const garantias = await this.aplicarTodasGarantias();
        console.log('🛡️ Garantias:', garantias.sucesso ? '✅ OK' : '❌ PROBLEMA');
        
        // 4. Teste de salvamento simulado
        if (storageTest.localStorage) {
            try {
                const dadosTeste = {
                    id: 'teste_' + Date.now(),
                    nome: 'Fornecedor Teste',
                    estado: 'SP',
                    cidade: 'São Paulo'
                };
                
                writeLocalStorageValue('teste_fornecedor', dadosTeste);
                const recuperado = JSON.parse(readLocalStorageValue('teste_fornecedor'));
                removeLocalStorageValue('teste_fornecedor');
                
                if (recuperado && recuperado.nome === dadosTeste.nome) {
                    console.log('✅ Teste de salvamento: OK');
                } else {
                    throw new Error('Dados não foram recuperados corretamente');
                }
            } catch (error) {
                console.error('❌ Teste de salvamento: FALHOU -', error.message);
            }
        }
        
        // Resultado final
        const resultado = {
            storage: storageTest.localStorage,
            dependencias: deps.sucesso,
            garantias: garantias.sucesso,
            pronto: storageTest.localStorage && garantias.sucesso
        };
        
        console.log('📊 === RESULTADO DO TESTE ===');
        console.log(resultado);
        
        if (resultado.pronto) {
            console.log('🎉 SISTEMA 100% PRONTO PARA USO!');
        } else {
            console.log('⚠️ Sistema com limitações - verifique problemas acima');
        }
        
        return resultado;
    }
};

// Aplicar garantias quando DOM estiver pronto
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
        setTimeout(() => window.garantiaFornecedor.aplicarTodasGarantias(), 1000);
    });
} else {
    setTimeout(() => window.garantiaFornecedor.aplicarTodasGarantias(), 1000);
}

console.log('✅ Sistema de garantia de fornecedores carregado!');
console.log('💡 Use: window.garantiaFornecedor.aplicarTodasGarantias()'); 
