/**
 * ✅ CORREÇÃO ESPECÍFICA PARA ROMANEIOTORA
 * 
 * Este arquivo corrige os problemas específicos do romaneiotora:
 * 1. Salvamento de clientes no Firebase Realtime Database
 * 2. Melhoria no carregamento de cidades (já tem onchange configurado)
 * 
 * Problemas identificados:
 * - Função saveClient não está salvando corretamente no Firebase
 * - Necessidade de padronização com outros sistemas
 */

console.log("🔧 === INICIANDO CORREÇÕES ESPECÍFICAS DO ROMANEIOTORA ===");

// ✅ 1. FUNÇÃO PARA CARREGAR CIDADES POR ESTADO (MELHORADA PARA ROMANEIOTORA)
async function carregarCidadesPorEstadoRomaneiotora(estado) {
    console.log("🌍 Carregando cidades para o estado:", estado);
    
    const cidadeSelect = document.getElementById('clientCity');
    if (!cidadeSelect) {
        console.error("❌ Campo de cidade não encontrado");
        return;
    }
    
    if (!estado) {
        console.warn("⚠️ Estado não informado");
        cidadeSelect.innerHTML = '<option value="">Selecione uma cidade</option>';
        return;
    }
    
    // Mostrar loading
    cidadeSelect.innerHTML = '<option value="">Carregando cidades...</option>';
    cidadeSelect.disabled = true;
    
    try {
        console.log(`🔄 Carregando cidades para: ${estado}`);
        
        let cidadesCarregadas = false;
        
        // ✅ ESTRATÉGIA 1: Tentar BrasilAPI (mais confiável e sem CORS)
        try {
            console.log("🇧🇷 Tentando BrasilAPI...");
            const brasilApiUrl = `https://brasilapi.com.br/api/ibge/municipios/v1/${estado}`;
            
            const brasilResponse = await Promise.race([
                fetch(brasilApiUrl, { 
                    method: 'GET',
                    mode: 'cors',
                    cache: 'default' 
                }),
                new Promise((_, reject) => setTimeout(() => reject(new Error('Timeout BrasilAPI')), 3000))
            ]);
            
            if (brasilResponse.ok) {
                const brasilData = await brasilResponse.json();
                
                if (Array.isArray(brasilData) && brasilData.length > 0) {
                    console.log(`✅ BrasilAPI: ${brasilData.length} cidades carregadas`);
                    
                    const cidadesOrdenadas = brasilData
                        .map(cidade => cidade.nome)
                        .sort((a, b) => a.localeCompare(b, 'pt-BR'));
                    
                    cidadeSelect.innerHTML = '<option value="">Selecione uma cidade</option>';
                    cidadesOrdenadas.forEach(cidade => {
                        const option = document.createElement('option');
                        option.value = cidade;
                        option.textContent = cidade;
                        cidadeSelect.appendChild(option);
                    });
                    
                    cidadesCarregadas = true;
                    console.log("🎉 BrasilAPI funcionou perfeitamente!");
                }
            }
        } catch (brasilError) {
            console.warn("⚠️ BrasilAPI falhou:", brasilError.message);
        }
        
        // ✅ ESTRATÉGIA 2: Tentar IBGE API (fallback)
        if (!cidadesCarregadas) {
            try {
                console.log("🏛️ Tentando IBGE API...");
                const ibgeUrl = `https://servicodados.ibge.gov.br/api/v1/localidades/estados/${estado}/municipios`;
                
                const ibgeResponse = await Promise.race([
                    fetch(ibgeUrl, { 
                        method: 'GET',
                        mode: 'cors',
                        cache: 'default' 
                    }),
                    new Promise((_, reject) => setTimeout(() => reject(new Error('Timeout IBGE')), 4000))
                ]);
                
                if (ibgeResponse.ok) {
                    const ibgeData = await ibgeResponse.json();
                    
                    if (Array.isArray(ibgeData) && ibgeData.length > 0) {
                        console.log(`✅ IBGE API: ${ibgeData.length} cidades carregadas`);
                        
                        const cidadesOrdenadas = ibgeData
                            .map(cidade => cidade.nome)
                            .sort((a, b) => a.localeCompare(b, 'pt-BR'));
                        
                        cidadeSelect.innerHTML = '<option value="">Selecione uma cidade</option>';
                        cidadesOrdenadas.forEach(cidade => {
                            const option = document.createElement('option');
                            option.value = cidade;
                            option.textContent = cidade;
                            cidadeSelect.appendChild(option);
                        });
                        
                        cidadesCarregadas = true;
                        console.log("🎉 IBGE API funcionou como fallback!");
                    }
                }
            } catch (ibgeError) {
                console.warn("⚠️ IBGE API falhou:", ibgeError.message);
            }
        }
        
        // ✅ ESTRATÉGIA 3: Fallback local (lista básica)
        if (!cidadesCarregadas) {
            console.log("📋 Usando fallback local...");
            
            // Lista básica de cidades por estado
            const cidadesPorEstado = {
                'PA': ['Belém', 'Ananindeua', 'Santarém', 'Marabá', 'Parauapebas', 'Castanhal', 'Abaetetuba', 'Cametá', 'Bragança', 'Altamira', 'São Miguel do Guamá', 'Curionópolis'],
                'SP': ['São Paulo', 'Guarulhos', 'Campinas', 'São Bernardo do Campo', 'Santo André', 'Osasco', 'Ribeirão Preto', 'Sorocaba', 'Santos', 'Mauá'],
                'RJ': ['Rio de Janeiro', 'São Gonçalo', 'Duque de Caxias', 'Nova Iguaçu', 'Niterói', 'Belford Roxo', 'São João de Meriti', 'Campos dos Goytacazes'],
                'MG': ['Belo Horizonte', 'Uberlândia', 'Contagem', 'Juiz de Fora', 'Betim', 'Montes Claros', 'Ribeirão das Neves', 'Uberaba'],
                'BA': ['Salvador', 'Feira de Santana', 'Vitória da Conquista', 'Camaçari', 'Juazeiro', 'Ilhéus', 'Itabuna', 'Lauro de Freitas'],
                'PR': ['Curitiba', 'Londrina', 'Maringá', 'Ponta Grossa', 'Cascavel', 'São José dos Pinhais', 'Foz do Iguaçu', 'Colombo'],
                'RS': ['Porto Alegre', 'Caxias do Sul', 'Pelotas', 'Canoas', 'Santa Maria', 'Gravataí', 'Viamão', 'Novo Hamburgo'],
                'PE': ['Recife', 'Jaboatão dos Guararapes', 'Olinda', 'Caruaru', 'Petrolina', 'Paulista', 'Cabo de Santo Agostinho', 'Camaragibe'],
                'CE': ['Fortaleza', 'Caucaia', 'Juazeiro do Norte', 'Maracanaú', 'Sobral', 'Crato', 'Itapipoca', 'Maranguape'],
                'SC': ['Florianópolis', 'Joinville', 'Blumenau', 'São José', 'Criciúma', 'Chapecó', 'Itajaí', 'Lages'],
                'GO': ['Goiânia', 'Aparecida de Goiânia', 'Anápolis', 'Rio Verde', 'Luziânia', 'Águas Lindas de Goiás', 'Valparaíso de Goiás', 'Trindade'],
                'MA': ['São Luís', 'Imperatriz', 'São José de Ribamar', 'Timon', 'Caxias', 'Codó', 'Paço do Lumiar', 'Açailândia'],
                'AM': ['Manaus', 'Parintins', 'Itacoatiara', 'Manacapuru', 'Coari', 'Tefé', 'Tabatinga', 'Maués'],
                'MT': ['Cuiabá', 'Várzea Grande', 'Rondonópolis', 'Sinop', 'Tangará da Serra', 'Cáceres', 'Sorriso', 'Lucas do Rio Verde'],
                'DF': ['Brasília', 'Ceilândia', 'Taguatinga', 'Planaltina', 'Gama', 'Sobradinho', 'Paranoá', 'Guará'],
                'MS': ['Campo Grande', 'Dourados', 'Três Lagoas', 'Corumbá', 'Ponta Porã', 'Naviraí', 'Nova Andradina', 'Sidrolândia'],
                'AL': ['Maceió', 'Arapiraca', 'Palmeira dos Índios', 'Rio Largo', 'Penedo', 'União dos Palmares', 'São Miguel dos Campos', 'Santana do Ipanema'],
                'RN': ['Natal', 'Mossoró', 'Parnamirim', 'São Gonçalo do Amarante', 'Macaíba', 'Ceará-Mirim', 'Caicó', 'Assu'],
                'PB': ['João Pessoa', 'Campina Grande', 'Santa Rita', 'Patos', 'Bayeux', 'Sousa', 'Cajazeiras', 'Guarabira'],
                'ES': ['Vitória', 'Vila Velha', 'Serra', 'Cariacica', 'Viana', 'Cachoeiro de Itapemirim', 'Linhares', 'São Mateus'],
                'PI': ['Teresina', 'Parnaíba', 'Picos', 'Piripiri', 'Floriano', 'Campo Maior', 'Barras', 'Altos'],
                'RO': ['Porto Velho', 'Ji-Paraná', 'Ariquemes', 'Vilhena', 'Cacoal', 'Rolim de Moura', 'Guajará-Mirim', 'Jaru'],
                'AC': ['Rio Branco', 'Cruzeiro do Sul', 'Sena Madureira', 'Tarauacá', 'Feijó', 'Brasileia', 'Plácido de Castro', 'Xapuri'],
                'AP': ['Macapá', 'Santana', 'Laranjal do Jari', 'Oiapoque', 'Mazagão', 'Porto Grande', 'Vitória do Jari', 'Ferreira Gomes'],
                'RR': ['Boa Vista', 'Caracaraí', 'Rorainópolis', 'São João da Baliza', 'São Luiz', 'Bonfim', 'Mucajaí', 'Iracema'],
                'SE': ['Aracaju', 'Nossa Senhora do Socorro', 'Lagarto', 'Itabaiana', 'São Cristóvão', 'Estância', 'Tobias Barreto', 'Simão Dias'],
                'TO': ['Palmas', 'Araguaína', 'Gurupi', 'Porto Nacional', 'Paraíso do Tocantins', 'Colinas do Tocantins', 'Guaraí', 'Formoso do Araguaia']
            };
            
            const cidades = cidadesPorEstado[estado] || [];
            
            if (cidades.length === 0) {
                console.warn(`⚠️ Estado ${estado} não encontrado na lista local`);
                cidadeSelect.innerHTML = '<option value="">Estado não encontrado</option>';
            } else {
                console.log(`✅ Fallback local: ${cidades.length} cidades para ${estado}`);
                
                // Ordenar cidades alfabeticamente
                const cidadesOrdenadas = cidades.sort((a, b) => a.localeCompare(b, 'pt-BR'));
                
                cidadeSelect.innerHTML = '<option value="">Selecione uma cidade</option>';
                cidadesOrdenadas.forEach(cidade => {
                    const option = document.createElement('option');
                    option.value = cidade;
                    option.textContent = cidade;
                    cidadeSelect.appendChild(option);
                });
                
                cidadesCarregadas = true;
            }
        }
        
        if (cidadesCarregadas) {
            console.log("✅ Cidades carregadas com sucesso");
        } else {
            console.error("❌ Falha ao carregar cidades");
            cidadeSelect.innerHTML = '<option value="">Erro ao carregar cidades</option>';
        }
        
    } catch (error) {
        console.error("❌ Erro crítico ao carregar cidades:", error);
        cidadeSelect.innerHTML = '<option value="">Erro ao carregar cidades</option>';
    } finally {
        cidadeSelect.disabled = false;
    }
}

