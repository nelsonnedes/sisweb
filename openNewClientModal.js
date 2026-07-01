// Função para abrir o modal de novo cliente
function openNewClientModal() {
    console.log("Abrindo modal para cadastrar novo cliente");
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
                const citySelect = modal.querySelector('#newClientCity');
                if (citySelect && typeof window.populateCitySelect === 'function') {
                    window.populateCitySelect(this.value, citySelect.id);
                } else if (citySelect) {
                    console.warn('Função populateCitySelect não encontrada. Verifique se cities.js está carregado.');
                    citySelect.innerHTML = '<option value="">Erro ao carregar cidades</option>';
                }
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
    
    // Limpar formulário
    const form = document.getElementById('newClientForm');
    if (form) {
        form.reset();
    }
    
    // Mostrar modal
    modal.style.display = 'block';
    modal.classList.add('show');
    try { if (typeof window.initClientModalHandlers === 'function') window.initClientModalHandlers(); } catch (_) {}
}

// Expor a função para o escopo global
window.openNewClientModal = openNewClientModal;
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
        const client = {
            name,
            nome: name,
            email,
            phone,
            telefone: phone,
            address,
            endereco: address,
            cnpj: documento,
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
            status: 'ativo',
            createdAt: nowIso,
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
            try { if (typeof atualizarSelectClientes === 'function') atualizarSelectClientes(savedId); } catch (_) {}
            try {
                const msg = 'Cliente salvo com sucesso';
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
