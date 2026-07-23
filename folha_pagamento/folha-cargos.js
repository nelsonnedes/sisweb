/**
 * 🏢 FOLHA CARGOS - Sistema completo de CRUD de cargos
 * Baseado nos padrões do romaneiopct com adicionais automáticos
 * Implementa periculosidade, adicional noturno e outras configurações
 */

// ✅ CONFIGURAÇÕES LOCAIS (complementares ao folha-config.js)

// ✅ CLASSE PRINCIPAL DE CARGOS
class FolhaCargos {
    constructor() {
        this.cargos = [];
        this.cargoAtual = null;
        this.isEditMode = false;
        
        this.init();
    }

    _resolvePath(path) {
        try {
            if (window.FolhaUtils && typeof window.FolhaUtils.resolveFirebasePath === 'function') {
                return window.FolhaUtils.resolveFirebasePath(path);
            }
            const svc = window.firebaseService || window.firebaseServiceTL || window.FirebaseService;
            if (svc && typeof svc.getNamespacedPath === 'function') {
                return svc.getNamespacedPath(path);
            }
            const base = String(path || '');
            if (!base) return base;
            if (/^companies(\/|$)/.test(base) || /^users(\/|$)/.test(base)) return base;
            const rawTenant = window.appTenantId || (window.companyInfo && (window.companyInfo.companyId || window.companyInfo.companyID || window.companyInfo.tenantId || window.companyInfo.id));
            if (rawTenant) return `companies/${String(rawTenant)}/${base}`;
            const stored = localStorage.getItem('company_info');
            if (stored) {
                const obj = JSON.parse(stored);
                const t = obj && (obj.companyId || obj.companyID || obj.tenantId || obj.id);
                if (t) return `companies/${String(t)}/${base}`;
            }
        } catch {}
        return path;
    }
    
    init() {
        console.log('🏢 Inicializando sistema de cargos...');
        this.setupEventListeners();
        this.loadCargos();
        this.setupAutocomplete();
    }
    
    /**
     * 🎯 CONFIGURAR EVENT LISTENERS
     */
    setupEventListeners() {
        // Evitar configuração dupla
        if (this._eventListenersConfigured) {
            console.log('⚠️ Event listeners de cargos já foram configurados, pulando...');
            return;
        }
        
        // Aguardar um pouco para garantir que o DOM está completo
        setTimeout(() => {
            console.log('🎯 Configurando event listeners de cargos...');
            
            // Botão Novo Cargo
            const btnNovoCargo = document.getElementById('btnNovoCargo') || 
                                document.querySelector('.btn-salvar[onclick*="Cargo"]');
            if (btnNovoCargo) {
                btnNovoCargo.addEventListener('click', () => this.openNovoCargoModal());
            }
            
            // Form de cargo - CONFIGURAÇÃO CORRIGIDA
            const cargoForm = document.getElementById('cargoForm');
            if (cargoForm) {
                console.log('✅ Configurando event listener para cargoForm');
                
                // Verificar se já tem event listeners para evitar duplicação
                if (cargoForm._cargosListenerConfigured) {
                    console.log('⚠️ Event listener de cargo já configurado, pulando...');
                    this._eventListenersConfigured = true;
                    return;
                }
                
                // Remover event listeners existentes para evitar duplicação
                cargoForm.onsubmit = null;
                
                // Configurar novo event listener - APENAS UMA VEZ
                cargoForm.addEventListener('submit', (e) => {
                    console.log('📝 Submit do formulário de cargo capturado');
                    e.preventDefault();
                    this.handleCargoSubmit(e);
                });
                
                // Marcar como configurado
                cargoForm._cargosListenerConfigured = true;
                cargoForm._hasEventListener = true;
                
                // CONFIGURAR BOTÃO DE SALVAR - Usando type="button" para evitar submit duplo
                const saveCargoBtn = document.getElementById('saveCargoBtn');
                if (saveCargoBtn) {
                    console.log('🔘 Configurando botão de salvar cargo');
                    
                    // Limpar handlers existentes
                    saveCargoBtn.onclick = null;
                    const newBtn = saveCargoBtn.cloneNode(true);
                    saveCargoBtn.parentNode.replaceChild(newBtn, saveCargoBtn);
                    
                    // Configurar handler único
                    newBtn.addEventListener('click', (e) => {
                        console.log('🔘 Botão salvar cargo clicado');
                        e.preventDefault();
                        e.stopPropagation();
                        
                        // Chamar diretamente o handler em vez de simular submit
                        this.handleCargoSubmit(e);
                    });
                }
                
            } else {
                console.warn('⚠️ cargoForm não encontrado no DOM');
                // Tentar novamente após delay
                setTimeout(() => this.setupEventListeners(), 500);
                return;
            }
            
            this._eventListenersConfigured = true;
            console.log('✅ Event listeners de cargos configurados (sem duplicação)');
        }, 100);
        
        // Campos com cálculo automático
        this.setupCalculoAutomatico();
        
        // Modal close
        const closeButtons = document.querySelectorAll('#cargoModal .close-modal, #cargoModal .back-button');
        closeButtons.forEach(btn => {
            btn.addEventListener('click', () => this.closeCargoModal());
        });
        
        // Click fora do modal
        const cargoModal = document.getElementById('cargoModal');
        if (cargoModal) {
            cargoModal.addEventListener('click', (e) => {
                if (e.target === cargoModal) {
                    this.closeCargoModal();
                }
            });
        }
    }
    
