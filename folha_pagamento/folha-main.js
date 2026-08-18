/**
 * 🎯 FOLHA MAIN - Controlador Principal + Navegação
 * Coordena todo o sistema de Folha de Pagamento
 * Baseado nos padrões do romaneiopct
 */

/**
 * 🚀 CLASSE PRINCIPAL DO SISTEMA
 */
function persistLocalValue(storageKey, data) {
    try {
        if (window.SiswebStorage && typeof window.SiswebStorage.write === 'function') {
            return window.SiswebStorage.write(storageKey, data) !== false;
        }
    } catch (_) {}
    const payload = typeof data === 'string' ? data : JSON.stringify(data);
    localStorage.setItem(storageKey, payload);
    return true;
}

class FolhaPagamentoSystem {
    constructor() {
        this.initialized = false;
        this.currentModal = null;
        this.funcionarios = [];
        this.cargos = [];
        this.folhas = [];
        this.filtros = {
            mesAno: '',
            tipoFolha: '',
            funcionario: ''
        };
        this._tabelaRenderizada = false; // Proteção contra loops
        this.debounceTimer = null;
        console.log('🎯 Sistema Folha de Pagamento inicializado');
    }
    
    /**
     * 🔧 Inicializar sistema
     */
    async init() {
        if (this.initialized) return;
        
        console.log('🚀 Inicializando Sistema de Folha de Pagamento...');
        
        try {
            // 1. Aguardar carregamento das dependências
            await this.waitForDependencies();
            
            // 2. Configurar navegação com Enter
            this.setupEnterNavigation();
            
            // 3. Configurar eventos dos modais
            this.setupModalEvents();
            
            // 4. Configurar filtros
            this.setupFilters();
            
            // 5. Carregar dados iniciais
            await this.loadInitialData();
            
            // 6. Configurar interface
            this.setupInterface();
            
            // 7. Configurar datas padrão (mês atual)
            this.setupDefaultDates();

            // 8. Ativar sincronização em tempo real das folhas
            this.setupRealtimeFolhas();

            this.setupTextNormalization();
            
            this.initialized = true;
            console.log('✅ Sistema Folha de Pagamento inicializado com sucesso!');
            
            // ✅ CORREÇÃO CRÍTICA: NÃO renderizar automaticamente - deixar filtros assumirem controle
            console.log('📊 Dados carregados, aguardando sistema de filtros assumir controle da renderização...');
            
            // Sinalizar que dados estão prontos para os filtros
            window.dispatchEvent(new CustomEvent('folhaDataReady', { 
                detail: { 
                    folhas: this.folhas,
                    funcionarios: this.funcionarios,
                    cargos: this.cargos
                }
            }));
            
        } catch (error) {
            console.error('❌ Erro ao inicializar sistema:', error);
            
            if (window.FolhaUtils && window.FolhaUtils.mostrarErro) {
                window.FolhaUtils.mostrarErro('Erro ao inicializar sistema: ' + error.message);
            } else {
                console.error('❌ FolhaUtils não disponível para mostrar erro');
            }
        }
    }

    setupTextNormalization() {
        const textos = document.querySelectorAll('input[type="text"], textarea');
        textos.forEach(el => {
            el.addEventListener('blur', function(){
                const v = String(this.value || '').trim();
                if (!v) return;
                if (isAllCaps(v)) this.value = toTitleCasePt(v);
            });
        });
    }

    mostrarSecoesPrincipaisFolha() {
        try {
            if (window.FolhaUtils && typeof window.FolhaUtils.ensureFolhaMainSectionsVisible === 'function') {
                window.FolhaUtils.ensureFolhaMainSectionsVisible();
                return;
            }
            const tabela = document.getElementById('tabela-folhas-section');
            const totais = document.getElementById('totais-section');
            if (tabela) tabela.style.display = 'block';
            if (totais) totais.style.display = 'block';
        } catch (e) {}
    }
    
    /**
     * ⏳ Aguardar carregamento das dependências
     */
    async waitForDependencies() {
        const maxAttempts = 100;
        let attempts = 0;
        
        console.log('⏳ Iniciando verificação de dependências...');
        
        while (attempts < maxAttempts) {
            const configOk = window.FolhaConfig || window.FUNCIONARIOS_CONFIG;
            const utilsOk = window.FolhaUtils && typeof window.FolhaUtils.renderizarTabelaLancamentos === 'function';
            const firebaseOk = window.folhaFirebaseService || window.FirebaseService || window.database;
            
            if (attempts % 5 === 0) {
                console.log(`⏳ Aguardando dependências (${attempts}/${maxAttempts}):`, {
                    config: !!configOk,
                    utils: !!utilsOk,
                    firebase: !!firebaseOk
                });
            }
            
            if (configOk && utilsOk && firebaseOk) {
                console.log('✅ Dependências essenciais carregadas');
                await this.waitForModules();
                return;
            }
            
            await new Promise(resolve => setTimeout(resolve, 100));
            attempts++;
        }
        
        throw new Error('Timeout aguardando dependências essenciais');
    }
    
    /**
     * 📦 Aguardar inicialização dos módulos
     */
    async waitForModules() {
        const maxAttempts = 100;
        let attempts = 0;
        
        console.log('📦 Aguardando inicialização dos módulos...');
        
        while (attempts < maxAttempts) {
            const funcionariosOk = window.folhaFuncionarios;
            const cargosOk = window.folhaCargos;
            const lancamentosOk = window.folhaLancamentos;
            
            if (attempts % 5 === 0) {
                console.log(`⏳ Aguardando módulos (${attempts}/${maxAttempts}):`, {
                    funcionarios: !!funcionariosOk,
                    cargos: !!cargosOk,
                    lancamentos: !!lancamentosOk
                });
            }
            
            if (funcionariosOk && cargosOk && lancamentosOk) {
                console.log('✅ Módulos carregados');
                return;
            }
            
            await new Promise(resolve => setTimeout(resolve, 100));
            attempts++;
        }
        
        throw new Error('Timeout aguardando módulos');
    }
    
    /**
     * 🔄 Carregar dados iniciais
     */
    async loadInitialData() {
        console.log('📊 Carregando dados iniciais com sistema otimizado...');
        
        try {
            await this.loadDataWithOptimization();
            console.log('✅ Dados iniciais carregados com sucesso');
        } catch (error) {
            console.error('❌ Erro ao carregar dados iniciais:', error);
        }
    }
    
