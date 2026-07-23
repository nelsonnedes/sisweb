/**
 * 👥 FOLHA FUNCIONÁRIOS - Sistema completo de CRUD de funcionários
 * Baseado nos padrões do romaneiopct com validações CLT e SisWeb
 */

// ✅ CONFIGURAÇÕES LOCAIS (complementares ao folha-config.js)
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

// ✅ CLASSE PRINCIPAL DE FUNCIONÁRIOS
class FolhaFuncionarios {
    constructor() {
        this.funcionarios = [];
        this.funcionarioAtual = null;
        this.isEditMode = false;
        this.funcListSortKey = 'nome';
        this.funcListSortDirection = 'asc';
        this.funcListHasActiveFilter = false;
        
        this.init();
    }
    
    init() {
        console.log('👥 Inicializando sistema de funcionários...');
        this.setupEventListeners();
        this.setupSyncListeners();
        this.loadFuncionarios();
    }
    
    /**
     * 🎯 CONFIGURAR EVENT LISTENERS
     */
    setupEventListeners() {
        // Evitar configuração dupla
        if (this._eventListenersConfigured) {
            console.log('⚠️ Event listeners de funcionários já foram configurados, pulando...');
            return;
        }
        
        // Executar imediatamente se DOM estiver pronto
        const initListeners = () => {
            console.log('🎯 Configurando event listeners de funcionários...');
            
            // Botão Novo Funcionário
            const btnNovoFuncionario = document.getElementById('btnNovoFuncionario') || 
                                       document.querySelector('.btn-adicionar[onclick*="Funcionario"]');
            if (btnNovoFuncionario) {
                btnNovoFuncionario.addEventListener('click', () => this.openNovoFuncionarioModal());
            }
            
            // Form de funcionário - CONFIGURAÇÃO CORRIGIDA
            const funcionarioForm = document.getElementById('funcionarioForm');
            if (funcionarioForm) {
                console.log('✅ Configurando event listener para funcionarioForm');
                
                // Verificar se já tem event listeners para evitar duplicação
                if (funcionarioForm._funcionariosListenerConfigured) {
                    console.log('⚠️ Event listener de funcionário já configurado, pulando...');
                    this._eventListenersConfigured = true;
                    return;
                }
                
                // Remover event listeners existentes para evitar duplicação
                funcionarioForm.onsubmit = null;
                
                // Configurar novo event listener - APENAS UMA VEZ
                funcionarioForm.addEventListener('submit', (e) => {
                    console.log('📝 Submit do formulário de funcionário capturado');
                    e.preventDefault();
                    this.handleSubmitFuncionario(e);
                });
                
                // Marcar como configurado
                funcionarioForm._funcionariosListenerConfigured = true;
                funcionarioForm._hasEventListener = true;
                
                // CONFIGURAR BOTÃO DE SALVAR - Chamar diretamente o handler
                const saveFuncionarioBtn = document.getElementById('saveFuncionarioBtn');
                if (saveFuncionarioBtn) {
                    console.log('🔘 Configurando botão de salvar funcionário');
                    
                    // Limpar handlers existentes
                    saveFuncionarioBtn.onclick = null;
                    const newBtn = saveFuncionarioBtn.cloneNode(true);
                    saveFuncionarioBtn.parentNode.replaceChild(newBtn, saveFuncionarioBtn);
                    
                    // Configurar handler único
                    newBtn.addEventListener('click', (e) => {
                        console.log('🔘 Botão salvar funcionário clicado');
                        e.preventDefault();
                        e.stopPropagation();
                        
                        // Chamar diretamente o handler em vez de simular submit
                        this.handleSubmitFuncionario(e);
                    });
                }
                
            } else {
                console.warn('⚠️ funcionarioForm não encontrado no DOM');
                // Tentar novamente mais rápido
                if (!this._retries) this._retries = 0;
                if (this._retries++ < 10) setTimeout(() => this.setupEventListeners(), 100);
                return;
            }
            
            // Campos com formatação automática
            this.setupFieldFormatting();
            
            // Toggle funcionário ativo
            this.setupFuncionarioAtivoToggle();
            
            // ✅ CORREÇÃO: Configurar marcação de lastFocused nos campos de funcionário
            this.setupFuncionarioFieldTracking();
            
            // Modal close handlers
            this.setupModalHandlers();
            
            this._eventListenersConfigured = true;
            console.log('✅ Event listeners de funcionários configurados (sem duplicação)');
        };
        
        // Iniciar configuração
        initListeners();
    }
    
    /**
     * 📝 CONFIGURAR FORMATAÇÃO DE CAMPOS
     */
    setupFieldFormatting() {
        const cpfField = document.getElementById('funcionarioCpf');
        const pisField = document.getElementById('funcionarioPis');
        const ctpsField = document.getElementById('funcionarioCtps');
        const nomeField = document.getElementById('funcionarioNome');
        const cargoField = document.getElementById('funcionarioCargo');
        
        if (cpfField) {
            cpfField.addEventListener('input', (e) => {
                e.target.value = window.FolhaUtils.formatarCpfInput(e.target.value);
            });
            cpfField.addEventListener('blur', (e) => {
                this.validateCPF(e.target.value, e.target);
            });
        }
        
        if (pisField) {
            pisField.addEventListener('input', (e) => {
                e.target.value = window.FolhaUtils.formatarPisInput(e.target.value);
            });
            pisField.addEventListener('blur', (e) => {
                this.validatePIS(e.target.value, e.target);
            });
        }
        
        if (ctpsField) {
            ctpsField.addEventListener('input', (e) => {
                e.target.value = window.FolhaUtils.formatarCtpsInput(e.target.value);
            });
        }

        if (nomeField) {
            nomeField.addEventListener('blur', function(){
                const v = String(this.value || '').trim();
                if (!v) return;
                if (window.isAllCaps && window.toTitleCasePt && window.isAllCaps(v)) {
                    this.value = window.toTitleCasePt(v);
                }
            });
        }
        if (cargoField) {
            cargoField.addEventListener('blur', function(){
                const v = String(this.value || '').trim();
                if (!v) return;
                if (window.isAllCaps && window.toTitleCasePt && window.isAllCaps(v)) {
                    this.value = window.toTitleCasePt(v);
                }
            });
        }
        const formaPagamentoField = document.getElementById('funcionarioFormaPagamento');
        if (formaPagamentoField) {
            formaPagamentoField.addEventListener('change', () => this.updateFormaPagamentoFields({ clearHidden: true }));
        }
        const pixField = document.getElementById('funcionarioPix');
        if (pixField) {
            pixField.addEventListener('blur', () => this.autofillPixTipoFromChave());
        }
        this.updateFormaPagamentoFields();
    }

    resolvePixTipo(funcionario = {}) {
        const explicit = funcionario.pixTipo || funcionario.tipoPix || funcionario.tipoChavePix || '';
        if (window.FolhaUtils && typeof window.FolhaUtils.normalizePixKeyType === 'function') {
            const normalized = window.FolhaUtils.normalizePixKeyType(explicit);
            if (normalized) return normalized;
            if (typeof window.FolhaUtils.detectPixKeyType === 'function') {
                return window.FolhaUtils.detectPixKeyType(funcionario.pix || '');
            }
        }
        return String(explicit || '').trim();
    }

    autofillPixTipoFromChave({ force = false } = {}) {
        const pixField = document.getElementById('funcionarioPix');
        const pixTipoField = document.getElementById('funcionarioPixTipo');
        if (!pixField || !pixTipoField || (!force && pixTipoField.value)) return;

        const raw = String(pixField.value || '').trim();
        const compact = raw.replace(/\s+/g, '');
        const digits = raw.replace(/\D/g, '');
        let detected = '';
        if (raw.includes('@')) detected = 'email';
        else if (/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(compact)) detected = 'aleatoria';
        else if (/^\d{3}\.\d{3}\.\d{3}-\d{2}$/.test(compact)) detected = 'cpf';
        else if (/^\d{2}\.\d{3}\.\d{3}\/\d{4}-\d{2}$/.test(compact)) detected = 'cnpj';
        else if (raw.startsWith('+') || /\(\s*\d{2}\s*\)/.test(raw) || ((digits.length === 12 || digits.length === 13) && digits.startsWith('55')) || digits.length === 10) detected = 'telefone';

        if (detected) pixTipoField.value = detected;
    }

    updateFormaPagamentoFields({ clearHidden = false } = {}) {
        const formaPagamentoField = document.getElementById('funcionarioFormaPagamento');
        const pixFavorecidoGroup = document.getElementById('funcionarioPixFavorecidoGroup');
        const pixGroup = document.getElementById('funcionarioPixGroup');
        const pixTipoGroup = document.getElementById('funcionarioPixTipoGroup');
        const contaGroup = document.getElementById('funcionarioContaBancariaGroup');
        const pixFavorecidoField = document.getElementById('funcionarioPixFavorecido');
        const pixField = document.getElementById('funcionarioPix');
        const pixTipoField = document.getElementById('funcionarioPixTipo');
        const beneficiarioGroup = document.getElementById('funcionarioBeneficiarioGroup');
        const bancoGroup = document.getElementById('funcionarioBancoGroup');
        const agenciaGroup = document.getElementById('funcionarioAgenciaGroup');
        const contaFieldGroup = document.getElementById('funcionarioContaGroup');
        const beneficiarioField = document.getElementById('funcionarioBeneficiario');
        const bancoField = document.getElementById('funcionarioBanco');
        const agenciaField = document.getElementById('funcionarioAgencia');
        const contaField = document.getElementById('funcionarioConta');
        if (!formaPagamentoField || !pixGroup || !contaGroup) return;
        const forma = String(formaPagamentoField.value || '').trim();
        const mostrarPix = forma === 'PIX';
        const mostrarConta = forma === 'Conta Bancária';
        if (pixFavorecidoGroup) pixFavorecidoGroup.style.display = mostrarPix ? 'flex' : 'none';
        pixGroup.style.display = mostrarPix ? 'flex' : 'none';
        if (pixTipoGroup) pixTipoGroup.style.display = mostrarPix ? 'flex' : 'none';
        contaGroup.style.display = (mostrarConta || mostrarPix) ? 'grid' : 'none';
        if (beneficiarioGroup) beneficiarioGroup.style.display = mostrarConta ? 'flex' : 'none';
        if (bancoGroup) bancoGroup.style.display = (mostrarConta || mostrarPix) ? 'flex' : 'none';
        if (agenciaGroup) agenciaGroup.style.display = mostrarConta ? 'flex' : 'none';
        if (contaFieldGroup) contaFieldGroup.style.display = mostrarConta ? 'flex' : 'none';
        if (clearHidden) {
            if (!mostrarPix) {
                if (pixFavorecidoField) pixFavorecidoField.value = '';
                if (pixField) pixField.value = '';
                if (pixTipoField) pixTipoField.value = '';
            }
            if (!mostrarConta) {
                if (beneficiarioField) beneficiarioField.value = '';
                if (agenciaField) agenciaField.value = '';
                if (contaField) contaField.value = '';
            }
            if (!mostrarConta && !mostrarPix && bancoField) bancoField.value = '';
        }
    }
    
