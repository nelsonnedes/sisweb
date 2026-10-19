/* Estoque de Madeira Serrada — companies/{tenant}/produtos (mesma base da aba de vendas) */
(function () {
    'use strict';

    var NODE = 'produtos';
    var PAGE_OPTIONS = [10, 25, 50, 100];
    var PAGE_DEFAULT = 25;
    var ROM_PATHS = { romaneiosTL: 'romaneios/tl', romaneiosPct: 'romaneios/pct', romaneiosPes: 'romaneios/pes' };
    var state = {
        tenant: '', items: [], filtered: [], page: 1, pageSize: PAGE_DEFAULT,
        editingKey: '', stage: [], groups: [], romaneios: [], romaneio: null
    };

    function svc() { return window.firebaseService || window.FirebaseService || null; }
    function esc(v) { return String(v == null ? '' : v).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;'); }
    function toast(msg, tipo) {
        try { if (typeof window.notifyUser === 'function') return window.notifyUser(msg, tipo || 'info'); } catch (_) {}
        try { if (window.ToastManager) { var fn = tipo === 'error' ? ToastManager.error : tipo === 'success' ? ToastManager.success : tipo === 'warning' ? ToastManager.warning : ToastManager.info; if (fn) return fn(msg); } } catch (_) {}
        console.log('[EstoqueMadeira]', msg);
    }
    function loading(show, txt) { try { if (window.SiswebLoading) show ? SiswebLoading.show(txt || 'Carregando...') : SiswebLoading.hide(); } catch (_) {} }
    function norm(v) { return String(v == null ? '' : v).normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase(); }
    function money(v) { var n = Number(v || 0); return n ? n.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }) : '—'; }
    function parseMoney(raw) {
        var s = String(raw == null ? '' : raw).trim().replace(/[^\d.,-]/g, '');
        if (!s) return 0;
        if (s.indexOf(',') >= 0) s = s.replace(/\./g, '').replace(',', '.');
        var n = Number(s); return Number.isFinite(n) ? n : 0;
    }
    function num(v) { return parseFloat(String(v == null ? '' : v).replace(',', '.')) || 0; }
    function recordKey(p) { return String((p && (p.__key || p.firebaseKey || p.key || p.id || p.codigo)) || ''); }
    function normalizeList(data) {
        var out = [];
        var keep = function (p) { return p && typeof p === 'object' && (p.nome || p.name || p.descricao); };
        if (Array.isArray(data)) {
            data.forEach(function (p, i) { if (keep(p)) out.push(Object.assign({}, p, { __key: String(p.firebaseKey || p.key || p.id || i) })); });
        } else if (data && typeof data === 'object') {
            Object.keys(data).forEach(function (k) {
                var p = data[k];
                if (keep(p)) out.push(Object.assign({}, p, { __key: String(p.firebaseKey || p.key || p.id || k) }));
            });
        }
        return out;
    }
    function dimsText(p) {
        var e = num(p.espessura), l = num(p.largura), c = num(p.comprimento);
        if (!e && !l && !c) return '—';
        return [e, l, c].map(function (n) { return n ? String(n).replace('.', ',') : '0'; }).join(' × ');
    }
    function productBlob(p) {
        return norm([p.codigo, p.nome, p.descricao, p.especie, p.unidade, p.tipoProduto,
            p.romaneioNumero, p.romaneioTipo, dimsText(p), p.preco, money(p.preco), p.estoque].join(' '));
    }
    function nextCode(extraUsed) {
        var max = 0, width = 1, used = {};
        state.items.forEach(function (p) {
            var c = String(p.codigo == null ? '' : p.codigo).trim();
            if (!c) return;
            used[c] = true;
            if (/^\d+$/.test(c)) { max = Math.max(max, parseInt(c, 10) || 0); width = Math.max(width, c.length); }
        });
        if (extraUsed && typeof extraUsed.forEach === 'function') {
            extraUsed.forEach(function (c) { if (c != null && String(c).trim()) used[String(c).trim()] = true; });
        }
        var f = function (n) { var s = String(n); while (s.length < width) s = '0' + s; return s; };
        var n = max + 1;
        while (used[f(n)] || used[String(n)]) n++;
        return f(n);
    }
    function nextId() { return 'PROD_' + Date.now().toString(36) + '_' + Math.random().toString(36).slice(2, 7); }
    function volumeFromDims(e, l, c, pecas, ppp) {
        var v = num(e) * num(l) * num(c) / 1000000 * (num(pecas) || 1) * (num(ppp) || 1);
        return Math.round(v * 1000) / 1000;
    }
    function romaneioVolume(it) {
        var candidates = [it.volume, it.volumeM3, it.volumeTotal, it.totalVolume, it.totais && it.totais.volume];
        for (var i = 0; i < candidates.length; i++) { var n = num(candidates[i]); if (n > 0) return n; }
        return volumeFromDims(it.espessura, it.largura, it.comprimento || it.comp, it.quantidade || it.pecas || it.qtd, it.pecasPorPacote || it.ppp || 1);
    }

    async function waitSvc(timeoutMs) {
        var limit = timeoutMs || 8000, t0 = Date.now();
        while (!svc()) { if (Date.now() - t0 > limit) throw new Error('Serviço Firebase indisponível.'); await new Promise(function (r) { setTimeout(r, 100); }); }
        return svc();
    }
    async function resolveTenant() {
        var s = await waitSvc();
        var ctx = null;
        try { if (typeof s.resolveAuthenticatedTenant === 'function') ctx = await s.resolveAuthenticatedTenant({ timeoutMs: 5000, reason: 'estoque_madeira_serrada' }); } catch (_) {}
        var tid = String((ctx && ctx.companyId) || (s.getTenantId && s.getTenantId()) || window.appTenantId || '').trim();
        if (!tid) { try { var ci = JSON.parse(localStorage.getItem('company_info') || 'null') || {}; tid = String(ci.id || ci.companyId || ci.tenantId || '').trim(); } catch (_) {} }
        if (!tid) { try { location.href = 'login.html'; } catch (_) {} throw new Error('Empresa não identificada. Faça login novamente.'); }
        state.tenant = tid;
        return tid;
    }

    function pageSizeKey() {
        var uid = '';
        try { var s = svc(); uid = (s && s.currentUser && s.currentUser.uid) || (window.firebaseAuthUser && window.firebaseAuthUser.uid) || ''; } catch (_) {}
        try { if (!uid && svc() && svc().authService) uid = svc().authService.getAuth().currentUser.uid; } catch (_) {}
        return 'ems_' + (state.tenant || 'default') + '_' + (uid || 'anon') + '_items_per_page';
    }
    function restorePageSize() { try { var v = parseInt(localStorage.getItem(pageSizeKey()) || '', 10); if (PAGE_OPTIONS.indexOf(v) >= 0) state.pageSize = v; } catch (_) {} }
    function setPageSize(v) { var n = parseInt(v, 10); if (PAGE_OPTIONS.indexOf(n) < 0) return; state.pageSize = n; state.page = 1; try { localStorage.setItem(pageSizeKey(), String(n)); } catch (_) {} render(); }
    function goPage(p) { var pages = Math.max(1, Math.ceil(state.filtered.length / state.pageSize)); state.page = Math.min(Math.max(1, parseInt(p, 10) || 1), pages); render(); }

    async function load() {
        loading(true, 'Carregando estoque de madeira serrada...');
        try {
            var tid = await resolveTenant();
            restorePageSize();
            var res = await svc().loadFromFirebase(NODE);
            var data = res && res.data !== undefined ? res.data : res;
            state.items = normalizeList(data).sort(function (a, b) { return String(a.nome || '').localeCompare(String(b.nome || ''), 'pt-BR'); });
            render();
        } catch (e) { toast('Erro ao carregar estoque: ' + (e && e.message ? e.message : e), 'error'); }
        finally { loading(false); }
    }
    function invalidate() {
        try { var s = svc(); if (s && typeof s.invalidateReadCacheForPath === 'function') { var tid = state.tenant; if (tid) s.invalidateReadCacheForPath('companies/' + tid + '/' + NODE); s.invalidateReadCacheForPath(NODE); } } catch (_) {}
    }
    function applyFilter() {
        var q = String((document.getElementById('emsSearch') || {}).value || '').trim();
        if (!q) { state.filtered = state.items.slice(); return; }
        var qn = norm(q);
        state.filtered = state.items.filter(function (p) { return productBlob(p).indexOf(qn) >= 0; });
        state.filtered.sort(function (a, b) {
            var ea = norm(a.codigo) === qn ? 0 : 1, eb = norm(b.codigo) === qn ? 0 : 1;
            return ea - eb || String(a.nome || '').localeCompare(String(b.nome || ''), 'pt-BR');
        });
    }
    function renderPagination(total, pages) {
        var pag = document.getElementById('emsPagination'); if (!pag) return;
        pag.innerHTML = ''; if (!total) return;
        var label = document.createElement('label'); label.className = 'pagination-size-control';
        var cap = document.createElement('span'); cap.textContent = 'Itens por página:'; label.appendChild(cap);
        var sel = document.createElement('select');
        PAGE_OPTIONS.forEach(function (o) { var op = document.createElement('option'); op.value = String(o); op.textContent = String(o); if (o === state.pageSize) op.selected = true; sel.appendChild(op); });
        sel.addEventListener('change', function () { setPageSize(sel.value); });
        label.appendChild(sel); pag.appendChild(label);
        if (pages <= 1) { var info = document.createElement('span'); info.className = 'pagination-total-info'; info.textContent = total + ' produto(s)'; pag.appendChild(info); return; }
        var host = document.createElement('span'); host.className = 'pagination-page-buttons'; pag.appendChild(host);
        function add(t, p, dis, act) { var b = document.createElement('button'); b.type = 'button'; b.textContent = t; if (act) b.classList.add('active'); b.disabled = !!dis; b.onclick = function () { goPage(p); }; host.appendChild(b); }
        add('<<<', 1, state.page === 1); add('<', state.page - 1, state.page === 1);
        var start = Math.max(1, state.page - 2), end = Math.min(pages, state.page + 2);
        if (start > 1) { add('1', 1, false, state.page === 1); if (start > 2) { var d = document.createElement('span'); d.textContent = '...'; host.appendChild(d); } }
        for (var i = start; i <= end; i++) add(String(i), i, false, i === state.page);
        if (end < pages) { if (end < pages - 1) { var d2 = document.createElement('span'); d2.textContent = '...'; host.appendChild(d2); } add(String(pages), pages, false, state.page === pages); }
        add('>', state.page + 1, state.page === pages); add('>>>', pages, state.page === pages);
        var inf = document.createElement('span'); inf.className = 'pagination-total-info'; inf.textContent = 'Pág. ' + state.page + '/' + pages + ' · ' + total + ' produto(s)'; pag.appendChild(inf);
    }
    function render() {
        applyFilter();
        var tbody = document.getElementById('emsTableBody'); if (!tbody) return;
        var total = state.filtered.length, pages = Math.max(1, Math.ceil(total / state.pageSize));
        if (state.page > pages) state.page = pages;
        var ini = (state.page - 1) * state.pageSize, slice = state.filtered.slice(ini, ini + state.pageSize);
        if (!slice.length) tbody.innerHTML = '<tr><td colspan="8" class="ems-empty">' + (state.items.length ? 'Nenhum produto encontrado.' : 'Nenhum produto no estoque.') + '</td></tr>';
        else tbody.innerHTML = slice.map(function (p) {
            var key = esc(recordKey(p));
            var estoque = num(p.estoque || p.quantidade);
            return '<tr>' +
                '<td data-label="Código">' + esc(p.codigo || '—') + '</td>' +
                '<td data-label="Nome">' + esc(p.nome || p.name || '—') + '</td>' +
                '<td data-label="Espécie">' + esc(p.especie || '—') + '</td>' +
                '<td data-label="Dimensões (cm)" class="ems-dims">' + esc(dimsText(p)) + '</td>' +
                '<td data-label="Estoque" class="ems-stock">' + estoque.toLocaleString('pt-BR', { minimumFractionDigits: 3, maximumFractionDigits: 3 }) + '</td>' +
                '<td data-label="Un.">' + esc(p.unidade || 'UN') + '</td>' +
                '<td data-label="Preço" class="ems-stock">' + money(p.preco || p.precoVenda || p.price) + '</td>' +
                '<td data-label="Ações" class="ems-actions">' +
                    '<button type="button" class="btn btn-primary btn-small" title="Editar" onclick="EstoqueMadeiraSerrada.edit(\'' + key + '\')"><i class="fas fa-edit"></i></button> ' +
                    '<button type="button" class="btn btn-danger btn-small" title="Excluir" onclick="EstoqueMadeiraSerrada.remove(\'' + key + '\')"><i class="fas fa-trash"></i></button>' +
                '</td></tr>';
        }).join('');
        renderPagination(total, pages);
    }

    function setVal(id, v) { var el = document.getElementById(id); if (el) el.value = v == null ? '' : v; }
    function getVal(id) { return (document.getElementById(id) || {}).value || ''; }
    function setType(t) {
        var isRom = t === 'romaneio';
        var manual = document.getElementById('emsManualSection');
        var rom = document.getElementById('emsRomaneioSection');
        if (manual) manual.style.display = isRom ? 'none' : 'block';
        if (rom) rom.style.display = isRom ? 'block' : 'none';
        var showBtn = function (id, visible) {
            var el = document.getElementById(id);
            if (el) el.style.setProperty('display', visible ? 'inline-flex' : 'none', 'important');
        };
        showBtn('emsAddItemBtn', !state.editingKey);
        showBtn('emsClearItemsBtn', !state.editingKey);
        showBtn('emsSaveBtn', !!state.editingKey);
        showBtn('emsAddStockBtn', !state.editingKey);
    }
    function currentType() { var r = document.querySelector('input[name="emsTipo"]:checked'); return r ? r.value : 'manual'; }
    function resetStage() { state.stage = []; renderManualPreview(); }
    function resetGroups() { state.groups = []; renderRomPreview(); }
    function openModal(item) {
        var modal = document.getElementById('emsModal'); if (!modal) return;
        state.editingKey = item ? recordKey(item) : '';
        state.stage = []; state.groups = []; state.romaneio = null;
        document.getElementById('emsModalTitle').textContent = item ? 'Editar Produto' : 'Novo Produto';
        setVal('emsId', state.editingKey);
        setVal('emsCodigo', item ? (item.codigo || '') : nextCode());
        setVal('emsNome', item ? (item.nome || item.name || '') : '');
        setVal('emsPreco', item && (item.preco || item.precoVenda || item.price) ? String(item.preco || item.precoVenda || item.price).replace('.', ',') : '');
        setVal('emsEstoque', item && (item.estoque || item.quantidade) ? String(item.estoque || item.quantidade) : '');
        setVal('emsUnidade', item && item.unidade || 'm³');
        setVal('emsDescricao', item && item.descricao || '');
        setVal('emsEspecie', item && item.especie || '');
        setVal('emsEspessura', item && item.espessura || '');
        setVal('emsLargura', item && item.largura || '');
        setVal('emsComprimento', item && item.comprimento || '');
        setVal('emsPecas', item && item.pecas || '1');
        setVal('emsPpp', item && item.pecasPorPacote || '1');
        setVal('emsVolume', '');
        var manual = document.querySelector('input[name="emsTipo"][value="manual"]');
        if (manual) manual.checked = true;
        var romRadio = document.querySelector('input[name="emsTipo"][value="romaneio"]');
        if (romRadio) romRadio.disabled = !!item;
        setVal('emsRomTipo', ''); setVal('emsRomSelect', '');
        var romSel = document.getElementById('emsRomSelect'); if (romSel) romSel.innerHTML = '<option value="">Selecione o tipo primeiro...</option>';
        resetStage(); resetGroups(); setType('manual'); updateVolume(); renderManualPreview();
        modal.classList.add('active');
        setTimeout(function () { var el = document.getElementById('emsNome'); if (el) el.focus(); }, 50);
    }
    function closeModal() { var m = document.getElementById('emsModal'); if (m) m.classList.remove('active'); }

    function renderManualPreview() {
        var box = document.getElementById('emsManualPreview'); if (!box) return;
        if (!state.stage.length) { box.innerHTML = '<span class="ems-help">Preencha os campos e clique em Adicionar item.</span>'; return; }
        box.innerHTML = state.stage.map(function (it, i) {
            return '<div class="ems-preview-row"><div class="ems-preview-main"><strong>' + esc(it.codigo || '-') + ' — ' + esc(it.nome || '-') + '</strong>' +
                '<small>Preço: ' + esc(it.precoFmt || money(it.preco)) + ' · Estoque: ' + esc(it.estoque) + ' ' + esc(it.unidade || 'UN') + (it.especie ? ' · ' + esc(it.especie) : '') + '</small></div>' +
                '<button type="button" class="btn btn-danger btn-small" data-ems-remove="' + i + '">Excluir</button></div>';
        }).join('') + '<div style="text-align:right;font-weight:700;">' + state.stage.length + ' item(ns)</div>';
        box.querySelectorAll('[data-ems-remove]').forEach(function (b) { b.onclick = function () { state.stage.splice(parseInt(b.dataset.emsRemove, 10), 1); renderManualPreview(); }; });
    }
    function addManualItem() {
        var nome = String(getVal('emsNome')).trim();
        if (!nome) { toast('Informe o nome do produto.', 'warning'); return; }
        var codigo = String(getVal('emsCodigo')).trim() || nextCode();
        if (state.stage.some(function (it) { return String(it.codigo) === String(codigo); })) { toast('Já existe item com este código no preview.', 'warning'); return; }
        var preco = parseMoney(getVal('emsPreco'));
        var estoque = num(getVal('emsEstoque'));
        state.stage.push({
            codigo: codigo, nome: nome, preco: preco, precoFmt: getVal('emsPreco') || money(preco),
            estoque: estoque, unidade: getVal('emsUnidade') || 'UN', descricao: String(getVal('emsDescricao')).trim(),
            especie: String(getVal('emsEspecie')).trim(), espessura: num(getVal('emsEspessura')),
            largura: num(getVal('emsLargura')), comprimento: num(getVal('emsComprimento')),
            pecas: num(getVal('emsPecas')), pecasPorPacote: num(getVal('emsPpp')) || 1,
            volumeM3: updateVolume()
        });
        setVal('emsNome', ''); setVal('emsPreco', ''); setVal('emsEstoque', ''); setVal('emsDescricao', '');
        var usedCodes = new Set(state.items.map(function (p) { return String(p.codigo || '').trim(); }).filter(Boolean));
        state.stage.forEach(function (it) { if (it.codigo) usedCodes.add(String(it.codigo)); });
        setVal('emsCodigo', nextCode(usedCodes)); renderManualPreview();
    }
    function updateVolume() {
        var v = volumeFromDims(getVal('emsEspessura'), getVal('emsLargura'), getVal('emsComprimento'), getVal('emsPecas'), getVal('emsPpp'));
        setVal('emsVolume', v > 0 ? v.toLocaleString('pt-BR', { minimumFractionDigits: 3, maximumFractionDigits: 3 }) : '');
        return v;
    }

    async function saveOne(payload, key) {
        var res = await svc().saveToFirebase(NODE, key || payload.id, payload);
        if (res && res.success === false) throw new Error(res.error || 'Falha ao salvar.');
        return res;
    }
    async function saveManual() {
        loading(true, 'Salvando produto...');
        try {
            var tid = await resolveTenant();
            if (state.editingKey) {
                var item = state.items.find(function (p) { return recordKey(p) === state.editingKey; }) || {};
                var payload = buildPayload(item, {
                    codigo: String(getVal('emsCodigo')).trim() || item.codigo || nextCode(),
                    nome: String(getVal('emsNome')).trim(), preco: parseMoney(getVal('emsPreco')),
                    estoque: num(getVal('emsEstoque')), unidade: getVal('emsUnidade') || 'UN',
                    descricao: String(getVal('emsDescricao')).trim(), especie: String(getVal('emsEspecie')).trim(),
                    espessura: num(getVal('emsEspessura')), largura: num(getVal('emsLargura')),
                    comprimento: num(getVal('emsComprimento')), pecas: num(getVal('emsPecas')),
                    pecasPorPacote: num(getVal('emsPpp')) || 1
                });
                await saveOne(payload, state.editingKey);
                toast('Produto atualizado.', 'success');
            } else {
                if (!state.stage.length) { toast('Adicione ao menos um item no Preview.', 'warning'); return; }
                for (var i = 0; i < state.stage.length; i++) {
                    var it = state.stage[i];
                    var existente = state.items.find(function (p) { return String(p.codigo || '').trim() !== '' && String(p.codigo).trim() === String(it.codigo).trim(); });
                    if (existente) {
                        existente.estoque = Math.round((num(existente.estoque) + num(it.estoque)) * 1000) / 1000;
                        await saveOne(buildPayload(existente, existente), recordKey(existente));
                    } else {
                        var novo = buildPayload(it, it);
                        await saveOne(novo, novo.id);
                    }
                }
                toast(state.stage.length + ' item(ns) adicionado(s) ao estoque.', 'success');
            }
            closeModal(); invalidate(); await load();
        } catch (e) { toast('Erro ao salvar: ' + (e && e.message ? e.message : e), 'error'); }
        finally { loading(false); }
    }
    function buildPayload(base, src) {
        var now = new Date().toISOString();
        return {
            id: base.id || ((state.editingKey && !base.id) ? state.editingKey : nextId()),
            codigo: String(src.codigo || '').trim(), nome: String(src.nome || '').trim(),
            preco: Number(src.preco) || 0, estoque: Number(src.estoque) || 0, unidade: src.unidade || 'UN',
            descricao: src.descricao || '', especie: src.especie || '', espessura: Number(src.espessura) || 0,
            largura: Number(src.largura) || 0, comprimento: Number(src.comprimento) || 0,
            pecas: Number(src.pecas) || 0, pecasPorPacote: Number(src.pecasPorPacote) || 1,
            volumeM3: Number(src.volumeM3) || 0, tipoProduto: src.tipoProduto || base.tipoProduto || 'manual',
            romaneioTipo: src.romaneioTipo || base.romaneioTipo || '', romaneioId: src.romaneioId || base.romaneioId || '',
            romaneioNumero: src.romaneioNumero || base.romaneioNumero || '', created: base.created || now, updated: now
        };
    }

    function normalizeAnyList(data) {
        var out = [];
        if (Array.isArray(data)) {
            data.forEach(function (p, i) { if (p && typeof p === 'object') out.push(Object.assign({}, p, { __key: String(p.firebaseKey || p.key || p.id || i) })); });
        } else if (data && typeof data === 'object') {
            Object.keys(data).forEach(function (k) {
                if (k === '_metadata' || k === 'metadata') return;
                var p = data[k];
                if (p && typeof p === 'object') out.push(Object.assign({}, p, { __key: String(p.firebaseKey || p.key || p.id || k) }));
            });
        }
        return out;
    }
    async function loadRomaneios(tipo) {
        var path = ROM_PATHS[tipo]; if (!path) return [];
        var res = await svc().loadFromFirebase(path);
        var data = res && res.data !== undefined ? res.data : res;
        return normalizeAnyList(data);
    }
    async function onRomTipoChange() {
        var tipo = getVal('emsRomTipo'); var sel = document.getElementById('emsRomSelect');
        state.romaneio = null;
        if (!sel) return; sel.innerHTML = '<option value="">Selecione um romaneio...</option>';
        if (!tipo) return;
        loading(true, 'Carregando romaneios...');
        try {
            state.romaneios = await loadRomaneios(tipo);
            state.romaneios.forEach(function (r, i) {
                var key = recordKey(r) || String(i);
                var data = String(r.dataEmissao || r.data || r.createdAt || '').slice(0, 10).split('-').reverse().join('/');
                var nome = r.clienteNome
                    || (r.cliente && (r.cliente.nome || r.cliente.name))
                    || (r.fornecedor && (r.fornecedor.nome || r.fornecedor.name))
                    || r.fornecedor || r.numero || ('Romaneio ' + (i + 1));
                var num = romNumero(r) || (i + 1);
                var opt = document.createElement('option'); opt.value = key; opt.textContent = (data ? data + ' - ' : '') + String(nome) + ' - Nº ' + num; sel.appendChild(opt);
            });
            if (!state.romaneios.length) toast('Nenhum romaneio encontrado para este tipo.', 'warning');
        } catch (e) { toast('Erro ao carregar romaneios: ' + (e && e.message ? e.message : e), 'error'); }
        finally { loading(false); }
    }
    function onRomSelectChange() {
        var key = getVal('emsRomSelect');
        state.romaneio = state.romaneios.find(function (r) { return recordKey(r) === key; }) || null;
        resetGroups();
    }
    function romNumero(r) {
        var n = String((r && (r.numeroExibicao || r.numeroRomaneio || r.numero)) || '').trim();
        if (/^(TL_|PCT_|PES_|TORA_)/i.test(n)) n = String((r && (r.sequencial || r.numeroSequencial || r.seq)) || '').trim();
        return n;
    }
    function groupRomaneio(rom, tipo) {
        var rawItems = rom && (rom.itens || rom.items);
        var itens = Array.isArray(rawItems) ? rawItems : (rawItems && typeof rawItems === 'object' ? Object.values(rawItems) : []);
        var map = new Map();
        itens.forEach(function (it) {
            if (!it || typeof it !== 'object') return;
            var especie = String(it.especie || it.nome || it.descricao || 'Sem espécie').trim();
            var e = num(it.espessura), l = num(it.largura), c = num(it.comprimento || it.comp);
            var gid = [especie, e, l, c].join('|');
            var vol = romaneioVolume(it);
            var qtd = num(it.quantidade || it.pecas || it.qtd || 1);
            var preco = num(it.precoUnitario || it.precoMedio || it.preco || it.valorUnitario);
            var g = map.get(gid) || { gid: gid, especie: especie, espessura: e, largura: l, comprimento: c, volume: 0, pecas: 0, preco: preco, romaneioId: recordKey(rom), romaneioNumero: romNumero(rom), romaneioTipo: tipo };
            g.volume = Math.round((g.volume + vol) * 1000) / 1000;
            g.pecas += qtd;
            if (!g.preco && preco) g.preco = preco;
            map.set(gid, g);
        });
        return Array.from(map.values());
    }
    function sameProduct(p, g) {
        return String(p.romaneioId || '') === String(g.romaneioId || '')
            && norm(p.especie || '') === norm(g.especie || '')
            && num(p.espessura) === num(g.espessura) && num(p.largura) === num(g.largura) && num(p.comprimento) === num(g.comprimento);
    }
    function renderRomPreview() {
        var box = document.getElementById('emsRomPreview'); if (!box) return;
        if (!state.groups.length) { box.innerHTML = '<span class="ems-help">Selecione o tipo e o romaneio, depois clique em Carregar Itens.</span>'; return; }
        box.innerHTML = state.groups.map(function (g, i) {
            var exists = state.items.some(function (p) { return sameProduct(p, g); });
            return '<label class="ems-preview-row"><input type="checkbox" class="ems-group-check" data-ems-group="' + i + '"' + (exists ? ' disabled' : ' checked') + '>' +
                '<span class="ems-preview-main"><strong>' + esc(g.especie) + ' ' + esc([g.espessura, g.largura, g.comprimento].join(' × ')) + '</strong>' +
                '<small>' + g.volume.toLocaleString('pt-BR', { minimumFractionDigits: 3, maximumFractionDigits: 3 }) + ' m³ · ' + esc(g.pecas) + ' peça(s) · ' + (exists ? 'já em estoque' : money(g.preco)) + '</small></span></label>';
        }).join('');
    }
    async function addGroups() {
        var checks = Array.from(document.querySelectorAll('#emsRomPreview [data-ems-group]:checked'));
        if (!checks.length) { toast('Marque ao menos um grupo no Preview.', 'warning'); return; }
        loading(true, 'Adicionando ao estoque...');
        var usedCodes = new Set(state.items.map(function (p) { return String(p.codigo || '').trim(); }).filter(Boolean));
        try {
            for (var i = 0; i < checks.length; i++) {
                var g = state.groups[parseInt(checks[i].dataset.emsGroup, 10)]; if (!g || !(g.volume > 0)) continue;
                if (state.items.some(function (p) { return sameProduct(p, g); })) continue;
                var codigo = nextCode(usedCodes);
                usedCodes.add(codigo);
                var novo = buildPayload({}, {
                    codigo: codigo, nome: (g.especie + ' ' + [g.espessura, g.largura, g.comprimento].join('x')).trim(),
                    preco: g.preco, estoque: g.volume, unidade: 'm³', descricao: 'Madeira serrada' + (g.romaneioNumero ? ' (Nº ' + g.romaneioNumero + ')' : ''),
                    especie: g.especie, espessura: g.espessura, largura: g.largura, comprimento: g.comprimento,
                    pecas: g.pecas, pecasPorPacote: 1, volumeM3: g.volume, tipoProduto: 'romaneio',
                    romaneioTipo: g.romaneioTipo, romaneioId: g.romaneioId, romaneioNumero: g.romaneioNumero
                });
                await saveOne(novo, novo.id);
            }
            toast(checks.length + ' grupo(s) adicionado(s) ao estoque.', 'success');
            closeModal(); invalidate(); await load();
        } catch (e) { toast('Erro ao adicionar: ' + (e && e.message ? e.message : e), 'error'); }
        finally { loading(false); }
    }

    async function remove(key) {
        if (!key) return;
        var ok = true;
        try { ok = typeof window.confirmDialog === 'function' ? await window.confirmDialog({ title: 'Excluir produto', message: 'Excluir este produto do estoque?', danger: true, confirmLabel: 'Excluir' }) : window.confirm('Excluir este produto do estoque?'); } catch (_) { ok = true; }
        if (!ok) return;
        loading(true, 'Excluindo...');
        try {
            var s = svc();
            var res = await (typeof s.removeFromFirebase === 'function' ? s.removeFromFirebase(NODE + '/' + key) : s.saveToFirebase(NODE, null, state.items.filter(function (p) { return recordKey(p) !== key; })));
            if (res && res.success === false) throw new Error(res.error || 'Falha ao excluir.');
            toast('Produto excluído.', 'success'); invalidate(); await load();
        } catch (e) { toast('Erro ao excluir: ' + (e && e.message ? e.message : e), 'error'); }
        finally { loading(false); }
    }
    function edit(key) { var item = state.items.find(function (p) { return recordKey(p) === key; }); if (item) openModal(item); }

    function bind() {
        if (state.bound) return; state.bound = true;
        var search = document.getElementById('emsSearch'); if (search) search.addEventListener('input', function () { state.page = 1; render(); });
        var novo = document.getElementById('emsNewBtn'); if (novo) novo.addEventListener('click', function () { openModal(null); });
        var close = document.getElementById('emsCloseModal'); if (close) close.addEventListener('click', closeModal);
        var cancel = document.getElementById('emsCancelBtn'); if (cancel) cancel.addEventListener('click', closeModal);
        var form = document.getElementById('emsForm'); if (form) form.addEventListener('submit', function (e) { e.preventDefault(); saveManual(); });
        var add = document.getElementById('emsAddItemBtn'); if (add) add.addEventListener('click', addManualItem);
        var clearItems = document.getElementById('emsClearItemsBtn'); if (clearItems) clearItems.addEventListener('click', resetStage);
        var addStock = document.getElementById('emsAddStockBtn'); if (addStock) addStock.addEventListener('click', function () { if (currentType() === 'romaneio') addGroups(); else saveManual(); });
        document.querySelectorAll('input[name="emsTipo"]').forEach(function (r) { r.addEventListener('change', function () { setType(currentType()); }); });
        var romTipo = document.getElementById('emsRomTipo'); if (romTipo) romTipo.addEventListener('change', onRomTipoChange);
        var romSel = document.getElementById('emsRomSelect'); if (romSel) romSel.addEventListener('change', onRomSelectChange);
        var loadRom = document.getElementById('emsLoadRomBtn'); if (loadRom) loadRom.addEventListener('click', function () {
            if (!state.romaneio) { toast('Selecione um romaneio.', 'warning'); return; }
            state.groups = groupRomaneio(state.romaneio, getVal('emsRomTipo'));
            if (!state.groups.length) toast('Nenhum item com volume no romaneio.', 'warning');
            renderRomPreview();
        });
        var clearRom = document.getElementById('emsClearRomBtn'); if (clearRom) clearRom.addEventListener('click', resetGroups);
        ['emsEspessura', 'emsLargura', 'emsComprimento', 'emsPecas', 'emsPpp'].forEach(function (id) { var el = document.getElementById(id); if (el) el.addEventListener('input', updateVolume); });
        var modal = document.getElementById('emsModal'); if (modal) modal.addEventListener('click', function (e) { if (e.target === modal) closeModal(); });
        document.addEventListener('keydown', function (e) { if (e.key === 'Escape') closeModal(); });
    }
    window.EstoqueMadeiraSerrada = { reload: load, edit: edit, remove: remove, open: function () { openModal(null); } };
    function boot() { try { bind(); } catch (_) {} load(); }
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot, { once: true }); else boot();
})();
