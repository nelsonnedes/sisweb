// correcao-dados-firebase.js - v3.4
// Script para corrigir dados malformados no Firebase

console.log('🔧 Iniciando correção de dados Firebase v3.4...');

// Sistema de correção de dados Firebase
window.correcaoFirebase = {
    obterTenantId() {
        try {
            const svc = window.firebaseService || window.FirebaseService || window.firebaseServiceTL;
            if (svc && typeof svc.getTenantId === 'function') return svc.getTenantId();
            if (svc && typeof svc.getCurrentTenantId === 'function') return svc.getCurrentTenantId();
        } catch (_) {}
        try {
            if (window.appTenantId) return window.appTenantId;
            const raw = localStorage.getItem('company_info');
            if (raw) {
                const obj = JSON.parse(raw);
                return obj && (obj.companyId || obj.companyID || obj.tenantId || obj.id);
            }
        } catch (_) {}
        return null;
    },

    resolverCaminho(colecao, id) {
        const path = `${String(colecao || '').replace(/^\/+|\/+$/g, '')}/${String(id || '').replace(/^\/+|\/+$/g, '')}`;
        if (/^(companies|users|roles|system)\//.test(path)) return path;
        try {
            const svc = window.firebaseService || window.FirebaseService || window.firebaseServiceTL;
            if (svc && typeof svc.getNamespacedPath === 'function') return svc.getNamespacedPath(path);
        } catch (_) {}
        const tenant = this.obterTenantId();
        return tenant ? `companies/${tenant}/${path}` : path;
    },
    
    // Corrigir espécies com "Nome: undefined"
    async corrigirEspecies() {
        console.log('🌿 === CORRIGINDO ESPÉCIES FIREBASE ===');
        
        try {
            if (!window.firebaseService) {
                throw new Error('FirebaseService não disponível');
            }
            
            // Carregar dados atuais
            const result = await window.firebaseService.loadFromFirebase('especies');
            
            if (!result.success || !result.data) {
                console.log('⚠️ Nenhuma espécie encontrada para correção');
                return { sucesso: false, erro: 'Nenhum dado encontrado' };
            }
            
            const especies = result.data;
            let corrigidas = 0;
            let removidas = 0;
            
            console.log(`📊 Analisando ${Object.keys(especies).length} espécies...`);
            
            // Corrigir cada espécie
            for (const [id, especie] of Object.entries(especies)) {
                let precisaCorrecao = false;
                
                // Verificar se é um registro válido
                if (!especie || typeof especie !== 'object') {
                    console.log(`❌ Removendo espécie inválida: ${id}`);
                    await this.removerRegistro('especies', id);
                    removidas++;
                    continue;
                }
                
                // Correções necessárias
                const correcoes = {};
                
                // Corrigir nome undefined/vazio
                if (!especie.especie && !especie.nome && !especie.name) {
                    // Se não tem nome, tentar usar o ID como nome
                    if (id.includes('sp') || id.includes('species')) {
                        correcoes.especie = `Espécie ${id}`;
                    } else {
                        correcoes.especie = 'Espécie sem nome';
                    }
                    precisaCorrecao = true;
                } else if ((especie.name || especie.nome) && !especie.especie) {
                    correcoes.especie = especie.name || especie.nome;
                    precisaCorrecao = true;
                }
                
                // Corrigir nome científico
                if (!especie.nomeCientifico && (especie.descricao || especie.description || especie.decription)) {
                    correcoes.nomeCientifico = especie.descricao || especie.description || especie.decription || '';
                    precisaCorrecao = true;
                } else if (!especie.nomeCientifico) {
                    correcoes.nomeCientifico = '';
                    precisaCorrecao = true;
                }
                
                // Adicionar campos padrão se não existirem
                if (especie.ativo === undefined) {
                    correcoes.ativo = true;
                    precisaCorrecao = true;
                }
                
                // Aplicar correções se necessário
                if (precisaCorrecao) {
                    const especieCorrigida = {
                        id,
                        especie: correcoes.especie || especie.especie || especie.nome || especie.name || '',
                        nomeCientifico: correcoes.nomeCientifico !== undefined ? correcoes.nomeCientifico : (especie.nomeCientifico || ''),
                        ativo: correcoes.ativo !== undefined ? correcoes.ativo : especie.ativo !== false,
                        createdAt: especie.createdAt || new Date().toISOString(),
                        updatedAt: new Date().toISOString()
                    };
                    await this.atualizarRegistro('especies', id, especieCorrigida);
                    console.log(`✅ Espécie corrigida: ${id} -> ${especieCorrigida.especie}`);
                    corrigidas++;
                }
            }
            
            console.log(`✅ Correção de espécies concluída: ${corrigidas} corrigidas, ${removidas} removidas`);
            return { sucesso: true, corrigidas, removidas };
            
        } catch (error) {
            console.error('❌ Erro na correção de espécies:', error);
            return { sucesso: false, erro: error.message };
        }
    },
    
    // Corrigir clientes com "Nome: undefined"
    async corrigirClientes() {
        console.log('👥 === CORRIGINDO CLIENTES FIREBASE ===');
        
        try {
            if (!window.firebaseService) {
                throw new Error('FirebaseService não disponível');
            }
            
            const result = await window.firebaseService.loadFromFirebase('clients');
            
            if (!result.success || !result.data) {
                console.log('⚠️ Nenhum cliente encontrado para correção');
                return { sucesso: false, erro: 'Nenhum dado encontrado' };
            }
            
            const clientes = result.data;
            let corrigidos = 0;
            let removidos = 0;
            
            console.log(`📊 Analisando ${Object.keys(clientes).length} clientes...`);
            
            for (const [id, cliente] of Object.entries(clientes)) {
                let precisaCorrecao = false;
                
                if (!cliente || typeof cliente !== 'object') {
                    console.log(`❌ Removendo cliente inválido: ${id}`);
                    await this.removerRegistro('clients', id);
                    removidos++;
                    continue;
                }
                
                const correcoes = {};
                
                // Corrigir nome
                if (!cliente.nome && !cliente.name) {
                    if (id.includes('client_')) {
                        correcoes.nome = `Cliente ${id.replace('client_', '')}`;
                    } else {
                        correcoes.nome = 'Cliente sem nome';
                    }
                    precisaCorrecao = true;
                } else if (cliente.name && !cliente.nome) {
                    correcoes.nome = cliente.name;
                    precisaCorrecao = true;
                }
                
                // Corrigir email
                if (!cliente.email) {
                    correcoes.email = '';
                    precisaCorrecao = true;
                }
                
                // Corrigir telefone
                if (!cliente.telefone && !cliente.phone) {
                    correcoes.telefone = '';
                    precisaCorrecao = true;
                } else if (cliente.phone && !cliente.telefone) {
                    correcoes.telefone = cliente.phone;
                    precisaCorrecao = true;
                }
                
                // Adicionar campos padrão
                if (cliente.ativo === undefined) {
                    correcoes.ativo = true;
                    precisaCorrecao = true;
                }
                
                if (precisaCorrecao) {
                    const clienteCorrigido = { ...cliente, ...correcoes };
                    await this.atualizarRegistro('clients', id, clienteCorrigido);
                    console.log(`✅ Cliente corrigido: ${id} -> ${correcoes.nome || cliente.nome}`);
                    corrigidos++;
                }
            }
            
            console.log(`✅ Correção de clientes concluída: ${corrigidos} corrigidos, ${removidos} removidos`);
            return { sucesso: true, corrigidos, removidos };
            
        } catch (error) {
            console.error('❌ Erro na correção de clientes:', error);
            return { sucesso: false, erro: error.message };
        }
    },
    
    // Corrigir romaneios com cliente como [object Object]
    async corrigirRomaneios() {
        console.log('📋 === CORRIGINDO ROMANEIOS FIREBASE ===');
        
        try {
            if (!window.firebaseService) {
                throw new Error('FirebaseService não disponível');
            }
            
            const result = await window.firebaseService.loadFromFirebase('romaneios/tora');
            
            if (!result.success || !result.data) {
                console.log('⚠️ Nenhum romaneio encontrado para correção');
                return { sucesso: false, erro: 'Nenhum dado encontrado' };
            }
            
            const romaneios = result.data;
            let corrigidos = 0;
            
            console.log(`📊 Analisando ${Object.keys(romaneios).length} romaneios...`);
            
            for (const [id, romaneio] of Object.entries(romaneios)) {
                let precisaCorrecao = false;
                
                if (!romaneio || typeof romaneio !== 'object') {
                    continue;
                }
                
                const correcoes = {};
                
                // Corrigir cliente como objeto
                if (romaneio.cliente && typeof romaneio.cliente === 'object') {
                    if (romaneio.cliente.nome) {
                        correcoes.cliente = romaneio.cliente.nome;
                        precisaCorrecao = true;
                    } else if (romaneio.cliente.name) {
                        correcoes.cliente = romaneio.cliente.name;
                        precisaCorrecao = true;
                    } else {
                        correcoes.cliente = 'Cliente não informado';
                        precisaCorrecao = true;
                    }
                }
                
                // Corrigir número undefined
                if (!romaneio.numero) {
                    const numeroGerado = id.replace('romaneiotora', '').substring(0, 8);
                    correcoes.numero = `ROM-${numeroGerado}`;
                    precisaCorrecao = true;
                }
                
                // Corrigir total
                if (romaneio.total === undefined || romaneio.total === 0) {
                    // Calcular total se houver itens
                    if (romaneio.itens && Array.isArray(romaneio.itens)) {
                        const total = romaneio.itens.reduce((sum, item) => {
                            return sum + (item.preco * item.volumeSerraria || 0);
                        }, 0);
                        correcoes.total = total;
                        precisaCorrecao = true;
                    }
                }
                
                if (precisaCorrecao) {
                    const romaneioCorrigido = { ...romaneio, ...correcoes };
                    await this.atualizarRegistro('romaneiosTora', id, romaneioCorrigido);
                    console.log(`✅ Romaneio corrigido: ${id}`);
                    corrigidos++;
                }
            }
            
            console.log(`✅ Correção de romaneios concluída: ${corrigidos} corrigidos`);
            return { sucesso: true, corrigidos };
            
        } catch (error) {
            console.error('❌ Erro na correção de romaneios:', error);
            return { sucesso: false, erro: error.message };
        }
    },
    
    // Atualizar registro no Firebase
    async atualizarRegistro(colecao, id, dados) {
        try {
            const path = `${colecao}/${id}`;
            const svc = window.firebaseService || window.FirebaseService || window.firebaseServiceTL;
            if (svc && typeof svc.saveData === 'function') {
                const result = await svc.saveData(path, dados);
                return result && result.success !== false;
            }
            if (svc && typeof svc.saveToFirebase === 'function') {
                const result = await svc.saveToFirebase(colecao, id, dados);
                return result && result.success !== false;
            }
            const database = firebase.database();
            await database.ref(this.resolverCaminho(colecao, id)).update(dados);
            return true;
        } catch (error) {
            console.error(`❌ Erro ao atualizar ${colecao}/${id}:`, error);
            return false;
        }
    },
    
    // Remover registro do Firebase
    async removerRegistro(colecao, id) {
        try {
            const path = `${colecao}/${id}`;
            const svc = window.firebaseService || window.FirebaseService || window.firebaseServiceTL;
            if (svc && typeof svc.deleteData === 'function') {
                const result = await svc.deleteData(path);
                return result && result.success !== false;
            }
            if (svc && typeof svc.deleteFromFirebase === 'function') {
                const result = await svc.deleteFromFirebase(path);
                return result && result.success !== false;
            }
            if (svc && typeof svc.removeFromFirebase === 'function') {
                const result = await svc.removeFromFirebase(path);
                return result && result.success !== false;
            }
            const database = firebase.database();
            await database.ref(this.resolverCaminho(colecao, id)).remove();
            return true;
        } catch (error) {
            console.error(`❌ Erro ao remover ${colecao}/${id}:`, error);
            return false;
        }
    },
    
    // Executar correção completa
    async corrigirTodosDados() {
        console.log('🚀 === INICIANDO CORREÇÃO COMPLETA DOS DADOS ===');
        
        const resultados = {
            especies: await this.corrigirEspecies(),
            clientes: await this.corrigirClientes(),
            romaneios: await this.corrigirRomaneios()
        };
        
        console.log('📊 RESUMO DAS CORREÇÕES:');
        console.log('  Espécies:', resultados.especies);
        console.log('  Clientes:', resultados.clientes);
        console.log('  Romaneios:', resultados.romaneios);
        
        return resultados;
    }
};

// Aguardar Firebase estar pronto
document.addEventListener('DOMContentLoaded', () => {
    setTimeout(() => {
        if (window.firebase && window.firebaseService) {
            console.log('✅ Correção de dados Firebase pronta!');
            console.log('💡 Use: window.correcaoFirebase.corrigirTodosDados()');
        }
    }, 3000);
});

console.log('✅ Sistema de correção de dados Firebase carregado!');
