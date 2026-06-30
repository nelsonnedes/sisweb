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
  function autoPreencherPorProduto(prodId) {
    if (!prodId) return;
    const sel = document.getElementById('nfProdCadSelect');
    const opt = sel ? Array.from(sel.options).find(o => o.value === prodId) : null;
    if (!opt) return;

    // NCM — usa ID com sufixo Cad (seção produto cadastrado)
    const ncmEl = document.getElementById('itemNCMCad');
    if (ncmEl && opt.dataset.ncm) ncmEl.value = opt.dataset.ncm;

    // CFOP (só se campo estiver vazio ou com valor padrão)
    const cfopEl = document.getElementById('itemCFOPCad');
    if (cfopEl && opt.dataset.cfop && (cfopEl.value === '5102' || !cfopEl.value)) {
      cfopEl.value = opt.dataset.cfop;
    }

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

  // ─── Obter produto por ID do cache ────────────────────────────────────────
  function getById(id) {
    return _produtos.find(p => p.id === id || p.codigo === id) || null;
  }

  // ─── Listar todos ─────────────────────────────────────────────────────────
  function listar() { return _produtos; }

  // ─── API pública ──────────────────────────────────────────────────────────
  return { carregar, alterarTipoProduto, popularSelectCadastrados, autoPreencherPorProduto, getById, listar };
})();

window.NFProdutosNF = NFProdutosNF;
