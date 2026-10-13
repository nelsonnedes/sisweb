/**
 * nf-produtos-nf.js — Integração Produtos/Estoque na Emissão de NF-e
 * Carrega produtos do estoque Firebase e gerencia seleção manual/cadastrado.
 * Sisweb — NF-e Sistema Multi-Tenant
 *
 * Depende de: firebaseService.js, nf-config.js (NFConfigService)
 * Não duplica: nf-tables.js, nf-storage.js, nf-service.js
 *
 * API pública (window.NFProdutosNF):
 *   carregar(tenantId)              → Promise<Array> — carrega estoque Firebase
 *   alterarTipoProduto(tipo)        → 'manual' | 'cadastrado'
 *   popularSelectCadastrados()      → preenche #nfProdCadSelect
 *   autoPreencherPorProduto(prodId) → preenche NCM, CFOP, UN, Valor
 *   getById(id)                     → produto do cache
 */

const NFProdutosNF = (() => {
  'use strict';

  let _produtos = [];
  let _tenantId = null;

  // ─── Firebase wrapper ─────────────────────────────────────────────────────
  function fb() {
    if (!window.firebaseService) throw new Error('Firebase não inicializado');
    return window.firebaseService;
  }

  // ─── Carregar produtos do estoque/Firebase ────────────────────────────────
  async function carregar(tenantId) {
    _tenantId = tenantId;
    _produtos = [];
    try {
      // Tentar path principal do estoque multi-tenant
      const paths = [
        `tenants/${tenantId}/estoque`,
        `tenants/${tenantId}/produtos`,
      ];
      for (const path of paths) {
        const result = await fb().loadFromFirebase(path);
        if (result && result.success && result.data) {
          const arr = Array.isArray(result.data)
            ? result.data
            : Object.values(result.data || {});
          if (arr.length > 0) {
            _produtos = arr.filter(p => p && (p.nome || p.name || p.descricao));
            console.log(`[NFProdutosNF] ${_produtos.length} produtos carregados de "${path}"`);
            break;
          }
        }
      }
    } catch (e) {
      console.warn('[NFProdutosNF] Erro ao carregar produtos:', e.message);
    }
    return _produtos;
  }

  // ─── Alternância entre modo manual e cadastrado ───────────────────────────
  function alterarTipoProduto(tipo) {
    const secManual    = document.getElementById('nfSecaoProdutoManual');
    const secCadastrado = document.getElementById('nfSecaoProdutoCadastrado');
    if (!secManual || !secCadastrado) return;
    if (tipo === 'cadastrado') {
      secManual.style.display    = 'none';
      secCadastrado.style.display = '';
      popularSelectCadastrados();
    } else {
      secManual.style.display    = '';
      secCadastrado.style.display = 'none';
    }
    // Limpar campos ao trocar modo
    _limparCamposItem();
  }

  // ─── Popular select de produtos cadastrados ───────────────────────────────
  function popularSelectCadastrados(selecionarId = null) {
    const sel = document.getElementById('nfProdCadSelect');
    if (!sel) return;
    sel.innerHTML = '<option value="">Selecione um produto cadastrado...</option>';
    _produtos.forEach(p => {
      const id   = p.id || p.codigo || '';
      const nome = p.nome || p.name || p.descricao || 'Produto';
      const cod  = p.codigo || p.code || '';
      const opt  = document.createElement('option');
      opt.value  = id;
      opt.textContent = cod ? `${cod} — ${nome}` : nome;
      opt.dataset.ncm    = p.ncm   || p.NCM  || '';
      opt.dataset.cfop   = p.cfopPadrao || p.cfop || '';
      opt.dataset.un     = p.unidade || p.un  || 'UN';
      opt.dataset.preco  = p.preco  || p.precoVenda || p.valorUnitario || '0';
      opt.dataset.nome   = nome;
      if (selecionarId && id === selecionarId) opt.selected = true;
      sel.appendChild(opt);
    });
  }

  // ─── Preencher campos do formulário com dados do produto selecionado ──────
  // Precedência fiscal (a natureza da operação é a fonte da operação):
  // natureza selecionada > fiscal do produto > produto cadastrado > padrão.
  // NCM/UN/preço vêm do produto; CFOP e CSOSN/CST vêm da NATUREZA quando
  // houver uma selecionada (nfAplicarNatOp já preencheu os campos).
  function autoPreencherPorProduto(prodId) {
    if (!prodId) return;
    const sel = document.getElementById('nfProdCadSelect');
    const opt = sel ? Array.from(sel.options).find(o => o.value === prodId) : null;
    if (!opt) return;
    const natId = document.getElementById('nfNatOpId')?.value || document.getElementById('nfNatOpSelect')?.value || '';
    const nat = natId && window.NFNaturezas?.getById ? window.NFNaturezas.getById(natId) : null;

    // NCM — usa ID com sufixo Cad (seção produto cadastrado)
    const ncmEl = document.getElementById('itemNCMCad');
    if (ncmEl && opt.dataset.ncm) ncmEl.value = opt.dataset.ncm;

    // CFOP: natureza prevalece; produto só preenche se campo vazio/padrão
    const cfopEl = document.getElementById('itemCFOPCad');
    if (cfopEl) {
      if (nat?.cfopPadrao) cfopEl.value = nat.cfopPadrao;
      else if (opt.dataset.cfop && (cfopEl.value === '5102' || !cfopEl.value)) {
        cfopEl.value = opt.dataset.cfop;
      }
    }

    // CSOSN/CST: natureza prevalece; produto NÃO define (sem dado fiscal
    // próprio nesta fase — Fase B guarda override por produto)
    try {
      if (nat?.csosn && typeof window.nfPopularCodigoICMSItem === 'function') {
        window.nfPopularCodigoICMSItem('itemCSOSNCad', nat.csosn);
      }
    } catch (_) {}

    // Unidade — compatível com select (NFPreferencias) ou input
    const unEl = document.getElementById('itemUNCad');
    if (unEl && opt.dataset.un) {
      if (unEl.tagName === 'SELECT') {
        // Tentar selecionar; se não existir, adicionar temporariamente
        const exists = Array.from(unEl.options).find(o => o.value === opt.dataset.un);
        if (!exists) {
          const tmpOpt = document.createElement('option');
          tmpOpt.value = opt.dataset.un; tmpOpt.textContent = opt.dataset.un;
          unEl.insertBefore(tmpOpt, unEl.lastElementChild);
        }
        unEl.value = opt.dataset.un;
      } else {
        unEl.value = opt.dataset.un;
      }
    }

    // Valor unitário
    const valorEl = document.getElementById('itemValorUnitarioCad');
    if (valorEl && opt.dataset.preco) {
      const preco = parseFloat(opt.dataset.preco) || 0;
      if (preco > 0) valorEl.value = 'R$ ' + preco.toLocaleString('pt-BR', { minimumFractionDigits: 2 });
    }

    // Guardar nome para uso no adicionarItemNF
    window._nfProdNomeSelecionado = opt.dataset.nome || opt.textContent;

    // Override fiscal do produto (Fase B) — assíncrono, sem bloquear
    try {
      const pid = prodId;
      if (window.NFProdutosNF?.aplicarFiscalProduto) {
        window.NFProdutosNF.aplicarFiscalProduto(pid).catch(() => {});
      }
    } catch (_) {}
  }

  // ─── Limpar campos de item ────────────────────────────────────────────────
  function _limparCamposItem() {
    ['nfProdCadSelect','itemNomeManual','itemQuantidade','itemValorUnitario',
     'itemQuantidadeCad','itemValorUnitarioCad','itemNCMCad','itemCFOPCad'].forEach(id => {
      const el = document.getElementById(id);
      if (el) el.value = '';
    });
    window._nfProdNomeSelecionado = '';
  }

  // ─── Fiscal por produto (Fase B — override NCM/CEST/fiscais) ────────────
  // Precedência na emissão: regra da natureza > fiscal do produto > config.
  // Store: localStorage imediato + Firebase (fiscal/produtos-fiscais) quando
  // disponível. Chave: id do produto no estoque.
  function fiscalKey(produtoId) { return `nf_prod_fiscal_${produtoId}`; }
  function getFiscal(produtoId) {
    if (!produtoId) return null;
    try {
      const raw = localStorage.getItem(fiscalKey(produtoId));
      if (raw) return JSON.parse(raw);
    } catch (_) {}
    return null;
  }
  async function setFiscal(produtoId, fiscal) {
    if (!produtoId) throw new Error('Produto não identificado');
    const payload = { ...(fiscal || {}), produtoId, updatedAt: new Date().toISOString() };
    try { localStorage.setItem(fiscalKey(produtoId), JSON.stringify(payload)); } catch (_) {}
    try {
      if (_tenantId && window.firebaseService?.saveToFirebase) {
        await window.firebaseService.saveToFirebase(`companies/${_tenantId}/fiscal/produtos-fiscais`, String(produtoId), payload);
      }
    } catch (e) { console.warn('[NFProdutosNF] Fiscal só local:', e.message); }
    return payload;
  }
  async function carregarFiscal(produtoId) {
    const local = getFiscal(produtoId);
    if (local) return local;
    try {
      if (_tenantId && window.firebaseService?.loadFromFirebase) {
        const r = await window.firebaseService.loadFromFirebase(`companies/${_tenantId}/fiscal/produtos-fiscais/${produtoId}`);
        const d = r && r.success ? r.data : r;
        if (d && typeof d === 'object') {
          try { localStorage.setItem(fiscalKey(produtoId), JSON.stringify(d)); } catch (_) {}
          return d;
        }
      }
    } catch (_) {}
    return null;
  }
  // Aplica override fiscal do produto nos campos do form cadastrado — SOMENTE
  // quando NÃO há natureza selecionada (natureza sempre prevalece).
  async function aplicarFiscalProduto(prodId) {
    if (!prodId) return null;
    try {
      const natId = document.getElementById('nfNatOpId')?.value || document.getElementById('nfNatOpSelect')?.value || '';
      if (natId) return null; // natureza prevalece
      const f = await carregarFiscal(prodId);
      if (!f) return null;
      const set = (id, v) => { const el = document.getElementById(id); if (el && v != null && String(v).trim() !== '') el.value = String(v); };
      set('itemNCMCad', f.ncm);
      set('itemCFOPCad', f.cfop);
      if (f.codigo && typeof window.nfPopularCodigoICMSItem === 'function') {
        try { window.nfPopularCodigoICMSItem('itemCSOSNCad', String(f.codigo)); } catch (_) {}
      }
      return f;
    } catch (_) { return null; }
  }

  // ─── Obter produto por ID do cache ────────────────────────────────────────
  function getById(id) {
    return _produtos.find(p => p.id === id || p.codigo === id) || null;
  }

  // ─── Listar todos ─────────────────────────────────────────────────────────
  function listar() { return _produtos; }

  // ─── API pública ──────────────────────────────────────────────────────────
  return { carregar, alterarTipoProduto, popularSelectCadastrados, autoPreencherPorProduto, getById, listar, getFiscal, setFiscal, carregarFiscal, aplicarFiscalProduto };
})();

window.NFProdutosNF = NFProdutosNF;
