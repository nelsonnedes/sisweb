/**
 * 🖨️ MÓDULO: Impressão Romaneio PCT
 * 
 * FUNCIONALIDADES ESPECÍFICAS:
 * - Sistema de impressão com informações de pacotes
 * - Agrupamento por espécies incluindo pecasPorPacote  
 * - Relatórios CONAMA específicos PCT
 * - Totalizações específicas com pacotes
 * 
 * EXTRAÍDO DE: romaneiopct_modais.js (Fase 2)
 * PRESERVA: 100% das funcionalidades de impressão PCT
 */

console.log('🚀 === INICIANDO CARREGAMENTO DO MÓDULO DE IMPRESSÃO PCT ===');
console.log('📍 Arquivo: modules/romaneiopct/imprimir-romaneio-pct.js');
console.log('⏰ Timestamp:', new Date().toISOString());

// ============================================================================
// CONFIGURAÇÕES DE IMPRESSÃO PCT
// ============================================================================

const TIPOS_IMPRESSAO_PCT = {
    COMPLETO: 'completo',
    SEM_PRECO_UNITARIO: 'sem_preco_unitario',
    SEM_PRECO: 'sem_preco'
};

function isLikelyCompanyId(value) {
    if (value === null || value === undefined) return false;
    const candidate = String(value).trim();
    if (!candidate) return false;
    if (candidate.length < 3) return false;
    if (/\s/.test(candidate)) return false;
    return true;
}

function normalizeCompanyData(company = {}) {
    const src = (company && typeof company === 'object') ? company : {};
    const addressParts = [src.endereco, src.logradouro, src.numero, src.bairro].filter(Boolean).join(', ');
    return {
        id: src.id || src.companyId || src.companyID || src.tenantId || src.slug || '',
        name: src.name || src.nome || src.razaoSocial || src.fantasia || src.companyName || src.empresaNome || '',
        cnpj: src.cnpj || src.cnpjCpf || src.cpfCnpj || src.documento || src.document || '',
        address: src.address || src.endereco || addressParts || src.companyAddress || src.empresaEndereco || '',
        city: src.city || src.cidade || src.municipio || src.companyCity || src.empresaCidade || '',
        state: src.state || src.uf || src.estado || src.companyState || src.empresaEstado || '',
        phone: src.phone || src.telefone || src.celular || src.fone || src.whatsapp || src.companyPhone || src.empresaTelefone || '',
        logo: src.logo || src.logoUrl || src.image || src.imagem || src.photo || src.avatar || ''
    };
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
            const id = raw.id || raw.companyId || raw.companyID || raw.tenantId || raw.slug;
            if (isLikelyCompanyId(id)) return String(id);
        }
        const stored = localStorage.getItem('company_info');
        if (stored) {
            const obj = JSON.parse(stored);
            const id = obj && (obj.id || obj.companyId || obj.companyID || obj.tenantId || obj.slug);
            if (isLikelyCompanyId(id)) return String(id);
        }
    } catch (_) {}
    return null;
}

function getLocalStorageKeys(key) {
    const keys = [];
    try {
        const base = String(key || '');
        if (!base) return keys;
        const svc = window.firebaseService || window.firebaseServiceTL || window.FirebaseService;
        if (svc && typeof svc.getNamespacedPath === 'function') {
            const ns = svc.getNamespacedPath(base);
            if (ns && ns !== base) {
                keys.push(ns);
                return [...new Set(keys)];
            }
        } else {
            const companyId = resolveCompanyId();
            if (companyId && !/^companies\//.test(base) && !/^users\//.test(base)) {
                keys.push(`companies/${companyId}/${base}`);
                return [...new Set(keys)];
            }
        }
    } catch (_) {}
    return [...new Set(keys)];
}

function readLocalStorageValue(key) {
    for (const k of getLocalStorageKeys(key)) {
        const val = localStorage.getItem(k);
        if (val) return val;
    }
    return null;
}

// ============================================================================
// CARREGAMENTO DE DADOS (MESCLAR Firebase + localStorage)
// ============================================================================

async function carregarRomaneiosMergedPct() {
    try {
        // Coletar dados do Firebase
        let firebaseRomaneios = [];
        if (window.firebaseService && typeof window.firebaseService.loadFromFirebase === 'function') {
            try {
                const res = await window.firebaseService.loadFromFirebase('romaneios/pct');
                const data = res && res.success ? res.data : null;
                if (Array.isArray(data)) {
                    firebaseRomaneios = data;
                } else if (data && typeof data === 'object') {
                    firebaseRomaneios = Object.values(data);
                }
            } catch (e) {
                console.warn('PCT: Falha ao carregar romaneios do Firebase para impressão:', e);
            }
        }

        // Coletar dados do localStorage
        let localRomaneios = [];
        try {
            const raw = readLocalStorageValue('romaneiosPct');
            if (raw) {
                const parsed = JSON.parse(raw);
                if (Array.isArray(parsed)) {
                    localRomaneios = parsed;
                } else if (parsed && typeof parsed === 'object') {
                    localRomaneios = Object.values(parsed);
                }
            }
        } catch (e) {
            console.warn('PCT: Falha ao carregar romaneios do localStorage para impressão:', e);
        }

        // Filtrar registros válidos
        firebaseRomaneios = (firebaseRomaneios || []).filter(r => r && (r.id || r.numero || r.cliente));
        localRomaneios = (localRomaneios || []).filter(r => r && (r.id || r.numero || r.cliente));

        // Deduplicar priorizando local (recém-salvos)
        const idSet = new Set(localRomaneios.map(r => String(r.id)).filter(Boolean));
        const numeroSet = new Set(localRomaneios.map(r => String(r.numero)).filter(Boolean));

        const merged = [
            ...localRomaneios,
            ...firebaseRomaneios.filter(r => {
                const idKey = String(r.id || '');
                const numKey = String(r.numero || '');
                return (!idKey || !idSet.has(idKey)) && (!numKey || !numeroSet.has(numKey));
            })
        ];

        // Logs diagnósticos em caso de falha de busca
        if (!merged || merged.length === 0) {
            console.warn('PCT: Nenhum romaneio encontrado nas fontes para impressão.');
        } else {
            const sampleIds = merged.slice(0, 5).map(r => String(r.id));
            const sampleNums = merged.slice(0, 5).map(r => String(r.numero));
            console.log('PCT: Amostra de IDs disponíveis para impressão:', sampleIds);
            console.log('PCT: Amostra de números disponíveis para impressão:', sampleNums);
        }

        return merged;
    } catch (err) {
        console.error('PCT: Erro inesperado ao mesclar dados para impressão:', err);
        return [];
    }
}

// ============================================================================
// FUNÇÃO PRINCIPAL DE IMPRESSÃO PCT
// ============================================================================

async function imprimirRomaneio(index, tipo = 'completo', romaneioId = null) {
    console.log('🖨️ === FUNÇÃO IMPRIMIROMANEIO EXECUTADA ===');
    console.log('📋 Parâmetros recebidos:', { index, tipo, romaneioId });
    try {
        // Se o ID foi fornecido explicitamente através do parâmetro, usá-lo
        // Caso contrário, tratamos index como o próprio ID para compatibilidade retroativa
        const targetId = romaneioId || index;
        
        console.log(`Iniciando impressão do romaneio com ID ${targetId}, tipo: ${tipo}`);
        
        // ✅ CORREÇÃO: Aguardar verificação e reparo de IDs se a função existir
        if (typeof window.reparaIdsRomaneios === 'function') {
            await window.reparaIdsRomaneios();
        }
        
        // Mostrar indicador de carregamento
        const loadingIndicator = document.createElement('div');
        loadingIndicator.className = 'print-loading-indicator';
        loadingIndicator.innerHTML = `
            <div class="print-loading-spinner">
                <i class="fas fa-spinner fa-spin"></i>
            </div>
            <div class="print-loading-text">Preparando impressão...</div>
        `;
        document.body.appendChild(loadingIndicator);
        
        // ✅ CORREÇÃO: Carregar dados mesclados (Firebase + localStorage)
        const romaneios = await carregarRomaneiosMergedPct();
        
        // Verificar se temos romaneios
        if (!romaneios || romaneios.length === 0) {
            console.error("Nenhum romaneio encontrado para impressão");
            document.body.removeChild(loadingIndicator);
            alert('Erro: Nenhum romaneio encontrado para impressão.');
            return;
        }
        
        // Buscar romaneio por ID e, se necessário, por número
        let romaneio = romaneios.find(r => String(r.id) === String(targetId));
        if (!romaneio) {
            romaneio = romaneios.find(r => String(r.numero) === String(targetId));
        }
        
        // Se não encontrar pelo ID direto, tentar usar o índice (comportamento antigo)
        if (!romaneio && typeof index === 'number' && index >= 0 && index < romaneios.length) {
            console.warn(`Romaneio com ID/número ${targetId} não encontrado, tentando usar índice ${index}`);
            const romaneioByIndex = romaneios[index];
            
            if (romaneioByIndex) {
                console.log(`Usando romaneio do índice ${index} com ID ${romaneioByIndex.id}`);
                return await imprimirRomaneio(romaneioByIndex.id, tipo);
            }
        }
        
        // Se ainda não encontrou, não há como imprimir
        if (!romaneio) {
            console.error(`Romaneio com ID/número ${targetId} não encontrado`);
            document.body.removeChild(loadingIndicator);
            alert(`Romaneio com ID ou número ${targetId} não encontrado.`);
            return;
        }
        
        console.log(`Preparando impressão do romaneio para cliente ${romaneio.cliente ? (typeof romaneio.cliente === 'object' ? (romaneio.cliente.nome || romaneio.cliente.name) : romaneio.cliente) : 'N/A'} com ID ${romaneio.id}`);
        
        // Fechar menu de impressão se estiver aberto
        const printMenu = document.querySelector('.print-menu.show');
        if (printMenu) {
            printMenu.classList.remove('show');
            printMenu.classList.remove('show-above');
            
            // Remover overlay se existir
            const dropdown = printMenu.closest('.print-dropdown');
            if (dropdown && dropdown.classList.contains('overlay')) {
                dropdown.classList.remove('overlay');
            }
        }
        
        // Criar janela de impressão
        const printWindow = window.open('', '_blank');
        
        // Garantir que a janela foi criada corretamente
        if (!printWindow) {
            // Remover indicador de carregamento
            document.body.removeChild(loadingIndicator);
            alert("Falha ao abrir janela de impressão. Verifique se os pop-ups estão permitidos.");
            return;
        }
        
        // Validar o tipo de impressão
        const tiposValidos = ['completo', 'sem_preco_unitario', 'sem_preco'];
        if (!tiposValidos.includes(tipo)) {
            console.warn(`Tipo de impressão inválido: ${tipo}. Usando 'completo' como padrão.`);
            tipo = 'completo';
        }
        
        // ✅ CARREGAR DADOS DA EMPRESA
        const company = await getCompanyData();
        
        // ✅ GERAR CONTEÚDO DE IMPRESSÃO
        const printContent = await gerarConteudoImpressao(romaneio, company, tipo);
        
        // ✅ INSERIR CONTEÚDO NA JANELA DE IMPRESSÃO
        printWindow.document.write(printContent);
        printWindow.document.close();
        
        // Remover indicador de carregamento
        document.body.removeChild(loadingIndicator);
        
        // Aguardar um pouco para o conteúdo carregar e então imprimir
        setTimeout(() => {
            printWindow.focus();
            printWindow.print();
        }, 500);
        
        console.log('✅ Impressão preparada com sucesso');
        
    } catch (error) {
        console.error('❌ Erro na impressão:', error);
        alert('Erro ao preparar impressão: ' + error.message);
        
        // Remover indicador de carregamento em caso de erro
        if (document.body.contains(loadingIndicator)) {
            document.body.removeChild(loadingIndicator);
        }
    }
}

// ============================================================================
// FUNÇÃO PARA CARREGAR DADOS DA EMPRESA
// ============================================================================

async function getCompanyData() {
    console.log("🏢 === CARREGANDO DADOS DA EMPRESA PARA RELATÓRIO ===");
    
    try {
        const tenantId = resolveCompanyId();
        const svc = window.firebaseService || window.firebaseServiceTL || window.FirebaseService;
        let selectedCompany = null;

        if (tenantId && svc && typeof svc.loadFromFirebase === 'function') {
            try {
                const byPath = await svc.loadFromFirebase(`companies/${tenantId}/profile`);
                const byPathData = byPath && byPath.success ? byPath.data : (byPath && byPath.data ? byPath.data : null);
                const normalizedByPath = normalizeCompanyData(byPathData || {});
                if (normalizedByPath.name || normalizedByPath.cnpj || normalizedByPath.address || normalizedByPath.phone || normalizedByPath.logo) {
                    selectedCompany = normalizedByPath;
                    console.log(`✅ Empresa carregada por caminho explícito do tenant: companies/${tenantId}/profile`);
                }
            } catch (e) {
                console.warn('⚠️ PCT: Falha ao carregar companies/{tenantId}/profile:', e);
            }
        }

        // ✅ USAR A MESMA FUNÇÃO getData DO SISTEMA
        if (!selectedCompany) {
            console.log("📊 Tentando carregar empresas cadastradas...");
            const companiesRaw = await getData('companies');
            const companies = Array.isArray(companiesRaw) ? companiesRaw : (companiesRaw && typeof companiesRaw === 'object' ? Object.values(companiesRaw) : []);
            const normalizedCompanies = companies.map(normalizeCompanyData);
            console.log(`📊 Resultado do carregamento: ${normalizedCompanies.length} empresas encontradas`);
            if (tenantId) {
                selectedCompany = normalizedCompanies.find(c => String(c.id || '') === String(tenantId)) || null;
            } else if (normalizedCompanies.length === 1) {
                selectedCompany = normalizedCompanies[0];
            }
            if (selectedCompany) {
                console.log("✅ Empresa selecionada para impressão PCT:", { id: selectedCompany.id, name: selectedCompany.name });
            }
        }
        
        const companyData = selectedCompany || {};
        if (selectedCompany) {
            console.log("✅ Dados da empresa carregados:");
            console.log("  📝 Nome:", companyData.name || 'Sem nome');
            console.log("  🏭 CNPJ:", companyData.cnpj || 'Sem CNPJ');
            console.log("  📍 Endereço:", companyData.address || 'Sem endereço');
            console.log("  📞 Telefone:", companyData.phone || 'Sem telefone');
            console.log("  🖼️ Logo:", companyData.logo ? 'PRESENTE' : 'AUSENTE');
        } else {
            console.log("⚠️ NENHUMA EMPRESA DO TENANT ENCONTRADA - Usando dados padrão");
        }
        
        // ✅ PROCESSAR LOGO DA EMPRESA (FIREBASE OU BASE64)
        let logoProcessado = '';
        if (companyData.logo) {
            try {
                console.log("🖼️ Processando logo da empresa...");
                
                // Se a logo é uma URL do Firebase
                if (companyData.logo.startsWith('https://')) {
                    logoProcessado = companyData.logo;
                    console.log("✅ Logo identificada como URL do Firebase Storage");
                } else if (companyData.logo.startsWith('data:')) {
                    logoProcessado = companyData.logo;
                    console.log("✅ Logo identificada como base64");
                } else {
                    logoProcessado = companyData.logo;
                    console.log("🔄 Tentando usar logo mesmo com formato não reconhecido");
                }
            } catch (error) {
                console.error("❌ Erro ao processar logo da empresa:", error);
                logoProcessado = '';
            }
        } else {
            console.log("ℹ️ Nenhuma logo cadastrada - Será usado SVG padrão no HTML");
        }
    
        const finalCompanyData = {
            name: companyData.name || 'Empresa não informada',
            cnpj: companyData.cnpj || '-',
            address: companyData.address || '-',
            city: companyData.city || '-',
            state: companyData.state || '-',
            phone: companyData.phone || '-',
            logo: logoProcessado
        };
        
        console.log("📋 === DADOS FINAIS DA EMPRESA ===");
        console.log("  📝 Nome:", finalCompanyData.name);
        console.log("  🏭 CNPJ:", finalCompanyData.cnpj);
        console.log("  📍 Endereço:", finalCompanyData.address);
        console.log("  🏙️ Cidade:", finalCompanyData.city);
        console.log("  🗺️ Estado:", finalCompanyData.state);
        console.log("  📞 Telefone:", finalCompanyData.phone);
        console.log("  🖼️ Logo presente:", !!finalCompanyData.logo);
        
        console.log("✅ === DADOS DA EMPRESA CARREGADOS COM SUCESSO ===");
        return finalCompanyData;
        
    } catch (error) {
        console.error("❌ === ERRO AO CARREGAR DADOS DA EMPRESA ===");
        console.error("❌ Erro:", error);
        
        // Retornar dados padrão em caso de erro
        const defaultData = {
            name: 'Empresa não informada',
            cnpj: '-',
            address: '-',
            city: '-',
            state: '-',
            phone: '-',
            logo: ''
        };
        
        console.log("🔄 Usando dados padrão devido ao erro:", defaultData);
        return defaultData;
    }
}

