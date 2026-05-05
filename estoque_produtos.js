/**
 * Módulo de Estoque de Produtos (Almoxarifado)
 * Integrado ao estoque.js principal
 */

let estoqueProdutos = [];
let paginaAtualProdutos = 1;
let produtosFiltrados = [];

async function carregarEstoqueProdutos() {
    const tbody = document.getElementById('produtosTable');
    if (!tbody) return;
    
    tbody.innerHTML = '<tr><td colspan="7" class="text-center"><i class="fas fa-spinner fa-spin"></i> Carregando estoque...</td></tr>';

    try {
        // Carregar dados do Firebase/Local
        estoqueProdutos = await getData('estoqueProdutos') || [];
        
        renderizarTabelaProdutos(estoqueProdutos);
        atualizarEstatisticasProdutos();
        prepararEntradaProdutos();
        
    } catch (error) {
        console.error("Erro ao carregar estoque de produtos:", error);
        tbody.innerHTML = '<tr><td colspan="7" class="text-center text-danger">Erro ao carregar dados.</td></tr>';
    }
}

function prepararEntradaProdutos() {
    const form = document.getElementById('entradaProdutoForm');
    const dataEl = document.getElementById('entradaProdutoData');
    const select = document.getElementById('entradaProdutoSelect');
    const nomeEl = document.getElementById('entradaProdutoNome');
    const unidadeEl = document.getElementById('entradaProdutoUnidade');
    const precoEl = document.getElementById('entradaProdutoPreco');

    if (dataEl && !dataEl.value) {
        dataEl.value = new Date().toISOString().split('T')[0];
    }

    if (select) {
        const prev = select.value;
        select.innerHTML = '<option value="">Novo produto</option>';
        estoqueProdutos.slice().sort((a,b) => (a.nome || '').localeCompare(b.nome || '')).forEach(p => {
            const opt = document.createElement('option');
            opt.value = String(p.id);
            opt.textContent = p.nome || p.id;
            select.appendChild(opt);
        });
        if (prev) select.value = prev;
    }

    if (form && !form.dataset.bound) {
        form.addEventListener('submit', registrarEntradaProduto);
        form.dataset.bound = '1';
    }

    if (select && !select.dataset.bound) {
        select.addEventListener('change', onEntradaProdutoSelectChange);
        select.dataset.bound = '1';
    }

    if (precoEl && !precoEl.dataset.bound) {
        precoEl.addEventListener('blur', function() {
            this.value = formatCurrency(parseCurrencyValue(this.value));
        });
        precoEl.dataset.bound = '1';
    }

    if (select && select.value) {
        onEntradaProdutoSelectChange();
    } else {
        if (nomeEl) nomeEl.disabled = false;
    }
}

function onEntradaProdutoSelectChange() {
    const select = document.getElementById('entradaProdutoSelect');
    const nomeEl = document.getElementById('entradaProdutoNome');
    const unidadeEl = document.getElementById('entradaProdutoUnidade');
    const precoEl = document.getElementById('entradaProdutoPreco');
    const saldoEl = document.getElementById('entradaProdutoSaldo');
    if (!select) return;
    const prodId = select.value;
    if (!prodId) {
        if (nomeEl) { nomeEl.value = ''; nomeEl.disabled = false; }
        if (unidadeEl) unidadeEl.value = '';
        if (precoEl) precoEl.value = '';
        if (saldoEl) saldoEl.textContent = '';
        return;
    }
    const prod = estoqueProdutos.find(p => String(p.id) === String(prodId));
    if (prod) {
        if (nomeEl) { nomeEl.value = prod.nome || ''; nomeEl.disabled = true; }
        if (unidadeEl) unidadeEl.value = prod.unidade || 'un';
        if (precoEl) precoEl.value = formatCurrency(prod.precoMedio || 0);
        if (saldoEl) {
            const qtd = formatNumber(prod.quantidade || 0, 2);
            const unidade = prod.unidade || 'un';
            const precoMedio = formatCurrency(prod.precoMedio || 0);
            saldoEl.textContent = `Saldo atual: ${qtd} ${unidade} | Preço médio: ${precoMedio}`;
        }
    }
}

function limparEntradaProdutoForm() {
    const form = document.getElementById('entradaProdutoForm');
    if (form) form.reset();
    const dataEl = document.getElementById('entradaProdutoData');
    if (dataEl) dataEl.value = new Date().toISOString().split('T')[0];
    const select = document.getElementById('entradaProdutoSelect');
    if (select) select.value = '';
    const nomeEl = document.getElementById('entradaProdutoNome');
    if (nomeEl) nomeEl.disabled = false;
    const saldoEl = document.getElementById('entradaProdutoSaldo');
    if (saldoEl) saldoEl.textContent = '';
}