// ✅ 2. FUNÇÃO CORRIGIDA PARA SALVAR CLIENTE/FORNECEDOR NO FIREBASE
async function saveClientRomaneitoraCorrigido(e) {
    if (e) e.preventDefault();
    
    console.log("💾 === SALVANDO CLIENTE/FORNECEDOR ROMANEIOTORA (CORRIGIDO) ===");
    
    const clientName = document.getElementById('clientName').value.trim();
    if (!clientName) {
        alert('O nome do cliente/fornecedor é obrigatório.');
        return false;
    }
    
    // Obter ID do cliente (se estiver editando)
    const clientId = document.getElementById('clientId').value || window.editingClientId || null;
    
    // Obter valores de todos os campos (romaneiotora tem mais campos)
    const clientState = document.getElementById('clientState') ? document.getElementById('clientState').value : '';
    const clientCity = document.getElementById('clientCity') ? document.getElementById('clientCity').value : '';
    const clientPhone = document.getElementById('clientPhone').value.trim();
    const clientEmail = document.getElementById('clientEmail').value.trim();
    const clientAddress = document.getElementById('clientAddress') ? document.getElementById('clientAddress').value.trim() : '';
    const clientObs = document.getElementById('clientObs') ? document.getElementById('clientObs').value.trim() : '';
    const clientCpfCnpj = document.getElementById('clientCpfCnpj') ? document.getElementById('clientCpfCnpj').value.trim() : '';
    const clientStateRegistration = document.getElementById('clientStateRegistration') ? document.getElementById('clientStateRegistration').value.trim() : '';
    const clientCep = document.getElementById('clientCep') ? document.getElementById('clientCep').value.trim() : '';
    
    // Criar objeto com os dados do cliente/fornecedor
    const clientData = {
        nome: clientName,
        name: clientName, // Compatibilidade
        estado: clientState,
        state: clientState, // Compatibilidade
        cidade: clientCity,
        city: clientCity, // Compatibilidade
        telefone: clientPhone,
        phone: clientPhone, // Compatibilidade
        email: clientEmail,
        endereco: clientAddress,
        address: clientAddress, // Compatibilidade
        observacoes: clientObs,
        obs: clientObs, // Compatibilidade
        cpfCnpj: clientCpfCnpj,
        inscricaoEstadual: clientStateRegistration,
        cep: clientCep
    };
    
    try {
        // ✅ OBTER LISTA ATUAL DE CLIENTES SEMPRE DA CHAVE 'clients'
        let clients = [];
        
        // Tentar obter via client-service primeiro
        if (typeof window.getClients === 'function') {
            clients = await window.getClients(true) || [];
        } else if (typeof window.getData === 'function') {
            clients = await window.getData('clients') || [];
        }
        
        // Garantir que é um array
        if (!Array.isArray(clients)) {
            clients = [];
        }
        
        console.log(`📋 ${clients.length} clientes carregados`);
        
        // ✅ VERIFICAR SE ESTAMOS EDITANDO OU CRIANDO
        let isEditing = false;
        
        if (clientId) {
            // Editando cliente existente
            const index = clients.findIndex(c => String(c.id) === String(clientId));
            if (index !== -1) {
                clientData.id = clientId;
                clients[index] = { ...clients[index], ...clientData };
                isEditing = true;
                console.log("🔄 Atualizando cliente existente:", clientData.nome);
            } else {
                console.log("⚠️ Cliente com ID não encontrado, criando novo");
                clientData.id = Date.now().toString();
                clients.push(clientData);
            }
        } else {
            // Verificar se já existe um cliente com o mesmo nome
            const existingByName = clients.find(c => 
                (c.nome || c.name || '').toLowerCase() === clientName.toLowerCase()
            );
            
            if (existingByName) {
                const confirmOverwrite = confirm(`Já existe um cliente com o nome "${clientName}". Deseja atualizar o cadastro existente?`);
                if (confirmOverwrite) {
                    // Atualizar cliente existente
                    const index = clients.findIndex(c => c.id === existingByName.id);
                    if (index >= 0) {
                        clients[index] = {
                            ...existingByName,
                            ...clientData,
                            id: existingByName.id
                        };
                        clientData.id = existingByName.id;
                        isEditing = true;
                    }
                } else {
                    return false; // Usuário cancelou
                }
            } else {
                // Criar novo cliente
                console.log("➕ Criando novo cliente/fornecedor");
                clientData.id = Date.now().toString();
                clients.push(clientData);
            }
        }
        
        console.log(`💾 Salvando ${clients.length} clientes...`);
        
        // ✅ SALVAR DADOS NO FIREBASE COM PRIORIDADE
        let firebaseSaved = false;
        
        // Método 1: Usar client-service.saveClients (mais confiável)
        if (typeof window.clientService?.saveClients === 'function') {
            try {
                await window.clientService.saveClients(clients);
                console.log("✅ Clientes salvos via client-service");
                firebaseSaved = true;
            } catch (error) {
                console.error("❌ Erro ao salvar via client-service:", error);
            }
        }
        
        // Método 2: Usar saveData (fallback)
        if (!firebaseSaved && typeof window.saveData === 'function') {
            try {
                await window.saveData('clients', clients);
                console.log("✅ Clientes salvos via saveData");
                firebaseSaved = true;
            } catch (error) {
                console.error("❌ Erro ao salvar via saveData:", error);
            }
        }
        
        // Método 3: Usar salvarClientesUnificado (se disponível)
        if (!firebaseSaved && typeof window.salvarClientesUnificado === 'function') {
            try {
                await window.salvarClientesUnificado(clients);
                console.log("✅ Clientes salvos via salvarClientesUnificado");
                firebaseSaved = true;
            } catch (error) {
                console.error("❌ Erro ao salvar via salvarClientesUnificado:", error);
            }
        }
        
        // ✅ SALVAR NO LOCALSTORAGE COMO BACKUP
        try {
            localStorage.setItem('clients', JSON.stringify(clients));
            localStorage.setItem('clientesTora', JSON.stringify(clients)); // Compatibilidade
            localStorage.setItem('fornecedores', JSON.stringify(clients)); // Compatibilidade
            console.log("✅ Backup local salvo");
        } catch (localError) {
            console.warn("⚠️ Erro ao salvar backup local:", localError);
        }
        
        if (firebaseSaved) {
            console.log("🎉 Cliente/fornecedor salvo com sucesso no Firebase E localStorage");
        } else {
            console.log("📦 Cliente/fornecedor salvo no localStorage (Firebase não disponível)");
        }
        
        // ✅ ATUALIZAR CACHE GLOBAL
        window.clients = clients;
        window.fornecedores = clients; // Compatibilidade
        
        // ✅ FECHAR MODAL
        const modal = document.getElementById('clientModal');
        if (modal) modal.style.display = 'none';
        
        // ✅ SELECIONAR O CLIENTE SALVO
        if (typeof window.selectClient === 'function') {
            window.selectClient(clientData);
        }
        
        // ✅ ATUALIZAR LISTA DE CLIENTES SE ESTIVER VISÍVEL
        if (typeof window.renderClientList === 'function') {
            window.renderClientList('');
        }
        
        // ✅ LIMPAR VARIÁVEIS DE EDIÇÃO
        window.editingClientId = null;
        const clientIdField = document.getElementById('clientId');
        if (clientIdField) clientIdField.value = '';
        
        console.log(`✅ Cliente/fornecedor ${isEditing ? 'atualizado' : 'criado'} com sucesso:`, clientData);
        
        return true;
        
    } catch (error) {
        console.error("❌ Erro ao salvar cliente/fornecedor:", error);
        alert('Erro ao salvar cliente/fornecedor: ' + error.message);
        return false;
    }
}

