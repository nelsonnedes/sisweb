/*
* Fornecedor Modals - Adaptado do romaneiotora_modais.js
* Última atualização: 2024-01-15
* Versão: 1.0.0
* Nota: Funções de modais específicas para fornecedores com Firebase
*/

/**
 * Funções relacionadas aos modais de fornecedores
 */

// Função para gerar IDs únicos
function generateUniqueId(prefix = '') {
    const timestamp = new Date().getTime();
    const random = Math.floor(Math.random() * 10000);
    return `${prefix}${timestamp}${random}`;
}

function getStorageKey(key) {
    try {
        const svc = window.firebaseService || window.FirebaseService;
        if (svc && typeof svc.getCurrentTenantId === 'function') {
            const t = svc.getCurrentTenantId();
            if (t) return `company_${t}__${key}`;
        }
        if (svc && typeof svc.getTenantId === 'function') {
            const t = svc.getTenantId();
            if (t) return `company_${t}__${key}`;
        }
    } catch (_) {}
    try {
        if (window.appTenantId) return `company_${window.appTenantId}__${key}`;
        const raw = localStorage.getItem('company_info');
        if (raw) {
            const obj = JSON.parse(raw);
            const id = obj && (obj.companyId || obj.companyID || obj.tenantId || obj.id);
            if (id) return `company_${id}__${key}`;
        }
    } catch (_) {}
    return key;
}

// Funções para guardar e recuperar dados do localStorage (fallback)
function saveData(key, data) {
    try {
        const storageKey = getStorageKey(key);
        localStorage.setItem(storageKey, JSON.stringify(data));
        return true;
    } catch (error) {
        console.error(`Erro ao salvar dados em ${key}:`, error);
        return false;
    }
}

function getData(key) {
    try {
        const storageKey = getStorageKey(key);
        const allowLegacy = storageKey === key;
        const data = localStorage.getItem(storageKey) || (allowLegacy ? localStorage.getItem(key) : null);
        return data ? JSON.parse(data) : null;
    } catch (error) {
        console.error(`Erro ao recuperar dados de ${key}:`, error);
        return null;
    }
}

function getFornecedorBasePath() {
    try {
        const svc = window.firebaseService || window.FirebaseService;
        const tenant = svc && typeof svc.getCurrentTenantId === 'function' ? svc.getCurrentTenantId() : null;
        const uid = svc && typeof svc.getCurrentUid === 'function' ? svc.getCurrentUid() : null;
        if (tenant) return `companies/${tenant}/fornecedores`;
        if (uid) return `users/${uid}/fornecedores`;
    } catch (_) {}
    try {
        if (typeof window.resolveCompanyId === 'function') {
            const c = window.resolveCompanyId();
            if (c) return `companies/${c}/fornecedores`;
        }
    } catch (_) {}
    try {
        const raw = localStorage.getItem('company_info');
        if (raw) {
            const obj = JSON.parse(raw);
            const t = obj && (obj.companyId || obj.companyID || obj.tenantId || obj.id);
            if (t) return `companies/${String(t)}/fornecedores`;
        }
    } catch (_) {}
    return 'fornecedores';
}

// Normaliza estrutura de fornecedores (objeto → array), filtra e ordena
function normalizeFornecedores(data) {
    try {
        let arr = [];
        if (Array.isArray(data)) {
            arr = data.map(item => {
                const id = item?.id || '';
                return { _key: id, id, ...item };
            });
        } else if (data && typeof data === 'object') {
            arr = Object.keys(data).map(id => {
                const item = data[id];
                return { _key: id, id: item?.id || id, ...item };
            });
        } else {
            arr = [];
        }
        // Excluir funcionários e itens sem nome
        arr = arr.filter(f => {
            const tipo = (f.tipo || '').toLowerCase();
            const nome = f.nome || f.name;
            return nome && tipo !== 'funcionario';
        });
        // Ordenar por nome
        arr.sort((a, b) => String(a.nome || a.name || '').toLowerCase()
            .localeCompare(String(b.nome || b.name || '').toLowerCase(), 'pt-BR'));
        return arr;
    } catch (e) {
        console.warn('⚠️ Falha ao normalizar fornecedores:', e);
        return [];
    }
}

/**
 * Leitura flexível dos fornecedores no RTDB.
 *
 * Estratégia:
 *   1. Firebase RTDB direto (sem aliases — caminho resolvido pelo tenant)
 *   2. Fallback: firebaseService.loadData / loadFromFirebase
 *   3. Fallback final: localStorage
 *
 * IMPORTANTE: fornecedores NÃO são clientes. Não misturar caminhos.
 */
async function fetchFornecedores() {
    const basePath = getFornecedorBasePath();
    console.log(`🔍 [fetchFornecedores] Buscando em: ${basePath}`);

    // 1) Firebase RTDB direto (mais confiável, bypassa aliases)
    try {
        if (window.firebase && typeof window.firebase.database === 'function') {
            const snap = await window.firebase.database().ref(basePath).once('value');
            const raw = snap && typeof snap.val === 'function' ? snap.val() : null;
            if (raw) {
                const list = normalizeFornecedores(raw);
                if (list.length > 0) {
                    console.log(`✅ [fetchFornecedores] ${list.length} fornecedores carregados via RTDB direto`);
                    return list;
                }
            }
        }
    } catch (e) {
        console.warn('⚠️ [fetchFornecedores] Falha RTDB direto:', e.message || e);
    }

    // 2) firebaseService.loadData (respeita namespace de empresa)
    try {
        const svc = window.firebaseService;
        if (svc) {
            const loadFn = typeof svc.loadData === 'function' ? svc.loadData.bind(svc)
                         : typeof svc.loadFromFirebase === 'function' ? svc.loadFromFirebase.bind(svc)
                         : null;
            if (loadFn) {
                const res = await loadFn(basePath);
                const data = (res && res.data !== undefined) ? res.data : res;
                const list = normalizeFornecedores(data);
                if (list.length > 0) {
                    console.log(`✅ [fetchFornecedores] ${list.length} fornecedores via firebaseService`);
                    return list;
                }
            }
        }
    } catch (e) {
        console.warn('⚠️ [fetchFornecedores] Falha firebaseService:', e.message || e);
    }

    // 3) Fallback localStorage
    try {
        // Tenta a chave namespaced primeiro, depois a chave simples
        const localData = getData(basePath) || getData('fornecedores');
        const list = normalizeFornecedores(localData || []);
        if (list.length > 0) {
            console.log(`⚠️ [fetchFornecedores] ${list.length} fornecedores via localStorage`);
            return list;
        }
    } catch (_) {}

    console.warn('⚠️ [fetchFornecedores] Nenhum fornecedor encontrado em nenhuma fonte');
    return [];
}

let fornecedorSuggestionRequest = 0;

function hideClientSuggestions(input) {
    const host = input && input.parentElement;
    const suggestions = host && host.querySelector('.autocomplete-suggestions');
    if (suggestions) suggestions.style.display = 'none';
    if (input) input.setAttribute('aria-expanded', 'false');
}

async function showClientSuggestions(input) {
    if (!input) return;

    const term = String(input.value || '').trim().toLocaleLowerCase('pt-BR');
    const selected = window.selectedFornecedor || window.selectedClient || window.clienteSelecionado;
    const selectedName = String(selected && (selected.nome || selected.name) || '').trim();
    if (selectedName && selectedName.toLocaleLowerCase('pt-BR') !== term) {
        window.selectedFornecedor = null;
        window.selectedClient = null;
        window.clienteSelecionado = null;
    }

    const host = input.parentElement;
    if (!host) return;
    host.style.position = 'relative';

    let suggestions = host.querySelector('.autocomplete-suggestions');
    if (!suggestions) {
        suggestions = document.createElement('div');
        suggestions.className = 'autocomplete-suggestions';
        suggestions.setAttribute('role', 'listbox');
        host.appendChild(suggestions);
    }
    suggestions.replaceChildren();

    if (!term) {
        hideClientSuggestions(input);
        return;
    }

    const requestId = ++fornecedorSuggestionRequest;
    const fornecedores = await fetchFornecedores();
    if (requestId !== fornecedorSuggestionRequest || String(input.value || '').trim().toLocaleLowerCase('pt-BR') !== term) return;

    const matches = fornecedores.filter((fornecedor) => {
        const searchable = [
            fornecedor.nome || fornecedor.name,
            fornecedor.cnpj || fornecedor.cpf || fornecedor.documento,
            fornecedor.cidade || fornecedor.city
        ].filter(Boolean).join(' ').toLocaleLowerCase('pt-BR');
        return searchable.includes(term);
    }).slice(0, 20);

    matches.forEach((fornecedor) => {
        const option = document.createElement('div');
        option.className = 'autocomplete-suggestion';
        option.setAttribute('role', 'option');
        option.tabIndex = 0;
        option.textContent = fornecedor.nome || fornecedor.name || 'Fornecedor sem nome';
        const select = () => {
            selectClient(fornecedor);
            hideClientSuggestions(input);
        };
        option.addEventListener('click', select);
        option.addEventListener('keydown', (event) => {
            if (event.key === 'Enter' || event.key === ' ') {
                event.preventDefault();
                select();
            }
        });
        suggestions.appendChild(option);
    });

    suggestions.style.display = matches.length ? 'block' : 'none';
    input.setAttribute('aria-expanded', matches.length ? 'true' : 'false');
}

