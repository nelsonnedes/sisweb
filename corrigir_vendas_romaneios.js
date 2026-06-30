// Script para Corrigir Problema Específico dos Romaneios PCT no Vendas.html
console.log('🔧 Iniciando correção específica para vendas.html...');

function persistLocalValue(key, data) {
    try {
        if (window.SiswebStorage && typeof window.SiswebStorage.write === 'function') {
            return window.SiswebStorage.write(key, data) !== false;
        }
    } catch (_) {}
    localStorage.setItem(key, JSON.stringify(data));
    return true;
}

// Função para verificar se estamos na página de vendas
function verificarPaginaVendas() {
    const tipoRomaneio = document.getElementById('tipoRomaneio');
    const romaneioSelect = document.getElementById('romaneioSelect');
    
    if (!tipoRomaneio || !romaneioSelect) {
        console.warn('⚠️ Elementos não encontrados - não estamos na página de vendas');
        return false;
    }
    
    console.log('✅ Página de vendas detectada');
    return true;
}

function getRomaneioRecencyTimestampCorrecaoVendas(romaneio) {
    if (!romaneio || typeof romaneio !== 'object') return 0;
    const candidates = [
        romaneio._metadata && romaneio._metadata.lastUpdated,
        romaneio.updatedAt,
        romaneio.updated,
        romaneio.lastModified,
        romaneio.dataEmissao,
        romaneio.data,
        romaneio.dataHora,
        romaneio.dataCriacao,
        romaneio.createdAt,
        romaneio.created,
        romaneio.timestamp
    ];
    for (const candidate of candidates) {
        if (!candidate) continue;
        const ts = typeof candidate === 'number' ? candidate : Date.parse(candidate);
        if (!isNaN(ts)) return ts;
    }
    const id = String(romaneio.id || romaneio.romaneioId || romaneio.firebaseKey || romaneio.key || romaneio.numero || romaneio.numeroRomaneio || '');
    const match = id.match(/(\d{10,})/);
    return match ? Number(match[1]) || 0 : 0;
}

function formatRomaneioDataCorrecaoVendas(romaneio) {
    const raw = romaneio && (romaneio.dataEmissao || romaneio.data || romaneio.dataHora || romaneio.createdAt || romaneio.created || romaneio.timestamp);
    if (!raw) return 'S/Data';
    const dt = new Date(raw);
    return isNaN(dt.getTime()) ? 'S/Data' : dt.toLocaleDateString('pt-BR');
}

// Função para forçar reload dos romaneios PCT
async function forcarReloadRomaneiosPct() {
    console.log('\n🔄 FORÇANDO RELOAD DOS ROMANEIOS PCT');
    console.log('====================================');
    
    if (!verificarPaginaVendas()) {
        return false;
    }
    
    const tipoRomaneio = document.getElementById('tipoRomaneio');
    const romaneioSelect = document.getElementById('romaneioSelect');
    
    try {
        // 1. Limpar select atual
        romaneioSelect.innerHTML = '<option value="">Selecione um romaneio</option>';
        console.log('Select limpo');
        
        // 2. Definir tipo como romaneiosPct
        tipoRomaneio.value = 'romaneiosPct';
        console.log('Tipo definido como romaneiosPct');
        
        // 3. Carregar dados diretamente do localStorage
        const dadosLocalStorage = localStorage.getItem('romaneiosPct');
        
        if (!dadosLocalStorage) {
            console.error('❌ Dados romaneiosPct não encontrados no localStorage');
            return false;
        }
        
        const romaneios = JSON.parse(dadosLocalStorage);
        console.log(`📊 Dados carregados: ${romaneios.length} romaneios`);
        
        if (!Array.isArray(romaneios) || romaneios.length === 0) {
            console.warn('⚠️ Dados inválidos ou vazios');
            return false;
        }
        
        // 4. Adicionar cada romaneio manualmente, mais recentes primeiro
        const romaneiosOrdenados = romaneios.slice().sort((a, b) => getRomaneioRecencyTimestampCorrecaoVendas(b) - getRomaneioRecencyTimestampCorrecaoVendas(a));
        romaneiosOrdenados.forEach((romaneio, index) => {
            const option = document.createElement('option');
            option.value = index;
            
            // Extrair informações do romaneio
            const data = formatRomaneioDataCorrecaoVendas(romaneio);
            
            let cliente = 'Cliente não informado';
            if (romaneio.cliente && romaneio.cliente.nome) {
                cliente = romaneio.cliente.nome;
            } else if (romaneio.clienteNome) {
                cliente = romaneio.clienteNome;
            }
            
            let volume = '0,000';
            if (romaneio.totalVolume) {
                volume = romaneio.totalVolume.toFixed(3).replace('.', ',');
            } else if (romaneio.volumeTotal) {
                volume = romaneio.volumeTotal.toFixed(3).replace('.', ',');
            }
            
            option.textContent = `${data} - ${cliente} - ${volume} m³`;
            romaneioSelect.appendChild(option);
            
            console.log(`✅ Adicionado: ${option.textContent}`);
        });
        
        console.log(`🎉 Sucesso! ${romaneios.length} romaneios PCT carregados`);
        return true;
        
    } catch (error) {
        console.error('❌ Erro no reload forçado:', error);
        return false;
    }
}

