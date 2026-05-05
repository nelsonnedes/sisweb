// Dados de municípios brasileiros por estado (dados internos como fallback)
const municipiosPorEstado = {
    'PA': ['Belém', 'Ananindeua', 'Santarém', 'Marabá', 'Parauapebas', 'Castanhal', 'Abaetetuba', 'Cametá', 'Bragança', 'Altamira', 'Paragominas', 'Tucuruí', 'Barcarena', 'Salinópolis', 'Oriximiná', 'Itaituba', 'Redenção', 'Capanema', 'Tailândia', 'Igarapé-Açu', 'São Miguel do Guamá', 'Tomé-Açu', 'Vigia', 'Conceição do Araguaia', 'Monte Alegre', 'Novo Repartimento', 'Xinguara'],
    'SP': ['São Paulo', 'Guarulhos', 'Campinas', 'São Bernardo do Campo', 'Santo André', 'Osasco', 'Ribeirão Preto', 'Sorocaba', 'Santos', 'Mauá', 'São José dos Campos', 'Mogi das Cruzes', 'Diadema', 'Piracicaba', 'Caraguatatuba', 'Franca', 'Jundiaí', 'Americana'],
    'RJ': ['Rio de Janeiro', 'São Gonçalo', 'Duque de Caxias', 'Nova Iguaçu', 'Niterói', 'Belford Roxo', 'São João de Meriti', 'Campos dos Goytacazes', 'Petrópolis', 'Volta Redonda', 'Magé', 'Macaé', 'Itaboraí', 'Cabo Frio'],
    'MG': ['Belo Horizonte', 'Uberlândia', 'Contagem', 'Juiz de Fora', 'Betim', 'Montes Claros', 'Ribeirão das Neves', 'Uberaba', 'Governador Valadares', 'Ipatinga', 'Sete Lagoas', 'Divinópolis', 'Santa Luzia'],
    'AC': ['Rio Branco', 'Cruzeiro do Sul', 'Sena Madureira', 'Tarauacá', 'Feijó', 'Brasiléia', 'Xapuri', 'Senador Guiomard', 'Plácido de Castro', 'Acrelândia'],
    'AL': ['Maceió', 'Arapiraca', 'Palmeira dos Índios', 'Rio Largo', 'Penedo', 'União dos Palmares', 'Coruripe', 'São Miguel dos Campos'],
    'AM': ['Manaus', 'Parintins', 'Itacoatiara', 'Manacapuru', 'Coari', 'Tefé', 'Tabatinga', 'Maués', 'Humaitá', 'São Gabriel da Cachoeira'],
    'BA': ['Salvador', 'Feira de Santana', 'Vitória da Conquista', 'Camaçari', 'Juazeiro', 'Ilhéus', 'Itabuna', 'Lauro de Freitas', 'Jequié', 'Alagoinhas'],
    'CE': ['Fortaleza', 'Caucaia', 'Juazeiro do Norte', 'Maracanaú', 'Sobral', 'Crato', 'Itapipoca', 'Maranguape', 'Iguatu', 'Quixadá'],
    'GO': ['Goiânia', 'Aparecida de Goiânia', 'Anápolis', 'Rio Verde', 'Luziânia', 'Águas Lindas de Goiás', 'Valparaíso de Goiás', 'Trindade'],
    'MA': ['São Luís', 'Imperatriz', 'São José de Ribamar', 'Timon', 'Caxias', 'Codó', 'Paço do Lumiar', 'Açailândia', 'Bacabal'],
    'MT': ['Cuiabá', 'Várzea Grande', 'Rondonópolis', 'Sinop', 'Tangará da Serra', 'Cáceres', 'Sorriso', 'Lucas do Rio Verde'],
    'MS': ['Campo Grande', 'Dourados', 'Três Lagoas', 'Corumbá', 'Ponta Porã', 'Naviraí', 'Nova Andradina', 'Sidrolândia'],
    'PB': ['João Pessoa', 'Campina Grande', 'Santa Rita', 'Patos', 'Bayeux', 'Sousa', 'Cajazeiras', 'Guarabira'],
    'PE': ['Recife', 'Jaboatão dos Guararapes', 'Olinda', 'Caruaru', 'Petrolina', 'Paulista', 'Cabo de Santo Agostinho', 'Camaragibe'],
    'PI': ['Teresina', 'Parnaíba', 'Picos', 'Piripiri', 'Floriano', 'Campo Maior', 'Barras', 'União'],
    'PR': ['Curitiba', 'Londrina', 'Maringá', 'Ponta Grossa', 'Cascavel', 'São José dos Pinhais', 'Foz do Iguaçu', 'Colombo'],
    'RN': ['Natal', 'Mossoró', 'Parnamirim', 'São Gonçalo do Amarante', 'Macaíba', 'Ceará-Mirim', 'Currais Novos', 'Caicó'],
    'RO': ['Porto Velho', 'Ji-Paraná', 'Ariquemes', 'Vilhena', 'Cacoal', 'Rolim de Moura', 'Guajará-Mirim', 'Jaru'],
    'RR': ['Boa Vista', 'Rorainópolis', 'Caracaraí', 'Alto Alegre', 'Mucajaí', 'Cantá', 'São João da Baliza', 'São Luiz'],
    'RS': ['Porto Alegre', 'Caxias do Sul', 'Pelotas', 'Canoas', 'Santa Maria', 'Gravataí', 'Viamão', 'Novo Hamburgo'],
    'SC': ['Florianópolis', 'Joinville', 'Blumenau', 'São José', 'Criciúma', 'Chapecó', 'Itajaí', 'Lages'],
    'SE': ['Aracaju', 'Nossa Senhora do Socorro', 'Lagarto', 'Itabaiana', 'Estância', 'Tobias Barreto', 'Simão Dias'],
    'TO': ['Palmas', 'Araguaína', 'Gurupi', 'Porto Nacional', 'Paraíso do Tocantins', 'Colinas do Tocantins', 'Formoso do Araguaia'],
    'DF': ['Brasília', 'Gama', 'Taguatinga', 'Ceilândia', 'Sobradinho', 'Planaltina', 'São Sebastião', 'Paranoá'],
    'ES': ['Vitória', 'Vila Velha', 'Serra', 'Cariacica', 'Cachoeiro de Itapemirim', 'Linhares', 'São Mateus', 'Colatina']
};

