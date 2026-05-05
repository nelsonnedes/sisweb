/**
 * FORMULÁRIO MODAL DE ROMANEIO
 * Interface completa para criação/edição de romaneios
 * 
 * @author Sistema de Excelência Firebase
 * @version 2.0.0
 * @created 2024
 */

import stateManager, { EVENT_TYPES } from '../../services/stateManager.js';
import { Validator } from '../../utils/validators.js';
import { formatters } from '../../utils/formatters.js';
import { Calculator } from '../../utils/calculations.js';
import { UI_CONFIG, VOLUME_CONSTANTS } from '../../constants/app-constants.js';
import logger from '../../utils/logger.js';

// =============================================================================
// CLASSE PRINCIPAL DO FORMULÁRIO
// =============================================================================
class RomaneioForm {
    constructor() {
        this.modal = null;
        this.currentRomaneio = null;
        this.mode = 'create'; // 'create', 'edit', 'view'
        this.validator = new Validator();
        this.calculator = new Calculator();
        this.isDirty = false;
        this.autoSaveTimer = null;
        
        this.initialize();
    }

    /**
     * Inicializa o formulário
     */
    initialize() {
        this.createModal();
        this.setupEventListeners();
        this.setupValidation();
        
        logger.success('Formulário de romaneio inicializado', '📝 FORM');
    }

    /**
     * Cria estrutura do modal
     */
    createModal() {
        // Remove modal existente
        const existing = document.getElementById('romaneio-modal');
        if (existing) existing.remove();

        // Cria novo modal
        this.modal = document.createElement('div');
        this.modal.id = 'romaneio-modal';
        this.modal.className = 'modal fade';
        this.modal.innerHTML = this.getModalHTML();
        
        document.body.appendChild(this.modal);
        this.injectStyles();
    }

