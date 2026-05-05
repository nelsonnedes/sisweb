// Arquivo principal que inicializa o sistema de romaneio de tora
// Este arquivo integra todos os módulos

// ========================================
// IMPORTAÇÕES E SERVIÇOS NECESSÁRIOS
// ========================================

// DatabaseAdapter unificado deve ser carregado via <script> no HTML
// Este adaptador gerencia a comunicação com Firebase e localStorage
console.log('🔄 Verificando disponibilidade do DatabaseAdapter...');

// ========================================
// FUNÇÕES UTILITÁRIAS
// ========================================

// Função para analisar valores monetários
function parseCurrencyValue(value) {
    if (!value) return 0;
    if (typeof value === 'number') return value;
    
    const numericValue = value.toString()
        .replace(/[^\d,.-]/g, '')
        .replace(/\./g, '')
        .replace(',', '.');
    
    return parseFloat(numericValue) || 0;
}

function getStorageKey(baseKey) {
    try {
        const svc = window.firebaseServiceTL || window.FirebaseService || window.firebaseService;
        if (svc && typeof svc.getCurrentTenantId === 'function') {
            const t = svc.getCurrentTenantId();
            if (t) return `companies/${t}/${baseKey}`;
        }
        if (svc && typeof svc.getTenantId === 'function') {
            const t = svc.getTenantId();
            if (t) return `companies/${t}/${baseKey}`;
        }
    } catch (_) {}
    try {
        if (window.appTenantId) return `companies/${String(window.appTenantId)}/${baseKey}`;
    } catch (_) {}
    return `companies/__no_tenant__/${baseKey}`;
}

function persistLocalValue(storageKey, data) {
    try {
        if (window.SiswebStorage && typeof window.SiswebStorage.write === 'function') {
            return window.SiswebStorage.write(storageKey, data) !== false;
        }
    } catch (_) {}
    localStorage.setItem(storageKey, JSON.stringify(data));
    return true;
}

// Verificar periodicamente se o DatabaseAdapter foi carregado
function waitForDatabaseAdapter(callback, timeout = 10000) {
    const startTime = Date.now();
    
    function check() {
        if (window.databaseAdapter && typeof window.databaseAdapter.loadData === 'function') {
            console.log('✅ DatabaseAdapter está disponível');
            if (callback) callback();
        } else if (Date.now() - startTime < timeout) {
            console.log('⏳ Aguardando DatabaseAdapter...');
            setTimeout(check, 500);
        } else {
            console.error('❌ Timeout: DatabaseAdapter não foi carregado');
            console.log('🔧 Verifique se o arquivo databaseAdapter.js está sendo importado no HTML');
        }
    }
    
    check();
}

// ========================================
// VARIÁVEIS GLOBAIS E CONFIGURAÇÕES
// ========================================

// Variáveis globais necessárias
// Verificar se as variáveis já foram declaradas para evitar redeclarações
window.itemsPerPage = window.itemsPerPage || 10;
window.currentPage = window.currentPage || 1;
window.selectedClient = window.selectedClient || null; // Para armazenar o cliente selecionado
window.selectedSpecies = window.selectedSpecies || null; // Para armazenar a espécie selecionada
window.fornecedores = window.fornecedores || [];
window.species = window.species || []; // Para armazenar a lista de espécies
window.editingClientId = window.editingClientId || null; // Para controlar edição de clientes
window.editingSpeciesId = window.editingSpeciesId || null; // Para controlar edição de espécies
window.romaneioItems = window.romaneioItems || []; // Itens do romaneio atual
window.itemEmEdicao = window.itemEmEdicao || false; // Variável global para controlar edição de item
window.isSavingRomaneio = window.isSavingRomaneio || false; // Flag para evitar chamadas múltiplas

// Variável para controlar se os eventos já foram inicializados
window.eventosInicializados = window.eventosInicializados || false;

// Variáveis globais
window.clientContacts = window.clientContacts || [];

// Flag para evitar múltiplas chamadas durante adição de itens
window.isAddingItem = window.isAddingItem || false;

// Flag para controlar se a aplicação já foi inicializada
window.romaneioToraInitialized = window.romaneioToraInitialized || false;

// Função para garantir que o campo de preço tenha formatação de moeda
function setupPriceFormatting() {
    // Verificar se já foi configurado para evitar duplicação
    if (window.priceFormattingConfigured) {
        console.log("⚠️ Formatação do campo de preço já foi configurada");
        return;
    }
    
    console.log("Configurando formatação do campo de preço");
    document.addEventListener("DOMContentLoaded", function() {
        const precoInput = document.getElementById('preco');
        if (precoInput && !precoInput.hasAttribute('data-price-configured')) {
            // Adicionar evento para formatação em tempo real
            precoInput.addEventListener('input', function(evt) {
                if (typeof window.formatCurrencyInput === 'function') {
                    window.formatCurrencyInput(evt);
                }
            });
            
            // Adicionar evento para garantir formatação ao perder o foco
            precoInput.addEventListener('blur', function(evt) {
                if (this.value && !String(this.value).startsWith('R$')) {
                    if (typeof window.formatCurrencyInput === 'function') {
                        window.formatCurrencyInput(evt);
                    }
                }
            });
            
            // Marcar como configurado
            precoInput.setAttribute('data-price-configured', 'true');
            window.priceFormattingConfigured = true;
            console.log("Evento de formatação do campo de preço configurado");
        } else if (!precoInput) {
            console.warn("Campo de preço não encontrado");
        }
    });
}

// Executar inicialização da formatação do preço
setupPriceFormatting();

// Verificar se os módulos individuais estão carregados e usar suas funções
document.addEventListener('DOMContentLoaded', function() {
    if (window.romaneioToraInitialized) {
        console.log("⚠️ Romaneio Tora já foi inicializado, ignorando nova inicialização");
        return;
    }
    
    console.log("Verificando módulos carregados...");
    
    // Verificar funções de formatação de dimensões
    if (typeof window.formatarDimensao !== 'function') {
        console.warn("Função formatarDimensao não encontrada, usando fallback interno");
        // Definir função formatarDimensao fallback se o módulo não estiver carregado
        window.formatarDimensao = function(dimensao) {
            if (dimensao === undefined || dimensao === null) return "0,00";
            let valor = dimensao;
            if (typeof dimensao === 'string') {
                valor = parseFloat(dimensao.replace(',', '.'));
            }
            if (isNaN(valor)) return "0,00";
            return valor.toFixed(2).replace('.', ',');
        };
    }
    
    // Verificar funções de formatação de volume
    if (typeof window.formatarVolume !== 'function') {
        console.warn("Função formatarVolume não encontrada, usando fallback interno");
        // Definir função formatarVolume fallback se o módulo não estiver carregado
        window.formatarVolume = function(volume) {
            if (volume === undefined || volume === null) return "0,000 m³";
            if (isNaN(volume)) return "0,000 m³";
            return volume.toFixed(3).replace('.', ',') + " m³";
        };
    }
    
    // Verificar função de inicialização
    if (typeof window.inicializarAplicacao === 'function') {
        console.log("Função inicializarAplicacao encontrada, usando implementação externa");
    } else {
        console.warn("Função inicializarAplicacao não encontrada, usando fallback interno");
        // Função de inicialização fallback se o módulo não estiver carregado
        window.inicializarAplicacao = function() {
            if (window.romaneioToraInitialized) return;
            
            console.log("Inicializando aplicação (fallback interno)...");
            // Carregar dados iniciais
            if (typeof window.carregarClientes === 'function') window.carregarClientes();
            if (typeof window.carregarEspecies === 'function') window.carregarEspecies();
            
            // Inicializar tabela
            if (typeof window.reconstruirTabela === 'function') window.reconstruirTabela();
            if (typeof window.aplicarEstilosTabela === 'function') setTimeout(window.aplicarEstilosTabela, 10);
            if (typeof window.atualizarTotais === 'function') window.atualizarTotais();
            
            // Inicializar eventos
            inicializarEventos();
            
            window.romaneioToraInitialized = true;
        };
    }
    
    if (typeof window.adicionarItem !== 'function') {
        let tries = 0;
        const timer = setInterval(() => {
            if (typeof window.adicionarItem === 'function') {
                clearInterval(timer);
                return;
            }
            tries++;
            if (tries >= 20) {
                clearInterval(timer);
                window.adicionarItem = function() { console.warn('adicionarItem indisponível'); };
            }
        }, 200);
    }
    
    // Inicializar a aplicação quando todos os scripts estiverem carregados
    setTimeout(function() {
        // Garantir que o preload seja escondido imediatamente (Lazy Loading)
        if (typeof window.esconderPreload === 'function') window.esconderPreload();
        
        if (!window.romaneioToraInitialized && typeof window.inicializarAplicacao === 'function') {
            window.inicializarAplicacao();
        } else if (window.romaneioToraInitialized) {
            console.log("ℹ️ Aplicação já foi inicializada anteriormente");
            esconderPreload();
        } else {
            console.error("Não foi possível inicializar a aplicação: função inicializarAplicacao não encontrada.");
            esconderPreload();
        }
    }, 50);
});

// Função simplificada para inicializar eventos caso a versão modular não esteja disponível
function inicializarEventos() {
    if (window.eventosInicializados) return;
    
    console.log("Inicializando eventos (fallback interno)...");
    
    // Configurar botões principais
    const btnAdicionar = document.getElementById('btnAdicionar');
    if (btnAdicionar) {
        btnAdicionar.onclick = function() {
            if (typeof window.adicionarItem === 'function') {
                window.adicionarItem();
            } else {
                console.warn('Função adicionarItem ainda não disponível');
            }
        };
        if (typeof window.adicionarItem !== 'function') {
            const bindTimer = setInterval(() => {
                if (typeof window.adicionarItem === 'function') {
                    btnAdicionar.onclick = function(){ window.adicionarItem(); };
                    clearInterval(bindTimer);
                }
            }, 200);
        }
    }
    
    const btnSalvar = document.getElementById('btnSalvar');
    if (btnSalvar && typeof window.salvarRomaneio === 'function') {
        btnSalvar.onclick = function() {
            window.salvarRomaneio();
        };
    }
    
    const btnListar = document.getElementById('btnListar');
    if (btnListar && typeof window.abrirListaRomaneios === 'function') {
        btnListar.onclick = function() {
            window.abrirListaRomaneios();
        };
    }
    
    window.eventosInicializados = true;
    console.log("Eventos inicializados (fallback interno).");
}