    /**
     * 🧮 CONFIGURAR CÁLCULO AUTOMÁTICO
     */
    setupCalculoAutomatico() {
        const salarioInput = document.getElementById('cargoSalarioBase');
        const periculosidadeInput = document.getElementById('cargoPericulosidade');
        const noturnoInput = document.getElementById('cargoAdicionalNoturno');
        
        if (salarioInput) {
            salarioInput.addEventListener('input', () => this.atualizarPreview());
        }
        if (periculosidadeInput) {
            periculosidadeInput.addEventListener('input', () => this.atualizarPreview());
        }
        if (noturnoInput) {
            noturnoInput.addEventListener('input', () => this.atualizarPreview());
        }
    }
    
    /**
     * 📊 ATUALIZAR PREVIEW DOS CÁLCULOS
     */
    atualizarPreview() {
        const salarioBase = parseFloat((document.getElementById('cargoSalarioBase') && document.getElementById('cargoSalarioBase').value) || 0);
        const periculosidade = parseFloat((document.getElementById('cargoPericulosidade') && document.getElementById('cargoPericulosidade').value) || 0);
        const adicionalNoturno = parseFloat((document.getElementById('cargoAdicionalNoturno') && document.getElementById('cargoAdicionalNoturno').value) || 0);
        
        if (salarioBase > 0) {
            const valorPericulosidade = salarioBase * (periculosidade / 100);
            const valorNoturno = salarioBase * (adicionalNoturno / 100);
            const salarioComAdicionais = salarioBase + valorPericulosidade + valorNoturno;
            
            // Criar ou atualizar preview
            this.mostrarPreviewCalculos({
                salarioBase,
                valorPericulosidade,
                valorNoturno,
                salarioComAdicionais
            });
        }
    }
    
    /**
     * 📋 MOSTRAR PREVIEW DOS CÁLCULOS
     */
    mostrarPreviewCalculos(calculos) {
        let previewContainer = document.getElementById('cargoPreviewCalculos');
        
        if (!previewContainer) {
            previewContainer = document.createElement('div');
            previewContainer.id = 'cargoPreviewCalculos';
            previewContainer.className = 'resumo-container';
            previewContainer.style.marginTop = '15px';
            
            // Inserir após o campo de observações
            const observacoesGroup = (document.getElementById('cargoObservacoes') && document.getElementById('cargoObservacoes').closest('.form-group'));
            if (observacoesGroup) {
                observacoesGroup.parentNode.insertBefore(previewContainer, observacoesGroup.nextSibling);
            }
        }
        
        previewContainer.innerHTML = `
            <div class="resumo-item">
                <h4>Salário Base:</h4>
                <span>R$ ${calculos.salarioBase.toFixed(2).replace('.', ',')}</span>
            </div>
            <div class="resumo-item">
                <h4>Periculosidade:</h4>
                <span>R$ ${calculos.valorPericulosidade.toFixed(2).replace('.', ',')}</span>
            </div>
            <div class="resumo-item">
                <h4>Adicional Noturno:</h4>
                <span>R$ ${calculos.valorNoturno.toFixed(2).replace('.', ',')}</span>
            </div>
            <div class="resumo-item">
                <h4>Total com Adicionais:</h4>
                <span class="valor-destaque">R$ ${calculos.salarioComAdicionais.toFixed(2).replace('.', ',')}</span>
            </div>
        `;
    }
    
