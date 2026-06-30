/**
 * FORMULÁRIO DE ESPÉCIES
 * Sistema completo de cadastro e gestão de espécies madeireiras
 * 
 * @author Sistema de Excelência Firebase
 * @version 2.0.0
 * @created 2024
 */

import stateManager, { EVENT_TYPES } from '../../services/stateManager.js';
import { UI_CONFIG } from '../../constants/app-constants.js';
import { Validator } from '../../utils/validators.js';
import { formatters } from '../../utils/formatters.js';
import logger from '../../utils/logger.js';

// =============================================================================
// CLASSE PRINCIPAL DO FORMULÁRIO DE ESPÉCIES
// =============================================================================
class EspecieForm {
    constructor() {
        this.modal = null;
        this.currentMode = null; // 'create' | 'edit' | 'view'
        this.currentEspecie = null;
        this.validator = new Validator();
        this.isInitialized = false;
        
        this.initialize();
    }

    /**
     * Inicializa o formulário
     */
    initialize() {
        this.createModal();
        this.setupEventListeners();
        this.setupValidation();
        this.isInitialized = true;
        
        logger.success('Formulário de espécies inicializado', '🌲 ESPÉCIE FORM');
    }

    /**
     * Cria modal do formulário
     */
    createModal() {
        // Remove modal existente se houver
        const existingModal = document.getElementById('especie-modal');
        if (existingModal) {
            existingModal.remove();
        }

        // Cria novo modal
        const modalHTML = `
            <div class="modal fade" id="especie-modal" tabindex="-1" aria-hidden="true">
                <div class="modal-dialog modal-lg modal-dialog-centered">
                    <div class="modal-content">
                        <!-- Header do Modal -->
                        <div class="modal-header">
                            <h5 class="modal-title" id="especie-modal-title">
                                <span class="modal-icon">🌲</span>
                                <span class="modal-title-text">Nova Espécie</span>
                            </h5>
                            <button type="button" class="btn-close" data-bs-dismiss="modal"></button>
                        </div>

                        <!-- Corpo do Modal -->
                        <div class="modal-body">
                            <form id="especie-form" novalidate>
                                <!-- Informações Básicas -->
                                <div class="form-section">
                                    <h6 class="section-title">
                                        <span class="section-icon">📋</span>
                                        Informações Básicas
                                    </h6>
                                    
                                    <div class="row">
                                        <div class="col-md-8">
                                            <div class="form-group">
                                                <label class="form-label required">Nome da Espécie</label>
                                                <input type="text" 
                                                       class="form-control" 
                                                       id="especie-nome"
                                                       placeholder="Ex: Eucalipto, Pinus, Cedrinho..."
                                                       maxlength="100"
                                                       required>
                                                <div class="invalid-feedback"></div>
                                            </div>
                                        </div>
                                        
                                        <div class="col-md-4">
                                            <div class="form-group">
                                                <label class="form-label">Código/Sigla</label>
                                                <input type="text" 
                                                       class="form-control" 
                                                       id="especie-codigo"
                                                       placeholder="Ex: EUC, PIN, CED..."
                                                       maxlength="10"
                                                       style="text-transform: uppercase;">
                                                <div class="invalid-feedback"></div>
                                            </div>
                                        </div>
                                    </div>

                                    <div class="row">
                                        <div class="col-md-6">
                                            <div class="form-group">
                                                <label class="form-label">Nome Científico</label>
                                                <input type="text" 
                                                       class="form-control" 
                                                       id="especie-cientifico"
                                                       placeholder="Ex: Eucalyptus grandis"
                                                       maxlength="150">
                                                <div class="invalid-feedback"></div>
                                            </div>
                                        </div>
                                        
                                        <div class="col-md-6">
                                            <div class="form-group">
                                                <label class="form-label">Família</label>
                                                <input type="text" 
                                                       class="form-control" 
                                                       id="especie-familia"
                                                       placeholder="Ex: Myrtaceae, Pinaceae..."
                                                       maxlength="100">
                                                <div class="invalid-feedback"></div>
                                            </div>
                                        </div>
                                    </div>
                                </div>

                                <!-- Características Técnicas -->
                                <div class="form-section">
                                    <h6 class="section-title">
                                        <span class="section-icon">⚙️</span>
                                        Características Técnicas
                                    </h6>
                                    
                                    <div class="row">
                                        <div class="col-md-4">
                                            <div class="form-group">
                                                <label class="form-label">Densidade (kg/m³)</label>
                                                <input type="number" 
                                                       class="form-control" 
                                                       id="especie-densidade"
                                                       placeholder="Ex: 450"
                                                       min="100"
                                                       max="2000"
                                                       step="0.1">
                                                <div class="invalid-feedback"></div>
                                                <small class="form-text text-muted">Densidade básica da madeira</small>
                                            </div>
                                        </div>
                                        
                                        <div class="col-md-4">
                                            <div class="form-group">
                                                <label class="form-label">Umidade Padrão (%)</label>
                                                <input type="number" 
                                                       class="form-control" 
                                                       id="especie-umidade"
                                                       placeholder="Ex: 12"
                                                       min="0"
                                                       max="100"
                                                       step="0.1">
                                                <div class="invalid-feedback"></div>
                                                <small class="form-text text-muted">Umidade de referência</small>
                                            </div>
                                        </div>
                                        
                                        <div class="col-md-4">
                                            <div class="form-group">
                                                <label class="form-label">Classe de Resistência</label>
                                                <select class="form-control" id="especie-classe">
                                                    <option value="">Selecione...</option>
                                                    <option value="C20">C20 - Baixa resistência</option>
                                                    <option value="C25">C25 - Resistência moderada</option>
                                                    <option value="C30">C30 - Boa resistência</option>
                                                    <option value="C40">C40 - Alta resistência</option>
                                                    <option value="C50">C50 - Muito alta resistência</option>
                                                    <option value="C60">C60 - Resistência excepcional</option>
                                                </select>
                                                <div class="invalid-feedback"></div>
                                            </div>
                                        </div>
                                    </div>

                                    <div class="row">
                                        <div class="col-md-6">
                                            <div class="form-group">
                                                <label class="form-label">Cor Predominante</label>
                                                <input type="text" 
                                                       class="form-control" 
                                                       id="especie-cor"
                                                       placeholder="Ex: Branco amarelado, Marrom claro..."
                                                       maxlength="100">
                                                <div class="invalid-feedback"></div>
                                            </div>
                                        </div>
                                        
                                        <div class="col-md-6">
                                            <div class="form-group">
                                                <label class="form-label">Durabilidade Natural</label>
                                                <select class="form-control" id="especie-durabilidade">
                                                    <option value="">Selecione...</option>
                                                    <option value="muito_baixa">Muito Baixa (< 5 anos)</option>
                                                    <option value="baixa">Baixa (5-10 anos)</option>
                                                    <option value="moderada">Moderada (10-15 anos)</option>
                                                    <option value="alta">Alta (15-25 anos)</option>
                                                    <option value="muito_alta">Muito Alta (> 25 anos)</option>
                                                </select>
                                                <div class="invalid-feedback"></div>
                                            </div>
                                        </div>
                                    </div>
                                </div>

                                <!-- Aplicações e Usos -->
                                <div class="form-section">
                                    <h6 class="section-title">
                                        <span class="section-icon">🔨</span>
                                        Aplicações e Usos
                                    </h6>
                                    
                                    <div class="row">
                                        <div class="col-12">
                                            <div class="form-group">
                                                <label class="form-label">Principais Usos</label>
                                                <div class="checkbox-grid">
                                                    <div class="form-check">
                                                        <input class="form-check-input" type="checkbox" id="uso-construcao" value="construcao">
                                                        <label class="form-check-label" for="uso-construcao">Construção Civil</label>
                                                    </div>
                                                    <div class="form-check">
                                                        <input class="form-check-input" type="checkbox" id="uso-moveis" value="moveis">
                                                        <label class="form-check-label" for="uso-moveis">Móveis</label>
                                                    </div>
                                                    <div class="form-check">
                                                        <input class="form-check-input" type="checkbox" id="uso-papel" value="papel">
                                                        <label class="form-check-label" for="uso-papel">Papel e Celulose</label>
                                                    </div>
                                                    <div class="form-check">
                                                        <input class="form-check-input" type="checkbox" id="uso-energia" value="energia">
                                                        <label class="form-check-label" for="uso-energia">Biomassa/Energia</label>
                                                    </div>
                                                    <div class="form-check">
                                                        <input class="form-check-input" type="checkbox" id="uso-paineis" value="paineis">
                                                        <label class="form-check-label" for="uso-paineis">Painéis</label>
                                                    </div>
                                                    <div class="form-check">
                                                        <input class="form-check-input" type="checkbox" id="uso-decoracao" value="decoracao">
                                                        <label class="form-check-label" for="uso-decoracao">Decoração</label>
                                                    </div>
                                                </div>
                                            </div>
                                        </div>
                                    </div>

                                    <div class="form-group">
                                        <label class="form-label">Observações e Características Especiais</label>
                                        <textarea class="form-control" 
                                                  id="especie-observacoes"
                                                  rows="3"
                                                  maxlength="500"
                                                  placeholder="Informações adicionais sobre a espécie, tratamentos especiais, cuidados no manuseio, etc."></textarea>
                                        <small class="form-text text-muted">
                                            <span id="obs-counter">0</span>/500 caracteres
                                        </small>
                                        <div class="invalid-feedback"></div>
                                    </div>
                                </div>

                                <!-- Configurações Comerciais -->
                                <div class="form-section">
                                    <h6 class="section-title">
                                        <span class="section-icon">💰</span>
                                        Configurações Comerciais
                                    </h6>
                                    
                                    <div class="row">
                                        <div class="col-md-4">
                                            <div class="form-group">
                                                <label class="form-label">Preço Base (R$/m³)</label>
                                                <input type="number" 
                                                       class="form-control" 
                                                       id="especie-preco"
                                                       placeholder="0,00"
                                                       min="0"
                                                       step="0.01">
                                                <div class="invalid-feedback"></div>
                                                <small class="form-text text-muted">Preço de referência</small>
                                            </div>
                                        </div>
                                        
                                        <div class="col-md-4">
                                            <div class="form-group">
                                                <label class="form-label">Unidade de Medida</label>
                                                <select class="form-control" id="especie-unidade">
                                                    <option value="m³">m³ (metros cúbicos)</option>
                                                    <option value="m²">m² (metros quadrados)</option>
                                                    <option value="peca">Peça/Unidade</option>
                                                    <option value="ton">Tonelada</option>
                                                    <option value="st">Estéreo (st)</option>
                                                </select>
                                                <div class="invalid-feedback"></div>
                                            </div>
                                        </div>
                                        
                                        <div class="col-md-4">
                                            <div class="form-group">
                                                <label class="form-label">Status</label>
                                                <select class="form-control" id="especie-status">
                                                    <option value="ativo">Ativo</option>
                                                    <option value="inativo">Inativo</option>
                                                    <option value="descontinuado">Descontinuado</option>
                                                </select>
                                                <div class="invalid-feedback"></div>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </form>
                        </div>

                        <!-- Footer do Modal -->
                        <div class="modal-footer">
                            <div class="footer-info">
                                <small class="text-muted">
                                    <span id="form-status-info">Preencha os campos obrigatórios</span>
                                </small>
                            </div>
                            
                            <div class="footer-buttons">
                                <button type="button" class="btn btn-secondary" data-bs-dismiss="modal">
                                    Cancelar
                                </button>
                                
                                <button type="button" class="btn btn-primary" id="btn-save-especie">
                                    <span class="btn-icon">💾</span>
                                    <span class="btn-text">Salvar Espécie</span>
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        `;

        document.body.insertAdjacentHTML('beforeend', modalHTML);
        
        // Inicializa modal do Bootstrap
        this.modal = new bootstrap.Modal(document.getElementById('especie-modal'), {
            keyboard: true,
            backdrop: 'static'
        });

        this.injectStyles();
    }