async function registrarEntradaProduto(e) {
    e.preventDefault();
    const dataEl = document.getElementById('entradaProdutoData');
    const select = document.getElementById('entradaProdutoSelect');
    const nomeEl = document.getElementById('entradaProdutoNome');
    const unidadeEl = document.getElementById('entradaProdutoUnidade');
    const qtdEl = document.getElementById('entradaProdutoQtd');
    const precoEl = document.getElementById('entradaProdutoPreco');
    const docEl = document.getElementById('entradaProdutoDocumento');
    const obsEl = document.getElementById('entradaProdutoObs');

    const data = dataEl ? dataEl.value : '';
    const prodId = select ? select.value : '';
    const nome = (nomeEl ? nomeEl.value : '').trim();
    const unidade = (unidadeEl ? unidadeEl.value : '').trim() || 'un';
    const qtd = parseFloat(qtdEl ? qtdEl.value : 0) || 0;
    const precoUnit = parseCurrencyValue(precoEl ? precoEl.value : 0) || 0;
    const documento = (docEl ? docEl.value : '').trim();
    const obs = (obsEl ? obsEl.value : '').trim();

    if (!data || qtd <= 0) {
        alert('Informe data e quantidade válida.');
        return;
    }

    let produto = null;
    if (prodId) {
        produto = estoqueProdutos.find(p => String(p.id) === String(prodId));
    }
    if (!produto && nome) {
        produto = estoqueProdutos.find(p => String(p.nome || '').toLowerCase() === nome.toLowerCase());
    }

    if (!produto && !nome) {
        alert('Informe o produto.');
        return;
    }

    const nowIso = new Date().toISOString();
    if (!produto) {
        produto = {
            id: generateUniqueId('PROD'),
            nome: nome,
            unidade: unidade,
            quantidade: 0,
            precoMedio: 0,
            ultimaAtualizacao: nowIso
        };
        estoqueProdutos.push(produto);
    }

    const oldQtd = parseFloat(produto.quantidade || 0) || 0;
    const oldPreco = parseFloat(produto.precoMedio || 0) || 0;
    const effectivePreco = precoUnit > 0 ? precoUnit : oldPreco;
    const newQtd = oldQtd + qtd;
    const newPreco = newQtd > 0 ? ((oldQtd * oldPreco) + (qtd * effectivePreco)) / newQtd : 0;

    produto.quantidade = newQtd;
    produto.precoMedio = newPreco;
    produto.unidade = unidade;
    produto.ultimaAtualizacao = nowIso;
    produto.ultimoDocumento = documento || produto.ultimoDocumento;

    const mov = {
        id: generateUniqueId('MOV-ENTRADA'),
        data: new Date(data).toISOString(),
        tipo: 'entrada',
        origem: 'manual',
        produtoId: produto.id,
        produtoNome: produto.nome,
        quantidade: qtd,
        documento: documento || '',
        motivo: obs || '',
        usuario: 'sistema',
        saldoAtual: produto.quantidade,
        precoUnitario: precoUnit
    };

    try {
        const movsAntigas = await getData('movimentacoesProdutos') || [];
        const movsAtualizadas = [...movsAntigas, mov];
        await saveDataProdutos('estoqueProdutos', estoqueProdutos);
        await saveDataProdutos('movimentacoesProdutos', movsAtualizadas);
        alert('Entrada registrada com sucesso!');
        limparEntradaProdutoForm();
        carregarEstoqueProdutos();
    } catch (err) {
        console.error("Erro na entrada:", err);
        alert('Erro ao registrar entrada: ' + err.message);
    }
}