    /**
     * ➕ ABRIR MODAL NOVO CARGO
     */
    openNovoCargoModal() {
        console.log('🏢 Abrindo modal novo cargo...');
        
        this.isEditMode = false;
        this.cargoAtual = null;
        
        // Limpar formulário
        this.clearCargoForm();
        
        // Configurar modal
        const modalTitle = document.getElementById('cargoModalTitle');
        if (modalTitle) {
            modalTitle.innerHTML = '<i class="fas fa-briefcase"></i> Novo Cargo';
        }
        
        const saveBtn = document.getElementById('saveCargoBtn');
        if (saveBtn) {
            saveBtn.innerHTML = '<i class="fas fa-save"></i> Salvar';
        }
        
        // Mostrar modal
        const modal = document.getElementById('cargoModal');
        if (modal) {
            modal.style.display = 'block';
            
            // Foco no primeiro campo
            setTimeout(() => {
                const nomeInput = document.getElementById('cargoNome');
                if (nomeInput) nomeInput.focus();
            }, 100);
        }
    }
    
    /**
     * ✏️ ABRIR MODAL EDITAR CARGO
     */
    openEditCargoModal(cargoId) {
        console.log('🏢 Abrindo modal editar cargo:', cargoId);
        
        const cargo = this.cargos.find(c => c.id === cargoId);
        if (!cargo) {
            this.showNotification('Cargo não encontrado!', 'error');
            return;
        }
        
        // ✅ CORREÇÃO: Fechar modal da lista antes de abrir o de edição
        this.closeCargosListModal();
        
        this.isEditMode = true;
        this.cargoAtual = cargo;
        
        // Preencher formulário
        this.fillCargoForm(cargo);
        
        // Configurar modal
        const modalTitle = document.getElementById('cargoModalTitle');
        if (modalTitle) {
            modalTitle.innerHTML = '<i class="fas fa-edit"></i> Editar Cargo';
        }
        
        const saveBtn = document.getElementById('saveCargoBtn');
        if (saveBtn) {
            saveBtn.innerHTML = '<i class="fas fa-save"></i> Atualizar';
        }
        
        // Mostrar modal de edição
        const modal = document.getElementById('cargoModal');
        if (modal) {
            modal.style.display = 'block';
        }
        
        // Atualizar preview
        setTimeout(() => this.atualizarPreview(), 100);
    }
    
    /**
     * ❌ FECHAR MODAL CARGO
     */
    closeCargoModal() {
        const modal = document.getElementById('cargoModal');
        if (modal) {
            modal.style.display = 'none';
        }
        
        this.clearCargoForm();
        this.isEditMode = false;
        this.cargoAtual = null;
        
        // Remover preview se existir
        const preview = document.getElementById('cargoPreviewCalculos');
        if (preview) {
            preview.remove();
        }
    }
    
    /**
     * 🧹 LIMPAR FORMULÁRIO
     */
    clearCargoForm() {
        const form = document.getElementById('cargoForm');
        if (form) {
            form.reset();
        }
        
        // Limpar campos hidden
        const cargoId = document.getElementById('cargoId');
        if (cargoId) cargoId.value = '';
        
        // Remover classes de erro
        const inputs = form ? form.querySelectorAll('input, select, textarea') : [];
        inputs.forEach(input => {
            input.classList.remove('error');
        });
    }
    
    /**
     * 📝 PREENCHER FORMULÁRIO
     */
    fillCargoForm(cargo) {
        document.getElementById('cargoId').value = cargo.id || '';
        document.getElementById('cargoNome').value = cargo.nome || '';
        document.getElementById('cargoSalarioBase').value = cargo.salarioBase || '';
        document.getElementById('cargoPericulosidade').value = cargo.periculosidade || '';
        document.getElementById('cargoAdicionalNoturno').value = cargo.adicionalNoturno || '';
        document.getElementById('cargoObservacoes').value = cargo.observacoes || '';
    }
    
    /**
     * 💾 MANIPULAR SUBMIT DO FORMULÁRIO
     */
    async handleCargoSubmit(event) {
        event.preventDefault();
        
        // PROTEÇÃO CONTRA EXECUÇÃO DUPLA
        if (this._savingCargo) {
            console.log('⚠️ Salvamento de cargo já em andamento, ignorando...');
            return;
        }
        
        this._savingCargo = true;
        console.log('💾 Salvando cargo...');
        
        try {
            // Coletar dados do formulário
            const cargoData = this.getCargoFormData();
            
            // Validar dados
            const validation = this.validateCargoData(cargoData);
            if (!validation.isValid) {
                this.showValidationErrors(validation.errors);
                return;
            }
            
            // Salvar cargo
            const savedCargo = await this.saveCargo(cargoData);
            
            if (savedCargo) {
                this.showNotification(
                    this.isEditMode ? 'Cargo atualizado com sucesso!' : 'Cargo cadastrado com sucesso!',
                    'success'
                );
                
                this.closeCargoModal();
                await this.loadCargos();
            }
            
        } catch (error) {
            console.error('❌ Erro ao salvar cargo:', error);
            this.showNotification('Erro ao salvar cargo: ' + error.message, 'error');
        } finally {
            // Liberar flag de salvamento
            this._savingCargo = false;
        }
    }
    