    /**
     * Configura event listeners
     */
    setupEventListeners() {
        const modal = document.getElementById('especie-modal');
        const form = document.getElementById('especie-form');
        const saveBtn = document.getElementById('btn-save-especie');
        const obsTextarea = document.getElementById('especie-observacoes');
        const codigoInput = document.getElementById('especie-codigo');

        // Contador de caracteres para observações
        if (obsTextarea) {
            obsTextarea.addEventListener('input', (e) => {
                const counter = document.getElementById('obs-counter');
                if (counter) {
                    counter.textContent = e.target.value.length;
                }
            });
        }

        // Auto-transformar código em maiúsculo
        if (codigoInput) {
            codigoInput.addEventListener('input', (e) => {
                e.target.value = e.target.value.toUpperCase();
            });
        }

        // Botão salvar
        if (saveBtn) {
            saveBtn.addEventListener('click', () => this.save());
        }

        // Validação em tempo real
        if (form) {
            form.addEventListener('input', () => this.validateForm());
            form.addEventListener('change', () => this.validateForm());
        }

        // Eventos do modal
        if (modal) {
            modal.addEventListener('shown.bs.modal', () => {
                const firstInput = modal.querySelector('input:not([readonly]):not([disabled])');
                if (firstInput) {
                    firstInput.focus();
                }
            });

            modal.addEventListener('hidden.bs.modal', () => {
                this.clearForm();
            });
        }

        // Teclas de atalho
        document.addEventListener('keydown', (e) => {
            if (this.modal && this.modal._isShown) {
                if (e.ctrlKey && e.key === 's') {
                    e.preventDefault();
                    this.save();
                } else if (e.key === 'Escape') {
                    this.hide();
                }
            }
        });
    }

