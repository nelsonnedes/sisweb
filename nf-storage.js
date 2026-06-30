/**
 * nf-storage.js — Persistência Firebase Multi-Tenant para Notas Fiscais
 * Paths: companies/{tenantId}/fiscal/notas/{modelo}/{nfId}
 * (Alinhado ao namespace canônico do firebaseService.js do Sisweb)
 * Sisweb — NF-e Sistema Multi-Tenant
 */

const NFStorage = (() => {
  'use strict';

  // ─── Helpers de path (companies/ → não prefixado por getNamespacedPath) ───
  function basePath(tenantId) {
    if (!tenantId) throw new Error('tenantId obrigatório');
    return `companies/${tenantId}/fiscal/notas`;
  }

  function modeloPath(tenantId, modelo) {
    const modelos = { 55: 'nfe', 65: 'nfce', nfse: 'nfse', complementar: 'complementar', devolucao: 'devolucao' };
    const m = modelos[modelo] || modelo || 'nfe';
    return `${basePath(tenantId)}/${m}`;
  }

  function configPath(tenantId, sub = '') {
    const base = `companies/${tenantId}/fiscal/config`;
    return sub ? `${base}/${sub}` : base;
  }

  // ─── Firebase wrapper ──────────────────────────────────────────────────────
  function fb() {
    if (!window.firebaseService) throw new Error('Firebase não inicializado');
    return window.firebaseService;
  }

  // ─── Salvar NF (rascunho ou emitida) ─────────────────────────────────────
  async function salvarNF(tenantId, nfData) {
    const modelo = nfData.modelo || 55;
    const id     = nfData.id || `nf_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
    const payload = {
      ...nfData,
      id,
      tenantId,
      updatedAt: new Date().toISOString(),
      createdAt: nfData.createdAt || new Date().toISOString(),
    };
    // saveToFirebase(path, key, data) — key=id cria subnó
    await fb().saveToFirebase(modeloPath(tenantId, modelo), id, payload);
    return { id, path: `${modeloPath(tenantId, modelo)}/${id}`, payload };
  }

  // ─── Atualizar status da NF ───────────────────────────────────────────────
  async function atualizarStatus(tenantId, modelo, nfId, status, extras = {}) {
    const path = `${modeloPath(tenantId, modelo)}/${nfId}`;
    // key=null → merge sobre o nó existente (substitui completamente)
    await fb().saveToFirebase(path, null, {
      status,
      ...extras,
      updatedAt: new Date().toISOString(),
    });
  }

  // ─── Carregar NF por ID ───────────────────────────────────────────────────
  async function carregarNF(tenantId, modelo, nfId) {
    const path = `${modeloPath(tenantId, modelo)}/${nfId}`;
    const result = await fb().loadFromFirebase(path);
    return result?.data || null;
  }

  // ─── Listar NFs por modelo com filtros opcionais ──────────────────────────
  async function listarNFs(tenantId, modelo = 55, filtros = {}) {
    const path   = modeloPath(tenantId, modelo);
    const result = await fb().loadFromFirebase(path);
    let itens    = Object.values(result?.data || {});

    if (filtros.status) itens = itens.filter(n => n.status === filtros.status);
    if (filtros.busca) {
      const b = String(filtros.busca).toLowerCase();
      itens = itens.filter(n =>
        String(n.numero || '').includes(b) ||
        String(n.dest?.nome || '').toLowerCase().includes(b) ||
        String(n.dest?.cnpj || n.dest?.cpf || '').replace(/\D/g,'').includes(b) ||
        String(n.chave || '').includes(b)
      );
    }
    if (filtros.dataInicio) itens = itens.filter(n => n.dataEmissao >= filtros.dataInicio);
    if (filtros.dataFim)    itens = itens.filter(n => n.dataEmissao <= filtros.dataFim);
    // Ordenar por número decrescente
    itens.sort((a, b) => parseInt(b.numero || 0) - parseInt(a.numero || 0));
    return itens;
  }

  // ─── Salvar XML assinado no Storage ──────────────────────────────────────
  async function salvarXML(tenantId, nfId, xmlString) {
    const ref = `companies/${tenantId}/fiscal/xmls/nfe/${nfId}.xml`;
    if (window.storageService?.upload) {
      const blob = new Blob([xmlString], { type: 'application/xml' });
      await window.storageService.upload(ref, blob, 'application/xml');
    } else {
      throw new Error('StorageService indisponível. XML fiscal deve ser salvo no Firebase Storage.');
    }
    return ref;
  }

  // ─── Carregar XML autorizado/gerado do Storage ──────────────────────────
  async function carregarXML(tenantId, nfId, storagePath = '') {
    const ref = storagePath || `companies/${tenantId}/fiscal/xmls/nfe/${nfId}.xml`;
    if (!window.storageService?.download) {
      throw new Error('StorageService indisponível. XML fiscal deve ser lido do Firebase Storage.');
    }
    const buffer = await window.storageService.download(ref);
    return new TextDecoder('utf-8').decode(buffer);
  }

  // ─── Carregar próximo número de NF ───────────────────────────────────────
  async function getProximoNumero(tenantId, modelo = 55) {
    const modKey = modelo == 65 ? 'nfce' : modelo == 'nfse' ? 'nfse' : 'nfe';
    const path   = configPath(tenantId, `numeros/${modKey}`);
    const result = await fb().loadFromFirebase(path);
    return parseInt(result?.data?.proximoNumero || result?.data) || 1;
  }

  // ─── Incrementar próximo número ──────────────────────────────────────────
  async function incrementarNumero(tenantId, modelo = 55) {
    const modKey = modelo == 65 ? 'nfce' : modelo == 'nfse' ? 'nfse' : 'nfe';
    const atual  = await getProximoNumero(tenantId, modelo);
    const proximo = atual + 1;
    const path = configPath(tenantId, `numeros/${modKey}`);
    await fb().saveToFirebase(path, null, {
      proximoNumero: proximo,
      updatedAt: new Date().toISOString(),
    });
    return atual; // retorna o número atual (que foi usado)
  }

  // ─── Estatísticas do dashboard ────────────────────────────────────────────
  async function getEstatisticas(tenantId) {
    try {
      const [nfes, nfces] = await Promise.all([
        listarNFs(tenantId, 55),
        listarNFs(tenantId, 65),
      ]);
      const todas = [...nfes, ...nfces];
      const hoje  = new Date();
      const mesAtual = `${hoje.getFullYear()}-${String(hoje.getMonth() + 1).padStart(2,'0')}`;
      const doMes = todas.filter(n =>
        n.dataEmissao && n.dataEmissao.startsWith(mesAtual) && n.status === 'autorizada'
      );
      return {
        totalEmitidas:   todas.filter(n => n.status === 'autorizada').length,
        totalRascunhos:  todas.filter(n => n.status === 'rascunho').length,
        totalCanceladas: todas.filter(n => n.status === 'cancelada').length,
        totalErros:      todas.filter(n => n.status === 'rejeitada').length,
        faturamentoMes:  doMes.reduce((s, n) => s + (parseFloat(n.total?.vNF) || parseFloat(n.valorTotal) || 0), 0),
        notasMes:        doMes.length,
      };
    } catch (e) {
      console.error('[NFStorage] Erro ao carregar estatísticas:', e);
      return { totalEmitidas: 0, totalRascunhos: 0, totalCanceladas: 0, totalErros: 0, faturamentoMes: 0, notasMes: 0 };
    }
  }

  // ─── Remover NF (apenas rascunho) ────────────────────────────────────────
  async function removerNF(tenantId, modelo, nfId) {
    const path = `${modeloPath(tenantId, modelo)}/${nfId}`;
    await fb().removeFromFirebase(path);
  }

  return {
    salvarNF,
    carregarNF,
    listarNFs,
    atualizarStatus,
    salvarXML,
    carregarXML,
    getProximoNumero,
    incrementarNumero,
    getEstatisticas,
    removerNF,
    modeloPath,
    basePath,
  };
})();

window.NFStorage = NFStorage;
