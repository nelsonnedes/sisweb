/**
 * TABELA REATIVA DE ROMANEIOS
 * Componente de tabela com atualizações em tempo real
 * 
 * @author Sistema de Excelência Firebase
 * @version 2.0.0
 * @created 2024
 */

import stateManager, { EVENT_TYPES } from '../../services/stateManager.js';
import { RESPONSIVE_CONFIG, UI_CONFIG } from '../../constants/app-constants.js';
import { formatCurrency, formatDate, formatDocumento, truncateText } from '../../utils/formatters.js';
import logger from '../../utils/logger.js';

// =============================================================================
// CLASSE PRINCIPAL DA TABELA
// =============================================================================
class RomaneioTable {
    constructor(containerId) {
        this.containerId = containerId;
        this.container = null;
        this.currentPage = 1;
        this.itemsPerPage = UI_CONFIG.PAGINATION.ITEMS_PER_PAGE;
        this.sortField = 'createdAt';
        this.sortDirection = 'desc';
        this.searchTerm = '';
        this.selectedRows = new Set();
        this.isInitialized = false;
        
        this.initialize();
    }

    /**
     * Inicializa a tabela
     */
    initialize() {
        this.container = document.getElementById(this.containerId);
        if (!this.container) {
            logger.error(`Container ${this.containerId} não encontrado`, '📊 TABLE');
            return;
        }

        this.setupStateListeners();
        this.render();
        this.setupEventListeners();
        
        this.isInitialized = true;
        logger.success('Tabela de romaneios inicializada', '📊 TABLE');
    }

    /**
     * Configura listeners do StateManager
     */
    setupStateListeners() {
        // Atualiza quando romaneios mudarem
        stateManager.on(EVENT_TYPES.ROMANEIOS_UPDATED, () => {
            this.updateTable();
        });

        // Atualiza quando dados forem sincronizados
        stateManager.on(EVENT_TYPES.DATA_SYNCED, (data) => {
            if (data.collection === 'romaneios') {
                this.updateTable();
            }
        });

        // Responde a mudanças de estado de carregamento
        stateManager.on(EVENT_TYPES.LOADING_CHANGED, (data) => {
            if (data.type === 'romaneios') {
                this.toggleLoading(data.isLoading);
            }
        });
    }

    /**
     * Renderiza a estrutura inicial da tabela
     */
    render() {
        this.container.innerHTML = `
            <div class="romaneio-table-container">
                <!-- Cabeçalho da tabela -->
                <div class="table-header">
                    <div class="table-title">
                        <h3>Romaneios</h3>
                        <span class="table-count" id="table-count">0 itens</span>
                    </div>
                    
                    <div class="table-controls">
                        <!-- Busca -->
                        <div class="search-box">
                            <input 
                                type="text" 
                                id="table-search" 
                                placeholder="Buscar romaneios..."
                                class="form-control"
                            >
                            <button type="button" class="btn-search" id="btn-clear-search">
                                <span class="clear-icon">×</span>
                            </button>
                        </div>

                        <!-- Ações em lote -->
                        <div class="bulk-actions" id="bulk-actions" style="display: none;">
                            <span class="selected-count" id="selected-count">0 selecionados</span>
                            <button type="button" class="btn btn-danger btn-sm" id="btn-delete-selected">
                                Excluir Selecionados
                            </button>
                            <button type="button" class="btn btn-secondary btn-sm" id="btn-clear-selection">
                                Limpar Seleção
                            </button>
                        </div>

                        <!-- Novo romaneio -->
                        <button type="button" class="btn btn-primary" id="btn-new-romaneio">
                            <span class="btn-icon">+</span>
                            Novo Romaneio
                        </button>
                    </div>
                </div>

                <!-- Loading overlay -->
                <div class="table-loading" id="table-loading" style="display: none;">
                    <div class="loading-spinner"></div>
                    <span>Carregando romaneios...</span>
                </div>

                <!-- Tabela responsiva -->
                <div class="table-responsive">
                    <table class="table table-striped" id="romaneios-table">
                        <thead>
                            <tr>
                                <th>
                                    <input type="checkbox" id="select-all" class="form-check-input">
                                </th>
                                <th class="sortable" data-field="numeroRomaneio">
                                    Número <span class="sort-indicator"></span>
                                </th>
                                <th class="sortable" data-field="fornecedor.nome">
                                    Fornecedor <span class="sort-indicator"></span>
                                </th>
                                <th class="sortable" data-field="totalVolume">
                                    Volume Total <span class="sort-indicator"></span>
                                </th>
                                <th class="sortable" data-field="totalValor">
                                    Valor Total <span class="sort-indicator"></span>
                                </th>
                                <th class="sortable" data-field="createdAt">
                                    Data <span class="sort-indicator"></span>
                                </th>
                                <th class="no-sort">Ações</th>
                            </tr>
                        </thead>
                        <tbody id="table-body">
                            <!-- Conteúdo será inserido dinamicamente -->
                        </tbody>
                    </table>
                </div>

                <!-- Paginação -->
                <div class="table-pagination">
                    <div class="pagination-info">
                        <span id="pagination-info">Mostrando 0 de 0 itens</span>
                    </div>
                    
                    <div class="pagination-controls">
                        <button type="button" class="btn btn-outline-secondary btn-sm" id="btn-first-page">
                            ««
                        </button>
                        <button type="button" class="btn btn-outline-secondary btn-sm" id="btn-prev-page">
                            «
                        </button>
                        
                        <div class="page-numbers" id="page-numbers">
                            <!-- Números das páginas serão inseridos dinamicamente -->
                        </div>
                        
                        <button type="button" class="btn btn-outline-secondary btn-sm" id="btn-next-page">
                            »
                        </button>
                        <button type="button" class="btn btn-outline-secondary btn-sm" id="btn-last-page">
                            »»
                        </button>
                    </div>

                    <div class="pagination-size">
                        <select id="items-per-page" class="form-select form-select-sm">
                            <option value="10">10 por página</option>
                            <option value="25" selected>25 por página</option>
                            <option value="50">50 por página</option>
                            <option value="100">100 por página</option>
                        </select>
                    </div>
                </div>
            </div>
        `;

        // Injeta estilos CSS
        this.injectStyles();
    }