    /**
     * Configura validação
     */
    setupValidation() {
        this.validator.addRule('especie-nome', {
            required: true,
            minLength: 2,
            maxLength: 100,
            message: 'Nome da espécie é obrigatório (2-100 caracteres)'
        });

        this.validator.addRule('especie-codigo', {
            maxLength: 10,
            pattern: /^[A-Z0-9]*$/,
            message: 'Código deve conter apenas letras maiúsculas e números'
        });

        this.validator.addRule('especie-cientifico', {
            maxLength: 150,
            message: 'Nome científico muito longo'
        });

        this.validator.addRule('especie-familia', {
            maxLength: 100,
            message: 'Nome da família muito longo'
        });

        this.validator.addRule('especie-densidade', {
            min: 100,
            max: 2000,
            message: 'Densidade deve estar entre 100 e 2000 kg/m³'
        });

        this.validator.addRule('especie-umidade', {
            min: 0,
            max: 100,
            message: 'Umidade deve estar entre 0 e 100%'
        });

        this.validator.addRule('especie-preco', {
            min: 0,
            message: 'Preço deve ser maior ou igual a zero'
        });

        this.validator.addRule('especie-observacoes', {
            maxLength: 500,
            message: 'Observações não podem exceder 500 caracteres'
        });
    }

