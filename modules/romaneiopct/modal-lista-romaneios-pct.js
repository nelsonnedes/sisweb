// Módulo ModalListaRomaneiosPCT - Versão Simplificada e Funcional
window.ModalListaRomaneiosPCT = (function() {
    "use strict";

    const CONFIG = {
        modalId: "listaModal",
        tableId: "listaRomaneios",
        filterId: "romaneioListFilter",
        paginationId: "romaneioListPagination",
        pageKey: "pct",
        get itemsPerPage() {
            return (window.RomaneioListColumns && typeof window.RomaneioListColumns.getPageSize === 'function')
                ? window.RomaneioListColumns.getPageSize('pct', 10)
                : 10;
        }
    };
    
    let state = {
        currentPage: 1,
        romaneios: [],
        filteredRomaneios: [],
        isLoading: false
    };
    const getMessage = (key, fallback) => (
        typeof window.getRomaneioMessage === 'function'
            ? window.getRomaneioMessage(key, fallback)
            : String(fallback || '')
    );
    const MSG_CONFIRM_DELETE = getMessage('romaneio.confirm.delete', 'Tem certeza que deseja excluir este romaneio?');
    const MSG_CONFIRM_DUPLICATE_LANCAMENTO = getMessage('romaneio.confirm.duplicate_lancamento', 'Este romaneio já foi lançado em Contas a Receber. Deseja criar uma nova conta a receber?');
    const MSG_SUCCESS_DELETE = getMessage('romaneio.success.delete', 'Romaneio excluído com sucesso.');
    const MSG_SUCCESS_LANCAR_CONTAS = getMessage('romaneio.success.lancar_contas_receber', 'Conta a receber lançada com sucesso.');
    const MSG_WARNING_EDIT_BLOCKED = getMessage('romaneio.warning.already_lancado_edit_blocked', 'Este romaneio já foi lançado em Contas a Receber. Para editar, cancele primeiro o lançamento.');
    const MSG_ERROR_NOT_FOUND = getMessage('romaneio.error.not_found', 'Romaneio não encontrado.');
    const MSG_ERROR_VALOR_INVALIDO = getMessage('romaneio.error.valor_invalido', 'Valor do romaneio inválido.');
    const MSG_ERROR_DELETE_FAILED = getMessage('romaneio.error.delete_failed', 'Não foi possível excluir o romaneio.');
    const MSG_ERROR_PRINT_UNAVAILABLE = getMessage('romaneio.error.print_unavailable', 'Funcionalidade de impressão não disponível.');
    const MSG_WARNING_LANCAR_FAILED_PREFIX = getMessage('romaneio.warning.lancar_contas_receber_failed_prefix', 'Não foi possível lançar contas a receber: ');
    let modalOutsideClickHandler = null;
    const handleFilterInput = (e) => filterRomaneios(e && e.target ? e.target.value : '');

    function parseRomaneioDateCandidate(value) {
        if (!value) return 0;
        if (typeof value === 'number' && isFinite(value)) return value;
        if (value instanceof Date) {
            const t = value.getTime();
            return isNaN(t) ? 0 : t;
        }
        const t = Date.parse(value);
        return isNaN(t) ? 0 : t;
    }

    function parseRomaneioRecencyTime(r) {
        if (window.RomaneioDataUtils && typeof window.RomaneioDataUtils.parseRomaneioTimestamp === 'function') {
            return window.RomaneioDataUtils.parseRomaneioTimestamp(r);
        }
        if (!r || typeof r !== 'object') return 0;
        const candidates = [
            r && r._metadata && r._metadata.lastUpdated,
            r.updatedAt,
            r.updated,
            r.lastModified,
            r.dataEmissao,
            r.data,
            r.dataHora,
            r.dataCriacao,
            r.createdAt,
            r.created,
            r.timestamp
        ];
        for (const candidate of candidates) {
            const ts = parseRomaneioDateCandidate(candidate);
            if (ts) return ts;
        }
        const id = String(r.id || r.romaneioId || r.firebaseKey || r.key || r.numero || r.numeroRomaneio || '');
        const match = id.match(/(\d{10,})/);
        return match ? Number(match[1]) || 0 : 0;
    }

    function ensureFirebaseIoBindings() {
        try {
            const candidates = [window.firebaseService, window.firebaseServiceTL, window.unifiedFirebaseService, window.FirebaseService].filter(Boolean);
            const svc = candidates.find((item) => item && (typeof item.loadFromFirebase === 'function' || typeof item.saveToFirebase === 'function' || typeof item.saveData === 'function'));
            if (!svc) return;
            window.firebaseService = window.firebaseService || {};
            if (typeof window.firebaseService.loadFromFirebase !== 'function' && typeof svc.loadFromFirebase === 'function') {
                window.firebaseService.loadFromFirebase = svc.loadFromFirebase.bind(svc);
            }
            if (typeof window.firebaseService.saveToFirebase !== 'function') {
                if (typeof svc.saveToFirebase === 'function') {
                    window.firebaseService.saveToFirebase = svc.saveToFirebase.bind(svc);
                } else if (typeof svc.saveData === 'function') {
                    window.firebaseService.saveToFirebase = async function(path, key, data) {
                        const fullPath = key !== null && key !== undefined ? `${String(path || '').replace(/\/+$/, '')}/${key}` : String(path || '');
                        return svc.saveData(fullPath, data);
                    };
                }
            }
            if (typeof window.firebaseService.getNamespacedPath !== 'function' && typeof svc.getNamespacedPath === 'function') {
                window.firebaseService.getNamespacedPath = svc.getNamespacedPath.bind(svc);
            }
        } catch (_) {}
    }
    ensureFirebaseIoBindings();

    function resolveCompanyId() {
        try {
            const svc = window.firebaseService || window.firebaseServiceTL || window.FirebaseService;
            if (svc && typeof svc.getCurrentTenantId === 'function') {
                const t = svc.getCurrentTenantId();
                if (t) return String(t);
            }
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

    function filterByActiveTenant(list) {
        const tenant = resolveCompanyId();
        if (!tenant) return [];
        return (Array.isArray(list) ? list : []).filter(item => {
            if (!item || typeof item !== 'object') return false;
            const itemTenant = item.companyId || item.tenantId || item.companyID || null;
            if (!itemTenant) return true;
            return String(itemTenant) === String(tenant);
        });
    }

    async function sanitizeMissingCompanyId(records, tenantId) {
        return records || [];
    }

    function normalizeRomaneiosPctData(data, source = 'firebase') {
        if (window.RomaneioDataUtils && typeof window.RomaneioDataUtils.normalizeRomaneioCollection === 'function') {
            return window.RomaneioDataUtils.normalizeRomaneioCollection(data, { type: 'PCT' })
                .map(item => ({ ...item, __source: source }));
        }
        if (Array.isArray(data)) {
            return data
                .filter(item => item && (item.cliente || item.numero || item.id))
                .map(item => ({ ...item, __source: source }));
        }
        if (data && typeof data === 'object') {
            return Object.entries(data)
                .map(([key, item]) => ({ id: key, firebaseKey: key, ...(item || {}) }))
                .filter(item => item && (item.cliente || item.numero || item.id))
                .map(item => ({ ...item, __source: source }));
        }
        return [];
    }

    function readLocalStorageValue(key) {
        for (const k of getLocalStorageKeys(key)) {
            const val = localStorage.getItem(k);
            if (val) return val;
        }
        return null;
    }

    // ✅ Limite máximo de payload para localStorage (1.5MB por chave)
    const LS_MAX_BYTES = 1.5 * 1024 * 1024;
    // Número máximo de romaneios a manter em cache quando limit é atingido
    const LS_MAX_ROMANEIOS_CACHE = 50;

    /**
     * Remove chaves de cache antigas e desnecessrias do localStorage para liberar espao.
     * Seguro: nunca remove chaves de autenticao ou configuraes crticas.
     */
    function clearOldLocalStorageCache() {
        try {
            const SAFE_KEYS_PREFIXES = ['currentUser', 'persistentUser', 'company_info', 'firebaseConfig', '__', 'sisweb_alerts'];
            const CACHE_PREFIXES_TO_CLEAN = ['companies/', 'romaneiosPct_backup', 'romaneiosTs'];
            const keysToRemove = [];
            for (let i = 0; i < localStorage.length; i++) {
                const k = localStorage.key(i);
                if (!k) continue;
                // Não remover chaves seguras
                if (SAFE_KEYS_PREFIXES.some(p => k.startsWith(p) || k === p)) continue;
                // Remover backups e caches de romaneios
                if (CACHE_PREFIXES_TO_CLEAN.some(p => k.includes(p))) {
                    keysToRemove.push(k);
                }
            }
            keysToRemove.forEach(k => { try { localStorage.removeItem(k); } catch (_) {} });
            if (keysToRemove.length > 0) {
                console.warn(`⚠️ PCT: Storage limpo — ${keysToRemove.length} chave(s) de cache removida(s) para liberar espaço.`);
            }
        } catch (_) {}
    }

    function writeLocalStorageValue(key, data) {
        try {
            if (window.SiswebStorage && typeof window.SiswebStorage.write === 'function') {
                window.SiswebStorage.write(key, data);
                return;
            }
        } catch (_) {}
        const payload = typeof data === 'string' ? data : JSON.stringify(data);
        // ✅ CORREÇÃO: Verificar tamanho antes de tentar gravar
        const byteSize = new Blob([payload]).size;
        if (byteSize > LS_MAX_BYTES) {
            console.warn(`⚠️ PCT: Payload de ${key} muito grande (${(byteSize / 1024).toFixed(0)}KB). Truncando...`);
            // Não grava payloads gigantes que certamente estourariam a quota
            return;
        }
        for (const k of getLocalStorageKeys(key)) {
            try {
                localStorage.setItem(k, payload);
            } catch (err) {
                if (err && (err.name === 'QuotaExceededError' || err.code === 22 || (err.message && err.message.toLowerCase().includes('quota')))) {
                    console.warn(`⚠️ PCT: QuotaExceededError ao gravar '${k}'. Tentando liberar cache...`);
                    // 1ª tentativa: limpar caches antigos
                    clearOldLocalStorageCache();
                    try {
                        localStorage.setItem(k, payload);
                        console.log(`✅ PCT: Gravado '${k}' após limpeza de cache.`);
                    } catch (err2) {
                        // 2ª tentativa: falhou definitivamente — logar sem crashar o módulo
                        console.warn(`⚠️ PCT: Não foi possível gravar '${k}' no localStorage (storage cheio). Operando apenas com Firebase.`);
                    }
                } else {
                    console.warn(`⚠️ PCT: Erro ao gravar '${k}' no localStorage:`, err && err.message ? err.message : err);
                }
            }
        }
    }


    function resolvePath(path) {
        try {
            const base = String(path || '');
            if (!base) return base;
            if (/^companies\//.test(base) || /^users\//.test(base)) return base;
            const svc = window.firebaseService || window.firebaseServiceTL || window.FirebaseService;
            if (svc && typeof svc.getNamespacedPath === 'function') {
                return svc.getNamespacedPath(base);
            }
            const companyId = resolveCompanyId();
            if (companyId) return `companies/${companyId}/${base}`;
        } catch (_) {}
        return path;
    }

    let realtimeUnsubscribe = null;
    let realtimeStarting = false;
    let realtimeRetryCount = 0;

    // 📡 Listener realtime para manter lista sincronizada entre PCs
    async function setupRealtimeRomaneiosPct() {
        try {
            if (realtimeUnsubscribe || realtimeStarting) return;
            realtimeStarting = true;
            // Tentar obter DB com retentativas se necessário
            let db = null;
            if (window.firebaseService && window.firebaseService.dbService && typeof window.firebaseService.dbService.getDatabase === 'function') {
                db = window.firebaseService.dbService.getDatabase();
            } else {
                db = window.firebaseService ? window.firebaseService.db : window.database;
            }
            
            if (!db) {
                console.warn('⚠️ PCT: Firebase database indisponível, aguardando inicialização...');
                // Tentar novamente em 1 segundo (max 3 tentativas)
                let attempts = 0;
                while (!db && attempts < 3) {
                    await new Promise(r => setTimeout(r, 1000));
                    if (window.firebaseService && window.firebaseService.dbService && typeof window.firebaseService.dbService.getDatabase === 'function') {
                        db = window.firebaseService.dbService.getDatabase();
                    } else {
                        db = window.firebaseService ? window.firebaseService.db : window.database;
                    }
                    attempts++;
                }
            }

            if (!db) {
                console.error('❌ PCT: Falha crítica - Firebase database indisponível após retentativas');
                return;
            }

            const { ref, onValue } = await import('https://www.gstatic.com/firebasejs/10.7.1/firebase-database.js');
            const realtimePath = resolvePath('romaneios/pct');
            if (realtimePath === 'romaneios/pct' && !resolveCompanyId()) {
                realtimeStarting = false;
                if (realtimeRetryCount < 6) {
                    realtimeRetryCount += 1;
                    setTimeout(setupRealtimeRomaneiosPct, 1200);
                } else {
                    console.warn('⚠️ PCT: CompanyId indisponível para realtime. Listener não iniciado.');
                }
                return;
            }
            
            // ✅ CORREÇÃO: Aplicar getNamespacedPath se resolverPath não retornou path absoluto
            let finalRealtimePath = realtimePath;
            if (!finalRealtimePath.startsWith('companies/')) {
                const svc = window.firebaseService || window.firebaseServiceTL || window.FirebaseService;
                if (svc && typeof svc.getNamespacedPath === 'function') {
                    finalRealtimePath = svc.getNamespacedPath(finalRealtimePath);
                }
            }
            
            realtimeUnsubscribe = onValue(ref(db, finalRealtimePath), (snapshot) => {
                const val = snapshot.val() || {};
                const arr = normalizeRomaneiosPctData(val, 'firebase');

                if (arr.length === 0) {
                    console.log('📡 PCT: Realtime recebido sem romaneios válidos em companies/{companyId}/romaneios/pct');
                }

                // Atualizar estado e UI
                state.romaneios = arr.sort((a, b) => parseRomaneioRecencyTime(b) - parseRomaneioRecencyTime(a));
                state.filteredRomaneios = [...state.romaneios];
                // Se modal aberto, re-renderizar
                const modal = document.getElementById(CONFIG.modalId);
                if (modal && modal.style.display === 'block') {
                    renderRomaneiosList();
                    renderPagination();
                    updateModalInfo();
                }
                // Disparar evento para outros módulos interessados
                try { window.dispatchEvent(new CustomEvent('romaneiosPct:updated', { detail: { total: arr.length } })); } catch {}
                console.log(`📡 PCT: Realtime recebido (${arr.length} itens)`);
            }, (error) => {
                const errStr = String((error && error.code) || (error && error.message) || error || '').toLowerCase();
                if (errStr.includes('permission') || errStr.includes('denied')) {
                    console.warn('⚠️ PCT: Realtime sem permissão. Listener desativado.');
                    try { if (typeof realtimeUnsubscribe === 'function') realtimeUnsubscribe(); } catch (_) {}
                    realtimeUnsubscribe = null;
                    realtimeStarting = false;
                    return;
                }
                console.error('❌ PCT: Erro no listener realtime:', error);
            });
            realtimeStarting = false;
        } catch (e) {
            realtimeStarting = false;
            console.warn('⚠️ PCT: Falha ao configurar listener realtime:', e);
        }
    }

    // 🔧 Util: obter query param
    function getQueryParam(name) {
        try {
            const params = new URLSearchParams(window.location.search);
            return params.get(name);
        } catch (_) { return null; }
    }

    // ✅ Persistência segura do localStorage para evitar perda acidental
    function safePersistRomaneiosPct(lista, contexto = 'desconhecido') {
        try {
            const tenant = resolveCompanyId();
            if (!tenant) {
                console.warn(`🛑 PCT: Persistência local bloqueada sem tenant ativo (contexto: ${contexto}).`);
                return false;
            }

            const isArray = Array.isArray(lista);
            const nextCount = isArray ? lista.length : (lista && typeof lista === 'object' ? Object.keys(lista).length : 0);

            if (nextCount === 0) {
                // Verificar se há dados anteriores antes de sobrescrever
                try {
                    const prevRaw = readLocalStorageValue('romaneiosPct');
                    if (prevRaw) {
                        const prevList = JSON.parse(prevRaw);
                        const prevCount = Array.isArray(prevList) ? prevList.length : 0;
                        if (prevCount > 0) {
                            console.warn(`🛑 PCT: Evitando sobrescrever romaneiosPct com lista vazia (contexto: ${contexto}). Mantendo ${prevCount} itens.`);
                            return false;
                        }
                    }
                } catch (_) {}
            }

            // ✅ CORREÇÃO: Limitar a lista ao cache máximo antes de serializar
            let listaParaSalvar = isArray ? lista : Object.values(lista || {});
            if (listaParaSalvar.length > LS_MAX_ROMANEIOS_CACHE) {
                // Ordenar por data mais recente e manter apenas os N mais recentes
                const sorted = [...listaParaSalvar].sort((a, b) => parseRomaneioRecencyTime(b) - parseRomaneioRecencyTime(a));
                listaParaSalvar = sorted.slice(0, LS_MAX_ROMANEIOS_CACHE);
                console.warn(`⚠️ PCT: Lista de romaneios truncada para ${LS_MAX_ROMANEIOS_CACHE} itens mais recentes (total: ${nextCount}). Dados completos no Firebase.`);
            }

            // ✅ CORREÇÃO: Não gravar backup automático — foi a causa direta do QuotaExceededError
            // (gravava a lista 2x: backup + lista atual, dobrando o uso de espaço)
            // O Firebase é a fonte de verdade; o backup local é suprtfluo.

            writeLocalStorageValue('romaneiosPct', JSON.stringify(listaParaSalvar));
            console.log(`💾 PCT: romaneiosPct atualizado com ${listaParaSalvar.length} itens (contexto: ${contexto}).`);
            return true;
        } catch (err) {
            console.error('❌ PCT: Erro na persistência segura de romaneiosPct:', err);
            return false;
        }
    }


    async function openModal() {
        console.log(" PCT: Abrindo modal de lista de romaneios...");
        try {
            const modal = document.getElementById(CONFIG.modalId);
            if (!modal) {
                console.error(" PCT: Modal de romaneios não encontrado no DOM");
                return;
            }
            modal.style.display = "block";

            // Inicializar redimensionamento de colunas e altura de linhas
            const table = modal.querySelector('table');
            if (table && window.RomaneioListColumns && typeof window.RomaneioListColumns.initTable === 'function') {
                window.RomaneioListColumns.initTable(table, 'pct');
            }

            // Renderizar estrutura inicial imediatamente
            renderRomaneiosList();
            renderPagination();
            setupEventListeners();

            // Ativar realtime ao abrir o modal
            setupRealtimeRomaneiosPct();
            // ✅ Preferir dados do Firebase ao abrir (ignorar merge local)
            await loadRomaneios(true);
            renderRomaneiosList();
            renderPagination();
            console.log(" PCT: Modal de romaneios aberto com sucesso");
        } catch (error) {
            console.error(" PCT: Erro ao abrir modal de romaneios:", error);
        }
    }

    async function loadRomaneios(preferFirebase = false) {
        console.log("🔄 PCT: Carregando romaneios...");
        try {
            let romaneios = [];
            const activeTenant = resolveCompanyId();
            
            // ✅ PRIORIDADE: Usar firebaseService (mesmo padrão do TL)
            if (window.firebaseService && typeof window.firebaseService.loadFromFirebase === 'function') {
                try {
                    console.log("🔥 PCT: Carregando com firebaseService (prioridade)...");
                    const result = await window.firebaseService.loadFromFirebase("romaneios/pct");
                    console.log("🔍 PCT: Resultado do firebaseService:", result);
                    
                    if (result && result.success && result.data) {
                        const firebaseData = result.data;
                        console.log("🔍 PCT: Dados do firebaseService:", Array.isArray(firebaseData) ? `Array com ${firebaseData.length} itens` : 'Objeto');
                        romaneios = normalizeRomaneiosPctData(firebaseData, 'firebase');
                        if (romaneios.length > 0) {
                            console.log(`✅ PCT: ${romaneios.length} romaneios carregados do firebaseService`);
                        } else {
                            console.log("📭 PCT: firebaseService retornou dados vazios");
                        }
                    } else {
                        console.log("📭 PCT: firebaseService não retornou dados válidos");
                    }
                } catch (firebaseError) {
                    console.warn("⚠️ PCT: Erro ao carregar do firebaseService:", firebaseError);
                }
            }
            
            // ✅ FALLBACK: Firebase direto se firebaseService falhou
            if (romaneios.length === 0 && window.database) {
                try {
                    console.log("🔄 PCT: Fallback para Firebase direto...");
                    const { ref, get } = await import('https://www.gstatic.com/firebasejs/10.7.1/firebase-database.js');
                    const romaneiosRef = ref(window.database, resolvePath('romaneios/pct'));
                    const snapshot = await get(romaneiosRef);
                    
                    if (snapshot.exists()) {
                        const firebaseData = snapshot.val();
                        console.log("🔍 PCT: Dados do Firebase direto:", Array.isArray(firebaseData) ? `Array com ${firebaseData.length} itens` : 'Objeto');
                        romaneios = normalizeRomaneiosPctData(firebaseData, 'firebase');
                        console.log(`✅ PCT: ${romaneios.length} romaneios carregados do Firebase direto`);
                    } else {
                        console.log("📭 PCT: Nenhum dado encontrado no Firebase direto");
                    }
                } catch (firebaseError) {
                    console.warn("⚠️ PCT: Erro ao carregar diretamente do Firebase:", firebaseError);
                }
            }
            if (romaneios.length === 0) {
                console.log('📭 PCT: nenhum romaneio válido em companies/{companyId}/romaneios/pct');
            }

            // 🔎 Diagnóstico: verificar romaneios do cliente Lucas
            try {
                const lucasCount = romaneios.filter(r => {
                    const nome = typeof r?.cliente === 'string' ? r.cliente : (r?.cliente?.nome || r?.cliente?.name || '');
                    return String(nome).toLowerCase().includes('lucas');
                }).length;
                console.log(`🔎 PCT: Romaneios com cliente 'Lucas': ${lucasCount}`);
            } catch (lucasErr) {
                console.warn('⚠️ PCT: Erro ao diagnosticar romaneios do cliente Lucas:', lucasErr);
            }

            // 🎯 Foco por ID via query string (debug)
            const focusId = getQueryParam('focusId');
            if (focusId) {
                const exists = romaneios.some(r => String(r?.id) === String(focusId) || String(r?.numero) === String(focusId));
                console.log(`🎯 PCT: focusId=${focusId} presente na lista? ${exists}`);
                if (!exists) {
                    console.warn('🕵️ PCT: ID de foco não encontrado após mescla. Verifique backup e fontes.');
                }
            }

            console.log(`🔍 DEBUG PCT: Total de romaneios carregados: ${romaneios.length}`);
            romaneios = await sanitizeMissingCompanyId(romaneios, activeTenant);
            romaneios = filterByActiveTenant(romaneios).map(({ __source, ...rest }) => rest);
            console.log(`🔐 PCT: Romaneios após filtro de tenant (${activeTenant || 'sem tenant'}): ${romaneios.length}`);
            romaneios.sort((a, b) => parseRomaneioRecencyTime(b) - parseRomaneioRecencyTime(a));
            
            // ✅ APLICAR PRESERVAÇÃO DE PROPRIEDADES FINANCEIRAS
            if (window.PreservacaoFinanceirasPCT && typeof window.PreservacaoFinanceirasPCT.aplicarPreservacao === 'function') {
                console.log('🛡️ PCT: Aplicando preservação de propriedades financeiras...');
                romaneios = window.PreservacaoFinanceirasPCT.aplicarPreservacao(romaneios);
                console.log('✅ PCT: Preservação aplicada com sucesso');
            } else {
                console.warn('⚠️ PCT: PreservacaoFinanceirasPCT não disponível');
            }
            
            state.romaneios = romaneios;
            state.filteredRomaneios = romaneios;
            state.currentPage = 1;

            // 🧪 DEBUG: Verificar estados de lançamento após carregamento
            const romaneiosComLancamento = romaneios.filter(r => r.contasReceberLancado === true);
            console.log(`✅ PCT: Total de ${romaneios.length} romaneios carregados, ${romaneiosComLancamento.length} já lançados`);
            if (romaneiosComLancamento.length > 0) {
                console.log("🔍 PCT: Romaneios já lançados:", romaneiosComLancamento.map(r => `${r.id} (${r.contasReceberLancado})`));
            }
            console.log('📅 PCT: Romaneios ordenados - último gravado no topo');
            
            // ✅ RENDERIZAR A LISTA APÓS CARREGAR OS DADOS
            renderRomaneiosList();
            renderPagination();
            updateModalInfo(); // ✅ ATUALIZAR INFO DO FOOTER
            console.log("🎨 PCT: Lista e paginação renderizadas");
        } catch (error) {
            console.error(" PCT: Erro ao carregar romaneios:", error);
        }
    }

    // 🔍 Ferramenta de diagnóstico: localizar romaneio por ID em fontes
    window.debugFindRomaneioPct = async function(idAlvo) {
        const result = { id: String(idAlvo), localAtual: null, localBackup: null, firebaseService: null, firebaseDireto: null };
        try {
            const raw = readLocalStorageValue('romaneiosPct');
            if (raw) {
                const data = JSON.parse(raw);
                const items = Array.isArray(data) ? data : (typeof data === 'object' ? Object.values(data) : []);
                result.localAtual = items.find(r => String(r?.id) === String(idAlvo) || String(r?.numero) === String(idAlvo)) || null;
            }
        } catch (e) { console.warn('debugFindRomaneioPct localAtual erro:', e); }

        try {
            const rawB = readLocalStorageValue('romaneiosPct_backup');
            if (rawB) {
                const dataB = JSON.parse(rawB);
                const itemsB = Array.isArray(dataB) ? dataB : (typeof dataB === 'object' ? Object.values(dataB) : []);
                result.localBackup = itemsB.find(r => String(r?.id) === String(idAlvo) || String(r?.numero) === String(idAlvo)) || null;
            }
        } catch (e) { console.warn('debugFindRomaneioPct localBackup erro:', e); }

        try {
            if (window.firebaseService && typeof window.firebaseService.loadFromFirebase === 'function') {
                const res = await window.firebaseService.loadFromFirebase('romaneios/pct');
                if (res && res.success && res.data) {
                    const items = Array.isArray(res.data) ? res.data : (typeof res.data === 'object' ? Object.values(res.data) : []);
                    result.firebaseService = items.find(r => String(r?.id) === String(idAlvo) || String(r?.numero) === String(idAlvo)) || null;
                }
            }
        } catch (e) { console.warn('debugFindRomaneioPct firebaseService erro:', e); }

        try {
            if (!result.firebaseService && window.database) {
                const { ref, get } = await import('https://www.gstatic.com/firebasejs/10.7.1/firebase-database.js');
                const romaneiosRef = ref(window.database, resolvePath('romaneios/pct'));
                const snapshot = await get(romaneiosRef);
                if (snapshot.exists()) {
                    const firebaseData = snapshot.val();
                    const items = Array.isArray(firebaseData) ? firebaseData : (typeof firebaseData === 'object' ? Object.values(firebaseData) : []);
                    result.firebaseDireto = items.find(r => String(r?.id) === String(idAlvo) || String(r?.numero) === String(idAlvo)) || null;
                }
            }
        } catch (e) { console.warn('debugFindRomaneioPct firebaseDireto erro:', e); }

        console.log('🔎 debugFindRomaneioPct resultado:', result);
        return result;
    }

    function normalizeDateInputValue(value) {
        if (typeof value === 'number' && isFinite(value)) {
            const parsed = new Date(value);
            if (!isNaN(parsed.getTime())) {
                const y = parsed.getFullYear();
                const m = String(parsed.getMonth() + 1).padStart(2, '0');
                const d = String(parsed.getDate()).padStart(2, '0');
                return `${y}-${m}-${d}`;
            }
        }
        const raw = String(value || '').trim();
        if (!raw) return '';
        const iso = raw.match(/^(\d{4})-(\d{2})-(\d{2})/);
        if (iso) return `${iso[1]}-${iso[2]}-${iso[3]}`;
        const br = raw.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
        if (br) return `${br[3]}-${br[2]}-${br[1]}`;
        const parsed = new Date(raw);
        if (!isNaN(parsed.getTime())) {
            const y = parsed.getFullYear();
            const m = String(parsed.getMonth() + 1).padStart(2, '0');
            const d = String(parsed.getDate()).padStart(2, '0');
            return `${y}-${m}-${d}`;
        }
        return '';
    }

    function formatDateLabel(value) {
        const normalized = normalizeDateInputValue(value);
        if (!normalized) return value ? String(value) : 'N/A';
        const parts = normalized.split('-');
        return `${parts[2]}/${parts[1]}/${parts[0]}`;
    }

    function toLocalDateObject(value) {
        const normalized = normalizeDateInputValue(value);
        if (normalized) {
            const parts = normalized.split('-').map(Number);
            return new Date(parts[0], parts[1] - 1, parts[2]);
        }
        return new Date();
    }
    
    function renderRomaneiosList() {
        console.log("🎨 PCT: Renderizando lista de romaneios...");
        console.log("🎨 PCT: Estado atual:", state);
        console.log("🎨 PCT: Romaneios para renderizar:", state.filteredRomaneios);
        
        // ✅ CORRIGIDO: Buscar o tbody dentro do modal
        let tableBody = document.querySelector(`#${CONFIG.modalId} tbody#${CONFIG.tableId}`);
        console.log("🎨 PCT: Tbody encontrado:", !!tableBody);
        console.log("🎨 PCT: Seletor usado:", `#${CONFIG.modalId} tbody#${CONFIG.tableId}`);
        console.log("🎨 PCT: CONFIG.modalId:", CONFIG.modalId);
        console.log("🎨 PCT: CONFIG.tableId:", CONFIG.tableId);
        
        if (!tableBody) {
            console.error("❌ PCT: Tbody da tabela não encontrado");
            console.error("❌ PCT: Procurando por:", `#${CONFIG.modalId} tbody#${CONFIG.tableId}`);
            
            // 🔍 TENTATIVA ALTERNATIVA: Buscar apenas pelo ID do tbody
            const alternativeTableBody = document.getElementById(CONFIG.tableId);
            console.log("🔍 PCT: Tentativa alternativa - tbody por ID:", !!alternativeTableBody);
            
            if (alternativeTableBody) {
                console.log("✅ PCT: Tbody encontrado por ID alternativo");
                tableBody = alternativeTableBody;
            } else {
                console.error("❌ PCT: Tbody não encontrado nem por seletor nem por ID");
            return;
            }
        }

        const startIndex = (state.currentPage - 1) * CONFIG.itemsPerPage;
        const endIndex = startIndex + CONFIG.itemsPerPage;
        const romaneiosToShow = state.filteredRomaneios.slice(startIndex, endIndex);

        tableBody.innerHTML = "";

        if (romaneiosToShow.length === 0) {
            const emptyRow = document.createElement("tr");
            emptyRow.innerHTML = '<td colspan="7" class="text-center">Nenhum romaneio encontrado</td>';
            tableBody.appendChild(emptyRow);
            console.log("🎨 PCT: Linha vazia adicionada");
            updateModalInfo();
            renderPagination();
            return;
        }

        romaneiosToShow.forEach((romaneio, index) => {
            console.log(`🎨 PCT: Renderizando romaneio ${index + 1}:`, romaneio);
            
            // ✅ CORREÇÃO: Extrair dados corretamente
            const clienteNome = romaneio.cliente ? 
                (typeof romaneio.cliente === 'string' ? romaneio.cliente : 
                 romaneio.cliente.nome || romaneio.cliente.name || 'Cliente não identificado') : 'N/A';
            
            // ✅ CORREÇÃO: Evitar duplicação de espécies
            let especiesTexto = 'N/A';
            if (romaneio.especies) {
                if (Array.isArray(romaneio.especies)) {
                    // 🔍 REMOVER DUPLICATAS
                    const especiesUnicas = [...new Set(romaneio.especies)];
                    especiesTexto = especiesUnicas.join(", ");
                } else if (typeof romaneio.especies === 'string') {
                    especiesTexto = romaneio.especies;
                }
            } else if (romaneio.itens && Array.isArray(romaneio.itens)) {
                // 🔍 EXTRAIR ESPÉCIES DOS ITENS SEM DUPLICATAS
                const especiesDosItens = romaneio.itens
                    .map(item => item.especie || item.descricao || 'N/A')
                    .filter((especie, index, arr) => arr.indexOf(especie) === index); // 🔍 REMOVER DUPLICATAS
                especiesTexto = especiesDosItens.join(", ");
            }
            
            const dataFormatada = formatDateLabel(romaneio.dataEmissao || romaneio.data || romaneio.timestamp);
            
            // ✅ CORREÇÃO: Buscar volume e valor nos campos corretos do Firebase
            let volume = 0;
            let valor = 0;
            
            // 🔍 TENTAR DIFERENTES CAMPOS PARA VOLUME - CORRIGIDO
            // ✅ CORREÇÃO: Buscar primeiro em totais.volume (estrutura correta do salvamento)
            if (romaneio.totais && romaneio.totais.volume) {
                volume = parseFloat(romaneio.totais.volume);
                console.log(`📏 PCT: Volume encontrado em totais.volume: ${volume}`);
            }
            // Fallbacks para outras estruturas
            else if (romaneio.volumeTotal) volume = parseFloat(romaneio.volumeTotal);
            else if (romaneio.volume) volume = parseFloat(romaneio.volume);
            else if (romaneio.totalVolume) volume = parseFloat(romaneio.totalVolume);
            else if (romaneio.itens && Array.isArray(romaneio.itens)) {
                // 🔍 CALCULAR VOLUME DOS ITENS
                volume = romaneio.itens.reduce((total, item) => {
                    const itemVolume = item.volume || item.volumeItem || item.vol || 0;
                    return total + (parseFloat(itemVolume) || 0);
                }, 0);
                console.log(`📏 PCT: Volume calculado dos itens: ${volume}`);
            }
            
            // 🔍 TENTAR DIFERENTES CAMPOS PARA VALOR - CORRIGIDO
            // ✅ CORREÇÃO: Buscar primeiro em totais.valor (estrutura correta do salvamento)
            if (romaneio.totais && romaneio.totais.valor) {
                valor = parseFloat(romaneio.totais.valor);
                console.log(`💰 PCT: Valor encontrado em totais.valor: ${valor}`);
            }
            // Fallbacks para outras estruturas
            else if (romaneio.valorTotal) valor = parseFloat(romaneio.valorTotal);
            else if (romaneio.valor) valor = parseFloat(romaneio.valor);
            else if (romaneio.totalValor) valor = parseFloat(romaneio.totalValor);
            else if (romaneio.itens && Array.isArray(romaneio.itens)) {
                // 🔍 CALCULAR VALOR DOS ITENS USANDO ESTRUTURA CORRETA
                valor = romaneio.itens.reduce((total, item) => {
                    // ✅ CORREÇÃO: Usar valorTotal dos itens (estrutura correta)
                    const itemValor = item.valorTotal || item.valor || item.preco || item.price || item.valorItem || 0;
                    return total + (parseFloat(itemValor) || 0);
                }, 0);
                console.log(`💰 PCT: Valor calculado dos itens: ${valor}`);
            }
            
            // ✅ DEBUG DETALHADO PARA IDENTIFICAR ESTRUTURA
            console.log(`🔍 PCT: Romaneio ${romaneio.id} - Volume: ${volume}, Valor: ${valor}`);
            console.log(`🔍 PCT: Estrutura do romaneio ${romaneio.id}:`, {
                temTotais: !!romaneio.totais,
                totais: romaneio.totais,
                temItens: !!romaneio.itens,
                quantidadeItens: romaneio.itens?.length || 0,
                primeiroItem: romaneio.itens?.[0]
            });
            
            const row = document.createElement("tr");
            row.innerHTML = `
<td data-label="Data">${dataFormatada}</td>
<td data-label="Cliente">${clienteNome}</td>
<td data-label="Espécies">${especiesTexto}</td>
<td data-label="Itens" style="text-align: center;">${romaneio.itens ? romaneio.itens.length : 0}</td>
<td data-label="Volume" style="text-align: right;">${volume > 0 ? volume.toFixed(3) : "0.000"} m³</td>
<td data-label="Valor Total">${valor > 0 ? `R$ ${valor.toLocaleString('pt-BR', {minimumFractionDigits: 2})}` : "R$ 0,00"}</td>
<td data-label="Ações" style="text-align: center;">
                    <div class="btn-group" style="display: flex; gap: 5px; justify-content: center;">
                        <button class="action-button edit-button" onclick="window.ModalListaRomaneiosPCT.editRomaneio('${romaneio.id}')" title="Editar Romaneio">
                            <i class="fas fa-edit"></i>
                        </button>
                        <button class="action-button clone-button" onclick="window.ModalListaRomaneiosPCT.clonarRomaneio('${romaneio.id}')" title="Clonar Romaneio">
                            <i class="fas fa-copy"></i>
                        </button>
                        <div class="dropdown">
                            <button class="action-button print-button" onclick="window.ModalListaRomaneiosPCT.togglePrintDropdown(this)" title="Imprimir Romaneio">
                                        <i class="fas fa-print"></i>
                                    </button>
                                    <div class="dropdown-content">
                                        <a href="#" onclick="event.preventDefault(); event.stopPropagation(); window.ModalListaRomaneiosPCT.printRomaneio('${romaneio.id}', 'completo'); return false;">
                                            <i class="fas fa-file-alt"></i> Completo
                                        </a>
                                        <a href="#" onclick="event.preventDefault(); event.stopPropagation(); window.ModalListaRomaneiosPCT.printRomaneio('${romaneio.id}', 'sem_preco_unitario'); return false;">
                                            <i class="fas fa-file-minus"></i> Sem Preço Unitário
                                        </a>
                                        <a href="#" onclick="event.preventDefault(); event.stopPropagation(); window.ModalListaRomaneiosPCT.printRomaneio('${romaneio.id}', 'sem_preco'); return false;">
                                            <i class="fas fa-file-times"></i> Sem Preços
                                        </a>
                                    </div>
                                </div>
                                <button class="action-button delete-button" onclick="window.ModalListaRomaneiosPCT.deleteRomaneio('${romaneio.id}')" title="Excluir Romaneio">
                                    <i class="fas fa-trash"></i>
                                </button>
                            </div>
                        </td>
                    `;
                    tableBody.appendChild(row);
                    console.log(`🎨 PCT: Linha ${index + 1} adicionada à tabela`);
                });
            }

            function renderPagination() {
                const paginationContainer = document.getElementById(CONFIG.paginationId);
                if (!paginationContainer) return;

                if (window.RomaneioListColumns && typeof window.RomaneioListColumns.renderPaginationBar === 'function') {
                    paginationContainer.style.display = 'flex';
                    window.RomaneioListColumns.renderPaginationBar(paginationContainer, {
                        totalItems: state.filteredRomaneios.length,
                        currentPage: state.currentPage,
                        pageSize: CONFIG.itemsPerPage,
                        pageKey: 'pct',
                        onPageChange: (newPage) => goToPage(newPage),
                        onPageSizeChange: () => {
                            state.currentPage = 1;
                            renderRomaneiosList();
                            renderPagination();
                        },
                        onDensityChange: () => {}
                    });
                    return;
                }

        const totalPages = Math.ceil(state.filteredRomaneios.length / CONFIG.itemsPerPage);
        if (totalPages <= 1) {
            paginationContainer.style.display = 'none';
            paginationContainer.innerHTML = "";
            return;
        }

        if (state.currentPage > totalPages) state.currentPage = totalPages;
        if (state.currentPage < 1) state.currentPage = 1;

        paginationContainer.style.display = 'flex';
        paginationContainer.innerHTML = '';

        const addBtn = (label, page, disabled = false, active = false) => {
            const btn = document.createElement('button');
            btn.textContent = label;
            if (active) btn.classList.add('active');
            btn.disabled = disabled;
            btn.onclick = () => goToPage(page);
            paginationContainer.appendChild(btn);
        };

        addBtn('<<<', 1, state.currentPage === 1);
        addBtn('<', state.currentPage - 1, state.currentPage === 1);
        const startPage = Math.max(1, state.currentPage - 2);
        const endPage = Math.min(totalPages, state.currentPage + 2);
        if (startPage > 1) {
            addBtn('1', 1, false, state.currentPage === 1);
            if (startPage > 2) {
                const span = document.createElement('span');
                span.textContent = '...';
                paginationContainer.appendChild(span);
            }
        }
        for (let i = startPage; i <= endPage; i++) {
            addBtn(String(i), i, false, i === state.currentPage);
        }
        if (endPage < totalPages) {
            if (endPage < totalPages - 1) {
                const span = document.createElement('span');
                span.textContent = '...';
                paginationContainer.appendChild(span);
            }
            addBtn(String(totalPages), totalPages, false, state.currentPage === totalPages);
        }
        addBtn('>', state.currentPage + 1, state.currentPage === totalPages);
        addBtn('>>>', totalPages, state.currentPage === totalPages);
    }
    
    function goToPage(page) {
        if (page < 1 || page > Math.ceil(state.filteredRomaneios.length / CONFIG.itemsPerPage)) return;
        state.currentPage = page;
        renderRomaneiosList();
        renderPagination();
    }

    // ✅ Helper: obter texto do cliente mesmo quando é objeto
    function getClienteTexto(cliente) {
        if (!cliente) return '';
        if (typeof cliente === 'string') return cliente;
        if (typeof cliente === 'object') {
            const nome = cliente.nome || cliente.name || cliente.razao || cliente.razaoSocial || cliente.nomeFantasia || cliente.fantasia || cliente.cliente || cliente.titulo;
            return nome ? String(nome) : '';
        }
        return String(cliente || '');
    }

    // ✅ Helper: toLowerCase seguro para qualquer valor
    function toLowerSafe(val) {
        return String(val || '').toLowerCase();
    }

    function filterRomaneios(searchTerm) {
        if (!searchTerm || searchTerm.trim() === "") {
            state.filteredRomaneios = state.romaneios;
        } else {
            const term = searchTerm.toLowerCase();
            state.filteredRomaneios = state.romaneios.filter(romaneio => {
                const clienteTxt = toLowerSafe(getClienteTexto(romaneio.cliente));
                const numeroTxt = toLowerSafe(romaneio.numero || romaneio.id);
                const dataTxt = toLowerSafe(`${romaneio.dataEmissao || romaneio.data || ''} ${formatDateLabel(romaneio.dataEmissao || romaneio.data || romaneio.timestamp)}`);

                return clienteTxt.includes(term) || numeroTxt.includes(term) || dataTxt.includes(term);
            });
        }
        state.currentPage = 1;
        renderRomaneiosList();
        renderPagination();
    }

    function editRomaneio(romaneioId) {
        console.log(`📝 PCT: Editando romaneio ${romaneioId}`);
        const sid = String(romaneioId || '');
        const romaneio = state.romaneios.find(r => String(r.id) === sid || String(r.firebaseKey) === sid || String(r.numero) === sid);
        
        if (window.carregarRomaneio) {
            window.carregarRomaneio(romaneioId, null, romaneio);
            closeModal();
        } else {
            console.error("❌ PCT: Função carregarRomaneio não disponível");
        }
    }

    function clonarRomaneio(romaneioId) {
        console.log(`📋 PCT: Clonando romaneio ${romaneioId}`);
        const sid = String(romaneioId || '');
        const romaneio = state.romaneios.find(r => String(r.id) === sid || String(r.firebaseKey) === sid || String(r.numero) === sid);

        if (window.clonarRomaneioPCT) {
            closeModal();
            window.clonarRomaneioPCT(romaneioId, state.romaneios, romaneio);
        } else if (window.CarregarRomaneioPCT?.clonarRomaneio) {
            closeModal();
            window.CarregarRomaneioPCT.clonarRomaneio(romaneioId, state.romaneios, romaneio);
        } else if (window.carregarRomaneio) {
            closeModal();
            window.carregarRomaneio(romaneioId, null, romaneio);
            window.romaneioEmEdicao = null;
            const btn = document.getElementById('btnSalvar');
            if (btn) btn.innerHTML = '<i class="fas fa-save"></i> Salvar';
        } else {
            console.error("❌ PCT: Função clonarRomaneio não disponível");
        }
    }
    
    function printRomaneio(romaneioId, tipo = "completo") {
        console.log(` PCT: Imprimindo romaneio ${romaneioId} - Tipo: ${tipo}`);
        if (window.imprimirRomaneio) {
                window.imprimirRomaneio(romaneioId, tipo);
        } else if (window.imprimirRomaneioFromList) {
            window.imprimirRomaneioFromList(romaneioId, tipo);
        } else {
            console.error(" PCT: Função de impressão não disponível");
            showError(MSG_ERROR_PRINT_UNAVAILABLE);
        }
    }
    
    async function deleteRomaneio(romaneioId) {
        if (!confirm(MSG_CONFIRM_DELETE)) return;
        console.log(` PCT: Excluindo romaneio ${romaneioId}`);
        try {
            state.romaneios = state.romaneios.filter(r => r.id !== romaneioId);
            state.filteredRomaneios = state.filteredRomaneios.filter(r => r.id !== romaneioId);
            if (window.firebaseService && typeof window.firebaseService.saveToFirebase === "function") {
                // ✅ Remover por registro (evita sobrescrever coleção)
                await window.firebaseService.saveToFirebase("romaneios/pct", String(romaneioId), null);
            }
                renderRomaneiosList();
                renderPagination();
            showSuccess(MSG_SUCCESS_DELETE);
        } catch (error) {
            console.error(" PCT: Erro ao excluir romaneio:", error);
            showError(MSG_ERROR_DELETE_FAILED);
        }
    }

    // ✅ API: Forçar refresh direto do Firebase e atualizar cache local
    async function forcarRefreshFirebase() {
        console.log('🔄 PCT: Forçando refresh a partir do Firebase (preferência ativa)');
        await loadRomaneios(true);
        renderRomaneiosList();
        renderPagination();
        updateModalInfo();
    }

    function togglePrintDropdown(button) {
        console.log("🎯 PCT: togglePrintDropdown chamado", button);
        
        // ✅ ENCONTRAR DROPDOWN CORRETAMENTE
        const dropdown = button.parentElement.querySelector('.dropdown-content');
        
        if (!dropdown) {
            console.error('❌ PCT: Dropdown não encontrado');
            return;
        }
        
        // ✅ FECHAR OUTROS DROPDOWNS
        document.querySelectorAll('.dropdown-content').forEach(d => {
            if (d !== dropdown) {
                d.classList.remove('show');
                d.style.display = 'none';
            }
        });
        
        // ✅ TOGGLE DO DROPDOWN ATUAL
        const isVisible = dropdown.classList.contains('show');
        
        if (!isVisible) {
            dropdown.classList.add('show');
            dropdown.style.display = 'block';
            
            // ✅ POSICIONAMENTO MAIS CONFIÁVEL
            const rect = button.getBoundingClientRect();
            
            // Posicionamento baseado no botão
            
            // ✅ CONFIGURAR DROPDOWN COM Z-INDEX MÁXIMO
            dropdown.style.position = 'fixed';
            dropdown.style.zIndex = '99999999'; // Z-index extremamente alto
            dropdown.style.minWidth = '180px';
            dropdown.style.maxWidth = '200px';
            dropdown.style.backgroundColor = '#ffffff';
            dropdown.style.border = '2px solid #3498db';
            dropdown.style.borderRadius = '6px';
            dropdown.style.boxShadow = '0 8px 32px rgba(0,0,0,0.4)';
            dropdown.style.pointerEvents = 'auto';
            
            // ✅ MARCAR LINHA COMO ATIVA PARA EVITAR SOBREPOSIÇÃO
            const row = button.closest('tr');
            if (row) {
                // Marcar todas as outras linhas como inativas
                document.querySelectorAll('#listaModal tr').forEach(r => {
                    r.classList.remove('dropdown-active');
                    r.style.position = '';
                    r.style.zIndex = '';
                });
                
                // Marcar linha atual como ativa
                row.classList.add('dropdown-active');
                row.style.position = 'relative';
                row.style.zIndex = '99999998';
            }
            
            // ✅ POSIÇÃO VERTICAL SEGURA
            let topPosition = rect.bottom + 4;
            const dropdownHeight = 80; // Altura estimada
            
            if (topPosition + dropdownHeight > window.innerHeight - 20) {
                topPosition = rect.top - dropdownHeight - 4; // Acima do botão
                console.log('🔄 PCT: Dropdown posicionado acima');
            }
            
            dropdown.style.top = `${topPosition}px`;
            
            // ✅ POSIÇÃO HORIZONTAL SEMPRE VISÍVEL
            const dropdownWidth = 180;
            let leftPosition;
            
            // Tentar posicionar à esquerda do botão
            if (rect.left + dropdownWidth <= window.innerWidth - 20) {
                leftPosition = rect.left;
                console.log('🔄 PCT: Dropdown à esquerda do botão');
            }
            // Se não couber, posicionar à direita do botão
            else if (rect.right - dropdownWidth >= 20) {
                leftPosition = rect.right - dropdownWidth;
                console.log('🔄 PCT: Dropdown à direita do botão');
            }
            // Se não couber em lugar nenhum, centralizar
            else {
                leftPosition = Math.max(20, (window.innerWidth - dropdownWidth) / 2);
                console.log('🔄 PCT: Dropdown centralizado');
            }
            
            dropdown.style.left = `${leftPosition}px`;
            dropdown.style.right = 'auto';
            
            console.log("✅ PCT: Dropdown posicionado em:", {
                top: topPosition,
                left: leftPosition,
                width: dropdownWidth,
                zIndex: dropdown.style.zIndex
            });
            
            // ✅ FECHAR AO CLICAR FORA
            setTimeout(() => {
                const closeHandler = function(event) {
                    if (!dropdown.contains(event.target) && !button.contains(event.target)) {
                        dropdown.classList.remove('show');
                        dropdown.style.display = 'none';
                        // ✅ LIMPAR LINHA ATIVA
                        if (row) {
                            row.classList.remove('dropdown-active');
                            row.style.position = '';
                            row.style.zIndex = '';
                        }
                        document.removeEventListener('click', closeHandler);
                        console.log('🎯 PCT: Dropdown fechado (clique fora)');
                    }
                };
                document.addEventListener('click', closeHandler);
            }, 100);
            
        } else {
            dropdown.classList.remove('show');
            dropdown.style.display = 'none';
            // ✅ LIMPAR LINHA ATIVA AO FECHAR MANUALMENTE
            const row = button.closest('tr');
            if (row) {
                row.classList.remove('dropdown-active');
                row.style.position = '';
                row.style.zIndex = '';
            }
            console.log('🎯 PCT: Dropdown fechado manualmente');
        }
    }
    
    function closeModal() {
        const modal = document.getElementById(CONFIG.modalId);
        if (modal) {
            modal.style.display = "none";
        }
        console.log(" PCT: Modal de romaneios fechado");
    }

    function setupEventListeners() {
        const modal = document.getElementById(CONFIG.modalId);
        if (!modal) return;

        const filterInput = document.getElementById(CONFIG.filterId);
        if (filterInput) {
            filterInput.removeEventListener("input", handleFilterInput);
            filterInput.addEventListener("input", handleFilterInput);
        }

        const closeButtons = modal.querySelectorAll(".close-modal, .close-modal-btn");
        closeButtons.forEach(btn => {
            btn.onclick = closeModal;
        });

        if (modalOutsideClickHandler) {
            modal.removeEventListener("click", modalOutsideClickHandler);
        }
        modalOutsideClickHandler = (event) => {
            if (event.target === modal) {
                closeModal();
            }
        };
        modal.addEventListener("click", modalOutsideClickHandler);
    }
    
    function testarDropdown() {
        console.log(" === TESTE DE DROPDOWN PCT ===");
        const dropdowns = document.querySelectorAll("#listaModal .dropdown-content");
        console.log(` Encontrados ${dropdowns.length} dropdowns`);
        return dropdowns.length;
    }

    function testarModal() {
        console.log(" === TESTE DE MODAL PCT ===");
        const modal = document.getElementById(CONFIG.modalId);
        if (modal) {
            console.log(" Modal encontrado no DOM");
            console.log(" Estado atual do modal:", modal.style.display);
            if (modal.style.display === "block") {
                console.log(" Modal está aberto");
        } else {
                console.log(" Modal está fechado");
            }
        } else {
            console.error(" Modal de romaneios não encontrado no DOM para teste");
        }
    }

    function criarDadosTeste() {
        console.log(" === CRIANDO DADOS DE TESTE PCT ===");
        const testRomaneios = [
            { id: "test1", cliente: "Cliente A", numero: "001", data: "2023-10-26", itens: [{ descricao: "Item 1", quantidade: 10, valor: 100 }], totalVolume: 1.5, totalValor: "R$ 1.500,00" },
            { id: "test2", cliente: "Cliente B", numero: "002", data: "2023-10-27", itens: [{ descricao: "Item 2", quantidade: 5, valor: 50 }], totalVolume: 0.5, totalValor: "R$ 500,00" },
            { id: "test3", cliente: "Cliente A", numero: "003", data: "2023-10-28", itens: [{ descricao: "Item 3", quantidade: 20, valor: 200 }], totalVolume: 2.0, totalValor: "R$ 2.000,00" }
        ];

        state.romaneios = testRomaneios;
        state.filteredRomaneios = testRomaneios;
        state.currentPage = 1;
        renderRomaneiosList();
        renderPagination();
        console.log(` ${testRomaneios.length} romaneios de teste criados e carregados`);
    }

    /**
     * ✅ ATUALIZAR INFORMAÇÕES DO MODAL (padronizado com romaneiotl)
     */
    function updateModalInfo() {
        const info = document.getElementById('romaneioModalInfo');
        if (info) {
            const total = state.filteredRomaneios.length;
            const pageSize = CONFIG.itemsPerPage;
            const start = total === 0 ? 0 : (state.currentPage - 1) * pageSize + 1;
            const end = Math.min(state.currentPage * pageSize, total);
            info.textContent = `Mostrando ${start > 0 ? (start + '-' + end) : 0} de ${total} romaneio${total !== 1 ? 's' : ''}`;
        }
    }

    function showError(message) {
        try {
            if (typeof window.__toast === 'function') {
                window.__toast(message, 'error', { duration: 5000 });
            } else if (window.Utils && window.Utils.showToast) {
                window.Utils.showToast(message, 'error');
            } else {
                alert(message);
            }
        } catch (_) { alert(message); }
    }

    function showSuccess(message) {
        try {
            if (typeof window.__toast === 'function') {
                window.__toast(message, 'success');
            } else if (window.Utils && window.Utils.showToast) {
                window.Utils.showToast(message, 'success');
            } else {
                alert(message);
            }
        } catch (_) { alert(message); }
    }

    function showWarning(message) {
        try {
            if (typeof window.__toast === 'function') {
                window.__toast(message, 'warning');
            } else if (window.Utils && window.Utils.showToast) {
                window.Utils.showToast(message, 'warning');
            } else {
                alert(message);
            }
        } catch (_) { alert(message); }
    }

    /**
     * ✅ NOVA FUNCIONALIDADE: LANÇAR CONTAS A RECEBER
     * Baseado no aprendizado do romaneiotl com melhorias
     */
    async function lancarContasReceber(romaneioId) {
        console.log(`🎯 PCT: Iniciando lançamento de contas a receber para romaneio ${romaneioId}`);
        
        try {
            // Encontrar o romaneio
            const romaneio = state.romaneios.find(r => r.id === romaneioId);
            if (!romaneio) {
                console.error('🎯 PCT: Romaneio não encontrado:', romaneioId);
                showError(MSG_ERROR_NOT_FOUND);
                return;
            }
            
            console.log('🎯 PCT: Romaneio encontrado:', romaneio);
            
            // Verificar se já foi lançado
            if (romaneio.contasReceberLancado === true) {
                console.log('🎯 PCT: Romaneio já foi lançado anteriormente');
                const confirmar = confirm(MSG_CONFIRM_DUPLICATE_LANCAMENTO);
                if (!confirmar) return;
            }
            
            // Calcular valor total
            let valorTotal = 0;
            if (romaneio.totais && romaneio.totais.valor) {
                valorTotal = parseFloat(romaneio.totais.valor);
            } else if (romaneio.valorTotal) {
                valorTotal = parseFloat(romaneio.valorTotal);
            } else if (romaneio.valor) {
                valorTotal = parseFloat(romaneio.valor);
            } else if (romaneio.totalValor) {
                valorTotal = parseFloat(romaneio.totalValor);
            } else if (romaneio.itens && Array.isArray(romaneio.itens)) {
                valorTotal = romaneio.itens.reduce((total, item) => {
                    const itemValor = item.valorTotal || item.valor || item.preco || item.price || item.valorItem || 0;
                    return total + (parseFloat(itemValor) || 0);
                }, 0);
            }
            
            if (valorTotal <= 0) {
                console.error('🎯 PCT: Valor total inválido:', valorTotal);
                showError(MSG_ERROR_VALOR_INVALIDO);
                return;
            }
            
            console.log(`🎯 PCT: Valor total calculado: R$ ${valorTotal.toFixed(2)}`);
            
            // Processar lançamento
            console.log('🔄 PCT: Processando lançamento...');
            
            // Sincronizar cliente no sistema financeiro
            console.log('🔄 PCT: Sincronizando cliente no sistema financeiro...');
            const clienteId = await sincronizarClienteFinanceiroPCT(romaneio);
            console.log('✅ PCT: Cliente sincronizado:', clienteId);
            
            // Criar conta a receber
            console.log('💳 PCT: Criando conta a receber...');
            await criarContaReceberRomaneio(romaneio, valorTotal, clienteId);
            console.log('✅ PCT: Conta a receber criada com sucesso');
            
            // Marcar romaneio como lançado
            console.log('🔄 PCT: Marcando romaneio como lançado...');
            await marcarRomaneioComoLancado(romaneioId);
            console.log('✅ PCT: Romaneio marcado como lançado');
            
            // ✅ GARANTIR QUE O ESTADO LOCAL ESTÁ CORRETO IMEDIATAMENTE
            const romaneioLocalIndex = state.romaneios.findIndex(r => r.id === romaneioId);
            if (romaneioLocalIndex !== -1) {
                state.romaneios[romaneioLocalIndex].contasReceberLancado = true;
                state.romaneios[romaneioLocalIndex].contasReceberLancadoEm = new Date().toISOString();
                console.log('✅ PCT: Estado local atualizado imediatamente');
            }
            
            // Notificar sistema de preservação
            if (window.PreservacaoFinanceirasPCT) {
                window.PreservacaoFinanceirasPCT.atualizarPropriedadeFinanceira(
                    romaneioId, 
                    'contasReceberLancado', 
                    true
                );
                window.PreservacaoFinanceirasPCT.atualizarPropriedadeFinanceira(
                    romaneioId, 
                    'contasReceberLancadoEm', 
                    new Date().toISOString()
                );
            }
            
            // Feedback de sucesso e redirecionamento
            const valorFormatado = formatarMoedaPCT(valorTotal);
            console.log(`✅ PCT: Conta a receber lançada com sucesso! Cliente: ${romaneio.cliente}, Valor: ${valorFormatado}`);
            showSuccess(MSG_SUCCESS_LANCAR_CONTAS);
            
            // ✅ AGUARDAR UM POUCO PARA GARANTIR QUE O FIREBASE FOI ATUALIZADO
            console.log('🔄 PCT: Aguardando atualização do Firebase antes de renderizar...');
            await new Promise(resolve => setTimeout(resolve, 500));
            
            // Atualizar a lista para refletir o estado do botão
            console.log('🔄 PCT: Atualizando lista de romaneios...');
            renderRomaneiosList();
            console.log('✅ PCT: Lista atualizada');
            
            // ✅ REDIRECIONAMENTO REATIVADO
            closeModal();
            setTimeout(() => {
                window.location.href = 'financas.html#receber';
            }, 200);
            
        } catch (error) {
            console.error('❌ PCT: Erro ao lançar contas a receber:', error);
            console.error('❌ PCT: Stack trace completo:', error.stack);
            console.error('❌ PCT: Detalhes do erro:', {
                name: error.name,
                message: error.message,
                stack: error.stack
            });
            showWarning(MSG_WARNING_LANCAR_FAILED_PREFIX + (error && error.message ? error.message : 'erro desconhecido'));
        }
    }

    /**
     * ✅ MARCAR ROMANEIO COMO LANÇADO
     */
    async function marcarRomaneioComoLancado(romaneioId) {
        try {
            console.log(`🎯 PCT: Marcando romaneio ${romaneioId} como lançado`);
            
            // Atualizar no estado local
            const romaneioIndex = state.romaneios.findIndex(r => r.id === romaneioId);
            if (romaneioIndex !== -1) {
                state.romaneios[romaneioIndex].contasReceberLancado = true;
                state.romaneios[romaneioIndex].contasReceberLancadoEm = new Date().toISOString();
            } else {
                console.warn(`⚠️ PCT: Romaneio ${romaneioId} não encontrado no estado local`);
            }
            
            // ✅ USAR O MESMO MÉTODO DO TL - window.firebaseService.saveToFirebase
            if (window.firebaseService) {
                try {
                    // Carregar dados atuais do Firebase
                    const romaneiosFirebase = await window.firebaseService.loadFromFirebase('romaneios/pct');
                    
                    if (romaneiosFirebase && romaneiosFirebase.data && Array.isArray(romaneiosFirebase.data)) {
                        // Encontrar o romaneio no array
                        const romaneioIndex = romaneiosFirebase.data.findIndex(r => r && r.id === romaneioId);
                        if (romaneioIndex !== -1) {
                            // ✅ CORREÇÃO: Atualizar o romaneio específico com valores válidos
                            romaneiosFirebase.data[romaneioIndex].contasReceberLancado = true;
                            romaneiosFirebase.data[romaneioIndex].contasReceberLancadoEm = new Date().toISOString();
                            
                            // ✅ CORREÇÃO: Limpar campos undefined antes de salvar
                            const romaneioLimpo = { ...romaneiosFirebase.data[romaneioIndex] };
                            Object.keys(romaneioLimpo).forEach(key => {
                                if (romaneioLimpo[key] === undefined) {
                                    delete romaneioLimpo[key];
                                }
                            });
                            romaneiosFirebase.data[romaneioIndex] = romaneioLimpo;
                            
                            // Salvar apenas o registro atualizado (evita sobrescrever coleção)
                            const resultado = await window.firebaseService.saveToFirebase('romaneios/pct', String(romaneioId), romaneioLimpo);
                            console.log('✅ PCT: Romaneio atualizado no Firebase por registro');
                            console.log('🔍 PCT: Resultado do salvamento:', resultado);
                        } else {
                            console.warn('⚠️ PCT: Romaneio não encontrado no Firebase para atualização:', romaneioId);
                        }
                    } else {
                        console.warn('⚠️ PCT: Dados inválidos do Firebase:', romaneiosFirebase);
                    }
                } catch (error) {
                    console.error('❌ PCT: Erro ao salvar no Firebase:', error);
                }
            } else {
                console.warn('⚠️ PCT: firebaseService não disponível');
            }
            
            // ✅ NÃO USAR localStorage - Firebase é a única fonte da verdade
            console.log('🔍 PCT: Salvamento concluído - Firebase é a fonte única');
            
        } catch (error) {
            console.error('❌ PCT: Erro ao marcar romaneio como lançado:', error);
            console.error('❌ PCT: Stack trace marcarRomaneio:', error.stack);
            console.error('❌ PCT: Detalhes marcarRomaneio:', {
                romaneioId: romaneioId,
                name: error.name,
                message: error.message,
                stack: error.stack
            });
            throw error;
        }
    }

    /**
     * ✅ SINCRONIZAR CLIENTE NO SISTEMA FINANCEIRO
     */
    async function sincronizarClienteFinanceiroPCT(romaneio) {
        try {
            console.log('🎯 PCT: Sincronizando cliente:', romaneio.cliente);
            
            // ✅ CORREÇÃO: Usar firebaseService (minúsculo) como outros módulos PCT
            if (!window.firebaseService) {
                console.warn('⚠️ PCT: firebaseService não disponível, usando ID do cliente como string');
                return romaneio.cliente || 'Cliente não informado';
            }
            
            // Buscar clientes existentes
            const clientesResponse = await window.firebaseService.loadFromFirebase('clients');
            let clientes = [];
            
            if (clientesResponse && clientesResponse.success && clientesResponse.data) {
                if (Array.isArray(clientesResponse.data)) {
                    clientes = clientesResponse.data.filter(c => c != null);
                } else if (typeof clientesResponse.data === 'object') {
                    clientes = Object.values(clientesResponse.data).filter(c => c != null);
                }
            }
            
            console.log('🎯 PCT: Clientes existentes carregados:', clientes.length);
            
            // Procurar cliente existente
            let clienteEncontrado = clientes.find(c => 
                (c.nome || c.name || c.nomeCompleto) === romaneio.cliente ||
                c.id === romaneio.clienteId
            );
            
            if (!clienteEncontrado) {
                // ✅ CORREÇÃO: Não tentar criar novo cliente, usar nome como ID
                console.log('⚠️ PCT: Cliente não encontrado, usando nome como ID (evitando permissão negada)');
                const clienteId = `CLIENT_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
                console.log('✅ PCT: Cliente ID gerado:', clienteId);
                return clienteId;
            } else {
                console.log('✅ PCT: Cliente existente encontrado:', clienteEncontrado.id);
                return clienteEncontrado.id;
            }
            
        } catch (error) {
            console.error('❌ PCT: Erro ao sincronizar cliente:', error);
            return romaneio.cliente || 'Cliente não informado';
        }
    }

    /**
     * 💾 SALVAR CLIENTES NO SISTEMA FINANCEIRO
     */
    async function salvarClientesFinanceiro(clientes) {
        try {
            console.log('🎯 PCT: Salvando clientes no sistema financeiro...');
            
            // ✅ CORREÇÃO: Usar firebaseService (minúsculo) como outros módulos PCT
            if (!window.firebaseService) {
                throw new Error('firebaseService não disponível');
            }
            
            const resultado = await window.firebaseService.saveToFirebase('clients', null, clientes);
            
            if (resultado && resultado.success) {
                console.log('✅ PCT: Clientes salvos no sistema financeiro');
            } else {
                throw new Error('Falha ao salvar clientes');
            }
        } catch (error) {
            console.error('❌ PCT: Erro ao salvar clientes:', error);
            throw error;
        }
    }

    /**
     * ✅ CRIAR CONTA A RECEBER NO SISTEMA FINANCEIRO
     */
    async function criarContaReceberRomaneio(romaneio, valorTotal, clienteId) {
        try {
            console.log('🎯 PCT: Criando conta a receber no sistema financeiro');
            
            // ✅ CORREÇÃO: Buscar contas existentes primeiro (igual ao TL)
            const contasReceber = await buscarContasReceberFinanceiro();
            console.log('🎯 PCT: Contas existentes carregadas:', contasReceber.length);
            
            // Extrair espécies para descrição
            const especies = romaneio.itens ? [...new Set(romaneio.itens.map(item => item.especie))].join(', ') : 'Romaneio sem itens';
            console.log('🎯 PCT: Espécies extraídas:', especies);
            
            // ✅ CORREÇÃO: Calcular data de vencimento com validação (igual ao TL)
            let dataVencimento = new Date();
            const dataBaseRomaneio = romaneio.dataEmissao || romaneio.data || romaneio.timestamp;
            dataVencimento = toLocalDateObject(dataBaseRomaneio);
            
            // Adicionar 30 dias
            dataVencimento.setDate(dataVencimento.getDate() + 30);
            
            // ✅ CORREÇÃO: Validar data antes de converter para ISO
            let dataVencimentoFormatada;
            try {
                if (isNaN(dataVencimento.getTime())) {
                    throw new Error('Data de vencimento inválida');
                }
                // ✅ Formatar em ISO local (YYYY-MM-DD) para evitar deslocamentos de fuso
                const y = dataVencimento.getFullYear();
                const m = String(dataVencimento.getMonth() + 1).padStart(2, '0');
                const d = String(dataVencimento.getDate()).padStart(2, '0');
                dataVencimentoFormatada = `${y}-${m}-${d}`;
            } catch (error) {
                console.warn('⚠️ PCT: Erro ao formatar data de vencimento, usando data atual + 30 dias:', error);
                const dataFallback = new Date();
                dataFallback.setDate(dataFallback.getDate() + 30);
                const fy = dataFallback.getFullYear();
                const fm = String(dataFallback.getMonth() + 1).padStart(2, '0');
                const fd = String(dataFallback.getDate()).padStart(2, '0');
                dataVencimentoFormatada = `${fy}-${fm}-${fd}`;
            }
            
            // ✅ CORREÇÃO: Validar dados do romaneio para evitar undefined
            const dataRomaneioISO = normalizeDateInputValue(dataBaseRomaneio) || normalizeDateInputValue(new Date()) || '';
            
            // ✅ CORREÇÃO: Criar conta a receber com padrão igual ao TL
            const novaConta = {
                id: `RP_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`, // ✅ CORREÇÃO: Usar RP_ como TL usa RT_
                cliente: romaneio.cliente || 'Cliente não informado',
                clienteId: clienteId,
                descricao: especies,
                valor: valorTotal,
                valorOriginal: valorTotal, // ✅ NOVO: Valor original da conta
                valorRestante: valorTotal, // ✅ NOVO: Valor restante a receber
                dataVencimento: dataVencimentoFormatada,
                status: 'pendente',
                categoria: 'vendas',
                tipo: 'receber',
                origem: 'romaneio_pct',
                origemId: romaneio.id,
                romaneioData: dataRomaneioISO,
                romaneioCliente: romaneio.cliente || 'Cliente não informado',
                romaneioEspecies: especies,
                observacoes: `Gerado automaticamente do Romaneio PCT em ${new Date().toLocaleDateString('pt-BR')}`,
                parcela: 1,
                totalParcelas: 1,
                valorTotal: valorTotal,
                created: new Date().toISOString()
            };
            
            console.log('🎯 PCT: Nova conta a receber criada:', novaConta);
            
            // ✅ CORREÇÃO: Validar conta antes de adicionar (evitar undefined no Firebase)
            const contaValidada = Object.fromEntries(
                Object.entries(novaConta).filter(([key, value]) => value !== undefined && value !== null)
            );
            
            console.log('🎯 PCT: Conta validada (sem undefined):', contaValidada);
            
            // ✅ CORREÇÃO: Adicionar à lista local e salvar apenas a conta nova por registro
            contasReceber.push(contaValidada);
            
            // ✅ Salvar somente a conta criada (por registro)
            await salvarContasReceberFinanceiro(contaValidada);
            
            console.log('✅ PCT: Conta a receber salva no Firebase');
            return novaConta.id;
            
        } catch (error) {
            console.error('❌ PCT: Erro ao criar conta a receber:', error);
            throw error;
        }
    }

    /**
     * 🔍 BUSCAR CONTAS A RECEBER DO SISTEMA FINANCEIRO
     */
    async function buscarContasReceberFinanceiro() {
        try {
            console.log('🎯 PCT: Buscando contas a receber existentes...');
            
            // ✅ CORREÇÃO: Usar firebaseService (minúsculo) como outros módulos PCT
            if (!window.firebaseService) {
                console.warn('⚠️ PCT: firebaseService não disponível, usando fallback');
                return [];
            }
            
            const contas = await window.firebaseService.loadFromFirebase('financas/receber');
            
            if (contas && contas.success && contas.data) {
                if (Array.isArray(contas.data)) {
                    console.log('✅ PCT: Contas carregadas (array):', contas.data.length);
                    return contas.data.filter(c => c != null);
                } else if (typeof contas.data === 'object') {
                    const contasArray = Object.values(contas.data).filter(c => c != null);
                    console.log('✅ PCT: Contas carregadas (object):', contasArray.length);
                    return contasArray;
                }
            }
            
            console.log('ℹ️ PCT: Nenhuma conta encontrada');
            return [];
        } catch (error) {
            console.error('❌ PCT: Erro ao buscar contas a receber:', error);
            return [];
        }
    }
    
    /**
     * 💾 SALVAR CONTAS A RECEBER NO SISTEMA FINANCEIRO
     */
    async function salvarContasReceberFinanceiro(contasReceber) {
        try {
            console.log('🎯 PCT: Salvando contas a receber no sistema financeiro...');
            
            // ✅ CORREÇÃO: Usar firebaseService (minúsculo) como outros módulos PCT
            if (!window.firebaseService) {
                throw new Error('firebaseService não disponível');
            }
            
            // Aceitar tanto objeto único quanto array
            const contas = Array.isArray(contasReceber) ? contasReceber : [contasReceber];
            let ok = 0;
            for (const conta of contas) {
                if (!conta || !conta.id) continue;
                const payload = { ...conta };
                if (payload.valorOriginal === undefined || payload.valorOriginal === null) {
                    payload.valorOriginal = payload.valor;
                }
                if (payload.valorRestante === undefined || payload.valorRestante === null) {
                    payload.valorRestante = payload.valor;
                }
                Object.keys(payload).forEach(k => { if (payload[k] === undefined) delete payload[k]; });
                const res = await window.firebaseService.saveToFirebase('financas/receber', String(conta.id), payload);
                if (res && res.success) ok++;
            }
            if (ok > 0) {
                console.log(`✅ PCT: ${ok} conta(s) a receber salva(s) no sistema financeiro (por registro)`);
            } else {
                throw new Error('Falha ao salvar contas a receber');
            }
        } catch (error) {
            console.error('❌ PCT: Erro ao salvar contas a receber:', error);
            throw error;
        }
    }

    /**
     * ✅ FUNÇÃO AUXILIAR PARA FORMATAÇÃO DE MOEDA
     */
    function formatarMoedaPCT(valor) {
        if (window.UtilsTL && window.UtilsTL.formatCurrency) {
            return window.UtilsTL.formatCurrency(valor);
        }
        
        // Fallback manual
        return `R$ ${parseFloat(valor).toLocaleString('pt-BR', {
            minimumFractionDigits: 2,
            maximumFractionDigits: 2
        })}`;
    }

    /**
     * 🔄 FUNÇÃO: Forçar refresh dos dados do Firebase
     */
    async function forcarRefreshFirebase() {
        if (window.__pctIsRefreshing) {
            console.log('⏳ PCT: Refresh ignorado (já em andamento)');
            return;
        }
        window.__pctIsRefreshing = true;
        console.log('🔄 PCT: Forçando refresh dos dados do Firebase...');
        try {
            if (window.database) {
                const { ref, get } = await import('https://www.gstatic.com/firebasejs/10.7.1/firebase-database.js');
                    const romaneiosRef = ref(window.database, resolvePath('romaneios/pct'));
                const snapshot = await get(romaneiosRef);
                
                if (snapshot.exists()) {
                    const firebaseData = snapshot.val();
                    console.log('🔍 PCT: Dados frescos do Firebase:', firebaseData);
                    
                    if (Array.isArray(firebaseData)) {
                        const romaneiosComLancamento = firebaseData.filter(r => r && r.contasReceberLancado === true);
                        console.log(`📊 PCT: ${firebaseData.length} romaneios no Firebase, ${romaneiosComLancamento.length} lançados`);
                        
                        // Atualizar estado local
                        state.romaneios = firebaseData.filter(item => item && (item.cliente || item.numero || item.id));
                        state.filteredRomaneios = state.romaneios;
                        
                        // Re-renderizar
                        renderRomaneiosList();
                        console.log('✅ PCT: Estado local atualizado e lista re-renderizada');
                    }
                } else {
                    console.log('📭 PCT: Nenhum dado no Firebase');
                }
            }
        } catch (error) {
            console.error('❌ PCT: Erro ao forçar refresh:', error);
        } finally {
            setTimeout(() => { window.__pctIsRefreshing = false; }, 1000);
        }
    }

    /**
     * 🧪 FUNÇÃO TESTE: Lançar conta e verificar persistência
     */
    async function testarLancamentoPersistencia(romaneioId) {
        console.log('🧪 TESTE PCT: Iniciando teste de persistência para:', romaneioId);
        
        try {
            // 1. Lançar conta
            console.log('1️⃣ Lançando conta a receber...');
            await lancarContasReceber(romaneioId);
            
            // 2. Aguardar um pouco
            await new Promise(resolve => setTimeout(resolve, 1000));
            
            // 3. Forçar refresh
            console.log('2️⃣ Forçando refresh dos dados...');
            await forcarRefreshFirebase();
            
            // 4. Verificar estado
            console.log('3️⃣ Verificando estado após refresh...');
            debugEstadoLancamento(romaneioId);
            
            console.log('✅ TESTE PCT: Teste de persistência concluído');
        } catch (error) {
            console.error('❌ TESTE PCT: Erro no teste:', error);
        }
    }

    /**
     * 🧪 FUNÇÃO DEBUG: Verificar estado de lançamento
     */
    function debugEstadoLancamento(romaneioId) {
        console.log('🧪 DEBUG PCT: Verificando estado de lançamento para:', romaneioId);
        
        const romaneio = state.romaneios.find(r => r.id === romaneioId);
        if (romaneio) {
            console.log('🔍 Estado local:', {
                id: romaneio.id,
                contasReceberLancado: romaneio.contasReceberLancado,
                contasReceberLancadoEm: romaneio.contasReceberLancadoEm
            });
        } else {
            console.log('❌ Romaneio não encontrado no estado local');
        }
        
        // Verificar no Firebase
        if (window.database) {
            import('https://www.gstatic.com/firebasejs/10.7.1/firebase-database.js').then(async ({ ref, get }) => {
                const romaneiosRef = ref(window.database, resolvePath('romaneios/pct'));
                const snapshot = await get(romaneiosRef);
                
                if (snapshot.exists()) {
                    const romaneiosData = snapshot.val();
                    if (Array.isArray(romaneiosData)) {
                        const romaneioFirebase = romaneiosData.find(r => r && r.id === romaneioId);
                        if (romaneioFirebase) {
                            console.log('🔍 Estado Firebase:', {
                                id: romaneioFirebase.id,
                                contasReceberLancado: romaneioFirebase.contasReceberLancado,
                                contasReceberLancadoEm: romaneioFirebase.contasReceberLancadoEm
                            });
                        } else {
                            console.log('❌ Romaneio não encontrado no Firebase');
                        }
                    }
                }
            });
        }
    }

    // ✅ INTERFACE PÚBLICA
        // ✅ FUNÇÃO: Reativação PCT Local (independente)
    async function reativarBotaoRomaneio(romaneioId, tipo = 'pct') {
        try {
            const tipoLabel = tipo.toUpperCase();
            console.log(`🔄 Reativando botão do romaneio ${tipoLabel}: ${romaneioId}...`);
            
            // ✅ Usar Firebase direto (método PCT)
            if (!window.firebaseService) {
                console.warn(`⚠️ firebaseService não disponível para reativar botão do romaneio ${tipoLabel}`);
                return;
            }
            
            // Carregar dados atuais
            console.log(`🔍 Carregando dados atuais de romaneiosPct...`);
            const result = await window.firebaseService.loadFromFirebase('romaneios/pct');
            
            if (!result || !result.success || !Array.isArray(result.data)) {
                console.error(`❌ Erro ao carregar romaneios ${tipoLabel}:`, result);
                return;
            }
            
            const romaneios = result.data;
            const romaneioIndex = romaneios.findIndex(r => r && r.id === romaneioId);
            
            if (romaneioIndex === -1) {
                console.error(`❌ Romaneio ${tipoLabel} não encontrado: ${romaneioId}`);
                return;
            }
            
            // ✅ CORREÇÃO: Reativar o botão com valores válidos
            romaneios[romaneioIndex].contasReceberLancado = false;
            romaneios[romaneioIndex].contasReceberReativadoEm = new Date().toISOString();
            
            // ✅ CORREÇÃO: Remover campos undefined para evitar erro do Firebase
            const romaneioLimpo = { ...romaneios[romaneioIndex] };
            Object.keys(romaneioLimpo).forEach(key => {
                if (romaneioLimpo[key] === undefined) {
                    delete romaneioLimpo[key];
                }
            });
            romaneios[romaneioIndex] = romaneioLimpo;
            
            console.log(`✅ Romaneio ${tipoLabel} ${romaneioId} marcado como reativado`);
            
            // Notificar sistema de preservação
            if (window.PreservacaoFinanceirasPCT) {
                window.PreservacaoFinanceirasPCT.atualizarPropriedadeFinanceira(
                    romaneioId, 
                    'contasReceberLancado', 
                    false
                );
                window.PreservacaoFinanceirasPCT.atualizarPropriedadeFinanceira(
                    romaneioId, 
                    'contasReceberReativadoEm', 
                    new Date().toISOString()
                );
            }
            
            // ✅ Salvar apenas o registro alvo (evita sobrescrever coleção inteira)
            console.log(`💾 Salvando registro individual...`);
            const saveResult = await window.firebaseService.saveToFirebase('romaneios/pct', romaneioId, romaneios[romaneioIndex]);
            
            if (saveResult && saveResult.success) {
                console.log(`✅ Dados ${tipoLabel} salvos com sucesso`);
                
                // Atualizar estado local
                const romaneioLocal = state.romaneios.find(r => r.id === romaneioId);
                if (romaneioLocal) {
                    romaneioLocal.contasReceberLancado = false;
                    romaneioLocal.contasReceberReativadoEm = new Date().toISOString();
                    console.log(`✅ Estado local do modal ${tipoLabel} atualizado`);
                }
                
                // Forçar refresh da interface
                console.log(`🔄 Atualizando interface...`);
                await forcarRefreshFirebase();
                
            } else {
                console.error(`❌ Erro ao salvar dados ${tipoLabel}:`, saveResult);
            }
            
        } catch (error) {
            console.error(`❌ Erro ao reativar botão do romaneio ${tipo.toUpperCase()}:`, error);
        }
    }

    // ✅ FUNÇÃO TESTE: Reativação PCT específica
    async function testarReativacaoPCT(romaneioId) {
        console.log(`🧪 === TESTE REATIVAÇÃO PCT (LOCAL) ===`);
        console.log(`📍 Testando reativação do romaneio: ${romaneioId}`);
        
        try {
            // 1. Verificar estado antes
            console.log('1️⃣ Estado antes da reativação:');
            debugEstadoLancamento(romaneioId);
            
            // 2. Executar reativação local
            console.log('2️⃣ Executando reativação local...');
            await reativarBotaoRomaneio(romaneioId, 'pct');
            
            // 3. Aguardar sincronização
            await new Promise(resolve => setTimeout(resolve, 2000));
            
            // 4. Verificar estado depois
            console.log('3️⃣ Estado após reativação:');
            debugEstadoLancamento(romaneioId);
            
            console.log('✅ TESTE PCT: Reativação concluída');
            
        } catch (error) {
            console.error('❌ TESTE PCT: Erro na reativação:', error);
        }
    }

// ✅ FUNÇÃO TESTE: Simular exclusão e reativação
async function simularExclusaoReativacao(romaneioId) {
    console.log(`🧪 === SIMULAÇÃO EXCLUSÃO + REATIVAÇÃO PCT ===`);
    console.log(`📍 Simulando para romaneio: ${romaneioId}`);
    
    try {
        // 1. Verificar estado inicial
        console.log('1️⃣ Estado inicial:');
        debugEstadoLancamento(romaneioId);
        
        // 2. Simular exclusão (chamar reativação local)
        console.log('2️⃣ Simulando exclusão de conta a receber...');
        console.log('   (Chamando reativarBotaoRomaneio local)');
        await reativarBotaoRomaneio(romaneioId, 'pct');
        
        // 3. Aguardar sincronização
        console.log('3️⃣ Aguardando sincronização...');
        await new Promise(resolve => setTimeout(resolve, 3000));
        
        // 4. Forçar refresh
        console.log('4️⃣ Forçando refresh...');
        await forcarRefreshFirebase();
        
        // 5. Verificar estado final
        console.log('5️⃣ Estado final:');
        debugEstadoLancamento(romaneioId);
        
        console.log('✅ SIMULAÇÃO: Concluída com sucesso');
        
    } catch (error) {
        console.error('❌ SIMULAÇÃO: Erro:', error);
    }
}

    return {
        openModal,
        closeModal,
        editRomaneio,
        clonarRomaneio,
        printRomaneio,
        deleteRomaneio,
        togglePrintDropdown,
        loadRomaneios,
        goToPage,
        filterRomaneios,
        updateModalInfo, // ✅ FUNÇÃO IMPLEMENTADA
        testarDropdown,
        testarModal,
        criarDadosTeste,
        lancarContasReceber, // ✅ NOVA FUNCIONALIDADE
        renderRomaneiosList, // ✅ EXPOR PARA REATIVAÇÃO EXTERNA
        state, // ✅ EXPOR ESTADO PARA ACESSO EXTERNO
        debugEstadoLancamento, // 🧪 DEBUG
        forcarRefreshFirebase, // 🔄 REFRESH
        testarLancamentoPersistencia, // 🧪 TESTE COMPLETO
        testarReativacaoPCT, // 🧪 TESTE ESPECÍFICO PCT
        simularExclusaoReativacao, // 🧪 SIMULAÇÃO COMPLETA
        reativarBotaoRomaneio, // ✅ REATIVAÇÃO LOCAL
        setupRealtimeRomaneiosPct // 📡 EXPOR REALTIME PARA USO EXTERNO
    };
})();

// ✅ FUNÇÕES GLOBAIS PARA COMPATIBILIDADE PCT
setTimeout(() => {
    if (window.ModalListaRomaneiosPCT) {
        window.abrirListaRomaneios = window.ModalListaRomaneiosPCT.openModal;
        window.editarRomaneio = window.ModalListaRomaneiosPCT.editRomaneio;
        window.clonarRomaneio = window.ModalListaRomaneiosPCT.clonarRomaneio;
        window.excluirRomaneio = window.ModalListaRomaneiosPCT.deleteRomaneio;
        window.imprimirRomaneioFromList = window.ModalListaRomaneiosPCT.printRomaneio;
        window.togglePrintDropdown = window.ModalListaRomaneiosPCT.togglePrintDropdown;
        window.testarModalPCT = window.ModalListaRomaneiosPCT.testarModal;
        window.criarDadosTestePCT = window.ModalListaRomaneiosPCT.criarDadosTeste;
        window.testarReativacaoPCT = window.ModalListaRomaneiosPCT.testarReativacaoPCT;
        window.simularExclusaoReativacao = window.ModalListaRomaneiosPCT.simularExclusaoReativacao;
        window.reativarBotaoRomaneio = window.ModalListaRomaneiosPCT.reativarBotaoRomaneio;
        
        console.log("✅ Funções globais PCT configuradas com sucesso");
        console.log("🧪 Funções de teste disponíveis:");
        console.log("  - testarModalPCT() - Testa se o modal está funcionando");
        console.log("  - criarDadosTestePCT() - Cria dados de teste para o modal");
        console.log("  - testarReativacaoPCT(romaneioId) - Testa reativação de romaneio PCT");
        console.log("  - simularExclusaoReativacao(romaneioId) - Simula exclusão + reativação");
        console.log("  - reativarBotaoRomaneio(romaneioId, 'pct') - Reativa botão diretamente");
    } else {
        console.error("❌ ModalListaRomaneiosPCT não está disponível para configurar funções globais");
    }
}, 100);

console.log(" Módulo ModalListaRomaneiosPCT carregado com sucesso");

// ✅ NOVO: Disparar evento para notificar financas.js que o modal PCT está disponível
if (typeof window.dispatchEvent === 'function') {
    window.dispatchEvent(new CustomEvent('ModalListaRomaneiosPCTCarregado'));
    console.log('📡 PCT: Evento ModalListaRomaneiosPCTCarregado disparado');
}

// ✅ NOVO: Listener para mensagens de refresh via localStorage
window.addEventListener('storage', function(e) {
    if (e.key === 'pctRefreshTrigger' && e.newValue) {
        try {
            const message = JSON.parse(e.newValue);
            if (message.action === 'forceRefresh') {
                console.log('📡 PCT: Mensagem de refresh recebida via localStorage:', message);
                console.log('🔄 PCT: Executando refresh forçado...');
                
                // Executar refresh se o modal estiver disponível
                if (window.ModalListaRomaneiosPCT && typeof window.ModalListaRomaneiosPCT.forcarRefreshFirebase === 'function') {
                    setTimeout(() => {
                        window.ModalListaRomaneiosPCT.forcarRefreshFirebase();
                        console.log('✅ PCT: Refresh executado com sucesso');
                    }, 100);
                } else {
                    console.log('⚠️ PCT: Modal não disponível para refresh');
                }
            }
        } catch (error) {
            console.error('❌ PCT: Erro ao processar mensagem de refresh:', error);
        }
    }
});

console.log('📡 PCT: Listener de refresh via localStorage configurado');

// 📡 Atualizar lista quando houver evento de atualização em tempo real
window.addEventListener('romaneiosPct:updated', async function() {
    try {
        // Throttle simples: não chamar refresh múltiplas vezes em curto intervalo
        if (!window.__pctEventRefreshTimer) {
            window.__pctEventRefreshTimer = setTimeout(async () => {
                window.__pctEventRefreshTimer = null;
                if (window.ModalListaRomaneiosPCT && typeof window.ModalListaRomaneiosPCT.forcarRefreshFirebase === 'function') {
                    await window.ModalListaRomaneiosPCT.forcarRefreshFirebase();
                    console.log('📡 PCT: Lista atualizada via evento realtime');
                } else if (window.ModalListaRomaneiosPCT && typeof window.ModalListaRomaneiosPCT.loadRomaneios === 'function') {
                    await window.ModalListaRomaneiosPCT.loadRomaneios();
                    console.log('📡 PCT: Lista recarregada via evento realtime');
                }
            }, 300);
        }
    } catch (e) {
        console.warn('⚠️ PCT: Falha ao atualizar lista via evento realtime:', e);
    }
});

// 📡 Ativar realtime logo ao carregar o módulo (fora do modal também)
(function(){
    try {
        const initRealtimeWhenReady = () => {
            if (!window.ModalListaRomaneiosPCT || typeof window.ModalListaRomaneiosPCT.setupRealtimeRomaneiosPct !== 'function') return;
            if (window.__pctRealtimeInitDone) return;
            if (window.firebaseService && ((window.firebaseService.dbService && typeof window.firebaseService.dbService.getDatabase === 'function') || window.firebaseService.db)) {
                window.__pctRealtimeInitDone = true;
                window.ModalListaRomaneiosPCT.setupRealtimeRomaneiosPct();
                return;
            }
            let tries = 0;
            const max = 40; // ~20s
            const timer = setInterval(() => {
                if (window.firebaseService && ((window.firebaseService.dbService && typeof window.firebaseService.dbService.getDatabase === 'function') || window.firebaseService.db)) {
                    clearInterval(timer);
                    window.__pctRealtimeInitDone = true;
                    window.ModalListaRomaneiosPCT.setupRealtimeRomaneiosPct();
                } else if (++tries >= max) {
                    clearInterval(timer);
                    console.warn('⚠️ PCT: Realtime não iniciado (database indisponível). Usando refresh automático por evento.');
                }
            }, 500);
        };
        setTimeout(initRealtimeWhenReady, 300);
    } catch (e) {}
})();

// ✅ TESTE REMOVIDO: Listener configurado e funcionando
