/*
 * Romaneio de Tora - Arquivo de modais e funÃ§Ãµes
 * Ãšltima atualizaÃ§Ã£o: 2023-06-12
 * VersÃ£o: 1.0.1
 * Nota: Arquivo limpo e consolidado
 */

console.log("Carregando romaneiotora_modais.js...");

// Sanitização de logs para corrigir mojibake de codificação
(function(){
    const map = new Map([
        ["ðŸ—'ï¸","📄"],
        ["ðŸ\"¥","🔥"],
        ["ðŸš«","⛔"],
        ["âœ…","✅"],
        ["âŒ","❌"],
        ["âš ï¸","⚠️"],
        ["ðŸŒ±","🌱"],
        ["ðŸŽ‰","🎉"],
        ["ðŸ\"‹","🔍"],
        ["ðŸ\"„","🔧"],
        ["ðŸ\"Š","📊"],
        ["ðŸ'°","🔸"],
        ["Ã¡","á"],["Ã©","é"],["Ãª","ê"],["Ã§","ç"],["Ã³","ó"],["Ãº","ú"],["Ã£","ã"],["Ãµ","õ"],["Ã","Ô"],["ÃŽ","Î"],["Ã“","Ó"],["Ã€","À"],["Ã",""],["â",""],["ï¸",""],["Â",""]
    ]);
    function fix(str){
        if (typeof str !== 'string') return str;
        let out = str;
        for (const [bad, good] of map.entries()) {
            if (out.indexOf(bad) !== -1) out = out.split(bad).join(good);
        }
        return out;
    }
    function sanitizeArgs(args){
        return Array.from(args).map(a => typeof a === 'string' ? fix(a) : a);
    }
    try {
        const _log = console.log.bind(console);
        const _warn = console.warn.bind(console);
        const _err = console.error.bind(console);
        console.log = (...args) => _log(...sanitizeArgs(args));
        console.warn = (...args) => _warn(...sanitizeArgs(args));
        console.error = (...args) => _err(...sanitizeArgs(args));
    } catch(_) {}
})();

(function(){
    const patterns = [
        [/AÃ§Ãµes/g,'Ações'],[/DescriÃ§Ã£o/g,'Descrição'],[/EspÃ©cies/g,'Espécies'],[/EspÃ©cie/g,'Espécie'],
        [/NÃƒO/g,'NÃO'],[/NÃ£o/g,'Não'],[/nÃ£o/g,'não'],
        [/exclusÃ£o/g,'exclusão'],[/ediÃ§Ã£o/g,'edição'],[/adiÃ§Ã£o/g,'adição'],
        [/carregaÃ§Ã£o/g,'carregação'],[/carregamento/g,'carregamento'],
        [/disponÃ­vel/g,'disponível'],[/possÃ­vel/g,'possível'],[/biblioteca/g,'biblioteca'],
        [/preÃ§o/g,'preço'],[/FormataÃ§Ã£o/g,'Formatação'],[/InicializaÃ§Ã£o/g,'Inicialização'],[/NavegaÃ§Ã£o/g,'Navegação'],
        [/Ãºltimo/g,'último'],[/Ãºnico/g,'único'],[/Ã©/g,'é'],[/Ãº/g,'ú'],[/Ã¢/g,'â'],[/Ãª/g,'ê'],[/Ã§/g,'ç'],[/Ã£/g,'ã'],[/Ãµ/g,'õ'],
        [/Ã/g,'Á'],[/Ã‰/g,'É'],[/Ã/g,'Í'],[/Ã“/g,'Ó'],[/Ãš/g,'Ú'],[/Ã‡/g,'Ç']
    ];
    function fixText(s){ try { let out = String(s); for (const [re,rep] of patterns) out = out.replace(re,rep); return out; } catch(_) { return s; } }
    function sanitizeNode(node){
        if (!node) return;
        if (node.nodeType === Node.TEXT_NODE) {
            node.nodeValue = fixText(node.nodeValue);
        } else if (node.nodeType === Node.ELEMENT_NODE) {
            // Sanitizar atributos comuns
            try {
                const attrs = node.attributes;
                if (attrs) {
                    for (let i=0;i<attrs.length;i++) {
                        const a = attrs[i];
                        const val = a.value;
                        const fixed = fixText(val);
                        if (fixed !== val) node.setAttribute(a.name, fixed);
                    }
                }
            } catch(_) {}
            const children = node.childNodes;
            for (let i=0;i<children.length;i++){ sanitizeNode(children[i]); }
        }
    }
    try {
        if (document && document.body) {
            sanitizeNode(document.body);
            const mo = new MutationObserver(muts => {
                muts.forEach(m => {
                    if (m.addedNodes) m.addedNodes.forEach(n => sanitizeNode(n));
                    if (m.target && m.attributeName) sanitizeNode(m.target);
                });
            });
            mo.observe(document.body, { childList: true, subtree: true, attributes: true });
        }
    } catch(_) {}
})();

// Sanitização de textos de diálogos (alert/confirm/prompt)
(function(){
    const repl = [
        [/ImpressÃ£o/g,'Impressão'],[/nÃ£o/g,'não'],[/NÃ£o/g,'Não'],[/Fornecedores/g,'Fornecedores'],[/EspÃ©cie/g,'Espécie'],[/EspÃ©cies/g,'Espécies'],[/FunÃ§Ã£o/g,'Função'],[/adiÃ§Ã£o/g,'adição'],[/exclusÃ£o/g,'exclusão'],[/ediÃ§Ã£o/g,'edição'],[/carregamento/g,'carregamento'],[/disponÃ­vel/g,'disponível'],[/possÃ­vel/g,'possível'],[/biblioteca/g,'biblioteca']
    ];
    function sanitizeText(s){ try { let t = String(s); for (const [re,rep] of repl) t = t.replace(re,rep); t = t.replace(/âŒ/g,'❌').replace(/âœ…/g,'✅').replace(/âš ï¸/g,'⚠️'); return t; } catch(_) { return s; } }
    try {
        if (window.alert) { const _a = window.alert.bind(window); window.alert = (msg)=>_a(sanitizeText(msg)); }
        if (window.confirm) { const _c = window.confirm.bind(window); window.confirm = (msg)=>_c(sanitizeText(msg)); }
        if (window.prompt) { const _p = window.prompt.bind(window); window.prompt = (msg, def)=>_p(sanitizeText(msg), def); }
    } catch(_) {}
})();

// Fallback seguro para impressão Tora usando módulo padronizado ou função local
if (typeof window !== 'undefined' && !window.imprimirRomaneioTora) {
    window.imprimirRomaneioTora = function(romaneioId, tipo) {
        try {
            // Fechar quaisquer dropdowns de impressão visíveis antes de imprimir
            try {
                if (typeof fecharTodosDropdownsImpressao === 'function') {
                    // Fechamento imediato para não interferir na impressão
                    fecharTodosDropdownsImpressao(true);
                } else {
                    const dd = document.querySelectorAll('.dropdown-menu');
                    dd.forEach(d => { d.classList.remove('show'); d.style.display = 'none'; });
                }
            } catch (_) {}

            if (window.ImprimirRomaneio && typeof window.ImprimirRomaneio.imprimirRomaneioTora === 'function') {
                return window.ImprimirRomaneio.imprimirRomaneioTora(romaneioId, tipo);
            }
            if (typeof imprimirRomaneio === 'function') {
                return imprimirRomaneio(romaneioId, tipo);
            }
            console.error('Função de impressão Tora não disponível');
            try {
                if (typeof window.__toast === 'function') {
                    window.__toast('Impressão Tora não disponível nesta página.', 'error', { duration: 5000 });
                } else if (window.Utils && window.Utils.showToast) {
                    window.Utils.showToast('Impressão Tora não disponível nesta página.', 'error');
                }
            } catch (_) {}
        } catch (err) {
            console.warn('Erro na impressão Tora; fallback para local', err);
            if (typeof imprimirRomaneio === 'function') {
                return imprimirRomaneio(romaneioId, tipo);
            }
        }
    };
}

/**
 * Funções relacionadas aos modais do sistema Romaneio Tora
 */

// Função para gerar IDs únicos
function generateUniqueId(prefix = '') {
    const timestamp = new Date().getTime();
    const random = Math.floor(Math.random() * 10000);
    return `${prefix}${timestamp}${random}`;
}

// ✅ CORREÇÃO DEFINITIVA DAS FUNÇÕES DE ARMAZENAMENTO
async function saveData(key, data) {
    console.log(`💾 === SALVAMENTO INICIADO ===`);
    console.log(`🔎 Chave: ${key}`);
    console.log(`📦 Dados:`, data);
    console.log(`🧵 Stack trace:`, new Error().stack);
    
    try {
        // ✅ VALIDAÇÃO INICIAL: Verificar se os dados são válidos
        if (!key || typeof key !== 'string') {
            throw new Error("Chave inválida para salvamento");
        }
        
        if (data === null || data === undefined) {
            console.warn(`⚠️ Tentativa de salvar dados null/undefined para ${key}`);
            data = []; // Usar array vazio como fallback seguro
        }
        
        // ✅ VERIFICAR SE ESTAMOS EM OPERAÇÃO DE EXCLUSÃO
        if (window.deletingRomaneio && key === 'romaneiosTora') {
            console.log("⛔ BLOQUEANDO SALVAMENTO durante operação de exclusão");
            return false;
        }
        
        // ✅ Normalizar chaves: mapear 'clientesTora' para 'fornecedores'; manter demais
        let finalKey = key;
        if (key === 'clientesTora') {
            finalKey = 'fornecedores';
            console.log(`🔧 Normalizando chave '${key}' → 'fornecedores'`);
        }
        const storageKey = getStorageKey(finalKey);
        const allowLegacy = storageKey === finalKey;
        
        // ✅ SERIALIZAR DADOS ANTECIPADAMENTE PARA DETECTAR PROBLEMAS
        let serializedData;
        try {
            serializedData = JSON.stringify(data);
            console.log(`✅ Dados serializados com sucesso: ${serializedData.length} caracteres`);
        } catch (serializationError) {
            console.error(`❌ Erro na serialização de ${finalKey}:`, serializationError);
            throw new Error(`Dados não podem ser serializados: ${serializationError.message}`);
        }
        
        // ✅ SALVAR NO FIREBASE PRIMEIRO (PRIORIDADE)
        if (window.firebaseService && typeof window.firebaseService.saveToFirebase === 'function') {
            try {
                console.log(`🔥 Salvando ${finalKey} no Firebase...`);
                const result = await window.firebaseService.saveToFirebase(finalKey, null, data);
                
                if (result && result.success) {
                    console.log(`✅ ${finalKey} salvo no Firebase com sucesso`);
                    
                    // ✅ BACKUP NO LOCALSTORAGE APENAS COMO CACHE (SÓ SE NÃO FOR EXCLUSÃO)
                    if (!window.deletingRomaneio) {
                        try {
                            persistLocalValue(storageKey, data);
                            console.log(`✅ Cache local de ${storageKey} atualizado`);
                        } catch (localError) {
                            console.warn(`⚠️ Cache local falhou para ${finalKey}:`, localError);
                        }
                    } else {
                        console.log('⛔ Cache local NÃO atualizado durante exclusão');
                    }
                    
                    return true;
                } else {
                    console.warn(`⚠️ Firebase retornou resultado inválido para ${finalKey}:`, result);
                    throw new Error('Firebase retornou resultado inválido');
                }
            } catch (firebaseError) {
            console.warn(`⚠️ Erro ao salvar ${finalKey} no Firebase: ${firebaseError.message}`);
                console.warn("IMPORTANTE: Firebase nao esta funcionando corretamente");
                throw firebaseError; // MODO 100% FIREBASE: Se Firebase falhar, falhar completamente
            }
        } else {
            console.error(`❌ Firebase Service não disponível para salvamento de ${finalKey}`);
            throw new Error('Firebase Service não está disponível');
        }
        
    } catch (error) {
        console.error(`❌ Erro geral ao salvar ${key}:`, error);
        throw error; // ✅ MODO 100% FIREBASE: Propagar erro sem fallbacks
    }
}

