/**
 * nf-fiscal-events.js — Catálogo + builder dos Eventos de Conciliação Tributária (RTC)
 * Sisweb — NF-e Sistema Multi-Tenant
 *
 * FONTE: pacote oficial `Eventos_RTC` (17 XSDs, tpEvento 112110–412130).
 * Os 16 eventos de negócio são registrados via NFeRecepcaoEvento4 (mesmo
 * pipeline de CC-e/cancelamento: assinarXMLcomForge infEvento + envelope SOAP
 * 1.00 + persistência em eventos/rtc/NN na Cloud Function nf_eventoRTC).
 * e110001 = "Cancelamento de Evento" (infra, cancela evento RTC anterior —
 * não é evento de negócio; exposto apenas via exclusão implícita da SEFAZ).
 *
 * Padrões de formato herdados dos XSDs (tiposBasico_v1.03):
 *  - TDec_1302:  "0|0.\d{2}|[1-9]\d{0,12}(\.\d{2})?"   (valores IBS/CBS)
 *  - TDec_1104:  "0|0.\d{4}|[1-9]\d{0,10}(\.\d{4})?"   (quantidades)
 *  - TData:      AAAA-MM-DD
 *  - TnItem:     1–990 (atributo nItem, único por detEvento)
 *  - Unidade:    1–6 caracteres
 *
 * Uso: `window.NFRtcEvents.CATALOG[tpEvento]`, `buildDetEvento(tpEvento, payload)`
 * (backend espelha a lógica; este módulo é a fonte do frontend + testes).
 */
