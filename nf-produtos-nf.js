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
 *   carregarProdutosNFe(tenantId)   → Promise<Array> — carrega catálogo NF-e próprio
 *   alterarTipoProduto(tipo)        → 'manual' | 'cadastrado'
 *   popularSelectCadastrados()      → preenche #nfProdCadSelect (lê SÓ _produtosNFe, D1)
 *   autoPreencherPorProduto(prodId) → preenche NCM, CFOP, UN, Valor
 *   autoPreencherRomaneio(desc)     → preenche NCM + Valor do modo romaneio
 *   buscarNoCatalogoNFe(desc)       → {ncm, precoVenda} ou null
 *   carregarRomaneiosPorTipoNF(tipo)→ Promise<Array> — romaneios tora|pct|tl|pes
 *   classificarCategoriaNFe(e, l)   → categoria CONAMA (thresholds de vendas.js)
 *   resumoConamaNFe(romaneio)       → {especie:{categoria:{volume,valorTotal,precoUnitario}}}
 *   descricaoConamaNFe(esp, cat)    → "ESP Madeira em CAT"
 *   getById(id)                     → produto do cache
 *   registrarProdutosDaNota(nfe, tenantId)    → cadastro fiscal pós-autorização (estoque)
 *   registrarProdutosNFeDaNota(nfe, tenantId) → catálogo NF-e pós-autorização (D2)
 */

