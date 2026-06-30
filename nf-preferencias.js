/**
 * nf-preferencias.js — Preferências de Emissão NF (Unidades e Casas Decimais)
 * Firebase path: companies/{tenantId}/fiscal/config/preferencias
 * (Alinhado ao namespace canônico do firebaseService.js do Sisweb)
 * Sisweb — NF-e Sistema Multi-Tenant
 *
 * Aproveita NFeTables.UNIDADES (nf-tables.js) como base e NFConfigService.saveConfigSection().
 *
 * API pública (window.NFPreferencias):
 *   carregar(tenantId)       → Promise<{unidades, casasDecimaisQtd, unidadePadrao, transportePadrao}>
 *   salvar(tenantId, prefs)  → Promise<void>
 *   aplicarNaFormulario()    → aplica step e unidades no formulário de emissão
 *   popularSelectUnidade(selectId)
 *   getPrefs()               → objeto atual (do cache)
 */

const NFPreferencias = (() => {
  'use strict';

  // ─── Defaults ─────────────────────────────────────────────────────────────
  const DEFAULT_PREFS = {
    // Lista de unidades disponíveis (base: NFeTables.UNIDADES se disponível)
    unidades: ['UN', 'PC', 'CX', 'KG', 'G', 'T', 'L', 'ML', 'M', 'M2', 'M3', 'CM', 'DZ', 'PCT', 'JG'],
    casasDecimaisQtd: 3,   // 0 | 2 | 3 | 4
    unidadePadrao: 'UN',
    transportePadrao: {
      modFrete: 9,
      especie: '',
      marca: '',
    },
  };

  let _prefs = null;
  let _tenantId = null;

  // ─── Carregar preferências ────────────────────────────────────────────────
  async function carregar(tenantId) {
    _tenantId = tenantId;
    // Usar unidades do NFeTables se disponível como seed
    const baseUnidades = (window.NFeTables?.UNIDADES) || DEFAULT_PREFS.unidades;
    try {
      if (!window.NFConfigService?.loadConfig) {
        throw new Error('NFConfigService indisponível para leitura.');
      }
      let remotePrefs = null;
      const cfg = await window.NFConfigService.loadConfig(tenantId);
      if (cfg && cfg.preferencias && typeof cfg.preferencias === 'object') {
        remotePrefs = cfg.preferencias;
      }
      _prefs = remotePrefs
        ? { ...DEFAULT_PREFS, unidades: baseUnidades, ...remotePrefs }
        : { ...DEFAULT_PREFS, unidades: baseUnidades };
    } catch (e) {
      console.warn('[NFPreferencias] Fallback localStorage:', e.message);
      const raw = localStorage.getItem(`nf_prefs_${tenantId}`);
      _prefs = raw ? { ...DEFAULT_PREFS, ...JSON.parse(raw) } : { ...DEFAULT_PREFS, unidades: baseUnidades };
    }
    _persistirLocal(tenantId);
    return _prefs;
  }

  // ─── Salvar preferências ──────────────────────────────────────────────────
  async function salvar(tenantId, prefs) {
    _prefs = { ..._prefs, ...prefs };
    _persistirLocal(tenantId);
    if (!window.NFConfigService?.saveConfigSection) {
      throw new Error('NFConfigService indisponível para salvar preferências.');
    }
    await window.NFConfigService.saveConfigSection(tenantId, 'preferencias', _prefs);
  }

  // ─── Persistir local ──────────────────────────────────────────────────────
  function _persistirLocal(tenantId) {
    try { localStorage.setItem(`nf_prefs_${tenantId}`, JSON.stringify(_prefs)); } catch (_) {}
  }

  // ─── Obter prefs do cache ─────────────────────────────────────────────────
  function getPrefs() {
    return _prefs || DEFAULT_PREFS;
  }

  // ─── Popular select de unidade com as unidades configuradas ──────────────
  function popularSelectUnidade(selectId, valorAtual = null) {
    const sel = document.getElementById(selectId);
    if (!sel) return;
    const prefs = _prefs || DEFAULT_PREFS;
    const atual = valorAtual || prefs.unidadePadrao || 'UN';
    const valorAnterior = sel.value || atual;
    sel.innerHTML = '';
    const unidades = prefs.unidades && prefs.unidades.length > 0 ? prefs.unidades : DEFAULT_PREFS.unidades;
    unidades.forEach(u => {
      const opt = document.createElement('option');
      opt.value = u;
      opt.textContent = u;
      if (u === valorAnterior) opt.selected = true;
      sel.appendChild(opt);
    });
    // Opção "Outra..." para digitação livre
    const outra = document.createElement('option');
    outra.value = '__outra__';
    outra.textContent = '— Outra...';
    sel.appendChild(outra);
  }

  // ─── Aplicar configurações no formulário de emissão ───────────────────────
  function aplicarNaFormulario() {
    const prefs = _prefs || DEFAULT_PREFS;
    // 1. Campo quantidade (seção Manual) — ajustar step e title
    const qtdEl = document.getElementById('itemQuantidade');
    if (qtdEl) {
      const casas = prefs.casasDecimaisQtd ?? 3;
      const step = casas === 0 ? '1' : '0.' + '0'.repeat(casas - 1) + '1';
      qtdEl.step = step;
      qtdEl.title = `${casas} casa${casas !== 1 ? 's' : ''} decimal${casas !== 1 ? 'is' : ''}`;
      qtdEl.placeholder = casas === 0 ? '1' : (casas === 2 ? '1,00' : '1,000');
    }
    // 1b. Campo quantidade (seção Cadastrado) — mesma config
    const qtdCadEl = document.getElementById('itemQuantidadeCad');
    if (qtdCadEl) {
      const casas = prefs.casasDecimaisQtd ?? 3;
      const step = casas === 0 ? '1' : '0.' + '0'.repeat(casas - 1) + '1';
      qtdCadEl.step = step;
      qtdCadEl.title = qtdEl?.title || '';
      qtdCadEl.placeholder = qtdEl?.placeholder || '1';
    }
    // 2. Campo unidade (seção Manual) — converter de input para select ou popular select existente
    popularSelectUnidade('itemUN');
    // 2b. Campo unidade (seção Cadastrado)
    popularSelectUnidade('itemUNCad');
    // 3. Registrar listener "Outra..." para abrir input temporário (seção Manual)
    const unSel = document.getElementById('itemUN');
    if (unSel && !unSel._nfPrefBound) {
      unSel._nfPrefBound = true;
      unSel.addEventListener('change', function() {
        if (this.value === '__outra__') {
          const val = (prompt('Digite a unidade de medida:') || '').trim().toUpperCase();
          if (val) {
            const existing = Array.from(this.options).find(o => o.value === val);
            if (!existing) {
              const opt = document.createElement('option');
              opt.value = val; opt.textContent = val;
              this.insertBefore(opt, this.lastElementChild);
            }
            this.value = val;
          } else {
            this.value = prefs.unidadePadrao || 'UN';
          }
        }
      });
    }
    // 3b. Listener "Outra..." para seção Cadastrado
    const unCadSel = document.getElementById('itemUNCad');
    if (unCadSel && !unCadSel._nfPrefBound) {
      unCadSel._nfPrefBound = true;
      unCadSel.addEventListener('change', function() {
        if (this.value === '__outra__') {
          const val = (prompt('Digite a unidade de medida:') || '').trim().toUpperCase();
          if (val) {
            const existing = Array.from(this.options).find(o => o.value === val);
            if (!existing) {
              const opt = document.createElement('option');
              opt.value = val; opt.textContent = val;
              this.insertBefore(opt, this.lastElementChild);
            }
            this.value = val;
          } else {
            this.value = prefs.unidadePadrao || 'UN';
          }
        }
      });
    }

    // 4. Defaults genéricos de transporte/volumes
    const transpPadrao = prefs.transportePadrao || {};
    const modFrete = document.getElementById('nfModFrete');
    if (modFrete && String(modFrete.value || '9') === '9' && transpPadrao.modFrete != null) {
      modFrete.value = String(transpPadrao.modFrete);
    }
    const especie = document.getElementById('nfVolEspecie');
    if (especie && !especie.value && transpPadrao.especie) especie.value = transpPadrao.especie;
    const marca = document.getElementById('nfVolMarca');
    if (marca && !marca.value && transpPadrao.marca) marca.value = transpPadrao.marca;
    window.atualizarEstadoTransporteNF?.();
  }

  // ─── Renderizar painel de config na aba Configuração ─────────────────────
  function renderizarPainelConfig(containerId) {
    const container = document.getElementById(containerId);
    if (!container) return;
    const prefs = _prefs || DEFAULT_PREFS;
    const escAttr = (v) => String(v || '').replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
    container.innerHTML = `
      <div style="margin-bottom:14px;">
        <label style="font-weight:600;font-size:13px;color:#2c3e50;display:block;margin-bottom:6px;">
          Casas Decimais do Campo Qtd:
        </label>
        <select id="prefCasasDecimais" style="padding:8px;border:1px solid #ddd;border-radius:4px;font-size:14px;">
          <option value="0" ${prefs.casasDecimaisQtd===0?'selected':''}>0 — Somente inteiros (ex: 5)</option>
          <option value="2" ${prefs.casasDecimaisQtd===2?'selected':''}>2 — Ex: 5,00</option>
          <option value="3" ${prefs.casasDecimaisQtd===3?'selected':''}>3 — Ex: 5,000</option>
          <option value="4" ${prefs.casasDecimaisQtd===4?'selected':''}>4 — Ex: 5,0000</option>
        </select>
      </div>
      <div style="margin-bottom:14px;">
        <label style="font-weight:600;font-size:13px;color:#2c3e50;display:block;margin-bottom:6px;">
          Unidade Padrão da Empresa:
        </label>
        <select id="prefUnidadePadrao" style="padding:8px;border:1px solid #ddd;border-radius:4px;font-size:14px;">
          ${(prefs.unidades || DEFAULT_PREFS.unidades).map(u => `<option value="${u}" ${u===prefs.unidadePadrao?'selected':''}>${u}</option>`).join('')}
        </select>
      </div>
      <div style="margin-bottom:14px;">
        <label style="font-weight:600;font-size:13px;color:#2c3e50;display:block;margin-bottom:6px;">
          Unidades de Medida Disponíveis: <span style="font-weight:normal;font-size:12px;">(uma por linha)</span>
        </label>
        <textarea id="prefUnidades" rows="5" style="width:100%;padding:8px;border:1px solid #ddd;border-radius:4px;font-size:13px;box-sizing:border-box;font-family:monospace;">${(prefs.unidades || DEFAULT_PREFS.unidades).join('\n')}</textarea>
      </div>
      <div style="border-top:1px solid #e5e7eb;padding-top:14px;margin-top:14px;margin-bottom:14px;">
        <h4 style="margin:0 0 10px;font-size:14px;color:#2c3e50;">Transporte padrão</h4>
        <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(180px,1fr));gap:12px;">
          <div>
            <label for="prefModFretePadrao" style="font-weight:600;font-size:13px;color:#2c3e50;display:block;margin-bottom:6px;">Modalidade padrão:</label>
            <select id="prefModFretePadrao" style="width:100%;padding:8px;border:1px solid #ddd;border-radius:4px;font-size:14px;">
              <option value="9" ${String(prefs.transportePadrao?.modFrete ?? 9)==='9'?'selected':''}>9 - Sem transporte</option>
              <option value="0" ${String(prefs.transportePadrao?.modFrete)==='0'?'selected':''}>0 - CIF (Emitente)</option>
              <option value="1" ${String(prefs.transportePadrao?.modFrete)==='1'?'selected':''}>1 - FOB (Destinatário)</option>
              <option value="2" ${String(prefs.transportePadrao?.modFrete)==='2'?'selected':''}>2 - Terceiros</option>
              <option value="3" ${String(prefs.transportePadrao?.modFrete)==='3'?'selected':''}>3 - Próprio emitente</option>
              <option value="4" ${String(prefs.transportePadrao?.modFrete)==='4'?'selected':''}>4 - Próprio destinatário</option>
            </select>
          </div>
          <div>
            <label for="prefVolEspeciePadrao" style="font-weight:600;font-size:13px;color:#2c3e50;display:block;margin-bottom:6px;">Espécie padrão:</label>
            <input id="prefVolEspeciePadrao" type="text" maxlength="60" value="${escAttr(prefs.transportePadrao?.especie)}" placeholder="Ex.: caixa, fardo, outro" style="width:100%;padding:8px;border:1px solid #ddd;border-radius:4px;font-size:14px;box-sizing:border-box;">
          </div>
          <div>
            <label for="prefVolMarcaPadrao" style="font-weight:600;font-size:13px;color:#2c3e50;display:block;margin-bottom:6px;">Marca padrão:</label>
            <input id="prefVolMarcaPadrao" type="text" maxlength="60" value="${escAttr(prefs.transportePadrao?.marca)}" placeholder="Marca dos volumes" style="width:100%;padding:8px;border:1px solid #ddd;border-radius:4px;font-size:14px;box-sizing:border-box;">
          </div>
        </div>
      </div>
      <button id="btnSalvarPreferencias"
        style="padding:9px 20px;border:none;border-radius:4px;background:#27ae60;color:#fff;cursor:pointer;font-size:14px;font-weight:600;">
        <i class="fas fa-save"></i> Salvar Preferências
      </button>`;
    document.getElementById('btnSalvarPreferencias')?.addEventListener('click', async () => {
      const novasUnidades = (document.getElementById('prefUnidades')?.value || '')
        .split('\n').map(u => u.trim().toUpperCase()).filter(Boolean);
      const prefs = {
        casasDecimaisQtd: parseInt(document.getElementById('prefCasasDecimais')?.value) || 3,
        unidadePadrao: document.getElementById('prefUnidadePadrao')?.value || 'UN',
        unidades: novasUnidades.length > 0 ? novasUnidades : DEFAULT_PREFS.unidades,
        transportePadrao: {
          modFrete: parseInt(document.getElementById('prefModFretePadrao')?.value ?? '9', 10),
          especie: (document.getElementById('prefVolEspeciePadrao')?.value || '').trim(),
          marca: (document.getElementById('prefVolMarcaPadrao')?.value || '').trim(),
        },
      };
      const tenantId = _tenantId || (() => { try { return JSON.parse(localStorage.getItem('company_info') || '{}').companyId || ''; } catch(_) { return ''; } })();
      try {
        await salvar(tenantId, prefs);
        aplicarNaFormulario();
        alert('✅ Preferências salvas!');
      } catch (e) {
        alert('Erro ao salvar preferências: ' + e.message);
      }
    });
  }

  // ─── API pública ──────────────────────────────────────────────────────────
  return { carregar, salvar, getPrefs, popularSelectUnidade, aplicarNaFormulario, renderizarPainelConfig };
})();

window.NFPreferencias = NFPreferencias;