    // =========================================================================
    // MÉTODOS PÚBLICOS
    // =========================================================================

    /**
     * Abre modal para criar nova espécie
     */
    create() {
        this.currentMode = 'create';
        this.currentEspecie = null;
        
        this.updateModalTitle('Nova Espécie', '🌲');
        this.clearForm();
        this.enableForm();
        this.show();
        
        logger.ui('especie_form_opened', { mode: 'create' });
    }

    /**
     * Abre modal para editar espécie
     */
    edit(especie) {
        if (!especie) {
            logger.error('Espécie não fornecida para edição', '🌲 ESPÉCIE FORM');
            return;
        }

        this.currentMode = 'edit';
        this.currentEspecie = especie;
        
        this.updateModalTitle(`Editar: ${especie.nome}`, '✏️');
        this.populateForm(especie);
        this.enableForm();
        this.show();
        
        logger.ui('especie_form_opened', { mode: 'edit', especie: especie.id });
    }

    /**
     * Abre modal para visualizar espécie
     */
    view(especie) {
        if (!especie) {
            logger.error('Espécie não fornecida para visualização', '🌲 ESPÉCIE FORM');
            return;
        }

        this.currentMode = 'view';
        this.currentEspecie = especie;
        
        this.updateModalTitle(`Visualizar: ${especie.nome}`, '👁️');
        this.populateForm(especie);
        this.disableForm();
        this.show();
        
        logger.ui('especie_form_opened', { mode: 'view', especie: especie.id });
    }

