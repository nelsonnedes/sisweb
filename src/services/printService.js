/**
 * SERVIÇO DE IMPRESSÃO PROFISSIONAL
 * Sistema completo para impressão e geração de PDF
 * 
 * @author Sistema de Excelência Firebase
 * @version 2.0.0
 * @created 2024
 */

import { formatters } from '../utils/formatters.js';
import { Calculator } from '../utils/calculations.js';
import { PRINT_CONFIG } from '../constants/app-constants.js';
import logger from '../utils/logger.js';

// =============================================================================
// CLASSE PRINCIPAL DE IMPRESSÃO
// =============================================================================
class PrintService {
    constructor() {
        this.calculator = new Calculator();
        this.templates = new Map();
        this.settings = { ...PRINT_CONFIG };
        
        this.initialize();
    }

    /**
     * Inicializa o serviço
     */
    initialize() {
        this.loadTemplates();
        this.setupPrintStyles();
        
        logger.success('Serviço de impressão inicializado', '🖨️ PRINT');
    }

    /**
     * Carrega templates de impressão
     */
    loadTemplates() {
        this.templates.set('romaneio_standard', this.getRomaneioStandardTemplate());
        this.templates.set('romaneio_detailed', this.getRomaneioDetailedTemplate());
        this.templates.set('romaneio_compact', this.getRomaneioCompactTemplate());
    }

    // =========================================================================
    // MÉTODOS PÚBLICOS DE IMPRESSÃO
    // =========================================================================

    /**
     * Imprime romaneio
     */
    async printRomaneio(romaneio, options = {}) {
        try {
            logger.startPerformance('print_romaneio');
            
            const config = {
                template: 'romaneio_standard',
                orientation: 'portrait',
                paperSize: 'A4',
                includeHeader: true,
                includeFooter: true,
                showPrices: true,
                showTotals: true,
                ...options
            };

            // Processa dados do romaneio
            const processedRomaneio = this.processRomaneioData(romaneio);
            
            // Gera HTML do documento
            const htmlContent = this.generateRomaneioHTML(processedRomaneio, config);
            
            // Abre janela de impressão
            this.openPrintWindow(htmlContent, config);
            
            logger.endPerformance('print_romaneio');
            logger.ui('romaneio_printed', romaneio.id);
            
            return true;
        } catch (error) {
            logger.endPerformance('print_romaneio');
            logger.error('Erro ao imprimir romaneio', '🖨️ PRINT', error);
            return false;
        }
    }

    /**
     * Gera PDF do romaneio
     */
    async generatePDF(romaneio, options = {}) {
        try {
            // Verifica se jsPDF está disponível
            if (typeof window.jsPDF === 'undefined') {
                throw new Error('jsPDF não encontrado. Inclua a biblioteca jsPDF.');
            }

            const config = {
                template: 'romaneio_standard',
                filename: `romaneio_${romaneio.numeroRomaneio || 'sem_numero'}.pdf`,
                ...options
            };

            const processedRomaneio = this.processRomaneioData(romaneio);
            const pdfDoc = this.generatePDFDocument(processedRomaneio, config);
            
            // Salva o PDF
            pdfDoc.save(config.filename);
            
            logger.ui('pdf_generated', config.filename);
            return true;
        } catch (error) {
            logger.error('Erro ao gerar PDF', '🖨️ PRINT', error);
            return false;
        }
    }

    /**
     * Visualiza impressão
     */
    previewPrint(romaneio, options = {}) {
        const config = {
            template: 'romaneio_standard',
            ...options
        };

        const processedRomaneio = this.processRomaneioData(romaneio);
        const htmlContent = this.generateRomaneioHTML(processedRomaneio, config);
        
        this.openPreviewModal(htmlContent);
    }

    // =========================================================================
    // PROCESSAMENTO DE DADOS
    // =========================================================================