// ✅ 3. FUNÇÃO PARA APLICAR TODAS AS CORREÇÕES
function aplicarCorrecoesRomaneiotora() {
    console.log("🚀 Aplicando correções específicas do romaneiotora...");
    
    try {
        // 1. Sobrescrever função saveClient se existir
        if (typeof window.saveClient === 'function') {
            window.saveClientOriginalRomaneiotora = window.saveClient;
        }
        window.saveClient = saveClientRomaneitoraCorrigido;
        
        // 2. Melhorar função de carregar cidades (substituir a existente)
        window.carregarCidadesPorEstado = carregarCidadesPorEstadoRomaneiotora;
        
        // 3. Configurar handlers de modal
        const modal = document.getElementById('clientModal');
        if (modal) {
            // Configurar evento de submit do formulário
            const form = document.getElementById('clientForm');
            if (form) {
                form.removeEventListener('submit', handleClientFormSubmitTora);
                form.addEventListener('submit', handleClientFormSubmitTora);
            }
            
            // Configurar botão de salvar
            const saveBtn = document.getElementById('saveClientBtn');
            if (saveBtn) {
                saveBtn.removeEventListener('click', handleSaveClientClickTora);
                saveBtn.addEventListener('click', handleSaveClientClickTora);
            }
        }
        
        console.log("✅ Correções aplicadas com sucesso!");
        
    } catch (error) {
        console.error("❌ Erro ao aplicar correções:", error);
    }
}