    /**
     * 📊 COLETAR DADOS DO FORMULÁRIO
     */
    getCargoFormData() {
        return {
            id: (document.getElementById('cargoId') && document.getElementById('cargoId').value) || null,
            nome: (function(){ const v = (document.getElementById('cargoNome') && document.getElementById('cargoNome').value.trim()) || ''; return window.isAllCaps(v) ? window.toTitleCasePt(v) : v; })(),
            salarioBase: parseFloat((document.getElementById('cargoSalarioBase') && document.getElementById('cargoSalarioBase').value) || 0),
            periculosidade: parseFloat((document.getElementById('cargoPericulosidade') && document.getElementById('cargoPericulosidade').value) || 0),
            adicionalNoturno: parseFloat((document.getElementById('cargoAdicionalNoturno') && document.getElementById('cargoAdicionalNoturno').value) || 0),
            observacoes: (function(){ const v = (document.getElementById('cargoObservacoes') && document.getElementById('cargoObservacoes').value.trim()) || ''; return window.isAllCaps(v) ? window.toTitleCasePt(v) : v; })(),
            dataAtualizacao: new Date().toISOString(),
            ativo: true
        };
    }
    
    /**
     * ✅ VALIDAR DADOS DO CARGO
     */
    validateCargoData(data) {
        const errors = [];
        
        // Nome obrigatório
        if (!data.nome) {
            errors.push({ field: 'cargoNome', message: 'Nome do cargo é obrigatório' });
        } else if (data.nome.length < 2) {
            errors.push({ field: 'cargoNome', message: 'Nome deve ter pelo menos 2 caracteres' });
        } else {
            // Verificar se tem padrões de validação disponíveis
            const cargosConfig = (window.FolhaConfig && window.FolhaConfig.cargos) || window.CARGOS_CONFIG;
            if (cargosConfig && cargosConfig.VALIDATION_PATTERNS && cargosConfig.VALIDATION_PATTERNS.NOME && !cargosConfig.VALIDATION_PATTERNS.NOME.test(data.nome)) {
                errors.push({ field: 'cargoNome', message: 'Nome contém caracteres inválidos' });
            }
        }
        
        // Salário base obrigatório
        if (!data.salarioBase || data.salarioBase <= 0) {
            errors.push({ field: 'cargoSalarioBase', message: 'Salário base é obrigatório e deve ser maior que zero' });
        } else if (data.salarioBase < 1320) { // Salário mínimo 2024
            errors.push({ field: 'cargoSalarioBase', message: 'Salário não pode ser menor que o salário mínimo' });
        }
        
        // Validar percentuais
        if (data.periculosidade < 0 || data.periculosidade > 30) {
            errors.push({ field: 'cargoPericulosidade', message: 'Periculosidade deve estar entre 0% e 30%' });
        }
        
        if (data.adicionalNoturno < 0 || data.adicionalNoturno > 25) {
            errors.push({ field: 'cargoAdicionalNoturno', message: 'Adicional noturno deve estar entre 0% e 25%' });
        }
        
        // Verificar duplicação de nome (apenas para novos cargos)
        if (!this.isEditMode) {
            const nomeExiste = this.cargos.some(cargo => 
                cargo.nome.toLowerCase() === data.nome.toLowerCase()
            );
            if (nomeExiste) {
                errors.push({ field: 'cargoNome', message: 'Já existe um cargo com este nome' });
            }
        }
        
        return {
            isValid: errors.length === 0,
            errors
        };
    }
    
    /**
     * 🚨 MOSTRAR ERROS DE VALIDAÇÃO
     */
    showValidationErrors(errors) {
        // Limpar erros anteriores
        const inputs = document.querySelectorAll('#cargoForm input, #cargoForm select, #cargoForm textarea');
        inputs.forEach(input => {
            input.classList.remove('error');
            const errorMsg = input.parentNode.querySelector('.error-message');
            if (errorMsg) errorMsg.remove();
        });
        
        // Mostrar novos erros
        errors.forEach(error => {
            const field = document.getElementById(error.field);
            if (field) {
                field.classList.add('error');
                
                // Adicionar mensagem de erro
                const errorDiv = document.createElement('div');
                errorDiv.className = 'error-message';
                errorDiv.style.color = '#e74c3c';
                errorDiv.style.fontSize = '12px';
                errorDiv.style.marginTop = '5px';
                errorDiv.textContent = error.message;
                
                field.parentNode.appendChild(errorDiv);
            }
        });
        
        // Focar no primeiro campo com erro
        if (errors.length > 0) {
            const firstErrorField = document.getElementById(errors[0].field);
            if (firstErrorField) {
                firstErrorField.focus();
            }
        }
    }
    
