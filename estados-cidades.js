/*
 * Estados e Cidades do Brasil - Arquivo Local
 * Última atualização: 2024-01-15
 * Versão: 1.0.0
 * Função: Eliminar dependência da API IBGE
 */

console.log("🏙️ Carregando módulo de Estados e Cidades do Brasil...");

// ✅ FUNÇÃO PARA CARREGAR ESTADOS E CIDADES DO ARQUIVO LOCAL
async function carregarEstadosCidadesLocal() {
    console.log("📋 Carregando estados e cidades do arquivo local...");
    
    try {
        // Tentar carregar do arquivo JSON local
        const response = await fetch('./estados-cidades.json');
        
        if (!response.ok) {
            throw new Error(`Erro HTTP: ${response.status}`);
        }
        
        const estadosCidades = await response.json();
        console.log("✅ Estados e cidades carregados do arquivo local");
        console.log(`📊 Total de estados: ${Object.keys(estadosCidades).length}`);
        
        // Armazenar em cache global
        window.estadosCidadesBrasil = estadosCidades;
        
        return estadosCidades;
        
    } catch (error) {
        console.error("❌ Erro ao carregar arquivo local de estados e cidades:", error);
        
        // ✅ FALLBACK HARDCODED MÍNIMO
        console.log("🔄 Usando fallback hardcoded básico...");
        
        const fallbackBasico = {
            'PA': ['Belém', 'Ananindeua', 'Santarém', 'Marabá', 'Parauapebas', 'Castanhal', 'Curionópolis', 'Altamira', 'Itaituba', 'Tucuruí'],
            'SP': ['São Paulo', 'Guarulhos', 'Campinas', 'São Bernardo do Campo', 'Santo André', 'Osasco', 'Ribeirão Preto', 'Sorocaba'],
            'RJ': ['Rio de Janeiro', 'São Gonçalo', 'Duque de Caxias', 'Nova Iguaçu', 'Niterói', 'Campos dos Goytacazes'],
            'MG': ['Belo Horizonte', 'Uberlândia', 'Contagem', 'Juiz de Fora', 'Betim', 'Montes Claros'],
            'RS': ['Porto Alegre', 'Caxias do Sul', 'Pelotas', 'Canoas', 'Santa Maria', 'Gravataí'],
            'PR': ['Curitiba', 'Londrina', 'Maringá', 'Ponta Grossa', 'Cascavel', 'São José dos Pinhais'],
            'BA': ['Salvador', 'Feira de Santana', 'Vitória da Conquista', 'Camaçari', 'Itabuna', 'Juazeiro'],
            'SC': ['Florianópolis', 'Joinville', 'Blumenau', 'São José', 'Chapecó', 'Criciúma'],
            'GO': ['Goiânia', 'Aparecida de Goiânia', 'Anápolis', 'Rio Verde', 'Luziânia', 'Águas Lindas de Goiás'],
            'CE': ['Fortaleza', 'Caucaia', 'Juazeiro do Norte', 'Maracanaú', 'Sobral', 'Crato']
        };
        
        window.estadosCidadesBrasil = fallbackBasico;
        return fallbackBasico;
    }
}

// ✅ FUNÇÃO MELHORADA PARA CARREGAR CIDADES POR ESTADO (SEM API IBGE)
async function carregarCidadesPorEstadoLocal(estado, cidadeSelectId = 'clientCity') {
    console.log(`🏙️ === CARREGAMENTO LOCAL DE CIDADES PARA ${estado} ===`);
    
    const cidadeSelect = document.getElementById(cidadeSelectId);
    if (!cidadeSelect) {
        console.error(`❌ Elemento select '${cidadeSelectId}' não encontrado`);
        return;
    }
    
    if (!estado || estado.trim() === '') {
        cidadeSelect.innerHTML = '<option value="">Selecione primeiro o estado</option>';
        return;
    }
    
    try {
        cidadeSelect.innerHTML = '<option value="">⏳ Carregando cidades...</option>';
        cidadeSelect.disabled = true;
        
        // ✅ CARREGAR DADOS DOS ESTADOS E CIDADES
        let estadosCidades = window.estadosCidadesBrasil;
        
        if (!estadosCidades) {
            console.log("📋 Cache não encontrado, carregando estados e cidades...");
            estadosCidades = await carregarEstadosCidadesLocal();
        }
        
        const cidades = estadosCidades[estado];
        
        if (!cidades || !Array.isArray(cidades) || cidades.length === 0) {
            console.warn(`⚠️ Nenhuma cidade encontrada para o estado ${estado}`);
            cidadeSelect.innerHTML = `<option value="">Nenhuma cidade encontrada para ${estado}</option>`;
            return;
        }
        
        console.log(`✅ ${cidades.length} cidades encontradas para ${estado}`);
        
        // Ordenar cidades alfabeticamente
        const cidadesOrdenadas = [...cidades].sort((a, b) => a.localeCompare(b, 'pt-BR'));
        
        // Limpar e popular o select
        cidadeSelect.innerHTML = '<option value="">Selecione uma cidade</option>';
        
        cidadesOrdenadas.forEach(cidade => {
            const option = document.createElement('option');
            option.value = cidade;
            option.textContent = cidade;
            cidadeSelect.appendChild(option);
        });
        
        console.log(`✅ Select populado com ${cidadesOrdenadas.length} cidades para ${estado}`);
        
        // Log especial para PA com Curionópolis
        if (estado === 'PA' && cidades.includes('Curionópolis')) {
            console.log("🎉 Curionópolis CONFIRMADA na lista do Pará!");
        }
        
        // Log das primeiras cidades para verificação
        console.log(`📝 Primeiras cidades de ${estado}:`, cidadesOrdenadas.slice(0, 5).join(', '));
        
    } catch (error) {
        console.error(`❌ Erro crítico ao carregar cidades para ${estado}:`, error);
        cidadeSelect.innerHTML = '<option value="">Erro ao carregar cidades</option>';
        
    } finally {
        cidadeSelect.disabled = false;
        console.log(`🏁 Carregamento de cidades finalizado para ${estado}`);
    }
}

