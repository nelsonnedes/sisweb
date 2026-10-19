// ─── NFDashboard: Relatórios NF-e/NFC-e ─────────────────────────────────────
// Eficiência: 1 leitura (55+65) em cache por visita; filtros/agregação/export
// 100% locais (client-side). Sem chart.js (offline), KPIs + tabela + CSV seguem.
(function () {
  'use strict';

  const PAGE_SIZE_OPTIONS = [10, 25, 50, 100];
  const PAGE_SIZE_DEFAULT = 25;
  const STATUS_LABEL = {
    rascunho: 'Rascunho', aguardando: 'Aguardando SEFAZ', autorizada: 'Autorizada',
    rejeitada: 'Rejeitada', cancelada: 'Cancelada', inutilizada: 'Inutilizada',
    erro_envio: 'Erro de envio',
  };

  let _cache = [];
  let _carregado = false;
  let _carregando = null;
  let _ultimoRel = [];
  let _pagina = 0;
  const _charts = {};

  function num(v) { const n = parseFloat(v); return Number.isFinite(n) ? n : 0; }
  function valorNota(n) { return num(n && n.total && n.total.vNF) || num(n && n.valorTotal) || 0; }
  function dataNota(n) { return String((n && n.dataEmissao) || '').slice(0, 10); }
  function fmtBRL(v) { return num(v).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }); }
  function toast(m, t) { try { if (typeof notifyUser === 'function') notifyUser(m, t); } catch (_) {} }

  // ─── Puras (testáveis) ──────────────────────────────────────────────────
  function filtrarNotas(notas, filtros) {
    const f = filtros || {};
    const ini = String(f.ini || ''), fim = String(f.fim || ''), status = String(f.status || '');
    return (Array.isArray(notas) ? notas : []).filter((n) => {
      if (status && String(n.status || '') !== status) return false;
      const d = dataNota(n);
      if (ini && d < ini) return false;
      if (fim && d > fim) return false;
      return true;
    });
  }

  function impostosDet(det) {
    let icms = 0, ipi = 0, pis = 0, cofins = 0;
    (Array.isArray(det) ? det : []).forEach((it) => {
      const imp = (it && it.imposto) || {};
      icms += num(imp.icms && imp.icms.vICMS) + num(imp.icms && imp.icms.vICMSST);
      ipi += num(imp.ipi && imp.ipi.vIPI);
      pis += num(imp.pis && imp.pis.vPIS);
      cofins += num(imp.cofins && imp.cofins.vCOFINS);
    });
    return { icms, ipi, pis, cofins };
  }

  function agregarNotas(notas) {
    const lista = Array.isArray(notas) ? notas : [];
    const porStatus = {}, porDiaMap = {}, destMap = {};
    let qtdAutorizadas = 0, vAutorizado = 0;
    let icms = 0, ipi = 0, pis = 0, cofins = 0;
    lista.forEach((n) => {
      const st = String(n.status || 'rascunho');
      porStatus[st] = (porStatus[st] || 0) + 1;
      if (st !== 'autorizada') return;
      const v = valorNota(n);
      qtdAutorizadas += 1; vAutorizado += v;
      const d = dataNota(n);
      if (d) porDiaMap[d] = (porDiaMap[d] || 0) + v;
      const nome = String((n.dest && n.dest.nome) || '—').trim() || '—';
      const cur = destMap[nome] || { nome, v: 0, qtd: 0 };
      cur.v += v; cur.qtd += 1; destMap[nome] = cur;
      const t = impostosDet(n.det);
      icms += t.icms; ipi += t.ipi; pis += t.pis; cofins += t.cofins;
    });
    return {
      qtd: lista.length, porStatus, qtdAutorizadas, vAutorizado,
      ticketMedio: qtdAutorizadas ? vAutorizado / qtdAutorizadas : 0,
      porDia: Object.keys(porDiaMap).sort().map((dia) => ({ dia, v: porDiaMap[dia] })),
      topDest: Object.values(destMap).sort((a, b) => b.v - a.v).slice(0, 10),
      impostos: { icms, ipi, pis, cofins },
    };
  }

  function gerarCSV(linhas) {
    const esc = (v) => `"${String(v == null ? '' : v).replace(/"/g, '""')}"`;
    const head = ['Número', 'Data', 'Destinatário', 'CNPJ/CPF', 'Status', 'Valor Total (R$)', 'Chave de acesso'];
    const rows = (Array.isArray(linhas) ? linhas : []).map((n) => ([
      String(n.numero || '').padStart(9, '0'), dataNota(n),
      (n.dest && n.dest.nome) || '', (n.dest && (n.dest.cnpj || n.dest.cpf)) || '',
      STATUS_LABEL[n.status] || n.status || '',
      num(valorNota(n)).toFixed(2).replace('.', ','), n.chave || '',
    ].map(esc).join(';')));
    return '﻿' + [head.map(esc).join(';'), ...rows].join('\r\n');
  }

  // ─── DOM ────────────────────────────────────────────────────────────────
  function setKPI(id, v) { try { const el = document.getElementById(id); if (el) el.textContent = v; } catch (_) {} }

  async function carregar(forcar) {
    if (_carregado && !forcar) return _cache;
    if (_carregando) return _carregando;
    _carregando = (async () => {
      const svc = window.NFService;
      if (!svc) throw new Error('Módulo fiscal não carregado');
      const [a, b] = await Promise.all([
        svc.listarNotas(55, {}).catch(() => []),
        svc.listarNotas(65, {}).catch(() => []),
      ]);
      _cache = [...a, ...b];
      _carregado = true;
      return _cache;
    })();
    try { return await _carregando; }
    finally { _carregando = null; }
  }

  function lerFiltrosRel() {
    return {
      ini: (document.getElementById('relPeriodoInicio') || {}).value || '',
      fim: (document.getElementById('relPeriodoFim') || {}).value || '',
      status: (document.getElementById('relStatusFiltro') || {}).value || '',
    };
  }

  function renderKPIs(ag) {
    setKPI('totalNotasEmitidas', ag.porStatus.autorizada || 0);
    setKPI('valorTotalMes', fmtBRL(ag.vAutorizado));
    setKPI('totalRascunhos', ag.porStatus.rascunho || 0);
    setKPI('totalCanceladas', ag.porStatus.cancelada || 0);
    setKPI('totalAguardando', (ag.porStatus.aguardando || 0) + (ag.porStatus.erro_envio || 0));
    setKPI('totalRejeitadas', ag.porStatus.rejeitada || 0);
  }

  function renderResumo(ag, f) {
    const el = document.getElementById('relResumo');
    if (!el) return;
    const t = ag.impostos;
    const periodo = (f.ini || f.fim) ? `${f.ini || '…'} a ${f.fim || '…'}` : 'todo o período';
    const parts = [
      `<strong>${ag.qtdAutorizadas}</strong> autorizada(s) em ${periodo}`,
      `Total <strong>${fmtBRL(ag.vAutorizado)}</strong>`,
      `Ticket médio <strong>${fmtBRL(ag.ticketMedio)}</strong>`,
    ];
    if (t.icms + t.ipi + t.pis + t.cofins > 0) {
      parts.push(`Impostos destacados: ICMS ${fmtBRL(t.icms)} · IPI ${fmtBRL(t.ipi)} · PIS ${fmtBRL(t.pis)} · COFINS ${fmtBRL(t.cofins)}`);
    }
    el.innerHTML = parts.join(' &nbsp;|&nbsp; ');
  }

  function destruirCharts() {
    Object.keys(_charts).forEach((k) => { try { _charts[k].destroy(); } catch (_) {} delete _charts[k]; });
  }

  function renderCharts(ag) {
    if (typeof Chart === 'undefined') return;
    destruirCharts();
    const mk = (id, cfg) => {
      const cv = document.getElementById(id);
      if (!cv) return;
      _charts[id] = new Chart(cv, cfg);
    };
    const fmtDia = (iso) => String(iso || '').split('-').reverse().join('/');
    mk('nfChartDiaria', { type: 'line',
      data: { labels: ag.porDia.map((p) => fmtDia(p.dia)),
        datasets: [{ label: 'Faturamento (R$)', data: ag.porDia.map((p) => Math.round(p.v * 100) / 100),
          borderColor: '#f97316', backgroundColor: 'rgba(249,115,22,.15)', fill: true, tension: 0.3 }] },
      options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { display: false } } } });
    mk('nfChartStatus', { type: 'doughnut',
      data: { labels: Object.keys(ag.porStatus).map((s) => STATUS_LABEL[s] || s),
        datasets: [{ data: Object.values(ag.porStatus),
          backgroundColor: ['#22c55e', '#eab308', '#f97316', '#ef4444', '#6b7280', '#3b82f6', '#a855f7'] }] },
      options: { responsive: true, maintainAspectRatio: false } });
    mk('nfChartTopDest', { type: 'bar',
      data: { labels: ag.topDest.map((d) => String(d.nome).slice(0, 28)),
        datasets: [{ label: 'R$', data: ag.topDest.map((d) => Math.round(d.v * 100) / 100), backgroundColor: '#fb923c' }] },
      options: { indexAxis: 'y', responsive: true, maintainAspectRatio: false, plugins: { legend: { display: false } } } });
  }

  function pageKey() {
    try {
      let tid = '';
      try { if (window.appTenantId) tid = String(window.appTenantId); } catch (_) {}
      if (!tid) {
        try {
          const ci = JSON.parse(localStorage.getItem('company_info') || 'null') || {};
          tid = String(ci.id || ci.companyId || ci.tenantId || '');
        } catch (_) {}
      }
      const u = (() => { try { return String(window.firebaseService?.currentUser?.uid || 'anon'); } catch (_) { return 'anon'; } })();
      return `nf_dashboard_${tid || 'default'}_${u}_items_per_page`;
    } catch (_) { return 'nf_dashboard_default_anon_items_per_page'; }
  }

  function pageSize() {
    try {
      const v = parseInt(localStorage.getItem(pageKey()) || '', 10);
      if (PAGE_SIZE_OPTIONS.includes(v)) return v;
    } catch (_) {}
    return PAGE_SIZE_DEFAULT;
  }

  function setPageSize(value) {
    const size = parseInt(value, 10);
    if (!PAGE_SIZE_OPTIONS.includes(size)) return;
    try { localStorage.setItem(pageKey(), String(size)); } catch (_) {}
    _pagina = 0;
    renderTabela();
  }

  function mudarPagina(pagina) {
    const size = pageSize();
    const pags = Math.max(1, Math.ceil(_ultimoRel.length / size));
    _pagina = Math.min(Math.max(1, parseInt(pagina, 10) || 1), pags) - 1;
    renderTabela();
  }

  function renderPagination(total, paginaAtual, size) {
    const container = document.getElementById('paginacaoDashboardNF');
    if (!container) return;
    container.innerHTML = '';
    if (!total) return;
    const totalPaginas = Math.ceil(total / size);

    const label = document.createElement('label');
    label.className = 'pagination-size-control';
    label.innerHTML = `<span>Itens por página:</span>
      <select onchange="window.NFDashboard && window.NFDashboard.setPageSize(this.value)">
        ${PAGE_SIZE_OPTIONS.map((opt) => `<option value="${opt}" ${opt === size ? 'selected' : ''}>${opt}</option>`).join('')}
      </select>`;
    container.appendChild(label);

    if (!totalPaginas || totalPaginas <= 1) {
      const info = document.createElement('span');
      info.className = 'pagination-total-info';
      info.textContent = `${total} nota(s)`;
      container.appendChild(info);
      return;
    }

    const host = document.createElement('span');
    host.className = 'pagination-page-buttons';
    container.appendChild(host);
    const addBtn = (text, page, disabled = false, active = false) => {
      const btn = document.createElement('button');
      btn.textContent = text;
      btn.type = 'button';
      if (active) btn.classList.add('active');
      btn.disabled = disabled;
      btn.onclick = () => mudarPagina(page);
      host.appendChild(btn);
    };
    addBtn('<<<', 1, paginaAtual === 1);
    addBtn('<', paginaAtual - 1, paginaAtual === 1);
    const startPage = Math.max(1, paginaAtual - 2);
    const endPage = Math.min(totalPaginas, paginaAtual + 2);
    if (startPage > 1) {
      addBtn('1', 1, false, paginaAtual === 1);
      if (startPage > 2) { const s = document.createElement('span'); s.textContent = '...'; host.appendChild(s); }
    }
    for (let i = startPage; i <= endPage; i++) addBtn(String(i), i, false, i === paginaAtual);
    if (endPage < totalPaginas) {
      if (endPage < totalPaginas - 1) { const s = document.createElement('span'); s.textContent = '...'; host.appendChild(s); }
      addBtn(String(totalPaginas), totalPaginas, false, paginaAtual === totalPaginas);
    }
    addBtn('>', paginaAtual + 1, paginaAtual === totalPaginas);
    addBtn('>>>', totalPaginas, paginaAtual === totalPaginas);
    const info = document.createElement('span');
    info.className = 'pagination-total-info';
    info.textContent = `Pág. ${paginaAtual}/${totalPaginas} · ${total} nota(s)`;
    container.appendChild(info);
  }

  function renderTabela() {
    const tb = document.getElementById('relatorioCorpo');
    if (!tb) return;
    const total = _ultimoRel.length;
    const size = pageSize();
    const pags = Math.max(1, Math.ceil(total / size));
    if (_pagina >= pags) _pagina = pags - 1;
    const fatia = _ultimoRel.slice(_pagina * size, _pagina * size + size);
    tb.innerHTML = fatia.length ? fatia.map((n) => `<tr>
      <td style="font-family:monospace;">${String(n.numero || '').padStart(9, '0')}</td>
      <td>${dataNota(n).split('-').reverse().join('/')}</td>
      <td>${String((n.dest && n.dest.nome) || '—').slice(0, 60)}</td>
      <td>${STATUS_LABEL[n.status] || n.status || '—'}</td>
      <td style="text-align:right;">${fmtBRL(valorNota(n))}</td>
    </tr>`).join('') : '<tr><td colspan="5" style="text-align:center;opacity:.7;">Nenhuma nota no filtro</td></tr>';
    renderPagination(total, _pagina + 1, size);
  }

  async function gerarRelatorio() {
    try {
      toast('📊 Gerando relatório...', 'info');
      const notas = await carregar(false);
      const f = lerFiltrosRel();
      _ultimoRel = filtrarNotas(notas, f).sort((a, b) =>
        String(b.dataEmissao || '').localeCompare(String(a.dataEmissao || '')) || String(b.numero || 0) - String(a.numero || 0));
      _pagina = 0;
      const ag = agregarNotas(_ultimoRel);
      renderResumo(ag, f);
      renderCharts(ag);
      renderTabela();
      toast(`📊 Relatório: ${_ultimoRel.length} nota(s)`, 'success');
    } catch (e) { toast('Erro no relatório: ' + ((e && e.message) || e), 'error'); }
  }

  async function refresh() {
    try {
      const notas = await carregar(true);
      renderKPIs(agregarNotas(notas));
      await gerarRelatorio();
    } catch (e) { toast('Erro ao carregar dashboard: ' + ((e && e.message) || e), 'error'); }
  }

  function irPaginaRelatorio(delta) {
    const size = pageSize();
    const pags = Math.max(1, Math.ceil(_ultimoRel.length / size));
    _pagina = Math.min(pags - 1, Math.max(0, _pagina + (Number(delta) || 0)));
    renderTabela();
  }

  function exportarCSV() {
    if (!_ultimoRel.length) { toast('Nada para exportar — gere o relatório primeiro.', 'warning'); return; }
    const csv = gerarCSV(_ultimoRel);
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    const d = new Date();
    const pad = (x) => String(x).padStart(2, '0');
    a.download = `relatorio-nfe-${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}.csv`;
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(a.href), 5000);
    toast(`⬇️ CSV exportado (${_ultimoRel.length} nota(s))`, 'success');
  }

  window.NFDashboard = {
    filtrarNotas, agregarNotas, gerarCSV, impostosDet, fmtBRL, valorNota,
    gerarRelatorio, exportarCSV, irPaginaRelatorio, refresh, setPageSize, mudarPagina, pageSize,
  };
})();