    /**
     * 🔄 CONFIGURAR TOGGLE FUNCIONÁRIO ATIVO
     */
    setupFuncionarioAtivoToggle() {
        const funcionarioAtivo = document.getElementById('funcionarioAtivo');
        const toggleSwitch = document.querySelector('#funcionarioAtivoContainer .toggle-switch');
        
        if (funcionarioAtivo) {
            if (!funcionarioAtivo._ativoToggleBound) {
                funcionarioAtivo.addEventListener('change', () => this.updateFuncionarioAtivoDescription());
                funcionarioAtivo._ativoToggleBound = true;
            }
            
            if (toggleSwitch && !toggleSwitch._ativoToggleClickBound) {
                toggleSwitch.addEventListener('click', (event) => {
                    if (event.target === funcionarioAtivo) return;
                    funcionarioAtivo.checked = !funcionarioAtivo.checked;
                    funcionarioAtivo.dispatchEvent(new Event('change'));
                });
                toggleSwitch._ativoToggleClickBound = true;
            }
            
            // Configurar estado inicial
            this.updateFuncionarioAtivoDescription();
            console.log('✅ Toggle funcionário ativo configurado');
        }
    }
    
    /**
     * 📝 ATUALIZAR DESCRIÇÃO DO TOGGLE FUNCIONÁRIO ATIVO
     */
    updateFuncionarioAtivoDescription() {
        const funcionarioAtivo = document.getElementById('funcionarioAtivo');
        const descricao = document.getElementById('funcionarioAtivoDescricao');
        const container = document.getElementById('funcionarioAtivoContainer');
        
        if (!funcionarioAtivo || !descricao || !container) return;
        
        if (funcionarioAtivo.checked) {
            descricao.textContent = 'Funcionário Ativo - Aparece nos relatórios e lançamentos';
            container.className = 'toggle-container funcionario-ativo';
        } else {
            descricao.textContent = 'Funcionário Inativo - NÃO aparece nos relatórios e lançamentos';
            container.className = 'toggle-container funcionario-inativo';
        }
    }
    
    /**
     * 👆 CONFIGURAR RASTREAMENTO DE CAMPOS DE FUNCIONÁRIO
     */
    setupFuncionarioFieldTracking() {
        console.log('👆 Configurando rastreamento de campos de funcionário...');
        
        const camposFuncionario = [
            'funcionarioFiltro',      // Filtro principal
            'folhaFuncionario',       // Modal de folha
            'filtroFechadasFuncionario', // Modal de folhas fechadas
            'funcionarioRelatorio',   // Modal de relatórios
            'bh-funcionario-nome',    // Modal de BH - lançamento
            'bh-ger-func-nome'        // Modal de BH - gerenciar
        ];
        
        camposFuncionario.forEach(campoId => {
            const campo = document.getElementById(campoId);
            if (campo) {
                // Remover listeners existentes para evitar duplicação
                campo.removeEventListener('focus', this.handleFuncionarioFieldFocus);
                
                // Adicionar listener de foco
                campo.addEventListener('focus', (e) => this.handleFuncionarioFieldFocus(e));
                console.log(`✅ Rastreamento configurado para: ${campoId}`);
            }
        });
    }
    
    /**
     * 👆 HANDLER PARA FOCO EM CAMPO DE FUNCIONÁRIO
     */
    handleFuncionarioFieldFocus(e) {
        const camposFuncionario = ['funcionarioFiltro', 'folhaFuncionario', 'filtroFechadasFuncionario', 'funcionarioRelatorio', 'bh-funcionario-nome', 'bh-ger-func-nome'];
        
        // Limpar flag de outros campos
        camposFuncionario.forEach(campoId => {
            const campo = document.getElementById(campoId);
            if (campo && campo !== e.target) {
                campo.dataset.lastFocused = 'false';
            }
        });
        
        // Marcar este campo como o último focado
        e.target.dataset.lastFocused = 'true';
        console.log(`👆 Campo ${e.target.id} marcado como lastFocused`);
    }

    _isModalVisible(id) {
        const modal = document.getElementById(id);
        if (!modal) return false;
        const style = window.getComputedStyle ? window.getComputedStyle(modal) : null;
        return modal.style.display === 'block' || (style && style.display !== 'none' && style.visibility !== 'hidden');
    }

    _setFuncionarioTargetField(targetId) {
        const input = document.getElementById(targetId);
        if (!input) return false;
        this.targetField = targetId;
        const camposFuncionario = ['funcionarioFiltro', 'folhaFuncionario', 'filtroFechadasFuncionario', 'funcionarioRelatorio', 'bh-funcionario-nome', 'bh-ger-func-nome'];
        camposFuncionario.forEach((campoId) => {
            const campo = document.getElementById(campoId);
            if (campo) campo.dataset.lastFocused = campoId === targetId ? 'true' : 'false';
        });
        return true;
    }

    _isFuncionarioTargetUsable(targetId) {
        const input = document.getElementById(targetId);
        if (!input) return false;
        if (input === document.activeElement || input.offsetParent !== null) return true;
        if (targetId === 'folhaFuncionario') return this._isModalVisible('folhaModal');
        if (targetId === 'filtroFechadasFuncionario') return this._isModalVisible('folhasFechadasModal');
        return false;
    }

    _prepareFuncionarioSelectionTarget() {
        const camposFuncionario = ['funcionarioFiltro', 'folhaFuncionario', 'filtroFechadasFuncionario', 'funcionarioRelatorio', 'bh-funcionario-nome', 'bh-ger-func-nome'];
        if (this.targetField && this._isFuncionarioTargetUsable(this.targetField)) {
            this._setFuncionarioTargetField(this.targetField);
            return this.targetField;
        } else if (this.targetField) {
            this.targetField = null;
        }

        const activeId = document.activeElement && document.activeElement.id;
        if (activeId && camposFuncionario.includes(activeId)) {
            this._setFuncionarioTargetField(activeId);
            return activeId;
        }

        if (this._isModalVisible('folhaModal') && document.getElementById('folhaFuncionario')) {
            this._setFuncionarioTargetField('folhaFuncionario');
            return 'folhaFuncionario';
        }

        if (this._isModalVisible('folhasFechadasModal') && document.getElementById('filtroFechadasFuncionario')) {
            this._setFuncionarioTargetField('filtroFechadasFuncionario');
            return 'filtroFechadasFuncionario';
        }

        return '';
    }
    
    /**
     * 🚪 CONFIGURAR HANDLERS DOS MODAIS
     */
    setupModalHandlers() {
        // Close modal funcionário
        const closeButtons = document.querySelectorAll('.close-modal, .close-modal-btn');
        closeButtons.forEach(btn => {
            btn.addEventListener('click', () => this.closeFuncionarioModal());
        });
        
        // Click outside modal
        const modal = document.getElementById('funcionarioModal');
        if (modal) {
            modal.addEventListener('click', (e) => {
                if (e.target === modal) {
                    this.closeFuncionarioModal();
                }
            });
        }
    }

    async migrateLegacyFuncionariosIfNeeded() {
        try {
            const alreadyDone = localStorage.getItem('func_migration_done_v1') === '1';
            if (alreadyDone) return;
            const manager = window.getFirebaseManager && window.getFirebaseManager();
            if (!manager || typeof manager.loadData !== 'function') return;
            const legacy = await manager.loadData('folha/funcionarios', { useCache: false, forceRefresh: true });
            const legacyKeys = legacy && typeof legacy === 'object' ? Object.keys(legacy) : [];
            if (!legacyKeys.length) {
                try { persistLocalValue('func_migration_done_v1', '1'); } catch {}
                return;
            }
            const canon = await manager.loadData('funcionarios', { useCache: false, forceRefresh: true });
            const canonObj = (canon && typeof canon === 'object') ? { ...canon } : {};
            const backupKey = `func_migration_backup_${Date.now()}`;
            try { persistLocalValue(backupKey, { legacy, canon: canonObj }); } catch {}
            let copied = 0;
            legacyKeys.forEach(k => {
                if (!canonObj[k]) {
                    canonObj[k] = legacy[k];
                    copied++;
                }
            });
            if (copied > 0) {
                await manager.saveData('funcionarios', canonObj, { showToast: false });
            }
            try { persistLocalValue('func_migration_done_v1', '1'); } catch {}
            console.log(`✅ Migração de funcionários concluída: ${copied} item(ns)`);
        } catch (e) {
            console.warn('⚠️ Falha na migração de funcionários:', e);
        }
    }
    
    /**
     * 📂 CARREGAR FUNCIONÁRIOS DO FIREBASE
     */
    async loadFuncionarios() {
        try {
            console.log('📂 Carregando funcionários...');
            // Verificar se FolhaUtils existe antes de usar
            if (window.FolhaUtils && window.FolhaUtils.showLoading) {
            window.FolhaUtils.showLoading();
            }

            await this.migrateLegacyFuncionariosIfNeeded();
            
            const collection = window.FUNCIONARIOS_CONFIG ? window.FUNCIONARIOS_CONFIG.COLLECTION : 'funcionarios';
            console.log(`🔍 Buscando na coleção: ${collection}`);
            
            // ✅ CORREÇÃO CRÍTICA: Sempre carregar dados frescos do banco (sem cache)
            let funcionarios = {};
            try {
                const manager = window.getFirebaseManager && window.getFirebaseManager();
                if (manager) {
                    const candidatePaths = [
                        `${collection}`
                    ];
                    const acumulado = {};
                    for (const p of candidatePaths) {
                        try {
                            const data = await manager.loadData(p, { useCache: false });
                            if (data && typeof data === 'object') {
                                Object.values(data).forEach((f) => {
                                    if (!f) return;
                                    const key = (f.id) || (f.cpf ? String(f.cpf).replace(/\D/g, '') : null);
                                    if (!key) return;
                                    acumulado[key] = f; // dedup por id/cpf normalizado
                                });
                                console.log(`✅ Funcionários acumulados de: ${p} (+${Object.keys(data).length})`);
                            }
                        } catch (inner) {
                            // tentar próximo caminho
                        }
                    }
                    funcionarios = acumulado;
                } else if (window.getData) {
                    try {
                        funcionarios = await window.getData(collection);
                    } catch (e) {
                        console.warn('⚠️ Falha ao carregar via getData:', e);
                    }
                }
            } catch (e) {
                console.warn('⚠️ Falha ao carregar via manager/getData, retornando objeto vazio', e);
                funcionarios = {};
            }
            if (window.__folhaDebugAll) console.log('📊 Dados brutos do banco:', funcionarios);
            
            // Converter objeto em array para compatibilidade
            let funcionariosArray = [];
            if (funcionarios && typeof funcionarios === 'object') {
                funcionariosArray = Object.values(funcionarios);
            } else {
                funcionariosArray = funcionarios || [];
            }
            
            // ✅ FILTRAR APENAS DADOS DE TESTE CONHECIDOS - MANTER TODOS OS FUNCIONÁRIOS (ATIVOS E INATIVOS)
            const funcionariosReais = funcionariosArray.filter(func => {
                // ✅ FILTRO MÍNIMO - APENAS DADOS DE TESTE ESPECÍFICOS
                
                // Rejeitar APENAS o ID de teste específico que apareceu
                if (func.id === 'teste_1754574534414') {
                    if (window.__folhaDebugAll) console.warn('🧪 Rejeitando funcionário de teste conhecido:', func.nome, func.id);
                    return false;
                }
                
                // Rejeitar APENAS nome exato "Funcionário Teste"
                if (func.nome === 'Funcionário Teste') {
                    if (window.__folhaDebugAll) console.warn('🧪 Rejeitando funcionário de teste conhecido:', func.nome, func.id);
                    return false;
                }
                
                // ✅ ACEITAR TODOS OS OUTROS (ATIVOS E INATIVOS PARA PERMITIR EDIÇÃO)
                if (window.__folhaDebugAll) {
                    const status = func.ativo === false ? 'INATIVO' : 'ATIVO';
                    console.log(`✅ Funcionário ${status} aceito:`, func.nome, func.id);
                }
                return true;
            });
            
            this.funcionarios = funcionariosReais;
            
            if (window.__folhaDebugAll) {
                console.log(`✅ Funcionários reais carregados: ${this.funcionarios.length}`);
                console.log(`🧪 Funcionários de teste rejeitados: ${funcionariosArray.length - this.funcionarios.length}`);
                
                console.log('📊 === RELATÓRIO DETALHADO DE CARREGAMENTO ===');
                console.log(`📁 Total no banco: ${funcionariosArray.length}`);
                console.log(`✅ Aceitos: ${this.funcionarios.length}`);
                console.log(`🧪 Rejeitados: ${funcionariosArray.length - this.funcionarios.length}`);
                
                if (this.funcionarios.length > 0) {
                    console.log('✅ FUNCIONÁRIOS ACEITOS:');
                    this.funcionarios.forEach((func, index) => {
                        console.log(`   ${index + 1}. ${func.nome} (ID: ${func.id}) - CPF: ${func.cpf || 'N/A'} - Cargo: ${func.cargo || 'N/A'}`);
                    });
                } else {
                    if (funcionariosArray.length > 0) {
                        console.warn('⚠️ NENHUM FUNCIONÁRIO FOI ACEITO! Verifique os filtros.');
                    }
                }
                
                const rejeitados = funcionariosArray.filter(func => !this.funcionarios.includes(func));
                if (rejeitados.length > 0) {
                    console.log('🧪 FUNCIONÁRIOS REJEITADOS:');
                    rejeitados.forEach((func, index) => {
                        console.log(`   ${index + 1}. ${func.nome} (ID: ${func.id}) - CPF: ${func.cpf || 'N/A'} - Cargo: ${func.cargo || 'N/A'}`);
                    });
                }
            }
            
        } catch (error) {
            console.error('❌ Erro ao carregar funcionários:', error);
            // Usar toast se disponível, senão apenas console
            if (window.FolhaUtils && window.FolhaUtils.showToast) {
            window.FolhaUtils.showToast('Erro ao carregar funcionários', 'error');
            }
        } finally {
            // Verificar se FolhaUtils existe antes de usar
            if (window.FolhaUtils && window.FolhaUtils.hideLoading) {
            window.FolhaUtils.hideLoading();
            }
        }
    }
    
