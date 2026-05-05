// Sistema de Notas Fiscais
// Variáveis globais
let notasFiscais = [];
let clientes = [];
let produtos = [];
let itensNota = [];
let numeroAtual = 1;
let configuracoes = {
    serie: '1',
    proximoNumero: 1,
    cfopPadrao: '5102',
    ambiente: 'homologacao'
};

// Inicialização do sistema
document.addEventListener('DOMContentLoaded', function() {
    inicializarSistema();
});

function inicializarSistema() {
    console.log('🚀 Inicializando Sistema de Notas Fiscais...');
    
    // Definir data atual
    const hoje = new Date().toISOString().split('T')[0];
    document.getElementById('nfDataEmissao').value = hoje;
    
    // Carregar dados
    carregarDados();
    
    // Configurar eventos
    configurarEventos();
    
    // Atualizar dashboard
    atualizarDashboard();
    
    // Configurar próximo número
    atualizarProximoNumero();
    
    console.log('✅ Sistema de Notas Fiscais inicializado');
}

async function carregarDados() {
    try {
        // Carregar dados do localStorage/Firebase
        notasFiscais = await getData('notas-fiscais') || [];
        clientes = await getData('clientes') || [];
        produtos = await getData('produtos') || [];
        configuracoes = await getData('configuracoes-nf') || configuracoes;
        
        // Atualizar selects
        atualizarSelectClientes();
        atualizarSelectProdutos();
        
        // Carregar configurações
        carregarConfiguracoes();
        
        console.log('✅ Dados carregados:', {
            notasFiscais: notasFiscais.length,
            clientes: clientes.length,
            produtos: produtos.length
        });
        
    } catch (error) {
        console.error('❌ Erro ao carregar dados:', error);
    }
}

function configurarEventos() {
    // Evento de mudança de cliente
    document.getElementById('nfCliente').addEventListener('change', function() {
        preencherDadosCliente(this.value);
    });
    
    // Evento de mudança de produto
    document.getElementById('itemProduto').addEventListener('change', function() {
        preencherDadosProduto(this.value);
    });
    
    // Evento de submissão do formulário
    document.getElementById('nfForm').addEventListener('submit', function(e) {
        e.preventDefault();
        emitirNotaFiscal();
    });
    
    // Formatação monetária
    configurarFormatacaoMonetaria();
    
    // Busca em tempo real
    document.getElementById('searchNF').addEventListener('input', function() {
        consultarNotas();
    });
    
    document.getElementById('filterStatus').addEventListener('change', function() {
        consultarNotas();
    });
}

function configurarFormatacaoMonetaria() {
    const camposMonetarios = ['itemValorUnitario', 'nfDesconto'];
    
    camposMonetarios.forEach(id => {
        const elemento = document.getElementById(id);
        if (elemento) {
            elemento.addEventListener('input', function() {
                this.value = formatCurrency(parseCurrencyValue(this.value));
            });
        }
    });
}

// Funções de navegação
function showTab(tabName) {
    // Ocultar todas as abas
    const tabs = document.querySelectorAll('.tab-content');
    tabs.forEach(tab => tab.classList.remove('active'));
    
    // Ocultar todos os botões de aba
    const tabButtons = document.querySelectorAll('.tab');
    tabButtons.forEach(button => button.classList.remove('active'));
    
    // Mostrar aba selecionada
    document.getElementById(tabName).classList.add('active');
    
    // Ativar botão da aba
    event.target.classList.add('active');
    
    // Ações específicas por aba
    if (tabName === 'consulta') {
        consultarNotas();
    } else if (tabName === 'dashboard') {
        atualizarDashboard();
    }
}

// Funções de cliente
function atualizarSelectClientes() {
    const select = document.getElementById('nfCliente');
    select.innerHTML = '<option value="">Selecione um cliente...</option>';
    
    clientes.forEach(cliente => {
        const option = document.createElement('option');
        option.value = cliente.id;
        option.textContent = `${cliente.nome || cliente.name} - ${cliente.cnpj || cliente.cpf || 'N/A'}`;
        select.appendChild(option);
    });
}

function preencherDadosCliente(clienteId) {
    const cliente = clientes.find(c => c.id === clienteId);
    if (!cliente) {
        limparDadosCliente();
        return;
    }
    
    document.getElementById('nfClienteCnpj').value = cliente.cnpj || cliente.cpf || '';
    document.getElementById('nfClienteEndereco').value = 
        `${cliente.endereco || ''}, ${cliente.numero || ''} - ${cliente.bairro || ''}`.trim();
    document.getElementById('nfClienteCidade').value = 
        `${cliente.cidade || ''} - ${cliente.estado || ''}`.trim();
}