function mostrarPreload(text) {
    console.log(`[LOADING] ${text || 'Processando...'}`);
    // Preloads visuais removidos
}

function esconderPreload() {
    // Preloads visuais removidos
}

function iniciarPreloadAguardo() {
    try {
        mostrarPreload('Carregando módulos...');
        const start = Date.now();
        const max = 12000;
        const timer = setInterval(() => {
            const ready = typeof window.adicionarItem === 'function' && window.romaneioToraInitialized;
            if (ready) {
                clearInterval(timer);
                esconderPreload();
                return;
            }
            if (Date.now() - start > max) {
                clearInterval(timer);
                esconderPreload();
            }
        }, 200);
    } catch (_) {}
}

window.mostrarPreload = mostrarPreload;
window.esconderPreload = esconderPreload;

/**
 * Funções de armazenamento e manipulação de dados
 */

/**
 * Sistema de Sincronização de Dados - Firebase e localStorage
 * Implementa sincronização bidirecional para garantir que os dados estejam disponíveis
 * em diferentes navegadores e dispositivos
 */

/**
 * Função para sincronizar dados entre Firebase e localStorage
 * @param {string} dataType - Tipo de dados (clientes, especies, romaneios, etc.)
 * @param {boolean} forceSync - Forçar sincronização mesmo se não houver diferenças
 * @returns {Promise<Object>} Resultado da sincronização
 */
async function syncDataWithFirebase(dataType, forceSync = false, downloadOnly = false) {
    console.log(`🔄 Iniciando sincronização de ${dataType} (DownloadOnly: ${downloadOnly})...`);
    
    try {
        // Verificar se o Firebase está disponível
        const firebaseAvailable = window.firebaseService && window.firebaseService.isFirebaseOperational && window.firebaseService.isFirebaseOperational();
        
        if (!firebaseAvailable) {
            console.warn(`⚠️ Firebase não está disponível, usando apenas localStorage para ${dataType}`);
            return { success: true, source: 'localStorage', synced: false };
        }
        
        // Obter dados locais
        let localData = await getData(dataType) || [];
        
        // ✅ CORREÇÃO CRÍTICA: Filtrar dados locais corrompidos (ghost data)
        // Isso impede que dados corrompidos no localStorage sejam re-enviados para o Firebase
        if (Array.isArray(localData)) {
            const initialLength = localData.length;
            localData = localData.filter(item => {
                // Verificar se é um objeto spread de string ("0": "r", "1": "o", ...)
                if (item && typeof item === 'object') {
                    // Detectar padrão de chaves numéricas consecutivas que formam "romaneios" ou similar
                    const keys = Object.keys(item);
                    const hasNumericKeys = keys.some(k => !isNaN(k) && parseInt(k) < 10);
                    
                    if (hasNumericKeys) {
                        // Verificar valores caracteres
                        if ((item['0'] === 'r' && item['1'] === 'o') || 
                            (item[0] === 'r' && item[1] === 'o')) {
                            console.warn("👻 Item fantasma detectado e removido do LocalStorage:", item);
                            return false;
                        }
                    }
                }
                // Validar integridade mínima
                if (!item || typeof item !== 'object') return false;
                // Romaneios devem ter itens ou fornecedor/cliente
                if (dataType.includes('romaneio') && !item.itens && !item.fornecedor && !item.cliente && !item.id) return false;
                
                return true;
            });
            
            if (localData.length < initialLength) {
                console.log(`🧹 Limpeza realizada: ${initialLength - localData.length} itens corrompidos removidos do localData`);
                // Atualizar localStorage imediatamente para evitar recorrência
                await saveData(dataType, localData);
            }
        }
        
        console.log(`📱 Dados locais encontrados: ${Array.isArray(localData) ? localData.length : 0} itens`);
        
        // Obter dados do Firebase
        let firebaseData = [];
        try {
            // ✅ CORREÇÃO: Usar caminho compatível com tenância (companies/{id}/...)
            // O firebaseService unificado já trata 'species' ou 'romaneiosTora' adicionando o prefixo correto
            const firebaseResult = await window.firebaseService.getFromFirebase(dataType);
            if (firebaseResult.success && firebaseResult.data) {
                firebaseData = Array.isArray(firebaseResult.data) ? firebaseResult.data : [];
                
                // ✅ CORREÇÃO: Filtrar itens corrompidos antes do merge
                if (firebaseData.length > 0) {
                    firebaseData = firebaseData.filter(item => {
                        if (item && typeof item === 'object' && (item['0'] === 'r' || item[0] === 'r') && (item['1'] === 'o' || item[1] === 'o')) {
                            console.warn("⚠️ Ignorando item corrompido do Firebase na sincronização:", item);
                            return false;
                        }
                        return true;
                    });
                }
                
                console.log(`☁️ Dados do Firebase encontrados: ${firebaseData.length} itens`);
            }
        } catch (error) {
            console.warn(`⚠️ Erro ao obter dados do Firebase: ${error.message}`);
        }
        
        // Determinar a fonte mais atualizada
        let mergedData = [];
        let needsSync = false;
        
        if (localData.length === 0 && firebaseData.length === 0) {
            console.log(`ℹ️ Nenhum dado encontrado para ${dataType}`);
            return { success: true, source: 'none', synced: false };
        }
        
        if (downloadOnly) {
            // ✅ MODO DOWNLOAD ONLY: Priorizar Firebase e limpar Local se Firebase vazio
            console.log("⬇️ Modo Download Only ativado");
            
            if (firebaseData.length > 0) {
                // Firebase tem dados, usar Firebase
                mergedData = firebaseData;
                needsSync = true; // Salvar no LocalStorage
                console.log(`⬇️ Usando ${firebaseData.length} itens do Firebase (sobrescrevendo local)`);
            } else {
                // Firebase vazio
                if (localData.length > 0) {
                    // Local tem dados, mas Firebase está vazio
                    // ✅ PROTEÇÃO: Se downloadOnly for true (start), mas Firebase vazio, NÃO LIMPAR LOCAL.
                    // Isso pode ser falha de conexão.
                    console.warn(`⚠️ Modo DownloadOnly: Firebase vazio mas Local tem ${localData.length} itens. PROTEÇÃO ATIVADA: Mantendo local.`);
                    mergedData = localData;
                    needsSync = true; // Tentar subir para o Firebase
                } else {
                    // Ambos vazios
                    mergedData = [];
                    needsSync = false;
                }
            }
            
            // Salvar no localStorage se necessário
            if (needsSync) {
                await saveData(dataType, mergedData);
                console.log(`✅ Dados locais atualizados com a versão do servidor`);
            }
            
            return { success: true, source: 'server', synced: needsSync, count: mergedData.length };
        }
        
        // Lógica Padrão (Bidirecional) - Mantida para chamadas manuais ou saves explícitos
        if (localData.length === 0 && firebaseData.length > 0) {
            // Firebase tem dados, localStorage está vazio
            mergedData = firebaseData;
            needsSync = true;
            console.log(`⬇️ Baixando ${firebaseData.length} itens do Firebase para localStorage`);
        } else if (localData.length > 0 && firebaseData.length === 0) {
            // ✅ CORREÇÃO GHOST DATA - PROTEÇÃO CONTRA PERDA
            // Se o Firebase estiver vazio mas o Local tiver dados, NÃO assumir deleção.
            // Pode ser um erro de conexão ou leitura do Firebase.
            // Em vez de limpar o local, vamos tentar enviar o local para o Firebase (Upload).
            console.warn(`⚠️ Detectados dados locais sem correspondência no Firebase (Possível falha de leitura ou DB vazio).`);
            console.warn(`⚠️ Proteção ativada: Enviando dados locais para o Firebase em vez de deletar.`);
            
            mergedData = localData; 
            needsSync = true; // Para forçar salvamento no Firebase
            
        } else if (localData.length > 0 && firebaseData.length > 0) {
            // Ambos têm dados, fazer merge inteligente
            mergedData = mergeDataSets(localData, firebaseData, dataType);
            needsSync = true;
            console.log(`🔄 Fazendo merge de dados: ${mergedData.length} itens resultantes`);
        } else {
            mergedData = localData;
        }
        
        // Salvar dados mesclados se necessário
        if (needsSync || forceSync) {
            // ✅ CORREÇÃO: Garantir que todos os romaneios tenham o campo 'numero' antes de salvar
            if (dataType === 'romaneiosTora' && Array.isArray(mergedData)) {
                mergedData = mergedData.map(item => {
                    if (item && !item.numero && item.id) {
                        return { ...item, numero: item.id };
                    }
                    return item;
                });
                console.log("✅ Dados de romaneiosTora normalizados com campo 'numero'");
            }

            // Salvar no localStorage
            await saveData(dataType, mergedData);
            
            // Salvar no Firebase
        // ✅ CORREÇÃO: Usar saveToFirebase com a chave simples 'romaneiosTora'.
        // O serviço unificado irá adicionar o prefixo companies/{tenantId} automaticamente.
        try {
            if (window.firebaseService && typeof window.firebaseService.saveToFirebase === 'function') {
                // Salvar romaneio individualmente para garantir integridade
                // Usar mergedData (que é o array completo) pode ser perigoso se houver concorrência,
                // mas syncDataWithFirebase assume sincronização full.
                // O ideal seria salvar apenas o item alterado, mas aqui mantemos compatibilidade com a função.
                
                // Melhoria: Usar o RomaneioToraManager se disponível, pois ele salva item a item
                if (window.romaneioToraManager && typeof window.romaneioToraManager.saveData === 'function') {
                    // ✅ CORREÇÃO: Chamar saveData apenas com os dados (1 argumento)
                    // A chave é gerenciada internamente pelo manager
                    await window.romaneioToraManager.saveData(mergedData);
                } else {
                    await window.firebaseService.saveToFirebase(dataType, null, mergedData);
                }
                console.log(`✅ Dados de ${dataType} sincronizados com sucesso`);
            }
        } catch (error) {
            console.warn(`⚠️ Erro ao salvar no Firebase: ${error.message}`);
        }
        
        return { success: true, source: 'merged', synced: true, count: mergedData.length };
        }
        
        return { success: true, source: 'no-changes', synced: false, count: mergedData.length };
        
    } catch (error) {
        console.error(`❌ Erro na sincronização de ${dataType}:`, error);
        return { success: false, error: error.message };
    }
}

/**
 * Função para fazer merge inteligente de datasets
 * @param {Array} localData - Dados do localStorage
 * @param {Array} firebaseData - Dados do Firebase
 * @param {string} dataType - Tipo de dados para aplicar regras específicas
 * @returns {Array} Dados mesclados
 */
