/**
 * nf-danfe.js — Gerador de DANFE (Documento Auxiliar da NF-e) em PDF
 * Usa jsPDF (carregado externamente) para gerar PDF diretamente no browser
 * Suporte: NF-e Mod.55 | NFC-e Mod.65 (com QR Code)
 * Sisweb — NF-e Sistema Multi-Tenant
 *
 * DEPENDÊNCIAS (adicionar ao notas-fiscais.html antes deste script):
 *   <script src="https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js"></script>
 *   <script src="https://cdnjs.cloudflare.com/ajax/libs/qrcodejs/1.0.0/qrcode.min.js"></script>
 */

const NFDanfe = (() => {
  'use strict';

  // ─── Cores e fontes padrão ────────────────────────────────────────────────
  const COR_PRIMARIA  = [44, 62, 80];    // #2c3e50
  const COR_CINZA     = [120, 120, 120];
  const COR_CINZA_CLR = [220, 220, 220];
  const COR_PRETO     = [0, 0, 0];

  // ─── Formatar data e hora ─────────────────────────────────────────────────
  function fmtDt(iso) {
    if (!iso) return '';
    try {
      const d = new Date(iso);
      return d.toLocaleDateString('pt-BR') + ' ' + d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
    } catch (_) { return iso.slice(0, 10); }
  }

  // ─── Gerar QR Code como Data URL (canvas) ────────────────────────────────
  async function gerarQRCodeDataURL(texto, size = 80) {
    return new Promise((resolve) => {
      try {
        const container = document.createElement('div');
        container.style.cssText = 'position:absolute;left:-9999px;top:-9999px;';
        document.body.appendChild(container);
        // Usar QRCode.js se disponível
        if (window.QRCode) {
          const qr = new window.QRCode(container, {
            text: texto, width: size, height: size,
            colorDark: '#000000', colorLight: '#ffffff',
            correctLevel: window.QRCode.CorrectLevel.M,
          });
          setTimeout(() => {
            const img = container.querySelector('img') || container.querySelector('canvas');
            const dataUrl = img ? (img.src || img.toDataURL('image/png')) : null;
            document.body.removeChild(container);
            resolve(dataUrl);
          }, 200);
        } else {
          // Fallback: tentar via API pública
          document.body.removeChild(container);
          resolve(`https://api.qrserver.com/v1/create-qr-code/?size=${size}x${size}&data=${encodeURIComponent(texto)}`);
        }
      } catch (_) { resolve(null); }
    });
  }

  // ─── URL de consulta da NFC-e (SEFAZ) ────────────────────────────────────
  function buildQRCodeUrl(nfeData) {
    const chave = nfeData.chave || '';
    const tpAmb = nfeData.ide?.tpAmb || 2;
    // URL padrão SEFAZ para consulta NFC-e (SVC-AN)
    if (tpAmb == 1) {
      return `https://www.nfe.fazenda.gov.br/portal/consultaRecaptcha.aspx?tipoConsulta=completa&nfe=${chave}`;
    }
    return `https://www.homologacao.nfe.fazenda.gov.br/portal/consultaRecaptcha.aspx?tipoConsulta=completa&nfe=${chave}`;
  }

  function fmtDtCurta(iso) {
    if (!iso) return '';
    const raw = String(iso);
    const dateOnly = raw.match(/^(\d{4})-(\d{2})-(\d{2})/);
    if (dateOnly) return `${dateOnly[3]}/${dateOnly[2]}/${dateOnly[1]}`;
    try { return new Date(iso).toLocaleDateString('pt-BR'); }
    catch (_) { return iso.slice(0, 10); }
  }

  function parseFiscalNumber(v) {
    if (typeof v === 'number') return Number.isFinite(v) ? v : 0;
    const raw = String(v || '').trim();
    if (!raw) return 0;
    if (raw.includes(',')) return parseFloat(raw.replace(/[^\d,.-]/g, '').replace(/\./g, '').replace(',', '.')) || 0;
    return parseFloat(raw.replace(/[^\d.-]/g, '')) || 0;
  }

  function fmtMoeda(v) {
    return 'R$ ' + parseFiscalNumber(v).toLocaleString('pt-BR', { minimumFractionDigits: 2 });
  }

  function fmtNum(v, dec = 3) {
    return parseFiscalNumber(v).toLocaleString('pt-BR', { minimumFractionDigits: dec, maximumFractionDigits: dec });
  }

  function fmtCNPJ(v) {
    const n = String(v || '').replace(/\D/g, '').padStart(14, '0');
    return n.replace(/^(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})$/, '$1.$2.$3/$4-$5');
  }

  function fmtCPF(v) {
    const n = String(v || '').replace(/\D/g, '').padStart(11, '0');
    return n.replace(/^(\d{3})(\d{3})(\d{3})(\d{2})$/, '$1.$2.$3-$4');
  }

  function fmtDoc(v) {
    const n = String(v || '').replace(/\D/g, '');
    if (n.length === 14) return fmtCNPJ(n);
    if (n.length === 11) return fmtCPF(n);
    return String(v || '');
  }

  function cleanCode(v) {
    return String(v || '').replace(/[^A-Za-z0-9]/g, '').toUpperCase();
  }

  function fmtCEP(v) {
    const n = String(v || '').replace(/\D/g, '').padStart(8, '0');
    return n.replace(/^(\d{5})(\d{3})$/, '$1-$2');
  }

  // ─── Caixa com label + valor ───────────────────────────────────────────────
  function drawBox(doc, x, y, w, h) {
    doc.setDrawColor(...COR_CINZA_CLR);
    doc.rect(x, y, w, h, 'S');
  }

  function labelVal(doc, x, y, w, label, value, fontSize = 7) {
    drawBox(doc, x, y, w, 10);
    doc.setFontSize(6);
    doc.setTextColor(...COR_CINZA);
    doc.text(label, x + 1, y + 3.5);
    doc.setFontSize(fontSize);
    doc.setTextColor(...COR_PRETO);
    doc.text(String(value || ''), x + 1, y + 8.5, { maxWidth: w - 2 });
  }

  function splitTextForWidth(doc, value, width) {
    const text = String(value || '');
    if (!text) return [''];
    if (typeof doc.splitTextToSize === 'function') {
      const lines = doc.splitTextToSize(text, width);
      return Array.isArray(lines) && lines.length ? lines.map(String) : [text];
    }
    const approxChars = Math.max(8, Math.floor(width * 1.8));
    const words = text.split(/\s+/);
    const lines = [];
    let current = '';
    words.forEach((word) => {
      const candidate = current ? `${current} ${word}` : word;
      if (candidate.length > approxChars && current) {
        lines.push(current);
        current = word;
      } else {
        current = candidate;
      }
    });
    if (current) lines.push(current);
    return lines.length ? lines : [''];
  }

  function localName(node) {
    return String(node?.localName || node?.nodeName || '').replace(/^.*:/, '');
  }

  function directChildren(node, name = '') {
    return Array.from(node?.children || []).filter((child) => !name || localName(child) === name);
  }

  function directChild(node, name) {
    return directChildren(node, name)[0] || null;
  }

  function firstDesc(node, name) {
    if (!node) return null;
    const all = node.getElementsByTagName ? Array.from(node.getElementsByTagName('*')) : [];
    return all.find((child) => localName(child) === name) || null;
  }

  function childText(node, name) {
    return (directChild(node, name)?.textContent || '').trim();
  }

  function firstText(node, name) {
    return (directChild(node, name)?.textContent || firstDesc(node, name)?.textContent || '').trim();
  }

  function onlyFilledObject(obj) {
    const out = {};
    Object.entries(obj || {}).forEach(([key, value]) => {
      if (value !== '' && value != null) out[key] = value;
    });
    return out;
  }

  function enderecoFromXml(node, tagName) {
    const end = directChild(node, tagName);
    if (!end) return {};
    return onlyFilledObject({
      logradouro: childText(end, 'xLgr'),
      numero: childText(end, 'nro'),
      complemento: childText(end, 'xCpl'),
      bairro: childText(end, 'xBairro'),
      codigoMunicipio: childText(end, 'cMun'),
      municipio: childText(end, 'xMun'),
      uf: childText(end, 'UF'),
      cep: childText(end, 'CEP'),
      fone: childText(end, 'fone'),
    });
  }

  function getXmlSource(nfeData) {
    if (typeof nfeData === 'string') return nfeData;
    if (!nfeData || typeof nfeData !== 'object') return '';
    return nfeData.xmlAutorizado || nfeData.xmlProc || nfeData.xmlNFe || nfeData.xml || nfeData.conteudoXml || '';
  }

  function pickDanfeAssetFields(source = {}) {
    const out = {};
    [
      'logoDataUrl',
      'logoDataURL',
      'logoUrl',
      'logoURL',
      'logo',
      'logoStoragePath',
      'logoPath',
    ].forEach((key) => {
      const value = source[key];
      if (value !== '' && value != null) out[key] = value;
    });
    return out;
  }

  function parseNFeXmlToDanfeData(xmlString) {
    const xml = String(xmlString || '').trim();
    if (!xml || typeof DOMParser === 'undefined') return null;
    try {
      const docXml = new DOMParser().parseFromString(xml, 'application/xml');
      if (firstDesc(docXml, 'parsererror')) return null;

      const infNFe = firstDesc(docXml, 'infNFe');
      if (!infNFe) return null;
      const ideNode = directChild(infNFe, 'ide') || firstDesc(docXml, 'ide');
      const emitNode = directChild(infNFe, 'emit') || firstDesc(docXml, 'emit');
      const destNode = directChild(infNFe, 'dest') || firstDesc(docXml, 'dest');
      const totalNode = firstDesc(infNFe, 'ICMSTot');
      const transpNode = directChild(infNFe, 'transp');
      const pagNode = directChild(infNFe, 'pag');
      const cobrNode = directChild(infNFe, 'cobr');
      const infProt = firstDesc(docXml, 'infProt');
      const chave = firstText(infProt, 'chNFe') || (infNFe.getAttribute('Id') || '').replace(/^NFe/, '');

      const det = directChildren(infNFe, 'det').map((detNode, idx) => {
        const prod = directChild(detNode, 'prod') || detNode;
        const imposto = directChild(detNode, 'imposto');
        const icms = directChild(imposto, 'ICMS');
        const icmsDetalhe = directChildren(icms)[0] || icms || imposto;
        const ipi = directChild(imposto, 'IPI');
        const ipiDetalhe = directChild(ipi, 'IPITrib') || directChild(ipi, 'IPINT') || ipi;
        return onlyFilledObject({
          nItem: detNode.getAttribute('nItem') || String(idx + 1),
          cProd: childText(prod, 'cProd'),
          xProd: childText(prod, 'xProd'),
          ncm: childText(prod, 'NCM'),
          cst: childText(icmsDetalhe, 'CST') || childText(icmsDetalhe, 'CSOSN'),
          cfop: childText(prod, 'CFOP'),
          uCom: childText(prod, 'uCom'),
          qCom: childText(prod, 'qCom'),
          vUnCom: childText(prod, 'vUnCom'),
          vProd: childText(prod, 'vProd'),
          vBC: childText(icmsDetalhe, 'vBC'),
          vICMS: childText(icmsDetalhe, 'vICMS'),
          pICMS: childText(icmsDetalhe, 'pICMS'),
          vIPI: childText(ipiDetalhe, 'vIPI'),
          pIPI: childText(ipiDetalhe, 'pIPI'),
        });
      });

      const volumes = directChildren(transpNode, 'vol').map((volNode) => {
        const lacres = directChildren(volNode, 'lacres')
          .map((lac) => childText(lac, 'nLacre'))
          .filter(Boolean);
        const vol = onlyFilledObject({
          qVol: childText(volNode, 'qVol'),
          esp: childText(volNode, 'esp'),
          marca: childText(volNode, 'marca'),
          nVol: childText(volNode, 'nVol'),
          pesoL: childText(volNode, 'pesoL'),
          pesoB: childText(volNode, 'pesoB'),
        });
        if (lacres.length) vol.lacres = lacres;
        return vol;
      }).filter((vol) => Object.keys(vol).length);

      const transportaNode = directChild(transpNode, 'transporta');
      const veicNode = directChild(transpNode, 'veicTransp');
      const transp = onlyFilledObject({ modFrete: childText(transpNode, 'modFrete') || '9' });
      if (transportaNode) {
        transp.transporta = onlyFilledObject({
          CNPJ: childText(transportaNode, 'CNPJ'),
          CPF: childText(transportaNode, 'CPF'),
          xNome: childText(transportaNode, 'xNome'),
          IE: childText(transportaNode, 'IE'),
          xEnder: childText(transportaNode, 'xEnder'),
          xMun: childText(transportaNode, 'xMun'),
          UF: childText(transportaNode, 'UF'),
        });
      }
      if (veicNode) {
        transp.veicTransp = onlyFilledObject({
          placa: childText(veicNode, 'placa'),
          UF: childText(veicNode, 'UF'),
          RNTC: childText(veicNode, 'RNTC'),
        });
      }
      if (volumes.length) transp.vol = volumes;

      const pag = directChildren(pagNode, 'detPag').map((detPag) => onlyFilledObject({
        tPag: childText(detPag, 'tPag'),
        vPag: childText(detPag, 'vPag'),
      })).filter((detPag) => Object.keys(detPag).length);
      const cobr = onlyFilledObject({
        fat: onlyFilledObject({
          nFat: childText(directChild(cobrNode, 'fat'), 'nFat'),
          vOrig: childText(directChild(cobrNode, 'fat'), 'vOrig'),
          vDesc: childText(directChild(cobrNode, 'fat'), 'vDesc'),
          vLiq: childText(directChild(cobrNode, 'fat'), 'vLiq'),
        }),
        dup: directChildren(cobrNode, 'dup').map((dupNode) => onlyFilledObject({
          nDup: childText(dupNode, 'nDup'),
          dVenc: childText(dupNode, 'dVenc'),
          vDup: childText(dupNode, 'vDup'),
        })).filter((dup) => Object.keys(dup).length),
      });

      return {
        modelo: parseInt(childText(ideNode, 'mod'), 10) || 55,
        numero: childText(ideNode, 'nNF'),
        chave,
        nProt: firstText(infProt, 'nProt'),
        dhAutorizacao: firstText(infProt, 'dhRecbto'),
        status: firstText(infProt, 'nProt') ? 'autorizada' : 'rascunho',
        ide: onlyFilledObject({
          mod: childText(ideNode, 'mod'),
          serie: childText(ideNode, 'serie'),
          nNF: childText(ideNode, 'nNF'),
          dhEmi: childText(ideNode, 'dhEmi'),
          tpNF: childText(ideNode, 'tpNF'),
          tpAmb: childText(ideNode, 'tpAmb'),
          natOp: childText(ideNode, 'natOp'),
        }),
        emit: onlyFilledObject({
          cnpj: childText(emitNode, 'CNPJ'),
          cpf: childText(emitNode, 'CPF'),
          razaoSocial: childText(emitNode, 'xNome'),
          nomeFantasia: childText(emitNode, 'xFant'),
          ie: childText(emitNode, 'IE'),
          crt: childText(emitNode, 'CRT'),
          endereco: enderecoFromXml(emitNode, 'enderEmit'),
        }),
        dest: onlyFilledObject({
          cnpj: childText(destNode, 'CNPJ'),
          cpf: childText(destNode, 'CPF'),
          nome: childText(destNode, 'xNome'),
          ie: childText(destNode, 'IE'),
          endereco: enderecoFromXml(destNode, 'enderDest'),
        }),
        det,
        total: onlyFilledObject({
          vProd: childText(totalNode, 'vProd'),
          vBC: childText(totalNode, 'vBC'),
          vICMS: childText(totalNode, 'vICMS'),
          vBCST: childText(totalNode, 'vBCST'),
          vST: childText(totalNode, 'vST'),
          vIPI: childText(totalNode, 'vIPI'),
          vPIS: childText(totalNode, 'vPIS'),
          vCOFINS: childText(totalNode, 'vCOFINS'),
          vDesc: childText(totalNode, 'vDesc'),
          vFrete: childText(totalNode, 'vFrete'),
          vSeg: childText(totalNode, 'vSeg'),
          vOutro: childText(totalNode, 'vOutro'),
          vNF: childText(totalNode, 'vNF'),
        }),
        transp,
        pag,
        cobr,
        infAdic: firstText(infNFe, 'infCpl'),
      };
    } catch (_) {
      return null;
    }
  }

  function normalizarNFeParaDANFE(nfeData) {
    const original = typeof nfeData === 'object' && nfeData ? nfeData : {};
    const xml = getXmlSource(nfeData);
    const parsed = parseNFeXmlToDanfeData(xml);
    if (!parsed) return nfeData;
    return {
      ...original,
      ...parsed,
      emit: {
        ...(parsed.emit || {}),
        ...pickDanfeAssetFields(original.emit || {}),
      },
      xmlAutorizado: xml || original.xmlAutorizado,
    };
  }

  const CODE128_PATTERNS = [
    '212222','222122','222221','121223','121322','131222','122213','122312','132212','221213',
    '221312','231212','112232','122132','122231','113222','123122','123221','223211','221132',
    '221231','213212','223112','312131','311222','321122','321221','312212','322112','322211',
    '212123','212321','232121','111323','131123','131321','112313','132113','132311','211313',
    '231113','231311','112133','112331','132131','113123','113321','133121','313121','211331',
    '231131','213113','213311','213131','311123','311321','331121','312113','312311','332111',
    '314111','221411','431111','111224','111422','121124','121421','141122','141221','112214',
    '112412','122114','122411','142112','142211','241211','221114','413111','241112','134111',
    '111242','121142','121241','114212','124112','124211','411212','421112','421211','212141',
    '214121','412121','111143','111341','131141','114113','114311','411113','411311','113141',
    '114131','311141','411131','211412','211214','211232','2331112',
  ];

  function buildCode128CValues(digits) {
    const clean = String(digits || '').replace(/\D/g, '');
    if (!clean || clean.length % 2 !== 0) return null;
    const START_CODE_C = 105;
    const STOP = 106;
    const values = [START_CODE_C];
    for (let i = 0; i < clean.length; i += 2) {
      values.push(parseInt(clean.slice(i, i + 2), 10));
    }
    const checksum = values.reduce((sum, value, idx) => sum + (idx === 0 ? value : value * idx), 0) % 103;
    return [...values, checksum, STOP];
  }

  function drawCode128C(doc, digits, x, y, w, h) {
    const values = buildCode128CValues(digits);
    if (!values) return false;
    const patterns = values.map((value) => CODE128_PATTERNS[value]).filter(Boolean);
    if (patterns.length !== values.length) return false;
    const totalUnits = patterns.join('').split('').reduce((sum, part) => sum + parseInt(part, 10), 0);
    const unit = w / totalUnits;
    let cursor = x;
    doc.setFillColor(...COR_PRETO);
    patterns.forEach((pattern) => {
      let black = true;
      pattern.split('').forEach((part) => {
        const barW = parseInt(part, 10) * unit;
        if (black) doc.rect(cursor, y, Math.max(barW, 0.08), h, 'F');
        cursor += barW;
        black = !black;
      });
    });
    return true;
  }

  function imageFormatFromDataUrl(dataUrl) {
    const raw = String(dataUrl || '').toLowerCase();
    if (raw.startsWith('data:image/jpeg') || raw.startsWith('data:image/jpg')) return 'JPEG';
    if (raw.startsWith('data:image/webp')) return 'WEBP';
    if (raw.startsWith('data:image/png')) return 'PNG';
    return 'PNG';
  }

  function pickDanfeLogoSource(nfeData) {
    const emit = nfeData?.emit || {};
    const raw = emit.logoDataUrl || emit.logoDataURL || emit.logoUrl || emit.logoURL || emit.logo || nfeData?.logoUrl || '';
    const value = String(raw || '').trim();
    if (!value || /^data:(?!image\/)/i.test(value)) return '';
    return value;
  }

  async function carregarLogoDANFE(nfeData) {
    const source = pickDanfeLogoSource(nfeData);
    if (!source) return '';
    if (/^data:image\//i.test(source)) return source;
    if (!/^https?:\/\//i.test(source) || typeof fetch !== 'function' || typeof FileReader === 'undefined') return '';
    try {
      const response = await fetch(source, { mode: 'cors' });
      if (!response.ok) return '';
      const blob = await response.blob();
      if (!blob || !String(blob.type || '').startsWith('image/') || blob.size > 2 * 1024 * 1024) return '';
      return await new Promise((resolve) => {
        const reader = new FileReader();
        reader.onload = () => resolve(String(reader.result || ''));
        reader.onerror = () => resolve('');
        reader.readAsDataURL(blob);
      });
    } catch (_) {
      return '';
    }
  }

  async function prepararDANFEComAssets(nfeData) {
    const logoDataUrl = await carregarLogoDANFE(nfeData);
    if (!logoDataUrl) return nfeData;
    return {
      ...nfeData,
      emit: {
        ...(nfeData?.emit || {}),
        logoDataUrl,
      },
    };
  }

  // ─── Gerar DANFE como PDF blob ─────────────────────────────────────────────
  function gerarDANFE(nfeData) {
    nfeData = normalizarNFeParaDANFE(nfeData || {}) || {};
    if (!window.jspdf && !window.jsPDF) {
      throw new Error('jsPDF não carregado. Adicione o script do jsPDF ao HTML.');
    }
    const { jsPDF } = window.jspdf || window;
    const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });

    const ide    = nfeData.ide    || {};
    const emit   = nfeData.emit   || {};
    const dest   = nfeData.dest   || {};
    const det    = nfeData.det    || [];
    const total  = nfeData.total  || {};
    const transp = nfeData.transp || {};
    const pag    = Array.isArray(nfeData.pag) ? nfeData.pag : [];
    const cobr   = nfeData.cobr || {};
    const chave  = nfeData.chave || '';
    const chaveNumerica = String(chave || '').replace(/\D/g, '');
    const chaveFormatada = chaveNumerica.replace(/(\d{4})/g, '$1 ').trim();
    const nProt  = nfeData.nProt || '';
    const status = nfeData.status || 'rascunho';
    const numeroNF = String(nfeData.numero || ide.nNF || '').padStart(9, '0');
    const serieNF = String(ide.serie || '1');

    const PW = 210;
    const ML = 10;
    const MR = 10;
    const CW = PW - ML - MR;
    const PAGE_BOTTOM = 281;
    let y = 7;

    function setFiscalStroke() {
      doc.setDrawColor(...COR_PRETO);
      if (typeof doc.setLineWidth === 'function') doc.setLineWidth(0.15);
    }

    function textFit(value, max = 120) {
      const text = String(value || '').replace(/\s+/g, ' ').trim();
      return text.length > max ? `${text.slice(0, max - 1)}…` : text;
    }

    function fmtFiscal(v, dec = 2) {
      return parseFiscalNumber(v).toLocaleString('pt-BR', {
        minimumFractionDigits: dec,
        maximumFractionDigits: dec,
      });
    }

    function fmtFiscalMaybe(v, dec = 2) {
      return v === '' || v == null ? '' : fmtFiscal(v, dec);
    }

    function fiscalBox(x, by, w, h, label, value, opts = {}) {
      const labelSize = opts.labelSize || 4.5;
      const valueSize = opts.valueSize || 6.3;
      const labelY = by + 2.7;
      const valueY = by + (opts.valueOffset || 6.1);
      setFiscalStroke();
      doc.rect(x, by, w, h, 'S');
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(labelSize);
      doc.setTextColor(...COR_PRETO);
      doc.text(String(label || ''), x + 1, labelY, { maxWidth: w - 2 });
      doc.setFont('helvetica', opts.bold ? 'bold' : 'normal');
      doc.setFontSize(valueSize);
      const lines = Array.isArray(value) ? value : splitTextForWidth(doc, value, w - 2);
      const maxLines = opts.maxLines || Math.max(1, Math.floor((h - 5.2) / 2.8));
      const align = opts.align || 'left';
      const textX = align === 'right' ? x + w - 1 : (align === 'center' ? x + w / 2 : x + 1);
      doc.text(lines.slice(0, maxLines), textX, valueY, { maxWidth: w - 2, align });
      doc.setFont('helvetica', 'normal');
    }

    function sectionHeader(title) {
      ensureSpace(5);
      doc.setFillColor(235, 235, 235);
      setFiscalStroke();
      doc.rect(ML, y, CW, 4.2, 'FD');
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(6.2);
      doc.setTextColor(...COR_PRETO);
      doc.text(title, ML + 1.5, y + 3);
      doc.setFont('helvetica', 'normal');
      y += 4.2;
    }

    function addContinuationPage() {
      doc.addPage();
      y = 9;
      setFiscalStroke();
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(7);
      doc.setTextColor(...COR_PRETO);
      doc.text('DANFE - CONTINUAÇÃO', ML, y);
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(5.8);
      doc.text(`NF-e Nº ${numeroNF}  Série ${serieNF}`, ML + CW, y, { align: 'right' });
      if (chaveFormatada) doc.text(chaveFormatada, ML + CW, y + 3.8, { align: 'right', maxWidth: 125 });
      doc.line(ML, y + 6, ML + CW, y + 6);
      y += 8.5;
    }

    function ensureSpace(needed) {
      if (y + needed > PAGE_BOTTOM) addContinuationPage();
    }

    const emitEnd = emit.endereco || {};
    const destEnd = dest.endereco || {};
    const emitDoc = emit.cnpj || emit.CNPJ || emit.cpf || emit.CPF || '';
    const destDoc = dest.cnpj || dest.CNPJ || dest.cpf || dest.CPF || '';
    const endEmit1 = textFit(`${emitEnd.logradouro || ''}, ${emitEnd.numero || ''}${emitEnd.complemento ? ` - ${emitEnd.complemento}` : ''}`, 95);
    const endEmit2 = textFit(`${emitEnd.bairro || ''} - ${emitEnd.municipio || ''}/${emitEnd.uf || ''} - CEP ${fmtCEP(emitEnd.cep)}${emitEnd.fone ? ` - Fone ${emitEnd.fone}` : ''}`, 105);
    const tpNFLabel = String(ide.tpNF) === '0' ? '0 - ENTRADA' : '1 - SAÍDA';

    // Recibo superior, como no DANFE oficial.
    setFiscalStroke();
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(4.7);
    doc.text(`RECEBEMOS DE ${String(emit.razaoSocial || 'EMITENTE').toUpperCase()} OS PRODUTOS E/OU SERVIÇOS CONSTANTES DA NOTA FISCAL ELETRÔNICA INDICADA AO LADO`, ML + 1, y + 2.6, { maxWidth: CW - 31 });
    doc.rect(ML, y, CW - 27, 12, 'S');
    doc.line(ML + 55, y + 6, ML + CW - 27, y + 6);
    doc.text('Data de recebimento', ML + 1, y + 8.6);
    doc.text('Identificação e assinatura do recebedor', ML + 57, y + 8.6);
    doc.rect(ML + CW - 27, y, 27, 12, 'S');
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(5.8);
    doc.text('NF-e', ML + CW - 13.5, y + 3.4, { align: 'center' });
    doc.text(`Nº ${numeroNF}`, ML + CW - 13.5, y + 7, { align: 'center' });
    doc.text(`Série ${serieNF}`, ML + CW - 13.5, y + 10.2, { align: 'center' });
    y += 15;
    if (typeof doc.setLineDashPattern === 'function') doc.setLineDashPattern([1.2, 1.2], 0);
    doc.line(ML, y, ML + CW, y);
    if (typeof doc.setLineDashPattern === 'function') doc.setLineDashPattern([], 0);
    y += 3;

    if (ide.tpAmb == 2) {
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(6.2);
      doc.setTextColor(170, 0, 0);
      doc.text('EMITIDA EM AMBIENTE DE HOMOLOGAÇÃO - SEM VALOR FISCAL', PW / 2, y, { align: 'center' });
      doc.setTextColor(...COR_PRETO);
      y += 3.5;
    }

    // Cabeçalho fiscal compacto: emitente, DANFE e controle do fisco.
    const headerH = 39;
    const emitW = 80;
    const danfeW = 45;
    const fiscoW = CW - emitW - danfeW;
    setFiscalStroke();
    doc.rect(ML, y, emitW, headerH, 'S');
    doc.rect(ML + emitW, y, danfeW, headerH, 'S');
    doc.rect(ML + emitW + danfeW, y, fiscoW, headerH, 'S');

    const logoDataUrl = String(emit.logoDataUrl || emit.logoDataURL || '').trim();
    const hasLogo = /^data:image\//i.test(logoDataUrl) && typeof doc.addImage === 'function';
    if (hasLogo) {
      try {
        doc.addImage(logoDataUrl, imageFormatFromDataUrl(logoDataUrl), ML + 3.5, y + 5.5, 22, 18, undefined, 'FAST');
      } catch (_) {}
    }
    const emitTextCenterX = hasLogo ? ML + 25 + (emitW - 25) / 2 : ML + emitW / 2;
    const emitTextMaxW = hasLogo ? emitW - 29 : emitW - 4;

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(7.4);
    doc.text(textFit(String(emit.razaoSocial || 'EMITENTE').toUpperCase(), 55), emitTextCenterX, y + 7, { align: 'center', maxWidth: emitTextMaxW });
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(5.4);
    doc.text(`CNPJ: ${fmtDoc(emitDoc)}${emit.ie ? `   IE: ${emit.ie}` : ''}`, emitTextCenterX, y + 13, { align: 'center', maxWidth: emitTextMaxW });
    doc.text(endEmit1, emitTextCenterX, y + 17.8, { align: 'center', maxWidth: emitTextMaxW });
    doc.text(endEmit2, emitTextCenterX, y + 22.4, { align: 'center', maxWidth: emitTextMaxW });
    if (emit.nomeFantasia) doc.text(textFit(emit.nomeFantasia, 65), emitTextCenterX, y + 27, { align: 'center', maxWidth: emitTextMaxW });

    const danfeX = ML + emitW;
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(9.2);
    doc.text('DANFE', danfeX + danfeW / 2, y + 6, { align: 'center' });
    doc.setFontSize(5.2);
    doc.setFont('helvetica', 'normal');
    doc.text('Documento Auxiliar da', danfeX + danfeW / 2, y + 10.5, { align: 'center' });
    doc.text('Nota Fiscal Eletrônica', danfeX + danfeW / 2, y + 14.2, { align: 'center' });
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(7.2);
    doc.text(tpNFLabel, danfeX + danfeW / 2, y + 20.4, { align: 'center' });
    doc.setFontSize(6.8);
    doc.text(`Nº ${numeroNF}`, danfeX + danfeW / 2, y + 26.5, { align: 'center' });
    doc.text(`SÉRIE ${serieNF}`, danfeX + danfeW / 2, y + 31.2, { align: 'center' });
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(5.2);
    doc.text('Página 1', danfeX + danfeW / 2, y + 35.4, { align: 'center' });

    const fiscoX = ML + emitW + danfeW;
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(4.8);
    doc.text('CONTROLE DO FISCO', fiscoX + 1.2, y + 3.2);
    if (chaveNumerica.length === 44) {
      drawCode128C(doc, chaveNumerica, fiscoX + 4, y + 5, fiscoW - 8, 9);
    }
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(4.8);
    doc.text('CHAVE DE ACESSO', fiscoX + 1.2, y + 18);
    doc.setFont('courier', 'normal');
    doc.setFontSize(5.5);
    doc.text(chaveFormatada || 'Chave ainda não gerada', fiscoX + fiscoW / 2, y + 22.2, { align: 'center', maxWidth: fiscoW - 3 });
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(4.6);
    doc.text('Consulta de autenticidade no portal nacional da NF-e', fiscoX + 1.2, y + 28.2, { maxWidth: fiscoW - 2 });
    doc.text('www.nfe.fazenda.gov.br/portal', fiscoX + 1.2, y + 32.1, { maxWidth: fiscoW - 2 });
    doc.text('ou no site da Sefaz autorizadora', fiscoX + 1.2, y + 36, { maxWidth: fiscoW - 2 });
    y += headerH + 2;

    fiscalBox(ML, y, 82, 9, 'NATUREZA DA OPERAÇÃO', ide.natOp || '');
    fiscalBox(ML + 82, y, 68, 9, 'PROTOCOLO DE AUTORIZAÇÃO DE USO', nProt || (status === 'rascunho' ? 'RASCUNHO - NÃO AUTORIZADA' : status.toUpperCase()), { valueSize: 5.8, maxLines: 1 });
    fiscalBox(ML + 150, y, 40, 9, 'INSCRIÇÃO ESTADUAL', emit.ie || emit.IE || '');
    y += 9;
    fiscalBox(ML, y, 45, 8, 'INSCRIÇÃO ESTADUAL DO SUBST. TRIB.', emit.ieST || emit.IEST || '');
    fiscalBox(ML + 45, y, 45, 8, 'CNPJ', fmtDoc(emitDoc));
    fiscalBox(ML + 90, y, 46, 8, 'DATA DE EMISSÃO', fmtDtCurta(ide.dhEmi));
    fiscalBox(ML + 136, y, 27, 8, 'MODELO', ide.mod || '55');
    fiscalBox(ML + 163, y, 27, 8, 'SÉRIE', serieNF);
    y += 10;

    sectionHeader('DESTINATÁRIO / REMETENTE');
    fiscalBox(ML, y, 82, 8, 'NOME / RAZÃO SOCIAL', dest.nome || '', { valueSize: 5.8, maxLines: 1 });
    fiscalBox(ML + 82, y, 34, 8, 'CNPJ / CPF', fmtDoc(destDoc));
    fiscalBox(ML + 116, y, 37, 8, 'INSCRIÇÃO ESTADUAL', dest.ie || dest.IE || '');
    fiscalBox(ML + 153, y, 37, 8, 'DATA EMISSÃO', fmtDtCurta(ide.dhEmi));
    y += 8;
    fiscalBox(ML, y, 76, 8, 'ENDEREÇO', `${destEnd.logradouro || ''}, ${destEnd.numero || ''}`, { valueSize: 5.6, maxLines: 1 });
    fiscalBox(ML + 76, y, 35, 8, 'BAIRRO', destEnd.bairro || '');
    fiscalBox(ML + 111, y, 28, 8, 'CEP', fmtCEP(destEnd.cep));
    fiscalBox(ML + 139, y, 36, 8, 'MUNICÍPIO', destEnd.municipio || '', { valueSize: 5.6, maxLines: 1 });
    fiscalBox(ML + 175, y, 15, 8, 'UF', destEnd.uf || '');
    y += 10;

    sectionHeader('FATURAS');
    const duplicatas = Array.isArray(cobr.dup) ? cobr.dup : [];
    const fat = cobr.fat || {};
    const faturaSlots = duplicatas.length
      ? duplicatas.slice(0, 4)
      : (fat.nFat ? [{ nDup: fat.nFat, dVenc: '', vDup: fat.vLiq || fat.vOrig }] : []);
    while (faturaSlots.length < 4) faturaSlots.push({});
    const slotW = CW / 4;
    const subW = [slotW * 0.30, slotW * 0.35, slotW * 0.35];
    setFiscalStroke();
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(4.6);
    doc.setTextColor(...COR_PRETO);
    faturaSlots.forEach((dup, idx) => {
      let fx = ML + idx * slotW;
      const values = [dup.nDup || '', fmtDtCurta(dup.dVenc), fmtFiscalMaybe(dup.vDup)];
      ['Número', 'Vencimento', 'Valor'].forEach((label, colIdx) => {
        doc.rect(fx, y, subW[colIdx], 8, 'S');
        doc.text(label, fx + 0.8, y + 2.5, { maxWidth: subW[colIdx] - 1.2 });
        doc.setFontSize(5);
        doc.text(values[colIdx], colIdx === 0 ? fx + 0.8 : fx + subW[colIdx] - 0.8, y + 6.3, { align: colIdx === 0 ? 'left' : 'right', maxWidth: subW[colIdx] - 1.2 });
        doc.setFontSize(4.6);
        fx += subW[colIdx];
      });
    });
    y += 10;

    sectionHeader('CÁLCULO DO IMPOSTO');
    const tot = total.ICMSTot || total || {};
    const calc1 = [
      ['BASE DE CÁLCULO DO ICMS', fmtFiscal(tot.vBC)],
      ['VALOR DO ICMS', fmtFiscal(tot.vICMS)],
      ['BASE DE CÁLCULO DO ICMS ST', fmtFiscal(tot.vBCST)],
      ['VALOR DO ICMS ST', fmtFiscal(tot.vST)],
      ['VALOR TOTAL DOS PRODUTOS', fmtFiscal(tot.vProd)],
    ];
    const calc2 = [
      ['VALOR DO FRETE', fmtFiscal(tot.vFrete)],
      ['VALOR DO SEGURO', fmtFiscal(tot.vSeg)],
      ['DESCONTO', fmtFiscal(tot.vDesc)],
      ['OUTRAS DESPESAS ACESSÓRIAS', fmtFiscal(tot.vOutro)],
      ['VALOR DO IPI', fmtFiscal(tot.vIPI)],
      ['VALOR TOTAL DA NOTA', fmtFiscal(tot.vNF || nfeData.valorTotal)],
    ];
    let bx = ML;
    calc1.forEach(([label, value]) => {
      fiscalBox(bx, y, CW / calc1.length, 8, label, value, { align: 'right', valueSize: 5.8 });
      bx += CW / calc1.length;
    });
    y += 8;
    bx = ML;
    calc2.forEach(([label, value]) => {
      fiscalBox(bx, y, CW / calc2.length, 8, label, value, { align: 'right', valueSize: 5.8 });
      bx += CW / calc2.length;
    });
    y += 10;

    sectionHeader('TRANSPORTADOR / VOLUMES TRANSPORTADOS');
    const freteModo = {
      0: '0 - Por conta do emitente',
      1: '1 - Por conta do destinatário',
      2: '2 - Por conta de terceiros',
      3: '3 - Próprio por conta do remetente',
      4: '4 - Próprio por conta do destinatário',
      9: '9 - Sem ocorrência de transporte',
    };
    const transporta = transp.transporta || {};
    const veic = transp.veicTransp || {};
    const vols = Array.isArray(transp.vol) ? transp.vol.filter(Boolean) : (transp.vol ? [transp.vol] : []);
    const vol = vols[0] || {};
    const totalQVol = vols.reduce((s, item) => s + (parseInt(String(item.qVol || '').replace(/\D/g, ''), 10) || 0), 0);
    const totalPesoB = vols.reduce((s, item) => s + (item.pesoB !== '' && item.pesoB != null ? parseFiscalNumber(item.pesoB) : 0), 0);
    const totalPesoL = vols.reduce((s, item) => s + (item.pesoL !== '' && item.pesoL != null ? parseFiscalNumber(item.pesoL) : 0), 0);
    const especies = [...new Set(vols.map((item) => item.esp || item.especie).filter(Boolean))];
    const marcas = [...new Set(vols.map((item) => item.marca).filter(Boolean))];
    const numeracoes = [...new Set(vols.map((item) => item.nVol || item.numeracao).filter(Boolean))];
    const lacresResumo = vols
      .flatMap((item) => Array.isArray(item.lacres) ? item.lacres : [])
      .map((lac) => String(lac || '').trim())
      .filter(Boolean)
      .join(', ');
    const resumoCampoVolume = (valores, fallback = '') => {
      if (!vols.length) return fallback;
      if (valores.length === 0) return '';
      if (valores.length === 1) return valores[0];
      return 'Diversos';
    };
    const docTransporta = transporta.CNPJ || transporta.cnpj || transporta.CPF || transporta.cpf || '';
    const placa = cleanCode(veic.placa);
    const ufPlaca = String(veic.UF || veic.uf || '').toUpperCase();
    const rntc = cleanCode(veic.RNTC || veic.rntc || veic.antt);
    fiscalBox(ML, y, 56, 8, 'NOME / RAZÃO SOCIAL', transporta.xNome || transporta.nome || '', { valueSize: 5.5, maxLines: 1 });
    fiscalBox(ML + 56, y, 38, 8, 'FRETE POR CONTA', freteModo[transp.modFrete] || freteModo[9], { valueSize: 4.9, maxLines: 1 });
    fiscalBox(ML + 94, y, 25, 8, 'CÓDIGO ANTT/RNTC', rntc, { valueSize: 5.5 });
    fiscalBox(ML + 119, y, 23, 8, 'PLACA DO VEÍCULO', placa, { valueSize: 5.5 });
    fiscalBox(ML + 142, y, 11, 8, 'UF', ufPlaca, { valueSize: 5.5 });
    fiscalBox(ML + 153, y, 37, 8, 'CNPJ / CPF', fmtDoc(docTransporta), { valueSize: 5.5 });
    y += 8;
    fiscalBox(ML, y, 78, 8, 'ENDEREÇO', transporta.xEnder || transporta.endereco || '', { valueSize: 5.5, maxLines: 1 });
    fiscalBox(ML + 78, y, 47, 8, 'MUNICÍPIO', transporta.xMun || transporta.municipio || '', { valueSize: 5.5, maxLines: 1 });
    fiscalBox(ML + 125, y, 12, 8, 'UF', transporta.UF || transporta.uf || '', { valueSize: 5.5 });
    fiscalBox(ML + 137, y, 53, 8, 'INSCRIÇÃO ESTADUAL', transporta.IE || transporta.ie || '', { valueSize: 5.5 });
    y += 8;
    fiscalBox(ML, y, 24, 8, 'QUANTIDADE', totalQVol ? String(totalQVol) : (vol.qVol || ''), { valueSize: 5.5 });
    fiscalBox(ML + 24, y, 35, 8, 'ESPÉCIE', resumoCampoVolume(especies, vol.esp || vol.especie || ''), { valueSize: 5.5 });
    fiscalBox(ML + 59, y, 34, 8, 'MARCA', resumoCampoVolume(marcas, vol.marca || ''), { valueSize: 5.5 });
    fiscalBox(ML + 93, y, 34, 8, 'NUMERAÇÃO', resumoCampoVolume(numeracoes, vol.nVol || vol.numeracao || ''), { valueSize: 5.5 });
    fiscalBox(ML + 127, y, 31.5, 8, 'PESO BRUTO', totalPesoB ? fmtFiscal(totalPesoB, 3) : fmtFiscalMaybe(vol.pesoB, 3), { align: 'right', valueSize: 5.5 });
    fiscalBox(ML + 158.5, y, 31.5, 8, 'PESO LÍQUIDO', totalPesoL ? fmtFiscal(totalPesoL, 3) : fmtFiscalMaybe(vol.pesoL, 3), { align: 'right', valueSize: 5.5 });
    y += 8;
    if (lacresResumo) {
      fiscalBox(ML, y, CW, 8, 'LACRES', lacresResumo.slice(0, 220), { valueSize: 5.5, maxLines: 1 });
      y += 8;
    }
    y += 2;

    const cols = [
      { label: 'CÓDIGO', w: 12 },
      { label: 'DESCRIÇÃO DO PRODUTO / SERVIÇO', w: 50 },
      { label: 'NCM/SH', w: 12 },
      { label: 'CST', w: 7 },
      { label: 'CFOP', w: 8 },
      { label: 'UN', w: 7 },
      { label: 'QTD', w: 12, align: 'right' },
      { label: 'VLR. UNIT.', w: 14, align: 'right' },
      { label: 'VLR. TOTAL', w: 14, align: 'right' },
      { label: 'BC ICMS', w: 12, align: 'right' },
      { label: 'VLR. ICMS', w: 11, align: 'right' },
      { label: 'VLR. IPI', w: 10, align: 'right' },
      { label: 'ALÍQ. ICMS', w: 11, align: 'right' },
      { label: 'ALÍQ. IPI', w: 10, align: 'right' },
    ];

    function drawProdutosHeader(repeat = false) {
      sectionHeader(repeat ? 'DADOS DOS PRODUTOS / SERVIÇOS - CONTINUAÇÃO' : 'DADOS DOS PRODUTOS / SERVIÇOS');
      setFiscalStroke();
      doc.setFillColor(244, 244, 244);
      doc.rect(ML, y, CW, 6.5, 'FD');
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(4.4);
      doc.setTextColor(...COR_PRETO);
      let headerX = ML;
      cols.forEach((col) => {
        doc.rect(headerX, y, col.w, 6.5, 'S');
        doc.text(col.label, headerX + 0.8, y + 2.7, { maxWidth: col.w - 1.2 });
        headerX += col.w;
      });
      doc.setFont('helvetica', 'normal');
      y += 6.5;
    }

    function itemValue(item, primary, fallback = '') {
      return item[primary] ?? item[primary?.toUpperCase?.()] ?? fallback;
    }

    function itemTaxValue(item, group, primary, fallback = '') {
      return itemValue(item, primary, item.imposto?.[group]?.[primary] ?? item.imposto?.[group]?.[primary?.toUpperCase?.()] ?? fallback);
    }

    drawProdutosHeader(false);
    if (!det.length) {
      fiscalBox(ML, y, CW, 8, 'SEM ITENS', 'Nenhum produto informado para esta NF-e.', { valueSize: 5.5 });
      y += 8;
    }

    det.forEach((item, idx) => {
      const cst = item.cst || item.CST || item.csosn || item.CSOSN || item.imposto?.icms?.cst || item.imposto?.icms?.csosn || '';
      const codigoDanfe = String(item.nItem || idx + 1);
      const vals = [
        codigoDanfe,
        item.xProd || '',
        item.ncm || item.NCM || '',
        cst,
        item.cfop || item.CFOP || '',
        item.uCom || item.unidade || '',
        fmtFiscalMaybe(item.qCom ?? item.quantidade, 3),
        fmtFiscalMaybe(item.vUnCom ?? item.valorUnitario, 4),
        fmtFiscalMaybe(item.vProd ?? item.total),
        fmtFiscalMaybe(itemTaxValue(item, 'icms', 'vBC')),
        fmtFiscalMaybe(itemTaxValue(item, 'icms', 'vICMS')),
        fmtFiscalMaybe(itemTaxValue(item, 'ipi', 'vIPI')),
        fmtFiscalMaybe(itemTaxValue(item, 'icms', 'pICMS', item.aliqICMS)),
        fmtFiscalMaybe(itemTaxValue(item, 'ipi', 'pIPI', item.aliqIPI)),
      ];
      const descLines = splitTextForWidth(doc, vals[1], cols[1].w - 1.4);
      const maxDescLinesPerChunk = 3;
      const descChunks = [];
      for (let i = 0; i < descLines.length; i += maxDescLinesPerChunk) {
        descChunks.push(descLines.slice(i, i + maxDescLinesPerChunk));
      }
      descChunks.forEach((descChunk, chunkIdx) => {
        const rowH = Math.max(5.6, descChunk.length * 2.7 + 2.4);
        if (y + rowH > 259) {
          addContinuationPage();
          drawProdutosHeader(true);
        }
        setFiscalStroke();
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(4.8);
        doc.setTextColor(...COR_PRETO);
        let cx = ML;
        cols.forEach((col, i) => {
          doc.rect(cx, y, col.w, rowH, 'S');
          const value = i === 1 ? descChunk : (chunkIdx === 0 ? vals[i] : (i === 0 ? `${vals[0]} cont.` : ''));
          const tx = col.align === 'right' ? cx + col.w - 0.9 : cx + 0.8;
          doc.text(value, tx, y + 3.6, { maxWidth: col.w - 1.2, align: col.align || 'left' });
          cx += col.w;
        });
        y += rowH;
      });
      if (idx === det.length - 1) y += 1.5;
    });

    const produtosMinBottom = 244;
    if (y < produtosMinBottom) {
      setFiscalStroke();
      let cx = ML;
      cols.forEach((col) => {
        doc.rect(cx, y, col.w, produtosMinBottom - y, 'S');
        cx += col.w;
      });
      y = produtosMinBottom;
    }

    ensureSpace(36);
    sectionHeader('CÁLCULO DO ISSQN');
    fiscalBox(ML, y, 47.5, 8, 'INSCRIÇÃO MUNICIPAL', emit.im || emit.IM || '');
    fiscalBox(ML + 47.5, y, 47.5, 8, 'VALOR TOTAL DOS SERVIÇOS', fmtFiscal(tot.vServ));
    fiscalBox(ML + 95, y, 47.5, 8, 'BASE DE CÁLCULO DO ISSQN', fmtFiscal(tot.vBCISS));
    fiscalBox(ML + 142.5, y, 47.5, 8, 'VALOR DO ISSQN', fmtFiscal(tot.vISS));
    y += 10;

    sectionHeader('DADOS ADICIONAIS');
    const infoPag = pag.length
      ? `Pagamento: ${pag.map((p) => `${p.tPag || ''} ${fmtFiscalMaybe(p.vPag)}`).join(' | ')}`
      : '';
    const infoAdic = [nfeData.infAdic || '', infoPag].filter(Boolean).join('\n');
    const dadosH = Math.min(30, Math.max(15, splitTextForWidth(doc, infoAdic || 'Sem informações complementares.', 130).length * 3 + 6));
    fiscalBox(ML, y, 128, dadosH, 'INFORMAÇÕES COMPLEMENTARES', infoAdic || 'Sem informações complementares.', { valueSize: 5.4, maxLines: 8 });
    fiscalBox(ML + 128, y, 62, dadosH, 'RESERVADO AO FISCO', '', { valueSize: 5.4, maxLines: 8 });
    y += dadosH + 2;

    const totalPages = doc.internal.getNumberOfPages();
    for (let i = 1; i <= totalPages; i++) {
      doc.setPage(i);
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(5);
      doc.setTextColor(...COR_CINZA);
      doc.text(`Sisweb - DANFE gerado em ${new Date().toLocaleString('pt-BR')} | Página ${i}/${totalPages}`,
        PW / 2, 290, { align: 'center' });
      doc.setTextColor(...COR_PRETO);
    }

    return doc;
  }

  // ─── Gerar DANFE NFC-e (Mod.65) — layout cupom térmico 80mm ──────────────
  async function gerarDANFENFCe(nfeData) {
    nfeData = normalizarNFeParaDANFE(nfeData || {}) || {};
    if (!window.jspdf && !window.jsPDF) throw new Error('jsPDF não carregado');
    const { jsPDF } = window.jspdf || window;
    // NFC-e: papel 80mm de largura, comprimento variável
    const PW = 80;
    const ML = 3;
    const CW = PW - ML * 2;
    const det  = nfeData.det   || [];
    const emit  = nfeData.emit  || {};
    const dest  = nfeData.dest  || {};
    const total = nfeData.total || {};
    const ide   = nfeData.ide   || {};
    const chave = nfeData.chave || '';
    const tpAmb = ide.tpAmb || 2;

    // Estimar altura da página
    const linhasItem = det.length * 12 + 120;
    const alturaTotal = Math.max(180, linhasItem);
    const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: [PW, alturaTotal] });

    let y = 5;
    const linha = () => { doc.setDrawColor(180, 180, 180); doc.line(ML, y, ML + CW, y); y += 2; };

    // Cabeçalho
    if (tpAmb == 2) {
      doc.setFontSize(6); doc.setTextColor(200, 0, 0);
      doc.text('AMBIENTE DE HOMOLOGAÇÃO — SEM VALOR FISCAL', ML + CW / 2, y, { align: 'center' }); y += 5;
    }
    doc.setFontSize(9); doc.setFont('helvetica', 'bold'); doc.setTextColor(0, 0, 0);
    doc.text(String(emit.razaoSocial || 'EMITENTE').toUpperCase(), ML + CW / 2, y, { align: 'center', maxWidth: CW }); y += 5;
    doc.setFontSize(6.5); doc.setFont('helvetica', 'normal');
    doc.text(`CNPJ: ${fmtCNPJ(emit.cnpj)}`, ML + CW / 2, y, { align: 'center' }); y += 4;
    const endStr = `${emit.endereco?.logradouro || ''}, ${emit.endereco?.numero || ''} — ${emit.endereco?.municipio || ''}/${emit.endereco?.uf || ''}`;
    doc.text(endStr, ML + CW / 2, y, { align: 'center', maxWidth: CW }); y += 5;
    doc.setFont('helvetica', 'bold'); doc.setFontSize(8);
    doc.text('NFC-e — NOTA FISCAL DE CONSUMIDOR ELETRÔNICA', ML + CW / 2, y, { align: 'center', maxWidth: CW }); y += 4;
    doc.setFont('helvetica', 'normal'); doc.setFontSize(6.5);
    doc.text(`N° ${String(nfeData.numero || ide.nNF || '').padStart(9,'0')}  |  Série ${ide.serie || 1}  |  ${fmtDtCurta(ide.dhEmi)}`, ML + CW / 2, y, { align: 'center' }); y += 3;
    linha();

    // Destinatário (opcional)
    if (dest.nome && dest.nome !== 'NF-E EMITIDA EM AMBIENTE DE HOMOLOGACAO - SEM VALOR FISCAL') {
      doc.setFontSize(6.5);
      doc.text(`Cliente: ${dest.nome}`, ML, y, { maxWidth: CW }); y += 4;
      doc.text(`CPF/CNPJ: ${fmtCNPJ(dest.cnpj || dest.cpf)}`, ML, y); y += 3;
      linha();
    }

    // Cabeçalho itens
    doc.setFont('helvetica', 'bold'); doc.setFontSize(6.5);
    doc.text('DESCRIÇÃO', ML, y); doc.text('TOTAL', ML + CW, y, { align: 'right' }); y += 4;
    linha();

    // Itens
    doc.setFont('helvetica', 'normal'); doc.setFontSize(6.5);
    det.forEach(it => {
      const nome = String(it.xProd || '').slice(0, 30);
      const qtd  = parseFloat(it.qCom || it.quantidade) || 0;
      const vUnit= parseFloat(it.vUnCom || it.valorUnitario) || 0;
      const vTot = parseFloat(it.vProd || it.total) || 0;
      doc.text(nome, ML, y, { maxWidth: CW - 15 });
      doc.text(fmtMoeda(vTot), ML + CW, y, { align: 'right' }); y += 4;
      doc.setTextColor(100, 100, 100);
      doc.text(`${fmtNum(qtd, 3)} ${it.uCom || 'UN'} x ${fmtMoeda(vUnit)}`, ML + 2, y); y += 4;
      doc.setTextColor(0, 0, 0);
    });
    linha();

    // Totais
    const tot = total.ICMSTot || total || {};
    const vNF    = parseFloat(tot.vNF || nfeData.valorTotal) || 0;
    const vDesc  = parseFloat(tot.vDesc) || 0;
    const vFrete = parseFloat(tot.vFrete) || 0;
    doc.setFont('helvetica', 'normal'); doc.setFontSize(7);
    if (vDesc) { doc.text('Desconto:', ML, y); doc.text(`- ${fmtMoeda(vDesc)}`, ML + CW, y, { align: 'right' }); y += 4; }
    if (vFrete) { doc.text('Frete:', ML, y); doc.text(fmtMoeda(vFrete), ML + CW, y, { align: 'right' }); y += 4; }
    doc.setFont('helvetica', 'bold'); doc.setFontSize(8);
    doc.text('TOTAL:', ML, y); doc.text(fmtMoeda(vNF), ML + CW, y, { align: 'right' }); y += 5;
    linha();

    // Forma de pagamento
    const pagLabels = { '01':'Dinheiro','17':'PIX','03':'Cartão Crédito','04':'Cartão Débito','02':'Cheque','99':'Outros' };
    const pag = Array.isArray(nfeData.pag) ? nfeData.pag : [];
    if (pag.length) {
      doc.setFont('helvetica', 'normal'); doc.setFontSize(7);
      pag.forEach(p => {
        doc.text(pagLabels[p.tPag] || p.tPag, ML, y);
        doc.text(fmtMoeda(p.vPag), ML + CW, y, { align: 'right' }); y += 4;
      });
      linha();
    }

    // Protocolo
    if (nfeData.nProt) {
      doc.setFont('helvetica', 'normal'); doc.setFontSize(6);
      doc.text(`Protocolo: ${nfeData.nProt}`, ML + CW / 2, y, { align: 'center' }); y += 4;
      doc.text(fmtDt(nfeData.dhAutorizacao), ML + CW / 2, y, { align: 'center' }); y += 4;
    }
    linha();

    // Chave de acesso
    doc.setFont('helvetica', 'normal'); doc.setFontSize(5.5);
    doc.text('CHAVE DE ACESSO', ML + CW / 2, y, { align: 'center' }); y += 3.5;
    const chaveF = chave.replace(/(\d{4})/g, '$1 ').trim();
    doc.text(chaveF, ML + CW / 2, y, { align: 'center', maxWidth: CW }); y += 8;

    // QR Code — gerado de forma síncrona via inline SVG ou imagem
    try {
      const qrUrl = buildQRCodeUrl(nfeData);
      const qrSize = 25; // mm
      const qrX = ML + (CW - qrSize) / 2;
      // Tentar inserir imagem QR (async — melhor esforço)
      const qrDataUrl = await gerarQRCodeDataURL(qrUrl, 200);
      if (qrDataUrl && qrDataUrl.startsWith('data:')) {
        doc.addImage(qrDataUrl, 'PNG', qrX, y, qrSize, qrSize);
        y += qrSize + 2;
      } else {
        doc.setFontSize(6); doc.setTextColor(100);
        doc.text('QR Code: Consulte pelo app da SEFAZ', ML + CW / 2, y, { align: 'center', maxWidth: CW });
        y += 6;
      }
    } catch (_) { y += 2; }

    doc.setFontSize(6); doc.setTextColor(120);
    doc.text('Consulte em: nfe.fazenda.gov.br', ML + CW / 2, y, { align: 'center', maxWidth: CW }); y += 5;
    doc.text(`Sisweb — ${new Date().toLocaleString('pt-BR')}`, ML + CW / 2, y, { align: 'center', maxWidth: CW });

    return doc;
  }

  // ─── Download como PDF ────────────────────────────────────────────────────
  async function downloadDANFE(nfeData) {
    const mod = parseInt(nfeData.ide?.mod) || 55;
    const doc = mod === 65 ? await gerarDANFENFCe(nfeData) : gerarDANFE(await prepararDANFEComAssets(nfeData));
    const numero = nfeData.numero || nfeData.ide?.nNF || 'SN';
    const label  = mod === 65 ? 'DANFE_NFC-e' : 'DANFE_NFe';
    doc.save(`${label}_${String(numero).padStart(9, '0')}.pdf`);
  }

  // ─── Abrir em nova aba ────────────────────────────────────────────────────
  async function abrirDANFE(nfeData) {
    const mod = parseInt(nfeData.ide?.mod) || 55;
    const doc = mod === 65 ? await gerarDANFENFCe(nfeData) : gerarDANFE(await prepararDANFEComAssets(nfeData));
    const url = doc.output('bloburl');
    window.open(url, '_blank');
  }

  // ─── Retornar blob URL ────────────────────────────────────────────────────
  async function blobURLDANFE(nfeData) {
    const mod = parseInt(nfeData.ide?.mod) || 55;
    const doc = mod === 65 ? await gerarDANFENFCe(nfeData) : gerarDANFE(await prepararDANFEComAssets(nfeData));
    return doc.output('bloburl');
  }

  return {
    gerarDANFE,
    gerarDANFENFCe,
    downloadDANFE,
    abrirDANFE,
    blobURLDANFE,
    buildQRCodeUrl,
    prepararDANFEComAssets,
    normalizarNFeParaDANFE,
  };
})();

window.NFDanfe = NFDanfe;