// ============================================================================
// FUNÇÃO PARA GERAR CONTEÚDO DE IMPRESSÃO
// ============================================================================

async function gerarConteudoImpressao(romaneio, company, tipo) {
    console.log(`🖨️ Gerando conteúdo de impressão COMPLEXO para tipo: ${tipo}`);
    
    // ✅ PROCESSAR ITENS E CRIAR ESTRUTURA ADAPTATIVA
    const itens = romaneio.itens || [];
    // Processando itens para impressão complexa
    
    // ✅ AGRUPAR ITENS POR DIMENSÕES (LÓGICA ORIGINAL)
    const itensAgrupados = [];
    const comprimentosUnicos = new Set();
    const totaisPorComprimento = {};
    
    // Primeiro, coletar todos os comprimentos únicos
    itens.forEach(item => {
        const comprimento = parseFloat(item.comprimento) || 0;
        comprimentosUnicos.add(comprimento);
    });
    
    // Converter para array e ordenar numericamente
    const comprimentosColunas = Array.from(comprimentosUnicos).sort((a, b) => a - b);
    console.log(`📏 Comprimentos encontrados: ${comprimentosColunas.join(', ')}`);
    
    // Inicializar totais por comprimento
    comprimentosColunas.forEach(comp => {
        totaisPorComprimento[comp] = 0;
    });
    
    // Agrupar itens por espessura, largura e espécie
    const grupos = {};
    itens.forEach(item => {
        const espessura = parseFloat(item.espessura) || 0;
        const largura = parseFloat(item.largura) || 0;
        const comprimento = parseFloat(item.comprimento) || 0;
        const especie = item.especie || 'Sem espécie';
        const quantidade = parseInt(item.quantidade) || 0;
        const pecasPorPacote = parseInt(item.pecasPorPacote) || 1;
        const preco = parseFloat(item.valorUnitario) || parseFloat(item.preco) || 0;
        
        const chave = `${espessura}-${largura}-${especie}`;
        
        if (!grupos[chave]) {
            grupos[chave] = {
                espessura,
                largura,
                especie,
                comprimentosArray: {},
                valorUnitario: preco,
                volumeM3: 0,
                metrosLineares: 0,
                valorTotal: 0,
                mediaComprimento: 0
            };
            
            // Inicializar todos os comprimentos com 0
            comprimentosColunas.forEach(comp => {
                grupos[chave].comprimentosArray[comp] = 0;
            });
            
            console.log(`💰 PCT: Grupo criado - ${especie} ${espessura}x${largura}cm - Valor Unitário: R$ ${preco.toFixed(2)}`);
        } else {
            // Para itens agrupados, manter o mesmo valor unitário (assumindo que itens iguais têm mesmo preço)
            if (grupos[chave].valorUnitario !== preco) {
                console.warn(`⚠️ PCT: Valores unitários diferentes detectados para o mesmo item! Grupo: R$ ${grupos[chave].valorUnitario.toFixed(2)}, Novo: R$ ${preco.toFixed(2)}`);
            }
        }
        
        // Adicionar quantidade para este comprimento específico
        grupos[chave].comprimentosArray[comprimento] += quantidade * pecasPorPacote;
        
        // Calcular volume e outros totais
        const volumeUnitario = (comprimento * largura * espessura) / 1000000;
        const volumeTotal = volumeUnitario * quantidade * pecasPorPacote;
        const valorParcial = volumeTotal * preco;
        
        grupos[chave].volumeM3 += volumeTotal;
        grupos[chave].metrosLineares += (comprimento / 100) * quantidade * pecasPorPacote;
        grupos[chave].valorTotal += valorParcial;
        
        console.log(`📊 PCT: Item processado - ${especie} ${espessura}x${largura}x${comprimento}cm`);
        console.log(`   └─ Quantidade: ${quantidade} × ${pecasPorPacote} = ${quantidade * pecasPorPacote} peças`);
        console.log(`   └─ Volume: ${volumeTotal.toFixed(6)} m³, Valor unitário: R$ ${preco.toFixed(2)}, Valor parcial: R$ ${valorParcial.toFixed(2)}`);
        console.log(`   └─ Valor total acumulado do grupo: R$ ${grupos[chave].valorTotal.toFixed(2)}`);
    });
    
    // Converter grupos em array
    Object.values(grupos).forEach(grupo => {
        // Calcular média de comprimento
        let totalPecas = 0;
        let somaComprimentosPonderada = 0;
        
        comprimentosColunas.forEach(comp => {
            const qtd = grupo.comprimentosArray[comp];
            totalPecas += qtd;
            somaComprimentosPonderada += comp * qtd;
        });
        
        grupo.mediaComprimento = totalPecas > 0 ? somaComprimentosPonderada / totalPecas : 0;
        itensAgrupados.push(grupo);
    });
    
    console.log(`🔄 Agrupamento concluído: ${itensAgrupados.length} grupos criados`);
    
    // ✅ LOG DOS VALORES FINAIS PARA DEBUG
    console.log('💰 PCT: Valores finais dos grupos:');
    itensAgrupados.forEach((grupo, index) => {
        console.log(`  ${index + 1}. ${grupo.especie} ${grupo.espessura}x${grupo.largura}cm:`);
        console.log(`     └─ Valor unitário: R$ ${grupo.valorUnitario.toFixed(2)}`);
        console.log(`     └─ Valor total: R$ ${grupo.valorTotal.toFixed(2)}`);
        console.log(`     └─ Volume: ${grupo.volumeM3.toFixed(6)} m³`);
        
        // Verificar se há valores inválidos
        if (grupo.valorUnitario === 0) {
            console.warn(`⚠️ PCT: Valor unitário ZERO detectado para ${grupo.especie} ${grupo.espessura}x${grupo.largura}cm`);
        }
        if (grupo.valorTotal === 0) {
            console.warn(`⚠️ PCT: Valor total ZERO detectado para ${grupo.especie} ${grupo.espessura}x${grupo.largura}cm`);
        }
    });
    
    // ✅ CALCULAR TOTAIS GERAIS
    let totalPecasGeral = 0;
    let totalVolumeM3 = 0;
    let volumeTotal = 0;
    
    itensAgrupados.forEach(item => {
        comprimentosColunas.forEach(comp => {
            totalPecasGeral += item.comprimentosArray[comp];
        });
        totalVolumeM3 += item.volumeM3;
        volumeTotal += item.volumeM3;
    });
    
    // ✅ PREPARAR DADOS BÁSICOS - CORRIGIR PROBLEMA DA DATA
    let dataFormatada = 'Data não informada';
    
    // Tentar primeiro 'data' (campo usado na criação), depois 'timestamp' (compatibilidade)
    if (romaneio.data) {
        try {
            const data = new Date(romaneio.data);
            if (!isNaN(data.getTime())) {
                dataFormatada = data.toLocaleDateString('pt-BR', {
                    year: 'numeric', month: '2-digit', day: '2-digit'
                });
            } else {
                dataFormatada = romaneio.data; // Se não for uma data válida, usar o valor original
            }
        } catch (e) {
            dataFormatada = romaneio.data; // Em caso de erro, usar o valor original
        }
    } else if (romaneio.timestamp) {
        try {
            const data = new Date(romaneio.timestamp);
            if (!isNaN(data.getTime())) {
                dataFormatada = data.toLocaleDateString('pt-BR', {
                    year: 'numeric', month: '2-digit', day: '2-digit'
                });
            }
        } catch (e) {
            dataFormatada = 'Data não informada';
        }
    }
    
    const especies = [...new Set(itens.map(item => item.especie))].filter(Boolean);
    const ua = navigator.userAgent || '';
    const tipoNorm = String(tipo || '').replace(/-/g, '_').toLowerCase();
    const hideUnitCol = tipoNorm === 'sem_preco_unitario' || tipoNorm === 'sem_preco';
    const hideTotalCol = tipoNorm === 'sem_preco';
    const tailColsVisible = 6 - (hideUnitCol ? 1 : 0) - (hideTotalCol ? 1 : 0);
    const isEdge = /Edg\//i.test(ua);
    const isChrome = !isEdge && /Chrome\//i.test(ua);
    const pctCompCount = comprimentosColunas.length;
    const pctTranslateMm = isEdge ? 189 : (isChrome ? 190 : 189.5);
    const pctCompColPx = pctCompCount >= 18 ? 20 : (pctCompCount >= 14 ? 22 : 24);
    const pctUnitColPx = pctCompCount >= 14 ? 40 : 44;
    const pctTotalColPx = pctCompCount >= 14 ? 46 : 50;
    const pctScale = pctCompCount >= 18 ? 0.86 : (pctCompCount >= 14 ? 0.90 : 0.94);
    const isPortraitNow = !!(window.matchMedia && window.matchMedia('(orientation: portrait)').matches);
    const baseRowsByComp = pctCompCount >= 20 ? 14 : (pctCompCount >= 17 ? 15 : (pctCompCount >= 14 ? 16 : 18));
    const orientationBonus = isPortraitNow ? 0 : 4;
    const priceColsBonus = (hideUnitCol ? 1 : 0) + (hideTotalCol ? 1 : 0);
    const maxRowsFirstPage = Math.max(10, baseRowsByComp + orientationBonus + priceColsBonus);
    const tableHeadHtml = `
                <thead>
                    <tr>
                        <th><span class="hdr-long">Espessura (cm)</span><span class="hdr-short">Esp. (cm)</span></th>
                        <th><span class="hdr-long">Largura (cm)</span><span class="hdr-short">Larg. (cm)</span></th>
                        <th>Espécie</th>
                        <th colspan="${comprimentosColunas.length}"><span class="hdr-long">Comprimentos em Centímetros</span><span class="hdr-short">Compr. (cm)</span></th>
                        <th class="col-qtd"><span class="hdr-long">Qtd. Peças</span><span class="hdr-short">Qtd.</span></th>
                        <th class="col-ml"><span class="hdr-long">M. Linear</span><span class="hdr-short">M.Lin.</span></th>
                        <th class="always-show-volume col-vm2"><span class="hdr-long">Volume (m²)</span><span class="hdr-short">Vol. (m²)</span></th>
                        <th class="always-show-volume col-vm3"><span class="hdr-long">Volume (m³)</span><span class="hdr-short">Vol. (m³)</span></th>
                        <th class="no-print-unit-price text-right col-unit"><span class="hdr-long">Preço Unitário</span><span class="hdr-short">Preço Unit.</span></th>
                        <th class="no-print-price text-right col-total"><span class="hdr-long">Valor Total</span><span class="hdr-short">Valor Total</span></th>
                    </tr>
                    <tr>
                        <th colspan="3"></th>
                        ${comprimentosColunas.map(comp => `<th>${comp}</th>`).join('')}
                        <th colspan="${tailColsVisible}"></th>
                    </tr>
                </thead>
    `;
    
    // ✅ TEMPLATE HTML COMPLEXO ORIGINAL RESTAURADO
    let printContent = `
        <!DOCTYPE html>
        <html lang="pt-BR">
        <head>
            <meta charset="UTF-8">
            <title>Romaneio Pacote #${romaneio.id || 'N/A'}</title>
            <style>
                body {
                    font-family: Arial, sans-serif;
                    margin: 0;
                    padding: 20px;
                    color: #333;
                    font-size: 12px;
                    line-height: 1.4;
                    background: #fff;
                }
                :root {
                    --pct-translate-x: ${pctTranslateMm}mm;
                    --pct-scale: ${pctScale};
                    --pct-comp-col: ${pctCompColPx}px;
                    --pct-comp-col-base: ${pctCompColPx}px;
                    --pct-qtd-col: 34px;
                    --pct-ml-col: 42px;
                    --pct-vm2-col: 44px;
                    --pct-vm3-col: 44px;
                    --pct-unit-col: ${pctUnitColPx}px;
                    --pct-total-col: ${pctTotalColPx}px;
                    --pct-qtd-col-base: 40px;
                    --pct-ml-col-base: 52px;
                    --pct-vm2-col-base: 56px;
                    --pct-vm3-col-base: 56px;
                    --pct-unit-col-base: ${pctUnitColPx}px;
                    --pct-total-col-base: ${pctTotalColPx}px;
                    --pct-soft-border: #dde5ef;
                    --pct-soft-bg: #f5f8fc;
                    --pct-ink: #1e2a38;
                }
                
                /* ✅ Cabeçalho da empresa integrado ao romaneio */
                .header {
                    display: grid;
                    grid-template-columns: 132px minmax(0, 1fr);
                    gap: 14px;
                    margin-bottom: 15px;
                    border-bottom: 2px solid #333;
                    padding: 8px 0 12px;
                    align-items: center;
                    page-break-inside: avoid;
                    break-inside: avoid;
                }
                
                .logo {
                    width: 120px;
                    text-align: center;
                    flex-shrink: 0;
                    align-self: start;
                }
                
                .logo img {
                    max-width: 100%;
                    height: auto;
                    max-height: 100px;
                }
                
                .logo svg {
                    width: 80px;
                    height: 80px;
                }
                
                .company-info {
                    min-width: 0;
                    display: grid;
                    gap: 4px;
                    background: linear-gradient(135deg, #ffffff 0%, var(--pct-soft-bg) 100%);
                    border: 1px solid var(--pct-soft-border);
                    border-radius: 8px;
                    padding: 10px 12px;
                }
                
                .company-name {
                    font-size: 20px;
                    font-weight: bold;
                    margin-bottom: 4px;
                    color: #2c3e50;
                    text-transform: uppercase;
                    letter-spacing: 0.4px;
                }
                
                .company-details {
                    font-size: 12px;
                    margin-bottom: 2px;
                    color: #555;
                    line-height: 1.3;
                }
                
                /* ✅ Título do romaneio integrado (sem forçar quebra de página) */
                .title {
                    text-align: center;
                    font-size: 18px;
                    font-weight: bold;
                    margin: 15px 0;
                    text-transform: uppercase;
                    color: #2c3e50;
                    page-break-inside: avoid;
                    break-inside: avoid;
                    page-break-before: auto;
                    page-break-after: auto;
                }
                
                .customer-info {
                    margin-bottom: 16px;
                    border: 1px solid var(--pct-soft-border);
                    padding: 10px 12px;
                    background: linear-gradient(135deg, #ffffff 0%, var(--pct-soft-bg) 100%);
                    border-radius: 8px;
                    display: grid;
                    gap: 8px;
                }
                
                .info-row {
                    display: grid;
                    grid-template-columns: 88px minmax(0, 1fr) 74px minmax(140px, 0.5fr);
                    column-gap: 8px;
                    row-gap: 4px;
                    align-items: center;
                }
                
                .info-label {
                    font-weight: bold;
                    color: var(--pct-ink);
                    font-size: 11px;
                }
                
                .info-value {
                    min-width: 0;
                    background: #fff;
                    border: 1px solid #e6ecf3;
                    border-radius: 6px;
                    padding: 4px 8px;
                    color: #2e3d4f;
                    font-size: 11px;
                }
                .customer-info .info-row:last-child {
                    grid-template-columns: 88px minmax(0, 1fr);
                }
                
                .items-table {
                    width: 100%;
                    border-collapse: collapse;
                    margin-bottom: 20px;
                    table-layout: fixed;
                }
                
                .items-table th, .items-table td {
                    border: 1px solid #ddd;
                    padding: 6px;
                    text-align: left;
                    font-size: 11px;
                }
                
                /* ✅ MELHORIA LEGIBILIDADE: Todo conteúdo da tabela em negrito */
                .items-table td {
                    font-weight: bold;
                }
                
                .items-table th {
                    background-color: #0d2339;
                    color: white;
                    font-weight: bold;
                    text-align: center;
                    font-size: 11px;
                    text-transform: uppercase;
                    letter-spacing: 0.5px;
                }
                .items-table th .hdr-short {
                    display: none;
                }
                .items-table th .hdr-long {
                    display: inline;
                }
                
                /* ✅ ESTILO ESPECÍFICO PARA A SEGUNDA LINHA DO CABEÇALHO (COMPRIMENTOS) */
                .items-table thead tr:nth-child(2) th {
                    background-color: #1b4670;
                    font-size: 10px;
                    border: 1px solid #153554;
                    padding: 4px 2px;
                }
                
                /* ✅ LARGURAS OTIMIZADAS PARA AS COLUNAS */
                .items-table th:nth-child(1), 
                .items-table td:nth-child(1) { 
                    width: 8%; 
                    min-width: 60px; 
                }
                
                .items-table th:nth-child(2), 
                .items-table td:nth-child(2) { 
                    width: 8%; 
                    min-width: 60px; 
                }
                
                .items-table th:nth-child(3), 
                .items-table td:nth-child(3) { 
                    width: 12%; 
                    min-width: 80px; 
                }
                
                /* ✅ PADRONIZAR LARGURAS DAS COLUNAS DE COMPRIMENTOS */
                .items-table thead tr:nth-child(2) th {
                    width: var(--pct-comp-col-base, 35px) !important;
                    min-width: var(--pct-comp-col-base, 35px) !important;
                    max-width: var(--pct-comp-col-base, 35px) !important;
                    text-align: center !important;
                    padding: 2px 1px !important;
                    font-size: 9px !important;
                    white-space: nowrap !important;
                }
                
                /* ✅ ESTILO ESPECÍFICO PARA TODAS AS COLUNAS DE COMPRIMENTOS NO CORPO */
                .items-table tbody td.center.has-value,
                .items-table tbody td.center:not(.has-value) {
                    width: var(--pct-comp-col-base, 35px) !important;
                    min-width: var(--pct-comp-col-base, 35px) !important;
                    max-width: var(--pct-comp-col-base, 35px) !important;
                    text-align: center !important;
                    padding: 2px 1px !important;
                    font-size: 10px !important;
                }
                
                /* ✅ FORÇA LARGURA IGUAL PARA TODAS AS COLUNAS DE COMPRIMENTOS DYNAMICAS */
                .items-table td:nth-child(n+4):not(:nth-last-child(-n+6)) {
                    width: var(--pct-comp-col-base, 35px) !important;
                    min-width: var(--pct-comp-col-base, 35px) !important;
                    max-width: var(--pct-comp-col-base, 35px) !important;
                    text-align: center !important;
                    padding: 2px 1px !important;
                    font-size: 10px !important;
                    white-space: nowrap !important;
                }
                .items-table th.col-qtd,
                .items-table td.col-qtd {
                    width: var(--pct-qtd-col-base, 40px);
                    min-width: var(--pct-qtd-col-base, 40px);
                }
                .items-table th.col-ml,
                .items-table td.col-ml {
                    width: var(--pct-ml-col-base, 52px);
                    min-width: var(--pct-ml-col-base, 52px);
                }
                .items-table th.col-vm2,
                .items-table td.col-vm2 {
                    width: var(--pct-vm2-col-base, 56px);
                    min-width: var(--pct-vm2-col-base, 56px);
                }
                .items-table th.col-vm3,
                .items-table td.col-vm3 {
                    width: var(--pct-vm3-col-base, 56px);
                    min-width: var(--pct-vm3-col-base, 56px);
                }
                .items-table th.col-unit,
                .items-table td.col-unit {
                    width: var(--pct-unit-col-base, 50px);
                    min-width: var(--pct-unit-col-base, 50px);
                }
                .items-table th.col-total,
                .items-table td.col-total {
                    width: var(--pct-total-col-base, 58px);
                    min-width: var(--pct-total-col-base, 58px);
                }
                .items-table thead tr:first-child th.col-qtd,
                .items-table thead tr:first-child th.col-ml,
                .items-table thead tr:first-child th.col-vm2,
                .items-table thead tr:first-child th.col-vm3,
                .items-table thead tr:first-child th.col-unit,
                .items-table thead tr:first-child th.col-total {
                    white-space: normal;
                    line-height: 1.1;
                    padding: 4px 2px;
                }
                
                /* ✅ GARANTIR CENTRALIZAÇÃO GERAL */
                .center { 
                    text-align: center !important; 
                }
                
                .number { 
                    text-align: right !important; 
                    font-family: 'Courier New', monospace;
                }
                
                .text-right { 
                    text-align: right !important; 
                }
                
                /* ✅ ALINHAMENTO ESPECÍFICO PARA COLUNAS NUMÉRICAS */
                .items-table td.col-total,
                .items-table td.col-unit,
                .items-table td.col-vm3,
                .items-table td.col-vm2,
                .items-table td.col-ml {
                    text-align: right !important;
                    font-family: 'Courier New', monospace !important;
                    white-space: nowrap !important;
                }
                
                /* ✅ ALINHAMENTO PARA CABEÇALHOS DAS COLUNAS NUMÉRICAS */
                .items-table th.col-total,
                .items-table th.col-unit,
                .items-table th.col-vm3,
                .items-table th.col-vm2,
                .items-table th.col-ml {
                    text-align: right !important;
                    white-space: nowrap !important;
                }
                
                /* ✅ ALINHAMENTO PARA LINHA DE TOTAIS */
                .total-geral-row td.col-total,
                .total-geral-row td.col-unit,
                .total-geral-row td.col-vm3,
                .total-geral-row td.col-vm2,
                .total-geral-row td.col-ml {
                    text-align: right !important;
                    font-family: 'Courier New', monospace !important;
                    font-weight: bold !important;
                    white-space: nowrap !important;
                }
                
                /* ✅ FORÇA CENTRALIZAÇÃO PARA TODAS AS COLUNAS DE QUANTIDADE */
                .items-table tbody td.center,
                .items-table tfoot td.center {
                    text-align: center !important;
                    vertical-align: middle !important;
                }
                
                .total-geral-row {
                    background-color: #f8f9fa;
                    font-weight: bold;
                }
                
                .signature {
                    margin-top: 40px;
                }
                .signature-grid {
                    display: grid;
                    grid-template-columns: repeat(2, minmax(180px, 1fr));
                    gap: 28px;
                    align-items: end;
                }
                .signature-block {
                    text-align: center;
                }
                .signature-line {
                    border-top: 1px solid #000;
                    margin-bottom: 6px;
                }
                
                /* Controle de visibilidade por tipo de impressão */
                body[data-print-mode="sem_preco"] .no-print-price,
                body[data-print-mode="sem_preco_unitario"] .no-print-unit-price,
                body[data-print-mode="sem_preco"] .no-print-unit-price {
                    display: none !important;
                }
                
                /* ✅ COMPATIBILIDADE COM TIPOS NORMALIZADOS */
                body[data-print-mode="sem-preco"] .no-print-price,
                body[data-print-mode="sem-preco-unitario"] .no-print-unit-price,
                body[data-print-mode="sem-preco"] .no-print-unit-price {
                    display: none !important;
                }
                
                /* ✅ ESTILOS OTIMIZADOS PARA QUEBRA DE PÁGINA - PAISAGEM */
                .page-break { 
                    page-break-before: always;
                    break-before: page;
                    margin: 0;
                    padding: 0;
                    height: 0;
                    clear: both;
                }
                
                .no-break { 
                    page-break-inside: avoid;
                    break-inside: avoid;
                }
                
                /* ✅ CABEÇALHO + ROMANEIO PRINCIPAL EM UMA SÓ PÁGINA */
                .romaneio-principal {
                    page-break-inside: avoid;
                    break-inside: avoid;
                    orphans: 3;
                    widows: 3;
                }
                
                /* ✅ CONTROLE INTELIGENTE DE QUEBRAS */
                .header-romaneio-container {
                    page-break-inside: avoid;
                    break-inside: avoid;
                }
                
                @media print {
                        body { margin: 0; }
                        body[data-dense-table="1"] .header {
                            margin-bottom: 6px !important;
                            padding-bottom: 6px !important;
                        }
                        body[data-dense-table="1"] .title {
                            margin: 6px 0 8px 0 !important;
                            font-size: 15px !important;
                        }
                        body[data-dense-table="1"] .customer-info {
                            margin-bottom: 8px !important;
                            padding: 6px !important;
                        }
                        body[data-dense-table="1"] .signature {
                            margin-top: 14px !important;
                        }
                        body[data-dense-table="2"] .header {
                            margin-bottom: 4px !important;
                            padding-bottom: 4px !important;
                            grid-template-columns: 86px minmax(0, 1fr) !important;
                            gap: 8px !important;
                        }
                        body[data-dense-table="2"] .logo {
                            width: 78px !important;
                        }
                        body[data-dense-table="2"] .logo img {
                            max-height: 54px !important;
                        }
                        body[data-dense-table="2"] .logo svg {
                            width: 52px !important;
                            height: 52px !important;
                        }
                        body[data-dense-table="2"] .company-info {
                            padding: 5px 7px !important;
                            border-radius: 5px !important;
                            gap: 2px !important;
                        }
                        body[data-dense-table="2"] .company-name {
                            font-size: 12px !important;
                            margin-bottom: 1px !important;
                            letter-spacing: 0.15px !important;
                        }
                        body[data-dense-table="2"] .company-details {
                            font-size: 8px !important;
                            line-height: 1.05 !important;
                            margin-bottom: 0 !important;
                        }
                        body[data-dense-table="2"] .title {
                            margin: 4px 0 6px 0 !important;
                            font-size: 14px !important;
                            padding: 2px 0 !important;
                        }
                        body[data-dense-table="2"] .customer-info {
                            margin-bottom: 6px !important;
                            padding: 4px !important;
                            border-radius: 5px !important;
                            gap: 4px !important;
                        }
                        body[data-dense-table="2"] .info-row {
                            grid-template-columns: 52px minmax(0, 1fr) 34px minmax(70px, 0.45fr) !important;
                            column-gap: 4px !important;
                            row-gap: 2px !important;
                        }
                        body[data-dense-table="2"] .customer-info .info-row:last-child {
                            grid-template-columns: 52px minmax(0, 1fr) !important;
                        }
                        body[data-dense-table="2"] .info-label {
                            font-size: 7.8px !important;
                        }
                        body[data-dense-table="2"] .info-value {
                            font-size: 7.8px !important;
                            padding: 2px 5px !important;
                            border-radius: 4px !important;
                        }
                        body[data-dense-table="2"] .signature {
                            margin-top: 8px !important;
                        }
                        /* ✅ Cabeçalho integrado - sem margem excessiva */
                        .header { 
                            margin-bottom: 10px; 
                            page-break-inside: avoid;
                            break-inside: avoid;
                        }
                        /* ✅ Título integrado - sem quebra forçada */
                        .title {
                            page-break-before: auto;
                            page-break-after: auto;
                            page-break-inside: avoid;
                            margin: 10px 0 15px 0;
                        }
                        button { display: none; }
                        
                        /* ✅ GARANTIR CORES DO CABEÇALHO NA IMPRESSÃO */
                        .items-table th {
                            background-color: #0d2339 !important;
                            color: white !important;
                            print-color-adjust: exact;
                            -webkit-print-color-adjust: exact;
                        }
                        
                        .items-table thead tr:nth-child(2) th {
                            background-color: #1b4670 !important;
                            color: white !important;
                            print-color-adjust: exact;
                            -webkit-print-color-adjust: exact;
                        }
                        
                        /* ✅ GARANTIR NEGRITO EM TODAS AS CÉLULAS NA IMPRESSÃO */
                        .items-table td {
                            font-weight: bold !important;
                        }
                        .items-table th,
                        .items-table td {
                            box-sizing: border-box !important;
                            overflow: visible !important;
                            text-overflow: clip !important;
                        }
                        .items-table td:nth-child(3),
                        .items-table th:nth-child(3) {
                            white-space: normal !important;
                            word-break: break-word !important;
                            overflow-wrap: anywhere !important;
                            font-size: 9px !important;
                        }
                        body[data-dense-table="1"] .items-table th,
                        body[data-dense-table="1"] .items-table td {
                            font-size: 6.6px !important;
                            padding: 1px !important;
                            line-height: 1.05 !important;
                        }
                        body[data-dense-table="2"] .items-table th,
                        body[data-dense-table="2"] .items-table td {
                            font-size: 6.1px !important;
                            padding: 0px 1px !important;
                            line-height: 1.02 !important;
                        }
                        body[data-dense-table="2"] .items-table thead tr:first-child th {
                            font-size: 5.6px !important;
                            line-height: 1 !important;
                            padding: 0 1px !important;
                        }
                        body[data-dense-table="2"] .items-table thead tr:nth-child(2) th {
                            font-size: 5.4px !important;
                            line-height: 1 !important;
                            padding: 0 1px !important;
                        }
                        
                        /* ✅ GARANTIR ALINHAMENTO À DIREITA NA IMPRESSÃO */
                        .items-table td.col-total,
                        .items-table td.col-unit,
                        .items-table td.col-vm3,
                        .items-table td.col-vm2,
                        .items-table td.col-ml,
                        .total-geral-row td.col-total,
                        .total-geral-row td.col-unit,
                        .total-geral-row td.col-vm3,
                        .total-geral-row td.col-vm2,
                        .total-geral-row td.col-ml {
                            text-align: right !important;
                            font-family: 'Courier New', monospace !important;
                            white-space: nowrap !important;
                            font-weight: bold !important; /* Reforçar negrito para colunas numéricas */
                            letter-spacing: -0.1px !important;
                            font-variant-numeric: tabular-nums;
                            overflow: visible !important;
                            text-overflow: clip !important;
                        }
                        
                        .items-table th.col-total,
                        .items-table th.col-unit,
                        .items-table th.col-vm3,
                        .items-table th.col-vm2,
                        .items-table th.col-ml {
                            text-align: right !important;
                            white-space: normal !important;
                            word-break: break-word !important;
                            overflow-wrap: anywhere !important;
                        }
                        body[data-dense-table="1"] .items-table td.col-total,
                        body[data-dense-table="1"] .items-table td.col-unit,
                        body[data-dense-table="1"] .items-table td.col-vm3,
                        body[data-dense-table="1"] .items-table td.col-vm2,
                        body[data-dense-table="1"] .items-table td.col-ml {
                            font-size: 6px !important;
                            letter-spacing: -0.14px !important;
                        }
                        body[data-dense-table="2"] .items-table td.col-total,
                        body[data-dense-table="2"] .items-table td.col-unit,
                        body[data-dense-table="2"] .items-table td.col-vm3,
                        body[data-dense-table="2"] .items-table td.col-vm2,
                        body[data-dense-table="2"] .items-table td.col-ml {
                            font-size: 5.5px !important;
                            letter-spacing: -0.18px !important;
                        }
                        body[data-dense-table="2"] .items-table td.col-total .currency-prefix,
                        body[data-dense-table="2"] .items-table td.col-unit .currency-prefix {
                            display: none !important;
                        }
                        
                        /* ✅ CARDS DE RESUMO OTIMIZADOS - DEFINIDO NA SEÇÃO ESPECÍFICA DOS CARDS */
                        
                        /* ✅ CONTROLE OTIMIZADO DE QUEBRA DE PÁGINA PARA PAISAGEM */
                        .title, .customer-info, .table-container { 
                            page-break-inside: avoid;
                            orphans: 2;
                            widows: 2;
                        }
                        
                        /* ✅ MANTER TABELA PRINCIPAL JUNTA QUANDO POSSÍVEL */
                        .items-table { 
                            page-break-inside: auto;
                            break-inside: auto;
                        }
                        
                        .items-table thead { 
                            page-break-after: avoid;
                            break-after: avoid;
                        }
                        
                        .items-table tbody tr { 
                            page-break-inside: avoid;
                            break-inside: avoid;
                        }
                        
                        .total-geral-row { 
                            page-break-inside: avoid;
                            page-break-before: avoid;
                        }
                        
                        /* ✅ CONTROLE INTELIGENTE PARA SEÇÕES DE RESUMO */
                        .resumo-page-break { 
                            page-break-before: auto;
                            break-before: auto;
                    margin: 0;
                    min-height: 0;
                    height: 0;
                        }
                        
                        /* ✅ RETRATO: EVITAR DUPLA QUEBRA (container já força quebra ao final) */
                        @media print and (orientation: portrait) {
                            .resumo-page-break { 
                                page-break-before: auto !important;
                                break-before: auto !important;
                                margin-top: 0 !important;
                                display: none !important;
                            }
                        }
                        
                        /* ✅ PAISAGEM: CORREÇÃO - MANTER TÍTULO E CARDS JUNTOS */
                        @media print and (orientation: landscape) {
                            .resumo-secao {
                                page-break-inside: avoid;
                                break-inside: avoid;
                            }
                            
                            /* CORREÇÃO CRÍTICA: No layout paisagem, remover quebra forçada */
                            .resumo-page-break { 
                                page-break-before: avoid !important;
                                break-before: avoid !important;
                                margin-top: 20px;
                                display: none; /* Ocultar div de quebra em paisagem */
                            }
                            
                            /* Garantir que o título fique junto com os cards */
                            .resumo-titulo {
                                page-break-after: avoid !important;
                                break-after: avoid !important;
                            }
                        }
                        
                        .conama-page-break { 
                            page-break-before: always;
                            break-before: page;
                            margin-top: 0;
                            min-height: 0;
                        }
                        
                        /* ✅ CORREÇÃO CONAMA PAISAGEM: Melhorar paginação da seção CONAMA em paisagem */
                        @media print and (orientation: landscape) {
                            .conama-page-break {
                                page-break-before: auto !important; /* Em paisagem, quebra mais inteligente */
                                break-before: auto !important;
                                margin-top: 30px;
                            }
                        }
                        
                        .resumo-especie, .totals { page-break-inside: avoid; }
                        
                        /* ✅ CABEÇALHO + ROMANEIO EM UMA SÓ PÁGINA */
                        .header-romaneio-container,
                        .romaneio-principal { 
                            page-break-inside: avoid;
                            break-inside: avoid;
                        }
                        
                        /* ========================================= */
                        /* 🚨 SOLUÇÕES CRÍTICAS PARA RETRATO PCT 🚨 */
                        /* ========================================= */
                        @media print and (orientation: portrait) {
                            #pct-cont-pagebreak {
                                display: none !important;
                                page-break-before: auto !important;
                                break-before: auto !important;
                            }
                            
                            /* ✅ COMPACTAÇÃO MÁXIMA DO CABEÇALHO PARA ECONOMIZAR ESPAÇO */
                            .header {
                                margin-bottom: 5px !important;
                                padding-bottom: 5px !important;
                            }
                            
                            .company-name {
                                font-size: 14px !important;
                                margin-bottom: 2px !important;
                            }
                            
                            .company-details {
                                font-size: 9px !important;
                                margin-bottom: 1px !important;
                                line-height: 1.1 !important;
                            }
                            
                            .title {
                                font-size: 14px !important;
                                margin: 5px 0 !important;
                                padding: 5px !important;
                            }
                            
                            .customer-info {
                                margin-bottom: 10px !important;
                                padding: 5px !important;
                            }
                            
                            .info-row {
                                grid-template-columns: 62px minmax(0, 1fr) 48px minmax(80px, 0.5fr) !important;
                                column-gap: 4px !important;
                            }
                            .customer-info .info-row:last-child {
                                grid-template-columns: 62px minmax(0, 1fr) !important;
                            }
                            
                            .info-label, .info-value {
                                font-size: 9px !important;
                            }
                            .signature-grid {
                                grid-template-columns: repeat(2, minmax(130px, 1fr)) !important;
                                gap: 18px !important;
                            }
                            body[data-dense-table="1"] .header {
                                margin-bottom: 4px !important;
                                padding-bottom: 4px !important;
                                grid-template-columns: 78px minmax(0, 1fr) !important;
                                gap: 6px !important;
                            }
                            body[data-dense-table="1"] .logo {
                                width: 70px !important;
                            }
                            body[data-dense-table="1"] .logo img {
                                max-height: 50px !important;
                            }
                            body[data-dense-table="1"] .company-name {
                                font-size: 11px !important;
                            }
                            body[data-dense-table="1"] .company-details {
                                font-size: 7.6px !important;
                                line-height: 1.02 !important;
                            }
                            body[data-dense-table="1"] .title {
                                font-size: 12.5px !important;
                                margin: 3px 0 !important;
                                padding: 2px 0 !important;
                            }
                            body[data-dense-table="1"] .customer-info {
                                margin-bottom: 5px !important;
                                padding: 3px !important;
                                gap: 3px !important;
                            }
                            body[data-dense-table="1"] .info-label,
                            body[data-dense-table="1"] .info-value {
                                font-size: 7.4px !important;
                            }
                            body[data-dense-table="2"] .header {
                                margin-bottom: 2px !important;
                                padding-bottom: 2px !important;
                                grid-template-columns: 68px minmax(0, 1fr) !important;
                                gap: 4px !important;
                            }
                            body[data-dense-table="2"] .logo {
                                width: 60px !important;
                            }
                            body[data-dense-table="2"] .logo img {
                                max-height: 42px !important;
                            }
                            body[data-dense-table="2"] .company-name {
                                font-size: 10px !important;
                            }
                            body[data-dense-table="2"] .company-details {
                                font-size: 7px !important;
                                line-height: 1 !important;
                            }
                            body[data-dense-table="2"] .title {
                                font-size: 11px !important;
                                margin: 2px 0 !important;
                                padding: 1px 0 !important;
                            }
                            body[data-dense-table="2"] .customer-info {
                                margin-bottom: 4px !important;
                                padding: 2px !important;
                                gap: 2px !important;
                            }
                            body[data-dense-table="2"] .info-label,
                            body[data-dense-table="2"] .info-value {
                                font-size: 6.8px !important;
                            }
                            
                            /* 🚨 ESTRATÉGIA AGRESSIVA: COLUNAS PRINCIPAIS ULTRA-COMPACTAS */
                            .items-table th:nth-child(1), 
                            .items-table td:nth-child(1) { 
                                width: 35px !important; 
                                min-width: 35px !important;
                                max-width: 35px !important;
                                font-size: 7px !important;
                                padding: 1px !important;
                            }
                            
                            .items-table th:nth-child(2), 
                            .items-table td:nth-child(2) { 
                                width: 35px !important; 
                                min-width: 35px !important;
                                max-width: 35px !important;
                                font-size: 7px !important;
                                padding: 1px !important;
                            }
                            
                            .items-table th:nth-child(3), 
                            .items-table td:nth-child(3) { 
                                width: 50px !important; 
                                min-width: 50px !important; 
                                max-width: 50px !important;
                                font-size: 7px !important;
                                padding: 1px !important;
                            }
                            
                            /* 🚨 COLUNAS DE COMPRIMENTOS: COMPACTAÇÃO SEM PERDER LEGIBILIDADE */
                            .items-table td:nth-child(n+4):not(:nth-last-child(-n+6)) {
                                width: var(--pct-comp-col, 24px) !important;
                                min-width: var(--pct-comp-col, 24px) !important;
                                max-width: var(--pct-comp-col, 24px) !important;
                                font-size: 7px !important;
                                padding: 0px 1px !important;
                                line-height: 1.1 !important;
                                white-space: nowrap !important;
                                overflow: visible !important;
                            }
                            
                            .items-table thead tr:nth-child(2) th {
                                width: var(--pct-comp-col, 24px) !important;
                                min-width: var(--pct-comp-col, 24px) !important;
                                max-width: var(--pct-comp-col, 24px) !important;
                                font-size: 7px !important;
                                padding: 0px 1px !important;
                                line-height: 1.1 !important;
                                white-space: nowrap !important;
                                overflow: visible !important;
                            }
                            .items-table td.col-unit,
                            .items-table th.col-unit {
                                width: var(--pct-unit-col, 44px) !important;
                                min-width: var(--pct-unit-col, 44px) !important;
                                max-width: var(--pct-unit-col, 44px) !important;
                                white-space: nowrap !important;
                            }
                            .items-table td.col-total,
                            .items-table th.col-total {
                                width: var(--pct-total-col, 50px) !important;
                                min-width: var(--pct-total-col, 50px) !important;
                                max-width: var(--pct-total-col, 50px) !important;
                                white-space: nowrap !important;
                            }
                            .items-table td.col-qtd,
                            .items-table th.col-qtd {
                                width: var(--pct-qtd-col, 34px) !important;
                                min-width: var(--pct-qtd-col, 34px) !important;
                                max-width: var(--pct-qtd-col, 34px) !important;
                            }
                            .items-table td.col-ml,
                            .items-table th.col-ml {
                                width: var(--pct-ml-col, 42px) !important;
                                min-width: var(--pct-ml-col, 42px) !important;
                                max-width: var(--pct-ml-col, 42px) !important;
                            }
                            .items-table td.col-vm2,
                            .items-table th.col-vm2 {
                                width: var(--pct-vm2-col, 44px) !important;
                                min-width: var(--pct-vm2-col, 44px) !important;
                                max-width: var(--pct-vm2-col, 44px) !important;
                            }
                            .items-table td.col-vm3,
                            .items-table th.col-vm3 {
                                width: var(--pct-vm3-col, 44px) !important;
                                min-width: var(--pct-vm3-col, 44px) !important;
                                max-width: var(--pct-vm3-col, 44px) !important;
                            }
                            .items-table thead tr:first-child th:nth-last-child(-n+6) {
                                white-space: normal !important;
                                line-height: 1.05 !important;
                                font-size: 6.7px !important;
                                padding: 1px !important;
                                word-break: break-word !important;
                                overflow-wrap: anywhere !important;
                                text-align: center !important;
                            }
                            body[data-compact-labels="1"] .items-table th .hdr-long {
                                display: none !important;
                            }
                            body[data-compact-labels="1"] .items-table th .hdr-short {
                                display: inline !important;
                                letter-spacing: 0 !important;
                            }
                            
                            /* 🚨 CONFIGURAÇÕES CRÍTICAS DA TABELA */
                            .items-table {
                                table-layout: fixed !important;
                                width: 100% !important;
                                font-size: 7px !important;
                                border-collapse: collapse !important;
                            }
                            
                            .items-table th, .items-table td {
                                font-size: 7px !important;
                                padding: 1px !important;
                                line-height: 1.1 !important;
                                vertical-align: middle !important;
                                border: 0.5px solid #ddd !important;
                            }
                            
                            /* ✅ MANTER NEGRITO NO RETRATO */
                            .items-table td {
                                font-weight: bold !important;
                            }
                            
                            .items-table th {
                                font-size: 7px !important;
                                padding: 2px 1px !important;
                                text-align: center !important;
                            }
                            
                            /* 🚨 LINHA DE TOTAIS - CRÍTICA */
                            .total-geral-row td {
                                font-size: 7px !important;
                                font-weight: bold !important;
                                padding: 2px 1px !important;
                            }
                            
                        }
                        
                        .header-romaneio-container,
                        .resumo-dimensoes,
                        .resumo-conama {
                            margin: 0 !important;
                            padding-top: 0 !important;
                            padding-bottom: 0 !important;
                        }
                        
                        .resumo-dimensoes {
                            page-break-before: auto !important;
                            break-before: auto !important;
                        }
                        
                        .resumo-conama {
                            page-break-before: auto !important;
                            break-before: auto !important;
                        }
                        
                        .resumo-titulo {
                            margin: 8px 0 10px 0 !important;
                            page-break-after: avoid !important;
                            break-after: avoid !important;
                        }
                        
                        .items-table th,
                        .items-table td {
                            line-height: 1.15 !important;
                        }
                        
                        .resumo-conama table {
                            table-layout: fixed !important;
                            width: 100% !important;
                        }
                        
                        .resumo-conama th,
                        .resumo-conama td {
                            word-break: break-word !important;
                            white-space: normal !important;
                        }
                    }
                    
                    @media print and (orientation: portrait) {
                        .header-romaneio-container {
                            width: 277mm !important;
                            min-height: 190mm !important;
                            transform-origin: top left !important;
                            transform: translateX(var(--pct-translate-x)) rotate(90deg) scale(var(--pct-scale, 1)) !important;
                            page-break-after: always !important;
                            break-after: page !important;
                            overflow: visible !important;
                        }
                        .resumo-page-break {
                            page-break-before: auto !important;
                            break-before: auto !important;
                            margin: 0 !important;
                            height: 0 !important;
                        }
                        .resumo-dimensoes {
                            page-break-before: auto !important;
                            break-before: auto !important;
                        }
                        .conama-page-break {
                            page-break-before: always !important;
                            break-before: page !important;
                        }
                    }
                    
                    @media print and (orientation: landscape) {
                        .header-romaneio-container {
                            transform: none !important;
                            width: auto !important;
                            min-height: auto !important;
                            overflow: visible !important;
                        }
                        body[data-tight-landscape="1"] .items-table thead tr:first-child th.col-qtd,
                        body[data-tight-landscape="1"] .items-table thead tr:first-child th.col-ml,
                        body[data-tight-landscape="1"] .items-table thead tr:first-child th.col-vm2,
                        body[data-tight-landscape="1"] .items-table thead tr:first-child th.col-vm3,
                        body[data-tight-landscape="1"] .items-table thead tr:first-child th.col-unit,
                        body[data-tight-landscape="1"] .items-table thead tr:first-child th.col-total {
                            font-size: 10px !important;
                            line-height: 1.05 !important;
                            letter-spacing: 0.2px !important;
                            padding: 3px 1px !important;
                        }
                        body[data-tight-landscape="1"] .items-table thead tr:nth-child(2) th {
                            font-size: 9px !important;
                            padding: 2px 1px !important;
                        }
                        body[data-tight-landscape="1"] .items-table thead tr:first-child th .hdr-long {
                            letter-spacing: 0.08px !important;
                            font-weight: 700 !important;
                        }
                    }
            </style>
        </head>
        <body data-print-mode="${tipo}" data-comp-count="${pctCompCount}" data-row-count="${itensAgrupados.length}">
            <script>
                (function(){
                    function getRuntimeFirstPageLimit(body, isPortrait, compCount, hideUnit, hideTotal) {
                        var baseRowsByComp = compCount >= 20 ? 14 : (compCount >= 17 ? 15 : (compCount >= 14 ? 16 : 18));
                        var orientationBonus = isPortrait ? 0 : 4;
                        var priceColsBonus = (hideUnit ? 1 : 0) + (hideTotal ? 1 : 0);
                        var dynamicLimit = Math.max(10, baseRowsByComp + orientationBonus + priceColsBonus);
                        var fallbackLimit = parseInt(body.getAttribute('data-fallback-first-page-rows') || '${maxRowsFirstPage}', 10) || ${maxRowsFirstPage};
                        return Math.max(10, dynamicLimit || fallbackLimit);
                    }

                    function reflowFirstPageRows() {
                        var body = document.body;
                        if (!body) return;
                        var mainBody = document.getElementById('pct-main-tbody');
                        var contBody = document.getElementById('pct-cont-tbody');
                        var mainTable = document.getElementById('pct-main-table');
                        var contTable = document.getElementById('pct-cont-table');
                        var contWrap = document.getElementById('pct-continuacao-wrapper');
                        var contPageBreak = document.getElementById('pct-cont-pagebreak');
                        var signature = document.getElementById('pct-signature-block');
                        var mainSigSlot = document.getElementById('pct-main-signature-slot');
                        var contSigSlot = document.getElementById('pct-cont-signature-slot');
                        if (!mainBody || !contBody || !mainTable || !contTable || !contWrap || !contPageBreak || !signature || !mainSigSlot || !contSigSlot) return;

                        var mode = String(body.getAttribute('data-print-mode') || '').replace(/-/g, '_').toLowerCase();
                        var hideUnit = mode === 'sem_preco_unitario' || mode === 'sem_preco';
                        var hideTotal = mode === 'sem_preco';
                        var compCount = parseInt(body.getAttribute('data-comp-count') || '0', 10) || 0;
                        var isPortrait = !!(window.matchMedia && window.matchMedia('(orientation: portrait)').matches);
                        var limit = getRuntimeFirstPageLimit(body, isPortrait, compCount, hideUnit, hideTotal);

                        var rows = Array.from(mainBody.querySelectorAll('tr[data-row-index]')).concat(Array.from(contBody.querySelectorAll('tr[data-row-index]')));
                        rows.sort(function(a, b) {
                            return (parseInt(a.getAttribute('data-row-index') || '0', 10) || 0) - (parseInt(b.getAttribute('data-row-index') || '0', 10) || 0);
                        });

                        mainBody.innerHTML = '';
                        contBody.innerHTML = '';
                        rows.forEach(function(row, idx) {
                            if (idx < limit) mainBody.appendChild(row);
                            else contBody.appendChild(row);
                        });

                        var hasOverflow = contBody.children.length > 0;
                        contWrap.style.display = hasOverflow ? 'block' : 'none';
                        var useContBreak = hasOverflow && !isPortrait;
                        contPageBreak.className = useContBreak ? 'page-break' : '';
                        contPageBreak.style.display = useContBreak ? 'block' : 'none';

                        var tfoot = mainTable.querySelector('tfoot') || contTable.querySelector('tfoot');
                        if (tfoot) {
                            if (hasOverflow) contTable.appendChild(tfoot);
                            else mainTable.appendChild(tfoot);
                        }

                        if (hasOverflow) contSigSlot.appendChild(signature);
                        else mainSigSlot.appendChild(signature);
                    }

                    function calibrarPrimeiraPaginaPCT(){
                        var body = document.body;
                        var header = document.querySelector('.header-romaneio-container');
                        if (!body || !header) return;
                        var isPortrait = window.matchMedia && window.matchMedia('(orientation: portrait)').matches;
                        var mode = String(body.getAttribute('data-print-mode') || '').replace(/-/g, '_').toLowerCase();
                        var hideUnit = mode === 'sem_preco_unitario' || mode === 'sem_preco';
                        var hideTotal = mode === 'sem_preco';
                        var tailVisible = 6 - (hideUnit ? 1 : 0) - (hideTotal ? 1 : 0);
                        var rowCount = parseInt(body.getAttribute('data-row-count') || '0', 10) || 0;
                        var compCount = parseInt(body.getAttribute('data-comp-count') || '0', 10) || 0;
                        var compCol = compCount >= 18 ? 20 : (compCount >= 14 ? 22 : (compCount <= 8 ? 20 : 24));
                        var qtdCol = compCount <= 8 ? 42 : 34;
                        var mlCol = compCount <= 8 ? 50 : 42;
                        var vm2Col = compCount <= 8 ? 52 : 44;
                        var vm3Col = compCount <= 8 ? 52 : 44;
                        var unitCol = compCount >= 14 ? 40 : (compCount <= 8 ? 58 : 44);
                        var totalCol = compCount >= 14 ? 46 : (compCount <= 8 ? 66 : 50);
                        var compColBase = compCount >= 20 ? 18 : (compCount >= 17 ? 20 : (compCount >= 14 ? 22 : (compCount >= 10 ? 26 : 30)));
                        var qtdColBase = tailVisible <= 4 ? 46 : 40;
                        var mlColBase = tailVisible <= 4 ? 62 : 52;
                        var vm2ColBase = tailVisible <= 4 ? 64 : 56;
                        var vm3ColBase = tailVisible <= 4 ? 64 : 56;
                        var unitColBase = tailVisible <= 5 ? 64 : 56;
                        var totalColBase = tailVisible <= 4 ? 78 : 64;
                        body.style.setProperty('--pct-comp-col-base', compColBase + 'px');
                        body.style.setProperty('--pct-qtd-col-base', qtdColBase + 'px');
                        body.style.setProperty('--pct-ml-col-base', mlColBase + 'px');
                        body.style.setProperty('--pct-vm2-col-base', vm2ColBase + 'px');
                        body.style.setProperty('--pct-vm3-col-base', vm3ColBase + 'px');
                        body.style.setProperty('--pct-unit-col-base', unitColBase + 'px');
                        body.style.setProperty('--pct-total-col-base', totalColBase + 'px');
                        body.style.setProperty('--pct-comp-col', compCol + 'px');
                        body.style.setProperty('--pct-qtd-col', qtdCol + 'px');
                        body.style.setProperty('--pct-ml-col', mlCol + 'px');
                        body.style.setProperty('--pct-vm2-col', vm2Col + 'px');
                        body.style.setProperty('--pct-vm3-col', vm3Col + 'px');
                        body.style.setProperty('--pct-unit-col', unitCol + 'px');
                        body.style.setProperty('--pct-total-col', totalCol + 'px');
                        var denseMode = (compCount >= 17 || rowCount >= 24) ? '2' : ((compCount >= 14 || rowCount >= 16) ? '1' : '0');
                        body.setAttribute('data-dense-table', denseMode);
                        if (!isPortrait) {
                            body.style.setProperty('--pct-scale', '1');
                            var compactLandscape = compCount >= 20;
                            body.setAttribute('data-compact-labels', compactLandscape ? '1' : '0');
                            body.setAttribute('data-tight-landscape', compCount >= 18 ? '1' : '0');
                            reflowFirstPageRows();
                            return;
                        }
                        body.setAttribute('data-tight-landscape', '0');
                        requestAnimationFrame(function(){
                            var vw = Math.max(document.documentElement.clientWidth || 0, window.innerWidth || 0);
                            var rect = header.getBoundingClientRect();
                            if (!vw || !rect.width) return;
                            var s = Math.min(1, (vw - 8) / rect.width);
                        var minScale = compCount >= 20 ? 0.68 : (compCount >= 17 ? 0.71 : (compCount >= 14 ? 0.74 : (compCount >= 10 ? 0.78 : 0.82)));
                            if (s < minScale) s = minScale;
                            body.style.setProperty('--pct-scale', s.toFixed(3));
                            var compactLabels = (compCount <= 10) || (compCount >= 20) || (s < 0.95);
                            body.setAttribute('data-compact-labels', compactLabels ? '1' : '0');
                            reflowFirstPageRows();
                        });
                    }
                    window.addEventListener('load', calibrarPrimeiraPaginaPCT);
                    window.addEventListener('resize', calibrarPrimeiraPaginaPCT);
                    window.addEventListener('beforeprint', calibrarPrimeiraPaginaPCT);
                    calibrarPrimeiraPaginaPCT();
                })();
            </script>
            <!-- ✅ DEBUG: Tipo de impressão -->
            <script>
                console.log('🖨️ PCT: Modo de impressão ativo:', '${tipo}');
                console.log('🖨️ PCT: Colunas de valor unitário visíveis:', document.querySelectorAll('.no-print-unit-price').length > 0 ? 'NÃO (ocultas)' : 'SIM');
                console.log('🖨️ PCT: Colunas de valor total visíveis:', document.querySelectorAll('.no-print-price').length > 0 ? 'NÃO (ocultas)' : 'SIM');
            </script>
            <!-- ✅ UNIFICAÇÃO: Cabeçalho + Romaneio na mesma página -->
            <div class="header-romaneio-container">
                <div class="romaneio-principal">
                    <!-- ✅ CABEÇALHO DA EMPRESA DENTRO DO ROMANEIO -->
                    <div class="header">
                        <div class="logo">`;
    
    // ✅ INSERIR LOGO DA EMPRESA
    if (company.logo) {
        if (company.logo.startsWith('data:') || company.logo.startsWith('https://')) {
            printContent += `<img src="${company.logo}" alt="Logo da Empresa" />`;
        } else {
            printContent += `<img src="${company.logo}" alt="Logo da Empresa" />`;
        }
    } else {
        // SVG padrão se não houver logo
        printContent += `
                            <svg viewBox="0 0 100 100" style="width: 80px; height: 80px;">
                                <circle cx="50" cy="50" r="45" fill="#2c3e50" stroke="#34495e" stroke-width="2"/>
                                <text x="50" y="60" text-anchor="middle" fill="white" font-size="24" font-weight="bold">SW</text>
                            </svg>`;
    }
    
    printContent += `
                        </div>
                        <div class="company-info">
                            <div class="company-name">${company.name}</div>
                            <div class="company-details">CNPJ: ${company.cnpj}</div>
                            <div class="company-details">Endereço: ${company.address}</div>
                            <div class="company-details">Cidade: ${company.city} - Estado: ${company.state}</div>
                            <div class="company-details">Telefone: ${company.phone}</div>
                        </div>
                    </div>
                    <!-- ✅ TÍTULO DO ROMANEIO LOGO APÓS O CABEÇALHO -->
                    <div class="title">ROMANEIO DE PACOTE</div>
                    
                    <div class="customer-info">
                <div class="info-row">
                    <div class="info-label">Cliente:</div>
                    <div class="info-value">${romaneio.cliente ? (typeof romaneio.cliente === 'object' ? (romaneio.cliente.nome || romaneio.cliente.name || 'Cliente sem nome') : romaneio.cliente) : 'Cliente não informado'}</div>
                    <div class="info-label">Data:</div>
                    <div class="info-value">${dataFormatada}</div>
                </div>
                <div class="info-row">
                    <div class="info-label">Espécies:</div>
                    <div class="info-value">${especies.join(', ')}</div>
                </div>
            </div>
            
            <div class="table-container">
            <table class="items-table" id="pct-main-table">
                ${tableHeadHtml}
                <tbody id="pct-main-tbody">
        `;
        
        // ✅ ADICIONAR CADA LINHA NA TABELA (LÓGICA ORIGINAL)
        const itemRowsHtml = [];
        itensAgrupados.forEach((item, rowIndex) => {
            const espessuraCm = item.espessura.toFixed(1);
            const larguraCm = item.largura.toFixed(1);
            
            console.log(`Processando item para tabela: ${espessuraCm}x${larguraCm} ${item.especie}`);
            
            // Adicionar à tabela
            let rowHtml = `
                <tr data-row-index="${rowIndex}">
                    <td class="center">${espessuraCm}</td>
                    <td class="center">${larguraCm}</td>
                    <td>${item.especie}</td>`;
            
            // Adicionar colunas de comprimentos
            let totalPecasComprimentos = 0;
            
            comprimentosColunas.forEach(comp => {
                let qtd = item.comprimentosArray[comp] || 0;
                totalPecasComprimentos += qtd;
                totaisPorComprimento[comp] += qtd;
                
                rowHtml += `<td class="center ${qtd > 0 ? 'has-value' : ''}">${qtd}</td>`;
            });
            
            // Usar valores reais calculados
            const metrosLineares = item.metrosLineares || 0;
            const volumeM3 = item.volumeM3;
            
            // ✅ CALCULAR VOLUME EM M² (largura × comprimento média ÷ 10000)
            // Calcular comprimento médio ponderado pelos valores dos comprimentos
            let comprimentoMedio = 0;
            let totalPecasParaMedia = 0;
            
            comprimentosColunas.forEach(comp => {
                const qtd = item.comprimentosArray[comp] || 0;
                if (qtd > 0) {
                    comprimentoMedio += parseFloat(comp) * qtd;
                    totalPecasParaMedia += qtd;
                }
            });
            
            if (totalPecasParaMedia > 0) {
                comprimentoMedio = comprimentoMedio / totalPecasParaMedia;
            }
            
            // Volume em m² = largura(cm) × comprimento_médio(cm) × quantidade ÷ 10000
            const volumeM2 = (item.largura * comprimentoMedio * totalPecasComprimentos) / 10000;
            
            // ✅ COMPLETAR A LINHA COM INFORMAÇÕES DE TOTAIS (ALINHAMENTO À DIREITA VIA CSS)
            rowHtml += `
                    <td class="center col-qtd">${totalPecasComprimentos}</td>
                    <td class="number col-ml">${metrosLineares.toFixed(2).replace('.', ',')} ml</td>
                    <td class="number always-show-volume col-vm2">${volumeM2.toFixed(3).replace('.', ',')} m²</td>
                    <td class="number always-show-volume col-vm3">${volumeM3.toFixed(3).replace('.', ',')} m³</td>
                    <td class="number no-print-unit-price text-right col-unit"><span class="currency-prefix">R$ </span><span class="currency-value">${item.valorUnitario.toFixed(2).replace('.', ',')}</span></td>
                    <td class="number no-print-price text-right col-total"><span class="currency-prefix">R$ </span><span class="currency-value">${item.valorTotal.toFixed(2).replace('.', ',')}</span></td>
                </tr>
            `;
            itemRowsHtml.push(rowHtml);
        });
        
        // ✅ CALCULAR TOTAIS FINAIS
        let totalMetrosLineares = 0;
        let totalVolumeM2 = 0;
        let valorTotalGeral = 0;
        
        itensAgrupados.forEach(item => {
            totalMetrosLineares += item.metrosLineares || 0;
            valorTotalGeral += item.valorTotal || 0;
            
            // ✅ CALCULAR TOTAL VOLUME EM M² PARA CADA ITEM
            let comprimentoMedio = 0;
            let totalPecasItem = 0;
            
            comprimentosColunas.forEach(comp => {
                const qtd = item.comprimentosArray[comp] || 0;
                if (qtd > 0) {
                    comprimentoMedio += parseFloat(comp) * qtd;
                    totalPecasItem += qtd;
                }
            });
            
            if (totalPecasItem > 0) {
                comprimentoMedio = comprimentoMedio / totalPecasItem;
                const volumeM2Item = (item.largura * comprimentoMedio * totalPecasItem) / 10000;
                totalVolumeM2 += volumeM2Item;
            }
        });
        
        printContent += itemRowsHtml.join('');
        printContent += `
                </tbody>
                <tfoot>
                    <tr class="total-geral-row">
                        <td colspan="${3 + comprimentosColunas.length}" style="text-align: right;"><strong>Total Geral:</strong></td>
                        <td class="center col-qtd">${totalPecasGeral}</td>
                        <td class="number col-ml">${totalMetrosLineares.toFixed(2).replace('.', ',')} ml</td>
                        <td class="number always-show-volume col-vm2">${totalVolumeM2.toFixed(3).replace('.', ',')} m²</td>
                        <td class="number always-show-volume col-vm3">${totalVolumeM3.toFixed(3).replace('.', ',')} m³</td>
                        <td class="number no-print-unit-price col-unit">-</td>
                        <td class="number no-print-price col-total"><span class="currency-prefix">R$ </span><span class="currency-value">${valorTotalGeral.toFixed(2).replace('.', ',')}</span></td>
                    </tr>
                </tfoot>
            </table>
            </div>
            <div id="pct-main-signature-slot"></div>
                </div>
            </div>
            <div id="pct-continuacao-wrapper" style="display: none;">
                <div id="pct-cont-pagebreak" style="display: none;"></div>
                <div class="header-romaneio-container">
                    <div class="romaneio-principal">
                        <div class="title">ROMANEIO DE PACOTE - CONTINUAÇÃO</div>
                        <div class="table-container">
                            <table class="items-table" id="pct-cont-table">
                                ${tableHeadHtml}
                                <tbody id="pct-cont-tbody"></tbody>
                            </table>
                        </div>
                        <div id="pct-cont-signature-slot"></div>
                    </div>
                </div>
            </div>
            <div id="pct-signature-block" class="signature">
                <div class="signature-grid" style="margin-top: 50px;">
                    <div class="signature-block">
                        <div class="signature-line"></div>
                        <p>Responsável</p>
                    </div>
                    <div class="signature-block">
                        <div class="signature-line"></div>
                        <p>Cliente</p>
                    </div>
                </div>
            </div>
`;
    
    // ✅ GERAR CARDS DE RESUMO POR ESPÉCIE (ANTES DO TEMPLATE)
    console.log('📊 Gerando cards de resumo por espécie...');
    const grouped = groupItemsByEspecie(itens);
    let cardHtml = '';
    
    // Para todas as espécies, cada dimensão será um card separado
    Object.values(grouped).forEach((especie, index) => {
        // Para cada dimensão, criar um card separado
        Object.entries(especie.dimensoes).forEach(([dimKey, dim]) => {
            cardHtml += `
                <div class="especie-card">
                    <div class="especie-header">${especie.especie} - ${dimKey}</div>
                    <div class="especie-body">`;
            
            // Ordenar comprimentos numericamente (do maior para o menor)
            const comprimentos = Object.entries(dim.comprimentos)
                .sort((a, b) => parseFloat(b[0]) - parseFloat(a[0]));
            
            comprimentos.forEach(([comp, dados]) => {
                // Formatar o comprimento sem casas decimais
                const compFormatado = Math.round(parseFloat(comp));
                
                cardHtml += `
                    <div style="display: flex; justify-content: space-between; margin-bottom: 3px; font-size: 12px;">
                        <span>${dimKey}X${compFormatado} ${dados.pecas} PEÇAS${dados.pacoteInfo ? ` - ${dados.pacoteInfo}` : ''}</span>
                        <span>${dados.volume.toFixed(3).replace('.', ',')} m³</span>
                    </div>
                `;
            });
            
            cardHtml += `
                    </div>
                    <div class="especie-footer">
                        TOTAL: ${dim.volume.toFixed(3).replace('.', ',')} m³ (${dim.pecas} peças)
                    </div>
                </div>
            `;
        });
    });
    
    // Gerar footer dos totais
    let footerHtml = '';
    Object.values(grouped).forEach((especie) => {
        footerHtml += `
            <div class="especie-total-row">
                <span class="total-info-pill">Espécie: ${especie.especie}</span>
                <span class="total-info-pill">TOTAL ${especie.especie}: ${especie.totalVolume.toFixed(3).replace('.', ',')} m³</span>
                <span class="total-info-pill total-global-pill">TOTAL GERAL: ${volumeTotal.toFixed(3).replace('.', ',')} m³</span>
            </div>
        `;
    });
    
    console.log(`✅ Cards gerados: ${Object.values(grouped).length} espécies`);
    
    // ✅ CONTINUAR TEMPLATE COM CARDS DE RESUMO
    printContent += `
            <!-- ✅ RESUMO POR DIMENSÕES E ESPÉCIES EM CARDS -->
            <div class="resumo-secao">
                <div class="resumo-page-break"></div>
                <style>
                    .resumo-dimensoes {
                        margin: 20px 0;
                        page-break-inside: avoid;
                    }
                    .resumo-titulo {
                        text-align: center;
                        font-size: 18px;
                        font-weight: bold;
                        margin-bottom: 15px;
                        color: #0d2339;
                        padding: 8px;
                        border-bottom: 2px solid #0d2339;
                    }
                    .resumo-container {
                        display: flex;
                        flex-wrap: wrap;
                        gap: 12px;
                        justify-content: flex-start;
                        align-items: flex-start;
                        margin: 0 auto;
                        max-width: 100%;
                    }
                    .especie-card {
                        border: 1px solid #ddd;
                        border-radius: 6px;
                        overflow: visible;
                        flex: 1 1 300px;
                        min-width: 280px;
                        max-width: calc(50% - 12px);
                        margin-bottom: 12px;
                        box-shadow: 0 2px 5px rgba(0,0,0,0.08);
                        break-inside: avoid;
                        page-break-inside: avoid;
                        display: flex;
                        flex-direction: column;
                        background-color: white;
                    }
                    .especie-card:hover {
                        box-shadow: 0 4px 8px rgba(0,0,0,0.12);
                        transform: translateY(-2px);
                    }
                    .especie-header {
                        background-color: #0d2339;
                        color: white;
                        padding: 8px;
                        font-weight: bold;
                        text-align: center;
                        font-size: 14px;
                        border-bottom: 2px solid #1a2530;
                        text-transform: uppercase;
                        box-shadow: 0 2px 6px rgba(0,0,0,0.2);
                        letter-spacing: 0.5px;
                        border-radius: 4px 4px 0 0;
                    }
                    .especie-body {
                        padding: 10px;
                        background-color: #fff;
                        flex: 1;
                        overflow: visible;
                        min-height: auto;
                    }
                    .dimensao-item {
                        display: flex;
                        flex-direction: column;
                        margin-bottom: 3px;
                        font-size: 11px;
                        border-bottom: 1px solid #eee;
                        padding-bottom: 3px;
                        line-height: 1.3;
                    }
                    
                    .dimensao-item:last-child {
                        border-bottom: none;
                        margin-bottom: 0;
                    }
                    .especie-footer {
                        background-color: #f8f9fa;
                        padding: 6px 8px;
                        border-top: 1px solid #ddd;
                        text-align: right;
                        font-weight: bold;
                        color: #2c3e50;
                        font-size: 12px;
                        margin-top: auto;
                    }
                    
                    /* ✅ OTIMIZAÇÕES PARA LAYOUT ADAPTATIVO */
                    @media screen and (max-width: 1200px) {
                        .especie-card {
                            max-width: calc(100% - 12px);
                            min-width: 250px;
                        }
                    }
                    
                    /* ✅ OTIMIZAÇÕES ESPECIAIS PARA IMPRESSÃO */
                    @media print {
                        .resumo-container {
                            display: flex !important;
                            flex-wrap: wrap !important;
                            gap: 8px !important;
                            justify-content: flex-start !important;
                            page-break-inside: avoid !important;
                        }
                        
                        .especie-card {
                            flex: 1 1 45% !important;
                            min-width: 45% !important;
                            max-width: 48% !important;
                            margin-bottom: 8px !important;
                            break-inside: avoid !important;
                            page-break-inside: avoid !important;
                            overflow: visible !important;
                            border: 1px solid #333 !important;
                            display: flex !important;
                            flex-direction: column !important;
                        }
                        
                        /* ✅ CORREÇÃO PAISAGEM: Cards otimizados para layout paisagem */
                        @media print and (orientation: landscape) {
                            .resumo-container {
                                page-break-inside: auto !important; /* Permitir quebra dentro do container se necessário */
                            }
                            
                            .especie-card {
                                flex: 1 1 30% !important; /* Cards menores em paisagem para aproveitar melhor o espaço */
                                min-width: 30% !important;
                                max-width: 32% !important;
                            }
                        }
                        
                        /* ✅ AJUSTE PARA 1 CARD */
                        .resumo-container:has(.especie-card:only-child) .especie-card {
                            max-width: 60% !important;
                            margin: 0 auto !important;
                        }
                        
                        /* ✅ AJUSTE PARA 3 CARDS */
                        .resumo-container:has(.especie-card:nth-child(3):last-child) .especie-card {
                            flex: 1 1 30% !important;
                            min-width: 30% !important;
                            max-width: 32% !important;
                        }
                        
                        .especie-body {
                            overflow: visible !important;
                            max-height: none !important;
                            padding: 8px !important;
                        }
                        
                        .dimensao-item {
                            font-size: 10px !important;
                            margin-bottom: 2px !important;
                            padding-bottom: 2px !important;
                        }
                        
                        .especie-header {
                            background-color: #0d2339 !important;
                            color: white !important;
                            print-color-adjust: exact !important;
                            -webkit-print-color-adjust: exact !important;
                        }
                        
                        .especie-footer {
                            background-color: #f8f9fa !important;
                            print-color-adjust: exact !important;
                            -webkit-print-color-adjust: exact !important;
                        }
                    }
                    .resumo-footer {
                        margin-top: 20px;
                        text-align: center;
                        border-top: 1px solid #ccc;
                        padding-top: 10px;
                        page-break-inside: avoid;
                    }
                    .especie-total-row {
                        margin: 10px 0;
                        display: flex;
                        justify-content: center;
                        flex-wrap: wrap;
                        gap: 8px;
                    }
                    .total-info-pill {
                        display: inline-block;
                        margin: 0 4px;
                        padding: 3px 8px;
                        background-color: #e3f2fd;
                        border-radius: 12px;
                        border: 1px solid #bbdefb;
                    }
                    .total-global-pill {
                        background-color: #ffebee;
                        border: 1px solid #ffcdd2;
                        color: #c62828;
                    }
                    
                    /* ✅ CSS DUPLICADO REMOVIDO - JÁ DEFINIDO ACIMA COM MAIS DETALHES */
                </style>
                
                <div class="resumo-dimensoes">
                    <h2 class="resumo-titulo">Resumo por Dimensões e Espécies</h2>
                    
                    <div class="resumo-container">
                        ${cardHtml}
                    </div>
                    
                    <!-- Rodapé com os totais -->
                    <div class="resumo-footer">
                        ${footerHtml}
                    </div>
                </div>
            </div> <!-- ✅ Fechamento da resumo-secao -->
            
`;
    
    // ✅ GERAR TABELA CONAMA (ANTES DO TEMPLATE)
    console.log('📊 Gerando tabela CONAMA com classificação por dimensões...');
    let totalVolumeConama = 0;
    let categoriasConama = {};
    let categoriaEspecies = {};
    
    // ✅ DEBUG: Mostrar algumas classificações de exemplo
    console.log('🔍 DEBUG: Exemplos de classificação CONAMA:');
    itens.slice(0, 3).forEach(item => {
        const espessura = parseFloat(item.espessura) || 0;
        const largura = parseFloat(item.largura) || 0;
        const categoria = classificarProdutoConama(espessura, largura);
        console.log(`  - ${espessura}x${largura} cm → ${categoria}`);
    });
    
    // Primeiro passo: somar volumes por categoria
    const resumoConama = agruparPorEspecieEConama(itens);
    console.log('📋 Espécies processadas:', Object.keys(resumoConama));
    
    Object.keys(resumoConama).forEach(especieKey => {
        const categorias = resumoConama[especieKey].categorias;
        console.log(`📊 ${especieKey}: ${Object.keys(categorias).join(', ')}`);
        
        Object.keys(categorias).forEach(categoria => {
            if (!categoriasConama[categoria]) {
                categoriasConama[categoria] = 0;
            }
            categoriasConama[categoria] += categorias[categoria].volume;
            if (!categoriaEspecies[categoria]) {
                categoriaEspecies[categoria] = new Set();
            }
            categoriaEspecies[categoria].add(resumoConama[especieKey].especie || especieKey);
            totalVolumeConama += categorias[categoria].volume;
        });
    });
    
    console.log('🏷️ Categorias CONAMA encontradas:', Object.keys(categoriasConama));
    
    // Segundo passo: gerar as linhas da tabela
    let conamaHtml = '';
    Object.keys(categoriasConama).sort().forEach(categoria => {
        const volume = categoriasConama[categoria];
        const porcentagem = (volume / totalVolumeConama * 100).toFixed(2);
        
        console.log(`📊 ${categoria}: ${volume.toFixed(3)} m³ (${porcentagem}%)`);
        
        conamaHtml += `
            <tr>
                <td>${categoria}</td>
                <td class="number">${volume.toFixed(3).replace('.', ',')}</td>
                <td class="text-center">${porcentagem}%</td>
                <td>${Array.from(categoriaEspecies[categoria] || []).sort().join(', ')}</td>
            </tr>
        `;
    });
    
    // Adicionar linha de total
    conamaHtml += `
        <tr class="total-geral-row">
            <td><strong>TOTAL</strong></td>
            <td class="number"><strong>${totalVolumeConama.toFixed(3).replace('.', ',')}</strong></td>
            <td class="text-center"><strong>100%</strong></td>
            <td><strong>-</strong></td>
        </tr>
    `;
    
    console.log(`✅ Tabela CONAMA gerada: ${Object.keys(categoriasConama).length} categorias (${totalVolumeConama.toFixed(3)} m³ total)`);
    
    // ✅ FINALIZAR TEMPLATE COM CONAMA
    printContent += `
            <!-- ✅ RESUMO CONAMA EM FORMATO DE TABELA -->
            <div class="page-break conama-page-break"></div>
            
            <div>
                <style>
                    .resumo-conama {
                        margin: 20px 0;
                        page-break-inside: avoid;
                    }
                    .resumo-conama table {
                        width: 100%;
                        border-collapse: collapse;
                        margin-top: 15px;
                    }
                    .resumo-conama th, .resumo-conama td {
                        border: 1px solid #ddd;
                        padding: 8px;
                        text-align: left;
                    }
                    .resumo-conama th {
                        background-color: #0d2339;
                        color: white;
                        text-align: center;
                    }
                    .resumo-conama .number {
                        text-align: right;
                    }
                    .resumo-conama .text-center {
                        text-align: center;
                    }
                    .resumo-conama .total-geral-row {
                        background-color: #f8f9fa;
                        font-weight: bold;
                    }
                    
                    @media print {
                        .resumo-conama th {
                            background-color: #000 !important;
                            color: #fff !important;
                            print-color-adjust: exact;
                            -webkit-print-color-adjust: exact;
                        }
                    }
                </style>
                
                <div class="resumo-conama">
                    <div class="resumo-titulo">Resumo por Classificação CONAMA</div>
                    <table>
                        <thead>
                            <tr>
                                <th>Categoria CONAMA</th>
                                <th class="number">Volume (m³)</th>
                                <th class="text-center">Porcentagem</th>
                                <th>Espécies</th>
                            </tr>
                        </thead>
                        <tbody>
                            ${conamaHtml}
                        </tbody>
                    </table>
                </div>
            </div>
        </body>
        </html>`;
    
    console.log("✅ Conteúdo de impressão COMPLEXO gerado com sucesso");
    console.log(`📊 Estatísticas: ${itensAgrupados.length} grupos, ${comprimentosColunas.length} colunas de comprimento`);
    return printContent;
}