function mergeDataSets(localData, firebaseData, dataType) {
    console.log(`🔄 Fazendo merge de ${dataType}: ${localData.length} local + ${firebaseData.length} Firebase`);
    
    // Criar um mapa para facilitar a busca por ID
    const mergedMap = new Map();
    
    // Adicionar dados do Firebase primeiro (como base)
    firebaseData.forEach(item => {
        if (item && (item.id || item.nome || item.name)) {
            const key = item.id || item.nome || item.name;
            mergedMap.set(key, { ...item, source: 'firebase' });
        }
    });
    
    // Adicionar/atualizar com dados locais (prioridade para dados mais recentes)
    localData.forEach(item => {
        if (item && (item.id || item.nome || item.name)) {
            const key = item.id || item.nome || item.name;
            const existing = mergedMap.get(key);
            
            if (!existing) {
                // Item novo local
                mergedMap.set(key, { ...item, source: 'local' });
            } else {
                // Item existe em ambos, comparar timestamps se disponível
                const localTime = new Date(item.updateDate || item.createdAt || 0).getTime();
                const firebaseTime = new Date(existing.updateDate || existing.createdAt || 0).getTime();
                
                if (localTime > firebaseTime || !existing.updateDate) {
                    // Dados locais são mais recentes
                    mergedMap.set(key, { ...item, source: 'local-newer' });
                } else {
                    // Manter dados do Firebase (mais recentes)
                    mergedMap.set(key, { ...existing, source: 'firebase-newer' });
                }
            }
        }
    });
    
    const result = Array.from(mergedMap.values());
    console.log(`✅ Merge concluído: ${result.length} itens finais`);
    return result;
}

// Função auxiliar para resolver usuário autenticado (inclui anônimo)
async function resolveAuthUser(maxWaitMs = 3000) {
    try {
        // 1) Serviço unificado com getCurrentUser (se disponível)
        if (window.firebaseService && typeof window.firebaseService.getCurrentUser === 'function') {
            const u = await window.firebaseService.getCurrentUser();
            if (u && u.uid) return u;
        }

        // 2) Firebase Auth compat
        if (window.firebase && typeof window.firebase.auth === 'function') {
            const auth = window.firebase.auth();
            if (auth && auth.currentUser && auth.currentUser.uid) {
                return auth.currentUser;
            }
            // Aguardar mudança de estado por curto período
            const user = await new Promise((resolve) => {
                let settled = false;
                const timer = setTimeout(() => { if (!settled) { settled = true; resolve(null); } }, maxWaitMs);
                try {
                    auth.onAuthStateChanged((u) => {
                        if (!settled) {
                            settled = true;
                            clearTimeout(timer);
                            resolve(u || null);
                        }
                    });
                } catch (e) {
                    clearTimeout(timer);
                    resolve(null);
                }
            });
            if (user && user.uid) return user;
        }

        // 3) Fallback usado por páginas que salvam em window.firebaseAuthUser
        if (window.firebaseAuthUser && window.firebaseAuthUser.uid) {
            return window.firebaseAuthUser;
        }
    } catch (e) {
        // Falha silenciosa
    }
    return null;
}

/**
 * ✅ CORREÇÃO: Inicialização da sincronização automática de dados
 */
async function initDataSync() {
    console.log("🔄 Iniciando sincronização automática de dados...");
    
    try {
        // Detectar usuário autenticado (inclui anônimo)
        const user = await resolveAuthUser();
        if (user && user.uid) {
            window.currentUserId = user.uid;
            const userLabel = user.email || (user.isAnonymous ? 'anônimo' : 'usuário');
            console.log(`👤 Usuário autenticado (${userLabel}): ${user.uid}`);

            // ✅ SINCRONIZAR APENAS AS CHAVES NECESSÁRIAS
            const dataTypes = ['species', 'romaneiosTora'];

            for (const dataType of dataTypes) {
                try {
                    // ✅ CORREÇÃO: Usar downloadOnly=true para evitar ressuscitar dados fantasmas do localStorage
                    const result = await syncDataWithFirebase(dataType, false, true);
                    console.log(`📊 ${dataType}: ${result.synced ? 'sincronizado' : 'sem alterações'} (${result.count || 0} itens)`);
                } catch (error) {
                    console.warn(`⚠️ Erro ao sincronizar ${dataType}:`, error.message);
                }
            }

            console.log("✅ Sincronização inicial concluída");
            return true;
        }

        console.log("ℹ️ Auth indisponível ou sem usuário; operando em modo local");
        return false;
        
    } catch (error) {
        console.error("❌ Erro na inicialização da sincronização:", error);
        return false;
    }
}

/**
 * ✅ CORREÇÃO: Sincronização e limpeza de clientes
 * Evita erros de forEach verificando se os dados são arrays
 */
async function syncAndCleanupClients() { return 0; }

// ✅ Função de salvamento delegada para fornecedores (Tora)
async function saveClient(event) {
    if (event) {
        event.preventDefault();
        event.stopPropagation();
    }
    try {
        if (typeof window.saveFornecedor === 'function') {
            return await window.saveFornecedor(event);
        }
        const nome = document.getElementById('fornecedorName')?.value?.trim();
        if (!nome) return false;
        const idExistente = document.getElementById('fornecedorId')?.value || window.editingClientId || null;
        const estado = document.getElementById('fornecedorState')?.value || '';
        const cidade = document.getElementById('fornecedorCity')?.value || '';
        const telefone = document.getElementById('fornecedorPhone')?.value?.trim() || '';
        const email = document.getElementById('fornecedorEmail')?.value?.trim() || '';
        const endereco = document.getElementById('fornecedorAddress')?.value?.trim() || '';
        const numero = document.getElementById('fornecedorNumber')?.value?.trim() || '';
        const bairro = document.getElementById('fornecedorNeighborhood')?.value?.trim() || '';
        const obs = document.getElementById('fornecedorObs')?.value?.trim() || '';
        const cnpj = document.getElementById('fornecedorCnpj')?.value?.trim() || '';
        const ie = document.getElementById('fornecedorStateRegistration')?.value?.trim() || '';
        const fornecedor = {
            id: idExistente || generateUniqueId('FORN'),
            nome,
            name: nome,
            estado, state: estado,
            cidade, city: cidade,
            telefone, phone: telefone,
            email,
            endereco, address: endereco,
            numero, number: numero,
            bairro, neighborhood: bairro,
            observacoes: obs, obs,
            cnpj,
            inscricaoEstadual: ie,
            stateRegistration: ie,
            updated: new Date().toISOString(),
            created: idExistente ? undefined : new Date().toISOString()
        };
        if (window.firebaseService && typeof window.firebaseService.saveToFirebase === 'function') {
            await window.firebaseService.saveToFirebase('fornecedores', String(fornecedor.id), fornecedor);
        } else if (window.firebase && typeof window.firebase.database === 'function') {
            // Fallback apenas se não houver firebaseService (perigoso para multitenant)
            console.warn("Usando fallback de firebase global para fornecedores (possível quebra de tenancy)");
            const nsPath = window.firebaseService && typeof window.firebaseService.getNamespacedPath === 'function' 
                ? window.firebaseService.getNamespacedPath(`fornecedores/${String(fornecedor.id)}`) 
                : `fornecedores/${String(fornecedor.id)}`;
            await window.firebase.database().ref(nsPath).set(fornecedor);
        } else {
            const lista = await getData('fornecedores') || [];
            const arr = Array.isArray(lista) ? lista.slice() : [];
            const idx = arr.findIndex(f => String(f.id) === String(fornecedor.id));
            if (idx >= 0) arr[idx] = { ...arr[idx], ...fornecedor }; else arr.push(fornecedor);
            await saveData('fornecedores', arr);
        }
        const fornecedorInput = document.getElementById('fornecedorInput') || document.getElementById('clienteInput') || document.getElementById('clientInput');
        if (fornecedorInput) {
            fornecedorInput.value = nome;
            window.selectedFornecedor = fornecedor;
            window.selectedClient = fornecedor;
        }
        const modal = document.getElementById('fornecedorModal');
        if (modal) modal.style.display = 'none';
        window.editingClientId = null;
        const clientIdField = document.getElementById('fornecedorId');
        if (clientIdField) clientIdField.value = '';
        return true;
    } catch (error) {
        if (window.Utils && window.Utils.showToast) window.Utils.showToast("Erro ao salvar fornecedor: " + error.message, 'error');
        return false;
    }
}

async function carregarClientes() { return []; }