function limparDadosCliente() {
    document.getElementById('nfClienteCnpj').value = '';
    document.getElementById('nfClienteEndereco').value = '';
    document.getElementById('nfClienteCidade').value = '';
}

// Funções de produto
function atualizarSelectProdutos() {
    const select = document.getElementById('itemProduto');
    select.innerHTML = '<option value="">Selecione um produto...</option>';
    
    produtos.forEach(produto => {
        const option = document.createElement('option');
        option.value = produto.id;
        option.textContent = `${produto.codigo} - ${produto.nome}`;
        select.appendChild(option);
    });
}

function preencherDadosProduto(produtoId) {
    const produto = produtos.find(p => p.id === produtoId);
    if (!produto) {
        document.getElementById('itemValorUnitario').value = '';
        return;
    }
    
    document.getElementById('itemValorUnitario').value = formatCurrency(produto.preco || 0);
}

// Funções de itens
function adicionarItem() {
    const produtoId = document.getElementById('itemProduto').value;
    const quantidade = parseFloat(document.getElementById('itemQuantidade').value);
    const valorUnitario = parseCurrencyValue(document.getElementById('itemValorUnitario').value);
    
    if (!produtoId || !quantidade || quantidade <= 0 || !valorUnitario || valorUnitario <= 0) {
        alert('Preencha todos os campos do item corretamente');
        return;
    }
    
    const produto = produtos.find(p => p.id === produtoId);
    if (!produto) {
        alert('Produto não encontrado');
        return;
    }
    
    const item = {
        id: generateUniqueId('ITEM'),
        produtoId: produtoId,
        produto: produto.nome,
        codigo: produto.codigo,
        quantidade: quantidade,
        valorUnitario: valorUnitario,
        total: quantidade * valorUnitario,
        cfop: configuracoes.cfopPadrao,
        unidade: produto.unidade || 'UN'
    };
    
    itensNota.push(item);
    atualizarTabelaItens();
    atualizarTotais();
    
    // Limpar campos
    document.getElementById('itemProduto').value = '';
    document.getElementById('itemQuantidade').value = '';
    document.getElementById('itemValorUnitario').value = '';
}

function removerItem(itemId) {
    itensNota = itensNota.filter(item => item.id !== itemId);
    atualizarTabelaItens();
    atualizarTotais();
}

function atualizarTabelaItens() {
    const container = document.getElementById('itensContainer');
    
    if (itensNota.length === 0) {
        container.innerHTML = '<div style="text-align: center; padding: 20px; color: #6c757d;">Nenhum item adicionado</div>';
        return;
    }
    
    container.innerHTML = itensNota.map(item => `
        <div class="item-row">
            <div>${item.codigo} - ${item.produto}</div>
            <div>${formatNumber(item.quantidade)} ${item.unidade}</div>
            <div>${formatCurrency(item.valorUnitario)}</div>
            <div>${formatCurrency(item.total)}</div>
            <div>${item.cfop}</div>
            <div>
                <button onclick="removerItem('${item.id}')" class="btn btn-danger btn-small">
                    <i class="fas fa-trash"></i>
                </button>
            </div>
        </div>
    `).join('');
}

function atualizarTotais() {
    const subtotal = itensNota.reduce((total, item) => total + item.total, 0);
    const desconto = parseCurrencyValue(document.getElementById('nfDesconto').value) || 0;
    const total = subtotal - desconto;
    
    document.getElementById('nfSubTotal').value = formatCurrency(subtotal);
    document.getElementById('nfTotal').value = formatCurrency(total);
}

// Funções de emissão
function atualizarProximoNumero() {
    document.getElementById('nfNumero').value = String(configuracoes.proximoNumero).padStart(6, '0');
}

async function salvarRascunho() {
    try {
        const nota = criarObjetoNota('rascunho');
        if (!nota) return;
        
        // Verificar se já existe (edição)
        const index = notasFiscais.findIndex(nf => nf.id === nota.id);
        if (index !== -1) {
            notasFiscais[index] = nota;
        } else {
            notasFiscais.push(nota);
        }
        
        await saveData('notas-fiscais', notasFiscais);
        
        alert('Rascunho salvo com sucesso!');
        limparFormulario();
        
    } catch (error) {
        console.error('Erro ao salvar rascunho:', error);
        alert('Erro ao salvar rascunho: ' + error.message);
    }
}

