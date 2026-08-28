/**
 * cities-loader.js
 * Carregador de cidades do IBGE para uso em notas fiscais e MDF-e
 * Reutiliza a mesma lógica das páginas de romaneios
 */

// Lista de UFs brasileiras com nomes completos
const estadosBrasil = {
    'AC': 'Acre',
    'AL': 'Alagoas', 
    'AP': 'Amapá',
    'AM': 'Amazonas',
    'BA': 'Bahia',
    'CE': 'Ceará',
    'DF': 'Distrito Federal',
    'ES': 'Espírito Santo',
    'GO': 'Goiás',
    'MA': 'Maranhão',
    'MT': 'Mato Grosso',
    'MS': 'Mato Grosso do Sul',
    'MG': 'Minas Gerais',
    'PA': 'Pará',
    'PB': 'Paraíba',
    'PR': 'Paraná',
    'PE': 'Pernambuco',
    'PI': 'Piauí',
    'RJ': 'Rio de Janeiro',
    'RN': 'Rio Grande do Norte',
    'RS': 'Rio Grande do Sul',
    'RO': 'Rondônia',
    'RR': 'Roraima',
    'SC': 'Santa Catarina',
    'SP': 'São Paulo',
    'SE': 'Sergipe',
    'TO': 'Tocantins'
};

// Dados de municípios como fallback (principais cidades por estado)
const municipiosPorEstado = {
    'AC': ['Rio Branco', 'Cruzeiro do Sul', 'Sena Madureira', 'Tarauacá', 'Feijó'],
    'AL': ['Maceió', 'Arapiraca', 'Palmeira dos Índios', 'Rio Largo', 'Penedo'],
    'AP': ['Macapá', 'Santana', 'Laranjal do Jari', 'Oiapoque', 'Mazagão'],
    'AM': ['Manaus', 'Parintins', 'Itacoatiara', 'Manacapuru', 'Coari'],
    'BA': ['Salvador', 'Feira de Santana', 'Vitória da Conquista', 'Camaçari', 'Juazeiro'],
    'CE': ['Fortaleza', 'Caucaia', 'Juazeiro do Norte', 'Maracanaú', 'Sobral'],
    'DF': ['Brasília', 'Gama', 'Taguatinga', 'Ceilândia', 'Sobradinho'],
    'ES': ['Vitória', 'Vila Velha', 'Serra', 'Cariacica', 'Cachoeiro de Itapemirim'],
    'GO': ['Goiânia', 'Aparecida de Goiânia', 'Anápolis', 'Rio Verde', 'Luziânia'],
    'MA': ['São Luís', 'Imperatriz', 'São José de Ribamar', 'Timon', 'Caxias'],
    'MT': ['Cuiabá', 'Várzea Grande', 'Rondonópolis', 'Sinop', 'Tangará da Serra'],
    'MS': ['Campo Grande', 'Dourados', 'Três Lagoas', 'Corumbá', 'Ponta Porã'],
    'MG': ['Belo Horizonte', 'Uberlândia', 'Contagem', 'Juiz de Fora', 'Betim'],
    'PA': ['Belém', 'Ananindeua', 'Santarém', 'Marabá', 'São Miguel do Guamá'],
    'PB': ['João Pessoa', 'Campina Grande', 'Santa Rita', 'Patos', 'Bayeux'],
    'PR': ['Curitiba', 'Londrina', 'Maringá', 'Ponta Grossa', 'Cascavel'],
    'PE': ['Recife', 'Jaboatão dos Guararapes', 'Olinda', 'Caruaru', 'Petrolina'],
    'PI': ['Teresina', 'Parnaíba', 'Picos', 'Piripiri', 'Floriano'],
    'RJ': ['Rio de Janeiro', 'São Gonçalo', 'Duque de Caxias', 'Nova Iguaçu', 'Niterói'],
    'RN': ['Natal', 'Mossoró', 'Parnamirim', 'São Gonçalo do Amarante', 'Macaíba'],
    'RS': ['Porto Alegre', 'Caxias do Sul', 'Pelotas', 'Canoas', 'Santa Maria'],
    'RO': ['Porto Velho', 'Ji-Paraná', 'Ariquemes', 'Vilhena', 'Cacoal'],
    'RR': ['Boa Vista', 'Rorainópolis', 'Caracaraí', 'Alto Alegre', 'Mucajaí'],
    'SC': ['Florianópolis', 'Joinville', 'Blumenau', 'São José', 'Criciúma'],
    'SP': ['São Paulo', 'Guarulhos', 'Campinas', 'São Bernardo do Campo', 'Santo André'],
    'SE': ['Aracaju', 'Nossa Senhora do Socorro', 'Lagarto', 'Itabaiana', 'Estância'],
    'TO': ['Palmas', 'Araguaína', 'Gurupi', 'Porto Nacional', 'Paraíso do Tocantins']
};

/**
 * Carrega cidades do IBGE para um estado específico
 * @param {string} uf - Sigla do estado (ex: 'SP', 'RJ')
 * @returns {Promise<string[]>} Array com nomes das cidades
 */
async function carregarCidadesDoIBGE(uf) {
    try {
        console.log(`🌐 Carregando cidades do IBGE para ${uf}...`);
        
        const response = await fetch(`https://servicodados.ibge.gov.br/api/v1/localidades/estados/${uf}/municipios`);
        
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        
        const cities = await response.json();
        const cityNames = cities.map(city => city.nome).sort((a, b) => a.localeCompare(b, 'pt-BR'));
        
        console.log(`✅ ${cityNames.length} cidades carregadas do IBGE para ${uf}`);
        return cityNames;
        
    } catch (error) {
        console.error('❌ Erro ao carregar cidades do IBGE:', error);
        console.log(`🔄 Usando dados internos como fallback para ${uf}`);
        return municipiosPorEstado[uf] || [];
    }
}