// ✅ 4. HANDLERS PARA FORMULÁRIO E BOTÃO
function handleClientFormSubmitTora(e) {
    e.preventDefault();
    saveClientRomaneitoraCorrigido(e);
}

function handleSaveClientClickTora(e) {
    e.preventDefault();
    saveClientRomaneitoraCorrigido(e);
}

// ✅ 5. FUNÇÃO DE DIAGNÓSTICO
function diagnosticarRomaneiotora() {
    console.log("🔍 === DIAGNÓSTICO ROMANEIOTORA ===");
    
    const diagnostico = {
        clientStateField: !!document.getElementById('clientState'),
        clientCityField: !!document.getElementById('clientCity'),
        clientModal: !!document.getElementById('clientModal'),
        clientForm: !!document.getElementById('clientForm'),
        saveClientBtn: !!document.getElementById('saveClientBtn'),
        carregarCidadesPorEstado: typeof window.carregarCidadesPorEstado === 'function',
        saveClient: typeof window.saveClient === 'function',
        getData: typeof window.getData === 'function',
        saveData: typeof window.saveData === 'function',
        clientService: !!window.clientService,
        salvarClientesUnificado: typeof window.salvarClientesUnificado === 'function',
        onchangeConfigured: document.getElementById('clientState')?.hasAttribute('onchange')
    };
    
    console.log("Diagnóstico:", diagnostico);
    
    // Verificar se o evento onchange está configurado
    const estadoSelect = document.getElementById('clientState');
    if (estadoSelect) {
        console.log("Campo clientState encontrado");
        console.log("Evento onchange configurado:", estadoSelect.hasAttribute('onchange'));
        console.log("Valor do onchange:", estadoSelect.getAttribute('onchange'));
    }
    
    return diagnostico;
}

