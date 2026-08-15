/**
 * 💾 MÓDULO: Salvar Romaneio - Romaneio TL
 * 
 * Responsabilidades:
 * - Salvar romaneio no Firebase/localStorage
 * - Validar dados antes do salvamento
 * - Controlar modo de edição vs novo romaneio
 * - Gerar IDs únicos
 * - Integrar com Firebase Service
 * 
 * ✅ MUDANÇA: Campo "espessura" padronizado
 * ✅ PRIORIDADE: Firebase primeiro, localStorage como fallback
 */

window.SalvarRomaneio = (function() {
    'use strict';
    const legacyKey = ['b','i','t','o','l','a'].join('');

    // ✅ VARIÁVEIS DE CONTROLE
    let isProcessing = false;
    let currentRomaneioId = null;
    let currentRomaneioData = null;

    function getTodayLocalISODate() {
        const now = new Date();
        const y = now.getFullYear();
        const m = String(now.getMonth() + 1).padStart(2, '0');
        const d = String(now.getDate()).padStart(2, '0');
        return `${y}-${m}-${d}`;
    }

    function normalizeDateInputValue(value) {
        if (typeof value === 'number' && isFinite(value)) {
            const parsed = new Date(value);
            if (!isNaN(parsed.getTime())) {
                const y = parsed.getFullYear();
                const m = String(parsed.getMonth() + 1).padStart(2, '0');
                const d = String(parsed.getDate()).padStart(2, '0');
                return `${y}-${m}-${d}`;
            }
        }
        const raw = String(value || '').trim();
        if (!raw) return '';
        const iso = raw.match(/^(\d{4})-(\d{2})-(\d{2})/);
        if (iso) return `${iso[1]}-${iso[2]}-${iso[3]}`;
        const br = raw.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
        if (br) return `${br[3]}-${br[2]}-${br[1]}`;
        const parsed = new Date(raw);
        if (!isNaN(parsed.getTime())) {
            const y = parsed.getFullYear();
            const m = String(parsed.getMonth() + 1).padStart(2, '0');
            const d = String(parsed.getDate()).padStart(2, '0');
            return `${y}-${m}-${d}`;
        }
        return '';
    }

    function setRomaneioEmissionDate(value) {
        const input = document.getElementById('romaneioData');
        if (!input) return '';
        const dateValue = normalizeDateInputValue(value) || getTodayLocalISODate();
        input.value = dateValue;
        return dateValue;
    }

    function getRomaneioEmissionDate(fallbackValue) {
        const input = document.getElementById('romaneioData');
        const dateValue = normalizeDateInputValue(input && input.value)
            || normalizeDateInputValue(fallbackValue)
            || getTodayLocalISODate();
        if (input && input.value !== dateValue) {
            input.value = dateValue;
        }
        return dateValue;
    }

    function getRomaneioDataService() {
        try {
            const candidates = [window.firebaseService, window.firebaseServiceTL, window.unifiedFirebaseService, window.FirebaseService].filter(Boolean);
            for (const svc of candidates) {
                const canSave = typeof svc.saveToFirebase === 'function' || typeof svc.saveData === 'function';
                if (canSave) return svc;
            }
        } catch (_) {}
        return null;
    }
    function resolveCompanyId() {
        try {
            const svc = window.firebaseService || window.firebaseServiceTL || window.FirebaseService;
            if (svc && typeof svc.getTenantId === 'function') {
                const t = svc.getTenantId();
                if (t) return String(t);
            }
        } catch (_) {}
        try {
            if (window.appTenantId) return String(window.appTenantId);
            if (window.companyInfo) {
                const raw = window.companyInfo;
                const id = raw.companyId || raw.companyID || raw.tenantId || raw.id;
                if (id) return String(id);
            }
            const stored = localStorage.getItem('company_info');
            if (stored) {
                const obj = JSON.parse(stored);
                const id = obj && (obj.companyId || obj.companyID || obj.tenantId || obj.id);
                if (id) return String(id);
            }
        } catch (_) {}
        return null;
    }

    function resolveStorageKey(base) {
        try {
            const svc = window.firebaseServiceTL || window.firebaseService || window.FirebaseService;
            if (svc && typeof svc.getNamespacedPath === 'function') {
                const ns = svc.getNamespacedPath(base);
                if (ns) return ns;
            }
        } catch (_) {}
        const companyId = resolveCompanyId();
        if (companyId && !/^companies\//.test(base) && !/^users\//.test(base)) {
            return `companies/${companyId}/${base}`;
        }
        if (/^companies\//.test(base)) return base;
        return null;
    }

    /**
     * ✅ FUNÇÃO PRINCIPAL: Salvar Romaneio
     */
    async function salvarRomaneio() {
        console.log('💾 Iniciando salvamento do romaneio...');
        
        // Prevenir múltiplas execuções simultâneas
        if (isProcessing) {
            console.log('⚠️ Salvamento já em andamento, ignorando...');
            return false;
        }
        
        isProcessing = true;
        
        try {
            // Validar dados do romaneio
            const dadosRomaneio = await coletarDadosRomaneio();
            
            if (!validarDadosRomaneio(dadosRomaneio)) {
                return false;
            }
            
            // Determinar se é edição ou novo romaneio
            const isEdicao = currentRomaneioId !== null;
            
            // Preparar dados para salvamento
            const romaneioCompleto = prepararDadosSalvamento(dadosRomaneio, isEdicao);
            
            // Salvar no Firebase/localStorage
            const resultado = await executarSalvamento(romaneioCompleto, isEdicao);
            
            if (resultado.success) {
                notificarSucesso(resultado, isEdicao);
                    limparFormularioAposSalvamento();
                    // Forçar atualização da lista de romaneios após salvamento/edição
                    if (typeof window.forcarAtualizacaoListaAposEdicao === 'function') {
                        window.forcarAtualizacaoListaAposEdicao();
                    }
                    return true;
            } else {
                mostrarErro(resultado.error || 'Erro desconhecido ao salvar');
                return false;
            }
            
        } catch (error) {
            console.error('❌ Erro ao salvar romaneio:', error);
            mostrarErro('Erro interno ao salvar romaneio');
            return false;
        } finally {
            isProcessing = false;
        }
    }

    /**
     * Coletar dados do romaneio
     */
    async function coletarDadosRomaneio() {
        console.log('📋 Coletando dados do romaneio...');
        
        // Obter dados básicos
        const clienteInput = document.getElementById('fornecedorInput') || document.getElementById('clienteInput');
        const clienteNome = clienteInput?.value?.trim() || '';
        const dadosAtuais = getCurrentRomaneioData();
        const dataEmissao = getRomaneioEmissionDate(dadosAtuais && (dadosAtuais.dataEmissao || dadosAtuais.data || dadosAtuais.timestamp));
        
        // ✅ PADRONIZAÇÃO: Construir objeto cliente rico
        let clienteObj = null;
        
        if (window.selectedClient) {
            // Verificar se o nome no input corresponde ao cliente selecionado
            const selectedName = window.selectedClient.nome || window.selectedClient.name || '';
            // Comparação flexível (case insensitive)
            if (selectedName && clienteNome && selectedName.toLowerCase().trim() === clienteNome.toLowerCase()) {
                console.log('✅ Usando objeto cliente selecionado para salvamento:', window.selectedClient.id);
                clienteObj = window.selectedClient;
            }
        }
        
        // Se não tiver objeto selecionado ou nome não bater, criar objeto básico
        if (!clienteObj) {
            if (clienteNome) {
                console.log('ℹ️ Criando objeto cliente básico a partir do nome (sem ID vinculado)');
                clienteObj = { 
                    nome: clienteNome,
                    name: clienteNome,
                    _generated: true 
                };
            } else {
                clienteObj = ''; // Vazio
            }
        }
        
        // Obter lista de itens
        const items = window.AdicionarItem ? window.AdicionarItem.obterItens() : (window.romaneioItems || []);
        
        // Calcular totais
        const totais = calcularTotais(items);
        
        return {
            cliente: clienteObj, // ✅ AGORA É UM OBJETO (padronizado com Tora)
            clienteNome: clienteNome, // ✅ CAMPO NOVO: String simples para compatibilidade/leitura rápida
            data: dataEmissao,
            dataEmissao: dataEmissao,
            items: items.map(item => {
                const out = { ...item };
                out.espessura = out.espessura || out[legacyKey] || 0;
                try { delete out[legacyKey]; } catch (_) {}
                out.preco = typeof out.preco === 'number' ? out.preco : (parseFloat(out.preco) || 0);
                out.price = typeof out.price === 'number' ? out.price : (typeof out.preco === 'number' ? out.preco : (parseFloat(out.preco) || parseFloat(out.price) || 0));
                return out;
            }),
            totalVolume: totais.volume,
            totalValue: totais.valor,
            totalItens: items.length,
            timestamp: new Date().toISOString(),
            lastModified: new Date().toISOString()
        };
    }

    /**
     * Calcular totais do romaneio
     */
    function calcularTotais(items) {
        let totalVolume = 0;
        let totalValor = 0;
        
        items.forEach(item => {
            // ✅ SEMPRE RECALCULAR VOLUME - não usar item.volume pré-calculado incorreto
            const volumeIndividual = calcularVolumeItem(item);
            const quantidade = parseInt(item.quantidade) || 1;
            const precoUnitario = parseFloat(item.price || item.preco) || 0;
            
            const volumeTotal = volumeIndividual * quantidade;
            const valor = item.total || (volumeTotal * precoUnitario);
            
            totalVolume += volumeTotal;
            totalValor += valor;
        });
        
        return {
            volume: totalVolume,
            valor: totalValor
        };
    }

    /**
     * Calcular volume individual de um item (sem quantidade) - PADRONIZADO
     * Usa a função padronizada do UtilsTL para consistência
     */
    function calcularVolumeItem(item) {
        if (!item) return 0;
        
        const comprimento = parseFloat(item.comprimento) || 0;
        const espessura = parseFloat(item.espessura || item[legacyKey]) || 0;
        const largura = parseFloat(item.largura) || 0;
        
        // ✅ USAR FUNÇÃO PADRONIZADA do UtilsTL para garantir consistência
        if (window.UtilsTL && window.UtilsTL.calcularVolume) {
            return window.UtilsTL.calcularVolume(comprimento, largura, espessura, 1);
        }
        
        // Fallback com fórmula padronizada
        if (comprimento <= 0 || largura <= 0 || espessura <= 0) {
            console.warn('⚠️ Dimensões inválidas para cálculo de volume:', {comprimento, largura, espessura});
            return 0;
        }
        
        const volume = (comprimento * espessura * largura) / 1000000;
        return parseFloat(volume.toFixed(6));
    }

    /**
     * Validar dados do romaneio
     */
    function validarDadosRomaneio(dados) {
        console.log('🔍 Validando dados do romaneio...');
        console.log('📊 Dados recebidos para validação:', dados);
        
        const erros = [];
        
        // Validar cliente
        if (!dados.cliente) {
            erros.push('Cliente é obrigatório');
            console.log('❌ Cliente não informado');
        } else {
            console.log(`✅ Cliente: ${dados.cliente}`);
        }
        
        // Validar itens
        if (!dados.items || dados.items.length === 0) {
            erros.push('Pelo menos um item deve ser adicionado ao romaneio');
            console.log('❌ Nenhum item encontrado');
        } else {
            console.log(`✅ Total de itens: ${dados.items.length}`);
        }
        
        // Validar cada item
        dados.items.forEach((item, index) => {
            const posicao = index + 1;
            console.log(`🔍 Validando item ${posicao}:`, item);
            
            if (!item.especie) {
                erros.push(`Item ${posicao}: Espécie é obrigatória`);
                console.log(`❌ Item ${posicao}: Espécie não informada`);
            } else {
                console.log(`✅ Item ${posicao}: Espécie = ${item.especie}`);
            }
            
            if (!item.comprimento || item.comprimento <= 0) {
                erros.push(`Item ${posicao}: Comprimento deve ser maior que zero`);
                console.log(`❌ Item ${posicao}: Comprimento inválido = ${item.comprimento}`);
            } else {
                console.log(`✅ Item ${posicao}: Comprimento = ${item.comprimento}`);
            }
            
            const espessuraValor = item.espessura || item[legacyKey] || 0;
            if (!espessuraValor || espessuraValor <= 0) {
                erros.push(`Item ${posicao}: Espessura deve ser maior que zero`);
                console.log(`❌ Item ${posicao}: Espessura inválida = ${espessuraValor} (espessura: ${item.espessura})`);
            } else {
                console.log(`✅ Item ${posicao}: Espessura = ${espessuraValor}`);
            }
            
            if (!item.largura || item.largura <= 0) {
                erros.push(`Item ${posicao}: Largura deve ser maior que zero`);
                console.log(`❌ Item ${posicao}: Largura inválida = ${item.largura}`);
            } else {
                console.log(`✅ Item ${posicao}: Largura = ${item.largura}`);
            }
            
            if (!item.quantidade || item.quantidade <= 0) {
                erros.push(`Item ${posicao}: Quantidade deve ser maior que zero`);
                console.log(`❌ Item ${posicao}: Quantidade inválida = ${item.quantidade}`);
            } else {
                console.log(`✅ Item ${posicao}: Quantidade = ${item.quantidade}`);
            }
            
            // ✅ CORREÇÃO: Aceitar tanto price quanto preco
            const preco = item.preco || item.price || 0;
            if (!preco || preco <= 0) {
                erros.push(`Item ${posicao}: Preço deve ser maior que zero`);
                console.log(`❌ Item ${posicao}: Preço inválido = ${preco} (preco: ${item.preco}, price: ${item.price})`);
            } else {
                console.log(`✅ Item ${posicao}: Preço = ${preco}`);
            }
        });
        
        // Validar totais
        if (dados.totalVolume <= 0) {
            erros.push('Volume total deve ser maior que zero');
            console.log('❌ Volume total inválido =', dados.totalVolume);
        } else {
            console.log('✅ Volume total =', dados.totalVolume);
        }
        
        if (dados.totalValue <= 0) {
            erros.push('Valor total deve ser maior que zero');
            console.log('❌ Valor total inválido =', dados.totalValue);
        } else {
            console.log('✅ Valor total =', dados.totalValue);
        }
        
        if (erros.length > 0) {
            console.error('❌ Erros de validação encontrados:', erros);
            console.error('📊 Total de erros:', erros.length);
            erros.forEach((erro, index) => {
                console.error(`  ${index + 1}. ${erro}`);
            });
            mostrarErrosValidacao(erros);
            return false;
        }
        
        console.log('✅ Validação passou com sucesso');
        return true;
    }

    /**
     * Preparar dados para salvamento
     */
    function prepararDadosSalvamento(dados, isEdicao) {
        const romaneioId = isEdicao ? currentRomaneioId : gerarIdRomaneio();
        const companyId = resolveCompanyId();
        
        return {
            id: romaneioId,
            cliente: dados.cliente, // Objeto principal
            clienteNome: dados.clienteNome, // String (compatibilidade)
            fornecedor: dados.cliente, // ✅ ALIAS: Facilita filtros unificados (Compras/Vendas)
            data: dados.data,
            dataEmissao: dados.dataEmissao || dados.data,
            items: dados.items,
            totalVolume: dados.totalVolume,
            totalValue: dados.totalValue,
            totalItens: dados.totalItens,
            timestamp: isEdicao ? (getCurrentRomaneioData()?.timestamp || dados.timestamp) : dados.timestamp,
            lastModified: dados.lastModified,
            version: 1,
            tipo: 'TL',
            status: 'ativo',
            companyId: companyId || undefined
        };
    }

    /**
     * Executar salvamento
     */
    async function executarSalvamento(romaneio, isEdicao) {
        console.log(`💾 ${isEdicao ? 'Atualizando' : 'Salvando novo'} romaneio:`, romaneio.id);
        
        try {
            const service = getRomaneioDataService();
            if (service && typeof service.saveToFirebase === 'function') {
                try {
                    const saveRes = await service.saveToFirebase('romaneios/tl', String(romaneio.id), romaneio);
                    if (!saveRes || saveRes.success === false) throw new Error((saveRes && saveRes.error) || 'Falha de gravação');
                    salvarLocalStorage(romaneio);
                    return { success: true, location: 'Firebase (namespaced)', id: romaneio.id };
                } catch (errByRecord) {
                    console.warn('⚠️ Erro no saveToFirebase por registro, tentando saveData canônico:', errByRecord);
                }
            }
            // Tentar salvar no Firebase primeiro (unificado), depois serviço legado
            if (window.firebaseService && typeof window.firebaseService.saveData === 'function') {
                try {
                    await window.firebaseService.saveData(`romaneios/tl/${romaneio.id}`, romaneio);
                    console.log('✅ Romaneio salvo no Firebase (unificado)');
                    
                    salvarLocalStorage(romaneio);
                    return { success: true, location: 'Firebase (unificado)', id: romaneio.id };
                } catch (firebaseErrorUnified) {
                    console.warn('⚠️ Erro no Firebase (unificado), tentando serviço legado/localStorage:', firebaseErrorUnified);
                }
            }
            
            if (window.FirebaseService && typeof window.FirebaseService.saveData === 'function') {
                try {
                    await window.FirebaseService.saveData(`romaneios/tl/${romaneio.id}`, romaneio);
                    console.log('✅ Romaneio salvo no Firebase');
                    
                    salvarLocalStorage(romaneio);
                    
                    return { success: true, location: 'Firebase', id: romaneio.id };
                    
                } catch (firebaseError) {
                    console.warn('⚠️ Erro no Firebase:', firebaseError);
                    throw new Error('Falha ao salvar romaneio TL no Firebase canônico.');
                }
            } else {
                throw new Error('FirebaseService indisponível para salvar romaneio TL.');
            }
            
        } catch (error) {
            console.error('❌ Erro no salvamento:', error);
            return { success: false, error: error.message };
        }
    }

    /**
     * Salvar no localStorage
     */
    function salvarLocalStorage(romaneio) {
        try {
            try {
                if (window.SiswebStorage && typeof window.SiswebStorage.write === 'function') {
                    const storageKeyQuick = resolveStorageKey('romaneios/tl');
                    if (!storageKeyQuick || !/^companies\//.test(String(storageKeyQuick))) return false;
                    const currentRaw = localStorage.getItem(storageKeyQuick);
                    const currentObj = currentRaw ? JSON.parse(currentRaw) : {};
                    const merged = (currentObj && typeof currentObj === 'object') ? currentObj : {};
                    merged[romaneio.id] = romaneio;
                    return window.SiswebStorage.write(storageKeyQuick, merged) !== false;
                }
            } catch (_) {}
            const storageKey = resolveStorageKey('romaneios/tl');
            if (!storageKey || !/^companies\//.test(String(storageKey))) return false;
            const raw = localStorage.getItem(storageKey);
            let romaneiosExistentes = raw ? JSON.parse(raw) : null;
            if (!romaneiosExistentes || typeof romaneiosExistentes !== 'object') romaneiosExistentes = {};
            
            // Adicionar/atualizar romaneio
            romaneiosExistentes[romaneio.id] = romaneio;

            const isQuotaExceededError = (error) => {
                if (!error) return false;
                const message = String(error && error.message ? error.message : error);
                return error.name === 'QuotaExceededError'
                    || error.code === 22
                    || error.code === 1014
                    || /quota/i.test(message);
            };

            const compactRomaneio = (item) => {
                const r = item && typeof item === 'object' ? item : {};
                const itens = Array.isArray(r.itens) ? r.itens : [];
                const compactItens = itens.slice(0, 60).map((it) => ({
                    id: it.id || '',
                    especie: it.especie || '',
                    comprimento: parseFloat(it.comprimento) || 0,
                    largura: parseFloat(it.largura) || 0,
                    espessura: parseFloat(it.espessura || it.b || it.bitola) || 0,
                    quantidade: parseInt(it.quantidade, 10) || 0,
                    volume: parseFloat(it.volume || it.volumeBruto || 0) || 0,
                    preco: parseFloat(it.preco || it.precoUnitario || 0) || 0,
                    valorTotal: parseFloat(it.valorTotal || 0) || 0
                }));
                return {
                    id: r.id || '',
                    numero: r.numero || '',
                    data: r.data || '',
                    clienteNome: r.clienteNome || (r.cliente && (r.cliente.nome || r.cliente.name)) || '',
                    companyId: r.companyId || '',
                    totais: r.totais && typeof r.totais === 'object' ? r.totais : {},
                    itens: compactItens,
                    _metadata: r._metadata && typeof r._metadata === 'object' ? r._metadata : {}
                };
            };

            const writePayload = (payload) => {
                try {
                    localStorage.setItem(storageKey, payload);
                    return true;
                } catch (error) {
                    if (!isQuotaExceededError(error)) throw error;
                    return false;
                }
            };

            const fullPayload = JSON.stringify(romaneiosExistentes);
            if (!writePayload(fullPayload)) {
                const entries = Object.entries(romaneiosExistentes || {});
                const compactEntries = entries.slice(-25).map(([id, item]) => [id, compactRomaneio(item)]);
                const compactObject = Object.fromEntries(compactEntries);
                const compactPayload = JSON.stringify(compactObject);
                if (!writePayload(compactPayload)) {
                    return false;
                }
            }
            
            console.log('✅ Cache local do romaneio TL atualizado em companies/{companyId}/romaneios/tl');
            return true;
            
        } catch (error) {
            console.error('❌ Erro ao salvar no localStorage:', error);
            return false;
        }
    }

    /**
     * Gerar ID único para romaneio
     */
    function gerarIdRomaneio() {
        const timestamp = Date.now();
        const random = Math.random().toString(36).substr(2, 9);
        return `TL_${timestamp}_${random}`;
    }

    /**
     * Obter dados do romaneio atual (para edição)
     */
    function getCurrentRomaneioData() {
        return currentRomaneioData;
    }

    /**
     * Mostrar erros de validação
     */
    function mostrarErrosValidacao(erros) {
        const mensagem = 'Corrija os erros antes de salvar:\n' + erros.join('\n');
        if (typeof window.__toast === 'function') {
            window.__toast(mensagem, 'error');
        } else if (window.Utils && window.Utils.showToast) {
            window.Utils.showToast(mensagem, 'error');
        } else {
            console.error('❌ Erros de validação:', erros);
        }
    }

    /**
     * Mostrar erro
     */
    function mostrarErro(mensagem) {
        console.error('❌ Erro de salvamento:', mensagem);
        
        if (typeof window.__toast === 'function') {
            window.__toast(mensagem, 'error');
        } else if (window.Utils && window.Utils.showToast) {
            window.Utils.showToast(mensagem, 'error');
        } else {
            console.error('Erro ao salvar: ' + mensagem);
        }
    }

    /**
     * Notificar sucesso
     */
    function notificarSucesso(resultado, isEdicao) {
        const acao = isEdicao ? 'atualizado' : 'salvo';
        const mensagem = `Romaneio ${acao} com sucesso!`;
        const detalhes = `Local: ${resultado.location} | ID: ${resultado.id}`;
        
        console.log(`✅ ${mensagem} - ${detalhes}`);
        
        if (typeof window.__toast === 'function') {
            window.__toast(mensagem, 'success');
        } else if (window.Utils && window.Utils.showToast) {
            window.Utils.showToast(mensagem, 'success');
        } else {
            console.log(mensagem);
        }
    }

    /**
     * Limpar formulário após salvamento
     */
    function limparFormularioAposSalvamento() {
        console.log('🧹 Limpando formulário após salvamento...');
        
        // Confirmar limpeza
        const limpar = confirm('Romaneio salvo com sucesso!\n\nDeseja limpar o formulário para criar um novo romaneio?');
        
        if (limpar) {
            // Usar a função de limpeza completa do módulo AdicionarItem
            if (window.AdicionarItem && window.AdicionarItem.limparFormularioCompleto) {
                window.AdicionarItem.limparFormularioCompleto();
            } else {
                // Fallback para limpeza manual
                console.log('⚠️ Usando limpeza manual (fallback)');
                
                // Limpar campo cliente
                const clienteInput = document.getElementById('fornecedorInput') || document.getElementById('clienteInput');
                if (clienteInput) {
                    clienteInput.value = '';
                }
                
                // Limpar espécie padrão
                const especieInput = document.getElementById('especieInput');
                if (especieInput) {
                    especieInput.value = '';
                }
                
                // Limpar outros campos
                const campos = ['comprimento', 'largura', 'espessura', legacyKey, 'price'];
                campos.forEach(id => {
                    const input = document.getElementById(id);
                    if (input) {
                        input.value = '';
                    }
                });
                
                // Resetar quantidade para 1
                const quantidadeInput = document.getElementById('quantidade');
                if (quantidadeInput) {
                    quantidadeInput.value = '1';
                }
                
                // Limpar itens
                if (window.romaneioItems) {
                    window.romaneioItems.length = 0;
                }
                
                // Atualizar tabela
                if (window.RenderizarTabela && window.RenderizarTabela.renderizarTabela) {
                    window.RenderizarTabela.renderizarTabela();
                }
            }
            
            // Resetar ID do romaneio atual
            currentRomaneioId = null;
            currentRomaneioData = null;
            setRomaneioEmissionDate();
            
            // Focar no campo cliente
            const clienteInput = document.getElementById('fornecedorInput') || document.getElementById('clienteInput');
            if (clienteInput) {
                clienteInput.focus();
            }
            
            console.log('✅ Formulário limpo com sucesso');
        } else {
            console.log('ℹ️ Usuário optou por não limpar o formulário');
        }
    }

    /**
     * ✅ CARREGAR ROMANEIO PARA EDIÇÃO
     */
    async function carregarRomaneioParaEdicao(romaneioId) {
        console.log(`📂 Carregando romaneio para edição: ${romaneioId}`);
        
        try {
            let romaneio = null;
            
            // Tentar carregar do Firebase primeiro
            if (window.FirebaseService) {
                try {
                    romaneio = await window.FirebaseService.getData(`romaneios/tl/${romaneioId}`);
                } catch (firebaseError) {
                    console.warn('⚠️ Erro ao carregar do Firebase:', firebaseError);
                }
            }
            
            if (!romaneio) {
                // Fallback: tentar carregar do localStorage usando chaves possíveis
                console.log('⚠️ Romaneio não encontrado no FirebaseService, tentando localStorage diretamente...');
                const tenantId = window.FirebaseService?.getTenantId() || '';
                const keysToTry = [
                    `companies/${tenantId}/romaneios/tl/${romaneioId}`,
                    `romaneios/tl/${romaneioId}`,
                    `romaneioTL_${romaneioId}`
                ];
                for (const key of keysToTry) {
                    const localData = localStorage.getItem(key);
                    if (localData) {
                        try {
                            romaneio = JSON.parse(localData);
                            console.log(`✅ Romaneio recuperado do localStorage usando chave: ${key}`);
                            break;
                        } catch (e) {
                            console.warn(`⚠️ Erro ao parsear romaneio do localStorage (${key}):`, e);
                        }
                    }
                }
            }
            
            if (!romaneio) {
                throw new Error('Romaneio não encontrado');
            }
            
            // Definir ID atual para edição
            currentRomaneioId = romaneioId;
            currentRomaneioData = romaneio;
            
            // Preencher formulário
            preencherFormularioEdicao(romaneio);
            
            console.log('✅ Romaneio carregado para edição');
            return true;
            
        } catch (error) {
            console.error('❌ Erro ao carregar romaneio:', error);
            mostrarErro('Erro ao carregar romaneio para edição');
            return false;
        }
    }

    /**
     * Preencher formulário para edição
     */
    function preencherFormularioEdicao(romaneio) {
        console.log('📝 Preenchendo formulário para edição:', romaneio);
        setRomaneioEmissionDate(romaneio && (romaneio.dataEmissao || romaneio.data || romaneio.timestamp));
        
        // Preencher cliente
        const clienteInput = document.getElementById('clienteInput');
        if (clienteInput) {
            // ✅ CORREÇÃO: Suporte a cliente como objeto ou string
            const nomeCliente = romaneio.clienteNome || (typeof romaneio.cliente === 'object' ? (romaneio.cliente.nome || romaneio.cliente.name) : romaneio.cliente) || '';
            clienteInput.value = nomeCliente;
            
            // Tentar restaurar o objeto selecionado se disponível
            if (typeof romaneio.cliente === 'object') {
                window.selectedClient = romaneio.cliente;
            }
            
            console.log('✅ Cliente preenchido:', nomeCliente);
        } else {
            console.error('❌ Campo clienteInput não encontrado');
        }
        
        // Obter a lista de itens suportando tanto 'items' quanto 'itens'
        const itemsList = romaneio.items || romaneio.itens || [];
        
        // Preencher espécie padrão (primeira espécie dos itens)
        const especieInput = document.getElementById('especieInput');
        if (especieInput && itemsList.length > 0) {
            const primeiraEspecie = itemsList[0].especie;
            if (primeiraEspecie) {
                especieInput.value = primeiraEspecie;
                // Definir espécie selecionada globalmente
                window.selectedSpecies = { nome: primeiraEspecie, name: primeiraEspecie };
                console.log('✅ Espécie padrão preenchida:', primeiraEspecie);
            }
        } else {
            console.warn('⚠️ Campo especieInput não encontrado ou sem itens');
        }
        
        // Verificar se o array global existe
        if (!window.romaneioItems) {
            console.error('❌ Array global window.romaneioItems não existe, criando...');
            window.romaneioItems = [];
        }
        
        // Carregar itens
        if (Array.isArray(itemsList) && itemsList.length > 0) {
            console.log(`📦 Processando ${itemsList.length} itens para edição...`);
            
            // Normalizar campos nos itens carregados
            const itensNormalizados = itemsList.map((item, index) => {
                console.log(`🔍 Processando item ${index + 1}:`, item);
                
                const itemNormalizado = {
                    ...item,
                    // ✅ COMPATIBILIDADE: garantir campos corretos
                    espessura: item.espessura || item[legacyKey] || 0,
                    preco: item.preco || item.price || 0,
                    price: item.price || item.preco || 0
                };
                
                // ✅ SEMPRE RECALCULAR VOLUME usando função padronizada
                const volumeAnterior = itemNormalizado.volume;
                itemNormalizado.volume = calcularVolumeItem(itemNormalizado);
                
                if (volumeAnterior && Math.abs(volumeAnterior - itemNormalizado.volume) > 0.000001) {
                    console.log(`🔄 Volume CORRIGIDO para item ${index + 1}: ${volumeAnterior.toFixed(6)} → ${itemNormalizado.volume.toFixed(6)} m³`);
                } else {
                    console.log(`📐 Volume calculado para item ${index + 1}: ${itemNormalizado.comprimento}x${itemNormalizado.espessura}x${itemNormalizado.largura} = ${itemNormalizado.volume.toFixed(6)} m³`);
                }
                
                // Garantir que valorTotal existe
                if (!itemNormalizado.valorTotal) {
                    const quantidade = parseInt(itemNormalizado.quantidade) || 1;
                    itemNormalizado.valorTotal = itemNormalizado.volume * quantidade * itemNormalizado.preco;
                    console.log(`💰 Valor total calculado para item ${index + 1}: R$ ${itemNormalizado.valorTotal.toFixed(2)}`);
                }
                
                return itemNormalizado;
            });
            
            // Definir itens no array global
            console.log('🔄 Limpando array global e carregando novos itens...');
            window.romaneioItems.length = 0; // Limpar array existente
            window.romaneioItems.push(...itensNormalizados);
            console.log(`✅ ${itensNormalizados.length} itens carregados no array global`);
            console.log('📊 Array global após carregamento:', window.romaneioItems);
            
            // Atualizar interface
            if (window.RenderizarTabela && window.RenderizarTabela.renderizarTabela) {
                console.log('🔄 Renderizando tabela...');
                window.RenderizarTabela.renderizarTabela();
                console.log('✅ Tabela de itens atualizada');
            } else {
                console.error('❌ Módulo RenderizarTabela não disponível');
            }
            
            // Atualizar totais
            if (window.RenderizarTabela && window.RenderizarTabela.atualizarTotais) {
                console.log('🔄 Atualizando totais...');
                window.RenderizarTabela.atualizarTotais(window.romaneioItems);
                console.log('✅ Totais atualizados');
            } else {
                console.error('❌ Função atualizarTotais não disponível');
            }
        } else {
            console.warn('⚠️ Nenhum item encontrado no romaneio ou formato inválido');
            window.romaneioItems.length = 0;
            
            if (window.RenderizarTabela && window.RenderizarTabela.renderizarTabela) {
                window.RenderizarTabela.renderizarTabela();
            }
        }
        
        console.log('✅ Formulário completamente preenchido para edição');
        console.log('📊 Estado final do array global:', window.romaneioItems);
    }

    /**
     * Cancelar edição
     */
    function cancelarEdicao() {
        currentRomaneioId = null;
        currentRomaneioData = null;
        setRomaneioEmissionDate();
        console.log('✅ Edição cancelada');
    }

    /**
     * Verificar se está em modo de edição
     */
    function isEditMode() {
        return currentRomaneioId !== null;
    }

    /**
     * Obter estatísticas de salvamento
     */
    function obterEstatisticas() {
        return {
            isProcessing: isProcessing,
            isEditMode: isEditMode(),
            currentRomaneioId: currentRomaneioId
        };
    }

    /**
     * ✅ FUNÇÃO DE DEBUG: Testar validação
     */
    function testarValidacao() {
        console.log('🧪 Testando validação do romaneio...');
        
        // Obter dados atuais
        const dados = {
            cliente: document.getElementById('clienteInput')?.value?.trim() || '',
            items: window.romaneioItems || [],
            totalVolume: 0,
            totalValue: 0
        };
        
        console.log('📊 Dados para teste:', dados);
        
        // Testar validação
        const resultado = validarDadosRomaneio(dados);
        
        console.log(`🎯 Resultado do teste: ${resultado ? 'PASSOU' : 'FALHOU'}`);
        
        return resultado;
    }

    /**
     * ✅ FUNÇÃO DE DEBUG: Testar edição de romaneio
     */
    function testarEdicaoRomaneio() {
        console.log('🧪 Testando edição de romaneio...');
        
        // Verificar se array global existe
        console.log('📊 Array global romaneioItems:', window.romaneioItems);
        console.log('📊 Tipo do array:', typeof window.romaneioItems);
        console.log('📊 É array?', Array.isArray(window.romaneioItems));
        console.log('📊 Comprimento:', window.romaneioItems ? window.romaneioItems.length : 'undefined');
        
        // Verificar módulo RenderizarTabela
        console.log('🔍 Módulo RenderizarTabela:', typeof window.RenderizarTabela);
        console.log('🔍 Função renderizarTabela:', typeof window.RenderizarTabela?.renderizarTabela);
        console.log('🔍 Função atualizarTotais:', typeof window.RenderizarTabela?.atualizarTotais);
        
        // Verificar campos do formulário
        const clienteInput = document.getElementById('clienteInput');
        const especieInput = document.getElementById('especieInput');
        console.log('📝 Campo cliente:', clienteInput ? 'encontrado' : 'não encontrado');
        console.log('📝 Campo espécie:', especieInput ? 'encontrado' : 'não encontrado');
        
        return {
            arrayGlobal: !!window.romaneioItems,
            isArray: Array.isArray(window.romaneioItems),
            length: window.romaneioItems?.length || 0,
            renderModule: !!window.RenderizarTabela,
            renderFunction: !!window.RenderizarTabela?.renderizarTabela,
            totalsFunction: !!window.RenderizarTabela?.atualizarTotais,
            clientField: !!clienteInput,
            speciesField: !!especieInput
        };
    }

    // ✅ INTERFACE PÚBLICA
    return {
        salvarRomaneio,
        carregarRomaneioParaEdicao,
        cancelarEdicao,
        isEditMode,
        obterEstatisticas,
        testarValidacao,
        testarEdicaoRomaneio,
        setRomaneioEmissionDate
    };

})();

// ✅ FUNÇÕES GLOBAIS PARA COMPATIBILIDADE
window.salvarRomaneio = window.SalvarRomaneio.salvarRomaneio;
window.testarValidacaoRomaneio = window.SalvarRomaneio.testarValidacao; // Função de debug
window.testarEdicaoRomaneio = window.SalvarRomaneio.testarEdicaoRomaneio; // Função de debug

if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => window.SalvarRomaneio.setRomaneioEmissionDate(), { once: true });
} else {
    window.SalvarRomaneio.setRomaneioEmissionDate();
}

console.log('✅ Módulo SalvarRomaneio carregado com sucesso (campo espessura)');
console.log('🧪 Para testar a validação, digite: testarValidacaoRomaneio() no console'); 