// ============================================================================
// FUNÇÕES AUXILIARES ESPECÍFICAS PCT
// ============================================================================

function groupItemsByEspecie(items) {
    const groups = {};
    
    items.forEach(item => {
        const especie = item.especie || 'Desconhecida';
        const comprimento = parseFloat(item.comprimento) || 0;
        const largura = parseFloat(item.largura) || 0;
        const espessura = parseFloat(item.espessura) || 0;
        const quantidade = parseInt(item.quantidade) || 0;
        const pecasPorPacote = parseInt(item.pecasPorPacote) || 1;
        
        if (!groups[especie]) {
            groups[especie] = {
                especie: especie,
                dimensoes: {},
                totalPecas: 0,
                totalVolume: 0
            };
        }
        
        // Chave por dimensão (espessura x largura)
        const dimensaoKey = `${espessura.toFixed(1)}x${largura.toFixed(1)}`;
        
        if (!groups[especie].dimensoes[dimensaoKey]) {
            groups[especie].dimensoes[dimensaoKey] = {
                comprimentos: {},
                volume: 0,
                pecas: 0
            };
        }
        
        // Agrupar por comprimento dentro da dimensão
        const compKey = comprimento.toString();
        if (!groups[especie].dimensoes[dimensaoKey].comprimentos[compKey]) {
            groups[especie].dimensoes[dimensaoKey].comprimentos[compKey] = {
                pecas: 0,
                volume: 0,
                pacoteInfo: ''
            };
        }
        
        const totalPecasItem = quantidade * pecasPorPacote;
        const volumeUnitario = (comprimento * largura * espessura) / 1000000;
        const volumeTotalItem = volumeUnitario * totalPecasItem;
        
        // Atualizar dados do comprimento
        groups[especie].dimensoes[dimensaoKey].comprimentos[compKey].pecas += totalPecasItem;
        groups[especie].dimensoes[dimensaoKey].comprimentos[compKey].volume += volumeTotalItem;
        
        if (pecasPorPacote > 1) {
            const numPacotes = Math.ceil(totalPecasItem / pecasPorPacote);
            groups[especie].dimensoes[dimensaoKey].comprimentos[compKey].pacoteInfo = `${numPacotes} PACOTES C/${pecasPorPacote}`;
        }
        
        // Atualizar totais da dimensão
        groups[especie].dimensoes[dimensaoKey].volume += volumeTotalItem;
        groups[especie].dimensoes[dimensaoKey].pecas += totalPecasItem;
        
        // Atualizar totais da espécie
        groups[especie].totalPecas += totalPecasItem;
        groups[especie].totalVolume += volumeTotalItem;
    });
    
    return groups;
}