// Deduplicação de fornecedores no RTDB (commit=false faz apenas preview)
async function deduplicarFornecedores(commit = false) {
    console.log(`🧹 Iniciando deduplicação de fornecedores (commit=${commit})`);
    if (!window.firebaseService || typeof window.firebaseService.loadFromFirebase !== 'function') {
        console.warn('⚠️ firebaseService indisponível');
        return { success: false, error: 'firebaseService indisponível' };
    }
    try {
        const basePath = getFornecedorBasePath();
        const res = await window.firebaseService.loadFromFirebase(basePath);
        const list = normalizeFornecedores(res && res.data);
        const groups = {};
        const keyFor = f => {
            const doc = String(f.cnpj || f.cpf || f.document || '').replace(/\D/g, '');
            if (doc) return `doc:${doc}`;
            return `nome:${String(f.nome || f.name || '').trim().toLowerCase()}`;
        };
        list.forEach(f => {
            const k = keyFor(f);
            if (!groups[k]) groups[k] = [];
            groups[k].push(f);
        });
        const toDelete = [];
        const toKeep = [];
        const score = f => {
            let s = 0;
            if ((f.cnpj || f.cpf || f.document)) s += 5;
            ['email','telefone','estado','cidade','endereco'].forEach(field => { if (f[field]) s += 1; });
            const timestamps = [f.updated, f.created, f.updatedAt, f.createdAt].filter(Boolean);
            if (timestamps.length) s += 0.001 * new Date(timestamps[0]).getTime();
            return s;
        };
        Object.keys(groups).forEach(k => {
            const arr = groups[k];
            if (arr.length <= 1) {
                toKeep.push(arr[0]);
            } else {
                const sorted = arr.slice().sort((a,b) => score(b) - score(a));
                const keep = sorted[0];
                toKeep.push(keep);
                sorted.slice(1).forEach(d => toDelete.push(d));
            }
        });
        console.log(`📊 Grupos: ${Object.keys(groups).length}, manter: ${toKeep.length}, remover: ${toDelete.length}`);
        if (commit) {
            let removed = 0;
            for (const f of toDelete) {
                try {
                    const basePath = getFornecedorBasePath();
                    await window.firebaseService.deleteFromFirebase(basePath, String(f._key || f.id));
                    removed++;
                    console.log(`🗑️ Removido duplicado: ${f.nome || f.name} (${f._key || f.id})`);
                } catch (e) {
                    console.warn('⚠️ Falha ao remover duplicado:', f._key || f.id, e.message);
                }
            }
            console.log(`✅ Deduplicação concluída: ${removed} removidos`);
        } else {
            console.log('🔎 Preview concluído. Nenhum registro removido (commit=false).');
        }
        return { success: true, keep: toKeep.length, delete: toDelete.length };
    } catch (e) {
        console.error('❌ Erro na deduplicação:', e);
        return { success: false, error: e.message };
    }
}
// Função para selecionar fornecedor da lista
async function selectClientFromList(id) {
    console.log("🔄 Selecionando fornecedor:", id);

    try {
        const fornecedorList = await fetchFornecedores();

        // Encontrar o fornecedor
        const fornecedor = fornecedorList.find(f => String(f.id) === String(id));

        if (!fornecedor) {
            console.error("❌ Fornecedor não encontrado:", id);
            window.__toast('Fornecedor não encontrado!', 'error');
            return;
        }

        console.log("✅ Fornecedor encontrado:", fornecedor.nome || fornecedor.name);

        // Selecionar o fornecedor
        selectClient(fornecedor);

        // Fechar o modal
        const modal = document.getElementById('fornecedorListModal');
        if (modal) modal.style.display = 'none';

    } catch (error) {
        console.error("❌ Erro ao selecionar fornecedor:", error);
        window.__toast('Erro ao selecionar fornecedor!', 'error');
    }
}

// Função para editar fornecedor da lista
async function editClientFromList(id) {
    console.log("🔄 Editando fornecedor:", id);

    try {
        const fornecedorList = await fetchFornecedores();

        console.log("📊 Total de fornecedores carregados:", fornecedorList.length);

        // Encontrar o fornecedor
        const fornecedor = fornecedorList.find(f => String(f.id) === String(id));

        if (!fornecedor) {
            console.error("❌ Fornecedor não encontrado:", id);
            console.log("📋 IDs disponíveis:", fornecedorList.map(f => f.id));
            window.__toast('Fornecedor não encontrado!', 'error');
            return;
        }

        console.log("✅ Fornecedor encontrado para edição:", fornecedor);
        console.log("📝 Dados do fornecedor:", {
            id: fornecedor.id,
            nome: fornecedor.nome || fornecedor.name,
            cnpj: fornecedor.cnpj,
            cidade: fornecedor.cidade || fornecedor.city,
            estado: fornecedor.estado || fornecedor.state,
            telefone: fornecedor.telefone || fornecedor.phone,
            email: fornecedor.email,
            endereco: fornecedor.endereco || fornecedor.address
        });

        // Fechar modal de lista
        const listModal = document.getElementById('fornecedorListModal');
        if (listModal) {
            listModal.style.display = 'none';
            console.log("✅ Modal de lista fechado");
        }

        // Carregar dados no modal de edição
        console.log("🔄 Carregando dados no modal de edição...");
        await loadClientForEdit(fornecedor);
        console.log("✅ Dados carregados no modal de edição");

    } catch (error) {
        console.error("❌ Erro ao editar fornecedor:", error);
        window.__toast('Erro ao editar fornecedor: ' + error.message, 'error');
    }
}

// Função para selecionar fornecedor (atualizar interface)
function selectClient(fornecedor) {
    console.log("🔄 Selecionando fornecedor na interface:", fornecedor);
    console.log("📝 Nome do fornecedor:", fornecedor.nome || fornecedor.name);

    const nomeParaExibir = fornecedor.nome || fornecedor.name || '';
    const fornecedorInput = document.getElementById('fornecedorInput');
    if (fornecedorInput) {
        fornecedorInput.value = nomeParaExibir;
        console.log("✅ Campo fornecedorInput atualizado com:", nomeParaExibir);
    } else {
        const clienteInput = document.getElementById('clienteInput');
        if (clienteInput) {
            clienteInput.value = nomeParaExibir;
            console.log("✅ Campo clienteInput atualizado com:", nomeParaExibir);
        } else {
            const altInput = document.getElementById('clientInput');
            if (altInput) {
                altInput.value = nomeParaExibir;
                console.log("✅ Campo alternativo clientInput atualizado com:", nomeParaExibir);
            } else {
                console.error("❌ Nenhum campo de input encontrado (fornecedorInput, clienteInput ou clientInput)");
            }
        }
    }

    window.selectedClient = fornecedor;
    window.selectedFornecedor = fornecedor;
    window.clienteSelecionado = fornecedor;

    console.log("✅ Fornecedor selecionado e armazenado globalmente:", fornecedor.nome || fornecedor.name);

    try { window.dispatchEvent(new CustomEvent('fornecedores:updated', { detail: { fornecedor } })); } catch {}
}

// Função para abrir modal de novo fornecedor (implementação direta)
function openNewFornecedorModal() {
    console.log("🔄 Abrindo modal para cadastrar novo fornecedor");

    // ✅ IMPLEMENTAÇÃO DIRETA PARA EVITAR RECURSÃO INFINITA
    try {
        // Resetar o formulário
        const form = document.getElementById('fornecedorForm');
        if (form) form.reset();

        // Limpar ID (novo registro)
        const idInput = document.getElementById('fornecedorId');
        if (idInput) idInput.value = '';

        // Atualizar título
        const title = document.getElementById('fornecedorModalTitle');
        if (title) title.textContent = 'Novo Fornecedor';

        // Exibir o modal
        const modal = document.getElementById('fornecedorModal');
        if (modal) {
            modal.style.display = 'block';
        } else {
            console.error("❌ Modal fornecedorModal não encontrado");
            window.__toast('Modal de cadastro não está disponível. Recarregue a página.', 'error');
            return;
        }

        // Focar no campo de nome
        setTimeout(() => {
            const nameInput = document.getElementById('fornecedorName');
            if (nameInput) nameInput.focus();
        }, 100);

        // Configurar evento de seleção de estado para atualizar cidades
        const stateSelect = document.getElementById('fornecedorState');
        if (stateSelect) {
            // Remover listeners anteriores para evitar duplicação
            stateSelect.removeEventListener('change', updateCities);
            stateSelect.addEventListener('change', updateCities);
        }

        console.log("✅ Modal de novo fornecedor aberto com sucesso");

    } catch (error) {
        console.error("❌ Erro ao abrir modal de novo fornecedor:", error);
        window.__toast('Erro ao abrir modal: ' + error.message, 'error');
    }
}

function closeNewFornecedorModal() {
    try {
        const modal = document.getElementById('fornecedorModal');
        if (modal) modal.style.display = 'none';
        const form = document.getElementById('fornecedorForm');
        if (form) form.reset();
        const idInput = document.getElementById('fornecedorId');
        if (idInput) idInput.value = '';
    } catch (_) {}
}

// Função para atualizar cidades baseado no estado selecionado
async function updateCities() {
    const stateSelect = document.getElementById('fornecedorState');
    const citySelect = document.getElementById('fornecedorCity');

    if (!stateSelect || !citySelect) {
        console.warn('⚠️ Elementos de estado ou cidade não encontrados - função chamada fora do contexto correto');
        return;
    }

    const selectedState = stateSelect.value;

    if (!selectedState) {
        citySelect.innerHTML = '<option value="">Selecione primeiro o estado</option>';
        return;
    }

    console.log('🔄 Atualizando cidades para o estado:', selectedState);

    citySelect.innerHTML = '<option value="">Carregando cidades...</option>';

    try {
        // Tentar carregar do IBGE
        const response = await fetch(`https://servicodados.ibge.gov.br/api/v1/localidades/estados/${selectedState}/municipios`);

        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }

        const cities = await response.json();
        const cityNames = cities.map(city => city.nome).sort((a, b) => a.localeCompare(b, 'pt-BR'));

        citySelect.innerHTML = '<option value="">Selecione a cidade</option>';
        cityNames.forEach(city => {
            const option = document.createElement('option');
            option.value = city;
            option.textContent = city;
            citySelect.appendChild(option);
        });

        console.log(`✅ ${cityNames.length} cidades carregadas do IBGE para ${selectedState}`);

    } catch (error) {
        console.error('❌ Erro ao carregar cidades:', error);

        // Lista básica de cidades por estado como fallback
        const citiesByState = {
            'PA': ['Belém', 'Ananindeua', 'Santarém', 'Marabá', 'Parauapebas', 'Castanhal', 'Abaetetuba', 'Cametá', 'Bragança', 'Altamira', 'São Miguel do Guamá'],
            'SP': ['São Paulo', 'Guarulhos', 'Campinas', 'São Bernardo do Campo', 'Santo André', 'Osasco', 'Ribeirão Preto', 'Sorocaba'],
            'RJ': ['Rio de Janeiro', 'São Gonçalo', 'Duque de Caxias', 'Nova Iguaçu', 'Niterói', 'Belford Roxo', 'São João de Meriti'],
            'MG': ['Belo Horizonte', 'Uberlândia', 'Contagem', 'Juiz de Fora', 'Betim', 'Montes Claros', 'Ribeirão das Neves']
        };

        const cities = citiesByState[selectedState] || [];

        citySelect.innerHTML = '<option value="">Selecione a cidade</option>';
        cities.forEach(city => {
            const option = document.createElement('option');
            option.value = city;
            option.textContent = city;
            citySelect.appendChild(option);
        });

        console.log(`🔄 ${cities.length} cidades carregadas do fallback básico para ${selectedState}`);
    }
}