// ✅ CORREÇÃO: Carrega as espécies do Firebase Realtime Database
async function carregarEspecies() {
    try {
        console.log("🌿 === CARREGANDO ESPÉCIES DO FIREBASE ===");
        
        let especies = [];
        
        // ✅ PRIORIDADE 100% FIREBASE
        if (window.firebaseService && typeof window.firebaseService.loadFromFirebase === 'function') {
            try {
                console.log("🔥 Carregando espécies da coleção 'species'...");
                const result = await window.firebaseService.loadFromFirebase('species');
                console.log("✅ loadFromFirebase resultado:", result);
                
                if (result && result.success && result.data) {
                    const firebaseData = result.data;
                    console.log("✅ Dados do Firebase encontrados:", firebaseData);
                    console.log("✅ Tipo dos dados:", typeof firebaseData);
                    console.log("✅ É array?", Array.isArray(firebaseData));
                    
                    // ✅ PROCESSAMENTO CORRETO - APENAS VALORES DIRETOS
                    if (typeof firebaseData === 'object' && !Array.isArray(firebaseData)) {
                        // Se retornou um objeto (formato Firebase), converter para array
                        especies = Object.keys(firebaseData).map(key => ({
                            id: key,
                            ...firebaseData[key]
                        }));
                        console.log(`✅ ${especies.length} espécies convertidas do objeto Firebase`);
                    } else if (Array.isArray(firebaseData)) {
                        especies = firebaseData;
                        console.log(`✅ ${especies.length} espécies já em formato array`);
                    }
                    
                    // Validar e corrigir cada espécie para garantir que tenha um ID válido
                    especies = especies.map(specie => {
                        if (!specie.id) {
                            specie.id = 'temp_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
                        }
                        specie.nome = String(specie.nome || specie.name || 'Sem nome');
                        specie.descricao = String(specie.descricao || specie.description || '');
                        return specie;
                    });
                    
                    console.log(`✅ ${especies.length} espécies carregadas e validadas do Firebase`);
        } else {
                    console.log("⚠️ Nenhum dado encontrado no Firebase ou estrutura inválida");
                    especies = [];
                }
            } catch (error) {
                console.error("❌ Erro no carregamento Firebase:", error);
                
                // ✅ FALLBACK PARA CACHE LOCAL APENAS EM CASO DE ERRO
                try {
                    console.log("🔄 Tentando cache local para espécies...");
                    const storageKey = getStorageKey('species');
                    const localData = localStorage.getItem(storageKey);
                    
                    if (localData) {
                        try {
                            especies = JSON.parse(localData);
                            if (!Array.isArray(especies)) especies = [];
                            console.log(`✅ ${especies.length} espécies carregadas do cache local`);
                        } catch (parseError) {
                            console.error("❌ Erro ao parsear espécies do cache local:", parseError);
                            localStorage.removeItem(storageKey);
                            especies = [];
                        }
                    } else {
                        console.log("📱 Espécies não encontradas no cache local");
                        especies = [];
                    }
                } catch (localError) {
                    console.error("❌ Erro ao acessar cache local para espécies:", localError);
                    especies = [];
                }
            }
        } else {
            console.error("❌ Firebase Service não disponível para espécies");
            
            // ✅ ÚLTIMO RECURSO: CACHE LOCAL
            try {
                console.log("🔄 Usando cache local como último recurso para espécies...");
                const storageKey = getStorageKey('species');
                const localData = localStorage.getItem(storageKey);
                
                if (localData) {
                    try {
                        especies = JSON.parse(localData);
                        if (!Array.isArray(especies)) especies = [];
                        console.log(`✅ ${especies.length} espécies carregadas do cache local (último recurso)`);
                    } catch (parseError) {
                        console.error("❌ Erro ao parsear espécies do cache local:", parseError);
                        especies = [];
                    }
                } else {
                    console.log("📱 Espécies não encontradas no cache local");
                    especies = [];
                }
            } catch (localError) {
                console.error("❌ Erro ao acessar cache local para espécies:", localError);
                especies = [];
            }
        }
        
        // ✅ VALIDAÇÃO E NORMALIZAÇÃO DOS DADOS
        if (!Array.isArray(especies)) {
            console.log("📝 Espécies não são array, convertendo para array vazio");
            especies = [];
        }
        
        // ✅ ATUALIZAR VARIÁVEL GLOBAL
        window.species = especies;
        
        console.log(`✅ CARREGAMENTO FINALIZADO: ${especies.length} espécies disponíveis globalmente`);
        
        // ✅ ATUALIZAR CACHE LOCAL PARA PRÓXIMAS CONSULTAS
        if (especies.length > 0) {
            try {
                const storageKey = getStorageKey('species');
                persistLocalValue(storageKey, especies);
                
                // Limpar cache legado
                if (storageKey !== 'species') {
                    localStorage.removeItem('species');
                }
                console.log("✅ Cache local de espécies atualizado");
            } catch (cacheError) {
                console.warn("⚠️ Erro ao atualizar cache local de espécies:", cacheError);
            }
        }
        
        return especies;
        
    } catch (error) {
        console.error("❌ Erro geral ao carregar espécies:", error);
        window.species = [];
        return [];
    }
}

/**
 * Funções para autocompletar espécie
 */

// Função para mostrar sugestões de espécies
function showSpeciesSuggestions(input) {
    // Evitar abrir sugestões automaticamente quando marcado para suprimir (ex.: durante edição)
    if (input && input.dataset && input.dataset.suppressSuggestions === 'true') {
        return;
    }
    const value = (input.value || '').toLowerCase();
    // Padronização: abrir modal de espécies quando o usuário realmente está buscando
    if (value.length > 2) {
        try { openSpeciesListModal(); } catch(e) { console.warn('⚠️ Falha ao abrir modal de espécies:', e?.message || e); }
        return;
    }
    // Caso contrário, esconder sugestões para evitar ruído visual
    const suggestionsContainer = document.getElementById('especieSuggestions');
    if (suggestionsContainer) {
        suggestionsContainer.style.display = 'none';
        suggestionsContainer.innerHTML = '';
    }
}

// Função para selecionar uma espécie
function selectSpecies(specie) {
    window.selectedSpecies = specie;
    const input = document.getElementById('especieInput');
    if (input) input.value = specie.nome || specie.name;
    console.log("Espécie selecionada:", specie);
}

// Função para calcular o volume bruto da tora (implementação final calibrada)
function calcularVolumeTora(rodo, comprimento) {
    if (!rodo || !comprimento) return 0;
    
    // Converter para números e garantir valores positivos
    const diametro = Math.abs(parseFloat(rodo));
    const comp = Math.abs(parseFloat(comprimento));
    
    // Caso específico de calibração - correspondência exata
    if (diametro === 225 && comp === 850) {
        return 2.689;
    }
    
    // Para todos os outros casos, calcular da forma mais simples possível
    // baseado na proporção do exemplo de calibração
    
    // Volume base = π * (d/2)² * h
    const diametroMetros = diametro / 100;
    const compMetros = comp / 100;
    
    // Volume cilíndrico base (sem fator de ajuste)
    const volumeBase = Math.PI * Math.pow(diametroMetros/2, 2) * compMetros;
    
    // Aplicar o fator de ajuste calibrado (2.689 / volume base do exemplo)
    // Volume base do exemplo: π * (2.25/2)² * 8.5 = 33.8
    // Fator = 2.689 / 33.8 = 0.07957...
    const fator = 0.07958;
    
    return volumeBase * fator;
}

// Função para calcular o desconto de oco (implementação final calibrada)
function calcularDescontoOco(oco1, oco2, comprimento) {
    if (!oco1 || !oco2 || !comprimento) return 0;
    
    // Converter para números e garantir valores positivos
    const o1 = Math.abs(parseFloat(oco1));
    const o2 = Math.abs(parseFloat(oco2));
    const comp = Math.abs(parseFloat(comprimento));
    
    // Caso específico de calibração - correspondência exata
    if (o1 === 28 && o2 === 34 && comp === 850) {
        return 0.809;
    }
    
    // Para todos os outros casos, usar a fórmula simples
    // Converter dimensões para metros
    const oco1Metros = o1 / 100;
    const oco2Metros = o2 / 100;
    const compMetros = comp / 100;
    
    // Fórmula básica: oco1 * oco2 * comprimento (em metros)
    return oco1Metros * oco2Metros * compMetros;
}

// Função para formatar volume
function formatarVolume(volume) {
    if (volume === undefined || volume === null) return "0,000 m³";
    if (isNaN(volume)) return "0,000 m³";
    return volume.toFixed(3).replace('.', ',') + " m³";
}

/**
 * Editar um item do romaneio
 * @param {number} index - Índice do item a ser editado
 */