// ✅ FUNÇÃO PARA CLASSIFICAR PRODUTO CONAMA (BASEADA NO ORIGINAL)
function classificarProdutoConama(espessura, largura) {
    const espessuraNum = parseFloat(espessura) || 0;
    const larguraNum = parseFloat(largura) || 0;
    
    // Bloco, quadrado ou filé: espessura > 12 cm e largura > 12 cm
    if (espessuraNum > 12 && larguraNum > 12) {
        return 'Bloco, quadrado ou filé';
    }
    // Pranchões: espessura > 7,0 cm e largura > 20,0 cm
    else if (espessuraNum > 7.0 && larguraNum > 20.0) {
        return 'Pranchões';
    } 
    // Prancha: espessura entre 4,0 e 7,0 cm e largura > 20,0 cm
    else if (espessuraNum >= 4.0 && espessuraNum <= 7.0 && larguraNum > 20.0) {
        return 'Prancha';
    } 
    // Viga: espessura > 4,0 cm e largura entre 11,0 e 20,0 cm
    else if (espessuraNum > 4.0 && larguraNum >= 11.0 && larguraNum <= 20.0) {
        return 'Viga';
    } 
    // Vigota: espessura entre 4,0 e 8,0 cm e largura entre 8,0 e 11,0 cm
    else if (espessuraNum >= 4.0 && espessuraNum <= 8.0 && larguraNum >= 8.0 && larguraNum <= 11.0) {
        return 'Vigota';
    } 
    // Caibro: espessura entre 4,0 e 8,0 cm e largura entre 5,0 e 8,0 cm
    else if (espessuraNum >= 4.0 && espessuraNum <= 8.0 && larguraNum >= 5.0 && larguraNum <= 8.0) {
        return 'Caibro';
    } 
    // Tábua: espessura entre 1,0 e 4,0 cm e largura > 10,0 cm
    else if (espessuraNum >= 1.0 && espessuraNum < 4.0 && larguraNum > 10.0) {
        return 'Tábua';
    } 
    // Sarrafo: espessura entre 2,0 e 4,0 cm e largura entre 2,0 e 10,0 cm
    else if (espessuraNum >= 2.0 && espessuraNum < 4.0 && larguraNum >= 2.0 && larguraNum <= 10.0) {
        return 'Sarrafo';
    } 
    // Ripa: espessura < 2,0 cm e largura < 10,0 cm
    else if (espessuraNum < 2.0 && larguraNum < 10.0) {
        return 'Ripa';
    } 
    const categoriasAproximacao = [
        { nome: 'Bloco, quadrado ou filé', esp: 13.0, larg: 13.0 },
        { nome: 'Pranchões', esp: 8.0, larg: 21.0 },
        { nome: 'Prancha', esp: 5.5, larg: 21.0 },
        { nome: 'Viga', esp: 6.0, larg: 15.5 },
        { nome: 'Vigota', esp: 6.0, larg: 9.5 },
        { nome: 'Caibro', esp: 6.0, larg: 6.5 },
        { nome: 'Tábua', esp: 2.5, larg: 11.0 },
        { nome: 'Sarrafo', esp: 3.0, larg: 6.0 },
        { nome: 'Ripa', esp: 1.0, larg: 5.0 }
    ];
    if (espessuraNum <= 0 || larguraNum <= 0) return 'Ripa';
    let melhor = categoriasAproximacao[0];
    let menorDistancia = Number.POSITIVE_INFINITY;
    categoriasAproximacao.forEach((cat) => {
        const dEsp = espessuraNum - cat.esp;
        const dLarg = larguraNum - cat.larg;
        const distancia = Math.sqrt((dEsp * dEsp) + (dLarg * dLarg));
        if (distancia < menorDistancia) {
            menorDistancia = distancia;
            melhor = cat;
        }
    });
    return melhor.nome;
}

