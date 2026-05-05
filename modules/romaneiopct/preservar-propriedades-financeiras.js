/**
 * 🛡️ SISTEMA DE PRESERVAÇÃO DE PROPRIEDADES FINANCEIRAS - PCT
 * 
 * Este módulo garante que as propriedades relacionadas a contas a receber
 * sejam preservadas em TODAS as operações de salvamento de romaneios PCT.
 * 
 * Propriedades preservadas:
 * - contasReceberLancado
 * - contasReceberLancadoEm
 * - contasReceberReativadoEm
 */

(function() {
    'use strict';

    console.log('🛡️ PCT: Sistema de Preservação de Propriedades Financeiras carregado');

    // Cache das propriedades financeiras por romaneio
    let propriedadesFinanceiras = new Map();

    /**
     * 🔍 CARREGAR PROPRIEDADES ATUAIS DO FIREBASE
     */
    async function carregarPropriedadesFinanceiras() {
        try {
            if (!window.firebaseService) {
                console.warn('⚠️ PCT: firebaseService não disponível para carregar propriedades');
                return;
            }

            console.log('🔍 PCT: Carregando propriedades financeiras atuais...');
            const result = await window.firebaseService.loadFromFirebase('romaneios/pct');
            
            if (result && result.success && Array.isArray(result.data)) {
                propriedadesFinanceiras.clear();
                
                result.data.forEach(romaneio => {
                    if (romaneio && romaneio.id) {
                        // ✅ CORREÇÃO: Só armazenar propriedades válidas E mais recentes
                        const propriedades = {};
                        
                        // ✅ CORREÇÃO: Só armazenar se a propriedade for true (lançado)
                        // Se for false, não armazenar no cache para não sobrescrever
                        if (romaneio.contasReceberLancado === true) {
                            propriedades.contasReceberLancado = true;
                        }
                        
                        if (romaneio.contasReceberLancadoEm && romaneio.contasReceberLancadoEm !== '') {
                            propriedades.contasReceberLancadoEm = romaneio.contasReceberLancadoEm;
                        }
                        
                        if (romaneio.contasReceberReativadoEm && romaneio.contasReceberReativadoEm !== '') {
                            propriedades.contasReceberReativadoEm = romaneio.contasReceberReativadoEm;
                        }
                        
                        // ✅ CORREÇÃO: Só armazenar se houver pelo menos uma propriedade válida
                        if (Object.keys(propriedades).length > 0) {
                            propriedadesFinanceiras.set(romaneio.id, propriedades);
                        }
                    }
                });
                
                const totalPreservadas = propriedadesFinanceiras.size;
                console.log(`✅ PCT: ${totalPreservadas} propriedades financeiras carregadas para preservação`);
                
                if (totalPreservadas > 0) {
                    console.log('🔍 PCT: IDs com propriedades financeiras:', Array.from(propriedadesFinanceiras.keys()));
                }
            }
        } catch (error) {
            console.error('❌ PCT: Erro ao carregar propriedades financeiras:', error);
        }
    }

    /**
     * 🛡️ APLICAR PRESERVAÇÃO DE PROPRIEDADES
     */
    function aplicarPreservacao(romaneios) {
        if (!Array.isArray(romaneios)) {
            console.warn('⚠️ PCT: Dados não são array, preservação não aplicada');
            return romaneios;
        }

        let preservados = 0;
        
        const romaneiosPreservados = romaneios.map(romaneio => {
            if (!romaneio || !romaneio.id) return romaneio;
            
            const propriedadesArmazenadas = propriedadesFinanceiras.get(romaneio.id);
            if (propriedadesArmazenadas) {
                // ✅ CORREÇÃO CRÍTICA: Verificar se o romaneio já tem propriedades mais recentes
                const romaneioTemPropriedadesRecentes = 
                    romaneio.contasReceberLancado !== undefined || 
                    romaneio.contasReceberLancadoEm || 
                    romaneio.contasReceberReativadoEm;
                
                // ✅ CORREÇÃO: Só preservar se o romaneio NÃO tiver propriedades mais recentes
                if (!romaneioTemPropriedadesRecentes) {
                    preservados++;
                    
                    // ✅ CORREÇÃO CRÍTICA: Criar novo objeto apenas com propriedades válidas
                    const romaneioComPropriedades = { ...romaneio };
                    
                    // ✅ CORREÇÃO: Só adicionar propriedades se não forem undefined
                    if (propriedadesArmazenadas.contasReceberLancado !== undefined) {
                        romaneioComPropriedades.contasReceberLancado = propriedadesArmazenadas.contasReceberLancado;
                        console.log(`🛡️ PCT: Preservando contasReceberLancado=${propriedadesArmazenadas.contasReceberLancado} para romaneio ${romaneio.id} (sem propriedades recentes)`);
                    }
                    
                    if (propriedadesArmazenadas.contasReceberLancadoEm) {
                        romaneioComPropriedades.contasReceberLancadoEm = propriedadesArmazenadas.contasReceberLancadoEm;
                    }
                    
                    if (propriedadesArmazenadas.contasReceberReativadoEm) {
                        romaneioComPropriedades.contasReceberReativadoEm = propriedadesArmazenadas.contasReceberReativadoEm;
                    }
                    
                    return romaneioComPropriedades;
                } else {
                    console.log(`🛡️ PCT: Romaneio ${romaneio.id} tem propriedades recentes, preservação ignorada`);
                }
            }
            
            return romaneio;
        });

        if (preservados > 0) {
            console.log(`🛡️ PCT: ${preservados} romaneios tiveram propriedades financeiras preservadas`);
        }

        return romaneiosPreservados;
    }

    /**
     * 🎯 INTERCEPTAR FIREBASESERVICE.SAVETOFIREBASE
     */
    function interceptarFirebaseService() {
        if (!window.firebaseService || typeof window.firebaseService.saveToFirebase !== 'function') {
            console.warn('⚠️ PCT: firebaseService.saveToFirebase não disponível para interceptação');
            return;
        }

        const originalSaveToFirebase = window.firebaseService.saveToFirebase;
        
        window.firebaseService.saveToFirebase = async function(collection, id, data) {
            // Interceptar apenas salvamentos de romaneiosPct
            if (collection === 'romaneiosPct' && Array.isArray(data)) {
                console.log('🛡️ PCT: Interceptando salvamento de romaneiosPct para preservar propriedades');
                
                // Carregar propriedades atuais se não foram carregadas
                if (propriedadesFinanceiras.size === 0) {
                    await carregarPropriedadesFinanceiras();
                }
                
                // Aplicar preservação
                const dataPreservada = aplicarPreservacao(data);
                
                // Tentar salvar apenas o registro alterado (reduzir I/O)
                const alvoId = (window.romaneioEmEdicao && window.romaneioEmEdicao?.id) || window.lastSavedPCTRomaneioId;
                if (alvoId) {
                    const reg = dataPreservada.find(r => String(r?.id) === String(alvoId));
                    if (reg) {
                        const payload = { ...reg };
                        Object.keys(payload).forEach(k => { if (payload[k] === undefined) delete payload[k]; });
                        const res = await originalSaveToFirebase.call(this, collection, String(alvoId), payload);
                        return { success: !!(res && res.success), saved: res && res.success ? 1 : 0 };
                    }
                }
                
                // Fallback: salvar por registro (evitar sobrescrita), mas pode ser custoso
                let okCount = 0;
                for (const reg of dataPreservada) {
                    if (!reg || !reg.id) continue;
                    const payload = { ...reg };
                    Object.keys(payload).forEach(k => { if (payload[k] === undefined) delete payload[k]; });
                    const res = await originalSaveToFirebase.call(this, collection, String(reg.id), payload);
                    if (res && res.success) okCount++;
                }
                return { success: okCount > 0, saved: okCount };
            }
            
            // Para outros tipos de dados, usar função original
            return originalSaveToFirebase.call(this, collection, id, data);
        };

        console.log('✅ PCT: firebaseService.saveToFirebase interceptado com sucesso');
    }

    /**
     * 🎯 INTERCEPTAR WINDOW.SAVEDATA (SE EXISTIR)
     */
    function interceptarSaveData() {
        if (typeof window.saveData === 'function') {
            const originalSaveData = window.saveData;
            
            window.saveData = async function(key, data) {
                // Interceptar apenas salvamentos de romaneios/pct
                if ((key === 'romaneiosPct' || key === 'romaneios/pct') && Array.isArray(data)) {
                    console.log('🛡️ PCT: Interceptando window.saveData de romaneios/pct para preservar propriedades');
                    
                    // Carregar propriedades atuais se não foram carregadas
                    if (propriedadesFinanceiras.size === 0) {
                        await carregarPropriedadesFinanceiras();
                    }
                    
                    // Aplicar preservação
                    const dataPreservada = aplicarPreservacao(data);
                    
                    return originalSaveData.call(this, 'romaneios/pct', dataPreservada);
                }
                
                // Para outros tipos de dados, usar função original
                return originalSaveData.call(this, key, data);
            };

            console.log('✅ PCT: window.saveData interceptado com sucesso');
        }
    }

    /**
     * 🔄 ATUALIZAR PROPRIEDADES QUANDO CONTAS A RECEBER SÃO LANÇADAS/REATIVADAS
     */
    function atualizarPropriedadeFinanceira(romaneioId, propriedade, valor) {
        if (!romaneioId) return;
        
        let propriedades = propriedadesFinanceiras.get(romaneioId) || {};
        
        // ✅ CORREÇÃO: Só armazenar valores válidos (não undefined, null ou vazios)
        if (valor !== undefined && valor !== null && valor !== '') {
            propriedades[propriedade] = valor;
            console.log(`🛡️ PCT: Propriedade ${propriedade} atualizada para romaneio ${romaneioId}: ${valor}`);
        } else {
            // ✅ CORREÇÃO: Remover propriedade se valor for inválido
            delete propriedades[propriedade];
            console.log(`🧹 PCT: Propriedade ${propriedade} removida do romaneio ${romaneioId} (valor inválido: ${valor})`);
        }
        
        // ✅ CORREÇÃO: Só armazenar no cache se houver propriedades válidas
        if (Object.keys(propriedades).length > 0) {
            propriedadesFinanceiras.set(romaneioId, propriedades);
        } else {
            propriedadesFinanceiras.delete(romaneioId);
            console.log(`🧹 PCT: Romaneio ${romaneioId} removido do cache (sem propriedades válidas)`);
        }
    }

    /**
     * 🚀 INICIALIZAÇÃO
     */
    async function inicializar() {
        console.log('🚀 PCT: Inicializando sistema de preservação...');
        
        // Aguardar firebaseService estar disponível
        let tentativas = 0;
        const maxTentativas = 20;
        
        while (!window.firebaseService && tentativas < maxTentativas) {
            await new Promise(resolve => setTimeout(resolve, 500));
            tentativas++;
        }
        
        if (!window.firebaseService) {
            console.error('❌ PCT: firebaseService não disponível após aguardar');
            return;
        }
        
        // Carregar propriedades atuais
        await carregarPropriedadesFinanceiras();
        
        // Configurar interceptações
        interceptarFirebaseService();
        interceptarSaveData();
        
        console.log('✅ PCT: Sistema de preservação inicializado com sucesso');
    }

    // Expor funções globalmente para uso externo
    window.PreservacaoFinanceirasPCT = {
        carregarPropriedadesFinanceiras,
        atualizarPropriedadeFinanceira,
        aplicarPreservacao,
        // Função para debug
        debug: function() {
            console.log('🔍 PCT: Propriedades financeiras em cache:', Object.fromEntries(propriedadesFinanceiras));
            return Object.fromEntries(propriedadesFinanceiras);
        }
    };

    // Inicializar quando DOM estiver pronto
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', inicializar);
    } else {
        inicializar();
    }

})();