    /**
     * Processa dados do romaneio para impressão
     */
    processRomaneioData(romaneio) {
        // Calcula totais se necessário
        let totalVolume = 0;
        let totalValor = 0;
        let totalPecas = 0;

        const itensProcessados = (romaneio.itens || []).map(item => {
            const volume = this.calculator.calculateBasicVolume(
                parseFloat(item.comprimento || 0),
                parseFloat(item.largura || 0) / 100,
                parseFloat(item.altura || 0) / 100,
                parseInt(item.pecas || 0)
            );

            const valorTotal = volume * (parseFloat(item.precoUnitario || 0));
            
            totalVolume += volume;
            totalValor += valorTotal;
            totalPecas += parseInt(item.pecas || 0);

            return {
                ...item,
                volume: volume,
                valorTotal: valorTotal,
                volumeFormatted: formatters.volume(volume),
                precoFormatted: formatters.currency(item.precoUnitario || 0),
                valorFormatted: formatters.currency(valorTotal)
            };
        });

        return {
            ...romaneio,
            itens: itensProcessados,
            totals: {
                pecas: totalPecas,
                volume: totalVolume,
                valor: totalValor,
                precoMedio: totalVolume > 0 ? totalValor / totalVolume : 0,
                // Formatados
                pecasFormatted: totalPecas.toString(),
                volumeFormatted: formatters.volume(totalVolume),
                valorFormatted: formatters.currency(totalValor),
                precoMedioFormatted: formatters.currency(totalVolume > 0 ? totalValor / totalVolume : 0)
            },
            // Dados formatados
            numeroRomaneioFormatted: romaneio.numeroRomaneio || 'N/A',
            dataEmissaoFormatted: formatters.date(romaneio.dataEmissao),
            fornecedorFormatted: {
                nome: romaneio.fornecedor?.nome || 'N/A',
                documento: formatters.documento(romaneio.fornecedor?.documento || ''),
                telefone: formatters.phone(romaneio.fornecedor?.telefone || ''),
                endereco: romaneio.fornecedor?.endereco || ''
            }
        };
    }

    // =========================================================================
    // GERAÇÃO DE HTML
    // =========================================================================

    /**
     * Gera HTML do romaneio
     */
    generateRomaneioHTML(romaneio, config) {
        const template = this.templates.get(config.template);
        if (!template) {
            throw new Error(`Template ${config.template} não encontrado`);
        }

        let html = template;

        // Substitui variáveis do template
        html = this.replaceTemplateVariables(html, romaneio, config);

        // Adiciona estilos de impressão
        html = this.addPrintStyles(html, config);

        return html;
    }

    /**
     * Substitui variáveis no template
     */
    replaceTemplateVariables(html, romaneio, config) {
        // Dados básicos
        html = html.replace(/\{\{numeroRomaneio\}\}/g, romaneio.numeroRomaneioFormatted);
        html = html.replace(/\{\{dataEmissao\}\}/g, romaneio.dataEmissaoFormatted);
        html = html.replace(/\{\{observacoes\}\}/g, romaneio.observacoes || '');

        // Dados do fornecedor
        html = html.replace(/\{\{fornecedor\.nome\}\}/g, romaneio.fornecedorFormatted.nome);
        html = html.replace(/\{\{fornecedor\.documento\}\}/g, romaneio.fornecedorFormatted.documento);
        html = html.replace(/\{\{fornecedor\.telefone\}\}/g, romaneio.fornecedorFormatted.telefone);
        html = html.replace(/\{\{fornecedor\.endereco\}\}/g, romaneio.fornecedorFormatted.endereco);

        // Totais
        html = html.replace(/\{\{totals\.pecas\}\}/g, romaneio.totals.pecasFormatted);
        html = html.replace(/\{\{totals\.volume\}\}/g, romaneio.totals.volumeFormatted);
        html = html.replace(/\{\{totals\.valor\}\}/g, romaneio.totals.valorFormatted);
        html = html.replace(/\{\{totals\.precoMedio\}\}/g, romaneio.totals.precoMedioFormatted);

        // Data atual
        html = html.replace(/\{\{dataAtual\}\}/g, formatters.date(new Date()));
        html = html.replace(/\{\{horaAtual\}\}/g, formatters.time(new Date()));

        // Gera tabela de itens
        const itensHTML = this.generateItensTable(romaneio.itens, config);
        html = html.replace(/\{\{itensTable\}\}/g, itensHTML);

        return html;
    }