    /**
     * Configura event listeners
     */
    setupEventListeners() {
        // Busca
        const searchInput = document.getElementById('table-search');
        const clearSearchBtn = document.getElementById('btn-clear-search');
        
        let searchTimeout;
        searchInput?.addEventListener('input', (e) => {
            clearTimeout(searchTimeout);
            searchTimeout = setTimeout(() => {
                this.searchTerm = e.target.value;
                this.currentPage = 1;
                this.updateTable();
            }, 300);
        });

        clearSearchBtn?.addEventListener('click', () => {
            searchInput.value = '';
            this.searchTerm = '';
            this.currentPage = 1;
            this.updateTable();
        });

        // Seleção de todos
        const selectAllCheckbox = document.getElementById('select-all');
        selectAllCheckbox?.addEventListener('change', (e) => {
            this.toggleAllSelection(e.target.checked);
        });

        // Ordenação
        const sortableHeaders = document.querySelectorAll('.sortable');
        sortableHeaders.forEach(header => {
            header.addEventListener('click', () => {
                const field = header.dataset.field;
                this.handleSort(field);
            });
        });

        // Paginação
        document.getElementById('btn-first-page')?.addEventListener('click', () => this.goToPage(1));
        document.getElementById('btn-prev-page')?.addEventListener('click', () => this.goToPage(this.currentPage - 1));
        document.getElementById('btn-next-page')?.addEventListener('click', () => this.goToPage(this.currentPage + 1));
        document.getElementById('btn-last-page')?.addEventListener('click', () => this.goToLastPage());

        // Itens por página
        const itemsPerPageSelect = document.getElementById('items-per-page');
        itemsPerPageSelect?.addEventListener('change', (e) => {
            this.itemsPerPage = parseInt(e.target.value);
            this.currentPage = 1;
            this.updateTable();
        });

        // Ações em lote
        document.getElementById('btn-delete-selected')?.addEventListener('click', () => this.deleteSelected());
        document.getElementById('btn-clear-selection')?.addEventListener('click', () => this.clearSelection());

        // Novo romaneio
        document.getElementById('btn-new-romaneio')?.addEventListener('click', () => this.createNewRomaneio());
    }

    // =========================================================================
    // MÉTODOS DE ATUALIZAÇÃO
    // =========================================================================