    /**
     * Retorna HTML do modal
     */
    getModalHTML() {
        return `
            <div class="modal-dialog modal-xl">
                <div class="modal-content">
                    <!-- Cabeçalho -->
                    <div class="modal-header">
                        <h5 class="modal-title" id="modal-title">Novo Romaneio</h5>
                        <div class="modal-actions">
                            <button type="button" class="btn btn-sm btn-outline-secondary" id="btn-minimize">
                                <span class="minimize-icon">−</span>
                            </button>
                            <button type="button" class="btn-close" data-bs-dismiss="modal"></button>
                        </div>
                    </div>

                    <!-- Corpo do modal -->
                    <div class="modal-body">
                        <form id="romaneio-form" novalidate>
                            <!-- Dados Básicos -->
                            <div class="form-section">
                                <h6 class="section-title">
                                    <span class="section-icon">📄</span>
                                    Dados Básicos
                                </h6>
                                
                                <div class="row">
                                    <div class="col-md-3">
                                        <label class="form-label required">Número do Romaneio</label>
                                        <input type="text" class="form-control" id="numeroRomaneio" required>
                                        <div class="invalid-feedback"></div>
                                    </div>
                                    
                                    <div class="col-md-3">
                                        <label class="form-label required">Data de Emissão</label>
                                        <input type="date" class="form-control" id="dataEmissao" required>
                                        <div class="invalid-feedback"></div>
                                    </div>
                                    
                                    <div class="col-md-6">
                                        <label class="form-label">Observações</label>
                                        <input type="text" class="form-control" id="observacoes" 
                                               placeholder="Observações adicionais...">
                                    </div>
                                </div>
                            </div>

                            <!-- Fornecedor -->
                            <div class="form-section">
                                <h6 class="section-title">
                                    <span class="section-icon">👤</span>
                                    Fornecedor
                                    <button type="button" class="btn btn-sm btn-outline-primary ms-2" id="btn-new-fornecedor">
                                        + Novo
                                    </button>
                                </h6>
                                
                                <div class="row">
                                    <div class="col-md-6">
                                        <label class="form-label required">Nome do Fornecedor</label>
                                        <div class="autocomplete-container">
                                            <input type="text" class="form-control" id="fornecedorNome" 
                                                   placeholder="Digite para buscar..." required>
                                            <div class="autocomplete-dropdown" id="fornecedor-dropdown"></div>
                                        </div>
                                        <div class="invalid-feedback"></div>
                                    </div>
                                    
                                    <div class="col-md-3">
                                        <label class="form-label">CPF/CNPJ</label>
                                        <input type="text" class="form-control" id="fornecedorDocumento" readonly>
                                    </div>
                                    
                                    <div class="col-md-3">
                                        <label class="form-label">Telefone</label>
                                        <input type="text" class="form-control" id="fornecedorTelefone" readonly>
                                    </div>
                                </div>
                            </div>

                            <!-- Itens do Romaneio -->
                            <div class="form-section">
                                <h6 class="section-title">
                                    <span class="section-icon">📦</span>
                                    Itens do Romaneio
                                    <button type="button" class="btn btn-sm btn-success ms-2" id="btn-add-item">
                                        + Adicionar Item
                                    </button>
                                </h6>
                                
                                <div class="items-container">
                                    <div class="table-responsive">
                                        <table class="table table-sm items-table">
                                            <thead>
                                                <tr>
                                                    <th>Espécie</th>
                                                    <th>Comprimento (m)</th>
                                                    <th>Largura (cm)</th>
                                                    <th>Altura (cm)</th>
                                                    <th>Peças</th>
                                                    <th>Volume (m³)</th>
                                                    <th>Preço/m³</th>
                                                    <th>Valor Total</th>
                                                    <th>Ações</th>
                                                </tr>
                                            </thead>
                                            <tbody id="items-tbody">
                                                <!-- Itens serão inseridos dinamicamente -->
                                            </tbody>
                                            <tfoot>
                                                <tr class="table-info">
                                                    <th colspan="5" class="text-end">TOTAIS:</th>
                                                    <th id="total-volume">0.000 m³</th>
                                                    <th>-</th>
                                                    <th id="total-valor">R$ 0,00</th>
                                                    <th></th>
                                                </tr>
                                            </tfoot>
                                        </table>
                                    </div>
                                    
                                    <div class="items-summary">
                                        <div class="row">
                                            <div class="col-md-3">
                                                <div class="summary-card">
                                                    <div class="summary-label">Total de Peças</div>
                                                    <div class="summary-value" id="summary-pecas">0</div>
                                                </div>
                                            </div>
                                            <div class="col-md-3">
                                                <div class="summary-card">
                                                    <div class="summary-label">Volume Total</div>
                                                    <div class="summary-value" id="summary-volume">0.000 m³</div>
                                                </div>
                                            </div>
                                            <div class="col-md-3">
                                                <div class="summary-card">
                                                    <div class="summary-label">Valor Total</div>
                                                    <div class="summary-value" id="summary-valor">R$ 0,00</div>
                                                </div>
                                            </div>
                                            <div class="col-md-3">
                                                <div class="summary-card">
                                                    <div class="summary-label">Preço Médio</div>
                                                    <div class="summary-value" id="summary-preco-medio">R$ 0,00/m³</div>
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </form>
                    </div>

                    <!-- Rodapé -->
                    <div class="modal-footer">
                        <div class="footer-info">
                            <small class="text-muted">
                                <span id="last-saved">Não salvo</span> • 
                                <span id="validation-status">Validando...</span>
                            </small>
                        </div>
                        
                        <div class="footer-actions">
                            <button type="button" class="btn btn-outline-secondary" data-bs-dismiss="modal">
                                Cancelar
                            </button>
                            <button type="button" class="btn btn-outline-info" id="btn-preview">
                                👁️ Visualizar
                            </button>
                            <button type="button" class="btn btn-success" id="btn-save">
                                💾 Salvar
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        `;
    }