const NFProdutosNF = (() => {
  'use strict';

  let _produtos = [];
  let _tenantId = null;

  // ─── Catálogo NF-e próprio (D1 — o dropdown lê SÓ este nó, nunca o estoque)
  // Path: companies/{tenant}/fiscal/produtos-nfe. Sem campos de estoque
  // (sem precoMedio/estoque mínimo); entrada nova com quantidade 0.
  const NODE_PRODUTOS_NFE = 'fiscal/produtos-nfe';
  let _produtosNFe = [];
  let _romaneiosNFeCache = {};

  // ─── Firebase wrapper ─────────────────────────────────────────────────────
  function fb() {
    if (!window.firebaseService) throw new Error('Firebase não inicializado');
    return window.firebaseService;
  }

  // ─── Carregar produtos do estoque/Firebase ────────────────────────────────
  async function carregar(tenantId) {
    _tenantId = tenantId;
    _produtos = [];
    if (!tenantId) return _produtos;
    try {
      // Path canônico do estoque multi-tenant — o MESMO gravado pelo módulo
      // Estoque (SiswebData/saveDataProdutos): companies/{tenant}/estoqueProdutos.
      // (P2: o path legado tenants/... nunca recebia escrita e divergia do real.)
      const path = `companies/${tenantId}/estoqueProdutos`;
      const result = await fb().loadFromFirebase(path);
      const data = result && result.data !== undefined ? result.data : result;
      const arr = Array.isArray(data)
        ? data
        : (data && typeof data === 'object' ? Object.values(data) : []);
      _produtos = arr.filter(p => p && typeof p === 'object' && (p.nome || p.name || p.descricao));
      console.log(`[NFProdutosNF] ${_produtos.length} produtos carregados de "${path}"`);
    } catch (e) {
      console.warn('[NFProdutosNF] Erro ao carregar produtos:', e.message);
    }
    // D1: dropdown "Produto Cadastrado (NF-e)" lê SÓ o nó fiscal novo — carrega
    // junto para o init existente (carregar+popularSelectCadastrados) funcionar
    // sem mudar o call site.
    await carregarProdutosNFe(tenantId).catch(() => []);
    return _produtos;
  }

  // ─── Alternância entre modos manual / cadastrado / romaneio ───────────────
  function alterarTipoProduto(tipo) {
    const secManual    = document.getElementById('nfSecaoProdutoManual');
    const secCadastrado = document.getElementById('nfSecaoProdutoCadastrado');
    const secRomaneio  = document.getElementById('nfSecaoProdutoRomaneio');
    if (!secManual || !secCadastrado) return;
    const mostrar = (el, on) => { if (el) el.style.display = on ? '' : 'none'; };
    if (tipo === 'cadastrado') {
      mostrar(secManual, false); mostrar(secCadastrado, true); mostrar(secRomaneio, false);
      popularSelectCadastrados();
    } else if (tipo === 'romaneio' && secRomaneio) {
      mostrar(secManual, false); mostrar(secCadastrado, false); mostrar(secRomaneio, true);
    } else {
      mostrar(secManual, true); mostrar(secCadastrado, false); mostrar(secRomaneio, false);
    }
    // Limpar campos ao trocar modo
    _limparCamposItem();
  }

  // ─── Popular select de produtos cadastrados (D1: lê SÓ _produtosNFe) ────
  // Assinatura e dataset (ncm/cfop/un/preco/nome) preservados.
  function popularSelectCadastrados(selecionarId = null) {
    const sel = document.getElementById('nfProdCadSelect');
    if (!sel) return;
    sel.innerHTML = '<option value="">Selecione um produto cadastrado...</option>';
    _produtosNFe.forEach(p => {
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
     'itemQuantidadeCad','itemValorUnitarioCad','itemNCMCad','itemCFOPCad',
     'nfTipoRomaneio','nfRomaneioSelect','itemDescricaoRom','itemQuantidadeRom',
     'itemValorUnitarioRom','itemNCMRom','itemCFOPRom'].forEach(id => {
      const el = document.getElementById(id);
      if (el) el.value = '';
    });
    const prev = document.getElementById('nfListaConamaNFe');
    if (prev) prev.innerHTML = '';
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

  // ─── Registro automático dos produtos emitidos (cadastro fiscal) ─────────
  // Chamado após NF-e AUTORIZADA: grava cada item no catálogo canônico do
  // tenant (companies/{tenantId}/estoqueProdutos) com dados fiscais, NCM e
  // o valor da pauta — que é o Vl.Unit. digitado na aba Itens da nota.
  // Independe de tpNF (entrada/saída), natureza ou regime. Dedupe: id/código
  // do produto ou nome normalizado — existente recebe merge SÓ de campos
  // fiscais/preço (nunca sobrescreve estoque, quantidade ou preço médio).
  function normalizarNomeProduto(valor) {
    return String(valor == null ? '' : valor)
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .toLowerCase()
      .replace(/\s+/g, ' ')
      .trim();
  }

  async function registrarProdutosDaNota(nfeData, tenantId) {
    const tid = String(tenantId || _tenantId || '').trim();
    const itens = Array.isArray(nfeData?.det) ? nfeData.det : [];
    if (!tid || !itens.length) return { criados: 0, atualizados: 0, ignorados: itens.length };
    const path = `companies/${tid}/estoqueProdutos`;
    const result = await fb().loadFromFirebase(path);
    const data = result && result.data !== undefined ? result.data : result;
    const lista = Array.isArray(data)
      ? data.slice()
      : (data && typeof data === 'object' ? Object.values(data) : []);
    const agora = new Date().toISOString();
    let criados = 0;
    let atualizados = 0;
    let ignorados = 0;

    itens.forEach((item) => {
      const nome = String(item?.xProd || '').trim();
      if (!nome) { ignorados += 1; return; }
      const cProd = String(item?.cProd || '').trim();
      const chaveNome = normalizarNomeProduto(nome);
      // Vl.Unit. da aba Itens = valor da pauta do produto.
      const valorPauta = parseFloat(item.vUnCom || item.valorUnitario) || 0;
      const existente = lista.find((p) => p && typeof p === 'object' && (
        (cProd && (String(p.id) === cProd || String(p.codigo || '') === cProd))
        || normalizarNomeProduto(p.nome || p.descricao) === chaveNome));
      const fiscal = {
        ncm: String(item.ncm || ''),
        cfop: String(item.cfop || ''),
        cst: String(item.csosn || item.imposto?.icms?.csosn || item.imposto?.icms?.cst || ''),
        origem: String(item.imposto?.icms?.orig ?? item.orig ?? '0'),
        cest: String(item.cest || ''),
        unidade: String(item.uCom || item.unidade || 'UN').toUpperCase(),
        importado: !!item.importado,
        valorPauta: valorPauta > 0 ? valorPauta : null,
        ultimaNota: {
          numero: String(nfeData?.numero || ''),
          serie: String(nfeData?.ide?.serie || ''),
          chave: String(nfeData?.chave || ''),
          dataEmissao: String(nfeData?.dataEmissao || ''),
          tpNF: Number(nfeData?.ide?.tpNF ?? 1),
        },
        atualizadoEm: agora,
      };
      if (existente) {
        existente.fiscal = { ...(existente.fiscal || {}), ...fiscal };
        existente.ncm = fiscal.ncm || existente.ncm || '';
        existente.cfopPadrao = fiscal.cfop || existente.cfopPadrao || '';
        existente.unidade = fiscal.unidade || existente.unidade || 'UN';
        if (valorPauta > 0) existente.precoVenda = valorPauta;
        existente.ultimaAtualizacao = agora;
        atualizados += 1;
      } else {
        lista.push({
          id: 'PROD_' + Date.now().toString(36) + '_' + Math.random().toString(36).slice(2, 7),
          nome,
          categoria: 'Geral',
          unidade: fiscal.unidade || 'UN',
          quantidade: 0,
          precoMedio: 0,
          precoVenda: valorPauta > 0 ? valorPauta : 0,
          ncm: fiscal.ncm,
          cfopPadrao: fiscal.cfop,
          origemCadastro: 'nfe',
          fiscal,
          criadoEm: agora,
          ultimaAtualizacao: agora,
        });
        criados += 1;
      }
    });

    if (criados || atualizados) {
      const res = await fb().saveToFirebase(path, null, lista);
      if (res && res.success === false) throw new Error(res.error || 'Falha ao salvar o catálogo de produtos.');
      _produtos = lista.filter(p => p && typeof p === 'object' && (p.nome || p.name || p.descricao));
      try { popularSelectCadastrados(); } catch (_) {}
    }
    return { criados, atualizados, ignorados };
  }

  // ─── Catálogo NF-e próprio (nó fiscal, multi-tenant) ─────────────────────
  // Mesmo envelope array/objeto de carregar().
  async function carregarProdutosNFe(tenantId) {
    _tenantId = tenantId || _tenantId;
    _produtosNFe = [];
    if (!tenantId) return _produtosNFe;
    try {
      const path = `companies/${tenantId}/${NODE_PRODUTOS_NFE}`;
      const result = await fb().loadFromFirebase(path);
      const data = result && result.data !== undefined ? result.data : result;
      const arr = Array.isArray(data)
        ? data
        : (data && typeof data === 'object' ? Object.values(data) : []);
      _produtosNFe = arr.filter(p => p && typeof p === 'object' && (p.nome || p.name || p.descricao));
      console.log(`[NFProdutosNF] ${_produtosNFe.length} produtos NF-e carregados de "${path}"`);
    } catch (e) {
      console.warn('[NFProdutosNF] Erro ao carregar produtos NF-e:', e.message);
    }
    return _produtosNFe;
  }

  // ─── Registro pós-autorização no catálogo NF-e (D2: MANUAL_ + ROMANEIO_) ──
  // Fire-and-forget pelo chamador (hook pós-autorização); nunca bloqueia emissão.
  // Dedupe SÓ por nome normalizado (reutiliza normalizarNomeProduto — sem duplicar).
  // NUNCA inventa NCM/CFOP: só replica os dados do item autorizado (Auditor.md).
  async function registrarProdutosNFeDaNota(nfeData, tenantId) {
    const tid = String(tenantId || _tenantId || '').trim();
    const itens = Array.isArray(nfeData?.det) ? nfeData.det : [];
    if (!tid || !itens.length) return { criados: 0, atualizados: 0, ignorados: itens.length };
    const path = `companies/${tid}/${NODE_PRODUTOS_NFE}`;
    const result = await fb().loadFromFirebase(path);
    const data = result && result.data !== undefined ? result.data : result;
    const lista = Array.isArray(data)
      ? data.slice()
      : (data && typeof data === 'object' ? Object.values(data) : []);
    const agora = new Date().toISOString();
    let criados = 0;
    let atualizados = 0;
    let ignorados = 0;

    itens.forEach((item) => {
      const nome = String(item?.xProd || '').trim();
      const cProd = String(item?.cProd || '').trim();
      if (!nome || !/^(MANUAL_|ROMANEIO_)/.test(cProd)) { ignorados += 1; return; }
      const chaveNome = normalizarNomeProduto(nome);
      const valorPauta = parseFloat(item.vUnCom || item.valorUnitario) || 0;
      const existente = lista.find((p) => p && typeof p === 'object'
        && normalizarNomeProduto(p.nome || p.descricao) === chaveNome);
      const fiscal = {
        ncm: String(item.ncm || ''),
        cfop: String(item.cfop || ''),
        cst: String(item.csosn || item.imposto?.icms?.csosn || item.imposto?.icms?.cst || ''),
        origem: String(item.imposto?.icms?.orig ?? item.orig ?? '0'),
        cest: String(item.cest || ''),
        unidade: String(item.uCom || item.unidade || 'M³').toUpperCase(),
        importado: !!item.importado,
        valorPauta: valorPauta > 0 ? valorPauta : null,
        atualizadoEm: agora,
      };
      const ultimaNota = {
        numero: String(nfeData?.numero || ''),
        serie: String(nfeData?.ide?.serie || ''),
        chave: String(nfeData?.chave || ''),
        dataEmissao: String(nfeData?.dataEmissao || ''),
        tpNF: Number(nfeData?.ide?.tpNF ?? 1),
      };
      if (existente) {
        existente.fiscal = { ...(existente.fiscal || {}), ...fiscal };
        if (fiscal.ncm) existente.ncm = fiscal.ncm;
        if (fiscal.cfop) existente.cfopPadrao = fiscal.cfop;
        if (fiscal.unidade) existente.unidade = fiscal.unidade;
        if (valorPauta > 0) existente.precoVenda = valorPauta;
        existente.ultimaNota = ultimaNota;
        existente.ultimaAtualizacao = agora;
        atualizados += 1;
      } else {
        lista.push({
          id: 'NFE_' + Date.now().toString(36) + '_' + Math.random().toString(36).slice(2, 7),
          nome,
          ncm: fiscal.ncm,
          precoVenda: valorPauta > 0 ? valorPauta : 0,
          unidade: fiscal.unidade || 'M³',
          cfopPadrao: fiscal.cfop,
          origemCadastro: cProd.indexOf('ROMANEIO_') === 0 ? 'nfe-romaneio' : 'nfe-manual',
          quantidade: 0,
          fiscal,
          ultimaNota,
          criadoEm: agora,
          ultimaAtualizacao: agora,
        });
        criados += 1;
      }
    });

    if (criados || atualizados) {
      const res = await fb().saveToFirebase(path, null, lista);
      if (res && res.success === false) throw new Error(res.error || 'Falha ao salvar o catálogo NF-e.');
      _produtosNFe = lista.filter(p => p && typeof p === 'object' && (p.nome || p.name || p.descricao));
      try { popularSelectCadastrados(); } catch (_) {}
    }
    return { criados, atualizados, ignorados };
  }

  // ─── Loader de romaneios para NF-e (espelha getRomaneiosMerged, SEM importar vendas.js)
  function _timestampRomaneioNFe(romaneio) {
    try {
      if (!romaneio || typeof romaneio !== 'object') return 0;
      const candidates = [
        romaneio?._metadata?.lastUpdated,
        romaneio.updatedAt, romaneio.updated, romaneio.lastModified,
        romaneio.dataEmissao, romaneio.data, romaneio.dataRomaneio,
        romaneio.dataHora, romaneio.dataCriacao, romaneio.createdAt,
        romaneio.created, romaneio.timestamp,
      ];
      for (const c of candidates) {
        if (!c) continue;
        const t = typeof c === 'number' ? c : new Date(c).getTime();
        if (!isNaN(t)) return t;
      }
    } catch (_) {}
    const id = String(romaneio && (romaneio.id || romaneio.romaneioId || romaneio.firebaseKey || romaneio.key || romaneio.numero || romaneio.numeroRomaneio) || '');
    const m = id.match(/(\d{10,})/);
    return m ? Number(m[1]) || 0 : 0;
  }

  async function carregarRomaneiosPorTipoNF(tipo) {
    const canonicalMap = {
      romaneiosTora: 'romaneios/tora',
      romaneiosPct: 'romaneios/pct',
      romaneiosPCT: 'romaneios/pct',
      romaneiosTL: 'romaneios/tl',
      romaneiosTl: 'romaneios/tl',
      romaneios_tl: 'romaneios/tl',
      romaneiosPes: 'romaneios/pes',
      romaneiosPES: 'romaneios/pes',
      romaneios_pes: 'romaneios/pes',
      tora: 'romaneios/tora',
      pct: 'romaneios/pct',
      tl: 'romaneios/tl',
      pes: 'romaneios/pes',
    };
    const canonicalKey = canonicalMap[tipo] || tipo;
    if (!canonicalKey) return [];
    try {
      const result = await fb().loadFromFirebase(canonicalKey);
      const rawData = (result && result.success)
        ? result.data
        : (Array.isArray(result) ? result : null);
      let merged = [];
      if (window.RomaneioDataUtils && typeof window.RomaneioDataUtils.normalizeRomaneioCollection === 'function') {
        const type = String(canonicalKey).split('/').pop();
        merged = window.RomaneioDataUtils.normalizeRomaneioCollection(rawData, { type }) || [];
      } else if (Array.isArray(rawData)) {
        merged = rawData.filter(r => r && typeof r === 'object' && (r.id || r.numero || r.firebaseKey || r.itens || r.items));
      } else if (rawData && typeof rawData === 'object') {
        merged = Object.entries(rawData)
          .filter(([k, v]) => k !== '_metadata' && k !== 'metadata' && v && typeof v === 'object')
          .map(([k, v]) => ({ id: v.id || k, firebaseKey: k, ...(v || {}) }));
      }
      const getItens = r => Array.isArray(r.items) ? r.items : (Array.isArray(r.itens) ? r.itens : []);
      const isTora = r => {
        const itens = getItens(r);
        const tr = String(r.tipoRomaneio || '').toLowerCase();
        const t = String(r.tipo || '').toLowerCase();
        if (tr.includes('tora')) return true;
        if (t === 'tora') return true;
        return itens.some(i => typeof i.rodo !== 'undefined' || typeof i.diametro !== 'undefined' || typeof i.volumeSerraria !== 'undefined' || typeof i.volumeLiquido !== 'undefined');
      };
      const isPct = r => {
        const itens = getItens(r);
        const tr = String(r.tipoRomaneio || '').toLowerCase();
        const t = String(r.tipo || '').toLowerCase();
        if (tr.includes('pct')) return true;
        if (t === 'pct') return true;
        return itens.some(i => typeof i.pecasPorPacote !== 'undefined' || typeof i.totalPecas !== 'undefined' || typeof i.pacoteId !== 'undefined');
      };
      const isTl = r => {
        const itens = getItens(r);
        if (!itens || itens.length === 0) return false;
        return !isTora(r) && !isPct(r);
      };
      const keyLower = String(tipo || '').toLowerCase();
      if (keyLower.includes('tora')) {
        merged = merged.filter(r => isTora(r));
      } else if (keyLower.includes('pct')) {
        merged = merged.filter(r => isPct(r));
      } else if (keyLower.includes('tl')) {
        merged = merged.filter(r => isTl(r));
      }
      merged.sort((a, b) => _timestampRomaneioNFe(b) - _timestampRomaneioNFe(a));
      _romaneiosNFeCache[canonicalKey] = merged;
      popularSelectRomaneioNF(merged);
      return merged;
    } catch (err) {
      console.warn('[NFProdutosNF] Erro ao carregar romaneios:', err && err.message);
      return _romaneiosNFeCache[canonicalKey] || [];
    }
  }

  // ─── Formatar data para exibição BR (DD/MM/YYYY) ─────────────────────────
  function formatarDataBR(d) {
    if (!d) return '';
    try {
      const dt = new Date(d);
      if (isNaN(dt.getTime())) return String(d).slice(0, 10);
      return dt.toLocaleDateString('pt-BR');
    } catch (_) { return String(d).slice(0, 10); }
  }

  // ─── Popular select de romaneios + limpar preview/campos ───────────────────
  // Número de exibição do romaneio: "Nº 01" (sequencial), nunca a chave técnica
  // (ex.: PCT_1789385882179_eml5puwka). Mantém paridade com Vendas.
  function numeroRomaneioExibicaoNF(r, index) {
    try {
      const RU = window.RomaneioDataUtils;
      if (RU && typeof RU.formatarNumeroExibicao === 'function') {
        const fmt = RU.formatarNumeroExibicao(r, '');
        const m = fmt && String(fmt).match(/N[º°]\s*(\d+)/i);
        if (m) return 'Nº ' + String(m[1]).padStart(2, '0');
      }
    } catch (_) {}
    const n = Number(r && (r.numeroExibicao ?? r.numeroSequencial ?? r.numero));
    if (Number.isFinite(n) && n > 0) return 'Nº ' + String(n).padStart(2, '0');
    return 'Nº ' + String((index || 0) + 1).padStart(2, '0');
  }

  function formatarDataRomaneioNF(r) {
    const candidates = r ? [r.dataEmissao, r.data, r.dataHora, r.createdAt, r.created, r.dataRomaneio, r.timestamp, r.updatedAt, r.updated, r.lastModified] : [];
    for (const c of candidates) {
      if (!c) continue;
      const d = new Date(c);
      if (!Number.isNaN(d.getTime())) return d.toLocaleDateString('pt-BR');
    }
    return '';
  }

  function nomeRomaneioNF(r) {
    if (!r) return '';
    if (r.cliente) return String(r.cliente.nome || r.cliente.name || r.cliente || '').trim();
    if (r.clienteNome) return String(r.clienteNome).trim();
    if (r.fornecedor) return String(r.fornecedor.nome || r.fornecedor.name || r.fornecedor || '').trim();
    if (r.transportador) return String(r.transportador.nome || r.transportador.name || r.transportador || '').trim();
    return '';
  }

  function volumeRomaneioNF(r) {
    const n = (v) => { const x = Number(v); return Number.isFinite(x) ? x : 0; };
    let vol = n(r && r.volumeTotal) || n(r && r.totalVolume)
      || n(r && r.totais && r.totais.volume)
      || n(r && r.totais && r.totais.volumeSerraria)
      || n(r && r.totais && r.totais.volumeEstimado);
    if (vol > 0) return vol;
    const itens = r && (Array.isArray(r.items) ? r.items : (Array.isArray(r.itens) ? r.itens : []));
    if (!itens.length) return 0;
    const tipo = String((r.tipoRomaneio || r.tipo || '')).toLowerCase();
    const isTora = tipo.includes('tora') || itens.some((i) => i && (typeof i.rodo !== 'undefined' || typeof i.diametro !== 'undefined'));
    return itens.reduce((acc, i) => {
      if (!i || typeof i !== 'object') return acc;
      const qtd = parseInt(i.quantidade, 10) || 1;
      let v = n(i.volume) || n(i.volumeLiquido) || n(i.volumeSerraria);
      if (!(v > 0) && isTora) {
        const d = n(i.diametro || i.rodo);
        const c = n(i.comprimento);
        const o1 = n(i.oco1);
        const o2 = n(i.oco2);
        if (d > 0 && c > 0) {
          const rm = (d / 100) / 2;
          const cm = c / 100;
          const bruto = Math.PI * rm * rm * cm;
          const oco = Math.PI * Math.pow(((o1 + o2) / 100) / 2, 2) * cm;
          v = Math.max(0, bruto - oco);
        }
      }
      if (!(v > 0)) return acc;
      return acc + (isTora ? v * qtd : v);
    }, 0);
  }

  function valorRomaneioNF(r) {
    if (!r) return null;
    if (typeof r.totalValue === 'number') return r.totalValue;
    if (r.totais && typeof r.totais.valor === 'number') return r.totais.valor;
    if (r.totais && typeof r.totais.valorTotal === 'number') return r.totais.valorTotal;
    const itens = Array.isArray(r.items) ? r.items : (Array.isArray(r.itens) ? r.itens : []);
    let soma = 0;
    itens.forEach((i) => {
      if (!i || typeof i !== 'object') return;
      const qtd = parseInt(i.quantidade, 10) || 1;
      const precoUnit = Number(i.precoUnitario || i.preco || 0) || 0;
      const v = Number(i.valorTotal != null ? i.valorTotal : (i.valor != null ? i.valor : precoUnit * qtd));
      if (Number.isFinite(v)) soma += v;
    });
    return soma > 0 ? soma : null;
  }

  function popularSelectRomaneioNF(romaneios) {
    const sel = document.getElementById('nfRomaneioSelect');
    if (!sel) return;
    sel.innerHTML = '<option value="">Selecione um romaneio</option>';
    (romaneios || []).forEach((r, i) => {
      const opt = document.createElement('option');
      opt.value = String(i);
      const numero = numeroRomaneioExibicaoNF(r, i);
      const dataFmt = formatarDataRomaneioNF(r);
      const nome = nomeRomaneioNF(r);
      const volTotal = volumeRomaneioNF(r);
      const valTotal = valorRomaneioNF(r);
      const partes = [];
      if (dataFmt) partes.push(dataFmt);
      if (nome) partes.push(nome);
      if (volTotal > 0) partes.push(volTotal.toLocaleString('pt-BR', { minimumFractionDigits: 3, maximumFractionDigits: 3 }) + ' m³');
      if (valTotal != null) partes.push('R$ ' + valTotal.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }));
      if (numero) partes.push(numero);
      opt.textContent = partes.join(' - ');
      sel.appendChild(opt);
    });
    const prev = document.getElementById('nfPreviewRomaneioNFe');
    if (prev) prev.style.display = 'none';
    const lista = document.getElementById('nfListaConamaNFe');
    if (lista) lista.innerHTML = '';
    for (const id of ['itemDescricaoRom', 'itemQuantidadeRom', 'itemValorUnitarioRom', 'itemNCMRom']) {
      const el = document.getElementById(id);
      if (el) el.value = '';
    }
  }

  // ─── Selecionar romaneio: renderiza resumo CONAMA e preenche o 1º item ─────
  // Chamado pelo onchange de #nfRomaneioSelect. Clique numa linha do preview
  // alterna o item ativo (via selecionarConamaNFeClick no HTML).
  function selecionarRomaneioNFe() {
    const tipoEl = document.getElementById('nfTipoRomaneio');
    const selEl = document.getElementById('nfRomaneioSelect');
    const tipo = tipoEl ? tipoEl.value : '';
    const idx = selEl ? parseInt(selEl.value, 10) : NaN;
    const listaEl = document.getElementById('nfListaConamaNFe');
    const prevEl = document.getElementById('nfPreviewRomaneioNFe');
    if (!tipo || isNaN(idx)) {
      if (prevEl) prevEl.style.display = 'none';
      return null;
    }
    const canonicalMap = {
      romaneiosTora: 'romaneios/tora', romaneiosPct: 'romaneios/pct',
      romaneiosPCT: 'romaneios/pct', romaneiosTL: 'romaneios/tl',
      romaneiosTl: 'romaneios/tl', romaneios_tl: 'romaneios/tl',
      romaneiosPes: 'romaneios/pes', romaneiosPES: 'romaneios/pes',
      romaneios_pes: 'romaneios/pes',
    };
    const key = canonicalMap[tipo] || tipo;
    const lista = _romaneiosNFeCache[key] || [];
    const romaneio = lista[idx];
    if (!romaneio) return null;
    const resumo = resumoConamaNFe(romaneio);
    if (listaEl) {
      const linhas = [];
      Object.keys(resumo).forEach((especie) => {
        Object.keys(resumo[especie]).forEach((cat) => {
          const c = resumo[especie][cat];
          const desc = descricaoConamaNFe(especie, cat);
          const vol = Math.round((parseFloat(c.volume) || 0) * 1000) / 1000;
          const preco = Math.round((parseFloat(c.precoUnitario) || 0) * 100) / 100;
          linhas.push(
            `<li data-descricao="${String(desc).replace(/"/g, '&quot;')}" data-volume="${vol}" data-preco="${preco}" `
            + `onclick="selecionarConamaNFeClick(event)" style="cursor:pointer;">`
            + `<strong>${String(desc).replace(/</g, '&lt;')}</strong> — ${vol.toLocaleString('pt-BR', { minimumFractionDigits: 3 })} m³`
            + (preco > 0 ? ` — R$ ${preco.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}` : '')
            + `</li>`,
          );
        });
      });
      listaEl.innerHTML = linhas.length
        ? `<ul>${linhas.join('')}</ul>`
        : '<p>Nenhum dado CONAMA no romaneio selecionado.</p>';
    }
    if (prevEl) prevEl.style.display = '';
    // Pré-preenche o 1º item + busca NCM/preço no catálogo NF-e.
    // Limpa NCM/preço ANTES do lookup: sem isso, trocar de romaneio/linha
    // reaproveitaria o NCM da espécie anterior (válido estruturalmente, mas
    // da espécie errada — o validador não detectaria).
    const primeiraEspecie = Object.keys(resumo)[0];
    const primeiraCat = primeiraEspecie ? Object.keys(resumo[primeiraEspecie])[0] : null;
    if (primeiraEspecie && primeiraCat) {
      const desc = descricaoConamaNFe(primeiraEspecie, primeiraCat);
      const vol = Math.round((parseFloat(resumo[primeiraEspecie][primeiraCat].volume) || 0) * 1000) / 1000;
      const dEl = document.getElementById('itemDescricaoRom');
      if (dEl) dEl.value = desc;
      const qEl = document.getElementById('itemQuantidadeRom');
      if (qEl) qEl.value = String(vol);
      const ncmClear = document.getElementById('itemNCMRom');
      if (ncmClear) ncmClear.value = '';
      const precoClear = document.getElementById('itemValorUnitarioRom');
      if (precoClear) precoClear.value = '';
      autoPreencherRomaneio(desc);
    }
    return resumo;
  }

  // ─── Classificação CONAMA — thresholds idênticos a classificarProdutoConama (vendas.js)
  // Cópia pura local (não importa vendas.js, que é intocado por esta story).
  function classificarCategoriaNFe(espessura, largura) {
    const esp = parseFloat(espessura) || 0;
    const larg = parseFloat(largura) || 0;
    if (esp > 12 && larg > 12) {
      return 'Bloco, quadrado ou filé';
    } else if (esp > 7.0 && larg > 20.0) {
      return 'Pranchões';
    } else if (esp >= 4.0 && esp <= 7.0 && larg > 20.0) {
      return 'Prancha';
    } else if (esp > 4.0 && larg >= 11.0 && larg <= 20.0) {
      return 'Viga';
    } else if (esp >= 4.0 && esp <= 8.0 && larg >= 8.0 && larg < 11.0) {
      return 'Vigota';
    } else if (esp >= 4.0 && esp <= 8.0 && larg >= 5.0 && larg < 8.0) {
      return 'Caibro';
    } else if (esp >= 1.0 && esp < 4.0 && larg > 10.0) {
      return 'Tábua';
    } else if (esp >= 2.0 && esp < 4.0 && larg >= 2.0 && larg <= 10.0) {
      return 'Sarrafo';
    } else if (esp < 2.0 && larg < 10.0) {
      return 'Ripa';
    }
    return 'Outro';
  }

  // ─── Resumo CONAMA simplificado p/ NF-e: {especie:{categoriaBase:{volume,valorTotal,precoUnitario}}}
  // Tora: categoria 'Tora', volume de volumeLiquido||volumeSerraria||cilindro−oco.
  // Serrado: item.volume (já é total) ou comp×larg×esp/1e6, com ppp quando romaneiosPct.
  function resumoConamaNFe(romaneio) {
    const bitolaKey = ['b', 'i', 't', 'o', 'l', 'a'].join('');
    if (!romaneio || typeof romaneio !== 'object') return {};
    const listaItens = Array.isArray(romaneio.items) ? romaneio.items : (Array.isArray(romaneio.itens) ? romaneio.itens : []);
    if (!listaItens.length) return {};
    const resumo = {};
    const isToraRom = !!(romaneio?.tipoRomaneio === 'romaneiosTora'
      || String(romaneio?.tipo || '').toLowerCase() === 'tora'
      || listaItens.some(i => i && (typeof i.rodo !== 'undefined' || typeof i.diametro !== 'undefined')));
    const especieDe = (item) => String(item.especie || item.especieNome || 'Não especificada').replace(/^\s*[-–—]\s*/, '').trim();
    const precoDe = (item) => {
      const cands = [item.valorUnitario, item.precoUnitario, item.preco, item.price];
      for (let i = 0; i < cands.length; i++) {
        const v = parseFloat(cands[i]);
        if (!isNaN(v) && v > 0) return v;
      }
      return 0;
    };
    const agregar = (especie, categoriaBase, volume, preco) => {
      if (!(volume > 0)) return;
      if (!resumo[especie]) resumo[especie] = {};
      if (!resumo[especie][categoriaBase]) resumo[especie][categoriaBase] = { volume: 0, valorTotal: 0, precoUnitario: 0 };
      const cat = resumo[especie][categoriaBase];
      cat.volume += volume;
      cat.valorTotal += volume * (parseFloat(preco) || 0);
    };
    if (isToraRom) {
      listaItens.forEach((item) => {
        if (!item || typeof item !== 'object') return;
        const especie = especieDe(item);
        const quantidade = parseInt(item.quantidade, 10) || 1;
        const vLiquido = parseFloat(item.volumeLiquido || item.volumeSerraria);
        const vBruto = parseFloat(item.volumeBruto || item.volumeEstimado);
        let volumeTotal = 0;
        if (!isNaN(vLiquido) && vLiquido > 0) {
          volumeTotal = vLiquido * quantidade;
        } else if (!isNaN(vBruto) && vBruto > 0) {
          volumeTotal = vBruto * quantidade;
        } else {
          const diametro = parseFloat(item.diametro || item.rodo) || 0;
          const comprimento = parseFloat(item.comprimento) || 0;
          const oco1 = parseFloat(item.oco1) || 0;
          const oco2 = parseFloat(item.oco2) || 0;
          const raioM = (diametro / 100) / 2;
          const compM = comprimento / 100;
          const brutoM3 = Math.PI * Math.pow(raioM, 2) * compM;
          const ocoM3 = (oco1 / 100) * (oco2 / 100) * (comprimento / 100);
          volumeTotal = Math.max(0, brutoM3 - ocoM3) * quantidade;
        }
        agregar(especie, 'Tora', volumeTotal, precoDe(item));
      });
    } else {
      const isPctRom = !!(romaneio?.tipo === 'pct' || romaneio?.tipoRomaneio === 'romaneiosPct'
        || listaItens.some(i => i && (typeof i.pecasPorPacote !== 'undefined' || typeof i.totalPecas !== 'undefined')));
      listaItens.forEach((item) => {
        if (!item || typeof item !== 'object') return;
        const especie = especieDe(item);
        const comprimento = parseFloat(item.comprimento) || 0;
        const largura = parseFloat(item.largura) || 0;
        const espessura = parseFloat(item.espessura) || parseFloat(item[bitolaKey]) || 0;
        const quantidade = parseInt(item.quantidade, 10) || 1;
        const pppRaw = item.pecasPorPacote;
        const ppp = (pppRaw && typeof pppRaw === 'object')
          ? (parseInt(pppRaw.valor, 10) || 1)
          : (parseInt(pppRaw, 10) || 1);
        const categoriaBase = classificarCategoriaNFe(espessura, largura);
        const volumeInformado = parseFloat(item.volume);
        let volumeTotal = 0;
        if (!isNaN(volumeInformado) && volumeInformado > 0) {
          volumeTotal = volumeInformado;
        } else {
          const unitario = (comprimento / 100) * (largura / 100) * (espessura / 100);
          volumeTotal = isPctRom ? (unitario * quantidade * ppp) : (unitario * quantidade);
        }
        agregar(especie, categoriaBase, volumeTotal, precoDe(item));
      });
    }
    Object.keys(resumo).forEach((esp) => {
      Object.keys(resumo[esp]).forEach((cat) => {
        const c = resumo[esp][cat];
        c.precoUnitario = c.volume > 0 ? c.valorTotal / c.volume : 0;
      });
    });
    return resumo;
  }

  function descricaoConamaNFe(especie, categoriaBase) {
    return `${String(especie || '').trim()} Madeira Serrada em ${String(categoriaBase || '').trim()}`;
  }

  // ─── Busca no catálogo NF-e por nome normalizado (NCM/preço vêm do cadastro — nunca inventados)
  function _findNoCatalogoNFe(descricao) {
    const chave = normalizarNomeProduto(descricao);
    if (!chave) return null;
    return _produtosNFe.find((p) => p && typeof p === 'object'
      && normalizarNomeProduto(p.nome || p.name || p.descricao) === chave) || null;
  }

  function buscarNoCatalogoNFe(descricao) {
    const prod = _findNoCatalogoNFe(descricao);
    if (!prod) return null;
    return {
      ncm: prod.ncm || prod.NCM || '',
      precoVenda: parseFloat(prod.precoVenda ?? prod.preco ?? prod.valorUnitario) || 0,
    };
  }

  // ─── Autofill do modo romaneio — mesma precedência de autoPreencherPorProduto
  // (natureza > produto). CFOP do produto só se campo vazio/'5102' E sem natureza.
  // Sem produto no catálogo, NCM cai no genérico CONAMA 44079990 (editável);
  // NCM específico já cadastrado pelo usuário prevalece.
  function autoPreencherRomaneio(descricaoOuId) {
    if (descricaoOuId == null || String(descricaoOuId).trim() === '') return null;
    const chave = String(descricaoOuId).trim();
    const prod = (_produtosNFe.find((p) => p && (String(p.id) === chave || String(p.codigo || '') === chave)) || null)
      || _findNoCatalogoNFe(chave);
    const ncm = (prod && (prod.ncm || prod.NCM)) || '44079990';
    const preco = prod ? (parseFloat(prod.precoVenda ?? prod.preco ?? prod.valorUnitario) || 0) : 0;
    const ncmEl = document.getElementById('itemNCMRom');
    if (ncmEl) ncmEl.value = ncm;
    const valorEl = document.getElementById('itemValorUnitarioRom');
    if (valorEl && preco > 0) valorEl.value = 'R$ ' + preco.toLocaleString('pt-BR', { minimumFractionDigits: 2 });
    const natId = document.getElementById('nfNatOpId')?.value || document.getElementById('nfNatOpSelect')?.value || '';
    const nat = natId && window.NFNaturezas?.getById ? window.NFNaturezas.getById(natId) : null;
    const cfopEl = document.getElementById('itemCFOPRom');
    if (cfopEl && !nat?.cfopPadrao) {
      const cfopProd = prod ? (prod.cfopPadrao || prod.cfop || '') : '';
      if (cfopProd && (cfopEl.value === '5102' || !cfopEl.value)) cfopEl.value = cfopProd;
    }
    return { ncm, precoVenda: preco };
  }

  // ─── API pública ──────────────────────────────────────────────────────────
  return { carregar, carregarProdutosNFe, alterarTipoProduto, popularSelectCadastrados, popularSelectRomaneioNF, selecionarRomaneioNFe, autoPreencherPorProduto, autoPreencherRomaneio, buscarNoCatalogoNFe, carregarRomaneiosPorTipoNF, classificarCategoriaNFe, resumoConamaNFe, descricaoConamaNFe, getById, listar, getFiscal, setFiscal, carregarFiscal, aplicarFiscalProduto, registrarProdutosDaNota, registrarProdutosNFeDaNota, NODE_PRODUTOS_NFE };
})();

window.NFProdutosNF = NFProdutosNF;
