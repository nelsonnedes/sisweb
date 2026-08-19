/**
 * Módulo de Estoque de Produtos (Almoxarifado)
 * Integrado ao estoque.js principal
 */

let estoqueProdutos = [];
let paginaAtualProdutos = 1;
let produtosFiltrados = [];
let produtosUltimaListaRenderizada = null;
let movimentacoesProdutosCache = [];
let responsaveisProdutosCache = [];
let ordemProdutos = { coluna: 'nome', direcao: 'asc' };
let produtosSelecionados = new Set();
let produtoAlmoxarifadoEmEdicao = null;

async function carregarEstoqueProdutos() {
    const tbody = document.getElementById('produtosTable');
    if (!tbody) return;
    
    tbody.innerHTML = '<tr><td colspan="10" class="text-center"><i class="fas fa-spinner fa-spin"></i> Carregando estoque...</td></tr>';

    try {
        // Carregar dados do Firebase/Local
        estoqueProdutos = normalizarListaProdutosFirebase(await getData('estoqueProdutos') || []);
        await carregarMovimentacoesProdutosCache();
        await carregarResponsaveisProdutosCache();
        
        renderizarTabelaProdutos(estoqueProdutos);
        atualizarEstatisticasProdutos();
        prepararEntradaProdutos();
        prepararBaixaProdutos();
        
    } catch (error) {
        console.error("Erro ao carregar estoque de produtos:", error);
        tbody.innerHTML = '<tr><td colspan="10" class="text-center text-danger">Erro ao carregar dados.</td></tr>';
    }
}

function normalizarListaProdutosFirebase(data) {
    if (Array.isArray(data)) return data.slice();
    if (data && typeof data === 'object') return Object.values(data);
    return [];
}

function normalizarTipoMovimentacaoProduto(tipo, fallback = 'entrada') {
    const normalized = String(tipo || fallback || 'entrada')
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .toLowerCase()
        .trim();
    if (['saida', 'baixa', 'consumo'].includes(normalized)) return 'saida';
    if (['devolucao', 'devolucao_fornecedor', 'devolucao ao fornecedor'].includes(normalized)) return 'devolucao';
    if (['ajuste', 'ajuste_estoque'].includes(normalized)) return 'ajuste';
    return 'entrada';
}

function normalizarDirecaoEstoqueProduto(direcao, fallback = 'entrada') {
    const normalized = String(direcao || fallback || 'entrada')
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .toLowerCase()
        .trim();
    return normalized === 'saida' ? 'saida' : 'entrada';
}

function obterDirecaoMovimentoProduto(mov = {}, fallback = 'entrada') {
    const direcaoDireta = String(mov.direcaoEstoque || mov.direcao || '').toLowerCase().trim();
    if (direcaoDireta === 'entrada' || direcaoDireta === 'saida') return direcaoDireta;

    const tipo = normalizarTipoMovimentacaoProduto(mov.tipo || mov.tipoMovimentacao, fallback);
    if (tipo === 'entrada') return 'entrada';
    if (tipo === 'saida' || tipo === 'devolucao') return 'saida';

    const saldoAnterior = Number(mov.saldoAnterior);
    const saldoAtual = Number(mov.saldoAtual);
    if (Number.isFinite(saldoAnterior) && Number.isFinite(saldoAtual) && saldoAtual !== saldoAnterior) {
        return saldoAtual > saldoAnterior ? 'entrada' : 'saida';
    }
    return normalizarDirecaoEstoqueProduto(fallback);
}

function obterLabelTipoMovimentacaoProduto(tipo, direcao = '') {
    const tipoNormalizado = normalizarTipoMovimentacaoProduto(tipo);
    const direcaoNormalizada = normalizarDirecaoEstoqueProduto(direcao || (tipoNormalizado === 'saida' || tipoNormalizado === 'devolucao' ? 'saida' : 'entrada'));
    if (tipoNormalizado === 'saida') return 'Saída';
    if (tipoNormalizado === 'devolucao') return 'Devolução';
    if (tipoNormalizado === 'ajuste') return direcaoNormalizada === 'saida' ? 'Ajuste (-)' : 'Ajuste (+)';
    return 'Entrada';
}

function obterClasseTipoMovimentacaoProduto(tipo, direcao = '') {
    const tipoNormalizado = normalizarTipoMovimentacaoProduto(tipo);
    if (tipoNormalizado === 'ajuste') return 'medio';
    const direcaoNormalizada = normalizarDirecaoEstoqueProduto(direcao || (tipoNormalizado === 'saida' || tipoNormalizado === 'devolucao' ? 'saida' : 'entrada'));
    return direcaoNormalizada === 'saida' ? 'baixo' : 'alto';
}

function obterPrefixoMovimentacaoProduto(tipo, direcao = '') {
    const tipoNormalizado = normalizarTipoMovimentacaoProduto(tipo);
    if (tipoNormalizado === 'ajuste') return 'MOV-AJUSTE';
    if (tipoNormalizado === 'devolucao') return 'MOV-DEVOLUCAO';
    return normalizarDirecaoEstoqueProduto(direcao) === 'saida' ? 'MOV-SAIDA' : 'MOV-ENTRADA';
}

function atualizarProdutoUltimaMovimentacao(produto, info = {}) {
    if (!produto) return;
    const tipo = normalizarTipoMovimentacaoProduto(info.tipo);
    const direcao = normalizarDirecaoEstoqueProduto(info.direcaoEstoque || info.direcao);
    const dataIso = info.dataIso || new Date().toISOString();
    produto.ultimaMovimentacaoTipo = tipo;
    produto.tipoUltimaMovimentacao = tipo;
    produto.ultimaMovimentacaoDirecao = direcao;
    produto.direcaoUltimaMovimentacao = direcao;
    produto.ultimaMovimentacaoLabel = obterLabelTipoMovimentacaoProduto(tipo, direcao);
    produto.ultimaAtualizacao = dataIso;
    if (info.documento) {
        produto.ultimoDocumento = info.documento;
        produto.documentoUltimaMovimentacao = info.documento;
    }
    if (info.motivo) {
        produto.motivoDestino = info.motivo;
        produto.ultimoMotivo = info.motivo;
        produto.motivoUltimaMovimentacao = info.motivo;
    }
    if (info.responsavel) {
        produto.responsavel = info.responsavel;
        produto.ultimoResponsavel = info.responsavel;
        produto.responsavelUltimaMovimentacao = info.responsavel;
    }
}

async function carregarMovimentacoesProdutosCache() {
    try {
        movimentacoesProdutosCache = normalizarListaProdutosFirebase(await getData('movimentacoesProdutos') || []);
    } catch (error) {
        console.warn('Não foi possível carregar movimentações de produtos para filtros.', error);
        movimentacoesProdutosCache = [];
    }
    return movimentacoesProdutosCache;
}

function normalizarNomeResponsavelProduto(value) {
    return String(value || '').trim().replace(/\s+/g, ' ');
}

function normalizarChaveResponsavelProduto(value) {
    return normalizarNomeResponsavelProduto(value)
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .toLowerCase();
}

function adicionarResponsavelProduto(set, value) {
    const nome = normalizarNomeResponsavelProduto(value);
    const chave = normalizarChaveResponsavelProduto(nome);
    if (!nome || chave === 'sistema') return;
    if (Array.from(set).some(item => normalizarChaveResponsavelProduto(item) === chave)) return;
    set.add(nome);
}

function getNomeUsuarioAtualProduto() {
    const candidatos = [];
    try {
        const user = window.firebaseAuthUser || (window.firebaseService && window.firebaseService.authService && window.firebaseService.authService.getAuth && window.firebaseService.authService.getAuth().currentUser);
        if (user) candidatos.push(user.displayName, user.nome, user.name, user.email);
    } catch (_) {}
    try {
        const current = JSON.parse(localStorage.getItem('currentUser') || 'null') || {};
        const persistent = JSON.parse(localStorage.getItem('persistentUser') || 'null') || {};
        [current, persistent].forEach(u => {
            candidatos.push(u.nome, u.name, u.displayName, u.username, u.email);
        });
    } catch (_) {}
    return normalizarNomeResponsavelProduto(candidatos.find(Boolean) || '');
}

function coletarFuncionariosCarregadosProduto() {
    const listas = [];
    try { if (window.folhaSystem && Array.isArray(window.folhaSystem.funcionarios)) listas.push(window.folhaSystem.funcionarios); } catch (_) {}
    try { if (window.folhaFuncionarios && Array.isArray(window.folhaFuncionarios.funcionarios)) listas.push(window.folhaFuncionarios.funcionarios); } catch (_) {}
    try { if (window.folhaRelatorios && Array.isArray(window.folhaRelatorios.funcionarios)) listas.push(window.folhaRelatorios.funcionarios); } catch (_) {}
    return listas.flat();
}

async function carregarResponsaveisProdutosCache() {
    const set = new Set();

    (movimentacoesProdutosCache || []).forEach(mov => {
        adicionarResponsavelProduto(set, getResponsavelMovimentoProduto(mov));
    });

    coletarFuncionariosCarregadosProduto()
        .filter(func => func && func.ativo !== false)
        .forEach(func => adicionarResponsavelProduto(set, func.nome || func.name || func.displayName));

    try {
        if (typeof getData === 'function') {
            const funcionarios = normalizarListaProdutosFirebase(await getData('funcionarios') || []);
            funcionarios
                .filter(func => func && func.ativo !== false)
                .forEach(func => adicionarResponsavelProduto(set, func.nome || func.name || func.displayName));
        }
    } catch (_) {}

    adicionarResponsavelProduto(set, getNomeUsuarioAtualProduto());

    responsaveisProdutosCache = Array.from(set).sort((a, b) => a.localeCompare(b, 'pt-BR'));
    atualizarDatalistResponsaveisProduto();
    configurarAutocompleteResponsavelProduto(document.getElementById('baixaProdutoResponsavelInline'));
    configurarAutocompleteResponsavelProduto(document.getElementById('baixaProdutoResponsavel'));
    return responsaveisProdutosCache;
}

function atualizarDatalistResponsaveisProduto() {
    const datalist = document.getElementById('responsaveisProdutoDatalist');
    if (!datalist) return;
    datalist.innerHTML = '';
    (responsaveisProdutosCache || []).forEach(nome => {
        const opt = document.createElement('option');
        opt.value = nome;
        datalist.appendChild(opt);
    });
}

function obterResponsavelCanonicoProduto(nome) {
    const chave = normalizarChaveResponsavelProduto(nome);
    if (!chave) return '';
    return (responsaveisProdutosCache || []).find(item => normalizarChaveResponsavelProduto(item) === chave) || '';
}

function adicionarResponsavelAutocompleteProduto(nome) {
    const nomeNormalizado = normalizarNomeResponsavelProduto(nome);
    if (!nomeNormalizado) return '';
    const existente = obterResponsavelCanonicoProduto(nomeNormalizado);
    if (existente) return existente;
    responsaveisProdutosCache.push(nomeNormalizado);
    responsaveisProdutosCache.sort((a, b) => a.localeCompare(b, 'pt-BR'));
    atualizarDatalistResponsaveisProduto();
    return nomeNormalizado;
}

function mostrarAvisoResponsavelProduto(input, mensagem = '', tipo = 'warning') {
    if (!input) return;
    const aviso = document.getElementById(`${input.id}Aviso`);
    if (!aviso) return;
    aviso.textContent = mensagem;
    aviso.classList.toggle('is-ok', tipo === 'ok');
}

function validarCampoResponsavelProduto(input, options = {}) {
    if (!input) return '';
    const nome = normalizarNomeResponsavelProduto(input.value);
    input.value = nome;
    if (!nome) {
        mostrarAvisoResponsavelProduto(input, '');
        return '';
    }

    const existente = obterResponsavelCanonicoProduto(nome);
    if (existente) {
        if (existente !== nome) {
            input.value = existente;
            mostrarAvisoResponsavelProduto(input, `Responsável já cadastrado como "${existente}". Carreguei o cadastro existente para evitar duplicidade.`);
        } else if (!options.silent) {
            mostrarAvisoResponsavelProduto(input, '');
        }
        return existente;
    }

    if (options.addIfNew) {
        responsaveisProdutosCache.push(nome);
        responsaveisProdutosCache.sort((a, b) => a.localeCompare(b, 'pt-BR'));
        atualizarDatalistResponsaveisProduto();
        mostrarAvisoResponsavelProduto(input, `Novo responsável "${nome}" será adicionado ao autocomplete após esta baixa.`, 'ok');
        return nome;
    }

    if (!options.silent) mostrarAvisoResponsavelProduto(input, '');
    return nome;
}

function configurarAutocompleteResponsavelProduto(input) {
    if (!input || input.dataset.responsavelProdutoBound) return;
    input.addEventListener('input', () => {
        mostrarAvisoResponsavelProduto(input, '');
    });
    input.addEventListener('blur', () => {
        validarCampoResponsavelProduto(input, { silent: false, addIfNew: false });
    });
    input.dataset.responsavelProdutoBound = '1';
}

function obterResponsavelSelecionadoProduto(inputId) {
    const input = document.getElementById(inputId);
    if (!input) return '';
    return validarCampoResponsavelProduto(input, { silent: false, addIfNew: true });
}

function prepararEntradaProdutos() {
    const form = document.getElementById('entradaProdutoForm');
    const dataEl = document.getElementById('entradaProdutoData');
    const tipoEl = document.getElementById('entradaProdutoTipoMov');
    const select = document.getElementById('entradaProdutoSelect');
    const nomeEl = document.getElementById('entradaProdutoNome');
    const unidadeEl = document.getElementById('entradaProdutoUnidade');
    const precoEl = document.getElementById('entradaProdutoPreco');

    if (dataEl && !dataEl.value) {
        dataEl.value = new Date().toISOString().split('T')[0];
    }
    if (tipoEl && !tipoEl.value) {
        tipoEl.value = 'entrada';
    }

    if (select) {
        const prev = select.value;
        select.innerHTML = '<option value="">Novo produto</option>';
        estoqueProdutos.slice().sort((a,b) => (a.nome || '').localeCompare(b.nome || '')).forEach(p => {
            const opt = document.createElement('option');
            opt.value = String(p.id);
            opt.textContent = p.nome || p.id;
            select.appendChild(opt);
        });
        if (prev) select.value = prev;
    }

    if (form && !form.dataset.bound) {
        form.addEventListener('submit', registrarEntradaProduto);
        form.dataset.bound = '1';
    }

    if (select && !select.dataset.bound) {
        select.addEventListener('change', onEntradaProdutoSelectChange);
        select.dataset.bound = '1';
    }

    if (precoEl && !precoEl.dataset.bound) {
        precoEl.addEventListener('blur', function() {
            this.value = formatCurrency(parseCurrencyValue(this.value));
        });
        precoEl.dataset.bound = '1';
    }

    configurarNavegacaoEnterEntradaProdutos();

    if (produtoAlmoxarifadoEmEdicao) {
        const prodEdit = estoqueProdutos.find(p => String(p.id) === String(produtoAlmoxarifadoEmEdicao));
        if (prodEdit) {
            preencherFormularioEdicaoProdutoAlmoxarifado(prodEdit);
            return;
        }
        produtoAlmoxarifadoEmEdicao = null;
        atualizarModoFormularioProduto(false);
    }

    if (select && select.value) {
        onEntradaProdutoSelectChange();
    } else {
        if (nomeEl) nomeEl.disabled = false;
    }
}

function obterDataProdutoParaFormulario(prod = {}) {
    const candidatos = [prod.ultimaAtualizacao, prod.updatedAt, prod.ultimaEntrada, prod.ultimaSaida, prod.createdAt, prod.data];
    const valor = candidatos.find(Boolean);
    if (!valor) return new Date().toISOString().split('T')[0];
    const data = new Date(valor);
    if (Number.isNaN(data.getTime())) return new Date().toISOString().split('T')[0];
    return data.toISOString().split('T')[0];
}