// ✅ FUNÇÃO PARA OBTER LISTA DE ESTADOS
function obterListaEstados() {
    const estados = [
        { sigla: 'AC', nome: 'Acre' },
        { sigla: 'AL', nome: 'Alagoas' },
        { sigla: 'AP', nome: 'Amapá' },
        { sigla: 'AM', nome: 'Amazonas' },
        { sigla: 'BA', nome: 'Bahia' },
        { sigla: 'CE', nome: 'Ceará' },
        { sigla: 'DF', nome: 'Distrito Federal' },
        { sigla: 'ES', nome: 'Espírito Santo' },
        { sigla: 'GO', nome: 'Goiás' },
        { sigla: 'MA', nome: 'Maranhão' },
        { sigla: 'MT', nome: 'Mato Grosso' },
        { sigla: 'MS', nome: 'Mato Grosso do Sul' },
        { sigla: 'MG', nome: 'Minas Gerais' },
        { sigla: 'PA', nome: 'Pará' },
        { sigla: 'PB', nome: 'Paraíba' },
        { sigla: 'PR', nome: 'Paraná' },
        { sigla: 'PE', nome: 'Pernambuco' },
        { sigla: 'PI', nome: 'Piauí' },
        { sigla: 'RJ', nome: 'Rio de Janeiro' },
        { sigla: 'RN', nome: 'Rio Grande do Norte' },
        { sigla: 'RS', nome: 'Rio Grande do Sul' },
        { sigla: 'RO', nome: 'Rondônia' },
        { sigla: 'RR', nome: 'Roraima' },
        { sigla: 'SC', nome: 'Santa Catarina' },
        { sigla: 'SP', nome: 'São Paulo' },
        { sigla: 'SE', nome: 'Sergipe' },
        { sigla: 'TO', nome: 'Tocantins' }
    ];
    
    return estados;
}

// ✅ FUNÇÃO PARA POPULAR SELECT DE ESTADOS
function popularSelectEstados(estadoSelectId = 'clientState') {
    console.log(`🗺️ Populando select de estados: ${estadoSelectId}`);
    
    const estadoSelect = document.getElementById(estadoSelectId);
    if (!estadoSelect) {
        console.error(`❌ Elemento select '${estadoSelectId}' não encontrado`);
        return;
    }
    
    const estados = obterListaEstados();
    
    // Limpar e adicionar opção padrão
    estadoSelect.innerHTML = '<option value="">Selecione o estado</option>';
    
    // Adicionar cada estado
    estados.forEach(estado => {
        const option = document.createElement('option');
        option.value = estado.sigla;
        option.textContent = `${estado.sigla} - ${estado.nome}`;
        estadoSelect.appendChild(option);
    });
    
    console.log(`✅ Select de estados populado com ${estados.length} estados`);
}

// ✅ FUNÇÃO DE INICIALIZAÇÃO AUTOMÁTICA
async function inicializarEstadosCidades() {
    console.log("🚀 Inicializando sistema de Estados e Cidades...");
    
    try {
        // Carregar dados em cache
        await carregarEstadosCidadesLocal();
        
        // Popular select de estados se existir
        const estadoSelect = document.getElementById('clientState');
        if (estadoSelect && estadoSelect.options.length <= 1) {
            popularSelectEstados();
            
            // Adicionar evento de mudança de estado
            estadoSelect.addEventListener('change', function() {
                const estadoSelecionado = this.value;
                if (estadoSelecionado) {
                    carregarCidadesPorEstadoLocal(estadoSelecionado, 'clientCity');
                } else {
                    const cidadeSelect = document.getElementById('clientCity');
                    if (cidadeSelect) {
                        cidadeSelect.innerHTML = '<option value="">Selecione primeiro o estado</option>';
                    }
                }
            });
            
            console.log("✅ Event listener adicionado ao select de estados");
        }
        
        console.log("🎉 Sistema de Estados e Cidades inicializado com sucesso!");
        
    } catch (error) {
        console.error("❌ Erro na inicialização do sistema de Estados e Cidades:", error);
    }
}

// ✅ EXPOR FUNÇÕES GLOBALMENTE
if (typeof window !== 'undefined') {
    window.carregarEstadosCidadesLocal = carregarEstadosCidadesLocal;
    window.carregarCidadesPorEstadoLocal = carregarCidadesPorEstadoLocal;
    window.obterListaEstados = obterListaEstados;
    window.popularSelectEstados = popularSelectEstados;
    window.inicializarEstadosCidades = inicializarEstadosCidades;
    
    // ✅ OVERRIDE DA FUNÇÃO ANTIGA PARA USAR A NOVA
    window.carregarCidadesPorEstado = carregarCidadesPorEstadoLocal;
    
    console.log("✅ Funções de Estados e Cidades expostas globalmente");
    
    // ✅ INICIALIZAÇÃO AUTOMÁTICA QUANDO DOM ESTIVER PRONTO
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', inicializarEstadosCidades);
    } else {
        // DOM já está pronto
        setTimeout(inicializarEstadosCidades, 500);
    }
}

console.log("🏙️ Módulo de Estados e Cidades carregado com sucesso!"); 