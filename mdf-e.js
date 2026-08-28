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
    return {
        name,
        cnpj: src.cnpj || configuracoesMdfe.cnpjEmitente || '-',
        address: address || '-',
        city: src.cidade || src.city || src.municipio || enderecoObj.municipio || '-',
        state: src.estado || src.state || src.uf || enderecoObj.uf || configuracoesMdfe.ufEmitente || '-',
        phone: src.telefone || src.phone || '-'
    };
}

async function obterDadosEmpresaMdfe() {
    try {
        const svc = window.firebaseService || window.firebaseServiceTL || window.FirebaseService;
        if (svc && typeof svc.getCompanyProfileForReport === 'function') {
            const central = await svc.getCompanyProfileForReport();
            const data = central && central.success !== false ? (central.data || central) : null;
            if (data && typeof data === 'object') return normalizeCompanyForMdfeReport(data);
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

function escapeHtmlMdfe(value) {
    return String(value || '')
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
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
    });
    
    console.log('✅ Sistema MDF-e inicializado com sucesso');
});

// Carregar dados do tenant autenticado no Firebase
async function carregarDados() {
    try {
        const svc = window.firebaseService;
        if (!svc || typeof svc.resolveAuthenticatedTenant !== 'function' || typeof svc.loadFromFirebase !== 'function') {
            throw new Error('Serviço Firebase do MDF-e indisponível.');
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
        
    } catch (error) {
        console.error('❌ Erro ao carregar dados:', error);
        mdfes = [];
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
        alert('Por favor, informe uma chave de NF-e válida (44 dígitos)');
        return;
    }
    
    if (!valor || parseFloat(valor.replace(/[^\d,]/g, '').replace(',', '.')) <= 0) {
        alert('Por favor, informe um valor válido');
        return;
    }
    
    if (peso <= 0) {
        alert('Por favor, informe um peso válido');
        return;
    }
    
    // Verificar se já existe
    const jaExiste = documentosFiscais.some(doc => doc.chave === chave);
    if (jaExiste) {
        alert('Esta NF-e já foi adicionada');
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
function removerDocumento(id) {
    if (confirm('Deseja remover este documento?')) {
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
        await salvarDados(payload);
        if (index !== -1) mdfes[index] = payload;
        else mdfes.push(payload);
        alert('Rascunho salvo com sucesso!');
    } catch (error) {
        console.error('❌ Erro ao salvar rascunho MDF-e:', error);
        alert(`Não foi possível salvar o rascunho: ${error.message}`);
        return;
    }
    
    console.log('💾 Rascunho salvo:', dadosMdfe);
}

// Emitir MDF-e
async function emitirMdfe() {
    const dadosMdfe = coletarDadosFormulario();
    if (!dadosMdfe) return;
    
    if (documentosFiscais.length === 0) {
        alert('É necessário adicionar pelo menos um documento fiscal');
        return;
    }
    
    const index = mdfeEditando ? mdfes.findIndex(m => m.id === mdfeEditando) : -1;
    const payload = index !== -1
        ? { ...mdfes[index], ...dadosMdfe }
        : { ...dadosMdfe, id: gerarId(), numero: numeroAtualMdfe.toString().padStart(9, '0') };

    try {
        const svc = window.firebaseService;
        if (!tenantIdMdfe || typeof svc?.callFunction !== 'function') throw new Error('Cloud Functions fiscais indisponíveis.');
        if (!window.MdfeXmlBuilder?.buildMdfe) throw new Error('Gerador XML MDF-e indisponível.');
        const senhaA1 = document.getElementById('mdfeSenhaA1')?.value || '';
        const ambiente = document.getElementById('mdfeAmbiente')?.value || 'homologacao';
        if (!senhaA1) throw new Error('Informe a senha do certificado A1.');

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
            alert(`MDF-e rejeitado: ${result?.xMotivo || 'retorno sem autorização'}`);
            return;
        }
        alert('MDF-e autorizado com sucesso!\nProtocolo: ' + (payload.protocolo || 'não informado'));
    } catch (error) {
        console.error('❌ Erro ao salvar MDF-e:', error);
        alert(`Não foi possível salvar o MDF-e: ${error.message}`);
        return;
    }
    
    limparFormularioMdfe();
    definirProximoNumeroMdfe();
    atualizarDashboard();
    
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
            ufInicio: document.getElementById('mdfeUfInicio').value,
            ufFim: document.getElementById('percursoUfFim').value,
            municipioCarregamento: document.getElementById('percursoMunicipioCarregamento').value,
            municipioDescarregamento: document.getElementById('percursoMunicipioDescarregamento').value,
            veiculo: {
                placa: document.getElementById('veiculoPlaca').value,
                renavam: document.getElementById('veiculoRenavam').value,
                tara: parseFloat(document.getElementById('veiculoTara').value) || 0,
                capacidade: parseFloat(document.getElementById('veiculoCapacidade').value) || 0
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
            alert('Por favor, selecione as UFs de início e fim');
            return null;
        }
        
        if (!dados.municipioCarregamento || !dados.municipioDescarregamento) {
            alert('Por favor, informe os municípios de carregamento e descarregamento');
            return null;
        }
        
        if (!dados.veiculo.placa || !dados.veiculo.renavam) {
            alert('Por favor, informe os dados do veículo');
            return null;
        }
        
        if (!dados.condutor.nome || !dados.condutor.cpf || !dados.condutor.cnh) {
            alert('Por favor, informe os dados do condutor');
            return null;
        }
        
        return dados;
        
    } catch (error) {
        console.error('❌ Erro ao coletar dados:', error);
        alert('Erro ao processar dados do formulário');
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
function consultarMdfes() {
    const busca = document.getElementById('searchMdfe').value.toLowerCase();
    const statusFiltro = document.getElementById('filterStatusMdfe').value;
    
    let mdfeFiltrados = mdfes;
    
    // Filtrar por busca
    if (busca) {
        mdfeFiltrados = mdfeFiltrados.filter(mdfe => 
            mdfe.numero.toLowerCase().includes(busca) ||
            mdfe.veiculo.placa.toLowerCase().includes(busca) ||
            mdfe.condutor.nome.toLowerCase().includes(busca)
        );
    }
    
    // Filtrar por status
    if (statusFiltro) {
        mdfeFiltrados = mdfeFiltrados.filter(mdfe => mdfe.status === statusFiltro);
    }
    
    atualizarTabelaMdfes(mdfeFiltrados);
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
            <td data-label="Status"><span class="status-badge status-${escapeHtmlMdfe(mdfe.status)}">${escapeHtmlMdfe(String(mdfe.status).toUpperCase())}</span></td>
            <td data-label="Ações">
                <div class="mdfe-actions">
                <button type="button" onclick="visualizarMdfe('${escapeHtmlMdfe(mdfe.id)}')" class="btn btn-primary btn-small" title="Visualizar" aria-label="Visualizar MDF-e">
                    <i class="fas fa-eye"></i>
                </button>
                ${mdfe.status === 'autorizado' ? `
                    <button type="button" onclick="encerrarMdfeRapido('${escapeHtmlMdfe(mdfe.id)}')" class="btn btn-warning btn-small" title="Encerrar" aria-label="Encerrar MDF-e">
                        <i class="fas fa-check"></i>
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
        option.textContent = `${mdfe.numero} - ${mdfe.veiculo.placa} - ${mdfe.condutor.nome}`;
        select.appendChild(option);
    });
}

// Encerrar MDF-e
async function encerrarMdfe() {
    const mdfeId = document.getElementById('mdfeEncerramento').value;
    const dataEncerramento = document.getElementById('dataEncerramento').value;
    const municipioEncerramento = document.getElementById('municipioEncerramento').value;
    
    if (!mdfeId) {
        alert('Selecione um MDF-e para encerrar');
        return;
    }
    
    if (!dataEncerramento) {
        alert('Informe a data/hora de encerramento');
        return;
    }
    
    if (!municipioEncerramento) {
        alert('Informe o município de encerramento');
        return;
    }
    
    const mdfe = mdfes.find(m => m.id === mdfeId);
    if (!mdfe) {
        alert('MDF-e não encontrado');
        return;
    }
    
    try {
        const senhaA1 = document.getElementById('mdfeSenhaA1Encerramento')?.value || '';
        if (!senhaA1) throw new Error('Informe a senha do certificado A1.');
        const cMunEnc = await resolverCodigoMunicipio(mdfe.ufFim, municipioEncerramento);
        const result = await window.firebaseService.callFunction('mdfe_encerrar', {
            tenantId: tenantIdMdfe,
            mdfeId: mdfe.id,
            chave: mdfe.chaveAcesso,
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
        alert(`Não foi possível salvar o encerramento: ${error.message}`);
        return;
    }
    alert('MDF-e encerrado com sucesso!\nProtocolo: ' + mdfe.protocoloEncerramento);
    
    // Limpar formulário
    document.getElementById('mdfeEncerramento').value = '';
    document.getElementById('municipioEncerramento').value = '';
    document.getElementById('protocoloEncerramento').value = '';
    
    atualizarDashboard();
    carregarMdfesParaEncerramento();
    
    console.log('🏁 MDF-e encerrado:', mdfe);
}

// Encerrar MDF-e rapidamente
async function encerrarMdfeRapido(id) {
    const municipio = prompt('Informe o município de encerramento:');
    if (!municipio) return;
    
    const mdfe = mdfes.find(m => m.id === id);
    if (!mdfe) return;
    
    try {
        const senhaA1 = window.prompt('Informe a senha do certificado A1:');
        if (!senhaA1) return;
        const cMunEnc = await resolverCodigoMunicipio(mdfe.ufFim, municipio);
        const result = await window.firebaseService.callFunction('mdfe_encerrar', {
            tenantId: tenantIdMdfe,
            mdfeId: mdfe.id,
            chave: mdfe.chaveAcesso,
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
        alert(`Não foi possível salvar o encerramento: ${error.message}`);
        return;
    }
    alert('MDF-e encerrado com sucesso!');
    
    consultarMdfes();
    atualizarDashboard();
}

// Visualizar MDF-e
function visualizarMdfe(id) {
    const mdfe = mdfes.find(m => m.id === id);
    if (!mdfe) return;
    
    let detalhes = `
        MDF-e Nº: ${mdfe.numero}/${mdfe.serie}
        Status: ${mdfe.status.toUpperCase()}
        Data Emissão: ${formatarDataHora(mdfe.dataEmissao)}
        
        PERCURSO:
        ${mdfe.ufInicio} → ${mdfe.ufFim}
        Carregamento: ${mdfe.municipioCarregamento}
        Descarregamento: ${mdfe.municipioDescarregamento}
        
        VEÍCULO:
        Placa: ${mdfe.veiculo.placa}
        RENAVAM: ${mdfe.veiculo.renavam}
        Tara: ${mdfe.veiculo.tara} kg
        Capacidade: ${mdfe.veiculo.capacidade} kg
        
        CONDUTOR:
        Nome: ${mdfe.condutor.nome}
        CPF: ${mdfe.condutor.cpf}
        CNH: ${mdfe.condutor.cnh}
        
        DOCUMENTOS: ${mdfe.documentos.length} NF-e(s)
        Valor Total: R$ ${mdfe.valorTotal.toLocaleString('pt-BR', {minimumFractionDigits: 2})}
        Peso Total: ${mdfe.pesoTotal.toLocaleString('pt-BR', {minimumFractionDigits: 3})} kg
    `;
    
    if (mdfe.protocolo) {
        detalhes += `\nProtocolo: ${mdfe.protocolo}`;
    }
    
    if (mdfe.chaveAcesso) {
        detalhes += `\nChave: ${mdfe.chaveAcesso}`;
    }
    
    if (mdfe.observacoes) {
        detalhes += `\nObservações: ${mdfe.observacoes}`;
    }
    
    alert(detalhes);
}

// Editar MDF-e
function editarMdfe(id) {
    const mdfe = mdfes.find(m => m.id === id);
    if (!mdfe || mdfe.status !== 'rascunho') {
        alert('Apenas rascunhos podem ser editados');
        return;
    }
    
    // Preencher formulário
    document.getElementById('mdfeNumero').value = mdfe.numero;
    document.getElementById('mdfeSerie').value = mdfe.serie;
    document.getElementById('mdfeDataEmissao').value = mdfe.dataEmissao;
    document.getElementById('mdfeUfInicio').value = mdfe.ufInicio;
    document.getElementById('percursoUfFim').value = mdfe.ufFim;
    document.getElementById('percursoMunicipioCarregamento').value = mdfe.municipioCarregamento;
    document.getElementById('percursoMunicipioDescarregamento').value = mdfe.municipioDescarregamento;
    document.getElementById('veiculoPlaca').value = mdfe.veiculo.placa;
    document.getElementById('veiculoRenavam').value = mdfe.veiculo.renavam;
    document.getElementById('veiculoTara').value = mdfe.veiculo.tara;
    document.getElementById('veiculoCapacidade').value = mdfe.veiculo.capacidade;
    document.getElementById('condutorNome').value = mdfe.condutor.nome;
    document.getElementById('condutorCpf').value = mdfe.condutor.cpf;
    document.getElementById('condutorCnh').value = mdfe.condutor.cnh;
    document.getElementById('mdfeObservacoes').value = mdfe.observacoes || '';
    
    // Carregar documentos
    documentosFiscais = [...mdfe.documentos];
    atualizarListaDocumentos();
    
    mdfeEditando = id;
    
    // Ir para aba de emissão
    showTab('emissao');
    
    alert('MDF-e carregado para edição');
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
        alert('Selecione o período para o relatório');
        return;
    }
    
    const mdfesRelatorio = mdfes.filter(mdfe => {
        const dataEmissao = mdfe.dataEmissao.split('T')[0];
        return dataEmissao >= dataInicio && dataEmissao <= dataFim;
    });
    
    if (mdfesRelatorio.length === 0) {
        alert('Nenhum MDF-e encontrado no período selecionado');
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
        relatorio += `${mdfe.numero} - ${mdfe.veiculo.placa} - ${mdfe.status.toUpperCase()}\n`;
    });
    
    // Exibir relatório
    const novaJanela = window.open('', '_blank');
    novaJanela.document.write(`
        <html>
            <head><title>Relatório MDF-e</title></head>
            <body>
                <pre style="font-family: monospace; white-space: pre-wrap;">${escapeHtmlMdfe(relatorio)}</pre>
                <button onclick="window.print()">Imprimir</button>
            </body>
        </html>
    `);
    
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
    const senhaA1 = window.prompt('Informe a senha do certificado A1:');
    if (!senhaA1) return;

    try {
        const result = await window.firebaseService.callFunction('mdfe_consultar', {
            tenantId: tenantIdMdfe,
            mdfeId: mdfe.id,
            chave: mdfe.chaveAcesso,
            senhaA1,
            ambiente: document.getElementById('mdfeAmbiente')?.value || 'homologacao',
        });
        mdfe.cStat = result?.cStat || '';
        mdfe.xMotivo = result?.xMotivo || '';
        mdfe.protocolo = result?.protocolo || mdfe.protocolo || '';
        alert(`Retorno SEFAZ: ${mdfe.cStat} - ${mdfe.xMotivo}`);
        consultarMdfes();
    } catch (error) {
        console.error('❌ Erro ao consultar MDF-e:', error);
        alert(`Não foi possível consultar o MDF-e: ${error.message}`);
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
window.editarMdfe = editarMdfe;
window.encerrarMdfe = encerrarMdfe;
window.encerrarMdfeRapido = encerrarMdfeRapido;
window.consultarMdfeFiscal = consultarMdfeFiscal;
window.gerarRelatorioMdfe = gerarRelatorioMdfe;

console.log('🚛 Sistema MDF-e carregado com sucesso!'); 