function obterDocumentoProdutoParaFormulario(prod = {}) {
    return String(prod.ultimoDocumento || prod.documento || prod.documentoUltimaMovimentacao || prod.notaFiscal || prod.nf || '').trim();
}

function obterObservacaoProdutoParaFormulario(prod = {}) {
    return String(prod.motivoDestino || prod.ultimoMotivo || prod.motivoUltimaMovimentacao || prod.observacoes || prod.obs || prod.descricao || '').trim();
}

function atualizarModoFormularioProduto(isEditing = false) {
    const titulo = document.getElementById('entradaProdutoTitulo');
    const aviso = document.getElementById('entradaProdutoEditAviso');
    const submitBtn = document.getElementById('entradaProdutoSubmitBtn');
    const submitIcon = document.getElementById('entradaProdutoSubmitIcon');
    const submitLabel = document.getElementById('entradaProdutoSubmitLabel');
    const tipoEl = document.getElementById('entradaProdutoTipoMov');
    const select = document.getElementById('entradaProdutoSelect');
    const nomeEl = document.getElementById('entradaProdutoNome');

    if (titulo) titulo.textContent = isEditing ? 'Editar Produto do Almoxarifado' : 'Registrar Entrada de Produto';
    if (aviso) aviso.style.display = isEditing ? 'block' : 'none';
    if (submitBtn) {
        submitBtn.classList.toggle('btn-primary', isEditing);
        submitBtn.classList.toggle('btn-success', !isEditing);
    }
    if (submitIcon) submitIcon.className = isEditing ? 'fas fa-save' : 'fas fa-check';
    if (submitLabel) submitLabel.textContent = isEditing ? 'Atualizar Produto' : 'Registrar Entrada';
    if (tipoEl) tipoEl.disabled = !!isEditing;
    if (select) select.disabled = !!isEditing;
    if (nomeEl) nomeEl.disabled = false;
}

function preencherFormularioEdicaoProdutoAlmoxarifado(prod = {}) {
    if (!prod || prod.id == null) return;
    produtoAlmoxarifadoEmEdicao = String(prod.id);
    atualizarModoFormularioProduto(true);

    const dataEl = document.getElementById('entradaProdutoData');
    const tipoEl = document.getElementById('entradaProdutoTipoMov');
    const select = document.getElementById('entradaProdutoSelect');
    const nomeEl = document.getElementById('entradaProdutoNome');
    const categoriaEl = document.getElementById('entradaProdutoCategoria');
    const localizacaoEl = document.getElementById('entradaProdutoLocalizacao');
    const unidadeEl = document.getElementById('entradaProdutoUnidade');
    const qtdEl = document.getElementById('entradaProdutoQtd');
    const estMinEl = document.getElementById('entradaProdutoEstoqueMinimo');
    const precoEl = document.getElementById('entradaProdutoPreco');
    const docEl = document.getElementById('entradaProdutoDocumento');
    const obsEl = document.getElementById('entradaProdutoObs');
    const saldoEl = document.getElementById('entradaProdutoSaldo');

    if (dataEl) dataEl.value = obterDataProdutoParaFormulario(prod);
    if (tipoEl) tipoEl.value = normalizarTipoMovimentacaoProduto(prod.ultimaMovimentacaoTipo || prod.tipoUltimaMovimentacao || 'entrada') === 'ajuste' ? 'ajuste' : 'entrada';
    if (select) select.value = String(prod.id);
    if (nomeEl) {
        nomeEl.value = String(prod.nome || '').trim();
        nomeEl.disabled = false;
    }
    if (categoriaEl) categoriaEl.value = prod.categoria || 'Geral';
    if (localizacaoEl) localizacaoEl.value = prod.localizacao || 'Galpão';
    if (unidadeEl) unidadeEl.value = String(prod.unidade || 'un').trim();
    if (qtdEl) qtdEl.value = Number(prod.quantidade || 0);
    if (estMinEl) estMinEl.value = Number(prod.estoqueMinimo || 0);
    if (precoEl) precoEl.value = formatCurrency(prod.precoMedio || 0);
    if (docEl) docEl.value = obterDocumentoProdutoParaFormulario(prod);
    if (obsEl) obsEl.value = obterObservacaoProdutoParaFormulario(prod);
    if (saldoEl) saldoEl.textContent = '';
}

function configurarNavegacaoEnterEntradaProdutos() {
    const campos = [
        'entradaProdutoData',
        'entradaProdutoTipoMov',
        'entradaProdutoSelect',
        'entradaProdutoNome',
        'entradaProdutoCategoria',
        'entradaProdutoLocalizacao',
        'entradaProdutoUnidade',
        'entradaProdutoQtd',
        'entradaProdutoEstoqueMinimo',
        'entradaProdutoPreco',
        'entradaProdutoDocumento',
        'entradaProdutoObs'
    ];

    const isFocusable = (el) => {
        if (!el || el.disabled || el.readOnly) return false;
        const style = window.getComputedStyle ? window.getComputedStyle(el) : null;
        if (style && (style.display === 'none' || style.visibility === 'hidden')) return false;
        return true;
    };

    const focusNext = (index) => {
        for (let i = index + 1; i < campos.length; i++) {
            const nextEl = document.getElementById(campos[i]);
            if (isFocusable(nextEl)) {
                nextEl.focus();
                if (typeof nextEl.select === 'function' && nextEl.tagName !== 'SELECT') {
                    nextEl.select();
                }
                return true;
            }
        }
        return false;
    };

    campos.forEach((id, index) => {
        const el = document.getElementById(id);
        if (!el || el.dataset.enterNavBound) return;
        el.addEventListener('keydown', (e) => {
            if (e.key !== 'Enter') return;
            e.preventDefault();
            if (id === 'entradaProdutoSelect' && typeof onEntradaProdutoSelectChange === 'function') {
                onEntradaProdutoSelectChange();
            }
            const moved = focusNext(index);
            if (!moved) {
                const form = document.getElementById('entradaProdutoForm');
                if (form && typeof form.requestSubmit === 'function') {
                    form.requestSubmit();
                } else if (form) {
                    form.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
                }
            }
        });
        el.dataset.enterNavBound = '1';
    });
}

function onEntradaProdutoSelectChange() {
    if (produtoAlmoxarifadoEmEdicao) return;
    const select = document.getElementById('entradaProdutoSelect');
    const nomeEl = document.getElementById('entradaProdutoNome');
    const categoriaEl = document.getElementById('entradaProdutoCategoria');
    const localizacaoEl = document.getElementById('entradaProdutoLocalizacao');
    const unidadeEl = document.getElementById('entradaProdutoUnidade');
    const estMinEl = document.getElementById('entradaProdutoEstoqueMinimo');
    const precoEl = document.getElementById('entradaProdutoPreco');
    const saldoEl = document.getElementById('entradaProdutoSaldo');
    if (!select) return;
    const prodId = select.value;
    if (!prodId) {
        if (nomeEl) { nomeEl.value = ''; nomeEl.disabled = false; }
        if (categoriaEl) categoriaEl.value = 'Geral';
        if (localizacaoEl) localizacaoEl.value = 'Galpão';
        if (unidadeEl) unidadeEl.value = 'un';
        if (estMinEl) estMinEl.value = '0';
        if (precoEl) precoEl.value = '';
        if (saldoEl) saldoEl.textContent = '';
        return;
    }
    const prod = estoqueProdutos.find(p => String(p.id) === String(prodId));
    if (prod) {
        if (nomeEl) { nomeEl.value = prod.nome || ''; nomeEl.disabled = true; }
        if (categoriaEl) categoriaEl.value = prod.categoria || 'Geral';
        if (localizacaoEl) localizacaoEl.value = prod.localizacao || 'Galpão';
        if (unidadeEl) unidadeEl.value = prod.unidade || 'un';
        if (estMinEl) estMinEl.value = Number(prod.estoqueMinimo || 0);
        if (precoEl) precoEl.value = formatCurrency(prod.precoMedio || 0);
        if (saldoEl) {
            const qtd = formatNumber(prod.quantidade || 0, 2);
            const unidade = prod.unidade || 'un';
            const precoMedio = formatCurrency(prod.precoMedio || 0);
            saldoEl.textContent = `Saldo atual: ${qtd} ${unidade} | Preço médio: ${precoMedio}`;
        }
    }
}

function limparEntradaProdutoForm() {
    produtoAlmoxarifadoEmEdicao = null;
    const form = document.getElementById('entradaProdutoForm');
    if (form) form.reset();
    const dataEl = document.getElementById('entradaProdutoData');
    if (dataEl) dataEl.value = new Date().toISOString().split('T')[0];
    const tipoEl = document.getElementById('entradaProdutoTipoMov');
    if (tipoEl) {
        tipoEl.value = 'entrada';
        tipoEl.disabled = false;
    }
    const select = document.getElementById('entradaProdutoSelect');
    if (select) select.value = '';
    const nomeEl = document.getElementById('entradaProdutoNome');
    if (nomeEl) nomeEl.disabled = false;
    if (select) select.disabled = false;
    const categoriaEl = document.getElementById('entradaProdutoCategoria');
    if (categoriaEl) categoriaEl.value = 'Geral';
    const localizacaoEl = document.getElementById('entradaProdutoLocalizacao');
    if (localizacaoEl) localizacaoEl.value = 'Galpão';
    const estMinEl = document.getElementById('entradaProdutoEstoqueMinimo');
    if (estMinEl) estMinEl.value = '0';
    const saldoEl = document.getElementById('entradaProdutoSaldo');
    if (saldoEl) saldoEl.textContent = '';
    atualizarModoFormularioProduto(false);
}

async function salvarProdutoAlmoxarifadoPeloFormulario(e) {
    if (e && typeof e.preventDefault === 'function') e.preventDefault();
    const id = String(produtoAlmoxarifadoEmEdicao || '').trim();
    if (!id) return false;

    const dataEl = document.getElementById('entradaProdutoData');
    const nomeEl = document.getElementById('entradaProdutoNome');
    const categoriaEl = document.getElementById('entradaProdutoCategoria');
    const localizacaoEl = document.getElementById('entradaProdutoLocalizacao');
    const unidadeEl = document.getElementById('entradaProdutoUnidade');
    const qtdEl = document.getElementById('entradaProdutoQtd');
    const estMinEl = document.getElementById('entradaProdutoEstoqueMinimo');
    const precoEl = document.getElementById('entradaProdutoPreco');
    const docEl = document.getElementById('entradaProdutoDocumento');
    const obsEl = document.getElementById('entradaProdutoObs');

    const data = dataEl ? dataEl.value : '';
    const nome = String((nomeEl ? nomeEl.value : '') || '').trim();
    const categoria = String((categoriaEl ? categoriaEl.value : '') || 'Geral').trim();
    const localizacao = String((localizacaoEl ? localizacaoEl.value : '') || 'Galpão').trim();
    const unidade = String((unidadeEl ? unidadeEl.value : '') || '').trim() || 'un';
    const qtd = parseFloat(qtdEl ? qtdEl.value : 0);
    const estoqueMinimo = parseFloat(estMinEl ? estMinEl.value : 0) || 0;
    const precoMedio = parseCurrencyValue(precoEl ? precoEl.value : 0) || 0;
    const documento = String((docEl ? docEl.value : '') || '').trim();
    const obs = String((obsEl ? obsEl.value : '') || '').trim();

    if (!nome) {
        alert('Informe o nome do produto.');
        if (nomeEl) nomeEl.focus();
        return false;
    }
    if (!Number.isFinite(qtd) || qtd < 0) {
        alert('Informe uma quantidade válida maior ou igual a zero.');
        if (qtdEl) qtdEl.focus();
        return false;
    }

    const idx = (estoqueProdutos || []).findIndex(p => String(p.id) === id);
    if (idx < 0) {
        alert('Produto não encontrado.');
        produtoAlmoxarifadoEmEdicao = null;
        atualizarModoFormularioProduto(false);
        return false;
    }

    const dataIso = data ? new Date(`${data}T12:00:00`).toISOString() : new Date().toISOString();
    const atual = estoqueProdutos[idx] || {};
    const quantidadeAnterior = Number(atual.quantidade || 0);
    const quantidadeAlterada = Math.abs(qtd - quantidadeAnterior) > 0.000001;
    const direcaoAjuste = qtd >= quantidadeAnterior ? 'entrada' : 'saida';
    const quantidadeAjuste = Math.abs(qtd - quantidadeAnterior);
    estoqueProdutos[idx] = {
        ...atual,
        nome,
        categoria,
        localizacao,
        unidade,
        quantidade: qtd,
        estoqueMinimo,
        precoMedio,
        ultimoDocumento: documento || atual.ultimoDocumento || '',
        documentoUltimaMovimentacao: documento || atual.documentoUltimaMovimentacao || '',
        motivoDestino: obs || atual.motivoDestino || '',
        ultimoMotivo: obs || atual.ultimoMotivo || '',
        motivoUltimaMovimentacao: obs || atual.motivoUltimaMovimentacao || '',
        ultimaAtualizacao: dataIso
    };

    if (quantidadeAlterada) {
        atualizarProdutoUltimaMovimentacao(estoqueProdutos[idx], {
            tipo: 'ajuste',
            direcaoEstoque: direcaoAjuste,
            dataIso,
            documento,
            motivo: obs || 'Ajuste de estoque via edição do produto'
        });
    }

    try {
        await saveDataProdutos('estoqueProdutos', estoqueProdutos);
        if (quantidadeAlterada) {
            const movsAntigas = normalizarListaProdutosFirebase(await getData('movimentacoesProdutos') || []);
            const mov = {
                id: generateUniqueId(obterPrefixoMovimentacaoProduto('ajuste', direcaoAjuste)),
                data: dataIso,
                tipo: 'ajuste',
                tipoLabel: obterLabelTipoMovimentacaoProduto('ajuste', direcaoAjuste),
                direcaoEstoque: direcaoAjuste,
                origem: 'edicao',
                produtoId: estoqueProdutos[idx].id,
                produtoNome: estoqueProdutos[idx].nome,
                quantidade: quantidadeAjuste,
                documento: documento || '',
                motivo: obs || 'Ajuste de estoque via edição do produto',
                usuario: 'sistema',
                saldoAnterior: quantidadeAnterior,
                saldoAtual: qtd,
                precoUnitario: precoMedio
            };
            const movsAtualizadas = [...movsAntigas, mov];
            await saveDataProdutos('movimentacoesProdutos', movsAtualizadas);
            movimentacoesProdutosCache = movsAtualizadas.slice();
        }
        alert(quantidadeAlterada ? 'Produto atualizado e ajuste registrado com sucesso.' : 'Produto atualizado com sucesso.');
        limparEntradaProdutoForm();
        try { atualizarEstatisticasProdutos(); } catch (_) {}
        try { prepararEntradaProdutos(); } catch (_) {}
        try { prepararBaixaProdutos(); } catch (_) {}
        try { filtrarProdutos(); } catch (_) { renderizarTabelaProdutos(estoqueProdutos); }
        showTab('produtos');
        return true;
    } catch (err) {
        console.error('Erro ao atualizar produto:', err);
        alert('Erro ao atualizar produto: ' + (err.message || err));
        return false;
    }
}