    /**
     * Configura event listeners
     */
    setupEventListeners() {
        // Eventos do formulário
        const form = document.getElementById('romaneio-form');
        form?.addEventListener('input', (e) => this.handleInputChange(e));
        form?.addEventListener('change', (e) => this.handleInputChange(e));

        // Botões de ação
        document.getElementById('btn-add-item')?.addEventListener('click', () => this.addItem());
        document.getElementById('btn-new-fornecedor')?.addEventListener('click', () => this.openFornecedorForm());
        document.getElementById('btn-save')?.addEventListener('click', () => this.saveRomaneio());
        document.getElementById('btn-preview')?.addEventListener('click', () => this.previewRomaneio());

        // Auto-complete do fornecedor
        const fornecedorInput = document.getElementById('fornecedorNome');
        fornecedorInput?.addEventListener('input', (e) => this.handleFornecedorSearch(e));
        fornecedorInput?.addEventListener('focus', () => this.showFornecedorDropdown());
        fornecedorInput?.addEventListener('blur', () => this.hideFornecedorDropdown());

        // Eventos do modal
        this.modal.addEventListener('show.bs.modal', () => this.onModalShow());
        this.modal.addEventListener('hide.bs.modal', () => this.onModalHide());
        this.modal.addEventListener('hidden.bs.modal', () => this.onModalHidden());

        // Atalhos de teclado
        document.addEventListener('keydown', (e) => this.handleKeyboardShortcuts(e));
    }

    /**
     * Configura validação em tempo real
     */
    setupValidation() {
        this.validator.addRule('numeroRomaneio', 'required', 'Número do romaneio é obrigatório');
        this.validator.addRule('dataEmissao', 'required', 'Data de emissão é obrigatória');
        this.validator.addRule('fornecedorNome', 'required', 'Fornecedor é obrigatório');
    }

    // =========================================================================
    // MÉTODOS PÚBLICOS
    // =========================================================================

    /**
     * Abre modal para criar novo romaneio
     */
    create() {
        this.mode = 'create';
        this.currentRomaneio = this.getEmptyRomaneio();
        this.populateForm();
        this.showModal();
        
        logger.ui('romaneio_form_opened', 'create');
    }

    /**
     * Abre modal para editar romaneio
     */
    edit(romaneio) {
        this.mode = 'edit';
        this.currentRomaneio = { ...romaneio };
        this.populateForm();
        this.showModal();
        
        logger.ui('romaneio_form_opened', 'edit');
    }

    /**
     * Abre modal para visualizar romaneio
     */
    view(romaneio) {
        this.mode = 'view';
        this.currentRomaneio = { ...romaneio };
        this.populateForm();
        this.setReadOnly(true);
        this.showModal();
        
        logger.ui('romaneio_form_opened', 'view');
    }

    // =========================================================================
    // MÉTODOS DE CONTROLE DO MODAL
    // =========================================================================

    /**
     * Mostra o modal
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
     * Esconde o modal
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
     * Evento ao mostrar modal
     */
    onModalShow() {
        document.body.classList.add('modal-open');
        this.updateModalTitle();
        this.focusFirstInput();
        this.startAutoSave();
    }

    /**
     * Evento ao esconder modal
     */
    onModalHide() {
        if (this.isDirty && !this.confirmDiscard()) {
            return false;
        }
        this.stopAutoSave();
    }

    /**
     * Evento após esconder modal
     */
    onModalHidden() {
        document.body.classList.remove('modal-open');
        this.reset();
    }

    // =========================================================================
    // MÉTODOS DE FORMULÁRIO
    // =========================================================================

    /**
     * Popula formulário com dados
     */
    populateForm() {
        const romaneio = this.currentRomaneio;
        
        // Dados básicos
        document.getElementById('numeroRomaneio').value = romaneio.numeroRomaneio || '';
        document.getElementById('dataEmissao').value = romaneio.dataEmissao || new Date().toISOString().split('T')[0];
        document.getElementById('observacoes').value = romaneio.observacoes || '';

        // Fornecedor
        if (romaneio.fornecedor) {
            document.getElementById('fornecedorNome').value = romaneio.fornecedor.nome || '';
            document.getElementById('fornecedorDocumento').value = romaneio.fornecedor.documento || '';
            document.getElementById('fornecedorTelefone').value = romaneio.fornecedor.telefone || '';
        }

        // Itens
        this.populateItems();
        this.calculateTotals();
    }

    /**
     * Popula tabela de itens
     */
    populateItems() {
        const tbody = document.getElementById('items-tbody');
        tbody.innerHTML = '';

        if (this.currentRomaneio.itens && this.currentRomaneio.itens.length > 0) {
            this.currentRomaneio.itens.forEach((item, index) => {
                this.addItemRow(item, index);
            });
        } else {
            this.addItem(); // Adiciona item vazio
        }
    }