// Função para abrir modal de edição de fornecedor
async function openEditFornecedorModal(fornecedor) {
    console.log("🔄 Abrindo modal para editar fornecedor:", fornecedor);

    try {
        // Garantir que a estrutura do modal existe
        await ensureModalStructure();

        const modal = document.getElementById('fornecedorModal');
        if (!modal) {
            console.error("❌ Modal de cliente não encontrado");
            window.__toast('Modal de edição não está disponível. Recarregue a página.', 'error');
            return;
        }

        // Resetar formulário
        const form = document.getElementById('fornecedorForm');
        if (form) form.reset();

        // Se fornecedor for uma string (ID), buscar os dados
        let fornecedorData = fornecedor;
        if (typeof fornecedor === 'string') {
            const basePath = getFornecedorBasePath();
            const fornecedores = await getData(basePath) || [];
            fornecedorData = fornecedores.find(f => String(f.id) === String(fornecedor));

            if (!fornecedorData) {
                console.error("❌ Fornecedor não encontrado:", fornecedor);
                window.__toast('Fornecedor não encontrado!', 'error');
                return;
            }
        }

        // Preencher campos do formulário
        if (fornecedorData) {
            const campos = {
                'fornecedorId': fornecedorData.id || '',
                'fornecedorName': fornecedorData.nome || fornecedorData.name || '',
                'fornecedorCnpj': fornecedorData.cnpj || '',
                'fornecedorCity': fornecedorData.cidade || fornecedorData.city || '',
                'fornecedorState': fornecedorData.estado || fornecedorData.state || '',
                'fornecedorPhone': fornecedorData.telefone || fornecedorData.phone || '',
                'fornecedorEmail': fornecedorData.email || '',
                'fornecedorAddress': fornecedorData.endereco || fornecedorData.address || '',
                'fornecedorObs': fornecedorData.observacoes || fornecedorData.obs || ''
            };

            Object.entries(campos).forEach(([id, valor]) => {
                const campo = document.getElementById(id);
                if (campo) {
                    campo.value = valor;
                }
            });

            console.log("✅ Campos preenchidos para edição");
        }

        // Atualizar título do modal
        const modalTitle = document.querySelector('#fornecedorModal .modal-title') ||
                          document.querySelector('#fornecedorModal h2') ||
                          document.querySelector('#fornecedorModal h3');
        if (modalTitle) {
            modalTitle.textContent = 'Editar Fornecedor';
        }

        // Exibir modal
        modal.style.display = 'block';

        // Focar no campo de nome
        setTimeout(() => {
            const nomeInput = document.getElementById('fornecedorName');
            if (nomeInput) nomeInput.focus();
        }, 100);

        console.log("✅ Modal de edição de fornecedor aberto");

    } catch (error) {
        console.error("❌ Erro ao abrir modal de edição:", error);
        window.__toast('Erro ao abrir modal de edição: ' + error.message, 'error');
    }
}

// ✅ FUNÇÃO ALIAS PARA MANTER COMPATIBILIDADE
async function openEditClientModal(client) {
    console.log("🔄 Redirecionando openEditClientModal para openEditFornecedorModal");
    return await openEditFornecedorModal(client);
}

// ✅ FUNÇÃO PARA VERIFICAR E CORRIGIR CONFLITOS DE MODAL
function verificarECorrigirModal() {
    console.log("🔍 Verificando estrutura do modal de edição...");

    const modal = document.getElementById('fornecedorModal');
    if (!modal) {
        console.error("❌ Modal fornecedorModal não encontrado");
        return false;
    }

    // Verificar se todos os campos necessários existem
    const camposNecessarios = [
        'fornecedorId', 'fornecedorName', 'fornecedorCnpj', 'fornecedorStateRegistration',
        'fornecedorState', 'fornecedorCity', 'fornecedorPhone', 'fornecedorEmail',
        'fornecedorAddress', 'fornecedorNumber', 'fornecedorNeighborhood', 'fornecedorObs'
    ];

    const camposFaltando = [];
    camposNecessarios.forEach(campoId => {
        const campo = document.getElementById(campoId);
        if (!campo) {
            camposFaltando.push(campoId);
        }
    });

    if (camposFaltando.length > 0) {
        console.warn("⚠️ Campos faltando no modal:", camposFaltando);
    } else {
        console.log("✅ Todos os campos necessários encontrados");
    }

    // Verificar se há conflitos com outros sistemas
    const conflitos = [];

    // Verificar se o standardized-client-modal está interferindo
    if (window.clientModalState && window.clientModalState.isActive) {
        conflitos.push("standardized-client-modal");
    }

    // Verificar se há outros modais abertos
    const outrosModais = document.querySelectorAll('.modal[style*="display: block"]');
    if (outrosModais.length > 1) {
        conflitos.push("múltiplos modais abertos");
    }

    if (conflitos.length > 0) {
        console.warn("⚠️ Possíveis conflitos detectados:", conflitos);
    }

    return camposFaltando.length === 0;
}

// Função auxiliar para carregar dados do fornecedor no modal de edição
async function loadClientForEdit(fornecedor) {
    console.log("🔄 Iniciando carregamento de dados para edição:", fornecedor.nome || fornecedor.name);

    // ✅ VERIFICAR E CORRIGIR CONFLITOS ANTES DE PROSSEGUIR
    if (!verificarECorrigirModal()) {
        console.error("❌ Problemas detectados na estrutura do modal");
        window.__toast('Erro na estrutura do modal. Recarregue a página e tente novamente.', 'error');
        return;
    }

    // Resetar o formulário
    const form = document.getElementById('fornecedorForm');
    if (form) {
        form.reset();
        console.log("✅ Formulário resetado");
    }

    // Preencher os campos do formulário com os dados do fornecedor
    const idInput = document.getElementById('fornecedorId');
    const nameInput = document.getElementById('fornecedorName');
    const cnpjInput = document.getElementById('fornecedorCnpj');
    const tipoPessoaInput = document.getElementById('fornecedorPersonType');
    const inscricaoInput = document.getElementById('fornecedorStateRegistration');
    const indIEDestInput = document.getElementById('fornecedorIndIEDest');
    const municipalRegistrationInput = document.getElementById('fornecedorMunicipalRegistration');
    const suframaInput = document.getElementById('fornecedorSuframa');
    const cepInput = document.getElementById('fornecedorCep');
    const stateSelect = document.getElementById('fornecedorState');
    const citySelect = document.getElementById('fornecedorCity');
    const phoneInput = document.getElementById('fornecedorPhone');
    const emailInput = document.getElementById('fornecedorEmail');
    const addressInput = document.getElementById('fornecedorAddress');
    const numeroInput = document.getElementById('fornecedorNumber');
    const bairroInput = document.getElementById('fornecedorNeighborhood');
    const complementoInput = document.getElementById('fornecedorComplement');
    const municipioCodeInput = document.getElementById('fornecedorMunicipalityCode');
    const countryCodeInput = document.getElementById('fornecedorCountryCode');
    const countryNameInput = document.getElementById('fornecedorCountryName');
    const obsInput = document.getElementById('fornecedorObs');

    console.log("🔍 Verificando campos encontrados:", {
        idInput: !!idInput,
        nameInput: !!nameInput,
        cnpjInput: !!cnpjInput,
        tipoPessoaInput: !!tipoPessoaInput,
        inscricaoInput: !!inscricaoInput,
        indIEDestInput: !!indIEDestInput,
        municipalRegistrationInput: !!municipalRegistrationInput,
        suframaInput: !!suframaInput,
        cepInput: !!cepInput,
        stateSelect: !!stateSelect,
        citySelect: !!citySelect,
        phoneInput: !!phoneInput,
        emailInput: !!emailInput,
        addressInput: !!addressInput,
        numeroInput: !!numeroInput,
        bairroInput: !!bairroInput,
        complementoInput: !!complementoInput,
        municipioCodeInput: !!municipioCodeInput,
        countryCodeInput: !!countryCodeInput,
        countryNameInput: !!countryNameInput,
        obsInput: !!obsInput
    });

    // Preencher os dados
    if (idInput) {
        idInput.value = fornecedor.id || '';
        console.log("✅ ID preenchido:", idInput.value);
    }

    if (nameInput) {
        nameInput.value = fornecedor.nome || fornecedor.name || '';
        console.log("✅ Nome preenchido:", nameInput.value);
    }

    if (cnpjInput) {
        cnpjInput.value = fornecedor.documento || fornecedor.document || fornecedor.cnpj || fornecedor.cpf || '';
        console.log("✅ CNPJ preenchido:", cnpjInput.value);
    }

    if (tipoPessoaInput) {
        tipoPessoaInput.value = fornecedor.tipoPessoa || fornecedor.personType || fornecedor.fiscalPersonType || '';
        console.log("✅ Tipo de pessoa preenchido:", tipoPessoaInput.value);
    }

    if (inscricaoInput) {
        inscricaoInput.value = fornecedor.inscricaoEstadual || fornecedor.stateRegistration || '';
        console.log("✅ Inscrição Estadual preenchida:", inscricaoInput.value);
    }

    if (indIEDestInput) {
        indIEDestInput.value = fornecedor.indIEDest || fornecedor.indicadorInscricaoEstadual || fornecedor.ieIndicator || '';
        console.log("✅ Indicador IE preenchido:", indIEDestInput.value);
    }

    if (municipalRegistrationInput) {
        municipalRegistrationInput.value = fornecedor.inscricaoMunicipal || fornecedor.municipalRegistration || '';
        console.log("✅ Inscrição Municipal preenchida:", municipalRegistrationInput.value);
    }

    if (suframaInput) {
        suframaInput.value = fornecedor.suframa || '';
        console.log("✅ SUFRAMA preenchido:", suframaInput.value);
    }

    if (cepInput) {
        cepInput.value = fornecedor.cep || fornecedor.postalCode || '';
        console.log("✅ CEP preenchido:", cepInput.value);
    }

    if (phoneInput) {
        phoneInput.value = fornecedor.telefone || fornecedor.phone || '';
        console.log("✅ Telefone preenchido:", phoneInput.value);
    }

    if (emailInput) {
        emailInput.value = fornecedor.email || '';
        console.log("✅ Email preenchido:", emailInput.value);
    }

    if (addressInput) {
        addressInput.value = fornecedor.endereco || fornecedor.address || '';
        console.log("✅ Endereço preenchido:", addressInput.value);
    }

    if (numeroInput) {
        numeroInput.value = fornecedor.numero || fornecedor.number || '';
        console.log("✅ Número preenchido:", numeroInput.value);
    }

    if (bairroInput) {
        bairroInput.value = fornecedor.bairro || fornecedor.neighborhood || '';
        console.log("✅ Bairro preenchido:", bairroInput.value);
    }

    if (complementoInput) {
        complementoInput.value = fornecedor.complemento || fornecedor.complement || '';
        console.log("✅ Complemento preenchido:", complementoInput.value);
    }

    if (municipioCodeInput) {
        municipioCodeInput.value = fornecedor.codigoMunicipio || fornecedor.municipioCodigo || fornecedor.municipalityCode || fornecedor.cMun || fornecedor.ibgeCode || '';
        console.log("✅ Código IBGE preenchido:", municipioCodeInput.value);
    }

    if (countryCodeInput) {
        countryCodeInput.value = fornecedor.paisCodigo || fornecedor.countryCode || fornecedor.cPais || '1058';
        console.log("✅ Código do país preenchido:", countryCodeInput.value);
    }

    if (countryNameInput) {
        countryNameInput.value = fornecedor.pais || fornecedor.country || fornecedor.countryName || fornecedor.xPais || 'Brasil';
        console.log("✅ País preenchido:", countryNameInput.value);
    }

    if (obsInput) {
        obsInput.value = fornecedor.observacoes || fornecedor.obs || '';
        console.log("✅ Observações preenchidas:", obsInput.value);
    }

    // ✅ DEFINIR VARIÁVEL GLOBAL DE EDIÇÃO
    window.editingClientId = fornecedor.id;
    console.log(`✅ Variável editingClientId definida: ${window.editingClientId}`);

    // Preencher estado
    if (stateSelect) {
        const estadoValue = fornecedor.estado || fornecedor.state || '';
        stateSelect.value = estadoValue;
        console.log("✅ Estado preenchido:", estadoValue);

        // Disparar evento para carregar cidades
        if (stateSelect.value) {
            console.log("🏙️ Carregando cidades para o estado:", stateSelect.value);
            try {
                await updateCities();
                console.log("✅ Cidades carregadas com sucesso");

                // Aguardar um pouco para as cidades carregarem, então selecionar a cidade
                setTimeout(() => {
                    if (citySelect) {
                        const cidadeValue = fornecedor.cidade || fornecedor.city || '';
                        citySelect.value = cidadeValue;
                        console.log(`✅ Cidade selecionada: ${cidadeValue}`);
                    }
                }, 200);

            } catch (error) {
                console.error('❌ Erro ao carregar cidades:', error);
                // Em caso de erro, tentar selecionar a cidade diretamente
                if (citySelect) {
                    const cidadeValue = fornecedor.cidade || fornecedor.city || '';
                    citySelect.value = cidadeValue;
                    console.log(`⚠️ Cidade definida diretamente após erro: ${cidadeValue}`);
                }
            }
        }
    }

    // Atualizar título
    const title = document.getElementById('fornecedorModalTitle');
    if (title) {
        title.textContent = 'Editar Fornecedor';
        console.log("✅ Título do modal atualizado");
    }

    // ✅ GARANTIR QUE O MODAL SEJA EXIBIDO CORRETAMENTE
    const modal = document.getElementById('fornecedorModal');
    if (modal) {
        // Fechar qualquer outro modal que possa estar aberto
        document.querySelectorAll('.modal').forEach(m => {
            if (m.id !== 'fornecedorModal') {
                m.style.display = 'none';
            }
        });

        // Exibir o modal de edição
        modal.style.display = 'block';
        modal.style.visibility = 'visible';
        modal.style.opacity = '1';
        modal.style.zIndex = '9999';

        console.log("✅ Modal exibido com configurações forçadas");
    } else {
        console.error("❌ Modal fornecedorModal não encontrado");
    }

    // Focar no campo de nome
    setTimeout(() => {
        if (nameInput) {
            nameInput.focus();
            console.log("✅ Foco definido no campo de nome");
        }
    }, 100);

    console.log("🎉 Carregamento de dados para edição concluído com sucesso");
}