    /**
     * 💾 SALVAR CARGO NO FIREBASE
     */
    async saveCargo(cargoData) {
        try {
            if (!window.database) {
                throw new Error('Firebase não inicializado');
            }
            
            const { ref, push, set, update } = await import('../firebase-init.js');
            
            if (this.isEditMode && cargoData.id) {
                // Atualizar cargo existente
                const cargosConfig = (window.FolhaConfig && window.FolhaConfig.cargos) || window.CARGOS_CONFIG;
                const collection = (cargosConfig && cargosConfig.COLLECTION) || 'cargos';
                const cargoRef = ref(window.database, this._resolvePath(`${collection}/${cargoData.id}`));
                await update(cargoRef, cargoData);
                
                console.log('✅ Cargo atualizado:', cargoData.id);
                return { ...cargoData };
                
            } else {
                // Criar novo cargo
                const cargosConfig = (window.FolhaConfig && window.FolhaConfig.cargos) || window.CARGOS_CONFIG;
                const collection = (cargosConfig && cargosConfig.COLLECTION) || 'cargos';
                const cargosRef = ref(window.database, this._resolvePath(collection));
                const newCargoRef = push(cargosRef);
                
                const cargoComId = {
                    ...cargoData,
                    id: newCargoRef.key,
                    dataCriacao: new Date().toISOString()
                };
                
                await set(newCargoRef, cargoComId);
                
                console.log('✅ Cargo criado:', newCargoRef.key);
                return cargoComId;
            }
            
        } catch (error) {
            console.error('❌ Erro ao salvar cargo:', error);
            throw error;
        }
    }
    
    /**
     * 📋 CARREGAR CARGOS DO FIREBASE
     */
    async loadCargos() {
        try {
            if (!window.database) {
                console.warn('⚠️ Firebase não inicializado');
                return;
            }
            
            const { ref, onValue, off } = await import('../firebase-init.js');
            
            const cargosConfig = (window.FolhaConfig && window.FolhaConfig.cargos) || window.CARGOS_CONFIG;
            const collection = (cargosConfig && cargosConfig.COLLECTION) || 'cargos';
            const cargosRef = ref(window.database, this._resolvePath(collection));
            
            onValue(cargosRef, (snapshot) => {
                const data = snapshot.val();
                this.cargos = data ? Object.values(data) : [];
                
                console.log(`📋 ${this.cargos.length} cargos carregados`);
                
                // Atualizar autocomplete
                this.updateAutocomplete();
                
            }, (error) => {
                const msg = String((error && (error.code || error.message)) || error || '');
                if (msg.toLowerCase().includes('permission')) {
                    console.warn('⚠️ Sem permissão para carregar cargos');
                    return;
                }
                console.error('❌ Erro ao carregar cargos:', error);
                this.showNotification('Erro ao carregar cargos', 'error');
            });
            
        } catch (error) {
            console.error('❌ Erro ao conectar com Firebase:', error);
            this.showNotification('Erro de conexão com o banco de dados', 'error');
        }
    }
    
    /**
     * 🔍 CONFIGURAR AUTOCOMPLETE
     */
    setupAutocomplete() {
        const cargoInputs = document.querySelectorAll('input[id*="Cargo"], input[id*="cargo"]');
        
        cargoInputs.forEach(input => {
            if (input.classList.contains('autocomplete-input')) {
                this.setupCargoAutocomplete(input);
            }
        });
    }
    
    /**
     * 🔍 CONFIGURAR AUTOCOMPLETE DE CARGO
     */
    setupCargoAutocomplete(input) {
        let timeout;
        
        input.addEventListener('input', () => {
            clearTimeout(timeout);
            timeout = setTimeout(() => {
                this.showCargoSuggestions(input);
            }, 300);
        });
        
        // Esconder sugestões ao perder foco
        input.addEventListener('blur', () => {
            setTimeout(() => this.hideCargoSuggestions(input), 200);
        });
    }
    
    /**
     * 💡 MOSTRAR SUGESTÕES DE CARGO
     */
    showCargoSuggestions(input) {
        const query = input.value.toLowerCase().trim();
        
        if (query.length < 2) {
            this.hideCargoSuggestions(input);
            return;
        }
        
        const suggestions = this.cargos.filter(cargo =>
            cargo.ativo && cargo.nome.toLowerCase().includes(query)
        ).slice(0, 10);
        
        this.renderCargoSuggestions(input, suggestions);
    }
    