function renderizarTabelaProdutos(lista) {
    const tbody = document.getElementById('produtosTable');
    tbody.innerHTML = '';

    produtosFiltrados = Array.isArray(lista) ? lista.slice() : [];
    const resumoEl = document.getElementById('resumoProdutos');
    const totalQtd = produtosFiltrados.reduce((acc, p) => acc + (p.quantidade || 0), 0);
    const totalVal = produtosFiltrados.reduce((acc, p) => acc + ((p.quantidade || 0) * (p.precoMedio || 0)), 0);
    if (resumoEl) {
        resumoEl.innerHTML = `
            <div class="summary-row">
                <span>Total de Itens:</span>
                <span>${produtosFiltrados.length}</span>
            </div>
            <div class="summary-row">
                <span>Quantidade Total:</span>
                <span>${formatNumber(totalQtd, 2)}</span>
            </div>
            <div class="summary-row">
                <span>Valor Total:</span>
                <span>${formatCurrency(totalVal)}</span>
            </div>
        `;
    }

    if (lista.length === 0) {
        tbody.innerHTML = '<tr><td colspan="7" class="text-center">Nenhum produto em estoque.</td></tr>';
        if (typeof renderizarPaginacaoPadrao === 'function') {
            renderizarPaginacaoPadrao('paginacaoProdutos', 0, 1, 10, 'mudarPaginaProdutos');
        }
        return;
    }

    // Ordenar por nome
    lista.sort((a, b) => (a.nome || '').localeCompare(b.nome || ''));

    const itensPorPaginaProdutos = 10;
    const totalPaginas = Math.max(1, Math.ceil(lista.length / itensPorPaginaProdutos));
    if (paginaAtualProdutos > totalPaginas) paginaAtualProdutos = totalPaginas;
    if (paginaAtualProdutos < 1) paginaAtualProdutos = 1;
    const inicio = (paginaAtualProdutos - 1) * itensPorPaginaProdutos;
    const pagina = lista.slice(inicio, inicio + itensPorPaginaProdutos);

    pagina.forEach(prod => {
        const total = (prod.quantidade || 0) * (prod.precoMedio || 0);
        const dataFmt = prod.ultimaAtualizacao ? new Date(prod.ultimaAtualizacao).toLocaleDateString('pt-BR') : '-';
        
        const tr = document.createElement('tr');
        tr.innerHTML = `
            <td><strong>${prod.nome}</strong></td>
            <td>${prod.unidade || 'un'}</td>
            <td class="text-center">${formatNumber(prod.quantidade, 2)}</td>
            <td class="text-right">${formatCurrency(prod.precoMedio)}</td>
            <td class="text-right font-weight-bold">${formatCurrency(total)}</td>
            <td>${dataFmt}</td>
            <td class="text-center actions-cell">
                <button class="btn btn-secondary btn-small" onclick="abrirEditarProdutoAlmoxarifado('${String(prod.id || '').replace(/'/g, "\\'")}')" title="Editar">
                    <i class="fas fa-pen"></i>
                </button>
                <button class="btn btn-warning btn-small" onclick="abrirBaixaProduto('${prod.id}')" title="Baixa/Consumo">
                    <i class="fas fa-box-open"></i>
                </button>
            </td>
        `;
        tbody.appendChild(tr);
    });
    if (typeof renderizarPaginacaoPadrao === 'function') {
        renderizarPaginacaoPadrao('paginacaoProdutos', lista.length, paginaAtualProdutos, itensPorPaginaProdutos, 'mudarPaginaProdutos');
    }
}

function ensureEditarProdutoModal() {
    if (document.getElementById('modalEditarProdutoAlmox')) return;
    document.body.insertAdjacentHTML('beforeend', `
        <div id="modalEditarProdutoAlmox" class="modal" style="z-index: 2100;">
            <div class="modal-content" style="max-width: 680px;">
                <div class="modal-header">
                    <h2>Editar Produto</h2>
                    <span class="close" onclick="fecharModal('modalEditarProdutoAlmox')">&times;</span>
                </div>
                <div class="modal-body">
                    <form id="formEditarProdutoAlmox" onsubmit="salvarEditarProdutoAlmoxarifado(event)">
                        <input type="hidden" id="editProdId">
                        <div class="form-row">
                            <div class="form-group form-group-large">
                                <label for="editProdNome">Nome:</label>
                                <input type="text" id="editProdNome" required>
                            </div>
                            <div class="form-group form-group-small">
                                <label for="editProdUnidade">Unidade:</label>
                                <input type="text" id="editProdUnidade" placeholder="un, kg, cx">
                            </div>
                        </div>
                        <div class="form-row">
                            <div class="form-group form-group-small">
                                <label for="editProdPreco">Preço Médio:</label>
                                <input type="text" id="editProdPreco" placeholder="R$ 0,00">
                            </div>
                            <div class="form-group">
                                <label for="editProdQuantidade">Quantidade (visualização):</label>
                                <input type="number" id="editProdQuantidade" step="0.01" min="0" disabled>
                            </div>
                        </div>
                    </form>
                </div>
                <div class="modal-footer">
                    <button type="button" onclick="fecharModal('modalEditarProdutoAlmox')" class="btn btn-secondary"><i class="fas fa-times"></i> Cancelar</button>
                    <button type="submit" form="formEditarProdutoAlmox" class="btn btn-primary"><i class="fas fa-save"></i> Salvar</button>
                </div>
            </div>
        </div>
    `);

    const precoEl = document.getElementById('editProdPreco');
    if (precoEl && !precoEl.dataset.bound) {
        precoEl.addEventListener('blur', function() {
            this.value = formatCurrency(parseCurrencyValue(this.value));
        });
        precoEl.dataset.bound = '1';
    }
}

function abrirEditarProdutoAlmoxarifado(prodId) {
    const id = String(prodId || '').trim();
    if (!id) return;
    ensureEditarProdutoModal();
    const prod = (estoqueProdutos || []).find(p => String(p.id) === id);
    if (!prod) {
        alert('Produto não encontrado.');
        return;
    }
    document.getElementById('editProdId').value = id;
    document.getElementById('editProdNome').value = String(prod.nome || '').trim();
    document.getElementById('editProdUnidade').value = String(prod.unidade || '').trim();
    document.getElementById('editProdPreco').value = formatCurrency(prod.precoMedio || 0);
    document.getElementById('editProdQuantidade').value = Number(prod.quantidade || 0);
    document.getElementById('modalEditarProdutoAlmox').style.display = 'block';
}