// Função para carregar cidades do IBGE (mesma implementação das outras páginas)
async function loadCitiesFromIBGE(uf) {
    try {
        // Sanitizar UF para garantir apenas 2 letras (evita erros como "PA:1")
        const cleanUF = uf ? uf.substring(0, 2).toUpperCase() : '';
        if (!cleanUF || cleanUF.length !== 2) {
            console.warn(`⚠️ UF inválida para carga de cidades: ${uf}`);
            return [];
        }

        console.log(`🌐 Carregando cidades do IBGE para ${cleanUF}...`);
        const response = await fetch(`https://servicodados.ibge.gov.br/api/v1/localidades/estados/${cleanUF}/municipios`);
        
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

// Função para obter cidades por estado (mantém compatibilidade)
function getCitiesByState(state) {
    console.log('🔍 Buscando cidades para o estado:', state);
    return municipiosPorEstado[state] || [];
}

// Função para carregar municípios (agora usando IBGE como principal)
async function loadMunicipiosCSV() {
    try {
        console.log('📋 Inicializando sistema de cidades...');
        
        // Testar conectividade com o IBGE (usando GET em endpoint leve)
        const testeResponse = await fetch('https://servicodados.ibge.gov.br/api/v1/localidades/estados/PA', {
            method: 'GET'
        });
        
        if (testeResponse.ok) {
            console.log('✅ API do IBGE disponível e funcionando');
        } else {
            throw new Error('API do IBGE não disponível');
        }
        
        console.log('✅ Sistema de cidades inicializado com sucesso!');
        console.log(`📊 Fallback disponível para ${Object.keys(municipiosPorEstado).length} estados`);
        
        return true;
    } catch (error) {
        console.warn('⚠️ API do IBGE não disponível, usando apenas dados internos:', error.message);
        console.log(`📋 Sistema iniciado com ${Object.keys(municipiosPorEstado).length} estados em fallback`);
        return true; // Retorna true mesmo com fallback para não quebrar o sistema
    }
}

// Função para popular o select de cidades (versão aprimorada)
async function populateCitySelect(stateValue, citySelectId) {
    console.log(`🏙️ Populando cidades para ${stateValue} no select ${citySelectId}`);
    const citySelect = document.getElementById(citySelectId);
    
    if (!citySelect) {
        console.error(`❌ Elemento select de cidade não encontrado: ${citySelectId}`);
        return;
    }
    
    if (!stateValue) {
        citySelect.innerHTML = '<option value="">Selecione primeiro o estado</option>';
        return;
    }

    // Mostrar carregando
    citySelect.innerHTML = '<option value="">Carregando cidades...</option>';
    
    try {
        // Tentar carregar do IBGE primeiro
        const cities = await loadCitiesFromIBGE(stateValue);
        
        // Limpar e adicionar opção padrão
        citySelect.innerHTML = '<option value="">Selecione a cidade</option>';
        
        // Adicionar cidades
        cities.forEach(city => {
            const option = document.createElement('option');
            option.value = city;
            option.textContent = city;
            citySelect.appendChild(option);
        });
        
        console.log(`✅ ${cities.length} cidades carregadas para o estado ${stateValue}`);
        
    } catch (error) {
        console.error('❌ Erro ao popular cidades:', error);
        
        // Fallback para dados internos
        const cities = municipiosPorEstado[stateValue] || [];
        citySelect.innerHTML = '<option value="">Selecione a cidade</option>';
        
        cities.forEach(city => {
            const option = document.createElement('option');
            option.value = city;
            option.textContent = city;
            citySelect.appendChild(option);
        });
        
        console.log(`🔄 ${cities.length} cidades carregadas do fallback para ${stateValue}`);
    }
}

// Carregar dados iniciais
console.log('🚀 Iniciando carregamento de dados de municípios...');
loadMunicipiosCSV().then(success => {
    console.log('📊 Status do carregamento inicial:', success ? 'sucesso' : 'falha');
});

// Configuração do EmailJS (se necessário)
if (typeof emailjs !== 'undefined') {
    emailjs.init("qkQHAL_GwdL8J4T-O");
}

async function enviarComprovante(templateParams) {
    try {
        if (typeof emailjs === 'undefined') {
            console.warn('EmailJS não está disponível');
            return;
        }
        
        await emailjs.send(
            'service_5tpgwf2',
            'Order Confirmed #{{order_id}}!SEU_TEMPLATE_ID',
            templateParams
        );
        console.log('Comprovante enviado com sucesso');
    } catch (error) {
        console.error('Erro ao enviar comprovante:', error);
    }
}

// Expor funções globalmente para compatibilidade
window.loadCitiesFromIBGE = loadCitiesFromIBGE;
window.getCitiesByState = getCitiesByState;
window.populateCitySelect = populateCitySelect; 