    /**
     * Atualiza a tabela com dados atuais
     */
    updateTable() {
        if (!this.isInitialized) return;

        const romaneios = stateManager.getRomaneios();
        const filteredRomaneios = this.filterAndSortRomaneios(romaneios);
        const paginatedData = this.paginateData(filteredRomaneios);

        this.renderTableBody(paginatedData.items);
        this.updatePagination(paginatedData.totalItems, paginatedData.totalPages);
        this.updateTableCount(filteredRomaneios.length);
        this.updateSortIndicators();

        logger.debug(`Tabela atualizada: ${filteredRomaneios.length} romaneios`, '📊 TABLE');
    }

    /**
     * Filtra e ordena romaneios
     */
    filterAndSortRomaneios(romaneios) {
        let filtered = [...romaneios];

        // Filtro de busca
        if (this.searchTerm) {
            const searchLower = this.searchTerm.toLowerCase();
            filtered = filtered.filter(romaneio => {
                return (
                    romaneio.numeroRomaneio?.toString().includes(searchLower) ||
                    romaneio.fornecedor?.nome?.toLowerCase().includes(searchLower) ||
                    romaneio.fornecedor?.documento?.includes(searchLower) ||
                    romaneio.observacoes?.toLowerCase().includes(searchLower)
                );
            });
        }

        // Ordenação
        filtered.sort((a, b) => {
            const aValue = this.getNestedValue(a, this.sortField);
            const bValue = this.getNestedValue(b, this.sortField);

            let comparison = 0;
            if (aValue < bValue) comparison = -1;
            if (aValue > bValue) comparison = 1;

            return this.sortDirection === 'desc' ? -comparison : comparison;
        });

        return filtered;
    }

    /**
     * Obtém valor aninhado de um objeto
     */
    getNestedValue(obj, path) {
        return path.split('.').reduce((current, key) => current?.[key], obj) || '';
    }

    /**
     * Pagina os dados
     */
    paginateData(data) {
        const totalItems = data.length;
        const totalPages = Math.ceil(totalItems / this.itemsPerPage);
        const startIndex = (this.currentPage - 1) * this.itemsPerPage;
        const endIndex = startIndex + this.itemsPerPage;
        const items = data.slice(startIndex, endIndex);

        return { items, totalItems, totalPages };
    }

    /**
     * Renderiza o corpo da tabela
     */
    renderTableBody(romaneios) {
        const tbody = document.getElementById('table-body');
        if (!tbody) return;

        if (romaneios.length === 0) {
            tbody.innerHTML = `
                <tr>
                    <td colspan="7" class="text-center py-4">
                        <div class="empty-state">
                            <div class="empty-icon">📋</div>
                            <div class="empty-message">
                                ${this.searchTerm ? 'Nenhum romaneio encontrado para sua busca' : 'Nenhum romaneio cadastrado'}
                            </div>
                            ${!this.searchTerm ? `
                                <button type="button" class="btn btn-primary mt-2" onclick="romaneioTable.createNewRomaneio()">
                                    Criar Primeiro Romaneio
                                </button>
                            ` : ''}
                        </div>
                    </td>
                </tr>
            `;
            return;
        }

        tbody.innerHTML = romaneios.map(romaneio => `
            <tr data-romaneio-id="${romaneio.id}" ${this.selectedRows.has(romaneio.id) ? 'class="selected"' : ''}>
                <td>
                    <input 
                        type="checkbox" 
                        class="row-checkbox form-check-input" 
                        data-romaneio-id="${romaneio.id}"
                        ${this.selectedRows.has(romaneio.id) ? 'checked' : ''}
                    >
                </td>
                <td class="romaneio-number">
                    <strong>${romaneio.numeroRomaneio || 'N/A'}</strong>
                </td>
                <td class="fornecedor-info">
                    <div class="fornecedor-name">${truncateText(romaneio.fornecedor?.nome || 'N/A', 30)}</div>
                    <small class="text-muted">${formatDocumento(romaneio.fornecedor?.documento || '')}</small>
                </td>
                <td class="volume-info">
                    <span class="volume-value">${romaneio.totalVolume?.toFixed(3) || '0.000'} m³</span>
                </td>
                <td class="valor-info">
                    <span class="valor-value">${formatCurrency(romaneio.totalValor || 0)}</span>
                </td>
                <td class="date-info">
                    <span class="date-value">${formatDate(romaneio.createdAt)}</span>
                </td>
                <td class="actions">
                    <div class="btn-group btn-group-sm">
                        <button 
                            type="button" 
                            class="btn btn-outline-primary" 
                            onclick="romaneioTable.viewRomaneio('${romaneio.id}')"
                            title="Visualizar"
                        >
                            👁️
                        </button>
                        <button 
                            type="button" 
                            class="btn btn-outline-secondary" 
                            onclick="romaneioTable.editRomaneio('${romaneio.id}')"
                            title="Editar"
                        >
                            ✏️
                        </button>
                        <button 
                            type="button" 
                            class="btn btn-outline-info" 
                            onclick="romaneioTable.printRomaneio('${romaneio.id}')"
                            title="Imprimir"
                        >
                            🖨️
                        </button>
                        <button 
                            type="button" 
                            class="btn btn-outline-danger" 
                            onclick="romaneioTable.deleteRomaneio('${romaneio.id}')"
                            title="Excluir"
                        >
                            🗑️
                        </button>
                    </div>
                </td>
            </tr>
        `).join('');

        // Adiciona listeners para checkboxes
        const checkboxes = tbody.querySelectorAll('.row-checkbox');
        checkboxes.forEach(checkbox => {
            checkbox.addEventListener('change', (e) => {
                const romaneioId = e.target.dataset.romaneioId;
                this.toggleRowSelection(romaneioId, e.target.checked);
            });
        });
    }