// Função para substituir a função original carregarRomaneiosPorTipo
function substituirFuncaoCarregamento() {
    console.log('\n🔄 SUBSTITUINDO FUNÇÃO DE CARREGAMENTO');
    console.log('======================================');
    
    // Backup da função original
    if (window.carregarRomaneiosPorTipo) {
        window.carregarRomaneiosPorTipo_original = window.carregarRomaneiosPorTipo;
        console.log('✅ Backup da função original criado');
    }
    
    // Nova função melhorada
    window.carregarRomaneiosPorTipo = async function() {
        const tipoSelecionado = document.getElementById('tipoRomaneio').value;
        const selectRomaneio = document.getElementById('romaneioSelect');
        
        console.log(`🚀 Nova função chamada para: ${tipoSelecionado}`);
        
        // Limpar select
        selectRomaneio.innerHTML = '<option value="">Selecione um romaneio</option>';
        
        if (!tipoSelecionado) {
            console.log('Nenhum tipo selecionado');
            return;
        }
        
        try {
            // Carregar dados do localStorage com logs detalhados
            console.log(`Carregando ${tipoSelecionado} do localStorage...`);
            const dadosRaw = localStorage.getItem(tipoSelecionado);
            
            if (!dadosRaw) {
                console.warn(`❌ Nenhum dado encontrado para ${tipoSelecionado}`);
                return;
            }
            
            const romaneios = JSON.parse(dadosRaw);
            console.log(`✅ Dados parseados: ${romaneios.length} itens`);
            
            if (!Array.isArray(romaneios)) {
                console.error(`❌ Dados não são array: ${typeof romaneios}`);
                return;
            }
            
            if (romaneios.length === 0) {
                console.warn(`⚠️ Array vazio para ${tipoSelecionado}`);
                return;
            }
            
            // Processar cada romaneio, mais recentes primeiro
            const romaneiosOrdenados = romaneios.slice().sort((a, b) => getRomaneioRecencyTimestampCorrecaoVendas(b) - getRomaneioRecencyTimestampCorrecaoVendas(a));
            romaneiosOrdenados.forEach((romaneio, index) => {
                const option = document.createElement('option');
                option.value = index;
                
                // Extrair dados com verificações
                let data = formatRomaneioDataCorrecaoVendas(romaneio);
                
                let cliente = 'Cliente não informado';
                if (romaneio.cliente) {
                    cliente = romaneio.cliente.nome || romaneio.cliente.name || 'Nome não encontrado';
                } else if (romaneio.clienteNome) {
                    cliente = romaneio.clienteNome;
                } else if (romaneio.transportador) {
                    cliente = romaneio.transportador.nome || romaneio.transportador.name || 'Transportador';
                }
                
                let volume = '0,000';
                if (romaneio.volumeTotal || romaneio.totalVolume) {
                    const vol = romaneio.volumeTotal || romaneio.totalVolume;
                    volume = parseFloat(vol).toFixed(3).replace('.', ',');
                } else if (romaneio.totais && romaneio.totais.volume) {
                    volume = parseFloat(romaneio.totais.volume).toFixed(3).replace('.', ',');
                }
                
                option.textContent = `${data} - ${cliente} - ${volume} m³`;
                selectRomaneio.appendChild(option);
                
                console.log(`➕ Romaneio ${index + 1} adicionado: ${option.textContent}`);
            });
            
            console.log(`🎉 Carregamento concluído: ${romaneios.length} romaneios de ${tipoSelecionado}`);
            
        } catch (error) {
            console.error(`❌ Erro ao carregar ${tipoSelecionado}:`, error);
            alert(`Erro ao carregar romaneios: ${error.message}`);
        }
    };
    
    console.log('✅ Função substituída com sucesso');
}