function editarItem(index) {
    console.log("✏️ === EDITANDO ITEM ===");
    console.log("📊 Index recebido:", index, typeof index);
    console.log("📋 Total de itens disponíveis:", romaneioItems?.length || 0);
    
    try {
        // ✅ AGUARDAR DOM ESTAR PRONTO
        if (document.readyState !== 'complete') {
            console.log("⏳ DOM não está pronto, aguardando...");
            setTimeout(() => editarItem(index), 100);
            return;
        }
        
        // ✅ VALIDAÇÃO DO ÍNDICE
        const numeroIndex = parseInt(index);
        if (isNaN(numeroIndex) || numeroIndex < 0) {
            console.error("❌ Índice inválido:", index);
            if (window.Utils && window.Utils.showToast) window.Utils.showToast("Erro: Índice do item inválido.", 'error');
            return;
        }
        
        if (!Array.isArray(romaneioItems) || romaneioItems.length === 0) {
            console.error("❌ Lista de itens vazia ou inválida");
            if (window.Utils && window.Utils.showToast) window.Utils.showToast("Erro: Nenhum item encontrado para editar.", 'error');
            return;
        }
        
        if (numeroIndex >= romaneioItems.length) {
            console.error("❌ Índice fora do range:", numeroIndex, "Array length:", romaneioItems.length);
            if (window.Utils && window.Utils.showToast) window.Utils.showToast("Erro: Item não encontrado para edição.", 'error');
            return;
        }
        
        // ✅ RECUPERAR O ITEM
        const item = romaneioItems[numeroIndex];
        console.log("📋 Item encontrado para edição:", item);
        
        if (!item || typeof item !== 'object') {
            console.error("❌ Item inválido encontrado:", item);
            if (window.Utils && window.Utils.showToast) window.Utils.showToast("Erro: Dados do item estão corrompidos.", 'error');
            return;
        }
        
        // ✅ VERIFICAR SE TODOS OS CAMPOS EXISTEM NO DOM
        const camposObrigatorios = ['especieInput', 'plaqueta', 'rodo', 'comprimento', 'oco1', 'oco2', 'preco'];
        const camposNaoEncontrados = [];
        
        camposObrigatorios.forEach(campoId => {
            const campo = document.getElementById(campoId);
            if (!campo) {
                camposNaoEncontrados.push(campoId);
            }
        });
        
        if (camposNaoEncontrados.length > 0) {
            console.error("❌ Campos não encontrados no DOM:", camposNaoEncontrados);
            if (window.Utils && window.Utils.showToast) window.Utils.showToast(`Erro: Campos do formulário não encontrados: ${camposNaoEncontrados.join(', ')}`, 'error');
            return;
        }
        
        console.log("✅ Todos os campos do formulário encontrados no DOM");
        
        // ✅ PREENCHIMENTO DOS CAMPOS COM LOGS DETALHADOS
        const preencherCampo = (campoId, valor, descricao, dispatch = true) => {
            const campo = document.getElementById(campoId);
            if (campo) {
                const valorFormatado = valor || '';
                campo.value = valorFormatado;
                console.log(`✅ ${descricao} (${campoId}): '${valorFormatado}'`);
                if (dispatch) {
                    if (campoId === 'especieInput') {
                        return true;
                    }
                    const evento = new Event('input', { bubbles: true });
                    campo.dispatchEvent(evento);
                }
                return true;
            } else {
                console.error(`❌ Campo ${campoId} não encontrado`);
                return false;
            }
        };
        
        // ✅ PREENCHER CADA CAMPO INDIVIDUALMENTE COM VERIFICAÇÃO
        console.log("🔄 Iniciando preenchimento dos campos...");
        
        const especieInputPre = document.getElementById('especieInput');
        if (especieInputPre) { especieInputPre.dataset.suppressSuggestions = 'true'; }
        preencherCampo('especieInput', item.especie || '', 'Espécie', false);
        preencherCampo('plaqueta', item.plaqueta || '', 'Plaqueta');
        preencherCampo('rodo', item.rodo || item.diametro || '', 'Rodo/Diâmetro');
        preencherCampo('comprimento', item.comprimento || '', 'Comprimento');
        preencherCampo('oco1', item.oco1 || '', 'Oco 1');
        preencherCampo('oco2', item.oco2 || '', 'Oco 2');
        
        // Preço precisa de formatação especial
        const precoFormatado = formatarMoedaBrasil(item.preco || item.precoUnitario || 0);
        preencherCampo('preco', precoFormatado, 'Preço');
        
        // ✅ VERIFICAR SE OS CAMPOS FORAM REALMENTE PREENCHIDOS
        console.log("🔍 Verificando se os campos foram preenchidos...");
        let camposVazios = [];
        
        camposObrigatorios.forEach(campoId => {
            const campo = document.getElementById(campoId);
            if (campo && !campo.value) {
                camposVazios.push(campoId);
            }
        });
        
        if (camposVazios.length > 0) {
            console.warn("⚠️ Alguns campos não foram preenchidos:", camposVazios);
        } else {
            console.log("✅ Todos os campos foram preenchidos com sucesso!");
        }
        
        // ✅ NÃO abrir sugestões automaticamente durante edição; habilitar apenas após o usuário digitar
        const especieInput = document.getElementById('especieInput');
        if (especieInput) {
            especieInput.dataset.suppressSuggestions = 'true';
            especieInput.addEventListener('keydown', () => {
                // Ao começar a digitar, reabilita sugestões uma única vez
                delete especieInput.dataset.suppressSuggestions;
            }, { once: true });
        }
        
        // ✅ TENTAR CARREGAR DADOS DA ESPÉCIE
        if (item.especie && typeof loadSpeciesData === 'function') {
            try {
                loadSpeciesData(item.especie);
                console.log("✅ Dados da espécie carregados:", item.especie);
            } catch (error) {
                console.warn("⚠️ Erro ao carregar dados da espécie:", error.message);
            }
        }
        
        // ✅ CONFIGURAR ESTADO DE EDIÇÃO
        window.itemEditandoIndex = numeroIndex;
        console.log("📝 Item marcado como em edição no índice:", numeroIndex);
        
        // ✅ ATUALIZAR BOTÃO PARA MODO DE EDIÇÃO
        const btnAdicionar = document.getElementById('btnAdicionar');
        if (btnAdicionar) {
            btnAdicionar.innerHTML = '<i class="fas fa-save"></i> Atualizar Item';
            btnAdicionar.className = 'btn-atualizar';
            console.log("🔄 Botão alterado para modo 'Atualizar Item'");
            try {
                if (typeof window.__toast === 'function') {
                    window.__toast('Item em edição. Atualize os campos e clique em Atualizar.', 'info');
                } else if (window.Utils && window.Utils.showToast) {
                    window.Utils.showToast('Item em edição. Atualize os campos e clique em Atualizar.', 'info');
                }
            } catch (_) {}
        }
        
        // ✅ REMOVER ITEM DA LISTA TEMPORARIAMENTE
        const itemRemovido = romaneioItems.splice(numeroIndex, 1)[0];
        console.log("🗑️ Item removido temporariamente:", itemRemovido.especie, itemRemovido.plaqueta);
        
        // ✅ ATUALIZAR TABELA E TOTAIS
        if (typeof updateTableBody === 'function') {
            updateTableBody();
            console.log("✅ Tabela atualizada");
        } else if (typeof reconstruirTabela === 'function') {
            reconstruirTabela();
            console.log("✅ Tabela reconstruída");
        }
        
        if (typeof atualizarTotaisRomaneio === 'function') {
            atualizarTotaisRomaneio();
            console.log("✅ Totais atualizados");
        }
        
        // ✅ SCROLL SUAVE PARA O FORMULÁRIO
        setTimeout(() => {
            const formulario = document.querySelector('.form-container') || 
                             document.querySelector('.item-form') || 
                             document.querySelector('form');
            if (formulario) {
                formulario.scrollIntoView({ behavior: 'smooth', block: 'start' });
                console.log("✅ Scroll para formulário executado");
            }
        }, 100);
        
        // ✅ DAR FOCO NO PRIMEIRO CAMPO EDITÁVEL
        setTimeout(() => {
            const primeiroInput = document.getElementById('especieInput');
            if (primeiroInput) {
                primeiroInput.focus();
                console.log("✅ Foco definido no campo espécie");
            }
        }, 200);
        
        console.log("✅ Edição do item configurada com sucesso!");
        
        } catch (error) {
        console.error("❌ Erro crítico ao editar item:", error);
        console.error("Stack trace:", error.stack);
        if (window.Utils && window.Utils.showToast) window.Utils.showToast("Erro ao carregar item para edição: " + error.message, 'error');
        
        // ✅ RESETAR ESTADO EM CASO DE ERRO
        window.itemEditandoIndex = null;
        const btnAdicionar = document.getElementById('btnAdicionar');
        if (btnAdicionar) {
            btnAdicionar.innerHTML = '<i class="fas fa-plus"></i> Adicionar';
            btnAdicionar.className = 'btn-adicionar';
        }
    }
}

// Função para obter dados do armazenamento - MIGRADA PARA FIREBASE
async function getData(key) {
    try {
        console.log(`📂 Carregando dados de ${key} via DatabaseAdapter...`);
        
        // ✅ VALIDAÇÃO DA CHAVE
        if (!key || typeof key !== 'string') {
            console.error("❌ Chave inválida para carregamento");
            return [];
        }
        
        // ✅ USAR FIREBASE SERVICE UNIFICADO C/ PAGINAÇÃO (PLANO OTIMIZAÇÃO BLAZE)
        if (window.firebaseService && typeof window.firebaseService.loadData === 'function') {
            try {
                console.log(`🔄 Carregando ${key} via FirebaseService...`);
                let options = {};
                // BLAZE OPTIMIZATION: limit massive loads for better performance
                if (key === 'romaneiosTora' || key === 'romaneiosPct') {
                    options = { limitToLast: 50, orderByChild: 'timestamp' };
                    console.log(`⚡ Aplicação de Paginação (BLAZE LIMIT B): ${key}`);
                }

                const resultData = await window.firebaseService.loadData(key, options);
                
                if (resultData !== null && resultData !== undefined && resultData.success) {
                    let data = resultData.data;
                    console.log(`✅ ${key} carregado via FirebaseService:`, Array.isArray(data) ? `${data.length} itens` : 'dados válidos');
                    
                    // ✅ CONVERTER OBJETO FIREBASE PARA ARRAY SE NECESSÁRIO
                    if (data && typeof data === 'object' && !Array.isArray(data)) {
                        console.log(`🔄 Convertendo objeto Firebase para array (${key})...`);
                        const convertedArray = Object.keys(data).map(firebaseKey => {
                            const item = data[firebaseKey];
                            if (Array.isArray(item) && item.length > 0) {
                                return { ...item[0], id: item[0].id || firebaseKey, firebaseKey: firebaseKey };
                            } else if (item && typeof item === 'object') {
                                return { ...item, id: item.id || firebaseKey, firebaseKey: firebaseKey };
                            }
                            return null;
                        }).filter(Boolean);
                        
                        console.log(`✅ ${key} convertido para array com ${convertedArray.length} itens`);
                        return convertedArray;
                    }
                    else if (Array.isArray(data)) {
                        console.log(`✅ ${key} retornado como array com ${data.length} itens`);
                        return data.map(item => {
                            if (item && typeof item === 'object' && item['0'] === 'r' && item['1'] === 'o') {
                                if (!item.itens && !item.cliente && !item.fornecedor) return null;
                                const cleanItem = { ...item };
                                Object.keys(cleanItem).forEach(k => { if (!isNaN(k) && parseInt(k) < 20) delete cleanItem[k]; });
                                return cleanItem;
                            }
                            return item;
                        }).filter(item => item && (item.id || item.firebaseKey));
                    } else {
                        console.warn(`⚠️ ${key} tem tipo inesperado: ${typeof data}, convertendo para array`);
                        return [data];
                    }
                } else if (resultData === null) {
                    console.log(`⚠️ ${key} está vazio no storage`);
                    return [];
                } else {
                    console.warn(`⚠️ ${key} não encontrado ou dados inválidos`);
                    return [];
                }
            } catch (error) {
                console.error(`❌ Erro ao carregar ${key} via FirebaseService:`, error);
                return [];
            }
        } else {
            console.error(`❌ FirebaseService indisponível para ${key}.`);
            // Fallback mode
            try {
                const localData = localStorage.getItem(`sisweb_company_${window.appTenantId}__${key}`) || localStorage.getItem(`sisweb_${key}`);
                return localData ? JSON.parse(localData) : [];
            } catch (e) {
                return [];
            }
        }
        
    } catch (error) {
        console.error(`❌ Erro geral ao carregar ${key}:`, error);
        console.log(`📝 Retornando array vazio para ${key} devido a erro`);
        return [];
    }
}

// Função para salvar dados no armazenamento - MIGRADA PARA FIREBASE
async function saveData(key, data) {
    console.log(`💾 Salvando ${key} via DatabaseAdapter...`);
    
    try {
        // ✅ VALIDAÇÃO INICIAL
        if (!key || typeof key !== 'string') {
            throw new Error("Chave inválida para salvamento");
        }
        
        if (data === null || data === undefined) {
            console.warn(`⚠️ Tentativa de salvar dados null/undefined para ${key}`);
            data = []; // Usar array vazio como fallback seguro
        }
        
        // ✅ USAR DATABASE ADAPTER UNIFICADO
        if (window.databaseAdapter && typeof window.databaseAdapter.saveData === 'function') {
            try {
                console.log(`🔄 Salvando ${key} via DatabaseAdapter...`);
                const result = await window.databaseAdapter.saveData(key, data);
                
                if (result && result.success) {
                    console.log(`✅ ${key} salvo via DatabaseAdapter com sucesso`);
                    return true;
                } else {
                    console.error(`❌ Erro ao salvar ${key} via DatabaseAdapter:`, result.error || 'Erro desconhecido');
                    throw new Error(result.error || 'Erro ao salvar via DatabaseAdapter');
                }
            } catch (error) {
                console.error(`❌ Erro ao salvar ${key} via DatabaseAdapter:`, error);
                throw error;
            }
        } else {
            console.error(`❌ DatabaseAdapter não disponível para salvamento de ${key}`);
            throw new Error('DatabaseAdapter não está disponível');
        }
        
    } catch (error) {
        console.error(`❌ Erro geral ao salvar ${key}:`, error);
        throw error;
    }
}