    /**
     * Gera tabela de itens
     */
    generateItensTable(itens, config) {
        if (!itens || itens.length === 0) {
            return '<tr><td colspan="8" class="text-center">Nenhum item cadastrado</td></tr>';
        }

        return itens.map((item, index) => `
            <tr>
                <td class="text-center">${index + 1}</td>
                <td>${item.especie || 'N/A'}</td>
                <td class="text-center">${item.comprimento || '0'}</td>
                <td class="text-center">${item.largura || '0'}</td>
                <td class="text-center">${item.altura || '0'}</td>
                <td class="text-center">${item.pecas || '0'}</td>
                <td class="text-right">${item.volumeFormatted}</td>
                ${config.showPrices ? `
                    <td class="text-right">${item.precoFormatted}</td>
                    <td class="text-right">${item.valorFormatted}</td>
                ` : ''}
            </tr>
        `).join('');
    }

    // =========================================================================
    // TEMPLATES
    // =========================================================================

    /**
     * Template padrão de romaneio
     */
    getRomaneioStandardTemplate() {
        return `
            <!DOCTYPE html>
            <html>
            <head>
                <meta charset="UTF-8">
                <title>Romaneio {{numeroRomaneio}}</title>
                <style>
                    @media print {
                        body { margin: 0; }
                        .no-print { display: none !important; }
                    }
                </style>
            </head>
            <body>
                <div class="document">
                    <!-- Cabeçalho -->
                    <div class="header">
                        <div class="company-info">
                            <h1>ROMANEIO DE MADEIRA</h1>
                            <p class="company-name">${this.settings.COMPANY_NAME}</p>
                            <p class="company-address">${this.settings.COMPANY_ADDRESS}</p>
                        </div>
                        <div class="document-info">
                            <table>
                                <tr>
                                    <th>Número:</th>
                                    <td>{{numeroRomaneio}}</td>
                                </tr>
                                <tr>
                                    <th>Data:</th>
                                    <td>{{dataEmissao}}</td>
                                </tr>
                                <tr>
                                    <th>Impresso em:</th>
                                    <td>{{dataAtual}} às {{horaAtual}}</td>
                                </tr>
                            </table>
                        </div>
                    </div>

                    <!-- Dados do Fornecedor -->
                    <div class="section">
                        <h3>DADOS DO FORNECEDOR</h3>
                        <table class="info-table">
                            <tr>
                                <th>Nome:</th>
                                <td>{{fornecedor.nome}}</td>
                                <th>Documento:</th>
                                <td>{{fornecedor.documento}}</td>
                            </tr>
                            <tr>
                                <th>Telefone:</th>
                                <td>{{fornecedor.telefone}}</td>
                                <th>Endereço:</th>
                                <td>{{fornecedor.endereco}}</td>
                            </tr>
                        </table>
                    </div>

                    <!-- Itens -->
                    <div class="section">
                        <h3>ITENS DO ROMANEIO</h3>
                        <table class="items-table">
                            <thead>
                                <tr>
                                    <th>#</th>
                                    <th>Espécie</th>
                                    <th>Comp.(m)</th>
                                    <th>Larg.(cm)</th>
                                    <th>Alt.(cm)</th>
                                    <th>Peças</th>
                                    <th>Volume(m³)</th>
                                    <th>Preço/m³</th>
                                    <th>Valor Total</th>
                                </tr>
                            </thead>
                            <tbody>
                                {{itensTable}}
                            </tbody>
                            <tfoot>
                                <tr class="totals-row">
                                    <th colspan="5">TOTAIS:</th>
                                    <th>{{totals.pecas}}</th>
                                    <th>{{totals.volume}}</th>
                                    <th>{{totals.precoMedio}}</th>
                                    <th>{{totals.valor}}</th>
                                </tr>
                            </tfoot>
                        </table>
                    </div>

                    <!-- Observações -->
                    <div class="section">
                        <h3>OBSERVAÇÕES</h3>
                        <p>{{observacoes}}</p>
                    </div>

                    <!-- Assinaturas -->
                    <div class="signatures">
                        <div class="signature">
                            <div class="signature-line"></div>
                            <p>Fornecedor</p>
                        </div>
                        <div class="signature">
                            <div class="signature-line"></div>
                            <p>Responsável</p>
                        </div>
                    </div>

                    <!-- Rodapé -->
                    <div class="footer">
                        <p>Este documento foi gerado automaticamente pelo sistema SisWeb</p>
                    </div>
                </div>
            </body>
            </html>
        `;
    }

