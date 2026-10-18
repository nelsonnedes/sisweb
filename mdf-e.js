// Sistema de MDF-e (Manifesto de Documentos Fiscais)

// Variáveis globais
let mdfes = [];
let documentosFiscais = [];
let veiculos = [];
let condutores = [];
let numeroAtualMdfe = 1;
let mdfeEditando = null;
let tenantIdMdfe = null;
let configuracaoFiscalMdfe = {};
// Guard de carregamento: enquanto false, a Consulta mantém "⏳ Carregando..."
// (paridade com a NF-e) em vez de exibir "Nenhum MDF-e encontrado" antes da hora.
let __mdfesCarregados = false;
let __mdfesErro = false;

// Configurações
const configuracoesMdfe = {
    serie: '1',
    ufEmitente: 'SP',
    cnpjEmitente: '',
    razaoSocialEmitente: ''
};

function normalizeCompanyForMdfeReport(raw = {}) {
    const src = raw && typeof raw === 'object' ? raw : {};
    const enderecoObj = src.endereco && typeof src.endereco === 'object' ? src.endereco : {};
    const name = src.razaoSocial || src.nome || src.name || src.nomeFantasia || src.fantasia || configuracoesMdfe.razaoSocialEmitente || 'Empresa não informada';
    const address = src.endereco && typeof src.endereco !== 'object'
        ? src.endereco
        : (src.address || [enderecoObj.logradouro, enderecoObj.numero, enderecoObj.bairro].filter(Boolean).join(', '));
    const out = {
        name,
        cnpj: src.cnpj || configuracoesMdfe.cnpjEmitente || '-',
        ie: src.stateRegistration || src.inscricaoEstadual || src.ie || src.IE || '',
        logoDataUrl: mdfeNormalizeLogo(src.logoDataUrl || src.logoBase64 || src.logoData || ''),
        logoUrl: mdfeNormalizeLogo(src.logoUrl || src.logoURL || src.logoDownloadURL || src.downloadURL || ''),
        logoStoragePath: src.logoStoragePath || src.logoPath || src.storagePath || '',
        address: address || '-',
        city: src.cidade || src.city || src.municipio || enderecoObj.municipio || '-',
        state: src.estado || src.state || src.uf || enderecoObj.uf || configuracoesMdfe.ufEmitente || '-',
        phone: src.telefone || src.phone || '-'
    };
    // Logo em campo genérico (mesma tolerância dos pedidos: base64 cru vira data:).
    if (!out.logoDataUrl && !out.logoUrl) {
        const generico = mdfeNormalizeLogo(src.logo || '');
        if (/^data:image\//i.test(generico)) out.logoDataUrl = generico;
        else if (/^https?:\/\//i.test(generico)) out.logoUrl = generico;
    }
    // Espelhar PT/EN (padrão dos pedidos — fontes diversas usam chaves diversas).
    out.nome = out.name; out.endereco = out.address; out.cidade = out.city;
    out.estado = out.state; out.telefone = out.phone;
    return out;
}

// Normaliza logo (mesma regra dos pedidos de vendas/compras): data:, https,
// base64 cru (>80 chars vira data:image/png) ou path relativo/extensão.
// O render do DAMDFE filtra p/ https|data:image (nunca javascript:).
function mdfeNormalizeLogo(value) {
    if (!value) return '';
    const s = String(value).trim();
    if (!s) return '';
    if (/^(data:|blob:|https?:|file:)/i.test(s)) return s;
    if (/^[A-Za-z0-9+/=]+$/.test(s) && s.length > 80) return `data:image/png;base64,${s}`;
    if (/^(\.\/|\.\.\/|\/)/.test(s) || /\.(png|jpg|jpeg|webp|svg)$/i.test(s)) return s;
    return s;
}

// Resolve a logo da emitente p/ o DAMDFE (campos já normalizados por
// normalizeCompanyForMdfeReport; Storage via getStorageDataURL/getDownloadURL
// como no DANFE). Retorna dataURL ou https — ou '' (sem logo, sem quebrar).
async function mdfeResolverLogoEmpresa(empresa) {
    try {
        const emp = empresa && typeof empresa === 'object' ? empresa : {};
        if (/^data:image\//i.test(String(emp.logoDataUrl || ''))) return emp.logoDataUrl;
        if (/^https?:\/\//i.test(String(emp.logoUrl || ''))) return emp.logoUrl;
        const path = String(emp.logoStoragePath || '');
        if (!path) return '';
        const svc = window.firebaseService || {};
        try {
            if (typeof svc.getStorageDataURL === 'function') {
                const dataUrl = await svc.getStorageDataURL(path);
                if (/^data:image\//i.test(String(dataUrl || '')) && String(dataUrl).length < 2 * 1024 * 1024) return dataUrl;
            }
        } catch (_) {}
        try {
            if (typeof svc.getDownloadURL === 'function') {
                const dl = await svc.getDownloadURL(path);
                if (/^https?:\/\//i.test(String(dl || ''))) return String(dl);
            }
        } catch (_) {}
        return '';
    } catch (_) { return ''; }
}

async function obterDadosEmpresaMdfe() {
    try {
        const svc = window.firebaseService || window.firebaseServiceTL || window.FirebaseService;
        if (svc && typeof svc.getCompanyProfileForReport === 'function') {
            const central = await svc.getCompanyProfileForReport();
            const data = central && central.success !== false ? (central.data || central) : null;
            if (data && typeof data === 'object') return normalizeCompanyForMdfeReport(data);
        }
        // Perfil direto (paridade com nfAplicarLogoEmpresaAoDanfe da NF-e).
        const tid = mdfeResolverTenantId();
        if (tid && svc && typeof svc.loadFromFirebase === 'function') {
            try {
                const profile = await svc.loadFromFirebase(`companies/${tid}/profile`);
                const data = profile && profile.success !== false ? (profile.data || profile) : null;
                if (data && typeof data === 'object' && (data.nome || data.name || data.razaoSocial)) {
                    return normalizeCompanyForMdfeReport({ ...data, companyId: tid });
                }
            } catch (_) {}
        }
    } catch (_) {}
    try {
        const raw = localStorage.getItem('company_info');
        const info = raw ? JSON.parse(raw) : {};
        return normalizeCompanyForMdfeReport(info);
    } catch (_) {
        return normalizeCompanyForMdfeReport({});
    }
}

// Tenant p/ perfil da empresa (mesma ordem dos pedidos: módulo → SDK → local).
function mdfeResolverTenantId() {
    if (tenantIdMdfe) return tenantIdMdfe;
    try {
        const svc = window.firebaseService || window.firebaseServiceTL || window.FirebaseService || {};
        if (typeof svc.getCurrentTenantId === 'function' && svc.getCurrentTenantId()) return String(svc.getCurrentTenantId());
        if (typeof svc.getTenantId === 'function' && svc.getTenantId()) return String(svc.getTenantId());
    } catch (_) {}
    try {
        const raw = localStorage.getItem('company_info');
        const obj = raw ? JSON.parse(raw) : {};
        const id = obj && (obj.companyId || obj.companyID || obj.tenantId || obj.id);
        if (id) return String(id);
    } catch (_) {}
    return null;
}

function escapeHtmlMdfe(value) {
    return String(value || '')
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
}

// ─── Alerta persistente no topo (paridade com a NF-e) ─────────────────────
// Resultado de emissão/consulta/encerramento fica visível até o usuário fechar
// (os toasts somem rápido demais para analisar cStat/xMotivo).
function mdfeMostrarAlerta(msg, tipo = 'erro') {
    const el = document.getElementById('emissaoAlertaMdfe');
    if (!el) return;
    const estilos = {
        erro: 'background:color-mix(in srgb, var(--sw-danger) 18%, transparent);color:inherit;border:1px solid var(--sw-danger);',
        warn: 'background:color-mix(in srgb, var(--sw-warning) 18%, transparent);color:inherit;border:1px solid var(--sw-warning);',
        ok:   'background:color-mix(in srgb, var(--sw-success) 18%, transparent);color:inherit;border:1px solid var(--sw-success);',
    };
    el.style.cssText = `display:block;padding:10px 34px 10px 14px;border-radius:6px;margin-bottom:14px;font-weight:600;white-space:pre-line;${estilos[tipo] || estilos.erro}`;
    el.textContent = msg;
    if (!el.querySelector('.sw-msg-close')) {
        const close = document.createElement('button');
        close.type = 'button';
        close.className = 'sw-msg-close';
        close.setAttribute('aria-label', 'Fechar mensagem');
        close.textContent = '×';
        close.addEventListener('click', () => mdfeOcultarAlertaMdfe());
        el.appendChild(close);
    }
    el.hidden = false;
    try { el.scrollIntoView({ behavior: 'smooth', block: 'nearest' }); } catch (_) {}
}
function mdfeOcultarAlertaMdfe() {
    const el = document.getElementById('emissaoAlertaMdfe');
    if (el) el.hidden = true;
}

// ─── Modal de detalhes (paridade com nfInfoDetalheModal da NF-e) ──────────
function mdfeInfoDetalheModal(titulo, linhas, acoes = []) {
    try { document.getElementById('mdfeStatusDetalheModal')?.remove(); } catch (_) {}
    const ov = document.createElement('div');
    ov.id = 'mdfeStatusDetalheModal';
    ov.style.cssText = 'position:fixed;inset:0;z-index:10000002;background:rgba(15,23,42,.55);display:flex;align-items:center;justify-content:center;padding:16px;';
    const box = document.createElement('div');
    box.setAttribute('role', 'dialog'); box.setAttribute('aria-modal', 'true');
    box.style.cssText = 'background:var(--sw-surface,#fff);color:var(--sw-text-1,#0f172a);border-radius:12px;box-shadow:0 12px 40px rgba(0,0,0,.35);max-width:560px;width:100%;padding:20px;max-height:80vh;overflow:auto;';
    const h = document.createElement('h3');
    h.textContent = titulo;
    h.style.cssText = 'margin:0 0 12px;font-size:16px;';
    box.appendChild(h);
    const dl = document.createElement('div');
    dl.style.cssText = 'font-size:13px;line-height:1.6;';
    linhas.forEach(([k, v]) => {
        if (v == null || String(v).trim() === '') return;
        const row = document.createElement('div');
        row.style.cssText = 'display:flex;gap:8px;border-bottom:1px solid var(--sw-border,#e5e7eb);padding:6px 0;';
        const kk = document.createElement('strong');
        kk.textContent = k; kk.style.cssText = 'flex:0 0 150px;color:var(--sw-text-2,#475569);';
        const vv = document.createElement('span');
        vv.textContent = String(v); vv.style.cssText = 'flex:1;word-break:break-word;white-space:pre-wrap;';
        row.appendChild(kk); row.appendChild(vv); dl.appendChild(row);
    });
    box.appendChild(dl);
    const footer = document.createElement('div');
    footer.style.cssText = 'margin-top:16px;display:flex;gap:8px;flex-wrap:wrap;';
    (Array.isArray(acoes) ? acoes : []).forEach((a) => {
        if (!a || !a.label || typeof a.onclick !== 'function') return;
        const b = document.createElement('button');
        b.type = 'button'; b.textContent = a.label;
        b.style.cssText = 'padding:9px 16px;border:0;border-radius:8px;background:var(--sw-surface-2,#e2e8f0);color:var(--sw-text-1,#0f172a);font-weight:600;cursor:pointer;';
        b.onclick = a.onclick;
        footer.appendChild(b);
    });
    const btn = document.createElement('button');
    btn.type = 'button'; btn.textContent = 'Fechar';
    btn.style.cssText = 'padding:9px 16px;border:0;border-radius:8px;background:var(--sw-brand,#2563eb);color:#fff;font-weight:600;cursor:pointer;';
    btn.onclick = () => ov.remove();
    footer.appendChild(btn);
    box.appendChild(footer);
    ov.appendChild(box);
    ov.addEventListener('click', (e) => { if (e.target === ov) ov.remove(); });
    document.addEventListener('keydown', function _esc(e) { if (e.key === 'Escape') { ov.remove(); document.removeEventListener('keydown', _esc, true); } }, true);
    document.body.appendChild(ov);
    try { btn.focus(); } catch (_) {}
}

// Detalhes do status/erro de um MDF-e (clique no status — paridade com a NF-e)
function mdfeMostrarDetalheStatus(id) {
    try {
        const mdfe = mdfes.find(m => String(m.id) === String(id));
        if (!mdfe) { notifyUser('MDF-e não encontrado'); return; }
        const chave = mdfe.chaveAcesso || '';
        mdfeInfoDetalheModal(`Detalhes do MDF-e ${mdfe.numero || ''}`.trim(), [
            ['Status', String(mdfe.status || '').toUpperCase()],
            ['cStat', mdfe.cStat || ''],
            ['Motivo (SEFAZ)', mdfe.xMotivo || ''],
            ['Erro de comunicação', mdfe.erroMsg || ''],
            ['Protocolo', mdfe.protocolo || ''],
            ['Chave de acesso', chave],
            ['Protocolo de encerramento', mdfe.protocoloEncerramento || ''],
            ['Data de encerramento', mdfe.dataEncerramento || ''],
            ['Última atualização', mdfe.updatedAt || mdfe.enviadoEm || ''],
        ], [
            ...(chave ? [{ label: '🔑 Copiar chave', onclick: () => { try { navigator.clipboard.writeText(chave); notifyUser('Chave copiada.'); } catch (_) {} } }] : []),
            ...(mdfe.status === 'autorizado' ? [{ label: '✅ Encerrar MDF-e', onclick: () => { try { document.getElementById('mdfeStatusDetalheModal')?.remove(); } catch (_) {} encerrarMdfeRapido(mdfe.id); } }] : []),
            ...(['autorizado', 'erro_cancelamento'].includes(String(mdfe.status)) ? [{ label: '🚫 Cancelar MDF-e', onclick: () => { try { document.getElementById('mdfeStatusDetalheModal')?.remove(); } catch (_) {} cancelarMdfe(mdfe.id); } }] : []),
        ]);
    } catch (e) { notifyUser('Erro ao abrir detalhes: ' + (e?.message || e)); }
}

// Inicialização do sistema
document.addEventListener('DOMContentLoaded', function() {
    console.log('🚛 Inicializando sistema MDF-e...');
    
    // Definir data/hora atual
    const agora = new Date();
    const dataHoraLocal = new Date(agora.getTime() - agora.getTimezoneOffset() * 60000).toISOString().slice(0, 16);
    document.getElementById('mdfeDataEmissao').value = dataHoraLocal;
    document.getElementById('dataEncerramento').value = dataHoraLocal;
    
    // Configurar eventos
    configurarEventos();

    // Configurar estados e cidades do percurso
    configurarLocalizacaoMdfe();

    carregarDados().then(() => {
        atualizarDashboard();
        definirProximoNumeroMdfe();
        // Povoe a Consulta na abertura (paridade com carregarNotasFiscais
        // da NF-e): sem isto a tabela nasce com "Nenhum MDF-e encontrado".
        try { consultarMdfes(); } catch (_) {}
    });
    
    console.log('✅ Sistema MDF-e inicializado com sucesso');
});

// Carregar dados do tenant autenticado no Firebase
async function carregarDados() {
    try {
        __mdfesCarregados = false;
        __mdfesErro = false;
        const svc = window.firebaseService;
        if (!svc || typeof svc.resolveAuthenticatedTenant !== 'function' || typeof svc.loadFromFirebase !== 'function') {
            throw new Error('Serviço Firebase do MDF-e indisponível.');
        }

        // Mostrar estado de carregamento na tabela antes de buscar os dados (paridade com NF-e)
        const tbody = document.getElementById('mdfesTable');
        if (tbody) {
            tbody.innerHTML = '<tr><td colspan="8" class="mdfe-empty" style="text-align:center;color: var(--sw-text-2) ;font-style:italic;">⏳ Carregando...</td></tr>';
        }

        const context = await svc.resolveAuthenticatedTenant({ timeoutMs: 5000, reason: 'mdfe_init' });
        tenantIdMdfe = String(context?.companyId || '').trim();
        if (!tenantIdMdfe) throw new Error('Empresa autenticada não identificada para o MDF-e.');

        const result = await svc.loadFromFirebase(`companies/${tenantIdMdfe}/fiscal/mdfe`);
        const remoteData = result && result.data && typeof result.data === 'object' ? result.data : {};
        mdfes = Array.isArray(remoteData) ? remoteData : Object.values(remoteData);
        documentosFiscais = [];

        const configResult = await svc.loadFromFirebase(`companies/${tenantIdMdfe}/fiscal/config`);
        configuracaoFiscalMdfe = configResult && configResult.data && typeof configResult.data === 'object'
            ? configResult.data
            : {};
        
        console.log('📊 Dados carregados:', {
            mdfes: mdfes.length,
            documentos: documentosFiscais.length,
            veiculos: veiculos.length,
            condutores: condutores.length
        });

        // Sincroniza o select "Ambiente SEFAZ:" do MDF-e com o ambiente salvo
        // na config fiscal da NF-e (cfg.nfe.ambiente), evitando que o MDF-e seja
        // enviado/consultado em Homologação quando a empresa já opera em Produção.
        const ambienteConfigNF = configuracaoFiscalMdfe?.nfe?.ambiente;
        const selAmbiente = document.getElementById('mdfeAmbiente');
        if (selAmbiente && ambienteConfigNF) {
            selAmbiente.value = ambienteConfigNF;
        }

        // Pré-preenche veículo/condutor do último MDF-e (poupa redigitação)
        mdfePreencherUltimoVeiculoCondutor();
        __mdfesCarregados = true;
        
    } catch (error) {
        console.error('❌ Erro ao carregar dados:', error);
        mdfes = [];
        __mdfesCarregados = true;
        __mdfesErro = true;
        const tbody = document.getElementById('mdfesTable');
        if (tbody) {
            tbody.innerHTML = `<tr><td colspan="8" class="mdfe-empty" style="text-align:center;color:red;">Erro: ${error.message}</td></tr>`;
        }
    } finally {
        try { if (window.SiswebLoading && typeof window.SiswebLoading.hide === 'function') window.SiswebLoading.hide(); } catch (_) {}
    }
}

// Configurar eventos
function configurarEventos() {
    // Evento de submissão do formulário
    const form = document.getElementById('mdfeForm');
    if (form) {
        form.addEventListener('submit', function(e) {
            e.preventDefault();
            emitirMdfe();
        });
    }
    
    // Eventos de formatação
    const cpfInput = document.getElementById('condutorCpf');
    if (cpfInput) {
        cpfInput.addEventListener('input', function(e) {
            e.target.value = formatarCPF(e.target.value);
        });
    }
    
    const valorInput = document.getElementById('nfValor');
    if (valorInput) {
        valorInput.addEventListener('input', function(e) {
            e.target.value = formatarMoeda(e.target.value);
        });
    }
    
    // Eventos de busca
    const searchInput = document.getElementById('searchMdfe');
    if (searchInput) {
        searchInput.addEventListener('input', consultarMdfes);
    }
    
    const filterSelect = document.getElementById('filterStatusMdfe');
    if (filterSelect) {
        filterSelect.addEventListener('change', consultarMdfes);
    }

    // Calendário nativo de Data/Hora: devolve o foco ao escolher (o controle
    // é do browser; sem isto alguns mantêm o picker aberto após o clique).
    const emissaoInput = document.getElementById('mdfeDataEmissao');
    if (emissaoInput) {
        emissaoInput.addEventListener('change', function() { try { emissaoInput.blur(); } catch (_) {} });
    }
}

function configurarLocalizacaoMdfe() {
    const origemUf = document.getElementById('mdfeUfInicio');
    const origemCidade = document.getElementById('percursoMunicipioCarregamento');
    if (origemUf && origemCidade && typeof criarSelectEstados === 'function') {
        criarSelectEstados(origemUf.id, '', function(uf) {
            if (typeof popularCidades === 'function') popularCidades(origemCidade.id, uf);
        });
    }

    const destinoUf = document.getElementById('percursoUfFim');
    const destinoCidade = document.getElementById('percursoMunicipioDescarregamento');
    if (destinoUf && destinoCidade && typeof criarSelectEstados === 'function') {
        criarSelectEstados(destinoUf.id, '', function(uf) {
            if (typeof popularCidades === 'function') popularCidades(destinoCidade.id, uf);
        });
    }
}

// Função para mostrar abas
function showTab(tabName, tabTrigger) {
    // Esconder todas as abas
    const tabContents = document.querySelectorAll('.tab-content');
    tabContents.forEach(tab => tab.classList.remove('active'));
    
    // Remover classe active de todos os botões
    const tabs = document.querySelectorAll('.tab');
    tabs.forEach(tab => tab.classList.remove('active'));
    
    // Mostrar aba selecionada
    const selectedTab = document.getElementById(tabName);
    if (selectedTab) {
        selectedTab.classList.add('active');
    }
    
    // Aceitar tanto cliques da interface quanto chamadas programáticas.
    const trigger = tabTrigger || Array.from(document.querySelectorAll('.tabs .tab'))
        .find(tab => (tab.getAttribute('onclick') || '').includes(`showTab('${tabName}'`));
    if (trigger) trigger.classList.add('active');
    
    // Ações específicas por aba
    if (tabName === 'consulta') {
        consultarMdfes();
    } else if (tabName === 'dashboard') {
        atualizarDashboard();
    } else if (tabName === 'encerramento') {
        carregarMdfesParaEncerramento();
    }
}

// Definir próximo número do MDF-e
function definirProximoNumeroMdfe() {
    if (mdfes.length > 0) {
        const ultimoNumero = Math.max(...mdfes.map(m => parseInt(m.numero) || 0));
        numeroAtualMdfe = ultimoNumero + 1;
    }
    
    document.getElementById('mdfeNumero').value = numeroAtualMdfe.toString().padStart(9, '0');
}

// Adicionar documento fiscal
function adicionarDocumento() {
    const chave = document.getElementById('nfChave').value.trim();
    const valor = document.getElementById('nfValor').value;
    const peso = parseFloat(document.getElementById('nfPeso').value) || 0;
    
    if (!chave || chave.length !== 44) {
        notifyUser('Por favor, informe uma chave de NF-e válida (44 dígitos)');
        return;
    }
    
    if (!valor || parseFloat(valor.replace(/[^\d,]/g, '').replace(',', '.')) <= 0) {
        notifyUser('Por favor, informe um valor válido');
        return;
    }
    
    if (peso <= 0) {
        notifyUser('Por favor, informe um peso válido');
        return;
    }
    
    // Verificar se já existe
    const jaExiste = documentosFiscais.some(doc => doc.chave === chave);
    if (jaExiste) {
        notifyUser('Esta NF-e já foi adicionada');
        return;
    }
    
    const documento = {
        id: gerarId(),
        chave: chave,
        valor: parseFloat(valor.replace(/[^\d,]/g, '').replace(',', '.')),
        peso: peso,
        status: 'Adicionado',
        dataAdicao: new Date().toISOString()
    };
    
    documentosFiscais.push(documento);
    atualizarListaDocumentos();
    limparCamposDocumento();
    
    console.log('📄 Documento adicionado:', documento);
}

// Atualizar lista de documentos
function atualizarListaDocumentos() {
    const container = document.getElementById('documentosContainer');
    if (!container) return;
    
    container.innerHTML = '';
    
    documentosFiscais.forEach(doc => {
        const row = document.createElement('div');
        row.className = 'nf-row nf-document-row';
        row.innerHTML = `
            <div data-label="Chave NF-e" title="${escapeHtmlMdfe(doc.chave)}">${escapeHtmlMdfe(doc.chave.substring(0, 20))}...</div>
            <div data-label="Valor">R$ ${doc.valor.toLocaleString('pt-BR', {minimumFractionDigits: 2})}</div>
            <div data-label="Peso">${doc.peso.toLocaleString('pt-BR', {minimumFractionDigits: 3})} kg</div>
            <div data-label="Status"><span class="status-badge status-${escapeHtmlMdfe(doc.status.toLowerCase())}">${escapeHtmlMdfe(doc.status)}</span></div>
            <div data-label="Ações">
                <button type="button" onclick="removerDocumento('${escapeHtmlMdfe(doc.id)}')" class="btn btn-danger btn-small" aria-label="Remover documento fiscal">
                    <i class="fas fa-trash"></i>
                </button>
            </div>
        `;
        container.appendChild(row);
    });
}

// Remover documento
async function removerDocumento(id) {
    if (await confirmDialog({ title: 'Remover documento', message: 'Deseja remover este documento?', danger: true, confirmLabel: 'Remover' })) {
        documentosFiscais = documentosFiscais.filter(doc => doc.id !== id);
        atualizarListaDocumentos();
    }
}

// Limpar campos de documento
function limparCamposDocumento() {
    document.getElementById('nfChave').value = '';
    document.getElementById('nfValor').value = '';
    document.getElementById('nfPeso').value = '';
}

// ─── Importação de dados a partir das NF-e autorizadas do tenant ───────────
let nfeImportacaoLista = [];
let nfeImportacaoFiltro = '';
const nfeImportacaoSelecionadas = new Set();

function mdfeDigits(value) {
    return String(value == null ? '' : value).replace(/\D/g, '');
}

// ─── Senha A1 via modal central pequeno (mesmo padrão da NF-e/Consultar) ──
// Substitui TODOS os campos/prompts nativos de senha do MDF-e. Fallback:
// prompt nativo apenas se o promptDialog central não estiver carregado.
function mdfeSolicitarSenhaA1(opts = {}) {
    const mensagem = opts.message || 'Informe a senha do certificado A1.';
    const rotulo = opts.confirmLabel || 'Confirmar';
    if (typeof window.promptDialog === 'function') {
        return window.promptDialog({
            title: 'Senha do certificado A1',
            message: mensagem,
            placeholder: 'Senha do certificado A1',
            confirmLabel: rotulo,
            cancelLabel: 'Cancelar',
            inputType: 'password',
            autoComplete: 'current-password',
            icon: 'fas fa-lock',
        });
    }
    return Promise.resolve(window.prompt(mensagem));
}

// ─── Status do MDF-e: pill clicável com ícone e cor por status (padrão NF-e)
const MDFE_STATUS_MAP = {
    rascunho:          ['🟡 Rascunho', 'warning'],
    aguardando:        ['⏳ Aguardando', 'info'],
    autorizado:        ['✅ Autorizado', 'success'],
    encerrado:         ['🏁 Encerrado', 'brand'],
    rejeitado:         ['❌ Rejeitado', 'danger'],
    cancelado:         ['🚫 Cancelado', 'text-3'],
    erro_envio:        ['⚠️ Erro envio', 'warning'],
    erro_encerramento: ['⚠️ Erro encerr.', 'warning'],
};
function mdfeStatusPill(mdfe) {
    const [label, tok] = MDFE_STATUS_MAP[String(mdfe?.status || '').toLowerCase()] || ['❓ ' + String(mdfe?.status || ''), 'info'];
    return `<span onclick="mdfeMostrarDetalheStatus('${escapeHtmlMdfe(mdfe.id)}')" title="Ver detalhes do status" style="cursor:pointer;padding:3px 8px;border-radius:4px;font-size:11px;font-weight:700;white-space:nowrap;color:var(--sw-text-1);background:color-mix(in srgb, var(--sw-${tok}) 25%, transparent);border:1px solid var(--sw-${tok});">${label}</span>`;
}

// ─── Memória do último veículo/condutor (por tenant, localStorage) ────────
// A NF-e não carrega RNTC/tara/capacidade/CNH — esses campos ficam lembrados
// do último MDF-e do tenant e preenchem automaticamente o que estiver vazio.
function __mdfeVeiculoCondutorKey() {
    return `mdfe_ultimo_veiculo_condutor_${tenantIdMdfe || 'default'}`;
}
function mdfeSalvarUltimoVeiculoCondutor(payload) {
    try {
        const dados = {
            veiculo: {
                placa: String(payload?.veiculo?.placa || '').trim(),
                uf: String(payload?.veiculo?.uf || '').trim().toUpperCase(),
                rntrc: String(payload?.veiculo?.rntrc || '').replace(/\D/g, ''),
                renavam: String(payload?.veiculo?.renavam || '').trim(),
                tara: payload?.veiculo?.tara ?? '',
                capacidade: payload?.veiculo?.capacidade ?? '',
            },
            condutor: {
                nome: String(payload?.condutor?.nome || '').trim(),
                cpf: String(payload?.condutor?.cpf || '').trim(),
                cnh: String(payload?.condutor?.cnh || '').trim(),
            },
            reboque: {
                placa: String(payload?.reboque?.placa || '').replace(/[^A-Za-z0-9]/g, '').toUpperCase(),
                uf: String(payload?.reboque?.uf || '').trim().toUpperCase(),
            },
        };
        if (!dados.veiculo.placa && !dados.condutor.nome) return;
        localStorage.setItem(__mdfeVeiculoCondutorKey(), JSON.stringify(dados));
    } catch (_) {}
}
function mdfePreencherUltimoVeiculoCondutor() {
    try {
        const raw = localStorage.getItem(__mdfeVeiculoCondutorKey());
        if (!raw) return;
        const dados = JSON.parse(raw) || {};
        const v = dados.veiculo || {};
        const c = dados.condutor || {};
        const fillIfEmpty = (id, valor) => {
            const el = document.getElementById(id);
            if (el && !el.value && valor !== '' && valor != null) el.value = valor;
        };
        fillIfEmpty('veiculoPlaca', String(v.placa || '').toUpperCase());
        fillIfEmpty('veiculoUf', String(v.uf || '').toUpperCase());
        fillIfEmpty('veiculoRntrc', String(v.rntrc || ''));
        fillIfEmpty('veiculoRenavam', v.renavam);
        fillIfEmpty('veiculoTara', v.tara);
        fillIfEmpty('veiculoCapacidade', v.capacidade);
        fillIfEmpty('condutorNome', c.nome);
        fillIfEmpty('condutorCpf', c.cpf);
        fillIfEmpty('condutorCnh', c.cnh);
        try {
            const r = dados.reboque || {};
            fillIfEmpty('reboquePlaca', String(r.placa || ''));
            fillIfEmpty('reboqueUf', String(r.uf || ''));
        } catch (_) {}
    } catch (_) {}
}

function mdfePesoDaNota(nota) {
    const vols = Array.isArray(nota?.transp?.vol) ? nota.transp.vol : (nota?.transp?.vol ? [nota.transp.vol] : []);
    let peso = 0;
    vols.forEach((vol) => {
        const liquido = parseFloat(vol?.pesoL);
        const bruto = parseFloat(vol?.pesoB);
        peso += (Number.isFinite(liquido) && liquido > 0) ? liquido : (Number.isFinite(bruto) && bruto > 0 ? bruto : 0);
    });
    return Math.round(peso * 1000) / 1000;
}

function mdfeNormalizarNFeImportacao(remoteData) {
    const bruto = remoteData && typeof remoteData === 'object' ? remoteData : {};
    const itens = Array.isArray(bruto) ? bruto : Object.values(bruto);
    return itens
        .filter((nota) => nota && typeof nota === 'object')
        .filter((nota) => ['autorizada', 'autorizado'].includes(String(nota.status || '').toLowerCase()))
        .map((nota) => {
            const chave = mdfeDigits(nota.chaveAcesso || nota.chave);
            if (chave.length !== 44) return null;
            const valor = parseFloat(nota?.total?.vNF != null ? nota.total.vNF : nota.valorTotal) || 0;
            const peso = mdfePesoDaNota(nota);
            return {
                id: String(nota.id || chave),
                numero: String(nota.numero || '').replace(/^0+(?=\d)/, ''),
                serie: String(nota?.ide?.serie || nota.serie || ''),
                dataEmissao: String(nota.dataEmissao || ''),
                chave,
                destinatario: String(nota?.dest?.nome || ''),
                municipio: String(nota?.dest?.endereco?.municipio || ''),
                uf: String(nota?.dest?.endereco?.uf || ''),
                origemMunicipio: String(nota?.emit?.endereco?.municipio || ''),
                origemUf: String(nota?.emit?.endereco?.uf || ''),
                placa: String(nota?.transp?.veicTransp?.placa || '').replace(/[^A-Za-z0-9]/g, '').toUpperCase(),
                ufPlaca: String(nota?.transp?.veicTransp?.UF || nota?.transp?.veicTransp?.uf || '').toUpperCase(),
                // ANTT/RNTC do veicTransp da NF-e (MOC NF-e) = RNTRC do MDF-e.
                rntc: mdfeDigits(nota?.transp?.veicTransp?.RNTC || nota?.transp?.veicTransp?.rntc || nota?.transp?.veicTransp?.antt),
                reboque: (() => {
                    const rb0 = Array.isArray(nota?.transp?.reboque) ? nota.transp.reboque[0] : null;
                    if (!rb0 || typeof rb0 !== 'object') return null;
                    const placa = String(rb0.placa || '').replace(/[^A-Za-z0-9]/g, '').toUpperCase();
                    if (!placa) return null;
                    return { placa, uf: String(rb0.UF || rb0.uf || '').toUpperCase() };
                })(),
                transportaNome: String(nota?.transp?.transporta?.xNome || nota?.transp?.transporta?.nome || ''),
                transportaCpf: mdfeDigits(nota?.transp?.transporta?.CPF || nota?.transp?.transporta?.cpf),
                valor,
                peso,
                pesoDisponivel: peso > 0,
            };
        })
        .filter(Boolean)
        .sort((a, b) => (parseInt(b.numero, 10) || 0) - (parseInt(a.numero, 10) || 0));
}

function mdfeSomarImportacao(notas) {
    return (Array.isArray(notas) ? notas : []).filter(Boolean).reduce((acc, nota) => {
        const valor = parseFloat(nota?.valor) || 0;
        const peso = parseFloat(nota?.peso) || 0;
        acc.valor += valor;
        acc.peso += peso;
        if (!(peso > 0)) acc.semPeso += 1;
        return acc;
    }, { valor: 0, peso: 0, semPeso: 0 });
}

function mdfeResumoImportacao(notas) {
    const lista = (Array.isArray(notas) ? notas : []).filter(Boolean);
    const resumo = {
        origem: { municipio: '', uf: '' },
        destino: { municipio: '', uf: '' },
        // Condutor a partir do transportador PESSOA FÍSICA da NF-e (motorista
        // autônomo: transporta.xNome + CPF). PJ (CNPJ) não vira condutor.
        condutor: { nome: '', cpf: '' },
        placa: '',
        ufPlaca: '',
        rntrc: '',
        reboque: null,
        destinosDivergentes: false,
        placasDivergentes: false,
        rntcsDivergentes: false,
        reboquesDivergentes: false,
    };
    const destinos = new Set();
    const placas = new Set();
    const rntcs = new Set();
    const reboques = new Set();
    lista.forEach((nota) => {
        if (!resumo.origem.municipio && nota.origemMunicipio && nota.origemMunicipio !== 'N/A') {
            resumo.origem = { municipio: nota.origemMunicipio, uf: nota.origemUf || '' };
        }
        if (!resumo.condutor.cpf && nota.transportaCpf && nota.transportaCpf.length === 11 && nota.transportaNome) {
            resumo.condutor = { nome: nota.transportaNome, cpf: nota.transportaCpf };
        }
        if (nota.municipio && nota.municipio !== 'N/A') destinos.add(`${nota.uf}|${nota.municipio}`);
        if (nota.placa) placas.add(nota.placa);
        if (nota.ufPlaca && nota.placa && !resumo.ufPlaca) resumo.ufPlaca = nota.ufPlaca;
        if (nota.rntc) rntcs.add(nota.rntc);
        if (nota.reboque && nota.reboque.placa) {
            const chaveReb = `${nota.reboque.placa}|${nota.reboque.uf || ''}`;
            reboques.add(chaveReb);
            if (!resumo.reboque) resumo.reboque = { ...nota.reboque };
        }
    });
    if (destinos.size === 1) {
        const unico = [...destinos][0];
        const partes = unico.split('|');
        resumo.destino = { uf: partes[0] || '', municipio: partes.slice(1).join('|') };
    } else if (destinos.size > 1) {
        resumo.destinosDivergentes = true;
        const primeiro = lista.find((nota) => nota.municipio && nota.municipio !== 'N/A');
        if (primeiro) resumo.destino = { municipio: primeiro.municipio, uf: primeiro.uf || '' };
    }
    if (placas.size === 1) {
        resumo.placa = [...placas][0];
    } else if (placas.size > 1) {
        resumo.placasDivergentes = true;
        resumo.placa = [...placas][0];
    }
    if (rntcs.size === 1) {
        resumo.rntrc = [...rntcs][0];
    } else if (rntcs.size > 1) {
        resumo.rntcsDivergentes = true;
        resumo.rntrc = [...rntcs][0];
    }
    if (reboques.size > 1) resumo.reboquesDivergentes = true;
    return resumo;
}

function mdfeNotasVisiveisImportacao() {
    const busca = String(nfeImportacaoFiltro || '').trim().toLowerCase();
    const buscaDigitos = mdfeDigits(busca);
    const existentes = new Set(documentosFiscais.map((doc) => mdfeDigits(doc.chave)));
    return nfeImportacaoLista
        .filter((nota) => !busca
            || nota.numero.toLowerCase().includes(busca)
            || nota.destinatario.toLowerCase().includes(busca)
            || nota.municipio.toLowerCase().includes(busca)
            || (buscaDigitos && nota.chave.includes(buscaDigitos)))
        .map((nota) => ({ ...nota, jaAdicionada: existentes.has(nota.chave) }));
}

function atualizarBotaoImportacaoNFe() {
    const btn = document.getElementById('mdfeImportConfirmar');
    if (!btn) return;
    const total = nfeImportacaoSelecionadas.size;
    btn.innerHTML = `<i class="fas fa-file-import"></i> Importar ${total} NF-e`;
    btn.disabled = total === 0;
}

function renderImportacaoNFe() {
    const listaEl = document.getElementById('mdfeImportLista');
    if (!listaEl) return;
    const visiveis = mdfeNotasVisiveisImportacao();
    if (!visiveis.length) {
        listaEl.innerHTML = '<div class="mdfe-import-vazio">Nenhuma NF-e autorizada encontrada.</div>';
        atualizarBotaoImportacaoNFe();
        return;
    }
    listaEl.innerHTML = visiveis.map((nota) => {
        const marcada = nfeImportacaoSelecionadas.has(nota.chave) && !nota.jaAdicionada;
        const dataFormatada = nota.dataEmissao ? formatarData(nota.dataEmissao) : '—';
        const local = nota.municipio ? `${nota.municipio}/${nota.uf}` : 'Destino não informado';
        return `<label class="mdfe-import-row${nota.jaAdicionada ? ' is-disabled' : ''}">
            <input type="checkbox" ${marcada ? 'checked' : ''} ${nota.jaAdicionada ? 'disabled' : ''} onchange="alternarSelecaoImportacaoNFe('${nota.chave}', this.checked)">
            <div class="mdfe-import-info">
                <strong>NF-e ${escapeHtmlMdfe(nota.numero)}${nota.serie ? '/' + escapeHtmlMdfe(nota.serie) : ''}</strong>
                <span>${escapeHtmlMdfe(nota.destinatario || 'Destinatário não informado')}</span>
                <small>${escapeHtmlMdfe(local)} · ${escapeHtmlMdfe(dataFormatada)}</small>
                <small class="mdfe-import-chave">${escapeHtmlMdfe(nota.chave)}</small>
            </div>
            <div class="mdfe-import-valores">
                <span>R$ ${nota.valor.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</span>
                <span class="${nota.pesoDisponivel ? '' : 'mdfe-import-sempeso'}">${nota.pesoDisponivel ? nota.peso.toLocaleString('pt-BR', { minimumFractionDigits: 3 }) + ' kg' : 'sem peso'}</span>
                ${nota.jaAdicionada ? '<em>já adicionada</em>' : ''}
            </div>
        </label>`;
    }).join('');
    atualizarBotaoImportacaoNFe();
}

async function abrirImportacaoNFe() {
    if (!tenantIdMdfe) {
        notifyUser('Empresa autenticada não identificada para o MDF-e.');
        return;
    }
    const svc = window.firebaseService;
    if (!svc || typeof svc.loadFromFirebase !== 'function') {
        notifyUser('Serviço Firebase indisponível para carregar as NF-e.');
        return;
    }
    try {
        try { if (window.SiswebLoading && typeof window.SiswebLoading.show === 'function') window.SiswebLoading.show('Carregando NF-e autorizadas...'); } catch (_) {}
        const result = await svc.loadFromFirebase(`companies/${tenantIdMdfe}/fiscal/notas/nfe`);
        nfeImportacaoLista = mdfeNormalizarNFeImportacao(result?.data || {});
        nfeImportacaoFiltro = '';
        nfeImportacaoSelecionadas.clear();
        const busca = document.getElementById('mdfeImportBusca');
        if (busca) busca.value = '';
        renderImportacaoNFe();
        const modal = document.getElementById('mdfeImportModal');
        if (modal) modal.style.display = 'block';
        if (!nfeImportacaoLista.length) notifyUser('Nenhuma NF-e autorizada encontrada para importar.');
    } catch (error) {
        console.error('Erro ao carregar NF-e para importação:', error);
        notifyUser(`Não foi possível carregar as NF-e: ${error.message}`);
    } finally {
        try { if (window.SiswebLoading && typeof window.SiswebLoading.hide === 'function') window.SiswebLoading.hide(); } catch (_) {}
    }
}

function fecharImportacaoNFe() {
    const modal = document.getElementById('mdfeImportModal');
    if (modal) modal.style.display = 'none';
    nfeImportacaoSelecionadas.clear();
    atualizarBotaoImportacaoNFe();
}

function filtrarImportacaoNFe() {
    nfeImportacaoFiltro = document.getElementById('mdfeImportBusca')?.value || '';
    renderImportacaoNFe();
}

function alternarSelecaoImportacaoNFe(chave, marcada) {
    const limpa = mdfeDigits(chave);
    if (marcada) nfeImportacaoSelecionadas.add(limpa);
    else nfeImportacaoSelecionadas.delete(limpa);
    atualizarBotaoImportacaoNFe();
}

function selecionarTodasImportacaoNFe() {
    const visiveis = mdfeNotasVisiveisImportacao().filter((nota) => !nota.jaAdicionada);
    const todasMarcadas = visiveis.length > 0 && visiveis.every((nota) => nfeImportacaoSelecionadas.has(nota.chave));
    visiveis.forEach((nota) => {
        if (todasMarcadas) nfeImportacaoSelecionadas.delete(nota.chave);
        else nfeImportacaoSelecionadas.add(nota.chave);
    });
    renderImportacaoNFe();
}

function confirmarImportacaoNFe() {
    const selecionadas = nfeImportacaoLista.filter((nota) => nfeImportacaoSelecionadas.has(nota.chave));
    if (!selecionadas.length) {
        notifyUser('Selecione ao menos uma NF-e para importar.');
        return;
    }
    const existentes = new Set(documentosFiscais.map((doc) => mdfeDigits(doc.chave)));
    const novas = selecionadas.filter((nota) => !existentes.has(nota.chave));
    novas.forEach((nota) => {
        documentosFiscais.push({
            id: gerarId(),
            chave: nota.chave,
            valor: nota.valor,
            peso: nota.peso,
            status: 'Importado',
            nfeNumero: nota.numero,
            nfeSerie: nota.serie,
            dataAdicao: new Date().toISOString(),
        });
    });

    const resumo = mdfeResumoImportacao(novas);
    const ufInicioEl = document.getElementById('mdfeUfInicio');
    const cidadeCarregamentoEl = document.getElementById('percursoMunicipioCarregamento');
    const ufFimEl = document.getElementById('percursoUfFim');
    const cidadeDescarregamentoEl = document.getElementById('percursoMunicipioDescarregamento');
    const placaEl = document.getElementById('veiculoPlaca');
    // Import é ação explícita "trazer os dados da nota": os valores da NF-e
    // PREVALECEM sobre pré-preenchimentos anteriores (import roda depois do
    // prefill de últimos usados; só campos sem dado na nota ficam como estão).
    if (ufInicioEl && resumo.origem.uf) ufInicioEl.value = resumo.origem.uf;
    if (ufFimEl && resumo.destino.uf) ufFimEl.value = resumo.destino.uf;
    // Cidades agora são selects IBGE por UF: popula + seleciona; sem a lib,
    // cai no .value direto (inputs legados).
    if (typeof popularCidades === 'function') {
        try {
            if (resumo.origem.uf) popularCidades('percursoMunicipioCarregamento', resumo.origem.uf, resumo.origem.municipio || '');
            else if (cidadeCarregamentoEl && resumo.origem.municipio) cidadeCarregamentoEl.value = resumo.origem.municipio;
            if (resumo.destino.uf) popularCidades('percursoMunicipioDescarregamento', resumo.destino.uf, resumo.destino.municipio || '');
            else if (cidadeDescarregamentoEl && resumo.destino.municipio) cidadeDescarregamentoEl.value = resumo.destino.municipio;
        } catch (_) {}
    } else {
        if (cidadeCarregamentoEl && resumo.origem.municipio) cidadeCarregamentoEl.value = resumo.origem.municipio;
        if (cidadeDescarregamentoEl && resumo.destino.municipio) cidadeDescarregamentoEl.value = resumo.destino.municipio;
    }
    if (placaEl && resumo.placa) placaEl.value = resumo.placa;
    // ANTT/RNTC, UF da placa e reboque vêm da NF-e (veicTransp/reboque).
    const ufPlacaEl = document.getElementById('veiculoUf');
    if (ufPlacaEl && resumo.ufPlaca) ufPlacaEl.value = resumo.ufPlaca;
    const rntrcEl = document.getElementById('veiculoRntrc');
    if (rntrcEl && resumo.rntrc) rntrcEl.value = resumo.rntrc;
    if (resumo.reboque) {
        const rebPlacaEl = document.getElementById('reboquePlaca');
        const rebUfEl = document.getElementById('reboqueUf');
        if (rebPlacaEl && resumo.reboque.placa) rebPlacaEl.value = resumo.reboque.placa;
        if (rebUfEl && resumo.reboque.uf) rebUfEl.value = resumo.reboque.uf;
    }
    // Condutor do transportador PF da NF-e (motorista autônomo)
    const condutorNomeEl = document.getElementById('condutorNome');
    const condutorCpfEl = document.getElementById('condutorCpf');
    if (condutorNomeEl && resumo.condutor.nome) condutorNomeEl.value = resumo.condutor.nome;
    if (condutorCpfEl && resumo.condutor.cpf) condutorCpfEl.value = formatarCPF(resumo.condutor.cpf);
    // Completa o que a NF-e não carrega (tara/capacidade/CNH) com o último
    // veículo/condutor usados neste tenant — poupa redigitação.
    mdfePreencherUltimoVeiculoCondutor();

    atualizarListaDocumentos();
    fecharImportacaoNFe();

    const totais = mdfeSomarImportacao(novas);
    const avisos = [];
    if (totais.semPeso) avisos.push(`${totais.semPeso} NF-e sem peso — informe o peso manualmente`);
    if (resumo.destinosDivergentes) avisos.push('destinatários com municípios diferentes — confira o descarregamento');
    if (resumo.placasDivergentes) avisos.push('placas diferentes entre as NF-e — confira o veículo');
    if (resumo.rntcsDivergentes) avisos.push('RNTC diferentes entre as NF-e — confira o RNTRC');
    if (resumo.reboquesDivergentes) avisos.push('reboques diferentes entre as NF-e — confira o reboque');
    let mensagem = `${novas.length} NF-e importada(s): R$ ${totais.valor.toLocaleString('pt-BR', { minimumFractionDigits: 2 })} · ${totais.peso.toLocaleString('pt-BR', { minimumFractionDigits: 3 })} kg.`;
    if (avisos.length) mensagem += '\nAtenção: ' + avisos.join('; ') + '.';
    notifyUser(mensagem);
}

// Salvar rascunho do MDF-e
async function salvarRascunhoMdfe() {
    const dadosMdfe = coletarDadosFormulario();
    if (!dadosMdfe) return;
    
    dadosMdfe.status = 'rascunho';
    dadosMdfe.dataRascunho = new Date().toISOString();
    
    const index = mdfeEditando ? mdfes.findIndex(m => m.id === mdfeEditando) : -1;
    const payload = index !== -1
        ? { ...mdfes[index], ...dadosMdfe }
        : { ...dadosMdfe, id: gerarId(), numero: numeroAtualMdfe.toString().padStart(9, '0') };

    try {
        try { if (window.SiswebLoading && typeof window.SiswebLoading.show === 'function') window.SiswebLoading.show('Salvando rascunho...'); } catch (_) {}
        await salvarDados(payload);
        if (index !== -1) mdfes[index] = payload;
        else mdfes.push(payload);
        notifyUser('Rascunho salvo com sucesso!');
    } catch (error) {
        console.error('❌ Erro ao salvar rascunho MDF-e:', error);
        notifyUser(`Não foi possível salvar o rascunho: ${error.message}`);
        return;
    } finally {
        try { if (window.SiswebLoading && typeof window.SiswebLoading.hide === 'function') window.SiswebLoading.hide(); } catch (_) {}
    }
    
    console.log('💾 Rascunho salvo:', dadosMdfe);
}

// Emitir MDF-e
async function emitirMdfe() {
    const dadosMdfe = coletarDadosFormulario();
    if (!dadosMdfe) return;
    
    if (documentosFiscais.length === 0) {
        notifyUser('É necessário adicionar pelo menos um documento fiscal');
        return;
    }
    
    const index = mdfeEditando ? mdfes.findIndex(m => m.id === mdfeEditando) : -1;
    const payload = index !== -1
        ? { ...mdfes[index], ...dadosMdfe }
        : { ...dadosMdfe, id: gerarId(), numero: numeroAtualMdfe.toString().padStart(9, '0') };
    // Lembra veículo/condutor para os próximos MDF-e (CNH/tara/capacidade não
    // existem na NF-e — o import completa o que faltar com estes valores)
    mdfeSalvarUltimoVeiculoCondutor(payload);

    try {
        try { if (window.SiswebLoading && typeof window.SiswebLoading.show === 'function') window.SiswebLoading.show('Emitindo MDF-e...'); } catch (_) {}
        mdfeMostrarAlerta('⏳ Emitindo MDF-e — aguardando retorno da SEFAZ...', 'warn');
        const svc = window.firebaseService;
        if (!tenantIdMdfe || typeof svc?.callFunction !== 'function') throw new Error('Cloud Functions fiscais indisponíveis.');
        if (!window.MdfeXmlBuilder?.buildMdfe) throw new Error('Gerador XML MDF-e indisponível.');
        const ambiente = document.getElementById('mdfeAmbiente')?.value || 'homologacao';
        // Senha no modal central (padrão NF-e/Consultar SEFAZ) — cancelar aborta
        // sem reservar numeração. Campo inline removido da página.
        const senhaA1 = await mdfeSolicitarSenhaA1({
            message: 'Informe a senha do certificado A1 para emitir e transmitir o MDF-e.',
            confirmLabel: 'Emitir',
        });
        if (!senhaA1) { mdfeOcultarAlertaMdfe(); return; }

        const numeroResult = await svc.callFunction('mdfe_reservarNumero', { tenantId: tenantIdMdfe });
        const numero = Number(numeroResult?.numero || 0);
        if (!numero) throw new Error('Não foi possível reservar a numeração MDF-e.');

        const emit = configuracaoFiscalMdfe.empresa || {};
        const codigoCarregamento = await resolverCodigoMunicipio(dadosMdfe.ufInicio, dadosMdfe.municipioCarregamento);
        const codigoDescarregamento = await resolverCodigoMunicipio(dadosMdfe.ufFim, dadosMdfe.municipioDescarregamento);
        const xmlData = window.MdfeXmlBuilder.buildMdfe({
            ...payload,
            numero,
            tpAmb: ambiente === 'producao' ? 1 : 2,
            codigoMunicipioCarregamento: codigoCarregamento,
            codigoMunicipioDescarregamento: codigoDescarregamento,
            emit,
        });

        payload.numero = xmlData.numero;
        payload.status = 'aguardando';
        payload.chaveAcesso = xmlData.chave;
        payload.ambiente = ambiente;
        await salvarDados(payload);
        const result = await svc.callFunction('mdfe_emitir', {
            tenantId: tenantIdMdfe,
            mdfeId: payload.id,
            xml: xmlData.xml,
            senhaA1,
            ambiente,
        });
        payload.status = result?.status || (result?.autorizada ? 'autorizado' : 'rejeitado');
        payload.protocolo = result?.protocolo || '';
        payload.cStat = result?.cStat || '';
        payload.xMotivo = result?.xMotivo || '';
        if (index !== -1) mdfes[index] = payload;
        else {
            mdfes.push(payload);
            numeroAtualMdfe = numero + 1;
        }
        if (!result?.autorizada) {
            mdfeMostrarAlerta(`MDF-e Nº ${payload.numero} — ${String(payload.status).toUpperCase()} (cStat ${payload.cStat || '?'}): ${payload.xMotivo || 'retorno sem autorização'}`, 'erro');
            return;
        }
        mdfeMostrarAlerta(`MDF-e Nº ${payload.numero} AUTORIZADO — Protocolo: ${payload.protocolo || 'não informado'}`, 'ok');
    } catch (error) {
        console.error('❌ Erro ao salvar MDF-e:', error);
        mdfeMostrarAlerta(`Não foi possível emitir o MDF-e: ${error.message}`, 'erro');
        return;
    } finally {
        try { if (window.SiswebLoading && typeof window.SiswebLoading.hide === 'function') window.SiswebLoading.hide(); } catch (_) {}
    }
    
    limparFormularioMdfe();
    definirProximoNumeroMdfe();
    atualizarDashboard();
    // Pós-autorização: limpa os filtros (o nº novo precisa aparecer), atualiza
    // a Consulta (mais recente primeiro) e leva o usuário até ela.
    try {
        const buscaEl = document.getElementById('searchMdfe');
        if (buscaEl) buscaEl.value = '';
        const filtroEl = document.getElementById('filterStatusMdfe');
        if (filtroEl) filtroEl.value = '';
    } catch (_) {}
    try { consultarMdfes(); } catch (_) {}
    try { if (typeof window.showTab === 'function') window.showTab('consulta'); } catch (_) {}
    
    console.log('✅ MDF-e emitido:', dadosMdfe);
}

async function resolverCodigoMunicipio(uf, municipio) {
    if (typeof obterCodigoMunicipioIBGE !== 'function') throw new Error('Consulta de municípios IBGE indisponível.');
    const codigo = await obterCodigoMunicipioIBGE(uf, municipio);
    if (!codigo) throw new Error(`Não foi possível resolver o código IBGE de ${municipio}/${uf}.`);
    return codigo;
}

// Coletar dados do formulário
function coletarDadosFormulario() {
    try {
        const dados = {
            serie: document.getElementById('mdfeSerie').value,
            dataEmissao: document.getElementById('mdfeDataEmissao').value,
            tpEmit: parseInt(document.getElementById('mdfeTpEmit')?.value || '2', 10),
            ufInicio: document.getElementById('mdfeUfInicio').value,
            ufFim: document.getElementById('percursoUfFim').value,
            percursoUfs: String(document.getElementById('mdfePercursoUfs')?.value || '')
                .split(/[,\s;]+/).map((u) => u.trim().toUpperCase()).filter(Boolean),
            municipioCarregamento: document.getElementById('percursoMunicipioCarregamento').value,
            municipioDescarregamento: document.getElementById('percursoMunicipioDescarregamento').value,
            veiculo: {
                placa: document.getElementById('veiculoPlaca').value,
                uf: String(document.getElementById('veiculoUf')?.value || '').trim().toUpperCase(),
                rntrc: String(document.getElementById('veiculoRntrc')?.value || '').replace(/\D/g, ''),
                renavam: document.getElementById('veiculoRenavam').value,
                tara: parseFloat(document.getElementById('veiculoTara').value) || 0,
                capacidade: parseFloat(document.getElementById('veiculoCapacidade').value) || 0
            },
            reboque: {
                placa: String(document.getElementById('reboquePlaca')?.value || '').replace(/[^A-Za-z0-9]/g, '').toUpperCase(),
                uf: String(document.getElementById('reboqueUf')?.value || '').trim().toUpperCase(),
            },
            condutor: {
                nome: document.getElementById('condutorNome').value,
                cpf: document.getElementById('condutorCpf').value,
                cnh: document.getElementById('condutorCnh').value
            },
            documentos: [...documentosFiscais],
            observacoes: document.getElementById('mdfeObservacoes').value,
            valorTotal: documentosFiscais.reduce((total, doc) => total + doc.valor, 0),
            pesoTotal: documentosFiscais.reduce((total, doc) => total + doc.peso, 0)
        };
        
        // Validações básicas
        if (!dados.ufInicio || !dados.ufFim) {
            notifyUser('Por favor, selecione as UFs de início e fim');
            return null;
        }
        
        if (!dados.municipioCarregamento || !dados.municipioDescarregamento) {
            notifyUser('Por favor, informe os municípios de carregamento e descarregamento');
            return null;
        }
        
        if (!dados.veiculo.placa || !dados.veiculo.renavam) {
            notifyUser('Por favor, informe os dados do veículo');
            return null;
        }
        
        if (!dados.condutor.nome || !dados.condutor.cpf || !dados.condutor.cnh) {
            notifyUser('Por favor, informe os dados do condutor');
            return null;
        }
        
        return dados;
        
    } catch (error) {
        console.error('❌ Erro ao coletar dados:', error);
        notifyUser('Erro ao processar dados do formulário');
        return null;
    }
}

// Limpar formulário
function limparFormularioMdfe() {
    document.getElementById('mdfeForm').reset();
    documentosFiscais = [];
    atualizarListaDocumentos();
    mdfeEditando = null;
    
    // Redefinir data atual
    const agora = new Date();
    const dataHoraLocal = new Date(agora.getTime() - agora.getTimezoneOffset() * 60000).toISOString().slice(0, 16);
    document.getElementById('mdfeDataEmissao').value = dataHoraLocal;
    
    definirProximoNumeroMdfe();
}

// Consultar MDF-es
const MDFE_CONSULTA_PAGE_SIZE_OPTIONS = [10, 25, 50, 100];
let __mdfeConsultaFiltrados = [];
let __mdfeConsultaPagina = 1;

function __mdfeConsultaPageKey() {
    try {
        const u = (() => { try { return String(window.firebaseService?.currentUser?.uid || 'anon'); } catch (_) { return 'anon'; } })();
        return `mdfe_consulta_${tenantIdMdfe || 'default'}_${u}_items_per_page`;
    } catch (_) { return 'mdfe_consulta_default_anon_items_per_page'; }
}
function mdfeConsultaPageSize() {
    try {
        const v = parseInt(localStorage.getItem(__mdfeConsultaPageKey()) || '', 10);
        if (MDFE_CONSULTA_PAGE_SIZE_OPTIONS.includes(v)) return v;
    } catch (_) {}
    return 10;
}
function mdfeConsultaSetPageSize(value) {
    const size = parseInt(value, 10);
    if (!MDFE_CONSULTA_PAGE_SIZE_OPTIONS.includes(size)) return;
    try { localStorage.setItem(__mdfeConsultaPageKey(), String(size)); } catch (_) {}
    __mdfeConsultaPagina = 1;
    renderizarTabelaMdfesPaginada();
}
function mdfeConsultaMudarPagina(page) {
    const size = mdfeConsultaPageSize();
    const total = Math.max(1, Math.ceil(__mdfeConsultaFiltrados.length / size));
    __mdfeConsultaPagina = Math.min(Math.max(1, parseInt(page, 10) || 1), total);
    renderizarTabelaMdfesPaginada();
}

// Ordenação da Consulta: nº desc (mais recente primeiro). Pura p/ teste.
function mdfeOrdenarPorNumeroDesc(a, b) {
    return (parseInt(b && b.numero, 10) || 0) - (parseInt(a && a.numero, 10) || 0);
}

function consultarMdfes(resetPage = true) {
    const tbody = document.getElementById('mdfesTable');
    if (!__mdfesCarregados) {
        if (tbody) {
            tbody.innerHTML = '<tr><td colspan="8" class="mdfe-empty" style="text-align:center;color: var(--sw-text-2) ;font-style:italic;">⏳ Carregando...</td></tr>';
        }
        return;
    }
    if (__mdfesErro) return; // preserva a mensagem de erro do carregamento
    if (tbody) {
        tbody.innerHTML = '<tr><td colspan="8" class="mdfe-empty" style="text-align:center;color: var(--sw-text-2) ;font-style:italic;">⏳ Carregando...</td></tr>';
    }
    const busca = document.getElementById('searchMdfe').value.toLowerCase();
    const statusFiltro = document.getElementById('filterStatusMdfe').value;
    
    let mdfeFiltrados = mdfes;
    
    // Filtrar por busca (registros legados/teste podem não ter veiculo/condutor)
    if (busca) {
        mdfeFiltrados = mdfeFiltrados.filter(mdfe => 
            String(mdfe.numero || '').toLowerCase().includes(busca) ||
            String(mdfe.veiculo?.placa || '').toLowerCase().includes(busca) ||
            String(mdfe.condutor?.nome || '').toLowerCase().includes(busca)
        );
    }
    
    // Filtrar por status
    if (statusFiltro) {
        mdfeFiltrados = mdfeFiltrados.filter(mdfe => mdfe.status === statusFiltro);
    }
    
    // Mais recentes primeiro (nº desc — paridade com a NF-e e com a
    // importação em mdfeNormalizarNFeImportacao).
    __mdfeConsultaFiltrados = mdfeFiltrados.slice().sort(mdfeOrdenarPorNumeroDesc);
    if (resetPage !== false) __mdfeConsultaPagina = 1;
    renderizarTabelaMdfesPaginada();
}

function renderizarTabelaMdfesPaginada() {
    const size = mdfeConsultaPageSize();
    const total = __mdfeConsultaFiltrados.length;
    const totalPaginas = Math.max(1, Math.ceil(total / size));
    if (__mdfeConsultaPagina > totalPaginas) __mdfeConsultaPagina = totalPaginas;
    const inicio = (__mdfeConsultaPagina - 1) * size;
    atualizarTabelaMdfes(__mdfeConsultaFiltrados.slice(inicio, inicio + size));
    renderizarPaginacaoConsultaMdfe(total, __mdfeConsultaPagina, size);
}

function renderizarPaginacaoConsultaMdfe(totalItems, paginaAtual, pageSize) {
    const container = document.getElementById('paginacaoConsultaMdfe');
    if (!container) return;
    const totalPaginas = Math.ceil(totalItems / pageSize);
    container.innerHTML = '';
    if (!totalItems) return;
    const label = document.createElement('label');
    label.className = 'pagination-size-control';
    label.innerHTML = `<span>Itens por página:</span>
        <select onchange="mdfeConsultaSetPageSize(this.value)">
            ${MDFE_CONSULTA_PAGE_SIZE_OPTIONS.map((opt) => `<option value="${opt}" ${opt === pageSize ? 'selected' : ''}>${opt}</option>`).join('')}
        </select>`;
    container.appendChild(label);
    if (!totalPaginas || totalPaginas <= 1) {
        const info = document.createElement('span');
        info.className = 'pagination-total-info';
        info.textContent = `${totalItems} MDF-e(s)`;
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
        btn.onclick = () => mdfeConsultaMudarPagina(page);
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
    info.textContent = `Pág. ${paginaAtual}/${totalPaginas} · ${totalItems} MDF-e(s)`;
    container.appendChild(info);
}

// Atualizar tabela de MDF-es
function atualizarTabelaMdfes(mdfesParaExibir) {
    const tbody = document.getElementById('mdfesTable');
    if (!tbody) return;
    
    if (mdfesParaExibir.length === 0) {
        tbody.innerHTML = '<tr><td colspan="8" class="mdfe-empty">Nenhum MDF-e encontrado</td></tr>';
        return;
    }
    
    tbody.innerHTML = mdfesParaExibir.map(mdfe => `
        <tr>
            <td data-label="Número">${escapeHtmlMdfe(mdfe.numero)}</td>
            <td data-label="Série">${escapeHtmlMdfe(mdfe.serie)}</td>
            <td data-label="Data">${escapeHtmlMdfe(formatarDataHora(mdfe.dataEmissao))}</td>
            <td data-label="Placa">${escapeHtmlMdfe(mdfe.veiculo?.placa)}</td>
            <td data-label="Condutor">${escapeHtmlMdfe(mdfe.condutor?.nome)}</td>
            <td data-label="UF origem/destino">${escapeHtmlMdfe(mdfe.ufInicio)}/${escapeHtmlMdfe(mdfe.ufFim)}</td>
            <td data-label="Status">${mdfeStatusPill(mdfe)}</td>
            <td data-label="Ações">
                <div class="mdfe-actions">
                <button type="button" onclick="visualizarMdfe('${escapeHtmlMdfe(mdfe.id)}')" class="btn btn-primary btn-small" title="Visualizar" aria-label="Visualizar MDF-e">
                    <i class="fas fa-eye"></i>
                </button>
                <button type="button" onclick="abrirDamdfeImpressao('${escapeHtmlMdfe(mdfe.id)}')" class="btn btn-primary btn-small" title="DAMDFE / PDF" aria-label="Abrir DAMDFE para PDF">
                    <i class="fas fa-file-pdf"></i>
                </button>
                ${mdfe.status === 'autorizado' ? `
                    <button type="button" onclick="encerrarMdfeRapido('${escapeHtmlMdfe(mdfe.id)}')" class="btn btn-danger btn-small" title="Encerrar" aria-label="Encerrar MDF-e">
                        <i class="fas fa-check"></i>
                    </button>
                ` : ''}
                ${['autorizado', 'erro_cancelamento'].includes(String(mdfe.status)) ? `
                    <button type="button" onclick="cancelarMdfe('${escapeHtmlMdfe(mdfe.id)}')" class="btn btn-danger btn-small" title="Cancelar MDF-e" aria-label="Cancelar MDF-e">
                        <i class="fas fa-ban"></i>
                    </button>
                ` : ''}
                ${mdfe.status === 'rascunho' ? `
                    <button type="button" onclick="editarMdfe('${escapeHtmlMdfe(mdfe.id)}')" class="btn btn-warning btn-small" title="Editar" aria-label="Editar MDF-e">
                        <i class="fas fa-edit"></i>
                    </button>
                ` : ''}
                ${mdfe.chaveAcesso ? `
                    <button type="button" onclick="consultarMdfeFiscal('${escapeHtmlMdfe(mdfe.id)}')" class="btn btn-primary btn-small" title="Consultar SEFAZ" aria-label="Consultar MDF-e na SEFAZ">
                        <i class="fas fa-sync-alt"></i>
                    </button>
                ` : ''}
                <button type="button" onclick="clonarMdfe('${escapeHtmlMdfe(mdfe.id)}')" class="btn btn-success btn-small" title="Clonar MDF-e (abre um novo com os mesmos dados)" aria-label="Clonar MDF-e">
                    <i class="fas fa-copy"></i>
                </button>
                ${['rascunho', 'rejeitado', 'erro_envio', 'erro_encerramento'].includes(String(mdfe.status)) ? `
                    <button type="button" onclick="excluirMdfe('${escapeHtmlMdfe(mdfe.id)}')" class="btn btn-danger btn-small" title="Excluir MDF-e" aria-label="Excluir MDF-e">
                        <i class="fas fa-trash"></i>
                    </button>
                ` : ''}
                </div>
            </td>
        </tr>
    `).join('');
}

// Carregar MDF-es para encerramento
function carregarMdfesParaEncerramento() {
    const select = document.getElementById('mdfeEncerramento');
    if (!select) return;
    
    const mdfesAutorizados = mdfes.filter(m => m.status === 'autorizado');
    
    select.innerHTML = '<option value="">Selecione um MDF-e autorizado...</option>';
    
    mdfesAutorizados.forEach(mdfe => {
        const option = document.createElement('option');
        option.value = mdfe.id;
        option.textContent = `${mdfe.numero || '-'} - ${mdfe.veiculo?.placa || '-'} - ${mdfe.condutor?.nome || '-'}`;
        select.appendChild(option);
    });
}

// Encerramento: UF + cidade IBGE do próprio MDF-e (evita município de UF
// errada, ex.: cidade de carregamento/PA resolvida contra ufFim/BA).
function mdfeSincronizarEncerramento(mdfeId) {
    try {
        const mdfe = mdfes.find(m => String(m.id) === String(mdfeId));
        const ufEl = document.getElementById('ufEncerramento');
        if (!mdfe || !ufEl) return;
        const uf = String(mdfe.ufFim || '').toUpperCase();
        if (uf) ufEl.value = uf;
        if (typeof popularCidades === 'function' && uf) {
            try { popularCidades('municipioEncerramento', uf, mdfe.municipioDescarregamento || ''); } catch (_) {}
        }
    } catch (_) {}
}

// Encerrar MDF-e
async function encerrarMdfe() {
    const mdfeId = document.getElementById('mdfeEncerramento').value;
    const dataEncerramento = document.getElementById('dataEncerramento').value;
    const ufEncerramento = String(document.getElementById('ufEncerramento')?.value || '').trim().toUpperCase();
    const municipioEncerramento = document.getElementById('municipioEncerramento').value;
    
    if (!mdfeId) {
        notifyUser('Selecione um MDF-e para encerrar');
        return;
    }
    
    if (!dataEncerramento) {
        notifyUser('Informe a data/hora de encerramento');
        return;
    }

    if (!ufEncerramento) {
        notifyUser('Informe a UF de encerramento');
        return;
    }
    
    if (!municipioEncerramento) {
        notifyUser('Informe o município de encerramento');
        return;
    }
    
    const mdfe = mdfes.find(m => m.id === mdfeId);
    if (!mdfe) {
        notifyUser('MDF-e não encontrado');
        return;
    }
    
    try {
        // Senha no modal central (padrão NF-e)
        const senhaA1 = await mdfeSolicitarSenhaA1({
            message: 'Informe a senha do certificado A1 para encerrar o MDF-e.',
            confirmLabel: 'Encerrar MDF-e',
        });
        if (!senhaA1) return;
        const cMunEnc = await resolverCodigoMunicipio(ufEncerramento, municipioEncerramento);
        const result = await window.firebaseService.callFunction('mdfe_encerrar', {
            tenantId: tenantIdMdfe,
            mdfeId: mdfe.id,
            chave: mdfe.chaveAcesso,
            nProt: mdfe.protocolo || '',
            cMunEnc,
            dtEnc: dataEncerramento,
            senhaA1,
            ambiente: document.getElementById('mdfeAmbiente')?.value || 'homologacao',
        });
        if (!result?.encerrado) throw new Error(result?.xMotivo || 'SEFAZ não autorizou o encerramento.');
        mdfe.status = 'encerrado';
        mdfe.dataEncerramento = dataEncerramento;
        mdfe.municipioEncerramento = municipioEncerramento;
        mdfe.protocoloEncerramento = result.protocolo || '';
        document.getElementById('protocoloEncerramento').value = mdfe.protocoloEncerramento;
    } catch (error) {
        console.error('❌ Erro ao salvar encerramento MDF-e:', error);
        mdfeMostrarAlerta(`Não foi possível salvar o encerramento: ${error.message}`, 'erro');
        return;
    }
    mdfeMostrarAlerta('MDF-e encerrado com sucesso! Protocolo: ' + (mdfe.protocoloEncerramento || 'não informado'), 'ok');
    
    // Limpar formulário
    document.getElementById('mdfeEncerramento').value = '';
    try { document.getElementById('ufEncerramento').value = ''; } catch (_) {}
    document.getElementById('municipioEncerramento').value = '';
    document.getElementById('protocoloEncerramento').value = '';
    
    atualizarDashboard();
    carregarMdfesParaEncerramento();
    
    console.log('🏁 MDF-e encerrado:', mdfe);
}

// Encerrar MDF-e rapidamente
async function encerrarMdfeRapido(id) {
    const mdfe = mdfes.find(m => m.id === id);
    if (!mdfe) return;
    // Município e senha via modal central (mesmo padrão da NF-e)
    const municipio = typeof window.promptDialog === 'function'
        ? await window.promptDialog({
            title: 'Encerrar MDF-e',
            message: 'Informe o município de encerramento:',
            placeholder: 'Município (ex.: Belém)',
            confirmLabel: 'Continuar',
            cancelLabel: 'Cancelar',
            inputType: 'text',
            autoComplete: 'off',
            icon: 'fas fa-check-circle',
        })
        : prompt('Informe o município de encerramento:');
    if (!municipio) return;
    
    try {
        const senhaA1 = await mdfeSolicitarSenhaA1({
            message: 'Informe a senha do certificado A1 para encerrar o MDF-e.',
            confirmLabel: 'Encerrar',
        });
        if (!senhaA1) return;
        const cMunEnc = await resolverCodigoMunicipio(mdfe.ufFim, municipio);
        const result = await window.firebaseService.callFunction('mdfe_encerrar', {
            tenantId: tenantIdMdfe,
            mdfeId: mdfe.id,
            chave: mdfe.chaveAcesso,
            nProt: mdfe.protocolo || '',
            cMunEnc,
            dtEnc: new Date().toISOString().slice(0, 10),
            senhaA1,
            ambiente: document.getElementById('mdfeAmbiente')?.value || 'homologacao',
        });
        if (!result?.encerrado) throw new Error(result?.xMotivo || 'SEFAZ não autorizou o encerramento.');
        mdfe.status = 'encerrado';
        mdfe.dataEncerramento = new Date().toISOString();
        mdfe.municipioEncerramento = municipio;
        mdfe.protocoloEncerramento = result.protocolo || '';
    } catch (error) {
        console.error('❌ Erro ao salvar encerramento rápido MDF-e:', error);
        mdfeMostrarAlerta(`Não foi possível salvar o encerramento: ${error.message}`, 'erro');
        return;
    }
    mdfeMostrarAlerta('MDF-e encerrado com sucesso!', 'ok');
    
    consultarMdfes();
    atualizarDashboard();
}

// Cancelar MDF-e (tpEvento 110111 — Ajuste SINIEF 21/2010: até 24h da
// autorização e transporte não iniciado; nunca de MDF-e encerrado).
async function cancelarMdfe(id) {
    const mdfe = mdfes.find(m => String(m.id) === String(id));
    if (!mdfe || !['autorizado', 'erro_cancelamento'].includes(String(mdfe.status))) {
        notifyUser('Somente MDF-e autorizado pode ser cancelado');
        return;
    }
    // Justificativa via modal central (mín. 15 caracteres — MOC).
    const justificativa = typeof window.promptDialog === 'function'
        ? await window.promptDialog({
            title: 'Cancelar MDF-e',
            message: 'Justificativa do cancelamento (mín. 15 caracteres):',
            placeholder: 'Motivo do cancelamento',
            confirmLabel: 'Continuar',
            cancelLabel: 'Voltar',
            inputType: 'text',
            autoComplete: 'off',
            icon: 'fas fa-ban',
        })
        : prompt('Justificativa do cancelamento (mín. 15 caracteres):');
    if (!justificativa) return;
    if (String(justificativa).trim().length < 15) {
        notifyUser('Justificativa com no mínimo 15 caracteres (MOC)');
        return;
    }
    try {
        const senhaA1 = await mdfeSolicitarSenhaA1({
            message: 'Informe a senha do certificado A1 para cancelar o MDF-e.',
            confirmLabel: 'Cancelar MDF-e',
        });
        if (!senhaA1) return;
        try { if (window.SiswebLoading && typeof window.SiswebLoading.show === 'function') window.SiswebLoading.show('Cancelando MDF-e...'); } catch (_) {}
        const result = await window.firebaseService.callFunction('mdfe_cancelar', {
            tenantId: tenantIdMdfe,
            mdfeId: mdfe.id,
            chave: mdfe.chaveAcesso,
            nProt: mdfe.protocolo || '',
            xJust: String(justificativa).trim(),
            senhaA1,
            ambiente: document.getElementById('mdfeAmbiente')?.value || 'homologacao',
        });
        if (!result?.cancelado) throw new Error(result?.xMotivo || 'SEFAZ não autorizou o cancelamento.');
        mdfe.status = 'cancelado';
        mdfe.protocoloCancelamento = result.protocolo || '';
        mdfe.dataCancelamento = new Date().toISOString();
        mdfe.justificativaCancelamento = String(justificativa).trim();
    } catch (error) {
        console.error('❌ Erro ao cancelar MDF-e:', error);
        mdfeMostrarAlerta(`Não foi possível cancelar o MDF-e: ${error.message}`, 'erro');
        return;
    } finally {
        try { if (window.SiswebLoading && typeof window.SiswebLoading.hide === 'function') window.SiswebLoading.hide(); } catch (_) {}
    }
    mdfeMostrarAlerta('MDF-e cancelado com sucesso! Protocolo: ' + (mdfe.protocoloCancelamento || 'não informado'), 'ok');

    consultarMdfes();
    atualizarDashboard();
    carregarMdfesParaEncerramento();
}

// Visualizar MDF-e — preview do DAMDFE (como ficará ao enviar/imprimir)
function visualizarMdfe(id) {
    const mdfe = mdfes.find(m => String(m.id) === String(id));
    if (!mdfe) { notifyUser('MDF-e não encontrado'); return; }
    mdfeAbrirPreviewDamdfe(mdfe);
}

// ─── DAMDFE (Documento Auxiliar do MDF-e): preview + PDF ─────────────────
// Segue o MOC MDF-e Anexo II (Manual de Especificações Técnicas do DAMDFE,
// v3.00b): cabeçalho do emitente, CODE-128C da chave (§2.3), QR Code do
// qrCodMDFe (§2.4 — mesma fórmula do XML em mdfe-xml-builder.js:134),
// "EMITIDO EM AMBIENTE DE HOMOLOGAÇÃO – SEM VALOR FISCAL" (§2.6) e
// "EMISSÃO EM CONTINGÊNCIA" (§2.5) na área do protocolo.
// Renderiza SOMENTE com dados do registro + emitente. Puro (sem DOM) p/ teste.
// Registros legados podem não ter veiculo/condutor/documentos/ambiente.
function mdfeQrCodeMDFe(chave, tpAmb) {
    const dig = String(chave || '').replace(/\D/g, '');
    if (dig.length !== 44) return '';
    return `https://dfe-portal.svrs.rs.gov.br/mdfe/qrCode?chMDFe=${dig}&tpAmb=${tpAmb === 1 ? 1 : 2}`;
}

// CODE-128C da chave via JsBarcode (MIT, vendored em assets/vendor).
// Sem a lib (ou fora do browser), retorna null e o DAMDFE mostra só a chave.
function mdfeCodigoBarrasSvg(chave) {
    try {
        const dig = String(chave || '').replace(/\D/g, '');
        if (dig.length !== 44 || typeof window === 'undefined' || typeof window.JsBarcode !== 'function') return null;
        const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
        window.JsBarcode(svg, dig, { format: 'CODE128C', width: 1, height: 60, displayValue: false, margin: 10 });
        return (svg && svg.outerHTML) || null;
    } catch (_) { return null; }
}

// QR Code (SVG inline) via qrcode-generator (MIT, vendored). Null sem a lib.
function mdfeQrSvg(url) {
    try {
        if (!url || typeof qrcode !== 'function') return null;
        const qr = qrcode(0, 'M');
        qr.addData(url);
        qr.make();
        return qr.createSvgTag({ cellSize: 4, margin: 0, scalable: true });
    } catch (_) { return null; }
}

// CSS único do DAMDFE (impressão + preview).
function mdfeDamdfeCss() {
    return '.damdfe{font-family:Arial,Helvetica,sans-serif;font-size:11px;color:#000;}'
        + '.damdfe-row{display:flex;}.damdfe-row>div{flex:1;}'
        + '.damdfe-box{border:1px solid #000;padding:5px 7px;}'
        + '.damdfe-lbl{font-size:8px;font-weight:700;letter-spacing:.4px;}'
        + '.damdfe-emit{font-size:12px;display:flex;gap:8px;align-items:flex-start;}.damdfe-emit strong{font-size:13px;}'
        + '.damdfe-logo{flex:0 0 auto;max-width:22mm;max-height:18mm;margin:2px 0 0;}'
        + '.damdfe-scope{background:#fff;color:#000;color-scheme:light;}'
        + '.damdfe-doc{text-align:center;}.damdfe-doc .t{font-size:16px;font-weight:700;}'
        + '.damdfe-tab{width:100%;border-collapse:collapse;margin:4px 0;font-size:10px;}'
        + '.damdfe-tab th,.damdfe-tab td{border:1px solid #000;padding:3px 5px;text-align:left;}'
        + '.mono{font-family:monospace;font-size:10px;word-break:break-all;}'
        + '.num{text-align:right;white-space:nowrap;}'
        + '.damdfe-banner{border:1px solid #000;text-align:center;font-weight:700;padding:6px;margin-top:6px;text-transform:uppercase;}'
        + '.damdfe-fisco{text-align:center;}'
        + '.damdfe-barcode svg{max-width:100%;height:auto;}'
        + '.damdfe-qr svg{width:25mm;height:25mm;}'
        + '.damdfe-foot{font-size:9px;text-align:center;margin-top:4px;}';
}

function mdfeDamdfeConteudo(mdfe, empresa) {
    const m = mdfe && typeof mdfe === 'object' ? mdfe : {};
    const emp = empresa && typeof empresa === 'object' ? empresa : {};
    const esc = (v) => escapeHtmlMdfe(v == null ? '' : String(v));
    const veiculo = m.veiculo && typeof m.veiculo === 'object' ? m.veiculo : {};
    const condutor = m.condutor && typeof m.condutor === 'object' ? m.condutor : {};
    const docs = Array.isArray(m.documentos) ? m.documentos : [];
    const moeda = (v) => (Number(v) || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 });
    const pesoFmt = (v) => (Number(v) || 0).toLocaleString('pt-BR', { minimumFractionDigits: 3 });
    let dataEmissao = '-';
    try { if (m.dataEmissao) dataEmissao = esc(formatarDataHora(m.dataEmissao)); } catch (_) {}
    const chaveDig = String(m.chaveAcesso || '').replace(/\D/g, '');
    const temChave = chaveDig.length === 44;
    // tpEmis = dígito 35 da chave (0-based 34): 2 = contingência (MOC §2.5).
    const conting = temChave && chaveDig.charAt(34) === '2';
    const homolog = String(m.ambiente || '') !== 'producao';
    const tpAmb = String(m.ambiente || '') === 'producao' ? 1 : 2;
    // Registros legados sem ambiente assumem homologação SÓ no parâmetro de
    // consulta do QR; o impresso não afirma ambiente que não conhece.
    const qrUrl = temChave ? mdfeQrCodeMDFe(chaveDig, tpAmb) : '';
    const barcode = temChave ? mdfeCodigoBarrasSvg(chaveDig) : null;
    const qrSvg = qrUrl ? mdfeQrSvg(qrUrl) : null;
    const endEmit = [emp.address, emp.city && emp.state ? `${emp.city}/${emp.state}` : (emp.city || emp.state || '')]
        .filter((x) => x && x !== '-').join(' — ');
    // Só https/data:image — nunca javascript:/data:text (registro remoto).
    const logoSrc = /^(https?:\/\/|data:image\/)/i.test(String(emp.logoSrc || '')) ? String(emp.logoSrc) : '';
    const linhasDocs = docs.length ? docs.map((d) => {
        const chave = esc(d && d.chave);
        const nfRef = [d && d.nfeNumero, d && d.nfeSerie].filter((x) => x != null && String(x) !== '').map(String).join('/');
        return `<tr><td class="mono">${chave || '-'}</td><td>${esc(nfRef || '-')}</td>` +
            `<td class="num">R$ ${moeda(d && d.valor)}</td><td class="num">${pesoFmt(d && d.peso)} kg</td></tr>`;
    }).join('') : '<tr><td colspan="4">Nenhum documento vinculado</td></tr>';
    // Área do protocolo (MOC §§2.5–2.6): contingência ou homologação em
    // destaque; produção mostra o protocolo.
    const areaProtocolo = conting
        ? `<div class="damdfe-banner">EMISSÃO EM CONTINGÊNCIA</div>`
        : `<div>Protocolo de autorização: <strong>${esc(m.protocolo || '-')}</strong></div>`
            + (homolog ? `<div class="damdfe-banner">EMITIDO EM AMBIENTE DE HOMOLOGAÇÃO – SEM VALOR FISCAL</div>` : '');
    // Estrutura espelha o DAMDFE padrão de mercado (emissores): emitente +
    // documento + fisco no topo; quantitativos; veículos/condutores; CIOT e
    // vale-pedágio (não coletados — "-" honesto); percurso; composição da
    // carga; seguros (não coletado); complementares; fisco. Só dados reais.
    const formaEmissao = !temChave ? '-' : (conting ? 'CONTINGÊNCIA' : 'NORMAL');
    // Rota do percurso (UFs intermediárias vêm do form; ini/fim, do registro).
    const rota = [m.ufInicio, ...(Array.isArray(m.percursoUfs) ? m.percursoUfs : []), m.ufFim]
        .map((u) => String(u || '').trim().toUpperCase()).filter(Boolean).join(' → ') || '-';
    const reb = m.reboque && typeof m.reboque === 'object' ? m.reboque : {};
    const temReboque = !!String(reb.placa || '').trim();
    const fiscoBox = `<div class="damdfe-box damdfe-fisco"><span class="damdfe-lbl">CONTROLE DO FISCO</span><br>`
        + (barcode ? `<span class="damdfe-barcode">${barcode}</span><br>` : '')
        + `Chave de acesso:<br><span class="mono">${esc(temChave ? chaveDig : '-')}</span><br>${areaProtocolo}`
        + (qrSvg ? `<br><span class="damdfe-qr">${qrSvg}</span><br>Consulta de autenticidade no Portal Nacional do MDF-e` : '')
        + `</div>`;
    return `<div class="damdfe">`
        + `<div class="damdfe-row"><div class="damdfe-box"><span class="damdfe-lbl">IDENTIFICAÇÃO DO EMITENTE</span><div class="damdfe-emit">`
        + (logoSrc ? `<img class="damdfe-logo" src="${esc(logoSrc)}" alt="" onerror="this.remove()">` : '')
        + `<div><strong>${esc(emp.name || 'Empresa não informada')}</strong><br>${esc(endEmit || '-')}<br>`
        + `CNPJ: ${esc(emp.cnpj || '-')}${emp.ie ? ` &nbsp; IE: ${esc(emp.ie)}` : ''}<br>Fone: ${esc(emp.phone || '-')}</div></div></div>`
        + `<div class="damdfe-box damdfe-doc"><span class="t">DAMDFE</span><br>Documento Auxiliar do Manifesto Eletrônico de Documentos Fiscais<br>`
        + `Nº <strong>${esc(m.numero != null ? m.numero : '-')}</strong> · SÉRIE ${esc(m.serie != null ? m.serie : '-')}<br>`
        + `DATA DE EMISSÃO: ${dataEmissao}<br>MODAL: RODOVIÁRIO · EMISSÃO: ${formaEmissao}</div>`
        + fiscoBox + `</div>`
        + `<div class="damdfe-box"><table class="damdfe-tab"><thead><tr><th>QTD. NF-e</th><th>PESO BRUTO (kg)</th><th>VALOR TOTAL DA CARGA (R$)</th></tr></thead>`
        + `<tbody><tr><td>${docs.length}</td><td class="num">${pesoFmt(m.pesoTotal)}</td><td class="num">${moeda(m.valorTotal)}</td></tr></tbody></table></div>`
        + `<div class="damdfe-row"><div class="damdfe-box"><span class="damdfe-lbl">VEÍCULOS</span>`
        + `<table class="damdfe-tab"><thead><tr><th>PLACA</th><th>UF</th><th>RNTRC</th><th>RENAVAM</th></tr></thead>`
        + `<tbody><tr><td><strong>${esc(veiculo.placa || '-')}</strong></td><td>${esc(veiculo.uf || '-')}</td>`
        + `<td>${esc(veiculo.rntrc || '-')}</td><td>${esc(veiculo.renavam || '-')}</td></tr>`
        + (temReboque ? `<tr><td><strong>${esc(reb.placa)}</strong> (REBOQUE)</td><td>${esc(reb.uf || '-')}</td><td>-</td><td>-</td></tr>` : '')
        + `</tbody></table>`
        + `Tara: ${veiculo.tara != null && veiculo.tara !== '' ? `${esc(veiculo.tara)} kg` : '-'} · Capacidade: ${veiculo.capacidade != null && veiculo.capacidade !== '' ? `${esc(veiculo.capacidade)} kg` : '-'}</div>`
        + `<div class="damdfe-box"><span class="damdfe-lbl">CONDUTORES</span>`
        + `<table class="damdfe-tab"><thead><tr><th>CPF</th><th>NOME</th></tr></thead>`
        + `<tbody><tr><td>${esc(condutor.cpf || '-')}</td><td>${esc(condutor.nome || '-')}${condutor.cnh ? ` · CNH: ${esc(condutor.cnh)}` : ''}</td></tr></tbody></table></div></div>`
        + `<div class="damdfe-row"><div class="damdfe-box"><span class="damdfe-lbl">DADOS DO CIOT</span><br>CIOT: - · CPF/CNPJ: -</div>`
        + `<div class="damdfe-box"><span class="damdfe-lbl">INFORMAÇÕES DE VALE-PEDÁGIO</span><br>-</div></div>`
        + `<div class="damdfe-box"><span class="damdfe-lbl">PERCURSO</span><br>Rota: <strong>${esc(rota)}</strong><br>`
        + `Carregamento: ${esc(m.municipioCarregamento || '-')}/${esc(m.ufInicio || '-')}<br>Descarregamento: ${esc(m.municipioDescarregamento || '-')}/${esc(m.ufFim || '-')}</div>`
        + `<div class="damdfe-box"><span class="damdfe-lbl">INFORMAÇÕES DA COMPOSIÇÃO DA CARGA</span>`
        + `<table class="damdfe-tab"><thead><tr><th>Chave da NF-e</th><th>NF-e Nº/Série</th><th>Valor (R$)</th><th>Peso (kg)</th></tr></thead><tbody>${linhasDocs}</tbody></table></div>`
        + `<div class="damdfe-box"><span class="damdfe-lbl">INFORMAÇÕES SOBRE SEGUROS</span><br>Responsável: - · Seguradora: - · Apólice: -</div>`
        + `<div class="damdfe-box"><span class="damdfe-lbl">INFORMAÇÕES COMPLEMENTARES DE INTERESSE DO CONTRIBUINTE</span><br>${esc(m.observacoes || '-')}</div>`
        + `<div class="damdfe-box"><span class="damdfe-lbl">INFORMAÇÕES ADICIONAIS DE INTERESSE DO FISCO</span><br>-</div>`
        + `</div>`;
}

// Documento completo p/ impressão/PDF (nova aba — mesmo padrão do relatório).
function mdfeDamdfeDocumento(mdfe, empresa) {
    const css = `${mdfeDamdfeCss()}.damdfe{max-width:800px;margin:0 auto;}`
        + `@page{size:A4;margin:10mm;}`
        + `.sisweb-print-back{display:flex;gap:10px;align-items:center;justify-content:space-between;margin:0 0 14px;padding:10px 12px;border:1px solid #999;border-radius:6px;background:#f1f5f9;font-family:Arial,sans-serif;}`
        + `@media print{.sisweb-print-back{display:none !important;}}`;
    const voltar = `<div class="sisweb-print-back"><button type="button" onclick="try{window.close()}catch(e){}if(!window.closed){try{history.back()}catch(e2){}}" style="min-height:40px;padding:0 16px;border-radius:6px;font-weight:700;cursor:pointer;">&#8592; Voltar</button><button type="button" onclick="window.focus();window.print()" style="min-height:40px;padding:0 16px;border-radius:6px;font-weight:700;cursor:pointer;">Imprimir / Salvar PDF</button></div>`;
    return `<!doctype html><html lang="pt-BR"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1.0">`
        + `<title>DAMDFE ${escapeHtmlMdfe(mdfe && mdfe.numero != null ? String(mdfe.numero) : '')}</title><style>${css}</style></head>`
        + `<body>${voltar}<div class="damdfe-scope">${mdfeDamdfeConteudo(mdfe, empresa)}</div></body></html>`;
}

// Preview em modal (paridade com o modal de detalhes da NF-e/MDF-e)
async function mdfeAbrirPreviewDamdfe(mdfe) {
    let empresa = {};
    try { empresa = await obterDadosEmpresaMdfe(); } catch (_) {}
    try { empresa.logoSrc = await mdfeResolverLogoEmpresa(empresa); } catch (_) {}
    const conteudo = mdfeDamdfeConteudo(mdfe, empresa);
    try { document.getElementById('mdfeStatusDetalheModal')?.remove(); } catch (_) {}
    const ov = document.createElement('div');
    ov.id = 'mdfeStatusDetalheModal';
    ov.style.cssText = 'position:fixed;inset:0;z-index:10000002;background:rgba(15,23,42,.55);display:flex;align-items:center;justify-content:center;padding:16px;';
    const box = document.createElement('div');
    box.setAttribute('role', 'dialog'); box.setAttribute('aria-modal', 'true');
    box.style.cssText = 'background:#fff;color:#000;border-radius:12px;box-shadow:0 12px 40px rgba(0,0,0,.35);max-width:820px;width:100%;padding:20px;max-height:88vh;overflow:auto;';
    const h = document.createElement('h3');
    h.textContent = `MDF-e ${mdfe && mdfe.numero != null ? mdfe.numero : ''} — Pré-visualização do DAMDFE`;
    h.style.cssText = 'margin:0 0 12px;font-size:16px;font-family:Arial,sans-serif;';
    box.appendChild(h);
    const css = document.createElement('style');
    css.textContent = mdfeDamdfeCss();
    box.appendChild(css);
    const body = document.createElement('div');
    body.className = 'damdfe-scope';
    body.innerHTML = conteudo;
    box.appendChild(body);
    const footer = document.createElement('div');
    footer.style.cssText = 'margin-top:16px;display:flex;gap:8px;flex-wrap:wrap;font-family:Arial,sans-serif;';
    const btnPrint = document.createElement('button');
    btnPrint.type = 'button'; btnPrint.textContent = '🖨️ Imprimir / PDF';
    btnPrint.style.cssText = 'padding:9px 16px;border:0;border-radius:8px;background:#2563eb;color:#fff;font-weight:600;cursor:pointer;';
    btnPrint.onclick = () => { try { ov.remove(); } catch (_) {} abrirDamdfeImpressao(mdfe && mdfe.id); };
    footer.appendChild(btnPrint);
    const btn = document.createElement('button');
    btn.type = 'button'; btn.textContent = 'Fechar';
    btn.style.cssText = 'padding:9px 16px;border:0;border-radius:8px;background:#e2e8f0;color:#0f172a;font-weight:600;cursor:pointer;';
    btn.onclick = () => ov.remove();
    footer.appendChild(btn);
    box.appendChild(footer);
    ov.appendChild(box);
    ov.addEventListener('click', (e) => { if (e.target === ov) ov.remove(); });
    document.body.appendChild(ov);
    try { btn.focus(); } catch (_) {}
}

// Abrir DAMDFE em nova aba p/ Imprimir/Salvar PDF (paridade com o DANFE da NF-e)
async function abrirDamdfeImpressao(id) {
    const mdfe = mdfes.find(m => String(m.id) === String(id));
    if (!mdfe) { notifyUser('MDF-e não encontrado'); return; }
    let empresa = {};
    try { empresa = await obterDadosEmpresaMdfe(); } catch (_) {}
    try { empresa.logoSrc = await mdfeResolverLogoEmpresa(empresa); } catch (_) {}
    let novaJanela = null;
    try {
        novaJanela = window.open('', '_blank');
    } catch (_) {
        novaJanela = null;
    }
    if (!novaJanela || novaJanela.closed === true) {
        notifyUser('Falha ao abrir janela de impressão. Verifique se os pop-ups estão permitidos.');
        return;
    }
    try {
        novaJanela.document.open();
        novaJanela.document.write(mdfeDamdfeDocumento(mdfe, empresa));
        novaJanela.document.close();
    } catch (_) {
        notifyUser('Falha ao preparar documento de impressão.');
        return;
    }
    try { novaJanela.focus(); } catch (_) {}
}

// ─── Preenche o formulário a partir de um registro (editar/clonar — DRY) ──
function __mdfePreencherFormularioDoRegistro(mdfe) {
    const veiculoEdit = mdfe.veiculo || {};
    const condutorEdit = mdfe.condutor || {};
    document.getElementById('mdfeNumero').value = mdfe.numero || '';
    document.getElementById('mdfeSerie').value = mdfe.serie || '';
    document.getElementById('mdfeDataEmissao').value = mdfe.dataEmissao || '';
    document.getElementById('mdfeUfInicio').value = mdfe.ufInicio || '';
    document.getElementById('percursoUfFim').value = mdfe.ufFim || '';
    // Cidades via IBGE por UF (selects; popularCidades preenche + seleciona).
    // Sem a lib de cidades, cai no .value direto (inputs legados).
    if (typeof popularCidades === 'function') {
        try {
            popularCidades('percursoMunicipioCarregamento', mdfe.ufInicio || '', mdfe.municipioCarregamento || '');
            popularCidades('percursoMunicipioDescarregamento', mdfe.ufFim || '', mdfe.municipioDescarregamento || '');
        } catch (_) {}
    } else {
        try {
            document.getElementById('percursoMunicipioCarregamento').value = mdfe.municipioCarregamento || '';
            document.getElementById('percursoMunicipioDescarregamento').value = mdfe.municipioDescarregamento || '';
        } catch (_) {}
    }
    document.getElementById('veiculoPlaca').value = veiculoEdit.placa || '';
    try { const ufEl = document.getElementById('veiculoUf'); if (ufEl) ufEl.value = veiculoEdit.uf || ''; } catch (_) {}
    try { const rnEl = document.getElementById('veiculoRntrc'); if (rnEl) rnEl.value = veiculoEdit.rntrc || ''; } catch (_) {}
    document.getElementById('veiculoRenavam').value = veiculoEdit.renavam || '';
    document.getElementById('veiculoTara').value = veiculoEdit.tara != null ? veiculoEdit.tara : '';
    document.getElementById('veiculoCapacidade').value = veiculoEdit.capacidade != null ? veiculoEdit.capacidade : '';
    try {
        const reb = mdfe.reboque && typeof mdfe.reboque === 'object' ? mdfe.reboque : {};
        const rpEl = document.getElementById('reboquePlaca'); if (rpEl) rpEl.value = reb.placa || '';
        const ruEl = document.getElementById('reboqueUf'); if (ruEl) ruEl.value = reb.uf || '';
    } catch (_) {}
    document.getElementById('condutorNome').value = condutorEdit.nome || '';
    document.getElementById('condutorCpf').value = condutorEdit.cpf || '';
    document.getElementById('condutorCnh').value = condutorEdit.cnh || '';
    document.getElementById('mdfeObservacoes').value = mdfe.observacoes || '';
    try {
        const tpEl = document.getElementById('mdfeTpEmit');
        if (tpEl && (mdfe.tpEmit === 1 || mdfe.tpEmit === 2)) tpEl.value = String(mdfe.tpEmit);
    } catch (_) {}
    try {
        const percEl = document.getElementById('mdfePercursoUfs');
        if (percEl) {
            percEl.value = Array.isArray(mdfe.percursoUfs)
                ? mdfe.percursoUfs.join(', ')
                : String(mdfe.percursoUfs || '');
        }
    } catch (_) {}
    documentosFiscais = Array.isArray(mdfe.documentos) ? mdfe.documentos.map((d) => ({ ...d })) : [];
    atualizarListaDocumentos();
}

// Editar MDF-e (apenas rascunho)
function editarMdfe(id) {
    const mdfe = mdfes.find(m => m.id === id);
    if (!mdfe || mdfe.status !== 'rascunho') {
        notifyUser('Apenas rascunhos podem ser editados');
        return;
    }
    __mdfePreencherFormularioDoRegistro(mdfe);
    mdfeEditando = id;
    showTab('emissao');
    notifyUser('MDF-e carregado para edição');
}

// Clonar MDF-e: abre um NOVO MDF-e (sem vínculo SEFAZ) com os mesmos dados —
// documentos, percurso, veículo, condutor e observações; número novo é
// reservado na emissão. Serve para repetir a carga sem redigitar.
function clonarMdfe(id) {
    const mdfe = mdfes.find(m => m.id === id);
    if (!mdfe) { notifyUser('MDF-e não encontrado'); return; }
    __mdfePreencherFormularioDoRegistro(mdfe);
    mdfeEditando = null;
    // Recalcula (contador pode estar desatualizado — outra aba/sessão emitiu).
    try { definirProximoNumeroMdfe(); } catch (_) {}
    document.getElementById('mdfeNumero').value = numeroAtualMdfe.toString().padStart(9, '0');
    const agora = new Date();
    const dataHoraLocal = new Date(agora.getTime() - agora.getTimezoneOffset() * 60000).toISOString().slice(0, 16);
    document.getElementById('mdfeDataEmissao').value = dataHoraLocal;
    mdfeOcultarAlertaMdfe();
    showTab('emissao');
    notifyUser(`MDF-e ${mdfe.numero || ''} clonado — confira os dados e emita um novo.`);
}

// Excluir MDF-e: somente registros SEM vínculo fiscal na SEFAZ (sem protocolo
// de autorização/encerramento). Autorizado/encerrado NUNCA são excluídos.
async function excluirMdfe(id) {
    const mdfe = mdfes.find(m => m.id === id);
    if (!mdfe) { notifyUser('MDF-e não encontrado'); return; }
    const permitidos = ['rascunho', 'rejeitado', 'erro_envio', 'erro_encerramento'];
    if (!permitidos.includes(String(mdfe.status))) {
        notifyUser('Somente rascunho/rejeitado/erro podem ser excluídos (documento autorizado é fiscal).');
        return;
    }
    const ok = (typeof confirmDialog === 'function')
        ? await confirmDialog({ title: 'Excluir MDF-e', message: `Excluir o MDF-e ${mdfe.numero || ''}? Esta ação não pode ser desfeita.`, danger: true, confirmLabel: 'Excluir' })
        : true;
    if (!ok) return;
    try {
        try { if (window.SiswebLoading?.show) window.SiswebLoading.show('Excluindo MDF-e...'); } catch (_) {}
        const svc = window.firebaseService;
        if (!tenantIdMdfe || typeof svc?.removeFromFirebase !== 'function') throw new Error('Firebase não está pronto para excluir o MDF-e.');
        const res = await svc.removeFromFirebase(`companies/${tenantIdMdfe}/fiscal/mdfe/${id}`);
        if (res && res.success === false) throw new Error(res.error || 'Falha ao excluir no servidor.');
        try { svc.invalidateReadCacheForPath?.(`companies/${tenantIdMdfe}/fiscal/mdfe`); } catch (_) {}
        mdfes = mdfes.filter(m => m.id !== id);
        if (mdfeEditando === id) { mdfeEditando = null; limparFormularioMdfe(); }
        consultarMdfes();
        atualizarDashboard();
        notifyUser('MDF-e excluído.');
    } catch (e) {
        console.error('❌ Erro ao excluir MDF-e:', e);
        notifyUser(`Não foi possível excluir o MDF-e: ${e.message}`);
    } finally {
        try { if (window.SiswebLoading?.hide) window.SiswebLoading.hide(); } catch (_) {}
    }
}

// Atualizar dashboard
function atualizarDashboard() {
    const totalEmitidos = mdfes.length;
    const totalAutorizados = mdfes.filter(m => m.status === 'autorizado').length;
    const totalEncerrados = mdfes.filter(m => m.status === 'encerrado').length;
    const viagensAtivas = mdfes.filter(m => m.status === 'autorizado').length;
    
    const _elMdfEmitidos = document.getElementById('totalMdfesEmitidos');
    const _elMdfAutorizados = document.getElementById('totalMdfesAutorizados');
    const _elMdfEncerrados = document.getElementById('totalMdfesEncerrados');
    const _elViagensAtivas = document.getElementById('totalViagensAtivas');
    if (_elMdfEmitidos) _elMdfEmitidos.textContent = totalEmitidos;
    if (_elMdfAutorizados) _elMdfAutorizados.textContent = totalAutorizados;
    if (_elMdfEncerrados) _elMdfEncerrados.textContent = totalEncerrados;
    if (_elViagensAtivas) _elViagensAtivas.textContent = viagensAtivas;
}

// Gerar relatório
async function gerarRelatorioMdfe() {
    const dataInicio = document.getElementById('relMdfePeriodoInicio').value;
    const dataFim = document.getElementById('relMdfePeriodoFim').value;
    
    if (!dataInicio || !dataFim) {
        notifyUser('Selecione o período para o relatório');
        return;
    }
    
    const mdfesRelatorio = mdfes.filter(mdfe => {
        const dataEmissao = mdfe.dataEmissao.split('T')[0];
        return dataEmissao >= dataInicio && dataEmissao <= dataFim;
    });
    
    if (mdfesRelatorio.length === 0) {
        notifyUser('Nenhum MDF-e encontrado no período selecionado');
        return;
    }
    
    const empresa = await obterDadosEmpresaMdfe();

    // Gerar relatório simples
    let relatorio = `${empresa.name}\n`;
    relatorio += `CNPJ: ${empresa.cnpj}\n`;
    relatorio += `${empresa.address} - ${empresa.city}/${empresa.state}\n`;
    relatorio += `Fone: ${empresa.phone}\n\n`;
    relatorio += `RELATÓRIO MDF-e - ${formatarData(dataInicio)} a ${formatarData(dataFim)}\n\n`;
    relatorio += `Total de MDF-es: ${mdfesRelatorio.length}\n`;
    relatorio += `Autorizados: ${mdfesRelatorio.filter(m => m.status === 'autorizado').length}\n`;
    relatorio += `Encerrados: ${mdfesRelatorio.filter(m => m.status === 'encerrado').length}\n`;
    relatorio += `Rascunhos: ${mdfesRelatorio.filter(m => m.status === 'rascunho').length}\n\n`;
    
    const valorTotal = mdfesRelatorio.reduce((total, mdfe) => total + (mdfe.valorTotal || 0), 0);
    const pesoTotal = mdfesRelatorio.reduce((total, mdfe) => total + (mdfe.pesoTotal || 0), 0);
    
    relatorio += `Valor Total: R$ ${valorTotal.toLocaleString('pt-BR', {minimumFractionDigits: 2})}\n`;
    relatorio += `Peso Total: ${pesoTotal.toLocaleString('pt-BR', {minimumFractionDigits: 3})} kg\n\n`;
    
    relatorio += 'DETALHAMENTO:\n';
    mdfesRelatorio.forEach(mdfe => {
        relatorio += `${mdfe.numero || '-'} - ${mdfe.veiculo?.placa || '-'} - ${String(mdfe.status || '').toUpperCase()}\n`;
    });
    
    // Exibir relatório (MOBILE: valida alvo parcial + Voltar; mantém Imprimir manual)
    let novaJanela = null;
    try {
        novaJanela = window.open('', '_blank');
    } catch (_) {
        novaJanela = null;
    }
    if (!novaJanela || novaJanela.closed === true) {
        notifyUser('Falha ao abrir janela de impressão. Verifique se os pop-ups estão permitidos.');
        return;
    }
    try {
        if (!novaJanela.document) throw new Error('alvo parcial');
    } catch (_) {
        notifyUser('Impressão bloqueada no mobile. Permita popups para imprimir.');
        try { if (!novaJanela.closed) novaJanela.close(); } catch (_) {}
        return;
    }
    try {
        novaJanela.document.open();
        novaJanela.document.write(`
        <!doctype html>
        <html lang="pt-BR">
            <head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"><title>Relatório MDF-e</title><style>.sisweb-print-back{display:flex;gap:10px;align-items:center;justify-content:space-between;margin:0 0 14px;padding:10px 12px;border:1px solid var(--sw-border);border-radius:6px;background:var(--sw-surface-2);font-family:Arial,sans-serif;}@media print{.sisweb-print-back{display:none !important;}}</style></head>
            <body>
                <div class="sisweb-print-back"><button type="button" onclick="try{window.close()}catch(e){}if(!window.closed){try{history.back()}catch(e2){}}" style="min-height:40px;padding:0 16px;border-radius:6px;border:1px solid var(--sw-input-border);background:var(--sw-input-bg);font-weight:700;cursor:pointer;">&#8592; Voltar</button><button type="button" onclick="window.focus();window.print()" style="min-height:40px;padding:0 16px;border-radius:6px;border:1px solid var(--sw-brand);background:var(--sw-brand);color:var(--sw-on-brand);font-weight:700;cursor:pointer;">Imprimir</button></div>
                <pre style="font-family: monospace; white-space: pre-wrap;">${escapeHtmlMdfe(relatorio)}</pre>
            </body>
        </html>
    `);
        novaJanela.document.close();
    } catch (_) {
        notifyUser('Falha ao preparar documento de impressão.');
        return;
    }
    try { novaJanela.focus(); } catch (_) {}
    
    console.log('📊 Relatório gerado:', mdfesRelatorio.length, 'MDF-es');
}

// Salvar dados
async function salvarDados(mdfe) {
    const svc = window.firebaseService;
    if (!tenantIdMdfe || !svc || typeof svc.saveToFirebase !== 'function') {
        throw new Error('Firebase não está pronto para persistir o MDF-e.');
    }
    if (!mdfe || !mdfe.id) throw new Error('MDF-e sem identificador.');

    const now = new Date().toISOString();
    const payload = {
        ...mdfe,
        id: String(mdfe.id),
        tenantId: tenantIdMdfe,
        createdAt: mdfe.createdAt || now,
        updatedAt: now
    };
    const result = await svc.saveToFirebase(`companies/${tenantIdMdfe}/fiscal/mdfe`, payload.id, payload);
    if (!result || result.success === false) throw new Error(result?.error || 'Falha ao salvar MDF-e.');
}

async function consultarMdfeFiscal(id) {
    const mdfe = mdfes.find((item) => item.id === id);
    if (!mdfe || !mdfe.chaveAcesso) return;
    // Senha no modal central (padrão NF-e/Consultar SEFAZ)
    const senhaA1 = await mdfeSolicitarSenhaA1({
        message: 'Informe a senha do certificado A1 para consultar o MDF-e na SEFAZ.',
        confirmLabel: 'Consultar',
    });
    if (!senhaA1) return;

    try {
        try { if (window.SiswebLoading?.show) window.SiswebLoading.show('Consultando o MDF-e na SEFAZ...'); } catch (_) {}
        mdfeMostrarAlerta('⏳ Consultando o MDF-e na SEFAZ — aguardando retorno...', 'warn');
        const result = await window.firebaseService.callFunction('mdfe_consultar', {
            tenantId: tenantIdMdfe,
            mdfeId: mdfe.id,
            chave: mdfe.chaveAcesso,
            senhaA1,
            // Usa o ambiente gravado no próprio MDF-e na emissão; só cai no
            // select (padrão homologacao) quando não houver ambiente salvo,
            // evitando consultar Produção em Homologação (cStat 101) e vice-versa.
            ambiente: (mdfe && mdfe.ambiente) || document.getElementById('mdfeAmbiente')?.value || 'homologacao',
        });
        // Verdade da consulta (não o cStat do último EVENTO): situação real
        const situacaoTxt = {
            encerrado: 'ENCERRADO (evento 110112 registrado na SEFAZ)',
            cancelado: 'CANCELADO (evento 110111 registrado na SEFAZ)',
            autorizado: 'AUTORIZADO (ainda não encerrado)',
            nao_encontrado: 'NÃO CONSTA / NÃO AUTORIZADO na base da SEFAZ',
            indefinida: 'INDEFINIDA (veja cStat/motivo)',
        }[result?.situacao] || 'INDEFINIDA (veja cStat/motivo)';
        mdfe.ultimaConsultaSefaz = result?.ultimaConsultaSefaz || { cStat: result?.cStat, xMotivo: result?.xMotivo, situacao: result?.situacao, em: new Date().toISOString() };
        if (result?.situacao === 'encerrado') mdfe.status = 'encerrado';
        else if (result?.situacao === 'cancelado') mdfe.status = 'cancelado';
        else if (result?.situacao === 'autorizado') mdfe.status = 'autorizado';
        mdfe.protocolo = result?.protocolo || mdfe.protocolo || '';
        const tipo = ['encerrado', 'autorizado'].includes(result?.situacao) ? 'ok' : 'warn';
        // Quando a SEFAZ não confirma o documento (216/217/999 etc.), a consulta
        // NÃO sobrescreve o cStat/xMotivo do documento. Exibimos também o último
        // resultado do envio (ex.: rejeição 677) para não induzir a leitura errada.
        const consultaNaoConfirma = ['nao_encontrado', 'indefinida'].includes(result?.situacao);
        const docStatusTxt = String(mdfe.status || '').toUpperCase();
        const docCStat = String(mdfe.cStat || '').trim();
        const docMotivo = String(mdfe.xMotivo || '').trim();
        const linhaDocumento = (consultaNaoConfirma && docCStat)
            ? `\nDocumento (último envio): ${docStatusTxt || '—'} — cStat ${docCStat}${docMotivo ? ` — ${docMotivo}` : ''}`
            : '';
        mdfeMostrarAlerta(`MDF-e Nº ${mdfe.numero || ''} — Consulta SEFAZ: cStat ${result?.cStat || '?'} — ${result?.xMotivo || 'sem motivo'}\nSituação real: ${situacaoTxt}${linhaDocumento}`, tipo);
        consultarMdfes();
    } catch (error) {
        console.error('❌ Erro ao consultar MDF-e:', error);
        mdfeMostrarAlerta(`Não foi possível consultar o MDF-e: ${error.message}`, 'erro');
    } finally {
        try { if (window.SiswebLoading?.hide) window.SiswebLoading.hide(); } catch (_) {}
    }
}

// Funções utilitárias
function gerarId() {
    return Date.now().toString(36) + Math.random().toString(36).substr(2);
}

function formatarCPF(cpf) {
    cpf = cpf.replace(/\D/g, '');
    cpf = cpf.replace(/(\d{3})(\d)/, '$1.$2');
    cpf = cpf.replace(/(\d{3})(\d)/, '$1.$2');
    cpf = cpf.replace(/(\d{3})(\d{1,2})$/, '$1-$2');
    return cpf;
}

function formatarMoeda(valor) {
    valor = valor.replace(/\D/g, '');
    valor = (valor / 100).toFixed(2) + '';
    valor = valor.replace('.', ',');
    valor = valor.replace(/(\d)(?=(\d{3})+(?!\d))/g, '$1.');
    return 'R$ ' + valor;
}

function formatarData(data) {
    return new Date(data + 'T00:00:00').toLocaleDateString('pt-BR');
}

function formatarDataHora(dataHora) {
    return new Date(dataHora).toLocaleString('pt-BR');
}

// Expor funções globalmente para uso no HTML
window.showTab = showTab;
window.adicionarDocumento = adicionarDocumento;
window.removerDocumento = removerDocumento;
window.salvarRascunhoMdfe = salvarRascunhoMdfe;
window.emitirMdfe = emitirMdfe;
window.limparFormularioMdfe = limparFormularioMdfe;
window.consultarMdfes = consultarMdfes;
window.visualizarMdfe = visualizarMdfe;
window.abrirDamdfeImpressao = abrirDamdfeImpressao;
window.editarMdfe = editarMdfe;
window.encerrarMdfe = encerrarMdfe;
window.mdfeSincronizarEncerramento = mdfeSincronizarEncerramento;
window.encerrarMdfeRapido = encerrarMdfeRapido;
window.cancelarMdfe = cancelarMdfe;
window.consultarMdfeFiscal = consultarMdfeFiscal;
window.gerarRelatorioMdfe = gerarRelatorioMdfe;
window.mdfeMostrarDetalheStatus = mdfeMostrarDetalheStatus;
window.mdfeConsultaSetPageSize = mdfeConsultaSetPageSize;
window.mdfeConsultaMudarPagina = mdfeConsultaMudarPagina;
window.clonarMdfe = clonarMdfe;
window.excluirMdfe = excluirMdfe;
window.abrirImportacaoNFe = abrirImportacaoNFe;
window.fecharImportacaoNFe = fecharImportacaoNFe;
window.filtrarImportacaoNFe = filtrarImportacaoNFe;
window.alternarSelecaoImportacaoNFe = alternarSelecaoImportacaoNFe;
window.selecionarTodasImportacaoNFe = selecionarTodasImportacaoNFe;
window.confirmarImportacaoNFe = confirmarImportacaoNFe;
// Helpers puros da importação (testados em tests/mdfe-importacao-nfe.test.mjs).
window.__mdfeImportInternals = {
    mdfeDigits,
    mdfePesoDaNota,
    mdfeNormalizarNFeImportacao,
    mdfeSomarImportacao,
    mdfeResumoImportacao,
};
// DAMDFE + ordenação da Consulta (testados em tests/mdfe-damdfe.test.mjs).
window.__mdfeDamdfeInternals = {
    mdfeOrdenarPorNumeroDesc,
    mdfeQrCodeMDFe,
    mdfeCodigoBarrasSvg,
    mdfeQrSvg,
    mdfeDamdfeCss,
    mdfeDamdfeConteudo,
    mdfeDamdfeDocumento,
    mdfeResolverLogoEmpresa,
    mdfeNormalizeLogo,
    normalizeCompanyForMdfeReport,
    obterDadosEmpresaMdfe,
};

console.log('🚛 Sistema MDF-e carregado com sucesso!'); 