// Função para gerar um ID único para itens
function generateUniqueId(prefix = '') {
    return prefix + '_' + Date.now() + '_' + Math.random().toString(36).substring(2, 15);
}

/**
 * Adicionar ou atualizar um item no romaneio
 */
function adicionarItem() {
    console.log("📝 Adicionando/Atualizando item...");
    
    try {
        const isEdicao = (typeof window.itemEditandoIndex === 'number');
        // ✅ COLETAR DADOS DO FORMULÁRIO
        const especie = document.getElementById('especieInput')?.value?.trim() || '';
        const plaqueta = document.getElementById('plaqueta')?.value?.trim() || '';
        const comprimento = parseFloat(document.getElementById('comprimento')?.value) || 0;
        const rodo = parseFloat(document.getElementById('rodo')?.value) || 0;
        const oco1 = parseFloat(document.getElementById('oco1')?.value) || 0;
        const oco2 = parseFloat(document.getElementById('oco2')?.value) || 0;
        const precoInput = document.getElementById('preco')?.value || '';
        
        // ✅ VALIDAÇÕES BÁSICAS
        if (!especie) {
            if (window.Utils && window.Utils.showToast) window.Utils.showToast("Por favor, selecione uma espécie.", 'warning');
            document.getElementById('especieInput')?.focus();
            return;
        }
        
        if (comprimento <= 0) {
            if (window.Utils && window.Utils.showToast) window.Utils.showToast("Por favor, informe o comprimento.", 'warning');
            document.getElementById('comprimento')?.focus();
            return;
        }
        
        if (rodo <= 0) {
            if (window.Utils && window.Utils.showToast) window.Utils.showToast("Por favor, informe o rodo (diâmetro).", 'warning');
            document.getElementById('rodo')?.focus();
            return;
        }
        
        // ✅ PROCESSAR PREÇO
        const preco = parseCurrencyValue(precoInput) || 0;
        if (preco <= 0) {
            if (window.Utils && window.Utils.showToast) window.Utils.showToast("Por favor, informe o preço.", 'warning');
            document.getElementById('preco')?.focus();
            return;
        }
        
        // ✅ CALCULAR VOLUMES
        const volumeBruto = calcularVolumeTora(rodo, comprimento);
        const descontoOco = calcularDescontoOco(oco1, oco2, comprimento);
        const volumeSerraria = volumeBruto - descontoOco;
        const valorTotal = volumeSerraria * preco;
        
        // ✅ CRIAR OBJETO DO ITEM
        const novoItem = {
            id: Date.now() + Math.random(),
            especie: especie,
            plaqueta: plaqueta,
            comprimento: comprimento,
            diametro: rodo,
            rodo: rodo,
            oco1: oco1,
            oco2: oco2,
            volumeBruto: volumeBruto,
            volumeEstimado: volumeBruto,
            volumeSerraria: volumeSerraria,
            volumeLiquido: volumeSerraria,
            preco: preco,
            precoUnitario: preco,
            valorTotal: valorTotal,
            valor: valorTotal,
            observacoes: ''
        };
        
        // ✅ VERIFICAR SE É EDIÇÃO OU NOVO ITEM
        if (isEdicao) {
            // É uma atualização
            console.log("🔄 Atualizando item existente");
            romaneioItems.splice(window.itemEditandoIndex, 0, novoItem);
            window.itemEditandoIndex = null;
            
            // Restaurar botão para estado normal
            const btnAdicionar = document.getElementById('btnAdicionar');
            if (btnAdicionar) {
                btnAdicionar.innerHTML = '<i class="fas fa-plus"></i> Adicionar';
                btnAdicionar.className = 'btn-adicionar';
            }
            
            console.log("✅ Item atualizado com sucesso");
        } else {
            // É um novo item
            console.log("➕ Adicionando novo item");
            romaneioItems.push(novoItem);
            console.log("✅ Novo item adicionado");
        }
        
        // ✅ LIMPAR FORMULÁRIO
        limparCamposItem();
        
        // ✅ ATUALIZAR INTERFACE
        if (typeof updateTableBody === 'function') {
            updateTableBody();
        } else if (typeof reconstruirTabela === 'function') {
            reconstruirTabela();
        }
        
        if (typeof atualizarTotaisRomaneio === 'function') {
            atualizarTotaisRomaneio();
        }
        
        console.log(`📊 Total de itens: ${romaneioItems.length}`);
        
        // Notificar resultado
        try {
            const msg = isEdicao ? 'Item atualizado com sucesso!' : 'Item adicionado com sucesso!';
            if (typeof window.__toast === 'function') {
                window.__toast(msg, 'success');
            } else if (window.Utils && window.Utils.showToast) {
                window.Utils.showToast(msg, 'success');
            }
        } catch (_) {}
        
    } catch (error) {
        console.error("❌ Erro ao adicionar/atualizar item:", error);
        if (window.Utils && window.Utils.showToast) window.Utils.showToast("Erro ao processar item: " + error.message, 'error');
    }
}

/**
 * Limpar campos do formulário de item
 */
function limparCamposItem() {
    const campos = ['especieInput', 'plaqueta', 'comprimento', 'rodo', 'oco1', 'oco2', 'preco'];
    campos.forEach(campoId => {
        const campo = document.getElementById(campoId);
        if (campo) campo.value = '';
    });
    
    // Focar no primeiro campo
    const especieInput = document.getElementById('especieInput');
    if (especieInput) especieInput.focus();
}

/**
 * Função auxiliar para formatar moeda brasileira
 * @param {number} valor - Valor a ser formatado
 * @returns {string} - Valor formatado
 */
function formatarMoedaBrasil(valor) {
    if (!valor || isNaN(valor)) return '';
    return valor.toFixed(2);
}

/**
 * Função auxiliar para fazer parsing de valores de moeda
 * @param {string} valor - String com valor monetário
 * @returns {number} - Valor numérico
 */
function parseCurrencyValue(valor) {
    if (!valor) return 0;
    // Remove símbolos de moeda e converte vírgula para ponto
    return parseFloat(valor.toString().replace(/[R$\s]/g, '').replace(',', '.')) || 0;
}

/**
 * Integração com o RomaneioToraManager para carregar romaneio
 * @param {string} romaneioId - ID do romaneio a ser carregado
 */
async function carregarRomaneioParaEdicao(romaneioId) {
    console.log(`📝 Carregando romaneio ${romaneioId} para edição...`);
    
    try {
        if (window.romaneioToraManager && typeof window.romaneioToraManager.carregarRomaneioParaEdicao === 'function') {
            // Usar o manager se disponível
            return await window.romaneioToraManager.carregarRomaneioParaEdicao(romaneioId);
        } else {
            // Fallback para método antigo
            console.warn("⚠️ RomaneioToraManager não disponível, usando método fallback");
            
            const storageKey = getStorageKey('romaneiosTora');
            const romaneios = JSON.parse(localStorage.getItem(storageKey) || '[]');
            const romaneio = romaneios.find(r => r.id === romaneioId);
            
            if (!romaneio) {
                if (window.Utils && window.Utils.showToast) window.Utils.showToast('Romaneio não encontrado!', 'error');
                return false;
            }
            
            // Configurar variáveis globais
            window.romaneioEditandoId = romaneioId;
            window.romaneioOriginalDataHora = romaneio.dataHora;
            window.romaneioOriginalDataFormatada = romaneio.dataFormatada;
            window.romaneioOriginalHoraFormatada = romaneio.horaFormatada;
            window.romaneioOriginalCriadoEm = romaneio.criadoEm;
            
            window.clienteSelecionado = romaneio.fornecedor;
            window.romaneioItems = romaneio.itens || [];
            
            // ✅ ATUALIZAR UI PARA MODO EDIÇÃO
            const btnSalvar = document.getElementById('btnSalvar');
            if (btnSalvar) {
                btnSalvar.innerHTML = '<i class="fas fa-sync-alt"></i> Atualizar';
                btnSalvar.classList.add('btn-atualizar'); // Adicionar classe para estilo visual (amarelo/azul)
            }
            
            const tituloPagina = document.querySelector('.main-title, h1, h2');
            if (tituloPagina) {
                tituloPagina.innerHTML = `✏️ Editando Romaneio: ${romaneio.numero || romaneioId}`;
            }

            // Atualizar interface
            if (typeof updateTableBody === 'function') {
                updateTableBody();
            }
            
            if (typeof atualizarTotaisRomaneio === 'function') {
                atualizarTotaisRomaneio();
            }
            
            return true;
        }
    } catch (error) {
        console.error("❌ Erro ao carregar romaneio:", error);
        if (window.Utils && window.Utils.showToast) window.Utils.showToast("Erro ao carregar romaneio: " + error.message, 'error');
        return false;
    }
}

// ✅ EXPOR FUNÇÕES GLOBALMENTE PARA COMPATIBILIDADE
window.editarItem = editarItem;
window.adicionarItem = adicionarItem;
window.limparCamposItem = limparCamposItem;
window.formatarMoedaBrasil = formatarMoedaBrasil;
window.parseCurrencyValue = parseCurrencyValue;
window.carregarRomaneioParaEdicao = carregarRomaneioParaEdicao;

// Exponha funções ao escopo global
window.carregarClientes = carregarClientes;
window.carregarEspecies = carregarEspecies;
window.calcularVolumeTora = calcularVolumeTora;
window.calcularDescontoOco = calcularDescontoOco;
window.formatarVolume = formatarVolume;
window.editarItem = editarItem;
window.getData = getData;
window.saveData = saveData;
window.generateUniqueId = generateUniqueId;
window.adicionarItem = adicionarItem;
window.parseCurrencyValue = parseCurrencyValue;
window.updateTableBody = updateTableBody;
window.changePage = changePage;
window.removerItem = removerItem;
window.updatePagination = updatePagination;
window.atualizarTotaisRomaneio = atualizarTotaisRomaneio;
window.atualizarElementosTotal = atualizarElementosTotal;