async function registrarEntradaProduto(e) {
    e.preventDefault();
    if (produtoAlmoxarifadoEmEdicao) {
        await salvarProdutoAlmoxarifadoPeloFormulario(e);
        return;
    }
    const dataEl = document.getElementById('entradaProdutoData');
    const tipoEl = document.getElementById('entradaProdutoTipoMov');
    const select = document.getElementById('entradaProdutoSelect');
    const nomeEl = document.getElementById('entradaProdutoNome');
    const categoriaEl = document.getElementById('entradaProdutoCategoria');
    const localizacaoEl = document.getElementById('entradaProdutoLocalizacao');
    const unidadeEl = document.getElementById('entradaProdutoUnidade');
    const qtdEl = document.getElementById('entradaProdutoQtd');
    const estMinEl = document.getElementById('entradaProdutoEstoqueMinimo');
    const precoEl = document.getElementById('entradaProdutoPreco');
    const docEl = document.getElementById('entradaProdutoDocumento');
    const obsEl = document.getElementById('entradaProdutoObs');

    const data = dataEl ? dataEl.value : '';
    const tipoMovimentacao = ['entrada', 'ajuste'].includes(normalizarTipoMovimentacaoProduto(tipoEl ? tipoEl.value : 'entrada'))
        ? normalizarTipoMovimentacaoProduto(tipoEl ? tipoEl.value : 'entrada')
        : 'entrada';
    const direcaoEstoque = 'entrada';
    const prodId = select ? select.value : '';
    const nome = (nomeEl ? nomeEl.value : '').trim();
    const categoria = (categoriaEl ? categoriaEl.value : '') || 'Geral';
    const localizacao = (localizacaoEl ? localizacaoEl.value : '') || 'Galpão';
    const unidade = (unidadeEl ? unidadeEl.value : '').trim() || 'un';
    const qtd = parseFloat(qtdEl ? qtdEl.value : 0) || 0;
    const estoqueMinimo = parseFloat(estMinEl ? estMinEl.value : 0) || 0;
    const precoUnit = parseCurrencyValue(precoEl ? precoEl.value : 0) || 0;
    const documento = (docEl ? docEl.value : '').trim();
    const obs = (obsEl ? obsEl.value : '').trim();

    if (!data || qtd <= 0) {
        alert('Informe data e quantidade válida.');
        return;
    }

    let produto = null;
    if (prodId) {
        produto = estoqueProdutos.find(p => String(p.id) === String(prodId));
    }
    if (!produto && nome) {
        produto = estoqueProdutos.find(p => String(p.nome || '').toLowerCase() === nome.toLowerCase());
    }

    if (!produto && !nome) {
        alert('Informe o produto.');
        return;
    }

    const nowIso = new Date().toISOString();
    if (!produto) {
        produto = {
            id: generateUniqueId('PROD'),
            nome: nome,
            categoria: categoria,
            localizacao: localizacao,
            unidade: unidade,
            quantidade: 0,
            estoqueMinimo: estoqueMinimo,
            precoMedio: 0,
            ultimaAtualizacao: nowIso
        };
        estoqueProdutos.push(produto);
    } else {
        if (categoria) produto.categoria = categoria;
        if (localizacao) produto.localizacao = localizacao;
        if (Number.isFinite(estoqueMinimo)) produto.estoqueMinimo = estoqueMinimo;
    }

    const oldQtd = parseFloat(produto.quantidade || 0) || 0;
    const oldPreco = parseFloat(produto.precoMedio || 0) || 0;
    const effectivePreco = precoUnit > 0 ? precoUnit : oldPreco;
    const newQtd = oldQtd + qtd;
    const newPreco = newQtd > 0 ? ((oldQtd * oldPreco) + (qtd * effectivePreco)) / newQtd : 0;

    const dataMovIso = data ? new Date(`${data}T12:00:00`).toISOString() : nowIso;
    produto.quantidade = newQtd;
    produto.precoMedio = newPreco;
    produto.unidade = unidade;
    atualizarProdutoUltimaMovimentacao(produto, {
        tipo: tipoMovimentacao,
        direcaoEstoque,
        dataIso: nowIso,
        documento,
        motivo: obs
    });

    const mov = {
        id: generateUniqueId(obterPrefixoMovimentacaoProduto(tipoMovimentacao, direcaoEstoque)),
        data: dataMovIso,
        tipo: tipoMovimentacao,
        tipoLabel: obterLabelTipoMovimentacaoProduto(tipoMovimentacao, direcaoEstoque),
        direcaoEstoque,
        origem: 'manual',
        produtoId: produto.id,
        produtoNome: produto.nome,
        quantidade: qtd,
        documento: documento || '',
        motivo: obs || '',
        usuario: 'sistema',
        saldoAnterior: oldQtd,
        saldoAtual: produto.quantidade,
        precoUnitario: precoUnit
    };

    try {
        const movsAntigas = normalizarListaProdutosFirebase(await getData('movimentacoesProdutos') || []);
        const movsAtualizadas = [...movsAntigas, mov];
        await saveDataProdutos('estoqueProdutos', estoqueProdutos);
        await saveDataProdutos('movimentacoesProdutos', movsAtualizadas);
        movimentacoesProdutosCache = movsAtualizadas.slice();
        alert(`${obterLabelTipoMovimentacaoProduto(tipoMovimentacao, direcaoEstoque)} registrada com sucesso!`);
        limparEntradaProdutoForm();
        carregarEstoqueProdutos();
    } catch (err) {
        console.error("Erro na entrada:", err);
        alert('Erro ao registrar entrada: ' + err.message);
    }
}

function obterListaProdutosParaRender(lista) {
    if (Array.isArray(lista)) return lista.slice();
    if (Array.isArray(produtosUltimaListaRenderizada)) return produtosUltimaListaRenderizada.slice();
    return Array.isArray(estoqueProdutos) ? estoqueProdutos.slice() : [];
}

function escapeProdutoHtml(value) {
    return String(value ?? '')
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
}

function escapeProdutoAttr(value) {
    return String(value ?? '')
        .replace(/&/g, '&amp;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;');
}

function getProdutosColumnsDefs() {
    return [
        { key: 'nome', label: 'Produto' },
        { key: 'categoria', label: 'Categoria' },
        { key: 'localizacao', label: 'Localização' },
        { key: 'status', label: 'Status', align: 'text-center' },
        { key: 'responsavel', label: 'Responsável' },
        { key: 'motivoDestino', label: 'Motivo / Destino' },
        { key: 'tipoMovimentacao', label: 'Última Mov.' },
        { key: 'unidade', label: 'Unidade', align: 'text-center' },
        { key: 'quantidade', label: 'Quantidade', align: 'text-center' },
        { key: 'estoqueMinimo', label: 'Est. Mínimo', align: 'text-center' },
        { key: 'precoMedio', label: 'Preço Médio', align: 'text-right' },
        { key: 'valorTotal', label: 'Total', align: 'text-right' },
        { key: 'ultimaAtualizacao', label: 'Última Atualização', align: 'text-center' }
    ];
}

function getProdutosPreferenceUser() {
    try {
        const user = window.firebaseAuthUser || (window.firebaseService && window.firebaseService.authService && window.firebaseService.authService.getAuth && window.firebaseService.authService.getAuth().currentUser);
        if (user && user.uid) return String(user.uid);
    } catch (_) {}
    try {
        const current = JSON.parse(localStorage.getItem('currentUser') || 'null') || {};
        const persistent = JSON.parse(localStorage.getItem('persistentUser') || 'null') || {};
        return String(current.uid || current.id || current.userId || persistent.uid || persistent.id || persistent.userId || 'anon');
    } catch (_) {}
    return 'anon';
}

function getProdutosPreferenceTenant() {
    try {
        if (typeof resolveCompanyId === 'function') return resolveCompanyId() || 'default';
    } catch (_) {}
    try {
        const svc = window.firebaseService || window.FirebaseService;
        if (svc && typeof svc.getTenantId === 'function') return String(svc.getTenantId() || 'default');
        if (svc && typeof svc.getCurrentTenantId === 'function') return String(svc.getCurrentTenantId() || 'default');
    } catch (_) {}
    try {
        if (window.appTenantId) return String(window.appTenantId);
        const raw = localStorage.getItem('company_info');
        if (raw) {
            const obj = JSON.parse(raw);
            return String(obj.companyId || obj.companyID || obj.tenantId || obj.id || 'default');
        }
    } catch (_) {}
    return 'default';
}

function getProdutosColumnsStorageKey() {
    return `estoque_${getProdutosPreferenceTenant()}_${getProdutosPreferenceUser()}_produtos_columns`;
}

function getProdutosColumnsRemotePath() {
    return `users/${getProdutosPreferenceUser()}/preferences/estoqueProdutosColumns/${getProdutosPreferenceTenant()}`;
}

function getDefaultProdutosColumnsConfig() {
    const cfg = {};
    getProdutosColumnsDefs().forEach(d => { cfg[d.key] = true; });
    return cfg;
}

function getProdutosColumnsConfigSync() {
    const defaults = getDefaultProdutosColumnsConfig();
    try {
        const raw = localStorage.getItem(getProdutosColumnsStorageKey());
        if (!raw) return defaults;
        const parsed = JSON.parse(raw);
        if (!parsed || typeof parsed !== 'object') return defaults;
        const normalized = { ...defaults };
        const defs = getProdutosColumnsDefs();
        defs.forEach(d => {
            if (Object.prototype.hasOwnProperty.call(parsed, d.key)) {
                normalized[d.key] = parsed[d.key] !== false;
            }
        });
        if (defs.length && defs.every(d => normalized[d.key] === false)) {
            normalized[defs[0].key] = true;
        }
        return normalized;
    } catch (_) {
        return defaults;
    }
}

async function ensureProdutosColumnsConfigLoaded() {
    try {
        if (localStorage.getItem(getProdutosColumnsStorageKey())) return;
    } catch (_) {}
    try {
        if (getProdutosPreferenceUser() !== 'anon' && typeof getData === 'function') {
            const remote = await getData(getProdutosColumnsRemotePath(), { debounceMs: 0 });
            if (remote && typeof remote === 'object') {
                localStorage.setItem(getProdutosColumnsStorageKey(), JSON.stringify(remote));
            }
        }
    } catch (_) {}
}

function getVisibleProdutosColumns() {
    const cfg = getProdutosColumnsConfigSync();
    const defs = getProdutosColumnsDefs();
    const visible = defs.filter(d => cfg[d.key] !== false);
    return visible.length ? visible : defs.slice(0, 1);
}

function getVisibleProdutosColumnsCount() {
    return getVisibleProdutosColumns().length;
}

function applyProdutosColumnsConfig() {
    const tab = document.getElementById('produtos');
    if (tab && tab.classList.contains('active')) {
        renderizarTabelaProdutos();
    }
}

async function saveProdutosColumnsConfig(config = {}) {
    const defs = getProdutosColumnsDefs();
    const sanitized = {};
    defs.forEach(d => { sanitized[d.key] = config[d.key] !== false; });
    if (defs.length && defs.every(d => sanitized[d.key] === false)) {
        sanitized[defs[0].key] = true;
    }
    try { localStorage.setItem(getProdutosColumnsStorageKey(), JSON.stringify(sanitized)); } catch (_) {}
    try {
        if (getProdutosPreferenceUser() !== 'anon' && typeof saveData === 'function') {
            await saveData(getProdutosColumnsRemotePath(), sanitized, { debounceMs: 0, showToast: false });
        }
    } catch (_) {}
    applyProdutosColumnsConfig();
    return sanitized;
}

function atualizarEstadoTodasColunasProdutos() {
    const master = document.getElementById('produtosColumnsSelectAll');
    const checks = Array.from(document.querySelectorAll('#produtosColumnsConfigModal .report-col-check'));
    if (!master || checks.length === 0) return;
    const checkedCount = checks.filter(cb => cb.checked).length;
    master.checked = checkedCount === checks.length;
    master.indeterminate = checkedCount > 0 && checkedCount < checks.length;
}

function toggleTodasColunasProdutos(checked) {
    document.querySelectorAll('#produtosColumnsConfigModal .report-col-check').forEach(cb => {
        cb.checked = !!checked;
    });
    atualizarEstadoTodasColunasProdutos();
}

async function abrirConfiguracaoColunasProdutos() {
    await ensureProdutosColumnsConfigLoaded();
    if (!document.getElementById('produtosColumnsConfigModal')) {
        document.body.insertAdjacentHTML('beforeend', `
            <div id="produtosColumnsConfigModal" class="modal">
                <div class="modal-content">
                    <div class="modal-header">
                        <h3 class="modal-title"><i class="fas fa-list"></i> Colunas do Almoxarifado</h3>
                        <span class="close-modal" onclick="fecharConfiguracaoColunasProdutos()">&times;</span>
                    </div>
                    <div class="modal-body">
                        <div style="color:#64748b; font-size:13px; margin-bottom:10px;">Escolha as colunas visíveis na tabela do Almoxarifado e na impressão.</div>
                        <label class="report-col-item" style="margin-bottom:10px;">
                            <input type="checkbox" id="produtosColumnsSelectAll" onchange="toggleTodasColunasProdutos(this.checked)">
                            <span class="report-col-label"><strong>Selecionar todas as colunas</strong></span>
                        </label>
                        <div id="produtosColumnsConfigList"></div>
                    </div>
                    <div class="modal-footer" style="display:flex; justify-content:space-between; gap:10px; flex-wrap:wrap;">
                        <button type="button" class="btn btn-secondary" id="produtosColsResetBtn"><i class="fas fa-undo"></i> Restaurar Padrão</button>
                        <div style="display:flex; gap:10px; flex-wrap:wrap;">
                            <button type="button" class="btn btn-secondary" onclick="fecharConfiguracaoColunasProdutos()"><i class="fas fa-times"></i> Cancelar</button>
                            <button type="button" class="btn btn-primary" onclick="salvarConfiguracaoColunasProdutos()"><i class="fas fa-check"></i> Salvar</button>
                        </div>
                    </div>
                </div>
            </div>
        `);
        const modalEl = document.getElementById('produtosColumnsConfigModal');
        if (modalEl) {
            modalEl.addEventListener('click', (e) => {
                if (e.target === modalEl) fecharConfiguracaoColunasProdutos();
            });
        }
        const resetBtn = document.getElementById('produtosColsResetBtn');
        if (resetBtn) {
            resetBtn.addEventListener('click', () => {
                const defaults = getDefaultProdutosColumnsConfig();
                document.querySelectorAll('#produtosColumnsConfigModal .report-col-check').forEach(cb => {
                    const key = cb.getAttribute('data-col');
                    cb.checked = defaults[key] !== false;
                });
                atualizarEstadoTodasColunasProdutos();
            });
        }
    }

    const defs = getProdutosColumnsDefs();
    const cfg = getProdutosColumnsConfigSync();
    const list = document.getElementById('produtosColumnsConfigList');
    if (list) {
        list.innerHTML = `<div class="report-col-grid">${defs.map(d => `
            <label class="report-col-item">
                <input type="checkbox" class="report-col-check" data-col="${escapeProdutoHtml(d.key)}" ${cfg[d.key] !== false ? 'checked' : ''} onchange="atualizarEstadoTodasColunasProdutos()">
                <span class="report-col-label">${escapeProdutoHtml(d.label)}</span>
            </label>
        `).join('')}</div>`;
    }
    atualizarEstadoTodasColunasProdutos();
    const modal = document.getElementById('produtosColumnsConfigModal');
    if (modal) modal.style.display = 'block';
}

function fecharConfiguracaoColunasProdutos() {
    const modal = document.getElementById('produtosColumnsConfigModal');
    if (modal) modal.style.display = 'none';
}

async function salvarConfiguracaoColunasProdutos() {
    const cfg = {};
    getProdutosColumnsDefs().forEach(d => { cfg[d.key] = true; });
    document.querySelectorAll('#produtosColumnsConfigModal .report-col-check').forEach(cb => {
        const key = cb.getAttribute('data-col');
        if (key) cfg[key] = !!cb.checked;
    });
    await saveProdutosColumnsConfig(cfg);
    fecharConfiguracaoColunasProdutos();
    renderizarTabelaProdutos();
}