    /**
     * Adiciona novo item
     */
    addItem(itemData = null) {
        const item = itemData || {
            especie: '',
            comprimento: '',
            largura: '',
            altura: '',
            pecas: 1,
            volume: 0,
            precoUnitario: '',
            valorTotal: 0
        };

        const index = this.currentRomaneio.itens ? this.currentRomaneio.itens.length : 0;
        this.addItemRow(item, index);
        
        if (!this.currentRomaneio.itens) {
            this.currentRomaneio.itens = [];
        }
        this.currentRomaneio.itens.push(item);
        
        this.markAsDirty();
    }

    /**
     * Adiciona linha de item na tabela
     */
    addItemRow(item, index) {
        const tbody = document.getElementById('items-tbody');
        const row = document.createElement('tr');
        row.dataset.index = index;
        
        row.innerHTML = `
            <td>
                <div class="autocomplete-container">
                    <input type="text" class="form-control form-control-sm item-especie" 
                           placeholder="Selecione espécie..." value="${item.especie || ''}" data-field="especie">
                    <div class="autocomplete-dropdown especies-dropdown"></div>
                </div>
            </td>
            <td>
                <input type="number" class="form-control form-control-sm item-comprimento" 
                       placeholder="0.00" value="${item.comprimento || ''}" data-field="comprimento" step="0.01" min="0">
            </td>
            <td>
                <input type="number" class="form-control form-control-sm item-largura" 
                       placeholder="0" value="${item.largura || ''}" data-field="largura" step="1" min="0">
            </td>
            <td>
                <input type="number" class="form-control form-control-sm item-altura" 
                       placeholder="0" value="${item.altura || ''}" data-field="altura" step="1" min="0">
            </td>
            <td>
                <input type="number" class="form-control form-control-sm item-pecas" 
                       placeholder="1" value="${item.pecas || 1}" data-field="pecas" step="1" min="1">
            </td>
            <td>
                <span class="item-volume text-success fw-bold">${formatters.volume(item.volume || 0)}</span>
            </td>
            <td>
                <input type="text" class="form-control form-control-sm item-preco" 
                       placeholder="R$ 0,00" value="${formatters.currency(item.precoUnitario || 0)}" data-field="precoUnitario">
            </td>
            <td>
                <span class="item-valor text-primary fw-bold">${formatters.currency(item.valorTotal || 0)}</span>
            </td>
            <td>
                <div class="btn-group btn-group-sm">
                    <button type="button" class="btn btn-outline-danger btn-remove-item" title="Remover">
                        🗑️
                    </button>
                    <button type="button" class="btn btn-outline-info btn-duplicate-item" title="Duplicar">
                        📋
                    </button>
                </div>
            </td>
        `;

        // Adiciona event listeners para os inputs
        const inputs = row.querySelectorAll('input');
        inputs.forEach(input => {
            input.addEventListener('input', (e) => this.handleItemChange(e, index));
            input.addEventListener('blur', (e) => this.handleItemBlur(e, index));
        });

        // Event listeners para botões
        row.querySelector('.btn-remove-item')?.addEventListener('click', () => this.removeItem(index));
        row.querySelector('.btn-duplicate-item')?.addEventListener('click', () => this.duplicateItem(index));

        // Auto-complete para espécies
        const especieInput = row.querySelector('.item-especie');
        especieInput?.addEventListener('input', (e) => this.handleEspecieSearch(e, index));

        tbody.appendChild(row);
    }

    // =========================================================================
    // MÉTODOS DE CÁLCULO
    // =========================================================================