async function emitirNotaFiscal() {
    try {
        const nota = criarObjetoNota('emitida');
        if (!nota) return;
        
        // Simular emissão (aqui seria integração com API da Receita)
        nota.chave = gerarChaveNFe();
        nota.protocolo = generateUniqueId('PROT');
        
        notasFiscais.push(nota);
        await saveData('notas-fiscais', notasFiscais);
        
        // Atualizar próximo número
        configuracoes.proximoNumero++;
        await saveData('configuracoes-nf', configuracoes);
        
        // Atualizar estoque se for saída
        if (nota.tipo === 'saida') {
            await atualizarEstoqueProdutos(itensNota, 'saida');
        }
        
        alert(`Nota Fiscal emitida com sucesso!\nNúmero: ${nota.numero}\nChave: ${nota.chave}`);
        limparFormulario();
        atualizarProximoNumero();
        
    } catch (error) {
        console.error('Erro ao emitir nota fiscal:', error);
        alert('Erro ao emitir nota fiscal: ' + error.message);
    }
}

function criarObjetoNota(status) {
    // Validações
    const clienteId = document.getElementById('nfCliente').value;
    const tipo = document.getElementById('nfTipo').value;
    
    if (!clienteId) {
        alert('Selecione um cliente');
        return null;
    }
    
    if (!tipo) {
        alert('Selecione o tipo de operação');
        return null;
    }
    
    if (itensNota.length === 0) {
        alert('Adicione pelo menos um item à nota fiscal');
        return null;
    }
    
    const cliente = clientes.find(c => c.id === clienteId);
    const subtotal = itensNota.reduce((total, item) => total + item.total, 0);
    const desconto = parseCurrencyValue(document.getElementById('nfDesconto').value) || 0;
    const total = subtotal - desconto;
    
    return {
        id: generateUniqueId('NF'),
        numero: String(configuracoes.proximoNumero).padStart(6, '0'),
        serie: document.getElementById('nfSerie').value,
        dataEmissao: document.getElementById('nfDataEmissao').value,
        tipo: tipo,
        status: status,
        cliente: {
            id: cliente.id,
            nome: cliente.nome || cliente.name,
            cnpj: cliente.cnpj || cliente.cpf,
            endereco: cliente.endereco,
            cidade: cliente.cidade,
            estado: cliente.estado
        },
        itens: [...itensNota],
        subtotal: subtotal,
        desconto: desconto,
        total: total,
        created: new Date().toISOString(),
        updated: new Date().toISOString()
    };
}

function gerarChaveNFe() {
    // Simulação de chave de NF-e (44 dígitos)
    const uf = '35'; // SP
    const ano = new Date().getFullYear().toString().substr(-2);
    const mes = String(new Date().getMonth() + 1).padStart(2, '0');
    const cnpj = '12345678000100'; // CNPJ fictício
    const modelo = '55';
    const serie = String(configuracoes.serie).padStart(3, '0');
    const numero = String(configuracoes.proximoNumero).padStart(9, '0');
    const codigo = String(Math.floor(Math.random() * 100000000)).padStart(8, '0');
    
    const chaveBase = uf + ano + mes + cnpj + modelo + serie + numero + codigo;
    const dv = calcularDVChaveNFe(chaveBase);
    
    return chaveBase + dv;
}

function calcularDVChaveNFe(chave) {
    // Algoritmo simplificado para calcular DV
    let soma = 0;
    let peso = 2;
    
    for (let i = chave.length - 1; i >= 0; i--) {
        soma += parseInt(chave[i]) * peso;
        peso = peso === 9 ? 2 : peso + 1;
    }
    
    const resto = soma % 11;
    return resto < 2 ? 0 : 11 - resto;
}

function limparFormulario() {
    document.getElementById('nfForm').reset();
    document.getElementById('nfDataEmissao').value = new Date().toISOString().split('T')[0];
    document.getElementById('nfSerie').value = configuracoes.serie;
    
    itensNota = [];
    atualizarTabelaItens();
    atualizarTotais();
    atualizarProximoNumero();
    limparDadosCliente();
}