function getStorageKey(baseKey) {
    try {
        const svc = window.firebaseService || window.FirebaseService;
        if (svc && typeof svc.getCurrentTenantId === 'function') {
            const t = svc.getCurrentTenantId();
            if (t) return `companies/${t}/${baseKey}`;
        }
        if (svc && typeof svc.getCurrentUid === 'function') {
            const uid = svc.getCurrentUid();
            if (uid) return `users/${uid}/${baseKey}`;
        }
    } catch (_) {}
    try {
        if (window.appTenantId) return `companies/${String(window.appTenantId)}/${baseKey}`;
        const stored = localStorage.getItem('company_info');
        if (stored) {
            const obj = JSON.parse(stored);
            const id = obj && (obj.id || obj.companyId || obj.slug || obj.nome || obj.name);
            if (id) return `companies/${String(id)}/${baseKey}`;
        }
    } catch (_) {}
    return baseKey;
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

async function getData(key) {
    console.log(`📦 Carregando dados de ${key}...`);
    
    try {
        // ✅ VALIDAÇÃO DA CHAVE
        if (!key || typeof key !== 'string') {
            console.error("❌ Chave inválida para carregamento");
            return [];
        }
        
        // ✅ Normalizar chaves: mapear 'clientesTora' para 'fornecedores'; manter demais
        let finalKey = key;
        if (key === 'clientesTora') {
            finalKey = 'fornecedores';
            console.log(`🔧 Normalizando chave '${key}' → 'fornecedores'`);
        }
        
        let data = null;
        const storageKey = getStorageKey(finalKey);
        
        // ✅ CARREGAR APENAS DO FIREBASE (100% FIREBASE)
        if (window.firebaseService && typeof window.firebaseService.loadFromFirebase === 'function') {
            try {
                console.log(`🔥 Carregando ${finalKey} do Firebase...`);
                const result = await window.firebaseService.loadFromFirebase(finalKey);
                
                if (result && result.success && result.data !== null && result.data !== undefined) {
                    data = result.data;
                    console.log(`✅ ${finalKey} carregado do Firebase:`, Array.isArray(data) ? `${data.length} itens` : 'dados válidos');
                    
                    // âœ… ATUALIZAR CACHE LOCAL
                    try {
                        persistLocalValue(storageKey, data);
                        console.log(`✅ Cache local de ${storageKey} atualizado`);
                    } catch (cacheError) {
                        console.warn(`⚠️ Erro ao atualizar cache local:`, cacheError);
                    }
                    
                } else if (result && result.data === null) {
                    console.log(`⚠️ ${finalKey} está vazio no Firebase`);
                    data = [];
                } else {
                    console.warn(`⚠️ ${finalKey} não encontrado no Firebase ou dados inválidos`);
                    data = [];
                }
            } catch (firebaseError) {
                console.error(`❌ Erro ao carregar ${finalKey} do Firebase: ${firebaseError.message}`);
                
                // âœ… FALLBACK PARA CACHE LOCAL APENAS EM CASO DE ERRO
                try {
                    console.log(`🔧 Tentando cache local para ${finalKey}...`);
                    const localData = localStorage.getItem(storageKey) || (allowLegacy ? localStorage.getItem(finalKey) : null);
                    
                    if (localData) {
                        try {
                            data = JSON.parse(localData);
                            console.log(`âœ… ${finalKey} carregado do cache local:`, Array.isArray(data) ? `${data.length} itens` : 'dados vÃ¡lidos');
                        } catch (parseError) {
                            console.error(`âŒ Erro ao parsear ${finalKey} do cache local:`, parseError);
                            localStorage.removeItem(storageKey);
                            if (allowLegacy) localStorage.removeItem(finalKey);
                            data = [];
                        }
                    } else {
                        console.log(`🔹 ${finalKey} não encontrado no cache local`);
                        data = [];
                    }
                } catch (localError) {
                    console.error(`âŒ Erro ao acessar cache local para ${finalKey}:`, localError);
                    data = [];
                }
            }
        } else {
            console.error(`❌ Firebase Service não disponível para ${finalKey}`);
            
            // âœ… ÃšLTIMO RECURSO: CACHE LOCAL
            try {
                console.log(`🔧 Usando cache local como último recurso para ${finalKey}...`);
                const localData = localStorage.getItem(storageKey) || (allowLegacy ? localStorage.getItem(finalKey) : null);
                
                if (localData) {
                    try {
                        data = JSON.parse(localData);
                        console.log(`âœ… ${finalKey} carregado do cache local (Ãºltimo recurso):`, Array.isArray(data) ? `${data.length} itens` : 'dados vÃ¡lidos');
                    } catch (parseError) {
                        console.error(`âŒ Erro ao parsear ${finalKey} do cache local:`, parseError);
                        data = [];
                    }
                } else {
                    console.log(`ðŸ"± ${finalKey} nÃ£o encontrado no cache local`);
                    data = [];
                }
            } catch (localError) {
                console.error(`âŒ Erro ao acessar cache local para ${finalKey}:`, localError);
                data = [];
            }
        }
        
        // âœ… VALIDAÃ‡ÃƒO E NORMALIZAÃ‡ÃƒO DOS DADOS
        if (data === null || data === undefined) {
            console.log(`🔝 ${finalKey} não encontrado, retornando array vazio`);
            return [];
        }
        
        // Garantir que sempre retorne um tipo consistente
        if (Array.isArray(data)) {
            console.log(`✅ ${finalKey} retornado como array com ${data.length} itens`);
            return data;
        } else if (typeof data === 'object') {
            console.log(`✅ ${finalKey} retornado como objeto`);
            return data;
        } else {
            console.warn(`⚠️ ${finalKey} tem tipo inesperado: ${typeof data}, convertendo para array`);
            return [data];
        }
        
    } catch (error) {
        console.error(`âŒ Erro geral ao carregar ${key}:`, error);
        console.log(`ðŸ" Retornando array vazio para ${key} devido a erro`);
        return [];
    }
}

// FunÃ§Ã£o para abrir o modal de lista de fornecedores (especÃ­fico para romaneio de tora)
async function openFornecedorListModal() {
    console.log('Abrindo modal de lista de fornecedores - Romaneio Tora');
    
    let modal = document.getElementById('clientListModal');
    
    if (!modal) {
        console.log('Modal não encontrado, criando novo modal...');
        modal = document.createElement('div');
        modal.id = 'clientListModal';
        modal.className = 'modal';
        
        modal.innerHTML = `
            <div class="modal-content">
                <div class="modal-header">
                    <h3 class="modal-title">Lista de Fornecedores</h3>
                    <span class="close-modal" onclick="document.getElementById('clientListModal').style.display='none'">&times;</span>
                </div>
                <div class="modal-body">
                <input type="text" id="clientListFilter" placeholder="Filtrar fornecedores por nome, CNPJ, cidade..." 
                       style="margin: 10px 0; width: 100%; padding: 12px 15px; border: 2px solid #e0e0e0; border-radius: 8px; font-size: 14px; outline: none;">
                    <table class="table">
                        <thead>
                            <tr>
                                <th>Nome</th>
                                <th>CNPJ</th>
                                <th>Cidade</th>
                                <th>Estado</th>
                                <th>Telefone</th>
                                <th>Email</th>
                                <th style="text-align: center; width: 160px;">Ações</th>
                            </tr>
                        </thead>
                        <tbody id="clientListTable">
                            <!-- Preenchido via JavaScript -->
                        </tbody>
                    </table>
                </div>
                <div class="modal-footer">
                    <button type="button" class="back-button close-modal-btn" onclick="document.getElementById('clientListModal').style.display='none'">Fechar</button>
                    <button type="button" class="btn-save" onclick="openNewClientModal()">Novo Fornecedor</button>
                </div>
            </div>
        `;
        
        document.body.appendChild(modal);
        console.log("âœ… Modal criado com sucesso");
        
        // Configurar eventos de fechamento
        const closeBtn = modal.querySelector('.close-modal');
        if (closeBtn) {
            closeBtn.onclick = () => modal.style.display = 'none';
        }
        
        const closeBtns = modal.querySelectorAll('.close-modal-btn');
        closeBtns.forEach(btn => {
            btn.onclick = () => modal.style.display = 'none';
        });
        
        // Fechar modal ao clicar fora
        modal.addEventListener('click', (event) => {
            if (event.target === modal) {
                modal.style.display = 'none';
            }
        });
    }
    
    // ✅ CONFIGURAÇÃO DE FILTRO CORRIGIDA
    let filterInput = document.getElementById('clientListFilter');
    if (filterInput) {
        filterInput.value = '';
        
        // ✅ Usar addEventListener para melhor compatibilidade
        filterInput.addEventListener('input', (e) => {
            const filterValue = e.target.value;
            console.log(`🔍 Filtro de fornecedores aplicado: "${filterValue}"`);
            
            // Aplicar filtro e re-renderizar
            renderFornecedorList(filterValue);
        });
        
        // Tecla Escape para limpar filtro
        filterInput.addEventListener('keydown', (e) => {
            if (e.key === 'Escape') {
                e.target.value = '';
                renderFornecedorList('');
            }
        });
        
        console.log("✅ Event listeners do filtro de fornecedores configurados");
    } else {
        console.error("❌ Campo de filtro clientListFilter não encontrado");
    }
    
    console.log('Carregando lista de fornecedores...');
    await renderFornecedorList('');
    modal.style.display = 'block';
    
    setTimeout(() => {
        const filterInput = document.getElementById('clientListFilter');
        if (filterInput) filterInput.focus();
    }, 100);
    
    console.log("âœ… Modal de fornecedores aberto com sucesso");
}

// FunÃ§Ã£o para renderizar lista de fornecedores (especÃ­fica para romaneio de tora)
async function renderFornecedorList(filter = '') {
    console.log('=== RENDERIZANDO LISTA DE FORNECEDORES - ROMANEIO TORA ===');
    console.log('Filtro aplicado:', filter);
    
    const tableBody = document.getElementById('clientListTable');
    if (!tableBody) {
        console.error("âŒ Elemento #clientListTable nÃ£o encontrado");
        return;
    }
    
    let fornecedorList = [];
    
    try {
        console.log('=== CARREGAMENTO DIRETO DO FIREBASE - FORNECEDORES ===');
        
        // âœ… CARREGAMENTO CORRETO DO FIREBASE
        if (window.firebaseService && typeof window.firebaseService.loadFromFirebase === 'function') {
            try {
                console.log('Carregando fornecedores da coleção "fornecedores"...');
                const result = await window.firebaseService.loadFromFirebase('fornecedores');
                if (result && result.success) {
                    const count = result.data ? Object.keys(result.data).length : 0;
                    console.log(`✅ Dados carregados de fornecedores (edição): ${count} registro(s)`);
                }
                if (result && result.success) {
                    const count = result.data ? Object.keys(result.data).length : 0;
                    console.log(`✅ Dados carregados de fornecedores (seleção): ${count} registro(s)`);
                }
                if (result && result.success) {
                    const count = result.data ? Object.keys(result.data).length : 0;
                    console.log(`✅ Dados carregados de fornecedores: ${count} registro(s)`);
                }
                console.log("âœ… loadFromFirebase resultado completo:", result);
                
                if (result && result.success && result.data) {
                    const firebaseData = result.data;
                    console.log("âœ… Dados do Firebase encontrados:", firebaseData);
                    console.log("âœ… Tipo dos dados:", typeof firebaseData);
                    console.log("âœ… Ã‰ array?", Array.isArray(firebaseData));
                    console.log("âœ… Chaves do objeto:", Object.keys(firebaseData));
                    
                    // âœ… PROCESSAMENTO CORRETO - APENAS VALORES DIRETOS
                    Object.keys(firebaseData).forEach(clientId => {
                        const clientData = firebaseData[clientId];
                        console.log(`ðŸ"¦ Processando cliente ${clientId}:`, clientData);
                        
                        if (clientData && typeof clientData === 'object' && (clientData.nome || clientData.name)) {
                            const fornecedor = {
                                id: clientId,
                                originalId: clientData.id || clientId,
                                ...clientData
                            };
                            fornecedorList.push(fornecedor);
                            console.log(`âœ… Fornecedor adicionado: ${fornecedor.nome || fornecedor.name}`);
                        }
                    });
                    
                    console.log(`âœ… ${fornecedorList.length} fornecedores carregados do Firebase`);
                } else {
                    console.log("âš ï¸ Nenhum dado encontrado no Firebase ou estrutura invÃ¡lida");
                }
            } catch (error) {
                console.error("âŒ Erro no carregamento Firebase:", error);
            }
        } else {
            console.error("âŒ FirebaseService nÃ£o disponÃ­vel");
        }
        
    } catch (error) {
        console.error("âŒ Erro geral na obtenÃ§Ã£o de dados:", error);
    }
    
    console.log(`ðŸ"Š RESULTADO FINAL: ${fornecedorList.length} fornecedores para renderizar`);
    
    // Aplicar filtro
    if (filter && filter.trim() !== '') {
        const searchTerm = filter.toLowerCase();
        const originalLength = fornecedorList.length;
        fornecedorList = fornecedorList.filter(fornecedor => 
            (fornecedor.nome || fornecedor.name || '').toLowerCase().includes(searchTerm) || 
            (fornecedor.cnpj || '').toLowerCase().includes(searchTerm) ||
            (fornecedor.cidade || fornecedor.city || '').toLowerCase().includes(searchTerm) ||
            (fornecedor.estado || fornecedor.state || '').toLowerCase().includes(searchTerm) ||
            (fornecedor.telefone || fornecedor.phone || '').toLowerCase().includes(searchTerm) ||
            (fornecedor.email || '').toLowerCase().includes(searchTerm)
        );
        console.log(`ðŸ" Filtro aplicado: ${originalLength} -> ${fornecedorList.length} fornecedores`);
    }
    
    // Ordenar por nome
    fornecedorList.sort((a, b) => {
        const nameA = (a.nome || a.name || '').toLowerCase();
        const nameB = (b.nome || b.name || '').toLowerCase();
        return nameA.localeCompare(nameB, 'pt-BR');
    });
    
    // Limpar tabela
    tableBody.innerHTML = '';
    
    if (fornecedorList.length === 0) {
        const tr = document.createElement('tr');
        const td = document.createElement('td');
        td.setAttribute('colspan', '7');
        td.style.textAlign = 'center';
        td.style.padding = '20px';
        td.style.color = '#666';
        td.innerHTML = filter ? 
            '<i class="fas fa-search" style="margin-right: 8px;"></i>Nenhum fornecedor encontrado para o filtro aplicado' : 
            '<i class="fas fa-plus" style="margin-right: 8px;"></i>Nenhum fornecedor encontrado. Use "Novo Fornecedor" para cadastrar.';
        tr.appendChild(td);
        tableBody.appendChild(tr);
        console.log("ðŸ" Exibindo mensagem: nenhum fornecedor encontrado");
        return;
    }
    
    console.log(`âœ… Renderizando ${fornecedorList.length} fornecedores na tabela`);
    
    // âœ… RENDERIZAR TABELA COM DADOS ORGANIZADOS CORRETAMENTE
    fornecedorList.forEach((fornecedor, index) => {
        console.log(`  Renderizando fornecedor ${index + 1}:`, fornecedor);
        
        const tr = document.createElement('tr');
        tr.style.transition = 'background-color 0.2s ease';
        
        // âœ… ID SEGURO
        const fornecedorId = fornecedor.id || `temp_${index}`;
        
        // Nome (primeira coluna)
        const tdNome = document.createElement('td');
        tdNome.style.padding = '12px';
        tdNome.style.verticalAlign = 'middle';
        tdNome.style.fontWeight = '600';
        tdNome.textContent = fornecedor?.nome || fornecedor?.name || 'Sem nome';
        tr.appendChild(tdNome);
        
        // CNPJ (segunda coluna)
        const tdCnpj = document.createElement('td');
        tdCnpj.style.padding = '12px';
        tdCnpj.style.verticalAlign = 'middle';
        tdCnpj.style.fontFamily = 'monospace';
        tdCnpj.textContent = fornecedor?.cnpj || '';
        tr.appendChild(tdCnpj);
        
        // Cidade
        const tdCidade = document.createElement('td');
        tdCidade.style.padding = '12px';
        tdCidade.style.verticalAlign = 'middle';
        tdCidade.textContent = fornecedor?.cidade || fornecedor?.city || '';
        tr.appendChild(tdCidade);
        
        // Estado
        const tdEstado = document.createElement('td');
        tdEstado.style.padding = '12px';
        tdEstado.style.verticalAlign = 'middle';
        tdEstado.style.textAlign = 'center';
        tdEstado.style.fontWeight = 'bold';
        tdEstado.textContent = fornecedor?.estado || fornecedor?.state || '';
        tr.appendChild(tdEstado);
        
        // Telefone
        const tdTelefone = document.createElement('td');
        tdTelefone.style.padding = '12px';
        tdTelefone.style.verticalAlign = 'middle';
        tdTelefone.textContent = fornecedor?.telefone || fornecedor?.phone || '';
        tr.appendChild(tdTelefone);
        
        // Email
        const tdEmail = document.createElement('td');
        tdEmail.style.padding = '12px';
        tdEmail.style.verticalAlign = 'middle';
        tdEmail.style.fontSize = '13px';
        tdEmail.textContent = fornecedor?.email || '';
        tr.appendChild(tdEmail);
        
        // AÃ§Ãµes
        const tdAcoes = document.createElement('td');
        tdAcoes.style.padding = '12px';
        tdAcoes.style.verticalAlign = 'middle';
        tdAcoes.style.textAlign = 'center';
        
        const actionContainer = document.createElement('div');
        actionContainer.className = 'action-buttons-container';
        
        const btnSelecionar = document.createElement('button');
        btnSelecionar.className = 'client-action-button';
        btnSelecionar.title = 'Selecionar fornecedor';
        btnSelecionar.innerHTML = '<i class="fas fa-check"></i>';
        btnSelecionar.onclick = () => selectFornecedorFromList(fornecedorId);
        
        const btnEditar = document.createElement('button');
        btnEditar.className = 'client-action-button';
        btnEditar.title = 'Editar fornecedor';
        btnEditar.innerHTML = '<i class="fas fa-edit"></i>';
        btnEditar.onclick = () => editFornecedorFromList(fornecedorId);
        
        actionContainer.appendChild(btnSelecionar);
        actionContainer.appendChild(btnEditar);
        tdAcoes.appendChild(actionContainer);
        tr.appendChild(tdAcoes);
        
        tableBody.appendChild(tr);
    });
}

// FunÃ§Ã£o para selecionar fornecedor da lista (especÃ­fica para romaneio de tora)
async function selectFornecedorFromList(id) {
    console.log("ðŸ"„ === SELECIONANDO FORNECEDOR ===");
    console.log("ðŸ"„ ID recebido:", id);
    
    try {
        let fornecedor = null;
        let fornecedorList = [];
        
        // âœ… CARREGAMENTO SIMPLIFICADO DO FIREBASE
        if (window.firebaseService && typeof window.firebaseService.loadFromFirebase === 'function') {
            try {
                console.log("ðŸ\"¥ Carregando fornecedores da coleção 'fornecedores'...");
                const result = await window.firebaseService.loadFromFirebase('fornecedores');
                console.log("âœ… loadFromFirebase resultado:", result);
                
                if (result && result.success && result.data) {
                    const firebaseData = result.data;
                    console.log("âœ… Dados do Firebase encontrados:", firebaseData);
                    
                    // âœ… PROCESSAMENTO CORRETO - APENAS VALORES DIRETOS
                    Object.keys(firebaseData).forEach(clientId => {
                        const clientData = firebaseData[clientId];
                        if (clientData && typeof clientData === 'object' && (clientData.nome || clientData.name)) {
                            const fornecedorItem = {
                                id: clientId,
                                originalId: clientData.id || clientId,
                                ...clientData
                            };
                            fornecedorList.push(fornecedorItem);
                        }
                    });
                    
                    console.log(`âœ… ${fornecedorList.length} fornecedores carregados para seleÃ§Ã£o`);
                }
            } catch (error) {
                console.error("âŒ Erro no carregamento Firebase:", error);
            }
        }
        
        console.log(`ðŸ"Š LISTA FINAL PARA SELEÃ‡ÃƒO: ${fornecedorList.length} fornecedores`);
        
        // âœ… BUSCAR FORNECEDOR COM ID CORRETO
        if (fornecedorList.length > 0) {
            // Busca por ID direto
            fornecedor = fornecedorList.find(f => String(f.id) === String(id));
            
            if (!fornecedor) {
                // Busca por ID original
                fornecedor = fornecedorList.find(f => f.originalId && String(f.originalId) === String(id));
            }
            
            if (!fornecedor) {
                // Busca por Ã­ndice (fallback para temp_X)
                if (String(id).startsWith('temp_')) {
                    const index = parseInt(id.replace('temp_', ''));
                    if (!isNaN(index) && index >= 0 && index < fornecedorList.length) {
                        fornecedor = fornecedorList[index];
                        console.log("âœ… Encontrado por Ã­ndice temp:", fornecedor);
                    }
                }
            }
        }
        
        if (fornecedor) {
            console.log("âœ… Fornecedor encontrado para seleÃ§Ã£o:", fornecedor.nome || fornecedor.name);
            selectFornecedor(fornecedor);
        } else {
            console.error("âŒ Fornecedor nÃ£o encontrado com ID:", id);
            console.log("ðŸ"‹ IDs disponÃ­veis:", fornecedorList.map(f => f.id));
            alert('Fornecedor nÃ£o encontrado. A lista foi atualizada do Firebase.');
        }
        
    } catch (error) {
        console.error("âŒ Erro ao selecionar fornecedor:", error);
        alert('Erro ao carregar dados do fornecedor. Tente novamente.');
    }
}

// âœ… FUNÃ‡ÃƒO DE EDIÃ‡ÃƒO CORRIGIDA
async function editFornecedorFromList(id) {
    console.log("ðŸ"„ === EDITANDO FORNECEDOR ===");
    console.log("ðŸ"„ ID recebido:", id);
    
    try {
        let fornecedor = null;
        let fornecedorList = [];
        
        // âœ… CARREGAMENTO SIMPLIFICADO DO FIREBASE
        if (window.firebaseService && typeof window.firebaseService.loadFromFirebase === 'function') {
            try {
                console.log("ðŸ\"¥ Carregando fornecedores da coleção 'fornecedores'...");
                const result = await window.firebaseService.loadFromFirebase('fornecedores');
                console.log("âœ… loadFromFirebase resultado:", result);
                
                if (result && result.success && result.data) {
                    const firebaseData = result.data;
                    console.log("âœ… Dados do Firebase encontrados:", firebaseData);
                    
                    // âœ… PROCESSAMENTO CORRETO - APENAS VALORES DIRETOS
                    Object.keys(firebaseData).forEach(clientId => {
                        const clientData = firebaseData[clientId];
                        if (clientData && typeof clientData === 'object' && (clientData.nome || clientData.name)) {
                            const fornecedorItem = {
                                id: clientId,
                                originalId: clientData.id || clientId,
                                ...clientData
                            };
                            fornecedorList.push(fornecedorItem);
                        }
                    });
                    
                    console.log(`âœ… ${fornecedorList.length} fornecedores carregados para ediÃ§Ã£o`);
                }
            } catch (error) {
                console.error("âŒ Erro no carregamento Firebase:", error);
            }
        }
        
        // âœ… BUSCAR FORNECEDOR COM ID CORRETO
        if (fornecedorList.length > 0) {
            // Busca por ID direto
            fornecedor = fornecedorList.find(f => String(f.id) === String(id));
            
            if (!fornecedor) {
                // Busca por ID original
                fornecedor = fornecedorList.find(f => f.originalId && String(f.originalId) === String(id));
            }
            
            if (!fornecedor) {
                // Busca por Ã­ndice (fallback para temp_X)
                if (String(id).startsWith('temp_')) {
                    const index = parseInt(id.replace('temp_', ''));
                    if (!isNaN(index) && index >= 0 && index < fornecedorList.length) {
                        fornecedor = fornecedorList[index];
                        console.log("âœ… Encontrado por Ã­ndice temp:", fornecedor);
                    }
                }
            }
        }
        
        if (fornecedor) {
            console.log("âœ… Fornecedor encontrado para ediÃ§Ã£o:", fornecedor.nome || fornecedor.name);
            
            // âœ… FECHAR MODAL DE LISTA
            const listModal = document.getElementById('clientListModal');
            if (listModal) {
                listModal.style.display = 'none';
                console.log("âœ… Modal de lista fechado");
            }
            
            // âœ… CARREGAR FORNECEDOR NO CAMPO (igual ao Ã­cone do campo)
            const clientInput = document.getElementById('clienteInput');
            if (clientInput) {
                clientInput.value = fornecedor.nome || fornecedor.name || '';
                console.log("âœ… Fornecedor carregado no campo de entrada");
            }
            
            // âœ… DEFINIR FORNECEDOR GLOBAL PARA openEditClientModal FUNCIONAR
            window.selectedClient = fornecedor;
            window.selectedFornecedor = fornecedor;
            
            // âœ… USAR A MESMA LÃ"GICA DO ÃCONE DO CAMPO - openEditClientModal
            console.log("âœ… Chamando openEditClientModal (mesma funÃ§Ã£o do Ã­cone do campo)");
            await openEditClientModal();
            
        } else {
            console.error("âŒ Fornecedor nÃ£o encontrado com ID:", id);
            console.log("ðŸ"‹ IDs disponÃ­veis:", fornecedorList.map(f => f.id));
            alert('Fornecedor nÃ£o encontrado. A lista foi atualizada do Firebase.');
        }
        
    } catch (error) {
        console.error("âŒ Erro ao editar fornecedor:", error);
        alert('Erro ao carregar dados do fornecedor. Tente novamente.');
    }
}

// FunÃ§Ã£o para selecionar um fornecedor (especÃ­fica para romaneio de tora)
function selectFornecedor(fornecedor) {
    console.log("ðŸ"„ Selecionando fornecedor na interface:", fornecedor.nome || fornecedor.name);
    
    window.selectedFornecedor = fornecedor;
    window.selectedClient = fornecedor; // Manter compatibilidade
    
    const clientInput = document.getElementById('clienteInput');
    if (clientInput) {
        clientInput.value = fornecedor.nome || fornecedor.name || '';
    }
    
    // âœ… FECHAR MODAL APÃ"S SELEÃ‡ÃƒO
    const modal = document.getElementById('clientListModal');
    if (modal) {
        modal.style.display = 'none';
        console.log("âœ… Modal de lista fechado");
    }
    
    console.log("âœ… Fornecedor selecionado no romaneio de tora:", fornecedor.nome || fornecedor.name);
}

// âœ… MANTER COMPATIBILIDADE COM FUNÃ‡Ã•ES ANTIGAS (por compatibilidade apenas)
async function openClientListModal() {
    console.log("ðŸ"„ Redirecionando openClientListModal para openFornecedorListModal");
    return await openFornecedorListModal();
}

async function renderClientList(filter = '') {
    console.log("ðŸ"„ Redirecionando renderClientList para renderFornecedorList");
    return await renderFornecedorList(filter);
}

async function selectClientFromList(id) {
    console.log("ðŸ"„ Redirecionando selectClientFromList para selectFornecedorFromList");
    return await selectFornecedorFromList(id);
}

async function editClientFromList(id) {
    console.log("ðŸ"„ Redirecionando editClientFromList para editFornecedorFromList");
    return await editFornecedorFromList(id);
}

function selectClient(fornecedor) {
    console.log("ðŸ"„ Redirecionando selectClient para selectFornecedor");
    return selectFornecedor(fornecedor);
}

// FunÃ§Ã£o para abrir o modal de lista de espÃ©cies
async function openSpeciesListModal() {
    console.log("ðŸ" Abrindo modal de lista de espÃ©cies");
    
    let modal = document.getElementById('speciesListModal');
    
    if (!modal) {
        modal = document.createElement('div');
        modal.id = 'speciesListModal';
        modal.className = 'modal';
        
        modal.innerHTML = `
            <div class="modal-content">
                <div class="modal-header">
                    <h3 class="modal-title">Lista de Espécies</h3>
                    <span class="close-modal">&times;</span>
                </div>
                <div class="modal-body">
                    <input type="text" id="speciesListFilter" placeholder="Filtrar espÃ©cies..." 
                           style="margin: 10px 0; width: 100%; padding: 8px; border: 1px solid #ddd; border-radius: 4px;">
                    <table class="table">
                        <thead>
                            <tr>
                                <th>Nome</th>
                                <th>Descrição</th>
                                <th style="text-align: center; width: 120px;">Ações</th>
                            </tr>
                        </thead>
                        <tbody id="speciesListTable">
                            <!-- Preenchido via JavaScript -->
                        </tbody>
                    </table>
                </div>
                <div class="modal-footer">
                    <button type="button" class="back-button close-modal-btn">Fechar</button>
                    <button type="button" class="btn-save" onclick="openNewSpeciesModal()">Nova EspÃ©cie</button>
                </div>
            </div>
        `;
        
        document.body.appendChild(modal);
        
        const closeBtn = modal.querySelector('.close-modal');
        if (closeBtn) closeBtn.onclick = () => modal.style.display = 'none';
        
        const closeBtns = modal.querySelectorAll('.close-modal-btn');
        closeBtns.forEach(btn => {
            btn.onclick = () => modal.style.display = 'none';
        });
        
        const filterInput = modal.querySelector('#speciesListFilter');
        if (filterInput) {
            filterInput.addEventListener('input', async function() {
                await renderSpeciesList(this.value);
            });
        }
    }
    
    await renderSpeciesList('');
    modal.style.display = 'block';
    
    setTimeout(() => {
        const filterInput = document.getElementById('speciesListFilter');
        if (filterInput) filterInput.focus();
    }, 100);
}

// FunÃ§Ã£o para renderizar lista de espÃ©cies
async function renderSpeciesList(filter = '') {
    console.log("ðŸ" === RENDERIZANDO LISTA DE ESPÃ‰CIES - ROMANEIO TORA ===");
    console.log("ðŸ" Filtro aplicado:", filter);
    
    const tableBody = document.getElementById('speciesListTable');
    if (!tableBody) {
        console.error("âŒ Elemento #speciesListTable nÃ£o encontrado");
        return;
    }
    
    let speciesList = [];
    
    try {
        console.log("ðŸ"¥ === CARREGAMENTO DIRETO DO FIREBASE - ESPÃ‰CIES ===");
        
        // âœ… CARREGAMENTO CORRETO DO FIREBASE
        if (window.firebaseService && typeof window.firebaseService.loadFromFirebase === 'function') {
            try {
                console.log("ðŸ"¥ Carregando espÃ©cies da coleÃ§Ã£o 'species'...");
                const result = await window.firebaseService.loadFromFirebase('species');
                console.log("âœ… loadFromFirebase resultado completo:", result);
                
                if (result && result.success && result.data) {
                    const firebaseData = result.data;
                    console.log("âœ… Dados do Firebase encontrados:", firebaseData);
                    console.log("âœ… Tipo dos dados:", typeof firebaseData);
                    console.log("âœ… Ã‰ array?", Array.isArray(firebaseData));
                    console.log("âœ… Chaves do objeto:", Object.keys(firebaseData));
                    
                    // âœ… PROCESSAMENTO CORRETO - APENAS VALORES DIRETOS
            if (typeof firebaseData === 'object' && !Array.isArray(firebaseData)) {
                        // Se retornou um objeto (formato Firebase), converter para array
                        speciesList = Object.keys(firebaseData).map(speciesId => {
                            const speciesData = firebaseData[speciesId];
                            console.log(`ðŸ"¦ Processando espÃ©cie ${speciesId}:`, speciesData);
                            
                            if (speciesData && typeof speciesData === 'object' && (speciesData.nome || speciesData.name)) {
                                const especie = {
                                    id: speciesId,
                                    originalId: speciesData.id || speciesId,
                                    ...speciesData
                                };
                                console.log(`âœ… EspÃ©cie adicionada: ${especie.nome || especie.name}`);
                                return especie;
                            }
                            return null;
                        }).filter(Boolean);
                        
                        console.log(`âœ… ${speciesList.length} espÃ©cies convertidas do objeto Firebase`);
            } else if (Array.isArray(firebaseData)) {
                speciesList = firebaseData;
                        console.log(`âœ… ${speciesList.length} espÃ©cies jÃ¡ em formato array`);
        }
        
                    console.log(`âœ… ${speciesList.length} espÃ©cies carregadas do Firebase`);
                } else {
                    console.log("âš ï¸ Nenhum dado encontrado no Firebase ou estrutura invÃ¡lida");
                }
    } catch (error) {
                console.error("âŒ Erro no carregamento Firebase:", error);
            }
        } else {
            console.error("âŒ FirebaseService nÃ£o disponÃ­vel");
    }
    
        // âœ… FALLBACK PARA CACHE LOCAL APENAS EM CASO DE ERRO
    if (!Array.isArray(speciesList) || speciesList.length === 0) {
            try {
                console.log("ðŸ"„ Tentando cache local para espÃ©cies...");
                const storageKey = getStorageKey('species');
                const allowLegacy = storageKey === 'species';
                const localData = localStorage.getItem(storageKey) || (allowLegacy ? localStorage.getItem('species') : null);
                
                if (localData) {
                    try {
                        speciesList = JSON.parse(localData);
                        if (!Array.isArray(speciesList)) speciesList = [];
                        console.log(`âœ… ${speciesList.length} espÃ©cies carregadas do cache local`);
                    } catch (parseError) {
                        console.error("âŒ Erro ao parsear espÃ©cies do cache local:", parseError);
                        localStorage.removeItem(storageKey);
                        speciesList = [];
                    }
            } else {
                    console.log("ðŸ"± EspÃ©cies nÃ£o encontradas no cache local");
                speciesList = [];
            }
            } catch (localError) {
                console.error("âŒ Erro ao acessar cache local para espÃ©cies:", localError);
            speciesList = [];
        }
    }
    
    } catch (error) {
        console.error("âŒ Erro geral na obtenÃ§Ã£o de dados:", error);
    }
    
    console.log(`ðŸ"Š RESULTADO FINAL: ${speciesList.length} espÃ©cies para renderizar`);
    
    // Aplicar filtro
    if (filter && filter.trim() !== '') {
        const searchTerm = filter.toLowerCase();
        const originalLength = speciesList.length;
        speciesList = speciesList.filter(specie => 
            (specie.nome || specie.name || '').toLowerCase().includes(searchTerm) || 
            (specie.descricao || specie.description || '').toLowerCase().includes(searchTerm)
        );
        console.log(`ðŸ" Filtro aplicado: ${originalLength} -> ${speciesList.length} espÃ©cies`);
    }
    
    // Ordenar por nome
    speciesList.sort((a, b) => {
        const nameA = (a.nome || a.name || '').toLowerCase();
        const nameB = (b.nome || b.name || '').toLowerCase();
        return nameA.localeCompare(nameB, 'pt-BR');
    });
    
    // Limpar tabela
    tableBody.innerHTML = '';
    
    if (speciesList.length === 0) {
        const tr = document.createElement('tr');
        const td = document.createElement('td');
        td.setAttribute('colspan', '3');
        td.style.textAlign = 'center';
        td.style.padding = '20px';
        td.style.color = '#666';
        td.innerHTML = filter ? 
            '<i class="fas fa-search" style="margin-right: 8px;"></i>Nenhuma espÃ©cie encontrada para o filtro aplicado' : 
            '<i class="fas fa-plus" style="margin-right: 8px;"></i>Nenhuma espÃ©cie encontrada. Use "Importar Especies" no menu Cadastros.';
        tr.appendChild(td);
        tableBody.appendChild(tr);
        console.log("ðŸ" Exibindo mensagem: nenhuma espÃ©cie encontrada");
        return;
    }
    
    console.log(`âœ… Renderizando ${speciesList.length} espÃ©cies na tabela`);
    
    // âœ… RENDERIZAR TABELA COM DADOS ORGANIZADOS CORRETAMENTE
    speciesList.forEach((specie, index) => {
        console.log(`  Renderizando espÃ©cie ${index + 1}:`, specie);
        
        const tr = document.createElement('tr');
        tr.style.transition = 'background-color 0.2s ease';
        
        // âœ… ID SEGURO
        const specieId = specie.id || `temp_${index}`;
        
        // Nome (primeira coluna)
        const tdNome = document.createElement('td');
        tdNome.style.padding = '12px';
        tdNome.style.verticalAlign = 'middle';
        tdNome.style.fontWeight = '600';
        tdNome.textContent = specie?.nome || specie?.name || 'Sem nome';
        tr.appendChild(tdNome);
        
        // DescriÃ§Ã£o (segunda coluna)
        const tdDescricao = document.createElement('td');
        tdDescricao.style.padding = '12px';
        tdDescricao.style.verticalAlign = 'middle';
        tdDescricao.textContent = specie?.descricao || specie?.description || '';
        tr.appendChild(tdDescricao);
        
        // AÃ§Ãµes (terceira coluna)
        const tdAcoes = document.createElement('td');
        tdAcoes.className = 'action-buttons-container';
        tdAcoes.style.padding = '12px';
        tdAcoes.style.verticalAlign = 'middle';
        tdAcoes.style.textAlign = 'center';
        
        // âœ… PADRONIZAÃ‡ÃƒO: Usar os mesmos estilos dos fornecedores
        const btnSelecionar = document.createElement('button');
        btnSelecionar.className = 'client-action-button';
        btnSelecionar.title = 'Selecionar espÃ©cie';
        btnSelecionar.innerHTML = '<i class="fas fa-check"></i>';
        btnSelecionar.onclick = () => selectSpeciesFromList(specieId);
        
        const btnEditar = document.createElement('button');
        btnEditar.className = 'client-action-button';
        btnEditar.title = 'Editar espÃ©cie';
        btnEditar.innerHTML = '<i class="fas fa-edit"></i>';
        btnEditar.onclick = () => editSpeciesFromList(specieId);
        
        tdAcoes.appendChild(btnSelecionar);
        tdAcoes.appendChild(btnEditar);
        tr.appendChild(tdAcoes);
        
        // Hover effect
        tr.addEventListener('mouseenter', () => {
            tr.style.backgroundColor = '#f8f9fa';
        });
        tr.addEventListener('mouseleave', () => {
            tr.style.backgroundColor = '';
        });
        
        tableBody.appendChild(tr);
    });
    
    console.log("ðŸŽ‰ === RENDERIZAÃ‡ÃƒO DE ESPÃ‰CIES CONCLUÃDA ===");
}

// FunÃ§Ã£o para selecionar espÃ©cie da lista (100% Firebase)
async function selectSpeciesFromList(id) {
    console.log("ðŸ"„ === SELECIONANDO ESPÃ‰CIE ===");
    console.log("ðŸ"„ ID recebido:", id);
    
    try {
        let especie = null;
        let especiesList = [];
        
        // âœ… CARREGAMENTO SIMPLIFICADO DO FIREBASE
        if (window.firebaseService && typeof window.firebaseService.loadFromFirebase === 'function') {
            try {
                console.log("ðŸ"¥ Carregando espÃ©cies da coleÃ§Ã£o 'species'...");
                const result = await window.firebaseService.loadFromFirebase('species');
                console.log("âœ… loadFromFirebase resultado:", result);
                
                if (result && result.success && result.data) {
                    const firebaseData = result.data;
                    console.log("âœ… Dados do Firebase encontrados:", firebaseData);
                    
                    // âœ… PROCESSAMENTO CORRETO - APENAS VALORES DIRETOS
                    if (typeof firebaseData === 'object' && !Array.isArray(firebaseData)) {
                        especiesList = Object.keys(firebaseData).map(speciesId => {
                            const speciesData = firebaseData[speciesId];
                            if (speciesData && typeof speciesData === 'object' && (speciesData.nome || speciesData.name)) {
                                return {
                                    id: speciesId,
                                    originalId: speciesData.id || speciesId,
                                    ...speciesData
                                };
                            }
                            return null;
                        }).filter(Boolean);
                    } else if (Array.isArray(firebaseData)) {
                        especiesList = firebaseData;
                    }
                    
                    console.log(`âœ… ${especiesList.length} espÃ©cies carregadas para seleÃ§Ã£o`);
                }
    } catch (error) {
                console.error("âŒ Erro no carregamento Firebase:", error);
            }
        }
        
        // âœ… FALLBACK PARA CACHE LOCAL
        if (!Array.isArray(especiesList) || especiesList.length === 0) {
            try {
                const storageKey = getStorageKey('species');
                const allowLegacy = storageKey === 'species';
                const localData = localStorage.getItem(storageKey) || (allowLegacy ? localStorage.getItem('species') : null);
                if (localData) {
                    especiesList = JSON.parse(localData);
                    if (!Array.isArray(especiesList)) especiesList = [];
                }
    } catch (error) {
                console.error("âŒ Erro ao acessar cache local:", error);
                especiesList = [];
            }
        }
        
        console.log(`ðŸ"Š LISTA FINAL PARA SELEÃ‡ÃƒO: ${especiesList.length} espÃ©cies`);
        
        // âœ… BUSCAR ESPÃ‰CIE COM ID CORRETO
        if (especiesList.length > 0) {
            // Busca por ID direto
            especie = especiesList.find(s => String(s.id) === String(id));
            
            if (!especie) {
                // Busca por ID original
                especie = especiesList.find(s => s.originalId && String(s.originalId) === String(id));
            }
            
            if (!especie) {
                // Busca por Ã­ndice (fallback para temp_X)
                if (String(id).startsWith('temp_')) {
                    const index = parseInt(id.replace('temp_', ''));
                    if (!isNaN(index) && index >= 0 && index < especiesList.length) {
                        especie = especiesList[index];
                        console.log("âœ… Encontrado por Ã­ndice temp:", especie);
                    }
                }
            }
        }
        
        if (especie) {
            console.log("âœ… EspÃ©cie encontrada para seleÃ§Ã£o:", especie.nome || especie.name);
            
            // âœ… SELECIONAR A ESPÃ‰CIE
            window.selectedSpecies = especie;
        const especieInput = document.getElementById('especieInput');
        if (especieInput) {
                let nome = especie.nome || especie.name || '';
                if (window.isAllCaps && window.toTitleCasePt && window.isAllCaps(nome)) {
                    nome = window.toTitleCasePt(nome);
                }
                especieInput.value = nome;
                console.log("âœ… Campo especieInput preenchido:", especieInput.value);
            }
            
            // âœ… FECHAR O MODAL DE LISTA DE ESPÃ‰CIES
            const speciesListModal = document.getElementById('speciesListModal');
            if (speciesListModal) {
                speciesListModal.style.display = 'none';
                console.log("âœ… Modal de lista de espÃ©cies fechado");
            }
            
            // âœ… NOTIFICAR SUCESSO
            console.log("ðŸŽ‰ EspÃ©cie selecionada com sucesso!");
            
        } else {
            console.error("âŒ EspÃ©cie nÃ£o encontrada com ID:", id);
            console.log("ðŸ"‹ IDs disponÃ­veis:", especiesList.map(s => s.id));
            alert('EspÃ©cie nÃ£o encontrada. A lista foi atualizada do Firebase.');
        }
        
    } catch (error) {
        console.error("âŒ Erro ao selecionar espÃ©cie:", error);
        alert('Erro ao carregar dados da espÃ©cie. Tente novamente.');
    }
}

// âœ… FUNÃ‡ÃƒO DE EDIÃ‡ÃƒO CORRIGIDA PARA ESPÃ‰CIES
async function editSpeciesFromList(speciesId) {
    console.log("ðŸ"„ === EDITANDO ESPÃ‰CIE ===");
    console.log("ðŸ"„ ID recebido:", speciesId);
    
    try {
        // âœ… VERIFICAR SE FORNECEDOR ESTÃ SELECIONADO PRIMEIRO
        console.log("ðŸ" Verificando se fornecedor estÃ¡ selecionado...");
        const clienteInput = document.getElementById('clienteInput');
        console.log("ðŸ" Campo clienteInput valor:", clienteInput ? clienteInput.value : 'campo nÃ£o encontrado');
        console.log("ðŸ" Nome do fornecedor salvo:", window.selectedClient ? window.selectedClient.nome : 'undefined');
        
        if (!window.selectedClient || !window.selectedClient.nome) {
            const mensagemErro = 'Por favor, selecione um fornecedor antes de editar a espÃ©cie.';
            console.log("âš ï¸ Fornecedor nÃ£o selecionado:", mensagemErro);
            alert(mensagemErro);
            return;
        }
        
        // âœ… CARREGAR ESPÃ‰CIES DO FIREBASE
        console.log("ðŸ"¥ Carregando espÃ©cies da coleÃ§Ã£o 'species'...");
        let especiesList = [];
        
        if (window.firebaseService && typeof window.firebaseService.loadFromFirebase === 'function') {
            try {
                const result = await window.firebaseService.loadFromFirebase('species');
                console.log("âœ… loadFromFirebase resultado:", result);
                
                if (result && result.success && result.data) {
                    const firebaseData = result.data;
                    console.log("âœ… Dados do Firebase encontrados:", firebaseData);
                    
                    // âœ… PROCESSAMENTO CORRETO
                    if (typeof firebaseData === 'object' && !Array.isArray(firebaseData)) {
                        especiesList = Object.keys(firebaseData).map(key => ({
                            id: key,
                            ...firebaseData[key]
                        }));
                        console.log("âœ… Objeto convertido em array:", especiesList.length);
                    } else if (Array.isArray(firebaseData)) {
                        especiesList = firebaseData;
                        console.log("âœ… Array de espÃ©cies:", especiesList.length);
                    }
                }
                } catch (error) {
                console.error("âŒ Erro no Firebase:", error);
            }
        }
        
        // âœ… FALLBACK PARA LOCALSTORAGE
        if (!Array.isArray(especiesList) || especiesList.length === 0) {
            console.log("âš ï¸ Dados do Firebase nÃ£o encontrados, tentando localStorage...");
            const storageKey = getStorageKey('species');
            const allowLegacy = storageKey === 'species';
            const localData = localStorage.getItem(storageKey) || (allowLegacy ? localStorage.getItem('species') : null);
            if (localData) {
                especiesList = JSON.parse(localData) || [];
                console.log("âœ… Dados do localStorage:", especiesList.length);
            }
        }
        
        console.log(`âœ… ${especiesList.length} espÃ©cies carregadas para ediÃ§Ã£o`);
        
        // âœ… ENCONTRAR A ESPÃ‰CIE
        let selectedSpecies = null;
        
        // Tentar encontrar por ID exato
        selectedSpecies = especiesList.find(species => 
            species.id === speciesId || 
            species.key === speciesId
        );
        
        // Se nÃ£o encontrou, tentar por Ã­ndice
        if (!selectedSpecies && !isNaN(speciesId)) {
            const index = parseInt(speciesId);
            if (index >= 0 && index < especiesList.length) {
                selectedSpecies = especiesList[index];
                console.log(`âœ… EspÃ©cie encontrada por Ã­ndice ${index}`);
            }
        }
        
        if (!selectedSpecies) {
            console.error("âŒ EspÃ©cie nÃ£o encontrada:", speciesId);
            if (window.Utils && window.Utils.showToast) window.Utils.showToast('Espécie não encontrada!', 'error');
            return;
        }
        
        console.log("âœ… EspÃ©cie encontrada para ediÃ§Ã£o:", selectedSpecies.nome);
        
        // âœ… FECHAR MODAL DE LISTA
        const listModal = document.getElementById('speciesListModal');
        if (listModal) {
            listModal.style.display = 'none';
            console.log("âœ… Modal de lista fechado");
        }
        
        // âœ… ABRIR MODAL DE EDIÃ‡ÃƒO DE ESPÃ‰CIE
        console.log("ðŸ"„ Abrindo modal de ediÃ§Ã£o de espÃ©cie...");
        const editModal = document.getElementById('speciesModal');
        if (editModal) {
            editModal.style.display = 'block';
            console.log("âœ… Modal de ediÃ§Ã£o aberto");
            
            // âœ… PREENCHER CAMPOS DO MODAL COM DADOS DA ESPÃ‰CIE
            const nomeField = document.getElementById('speciesName');
            const descricaoField = document.getElementById('speciesDescription');
            
            if (nomeField) {
                nomeField.value = selectedSpecies.nome || selectedSpecies.name || '';
                console.log("âœ… Campo nome preenchido:", nomeField.value);
            }
            
            if (descricaoField) {
                descricaoField.value = selectedSpecies.descricao || selectedSpecies.description || '';
                console.log("âœ… Campo descriÃ§Ã£o preenchido:", descricaoField.value);
            }
            
            // âœ… MARCAR COMO EDIÃ‡ÃƒO
            window.editingSpeciesId = selectedSpecies.id || selectedSpecies.key;
            console.log("âœ… ID da espÃ©cie em ediÃ§Ã£o:", window.editingSpeciesId);
            
            // âœ… ALTERAR TÃTULO DO MODAL
            const modalTitle = editModal.querySelector('h2');
            if (modalTitle) {
                modalTitle.textContent = 'Editar EspÃ©cie';
            }
            
            // âœ… FOCAR NO PRIMEIRO CAMPO
            if (nomeField) {
                nomeField.focus();
            }
            
        } else {
            console.error("âŒ Modal de ediÃ§Ã£o nÃ£o encontrado");
            alert('Modal de ediÃ§Ã£o nÃ£o disponÃ­vel. Tente novamente.');
        }
        
    } catch (error) {
        console.error("âŒ Erro ao editar espÃ©cie:", error);
        alert('Erro ao carregar dados da espÃ©cie para ediÃ§Ã£o: ' + error.message);
    }
}

// âœ… FUNÃ‡ÃƒO PARA ABRIR MODAL DE NOVA ESPÃ‰CIE
function openNewSpeciesModal() {
    console.log("ðŸŒ± Abrindo modal de nova espÃ©cie");
    
    // Verificar se o modal jÃ¡ existe ou criar novo
    let modal = document.getElementById('speciesModal');
    
    if (!modal) {
        console.log("ðŸ"§ Criando novo modal de espÃ©cies");
        modal = document.createElement('div');
        modal.id = 'speciesModal';
        modal.className = 'modal';
        
        modal.innerHTML = `
            <div class="modal-content">
                <div class="modal-header">
                    <h3 id="speciesModalTitle" class="modal-title">Nova EspÃ©cie</h3>
                    <span class="close-modal">&times;</span>
                </div>
                <div class="modal-body">
                    <form id="speciesForm">
                        <input type="hidden" id="speciesId" name="speciesId">
                        
                        <div class="form-group">
                            <label for="speciesName">Nome da EspÃ©cie:</label>
                            <input type="text" id="speciesName" name="speciesName" required placeholder="Ex: Eucalipto">
                    </div>
                        
                        <div class="form-group">
                            <label for="speciesDescription">DescriÃ§Ã£o:</label>
                            <textarea id="speciesDescription" name="speciesDescription" rows="3" placeholder="DescriÃ§Ã£o opcional da espÃ©cie"></textarea>
                        </div>
                    </form>
                </div>
                <div class="modal-footer">
                    <button type="button" class="back-button close-modal-btn">Cancelar</button>
                    <button type="button" class="btn-save" onclick="saveSpecies()">Salvar</button>
                </div>
            </div>
        `;
        
        document.body.appendChild(modal);
        
        // Event listeners para fechar o modal
        const closeBtn = modal.querySelector('.close-modal');
        if (closeBtn) closeBtn.onclick = closeSpeciesModal;
        
        const closeBtns = modal.querySelectorAll('.close-modal-btn');
        closeBtns.forEach(btn => {
            btn.onclick = closeSpeciesModal;
        });
        
        // Fechar ao clicar fora do modal
        modal.onclick = function(event) {
            if (event.target === modal) {
                closeSpeciesModal();
            }
        };
    }
    
    // Fechar modal de lista se estiver aberto
    const listModal = document.getElementById('speciesListModal');
    if (listModal) {
        listModal.style.display = 'none';
    }
    
    // Resetar o formulÃ¡rio
    const form = document.getElementById('speciesForm');
    if (form) form.reset();
    
    // Limpar ID (para nova espÃ©cie)
    const idInput = document.getElementById('speciesId');
    if (idInput) idInput.value = '';
    
    // Atualizar tÃ­tulo
    const title = document.getElementById('speciesModalTitle');
    if (title) title.textContent = 'Nova EspÃ©cie';
    
    // Exibir o modal
    modal.style.display = 'block';
    
    // Focar no campo de nome
    setTimeout(() => {
        const nameInput = document.getElementById('speciesName');
        if (nameInput) nameInput.focus();
    }, 100);
    
    console.log("âœ… Modal de nova espÃ©cie aberto");
}

// âœ… FUNÃ‡ÃƒO PARA FECHAR MODAL DE ESPÃ‰CIE
function closeSpeciesModal() {
    const modal = document.getElementById('speciesModal');
    if (modal) {
        modal.style.display = 'none';
        console.log("âœ… Modal de espÃ©cie fechado");
    }
}

// âœ… FUNÃ‡ÃƒO PARA SALVAR ESPÃ‰CIE (NOVA OU EDIÃ‡ÃƒO)
async function saveSpecies() {
    console.log("ðŸ'¾ === SALVANDO ESPÃ‰CIE ===");
    
    try {
        const form = document.getElementById('speciesForm');
        if (!form) {
            throw new Error("FormulÃ¡rio de espÃ©cie nÃ£o encontrado");
        }
        
        // Obter dados do formulÃ¡rio
        const id = document.getElementById('speciesId').value.trim();
        const nome = document.getElementById('speciesName').value.trim();
        const descricao = document.getElementById('speciesDescription').value.trim();
        
        // ValidaÃ§Ãµes
        if (!nome) {
            alert('Nome da espÃ©cie Ã© obrigatÃ³rio!');
            document.getElementById('speciesName').focus();
            return false;
        }
        
        const isEdit = Boolean(id);
        console.log(`ðŸ" ${isEdit ? 'Editando' : 'Criando nova'} espÃ©cie:`, nome);
        
        // Preparar dados
        const speciesData = {
            nome: nome,
            descricao: descricao,
            timestamp: new Date().toISOString()
        };
        
        if (isEdit) {
            speciesData.id = id;
        }
        
        console.log("ðŸ"¦ Dados da espÃ©cie:", speciesData);
        
        // Salvar no Firebase
        let saveResult;
        if (window.firebaseService && typeof window.firebaseService.saveToFirebase === 'function') {
            console.log("ðŸ"¥ Salvando no Firebase...");
            
            if (isEdit) {
                // Para ediÃ§Ã£o, usar o ID existente
                saveResult = await window.firebaseService.saveToFirebase('species', id, speciesData);
        } else {
                // Para nova espÃ©cie, deixar o Firebase gerar o ID
                saveResult = await window.firebaseService.saveToFirebase('species', null, speciesData);
            }
            
            console.log("âœ… Resultado do salvamento:", saveResult);
            
            if (saveResult && saveResult.success) {
                console.log("âœ… EspÃ©cie salva no Firebase com sucesso");
                
                // Atualizar cache local
                try {
                    let especies = [];
                    const storageKey = getStorageKey('species');
                    const allowLegacy = storageKey === 'species';
                    const localData = localStorage.getItem(storageKey) || (allowLegacy ? localStorage.getItem('species') : null);
                    if (localData) {
                        especies = JSON.parse(localData) || [];
                    }
                    
                    if (isEdit) {
                        // Atualizar espÃ©cie existente
                        const index = especies.findIndex(s => s.id === id);
                        if (index !== -1) {
                            especies[index] = { ...especies[index], ...speciesData };
                        }
                    } else {
                        // Adicionar nova espÃ©cie
                        const newId = saveResult.id || `species_${Date.now()}`;
                        especies.push({ id: newId, ...speciesData });
                    }
                    
                    persistLocalValue(storageKey, especies);
                    console.log("âœ… Cache local atualizado");
                } catch (cacheError) {
                    console.warn("âš ï¸ Erro ao atualizar cache local:", cacheError);
                }
                
                // Fechar modal
                closeSpeciesModal();
                
                // Recarregar lista se estiver aberta
                const listModal = document.getElementById('speciesListModal');
                if (listModal && listModal.style.display === 'block') {
                    console.log("ðŸ"„ Recarregando lista de espÃ©cies...");
                    await renderSpeciesList('');
                }
                
                // Recarregar dados globais
                if (typeof window.carregarEspecies === 'function') {
                    console.log("ðŸ"„ Recarregando espÃ©cies globalmente...");
                    await window.carregarEspecies();
                }
                
                // Notificar usuÃ¡rio
                const mensagem = isEdit ? 
                    `EspÃ©cie "${nome}" atualizada com sucesso!` : 
                    `EspÃ©cie "${nome}" cadastrada com sucesso!`;
                alert(mensagem);
                
                return true;
            } else {
                throw new Error(saveResult?.error || "Erro desconhecido ao salvar");
            }
        } else {
            throw new Error("Firebase Service nÃ£o disponÃ­vel");
        }
        
    } catch (error) {
        console.error("âŒ Erro ao salvar espÃ©cie:", error);
        alert(`Erro ao salvar espÃ©cie: ${error.message}`);
        return false;
    }
}

// âœ… EXPORTAÃ‡Ã•ES GLOBAIS PARA ESPÃ‰CIES
    window.openSpeciesListModal = openSpeciesListModal;
    window.openNewSpeciesModal = openNewSpeciesModal;
    window.selectSpeciesFromList = selectSpeciesFromList;
    window.editSpeciesFromList = editSpeciesFromList;
window.renderSpeciesList = renderSpeciesList;
window.saveSpecies = saveSpecies;
window.closeSpeciesModal = closeSpeciesModal;

console.log("âœ… FunÃ§Ãµes de espÃ©cies exportadas globalmente para romaneio de tora");

// âœ… FUNÃ‡ÃƒO PARA ABRIR MODAL DE NOVO FORNECEDOR (CLIENTE)
function openNewClientModal() {
    console.log("ðŸ†• Abrindo modal de novo fornecedor");
    
    // Verificar se o modal jÃ¡ existe ou criar novo
    let modal = document.getElementById('clientModal');
    
    if (!modal) {
        console.log("ðŸ"§ Criando novo modal de fornecedor");
        modal = document.createElement('div');
        modal.id = 'clientModal';
        modal.className = 'modal';
        
        modal.innerHTML = `
            <div class="modal-content">
                <div class="modal-header">
                    <h3 id="clientModalTitle" class="modal-title">Novo Fornecedor</h3>
                    <span class="close-modal">&times;</span>
                </div>
                <div class="modal-body">
                    <form id="clientForm">
                        <input type="hidden" id="clientId" name="clientId">
                        
                        <div class="form-group">
                            <label for="clientName">Nome do Fornecedor: *</label>
                            <input type="text" id="clientName" name="clientName" required placeholder="Ex: Madeireira Silva">
                        </div>
                        
                        <div class="form-group">
                            <label for="clientCnpj">CNPJ:</label>
                            <input type="text" id="clientCnpj" name="clientCnpj" placeholder="00.000.000/0000-00">
                        </div>
                        
                        <div class="form-group">
                            <label for="clientStateRegistration">InscriÃ§Ã£o Estadual:</label>
                            <input type="text" id="clientStateRegistration" name="clientStateRegistration" placeholder="000.000.000.000">
                        </div>
                        
                        <div class="form-row">
                            <div class="form-group half-width">
                                <label for="clientState">Estado: *</label>
                                <input type="text" id="clientState" name="clientState" required placeholder="Ex: SP">
                            </div>
                            <div class="form-group half-width">
                                <label for="clientCity">Cidade: *</label>
                                <input type="text" id="clientCity" name="clientCity" required placeholder="Ex: SÃ£o Paulo">
                            </div>
                        </div>
                        
                        <div class="form-row">
                            <div class="form-group half-width">
                                <label for="clientPhone">Telefone:</label>
                                <input type="text" id="clientPhone" name="clientPhone" placeholder="(11) 9999-9999">
                            </div>
                            <div class="form-group half-width">
                                <label for="clientEmail">Email:</label>
                                <input type="email" id="clientEmail" name="clientEmail" placeholder="contato@empresa.com">
                            </div>
                        </div>
                        
                        <div class="form-row">
                            <div class="form-group three-quarters">
                                <label for="clientAddress">EndereÃ§o:</label>
                                <input type="text" id="clientAddress" name="clientAddress" placeholder="Rua, Avenida, etc.">
                            </div>
                            <div class="form-group quarter">
                                <label for="clientNumber">NÃºmero:</label>
                                <input type="text" id="clientNumber" name="clientNumber" placeholder="123">
                            </div>
                        </div>
                        
                        <div class="form-group">
                            <label for="clientNeighborhood">Bairro:</label>
                            <input type="text" id="clientNeighborhood" name="clientNeighborhood" placeholder="Centro">
                        </div>
                        
                        <div class="form-group">
                            <label for="clientObs">ObservaÃ§Ãµes:</label>
                            <textarea id="clientObs" name="clientObs" rows="3" placeholder="ObservaÃ§Ãµes adicionais"></textarea>
                        </div>
                    </form>
                </div>
                <div class="modal-footer">
                    <button type="button" class="back-button close-modal-btn">Cancelar</button>
                    <button type="button" class="btn-save" onclick="saveClient()">Salvar</button>
                </div>
            </div>
        `;
        
        document.body.appendChild(modal);
        
        // Event listeners para fechar o modal
        const closeBtn = modal.querySelector('.close-modal');
        if (closeBtn) closeBtn.onclick = closeClientModal;
        
        const closeBtns = modal.querySelectorAll('.close-modal-btn');
        closeBtns.forEach(btn => {
            btn.onclick = closeClientModal;
        });
        
        // Fechar ao clicar fora do modal
        modal.onclick = function(e) {
            if (e.target === modal) {
                fecharTodosDropdownsLista(); // Fechar dropdowns antes de fechar modal
                modal.style.display = 'none';
            }
        };
    }
    
    // Fechar modal de lista se estiver aberto
    const listModal = document.getElementById('clientListModal');
    if (listModal) {
        listModal.style.display = 'none';
    }
        
        // Resetar o formulÃ¡rio
        const form = document.getElementById('clientForm');
        if (form) form.reset();
        
    // Limpar ID (para novo fornecedor)
        const idInput = document.getElementById('clientId');
    if (idInput) idInput.value = '';
    
    // Atualizar tÃ­tulo
    const title = document.getElementById('clientModalTitle');
    if (title) title.textContent = 'Novo Fornecedor';
    
    // Exibir o modal
    modal.style.display = 'block';
    
    // Focar no campo de nome
    setTimeout(() => {
        const nameInput = document.getElementById('clientName');
        if (nameInput) nameInput.focus();
    }, 100);
    
    console.log("âœ… Modal de novo fornecedor aberto");
}

// âœ… FUNÃ‡ÃƒO PARA FECHAR MODAL DE FORNECEDOR
function closeClientModal() {
    const modal = document.getElementById('clientModal');
    if (modal) {
        modal.style.display = 'none';
        console.log("âœ… Modal de fornecedor fechado");
    }
}

// âœ… FUNÃ‡ÃƒO PARA ABRIR MODAL DE EDIÃ‡ÃƒO DE FORNECEDOR
async function openEditClientModal() {
    console.log("âœï¸ Abrindo modal de ediÃ§Ã£o de fornecedor");
    
    // Usar a mesma funÃ§Ã£o do modal de novo, mas preencher com dados
    openNewClientModal();
    
    // Aguardar um pouco para o modal ser criado
    setTimeout(() => {
        if (window.selectedClient || window.selectedFornecedor) {
            const client = window.selectedClient || window.selectedFornecedor;
            console.log("ðŸ" Preenchendo dados do fornecedor:", client.nome || client.name);
            
            // Preencher campos
            const form = document.getElementById('clientForm');
            if (form) {
                document.getElementById('clientId').value = client.id || '';
                document.getElementById('clientName').value = client.nome || client.name || '';
                document.getElementById('clientCnpj').value = client.cnpj || '';
                document.getElementById('clientStateRegistration').value = client.inscricaoEstadual || client.stateRegistration || '';
                document.getElementById('clientState').value = client.estado || client.state || '';
                document.getElementById('clientCity').value = client.cidade || client.city || '';
                document.getElementById('clientPhone').value = client.telefone || client.phone || '';
                document.getElementById('clientEmail').value = client.email || '';
                document.getElementById('clientAddress').value = client.endereco || client.address || '';
                document.getElementById('clientNumber').value = client.numero || client.number || '';
                document.getElementById('clientNeighborhood').value = client.bairro || client.neighborhood || '';
                document.getElementById('clientObs').value = client.observacoes || client.observations || client.obs || '';
                
                // Atualizar tÃ­tulo
                const title = document.getElementById('clientModalTitle');
                if (title) title.textContent = 'Editar Fornecedor';
                
                console.log("âœ… Dados do fornecedor preenchidos no formulÃ¡rio");
            }
        } else {
            console.warn("âš ï¸ Nenhum fornecedor selecionado para ediÃ§Ã£o");
        }
    }, 100);
}

// âœ… FUNÃ‡ÃƒO PARA SALVAR FORNECEDOR (NOVA OU EDIÃ‡ÃƒO)
async function saveClient() {
    console.log("ðŸ'¾ === SALVANDO FORNECEDOR ===");
    
    try {
        const form = document.getElementById('clientForm');
        if (!form) {
            throw new Error("FormulÃ¡rio de fornecedor nÃ£o encontrado");
        }
        
        // Obter dados do formulÃ¡rio
        const id = document.getElementById('clientId').value.trim();
        const nome = document.getElementById('clientName').value.trim();
        const cnpj = document.getElementById('clientCnpj').value.trim();
        const inscricaoEstadual = document.getElementById('clientStateRegistration').value.trim();
        const estado = document.getElementById('clientState').value.trim();
        const cidade = document.getElementById('clientCity').value.trim();
        const telefone = document.getElementById('clientPhone').value.trim();
        const email = document.getElementById('clientEmail').value.trim();
        const endereco = document.getElementById('clientAddress').value.trim();
        const numero = document.getElementById('clientNumber').value.trim();
        const bairro = document.getElementById('clientNeighborhood').value.trim();
        const observacoes = document.getElementById('clientObs').value.trim();
        
        // ValidaÃ§Ãµes
        if (!nome) {
            alert('Nome do fornecedor Ã© obrigatÃ³rio!');
            document.getElementById('clientName').focus();
            return false;
        }
        
        if (!estado) {
            alert('Estado Ã© obrigatÃ³rio!');
            document.getElementById('clientState').focus();
            return false;
        }
        
        if (!cidade) {
            alert('Cidade Ã© obrigatÃ³ria!');
            document.getElementById('clientCity').focus();
            return false;
        }
        
        const isEdit = Boolean(id);
        console.log(`ðŸ" ${isEdit ? 'Editando' : 'Criando novo'} fornecedor:`, nome);
        
        // Preparar dados
        const clientData = {
            id: id || `client_${Date.now()}`,
            nome: nome,
            name: nome, // Compatibilidade
            cnpj: cnpj,
            inscricaoEstadual: inscricaoEstadual,
            stateRegistration: inscricaoEstadual, // Compatibilidade
            estado: estado,
            state: estado, // Compatibilidade
            cidade: cidade,
            city: cidade, // Compatibilidade
            telefone: telefone,
            phone: telefone, // Compatibilidade
            email: email,
            endereco: endereco,
            address: endereco, // Compatibilidade
            numero: numero,
            number: numero, // Compatibilidade
            bairro: bairro,
            neighborhood: bairro, // Compatibilidade
            observacoes: observacoes,
            observations: observacoes, // Compatibilidade
            obs: observacoes, // Compatibilidade adicional
            updatedAt: new Date().toISOString()
        };
        
        if (!isEdit) {
            clientData.createdAt = new Date().toISOString();
        }
        
        console.log("ðŸ"¦ Dados do fornecedor:", clientData);
        
        // Salvar no Firebase
        let saveResult;
        if (window.firebaseService && typeof window.firebaseService.saveToFirebase === 'function') {
            console.log("ðŸ"¥ Salvando no Firebase...");
            
            if (isEdit) {
                console.log(`🔥 Salvando em: fornecedores/${String(id)}`);
                saveResult = await window.firebaseService.saveToFirebase('fornecedores', String(id), clientData);
            } else {
                const newId = clientData.id || `client_${Date.now()}`;
                clientData.id = newId;
                console.log(`🔥 Salvando em: fornecedores/${String(newId)}`);
                saveResult = await window.firebaseService.saveToFirebase('fornecedores', String(newId), clientData);
            }
            
            console.log("âœ… Resultado do salvamento:", saveResult);
            
            if (saveResult && saveResult.success) {
                console.log("âœ… Fornecedor salvo no Firebase com sucesso");
                
                // Atualizar cache local (fornecedores)
                try {
                    let fornecedores = [];
                    const storageKey = getStorageKey('fornecedores');
                    const allowLegacy = storageKey === 'fornecedores';
                    const localData = localStorage.getItem(storageKey) || (allowLegacy ? localStorage.getItem('fornecedores') : null);
                    if (localData) {
                        fornecedores = JSON.parse(localData) || [];
                    }
                    
                    if (isEdit) {
                        // Atualizar fornecedor existente
                        const index = fornecedores.findIndex(c => String(c.id) === String(id));
                        if (index !== -1) {
                            fornecedores[index] = { ...fornecedores[index], ...clientData };
                        }
                    } else {
                        // Adicionar novo fornecedor
                        const newId = (saveResult && saveResult.id) || clientData.id;
                        fornecedores.push({ id: newId, ...clientData });
                    }
                    
                    persistLocalValue(storageKey, fornecedores);
                    window.fornecedores = fornecedores;
                    console.log("âœ… Cache local de fornecedores atualizado");
                } catch (cacheError) {
                    console.warn("âš ï¸ Erro ao atualizar cache local de fornecedores:", cacheError);
                }
                
                // Fechar modal
                closeClientModal();
                
                // Recarregar lista se estiver aberta
            const listModal = document.getElementById('clientListModal');
            if (listModal && listModal.style.display === 'block') {
                    console.log('Recarregando lista de fornecedores...');
                    await renderFornecedorList(document.getElementById('clientListFilter') ? document.getElementById('clientListFilter').value : '');
                }
                
                // Recarregar dados globais
                if (typeof window.carregarClientes === 'function') {
                    console.log("ðŸ"„ Recarregando fornecedores globalmente...");
                    await window.carregarClientes();
                }
                
                // Atualizar campo se este fornecedor estava sendo editado
            const clientInput = document.getElementById('clienteInput');
                if (clientInput && (isEdit || !clientInput.value)) {
                    clientInput.value = clientData.nome;
                    window.selectedClient = clientData;
                    window.selectedFornecedor = clientData;
                    console.log("âœ… Campo de fornecedor atualizado na interface");
                }
                
                // Notificar usuÃ¡rio
                const mensagem = isEdit ? 
                    `Fornecedor "${nome}" atualizado com sucesso!` : 
                    `Fornecedor "${nome}" cadastrado com sucesso!`;
            alert(mensagem);
            
            return true;
        } else {
                throw new Error(saveResult?.error || "Erro desconhecido ao salvar");
            }
        } else {
            throw new Error("Firebase Service nÃ£o disponÃ­vel");
        }
        
    } catch (error) {
        console.error("âŒ Erro ao salvar fornecedor:", error);
        alert(`Erro ao salvar fornecedor: ${error.message}`);
        return false;
    }
}

// âœ… EXPORTAÃ‡Ã•ES GLOBAIS PARA FORNECEDORES
window.openNewClientModal = openNewClientModal;
window.openEditClientModal = openEditClientModal;
window.saveClient = saveClient;
window.closeClientModal = closeClientModal;

console.log("âœ… FunÃ§Ãµes de fornecedores exportadas globalmente para romaneio de tora");

// Exportar funções de lista de fornecedores
window.openFornecedorListModal = openFornecedorListModal;
window.renderFornecedorList = renderFornecedorList;

window.addEventListener('clients:updated', async function() {
    try {
        const listModal = document.getElementById('clientListModal');
        if (listModal && listModal.style.display === 'block') {
            const filterInput = document.getElementById('clientListFilter');
            const currentFilter = filterInput ? filterInput.value : '';
            await renderFornecedorList(currentFilter);
        }
    } catch(_) {}
});

window.addEventListener('fornecedores:updated', async function() {
    try {
        const listModal = document.getElementById('clientListModal');
        if (listModal && listModal.style.display === 'block') {
            const filterInput = document.getElementById('clientListFilter');
            const currentFilter = filterInput ? filterInput.value : '';
            await renderFornecedorList(currentFilter);
        }
    } catch(_) {}
});

// ======================================
// ðŸš€ NAVEGAÃ‡ÃƒO COM TECLA ENTER ENTRE CAMPOS
// ======================================

/**
 * Sistema de navegaÃ§Ã£o com tecla Enter entre campos do formulÃ¡rio
 * Implementa a sequÃªncia: PreÃ§o â†’ Plaqueta â†’ Rodo â†’ Comprimento â†’ Oco 1 â†’ Oco 2
 * Ao pressionar Enter em Oco 2, adiciona o item Ã  tabela
 */

// Sistema de controle de inicializaÃ§Ã£o para evitar duplicaÃ§Ã£o
if (!window.enterNavigationSystem) {
    window.enterNavigationSystem = {
        initialized: false,
        fieldSequence: ['preco', 'plaqueta', 'rodo', 'comprimento', 'oco1', 'oco2'],
        configuredFields: new Set()
    };
}

/**
 * FunÃ§Ã£o para configurar navegaÃ§Ã£o com tecla Enter entre campos
 */
function configureEnterKeyNavigation() {
    // Verificar se jÃ¡ foi inicializado
    if (window.enterNavigationSystem.initialized) {
        console.log("âš ï¸ NavegaÃ§Ã£o com Enter jÃ¡ foi configurada anteriormente");
        return;
    }
    
    console.log("ðŸš€ Configurando navegaÃ§Ã£o com tecla Enter entre campos...");
    
    const fieldSequence = window.enterNavigationSystem.fieldSequence;
    let configuredCount = 0;
    
    // Configurar cada campo na sequÃªncia
    fieldSequence.forEach((fieldId, index) => {
        const field = document.getElementById(fieldId);
        
        if (!field) {
            console.warn(`âš ï¸ Campo '${fieldId}' nÃ£o encontrado para configurar navegaÃ§Ã£o com Enter`);
        return;
    }
    
        // Verificar se este campo jÃ¡ foi configurado
        if (window.enterNavigationSystem.configuredFields.has(fieldId)) {
            console.log(`ðŸ" Campo '${fieldId}' jÃ¡ foi configurado anteriormente`);
            configuredCount++;
            return;
        }
        
        // Remover listeners anteriores (se existirem) clonando o elemento
        const newField = field.cloneNode(true);
        field.parentNode.replaceChild(newField, field);
        
        // Adicionar evento keydown para navegaÃ§Ã£o com Enter
        newField.addEventListener('keydown', function(e) {
            if (e.key === 'Enter') {
                e.preventDefault(); // Prevenir comportamento padrÃ£o do Enter
                
                if (index < fieldSequence.length - 1) {
                    // Se nÃ£o for o Ãºltimo campo, mover para o prÃ³ximo
                    const nextFieldId = fieldSequence[index + 1];
                    const nextField = document.getElementById(nextFieldId);
                    
                    if (nextField) {
                        nextField.focus();
                        console.log(`ðŸ"„ Foco movido de '${fieldId}' para '${nextFieldId}'`);
                    } else {
                        console.warn(`âš ï¸ PrÃ³ximo campo '${nextFieldId}' nÃ£o encontrado`);
                    }
                } else {
                    // Se for o Ãºltimo campo (oco2), adicionar o item Ã  tabela
                    console.log("ðŸŽ¯ Enter pressionado no Ãºltimo campo (oco2) - adicionando item");
                    
                    if (typeof window.adicionarItem === 'function') {
                        window.adicionarItem();
                        
                        // Retornar foco para o campo 'plaqueta' apÃ³s adicionar o item
                        setTimeout(() => {
                            const firstField = document.getElementById('plaqueta');
                            if (firstField) {
                                firstField.focus();
                                firstField.select(); // Selecionar texto para facilitar ediÃ§Ã£o
                                console.log("ðŸ"„ Foco retornou para o campo 'plaqueta'");
                            }
                        }, 150); // Delay pequeno para permitir que a adiÃ§Ã£o seja concluÃ­da
                        
                    } else {
                        console.error("âŒ FunÃ§Ã£o 'adicionarItem' nÃ£o encontrada ao pressionar Enter no campo 'oco2'");
                        alert("Erro: FunÃ§Ã£o para adicionar item nÃ£o encontrada!");
                    }
                }
            }
        });
        
        // Marcar campo como configurado
        window.enterNavigationSystem.configuredFields.add(fieldId);
        configuredCount++;
        
        console.log(`âœ… Campo '${fieldId}' configurado para navegaÃ§Ã£o com Enter (${index + 1}/${fieldSequence.length})`);
    });
    
    // Marcar sistema como inicializado
    window.enterNavigationSystem.initialized = true;
    
    console.log(`ðŸŽ‰ NavegaÃ§Ã£o com Enter configurada com sucesso! ${configuredCount}/${fieldSequence.length} campos configurados`);
    
    if (configuredCount < fieldSequence.length) {
        console.warn(`âš ï¸ Alguns campos nÃ£o foram encontrados: ${fieldSequence.length - configuredCount} faltando`);
    }
}

/**
 * FunÃ§Ã£o para formatar o campo de preÃ§o com mÃ¡scara de moeda brasileira
 */
function setupPriceFieldFormatting() {
    const priceField = document.getElementById('preco');
    
    if (!priceField) {
        console.warn("âš ï¸ Campo de preÃ§o nÃ£o encontrado para formataÃ§Ã£o");
            return;
        }
        
    // Verificar se jÃ¡ foi configurado
    if (priceField.hasAttribute('data-price-formatting-configured')) {
        console.log("ðŸ" FormataÃ§Ã£o do campo de preÃ§o jÃ¡ foi configurada");
        return;
    }
    
    console.log("ðŸ'° Configurando formataÃ§Ã£o do campo de preÃ§o...");
    
    // Formatar como moeda ao perder o foco
    priceField.addEventListener('blur', function() {
        if (this.value.trim()) {
            // Remover formataÃ§Ã£o anterior e converter para nÃºmero
            const rawValue = this.value.replace(/[^\d.,]/g, '').replace(',', '.');
            const numericValue = parseFloat(rawValue);
            
            if (!isNaN(numericValue) && numericValue > 0) {
                // Formatar como moeda brasileira
                this.value = numericValue.toLocaleString('pt-BR', {
                    minimumFractionDigits: 2,
                    maximumFractionDigits: 2
                });
                console.log(`ðŸ'° PreÃ§o formatado: ${this.value}`);
            }
        }
    });
    
    // Limpar formataÃ§Ã£o ao focar para facilitar ediÃ§Ã£o
    priceField.addEventListener('focus', function() {
        if (this.value) {
            const rawValue = this.value.replace(/[^\d.,]/g, '').replace(',', '.');
            const numericValue = parseFloat(rawValue);
            
            if (!isNaN(numericValue)) {
                this.value = numericValue.toString().replace('.', ',');
            }
        }
        // Selecionar todo o texto para facilitar ediÃ§Ã£o
        this.select();
    });
    
    // Marcar como configurado
    priceField.setAttribute('data-price-formatting-configured', 'true');
    console.log("âœ… FormataÃ§Ã£o do campo de preÃ§o configurada");
}

/**
 * FunÃ§Ã£o principal de inicializaÃ§Ã£o do sistema de navegaÃ§Ã£o
 */
function initializeEnterNavigation() {
    console.log("ðŸ"§ Inicializando sistema de navegaÃ§Ã£o com Enter...");
    
    // Configurar navegaÃ§Ã£o entre campos
    configureEnterKeyNavigation();
    
    // Configurar formataÃ§Ã£o do campo de preÃ§o
    setupPriceFieldFormatting();
    
    console.log("ðŸŽ‰ Sistema de navegaÃ§Ã£o com Enter inicializado com sucesso!");
}

// ======================================
// ðŸ"„ INICIALIZAÃ‡ÃƒO AUTOMÃTICA
// ======================================

/**
 * Inicializar sistema quando DOM estiver pronto
 */
function initializeWhenReady() {
    if (document.readyState === "complete" || document.readyState === "interactive") {
        // DOM jÃ¡ estÃ¡ pronto
        setTimeout(initializeEnterNavigation, 100);
        } else {
        // Aguardar o DOM ficar pronto
        document.addEventListener("DOMContentLoaded", function() {
            setTimeout(initializeEnterNavigation, 200);
        });
    }
}

// Inicializar sistema
initializeWhenReady();

// ======================================
// ðŸŒ EXPORTAÃ‡Ã•ES GLOBAIS
// ======================================

// Exportar funÃ§Ãµes para uso global
window.configureEnterKeyNavigation = configureEnterKeyNavigation;
window.setupPriceFieldFormatting = setupPriceFieldFormatting;
window.initializeEnterNavigation = initializeEnterNavigation;

console.log("ðŸš€ Sistema de navegaÃ§Ã£o com Enter exportado globalmente");

// ===== SISTEMA DE LISTAGEM DE ROMANEIOS =====

// âœ… FUNÃ‡ÃƒO DE DEBUG PARA TESTAR CONEXÃƒO COM FIREBASE
async function debugFirebaseConnection() {
    console.log("ðŸ" === DEBUG FIREBASE CONNECTION ===");
    
    // Verificar se Firebase Service existe
    console.log("ðŸ"¥ Firebase Service:", !!window.firebaseService);
    
    if (window.firebaseService) {
        console.log("ðŸ"§ Firebase Service methods:", Object.keys(window.firebaseService));
        console.log("ðŸ"§ loadFromFirebase:", typeof window.firebaseService.loadFromFirebase);
        console.log("ðŸ"§ isOperational:", typeof window.firebaseService.isOperational);
        
        if (typeof window.firebaseService.isOperational === 'function') {
            console.log("âœ… Firebase Operational:", window.firebaseService.isOperational());
        }
    }
    
    // Verificar localStorage como backup
    try {
        const storageKey = getStorageKey('romaneiosTora');
        const allowLegacy = storageKey === 'romaneiosTora';
        const localData = localStorage.getItem(storageKey) || (allowLegacy ? localStorage.getItem('romaneiosTora') : null);
        if (localData) {
            const parsed = JSON.parse(localData);
            console.log("ðŸ"± localStorage romaneiosTora:", Array.isArray(parsed) ? `${parsed.length} itens` : typeof parsed);
        } else {
            console.log("ðŸ"± localStorage romaneiosTora: vazio");
        }
    } catch (error) {
        console.error("âŒ Erro ao acessar localStorage:", error);
    }
    
    console.log("ðŸ" === FIM DEBUG ===");
}

// FunÃ§Ã£o para abrir a lista de romaneios
async function abrirListaRomaneios() {
    console.log("ðŸ"¥ === ABRINDO LISTA DE ROMANEIOS (100% FIREBASE) ===");
    
    // âœ… EXECUTAR DEBUG PRIMEIRO
    await debugFirebaseConnection();
    
    try {
        // âœ… EXECUTAR LIMPEZA AUTOMÃTICA DE ROMANEIOS INVÃLIDOS
        console.log("ðŸ§¹ Executando limpeza automÃ¡tica de romaneios invÃ¡lidos...");
        try {
            const cleanupResult = await limparRomaneiosInvalidos();
            if (cleanupResult.removed > 0) {
                console.log(`ðŸ§¹ Limpeza concluÃ­da: ${cleanupResult.removed} romaneios invÃ¡lidos removidos`);
            } else {
                console.log("âœ… Nenhum romaneio invÃ¡lido encontrado");
            }
        } catch (cleanupError) {
            console.warn("âš ï¸ Erro na limpeza automÃ¡tica:", cleanupError);
            // Continuar mesmo se a limpeza falhar
        }
        
        // âœ… USAR O MODAL EXISTENTE NO HTML AO INVÃ‰S DE CRIAR NOVO
        let modal = document.getElementById('listaModal');
    
    if (!modal) {
            console.log("ðŸ"‹ Modal nÃ£o encontrado no HTML, criando novo...");
            // Criar o modal apenas se nÃ£o existir
        modal = document.createElement('div');
            modal.id = 'listaModal';
        modal.className = 'modal';
        
        modal.innerHTML = `
            <div class="modal-content modal-large">
                <div class="modal-header" style="background-color: #2c3e50; color: white;">
                    <h3 class="modal-title">Lista de Romaneios de Tora</h3>
                        <span class="close-modal" style="color: white; cursor: pointer;">&times;</span>
                </div>
                <div class="modal-body">
                        <div style="margin-bottom: 15px;">
                            <input type="text" id="romaneioListFilter" placeholder="Filtrar por fornecedor, espÃ©cie ou data..." 
                                   style="width: 100%; padding: 10px; border: 1px solid #ddd; border-radius: 4px; font-size: 14px;">
                        </div>
                        <div class="table-container" style="max-height: 500px; overflow-y: auto; overflow-x: visible; position: relative;">
                            <table class="table" style="width: 100%;">
                                <thead style="position: sticky; top: 0; background-color: #2c3e50; color: white; z-index: 1;">
                                    <tr>
                                        <th style="padding: 10px;">Data</th>
                                        <th style="padding: 10px;">Fornecedor</th>
                                        <th style="padding: 10px;">EspÃ©cies</th>
                                        <th style="padding: 10px;">Itens</th>
                                        <th style="padding: 10px;">Volume (mÂ³)</th>
                                        <th style="padding: 10px;">Valor Total</th>
                                        <th style="padding: 10px; width: 120px; text-align: center;">AÃ§Ãµes</th>
                                </tr>
                            </thead>
                            <tbody id="romaneioListTable">
                                    <tr>
                                        <td colspan="7" style="text-align: center; padding: 20px;">
                                            <i class="fas fa-spinner fa-spin"></i> Carregando romaneios...
                                        </td>
                                    </tr>
                            </tbody>
                        </table>
                    </div>
                </div>
                <div class="modal-footer">
                    <button type="button" class="back-button close-modal-btn">Fechar</button>
                </div>
            </div>
        `;
        
        document.body.appendChild(modal);
        } else {
            console.log("âœ… Usando modal existente no HTML");
            
            // âœ… ATUALIZAR O CONTEÃšDO DO MODAL EXISTENTE PARA INCLUIR TABELA DE ROMANEIOS
            const modalBody = modal.querySelector('.modal-body');
            if (modalBody) {
                modalBody.innerHTML = `
                    <div style="margin-bottom: 15px;">
                        <input type="text" id="romaneioListFilter" placeholder="Filtrar por fornecedor, espÃ©cie ou data..." 
                               style="width: 100%; padding: 10px; border: 1px solid #ddd; border-radius: 4px; font-size: 14px;">
                    </div>
                    <div class="table-container" style="max-height: 500px; overflow-y: auto; overflow-x: visible; position: relative;">
                        <table class="table" style="width: 100%;">
                            <thead style="position: sticky; top: 0; background-color: #2c3e50; color: white; z-index: 1;">
                                <tr>
                                    <th style="padding: 10px;">Data</th>
                                    <th style="padding: 10px;">Fornecedor</th>
                                    <th style="padding: 10px;">EspÃ©cies</th>
                                    <th style="padding: 10px;">Itens</th>
                                    <th style="padding: 10px;">Volume (mÂ³)</th>
                                    <th style="padding: 10px;">Valor Total</th>
                                    <th style="padding: 10px; width: 120px; text-align: center;">AÃ§Ãµes</th>
                                </tr>
                            </thead>
                            <tbody id="romaneioListTable">
                                    <tr>
                                        <td colspan="7" style="text-align: center; padding: 20px;">
                                            <i class="fas fa-spinner fa-spin"></i> Carregando romaneios...
                                        </td>
                                    </tr>
                            </tbody>
                        </table>
                    </div>
                `;
            }
            
            // âœ… ADICIONAR BOTÃƒO DE LIMPEZA NO FOOTER SE NÃƒO EXISTIR
            const modalFooter = modal.querySelector('.modal-footer');
            if (modalFooter && !modalFooter.querySelector('.cleanup-button')) {
                // âœ… BOTÃ•ES REMOVIDOS - Limpar InvÃ¡lidos e Detectar Duplicados 
                // Mantendo apenas o botÃ£o Fechar padrÃ£o do modal
            }
        }
        
        // âœ… CONFIGURAR EVENTOS DO MODAL (SEMPRE EXECUTAR)
        const closeBtn = modal.querySelector('.close-modal');
        if (closeBtn) {
            closeBtn.onclick = () => {
                fecharTodosDropdownsLista(); // Fechar dropdowns antes de fechar modal
                modal.style.display = 'none';
            };
        }
        
        const closeBtns = modal.querySelectorAll('.close-modal-btn');
        closeBtns.forEach(btn => {
            btn.onclick = () => {
                fecharTodosDropdownsLista(); // Fechar dropdowns antes de fechar modal
                modal.style.display = 'none';
            };
        });
        
        // Configurar campo de filtro
        const filterInput = modal.querySelector('#romaneioListFilter');
        if (filterInput) {
            // Limpar eventos anteriores
            const newFilterInput = filterInput.cloneNode(true);
            filterInput.parentNode.replaceChild(newFilterInput, filterInput);
            
            // Adicionar novo evento
            newFilterInput.addEventListener('input', function() {
                renderRomaneioList(this.value);
            });
        }
        
        // Fechar modal ao clicar fora
        modal.onclick = function(e) {
            if (e.target === modal) {
                fecharTodosDropdownsLista(); // Fechar dropdowns antes de fechar modal
                modal.style.display = 'none';
            }
        };
    
        // âœ… RENDERIZAR LISTA DE ROMANEIOS
        await renderRomaneioList('');
    
        // âœ… EXIBIR O MODAL
    modal.style.display = 'block';
        
    } catch (error) {
        console.error("âŒ Erro ao abrir lista de romaneios:", error);
        if (window.Utils && window.Utils.showToast) window.Utils.showToast("Erro ao carregar lista de romaneios: " + error.message, 'error');
    }
}

// FunÃ§Ã£o para renderizar a lista de romaneios com dados do Firebase
async function renderRomaneioList(filter = '') {
    console.log(`ðŸ"‹ Renderizando lista de romaneios com filtro: "${filter}"`);
    
    try {
        // Obter referÃªncia ao elemento tbody
        const tbody = document.getElementById('romaneioListTable');
        if (!tbody) {
            console.error("âŒ Elemento romaneioListTable nÃ£o encontrado");
            return;
        }
        
        // Mostrar loading
        tbody.innerHTML = `
            <tr>
                <td colspan="7" style="text-align: center; padding: 20px;">
                    <i class="fas fa-spinner fa-spin"></i> Carregando romaneios do Firebase...
                </td>
            </tr>
        `;
        
        // âœ… FUNÃ‡ÃƒO AUXILIAR PARA VALIDAR ROMANEIO (mesma da excluirRomaneio)
        function isValidRomaneio(romaneio) {
            if (!romaneio || typeof romaneio !== 'object') {
                console.log("âŒ Romaneio invÃ¡lido: nÃ£o Ã© objeto");
                return false;
            }
            
            // Verificar se tem ID vÃ¡lido
            if (!romaneio.id && !romaneio.firebaseKey) {
                console.log("âŒ Romaneio invÃ¡lido: sem ID");
                return false;
            }
            
            // Verificar se tem dados bÃ¡sicos (ao menos data ou fornecedor)
            const hasBasicData = romaneio.data || 
                                romaneio.fornecedor || 
                                romaneio.cliente || 
                                (romaneio.itens && Array.isArray(romaneio.itens) && romaneio.itens.length > 0);
            
            if (!hasBasicData) {
                console.log("âŒ Romaneio invÃ¡lido: sem dados bÃ¡sicos", romaneio);
                return false;
            }
            
            return true;
        }
        
        // âœ… CARREGAR ROMANEIOS DO FIREBASE USANDO A FUNÃ‡ÃƒO LOCAL
        let romaneios = [];
        
        try {
            console.log("ðŸ" Iniciando carregamento de romaneiosTora...");
            let romaneiosData = await getData('romaneios/tora');
            try {
                const tombKey = getStorageKey('romaneiosTora_deletedIds');
                const allowLegacy = tombKey === 'romaneiosTora_deletedIds';
                const tomb = JSON.parse(localStorage.getItem(tombKey) || (allowLegacy ? localStorage.getItem('romaneiosTora_deletedIds') : null) || '[]').map(String);
                if (Array.isArray(tomb) && tomb.length > 0) {
                    if (Array.isArray(romaneiosData)) {
                        romaneiosData = romaneiosData.filter(r => !tomb.includes(String(r.id)) && !tomb.includes(String(r.firebaseKey)));
                    } else if (romaneiosData && typeof romaneiosData === 'object') {
                        const keys = Object.keys(romaneiosData);
                        keys.forEach(k => {
                            const v = romaneiosData[k];
                            const idCand = String((v && v.id) || k);
                            if (tomb.includes(idCand)) { delete romaneiosData[k]; }
                        });
                    }
                }
            } catch (_) {}
            console.log(`âœ… getData retornou:`, romaneiosData);
            console.log(`ðŸ"Š Tipo dos dados:`, typeof romaneiosData, Array.isArray(romaneiosData) ? `Array com ${romaneiosData.length} itens` : 'NÃ£o Ã© array');
            
            // âœ… CONVERTER OBJETO FIREBASE PARA ARRAY COM VALIDAÃ‡ÃƒO RIGOROSA
            if (romaneiosData && typeof romaneiosData === 'object' && !Array.isArray(romaneiosData)) {
                console.log("ðŸ"„ Convertendo objeto Firebase para array...");
                
                Object.keys(romaneiosData).forEach(key => {
                    const romaneio = romaneiosData[key];
                    let romaneioProcessado = null;
                    
                    // Se o romaneio Ã© um array (dados aninhados), pegar o primeiro item
                    if (Array.isArray(romaneio) && romaneio.length > 0) {
                        const firstItem = romaneio[0];
                        if (isValidRomaneio(firstItem)) {
                            romaneioProcessado = {
                                ...firstItem,
                                id: firstItem.id || key, // Usar ID existente ou a chave Firebase
                                firebaseKey: key // Manter referÃªncia da chave original
                            };
                        }
                    }
                    // Se Ã© um objeto direto
                    else if (romaneio && typeof romaneio === 'object') {
                        if (isValidRomaneio(romaneio)) {
                            romaneioProcessado = {
                                ...romaneio,
                                id: romaneio.id || key,
                                firebaseKey: key
                            };
                        }
                    }
                    
                    // SÃ³ adicionar se passou na validaÃ§Ã£o
                    if (romaneioProcessado) {
                        romaneios.push(romaneioProcessado);
                        console.log(`âœ… Romaneio vÃ¡lido processado: ${romaneioProcessado.id}`);
                    } else {
                        console.log(`âš ï¸ Romaneio invÃ¡lido ignorado na chave: ${key}`, romaneio);
                    }
                });
                
                console.log(`ðŸ"¦ Convertidos ${romaneios.length} romaneios VÃLIDOS do formato Firebase`);
            }
            // Se jÃ¡ Ã© um array, filtrar apenas os vÃ¡lidos
            else if (Array.isArray(romaneiosData)) {
                romaneios = romaneiosData.filter(romaneio => {
                    const isValid = isValidRomaneio(romaneio);
                    if (!isValid) {
                        console.log("âš ï¸ Romaneio invÃ¡lido removido do array:", romaneio);
                    }
                    return isValid;
                });
                console.log(`ðŸ"‹ Filtrados ${romaneios.length} romaneios VÃLIDOS do array: ${romaneiosData.length} -> ${romaneios.length}`);
            }
            // Se Ã© null ou undefined
            else {
                romaneios = [];
                console.log("ðŸ"­ Nenhum dado encontrado (null/undefined)");
            }
            
        } catch (getDataError) {
            console.error("âŒ Erro ao chamar getData:", getDataError);
            tbody.innerHTML = `
                <tr>
                    <td colspan="7" style="text-align: center; padding: 20px; color: #e74c3c;">
                        <i class="fas fa-exclamation-triangle"></i> Erro ao carregar dados: ${getDataError.message}
                    </td>
                </tr>
            `;
            return;
        }
        
        // Verificar se hÃ¡ romaneios para mostrar
        if (!Array.isArray(romaneios)) {
            console.warn("âš ï¸ Dados ainda nÃ£o sÃ£o um array apÃ³s conversÃ£o:", romaneios);
            romaneios = [];
        }
        
        if (romaneios.length === 0) {
            console.log("ðŸ"­ Nenhum romaneio VÃLIDO encontrado");
            tbody.innerHTML = `
                <tr>
                    <td colspan="7" style="text-align: center; padding: 20px; color: #7f8c8d;">
                        <i class="fas fa-inbox"></i> Nenhum romaneio encontrado
                        <br><small style="margin-top: 10px; display: block;">
                            Todos os romaneios foram validados e filtrados
                        </small>
                    </td>
                </tr>
            `;
            return;
        }
        
        console.log(`ðŸ"‹ ${romaneios.length} romaneios VÃLIDOS encontrados`);
        
        // Filtrar romaneios se necessÃ¡rio
        let romaneiosFiltrados = romaneios;
        if (filter && filter.trim() !== '') {
            const filterLower = filter.toLowerCase().trim();
            romaneiosFiltrados = romaneios.filter(romaneio => {
                // Filtrar por fornecedor
                const fornecedorNome = romaneio.fornecedor ? 
                    (romaneio.fornecedor.nome || '').toLowerCase() : '';
                
                // Filtrar por espÃ©cies
                const especies = romaneio.itens && Array.isArray(romaneio.itens) ? 
                    romaneio.itens.map(item => (item.especie || '').toLowerCase()).join(' ') : '';
                
                // Filtrar por data
                const dataStr = romaneio.data ? 
                    new Date(romaneio.data).toLocaleDateString('pt-BR') : '';
                
                return fornecedorNome.includes(filterLower) || 
                       especies.includes(filterLower) || 
                       dataStr.includes(filterLower);
            });
        }
        
        // Ordenar romaneios por data (mais recentes primeiro)
        romaneiosFiltrados.sort((a, b) => {
            const dateA = new Date(a.data || 0);
            const dateB = new Date(b.data || 0);
            return dateB - dateA;
        });
        
        console.log(`ðŸ"Š ${romaneiosFiltrados.length} romaneios VÃLIDOS apÃ³s filtro`);
        
        // Limpar o tbody
        tbody.innerHTML = '';
        
        // Adicionar cada romaneio Ã  tabela
        romaneiosFiltrados.forEach((romaneio, index) => {
            console.log(`ðŸ"„ Processando romaneio ${index + 1}:`, romaneio);
            
            // âœ… VALIDAÃ‡ÃƒO ADICIONAL ANTES DE RENDERIZAR
            if (!isValidRomaneio(romaneio)) {
                console.log(`âš ï¸ Pulando romaneio invÃ¡lido durante renderizaÃ§Ã£o:`, romaneio);
                return; // Pular este romaneio
            }
            
            // Formatar data para exibiÃ§Ã£o
            const data = romaneio.data ? new Date(romaneio.data) : new Date();
            const dataFormatada = data.toLocaleDateString('pt-BR');
            
            // Fornecedor
            const fornecedor = romaneio.fornecedor ? 
                (romaneio.fornecedor.nome || 'NÃ£o informado') : 
                (romaneio.cliente ? romaneio.cliente.nome || 'NÃ£o informado' : 'NÃ£o informado');
            
            // EspÃ©cies - pegar todas as espÃ©cies Ãºnicas
            const especies = romaneio.itens && Array.isArray(romaneio.itens) ? 
                [...new Set(romaneio.itens.map(item => item.especie || 'N/A'))]
                .filter(Boolean).join(', ') : 'N/A';
            
            // NÃºmero de itens
            const numItens = romaneio.itens && Array.isArray(romaneio.itens) ? 
                romaneio.itens.length : 0;
            
            // âœ… CALCULAR TOTAIS USANDO A MESMA LÃ"GICA DE VERIFICAÃ‡ÃƒO E CORREÃ‡ÃƒO
            let volumeTotal = 0;
            let valorTotal = 0;
            
            if (romaneio.itens && Array.isArray(romaneio.itens) && romaneio.itens.length > 0) {
                console.log(`ðŸ'° Calculando totais para romaneio ${romaneio.id} com ${romaneio.itens.length} itens...`);
                
                romaneio.itens.forEach((item, itemIndex) => {
                    console.log(` ðŸ"„ Processando item ${itemIndex + 1}:`, item);
                    
                    // âœ… USAR A FUNÃ‡ÃƒO DE VERIFICAÃ‡ÃƒO E CORREÃ‡ÃƒO DE CÃLCULOS
                    const itemCorrigido = verificarECorrigirCalculos(item);
                    
                    console.log(` âœ… Item ${itemIndex + 1} corrigido:`, {
                        volumeLiquido: itemCorrigido.volumeLiquido,
                        preco: itemCorrigido.preco,
                        valor: itemCorrigido.valor
                    });
                    
                    // Usar valores corrigidos para os totais
                    volumeTotal += (window.toNumberBR ? window.toNumberBR(itemCorrigido.volumeLiquido || itemCorrigido.volumeSerraria || 0) : parseFloat(String(itemCorrigido.volumeLiquido || itemCorrigido.volumeSerraria || 0).replace(/\./g,'').replace(/,/g,'.')) || 0);
                    valorTotal += parseFloat(itemCorrigido.valor || 0);
                });
                
                console.log(`ðŸ'° Totais calculados para romaneio ${romaneio.id}:`);
                console.log(` ðŸ"Š Volume Total: ${volumeTotal.toFixed(3)} mÂ³`);
                console.log(` ðŸ'° Valor Total: R$ ${valorTotal.toFixed(2)}`);
            } else {
                console.log(`âš ï¸ Romaneio ${romaneio.id} nÃ£o tem itens vÃ¡lidos`);
            }
            
            // Formatar valores para exibiÃ§Ã£o
            const volumeFormatado = (Number.isFinite(volumeTotal) ? volumeTotal : 0).toFixed(3).replace('.', ',');
            const valorFormatado = valorTotal > 0 ? 
                `R$ ${valorTotal.toLocaleString('pt-BR', {minimumFractionDigits: 2, maximumFractionDigits: 2})}` : 
                'R$ 0,00';
            
            // Criar a linha da tabela
            const tr = document.createElement('tr');
            tr.style.backgroundColor = index % 2 === 0 ? '#f9f9f9' : '#ffffff';
            tr.style.borderBottom = '1px solid #ddd';
            
            // âœ… USAR CHAVE FIREBASE ÃšNICA PARA AÃ‡Ã•ES AO INVÃ‰S DO ID DUPLICADO
            const romaneioUniqueKey = romaneio.firebaseKey || romaneio.id;
            const displayId = romaneio.id || romaneioUniqueKey;
            
            // âœ… Identificar a linha na UI para remoÃ§Ã£o otimista pÃ³s-exclusÃ£o
            try {
                tr.id = `romaneioRow_${romaneioUniqueKey}`;
                tr.setAttribute('data-romaneio-key', romaneioUniqueKey);
            } catch (_) {
                // silencioso
            }
            
            // âœ… ADICIONAR INFORMAÃ‡Ã•ES DE DEBUG PARA IDENTIFICAR ROMANEIOS DUPLICADOS
            let debugInfo = '';
            if (romaneio.firebaseKey && romaneio.id !== romaneio.firebaseKey) {
                debugInfo = ` title="Firebase Key: ${romaneio.firebaseKey} | ID: ${romaneio.id}"`;
            }
            
            tr.innerHTML = `
                <td style="padding: 10px;"${debugInfo}>${dataFormatada}</td>
                <td style="padding: 10px; font-weight: 500;"${debugInfo}>${fornecedor}</td>
                <td style="padding: 10px; max-width: 200px; overflow: hidden; text-overflow: ellipsis;" title="${especies}">${especies}</td>
                <td style="padding: 10px; text-align: center;">${numItens}</td>
                <td style="padding: 10px; text-align: right; font-weight: 500;">${volumeFormatado}</td>
                <td style="padding: 10px; text-align: right; font-weight: 500; color: #27ae60;">${valorFormatado}</td>
                <td style="padding: 10px; text-align: center;">
                    <div style="display: flex; justify-content: center; align-items: center; gap: 6px;">
                        <!-- âœ… MENU AVANÃ‡ADO DE IMPRESSÃƒO ORGANIZADO COM Z-INDEX ALTO -->
                        <div class="dropdown action-dropdown" style="position: relative;">
                            <button class="client-action-button dropdown-toggle" 
                                    style="background-color: #3498db; color: white; padding: 6px 10px; border: none; border-radius: 4px; cursor: pointer; display: flex; align-items: center; justify-content: center; gap: 4px; min-width: 38px; height: 34px;" 
                                    onclick="toggleImprimirDropdownLista(event, '${romaneioUniqueKey}', ${index})" 
                                    title="OpÃ§Ãµes de ImpressÃ£o">
                                <i class="fas fa-print" style="font-size: 13px;"></i>
                                <i class="fas fa-caret-down" style="font-size: 10px;"></i>
                            </button>
                            <div class="dropdown-menu dropdown-menu-right" id="printDropdownLista${index}" 
                                 style="display: none; position: fixed; background-color: white; min-width: 220px; 
                                        box-shadow: 0px 8px 24px 0px rgba(0,0,0,0.3); z-index: 99999; border-radius: 6px; 
                                        border: 1px solid #ddd; padding: 8px 0; margin-top: 4px;
                                        font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;">
                                <h6 style="display: block; padding: 8px 16px; margin: 0; font-size: 12px; color: #6c757d; 
                                           font-weight: 600; border-bottom: 1px solid #e9ecef; background-color: #f8f9fa;">
                                    ðŸ"„ Formato da ImpressÃ£o
                                </h6>
                                <button onclick="window.imprimirRomaneioTora('${romaneioUniqueKey}', 'completo')" 
                                        style="color: #333; padding: 10px 16px; text-decoration: none; display: flex; align-items: center;
                                               border: none; background: none; width: 100%; text-align: left; cursor: pointer; 
                                               font-size: 13px; transition: background-color 0.2s;"
                                        onmouseover="this.style.backgroundColor='#f1f3f4'" 
                                        onmouseout="this.style.backgroundColor='transparent'">
                                    <i class="fas fa-file-alt" style="margin-right: 12px; width: 16px; color: #28a745;"></i> 
                                    Completo (com preÃ§os)
                                </button>
                                <button onclick="window.imprimirRomaneioTora('${romaneioUniqueKey}', 'sem_preco_unitario')" 
                                        style="color: #333; padding: 6px 15px; text-decoration: none; display: block; border: none; background: none; width: 100%; text-align: left; cursor: pointer; font-size: 12px;"
                                        onmouseover="this.style.backgroundColor='#f1f1f1'" 
                                        onmouseout="this.style.backgroundColor='transparent'">
                                    <i class="fas fa-file-invoice" style="margin-right: 8px; width: 12px;"></i> Sem preÃ§os unitÃ¡rios
                                </button>
                                <button onclick="window.imprimirRomaneioTora('${romaneioUniqueKey}', 'sem_preco')" 
                                        style="color: #333; padding: 6px 15px; text-decoration: none; display: block; border: none; background: none; width: 100%; text-align: left; cursor: pointer; font-size: 12px;"
                                        onmouseover="this.style.backgroundColor='#f1f1f1'" 
                                        onmouseout="this.style.backgroundColor='transparent'">
                                    <i class="fas fa-file" style="margin-right: 8px; width: 12px;"></i> Sem valores
                                </button>
                                <div style="height: 0; margin: 5px 0; overflow: hidden; border-top: 1px solid #e9ecef;"></div>
                                <h6 style="display: block; padding: 5px 15px; margin: 0; font-size: 11px; color: #6c757d; font-weight: bold;">ðŸ"Š Exportar</h6>
                                <button onclick="exportarRomaneioExcelFirebase('${romaneioUniqueKey}')" 
                                        style="color: #333; padding: 6px 15px; text-decoration: none; display: block; border: none; background: none; width: 100%; text-align: left; cursor: pointer; font-size: 12px;"
                                        onmouseover="this.style.backgroundColor='#f1f1f1'" 
                                        onmouseout="this.style.backgroundColor='transparent'">
                                    <i class="fas fa-file-excel" style="margin-right: 8px; width: 12px;"></i> Exportar para Excel
                                </button>
                                <button onclick="gerarRelatorioCompleto('${romaneioUniqueKey}')" 
                                        style="color: #333; padding: 6px 15px; text-decoration: none; display: block; border: none; background: none; width: 100%; text-align: left; cursor: pointer; font-size: 12px;"
                                        onmouseover="this.style.backgroundColor='#f1f1f1'" 
                                        onmouseout="this.style.backgroundColor='transparent'">
                                    <i class="fas fa-chart-bar" style="margin-right: 8px; width: 12px;"></i> RelatÃ³rio Completo
                                </button>
                            </div>
                        </div>
                        
                        <!-- âœ… BOTÃƒO DE EDITAR -->
                        <button class="client-action-button" 
                                style="background-color: #2ecc71; color: white; padding: 5px 8px; border: none; border-radius: 3px; cursor: pointer;" 
                                title="Editar ${displayId}" onclick="editarRomaneio('${romaneioUniqueKey}')">
                            <i class="fas fa-edit" style="font-size: 12px;"></i>
                        </button>
                        
                        <!-- âœ… BOTÃƒO DE EXCLUIR -->
                        <button class="client-action-button" 
                                style="background-color: #e74c3c; color: white; padding: 5px 8px; border: none; border-radius: 3px; cursor: pointer;" 
                                title="Excluir ${displayId}" onclick="excluirRomaneio('${romaneioUniqueKey}')">
                            <i class="fas fa-trash-alt" style="font-size: 12px;"></i>
                        </button>
                    </div>
                </td>
            `;
            
            tbody.appendChild(tr);
        });
        
        console.log(`âœ… Lista de romaneios renderizada com sucesso: ${romaneiosFiltrados.length} itens`);
        
    } catch (error) {
        console.error("âŒ Erro ao renderizar lista de romaneios:", error);
        const tbody = document.getElementById('romaneioListTable');
        if (tbody) {
            tbody.innerHTML = `
                <tr>
                    <td colspan="7" style="text-align: center; padding: 20px; color: #e74c3c;">
                        <i class="fas fa-exclamation-triangle"></i> Erro ao carregar: ${error.message}
                        <br><small style="margin-top: 10px; display: block;">
                            Verifique o console para mais detalhes
                        </small>
                    </td>
                </tr>
            `;
        }
    }
}

// FunÃ§Ã£o para editar um romaneio - VERSÃƒO CORRIGIDA
async function editarRomaneio(romaneioId) {
    console.log(`âœï¸ === EDITANDO ROMANEIO ${romaneioId} ===`);
    
    try {
        // âœ… CARREGAR ROMANEIOS DO FIREBASE USANDO A MESMA LÃ"GICA ROBUSTA
        let romaneiosData = await getData('romaneios/tora') || {};
        try {
            const tombKey = getStorageKey('romaneiosTora_deletedIds');
            const allowLegacy = tombKey === 'romaneiosTora_deletedIds';
            const tomb = JSON.parse(localStorage.getItem(tombKey) || (allowLegacy ? localStorage.getItem('romaneiosTora_deletedIds') : null) || '[]').map(String);
            if (Array.isArray(tomb) && tomb.length > 0) {
                if (Array.isArray(romaneiosData)) {
                    romaneiosData = romaneiosData.filter(r => !tomb.includes(String(r.id)) && !tomb.includes(String(r.firebaseKey)));
                } else if (romaneiosData && typeof romaneiosData === 'object') {
                    const keys = Object.keys(romaneiosData);
                    keys.forEach(k => {
                        const v = romaneiosData[k];
                        const idCand = String((v && v.id) || k);
                        if (tomb.includes(idCand)) { delete romaneiosData[k]; }
                    });
                }
            }
        } catch (_) {}
        
        let romaneioParaEditar = null;
        
        // âœ… BUSCAR O ROMANEIO USANDO LÃ"GICA ROBUSTA (MESMA DA IMPRESSÃƒO)
        if (Array.isArray(romaneiosData)) {
            romaneioParaEditar = romaneiosData.find(romaneio => 
                romaneio && 
                (romaneio.id === romaneioId || 
                 romaneio.firebaseKey === romaneioId)
            );
        } else {
            Object.keys(romaneiosData).forEach(chaveFirebase => {
                const romaneio = romaneiosData[chaveFirebase];
                let romaneioProcessado = null;
                
                if (Array.isArray(romaneio) && romaneio.length > 0) {
                    romaneioProcessado = romaneio[0];
                } else if (romaneio && typeof romaneio === 'object') {
                    romaneioProcessado = romaneio;
                }
                
                if (romaneioProcessado && 
                    (romaneioProcessado.id === romaneioId || 
                     chaveFirebase === romaneioId ||
                     romaneioProcessado.firebaseKey === romaneioId)) {
                    
                    if (!romaneioParaEditar) {
                        romaneioParaEditar = {
                            ...romaneioProcessado,
                            id: romaneioProcessado.id || chaveFirebase,
                            firebaseKey: chaveFirebase
                        };
                    }
                }
            });
        }
        
        if (!romaneioParaEditar) {
            console.error(`âŒ Romaneio ${romaneioId} nÃ£o encontrado para ediÃ§Ã£o`);
            alert("Romaneio nÃ£o encontrado para ediÃ§Ã£o!");
            return;
        }
        
        console.log("âœ… Romaneio encontrado para ediÃ§Ã£o:", romaneioParaEditar);
        
        // âœ… FECHAR MODAL DE LISTA PRIMEIRO
        const listaModal = document.getElementById('listaModal');
        if (listaModal) {
            listaModal.style.display = 'none';
            console.log("âœ… Modal de lista fechado");
        }
        
        // âœ… LIMPAR FORMULÃRIO ATUAL USANDO A FUNÃ‡ÃƒO GLOBAL SE DISPONÃVEL
        if (typeof window.limparFormulario === 'function') {
            console.log("ðŸ§¹ Limpando formulÃ¡rio atual...");
            window.limparFormulario();
        } else {
            console.log("âš ï¸ FunÃ§Ã£o limparFormulario nÃ£o encontrada, limpeza manual...");
            // Limpeza manual bÃ¡sica
            const inputs = ['preco', 'plaqueta', 'rodo', 'comprimento', 'oco1', 'oco2', 'especieInput'];
            inputs.forEach(id => {
                const input = document.getElementById(id);
                if (input) input.value = '';
            });
        }
        
        // âœ… CONFIGURAR FORNECEDOR/CLIENTE
        if (romaneioParaEditar.fornecedor || romaneioParaEditar.cliente) {
            const fornecedorData = romaneioParaEditar.fornecedor || romaneioParaEditar.cliente;
            
            const clienteInput = document.getElementById('clienteInput');
            if (clienteInput && fornecedorData) {
                let nome = fornecedorData.nome || fornecedorData.name || '';
                if (window.isAllCaps && window.toTitleCasePt && window.isAllCaps(nome)) {
                    nome = window.toTitleCasePt(nome);
                }
                clienteInput.value = nome;
                window.selectedClient = fornecedorData;
                window.selectedFornecedor = fornecedorData;
                console.log("âœ… Fornecedor configurado:", fornecedorData.nome || fornecedorData.name);
            }
        }
        
        // âœ… CONFIGURAR DATA DO ROMANEIO
        if (romaneioParaEditar.data) {
            const dataInput = document.getElementById('dataRomaneio');
            if (dataInput) {
                try {
                    const data = new Date(romaneioParaEditar.data);
                    if (!isNaN(data.getTime())) {
                        // Formatar para input date (YYYY-MM-DD)
                        const year = data.getFullYear();
                        const month = String(data.getMonth() + 1).padStart(2, '0');
                        const day = String(data.getDate()).padStart(2, '0');
                        dataInput.value = `${year}-${month}-${day}`;
                        console.log("âœ… Data configurada:", dataInput.value);
                    }
                } catch (error) {
                    console.warn("âš ï¸ Erro ao configurar data:", error);
                }
            }
        }
        
        // âœ… CARREGAR ITENS DO ROMANEIO
        if (romaneioParaEditar.itens && Array.isArray(romaneioParaEditar.itens)) {
            console.log(`ðŸ"‹ Carregando ${romaneioParaEditar.itens.length} itens na tabela...`);
            
            // Limpar array global de itens
            window.romaneioItems = [];
            
            // Adicionar cada item ao array global
            romaneioParaEditar.itens.forEach((item, index) => {
                console.log(` ðŸ"„ Carregando item ${index + 1}:`, item);
                
                // Garantir que o item tem todos os campos necessÃ¡rios
                const itemCompleto = {
                    plaqueta: item.plaqueta || '',
                    especie: item.especie || '',
                    rodo: parseFloat(item.rodo || item.diametro || 0),
                    diametro: parseFloat(item.diametro || item.rodo || 0), // Para compatibilidade
                    comprimento: parseFloat(item.comprimento || 0),
                    oco1: parseFloat(item.oco1 || 0),
                    oco2: parseFloat(item.oco2 || 0),
                    preco: parseFloat(item.preco || 0),
                    volumeBruto: parseFloat(item.volumeBruto || 0),
                    volumeDesconto: parseFloat(item.volumeDesconto || item.desconto || 0),
                    volumeLiquido: parseFloat(item.volumeLiquido || item.volumeSerraria || 0),
                    valor: parseFloat(item.valor || 0)
                };
                
                // Recalcular volumes se necessÃ¡rio usando funÃ§Ãµes globais
                if (!itemCompleto.volumeBruto && typeof window.calcularVolumeTora === 'function') {
                    itemCompleto.volumeBruto = window.calcularVolumeTora(itemCompleto.diametro, itemCompleto.comprimento);
                }
                
                if (!itemCompleto.volumeDesconto && typeof window.calcularDescontoOco === 'function') {
                    itemCompleto.volumeDesconto = window.calcularDescontoOco(itemCompleto.oco1, itemCompleto.oco2, itemCompleto.comprimento);
                }
                
                if (!itemCompleto.volumeLiquido) {
                    itemCompleto.volumeLiquido = itemCompleto.volumeBruto - itemCompleto.volumeDesconto;
                }
                
                if (!itemCompleto.valor) {
                    itemCompleto.valor = itemCompleto.volumeLiquido * itemCompleto.preco;
                }
                
                window.romaneioItems.push(itemCompleto);
            });
            
            console.log(`âœ… ${window.romaneioItems.length} itens carregados no array global`);
            
            // âœ… ATUALIZAR TABELA NA INTERFACE
            const tbody = document.querySelector('#romaneioTable tbody');
            if (tbody && typeof window.updateTableBody === 'function') {
                console.log("ðŸ"„ Atualizando tabela na interface...");
                window.updateTableBody(tbody);
                console.log("âœ… Tabela atualizada");
            } else {
                console.warn("âš ï¸ Elemento tbody ou funÃ§Ã£o updateTableBody nÃ£o encontrados");
            }
            
            // âœ… ATUALIZAR TOTAIS
            if (typeof window.atualizarTotais === 'function') {
                console.log("ðŸ"„ Atualizando totais...");
                window.atualizarTotais();
                console.log("âœ… Totais atualizados");
            } else {
                console.warn("âš ï¸ FunÃ§Ã£o atualizarTotais nÃ£o encontrada");
            }
        } else {
            console.log("ðŸ"­ Nenhum item encontrado no romaneio");
            window.romaneioItems = [];
        }
        
        // âœ… MARCAR COMO EDITANDO PARA O SISTEMA PRINCIPAL
        window.romaneioEditandoId = romaneioParaEditar.id;
        window.romaneioEditandoFirebaseKey = romaneioParaEditar.firebaseKey;
        
        console.log(`ðŸ"„ Marcado como editando: ID=${window.romaneioEditandoId}, Firebase=${window.romaneioEditandoFirebaseKey}`);
        
        // âœ… ATUALIZAR TÃTULO DA PÃGINA
        const title = document.querySelector('.main-title');
        if (title) {
            title.textContent = `Editando Romaneio - ${romaneioParaEditar.id}`;
            console.log("âœ… TÃ­tulo da pÃ¡gina atualizado");
        }
        
        // âœ… RESETAR PÃGINA ATUAL PARA A PRIMEIRA
        if (typeof window.currentPage !== 'undefined') {
            window.currentPage = 1;
        }
        
        console.log(`ðŸŽ‰ ROMANEIO ${romaneioParaEditar.id} CARREGADO COM SUCESSO PARA EDIÃ‡ÃƒO!`);
        
        // âœ… NOTIFICAR USUÃRIO
        const mensagem = `Romaneio "${romaneioParaEditar.id}" carregado para edição!`;
        if (window.Utils && window.Utils.showToast) window.Utils.showToast(mensagem, 'info');
        
    } catch (error) {
        console.error("âŒ ERRO AO EDITAR ROMANEIO:", error);
        if (window.Utils && window.Utils.showToast) window.Utils.showToast(`Erro ao carregar romaneio para edição: ${error.message}`, 'error');
    }
}

// âœ… EXPORTAÃ‡Ã•ES GLOBAIS - FUNÃ‡Ã•ES QUE ESTAVAM FALTANDO
window.detectarECorrigirIdsDuplicados = detectarECorrigirIdsDuplicados;
window.limparRomaneiosInvalidos = limparRomaneiosInvalidos;
window.gerarLinhaTotalGeral = gerarLinhaTotalGeral;
window.gerarResumoPorEspecie = gerarResumoPorEspecie;
window.gerarResumoGeralEstatisticas = gerarResumoGeralEstatisticas;
window.getCompanyDataFirebase = getCompanyDataFirebase;
window.gerarCabecalhoEmpresa = gerarCabecalhoEmpresa;
window.gerarCabecalhoTabela = gerarCabecalhoTabela;
window.gerarLinhaItem = gerarLinhaItem;
window.formatInt = formatInt;
window.formatDecimal = formatDecimal;
window.formatVolume = formatVolume;
window.formatCurrencyValue = formatCurrencyValue;
window.renderizarMenuImpressaoAvancado = renderizarMenuImpressaoAvancado;
window.toggleImprimirDropdownAvancado = toggleImprimirDropdownAvancado;
window.exportarRomaneioExcelFirebase = exportarRomaneioExcelFirebase;
window.gerarRelatorioCompleto = gerarRelatorioCompleto;

console.log("âœ… === TODAS AS FUNÃ‡Ã•ES EXPORTADAS GLOBALMENTE ===");
console.log("ðŸ"§ FunÃ§Ãµes principais:");
console.log("   â€¢ detectarECorrigirIdsDuplicados");
console.log("   â€¢ limparRomaneiosInvalidos");
console.log("   â€¢ gerarLinhaTotalGeral");
console.log("   â€¢ gerarResumoPorEspecie");
console.log("   â€¢ gerarResumoGeralEstatisticas");
console.log("   â€¢ editarRomaneio (corrigida)");
console.log("   â€¢ todas as funÃ§Ãµes de formataÃ§Ã£o");
console.log("   â€¢ todas as funÃ§Ãµes de impressÃ£o avanÃ§ada");

// FunÃ§Ã£o para excluir um romaneio
async function excluirRomaneio(romaneioId) {
    console.log(`ðŸ—'ï¸ === EXCLUINDO ROMANEIO ${romaneioId} ===`);
    
    try {
        // âœ… BLOQUEAR MÃšLTIPLAS EXECUÃ‡Ã•ES SIMULTÃ‚NEAS
        if (window.deletingRomaneio) {
            console.log("âš ï¸ OperaÃ§Ã£o de exclusÃ£o jÃ¡ em andamento");
            return;
        }
        window.deletingRomaneio = true;
        
        // Confirmar exclusÃ£o
        if (!confirm("Tem certeza que deseja excluir este romaneio? Esta aÃ§Ã£o nÃ£o pode ser desfeita.")) {
            console.log("âŒ ExclusÃ£o cancelada pelo usuÃ¡rio");
            window.deletingRomaneio = false;
            return;
        }
        
        console.log("âœ… UsuÃ¡rio confirmou exclusÃ£o, prosseguindo...");
        
        // Fechar dropdowns/menus para evitar artefatos visuais
        try {
            if (typeof fecharTodosDropdownsImpressao === 'function') {
                fecharTodosDropdownsImpressao(true);
            }
            if (typeof fecharTodosDropdownsLista === 'function') {
                fecharTodosDropdownsLista();
            }
        } catch (closeErr) {
            console.warn("âš ï¸ Erro ao fechar dropdowns antes da exclusÃ£o:", closeErr);
        }
        
        // âœ… CARREGAR DADOS DIRETAMENTE DO FIREBASE PARA ENCONTRAR A CHAVE CORRETA
        console.log("ðŸ"‚ Carregando romaneios DIRETAMENTE do Firebase...");
        let romaneiosData = null;
        
        if (window.firebaseService && typeof window.firebaseService.loadFromFirebase === 'function') {
            try {
                const result = await window.firebaseService.loadFromFirebase('romaneios/tora');
                if (result && result.success) {
                    romaneiosData = result.data || {};
                    console.log("âœ… Dados carregados diretamente do Firebase:", romaneiosData);
                } else {
                    console.log("âš ï¸ Firebase retornou dados vazios ou erro");
                    romaneiosData = {};
                }
            } catch (firebaseError) {
                console.error("âŒ Erro ao carregar do Firebase:", firebaseError);
                throw new Error(`Erro ao carregar dados: ${firebaseError.message}`);
            }
        } else {
            throw new Error("Firebase Service nÃ£o disponÃ­vel");
        }
        
        // âœ… ENCONTRAR A CHAVE FIREBASE ESPECÃFICA DO ROMANEIO A SER EXCLUÃDO
        let chaveFirebaseParaExcluir = null;
        let romaneioParaExcluir = null;
        
        if (romaneiosData && typeof romaneiosData === 'object' && !Array.isArray(romaneiosData)) {
            console.log("ðŸ" Procurando romaneio especÃ­fico por chave Firebase...");
            
            // âœ… BUSCAR POR TODAS AS CHAVES FIREBASE PARA ENCONTRAR O ROMANEIO CORRETO
            Object.keys(romaneiosData).forEach(chaveFirebase => {
                const romaneio = romaneiosData[chaveFirebase];
                let romaneioProcessado = null;
                
                if (Array.isArray(romaneio) && romaneio.length > 0) {
                    romaneioProcessado = romaneio[0];
                } else if (romaneio && typeof romaneio === 'object') {
                    romaneioProcessado = romaneio;
                }
                
                // âœ… VERIFICAR SE ESTE Ã‰ O ROMANEIO CORRETO
                // Usar tanto ID quanto chave Firebase como critÃ©rio
                if (romaneioProcessado && 
                    (romaneioProcessado.id === romaneioId || 
                     chaveFirebase === romaneioId ||
                     romaneioProcessado.firebaseKey === romaneioId)) {
                    
                    // âœ… VERIFICAR SE JÃ ENCONTRAMOS UM CANDIDATO
                    if (!chaveFirebaseParaExcluir) {
                        chaveFirebaseParaExcluir = chaveFirebase;
                        romaneioParaExcluir = romaneioProcessado;
                        console.log(`ðŸŽ¯ ROMANEIO ENCONTRADO - Chave Firebase: ${chaveFirebase}`, romaneioProcessado);
                    } else {
                        // âœ… SE HÃ MÃšLTIPLOS COM MESMO ID, USAR CRITÃ‰RIOS ADICIONAIS PARA DESAMBIGUAR
                        console.warn(`âš ï¸ MÃšLTIPLOS ROMANEIOS COM MESMO ID ENCONTRADOS!`);
                        console.log(`ðŸ" Candidato atual: ${chaveFirebaseParaExcluir}`);
                        console.log(`ðŸ" Novo candidato: ${chaveFirebase}`);
                        
                        // âœ… PREFERIR O MAIS RECENTE (timestamp maior) OU USAR A CHAVE FIREBASE DIRETAMENTE
                        const timestampAtual = romaneioParaExcluir.timestamp || 0;
                        const timestampNovo = romaneioProcessado.timestamp || 0;
                        
                        if (chaveFirebase === romaneioId) {
                            // Se a chave Firebase Ã© exatamente o ID solicitado, usar esta
                            chaveFirebaseParaExcluir = chaveFirebase;
                            romaneioParaExcluir = romaneioProcessado;
                            console.log(`âœ… Usando chave Firebase exata: ${chaveFirebase}`);
                        } else if (timestampNovo > timestampAtual) {
                            // Usar o mais recente se nÃ£o houver correspondÃªncia exata
                            chaveFirebaseParaExcluir = chaveFirebase;
                            romaneioParaExcluir = romaneioProcessado;
                            console.log(`âœ… Usando romaneio mais recente: ${chaveFirebase}`);
                        }
                    }
                }
            });
        }
        
        // âœ… VERIFICAR SE ENCONTRAMOS O ROMANEIO PARA EXCLUIR
        if (!chaveFirebaseParaExcluir || !romaneioParaExcluir) {
            console.error(`âŒ Romaneio ${romaneioId} NÃO ENCONTRADO na lista!`);
            console.log("ðŸ"‹ Chaves Firebase disponíveis:", Object.keys(romaneiosData || {}));
            if (window.Utils && window.Utils.showToast) window.Utils.showToast(`Romaneio ${romaneioId} não encontrado! Atualizando lista...`, 'warning');
            await renderRomaneioList('');
            window.deletingRomaneio = false;
            return;
        }
        
        console.log(`📄 ROMANEIO PARA EXCLUIR:`, {
            chaveFirebase: chaveFirebaseParaExcluir,
            romaneio: romaneioParaExcluir
        });
        
        // USAR FUNÇÃO ESPECÍFICA DE EXCLUSÃO DO FIREBASE
        if (window.firebaseService && typeof window.firebaseService.removeFromFirebase === 'function') {
            try {
                console.log(`🔥 Excluindo romaneio DIRETAMENTE do Firebase: romaneiosTora/${chaveFirebaseParaExcluir}`);
                const deleteResult = await window.firebaseService.deleteFromFirebase('romaneiosTora', chaveFirebaseParaExcluir);
                console.log("📄 Resultado da exclusão:", deleteResult);
                
                if (deleteResult && deleteResult.success) {
                    console.log("✅ Romaneio excluído com SUCESSO do Firebase");
                    
                    // Atualizar UI imediatamente para evitar permanÃªncia visual
                    try {
                        const row = document.getElementById(`romaneioRow_${chaveFirebaseParaExcluir}`);
                        if (row) {
                            row.style.transition = 'opacity 200ms ease';
                            row.style.opacity = '0';
                            setTimeout(() => {
                                row.remove();
                                const tbody = document.getElementById('romaneioListTable');
                                if (tbody && tbody.children.length === 0) {
                                    tbody.innerHTML = `
                                        <tr>
                                            <td colspan="7" style="text-align: center; padding: 20px; color: #7f8c8d;">
                                                <i class="fas fa-inbox"></i> Nenhum romaneio encontrado
                                            </td>
                                        </tr>
                                    `;
                                }
                            }, 200);
                        }
                    } catch (uiError) {
                        console.warn("⚠️ Erro ao atualizar UI após exclusão:", uiError);
                    }
                } else {
                    throw new Error(deleteResult?.error || "Falha na exclusÃ£o do Firebase");
                }
            } catch (deleteError) {
                console.error("âŒ Erro ao excluir do Firebase:", deleteError);
                throw new Error(`Erro ao excluir: ${deleteError.message}`);
            }
        } else {
            throw new Error("FunÃ§Ã£o removeFromFirebase nÃ£o disponÃ­vel no Firebase Service");
        }
        
        // âœ… VERIFICAR SE A EXCLUSÃƒO FOI REALMENTE EFETIVADA
        console.log("ðŸ" Verificando se a exclusÃ£o foi efetivada...");
        
        // Aguardar um pouco para o Firebase sincronizar
        await new Promise(resolve => setTimeout(resolve, 1500));
        
        // Recarregar dados para verificar
        try {
            const verificacaoResult = await window.firebaseService.loadFromFirebase('romaneios/tora');
            if (verificacaoResult && verificacaoResult.success) {
                const dadosVerificacao = verificacaoResult.data || {};
                
                // Verificar se a chave especÃ­fica foi realmente removida
                const chaveAindaExiste = dadosVerificacao.hasOwnProperty(chaveFirebaseParaExcluir);
                
                if (chaveAindaExiste) {
                    console.error("âŒ ERRO: Chave Firebase ainda existe apÃ³s exclusÃ£o!");
                    throw new Error(`Falha na exclusÃ£o - chave ${chaveFirebaseParaExcluir} ainda existe no Firebase`);
                } else {
                    console.log(`âœ… VERIFICAÃ‡ÃƒO CONCLUÃDA: Chave ${chaveFirebaseParaExcluir} foi realmente excluÃ­da`);
                }
            }
        } catch (verificacaoError) {
            console.warn("âš ï¸ Erro na verificaÃ§Ã£o (pode ser normal):", verificacaoError);
            // NÃ£o falhar aqui, pois a exclusÃ£o pode ter funcionado mesmo com erro na verificaÃ§Ã£o
        }
        
        // âœ… LIMPAR TODOS OS CACHES APÃ“S EXCLUSÃƒO
        console.log("ðŸ§¹ Limpando caches apÃ³s exclusÃ£o...");
        try {
            const storageKey = getStorageKey('romaneiosTora');
            localStorage.removeItem(storageKey);
            sessionStorage.removeItem('romaneiosTora');
            
            // Limpar qualquer cache do Firebase Service se existir
            if (window.firebaseService && typeof window.firebaseService.clearCache === 'function') {
                window.firebaseService.clearCache('romaneiosTora');
            }
        } catch (cacheError) {
            console.warn("âš ï¸ Erro ao limpar cache apÃ³s exclusÃ£o:", cacheError);
        }
        
        // âœ… AGUARDAR ANTES DE ATUALIZAR A LISTA
        console.log("â±ï¸ Aguardando sincronizaÃ§Ã£o...");
        await new Promise(resolve => setTimeout(resolve, 1000));
        
        // âœ… ATUALIZAR A LISTA NA INTERFACE
        console.log("ðŸ"„ Atualizando lista na interface...");
        await renderRomaneioList('');
        
        console.log(`âœ… SUCESSO: Romaneio na chave ${chaveFirebaseParaExcluir} excluído com sucesso!`);
        if (window.Utils && window.Utils.showToast) window.Utils.showToast('Romaneio excluído com sucesso!', 'success');
        
    } catch (error) {
        console.error("âŒ ERRO CRÍTICO ao excluir romaneio:", error);
        if (window.Utils && window.Utils.showToast) window.Utils.showToast(`Erro ao excluir romaneio: ${error.message}`, 'error');
    } finally {
        // âœ… SEMPRE DESBLOQUEAR A OPERAÃ‡ÃƒO
        window.deletingRomaneio = false;
        console.log("ðŸ" " OperaÃ§Ã£o de exclusÃ£o desbloqueada");
    }
}

// âœ… FUNÃ‡ÃƒO PRINCIPAL PARA IMPRIMIR ROMANEIO - VERSÃƒO AVANÃ‡ADA ATUALIZADA
async function imprimirRomaneio(romaneioId, modoImpressao = 'completo') {
    console.log(`ðŸ–¨ï¸ Imprimindo romaneio ${romaneioId} no modo ${modoImpressao}`);
    
    try {
        // âœ… CARREGAR DADOS DO FIREBASE
        let romaneiosData = await getData('romaneios/tora') || {};
        try {
            const tombKey = getStorageKey('romaneiosTora_deletedIds');
            const allowLegacy = tombKey === 'romaneiosTora_deletedIds';
            const tomb = JSON.parse(localStorage.getItem(tombKey) || (allowLegacy ? localStorage.getItem('romaneiosTora_deletedIds') : null) || '[]').map(String);
            if (Array.isArray(tomb) && tomb.length > 0) {
                if (Array.isArray(romaneiosData)) {
                    romaneiosData = romaneiosData.filter(r => !tomb.includes(String(r.id)) && !tomb.includes(String(r.firebaseKey)));
                } else if (romaneiosData && typeof romaneiosData === 'object') {
                    const keys = Object.keys(romaneiosData);
                    keys.forEach(k => {
                        const v = romaneiosData[k];
                        const idCand = String((v && v.id) || k);
                        if (tomb.includes(idCand)) { delete romaneiosData[k]; }
                    });
                }
            }
        } catch (_) {}
        
        let romaneioParaImprimir = null;
        
        // âœ… BUSCAR O ROMANEIO USANDO LÃ"GICA ROBUSTA
        if (Array.isArray(romaneiosData)) {
            romaneioParaImprimir = romaneiosData.find(romaneio => 
                romaneio && 
                (romaneio.id === romaneioId || 
                 romaneio.firebaseKey === romaneioId)
            );
        } else {
            Object.keys(romaneiosData).forEach(chaveFirebase => {
                const romaneio = romaneiosData[chaveFirebase];
                let romaneioProcessado = null;
                
                if (Array.isArray(romaneio) && romaneio.length > 0) {
                    romaneioProcessado = romaneio[0];
                } else if (romaneio && typeof romaneio === 'object') {
                    romaneioProcessado = romaneio;
                }
                
                if (romaneioProcessado && 
                    (romaneioProcessado.id === romaneioId || 
                     chaveFirebase === romaneioId ||
                     romaneioProcessado.firebaseKey === romaneioId)) {
                    
                    if (!romaneioParaImprimir) {
                        romaneioParaImprimir = {
                            ...romaneioProcessado,
                            id: romaneioProcessado.id || chaveFirebase,
                            firebaseKey: chaveFirebase
                        };
                    }
                }
            });
        }
        
        if (!romaneioParaImprimir) {
            console.error(`âŒ Romaneio ${romaneioId} nÃ£o encontrado`);
            alert("Romaneio nÃ£o encontrado");
            return;
        }
        
        console.log("âœ… Romaneio encontrado:", romaneioParaImprimir);
        
        // âœ… OBTER DADOS DA EMPRESA DO FIREBASE
        const dadosEmpresa = await getCompanyDataFirebase();
        
        // âœ… PROCESSAR INFORMAÃ‡Ã•ES DO ROMANEIO
        const fornecedor = romaneioParaImprimir.fornecedor ? romaneioParaImprimir.fornecedor : null;
        const cliente = !fornecedor && romaneioParaImprimir.cliente ? romaneioParaImprimir.cliente : null;
        
        // Formatar data para exibiÃ§Ã£o
        let dataFormatada = 'N/A';
        if (romaneioParaImprimir.data) {
            try {
                const data = new Date(romaneioParaImprimir.data);
                if (!isNaN(data.getTime())) {
                    dataFormatada = data.toLocaleDateString('pt-BR');
                }
            } catch (e) {
                dataFormatada = romaneioParaImprimir.data;
            }
        }
        
        // âœ… VERIFICAR E PROCESSAR ITENS
        const itensOriginais = romaneioParaImprimir.itens || [];
        if (!Array.isArray(itensOriginais) || itensOriginais.length === 0) {
            alert("NÃ£o hÃ¡ itens para imprimir neste romaneio");
            return;
        }
        
        // âœ… NORMALIZAR OS ITENS COM CÃLCULOS PRECISOS
        const itensNormalizados = itensOriginais.map(item => {
            const diametro = parseFloat(item.diametro || item.rodo || 0);
            const comprimento = parseFloat(item.comprimento || 0);
            const oco1 = parseFloat(item.oco1 || 0);
            const oco2 = parseFloat(item.oco2 || 0);
            const preco = parseFloat(item.preco || 0);
            
            let volumeBruto = parseFloat(item.volumeBruto || 0);
            let volumeDesconto = parseFloat(item.volumeDesconto || item.desconto || 0);
            let volumeLiquido = parseFloat(item.volumeLiquido || item.volumeSerraria || 0);
            
            if (!volumeBruto && typeof window.calcularVolumeTora === 'function') {
                volumeBruto = window.calcularVolumeTora(diametro, comprimento);
            } else if (!volumeBruto) {
                volumeBruto = Math.PI * Math.pow((diametro/100)/2, 2) * (comprimento/100);
            }
            
            if (!volumeDesconto && typeof window.calcularDescontoOco === 'function') {
                volumeDesconto = window.calcularDescontoOco(oco1, oco2, comprimento);
            } else if (!volumeDesconto) {
                volumeDesconto = (oco1/100) * (oco2/100) * (comprimento/100);
            }
            
            if (!volumeLiquido) {
                volumeLiquido = volumeBruto - volumeDesconto;
            }
            
            const valor = item.valor ? parseFloat(item.valor) : (volumeLiquido * preco);
            
            return {
                plaqueta: item.plaqueta || '',
                especie: item.especie || '',
                diametro,
                comprimento,
                oco1,
                oco2,
                volumeBruto,
                volumeDesconto,
                volumeLiquido,
                preco,
                valor
            };
        }).filter(item => {
             // ✅ FILTRO DE ITENS VÁLIDOS (Igual ao módulo principal)
             const temEspecie = item.especie && item.especie.trim().length > 0;
             const temDimensoes = (item.diametro > 0 || item.comprimento > 0);
             const temVolume = item.volumeBruto > 0 || item.volumeLiquido > 0;
             
             // Filtrar itens que parecem ser linhas de total
             const ehLinhaTotal = item.especie && (
                 String(item.especie).toLowerCase().startsWith('total') || 
                 String(item.especie).toLowerCase() === 'qtd'
             );

             return !ehLinhaTotal && (temEspecie || temDimensoes || temVolume);
        });
        
        // âœ… CALCULAR TOTAIS GERAIS
        let volumeBrutoTotal = 0;
        let volumeDescontoTotal = 0;
        let volumeLiquidoTotal = 0;
        let valorTotal = 0;
        
        itensNormalizados.forEach(item => {
            volumeBrutoTotal += item.volumeBruto;
            volumeDescontoTotal += item.volumeDesconto;
            volumeLiquidoTotal += item.volumeLiquido;
            valorTotal += item.valor;
        });
        
        // âœ… GERAR CABEÃ‡ALHO DA EMPRESA
        const cabecalhoEmpresa = gerarCabecalhoEmpresa(dadosEmpresa);
        
        // âœ… GERAR CABEÃ‡ALHO DA TABELA
        const cabecalhoTabela = gerarCabecalhoTabela(modoImpressao);
        
        // âœ… GERAR LINHAS DOS ITENS
        const linhasItens = itensNormalizados.map(item => 
            gerarLinhaItem(item, modoImpressao)
        ).join('');
        
        // âœ… GERAR LINHA DE TOTAL
        const linhaTotalGeral = gerarLinhaTotalGeral(
            itensNormalizados.length,
            volumeBrutoTotal,
            volumeDescontoTotal,
            volumeLiquidoTotal,
            valorTotal,
            modoImpressao
        );
        
        // âœ… GERAR RESUMO POR ESPÃ‰CIE
        const estatisticasPorEspecie = calcularEstatisticasPorEspecie(itensNormalizados);
        const resumoPorEspecie = gerarResumoPorEspecie(estatisticasPorEspecie, modoImpressao);
        
        // âœ… GERAR RESUMO GERAL
        const resumoGeral = gerarResumoGeralEstatisticas(itensNormalizados, modoImpressao);
        
        // âœ… CONSTRUIR HTML COMPLETO
        const htmlCompleto = `
            <!DOCTYPE html>
            <html lang="pt-BR">
            <head>
                <meta charset="UTF-8">
                <meta name="viewport" content="width=device-width, initial-scale=1.0">
                <title>Romaneio de Tora - ${romaneioParaImprimir.id} - ${dataFormatada}</title>
                <style>
                    ${gerarEstilosCSS(modoImpressao)}
                </style>
            </head>
            <body>
                <div class="page-wrapper">
                    <div class="page-content">
                        <!-- CabeÃ§alho da Empresa -->
                        ${cabecalhoEmpresa}
                        
                        <!-- TÃ­tulo do Romaneio -->
                        <div class="romaneio-title">
                            ROMANEIO DE TORA - ${romaneioParaImprimir.id}
                        </div>
                        
                        <!-- InformaÃ§Ãµes do Romaneio -->
                        <div class="info-block">
                            <div class="info-row">
                                <div class="info-label">Data:</div>
                                <div>${dataFormatada}</div>
                            </div>
                            <div class="info-row">
                                <div class="info-label">Fornecedor:</div>
                                <div>${fornecedor ? (fornecedor.nome || fornecedor.name || 'N/A') : (cliente ? (cliente.nome || cliente.name || 'N/A') : 'N/A')}</div>
                            </div>
                            <div class="info-row">
                                <div class="info-label">CPF/CNPJ:</div>
                                <div>${fornecedor ? (fornecedor.cpfCnpj || fornecedor.cnpj || fornecedor.cpf || 'N/A') : (cliente ? (cliente.cpfCnpj || cliente.cnpj || cliente.cpf || 'N/A') : 'N/A')}</div>
                            </div>
                        </div>
                        
                        <!-- Tabela de Itens -->
                        <h3>Itens do Romaneio</h3>
                        <div class="table-container no-page-break">
                            <table>
                                ${cabecalhoTabela}
                                <tbody>
                                    ${linhasItens}
                                </tbody>
                                <tfoot>
                                    ${linhaTotalGeral}
                                </tfoot>
                            </table>
                        </div>
                        
                        <!-- Resumo por EspÃ©cie -->
                        ${resumoPorEspecie}
                        
                        <!-- Resumo Geral de EstatÃ­sticas -->
                        ${resumoGeral}
                        
                        <!-- Controles de ImpressÃ£o (nÃ£o aparece na impressÃ£o) -->
                        <div class="no-print" style="margin-top: 30px; text-align: center;">
                            <button class="btn-print" onclick="window.print()">
                                <i class="fas fa-print"></i> Imprimir
                            </button>
                            <button class="btn-print" onclick="window.close()">
                                <i class="fas fa-times"></i> Fechar
                            </button>
                        </div>
                        
                        <!-- Assinaturas -->
                        <div class="assinaturas no-page-break-before">
                            <div class="assinatura">
                                <div class="linha-assinatura">ResponsÃ¡vel pela Empresa</div>
                            </div>
                            <div class="assinatura">
                                <div class="linha-assinatura">Fornecedor</div>
                            </div>
                        </div>
                        
                        <!-- RodapÃ© -->
                        <div class="footer">
                            <div>RelatÃ³rio gerado em ${new Date().toLocaleString('pt-BR')}</div>
                            <div>${dadosEmpresa.nome || 'Sistema'} - Romaneio ID: ${romaneioParaImprimir.id}</div>
                        </div>
                    </div>
                </div>
            </body>
            </html>
        `;
        
        // âœ… ABRIR NOVA JANELA PARA IMPRESSÃƒO
        const novaJanela = window.open('', '_blank', 'width=800,height=600');
        if (novaJanela) {
            novaJanela.document.write(htmlCompleto);
            novaJanela.document.close();
            
            // Aguardar carregamento e focar na nova janela
            novaJanela.onload = () => {
                novaJanela.focus();
                console.log("âœ… Janela de impressÃ£o aberta com sucesso");
            };
        } else {
            console.error("âŒ Erro ao abrir nova janela - pode estar sendo bloqueada pelo navegador");
            try {
                const msg = "NÃ£o foi possÃ­vel abrir a janela de impressÃ£o. Verifique se o bloqueador de pop-ups estÃ¡ ativo.";
                if (typeof window.__toast === 'function') {
                    window.__toast(msg, 'error', { duration: 5000 });
                } else if (window.Utils && window.Utils.showToast) {
                    window.Utils.showToast(msg, 'error');
                }
            } catch (_) {}
        }
        
        console.log("âœ… ImpressÃ£o de romaneio concluÃ­da com sucesso");
        
    } catch (error) {
        console.error("âŒ Erro ao imprimir romaneio:", error);
        try {
            if (typeof window.__toast === 'function') {
                window.__toast("Erro ao imprimir romaneio: " + error.message, 'error', { duration: 5000 });
            } else if (window.Utils && window.Utils.showToast) {
                window.Utils.showToast("Erro ao imprimir romaneio: " + error.message, 'error');
            }
        } catch (_) {}
    }
}

// âœ… EXPORTAR FUNÃ‡ÃƒO DE DETECÃ‡ÃƒO
window.detectarECorrigirIdsDuplicados = detectarECorrigirIdsDuplicados;

// FunÃ§Ã£o para calcular estatÃ­sticas por espÃ©cie
function calcularEstatisticasPorEspecie(itens) {
    if (!itens || !Array.isArray(itens) || itens.length === 0) {
        return [];
    }

    // Agrupar itens por espÃ©cie
    const especieMap = {};

    for (const item of itens) {
        const especie = item.especie || 'NÃ£o especificada';
        const diametro = parseFloat(item.diametro) || 0;
        const comprimento = parseFloat(item.comprimento) || 0;
        const oco1 = parseFloat(item.oco1) || 0;
        const oco2 = parseFloat(item.oco2) || 0;
        const preco = parseFloat(item.preco) || 0;
        
        // Usar valores armazenados ou calcular
        const volumeBruto = parseFloat(item.volumeBruto) || calcularVolumeTora(diametro, comprimento);
        const volumeDesconto = parseFloat(item.volumeDesconto) || calcularDescontoOco(oco1, oco2, comprimento);
        const volumeLiquido = parseFloat(item.volumeLiquido) || (volumeBruto - volumeDesconto);
        const valor = parseFloat(item.valor) || (volumeLiquido * preco);

        if (!especieMap[especie]) {
            especieMap[especie] = {
                especie,
                quantidade: 0,
                volumeBrutoTotal: 0,
                volumeDescontoTotal: 0,
                volumeLiquidoTotal: 0,
                valorTotal: 0,
                somaPrecoPonderado: 0
            };
        }

        const estatistica = especieMap[especie];
        estatistica.quantidade++;
        estatistica.volumeBrutoTotal += volumeBruto;
        estatistica.volumeDescontoTotal += volumeDesconto;
        estatistica.volumeLiquidoTotal += volumeLiquido;
        estatistica.valorTotal += valor;
        estatistica.somaPrecoPonderado += preco * volumeLiquido;
    }

    // Converter o mapa para um array de estatÃ­sticas e calcular mÃ©dias
    const estatisticas = Object.values(especieMap);
    for (const estatistica of estatisticas) {
        estatistica.precoMedio = estatistica.volumeLiquidoTotal > 0 
            ? estatistica.somaPrecoPonderado / estatistica.volumeLiquidoTotal 
            : 0;
        
        // Remover propriedade auxiliar
        delete estatistica.somaPrecoPonderado;
    }

    return estatisticas.sort((a, b) => b.valorTotal - a.valorTotal);
}

// âœ… FUNÃ‡ÃƒO PARA EXCLUIR ITEM DO ROMANEIO - CORRIGIDA
function excluirItem(index) {
    try {
        console.log(`ðŸ—'ï¸ Excluindo item no Ã­ndice: ${index}`);
        
        // Verificar se o Ã­ndice Ã© vÃ¡lido
        if (index >= 0 && index < window.romaneioItems.length) {
            // Confirmar exclusÃ£o
            if (confirm('Tem certeza que deseja excluir este item?')) {
                // Remover item do array
                window.romaneioItems.splice(index, 1);
                
                // Garantir que estamos na primeira pÃ¡gina apÃ³s remover um item
                window.currentPage = 1;
                
                // Atualizar a tabela
                const tbody = document.querySelector('#romaneioTable tbody');
                if (tbody && typeof window.updateTableBody === 'function') {
                    window.updateTableBody(tbody);
                } else {
                    console.error("Elemento tbody nÃ£o encontrado ou funÃ§Ã£o updateTableBody nÃ£o definida");
                }
                
                console.log(`âœ… Item ${index} removido com sucesso`);
            }
        } else {
            console.error(`âŒ Ãndice ${index} invÃ¡lido. Total de itens: ${window.romaneioItems ? window.romaneioItems.length : 0}`);
        }
    } catch (error) {
        console.error('âŒ Erro ao excluir item:', error);
        alert('Erro ao excluir item: ' + error.message);
    }
}

// ===== EXPORTAR FUNÃ‡Ã•ES PARA O ESCOPO GLOBAL =====
window.abrirListaRomaneios = abrirListaRomaneios;
window.renderRomaneioList = renderRomaneioList;
window.editarRomaneio = editarRomaneio;
window.excluirRomaneio = excluirRomaneio;
window.imprimirRomaneio = imprimirRomaneio;
window.excluirItem = excluirItem;
window.calcularEstatisticasPorEspecie = calcularEstatisticasPorEspecie;

console.log("âœ… Sistema de listagem de romaneios carregado com sucesso (100% Firebase)");

// âœ… FUNÃ‡ÃƒO PARA OBTER DADOS DA EMPRESA (FIREBASE)
async function getCompanyDataFirebase() {
    try {
        // Tentar obter dados da empresa do Firebase
        const companies = await getData('companies') || [];
        const companyData = companies.length > 0 ? companies[0] : {};
        
        // Valores padrÃ£o baseados na anÃ¡lise
        const dadosPadrao = {
            nome: "Empresa não informada",
            name: "Empresa não informada",
            cnpj: "-",
            endereco: "-",
            address: "-",
            cidade: "-",
            city: "-",
            estado: "-",
            state: "-",
            telefone: "-",
            phone: "-",
            logo: "", // Sem logo padrÃ£o, usar SVG como fallback
            logoSvg: true // Indica que devemos usar SVG como fallback
        };
        
        // Mesclar dados do Firebase com os valores padrÃ£o para campos faltantes
        const dadosMesclados = {
            ...dadosPadrao,
            ...companyData
        };
        
        // Garantir que nome estÃ¡ definido tanto em name quanto nome
        if (companyData.name && !dadosMesclados.nome) dadosMesclados.nome = companyData.name;
        if (companyData.nome && !dadosMesclados.name) dadosMesclados.name = companyData.nome;
        
        // Verificar se hÃ¡ logo e definir flag de SVG
        if (!dadosMesclados.logo || dadosMesclados.logo.trim() === '') {
            dadosMesclados.logoSvg = true;
        } else {
            dadosMesclados.logoSvg = false;
        }
        
        return dadosMesclados;
    } catch (error) {
        console.error("Erro ao obter dados da empresa:", error);
        // Retornar valores padrÃ£o em caso de erro
        return {
            nome: "Empresa não informada",
            name: "Empresa não informada",
            cnpj: "-",
            endereco: "-",
            address: "-",
            cidade: "-",
            city: "-",
            estado: "-",
            state: "-",
            telefone: "-",
            phone: "-",
            logo: "",
            logoSvg: true
        };
    }
}

// âœ… FUNÃ‡Ã•ES DE FORMATAÃ‡ÃƒO
function formatInt(val) {
    return Math.round(parseFloat(val) || 0).toString();
}

function formatDecimal(val, decimals = 2) {
    return (parseFloat(val) || 0).toFixed(decimals).replace('.', ',');
}

function formatVolume(val) {
    try {
        if (typeof val === 'number') return val.toFixed(3).replace('.', ',');
        if (window.toNumberBR && typeof window.toNumberBR === 'function') {
            const n = window.toNumberBR(val);
            return (isNaN(n) ? 0 : n).toFixed(3).replace('.', ',');
        }
        const s = String(val || '').trim();
        if (!s) return '0,000';
        const n = parseFloat(s.replace(/\./g, '').replace(/,/g, '.'));
        return (isNaN(n) ? 0 : n).toFixed(3).replace('.', ',');
    } catch (_) {
        return '0,000';
    }
}

function formatCurrencyValue(val) {
    return (parseFloat(val) || 0).toLocaleString('pt-BR', {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2
    });
}

// âœ… FUNÃ‡ÃƒO PARA GERAR CABEÃ‡ALHO DA EMPRESA
function gerarCabecalhoEmpresa(dadosEmpresa, logoSvgBase64) {
    return `
        <div class="company-header">
            <div class="company-logo-container">
                ${dadosEmpresa.logo 
                    ? `<img src="${dadosEmpresa.logo}" class="company-logo" alt="${dadosEmpresa.nome}">`
                    : `<img src="data:image/svg+xml;base64,${logoSvgBase64}" class="company-logo" alt="${dadosEmpresa.nome}">`
                }
            </div>
            <div class="company-info">
                <div class="company-name">${dadosEmpresa.nome}</div>
                <div class="company-details">
                    ${dadosEmpresa.cnpj ? `CNPJ: ${dadosEmpresa.cnpj}<br>` : ''}
                    ${dadosEmpresa.endereco ? `EndereÃ§o: ${dadosEmpresa.endereco}<br>` : ''}
                    ${dadosEmpresa.cidade || dadosEmpresa.estado ? `Cidade: ${dadosEmpresa.cidade || ''} ${dadosEmpresa.estado ? `- Estado: ${dadosEmpresa.estado}` : ''}<br>` : ''}
                    ${dadosEmpresa.telefone ? `Telefone: ${dadosEmpresa.telefone}` : ''}
                </div>
            </div>
        </div>
        
        <div class="romaneio-title">ROMANEIO DE TORA</div>
    `;
}

// âœ… FUNÃ‡ÃƒO PARA GERAR CABEÃ‡ALHO DA TABELA
function gerarCabecalhoTabela(modoImpressao) {
    // Verificar se deve mostrar colunas de preÃ§o
    const mostrarPreco = modoImpressao !== 'sem_preco';
    const mostrarPrecoUnitario = modoImpressao !== 'sem_preco' && modoImpressao !== 'sem_preco_unitario';
    
    return `
        <thead>
            <tr>
                <th style="width: 10%;">Plaqueta</th>
                <th style="width: ${mostrarPreco ? '15%' : '20%'};">EspÃ©cie</th>
                <th style="width: 8%;">DiÃ¢m. (cm)</th>
                <th style="width: 8%;">Comp. (cm)</th>
                <th style="width: 8%;">Oco 1 (cm)</th>
                <th style="width: 8%;">Oco 2 (cm)</th>
                <th style="width: 8%;">MÂ³ Bruto</th>
                <th style="width: 8%;">MÂ³ Desc.</th>
                <th style="width: 8%;">MÂ³ LÃ­q.</th>
                ${mostrarPrecoUnitario ? `<th style="width: 9%;" class="preco-coluna">PreÃ§o (R$)</th>` : ''}
                ${mostrarPreco ? `<th style="width: 10%;" class="valor-coluna">Valor (R$)</th>` : ''}
            </tr>
        </thead>
    `;
}

// âœ… FUNÃ‡ÃƒO PARA GERAR LINHA DE ITEM
function gerarLinhaItem(item, index, inicio, modoImpressao) {
    // Verificar se deve mostrar colunas de preÃ§o
    const mostrarPreco = modoImpressao !== 'sem_preco';
    const mostrarPrecoUnitario = modoImpressao !== 'sem_preco' && modoImpressao !== 'sem_preco_unitario';
    
    return `
        <tr>
            <td style="text-align: center;">${item.plaqueta || (inicio + index + 1)}</td>
            <td style="text-align: left; max-width: 120px; overflow: hidden; text-overflow: ellipsis;">${item.especie || ''}</td>
            <td style="text-align: center;">${formatInt(item.diametro)}</td>
            <td style="text-align: center;">${formatInt(item.comprimento)}</td>
            <td style="text-align: center;">${item.oco1 > 0 ? formatInt(item.oco1) : '-'}</td>
            <td style="text-align: center;">${item.oco2 > 0 ? formatInt(item.oco2) : '-'}</td>
            <td style="text-align: right;">${formatVolume(item.volumeBruto)}</td>
            <td style="text-align: right;">${formatVolume(item.volumeDesconto)}</td>
            <td style="text-align: right;">${formatVolume(item.volumeLiquido)}</td>
            ${mostrarPrecoUnitario ? `<td style="text-align: right; white-space: nowrap;" class="preco-coluna currency">${formatCurrencyValue(item.preco)}</td>` : ''}
            ${mostrarPreco ? `<td style="text-align: right; white-space: nowrap;" class="valor-coluna currency">${formatCurrencyValue(item.valor)}</td>` : ''}
        </tr>
    `;
}

// âœ… FUNÃ‡ÃƒO PARA GERAR SUBTOTAL DA PÃGINA
function gerarSubtotal(pagina, subtotais, modoImpressao) {
    // Verificar se deve mostrar colunas de preÃ§o
    const mostrarPreco = modoImpressao !== 'sem_preco';
    const mostrarPrecoUnitario = modoImpressao !== 'sem_preco' && modoImpressao !== 'sem_preco_unitario';
    
    // Calcular o nÃºmero de colunas para o colspan
    let colspanBase = 6; // Plaqueta + EspÃ©cie + DiÃ¢metro + Comprimento + Oco1 + Oco2
    
    return `
        <tr class="subtotal-row no-page-break-before no-page-break-after">
            <td colspan="${colspanBase}" class="text-right">Subtotal da PÃ¡gina ${pagina}:</td>
            <td class="text-right">${formatVolume(subtotais.volumeBruto)}</td>
            <td class="text-right">${formatVolume(subtotais.volumeDesconto)}</td>
            <td class="text-right">${formatVolume(subtotais.volumeLiquido)}</td>
            ${mostrarPrecoUnitario ? `<td class="text-right preco-coluna"></td>` : ''}
            ${mostrarPreco ? `<td class="text-right valor-coluna currency">${formatCurrencyValue(subtotais.valor)}</td>` : ''}
        </tr>
    `;
}

// âœ… FUNÃ‡ÃƒO PARA GERAR TOTAIS GERAIS
function gerarTotaisGerais(totais, modoImpressao) {
    // Verificar se deve mostrar colunas de preÃ§o
    const mostrarPreco = modoImpressao !== 'sem_preco';
    const mostrarPrecoUnitario = modoImpressao !== 'sem_preco' && modoImpressao !== 'sem_preco_unitario';
    
    // Calcular o nÃºmero de colunas para o colspan
    let colspanBase = 6; // Plaqueta + EspÃ©cie + DiÃ¢metro + Comprimento + Oco1 + Oco2
    
    return `
        <tr class="total-geral-row no-page-break-before no-page-break-after">
            <td colspan="${colspanBase}" class="text-right">Total Geral:</td>
            <td class="text-right">${formatVolume(totais.volumeBruto)}</td>
            <td class="text-right">${formatVolume(totais.volumeDesconto)}</td>
            <td class="text-right">${formatVolume(totais.volumeLiquido)}</td>
            ${mostrarPrecoUnitario ? `<td class="text-right preco-coluna currency">${formatCurrencyValue(totais.precoMedio)}</td>` : ''}
            ${mostrarPreco ? `<td class="text-right valor-coluna currency">${formatCurrencyValue(totais.valor)}</td>` : ''}
        </tr>
    `;
}

// âœ… FUNÃ‡ÃƒO PARA GERAR RESUMO POR ESPÃ‰CIE
function gerarResumoPorEspecie(estatisticas, totais, modoImpressao) {
    // Definir colunas com base no modo de impressÃ£o
    const mostrarPreco = modoImpressao !== 'sem_preco';
    const mostrarPrecoUnitario = modoImpressao !== 'sem_preco' && modoImpressao !== 'sem_preco_unitario';
    
    // Gerar o cabeÃ§alho da tabela com base no modo de impressÃ£o
    let cabecalho = `
        <tr>
            <th>EspÃ©cie</th>
            <th>Qtd. Toras</th>
            <th>MÂ³ Bruto</th>
            <th>MÂ³ Desc.</th>
            <th>MÂ³ LÃ­q.</th>
            ${mostrarPrecoUnitario ? `<th>PreÃ§o MÃ©dio</th>` : ''}
            ${mostrarPreco ? `<th>Valor Total</th>` : ''}
        </tr>
    `;
    
    // Gerar as linhas para cada espÃ©cie
    let linhas = estatisticas.map(especie => `
        <tr>
            <td style="max-width: 100px; overflow: hidden; text-overflow: ellipsis;">${especie.especie}</td>
            <td class="text-center">${especie.quantidade}</td>
            <td class="text-right">${formatVolume(especie.volumeBrutoTotal)}</td>
            <td class="text-right">${formatVolume(especie.volumeDescontoTotal)}</td>
            <td class="text-right">${formatVolume(especie.volumeLiquidoTotal)}</td>
            ${mostrarPrecoUnitario ? `<td class="text-right currency">${formatDecimal(especie.precoMedio)}</td>` : ''}
            ${mostrarPreco ? `<td class="text-right currency">${formatDecimal(especie.valorTotal)}</td>` : ''}
        </tr>
    `).join('');
    
    // Gerar linha de total
    let linhaTotais = `
        <tr class="total-row">
            <td colspan="1" class="text-right">Total:</td>
            <td class="text-center">${totais.quantidade}</td>
            <td class="text-right">${formatVolume(totais.volumeBruto)}</td>
            <td class="text-right">${formatVolume(totais.volumeDesconto)}</td>
            <td class="text-right">${formatVolume(totais.volumeLiquido)}</td>
            ${mostrarPrecoUnitario ? `<td class="text-right currency">${formatDecimal(totais.precoMedio)}</td>` : ''}
            ${mostrarPreco ? `<td class="text-right currency">${formatDecimal(totais.valor)}</td>` : ''}
        </tr>
    `;
    
    return `
        <div class="resumo-especie">
            <h3>Resumo por EspÃ©cie</h3>
            <table class="resumo-table">
                <thead>
                    ${cabecalho}
                </thead>
                <tbody>
                    ${linhas}
                </tbody>
                <tfoot>
                    ${linhaTotais}
                </tfoot>
            </table>
        </div>
    `;
}

// âœ… FUNÃ‡ÃƒO PARA GERAR RESUMO GERAL
function gerarResumoGeral(totais, modoImpressao) {
    // Definir colunas com base no modo de impressÃ£o
    const mostrarPreco = modoImpressao !== 'sem_preco';
    const mostrarPrecoUnitario = modoImpressao !== 'sem_preco' && modoImpressao !== 'sem_preco_unitario';
    
    // Montar os itens do resumo conforme o modo de impressÃ£o
    let itensResumo = [
        `<div class="stats-item">
            <div class="stats-label">NÃºmero de Toras</div>
            <div class="stats-value">${totais.quantidade}</div>
        </div>`,
        `<div class="stats-item">
            <div class="stats-label">Volume Bruto Total</div>
            <div class="stats-value">${formatVolume(totais.volumeBruto)}</div>
        </div>`,
        `<div class="stats-item">
            <div class="stats-label">Volume LÃ­quido Total</div>
            <div class="stats-value">${formatVolume(totais.volumeLiquido)}</div>
        </div>`
    ];
    
    // Adicionar preÃ§o mÃ©dio e valor total se aplicÃ¡vel
    if (mostrarPrecoUnitario) {
        itensResumo.push(`
            <div class="stats-item">
                <div class="stats-label">PreÃ§o MÃ©dio</div>
                <div class="stats-value currency">${formatDecimal(totais.precoMedio)}</div>
            </div>
        `);
    }
    
    if (mostrarPreco) {
        itensResumo.push(`
            <div class="stats-item">
                <div class="stats-label">Valor Total</div>
                <div class="stats-value currency">${formatDecimal(totais.valor)}</div>
            </div>
        `);
    }
    
    return `
        <div class="summary-block">
            <h3>Resumo Geral</h3>
            <div class="stats-row">
                ${itensResumo.join('')}
            </div>
        </div>
    `;
}

// âœ… FUNÃ‡ÃƒO PARA GERAR ASSINATURAS
function gerarAssinaturas() {
    return `
        <div class="assinaturas">
            <div class="assinatura">
                <div class="linha-assinatura">Fornecedor</div>
            </div>
            <div class="assinatura">
                <div class="linha-assinatura">Fornecedor</div>
            </div>
        </div>
    `;
}

// âœ… FUNÃ‡ÃƒO PARA GERAR ESTILOS CSS AVANÃ‡ADOS
function gerarEstilosCSS(modoImpressao) {
    return `
        /* Reset e estilos gerais */
        * {
            box-sizing: border-box;
            margin: 0;
            padding: 0;
        }
        
        body {
            font-family: Arial, sans-serif;
            line-height: 1.5;
            color: #333;
            font-size: 12px;
        }
        
        /* Estrutura de pÃ¡gina */
        .page-wrapper {
            width: 100%;
            position: relative;
            page-break-after: always;
            min-height: 100vh; /* Altura mÃ­nima de uma pÃ¡gina */
        }
        
        .page-wrapper:last-of-type {
            page-break-after: avoid;
        }
        
        .page-content {
            padding: 20px;
            position: relative;
            min-height: calc(100vh - 40px); /* Altura da pÃ¡gina menos o padding */
        }
        
        /* CabeÃ§alho da empresa */
        .company-header {
            display: flex;
            align-items: center;
            margin-bottom: 15px;
            width: 100%;
        }
        
        .company-logo-container {
            width: 80px;
            height: 80px;
            display: flex;
            align-items: center;
            justify-content: center;
            margin-right: 15px;
        }
        
        .company-logo {
            max-width: 100%;
            max-height: 100%;
        }
        
        .company-info {
            flex: 1;
        }
        
        .company-name {
            font-size: 16px;
            font-weight: bold;
            margin-bottom: 5px;
        }
        
        .company-details {
            font-size: 11px;
        }
        
        /* TÃ­tulo do romaneio */
        .romaneio-title {
            font-size: 16px;
            font-weight: bold;
            text-align: center;
            margin: 15px 0;
            border-bottom: 1px solid #ccc;
            padding-bottom: 5px;
        }
        
        /* Bloco de informaÃ§Ãµes */
        .info-block {
            margin-bottom: 15px;
        }
        
        .info-row {
            display: flex;
            margin-bottom: 5px;
        }
        
        .info-label {
            font-weight: bold;
            width: 100px;
            flex-shrink: 0;
        }
        
        /* Tabelas */
        h3 {
            font-size: 14px;
            margin: 15px 0 10px;
        }
        
        .table-container {
            margin-bottom: 15px;
            width: 100%;
            overflow-x: auto;
        }
        
        table {
            width: 100%;
            border-collapse: collapse;
            table-layout: fixed;
        }
        
        thead th {
            background-color: #f0f0f0;
        }
        
        th, td {
            border: 1px solid #ccc;
            padding: 5px;
            font-size: 11px;
            overflow: hidden;
            text-overflow: ellipsis;
        }
        
        th {
            font-weight: bold;
            text-align: center;
        }
        
        tbody tr:nth-child(even) {
            background-color: #f9f9f9;
        }
        
        tfoot tr {
            background-color: #f0f0f0;
            font-weight: bold;
        }
        
        .total-geral-row {
            background-color: #e0e0e0 !important;
        }
        
        .subtotal-row {
            background-color: #f5f5f5 !important;
            font-weight: bold;
        }
        
        /* Resumo por espÃ©cie */
        .resumo-especie {
            margin-bottom: 20px;
        }
        
        .resumo-table {
            margin-bottom: 30px;
        }
        
        /* Resumo geral */
        .summary-block {
            margin-top: 30px;
            margin-bottom: 30px;
        }
        
        .stats-row {
            display: flex;
            flex-wrap: wrap;
            gap: 15px;
            justify-content: space-between;
            margin-top: 10px;
        }
        
        .stats-item {
            flex: 1 0 calc(33.333% - 10px);
            border: 1px solid #ccc;
            padding: 10px;
            text-align: center;
            background-color: #f9f9f9;
        }
        
        .stats-label {
            font-weight: bold;
            margin-bottom: 5px;
        }
        
        .stats-value {
            font-size: 16px;
        }
        
        /* Assinaturas */
        .assinaturas {
            margin-top: 40px;
            display: flex;
            justify-content: space-between;
        }
        
        .assinatura {
            width: 45%;
            text-align: center;
        }
        
        .linha-assinatura {
            border-top: 1px solid #000;
            margin-top: 50px;
            padding-top: 5px;
        }
        
        /* UtilitÃ¡rios */
        .text-center {
            text-align: center;
        }
        
        .text-right {
            text-align: right;
        }
        
        .currency {
            white-space: nowrap;
        }
        
        /* RodapÃ© */
        .footer {
            position: relative;
            bottom: 0;
            left: 0;
            width: 100%;
            border-top: 1px solid #ccc;
            padding-top: 10px;
            font-size: 10px;
            margin-top: 30px;
            text-align: center;
        }
        
        /* Controles de impressÃ£o */
        .no-print {
            display: block;
        }
        
        .btn-print {
            padding: 8px 15px;
            border: 1px solid #ccc;
            background-color: #f0f0f0;
            cursor: pointer;
            border-radius: 4px;
            margin-right: 10px;
            font-size: 14px;
        }
        
        .btn-print:hover {
            background-color: #e0e0e0;
        }
        
        /* Controles de quebra de pÃ¡gina */
        .page-break {
            page-break-after: always;
            height: 0;
        }
        
        .no-page-break {
            page-break-inside: avoid;
        }
        
        .no-page-break-before {
            page-break-before: avoid;
        }
        
        .no-page-break-after {
            page-break-after: avoid;
        }
        
        /* Estilos especÃ­ficos por modo de impressÃ£o */
        ${modoImpressao === 'sem_preco_unitario' ? `
            .preco-coluna {
                display: none !important;
            }
        ` : ''}
        
        ${modoImpressao === 'sem_preco' ? `
            .preco-coluna,
            .valor-coluna {
                display: none !important;
            }
        ` : ''}
        
        /* Estilos para impressÃ£o */
        @media print {
            .no-print {
                display: none !important;
            }
            
            body {
                margin: 0;
                font-size: 11px;
            }
            
            .page-wrapper {
                page-break-after: always;
                margin: 0;
            }
            
            .page-wrapper:last-of-type {
                page-break-after: avoid;
            }
            
            .page-content {
                padding: 15px;
            }
            
            table {
                font-size: 10px;
            }
            
            th, td {
                padding: 3px;
            }
        }
    `;
}

// âœ… FUNÃ‡ÃƒO PARA RENDERIZAR MENU DE IMPRESSÃƒO AVANÃ‡ADO
function renderizarMenuImpressaoAvancado(romaneioId, index) {
    return `
        <div class="dropdown action-dropdown">
            <button class="btn btn-sm btn-outline-primary dropdown-toggle" 
                    onclick="toggleImprimirDropdownAvancado(event, ${index})" 
                    data-toggle="dropdown" 
                    aria-haspopup="true" 
                    aria-expanded="false"
                    title="OpÃ§Ãµes de ImpressÃ£o">
                <i class="fas fa-print"></i> Imprimir
            </button>
            <div class="dropdown-menu dropdown-menu-right" id="printDropdownAvancado${index}">
                <h6 class="dropdown-header">ðŸ"„ Formato da ImpressÃ£o</h6>
                <button data-id="${romaneioId}" data-index="${index}" 
                        onclick="window.imprimirRomaneioTora('${romaneioId}', 'completo')" 
                        class="dropdown-item">
                    <i class="fas fa-file-alt"></i> Completo (com preÃ§os)
                </button>
                <button data-id="${romaneioId}" data-index="${index}" 
                        onclick="window.imprimirRomaneioTora('${romaneioId}', 'sem_preco_unitario')" 
                        class="dropdown-item">
                    <i class="fas fa-file-invoice"></i> Sem preÃ§os unitÃ¡rios
                </button>
                <button data-id="${romaneioId}" data-index="${index}" 
                        onclick="window.imprimirRomaneioTora('${romaneioId}', 'sem_preco')" 
                        class="dropdown-item">
                    <i class="fas fa-file"></i> Sem valores
                </button>
                <div class="dropdown-divider"></div>
                <h6 class="dropdown-header">ðŸ"Š Exportar</h6>
                <button data-id="${romaneioId}" data-index="${index}" 
                        onclick="exportarRomaneioExcelFirebase('${romaneioId}')" 
                        class="dropdown-item">
                    <i class="fas fa-file-excel"></i> Exportar para Excel
                </button>
                <button data-id="${romaneioId}" data-index="${index}" 
                        onclick="gerarRelatorioCompleto('${romaneioId}')" 
                        class="dropdown-item">
                    <i class="fas fa-chart-bar"></i> RelatÃ³rio Completo
                </button>
            </div>
        </div>
    `;
}

// âœ… FUNÃ‡ÃƒO PARA CONTROLAR DROPDOWN DE IMPRESSÃƒO AVANÃ‡ADO
function toggleImprimirDropdownAvancado(event, index) {
    try {
        if (event) {
            event.preventDefault();
            event.stopPropagation();
        }
        const dropdown = document.getElementById(`printDropdownAvancado${index}`);
        if (!dropdown) return;
        // Fechar todos os outros dropdowns abertos
        const allDropdowns = document.querySelectorAll('.dropdown-menu');
        allDropdowns.forEach(dd => {
            if (dd !== dropdown) {
                dd.classList.remove('show');
                dd.style.display = 'none';
                if (dd.__outsideCloseHandler) {
                    window.removeEventListener('pointerdown', dd.__outsideCloseHandler, true);
                    window.removeEventListener('mousedown', dd.__outsideCloseHandler, true);
                    window.removeEventListener('touchstart', dd.__outsideCloseHandler, true);
                    dd.__outsideCloseHandler = null;
                }
                if (dd.__scrollResizeCloseHandler) {
                    window.removeEventListener('scroll', dd.__scrollResizeCloseHandler, true);
                    window.removeEventListener('resize', dd.__scrollResizeCloseHandler, true);
                    dd.__scrollResizeCloseHandler = null;
                }
            }
        });
        const willOpen = !(dropdown.classList.contains('show') || dropdown.style.display === 'block');
        if (willOpen) {
            dropdown.style.display = 'block';
            dropdown.classList.add('show');
            animateDropdownVisibility(dropdown, true, 300);
            // Fechar ao clicar fora (captura, robusto, cross-device)
            const button = (event && event.currentTarget) ? event.currentTarget : (event && event.target ? event.target.closest('button, [data-toggle="dropdown"]') : null);
            const outsideHandler = function(e) {
                if (!dropdown.contains(e.target) && (!button || (e.target !== button && !button.contains(e.target)))) {
                    animateDropdownVisibility(dropdown, false, 300);
                    window.removeEventListener('pointerdown', outsideHandler, true);
                    window.removeEventListener('mousedown', outsideHandler, true);
                    window.removeEventListener('touchstart', outsideHandler, true);
                    dropdown.__outsideCloseHandler = null;
                }
            };
            window.addEventListener('pointerdown', outsideHandler, { capture: true, once: true });
            window.addEventListener('mousedown', outsideHandler, { capture: true, once: true });
            window.addEventListener('touchstart', outsideHandler, { capture: true, once: true });
            dropdown.__outsideCloseHandler = outsideHandler;
            // Fechar ao rolar ou redimensionar
            const srHandler = function() {
                animateDropdownVisibility(dropdown, false, 300);
                window.removeEventListener('scroll', srHandler, true);
                window.removeEventListener('resize', srHandler, true);
                dropdown.__scrollResizeCloseHandler = null;
            };
            window.addEventListener('scroll', srHandler, { capture: true, once: true });
            window.addEventListener('resize', srHandler, { capture: true, once: true });
            dropdown.__scrollResizeCloseHandler = srHandler;
            // Fechar ao selecionar opção
            const optionHandler = function() {
                setTimeout(() => animateDropdownVisibility(dropdown, false, 300), 0);
                dropdown.removeEventListener('click', optionHandler, true);
                dropdown.__optionSelectHandler = null;
            };
            dropdown.addEventListener('click', optionHandler, { capture: true });
            dropdown.__optionSelectHandler = optionHandler;
        } else {
            animateDropdownVisibility(dropdown, false, 300);
        }
    } catch (err) {
        console.error('Erro ao alternar dropdown avançado:', err);
    }
}

// ✅ Helper: fechar todos os dropdowns de impressão (lista e avançado)
function fecharTodosDropdownsImpressao(immediate = false) {
    try {
        const allDropdowns = document.querySelectorAll('.dropdown-menu');
        allDropdowns.forEach(dropdown => {
            // Remover listeners vinculados
            if (dropdown.__outsideCloseHandler) {
                window.removeEventListener('pointerdown', dropdown.__outsideCloseHandler, true);
                window.removeEventListener('mousedown', dropdown.__outsideCloseHandler, true);
                window.removeEventListener('touchstart', dropdown.__outsideCloseHandler, true);
                dropdown.__outsideCloseHandler = null;
            }
            if (dropdown.__scrollResizeCloseHandler) {
                window.removeEventListener('scroll', dropdown.__scrollResizeCloseHandler, true);
                window.removeEventListener('resize', dropdown.__scrollResizeCloseHandler, true);
                dropdown.__scrollResizeCloseHandler = null;
            }
            if (dropdown.__optionSelectHandler) {
                dropdown.removeEventListener('click', dropdown.__optionSelectHandler, true);
                dropdown.__optionSelectHandler = null;
            }
            if (immediate) {
                dropdown.classList.remove('show');
                dropdown.style.display = 'none';
                dropdown.style.opacity = '';
                dropdown.style.transform = '';
                dropdown.style.transition = '';
                dropdown.style.pointerEvents = '';
            } else {
                animateDropdownVisibility(dropdown, false, 300);
            }
        });
        // Também fechar possíveis menus externos de impressão
        const externals = document.querySelectorAll('.external-print-menu');
        externals.forEach(menu => {
            if (menu && menu.parentNode) {
                menu.parentNode.removeChild(menu);
            }
        });
    } catch (e) {
        console.warn('Falha ao fechar dropdowns de impressão:', e);
    }
}

// ✅ Animação suave de visibilidade para dropdowns (300ms)
function animateDropdownVisibility(dropdown, show, duration = 300) {
    if (!dropdown) return;
    try {
        dropdown.style.willChange = 'opacity, transform';
        dropdown.style.transition = `opacity ${duration}ms ease, transform ${duration}ms ease`;
        if (show) {
            dropdown.style.display = 'block';
            dropdown.classList.add('show');
            // Start from hidden state
            dropdown.style.opacity = '0';
            dropdown.style.transform = 'translateY(-6px)';
            // Animate to visible
            requestAnimationFrame(() => {
                dropdown.style.opacity = '1';
                dropdown.style.transform = 'translateY(0)';
                dropdown.style.pointerEvents = 'auto';
            });
        } else {
            dropdown.style.opacity = '1';
            dropdown.style.transform = 'translateY(0)';
            dropdown.style.pointerEvents = 'auto';
            requestAnimationFrame(() => {
                dropdown.style.opacity = '0';
                dropdown.style.transform = 'translateY(-6px)';
                dropdown.style.pointerEvents = 'none';
                setTimeout(() => {
                    dropdown.classList.remove('show');
                    dropdown.style.display = 'none';
                    dropdown.style.transition = '';
                    dropdown.style.willChange = '';
                    dropdown.style.pointerEvents = '';
                }, duration);
            });
        }
    } catch (err) {
        // Fallback seguro:
        dropdown.classList.remove('show');
        dropdown.style.display = show ? 'block' : 'none';
    }
}

// ✅ Inicializar fechamento por tecla Escape e mudanças de modal (somente uma vez)
(function initDropdownCloseListeners() {
    if (window.__dropdownCloseListenersInitialized) return;
    window.__dropdownCloseListenersInitialized = true;

    // Fechar com ESC
    window.addEventListener('keydown', function(e) {
        if (e && (e.key === 'Escape' || e.keyCode === 27)) {
            fecharTodosDropdownsImpressao();
        }
    });

    // Fechar imediatamente ao iniciar/terminar impressão
    try {
        window.addEventListener('beforeprint', function() {
            fecharTodosDropdownsImpressao(true);
        });
        window.addEventListener('afterprint', function() {
            fecharTodosDropdownsImpressao(true);
        });
    } catch (printErr) {
        console.warn('Eventos beforeprint/afterprint indisponíveis:', printErr);
    }

    // Fechar quando a aba voltar ao foco (após fechar relatório/diálogo de impressão)
    window.addEventListener('focus', function() {
        const aberto = document.querySelector('.dropdown-menu.show, .dropdown-menu[style*="display: block"]');
        if (aberto) {
            fecharTodosDropdownsImpressao(true);
        }
    }, true);

    // Fechar quando a aba voltar a ficar visível
    document.addEventListener('visibilitychange', function() {
        if (!document.hidden) {
            const aberto = document.querySelector('.dropdown-menu.show, .dropdown-menu[style*="display: block"]');
            if (aberto) {
                fecharTodosDropdownsImpressao(true);
            }
        }
    }, true);

    // Observar alterações no DOM para fechar menus quando modais forem ocultados/removidos
    try {
        const observer = new MutationObserver(function() {
            const algumDropdownAberto = !!document.querySelector('.dropdown-menu.show, .dropdown-menu[style*="display: block"]');
            const algumModalVisivel = !!document.querySelector('.modal.show');
            if (algumDropdownAberto && !algumModalVisivel) {
                fecharTodosDropdownsImpressao();
            }
        });
        observer.observe(document.body, { childList: true, subtree: true, attributes: true, attributeFilter: ['class', 'style', 'aria-hidden'] });
        window.__dropdownCloseObserver = observer;
    } catch (obsErr) {
        console.warn('MutationObserver indisponível para fechar dropdowns:', obsErr);
    }
})();

// ✅ FUNÇÃO PARA CONTROLAR DROPDOWN DE IMPRESSÃO NA LISTA (Ações)
function toggleImprimirDropdownLista(event, romaneioId, index) {
    try {
        if (event) {
            event.preventDefault();
            event.stopPropagation();
        }
        // Fechar todos os outros dropdowns
        fecharTodosDropdownsImpressao();
        const dropdown = document.getElementById(`printDropdownLista${index}`);
        const button = (event && event.currentTarget) ? event.currentTarget : (event && event.target ? event.target.closest('button, [data-toggle="dropdown"]') : null);
        if (!dropdown) {
            console.warn(`Dropdown de impressão da lista não encontrado: printDropdownLista${index}`);
            return;
        }
        const willOpen = !(dropdown.style.display === 'block' || dropdown.classList.contains('show'));
        if (willOpen) {
            // Posicionar o dropdown próximo ao botão
            if (button) {
                const rect = button.getBoundingClientRect();
                dropdown.style.position = 'fixed';
                dropdown.style.top = `${rect.bottom + 4}px`;
                const estimatedWidth = Math.max(220, dropdown.offsetWidth || 220);
                const left = Math.max(10, rect.right - estimatedWidth);
                dropdown.style.left = `${left}px`;
                dropdown.style.zIndex = '99999';
                dropdown.style.right = 'auto';
                dropdown.style.marginTop = '0';
            }
            animateDropdownVisibility(dropdown, true, 300);
            // Fechar ao clicar fora (captura, robusto)
            const outsideHandler = function(e) {
                if (!dropdown.contains(e.target) && (!button || (e.target !== button && !button.contains(e.target)))) {
                    animateDropdownVisibility(dropdown, false, 300);
                    window.removeEventListener('pointerdown', outsideHandler, true);
                    window.removeEventListener('mousedown', outsideHandler, true);
                    window.removeEventListener('touchstart', outsideHandler, true);
                    dropdown.__outsideCloseHandler = null;
                }
            };
            window.addEventListener('pointerdown', outsideHandler, { capture: true, once: true });
            window.addEventListener('mousedown', outsideHandler, { capture: true, once: true });
            window.addEventListener('touchstart', outsideHandler, { capture: true, once: true });
            dropdown.__outsideCloseHandler = outsideHandler;
            // Fechar ao rolar ou redimensionar
            const srHandler = function() {
                animateDropdownVisibility(dropdown, false, 300);
                window.removeEventListener('scroll', srHandler, true);
                window.removeEventListener('resize', srHandler, true);
                dropdown.__scrollResizeCloseHandler = null;
            };
            window.addEventListener('scroll', srHandler, { capture: true, once: true });
            window.addEventListener('resize', srHandler, { capture: true, once: true });
            dropdown.__scrollResizeCloseHandler = srHandler;
            // Fechar imediatamente ao selecionar qualquer opção dentro do dropdown
            const optionHandler = function() {
                try {
                    fecharTodosDropdownsImpressao(true);
                } catch (_) {
                    animateDropdownVisibility(dropdown, false, 0);
                }
                dropdown.removeEventListener('click', optionHandler, true);
                dropdown.__optionSelectHandler = null;
            };
            dropdown.addEventListener('click', optionHandler, { capture: true });
            dropdown.__optionSelectHandler = optionHandler;
        } else {
            animateDropdownVisibility(dropdown, false, 300);
        }
    } catch (error) {
        console.error('Erro ao alternar dropdown de impressão (lista):', error);
    }
}

// âœ… FUNÃ‡ÃƒO PARA EXPORTAR ROMANEIO PARA EXCEL (FIREBASE)
async function exportarRomaneioExcelFirebase(romaneioId) {
    console.log(`ðŸ"Š Exportando romaneio ${romaneioId} para Excel (Firebase)`);
    
    try {
        // Verificar se XLSX estÃ¡ disponÃ­vel
        if (typeof XLSX === 'undefined') {
            console.warn("âš ï¸ Biblioteca XLSX nÃ£o disponÃ­vel - tentando carregar...");
            
            // Tentar carregar XLSX dinamicamente
            const script = document.createElement('script');
            script.src = 'https://unpkg.com/xlsx@0.18.5/dist/xlsx.full.min.js';
            script.onload = () => {
                console.log("âœ… XLSX carregado dinamicamente");
                exportarRomaneioExcelFirebase(romaneioId); // Retry
            };
            script.onerror = () => {
                alert("âŒ NÃ£o foi possÃ­vel carregar a biblioteca de exportaÃ§Ã£o Excel. Verifique sua conexÃ£o com a internet.");
            };
            document.head.appendChild(script);
            return;
        }
        
        // âœ… CARREGAR DADOS DO FIREBASE
        let romaneiosData = await getData('romaneios/tora') || {};
        try {
            const tombKey = getStorageKey('romaneiosTora_deletedIds');
            const allowLegacy = tombKey === 'romaneiosTora_deletedIds';
            const tomb = JSON.parse(localStorage.getItem(tombKey) || (allowLegacy ? localStorage.getItem('romaneiosTora_deletedIds') : null) || '[]').map(String);
            if (Array.isArray(tomb) && tomb.length > 0) {
                if (Array.isArray(romaneiosData)) {
                    romaneiosData = romaneiosData.filter(r => !tomb.includes(String(r.id)) && !tomb.includes(String(r.firebaseKey)));
                } else if (romaneiosData && typeof romaneiosData === 'object') {
                    const keys = Object.keys(romaneiosData);
                    keys.forEach(k => {
                        const v = romaneiosData[k];
                        const idCand = String((v && v.id) || k);
                        if (tomb.includes(idCand)) { delete romaneiosData[k]; }
                    });
                }
            }
        } catch (_) {}
        
        let romaneioParaExportar = null;
        
        // âœ… BUSCAR O ROMANEIO USANDO A MESMA LÃ"GICA ROBUSTA
        if (Array.isArray(romaneiosData)) {
            romaneioParaExportar = romaneiosData.find(romaneio => 
                romaneio && 
                (romaneio.id === romaneioId || 
                 romaneio.firebaseKey === romaneioId)
            );
        } else {
            Object.keys(romaneiosData).forEach(chaveFirebase => {
                const romaneio = romaneiosData[chaveFirebase];
                let romaneioProcessado = null;
                
                if (Array.isArray(romaneio) && romaneio.length > 0) {
                    romaneioProcessado = romaneio[0];
                } else if (romaneio && typeof romaneio === 'object') {
                    romaneioProcessado = romaneio;
                }
                
                if (romaneioProcessado && 
                    (romaneioProcessado.id === romaneioId || 
                     chaveFirebase === romaneioId ||
                     romaneioProcessado.firebaseKey === romaneioId)) {
                    
                    if (!romaneioParaExportar) {
                        romaneioParaExportar = {
                            ...romaneioProcessado,
                            id: romaneioProcessado.id || chaveFirebase,
                            firebaseKey: chaveFirebase
                        };
                    }
                }
            });
        }
        
        if (!romaneioParaExportar) {
            console.error(`âŒ Romaneio ${romaneioId} nÃ£o encontrado para exportaÃ§Ã£o`);
            alert("Romaneio nÃ£o encontrado para exportaÃ§Ã£o");
            return;
        }
        
        // Obter informaÃ§Ãµes do fornecedor/cliente
        const fornecedor = romaneioParaExportar.fornecedor ? romaneioParaExportar.fornecedor : null;
        const cliente = !fornecedor && romaneioParaExportar.cliente ? romaneioParaExportar.cliente : null;
        
        // Formatar data para exibiÃ§Ã£o
        let dataFormatada = 'N/A';
        if (romaneioParaExportar.data) {
            try {
                const data = new Date(romaneioParaExportar.data);
                if (!isNaN(data.getTime())) {
                    dataFormatada = data.toLocaleDateString('pt-BR');
                }
            } catch (e) {
                dataFormatada = romaneioParaExportar.data;
            }
        }
        
        // Verificar se hÃ¡ itens para exportar
        const itensParaExportar = romaneioParaExportar.itens || [];
        if (!Array.isArray(itensParaExportar) || itensParaExportar.length === 0) {
            alert("NÃ£o hÃ¡ itens para exportar neste romaneio");
            return;
        }
        
        // âœ… NORMALIZAR OS ITENS (MESMA LÃ"GICA DA IMPRESSÃƒO)
        const itensNormalizados = itensParaExportar.map(item => {
            const diametro = parseFloat(item.diametro || item.rodo || 0);
            const comprimento = parseFloat(item.comprimento || 0);
            const oco1 = parseFloat(item.oco1 || 0);
            const oco2 = parseFloat(item.oco2 || 0);
            const preco = parseFloat(item.preco || 0);
            
            let volumeBruto = parseFloat(item.volumeBruto || 0);
            let volumeDesconto = parseFloat(item.volumeDesconto || item.desconto || 0);
            let volumeLiquido = parseFloat(item.volumeLiquido || item.volumeSerraria || 0);
            
            if (!volumeBruto && typeof window.calcularVolumeTora === 'function') {
                volumeBruto = window.calcularVolumeTora(diametro, comprimento);
            } else if (!volumeBruto) {
                volumeBruto = Math.PI * Math.pow((diametro/100)/2, 2) * (comprimento/100);
            }
            
            if (!volumeDesconto && typeof window.calcularDescontoOco === 'function') {
                volumeDesconto = window.calcularDescontoOco(oco1, oco2, comprimento);
            } else if (!volumeDesconto) {
                volumeDesconto = (oco1/100) * (oco2/100) * (comprimento/100);
            }
            
            if (!volumeLiquido) {
                volumeLiquido = volumeBruto - volumeDesconto;
            }
            
            const valor = item.valor ? parseFloat(item.valor) : (volumeLiquido * preco);
            
            return {
                plaqueta: item.plaqueta || '',
                especie: item.especie || '',
                diametro,
                comprimento,
                oco1,
                oco2,
                volumeBruto,
                volumeDesconto,
                volumeLiquido,
                preco,
                valor
            };
        });
        
        // âœ… CALCULAR TOTAIS GERAIS
        let volumeBrutoTotal = 0;
        let volumeDescontoTotal = 0;
        let volumeLiquidoTotal = 0;
        let valorTotal = 0;
        
        itensNormalizados.forEach(item => {
            volumeBrutoTotal += item.volumeBruto;
            volumeDescontoTotal += item.volumeDesconto;
            volumeLiquidoTotal += item.volumeLiquido;
            valorTotal += item.valor;
        });
        
        // âœ… OBTER DADOS DA EMPRESA
        const dadosEmpresa = await getCompanyDataFirebase();
        
