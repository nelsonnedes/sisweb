# 🛠️ IMPLEMENTAÇÕES PRÁTICAS - MÓDULO DE VENDAS

**Documento complementar ao ANALISE_PLANO_MODULO_VENDAS.md**  
**Data:** 09/10/2025  
**Objetivo:** Fornecer código pronto para implementar as funcionalidades faltantes

---

## 📋 ÍNDICE

1. [Implementação: visualizarPedido()](#1-implementação-visualizarpedido)
2. [Implementação: Sistema de Impressão](#2-implementação-sistema-de-impressão)
3. [Implementação: Validação de Estoque](#3-implementação-validação-de-estoque)
4. [Implementação: Sistema de Toasts](#4-implementação-sistema-de-toasts)
5. [Implementação: Loading States](#5-implementação-loading-states)
6. [Implementação: Exportação Excel](#6-implementação-exportação-excel)
7. [Implementação: Dashboard com Gráficos](#7-implementação-dashboard-com-gráficos)
8. [Correções de Bugs](#8-correções-de-bugs)

---

## 1. IMPLEMENTAÇÃO: visualizarPedido()

### 1.1 Modal HTML (adicionar em vendas.html)

```html
<!-- Modal Visualização de Pedido - Adicionar antes do fechamento do body -->
<div id="visualizarPedidoModal" class="modal">
    <div class="modal-content" style="max-width: 900px;">
        <div class="modal-header">
            <h2><i class="fas fa-file-invoice"></i> Detalhes do Pedido</h2>
            <span class="close" onclick="fecharModal('visualizarPedidoModal')">&times;</span>
        </div>
        
        <div class="modal-body">
            <!-- Cabeçalho do Pedido -->
            <div class="pedido-header" style="background: #f8f9fa; padding: 20px; border-radius: 8px; margin-bottom: 20px;">
                <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 15px;">
                    <div>
                        <label style="font-weight: bold; color: #6c757d;">Número:</label>
                        <div id="viewPedidoNumero" style="font-size: 1.2em; color: #2c3e50;"></div>
                    </div>
                    <div>
                        <label style="font-weight: bold; color: #6c757d;">Data:</label>
                        <div id="viewPedidoData" style="font-size: 1.2em; color: #2c3e50;"></div>
                    </div>
                    <div>
                        <label style="font-weight: bold; color: #6c757d;">Status:</label>
                        <div id="viewPedidoStatus"></div>
                    </div>
                </div>
                
                <div style="margin-top: 15px; padding-top: 15px; border-top: 1px solid #dee2e6;">
                    <label style="font-weight: bold; color: #6c757d;">Cliente:</label>
                    <div id="viewPedidoCliente" style="font-size: 1.1em; color: #2c3e50;"></div>
                    <div id="viewPedidoClienteDetalhes" style="font-size: 0.9em; color: #6c757d; margin-top: 5px;"></div>
                </div>
            </div>
            
            <!-- Itens do Pedido -->
            <div class="pedido-itens" style="margin-bottom: 20px;">
                <h3 style="color: #2c3e50; margin-bottom: 15px;">
                    <i class="fas fa-boxes"></i> Itens do Pedido
                </h3>
                <div class="table-container">
                    <table class="table">
                        <thead>
                            <tr>
                                <th>Produto</th>
                                <th style="text-align: center;">Quantidade</th>
                                <th style="text-align: right;">Preço Unit.</th>
                                <th style="text-align: right;">Total</th>
                            </tr>
                        </thead>
                        <tbody id="viewPedidoItensTable">
                        </tbody>
                    </table>
                </div>
            </div>
            
            <!-- Totais -->
            <div class="pedido-totais" style="background: #f8f9fa; padding: 15px; border-radius: 8px; margin-bottom: 20px;">
                <div style="display: flex; justify-content: space-between; margin-bottom: 10px;">
                    <span>Subtotal:</span>
                    <span id="viewPedidoSubtotal" style="font-weight: bold;"></span>
                </div>
                <div style="display: flex; justify-content: space-between; margin-bottom: 10px;">
                    <span>Desconto:</span>
                    <span id="viewPedidoDesconto" style="color: #e74c3c;"></span>
                </div>
                <div style="display: flex; justify-content: space-between; padding-top: 10px; border-top: 2px solid #dee2e6;">
                    <span style="font-size: 1.2em; font-weight: bold;">Total Geral:</span>
                    <span id="viewPedidoTotal" style="font-size: 1.2em; font-weight: bold; color: #28a745;"></span>
                </div>
            </div>
            
            <!-- Forma de Pagamento -->
            <div class="pedido-pagamento" style="margin-bottom: 20px;">
                <h3 style="color: #2c3e50; margin-bottom: 15px;">
                    <i class="fas fa-credit-card"></i> Forma de Pagamento
                </h3>
                <div class="table-container">
                    <table class="table">
                        <thead>
                            <tr>
                                <th>Valor</th>
                                <th>Vencimento</th>
                                <th>Tipo</th>
                                <th>Observação</th>
                                <th>Status</th>
                            </tr>
                        </thead>
                        <tbody id="viewPedidoPagamentoTable">
                        </tbody>
                    </table>
                </div>
            </div>
            
            <!-- Metadados -->
            <div class="pedido-meta" style="font-size: 0.9em; color: #6c757d; padding-top: 15px; border-top: 1px solid #dee2e6;">
                <div>Criado em: <span id="viewPedidoCreated"></span></div>
                <div id="viewPedidoUpdatedContainer" style="margin-top: 5px; display: none;">
                    Última atualização: <span id="viewPedidoUpdated"></span>
                </div>
            </div>
        </div>
        
        <div class="modal-footer" style="display: flex; gap: 10px; justify-content: flex-end; padding: 15px; border-top: 1px solid #dee2e6;">
            <button onclick="imprimirPedido(window.pedidoVisualizando)" class="btn-primary">
                <i class="fas fa-print"></i> Imprimir
            </button>
            <button onclick="editarPedido(window.pedidoVisualizando); fecharModal('visualizarPedidoModal');" class="btn-warning">
                <i class="fas fa-edit"></i> Editar
            </button>
            <button onclick="fecharModal('visualizarPedidoModal')" class="btn-danger">
                <i class="fas fa-times"></i> Fechar
            </button>
        </div>
    </div>
</div>
```

### 1.2 Função JavaScript (adicionar em vendas.js)

```javascript
/**
 * Visualizar detalhes completos de um pedido
 * @param {string} pedidoId - ID do pedido a visualizar
 */
function visualizarPedido(pedidoId) {
    const pedido = window.pedidos.find(p => p.id === pedidoId);
    
    if (!pedido) {
        alert('Pedido não encontrado');
        return;
    }
    
    // Armazenar pedido para ações posteriores (imprimir, editar)
    window.pedidoVisualizando = pedidoId;
    
    // Preencher dados do cabeçalho
    document.getElementById('viewPedidoNumero').textContent = pedido.numero;
    document.getElementById('viewPedidoData').textContent = formatDate(pedido.data);
    
    // Status com badge colorido
    const statusLabel = getStatusLabel(pedido.status);
    document.getElementById('viewPedidoStatus').innerHTML = 
        `<span class="status-badge status-${pedido.status}">${statusLabel}</span>`;
    
    // Dados do cliente
    const nomeCliente = pedido.cliente ? 
        (pedido.cliente.nome || pedido.cliente.name || 'Nome não informado') : 
        'Cliente não informado';
    document.getElementById('viewPedidoCliente').textContent = nomeCliente;
    
    // Detalhes do cliente (email, telefone, endereço)
    let detalhesCliente = [];
    if (pedido.cliente) {
        if (pedido.cliente.email) detalhesCliente.push(`📧 ${pedido.cliente.email}`);
        if (pedido.cliente.telefone) detalhesCliente.push(`📞 ${pedido.cliente.telefone}`);
        if (pedido.cliente.endereco) detalhesCliente.push(`📍 ${pedido.cliente.endereco}`);
    }
    document.getElementById('viewPedidoClienteDetalhes').textContent = detalhesCliente.join(' | ');
    
    // Itens do pedido
    const tbodyItens = document.getElementById('viewPedidoItensTable');
    tbodyItens.innerHTML = pedido.itens.map((item, index) => {
        // Determinar descrição do produto
        let produtoDescricao = '';
        if (item.tipo === 'manual') {
            produtoDescricao = `<span class="badge" style="background: #6c757d; color: white; padding: 2px 6px; border-radius: 3px; font-size: 0.8em; margin-right: 5px;">MANUAL</span>${item.produtoNome}`;
        } else if (item.tipo === 'romaneio') {
            produtoDescricao = `<span class="badge" style="background: #17a2b8; color: white; padding: 2px 6px; border-radius: 3px; font-size: 0.8em; margin-right: 5px;">ROMANEIO</span>${item.produtoNome}`;
        } else {
            produtoDescricao = `${item.produtoCodigo || ''} - ${item.produtoNome}`;
        }
        
        // Formatar quantidade com unidade
        const quantidadeFormatada = item.unidade 
            ? `${formatNumber(item.quantidade)} ${item.unidade}`
            : formatNumber(item.quantidade);
        
        return `
            <tr>
                <td>${produtoDescricao}</td>
                <td style="text-align: center;">${quantidadeFormatada}</td>
                <td style="text-align: right;">${formatCurrency(item.precoUnitario)}</td>
                <td style="text-align: right; font-weight: bold;">${formatCurrency(item.total)}</td>
            </tr>
        `;
    }).join('');
    
    // Totais
    document.getElementById('viewPedidoSubtotal').textContent = formatCurrency(pedido.subtotal);
    document.getElementById('viewPedidoDesconto').textContent = formatCurrency(pedido.desconto);
    document.getElementById('viewPedidoTotal').textContent = formatCurrency(pedido.total);
    
    // Forma de pagamento
    const tbodyPagamento = document.getElementById('viewPedidoPagamentoTable');
    if (pedido.contasReceber && pedido.contasReceber.length > 0) {
        tbodyPagamento.innerHTML = pedido.contasReceber.map(conta => {
            return `
                <tr>
                    <td>${formatCurrency(conta.valor)}</td>
                    <td>${formatDate(conta.vencimento)}</td>
                    <td>${getTipoContaLabel(conta.tipo)}</td>
                    <td>${conta.observacao || '-'}</td>
                    <td>
                        <span class="status-badge status-${conta.status || 'pendente'}">
                            ${getStatusLabel(conta.status || 'pendente')}
                        </span>
                    </td>
                </tr>
            `;
        }).join('');
    } else {
        tbodyPagamento.innerHTML = '<tr><td colspan="5" style="text-align: center;">Sem informações de pagamento</td></tr>';
    }
    
    // Metadados
    if (pedido.created) {
        const dataCreated = new Date(pedido.created);
        document.getElementById('viewPedidoCreated').textContent = 
            dataCreated.toLocaleString('pt-BR');
    }
    
    if (pedido.updated) {
        const dataUpdated = new Date(pedido.updated);
        document.getElementById('viewPedidoUpdated').textContent = 
            dataUpdated.toLocaleString('pt-BR');
        document.getElementById('viewPedidoUpdatedContainer').style.display = 'block';
    } else {
        document.getElementById('viewPedidoUpdatedContainer').style.display = 'none';
    }
    
    // Abrir modal
    document.getElementById('visualizarPedidoModal').style.display = 'block';
}

// Exportar função globalmente
window.visualizarPedido = visualizarPedido;
```

---

## 2. IMPLEMENTAÇÃO: Sistema de Impressão

### 2.1 CSS de Impressão (adicionar em vendas.html ou criar print-vendas.css)

```html
<style>
/* CSS de Impressão para Pedidos */
@media print {
    /* Ocultar elementos desnecessários */
    .modal-header,
    .modal-footer,
    .btn,
    .action-buttons,
    main-menu,
    .tabs,
    .close {
        display: none !important;
    }
    
    /* Ajustar modal para ocupar toda a página */
    .modal {
        position: static !important;
        background: white !important;
    }
    
    .modal-content {
        width: 100% !important;
        max-width: 100% !important;
        margin: 0 !important;
        padding: 20px !important;
        box-shadow: none !important;
        border: none !important;
    }
    
    /* Estilo do cabeçalho impresso */
    .print-header {
        text-align: center;
        margin-bottom: 30px;
        border-bottom: 2px solid #333;
        padding-bottom: 20px;
    }
    
    .print-header h1 {
        margin: 0;
        font-size: 24px;
        color: #333;
    }
    
    .print-header p {
        margin: 5px 0;
        font-size: 12px;
        color: #666;
    }
    
    /* Tabelas */
    .table {
        border: 1px solid #333 !important;
        page-break-inside: avoid;
    }
    
    .table th {
        background: #f0f0f0 !important;
        color: #333 !important;
        -webkit-print-color-adjust: exact;
        print-color-adjust: exact;
    }
    
    .table th,
    .table td {
        border: 1px solid #333 !important;
        padding: 8px !important;
    }
    
    /* Badges de status */
    .status-badge {
        border: 1px solid #333 !important;
        padding: 2px 6px !important;
        -webkit-print-color-adjust: exact;
        print-color-adjust: exact;
    }
    
    /* Quebra de página */
    .page-break {
        page-break-after: always;
    }
    
    /* Rodapé da impressão */
    .print-footer {
        margin-top: 30px;
        padding-top: 20px;
        border-top: 1px solid #333;
        text-align: center;
        font-size: 10px;
        color: #666;
    }
}

/* Estilos para pré-visualização de impressão */
.print-preview {
    background: white;
    padding: 40px;
    max-width: 21cm;
    margin: 0 auto;
    box-shadow: 0 0 10px rgba(0,0,0,0.1);
}
</style>
```

### 2.2 Função de Impressão (adicionar em vendas.js)

```javascript
/**
 * Imprimir pedido
 * @param {string} pedidoId - ID do pedido a imprimir
 */
function imprimirPedido(pedidoId) {
    const pedido = window.pedidos.find(p => p.id === pedidoId);
    
    if (!pedido) {
        alert('Pedido não encontrado');
        return;
    }
    
    // Criar conteúdo HTML para impressão
    const conteudoImpressao = gerarHTMLImpressaoPedido(pedido);
    
    // Abrir janela de impressão
    const janelaImpressao = window.open('', '_blank', 'width=800,height=600');
    janelaImpressao.document.write(conteudoImpressao);
    janelaImpressao.document.close();
    
    // Aguardar carregamento e imprimir
    janelaImpressao.onload = function() {
        setTimeout(() => {
            janelaImpressao.print();
        }, 250);
    };
}

/**
 * Gerar HTML formatado para impressão do pedido
 * @param {Object} pedido - Objeto do pedido
 * @returns {string} HTML formatado
 */
function gerarHTMLImpressaoPedido(pedido) {
    const nomeCliente = pedido.cliente ? 
        (pedido.cliente.nome || pedido.cliente.name || 'Cliente não informado') : 
        'Cliente não informado';
    
    const statusLabel = getStatusLabel(pedido.status);
    
    // Dados da empresa (configurar conforme necessário)
    const dadosEmpresa = {
        nome: 'SISWEB - Sistema de Gestão',
        endereco: 'Endereço da Empresa',
        telefone: '(00) 0000-0000',
        email: 'contato@empresa.com',
        cnpj: '00.000.000/0000-00'
    };
    
    // Montar tabela de itens
    let htmlItens = '';
    pedido.itens.forEach((item, index) => {
        let produtoDescricao = '';
        if (item.tipo === 'manual') {
            produtoDescricao = `[MANUAL] ${item.produtoNome}`;
        } else if (item.tipo === 'romaneio') {
            produtoDescricao = `[ROMANEIO] ${item.produtoNome}`;
        } else {
            produtoDescricao = `${item.produtoCodigo || ''} - ${item.produtoNome}`;
        }
        
        const quantidadeFormatada = item.unidade 
            ? `${formatNumber(item.quantidade)} ${item.unidade}`
            : formatNumber(item.quantidade);
        
        htmlItens += `
            <tr>
                <td>${index + 1}</td>
                <td>${produtoDescricao}</td>
                <td style="text-align: center;">${quantidadeFormatada}</td>
                <td style="text-align: right;">${formatCurrency(item.precoUnitario)}</td>
                <td style="text-align: right;"><strong>${formatCurrency(item.total)}</strong></td>
            </tr>
        `;
    });
    
    // Montar tabela de pagamento
    let htmlPagamento = '';
    if (pedido.contasReceber && pedido.contasReceber.length > 0) {
        pedido.contasReceber.forEach((conta, index) => {
            htmlPagamento += `
                <tr>
                    <td>${index + 1}ª parcela</td>
                    <td>${formatCurrency(conta.valor)}</td>
                    <td>${formatDate(conta.vencimento)}</td>
                    <td>${getTipoContaLabel(conta.tipo)}</td>
                    <td>${conta.observacao || '-'}</td>
                </tr>
            `;
        });
    } else {
        htmlPagamento = '<tr><td colspan="5" style="text-align: center;">Sem informações de pagamento</td></tr>';
    }
    
    // Detalhes do cliente
    let detalhesCliente = '';
    if (pedido.cliente) {
        if (pedido.cliente.email) detalhesCliente += `<p style="margin: 3px 0;"><strong>Email:</strong> ${pedido.cliente.email}</p>`;
        if (pedido.cliente.telefone) detalhesCliente += `<p style="margin: 3px 0;"><strong>Telefone:</strong> ${pedido.cliente.telefone}</p>`;
        if (pedido.cliente.endereco) detalhesCliente += `<p style="margin: 3px 0;"><strong>Endereço:</strong> ${pedido.cliente.endereco}</p>`;
    }
    
    // Template HTML completo
    return `
<!DOCTYPE html>
<html lang="pt-BR">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Pedido ${pedido.numero}</title>
    <style>
        * {
            margin: 0;
            padding: 0;
            box-sizing: border-box;
        }
        
        body {
            font-family: Arial, sans-serif;
            padding: 20px;
            color: #333;
        }
        
        .container {
            max-width: 21cm;
            margin: 0 auto;
        }
        
        .header {
            text-align: center;
            margin-bottom: 30px;
            border-bottom: 3px solid #2c3e50;
            padding-bottom: 20px;
        }
        
        .header h1 {
            font-size: 24px;
            color: #2c3e50;
            margin-bottom: 10px;
        }
        
        .header p {
            margin: 3px 0;
            font-size: 12px;
            color: #666;
        }
        
        .pedido-info {
            display: grid;
            grid-template-columns: 1fr 1fr;
            gap: 20px;
            margin-bottom: 30px;
        }
        
        .info-box {
            border: 1px solid #dee2e6;
            padding: 15px;
            border-radius: 5px;
        }
        
        .info-box h3 {
            font-size: 14px;
            color: #2c3e50;
            margin-bottom: 10px;
            border-bottom: 1px solid #dee2e6;
            padding-bottom: 5px;
        }
        
        .info-box p {
            margin: 5px 0;
            font-size: 13px;
        }
        
        table {
            width: 100%;
            border-collapse: collapse;
            margin-bottom: 20px;
        }
        
        table th,
        table td {
            border: 1px solid #333;
            padding: 8px;
            font-size: 12px;
        }
        
        table th {
            background: #f0f0f0;
            font-weight: bold;
            text-align: left;
        }
        
        .totais {
            float: right;
            width: 300px;
            border: 2px solid #2c3e50;
            padding: 15px;
            margin-top: 20px;
        }
        
        .totais-row {
            display: flex;
            justify-content: space-between;
            padding: 5px 0;
        }
        
        .totais-row.total {
            border-top: 2px solid #2c3e50;
            margin-top: 10px;
            padding-top: 10px;
            font-size: 16px;
            font-weight: bold;
        }
        
        .footer {
            clear: both;
            margin-top: 50px;
            padding-top: 20px;
            border-top: 1px solid #dee2e6;
            text-align: center;
            font-size: 10px;
            color: #666;
        }
        
        .assinatura {
            margin-top: 60px;
            text-align: center;
        }
        
        .assinatura-linha {
            border-top: 1px solid #333;
            width: 300px;
            margin: 0 auto 10px auto;
        }
        
        @media print {
            body {
                padding: 0;
            }
        }
    </style>
</head>
<body>
    <div class="container">
        <!-- Cabeçalho -->
        <div class="header">
            <h1>${dadosEmpresa.nome}</h1>
            <p>${dadosEmpresa.endereco}</p>
            <p>Tel: ${dadosEmpresa.telefone} | Email: ${dadosEmpresa.email}</p>
            <p>CNPJ: ${dadosEmpresa.cnpj}</p>
        </div>
        
        <!-- Informações do Pedido e Cliente -->
        <div class="pedido-info">
            <div class="info-box">
                <h3>DADOS DO PEDIDO</h3>
                <p><strong>Número:</strong> ${pedido.numero}</p>
                <p><strong>Data:</strong> ${formatDate(pedido.data)}</p>
                <p><strong>Status:</strong> ${statusLabel}</p>
                <p><strong>Emissão:</strong> ${new Date().toLocaleDateString('pt-BR')} ${new Date().toLocaleTimeString('pt-BR')}</p>
            </div>
            
            <div class="info-box">
                <h3>DADOS DO CLIENTE</h3>
                <p><strong>Nome:</strong> ${nomeCliente}</p>
                ${detalhesCliente}
            </div>
        </div>
        
        <!-- Itens do Pedido -->
        <h3 style="margin-bottom: 10px;">ITENS DO PEDIDO</h3>
        <table>
            <thead>
                <tr>
                    <th style="width: 40px;">#</th>
                    <th>Produto</th>
                    <th style="width: 120px; text-align: center;">Quantidade</th>
                    <th style="width: 100px; text-align: right;">Preço Unit.</th>
                    <th style="width: 100px; text-align: right;">Total</th>
                </tr>
            </thead>
            <tbody>
                ${htmlItens}
            </tbody>
        </table>
        
        <!-- Totais -->
        <div class="totais">
            <div class="totais-row">
                <span>Subtotal:</span>
                <span>${formatCurrency(pedido.subtotal)}</span>
            </div>
            <div class="totais-row">
                <span>Desconto:</span>
                <span style="color: #e74c3c;">${formatCurrency(pedido.desconto)}</span>
            </div>
            <div class="totais-row total">
                <span>TOTAL:</span>
                <span>${formatCurrency(pedido.total)}</span>
            </div>
        </div>
        
        <!-- Forma de Pagamento -->
        <div style="clear: both; margin-top: 30px;">
            <h3 style="margin-bottom: 10px;">FORMA DE PAGAMENTO</h3>
            <table>
                <thead>
                    <tr>
                        <th>Parcela</th>
                        <th>Valor</th>
                        <th>Vencimento</th>
                        <th>Tipo</th>
                        <th>Observação</th>
                    </tr>
                </thead>
                <tbody>
                    ${htmlPagamento}
                </tbody>
            </table>
        </div>
        
        <!-- Assinatura -->
        <div class="assinatura">
            <div class="assinatura-linha"></div>
            <p>Assinatura do Cliente</p>
        </div>
        
        <!-- Rodapé -->
        <div class="footer">
            <p>Este documento foi gerado eletronicamente pelo sistema SISWEB</p>
            <p>Impresso em: ${new Date().toLocaleDateString('pt-BR')} às ${new Date().toLocaleTimeString('pt-BR')}</p>
        </div>
    </div>
</body>
</html>
    `;
}

// Exportar funções globalmente
window.imprimirPedido = imprimirPedido;
window.gerarHTMLImpressaoPedido = gerarHTMLImpressaoPedido;
```

---

## 3. IMPLEMENTAÇÃO: Validação de Estoque

### 3.1 Função de Validação (adicionar/modificar em vendas.js)

```javascript
/**
 * Validar estoque antes de adicionar item
 * @param {string} produtoId - ID do produto
 * @param {number} quantidadeDesejada - Quantidade que se deseja adicionar
 * @returns {Object} { valido: boolean, mensagem: string, estoqueAtual: number }
 */
function validarEstoque(produtoId, quantidadeDesejada) {
    // Produtos manuais e de romaneio não têm controle de estoque
    if (produtoId.startsWith('manual_') || produtoId.startsWith('romaneio_')) {
        return { valido: true, mensagem: '', estoqueAtual: null };
    }
    
    const produto = window.produtos.find(p => p.id === produtoId);
    
    if (!produto) {
        return { 
            valido: false, 
            mensagem: 'Produto não encontrado', 
            estoqueAtual: 0 
        };
    }
    
    const estoqueAtual = produto.estoque || 0;
    
    // Verificar se já existe no carrinho
    const itemNoCarrinho = itensCarrinho.find(i => i.produtoId === produtoId);
    const quantidadeJaNoCarrinho = itemNoCarrinho ? itemNoCarrinho.quantidade : 0;
    
    const quantidadeTotal = quantidadeDesejada + quantidadeJaNoCarrinho;
    
    if (quantidadeTotal > estoqueAtual) {
        return {
            valido: false,
            mensagem: `Estoque insuficiente. Disponível: ${estoqueAtual} | No carrinho: ${quantidadeJaNoCarrinho} | Solicitado: ${quantidadeDesejada}`,
            estoqueAtual: estoqueAtual
        };
    }
    
    return {
        valido: true,
        mensagem: '',
        estoqueAtual: estoqueAtual
    };
}

/**
 * Modificar função adicionarItem() para incluir validação
 */
function adicionarItem() {
    const produtoId = document.getElementById('produtoSelect').value;
    const quantidade = parseFloat(document.getElementById('quantidade').value);
    const precoUnitario = parseCurrencyValue(document.getElementById('precoUnitario').value);
    
    if (!produtoId) {
        alert('Selecione um produto');
        return;
    }
    
    if (!quantidade || quantidade <= 0) {
        alert('Informe uma quantidade válida');
        return;
    }
    
    if (!precoUnitario || precoUnitario <= 0) {
        alert('Informe um preço válido');
        return;
    }
    
    // ✅ VALIDAÇÃO DE ESTOQUE
    const validacao = validarEstoque(produtoId, quantidade);
    
    if (!validacao.valido) {
        alert(`⚠️ ${validacao.mensagem}`);
        return;
    }
    
    // Se chegou aqui, pode adicionar
    const produto = window.produtos.find(p => p.id === produtoId);
    if (!produto) {
        alert('Produto não encontrado');
        return;
    }
    
    // Verificar se o item já existe no carrinho
    const itemExistente = itensCarrinho.find(item => item.produtoId === produtoId);
    
    if (itemExistente) {
        itemExistente.quantidade += quantidade;
        itemExistente.total = itemExistente.quantidade * itemExistente.precoUnitario;
    } else {
        const novoItem = {
            id: Date.now(),
            produtoId: produtoId,
            produtoNome: produto.nome,
            produtoCodigo: produto.codigo,
            quantidade: quantidade,
            precoUnitario: precoUnitario,
            total: quantidade * precoUnitario
        };
        
        itensCarrinho.push(novoItem);
    }
    
    // Limpar campos
    document.getElementById('produtoSelect').value = '';
    document.getElementById('quantidade').value = '';
    document.getElementById('precoUnitario').value = '';
    
    // Atualizar tabela e totais
    atualizarTabelaItens();
    atualizarTotais();
    
    // Feedback visual
    console.log(`✅ Item adicionado. Estoque restante: ${validacao.estoqueAtual - quantidade}`);
}

// Exportar função
window.validarEstoque = validarEstoque;
```

### 3.2 Indicador Visual de Estoque (adicionar em vendas.html)

```javascript
// Adicionar evento no select de produto para mostrar estoque
document.getElementById('produtoSelect').addEventListener('change', function() {
    const produtoId = this.value;
    if (produtoId) {
        const produto = window.produtos.find(p => p.id === produtoId);
        if (produto) {
            // Atualizar preço
            document.getElementById('precoUnitario').value = formatCurrency(produto.preco || 0);
            
            // ✅ MOSTRAR ESTOQUE DISPONÍVEL
            const quantidadeInput = document.getElementById('quantidade');
            let estoqueLabel = quantidadeInput.previousElementSibling;
            
            // Criar label se não existir
            if (!estoqueLabel || !estoqueLabel.classList.contains('estoque-info')) {
                estoqueLabel = document.createElement('small');
                estoqueLabel.className = 'estoque-info';
                estoqueLabel.style.cssText = 'display: block; margin-top: 3px; font-size: 0.85em;';
                quantidadeInput.parentNode.insertBefore(estoqueLabel, quantidadeInput.nextSibling);
            }
            
            const estoque = produto.estoque || 0;
            const cor = estoque > 10 ? '#28a745' : estoque > 0 ? '#ffc107' : '#dc3545';
            
            estoqueLabel.innerHTML = `
                <i class="fas fa-box"></i> 
                <span style="color: ${cor}; font-weight: bold;">
                    Estoque: ${formatNumber(estoque, 0)} ${produto.unidade}
                </span>
            `;
            
            atualizarTotais();
        }
    }
});
```

---

## 4. IMPLEMENTAÇÃO: Sistema de Toasts

### 4.1 CSS do Toast (adicionar em vendas.html)

```html
<style>
/* Sistema de Toasts/Notificações */
.toast-container {
    position: fixed;
    top: 20px;
    right: 20px;
    z-index: 9999;
    display: flex;
    flex-direction: column;
    gap: 10px;
}

.toast {
    min-width: 300px;
    max-width: 400px;
    padding: 15px 20px;
    border-radius: 8px;
    background: white;
    box-shadow: 0 4px 12px rgba(0,0,0,0.15);
    display: flex;
    align-items: center;
    gap: 12px;
    animation: slideIn 0.3s ease-out;
    position: relative;
}

.toast.success {
    border-left: 4px solid #28a745;
}

.toast.error {
    border-left: 4px solid #dc3545;
}

.toast.warning {
    border-left: 4px solid #ffc107;
}

.toast.info {
    border-left: 4px solid #17a2b8;
}

.toast-icon {
    font-size: 24px;
    flex-shrink: 0;
}

.toast.success .toast-icon {
    color: #28a745;
}

.toast.error .toast-icon {
    color: #dc3545;
}

.toast.warning .toast-icon {
    color: #ffc107;
}

.toast.info .toast-icon {
    color: #17a2b8;
}

.toast-content {
    flex: 1;
}

.toast-title {
    font-weight: bold;
    margin-bottom: 4px;
    font-size: 14px;
}

.toast-message {
    font-size: 13px;
    color: #666;
}

.toast-close {
    font-size: 20px;
    color: #999;
    cursor: pointer;
    background: none;
    border: none;
    padding: 0;
    margin-left: 10px;
    flex-shrink: 0;
}

.toast-close:hover {
    color: #333;
}

@keyframes slideIn {
    from {
        transform: translateX(400px);
        opacity: 0;
    }
    to {
        transform: translateX(0);
        opacity: 1;
    }
}

@keyframes slideOut {
    from {
        transform: translateX(0);
        opacity: 1;
    }
    to {
        transform: translateX(400px);
        opacity: 0;
    }
}

.toast.removing {
    animation: slideOut 0.3s ease-out forwards;
}

@media (max-width: 768px) {
    .toast-container {
        top: 10px;
        right: 10px;
        left: 10px;
    }
    
    .toast {
        min-width: auto;
        width: 100%;
    }
}
</style>
```

### 4.2 HTML do Container (adicionar antes do fechamento do body)

```html
<!-- Container de Toasts -->
<div class="toast-container" id="toastContainer"></div>
```

### 4.3 JavaScript do Toast (adicionar em vendas.js)

```javascript
/**
 * Sistema de Toasts/Notificações
 */
const ToastManager = {
    /**
     * Mostrar toast
     * @param {string} message - Mensagem principal
     * @param {string} type - Tipo: 'success', 'error', 'warning', 'info'
     * @param {string} title - Título opcional
     * @param {number} duration - Duração em ms (0 = não fecha automaticamente)
     */
    show(message, type = 'info', title = '', duration = 4000) {
        const container = document.getElementById('toastContainer');
        
        if (!container) {
            console.warn('Toast container não encontrado');
            return;
        }
        
        // Criar elemento do toast
        const toast = document.createElement('div');
        toast.className = `toast ${type}`;
        
        // Definir ícone baseado no tipo
        const icons = {
            success: 'fa-check-circle',
            error: 'fa-times-circle',
            warning: 'fa-exclamation-triangle',
            info: 'fa-info-circle'
        };
        
        // Definir título padrão baseado no tipo
        if (!title) {
            const titles = {
                success: 'Sucesso',
                error: 'Erro',
                warning: 'Atenção',
                info: 'Informação'
            };
            title = titles[type] || 'Notificação';
        }
        
        // Montar HTML
        toast.innerHTML = `
            <div class="toast-icon">
                <i class="fas ${icons[type] || icons.info}"></i>
            </div>
            <div class="toast-content">
                <div class="toast-title">${title}</div>
                <div class="toast-message">${message}</div>
            </div>
            <button class="toast-close" onclick="ToastManager.close(this.parentElement)">
                <i class="fas fa-times"></i>
            </button>
        `;
        
        // Adicionar ao container
        container.appendChild(toast);
        
        // Fechar automaticamente após duração
        if (duration > 0) {
            setTimeout(() => {
                this.close(toast);
            }, duration);
        }
        
        return toast;
    },
    
    /**
     * Fechar toast
     * @param {HTMLElement} toastElement - Elemento do toast
     */
    close(toastElement) {
        if (!toastElement) return;
        
        toastElement.classList.add('removing');
        
        setTimeout(() => {
            if (toastElement.parentNode) {
                toastElement.parentNode.removeChild(toastElement);
            }
        }, 300);
    },
    
    /**
     * Atalhos para tipos específicos
     */
    success(message, title, duration) {
        return this.show(message, 'success', title, duration);
    },
    
    error(message, title, duration) {
        return this.show(message, 'error', title, duration);
    },
    
    warning(message, title, duration) {
        return this.show(message, 'warning', title, duration);
    },
    
    info(message, title, duration) {
        return this.show(message, 'info', title, duration);
    }
};

// Exportar globalmente
window.ToastManager = ToastManager;
window.mostrarToast = ToastManager.show.bind(ToastManager);

// Exemplos de uso (substituir alerts existentes):
// alert('Pedido salvo com sucesso!'); 
// ↓ substituir por:
// ToastManager.success('Pedido salvo com sucesso!');

// alert('Erro ao salvar pedido: ' + error.message);
// ↓ substituir por:
// ToastManager.error('Erro ao salvar pedido: ' + error.message, 'Erro');
```

---

## 5. IMPLEMENTAÇÃO: Loading States

### 5.1 CSS do Loading (adicionar em vendas.html)

```html
<style>
/* Loading Overlay Global */
.loading-overlay {
    position: fixed;
    top: 0;
    left: 0;
    width: 100%;
    height: 100%;
    background: rgba(0, 0, 0, 0.7);
    display: none;
    justify-content: center;
    align-items: center;
    z-index: 99999;
}

.loading-overlay.active {
    display: flex;
}

.loading-content {
    background: white;
    padding: 30px;
    border-radius: 12px;
    text-align: center;
    box-shadow: 0 8px 32px rgba(0,0,0,0.3);
}

.loading-spinner {
    width: 50px;
    height: 50px;
    border: 5px solid #f3f3f3;
    border-top: 5px solid #3498db;
    border-radius: 50%;
    animation: spin 1s linear infinite;
    margin: 0 auto 15px auto;
}

@keyframes spin {
    0% { transform: rotate(0deg); }
    100% { transform: rotate(360deg); }
}

.loading-text {
    color: #333;
    font-size: 16px;
    margin-top: 10px;
}

/* Loading em Botões */
.btn.loading {
    position: relative;
    color: transparent !important;
    pointer-events: none;
}

.btn.loading::after {
    content: "";
    position: absolute;
    width: 16px;
    height: 16px;
    top: 50%;
    left: 50%;
    margin-left: -8px;
    margin-top: -8px;
    border: 2px solid transparent;
    border-radius: 50%;
    border-top-color: currentColor;
    animation: spin 0.6s linear infinite;
    color: white;
}

/* Skeleton Loading para Tabelas */
.skeleton-row {
    background: linear-gradient(90deg, #f0f0f0 25%, #e0e0e0 50%, #f0f0f0 75%);
    background-size: 200% 100%;
    animation: loading 1.5s ease-in-out infinite;
}

@keyframes loading {
    0% {
        background-position: 200% 0;
    }
    100% {
        background-position: -200% 0;
    }
}

.skeleton-text {
    height: 16px;
    background: #e0e0e0;
    border-radius: 4px;
    margin: 4px 0;
}
</style>
```

### 5.2 HTML do Loading (adicionar antes do fechamento do body)

```html
<!-- Loading Overlay Global -->
<div class="loading-overlay" id="loadingOverlay">
    <div class="loading-content">
        <div class="loading-spinner"></div>
        <div class="loading-text" id="loadingText">Carregando...</div>
    </div>
</div>
```

### 5.3 JavaScript do Loading (adicionar em vendas.js)

```javascript
/**
 * Sistema de Loading
 */
const LoadingManager = {
    /**
     * Mostrar loading global
     * @param {string} text - Texto a exibir
     */
    show(text = 'Carregando...') {
        const overlay = document.getElementById('loadingOverlay');
        const textElement = document.getElementById('loadingText');
        
        if (overlay) {
            if (textElement) {
                textElement.textContent = text;
            }
            overlay.classList.add('active');
        }
    },
    
    /**
     * Ocultar loading global
     */
    hide() {
        const overlay = document.getElementById('loadingOverlay');
        if (overlay) {
            overlay.classList.remove('active');
        }
    },
    
    /**
     * Adicionar loading a um botão
     * @param {HTMLButtonElement} button - Elemento do botão
     */
    addToButton(button) {
        if (button) {
            button.classList.add('loading');
            button.disabled = true;
        }
    },
    
    /**
     * Remover loading de um botão
     * @param {HTMLButtonElement} button - Elemento do botão
     */
    removeFromButton(button) {
        if (button) {
            button.classList.remove('loading');
            button.disabled = false;
        }
    }
};

// Exportar globalmente
window.LoadingManager = LoadingManager;

// Exemplo de uso em funções assíncronas:
async function salvarPedidoComLoading(event) {
    event.preventDefault();
    
    // Pegar botão de submit
    const submitButton = event.target.querySelector('button[type="submit"]');
    
    try {
        // Mostrar loading
        LoadingManager.addToButton(submitButton);
        LoadingManager.show('Salvando pedido...');
        
        // Salvar pedido (código existente)
        await salvarPedido(event);
        
        // Sucesso
        ToastManager.success('Pedido salvo com sucesso!');
        
    } catch (error) {
        // Erro
        ToastManager.error('Erro ao salvar pedido: ' + error.message, 'Erro');
        
    } finally {
        // Sempre remover loading
        LoadingManager.removeFromButton(submitButton);
        LoadingManager.hide();
    }
}
```

---

## 6. IMPLEMENTAÇÃO: Exportação Excel

### 6.1 Biblioteca SheetJS (adicionar em vendas.html)

```html
<!-- Adicionar no head antes dos outros scripts -->
<script src="https://cdnjs.cloudflare.com/ajax/libs/xlsx/0.18.5/xlsx.full.min.js"></script>
```

### 6.2 Função de Exportação (adicionar em vendas.js)

```javascript
/**
 * Exportar lista de pedidos para Excel
 */
function exportarPedidosExcel() {
    try {
        // Verificar se biblioteca está carregada
        if (typeof XLSX === 'undefined') {
            ToastManager.error('Biblioteca de exportação não carregada', 'Erro');
            return;
        }
        
        if (window.pedidos.length === 0) {
            ToastManager.warning('Nenhum pedido para exportar', 'Atenção');
            return;
        }
        
        // Preparar dados para exportação
        const dadosExportacao = window.pedidos.map(pedido => {
            const nomeCliente = pedido.cliente ? 
                (pedido.cliente.nome || pedido.cliente.name || 'Não informado') : 
                'Não informado';
            
            return {
                'Número': pedido.numero,
                'Data': formatDate(pedido.data),
                'Cliente': nomeCliente,
                'Subtotal': pedido.subtotal,
                'Desconto': pedido.desconto,
                'Total': pedido.total,
                'Status': getStatusLabel(pedido.status),
                'Qtd. Itens': pedido.itens.length,
                'Criado em': pedido.created ? new Date(pedido.created).toLocaleString('pt-BR') : ''
            };
        });
        
        // Criar workbook
        const ws = XLSX.utils.json_to_sheet(dadosExportacao);
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, "Pedidos");
        
        // Ajustar largura das colunas
        const wscols = [
            { wch: 15 }, // Número
            { wch: 12 }, // Data
            { wch: 30 }, // Cliente
            { wch: 12 }, // Subtotal
            { wch: 12 }, // Desconto
            { wch: 12 }, // Total
            { wch: 12 }, // Status
            { wch: 10 }, // Qtd. Itens
            { wch: 20 }  // Criado em
        ];
        ws['!cols'] = wscols;
        
        // Gerar arquivo
        const nomeArquivo = `pedidos_${new Date().toISOString().split('T')[0]}.xlsx`;
        XLSX.writeFile(wb, nomeArquivo);
        
        ToastManager.success(`Arquivo ${nomeArquivo} exportado com sucesso!`, 'Exportação');
        
    } catch (error) {
        console.error('Erro ao exportar Excel:', error);
        ToastManager.error('Erro ao exportar para Excel', 'Erro');
    }
}

/**
 * Exportar pedido individual detalhado para Excel
 */
function exportarPedidoDetalhadoExcel(pedidoId) {
    try {
        if (typeof XLSX === 'undefined') {
            ToastManager.error('Biblioteca de exportação não carregada', 'Erro');
            return;
        }
        
        const pedido = window.pedidos.find(p => p.id === pedidoId);
        
        if (!pedido) {
            ToastManager.error('Pedido não encontrado', 'Erro');
            return;
        }
        
        const nomeCliente = pedido.cliente ? 
            (pedido.cliente.nome || pedido.cliente.name || 'Não informado') : 
            'Não informado';
        
        // Criar workbook
        const wb = XLSX.utils.book_new();
        
        // Aba 1: Cabeçalho
        const dadosCabecalho = [
            ['DETALHES DO PEDIDO'],
            [],
            ['Número:', pedido.numero],
            ['Data:', formatDate(pedido.data)],
            ['Status:', getStatusLabel(pedido.status)],
            [],
            ['CLIENTE'],
            ['Nome:', nomeCliente],
            ['Email:', pedido.cliente?.email || ''],
            ['Telefone:', pedido.cliente?.telefone || ''],
            ['Endereço:', pedido.cliente?.endereco || '']
        ];
        
        const wsCabecalho = XLSX.utils.aoa_to_sheet(dadosCabecalho);
        XLSX.utils.book_append_sheet(wb, wsCabecalho, "Cabeçalho");
        
        // Aba 2: Itens
        const dadosItens = pedido.itens.map((item, index) => ({
            '#': index + 1,
            'Produto': item.produtoNome,
            'Código': item.produtoCodigo || '-',
            'Quantidade': item.quantidade,
            'Unidade': item.unidade || 'UN',
            'Preço Unitário': item.precoUnitario,
            'Total': item.total
        }));
        
        const wsItens = XLSX.utils.json_to_sheet(dadosItens);
        XLSX.utils.book_append_sheet(wb, wsItens, "Itens");
        
        // Aba 3: Pagamento
        if (pedido.contasReceber && pedido.contasReceber.length > 0) {
            const dadosPagamento = pedido.contasReceber.map((conta, index) => ({
                '#': index + 1,
                'Valor': conta.valor,
                'Vencimento': formatDate(conta.vencimento),
                'Tipo': getTipoContaLabel(conta.tipo),
                'Observação': conta.observacao || '',
                'Status': conta.status || 'pendente'
            }));
            
            const wsPagamento = XLSX.utils.json_to_sheet(dadosPagamento);
            XLSX.utils.book_append_sheet(wb, wsPagamento, "Pagamento");
        }
        
        // Gerar arquivo
        const nomeArquivo = `pedido_${pedido.numero}_${new Date().toISOString().split('T')[0]}.xlsx`;
        XLSX.writeFile(wb, nomeArquivo);
        
        ToastManager.success(`Arquivo ${nomeArquivo} exportado com sucesso!`, 'Exportação');
        
    } catch (error) {
        console.error('Erro ao exportar pedido:', error);
        ToastManager.error('Erro ao exportar pedido', 'Erro');
    }
}

// Exportar funções
window.exportarPedidosExcel = exportarPedidosExcel;
window.exportarPedidoDetalhadoExcel = exportarPedidoDetalhadoExcel;
```

### 6.3 Adicionar Botões de Exportação (em vendas.html)

```html
<!-- No modal de lista de pedidos, adicionar botão no header -->
<div class="modal-header">
    <h2>Lista de Pedidos</h2>
    <div style="display: flex; gap: 10px; align-items: center;">
        <button onclick="exportarPedidosExcel()" class="btn-success btn-small">
            <i class="fas fa-file-excel"></i> Exportar Excel
        </button>
        <span class="close" onclick="fecharModal('listaPedidosModal')">&times;</span>
    </div>
</div>

<!-- No modal de visualização, adicionar botão no footer -->
<button onclick="exportarPedidoDetalhadoExcel(window.pedidoVisualizando)" class="btn-success">
    <i class="fas fa-file-excel"></i> Exportar Excel
</button>
```

---

## 7. IMPLEMENTAÇÃO: Dashboard com Gráficos

### 7.1 Biblioteca Chart.js (já incluída no HTML)

O Chart.js provavelmente já está incluído na página financas.html, mas se não estiver em vendas.html:

```html
<!-- Adicionar no head -->
<script src="https://cdn.jsdelivr.net/npm/chart.js@4.4.0/dist/chart.umd.min.js"></script>
```

### 7.2 HTML do Dashboard (modificar tab de relatórios em vendas.html)

```html
<!-- Modificar a tab de relatórios para incluir dashboard -->
<div id="relatorios" class="tab-content">
    <!-- Dashboard Cards -->
    <div class="dashboard-cards" style="display: grid; grid-template-columns: repeat(auto-fit, minmax(250px, 1fr)); gap: 20px; margin-bottom: 30px;">
        <div class="dashboard-card" style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 20px; border-radius: 10px; text-align: center;">
            <h3 style="margin: 0 0 10px 0;"><i class="fas fa-shopping-cart"></i> Total de Pedidos</h3>
            <div style="font-size: 2.5em; font-weight: bold;" id="dashTotalPedidos">0</div>
        </div>
        
        <div class="dashboard-card" style="background: linear-gradient(135deg, #4facfe 0%, #00f2fe 100%); color: white; padding: 20px; border-radius: 10px; text-align: center;">
            <h3 style="margin: 0 0 10px 0;"><i class="fas fa-dollar-sign"></i> Valor Total</h3>
            <div style="font-size: 2.5em; font-weight: bold;" id="dashValorTotal">R$ 0,00</div>
        </div>
        
        <div class="dashboard-card" style="background: linear-gradient(135deg, #fa709a 0%, #fee140 100%); color: white; padding: 20px; border-radius: 10px; text-align: center;">
            <h3 style="margin: 0 0 10px 0;"><i class="fas fa-chart-line"></i> Ticket Médio</h3>
            <div style="font-size: 2.5em; font-weight: bold;" id="dashTicketMedio">R$ 0,00</div>
        </div>
        
        <div class="dashboard-card" style="background: linear-gradient(135deg, #a8edea 0%, #fed6e3 100%); color: #333; padding: 20px; border-radius: 10px; text-align: center;">
            <h3 style="margin: 0 0 10px 0;"><i class="fas fa-box"></i> Itens Vendidos</h3>
            <div style="font-size: 2.5em; font-weight: bold;" id="dashItensVendidos">0</div>
        </div>
    </div>
    
    <!-- Gráficos -->
    <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(400px, 1fr)); gap: 20px; margin-bottom: 30px;">
        <!-- Vendas por Período -->
        <div style="background: white; padding: 20px; border-radius: 10px; box-shadow: 0 2px 10px rgba(0,0,0,0.1);">
            <h3 style="margin: 0 0 15px 0;"><i class="fas fa-chart-area"></i> Vendas por Mês</h3>
            <canvas id="graficoVendasMes" width="400" height="250"></canvas>
        </div>
        
        <!-- Produtos Mais Vendidos -->
        <div style="background: white; padding: 20px; border-radius: 10px; box-shadow: 0 2px 10px rgba(0,0,0,0.1);">
            <h3 style="margin: 0 0 15px 0;"><i class="fas fa-star"></i> Top 5 Produtos</h3>
            <canvas id="graficoTopProdutos" width="400" height="250"></canvas>
        </div>
    </div>
    
    <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(400px, 1fr)); gap: 20px; margin-bottom: 30px;">
        <!-- Status dos Pedidos -->
        <div style="background: white; padding: 20px; border-radius: 10px; box-shadow: 0 2px 10px rgba(0,0,0,0.1);">
            <h3 style="margin: 0 0 15px 0;"><i class="fas fa-tasks"></i> Status dos Pedidos</h3>
            <canvas id="graficoStatusPedidos" width="400" height="250"></canvas>
        </div>
        
        <!-- Top Clientes -->
        <div style="background: white; padding: 20px; border-radius: 10px; box-shadow: 0 2px 10px rgba(0,0,0,0.1);">
            <h3 style="margin: 0 0 15px 0;"><i class="fas fa-users"></i> Top 5 Clientes</h3>
            <canvas id="graficoTopClientes" width="400" height="250"></canvas>
        </div>
    </div>
    
    <!-- Filtros de Período -->
    <div class="form-row" style="background: #f8f9fa; padding: 15px; border-radius: 8px;">
        <div class="form-group">
            <label for="periodoInicio">Período - Início:</label>
            <input type="date" id="periodoInicio">
        </div>
        <div class="form-group">
            <label for="periodoFim">Período - Fim:</label>
            <input type="date" id="periodoFim">
        </div>
        <div class="form-group">
            <label>&nbsp;</label>
            <button onclick="atualizarDashboard()" class="btn-primary">
                <i class="fas fa-sync-alt"></i> Atualizar
            </button>
        </div>
        <div class="form-group">
            <label>&nbsp;</label>
            <button onclick="exportarPedidosExcel()" class="btn-success">
                <i class="fas fa-file-excel"></i> Exportar Excel
            </button>
        </div>
    </div>
</div>
```

### 7.3 JavaScript do Dashboard (adicionar em vendas.js)

```javascript
/**
 * Atualizar dashboard com dados dos pedidos
 */
function atualizarDashboard() {
    try {
        const periodoInicio = document.getElementById('periodoInicio').value;
        const periodoFim = document.getElementById('periodoFim').value;
        
        // Filtrar pedidos por período
        let pedidosFiltrados = [...window.pedidos];
        
        if (periodoInicio && periodoFim) {
            const dataInicio = new Date(periodoInicio);
            const dataFim = new Date(periodoFim);
            
            pedidosFiltrados = pedidosFiltrados.filter(pedido => {
                const dataPedido = new Date(pedido.data);
                return dataPedido >= dataInicio && dataPedido <= dataFim;
            });
        }
        
        // Atualizar cards
        atualizarCardsDashboard(pedidosFiltrados);
        
        // Atualizar gráficos
        atualizarGraficoVendasMes(pedidosFiltrados);
        atualizarGraficoTopProdutos(pedidosFiltrados);
        atualizarGraficoStatusPedidos(pedidosFiltrados);
        atualizarGraficoTopClientes(pedidosFiltrados);
        
        ToastManager.success('Dashboard atualizado!', 'Sucesso', 2000);
        
    } catch (error) {
        console.error('Erro ao atualizar dashboard:', error);
        ToastManager.error('Erro ao atualizar dashboard', 'Erro');
    }
}

/**
 * Atualizar cards de resumo
 */
function atualizarCardsDashboard(pedidos) {
    const totalPedidos = pedidos.length;
    const valorTotal = pedidos.reduce((total, p) => total + p.total, 0);
    const ticketMedio = totalPedidos > 0 ? valorTotal / totalPedidos : 0;
    const itensVendidos = pedidos.reduce((total, p) => {
        return total + p.itens.reduce((sum, item) => sum + item.quantidade, 0);
    }, 0);
    
    document.getElementById('dashTotalPedidos').textContent = totalPedidos;
    document.getElementById('dashValorTotal').textContent = formatCurrency(valorTotal);
    document.getElementById('dashTicketMedio').textContent = formatCurrency(ticketMedio);
    document.getElementById('dashItensVendidos').textContent = Math.round(itensVendidos);
}

/**
 * Gráfico de vendas por mês
 */
let graficoVendasMesInstance = null;

function atualizarGraficoVendasMes(pedidos) {
    const ctx = document.getElementById('graficoVendasMes');
    if (!ctx) return;
    
    // Agrupar vendas por mês
    const vendasPorMes = {};
    
    pedidos.forEach(pedido => {
        const data = new Date(pedido.data);
        const mesAno = `${data.getMonth() + 1}/${data.getFullYear()}`;
        
        if (!vendasPorMes[mesAno]) {
            vendasPorMes[mesAno] = { total: 0, quantidade: 0 };
        }
        
        vendasPorMes[mesAno].total += pedido.total;
        vendasPorMes[mesAno].quantidade += 1;
    });
    
    // Ordenar por data
    const mesesOrdenados = Object.keys(vendasPorMes).sort((a, b) => {
        const [mesA, anoA] = a.split('/').map(Number);
        const [mesB, anoB] = b.split('/').map(Number);
        return new Date(anoA, mesA - 1) - new Date(anoB, mesB - 1);
    });
    
    const labels = mesesOrdenados;
    const valores = mesesOrdenados.map(mes => vendasPorMes[mes].total);
    const quantidades = mesesOrdenados.map(mes => vendasPorMes[mes].quantidade);
    
    // Destruir gráfico anterior se existir
    if (graficoVendasMesInstance) {
        graficoVendasMesInstance.destroy();
    }
    
    // Criar novo gráfico
    graficoVendasMesInstance = new Chart(ctx, {
        type: 'line',
        data: {
            labels: labels,
            datasets: [{
                label: 'Valor Total (R$)',
                data: valores,
                borderColor: 'rgb(75, 192, 192)',
                backgroundColor: 'rgba(75, 192, 192, 0.2)',
                tension: 0.1,
                yAxisID: 'y'
            }, {
                label: 'Quantidade de Pedidos',
                data: quantidades,
                borderColor: 'rgb(255, 99, 132)',
                backgroundColor: 'rgba(255, 99, 132, 0.2)',
                tension: 0.1,
                yAxisID: 'y1'
            }]
        },
        options: {
            responsive: true,
            interaction: {
                mode: 'index',
                intersect: false,
            },
            scales: {
                y: {
                    type: 'linear',
                    display: true,
                    position: 'left',
                    ticks: {
                        callback: function(value) {
                            return 'R$ ' + value.toLocaleString('pt-BR');
                        }
                    }
                },
                y1: {
                    type: 'linear',
                    display: true,
                    position: 'right',
                    grid: {
                        drawOnChartArea: false,
                    },
                }
            },
            plugins: {
                tooltip: {
                    callbacks: {
                        label: function(context) {
                            let label = context.dataset.label || '';
                            if (label) {
                                label += ': ';
                            }
                            if (context.datasetIndex === 0) {
                                label += formatCurrency(context.parsed.y);
                            } else {
                                label += context.parsed.y + ' pedidos';
                            }
                            return label;
                        }
                    }
                }
            }
        }
    });
}

/**
 * Gráfico de top produtos
 */
let graficoTopProdutosInstance = null;

function atualizarGraficoTopProdutos(pedidos) {
    const ctx = document.getElementById('graficoTopProdutos');
    if (!ctx) return;
    
    // Contar vendas por produto
    const produtosVendas = {};
    
    pedidos.forEach(pedido => {
        pedido.itens.forEach(item => {
            const nome = item.produtoNome;
            if (!produtosVendas[nome]) {
                produtosVendas[nome] = { quantidade: 0, valor: 0 };
            }
            produtosVendas[nome].quantidade += item.quantidade;
            produtosVendas[nome].valor += item.total;
        });
    });
    
    // Ordenar por valor e pegar top 5
    const top5 = Object.entries(produtosVendas)
        .sort((a, b) => b[1].valor - a[1].valor)
        .slice(0, 5);
    
    const labels = top5.map(([nome]) => nome);
    const valores = top5.map(([, dados]) => dados.valor);
    
    // Destruir gráfico anterior
    if (graficoTopProdutosInstance) {
        graficoTopProdutosInstance.destroy();
    }
    
    // Criar novo gráfico
    graficoTopProdutosInstance = new Chart(ctx, {
        type: 'bar',
        data: {
            labels: labels,
            datasets: [{
                label: 'Valor Vendido (R$)',
                data: valores,
                backgroundColor: [
                    'rgba(255, 99, 132, 0.7)',
                    'rgba(54, 162, 235, 0.7)',
                    'rgba(255, 206, 86, 0.7)',
                    'rgba(75, 192, 192, 0.7)',
                    'rgba(153, 102, 255, 0.7)'
                ],
                borderColor: [
                    'rgba(255, 99, 132, 1)',
                    'rgba(54, 162, 235, 1)',
                    'rgba(255, 206, 86, 1)',
                    'rgba(75, 192, 192, 1)',
                    'rgba(153, 102, 255, 1)'
                ],
                borderWidth: 1
            }]
        },
        options: {
            indexAxis: 'y',
            responsive: true,
            plugins: {
                legend: {
                    display: false
                },
                tooltip: {
                    callbacks: {
                        label: function(context) {
                            return formatCurrency(context.parsed.x);
                        }
                    }
                }
            },
            scales: {
                x: {
                    ticks: {
                        callback: function(value) {
                            return 'R$ ' + value.toLocaleString('pt-BR');
                        }
                    }
                }
            }
        }
    });
}

/**
 * Gráfico de status dos pedidos
 */
let graficoStatusPedidosInstance = null;

function atualizarGraficoStatusPedidos(pedidos) {
    const ctx = document.getElementById('graficoStatusPedidos');
    if (!ctx) return;
    
    // Contar por status
    const statusCount = {};
    pedidos.forEach(pedido => {
        const status = pedido.status;
        statusCount[status] = (statusCount[status] || 0) + 1;
    });
    
    const labels = Object.keys(statusCount).map(s => getStatusLabel(s));
    const valores = Object.values(statusCount);
    
    // Destruir gráfico anterior
    if (graficoStatusPedidosInstance) {
        graficoStatusPedidosInstance.destroy();
    }
    
    // Criar novo gráfico
    graficoStatusPedidosInstance = new Chart(ctx, {
        type: 'doughnut',
        data: {
            labels: labels,
            datasets: [{
                data: valores,
                backgroundColor: [
                    'rgba(255, 206, 86, 0.7)',
                    'rgba(75, 192, 192, 0.7)',
                    'rgba(54, 162, 235, 0.7)',
                    'rgba(255, 99, 132, 0.7)'
                ],
                borderWidth: 2
            }]
        },
        options: {
            responsive: true,
            plugins: {
                legend: {
                    position: 'bottom',
                }
            }
        }
    });
}

/**
 * Gráfico de top clientes
 */
let graficoTopClientesInstance = null;

function atualizarGraficoTopClientes(pedidos) {
    const ctx = document.getElementById('graficoTopClientes');
    if (!ctx) return;
    
    // Contar vendas por cliente
    const clientesVendas = {};
    
    pedidos.forEach(pedido => {
        const nomeCliente = pedido.cliente ? 
            (pedido.cliente.nome || pedido.cliente.name || 'Não informado') : 
            'Não informado';
        
        if (!clientesVendas[nomeCliente]) {
            clientesVendas[nomeCliente] = { quantidade: 0, valor: 0 };
        }
        clientesVendas[nomeCliente].quantidade += 1;
        clientesVendas[nomeCliente].valor += pedido.total;
    });
    
    // Ordenar por valor e pegar top 5
    const top5 = Object.entries(clientesVendas)
        .sort((a, b) => b[1].valor - a[1].valor)
        .slice(0, 5);
    
    const labels = top5.map(([nome]) => nome);
    const valores = top5.map(([, dados]) => dados.valor);
    
    // Destruir gráfico anterior
    if (graficoTopClientesInstance) {
        graficoTopClientesInstance.destroy();
    }
    
    // Criar novo gráfico
    graficoTopClientesInstance = new Chart(ctx, {
        type: 'bar',
        data: {
            labels: labels,
            datasets: [{
                label: 'Valor Total (R$)',
                data: valores,
                backgroundColor: 'rgba(54, 162, 235, 0.7)',
                borderColor: 'rgba(54, 162, 235, 1)',
                borderWidth: 1
            }]
        },
        options: {
            responsive: true,
            plugins: {
                legend: {
                    display: false
                },
                tooltip: {
                    callbacks: {
                        label: function(context) {
                            return formatCurrency(context.parsed.y);
                        }
                    }
                }
            },
            scales: {
                y: {
                    ticks: {
                        callback: function(value) {
                            return 'R$ ' + value.toLocaleString('pt-BR');
                        }
                    }
                }
            }
        }
    });
}

// Exportar funções
window.atualizarDashboard = atualizarDashboard;

// Carregar dashboard ao mudar para a tab de relatórios
document.addEventListener('DOMContentLoaded', function() {
    // Atualizar dashboard ao carregar página
    setTimeout(() => {
        atualizarDashboard();
    }, 500);
});
```

---

## 8. CORREÇÕES DE BUGS

### 8.1 Correção do Erro Linha 587

```javascript
// ❌ ANTES (vendas.js linha 587)
tbody.innerHTML = '<tr><td colspan="6" style="text-align: center;">Nenhum pedido encontrado</td></tr>';

// ✅ DEPOIS
tbody.innerHTML = '<tr><td colspan="6" style="text-align: center;">Nenhum pedido encontrado</td></tr>';
```

### 8.2 Corrigir Preço de Romaneio Hard-coded

```javascript
// ❌ ANTES (vendas.js linha 1393)
const precoPorM3 = 1500; // R$ 1.500,00 por m³

// ✅ DEPOIS - Criar configuração global no início do arquivo
const VendasConfig = {
    precoPorM3Padrao: 1500,
    diasVencimentoPadrao: 30,
    validarEstoque: true
};

// E usar nos cálculos:
const precoPorM3 = VendasConfig.precoPorM3Padrao;
```

### 8.3 Usar Redistribuição de Valores

```javascript
// Modificar função atualizarTotais() para usar redistribuição
function atualizarTotais() {
    const subtotal = itensCarrinho.reduce((total, item) => total + item.total, 0);
    const desconto = parseCurrencyValue(document.getElementById('desconto').value || '0');
    const totalGeral = subtotal - desconto;
    
    document.getElementById('subtotal').textContent = formatCurrency(subtotal);
    document.getElementById('totalGeral').textContent = formatCurrency(totalGeral);
    
    // ✅ REDISTRIBUIR VALORES SE HOUVER CONTAS
    if (contasReceber.length > 0) {
        redistribuirValoresContas();
        atualizarTabelaContasReceber();
        atualizarTotalContasReceber();
    } else {
        // Carregar valor total no campo de valor se não houver contas
        const contaValorInput = document.getElementById('contaValor');
        if (contaValorInput && contaValorInput.value === '') {
            contaValorInput.value = formatCurrency(totalGeral);
        }
    }
}
```

---

## 🎯 ORDEM DE IMPLEMENTAÇÃO SUGERIDA

### 1ª Prioridade (Crítico - 1 dia)
1. ✅ Implementar `visualizarPedido()`
2. ✅ Corrigir bugs conhecidos
3. ✅ Implementar sistema de toasts

### 2ª Prioridade (Importante - 2 dias)
1. ✅ Sistema de impressão
2. ✅ Validação de estoque
3. ✅ Loading states

### 3ª Prioridade (Útil - 2 dias)
1. ✅ Exportação Excel
2. ✅ Dashboard com gráficos

---

## 📚 RECURSOS ADICIONAIS

### Bibliotecas Recomendadas
- **Chart.js**: Gráficos
- **SheetJS (xlsx)**: Exportação Excel
- **jsPDF**: Exportação PDF
- **Intro.js**: Tours guiados

### Referências
- [Chart.js Docs](https://www.chartjs.org/docs/)
- [SheetJS Docs](https://docs.sheetjs.com/)
- [MDN Web Docs](https://developer.mozilla.org/)

---

**FIM DO DOCUMENTO**

*Este documento contém código pronto para implementação. Teste cada funcionalidade individualmente antes de integrar ao sistema principal.*

