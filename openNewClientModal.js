let clientFormModalContext = {
    mode: 'create',
    client: null,
    onSaved: null,
    selectAfterSave: true
};

function clientModalText(client, ...keys) {
    for (const key of keys) {
        const value = client && client[key];
        if (value !== undefined && value !== null && String(value).trim() !== '') {
            return String(value).trim();
        }
    }
    return '';
}

function setClientModalValue(id, value) {
    const el = document.getElementById(id);
    if (el) el.value = value || '';
}

async function loadClientModalCities(uf, selectedCity = '') {
    const citySelect = document.getElementById('newClientCity');
    if (!citySelect) return;
    if (!uf) {
        citySelect.innerHTML = '<option value="">Selecione primeiro o estado</option>';
        return;
    }
    if (typeof window.popularCidades === 'function') {
        await window.popularCidades(citySelect.id, uf, selectedCity);
        return;
    }
    if (typeof window.populateCitySelect === 'function') {
        await window.populateCitySelect(uf, citySelect.id);
        if (selectedCity) citySelect.value = selectedCity;
        return;
    }
    citySelect.innerHTML = '';
    const option = document.createElement('option');
    option.value = selectedCity || '';
    option.textContent = selectedCity || 'Cidade não carregada';
    citySelect.appendChild(option);
}

async function populateClientFormModal(client = null) {
    const form = document.getElementById('newClientForm');
    if (form) form.reset();

    const isEdit = !!(clientFormModalContext.mode === 'edit' && client);
    const title = document.getElementById('newClientModalLabel');
    const saveButton = document.getElementById('saveNewClient');
    if (title) title.textContent = isEdit ? 'Editar Cliente' : 'Novo Cliente';
    if (saveButton) saveButton.textContent = isEdit ? 'Atualizar' : 'Salvar';

    setClientModalValue('newClientName', clientModalText(client, 'nome', 'name', 'razao', 'razaoSocial'));
    setClientModalValue('newClientCnpj', clientModalText(client, 'documento', 'document', 'cnpj', 'cpf', 'cpfCnpj'));
    setClientModalValue('newClientPhone', clientModalText(client, 'telefone', 'phone', 'celular'));
    setClientModalValue('newClientEmail', clientModalText(client, 'email'));
    setClientModalValue('newClientTipoPessoa', clientModalText(client, 'tipoPessoa', 'personType', 'fiscalPersonType'));
    setClientModalValue('newClientIndIEDest', clientModalText(client, 'indIEDest', 'indicadorInscricaoEstadual', 'ieIndicator'));
    setClientModalValue('newClientInscricaoEstadual', clientModalText(client, 'inscricaoEstadual', 'stateRegistration', 'ie'));
    setClientModalValue('newClientInscricaoMunicipal', clientModalText(client, 'inscricaoMunicipal', 'municipalRegistration', 'im'));
    setClientModalValue('newClientSuframa', clientModalText(client, 'suframa', 'SUFRAMA'));
    setClientModalValue('newClientCep', clientModalText(client, 'cep', 'postalCode', 'zipCode', 'zip'));
    setClientModalValue('newClientAddress', clientModalText(client, 'endereco', 'address', 'logradouro'));
    setClientModalValue('newClientNumber', clientModalText(client, 'numero', 'number'));
    setClientModalValue('newClientNeighborhood', clientModalText(client, 'bairro', 'neighborhood', 'district'));
    setClientModalValue('newClientComplement', clientModalText(client, 'complemento', 'complement'));
    const state = clientModalText(client, 'estado', 'state', 'uf').toUpperCase();
    const city = clientModalText(client, 'cidade', 'city', 'municipio');
    setClientModalValue('newClientState', state);
    await loadClientModalCities(state, city);
    setClientModalValue('newClientMunicipalityCode', clientModalText(client, 'codigoMunicipio', 'municipioCodigo', 'municipalityCode', 'cMun', 'codigoIBGE', 'ibge', 'ibgeCode'));
    setClientModalValue('newClientCountryCode', clientModalText(client, 'paisCodigo', 'countryCode', 'cPais') || '1058');
    setClientModalValue('newClientCountryName', clientModalText(client, 'pais', 'country', 'countryName', 'xPais') || 'Brasil');
    setClientModalValue('newClientObs', clientModalText(client, 'obs', 'observacoes', 'observations'));
}