function obterResponsavelProduto(prod = {}) {
    const direto = normalizarNomeResponsavelProduto(prod.responsavel || prod.ultimoResponsavel || prod.responsavelUltimaMovimentacao);
    if (direto) return direto;

    const produtoId = String(prod.id || '').trim();
    const produtoNome = String(prod.nome || '').trim().toLowerCase();
    const movimentos = (movimentacoesProdutosCache || [])
        .filter(mov => {
            const movProdutoId = String(mov.produtoId || '').trim();
            const movProdutoNome = String(mov.produtoNome || '').trim().toLowerCase();
            return (produtoId && movProdutoId === produtoId) || (produtoNome && movProdutoNome === produtoNome);
        })
        .sort((a, b) => new Date(b.data || b.createdAt || 0) - new Date(a.data || a.createdAt || 0));

    for (const mov of movimentos) {
        const responsavel = normalizarNomeResponsavelProduto(getResponsavelMovimentoProduto(mov));
        if (responsavel) return responsavel;
    }
    return '';
}

function obterMovimentacoesProduto(prod = {}) {
    const produtoId = String(prod.id || '').trim();
    const produtoNome = String(prod.nome || '').trim().toLowerCase();
    return (movimentacoesProdutosCache || [])
        .filter(mov => {
            const movProdutoId = String(mov.produtoId || '').trim();
            const movProdutoNome = String(mov.produtoNome || '').trim().toLowerCase();
            return (produtoId && movProdutoId === produtoId) || (produtoNome && movProdutoNome === produtoNome);
        })
        .sort((a, b) => new Date(b.data || b.createdAt || 0) - new Date(a.data || a.createdAt || 0));
}

function obterMotivoDestinoProduto(prod = {}) {
    const direto = normalizarNomeResponsavelProduto(prod.motivoDestino || prod.ultimoMotivo || prod.motivoUltimaMovimentacao || prod.destino);
    if (direto) return direto;

    for (const mov of obterMovimentacoesProduto(prod)) {
        const motivo = normalizarNomeResponsavelProduto(mov.motivo || mov.destino || mov.observacoes || mov.obs);
        if (motivo) return motivo;
    }
    return '';
}

function obterTipoMovimentacaoProduto(prod = {}) {
    const direto = prod.ultimaMovimentacaoTipo || prod.tipoUltimaMovimentacao || prod.tipoMovimentacao;
    if (direto) {
        return obterLabelTipoMovimentacaoProduto(direto, prod.ultimaMovimentacaoDirecao || prod.direcaoUltimaMovimentacao);
    }

    const ultimo = obterMovimentacoesProduto(prod)[0];
    if (ultimo) {
        return obterLabelTipoMovimentacaoProduto(ultimo.tipo, obterDirecaoMovimentoProduto(ultimo));
    }
    return '';
}

function obterValorCelulaProduto(prod = {}, key = '') {
    const total = (prod.quantidade || 0) * (prod.precoMedio || 0);
    const dataFmt = prod.ultimaAtualizacao ? new Date(prod.ultimaAtualizacao).toLocaleDateString('pt-BR') : '-';
    const qtd = Number(prod.quantidade || 0);
    const estMin = Number(prod.estoqueMinimo || 0);

    let statusHtml = '<span style="display:inline-block; padding:2px 8px; border-radius:12px; font-weight:600; font-size:11px; background:#dcfce7; color:#166534;">Normal</span>';
    if (qtd <= 0) {
        statusHtml = '<span style="display:inline-block; padding:2px 8px; border-radius:12px; font-weight:600; font-size:11px; background:#fee2e2; color:#991b1b;">Crítico</span>';
    } else if (estMin > 0 && qtd <= estMin) {
        statusHtml = '<span style="display:inline-block; padding:2px 8px; border-radius:12px; font-weight:600; font-size:11px; background:#fef3c7; color:#92400e;">Ponto Pedido</span>';
    }

    const map = {
        nome: escapeProdutoHtml(prod.nome || ''),
        categoria: escapeProdutoHtml(prod.categoria || 'Geral'),
        localizacao: escapeProdutoHtml(prod.localizacao || 'Galpão'),
        status: statusHtml,
        responsavel: escapeProdutoHtml(obterResponsavelProduto(prod) || '-'),
        motivoDestino: escapeProdutoHtml(obterMotivoDestinoProduto(prod) || '-'),
        tipoMovimentacao: escapeProdutoHtml(obterTipoMovimentacaoProduto(prod) || '-'),
        unidade: escapeProdutoHtml(prod.unidade || 'un'),
        quantidade: formatNumber(prod.quantidade, 2),
        estoqueMinimo: formatNumber(prod.estoqueMinimo || 0, 2),
        precoMedio: formatCurrency(prod.precoMedio),
        valorTotal: formatCurrency(total),
        ultimaAtualizacao: dataFmt
    };
    return map[key] ?? '';
}

function renderProdutoTd(def, prod) {
    const cls = def.align ? ` class="${def.align}"` : '';
    const label = def.label || def.key || '';
    const strongOpen = def.key === 'nome' ? '<strong>' : '';
    const strongClose = def.key === 'nome' ? '</strong>' : '';
    return `<td data-col="${escapeProdutoHtml(def.key)}" data-label="${escapeProdutoHtml(label)}"${cls}>${strongOpen}${obterValorCelulaProduto(prod, def.key)}${strongClose}</td>`;
}

function renderizarTabelaProdutos(lista) {
    const tbody = document.getElementById('produtosTable');
    if (!tbody) return;

    const listaRender = obterListaProdutosParaRender(lista);
    tbody.innerHTML = '';
    produtosFiltrados = listaRender.slice();
    produtosUltimaListaRenderizada = listaRender.slice();

    const totalQtd = produtosFiltrados.reduce((acc, p) => acc + (p.quantidade || 0), 0);
    const totalVal = produtosFiltrados.reduce((acc, p) => acc + ((p.quantidade || 0) * (p.precoMedio || 0)), 0);
    const criticosCount = produtosFiltrados.filter(p => Number(p.quantidade || 0) <= 0).length;

    const totalProdutosEl = document.getElementById('totalProdutos');
    const quantidadeTotalProdutosEl = document.getElementById('quantidadeTotalProdutos');
    const valorTotalAlmoxarifadoEl = document.getElementById('valorTotalAlmoxarifado');
    const produtosEstoqueBaixoEl = document.getElementById('produtosEstoqueBaixo');
    if (totalProdutosEl) totalProdutosEl.textContent = produtosFiltrados.length;
    if (quantidadeTotalProdutosEl) quantidadeTotalProdutosEl.textContent = formatNumber(totalQtd, 2);
    if (valorTotalAlmoxarifadoEl) valorTotalAlmoxarifadoEl.textContent = formatCurrency(totalVal);
    if (produtosEstoqueBaixoEl) produtosEstoqueBaixoEl.textContent = criticosCount;

    const defs = getVisibleProdutosColumns();

    // Renderizar colgroup e thead dinâmicos com base nas colunas ativas
    const colgroupEl = document.getElementById('tabelaProdutosColgroup');
    if (colgroupEl) {
        colgroupEl.innerHTML = `
            <col style="width: 40px;">
            ${defs.map(def => `<col class="${escapeProdutoHtml(def.key)}" data-col="${escapeProdutoHtml(def.key)}">`).join('')}
            <col class="acoes" style="width: 80px;">
        `;
    }

    const theadEl = document.getElementById('tabelaProdutosThead');
    if (theadEl) {
        theadEl.innerHTML = `
            <tr>
                <th style="width: 40px;"><input type="checkbox" id="checkTodosProdutos" onchange="toggleTodosProdutos()"></th>
                ${defs.map(def => {
                    const sortIcon = (ordemProdutos.coluna === def.key)
                        ? `<i class="fas fa-sort-${ordemProdutos.direcao === 'asc' ? 'up' : 'down'} sort-icon" style="color:#2b6cb0; margin-left:4px;"></i>`
                        : '<i class="fas fa-sort sort-icon" style="opacity:0.35; margin-left:4px;"></i>';
                    const cls = def.align ? ` class="${def.align}"` : '';
                    return `<th data-col="${escapeProdutoHtml(def.key)}"${cls} onclick="ordenarProdutos('${escapeProdutoHtml(def.key)}')" style="cursor: pointer;">${escapeProdutoHtml(def.label)} ${sortIcon}</th>`;
                }).join('')}
                <th class="text-center actions-col sticky-actions">Ações</th>
            </tr>
        `;
    }

    if (listaRender.length === 0) {
        tbody.innerHTML = `<tr><td colspan="${defs.length + 2}" class="text-center">Nenhum produto em estoque.</td></tr>`;
        if (typeof renderizarPaginacaoPadrao === 'function') {
            const pageSize = typeof window.obterItensPorPaginaTabela === 'function' ? window.obterItensPorPaginaTabela('produtos') : 10;
            renderizarPaginacaoPadrao('paginacaoProdutos', 0, 1, pageSize, 'mudarPaginaProdutos', { sizeScope: 'produtos' });
        }
        return;
    }

    // Ordenar de acordo com a configuração
    listaRender.sort((a, b) => {
        let valA = a[ordemProdutos.coluna];
        let valB = b[ordemProdutos.coluna];

        // Colunas virtuais
        if (ordemProdutos.coluna === 'valorTotal') {
            valA = (a.quantidade || 0) * (a.precoMedio || 0);
            valB = (b.quantidade || 0) * (b.precoMedio || 0);
        } else if (ordemProdutos.coluna === 'responsavel') {
            valA = obterResponsavelProduto(a);
            valB = obterResponsavelProduto(b);
        } else if (ordemProdutos.coluna === 'motivoDestino') {
            valA = obterMotivoDestinoProduto(a);
            valB = obterMotivoDestinoProduto(b);
        } else if (ordemProdutos.coluna === 'tipoMovimentacao') {
            valA = obterTipoMovimentacaoProduto(a);
            valB = obterTipoMovimentacaoProduto(b);
        }

        if (typeof valA === 'string') valA = valA.toLowerCase();
        if (typeof valB === 'string') valB = valB.toLowerCase();

        if (valA < valB) return ordemProdutos.direcao === 'asc' ? -1 : 1;
        if (valA > valB) return ordemProdutos.direcao === 'asc' ? 1 : -1;
        return 0;
    });

    const itensPorPaginaProdutos = typeof window.obterItensPorPaginaTabela === 'function' ? window.obterItensPorPaginaTabela('produtos') : 10;
    const totalPaginas = Math.max(1, Math.ceil(listaRender.length / itensPorPaginaProdutos));
    if (paginaAtualProdutos > totalPaginas) paginaAtualProdutos = totalPaginas;
    if (paginaAtualProdutos < 1) paginaAtualProdutos = 1;
    const inicio = (paginaAtualProdutos - 1) * itensPorPaginaProdutos;
    const pagina = listaRender.slice(inicio, inicio + itensPorPaginaProdutos);

    tbody.innerHTML = pagina.map(prod => {
        const isChecked = produtosSelecionados.has(String(prod.id)) ? 'checked' : '';
        return `
            <tr>
                <td class="text-center" data-label="Selecionar"><input type="checkbox" class="check-produto" value="${prod.id}" ${isChecked} onchange="toggleProduto('${prod.id}', this.checked)"></td>
                ${defs.map(def => renderProdutoTd(def, prod)).join('')}
                <td class="text-center actions-cell sticky-actions" data-label="Ações">
                    <div class="actions-cell-inner stock-actions-cell">
                        <button class="stock-btn-action stock-btn-edit" onclick="abrirEditarProdutoAlmoxarifado('${String(prod.id || '').replace(/'/g, "\\'")}')" title="Editar Produto">
                            <i class="fas fa-edit"></i>
                        </button>
                        <button class="stock-btn-action stock-btn-down" onclick="prepararBaixaProdutoInline('${String(prod.id || '').replace(/'/g, "\\'")}')" title="Baixa / Consumo">
                            <i class="fas fa-arrow-down"></i>
                        </button>
                    </div>
                </td>
            </tr>
        `;
    }).join('');

    if (typeof renderizarPaginacaoPadrao === 'function') {
        renderizarPaginacaoPadrao('paginacaoProdutos', listaRender.length, paginaAtualProdutos, itensPorPaginaProdutos, 'mudarPaginaProdutos', { sizeScope: 'produtos' });
    }

    if (window.StockTableColumns && typeof window.StockTableColumns.initTable === 'function') {
        const table = document.getElementById('tabelaProdutos');
        if (table) window.StockTableColumns.initTable(table, 'produtos_saldo');
    }
}

function abrirEditarProdutoAlmoxarifado(prodId) {
    const id = String(prodId || '').trim();
    if (!id) return;
    const prod = (estoqueProdutos || []).find(p => String(p.id) === id);
    if (!prod) {
        alert('Produto não encontrado.');
        return;
    }
    
    const setVal = (elementId, value) => {
        const el = document.getElementById(elementId);
        if (el) el.value = value;
    };

    setVal('editModalProdutoId', String(prod.id));
    setVal('editModalProdutoNome', String(prod.nome || '').trim());
    setVal('editModalProdutoCategoria', String(prod.categoria || 'Geral').trim());
    setVal('editModalProdutoLocalizacao', String(prod.localizacao || 'Galpão').trim());
    setVal('editModalProdutoUnidade', String(prod.unidade || 'un').trim());
    setVal('editModalProdutoQtd', Number(prod.quantidade || 0));
    setVal('editModalProdutoEstoqueMinimo', Number(prod.estoqueMinimo || 0));
    setVal('editModalProdutoPreco', formatCurrency(prod.precoMedio || 0));
    setVal('editModalProdutoDocumento', obterDocumentoProdutoParaFormulario(prod));
    setVal('editModalProdutoResponsavel', obterResponsavelProduto(prod));
    setVal('editModalProdutoData', obterDataProdutoParaFormulario(prod) || new Date().toISOString().split('T')[0]);
    setVal('editModalProdutoObs', obterObservacaoProdutoParaFormulario(prod));

    if (typeof abrirModal === 'function') {
        abrirModal('modalEditarProdutoAlmoxarifado');
    } else {
        const m = document.getElementById('modalEditarProdutoAlmoxarifado');
        if (m) m.style.display = 'block';
    }
    const nomeEl = document.getElementById('editModalProdutoNome');
    if (nomeEl) {
        setTimeout(() => { nomeEl.focus(); if (typeof nomeEl.select === 'function') nomeEl.select(); }, 80);
    }
}