    /**
     * Template detalhado de romaneio
     */
    getRomaneioDetailedTemplate() {
        // Template com mais detalhes e gráficos
        return this.getRomaneioStandardTemplate(); // Simplificado para este exemplo
    }

    /**
     * Template compacto de romaneio
     */
    getRomaneioCompactTemplate() {
        // Template mais compacto para economia de papel
        return this.getRomaneioStandardTemplate(); // Simplificado para este exemplo
    }

    // =========================================================================
    // ESTILOS DE IMPRESSÃO
    // =========================================================================

    /**
     * Adiciona estilos de impressão ao HTML
     */
    addPrintStyles(html, config) {
        const styles = `
            <style>
                body {
                    font-family: Arial, sans-serif;
                    font-size: 12px;
                    line-height: 1.4;
                    margin: 0;
                    padding: 20px;
                    color: #333;
                }

                .document {
                    max-width: 100%;
                    margin: 0 auto;
                }

                .header {
                    display: flex;
                    justify-content: space-between;
                    align-items: flex-start;
                    margin-bottom: 30px;
                    padding-bottom: 20px;
                    border-bottom: 2px solid #333;
                }

                .company-info h1 {
                    margin: 0 0 10px 0;
                    font-size: 24px;
                    color: #2c3e50;
                }

                .company-name {
                    font-size: 16px;
                    font-weight: bold;
                    margin: 5px 0;
                }

                .company-address {
                    font-size: 12px;
                    color: #666;
                    margin: 5px 0;
                }

                .document-info table {
                    border-collapse: collapse;
                    font-size: 12px;
                }

                .document-info th {
                    text-align: right;
                    padding: 3px 10px 3px 0;
                    font-weight: bold;
                }

                .document-info td {
                    padding: 3px 0;
                    border-bottom: 1px solid #ddd;
                    min-width: 120px;
                }

                .section {
                    margin-bottom: 25px;
                }

                .section h3 {
                    background: #f8f9fa;
                    padding: 8px 12px;
                    margin: 0 0 15px 0;
                    border-left: 4px solid #007bff;
                    font-size: 14px;
                    text-transform: uppercase;
                }

                .info-table {
                    width: 100%;
                    border-collapse: collapse;
                    margin-bottom: 15px;
                }

                .info-table th {
                    background: #f8f9fa;
                    padding: 8px;
                    text-align: left;
                    font-weight: bold;
                    border: 1px solid #ddd;
                    width: 15%;
                }

                .info-table td {
                    padding: 8px;
                    border: 1px solid #ddd;
                }

                .items-table {
                    width: 100%;
                    border-collapse: collapse;
                    font-size: 11px;
                }

                .items-table th {
                    background: #343a40;
                    color: white;
                    padding: 8px 4px;
                    text-align: center;
                    border: 1px solid #333;
                    font-weight: bold;
                }

                .items-table td {
                    padding: 6px 4px;
                    border: 1px solid #ddd;
                    text-align: left;
                }

                .items-table .text-center {
                    text-align: center;
                }

                .items-table .text-right {
                    text-align: right;
                }

                .totals-row th,
                .totals-row td {
                    background: #f8f9fa;
                    font-weight: bold;
                    border-top: 2px solid #333;
                }

                .signatures {
                    display: flex;
                    justify-content: space-around;
                    margin: 40px 0;
                }

                .signature {
                    text-align: center;
                    width: 200px;
                }

                .signature-line {
                    border-bottom: 1px solid #333;
                    margin-bottom: 5px;
                    height: 50px;
                }

                .footer {
                    text-align: center;
                    font-size: 10px;
                    color: #666;
                    margin-top: 30px;
                    padding-top: 20px;
                    border-top: 1px solid #ddd;
                }

                @media print {
                    body {
                        padding: 0;
                    }
                    
                    .document {
                        margin: 0;
                    }
                    
                    .section {
                        page-break-inside: avoid;
                    }
                    
                    .items-table {
                        page-break-inside: auto;
                    }
                    
                    .signatures {
                        page-break-inside: avoid;
                    }
                }

                @page {
                    size: ${config.paperSize || 'A4'};
                    margin: 1cm;
                }
            </style>
        `;

        // Insere estilos no head do HTML
        return html.replace('</head>', styles + '</head>');
    }

