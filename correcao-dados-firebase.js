// correcao-dados-firebase.js - v3.4
// Script para corrigir dados malformados no Firebase

console.log('🔧 Iniciando correção de dados Firebase v3.4...');

// Sistema de correção de dados Firebase
window.correcaoFirebase = {
    
    // Corrigir espécies com "Nome: undefined"
    async corrigirEspecies() {
        console.log('🌿 === CORRIGINDO ESPÉCIES FIREBASE ===');
        
        try {
            if (!window.firebaseService) {
                throw new Error('FirebaseService não disponível');
            }
            
            // Carregar dados atuais
            const result = await window.firebaseService.loadFromFirebase('species');
            
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
                    await this.removerRegistro('species', id);
                    removidas++;
                    continue;
                }
                
                // Correções necessárias
                const correcoes = {};
                
                // Corrigir nome undefined/vazio
                if (!especie.nome && !especie.name) {
                    // Se não tem nome, tentar usar o ID como nome
                    if (id.includes('sp') || id.includes('species')) {
                        correcoes.nome = `Espécie ${id}`;
                    } else {
                        correcoes.nome = 'Espécie sem nome';
                    }
                    precisaCorrecao = true;
                } else if (especie.name && !especie.nome) {
                    correcoes.nome = especie.name;
                    precisaCorrecao = true;
                }
                
                // Corrigir descrição
                if (!especie.descricao && !especie.description) {
                    correcoes.descricao = '';
                    precisaCorrecao = true;
                } else if (especie.description && !especie.descricao) {
                    correcoes.descricao = especie.description;
                    precisaCorrecao = true;
                }
                
                // Adicionar campos padrão se não existirem
                if (especie.ativo === undefined) {
                    correcoes.ativo = true;
                    precisaCorrecao = true;
                }
                
                // Aplicar correções se necessário
                if (precisaCorrecao) {
                    const especieCorrigida = { ...especie, ...correcoes };
                    await this.atualizarRegistro('species', id, especieCorrigida);
                    console.log(`✅ Espécie corrigida: ${id} -> ${correcoes.nome || especie.nome}`);
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
            const database = firebase.database();
            await database.ref(`${colecao}/${id}`).update(dados);
            return true;
        } catch (error) {
            console.error(`❌ Erro ao atualizar ${colecao}/${id}:`, error);
            return false;
        }
    },
    
    // Remover registro do Firebase
    async removerRegistro(colecao, id) {
        try {
            const database = firebase.database();
            await database.ref(`${colecao}/${id}`).remove();
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