    /**
     * Calcula totais do romaneio
     */
    calculateTotals() {
        let totalPecas = 0;
        let totalVolume = 0;
        let totalValor = 0;

        if (this.currentRomaneio.itens) {
            this.currentRomaneio.itens.forEach(item => {
                totalPecas += parseInt(item.pecas || 0);
                totalVolume += parseFloat(item.volume || 0);
                totalValor += parseFloat(item.valorTotal || 0);
            });
        }

        // Atualiza interface
        document.getElementById('total-volume').textContent = formatters.volume(totalVolume);
        document.getElementById('total-valor').textContent = formatters.currency(totalValor);
        document.getElementById('summary-pecas').textContent = totalPecas.toString();
        document.getElementById('summary-volume').textContent = formatters.volume(totalVolume);
        document.getElementById('summary-valor').textContent = formatters.currency(totalValor);
        
        const precoMedio = totalVolume > 0 ? totalValor / totalVolume : 0;
        document.getElementById('summary-preco-medio').textContent = formatters.currency(precoMedio) + '/m³';

        // Atualiza dados do romaneio
        this.currentRomaneio.totalPecas = totalPecas;
        this.currentRomaneio.totalVolume = totalVolume;
        this.currentRomaneio.totalValor = totalValor;
        this.currentRomaneio.precoMedio = precoMedio;
    }

    /**
     * Calcula volume de um item
     */
    calculateItemVolume(item) {
        const comprimento = parseFloat(item.comprimento || 0);
        const largura = parseFloat(item.largura || 0);
        const altura = parseFloat(item.altura || 0);
        const pecas = parseInt(item.pecas || 0);

        if (comprimento > 0 && largura > 0 && altura > 0 && pecas > 0) {
            // Converte cm para metros e calcula volume
            const volume = this.calculator.calculateBasicVolume(
                comprimento,
                largura / 100, // cm para m
                altura / 100,  // cm para m
                pecas
            );
            return volume;
        }

        return 0;
    }

    // =========================================================================
    // MÉTODOS DE EVENTO
    // =========================================================================

    /**
     * Manipula mudanças nos inputs
     */
    handleInputChange(e) {
        this.markAsDirty();
        this.validateField(e.target);
    }

    /**
     * Manipula mudanças nos itens
     */
    handleItemChange(e, index) {
        const field = e.target.dataset.field;
        const value = e.target.value;

        if (!this.currentRomaneio.itens[index]) return;

        // Atualiza valor do item
        if (field === 'precoUnitario') {
            // Remove formatação de moeda
            const numericValue = parseFloat(value.replace(/[^\d,]/g, '').replace(',', '.')) || 0;
            this.currentRomaneio.itens[index][field] = numericValue;
        } else {
            this.currentRomaneio.itens[index][field] = value;
        }

        // Recalcula volume se necessário
        if (['comprimento', 'largura', 'altura', 'pecas'].includes(field)) {
            const volume = this.calculateItemVolume(this.currentRomaneio.itens[index]);
            this.currentRomaneio.itens[index].volume = volume;
            
            // Atualiza exibição do volume
            const row = document.querySelector(`tr[data-index="${index}"]`);
            const volumeDisplay = row?.querySelector('.item-volume');
            if (volumeDisplay) {
                volumeDisplay.textContent = formatters.volume(volume);
            }
        }

        // Recalcula valor total do item
        if (['volume', 'precoUnitario'].includes(field) || ['comprimento', 'largura', 'altura', 'pecas'].includes(field)) {
            const volume = this.currentRomaneio.itens[index].volume || 0;
            const preco = this.currentRomaneio.itens[index].precoUnitario || 0;
            const valorTotal = volume * preco;
            
            this.currentRomaneio.itens[index].valorTotal = valorTotal;
            
            // Atualiza exibição do valor
            const row = document.querySelector(`tr[data-index="${index}"]`);
            const valorDisplay = row?.querySelector('.item-valor');
            if (valorDisplay) {
                valorDisplay.textContent = formatters.currency(valorTotal);
            }
        }

        this.calculateTotals();
        this.markAsDirty();
    }

    /**
     * Manipula blur nos itens (formatação)
     */
    handleItemBlur(e, index) {
        const field = e.target.dataset.field;
        
        if (field === 'precoUnitario') {
            // Reformata campo de preço
            const value = this.currentRomaneio.itens[index][field] || 0;
            e.target.value = formatters.currency(value);
        }
    }

    // =========================================================================
    // MÉTODOS DE UTILIDADE
    // =========================================================================