async function salvarEditarProdutoAlmoxarifado(e) {
    if (e && typeof e.preventDefault === 'function') e.preventDefault();
    try {
        const id = String(document.getElementById('editProdId')?.value || '').trim();
        if (!id) return;
        const nome = String(document.getElementById('editProdNome')?.value || '').trim();
        if (!nome) {
            alert('Informe o nome do produto.');
            return;
        }
        const unidade = String(document.getElementById('editProdUnidade')?.value || '').trim() || 'un';
        const precoMedio = parseCurrencyValue(document.getElementById('editProdPreco')?.value || 0) || 0;
        const idx = (estoqueProdutos || []).findIndex(p => String(p.id) === id);
        if (idx < 0) {
            alert('Produto não encontrado.');
            return;
        }
        const nowIso = new Date().toISOString();
        estoqueProdutos[idx] = {
            ...estoqueProdutos[idx],
            nome,
            unidade,
            precoMedio,
            ultimaAtualizacao: nowIso
        };
        await saveDataProdutos('estoqueProdutos', estoqueProdutos);
        fecharModal('modalEditarProdutoAlmox');
        try { atualizarEstatisticasProdutos(); } catch (_) {}
        try { prepararEntradaProdutos(); } catch (_) {}
        try { filtrarProdutos(); } catch (_) {}
        alert('Produto atualizado com sucesso.');
    } catch (err) {
        console.error(err);
        alert('Erro ao salvar edição: ' + (err.message || err));
    }
}

function filtrarProdutos() {
    const termo = (document.getElementById('searchProdutos')?.value || '').toLowerCase();
    const filtroSaldo = (document.getElementById('produtosFiltroSaldo')?.value || '').trim();
    const filtrados = estoqueProdutos.filter(p => {
        const matchText = (p.nome || '').toLowerCase().includes(termo) || (p.id || '').toLowerCase().includes(termo);
        if (!matchText) return false;
        const qtd = Number(p.quantidade || 0);
        if (filtroSaldo === 'positivo') return qtd > 0;
        if (filtroSaldo === 'zero') return qtd <= 0;
        return true;
    });
    paginaAtualProdutos = 1;
    renderizarTabelaProdutos(filtrados);
}

function mudarPaginaProdutos(p) {
    paginaAtualProdutos = p;
    renderizarTabelaProdutos(produtosFiltrados);
}

function atualizarEstatisticasProdutos() {
    const totalItens = estoqueProdutos.length;
    const valorTotal = estoqueProdutos.reduce((acc, p) => acc + ((p.quantidade || 0) * (p.precoMedio || 0)), 0);
    
    document.getElementById('totalProdutos').textContent = totalItens;
    document.getElementById('valorTotalAlmoxarifado').textContent = formatCurrency(valorTotal);
}

// --- Funções de Baixa de Produtos ---

function abrirBaixaProduto(prodId = null) {
    const modal = document.getElementById('modalBaixaProduto');
    const select = document.getElementById('baixaProdutoSelect');
    const dataInput = document.getElementById('baixaProdutoData');
    
    // Resetar form
    document.getElementById('formBaixaProduto').reset();
    document.getElementById('infoSaldoProduto').textContent = '';
    
    // Data de hoje
    dataInput.value = new Date().toISOString().split('T')[0];
    
    // Preencher select
    select.innerHTML = '<option value="">Selecione...</option>';
    estoqueProdutos.sort((a,b) => a.nome.localeCompare(b.nome)).forEach(p => {
        const opt = document.createElement('option');
        opt.value = p.id;
        opt.textContent = p.nome;
        select.appendChild(opt);
    });
    
    if (prodId) {
        select.value = prodId;
        atualizarInfoProdutoBaixa();
    }
    
    modal.style.display = 'block';
}

function atualizarInfoProdutoBaixa() {
    const prodId = document.getElementById('baixaProdutoSelect').value;
    const info = document.getElementById('infoSaldoProduto');
    
    if (!prodId) {
        info.textContent = '';
        return;
    }
    
    const prod = estoqueProdutos.find(p => String(p.id) === String(prodId));
    if (prod) {
        info.textContent = `Saldo Atual: ${formatNumber(prod.quantidade, 2)} ${prod.unidade}`;
    }
}