// Função para salvar fornecedor
async function saveClient(event) {
    if (event && typeof event.preventDefault === 'function') event.preventDefault();

    console.log("🔄 Salvando fornecedor...");

    // Aceitar chamada sem evento (botão), prosseguir normalmente

    // Verificar se todos os inputs necessários existem
    const requiredInputs = ['fornecedorName'];
    for (const inputId of requiredInputs) {
        const input = document.getElementById(inputId);
        if (!input) {
            console.error(`❌ Input obrigatório '${inputId}' não encontrado`);
            window.__toast(`Erro no formulário: campo ${inputId} não encontrado. Recarregue a página.`, 'error');
            return false;
        }
    }

    try {
        // Obter valores do formulário
        const id = document.getElementById('fornecedorId')?.value || '';
        const nome = document.getElementById('fornecedorName')?.value || '';
        const cnpj = document.getElementById('fornecedorCnpj')?.value || '';
        const tipoPessoa = document.getElementById('fornecedorPersonType')?.value || '';
        const inscricaoEstadual = document.getElementById('fornecedorStateRegistration')?.value || '';
        const indIEDest = document.getElementById('fornecedorIndIEDest')?.value || '';
        const inscricaoMunicipal = document.getElementById('fornecedorMunicipalRegistration')?.value || '';
        const suframa = document.getElementById('fornecedorSuframa')?.value || '';
        const cep = document.getElementById('fornecedorCep')?.value || '';
        const estado = document.getElementById('fornecedorState')?.value || '';
        const cidade = document.getElementById('fornecedorCity')?.value || '';
        const telefone = document.getElementById('fornecedorPhone')?.value || '';
        const email = document.getElementById('fornecedorEmail')?.value || '';
        const endereco = document.getElementById('fornecedorAddress')?.value || '';
        const numero = document.getElementById('fornecedorNumber')?.value || '';
        const bairro = document.getElementById('fornecedorNeighborhood')?.value || '';
        const complemento = document.getElementById('fornecedorComplement')?.value || '';
        const codigoMunicipio = document.getElementById('fornecedorMunicipalityCode')?.value || '';
        const paisCodigo = document.getElementById('fornecedorCountryCode')?.value || '1058';
        const pais = document.getElementById('fornecedorCountryName')?.value || 'Brasil';
        const observacoes = document.getElementById('fornecedorObs')?.value || '';

        // ✅ VALIDAÇÕES RIGOROSAS DE DADOS
        if (!nome || nome.trim() === '') {
            console.error("❌ Nome do fornecedor é obrigatório");
            window.__toast('O nome do fornecedor é obrigatório.', 'warning');
            document.getElementById('fornecedorName').focus();
            return false;
        }

        if (nome.trim().length < 2) {
            console.error("❌ Nome do fornecedor muito curto");
            window.__toast('O nome do fornecedor deve ter pelo menos 2 caracteres.', 'warning');
            document.getElementById('fornecedorName').focus();
            return false;
        }

        // ✅ VALIDAÇÃO DE EMAIL SE FORNECIDO
        if (email && email.trim() !== '') {
            const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
            if (!emailRegex.test(email.trim())) {
                console.error("❌ Email inválido");
                window.__toast('Por favor, insira um email válido.', 'warning');
                document.getElementById('fornecedorEmail').focus();
                return false;
            }
        }

        // ✅ VALIDAÇÃO DE CNPJ SE FORNECIDO
        if (cnpj && cnpj.trim() !== '') {
            const cnpjLimpo = cnpj.replace(/\D/g, '');
            if (![11, 14].includes(cnpjLimpo.length)) {
                console.error("❌ Documento deve ter 11 ou 14 dígitos");
                window.__toast('CPF/CNPJ deve ter 11 ou 14 dígitos.', 'warning');
                document.getElementById('fornecedorCnpj').focus();
                return false;
            }
        }

        // Criar objeto fornecedor com dados normalizados
        const fornecedorData = {
            id: id || undefined, // Se vazio, deixar undefined para gerar novo ID
            nome: nome,
            name: nome, // Para compatibilidade
            cnpj: cnpj || '',
            documento: cnpj || '',
            document: cnpj || '',
            tipoPessoa: tipoPessoa || '',
            personType: tipoPessoa || '',
            fiscalPersonType: tipoPessoa || '',
            inscricaoEstadual: inscricaoEstadual || '',
            stateRegistration: inscricaoEstadual || '', // Para compatibilidade
            ie: inscricaoEstadual || '',
            indIEDest: indIEDest || '',
            indicadorInscricaoEstadual: indIEDest || '',
            ieIndicator: indIEDest || '',
            inscricaoMunicipal: inscricaoMunicipal || '',
            municipalRegistration: inscricaoMunicipal || '',
            suframa: suframa || '',
            cep: cep || '',
            postalCode: cep || '',
            estado: estado,
            state: estado, // Para compatibilidade
            cidade: cidade,
            city: cidade, // Para compatibilidade
            telefone: telefone || '',
            phone: telefone || '', // Para compatibilidade
            email: email || '',
            endereco: endereco || '',
            address: endereco || '', // Para compatibilidade
            numero: numero || '',
            number: numero || '', // Para compatibilidade
            bairro: bairro || '',
            neighborhood: bairro || '', // Para compatibilidade
            complemento: complemento || '',
            complement: complemento || '',
            codigoMunicipio: codigoMunicipio || '',
            municipioCodigo: codigoMunicipio || '',
            municipalityCode: codigoMunicipio || '',
            cMun: codigoMunicipio || '',
            ibgeCode: codigoMunicipio || '',
            paisCodigo: paisCodigo || '1058',
            countryCode: paisCodigo || '1058',
            cPais: paisCodigo || '1058',
            pais: pais || 'Brasil',
            country: pais || 'Brasil',
            countryName: pais || 'Brasil',
            xPais: pais || 'Brasil',
            observacoes: observacoes || '',
            obs: observacoes || '', // Para compatibilidade
            updated: new Date().toISOString()
        };

        if (window.firebaseService && window.firebaseService.saveToFirebase) {
            console.log("🔥 Salvando via Firebase (tabela fornecedores)...");

            let savedOk = false;
            let savedId = id;
            if (id) {
                const basePath = getFornecedorBasePath();
                if (window.firebaseService && typeof window.firebaseService.saveToFirebase === 'function') {
                    await window.firebaseService.saveToFirebase(basePath, String(id), fornecedorData);
                    savedOk = true;
                    savedId = id;
                }
            } else {
                const newId = generateUniqueId('FORN');
                fornecedorData.id = newId;
                fornecedorData.created = new Date().toISOString();
                const basePath = getFornecedorBasePath();
                if (window.firebaseService && typeof window.firebaseService.saveToFirebase === 'function') {
                    await window.firebaseService.saveToFirebase(basePath, String(newId), fornecedorData);
                    savedOk = true;
                    savedId = newId;
                }
            }

            if (savedOk) {
                const finalFornecedor = { ...fornecedorData, id: savedId };
                console.log("✅ Fornecedor salvo com sucesso:", finalFornecedor.nome || finalFornecedor.name);

                // Fechar o modal
                const modal = document.getElementById('fornecedorModal');
                if (modal) modal.style.display = 'none';

                // Atualizar a lista de fornecedores se o modal estiver aberto
                const listModal = document.getElementById('fornecedorListModal');
                if (listModal && listModal.style.display === 'block') {
                    const fi = document.getElementById('fornecedorListFilter');
                    await renderFornecedorListBasic(fi ? fi.value : '');
                }

                // Se estivemos editando um fornecedor já selecionado, atualizar os dados selecionados
                const fornecedorInput = document.getElementById('fornecedorInput') || document.getElementById('clienteInput');
                if (fornecedorInput && fornecedorInput.value && fornecedorInput.value.toLowerCase() === nome.toLowerCase()) {
                    window.selectedClient = finalFornecedor;
                    window.selectedFornecedor = finalFornecedor;
                }

                // Notificar o usuário
                const mensagem = id ? 'Fornecedor atualizado com sucesso!' : 'Fornecedor cadastrado com sucesso!';
                window.__toast(mensagem, 'success');

            } else {
                throw new Error("Falha ao salvar - Firebase retornou null");
            }

        } else {
            // Fallback se o Firebase service não estiver disponível
            console.warn("⚠️ Firebase service não disponível, usando fallback");

            const basePath = getFornecedorBasePath();
            const fornecedorList = await getData(basePath) || [];

            if (id) {
                // Atualizar fornecedor existente
                const index = fornecedorList.findIndex(f => String(f.id) === String(id));
                if (index !== -1) {
                    fornecedorList[index] = { ...fornecedorList[index], ...fornecedorData };
                } else {
                    throw new Error(`Fornecedor com ID ${id} não encontrado para atualização`);
                }
            } else {
                // Criar novo fornecedor
                fornecedorData.id = generateUniqueId('for');
                fornecedorData.created = new Date().toISOString();
                fornecedorList.push(fornecedorData);
            }

            await saveData(basePath, fornecedorList);

            console.log("✅ Fornecedor salvo via fallback");

            // Fechar modal e atualizar interface
            const modal = document.getElementById('fornecedorModal');
            if (modal) modal.style.display = 'none';

            const listModal = document.getElementById('fornecedorListModal');
            if (listModal && listModal.style.display === 'block') {
                const fi = document.getElementById('fornecedorListFilter');
                await renderFornecedorListBasic(fi ? fi.value : '');
            }

            window.__toast(id ? 'Fornecedor atualizado com sucesso!' : 'Fornecedor cadastrado com sucesso!', 'success');
        }

    } catch (error) {
        console.error("❌ Erro ao salvar fornecedor:", error);

        // Tratar erros específicos
        if (error.message === "Operação cancelada pelo usuário") {
            console.log("ℹ️ Usuário cancelou a operação");
            return; // Não mostrar erro se usuário cancelou
        } else {
            window.__toast(`Erro ao salvar fornecedor: ${error.message}`, 'error');
        }
    }
}