    // =========================================================================
    // MÉTODOS DE CONTROLE
    // =========================================================================

    /**
     * Manipula ordenação
     */
    handleSort(field) {
        if (this.sortField === field) {
            this.sortDirection = this.sortDirection === 'asc' ? 'desc' : 'asc';
        } else {
            this.sortField = field;
            this.sortDirection = 'asc';
        }

        this.updateTable();
        logger.ui('table_sorted', `Campo: ${field}, Direção: ${this.sortDirection}`);
    }

    /**
     * Atualiza indicadores de ordenação
     */
    updateSortIndicators() {
        const sortableHeaders = document.querySelectorAll('.sortable');
        sortableHeaders.forEach(header => {
            const indicator = header.querySelector('.sort-indicator');
            const field = header.dataset.field;

            if (field === this.sortField) {
                indicator.textContent = this.sortDirection === 'asc' ? '↑' : '↓';
                header.classList.add('sorted');
            } else {
                indicator.textContent = '';
                header.classList.remove('sorted');
            }
        });
    }

    /**
     * Navega para página específica
     */
    goToPage(page) {
        const totalPages = Math.ceil(this.getTotalCount() / this.itemsPerPage);
        
        if (page < 1 || page > totalPages) return;
        
        this.currentPage = page;
        this.updateTable();
        
        logger.ui('table_page_changed', `Página: ${page}`);
    }

    /**
     * Vai para última página
     */
    goToLastPage() {
        const totalPages = Math.ceil(this.getTotalCount() / this.itemsPerPage);
        this.goToPage(totalPages);
    }

    /**
     * Obtém contagem total de itens filtrados
     */
    getTotalCount() {
        const romaneios = stateManager.getRomaneios();
        return this.filterAndSortRomaneios(romaneios).length;
    }

    // =========================================================================
    // MÉTODOS DE SELEÇÃO
    // =========================================================================

    /**
     * Alterna seleção de linha
     */
    toggleRowSelection(romaneioId, selected) {
        if (selected) {
            this.selectedRows.add(romaneioId);
        } else {
            this.selectedRows.delete(romaneioId);
        }

        this.updateBulkActionsVisibility();
        this.updateSelectAllState();
    }

    /**
     * Alterna seleção de todas as linhas
     */
    toggleAllSelection(selectAll) {
        const checkboxes = document.querySelectorAll('.row-checkbox');
        
        checkboxes.forEach(checkbox => {
            const romaneioId = checkbox.dataset.romaneioId;
            checkbox.checked = selectAll;
            
            if (selectAll) {
                this.selectedRows.add(romaneioId);
            } else {
                this.selectedRows.delete(romaneioId);
            }
        });

        this.updateBulkActionsVisibility();
    }

