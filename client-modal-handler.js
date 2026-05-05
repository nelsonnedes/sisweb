/**
 * client-modal-handler.js
 * Gerencia a funcionalidade dos modais de cliente em todas as páginas do sistema.
 * Este arquivo centraliza funções relacionadas ao modal de cliente para garantir
 * consistência em todas as páginas que usam modais de cliente.
 */

// Mapa de estados para cidades (usado como fallback se a API do IBGE falhar)
const cidadesPorEstado = {
    "AC": ["Rio Branco", "Cruzeiro do Sul", "Sena Madureira"],
    "AL": ["Maceió", "Arapiraca", "Palmeira dos Índios"],
    "AP": ["Macapá", "Santana", "Laranjal do Jari"],
    "AM": ["Manaus", "Parintins", "Itacoatiara"],
    "BA": ["Salvador", "Feira de Santana", "Vitória da Conquista"],
    "CE": ["Fortaleza", "Caucaia", "Juazeiro do Norte"],
    "DF": ["Brasília", "Ceilândia", "Taguatinga"],
    "ES": ["Vitória", "Vila Velha", "Serra"],
    "GO": ["Goiânia", "Aparecida de Goiânia", "Anápolis"],
    "MA": ["São Luís", "Imperatriz", "São José de Ribamar"],
    "MT": ["Cuiabá", "Várzea Grande", "Rondonópolis"],
    "MS": ["Campo Grande", "Dourados", "Três Lagoas"],
    "MG": ["Belo Horizonte", "Uberlândia", "Contagem"],
    "PA": ["Belém", "Ananindeua", "Santarém", "São Miguel do Guamá"],
    "PB": ["João Pessoa", "Campina Grande", "Santa Rita"],
    "PR": ["Curitiba", "Londrina", "Maringá"],
    "PE": ["Recife", "Jaboatão dos Guararapes", "Olinda"],
    "PI": ["Teresina", "Parnaíba", "Picos"],
    "RJ": ["Rio de Janeiro", "São Gonçalo", "Duque de Caxias"],
    "RN": ["Natal", "Mossoró", "Parnamirim"],
    "RS": ["Porto Alegre", "Caxias do Sul", "Pelotas"],
    "RO": ["Porto Velho", "Ji-Paraná", "Ariquemes"],
    "RR": ["Boa Vista", "Caracaraí", "Rorainópolis"],
    "SC": ["Florianópolis", "Joinville", "Blumenau"],
    "SP": ["São Paulo", "Guarulhos", "Campinas"],
    "SE": ["Aracaju", "Nossa Senhora do Socorro", "Lagarto"],
    "TO": ["Palmas", "Araguaína", "Gurupi"]
};

/**
 * Carrega cidades com base no estado selecionado
 * @param {string} estado - Sigla do estado (UF)
 */
function carregarCidadesPorEstado(estado) {
    console.log("Carregando cidades para o estado:", estado);
    const cidadeSelect = document.getElementById('clientCity');
    if (!cidadeSelect) {
        console.error("Elemento de seleção de cidade não encontrado");
        return;
    }
    
    // Limpar opções atuais
    cidadeSelect.innerHTML = '<option value="">Carregando cidades...</option>';
    
    // Se não houver estado selecionado, retornar
    if (!estado) {
        cidadeSelect.innerHTML = '<option value="">Selecione primeiro o estado</option>';
        return;
    }
    
    cidadeSelect.innerHTML = '<option value="">Carregando...</option>';
    
    // Usando a API do IBGE para obter cidades
    fetch(`https://servicodados.ibge.gov.br/api/v1/localidades/estados/${estado}/municipios`)
        .then(response => {
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }
            return response.json();
        })
        .then(cities => {
            // Ordenar cidades alfabeticamente
            const sortedCities = cities.map(city => city.nome).sort((a, b) => a.localeCompare(b, 'pt-BR'));
            
            // Limpar e adicionar uma opção padrão
            cidadeSelect.innerHTML = '<option value="">Selecione a cidade</option>';
            
            // Adicionar opções de cidades
            sortedCities.forEach(cidade => {
                const option = document.createElement('option');
                option.value = cidade;
                option.textContent = cidade;
                cidadeSelect.appendChild(option);
            });
        })
        .catch(error => {
            console.error('Erro ao carregar cidades:', error);
            
            // Fallback para o objeto local de cidades em caso de falha na API
            cidadeSelect.innerHTML = '<option value="">Selecione a cidade</option>';
            
            // Obter cidades do estado selecionado do objeto local
            const cidadesFallback = cidadesPorEstado[estado] || [];
            
            // Adicionar opções de cidades do fallback
            cidadesFallback.forEach(cidade => {
                const option = document.createElement('option');
                option.value = cidade;
                option.textContent = cidade;
                cidadeSelect.appendChild(option);
            });
        });
}

/**
 * Inicializa os listeners de eventos do modal de cliente
 */
function initClientModalHandlers() {
    console.log("Inicializando handlers do modal de cliente");
    
    // Configurar evento de mudança para o select de estado
    const clientState = document.getElementById('clientState');
    if (clientState) {
        clientState.addEventListener('change', function() {
            carregarCidadesPorEstado(this.value);
        });
        console.log("Evento change configurado para clientState");
    } else {
        console.warn("Elemento clientState não encontrado");
    }
    
    // Inicializar outros handlers conforme necessário
}