    /**
     * Salva espécie
     */
    async save() {
        try {
            if (!this.validateForm()) {
                logger.warn('Formulário possui erros de validação', '🌲 ESPÉCIE FORM');
                return;
            }

            const formData = this.getFormData();
            
            if (this.currentMode === 'create') {
                await stateManager.saveEspecie(formData);
                logger.success(`Espécie "${formData.nome}" criada com sucesso`, '🌲 ESPÉCIE FORM');
            } else if (this.currentMode === 'edit') {
                await stateManager.saveEspecie({ ...formData, id: this.currentEspecie.id });
                logger.success(`Espécie "${formData.nome}" atualizada com sucesso`, '🌲 ESPÉCIE FORM');
            }

            this.hide();
            
        } catch (error) {
            logger.error('Erro ao salvar espécie', '🌲 ESPÉCIE FORM', error);
        }
    }

    /**
     * Mostra o modal
     */
    show() {
        if (this.modal) {
            this.modal.show();
        }
    }

    /**
     * Esconde o modal
     */
    hide() {
        if (this.modal) {
            this.modal.hide();
        }
    }

    // =========================================================================
    // MÉTODOS PRIVADOS
    // =========================================================================

    /**
     * Atualiza título do modal
     */
    updateModalTitle(title, icon) {
        const titleElement = document.querySelector('#especie-modal .modal-title-text');
        const iconElement = document.querySelector('#especie-modal .modal-icon');
        
        if (titleElement) titleElement.textContent = title;
        if (iconElement) iconElement.textContent = icon;
    }

    /**
     * Popula formulário com dados
     */
    populateForm(especie) {
        if (!especie) return;

        // Campos básicos
        this.setFieldValue('especie-nome', especie.especie || especie.nome);
        this.setFieldValue('especie-codigo', especie.codigo);
        this.setFieldValue('especie-cientifico', especie.nomeCientifico);
        this.setFieldValue('especie-familia', especie.familia);

        // Características técnicas
        this.setFieldValue('especie-densidade', especie.densidade);
        this.setFieldValue('especie-umidade', especie.umidade);
        this.setFieldValue('especie-classe', especie.classeResistencia);
        this.setFieldValue('especie-cor', especie.cor);
        this.setFieldValue('especie-durabilidade', especie.durabilidade);

        // Usos (checkboxes)
        if (especie.usos && Array.isArray(especie.usos)) {
            especie.usos.forEach(uso => {
                const checkbox = document.getElementById(`uso-${uso}`);
                if (checkbox) {
                    checkbox.checked = true;
                }
            });
        }

        // Observações
        this.setFieldValue('especie-observacoes', especie.observacoes);
        this.updateCharacterCounter();

        // Configurações comerciais
        this.setFieldValue('especie-preco', especie.precoBase);
        this.setFieldValue('especie-unidade', especie.unidadeMedida || 'm³');
        this.setFieldValue('especie-status', especie.status || 'ativo');
    }

    /**
     * Limpa formulário
     */
    clearForm() {
        const form = document.getElementById('especie-form');
        if (form) {
            form.reset();
            
            // Limpa checkboxes
            form.querySelectorAll('input[type="checkbox"]').forEach(cb => {
                cb.checked = false;
            });
            
            // Remove classes de validação
            form.querySelectorAll('.is-valid, .is-invalid').forEach(el => {
                el.classList.remove('is-valid', 'is-invalid');
            });
        }

        this.updateCharacterCounter();
    }