    /**
     * 🎨 RENDERIZAR SUGESTÕES
     */
    renderCargoSuggestions(input, suggestions) {
        // Remover sugestões anteriores
        this.hideCargoSuggestions(input);
        
        if (suggestions.length === 0) return;
        
        const container = input.closest('.autocomplete-container') || input.parentNode;
        
        const suggestionsList = document.createElement('div');
        suggestionsList.className = 'autocomplete-suggestions';
        suggestionsList.style.cssText = `
            position: absolute;
            top: 100%;
            left: 0;
            right: 0;
            background: white;
            border: 1px solid #ddd;
            border-top: none;
            max-height: 200px;
            overflow-y: auto;
            z-index: 1000;
            box-shadow: 0 2px 4px rgba(0,0,0,0.1);
        `;
        
        suggestions.forEach(cargo => {
            const item = document.createElement('div');
            item.className = 'autocomplete-item';
            item.style.cssText = `
                padding: 10px;
                cursor: pointer;
                border-bottom: 1px solid #eee;
                display: flex;
                justify-content: space-between;
                align-items: center;
            `;
            
            item.innerHTML = `
                <div>
                    <strong>${cargo.nome}</strong>
                    <div style="font-size: 12px; color: #666;">
                        R$ ${cargo.salarioBase.toFixed(2).replace('.', ',')}
                    </div>
                </div>
                <div style="font-size: 11px; color: #999;">
                    ${cargo.periculosidade > 0 ? `Peric: ${cargo.periculosidade}%` : ''}
                    ${cargo.adicionalNoturno > 0 ? ` Not: ${cargo.adicionalNoturno}%` : ''}
                </div>
            `;
            
            item.addEventListener('mouseenter', () => {
                item.style.backgroundColor = '#f5f5f5';
            });
            
            item.addEventListener('mouseleave', () => {
                item.style.backgroundColor = 'white';
            });
            
            item.addEventListener('click', () => {
                this.selectCargo(input, cargo);
            });
            
            suggestionsList.appendChild(item);
        });
        
        container.style.position = 'relative';
        container.appendChild(suggestionsList);
    }
    
    /**
     * ✅ SELECIONAR CARGO
     */
    selectCargo(input, cargo) {
        input.value = cargo.nome;
        input.dataset.cargoId = cargo.id;
        input.dataset.cargoData = JSON.stringify(cargo);
        
        // Preencher campos relacionados: sempre popular o salário do funcionário ao selecionar cargo
        const salarioFuncionarioInput = document.getElementById('funcionarioSalario');
        if (salarioFuncionarioInput) {
            salarioFuncionarioInput.value = Number(cargo.salarioBase || 0);
            // Disparar eventos para qualquer cálculo/validação dependente
            salarioFuncionarioInput.dispatchEvent(new Event('input', { bubbles: true }));
            salarioFuncionarioInput.dispatchEvent(new Event('change', { bubbles: true }));
        }
        
        this.hideCargoSuggestions(input);
        
        // Disparar evento personalizado
        input.dispatchEvent(new CustomEvent('cargoSelected', {
            detail: { cargo }
        }));
    }
    
    /**
     * 🙈 ESCONDER SUGESTÕES
     */
    hideCargoSuggestions(input) {
        const container = input.closest('.autocomplete-container') || input.parentNode;
        const suggestions = container.querySelector('.autocomplete-suggestions');
        if (suggestions) {
            suggestions.remove();
        }
    }
    
    /**
     * 🔄 ATUALIZAR AUTOCOMPLETE
     */
    updateAutocomplete() {
        // Força atualização das sugestões se algum input estiver ativo
        const activeInput = document.activeElement;
        if (activeInput && activeInput.classList.contains('autocomplete-input')) {
            this.showCargoSuggestions(activeInput);
        }
    }
    
    /**
     * 📋 ABRIR MODAL LISTA DE CARGOS
     */
    openCargosListModal() {
        console.log('🏢 Abrindo modal lista de cargos...');
        
        const modal = document.getElementById('cargosListModal');
        if (modal) {
            modal.style.display = 'block';
            
            // Atualizar lista
            this.updateCargosListTable();
            
            // Configurar filtro
            this.setupCargosListFilter();
            
            // Foco no filtro
            setTimeout(() => {
                const filterInput = document.getElementById('cargosListFilter');
                if (filterInput) filterInput.focus();
            }, 100);
        }
    }
    