// Adicionar função de inicialização ao carregamento da página se o documento já estiver pronto
function safeInitOnReady() {
    try {
        const hasModalFields = document.getElementById('clientState') || document.getElementById('newClientModal');
        if (hasModalFields) {
            initClientModalHandlers();
        }
    } catch(_) {}
}
if (document.readyState === 'complete' || document.readyState === 'interactive') {
    console.log("Documento já carregado, inicializando handlers (se campos existirem)");
    safeInitOnReady();
} else {
    document.addEventListener('DOMContentLoaded', function() {
        console.log("Documento carregado, inicializando handlers (se campos existirem)");
        safeInitOnReady();
    });
}

// Expor funções globalmente
window.carregarCidadesPorEstado = carregarCidadesPorEstado;
window.initClientModalHandlers = initClientModalHandlers; 

// Abrir modal de novo cliente e bindar submit
if (typeof window.openNewClientModal !== 'function') {
window.openNewClientModal = function() {
    try {
        const modal = document.getElementById('clientModal');
        const form = document.getElementById('clientForm');
        if (!modal || !form) {
            console.warn('⚠️ Modal/Form de cliente não disponível');
            return;
        }
        // Reset e mostrar
        form.reset();
        modal.style.display = 'block';
        setTimeout(() => {
            const nameInput = document.getElementById('clientName') || document.getElementById('name');
            if (nameInput) nameInput.focus();
        }, 100);
        if (typeof window.saveClientPCT === 'function') {
            if (!form.dataset.boundClientSubmit) {
                form.addEventListener('submit', window.saveClientPCT);
                form.dataset.boundClientSubmit = '1';
            }
            return;
        }
        const newForm = form.cloneNode(true);
        form.parentNode.replaceChild(newForm, form);
        newForm.addEventListener('submit', async function(e){
            e.preventDefault();
            console.log("💾 Iniciando salvamento de cliente via Modal Handler...");
            try {
                const nameEl = document.getElementById('clientName') || document.getElementById('name');
                const cnpjEl = document.getElementById('clientCnpj') || document.getElementById('cnpj');
                const stateEl = document.getElementById('clientState') || document.getElementById('state');
                const cityEl = document.getElementById('clientCity') || document.getElementById('city');
                const phoneEl = document.getElementById('clientPhone') || document.getElementById('phone');
                const addressEl = document.getElementById('clientAddress') || document.getElementById('address');
                const obsEl = document.getElementById('clientObs') || document.getElementById('obs');
                
                const payload = {
                    id: Date.now().toString(),
                    name: nameEl ? nameEl.value : '',
                    cnpj: cnpjEl ? cnpjEl.value : '',
                    state: stateEl ? stateEl.value : '',
                    city: cityEl ? cityEl.value : '',
                    phone: phoneEl ? phoneEl.value : '',
                    address: addressEl ? addressEl.value : '',
                    obs: obsEl ? obsEl.value : '',
                    companyId: typeof window.resolveCompanyId === 'function' ? window.resolveCompanyId() : undefined
                };
                
                console.log("📦 Payload capturado:", payload);

                if (!window.clientService || !window.clientService.saveClient) {
                    console.warn('⚠️ clientService.saveClient indisponível. Tentando fallback para salvarClientesUnificado...');
                    if (typeof window.salvarClientesUnificado === 'function') {
                        // Adaptar para array se for unificado
                        await window.salvarClientesUnificado([payload]);
                        window.showToast('Cliente salvo (fallback)', 'success');
                    } else {
                        console.error('❌ Nenhum serviço de salvamento disponível');
                        alert('Erro: Serviço de salvamento indisponível. Recarregue a página.');
                        return;
                    }
                } else {
                    console.log("🚀 Chamando window.clientService.saveClient...");
                    const saved = await window.clientService.saveClient(payload);
                    console.log("✅ Retorno de saveClient:", saved);
                }
                
                try { if (typeof window.showToast === 'function') window.showToast('Cliente salvo com sucesso', 'success'); } catch(_) {}
                
                // Fechar modal e atualizar lista se existir
                modal.style.display = 'none';
                
                // Forçar atualização de listas
                try {
                    console.log("🔄 Solicitando atualização das listas de clientes...");
                    if (typeof window.showClientList === 'function') {
                        const filterInput = document.getElementById('clientListFilter');
                        const currentFilter = filterInput ? filterInput.value : '';
                        await window.showClientList(1, currentFilter);
                    }
                    
                    // Disparar evento global para outros componentes (como modal-clientes-pct.js)
                    window.dispatchEvent(new CustomEvent('clients:updated', { detail: { forceRefresh: true } }));
                    
                } catch(errList) {
                    console.warn("⚠️ Erro ao atualizar listas na UI:", errList);
                }
            } catch (err) {
                console.error("❌ Erro CRÍTICO no handler do modal:", err);
                alert("Erro ao salvar cliente: " + err.message);
            }
        });
    } catch (e) {
        console.error('❌ Falha ao abrir modal de novo cliente:', e);
    }
};
}