    /**
     * Habilita formulário
     */
    enableForm() {
        const form = document.getElementById('especie-form');
        const saveBtn = document.getElementById('btn-save-especie');
        
        if (form) {
            form.querySelectorAll('input, select, textarea').forEach(field => {
                field.disabled = false;
                field.readOnly = false;
            });
        }
        
        if (saveBtn) {
            saveBtn.style.display = 'inline-flex';
        }
    }

    /**
     * Desabilita formulário (modo visualização)
     */
    disableForm() {
        const form = document.getElementById('especie-form');
        const saveBtn = document.getElementById('btn-save-especie');
        
        if (form) {
            form.querySelectorAll('input, select, textarea').forEach(field => {
                field.disabled = true;
            });
        }
        
        if (saveBtn) {
            saveBtn.style.display = 'none';
        }
    }

    /**
     * Obtém dados do formulário
     */
    getFormData() {
        const usos = [];
        document.querySelectorAll('#especie-modal input[type="checkbox"]:checked').forEach(cb => {
            usos.push(cb.value);
        });

        return {
            especie: this.getFieldValue('especie-nome'),
            codigo: this.getFieldValue('especie-codigo'),
            nomeCientifico: this.getFieldValue('especie-cientifico'),
            familia: this.getFieldValue('especie-familia'),
            densidade: parseFloat(this.getFieldValue('especie-densidade')) || null,
            umidade: parseFloat(this.getFieldValue('especie-umidade')) || null,
            classeResistencia: this.getFieldValue('especie-classe'),
            cor: this.getFieldValue('especie-cor'),
            durabilidade: this.getFieldValue('especie-durabilidade'),
            usos: usos,
            observacoes: this.getFieldValue('especie-observacoes'),
            precoBase: parseFloat(this.getFieldValue('especie-preco')) || 0,
            unidadeMedida: this.getFieldValue('especie-unidade'),
            status: this.getFieldValue('especie-status'),
            createdAt: this.currentMode === 'create' ? new Date().toISOString() : this.currentEspecie?.createdAt,
            updatedAt: new Date().toISOString()
        };
    }

    /**
     * Valida formulário
     */
    validateForm() {
        const form = document.getElementById('especie-form');
        if (!form) return false;

        let isValid = true;
        const fields = form.querySelectorAll('input, select, textarea');
        
        fields.forEach(field => {
            const fieldValid = this.validator.validateField(field.id, field.value);
            
            if (fieldValid.isValid) {
                field.classList.remove('is-invalid');
                field.classList.add('is-valid');
            } else {
                field.classList.remove('is-valid');
                field.classList.add('is-invalid');
                
                const feedback = field.parentNode.querySelector('.invalid-feedback');
                if (feedback) {
                    feedback.textContent = fieldValid.message;
                }
                
                isValid = false;
            }
        });

        // Atualiza status info
        const statusInfo = document.getElementById('form-status-info');
        if (statusInfo) {
            if (isValid) {
                statusInfo.textContent = 'Formulário válido - pronto para salvar';
                statusInfo.className = 'text-success';
            } else {
                statusInfo.textContent = 'Corrija os erros destacados';
                statusInfo.className = 'text-danger';
            }
        }

        return isValid;
    }

    /**
     * Obtém valor de campo
     */
    getFieldValue(fieldId) {
        const field = document.getElementById(fieldId);
        return field ? field.value.trim() : '';
    }

    /**
     * Define valor de campo
     */
    setFieldValue(fieldId, value) {
        const field = document.getElementById(fieldId);
        if (field) {
            field.value = value || '';
        }
    }

    /**
     * Atualiza contador de caracteres
     */
    updateCharacterCounter() {
        const textarea = document.getElementById('especie-observacoes');
        const counter = document.getElementById('obs-counter');
        
        if (textarea && counter) {
            counter.textContent = textarea.value.length;
        }
    }