    /**
     * Limpa seleção
     */
    clearSelection() {
        this.selectedRows.clear();
        
        const checkboxes = document.querySelectorAll('.row-checkbox');
        checkboxes.forEach(checkbox => checkbox.checked = false);
        
        const selectAll = document.getElementById('select-all');
        if (selectAll) selectAll.checked = false;
        
        this.updateBulkActionsVisibility();
    }

    /**
     * Atualiza visibilidade de ações em lote
     */
    updateBulkActionsVisibility() {
        const bulkActions = document.getElementById('bulk-actions');
        const selectedCount = document.getElementById('selected-count');
        
        if (this.selectedRows.size > 0) {
            bulkActions.style.display = 'flex';
            selectedCount.textContent = `${this.selectedRows.size} selecionados`;
        } else {
            bulkActions.style.display = 'none';
        }
    }

    /**
     * Atualiza estado do checkbox "selecionar todos"
     */
    updateSelectAllState() {
        const selectAllCheckbox = document.getElementById('select-all');
        const checkboxes = document.querySelectorAll('.row-checkbox');
        
        if (!selectAllCheckbox) return;
        
        const totalCheckboxes = checkboxes.length;
        const checkedCheckboxes = document.querySelectorAll('.row-checkbox:checked').length;
        
        if (checkedCheckboxes === 0) {
            selectAllCheckbox.checked = false;
            selectAllCheckbox.indeterminate = false;
        } else if (checkedCheckboxes === totalCheckboxes) {
            selectAllCheckbox.checked = true;
            selectAllCheckbox.indeterminate = false;
        } else {
            selectAllCheckbox.checked = false;
            selectAllCheckbox.indeterminate = true;
        }
    }

    // =========================================================================
    // MÉTODOS DE AÇÃO
    // =========================================================================

    /**
     * Visualiza romaneio
     */
    viewRomaneio(romaneioId) {
        stateManager.selectRomaneio(romaneioId);
        // Aqui você pode disparar um evento ou chamar uma função para abrir modal/página
        window.dispatchEvent(new CustomEvent('viewRomaneio', { detail: { romaneioId } }));
        logger.ui('romaneio_viewed', romaneioId);
    }

    /**
     * Edita romaneio
     */
    editRomaneio(romaneioId) {
        stateManager.selectRomaneio(romaneioId);
        // Aqui você pode disparar um evento ou chamar uma função para editar
        window.dispatchEvent(new CustomEvent('editRomaneio', { detail: { romaneioId } }));
        logger.ui('romaneio_edited', romaneioId);
    }

    /**
     * Imprime romaneio
     */
    printRomaneio(romaneioId) {
        // Aqui você pode implementar a funcionalidade de impressão
        window.dispatchEvent(new CustomEvent('printRomaneio', { detail: { romaneioId } }));
        logger.ui('romaneio_printed', romaneioId);
    }

    /**
     * Exclui romaneio
     */
    async deleteRomaneio(romaneioId) {
        if (!confirm('Tem certeza que deseja excluir este romaneio?')) return;
        
        try {
            await stateManager.deleteRomaneio(romaneioId);
            this.selectedRows.delete(romaneioId);
            this.updateBulkActionsVisibility();
            logger.ui('romaneio_deleted', romaneioId);
        } catch (error) {
            logger.error('Erro ao excluir romaneio', error);
        }
    }

    /**
     * Exclui romaneios selecionados
     */
    async deleteSelected() {
        if (this.selectedRows.size === 0) return;
        
        const count = this.selectedRows.size;
        if (!confirm(`Tem certeza que deseja excluir ${count} romaneio(s) selecionado(s)?`)) return;
        
        try {
            const promises = Array.from(this.selectedRows).map(id => 
                stateManager.deleteRomaneio(id)
            );
            
            await Promise.all(promises);
            this.clearSelection();
            logger.ui('bulk_delete_completed', `${count} romaneios excluídos`);
        } catch (error) {
            logger.error('Erro ao excluir romaneios em lote', error);
        }
    }

    /**
     * Cria novo romaneio
     */
    createNewRomaneio() {
        // Aqui você pode disparar um evento ou chamar uma função para criar novo romaneio
        window.dispatchEvent(new CustomEvent('createRomaneio'));
        logger.ui('new_romaneio_requested');
    }

    // =========================================================================
    // MÉTODOS DE UTILIDADE
    // =========================================================================