// Modal canônico de cliente para fluxos operacionais.
function openClientFormModal(options = {}) {
    const opts = (options && typeof options === 'object') ? options : {};
    console.log(opts.mode === 'edit' ? "Abrindo modal para editar cliente" : "Abrindo modal para cadastrar novo cliente");
    // ✅ Fechar lista de clientes/fornecedores se estiver aberta para evitar dois modais
    try {
        const listModal = document.getElementById('clientListModal');
        if (listModal && (listModal.style.display === 'block' || listModal.classList.contains('show'))) {
            listModal.style.display = 'none';
            listModal.classList.remove('show');
            console.log('✅ Lista de Clientes/Fornecedores fechada automaticamente');
        }
        if (typeof window.closeClientListModal === 'function') {
            try { window.closeClientListModal(); } catch {}
        }
    } catch (_) {}
    
    // Verificar se o modal já existe
    let modal = document.getElementById('newClientModal');
    if (!modal) {
        console.log("Criando modal de novo cliente");
        modal = document.createElement('div');
        modal.id = 'newClientModal';
        modal.className = 'modal';
        modal.setAttribute('role', 'dialog');
        modal.setAttribute('aria-labelledby', 'newClientModalLabel');
        modal.setAttribute('aria-hidden', 'true');
        
        modal.innerHTML = `
            <div class="modal-content" style="display:flex; flex-direction:column; margin:24px auto; max-width:940px; max-height:calc(100dvh - 48px); overflow:hidden; padding:0; width:min(96vw, 940px);">
                <div class="modal-header" style="background: linear-gradient(135deg, #2c3e50 0%, #34495e 100%); color: #fff; padding: 15px 20px; min-height: 56px; border-radius: 8px 8px 0 0;">
                    <h3 class="modal-title" id="newClientModalLabel" style="color:#fff; text-shadow: 1px 1px 2px rgba(0,0,0,0.4);">Novo Cliente</h3>
                    <button type="button" id="newClientCloseBtn" class="close-modal" aria-label="Fechar">&times;</button>
                </div>
                <div class="modal-body" style="flex:1 1 auto; min-height:0; overflow-y:auto; padding:20px; -webkit-overflow-scrolling:touch;">
                    <form id="newClientForm">
                        <div class="form-group">
                            <label for="newClientName">Nome / Razão Social *</label>
                            <input type="text" id="newClientName" required placeholder="Ex: João da Silva / Silva Comércio">
                        </div>
                        <div class="form-row">
                            <div class="form-group">
                                <label for="newClientCnpj">CNPJ / CPF</label>
                                <input type="text" id="newClientCnpj" placeholder="00.000.000/0000-00">
                            </div>
                            <div class="form-group">
                                <label for="newClientPhone">Telefone / Celular</label>
                                <input type="text" id="newClientPhone" placeholder="(00) 00000-0000">
                            </div>
                        </div>
                        <div class="form-row">
                            <div class="form-group">
                                <label for="newClientEmail">Email</label>
                                <input type="email" id="newClientEmail" placeholder="contato@empresa.com">
                            </div>
                            <div class="form-group">
                                <label for="newClientTipoPessoa">Tipo de pessoa</label>
                                <select id="newClientTipoPessoa">
                                    <option value="">Não informado</option>
                                    <option value="juridica">Pessoa jurídica</option>
                                    <option value="fisica">Pessoa física</option>
                                    <option value="estrangeiro">Estrangeiro</option>
                                </select>
                            </div>
                        </div>
                        <div class="form-row">
                            <div class="form-group">
                                <label for="newClientIndIEDest">Indicador IE</label>
                                <select id="newClientIndIEDest">
                                    <option value="">Não informado</option>
                                    <option value="1">Contribuinte ICMS</option>
                                    <option value="2">Contribuinte isento</option>
                                    <option value="9">Não contribuinte</option>
                                </select>
                            </div>
                            <div class="form-group">
                                <label for="newClientInscricaoEstadual">Inscrição Estadual</label>
                                <input type="text" id="newClientInscricaoEstadual" placeholder="IE / ISENTO">
                            </div>
                        </div>
                        <div class="form-row">
                            <div class="form-group">
                                <label for="newClientInscricaoMunicipal">Inscrição Municipal</label>
                                <input type="text" id="newClientInscricaoMunicipal" placeholder="Opcional">
                            </div>
                            <div class="form-group">
                                <label for="newClientSuframa">SUFRAMA</label>
                                <input type="text" id="newClientSuframa" placeholder="Opcional">
                            </div>
                        </div>
                        <div class="form-row">
                            <div class="form-group">
                                <label for="newClientCep">CEP</label>
                                <input type="text" id="newClientCep" placeholder="00000-000">
                            </div>
                            <div class="form-group form-group-large">
                                <label for="newClientAddress">Endereço</label>
                                <input type="text" id="newClientAddress" placeholder="Rua, Avenida">
                            </div>
                            <div class="form-group">
                                <label for="newClientNumber">Número</label>
                                <input type="text" id="newClientNumber" placeholder="Nº">
                            </div>
                        </div>
                        <div class="form-row">
                            <div class="form-group">
                                <label for="newClientNeighborhood">Bairro</label>
                                <input type="text" id="newClientNeighborhood" placeholder="Bairro">
                            </div>
                            <div class="form-group">
                                <label for="newClientComplement">Complemento</label>
                                <input type="text" id="newClientComplement" placeholder="Sala, lote, referência">
                            </div>
                        </div>
                        <div class="form-row">
                            <div class="form-group">
                                <label for="newClientState">Estado</label>
                                <select id="newClientState">
                                    <option value="">Selecione o estado</option>
                                    <option value="AC">Acre</option>
                                    <option value="AL">Alagoas</option>
                                    <option value="AP">Amapá</option>
                                    <option value="AM">Amazonas</option>
                                    <option value="BA">Bahia</option>
                                    <option value="CE">Ceará</option>
                                    <option value="DF">Distrito Federal</option>
                                    <option value="ES">Espírito Santo</option>
                                    <option value="GO">Goiás</option>
                                    <option value="MA">Maranhão</option>
                                    <option value="MT">Mato Grosso</option>
                                    <option value="MS">Mato Grosso do Sul</option>
                                    <option value="MG">Minas Gerais</option>
                                    <option value="PA">Pará</option>
                                    <option value="PB">Paraíba</option>
                                    <option value="PR">Paraná</option>
                                    <option value="PE">Pernambuco</option>
                                    <option value="PI">Piauí</option>
                                    <option value="RJ">Rio de Janeiro</option>
                                    <option value="RN">Rio Grande do Norte</option>
                                    <option value="RS">Rio Grande do Sul</option>
                                    <option value="RO">Rondônia</option>
                                    <option value="RR">Roraima</option>
                                    <option value="SC">Santa Catarina</option>
                                    <option value="SP">São Paulo</option>
                                    <option value="SE">Sergipe</option>
                                    <option value="TO">Tocantins</option>
                                </select>
                            </div>
                            <div class="form-group">
                                <label for="newClientCity">Cidade</label>
                                <select id="newClientCity"><option value="">Selecione primeiro o estado</option></select>
                            </div>
                        </div>
                        <div class="form-row">
                            <div class="form-group">
                                <label for="newClientMunicipalityCode">Código IBGE do município</label>
                                <input type="text" id="newClientMunicipalityCode" placeholder="Ex: 1501402">
                            </div>
                            <div class="form-group">
                                <label for="newClientCountryCode">Código do país</label>
                                <input type="text" id="newClientCountryCode" value="1058" placeholder="1058">
                            </div>
                            <div class="form-group">
                                <label for="newClientCountryName">País</label>
                                <input type="text" id="newClientCountryName" value="Brasil" placeholder="Brasil">
                            </div>
                        </div>
                        <div class="form-group">
                            <label for="newClientObs">Observações</label>
                            <textarea id="newClientObs" rows="2" placeholder="Informações adicionais..."></textarea>
                        </div>
                    </form>
                </div>
                <div class="modal-footer" style="align-items:center; background:#fff; border-top:1px solid #e5e7eb; display:flex; flex:0 0 auto; gap:10px; justify-content:flex-end; margin:0; padding:14px 20px;">
                    <button type="button" class="btn btn-danger" id="cancelNewClient">Cancelar</button>
                    <button type="button" class="btn btn-success" id="saveNewClient">Salvar</button>
                </div>
            </div>
        `;
        
        document.body.appendChild(modal);
        
        // Adicionar evento ao botão de salvar
        const saveButton = modal.querySelector('#saveNewClient');
        if (saveButton) saveButton.addEventListener('click', saveNewClient);

        // Adicionar evento ao select de estado para carregar cidades
        const stateSelect = modal.querySelector('#newClientState');
        if (stateSelect) {
            stateSelect.addEventListener('change', function() {
                loadClientModalCities(this.value);
            });
        }

        const closeBtn = modal.querySelector('#newClientCloseBtn');
        if (closeBtn) closeBtn.addEventListener('click', function(){
            modal.style.display = 'none';
            modal.classList.remove('show');
        });
        const cancelBtn = modal.querySelector('#cancelNewClient');
        if (cancelBtn) cancelBtn.addEventListener('click', function(){
            modal.style.display = 'none';
            modal.classList.remove('show');
        });
    }
    
    clientFormModalContext = {
        mode: opts.mode === 'edit' ? 'edit' : 'create',
        client: opts.client || null,
        onSaved: typeof opts.onSaved === 'function' ? opts.onSaved : null,
        selectAfterSave: opts.selectAfterSave !== false
    };
    Promise.resolve(populateClientFormModal(clientFormModalContext.client)).catch((error) => {
        console.warn('Falha ao preencher modal de cliente:', error);
    });
    
    // Mostrar modal
    modal.style.display = 'block';
    modal.classList.add('show');
    try { if (typeof window.initClientModalHandlers === 'function') window.initClientModalHandlers(); } catch (_) {}
}

