/* Produtos Fiscais (NF-e) — CRUD de companies/{tenant}/fiscal/produtos-nfe */
(function () {
    'use strict';

    var NODE = 'fiscal/produtos-nfe';
    var PF_PAGE_SIZE_OPTIONS = [10, 25, 50, 100];
    var PF_PAGE_SIZE_DEFAULT = 25;
    var state = { tenant: '', items: [], filtered: [], page: 1, pageSize: PF_PAGE_SIZE_DEFAULT };

    function svc() {
        return window.firebaseService || window.firebaseServiceTL || window.FirebaseService || null;
    }

    function esc(v) {
        return String(v == null ? '' : v).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
    }

    function toast(msg, tipo) {
        try { if (typeof window.notifyUser === 'function') return window.notifyUser(msg, tipo || 'info'); } catch (_) {}
        try { if (typeof window.__toast === 'function') return window.__toast(msg, tipo || 'info'); } catch (_) {}
        console.log('[ProdutosFiscais]', msg);
    }

    function loading(show, txt) {
        try { if (window.SiswebLoading) show ? window.SiswebLoading.show(txt || 'Carregando...') : window.SiswebLoading.hide(); } catch (_) {}
    }

    function recordKey(p) {
        return String((p && (p.__key || p.firebaseKey || p.key || p.id || p.codigo)) || '');
    }

    function normalizeList(data) {
        var raw = data && typeof data === 'object' ? data : {};
        var out = [];
        var keep = function (p) { return p && typeof p === 'object' && (p.nome || p.descricao || p.name); };
        if (Array.isArray(raw)) {
            raw.forEach(function (p, i) {
                if (keep(p)) out.push(Object.assign({}, p, { __key: String(p.firebaseKey || p.key || i) }));
            });
        } else {
            Object.keys(raw).forEach(function (k) {
                if (k === '_metadata' || k === 'metadata') return;
                var p = raw[k];
                if (keep(p)) out.push(Object.assign({}, p, { __key: String(p.firebaseKey || p.key || k) }));
            });
        }
        return out;
    }

    function invalidateBase() {
        try {
            var s = svc();
            if (!s || typeof s.invalidateReadCacheForPath !== 'function') return;
            var tid = state.tenant;
            if (tid) s.invalidateReadCacheForPath('companies/' + tid + '/' + NODE);
            s.invalidateReadCacheForPath(NODE);
        } catch (_) {}
    }

    function upsertLocal(payload, key) {
        var idx = state.items.findIndex(function (p) {
            return recordKey(p) === String(key) || String(p.id || '') === String(payload.id || '');
        });
        if (idx >= 0) state.items[idx] = Object.assign({}, state.items[idx], payload, { __key: String(key) });
        else state.items.push(Object.assign({}, payload, { __key: String(key) }));
        state.page = 1;
        render();
    }

    async function waitSvc(timeoutMs) {
        var limit = timeoutMs || 8000;
        var t0 = Date.now();
        while (!svc()) {
            if (Date.now() - t0 > limit) throw new Error('Serviço Firebase indisponível.');
            await new Promise(function (r) { setTimeout(r, 100); });
        }
        return svc();
    }

    async function resolveTenant() {
        var s = await waitSvc();
        if (!s) throw new Error('Serviço Firebase indisponível.');
        var ctx = null;
        try {
            if (typeof s.resolveAuthenticatedTenant === 'function') {
                ctx = await s.resolveAuthenticatedTenant({ timeoutMs: 5000, reason: 'produtos_fiscais' });
            }
        } catch (_) {}
        var tid = String((ctx && ctx.companyId) || (s.getTenantId && s.getTenantId()) || window.appTenantId || '').trim();
        if (!tid) {
            try {
                var ci = JSON.parse(localStorage.getItem('company_info') || 'null') || {};
                tid = String(ci.id || ci.companyId || ci.tenantId || '').trim();
            } catch (_) {}
        }
        if (!tid) {
            try { window.location.href = 'login.html'; } catch (_) {}
            throw new Error('Empresa não identificada. Faça login novamente.');
        }
        state.tenant = tid;
        return tid;
    }

    async function carregar() {
        loading(true, 'Carregando produtos fiscais...');
        try {
            var tid = await resolveTenant();
            restorePageSize();
            var res = await svc().loadFromFirebase('companies/' + tid + '/' + NODE);
            var data = res && res.data !== undefined ? res.data : res;
            state.items = normalizeList(data).sort(function (a, b) {
                return String(a.nome || '').localeCompare(String(b.nome || ''), 'pt-BR');
            });
            render();
        } catch (e) {
            toast('Erro ao carregar produtos fiscais: ' + (e && e.message ? e.message : e), 'error');
        } finally {
            loading(false);
        }
    }

    function norm(v) {
        return String(v == null ? '' : v)
            .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
            .toLowerCase();
    }

    function productBlob(p) {
        var f = p.fiscal || {};
        var preco = p.precoVenda != null ? p.precoVenda : (p.preco != null ? p.preco : f.valorPauta);
        // Inclui TODAS as colunas visíveis (código/nome/NCM/CFOP/UN/preço) e os
        // equivalentes aninhados em fiscal.* — antes um NCM/CFOP só em fiscal
        // não filtrava, e o preço ficava fora da busca.
        return norm([
            p.nome, p.descricao, p.name,
            p.codigo, p.cod, p.code, p.codigoProduto,
            p.ncm, f.ncm,
            p.cfopPadrao, p.cfop, f.cfop,
            p.unidade, f.unidade,
            f.cst, f.valorPauta,
            preco, money(preco)
        ].join(' '));
    }

    function applyFilter() {
        var q = String((document.getElementById('pfSearch') || {}).value || '').trim();
        if (!q) { state.filtered = state.items.slice(); return; }
        var qn = norm(q);
        state.filtered = state.items.filter(function (p) {
            return productBlob(p).indexOf(qn) >= 0;
        });
    }

    function parseMoneyInput(raw) {
        var s = String(raw == null ? '' : raw).trim().replace(/[^\d.,-]/g, '');
        if (!s) return 0;
        // Com vírgula: vírgula é decimal e pontos são milhar. Sem vírgula:
        // o ponto já é o separador decimal (valor numérico do formulário).
        if (s.indexOf(',') >= 0) s = s.replace(/\./g, '').replace(',', '.');
        var n = Number(s);
        return Number.isFinite(n) ? n : 0;
    }

    function money(v) {
        var n = Number(v || 0);
        return n ? n.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }) : '—';
    }

    function pageSizeKey() {
        var tid = state.tenant || '';
        var uid = '';
        try { uid = (window.firebaseService && window.firebaseService.currentUser && window.firebaseService.currentUser.uid) || ''; } catch (_) {}
        try { if (!uid) uid = (svc() && svc().currentUser && svc().currentUser.uid) || ''; } catch (_) {}
        return 'pf_produtos_' + (tid || 'default') + '_' + (uid || 'anon') + '_items_per_page';
    }

    function restorePageSize() {
        try {
            var v = parseInt(localStorage.getItem(pageSizeKey()) || '', 10);
            if (PF_PAGE_SIZE_OPTIONS.indexOf(v) >= 0) state.pageSize = v;
        } catch (_) {}
    }

    function setPageSize(value) {
        var size = parseInt(value, 10);
        if (PF_PAGE_SIZE_OPTIONS.indexOf(size) < 0) return;
        state.pageSize = size;
        state.page = 1;
        try { localStorage.setItem(pageSizeKey(), String(size)); } catch (_) {}
        render();
    }

    function goPage(page) {
        var pages = Math.max(1, Math.ceil(state.filtered.length / state.pageSize));
        state.page = Math.min(Math.max(1, parseInt(page, 10) || 1), pages);
        render();
    }

    // Código automático ao salvar: sequencial numérico, preservando zeros à
    // esquerda quando os códigos existentes usam esse formato.
    function nextCodigo() {
        var max = 0;
        var width = 1;
        var used = {};
        state.items.forEach(function (p) {
            var c = String(p.codigo == null ? '' : p.codigo).trim();
            if (!c) return;
            used[c] = true;
            if (/^\d+$/.test(c)) {
                var n = parseInt(c, 10) || 0;
                if (n > max) max = n;
                if (c.length > width) width = c.length;
            }
        });
        var fmt = function (v) {
            var s = String(v);
            while (s.length < width) s = '0' + s;
            return s;
        };
        var n = max + 1;
        while (used[fmt(n)] || used[String(n)]) n++;
        return fmt(n);
    }

    function renderPagination(total, pages) {
        var pag = document.getElementById('pfPagination');
        if (!pag) return;
        pag.innerHTML = '';
        if (!total) return;
        var label = document.createElement('label');
        label.className = 'pagination-size-control';
        var caption = document.createElement('span');
        caption.textContent = 'Itens por página:';
        label.appendChild(caption);
        var sel = document.createElement('select');
        PF_PAGE_SIZE_OPTIONS.forEach(function (opt) {
            var o = document.createElement('option');
            o.value = String(opt);
            o.textContent = String(opt);
            if (opt === state.pageSize) o.selected = true;
            sel.appendChild(o);
        });
        sel.addEventListener('change', function () { setPageSize(sel.value); });
        label.appendChild(sel);
        pag.appendChild(label);
        if (pages <= 1) {
            var only = document.createElement('span');
            only.className = 'pagination-total-info';
            only.textContent = total + ' produto(s)';
            pag.appendChild(only);
            return;
        }
        var host = document.createElement('span');
        host.className = 'pagination-page-buttons';
        pag.appendChild(host);
        var addBtn = function (text, page, disabled, active) {
            var btn = document.createElement('button');
            btn.type = 'button';
            btn.textContent = text;
            if (active) btn.classList.add('active');
            btn.disabled = !!disabled;
            btn.onclick = function () { goPage(page); };
            host.appendChild(btn);
        };
        addBtn('<<<', 1, state.page === 1);
        addBtn('<', state.page - 1, state.page === 1);
        var startPage = Math.max(1, state.page - 2);
        var endPage = Math.min(pages, state.page + 2);
        if (startPage > 1) {
            addBtn('1', 1, false, state.page === 1);
            if (startPage > 2) { var dots = document.createElement('span'); dots.textContent = '...'; host.appendChild(dots); }
        }
        for (var i = startPage; i <= endPage; i++) addBtn(String(i), i, false, i === state.page);
        if (endPage < pages) {
            if (endPage < pages - 1) { var dots2 = document.createElement('span'); dots2.textContent = '...'; host.appendChild(dots2); }
            addBtn(String(pages), pages, false, state.page === pages);
        }
        addBtn('>', state.page + 1, state.page === pages);
        addBtn('>>>', pages, state.page === pages);
        var info = document.createElement('span');
        info.className = 'pagination-total-info';
        info.textContent = 'Pág. ' + state.page + '/' + pages + ' · ' + total + ' produto(s)';
        pag.appendChild(info);
    }

    function render() {
        applyFilter();
        var tbody = document.getElementById('pfTableBody');
        if (!tbody) return;
        var total = state.filtered.length;
        var pages = Math.max(1, Math.ceil(total / state.pageSize));
        if (state.page > pages) state.page = pages;
        var ini = (state.page - 1) * state.pageSize;
        var fatia = state.filtered.slice(ini, ini + state.pageSize);
        if (!fatia.length) {
            var msg = state.items.length ? 'Nenhum produto encontrado.' : 'Nenhum produto fiscal cadastrado.';
            tbody.innerHTML = '<tr><td colspan="7" class="pf-empty">' + msg + '</td></tr>';
        } else {
            tbody.innerHTML = fatia.map(function (p) {
                var id = esc(recordKey(p));
                return '<tr>' +
                    '<td data-label="Nome">' + esc(p.nome || p.descricao || '—') + '</td>' +
                    '<td data-label="Código">' + esc(p.codigo || '—') + '</td>' +
                    '<td data-label="NCM">' + esc(p.ncm || (p.fiscal && p.fiscal.ncm) || '—') + '</td>' +
                    '<td data-label="CFOP">' + esc(p.cfopPadrao || p.cfop || (p.fiscal && p.fiscal.cfop) || '—') + '</td>' +
                    '<td data-label="Unidade">' + esc(p.unidade || (p.fiscal && p.fiscal.unidade) || '—') + '</td>' +
                    '<td data-label="Preço">' + money(p.precoVenda || p.preco || (p.fiscal && p.fiscal.valorPauta)) + '</td>' +
                    '<td data-label="Ações" class="pf-actions">' +
                        '<button type="button" class="btn btn-primary btn-small" title="Editar" onclick="ProdutosFiscais.edit(\'' + id + '\')"><i class="fas fa-edit"></i></button> ' +
                        '<button type="button" class="btn btn-danger btn-small" title="Excluir" onclick="ProdutosFiscais.remove(\'' + id + '\')"><i class="fas fa-trash"></i></button>' +
                    '</td>' +
                '</tr>';
            }).join('');
        }
        renderPagination(total, pages);
    }

    function setVal(id, v) {
        var el = document.getElementById(id);
        if (el) el.value = v == null ? '' : v;
    }

    function openModal(item) {
        var modal = document.getElementById('pfModal');
        if (!modal) return;
        document.getElementById('pfModalTitle').textContent = item ? 'Editar Produto Fiscal' : 'Novo Produto Fiscal';
        setVal('pfId', item ? recordKey(item) : '');
        setVal('pfNome', item && (item.nome || item.descricao) || '');
        setVal('pfCodigo', item ? (item.codigo || '') : nextCodigo());
        setVal('pfNcm', item && (item.ncm || (item.fiscal && item.fiscal.ncm)) || '');
        setVal('pfCfop', item && (item.cfopPadrao || item.cfop || (item.fiscal && item.fiscal.cfop)) || '');
        setVal('pfUnidade', item && (item.unidade || (item.fiscal && item.fiscal.unidade)) || 'M3');
        setVal('pfPreco', item && (item.precoVenda || item.preco) || '');
        setVal('pfCst', item && item.fiscal && item.fiscal.cst || '');
        setVal('pfOrigem', item && item.fiscal && item.fiscal.origem || '0');
        setVal('pfCest', item && item.fiscal && item.fiscal.cest || '');
        setVal('pfValorPauta', item && item.fiscal && item.fiscal.valorPauta || '');
        var imp = document.getElementById('pfImportado');
        if (imp) imp.checked = !!(item && item.fiscal && item.fiscal.importado);
        modal.classList.add('active');
        setTimeout(function () { var el = document.getElementById('pfNome'); if (el) el.focus(); }, 50);
    }

    function closeModal() {
        var modal = document.getElementById('pfModal');
        if (modal) modal.classList.remove('active');
    }

    async function save(event) {
        if (event) event.preventDefault();
        var nome = String((document.getElementById('pfNome') || {}).value || '').trim();
        if (!nome) { toast('Informe o nome do produto.', 'warning'); return; }
        var ncm = String((document.getElementById('pfNcm') || {}).value || '').replace(/\D/g, '');
        if (ncm && ncm.length !== 8) { toast('NCM deve ter 8 dígitos.', 'warning'); return; }
        var cfop = String((document.getElementById('pfCfop') || {}).value || '').replace(/\D/g, '').slice(0, 4);
        var id = String((document.getElementById('pfId') || {}).value || '').trim();
        if (!id) id = 'NFE_' + Date.now().toString(36) + '_' + Math.random().toString(36).slice(2, 7);
        var preco = parseMoneyInput((document.getElementById('pfPreco') || {}).value);
        var valorPauta = parseMoneyInput((document.getElementById('pfValorPauta') || {}).value);
        var unidade = String((document.getElementById('pfUnidade') || {}).value || 'M3').toUpperCase();
        var codigo = String((document.getElementById('pfCodigo') || {}).value || '').trim();
        if (!codigo) codigo = nextCodigo();
        var payload = {
            id: id,
            nome: nome,
            codigo: codigo,
            ncm: ncm,
            cfopPadrao: cfop,
            unidade: unidade,
            precoVenda: preco,
            fiscal: {
                ncm: ncm,
                cfop: cfop,
                unidade: unidade,
                cst: String((document.getElementById('pfCst') || {}).value || '').trim(),
                origem: String((document.getElementById('pfOrigem') || {}).value || '0').trim(),
                cest: String((document.getElementById('pfCest') || {}).value || '').trim(),
                valorPauta: valorPauta || null,
                importado: !!(document.getElementById('pfImportado') || {}).checked,
                atualizadoEm: new Date().toISOString()
            },
            ultimaAtualizacao: new Date().toISOString()
        };
        loading(true, 'Salvando produto fiscal...');
        try {
            var tid = state.tenant || await resolveTenant();
            var res = await svc().saveToFirebase('companies/' + tid + '/' + NODE, id, payload);
            if (res && res.success === false) throw new Error(res.error || 'Falha ao salvar.');
            closeModal();
            toast('Produto fiscal salvo.', 'success');
            upsertLocal(payload, id);
            invalidateBase();
            await carregar();
        } catch (e) {
            toast('Erro ao salvar: ' + (e && e.message ? e.message : e), 'error');
        } finally {
            loading(false);
        }
    }

    async function remove(id) {
        if (!id) return;
        var ok = true;
        try {
            if (typeof window.confirmDialog === 'function') {
                ok = await window.confirmDialog({ title: 'Excluir produto fiscal', message: 'Excluir este produto fiscal?', danger: true, confirmLabel: 'Excluir' });
            } else {
                ok = window.confirm('Excluir este produto fiscal?');
            }
        } catch (_) { ok = true; }
        if (!ok) return;
        loading(true, 'Excluindo produto fiscal...');
        try {
            var tid = state.tenant || await resolveTenant();
            var s = svc();
            if (typeof s.removeFromFirebase === 'function') {
                var res = await s.removeFromFirebase('companies/' + tid + '/' + NODE + '/' + id);
                if (res && res.success === false) throw new Error(res.error || 'Falha ao excluir.');
            } else {
                await s.saveToFirebase('companies/' + tid + '/' + NODE, null, state.items.filter(function (p) { return recordKey(p) !== String(id); }));
            }
            toast('Produto fiscal excluído.', 'success');
            state.items = state.items.filter(function (p) { return recordKey(p) !== String(id); });
            render();
            invalidateBase();
            await carregar();
        } catch (e) {
            toast('Erro ao excluir: ' + (e && e.message ? e.message : e), 'error');
        } finally {
            loading(false);
        }
    }

    function findById(id) {
        return state.items.find(function (p) { return recordKey(p) === String(id) || String(p.id || p.codigo || '') === String(id); }) || null;
    }

    function bind() {
        if (state.bound) return;
        state.bound = true;
        var search = document.getElementById('pfSearch');
        if (search) search.addEventListener('input', function () { state.page = 1; render(); });
        var novo = document.getElementById('pfNewBtn');
        if (novo) novo.addEventListener('click', function () { openModal(null); });
        var close = document.getElementById('pfCloseModal');
        if (close) close.addEventListener('click', closeModal);
        var cancel = document.getElementById('pfCancelBtn');
        if (cancel) cancel.addEventListener('click', closeModal);
        var form = document.getElementById('pfForm');
        if (form) form.addEventListener('submit', save);
        var modal = document.getElementById('pfModal');
        if (modal) modal.addEventListener('click', function (e) { if (e.target === modal) closeModal(); });
        document.addEventListener('keydown', function (e) { if (e.key === 'Escape') closeModal(); });
    }

    window.ProdutosFiscais = {
        init: function () { bind(); carregar(); },
        edit: function (id) { openModal(findById(id)); },
        remove: remove,
        reload: carregar
    };

    function boot() {
        try { bind(); } catch (_) {}
        carregar();
    }
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', boot, { once: true });
    } else {
        boot();
    }
})();