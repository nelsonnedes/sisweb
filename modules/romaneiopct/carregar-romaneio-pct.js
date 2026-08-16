/**
 * ✅ MÓDULO: CARREGAR ROMANEIO PCT - RESTAURADO DOS BACKUPS
 * 📅 Criado em: 2025-08-02
 * 🎯 Objetivo: Restaurar funcionalidade de carregamento/edição de romaneios PCT
 * 
 * ⚠️ ORIGEM: Função extraída do romaneiopct_backup/romaneiopct_modais.js
 * ✅ ADAPTADO: Para estrutura modular e sem duplicações
 */

(function() {
    'use strict';

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

    // ✅ Limite máximo de payload para localStorage (1.5MB por chave)
    const LS_MAX_BYTES = 1.5 * 1024 * 1024;
    const LS_MAX_ROMANEIOS_CACHE = 50;

    function clearOldLocalStorageCache() {
        try {
            const SAFE_PREFIXES = ['currentUser', 'persistentUser', 'company_info', 'firebaseConfig', '__', 'sisweb_alerts'];
            const CACHE_PREFIXES = ['companies/', 'romaneiosPct_backup', 'romaneiosTs'];
            const toRemove = [];
            for (let i = 0; i < localStorage.length; i++) {
                const k = localStorage.key(i);
                if (!k) continue;
                if (SAFE_PREFIXES.some(p => k.startsWith(p) || k === p)) continue;
                if (CACHE_PREFIXES.some(p => k.includes(p))) toRemove.push(k);
            }
            toRemove.forEach(k => { try { localStorage.removeItem(k); } catch (_) {} });
            if (toRemove.length > 0) console.warn(`⚠️ PCT: ${toRemove.length} chave(s) de cache removida(s) do storage.`);
        } catch (_) {}
    }

    function writeLocalStorageValue(key, data) {
        const payload = typeof data === 'string' ? data : JSON.stringify(data);
        // Verificar tamanho antes de gravar
        const byteSize = new Blob([payload]).size;
        if (byteSize > LS_MAX_BYTES) {
            console.warn(`⚠️ PCT (carregar): Payload '${key}' muito grande (${(byteSize/1024).toFixed(0)}KB). Não gravado.`);
            return;
        }
        for (const k of getLocalStorageKeys(key)) {
            try {
                localStorage.setItem(k, payload);
            } catch (err) {
                if (err && (err.name === 'QuotaExceededError' || err.code === 22 || (err.message && err.message.toLowerCase().includes('quota')))) {
                    console.warn(`⚠️ PCT (carregar): QuotaExceededError em '${k}'. Limpando cache e tentando novamente...`);
                    clearOldLocalStorageCache();
                    try { localStorage.setItem(k, payload); }
                    catch (err2) { console.warn(`⚠️ PCT (carregar): Storage cheio definitivamente para '${k}'. Operando via Firebase.`); }
                } else {
                    console.warn(`⚠️ PCT (carregar): Erro ao gravar '${k}':`, err && err.message ? err.message : err);
                }
            }
        }
    }

    function parseRomaneioDateCandidate(value) {
        if (!value) return 0;
        if (typeof value === 'number' && isFinite(value)) return value;
        if (value instanceof Date) {
            const t = value.getTime();
            return isNaN(t) ? 0 : t;
        }
        const t = Date.parse(value);
        return isNaN(t) ? 0 : t;
    }

    function parseRomaneioRecencyTime(r) {
        if (!r || typeof r !== 'object') return 0;
        const candidates = [
            r && r._metadata && r._metadata.lastUpdated,
            r.updatedAt,
            r.updated,
            r.lastModified,
            r.dataEmissao,
            r.data,
            r.dataHora,
            r.dataCriacao,
            r.createdAt,
            r.created,
            r.timestamp
        ];
        for (const candidate of candidates) {
            const ts = parseRomaneioDateCandidate(candidate);
            if (ts) return ts;
        }
        const id = String(r.id || r.romaneioId || r.firebaseKey || r.key || r.numero || r.numeroRomaneio || '');
        const match = id.match(/(\d{10,})/);
        return match ? Number(match[1]) || 0 : 0;
    }


    function filterByActiveTenant(list) {
        const tenant = resolveCompanyId();
        if (!tenant) return [];
        return (Array.isArray(list) ? list : []).filter(item => {
            if (!item || typeof item !== 'object') return false;
            const itemTenant = item.companyId || item.tenantId || item.companyID || null;
            if (!itemTenant) return false;
            return String(itemTenant) === String(tenant);
        });
    }

    // ✅ Persistência segura do localStorage para evitar perda acidental
    function safePersistRomaneiosPct(lista, contexto = 'carregarRomaneio') {
        try {
            const tenant = resolveCompanyId();
            if (!tenant) {
                console.warn(`🛑 PCT: Persistência local bloqueada sem tenant (contexto: ${contexto}).`);
                return false;
            }
            const isArray = Array.isArray(lista);
            const nextCount = isArray ? lista.length : (lista && typeof lista === 'object' ? Object.keys(lista).length : 0);

            if (nextCount === 0) {
                try {
                    const prevRaw = readLocalStorageValue('romaneios/pct');
                    if (prevRaw) {
                        const prevList = JSON.parse(prevRaw);
                        const prevCount = Array.isArray(prevList) ? prevList.length : 0;
                        if (prevCount > 0) {
                            console.warn(`🛑 PCT: Evitando sobrescrever com lista vazia (contexto: ${contexto}). Mantendo ${prevCount} itens.`);
                            return false;
                        }
                    }
                } catch (_) {}
            }

            // Limitar ao máximo de itens em cache (os mais recentes)
            let listaParaSalvar = isArray ? lista : Object.values(lista || {});
            if (listaParaSalvar.length > LS_MAX_ROMANEIOS_CACHE) {
                const sorted = [...listaParaSalvar].sort((a, b) => parseRomaneioRecencyTime(b) - parseRomaneioRecencyTime(a));
                listaParaSalvar = sorted.slice(0, LS_MAX_ROMANEIOS_CACHE);
                console.warn(`⚠️ PCT: Lista truncada para ${LS_MAX_ROMANEIOS_CACHE} mais recentes (total: ${nextCount}).`);
            }

            // Não gravar backup automático (causa direta do QuotaExceededError)
            writeLocalStorageValue('romaneios/pct', JSON.stringify(listaParaSalvar));
            console.log(`💾 PCT: cache romaneios/pct atualizado com ${listaParaSalvar.length} itens (contexto: ${contexto}).`);
            return true;
        } catch (err) {
            console.error('❌ PCT: Erro na persistência segura de romaneiosPct:', err);
            return false;
        }
    }


    /**
     * ✅ CARREGAR ROMANEIO PCT PARA EDIÇÃO
     * @param {string} id - ID do romaneio
     * @param {number} indice - Índice do romaneio (opcional)
     * @param {Object} dadosPreCarregados - Objeto do romaneio pré-carregado (opcional)
     */
    async function carregarRomaneio(id, indice, dadosPreCarregados = null) {
        const sid = String(id || '').trim();
        console.log('🔍 INÍCIO CARREGAMENTO ROMANEIO PCT:');
        console.log('================================');
        console.log('ID solicitado:', sid);
        console.log('Índice:', indice);
        
        try {
            // Fonte canônica: companies/{companyId}/romaneios/pct via firebaseService.
            let romaneios = [];
            
            // 1. Tentar pegar do estado em memória do modal de lista PCT primeiro
            if (window.ModalListaRomaneiosPCT && window.ModalListaRomaneiosPCT.state && Array.isArray(window.ModalListaRomaneiosPCT.state.romaneios)) {
                romaneios = [...window.ModalListaRomaneiosPCT.state.romaneios];
            }
            
            if (dadosPreCarregados && typeof dadosPreCarregados === 'object') {
                const jaExiste = romaneios.some(r => String(r.id) === String(dadosPreCarregados.id));
                if (!jaExiste) {
                    romaneios.unshift(dadosPreCarregados);
                }
            }
            
            if (romaneios.length === 0 && window.firebaseService && typeof window.firebaseService.loadFromFirebase === 'function') {
                try {
                    console.log('🔥 PCT: Tentando carregar de romaneios/pct...');
                    const firebaseResult = await window.firebaseService.loadFromFirebase('romaneios/pct');
                    
                    if (firebaseResult && firebaseResult.success && firebaseResult.data) {
                        const firebaseData = firebaseResult.data;

                        if (window.RomaneioDataUtils && typeof window.RomaneioDataUtils.normalizeRomaneioCollection === 'function') {
                            romaneios = window.RomaneioDataUtils.normalizeRomaneioCollection(firebaseData, { type: 'PCT' })
                                .map(item => ({ ...item, __source: 'firebase' }));
                            console.log(`✅ PCT: ${romaneios.length} romaneios válidos carregados do Firebase`);
                        } else if (Array.isArray(firebaseData) && firebaseData.length > 0) {
                            romaneios = firebaseData
                                .filter(item => item && (item.cliente || item.numero || item.id))
                                .map(item => ({ ...item, __source: 'firebase' }));
                            console.log(`✅ PCT: ${romaneios.length} romaneios válidos carregados do Firebase`);
                        } else if (typeof firebaseData === 'object' && Object.keys(firebaseData).length > 0) {
                            romaneios = Object.entries(firebaseData)
                                .map(([key, value]) => ({ id: value && value.id || key, firebaseKey: key, ...(value || {}) }))
                                .filter(item => item && (item.cliente || item.numero || item.id))
                                .map(item => ({ ...item, __source: 'firebase' }));
                            console.log(`✅ PCT: ${romaneios.length} romaneios válidos carregados do Firebase (convertidos)`);
                        } else {
                            console.log('ℹ️ PCT: Firebase retornou dados vazios ou inválidos');
                        }
                    }
                } catch (firebaseError) {
                    console.warn('⚠️ PCT: Erro ao carregar de romaneios/pct:', firebaseError);
                }
            }
            
            romaneios = filterByActiveTenant(romaneios).map(({ __source, ...rest }) => rest);
            
            // Procurar pelo ID (com fallback por firebaseKey ou por número)
            let romaneioIndex = romaneios.findIndex(r => String(r.id) === sid || String(r.firebaseKey) === sid);
            if (romaneioIndex === -1) {
                romaneioIndex = romaneios.findIndex(r => String(r.numero) === sid);
            }
            if (romaneioIndex === -1 && dadosPreCarregados) {
                romaneios.push(dadosPreCarregados);
                romaneioIndex = romaneios.length - 1;
            }
            console.log('🔍 Índice do romaneio encontrado:', romaneioIndex);
            
            if (romaneioIndex !== -1) {
                let romaneio = romaneios[romaneioIndex];
                romaneio.itens = romaneio.itens || romaneio.items || [];
                console.log('📋 ROMANEIO ENCONTRADO:');
                console.log('- ID:', romaneio.id);
                console.log('- Cliente:', romaneio.cliente?.nome || 'N/A');
                console.log('- Data:', romaneio.data);
                console.log('- Total de itens brutos:', romaneio.itens?.length || 0);
                
                if (romaneio.itens && Array.isArray(romaneio.itens)) {
                    // Aplicar correção de dados antes de processar
                    romaneio = corrigirDadosRomaneio(romaneio);
                    
                    console.log('🔍 PROCESSANDO ITENS CORRIGIDOS:');
                    
                    let itensValidos = 0;
                    let itensInvalidos = 0;
                    
                    // Mapear itens válidos para o formato correto
                    const itensConvertidos = romaneio.itens
                        .filter(item => {
                            const comprimento = parseFloat(item.comprimento) || 0;
                            const largura = parseFloat(item.largura) || 0;
                            const espessura = parseFloat(item.espessura) || 0;
                            const quantidade = parseInt(item.quantidade) || 0;
                            
                            const valido = comprimento > 0 && largura > 0 && espessura > 0 && quantidade > 0;
                            if (valido) {
                                itensValidos++;
                            } else {
                                itensInvalidos++;
                            }
                            return valido;
                        })
                        .map(item => {
                            const comprimento = parseFloat(item.comprimento) || 0;
                            const largura = parseFloat(item.largura) || 0;
                            const espessura = parseFloat(item.espessura) || 0;
                            const quantidade = parseInt(item.quantidade) || 0;
                            const pecasPorPacote = parseInt(item.pecasPorPacote) || 1;
                            const valorUnitario = parseFloat(item.valorUnitario) || 0;
                            
                            // Calcular volume usando função global ou local
                            const volume = calcularVolume(comprimento, largura, espessura) * quantidade * pecasPorPacote;
                            
                            return {
                                id: item.id || Date.now() + Math.random(),
                                especie: item.especie || '',
                                comprimento: comprimento,
                                largura: largura,
                                espessura: espessura,
                                quantidade: quantidade,
                                pecasPorPacote: pecasPorPacote,
                                valorUnitario: valorUnitario,
                                volume: volume,
                                totalPecas: quantidade * pecasPorPacote,
                                valorTotal: volume * valorUnitario
                            };
                        });
                    
                    console.log('📦 ITENS PROCESSADOS:');
                    console.log('- Itens válidos:', itensValidos);
                    console.log('- Itens inválidos:', itensInvalidos);
                    console.log('- Itens convertidos:', itensConvertidos.length);
                    
                    // Salvar o romaneio corrigido de volta no caminho canônico quando possível.
                    romaneios[romaneioIndex] = romaneio;
                    
                    if (window.firebaseService && typeof window.firebaseService.saveToFirebase === 'function') {
                        try {
                            console.log('🔥 PCT: Carregando dados atuais do Firebase para preservar propriedades...');
                            
                            // ✅ CORREÇÃO: Carregar dados atuais do Firebase para preservar propriedades
                            const dadosAtuais = await window.firebaseService.loadFromFirebase('romaneios/pct');
                            let romaneiosComPropriedades = romaneios;
                            
                            const dadosAtuaisLista = window.RomaneioDataUtils && typeof window.RomaneioDataUtils.normalizeRomaneioCollection === 'function'
                                ? window.RomaneioDataUtils.normalizeRomaneioCollection(dadosAtuais && dadosAtuais.success ? dadosAtuais.data : null, { type: 'PCT' })
                                : (dadosAtuais && dadosAtuais.success && Array.isArray(dadosAtuais.data) ? dadosAtuais.data : []);

                            if (dadosAtuaisLista.length > 0) {
                                console.log('🔍 PCT: Preservando propriedades de contas a receber...');
                                romaneiosComPropriedades = romaneios.map(romaneio => {
                                    // Encontrar o romaneio correspondente nos dados atuais
                                    const romaneioAtual = dadosAtuaisLista.find(r => r && String(r.id) === String(romaneio.id));
                                    if (romaneioAtual) {
                                        // Preservar propriedades de contas a receber
                                        return {
                                            ...romaneio,
                                            contasReceberLancado: romaneioAtual.contasReceberLancado,
                                            contasReceberLancadoEm: romaneioAtual.contasReceberLancadoEm,
                                            contasReceberReativadoEm: romaneioAtual.contasReceberReativadoEm
                                        };
                                    }
                                    return romaneio;
                                });
                                
                                const preservados = romaneiosComPropriedades.filter(r => r.contasReceberLancado === true).length;
                                if (preservados > 0) {
                                    console.log(`✅ PCT: ${preservados} propriedades de contas a receber preservadas`);
                                }
                            }
                            
                            console.log('🔥 PCT: Salvando APENAS o romaneio editado no Firebase por registro...');
                            const alvo = romaneiosComPropriedades[romaneioIndex];
                            if (!alvo || !alvo.id) throw new Error('Romaneio alvo inválido para salvamento');
                            const payload = { ...alvo };
                            Object.keys(payload).forEach(k => { if (payload[k] === undefined) delete payload[k]; });
                            const res = await window.firebaseService.saveToFirebase('romaneios/pct', String(alvo.id), payload);
                            if (res && res.success) {
                                console.log('✅ PCT: Romaneio alvo salvo no Firebase');
                                try { window.dispatchEvent(new CustomEvent('romaneiosPct:updated', { detail: { id: String(alvo.id) } })); } catch {}
                            } else {
                                throw new Error('Falha ao salvar romaneio alvo');
                            }
                        } catch (firebaseError) {
                            console.warn('⚠️ PCT: Erro ao salvar no Firebase:', firebaseError);
                        }
                    } else {
                        console.warn('⚠️ PCT: Firebase indisponível, correção automática não foi persistida.');
                    }
                    
                    // Carregar os itens
                    window.romaneioItems = itensConvertidos;
                    if (typeof window.romaneioItems !== 'undefined') {
                        window.romaneioItems = itensConvertidos;
                    }

                    const dataEmissao = romaneio.dataEmissao || romaneio.data || romaneio.timestamp || '';
                    if (typeof window.setRomaneioPctEmissionDate === 'function') {
                        window.setRomaneioPctEmissionDate(dataEmissao);
                    } else {
                        const dataInput = document.getElementById('romaneioData');
                        if (dataInput) {
                            const iso = String(dataEmissao || '').match(/^(\d{4}-\d{2}-\d{2})/);
                            dataInput.value = iso ? iso[1] : new Date().toISOString().slice(0, 10);
                        }
                    }
                    
                    // Verificar se há cliente definido
                    if (romaneio.cliente) {
                        console.log('👤 CARREGANDO CLIENTE:');
                        console.log('- Nome:', romaneio.cliente.nome);
                        console.log('- ID:', romaneio.cliente.id);
                        
                        // Definir cliente selecionado globalmente
                        if (typeof window.selectedClient !== 'undefined') {
                            window.selectedClient = {
                                id: romaneio.cliente.id,
                                nome: romaneio.cliente.nome,
                                telefone: romaneio.cliente.telefone || '',
                                email: romaneio.cliente.email || ''
                            };
                        }
                        
                        // Atualizar campo do cliente na interface
                        const clienteInput = document.getElementById('clienteInput');
                        if (clienteInput) {
                            clienteInput.value = romaneio.cliente.nome;
                        }
                    } else {
                        console.warn('⚠️ Romaneio não possui cliente definido');
                    }
                    
                    // Definir estado de edição
                    window.romaneioEmEdicao = {
                        id: romaneio.id,
                        indice: romaneioIndex,
                        numero: romaneio.numero,
                        data: romaneio.data,
                        dataEmissao: romaneio.dataEmissao,
                        timestamp: romaneio.timestamp
                    };
                    
                    // Atualizar interface se as funções estiverem disponíveis
                    console.log('🔄 ATUALIZANDO INTERFACE:');
                    
                    if (typeof window.reconstruirTabela === 'function') {
                        window.reconstruirTabela();
                    } else if (typeof reconstruirTabela === 'function') {
                        reconstruirTabela();
                    }
                    
                    if (typeof window.atualizarTotais === 'function') {
                        window.atualizarTotais();
                    } else if (typeof atualizarTotais === 'function') {
                        atualizarTotais();
                    }
                    
                    // ✅ RECALCULAR VALORES DOS ITENS (CORREÇÃO PARA EDIÇÃO DE ROMANEIO)
                    if (typeof window.recalcularValoresItens === 'function') {
                        console.log('🔄 Recalculando valores dos itens carregados para correção');
                        setTimeout(() => {
                            window.recalcularValoresItens();
                        }, 500); // Delay para garantir que as outras funções executaram
                    }
                    
                    // ✅ FECHAR O MODAL DA LISTA DE ROMANEIOS APÓS CARREGAR COM SUCESSO
                    const listaModal = document.getElementById('listaModal');
                    if (listaModal) {
                        listaModal.style.display = 'none';
                        console.log('🚪 Modal da lista de romaneios fechado automaticamente');
                    }
                    
                    // Fechar modal PCT se existir
                    const modalListaRomaneiosPCT = document.getElementById('modalListaRomaneiosPCT');
                    if (modalListaRomaneiosPCT) {
                        modalListaRomaneiosPCT.style.display = 'none';
                        console.log('🚪 Modal PCT da lista de romaneios fechado automaticamente');
                    }
                    
                    // Atualizar botão de salvar para indicar edição
                    const btnSalvar = document.getElementById('btnSalvar');
                    if (btnSalvar) {
                        btnSalvar.innerHTML = '<i class="fas fa-save"></i> Atualizar';
                    }
                    
                    try {
                        window.scrollTo({ top: 0, behavior: 'smooth' });
                    } catch (_) {}
                    
                    console.log('✅ CARREGAMENTO CONCLUÍDO');
                    console.log('================================');
                    
                } else {
                    console.error('❌ Romaneio não possui itens válidos');
                    alert('Romaneio não possui itens válidos.');
                }
            } else {
                // Log detalhado para diagnóstico
                const amostra = romaneios.slice(0, 5).map(r => ({ id: r.id, numero: r.numero }));
                console.error('❌ Romaneio não encontrado com ID/numero:', id);
                console.warn('📊 Amostra de IDs disponíveis:', amostra);
                console.warn('📦 Total no dataset pós-merge:', romaneios.length);
                alert('Romaneio não encontrado para edição. Tente novamente pela lista.');
            }
        } catch (error) {
            console.error('❌ Erro ao carregar romaneio:', error);
            alert('Erro ao carregar romaneio: ' + error.message);
        }
    }

    /**
     * ✅ FUNÇÃO DE CORREÇÃO DE DADOS DO ROMANEIO
     * @param {Object} romaneio - Romaneio a ser corrigido
     * @returns {Object} - Romaneio corrigido
     */
    function corrigirDadosRomaneio(romaneio) {
        if (!romaneio || !romaneio.itens) {
            return romaneio;
        }

        console.log('🔧 Aplicando correção de dados do romaneio...');
        
        // Corrigir itens com dados inválidos
        romaneio.itens = romaneio.itens.map(item => {
            // Garantir que todos os campos numéricos sejam válidos
            return {
                ...item,
                comprimento: parseFloat(item.comprimento) || 0,
                largura: parseFloat(item.largura) || 0,
                espessura: parseFloat(item.espessura) || 0,
                quantidade: parseInt(item.quantidade) || 0,
                pecasPorPacote: parseInt(item.pecasPorPacote) || 1,
                valorUnitario: parseFloat(item.valorUnitario) || 0
            };
        });

        return romaneio;
    }

    /**
     * ✅ FUNÇÃO DE CÁLCULO DE VOLUME
     * @param {number} comprimento - Comprimento em metros
     * @param {number} largura - Largura em metros  
     * @param {number} espessura - Espessura em metros
     * @returns {number} - Volume em m³
     */
    function calcularVolume(comprimento, largura, espessura) {
        if (!comprimento || !largura || !espessura) {
            return 0;
        }

        // Converter para metros se necessário e calcular
        const comp = parseFloat(comprimento) || 0;
        const larg = parseFloat(largura) || 0;
        const esp = parseFloat(espessura) || 0;

        return comp * larg * esp;
    }

    /**
     * ✅ FUNÇÃO DE CLONAGEM DO ROMANEIO PCT
     */
    async function clonarRomaneio(id, romaneios = null, dadosPreCarregados = null) {
        console.log('📋 PCT: Clonando romaneio:', id);
        try {
            await carregarRomaneio(id, romaneios, dadosPreCarregados);

            // Limpar estado de edição (pronto para salvar como novo)
            window.romaneioEmEdicao = null;

            // Garantir que o botão volte para Salvar
            const btnSalvar = document.getElementById('btnSalvar');
            if (btnSalvar) {
                btnSalvar.innerHTML = '<i class="fas fa-save"></i> Salvar';
            }

            // Atualizar data de emissão para data atual
            const dataInput = document.getElementById('romaneioData');
            if (dataInput) {
                dataInput.value = new Date().toISOString().split('T')[0];
            }

            const msg = 'Romaneio clonado com sucesso! Pronto para salvar como novo.';
            if (typeof window.__toast === 'function') {
                window.__toast(msg, 'success');
            } else if (window.Utils && window.Utils.showToast) {
                window.Utils.showToast(msg, 'success');
            } else {
                alert(msg);
            }
            return true;
        } catch (err) {
            console.error('❌ Erro ao clonar romaneio PCT:', err);
            alert('Erro ao clonar romaneio: ' + err.message);
            return false;
        }
    }

    // ✅ EXPOR FUNÇÕES GLOBALMENTE
    window.carregarRomaneio = carregarRomaneio;
    window.clonarRomaneioPCT = clonarRomaneio;
    window.CarregarRomaneioPCT = {
        carregarRomaneio,
        clonarRomaneio
    };
    
    console.log('✅ Módulo CarregarRomaneoPCT carregado com sucesso');

})();