async function confirmarBaixaProduto(e) {
    e.preventDefault();
    
    const prodId = document.getElementById('baixaProdutoSelect').value;
    const qtd = parseFloat(document.getElementById('baixaProdutoQtd').value);
    const motivo = document.getElementById('baixaProdutoMotivo').value;
    const data = document.getElementById('baixaProdutoData').value;
    const responsavel = (document.getElementById('baixaProdutoResponsavel')?.value || '').trim();
    
    if (!prodId || qtd <= 0 || !motivo) {
        alert('Preencha todos os campos corretamente.');
        return;
    }
    
    const prod = estoqueProdutos.find(p => String(p.id) === String(prodId));
    if (!prod) return;
    
    if (qtd > prod.quantidade) {
        alert(`Quantidade indisponível! Saldo atual: ${prod.quantidade}`);
        return;
    }
    
    if(!confirm(`Confirma a baixa de ${qtd} ${prod.unidade} de ${prod.nome}?`)) return;
    
    try {
        // Atualizar saldo localmente
        prod.quantidade -= qtd;
        prod.ultimaSaida = new Date().toISOString();
        
        // Registrar movimentação
        const mov = {
            id: generateUniqueId('MOV-SAIDA'),
            data: new Date(data).toISOString(),
            tipo: 'saida',
            origem: 'manual',
            produtoId: prod.id,
            produtoNome: prod.nome,
            quantidade: qtd,
            motivo: motivo,
            responsavel: responsavel,
            usuario: responsavel || 'sistema',
            saldoAtual: prod.quantidade
        };
        
        // Carregar movimentações existentes
        const movsAntigas = await getData('movimentacoesProdutos') || [];
        const movsAtualizadas = [...movsAntigas, mov];
        
        // Salvar tudo
        await saveDataProdutos('estoqueProdutos', estoqueProdutos);
        await saveDataProdutos('movimentacoesProdutos', movsAtualizadas);
        
        alert('Baixa realizada com sucesso!');
        fecharModal('modalBaixaProduto');
        carregarEstoqueProdutos(); // Recarregar tabela
        
    } catch (err) {
        console.error("Erro na baixa:", err);
        alert('Erro ao salvar baixa: ' + err.message);
    }
}

async function saveDataProdutos(key, data) {
    try {
        if (typeof saveDataAsync === 'function') {
            return await saveDataAsync(key, data);
        }
        localStorage.setItem(key, JSON.stringify(data));
        if (window.firebaseService && typeof window.firebaseService.saveToFirebase === 'function') {
            try { await window.firebaseService.saveToFirebase(key, null, data); } catch (_) {}
        }
        return true;
    } catch (e) {
        console.error(`Erro ao salvar ${key}:`, e);
        return false;
    }
}

// --- Funções de Relatórios de Produtos ---

async function gerarRelatorioProdutosSaldo() {
    try {
        const produtos = await getData('estoqueProdutos') || [];
        if (produtos.length === 0) return '<p>Nenhum produto em estoque.</p>';

        produtos.sort((a, b) => (a.nome || '').localeCompare(b.nome || ''));

        let totalQtd = 0;
        let totalValor = 0;

        let rows = produtos.map(p => {
            const val = (p.quantidade || 0) * (p.precoMedio || 0);
            totalQtd += (p.quantidade || 0);
            totalValor += val;
            return `
                <tr>
                    <td>${p.nome}</td>
                    <td>${p.unidade || 'un'}</td>
                    <td class="text-center">${formatNumber(p.quantidade, 2)}</td>
                    <td class="text-right">${formatCurrency(p.precoMedio)}</td>
                    <td class="text-right">${formatCurrency(val)}</td>
                </tr>
            `;
        }).join('');

        return `
            <div class="summary-box">
                <h4>Saldo Atual de Produtos (Almoxarifado)</h4>
                <div class="summary-row">
                    <span>Total de Itens Diferentes:</span>
                    <span>${produtos.length}</span>
                </div>
                <div class="summary-row">
                    <span>Valor Total em Estoque:</span>
                    <span>${formatCurrency(totalValor)}</span>
                </div>
            </div>
            <div class="table-container">
                <table class="table">
                    <colgroup>
                        <col class="nome">
                        <col class="unidade">
                        <col class="quantidade">
                        <col class="preco">
                        <col class="valor">
                    </colgroup>
                    <thead>
                        <tr>
                            <th>Produto</th>
                            <th>Unidade</th>
                            <th>Quantidade</th>
                            <th>Preço Médio</th>
                            <th>Total (R$)</th>
                        </tr>
                    </thead>
                    <tbody>${rows}</tbody>
                </table>
            </div>
        `;
    } catch (e) {
        console.error(e);
        return `<p class="text-danger">Erro ao gerar relatório: ${e.message}</p>`;
    }
}