(function () {
  'use strict';

  // Grupos de itens por evento: nome do grupo + campos de controle de estoque
  // (quantidade/unidade) específicos de cada XSD.
  const ITEM_GROUP = {
    gConsumo:        { qty: 'qtde',          unit: 'unidade' },
    gPerecimento:    { qty: 'qPerecimento',  unit: 'uPerecimento', credit: true },
    gItemNaoFornecido: { qty: 'qNaoFornecida', unit: 'uNaoFornecida' },
    gImobilizacao:   { qty: 'qImobilizado',  unit: 'uImobilizado' },
    gConsumoComb:    { qty: 'qComb',         unit: 'uComb' },
  };

  // kind: 'item-values' (vIBS/vCBS + controle sem crédito),
  //       'item-values-credit' (vIBS/vCBS + controle COM crédito vIBS/vCBS),
  //       'item-nocontrol' (apenas valores, sem gControleEstoque),
  //       'scalar' (campos escalares), 'flag' (indicador 0/1).
  const CATALOG = {
    112110: { desc: 'Informação de efetivo pagamento integral para liberar crédito presumido do adquirente', autor: '1', kind: 'scalar',
      fields: [{ key: 'indQuitacao', fixed: '1', label: 'Quitação integral (=1)' }] },
    112120: { desc: 'Importação em ALC/ZFM não convertida em isenção', autor: '1', kind: 'item-values',
      group: 'gConsumo', itemLabel: 'Itens não convertidos em isenção' },
    112130: { desc: 'Perecimento, perda, roubo ou furto durante o transporte contratado pelo fornecedor', autor: '1', kind: 'item-values-credit',
      group: 'gPerecimento', itemLabel: 'Itens objeto de perecimento/perda/roubo/furto' },
    112140: { desc: 'Fornecimento não realizado com pagamento antecipado', autor: '1', kind: 'item-values',
      group: 'gItemNaoFornecido', itemLabel: 'Itens não fornecidos (imposto antecipado)' },
    112150: { desc: 'Atualização da Data de Previsão de Entrega', autor: '1', kind: 'scalar',
      fields: [{ key: 'dPrevEntrega', type: 'date', label: 'Nova data prevista de entrega *' }] },
    211110: { desc: 'Solicitação de Apropriação de crédito presumido', autor: '1,2', kind: 'credit-presumed',
      itemLabel: 'Créditos presumidos por item (gCredPresOper)' },
    211124: { desc: 'Perecimento, perda, roubo ou furto durante o transporte contratado pelo adquirente', autor: '2', kind: 'item-values',
      group: 'gPerecimento', itemLabel: 'Itens objeto de perecimento/perda/roubo/furto' },
    211128: { desc: 'Aceite de débito na apuração por emissão de nota de crédito', autor: '2', kind: 'flag',
      fields: [{ key: 'indAceitacao', type: 'flag', label: 'Aceite do débito *' }] },
    211130: { desc: 'Imobilização de Item', autor: '2', kind: 'item-values',
      group: 'gImobilizacao', itemLabel: 'Itens integrados ao ativo imobilizado' },
    211140: { desc: 'Solicitação de Apropriação de Crédito de Combustível', autor: '2', kind: 'item-values',
      group: 'gConsumoComb', itemLabel: 'Consumo de combustíveis por item' },
    211150: { desc: 'Solicitação de Apropriação de Crédito para bens e serviços que dependem de atividade do adquirente', autor: '2', kind: 'item-nocontrol',
      group: 'gCredito', valueFields: ['vCredIBS', 'vCredCBS'], itemLabel: 'Créditos por item (vCredIBS/vCredCBS)' },
    212110: { desc: 'Manifestação sobre Pedido de Transferência de Crédito de IBS em Operação de Sucessão', autor: '8', kind: 'flag',
      fields: [{ key: 'indAceitacao', type: 'flag', label: 'Aceite da transferência *' }] },
    212120: { desc: 'Manifestação sobre Pedido de Transferência de Crédito de CBS em Operação de Sucessão', autor: '8', kind: 'flag',
      fields: [{ key: 'indAceitacao', type: 'flag', label: 'Aceite da transferência *' }] },
    412120: { desc: 'Manifestação do Fisco sobre Pedido de Transferência de Crédito de IBS em Operação de Sucessão', autor: '5', kind: 'scalar',
      fields: [{ key: 'indDeferimento', type: 'flag', label: 'Deferimento (0=Não, 1=Sim) *' },
               { key: 'cMotivo', type: 'motivo', label: 'Motivo (1=Falta manifestação das sucessoras, 2=Outros) *' },
               { key: 'xMotivo', type: 'text500', label: 'Descrição do motivo *' }] },
    412130: { desc: 'Manifestação do Fisco sobre Pedido de Transferência de Crédito de CBS em Operação de Sucessão', autor: '5', kind: 'scalar',
      fields: [{ key: 'indDeferimento', type: 'flag', label: 'Deferimento (0=Não, 1=Sim) *' },
               { key: 'cMotivo', type: 'motivo', label: 'Motivo (1=Falta manifestação das sucessoras, 2=Outros) *' },
               { key: 'xMotivo', type: 'text500', label: 'Descrição do motivo *' }] },
    // Exposto a título documental: o XSD e110001 existe no pacote, mas o
    // tpEvento 211120 é referenciado apenas como alvo de cancelamento —
    // sem schema próprio, NÃO registrável. Fora do <select> do modal.
  };

  // Decimais: aceitam entrada com 1–2 (valores) / 1–4 (quantidades) casas e
  // normalizam para o pattern exato do XSD (2 / 4 casas). Ex.: "1,5" -> "1.50".
  const DEC1302_IN = /^(0|0\.[0-9]{1,2}|[1-9][0-9]{0,12}(\.[0-9]{1,2})?)$/;
  const DEC1104_IN = /^(0|0\.[0-9]{1,4}|[1-9][0-9]{0,10}(\.[0-9]{1,4})?)$/;
  const TDATA = /^20[0-9]{2}-((0[1-9]|1[0-2])-(0[1-9]|[12][0-9]|3[01]))$/;

  function esc(v) {
    return String(v == null ? '' : v)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;').replace(/'/g, '&apos;');
  }

  function dec2(v, field) {
    const s = String(v == null ? '' : v).trim().replace(',', '.');
    if (!DEC1302_IN.test(s)) throw new Error(`RTC: ${field} deve ser decimal 13+2 (ex.: 10.00)`);
    return Number(s).toFixed(2);
  }

  function dec4(v, field) {
    const s = String(v == null ? '' : v).trim().replace(',', '.');
    if (!DEC1104_IN.test(s)) throw new Error(`RTC: ${field} deve ser decimal 11+4 (ex.: 1.0000)`);
    return Number(s).toFixed(4);
  }

  function nItem(v) {
    const n = parseInt(v, 10);
    if (!Number.isFinite(n) || n < 1 || n > 990) throw new Error('RTC: nItem deve estar entre 1 e 990');
    return n;
  }

  function unidade(v, field) {
    const s = String(v || '').trim();
    if (s.length < 1 || s.length > 6) throw new Error(`RTC: ${field} deve ter 1–6 caracteres`);
    return s;
  }

  function flag(v, field) {
    const s = String(v).trim();
    if (s !== '0' && s !== '1') throw new Error(`RTC: ${field} deve ser 0 ou 1`);
    return s;
  }

  function tdata(v, field) {
    const s = String(v || '').trim();
    if (!TDATA.test(s)) throw new Error(`RTC: ${field} deve ser data AAAA-MM-DD`);
    return s;
  }

  function buildControlItem(group, it) {
    const spec = ITEM_GROUP[group];
    const n = nItem(it.nItem);
    const vIBS = dec2(it.vIBS, 'vIBS');
    const vCBS = dec2(it.vCBS, 'vCBS');
    if (spec.credit) {
      const q = dec4(it.qty, spec.qty);
      const u = unidade(it.unit, spec.unit);
      const cIBS = dec2(it.cIBS, 'crédito vIBS a estornar');
      const cCBS = dec2(it.cCBS, 'crédito vCBS a estornar');
      return `<${group} nItem="${n}"><vIBS>${vIBS}</vIBS><vCBS>${vCBS}</vCBS>`
        + `<gControleEstoque><${spec.qty}>${q}</${spec.qty}><${spec.unit}>${esc(u)}</${spec.unit}>`
        + `<vIBS>${cIBS}</vIBS><vCBS>${cCBS}</vCBS></gControleEstoque></${group}>`;
    }
    const q = dec4(it.qty, spec.qty);
    const u = unidade(it.unit, spec.unit);
    return `<${group} nItem="${n}"><vIBS>${vIBS}</vIBS><vCBS>${vCBS}</vCBS>`
      + `<gControleEstoque><${spec.qty}>${q}</${spec.qty}><${spec.unit}>${esc(u)}</${spec.unit}></gControleEstoque></${group}>`;
  }

  function buildCreditoItem(it) {
    // e211150 gCredito: só vCredIBS/vCredCBS, sem controle de estoque
    const n = nItem(it.nItem);
    return `<gCredito nItem="${n}"><vCredIBS>${dec2(it.vCredIBS, 'vCredIBS')}</vCredIBS>`
      + `<vCredCBS>${dec2(it.vCredCBS, 'vCredCBS')}</vCredCBS></gCredito>`;
  }

  function buildCredPresOperItem(it) {
    // e211110 gCredPresOper: vBCCredPres + cCredPres (2 dígitos) + opcional
    // gIBSCredPres/gCBSCredPres (pCredPres 3+2..4, vCredPres 13+2)
    const n = nItem(it.nItem);
    const cc = String(it.cCredPres || '').trim();
    if (!/^[0-9]{2}$/.test(cc)) throw new Error('RTC: cCredPres deve ter 2 dígitos (Anexo IV)');
    let s = `<gCredPresOper nItem="${n}"><vBCCredPres>${dec2(it.vBCCredPres, 'vBCCredPres')}</vBCCredPres><cCredPres>${cc}</cCredPres>`;
    for (const lado of [['gIBSCredPres'], ['gCBSCredPres']]) {
      const g = it[lado[0]];
      if (!g) continue;
      s += `<${lado[0]}><pCredPres>${decP(g.pCredPres)}</pCredPres><vCredPres>${dec2(g.vCredPres, lado[0] + '.vCredPres')}</vCredPres></${lado[0]}>`;
    }
    return s + '</gCredPresOper>';
  }

  function decP(v) {
    // TDec_0302_04: 0 | 0.d{2,4} | [1-9]d{0,2}(.d{2,4})?
    const s = String(v == null ? '' : v).trim().replace(',', '.');
    if (!/^(0|0\.[0-9]{2,4}|[1-9][0-9]{0,2}(\.[0-9]{2,4})?)$/.test(s)) {
      throw new Error('RTC: pCredPres deve ser decimal até 3 inteiros e 2–4 decimais');
    }
    return String(Number(s));
  }

  /**
   * Monta o <detEvento versao="1.00"> do tpEvento RTC a partir do payload
   * do modal. Lança Error com mensagem amigável quando inválido.
   * payload: { cOrgaoAutor, tpAutor, verAplic, scalar:{}, itens:[] }
   */
  function buildDetEvento(tpEvento, payload) {
    const tp = String(tpEvento);
    const def = CATALOG[tp];
    if (!def) throw new Error(`RTC: tpEvento ${tp} não suportado`);
    const p = payload || {};
    const cOrgao = String(p.cOrgaoAutor || '').trim();
    if (!/^[0-9]{2}$/.test(cOrgao)) throw new Error('RTC: cOrgaoAutor deve ser o código IBGE da UF (2 dígitos)');
    const allowedAut = String(def.autor).split(',');
    const tpAutor = String(p.tpAutor != null ? p.tpAutor : allowedAut[0]).trim();
    if (!allowedAut.includes(tpAutor)) throw new Error(`RTC ${tp}: tpAutor deve ser ${allowedAut.join(' ou ')}`);
    const verAplic = String(p.verAplic || '').trim();
    if (verAplic.length < 1 || verAplic.length > 20) throw new Error('RTC: verAplic deve ter 1–20 caracteres');

    let body = '';
    if (def.kind === 'scalar' || def.kind === 'flag') {
      const sc = p.scalar || {};
      for (const f of def.fields) {
        if (f.fixed != null) { body += `<${f.key}>${f.fixed}</${f.key}>`; continue; }
        const raw = sc[f.key];
        if (f.type === 'flag') body += `<${f.key}>${flag(raw, f.key)}</${f.key}>`;
        else if (f.type === 'date') body += `<${f.key}>${tdata(raw, f.key)}</${f.key}>`;
        else if (f.type === 'motivo') {
          const s = String(raw).trim();
          if (s !== '1' && s !== '2') throw new Error('RTC: cMotivo deve ser 1 ou 2');
          body += `<${f.key}>${s}</${f.key}>`;
        } else if (f.type === 'text500') {
          const s = String(raw || '').trim().replace(/\s+/g, ' ');
          if (s.length < 1 || s.length > 500) throw new Error('RTC: xMotivo deve ter 1–500 caracteres');
          body += `<${f.key}>${esc(s)}</${f.key}>`;
        } else body += `<${f.key}>${esc(String(raw || '').trim())}</${f.key}>`;
      }
    } else if (def.kind === 'credit-presumed') {
      const itens = Array.isArray(p.itens) ? p.itens : [];
      if (!itens.length) throw new Error('RTC 211110: informe ao menos 1 item de crédito presumido');
      if (itens.length > 990) throw new Error('RTC: máximo 990 itens por evento');
      const seen = new Set();
      for (const it of itens) {
        const n = nItem(it.nItem);
        if (seen.has(n)) throw new Error(`RTC: nItem ${n} duplicado (único por evento)`);
        seen.add(n);
        body += buildCredPresOperItem(it);
      }
    } else if (def.kind === 'item-nocontrol') {
      const itens = Array.isArray(p.itens) ? p.itens : [];
      if (!itens.length) throw new Error(`RTC ${tp}: informe ao menos 1 item`);
      if (itens.length > 990) throw new Error('RTC: máximo 990 itens por evento');
      const seen = new Set();
      for (const it of itens) {
        const n = nItem(it.nItem);
        if (seen.has(n)) throw new Error(`RTC: nItem ${n} duplicado (único por evento)`);
        seen.add(n);
        body += buildCreditoItem(it);
      }
    } else {
      const itens = Array.isArray(p.itens) ? p.itens : [];
      if (!itens.length) throw new Error(`RTC ${tp}: informe ao menos 1 item`);
      if (itens.length > 990) throw new Error('RTC: máximo 990 itens por evento');
      const seen = new Set();
      for (const it of itens) {
        const n = nItem(it.nItem);
        if (seen.has(n)) throw new Error(`RTC: nItem ${n} duplicado (único por evento)`);
        seen.add(n);
        body += buildControlItem(def.group, it);
      }
    }

    return `<detEvento versao="1.00"><descEvento>${esc(def.desc)}</descEvento>`
      + `<cOrgaoAutor>${cOrgao}</cOrgaoAutor><tpAutor>${tpAutor}</tpAutor>`
      + `<verAplic>${esc(verAplic)}</verAplic>${body}</detEvento>`;
  }

  function listForRole() {
    // Ordem do catálogo oficial; rótulos curtos para o <select> do modal.
    return Object.keys(CATALOG).map((tp) => ({ tpEvento: tp, desc: CATALOG[tp].desc, autor: CATALOG[tp].autor }));
  }

  const api = { CATALOG, ITEM_GROUP, listForRole, buildDetEvento, dec2, dec4, nItem };
  if (typeof window !== 'undefined') window.NFRtcEvents = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  return api;
})();