    /**
     * Retorna romaneio vazio
     */
    getEmptyRomaneio() {
        return {
            numeroRomaneio: '',
            dataEmissao: new Date().toISOString().split('T')[0],
            observacoes: '',
            fornecedor: {
                nome: '',
                documento: '',
                telefone: ''
            },
            itens: [],
            totalPecas: 0,
            totalVolume: 0,
            totalValor: 0,
            precoMedio: 0
        };
    }

    /**
     * Marca formulário como modificado
     */
    markAsDirty() {
        this.isDirty = true;
        this.updateSaveStatus('Modificado');
    }

    /**
     * Atualiza status de salvamento
     */
    updateSaveStatus(status) {
        const lastSaved = document.getElementById('last-saved');
        if (lastSaved) {
            lastSaved.textContent = status;
        }
    }

    /**
     * Injeta estilos CSS
     */
    injectStyles() {
        if (document.getElementById('romaneio-form-styles')) return;

        const styles = document.createElement('style');
        styles.id = 'romaneio-form-styles';
        styles.textContent = `
            .modal-xl {
                max-width: 95%;
                margin: 20px auto;
            }

            .form-section {
                margin-bottom: 30px;
                padding: 20px;
                border: 1px solid #e9ecef;
                border-radius: 8px;
                background: #f8f9fa;
            }

            .section-title {
                display: flex;
                align-items: center;
                margin-bottom: 15px;
                font-weight: 600;
                color: #2c3e50;
                border-bottom: 2px solid #007bff;
                padding-bottom: 8px;
            }

            .section-icon {
                margin-right: 8px;
                font-size: 1.2rem;
            }

            .autocomplete-container {
                position: relative;
            }

            .autocomplete-dropdown {
                position: absolute;
                top: 100%;
                left: 0;
                right: 0;
                background: white;
                border: 1px solid #ddd;
                border-top: none;
                border-radius: 0 0 4px 4px;
                max-height: 200px;
                overflow-y: auto;
                z-index: 1000;
                display: none;
            }

            .autocomplete-item {
                padding: 8px 12px;
                cursor: pointer;
                border-bottom: 1px solid #f0f0f0;
            }

            .autocomplete-item:hover {
                background: #f8f9fa;
            }

            .autocomplete-item.active {
                background: #007bff;
                color: white;
            }

            .items-table th {
                background: #343a40;
                color: white;
                font-size: 0.85rem;
                padding: 8px 4px;
            }

            .items-table td {
                padding: 4px;
                vertical-align: middle;
            }

            .items-table input {
                border: 1px solid #ddd;
                text-align: center;
            }

            .items-summary {
                margin-top: 20px;
            }

            .summary-card {
                text-align: center;
                padding: 15px;
                background: white;
                border-radius: 8px;
                border-left: 4px solid #007bff;
                box-shadow: 0 2px 4px rgba(0,0,0,0.1);
            }

            .summary-label {
                font-size: 0.85rem;
                color: #6c757d;
                margin-bottom: 5px;
            }

            .summary-value {
                font-size: 1.25rem;
                font-weight: 600;
                color: #2c3e50;
            }

            .modal-footer {
                justify-content: space-between;
                padding: 15px 20px;
            }

            .footer-info {
                display: flex;
                align-items: center;
            }

            .footer-actions {
                display: flex;
                gap: 10px;
            }

            .form-label.required::after {
                content: " *";
                color: #dc3545;
            }

            .btn-group-sm .btn {
                padding: 2px 6px;
                font-size: 0.8rem;
            }

            @media (max-width: 768px) {
                .modal-xl {
                    max-width: 98%;
                    margin: 10px auto;
                }

                .items-table {
                    font-size: 0.8rem;
                }

                .items-table th,
                .items-table td {
                    padding: 2px;
                }

                .form-section {
                    padding: 15px;
                }

                .summary-card {
                    margin-bottom: 10px;
                }
            }
        `;

        document.head.appendChild(styles);
    }
}

// =============================================================================
// INSTÂNCIA GLOBAL
// =============================================================================
const romaneioForm = new RomaneioForm();

// Disponibiliza globalmente
window.romaneioForm = romaneioForm;

// =============================================================================
// EXPORTAÇÕES
// =============================================================================
export default romaneioForm;

export const {
    create,
    edit,
    view,
    showModal,
    hideModal
} = romaneioForm; 