/**
 * 🔄 SCRIPT DE MIGRAÇÃO: Unificação de Tabelas de Contas
 * 
 * Este script migra dados das tabelas duplicadas para as tabelas unificadas:
 * - contas_receber → contasReceber
 * - contasreceber → contasReceber
 * - contas_pagar → contasPagar
 * - contaspagar → contasPagar
 * 
 * ⚠️ IMPORTANTE: Execute este script apenas UMA VEZ após o deploy da unificação
 * 
 * @author Sistema de Excelência
 * @date 2025-01-30
 */

console.log('🔄 === INICIANDO MIGRAÇÃO DE TABELAS DE CONTAS ===');

/**
 * Função principal de migração
 */
async function migrarTabelasContas() {
    try {
        console.log('📊 Verificando tabelas no Firebase...');
        
        // Verificar se firebaseService está disponível
        if (!window.firebaseService || !window.firebaseService.loadFromFirebase || !window.firebaseService.saveToFirebase) {
            throw new Error('FirebaseService não disponível. Certifique-se de que o firebaseService está carregado.');
        }
        
        let migrados = 0;
        let erros = 0;
        
        // ========================================
        // MIGRAÇÃO 1: contas_receber → contasReceber
        // ========================================
        console.log('\n📥 Verificando contas_receber...');
        try {
            const contas_receber_result = await window.firebaseService.loadFromFirebase('contas_receber');
            
            if (contas_receber_result && contas_receber_result.success && contas_receber_result.data) {
                const dados_antigos = contas_receber_result.data;
                const contas_antigas = Array.isArray(dados_antigos) ? dados_antigos : Object.values(dados_antigos || {});
                
                if (contas_antigas.length > 0) {
                    console.log(`✅ Encontradas ${contas_antigas.length} contas em contas_receber`);
                    
                    // Carregar contas existentes na tabela nova
                    const contas_novas_result = await window.firebaseService.loadFromFirebase('financas/receber');
                    let contas_novas = [];
                    
                    if (contas_novas_result && contas_novas_result.success && contas_novas_result.data) {
                        const dados_novos = contas_novas_result.data;
                        contas_novas = Array.isArray(dados_novos) ? dados_novos : Object.values(dados_novos || {});
                    }
                    
                    // Mesclar contas (evitar duplicatas por ID)
                    const ids_existentes = new Set(contas_novas.map(c => c.id));
                    const contas_para_adicionar = contas_antigas.filter(c => c && c.id && !ids_existentes.has(c.id));
                    
                    if (contas_para_adicionar.length > 0) {
                        let ok = 0;
                        for (const conta of contas_para_adicionar) {
                            const payload = { ...conta };
                            Object.keys(payload).forEach(k => { if (payload[k] === undefined) delete payload[k]; });
                            const res = await window.firebaseService.saveToFirebase('financas/receber', String(payload.id), payload);
                            if (res && res.success) { ok++; migrados++; }
                        }
                        console.log(`✅ Migradas ${ok} contas de contas_receber para contasReceber (por registro)`);
                    } else {
                        console.log('ℹ️ Todas as contas de contas_receber já estão em contasReceber');
                    }
                } else {
                    console.log('ℹ️ Nenhuma conta encontrada em contas_receber');
                }
            } else {
                console.log('ℹ️ Tabela contas_receber não existe ou está vazia');
            }
        } catch (error) {
            console.warn('⚠️ Erro ao migrar contas_receber:', error.message);
            erros++;
        }
        
        // ========================================
        // MIGRAÇÃO 2: contasreceber → contasReceber
        // ========================================
        console.log('\n📥 Verificando contasreceber...');
        try {
            const contasreceber_result = await window.firebaseService.loadFromFirebase('contasreceber');
            
            if (contasreceber_result && contasreceber_result.success && contasreceber_result.data) {
                const dados_antigos = contasreceber_result.data;
                const contas_antigas = Array.isArray(dados_antigos) ? dados_antigos : Object.values(dados_antigos || {});
                
                if (contas_antigas.length > 0) {
                    console.log(`✅ Encontradas ${contas_antigas.length} contas em contasreceber`);
                    
                    // Carregar contas existentes na tabela nova
                    const contas_novas_result = await window.firebaseService.loadFromFirebase('financas/receber');
                    let contas_novas = [];
                    
                    if (contas_novas_result && contas_novas_result.success && contas_novas_result.data) {
                        const dados_novos = contas_novas_result.data;
                        contas_novas = Array.isArray(dados_novos) ? dados_novos : Object.values(dados_novos || {});
                    }
                    
                    // Mesclar contas (evitar duplicatas por ID)
                    const ids_existentes = new Set(contas_novas.map(c => c.id));
                    const contas_para_adicionar = contas_antigas.filter(c => c && c.id && !ids_existentes.has(c.id));
                    
                    if (contas_para_adicionar.length > 0) {
                        let ok2 = 0;
                        for (const conta of contas_para_adicionar) {
                            const payload = { ...conta };
                            Object.keys(payload).forEach(k => { if (payload[k] === undefined) delete payload[k]; });
                            const res = await window.firebaseService.saveToFirebase('financas/receber', String(payload.id), payload);
                            if (res && res.success) { ok2++; migrados++; }
                        }
                        console.log(`✅ Migradas ${ok2} contas de contasreceber para contasReceber (por registro)`);
                    } else {
                        console.log('ℹ️ Todas as contas de contasreceber já estão em contasReceber');
                    }
                } else {
                    console.log('ℹ️ Nenhuma conta encontrada em contasreceber');
                }
            } else {
                console.log('ℹ️ Tabela contasreceber não existe ou está vazia');
            }
        } catch (error) {
            console.warn('⚠️ Erro ao migrar contasreceber:', error.message);
            erros++;
        }
        
        // ========================================
        // MIGRAÇÃO 3: contas_pagar → contasPagar
        // ========================================
        console.log('\n📥 Verificando contas_pagar...');
        try {
            const contas_pagar_result = await window.firebaseService.loadFromFirebase('contas_pagar');
            
            if (contas_pagar_result && contas_pagar_result.success && contas_pagar_result.data) {
                const dados_antigos = contas_pagar_result.data;
                const contas_antigas = Array.isArray(dados_antigos) ? dados_antigos : Object.values(dados_antigos || {});
                
                if (contas_antigas.length > 0) {
                    console.log(`✅ Encontradas ${contas_antigas.length} contas em contas_pagar`);
                    
                    // Carregar contas existentes na tabela nova
                    const contas_novas_result = await window.firebaseService.loadFromFirebase('financas/pagar');
                    let contas_novas = [];
                    
                    if (contas_novas_result && contas_novas_result.success && contas_novas_result.data) {
                        const dados_novos = contas_novas_result.data;
                        contas_novas = Array.isArray(dados_novos) ? dados_novos : Object.values(dados_novos || {});
                    }
                    
                    // Mesclar contas (evitar duplicatas por ID)
                    const ids_existentes = new Set(contas_novas.map(c => c.id));
                    const contas_para_adicionar = contas_antigas.filter(c => c && c.id && !ids_existentes.has(c.id));
                    
                    if (contas_para_adicionar.length > 0) {
                        let ok3 = 0;
                        for (const conta of contas_para_adicionar) {
                            const payload = { ...conta };
                            Object.keys(payload).forEach(k => { if (payload[k] === undefined) delete payload[k]; });
                            const res = await window.firebaseService.saveToFirebase('financas/pagar', String(payload.id), payload);
                            if (res && res.success) { ok3++; migrados++; }
                        }
                        console.log(`✅ Migradas ${ok3} contas de contas_pagar para contasPagar (por registro)`);
                    } else {
                        console.log('ℹ️ Todas as contas de contas_pagar já estão em contasPagar');
                    }
                } else {
                    console.log('ℹ️ Nenhuma conta encontrada em contas_pagar');
                }
            } else {
                console.log('ℹ️ Tabela contas_pagar não existe ou está vazia');
            }
        } catch (error) {
            console.warn('⚠️ Erro ao migrar contas_pagar:', error.message);
            erros++;
        }
        
        // ========================================
        // MIGRAÇÃO 4: contaspagar → contasPagar
        // ========================================
        console.log('\n📥 Verificando contaspagar...');
        try {
            const contaspagar_result = await window.firebaseService.loadFromFirebase('contaspagar');
            
            if (contaspagar_result && contaspagar_result.success && contaspagar_result.data) {
                const dados_antigos = contaspagar_result.data;
                const contas_antigas = Array.isArray(dados_antigos) ? dados_antigos : Object.values(dados_antigos || {});
                
                if (contas_antigas.length > 0) {
                    console.log(`✅ Encontradas ${contas_antigas.length} contas em contaspagar`);
                    
                    // Carregar contas existentes na tabela nova
                    const contas_novas_result = await window.firebaseService.loadFromFirebase('financas/pagar');
                    let contas_novas = [];
                    
                    if (contas_novas_result && contas_novas_result.success && contas_novas_result.data) {
                        const dados_novos = contas_novas_result.data;
                        contas_novas = Array.isArray(dados_novos) ? dados_novos : Object.values(dados_novos || {});
                    }
                    
                    // Mesclar contas (evitar duplicatas por ID)
                    const ids_existentes = new Set(contas_novas.map(c => c.id));
                    const contas_para_adicionar = contas_antigas.filter(c => c && c.id && !ids_existentes.has(c.id));
                    
                    if (contas_para_adicionar.length > 0) {
                        let ok4 = 0;
                        for (const conta of contas_para_adicionar) {
                            const payload = { ...conta };
                            Object.keys(payload).forEach(k => { if (payload[k] === undefined) delete payload[k]; });
                            const res = await window.firebaseService.saveToFirebase('financas/pagar', String(payload.id), payload);
                            if (res && res.success) { ok4++; migrados++; }
                        }
                        console.log(`✅ Migradas ${ok4} contas de contaspagar para contasPagar (por registro)`);
                    } else {
                        console.log('ℹ️ Todas as contas de contaspagar já estão em contasPagar');
                    }
                } else {
                    console.log('ℹ️ Nenhuma conta encontrada em contaspagar');
                }
            } else {
                console.log('ℹ️ Tabela contaspagar não existe ou está vazia');
            }
        } catch (error) {
            console.warn('⚠️ Erro ao migrar contaspagar:', error.message);
            erros++;
        }
        
        // ========================================
        // RESUMO
        // ========================================
        console.log('\n📊 === RESUMO DA MIGRAÇÃO ===');
        console.log(`✅ Contas migradas: ${migrados}`);
        console.log(`⚠️ Erros encontrados: ${erros}`);
        console.log('\n✅ Migração concluída!');
        console.log('\n⚠️ PRÓXIMO PASSO: Verifique os dados no Firebase Console e, se estiver tudo correto,');
        console.log('   você pode executar: limparTabelasAntigas() para remover as tabelas duplicadas.');
        
        return {
            success: true,
            migrados: migrados,
            erros: erros
        };
        
    } catch (error) {
        console.error('❌ Erro crítico na migração:', error);
        return {
            success: false,
            error: error.message
        };
    }
}