// Função para verificar e corrigir dados corrompidos
function verificarCorrigirDados() {
    console.log('\n🔍 VERIFICANDO E CORRIGINDO DADOS');
    console.log('==================================');
    
    const tipos = ['romaneiosTL', 'romaneiosPct', 'romaneiosPes', 'romaneiosTora'];
    let problemasEncontrados = 0;
    
    tipos.forEach(tipo => {
        console.log(`\nVerificando ${tipo}:`);
        
        const dados = localStorage.getItem(tipo);
        
        if (!dados) {
            console.log(`  ⚠️ ${tipo}: Não encontrado`);
            return;
        }
        
        try {
            const romaneios = JSON.parse(dados);
            
            if (!Array.isArray(romaneios)) {
                console.log(`  ❌ ${tipo}: Não é array, corrigindo...`);
                persistLocalValue(tipo, []);
                problemasEncontrados++;
                return;
            }
            
            console.log(`  ✅ ${tipo}: ${romaneios.length} itens válidos`);
            
            // Verificar estrutura de cada item
            const romaneiosCorrigidos = romaneios.filter((item, index) => {
                if (!item || typeof item !== 'object') {
                    console.log(`  🔧 ${tipo}[${index}]: Item inválido removido`);
                    problemasEncontrados++;
                    return false;
                }
                return true;
            });
            
            if (romaneiosCorrigidos.length !== romaneios.length) {
                persistLocalValue(tipo, romaneiosCorrigidos);
                console.log(`  🔧 ${tipo}: ${romaneios.length - romaneiosCorrigidos.length} itens inválidos removidos`);
            }
            
        } catch (e) {
            console.log(`  ❌ ${tipo}: Erro JSON, limpando...`);
            persistLocalValue(tipo, []);
            problemasEncontrados++;
        }
    });
    
    console.log(`\n📊 Verificação concluída: ${problemasEncontrados} problemas corrigidos`);
    return problemasEncontrados === 0;
}

// Função para testar carregamento específico dos romaneios PCT
async function testarCarregamentoPct() {
    console.log('\n🧪 TESTE ESPECÍFICO ROMANEIOS PCT');
    console.log('==================================');
    
    // 1. Verificar dados brutos
    const dadosRaw = localStorage.getItem('romaneiosPct');
    console.log(`1. Dados brutos: ${dadosRaw ? 'Existem' : 'Não existem'}`);
    
    if (!dadosRaw) {
        console.error('❌ Nenhum dado encontrado');
        return false;
    }
    
    // 2. Tentar parse
    let romaneios;
    try {
        romaneios = JSON.parse(dadosRaw);
        console.log(`2. Parse JSON: Sucesso - ${romaneios.length} itens`);
    } catch (e) {
        console.error(`2. Parse JSON: Erro - ${e.message}`);
        return false;
    }
    
    // 3. Verificar estrutura
    if (!Array.isArray(romaneios)) {
        console.error(`3. Estrutura: Erro - não é array (${typeof romaneios})`);
        return false;
    }
    console.log(`3. Estrutura: OK - é array com ${romaneios.length} itens`);
    
    // 4. Verificar primeiro item
    if (romaneios.length > 0) {
        const primeiro = romaneios[0];
        console.log('4. Primeiro item:');
        console.log(`   - ID: ${primeiro.id || 'N/A'}`);
        console.log(`   - Data: ${primeiro.data || 'N/A'}`);
        console.log(`   - Cliente: ${primeiro.cliente?.nome || primeiro.clienteNome || 'N/A'}`);
        console.log(`   - Itens: ${primeiro.itens?.length || 0}`);
        console.log(`   - Volume: ${primeiro.totalVolume || primeiro.volumeTotal || 'N/A'}`);
    }
    
    // 5. Testar se elemento existe na página
    const tipoSelect = document.getElementById('tipoRomaneio');
    const romaneioSelect = document.getElementById('romaneioSelect');
    
    console.log(`5. Elementos página:`);
    console.log(`   - tipoRomaneio: ${tipoSelect ? 'Existe' : 'Não existe'}`);
    console.log(`   - romaneioSelect: ${romaneioSelect ? 'Existe' : 'Não existe'}`);
    
    return true;
}