async function salvarEdicaoModalProdutoAlmoxarifado(e) {
    if (e && typeof e.preventDefault === 'function') e.preventDefault();
    const id = String(document.getElementById('editModalProdutoId')?.value || '').trim();
    if (!id) return false;

    const nome = String(document.getElementById('editModalProdutoNome')?.value || '').trim();
    const categoria = String(document.getElementById('editModalProdutoCategoria')?.value || 'Geral').trim();
    const localizacao = String(document.getElementById('editModalProdutoLocalizacao')?.value || 'Galpão').trim();
    const unidade = String(document.getElementById('editModalProdutoUnidade')?.value || 'un').trim();
    const qtd = parseFloat(document.getElementById('editModalProdutoQtd')?.value || 0);
    const estoqueMinimo = parseFloat(document.getElementById('editModalProdutoEstoqueMinimo')?.value || 0) || 0;
    const precoMedio = parseCurrencyValue(document.getElementById('editModalProdutoPreco')?.value || 0) || 0;
    const documento = String(document.getElementById('editModalProdutoDocumento')?.value || '').trim();
    const responsavel = String(document.getElementById('editModalProdutoResponsavel')?.value || '').trim();
    const data = document.getElementById('editModalProdutoData')?.value || '';
    const obs = String(document.getElementById('editModalProdutoObs')?.value || '').trim();

    if (!nome) {
        alert('Informe o nome do produto.');
        document.getElementById('editModalProdutoNome')?.focus();
        return false;
    }
    if (!Number.isFinite(qtd) || qtd < 0) {
        alert('Informe uma quantidade válida maior ou igual a zero.');
        document.getElementById('editModalProdutoQtd')?.focus();
        return false;
    }

    const idx = (estoqueProdutos || []).findIndex(p => String(p.id) === id);
    if (idx < 0) {
        alert('Produto não encontrado.');
        return false;
    }

    const dataIso = data ? new Date(`${data}T12:00:00`).toISOString() : new Date().toISOString();
    const atual = estoqueProdutos[idx] || {};
    const quantidadeAnterior = Number(atual.quantidade || 0);
    const quantidadeAlterada = Math.abs(qtd - quantidadeAnterior) > 0.000001;
    const direcaoAjuste = qtd >= quantidadeAnterior ? 'entrada' : 'saida';
    const quantidadeAjuste = Math.abs(qtd - quantidadeAnterior);

    estoqueProdutos[idx] = {
        ...atual,
        nome,
        categoria,
        localizacao,
        unidade,
        quantidade: qtd,
        estoqueMinimo,
        precoMedio,
        responsavel: responsavel || atual.responsavel || '',
        ultimoResponsavel: responsavel || atual.ultimoResponsavel || '',
        responsavelUltimaMovimentacao: responsavel || atual.responsavelUltimaMovimentacao || '',
        ultimoDocumento: documento || atual.ultimoDocumento || '',
        documentoUltimaMovimentacao: documento || atual.documentoUltimaMovimentacao || '',
        motivoDestino: obs || atual.motivoDestino || '',
        ultimoMotivo: obs || atual.ultimoMotivo || '',
        motivoUltimaMovimentacao: obs || atual.motivoUltimaMovimentacao || '',
        ultimaAtualizacao: dataIso
    };

    if (quantidadeAlterada) {
        atualizarProdutoUltimaMovimentacao(estoqueProdutos[idx], {
            tipo: 'ajuste',
            direcaoEstoque: direcaoAjuste,
            dataIso,
            documento,
            motivo: obs || 'Ajuste de estoque via edição de produto',
            responsavel
        });
    }

    try {
        await saveDataProdutos('estoqueProdutos', estoqueProdutos);
        if (quantidadeAlterada) {
            const movsAntigas = normalizarListaProdutosFirebase(await getData('movimentacoesProdutos') || []);
            const mov = {
                id: generateUniqueId(obterPrefixoMovimentacaoProduto('ajuste', direcaoAjuste)),
                data: dataIso,
                tipo: 'ajuste',
                tipoLabel: obterLabelTipoMovimentacaoProduto('ajuste', direcaoAjuste),
                direcaoEstoque: direcaoAjuste,
                origem: 'edicao',
                produtoId: estoqueProdutos[idx].id,
                produtoNome: estoqueProdutos[idx].nome,
                quantidade: quantidadeAjuste,
                documento: documento || '',
                motivo: obs || 'Ajuste de estoque via edição de produto',
                usuario: responsavel || 'sistema',
                responsavel: responsavel || '',
                saldoAnterior: quantidadeAnterior,
                saldoAtual: qtd,
                precoUnitario: precoMedio
            };
            const movsAtualizadas = [...movsAntigas, mov];
            await saveDataProdutos('movimentacoesProdutos', movsAtualizadas);
            movimentacoesProdutosCache = movsAtualizadas.slice();
        }

        if (typeof fecharModal === 'function') {
            fecharModal('modalEditarProdutoAlmoxarifado');
        } else {
            const m = document.getElementById('modalEditarProdutoAlmoxarifado');
            if (m) m.style.display = 'none';
        }

        alert('Produto atualizado com sucesso!');
        try { filtrarProdutos(); } catch (_) { renderizarTabelaProdutos(estoqueProdutos); }
        return true;
    } catch (err) {
        console.error('Erro ao atualizar produto:', err);
        alert('Erro ao atualizar produto: ' + (err.message || err));
        return false;
    }
}

function limparFiltrosProdutosAlmoxarifado() {
    const ids = ['produtosDataInicio', 'produtosDataFim', 'produtosFiltroCategoria', 'produtosFiltroLocalizacao', 'produtosResponsavelFiltro', 'searchProdutos', 'produtosFiltroSaldo'];
    ids.forEach(id => {
        const el = document.getElementById(id);
        if (el) el.value = '';
    });
    filtrarProdutos();
}

function getResponsavelMovimentoProduto(mov = {}) {
    return String(mov.responsavel || mov.responsavelNome || mov.usuario || mov.user || mov.operador || '').trim();
}

function parseProdutoFiltroDate(value, endOfDay = false) {
    if (!value) return null;
    const d = new Date(value);
    if (Number.isNaN(d.getTime())) return null;
    if (endOfDay) d.setHours(23, 59, 59, 999);
    else d.setHours(0, 0, 0, 0);
    return d;
}

function produtoTemMovimentacaoCompativel(prod, filtros) {
    const temFiltroMovimento = !!(filtros.dataInicio || filtros.dataFim || filtros.responsavel);
    if (!temFiltroMovimento) return true;

    const produtoId = String(prod.id || '').trim();
    const produtoNome = String(prod.nome || '').trim().toLowerCase();
    const movimentosProduto = (movimentacoesProdutosCache || []).filter(m => {
        const movProdutoId = String(m.produtoId || '').trim();
        const movProdutoNome = String(m.produtoNome || '').trim().toLowerCase();
        return (produtoId && movProdutoId === produtoId) || (produtoNome && movProdutoNome === produtoNome);
    });

    const matchMovimento = movimentosProduto.some(m => {
        const dataMov = new Date(m.data || m.createdAt || m.dataMovimento || '');
        if (Number.isNaN(dataMov.getTime())) return false;
        if (filtros.dataInicio && dataMov < filtros.dataInicio) return false;
        if (filtros.dataFim && dataMov > filtros.dataFim) return false;
        if (filtros.responsavel && !getResponsavelMovimentoProduto(m).toLowerCase().includes(filtros.responsavel)) return false;
        return true;
    });
    if (matchMovimento) return true;

    if (filtros.responsavel) return false;
    const ultima = new Date(prod.ultimaAtualizacao || prod.ultimaSaida || '');
    if (Number.isNaN(ultima.getTime())) return false;
    if (filtros.dataInicio && ultima < filtros.dataInicio) return false;
    if (filtros.dataFim && ultima > filtros.dataFim) return false;
    return true;
}

function filtrarProdutos() {
    const termo = (document.getElementById('searchProdutos')?.value || '').toLowerCase().trim();
    const filtroSaldo = (document.getElementById('produtosFiltroSaldo')?.value || '').trim();
    const filtroCategoria = (document.getElementById('produtosFiltroCategoria')?.value || '').toLowerCase().trim();
    const filtroLocalizacao = (document.getElementById('produtosFiltroLocalizacao')?.value || '').toLowerCase().trim();
    const filtros = {
        dataInicio: parseProdutoFiltroDate(document.getElementById('produtosDataInicio')?.value || ''),
        dataFim: parseProdutoFiltroDate(document.getElementById('produtosDataFim')?.value || '', true),
        responsavel: (document.getElementById('produtosResponsavelFiltro')?.value || '').toLowerCase().trim()
    };
    const filtrados = estoqueProdutos.filter(p => {
        const matchText = !termo || (p.nome || '').toLowerCase().includes(termo) || (p.id || '').toLowerCase().includes(termo) || (p.ultimoDocumento || '').toLowerCase().includes(termo);
        if (!matchText) return false;
        if (filtroCategoria && (p.categoria || 'geral').toLowerCase() !== filtroCategoria) return false;
        if (filtroLocalizacao && (p.localizacao || 'galpão').toLowerCase() !== filtroLocalizacao) return false;
        if (!produtoTemMovimentacaoCompativel(p, filtros)) return false;
        const qtd = Number(p.quantidade || 0);
        const estMin = Number(p.estoqueMinimo || 0);
        if (filtroSaldo === 'positivo') return qtd > 0;
        if (filtroSaldo === 'zero') return qtd <= 0;
        if (filtroSaldo === 'ponto_pedido') return qtd > 0 && estMin > 0 && qtd <= estMin;
        return true;
    });
    paginaAtualProdutos = 1;
    renderizarTabelaProdutos(filtrados);
}

function mudarPaginaProdutos(p) {
    paginaAtualProdutos = p;
    renderizarTabelaProdutos(produtosFiltrados);
}

function atualizarEstatisticasProdutos() {
    const totalItens = estoqueProdutos.length;
    const valorTotal = estoqueProdutos.reduce((acc, p) => acc + ((p.quantidade || 0) * (p.precoMedio || 0)), 0);
    
    document.getElementById('totalProdutos').textContent = totalItens;
    document.getElementById('valorTotalAlmoxarifado').textContent = formatCurrency(valorTotal);
}

// --- Funções de Baixa de Produtos ---

function preencherSelectBaixaProduto(select, selectedId = '') {
    if (!select) return;
    const prev = selectedId || select.value;
    select.innerHTML = '<option value="">Selecione...</option>';
    estoqueProdutos
        .slice()
        .sort((a, b) => String(a.nome || '').localeCompare(String(b.nome || ''), 'pt-BR'))
        .forEach(p => {
            const opt = document.createElement('option');
            opt.value = String(p.id);
            opt.textContent = p.nome || p.id;
            select.appendChild(opt);
        });
    if (prev) select.value = String(prev);
}

function prepararBaixaProdutos() {
    const form = document.getElementById('baixaProdutoInlineForm');
    const dataInput = document.getElementById('baixaProdutoDataInline');
    const tipoInput = document.getElementById('baixaProdutoTipoMovInline');
    const select = document.getElementById('baixaProdutoSelectInline');
    const responsavelInput = document.getElementById('baixaProdutoResponsavelInline');

    if (dataInput && !dataInput.value) {
        dataInput.value = new Date().toISOString().split('T')[0];
    }
    if (tipoInput && !tipoInput.value) {
        tipoInput.value = 'saida';
    }

    preencherSelectBaixaProduto(select);
    atualizarDatalistResponsaveisProduto();
    configurarAutocompleteResponsavelProduto(responsavelInput);

    if (form && !form.dataset.boundInlineBaixa) {
        form.addEventListener('submit', registrarBaixaProdutoInline);
        form.dataset.boundInlineBaixa = '1';
    }

    if (select && !select.dataset.boundInlineBaixa) {
        select.addEventListener('change', atualizarInfoProdutoBaixaInline);
        select.dataset.boundInlineBaixa = '1';
    }

    atualizarInfoProdutoBaixaInline();
}

function atualizarInfoProdutoBaixaInline() {
    const select = document.getElementById('baixaProdutoSelectInline');
    const info = document.getElementById('baixaProdutoInfoInline');
    if (!select || !info) return;

    const prodId = select.value;
    if (!prodId) {
        info.textContent = '';
        return;
    }

    const prod = estoqueProdutos.find(p => String(p.id) === String(prodId));
    if (prod) {
        info.textContent = `Saldo atual: ${formatNumber(prod.quantidade || 0, 2)} ${prod.unidade || 'un'}`;
    }
}

function limparBaixaProdutoInlineForm() {
    const form = document.getElementById('baixaProdutoInlineForm');
    if (form) form.reset();
    const dataInput = document.getElementById('baixaProdutoDataInline');
    if (dataInput) dataInput.value = new Date().toISOString().split('T')[0];
    const tipoInput = document.getElementById('baixaProdutoTipoMovInline');
    if (tipoInput) tipoInput.value = 'saida';
    const info = document.getElementById('baixaProdutoInfoInline');
    if (info) info.textContent = '';
    mostrarAvisoResponsavelProduto(document.getElementById('baixaProdutoResponsavelInline'), '');
}

function prepararBaixaProdutoInline(prodId = null) {
    prepararBaixaProdutos();
    const select = document.getElementById('baixaProdutoSelectInline');
    if (select && prodId) {
        select.value = String(prodId);
        atualizarInfoProdutoBaixaInline();
    }
    const form = document.getElementById('baixaProdutoInlineForm');
    if (form && typeof form.scrollIntoView === 'function') {
        form.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    }
    const qtd = document.getElementById('baixaProdutoQtdInline');
    if (qtd) qtd.focus();
}

function abrirBaixaProduto(prodId = null) {
    const modal = document.getElementById('modalBaixaProduto');
    const select = document.getElementById('baixaProdutoSelect');
    const dataInput = document.getElementById('baixaProdutoData');
    const responsavelInput = document.getElementById('baixaProdutoResponsavel');
    const form = document.getElementById('formBaixaProduto');
    const info = document.getElementById('infoSaldoProduto');
    if (!modal || !select || !dataInput || !form) {
        prepararBaixaProdutoInline(prodId);
        return;
    }
    
    // Resetar form
    form.reset();
    if (info) info.textContent = '';
    const tipoInput = document.getElementById('baixaProdutoTipoMov');
    if (tipoInput) tipoInput.value = 'saida';
    
    // Data de hoje
    dataInput.value = new Date().toISOString().split('T')[0];
    
    // Preencher select
    preencherSelectBaixaProduto(select, prodId);
    atualizarDatalistResponsaveisProduto();
    configurarAutocompleteResponsavelProduto(responsavelInput);
    mostrarAvisoResponsavelProduto(responsavelInput, '');
    
    if (prodId) {
        atualizarInfoProdutoBaixa();
    }
    
    modal.style.display = 'block';
}

function atualizarInfoProdutoBaixa() {
    const select = document.getElementById('baixaProdutoSelect');
    const info = document.getElementById('infoSaldoProduto');
    if (!select || !info) return;
    const prodId = select.value;
    
    if (!prodId) {
        info.textContent = '';
        return;
    }
    
    const prod = estoqueProdutos.find(p => String(p.id) === String(prodId));
    if (prod) {
        info.textContent = `Saldo Atual: ${formatNumber(prod.quantidade, 2)} ${prod.unidade}`;
    }
}

async function confirmarBaixaProduto(e) {
    e.preventDefault();
    
    const prodId = document.getElementById('baixaProdutoSelect').value;
    const qtd = parseFloat(document.getElementById('baixaProdutoQtd').value);
    const motivo = document.getElementById('baixaProdutoMotivo').value;
    const data = document.getElementById('baixaProdutoData').value;
    const responsavel = obterResponsavelSelecionadoProduto('baixaProdutoResponsavel');
    const tipoMovimentacao = document.getElementById('baixaProdutoTipoMov')?.value || 'saida';
    
    const registrado = await registrarSaidaProduto({ prodId, qtd, motivo, data, responsavel, tipoMovimentacao });
    if (!registrado) return;

    alert(`${obterLabelTipoMovimentacaoProduto(tipoMovimentacao, 'saida')} registrada com sucesso!`);
    fecharModal('modalBaixaProduto');
    await carregarEstoqueProdutos();
}

async function registrarBaixaProdutoInline(e) {
    if (e && typeof e.preventDefault === 'function') e.preventDefault();

    const prodId = document.getElementById('baixaProdutoSelectInline')?.value || '';
    const qtd = parseFloat(document.getElementById('baixaProdutoQtdInline')?.value || 0);
    const motivo = document.getElementById('baixaProdutoMotivoInline')?.value || '';
    const data = document.getElementById('baixaProdutoDataInline')?.value || '';
    const responsavel = obterResponsavelSelecionadoProduto('baixaProdutoResponsavelInline');
    const tipoMovimentacao = document.getElementById('baixaProdutoTipoMovInline')?.value || 'saida';

    const registrado = await registrarSaidaProduto({ prodId, qtd, motivo, data, responsavel, tipoMovimentacao });
    if (!registrado) return;

    alert(`${obterLabelTipoMovimentacaoProduto(tipoMovimentacao, 'saida')} registrada com sucesso!`);
    limparBaixaProdutoInlineForm();
    await carregarEstoqueProdutos();
}