async function gerarRelatorioProdutosMovimentacao(dataInicio, dataFim, options = {}) {
    if (!dataInicio || !dataFim) {
        return '<p>Informe o período para o relatório de movimentação.</p>';
    }

    try {
        const movimentos = await getData('movimentacoesProdutos') || [];
        const di = new Date(dataInicio);
        const df = new Date(dataFim); df.setHours(23, 59, 59, 999);

        let filtrados = movimentos.filter(m => {
            const d = new Date(m.data);
            return d >= di && d <= df;
        });

        const tipoFiltro = (options && options.tipo) ? String(options.tipo).trim() : '';
        if (tipoFiltro) {
            filtrados = filtrados.filter(m => String(m.tipo || '').toLowerCase() === tipoFiltro.toLowerCase());
        }

        if (filtrados.length === 0) return '<p>Nenhuma movimentação encontrada no período.</p>';

        filtrados.sort((a, b) => new Date(b.data) - new Date(a.data));

        let entradas = 0;
        let saidas = 0;
        
        const getResponsavel = (m) => {
            const r = (m && (m.responsavel || m.usuario || m.user || m.operador)) || '';
            return String(r || '').trim() || '-';
        };

        const renderTable = (items) => {
            const rows = (items || []).map(m => {
                if (m.tipo === 'entrada') entradas++;
                else if (m.tipo === 'saida') saidas++;
                const tipoLabel = String(m.tipo || '').toLowerCase() === 'entrada' ? 'ENTRADA' : 'SAÍDA';
                const tipoClass = String(m.tipo || '').toLowerCase() === 'entrada' ? 'alto' : 'baixo';
                const id = String(m.id || '');
                const estornado = !!(m.estornado || m.estornoId || m.estornadoEm);
                const estornarDisabled = estornado ? 'disabled' : '';
                const estornarTitle = estornado ? 'Já estornado' : 'Estornar';
                return `
                    <tr>
                        <td>${new Date(m.data).toLocaleDateString('pt-BR')}</td>
                        <td><span class="status-indicator status-${tipoClass}">${tipoLabel}</span></td>
                        <td>${m.produtoNome || m.produtoId || '-'}</td>
                        <td>${getResponsavel(m)}</td>
                        <td>${m.motivo || '-'}</td>
                        <td>${m.origem || 'manual'}</td>
                        <td class="text-right">${formatNumber(m.quantidade, 2)}</td>
                        <td class="text-center no-print">
                            <button type="button" class="btn btn-secondary btn-small" onclick="editarMovimentacaoProduto('${id.replace(/'/g, "\\'")}')" title="Editar"><i class="fas fa-pen"></i></button>
                            <button type="button" class="btn btn-warning btn-small" onclick="estornarMovimentacaoProduto('${id.replace(/'/g, "\\'")}')" title="${estornarTitle}" ${estornarDisabled}><i class="fas fa-undo"></i></button>
                        </td>
                    </tr>
                `;
            }).join('');

            return `
                <div class="table-container">
                    <table class="table">
                        <colgroup>
                            <col class="data">
                            <col class="codigo">
                            <col class="nome">
                            <col class="nome">
                            <col class="nome">
                            <col class="codigo">
                            <col class="quantidade">
                            <col class="acoes">
                        </colgroup>
                        <thead>
                            <tr>
                                <th>Data</th>
                                <th>Tipo</th>
                                <th>Produto</th>
                                <th>Responsável</th>
                                <th>Motivo/Obs</th>
                                <th>Origem</th>
                                <th>Quantidade</th>
                                <th class="no-print">Ações</th>
                            </tr>
                        </thead>
                        <tbody>${rows}</tbody>
                    </table>
                </div>
            `;
        };

        const agruparPorResponsavel = !!(options && options.agruparPorResponsavel);
        let tablesHtml = '';
        if (agruparPorResponsavel) {
            const groups = new Map();
            filtrados.forEach(m => {
                const key = getResponsavel(m);
                if (!groups.has(key)) groups.set(key, []);
                groups.get(key).push(m);
            });
            const groupKeys = Array.from(groups.keys()).sort((a,b) => a.localeCompare(b, 'pt-BR'));
            tablesHtml = groupKeys.map((k) => {
                const items = groups.get(k) || [];
                return `
                    <div class="summary-box" style="margin-top: 12px;">
                        <h4 style="margin:0;">Responsável: ${k}</h4>
                        <div class="summary-row"><span>Total:</span><span>${items.length}</span></div>
                    </div>
                    ${renderTable(items)}
                `;
            }).join('');
        } else {
            tablesHtml = renderTable(filtrados);
        }

        return `
            <div class="summary-box">
                <h4>Movimentação de Produtos (${new Date(dataInicio).toLocaleDateString('pt-BR')} a ${new Date(dataFim).toLocaleDateString('pt-BR')})</h4>
                <div class="summary-row">
                    <span>Total de Movimentações:</span>
                    <span>${filtrados.length}</span>
                </div>
                <div class="summary-row">
                    <span>Entradas:</span>
                    <span>${entradas}</span>
                </div>
                <div class="summary-row">
                    <span>Saídas:</span>
                    <span>${saidas}</span>
                </div>
            </div>
            ${tablesHtml}
        `;

    } catch (e) {
        console.error(e);
        return `<p class="text-danger">Erro ao gerar relatório: ${e.message}</p>`;
    }
}