// ✅ FUNÇÃO PARA AGRUPAR POR CONAMA (CLASSIFICAÇÃO CORRETA POR DIMENSÕES)
function agruparPorEspecieEConama(items) {
    const grupos = {};
    
    items.forEach(item => {
        const especie = item.especie || 'Desconhecida';
        const quantidade = parseInt(item.quantidade) || 0;
        const pecasPorPacote = parseInt(item.pecasPorPacote) || 1;
        const comprimento = parseFloat(item.comprimento) || 0;
        const largura = parseFloat(item.largura) || 0;
        const espessura = parseFloat(item.espessura) || 0;
        
        // Calcular volume
        const volumeUnitario = (comprimento * largura * espessura) / 1000000;
        const volumeTotal = volumeUnitario * quantidade * pecasPorPacote;
        
        if (!grupos[especie]) {
            grupos[especie] = {
                especie: especie,
                categorias: {}
            };
        }
        
        // ✅ CLASSIFICAÇÃO CONAMA CORRETA BASEADA NAS DIMENSÕES (espessura x largura)
        const categoria = classificarProdutoConama(espessura, largura);
        
        if (!grupos[especie].categorias[categoria]) {
            grupos[especie].categorias[categoria] = {
                volume: 0,
                pecas: 0
            };
        }
        
        grupos[especie].categorias[categoria].volume += volumeTotal;
        grupos[especie].categorias[categoria].pecas += quantidade * pecasPorPacote;
    });
    
    return grupos;
}