// ✅ 6. EXECUTAR CORREÇÕES AUTOMATICAMENTE
function executarCorrecoesRomaneiotora() {
    console.log("🚀 Executando correções do romaneiotora...");
    
    // Aguardar DOM estar pronto
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', aplicarCorrecoesRomaneiotora);
    } else {
        aplicarCorrecoesRomaneiotora();
    }
    
    // Aguardar sistema estar pronto (se disponível)
    if (typeof window.addEventListener === 'function') {
        window.addEventListener('sistemaRomaneiosPronto', aplicarCorrecoesRomaneiotora);
    }
}

// ✅ 7. EXPOR FUNÇÕES GLOBALMENTE
window.carregarCidadesPorEstadoRomaneiotora = carregarCidadesPorEstadoRomaneiotora;
window.saveClientRomaneitoraCorrigido = saveClientRomaneitoraCorrigido;
window.aplicarCorrecoesRomaneiotora = aplicarCorrecoesRomaneiotora;
window.diagnosticarRomaneiotora = diagnosticarRomaneiotora;

// ✅ 8. EXECUTAR AUTOMATICAMENTE
executarCorrecoesRomaneiotora();

// ✅ 9. FUNÇÃO DE TESTE PARA VERIFICAR SALVAMENTO
function testarSalvamentoRomaneiotora() {
    console.log("🧪 === TESTE DE SALVAMENTO ROMANEIOTORA ===");
    
    // Criar dados de teste
    const clienteTeste = {
        nome: "Teste Fornecedor " + Date.now(),
        estado: "SP",
        cidade: "São Paulo",
        telefone: "(11) 99999-9999",
        email: "teste@teste.com",
        endereco: "Rua Teste, 123",
        cnpj: "12.345.678/0001-90",
        inscricaoEstadual: "123.456.789.123",
        observacoes: "Cliente de teste"
    };
    
    // Preencher campos do formulário
    const campos = {
        'clientName': clienteTeste.nome,
        'clientState': clienteTeste.estado,
        'clientCity': clienteTeste.cidade,
        'clientPhone': clienteTeste.telefone,
        'clientEmail': clienteTeste.email,
        'clientAddress': clienteTeste.endereco,
        'clientCnpj': clienteTeste.cnpj,
        'clientStateRegistration': clienteTeste.inscricaoEstadual,
        'clientObs': clienteTeste.observacoes
    };
    
    Object.keys(campos).forEach(campoId => {
        const campo = document.getElementById(campoId);
        if (campo) {
            campo.value = campos[campoId];
            console.log(`✅ Campo ${campoId} preenchido: ${campos[campoId]}`);
        } else {
            console.warn(`⚠️ Campo ${campoId} não encontrado`);
        }
    });
    
    console.log("📋 Dados de teste preenchidos. Execute saveClientRomaneitoraCorrigido() para testar o salvamento.");
    
    return clienteTeste;
}

// ✅ 10. EXPOR FUNÇÃO DE TESTE
window.testarSalvamentoRomaneiotora = testarSalvamentoRomaneiotora;

console.log("🎉 === CORREÇÕES ROMANEIOTORA CARREGADAS ===");
console.log("💡 Para aplicar manualmente: aplicarCorrecoesRomaneiotora()");
console.log("💡 Para diagnóstico: diagnosticarRomaneiotora()");
console.log("💡 Para testar salvamento: testarSalvamentoRomaneiotora()"); 