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
                const id = raw.id || raw.companyId || raw.slug || raw.nome || raw.name;
                if (id) return String(id);
            }
            const stored = localStorage.getItem('company_info');
            if (stored) {
                const obj = JSON.parse(stored);
                const id = obj && (obj.id || obj.companyId || obj.slug || obj.nome || obj.name);
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
                    const prevRaw = readLocalStorageValue('romaneiosPct');
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
                const sorted = [...listaParaSalvar].sort((a, b) => {
                    const ta = a && (a.timestamp || (a.dataCriacao && new Date(a.dataCriacao).getTime()) || 0);
                    const tb = b && (b.timestamp || (b.dataCriacao && new Date(b.dataCriacao).getTime()) || 0);
                    return (tb || 0) - (ta || 0);
                });
                listaParaSalvar = sorted.slice(0, LS_MAX_ROMANEIOS_CACHE);
                console.warn(`⚠️ PCT: Lista truncada para ${LS_MAX_ROMANEIOS_CACHE} mais recentes (total: ${nextCount}).`);
            }

            // Não gravar backup automático (causa direta do QuotaExceededError)
            writeLocalStorageValue('romaneiosPct', JSON.stringify(listaParaSalvar));
            console.log(`💾 PCT: romaneiosPct atualizado com ${listaParaSalvar.length} itens (contexto: ${contexto}).`);
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
     */
    async function carregarRomaneio(id, indice) {
        console.log('🔍 INÍCIO CARREGAMENTO ROMANEIO PCT:');
        console.log('================================');
        console.log('ID solicitado:', id);
        console.log('Índice:', indice);
        
        try {
            // ✅ CORREÇÃO: Tentar carregar do Firebase primeiro, depois localStorage
            let romaneios = [];
            const activeTenant = resolveCompanyId();
            
            // ✅ PRIORIDADE 1: Firebase (chave consistente com localStorage)
            if (window.firebaseService && typeof window.firebaseService.loadFromFirebase === 'function') {
                try {
                    console.log('🔥 PCT: Tentando carregar da tabela romaneiosPct...');
                    const firebaseResult = await window.firebaseService.loadFromFirebase('romaneios/pct');
                    
                    if (firebaseResult && firebaseResult.success && firebaseResult.data) {
                        const firebaseData = firebaseResult.data;
                        
                        if (Array.isArray(firebaseData) && firebaseData.length > 0) {
                            romaneios = firebaseData
                                .filter(item => item && (item.cliente || item.numero || item.id))
                                .map(item => ({ ...item, __source: 'firebase' }));
                            console.log(`✅ PCT: ${romaneios.length} romaneios válidos carregados do Firebase`);
                        } else if (typeof firebaseData === 'object' && Object.keys(firebaseData).length > 0) {
                            romaneios = Object.values(firebaseData)
                                .filter(item => item && (item.cliente || item.numero || item.id))
                                .map(item => ({ ...item, __source: 'firebase' }));
                            console.log(`✅ PCT: ${romaneios.length} romaneios válidos carregados do Firebase (convertidos)`);
                        } else {
                            console.log('ℹ️ PCT: Firebase retornou dados vazios ou inválidos');
                        }
                    }
                } catch (firebaseError) {
                    console.warn('⚠️ PCT: Erro ao carregar da tabela romaneiosPct:', firebaseError);
                }
            }
            
            romaneios = filterByActiveTenant(romaneios).map(({ __source, ...rest }) => rest);
            if (romaneios.length === 0 && activeTenant) {
                console.log('🔍 PCT: Firebase vazio para tenant ativo, tentando localStorage namespaced...');
                try {
                    const localData = JSON.parse(readLocalStorageValue('romaneiosPct') || '[]');
                    let localRomaneios = [];
                    if (Array.isArray(localData) && localData.length > 0) {
                        localRomaneios = localData
                            .filter(item => item && (item.cliente || item.numero || item.id))
                            .map(item => ({ ...item, __source: 'local' }));
                    } else if (typeof localData === 'object' && localData !== null && Object.keys(localData).length > 0) {
                        localRomaneios = Object.keys(localData).map(key => ({ id: key, ...localData[key], __source: 'local' }))
                            .filter(item => item && (item.cliente || item.numero || item.id));
                    }
                    romaneios = filterByActiveTenant(localRomaneios).map(({ __source, ...rest }) => rest);
                    console.log(`🧩 PCT: Fallback local aplicado para tenant ${activeTenant}. Itens: ${romaneios.length}`);
                } catch (localError) {
                    console.warn('⚠️ PCT: Erro ao carregar fallback local:', localError);
                }
            }
            
            // ✅ VALIDAÇÃO FINAL
            if (romaneios.length === 0) {
                console.log('ℹ️ PCT: Nenhum romaneio encontrado em nenhuma fonte');
                romaneios = [];
            }
            
            // Procurar pelo ID (com fallback por número)
            let romaneioIndex = romaneios.findIndex(r => r.id == id);
            if (romaneioIndex === -1) {
                romaneioIndex = romaneios.findIndex(r => r.numero == id);
            }
            console.log('🔍 Índice do romaneio encontrado:', romaneioIndex);
            
            if (romaneioIndex !== -1) {
                let romaneio = romaneios[romaneioIndex];
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
                    
                    // ✅ Salvar o romaneio corrigido de volta (Firebase primeiro, localStorage como fallback)
                    romaneios[romaneioIndex] = romaneio;
                    
                    // ✅ PRIORIDADE 1: Firebase - PRESERVANDO PROPRIEDADES DE CONTAS A RECEBER
                    if (window.firebaseService && typeof window.firebaseService.saveToFirebase === 'function') {
                        try {
                            console.log('🔥 PCT: Carregando dados atuais do Firebase para preservar propriedades...');
                            
                            // ✅ CORREÇÃO: Carregar dados atuais do Firebase para preservar propriedades
                            const dadosAtuais = await window.firebaseService.loadFromFirebase('romaneios/pct');
                            let romaneiosComPropriedades = romaneios;
                            
                            if (dadosAtuais && dadosAtuais.success && Array.isArray(dadosAtuais.data)) {
                                console.log('🔍 PCT: Preservando propriedades de contas a receber...');
                                romaneiosComPropriedades = romaneios.map(romaneio => {
                                    // Encontrar o romaneio correspondente nos dados atuais
                                    const romaneioAtual = dadosAtuais.data.find(r => r && r.id === romaneio.id);
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
                            const res = await window.firebaseService.saveToFirebase('romaneiosPct', String(alvo.id), payload);
                            if (res && res.success) {
                                console.log('✅ PCT: Romaneio alvo salvo no Firebase');
                                try { window.dispatchEvent(new CustomEvent('romaneiosPct:updated', { detail: { id: String(alvo.id) } })); } catch {}
                                // Persistir lista atualizada localmente para manter consistência offline
                                safePersistRomaneiosPct(romaneios, 'saveFirebaseCorrigido');
                                console.log('✅ PCT: localStorage sincronizado (lista atualizada)');
                            } else {
                                throw new Error('Falha ao salvar romaneio alvo');
                            }
                        } catch (firebaseError) {
                            console.warn('⚠️ PCT: Erro ao salvar no Firebase:', firebaseError);
                            // ✅ FALLBACK: Salvar apenas no localStorage
                            safePersistRomaneiosPct(romaneios, 'fallbackSaveLocal');
                            console.log('💾 PCT: Romaneio corrigido salvo no localStorage (fallback)');
                        }
                    } else {
                        // ✅ FALLBACK: Firebase indisponível, salvar apenas no localStorage
                        safePersistRomaneiosPct(romaneios, 'firebaseIndisponivelSaveLocal');
                        console.log('💾 PCT: Romaneio corrigido salvo no localStorage (Firebase indisponível)');
                    }
                    
                    // Carregar os itens
                    window.romaneioItems = itensConvertidos;
                    if (typeof window.romaneioItems !== 'undefined') {
                        window.romaneioItems = itensConvertidos;
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
                        indice: romaneioIndex
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

    // ✅ EXPOR FUNÇÕES GLOBALMENTE
    window.carregarRomaneio = carregarRomaneio;
    
    console.log('✅ Módulo CarregarRomaneoPCT carregado com sucesso');

})();