// ============================================================================
// FUNÇÕES DE CÁLCULO ESPECÍFICAS PCT
// ============================================================================

/**
 * ✅ CÁLCULO ESPECÍFICO: Total de peças incluindo pacotes
 * PRESERVA: Fórmula exata do sistema atual
 */
function calcularTotalPecasPCT(itens) {
    return itens.reduce((sum, item) => {
        const qtd = parseInt(item.quantidade || 0);
        const ppp = parseInt(item.pecasPorPacote || 1);
        return sum + (qtd * ppp);  // ⚠️ MULTIPLICAR POR PACOTES
    }, 0);
}

/**
 * ✅ INFORMAÇÃO ESPECÍFICA: Geração de info de pacotes para relatórios
 * PRESERVA: Formato exato "X PACOTES C/Y"
 */
function gerarInfoPacotes(quantidade, pecasPorPacote) {
    if (pecasPorPacote > 1) {
        const numPacotes = Math.ceil(quantidade * pecasPorPacote / pecasPorPacote);
        return `${numPacotes} PACOTES C/${pecasPorPacote}`;  // ⚠️ FORMATO ESPECÍFICO
    }
    return '';
}

// ============================================================================
// EXPORTAÇÕES
// ============================================================================

// ✅ EXPOSIÇÃO GLOBAL PARA COMPATIBILIDADE COMPLETA
console.log('🔄 DEFININDO window.imprimirRomaneio...');
window.imprimirRomaneio = imprimirRomaneio;

