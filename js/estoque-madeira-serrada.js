/* Estoque de Madeira Serrada - companies/{tenant}/produtos (mesma base de Vendas) */
(function () {
    'use strict';

    var NODE = 'produtos';
    var PAGE_OPTIONS = [10, 25, 50, 100];
    var PAGE_DEFAULT = 25;
    var ROM_PATHS = { romaneiosTL: 'romaneios/tl', romaneiosPct: 'romaneios/pct', romaneiosPes: 'romaneios/pes' };
    var C = window.EstoqueSerradoCore;
    var state = {
        tenant: '', items: [], filtered: [], page: 1, pageSize: PAGE_DEFAULT,
        editingKey: '', editingBase: null, stage: [], groups: [], romaneios: [], romaneio: null,
        modalOpen: false, bodyOverflow: ''
    };

    function svc() { return window.firebaseService || window.FirebaseService || null; }
    function esc(v) { return String(v == null ? '' : v).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;'); }
    function escJs(v) { return String(v == null ? '' : v).replace(/\\/g, '\\\\').replace(/'/g, "\\'"); }
    function toast(msg, tipo) {
        try { if (typeof window.notifyUser === 'function') return window.notifyUser(msg, tipo || 'info'); } catch (_) {}
        try { if (window.ToastManager) { var fn = tipo === 'error' ? ToastManager.error : tipo === 'success' ? ToastManager.success : tipo === 'warning' ? ToastManager.warning : ToastManager.info; if (fn) return fn(msg); } } catch (_) {}
        console.log('[EstoqueMadeira]', msg);
    }
    function loading(show, txt) { try { if (window.SiswebLoading) show ? SiswebLoading.show(txt || 'Carregando...') : SiswebLoading.hide(); } catch (_) {} }
    function norm(v) { return String(v == null ? '' : v).normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase(); }
    function num(v) { return C.num(v); }
    function money(v) { return C.formatCurrency(v); }
    function fmt(v, d) { return C.formatNumber(v, d); }
    function parseMoney(raw) {
        var s = String(raw == null ? '' : raw).trim().replace(/[^\d.,-]/g, '');
        if (!s) return 0;
        if (s.indexOf(',') >= 0) s = s.replace(/\./g, '').replace(',', '.');
        var n = Number(s); return Number.isFinite(n) ? n : 0;
    }
    function recordKey(p) { return String((p && (p.__key || p.firebaseKey || p.key || p.id || p.codigo)) || ''); }
    function nomeProduto(p) { return C.nomeExibicao(p); }

    function normalizeList(data) {
        var out = [];
        function add(p, key) {
            if (!p || typeof p !== 'object') return;
            if (!(p.nome || p.name || p.nomeComum || p.nomeCientifico || p.descricao)) return;
            var item = Object.assign({}, p);
            item.__key = String(key);
            out.push(item);
        }
        if (Array.isArray(data)) {
            data.forEach(function (p, i) { add(p, i); });
        } else if (data && typeof data === 'object') {
            Object.keys(data).forEach(function (k) { add(data[k], k); });
        }
        return out;
    }

    function productBlob(p) {
        return norm([p.codigo, nomeProduto(p), p.descricao, p.especie, p.unidade, p.tipoProduto,
            p.romaneioNumero, p.romaneioTipo, p.espessura, p.largura, p.comprimento,
            money(p.preco != null ? p.preco : (p.precoVenda != null ? p.precoVenda : p.price)),
            p.estoque].join(' '));
    }
    function nextCode(extraUsed) {
        var max = 0, used = {};
        state.items.forEach(function (p) {
            var c = String(p.codigo == null ? '' : p.codigo).trim();
            if (!c) return;
            used[c] = true;
            if (/^\d+$/.test(c)) max = Math.max(max, parseInt(c, 10) || 0);
        });
        if (extraUsed && typeof extraUsed.forEach === 'function') {
            extraUsed.forEach(function (c) { if (c != null && String(c).trim()) used[String(c).trim()] = true; });
        }
        var n = max + 1;
        function code(v) { var s = String(v); while (s.length < 6) s = '0' + s; return s; }
        while (used[code(n)] || used[String(n)]) n++;
        return code(n);
    }
    function nextId() { return 'PROD_' + Date.now().toString(36) + '_' + Math.random().toString(36).slice(2, 7); }
    function dimsText(p) {
        var e = num(p.espessura), l = num(p.largura), c = num(p.comprimento);
        if (!e && !l && !c) return '—';
        return [e, l, c].map(function (n) { return n ? String(n).replace('.', ',') : '0'; }).join(' × ');
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
        return 'ems_' + (state.tenant || 'default') + '_' + (uid || 'anon') + '_items_per_page';
    }
    function restorePageSize() { try { var v = parseInt(localStorage.getItem(pageSizeKey()) || '', 10); if (PAGE_OPTIONS.indexOf(v) >= 0) state.pageSize = v; } catch (_) {} }
    function setPageSize(v) { var n = parseInt(v, 10); if (PAGE_OPTIONS.indexOf(n) < 0) return; state.pageSize = n; state.page = 1; try { localStorage.setItem(pageSizeKey(), String(n)); } catch (_) {} render(); }
    function goPage(p) { var pages = Math.max(1, Math.ceil(state.filtered.length / state.pageSize)); state.page = Math.min(Math.max(1, parseInt(p, 10) || 1), pages); render(); }

    async function load() {
        loading(true, 'Carregando estoque de madeira serrada...');
        try {
            await resolveTenant();
            restorePageSize();
            var res = await svc().loadFromFirebase(NODE);
            var data = res && res.data !== undefined ? res.data : res;
            state.items = normalizeList(data).sort(function (a, b) {
                return nomeProduto(a).localeCompare(nomeProduto(b), 'pt-BR');
            });
            render();
        } catch (e) { toast('Erro ao carregar estoque: ' + (e && e.message ? e.message : e), 'error'); }
        finally { loading(false); }
    }
    function invalidate() {
        try {
            var s = svc();
            if (s && typeof s.invalidateReadCacheForPath === 'function') {
                if (state.tenant) s.invalidateReadCacheForPath('companies/' + state.tenant + '/' + NODE);
                s.invalidateReadCacheForPath(NODE);
            }
        } catch (_) {}
    }

    function visibleItems() {
        return state.items.filter(function (p) {
            return !C.isProdutoJunk(p) && !C.estoqueZeradoNaLista(p);
        });
    }
    function applyFilter() {
        var q = String((document.getElementById('emsSearch') || {}).value || '').trim();
        var base = visibleItems();
        if (!q) { state.filtered = base; return; }
        var qn = norm(q);
        state.filtered = base.filter(function (p) { return productBlob(p).indexOf(qn) >= 0; });
        state.filtered.sort(function (a, b) {
            var ea = norm(a.codigo) === qn ? 0 : 1, eb = norm(b.codigo) === qn ? 0 : 1;
            return ea - eb || nomeProduto(a).localeCompare(nomeProduto(b), 'pt-BR');
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
        var inf = document.createElement('span'); inf.className = 'pagination-total-info'; inf.textContent = 'Pág. ' + state.page + '/' + pages + ' — ' + total + ' produto(s)'; pag.appendChild(inf);
    }
    function render() {
        applyFilter();
        var tbody = document.getElementById('emsTableBody'); if (!tbody) return;
        var total = state.filtered.length, pages = Math.max(1, Math.ceil(total / state.pageSize));
        if (state.page > pages) state.page = pages;
        var ini = (state.page - 1) * state.pageSize, slice = state.filtered.slice(ini, ini + state.pageSize);
        if (!slice.length) {
            var msg = !state.items.length ? 'Nenhum produto no estoque.' : (visibleItems().length ? 'Nenhum produto encontrado.' : 'Nenhum produto no estoque.');
            tbody.innerHTML = '<tr><td colspan="7" class="ems-empty">' + msg + '</td></tr>';
        } else {
            tbody.innerHTML = slice.map(function (p) {
                var key = escJs(recordKey(p));
                var serrado = C.temDimsSerrado(p);
                var estoque = serrado ? fmt(num(p.pecas), 0) : (fmt(num(p.estoque != null ? p.estoque : p.quantidade), 3) + ' ' + (p.unidade || 'UN'));
                var ml = serrado ? fmt(C.metrosLineares(p), 2) + ' ml' : '-';
                var vol = serrado ? fmt(C.volumeProduto(p), 3) + ' m³' : '-';
                return '<tr>' +
                    '<td data-label="Código">' + esc(p.codigo || '—') + '</td>' +
                    '<td data-label="Nome">' + esc(nomeProduto(p)) + '</td>' +
                    '<td data-label="Preço" class="ems-stock">' + esc(money(p.preco != null ? p.preco : (p.precoVenda != null ? p.precoVenda : p.price))) + '</td>' +
                    '<td data-label="Estoque" class="ems-stock">' + esc(estoque) + '</td>' +
                    '<td data-label="M. Linear">' + esc(ml) + '</td>' +
                    '<td data-label="Volume (m³)">' + esc(vol) + '</td>' +
                    '<td data-label="Ações" class="ems-actions">' +
                        '<button type="button" class="btn btn-primary btn-small" title="Editar" onclick="EstoqueMadeiraSerrada.edit(\'' + key + '\')"><i class="fas fa-edit"></i></button> ' +
                        '<button type="button" class="btn btn-danger btn-small" title="Excluir" onclick="EstoqueMadeiraSerrada.remove(\'' + key + '\')"><i class="fas fa-trash"></i></button>' +
                    '</td></tr>';
            }).join('');
        }
        renderPagination(total, pages);
    }

    function setVal(id, v) { var el = document.getElementById(id); if (el) el.value = v == null ? '' : v; }
    function getVal(id) { return (document.getElementById(id) || {}).value || ''; }
    function currentType() { var r = document.querySelector('input[name="emsTipo"]:checked'); return r ? r.value : 'manual'; }
    function setDisplay(id, show) {
        var el = document.getElementById(id);
        if (el) el.style.display = show ? 'block' : 'none';
    }
    function setBtn(id, show) {
        var el = document.getElementById(id);
        if (el) el.style.setProperty('display', show ? 'inline-flex' : 'none', 'important');
    }
    function setType(t) {
        var isRom = t === 'romaneio';
        var editing = !!state.editingKey;
        setDisplay('emsBaseSection', !isRom || editing);
        setDisplay('emsDimsSection', !isRom || editing);
        setDisplay('emsManualSection', !isRom && !editing);
        setDisplay('emsRomaneioSection', isRom);
        setDisplay('emsRomLoadRow', isRom && !editing);
        setDisplay('emsRomPreviewTitle', isRom && !editing);
        setDisplay('emsRomPreview', isRom && !editing);
        setBtn('emsAddItemBtn', !editing && !isRom);
        setBtn('emsClearItemsBtn', !editing && !isRom);
        setBtn('emsSaveBtn', editing);
        setBtn('emsAddStockBtn', !editing);
        var radio = document.querySelector('input[name="emsTipo"][value="' + (isRom ? 'romaneio' : 'manual') + '"]');
        if (radio) radio.checked = true;
    }
    function resetDims() {
        setVal('emsEspecie', '');
        setVal('emsEspessura', '');
        setVal('emsLargura', '');
        setVal('emsComprimento', '');
        setVal('emsPecas', '1');
        setVal('emsPpp', '1');
        setVal('emsVolume', '');
    }
    function resetStage() { state.stage = []; renderManualPreview(); }
    function resetGroups() { state.groups = []; renderRomPreview(); }

    function openModal(item) {
        var modal = document.getElementById('emsModal'); if (!modal) return;
        state.editingKey = item ? recordKey(item) : '';
        state.editingBase = item || null;
        state.stage = []; state.groups = []; state.romaneio = null;
        document.getElementById('emsModalTitle').textContent = item ? 'Editar Produto' : 'Novo Produto';
        setVal('emsId', state.editingKey);
        setVal('emsCodigo', item ? (item.codigo || '') : nextCode());
        setVal('emsNome', item ? nomeProduto(item) : '');
        setVal('emsPreco', item && (item.preco || item.precoVenda || item.price) ? String(item.preco != null ? item.preco : (item.precoVenda != null ? item.precoVenda : item.price)).replace('.', ',') : '');
        setVal('emsEstoque', item && item.estoque != null ? String(item.estoque) : (item && item.quantidade != null ? String(item.quantidade) : ''));
        setVal('emsUnidade', item ? (item.unidade || 'UN') : 'UN');
        setVal('emsDescricao', item ? (item.descricao || '') : '');
        setVal('emsEspecie', item ? (item.especie || '') : '');
        setVal('emsEspessura', item && item.espessura != null ? item.espessura : '');
        setVal('emsLargura', item && item.largura != null ? item.largura : '');
        setVal('emsComprimento', item && item.comprimento != null ? item.comprimento : '');
        setVal('emsPecas', item && item.pecas != null ? item.pecas : 1);
        setVal('emsPpp', item && item.pecasPorPacote != null ? item.pecasPorPacote : 1);
        setVal('emsRomTipo', item && item.romaneioTipo ? item.romaneioTipo : '');
        var romSel = document.getElementById('emsRomSelect');
        if (romSel) {
            romSel.innerHTML = '<option value="">Selecione o tipo primeiro...</option>';
            if (item && item.romaneioId) {
                var opt = document.createElement('option');
                opt.value = String(item.romaneioId);
                opt.textContent = item.romaneioNumero || 'Romaneio';
                romSel.appendChild(opt);
                romSel.value = String(item.romaneioId);
            }
        }
        var romRadio = document.querySelector('input[name="emsTipo"][value="romaneio"]');
        if (romRadio) romRadio.disabled = false;
        var tipo = item && item.tipoProduto === 'romaneio' ? 'romaneio' : 'manual';
        setType(tipo);
        resetStage(); resetGroups(); updateVolume(); renderManualPreview();
        modal.classList.add('active');
        if (!state.modalOpen) {
            state.modalOpen = true;
            state.bodyOverflow = document.body.style.overflow || '';
            document.body.classList.add('ems-modal-open');
            document.body.style.overflow = 'hidden';
        }
        setTimeout(function () { var el = document.getElementById('emsNome'); if (el) el.focus(); }, 50);
    }
    function closeModal() {
        var m = document.getElementById('emsModal');
        if (m) m.classList.remove('active');
        if (state.modalOpen) {
            state.modalOpen = false;
            document.body.classList.remove('ems-modal-open');
            document.body.style.overflow = state.bodyOverflow || '';
        }
    }

    function renderManualPreview() {
        var box = document.getElementById('emsManualPreview'); if (!box) return;
        if (!state.stage.length) { box.innerHTML = '<span class="ems-help">Preencha os campos e clique em Adicionar item.</span>'; return; }
        box.innerHTML = state.stage.map(function (it, i) {
            return '<div class="ems-preview-row"><div class="ems-preview-main"><strong>' + esc(it.codigo || '-') + ' — ' + esc(it.nome || '-') + '</strong>' +
                '<small>Preço: ' + esc(money(it.preco)) + ' · Estoque: ' + esc(fmt(it.estoque, 3) + ' ' + (it.unidade || 'UN')) +
                (it.volumeM3 > 0 ? ' · ' + esc(fmt(it.volumeM3, 3) + ' m³ · ' + fmt(it.metrosLineares, 2) + ' ml') : '') +
                (it.especie ? ' · ' + esc(it.especie) : '') + '</small></div>' +
                '<button type="button" class="btn btn-danger btn-small" data-ems-remove="' + i + '">Excluir</button></div>';
        }).join('') + '<div style="text-align:right;font-weight:700;">' + state.stage.length + ' item(ns)</div>';
        box.querySelectorAll('[data-ems-remove]').forEach(function (b) {
            b.onclick = function () { state.stage.splice(parseInt(b.dataset.emsRemove, 10), 1); renderManualPreview(); };
        });
    }
    function updateVolume() {
        var v = C.calcularVolume(getVal('emsEspessura'), getVal('emsLargura'), getVal('emsComprimento'), getVal('emsPecas'), getVal('emsPpp'));
        setVal('emsVolume', v > 0 ? fmt(v, 3) : '');
        return v;
    }
    function clearManualFields() {
        var usedCodes = new Set(state.items.map(function (p) { return String(p.codigo || '').trim(); }).filter(Boolean));
        state.stage.forEach(function (it) { if (it.codigo) usedCodes.add(String(it.codigo)); });
        setVal('emsCodigo', nextCode(usedCodes));
        setVal('emsNome', ''); setVal('emsPreco', ''); setVal('emsEstoque', '');
        setVal('emsDescricao', ''); setVal('emsUnidade', 'UN');
        resetDims();
    }
    function addManualItem() {
        var nome = String(getVal('emsNome')).trim();
        if (!nome) { toast('Informe o nome do produto.', 'warning'); return; }
        var codigo = String(getVal('emsCodigo')).trim();
        if (!/^\d+$/.test(codigo)) codigo = nextCode();
        var duplicado = state.items.some(function (p) { return String(p.codigo || '').trim() === codigo && recordKey(p) !== state.editingKey; })
            || state.stage.some(function (it) { return String(it.codigo) === codigo; });
        if (duplicado) { toast('Já existe produto com este código.', 'warning'); return; }
        var pecas = num(getVal('emsPecas'));
        var ppp = num(getVal('emsPpp')) || 1;
        var volume = updateVolume();
        var comprimento = num(getVal('emsComprimento'));
        state.stage.push({
            codigo: codigo, nome: nome, preco: parseMoney(getVal('emsPreco')),
            estoque: num(getVal('emsEstoque')), unidade: getVal('emsUnidade') || 'UN',
            descricao: String(getVal('emsDescricao')).trim(), especie: String(getVal('emsEspecie')).trim(),
            espessura: num(getVal('emsEspessura')), largura: num(getVal('emsLargura')), comprimento: comprimento,
            pecas: pecas, pecasPorPacote: ppp, volumeM3: volume,
            metrosLineares: volume > 0 ? C.metrosLineares({ comprimento: comprimento, pecas: pecas }) : 0,
            tipoProduto: 'manual'
        });
        clearManualFields();
        renderManualPreview();
    }

    async function saveOne(payload, key) {
        var res = await svc().saveToFirebase(NODE, key || payload.id, payload);
        if (res && res.success === false) throw new Error(res.error || 'Falha ao salvar.');
        return res;
    }
    function assertNomeCodigo(payload, baseKey) {
        if (C.isNomeFantasma(payload.nome)) throw new Error('Informe o nome do produto.');
        var dup = state.items.some(function (p) {
            return String(p.codigo || '').trim() === String(payload.codigo || '').trim() && recordKey(p) !== String(baseKey || '');
        });
        if (dup) throw new Error('Já existe produto com este código.');
    }
    async function saveManual() {
        loading(true, 'Salvando produto...');
        try {
            await resolveTenant();
            var tipo = currentType();
            if (state.editingKey) {
                var item = state.items.find(function (p) { return recordKey(p) === state.editingKey; }) || state.editingBase || {};
                var src = {
                    codigo: String(getVal('emsCodigo')).trim() || item.codigo || nextCode(),
                    nome: String(getVal('emsNome')).trim(),
                    preco: parseMoney(getVal('emsPreco')),
                    estoque: num(getVal('emsEstoque')),
                    unidade: getVal('emsUnidade') || 'UN',
                    descricao: String(getVal('emsDescricao')).trim(),
                    especie: String(getVal('emsEspecie')).trim(),
                    espessura: num(getVal('emsEspessura')),
                    largura: num(getVal('emsLargura')),
                    comprimento: num(getVal('emsComprimento')),
                    pecas: num(getVal('emsPecas')),
                    pecasPorPacote: num(getVal('emsPpp')) || 1,
                    tipoProduto: tipo,
                };
                if (tipo === 'romaneio') {
                    src.romaneioTipo = item.romaneioTipo || '';
                    src.romaneioId = getVal('emsRomSelect') || item.romaneioId || '';
                    src.romaneioNumero = item.romaneioNumero || '';
                }
                var payload = buildPayload(item, src);
                assertNomeCodigo(payload, state.editingKey);
                await saveOne(payload, state.editingKey);
                toast('Produto atualizado.', 'success');
            } else {
                if (!state.stage.length) { toast('Adicione ao menos um item no Preview.', 'warning'); return; }
                for (var i = 0; i < state.stage.length; i++) {
                    var it = state.stage[i];
                    var existente = state.items.find(function (p) { return String(p.codigo || '').trim() === String(it.codigo).trim(); });
                    if (existente) {
                        var pecas = num(existente.pecas) + num(it.pecas);
                        var volume = C.r3(C.volumeProduto(existente) + num(it.volumeM3));
                        var ml = C.r2(C.metrosLineares(existente) + num(it.metrosLineares));
                        var merged = Object.assign({}, existente, {
                            pecas: pecas,
                            volumeM3: volume,
                            estoque: volume > 0 ? volume : (num(existente.estoque) + num(it.estoque)),
                            metrosLineares: ml,
                            updated: new Date().toISOString(),
                        });
                        var mergedPayload = buildPayload(existente, merged);
                        await saveOne(mergedPayload, recordKey(existente));
                    } else {
                        var novo = buildPayload({}, it);
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
        var clean = Object.assign({}, base || {});
        delete clean.__key;
        var id = clean.id || (state.editingKey && !clean.id ? state.editingKey : nextId());
        var tipo = src.tipoProduto === 'romaneio' || clean.tipoProduto === 'romaneio' ? 'romaneio' : 'manual';
        var pecas = src.pecas != null ? Number(src.pecas) || 0 : Number(clean.pecas) || 0;
        var ppp = src.pecasPorPacote != null ? (Number(src.pecasPorPacote) || 1) : (Number(clean.pecasPorPacote) || 1);
        var esp = src.espessura != null ? Number(src.espessura) || 0 : Number(clean.espessura) || 0;
        var lar = src.largura != null ? Number(src.largura) || 0 : Number(clean.largura) || 0;
        var comp = src.comprimento != null ? Number(src.comprimento) || 0 : Number(clean.comprimento) || 0;
        var calculado = C.calcularVolume(esp, lar, comp, pecas, ppp);
        var volume = calculado > 0 ? calculado : (Number(src.volumeM3) > 0 ? C.r3(src.volumeM3) : (Number(clean.volumeM3) || 0));
        var ml = comp > 0 && pecas >= 0 ? C.metrosLineares({ comprimento: comp, pecas: pecas }) : (Number(clean.metrosLineares) || 0);
        var estoque = Number(src.estoque) || 0;
        if (volume > 0 && (tipo === 'romaneio' || C.temDimsSerrado(src) || C.temDimsSerrado(clean))) estoque = volume;
        var nome = String(src.nome || '').trim() || C.nomeSignificativo(clean.nomeComum, clean.nome, clean.name, clean.nomeCientifico);
        return Object.assign(clean, {
            id: id,
            codigo: String(src.codigo || clean.codigo || '').trim(),
            nome: nome,
            preco: Number(src.preco) || 0,
            estoque: estoque,
            unidade: tipo === 'romaneio' ? 'm³' : (src.unidade || clean.unidade || 'UN'),
            descricao: src.descricao != null ? src.descricao : (clean.descricao || ''),
            especie: src.especie != null ? src.especie : (clean.especie || ''),
            espessura: esp,
            largura: lar,
            comprimento: comp,
            pecas: pecas,
            pecasPorPacote: ppp,
            volumeM3: volume,
            metrosLineares: ml,
            tipoProduto: tipo,
            romaneioTipo: src.romaneioTipo != null ? src.romaneioTipo : (clean.romaneioTipo || ''),
            romaneioId: src.romaneioId != null ? src.romaneioId : (clean.romaneioId || ''),
            romaneioNumero: src.romaneioNumero != null ? src.romaneioNumero : (clean.romaneioNumero || ''),
            created: clean.created || now,
            updated: now,
        });
    }

    function normalizeAnyList(data) {
        var out = [];
        function add(p, key) { if (p && typeof p === 'object') { var it = Object.assign({}, p); it.__key = String(key); out.push(it); } }
        if (Array.isArray(data)) data.forEach(function (p, i) { add(p, i); });
        else if (data && typeof data === 'object') Object.keys(data).forEach(function (k) { if (k !== '_metadata' && k !== 'metadata') add(data[k], k); });
        return out;
    }
    function romaneioKey(r) { return String((r && (r.id || r.firebaseKey || r.numero || r.__key)) || ''); }
    function romDateMs(r) {
        var candidates = [r && r.dataEmissao, r && r.data, r && r.dataRomaneio, r && r.dataHora,
            r && r.createdAt, r && r.created, r && r.timestamp];
        for (var i = 0; i < candidates.length; i++) {
            var c = candidates[i];
            if (c === undefined || c === null || c === '') continue;
            if (typeof c === 'number' && isFinite(c)) return c;
            var parsed = Date.parse(c);
            if (!isNaN(parsed)) return parsed;
        }
        return 0;
    }
    async function loadRomaneios(tipo) {
        var path = ROM_PATHS[tipo]; if (!path) return [];
        var res = await svc().loadFromFirebase(path);
        var data = res && res.data !== undefined ? res.data : res;
        return normalizeAnyList(data).sort(function (a, b) {
            var da = romDateMs(a), db = romDateMs(b);
            var na = parseInt(romNumero(a), 10) || 0, nb = parseInt(romNumero(b), 10) || 0;
            if (!da && !db) return na - nb;
            if (!da) return 1;
            if (!db) return -1;
            return (da - db) || (na - nb);
        });
    }
    async function onRomTipoChange() {
        var tipo = getVal('emsRomTipo'); var sel = document.getElementById('emsRomSelect');
        state.romaneio = null;
        if (!sel) return; sel.innerHTML = '<option value="">Selecione um romaneio...</option>';
        if (!tipo) return;
        loading(true, 'Carregando romaneios...');
        try {
            state.romaneios = await loadRomaneios(tipo);
            state.romaneios.forEach(function (r) {
                var opt = document.createElement('option');
                opt.value = romaneioKey(r);
                opt.textContent = romLabel(r);
                sel.appendChild(opt);
            });
            if (!state.romaneios.length) toast('Nenhum romaneio encontrado para este tipo.', 'warning');
        } catch (e) { toast('Erro ao carregar romaneios: ' + (e && e.message ? e.message : e), 'error'); }
        finally { loading(false); }
    }
    function onRomSelectChange() {
        var key = getVal('emsRomSelect');
        state.romaneio = state.romaneios.find(function (r) { return romaneioKey(r) === key; }) || null;
        resetGroups();
    }
    function romNumero(r) {
        var n = String((r && (r.numeroExibicao || r.numeroRomaneio || r.numero)) || '').trim();
        if (/^(TL_|PCT_|PES_|TORA_)/i.test(n)) n = String((r && (r.sequencial || r.numeroSequencial || r.seq)) || '').trim();
        return n;
    }
    function romDate(r) {
        var candidates = [r && r.dataEmissao, r && r.data, r && r.dataHora, r && r.createdAt, r && r.created,
            r && r.dataRomaneio, r && r.timestamp, r && r.updatedAt, r && r.updated, r && r.lastModified];
        for (var i = 0; i < candidates.length; i++) {
            if (!candidates[i]) continue;
            var d = new Date(candidates[i]);
            if (!isNaN(d.getTime())) return d.toLocaleDateString('pt-BR');
        }
        return 'S/Data';
    }
    function romaneioVolume(it) {
        var candidates = [it && it.volume, it && it.volumeM3, it && it.volumeTotal, it && it.totalVolume, it && it.totais && it.totais.volume];
        for (var i = 0; i < candidates.length; i++) { var n = num(candidates[i]); if (n > 0) return n; }
        return C.calcularVolume(it && it.espessura, it && it.largura, it && (it.comprimento || it.comp),
            (it && (it.quantidade || it.pecas || it.qtd)) || 1, (it && (it.pecasPorPacote || it.ppp)) || 1);
    }
    function romVolumeTotal(r) {
        var candidates = [r && r.totalVolume, r && r.volumeTotal, r && r.totais && r.totais.volume];
        for (var i = 0; i < candidates.length; i++) { var n = num(candidates[i]); if (n > 0) return n; }
        var raw = r && (r.items || r.itens);
        var itens = Array.isArray(raw) ? raw : (raw && typeof raw === 'object' ? Object.values(raw) : []);
        var total = 0;
        itens.forEach(function (it) { if (it && typeof it === 'object') total += romaneioVolume(it); });
        return C.r3(total);
    }
    function romLabel(r) {
        var nome = r.clienteNome || (r.cliente && (r.cliente.nome || r.cliente.name))
            || (r.fornecedor && (r.fornecedor.nome || r.fornecedor.name))
            || r.fornecedor || r.numero || 'Cliente não informado';
        var vol = fmt(romVolumeTotal(r), 3);
        var num = romNumero(r);
        return romDate(r) + ' - ' + String(nome) + ' - ' + vol + ' m³' + (num ? ' - Nº ' + num : '');
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
            var qtd = num(it.quantidade || it.pecas || it.qtd || 1);
            var preco = num(it.precoUnitario || it.precoMedio || it.preco || it.valorUnitario);
            var g = map.get(gid) || {
                gid: gid, especie: especie, espessura: e, largura: l, comprimento: c,
                volume: 0, pecas: 0, valorTotal: 0, preco: 0,
                romaneioId: romaneioKey(rom), romaneioNumero: romNumero(rom), romaneioTipo: tipo,
            };
            g.volume = C.r3(g.volume + romaneioVolume(it));
            g.pecas += qtd;
            g.valorTotal += preco * qtd;
            map.set(gid, g);
        });
        return Array.from(map.values()).map(function (g) {
            g.preco = g.pecas > 0 ? C.r2(g.valorTotal / g.pecas) : 0;
            g.ml = C.r2((g.comprimento / 100) * g.pecas);
            return g;
        });
    }
    function sameProduct(p, g) {
        return p.tipoProduto === 'romaneio'
            && String(p.romaneioId || '') === String(g.romaneioId || '')
            && norm(p.especie || '') === norm(g.especie || '')
            && num(p.espessura) === num(g.espessura) && num(p.largura) === num(g.largura) && num(p.comprimento) === num(g.comprimento);
    }
    function disponibilidade(g) {
        var estPecas = 0, estVol = 0, estMl = 0;
        state.items.forEach(function (p) {
            if (!sameProduct(p, g)) return;
            estPecas += num(p.pecas);
            estVol += C.volumeProduto(p);
            estMl += num(p.metrosLineares);
        });
        var dispPecas = Math.max(0, num(g.pecas) - estPecas);
        var dispVol = Math.max(0, C.r3(num(g.volume) - estVol));
        var dispMl = Math.max(0, C.r2((num(g.ml) || C.r2((num(g.comprimento) / 100) * num(g.pecas))) - estMl));
        return {
            travado: !(dispPecas > 0 || dispVol > 0),
            parcial: (dispPecas > 0 || dispVol > 0) && (dispPecas < num(g.pecas) || dispVol < num(g.volume)),
            dispPecas: dispPecas, dispVol: dispVol, dispMl: dispMl,
            estPecas: estPecas, estVol: C.r3(estVol), estMl: C.r2(estMl),
        };
    }
    function renderRomPreview() {
        var box = document.getElementById('emsRomPreview'); if (!box) return;
        if (!state.groups.length) { box.innerHTML = '<span class="ems-help">Selecione o tipo e o romaneio, depois clique em Carregar Itens.</span>'; return; }
        box.innerHTML = state.groups.map(function (g, i) {
            var d = disponibilidade(g);
            var detalhe = d.travado
                ? 'já em estoque — desativado'
                : (d.parcial ? 'Disponível: ' + esc(fmt(d.dispPecas, 0)) + ' pç · ' + esc(fmt(d.dispVol, 3)) + ' m³ · ' + esc(fmt(d.dispMl, 2)) + ' ml' : money(g.preco));
            return '<label class="ems-preview-row"><input type="checkbox" class="ems-group-check" data-ems-group="' + i + '"' + (d.travado ? ' disabled' : ' checked') + '>' +
                '<span class="ems-preview-main"><strong>' + esc(g.especie) + ' ' + esc([g.espessura, g.largura, g.comprimento].join(' × ')) + '</strong>' +
                '<small>' + fmt(g.volume, 3) + ' m³ · ' + esc(g.pecas) + ' peça(s) · ' + detalhe + '</small></span></label>';
        }).join('');
    }
    async function addGroups() {
        var checks = Array.from(document.querySelectorAll('#emsRomPreview [data-ems-group]:checked'));
        if (!checks.length) { toast('Marque ao menos um grupo no Preview.', 'warning'); return; }
        loading(true, 'Adicionando ao estoque...');
        var usedCodes = new Set(state.items.map(function (p) { return String(p.codigo || '').trim(); }).filter(Boolean));
        var saved = 0;
        try {
            for (var i = 0; i < checks.length; i++) {
                var g = state.groups[parseInt(checks[i].dataset.emsGroup, 10)]; if (!g) continue;
                var d = disponibilidade(g);
                if (d.travado || (d.dispVol <= 0 && d.dispPecas <= 0)) continue;
                var codigo = nextCode(usedCodes);
                usedCodes.add(codigo);
                var novo = buildPayload({}, {
                    codigo: codigo, nome: (g.especie + ' ' + [g.espessura, g.largura, g.comprimento].join('x')).trim(),
                    preco: g.preco, estoque: d.dispVol, unidade: 'm³',
                    descricao: 'Madeira serrada' + (g.romaneioNumero ? ' (Nº ' + g.romaneioNumero + ')' : ''),
                    especie: g.especie, espessura: g.espessura, largura: g.largura, comprimento: g.comprimento,
                    pecas: d.dispPecas, pecasPorPacote: 1, volumeM3: d.dispVol,
                    metrosLineares: d.dispMl, tipoProduto: 'romaneio',
                    romaneioTipo: g.romaneioTipo, romaneioId: g.romaneioId, romaneioNumero: g.romaneioNumero,
                });
                await saveOne(novo, novo.id);
                saved++;
            }
            toast(saved + ' grupo(s) adicionado(s) ao estoque.', saved ? 'success' : 'warning');
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
            var res = await s.removeFromFirebase(NODE + '/' + key);
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
        var clearItems = document.getElementById('emsClearItemsBtn'); if (clearItems) clearItems.addEventListener('click', function () { resetStage(); clearManualFields(); });
        var addStock = document.getElementById('emsAddStockBtn'); if (addStock) addStock.addEventListener('click', function () { if (currentType() === 'romaneio') addGroups(); else saveManual(); });
        document.querySelectorAll('input[name="emsTipo"]').forEach(function (r) {
            r.addEventListener('change', function () {
                if (!state.editingKey) { resetStage(); resetGroups(); clearManualFields(); }
                setType(currentType());
            });
        });
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