// Função principal de correção para vendas
async function corrigirVendasRomaneios() {
    console.clear();
    console.log('🔧 CORREÇÃO ESPECÍFICA VENDAS - ROMANEIOS PCT');
    console.log('==============================================');
    
    // 1. Verificar se estamos na página correta
    if (!verificarPaginaVendas()) {
        console.error('❌ Não estamos na página de vendas!');
        return false;
    }
    
    // 2. Verificar e corrigir dados
    console.log('📋 Etapa 1: Verificação de dados...');
    verificarCorrigirDados();
    
    // 3. Testar carregamento específico
    console.log('\n📋 Etapa 2: Teste específico PCT...');
    const testePct = await testarCarregamentoPct();
    
    if (!testePct) {
        console.error('❌ Teste PCT falhou');
        return false;
    }
    
    // 4. Substituir função de carregamento
    console.log('\n📋 Etapa 3: Substituindo função...');
    substituirFuncaoCarregamento();
    
    // 5. Forçar reload
    console.log('\n📋 Etapa 4: Forçando reload...');
    const reloadSucesso = await forcarReloadRomaneiosPct();
    
    if (reloadSucesso) {
        console.log('\n🎉 CORREÇÃO CONCLUÍDA COM SUCESSO!');
        console.log('✅ Os romaneios PCT devem estar visíveis agora');
        
        // Instruções finais
        console.log('\n💡 INSTRUÇÕES:');
        console.log('1. Verifique se os romaneios aparecem na lista');
        console.log('2. Se não aparecerem, atualize a página');
        console.log('3. Selecione "Romaneio PCT" novamente');
        
        return true;
    } else {
        console.error('\n❌ CORREÇÃO FALHOU');
        console.log('🔧 Tente executar manualmente:');
        console.log('   - forcarReloadRomaneiosPct()');
        console.log('   - verificarCorrigirDados()');
        
        return false;
    }
}

// Função para restaurar função original
function restaurarFuncaoOriginal() {
    if (window.carregarRomaneiosPorTipo_original) {
        window.carregarRomaneiosPorTipo = window.carregarRomaneiosPorTipo_original;
        console.log('✅ Função original restaurada');
        return true;
    } else {
        console.log('⚠️ Função original não encontrada');
        return false;
    }
}

// Expor funções globalmente
window.corrigirVendasRomaneios = corrigirVendasRomaneios;
window.forcarReloadRomaneiosPct = forcarReloadRomaneiosPct;
window.substituirFuncaoCarregamento = substituirFuncaoCarregamento;
window.verificarCorrigirDados = verificarCorrigirDados;
window.testarCarregamentoPct = testarCarregamentoPct;
window.verificarPaginaVendas = verificarPaginaVendas;
window.restaurarFuncaoOriginal = restaurarFuncaoOriginal;

console.log('🔧 Script de correção para vendas carregado!');
console.log('📋 Execute: corrigirVendasRomaneios() para corrigir o problema');
console.log('🔄 Execute: forcarReloadRomaneiosPct() para forçar reload apenas dos PCT'); 