    /**
     * 🆕 ABRIR MODAL NOVO FUNCIONÁRIO
     */
    openNovoFuncionarioModal() {
        console.log('🆕 Abrindo modal novo funcionário');
        
        this.isEditMode = false;
        this.funcionarioAtual = null;
        
        // Limpar formulário
        this.clearFuncionarioForm();
        
        // Configurar modal
        const modal = document.getElementById('funcionarioModal');
        const title = document.getElementById('funcionarioModalTitle');
        const saveBtn = document.getElementById('saveFuncionarioBtn');
        
        if (title) title.textContent = 'Novo Funcionário';
        if (saveBtn) saveBtn.textContent = 'Salvar';
        
        // Mostrar modal
        if (modal) {
            modal.style.display = 'block';
            
            // Focar imediatamente (requestAnimationFrame é melhor que setTimeout fixo)
            requestAnimationFrame(() => {
                // Garantir que o toggle esteja ativo
                const funcionarioAtivo = document.getElementById('funcionarioAtivo');
                if (funcionarioAtivo) {
                    funcionarioAtivo.checked = true;
                    this.updateFuncionarioAtivoDescription();
                }
                
                // Focar no primeiro campo
                const nomeField = document.getElementById('funcionarioNome');
                if (nomeField) nomeField.focus();
            });
        }
    }
    
    /**
     * ✏️ ABRIR MODAL EDITAR FUNCIONÁRIO
     */
    openEditFuncionarioModal(funcionarioId, opcoes = {}) {
        console.log('✏️ Abrindo modal editar funcionário:', funcionarioId);
        console.log('📊 Funcionários disponíveis:', this.funcionarios.length);
        console.log('🔍 IDs disponíveis:', this.funcionarios.map(f => f.id));
        
        const funcionario = this.funcionarios.find(f => f.id === funcionarioId);
        if (!funcionario) {
            console.error('❌ Funcionário não encontrado! ID procurado:', funcionarioId);
            window.FolhaUtils.showToast('Funcionário não encontrado', 'error');
            return;
        }
        
        console.log('✅ Funcionário encontrado:', funcionario);
        
        // Fechar modal da lista se estiver aberto (para evitar sobreposição)
        const listModal = document.getElementById('funcionariosListModal');
        if (listModal && listModal.style.display === 'block') {
            console.log('🔄 Fechando modal da lista antes de abrir edição');
            this.closeFuncionariosListModal();
            
            // Aguardar um pouco para o modal da lista fechar completamente
            setTimeout(() => {
                this.showEditModal(funcionario, opcoes);
            }, 200);
        } else {
            // Se não há modal da lista aberto, abrir imediatamente
            this.showEditModal(funcionario, opcoes);
        }
    }
    
    /**
     * 🎭 MOSTRAR MODAL DE EDIÇÃO
     */
    showEditModal(funcionario, opcoes = {}) {
        this.isEditMode = true;
        this.funcionarioAtual = funcionario;
        
        // Configurar modal
        const modal = document.getElementById('funcionarioModal');
        const title = document.getElementById('funcionarioModalTitle');
        const saveBtn = document.getElementById('saveFuncionarioBtn');
        
        if (title) title.textContent = 'Editar Funcionário';
        if (saveBtn) saveBtn.textContent = 'Atualizar';
        
        // Mostrar modal
        if (modal) {
            modal.style.display = 'block';
            
            // Aguardar um pouco e preencher formulário após modal estar visível
            setTimeout(() => {
                this.fillFuncionarioForm(funcionario);
                this.updateFuncionarioAtivoDescription();
                const focusFieldId = String(opcoes.focusField || 'funcionarioNome');
                const focusField = document.getElementById(focusFieldId);
                if (focusField) {
                    focusField.focus();
                    if (typeof focusField.select === 'function') focusField.select();
                }
            }, 100);
        }
    }
    
    /**
     * ❌ FECHAR MODAL FUNCIONÁRIO
     */
    closeFuncionarioModal() {
        const modal = document.getElementById('funcionarioModal');
        if (modal) {
            modal.style.display = 'none';
        }
        
        this.clearFuncionarioForm();
        this.funcionarioAtual = null;
        this.isEditMode = false;
    }
    
    /**
     * 🧹 LIMPAR FORMULÁRIO DE FUNCIONÁRIO
     */
    clearFuncionarioForm() {
        const form = document.getElementById('funcionarioForm');
        if (form) {
            form.reset();
            
            // Resetar toggle para ativo (padrão)
            const funcionarioAtivo = document.getElementById('funcionarioAtivo');
            if (funcionarioAtivo) {
                funcionarioAtivo.checked = true;
                this.updateFuncionarioAtivoDescription();
            }
            this.updateFormaPagamentoFields({ clearHidden: false });
            
            // Limpar validações visuais
            const fields = form.querySelectorAll('.form-field-error');
            fields.forEach(field => field.classList.remove('form-field-error'));
            
            const errorMessages = form.querySelectorAll('.field-error-message');
            errorMessages.forEach(msg => msg.remove());
        }
    }
    
    /**
     * 📝 PREENCHER FORMULÁRIO COM DADOS DO FUNCIONÁRIO
     */
    fillFuncionarioForm(funcionario) {
        console.log('📝 Preenchendo formulário com dados do funcionário:', funcionario.nome);
        
        const nomeNorm = (function(){ const v = String(funcionario.nome||''); return (window.isAllCaps && window.toTitleCasePt && window.isAllCaps(v)) ? window.toTitleCasePt(v) : v; })();
        const cargoNorm = (function(){ const v = String(funcionario.cargo||''); return (window.isAllCaps && window.toTitleCasePt && window.isAllCaps(v)) ? window.toTitleCasePt(v) : v; })();
        const favorecidoPix = funcionario.favorecidoPix || funcionario.nomeFavorecidoPix || (funcionario.formaPagamento === 'PIX' ? funcionario.beneficiario : '');
        const pixTipo = this.resolvePixTipo(funcionario);
        const fields = {
            'funcionarioId': funcionario.id,
            'funcionarioNome': nomeNorm,
            'funcionarioCpf': funcionario.cpf,
            'funcionarioPis': funcionario.pis,
            'funcionarioCtps': funcionario.ctps,
            'funcionarioCargo': cargoNorm,
            'funcionarioSalario': funcionario.salarioBase,
            'funcionarioTipoContrato': funcionario.tipoContrato,
            'funcionarioDataAdmissional': funcionario.dataAdmissional,
            'funcionarioFormaPagamento': funcionario.formaPagamento,
            'funcionarioPixFavorecido': favorecidoPix,
            'funcionarioPix': funcionario.pix,
            'funcionarioPixTipo': pixTipo,
            'funcionarioBeneficiario': funcionario.beneficiario,
            'funcionarioBanco': funcionario.banco,
            'funcionarioAgencia': funcionario.agencia,
            'funcionarioConta': funcionario.conta
        };
        
        Object.entries(fields).forEach(([fieldId, value]) => {
            const field = document.getElementById(fieldId);
            if (field && value !== undefined) {
                field.value = value;
                console.log(`✅ Campo preenchido: ${fieldId} = ${value}`);
            } else if (!field) {
                console.warn(`⚠️ Campo não encontrado: ${fieldId}`);
            }
        });
        
        // Configurar toggle ativo (padrão true se não especificado)
        const funcionarioAtivo = document.getElementById('funcionarioAtivo');
        if (funcionarioAtivo) {
            funcionarioAtivo.checked = funcionario.ativo !== false; // true por padrão
            console.log(`✅ Toggle ativo configurado: ${funcionarioAtivo.checked} (valor original: ${funcionario.ativo})`);
            this.updateFuncionarioAtivoDescription();
        } else {
            console.warn('⚠️ Campo funcionarioAtivo não encontrado');
        }
        this.updateFormaPagamentoFields();
    }
    
