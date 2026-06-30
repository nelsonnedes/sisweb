// compras.js - Compras/Estoque com Romaneio TORA

let romaneiosToraCache = [];
let romaneioSelecionadoCompra = null;
const itensCompra = [];

document.addEventListener('DOMContentLoaded', async () => {
    await carregarRomaneiosTora();
    await carregarFornecedoresCompra();
    await carregarFornecedoresInlineCompra();
    showTabCompra('pedido');
    alterarTipoProdutoCompra('romaneio');
});

function formatCurrency(value) {
    const n = parseFloat(value) || 0;
    return n.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

function formatNumber(value, decimals = 3) {
    const n = parseFloat(value) || 0;
    return n.toLocaleString('pt-BR', { minimumFractionDigits: decimals, maximumFractionDigits: decimals });
}

function formatDateLabel(romaneio) {
    const d = romaneio.dataEmissao || romaneio.data || romaneio.dataHora || romaneio.updatedAt || romaneio.createdAt || romaneio.timestamp;
    try {
        const dt = typeof d === 'string' ? new Date(d) : new Date(parseInt(d));
        if (!isNaN(dt.getTime())) return dt.toLocaleDateString('pt-BR');
    } catch (_) {}
    return 'S/Data';
}

function extractTimestamp(romaneio) {
    const cands = [
        romaneio?._metadata?.lastUpdated,
        romaneio.updatedAt,
        romaneio.updated,
        romaneio.lastModified,
        romaneio.dataEmissao,
        romaneio.data,
        romaneio.dataHora,
        romaneio.dataCriacao,
        romaneio.createdAt,
        romaneio.created,
        romaneio.timestamp
    ];
    for (const c of cands) {
        if (!c) continue;
        const t = typeof c === 'number' ? c : Date.parse(c);
        if (!isNaN(t)) return t;
    }
    // Fallback: tentar extrair de id (ex: TORA-<timestamp>)
    if (romaneio.id && /\d{10,}/.test(romaneio.id)) {
        const m = romaneio.id.match(/(\d{10,})/);
        if (m) return parseInt(m[1], 10);
    }
    return 0;
}

async function getDataFallback(key) {
    try {
        if (typeof window.getData === 'function') {
            const r = await window.getData(key);
            if (r) return r;
        }
    } catch (_) {}
    try {
        const storageKey = getStorageKey(key);
        const allowLegacy = storageKey === key;
        const raw = localStorage.getItem(storageKey) || (allowLegacy ? localStorage.getItem(key) : null);
        if (raw) return JSON.parse(raw);
    } catch (_) {}
    return [];
}

async function carregarRomaneiosTora() {
    const select = document.getElementById('romaneioToraSelect');
    if (!select) return;
    select.innerHTML = '<option value="">Selecione um romaneio</option>';

    const romaneios = await getDataFallback('romaneiosTora') || [];
    const ordenados = Array.isArray(romaneios) ? romaneios.slice() : [];
    ordenados.sort((a, b) => extractTimestamp(b) - extractTimestamp(a));
    romaneiosToraCache = ordenados;

    ordenados.forEach((romaneio, idx) => {
        const opt = document.createElement('option');
        opt.value = String(idx);
        const dataFmt = formatDateLabel(romaneio);

        // Nome do fornecedor
        let fornecedorNome = 'Fornecedor não informado';
        if (romaneio.fornecedor) {
            fornecedorNome = romaneio.fornecedor.nome || romaneio.fornecedor.name || romaneio.fornecedor;
        } else if (romaneio.cliente) {
            fornecedorNome = romaneio.cliente.nome || romaneio.cliente.name || romaneio.cliente;
        } else if (romaneio.clienteNome) {
            fornecedorNome = romaneio.clienteNome;
        }

        // Volume total
        let volumeTotal = '0,000';
        if (romaneio.volumeTotal) {
            volumeTotal = formatNumber(romaneio.volumeTotal);
        } else if (romaneio.totalVolume) {
            volumeTotal = formatNumber(romaneio.totalVolume);
        } else if (romaneio.totais && (romaneio.totais.volumeSerraria || romaneio.totais.volumeEstimado || romaneio.totais.volume)) {
            const v = romaneio.totais.volumeSerraria || romaneio.totais.volumeEstimado || romaneio.totais.volume;
            volumeTotal = formatNumber(v);
        } else {
            const itens = Array.isArray(romaneio.items) ? romaneio.items : (Array.isArray(romaneio.itens) ? romaneio.itens : []);
            const vol = itens.reduce((acc, item) => {
                const q = parseInt(item.quantidade) || 1;
                const vLiq = parseFloat(item.volumeLiquido || item.volumeSerraria);
                const vBru = parseFloat(item.volumeBruto || item.volumeEstimado);
                if (!isNaN(vLiq) && vLiq > 0) return acc + vLiq * q;
                if (!isNaN(vBru) && vBru > 0) return acc + vBru * q;
                const diametro = parseFloat(item.diametro || item.rodo) || 0;
                const comprimento = parseFloat(item.comprimento) || 0;
                const oco1 = parseFloat(item.oco1) || 0;
                const oco2 = parseFloat(item.oco2) || 0;
                const raio_m = (diametro / 100) / 2; // diametro em cm
                const comprimento_m = (comprimento / 100);
                const volBrutoM3 = Math.PI * Math.pow(raio_m, 2) * comprimento_m;
                const descontoOcoM3 = (oco1 / 100) * (oco2 / 100) * (comprimento / 100);
                const volLiquidoM3 = Math.max(0, volBrutoM3 - descontoOcoM3);
                return acc + volLiquidoM3 * q;
            }, 0);
            volumeTotal = formatNumber(vol);
        }

        // Valor total
        let totalMoeda = null;
        if (typeof romaneio.totalValue === 'number') {
            totalMoeda = formatCurrency(romaneio.totalValue);
        } else if (romaneio.totais) {
            if (typeof romaneio.totais.valor === 'number') totalMoeda = formatCurrency(romaneio.totais.valor);
            else if (typeof romaneio.totais.valorTotal === 'number') totalMoeda = formatCurrency(romaneio.totais.valorTotal);
        }

        opt.textContent = totalMoeda ? `${dataFmt} - ${fornecedorNome} - ${volumeTotal} m³ - ${totalMoeda}` : `${dataFmt} - ${fornecedorNome} - ${volumeTotal} m³`;
        select.appendChild(opt);
    });

    select.addEventListener('change', () => {
        const idx = parseInt(select.value);
        if (!isNaN(idx)) {
            romaneioSelecionadoCompra = romaneiosToraCache[idx];
            mostrarPreviewTora(romaneioSelecionadoCompra);
        } else {
            romaneioSelecionadoCompra = null;
            document.getElementById('previewTora').style.display = 'none';
        }
    });
}

function showTabCompra(tabId) {
    try {
        // Conteúdos
        document.querySelectorAll('.tab-content').forEach(el => {
            el.classList.remove('active');
            el.style.display = 'none';
        });
        const target = document.getElementById(tabId);
        if (target) {
            target.classList.add('active');
            target.style.display = '';
        }
        // Botões de aba
        document.querySelectorAll('.tabs .tab').forEach(btn => btn.classList.remove('active'));
        const map = {
            pedido: 0,
            fornecedores: 1,
            produtos: 2,
            relatorios: 3
        };
        const tabs = document.querySelectorAll('.tabs .tab');
        const idx = map[tabId];
        if (!isNaN(idx) && tabs[idx]) tabs[idx].classList.add('active');
    } catch (_) {}
}

// Expor para onclick no HTML
window.showTabCompra = showTabCompra;

// ===== Estado do Pedido de Compra =====
let fornecedorSelecionadoCompra = null;
let contasPagar = [];
let editandoPedidoCompraId = null;
let fornecedoresInlineCache = [];

function getStorageKey(key) {
    try {
        const svc = window.firebaseService || window.FirebaseService;
        if (svc && typeof svc.getCurrentTenantId === 'function') {
            const t = svc.getCurrentTenantId();
            if (t) return `company_${t}__${key}`;
        }
        if (svc && typeof svc.getTenantId === 'function') {
            const t = svc.getTenantId();
            if (t) return `company_${t}__${key}`;
        }
    } catch (_) {}
    try {
        if (window.appTenantId) return `company_${window.appTenantId}__${key}`;
        const raw = localStorage.getItem('company_info');
        if (raw) {
            const obj = JSON.parse(raw);
            const id = obj && (obj.companyId || obj.companyID || obj.tenantId || obj.id);
            if (id) return `company_${id}__${key}`;
        }
    } catch (_) {}
    return key;
}

async function carregarFornecedoresCompra() {
    try {
        const select = document.getElementById('fornecedorSelectCompra');
        if (!select) return;
        select.innerHTML = '<option value="">Selecione...</option>';
        let fornecedores = [];
        if (typeof window.getData === 'function') {
            try { fornecedores = await window.getData('fornecedores'); } catch (_) {}
        }
        if (!Array.isArray(fornecedores) || fornecedores.length === 0) {
            try {
                const storageKey = getStorageKey('fornecedores');
                const allowLegacy = storageKey === 'fornecedores';
                const raw = localStorage.getItem(storageKey) || (allowLegacy ? localStorage.getItem('fornecedores') : null);
                if (raw) fornecedores = JSON.parse(raw);
            } catch (_) {}
        }
        if (!Array.isArray(fornecedores)) fornecedores = [];
        fornecedores.forEach((f, idx) => {
            const opt = document.createElement('option');
            opt.value = String(idx);
            const nome = f.nome || f.name || f.razaoSocial || f.fantasia || 'Sem nome';
            opt.textContent = nome;
            select.appendChild(opt);
        });
    } catch (e) {
        console.error('Erro ao carregar fornecedores:', e);
    }
}

async function carregarFornecedoresInlineCompra() {
    try {
        const select = document.getElementById('fornecedorSelectInlineCompra');
        if (!select) return;
        select.innerHTML = '<option value="">Selecione...</option>';
        fornecedoresInlineCache = await getData('fornecedores');
        if (!Array.isArray(fornecedoresInlineCache) || fornecedoresInlineCache.length === 0) {
            const storageKey = getStorageKey('fornecedores');
            const allowLegacy = storageKey === 'fornecedores';
            const raw = localStorage.getItem(storageKey) || (allowLegacy ? localStorage.getItem('fornecedores') : null);
            fornecedoresInlineCache = raw ? JSON.parse(raw) : [];
        }
        (Array.isArray(fornecedoresInlineCache) ? fornecedoresInlineCache : []).forEach((f, idx) => {
            const opt = document.createElement('option');
            opt.value = String(idx);
            const nome = f.nome || f.name || f.razaoSocial || f.fantasia || 'Sem nome';
            opt.textContent = nome;
            opt.dataset.id = f.id || '';
            select.appendChild(opt);
        });
    } catch (e) {
        console.warn('Erro ao carregar fornecedores inline:', e);
    }
}

function selecionarFornecedorInlineCompra() {
    try {
        const select = document.getElementById('fornecedorSelectInlineCompra');
        const idx = parseInt(select?.value);
        if (!isNaN(idx)) {
            const f = Array.isArray(fornecedoresInlineCache) ? fornecedoresInlineCache[idx] : null;
            if (f) {
                preencherFornecedorNoForm(f);
                alert('Fornecedor selecionado para o pedido.');
            }
        }
    } catch (e) {
        console.warn('Erro ao selecionar fornecedor inline:', e);
    }
}

function selecionarFornecedorCompra() {
    const select = document.getElementById('fornecedorSelectCompra');
    const idx = parseInt(select?.value);
    if (!isNaN(idx) && romaneiosToraCache) {
        // Tenta buscar fornecedores de onde foi carregado
        let base = [];
        try {
            const storageKey = getStorageKey('fornecedores');
            const allowLegacy = storageKey === 'fornecedores';
            const raw = localStorage.getItem(storageKey) || (allowLegacy ? localStorage.getItem('fornecedores') : null);
            if (raw) base = JSON.parse(raw);
        } catch (_) {}
        if (!Array.isArray(base)) base = [];
        const f = base[idx];
        if (f) {
            fornecedorSelecionadoCompra = f;
            const input = document.getElementById('fornecedorCompra');
            if (input) input.value = f.nome || f.name || f.razaoSocial || f.fantasia || 'Fornecedor selecionado';
            alert('Fornecedor selecionado para o pedido.');
            showTabCompra('pedido');
        }
    }
}

function novoPedidoCompra() {
    const form = document.getElementById('pedidoCompraForm');
    if (form) form.style.display = '';
}

function cancelarPedidoCompra() {
    try {
        const form = document.getElementById('pedidoCompraForm');
        if (form) form.style.display = 'none';
        itensCompra.length = 0;
        contasPagar.length = 0;
        atualizarTabelaItensCompra();
        atualizarTotaisCompra();
        renderizarContasPagar();
        const lp = document.getElementById('listaPedidosCompra');
        if (lp) lp.style.display = 'none';
    } catch (e) {
        console.error('Erro ao cancelar pedido:', e);
    }
}

function alterarTipoProdutoCompra(tipo) {
    try {
        const secs = ['secaoProdutoManualCompra','secaoProdutoRomaneioCompra','secaoProdutoCadastradoCompra'];
        secs.forEach(id => { const el = document.getElementById(id); if (el) el.style.display = 'none'; });
        switch(tipo) {
            case 'manual':
                document.getElementById('secaoProdutoManualCompra')?.style && (document.getElementById('secaoProdutoManualCompra').style.display = '');
                break;
            case 'romaneio':
                document.getElementById('secaoProdutoRomaneioCompra')?.style && (document.getElementById('secaoProdutoRomaneioCompra').style.display = '');
                break;
            case 'cadastrado':
                document.getElementById('secaoProdutoCadastradoCompra')?.style && (document.getElementById('secaoProdutoCadastradoCompra').style.display = '');
                break;
        }
    } catch (e) {
        console.error('Erro ao alternar tipo de produto:', e);
    }
}

function extrairResumoTora(romaneio) {
    const itens = Array.isArray(romaneio?.items) ? romaneio.items : (Array.isArray(romaneio?.itens) ? romaneio.itens : []);
    const resumo = {};
    itens.forEach(item => {
        const especie = item.especie || 'Não especificada';
        const q = parseInt(item.quantidade) || 1;
        const preco = parseFloat(item.preco || item.precoUnitario) || 0;
        let v = parseFloat(item.volumeLiquido || item.volumeSerraria);
        if (!(v > 0)) v = parseFloat(item.volumeBruto || item.volumeEstimado) || 0;
        if (!(v > 0)) {
            const diametro = parseFloat(item.diametro || item.rodo) || 0;
            const comprimento = parseFloat(item.comprimento) || 0;
            const oco1 = parseFloat(item.oco1) || 0;
            const oco2 = parseFloat(item.oco2) || 0;
            const raio_m = (diametro / 100) / 2;
            const comprimento_m = (comprimento / 100);
            const volBrutoM3 = Math.PI * Math.pow(raio_m, 2) * comprimento_m;
            const descontoOcoM3 = (oco1 / 100) * (oco2 / 100) * (comprimento / 100);
            v = Math.max(0, volBrutoM3 - descontoOcoM3);
        }
        const volTotal = v * q;
        const valTotal = volTotal * preco;
        if (!resumo[especie]) resumo[especie] = { volume: 0, valorTotal: 0 };
        resumo[especie].volume += volTotal;
        resumo[especie].valorTotal += valTotal;
    });
    // Preço médio ponderado
    Object.keys(resumo).forEach(esp => {
        const r = resumo[esp];
        r.precoUnitario = r.volume > 0 ? (r.valorTotal / r.volume) : 0;
    });
    return resumo;
}

function mostrarPreviewTora(romaneio) {
    const container = document.getElementById('listaTora');
    const preview = document.getElementById('previewTora');
    if (!container || !preview) return;
    const resumo = extrairResumoTora(romaneio);
    let html = '';
    if (Object.keys(resumo).length === 0) {
        html = '<p style="color:#666;font-style:italic;">Nenhum item válido encontrado no romaneio selecionado.</p>';
    } else {
        html = '<div style="display:grid;gap:10px;">';
        Object.keys(resumo).forEach(especie => {
            const r = resumo[especie];
            html += `<div style="border:1px solid #ddd;padding:10px;border-radius:4px;background:#fff;">`;
            html += `<h5 style="margin:0 0 8px 0;color:#2c3e50;">${especie}</h5>`;
            html += `<div style="display:flex;justify-content:space-between;">`;
            html += `<span style="color:#666;">Vol: ${formatNumber(r.volume)} m³</span>`;
            if (r.precoUnitario > 0) {
                html += `<span style="color:#27ae60;font-weight:600;">${formatCurrency(r.precoUnitario)} por m³</span>`;
            } else {
                html += `<span style="color:#e74c3c;">Sem preço</span>`;
            }
            html += `</div>`;
            html += `</div>`;
        });
        html += '</div>';
    }
    container.innerHTML = html;
    preview.style.display = 'block';
}

function adicionarItensRomaneioCompra() {
    if (!romaneioSelecionadoCompra) {
        alert('Selecione um romaneio TORA primeiro.');
        return;
    }
    const resumo = extrairResumoTora(romaneioSelecionadoCompra);
    if (Object.keys(resumo).length === 0) {
        alert('Nenhum item válido encontrado no romaneio selecionado.');
        return;
    }

    Object.keys(resumo).forEach(especie => {
        const r = resumo[especie];
        const preco = r.precoUnitario || 0;
        const item = {
            id: Date.now() + Math.random(),
            produtoNome: `${especie} - TORA`,
            quantidade: r.volume,
            precoUnitario: preco,
            total: r.volume * preco
        };
        itensCompra.push(item);
    });
    atualizarTabelaItensCompra();
    atualizarTotaisCompra();
}

function atualizarTabelaItensCompra() {
    const tbody = document.querySelector('#comprasItensTable tbody');
    if (!tbody) return;
    tbody.innerHTML = '';
    itensCompra.forEach(item => {
        const tr = document.createElement('tr');
        tr.innerHTML = `
            <td>${item.produtoNome}</td>
            <td>${formatNumber(item.quantidade)}</td>
            <td>${formatCurrency(item.precoUnitario)}</td>
            <td>${formatCurrency(item.total)}</td>
            <td class="no-print"><button type="button" onclick="removerItemCompra(${item.id})">Remover</button></td>
        `;
        tbody.appendChild(tr);
    });
}

function atualizarTotaisCompra() {
    const total = itensCompra.reduce((acc, i) => acc + (parseFloat(i.total) || 0), 0);
    const el = document.getElementById('totalCompras');
    if (el) el.textContent = formatCurrency(total);
}

function removerItemCompra(id) {
    const idx = itensCompra.findIndex(i => i.id === id);
    if (idx !== -1) {
        itensCompra.splice(idx, 1);
        atualizarTabelaItensCompra();
        atualizarTotaisCompra();
    }
}

function parseCurrencySimple(str) {
    if (typeof str === 'number') return str;
    if (!str) return 0;
    const s = String(str).replace(/[^0-9,.-]/g, '').replace('.', '').replace(',', '.');
    const n = parseFloat(s);
    return isNaN(n) ? 0 : n;
}

function adicionarItemManualCompra() {
    try {
        const nome = document.getElementById('produtoManualNome')?.value || '';
        const qtd = parseFloat(document.getElementById('produtoManualQtd')?.value) || 0;
        const precoStr = document.getElementById('produtoManualPreco')?.value || '0';
        const preco = parseCurrencySimple(precoStr);
        if (!nome || !(qtd > 0)) {
            alert('Informe produto e quantidade válida.');
            return;
        }
        const item = {
            id: Date.now() + Math.random(),
            produtoNome: nome,
            quantidade: qtd,
            precoUnitario: preco,
            total: qtd * preco
        };
        itensCompra.push(item);
        atualizarTabelaItensCompra();
        atualizarTotaisCompra();
        alert('Item adicionado ao pedido.');
    } catch (e) {
        console.error('Erro ao adicionar item manual:', e);
        alert('Falha ao adicionar item.');
    }
}

function adicionarContaPagar() {
    try {
        const valor = parseCurrencySimple(document.getElementById('contaValor')?.value || '0');
        const dias = parseInt(document.getElementById('contaDias')?.value) || 0;
        let vencStr = document.getElementById('contaVencimento')?.value || '';
        const tipo = document.getElementById('contaTipo')?.value || 'a_prazo';
        const obs = document.getElementById('contaObservacao')?.value || '';
        if (!(valor > 0)) { alert('Informe um valor válido.'); return; }
        let venc = vencStr ? new Date(vencStr) : null;
        if (!venc && (dias > 0)) {
            const hoje = new Date();
            venc = new Date(hoje.getFullYear(), hoje.getMonth(), hoje.getDate() + dias);
            vencStr = formatISODateLocal(venc);
            const vEl = document.getElementById('contaVencimento');
            if (vEl) vEl.value = vencStr;
        }
        const conta = { valor, dias, vencimento: vencStr || null, tipo, observacao: obs };
        contasPagar.push(conta);
        renderizarContasPagar();
    } catch (e) {
        console.error('Erro ao adicionar conta a pagar:', e);
        alert('Falha ao adicionar conta.');
    }
}

function renderizarContasPagar() {
    const tbody = document.getElementById('contasPagarTable');
    if (!tbody) return;
    tbody.innerHTML = '';
    if (!Array.isArray(contasPagar) || contasPagar.length === 0) {
        tbody.innerHTML = '<tr><td colspan="6" style="text-align:center;color:#666;">Nenhuma conta adicionada</td></tr>';
        document.getElementById('totalContasPagar')?.textContent && (document.getElementById('totalContasPagar').textContent = 'R$ 0,00');
        return;
    }
    let total = 0;
    contasPagar.forEach((c, idx) => {
        total += (parseFloat(c.valor) || 0);
        const tr = document.createElement('tr');
        tr.innerHTML = `
            <td>${formatCurrency(c.valor)}</td>
            <td>${c.dias || '-'}</td>
            <td>${c.vencimento || '-'}</td>
            <td>${c.tipo || '-'}</td>
            <td>${c.observacao || '-'}</td>
            <td class="no-print"><button type="button" onclick="removerContaPagar(${idx})">Remover</button></td>
        `;
        tbody.appendChild(tr);
    });
    const totalEl = document.getElementById('totalContasPagar');
    if (totalEl) totalEl.textContent = formatCurrency(total);
}

function removerContaPagar(index) {
    try {
        if (index >= 0 && index < contasPagar.length) {
            contasPagar.splice(index, 1);
            renderizarContasPagar();
        }
    } catch (e) {
        console.error('Erro ao remover conta:', e);
    }
}

async function salvarPedidoCompra() {
    try {
        const dataCompra = document.getElementById('dataCompra')?.value || formatISODateLocal(new Date());
        const fornecedor = fornecedorSelecionadoCompra || (document.getElementById('fornecedorCompra')?.value || null);
        const status = document.getElementById('statusCompra')?.value || 'rascunho';
        const subtotal = itensCompra.reduce((acc, i) => acc + (parseFloat(i.total)||0), 0);
        const pedido = {
            id: editandoPedidoCompraId ? editandoPedidoCompraId : ('PC-' + Date.now()),
            data: dataCompra,
            fornecedor,
            itens: itensCompra.slice(),
            subtotal,
            contasPagar: contasPagar.slice(),
            origem: 'compras',
            created: new Date().toISOString(),
            status
        };
        // ✅ Validações de negócio
        if (!validarPedidoCompra(pedido)) {
            return;
        }

        // Salvar em 'compras' (coleção de pedidos de compra)
        const compras = await getData('compras') || [];
        let comprasAtualizadas = Array.isArray(compras) ? compras.slice() : [];
        if (editandoPedidoCompraId) {
            const idx = comprasAtualizadas.findIndex(p => String(p.id) === String(editandoPedidoCompraId));
            if (idx !== -1) comprasAtualizadas[idx] = pedido; else comprasAtualizadas.push(pedido);
        } else {
            comprasAtualizadas.push(pedido);
        }
        await saveData('compras', comprasAtualizadas);

        // Gerar/Remover contas no financeiro conforme status
        if (status === 'cancelado') {
            await removerContasPagarDoPedido(pedido.id);
            await removerMovimentosEstoqueDoPedido(pedido.id);
        } else {
            if (editandoPedidoCompraId) { await removerContasPagarDoPedido(editandoPedidoCompraId); }
            await gerarContasPagarFinanceiro(pedido);
        }

        // Registrar movimentação de estoque para pedidos confirmados
        if (status === 'confirmado') {
            await registrarEntradaEstoque(pedido);
        }

        alert(editandoPedidoCompraId ? 'Pedido de compra atualizado.' : 'Pedido de compra salvo.');
        editandoPedidoCompraId = null;
        cancelarPedidoCompra();
    } catch (e) {
        console.error('Erro ao salvar pedido de compra:', e);
        alert('Falha ao salvar pedido.');
    }
}

function validarPedidoCompra(pedido) {
    // Deve ter pelo menos um item
    if (!Array.isArray(pedido.itens) || pedido.itens.length === 0) {
        alert('Adicione ao menos um item ao pedido antes de salvar.');
        return false;
    }
    // Fornecedor obrigatório
    const fornecedorNome = pedido.fornecedor?.nome || pedido.fornecedor?.name || pedido.fornecedor?.fantasia || pedido.fornecedor?.razaoSocial || (typeof pedido.fornecedor === 'string' ? pedido.fornecedor : '');
    if (!fornecedorNome) {
        alert('Selecione/aplique um fornecedor ao pedido antes de salvar.');
        return false;
    }
    // Para confirmados, é obrigatório ao menos uma conta com vencimento
    if (String(pedido.status).toLowerCase() === 'confirmado') {
        const contas = Array.isArray(pedido.contasPagar) ? pedido.contasPagar : [];
        const validas = contas.filter(c => (parseCurrencySimple(c.valor || 0) > 0) && !!(c.vencimento || '').trim());
        if (validas.length === 0) {
            alert('Para confirmar o pedido, inclua ao menos uma conta com valor e vencimento.');
            return false;
        }
    }
    // Cancelado pode não gerar financeiro/estoque
    return true;
}

async function registrarEntradaEstoque(pedido) {
    try {
        const movs = await getData('estoqueComprasMov') || [];
        const atualizadas = Array.isArray(movs) ? movs.slice() : [];
        const totalVolume = (pedido.itens || []).reduce((acc, i) => acc + (parseFloat(i.quantidade) || 0), 0);
        const movimento = {
            id: 'EM-' + Date.now(),
            data: formatISODateLocal(new Date()),
            origem: 'compras',
            origemId: pedido.id,
            fornecedorId: pedido.fornecedor?.id || null,
            fornecedorNome: pedido.fornecedor?.nome || pedido.fornecedor?.fantasia || pedido.fornecedor?.razaoSocial || (typeof pedido.fornecedor === 'string' ? pedido.fornecedor : ''),
            tipo: 'entrada',
            totalVolume,
            totalValor: pedido.subtotal || 0,
            itens: (pedido.itens || []).map(i => ({ produto: i.produtoNome, quantidade: i.quantidade, precoUnitario: i.precoUnitario, total: i.total }))
        };
        atualizadas.push(movimento);
        await saveData('estoqueComprasMov', atualizadas);
        console.log(`✅ Entrada de estoque registrada para pedido ${pedido.id}`);
    } catch (e) {
        console.warn('⚠️ Falha ao registrar entrada de estoque:', e);
    }
}

async function removerMovimentosEstoqueDoPedido(pedidoId) {
    try {
        const movs = await getData('estoqueComprasMov') || [];
        const atualizadas = Array.isArray(movs) ? movs.filter(m => String(m.origem) !== 'compras' || String(m.origemId) !== String(pedidoId)) : [];
        await saveData('estoqueComprasMov', atualizadas);
        console.log(`✅ Movimentos de estoque removidos para pedido ${pedidoId}`);
    } catch (e) {
        console.warn('⚠️ Falha ao remover movimentos de estoque do pedido:', e);
    }
}

async function gerarContasPagarFinanceiro(pedido) {
    try {
        const contasFinanceiro = await getData('financas/pagar') || [];
        const lista = Array.isArray(contasFinanceiro) ? contasFinanceiro.slice() : [];
        const fornecedorNome = pedido.fornecedor?.nome || pedido.fornecedor?.name || pedido.fornecedor?.fantasia || pedido.fornecedor?.razaoSocial || (typeof pedido.fornecedor === 'string' ? pedido.fornecedor : 'Fornecedor');
        const fornecedorId = pedido.fornecedor?.id || pedido.fornecedorId || null;

        (pedido.contasPagar || []).forEach((conta, idx) => {
            const dataVencimento = conta.vencimento || null;
            const valor = parseCurrencySimple(conta.valor || 0);
            const contaFinanceira = {
                id: 'CP-' + Date.now() + '-' + idx,
                fornecedor: fornecedorNome,
                fornecedorId: fornecedorId,
                descricao: `Compra ${pedido.id}${idx>0?` (${idx+1})`:''}`,
                valor: valor,
                valorOriginal: valor,
                valorRestante: valor,
                dataVencimento: dataVencimento,
                status: 'pendente',
                categoria: 'compras',
                tipo: conta.tipo || 'a_prazo',
                observacoes: conta.observacao || '',
                parcela: idx + 1,
                totalParcelas: (pedido.contasPagar || []).length || 1,
                valorTotal: pedido.subtotal || valor,
                origem: 'compras',
                origemId: pedido.id,
                created: new Date().toISOString()
            };
            lista.push(contaFinanceira);
        });

        await saveData('contasPagar', lista);
        console.log(`✅ Contas a pagar geradas para pedido ${pedido.id}`);
    } catch (e) {
        console.error('❌ Erro ao gerar contas a pagar:', e);
    }
}

async function listarPedidosCompra() {
    try {
        const container = document.getElementById('listaPedidosCompra');
        const tbody = container?.querySelector('tbody');
        if (!container || !tbody) return;
        const lista = await getData('compras') || [];
        tbody.innerHTML = '';
        if (!Array.isArray(lista) || lista.length === 0) {
            const tr = document.createElement('tr');
            tr.innerHTML = '<td colspan="5" style="text-align:center;color:#666;">Nenhum pedido encontrado</td>';
            tbody.appendChild(tr);
        } else {
            lista.forEach(p => {
                const fornecedorNome = p.fornecedor?.nome || p.fornecedor?.name || p.fornecedor?.fantasia || p.fornecedor?.razaoSocial || (typeof p.fornecedor === 'string' ? p.fornecedor : '-') || '-';
                const itensCount = Array.isArray(p.itens) ? p.itens.length : 0;
                const tr = document.createElement('tr');
                tr.innerHTML = `
                    <td>${p.id}</td>
                    <td>${p.data || '-'}</td>
                    <td>${fornecedorNome}</td>
                    <td>${itensCount}</td>
                    <td>${formatCurrency(p.subtotal || 0)}</td>
                    <td class="no-print">
                        <button type="button" onclick="editarPedidoCompra('${p.id}')">Editar</button>
                        <button type="button" onclick="excluirPedidoCompra('${p.id}')">Excluir</button>
                    </td>
                `;
                tbody.appendChild(tr);
            });
        }
        container.style.display = '';
        showTabCompra('pedido');
    } catch (e) {
        console.error('Erro ao listar pedidos de compra:', e);
        alert('Falha ao listar pedidos.');
    }
}

function preencherFornecedorNoForm(fornecedor) {
    try {
        fornecedorSelecionadoCompra = fornecedor || null;
        const input = document.getElementById('fornecedorCompra');
        if (input) input.value = fornecedorSelecionadoCompra?.nome || fornecedorSelecionadoCompra?.name || fornecedorSelecionadoCompra?.fantasia || fornecedorSelecionadoCompra?.razaoSocial || (typeof fornecedorSelecionadoCompra === 'string' ? fornecedorSelecionadoCompra : '') || '';
    } catch {}
}

async function editarPedidoCompra(pedidoId) {
    try {
        const lista = await getData('compras') || [];
        const pedido = Array.isArray(lista) ? lista.find(p => String(p.id) === String(pedidoId)) : null;
        if (!pedido) { alert('Pedido não encontrado'); return; }

        editandoPedidoCompraId = pedido.id;
        // Mostrar formulário
        const form = document.getElementById('pedidoCompraForm');
        if (form) form.style.display = '';
        showTabCompra('pedido');

        // Preencher campos
        const dataEl = document.getElementById('dataCompra');
        if (dataEl) dataEl.value = pedido.data || formatISODateLocal(new Date());
        const statusEl = document.getElementById('statusCompra');
        if (statusEl) statusEl.value = (pedido.status || 'rascunho');
        preencherFornecedorNoForm(pedido.fornecedor);

        // Carregar itens e contas
        itensCompra.length = 0;
        (pedido.itens || []).forEach(i => itensCompra.push({ ...i }));
        contasPagar.length = 0;
        (pedido.contasPagar || []).forEach(c => contasPagar.push({ ...c }));
        atualizarTabelaItensCompra();
        atualizarTotaisCompra();
        renderizarContasPagar();
    } catch (e) {
        console.error('Erro ao editar pedido:', e);
        alert('Falha ao editar pedido.');
    }
}

async function excluirPedidoCompra(pedidoId) {
    try {
        if (!confirm('Tem certeza que deseja excluir este pedido de compra?')) return;
        const lista = await getData('compras') || [];
        const atualizadas = Array.isArray(lista) ? lista.filter(p => String(p.id) !== String(pedidoId)) : [];
        await saveData('compras', atualizadas);
        await removerContasPagarDoPedido(pedidoId);
        alert('Pedido excluído e contas associadas removidas.');
        await listarPedidosCompra();
    } catch (e) {
        console.error('Erro ao excluir pedido:', e);
        alert('Falha ao excluir pedido.');
    }
}

async function removerContasPagarDoPedido(pedidoId) {
    try {
        const contas = await getData('financas/pagar') || [];
        const atualizadas = Array.isArray(contas) ? contas.filter(c => !(String(c.origem) === 'compras' && String(c.origemId) === String(pedidoId))) : [];
        await saveData('contasPagar', atualizadas);
    } catch (e) {
        console.warn('Falha ao remover contas do pedido:', e);
    }
}

function aplicarFiltroPedidosCompra() {
    (async () => {
        try {
            const inicioStr = document.getElementById('filtroCompraInicio')?.value || '';
            const fimStr = document.getElementById('filtroCompraFim')?.value || '';
            const fornStr = (document.getElementById('filtroCompraFornecedor')?.value || '').toLowerCase().trim();
            const statusStr = (document.getElementById('filtroCompraStatus')?.value || '').toLowerCase().trim();
            const lista = await getData('compras') || [];
            const inicio = inicioStr ? new Date(inicioStr) : null;
            const fim = fimStr ? new Date(fimStr) : null;
            const tbody = document.querySelector('#listaPedidosCompra tbody');
            if (!tbody) return;
            tbody.innerHTML = '';
            let filtrados = Array.isArray(lista) ? lista.slice() : [];
            filtrados = filtrados.filter(p => {
                const d = p.data ? new Date(p.data) : null;
                if (inicio && d && d < inicio) return false;
                if (fim && d) {
                    const fimDia = new Date(fim); fimDia.setHours(23,59,59,999);
                    if (d > fimDia) return false;
                }
                if (fornStr) {
                    const nome = (p.fornecedor?.nome || p.fornecedor?.name || p.fornecedor?.fantasia || p.fornecedor?.razaoSocial || (typeof p.fornecedor === 'string' ? p.fornecedor : '') || '').toLowerCase();
                    if (!nome.includes(fornStr)) return false;
                }
                if (statusStr && String(p.status || '').toLowerCase() !== statusStr) return false;
                return true;
            });
            if (filtrados.length === 0) {
                const tr = document.createElement('tr');
                tr.innerHTML = '<td colspan="6" style="text-align:center;color:#666;">Nenhum pedido encontrado com os filtros</td>';
                tbody.appendChild(tr);
            } else {
                filtrados.forEach(p => {
                    const fornecedorNome = p.fornecedor?.nome || p.fornecedor?.name || p.fornecedor?.fantasia || p.fornecedor?.razaoSocial || (typeof p.fornecedor === 'string' ? p.fornecedor : '-') || '-';
                    const itensCount = Array.isArray(p.itens) ? p.itens.length : 0;
                    const tr = document.createElement('tr');
                    tr.innerHTML = `
                        <td>${p.id}</td>
                        <td>${p.data || '-'}</td>
                        <td>${fornecedorNome}</td>
                        <td>${itensCount}</td>
                        <td>${formatCurrency(p.subtotal || 0)}</td>
                        <td class="no-print">
                            <button type="button" onclick="editarPedidoCompra('${p.id}')">Editar</button>
                            <button type="button" onclick="excluirPedidoCompra('${p.id}')">Excluir</button>
                        </td>
                    `;
                    tbody.appendChild(tr);
                });
            }
            document.getElementById('listaPedidosCompra')?.style && (document.getElementById('listaPedidosCompra').style.display = '');
            showTabCompra('pedido');
        } catch (e) {
            console.error('Erro ao aplicar filtros:', e);
            alert('Falha ao aplicar filtros.');
        }
    })();
}

function limparFiltrosPedidosCompra() {
    try {
        document.getElementById('filtroCompraInicio') && (document.getElementById('filtroCompraInicio').value = '');
        document.getElementById('filtroCompraFim') && (document.getElementById('filtroCompraFim').value = '');
        document.getElementById('filtroCompraFornecedor') && (document.getElementById('filtroCompraFornecedor').value = '');
        listarPedidosCompra();
    } catch (e) {
        console.error('Erro ao limpar filtros:', e);
    }
}

// ===== Relatórios e Ações Adicionais =====
let ultimoRelatorio = null;

function limparItensCompra() {
    try {
        itensCompra.length = 0;
        const tbody = document.querySelector('#comprasItensTable tbody');
        if (tbody) tbody.innerHTML = '';
        const totalEl = document.getElementById('totalCompras');
        if (totalEl) totalEl.textContent = 'R$ 0,00';
        alert('Itens de compra limpos.');
    } catch (e) {
        console.error('Erro ao limpar itens:', e);
        alert('Falha ao limpar itens.');
    }
}

function exportarItensCSV() {
    try {
        if (!Array.isArray(itensCompra) || itensCompra.length === 0) {
            alert('Não há itens para exportar.');
            return;
        }
        const headers = ['produto','quantidade_m3','preco_unitario','total'];
        const rows = itensCompra.map(i => [
            i.produtoNome || '',
            (parseFloat(i.quantidade) || 0).toFixed(3).replace('.', ','),
            (parseFloat(i.precoUnitario) || 0).toFixed(2).replace('.', ','),
            (parseFloat(i.total) || 0).toFixed(2).replace('.', ',')
        ]);
        const csv = [headers.join(';'), ...rows.map(r => r.join(';'))].join('\n');
        const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = 'itens_compra.csv';
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
    } catch (e) {
        console.error('Erro ao exportar CSV de itens:', e);
        alert('Falha ao exportar CSV.');
    }
}

function parseDataRomaneio(r) {
    try {
        if (r.timestamp) return new Date(r.timestamp);
        if (r.data || r.dataRomaneio) return new Date(r.data || r.dataRomaneio);
        return new Date();
    } catch (_) {
        return new Date();
    }
}

function gerarRelatorioCompras() {
    try {
        const inicioEl = document.getElementById('relInicio');
        const fimEl = document.getElementById('relFim');
        const container = document.getElementById('relatorioContainer');
        const inicio = inicioEl && inicioEl.value ? new Date(inicioEl.value) : null;
        const fim = fimEl && fimEl.value ? new Date(fimEl.value) : null;
        if (!container) return;

        const base = Array.isArray(romaneiosToraCache) ? romaneiosToraCache : [];
        const selecionados = base.filter(r => {
            const d = parseDataRomaneio(r);
            if (inicio && d < inicio) return false;
            if (fim) {
                const fimDia = new Date(fim);
                fimDia.setHours(23,59,59,999);
                if (d > fimDia) return false;
            }
            return true;
        });

        const agregados = {};
        selecionados.forEach(r => {
            const resumo = extrairResumoTora(r);
            Object.keys(resumo).forEach(esp => {
                const it = resumo[esp];
                if (!agregados[esp]) agregados[esp] = { especie: esp, volume: 0, valorTotal: 0 };
                agregados[esp].volume += (it.volume || 0);
                agregados[esp].valorTotal += (it.valorTotal || 0);
            });
        });

        const linhas = Object.values(agregados).sort((a,b) => b.volume - a.volume);
        ultimoRelatorio = linhas;

        if (linhas.length === 0) {
            container.innerHTML = '<p>Nenhum dado encontrado para o período informado.</p>';
            return;
        }
        const totalVolume = linhas.reduce((s,x)=>s+(x.volume||0),0);
        const totalValor = linhas.reduce((s,x)=>s+(x.valorTotal||0),0);
        const precoMedio = totalVolume > 0 ? (totalValor/totalVolume) : 0;

        const tableHtml = `
          <table class="styled-table">
            <thead>
              <tr>
                <th>Espécie</th>
                <th>Volume (m³)</th>
                <th>Preço Médio (R$/m³)</th>
                <th>Valor Total (R$)</th>
              </tr>
            </thead>
            <tbody>
              ${linhas.map(l=>`
                <tr>
                  <td>${l.especie}</td>
                  <td>${(l.volume||0).toFixed(3)}</td>
                  <td>${((l.valorTotal||0)/(l.volume||1)).toFixed(2)}</td>
                  <td>${(l.valorTotal||0).toFixed(2)}</td>
                </tr>
              `).join('')}
            </tbody>
            <tfoot>
              <tr>
                <td><strong>Totais</strong></td>
                <td><strong>${totalVolume.toFixed(3)}</strong></td>
                <td><strong>${precoMedio.toFixed(2)}</strong></td>
                <td><strong>${totalValor.toFixed(2)}</strong></td>
              </tr>
            </tfoot>
          </table>
        `;
        container.innerHTML = tableHtml;
    } catch (e) {
        console.error('Erro ao gerar relatório:', e);
        alert('Falha ao gerar relatório.');
    }
}

function exportarRelatorioCSV() {
    try {
        if (!ultimoRelatorio || ultimoRelatorio.length === 0) {
            alert('Nenhum relatório para exportar. Gere primeiro.');
            return;
        }
        const headers = ['especie','volume','preco_medio','valor_total'];
        const rows = ultimoRelatorio.map(l => [
            l.especie,
            (l.volume||0).toFixed(3).replace('.', ','),
            (((l.valorTotal||0)/(l.volume||1))||0).toFixed(2).replace('.', ','),
            (l.valorTotal||0).toFixed(2).replace('.', ',')
        ]);
        const csv = [headers.join(';'), ...rows.map(r=>r.join(';'))].join('\n');
        const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = 'relatorio_compras.csv';
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
    } catch (e) {
        console.error('Erro ao exportar relatório CSV:', e);
        alert('Falha ao exportar CSV.');
    }
}

// Expor novas funções
window.limparItensCompra = limparItensCompra;
window.exportarItensCSV = exportarItensCSV;
window.gerarRelatorioCompras = gerarRelatorioCompras;
window.exportarRelatorioCSV = exportarRelatorioCSV;
window.novoPedidoCompra = novoPedidoCompra;
window.cancelarPedidoCompra = cancelarPedidoCompra;
window.selecionarFornecedorCompra = selecionarFornecedorCompra;
window.alterarTipoProdutoCompra = alterarTipoProdutoCompra;
window.adicionarItemManualCompra = adicionarItemManualCompra;
window.adicionarContaPagar = adicionarContaPagar;
window.removerContaPagar = removerContaPagar;
window.salvarPedidoCompra = salvarPedidoCompra;
window.listarPedidosCompra = listarPedidosCompra;
window.editarPedidoCompra = editarPedidoCompra;
window.excluirPedidoCompra = excluirPedidoCompra;
window.aplicarFiltroPedidosCompra = aplicarFiltroPedidosCompra;
window.limparFiltrosPedidosCompra = limparFiltrosPedidosCompra;
// Helpers Firebase (compatíveis com vendas.js)
async function getData(key) {
    try {
        // Preferir Firebase quando disponível
        if (window.firebaseService && typeof window.firebaseService.loadFromFirebase === 'function') {
            const result = await window.firebaseService.loadFromFirebase(key);
            if (result) return Array.isArray(result) ? result : Object.values(result || {});
        }
    } catch (e) {
        console.warn(`⚠️ Erro ao carregar ${key} do Firebase:`, e);
    }
    // Fallback local
    try {
        const storageKey = getStorageKey(key);
        const allowLegacy = storageKey === key;
        const raw = localStorage.getItem(storageKey) || (allowLegacy ? localStorage.getItem(key) : null);
        return raw ? JSON.parse(raw) : [];
    } catch (e) {
        console.warn(`⚠️ Erro ao carregar ${key} do localStorage:`, e);
        return [];
    }
}

async function saveData(key, data) {
    try {
        // Sanitizar profundamente para evitar undefined no Firebase
        const sanitize = (val) => {
            if (val === undefined) return null;
            if (val === null) return null;
            if (Array.isArray(val)) return val.map(sanitize);
            if (typeof val === 'object') {
                const out = {};
                for (const k in val) { if (Object.prototype.hasOwnProperty.call(val, k)) out[k] = sanitize(val[k]); }
                return out;
            }
            return val;
        };
        const safe = sanitize(data);
        const storageKey = getStorageKey(key);
        localStorage.setItem(storageKey, JSON.stringify(safe));
        if (window.firebaseService && typeof window.firebaseService.saveToFirebase === 'function') {
            await window.firebaseService.saveToFirebase(key, null, safe);
            console.log(`✅ ${key} salvo no Firebase`);
        } else {
            console.log(`ℹ️ Firebase não disponível, ${key} salvo localmente`);
        }
        return true;
    } catch (e) {
        console.error(`❌ Erro ao salvar ${key}:`, e);
        return false;
    }
}

function formatISODateLocal(dateObj) {
    const y = dateObj.getFullYear();
    const m = String(dateObj.getMonth() + 1).padStart(2, '0');
    const d = String(dateObj.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
}
