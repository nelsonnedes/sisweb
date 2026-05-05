/**
 * FORMULÁRIO DE FORNECEDOR
 * Modal para cadastro e edição de fornecedores
 * 
 * @author Sistema de Excelência Firebase
 * @version 2.0.0
 * @created 2024
 */

import stateManager from '../../services/stateManager.js';
import { Validator } from '../../utils/validators.js';
import { formatters } from '../../utils/formatters.js';
import logger from '../../utils/logger.js';

// =============================================================================
// CLASSE PRINCIPAL DO FORMULÁRIO
// =============================================================================
class FornecedorForm {
    constructor() {
        this.modal = null;
        this.currentFornecedor = null;
        this.mode = 'create';
        this.validator = new Validator();
        this.callback = null;
        
        this.initialize();
    }

    /**
     * Inicializa o formulário
     */
    initialize() {
        this.createModal();
        this.setupEventListeners();
        this.setupValidation();
        
        logger.success('Formulário de fornecedor inicializado', '👤 FORNECEDOR');
    }

    /**
     * Cria estrutura do modal
     */
    createModal() {
        const existing = document.getElementById('fornecedor-modal');
        if (existing) existing.remove();

        this.modal = document.createElement('div');
        this.modal.id = 'fornecedor-modal';
        this.modal.className = 'modal fade';
        this.modal.innerHTML = `
            <div class="modal-dialog">
                <div class="modal-content">
                    <div class="modal-header">
                        <h5 class="modal-title" id="fornecedor-modal-title">Novo Fornecedor</h5>
                        <button type="button" class="btn-close" data-bs-dismiss="modal"></button>
                    </div>
                    
                    <div class="modal-body">
                        <form id="fornecedor-form" novalidate>
                            <div class="mb-3">
                                <label class="form-label required">Nome</label>
                                <input type="text" class="form-control" id="fornecedor-nome" required>
                                <div class="invalid-feedback"></div>
                            </div>
                            
                            <div class="row">
                                <div class="col-md-6">
                                    <label class="form-label">CPF</label>
                                    <input type="text" class="form-control" id="fornecedor-cpf" 
                                           placeholder="000.000.000-00">
                                    <div class="invalid-feedback"></div>
                                </div>
                                <div class="col-md-6">
                                    <label class="form-label">CNPJ</label>
                                    <input type="text" class="form-control" id="fornecedor-cnpj" 
                                           placeholder="00.000.000/0000-00">
                                    <div class="invalid-feedback"></div>
                                </div>
                            </div>
                            
                            <div class="mb-3">
                                <small class="text-muted">Informe CPF ou CNPJ (não ambos)</small>
                            </div>
                            
                            <div class="row">
                                <div class="col-md-6">
                                    <label class="form-label">Telefone</label>
                                    <input type="text" class="form-control" id="fornecedor-telefone" 
                                           placeholder="(00) 00000-0000">
                                    <div class="invalid-feedback"></div>
                                </div>
                                <div class="col-md-6">
                                    <label class="form-label">Email</label>
                                    <input type="email" class="form-control" id="fornecedor-email" 
                                           placeholder="email@exemplo.com">
                                    <div class="invalid-feedback"></div>
                                </div>
                            </div>
                            
                            <div class="mb-3">
                                <label class="form-label">Endereço</label>
                                <textarea class="form-control" id="fornecedor-endereco" rows="2" 
                                          placeholder="Endereço completo..."></textarea>
                            </div>
                            
                            <div class="mb-3">
                                <label class="form-label">Observações</label>
                                <textarea class="form-control" id="fornecedor-observacoes" rows="2" 
                                          placeholder="Observações adicionais..."></textarea>
                            </div>
                        </form>
                    </div>
                    
                    <div class="modal-footer">
                        <button type="button" class="btn btn-secondary" data-bs-dismiss="modal">
                            Cancelar
                        </button>
                        <button type="button" class="btn btn-primary" id="btn-save-fornecedor">
                            💾 Salvar
                        </button>
                    </div>
                </div>
            </div>
        `;
        
        document.body.appendChild(this.modal);
    }

    /**
     * Configura event listeners
     */
    setupEventListeners() {
        // Formatação automática
        document.getElementById('fornecedor-cpf')?.addEventListener('input', this.formatCPF);
        document.getElementById('fornecedor-cnpj')?.addEventListener('input', this.formatCNPJ);
        document.getElementById('fornecedor-telefone')?.addEventListener('input', this.formatPhone);

        // Validação exclusiva CPF/CNPJ
        document.getElementById('fornecedor-cpf')?.addEventListener('input', () => {
            const cnpjField = document.getElementById('fornecedor-cnpj');
            if (document.getElementById('fornecedor-cpf').value) {
                cnpjField.disabled = true;
                cnpjField.value = '';
            } else {
                cnpjField.disabled = false;
            }
        });

        document.getElementById('fornecedor-cnpj')?.addEventListener('input', () => {
            const cpfField = document.getElementById('fornecedor-cpf');
            if (document.getElementById('fornecedor-cnpj').value) {
                cpfField.disabled = true;
                cpfField.value = '';
            } else {
                cpfField.disabled = false;
            }
        });

        // Salvar
        document.getElementById('btn-save-fornecedor')?.addEventListener('click', () => this.save());

        // Validação em tempo real
        const form = document.getElementById('fornecedor-form');
        form?.addEventListener('input', (e) => this.validateField(e.target));
    }