    /**
     * 🔄 Carregar dados com otimização
     */
    async loadDataWithOptimization() {
        console.log('🔄 Carregando dados com otimização...');
        
        const loadingPromises = [];
        
        // Carregar funcionários
        loadingPromises.push(
            this.loadDataType('funcionarios').then(data => {
                const funcionariosArray = Array.isArray(data) ? data : Object.values(data || {});
                this.funcionarios = funcionariosArray.filter(func => func.ativo !== false);
                console.log(`👥 ${this.funcionarios.length} funcionários ativos carregados`);
            }).catch(error => {
                console.error('❌ Erro ao carregar funcionários:', error);
            })
        );
        
        // Carregar cargos
        loadingPromises.push(
            this.loadDataType('cargos').then(data => {
                this.cargos = Array.isArray(data) ? data : Object.values(data || {});
                console.log(`🏢 ${this.cargos.length} cargos carregados`);
            }).catch(error => {
                console.error('❌ Erro ao carregar cargos:', error);
            })
        );
        
        // Carregar folhas
        loadingPromises.push(
            this.loadDataType('folhas').then(data => {
                this.folhas = Array.isArray(data) ? data : Object.values(data || {});
                console.log(`💰 ${this.folhas.length} folhas carregadas`);
            }).catch(error => {
                console.error('❌ Erro ao carregar folhas:', error);
            })
        );
        
        // Aguardar todos os carregamentos
        await Promise.allSettled(loadingPromises);
        this._initialDataLoaded = true;
        
        console.log('✅ Todos os dados carregados com otimização');

        // 🔗 Reconciliar folhas com funcionários para garantir nomes/cargos e IDs consistentes
        try { this.reconcileFolhasWithFuncionarios(); } catch (e) { console.warn('⚠️ Falha ao reconciliar folhas/funcionários:', e); }

        // 📣 Notificar que os dados estão prontos para renderização (enviar ARRAYS)
        try {
            window.dispatchEvent(new CustomEvent('folhaDataReady', {
                detail: { folhas: (this.folhas || []), funcionarios: (this.funcionarios || []) }
            }));
        } catch (e) { console.warn('⚠️ Falha ao emitir folhaDataReady:', e); }
        try { this.fixMissingRowIds(); } catch(e) {}
        
        // REMOVIDO: Chamada inicial para updateFolhasTable - deixar filtros gerenciarem a renderização inicial para evitar duplicações
        
        // Configurar event listeners
        this.setupEventListeners();

    }
    /**
     * 🔗 Reconciliar folhas com funcionários (garantir nome/cargo e IDs consistentes)
     */
    reconcileFolhasWithFuncionarios() {
        try {
            const funcs = Array.isArray(this.funcionarios) ? this.funcionarios : [];
            const folhas = Array.isArray(this.folhas) ? this.folhas : [];
            if (folhas.length === 0) return;
            const monthMap = {
                'janeiro':'01','fevereiro':'02','marco':'03','março':'03','abril':'04','maio':'05','junho':'06',
                'julho':'07','agosto':'08','setembro':'09','outubro':'10','novembro':'11','dezembro':'12'
            };
            const resolveMesAno = (f) => {
                const raw = String(f.mesAno || '').trim();
                if (/^\d{4}-\d{2}$/.test(raw)) return raw;
                const m1 = raw.match(/^(\d{2})\/(\d{4})$/);
                if (m1) return `${m1[2]}-${m1[1]}`;
                if (f.ano && f.mes) {
                    const mnom = String(f.mes).toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'');
                    const mm = monthMap[mnom] || String(f.mes).padStart(2,'0');
                    return `${f.ano}-${mm}`;
                }
                if (f.dataProcessamento) {
                    const d = new Date(Number(f.dataProcessamento));
                    if (!isNaN(d.getTime())) return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}`;
                }
                return raw || '';
            };
            const byId = new Map(funcs.filter(f => f && f.id).map(f => [String(f.id), f]));
            this.folhas = folhas.map(f => {
                const idFolha = (f && (f.id || f.key || f.$key)) ? (f.id || f.key || f.$key) : undefined;
                const refId = (f && f.funcionario && f.funcionario.id) ? String(f.funcionario.id) : undefined;
                const ref = refId ? byId.get(refId) : undefined;
                
                // ✅ SEMPRE atualizar dados do funcionário com o cadastro mais recente
                if (ref) {
                    f.funcionario = {
                        ...(f.funcionario || {}),
                        ...ref, // Sobrescreve com dados atualizados (nome, cargo, salário, etc)
                        id: refId // Garante ID correto
                    };
                } else if (!f.funcionario || !f.funcionario.nome || !f.funcionario.cargo) {
                    // Fallback apenas se não achou referência e dados estão incompletos
                    f.funcionario = {
                        ...(f.funcionario || {}),
                        ...(ref || {})
                    };
                }
                // Garantir id presente e consistente
                f.id = idFolha || f.id;
                // Garantir mesAno normalizado (YYYY-MM) para filtros e botões
                try {
                    const norm = resolveMesAno(f);
                    if (norm) f.mesAno = norm;
                } catch(e){ console.warn('⚠️ Falha ao normalizar mesAno da folha:', f && f.id, e); }
                return f;
            });
            const normStr = (s) => { try { return String(s||'').toLowerCase().trim().normalize('NFD').replace(/[^a-z0-9\s]/g,'').replace(/\s+/g,' '); } catch { return ''; } };
            const resolveTipo = (f) => { const raw = String((f.tipoPagamento||f.tipo||'mes')).toLowerCase(); return raw.includes('quinz') ? 'quinzena' : 'mes'; };
            const keyOf = (f) => {
                const idRef = (f && f.funcionario && f.funcionario.id) ? String(f.funcionario.id) : '';
                const nmRef = (f && f.funcionario && f.funcionario.nome) ? normStr(f.funcionario.nome) : '';
                const fk = idRef || nmRef;
                const mes = String(f.mesAno || '').trim();
                const tipo = resolveTipo(f);
                return `${fk}|${mes}|${tipo}`;
            };
            const score = (x) => {
                const t = new Date(x.updatedAt || x.dataAtualizacao || x.dataCriacao || 0).getTime() || 0;
                const c = x.calculos ? 1 : 0;
                const i = x.id ? 1 : 0;
                return (t*10) + (c*2) + i;
            };
            const map = new Map();
            for (const f of this.folhas) {
                const k = keyOf(f);
                if (!k.trim()) continue;
                const prev = map.get(k);
                if (!prev) { map.set(k, f); continue; }
                const keep = (score(prev) >= score(f)) ? prev : f;
                map.set(k, keep);
            }
            this.folhas = Array.from(map.values());
            console.log(`🔗 Reconciliadas ${this.folhas.length} folhas com ${funcs.length} funcionários`);
        } catch (e) {
            console.warn('⚠️ Erro em reconcileFolhasWithFuncionarios:', e);
        }
    }
    async waitForPaginacao() {
        return new Promise(resolve => {
            const check = () => {
                if (window.folhaPaginacao) {
                    console.log('✅ Paginação disponível, prosseguindo com renderização');
                    resolve();
                } else {
                    console.log('⏳ Aguardando paginação...');
                    setTimeout(check, 100);
                }
            };
            check();
        });
    }

    /**
     * 🔄 Migração segura de dados para o caminho canônico 'folhas'
     */
    async runFolhasMigrationIfNeeded() {
        try {
            // Garantir dependências
            const canMigrate = !!window.database && !!window.FolhaMigracaoCaminhos;
            if (!canMigrate) {
                console.log('ℹ️ Migração não disponível (database ou módulo indisponível)');
                return;
            }
            const alreadyDone = localStorage.getItem('folha_migration_done_v1') === '1';

            // Verificar divergências
            const diver = await window.FolhaMigracaoCaminhos.verificarDivergencias();
            if (!diver || !Array.isArray(diver.onlyLegacy)) {
                console.log('ℹ️ Estrutura de divergências inválida, abortando migração');
                return;
            }

            if (diver.onlyLegacy.length === 0) {
                console.log('✅ Nenhum item apenas no legado. Nada a migrar.');
                return;
            }
            if (alreadyDone) {
                console.log('ℹ️ Migração já executada anteriormente. Itens no legado serão preservados.');
                return;
            }

            // Avisar início
            try { window.FolhaUtils && window.FolhaUtils.showToast && window.FolhaUtils.showToast(`Migrando ${diver.onlyLegacy.length} folha(s) do legado...`, 'info', 3500); } catch {}
            console.log(`🚚 Iniciando migração de ${diver.onlyLegacy.length} item(ns) do legado para canônico...`);

            // Executar migração real
            const res = await window.FolhaMigracaoCaminhos.migrarLegadoParaCanonico({ dryRun: false });
            console.log('✅ Migração concluída:', res);
            try { window.FolhaUtils && window.FolhaUtils.showToast && window.FolhaUtils.showToast('Migração concluída com sucesso!', 'success', 3500); } catch {}
            try { persistLocalValue('folha_migration_done_v1', '1'); } catch {}

            // Recarregar dados canônicos frescos
            try {
                const manager = (window.getFirebaseManager && window.getFirebaseManager()) || window.firebaseManager || null;
                if (manager && typeof manager.loadData === 'function') {
                    const fresh = await manager.loadData('folhas', { useCache: false, forceRefresh: true });
                    const arr = Object.entries(fresh || {}).map(([id, v]) => ({ id, ...(v||{}) }));
                    this.folhas = arr;
                    console.log(`📦 Dados canônicos recarregados pós-migração: ${arr.length} folhas`);
                }
            } catch (e) { console.warn('⚠️ Falha ao recarregar dados canônicos após migração:', e); }

            // Reconciliar e notificar
            try { this.reconcileFolhasWithFuncionarios(); } catch {}
            try { document.dispatchEvent(new CustomEvent('folhaDataReady', { detail: { folhas: (this.folhas||[]), funcionarios: (this.funcionarios||[]) } })); } catch {}
            try { window.folhaFiltros && window.folhaFiltros.aplicarFiltros && window.folhaFiltros.aplicarFiltros(); } catch {}
        } catch (e) {
            console.error('❌ Erro na migração de caminhos:', e);
            try { window.FolhaUtils && window.FolhaUtils.showToast && window.FolhaUtils.showToast('Erro na migração de caminhos', 'error', 4000); } catch {}
        }
    }
    
    /**
     * 📊 Carregar tipo específico de dados
     */
    async loadDataType(dataType) {
        console.log(`🔄 Carregando dados do tipo: ${dataType}`);
        
        try {
            if (typeof getData !== 'function') {
                console.error('❌ Função getData não disponível');
                return {};
            }
            // ✅ CORREÇÃO: Para 'folhas', usar caminho canônico
            if (dataType === 'folhas') {
                let rawFolhas = await getData('folhas', { useCache: false, debounceMs: 200 });
                let arr = [];
                if (Array.isArray(rawFolhas)) {
                    arr = rawFolhas.map((val) => ({
                        ...(val || {}),
                        id: (val && (val.id || val.key || val.$key)) || undefined
                    }));
                } else {
                    arr = Object.entries(rawFolhas || {}).map(([id, val]) => ({ ...(val || {}), id }));
                }
                const normalized = (window.FolhaUtils && typeof window.FolhaUtils.normalizarLancamentos === 'function')
                    ? window.FolhaUtils.normalizarLancamentos(arr)
                    : arr.filter(f => f && String(f.id || '').trim());
                console.log(`📊 ${normalized.length} folhas normalizadas`);
                return normalized;
            }

            const raw = await getData(dataType, {
                useCache: false,
                debounceMs: 200
            });
            return raw;
            
        } catch (error) {
            console.error(`❌ Erro ao carregar ${dataType}:`, error);
            return {};
        }
    }

    /**
     * 🔄 Recarregar dados específicos
     */
    async reloadSpecificData(dataType) {
        console.log(`🔄 Recarregando dados específicos: ${dataType}`);
        
        try {
            const data = await this.loadDataType(dataType);
            
            switch (dataType) {
                case 'funcionarios': {
                    const funcionariosArray = Array.isArray(data) ? data : Object.values(data || {});
                    this.funcionarios = funcionariosArray.filter(func => func.ativo !== false);
                    console.log(`👥 ${this.funcionarios.length} funcionários ativos recarregados`);
                    break;
                }
                case 'cargos': {
                    this.cargos = Array.isArray(data) ? data : Object.values(data || {});
                    console.log(`🏢 ${this.cargos.length} cargos recarregados`);
                    break;
                }
                case 'folhas': {
                    this.folhas = Array.isArray(data) ? data : Object.values(data || {});
                    console.log(`💰 ${this.folhas.length} folhas recarregadas`);
                    break;
                }
                default:
                    console.warn(`⚠️ Tipo de dados desconhecido: ${dataType}`);
                    return;
            }
            
            console.log(`✅ Dados ${dataType} recarregados com sucesso`);
            if (dataType === 'funcionarios' || dataType === 'folhas') {
                try { this.reconcileFolhasWithFuncionarios(); } catch (e) { console.warn('⚠️ Falha ao reconciliar após reload:', e); }
                try {
                    window.dispatchEvent(new CustomEvent('folhaDataReady', {
                        detail: { folhas: (this.folhas || []), funcionarios: (this.funcionarios || []) }
                    }));
                } catch (e) { console.warn('⚠️ Falha ao emitir folhaDataReady após reload:', e); }
            }
            // Intencionalmente não chamamos updateInterface aqui para evitar loops.
        } catch (error) {
            console.error(`❌ Erro ao recarregar ${dataType}:`, error);
        }
    }

    /**
     * 📡 Configurar listener em tempo real para 'folhas' (sincronização entre PCs)
     */
    setupRealtimeFolhas() {
        if (this._realtimeFolhasBound) {
            console.log('ℹ️ Listener realtime de folhas já configurado');
            return;
        }
        this._realtimeFolhasBound = true;
        try {
            if (typeof window.setupFolhaRealtimeListener === 'function') {
                console.log('📡 Ativando listener realtime via FolhaFirebaseService');
                window.setupFolhaRealtimeListener('folhas', (data) => {
                    try {
                        const arr = Array.isArray(data) ? data : Object.entries(data || {}).map(([id, val]) => ({ id, ...(val||{}) }));
                        this.folhas = arr;
                        console.log(`📡 Realtime: ${arr.length} folhas recebidas`);
                        // Reconciliar com funcionários quando disponíveis
                        try { this.reconcileFolhasWithFuncionarios(); } catch {}
                        // Notificar módulos
                        try { window.dispatchEvent(new CustomEvent('folhaDataReady', { detail: { folhas: (this.folhas||[]), funcionarios: (this.funcionarios||[]) } })); } catch {}
                        // Reaplicar filtros
                        try { window.folhaFiltros && window.folhaFiltros.aplicarFiltros && window.folhaFiltros.aplicarFiltros(); } catch {}
                    } catch (e) { console.warn('⚠️ Falha no callback realtime folhas:', e); }
                }, { useCache: false });
                return;
            }
        } catch (e) {
            console.warn('⚠️ Falha ao configurar listener via FolhaFirebaseService:', e);
        }
        // Fallback direto RTDB
        try {
            if (window.database) {
                console.log('📡 Ativando listener realtime direto no RTDB');
                (async () => {
                    const { ref, onValue } = await import('https://www.gstatic.com/firebasejs/10.7.1/firebase-database.js');
                    const resolvePath = (p) => {
                        try {
                            if (window.FolhaUtils && typeof window.FolhaUtils.resolveFirebasePath === 'function') {
                                return window.FolhaUtils.resolveFirebasePath(p);
                            }
                            const base = String(p || '');
                            if (!base) return base;
                            if (/^companies(\/|$)/.test(base) || /^users(\/|$)/.test(base)) return base;
                            const svc = window.firebaseService || window.firebaseServiceTL || window.FirebaseService;
                            if (svc && typeof svc.getNamespacedPath === 'function') {
                                return svc.getNamespacedPath(base);
                            }
                            const rawTenant = window.appTenantId || (window.companyInfo && (window.companyInfo.companyId || window.companyInfo.companyID || window.companyInfo.tenantId || window.companyInfo.id));
                            if (rawTenant) return `companies/${String(rawTenant)}/${base}`;
                            const stored = localStorage.getItem('company_info');
                            if (stored) {
                                const obj = JSON.parse(stored);
                                const t = obj && (obj.companyId || obj.companyID || obj.tenantId || obj.id);
                                if (t) return `companies/${String(t)}/${base}`;
                            }
                        } catch {}
                        return p;
                    };
                    onValue(ref(window.database, resolvePath('folhas')), (snapshot) => {
                        const val = snapshot.val() || {};
                const arr = Object.entries(val).map(([id, v]) => ({ ...(v || {}), id }));
                this.folhas = arr;
                        console.log(`📡 Realtime (RTDB): ${arr.length} folhas recebidas`);
                        try { this.reconcileFolhasWithFuncionarios(); } catch {}
                        try { window.dispatchEvent(new CustomEvent('folhaDataReady', { detail: { folhas: (this.folhas||[]), funcionarios: (this.funcionarios||[]) } })); } catch {}
                        try { window.folhaFiltros && window.folhaFiltros.aplicarFiltros && window.folhaFiltros.aplicarFiltros(); } catch {}
                    }, (error) => {
                        console.error('❌ Erro no listener RTDB de folhas:', error);
                    });
                })();
            } else {
                console.warn('⚠️ RTDB indisponível para configurar realtime');
            }
        } catch (e) {
            console.error('❌ Erro ao configurar listener realtime de folhas:', e);
        }
    }
    
    /**
     * 🔄 Aplicar filtros com dados frescos
     */
    async aplicarFiltrosComDadosFrescos() {
        console.log('🔍 Aplicando filtros com dados frescos:', this.filtros);
        
        if (!window.FolhaUtils) {
            console.warn('⚠️ FolhaUtils não disponível para aplicar filtros');
            return;
        }
        
        // CORREÇÃO: Não recarregar dados aqui para evitar loop infinito
        // Usar dados já carregados em this.folhas
        if (window.__folhaDebug) console.log(`📊 Usando dados já carregados: ${this.folhas.length} folhas`);
        
        let folhasFiltradas = [...this.folhas];
        // Helper: normalizar mesAno tanto "YYYY-MM" quanto "MM/YYYY"
        const normalizeMes = (val) => {
            if (window.FolhaUtils && typeof window.FolhaUtils.normalizeMesAno === 'function') {
                return window.FolhaUtils.normalizeMesAno(val);
            }
            if (!val) return '';
            const s = String(val).trim();
            if (/^\d{4}-\d{2}$/.test(s)) return s;
            const m = s.match(/^(\d{2})\/(\d{4})$/);
            if (m) return `${m[2]}-${m[1]}`;
            const m2 = s.match(/^(\d{4})[\/-](\d{2})$/);
            if (m2) return `${m2[1]}-${m2[2]}`;
            const m3 = s.match(/^(\d{2})(\d{4})$/);
            if (m3) return `${m3[2]}-${m3[1]}`;
            return s;
        };
        
        // Aplicar filtros ativos
        const filtrosParaAplicar = (window.folhaFiltros && window.folhaFiltros.filtrosAtivos) ? 
            window.folhaFiltros.filtrosAtivos : this.filtros;
        
        // Filtrar por mês/ano
        if (filtrosParaAplicar.mesAno) {
            const alvo = normalizeMes(filtrosParaAplicar.mesAno);
            folhasFiltradas = folhasFiltradas.filter(folha => normalizeMes(folha.mesAno) === alvo);
        }
        
        // Filtrar por tipo
        if (filtrosParaAplicar.tipoFolha) {
            folhasFiltradas = folhasFiltradas.filter(folha => 
                folha.tipo === filtrosParaAplicar.tipoFolha
            );
        }
        
        // Filtrar por funcionário
        if (filtrosParaAplicar.funcionarioId) {
            const alvoId = String(filtrosParaAplicar.funcionarioId);
            folhasFiltradas = folhasFiltradas.filter(folha => {
                const idA = folha && folha.funcionario && folha.funcionario.id ? String(folha.funcionario.id) : '';
                const idB = folha && folha.funcionarioId ? String(folha.funcionarioId) : '';
                return (idA && idA === alvoId) || (idB && idB === alvoId);
            });
        } else if (filtrosParaAplicar.funcionario) {
            const filtroLower = filtrosParaAplicar.funcionario.toLowerCase();
            folhasFiltradas = folhasFiltradas.filter(folha => 
                (folha && folha.funcionario && folha.funcionario.nome && folha.funcionario.nome.toLowerCase().includes(filtroLower))
            );
        }
        
        // Incluir 'mes_fechado' por padrão (quando Tipo = "Todos")
        const finalLancamentos = folhasFiltradas;
        
        // Manter o Mês/Ano escolhido pelo usuário mesmo quando ainda não há dados para ele.
        // A seleção fica persistida até o usuário decidir alterar.
        if (filtrosParaAplicar.mesAno && finalLancamentos.length === 0 && this.folhas.length > 0) {
            const alvo = normalizeMes(filtrosParaAplicar.mesAno);
            const existe = this.folhas.some(f => normalizeMes(f.mesAno) === alvo);
            if (!existe) {
                if (window.__folhaDebug) console.log('ℹ️ Filtro de mês sem dados. Mantendo seleção persistida:', filtrosParaAplicar.mesAno);
            } else {
                if (window.__folhaDebug) console.log('ℹ️ Filtro de mês existe, mantendo seleção do usuário');
            }
        }
        const finalLancamentos2 = folhasFiltradas;
        if (window.__folhaDebug) console.log(`📊 Atualizando tabela com ${finalLancamentos2.length} folhas filtradas`);
        
        // Renderizar tabela
        try { 
            const rc = (window.folhaPaginacao && window.folhaPaginacao.itensPorPagina) ? window.folhaPaginacao.itensPorPagina : 5;
            window.FolhaUtils && window.FolhaUtils.showTablePreload && window.FolhaUtils.showTablePreload(rc); 
        } catch(e) {}
            if (window.folhaPaginacao && typeof window.folhaPaginacao.aplicarFiltrosComPaginacao === 'function') {
            window.folhaPaginacao.aplicarFiltrosComPaginacao(finalLancamentos2);
                // ✅ CORREÇÃO: Só atualizar totais se não há sistema de filtros ativo
                if (!this.hasFiltrosAtivos()) {
                    if (window.__folhaDebug) console.log('📊 Atualizando totais após filtros com paginação - sem filtros ativos');
                    this.atualizarTotais(finalLancamentos2);
                } else {
                    if (window.__folhaDebug) console.log('📊 Filtros ativos - deixando sistema de filtros gerenciar totais (paginação)');
                }
                try { this.setupActionDelegates(); this.fixMissingRowIds(); } catch(e) { console.warn('⚠️ Falha ao configurar delegação/correção após paginação:', e); }
            } else {
                this.updateFolhasTable(finalLancamentos2);
        }
        
        if (window.__folhaDebug) console.log('✅ Filtros com dados frescos aplicados com sucesso');
    }
    
    /**
     * 📋 Atualizar tabela de folhas
     */
    updateFolhasTable(folhas) {
        if (this.debounceTimer) {
            clearTimeout(this.debounceTimer);
        }
        this.debounceTimer = setTimeout(() => {
            console.log(`📊 Atualizando tabela com ${folhas.length} folhas`);
            
            if (!folhas || folhas.length === 0) {
                console.warn('⚠️ Nenhuma folha fornecida para atualizar tabela');
                return;
            }
            
            // Integrar paginação quando disponível
            if (window.folhaPaginacao && typeof window.folhaPaginacao.aplicarFiltrosComPaginacao === 'function') {
                console.log('📄 Usando sistema de paginação para renderizar tabela');
                window.folhaPaginacao.aplicarFiltrosComPaginacao(folhas);
                // ✅ CORREÇÃO: Só atualizar totais se não há sistema de filtros ativo
                if (!this.hasFiltrosAtivos()) {
                    console.log('📊 Atualizando totais - sem filtros ativos');
                    this.atualizarTotais(folhas);
                } else {
                    console.log('📊 Filtros ativos - deixando sistema de filtros gerenciar totais');
                }
                return;
            }
            
            // Verificar se função unificada está disponível
            console.log('🔍 Verificando disponibilidade de FolhaUtils.renderizarTabelaLancamentos...');
            
            if (window.FolhaUtils && typeof window.FolhaUtils.renderizarTabelaLancamentos === 'function') {
                console.log('✅ Chamando FolhaUtils.renderizarTabelaLancamentos...');
                try {
                // ✅ Evitar render duplicado quando filtros estão ativos
                if (this.hasFiltrosAtivos()) {
                    console.log('📊 Filtros ativos - evitando renderização duplicada da tabela pelo main');
                    return;
                }
                try {
                    const rc = (window.folhaPaginacao && window.folhaPaginacao.itensPorPagina) ? window.folhaPaginacao.itensPorPagina : 5;
                    const tbody = document.getElementById('folhasTableBody');
                    const isEmpty = !tbody || tbody.querySelectorAll('tr').length === 0;
                    if (isEmpty) {
                        window.FolhaUtils && window.FolhaUtils.showTablePreload && window.FolhaUtils.showTablePreload(rc);
                    }
                } catch(e) {}
                window.FolhaUtils.renderizarTabelaLancamentos(folhas, {
                    mensagemVazia: 'Nenhuma folha encontrada com os filtros aplicados'
                });
                    console.log('✅ FolhaUtils.renderizarTabelaLancamentos executado com sucesso');
                    try { this.setupActionDelegates(); this.fixMissingRowIds(); } catch(e) { console.warn('⚠️ Falha ao configurar delegação/correção após render unificada:', e); }
                    // ✅ CORREÇÃO: Só atualizar totais se não há sistema de filtros ativo
                    if (!this.hasFiltrosAtivos()) {
                        console.log('📊 Atualizando totais - sem filtros ativos');
                        this.atualizarTotais(folhas);
                    } else {
                        console.log('📊 Filtros ativos - deixando sistema de filtros gerenciar totais');
                    }
                } catch (error) {
                    console.error('❌ Erro ao executar FolhaUtils.renderizarTabelaLancamentos:', error);
                    this.updateFolhasTableFallback(folhas);
                }
            } else {
                console.warn('⚠️ FolhaUtils.renderizarTabelaLancamentos não disponível, usando fallback');
                this.updateFolhasTableFallback(folhas);
            }
        }, 150);
    }

    /**
     * 📋 FALLBACK: Renderização original da tabela
     */
    updateFolhasTableFallback(folhas) {
        console.log('🔄 Iniciando updateFolhasTableFallback...');
        
        const tbody = document.getElementById('folhasTableBody');
        if (!tbody) {
            console.warn('❌ Elemento folhasTableBody não encontrado');
            console.log('🔍 Elementos disponíveis com folhas:', document.querySelectorAll('[id*="folhas"]'));
            console.log('🔍 Elementos disponíveis com table:', document.querySelectorAll('[id*="table"]'));
            return;
        }
        
        console.log(`📊 Usando fallback para ${folhas.length} folhas`);
        
        // Filtrar funcionários inativos
        const folhasFiltradas = folhas.filter(folha => {
            if (folha.funcionario && folha.funcionario.id) {
                const funcionarioAtual = this.funcionarios.find(f => f.id === folha.funcionario.id);
                if (funcionarioAtual && funcionarioAtual.ativo === false) {
                    return false;
                }
                if (folha.funcionario.ativo === false) {
                    return false;
                }
            }
            return true;
        });
        
        if (folhasFiltradas.length === 0) {
            tbody.innerHTML = `
                <tr>
                    <td colspan="12" style="text-align: center; padding: 20px; color: #666;">
                        <i class="fas fa-inbox" style="font-size: 24px; margin-bottom: 10px; display: block;"></i>
                        Nenhuma folha encontrada com os filtros aplicados
                    </td>
                </tr>
            `;
            try { window.FolhaUtils && window.FolhaUtils.applyFolhasColumnsConfig && window.FolhaUtils.applyFolhasColumnsConfig(); } catch(e) {}
            try { window.FolhaUtils && window.FolhaUtils.hideTablePreload && window.FolhaUtils.hideTablePreload(); } catch(e) {}
            return;
        }
        
        const folhasOrdenadas = (window.FolhaUtils && typeof window.FolhaUtils.aplicarOrdenacaoTabelaFolhas === 'function')
            ? window.FolhaUtils.aplicarOrdenacaoTabelaFolhas(folhasFiltradas)
            : folhasFiltradas.slice();

        // Gerar HTML da tabela
        const htmlContent = folhasOrdenadas.map(folha => {
            const id = folha.id || folha.key || folha.recordId || '';
            const tipoPagamento = (window.FolhaUtils && typeof window.FolhaUtils.resolveTipoPagamento === 'function')
                ? window.FolhaUtils.resolveTipoPagamento(folha)
                : (String((folha && (folha.tipoPagamento || folha.tipo || folha.tipoFolha)) || 'mes').toLowerCase().includes('quinz') ? 'quinzena' : 'mes');
            const isQuinzena = tipoPagamento === 'quinzena';
            const statusNorm = String((window.FolhaUtils && typeof window.FolhaUtils.normalizarStatus === 'function')
                ? window.FolhaUtils.normalizarStatus(folha && folha.status)
                : ((folha && folha.status) || '')).toLowerCase().normalize('NFD').replace(/[^a-z_]/g,'');
            const tipoLabel = isQuinzena
                ? (statusNorm === 'quinzena_paga' ? '1° Quinzena Paga' : (statusNorm === 'mes_fechado' ? '2° Quinzena Paga' : '1° Quinzena'))
                : (statusNorm === 'mes_fechado' ? 'Mês Fechado Pago' : 'Mês Fechado');
            const fmt = (v) => {
                try { return window.FolhaUtils && typeof window.FolhaUtils.formatarMoeda === 'function' ? window.FolhaUtils.formatarMoeda(Number(v||0)) : Number(v||0).toLocaleString('pt-BR',{style:'currency',currency:'BRL'}); } catch { return `R$ ${Number(v||0).toFixed(2)}`; }
            };
            const base = (window.FolhaUtils && window.FolhaUtils.getSalarioBaseDisplay) ? window.FolhaUtils.getSalarioBaseDisplay(folha) : (((folha && folha.calculos && folha.calculos.salarioBase) || folha.salarioBase || 0));
            const qz = (window.FolhaUtils && window.FolhaUtils.calcularValorQuinzena) ? window.FolhaUtils.calcularValorQuinzena(folha) : 0;
            const acres = (window.FolhaUtils && window.FolhaUtils.calcularAcrescimosDisplay) ? window.FolhaUtils.calcularAcrescimosDisplay(folha) : 0;
            const desc = (window.FolhaUtils && window.FolhaUtils.calcularDescontosDisplay) ? window.FolhaUtils.calcularDescontosDisplay(folha) : 0;
            const liq = (window.FolhaUtils && window.FolhaUtils.calcularSalarioLiquidoDisplay) ? window.FolhaUtils.calcularSalarioLiquidoDisplay(folha) : (isQuinzena ? (Number(base||0) + Number(acres||0) - Number(desc||0) - Number(qz||0)) : (Number(base||0) + Number(acres||0) - Number(desc||0)));
            const saldoLiq = (window.FolhaUtils && typeof window.FolhaUtils.calcularSaldoLiquidoEmAberto === 'function') ? window.FolhaUtils.calcularSaldoLiquidoEmAberto(folha) : (statusNorm === 'mes_fechado' ? 0 : liq);
            const valorPago = (window.FolhaUtils && typeof window.FolhaUtils.calcularValorPagoLancamento === 'function') ? window.FolhaUtils.calcularValorPagoLancamento(folha) : (statusNorm === 'mes_fechado' ? liq : 0);
            const valorPix = (window.FolhaUtils && typeof window.FolhaUtils.calcularValorPixLancamento === 'function') ? window.FolhaUtils.calcularValorPixLancamento(folha) : saldoLiq;
            const pixQuitado = (window.FolhaUtils && typeof window.FolhaUtils.isPixLancamentoQuitado === 'function') ? window.FolhaUtils.isPixLancamentoQuitado(folha) : (valorPago > 0 && Math.abs(saldoLiq) < 0.005);
            const liquidoTabelaHtml = (window.FolhaUtils && typeof window.FolhaUtils.formatarLiquidoLancamentoTabela === 'function')
                ? window.FolhaUtils.formatarLiquidoLancamentoTabela(folha, { valorHistorico: liq, saldoAberto: saldoLiq, valorPago })
                : fmt(saldoLiq);
            const totalVales = (window.FolhaUtils && typeof window.FolhaUtils.calcularTotalVales === 'function') ? window.FolhaUtils.calcularTotalVales(folha) : (folha.vales || 0);
            const funcionarioLanc = (folha && folha.funcionario) || {};
            const funcionarioCadastro = (this.funcionarios || []).find(f => String((f && f.id) || '') === String((funcionarioLanc && funcionarioLanc.id) || folha.funcionarioId || folha.idFuncionario || folha.func_id || '')) || {};
            const funcionarioDetalhado = { ...funcionarioCadastro, ...funcionarioLanc };
            const isMesFechadoPago = (window.FolhaUtils && typeof window.FolhaUtils.isLancamentoMesFechadoPago === 'function')
                ? window.FolhaUtils.isLancamentoMesFechadoPago(folha, tipoPagamento, statusNorm)
                : (!isQuinzena && statusNorm === 'mes_fechado');
            const acoesLancamentoHtml = (window.FolhaUtils && typeof window.FolhaUtils.renderizarAcoesLancamento === 'function')
                ? window.FolhaUtils.renderizarAcoesLancamento(folha, '', { tipoPagamento, statusNorm })
                : `
                    <button class="action-button edit-button" title="Editar" data-id="${id}" onclick="__onEditFolhaButtonClick('${id}')">
                        <i class="fas fa-edit"></i>
                    </button>
                    <button class="action-button print-button" title="Imprimir" data-id="${id}" onclick="printFolha('${id}')">
                        <i class="fas fa-print"></i>
                    </button>
                    <button class="action-button delete-button" title="Excluir" data-id="${id}" onclick="deleteFolha('${id}')">
                        <i class="fas fa-trash"></i>
                    </button>
                `;
            
            return `
            <tr data-id="${id}">
                <td data-label="Funcionário">
                    <strong>${(folha && folha.funcionario && folha.funcionario.nome) || 'N/A'}</strong>
                    <div style="font-size: 11px; color: #666;">${(folha && folha.funcionario && folha.funcionario.cargo) || ''}</div>
                </td>
                <td data-label="Forma Pgto." style="font-size: 12px;">${(window.FolhaUtils && typeof window.FolhaUtils.formatarFormaPagamentoLancamento === 'function')
                    ? window.FolhaUtils.formatarFormaPagamentoLancamento(funcionarioDetalhado, {
                        id,
                        nomeFuncionario: (folha && folha.funcionario && folha.funcionario.nome) || '',
                        liquido: valorPix,
                        liquidoFormatado: fmt(valorPix),
                        valorPago,
                        valorPagoFormatado: fmt(valorPago),
                        pagamentoQuitado: pixQuitado
                    })
                    : ((folha && folha.funcionario && folha.funcionario.formaPagamento) || '-')}</td>
                <td data-label="Mês/Ano">${folha.mesAno || 'N/A'}</td>
                <td data-label="Tipo">
                    <span class="badge-status" style="background-color: ${isQuinzena ? '#17a2b8' : '#28a745'}">
                        ${tipoLabel}
                    </span>
                </td>
                <td data-label="%">${isQuinzena ? (Number(folha.percentualQuinzena || folha.quinzenaPercentual || 50)) + '%' : '100%'}</td>
                <td data-label="Salário Base">${fmt(base)}</td>
                <td data-label="1ª Quinzena">${fmt(qz)}</td>
                <td data-label="Acréscimos">${fmt(acres)}</td>
                <td data-label="Descontos">${fmt(desc)}</td>
                <td data-label="Total Vales">${fmt(totalVales)}</td>
                <td data-label="Líquido" class="valor-destaque liquido-cell">${liquidoTabelaHtml}</td>
                <td data-label="Ações" class="actions-cell${isMesFechadoPago ? ' paid-actions-cell' : ''}">
                    ${acoesLancamentoHtml}
                </td>
            </tr>
            `;
        }).join('');
        
        try {
            tbody.innerHTML = htmlContent;
            try { window.FolhaUtils && window.FolhaUtils.applyFolhasColumnsConfig && window.FolhaUtils.applyFolhasColumnsConfig(); } catch(e) {}
            console.log(`✅ Tabela atualizada com ${folhasOrdenadas.length} linhas (fallback)`);
            try { this.setupActionDelegates(); } catch(e) { console.warn('⚠️ Falha ao configurar delegação após fallback:', e); }
            try { this.fixMissingRowIds(); } catch(e) {}
            
            // ✅ CORREÇÃO: Só atualizar totais se não há sistema de filtros ativo
            if (!this.hasFiltrosAtivos()) {
                console.log('📊 Atualizando totais (fallback) - sem filtros ativos');
                this.atualizarTotais(folhasOrdenadas);
            } else {
                console.log('📊 Filtros ativos - deixando sistema de filtros gerenciar totais (fallback)');
            }
            try { window.FolhaUtils && window.FolhaUtils.hideTablePreload && window.FolhaUtils.hideTablePreload(); } catch(e) {}
        } catch (error) {
            console.error('❌ Erro ao aplicar HTML na tabela:', error);
            try { window.FolhaUtils && window.FolhaUtils.hideTablePreload && window.FolhaUtils.hideTablePreload(); } catch(e) {}
        }
    }

    /**
     * 📊 NOTIFICAR DASHBOARD SOBRE ATUALIZAÇÕES DA FOLHA
     */
    notifyDashboardUpdate() {
        try {
            const sig = (window.FolhaUtils && typeof window.FolhaUtils.getDataSignature === 'function')
                ? window.FolhaUtils.getDataSignature(this.folhas || [])
                : String((this.folhas && this.folhas.length) || 0);
            const logDash = (window.FolhaUtils && typeof window.FolhaUtils.shouldLogDataChange === 'function')
                ? window.FolhaUtils.shouldLogDataChange('folhaMain.dashboard', sig)
                : !!window.__folhaDebug;
            if (logDash) console.log('📊 Notificando dashboard sobre atualizações da folha...');
            
            // Disparar evento para o dashboard
            const event = new CustomEvent('folhaDataChanged', {
                detail: {
                    dataTypes: ['folha', 'lancamentos'],
                    timestamp: new Date().toISOString(),
                    source: 'folha-main',
                    data: {
                        lancamentos: this.folhas || [],
                        funcionarios: ((window.folhaFuncionarios && window.folhaFuncionarios.funcionarios) || [])
                    }
                }
            });
            
            window.dispatchEvent(event);
            if (logDash) console.log('✅ Evento folhaDataChanged disparado para o dashboard');
        } catch (error) {
            console.error('❌ Erro ao notificar dashboard:', error);
        }
    }

    /**
     * 🔧 Configurar event listeners
     */
    setupEventListeners() {
        // Configurar listeners para atualização de dados
        if (!this._folhasUpdatedBound) {
            window.addEventListener('folhas:updated', (e) => {
                const src = e && e.detail && e.detail.source;
                const dataSig = (window.FolhaUtils && typeof window.FolhaUtils.getDataSignature === 'function')
                    ? window.FolhaUtils.getDataSignature((Array.isArray(window.pendingFolhasData) ? window.pendingFolhasData : this.folhas) || [])
                    : String((((Array.isArray(window.pendingFolhasData) ? window.pendingFolhasData : this.folhas) || []).length) || 0);
                const logFolhas = (window.FolhaUtils && typeof window.FolhaUtils.shouldLogDataChange === 'function')
                    ? window.FolhaUtils.shouldLogDataChange('folhaMain.folhasUpdated', `${src || ''}|${dataSig}`)
                    : !!window.__folhaDebug;
                if (logFolhas) console.log('📡 Evento folhas:updated recebido', { source: src });
                // Debounce para evitar múltiplos processamentos
                const now = Date.now();
                const fastSources = new Set(['createLancamento','updateLancamento','handleFolhaSubmit']);
                if (!fastSources.has(src) && this._lastFolhasEventAt && (now - this._lastFolhasEventAt) < 150) {
                    return;
                }
                this._lastFolhasEventAt = now;
                if (Array.isArray(window.pendingFolhasData)) {
                    this.folhas = [...window.pendingFolhasData];
                    window.pendingFolhasData = null;
                    // ✅ CORREÇÃO: Só atualizar totais se não há filtros ativos
                    if (!this.hasFiltrosAtivos()) {
                        if (logFolhas) console.log('📊 Atualizando totais após folhas:updated - sem filtros ativos');
                        this.atualizarTotais(this.folhas);
                    } else {
                        if (logFolhas) console.log('📊 Filtros ativos - dados atualizados, mas totais gerenciados pelo sistema de filtros');
                    }
                    
                    // ✅ NOTIFICAR DASHBOARD SOBRE MUDANÇAS NA FOLHA
                    this.notifyDashboardUpdate();
                    // ✅ Solicitar aplicação de filtros com via rápida
                    try {
                        if (window.folhaFiltros && typeof window.folhaFiltros.aplicarFiltros === 'function') {
                            const delay = fastSources.has(src) ? 60 : 150;
                            setTimeout(() => window.folhaFiltros.aplicarFiltros(), delay);
                        }
                    } catch {}
                }
            });
            this._folhasUpdatedBound = true;
        }
        
        if (!this._funcionariosUpdatedBound) {
            window.addEventListener('funcionarios:updated', async (e) => {
                const sig = (window.FolhaUtils && typeof window.FolhaUtils.getDataSignature === 'function')
                    ? window.FolhaUtils.getDataSignature((window.folhaFuncionarios && window.folhaFuncionarios.funcionarios) || [])
                    : String((((window.folhaFuncionarios && window.folhaFuncionarios.funcionarios) || []).length) || 0);
                const logFunc = (window.FolhaUtils && typeof window.FolhaUtils.shouldLogDataChange === 'function')
                    ? window.FolhaUtils.shouldLogDataChange('folhaMain.funcionariosUpdated', sig)
                    : !!window.__folhaDebug;
                if (logFunc) console.log('📡 Evento funcionarios:updated recebido');
                
                // 1. Atualizar lista interna de funcionários
                if (e.detail && e.detail.funcionarioData) {
                    // Atualização incremental se possível
                    const updated = e.detail.funcionarioData;
                    const idx = this.funcionarios.findIndex(f => f.id === updated.id);
                    if (idx >= 0) {
                        this.funcionarios[idx] = { ...this.funcionarios[idx], ...updated };
                    } else {
                        this.funcionarios.push(updated);
                    }
                } else if (window.folhaFuncionarios && Array.isArray(window.folhaFuncionarios.funcionarios)) {
                    this.funcionarios = window.folhaFuncionarios.funcionarios;
                } else {
                    await this.reloadSpecificData('funcionarios');
                }

                // 2. Reconciliar folhas com novos dados de funcionário
                this.reconcileFolhasWithFuncionarios();

                // 3. Atualizar interface (tabela e totais)
                this.aplicarFiltrosComDadosFrescos();
            });
            this._funcionariosUpdatedBound = true;
        }
        
        // ✅ CORREÇÃO: Listener para coordenar totais com filtros
        if (!this._totaisFiltradosUpdatedBound) {
            window.addEventListener('totaisFiltradosAtualizados', (event) => {
                const dados = (event && event.detail && Array.isArray(event.detail.dadosFiltrados)) ? event.detail.dadosFiltrados : [];
                const sig = (window.FolhaUtils && typeof window.FolhaUtils.getDataSignature === 'function')
                    ? window.FolhaUtils.getDataSignature(dados)
                    : String((dados && dados.length) || 0);
                const logTotaisEvt = (window.FolhaUtils && typeof window.FolhaUtils.shouldLogDataChange === 'function')
                    ? window.FolhaUtils.shouldLogDataChange('folhaMain.totaisFiltradosEvt', sig)
                    : !!window.__folhaDebug;
                if (logTotaisEvt) console.log('📡 Evento totaisFiltradosAtualizados recebido - atualizando totais com base na tabela renderizada');
                if (dados.length === 0) {
                    if (logTotaisEvt) console.log('📊 Dados filtrados estão vazios - zerando totais');
                    this.zerarTotais();
                    return;
                }
                // Atualizar totais SEMPRE com base nos dados filtrados atuais
                this.atualizarTotais(dados);
            });
            this._totaisFiltradosUpdatedBound = true;
        }

        if (!this._tabelaRenderizadaBound) {
            window.addEventListener('tabelaFolhasRenderizada', (e) => {
                try {
                    const src = e && e.detail && e.detail.source;
                    const rows = e && e.detail && e.detail.rowCount;
                    const logTabela = (window.FolhaUtils && typeof window.FolhaUtils.shouldLogDataChange === 'function')
                        ? window.FolhaUtils.shouldLogDataChange('folhaMain.tabelaRender', `${src || ''}|${rows || 0}`)
                        : !!window.__folhaDebug;
                    if (logTabela) console.log('🧩 Evento tabelaFolhasRenderizada', { source: src, rows });
                    this.mostrarSecoesPrincipaisFolha();
                    this.setupActionDelegates();
                    this.fixMissingRowIds();
                } catch(err) { console.warn('⚠️ Falha ao tratar tabelaFolhasRenderizada:', err); }
            });
            this._tabelaRenderizadaBound = true;
        }
    }
    
    /**
     * 🔍 VERIFICAR SE HÁ FILTROS ATIVOS
     */
    hasFiltrosAtivos() {
        return window.folhaFiltros && Object.keys((window.folhaFiltros && window.folhaFiltros.filtrosAtivos) || {}).length > 0;
    }

    /**
     * 📊 ATUALIZAR TOTAIS NA INTERFACE
     */
    atualizarTotais(folhas) {
        const sig = (window.FolhaUtils && typeof window.FolhaUtils.getDataSignature === 'function')
            ? window.FolhaUtils.getDataSignature(folhas || [])
            : String((folhas && folhas.length) || 0);
        const logTotais = (window.FolhaUtils && typeof window.FolhaUtils.shouldLogDataChange === 'function')
            ? window.FolhaUtils.shouldLogDataChange('folhaMain.atualizarTotais', sig)
            : !!window.__folhaDebug;
        if (logTotais) console.log('📊 Atualizando totais com', ((folhas && folhas.length) || 0), 'folhas');
        
        if (!folhas || folhas.length === 0) {
            // Zerar totais se não há folhas
            this.zerarTotais();
            return;
        }
        
        // ✅ CORREÇÃO CRÍTICA: Filtrar EXATAMENTE como no relatório
        const folhasAtivas = folhas.filter(folha => {
            const isFuncionarioAtivo = ((folha && folha.funcionario && folha.funcionario.ativo) !== false);
            if (!isFuncionarioAtivo) {
                if (logTotais) console.log('🚫 Funcionário inativo excluído dos totais folha.html:', ((folha && folha.funcionario && folha.funcionario.nome) || ''));
            }
            return isFuncionarioAtivo;
        });
        const norm = (s) => {
            try { return String(s||'').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,''); } catch { return ''; }
        };
        const parseNum = (v) => {
            if (v == null || v === '') return NaN;
            if (typeof v === 'number') return v;
            const s = String(v).trim();
            if (!s) return NaN;
            const n1 = s.replace(/[^0-9,.-]/g, '');
            if (n1.includes(',')) {
                const f = parseFloat(n1.replace(/\./g, '').replace(/,/g, '.'));
                return isNaN(f) ? NaN : f;
            }
            const f = parseFloat(n1);
            return isNaN(f) ? NaN : f;
        };
        const resolveTipo = (l) => {
            if (window.FolhaUtils && typeof window.FolhaUtils.resolveTipoPagamento === 'function') {
                return window.FolhaUtils.resolveTipoPagamento(l);
            }
            return l.tipoPagamento || l.tipo || l.tipoFolha || '';
        };
        const keyOf = (l, idx) => {
            const id = (l && l.funcionario && l.funcionario.id) || l.funcionarioId || '';
            const nome = norm((l && l.funcionario && l.funcionario.nome) || '');
            const base = id || nome;
            const mes = String(l && l.mesAno || '');
            const tipo = String(resolveTipo(l) || '');
            if (base && mes) return `${base}|${mes}|${tipo}`;
            const rid = String(l && (l.id || l.key) || '');
            return rid ? `${rid}|${idx}` : `__idx_${idx}`;
        };
        const scoreOf = (l) => {
            const c = l && l.calculos ? l.calculos : {};
            const calc = (c && c.calculos) || c;
            const desconto = parseNum(l.totalDescontos ?? calc.totalDescontos ?? c.totalDescontos);
            const acres = parseNum(l.totalAcrescimos ?? calc.totalAcrescimos ?? c.totalAcrescimos);
            const liq = parseNum(l.salarioLiquido ?? l.salarioLiquidoFinal ?? l.valorLiquido ?? calc.salarioLiquido ?? c.salarioLiquido);
            const inss = parseNum(l.descontoINSSManual ?? calc.descontoINSSManual ?? c.descontoINSSManual ?? (calc.calculoINSS && calc.calculoINSS.valor) ?? (c.inss && c.inss.valor));
            const irrf = parseNum(l.descontoIRRFManual ?? calc.descontoIRRFManual ?? c.descontoIRRFManual ?? (calc.calculoIRRF && calc.calculoIRRF.valor) ?? (c.irrf && c.irrf.valor));
            let score = 0;
            if (Number.isFinite(desconto) && desconto > 0) score += 4;
            if (Number.isFinite(liq)) score += 3;
            if (Number.isFinite(acres) && acres > 0) score += 2;
            if (Number.isFinite(inss) || Number.isFinite(irrf)) score += 1;
            const status = String(l && l.status || '').toLowerCase();
            if (status && status !== 'rascunho') score += 1;
            const ts = parseNum(l.updated || l.updatedAt || l.dataProcessamento || l.dataAtualizacao);
            if (Number.isFinite(ts)) score += Math.min(2, Math.max(0, ts / 1e15));
            return score;
        };
        const byKey = new Map();
        folhasAtivas.forEach((l, idx) => {
            const k = keyOf(l, idx);
            const prev = byKey.get(k);
            if (!prev) {
                byKey.set(k, l);
                return;
            }
            const sPrev = scoreOf(prev);
            const sNow = scoreOf(l);
            if (sNow > sPrev) byKey.set(k, l);
        });
        const folhasDedupe = Array.from(byKey.values());
        const folhasParaResumo = folhasDedupe.filter((folha) => {
            if (window.FolhaUtils && typeof window.FolhaUtils.lancamentoContaNoResumo === 'function') {
                return window.FolhaUtils.lancamentoContaNoResumo(folha);
            }
            return true;
        });
        if (logTotais) console.log('📊 Calculando totais para', folhasParaResumo.length, 'folhas não baixadas (deduplicadas)');
        
        // ✅ CORREÇÃO CRÍTICA: Calcular totais EXATAMENTE como no relatório
        if (logTotais) console.log('🧮 Calculando totais folha.html exatos para cada coluna...');
        
        const totais = folhasParaResumo.reduce((acc, folha) => {
            const salarioBase = window.FolhaUtils.getSalarioBaseDisplay ? 
                window.FolhaUtils.getSalarioBaseDisplay(folha) : 
                (((folha && folha.calculos && folha.calculos.salarioBase) || folha.salarioBase || 0));
                
            const valorQuinzena = window.FolhaUtils.calcularValorQuinzena ? 
                window.FolhaUtils.calcularValorQuinzena(folha) : 0;
                
            const acrescimos = window.FolhaUtils.calcularAcrescimosDisplay ? 
                window.FolhaUtils.calcularAcrescimosDisplay(folha) : 0;
                
            const descontos = window.FolhaUtils.calcularDescontosDisplay ? 
                window.FolhaUtils.calcularDescontosDisplay(folha) : 0;
                
            const liquido = window.FolhaUtils.calcularSaldoLiquidoEmAberto ?
                window.FolhaUtils.calcularSaldoLiquidoEmAberto(folha) :
                (window.FolhaUtils.calcularSalarioLiquidoDisplay ? window.FolhaUtils.calcularSalarioLiquidoDisplay(folha) : 0);
            
            // Logs detalhados para cada funcionário (igual ao relatório)
            if (logTotais) {
                console.log(`📊 folha.html - Base ${((folha && folha.funcionario && folha.funcionario.nome) || '')}: ${salarioBase}`);
                console.log(`📊 folha.html - Quinzena ${((folha && folha.funcionario && folha.funcionario.nome) || '')}: ${valorQuinzena}`);
                console.log(`📊 folha.html - Acréscimos ${((folha && folha.funcionario && folha.funcionario.nome) || '')}: ${acrescimos}`);
                console.log(`📊 folha.html - Descontos ${((folha && folha.funcionario && folha.funcionario.nome) || '')}: ${descontos}`);
                console.log(`📊 folha.html - Líquido ${((folha && folha.funcionario && folha.funcionario.nome) || '')}: ${liquido}`);
            }
            
            return {
                bruto: acc.bruto + Number(salarioBase || 0),
                quinzena: acc.quinzena + Number(valorQuinzena || 0),
                acrescimos: acc.acrescimos + Number(acrescimos || 0),
                descontos: acc.descontos + Number(descontos || 0),
                liquido: acc.liquido + Number(liquido || 0)
            };
        }, { bruto: 0, quinzena: 0, acrescimos: 0, descontos: 0, liquido: 0 });
        const totalPagos = folhasDedupe.reduce((acc, folha) => {
            const liquido = window.FolhaUtils.calcularValorPagoLancamento ?
                window.FolhaUtils.calcularValorPagoLancamento(folha) :
                (window.FolhaUtils.calcularSalarioLiquidoDisplay ? window.FolhaUtils.calcularSalarioLiquidoDisplay(folha) : 0);
            return acc + Number(liquido || 0);
        }, 0);
        totais.pagos = totalPagos;
        totais.restantes = totais.liquido;
        
        if (logTotais) {
            console.log('🧮 TOTAIS folha.html CALCULADOS:');
            console.log(`📊 Total Bruto: ${totais.bruto.toFixed(2)}`);
            console.log(`📊 Total Quinzena: ${totais.quinzena.toFixed(2)}`);
            console.log(`📊 Total Acréscimos: ${totais.acrescimos.toFixed(2)}`);
            console.log(`📊 Total Descontos: ${totais.descontos.toFixed(2)}`);
            console.log(`📊 Total Líquido: ${totais.liquido.toFixed(2)}`);
            console.log(`📊 Total Pagos: ${totais.pagos.toFixed(2)}`);
            console.log(`📊 Total Restantes: ${totais.restantes.toFixed(2)}`);
        }
        
        // Atualizar elementos na interface
        this.updateTotaisInterface(totais);
        
        if (logTotais) console.log('✅ Totais atualizados:', totais);
    }
    
    /**
     * 📊 ATUALIZAR ELEMENTOS DOS TOTAIS NA INTERFACE
     */
    updateTotaisInterface(totais) {
        const elementos = {
            totalBruto: document.getElementById('totalBruto'),
            totalQuinzena: document.getElementById('totalQuinzena'),
            totalAcrescimos: document.getElementById('totalAcrescimos'),
            totalDescontos: document.getElementById('totalDescontos'),
            totalLiquido: document.getElementById('totalLiquido'),
            totalPagos: document.getElementById('totalPagos'),
            totalRestantes: document.getElementById('totalRestantes')
        };
        
        // Atualizar cada elemento se existir
        if (elementos.totalBruto) {
            elementos.totalBruto.textContent = window.FolhaUtils.formatarMoeda(totais.bruto);
        }
        
        if (elementos.totalQuinzena) {
            elementos.totalQuinzena.textContent = window.FolhaUtils.formatarMoeda(totais.quinzena);
        }
        
        if (elementos.totalAcrescimos) {
            elementos.totalAcrescimos.textContent = window.FolhaUtils.formatarMoeda(totais.acrescimos);
        }
        
        if (elementos.totalDescontos) {
            elementos.totalDescontos.textContent = window.FolhaUtils.formatarMoeda(totais.descontos);
        }
        
        if (elementos.totalLiquido) {
            elementos.totalLiquido.textContent = window.FolhaUtils.formatarMoeda(totais.liquido);
        }
        
        if (elementos.totalPagos) {
            elementos.totalPagos.textContent = window.FolhaUtils.formatarMoeda(totais.pagos || 0);
        }
        
        if (elementos.totalRestantes) {
            elementos.totalRestantes.textContent = window.FolhaUtils.formatarMoeda(totais.restantes ?? totais.liquido ?? 0);
        }
        
        const sig = `${Number(totais.bruto || 0)}|${Number(totais.quinzena || 0)}|${Number(totais.acrescimos || 0)}|${Number(totais.descontos || 0)}|${Number(totais.liquido || 0)}|${Number(totais.pagos || 0)}|${Number(totais.restantes || 0)}`;
        const logInterface = (window.FolhaUtils && typeof window.FolhaUtils.shouldLogDataChange === 'function')
            ? window.FolhaUtils.shouldLogDataChange('folhaMain.updateTotaisInterface', sig)
            : !!window.__folhaDebug;
        if (logInterface) console.log('✅ Interface dos totais atualizada');
    }
    
    /**
     * 🔄 ZERAR TOTAIS NA INTERFACE
     */
    zerarTotais() {
        const logZero = (window.FolhaUtils && typeof window.FolhaUtils.shouldLogDataChange === 'function')
            ? window.FolhaUtils.shouldLogDataChange('folhaMain.zerarTotais', '0')
            : !!window.__folhaDebug;
        if (logZero) console.log('🔄 Zerando totais na interface');
        
        const totaisZerados = {
            bruto: 0,
            quinzena: 0,
            acrescimos: 0,
            descontos: 0,
            liquido: 0,
            pagos: 0,
            restantes: 0
        };
        
        this.updateTotaisInterface(totaisZerados);
    }
    
    /**
     * 🎨 Configurar interface
     */
    setupInterface() {
        const debugAll = (window.FolhaUtils && typeof window.FolhaUtils.getDebugMode === 'function')
            ? window.FolhaUtils.getDebugMode() === 'all'
            : false;
        if (debugAll) console.log('🎨 Configurando interface...');
        
        if (!this._initialDataLoaded) {
            if (debugAll) console.warn('⚠️ Interface configurada antes dos dados estarem carregados');
            return;
        }
        
        // Configurar autocomplete de funcionários
        this.setupFuncionarioAutocomplete();
        
        // Configurar botões de ação
        this.setupActionButtons();
        
        // Configurar indicador de status Firebase
        this.setupFirebaseStatus();
        
        if (debugAll) console.log('✅ Interface configurada com sucesso');
    }
    
    /**
     * 🔍 Configurar autocomplete de funcionários
     */
    setupFuncionarioAutocomplete() {
        const debugAll = (window.FolhaUtils && typeof window.FolhaUtils.getDebugMode === 'function')
            ? window.FolhaUtils.getDebugMode() === 'all'
            : false;
        if (debugAll) console.log('🔍 Configurando autocomplete de funcionários...');
        if (debugAll) console.log('✅ Autocomplete de funcionários configurado');
    }
    
    /**
     * 🔘 Configurar botões de ação
     */
    setupActionButtons() {
        const debugAll = (window.FolhaUtils && typeof window.FolhaUtils.getDebugMode === 'function')
            ? window.FolhaUtils.getDebugMode() === 'all'
            : false;
        if (debugAll) console.log('🔘 Configurando botões de ação...');
        try {
            if (window.FolhaUtils && typeof window.FolhaUtils.setupAcoesPrincipaisToggle === 'function') {
                window.FolhaUtils.setupAcoesPrincipaisToggle();
            }
        } catch (_) {}
        if (debugAll) console.log('✅ Botões de ação configurados');
    }
    
    /**
     * 🔥 Configurar status Firebase
     */
    setupFirebaseStatus() {
        const debugAll = (window.FolhaUtils && typeof window.FolhaUtils.getDebugMode === 'function')
            ? window.FolhaUtils.getDebugMode() === 'all'
            : false;
        if (debugAll) console.log('🔥 Configurando status Firebase...');
        if (debugAll) console.log('✅ Status Firebase configurado');
    }
    
    /**
     * 📅 Configurar datas padrão
     */
    setupDefaultDates() {
        const debugAll = (window.FolhaUtils && typeof window.FolhaUtils.getDebugMode === 'function')
            ? window.FolhaUtils.getDebugMode() === 'all'
            : false;
        if (debugAll) console.log('📅 Configurando datas padrão...');
        
        const hoje = new Date();
        const mesAtual = `${hoje.getFullYear()}-${String(hoje.getMonth() + 1).padStart(2, '0')}`;
        
        const mesAnoFilter = document.getElementById('mesAno');
        if (mesAnoFilter && !mesAnoFilter.value) {
            // Definir mês atual SOMENTE se há dados para o mês ou há filtro persistido
            const filtrosPersistidos = (() => {
                try {
                    if (window.SiswebStorage && typeof window.SiswebStorage.read === 'function') {
                        const raw = window.SiswebStorage.read('folha_filtros_ativos');
                        return typeof raw === 'string' ? JSON.parse(raw || '{}') : (raw || {});
                    }
                    return JSON.parse(localStorage.getItem('folha_filtros_ativos')||'{}');
                } catch(e){ return {}; }
            })();
            if (filtrosPersistidos && filtrosPersistidos.mesAno) {
                mesAnoFilter.value = filtrosPersistidos.mesAno;
                if (debugAll) console.log('📅 Mês padrão restaurado do storage:', filtrosPersistidos.mesAno);
            } else {
                const existeMes = Array.isArray(this.folhas) && this.folhas.some(f => f && f.mesAno === mesAtual);
                if (existeMes) {
                    mesAnoFilter.value = mesAtual;
                    if (debugAll) console.log('📅 Mês atual definido no filtro:', mesAtual);
                } else {
                    if (debugAll) console.log('ℹ️ Mês atual não definido (sem dados para o mês).');
                }
            }
        }
        
        this.mesAtualPadrao = mesAtual;
        if (debugAll) console.log('✅ Datas padrão configuradas com sucesso');
    }
    
    /**
     * 🔧 Configurar navegação com Enter
     */
    setupEnterNavigation() {
        const debugAll = (window.FolhaUtils && typeof window.FolhaUtils.getDebugMode === 'function')
            ? window.FolhaUtils.getDebugMode() === 'all'
            : false;
        if (debugAll) console.log('⌨️ Configurando navegação com Enter...');
        if (debugAll) console.log('✅ Navegação com Enter configurada');
    }
    
    /**
     * 🎭 Configurar eventos dos modais
     */
    setupModalEvents() {
        const debugAll = (window.FolhaUtils && typeof window.FolhaUtils.getDebugMode === 'function')
            ? window.FolhaUtils.getDebugMode() === 'all'
            : false;
        if (debugAll) console.log('🎭 Configurando eventos dos modais...');
        if (debugAll) console.log('✅ Eventos dos modais configurados');
    }
    
    /**
     * 🔍 Configurar filtros
     */
    setupFilters() {
        const debugAll = (window.FolhaUtils && typeof window.FolhaUtils.getDebugMode === 'function')
            ? window.FolhaUtils.getDebugMode() === 'all'
            : false;
        if (debugAll) console.log('🔍 Configurando filtros...');
        if (debugAll) console.log('✅ Sistema de filtros inicializado');
    }

    /**
     * 🔄 Atualizar interface completa
     */
    updateInterface() {
        const debugAll = (window.FolhaUtils && typeof window.FolhaUtils.getDebugMode === 'function')
            ? window.FolhaUtils.getDebugMode() === 'all'
            : false;
        if (debugAll) console.log('🔄 Atualizando interface...');
        
        if (!this._initialDataLoaded) {
            if (debugAll) console.warn('⚠️ Interface atualizada antes dos dados estarem carregados');
            return;
        }
        
        // ✅ CORREÇÃO: CHAMAR aplicarFiltrosComDadosFrescos para renderizar a tabela
        if (debugAll) console.log('🔄 Aplicando filtros e renderizando tabela...');
        this.aplicarFiltrosComDadosFrescos().then(() => {
            if (debugAll) console.log('✅ Tabela renderizada com sucesso');
        }).catch(error => {
            console.error('❌ Erro ao renderizar tabela:', error);
        });
        
        // Garantir rebind de delegação após re-render
        this.setupActionDelegates();
        
        if (debugAll) console.log('✅ Interface atualizada com sucesso');
    }

    // Delegação dos botões de ação para evitar conflitos/duplicações de onclick
    setupActionDelegates() {
        const debugAll = (window.FolhaUtils && typeof window.FolhaUtils.getDebugMode === 'function')
            ? window.FolhaUtils.getDebugMode() === 'all'
            : false;
        if (debugAll) console.log('🔧 Configurando delegação de ações...');
        
        const tbody = document.getElementById('folhasTableBody');
        const container = document.getElementById('tabela-folhas-section') || tbody;
        
        // ✅ VERIFICAÇÃO: Garantir que a tabela/contêiner esteja disponível
        if (!container) {
            console.warn('⚠️ Tabela de folhas não encontrada, aguardando...');
            // Tentar novamente após um delay
            setTimeout(() => this.setupActionDelegates(), 500);
            return;
        }
        
        if (container._actionsBound) {
            if (debugAll) console.log('✅ Delegação de ações já configurada');
            return;
        }
        
            container.addEventListener('click', (e) => {
                const button = e.target.closest('button');
                if (!button) return;
                // Evitar duplicação quando existe onclick inline
                if (button.getAttribute('onclick')) return;
                
                let folhaId = button.getAttribute('data-folha-id') 
                    || button.getAttribute('data-id') 
                    || (button.closest('tr') && button.closest('tr').getAttribute('data-id'));
                if (!folhaId) {
                    try {
                        const row = button.closest('tr');
                        const cells = row ? row.querySelectorAll('td') : null;
                        const nomeCell = cells && cells[0];
                        const mesCell = cells && cells[1];
                        const nome = nomeCell ? String(nomeCell.querySelector('strong') ? nomeCell.querySelector('strong').textContent : nomeCell.textContent).trim() : '';
                        const mesTxt = mesCell ? String(mesCell.textContent || '').trim() : '';
                        const mesNorm = (function(s){ const m=s.trim(); const mm=m.match(/^(\d{2})\/(\d{4})$/); if(mm) return `${mm[2]}-${mm[1]}`; return m; })(mesTxt);
                        if (window.folhaLancamentos && typeof window.folhaLancamentos._findLancamentoByFuncionarioMes === 'function') {
                            const found = window.folhaLancamentos._findLancamentoByFuncionarioMes(nome, mesNorm);
                            if (found) folhaId = found.id || found.key || found.$key || '';
                            if (!folhaId && found) { try { row && row.setAttribute('data-id', found.id || found.key || ''); } catch {} }
                        }
                    } catch {}
                    if (!folhaId) {
                        try {
                            // Fallback final: buscar por nome no conjunto completo
                            const row = button.closest('tr');
                            const nome = row && row.querySelector('td') ? String((row.querySelector('td strong')||row.querySelector('td')).textContent||'').trim() : '';
                            const pool = [];
                            try { if (window.folhaMain && Array.isArray(window.folhaMain.folhas)) pool.push(...window.folhaMain.folhas); } catch {}
                            try { if (window.folhaSystem && Array.isArray(window.folhaSystem.folhas)) pool.push(...window.folhaSystem.folhas); } catch {}
                            try { if (Array.isArray(window.pendingFolhasData)) pool.push(...window.pendingFolhasData); } catch {}
                            const norm = (s) => { try { return String(s||'').toLowerCase().trim().normalize('NFD').replace(/[^a-z0-9\s]/g,'').replace(/\s+/g,' '); } catch { return ''; } };
                            const alvo = norm(nome);
                            const candidate = pool.find(f => norm(f && f.funcionario && f.funcionario.nome) === alvo);
                            if (candidate) folhaId = candidate.id || candidate.key || candidate.$key || '';
                        } catch {}
                        if (!folhaId) {
                            console.warn('⚠️ ID da folha não encontrado no botão/linha');
                            return;
                        }
                    }
                }
            
            e.preventDefault();
            e.stopPropagation();
            
            if (button.classList.contains('btn-editar') || button.classList.contains('edit-button')) {
                if (debugAll) console.log(`🖊️ Editando folha: ${folhaId}`);
                try {
                    if (typeof window.editFolha === 'function') {
                        window.editFolha(folhaId);
                    } else if (window.folhaLancamentos && typeof window.folhaLancamentos.openEditFolhaModal === 'function') {
                        window.folhaLancamentos.openEditFolhaModal(folhaId);
                    } else {
                        console.warn('⚠️ Função de edição não disponível ainda');
                    }
                } catch(e) { console.error('❌ Falha ao acionar edição:', e); }
            } else if (button.classList.contains('btn-excluir') || button.classList.contains('delete-button')) {
                if (debugAll) console.log(`🗑️ Excluindo folha: ${folhaId}`);
                if (window.folhaLancamentos) {
                    window.folhaLancamentos.excluirFolha(folhaId);
                }
            } else if (button.classList.contains('btn-fechar-mes') || button.classList.contains('fechar-mes-button')) {
                if (debugAll) console.log(`🗓️ Fechar Mês: ${folhaId}`);
                if (window.folhaLancamentos && typeof window.folhaLancamentos.fecharMes === 'function') {
                    window.folhaLancamentos.fecharMes(folhaId);
                } else if (typeof window.fecharMes === 'function') {
                    window.fecharMes(folhaId);
                }
            } else if (button.classList.contains('btn-dar-baixa') || button.classList.contains('dar-baixa-button')) {
                if (debugAll) console.log(`💸 Dar Baixa Quinzena: ${folhaId}`);
                if (window.folhaLancamentos && typeof window.folhaLancamentos.darBaixaQuinzena === 'function') {
                    window.folhaLancamentos.darBaixaQuinzena(folhaId);
                } else if (typeof window.darBaixaQuinzena === 'function') {
                    window.darBaixaQuinzena(folhaId);
                }
            } else if (button.classList.contains('btn-clonar') || button.classList.contains('clonar-folha-button')) {
                if (debugAll) console.log(`🔄 Clonar Folha: ${folhaId}`);
                if (window.folhaLancamentos && typeof window.folhaLancamentos.clonarFolha === 'function') {
                    window.folhaLancamentos.clonarFolha(folhaId);
                } else if (typeof window.clonarFolha === 'function') {
                    window.clonarFolha(folhaId);
                }
            } else if (button.classList.contains('print-button')) {
                if (button.getAttribute('onclick')) return;
                if (debugAll) console.log(`🖨️ Imprimir Folha: ${folhaId}`);
                if (typeof window.printFolha === 'function') {
                    window.printFolha(folhaId);
                }
            }
        });
        
        container._actionsBound = true;
        if (debugAll) console.log('✅ Delegação de ações configurada');

        try { this.fixMissingRowIds(); } catch(e) { console.warn('⚠️ Falha ao corrigir IDs de linhas:', e); }

        // Fallback global: caso o contêiner não capture (re-renderes, sombra de elementos), delegar no documento
        if (!document._folhaActionsDelegated) {
            document.addEventListener('click', (e) => {
                const button = e.target.closest('button');
                if (!button) return;
                // Capturar somente se pertence à tabela (evitar conflitos com outros módulos)
                const inTable = !!button.closest('#tabela-folhas-section') || !!button.closest('#folhasTableBody');
                if (!inTable) return;
                // Evitar duplicação quando existe onclick inline
                if (button.getAttribute('onclick')) return;

                let folhaId = button.getAttribute('data-folha-id')
                    || button.getAttribute('data-id')
                    || (button.closest('tr') && button.closest('tr').getAttribute('data-id'));
                if (!folhaId) {
                    try {
                        const row = button.closest('tr');
                        const cells = row ? row.querySelectorAll('td') : null;
                        const nomeCell = cells && cells[0];
                        const mesCell = cells && cells[1];
                        const nome = nomeCell ? String(nomeCell.querySelector('strong') ? nomeCell.querySelector('strong').textContent : nomeCell.textContent).trim() : '';
                        const mesTxt = mesCell ? String(mesCell.textContent || '').trim() : '';
                        const mesNorm = (function(s){ const m=s.trim(); const mm=m.match(/^(\d{2})\/(\d{4})$/); if(mm) return `${mm[2]}-${mm[1]}`; return m; })(mesTxt);
                        if (window.folhaLancamentos && typeof window.folhaLancamentos._findLancamentoByFuncionarioMes === 'function') {
                            const found = window.folhaLancamentos._findLancamentoByFuncionarioMes(nome, mesNorm);
                            if (found) folhaId = found.id || found.key || found.$key || '';
                            if (!folhaId && found) { try { row && row.setAttribute('data-id', found.id || found.key || ''); } catch {} }
                        }
                    } catch {}
                    if (!folhaId) {
                        try {
                            const row = button.closest('tr');
                            const nome = row && row.querySelector('td') ? String((row.querySelector('td strong')||row.querySelector('td')).textContent||'').trim() : '';
                            const pool = [];
                            try { if (window.folhaMain && Array.isArray(window.folhaMain.folhas)) pool.push(...window.folhaMain.folhas); } catch {}
                            try { if (window.folhaSystem && Array.isArray(window.folhaSystem.folhas)) pool.push(...window.folhaSystem.folhas); } catch {}
                            try { if (Array.isArray(window.pendingFolhasData)) pool.push(...window.pendingFolhasData); } catch {}
                            const norm = (s) => { try { return String(s||'').toLowerCase().trim().normalize('NFD').replace(/[^a-z0-9\s]/g,'').replace(/\s+/g,' '); } catch { return ''; } };
                            const alvo = norm(nome);
                            const candidate = pool.find(f => norm(f && f.funcionario && f.funcionario.nome) === alvo);
                            if (candidate) folhaId = candidate.id || candidate.key || candidate.$key || '';
                        } catch {}
                        if (!folhaId) return;
                    }
                }

                e.preventDefault();
                e.stopPropagation();

                if (button.classList.contains('btn-editar') || button.classList.contains('edit-button')) {
                    console.log(`🖊️ Editando folha: ${folhaId}`);
                    try {
                        if (typeof window.editFolha === 'function') {
                            window.editFolha(folhaId);
                        } else if (window.folhaLancamentos && typeof window.folhaLancamentos.openEditFolhaModal === 'function') {
                            window.folhaLancamentos.openEditFolhaModal(folhaId);
                        } else {
                            console.warn('⚠️ Função de edição não disponível ainda');
                        }
                    } catch(e) { console.error('❌ Falha ao acionar edição:', e); }
                } else if (button.classList.contains('btn-excluir') || button.classList.contains('delete-button')) {
                    console.log(`🗑️ Excluindo folha: ${folhaId}`);
                    if (window.folhaLancamentos) {
                        window.folhaLancamentos.excluirFolha(folhaId);
                    }
                } else if (button.classList.contains('btn-fechar-mes') || button.classList.contains('fechar-mes-button')) {
                    console.log(`🗓️ Fechar Mês: ${folhaId}`);
                    if (window.folhaLancamentos && typeof window.folhaLancamentos.fecharMes === 'function') {
                        window.folhaLancamentos.fecharMes(folhaId);
                    } else if (typeof window.fecharMes === 'function') {
                        window.fecharMes(folhaId);
                    }
                } else if (button.classList.contains('btn-dar-baixa') || button.classList.contains('dar-baixa-button')) {
                    console.log(`💸 Dar Baixa Quinzena: ${folhaId}`);
                    if (window.folhaLancamentos && typeof window.folhaLancamentos.darBaixaQuinzena === 'function') {
                        window.folhaLancamentos.darBaixaQuinzena(folhaId);
                    } else if (typeof window.darBaixaQuinzena === 'function') {
                        window.darBaixaQuinzena(folhaId);
                    }
                } else if (button.classList.contains('btn-clonar') || button.classList.contains('clonar-folha-button')) {
                    console.log(`🔄 Clonar Folha: ${folhaId}`);
                    if (window.folhaLancamentos && typeof window.folhaLancamentos.clonarFolha === 'function') {
                        window.folhaLancamentos.clonarFolha(folhaId);
                    } else if (typeof window.clonarFolha === 'function') {
                        window.clonarFolha(folhaId);
                    }
                } else if (button.classList.contains('print-button')) {
                    console.log(`🖨️ Imprimir Folha: ${folhaId}`);
                    if (typeof window.printFolha === 'function') {
                        window.printFolha(folhaId);
                    }
                }
            });
            document._folhaActionsDelegated = true;
            console.log('✅ Delegação global de ações configurada (fallback)');
        }
    }


    fixMissingRowIds() {
        const tbody = document.getElementById('folhasTableBody');
        if (!tbody) return;
        const rows = tbody.querySelectorAll('tr');
        const normMes = (s) => { const m = String(s||'').trim(); const mm=m.match(/^(\d{2})\/(\d{4})$/); return mm ? `${mm[2]}-${mm[1]}` : m; };
        rows.forEach(row => {
            let rid = row.getAttribute('data-id');
            if (!rid) {
                try {
                    const cells = row.querySelectorAll('td');
                    const nomeCell = cells[0];
                    const mesCell = cells[1];
                    const nome = nomeCell ? String(nomeCell.querySelector('strong') ? nomeCell.querySelector('strong').textContent : nomeCell.textContent).trim() : '';
                    const mesTxt = mesCell ? String(mesCell.textContent || '').trim() : '';
                    const found = (window.folhaLancamentos && typeof window.folhaLancamentos._findLancamentoByFuncionarioMes === 'function')
                        ? window.folhaLancamentos._findLancamentoByFuncionarioMes(nome, normMes(mesTxt))
                        : null;
                    const id = found ? (found.id || found.key || found.$key || '') : '';
                    if (id) {
                        row.setAttribute('data-id', id);
                        const btns = row.querySelectorAll('button');
                        btns.forEach(b => { 
                            try { 
                                b.setAttribute('data-folha-id', id); 
                                b.setAttribute('data-id', id);
                                if (b.classList.contains('edit-button') || b.classList.contains('btn-editar')) {
                                    b.setAttribute('onclick', `__onEditFolhaButtonClick('${id}')`);
                                } else if (b.classList.contains('print-button')) {
                                    b.setAttribute('onclick', `printFolha('${id}')`);
                                } else if (b.classList.contains('delete-button') || b.classList.contains('btn-excluir')) {
                                    b.setAttribute('onclick', `deleteFolha('${id}')`);
                                }
                            } catch {}
                        });
                    }
                } catch {}
            }
        });
    }
}

/**
 * 🚀 EXPORTAÇÕES GLOBAIS DAS FUNÇÕES PRINCIPAIS
 */
// Wrapper global para garantir que o botão Editar sempre funcione, mesmo antes de módulos carregarem
if (typeof window.__onEditFolhaButtonClick !== 'function') {
    window.__onEditFolhaButtonClick = (folhaId) => {
        try {
            let id = String(folhaId||'').trim();
            if (!id) {
                try {
                    const ev = window.event;
                    let node = ev && ev.target;
                    while (node && node.tagName && String(node.tagName).toLowerCase() !== 'tr') { node = node.parentNode; }
                    const rid = node && (node.getAttribute && node.getAttribute('data-id'));
                    if (rid) id = String(rid).trim();
                    if (!id && node) {
                        const cells = node.querySelectorAll('td');
                        const nome = cells[0] ? String(cells[0].querySelector('strong') ? cells[0].querySelector('strong').textContent : cells[0].textContent).trim() : '';
                        const mesTxt = cells[1] ? String(cells[1].textContent||'').trim() : '';
                        const mesNorm = (function(s){ const m=s.trim(); const mm=m.match(/^(\d{2})\/(\d{4})$/); if(mm) return `${mm[2]}-${mm[1]}`; return m; })(mesTxt);
                        if (window.folhaLancamentos && typeof window.folhaLancamentos._findLancamentoByFuncionarioMes === 'function') {
                            const found = window.folhaLancamentos._findLancamentoByFuncionarioMes(nome, mesNorm);
                            id = found ? (found.id || found.key || found.$key || '') : '';
                            if (id) { try { node.setAttribute('data-id', id); } catch {} }
                        }
                    }
                } catch {}
            }
            if (typeof window.editFolha === 'function') {
                window.editFolha(id);
                return;
            }
            if (window.folhaLancamentos && typeof window.folhaLancamentos.openEditFolhaModal === 'function') {
                window.folhaLancamentos.openEditFolhaModal(id);
                return;
            }
            try { window.dispatchEvent(new CustomEvent('editarFolha', { detail: { id } })); } catch {}
        } catch (e) {
            console.error('❌ Falha no wrapper de edição:', e);
        }
    };
    try {
        window.addEventListener('editarFolha', (e) => {
            try {
                const id = e && e.detail && e.detail.id;
                if (window.folhaLancamentos && typeof window.folhaLancamentos.openEditFolhaModal === 'function') {
                    window.folhaLancamentos.openEditFolhaModal(id);
                } else if (typeof window.editFolha === 'function') {
                    window.editFolha(id);
                }
            } catch(err) { console.warn('⚠️ Falha ao tratar evento editarFolha:', err); }
        });
    } catch {}
}
// Funções de Funcionários
window.openNovoFuncionarioModal = function() {
    if (window.folhaFuncionarios) {
        window.folhaFuncionarios.openNovoFuncionarioModal();
    } else {
        console.warn('⚠️ Módulo folhaFuncionarios não carregado');
        if (window.FolhaUtils && window.FolhaUtils.mostrarAviso) {
            window.FolhaUtils.mostrarAviso('Sistema carregando. Tente novamente em alguns segundos.');
        }
    }
};

// Funções de Cargos
window.openNovoCargoModal = function() {
    if (window.folhaCargos) {
        window.folhaCargos.openNovoCargoModal();
    } else {
        console.warn('⚠️ Módulo folhaCargos não carregado');
        if (window.FolhaUtils && window.FolhaUtils.mostrarAviso) {
            window.FolhaUtils.mostrarAviso('Sistema carregando. Tente novamente em alguns segundos.');
        }
    }
};

// Funções de Lançamentos/Folhas
window.openNovaFolhaModal = function() {
    if (window.folhaLancamentos) {
        window.folhaLancamentos.openNovaFolhaModal();
    } else {
        console.warn('⚠️ Módulo folhaLancamentos não carregado');
        if (window.FolhaUtils && window.FolhaUtils.mostrarAviso) {
            window.FolhaUtils.mostrarAviso('Sistema carregando. Tente novamente em alguns segundos.');
        }
    }
};

window.openFolhasFechadasModal = function() {
    if (window.folhaLancamentos) {
        window.folhaLancamentos.openFolhasFechadasModal();
    } else {
        console.warn('⚠️ Módulo folhaLancamentos não carregado');
        if (window.FolhaUtils && window.FolhaUtils.mostrarAviso) {
            window.FolhaUtils.mostrarAviso('Sistema carregando. Tente novamente em alguns segundos.');
        }
    }
};

// Funções de Relatórios
window.openRelatorioModal = function() {
    if (window.folhaRelatorios) {
        window.folhaRelatorios.openRelatorioModal();
    } else {
        console.warn('⚠️ Módulo folhaRelatorios não carregado');
        if (window.FolhaUtils && window.FolhaUtils.mostrarAviso) {
            window.FolhaUtils.mostrarAviso('Sistema carregando. Tente novamente em alguns segundos.');
        }
    }
};

// Compatibilidade: imprimir folha por ID
if (!window.printFolha) {
    window.printFolha = function(folhaId) {
        try {
            if (window.folhaRelatorios && typeof window.folhaRelatorios.gerarReciboIndividualDetalhado === 'function') {
                return window.folhaRelatorios.gerarReciboIndividualDetalhado(folhaId);
            }
            // Fallback: tentar localizar folha e exibir dados básicos
            const lista = (window.folhaLancamentos && Array.isArray(window.folhaLancamentos.lancamentos)) ? window.folhaLancamentos.lancamentos : [];
            const folha = lista.find(l => (l.id || l.key) === folhaId);
            if (folha) {
                console.log('🖨️ Folha encontrada para impressão (fallback):', folha);
                if (window.FolhaUtils && window.FolhaUtils.showToast) {
                    window.FolhaUtils.showToast('Sistema de relatórios não disponível. Folha localizada com sucesso.', 'warning', 4000);
                }
            } else {
                console.warn('⚠️ Folha não encontrada para impressão:', folhaId);
                if (window.FolhaUtils && window.FolhaUtils.showToast) {
                    window.FolhaUtils.showToast('Folha não encontrada para impressão', 'error', 4000);
                }
            }
        } catch (e) {
            console.error('❌ Erro ao imprimir folha:', e);
        }
    };
}

window.closeRelatorioModal = function() {
    if (window.folhaRelatorios) {
        window.folhaRelatorios.closeRelatorioModal();
    } else {
        console.warn('⚠️ Módulo folhaRelatorios não carregado');
        const modal = document.getElementById('relatorioModal');
        if (modal) modal.style.display = 'none';
    }
};

// Funções de fechamento de modais
window.closeFuncionarioModal = function() {
    if (window.folhaFuncionarios) {
        window.folhaFuncionarios.closeFuncionarioModal();
    } else {
        console.warn('⚠️ Módulo folhaFuncionarios não carregado');
        const modal = document.getElementById('funcionarioModal');
        if (modal) modal.style.display = 'none';
    }
};

window.closeCargoModal = function() {
    if (window.folhaCargos) {
        window.folhaCargos.closeCargoModal();
    } else {
        console.warn('⚠️ Módulo folhaCargos não carregado');
        const modal = document.getElementById('cargoModal');
        if (modal) modal.style.display = 'none';
    }
};

window.closeFolhaModal = function() {
    if (window.folhaLancamentos) {
        window.folhaLancamentos.closeFolhaModal();
    } else {
        console.warn('⚠️ Módulo folhaLancamentos não carregado');
        const modal = document.getElementById('folhaModal');
        if (modal) modal.style.display = 'none';
    }
};

window.closeFolhasFechadasModal = function() {
    if (window.folhaLancamentos) {
        window.folhaLancamentos.closeFolhasFechadasModal();
    } else {
        console.warn('⚠️ Módulo folhaLancamentos não carregado');
        const modal = document.getElementById('folhasFechadasModal');
        if (modal) {
            modal.style.display = 'none';
            // ✅ CORREÇÃO: Restaurar scroll também no fallback
            document.body.style.overflow = 'auto';
        }
    }
};

// Funções de filtros
window.filtrarFolhasFechadas = function() {
    if (window.folhaLancamentos) {
        window.folhaLancamentos.filtrarFolhasFechadas();
    } else {
        console.warn('⚠️ Módulo folhaLancamentos não carregado');
        if (window.FolhaUtils && window.FolhaUtils.mostrarAviso) {
            window.FolhaUtils.mostrarAviso('Sistema carregando. Tente novamente em alguns segundos.');
        }
    }
};

// Funções de listagem
window.openCargosListModal = function() {
    if (window.folhaCargos) {
        window.folhaCargos.openCargosListModal();
    } else {
        console.warn('⚠️ Módulo folhaCargos não carregado');
        if (window.FolhaUtils && window.FolhaUtils.mostrarAviso) {
            window.FolhaUtils.mostrarAviso('Sistema carregando. Tente novamente em alguns segundos.');
        }
    }
};

/**
 * 🚀 INICIALIZAÇÃO AUTOMÁTICA
 */
let folhaSystem;

document.addEventListener('DOMContentLoaded', async () => {
    console.log('📄 DOM carregado, inicializando Sistema de Folha de Pagamento...');

    try {
        folhaSystem = new FolhaPagamentoSystem();
        window.folhaSystem = folhaSystem;
        console.log('✅ Sistema de Folha de Pagamento criado com sucesso');
        
        // Iniciar imediatamente sem delay artificial
        console.log('⏳ Iniciando carregamento do sistema...');
        await folhaSystem.init();
        
        // Esconder overlay após inicialização (ou deixar que a renderização o faça se preferir)
        const overlay = document.getElementById('loadingOverlay');
        if (overlay) overlay.classList.remove('active');
        
        // Mostrar seções principais que estavam ocultas
        folhaSystem.mostrarSecoesPrincipaisFolha();

    } catch (error) {
        console.error('❌ Erro ao criar sistema de Folha de Pagamento:', error);
        const overlay = document.getElementById('loadingOverlay');
        if (overlay) overlay.classList.remove('active');
        if (folhaSystem && typeof folhaSystem.mostrarSecoesPrincipaisFolha === 'function') {
            folhaSystem.mostrarSecoesPrincipaisFolha();
        } else if (window.FolhaUtils && typeof window.FolhaUtils.ensureFolhaMainSectionsVisible === 'function') {
            window.FolhaUtils.ensureFolhaMainSectionsVisible();
        } else {
            const t = document.getElementById('tabela-folhas-section');
            const tot = document.getElementById('totais-section');
            if (t) t.style.display = 'block';
            if (tot) tot.style.display = 'block';
        }
    }
});

// 🎯 Folha Main carregado com sucesso (renderização orquestrada pelos filtros)