// Expor globalmente
window.carregarEstoqueProdutos = carregarEstoqueProdutos;
window.renderizarTabelaProdutos = renderizarTabelaProdutos;
window.filtrarProdutos = filtrarProdutos;
window.abrirBaixaProduto = abrirBaixaProduto;
window.confirmarBaixaProduto = confirmarBaixaProduto;
window.atualizarInfoProdutoBaixa = atualizarInfoProdutoBaixa;
window.limparEntradaProdutoForm = limparEntradaProdutoForm;
window.registrarEntradaProduto = registrarEntradaProduto;
window.atualizarTabelaProdutos = carregarEstoqueProdutos;
window.gerarRelatorioProdutosSaldo = gerarRelatorioProdutosSaldo;
window.gerarRelatorioProdutosMovimentacao = gerarRelatorioProdutosMovimentacao;
window.mudarPaginaProdutos = mudarPaginaProdutos;
window.abrirEditarProdutoAlmoxarifado = abrirEditarProdutoAlmoxarifado;
window.salvarEditarProdutoAlmoxarifado = salvarEditarProdutoAlmoxarifado;

function ensureMovimentacaoEditModal() {
    if (document.getElementById('modalEditarMovProduto')) return;
    document.body.insertAdjacentHTML('beforeend', `
        <div id="modalEditarMovProduto" class="modal" style="z-index: 2100;">
            <div class="modal-content" style="max-width: 680px;">
                <div class="modal-header">
                    <h2>Editar Movimentação</h2>
                    <span class="close" onclick="fecharModal('modalEditarMovProduto')">&times;</span>
                </div>
                <div class="modal-body">
                    <form id="formEditarMovProduto">
                        <input type="hidden" id="editMovId">
                        <div class="form-row">
                            <div class="form-group">
                                <label for="editMovData">Data:</label>
                                <input type="date" id="editMovData" required>
                            </div>
                            <div class="form-group">
                                <label for="editMovOrigem">Origem:</label>
                                <input type="text" id="editMovOrigem" placeholder="manual, compra, estorno...">
                            </div>
                        </div>
                        <div class="form-row">
                            <div class="form-group">
                                <label for="editMovProduto">Produto:</label>
                                <input type="text" id="editMovProduto" disabled>
                            </div>
                        </div>
                        <div class="form-row">
                            <div class="form-group">
                                <label for="editMovResponsavel">Responsável:</label>
                                <input type="text" id="editMovResponsavel" placeholder="Nome do responsável" autocomplete="name">
                            </div>
                            <div class="form-group">
                                <label for="editMovQuantidade">Quantidade:</label>
                                <input type="number" id="editMovQuantidade" step="0.01" min="0" disabled>
                            </div>
                        </div>
                        <div class="form-group">
                            <label for="editMovMotivo">Motivo/Obs:</label>
                            <textarea id="editMovMotivo" rows="3" placeholder="Observações"></textarea>
                        </div>
                    </form>
                </div>
                <div class="modal-footer">
                    <button type="button" onclick="fecharModal('modalEditarMovProduto')" class="btn btn-secondary"><i class="fas fa-times"></i> Cancelar</button>
                    <button type="button" onclick="salvarEdicaoMovimentacaoProduto()" class="btn btn-primary"><i class="fas fa-save"></i> Salvar</button>
                </div>
            </div>
        </div>
    `);
}

async function editarMovimentacaoProduto(movId) {
    try {
        const id = String(movId || '').trim();
        if (!id) return;
        ensureMovimentacaoEditModal();
        const movs = await getData('movimentacoesProdutos') || [];
        const mov = (Array.isArray(movs) ? movs : Object.values(movs || {})).find(m => String(m.id) === id);
        if (!mov) { alert('Movimentação não encontrada.'); return; }
        const dataIso = mov.data ? new Date(mov.data).toISOString().split('T')[0] : new Date().toISOString().split('T')[0];
        document.getElementById('editMovId').value = id;
        document.getElementById('editMovData').value = dataIso;
        document.getElementById('editMovOrigem').value = String(mov.origem || '').trim();
        document.getElementById('editMovProduto').value = String(mov.produtoNome || mov.produtoId || '').trim();
        document.getElementById('editMovResponsavel').value = String(mov.responsavel || mov.usuario || '').trim();
        document.getElementById('editMovQuantidade').value = Number(mov.quantidade || 0);
        document.getElementById('editMovMotivo').value = String(mov.motivo || '').trim();
        const modal = document.getElementById('modalEditarMovProduto');
        modal.style.display = 'block';
    } catch (e) {
        console.error(e);
        alert('Erro ao abrir edição: ' + (e.message || e));
    }
}