    /**
     * 💾 HANDLE SUBMIT DO FORMULÁRIO
     */
    async handleSubmitFuncionario(event) {
        event.preventDefault();
        
        // PROTEÇÃO CONTRA EXECUÇÃO DUPLICA
        if (this._savingFuncionario) {
            console.log('⚠️ Salvamento de funcionário já em andamento, ignorando...');
            return;
        }
        
        this._savingFuncionario = true;
        
        // Timeout de segurança para resetar flag se algo travar muito
        const safetyTimeout = setTimeout(() => {
            if (this._savingFuncionario) {
                console.warn('⚠️ Timeout de segurança: resetando flag de salvamento de funcionário');
                this._savingFuncionario = false;
                const btn = document.getElementById('saveFuncionarioBtn');
                if (btn) {
                    btn.disabled = false;
                    btn.textContent = this.isEditMode ? 'Atualizar' : 'Salvar';
                }
                window.FolhaUtils.hideLoading();
            }
        }, 15000); // 15 segundos

        const btn = document.getElementById('saveFuncionarioBtn');
        const originalBtnText = btn ? btn.textContent : (this.isEditMode ? 'Atualizar' : 'Salvar');
        
        if (btn) {
            btn.disabled = true;
            btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Salvando...';
        }
        
        console.log('💾 Salvando funcionário...');
        
        try {
            // Validar formulário
            if (!this.validateFuncionarioForm()) {
                return;
            }
            
            // Coletar dados
            const funcionarioData = this.collectFuncionarioData();
            
            window.FolhaUtils.showLoading();
            
            if (this.isEditMode) {
                await this.updateFuncionario(funcionarioData);
            } else {
                await this.createFuncionario(funcionarioData);
            }
            
            this.closeFuncionarioModal();
            
            // ✅ CORREÇÃO CRÍTICA: Recarregar funcionários ANTES de notificar outros módulos
            console.log('🔄 Recarregando funcionários após salvamento...');
            await this.loadFuncionarios();
            console.log(`✅ Funcionários recarregados: ${this.funcionarios.length} itens`);
            
            // ✅ NOTIFICAR SISTEMA PRINCIPAL PARA RECARREGAR DADOS
            if (window.folhaSystem) {
                console.log('🔄 Notificando sistema principal para recarregar funcionários...');
                await window.folhaSystem.reloadSpecificData('funcionarios');
                console.log('✅ Sistema principal atualizado');
                
                // ✅ FORÇAR ATUALIZAÇÃO IMEDIATA DA INTERFACE
                setTimeout(() => {
                    console.log('🔄 Forçando atualização da interface após salvamento...');
                    window.folhaSystem.updateInterface();
                }, 500);
            }
            
            // ✅ DISPARAR EVENTO PERSONALIZADO PARA OUTROS MÓDULOS
            window.dispatchEvent(new CustomEvent('funcionarios:updated', {
                detail: { funcionarioData }
            }));
            
            // ✅ NOTIFICAR OUTROS MÓDULOS DIRETAMENTE COM DADOS ATUALIZADOS
            if (window.folhaLancamentos) {
                console.log('🔄 Notificando módulo de lançamentos...');
                setTimeout(() => {
                    // ✅ CORREÇÃO: Passar funcionários atualizados para o módulo de lançamentos
                    if (window.folhaLancamentos.updateFolhasTable) {
                        window.folhaLancamentos.updateFolhasTable();
                    }
                }, 300);
            }
            
            if (window.folhaFiltros) {
                console.log('🔄 Notificando módulo de filtros...');
                setTimeout(() => {
                    if (window.folhaFiltros.aplicarFiltros) {
                        window.folhaFiltros.aplicarFiltros();
                    }
                }, 300);
            }
            
            // ✅ CORREÇÃO CRÍTICA: Forçar atualização da lista de funcionários se o modal estiver aberto
            const listModal = document.getElementById('funcionariosListModal');
            if (listModal && listModal.style && listModal.style.display === 'block') {
                console.log('🔄 Modal de lista aberto - atualizando tabela...');
                this.updateFuncionariosListTable();
            }
            
            // ✅ CORREÇÃO CRÍTICA: Sincronizar todos os módulos após salvamento
            if (window.folhaSystem && typeof window.folhaSystem.sincronizarModulos === 'function') {
                console.log('🔄 Sincronizando módulos após salvamento...');
                setTimeout(async () => {
                    try {
                        await window.folhaSystem.sincronizarModulos();
                        console.log('✅ Sincronização concluída após salvamento');
                    } catch (error) {
                        console.error('❌ Erro na sincronização:', error);
                    }
                }, 500); // Delay para garantir que o banco foi atualizado
            } else {
                console.log('⚠️ folhaSystem.sincronizarModulos não disponível, usando fallback');
                // Fallback: recarregar funcionários e atualizar interface
                setTimeout(async () => {
                    await this.reloadFuncionarios();
                }, 500);
            }
            
        } catch (error) {
            console.error('❌ Erro ao salvar funcionário:', error);
            window.FolhaUtils.showToast('Erro ao salvar funcionário', 'error');
        } finally {
            clearTimeout(safetyTimeout);
            window.FolhaUtils.hideLoading();
            // Liberar flag de salvamento
            this._savingFuncionario = false;
            
            if (btn) {
                btn.disabled = false;
                btn.textContent = originalBtnText;
            }
        }
    }
    
    /**
     * 📊 COLETAR DADOS DO FORMULÁRIO
     */
    collectFuncionarioData() {
        const form = document.getElementById('funcionarioForm');
        const formData = new FormData(form);
        
        const funcionario = {
            nome: (function(){ const v = document.getElementById('funcionarioNome').value.trim(); return window.isAllCaps(v) ? window.toTitleCasePt(v) : v; })(),
            cpf: document.getElementById('funcionarioCpf').value.trim(),
            pis: document.getElementById('funcionarioPis').value.trim(),
            ctps: document.getElementById('funcionarioCtps').value.trim(),
            cargo: (function(){ const v = document.getElementById('funcionarioCargo').value.trim(); return window.isAllCaps(v) ? window.toTitleCasePt(v) : v; })(),
            salarioBase: parseFloat(document.getElementById('funcionarioSalario').value) || 0,
            tipoContrato: document.getElementById('funcionarioTipoContrato').value,
            dataAdmissional: document.getElementById('funcionarioDataAdmissional').value,
            formaPagamento: document.getElementById('funcionarioFormaPagamento').value.trim(),
            favorecidoPix: document.getElementById('funcionarioPixFavorecido').value.trim(),
            pixTipo: (function(){
                const field = document.getElementById('funcionarioPixTipo');
                const raw = field ? field.value.trim() : '';
                return (window.FolhaUtils && typeof window.FolhaUtils.normalizePixKeyType === 'function')
                    ? window.FolhaUtils.normalizePixKeyType(raw)
                    : raw;
            })(),
            pix: document.getElementById('funcionarioPix').value.trim(),
            beneficiario: document.getElementById('funcionarioBeneficiario').value.trim(),
            banco: document.getElementById('funcionarioBanco').value.trim(),
            agencia: document.getElementById('funcionarioAgencia').value.trim(),
            conta: document.getElementById('funcionarioConta').value.trim(),
            dataAtualizacao: new Date().toISOString(),
            ativo: (document.getElementById('funcionarioAtivo') && document.getElementById('funcionarioAtivo').checked) !== false // Padrão true, false apenas se explicitamente desmarcado
        };

        // Normalizar CPF salvo (sem máscara) para consistência
        if (funcionario.cpf) {
            funcionario.cpf = funcionario.cpf.replace(/\D/g, '');
        }
        
        if (this.isEditMode && this.funcionarioAtual) {
            funcionario.id = this.funcionarioAtual.id;
            funcionario.dataCriacao = this.funcionarioAtual.dataCriacao;
        } else {
            const fallbackId = 'id_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
            const genId = (window.FolhaUtils && typeof window.FolhaUtils.generateId === 'function')
                ? window.FolhaUtils.generateId()
                : fallbackId;
            funcionario.id = genId;
            funcionario.dataCriacao = new Date().toISOString();
        }
        
        return funcionario;
    }
    
    /**
     * ✅ VALIDAR FORMULÁRIO DE FUNCIONÁRIO
     */
    validateFuncionarioForm() {
        let isValid = true;
        const errors = [];
        
        // Validar campos obrigatórios
        const requiredFields = {
            'funcionarioNome': 'Nome é obrigatório',
            'funcionarioCpf': 'CPF é obrigatório',
            'funcionarioSalario': 'Salário base é obrigatório',
            'funcionarioTipoContrato': 'Tipo de contrato é obrigatório',
            'funcionarioDataAdmissional': 'Data admissional é obrigatória'
        };
        
        Object.entries(requiredFields).forEach(([fieldId, message]) => {
            const field = document.getElementById(fieldId);
            if (!field || !field.value.trim()) {
                this.showFieldError(field, message);
                isValid = false;
                errors.push(message);
            } else {
                this.clearFieldError(field);
            }
        });
        
        // Validar CPF
        const cpfField = document.getElementById('funcionarioCpf');
        if (cpfField && cpfField.value.trim()) {
            // Remover máscara antes de validar
            const rawCpf = cpfField.value.replace(/\D/g, '');
            if (!this.validateCPF(rawCpf, cpfField)) {
                isValid = false;
                errors.push('CPF inválido');
            }
        }
        
        // Validar PIS (se preenchido)
        const pisField = document.getElementById('funcionarioPis');
        if (pisField && pisField.value.trim()) {
            if (!this.validatePIS(pisField.value, pisField)) {
                isValid = false;
                errors.push('PIS inválido');
            }
        }
        
        // Validar salário
        const salarioField = document.getElementById('funcionarioSalario');
        if (salarioField && salarioField.value) {
            const salario = parseFloat(salarioField.value);
            if (isNaN(salario) || salario <= 0) {
                this.showFieldError(salarioField, 'Salário deve ser maior que zero');
                isValid = false;
                errors.push('Salário inválido');
            } else {
                this.clearFieldError(salarioField);
            }
        }

        const formaPagamentoField = document.getElementById('funcionarioFormaPagamento');
        const pixField = document.getElementById('funcionarioPix');
        const pixTipoField = document.getElementById('funcionarioPixTipo');
        const beneficiarioField = document.getElementById('funcionarioBeneficiario');
        const bancoField = document.getElementById('funcionarioBanco');
        const agenciaField = document.getElementById('funcionarioAgencia');
        const contaField = document.getElementById('funcionarioConta');
        const formaPagamento = String((formaPagamentoField && formaPagamentoField.value) || '').trim();
        if (formaPagamento === 'PIX') {
            const pixValue = pixField ? pixField.value.trim() : '';
            const pixTipoValue = pixTipoField ? pixTipoField.value.trim() : '';
            if (pixField && !pixValue) {
                this.showFieldError(pixField, 'Informe a chave PIX para forma de pagamento PIX');
                isValid = false;
                errors.push('Chave PIX obrigatória');
            } else if (pixField) {
                this.clearFieldError(pixField);
            }
            if (pixTipoField && !pixTipoValue) {
                this.showFieldError(pixTipoField, 'Selecione CPF, CNPJ, Telefone, E-mail ou Aleatória conforme o cadastro no banco');
                isValid = false;
                errors.push('Tipo da chave PIX obrigatório');
            } else if (pixTipoField) {
                this.clearFieldError(pixTipoField);
            }
            if (pixValue && pixTipoValue && window.FolhaUtils && typeof window.FolhaUtils.normalizePixKeyForBrCode === 'function') {
                const pixNormalizado = window.FolhaUtils.normalizePixKeyForBrCode(pixValue, pixTipoValue);
                if (!pixNormalizado) {
                    this.showFieldError(pixField, 'Chave PIX incompatível com o tipo selecionado. Confira CPF/CNPJ, telefone com DDD, e-mail ou chave aleatória');
                    isValid = false;
                    errors.push('Chave PIX inválida');
                }
            }
        }
        if (formaPagamento === 'Conta Bancária') {
            if (beneficiarioField && !beneficiarioField.value.trim()) {
                this.showFieldError(beneficiarioField, 'Informe o beneficiário');
                isValid = false;
                errors.push('Beneficiário obrigatório');
            }
            if (bancoField && !bancoField.value.trim()) {
                this.showFieldError(bancoField, 'Informe o banco');
                isValid = false;
                errors.push('Banco obrigatório');
            }
            if (agenciaField && !agenciaField.value.trim()) {
                this.showFieldError(agenciaField, 'Informe a agência');
                isValid = false;
                errors.push('Agência obrigatória');
            }
            if (contaField && !contaField.value.trim()) {
                this.showFieldError(contaField, 'Informe a conta');
                isValid = false;
                errors.push('Conta obrigatória');
            }
        }
        
        // Validar duplicação de CPF
        if (!this.isEditMode || (this.isEditMode && cpfField.value !== this.funcionarioAtual.cpf)) {
            const cpfRaw = cpfField.value.replace(/\D/g, '');
            const cpfExists = this.funcionarios.some(f => (f.cpf || '').replace(/\D/g, '') === cpfRaw);
            if (cpfExists) {
                this.showFieldError(cpfField, 'CPF já cadastrado');
                isValid = false;
                errors.push('CPF já existe');
            }
        }
        
        if (!isValid) {
            window.FolhaUtils.showToast(`Corrija os erros: ${errors.join(', ')}`, 'error');
        }
        
        return isValid;
    }
    