async function registrarSaidaProduto({ prodId, qtd, motivo, data, responsavel, tipoMovimentacao = 'saida' }) {
    const motivoFinal = String(motivo || '').trim();
    const responsavelFinal = String(responsavel || '').trim();
    const tipoNormalizado = normalizarTipoMovimentacaoProduto(tipoMovimentacao, 'saida');
    const tipoSaida = ['saida', 'ajuste', 'devolucao'].includes(tipoNormalizado) ? tipoNormalizado : 'saida';
    const direcaoEstoque = 'saida';

    if (!prodId || !(qtd > 0) || !data || !motivoFinal || !responsavelFinal) {
        alert('Preencha produto, data, responsável, quantidade e motivo/destino corretamente.');
        return false;
    }

    const prod = estoqueProdutos.find(p => String(p.id) === String(prodId));
    if (!prod) {
        alert('Produto não encontrado no estoque.');
        return false;
    }

    const saldoAtual = Number(prod.quantidade || 0);
    if (qtd > saldoAtual) {
        alert(`Quantidade indisponível! Saldo atual: ${formatNumber(saldoAtual, 2)} ${prod.unidade || 'un'}`);
        return false;
    }

    const tipoLabel = obterLabelTipoMovimentacaoProduto(tipoSaida, direcaoEstoque);
    if (!confirm(`Confirma ${tipoLabel.toLowerCase()} de ${formatNumber(qtd, 2)} ${prod.unidade || 'un'} de ${prod.nome}?`)) return false;

    try {
        // Atualizar saldo localmente
        const nowIso = new Date().toISOString();
        prod.quantidade = saldoAtual - qtd;
        prod.ultimaSaida = nowIso;
        if (tipoSaida === 'devolucao') prod.ultimaDevolucao = nowIso;
        if (tipoSaida === 'ajuste') prod.ultimoAjuste = nowIso;
        atualizarProdutoUltimaMovimentacao(prod, {
            tipo: tipoSaida,
            direcaoEstoque,
            dataIso: nowIso,
            motivo: motivoFinal,
            responsavel: responsavelFinal
        });
        
        // Registrar movimentação
        const mov = {
            id: generateUniqueId(obterPrefixoMovimentacaoProduto(tipoSaida, direcaoEstoque)),
            data: data ? new Date(`${data}T12:00:00`).toISOString() : nowIso,
            tipo: tipoSaida,
            tipoLabel,
            direcaoEstoque,
            origem: 'manual',
            produtoId: prod.id,
            produtoNome: prod.nome,
            quantidade: qtd,
            motivo: motivoFinal,
            destino: tipoSaida === 'devolucao' ? motivoFinal : '',
            responsavel: responsavelFinal,
            usuario: responsavelFinal || 'sistema',
            saldoAnterior: saldoAtual,
            saldoAtual: prod.quantidade,
            precoUnitario: prod.precoMedio || 0
        };
        
        // Carregar movimentações existentes
        const movsAntigas = normalizarListaProdutosFirebase(await getData('movimentacoesProdutos') || []);
        const movsAtualizadas = [...movsAntigas, mov];
        
        // Salvar tudo
        await saveDataProdutos('estoqueProdutos', estoqueProdutos);
        await saveDataProdutos('movimentacoesProdutos', movsAtualizadas);
        movimentacoesProdutosCache = movsAtualizadas.slice();
        adicionarResponsavelAutocompleteProduto(responsavelFinal);
        return true;
        
    } catch (err) {
        console.error("Erro na baixa:", err);
        alert('Erro ao salvar baixa: ' + err.message);
        return false;
    }
}

async function saveDataProdutos(key, data) {
    try {
        if (typeof saveDataAsync === 'function') {
            return await saveDataAsync(key, data);
        }
        localStorage.setItem(key, JSON.stringify(data));
        if (window.firebaseService && typeof window.firebaseService.saveToFirebase === 'function') {
            try { await window.firebaseService.saveToFirebase(key, null, data); } catch (_) {}
        }
        return true;
    } catch (e) {
        console.error(`Erro ao salvar ${key}:`, e);
        return false;
    }
}

function getProdutoMovimentacaoColumnsDefs() {
    return [
        { key: 'data', label: 'Data' },
        { key: 'tipo', label: 'Tipo' },
        { key: 'produtoNome', label: 'Produto' },
        { key: 'responsavel', label: 'Responsável' },
        { key: 'motivo', label: 'Motivo / Destino' },
        { key: 'origem', label: 'Origem' },
        { key: 'direcaoEstoque', label: 'Direção' },
        { key: 'saldoAnterior', label: 'Saldo Ant.', align: 'text-right' },
        { key: 'quantidade', label: 'Quantidade', align: 'text-right' },
        { key: 'saldoAtual', label: 'Saldo Atual', align: 'text-right' },
        { key: 'precoUnitario', label: 'Preço Unit.', align: 'text-right' },
        { key: 'documento', label: 'Documento' }
    ];
}

function getVisibleProdutoMovimentacaoColumns() {
    if (typeof window.getVisibleEstoqueReportColumns === 'function') {
        const visible = window.getVisibleEstoqueReportColumns('produtos_movimentacao');
        if (Array.isArray(visible) && visible.length) return visible;
    }
    return getProdutoMovimentacaoColumnsDefs();
}

function obterValorCelulaMovimentacaoProduto(m = {}, key = '', options = {}) {
    const plain = !!options.plain;
    const tipo = normalizarTipoMovimentacaoProduto(m.tipo || m.tipoMovimentacao, 'entrada');
    const direcao = obterDirecaoMovimentoProduto(m, tipo === 'saida' || tipo === 'devolucao' ? 'saida' : 'entrada');
    const label = obterLabelTipoMovimentacaoProduto(tipo, direcao);
    const tipoClass = obterClasseTipoMovimentacaoProduto(tipo, direcao);
    const map = {
        data: m.data ? new Date(m.data).toLocaleDateString('pt-BR') : '-',
        tipo: plain ? label : `<span class="status-indicator status-${tipoClass}">${escapeProdutoHtml(label)}</span>`,
        produtoNome: escapeProdutoHtml(m.produtoNome || m.produtoId || '-'),
        responsavel: escapeProdutoHtml(getResponsavelMovimentoProduto(m) || '-'),
        motivo: escapeProdutoHtml(m.motivo || m.destino || m.observacoes || '-'),
        origem: escapeProdutoHtml(m.origem || 'manual'),
        direcaoEstoque: direcao === 'saida' ? 'Saída' : 'Entrada',
        saldoAnterior: Number.isFinite(Number(m.saldoAnterior)) ? formatNumber(Number(m.saldoAnterior), 2) : '-',
        quantidade: formatNumber(m.quantidade || 0, 2),
        saldoAtual: Number.isFinite(Number(m.saldoAtual)) ? formatNumber(Number(m.saldoAtual), 2) : '-',
        precoUnitario: formatCurrency(m.precoUnitario || 0),
        documento: escapeProdutoHtml(m.documento || '-')
    };
    return map[key] ?? '';
}

function obterValorOrdenacaoMovimentacaoProduto(m = {}, key = '') {
    if (key === 'tipo') return obterLabelTipoMovimentacaoProduto(m.tipo, obterDirecaoMovimentoProduto(m));
    if (key === 'responsavel') return getResponsavelMovimentoProduto(m);
    if (key === 'direcaoEstoque') return obterDirecaoMovimentoProduto(m);
    if (key === 'saldoAnterior' || key === 'saldoAtual' || key === 'quantidade' || key === 'precoUnitario') return Number(m[key] || 0);
    return m[key] || '';
}

// --- Funções de Relatórios de Produtos ---

async function gerarRelatorioProdutosSaldo(onlySelected = false, options = {}) {
    try {
        if (typeof window.ensureProdutosColumnsConfigLoaded === 'function') {
            await window.ensureProdutosColumnsConfigLoaded();
        }
        await carregarMovimentacoesProdutosCache();
        await carregarResponsaveisProdutosCache();
        let produtos = (Array.isArray(estoqueProdutos) && estoqueProdutos.length > 0)
            ? estoqueProdutos.slice()
            : normalizarListaProdutosFirebase(await getData('estoqueProdutos') || []);
            
        if (typeof window.filtrarItensSelecionadosRelatorio === 'function') {
            produtos = window.filtrarItensSelecionadosRelatorio('produtos_saldo', produtos, p => p.id || p.nome || '', onlySelected);
        }
        if (produtos.length === 0) return '<p>Nenhum produto em estoque.</p>';

        if (window.ordemRelatorio && window.ordemRelatorio.tipo === 'produtos_saldo' && window.ordemRelatorio.coluna) {
            produtos.sort((a, b) => {
                let valA = a[window.ordemRelatorio.coluna];
                let valB = b[window.ordemRelatorio.coluna];
                if (window.ordemRelatorio.coluna === 'valor' || window.ordemRelatorio.coluna === 'valorTotal') {
                    valA = (a.quantidade || 0) * (a.precoMedio || 0);
                    valB = (b.quantidade || 0) * (b.precoMedio || 0);
                } else if (window.ordemRelatorio.coluna === 'responsavel') {
                    valA = obterResponsavelProduto(a);
                    valB = obterResponsavelProduto(b);
                } else if (window.ordemRelatorio.coluna === 'motivoDestino') {
                    valA = obterMotivoDestinoProduto(a);
                    valB = obterMotivoDestinoProduto(b);
                } else if (window.ordemRelatorio.coluna === 'tipoMovimentacao') {
                    valA = obterTipoMovimentacaoProduto(a);
                    valB = obterTipoMovimentacaoProduto(b);
                } else if (window.ordemRelatorio.coluna === 'status') {
                    valA = (a.quantidade || 0) <= 0 ? 0 : ((a.quantidade || 0) <= (a.estoqueMinimo || 0) ? 1 : 2);
                    valB = (b.quantidade || 0) <= 0 ? 0 : ((b.quantidade || 0) <= (b.estoqueMinimo || 0) ? 1 : 2);
                }
                if (typeof valA === 'string') valA = valA.toLowerCase();
                if (typeof valB === 'string') valB = valB.toLowerCase();
                if (valA < valB) return window.ordemRelatorio.direcao === 'asc' ? -1 : 1;
                if (valA > valB) return window.ordemRelatorio.direcao === 'asc' ? 1 : -1;
                return 0;
            });
        } else {
            produtos.sort((a, b) => (a.nome || '').localeCompare(b.nome || ''));
        }

        // Totais consolidados sobre 100% dos dados filtrados
        const totalItens = produtos.length;
        const totalQtd = produtos.reduce((acc, p) => acc + (parseFloat(p.quantidade) || 0), 0);
        const totalValor = produtos.reduce((acc, p) => acc + ((parseFloat(p.quantidade) || 0) * (parseFloat(p.precoMedio || p.preco) || 0)), 0);
        const itensCriticos = produtos.filter(p => (parseFloat(p.quantidade) || 0) <= (parseFloat(p.estoqueMinimo) || 0)).length;

        window.totalItensRelatorioAtual = totalItens;

        // Paginação de itens
        const pageSize = typeof window.obterItensPorPaginaTabela === 'function' ? window.obterItensPorPaginaTabela('relatorios') : 10;
        const totalPaginas = Math.max(1, Math.ceil(totalItens / pageSize));
        let pagAtual = Number(window.paginaAtualRelatorio) || 1;
        if (pagAtual > totalPaginas) pagAtual = totalPaginas;
        if (pagAtual < 1) pagAtual = 1;
        window.paginaAtualRelatorio = pagAtual;
        const inicio = (pagAtual - 1) * pageSize;
        const itensPagina = (onlySelected || options.disablePagination) ? produtos : produtos.slice(inicio, inicio + pageSize);

        const renderSelectTh = typeof window.renderRelatorioSelecionarTodosTh === 'function' ? window.renderRelatorioSelecionarTodosTh : () => '';
        const renderSelectTd = typeof window.renderRelatorioSelecionarTd === 'function' ? window.renderRelatorioSelecionarTd : () => '';
        const produtoDefs = typeof window.getVisibleEstoqueReportColumns === 'function'
            ? window.getVisibleEstoqueReportColumns('produtos_saldo')
            : (typeof window.getVisibleProdutosColumns === 'function' ? window.getVisibleProdutosColumns() : getProdutosColumnsDefs());

        const rows = itensPagina.map(p => `
            <tr>
                ${renderSelectTd('produtos_saldo', p.id || p.nome || '', onlySelected)}
                ${produtoDefs.map(def => {
                    const cls = def.align ? ` class="${def.align}"` : '';
                    return `<td data-col="${escapeProdutoHtml(def.key)}"${cls}>${obterValorCelulaProduto(p, def.key)}</td>`;
                }).join('')}
            </tr>
        `).join('');

        const icon = window.getSortIconRelatorio ? window.getSortIconRelatorio : () => '';
        const paginacaoHtml = (onlySelected || options.disablePagination) ? '' : '<div id="paginacaoRelatorios" class="pagination-controls"></div>';

        const cardsHtml = `
            <div class="stats-grid" id="resumoRelatoriosStats" style="margin-top: 16px;">
                <div class="stat-card">
                    <div class="stat-value" id="statRelProdTotalItens">${totalItens}</div>
                    <div class="stat-label">Itens Cadastrados</div>
                </div>
                <div class="stat-card">
                    <div class="stat-value" id="statRelProdTotalQtd">${formatNumber(totalQtd, 2)}</div>
                    <div class="stat-label">Quantidade Total</div>
                </div>
                <div class="stat-card">
                    <div class="stat-value" id="statRelProdTotalValor">${formatCurrency(totalValor)}</div>
                    <div class="stat-label">Valor Total em Estoque</div>
                </div>
                <div class="stat-card">
                    <div class="stat-value" id="statRelProdItensCriticos" style="color: ${itensCriticos > 0 ? '#e53e3e' : '#2b6cb0'};">${itensCriticos}</div>
                    <div class="stat-label">Estoque Baixo / Crítico</div>
                </div>
            </div>
        `;

        return `
            <div class="table-container report-table-container">
                <table class="table table-report-estoque" id="tabelaRelatorioProdutosSaldo">
                    <colgroup>
                        ${onlySelected ? '' : '<col style="width: 40px;">'}
                        ${produtoDefs.map(def => `<col class="${escapeProdutoHtml(def.key)}" data-col="${escapeProdutoHtml(def.key)}">`).join('')}
                    </colgroup>
                    <thead>
                        <tr>
                            ${renderSelectTh(onlySelected)}
                            ${produtoDefs.map(def => `<th onclick="window.ordenarRelatorio('${escapeProdutoHtml(def.key)}', 'produtos_saldo')" style="cursor:pointer;">${escapeProdutoHtml(def.label)} ${icon(def.key, 'produtos_saldo')}</th>`).join('')}
                        </tr>
                    </thead>
                    <tbody>${rows || `<tr><td colspan="${produtoDefs.length + (onlySelected ? 0 : 1)}">Nenhum produto em estoque.</td></tr>`}</tbody>
                </table>
            </div>
            ${paginacaoHtml}
            ${cardsHtml}
        `;
    } catch (e) {
        console.error(e);
        return `<p class="text-danger">Erro ao gerar relatório: ${e.message}</p>`;
    }
}