    /**
     * ❌ FECHAR MODAL LISTA DE CARGOS
     */
    closeCargosListModal() {
        const modal = document.getElementById('cargosListModal');
        if (modal) {
            modal.style.display = 'none';
        }
        
        // Limpar filtro
        const filterInput = document.getElementById('cargosListFilter');
        if (filterInput) {
            filterInput.value = '';
        }
    }
    
    /**
     * 🔍 CONFIGURAR FILTRO DA LISTA
     */
    setupCargosListFilter() {
        const filterInput = document.getElementById('cargosListFilter');
        if (filterInput) {
            filterInput.addEventListener('input', () => {
                this.filterCargosList();
            });
        }
    }
    
    /**
     * 🎯 FILTRAR LISTA DE CARGOS
     */
    filterCargosList() {
        const filterValue = (document.getElementById('cargosListFilter') && document.getElementById('cargosListFilter').value.toLowerCase()) || '';
        const rows = document.querySelectorAll('#cargosListTable tr');
        
        rows.forEach(row => {
            const text = row.textContent.toLowerCase();
            row.style.display = text.includes(filterValue) ? '' : 'none';
        });
        
        // Atualizar contador
        const visibleRows = Array.from(rows).filter(row => row.style.display !== 'none');
        this.updateCargosModalInfo(`${visibleRows.length} cargo(s) encontrado(s)`);
    }
    
    /**
     * 📊 ATUALIZAR TABELA DE CARGOS
     */
    updateCargosListTable() {
        const tableBody = document.getElementById('cargosListTable');
        if (!tableBody) return;
        
        // Filtrar apenas cargos ativos
        const cargosAtivos = this.cargos.filter(cargo => cargo.ativo !== false);
        
        if (cargosAtivos.length === 0) {
            tableBody.innerHTML = `
                <tr>
                    <td colspan="6" style="text-align: center; padding: 20px; color: #666;">
                        <i class="fas fa-briefcase" style="font-size: 24px; margin-bottom: 10px; display: block;"></i>
                        Nenhum cargo cadastrado
                    </td>
                </tr>
            `;
            this.updateCargosModalInfo('Nenhum cargo encontrado');
            return;
        }
        
        // Ordenar por nome
        cargosAtivos.sort((a, b) => a.nome.localeCompare(b.nome));
        
        tableBody.innerHTML = cargosAtivos.map(cargo => {
            const base = Number(cargo.salarioBase || 0);
            const salarioTotal = base + 
                                (base * Number(cargo.periculosidade || 0) / 100) +
                                (base * Number(cargo.adicionalNoturno || 0) / 100);
            
            return `
                <tr>
                    <td data-label="Nome">
                        <strong>${cargo.nome}</strong>
                        ${cargo.observacoes ? `<div style="font-size: 11px; color: #666; margin-top: 2px;">${cargo.observacoes}</div>` : ''}
                    </td>
                    <td data-label="Salário Base">R$ ${Number(cargo.salarioBase || 0).toFixed(2).replace('.', ',')}</td>
                    <td data-label="Periculosidade">${cargo.periculosidade || 0}%</td>
                    <td data-label="Adicional Noturno">${cargo.adicionalNoturno || 0}%</td>
                    <td data-label="Total"><strong>R$ ${salarioTotal.toFixed(2).replace('.', ',')}</strong></td>
                    <td data-label="Ações" class="actions-cell">
                        <button class="action-button select-button" title="Selecionar" 
                                onclick="selectCargoFromList('${cargo.id}')">
                            <i class="fas fa-check"></i>
                        </button>
                        <button class="action-button edit-button" title="Editar" 
                                onclick="editCargo('${cargo.id}')">
                            <i class="fas fa-edit"></i>
                        </button>
                        <button class="action-button delete-button" title="Excluir" 
                                onclick="deleteCargo('${cargo.id}')">
                            <i class="fas fa-trash"></i>
                        </button>
                    </td>
                </tr>
            `;
        }).join('');
        if (window.FolhaUtils && typeof window.FolhaUtils.applyMobileTableLabels === 'function') {
            window.FolhaUtils.applyMobileTableLabels(document.getElementById('cargosListModal'));
        }
        
        this.updateCargosModalInfo(`${cargosAtivos.length} cargo(s) cadastrado(s)`);
    }
    
    /**
     * ℹ️ ATUALIZAR INFO DO MODAL
     */
    updateCargosModalInfo(text) {
        const infoElement = document.getElementById('cargosModalInfo');
        if (infoElement) {
            infoElement.textContent = text;
        }
    }
    