/**
 * Resolve o codigo IBGE de um municipio sem alterar o contrato legado que
 * retorna apenas nomes para os selects existentes.
 */
async function obterCodigoMunicipioIBGE(uf, nome) {
    const estado = String(uf || '').trim().toUpperCase();
    const municipio = String(nome || '').trim();
    if (!estado || !municipio) return '';

    try {
        const response = await fetch(`https://servicodados.ibge.gov.br/api/v1/localidades/estados/${estado}/municipios`);
        if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
        const cidades = await response.json();
        const encontrado = cidades.find((cidade) => cidade.nome === municipio);
        return encontrado ? String(encontrado.id).padStart(7, '0') : '';
    } catch (error) {
        console.error(`Erro ao resolver código IBGE de ${municipio}/${estado}:`, error);
        return '';
    }
}

/**
 * Popula um select com cidades de um estado
 * @param {string} selectId - ID do elemento select
 * @param {string} uf - Sigla do estado
 * @param {string} cidadeSelecionada - Cidade a ser selecionada (opcional)
 */
async function popularCidades(selectId, uf, cidadeSelecionada = '') {
    const select = document.getElementById(selectId);
    if (!select) {
        console.error(`Select com ID '${selectId}' não encontrado`);
        return;
    }
    
    // Mostrar carregando
    select.innerHTML = '<option value="">Carregando cidades...</option>';
    select.disabled = true;
    
    if (!uf) {
        select.innerHTML = '<option value="">Selecione primeiro o estado</option>';
        select.disabled = false;
        return;
    }
    
    try {
        const cidades = await carregarCidadesDoIBGE(uf);
        
        // Limpar e adicionar opção padrão
        select.innerHTML = '<option value="">Selecione a cidade</option>';
        
        // Adicionar cidades
        cidades.forEach(cidade => {
            const option = document.createElement('option');
            option.value = cidade;
            option.textContent = cidade;
            if (cidade === cidadeSelecionada) {
                option.selected = true;
            }
            select.appendChild(option);
        });
        
        select.disabled = false;
        
    } catch (error) {
        console.error('Erro ao popular cidades:', error);
        select.innerHTML = '<option value="">Erro ao carregar cidades</option>';
        select.disabled = false;
    }
}

/**
 * Cria um select de estados brasileiros
 * @param {string} selectId - ID do elemento select
 * @param {string} ufSelecionada - UF a ser selecionada (opcional)
 * @param {function} onChange - Callback para mudança de estado (opcional)
 */
function criarSelectEstados(selectId, ufSelecionada = '', onChange = null) {
    const select = document.getElementById(selectId);
    if (!select) {
        console.error(`Select com ID '${selectId}' não encontrado`);
        return;
    }
    
    // Limpar select
    select.innerHTML = '<option value="">Selecione o estado</option>';
    
    // Adicionar estados
    Object.entries(estadosBrasil).forEach(([uf, nome]) => {
        const option = document.createElement('option');
        option.value = uf;
        option.textContent = nome;
        if (uf === ufSelecionada) {
            option.selected = true;
        }
        select.appendChild(option);
    });
    
    // Configurar evento de mudança
    if (onChange && typeof onChange === 'function') {
        select.addEventListener('change', function() {
            onChange(this.value);
        });
    }
}

/**
 * Formata CEP (adiciona máscara)
 * @param {string} cep 
 * @returns {string}
 */
function formatarCEP(cep) {
    if (!cep) return '';
    const cleaned = cep.replace(/\D/g, '');
    if (cleaned.length === 8) {
        return cleaned.replace(/(\d{5})(\d{3})/, '$1-$2');
    }
    return cleaned;
}

/**
 * Busca CEP na API ViaCEP
 * @param {string} cep 
 * @returns {Promise<Object|null>}
 */
async function buscarCEP(cep) {
    try {
        const cleaned = cep.replace(/\D/g, '');
        if (cleaned.length !== 8) {
            throw new Error('CEP deve ter 8 dígitos');
        }
        
        const response = await fetch(`https://viacep.com.br/ws/${cleaned}/json/`);
        const data = await response.json();
        
        if (data.erro) {
            throw new Error('CEP não encontrado');
        }
        
        return {
            logradouro: data.logradouro,
            bairro: data.bairro,
            cidade: data.localidade,
            uf: data.uf,
            cep: formatarCEP(data.cep)
        };
        
    } catch (error) {
        console.error('Erro ao buscar CEP:', error);
        return null;
    }
}

// Disponibilizar funções globalmente
if (typeof window !== 'undefined') {
    window.carregarCidadesDoIBGE = carregarCidadesDoIBGE;
    window.popularCidades = popularCidades;
    window.criarSelectEstados = criarSelectEstados;
    window.formatarCEP = formatarCEP;
    window.buscarCEP = buscarCEP;
    window.obterCodigoMunicipioIBGE = obterCodigoMunicipioIBGE;
    window.estadosBrasil = estadosBrasil;
    window.municipiosPorEstado = municipiosPorEstado;
}

// Para uso em Node.js (se necessário)
if (typeof module !== 'undefined' && module.exports) {
    module.exports = {
        carregarCidadesDoIBGE,
        popularCidades,
        criarSelectEstados,
        formatarCEP,
        buscarCEP,
        estadosBrasil,
        municipiosPorEstado
    };
}

console.log('✅ cities-loader.js carregado com sucesso'); 