    /**
     * 🆕 CRIAR NOVO FUNCIONÁRIO
     */
    async createFuncionario(funcionarioData) {
        console.log('🆕 Criando funcionário:', funcionarioData.nome);
        
        // ✅ CORREÇÃO: Usar mesma referência que o carregamento
        const collection = window.FUNCIONARIOS_CONFIG ? window.FUNCIONARIOS_CONFIG.COLLECTION : 'funcionarios';
        console.log(`💾 Salvando na coleção: ${collection}`);
        
        const manager = window.getFirebaseManager && window.getFirebaseManager();
        if (manager) {
            await manager.saveData(`folha/${collection}/${funcionarioData.id}`, funcionarioData, { requireAuth: false });
            await manager.saveData(`${collection}/${funcionarioData.id}`, funcionarioData, { requireAuth: false });
        } else if (window.FirebaseService && window.FirebaseService.save) {
            await window.FirebaseService.save(collection, funcionarioData.id, funcionarioData);
        }
        
        window.FolhaUtils.showToast(`Funcionário ${funcionarioData.nome} criado com sucesso!`, 'success');
        console.log('✅ Funcionário criado:', funcionarioData.id);
    }
    
    /**
     * ✏️ ATUALIZAR FUNCIONÁRIO EXISTENTE
     */
    async updateFuncionario(funcionarioData) {
        console.log('✏️ Atualizando funcionário:', funcionarioData.nome);
        
        // ✅ CORREÇÃO: Usar mesma referência que o carregamento
        const collection = window.FUNCIONARIOS_CONFIG ? window.FUNCIONARIOS_CONFIG.COLLECTION : 'funcionarios';
        console.log(`💾 Atualizando na coleção: ${collection}`);
        
        const manager = window.getFirebaseManager && window.getFirebaseManager();
        if (manager) {
            await manager.saveData(`folha/${collection}/${funcionarioData.id}`, funcionarioData, { requireAuth: false });
            await manager.saveData(`${collection}/${funcionarioData.id}`, funcionarioData, { requireAuth: false });
        } else if (window.FirebaseService && window.FirebaseService.save) {
            await window.FirebaseService.save(collection, funcionarioData.id, funcionarioData);
        }
        
        window.FolhaUtils.showToast(`Funcionário ${funcionarioData.nome} atualizado com sucesso!`, 'success');
        console.log('✅ Funcionário atualizado:', funcionarioData.id);
    }
    
    /**
     * 🗑️ EXCLUIR FUNCIONÁRIO
     */
    async deleteFuncionario(funcionarioId) {
        const funcionario = this.funcionarios.find(f => f.id === funcionarioId);
        if (!funcionario) return;
        
        const confirmDelete = confirm(`Tem certeza que deseja excluir o funcionário ${funcionario.nome}?`);
        if (!confirmDelete) return;
        
        try {
            window.FolhaUtils.showLoading();
            
            const collection = window.FUNCIONARIOS_CONFIG ? window.FUNCIONARIOS_CONFIG.COLLECTION : 'funcionarios';
            console.log(`🗑️ Removendo da coleção: ${collection}`);
            if (window.database) {
                const { ref, remove } = await import('../firebase-init.js');
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
                await remove(ref(window.database, resolvePath(`${collection}/${funcionarioId}`)));
            }
            
            window.FolhaUtils.showToast(`Funcionário ${funcionario.nome} excluído com sucesso!`, 'success');
            console.log('✅ Funcionário excluído:', funcionarioId);
            
            await this.loadFuncionarios();
            
        } catch (error) {
            console.error('❌ Erro ao excluir funcionário:', error);
            window.FolhaUtils.showToast('Erro ao excluir funcionário', 'error');
        } finally {
            window.FolhaUtils.hideLoading();
        }
    }
    
    /**
     * 📋 RENDERIZAR LISTA DE FUNCIONÁRIOS (para autocomplete)
     */
    renderFuncionariosList() {
        // Esta função será chamada pelos outros módulos quando precisarem da lista
        console.log(`📋 Lista de funcionários atualizada: ${this.funcionarios.length} itens`);
    }

    /**
     * 🔧 Utilitário: aplicar seleção de funcionário em um input alvo (autocomplete compat)
     */
    applyFuncionarioToTargetInput(funcionario) {
        try {
            const targetId = this.targetField || 'funcionarioFiltro';
            const input = document.getElementById(targetId);
            if (!input || !funcionario) return;
            input.value = funcionario.nome || '';
            input.dataset.funcionarioId = funcionario.id || '';
            try { input.dataset.funcionarioData = JSON.stringify(funcionario); } catch {}
            // Disparar eventos para que filtros captem a mudança
            setTimeout(() => {
                input.dispatchEvent(new Event('change'));
                input.dispatchEvent(new Event('input'));

                // Integração com modal de folha: preencher salário e disparar recálculo
                // (Executado dentro do timeout para garantir que o change listener do input já processou os dados)
                if (targetId === 'folhaFuncionario') {
                    const salInput = document.getElementById('funcionarioSalario');
                    const sal = Number(funcionario.salarioBase || funcionario.salario || 0) || 0;
                    if (salInput && sal > 0) {
                        salInput.value = String(sal);
                        salInput.dispatchEvent(new Event('input', { bubbles: true }));
                        salInput.dispatchEvent(new Event('change', { bubbles: true }));
                    }
                    try {
                        if (window.folhaLancamentos && typeof window.folhaLancamentos.scheduleCalcularFolhaRealTime === 'function') {
                            window.folhaLancamentos.scheduleCalcularFolhaRealTime(120);
                        } else if (window.folhaLancamentos && typeof window.folhaLancamentos.calcularFolhaRealTime === 'function') {
                            window.folhaLancamentos.calcularFolhaRealTime();
                        }
                    } catch {}
                }
            }, 0);
        } catch (e) {
            console.warn('⚠️ Falha ao aplicar funcionário ao input alvo:', e);
        }
    }
    
    /**
     * 🔍 BUSCAR FUNCIONÁRIOS (para autocomplete)
     */
    searchFuncionarios(query) {
        if (!query || query.length < 2) return [];
        
        const searchTerm = query.toLowerCase();
        return this.funcionarios.filter(funcionario => 
            funcionario.nome.toLowerCase().includes(searchTerm) ||
            funcionario.cpf.includes(searchTerm) ||
            funcionario.cargo.toLowerCase().includes(searchTerm)
        );
    }
    
    /**
     * 📄 OBTER FUNCIONÁRIO POR ID
     */
    getFuncionarioById(id) {
        return this.funcionarios.find(f => f.id === id);
    }
    
    /**
     * 📄 OBTER FUNCIONÁRIO POR CPF
     */
    getFuncionarioByCpf(cpf) {
        return this.funcionarios.find(f => f.cpf === cpf);
    }
    
    /**
     * ✅ VALIDAÇÃO DE CPF
     */
    validateCPF(cpf, field) {
        if (!cpf) return true; // Campo pode estar vazio
        
        // Remover formatação
        const cleanCpf = cpf.replace(/\D/g, '');
        
        if (cleanCpf.length !== 11) {
            if (field) this.showFieldError(field, 'CPF deve ter 11 dígitos');
            return false;
        }
        
        // Validar dígitos verificadores
        if (!this.isValidCPF(cleanCpf)) {
            if (field) this.showFieldError(field, 'CPF inválido');
            return false;
        }
        
        if (field) this.clearFieldError(field);
        return true;
    }
    
    /**
     * ✅ VALIDAÇÃO DE PIS
     */
    validatePIS(pis, field) {
        if (!pis) return true; // Campo pode estar vazio
        
        // Remover formatação
        const cleanPis = pis.replace(/\D/g, '');
        
        if (cleanPis.length !== 11) {
            if (field) this.showFieldError(field, 'PIS deve ter 11 dígitos');
            return false;
        }
        
        if (field) this.clearFieldError(field);
        return true;
    }
    
    /**
     * 🔢 ALGORITMO DE VALIDAÇÃO DE CPF
     */
    isValidCPF(cpf) {
        // Invalidar CPFs com todos dígitos iguais
        if (/^(\d)\1{10}$/.test(cpf)) return false;
        
        // Primeiro dígito verificador
        let soma = 0;
        for (let i = 0; i < 9; i++) {
            soma += parseInt(cpf.charAt(i), 10) * (10 - i);
        }
        let resto = soma % 11;
        let digito1 = resto < 2 ? 0 : 11 - resto;
        if (parseInt(cpf.charAt(9), 10) !== digito1) return false;
        
        // Segundo dígito verificador
        soma = 0;
        for (let i = 0; i < 10; i++) {
            soma += parseInt(cpf.charAt(i), 10) * (11 - i);
        }
        resto = soma % 11;
        let digito2 = resto < 2 ? 0 : 11 - resto;
        return parseInt(cpf.charAt(10), 10) === digito2;
    }
    
    /**
     * ⚠️ MOSTRAR ERRO EM CAMPO
     */
    showFieldError(field, message) {
        if (!field) return;
        
        field.classList.add('form-field-error');
        
        // Remover mensagem anterior
        const existingError = field.parentNode.querySelector('.field-error-message');
        if (existingError) {
            existingError.remove();
        }
        
        // Adicionar nova mensagem
        const errorElement = document.createElement('div');
        errorElement.className = 'field-error-message';
        errorElement.textContent = message;
        errorElement.style.color = '#e74c3c';
        errorElement.style.fontSize = '12px';
        errorElement.style.marginTop = '4px';
        
        field.parentNode.appendChild(errorElement);
    }
    
    /**
     * ✅ LIMPAR ERRO DE CAMPO
     */
    clearFieldError(field) {
        if (!field) return;
        
        field.classList.remove('form-field-error');
        
        const errorMessage = field.parentNode.querySelector('.field-error-message');
        if (errorMessage) {
            errorMessage.remove();
        }
    }
    
    /**
     * 📋 ABRIR MODAL DE LISTA DE FUNCIONÁRIOS
     */
    async openFuncionariosListModal() {
        if (window.__folhaDebugAll) console.log('📋 Abrindo modal de lista de funcionários...');
        this._prepareFuncionarioSelectionTarget();
        
        // Verificar se o modal existe, senão criar
        if (!document.getElementById('funcionariosListModal')) {
            this.createFuncionariosListModal();
        }
        
        const modal = document.getElementById('funcionariosListModal');
        if (modal) {
            modal.style.display = 'block';
            document.body.style.overflow = 'hidden';
            
            // Renderizar dados atuais imediatamente (se houver)
            if (this.funcionarios && this.funcionarios.length > 0) {
                this.updateFuncionariosListTable();
            } else {
                // Mostrar loading na tabela se estiver vazia
                const tbody = document.getElementById('funcionariosListTable');
                if (tbody) tbody.innerHTML = '<tr><td colspan="6" style="text-align:center; padding:20px;"><i class="fas fa-spinner fa-spin"></i> Carregando...</td></tr>';
            }
            
            // Recarregar em background para garantir dados frescos
            (async () => {
                try {
                    if (window.__folhaDebugAll) console.log('🔄 Recarregando funcionários do banco (background)...');
                    // Não limpar array antes para evitar "piscada" se falhar
                    await this.loadFuncionarios();
                    this.updateFuncionariosListTable();
                } catch (error) {
                    console.error('❌ Erro ao recarregar funcionários:', error);
                }
            })();
            
            // Configurar filtro
            this.setupFuncionariosListFilter();
            this._setupFuncionariosListPaginationControls();
            this._setupFuncionariosListSortingHeaders();
            
            // Focar no campo de filtro
            requestAnimationFrame(() => {
                const filterInput = document.getElementById('funcionariosListFilter');
                if (filterInput) filterInput.focus();
            });
        }
    }
    