    /**
     * ✅ SELECIONAR CARGO DA LISTA
     */
    selectCargoFromList(cargoId) {
        const cargo = this.cargos.find(c => c.id === cargoId);
        if (!cargo) {
            this.showNotification('Cargo não encontrado!', 'error');
            return;
        }
        
        // Encontrar o input ativo que chamou o modal
        const activeInput = document.querySelector('input[id*="Cargo"]:focus, input[id*="cargo"]:focus') ||
                           document.querySelector('input[id*="Cargo"].autocomplete-input, input[id*="cargo"].autocomplete-input');
        
        if (activeInput) {
            this.selectCargo(activeInput, cargo);
        }
        
        this.closeCargosListModal();
        
        // ✅ CORREÇÃO: Removida mensagem desnecessária "Cargo selecionado!"
        // A seleção já é visível no campo preenchido, não precisa de notificação
    }
    
    /**
     * 🗑️ EXCLUIR CARGO
     */
    async deleteCargo(cargoId) {
        if (!confirm('Tem certeza que deseja excluir este cargo?')) {
            return;
        }
        
        try {
            if (!window.database) {
                throw new Error('Firebase não inicializado');
            }
            
            const { ref, update } = await import('../firebase-init.js');
            
            // Soft delete - marcar como inativo
            const cargosConfig = (window.FolhaConfig && window.FolhaConfig.cargos) || window.CARGOS_CONFIG;
            const collection = (cargosConfig && cargosConfig.COLLECTION) || 'cargos';
            const cargoRef = ref(window.database, this._resolvePath(`${collection}/${cargoId}`));
            await update(cargoRef, {
                ativo: false,
                dataExclusao: new Date().toISOString()
            });
            
            this.showNotification('Cargo excluído com sucesso!', 'success');
            
            // Atualizar lista se modal estiver aberto
            const modal = document.getElementById('cargosListModal');
            if (modal && modal.style.display === 'block') {
                this.updateCargosListTable();
            }
            
        } catch (error) {
            console.error('❌ Erro ao excluir cargo:', error);
            this.showNotification('Erro ao excluir cargo: ' + error.message, 'error');
        }
    }
    
    /**
     * 📢 MOSTRAR NOTIFICAÇÃO
     */
    showNotification(message, type = 'info') {
        // Usar sistema de notificações do romaneiopct se disponível
        if (window.FolhaUtils && window.FolhaUtils.showToast) {
            window.FolhaUtils.showToast(message, type);
        } else {
            // Fallback para console apenas (sem alert)
            console.log(`${type.toUpperCase()}: ${message}`);
        }
    }
}

// ✅ FUNÇÕES GLOBAIS ESPECÍFICAS (não duplicadas com folha-main.js)
window.editCargo = function(cargoId) {
    if (window.folhaCargos) {
        window.folhaCargos.openEditCargoModal(cargoId);
    }
};

window.deleteCargo = function(cargoId) {
    if (window.folhaCargos) {
        window.folhaCargos.deleteCargo(cargoId);
    }
};

window.openCargosListModal = function() {
    if (window.folhaCargos) {
        window.folhaCargos.openCargosListModal();
    }
};

window.closeCargosListModal = function() {
    if (window.folhaCargos) {
        window.folhaCargos.closeCargosListModal();
    }
};

window.selectCargoFromList = function(cargoId) {
    if (window.folhaCargos) {
        window.folhaCargos.selectCargoFromList(cargoId);
    }
};

// ✅ INICIALIZAÇÃO AUTOMÁTICA
document.addEventListener('DOMContentLoaded', () => {
    // Aguardar carregamento do Firebase E dos elementos DOM
    const initCargos = () => {
        const cargoForm = document.getElementById('cargoForm');
        const database = window.database;
        
        console.log(`🔍 Verificando inicialização cargos: database=${!!database}, form=${!!cargoForm}`);
        
        if (database && cargoForm) {
            window.folhaCargos = new FolhaCargos();
            console.log('✅ Sistema de cargos inicializado com formulário disponível');
        } else if (database && !cargoForm) {
            console.log('⏳ Firebase OK, aguardando formulário de cargo...');
            setTimeout(initCargos, 500);
        } else if (!database && cargoForm) {
            console.log('⏳ Formulário OK, aguardando Firebase...');
            setTimeout(initCargos, 500);
        } else {
            console.log('⏳ Aguardando Firebase e formulário...');
            setTimeout(initCargos, 500);
        }
    };
    
    // Aguardar um pouco mais para garantir que o HTML foi totalmente carregado
    setTimeout(initCargos, 1000);
});

// ✅ EXPORTAR PARA MÓDULOS
if (typeof module !== 'undefined' && module.exports) {
    module.exports = { FolhaCargos, CARGOS_CONFIG };
}

console.log('🔍 [DEBUG] Inicialização folhaCargos:', typeof window.folhaCargos, window.folhaCargos);