    /**
     * Configura validação
     */
    setupValidation() {
        this.validator.addRule('fornecedor-nome', 'required', 'Nome é obrigatório');
        this.validator.addRule('fornecedor-cpf', 'cpf', 'CPF inválido');
        this.validator.addRule('fornecedor-cnpj', 'cnpj', 'CNPJ inválido');
        this.validator.addRule('fornecedor-telefone', 'phone', 'Telefone inválido');
        this.validator.addRule('fornecedor-email', 'email', 'Email inválido');
    }

    // =========================================================================
    // MÉTODOS PÚBLICOS
    // =========================================================================

    /**
     * Abre modal para criar fornecedor
     */
    create(callback = null) {
        this.mode = 'create';
        this.currentFornecedor = null;
        this.callback = callback;
        
        document.getElementById('fornecedor-modal-title').textContent = 'Novo Fornecedor';
        this.clearForm();
        this.showModal();
    }

    /**
     * Abre modal para editar fornecedor
     */
    edit(fornecedor, callback = null) {
        this.mode = 'edit';
        this.currentFornecedor = { ...fornecedor };
        this.callback = callback;
        
        document.getElementById('fornecedor-modal-title').textContent = 'Editar Fornecedor';
        this.populateForm();
        this.showModal();
    }

    /**
     * Salva fornecedor
     */
    async save() {
        if (!this.validate()) return;

        const formData = this.getFormData();
        
        try {
            const savedFornecedor = await stateManager.saveFornecedor(formData);
            
            if (this.callback) {
                this.callback(savedFornecedor);
            }
            
            this.hideModal();
            logger.success(`Fornecedor ${this.mode === 'create' ? 'criado' : 'atualizado'}`, '👤 FORNECEDOR');
            
        } catch (error) {
            logger.error('Erro ao salvar fornecedor', '👤 FORNECEDOR', error);
        }
    }

    // =========================================================================
    // MÉTODOS PRIVADOS
    // =========================================================================

    /**
     * Mostra modal
     */
    showModal() {
        const bootstrap = window.bootstrap;
        if (bootstrap) {
            const modal = new bootstrap.Modal(this.modal);
            modal.show();
        } else {
            this.modal.style.display = 'block';
            this.modal.classList.add('show');
        }
    }

    /**
     * Esconde modal
     */
    hideModal() {
        const bootstrap = window.bootstrap;
        if (bootstrap) {
            const modal = bootstrap.Modal.getInstance(this.modal);
            modal?.hide();
        } else {
            this.modal.style.display = 'none';
            this.modal.classList.remove('show');
        }
    }

    /**
     * Popula formulário
     */
    populateForm() {
        if (!this.currentFornecedor) return;

        const f = this.currentFornecedor;
        document.getElementById('fornecedor-nome').value = f.nome || '';
        document.getElementById('fornecedor-cpf').value = f.cpf || '';
        document.getElementById('fornecedor-cnpj').value = f.cnpj || '';
        document.getElementById('fornecedor-telefone').value = f.telefone || '';
        document.getElementById('fornecedor-email').value = f.email || '';
        document.getElementById('fornecedor-endereco').value = f.endereco || '';
        document.getElementById('fornecedor-observacoes').value = f.observacoes || '';
    }

    /**
     * Limpa formulário
     */
    clearForm() {
        document.getElementById('fornecedor-form').reset();
        document.getElementById('fornecedor-cpf').disabled = false;
        document.getElementById('fornecedor-cnpj').disabled = false;
        this.validator.clearErrors();
    }

    /**
     * Obtém dados do formulário
     */
    getFormData() {
        const formData = {
            nome: document.getElementById('fornecedor-nome').value.trim(),
            cpf: document.getElementById('fornecedor-cpf').value.trim(),
            cnpj: document.getElementById('fornecedor-cnpj').value.trim(),
            telefone: document.getElementById('fornecedor-telefone').value.trim(),
            email: document.getElementById('fornecedor-email').value.trim(),
            endereco: document.getElementById('fornecedor-endereco').value.trim(),
            observacoes: document.getElementById('fornecedor-observacoes').value.trim()
        };

        // Define documento principal
        formData.documento = formData.cpf || formData.cnpj;

        // Adiciona ID se editando
        if (this.mode === 'edit' && this.currentFornecedor) {
            formData.id = this.currentFornecedor.id;
        }

        return formData;
    }