// Função para formatar telefone
function formatarTelefone(input) {
    try {
        if (!input || !input.value) {
            return;
        }

        // Remover todos os caracteres não numéricos
        let value = input.value.replace(/\D/g, '');

        // Limitar a 11 dígitos (celular com DDD)
        if (value.length > 11) {
            value = value.substring(0, 11);
        }

        // Aplicar formatação baseada no comprimento
        if (value.length === 0) {
            input.value = '';
        } else if (value.length <= 2) {
            input.value = `(${value}`;
        } else if (value.length <= 6) {
            input.value = `(${value.substring(0, 2)}) ${value.substring(2)}`;
        } else if (value.length <= 10) {
            input.value = `(${value.substring(0, 2)}) ${value.substring(2, 6)}-${value.substring(6)}`;
        } else {
            input.value = `(${value.substring(0, 2)}) ${value.substring(2, 7)}-${value.substring(7)}`;
        }
    } catch (error) {
        console.error("Erro ao formatar telefone:", error);
        // Não alterar o input em caso de erro
    }
}

// ✅ CORREÇÃO DEFINITIVA DA API DO IBGE - FUNÇÃO MELHORADA
async function carregarCidadesPorEstado(estado) {
    console.log("🌍 Carregando cidades para o estado:", estado);

    const cidadeSelect = document.getElementById('fornecedorCity');
    if (!cidadeSelect) {
        console.error("❌ Campo de cidade não encontrado");
        return;
    }

    if (!estado) {
        console.warn("⚠️ Estado não informado");
        cidadeSelect.innerHTML = '<option value="">Selecione uma cidade</option>';
        return;
    }

    // Mostrar loading
    cidadeSelect.innerHTML = '<option value="">Carregando cidades...</option>';
    cidadeSelect.disabled = true;

    try {
        console.log(`🔄 Carregando cidades para: ${estado}`);

        let cidadesCarregadas = false;

        // ✅ ESTRATÉGIA 1: Tentar BrasilAPI (mais confiável e sem CORS)
        try {
            console.log("🇧🇷 Tentando BrasilAPI...");
            const brasilApiUrl = `https://brasilapi.com.br/api/ibge/municipios/v1/${estado}`;

            const brasilResponse = await Promise.race([
                fetch(brasilApiUrl, {
                    method: 'GET',
                    mode: 'cors',
                    cache: 'default'
                }),
                new Promise((_, reject) => setTimeout(() => reject(new Error('Timeout BrasilAPI')), 3000))
            ]);

            if (brasilResponse.ok) {
                const brasilData = await brasilResponse.json();

                if (Array.isArray(brasilData) && brasilData.length > 0) {
                    console.log(`✅ BrasilAPI: ${brasilData.length} cidades carregadas`);

                    const cidadesOrdenadas = brasilData
                        .map(cidade => cidade.nome)
                        .sort((a, b) => a.localeCompare(b, 'pt-BR'));

                    cidadeSelect.innerHTML = '<option value="">Selecione uma cidade</option>';
                    cidadesOrdenadas.forEach(cidade => {
                        const option = document.createElement('option');
                        option.value = cidade;
                        option.textContent = cidade;
                        cidadeSelect.appendChild(option);
                    });

                    cidadesCarregadas = true;
                    console.log("🎉 BrasilAPI funcionou perfeitamente!");
                }
            }
        } catch (brasilError) {
            console.warn("⚠️ BrasilAPI falhou:", brasilError.message);
        }

        // ✅ ESTRATÉGIA 2: Se BrasilAPI falhou, usar fallback local COMPLETO
        if (!cidadesCarregadas) {
            console.log("🔄 Usando fallback local completo...");

            // Lista completa e atualizada de cidades por estado
            const cidadesCompletas = {
                'AC': ['Rio Branco', 'Cruzeiro do Sul', 'Sena Madureira', 'Tarauacá', 'Feijó', 'Brasiléia', 'Xapuri', 'Epitaciolândia', 'Plácido de Castro', 'Acrelândia', 'Bujari', 'Capixaba', 'Jordão', 'Manoel Urbano', 'Marechal Thaumaturgo', 'Porto Walter', 'Rodrigues Alves', 'Santa Rosa do Purus', 'Senador Guiomard', 'Porto Acre', 'Assis Brasil', 'Mâncio Lima'],
                'AL': ['Maceió', 'Arapiraca', 'Rio Largo', 'Palmeira dos Índios', 'União dos Palmares', 'Penedo', 'Coruripe', 'Delmiro Gouveia', 'São Miguel dos Campos', 'Santana do Ipanema', 'Girau do Ponciano', 'Viçosa', 'Campo Alegre', 'Marechal Deodoro', 'Pilar', 'Porto Calvo', 'Murici', 'Atalaia', 'Flexeiras', 'Messias'],
                'AP': ['Macapá', 'Santana', 'Laranjal do Jari', 'Oiapoque', 'Mazagão', 'Porto Grande', 'Tartarugalzinho', 'Vitória do Jari', 'Itaubal', 'Amapá', 'Ferreira Gomes', 'Pedra Branca do Amapari', 'Serra do Navio', 'Calçoene', 'Pracuúba', 'Cutias'],
                'AM': ['Manaus', 'Parintins', 'Itacoatiara', 'Manacapuru', 'Coari', 'Tefé', 'Tabatinga', 'Maués', 'São Gabriel da Cachoeira', 'Humaitá', 'Lábrea', 'Manicoré', 'Eirunepé', 'Benjamin Constant', 'Fonte Boa', 'Tonantins', 'Jutaí', 'Uarini', 'Tapauá', 'Santo Antônio do Içá'],
                'BA': ['Salvador', 'Feira de Santana', 'Vitória da Conquista', 'Camaçari', 'Juazeiro', 'Itabuna', 'Lauro de Freitas', 'Ilhéus', 'Jequié', 'Teixeira de Freitas', 'Alagoinhas', 'Porto Seguro', 'Simões Filho', 'Paulo Afonso', 'Eunápolis', 'Santo Antônio de Jesus', 'Valença', 'Candeias', 'Guanambi', 'Jacobina'],
                'CE': ['Fortaleza', 'Caucaia', 'Juazeiro do Norte', 'Maracanaú', 'Sobral', 'Crato', 'Itapipoca', 'Maranguape', 'Iguatu', 'Quixadá', 'Canindé', 'Aquiraz', 'Pacatuba', 'Crateús', 'Russas', 'Limoeiro do Norte', 'Tianguá', 'Aracati', 'Cascavel', 'Pacajus'],
                'DF': ['Brasília'],
                'ES': ['Vila Velha', 'Serra', 'Cariacica', 'Vitória', 'Cachoeiro de Itapemirim', 'Linhares', 'São Mateus', 'Colatina', 'Guarapari', 'Aracruz', 'Viana', 'Nova Venécia', 'Barra de São Francisco', 'Santa Teresa', 'Castelo', 'Marataízes', 'Itapemirim', 'Afonso Cláudio', 'Alegre', 'Baixo Guandu'],
                'GO': ['Goiânia', 'Aparecida de Goiânia', 'Anápolis', 'Rio Verde', 'Luziânia', 'Águas Lindas de Goiás', 'Valparaíso de Goiás', 'Trindade', 'Formosa', 'Novo Gama', 'Itumbiara', 'Senador Canedo', 'Catalão', 'Jataí', 'Planaltina', 'Caldas Novas', 'Santo Antônio do Descoberto', 'Goianésia', 'Cidade Ocidental', 'Mineiros'],
                'MA': ['São Luís', 'Imperatriz', 'São José de Ribamar', 'Timon', 'Caxias', 'Codó', 'Paço do Lumiar', 'Açailândia', 'Bacabal', 'Balsas', 'Barra do Corda', 'Santa Inês', 'Pinheiro', 'Pedreiras', 'Chapadinha', 'Santa Luzia', 'Presidente Dutra', 'Viana', 'Grajaú', 'Itapecuru Mirim'],
                'MT': ['Cuiabá', 'Várzea Grande', 'Rondonópolis', 'Sinop', 'Tangará da Serra', 'Cáceres', 'Sorriso', 'Lucas do Rio Verde', 'Barra do Garças', 'Primavera do Leste', 'Alta Floresta', 'Ponta Porã', 'Barra do Bugres', 'Colíder', 'Pontes e Lacerda', 'Nova Mutum', 'Diamantino', 'Juína', 'Campo Novo do Parecis', 'Mirassol d\'Oeste'],
                'MS': ['Campo Grande', 'Dourados', 'Três Lagoas', 'Corumbá', 'Ponta Porã', 'Naviraí', 'Nova Andradina', 'Sidrolândia', 'Maracaju', 'São Gabriel do Oeste', 'Coxim', 'Aquidauana', 'Paranaíba', 'Amambai', 'Ribas do Rio Pardo', 'Miranda', 'Caarapó', 'Bela Vista', 'Jardim', 'Ivinhema'],
                'MG': ['Belo Horizonte', 'Uberlândia', 'Contagem', 'Juiz de Fora', 'Betim', 'Montes Claros', 'Ribeirão das Neves', 'Uberaba', 'Governador Valadares', 'Ipatinga', 'Sete Lagoas', 'Divinópolis', 'Santa Luzia', 'Ibirité', 'Poços de Caldas', 'Patos de Minas', 'Pouso Alegre', 'Teófilo Otoni', 'Barbacena', 'Sabará'],
                'PA': ['Belém', 'Ananindeua', 'Santarém', 'Marabá', 'Parauapebas', 'Castanhal', 'Abaetetuba', 'Cametá', 'Marituba', 'Bragança', 'Altamira', 'Itaituba', 'Barcarena', 'Tucuruí', 'Benevides', 'Paragominas', 'Redenção', 'Capanema', 'Tailândia', 'Oriximiná', 'Breves', 'Tome-Açu', 'Vigia', 'Salinópolis', 'Conceição do Araguaia', 'Dom Eliseu', 'Moju', 'Igarapé-Açu', 'São Félix do Xingu', 'Óbidos', 'Curionópolis', 'Abel Figueiredo', 'Acará', 'Afuá', 'Água Azul do Norte', 'Alenquer', 'Almeirim', 'Anajás', 'Anapu', 'Augusto Corrêa', 'Aurora do Pará', 'Aveiro', 'Bagre', 'Baião', 'Bannach', 'Belterra', 'Bom Jesus do Tocantins', 'Bonito', 'Brasil Novo', 'Brejo Grande do Araguaia', 'Breu Branco', 'Bujaru', 'Cachoeira do Arari', 'Cachoeira do Piriá', 'Canaã dos Carajás', 'Capitão Poço', 'Chaves', 'Colares', 'Concórdia do Pará', 'Cumaru do Norte', 'Curralinho', 'Eldorado dos Carajás', 'Faro', 'Floresta do Araguaia', 'Garrafão do Norte', 'Goianésia do Pará', 'Gurupá', 'Igarapé-Miri', 'Inhangapi', 'Ipixuna do Pará', 'Irituia', 'Itupiranga', 'Jacareacanga', 'Jacundá', 'Juruti', 'Limoeiro do Ajuru', 'Mãe do Rio', 'Magalhães Barata', 'Maracanã', 'Marapanim', 'Medicilândia', 'Melgaço', 'Mocajuba', 'Monte Alegre', 'Muaná', 'Nova Esperança do Piriá', 'Nova Ipixuna', 'Nova Timboteua', 'Novo Progresso', 'Novo Repartimento', 'Oeiras do Pará', 'Ourém', 'Ourilândia do Norte', 'Pacajá', 'Palestina do Pará', 'Pau d\'Arco', 'Peixe-Boi', 'Piçarra', 'Placas', 'Ponta de Pedras', 'Portel', 'Porto de Moz', 'Prainha', 'Primavera', 'Quatipuru', 'Rio Maria', 'Rondon do Pará', 'Rurópolis', 'Salvaterra', 'Santa Bárbara do Pará', 'Santa Cruz do Arari', 'Santa Isabel do Pará', 'Santa Luzia do Pará', 'Santa Maria das Barreiras', 'Santa Maria do Pará', 'Santana do Araguaia', 'Santarém Novo', 'Santo Antônio do Tauá', 'São Caetano de Odivelas', 'São Domingos do Araguaia', 'São Domingos do Capim', 'São Francisco do Pará', 'São Geraldo do Araguaia', 'São João da Ponta', 'São João de Pirabas', 'São João do Araguaia', 'São Miguel do Guamá', 'São Sebastião da Boa Vista', 'Sapucaia', 'Senador José Porfírio', 'Soure', 'Terra Alta', 'Terra Santa', 'Tracuateua', 'Trairão', 'Tucumã', 'Ulianópolis', 'Uruará', 'Viseu', 'Vitória do Xingu', 'Xinguara'],
                'PB': ['João Pessoa', 'Campina Grande', 'Santa Rita', 'Patos', 'Bayeux', 'Sousa', 'Cajazeiras', 'Cabedelo', 'Guarabira', 'Mamanguape', 'Sapé', 'Conde', 'Monteiro', 'Princesa Isabel', 'Picuí', 'Itabaiana', 'São Bento', 'Esperança', 'Pombal', 'Cruz do Espírito Santo'],
                'PR': ['Curitiba', 'Londrina', 'Maringá', 'Ponta Grossa', 'Cascavel', 'São José dos Pinhais', 'Foz do Iguaçu', 'Colombo', 'Guarapuava', 'Paranaguá', 'Araucária', 'Toledo', 'Apucarana', 'Pinhais', 'Campo Largo', 'Arapongas', 'Almirante Tamandaré', 'Umuarama', 'Piraquara', 'Cambé'],
                'PE': ['Recife', 'Jaboatão dos Guararapes', 'Olinda', 'Bandeira', 'Caruaru', 'Petrolina', 'Paulista', 'Cabo de Santo Agostinho', 'Camaragibe', 'Garanhuns', 'Vitória de Santo Antão', 'Igarassu', 'São Lourenço da Mata', 'Santa Cruz do Capibaribe', 'Abreu e Lima', 'Ipojuca', 'Serra Talhada', 'Araripina', 'Gravatá', 'Carpina'],
                'PI': ['Teresina', 'Parnaíba', 'Picos', 'Piripiri', 'Floriano', 'Campo Maior', 'Barras', 'União', 'Altos', 'Pedro II', 'Valença do Piauí', 'José de Freitas', 'Esperantina', 'São Raimundo Nonato', 'Corrente', 'Luzilândia', 'Simplício Mendes', 'Água Branca', 'Oeiras', 'Regeneração'],
                'RJ': ['Rio de Janeiro', 'São Gonçalo', 'Duque de Caxias', 'Nova Iguaçu', 'Niterói', 'Campos dos Goytacazes', 'Belford Roxo', 'São João de Meriti', 'Petrópolis', 'Volta Redonda', 'Magé', 'Macaé', 'Itaboraí', 'Cabo Frio', 'Angra dos Reis', 'Nova Friburgo', 'Barra Mansa', 'Teresópolis', 'Mesquita', 'Nilópolis'],
                'RN': ['Natal', 'Mossoró', 'Parnamirim', 'São Gonçalo do Amarante', 'Macaíba', 'Ceará-Mirim', 'Caicó', 'Assu', 'Currais Novos', 'São José de Mipibu', 'Santa Cruz', 'João Câmara', 'Pau dos Ferros', 'Canguaretama', 'Nova Cruz', 'Touros', 'Açu', 'Apodi', 'Baraúna', 'Extremoz'],
                'RS': ['Porto Alegre', 'Caxias do Sul', 'Pelotas', 'Canoas', 'Santa Maria', 'Gravataí', 'Viamão', 'Novo Hamburgo', 'São Leopoldo', 'Rio Grande', 'Alvorada', 'Passo Fundo', 'Sapucaia do Sul', 'Uruguaiana', 'Santa Cruz do Sul', 'Cachoeirinha', 'Bagé', 'Bento Gonçalves', 'Erechim', 'Guaíba'],
                'RO': ['Porto Velho', 'Ji-Paraná', 'Ariquemes', 'Vilhena', 'Cacoal', 'Rolim de Moura', 'Guajará-Mirim', 'Jaru', 'Ouro Preto do Oeste', 'Buritis', 'Costa Marques', 'Colorado do Oeste', 'Cerejeiras', 'Espigão d\'Oeste', 'Pimenta Bueno', 'Presidente Médici', 'São Miguel do Guaporé', 'Alta Floresta d\'Oeste', 'Machadinho d\'Oeste', 'Nova Brasilândia d\'Oeste'],
                'RR': ['Boa Vista', 'Rorainópolis', 'Caracaraí', 'Alto Alegre', 'Mucajaí', 'Bonfim', 'Cantá', 'Normandia', 'São João da Baliza', 'São Luiz', 'Caroebe', 'Iracema', 'Amajari', 'Pacaraima', 'Uiramutã'],
                'SC': ['Joinville', 'Florianópolis', 'Blumenau', 'São José', 'Criciúma', 'Chapecó', 'Itajaí', 'Lages', 'Jaraguá do Sul', 'Palhoça', 'Balneário Camboriú', 'Brusque', 'Tubarão', 'São Bento do Sul', 'Caçador', 'Camboriú', 'Navegantes', 'Concórdia', 'Rio do Sul', 'Araranguá'],
                'SP': ['São Paulo', 'Guarulhos', 'Campinas', 'São Bernardo do Campo', 'São José dos Campos', 'Santo André', 'Ribeirão Preto', 'Osasco', 'Sorocaba', 'Mauá', 'São José do Rio Preto', 'Mogi das Cruzes', 'Santos', 'Diadema', 'Jundiaí', 'Carapicuíba', 'Piracicaba', 'Bauru', 'São Vicente', 'Franca'],
                'SE': ['Aracaju', 'Nossa Senhora do Socorro', 'Lagarto', 'Itabaiana', 'São Cristóvão', 'Estância', 'Tobias Barreto', 'Simão Dias', 'Propriá', 'Barra dos Coqueiros', 'Glória', 'Laranjeiras', 'Itabaianinha', 'Ribeirópolis', 'Neópolis', 'Campo do Brito', 'Umbaúba', 'Porto da Folha', 'Poço Redondo', 'Canindé de São Francisco'],
                'TO': ['Palmas', 'Araguaína', 'Gurupi', 'Porto Nacional', 'Paraíso do Tocantins', 'Colinas do Tocantins', 'Guaraí', 'Tocantinópolis', 'Miracema do Tocantins', 'Dianópolis', 'Araguatins', 'Taguatinga', 'Augustinópolis', 'Xambioá', 'Ananás', 'Arraias', 'Pedro Afonso', 'Combinado', 'Goiatins', 'Miranorte']
            };

            const cidades = cidadesCompletas[estado] || [];

            if (cidades.length === 0) {
                console.warn(`⚠️ Estado ${estado} não encontrado na lista local`);
                cidadeSelect.innerHTML = '<option value="">Estado não encontrado</option>';
            } else {
                console.log(`✅ Fallback local: ${cidades.length} cidades para ${estado}`);

                // Ordenar cidades alfabeticamente
                const cidadesOrdenadas = cidades.sort((a, b) => a.localeCompare(b, 'pt-BR'));

                cidadeSelect.innerHTML = '<option value="">Selecione uma cidade</option>';
                cidadesOrdenadas.forEach(cidade => {
                    const option = document.createElement('option');
                    option.value = cidade;
                    option.textContent = cidade;
                    cidadeSelect.appendChild(option);
                });

                // Log especial para PA com Curionópolis
                if (estado === 'PA') {
                    const curionopolisIncluida = cidades.includes('Curionópolis');
                    console.log(`✅ Curionópolis ${curionopolisIncluida ? 'INCLUÍDA' : 'NÃO incluída'} na lista do PA`);

                    if (curionopolisIncluida) {
                        console.log("🎉 Curionópolis confirmada para o estado do Pará!");
                    }
                }

                cidadesCarregadas = true;
            }
        }

        if (cidadesCarregadas) {
            console.log("✅ Cidades carregadas com sucesso");
        } else {
            console.error("❌ Falha ao carregar cidades");
            cidadeSelect.innerHTML = '<option value="">Erro ao carregar cidades</option>';
        }

    } catch (error) {
        console.error("❌ Erro crítico ao carregar cidades:", error);
        cidadeSelect.innerHTML = '<option value="">Erro ao carregar cidades</option>';
    } finally {
        cidadeSelect.disabled = false;
        console.log("🏁 Carregamento de cidades finalizado");
    }
}

