/**
 * nf-naturezas.js — CRUD de Naturezas da Operação (NF-e)
 * Firebase path: companies/{tenantId}/fiscal/naturezas-operacao/{id}
 * (Alinhado ao namespace canônico do firebaseService.js do Sisweb)
 * Sisweb — NF-e Sistema Multi-Tenant
 *
 * API pública (window.NFNaturezas):
 *   carregar(tenantId)          → Promise<Array>
 *   salvar(tenantId, natureza)  → Promise<{id,...}>
 *   remover(tenantId, id)       → Promise<void>
 *   popularSelect(selectId, selecionarId?)
 *   abrirModal(opts?)           → abre modalNatOp
 *   fecharModal()
 */

const NFNaturezas = (() => {
  'use strict';

  // ─── Naturezas padrão (seed quando lista estiver vazia) ───────────────────
  // regras[] (Fase B — grade Destino × Produto, como nas telas referência):
  // [{ destino:'QUALQUER'|UF, produto:'QUALQUER'|'NCM:xxxxxxxx', cfop,
  //    aliq (%, opcional), base (% da BC, opcional), codigo (CST/CSOSN conf.
  //    regime), pisCst?, cofinsCst?, cstIBS?, cClassTrib? }].
  // Sem regras → vale cfopPadrao/csosn da natureza (compatibilidade).
  const NATUREZAS_PADRAO = [
    { id: 'nat_venda_merc',   descricao: 'Venda de Mercadoria',          cfopPadrao: '5102', tipo: 'saida',   csosn: '102', ativo: true, regras: [] },
    { id: 'nat_venda_prod',   descricao: 'Venda de Produção Própria',    cfopPadrao: '5101', tipo: 'saida',   csosn: '102', ativo: true, regras: [] },
    { id: 'nat_devol_compra', descricao: 'Devolução de Compra',          cfopPadrao: '5202', tipo: 'saida',   csosn: '102', finNFe: '4', ativo: true, regras: [] },
    { id: 'nat_remessa',      descricao: 'Remessa para Industrialização',cfopPadrao: '5501', tipo: 'saida',   csosn: '400', ativo: true, regras: [] },
    { id: 'nat_transfer',     descricao: 'Transferência de Mercadoria',  cfopPadrao: '5151', tipo: 'saida',   csosn: '102', ativo: true, regras: [] },
    { id: 'nat_compra_merc',  descricao: 'Compra de Mercadoria',         cfopPadrao: '1102', tipo: 'entrada', csosn: '102', ativo: true, regras: [] },
    { id: 'nat_devol_venda',  descricao: 'Devolução de Venda',           cfopPadrao: '1202', tipo: 'entrada', csosn: '102', finNFe: '4', ativo: true, regras: [] },
    { id: 'nat_brinde',       descricao: 'Remessa em Bonificação/Brinde',cfopPadrao: '5910', tipo: 'saida',   csosn: '400', ativo: true, regras: [] },
  ];

  // ─── Resolver regra da natureza para um item (pura, testável em node) ───
  // Prioridade: destino exato (UF) > QUALQUER; produto exato (NCM ou id) >
  // QUALQUER. Retorna a regra ou null (vale cfopPadrao/csosn da natureza).
  function resolverRegra(natureza, { ufDest, ncm, produtoId } = {}) {
    const regras = Array.isArray(natureza?.regras) ? natureza.regras : [];
    if (!regras.length) return null;
    const uf = String(ufDest || '').toUpperCase();
    const ncmD = String(ncm || '').replace(/\D/g, '');
    const pid = String(produtoId || '');
    const score = (r) => {
      const d = String(r.destino || 'QUALQUER').toUpperCase();
      const p = String(r.produto || 'QUALQUER').toUpperCase();
      if (d !== 'QUALQUER' && d !== uf) return -1;
      const pNcm = p.startsWith('NCM:') ? p.slice(4).replace(/\D/g, '') : '';
      const pMatch = p === 'QUALQUER' || (pNcm && pNcm === ncmD) || (pid && p === pid.toUpperCase());
      if (!pMatch) return -1;
      return (d !== 'QUALQUER' ? 2 : 0) + (p !== 'QUALQUER' ? 1 : 0);
    };
    let best = null, bestScore = -1;
    for (const r of regras) {
      const s = score(r);
      if (s > bestScore) { bestScore = s; best = r; }
    }
    return bestScore >= 0 ? best : null;
  }

  // ─── Aplicar regra resolvida num item (pura) ────────────────────────────
  // Retorna { aplicado: bool, campos: [...] }. Não recalcula valores aqui —
  // o chamador (buildNFeFromForm) recalcula ICMS com aliq/base da regra.
  function aplicarRegraNoItem(item, regra) {
    if (!regra) return { aplicado: false, campos: [] };
    const campos = [];
    if (regra.cfop && /^[1-9]\d{3}$/.test(String(regra.cfop))) { item.cfop = String(regra.cfop); campos.push('cfop'); }
    if (regra.codigo && /^[0-9]{2,3}$/.test(String(regra.codigo))) {
      item.csosn = String(regra.codigo);
      item.imposto = item.imposto || {};
      item.imposto.icms = { ...(item.imposto.icms || {}), csosn: String(regra.codigo) };
      // Regime Normal usa cst; SN usa csosn (o gate valida; aqui espelha)
      if (String(regra.codigo).length === 2) item.imposto.icms.cst = String(regra.codigo);
      campos.push('codigo');
    }
    if (regra.pisCst) { item.imposto = item.imposto || {}; item.imposto.pis = { ...(item.imposto.pis || {}), cST: String(regra.pisCst) }; campos.push('pis'); }
    if (regra.cofinsCst) { item.imposto = item.imposto || {}; item.imposto.cofins = { ...(item.imposto.cofins || {}), cST: String(regra.cofinsCst) }; campos.push('cofins'); }
    if (regra.cstIBS || regra.cClassTrib) {
      item.imposto = item.imposto || {};
      item.imposto.ibscbs = { ...(item.imposto.ibscbs || {}), habilitado: true };
      if (regra.cstIBS) item.imposto.ibscbs.cst = String(regra.cstIBS);
      if (regra.cClassTrib) item.imposto.ibscbs.cClassTrib = String(regra.cClassTrib);
      campos.push('ibscbs');
    }
    if (regra.aliq != null && String(regra.aliq).trim() !== '') { item._regraAliq = Number(regra.aliq); campos.push('aliq'); }
    if (regra.base != null && String(regra.base).trim() !== '') { item._regraBase = Number(regra.base); campos.push('base'); }
    return { aplicado: campos.length > 0, campos };
  }

  // ─── Cache local para evitar roundtrips desnecessários ───────────────────
  let _cache = null;
  let _tenantId = null;

  // ─── Path Firebase canônico ──────────────────────────────────────────
  // USA companies/{tenantId}/ para alinhar ao firebaseService.js
  // Paths com companies/ não são duplamente prefixados pelo getNamespacedPath()
  function getPath(tenantId, id = '') {
    const base = `companies/${tenantId}/fiscal/naturezas-operacao`;
    return id ? `${base}/${id}` : base;
  }

  // ─── Firebase wrapper ─────────────────────────────────────────────────────
  function fb() {
    if (!window.firebaseService) throw new Error('Firebase não inicializado');
    return window.firebaseService;
  }

  // ─── Carregar todas as naturezas do tenant ────────────────────────────────
  async function carregar(tenantId) {
    _tenantId = tenantId;
    try {
      const result = await fb().loadFromFirebase(getPath(tenantId));
      if (result && result.success && result.data) {
        const arr = Object.values(result.data || {}).filter(n => n && n.descricao);
        _cache = arr.length > 0 ? arr : await _seedPadrao(tenantId);
      } else {
        _cache = await _seedPadrao(tenantId);
      }
    } catch (e) {
      console.warn('[NFNaturezas] Fallback localStorage:', e.message);
      const raw = localStorage.getItem(`nf_naturezas_${tenantId}`);
      _cache = raw ? JSON.parse(raw) : NATUREZAS_PADRAO;
    }
    _persistirLocal(tenantId);
    return _cache;
  }

  // ─── Seed: salvar naturezas padrão se lista vazia ─────────────────────────
  async function _seedPadrao(tenantId) {
    try {
      const basePath = getPath(tenantId); // companies/{tenantId}/fiscal/naturezas-operacao
      for (const nat of NATUREZAS_PADRAO) {
        const payload = { ...nat, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() };
        // saveToFirebase(path, key, data) — key é o ID do nó filho
        await fb().saveToFirebase(basePath, nat.id, payload);
      }
    } catch (e) {
      console.warn('[NFNaturezas] Seed falhou:', e.message);
    }
    return [...NATUREZAS_PADRAO];
  }

  // ─── Salvar / Atualizar natureza ──────────────────────────────────────────
  async function salvar(tenantId, natureza) {
    const id = natureza.id || `nat_${Date.now()}`;
    const payload = {
      ...natureza,
      id,
      ativo: natureza.ativo !== false,
      updatedAt: new Date().toISOString(),
      createdAt: natureza.createdAt || new Date().toISOString(),
    };
    // saveToFirebase(path, key, data) — path=base, key=id, data=payload
    await fb().saveToFirebase(getPath(tenantId), id, payload);
    // Atualizar cache
    if (_cache) {
      const idx = _cache.findIndex(n => n.id === id);
      idx >= 0 ? (_cache[idx] = payload) : _cache.push(payload);
    }
    _persistirLocal(tenantId);
    return payload;
  }

  // ─── Remover natureza ─────────────────────────────────────────────────────
  async function remover(tenantId, id) {
    // Fail-closed: só purga local/UI após confirmação remota.
    const res = await fb().removeFromFirebase(getPath(tenantId, id));
    if (res && res.success === false) {
      throw new Error((res && res.error) || 'Falha ao remover natureza no servidor');
    }
    if (_cache) _cache = _cache.filter(n => String(n && n.id) !== String(id));
    _persistirLocal(tenantId);
  }

  // ─── Persistir cache no localStorage ─────────────────────────────────────
  function _persistirLocal(tenantId) {
    try { localStorage.setItem(`nf_naturezas_${tenantId}`, JSON.stringify(_cache || [])); } catch (_) {}
  }

  // ─── Popular select com as naturezas carregadas ───────────────────────────
  function popularSelect(selectId, selecionarId = null) {
    const sel = document.getElementById(selectId);
    if (!sel) return;
    const naturezas = _cache || NATUREZAS_PADRAO;
    const ativos = naturezas.filter(n => n.ativo !== false);
    sel.innerHTML = '<option value="">Selecione a Natureza da Operação...</option>';
    ativos.forEach(n => {
      const opt = document.createElement('option');
      opt.value = n.id;
      opt.textContent = n.descricao;
      opt.dataset.cfop = n.cfopPadrao || '';
      opt.dataset.csosn = n.csosn || '';
      opt.dataset.tipo = n.tipo || 'saida';
      if (selecionarId && n.id === selecionarId) opt.selected = true;
      sel.appendChild(opt);
    });
  }

  // ─── Abrir modal de Nova/Editar Natureza ──────────────────────────────────
  function abrirModal(opts = {}) {
    let modal = document.getElementById('modalNatOp');
    if (!modal) {
      modal = _criarModalHTML();
      document.body.appendChild(modal);
      _bindModalEvents();
    }
    // CSOSN/CST por regime (Fase A/B): SN→CSOSN, Normal→CST (NFePHP/MOC)
    try {
      const cfg = window.NFService?.getConfig?.() || {};
      const crt = window.NFConfigService?.getCRT?.(cfg.empresa?.regime) ?? 1;
      const selCS = document.getElementById('natOpCSOSN');
      if (selCS && window.NFTaxTables) {
        const lista = String(crt) === '3' ? window.NFTaxTables.CST_ICMS_FULL : window.NFTaxTables.CSOSN_FULL;
        const atual = selCS.value;
        selCS.innerHTML = Object.keys(lista).map((cod) => `<option value="${cod}">${cod} – ${lista[cod]}</option>`).join('');
        if (lista[atual]) selCS.value = atual;
      }
    } catch (_) {}
    // Preencher para edição
    const nat = opts.natureza || {};
    _setField('natOpId', nat.id || '');
    _setField('natOpDescricao', nat.descricao || '');
    _setField('natOpCFOP', nat.cfopPadrao || '5102');
    _setField('natOpTipo', nat.tipo || 'saida');
    _setField('natOpCSOSN', nat.csosn || '102');
    _setField('natOpNotas', nat.notas || '');
    __natRegrasEdit = Array.isArray(nat.regras) ? JSON.parse(JSON.stringify(nat.regras)) : [];
    __natRenderRegras();
    modal.style.display = 'flex';
    document.getElementById('natOpDescricao')?.focus();
  }

  function fecharModal() {
    const modal = document.getElementById('modalNatOp');
    if (modal) modal.style.display = 'none';
  }

  // ─── Criar HTML do modal ──────────────────────────────────────────────────
  function _criarModalHTML() {
    const el = document.createElement('div');
    el.id = 'modalNatOp';
    el.style.cssText = [
      'display:none;position:fixed;z-index:2000;left:0;top:0;width:100%;height:100%;',
      'background:rgba(0,0,0,0.55);align-items:center;justify-content:center;',
    ].join('');
    el.innerHTML = `
      <div style="background:var(--sw-surface);border-radius:8px;width:90%;max-width:560px;box-shadow:0 8px 32px rgba(0,0,0,0.25);overflow:hidden;border:1px solid var(--sw-border);">
        <div style="background:linear-gradient(135deg,#2c3e50,#34495e);color:#fff;padding:16px 20px;display:flex;align-items:center;justify-content:space-between;">
          <h3 style="margin:0;color:#fff;font-size:16px;display:flex;align-items:center;gap:8px;">
            <i class="fas fa-file-alt"></i> Natureza da Operação
          </h3>
          <button id="natOpFechar" style="background:none;border:none;color:#fff;font-size:22px;cursor:pointer;padding:0;line-height:1;">&times;</button>
        </div>
        <div style="padding:24px;">
          <input type="hidden" id="natOpId">
          <div style="margin-bottom:14px;">
            <label style="font-weight:600;font-size:13px;color:var(--sw-text-1);display:block;margin-bottom:4px;">Descrição: *</label>
            <input type="text" id="natOpDescricao" placeholder="Ex: Venda de Mercadoria" maxlength="60"
              style="width:100%;padding:8px;border:1px solid var(--sw-border);border-radius:4px;font-size:14px;box-sizing:border-box;background:var(--sw-surface-2);color:var(--sw-text-1);">
          </div>
          <div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:14px;margin-bottom:14px;">
            <div>
              <label style="font-weight:600;font-size:13px;color:var(--sw-text-1);display:block;margin-bottom:4px;">CFOP Padrão:</label>
              <input type="text" id="natOpCFOP" placeholder="5102" maxlength="4"
                style="width:100%;padding:8px;border:1px solid var(--sw-border);border-radius:4px;font-size:14px;box-sizing:border-box;background:var(--sw-surface-2);color:var(--sw-text-1);">
            </div>
            <div>
              <label style="font-weight:600;font-size:13px;color:var(--sw-text-1);display:block;margin-bottom:4px;">Tipo:</label>
              <select id="natOpTipo" style="width:100%;padding:8px;border:1px solid var(--sw-border);border-radius:4px;font-size:14px;box-sizing:border-box;background:var(--sw-surface-2);color:var(--sw-text-1);">
                <option value="saida">Saída</option>
                <option value="entrada">Entrada</option>
              </select>
            </div>
            <div>
              <label style="font-weight:600;font-size:13px;color:var(--sw-text-1);display:block;margin-bottom:4px;">CSOSN/CST:</label>
              <select id="natOpCSOSN" style="width:100%;padding:8px;border:1px solid var(--sw-border);border-radius:4px;font-size:14px;box-sizing:border-box;background:var(--sw-surface-2);color:var(--sw-text-1);">
                <option value="102">102 – SN sem crédito</option>
                <option value="101">101 – SN com crédito</option>
                <option value="400">400 – Não tributada SN</option>
                <option value="500">500 – ICMS ST anteriormente</option>
                <option value="900">900 – Outros SN</option>
                <option value="00">00 – Tributada integral</option>
                <option value="40">40 – Isenta</option>
                <option value="41">41 – Não tributada</option>
              </select>
            </div>
          </div>
          <div style="margin-bottom:6px;">
            <label style="font-weight:600;font-size:13px;color:var(--sw-text-1);display:block;margin-bottom:4px;">Observações:</label>
            <textarea id="natOpNotas" rows="2" maxlength="200" placeholder="Observações opcionais..."
              style="width:100%;padding:8px;border:1px solid var(--sw-border);border-radius:4px;font-size:13px;box-sizing:border-box;resize:vertical;background:var(--sw-surface-2);color:var(--sw-text-1);"></textarea>
          </div>
          <div style="margin:14px 0 6px;border-top:1px solid var(--sw-border);padding-top:12px;">
            <label style="font-weight:600;font-size:13px;color:var(--sw-text-1);display:block;margin-bottom:4px;">Regras por destino × produto (Fase B):</label>
            <div style="font-size:12px;color:var(--sw-text-2);margin-bottom:8px;">Destino: UF ou QUALQUER. Produto: QUALQUER, NCM:xxxxxxxx ou ID do produto. Sem regra → vale CFOP/CSOSN padrão acima.</div>
            <div id="natOpRegrasLista"></div>
            <div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:8px;margin-top:6px;">
              <input id="natRegraDestino" placeholder="Destino (ex.: SP)" maxlength="8" style="padding:7px;border:1px solid var(--sw-border);border-radius:4px;font-size:13px;background:var(--sw-surface-2);color:var(--sw-text-1);">
              <input id="natRegraProduto" placeholder="Produto (NCM:xxxx)" maxlength="14" style="padding:7px;border:1px solid var(--sw-border);border-radius:4px;font-size:13px;background:var(--sw-surface-2);color:var(--sw-text-1);">
              <input id="natRegraCFOP" placeholder="CFOP (ex.: 6102)" maxlength="4" style="padding:7px;border:1px solid var(--sw-border);border-radius:4px;font-size:13px;background:var(--sw-surface-2);color:var(--sw-text-1);">
              <input id="natRegraAliq" placeholder="Alíq. % (opcional)" style="padding:7px;border:1px solid var(--sw-border);border-radius:4px;font-size:13px;background:var(--sw-surface-2);color:var(--sw-text-1);">
              <input id="natRegraBase" placeholder="Base % (opcional)" style="padding:7px;border:1px solid var(--sw-border);border-radius:4px;font-size:13px;background:var(--sw-surface-2);color:var(--sw-text-1);">
              <input id="natRegraCodigo" placeholder="CST/CSOSN (opcional)" maxlength="3" style="padding:7px;border:1px solid var(--sw-border);border-radius:4px;font-size:13px;background:var(--sw-surface-2);color:var(--sw-text-1);">
              <input id="natRegraPIS" placeholder="PIS CST (opcional)" maxlength="2" style="padding:7px;border:1px solid var(--sw-border);border-radius:4px;font-size:13px;background:var(--sw-surface-2);color:var(--sw-text-1);">
              <input id="natRegraCOFINS" placeholder="COFINS CST (opcional)" maxlength="2" style="padding:7px;border:1px solid var(--sw-border);border-radius:4px;font-size:13px;background:var(--sw-surface-2);color:var(--sw-text-1);">
              <input id="natRegraCSTIBS" placeholder="CST IBS (opcional)" maxlength="3" style="padding:7px;border:1px solid var(--sw-border);border-radius:4px;font-size:13px;background:var(--sw-surface-2);color:var(--sw-text-1);">
              <input id="natRegraCClassTrib" placeholder="cClassTrib (opcional)" maxlength="6" style="padding:7px;border:1px solid var(--sw-border);border-radius:4px;font-size:13px;background:var(--sw-surface-2);color:var(--sw-text-1);">
            </div>
            <button id="natOpRegraAdd" type="button" style="margin-top:8px;padding:7px 14px;border:1px solid var(--sw-success);border-radius:4px;background:none;color:var(--sw-success);cursor:pointer;font-size:13px;font-weight:600;">+ Adicionar regra</button>
          </div>
        </div>
        <div style="padding:0 24px 20px;display:flex;gap:10px;justify-content:flex-end;">
          <button id="natOpCancelar" style="padding:9px 18px;border:1px solid var(--sw-border);border-radius:4px;background:var(--sw-surface-2);color:var(--sw-text-1);cursor:pointer;font-size:14px;">
            Cancelar
          </button>
          <button id="natOpSalvar" style="padding:9px 18px;border:none;border-radius:4px;background:var(--sw-success);color:var(--sw-on-brand);cursor:pointer;font-size:14px;font-weight:600;">
            <i class="fas fa-save"></i> Salvar
          </button>
        </div>
      </div>`;
    return el;
  }

  // ─── Bind eventos do modal ────────────────────────────────────────────────
  function _bindModalEvents() {
    document.getElementById('natOpFechar')?.addEventListener('click', fecharModal);
    document.getElementById('natOpCancelar')?.addEventListener('click', fecharModal);
    document.getElementById('natOpSalvar')?.addEventListener('click', _salvarDoModal);
    document.getElementById('natOpRegraAdd')?.addEventListener('click', __natAddRegra);
    document.getElementById('modalNatOp')?.addEventListener('click', (e) => {
      if (e.target.id === 'modalNatOp') fecharModal();
    });
  }

  // ─── Salvar a partir dos campos do modal ──────────────────────────────────
  async function _salvarDoModal() {
    if (window.__nfNatSaving) return;
    const descricao = (document.getElementById('natOpDescricao')?.value || '').trim();
    if (!descricao) {
      notifyUser('Informe a descrição da Natureza da Operação');
      return;
    }
    const tenantId = _tenantId || window.NFService?.getConfig?.()?.tenantId
      || (() => { try { return JSON.parse(localStorage.getItem('company_info') || '{}').companyId || ''; } catch(_) { return ''; } })();
    if (!tenantId) { notifyUser('Tenant não identificado. Faça login novamente.'); return; }
    // Trava anti-duplo-clique (F-13).
    window.__nfNatSaving = true;
    var __natSaveBtn = document.getElementById('natOpSalvar');
    var __natOrigLabel = '';
    try {
      if (__natSaveBtn) {
        __natOrigLabel = __natSaveBtn.innerHTML;
        __natSaveBtn.disabled = true;
        __natSaveBtn.innerHTML = 'Salvando...';
      }
    } catch (_) {}

    const id = document.getElementById('natOpId')?.value || '';
    const nat = {
      id: id || undefined,
      descricao,
      cfopPadrao: document.getElementById('natOpCFOP')?.value || '5102',
      tipo:       document.getElementById('natOpTipo')?.value || 'saida',
      csosn:      document.getElementById('natOpCSOSN')?.value || '102',
      notas:      document.getElementById('natOpNotas')?.value || '',
      regras:     Array.isArray(__natRegrasEdit) ? __natRegrasEdit : [],
      ativo: true,
    };
    try {
      const salvo = await salvar(tenantId, nat);
      fecharModal();
      // Atualizar selects na página
      popularSelect('nfNatOpSelect', salvo.id);
      // Disparar evento para outras partes atualizarem
      window.dispatchEvent(new CustomEvent('nf:naturezas:updated', { detail: { natureza: salvo } }));
      // Atualizar tabela na aba Configuração se existir
      if (typeof window.nfRenderizarTabelaNaturezas === 'function') {
        window.nfRenderizarTabelaNaturezas();
      }
      try {
        if (__natSaveBtn) { __natSaveBtn.disabled = false; __natSaveBtn.innerHTML = __natOrigLabel; }
      } catch (_) {}
      window.__nfNatSaving = false;
    } catch (e) {
      notifyUser('Erro ao salvar Natureza da Operação: ' + e.message);
      try {
        var __natSaveBtnErr = document.getElementById('natOpSalvar');
        if (__natSaveBtnErr) { __natSaveBtnErr.disabled = false; }
      } catch (_) {}
      window.__nfNatSaving = false;
    }
  }

  // ─── Regras por natureza (Fase B — grade Destino × Produto) ─────────────
  let __natRegrasEdit = [];
  function __natRenderRegras() {
    const box = document.getElementById('natOpRegrasLista');
    if (!box) return;
    if (!__natRegrasEdit.length) {
      box.innerHTML = '<div style="font-size:12px;color:var(--sw-text-2);padding:6px 0;">Sem regras específicas — vale CFOP/CSOSN padrão da natureza para todos os destinos e produtos.</div>';
      return;
    }
    box.innerHTML = __natRegrasEdit.map((r, i) => `
      <div style="display:flex;gap:6px;align-items:center;margin-bottom:6px;font-size:12px;flex-wrap:wrap;border:1px solid var(--sw-border);border-radius:6px;padding:6px 8px;">
        <span style="flex:1;min-width:180px;"><strong>Destino:</strong> ${String(r.destino || 'QUALQUER')} · <strong>Produto:</strong> ${String(r.produto || 'QUALQUER')} · <strong>CFOP:</strong> ${String(r.cfop || '—')} · <strong>Alíq:</strong> ${r.aliq ?? '—'}% · <strong>Base:</strong> ${r.base ?? '—'}% · <strong>Cód:</strong> ${String(r.codigo || '—')}</span>
        <button type="button" data-nat-regra-del="${i}" style="border:1px solid var(--sw-danger);background:none;color:var(--sw-danger);border-radius:4px;padding:2px 8px;cursor:pointer;">×</button>
      </div>`).join('');
    box.querySelectorAll('[data-nat-regra-del]').forEach((b) => {
      b.addEventListener('click', () => { __natRegrasEdit.splice(Number(b.dataset.natRegraDel), 1); __natRenderRegras(); });
    });
  }
  function __natAddRegra() {
    const g = (id) => (document.getElementById(id)?.value || '').trim();
    const r = {
      id: `regra_${Date.now()}`,
      destino: (g('natRegraDestino') || 'QUALQUER').toUpperCase(),
      produto: (g('natRegraProduto') || 'QUALQUER').toUpperCase(),
      cfop: g('natRegraCFOP').replace(/\D/g, ''),
      aliq: g('natRegraAliq'), base: g('natRegraBase'),
      codigo: g('natRegraCodigo').replace(/\D/g, ''),
      pisCst: g('natRegraPIS').replace(/\D/g, '') || undefined,
      cofinsCst: g('natRegraCOFINS').replace(/\D/g, '') || undefined,
      cstIBS: g('natRegraCSTIBS').replace(/\D/g, '') || undefined,
      cClassTrib: g('natRegraCClassTrib').replace(/\D/g, '') || undefined,
    };
    // CFOP canônico (NFTaxTables via NFValidator; 4xxx/8xxx/9xxx rejeitados).
    const cfopOk = window.NFValidator?.validarCFOP
      ? window.NFValidator.validarCFOP(r.cfop)
      : (window.NFTaxTables?.validarCFOP ? window.NFTaxTables.validarCFOP(r.cfop) : /^[123567]\d{3}$/.test(r.cfop));
    if (!cfopOk) { try { notifyUser('CFOP da regra inválido (ex.: 6102)'); } catch (_) {} return; }
    if (r.codigo && !/^[0-9]{2,3}$/.test(r.codigo)) { try { notifyUser('Código ICMS da regra inválido (CSOSN 3 dígitos ou CST 2 dígitos)'); } catch (_) {} return; }
    if (r.cClassTrib && !/^\d{6}$/.test(r.cClassTrib)) { try { notifyUser('cClassTrib da regra: 6 dígitos'); } catch (_) {} return; }
    if (r.cstIBS && r.cClassTrib && r.cClassTrib.slice(0, 3) !== r.cstIBS) { try { notifyUser('cClassTrib incompatível com o CST da regra (prefixo = CST)'); } catch (_) {} return; }
    Object.keys(r).forEach((k) => { if (r[k] === undefined || r[k] === '') delete r[k]; });
    __natRegrasEdit.push(r);
    ['natRegraDestino', 'natRegraProduto', 'natRegraCFOP', 'natRegraAliq', 'natRegraBase', 'natRegraCodigo', 'natRegraPIS', 'natRegraCOFINS', 'natRegraCSTIBS', 'natRegraCClassTrib'].forEach((id) => { const el = document.getElementById(id); if (el) el.value = ''; });
    __natRenderRegras();
  }
  function _setField(id, value) {
    const el = document.getElementById(id);
    if (el && value !== undefined) el.value = value;
  }

  // ─── Obter natureza por id do cache ───────────────────────────────────────
  function getById(id) {
    return (_cache || []).find(n => n.id === id) || null;
  }

  // ─── Listar todas (ativas) ────────────────────────────────────────────────
  function listar(apenasAtivos = true) {
    const lista = _cache || [];
    return apenasAtivos ? lista.filter(n => n.ativo !== false) : lista;
  }

  // ─── API pública ──────────────────────────────────────────────────────────
  return { carregar, salvar, remover, popularSelect, abrirModal, fecharModal, getById, listar, resolverRegra, aplicarRegraNoItem, NATUREZAS_PADRAO };
})();

window.NFNaturezas = NFNaturezas;
if (typeof module !== 'undefined' && module.exports) module.exports = NFNaturezas;
