/**
 * 📊 MÓDULO: Dashboard Core - Sistema Principal
 * 
 * Responsabilidades:
 * - Gerenciar estado geral do dashboard
 * - Integração com Firebase
 * - Coordenação entre widgets
 * - Sistema de cache
 * 
 * ✅ ESTRUTURA MODULAR: Seguindo padrões do RomaneioTL
 * ✅ FIREBASE PRIORITY: Firebase primeiro, localStorage como fallback
 */

window.DashboardCore = (function() {
    'use strict';

    // ⚡ CONFIGURAÇÕES ULTRA PERFORMANCE COM HYBRID SYNC
    const CONFIG = {
        refreshInterval: 300000, // 5 minutos (muito mais longo pois temos cache inteligente)
        cacheTimeout: 15 * 60 * 1000, // 15 minutos (cache ainda mais longo)
        apiTimeout: 6000, // 6 segundos (timeout mais rápido)
        debugMode: window.__DEBUG_MODE__ === true, // ✅ CORREÇÃO: Desabilitar logs excessivos via flag global
        maxRetries: 2, // Máximo de tentativas para APIs
        loadDelay: 0, // Sem delay - carregamento instantâneo
        useHybridSync: false, // Desabilitado para evitar vazamento entre tenants via cache local
        instantLoad: true, // Priorizar carregamento instantâneo
        enableExternalFxApi: false
    };

    function getLocalStorageKeys(key) {
        const keys = [];
        try {
            const base = String(key || '');
            if (!base) return keys;
            const svc = window.firebaseServiceTL || window.firebaseService || window.FirebaseService;
            if (svc && typeof svc.getNamespacedPath === 'function') {
                const ns = svc.getNamespacedPath(base);
                if (ns && ns !== base) {
                    keys.push(ns);
                    return [...new Set(keys)];
                }
            } else {
                const rawTenant = window.appTenantId || (window.companyInfo && (window.companyInfo.id || window.companyInfo.companyId || window.companyInfo.slug || window.companyInfo.nome || window.companyInfo.name));
                const tenant = rawTenant ? String(rawTenant) : null;
                if (tenant && !/^companies\//.test(base) && !/^users\//.test(base)) {
                    keys.push(`companies/${tenant}/${base}`);
                    return [...new Set(keys)];
                }
            }
        } catch (_) {}
        return [...new Set(keys)];
    }

    function readLocalStorage(key) {
        for (const k of getLocalStorageKeys(key)) {
            const val = localStorage.getItem(k);
            if (val) return val;
        }
        return null;
    }

    // ✅ ESTADO DO DASHBOARD
    let state = {
        isLoading: false,
        lastUpdate: null,
        loadToken: 0,
        currentTenant: null,
        data: {
            romaneios: { tl: [], pct: [], pes: [] },
            clients: [],
            species: [],
            preromaneios: [], // Renomeado de orcamentos
            folha: { funcionarios: [], lancamentos: [] },
            dollarRate: null
        },
        cache: new Map(),
        refreshTimer: null
    };

    function isNonEmptyData(data) {
        if (!data) return false;
        if (Array.isArray(data)) return data.length > 0;
        if (typeof data === 'object') return Object.keys(data).length > 0;
        return false;
    }

    function normalizeList(data) {
        if (!data) return [];
        if (Array.isArray(data)) return data;
        if (typeof data === 'object') return Object.values(data);
        return [];
    }

    function normalizeContasPayload(payload) {
        if (!payload) return [];
        if (Array.isArray(payload)) return payload.filter(Boolean);
        if (typeof payload !== 'object') return [];
        const keys = Object.keys(payload);
        const monthLike = keys.some(k => /^\d{4}-\d{2}$/.test(k));
        const out = [];
        if (monthLike) {
            keys.forEach(k => {
                const v = payload[k];
                if (Array.isArray(v)) out.push(...v);
                else if (v && typeof v === 'object') out.push(...Object.values(v));
            });
        } else {
            out.push(...Object.values(payload));
        }
        return out.filter(Boolean);
    }

    function dedupeById(list) {
        const map = new Map();
        const noId = [];
        (Array.isArray(list) ? list : []).forEach(item => {
            if (!item) return;
            const id = item.id || item.key || item._id;
            if (id == null || id === '') {
                noId.push(item);
            } else {
                map.set(String(id), item);
            }
        });
        return [...map.values(), ...noId];
    }

    function monthKeyFromDate(dt) {
        try { return new Date(dt).toISOString().slice(0,7); } catch (_) { return new Date().toISOString().slice(0,7); }
    }

    function resolveActiveTenant() {
        try {
            const svc = window.firebaseServiceTL || window.firebaseService || window.FirebaseService;
            if (svc && typeof svc.getTenantId === 'function') {
                const t = svc.getTenantId();
                if (t) return String(t);
            }
            if (svc && typeof svc.getCurrentTenantId === 'function') {
                const t = svc.getCurrentTenantId();
                if (t) return String(t);
            }
            if (window.appTenantId) return String(window.appTenantId);
            const raw = localStorage.getItem('company_info');
            if (raw) {
                const obj = JSON.parse(raw);
                const id = obj && (obj.companyId || obj.companyID || obj.tenantId || obj.id);
                if (id) return String(id);
            }
        } catch (_) {}
        return null;
    }

    function buildMonthRange(centerMonth, pastCount, futureCount) {
        const out = [];
        const base = new Date(`${centerMonth}-01T00:00:00`);
        for (let i = -pastCount; i <= futureCount; i++) {
            const d = new Date(base.getFullYear(), base.getMonth() + i, 1);
            out.push(monthKeyFromDate(d));
        }
        return out;
    }

    async function waitForTenantContext(timeoutMs = 2500) {
        const initial = resolveActiveTenant();
        if (initial) return initial;
        return await new Promise((resolve) => {
            let finished = false;
            const done = (value) => {
                if (finished) return;
                finished = true;
                try { window.removeEventListener('tenantContextReady', onTenantReady); } catch (_) {}
                try { window.removeEventListener('firebaseReady', onFirebaseReady); } catch (_) {}
                resolve(value || null);
            };
            const onTenantReady = () => done(resolveActiveTenant());
            const onFirebaseReady = () => done(resolveActiveTenant());
            try { window.addEventListener('tenantContextReady', onTenantReady); } catch (_) {}
            try { window.addEventListener('firebaseReady', onFirebaseReady); } catch (_) {}
            setTimeout(() => done(resolveActiveTenant()), Math.max(0, Number(timeoutMs) || 0));
        });
    }

    /**
     * ✅ INICIALIZAR DASHBOARD
     */
    async function init() {
        console.log('📊 Inicializando Dashboard Core...');
        
        try {
            // Verificar dependências
            if (!window.FirebaseService) {
                console.warn('⚠️ FirebaseService não disponível, usando localStorage');
            }

            // Configurar listeners
            setupEventListeners();
            
            // ✅ AGUARDAR SISTEMA DE FOLHA CARREGAR PRIMEIRO
            await waitForFolhaSystem();

            // Carregar dados iniciais
            await loadAllData();
            
            // Configurar refresh automático
            setupAutoRefresh();
            
            // ✅ CONFIGURAR LISTENER PARA ATUALIZAÇÕES DA FOLHA
            setupFolhaDataListener();
            
            console.log('✅ Dashboard Core inicializado com sucesso');
            return true;
            
        } catch (error) {
            console.error('❌ Erro ao inicializar Dashboard Core:', error);
            return false;
        }
    }

    /**
     * ✅ CARREGAR TODOS OS DADOS
     */
    async function loadAllData() {
        if (CONFIG.debugMode) console.log('📂 Carregando dados do dashboard...');
        
        state.isLoading = true;
        updateLoadingState();
        
        try {
            await waitForTenantContext(3000);
            const activeTenant = resolveActiveTenant();
            const svc = window.firebaseServiceTL || window.firebaseService || window.FirebaseService;
            if (!activeTenant) {
                try {
                    if (svc && typeof svc.setTenantId === 'function') svc.setTenantId(null);
                    window.appTenantId = null;
                } catch (_) {}
                state.currentTenant = null;
                state.data.romaneios = { tl: [], pct: [], pes: [] };
                state.data.clients = [];
                state.data.preromaneios = [];
                state.data.folha = { funcionarios: [], lancamentos: [] };
                state.data.contasPagar = [];
                state.data.contasReceber = [];
                state.data.financeSnapshot = null;
                state.lastUpdate = new Date();
                notifyWidgets('dataLoaded', state.data);
                return;
            }
            if (state.currentTenant && state.currentTenant !== String(activeTenant)) {
                state.data.romaneios = { tl: [], pct: [], pes: [] };
                state.data.clients = [];
                state.data.preromaneios = [];
                state.data.folha = { funcionarios: [], lancamentos: [] };
                state.data.contasPagar = [];
                state.data.contasReceber = [];
                state.data.financeSnapshot = null;
                notifyWidgets('dataLoaded', state.data);
            }
            state.currentTenant = String(activeTenant);
            try {
                if (svc && typeof svc.setTenantId === 'function') svc.setTenantId(activeTenant);
                window.appTenantId = String(activeTenant);
            } catch (_) {}
            // ⚡ CARREGAMENTO INSTANTÂNEO COM HYBRID SYNC
            if (CONFIG.useHybridSync && window.hybridSync) {
                // Carregamento instantâneo de TODOS os dados em paralelo
                const currentMonth = new Date().toISOString().slice(0,7);
                const monthKeys = buildMonthRange(currentMonth, 5, 1);
                const loadToken = ++state.loadToken;
                const dollarPromise = loadDollarRate();
                const [romaneiosData, clientsData, preromaneiosData, folhaData, contasData, financeSnapshot] = await Promise.all([
                    loadRomaneiosDataHybrid(),
                    loadClientsDataHybrid(),
                    loadPreRomaneiosDataHybrid(),
                    loadFolhaDataHybrid(),
                    loadContasFinanceirasHybrid({ mode: 'fast', monthKeys, source: 'firebase' }),
                    loadFinanceSnapshot(currentMonth)
                ]);
                
                // Dados carregados instantaneamente do cache
                state.data.romaneios = romaneiosData;
                state.data.clients = clientsData;
                state.data.preromaneios = preromaneiosData;
                state.data.folha = folhaData;
                state.data.contasPagar = contasData.pagar;
                state.data.contasReceber = contasData.receber;
                state.data.financeSnapshot = financeSnapshot || null;
                await dollarPromise;
                if (loadToken === state.loadToken) {
                    loadContasFinanceirasHybrid({ mode: 'full', source: 'firebase' }).then(fullData => {
                        if (loadToken !== state.loadToken) return;
                        if ((fullData.pagar && fullData.pagar.length) || (fullData.receber && fullData.receber.length)) {
                            state.data.contasPagar = fullData.pagar;
                            state.data.contasReceber = fullData.receber;
                            state.lastUpdate = new Date();
                            notifyWidgets('dataLoaded', state.data);
                        }
                    }).catch(() => {});
                }
            } else {
                // Fallback para método antigo
                const dollarPromise = loadDollarRate();
                const [romaneiosData, clientsData] = await Promise.all([
                    loadRomaneiosData(),
                    loadClientsData()
                ]);
                
                const [preromaneiosData, folhaData, contasData] = await Promise.all([
                    loadPreRomaneiosData(),
                    loadFolhaData(),
                    loadContasFinanceirasHybrid({ mode: 'full', source: 'firebase' })
                ]);
                const financeSnapshot = await loadFinanceSnapshot(new Date().toISOString().slice(0,7));
                
                state.data.romaneios = romaneiosData;
                state.data.clients = clientsData;
                state.data.preromaneios = preromaneiosData;
                state.data.folha = folhaData;
                state.data.contasPagar = contasData.pagar;
                state.data.contasReceber = contasData.receber;
                state.data.financeSnapshot = financeSnapshot || null;
                await dollarPromise;
            }

            state.lastUpdate = new Date();
            
            if (CONFIG.debugMode) console.log('✅ Dados carregados:', state.data);
            
            // Notificar widgets
            notifyWidgets('dataLoaded', state.data);
            
        } catch (error) {
            console.error('❌ Erro ao carregar dados:', error);
            showError('Erro ao carregar dados do dashboard');
        } finally {
            state.isLoading = false;
            updateLoadingState();
        }
    }

    /**
     * ✅ CARREGAR DADOS DOS ROMANEIOS
     */
    async function loadRomaneiosData() {
        // Compatível com nomes reais no Firebase
        const data = { tl: [], pct: [], pes: [] };
        
        try {
            // Carregar usando múltiplas chaves conhecidas
    const tlKeys = ['romaneios_tl', 'romaneiosTL', 'romaneios/tl', 'romaneio_tl', 'romaneioTL'];
    const pctKeys = ['romaneios_pct', 'romaneios/pct', 'romaneiosPct', 'romaneio_pct', 'romaneioPct'];
            const pesKeys = ['romaneio_pes', 'romaneiopes', 'romaneioPes'];

            const firstNonEmpty = async (keys) => {
                for (const k of keys) {
                    const res = await loadFromFirebase(k);
                    if (res && ((Array.isArray(res) && res.length) || (typeof res === 'object' && Object.keys(res).length))) {
                        return res;
                    }
                }
                return null;
            };

            const [tlData, pctData, pesData] = await Promise.all([
                firstNonEmpty(tlKeys),
                firstNonEmpty(pctKeys),
                firstNonEmpty(pesKeys)
            ]);
            
            // Processar dados - converter objeto Firebase para array se necessário
            data.tl = Array.isArray(tlData) ? tlData : (tlData ? Object.values(tlData) : []);
            data.pct = Array.isArray(pctData) ? pctData : (pctData ? Object.values(pctData) : []);
            data.pes = Array.isArray(pesData) ? pesData : (pesData ? Object.values(pesData) : []);
            
            if (CONFIG.debugMode) console.log('📊 Romaneios carregados:', {
                TL: data.tl.length,
                PCT: data.pct.length, 
                PES: data.pes.length
            });
            
        } catch (error) {
            console.error('❌ Erro ao carregar romaneios:', error);
        }
        
        return data;
    }

    /**
     * 📊 Carregar snapshot financeiro mensal (totais leves)
     */
    async function loadFinanceSnapshot(monthKey) {
        try {
            const path = `finance_snapshots/${monthKey}`;
            const res = await loadFromFirebase(path);
            if (res && typeof res === 'object') {
                return res;
            }
            return null;
        } catch (e) {
            return null;
        }
    }

    /**
     * ✅ CARREGAR DADOS DOS CLIENTES
     */
    async function loadClientsData() {
        try {
            let clients = [];
            if (window.clientService && typeof window.clientService.getClients === 'function') {
                clients = await window.clientService.getClients(true);
            } else {
                let result = await loadFromFirebase('clients');
                if (result && result.success && result.data) {
                    result = result.data;
                }
                if (result && typeof result === 'object' && !Array.isArray(result)) {
                    clients = Object.values(result);
                } else if (Array.isArray(result)) {
                    clients = result;
                }
            }
            if (!Array.isArray(clients)) clients = [];
            if (CONFIG.debugMode) console.log('👥 Clientes carregados:', clients.length);
            return clients;
        } catch (error) {
            console.error('❌ Erro ao carregar clientes:', error);
            return [];
        }
    }

    /**
     * ✅ CARREGAR DADOS DAS ESPÉCIES
     */
    async function loadSpeciesData() {
        try {
            let species = await loadFromFirebase('species');
            
            // Processar dados - converter objeto Firebase para array se necessário
            if (species && typeof species === 'object' && !Array.isArray(species)) {
                species = Object.values(species);
            } else if (!species) {
                species = [];
            }
            
            if (CONFIG.debugMode) console.log('🌲 Espécies carregadas:', species.length);
            return species;
            
        } catch (error) {
            console.error('❌ Erro ao carregar espécies:', error);
            return [];
        }
    }

    /**
     * ✅ CARREGAR DADOS DOS PRÉ-ROMANEIOS (Antigos Orçamentos)
     */
    async function loadPreRomaneiosData() {
        try {
            // Carregar tanto da nova coleção 'preromaneios' quanto da antiga 'orcamentos'
            const [preromaneios, orcamentos] = await Promise.all([
                loadFromFirebase('preromaneios'),
                loadFromFirebase('orcamentos')
            ]);
            
            const allData = [];
            
            // Helper to normalize
            const normalize = (data) => {
                if (!data) return [];
                return Array.isArray(data) ? data : Object.values(data);
            };
            
            allData.push(...normalize(preromaneios));
            allData.push(...normalize(orcamentos));
            
            // Remove duplicates by ID if any
            const unique = Array.from(new Map(allData.map(item => [item.id, item])).values());
            
            if (CONFIG.debugMode) console.log('💰 Pré-Romaneios carregados:', unique.length);
            return unique;
            
        } catch (error) {
            console.error('❌ Erro ao carregar pré-romaneios:', error);
            return [];
        }
    }

    /**
     * ✅ CARREGAR DADOS DA FOLHA DE PAGAMENTO
     */
    async function loadFolhaData() {
        const data = { funcionarios: [], lancamentos: [] };
        
        try {
            const [funcionarios, lancamentos] = await Promise.all([
                loadFromFirebase('funcionarios'),
                loadFromFirebase('folhas')
            ]);
            
            // Processar funcionários
            data.funcionarios = normalizeList(funcionarios);
            
            // Processar lançamentos
            data.lancamentos = normalizeList(lancamentos);
            
            if (CONFIG.debugMode) console.log('👷 Folha carregada:', {
                funcionarios: data.funcionarios.length,
                lancamentos: data.lancamentos.length
            });
            
        } catch (error) {
            console.error('❌ Erro ao carregar folha:', error);
        }
        
        return data;
    }

    /**
     * ✅ CARREGAR COTAÇÃO DO DÓLAR (API EXTERNA)
     */
    async function loadDollarRate() {
        try {
            console.log('💵 Carregando cotação do dólar...');
            
            // Verificar cache primeiro
            const cached = getCachedData('dollarRate');
            if (cached && cached.data) {
                state.data.dollarRate = cached.data;
                console.log('💵 Cotação do dólar (cache):', cached.data);
                return cached.data;
            }

            if (!CONFIG.enableExternalFxApi) {
                const fallbackLocal = {
                    value: 5.5,
                    high: 5.5,
                    low: 5.5,
                    variation: 0,
                    timestamp: Date.now(),
                    source: 'local_fallback'
                };
                state.data.dollarRate = fallbackLocal;
                setCachedData('dollarRate', fallbackLocal);
                return fallbackLocal;
            }
            
            // ✅ APIS OTIMIZADAS: Apenas uma API confiável com fallback rápido
            let data = null;
            const apis = [
                'https://economia.awesomeapi.com.br/json/last/USD-BRL' // API brasileira mais rápida
            ];
            
            let attempts = 0;
            for (const apiUrl of apis) {
                if (attempts >= CONFIG.maxRetries) break;
                
                try {
                    if (CONFIG.debugMode) console.log(`💵 Tentando API (${attempts + 1}/${CONFIG.maxRetries}): ${apiUrl}`);
                    const controller = new AbortController();
                    const timeoutId = setTimeout(() => controller.abort(), CONFIG.apiTimeout);
                    
                    const response = await fetch(apiUrl, {
                        signal: controller.signal,
                        headers: {
                            'Accept': 'application/json',
                            'Content-Type': 'application/json'
                        }
                    });
                    
                    clearTimeout(timeoutId);
                    
                    if (response.ok) {
                        data = await response.json();
                        if (CONFIG.debugMode) console.log('💵 API respondeu:', data);
                        break;
                    }
                } catch (apiError) {
                    attempts++;
                    console.warn(`⚠️ API ${apiUrl} falhou (tentativa ${attempts}):`, apiError.message);
                    continue;
                }
            }
            
            let rate;
            if (data) {
                // Processar resposta dependendo da API
                if (data.USDBRL) {
                    // AwesomeAPI format
                    rate = {
                        value: parseFloat(data.USDBRL.bid || data.USDBRL.ask || 5.50),
                        high: parseFloat(data.USDBRL.high || 5.50),
                        low: parseFloat(data.USDBRL.low || 5.50),
                        variation: parseFloat(data.USDBRL.pctChange || 0),
                        timestamp: Date.now()
                    };
                } else if (data.rates && data.rates.BRL) {
                    // ExchangeRate-API or Fixer format
                    rate = {
                        value: parseFloat(data.rates.BRL || 5.50),
                        high: parseFloat(data.rates.BRL || 5.50),
                        low: parseFloat(data.rates.BRL || 5.50),
                        variation: 0,
                        timestamp: Date.now()
                    };
                } else {
                    throw new Error('Formato de resposta não reconhecido');
                }
            } else {
                throw new Error('Todas as APIs falharam');
            }
            
            state.data.dollarRate = rate;
            setCachedData('dollarRate', rate);
            
            console.log('💵 Cotação do dólar atualizada:', rate);
            return rate;
            
        } catch (error) {
            console.warn('⚠️ Todas as APIs de cotação falharam, usando valor fallback:', error.message);
            
            // Fallback para valor padrão se todas as APIs falharem
            const fallback = { 
                value: 5.50, 
                high: 5.60,
                low: 5.40,
                variation: 0, 
                timestamp: Date.now(),
                source: 'fallback'
            };
            state.data.dollarRate = fallback;
            setCachedData('dollarRate', fallback);
            
            console.log('💵 Usando cotação fallback:', fallback);
            return fallback;
        }
    }

    /**
     * ⚡ CARREGAMENTO HÍBRIDO INSTANTÂNEO
     */
    async function loadFromHybrid(path) {
        try {
            if (window.hybridSync) {
                let result = await window.hybridSync.loadInstant(path);
                // Desembrulhar objetos { success, data }
                if (result && typeof result === 'object' && 'success' in result && 'data' in result) {
                    result = result.data;
                }
                if (CONFIG.debugMode) console.log(`⚡ Dados híbridos ${path}:`, result ? 'carregados' : 'não encontrados');
                return result || [];
            } else {
                // Fallback para método antigo
                return await loadFromFirebase(path);
            }
        } catch (error) {
            console.error(`❌ Erro no carregamento híbrido de ${path}:`, error);
            return [];
        }
    }

    /**
     * ✅ CARREGAR DO FIREBASE COM TRATAMENTO DE ERRO (FALLBACK)
     */
    async function loadFromFirebase(path) {
        try {
            // Usar o serviço Firebase global do sistema
            if (window.firebaseServiceTL && window.firebaseServiceTL.getData) {
                let result = await window.firebaseServiceTL.getData(path);
                // Desembrulhar caso venha no formato { success, data }
                if (result && typeof result === 'object' && 'success' in result && 'data' in result) {
                    result = result.data;
                }
                if (CONFIG.debugMode) console.log(`🔍 Dados Firebase ${path}:`, result);
                return result;
            } else if (window.FirebaseService && window.FirebaseService.loadFromFirebase) {
                let result = await window.FirebaseService.loadFromFirebase(path);
                if (result && typeof result === 'object' && 'success' in result && 'data' in result) {
                    result = result.data;
                }
                if (CONFIG.debugMode) console.log(`🔍 Dados Firebase ${path}:`, result);
                return result;
            } else if (window.firebaseService && window.firebaseService.loadFromFirebase) {
                let result = await window.firebaseService.loadFromFirebase(path);
                if (result && typeof result === 'object' && 'success' in result && 'data' in result) {
                    result = result.data;
                }
                if (CONFIG.debugMode) console.log(`🔍 Dados Firebase ${path}:`, result);
                return result;
            } else if (window.firebaseService && window.firebaseService.loadData) {
                let result = await window.firebaseService.loadData(path);
                if (result && typeof result === 'object' && 'success' in result && 'data' in result) {
                    result = result.data;
                }
                if (CONFIG.debugMode) console.log(`🔍 Dados Firebase ${path}:`, result);
                return result;
            } else {
                if (CONFIG.debugMode) console.warn(`⚠️ Nenhum serviço Firebase disponível para ${path}`);
                return [];
            }
        } catch (error) {
            console.error(`❌ Erro ao carregar ${path} do Firebase:`, error);
            return [];
        }
    }

    async function loadFromFirebaseStrict(path) {
        try {
            if (window.firebaseServiceTL && window.firebaseServiceTL.getData) {
                let result = await window.firebaseServiceTL.getData(path);
                if (result && typeof result === 'object' && 'success' in result && 'data' in result) {
                    result = result.data;
                }
                return result || [];
            }
            if (window.FirebaseService && window.FirebaseService.loadFromFirebase) {
                let result = await window.FirebaseService.loadFromFirebase(path);
                if (result && typeof result === 'object' && 'success' in result && 'data' in result) {
                    result = result.data;
                }
                return result || [];
            }
            if (window.firebaseService && window.firebaseService.loadFromFirebase) {
                let result = await window.firebaseService.loadFromFirebase(path);
                if (result && typeof result === 'object' && 'success' in result && 'data' in result) {
                    result = result.data;
                }
                return result || [];
            }
            if (window.firebaseService && window.firebaseService.loadData) {
                let result = await window.firebaseService.loadData(path);
                if (result && typeof result === 'object' && 'success' in result && 'data' in result) {
                    result = result.data;
                }
                return result || [];
            }
        } catch (_) {}
        return [];
    }

    /**
     * ✅ SISTEMA DE CACHE
     */
    function getCachedData(key) {
        const cached = state.cache.get(key);
        if (cached && (Date.now() - cached.timestamp) < CONFIG.cacheTimeout) {
            return cached;
        }
        return null;
    }

    function setCachedData(key, data) {
        state.cache.set(key, {
            data: data,
            timestamp: Date.now()
        });
    }

    /**
     * ✅ CONFIGURAR LISTENERS
     */
    function setupEventListeners() {
        // Listener para conexão online/offline
        window.addEventListener('online', handleConnectionChange);
        window.addEventListener('offline', handleConnectionChange);
        
        // Listener para mudança de foco da janela
        document.addEventListener('visibilitychange', handleVisibilityChange);
        window.addEventListener('tenantContextReady', async () => {
            if (!state.isLoading) {
                await loadAllData();
            }
        });
        window.addEventListener('firebaseReady', async () => {
            if (!state.isLoading && resolveActiveTenant()) {
                await loadAllData();
            }
        });
        
        console.log('✅ Event listeners configurados');
    }

    /**
     * ✅ CONFIGURAR REFRESH AUTOMÁTICO
     */
    function setupAutoRefresh() {
        if (state.refreshTimer) {
            clearInterval(state.refreshTimer);
        }
        
        state.refreshTimer = setInterval(async () => {
            // ✅ REFRESH INTELIGENTE: Só atualiza se página visível e não está carregando
            if (!document.hidden && !state.isLoading) {
                if (CONFIG.debugMode) console.log('🔄 Refresh automático do dashboard...');
                
                // Só recarregar se passou tempo suficiente desde última atualização
                const timeSinceUpdate = state.lastUpdate ? Date.now() - state.lastUpdate.getTime() : Infinity;
                if (timeSinceUpdate > CONFIG.refreshInterval) {
                    await loadAllData();
                }
            }
        }, CONFIG.refreshInterval);
        
        console.log('✅ Refresh automático configurado');
    }

    /**
     * ✅ HANDLES DE EVENTOS
     */
    function handleConnectionChange() {
        console.log('🌐 Status de conexão mudou:', navigator.onLine ? 'Online' : 'Offline');
        if (navigator.onLine) {
            loadAllData(); // Recarregar dados quando voltar online
        }
    }

    function handleVisibilityChange() {
        if (!document.hidden && state.lastUpdate && !state.isLoading) {
            const timeSinceUpdate = Date.now() - state.lastUpdate.getTime();
            // ✅ OTIMIZAÇÃO: Só recarregar se passou mais tempo que o intervalo de refresh
            if (timeSinceUpdate > CONFIG.refreshInterval * 1.5) {
                console.log('🔄 Página voltou ao foco, recarregando dados...');
                loadAllData();
            }
        }
    }

    /**
     * ✅ NOTIFICAR WIDGETS
     */
    function notifyWidgets(event, data) {
        const customEvent = new CustomEvent('dashboard:' + event, {
            detail: data
        });
        document.dispatchEvent(customEvent);
    }

    /**
     * ✅ ATUALIZAR ESTADO DE LOADING
     */
    function updateLoadingState() {
        const indicator = document.querySelector('.dashboard-loading');
        if (indicator) {
            indicator.style.display = state.isLoading ? 'block' : 'none';
        }
    }

    /**
     * ✅ MOSTRAR ERRO
     */
    function showError(message) {
        console.error('💥 Dashboard Error:', message);
        
        if (window.Utils && window.Utils.showToast) {
            window.Utils.showToast(message, 'error');
        } else {
            alert('Erro no dashboard: ' + message);
        }
    }

    /**
     * ✅ OBTER ESTATÍSTICAS CALCULADAS
     */
    function getStatistics() {
        const stats = {
            romaneios: {
                total: (state.data.romaneios.tl?.length || 0) + (state.data.romaneios.pct?.length || 0) + (state.data.romaneios.pes?.length || 0),
                tl: state.data.romaneios.tl?.length || 0,
                pct: state.data.romaneios.pct?.length || 0,
                pes: state.data.romaneios.pes?.length || 0
            },
            clients: {
                total: state.data.clients.length,
                active: state.data.clients.filter(c => c.status !== 'inactive').length
            },
            preromaneios: {
                total: state.data.preromaneios.length
            },
            folha: {
                funcionarios: state.data.folha.funcionarios.length,
                lancamentos: state.data.folha.lancamentos.length
            },
            financeiro: {
                contasPagar: state.data.contasPagar ? state.data.contasPagar.length : 0,
                contasReceber: state.data.contasReceber ? state.data.contasReceber.length : 0
            },
            dollarRate: state.data.dollarRate,
            lastUpdate: state.lastUpdate
        };
        
        return stats;
    }

    /**
     * ✅ REFRESH MANUAL
     */
    async function refresh() {
        console.log('🔄 Refresh manual solicitado');
        await loadAllData();
    }

    // ⚡ FUNÇÕES HÍBRIDAS DE CARREGAMENTO
    async function loadRomaneiosDataHybrid() {
        // Compatível com múltiplas chaves utilizadas no banco
        const data = { tl: [], pct: [], pes: [] };

        try {
    const tlKeys = ['romaneios_tl', 'romaneiosTL', 'romaneios/tl', 'romaneio_tl', 'romaneioTL'];
    const pctKeys = ['romaneios_pct', 'romaneios/pct', 'romaneiosPct', 'romaneio_pct', 'romaneioPct'];
            const pesKeys = ['romaneio_pes', 'romaneios_pes', 'romaneiopes', 'romaneioPes'];

            const firstNonEmpty = async (keys) => {
                for (const k of keys) {
                    const res = await loadFromHybrid(k);
                    if (isNonEmptyData(res)) return res;
                }
                return null;
            };

            const [tlData, pctData, pesData] = await Promise.all([
                firstNonEmpty(tlKeys),
                firstNonEmpty(pctKeys),
                firstNonEmpty(pesKeys)
            ]);

            data.tl = normalizeList(tlData);
            data.pct = normalizeList(pctData);
            data.pes = normalizeList(pesData);

        } catch (error) {
            console.error('❌ Erro ao carregar romaneios híbrido:', error);
        }

        return data;
    }

    async function loadClientsDataHybrid() {
        try {
            let clients = await loadFromHybrid('clients');
            if (clients && typeof clients === 'object' && !Array.isArray(clients)) {
                clients = Object.values(clients);
            }
            return clients || [];
        } catch (error) {
            console.error('❌ Erro ao carregar clientes híbrido:', error);
            return [];
        }
    }

    async function loadSpeciesDataHybrid() {
        try {
            let species = await loadFromHybrid('species');
            if (species && typeof species === 'object' && !Array.isArray(species)) {
                species = Object.values(species);
            }
            return species || [];
        } catch (error) {
            console.error('❌ Erro ao carregar espécies híbrido:', error);
            return [];
        }
    }

    async function loadPreRomaneiosDataHybrid() {
        try {
            const [preromaneios, orcamentos] = await Promise.all([
                loadFromHybrid('preromaneios'),
                loadFromHybrid('orcamentos')
            ]);
            
            const allData = [];
            
            const normalize = (data) => {
                if (!data) return [];
                // Unwrapped by loadFromHybrid if {success, data}
                return Array.isArray(data) ? data : Object.values(data);
            };
            
            allData.push(...normalize(preromaneios));
            allData.push(...normalize(orcamentos));
            
            // Remove duplicates
            const unique = Array.from(new Map(allData.map(item => [item.id, item])).values());
            
            return unique;
        } catch (error) {
            console.error('❌ Erro ao carregar pré-romaneios híbrido:', error);
            return [];
        }
    }

    async function loadFolhaDataHybrid() {
        const data = { funcionarios: [], lancamentos: [] };
        
        try {
            let folhaFolhas = null;
            try {
                const resultado = await loadFromHybrid('folhas');
                if (isNonEmptyData(resultado)) {
                    folhaFolhas = resultado;
                }
            } catch (error) {}
            
            // Carregar funcionários e cargos
            const [funcionarios, cargos] = await Promise.all([
                loadFromHybrid('funcionarios'),
                loadFromHybrid('cargos')
            ]);
            
            // Processar funcionários
            data.funcionarios = normalizeList(funcionarios);
            
            // ✅ PROCESSAR LANÇAMENTOS DA FOLHA
            if (folhaFolhas) {
                if (typeof folhaFolhas === 'object' && !Array.isArray(folhaFolhas)) {
                    // Converter objeto para array com IDs preservados
                    data.lancamentos = Object.entries(folhaFolhas).map(([key, val]) => ({
                        ...(val || {}),
                        id: (val && val.id) ? val.id : key
                    }));
                } else if (Array.isArray(folhaFolhas)) {
                    data.lancamentos = folhaFolhas;
                }
            }
            
        } catch (error) {
            console.error('❌ Erro ao carregar folha híbrido:', error);
        }
        
        return data;
    }

    /**
     * ⚡ CARREGAR DADOS FINANCEIROS (CONTAS A PAGAR E RECEBER)
     */
    async function loadContasFinanceirasHybrid(options = {}) {
        const data = { pagar: [], receber: [] };
        
        try {
            const mode = options.mode || 'full';
            const monthKeys = Array.isArray(options.monthKeys) ? options.monthKeys : [];
            const loadFn = options.source === 'firebase' ? loadFromFirebaseStrict : loadFromHybrid;
            const pagarAliases = ['contasPagar', 'contaspagar', 'contas_pagar', 'financas/pagar', 'financasPagar', 'financas_pagar'];
            const receberAliases = ['contasReceber', 'contasreceber', 'contas_receber', 'financas/receber', 'financasReceber', 'financas_receber'];
            const firstAliasNonEmpty = async (paths) => {
                for (const p of paths) {
                    const r = await loadFn(p);
                    if (isNonEmptyData(r)) return r;
                }
                return [];
            };
            const effectiveMonthKeys = (monthKeys.length > 0)
                ? monthKeys
                : buildMonthRange(new Date().toISOString().slice(0, 7), 60, 1);

            if (mode === 'fast' && effectiveMonthKeys.length > 0) {
                const [pagarByMonth, receberByMonth] = await Promise.all([
                    Promise.all(effectiveMonthKeys.map(mk => firstAliasNonEmpty(pagarAliases.map(a => `${a}/${mk}`)))),
                    Promise.all(effectiveMonthKeys.map(mk => firstAliasNonEmpty(receberAliases.map(a => `${a}/${mk}`))))
                ]);
                data.pagar = dedupeById(pagarByMonth.flatMap(normalizeContasPayload));
                data.receber = dedupeById(receberByMonth.flatMap(normalizeContasPayload));
            } else {
                const [contasPagar, contasReceber] = await Promise.all([
                    firstAliasNonEmpty(pagarAliases),
                    firstAliasNonEmpty(receberAliases)
                ]);
                const pagarNorm = normalizeContasPayload(contasPagar);
                const receberNorm = normalizeContasPayload(contasReceber);

                if ((pagarNorm.length === 0 && effectiveMonthKeys.length > 0) || (receberNorm.length === 0 && effectiveMonthKeys.length > 0)) {
                    const [pagarByMonth, receberByMonth] = await Promise.all([
                        Promise.all(effectiveMonthKeys.map(mk => firstAliasNonEmpty(pagarAliases.map(a => `${a}/${mk}`)))),
                        Promise.all(effectiveMonthKeys.map(mk => firstAliasNonEmpty(receberAliases.map(a => `${a}/${mk}`))))
                    ]);
                    data.pagar = dedupeById(pagarByMonth.flatMap(normalizeContasPayload));
                    data.receber = dedupeById(receberByMonth.flatMap(normalizeContasPayload));
                } else {
                    data.pagar = dedupeById(pagarNorm);
                    data.receber = dedupeById(receberNorm);
                }
            }
            
            if (CONFIG.debugMode) console.log(`💰 Contas carregadas: ${data.pagar.length} a pagar, ${data.receber.length} a receber`);
            
        } catch (error) {
            console.error('❌ Erro ao carregar contas financeiras:', error);
        }
        
        return data;
    }

    /**
     * ⏳ AGUARDAR SISTEMA DE FOLHA CARREGAR
     */
    async function waitForFolhaSystem() {
        if (CONFIG.useHybridSync && window.hybridSync) return;
        console.log('⏳ Aguardando sistema de folha carregar...');
        
        let attempts = 0;
        const maxAttempts = 20;
        
        while (attempts < maxAttempts) {
            // Verificar se o sistema de folha está carregado e tem dados
            const folhaSystemReady = window.folhaSystem && 
                                   window.folhaSystem.folhas && 
                                   window.folhaSystem.folhas.length > 0;
                                   
            const folhaLancamentosReady = window.folhaLancamentos && 
                                        window.folhaLancamentos.lancamentos && 
                                        window.folhaLancamentos.lancamentos.length > 0;
            
            if (folhaSystemReady || folhaLancamentosReady) {
                console.log('✅ Sistema de folha carregado, prosseguindo com dashboard...');
                return;
            }
            
            attempts++;
            await new Promise(resolve => setTimeout(resolve, 200));
        }
        
        console.log('⚠️ Timeout aguardando sistema de folha - prosseguindo mesmo assim...');
    }

    /**
     * 📊 CONFIGURAR LISTENER PARA ATUALIZAÇÕES DA FOLHA DE PAGAMENTO
     */
    function setupFolhaDataListener() {
        console.log('📊 Configurando listener para atualizações da folha de pagamento...');
        
        window.addEventListener('folhaDataChanged', async (event) => {
            console.log('📡 Evento folhaDataChanged recebido:', event.detail);
            
            try {
                // Atualizar apenas os dados da folha no estado
                if (event.detail.data && event.detail.data.lancamentos) {
                    state.data.folha = {
                        lancamentos: event.detail.data.lancamentos,
                        funcionarios: event.detail.data.funcionarios || state.data.folha?.funcionarios || []
                    };
                    
                    console.log(`📊 Dados da folha atualizados: ${state.data.folha.lancamentos.length} lançamentos`);
                    
                    // Atualizar UI do dashboard
                    updateUI();
                    
                    console.log('✅ Dashboard atualizado com novos dados da folha');
                } else {
                    console.log('⚠️ Evento folhaDataChanged sem dados válidos');
                }
            } catch (error) {
                console.error('❌ Erro ao processar atualização da folha:', error);
            }
        });
        
        console.log('✅ Listener para atualizações da folha configurado');
    }

    // ✅ FUNÇÃO GLOBAL PARA DEBUG DE COMPARAÇÃO DETALHADA
    window.debugDashboardVsFolha = function() {
        if (!CONFIG.debugMode) return;
        console.log('🔍 === COMPARAÇÃO DETALHADA DASHBOARD vs FOLHA.HTML ===');
        
        // Dados do dashboard
        if (state.data && state.data.folha) {
            console.log('📊 DADOS DO DASHBOARD:');
            console.log(`   Lançamentos carregados: ${state.data.folha.lancamentos.length}`);
            
            const currentMonth = new Date().toISOString().slice(0, 7);
            const lancamentosAtivosDashboard = state.data.folha.lancamentos.filter(l => {
                const lancamentoMonth = (l.mesAno || '').slice(0, 7);
                const isCurrentMonth = lancamentoMonth === currentMonth;
                const isFechado = l.status === 'mes_fechado' || (typeof l.status === 'string' && l.status.includes('fechado'));
                return isCurrentMonth && !isFechado;
            });
            
            console.log(`   Lançamentos ativos dashboard: ${lancamentosAtivosDashboard.length}`);
            
            // Recalcular usando a função do dashboard
            const dashboardStats = window.DashboardWidgets ? 
                window.DashboardWidgets.calculateStatistics(state.data) : null;
            if (dashboardStats) {
                console.log('📊 TOTAIS DASHBOARD:');
                console.log(`   1ª Quinzena: R$ ${dashboardStats.folha.totalQuinzena.toFixed(2)}`);
                console.log(`   2ª Quinzena: R$ ${dashboardStats.folha.totalLiquido.toFixed(2)}`);
            }
        }
        
        // Dados da folha.html (se disponível)
        if (window.folhaSystem && window.folhaSystem.folhas) {
            console.log('📊 DADOS DA FOLHA.HTML:');
            console.log(`   Lançamentos: ${window.folhaSystem.folhas.length}`);
            
            // Simular cálculo da folha.html
            const folhasAtivas = window.folhaSystem.folhas.filter(f => f.status !== 'mes_fechado');
            console.log(`   Lançamentos ativos folha.html: ${folhasAtivas.length}`);
            
            let totalQuinzenaFolha = 0;
            let totalLiquidoFolha = 0;
            
            folhasAtivas.forEach(folha => {
                if (window.FolhaUtils) {
                    const quinzena = window.FolhaUtils.calcularValorQuinzena(folha);
                    const liquido = window.FolhaUtils.calcularSalarioLiquidoDisplay(folha);
                    totalQuinzenaFolha += quinzena;
                    totalLiquidoFolha += liquido;
                    console.log(`📋 Folha.html - ${folha.funcionario?.nome}: Quinzena=${quinzena}, Líquido=${liquido}`);
                }
            });
            
            console.log('📊 TOTAIS FOLHA.HTML:');
            console.log(`   1ª Quinzena: R$ ${totalQuinzenaFolha.toFixed(2)}`);
            console.log(`   2ª Quinzena: R$ ${totalLiquidoFolha.toFixed(2)}`);
        }
        
        console.log('🎯 VALORES ESPERADOS:');
        console.log('   1ª Quinzena: R$ 25.308,00');
        console.log('   2ª Quinzena: R$ 26.961,35');
        
        // ✅ COMPARAR DATASETS
        if (state.data?.folha?.lancamentos && window.folhaSystem?.folhas) {
            console.log('🔍 COMPARAÇÃO DE DATASETS:');
            console.log(`   Dashboard tem: ${state.data.folha.lancamentos.length} lançamentos`);
            console.log(`   Folha.html tem: ${window.folhaSystem.folhas.length} lançamentos`);
            
            // Verificar se são os mesmos dados
            const idsDashboard = new Set(state.data.folha.lancamentos.map(l => l.id));
            const idsFolha = new Set(window.folhaSystem.folhas.map(l => l.id));
            
            const idsComuns = [...idsDashboard].filter(id => idsFolha.has(id));
            const idsApenasDashboard = [...idsDashboard].filter(id => !idsFolha.has(id));
            const idsApenasFolha = [...idsFolha].filter(id => !idsDashboard.has(id));
            
            console.log(`   IDs em comum: ${idsComuns.length}`);
            console.log(`   Apenas no dashboard: ${idsApenasDashboard.length}`);
            console.log(`   Apenas na folha.html: ${idsApenasFolha.length}`);
            
            if (idsApenasDashboard.length > 0) {
                console.log('   IDs extras no dashboard:', idsApenasDashboard.slice(0, 5));
            }
            if (idsApenasFolha.length > 0) {
                console.log('   IDs extras na folha.html:', idsApenasFolha.slice(0, 5));
            }
        }
    };

    // ✅ FUNÇÃO GLOBAL PARA COMPARAR CÁLCULOS DETALHADOS
    window.compararCalculosDetalhados = function() {
        if (!CONFIG.debugMode) return;
        console.log('🔍 === COMPARAÇÃO DETALHADA DOS CÁLCULOS ===');
        
        const currentMonth = new Date().toISOString().slice(0, 7);
        
        if (state.data?.folha?.lancamentos) {
            const dashboardAtivos = state.data.folha.lancamentos.filter(l => {
                const lancamentoMonth = (l.mesAno || '').slice(0, 7);
                const isNotClosed = l.status !== 'mes_fechado';
                const isFuncionarioAtivo = l.funcionario?.ativo !== false;
                return lancamentoMonth === currentMonth && isNotClosed && isFuncionarioAtivo;
            });
            
            console.log(`📊 Comparando ${dashboardAtivos.length} lançamentos ativos...`);
            
            let totalQuinzenaDashboard = 0;
            let totalLiquidoDashboard = 0;
            let totalQuinzenaFolha = 0;
            let totalLiquidoFolha = 0;
            
            dashboardAtivos.forEach((lancamento, index) => {
                if (index < 5) { // Mostrar apenas os primeiros 5 para não poluir
                    const funcionarioNome = lancamento.funcionario?.nome || 'Sem nome';
                    
                    console.log(`\n👤 FUNCIONÁRIO: ${funcionarioNome}`);
                    
                    // DASHBOARD - Usando as funções implementadas
                    const dashQuinzena = calcularValorQuinzenaDashboard ? calcularValorQuinzenaDashboard(lancamento) : 0;
                    const dashLiquido = calcularSalarioLiquidoDashboard ? calcularSalarioLiquidoDashboard(lancamento) : 0;
                    
                    // FOLHA.HTML - Usando FolhaUtils (se disponível)
                    const folhaQuinzena = window.FolhaUtils ? window.FolhaUtils.calcularValorQuinzena(lancamento) : 0;
                    const folhaLiquido = window.FolhaUtils ? window.FolhaUtils.calcularSalarioLiquidoDisplay(lancamento) : 0;
                    
                    console.log(`📊 Dashboard: Quinzena=${dashQuinzena.toFixed(2)}, Líquido=${dashLiquido.toFixed(2)}`);
                    console.log(`📊 Folha.HTML: Quinzena=${folhaQuinzena.toFixed(2)}, Líquido=${folhaLiquido.toFixed(2)}`);
                    
                    if (Math.abs(dashQuinzena - folhaQuinzena) > 0.01) {
                        console.log(`❌ DIFERENÇA QUINZENA: ${Math.abs(dashQuinzena - folhaQuinzena).toFixed(2)}`);
                    }
                    if (Math.abs(dashLiquido - folhaLiquido) > 0.01) {
                        console.log(`❌ DIFERENÇA LÍQUIDO: ${Math.abs(dashLiquido - folhaLiquido).toFixed(2)}`);
                    }
                }
                
                // Somar totais para comparação
                totalQuinzenaDashboard += calcularValorQuinzenaDashboard ? calcularValorQuinzenaDashboard(lancamento) : 0;
                totalLiquidoDashboard += calcularSalarioLiquidoDashboard ? calcularSalarioLiquidoDashboard(lancamento) : 0;
                totalQuinzenaFolha += window.FolhaUtils ? window.FolhaUtils.calcularValorQuinzena(lancamento) : 0;
                totalLiquidoFolha += window.FolhaUtils ? window.FolhaUtils.calcularSalarioLiquidoDisplay(lancamento) : 0;
            });
            
            console.log('\n📊 TOTAIS COMPARADOS:');
            console.log(`Dashboard: 1ª Quinzena = R$ ${totalQuinzenaDashboard.toFixed(2)}, 2ª Quinzena = R$ ${totalLiquidoDashboard.toFixed(2)}`);
            console.log(`Folha.HTML: 1ª Quinzena = R$ ${totalQuinzenaFolha.toFixed(2)}, 2ª Quinzena = R$ ${totalLiquidoFolha.toFixed(2)}`);
            console.log(`Esperado: 1ª Quinzena = R$ 25.308,00, 2ª Quinzena = R$ 26.961,35`);
            
            console.log('\n🎯 DIFERENÇAS:');
            console.log(`1ª Quinzena: Dashboard vs Folha = ${Math.abs(totalQuinzenaDashboard - totalQuinzenaFolha).toFixed(2)}`);
            console.log(`2ª Quinzena: Dashboard vs Folha = ${Math.abs(totalLiquidoDashboard - totalLiquidoFolha).toFixed(2)}`);
        }
    };

    // ✅ FUNÇÃO GLOBAL PARA INVESTIGAR ESTRUTURA DOS DADOS
    window.investigarEstruturaDados = function() {
        console.log('🔍 === INVESTIGAÇÃO ESTRUTURA DOS DADOS ===');
        
        const currentMonth = new Date().toISOString().slice(0, 7);
        
        if (state.data?.folha?.lancamentos) {
            const dashboardAtivos = state.data.folha.lancamentos.filter(l => {
                const lancamentoMonth = (l.mesAno || '').slice(0, 7);
                const statusFechado = ['mes_fechado', 'fechado', 'encerrado'];
                const isFechado = statusFechado.includes(l.status?.toLowerCase?.());
                return lancamentoMonth === currentMonth && !isFechado;
            });
            
            console.log(`📊 Investigando ${dashboardAtivos.length} lançamentos ativos...`);
            
            // Investigar estrutura do primeiro lançamento
            if (dashboardAtivos.length > 0) {
                const primeiro = dashboardAtivos[0];
                console.log('🔍 ESTRUTURA COMPLETA DO PRIMEIRO LANÇAMENTO:');
                console.log('📋 Lançamento completo:', primeiro);
                console.log('📋 Campos de cálculo:', primeiro.calculos);
                console.log('📋 Possíveis campos de quinzena:', {
                    'calculos.valorQuinzena': primeiro.calculos?.valorQuinzena,
                    'quinzenaValorManual': primeiro.quinzenaValorManual,
                    'valorQuinzena': primeiro.valorQuinzena,
                    'quinzena': primeiro.quinzena
                });
                console.log('📋 Possíveis campos de líquido:', {
                    'calculos.valorLiquido': primeiro.calculos?.valorLiquido,
                    'calculos.salarioLiquido': primeiro.calculos?.salarioLiquido,
                    'valorLiquido': primeiro.valorLiquido,
                    'salarioLiquido': primeiro.salarioLiquido,
                    'liquido': primeiro.liquido
                });
            }
        }
    };

    // ✅ FUNÇÃO GLOBAL PARA COMPARAR DADOS BRUTOS
    window.compareDashboardFolhaData = function() {
        console.log('🔍 === COMPARAÇÃO DADOS BRUTOS DASHBOARD vs FOLHA.HTML ===');
        
        const currentMonth = new Date().toISOString().slice(0, 7);
        console.log(`📅 Mês atual: ${currentMonth}`);
        
        // Dados do dashboard
        if (state.data?.folha?.lancamentos) {
            const dashboardLancamentos = state.data.folha.lancamentos;
            const dashboardAtivos = dashboardLancamentos.filter(l => {
                const lancamentoMonth = (l.mesAno || '').slice(0, 7);
                const statusFechado = ['mes_fechado', 'fechado', 'encerrado'];
                const isFechado = statusFechado.includes(l.status?.toLowerCase?.());
                return lancamentoMonth === currentMonth && !isFechado;
            });
            
            console.log(`📊 Dashboard - Total: ${dashboardLancamentos.length}, Ativos: ${dashboardAtivos.length}`);
            
            // Listar funcionários ativos
            const funcionariosDashboard = dashboardAtivos.map(l => ({
                nome: l.funcionario?.nome || l.funcionario,
                percentual: l.quinzenaPercentual || l.percentualQuinzena || 'não definido',
                salarioBase: l.salarioBase,
                bonificacoes: l.bonificacoes,
                usarBruto: l.usarSalarioBrutoParaQuinzena,
                status: l.status
            }));
            
            if (CONFIG.debugMode) console.log('👥 Funcionários Dashboard:', funcionariosDashboard);
        }
        
        // Dados da folha.html
        if (window.folhaSystem?.folhas) {
            const folhaLancamentos = window.folhaSystem.folhas;
            const folhaAtivos = folhaLancamentos.filter(f => f.status !== 'mes_fechado');
            
            if (CONFIG.debugMode) console.log(`📊 Folha.HTML - Total: ${folhaLancamentos.length}, Ativos: ${folhaAtivos.length}`);
            
            // Listar funcionários ativos
            const funcionariosFolha = folhaAtivos.map(f => ({
                nome: f.funcionario?.nome || f.funcionario,
                percentual: f.quinzenaPercentual || f.percentualQuinzena || 'não definido',
                salarioBase: f.salarioBase,
                bonificacoes: f.bonificacoes,
                usarBruto: f.usarSalarioBrutoParaQuinzena,
                status: f.status
            }));
            
            if (CONFIG.debugMode) console.log('👥 Funcionários Folha.HTML:', funcionariosFolha);
        }
    };

    // ✅ FUNÇÃO GLOBAL PARA TESTAR DIFERENTES ABORDAGENS DE CÁLCULO
    window.testarDiferentesCalculos = function() {
        console.log('🧪 === TESTANDO DIFERENTES ABORDAGENS DE CÁLCULO ===');
        
        const currentMonth = new Date().toISOString().slice(0, 7);
        
        if (state.data?.folha?.lancamentos) {
            const lancamentosAtivos = state.data.folha.lancamentos.filter(l => {
                const lancamentoMonth = (l.mesAno || '').slice(0, 7);
                const isNotClosed = l.status !== 'mes_fechado';
                const isFuncionarioAtivo = l.funcionario?.ativo !== false;
                return lancamentoMonth === currentMonth && isNotClosed && isFuncionarioAtivo;
            });
            
            console.log(`🧪 Testando com o primeiro funcionário ativo...`);
            
            if (lancamentosAtivos.length > 0) {
                const primeiro = lancamentosAtivos[0];
                const nome = primeiro.funcionario?.nome || 'Sem nome';
                
                console.log(`👤 FUNCIONÁRIO: ${nome}`);
                console.log('📋 Dados brutos:', {
                    salarioBase: primeiro.salarioBase,
                    bonificacoes: primeiro.bonificacoes,
                    quinzenaPercentual: primeiro.quinzenaPercentual,
                    percentualQuinzena: primeiro.percentualQuinzena,
                    usarSalarioBrutoParaQuinzena: primeiro.usarSalarioBrutoParaQuinzena,
                    calculos: primeiro.calculos
                });
                
                // TESTE 1: Usar FolhaUtils (referência)
                if (window.FolhaUtils) {
                    const folhaQuinzena = window.FolhaUtils.calcularValorQuinzena(primeiro);
                    const folhaLiquido = window.FolhaUtils.calcularSalarioLiquidoDisplay(primeiro);
                    console.log(`📊 FolhaUtils: Quinzena=${folhaQuinzena}, Líquido=${folhaLiquido}`);
                }
                
                // TESTE 2: Usar funções do dashboard
                if (window.calcularValorQuinzenaDashboard && window.calcularSalarioLiquidoDashboard) {
                    const dashQuinzena = window.calcularValorQuinzenaDashboard(primeiro);
                    const dashLiquido = window.calcularSalarioLiquidoDashboard(primeiro);
                    const dashBase = window.getSalarioBaseDisplayDashboard ? window.getSalarioBaseDisplayDashboard(primeiro) : 0;
                    const dashAcrescimos = window.calcularAcrescimosDisplayDashboard ? window.calcularAcrescimosDisplayDashboard(primeiro) : 0;
                    console.log(`📊 Dashboard: Base=${dashBase}, Quinzena=${dashQuinzena}, Acréscimos=${dashAcrescimos}, Líquido=${dashLiquido}`);
                }
                
                // TESTE 3: Valores já calculados nos dados
                const c = primeiro.calculos || {};
                const calc = c.calculos || c;
                console.log(`📊 Pré-calculados: valorQuinzena=${calc.valorQuinzena}, valorLiquido=${calc.valorLiquido}, salarioLiquido=${calc.salarioLiquido}`);
            }
        }
    };

    // ✅ FUNÇÃO GLOBAL PARA VERIFICAR MÚLTIPLAS CHAMADAS
    window.monitorDashboardCalls = function() {
        if (!CONFIG.debugMode) return;
        console.log('🔍 === MONITORAMENTO DE CHAMADAS DO DASHBOARD ===');
        
        let callCount = 0;
        const originalCalculateStats = window.DashboardWidgets?.calculateStatistics;
        
        if (originalCalculateStats) {
            window.DashboardWidgets.calculateStatistics = function(data) {
                callCount++;
                console.log(`📊 [CHAMADA ${callCount}] calculateStatistics executada`);
                console.log(`📊 [CHAMADA ${callCount}] Dados recebidos:`, {
                    folhaLancamentos: data.folha?.lancamentos?.length || 0,
                    timestamp: new Date().toISOString()
                });
                
                const result = originalCalculateStats.call(this, data);
                
                console.log(`📊 [CHAMADA ${callCount}] Resultado:`, {
                    totalQuinzena: result.folha?.totalQuinzena,
                    totalLiquido: result.folha?.totalLiquido
                });
                
                return result;
            };
            
            console.log('✅ Monitoramento ativado - observe os logs para detectar chamadas múltiplas');
        } else {
            console.log('⚠️ DashboardWidgets.calculateStatistics não encontrado');
        }
    };

    // ✅ FUNÇÃO GLOBAL PARA REFRESH MANUAL DO DASHBOARD
    window.refreshDashboardFolha = async function() {
        console.log('🔄 Refresh manual do dashboard solicitado...');
        try {
            await loadAllData();
            updateUI();
            console.log('✅ Dashboard atualizado manualmente');
        } catch (error) {
            console.error('❌ Erro no refresh manual:', error);
        }
    };

    // ✅ FUNÇÃO GLOBAL PARA VERIFICAR DUPLICAÇÕES NOS DADOS
    window.verificarDuplicacoesFolha = function() {
        console.log('🔍 === VERIFICAÇÃO DE DUPLICAÇÕES ===');
        
        const currentMonth = new Date().toISOString().slice(0, 7);
        
        if (state.data?.folha?.lancamentos) {
            const lancamentosAtivos = state.data.folha.lancamentos.filter(l => {
                const lancamentoMonth = (l.mesAno || '').slice(0, 7);
                const statusFechado = ['mes_fechado', 'fechado', 'encerrado'];
                const isFechado = statusFechado.includes(l.status?.toLowerCase?.());
                return lancamentoMonth === currentMonth && !isFechado;
            });

            console.log(`📊 Total de lançamentos ativos: ${lancamentosAtivos.length}`);

            const funcionarios = new Map();
            lancamentosAtivos.forEach((l, index) => {
                const nome = l.funcionario?.nome || l.funcionario || `funcionario_${index}`;
                if (!funcionarios.has(nome)) {
                    funcionarios.set(nome, []);
                }
                funcionarios.get(nome).push({
                    id: l.id,
                    index: index,
                    mesAno: l.mesAno,
                    status: l.status,
                    tipo: l.tipo || l.tipoPagamento
                });
            });

            console.log(`👥 Funcionários únicos: ${funcionarios.size}`);
            
            let duplicados = 0;
            funcionarios.forEach((lancamentos, nome) => {
                if (lancamentos.length > 1) {
                    duplicados++;
                    console.log(`🔄 DUPLICADO: ${nome} (${lancamentos.length} lançamentos):`, lancamentos);
                }
            });

            console.log(`🚨 Total de funcionários com duplicações: ${duplicados}`);
            console.log(`✅ Funcionários únicos esperados: ${funcionarios.size}`);
        } else {
            console.log('❌ Dados de folha não disponíveis');
        }
    };

    // ⚡ INTERFACE PÚBLICA OTIMIZADA
    return {
        init,
        refresh,
        getStatistics,
        getDollarRate: () => state.data.dollarRate,
        isLoading: () => state.isLoading,
        getLastUpdate: () => state.lastUpdate,
        // Novas funcionalidades híbridas
        getHybridMetrics: () => window.hybridSync ? window.hybridSync.getMetrics() : null,
        enableHybridSync: () => { CONFIG.useHybridSync = true; },
        disableHybridSync: () => { CONFIG.useHybridSync = false; }
    };

})();

console.log('✅ Módulo Dashboard Core carregado com sucesso');