// Funções de consulta
function consultarNotas() {
    const filtroTexto = document.getElementById('searchNF').value.toLowerCase();
    const filtroStatus = document.getElementById('filterStatus').value;
    
    let notasFiltradas = [...notasFiscais];
    
    // Filtro por texto
    if (filtroTexto) {
        notasFiltradas = notasFiltradas.filter(nota => 
            nota.numero.toLowerCase().includes(filtroTexto) ||
            nota.cliente.nome.toLowerCase().includes(filtroTexto) ||
            nota.cliente.cnpj.toLowerCase().includes(filtroTexto)
        );
    }
    
    // Filtro por status
    if (filtroStatus) {
        notasFiltradas = notasFiltradas.filter(nota => nota.status === filtroStatus);
    }
    
    carregarTabelaNotas(notasFiltradas);
}

function carregarTabelaNotas(notas = notasFiscais) {
    const tbody = document.getElementById('notasTable');
    
    if (notas.length === 0) {
        tbody.innerHTML = '<tr><td colspan="7" style="text-align: center;">Nenhuma nota fiscal encontrada</td></tr>';
        return;
    }
    
    tbody.innerHTML = notas.map(nota => `
        <tr>
            <td>${nota.numero}</td>
            <td>${nota.serie}</td>
            <td>${formatDate(nota.dataEmissao)}</td>
            <td>${nota.cliente.nome}</td>
            <td style="text-align: right;">${formatCurrency(nota.total)}</td>
            <td>
                <span class="status-badge status-${nota.status}">
                    ${getStatusLabel(nota.status)}
                </span>
            </td>
            <td style="text-align: center;">
                <button onclick="visualizarNota('${nota.id}')" class="btn btn-primary btn-small">
                    <i class="fas fa-eye"></i>
                </button>
                ${nota.status === 'rascunho' ? `
                    <button onclick="editarNota('${nota.id}')" class="btn btn-warning btn-small">
                        <i class="fas fa-edit"></i>
                    </button>
                ` : ''}
                ${nota.status === 'emitida' ? `
                    <button onclick="cancelarNota('${nota.id}')" class="btn btn-danger btn-small">
                        <i class="fas fa-ban"></i>
                    </button>
                ` : ''}
            </td>
        </tr>
    `).join('');
}

function getStatusLabel(status) {
    const labels = {
        rascunho: 'Rascunho',
        emitida: 'Emitida',
        cancelada: 'Cancelada'
    };
    return labels[status] || status;
}

// Funções de dashboard
function atualizarDashboard() {
    const hoje = new Date();
    const inicioMes = new Date(hoje.getFullYear(), hoje.getMonth(), 1);
    
    const notasEmitidas = notasFiscais.filter(nf => nf.status === 'emitida');
    const notasMes = notasEmitidas.filter(nf => new Date(nf.dataEmissao) >= inicioMes);
    const valorTotalMes = notasMes.reduce((total, nf) => total + nf.total, 0);
    const rascunhos = notasFiscais.filter(nf => nf.status === 'rascunho').length;
    const canceladas = notasFiscais.filter(nf => nf.status === 'cancelada').length;
    
    document.getElementById('totalNotasEmitidas').textContent = notasEmitidas.length;
    document.getElementById('valorTotalMes').textContent = formatCurrency(valorTotalMes);
    document.getElementById('totalRascunhos').textContent = rascunhos;
    document.getElementById('totalCanceladas').textContent = canceladas;
}

function gerarRelatorio() {
    const dataInicio = document.getElementById('relPeriodoInicio').value;
    const dataFim = document.getElementById('relPeriodoFim').value;
    
    if (!dataInicio || !dataFim) {
        alert('Informe o período do relatório');
        return;
    }
    
    const notasPeriodo = notasFiscais.filter(nota => {
        const dataNota = new Date(nota.dataEmissao);
        return dataNota >= new Date(dataInicio) && dataNota <= new Date(dataFim);
    });
    
    // Aqui seria gerado um relatório mais detalhado
    alert(`Relatório gerado para o período:\n${formatDate(dataInicio)} a ${formatDate(dataFim)}\n\nTotal de notas: ${notasPeriodo.length}\nValor total: ${formatCurrency(notasPeriodo.reduce((total, nf) => total + nf.total, 0))}`);
}

// Funções de configuração
function carregarConfiguracoes() {
    document.getElementById('cfgSerieNF').value = configuracoes.serie;
    document.getElementById('cfgProximoNumero').value = configuracoes.proximoNumero;
    document.getElementById('cfgCfopPadrao').value = configuracoes.cfopPadrao;
    document.getElementById('cfgAmbiente').value = configuracoes.ambiente;
}