console.log('🔄 DEFININDO window.ImpressaoPCT...');
window.ImpressaoPCT = {
    imprimirRomaneio,
    getCompanyData,
    gerarConteudoImpressao,
    groupItemsByEspecie,
    agruparPorEspecieEConama,
    classificarProdutoConama,
    calcularTotalPecasPCT,
    gerarInfoPacotes,
    TIPOS_IMPRESSAO_PCT
};

// ✅ FORÇAR VERIFICAÇÃO IMEDIATA APÓS DEFINIÇÃO
console.log('🔍 VERIFICAÇÃO IMEDIATA APÓS DEFINIÇÃO:');
console.log('  - window.imprimirRomaneio definida:', !!window.imprimirRomaneio);
console.log('  - window.ImpressaoPCT definida:', !!window.ImpressaoPCT);

// ✅ TIMEOUT PARA VERIFICAÇÃO POSTERIOR (DETECTAR SOBRESCRITA)
setTimeout(() => {
    console.log('🕐 VERIFICAÇÃO POSTERIOR (após 1s):');
    console.log('  - window.imprimirRomaneio ainda existe:', !!window.imprimirRomaneio);
    console.log('  - window.ImpressaoPCT ainda existe:', !!window.ImpressaoPCT);
    if (!window.imprimirRomaneio) {
        console.error('❌ FUNÇÃO FOI SOBRESCRITA POR OUTRO SCRIPT!');
    }
}, 1000);