// ✅ FUNÇÃO PARA EDITAR FORNECEDOR
async function editarFornecedor(fornecedorId) {
    console.log("🔄 Editando fornecedor ID:", fornecedorId);

    try {
        let fornecedorList = [];

        const basePath = getFornecedorBasePath();
        if (window.firebaseService && typeof window.firebaseService.loadFromFirebase === 'function') {
            try {
                const res = await window.firebaseService.loadFromFirebase(basePath);
                fornecedorList = normalizeFornecedores(res && res.data);
            } catch (error) {
                console.warn("⚠️ Erro ao carregar fornecedores do Firebase, usando localStorage");
            }
        }

        if (!Array.isArray(fornecedorList) || fornecedorList.length === 0) {
            const fornecedoresLS = await getData(basePath) || [];
            fornecedorList = fornecedoresLS;
        }

        // Encontrar o fornecedor
        const fornecedor = fornecedorList.find(f => String(f.id) === String(fornecedorId));

        if (!fornecedor) {
            console.error("❌ Fornecedor não encontrado:", fornecedorId);
            window.__toast('Fornecedor não encontrado!', 'error');
            return;
        }

        console.log("✅ Abrindo edição para:", fornecedor.nome || fornecedor.name);

        // Abrir modal de edição
        await openEditFornecedorModal(fornecedor);

    } catch (error) {
        console.error("❌ Erro ao editar fornecedor:", error);
        window.__toast('Erro ao editar fornecedor: ' + error.message, 'error');
    }
}