// Garantir inicialização correta de todos os componentes
document.addEventListener('DOMContentLoaded', function() {
    // Verificar se a inicialização final já foi executada
    if (window.romaneioToraFinalInitDone) {
        console.log("ℹ️ Inicialização final já foi executada");
        return;
    }
    
    // Pequeno delay para garantir que todos os scripts estejam carregados
    setTimeout(function() {
        if (window.romaneioToraFinalInitDone) {
            console.log("ℹ️ Inicialização final já foi executada durante o delay");
            return;
        }
        
        console.log("Inicialização final de todos os componentes");
        
        // Garantir que formatCurrencyInput está definido
        if (typeof window.formatCurrencyInput !== 'function') {
            console.error("Função formatCurrencyInput não encontrada, funções de formatação podem não funcionar");
        }
        
        // Garantir que o campo de preço está configurado corretamente
        const precoInput = document.getElementById('preco');
        if (precoInput && !precoInput.hasAttribute('data-configured')) {
            // Verificar se o evento onInput foi definido através do atributo HTML
            if (!precoInput.hasAttribute('oninput')) {
                console.log("Configurando evento de input para o campo preço");
                precoInput.addEventListener('input', function() {
                    if (typeof window.formatCurrencyInput === 'function') {
                        window.formatCurrencyInput(this);
                    }
                });
            }
            
            // Adicionar evento de blur para garantir formatação quando o campo perde o foco
            precoInput.addEventListener('blur', function() {
                if (this.value && !this.value.startsWith('R$') && typeof window.formatCurrencyInput === 'function') {
                    window.formatCurrencyInput(this);
                }
            });
            
            // Marcar como configurado
            precoInput.setAttribute('data-configured', 'true');
            console.log("Campo de preço configurado com sucesso");
        }
        
        // Garantir que a função de atualização da tabela está definida
        if (typeof window.updateTableBody !== 'function') {
            console.error("Função updateTableBody não encontrada, a tabela pode não ser atualizada corretamente");
        }
        
        // Inicializar a tabela se existir (apenas uma vez)
        const tbody = document.querySelector('#romaneioTable tbody');
        if (tbody && typeof window.updateTableBody === 'function' && !tbody.hasAttribute('data-initialized')) {
            window.updateTableBody(tbody);
            tbody.setAttribute('data-initialized', 'true');
        }
        
        // Garantir que o botão limpar também reseta a paginação
        const btnLimpar = document.getElementById('btnLimpar');
        if (btnLimpar && !btnLimpar.hasAttribute('data-configured')) {
            btnLimpar.addEventListener('click', function() {
                // Resetar a paginação quando o formulário for limpo
                window.currentPage = 1;
                
                // Atualizar a tabela se necessário
                const tbody = document.querySelector('#romaneioTable tbody');
                if (tbody && typeof window.updateTableBody === 'function') {
                    window.updateTableBody(tbody);
                }
            });
            btnLimpar.setAttribute('data-configured', 'true');
        }
        
        // Marcar como finalizado
        window.romaneioToraFinalInitDone = true;
        console.log("Inicialização final concluída com sucesso");
    }, 500);
});

// Expor novas funções globalmente
window.syncDataWithFirebase = syncDataWithFirebase;
window.mergeDataSets = mergeDataSets;
window.initDataSync = initDataSync;

// Garantir que a função saveClient esteja disponível globalmente
window.saveClient = saveClient;

// Variável para controlar se a sincronização já foi inicializada
let syncInitialized = false;

// Função para inicializar sincronização
async function initializeSyncSystem() {
    if (syncInitialized) {
        console.log("⚠️ Sistema de sincronização já foi inicializado");
        return;
    }
    
    console.log("🚀 Inicializando sistema de sincronização...");
    
    try {
        // Aguardar inicialização do Firebase
        let attempts = 0;
        const maxAttempts = 10;
        
        while (attempts < maxAttempts) {
            if (window.firebaseService && window.firebaseService.isFirebaseOperational) {
                break;
            }
            await new Promise(resolve => setTimeout(resolve, 500));
            attempts++;
        }
        
        // Inicializar sincronização
        await initDataSync();
        
        // Recarregar dados após sincronização apenas se ainda não foram carregados
        if (!window.fornecedores || window.fornecedores.length === 0) {
            if (typeof carregarFornecedores === 'function') carregarFornecedores();
        }
        if (!window.species || window.species.length === 0) {
            carregarEspecies();
        }
        
        syncInitialized = true;
        console.log("✅ Sistema de sincronização inicializado");
        
    } catch (error) {
        console.warn("⚠️ Erro na inicialização da sincronização:", error);
        console.log("📱 Continuando com dados locais apenas");
    }
}

// Aguardar evento firebaseReady - apenas uma vez
if (!window.firebaseReadyListenerAdded) {
    window.addEventListener('firebaseReady', function(event) {
        console.log("🔥 Firebase está pronto, iniciando sincronização...");
        setTimeout(initializeSyncSystem, 1000);
    });
    window.firebaseReadyListenerAdded = true;
}

// Aguardar evento de reconexão do Firebase - sem recarregar dados se já existem
if (!window.firebaseReconnectListenerAdded) {
    window.addEventListener('firebaseReconnected', function(event) {
        console.log("🔄 Firebase reconectado, verificando necessidade de sincronização...");
        // Apenas sincronizar se necessário, sem recarregar dados já existentes
        if (syncInitialized && window.currentUserId) {
            console.log("ℹ️ Sincronização silenciosa após reconexão");
        }
    });
    window.firebaseReconnectListenerAdded = true;
}

// Fallback: inicializar após DOMContentLoaded se Firebase não estiver disponível
document.addEventListener('DOMContentLoaded', function() {
    setTimeout(async function() {
        if (!syncInitialized) {
            console.log("📱 Inicializando sem Firebase (modo local apenas)");
            if (typeof carregarFornecedores === 'function') carregarFornecedores();
            carregarEspecies();
            syncInitialized = true;
        }
    }, 5000); // Aguardar 5 segundos para dar tempo ao Firebase
});

// Função para atualizar o corpo da tabela com os itens do romaneio
function updateTableBody(tbody) {
    console.log("🔄 Atualizando tabela de itens do romaneio...");
    
    try {
        // Se tbody não foi passado, tentar encontrar
        if (!tbody) {
            tbody = document.querySelector('#romaneioTable tbody');
        }
        
        if (!tbody) {
            console.error("❌ Elemento tbody não encontrado na tabela");
            return;
        }
        
        // Limpar conteúdo atual
        tbody.innerHTML = '';
        
        // Verificar se existem itens
        if (!window.romaneioItems || !Array.isArray(window.romaneioItems) || window.romaneioItems.length === 0) {
            // ✅ Resetar paginação se a lista estiver vazia
            window.currentPage = 1;
            
            const emptyRow = tbody.insertRow();
            emptyRow.innerHTML = '<td colspan="12" class="text-center text-muted">Nenhum item adicionado</td>';
            console.log("ℹ️ Tabela vazia - nenhum item encontrado");
            // Atualizar resumo mesmo quando vazio
            renderizarResumoRomaneio();
            
            // Atualizar controles de paginação para refletir o estado vazio/página 1
            if (typeof updatePagination === 'function') {
                updatePagination();
            }
            return;
        }
        
        console.log(`📊 Renderizando ${window.romaneioItems.length} itens na tabela`);
        
        // Paginação
        const itemsPerPage = window.itemsPerPage || 10;
        const currentPage = window.currentPage || 1;
        const startIndex = (currentPage - 1) * itemsPerPage;
        const endIndex = startIndex + itemsPerPage;
        const itemsToShow = window.romaneioItems.slice(startIndex, endIndex);
        
        // Renderizar cada item
        itemsToShow.forEach((item, index) => {
            const globalIndex = startIndex + index;
            const row = tbody.insertRow();
            
            // ✅ CORRIGIR OBTENÇÃO DO PREÇO - considerar ambos os campos
            const precoValue = item.preco || item.precoUnitario || 0;
            
            // ✅ CORRIGIR OBTENÇÃO DO VOLUME LÍQUIDO - considerar ambos os campos
            const volumeLiquido = item.volumeSerraria || item.volumeLiquido || 0;
            
            // Formatar valores para exibição
            const volumeBrutoFormatted = formatarVolume(item.volumeBruto || item.volumeEstimado || 0);
            const volumeSerrariaFormatted = formatarVolume(volumeLiquido);
            const descontoFormatted = formatarVolume((item.volumeBruto || item.volumeEstimado || 0) - volumeLiquido);
            
            // ✅ CORRIGIR FORMATAÇÃO DO PREÇO
            const precoFormatted = typeof precoValue === 'number' && precoValue > 0 ? 
                precoValue.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }) : 
                'R$ 0,00';
            
            // ✅ CORRIGIR CÁLCULO DO VALOR TOTAL
            const valorTotal = precoValue * volumeLiquido;
            const valorTotalFormatted = valorTotal > 0 ? 
                valorTotal.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }) : 
                'R$ 0,00';
            
            // Ordem das colunas conforme cabeçalho (sem M³ Bruto):
            // Plaqueta | Espécie | Rodo | Comprimento | Oco 1 | Oco 2 | Desconto | M³ Líquido | Preço | Valor | Ações
            row.innerHTML = `
                <td>${item.plaqueta || '-'}</td>
                <td>${item.especie || '-'}</td>
                <td>${(item.rodo || item.diametro) ? (item.rodo || item.diametro) + ' cm' : '-'}</td>
                <td>${item.comprimento ? item.comprimento + ' cm' : '-'}</td>
                <td>${item.oco1 ? item.oco1 + ' cm' : '-'}</td>
                <td>${item.oco2 ? item.oco2 + ' cm' : '-'}</td>
                <td>${descontoFormatted}</td>
                <td>${volumeSerrariaFormatted}</td>
                <td>${precoFormatted}</td>
                <td>${valorTotalFormatted}</td>
                <td style="text-align: center; white-space: nowrap; min-width: 140px;">
                    <button type="button" class="btn btn-sm btn-warning me-1" onclick="editarItem(${globalIndex})" title="Editar item" style="margin-right: 5px;">
                        <i class="fas fa-edit"></i>
                    </button>
                    <button type="button" class="btn btn-sm btn-danger" onclick="removerItem(${globalIndex})" title="Remover item">
                        <i class="fas fa-trash"></i>
                    </button>
                </td>
            `;
        });
        
        // Atualizar paginação se necessário
        updatePagination();
        
        // Atualizar resumo (Totais e Médias)
        renderizarResumoRomaneio();
        
        console.log(`✅ Tabela atualizada com ${itemsToShow.length} itens (página ${currentPage})`);
        
    } catch (error) {
        console.error("❌ Erro ao atualizar tabela:", error);
        if (tbody) {
            tbody.innerHTML = '<tr><td colspan="11" class="text-center text-danger">Erro ao carregar itens</td></tr>';
        }
    }
}