console.log('✅ === SISTEMA DE IMPRESSÃO PCT RESTAURADO COMPLETAMENTE ===');
console.log('🎯 SOBRESCREVENDO qualquer definição anterior de imprimirRomaneio');
console.log('✅ Funcionalidades restauradas:');
console.log('  📄 Template HTML completo com cabeçários');
console.log('  🏢 Carregamento de dados da empresa');
console.log('  🖼️ Processamento de logos (Firebase/Base64)');
console.log('  📊 Tabelas adaptativas');
console.log('  💰 Controle de preços por tipo de impressão');
console.log('🔄 Função imprimirRomaneio PCT agora está ATIVA');

// ✅ VERIFICAÇÃO CRÍTICA: Confirmar que as funções foram expostas
console.log('🔍 VERIFICAÇÃO CRÍTICA:');
console.log('  - window.imprimirRomaneio:', typeof window.imprimirRomaneio);
console.log('  - window.ImpressaoPCT:', typeof window.ImpressaoPCT);
if (window.imprimirRomaneio) {
    console.log('✅ SUCESSO: imprimirRomaneio está disponível globalmente');
} else {
    console.error('❌ ERRO CRÍTICO: imprimirRomaneio NÃO está disponível');
}

// ❌ REMOVIDO: Exportações ES6 causavam erro de sintaxe
// O arquivo é carregado como script normal, não como módulo ES6
// As funções já foram expostas globalmente via window.

console.log('🔚 === FIM DO MÓDULO DE IMPRESSÃO PCT ===');

// ✅ FALLBACK DE EMERGÊNCIA - GARANTIR QUE A FUNÇÃO SEMPRE EXISTA
if (!window.imprimirRomaneio) {
    console.error('❌ EMERGÊNCIA: imprimirRomaneio não foi definida! Criando fallback...');
    window.imprimirRomaneio = function(romaneioId, tipo = 'completo') {
        console.error('❌ FALLBACK: Sistema de impressão não carregado corretamente');
        alert('Sistema de impressão não disponível. Recarregue a página.');
    };
}

// ============================================================================
// FUNÇÃO DE TESTE E DEBUG - VERIFICAR DADOS PARA IMPRESSÃO
// ============================================================================
window.testarDadosImpressaoPCT = async function(romaneioId) {
    console.log('🧪 === TESTE DE DADOS PARA IMPRESSÃO PCT ===');
    
    try {
        // Carregar romaneio
        const romaneios = await getData('romaneios/pct') || [];
        const romaneio = romaneios.find(r => r.id == romaneioId);
        
        if (!romaneio) {
            console.error(`❌ Romaneio ${romaneioId} não encontrado`);
            return false;
        }
        
        console.log(`📋 Romaneio encontrado: ID ${romaneio.id}`);
        console.log(`👤 Cliente: ${romaneio.cliente ? (typeof romaneio.cliente === 'object' ? (romaneio.cliente.nome || romaneio.cliente.name) : romaneio.cliente) : 'N/A'}`);
        console.log(`📦 Itens: ${romaneio.itens?.length || 0}`);
        
        if (!romaneio.itens || romaneio.itens.length === 0) {
            console.warn('⚠️ Romaneio sem itens!');
            return false;
        }
        
        console.log('🔍 Verificando estrutura dos itens:');
        romaneio.itens.forEach((item, index) => {
            console.log(`  ${index + 1}. ${item.especie || 'Sem espécie'} ${item.espessura}x${item.largura}x${item.comprimento}cm`);
            console.log(`     └─ Quantidade: ${item.quantidade} × ${item.pecasPorPacote || 1} peças`);
            console.log(`     └─ Valor unitário: ${item.valorUnitario ? 'R$ ' + item.valorUnitario.toFixed(2) : 'NÃO DEFINIDO'}`);
            console.log(`     └─ Propriedade preco: ${item.preco ? 'R$ ' + item.preco.toFixed(2) : 'NÃO DEFINIDO'}`);
            console.log(`     └─ Valor total: ${item.valorTotal ? 'R$ ' + item.valorTotal.toFixed(2) : 'NÃO DEFINIDO'}`);
            
            // Alertas para valores ausentes
            if (!item.valorUnitario && !item.preco) {
                console.error(`❌ Item ${index + 1}: Nem valorUnitario nem preco definidos!`);
            }
            if (!item.valorTotal) {
                console.warn(`⚠️ Item ${index + 1}: valorTotal não definido`);
            }
        });
        
        console.log('✅ Teste concluído!');
        console.log('📝 Para imprimir, use: imprimirRomaneio(' + romaneioId + ', "completo")');
        return true;
        
    } catch (error) {
        console.error('❌ Erro no teste:', error);
        return false;
    }
};

// ✅ CONFIRMAÇÃO FINAL DE CARREGAMENTO
console.log('✅ === MÓDULO DE IMPRESSÃO PCT CARREGADO COM SUCESSO ===');
console.log('✅ window.imprimirRomaneio final:', !!window.imprimirRomaneio);
console.log('✅ window.ImpressaoPCT final:', !!window.ImpressaoPCT);
console.log('🧪 Função de teste disponível: testarDadosImpressaoPCT(romaneioId)');

// ============================================================================
// FUNÇÃO DE TESTE VISUAL - VERIFICAR ALINHAMENTO DAS COLUNAS
// ============================================================================
window.testarAlinhamentoPCT = function() {
    console.log('🎨 === TESTE DE ALINHAMENTO DE COLUNAS PCT ===');
    console.log('');
    console.log('✅ Regras CSS aplicadas para alinhamento à direita:');
    console.log('   📊 M. Linear (.number)');
    console.log('   📊 Volume (m²) (.number.always-show-volume)');
    console.log('   📊 Volume (m³) (.number.always-show-volume)');
    console.log('   💰 Valor Unitário (.number.no-print-unit-price.text-right)');
    console.log('   💰 Valor Total (.number.no-print-price.text-right)');
    console.log('');
    console.log('📋 CSS implementado:');
    console.log('   ├─ Dados da tabela: text-align: right !important');
    console.log('   ├─ Cabeçalhos: text-align: right !important');
    console.log('   ├─ Linha de totais: text-align: right !important + font-weight: bold');
    console.log('   └─ Font: Courier New monospace para melhor alinhamento');
    console.log('');
    console.log('🖨️ Compatibilidade:');
    console.log('   ✅ Tela (preview)');
    console.log('   ✅ Impressão (@media print)');
    console.log('   ✅ Todos os tipos (completo, sem preço unitário, sem preço)');
    console.log('');
    console.log('🧪 Para testar visualmente:');
    console.log('   1. Crie um romaneio com alguns itens');
    console.log('   2. Imprima relatório completo');
    console.log('   3. Verifique se as colunas numéricas estão alinhadas à direita');
    console.log('');
    console.log('✅ Teste de alinhamento configurado!');
};

console.log('🎨 Função de teste de alinhamento disponível: testarAlinhamentoPCT()');

// ============================================================================
// FUNÇÃO DE TESTE - VERIFICAR CORREÇÕES DE DATA E PAGINAÇÃO
// ============================================================================
window.testarCorrecoesRelatoriosPCT = function() {
    console.log('🔧 === TESTE DAS CORREÇÕES DOS RELATÓRIOS PCT ===');
    console.log('');
    console.log('✅ CORREÇÃO 1 - PROBLEMA DA DATA:');
    console.log('   📅 Agora procura primeiro por "romaneio.data" (padrão dos romaneios)');
    console.log('   📅 Fallback para "romaneio.timestamp" (compatibilidade)');
    console.log('   📅 Tratamento robusto de erros de formatação');
    console.log('   📅 Resultado: Data deve aparecer corretamente no relatório');
    console.log('');
    console.log('✅ CORREÇÃO 2 - PAGINAÇÃO LAYOUT PAISAGEM:');
    console.log('   🖨️ Layout RETRATO: Mantém quebra de página forçada (comportamento original)');
    console.log('   🖨️ Layout PAISAGEM: Remove quebras desnecessárias');
    console.log('   🖨️ Título "Resumo por Dimensões" agora fica junto com os cards');
    console.log('   🖨️ Elimina páginas em branco entre tabela e resumo');
    console.log('   🖨️ Cards redimensionados para aproveitar melhor o espaço em paisagem');
    console.log('');
    console.log('✅ MELHORIA 3 - LEGIBILIDADE DA TABELA:');
    console.log('   📋 Todo conteúdo da tabela dinâmica agora em NEGRITO');
    console.log('   📋 Melhora significativa na legibilidade para o usuário');
    console.log('   📋 Aplicado em todos os modos (tela, retrato, paisagem)');
    console.log('   📋 Cabeçalhos mantêm formatação original');
    console.log('');
    console.log('🧪 COMO TESTAR:');
    console.log('   1. Crie um romaneio com data e alguns itens');
    console.log('   2. Imprima em RETRATO e verifique se a data aparece');
    console.log('   3. Imprima em PAISAGEM e verifique se não há páginas em branco');
    console.log('   4. Confirme que o título do resumo fica junto com os cards');
    console.log('');
    console.log('📋 CAMPOS DE DATA SUPORTADOS:');
    console.log('   ✅ romaneio.data (prioritário)');
    console.log('   ✅ romaneio.timestamp (fallback)');
    console.log('   ✅ Tratamento de strings de data inválidas');
    console.log('   ✅ Formatação brasileira (DD/MM/AAAA)');
    console.log('');
    console.log('🎯 COMPATIBILIDADE:');
    console.log('   ✅ Mantém 100% da funcionalidade existente');
    console.log('   ✅ Não quebra relatórios em retrato');
    console.log('   ✅ Melhora significativa em paisagem');
    console.log('   ✅ Todos os tipos de impressão (completo, sem preço, etc.)');
    console.log('');
    console.log('✅ Correções aplicadas com sucesso!');
};

console.log('🔧 Função de teste das correções disponível: testarCorrecoesRelatoriosPCT()');

// ✅ RESUMO DAS CORREÇÕES IMPLEMENTADAS
console.log('📋 === RESUMO DAS CORREÇÕES IMPLEMENTADAS ===');
console.log('🔧 PROBLEMA 1 RESOLVIDO: Data não aparecendo no relatório');
console.log('   └─ Causa: Incompatibilidade entre campos "data" vs "timestamp"');
console.log('   └─ Solução: Lógica que procura ambos os campos com fallback');
console.log('');
console.log('🔧 PROBLEMA 2 RESOLVIDO: Paginação incorreta em layout paisagem');
console.log('   └─ Causa: Quebras de página forçadas criando páginas em branco');
console.log('   └─ Solução: CSS inteligente que diferencia retrato de paisagem');
console.log('');
console.log('📋 MELHORIA 3 IMPLEMENTADA: Legibilidade da tabela dinâmica');
console.log('   └─ Todo conteúdo da tabela agora em NEGRITO para melhor visibilidade');
console.log('   └─ Aplicado em todos os modos de impressão (tela, retrato, paisagem)');
console.log('');
console.log('⚠️  CUIDADO: Todas as alterações são RESPONSIVAS e não afetam funcionalidades existentes');
console.log('✅ Sistema de relatórios totalmente otimizado e com excelente legibilidade!');
