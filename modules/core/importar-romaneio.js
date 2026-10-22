(function () {
    'use strict';

    var PATHS = { tl: 'romaneios/tl', pct: 'romaneios/pct', pes: 'romaneios/pes', tora: 'romaneios/tora' };
    var LABELS = { tl: 'TL', pct: 'PCT', pes: 'PES', tora: 'TORA' };
    var state = {
        targetType: '',
        targetId: '',
        targetRecord: null,
        sourceType: '',
        records: [],
        selected: null,
        items: [],
        filter: ''
    };

    function svc() { return window.firebaseService || window.FirebaseService || null; }
    function esc(v) {
        return String(v == null ? '' : v).replace(/&/g, '&amp;').replace(/</g, '&lt;')
            .replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');
    }
    function norm(v) {
        return String(v == null ? '' : v).normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
    }
    function num(v) { return Number(v) || 0; }
    function fmt(v, d) { return (Number(v) || 0).toLocaleString('pt-BR', { minimumFractionDigits: d == null ? 3 : d, maximumFractionDigits: d == null ? 3 : d }); }
    function money(v) { return (Number(v) || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }); }
    function loading(show, text) {
        try {
            if (!window.SiswebLoading) return;
            if (show) window.SiswebLoading.show(text || 'Carregando...');
            else window.SiswebLoading.hide();
        } catch (_) {}
    }
    function toast(msg, type) {
        try { if (typeof window.notifyUser === 'function') { window.notifyUser(msg, type || 'info'); return; } } catch (_) {}
        try { if (window.ToastManager && typeof window.ToastManager[type || 'info'] === 'function') window.ToastManager[type || 'info'](msg); } catch (_) {}
    }
    function recordKey(r) {
        return String((r && (r.firebaseKey || r.__key || r.key || r.id || r.numero)) || '').trim();
    }
    function recordItems(r) {
        if (!r) return [];
        var raw = r.itens != null ? r.itens : r.items;
        if (Array.isArray(raw)) return raw.slice();
        if (raw && typeof raw === 'object') return Object.keys(raw).map(function (k) { return raw[k]; }).filter(Boolean);
        return [];
    }
    function recordLabel(r) {
        var cliente = r && (r.clienteNome || (r.cliente && (r.cliente.nome || r.cliente.name)) ||
            (r.fornecedor && (r.fornecedor.nome || r.fornecedor.name)) || r.fornecedor || '');
        var numero = r && (r.numeroExibicao || r.numeroFormatado || r.numeroSequencial || r.numero || '');
        var data = r && (r.dataEmissao || r.data || r.timestamp || '');
        var d = data ? new Date(data) : null;
        var dataTxt = d && !isNaN(d.getTime()) ? d.toLocaleDateString('pt-BR') : '';
        var itens = recordItems(r).length;
        return [dataTxt, cliente, numero ? 'Nº ' + numero : '', itens + ' item(ns)'].filter(Boolean).join(' · ');
    }
    function summaryItem(it) {
        var e = num(it.espessura || it.rodo || it.diametro);
        var l = num(it.largura);
        var c = num(it.comprimento || it.comp);
        var dims = [e, l, c].filter(function (v) { return v > 0; }).join(' x ');
        var qtd = num(it.quantidade || it.pecas || it.qtd);
        var vol = num(it.volume || it.volumeM3 || it.volumeTotal || it.volumeSerraria || it.volumeLiquido);
        var val = num(it.valorTotal || it.total || it.valor);
        return (it.especie || 'Sem espécie') + (dims ? ' · ' + dims : '') +
            (qtd ? ' · ' + fmt(qtd, 0) + ' pç' : '') +
            (vol ? ' · ' + fmt(vol, 3) + ' m³' : '') +
            (val ? ' · ' + money(val) : '');
    }
    async function loadCollection(type) {
        var s = svc();
        if (!s || typeof s.loadFromFirebase !== 'function') throw new Error('Firebase indisponível.');
        var res = await s.loadFromFirebase(PATHS[type]);
        if (res && res.success === false) throw new Error(res.error || 'Falha ao carregar romaneios.');
        var data = res && res.data !== undefined ? res.data : res;
        if (Array.isArray(data)) return data.filter(Boolean).map(function (r) {
            var out = Object.assign({}, r);
            if (!recordKey(out) && out.id) out.firebaseKey = String(out.id);
            return out;
        });
        if (data && typeof data === 'object') {
            return Object.keys(data).filter(function (k) { return k !== '_metadata' && k !== 'metadata'; }).map(function (k) {
                var out = Object.assign({}, data[k]);
                out.firebaseKey = k;
                if (out.id == null) out.id = k;
                return out;
            });
        }
        return [];
    }
    function ensureModal() {
        if (document.getElementById('importarRomaneioModal')) return;
        var style = document.createElement('style');
        style.id = 'importar-romaneio-style';
        style.textContent = [
            '#importarRomaneioModal{position:fixed;inset:0;z-index:10000055;display:none;align-items:center;justify-content:center;padding:18px;background:rgba(0,0,0,.62);}',
            '#importarRomaneioModal.active{display:flex;}',
            '#importarRomaneioModal .ir-card{width:min(900px,100%);max-height:calc(100dvh - 36px);display:flex;flex-direction:column;background:var(--sw-surface,#111827);color:var(--sw-text-1,#f1f5f9);border:1px solid var(--sw-border,#334155);border-radius:12px;overflow:hidden;box-shadow:0 18px 50px rgba(0,0,0,.35);}',
            '#importarRomaneioModal .ir-head{display:flex;align-items:center;justify-content:space-between;gap:12px;padding:16px 20px;background:var(--sw-brand,#ea580c);color:var(--sw-on-brand,#fff);}',
            '#importarRomaneioModal .ir-head h3{margin:0;font-size:20px;}',
            '#importarRomaneioModal .ir-close{border:0;background:transparent;color:inherit;font-size:26px;line-height:1;cursor:pointer;}',
            '#importarRomaneioModal .ir-body{padding:18px 20px;overflow:auto;display:grid;gap:14px;}',
            '#importarRomaneioModal .ir-grid{display:grid;grid-template-columns:1fr 2fr;gap:12px;}',
            '#importarRomaneioModal label{display:block;font-size:13px;font-weight:700;margin-bottom:6px;color:var(--sw-text-2,#cbd5e1);}',
            '#importarRomaneioModal select,#importarRomaneioModal input{width:100%;height:42px;padding:0 12px;border-radius:6px;border:1px solid var(--sw-border,#334155);background:var(--sw-surface-2,#1e293b);color:var(--sw-text-1,#f1f5f9);box-sizing:border-box;}',
            '#importarRomaneioModal .ir-actions{display:flex;gap:10px;flex-wrap:wrap;align-items:center;}',
            '#importarRomaneioModal .ir-actions .btn{height:40px;}',
            '#importarRomaneioModal .ir-preview-title{font-weight:800;font-size:15px;margin-top:2px;}',
            '#importarRomaneioModal .ir-preview{border:1px solid var(--sw-border,#334155);border-radius:8px;padding:8px;background:var(--sw-surface-2,#1e293b);min-height:70px;display:grid;gap:6px;}',
            '#importarRomaneioModal .ir-row{display:flex;align-items:center;gap:10px;padding:9px 10px;border:1px solid var(--sw-border,#334155);border-radius:6px;background:var(--sw-surface,#111827);}',
            '#importarRomaneioModal .ir-row-main{flex:1;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;font-size:13px;}',
            '#importarRomaneioModal .ir-row button{flex:0 0 auto;}',
            '#importarRomaneioModal .ir-foot{display:flex;justify-content:flex-end;gap:10px;flex-wrap:wrap;padding:12px 20px;border-top:1px solid var(--sw-border,#334155);background:var(--sw-surface-2,#1e293b);}',
            '@media(max-width:700px){#importarRomaneioModal{padding:8px;}#importarRomaneioModal .ir-card{max-height:calc(100dvh - 16px);}#importarRomaneioModal .ir-grid{grid-template-columns:1fr;}#importarRomaneioModal .ir-body{padding:12px;}#importarRomaneioModal .ir-foot{padding:10px 12px;}#importarRomaneioModal .ir-foot .btn{flex:1 1 100%;}}'
        ].join('');
        document.head.appendChild(style);

        var modal = document.createElement('div');
        modal.id = 'importarRomaneioModal';
        modal.innerHTML =
            '<div class="ir-card" role="dialog" aria-modal="true" aria-labelledby="irTitle">' +
                '<div class="ir-head"><h3 id="irTitle">Importar Romaneios</h3><button type="button" class="ir-close" aria-label="Fechar">&times;</button></div>' +
                '<div class="ir-body">' +
                    '<div><label for="irFilter">Filtro</label><input id="irFilter" type="search" placeholder="Filtrar por cliente, espécie, número ou data..."></div>' +
                    '<div class="ir-grid">' +
                        '<div><label for="irType">Tipo de Romaneio:</label><select id="irType"></select></div>' +
                        '<div><label for="irRecord">Romaneio:</label><select id="irRecord"><option value="">Selecione o tipo primeiro...</option></select></div>' +
                    '</div>' +
                    '<div class="ir-actions">' +
                        '<button type="button" id="irLoad" class="btn btn-success"><i class="fas fa-download"></i> Carregar Itens</button>' +
                        '<button type="button" id="irClear" class="btn btn-danger"><i class="fas fa-trash"></i> Limpar</button>' +
                    '</div>' +
                    '<div class="ir-preview-title">Preview - Resumo:</div>' +
                    '<div id="irPreview" class="ir-preview"><span style="color:var(--sw-text-2)">Selecione o tipo e o romaneio, depois clique em Carregar Itens.</span></div>' +
                '</div>' +
                '<div class="ir-foot">' +
                    '<button type="button" id="irImport" class="btn btn-success" disabled><i class="fas fa-file-import"></i> Importar</button>' +
                    '<button type="button" id="irCancel" class="btn btn-danger"><i class="fas fa-times"></i> Cancelar</button>' +
                '</div>' +
            '</div>';
        document.body.appendChild(modal);

        modal.querySelector('.ir-close').addEventListener('click', close);
        modal.querySelector('#irCancel').addEventListener('click', close);
        modal.addEventListener('click', function (e) { if (e.target === modal) close(); });
        document.addEventListener('keydown', function (e) { if (e.key === 'Escape' && modal.classList.contains('active')) close(); });
        modal.querySelector('#irFilter').addEventListener('input', function (e) { state.filter = e.target.value; renderRecordOptions(); });
        modal.querySelector('#irType').addEventListener('change', function (e) { state.sourceType = e.target.value; loadRecords(); });
        modal.querySelector('#irRecord').addEventListener('change', function (e) {
            state.selected = state.records.find(function (r) { return recordKey(r) === e.target.value; }) || null;
            renderPreview();
        });
        modal.querySelector('#irLoad').addEventListener('click', loadSelectedItems);
        modal.querySelector('#irClear').addEventListener('click', clearPreview);
        modal.querySelector('#irImport').addEventListener('click', importItems);
    }
    function renderTypes() {
        var sel = document.getElementById('irType');
        if (!sel) return;
        var allowed = state.targetType === 'tora' ? ['tora'] : ['tl', 'pct', 'pes'];
        sel.innerHTML = '<option value="">Selecione...</option>' + allowed.map(function (t) {
            return '<option value="' + t + '">' + LABELS[t] + '</option>';
        }).join('');
        sel.value = state.sourceType || (allowed.indexOf(state.targetType) >= 0 ? state.targetType : '');
    }
    function renderRecordOptions() {
        var sel = document.getElementById('irRecord');
        if (!sel) return;
        var q = norm(state.filter);
        var visible = state.records.filter(function (r) {
            if (!q) return true;
            return norm(recordLabel(r) + ' ' + JSON.stringify(recordItems(r).map(function (it) { return it.especie || ''; }))).indexOf(q) >= 0;
        });
        var targetKey = state.targetType === state.sourceType ? String(state.targetId) : '';
        visible = visible.filter(function (r) { return recordKey(r) !== targetKey; });
        sel.innerHTML = '<option value="">Selecione...</option>' + visible.map(function (r) {
            return '<option value="' + esc(recordKey(r)) + '">' + esc(recordLabel(r)) + '</option>';
        }).join('');
        if (state.selected && visible.some(function (r) { return recordKey(r) === recordKey(state.selected); })) {
            sel.value = recordKey(state.selected);
        } else {
            state.selected = null;
            state.items = [];
            renderPreview();
        }
    }
    async function loadRecords() {
        if (!state.sourceType) {
            state.records = [];
            renderRecordOptions();
            return;
        }
        var sel = document.getElementById('irRecord');
        if (sel) sel.innerHTML = '<option value="">Carregando...</option>';
        try {
            state.records = await loadCollection(state.sourceType);
            renderRecordOptions();
        } catch (e) {
            state.records = [];
            renderRecordOptions();
            toast('Erro ao carregar romaneios: ' + (e && e.message ? e.message : e), 'error');
        }
    }
    function renderPreview() {
        var box = document.getElementById('irPreview');
        var btn = document.getElementById('irImport');
        if (!box) return;
        if (!state.items.length) {
            box.innerHTML = '<span style="color:var(--sw-text-2)">Selecione o tipo e o romaneio, depois clique em Carregar Itens.</span>';
            if (btn) btn.disabled = true;
            return;
        }
        box.innerHTML = state.items.map(function (it, i) {
            return '<div class="ir-row"><span class="ir-row-main">' + esc(summaryItem(it)) + '</span>' +
                '<button type="button" class="btn btn-danger btn-small" data-ir-remove="' + i + '"><i class="fas fa-trash"></i> Excluir</button></div>';
        }).join('');
        box.querySelectorAll('[data-ir-remove]').forEach(function (b) {
            b.addEventListener('click', function () {
                state.items.splice(parseInt(b.dataset.irRemove, 10), 1);
                renderPreview();
            });
        });
        if (btn) btn.disabled = false;
    }
    function loadSelectedItems() {
        if (!state.selected) { toast('Selecione um romaneio.', 'warning'); return; }
        state.items = recordItems(state.selected).map(function (it) { return Object.assign({}, it); });
        if (!state.items.length) toast('O romaneio selecionado não possui itens.', 'warning');
        renderPreview();
    }
    function clearPreview() {
        state.items = [];
        renderPreview();
    }
    async function refreshList(type) {
        try {
            if (type === 'tl' && window.ModalListaRomaneios && typeof window.ModalListaRomaneios.refresh === 'function') {
                await window.ModalListaRomaneios.refresh();
            } else if (type === 'pct' && window.ModalListaRomaneiosPCT && typeof window.ModalListaRomaneiosPCT.forcarRefreshFirebase === 'function') {
                await window.ModalListaRomaneiosPCT.forcarRefreshFirebase();
            } else if (type === 'pes' && typeof window.showRomaneiosList === 'function') {
                await window.showRomaneiosList();
            } else if (type === 'tora' && window.romaneioToraManager && typeof window.romaneioToraManager.openModal === 'function') {
                await window.romaneioToraManager.openModal();
            }
        } catch (_) {}
    }
    async function importItems() {
        if (!state.targetRecord) { toast('Romaneio de destino não encontrado.', 'error'); return; }
        if (!state.items.length) { toast('Carregue itens para importar.', 'warning'); return; }
        var s = svc();
        if (!s || typeof s.saveToFirebase !== 'function') { toast('Firebase indisponível.', 'error'); return; }
        var key = recordKey(state.targetRecord);
        if (!key) { toast('Chave do romaneio de destino nǜo encontrada.', 'error'); return; }
        var started = Date.now();
        loading(true, 'Importando itens...');
        try {
            var target = Object.assign({}, state.targetRecord);
            var field = Array.isArray(target.itens) ? 'itens' : (Array.isArray(target.items) ? 'items' : (state.targetType === 'tl' ? 'items' : 'itens'));
            var existing = Array.isArray(target[field]) ? target[field].slice() : [];
            target[field] = existing.concat(state.items.map(function (it) { return Object.assign({}, it); }));
            target.updatedAt = new Date().toISOString();
            target.atualizadoEm = target.updatedAt;
            var res = await s.saveToFirebase(PATHS[state.targetType], key, target);
            if (res && res.success === false) throw new Error(res.error || 'Falha ao salvar romaneio.');
            try { if (typeof s.invalidateReadCacheForPath === 'function') s.invalidateReadCacheForPath(PATHS[state.targetType]); } catch (_) {}
            var evt = { tl: 'TL', pct: 'Pct', pes: 'Pes', tora: 'Tora' }[state.targetType];
            try { window.dispatchEvent(new CustomEvent('romaneios' + evt + ':updated', { detail: { id: key, action: 'import' } })); } catch (_) {}
            try { window.dispatchEvent(new CustomEvent('romaneios:updated', { detail: { id: key, type: state.targetType, action: 'import' } })); } catch (_) {}
            close();
            await refreshList(state.targetType);
            toast(state.items.length + ' item(ns) importado(s) para o romaneio ' + LABELS[state.targetType] + '.', 'success');
        } catch (e) {
            toast('Erro ao importar: ' + (e && e.message ? e.message : e), 'error');
        } finally {
            var remaining = 700 - (Date.now() - started);
            if (remaining > 0) await new Promise(function (resolve) { setTimeout(resolve, remaining); });
            loading(false);
        }
    }
    async function open(targetType, targetId) {
        ensureModal();
        state.targetType = String(targetType || '').toLowerCase();
        state.targetId = String(targetId || '');
        state.targetRecord = null;
        state.records = [];
        state.selected = null;
        state.items = [];
        state.filter = '';
        var filter = document.getElementById('irFilter');
        if (filter) filter.value = '';
        renderTypes();
        var modal = document.getElementById('importarRomaneioModal');
        if (modal) modal.classList.add('active');
        loading(true, 'Carregando romaneio de destino...');
        try {
            var records = await loadCollection(state.targetType);
            state.targetRecord = records.find(function (r) {
                return recordKey(r) === state.targetId || String(r.id || '') === state.targetId || String(r.numero || '') === state.targetId;
            }) || null;
            if (!state.targetRecord) throw new Error('Romaneio de destino não encontrado.');
            state.sourceType = state.targetType;
            renderTypes();
            await loadRecords();
        } catch (e) {
            toast('Erro ao abrir importação: ' + (e && e.message ? e.message : e), 'error');
            close();
        } finally {
            loading(false);
        }
    }
    function close() {
        var modal = document.getElementById('importarRomaneioModal');
        if (modal) modal.classList.remove('active');
    }

    window.SiswebImportarRomaneio = { open: open, close: close };
})();