// ✅ FUNÇÃO PARA EXCLUIR FORNECEDOR
async function excluirFornecedor(fornecedorId) {
    console.log("🗑️ Excluindo fornecedor ID:", fornecedorId);

    if (!confirm('Tem certeza que deseja excluir este fornecedor? Esta ação não pode ser desfeita.')) {
        return;
    }

    try {
        let fornecedorList = [];
        const basePath = getFornecedorBasePath();

        if (window.firebaseService && typeof window.firebaseService.loadFromFirebase === 'function') {
            try {
                const res = await window.firebaseService.loadFromFirebase(basePath);
                fornecedorList = normalizeFornecedores(res && res.data);
            } catch (error) {
                console.warn("⚠️ Erro ao carregar fornecedores do Firebase, usando localStorage");
            }
        }

        if (!Array.isArray(fornecedorList) || fornecedorList.length === 0) {
            const fornecedoresLS = await getData(basePath) || [];
            fornecedorList = fornecedoresLS;
        }

        // Encontrar e remover o fornecedor
        const fornecedorIndex = fornecedorList.findIndex(f => String(f.id) === String(fornecedorId));

        if (fornecedorIndex === -1) {
            window.__toast('Fornecedor não encontrado!', 'error');
            return;
        }

        const fornecedorNome = fornecedorList[fornecedorIndex].nome || fornecedorList[fornecedorIndex].name;
        fornecedorList.splice(fornecedorIndex, 1);

        // Persistir em 'fornecedores'
        let saved = false;

        if (window.firebaseService && window.firebaseService.saveData) {
            try {
                saved = await window.firebaseService.saveData(basePath, fornecedorList);
            } catch (error) {
                console.warn("⚠️ Erro ao salvar no Firebase, usando localStorage");
            }
        }

        if (!saved) {
            saved = await saveData(basePath, fornecedorList);
        }

        if (saved) {
            console.log(`✅ Fornecedor ${fornecedorNome} excluído com sucesso`);

            // Atualizar a lista se modal estiver aberto
            const listModal = document.getElementById('fornecedorListModal');
            if (listModal && listModal.style.display === 'block') {
                const fi = document.getElementById('fornecedorListFilter');
                await renderFornecedorListBasic(fi ? fi.value : '');
            }

            window.__toast(`Fornecedor ${fornecedorNome} excluído com sucesso!`, 'success');
        } else {
            throw new Error('Falha ao salvar a lista atualizada');
        }

    } catch (error) {
        console.error(`❌ Erro ao excluir fornecedor ${fornecedorId}:`, error);
        window.__toast(`Erro ao excluir fornecedor: ${error.message}`, 'error');
    }
}

// Fallback seguro para renderTableRows, caso não esteja definido
if (typeof renderTableRows !== 'function') {
    function renderTableRows(tableBody, fornecedorList) {
        try {
            // Se o manager estiver disponível, delega para a implementação oficial
            if (window.fornecedorManager && typeof window.fornecedorManager.renderTableRows === 'function') {
                return window.fornecedorManager.renderTableRows(tableBody, fornecedorList);
            }

            // Tenta localizar o tbody de forma flexível
            const tbody = tableBody || document.querySelector('#fornecedorListTable tbody');
            if (!tbody) {
                console.warn('Tabela de fornecedores não encontrada para renderização.');
                return;
            }

            // Normaliza lista
            const list = Array.isArray(fornecedorList) ? fornecedorList : [];
            tbody.innerHTML = '';

            // Mensagem vazia
            if (list.length === 0) {
                const tr = document.createElement('tr');
                const td = document.createElement('td');
                td.colSpan = 7;
                td.className = 'text-center';
                td.textContent = 'Nenhum fornecedor encontrado';
                tr.appendChild(td);
                tbody.appendChild(tr);
                return;
            }

            // Renderização simplificada de linhas (fallback) - completa e padronizada
            list.forEach((f, idx) => {
                const tr = document.createElement('tr');
                const cols = [
                    (f.nome || f.name || `Fornecedor ${idx + 1}`),
                    (f.cnpj || f.cpf || ''),
                    (f.inscricaoEstadual || f.stateRegistration || ''),
                    (f.estado || f.uf || ''),
                    (f.cidade || ''),
                    (f.endereco || f.address || ''),
                    (f.numero || f.number || ''),
                    (f.bairro || f.neighborhood || ''),
                    (f.telefone || f.phone || ''),
                    (f.email || '')
                ];

                cols.forEach((text, colIdx) => {
                    const td = document.createElement('td');
                    td.textContent = (text == null ? '' : String(text));
                    if (colIdx === 0) {
                        td.style.whiteSpace = 'normal';
                        td.style.wordBreak = 'break-word';
                        td.style.overflow = 'visible';
                        td.style.textOverflow = 'clip';
                        td.style.maxWidth = 'none';
                        td.style.width = 'auto';
                    }
                    tr.appendChild(td);
                });

                const actionsTd = document.createElement('td');
                actionsTd.className = 'actions-col';
                actionsTd.style.textAlign = 'center';
                const btnGroup = document.createElement('div');
                btnGroup.className = 'btn-group';
                const selectBtn = document.createElement('button');
                selectBtn.className = 'action-button select-button';
                selectBtn.title = 'Selecionar Fornecedor';
                selectBtn.innerHTML = '<i class="fas fa-check"></i>';
                selectBtn.onclick = () => { try { selectClientFromList(String(f.id)); } catch(_) {} };
                const editBtn = document.createElement('button');
                editBtn.className = 'action-button edit-button';
                editBtn.title = 'Editar Fornecedor';
                editBtn.innerHTML = '<i class="fas fa-edit"></i>';
                editBtn.onclick = () => { try { editClientFromList(String(f.id)); } catch(_) {} };
                const deleteBtn = document.createElement('button');
                deleteBtn.className = 'action-button delete-button';
                deleteBtn.title = 'Excluir Fornecedor';
                deleteBtn.innerHTML = '<i class="fas fa-trash"></i>';
                deleteBtn.onclick = () => { try { excluirFornecedor(String(f.id)); } catch(_) {} };
                btnGroup.appendChild(selectBtn);
                btnGroup.appendChild(editBtn);
                btnGroup.appendChild(deleteBtn);
                actionsTd.appendChild(btnGroup);
                tr.appendChild(actionsTd);

                tbody.appendChild(tr);
            });
        } catch (err) {
            console.error('Erro ao renderizar tabela de fornecedores (fallback):', err);
        }
    }
}

// Expor todas as funções globalmente
if (typeof window !== 'undefined') {
    // ✅ EXPOR FUNÇÕES GLOBALMENTE
    window.openNewClientModal = openNewClientModal;
    window.openEditClientModal = openEditClientModal;
    window.openNewFornecedorModal = openNewFornecedorModal;
    window.closeNewFornecedorModal = closeNewFornecedorModal;
    window.openEditFornecedorModal = openEditFornecedorModal; // ✅ ESSENCIAL PARA TESTE
    window.editarFornecedor = editarFornecedor;
    window.excluirFornecedor = excluirFornecedor;
    window.selectClientFromList = selectClientFromList;
    window.editClientFromList = editClientFromList;
    window.selectClient = selectClient;
    window.showClientSuggestions = showClientSuggestions;
    window.hideClientSuggestions = hideClientSuggestions;
    window.saveClient = saveClient;
    window.saveFornecedor = saveClient;
    window.updateCities = updateCities;
    window.formatarTelefone = formatarTelefone;
    window.generateUniqueId = generateUniqueId;
    window.saveData = saveData;
    window.getData = getData;
    window.carregarCidadesPorEstado = carregarCidadesPorEstado;
    window.ensureModalStructure = ensureModalStructure;
    window.closeClientListModal = closeFornecedorListModal;
    window.renderTableRows = renderTableRows;
    window.verificarECorrigirModal = verificarECorrigirModal; // ✅ NOVA FUNÇÃO
    window.loadClientForEdit = loadClientForEdit; // ✅ FUNÇÃO AUXILIAR
    window.deduplicarFornecedores = deduplicarFornecedores;
    window.carregarFornecedores = async function() {
        const lista = await fetchFornecedores();
        window.fornecedores = lista;
        return lista;
    };
    if (typeof window.__toast !== 'function') {
        window.__toast = function(message, type) {
            try {
                const containerId = '__toast_container__';
                let c = document.getElementById(containerId);
                if (!c) {
                    c = document.createElement('div');
                    c.id = containerId;
                    c.style.cssText = 'position:fixed;top:16px;right:16px;z-index:99999;display:flex;flex-direction:column;gap:8px;pointer-events:none;';
                    document.body.appendChild(c);
                }
                const t = document.createElement('div');
                t.style.cssText = 'background:' + (type === 'error' ? '#c0392b' : type === 'success' ? '#27ae60' : type === 'warning' ? '#f39c12' : '#34495e') + ';color:#fff;padding:10px 14px;border-radius:8px;box-shadow:0 4px 12px rgba(0,0,0,0.25);font:14px/1.4 system-ui;max-width:420px;pointer-events:auto;';
                t.textContent = String(message || '');
                c.appendChild(t);
                setTimeout(() => { try { c.removeChild(t); } catch(_){ } }, 3000);
            } catch (_) { }
        };
    }

    // ✅ NAMESPACE PARA EVITAR CONFLITOS - CORRIGIDO
    window.fornecedorModals = {
        openNewClientModal,
        openEditClientModal,
        openNewFornecedorModal,
        openEditFornecedorModal,
        editarFornecedor,
        excluirFornecedor,
        selectClientFromList,
        editClientFromList,
        selectClient,
        saveClient,
        updateCities,
        formatarTelefone,
        generateUniqueId,
        saveData,
        getData,
        carregarCidadesPorEstado,
        ensureModalStructure,
        closeFornecedorListModal,
        renderTableRows,
        verificarECorrigirModal,
        loadClientForEdit
    };

    console.log('✅ TODAS as funções corrigidas carregadas com sucesso - incluindo verificarECorrigirModal!');
    console.log('📋 Funções expostas no namespace fornecedorModals:', Object.keys(window.fornecedorModals));

    // ✅ FUNÇÃO DE TESTE PARA DEBUG
    window.testarEdicaoFornecedor = function(fornecedorId) {
        console.log("🧪 === TESTE DE EDIÇÃO DE FORNECEDOR ===");
        console.log("🔍 ID do fornecedor:", fornecedorId);

        if (!fornecedorId) {
            console.error("❌ ID do fornecedor não fornecido");
            return;
        }

        console.log("🔄 Executando editClientFromList...");
        editClientFromList(fornecedorId);
    };

    console.log("🧪 Função de teste disponível: window.testarEdicaoFornecedor(id)");
}