    /**
     * Atualiza contador da tabela
     */
    updateTableCount(count) {
        const countElement = document.getElementById('table-count');
        if (countElement) {
            countElement.textContent = `${count} ${count === 1 ? 'item' : 'itens'}`;
        }
    }

    /**
     * Atualiza paginação
     */
    updatePagination(totalItems, totalPages) {
        // Atualiza informação de paginação
        const paginationInfo = document.getElementById('pagination-info');
        if (paginationInfo) {
            const start = ((this.currentPage - 1) * this.itemsPerPage) + 1;
            const end = Math.min(this.currentPage * this.itemsPerPage, totalItems);
            paginationInfo.textContent = `Mostrando ${start}-${end} de ${totalItems} itens`;
        }

        // Atualiza botões de navegação
        const btnFirst = document.getElementById('btn-first-page');
        const btnPrev = document.getElementById('btn-prev-page');
        const btnNext = document.getElementById('btn-next-page');
        const btnLast = document.getElementById('btn-last-page');

        if (btnFirst) btnFirst.disabled = this.currentPage === 1;
        if (btnPrev) btnPrev.disabled = this.currentPage === 1;
        if (btnNext) btnNext.disabled = this.currentPage === totalPages || totalPages === 0;
        if (btnLast) btnLast.disabled = this.currentPage === totalPages || totalPages === 0;

        // Atualiza números das páginas
        this.updatePageNumbers(totalPages);
    }

    /**
     * Atualiza números das páginas
     */
    updatePageNumbers(totalPages) {
        const pageNumbers = document.getElementById('page-numbers');
        if (!pageNumbers) return;

        let pages = [];
        const maxVisiblePages = 5;
        
        if (totalPages <= maxVisiblePages) {
            // Mostra todas as páginas
            for (let i = 1; i <= totalPages; i++) {
                pages.push(i);
            }
        } else {
            // Calcula quais páginas mostrar
            let start = Math.max(1, this.currentPage - 2);
            let end = Math.min(totalPages, start + maxVisiblePages - 1);
            
            if (end - start < maxVisiblePages - 1) {
                start = Math.max(1, end - maxVisiblePages + 1);
            }
            
            for (let i = start; i <= end; i++) {
                pages.push(i);
            }
        }

        pageNumbers.innerHTML = pages.map(page => `
            <button 
                type="button" 
                class="btn ${page === this.currentPage ? 'btn-primary' : 'btn-outline-secondary'} btn-sm page-btn"
                onclick="romaneioTable.goToPage(${page})"
            >
                ${page}
            </button>
        `).join('');
    }

    /**
     * Alterna estado de carregamento
     */
    toggleLoading(isLoading) {
        const loadingOverlay = document.getElementById('table-loading');
        if (loadingOverlay) {
            loadingOverlay.style.display = isLoading ? 'flex' : 'none';
        }
    }