    /**
     * Configura estilos globais de impressão
     */
    setupPrintStyles() {
        // Adiciona estilos globais de impressão se não existirem
        if (!document.getElementById('global-print-styles')) {
            const styles = document.createElement('style');
            styles.id = 'global-print-styles';
            styles.textContent = `
                @media print {
                    .no-print {
                        display: none !important;
                    }
                    
                    .print-only {
                        display: block !important;
                    }
                }
                
                .print-only {
                    display: none;
                }
            `;
            document.head.appendChild(styles);
        }
    }

    // =========================================================================
    // MÉTODOS DE JANELA DE IMPRESSÃO
    // =========================================================================

    /**
     * Abre janela de impressão
     */
    openPrintWindow(htmlContent, config) {
        const printWindow = window.open('', '_blank', 'width=800,height=600,scrollbars=yes');
        
        if (!printWindow) {
            throw new Error('Não foi possível abrir janela de impressão. Verifique se pop-ups estão bloqueados.');
        }

        printWindow.document.write(htmlContent);
        printWindow.document.close();

        // Aguarda carregamento e executa impressão
        printWindow.onload = () => {
            setTimeout(() => {
                printWindow.print();
                printWindow.close();
            }, 250);
        };
    }

    /**
     * Abre modal de prévia
     */
    openPreviewModal(htmlContent) {
        // Remove modal existente
        const existing = document.getElementById('print-preview-modal');
        if (existing) existing.remove();

        // Cria novo modal
        const modal = document.createElement('div');
        modal.id = 'print-preview-modal';
        modal.className = 'modal fade';
        modal.innerHTML = `
            <div class="modal-dialog modal-xl">
                <div class="modal-content">
                    <div class="modal-header">
                        <h5 class="modal-title">Visualizar Impressão</h5>
                        <button type="button" class="btn-close" data-bs-dismiss="modal"></button>
                    </div>
                    <div class="modal-body p-0">
                        <div class="print-preview-container">
                            <iframe srcdoc="${htmlContent.replace(/"/g, '&quot;')}" 
                                    style="width: 100%; height: 600px; border: none;">
                            </iframe>
                        </div>
                    </div>
                    <div class="modal-footer">
                        <button type="button" class="btn btn-secondary" data-bs-dismiss="modal">
                            Fechar
                        </button>
                        <button type="button" class="btn btn-primary" onclick="window.frames[0].print()">
                            🖨️ Imprimir
                        </button>
                    </div>
                </div>
            </div>
        `;

        document.body.appendChild(modal);

        // Mostra modal
        const bootstrap = window.bootstrap;
        if (bootstrap) {
            new bootstrap.Modal(modal).show();
        }
    }

    // =========================================================================
    // CONFIGURAÇÕES
    // =========================================================================

    /**
     * Atualiza configurações
     */
    updateSettings(newSettings) {
        this.settings = { ...this.settings, ...newSettings };
        logger.info('Configurações de impressão atualizadas', '🖨️ PRINT');
    }

    /**
     * Obtém configurações atuais
     */
    getSettings() {
        return { ...this.settings };
    }
}

// =============================================================================
// INSTÂNCIA GLOBAL
// =============================================================================
const printService = new PrintService();

// =============================================================================
// EXPORTAÇÕES
// =============================================================================
export default printService;

export const {
    printRomaneio,
    generatePDF,
    previewPrint,
    updateSettings,
    getSettings
} = printService; 