    /**
     * 🏗️ CRIAR MODAL DE LISTA DE FUNCIONÁRIOS
     */
    createFuncionariosListModal() {
        const modalHTML = `
            <div id="funcionariosListModal" class="modal">
                <div class="modal-content">
                    <div class="modal-header">
                        <h3 class="modal-title">👥 Lista de Funcionários</h3>
                        <span class="close-modal" onclick="closeFuncionariosListModal()">&times;</span>
                    </div>
                    <div class="modal-body">
                        <input type="text" id="funcionariosListFilter" 
                               placeholder="🔍 Filtrar por nome, CPF, cargo, PIS, forma de pagamento, beneficiário, banco..." 
                               style="width: 100%; padding: 10px; margin-bottom: 15px;">
                    <div class="table-container">
                        <table class="table funcionarios-list-table">
                                <thead>
                                    <tr>
                                        <th data-sort-key="nome">Nome</th>
                                        <th data-sort-key="cpf">CPF</th>
                                        <th data-sort-key="cargo">Cargo</th>
                                        <th data-sort-key="formaPagamento">Forma Pgto.</th>
                                        <th data-sort-key="salarioBase">Salário</th>
                                        <th data-sort-key="status">Status</th>
                                        <th data-sort-key="acoes">Ações</th>
                                    </tr>
                                </thead>
                                <tbody id="funcionariosListTable">
                                    <!-- Conteúdo dinâmico -->
                                </tbody>
                            </table>
                        </div>
                        <div class="paginacao-controles modal-paginacao" id="funcListPaginacaoControles" style="margin-top: 10px; display: flex; align-items: center; justify-content: space-between; gap: 12px;">
                            <div class="paginacao-info"><span id="funcListPaginacaoInfo">Mostrando 0 de 0</span></div>
                            <div class="paginacao-navegacao" style="display:flex; align-items:center; gap:8px;">
                                <button id="funcListBtnPrimeira" class="btn-paginacao" title="Primeira página"><i class="fas fa-angle-double-left"></i></button>
                                <button id="funcListBtnAnterior" class="btn-paginacao" title="Página anterior"><i class="fas fa-angle-left"></i></button>
                                <span id="funcListPaginaAtual" class="pagina-atual">Página 1</span>
                                <button id="funcListBtnProxima" class="btn-paginacao" title="Próxima página"><i class="fas fa-angle-right"></i></button>
                                <button id="funcListBtnUltima" class="btn-paginacao" title="Última página"><i class="fas fa-angle-double-right"></i></button>
                            </div>
                            <div class="paginacao-config" style="display:flex; align-items:center; gap:6px;">
                                <label for="funcListItensPorPagina">Itens por página:</label>
                                <select id="funcListItensPorPagina">
                                    <option value="5">5</option>
                                    <option value="10" selected>10</option>
                                    <option value="25">25</option>
                                </select>
                                </div>
                            </div>
                        </div>
                    <div class="modal-footer footer-with-info">
                        <div class="footer-info" style="color: #666; font-size: 14px;">
                            <i class="fas fa-info-circle"></i> <span id="funcionariosModalInfo">Carregando...</span>
                        </div>
                        <div class="footer-secondary">
                            <button type="button" class="back-button close-modal-btn" onclick="closeFuncionariosListModal()">
                                <i class="fas fa-times"></i> Fechar
                            </button>
                        </div>
                        <div class="footer-primary">
                            <button type="button" class="btn-adicionar" onclick="openNovoFuncionarioFromList()">
                                <i class="fas fa-user-plus"></i> Novo Funcionário
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        `;
        
        document.body.insertAdjacentHTML('beforeend', modalHTML);
        
        // Configurar event listener para fechar clicando fora
        const modal = document.getElementById('funcionariosListModal');
        if (modal) {
            modal.addEventListener('click', (e) => {
                if (e.target === modal) {
                    this.closeFuncionariosListModal();
                }
            });
        }
    }
    
    /**
     * ❌ FECHAR MODAL DE LISTA
     */
    closeFuncionariosListModal() {
        const modal = document.getElementById('funcionariosListModal');
        if (modal) {
            modal.style.display = 'none';
            document.body.style.overflow = 'auto';
        }
    }
    
    /**
     * 📊 ATUALIZAR TABELA DE FUNCIONÁRIOS
     */
    updateFuncionariosListTable() {
        const tableBody = document.getElementById('funcionariosListTable');
        const infoSpan = document.getElementById('funcionariosModalInfo');
        
        if (!tableBody) return;
        
        console.log(`📊 Atualizando tabela de funcionários com ${this.funcionarios.length} itens`);
        
        if (this.funcionarios.length === 0) {
            tableBody.innerHTML = `
                <tr>
                    <td colspan="7" style="text-align: center; padding: 20px; color: #666;">
                        <i class="fas fa-user-plus" style="font-size: 24px; margin-bottom: 10px; display: block;"></i>
                        Nenhum funcionário cadastrado
                    </td>
                </tr>
            `;
            
            if (infoSpan) {
                infoSpan.textContent = 'Nenhum funcionário cadastrado';
            }
            this._updateFuncionariosSortIndicators();
            return;
        }
        
        this.funcListHasActiveFilter = false;
        const funcionariosOrdenados = this._sortFuncionariosList(this.funcionarios);
        this.funcionariosFiltrados = funcionariosOrdenados;
        if (typeof this.funcListItensPorPagina !== 'number') this.funcListItensPorPagina = 10;
        if (typeof this.funcListPaginaAtual !== 'number') this.funcListPaginaAtual = 1;
        this._renderFuncionariosListPage();
        
        if (infoSpan) {
            infoSpan.textContent = `${this.funcionariosFiltrados.length} funcionário(s) encontrado(s)`;
        }
        
        console.log(`✅ Tabela de funcionários atualizada com ${funcionariosOrdenados.length} linhas`);
    }

    _toggleFuncionariosListSort(sortKey) {
        const key = String(sortKey || '').trim();
        if (!key || key === 'acoes') return;
        if (this.funcListSortKey === key) {
            this.funcListSortDirection = this.funcListSortDirection === 'asc' ? 'desc' : 'asc';
        } else {
            this.funcListSortKey = key;
            this.funcListSortDirection = 'asc';
        }
    }

    _updateFuncionariosSortIndicators() {
        const table = document.querySelector('#funcionariosListModal table.funcionarios-list-table');
        if (!table) return;
        table.querySelectorAll('thead th[data-sort-key]').forEach((th) => {
            const key = String(th.getAttribute('data-sort-key') || '').trim();
            th.classList.remove('sortable', 'sort-active', 'sort-asc', 'sort-desc');
            if (key && key !== 'acoes') th.classList.add('sortable');
            if (key && key === this.funcListSortKey) {
                th.classList.add('sort-active');
                th.classList.add(this.funcListSortDirection === 'desc' ? 'sort-desc' : 'sort-asc');
            }
        });
    }

    _setupFuncionariosListSortingHeaders() {
        const table = document.querySelector('#funcionariosListModal table.funcionarios-list-table');
        if (!table) return;
        table.querySelectorAll('thead th[data-sort-key]').forEach((th) => {
            const key = String(th.getAttribute('data-sort-key') || '').trim();
            if (!key || key === 'acoes') return;
            if (th.dataset.sortBound === '1') return;
            th.dataset.sortBound = '1';
            th.addEventListener('click', () => {
                this._toggleFuncionariosListSort(key);
                const source = this.funcListHasActiveFilter ? (this.funcionariosFiltrados || []) : (this.funcionarios || []);
                this.funcionariosFiltrados = this._sortFuncionariosList(source);
                this.funcListPaginaAtual = 1;
                this._renderFuncionariosListPage();
                const infoSpan = document.getElementById('funcionariosModalInfo');
                if (infoSpan) infoSpan.textContent = `${this.funcionariosFiltrados.length} funcionário(s) encontrado(s)`;
            });
        });
        this._updateFuncionariosSortIndicators();
    }