// Expor a função para o escopo global
function openNewClientModal() {
    return openClientFormModal({ mode: 'create' });
}

function openEditClientModal(client, options = {}) {
    if (!client) {
        try {
            const msg = 'Selecione um cliente para editar';
            if (typeof window.__toast === 'function') window.__toast(msg, 'warning');
            else if (window.Utils && window.Utils.showToast) window.Utils.showToast(msg, 'warning');
        } catch (_) {}
        return;
    }
    return openClientFormModal({ ...options, mode: 'edit', client });
}

window.openClientFormModal = openClientFormModal;
window.openNewClientModal = openNewClientModal;
window.openEditClientModal = openEditClientModal;
function saveNewClient() {
    try {
        const field = (id) => (document.getElementById(id)?.value || '').trim();
        const name = field('newClientName');
        const documento = field('newClientCnpj');
        const phone = field('newClientPhone');
        const email = field('newClientEmail');
        const tipoPessoa = field('newClientTipoPessoa');
        const indIEDest = field('newClientIndIEDest');
        const inscricaoEstadual = field('newClientInscricaoEstadual');
        const inscricaoMunicipal = field('newClientInscricaoMunicipal');
        const suframa = field('newClientSuframa');
        const cep = field('newClientCep');
        const address = field('newClientAddress');
        const numero = field('newClientNumber');
        const bairro = field('newClientNeighborhood');
        const complemento = field('newClientComplement');
        const state = field('newClientState');
        const city = field('newClientCity');
        const codigoMunicipio = field('newClientMunicipalityCode');
        const paisCodigo = field('newClientCountryCode') || '1058';
        const pais = field('newClientCountryName') || 'Brasil';
        const obs = field('newClientObs');
        if (!name) { 
            try {
                const msg = 'Informe o nome do cliente';
                if (typeof window.__toast === 'function') window.__toast(msg, 'warning');
                else if (window.Utils && window.Utils.showToast) window.Utils.showToast(msg, 'warning');
            } catch (_) {}
            return; 
        }
        const nowIso = new Date().toISOString();
        const originalClient = clientFormModalContext.client || {};
        const isEditMode = clientFormModalContext.mode === 'edit' && originalClient.id;
        const documentClean = documento.replace(/[^0-9A-Za-z]/g, '').toUpperCase();
        const isCpf = documentClean.length === 11 && /^\d{11}$/.test(documentClean);
        const isCnpj = documentClean.length === 14 && /^[A-Z0-9]{12}\d{2}$/.test(documentClean);
        const client = {
            ...originalClient,
            id: isEditMode ? String(originalClient.id) : originalClient.id,
            name,
            nome: name,
            email,
            phone,
            telefone: phone,
            address,
            endereco: address,
            cnpj: isCnpj ? documento : '',
            cpf: isCpf ? documento : '',
            documento,
            document: documento,
            tipoPessoa,
            personType: tipoPessoa,
            fiscalPersonType: tipoPessoa,
            indIEDest,
            indicadorInscricaoEstadual: indIEDest,
            ieIndicator: indIEDest,
            inscricaoEstadual,
            stateRegistration: inscricaoEstadual,
            ie: inscricaoEstadual,
            inscricaoMunicipal,
            municipalRegistration: inscricaoMunicipal,
            suframa,
            cep,
            postalCode: cep,
            numero,
            number: numero,
            bairro,
            neighborhood: bairro,
            complemento,
            complement: complemento,
            state,
            estado: state,
            city,
            cidade: city,
            codigoMunicipio,
            municipioCodigo: codigoMunicipio,
            municipalityCode: codigoMunicipio,
            cMun: codigoMunicipio,
            paisCodigo,
            countryCode: paisCodigo,
            cPais: paisCodigo,
            pais,
            country: pais,
            countryName: pais,
            xPais: pais,
            obs,
            observacoes: obs,
            observations: obs,
            status: originalClient.status || 'ativo',
            createdAt: originalClient.createdAt || originalClient.created || nowIso,
            updatedAt: nowIso,
            updated: nowIso
        };
        const saveFn = (window.clientService && typeof window.clientService.saveClient === 'function')
            ? (payload) => window.clientService.saveClient(payload)
            : window.saveClient;
        if (typeof saveFn !== 'function') {
            throw new Error('Serviço de clientes indisponível');
        }
        
        Promise.resolve(saveFn(client)).then((saved) => {
            const savedId = (saved && saved.id) ? saved.id : (client.id || null);
            console.log("✅ Cliente salvo com ID:", savedId);
            
            try { window.dispatchEvent(new CustomEvent('clients:updated', { detail: { client: saved || client } })); } catch (_) {}
            
            const modal = document.getElementById('newClientModal');
            if (modal) {
                if (window.$ && typeof window.$(modal).modal === 'function') { $(modal).modal('hide'); } 
                else { modal.style.display = 'none'; modal.classList.remove('show'); }
            }
            
            // ✅ Selecionar o novo cliente no dropdown passando o savedId
            try {
                if (clientFormModalContext.selectAfterSave && typeof atualizarSelectClientes === 'function') {
                    atualizarSelectClientes(savedId);
                }
            } catch (_) {}
            try {
                if (typeof clientFormModalContext.onSaved === 'function') {
                    Promise.resolve(clientFormModalContext.onSaved(saved || client)).catch((callbackError) => {
                        console.warn('Falha no callback pós-salvamento do cliente:', callbackError);
                    });
                }
            } catch (callbackError) {
                console.warn('Falha no callback pós-salvamento do cliente:', callbackError);
            }
            try {
                const msg = isEditMode ? 'Cliente atualizado com sucesso' : 'Cliente salvo com sucesso';
                if (typeof window.__toast === 'function') window.__toast(msg, 'success');
                else if (window.Utils && window.Utils.showToast) window.Utils.showToast(msg, 'success');
            } catch (_) {}
        }).catch((e) => {
            try {
                const msg = 'Erro ao salvar cliente: ' + (e && e.message ? e.message : e);
                if (typeof window.__toast === 'function') window.__toast(msg, 'error', { duration: 5000 });
                else if (window.Utils && window.Utils.showToast) window.Utils.showToast(msg, 'error');
            } catch (_) {}
        });
    } catch (e) {
        try {
            const msg = 'Erro ao salvar cliente';
            if (typeof window.__toast === 'function') window.__toast(msg, 'error', { duration: 5000 });
            else if (window.Utils && window.Utils.showToast) window.Utils.showToast(msg, 'error');
        } catch (_) {}
    }
}

window.saveNewClient = saveNewClient;
