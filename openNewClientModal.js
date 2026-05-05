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
            <div class="modal-content">
                <div class="modal-header" style="background: linear-gradient(135deg, #2c3e50 0%, #34495e 100%); color: #fff; padding: 15px 20px; min-height: 56px; border-radius: 8px 8px 0 0;">
                    <h3 class="modal-title" id="newClientModalLabel" style="color:#fff; text-shadow: 1px 1px 2px rgba(0,0,0,0.4);">Novo Cliente</h3>
                    <button type="button" id="newClientCloseBtn" class="close-modal" aria-label="Fechar">&times;</button>
                </div>
                <div class="modal-body">
                    <form id="newClientForm">
                        <div class="form-group">
                            <label for="newClientName">Nome</label>
                            <input type="text" id="newClientName" required>
                        </div>
                        <div class="form-row">
                            <div class="form-group">
                                <label for="newClientCnpj">Documento (CNPJ/CPF)</label>
                                <input type="text" id="newClientCnpj" placeholder="Ex: 12.345.678/0001-90">
                            </div>
                            <div class="form-group">
                                <label for="newClientPhone">Telefone</label>
                                <input type="text" id="newClientPhone" placeholder="(xx) xxxxx-xxxx">
                            </div>
                            <div class="form-group">
                                <label for="newClientEmail">Email</label>
                                <input type="email" id="newClientEmail" placeholder="email@exemplo.com">
                            </div>
                        </div>
                        <div class="form-group">
                            <label for="newClientAddress">Endereço</label>
                            <input type="text" id="newClientAddress" placeholder="Rua, nº, bairro">
                        </div>
                        <div class="form-row">
                            <div class="form-group">
                                <label for="clientState">Estado</label>
                                <select id="clientState">
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
                                <label for="clientCity">Cidade</label>
                                <select id="clientCity"><option value="">Selecione primeiro o estado</option></select>
                            </div>
                        </div>
                    </form>
                </div>
                <div class="modal-footer" style="display:flex; gap:10px; justify-content:flex-end;">
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
        const stateSelect = modal.querySelector('#clientState');
        if (stateSelect) {
            stateSelect.addEventListener('change', function() {
                const citySelect = modal.querySelector('#clientCity');
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
        const name = (document.getElementById('newClientName')?.value || '').trim();
        const email = (document.getElementById('newClientEmail')?.value || '').trim();
        const phone = (document.getElementById('newClientPhone')?.value || '').trim();
        const address = (document.getElementById('newClientAddress')?.value || '').trim();
        const cnpj = (document.getElementById('newClientCnpj')?.value || '').trim();
        const state = (document.getElementById('clientState')?.value || '').trim();
        const city = (document.getElementById('clientCity')?.value || '').trim();
        if (!name) { 
            try {
                const msg = 'Informe o nome do cliente';
                if (typeof window.__toast === 'function') window.__toast(msg, 'warning');
                else if (window.Utils && window.Utils.showToast) window.Utils.showToast(msg, 'warning');
            } catch (_) {}
            return; 
        }
        // ✅ PRIORIDADE: Usar a função global window.saveClient se disponível (pela romaneios-client-save-fix.js)
        const client = { name, email, phone, address, cnpj, state, city };
        const saveFn = window.saveClient || (window.clientService && window.clientService.saveClient);
        
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