/**
 * Limpar tabelas antigas (após confirmar que a migração foi bem-sucedida)
 * ⚠️ ATENÇÃO: Esta função REMOVE as tabelas antigas. Execute apenas após confirmar que a migração foi 100% bem-sucedida.
 */
async function limparTabelasAntigas() {
    const confirmar = confirm(
        '⚠️ ATENÇÃO: Esta operação irá REMOVER as tabelas antigas do Firebase.\n\n' +
        'Certifique-se de que:\n' +
        '1. A migração foi executada com sucesso\n' +
        '2. Todos os dados foram verificados na tabela unificada\n' +
        '3. Você fez backup dos dados\n\n' +
        'Deseja continuar?'
    );
    
    if (!confirmar) {
        console.log('❌ Operação cancelada pelo usuário');
        return { success: false, cancelled: true };
    }
    
    try {
        console.log('🗑️ Removendo tabelas antigas...');
        
        // Função auxiliar para deletar usando método disponível
        const deletarTabela = async (nomeTabela) => {
            if (window.firebaseService && window.firebaseService.deleteFromFirebase) {
                return await window.firebaseService.deleteFromFirebase(nomeTabela);
            } else if (window.firebaseService && window.firebaseService.removeFromFirebase) {
                return await window.firebaseService.removeFromFirebase(nomeTabela);
            } else if (window.firebaseService && window.firebaseService.saveToFirebase) {
                // Se não houver método delete, salvar array vazio (limpar)
                return await window.firebaseService.saveToFirebase(nomeTabela, null, []);
            } else {
                throw new Error('Nenhum método de remoção disponível');
            }
        };
        
        // Remover contas_receber
        try {
            const result1 = await deletarTabela('contas_receber');
            if (result1 && result1.success !== false) {
                console.log('✅ Tabela contas_receber removida');
            } else {
                console.warn('⚠️ Erro ao remover contas_receber:', result1?.error || 'Erro desconhecido');
            }
        } catch (error) {
            console.warn('⚠️ Erro ao remover contas_receber:', error.message);
        }
        
        // Remover contasreceber
        try {
            const result2 = await deletarTabela('contasreceber');
            if (result2 && result2.success !== false) {
                console.log('✅ Tabela contasreceber removida');
            } else {
                console.warn('⚠️ Erro ao remover contasreceber:', result2?.error || 'Erro desconhecido');
            }
        } catch (error) {
            console.warn('⚠️ Erro ao remover contasreceber:', error.message);
        }
        
        // Remover contas_pagar
        try {
            const result3 = await deletarTabela('contas_pagar');
            if (result3 && result3.success !== false) {
                console.log('✅ Tabela contas_pagar removida');
            } else {
                console.warn('⚠️ Erro ao remover contas_pagar:', result3?.error || 'Erro desconhecido');
            }
        } catch (error) {
            console.warn('⚠️ Erro ao remover contas_pagar:', error.message);
        }
        
        // Remover contaspagar
        try {
            const result4 = await deletarTabela('contaspagar');
            if (result4 && result4.success !== false) {
                console.log('✅ Tabela contaspagar removida');
            } else {
                console.warn('⚠️ Erro ao remover contaspagar:', result4?.error || 'Erro desconhecido');
            }
        } catch (error) {
            console.warn('⚠️ Erro ao remover contaspagar:', error.message);
        }
        
        console.log('\n✅ Limpeza concluída!');
        return { success: true };
        
    } catch (error) {
        console.error('❌ Erro ao limpar tabelas antigas:', error);
        return { success: false, error: error.message };
    }
}

// Disponibilizar funções globalmente
window.migrarTabelasContas = migrarTabelasContas;
window.limparTabelasAntigas = limparTabelasAntigas;

console.log('✅ Script de migração carregado!');
console.log('📝 Para executar: migrarTabelasContas()');
console.log('🗑️ Para limpar tabelas antigas (após confirmação): limparTabelasAntigas()');