    /**
     * Injeta estilos CSS
     */
    injectStyles() {
        if (document.getElementById('romaneio-table-styles')) return;

        const styles = document.createElement('style');
        styles.id = 'romaneio-table-styles';
        styles.textContent = `
            .romaneio-table-container {
                background: white;
                border-radius: 8px;
                box-shadow: 0 2px 8px rgba(0,0,0,0.1);
                overflow: hidden;
            }

            .table-header {
                padding: 20px;
                border-bottom: 1px solid #e9ecef;
                display: flex;
                justify-content: space-between;
                align-items: center;
                flex-wrap: wrap;
                gap: 15px;
            }

            .table-title h3 {
                margin: 0;
                font-size: 1.25rem;
                color: #2c3e50;
            }

            .table-count {
                color: #6c757d;
                font-size: 0.9rem;
            }

            .table-controls {
                display: flex;
                align-items: center;
                gap: 15px;
                flex-wrap: wrap;
            }

            .search-box {
                position: relative;
                min-width: 250px;
            }

            .search-box input {
                padding-right: 35px;
            }

            .btn-search {
                position: absolute;
                right: 5px;
                top: 50%;
                transform: translateY(-50%);
                background: none;
                border: none;
                font-size: 18px;
                color: #6c757d;
                cursor: pointer;
                padding: 5px;
            }

            .bulk-actions {
                display: flex;
                align-items: center;
                gap: 10px;
                padding: 8px 12px;
                background: #e3f2fd;
                border-radius: 6px;
                font-size: 0.9rem;
            }

            .table-loading {
                position: absolute;
                top: 0;
                left: 0;
                right: 0;
                bottom: 0;
                background: rgba(255,255,255,0.9);
                display: flex;
                flex-direction: column;
                align-items: center;
                justify-content: center;
                z-index: 10;
            }

            .loading-spinner {
                width: 40px;
                height: 40px;
                border: 4px solid #f3f3f3;
                border-top: 4px solid #007bff;
                border-radius: 50%;
                animation: spin 1s linear infinite;
                margin-bottom: 10px;
            }

            @keyframes spin {
                0% { transform: rotate(0deg); }
                100% { transform: rotate(360deg); }
            }

            .table-responsive {
                position: relative;
                max-height: 600px;
                overflow-y: auto;
            }

            .table th {
                background: #f8f9fa;
                border: none;
                font-weight: 600;
                color: #495057;
                position: sticky;
                top: 0;
                z-index: 5;
            }

            .table th.sortable {
                cursor: pointer;
                user-select: none;
                transition: background-color 0.2s;
            }

            .table th.sortable:hover {
                background: #e9ecef;
            }

            .table th.sorted {
                background: #dee2e6;
            }

            .sort-indicator {
                margin-left: 5px;
                font-weight: normal;
                color: #007bff;
            }

            .table tbody tr:hover {
                background: #f8f9fa;
            }

            .table tbody tr.selected {
                background: #e3f2fd;
            }

            .fornecedor-name {
                font-weight: 500;
                color: #2c3e50;
            }

            .volume-value, .valor-value {
                font-weight: 600;
                color: #28a745;
            }

            .date-value {
                color: #6c757d;
            }

            .empty-state {
                text-align: center;
                padding: 40px 20px;
                color: #6c757d;
            }

            .empty-icon {
                font-size: 48px;
                margin-bottom: 15px;
            }

            .empty-message {
                font-size: 1.1rem;
                margin-bottom: 15px;
            }

            .table-pagination {
                display: flex;
                justify-content: space-between;
                align-items: center;
                padding: 15px 20px;
                border-top: 1px solid #e9ecef;
                flex-wrap: wrap;
                gap: 15px;
            }

            .pagination-controls {
                display: flex;
                align-items: center;
                gap: 5px;
            }

            .page-btn {
                min-width: 35px;
            }

            /* Responsividade */
            @media (max-width: ${RESPONSIVE_CONFIG.BREAKPOINTS.MOBILE}) {
                .table-header {
                    flex-direction: column;
                    align-items: stretch;
                }

                .table-controls {
                    justify-content: space-between;
                }

                .search-box {
                    min-width: 200px;
                }

                .table-responsive {
                    font-size: 0.9rem;
                }

                .table th, .table td {
                    padding: 8px 4px;
                }

                .table-pagination {
                    flex-direction: column;
                    gap: 10px;
                }

                .pagination-controls {
                    order: 2;
                }

                .pagination-info, .pagination-size {
                    order: 1;
                }
            }

            @media (max-width: ${RESPONSIVE_CONFIG.BREAKPOINTS.TABLET}) {
                .bulk-actions {
                    flex-wrap: wrap;
                    justify-content: center;
                }
            }
        `;

        document.head.appendChild(styles);
    }
}

// =============================================================================
// INSTÂNCIA GLOBAL
// =============================================================================
let romaneioTable = null;

// =============================================================================
// FUNÇÃO DE INICIALIZAÇÃO
// =============================================================================
function initializeRomaneioTable(containerId = 'romaneio-table-container') {
    if (romaneioTable) {
        logger.warn('Tabela de romaneios já inicializada', '📊 TABLE');
        return romaneioTable;
    }

    romaneioTable = new RomaneioTable(containerId);
    
    // Disponibiliza globalmente
    window.romaneioTable = romaneioTable;
    
    return romaneioTable;
}

// =============================================================================
// EXPORTAÇÕES
// =============================================================================
export default RomaneioTable;
export { initializeRomaneioTable };

// Auto-inicialização se o container existir
document.addEventListener('DOMContentLoaded', () => {
    const container = document.getElementById('romaneio-table-container');
    if (container && !romaneioTable) {
        initializeRomaneioTable();
    }
}); 