async function gerarRelatorioProdutosMovimentacao(dataInicio, dataFim, options = {}, onlySelected = false) {
    try {
        await carregarMovimentacoesProdutosCache();
        await carregarResponsaveisProdutosCache();
        const movimentos = (Array.isArray(movimentacoesProdutosCache) && movimentacoesProdutosCache.length > 0)
            ? movimentacoesProdutosCache.slice()
            : normalizarListaProdutosFirebase(await getData('movimentacoesProdutos') || []);

        let filtrados = movimentos.slice();
        if (dataInicio && dataFim) {
            const di = new Date(`${dataInicio}T00:00:00`);
            const df = new Date(`${dataFim}T23:59:59`);
            filtrados = movimentos.filter(m => {
                const d = new Date(m.data);
                return d >= di && d <= df;
            });
        }

        const tipoFiltro = (options && options.tipo) ? String(options.tipo).trim() : '';
        if (tipoFiltro) {
            const tipoFiltroNormalizado = normalizarTipoMovimentacaoProduto(tipoFiltro);
            filtrados = filtrados.filter(m => normalizarTipoMovimentacaoProduto(m.tipo || m.tipoMovimentacao) === tipoFiltroNormalizado);
        }

        if (typeof window.filtrarItensSelecionadosRelatorio === 'function') {
            const getKey = typeof window.getRelatorioProdutoMovimentacaoKey === 'function'
                ? window.getRelatorioProdutoMovimentacaoKey
                : (m) => m.id || `${m.data || ''}|${m.tipo || ''}|${m.produtoId || ''}|${m.produtoNome || ''}|${m.quantidade || ''}|${m.motivo || ''}|${m.origem || ''}`;
            filtrados = window.filtrarItensSelecionadosRelatorio('produtos_movimentacao', filtrados, getKey, onlySelected);
        }

        if (filtrados.length === 0) return '<p>Nenhuma movimentação encontrada no período.</p>';

        if (window.ordemRelatorio && window.ordemRelatorio.tipo === 'produtos_movimentacao' && window.ordemRelatorio.coluna) {
            filtrados.sort((a, b) => {
                let valA = obterValorOrdenacaoMovimentacaoProduto(a, window.ordemRelatorio.coluna);
                let valB = obterValorOrdenacaoMovimentacaoProduto(b, window.ordemRelatorio.coluna);
                if (typeof valA === 'string') valA = valA.toLowerCase();
                if (typeof valB === 'string') valB = valB.toLowerCase();
                if (valA < valB) return window.ordemRelatorio.direcao === 'asc' ? -1 : 1;
                if (valA > valB) return window.ordemRelatorio.direcao === 'asc' ? 1 : -1;
                return 0;
            });
        } else {
            filtrados.sort((a, b) => new Date(b.data) - new Date(a.data));
        }

        // Totais consolidados sobre 100% dos dados filtrados
        let entradas = 0;
        let volumeEntradasQtd = 0;
        let saidas = 0;
        let volumeSaidasQtd = 0;
        let ajustes = 0;
        let devolucoes = 0;

        filtrados.forEach(m => {
            const tipoMov = normalizarTipoMovimentacaoProduto(m.tipo || m.tipoMovimentacao);
            const qtd = parseFloat(m.quantidade) || 0;
            if (tipoMov === 'entrada') {
                entradas++;
                volumeEntradasQtd += qtd;
            } else if (tipoMov === 'saida') {
                saidas++;
                volumeSaidasQtd += qtd;
            } else if (tipoMov === 'ajuste') {
                ajustes++;
            } else if (tipoMov === 'devolucao') {
                devolucoes++;
            }
        });

        const totalMovimentacoes = filtrados.length;
        window.totalItensRelatorioAtual = totalMovimentacoes;

        // Paginação de itens
        const pageSize = typeof window.obterItensPorPaginaTabela === 'function' ? window.obterItensPorPaginaTabela('relatorios') : 10;
        const totalPaginas = Math.max(1, Math.ceil(totalMovimentacoes / pageSize));
        let pagAtual = Number(window.paginaAtualRelatorio) || 1;
        if (pagAtual > totalPaginas) pagAtual = totalPaginas;
        if (pagAtual < 1) pagAtual = 1;
        window.paginaAtualRelatorio = pagAtual;
        const inicio = (pagAtual - 1) * pageSize;
        const itensPagina = (onlySelected || options.disablePagination) ? filtrados : filtrados.slice(inicio, inicio + pageSize);
        
        const getResponsavel = (m) => getResponsavelMovimentoProduto(m) || 'Não Informado';
        const getMovKey = typeof window.getRelatorioProdutoMovimentacaoKey === 'function'
            ? window.getRelatorioProdutoMovimentacaoKey
            : (m) => m.id || `${m.data || ''}|${m.tipo || ''}|${m.produtoId || ''}|${m.produtoNome || ''}|${m.quantidade || ''}|${m.motivo || ''}|${m.origem || ''}`;
        const renderSelectTh = typeof window.renderRelatorioSelecionarTodosTh === 'function' ? window.renderRelatorioSelecionarTodosTh : () => '';
        const renderSelectTd = typeof window.renderRelatorioSelecionarTd === 'function' ? window.renderRelatorioSelecionarTd : () => '';

        const renderTable = (items, respGroupKey = '') => {
            const movDefs = typeof window.getVisibleEstoqueReportColumns === 'function'
                ? window.getVisibleEstoqueReportColumns('produtos_movimentacao')
                : (typeof window.getVisibleProdutoMovimentacaoColumns === 'function' ? window.getVisibleProdutoMovimentacaoColumns() : getVisibleProdutoMovimentacaoColumns());

            const rows = (items || []).map(m => {
                const id = String(m.id || '');
                const estornado = !!(m.estornado || m.estornoId || m.estornadoEm);
                const estornarDisabled = estornado ? 'disabled' : '';
                const estornarTitle = estornado ? 'Já estornado' : 'Estornar';
                const extraAttr = respGroupKey ? `data-resp="${escapeProdutoAttr(respGroupKey)}"` : '';
                return `
                    <tr>
                        ${renderSelectTd('produtos_movimentacao', getMovKey(m), onlySelected, extraAttr)}
                        ${movDefs.map(def => {
                            const cls = def.align ? ` class="${def.align}"` : '';
                            return `<td data-col="${escapeProdutoHtml(def.key)}"${cls}>${obterValorCelulaMovimentacaoProduto(m, def.key)}</td>`;
                        }).join('')}
                        <td class="text-center no-print actions-cell sticky-actions">
                            <div class="actions-cell-inner">
                                <button type="button" class="btn btn-secondary btn-small" onclick="editarMovimentacaoProduto('${id.replace(/'/g, "\\'")}')" title="Editar"><i class="fas fa-pen"></i></button>
                                <button type="button" class="btn btn-warning btn-small" onclick="estornarMovimentacaoProduto('${id.replace(/'/g, "\\'")}')" title="${estornarTitle}" ${estornarDisabled}><i class="fas fa-undo"></i></button>
                            </div>
                        </td>
                    </tr>
                `;
            }).join('');

            const icon = window.getSortIconRelatorio ? window.getSortIconRelatorio : () => '';
            
            let thCheckboxHtml = renderSelectTh(onlySelected);
            if (respGroupKey && !onlySelected) {
                const allGroupChecked = items.length > 0 && items.every(m => window.relatorioSelecionados && window.relatorioSelecionados.has('produtos_movimentacao:' + getMovKey(m)));
                thCheckboxHtml = `<th class="text-center no-print relatorio-check-col"><input type="checkbox" class="check-grupo-responsavel" data-resp="${escapeProdutoAttr(respGroupKey)}" ${allGroupChecked ? 'checked' : ''} onchange="window.toggleRelatorioGrupoResponsavel(this, '${escapeProdutoAttr(respGroupKey)}')" title="Selecionar todos de ${escapeProdutoAttr(respGroupKey)}" aria-label="Selecionar todos de ${escapeProdutoAttr(respGroupKey)}"></th>`;
            }

            return `
                <div class="table-container report-table-container">
                    <table class="table table-report-estoque" id="tabelaRelatorioProdutosMovimentacao${respGroupKey ? '_' + escapeProdutoAttr(respGroupKey).replace(/[^a-zA-Z0-9_-]/g, '_') : ''}">
                        <colgroup>
                            ${onlySelected ? '' : '<col style="width: 40px;">'}
                            ${movDefs.map(def => `<col class="${escapeProdutoHtml(def.key)}" data-col="${escapeProdutoHtml(def.key)}">`).join('')}
                            <col class="acoes no-print" style="width: 80px;">
                        </colgroup>
                        <thead>
                            <tr>
                                ${thCheckboxHtml}
                                ${movDefs.map(def => `<th onclick="window.ordenarRelatorio('${escapeProdutoHtml(def.key)}', 'produtos_movimentacao')" style="cursor:pointer;">${escapeProdutoHtml(def.label)} ${icon(def.key, 'produtos_movimentacao')}</th>`).join('')}
                                <th class="no-print actions-col sticky-actions">Ações</th>
                            </tr>
                        </thead>
                        <tbody>${rows || `<tr><td colspan="${movDefs.length + (onlySelected ? 0 : 2)}">Nenhuma movimentação encontrada.</td></tr>`}</tbody>
                    </table>
                </div>
            `;
        };

        const agruparPorResponsavel = !!(options && options.agruparPorResponsavel);
        let tablesHtml = '';
        if (agruparPorResponsavel) {
            const groups = new Map();
            itensPagina.forEach(m => {
                const key = getResponsavel(m);
                if (!groups.has(key)) groups.set(key, []);
                groups.get(key).push(m);
            });
            const groupKeys = Array.from(groups.keys()).sort((a,b) => a.localeCompare(b, 'pt-BR'));
            tablesHtml = groupKeys.map((k) => {
                const items = groups.get(k) || [];
                const allGroupChecked = items.length > 0 && items.every(m => window.relatorioSelecionados && window.relatorioSelecionados.has('produtos_movimentacao:' + getMovKey(m)));

                // Calcular totais por produto do responsável
                const produtosDoResp = new Map();
                items.forEach(m => {
                    const prodNome = m.produtoNome || m.produtoId || 'Sem Nome';
                    if (!produtosDoResp.has(prodNome)) {
                        produtosDoResp.set(prodNome, {
                            nome: prodNome,
                            entradasQtd: 0,
                            saidasQtd: 0,
                            ajustesQtd: 0,
                            devolucoesQtd: 0,
                            precoMedio: 0,
                            precoSoma: 0,
                            precoCount: 0
                        });
                    }
                    const pInfo = produtosDoResp.get(prodNome);
                    const tipoMov = normalizarTipoMovimentacaoProduto(m.tipo || m.tipoMovimentacao);
                    const qtd = parseFloat(m.quantidade) || 0;
                    const preco = parseFloat(m.precoUnitario) || 0;
                    if (preco > 0) {
                        pInfo.precoSoma += (preco * qtd);
                        pInfo.precoCount += qtd;
                        pInfo.precoMedio = pInfo.precoSoma / pInfo.precoCount;
                    }

                    if (tipoMov === 'entrada') pInfo.entradasQtd += qtd;
                    else if (tipoMov === 'saida') pInfo.saidasQtd += qtd;
                    else if (tipoMov === 'ajuste') pInfo.ajustesQtd += qtd;
                    else if (tipoMov === 'devolucao') pInfo.devolucoesQtd += qtd;
                });

                let respTotalSaidasQtd = 0;
                let respTotalValorSaidas = 0;
                let respTotalEntradasQtd = 0;
                let respTotalAjustesQtd = 0;

                const resumoProdutosRows = Array.from(produtosDoResp.values()).map(p => {
                    const valorSaidas = p.saidasQtd * (p.precoMedio || 0);
                    const valorTotalMov = (p.entradasQtd + p.saidasQtd + p.ajustesQtd + p.devolucoesQtd) * (p.precoMedio || 0);
                    respTotalSaidasQtd += p.saidasQtd;
                    respTotalValorSaidas += valorSaidas;
                    respTotalEntradasQtd += p.entradasQtd;
                    respTotalAjustesQtd += (p.ajustesQtd + p.devolucoesQtd);

                    return `
                        <tr>
                            <td><strong>${escapeProdutoHtml(p.nome)}</strong></td>
                            <td class="text-right" style="color: #16a34a; font-weight: 600;">${p.entradasQtd > 0 ? formatNumber(p.entradasQtd, 2) : '-'}</td>
                            <td class="text-right" style="color: #dc2626; font-weight: 600;">${p.saidasQtd > 0 ? formatNumber(p.saidasQtd, 2) : '-'}</td>
                            <td class="text-right">${(p.ajustesQtd + p.devolucoesQtd) > 0 ? formatNumber(p.ajustesQtd + p.devolucoesQtd, 2) : '-'}</td>
                            <td class="text-right">${p.precoMedio > 0 ? formatCurrency(p.precoMedio) : '-'}</td>
                            <td class="text-right" style="font-weight: 700; color: #1e293b;">${formatCurrency(valorSaidas || valorTotalMov)}</td>
                        </tr>
                    `;
                }).join('');

                const totaisPorProdutoCard = `
                    <div class="resp-totais-card" style="background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 6px; padding: 12px 14px; margin: 10px 0 24px 0;">
                        <div style="font-size: 13px; font-weight: 700; color: #334155; margin-bottom: 8px; display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 8px;">
                            <span><i class="fas fa-layer-group" style="color: #3b82f6;"></i> Totais por Produto & Valor Consumido — <strong>${escapeProdutoHtml(k)}</strong></span>
                            <span style="font-size: 12.5px; color: #475569;">Valor Consumido / Saídas: <strong style="color: #b91c1c; font-size: 13px;">${formatCurrency(respTotalValorSaidas)}</strong></span>
                        </div>
                        <div class="table-container" style="background: #ffffff; border: 1px solid #e2e8f0; border-radius: 4px; overflow-x: auto;">
                            <table class="table table-small" style="margin: 0; font-size: 12px; width: 100%;">
                                <thead>
                                    <tr style="background: #f1f5f9;">
                                        <th>Produto</th>
                                        <th class="text-right">Entradas (Qtd)</th>
                                        <th class="text-right">Saídas / Consumo (Qtd)</th>
                                        <th class="text-right">Ajustes / Devol. (Qtd)</th>
                                        <th class="text-right">Preço Médio</th>
                                        <th class="text-right">Valor Total (R$)</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    ${resumoProdutosRows}
                                </tbody>
                                <tfoot>
                                    <tr style="background: #f8fafc; font-weight: 700; border-top: 2px solid #cbd5e1;">
                                        <td>TOTAL (${escapeProdutoHtml(k)}):</td>
                                        <td class="text-right" style="color: #16a34a;">${formatNumber(respTotalEntradasQtd, 2)}</td>
                                        <td class="text-right" style="color: #dc2626;">${formatNumber(respTotalSaidasQtd, 2)}</td>
                                        <td class="text-right">${formatNumber(respTotalAjustesQtd, 2)}</td>
                                        <td class="text-right">-</td>
                                        <td class="text-right" style="color: #b91c1c; font-size: 13px;">${formatCurrency(respTotalValorSaidas)}</td>
                                    </tr>
                                </tfoot>
                            </table>
                        </div>
                    </div>
                `;

                return `
                    <div class="relatorios-grupo-header" style="margin: 20px 0 8px 0; display: flex; justify-content: space-between; align-items: center; background: #f8fafc; border-left: 4px solid #3b82f6; border-radius: 4px; padding: 10px 14px; box-shadow: 0 1px 2px rgba(0,0,0,0.03);">
                        <span style="font-size: 14px; font-weight: 700; color: #1e293b; display: inline-flex; align-items: center; gap: 8px;">
                            <i class="fas fa-user-circle" style="color: #3b82f6; font-size: 16px;"></i>
                            Responsável: <strong>${escapeProdutoHtml(k)}</strong>
                        </span>
                        <span style="font-size: 12.5px; color: #64748b; font-weight: 500;">(${items.length} movimentações nesta página)</span>
                    </div>
                    ${renderTable(items, k)}
                    ${totaisPorProdutoCard}
                `;
            }).join('');
        } else {
            tablesHtml = renderTable(itensPagina);
        }

        const paginacaoHtml = (onlySelected || options.disablePagination) ? '' : '<div id="paginacaoRelatorios" class="pagination-controls"></div>';

        const cardsHtml = agruparPorResponsavel ? '' : `
            <div class="stats-grid" id="resumoRelatoriosStats" style="margin-top: 16px;">
                <div class="stat-card">
                    <div class="stat-value" id="statRelProdMovTotal">${totalMovimentacoes}</div>
                    <div class="stat-label">Total de Movimentações</div>
                </div>
                <div class="stat-card">
                    <div class="stat-value" id="statRelProdMovEntradas">${entradas} (${formatNumber(volumeEntradasQtd, 2)})</div>
                    <div class="stat-label">Entradas (Registros / Qtd)</div>
                </div>
                <div class="stat-card">
                    <div class="stat-value" id="statRelProdMovSaidas">${saidas} (${formatNumber(volumeSaidasQtd, 2)})</div>
                    <div class="stat-label">Saídas (Registros / Qtd)</div>
                </div>
                <div class="stat-card">
                    <div class="stat-value" id="statRelProdMovAjustes">${ajustes + devolucoes}</div>
                    <div class="stat-label">Ajustes & Devoluções</div>
                </div>
            </div>
        `;

        return `
            ${tablesHtml}
            ${paginacaoHtml}
            ${cardsHtml}
        `;

    } catch (e) {
        console.error(e);
        return `<p class="text-danger">Erro ao gerar relatório: ${e.message}</p>`;
    }
}