    /**
     * Injeta estilos CSS
     */
    injectStyles() {
        if (document.getElementById('especie-form-styles')) return;

        const styles = document.createElement('style');
        styles.id = 'especie-form-styles';
        styles.textContent = `
            #especie-modal .modal-dialog {
                max-width: 900px;
            }

            #especie-modal .modal-header {
                background: linear-gradient(135deg, #28a745 0%, #20c997 100%);
                color: white;
                border-radius: 0.5rem 0.5rem 0 0;
            }

            #especie-modal .modal-icon {
                font-size: 1.5rem;
                margin-right: 10px;
            }

            #especie-modal .form-section {
                background: #f8f9fa;
                border-radius: 8px;
                padding: 20px;
                margin-bottom: 20px;
            }

            #especie-modal .section-title {
                display: flex;
                align-items: center;
                margin-bottom: 15px;
                color: #2c3e50;
                font-weight: 600;
                border-bottom: 2px solid #e9ecef;
                padding-bottom: 8px;
            }

            #especie-modal .section-icon {
                margin-right: 8px;
                font-size: 1.1rem;
            }

            #especie-modal .form-group {
                margin-bottom: 15px;
            }

            #especie-modal .form-label.required::after {
                content: " *";
                color: #dc3545;
                font-weight: bold;
            }

            #especie-modal .checkbox-grid {
                display: grid;
                grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
                gap: 10px;
                margin-top: 10px;
            }

            #especie-modal .form-check {
                background: white;
                padding: 8px 12px;
                border-radius: 6px;
                border: 1px solid #e9ecef;
                transition: all 0.2s;
            }

            #especie-modal .form-check:hover {
                border-color: #28a745;
                background: #f8fff9;
            }

            #especie-modal .form-check-input:checked + .form-check-label {
                color: #28a745;
                font-weight: 600;
            }

            #especie-modal .modal-footer {
                display: flex;
                justify-content: space-between;
                align-items: center;
                padding: 15px 20px;
                background: #f8f9fa;
                border-radius: 0 0 0.5rem 0.5rem;
            }

            #especie-modal .footer-info {
                flex: 1;
            }

            #especie-modal .footer-buttons {
                display: flex;
                gap: 10px;
            }

            #especie-modal .btn-icon {
                margin-right: 5px;
            }

            #especie-modal .form-control.is-valid {
                border-color: #28a745;
                background-image: url("data:image/svg+xml,%3csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 8 8'%3e%3cpath fill='%2328a745' d='m2.3 6.73.69-.69L6.04 3l.72.72-4.48 4.48-2.48-2.48L.51 4.96z'/%3e%3c/svg%3e");
            }

            #especie-modal .form-control.is-invalid {
                border-color: #dc3545;
                background-image: url("data:image/svg+xml,%3csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' fill='none' stroke='%23dc3545' viewBox='0 0 12 12'%3e%3ccircle cx='6' cy='6' r='4.5'/%3e%3cpath d='m5.7 5.7 1.1 1.1m-.7-1.1 1.1-1.1'/%3e%3c/svg%3e");
            }

            #especie-modal .text-success {
                color: #28a745 !important;
            }

            #especie-modal .text-danger {
                color: #dc3545 !important;
            }

            @media (max-width: 768px) {
                #especie-modal .modal-dialog {
                    margin: 10px;
                    max-width: calc(100vw - 20px);
                }

                #especie-modal .checkbox-grid {
                    grid-template-columns: 1fr;
                }

                #especie-modal .modal-footer {
                    flex-direction: column;
                    align-items: stretch;
                    gap: 10px;
                }

                #especie-modal .footer-buttons {
                    justify-content: stretch;
                }

                #especie-modal .footer-buttons .btn {
                    flex: 1;
                }
            }
        `;

        document.head.appendChild(styles);
    }
}

// =============================================================================
// INICIALIZAÇÃO E EXPORTAÇÃO
// =============================================================================
let especieFormInstance = null;

function initializeEspecieForm() {
    if (!especieFormInstance) {
        especieFormInstance = new EspecieForm();
    }
    return especieFormInstance;
}

function getEspecieForm() {
    if (!especieFormInstance) {
        return initializeEspecieForm();
    }
    return especieFormInstance;
}

// Auto-inicialização
document.addEventListener('DOMContentLoaded', () => {
    initializeEspecieForm();
});

export default EspecieForm;
export { initializeEspecieForm, getEspecieForm };