    /**
     * Valida formulário
     */
    validate() {
        const formData = this.getFormData();
        let isValid = true;

        // Validação de nome
        if (!formData.nome) {
            this.showFieldError('fornecedor-nome', 'Nome é obrigatório');
            isValid = false;
        }

        // Validação de CPF ou CNPJ
        if (!formData.cpf && !formData.cnpj) {
            this.showFieldError('fornecedor-cpf', 'Informe CPF ou CNPJ');
            this.showFieldError('fornecedor-cnpj', 'Informe CPF ou CNPJ');
            isValid = false;
        } else {
            if (formData.cpf && !this.validator.isValidCPF(formData.cpf)) {
                this.showFieldError('fornecedor-cpf', 'CPF inválido');
                isValid = false;
            }
            
            if (formData.cnpj && !this.validator.isValidCNPJ(formData.cnpj)) {
                this.showFieldError('fornecedor-cnpj', 'CNPJ inválido');
                isValid = false;
            }
        }

        // Validação de email
        if (formData.email && !this.validator.isValidEmail(formData.email)) {
            this.showFieldError('fornecedor-email', 'Email inválido');
            isValid = false;
        }

        // Validação de telefone
        if (formData.telefone && !this.validator.isValidPhone(formData.telefone)) {
            this.showFieldError('fornecedor-telefone', 'Telefone inválido');
            isValid = false;
        }

        return isValid;
    }

    /**
     * Valida campo individual
     */
    validateField(field) {
        const value = field.value.trim();
        this.clearFieldError(field.id);

        switch (field.id) {
            case 'fornecedor-nome':
                if (!value) {
                    this.showFieldError(field.id, 'Nome é obrigatório');
                }
                break;
                
            case 'fornecedor-cpf':
                if (value && !this.validator.isValidCPF(value)) {
                    this.showFieldError(field.id, 'CPF inválido');
                }
                break;
                
            case 'fornecedor-cnpj':
                if (value && !this.validator.isValidCNPJ(value)) {
                    this.showFieldError(field.id, 'CNPJ inválido');
                }
                break;
                
            case 'fornecedor-email':
                if (value && !this.validator.isValidEmail(value)) {
                    this.showFieldError(field.id, 'Email inválido');
                }
                break;
                
            case 'fornecedor-telefone':
                if (value && !this.validator.isValidPhone(value)) {
                    this.showFieldError(field.id, 'Telefone inválido');
                }
                break;
        }
    }

    /**
     * Mostra erro no campo
     */
    showFieldError(fieldId, message) {
        const field = document.getElementById(fieldId);
        const feedback = field?.parentNode.querySelector('.invalid-feedback');
        
        if (field && feedback) {
            field.classList.add('is-invalid');
            feedback.textContent = message;
        }
    }

    /**
     * Limpa erro do campo
     */
    clearFieldError(fieldId) {
        const field = document.getElementById(fieldId);
        const feedback = field?.parentNode.querySelector('.invalid-feedback');
        
        if (field && feedback) {
            field.classList.remove('is-invalid');
            feedback.textContent = '';
        }
    }

    // =========================================================================
    // MÉTODOS DE FORMATAÇÃO
    // =========================================================================

    /**
     * Formata CPF
     */
    formatCPF(e) {
        let value = e.target.value.replace(/\D/g, '');
        value = value.replace(/(\d{3})(\d)/, '$1.$2');
        value = value.replace(/(\d{3})(\d)/, '$1.$2');
        value = value.replace(/(\d{3})(\d{1,2})$/, '$1-$2');
        e.target.value = value;
    }

    /**
     * Formata CNPJ
     */
    formatCNPJ(e) {
        let value = e.target.value.replace(/\D/g, '');
        value = value.replace(/(\d{2})(\d)/, '$1.$2');
        value = value.replace(/(\d{3})(\d)/, '$1.$2');
        value = value.replace(/(\d{3})(\d)/, '$1/$2');
        value = value.replace(/(\d{4})(\d{1,2})$/, '$1-$2');
        e.target.value = value;
    }

    /**
     * Formata telefone
     */
    formatPhone(e) {
        let value = e.target.value.replace(/\D/g, '');
        value = value.replace(/(\d{2})(\d)/, '($1) $2');
        value = value.replace(/(\d{5})(\d)/, '$1-$2');
        e.target.value = value;
    }
}

// =============================================================================
// INSTÂNCIA GLOBAL
// =============================================================================
const fornecedorForm = new FornecedorForm();

// Disponibiliza globalmente
window.fornecedorForm = fornecedorForm;

// =============================================================================
// EXPORTAÇÕES
// =============================================================================
export default fornecedorForm;

export const {
    create,
    edit,
    save
} = fornecedorForm; 