async function salvarEdicaoMovimentacaoProduto() {
    try {
        const id = String(document.getElementById('editMovId')?.value || '').trim();
        if (!id) return;
        const dataVal = document.getElementById('editMovData')?.value || '';
        if (!dataVal) { alert('Informe a data.'); return; }
        const origem = String(document.getElementById('editMovOrigem')?.value || '').trim();
        const responsavel = String(document.getElementById('editMovResponsavel')?.value || '').trim();
        const motivo = String(document.getElementById('editMovMotivo')?.value || '').trim();
        const movsRaw = await getData('movimentacoesProdutos') || [];
        const movs = Array.isArray(movsRaw) ? movsRaw.slice() : Object.values(movsRaw || {});
        const idx = movs.findIndex(m => String(m.id) === id);
        if (idx < 0) { alert('Movimentação não encontrada.'); return; }
        const current = movs[idx] || {};
        movs[idx] = {
            ...current,
            data: new Date(dataVal).toISOString(),
            origem: origem || current.origem || 'manual',
            responsavel: responsavel || current.responsavel || '',
            usuario: responsavel || current.usuario || 'sistema',
            motivo: motivo
        };
        await saveDataProdutos('movimentacoesProdutos', movs);
        fecharModal('modalEditarMovProduto');
        const tabRel = document.getElementById('relatorios');
        if (tabRel && tabRel.classList.contains('active') && typeof window.gerarRelatorio === 'function') {
            window.gerarRelatorio();
        }
        alert('Movimentação atualizada.');
    } catch (e) {
        console.error(e);
        alert('Erro ao salvar: ' + (e.message || e));
    }
}

async function estornarMovimentacaoProduto(movId) {
    try {
        const id = String(movId || '').trim();
        if (!id) return;
        const movsRaw = await getData('movimentacoesProdutos') || [];
        const movs = Array.isArray(movsRaw) ? movsRaw.slice() : Object.values(movsRaw || {});
        const idx = movs.findIndex(m => String(m.id) === id);
        if (idx < 0) { alert('Movimentação não encontrada.'); return; }
        const mov = movs[idx] || {};
        const already = !!(mov.estornado || mov.estornoId || mov.estornadoEm);
        if (already) { alert('Esta movimentação já foi estornada.'); return; }
        const tipoOrig = String(mov.tipo || '').toLowerCase();
        if (tipoOrig !== 'entrada' && tipoOrig !== 'saida') { alert('Tipo de movimentação inválido.'); return; }
        const qtd = Number(mov.quantidade || 0);
        if (!(qtd > 0)) { alert('Quantidade inválida.'); return; }
        const prodId = String(mov.produtoId || '').trim();
        if (!prodId) { alert('Produto inválido.'); return; }
        if (!confirm('Confirma estornar esta movimentação? Isso irá gerar uma movimentação inversa e ajustar o estoque.')) return;

        const produtos = await getData('estoqueProdutos') || [];
        const produtosArr = Array.isArray(produtos) ? produtos.slice() : Object.values(produtos || {});
        const pIdx = produtosArr.findIndex(p => String(p.id) === prodId);
        if (pIdx < 0) { alert('Produto não encontrado no estoque.'); return; }

        const opposite = tipoOrig === 'entrada' ? 'saida' : 'entrada';
        const nowIso = new Date().toISOString();
        const novoId = generateUniqueId('MOV-ESTORNO');
        const responsavel = String(mov.responsavel || mov.usuario || '').trim();

        const prod = { ...(produtosArr[pIdx] || {}) };
        const currentQtd = Number(prod.quantidade || 0);
        const newQtd = opposite === 'entrada' ? (currentQtd + qtd) : (currentQtd - qtd);
        if (newQtd < 0) { alert('Estorno resultaria em estoque negativo. Operação cancelada.'); return; }
        prod.quantidade = newQtd;
        prod.ultimaAtualizacao = nowIso;
        produtosArr[pIdx] = prod;

        movs[idx] = { ...mov, estornado: true, estornadoEm: nowIso, estornoId: novoId };
        const novoMov = {
            id: novoId,
            data: nowIso,
            tipo: opposite,
            origem: 'estorno',
            produtoId: prodId,
            produtoNome: mov.produtoNome || prod.nome || prodId,
            quantidade: qtd,
            motivo: `Estorno de ${id}${mov.motivo ? ' - ' + mov.motivo : ''}`,
            responsavel: responsavel,
            usuario: responsavel || 'sistema',
            saldoAtual: newQtd,
            estornoDe: id
        };
        movs.push(novoMov);

        await saveDataProdutos('estoqueProdutos', produtosArr);
        await saveDataProdutos('movimentacoesProdutos', movs);

        if (typeof carregarEstoqueProdutos === 'function') {
            try { await carregarEstoqueProdutos(); } catch (_) {}
        }
        const tabRel = document.getElementById('relatorios');
        if (tabRel && tabRel.classList.contains('active') && typeof window.gerarRelatorio === 'function') {
            window.gerarRelatorio();
        }
        alert('Movimentação estornada com sucesso.');
    } catch (e) {
        console.error(e);
        alert('Erro ao estornar: ' + (e.message || e));
    }
}

window.editarMovimentacaoProduto = editarMovimentacaoProduto;
window.salvarEdicaoMovimentacaoProduto = salvarEdicaoMovimentacaoProduto;
window.estornarMovimentacaoProduto = estornarMovimentacaoProduto;
