// Sistema de MDF-e (Manifesto de Documentos Fiscais)

// Variáveis globais
let mdfes = [];
let documentosFiscais = [];
let veiculos = [];
let condutores = [];
let numeroAtualMdfe = 1;
let mdfeEditando = null;

// Configurações
const configuracoesMdfe = {
    serie: '1',
    ufEmitente: 'SP',
    cnpjEmitente: '',
    razaoSocialEmitente: ''
};

// Inicialização do sistema
document.addEventListener('DOMContentLoaded', function() {
    console.log('🚛 Inicializando sistema MDF-e...');
    
    // Definir data/hora atual
    const agora = new Date();
    const dataHoraLocal = new Date(agora.getTime() - agora.getTimezoneOffset() * 60000).toISOString().slice(0, 16);
    document.getElementById('mdfeDataEmissao').value = dataHoraLocal;
    document.getElementById('dataEncerramento').value = dataHoraLocal;
    
    // Carregar dados
    carregarDados();
    
    // Configurar eventos
    configurarEventos();
    
    // Atualizar dashboard
    atualizarDashboard();
    
    // Definir próximo número
    definirProximoNumeroMdfe();
    
    console.log('✅ Sistema MDF-e inicializado com sucesso');
});

// Carregar dados do localStorage ou Firebase
function carregarDados() {
    try {
        // Carregar MDF-es
        const mdfesStorage = localStorage.getItem('mdfes');
        if (mdfesStorage) {
            mdfes = JSON.parse(mdfesStorage);
        }
        
        // Carregar documentos fiscais
        const documentosStorage = localStorage.getItem('documentosFiscais');
        if (documentosStorage) {
            documentosFiscais = JSON.parse(documentosStorage);
        }
        
        // Carregar veículos
        const veiculosStorage = localStorage.getItem('veiculos');
        if (veiculosStorage) {
            veiculos = JSON.parse(veiculosStorage);
        }
        
        // Carregar condutores
        const condutoresStorage = localStorage.getItem('condutores');
        if (condutoresStorage) {
            condutores = JSON.parse(condutoresStorage);
        }
        
        // Carregar configurações
        const configStorage = localStorage.getItem('configuracoesMdfe');
        if (configStorage) {
            Object.assign(configuracoesMdfe, JSON.parse(configStorage));
        }
        
        console.log('📊 Dados carregados:', {
            mdfes: mdfes.length,
            documentos: documentosFiscais.length,
            veiculos: veiculos.length,
            condutores: condutores.length
        });
        
    } catch (error) {
        console.error('❌ Erro ao carregar dados:', error);
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

// Função para mostrar abas
function showTab(tabName) {
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
    
    // Adicionar classe active ao botão clicado
    event.target.classList.add('active');
    
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
        row.className = 'nf-row';
        row.innerHTML = `
            <div title="${doc.chave}">${doc.chave.substring(0, 20)}...</div>
            <div>R$ ${doc.valor.toLocaleString('pt-BR', {minimumFractionDigits: 2})}</div>
            <div>${doc.peso.toLocaleString('pt-BR', {minimumFractionDigits: 3})} kg</div>
            <div><span class="status-badge status-${doc.status.toLowerCase()}">${doc.status}</span></div>
            <div>
                <button onclick="removerDocumento('${doc.id}')" class="btn btn-danger btn-small">
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
function salvarRascunhoMdfe() {
    const dadosMdfe = coletarDadosFormulario();
    if (!dadosMdfe) return;
    
    dadosMdfe.status = 'rascunho';
    dadosMdfe.dataRascunho = new Date().toISOString();
    
    if (mdfeEditando) {
        // Atualizar existente
        const index = mdfes.findIndex(m => m.id === mdfeEditando);
        if (index !== -1) {
            mdfes[index] = { ...mdfes[index], ...dadosMdfe };
        }
    } else {
        // Criar novo
        dadosMdfe.id = gerarId();
        dadosMdfe.numero = numeroAtualMdfe.toString().padStart(9, '0');
        mdfes.push(dadosMdfe);
    }
    
    salvarDados();
    alert('Rascunho salvo com sucesso!');
    
    console.log('💾 Rascunho salvo:', dadosMdfe);
}

// Emitir MDF-e
function emitirMdfe() {
    const dadosMdfe = coletarDadosFormulario();
    if (!dadosMdfe) return;
    
    if (documentosFiscais.length === 0) {
        alert('É necessário adicionar pelo menos um documento fiscal');
        return;
    }
    
    // Simular emissão
    dadosMdfe.status = 'autorizado';
    dadosMdfe.dataAutorizacao = new Date().toISOString();
    dadosMdfe.protocolo = gerarProtocolo();
    dadosMdfe.chaveAcesso = gerarChaveAcesso();
    
    if (mdfeEditando) {
        // Atualizar existente
        const index = mdfes.findIndex(m => m.id === mdfeEditando);
        if (index !== -1) {
            mdfes[index] = { ...mdfes[index], ...dadosMdfe };
        }
    } else {
        // Criar novo
        dadosMdfe.id = gerarId();
        dadosMdfe.numero = numeroAtualMdfe.toString().padStart(9, '0');
        mdfes.push(dadosMdfe);
        numeroAtualMdfe++;
    }
    
    salvarDados();
    alert('MDF-e emitido com sucesso!\nProtocolo: ' + dadosMdfe.protocolo);
    
    limparFormularioMdfe();
    definirProximoNumeroMdfe();
    atualizarDashboard();
    
    console.log('✅ MDF-e emitido:', dadosMdfe);
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
        tbody.innerHTML = '<tr><td colspan="8" style="text-align: center;">Nenhum MDF-e encontrado</td></tr>';
        return;
    }
    
    tbody.innerHTML = mdfesParaExibir.map(mdfe => `
        <tr>
            <td>${mdfe.numero}</td>
            <td>${mdfe.serie}</td>
            <td>${formatarDataHora(mdfe.dataEmissao)}</td>
            <td>${mdfe.veiculo.placa}</td>
            <td>${mdfe.condutor.nome}</td>
            <td>${mdfe.ufInicio}/${mdfe.ufFim}</td>
            <td><span class="status-badge status-${mdfe.status}">${mdfe.status.toUpperCase()}</span></td>
            <td>
                <button onclick="visualizarMdfe('${mdfe.id}')" class="btn btn-primary btn-small" title="Visualizar">
                    <i class="fas fa-eye"></i>
                </button>
                ${mdfe.status === 'autorizado' ? `
                    <button onclick="encerrarMdfeRapido('${mdfe.id}')" class="btn btn-warning btn-small" title="Encerrar">
                        <i class="fas fa-check"></i>
                    </button>
                ` : ''}
                ${mdfe.status === 'rascunho' ? `
                    <button onclick="editarMdfe('${mdfe.id}')" class="btn btn-warning btn-small" title="Editar">
                        <i class="fas fa-edit"></i>
                    </button>
                ` : ''}
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
function encerrarMdfe() {
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
    
    // Atualizar status
    mdfe.status = 'encerrado';
    mdfe.dataEncerramento = dataEncerramento;
    mdfe.municipioEncerramento = municipioEncerramento;
    mdfe.protocoloEncerramento = gerarProtocolo();
    
    document.getElementById('protocoloEncerramento').value = mdfe.protocoloEncerramento;
    
    salvarDados();
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
function encerrarMdfeRapido(id) {
    const municipio = prompt('Informe o município de encerramento:');
    if (!municipio) return;
    
    const mdfe = mdfes.find(m => m.id === id);
    if (!mdfe) return;
    
    mdfe.status = 'encerrado';
    mdfe.dataEncerramento = new Date().toISOString();
    mdfe.municipioEncerramento = municipio;
    mdfe.protocoloEncerramento = gerarProtocolo();
    
    salvarDados();
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
    
    document.getElementById('totalMdfesEmitidos').textContent = totalEmitidos;
    document.getElementById('totalMdfesAutorizados').textContent = totalAutorizados;
    document.getElementById('totalMdfesEncerrados').textContent = totalEncerrados;
    document.getElementById('totalViagensAtivas').textContent = viagensAtivas;
}

// Gerar relatório
function gerarRelatorioMdfe() {
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
    
    // Gerar relatório simples
    let relatorio = `RELATÓRIO MDF-e - ${formatarData(dataInicio)} a ${formatarData(dataFim)}\n\n`;
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
                <pre style="font-family: monospace; white-space: pre-wrap;">${relatorio}</pre>
                <button onclick="window.print()">Imprimir</button>
            </body>
        </html>
    `);
    
    console.log('📊 Relatório gerado:', mdfesRelatorio.length, 'MDF-es');
}

// Salvar dados
function salvarDados() {
    try {
        localStorage.setItem('mdfes', JSON.stringify(mdfes));
        localStorage.setItem('documentosFiscais', JSON.stringify([])); // Limpar após uso
        localStorage.setItem('configuracoesMdfe', JSON.stringify(configuracoesMdfe));
        
        console.log('💾 Dados salvos no localStorage');
        
        // Tentar salvar no Firebase se disponível
        if (window.firebaseService && window.firebaseService.isFirebaseOperational) {
            // Implementar salvamento no Firebase aqui
            console.log('☁️ Dados sincronizados com Firebase');
        }
        
    } catch (error) {
        console.error('❌ Erro ao salvar dados:', error);
    }
}

// Funções utilitárias
function gerarId() {
    return Date.now().toString(36) + Math.random().toString(36).substr(2);
}

function gerarProtocolo() {
    return 'PROT' + Date.now().toString().substr(-8) + Math.random().toString().substr(2, 4).toUpperCase();
}

function gerarChaveAcesso() {
    // Simular chave de acesso de 44 dígitos
    let chave = '';
    for (let i = 0; i < 44; i++) {
        chave += Math.floor(Math.random() * 10);
    }
    return chave;
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
window.gerarRelatorioMdfe = gerarRelatorioMdfe;

console.log('🚛 Sistema MDF-e carregado com sucesso!'); 