    _getFuncionarioSortValue(funcionario, key) {
        const text = (v) => String(v || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim();
        if (!funcionario || !key) return '';
        switch (key) {
            case 'nome':
                return text(funcionario.nome || '');
            case 'cpf':
                return text(funcionario.cpf || '');
            case 'cargo':
                return text(funcionario.cargo || '');
            case 'formaPagamento':
                return text(funcionario.formaPagamento || funcionario.pix || funcionario.banco || '');
            case 'salarioBase':
                return Number(funcionario.salarioBase || 0) || 0;
            case 'status':
                return funcionario.ativo === false ? 0 : 1;
            default:
                return '';
        }
    }

    _sortFuncionariosList(lista) {
        const arr = Array.isArray(lista) ? lista.slice() : [];
        if (arr.length <= 1) return arr;
        const key = String(this.funcListSortKey || '').trim();
        if (!key || key === 'acoes') return arr;
        const mult = this.funcListSortDirection === 'desc' ? -1 : 1;
        return arr
            .map((item, index) => ({ item, index }))
            .sort((a, b) => {
                const va = this._getFuncionarioSortValue(a.item, key);
                const vb = this._getFuncionarioSortValue(b.item, key);
                const aNum = typeof va === 'number' && Number.isFinite(va);
                const bNum = typeof vb === 'number' && Number.isFinite(vb);
                let cmp = 0;
                if (aNum && bNum) cmp = va - vb;
                else cmp = String(va || '').localeCompare(String(vb || ''), 'pt-BR', { sensitivity: 'base', numeric: true });
                if (cmp !== 0) return cmp * mult;
                return a.index - b.index;
            })
            .map(x => x.item);
    }

    _setupFuncionariosListPaginationControls() {
        const btnPrimeira = document.getElementById('funcListBtnPrimeira');
        const btnAnterior = document.getElementById('funcListBtnAnterior');
        const btnProxima = document.getElementById('funcListBtnProxima');
        const btnUltima = document.getElementById('funcListBtnUltima');
        const itensSelect = document.getElementById('funcListItensPorPagina');
        const paginaInfo = document.getElementById('funcListPaginaAtual');
        
        if (itensSelect) {
            itensSelect.value = String(this.funcListItensPorPagina || 10);
            itensSelect.addEventListener('change', (e) => {
                this.funcListItensPorPagina = parseInt(e.target.value) || 10;
                this.funcListPaginaAtual = 1;
                this._renderFuncionariosListPage();
            });
        }
        if (btnPrimeira) btnPrimeira.addEventListener('click', () => { this.funcListPaginaAtual = 1; this._renderFuncionariosListPage(); });
        if (btnAnterior) btnAnterior.addEventListener('click', () => { this.funcListPaginaAtual = Math.max(1, (this.funcListPaginaAtual||1) - 1); this._renderFuncionariosListPage(); });
        if (btnProxima) btnProxima.addEventListener('click', () => { const total = this._getTotalPaginas(); this.funcListPaginaAtual = Math.min(total, (this.funcListPaginaAtual||1) + 1); this._renderFuncionariosListPage(); });
        if (btnUltima) btnUltima.addEventListener('click', () => { const total = this._getTotalPaginas(); this.funcListPaginaAtual = total; this._renderFuncionariosListPage(); });
        if (paginaInfo) paginaInfo.textContent = `Página ${this.funcListPaginaAtual||1}`;
    }

    _getTotalPaginas() {
        const totalItens = (this.funcionariosFiltrados && this.funcionariosFiltrados.length) || 0;
        const ipp = this.funcListItensPorPagina || 10;
        return Math.max(1, Math.ceil(totalItens / ipp));
    }

    _renderFuncionariosListPage() {
        const tableBody = document.getElementById('funcionariosListTable');
        if (!tableBody) return;
        const ipp = this.funcListItensPorPagina || 10;
        const total = (this.funcionariosFiltrados && this.funcionariosFiltrados.length) || 0;
        const totalPaginas = this._getTotalPaginas();
        this.funcListPaginaAtual = Math.min(Math.max(1, this.funcListPaginaAtual || 1), totalPaginas);
        const inicio = (this.funcListPaginaAtual - 1) * ipp;
        const fim = inicio + ipp;
        const dadosPagina = (this.funcionariosFiltrados || []).slice(inicio, fim);
        tableBody.innerHTML = dadosPagina.map(funcionario => this.renderFuncionarioRow(funcionario)).join('');
        if (window.FolhaUtils && typeof window.FolhaUtils.applyMobileTableLabels === 'function') {
            window.FolhaUtils.applyMobileTableLabels(document.getElementById('funcionariosListModal'));
        }
        const infoEl = document.getElementById('funcListPaginacaoInfo');
        const paginaInfo = document.getElementById('funcListPaginaAtual');
        const btnPrimeira = document.getElementById('funcListBtnPrimeira');
        const btnAnterior = document.getElementById('funcListBtnAnterior');
        const btnProxima = document.getElementById('funcListBtnProxima');
        const btnUltima = document.getElementById('funcListBtnUltima');
        if (infoEl) {
            const inicioDisp = total === 0 ? 0 : inicio + 1;
            const fimDisp = Math.min(fim, total);
            infoEl.textContent = total === 0 ? 'Nenhum item encontrado' : `Mostrando ${inicioDisp} a ${fimDisp} de ${total} itens`;
        }
        if (paginaInfo) paginaInfo.textContent = `Página ${this.funcListPaginaAtual} de ${totalPaginas}`;
        if (btnPrimeira) btnPrimeira.disabled = this.funcListPaginaAtual <= 1;
        if (btnAnterior) btnAnterior.disabled = this.funcListPaginaAtual <= 1;
        if (btnProxima) btnProxima.disabled = this.funcListPaginaAtual >= totalPaginas;
        if (btnUltima) btnUltima.disabled = this.funcListPaginaAtual >= totalPaginas;
        this._updateFuncionariosSortIndicators();
    }

    /**
     * 🎨 RENDERIZAR LINHA PADRÃO (Consistência entre lista e filtro)
     */
    renderFuncionarioRow(funcionario) {
        const isAtivo = funcionario.ativo !== false;
        const statusClass = isAtivo ? 'badge-ativo' : 'badge-inativo';
        const statusText = isAtivo ? 'Ativo' : 'Inativo';
        const statusIcon = isAtivo ? 'fas fa-check-circle' : 'fas fa-times-circle';

        console.log(`🎨 Renderizando funcionário: ${funcionario.nome} - Status: ${statusText} (ativo: ${funcionario.ativo})`);
        const formaPagamentoTexto = (window.FolhaUtils && typeof window.FolhaUtils.formatarFormaPagamentoDetalhada === 'function')
            ? window.FolhaUtils.formatarFormaPagamentoDetalhada(funcionario)
            : (funcionario.formaPagamento || 'N/A');

        return `
            <tr class="${isAtivo ? '' : 'funcionario-inativo'}">
                <td data-label="Nome" class="func-col-nome">
                    <strong class="func-nome">${funcionario.nome || 'N/A'}</strong>
                    <div class="func-contrato">
                        ${funcionario.tipoContrato || 'N/A'}
                    </div>
                </td>
                <td data-label="CPF">${funcionario.cpf || 'N/A'}</td>
                <td data-label="Cargo">${funcionario.cargo || 'N/A'}</td>
                <td data-label="Forma Pgto." style="font-size: 12px;">${formaPagamentoTexto}</td>
                <td data-label="Salário">R$ ${Number(funcionario.salarioBase || 0).toFixed(2).replace('.', ',')}</td>
                <td data-label="Status">
                    <span class="badge-status ${statusClass}">
                        <i class="${statusIcon}"></i> ${statusText}
                    </span>
                </td>
                <td data-label="Ações" class="actions-cell">
                    <button class="action-button select-button" title="Selecionar" onclick="selectFuncionarioFromList('${funcionario.id}')">
                        <i class="fas fa-check"></i>
                    </button>
                    <button class="action-button edit-button" title="Editar" onclick="editFuncionario('${funcionario.id}')">
                        <i class="fas fa-edit"></i>
                    </button>
                    <button class="action-button delete-button" title="Excluir" onclick="deleteFuncionario('${funcionario.id}')">
                        <i class="fas fa-trash"></i>
                    </button>
                </td>
            </tr>`;
    }
    
    /**
     * 🔍 CONFIGURAR FILTRO DA LISTA
     */
    setupFuncionariosListFilter() {
        const filterInput = document.getElementById('funcionariosListFilter');
        if (!filterInput) return;
        
        // Remover listeners anteriores
        filterInput.removeEventListener('input', this.handleFuncionariosListFilter);
        
        // Adicionar novo listener
        this.handleFuncionariosListFilter = (e) => {
            this.filterFuncionariosList(e.target.value);
        };
        
        filterInput.addEventListener('input', this.handleFuncionariosListFilter);
    }
    
    /**
     * 🔍 FILTRAR LISTA DE FUNCIONÁRIOS
     */
    filterFuncionariosList(searchTerm) {
        const tableBody = document.getElementById('funcionariosListTable');
        if (!tableBody) return;
        
        if (!searchTerm || searchTerm.trim() === '') {
            this.updateFuncionariosListTable();
            return;
        }
        
        this.funcListHasActiveFilter = true;
        const term = searchTerm.toLowerCase().trim();
        const funcionariosFiltrados = this.funcionarios.filter(funcionario => {
            return (
                (funcionario.nome || '').toLowerCase().includes(term) ||
                (funcionario.cpf || '').includes(term) ||
                (funcionario.cargo || '').toLowerCase().includes(term) ||
                (funcionario.pis || '').includes(term) ||
                (funcionario.tipoContrato || '').toLowerCase().includes(term) ||
                (funcionario.formaPagamento || '').toLowerCase().includes(term) ||
                (funcionario.favorecidoPix || '').toLowerCase().includes(term) ||
                (funcionario.nomeFavorecidoPix || '').toLowerCase().includes(term) ||
                (funcionario.beneficiario || '').toLowerCase().includes(term) ||
                (funcionario.banco || '').toLowerCase().includes(term) ||
                (funcionario.pix || '').toLowerCase().includes(term)
            );
        });
        const funcionariosOrdenados = this._sortFuncionariosList(funcionariosFiltrados);
        this.funcionariosFiltrados = funcionariosOrdenados;
        this.funcListPaginaAtual = 1;
        this._renderFuncionariosListPage();
        
        const infoSpan = document.getElementById('funcionariosModalInfo');
        if (infoSpan) {
            infoSpan.textContent = `${funcionariosFiltrados.length} funcionário(s) encontrado(s)`;
        }
    }
    
    /**
     * ✅ SELECIONAR FUNCIONÁRIO DA LISTA
     */
    selectFuncionarioFromList(funcionarioId) {
        // ✅ VALIDAÇÃO MÍNIMA: Rejeitar apenas dados de teste conhecidos
        if (funcionarioId === 'teste_1754574534414') {
            console.warn('⚠️ ID de teste conhecido detectado, rejeitando:', funcionarioId);
            this.showNotification('Erro: Dados de teste detectados. Use funcionários reais do banco.', 'error');
            return;
        }
        
        const funcionario = this.funcionarios.find(f => f.id === funcionarioId);
        if (!funcionario) {
            console.warn('Funcionário não encontrado:', funcionarioId);
            console.log('📋 Funcionários disponíveis:', this.funcionarios.map(f => `${f.nome} (${f.id})`));
            return;
        }
        
        // ✅ VALIDAÇÃO MÍNIMA: Rejeitar apenas "Funcionário Teste" exato
        if (funcionario.nome === 'Funcionário Teste') {
            console.warn('⚠️ Funcionário de teste conhecido detectado, rejeitando:', funcionario.nome);
            this.showNotification('Erro: Funcionário de teste detectado. Use funcionários reais do banco.', 'error');
            return;
        }
        
        console.log('👤 Selecionando funcionário:', funcionario.nome);
        this._prepareFuncionarioSelectionTarget();
        
        // ✅ CORREÇÃO: Usar targetField se definido, senão usar lógica de prioridade
        let campoAtivo = null;
        
        // 1. PRIORIDADE MÁXIMA: targetField se definido
        if (this.targetField) {
            const campoTarget = document.getElementById(this.targetField);
            if (campoTarget) {
                campoAtivo = campoTarget;
                console.log(`🎯 Usando targetField: ${this.targetField}`);
            } else {
                console.warn(`⚠️ targetField ${this.targetField} não encontrado`);
            }
        }
        
        // 2. Fallback: Lógica de prioridade original
        if (!campoAtivo) {
            const campos = [
                'funcionarioFiltro',      // Filtro principal
                'folhaFuncionario',       // Modal de folha
                'filtroFechadasFuncionario', // Modal de folhas fechadas
                'funcionarioRelatorio',   // Modal de relatórios
                'bh-funcionario-nome',    // Modal de Banco de Horas
                'bh-ger-func-nome'        // Modal de BH - gerenciar
            ];
            
            // 2.1. Campo que está com foco atual
            for (const campoId of campos) {
                const campo = document.getElementById(campoId);
                if (campo && campo === document.activeElement) {
                    campoAtivo = campo;
                    console.log(`✅ Campo ativo detectado: ${campoId}`);
                    break;
                }
            }
            
            // 2.2. Campo marcado como lastFocused
            if (!campoAtivo) {
                for (const campoId of campos) {
                    const campo = document.getElementById(campoId);
                    if (campo && campo.dataset.lastFocused === 'true') {
                        campoAtivo = campo;
                        console.log(`✅ Campo lastFocused detectado: ${campoId}`);
                        break;
                    }
                }
            }
            
            // 2.3. Campo visível e disponível
            if (!campoAtivo) {
                for (const campoId of campos) {
                    const campo = document.getElementById(campoId);
                    if (campo && campo.offsetParent !== null) { // Verifica se está visível
                        campoAtivo = campo;
                        console.log(`⚠️ Usando campo visível: ${campoId}`);
                        break;
                    }
                }
            }
        }
        
        // 4. Última opção: Primeiro campo disponível
        if (!campoAtivo) {
            const camposFallback = ['funcionarioFiltro', 'folhaFuncionario', 'filtroFechadasFuncionario', 'funcionarioRelatorio', 'bh-funcionario-nome'];
            for (const campoId of camposFallback) {
                const campo = document.getElementById(campoId);
                if (campo) {
                    campoAtivo = campo;
                    console.log(`⚠️ Usando primeiro campo disponível: ${campoId}`);
                    break;
                }
            }
        }
        
        if (campoAtivo) {
            // Preencher o campo
            campoAtivo.value = funcionario.nome;
            campoAtivo.dataset.funcionarioId = funcionario.id;
            
            // ✅ CORREÇÃO: Adicionar dados completos do funcionário
            campoAtivo.dataset.funcionarioData = JSON.stringify(funcionario);

            if (campoAtivo.id === 'folhaFuncionario') {
                const salInput = document.getElementById('funcionarioSalario');
                const salario = Number(funcionario.salarioBase || funcionario.salario || 0) || 0;
                if (salInput) {
                    salInput.value = salario > 0 ? String(salario) : '';
                    try { salInput.dispatchEvent(new Event('input', { bubbles: true })); salInput.dispatchEvent(new Event('change', { bubbles: true })); } catch {}
                }
                try {
                    if (window.folhaLancamentos) {
                        if (typeof window.folhaLancamentos.applyEncargoRestrictionsByLancamento === 'function') {
                            window.folhaLancamentos.applyEncargoRestrictionsByLancamento();
                        }
                        if (typeof window.folhaLancamentos.ensureEncargoFieldsEnabledForCLT === 'function') {
                            window.folhaLancamentos.ensureEncargoFieldsEnabledForCLT();
                        }
                        if (typeof window.folhaLancamentos.scheduleCalcularFolhaRealTime === 'function') {
                            window.folhaLancamentos.scheduleCalcularFolhaRealTime(100);
                        } else if (typeof window.folhaLancamentos.calcularFolhaRealTime === 'function') {
                            window.folhaLancamentos.calcularFolhaRealTime();
                        }
                    }
                } catch {}
            }
            
            // ✅ CORREÇÃO CRÍTICA: Aplicar filtro automaticamente se for o campo de filtro principal
            if (campoAtivo.id === 'funcionarioFiltro') {
                console.log('🎯 Aplicando filtro automático para funcionário selecionado:', funcionario.nome);
                
                // Atualizar filtros ativos
                if (window.folhaFiltros) {
                    window.folhaFiltros.updateFiltro('funcionarioId', funcionario.id);
                    window.folhaFiltros.updateFiltro('funcionario', funcionario.nome);
                    
                    // Aplicar filtros imediatamente
                    setTimeout(() => {
                        window.folhaFiltros.aplicarFiltros();
                    }, 100);
                }
                
                // Também tentar aplicar via sistema principal se disponível
                if (window.folhaSystem && typeof window.folhaSystem.aplicarFiltrosComDadosFrescos === 'function') {
                    setTimeout(() => {
                        window.folhaSystem.aplicarFiltrosComDadosFrescos();
                    }, 200);
                }
            }
            
            // ✅ Integração com Banco de Horas: se o alvo for o campo do BH, atualizar o hidden e preview
            if (campoAtivo.id === 'bh-funcionario-nome') {
                const hiddenId = document.getElementById('bh-funcionario-id');
                if (hiddenId) {
                    const cpf = (funcionario.cpf ? String(funcionario.cpf).replace(/\D/g, '') : '');
                    const key = funcionario.id || funcionario.funcionarioId || funcionario.key || funcionario.$key || cpf || funcionario.matricula || funcionario.codigo || '';
                    hiddenId.value = key ? String(key) : '';
                }
                // Atualizar saldos se função auxiliar existir
                try { if (window._bhUpdateSaldoPreview) { window._bhUpdateSaldoPreview(); } } catch (e) {}
            }
            
            // Limpar flag de lastFocused de outros campos
            const todosCampos = ['funcionarioFiltro', 'folhaFuncionario', 'filtroFechadasFuncionario', 'funcionarioRelatorio', 'bh-funcionario-nome', 'bh-ger-func-nome'];
            todosCampos.forEach(campoId => {
                const campo = document.getElementById(campoId);
                if (campo && campo !== campoAtivo) {
                    campo.dataset.lastFocused = 'false';
                }
            });
            
            // Disparar evento de mudança
            campoAtivo.dispatchEvent(new Event('change', { bubbles: true }));
            
            console.log(`✅ Campo preenchido: ${campoAtivo.id} = "${funcionario.nome}"`);
            
            // ✅ CORREÇÃO: Removida mensagem desnecessária "Funcionário selecionado!"
            // A seleção já é visível no campo preenchido, não precisa de notificação
        } else {
            console.error('❌ Nenhum campo de funcionário encontrado para preenchimento');
            // Mostrar erro para o usuário
            if (this.showNotification) {
                this.showNotification('Erro: Campo de funcionário não encontrado', 'error');
            }
        }
        
        // ✅ Resetar targetField após seleção para evitar efeitos colaterais
        this.targetField = null;

        // Fechar modal
        this.closeFuncionariosListModal();
    }
    
    /**
     * 📢 MOSTRAR NOTIFICAÇÃO
     */
    showNotification(message, type = 'info') {
        // Usar sistema de toast unificado
        if (window.FolhaUtils && window.FolhaUtils.showToast) {
            window.FolhaUtils.showToast(message, type);
        } else {
            // Fallback para console apenas (sem alert)
            console.log(`[${type.toUpperCase()}] ${message}`);
        }
    }
    
    /**
     * 🔄 RECARREGAR FUNCIONÁRIOS (NOVA FUNCIONALIDADE)
     * Força recarregamento dos dados do banco
     */
    async reloadFuncionarios() {
        console.log('🔄 Recarregando funcionários...');
        
        try {
            // Limpar dados existentes
            this.funcionarios = {};
            
            // Recarregar do banco
            await this.loadFuncionarios();
            
            // Atualizar interface se modal estiver aberto
            const modal = document.getElementById('funcionariosListModal');
            if (modal && modal.style && modal.style.display === 'block') {
                this.updateFuncionariosListTable();
            }
            
            console.log('✅ Funcionários recarregados com sucesso');
            
        } catch (error) {
            console.error('❌ Erro ao recarregar funcionários:', error);
        }
    }
    
    /**
     * 📡 CONFIGURAR LISTENERS DE SINCRONIZAÇÃO (NOVA FUNCIONALIDADE)
     */
    setupSyncListeners() {
        // Listener para mudanças de dados do sistema principal
        window.addEventListener('folhaDataChanged', (event) => {
            console.log('📡 Evento de mudança de dados recebido:', event.detail);
            
            // Se a mudança incluir funcionários, recarregar
            if (event.detail.dataTypes.includes('funcionarios')) {
                console.log('🔄 Recarregando funcionários devido a mudança no sistema...');
                setTimeout(() => {
                    this.reloadFuncionarios();
                }, 500); // Delay para garantir que o banco foi atualizado
            }
        });
        
        console.log('✅ Listeners de sincronização configurados');
    }
}

// ✅ FUNÇÕES GLOBAIS PARA COMPATIBILIDADE
window.selectFuncionarioFromList = function(funcionarioId) {
    if (window.folhaFuncionarios) {
        window.folhaFuncionarios.selectFuncionarioFromList(funcionarioId);
    }
};

window.editFuncionario = function(funcionarioId) {
    if (window.folhaFuncionarios) {
        window.folhaFuncionarios.openEditFuncionarioModal(funcionarioId);
    } else {
        console.warn('⚠️ Módulo folhaFuncionarios não carregado');
        if (window.FolhaUtils && window.FolhaUtils.mostrarAviso) {
            window.FolhaUtils.mostrarAviso('Sistema carregando. Tente novamente em alguns segundos.');
        }
    }
};

window.deleteFuncionario = function(funcionarioId) {
    if (window.folhaFuncionarios) {
        window.folhaFuncionarios.deleteFuncionario(funcionarioId);
    } else {
        console.warn('⚠️ Módulo folhaFuncionarios não carregado');
        if (window.FolhaUtils && window.FolhaUtils.mostrarAviso) {
            window.FolhaUtils.mostrarAviso('Sistema carregando. Tente novamente em alguns segundos.');
        }
    }
};

window.openFuncionariosListModal = function() {
    if (window.folhaFuncionarios) {
        window.folhaFuncionarios.openFuncionariosListModal();
    } else {
        console.warn('⚠️ Módulo folhaFuncionarios não carregado');
        if (window.FolhaUtils && window.FolhaUtils.mostrarAviso) {
            window.FolhaUtils.mostrarAviso('Sistema carregando. Tente novamente em alguns segundos.');
        }
    }
};

window.closeFuncionariosListModal = function() {
    if (window.folhaFuncionarios) {
        window.folhaFuncionarios.closeFuncionariosListModal();
    } else {
        console.warn('⚠️ Módulo folhaFuncionarios não carregado');
        const modal = document.getElementById('funcionariosListModal');
        if (modal) modal.style.display = 'none';
    }
};

window.openNovoFuncionarioFromList = function() {
    if (window.folhaFuncionarios) {
        // Fechar modal da lista primeiro
        window.folhaFuncionarios.closeFuncionariosListModal();
        // Aguardar um pouco e abrir modal de novo funcionário
        setTimeout(() => {
            window.folhaFuncionarios.openNovoFuncionarioModal();
        }, 200);
    } else {
        console.warn('⚠️ Módulo folhaFuncionarios não carregado');
        if (window.FolhaUtils && window.FolhaUtils.mostrarAviso) {
            window.FolhaUtils.mostrarAviso('Sistema carregando. Tente novamente em alguns segundos.');
        }
    }
};

// ✅ INICIALIZAÇÃO AUTOMÁTICA OTIMIZADA
document.addEventListener('DOMContentLoaded', () => {
    // Aguardar dependências E elementos DOM
    const checkDependencies = () => {
        const funcionarioForm = document.getElementById('funcionarioForm');
        const firebaseOk = window.FirebaseService || window.folhaFirebaseService || window.database;
        const utilsOk = window.FolhaUtils || window.folhaUtils;
        
        // Se Firebase ok, inicializar imediatamente
        if (firebaseOk) {
            if (!window.folhaFuncionarios) {
                window.folhaFuncionarios = new FolhaFuncionarios();
                console.log('✅ Sistema de funcionários inicializado (Fast Load)');
                
                // Carregar dados do banco automaticamente em background
                setTimeout(() => {
                    window.folhaFuncionarios.loadFuncionarios().then(() => {
                        console.log(`📊 ${window.folhaFuncionarios.funcionarios.length} funcionários carregados`);
                    }).catch(console.error);
                }, 10);
            }
            
            if (funcionarioForm) {
                console.log('✅ Formulário de funcionário encontrado');
            }
        } else {
            // Tentar novamente em breve (backoff exponencial ou curto)
            requestAnimationFrame(() => setTimeout(checkDependencies, 100));
        }
    };
    
    // Iniciar verificação imediatamente
    checkDependencies();
});

// ✅ INICIALIZAÇÃO IMEDIATA PARA COMPATIBILIDADE (especialmente para testes)
if (typeof window !== 'undefined') {
    // Tentar inicializar imediatamente se Firebase já estiver disponível
    const tryImmediateInit = () => {
        if (!window.folhaFuncionarios && (window.FirebaseService || window.folhaFirebaseService || window.database)) {
            console.log('🚀 Inicializando folhaFuncionarios imediatamente...');
            window.folhaFuncionarios = new FolhaFuncionarios();
            console.log('✅ folhaFuncionarios inicializado imediatamente');
            
            // Carregar dados do banco automaticamente
            window.folhaFuncionarios.loadFuncionarios().then(() => {
                console.log(`📊 ${window.folhaFuncionarios.funcionarios.length} funcionários carregados do banco (inicialização imediata)`);
            }).catch(error => {
                console.error('❌ Erro ao carregar funcionários (inicialização imediata):', error);
            });
        }
    };
    
    // Tentar agora
    tryImmediateInit();
    
    // E também após um pequeno delay para casos onde Firebase carrega depois
    setTimeout(tryImmediateInit, 100);
    setTimeout(tryImmediateInit, 500);
}

// ✅ EXPORTAR CLASSE PARA COMPATIBILIDADE GLOBAL
window.FolhaFuncionarios = FolhaFuncionarios;

console.log('👥 Módulo de funcionários carregado');