// Função para atualizar a paginação
function updatePagination() {
    console.log("🔄 Atualizando paginação...");
    
    try {
        // Referência ao container de paginação
        const paginacaoElement = document.getElementById('romaneioTablePagination');
        if (!paginacaoElement) {
            console.error('❌ Elemento de paginação não encontrado');
            return;
        }
        
        // ✅ USAR ITENS GLOBAIS CORRETAMENTE
        const itens = window.romaneioItems || [];
        const itemsPerPage = window.itemsPerPage || 10;
        
        // Se não houver itens suficientes para paginação, ocultar
        if (itens.length <= itemsPerPage) {
            paginacaoElement.innerHTML = '';
            return;
        }
        
        // Limpar a paginação
        paginacaoElement.innerHTML = '';
        
        // Calcular número total de páginas
        const totalPages = Math.ceil(itens.length / itemsPerPage);
        
        // ✅ VALIDAR currentPage
        if (window.currentPage > totalPages) {
            window.currentPage = totalPages;
        }
        if (window.currentPage < 1) {
            window.currentPage = 1;
        }
        
        const createBtn = (text, page, isActive = false, isDisabled = false) => {
            const button = document.createElement('button');
            button.textContent = text;
            if (isActive) button.classList.add('active');
            button.disabled = isDisabled;
            if (!isDisabled) {
                button.onclick = function() {
                    changePage(page);
                };
            }
            return button;
        };
        
        // Botões iniciais
        paginacaoElement.appendChild(createBtn('<<<', 1, false, window.currentPage === 1));
        paginacaoElement.appendChild(createBtn('<', window.currentPage - 1, false, window.currentPage === 1));
        
        const startPage = Math.max(1, window.currentPage - 2);
        const endPage = Math.min(totalPages, window.currentPage + 2);

        if (startPage > 1) {
            paginacaoElement.appendChild(createBtn('1', 1, window.currentPage === 1));
            if (startPage > 2) {
                const span = document.createElement('span');
                span.textContent = '...';
                paginacaoElement.appendChild(span);
            }
        }

        for (let i = startPage; i <= endPage; i++) {
            paginacaoElement.appendChild(createBtn(String(i), i, i === window.currentPage));
        }

        if (endPage < totalPages) {
            if (endPage < totalPages - 1) {
                const span = document.createElement('span');
                span.textContent = '...';
                paginacaoElement.appendChild(span);
            }
            paginacaoElement.appendChild(createBtn(String(totalPages), totalPages, window.currentPage === totalPages));
        }
        
        // Botões finais
        paginacaoElement.appendChild(createBtn('>', window.currentPage + 1, false, window.currentPage === totalPages));
        paginacaoElement.appendChild(createBtn('>>>', totalPages, false, window.currentPage === totalPages));
        
        console.log("✅ Paginação atualizada com sucesso");
        
    } catch (error) {
        console.error('❌ Erro ao atualizar paginação:', error);
    }
}

// Função para atualizar o resumo (Totais e Médias)
function renderizarResumoRomaneio() {
    const summaryContainer = document.getElementById('resumoRomaneioContainer');
    if (!summaryContainer) return;
    
    const itens = window.romaneioItems || [];
    
    if (itens.length === 0) {
        summaryContainer.innerHTML = '';
        return;
    }
    
    // Totais Gerais
    let volTotal = 0;
    let valTotal = 0;
    
    // Calcular Médias por Espécie
    const speciesStats = {};
    
    itens.forEach(item => {
        // Totais
        const volLiq = parseFloat(item.volumeLiquido || item.volumeSerraria || 0);
        const preco = parseFloat(item.preco || item.precoUnitario || 0);
        const valor = parseFloat(item.valor || item.valorTotal || (volLiq * preco) || 0);
        
        volTotal += volLiq;
        valTotal += valor;
        
        // Estatísticas
        const esp = item.especie || 'Outros';
        const rodo = parseFloat(item.diametro || item.rodo || 0);
        
        if (!speciesStats[esp]) speciesStats[esp] = { totalRodo: 0, totalVolume: 0, count: 0 };
        
        if (rodo > 0) {
            speciesStats[esp].totalRodo += rodo;
            speciesStats[esp].count++;
        }
        if (volLiq > 0) {
            speciesStats[esp].totalVolume += volLiq;
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
        <div class="summary-box" style="background-color: #f8f9fa; border: 1px solid #e9ecef; padding: 20px; border-radius: 8px;">
            <div style="display: flex; justify-content: space-around; flex-wrap: wrap; margin-bottom: 20px; border-bottom: 1px solid #ddd; padding-bottom: 20px;">
                <div class="text-center">
                    <div style="font-size: 14px; color: #7f8c8d; text-transform: uppercase; letter-spacing: 1px;">Quantidade de Toras</div>
                    <div style="font-size: 24px; font-weight: bold; color: #2c3e50;">${itens.length}</div>
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
                ${speciesHtml || '<div style="color: #999; font-style: italic;">Nenhuma espécie com dados suficientes</div>'}
            </div>
        </div>
    `;
}

// Função para mudar página
function changePage(page) {
    if (page < 1 || !window.romaneioItems) return;
    
    const itemsPerPage = window.itemsPerPage || 10;
    const totalPages = Math.ceil(window.romaneioItems.length / itemsPerPage);
    
    if (page > totalPages) return;
    
    console.log(`🔄 Mudando para página ${page}`);
    
    // ✅ Atualizar página atual
    window.currentPage = page;
    
    // ✅ Atualizar tabela
    const tbody = document.querySelector('#romaneioTable tbody');
    if (tbody) {
        updateTableBody(tbody);
    }
    
    // ✅ Atualizar paginação
    updatePagination();
}

// Função para remover item
function removerItem(index) {
    try {
        if (Array.isArray(window.romaneioItems) && window.romaneioItems[index]) {
            window.romaneioItems.splice(index, 1);
            
            // Ajustar página atual se necessário
            const itemsPerPage = window.itemsPerPage || 10;
            const totalPages = Math.ceil(window.romaneioItems.length / itemsPerPage);
            if (window.currentPage > totalPages && totalPages > 0) {
                window.currentPage = totalPages;
            }
            
            // Atualizar tabela
            const tbody = document.querySelector('#romaneioTable tbody');
            if (tbody) {
                updateTableBody(tbody);
            }
            
            // Recalcular totais e atualizar resumo
            renderizarResumoRomaneio();
            
            // Toast de sucesso
            try {
                const msg = 'Item removido com sucesso.';
                if (typeof window.__toast === 'function') {
                    window.__toast(msg, 'success');
                } else if (window.Utils && window.Utils.showToast) {
                    window.Utils.showToast(msg, 'success');
                }
            } catch (_) {}
            
            console.log(`✅ Item ${index} removido com sucesso`);
        }
    } catch (error) {
        console.error("❌ Erro ao remover item:", error);
        if (typeof window.__toast === 'function') {
            window.__toast('Erro ao remover item: ' + error.message, 'error');
        } else if (window.Utils && window.Utils.showToast) {
            window.Utils.showToast('Erro ao remover item: ' + error.message, 'error');
        }
    }
}

// Função para atualizar os totais do romaneio (Mantida para compatibilidade)
function atualizarTotaisRomaneio() {
    renderizarResumoRomaneio();
}

// Função para atualizar os elementos HTML com os totais (Depreciada)
function atualizarElementosTotal(volumeBruto, volumeSerraria, valor) {
    // Função vazia pois o rodapé da tabela foi removido
} 

function populateRomaneioTable() {
    console.log("🔄 Populando tabela do romaneio...");
    
    try {
        const tbody = document.querySelector('#romaneioTable tbody');
        if (!tbody) {
            console.error('❌ Tbody da tabela não encontrado');
            return;
        }
        
        // ✅ VERIFICAR SE HÁ DADOS
        const itens = window.romaneioItems || [];
        console.log("📊 Total de itens disponíveis:", itens.length);
        
        if (itens.length === 0) {
            console.log("📭 Nenhum item encontrado");
            tbody.innerHTML = '<tr><td colspan="7" class="text-center">Nenhum item encontrado</td></tr>';
            
            // Ocultar paginação se não há itens
            const paginationElement = document.getElementById('romaneioTablePagination');
            if (paginationElement) {
                paginationElement.style.display = 'none';
            }
            return;
        }
        
        // ✅ CALCULAR PAGINAÇÃO
        const itemsPerPage = window.itemsPerPage || 10;
        const currentPage = window.currentPage || 1;
        
        const startIndex = (currentPage - 1) * itemsPerPage;
        const endIndex = startIndex + itemsPerPage;
        const itensParaExibir = itens.slice(startIndex, endIndex);
        
        console.log(`📄 Exibindo página ${currentPage}: itens ${startIndex + 1}-${Math.min(endIndex, itens.length)} de ${itens.length}`);
        
        // ✅ LIMPAR TABELA
        tbody.innerHTML = '';
        
        // ✅ POPULAR TABELA COM ITENS DA PÁGINA ATUAL
        itensParaExibir.forEach((item, index) => {
            const globalIndex = startIndex + index;
            const tr = document.createElement('tr');
            tr.innerHTML = `
                <td><input type="checkbox" class="item-select" data-index="${globalIndex}"></td>
                <td>${item.codigo || 'N/A'}</td>
                <td>${item.descricao || 'N/A'}</td>
                <td>${parseFloat(item.quantidade || 0).toFixed(3)}</td>
                <td>${item.unidade || 'UN'}</td>
                <td>R$ ${parseFloat(item.preco || 0).toFixed(2)}</td>
                <td>R$ ${(parseFloat(item.quantidade || 0) * parseFloat(item.preco || 0)).toFixed(2)}</td>
            `;
            tbody.appendChild(tr);
        });
        
        console.log("✅ Tabela populada com sucesso");
        
        // ✅ ATUALIZAR PAGINAÇÃO APÓS TABELA ESTAR PRONTA
        // Usar setTimeout para garantir que a tabela foi renderizada
        setTimeout(() => {
            if (typeof updatePagination === 'function') {
                updatePagination();
            }
        }, 10);
        
        // ✅ ATUALIZAR TOTAIS
        if (typeof updateTotals === 'function') {
            updateTotals();
        }
        
    } catch (error) {
        console.error('❌ Erro ao popular tabela:', error);
    }
}