// Expor globalmente
window.carregarEstoqueProdutos = carregarEstoqueProdutos;
window.renderizarTabelaProdutos = renderizarTabelaProdutos;
window.filtrarProdutos = filtrarProdutos;
window.abrirBaixaProduto = abrirBaixaProduto;
window.confirmarBaixaProduto = confirmarBaixaProduto;
window.atualizarInfoProdutoBaixa = atualizarInfoProdutoBaixa;
window.prepararBaixaProdutos = prepararBaixaProdutos;
window.prepararBaixaProdutoInline = prepararBaixaProdutoInline;
window.registrarBaixaProdutoInline = registrarBaixaProdutoInline;
window.atualizarInfoProdutoBaixaInline = atualizarInfoProdutoBaixaInline;
window.limparBaixaProdutoInlineForm = limparBaixaProdutoInlineForm;
window.limparEntradaProdutoForm = limparEntradaProdutoForm;
window.registrarEntradaProduto = registrarEntradaProduto;
window.configurarNavegacaoEnterEntradaProdutos = configurarNavegacaoEnterEntradaProdutos;
window.atualizarTabelaProdutos = carregarEstoqueProdutos;
window.gerarRelatorioProdutosSaldo = gerarRelatorioProdutosSaldo;
window.gerarRelatorioProdutosMovimentacao = gerarRelatorioProdutosMovimentacao;
window.mudarPaginaProdutos = mudarPaginaProdutos;
window.abrirEditarProdutoAlmoxarifado = abrirEditarProdutoAlmoxarifado;
window.salvarEdicaoModalProdutoAlmoxarifado = salvarEdicaoModalProdutoAlmoxarifado;
window.limparFiltrosProdutosAlmoxarifado = limparFiltrosProdutosAlmoxarifado;
window.abrirConfiguracaoColunasProdutos = abrirConfiguracaoColunasProdutos;
window.fecharConfiguracaoColunasProdutos = fecharConfiguracaoColunasProdutos;
window.salvarConfiguracaoColunasProdutos = salvarConfiguracaoColunasProdutos;
window.toggleTodasColunasProdutos = toggleTodasColunasProdutos;
window.atualizarEstadoTodasColunasProdutos = atualizarEstadoTodasColunasProdutos;
window.getVisibleProdutosColumns = getVisibleProdutosColumns;
window.getProdutosColumnsDefs = getProdutosColumnsDefs;
window.getProdutoMovimentacaoColumnsDefs = getProdutoMovimentacaoColumnsDefs;
window.obterValorCelulaMovimentacaoProduto = obterValorCelulaMovimentacaoProduto;
window.obterValorCelulaProduto = obterValorCelulaProduto;
window.ensureProdutosColumnsConfigLoaded = ensureProdutosColumnsConfigLoaded;
window.normalizarTipoMovimentacaoProduto = normalizarTipoMovimentacaoProduto;
window.obterDirecaoMovimentoProduto = obterDirecaoMovimentoProduto;
window.obterLabelTipoMovimentacaoProduto = obterLabelTipoMovimentacaoProduto;

window.ordenarProdutos = function(coluna) {
    if (ordemProdutos.coluna === coluna) {
        ordemProdutos.direcao = ordemProdutos.direcao === 'asc' ? 'desc' : 'asc';
    } else {
        ordemProdutos.coluna = coluna;
        ordemProdutos.direcao = 'asc';
    }

    // Atualizar ícones
    document.querySelectorAll('#sort-produtos-' + ordemProdutos.coluna).forEach(icon => {
        icon.className = 'fas fa-sort sort-icon';
    });
    document.querySelectorAll('.sort-icon').forEach(icon => {
        if (icon.id && icon.id.startsWith('sort-produtos-')) {
            icon.className = 'fas fa-sort sort-icon';
        }
    });

    const iconEl = document.getElementById('sort-produtos-' + coluna);
    if (iconEl) {
        iconEl.className = 'fas fa-sort-' + (ordemProdutos.direcao === 'asc' ? 'up' : 'down') + ' sort-icon';
    }

    renderizarTabelaProdutos(produtosFiltrados.length > 0 ? produtosFiltrados : estoqueProdutos);
};

window.toggleTodosProdutos = function() {
    const master = document.getElementById('checkTodosProdutos');
    const checks = document.querySelectorAll('.check-produto');
    checks.forEach(c => {
        c.checked = master.checked;
        if (master.checked) {
            produtosSelecionados.add(c.value);
        } else {
            produtosSelecionados.delete(c.value);
        }
    });
};

window.toggleProduto = function(id, isChecked) {
    if (isChecked) {
        produtosSelecionados.add(id);
    } else {
        produtosSelecionados.delete(id);
        const master = document.getElementById('checkTodosProdutos');
        if (master) master.checked = false;
    }
};

function ensureMovimentacaoEditModal() {
    if (document.getElementById('modalEditarMovProduto')) return;
    document.body.insertAdjacentHTML('beforeend', `
        <div id="modalEditarMovProduto" class="modal" style="z-index: 2100;">
            <div class="modal-content" style="max-width: 680px;">
                <div class="modal-header">
                    <h2>Editar Movimentação</h2>
                    <span class="close" onclick="fecharModal('modalEditarMovProduto')">&times;</span>
                </div>
                <div class="modal-body">
                    <form id="formEditarMovProduto">
                        <input type="hidden" id="editMovId">
                        <div class="form-row">
                            <div class="form-group">
                                <label for="editMovData">Data:</label>
                                <input type="date" id="editMovData" required>
                            </div>
                            <div class="form-group">
                                <label for="editMovTipo">Tipo:</label>
                                <input type="text" id="editMovTipo" disabled>
                            </div>
                            <div class="form-group">
                                <label for="editMovOrigem">Origem:</label>
                                <input type="text" id="editMovOrigem" placeholder="manual, compra, estorno...">
                            </div>
                        </div>
                        <div class="form-row">
                            <div class="form-group">
                                <label for="editMovProduto">Produto:</label>
                                <input type="text" id="editMovProduto" disabled>
                            </div>
                        </div>
                        <div class="form-row">
                            <div class="form-group">
                                <label for="editMovResponsavel">Responsável:</label>
                                <input type="text" id="editMovResponsavel" placeholder="Nome do responsável" autocomplete="name">
                            </div>
                            <div class="form-group">
                                <label for="editMovQuantidade">Quantidade:</label>
                                <input type="number" id="editMovQuantidade" step="0.01" min="0" disabled>
                            </div>
                        </div>
                        <div class="form-group">
                            <label for="editMovMotivo">Motivo/Obs:</label>
                            <textarea id="editMovMotivo" rows="3" placeholder="Observações"></textarea>
                        </div>
                    </form>
                </div>
                <div class="modal-footer">
                    <button type="button" onclick="fecharModal('modalEditarMovProduto')" class="btn btn-secondary"><i class="fas fa-times"></i> Cancelar</button>
                    <button type="button" onclick="salvarEdicaoMovimentacaoProduto()" class="btn btn-primary"><i class="fas fa-save"></i> Salvar</button>
                </div>
            </div>
        </div>
    `);
}

async function editarMovimentacaoProduto(movId) {
    try {
        const id = String(movId || '').trim();
        if (!id) return;
        ensureMovimentacaoEditModal();
        const movs = normalizarListaProdutosFirebase(await getData('movimentacoesProdutos') || []);
        const mov = movs.find(m => String(m.id) === id);
        if (!mov) { alert('Movimentação não encontrada.'); return; }
        const dataIso = mov.data ? new Date(mov.data).toISOString().split('T')[0] : new Date().toISOString().split('T')[0];
        document.getElementById('editMovId').value = id;
        document.getElementById('editMovData').value = dataIso;
        document.getElementById('editMovTipo').value = obterLabelTipoMovimentacaoProduto(mov.tipo, obterDirecaoMovimentoProduto(mov));
        document.getElementById('editMovOrigem').value = String(mov.origem || '').trim();
        document.getElementById('editMovProduto').value = String(mov.produtoNome || mov.produtoId || '').trim();
        document.getElementById('editMovResponsavel').value = String(mov.responsavel || mov.usuario || '').trim();
        document.getElementById('editMovQuantidade').value = Number(mov.quantidade || 0);
        document.getElementById('editMovMotivo').value = String(mov.motivo || '').trim();
        const modal = document.getElementById('modalEditarMovProduto');
        modal.style.display = 'block';
    } catch (e) {
        console.error(e);
        alert('Erro ao abrir edição: ' + (e.message || e));
    }
}

async function salvarEdicaoMovimentacaoProduto() {
    try {
        const id = String(document.getElementById('editMovId')?.value || '').trim();
        if (!id) return;
        const dataVal = document.getElementById('editMovData')?.value || '';
        if (!dataVal) { alert('Informe a data.'); return; }
        const origem = String(document.getElementById('editMovOrigem')?.value || '').trim();
        const responsavel = String(document.getElementById('editMovResponsavel')?.value || '').trim();
        const motivo = String(document.getElementById('editMovMotivo')?.value || '').trim();
        const movs = normalizarListaProdutosFirebase(await getData('movimentacoesProdutos') || []);
        const idx = movs.findIndex(m => String(m.id) === id);
        if (idx < 0) { alert('Movimentação não encontrada.'); return; }
        const current = movs[idx] || {};
        movs[idx] = {
            ...current,
            data: new Date(dataVal).toISOString(),
            origem: origem || current.origem || 'manual',
            responsavel: responsavel || current.responsavel || '',
            usuario: responsavel || current.usuario || 'sistema',
            motivo: motivo
        };
        await saveDataProdutos('movimentacoesProdutos', movs);
        fecharModal('modalEditarMovProduto');
        const tabRel = document.getElementById('relatorios');
        if (tabRel && tabRel.classList.contains('active') && typeof window.gerarRelatorio === 'function') {
            window.gerarRelatorio();
        }
        alert('Movimentação atualizada.');
    } catch (e) {
        console.error(e);
        alert('Erro ao salvar: ' + (e.message || e));
    }
}

async function estornarMovimentacaoProduto(movId) {
    try {
        const id = String(movId || '').trim();
        if (!id) return;
        const movs = normalizarListaProdutosFirebase(await getData('movimentacoesProdutos') || []);
        const idx = movs.findIndex(m => String(m.id) === id);
        if (idx < 0) { alert('Movimentação não encontrada.'); return; }
        const mov = movs[idx] || {};
        const already = !!(mov.estornado || mov.estornoId || mov.estornadoEm);
        if (already) { alert('Esta movimentação já foi estornada.'); return; }
        const tipoOrig = normalizarTipoMovimentacaoProduto(mov.tipo || mov.tipoMovimentacao);
        const direcaoOrig = obterDirecaoMovimentoProduto(mov, tipoOrig === 'saida' || tipoOrig === 'devolucao' ? 'saida' : 'entrada');
        if (!['entrada', 'saida', 'ajuste', 'devolucao'].includes(tipoOrig)) { alert('Tipo de movimentação inválido.'); return; }
        const qtd = Number(mov.quantidade || 0);
        if (!(qtd > 0)) { alert('Quantidade inválida.'); return; }
        const prodId = String(mov.produtoId || '').trim();
        if (!prodId) { alert('Produto inválido.'); return; }
        if (!confirm('Confirma estornar esta movimentação? Isso irá gerar uma movimentação inversa e ajustar o estoque.')) return;

        const produtos = await getData('estoqueProdutos') || [];
        const produtosArr = Array.isArray(produtos) ? produtos.slice() : Object.values(produtos || {});
        const pIdx = produtosArr.findIndex(p => String(p.id) === prodId);
        if (pIdx < 0) { alert('Produto não encontrado no estoque.'); return; }

        const opposite = direcaoOrig === 'entrada' ? 'saida' : 'entrada';
        const nowIso = new Date().toISOString();
        const novoId = generateUniqueId('MOV-ESTORNO');
        const responsavel = String(mov.responsavel || mov.usuario || '').trim();

        const prod = { ...(produtosArr[pIdx] || {}) };
        const currentQtd = Number(prod.quantidade || 0);
        const newQtd = opposite === 'entrada' ? (currentQtd + qtd) : (currentQtd - qtd);
        if (newQtd < 0) { alert('Estorno resultaria em estoque negativo. Operação cancelada.'); return; }
        prod.quantidade = newQtd;
        atualizarProdutoUltimaMovimentacao(prod, {
            tipo: opposite,
            direcaoEstoque: opposite,
            dataIso: nowIso,
            motivo: `Estorno de ${id}`,
            responsavel
        });
        produtosArr[pIdx] = prod;

        movs[idx] = { ...mov, estornado: true, estornadoEm: nowIso, estornoId: novoId };
        const novoMov = {
            id: novoId,
            data: nowIso,
            tipo: opposite,
            tipoLabel: obterLabelTipoMovimentacaoProduto(opposite, opposite),
            direcaoEstoque: opposite,
            origem: 'estorno',
            produtoId: prodId,
            produtoNome: mov.produtoNome || prod.nome || prodId,
            quantidade: qtd,
            motivo: `Estorno de ${id}${mov.motivo ? ' - ' + mov.motivo : ''}`,
            responsavel: responsavel,
            usuario: responsavel || 'sistema',
            saldoAnterior: currentQtd,
            saldoAtual: newQtd,
            estornoDe: id
        };
        movs.push(novoMov);

        await saveDataProdutos('estoqueProdutos', produtosArr);
        await saveDataProdutos('movimentacoesProdutos', movs);

        if (typeof carregarEstoqueProdutos === 'function') {
            try { await carregarEstoqueProdutos(); } catch (_) {}
        }
        const tabRel = document.getElementById('relatorios');
        if (tabRel && tabRel.classList.contains('active') && typeof window.gerarRelatorio === 'function') {
            window.gerarRelatorio();
        }
        alert('Movimentação estornada com sucesso.');
    } catch (e) {
        console.error(e);
        alert('Erro ao estornar: ' + (e.message || e));
    }
}

window.editarMovimentacaoProduto = editarMovimentacaoProduto;
window.salvarEdicaoMovimentacaoProduto = salvarEdicaoMovimentacaoProduto;
window.estornarMovimentacaoProduto = estornarMovimentacaoProduto;
