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
  const NATUREZAS_PADRAO = [
    { id: 'nat_venda_merc',   descricao: 'Venda de Mercadoria',          cfopPadrao: '5102', tipo: 'saida',   csosn: '102', ativo: true },
    { id: 'nat_venda_prod',   descricao: 'Venda de Produção Própria',    cfopPadrao: '5101', tipo: 'saida',   csosn: '102', ativo: true },
    { id: 'nat_devol_compra', descricao: 'Devolução de Compra',          cfopPadrao: '5202', tipo: 'saida',   csosn: '102', ativo: true },
    { id: 'nat_remessa',      descricao: 'Remessa para Industrialização',cfopPadrao: '5501', tipo: 'saida',   csosn: '400', ativo: true },
    { id: 'nat_transfer',     descricao: 'Transferência de Mercadoria',  cfopPadrao: '5151', tipo: 'saida',   csosn: '102', ativo: true },
    { id: 'nat_compra_merc',  descricao: 'Compra de Mercadoria',         cfopPadrao: '1102', tipo: 'entrada', csosn: '102', ativo: true },
    { id: 'nat_devol_venda',  descricao: 'Devolução de Venda',           cfopPadrao: '1202', tipo: 'entrada', csosn: '102', ativo: true },
    { id: 'nat_brinde',       descricao: 'Remessa em Bonificação/Brinde',cfopPadrao: '5910', tipo: 'saida',   csosn: '400', ativo: true },
  ];

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
      const basePath = getPath(tenantId); // tenants/{tenantId}/config-fiscal/naturezas-operacao
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
    await fb().removeFromFirebase(getPath(tenantId, id));
    if (_cache) _cache = _cache.filter(n => n.id !== id);
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
    // Preencher para edição
    const nat = opts.natureza || {};
    _setField('natOpId', nat.id || '');
    _setField('natOpDescricao', nat.descricao || '');
    _setField('natOpCFOP', nat.cfopPadrao || '5102');
    _setField('natOpTipo', nat.tipo || 'saida');
    _setField('natOpCSOSN', nat.csosn || '102');
    _setField('natOpNotas', nat.notas || '');
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
      <div style="background:#fff;border-radius:8px;width:90%;max-width:560px;box-shadow:0 8px 32px rgba(0,0,0,0.25);overflow:hidden;">
        <div style="background:linear-gradient(135deg,#2c3e50,#34495e);color:#fff;padding:16px 20px;display:flex;align-items:center;justify-content:space-between;">
          <h3 style="margin:0;color:#fff;font-size:16px;display:flex;align-items:center;gap:8px;">
            <i class="fas fa-file-alt"></i> Natureza da Operação
          </h3>
          <button id="natOpFechar" style="background:none;border:none;color:#fff;font-size:22px;cursor:pointer;padding:0;line-height:1;">&times;</button>
        </div>
        <div style="padding:24px;">
          <input type="hidden" id="natOpId">
          <div style="margin-bottom:14px;">
            <label style="font-weight:600;font-size:13px;color:#2c3e50;display:block;margin-bottom:4px;">Descrição: *</label>
            <input type="text" id="natOpDescricao" placeholder="Ex: Venda de Mercadoria" maxlength="60"
              style="width:100%;padding:8px;border:1px solid #ddd;border-radius:4px;font-size:14px;box-sizing:border-box;">
          </div>
          <div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:14px;margin-bottom:14px;">
            <div>
              <label style="font-weight:600;font-size:13px;color:#2c3e50;display:block;margin-bottom:4px;">CFOP Padrão:</label>
              <input type="text" id="natOpCFOP" placeholder="5102" maxlength="4"
                style="width:100%;padding:8px;border:1px solid #ddd;border-radius:4px;font-size:14px;box-sizing:border-box;">
            </div>
            <div>
              <label style="font-weight:600;font-size:13px;color:#2c3e50;display:block;margin-bottom:4px;">Tipo:</label>
              <select id="natOpTipo" style="width:100%;padding:8px;border:1px solid #ddd;border-radius:4px;font-size:14px;box-sizing:border-box;">
                <option value="saida">Saída</option>
                <option value="entrada">Entrada</option>
              </select>
            </div>
            <div>
              <label style="font-weight:600;font-size:13px;color:#2c3e50;display:block;margin-bottom:4px;">CSOSN/CST:</label>
              <select id="natOpCSOSN" style="width:100%;padding:8px;border:1px solid #ddd;border-radius:4px;font-size:14px;box-sizing:border-box;">
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
            <label style="font-weight:600;font-size:13px;color:#2c3e50;display:block;margin-bottom:4px;">Observações:</label>
            <textarea id="natOpNotas" rows="2" maxlength="200" placeholder="Observações opcionais..."
              style="width:100%;padding:8px;border:1px solid #ddd;border-radius:4px;font-size:13px;box-sizing:border-box;resize:vertical;"></textarea>
          </div>
        </div>
        <div style="padding:0 24px 20px;display:flex;gap:10px;justify-content:flex-end;">
          <button id="natOpCancelar" style="padding:9px 18px;border:1px solid #ddd;border-radius:4px;background:#fff;cursor:pointer;font-size:14px;">
            Cancelar
          </button>
          <button id="natOpSalvar" style="padding:9px 18px;border:none;border-radius:4px;background:#2ecc71;color:#fff;cursor:pointer;font-size:14px;font-weight:600;">
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
    document.getElementById('modalNatOp')?.addEventListener('click', (e) => {
      if (e.target.id === 'modalNatOp') fecharModal();
    });
  }

  // ─── Salvar a partir dos campos do modal ──────────────────────────────────
  async function _salvarDoModal() {
    const descricao = (document.getElementById('natOpDescricao')?.value || '').trim();
    if (!descricao) {
      alert('Informe a descrição da Natureza da Operação');
      return;
    }
    const tenantId = _tenantId || window.NFService?.getConfig?.()?.tenantId
      || (() => { try { return JSON.parse(localStorage.getItem('company_info') || '{}').companyId || ''; } catch(_) { return ''; } })();
    if (!tenantId) { alert('Tenant não identificado. Faça login novamente.'); return; }

    const id = document.getElementById('natOpId')?.value || '';
    const nat = {
      id: id || undefined,
      descricao,
      cfopPadrao: document.getElementById('natOpCFOP')?.value || '5102',
      tipo:       document.getElementById('natOpTipo')?.value || 'saida',
      csosn:      document.getElementById('natOpCSOSN')?.value || '102',
      notas:      document.getElementById('natOpNotas')?.value || '',
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
    } catch (e) {
      alert('Erro ao salvar Natureza da Operação: ' + e.message);
    }
  }

  // ─── Helper set field ─────────────────────────────────────────────────────
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
  return { carregar, salvar, remover, popularSelect, abrirModal, fecharModal, getById, listar };
})();

window.NFNaturezas = NFNaturezas;