// ✅ FUNÇÃO PARA GARANTIR QUE O MODAL TENHA A ESTRUTURA CORRETA
function ensureModalStructure() {
    console.log("🔧 Verificando estrutura do modal de fornecedores...");

    // Verificar se existe modal de lista de fornecedores
    let modal = document.getElementById('fornecedorListModal');

    if (!modal) {
        console.log("📋 Modal não encontrado no DOM. Verifique se preromaneio.html contém #fornecedorListModal.");
        // Não vamos criar dinamicamente com estilos inline. O HTML deve prover a estrutura.
        // Se realmente não existir, criamos uma estrutura básica compatível com o CSS global.

        modal = document.createElement('div');
        modal.id = 'fornecedorListModal';
        modal.className = 'modal';

        modal.innerHTML = `
            <div class="modal-content">
                <div class="modal-header">
                    <h2>Selecionar Fornecedor</h2>
                    <span class="close-modal" onclick="closeFornecedorListModal()">&times;</span>
                </div>
                <div class="modal-body">
                    <div class="search-box">
                        <input type="text" id="fornecedorListFilter" placeholder="Filtrar fornecedores..." oninput="filterFornecedorList()">
                    </div>
                    <div class="table-responsive modal-table-scroll">
                        <table class="table">
                            <thead>
                                <tr>
                                    <th>Nome</th>
                                    <th>CNPJ</th>
                                    <th>Cidade</th>
                                    <th>Estado</th>
                                    <th>Telefone</th>
                                    <th style="text-align: center;">Ações</th>
                                </tr>
                            </thead>
                            <tbody id="fornecedorListTable"></tbody>
                        </table>
                    </div>
                    <div id="fornecedorPagination" class="pagination-container"></div>
                </div>
                <div class="modal-footer">
                    <button class="btn-limpar" onclick="closeFornecedorListModal()">Fechar</button>
                    <button class="btn-adicionar" onclick="openNewFornecedorModal()">Novo Fornecedor</button>
                </div>
            </div>
        `;
        document.body.appendChild(modal);
    }

    return modal;
}

// Função para fechar o modal
function closeFornecedorListModal() {
    const modal = document.getElementById('fornecedorListModal');
    if (modal) {
        modal.style.display = 'none';
    }
}

// ✅ RENDERIZAÇÃO BÁSICA DA LISTA DE FORNECEDORES
async function renderFornecedorListBasic(filter = '') {
    const term = String(filter || '').trim();
    const renderNow = async () => {
        try {
            let fornecedorList = await fetchFornecedores();
            if (term !== '') {
                const termo = term.toLowerCase();
                fornecedorList = fornecedorList.filter(f => {
                    const nome = (f.nome || f.name || '').toLowerCase();
                    const cnpj = (f.cnpj || '').toLowerCase();
                    const cidade = (f.cidade || f.city || '').toLowerCase();
                    const estado = (f.estado || f.state || '').toLowerCase();
                    const telefone = (f.telefone || f.phone || '').toLowerCase();
                    const email = (f.email || '').toLowerCase();
                    return nome.includes(termo) || cnpj.includes(termo) || cidade.includes(termo) || estado.includes(termo) || telefone.includes(termo) || email.includes(termo);
                });
            }
            const pageSize = window._fornPageSize || 10;
            window._fornPageSize = pageSize;
            const pageIndex = typeof window._fornPageIndex === 'number' ? window._fornPageIndex : 0;
            window._fornPageIndex = pageIndex;
            const total = fornecedorList.length;
            const maxPage = Math.max(0, Math.ceil(total / pageSize) - 1);
            if (window._fornPageIndex > maxPage) window._fornPageIndex = maxPage;
            const start = window._fornPageIndex * pageSize;
            const pageSlice = fornecedorList.slice(start, start + pageSize);
            const tbody = document.getElementById('fornecedorListTable');

            if (tbody) {
                tbody.replaceChildren();

                if (pageSlice.length === 0) {
                    const tr = document.createElement('tr');
                    const td = document.createElement('td');
                    td.colSpan = 6;
                    td.className = 'text-center';
                    td.textContent = 'Nenhum fornecedor encontrado.';
                    tr.appendChild(td);
                    tbody.appendChild(tr);
                } else {
                    pageSlice.forEach((f) => {
                        const tr = document.createElement('tr');

                        // Colunas de dados (textContent, sem HTML de dados)
                        const cols = [
                            f.nome || f.name || '-',
                            f.cnpj || f.cpf || '-',
                            f.cidade || '-',
                            f.estado || f.uf || '-',
                            f.telefone || f.phone || '-'
                        ];
                        cols.forEach((text) => {
                            const td = document.createElement('td');
                            td.textContent = (text == null ? '' : String(text));
                            tr.appendChild(td);
                        });

                        // Coluna de Ações
                        const actionsTd = document.createElement('td');
                        actionsTd.className = 'text-center';

                        const btnGroup = document.createElement('div');
                        btnGroup.className = 'actions-container'; // Usa classe do CSS global

                        // Botão Selecionar
                        const selectBtn = document.createElement('button');
                        selectBtn.className = 'btn-selecionar';
                        selectBtn.title = 'Selecionar';
                        selectBtn.innerHTML = '<i class="fas fa-check"></i>';
                        selectBtn.onclick = () => { try { selectClientFromList(String(f.id)); } catch(_) {} };

                        // Botão Editar
                        const editBtn = document.createElement('button');
                        editBtn.className = 'action-button edit-button';
                        editBtn.title = 'Editar Fornecedor';
                        editBtn.innerHTML = '<i class="fas fa-edit"></i>';
                        editBtn.onclick = () => { try { editClientFromList(String(f.id)); } catch(_) {} };

                        // Botão Excluir
                        const deleteBtn = document.createElement('button');
                        deleteBtn.className = 'action-button delete-button';
                        deleteBtn.title = 'Excluir Fornecedor';
                        deleteBtn.innerHTML = '<i class="fas fa-trash"></i>';
                        deleteBtn.onclick = () => { try { excluirFornecedor(String(f.id)); } catch(_) {} };

                        btnGroup.appendChild(selectBtn);
                        btnGroup.appendChild(editBtn);
                        btnGroup.appendChild(deleteBtn);
                        actionsTd.appendChild(btnGroup);
                        tr.appendChild(actionsTd);

                        tbody.appendChild(tr);
                    });
                }
            }

            const pag = document.getElementById('fornecedorPagination');
            if (pag) {
                const totalPages = Math.max(1, Math.ceil(total / pageSize));
                pag.replaceChildren();
                if (totalPages <= 1) {
                    pag.style.display = 'none';
                } else {
                    pag.style.display = 'flex';
                    const addBtn = (label, page, disabled = false, active = false) => {
                        const btn = document.createElement('button');
                        btn.textContent = label;
                        if (active) btn.classList.add('active');
                        btn.disabled = disabled;
                        btn.onclick = () => {
                            window._fornPageIndex = page;
                            const fi = document.getElementById('fornecedorListFilter');
                            renderFornecedorListBasic(fi ? fi.value : '');
                        };
                        pag.appendChild(btn);
                    };

                    const currentPage = window._fornPageIndex + 1;
                    const goToPage = (p) => Math.min(Math.max(p, 1), totalPages);

                    addBtn('<<<', 0, currentPage === 1);
                    addBtn('<', goToPage(currentPage - 1) - 1, currentPage === 1);

                    const startPage = Math.max(1, currentPage - 2);
                    const endPage = Math.min(totalPages, currentPage + 2);

                    if (startPage > 1) {
                        addBtn('1', 0, false, currentPage === 1);
                        if (startPage > 2) {
                            const span = document.createElement('span');
                            span.textContent = '...';
                            pag.appendChild(span);
                        }
                    }

                    for (let i = startPage; i <= endPage; i++) {
                        addBtn(String(i), i - 1, false, i === currentPage);
                    }

                    if (endPage < totalPages) {
                        if (endPage < totalPages - 1) {
                            const span = document.createElement('span');
                            span.textContent = '...';
                            pag.appendChild(span);
                        }
                        addBtn(String(totalPages), totalPages - 1, false, currentPage === totalPages);
                    }

                    addBtn('>', goToPage(currentPage + 1) - 1, currentPage === totalPages);
                    addBtn('>>>', totalPages - 1, currentPage === totalPages);
                }
            }
        } catch (err) {
            console.error('❌ Erro ao renderizar fornecedores:', err);
        }
    };
    let _fornecedorFilterTimer = null;
    if (term === '') {
        await renderNow();
        return _fornecedorFilterTimer;
    }
    if (window.__fornecedorRenderDebounce) clearTimeout(window.__fornecedorRenderDebounce);
    window.__fornecedorRenderDebounce = setTimeout(renderNow, 120);
    _fornecedorFilterTimer = window.__fornecedorRenderDebounce;
    return _fornecedorFilterTimer;
}

function filterFornecedorList() {
    const input = document.getElementById('fornecedorListFilter');
    if (!input) return;
    renderFornecedorListBasic(input.value);
}

// ✅ ABRIR MODAL LISTA DE FORNECEDORES (NATIVO)
async function openFornecedorListModal() {
    const modal = ensureModalStructure();
    modal.style.display = 'block';

    const tbody = document.getElementById('fornecedorListTable');
    if (tbody) {
        tbody.innerHTML = '<tr><td colspan="6" style="text-align:center; padding: 20px;"><i class="fas fa-spinner fa-spin"></i> Carregando fornecedores...</td></tr>';
    }

    await renderFornecedorListBasic('');
    try {
        const filterInput = document.getElementById('fornecedorListFilter');
        if (filterInput) {
            filterInput.oninput = () => renderFornecedorListBasic(filterInput.value);
            filterInput.focus();
        }
    } catch(_) {}
}

// ✅ Exportar globalmente
window.openFornecedorListModal = openFornecedorListModal;
window.filterFornecedorList = filterFornecedorList;

// ✅ FUNÇÃO ALIAS PARA MANTER COMPATIBILIDADE
function openNewClientModal() {
    console.log("🔄 Redirecionando openNewClientModal para openNewFornecedorModal");
    return openNewFornecedorModal();
}