async function salvarConfiguracoes() {
    try {
        configuracoes = {
            serie: document.getElementById('cfgSerieNF').value,
            proximoNumero: parseInt(document.getElementById('cfgProximoNumero').value),
            cfopPadrao: document.getElementById('cfgCfopPadrao').value,
            ambiente: document.getElementById('cfgAmbiente').value
        };
        
        await saveData('configuracoes-nf', configuracoes);
        
        // Atualizar série no formulário
        document.getElementById('nfSerie').value = configuracoes.serie;
        atualizarProximoNumero();
        
        alert('Configurações salvas com sucesso!');
        
    } catch (error) {
        console.error('Erro ao salvar configurações:', error);
        alert('Erro ao salvar configurações: ' + error.message);
    }
}

// Funções auxiliares
async function atualizarEstoqueProdutos(itens, tipoOperacao) {
    try {
        for (const item of itens) {
            const produtoIndex = produtos.findIndex(p => p.id === item.produtoId);
            if (produtoIndex !== -1) {
                if (tipoOperacao === 'saida') {
                    produtos[produtoIndex].estoque -= item.quantidade;
                } else if (tipoOperacao === 'entrada') {
                    produtos[produtoIndex].estoque += item.quantidade;
                }
                
                // Verificar estoque mínimo
                if (produtos[produtoIndex].estoque < 0) {
                    console.warn(`Estoque negativo para produto: ${produtos[produtoIndex].nome}`);
                }
            }
        }
        
        await saveData('produtos', produtos);
        
    } catch (error) {
        console.error('Erro ao atualizar estoque:', error);
    }
}

// Funções de formatação
function formatCurrency(value) {
    if (value === null || value === undefined || isNaN(value)) return 'R$ 0,00';
    return 'R$ ' + parseFloat(value).toLocaleString('pt-BR', {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2
    });
}

function parseCurrencyValue(value) {
    if (!value || typeof value !== 'string') return 0;
    return parseFloat(value.replace(/[^\d,-]/g, '').replace(',', '.')) || 0;
}

function formatNumber(value, decimals = 3) {
    if (value === null || value === undefined || isNaN(value)) return '0';
    return parseFloat(value).toLocaleString('pt-BR', {
        minimumFractionDigits: decimals,
        maximumFractionDigits: decimals
    });
}

function formatDate(dateString) {
    if (!dateString) return '';
    const date = new Date(dateString);
    return date.toLocaleDateString('pt-BR');
}

function generateUniqueId(prefix = '') {
    return prefix + Date.now() + Math.random().toString(36).substr(2, 9);
}

// Funções de dados
async function getData(key) {
    try {
        // Tentar Firebase primeiro
        if (window.firebaseService && await window.firebaseService.isFirebaseOperational()) {
            const data = await window.firebaseService.authService.getUserData(key);
            if (data) {
                console.log(`✅ Dados carregados do Firebase: ${key}`);
                return data;
            }
        }
        
        // Fallback para localStorage
        const data = localStorage.getItem(key);
        if (data) {
            console.log(`✅ Dados carregados do localStorage: ${key}`);
            return JSON.parse(data);
        }
        
        return null;
        
    } catch (error) {
        console.error(`❌ Erro ao carregar dados (${key}):`, error);
        return null;
    }
}

async function saveData(key, data) {
    try {
        // Salvar no localStorage primeiro
        localStorage.setItem(key, JSON.stringify(data));
        console.log(`✅ Dados salvos no localStorage: ${key}`);
        
        // Tentar salvar no Firebase
        if (window.firebaseService && await window.firebaseService.isFirebaseOperational()) {
            await window.firebaseService.authService.saveUserData(key, data);
            console.log(`✅ Dados salvos no Firebase: ${key}`);
        }
        
    } catch (error) {
        console.error(`❌ Erro ao salvar dados (${key}):`, error);
        throw error;
    }
}

// Expor funções globalmente
window.showTab = showTab;
window.adicionarItem = adicionarItem;
window.removerItem = removerItem;
window.salvarRascunho = salvarRascunho;
window.limparFormulario = limparFormulario;
window.consultarNotas = consultarNotas;
window.gerarRelatorio = gerarRelatorio;
window.salvarConfiguracoes = salvarConfiguracoes; 
