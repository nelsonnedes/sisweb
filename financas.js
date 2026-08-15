/**
 * Sistema Financeiro - JavaScript
 * Controle de contas a pagar, receber, fluxo de caixa e relatórios
 */

// Variáveis globais
let contasReceber = [];
let contasPagar = [];
let clientes = [];
let fornecedores = [];
let funcionarios = [];
let contaAtualEdicao = null;
let tipoContaAtual = '';
let financeSessionTenant = '';
let financeModalPreviousFocus = null;
let financeReportCompanyCache = null;
// Paginação
let currentPageReceber = 1;
let currentPagePagar = 1;
const PAGE_SIZE = 10;
let lastFiltroReceber = {};
let lastFiltroPagar = {};
// Estados de overlay/preload
window.financeInitialLoading = false;
window.financeLoadingCount = 0;
window.financeFilterOverlayActive = false;
// Preload de tabela: apenas na primeira renderização após carregar dados
window.financeTableOverlayOnce = false;

// Charts
let fluxoCaixaChart = null;
let fluxoDetalhadoChart = null;

// ✅ MELHORIA: Sistema de notificações
function mostrarNotificacao(mensagem, tipo = 'info') {
    const notification = document.createElement('div');
    notification.className = `notification notification-${tipo}`;
    const content = document.createElement('div');
    content.style.cssText = `position:fixed;top:20px;right:20px;background:${tipo === 'error' ? '#dc3545' : tipo === 'success' ? '#28a745' : '#007bff'};color:white;padding:15px 20px;border-radius:5px;z-index:9999;box-shadow:0 4px 15px rgba(0,0,0,0.2);`;
    content.setAttribute('role', tipo === 'error' ? 'alert' : 'status');
    const icon = document.createElement('i');
    icon.className = `fas fa-${tipo === 'error' ? 'exclamation-triangle' : tipo === 'success' ? 'check-circle' : 'info-circle'}`;
    icon.setAttribute('aria-hidden', 'true');
    const text = document.createElement('span');
    text.textContent = ` ${String(mensagem || '')}`;
    content.append(icon, text);
    notification.appendChild(content);
    
    document.body.appendChild(notification);
    
    // Remover após 4 segundos
    setTimeout(() => {
        if (notification.parentNode) {
            notification.parentNode.removeChild(notification);
        }
    }, 4000);
}

function expectFinanceWrite(result, operation = 'Operação financeira', options = {}) {
    const failed = !result || result.success !== true || result.queued === true;
    const degradedAtomicWrite = options.atomic === true && !!result && !!result.fallback;
    if (!failed && !degradedAtomicWrite) return result;
    const error = new Error(`${operation} não foi confirmada pelo banco online.`);
    error.code = degradedAtomicWrite ? 'finance/non-atomic-write' : 'finance/write-not-confirmed';
    error.result = result || null;
    throw error;
}

async function callFinanceCallable(functionName, payload = {}) {
    if (window.__siswebFirebaseServiceReady) await window.__siswebFirebaseServiceReady;
    const service = window.firebaseService;
    if (!service || typeof service.callFunction !== 'function') {
        throw new Error('Serviço transacional financeiro indisponível. Atualize a página e tente novamente.');
    }
    const result = await service.callFunction(functionName, payload);
    if (!result || result.success !== true) {
        const error = new Error((result && result.error) || 'Operação financeira não confirmada pelo servidor.');
        error.code = (result && result.code) || 'finance/callable-not-confirmed';
        throw error;
    }
    return result;
}

async function createFinanceAccountsAuthoritative(tipo, accounts, operationId) {
    const normalizedType = tipo === 'receber' ? 'receber' : 'pagar';
    const sourceAccounts = Array.isArray(accounts) ? accounts : [];
    if (!sourceAccounts.length) throw new Error('Nenhuma conta financeira foi preparada para criação.');
    const confirmedOperationId = String(operationId || '').trim()
        || createFinanceOperationId(`create_${normalizedType}`);
    const payloadAccounts = sourceAccounts.map((account) => {
        const month = getMonthKeyFromDateVal(account && (account.dataVencimento || account.vencimento));
        if (!month || !account || !String(account.id || '').trim()) {
            throw new Error('Conta ou partição mensal inválida para criação.');
        }
        return { mes: month, account };
    });
    try {
        const result = await callFinanceCallable('financeCreateAccounts', {
            tipo: normalizedType,
            operationId: confirmedOperationId,
            accounts: payloadAccounts
        });
        if (!Array.isArray(result.accounts) || result.accounts.length !== sourceAccounts.length) {
            throw new Error('Servidor não confirmou todas as contas do lote.');
        }
        return {
            accounts: result.accounts.map((account, index) => ({
                ...(account || {}),
                id: String((account && account.id) || sourceAccounts[index].id)
            })),
            operationId: confirmedOperationId,
            idempotent: result.idempotent === true
        };
    } catch (error) {
        try {
            const reconciled = [];
            for (const item of payloadAccounts) {
                const accountId = String(item.account.id);
                const remote = await reconcileFinanceAccount(normalizedType, item.mes, accountId);
                if (!financeOperationWasCommitted(remote, confirmedOperationId, 'create')) throw error;
                reconciled.push(remote);
            }
            return {
                accounts: reconciled,
                operationId: confirmedOperationId,
                idempotent: true,
                reconciled: true
            };
        } catch (_) {}
        throw error;
    }
}

function mergeFinanceCreatedAccounts(tipo, accounts) {
    const normalizedType = tipo === 'receber' ? 'receber' : 'pagar';
    return (Array.isArray(accounts) ? accounts : []).map((account) => (
        replaceFinanceAccountInMemory(normalizedType, account && account.id, account)
    ));
}

async function cleanupRejectedFinanceCreateUploads(accounts) {
    const seen = new Set();
    for (const account of Array.isArray(accounts) ? accounts : []) {
        for (const attachment of normalizeAttachmentsList(account && account.anexos)) {
            const storagePath = resolveAttachmentStoragePath(attachment);
            if (!storagePath || seen.has(storagePath)) continue;
            seen.add(storagePath);
            await deleteStorageFileSafely(storagePath, attachment.url);
        }
    }
}

function isDefinitiveFinanceCreateError(error) {
    const code = String(error && error.code || '').toLowerCase();
    return code.includes('invalid-argument')
        || code.includes('already-exists')
        || code.includes('aborted')
        || code.includes('permission-denied')
        || code.includes('unauthenticated');
}

async function retryPendingFinanceCreation(tipo, form) {
    const pending = form && form.__financePendingCreate;
    if (!pending || pending.tipo !== tipo || !Array.isArray(pending.accounts)) return null;
    try {
        const committed = await createFinanceAccountsAuthoritative(
            tipo,
            pending.accounts,
            pending.operationId
        );
        form.__financePendingCreate = null;
        return mergeFinanceCreatedAccounts(tipo, committed.accounts);
    } catch (error) {
        if (isDefinitiveFinanceCreateError(error)) {
            form.__financePendingCreate = null;
            await cleanupRejectedFinanceCreateUploads(pending.accounts);
        }
        throw error;
    }
}

async function updateFinanceAccountAuthoritative(tipo, originalAccount, editedAccount, options = {}) {
    const source = originalAccount && typeof originalAccount === 'object' ? originalAccount : {};
    const target = editedAccount && typeof editedAccount === 'object' ? editedAccount : {};
    const accountId = String(source.id || target.id || '').trim();
    const fromMonth = getMonthKeyFromDateVal(source.dataVencimento || source.vencimento);
    const toMonth = getMonthKeyFromDateVal(target.dataVencimento || target.vencimento);
    if (!accountId || !fromMonth || !toMonth) {
        throw new Error('Conta ou partição mensal inválida para edição.');
    }
    const explicitOperationId = String(options.operationId || '').trim();
    const editContext = window.contaEmEdicao || {};
    const operationId = explicitOperationId
        || editContext.financeEditOperationId
        || createFinanceOperationId('edit_account');
    if (!explicitOperationId) {
        editContext.financeEditOperationId = operationId;
        window.contaEmEdicao = editContext;
    }
    let result;
    try {
        result = await callFinanceCallable('financeUpdateAccount', {
            tipo,
            mesOrigem: fromMonth,
            mesDestino: toMonth,
            contaId: accountId,
            operationId,
            expected: buildFinanceExpectedState(source),
            account: target
        });
    } catch (error) {
        try {
            const reconciled = await reconcileFinanceAccount(tipo, toMonth, accountId);
            if (financeOperationWasCommitted(reconciled, operationId, 'edit')) {
                return { account: reconciled, fromMonth, toMonth, operationId, reconciled: true };
            }
            error.financeReconciledAccount = reconciled;
        } catch (_) {}
        throw error;
    }
    if (!result.account || typeof result.account !== 'object') {
        throw new Error('Servidor não confirmou a conta financeira editada.');
    }
    return {
        account: { ...result.account, id: String(result.account.id || accountId) },
        fromMonth,
        toMonth,
        operationId
    };
}

async function updateFinancePaymentReceiptAuthoritative(tipo, conta, registroRef, receipt, operationId) {
    const source = conta && typeof conta === 'object' ? conta : {};
    const accountId = String(source.id || '').trim();
    const month = getMonthKeyFromDateVal(source.dataVencimento || source.vencimento);
    if (!accountId || !month) throw new Error('Conta ou partição mensal inválida para o comprovante.');
    const confirmedOperationId = String(operationId || '').trim() || createFinanceOperationId('receipt');
    try {
        const result = await callFinanceCallable('financeUpdatePaymentReceipt', {
            tipo,
            mes: month,
            contaId: accountId,
            operationId: confirmedOperationId,
            expected: buildFinanceExpectedState(source),
            registroRef,
            receipt: receipt || {}
        });
        if (!result.account || typeof result.account !== 'object') {
            throw new Error('Servidor não confirmou o comprovante financeiro.');
        }
        return replaceFinanceAccountInMemory(tipo, accountId, result.account);
    } catch (error) {
        try {
            const reconciled = await reconcileFinanceAccount(tipo, month, accountId);
            if (financeOperationWasCommitted(reconciled, confirmedOperationId, 'receipt')) return reconciled;
            error.financeReconciledAccount = reconciled;
        } catch (_) {}
        throw error;
    }
}

function createFinanceOperationId(prefix = 'finance') {
    const safePrefix = String(prefix || 'finance').replace(/[^A-Za-z0-9_-]/g, '').slice(0, 24) || 'finance';
    try {
        if (window.crypto && typeof window.crypto.randomUUID === 'function') {
            return `${safePrefix}_${window.crypto.randomUUID()}`;
        }
        if (window.crypto && typeof window.crypto.getRandomValues === 'function') {
            const bytes = new Uint8Array(16);
            window.crypto.getRandomValues(bytes);
            return `${safePrefix}_${Array.from(bytes, (value) => value.toString(16).padStart(2, '0')).join('')}`;
        }
    } catch (_) {}
    return `${safePrefix}_${Date.now()}_${Math.floor(Math.random() * 1e9)}`;
}

function financeMoneyToCents(value) {
    const parsed = typeof value === 'number' ? value : parseCurrencyValue(value);
    if (!Number.isFinite(parsed)) return 0;
    return Math.round(parsed * 100);
}

function buildFinanceExpectedState(conta) {
    const source = conta && typeof conta === 'object' ? conta : {};
    const history = Array.isArray(source.historicosPagamento) ? source.historicosPagamento : [];
    const status = String(source.status || 'pendente').trim().toLowerCase();
    const originalCents = financeMoneyToCents(
        Object.prototype.hasOwnProperty.call(source, 'valorOriginal') ? source.valorOriginal : source.valor
    );
    const historyPaidCents = history.reduce((sum, entry) => sum + financeMoneyToCents(entry && entry.valor), 0);
    const paidCents = Object.prototype.hasOwnProperty.call(source, 'valorPago')
        ? financeMoneyToCents(source.valorPago)
        : (status === 'pago' && history.length === 0 ? originalCents : historyPaidCents);
    const remainingCents = Object.prototype.hasOwnProperty.call(source, 'valorRestante')
        ? financeMoneyToCents(source.valorRestante)
        : (status === 'pago' ? 0 : Math.max(0, originalCents - paidCents));
    return {
        historyLength: history.length,
        valorPago: paidCents / 100,
        valorRestante: remainingCents / 100,
        status,
        revision: Number.isSafeInteger(Number(source.revision)) ? Number(source.revision) : 0
    };
}

function replaceFinanceAccountInMemory(tipo, accountId, authoritativeAccount) {
    const target = tipo === 'receber' ? contasReceber : contasPagar;
    const index = target.findIndex((item) => String(item && item.id) === String(accountId));
    const normalized = { ...(authoritativeAccount || {}), id: String((authoritativeAccount && authoritativeAccount.id) || accountId) };
    if (index >= 0) target[index] = normalized;
    else target.push(normalized);
    return normalized;
}

async function reconcileFinanceAccount(tipo, monthKey, accountId) {
    const service = window.firebaseService;
    if (!service || typeof service.loadFromFirebase !== 'function') {
        throw new Error('Serviço financeiro indisponível para reconciliar a conta.');
    }
    const result = await service.loadFromFirebase(`financas/${tipo}/${monthKey}/${String(accountId)}`);
    if (!result || result.success !== true || !result.data || typeof result.data !== 'object') {
        throw new Error('Conta financeira não pôde ser reconciliada com o servidor.');
    }
    return replaceFinanceAccountInMemory(tipo, accountId, result.data);
}

function financeOperationWasCommitted(account, operationId, kind) {
    const operation = account
        && account._financeOperations
        && account._financeOperations[operationId];
    return !!operation && (!kind || operation.kind === kind);
}

function clearFinancePaymentAttemptState(form, options = {}) {
    if (!form) return;
    const pendingUpload = form.__financePendingPaymentUpload || null;
    const operationId = String(form.dataset && form.dataset.financeOperationId || '').trim();
    if (pendingUpload && options.uncertain === true) {
        const pendingReview = Array.isArray(window.__financePendingStorageReview)
            ? window.__financePendingStorageReview
            : [];
        pendingReview.push({
            operationId,
            storagePath: pendingUpload.storagePath || null,
            url: pendingUpload.url || null,
            createdAt: new Date().toISOString()
        });
        window.__financePendingStorageReview = pendingReview.slice(-10);
    }
    form.__financePendingPaymentUpload = null;
    if (form.dataset) delete form.dataset.financeOperationId;
}

function debounce(fn, delay) {
    let t;
    return function() {
        const args = arguments;
        clearTimeout(t);
        t = setTimeout(() => fn.apply(this, args), delay);
    };
}

async function loadScriptOnce(scriptPath) {
    const normalized = String(scriptPath || '').trim();
    if (!normalized) return false;
    const current = Array.from(document.querySelectorAll('script[src]'))
        .find((script) => script.getAttribute('src') === normalized);
    if (current) return true;
    return new Promise((resolve) => {
        const script = document.createElement('script');
        script.src = normalized;
        script.async = false;
        script.onload = () => resolve(true);
        script.onerror = () => resolve(false);
        document.head.appendChild(script);
    });
}

function getEstadosOptionsHtml() {
    return `
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
    `;
}

async function ensureCitiesSupportLoaded() {
    if (typeof window.populateCitySelect === 'function') return true;
    return await loadScriptOnce('cities.js');
}

function attachFinanceStateCityBehavior(stateId, cityId) {
    const stateField = document.getElementById(stateId);
    const cityField = document.getElementById(cityId);
    if (!stateField || !cityField) return;
    if (stateField.dataset.cityBound === '1') return;
    stateField.dataset.cityBound = '1';
    stateField.addEventListener('change', async function() {
        const uf = String(this.value || '').trim();
        if (!uf) {
            cityField.innerHTML = '<option value="">Selecione primeiro o estado</option>';
            return;
        }
        const ok = await ensureCitiesSupportLoaded();
        if (!ok || typeof window.populateCitySelect !== 'function') {
            cityField.innerHTML = '<option value="">Selecione a cidade</option>';
            return;
        }
        await window.populateCitySelect(uf, cityId);
    });
}

function closeFinanceClienteModal() {
    const modal = document.getElementById('financeClienteModal');
    if (!modal) return;
    modal.style.display = 'none';
}

function closeFinanceFornecedorModal() {
    const modal = document.getElementById('financeFornecedorModal');
    if (!modal) return;
    modal.style.display = 'none';
}

function ensureFinanceClienteModal() {
    let modal = document.getElementById('financeClienteModal');
    if (modal) return modal;
    modal = document.createElement('div');
    modal.id = 'financeClienteModal';
    modal.className = 'modal';
    modal.innerHTML = `
        <div class="modal-content" style="max-width: 760px;">
            <div class="modal-header" style="background: linear-gradient(135deg, #2c3e50 0%, #34495e 100%); color: #fff; padding: 15px 20px; min-height: 56px; border-radius: 8px 8px 0 0;">
                <h3 class="modal-title" style="color:#fff;" id="financeClienteModalTitle">Novo Cliente</h3>
                <button type="button" class="close-modal" onclick="closeFinanceClienteModal()" aria-label="Fechar">&times;</button>
            </div>
            <div class="modal-body">
                <form id="financeClienteForm">
                    <input type="hidden" id="financeClientId">
                    <div class="form-group">
                        <label for="financeClientName">Nome:</label>
                        <input type="text" id="financeClientName" required>
                    </div>
                    <div class="form-group">
                        <label for="financeClientState">Estado:</label>
                        <select id="financeClientState" required>
                            ${getEstadosOptionsHtml()}
                        </select>
                    </div>
                    <div class="form-group">
                        <label for="financeClientCity">Cidade:</label>
                        <select id="financeClientCity" required>
                            <option value="">Selecione primeiro o estado</option>
                        </select>
                    </div>
                    <div class="form-group">
                        <label for="financeClientPhone">Telefone:</label>
                        <input type="text" id="financeClientPhone">
                    </div>
                    <div class="form-group">
                        <label for="financeClientEmail">Email:</label>
                        <input type="email" id="financeClientEmail">
                    </div>
                    <div class="form-group">
                        <label for="financeClientAddress">Endereço:</label>
                        <input type="text" id="financeClientAddress">
                    </div>
                    <div class="form-group">
                        <label for="financeClientObs">Observações:</label>
                        <textarea id="financeClientObs" rows="3"></textarea>
                    </div>
                </form>
            </div>
            <div class="modal-footer" style="display:flex; justify-content:flex-end; gap:10px;">
                <button type="button" class="btn btn-danger" onclick="closeFinanceClienteModal()">
                    <i class="fas fa-times"></i> Cancelar
                </button>
                <button type="button" class="btn btn-success" onclick="saveFinanceClienteModal()">
                    <i class="fas fa-save"></i> Salvar
                </button>
            </div>
        </div>
    `;
    document.body.appendChild(modal);
    modal.addEventListener('click', function(e) {
        if (e.target === modal) closeFinanceClienteModal();
    });
    attachFinanceStateCityBehavior('financeClientState', 'financeClientCity');
    return modal;
}

function ensureFinanceFornecedorModal() {
    let modal = document.getElementById('financeFornecedorModal');
    if (modal) return modal;
    modal = document.createElement('div');
    modal.id = 'financeFornecedorModal';
    modal.className = 'modal';
    modal.innerHTML = `
        <div class="modal-content" style="max-width: 760px;">
            <div class="modal-header" style="background: linear-gradient(135deg, #2c3e50 0%, #34495e 100%); color: #fff; padding: 15px 20px; min-height: 56px; border-radius: 8px 8px 0 0;">
                <h3 class="modal-title" style="color:#fff;" id="financeFornecedorModalTitle">Novo Fornecedor</h3>
                <button type="button" class="close-modal" onclick="closeFinanceFornecedorModal()" aria-label="Fechar">&times;</button>
            </div>
            <div class="modal-body">
                <form id="financeFornecedorForm">
                    <input type="hidden" id="financeFornecedorId">
                    <div class="form-group">
                        <label for="financeFornecedorName">Nome:</label>
                        <input type="text" id="financeFornecedorName" required>
                    </div>
                    <div class="form-group">
                        <label for="financeFornecedorCnpj">CNPJ:</label>
                        <input type="text" id="financeFornecedorCnpj" placeholder="00.000.000/0000-00">
                    </div>
                    <div class="form-group">
                        <label for="financeFornecedorStateRegistration">Inscrição Estadual:</label>
                        <input type="text" id="financeFornecedorStateRegistration" placeholder="000.000.000.000">
                    </div>
                    <div class="form-group">
                        <label for="financeFornecedorAddress">Endereço:</label>
                        <input type="text" id="financeFornecedorAddress" placeholder="Rua, Avenida, etc.">
                    </div>
                    <div class="form-group">
                        <label for="financeFornecedorNumber">Número:</label>
                        <input type="text" id="financeFornecedorNumber" placeholder="Número da residência/empresa">
                    </div>
                    <div class="form-group">
                        <label for="financeFornecedorNeighborhood">Bairro:</label>
                        <input type="text" id="financeFornecedorNeighborhood" placeholder="Nome do bairro">
                    </div>
                    <div class="form-group">
                        <label for="financeFornecedorState">Estado:</label>
                        <select id="financeFornecedorState" required>
                            ${getEstadosOptionsHtml()}
                        </select>
                    </div>
                    <div class="form-group">
                        <label for="financeFornecedorCity">Cidade:</label>
                        <select id="financeFornecedorCity" required>
                            <option value="">Selecione primeiro o estado</option>
                        </select>
                    </div>
                    <div class="form-group">
                        <label for="financeFornecedorPhone">Telefone:</label>
                        <input type="text" id="financeFornecedorPhone">
                    </div>
                    <div class="form-group">
                        <label for="financeFornecedorEmail">Email:</label>
                        <input type="email" id="financeFornecedorEmail">
                    </div>
                    <div class="form-group">
                        <label for="financeFornecedorObs">Observações:</label>
                        <textarea id="financeFornecedorObs" rows="3"></textarea>
                    </div>
                </form>
            </div>
            <div class="modal-footer" style="display:flex; justify-content:flex-end; gap:10px;">
                <button type="button" class="btn btn-danger" onclick="closeFinanceFornecedorModal()">
                    <i class="fas fa-times"></i> Cancelar
                </button>
                <button type="button" class="btn btn-success" onclick="saveFinanceFornecedorModal()">
                    <i class="fas fa-save"></i> Salvar
                </button>
            </div>
        </div>
    `;
    document.body.appendChild(modal);
    modal.addEventListener('click', function(e) {
        if (e.target === modal) closeFinanceFornecedorModal();
    });
    attachFinanceStateCityBehavior('financeFornecedorState', 'financeFornecedorCity');
    return modal;
}

async function saveFinanceClienteModal() {
    const id = (document.getElementById('financeClientId')?.value || '').trim() || `CLI-${Date.now()}`;
    const nome = (document.getElementById('financeClientName')?.value || '').trim();
    const estado = (document.getElementById('financeClientState')?.value || '').trim();
    const cidade = (document.getElementById('financeClientCity')?.value || '').trim();
    const telefone = (document.getElementById('financeClientPhone')?.value || '').trim();
    const email = (document.getElementById('financeClientEmail')?.value || '').trim();
    const endereco = (document.getElementById('financeClientAddress')?.value || '').trim();
    const obs = (document.getElementById('financeClientObs')?.value || '').trim();

    if (!nome) {
        mostrarNotificacao('Informe o nome do cliente.', 'error');
        return;
    }
    if (!estado) {
        mostrarNotificacao('Selecione o estado do cliente.', 'error');
        return;
    }
    if (!cidade) {
        mostrarNotificacao('Selecione a cidade do cliente.', 'error');
        return;
    }

    const clienteExistente = Array.isArray(clientes) ? clientes.find((c) => String(c?.id) === String(id)) : null;
    const nowIso = new Date().toISOString();
    const createdAt = clienteExistente?.createdAt || clienteExistente?.created || nowIso;

    const cliente = {
        id,
        nome,
        name: nome,
        nomeCompleto: nome,
        estado,
        state: estado,
        cidade,
        city: cidade,
        telefone,
        phone: telefone,
        email,
        endereco,
        address: endereco,
        numero: clienteExistente?.numero || clienteExistente?.number || '',
        number: clienteExistente?.number || clienteExistente?.numero || '',
        bairro: clienteExistente?.bairro || clienteExistente?.neighborhood || '',
        neighborhood: clienteExistente?.neighborhood || clienteExistente?.bairro || '',
        obs,
        observacoes: obs,
        observations: obs,
        tipo: 'cliente',
        category: 'cliente',
        status: clienteExistente?.status || 'ativo',
        createdAt,
        updatedAt: nowIso,
        created: createdAt,
        updated: nowIso
    };

    try {
        if (window.clientService && typeof window.clientService.saveClient === 'function') {
            await window.clientService.saveClient(cliente);
        } else if (window.firebaseService && typeof window.firebaseService.saveToFirebase === 'function') {
            expectFinanceWrite(await window.firebaseService.saveToFirebase('clients', id, cliente), 'Cadastro do cliente');
        }
        clientes = Array.isArray(clientes) ? clientes.filter((c) => String(c.id) !== String(id)) : [];
        clientes.push(cliente);
        // ✅ CORREÇÃO: Reset do formulário ANTES de popular o select e selecionar o item,
        // para que form.reset() não apague o valor que acabamos de definir.
        const form = document.getElementById('financeClienteForm');
        if (form) form.reset();
        closeFinanceClienteModal();
        atualizarSelectClientes();
        // Selecionar automaticamente o cliente recém cadastrado no campo do formulário
        const receberCliente = document.getElementById('receberCliente');
        if (receberCliente) {
            receberCliente.value = id;
            // Disparar evento de change para atualizar filtros dependentes, se houver
            receberCliente.dispatchEvent(new Event('change', { bubbles: true }));
        }
        // Também atualizar o filtro de clientes se estiver na aba receber
        const filtroCliente = document.getElementById('filtroReceberCliente');
        if (filtroCliente) atualizarSelectClientes();
        mostrarNotificacao('Cliente cadastrado com sucesso!', 'success');
    } catch (error) {
        console.error('❌ Erro ao salvar cliente:', error);
        mostrarNotificacao('Erro ao salvar cliente.', 'error');
    }
}

async function saveFinanceFornecedorModal() {
    const id = (document.getElementById('financeFornecedorId')?.value || '').trim() || `FOR-${Date.now()}`;
    const nome = (document.getElementById('financeFornecedorName')?.value || '').trim();
    const cnpj = (document.getElementById('financeFornecedorCnpj')?.value || '').trim();
    const inscricaoEstadual = (document.getElementById('financeFornecedorStateRegistration')?.value || '').trim();
    const endereco = (document.getElementById('financeFornecedorAddress')?.value || '').trim();
    const numero = (document.getElementById('financeFornecedorNumber')?.value || '').trim();
    const bairro = (document.getElementById('financeFornecedorNeighborhood')?.value || '').trim();
    const estado = (document.getElementById('financeFornecedorState')?.value || '').trim();
    const cidade = (document.getElementById('financeFornecedorCity')?.value || '').trim();
    const telefone = (document.getElementById('financeFornecedorPhone')?.value || '').trim();
    const email = (document.getElementById('financeFornecedorEmail')?.value || '').trim();
    const obs = (document.getElementById('financeFornecedorObs')?.value || '').trim();

    if (!nome) {
        mostrarNotificacao('Informe o nome do fornecedor.', 'error');
        return;
    }
    if (!estado) {
        mostrarNotificacao('Selecione o estado do fornecedor.', 'error');
        return;
    }
    if (!cidade) {
        mostrarNotificacao('Selecione a cidade do fornecedor.', 'error');
        return;
    }

    const fornecedorExistente = Array.isArray(fornecedores) ? fornecedores.find((f) => String(f?.id) === String(id)) : null;
    const nowIso = new Date().toISOString();
    const createdAt = fornecedorExistente?.createdAt || fornecedorExistente?.created || nowIso;

    const fornecedor = {
        id,
        nome,
        name: nome,
        cnpj,
        inscricaoEstadual,
        stateRegistration: inscricaoEstadual,
        endereco,
        address: endereco,
        numero,
        number: numero,
        bairro,
        neighborhood: bairro,
        estado,
        state: estado,
        cidade,
        city: cidade,
        telefone,
        phone: telefone,
        email,
        observacoes: obs,
        observations: obs,
        obs,
        tipo: 'fornecedor',
        category: 'fornecedor',
        status: fornecedorExistente?.status || 'ativo',
        createdAt,
        updatedAt: nowIso,
        created: createdAt,
        updated: nowIso
    };

    try {
        if (window.firebaseService && typeof window.firebaseService.saveToFirebase === 'function') {
            expectFinanceWrite(await window.firebaseService.saveToFirebase('fornecedores', id, fornecedor), 'Cadastro do fornecedor');
        }
        fornecedores = Array.isArray(fornecedores) ? fornecedores.filter((f) => String(f.id) !== String(id)) : [];
        fornecedores.push(fornecedor);
        // ✅ CORREÇÃO: Reset do formulário ANTES de popular o select e selecionar o item,
        // para que form.reset() não apague o valor que acabamos de definir.
        const form = document.getElementById('financeFornecedorForm');
        if (form) form.reset();
        closeFinanceFornecedorModal();
        atualizarSelectFornecedores();
        // Selecionar automaticamente o fornecedor recém cadastrado no campo do formulário
        const pagarFornecedor = document.getElementById('pagarFornecedor');
        if (pagarFornecedor) {
            pagarFornecedor.value = id;
            // Disparar evento de change para atualizar filtros dependentes, se houver
            pagarFornecedor.dispatchEvent(new Event('change', { bubbles: true }));
        }
        mostrarNotificacao('Fornecedor cadastrado com sucesso!', 'success');
    } catch (error) {
        console.error('❌ Erro ao salvar fornecedor:', error);
        mostrarNotificacao('Erro ao salvar fornecedor.', 'error');
    }
}

async function abrirCadastroClienteFinanceiro() {
    await ensureCitiesSupportLoaded();
    const modal = ensureFinanceClienteModal();
    const form = document.getElementById('financeClienteForm');
    if (form) form.reset();
    const cityField = document.getElementById('financeClientCity');
    if (cityField) cityField.innerHTML = '<option value="">Selecione primeiro o estado</option>';
    modal.style.display = 'block';
    const nomeField = document.getElementById('financeClientName');
    if (nomeField) nomeField.focus();
}

async function abrirCadastroFornecedorFinanceiro() {
    await ensureCitiesSupportLoaded();
    const modal = ensureFinanceFornecedorModal();
    const form = document.getElementById('financeFornecedorForm');
    if (form) form.reset();
    const cityField = document.getElementById('financeFornecedorCity');
    if (cityField) cityField.innerHTML = '<option value="">Selecione primeiro o estado</option>';
    modal.style.display = 'block';
    const nomeField = document.getElementById('financeFornecedorName');
    if (nomeField) nomeField.focus();
}

window.abrirCadastroClienteFinanceiro = abrirCadastroClienteFinanceiro;
window.abrirCadastroFornecedorFinanceiro = abrirCadastroFornecedorFinanceiro;
window.closeFinanceClienteModal = closeFinanceClienteModal;
window.closeFinanceFornecedorModal = closeFinanceFornecedorModal;
window.saveFinanceClienteModal = saveFinanceClienteModal;
window.saveFinanceFornecedorModal = saveFinanceFornecedorModal;

//

// Inicialização quando a página carrega
document.addEventListener('DOMContentLoaded', async function() {
    try {
        if (window.__siswebFirebaseServiceReady && typeof window.__siswebFirebaseServiceReady.then === 'function') {
            await window.__siswebFirebaseServiceReady;
        }
        // ✅ Unificar inicialização para garantir bind de eventos e navegação
        inicializarSistema();
        return;
    } catch (e) {
        console.warn('⚠️ Falha ao iniciar fluxo padrão, executando fallback direto:', e);
    }
    
    // Fallback antigo caso inicialização padrão falhe
    try {
        mostrarLoading(true);
        
        if (!window.database) {
            console.warn("⚠️ Firebase não disponível, operando sem dados locais (produção)");
            mostrarNotificacao("Modo offline: carregamento adiado até Firebase estar disponível", "info");
            contasReceber = [];
            contasPagar = [];
            window.financeTableOverlayOnce = true;
            carregarTabelaReceber();
            carregarTabelaPagar();
            configurarEventos(); // ✅ Garantir eventos mesmo no fallback
            verificarHashURL();  // ✅ Respeitar hash mesmo no fallback
            mostrarLoading(false);
            return;
        }
        
        await new Promise(resolve => setTimeout(resolve, 1000));
        await carregarDados();
        configurarEventos();
        verificarHashURL();
        atualizarDashboard();
    } catch (error) {
        console.error("❌ Erro na inicialização (fallback):", error);
        try {
            contasReceber = [];
            contasPagar = [];
            window.financeTableOverlayOnce = true;
            carregarTabelaReceber();
            carregarTabelaPagar();
            configurarEventos();
            verificarHashURL();
        } catch (fallbackError) {
            console.error("❌ Erro crítico no fallback final:", fallbackError);
            contasReceber = [];
            contasPagar = [];
            window.financeTableOverlayOnce = true;
            carregarTabelaReceber();
            carregarTabelaPagar();
            configurarEventos();
        }
    }
});

// ✅ NOVA FUNÇÃO: Configurar datas do mês atual
function configurarDatasDoMesAtual() {
    const hoje = new Date();
    const inicioPrevMes = new Date(hoje.getFullYear(), hoje.getMonth() - 2, 1);
    const fimProxMes = new Date(hoje.getFullYear(), hoje.getMonth() + 3, 0);
    const primeiroDiaStr = formatISODateLocal(inicioPrevMes);
    const ultimoDiaStr = formatISODateLocal(fimProxMes);
    const hojeStr = formatISODateLocal(hoje);
    
    // ✅ CORREÇÃO: Configurar todos os campos de data com mês atual
    const camposDataInicio = [
        'fluxoDataInicio',
        'relDataInicio',
        'filtroReceberDataInicio',
        'filtroPagarDataInicio'
    ];
    
    const camposDataFim = [
        'fluxoDataFim',
        'relDataFim',
        'filtroReceberDataFim',
        'filtroPagarDataFim'
    ];
    
    // Configurar datas de início (início do mês anterior)
    camposDataInicio.forEach(campoId => {
        const campo = document.getElementById(campoId);
        if (campo && !campo.value) {
            campo.value = primeiroDiaStr;
        }
    });
    
    // Configurar datas de fim (fim do próximo mês)
    camposDataFim.forEach(campoId => {
        const campo = document.getElementById(campoId);
        if (campo && !campo.value) {
            campo.value = ultimoDiaStr;
        }
    });
    
    // Configurar campos de vencimento, emissão e pagamento com data atual
    // Evitar sobrescrever datas de edição; sempre atualizar pagamentoData
    const camposDataAtual = ['receberDataEmissao', 'pagarDataEmissao', 'receberDataVencimento', 'pagarDataVencimento', 'pagamentoData'];
    camposDataAtual.forEach(campoId => {
        const campo = document.getElementById(campoId);
        if (!campo) return;

        const emEdicao = (window.contaEmEdicao && window.contaEmEdicao.tipo) ? String(window.contaEmEdicao.tipo) : null;
        const isReceberEdit = emEdicao === 'receber' && campoId === 'receberDataVencimento';
        const isPagarEdit = emEdicao === 'pagar' && campoId === 'pagarDataVencimento';

        // Não sobrescrever durante edição; se já tiver valor, respeitar
        if (campoId !== 'pagamentoData' && (isReceberEdit || isPagarEdit)) {
            return;
        }
        if (campoId !== 'pagamentoData' && campo.value) {
            // Não sobrescrever campos já preenchidos
            return;
        }

        campo.value = hojeStr;
    });
    
    return {
        primeiroDia: primeiroDiaStr,
        ultimoDia: ultimoDiaStr,
        hoje: hojeStr
    };
}

// ─── Helper: loading state em botoes de submit ────────────────────────────────
function setSubmitButtonLoading(btn, loading, loadingText) {
    if (!btn) return;
    if (loading) {
        btn.disabled = true;
        btn.setAttribute('aria-busy', 'true');
        btn.dataset.originalText = btn.textContent || btn.innerText || '';
        btn.textContent = loadingText || 'Processando...';
    } else {
        btn.disabled = false;
        btn.removeAttribute('aria-busy');
        btn.textContent = btn.dataset.originalText || 'Salvar';
    }
}

function getFinanceFirebaseService() {
    try {
        return window.firebaseService || window.FirebaseService || null;
    } catch (_) {
        return null;
    }
}

function isFirebaseOfflineModeFinancas() {
    try {
        if (window._FIREBASE_CONNECTED === false || window.firebaseConnected === false) return true;
    } catch (_) {}
    try {
        if (typeof navigator !== 'undefined' && navigator.onLine === false) return true;
    } catch (_) {}
    return false;
}

function limparContextoEmpresaFinancasInseguro() {
    try { window.appTenantId = null; } catch (_) {}
    try { window.companyInfo = null; } catch (_) {}
    try { localStorage.removeItem('company_info'); } catch (_) {}
    try {
        const svc = getFinanceFirebaseService();
        if (svc && typeof svc.setTenantId === 'function') svc.setTenantId(null);
    } catch (_) {}
}

async function ensureFinanceTenantContext(timeoutMs = 7000) {
    const startedAt = Date.now();
    if (typeof window !== 'undefined' && window.__siswebFirebaseServiceReady && typeof window.__siswebFirebaseServiceReady.then === 'function') {
        try {
            await Promise.race([
                window.__siswebFirebaseServiceReady,
                new Promise((resolve) => setTimeout(resolve, Math.min(timeoutMs, 2500)))
            ]);
        } catch (_) {}
    }
    let svc = getFinanceFirebaseService();
    const isOffline = isFirebaseOfflineModeFinancas();

    if (svc && typeof svc.resolveAuthenticatedTenant === 'function') {
        try {
            const resolved = await svc.resolveAuthenticatedTenant({ timeoutMs: Math.min(timeoutMs, 4500), allowCached: isOffline });
            if (resolved && resolved.success && resolved.companyId) return String(resolved.companyId);
            if (resolved && resolved.success && resolved.superAdmin) {
                limparContextoEmpresaFinancasInseguro();
                return '';
            }
        } catch (_) {}
    }

    while ((Date.now() - startedAt) < timeoutMs) {
        await new Promise((resolve) => setTimeout(resolve, 250));
        svc = getFinanceFirebaseService();
        if (svc && typeof svc.resolveAuthenticatedTenant === 'function') {
            try {
                const retry = await svc.resolveAuthenticatedTenant({ timeoutMs: 1000, allowCached: isOffline });
                if (retry && retry.success && retry.companyId) return String(retry.companyId);
            } catch (_) {}
        }
    }

    if (!isOffline) limparContextoEmpresaFinancasInseguro();
    return '';
}

// Funções de inicialização
async function inicializarSistema() {
    
    // ✅ CORREÇÃO: Usar função específica para configurar datas
    configurarDatasDoMesAtual();
    sanitizeAllPrintPreferences();
    
    // Carregar dados (aguarda tenant estar pronto)
    await carregarDados();
    
    // Configurar eventos
    configurarEventos();

    ensureFinanceAttachmentInput();
    updateManualAttachmentButtonState('receber');
    updateManualAttachmentButtonState('pagar');
    updateJurosRateFieldState('receber');
    updateJurosRateFieldState('pagar');
    
    // ✅ NOVO: Verificar hash na URL para abrir aba correta
    verificarHashURL();
    
    atualizarDashboard();
    try { cleanupTombstones(); } catch(_) {}
    try { 
        if (!window.financeCleanupTimer) { 
            window.financeCleanupTimer = setInterval(function(){ try { cleanupTombstones(); } catch(_) {} }, getCleanupIntervalMs()); 
        } 
    } catch(_) {}
}

function ensureFinanceAttachmentInput() {
    try {
        if (document.getElementById('financeAttachmentInput')) return;
        const input = document.createElement('input');
        input.type = 'file';
        input.id = 'financeAttachmentInput';
        input.style.display = 'none';
        input.accept = 'image/*,application/pdf,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document,application/vnd.ms-excel,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,text/plain';
        input.addEventListener('change', async (event) => {
            const file = event.target && event.target.files ? event.target.files[0] : null;
            event.target.value = '';
            if (!file) return;
            
            // Travar a interface do modal para evitar que o usuário o feche antes da conclusão do upload
            try { window.mostrarLoading(true, 'Enviando e salvando anexo...'); } catch(_) {}
            const modal = document.getElementById('anexosModal');
            if (modal) modal.style.pointerEvents = 'none';
            input.disabled = true;

            const ctx = window.__financeAttachmentCtx || {};
            const contaId = ctx.contaId;
            const tipo = ctx.tipo;
            const mode = ctx.mode || 'add';
            const index = typeof ctx.index === 'number' ? ctx.index : parseInt(ctx.index, 10);
            
            try {
                if (!contaId || !tipo) return;
                if (mode === 'replace' && !isNaN(index)) {
                    await substituirAnexoContaInternal(contaId, tipo, index, file);
                } else {
                    await anexarArquivoContaInternal(contaId, tipo, file);
                }
            } finally {
                // Destravar a interface independentemente de sucesso ou falha
                if (modal) modal.style.pointerEvents = 'auto';
                input.disabled = false;
                try { window.mostrarLoading(false); } catch(_) {}
            }
        });
        document.body.appendChild(input);
    } catch (_) {}
}

function getContaPrimaryAttachmentUrl(conta) {
    if (!conta) return null;
    if (conta.comprovanteUrl) return conta.comprovanteUrl;
    if (conta.anexoUrl) return conta.anexoUrl;
    if (Array.isArray(conta.anexos) && conta.anexos.length > 0) {
        const last = conta.anexos[conta.anexos.length - 1];
        if (last && last.url) return last.url;
    }
    return null;
}

function getManualAttachmentElements(tipo) {
    const key = tipo === 'pagar' ? 'pagar' : 'receber';
    return {
        input: document.getElementById(`${key}AnexoManual`),
        btn: document.getElementById(`${key}AnexoManualBtn`)
    };
}

function updateManualAttachmentButtonState(tipo) {
    const { input, btn } = getManualAttachmentElements(tipo);
    if (!btn) return;
    const file = input && input.files && input.files[0] ? input.files[0] : null;
    const editCtx = window.contaEmEdicao && window.contaEmEdicao.tipo === tipo ? window.contaEmEdicao : null;
    const editAttachmentUrl = editCtx && editCtx.contaOriginal
        ? getSafeFinanceDownloadUrl(getContaPrimaryAttachmentUrl(editCtx.contaOriginal))
        : null;
    const icon = btn.querySelector('i');
    if (file) {
        btn.title = 'Visualizar anexo selecionado';
        if (icon) icon.className = 'fas fa-eye';
        btn.dataset.hasAttachment = '1';
        btn.dataset.mode = 'preview-selected';
    } else if (editAttachmentUrl) {
        btn.title = 'Visualizar anexo atual';
        if (icon) icon.className = 'fas fa-eye';
        btn.dataset.hasAttachment = '1';
        btn.dataset.mode = 'preview-existing';
        btn.dataset.url = String(editAttachmentUrl);
    } else {
        btn.title = 'Anexar arquivo';
        if (icon) icon.className = 'fas fa-paperclip';
        btn.dataset.hasAttachment = '0';
        btn.dataset.mode = 'attach';
        btn.dataset.url = '';
    }
}

function onManualAttachmentSelected(tipo) {
    updateManualAttachmentButtonState(tipo);
}

function handleManualAttachmentAction(tipo) {
    const { input, btn } = getManualAttachmentElements(tipo);
    const file = input && input.files && input.files[0] ? input.files[0] : null;
    if (!input) return;
    if (!file && btn && btn.dataset.mode === 'preview-existing' && btn.dataset.url) {
        openFinanceAttachment(btn.dataset.url);
        return;
    }
    if (!file) {
        input.click();
        return;
    }
    try {
        const objectUrl = URL.createObjectURL(file);
        window.open(objectUrl, '_blank');
        setTimeout(() => { try { URL.revokeObjectURL(objectUrl); } catch (_) {} }, 30000);
    } catch (_) {
        input.click();
    }
}

function updateJurosRateFieldState(tipo) {
    const key = tipo === 'pagar' ? 'pagar' : 'receber';
    const tipoEl = document.getElementById(`${key}JurosTipo`);
    const taxaEl = document.getElementById(`${key}JurosTaxa`);
    if (!tipoEl || !taxaEl) return;
    const tipoKey = normalizeJurosTipoKey(tipoEl.value || 'none');
    if (tipoKey === 'none') {
        taxaEl.value = '0';
        taxaEl.disabled = true;
    } else {
        taxaEl.disabled = false;
    }
}

function updateParcelaAttachmentButtonState(tipo, index) {
    const input = document.getElementById(`${tipo}ParcelaAnexo_${index}`);
    const btn = document.getElementById(`${tipo}ParcelaAnexoBtn_${index}`);
    if (!btn || !input) return;
    window.generatedParcelAttachmentCache = window.generatedParcelAttachmentCache || {};
    const cache = window.generatedParcelAttachmentCache[tipo] || {};
    const file = input.files && input.files[0] ? input.files[0] : (cache[index] || null);
    const icon = btn.querySelector('i');
    if (file) {
        btn.title = 'Visualizar anexo da parcela';
        if (icon) icon.className = 'fas fa-eye';
    } else {
        btn.title = 'Anexar arquivo na parcela';
        if (icon) icon.className = 'fas fa-paperclip';
    }
}

function onParcelaAttachmentSelected(tipo, index) {
    window.generatedParcelAttachmentCache = window.generatedParcelAttachmentCache || {};
    window.generatedParcelAttachmentCache[tipo] = window.generatedParcelAttachmentCache[tipo] || {};
    const input = document.getElementById(`${tipo}ParcelaAnexo_${index}`);
    const file = input && input.files && input.files[0] ? input.files[0] : null;
    if (file) window.generatedParcelAttachmentCache[tipo][index] = file;
    else delete window.generatedParcelAttachmentCache[tipo][index];
    updateParcelaAttachmentButtonState(tipo, index);
}

function handleParcelaAttachmentAction(tipo, index) {
    const input = document.getElementById(`${tipo}ParcelaAnexo_${index}`);
    if (!input) return;
    window.generatedParcelAttachmentCache = window.generatedParcelAttachmentCache || {};
    const cache = window.generatedParcelAttachmentCache[tipo] || {};
    const file = input.files && input.files[0] ? input.files[0] : (cache[index] || null);
    if (!file) {
        input.click();
        return;
    }
    try {
        const objectUrl = URL.createObjectURL(file);
        window.open(objectUrl, '_blank');
        setTimeout(() => { try { URL.revokeObjectURL(objectUrl); } catch (_) {} }, 30000);
    } catch (_) {
        input.click();
    }
}

function getGeneratedParcelAttachmentFiles(tipo) {
    const out = {};
    try {
        window.generatedParcelAttachmentCache = window.generatedParcelAttachmentCache || {};
        const cache = window.generatedParcelAttachmentCache[tipo] || {};
        Object.keys(cache).forEach((k) => {
            const idx = parseInt(k, 10);
            if (Number.isInteger(idx) && idx >= 0 && cache[k]) out[idx] = cache[k];
        });
        const container = document.getElementById(`${tipo}ParcelasList`);
        if (!container) return out;
        const rows = Array.from(container.querySelectorAll('.installment-row[data-parcela-index]'));
        rows.forEach((row) => {
            const idx = parseInt(row.getAttribute('data-parcela-index') || '', 10);
            if (!Number.isInteger(idx) || idx < 0) return;
            const input = row.querySelector('input[type="file"]');
            const file = input && input.files && input.files[0] ? input.files[0] : null;
            if (file) out[idx] = file;
        });
    } catch (_) {}
    return out;
}

function captureGeneratedParcelState(tipo) {
    const state = [];
    try {
        const container = document.getElementById(`${tipo}ParcelasList`);
        if (!container) return state;
        const rows = Array.from(container.querySelectorAll('.installment-row[data-parcela-index]'));
        window.generatedParcelAttachmentCache = window.generatedParcelAttachmentCache || {};
        const cache = window.generatedParcelAttachmentCache[tipo] || {};
        rows.forEach((row, idx) => {
            const valueInput = row.querySelector('.parcel-value-input');
            const dateInput = row.querySelector('.parcel-date-input');
            const fileInput = row.querySelector('input[type="file"]');
            const file = fileInput && fileInput.files && fileInput.files[0] ? fileInput.files[0] : (cache[idx] || null);
            state.push({
                valor: valueInput ? parseCurrencyValue(valueInput.value || 0) : 0,
                data: dateInput ? String(dateInput.value || '') : '',
                file: file || null
            });
        });
    } catch (_) {}
    return state;
}

function buildDefaultParcelConfigs(valorTotal, numeroParcelas, dataVencimento) {
    const totalCents = Math.max(0, Math.round(parseCurrencyValue(valorTotal || 0) * 100));
    const baseDate = parseDateLocalSafe(dataVencimento || getTodayISODateLocal());
    const configs = [];
    if (!numeroParcelas || numeroParcelas < 1) return configs;
    const base = Math.floor(totalCents / numeroParcelas);
    let remainder = totalCents - (base * numeroParcelas);
    for (let i = 0; i < numeroParcelas; i++) {
        const cents = base + (remainder > 0 ? 1 : 0);
        if (remainder > 0) remainder -= 1;
        const dt = new Date(baseDate);
        dt.setMonth(dt.getMonth() + i);
        configs.push({
            valor: cents / 100,
            data: formatISODateLocal(dt)
        });
    }
    return configs;
}

function getGeneratedParcelConfigs(tipo, fallbackParcelas, fallbackValorTotal, fallbackDataVencimento) {
    try {
        const container = document.getElementById(`${tipo}ParcelasList`);
        if (!container) return buildDefaultParcelConfigs(fallbackValorTotal, fallbackParcelas, fallbackDataVencimento);
        const rows = Array.from(container.querySelectorAll('.installment-row[data-parcela-index]'));
        if (!rows.length) return buildDefaultParcelConfigs(fallbackValorTotal, fallbackParcelas, fallbackDataVencimento);
        return rows.map((row) => {
            const valueInput = row.querySelector('.parcel-value-input');
            const dateInput = row.querySelector('.parcel-date-input');
            return {
                valor: parseCurrencyValue(valueInput ? valueInput.value : 0),
                data: normalizeDateISOInput(dateInput ? dateInput.value : fallbackDataVencimento)
            };
        });
    } catch (_) {
        return buildDefaultParcelConfigs(fallbackValorTotal, fallbackParcelas, fallbackDataVencimento);
    }
}

function onParcelaValorChange(tipo, index) {
    try {
        const container = document.getElementById(`${tipo}ParcelasList`);
        if (!container) return;
        const rows = Array.from(container.querySelectorAll('.installment-row[data-parcela-index]'));
        if (!rows.length) return;
        const idx = Number(index);
        if (!Number.isInteger(idx) || idx < 0 || idx >= rows.length) return;
        const totalInput = document.getElementById(`${tipo}ValorTotal`);
        const totalCents = Math.max(0, Math.round(parseCurrencyValue(totalInput ? totalInput.value : 0) * 100));
        const valuesCents = rows.map((row) => {
            const input = row.querySelector('.parcel-value-input');
            return Math.max(0, Math.round(parseCurrencyValue(input ? input.value : 0) * 100));
        });
        const sumBefore = valuesCents.slice(0, idx).reduce((a, b) => a + b, 0);
        const maxCurrent = Math.max(0, totalCents - sumBefore);
        valuesCents[idx] = Math.min(valuesCents[idx], maxCurrent);
        const remainingRows = rows.length - (idx + 1);
        const remainingCents = Math.max(0, totalCents - (sumBefore + valuesCents[idx]));
        if (remainingRows > 0) {
            const base = Math.floor(remainingCents / remainingRows);
            let rem = remainingCents - (base * remainingRows);
            for (let i = idx + 1; i < rows.length; i++) {
                valuesCents[i] = base + (rem > 0 ? 1 : 0);
                if (rem > 0) rem -= 1;
            }
        }
        rows.forEach((row, i) => {
            const input = row.querySelector('.parcel-value-input');
            if (input) input.value = formatCurrencyNoSymbol(valuesCents[i] / 100);
        });
    } catch (_) {}
}

function reindexGeneratedParcelRows(tipo) {
    try {
        const container = document.getElementById(`${tipo}ParcelasList`);
        if (!container) return;
        window.generatedParcelAttachmentCache = window.generatedParcelAttachmentCache || {};
        const oldCache = window.generatedParcelAttachmentCache[tipo] || {};
        const newCache = {};
        const rows = Array.from(container.querySelectorAll('.installment-row'));
        const total = rows.length;
        rows.forEach((row, idx) => {
            const oldIdx = parseInt(row.getAttribute('data-parcela-index') || '', 10);
            const input = row.querySelector('input[type="file"]');
            const currentFile = input && input.files && input.files[0] ? input.files[0] : (oldCache[oldIdx] || null);
            if (currentFile) newCache[idx] = currentFile;
            row.setAttribute('data-parcela-index', String(idx));
            const labelEl = row.querySelector('.parcel-label');
            if (labelEl) labelEl.textContent = `Parcela ${idx + 1}/${total}`;
            const valueInput = row.querySelector('.parcel-value-input');
            if (valueInput) valueInput.setAttribute('onchange', `onParcelaValorChange('${tipo}', ${idx})`);
            if (input) {
                input.id = `${tipo}ParcelaAnexo_${idx}`;
                input.setAttribute('onchange', `onParcelaAttachmentSelected('${tipo}', ${idx})`);
            }
            const attachBtn = row.querySelector('.parcel-attach-btn');
            if (attachBtn) {
                attachBtn.id = `${tipo}ParcelaAnexoBtn_${idx}`;
                attachBtn.setAttribute('onclick', `handleParcelaAttachmentAction('${tipo}', ${idx})`);
            }
            updateParcelaAttachmentButtonState(tipo, idx);
        });
        window.generatedParcelAttachmentCache[tipo] = newCache;
        const wrapper = document.getElementById(`${tipo}ParcelasContainer`);
        if (wrapper) wrapper.style.display = total > 0 ? 'block' : 'none';
    } catch (_) {}
}

function normalizeFinanceAttachmentMeta(input = {}, legacy = false) {
    const source = input && typeof input === 'object' ? input : {};
    let normalized = null;
    if (window.storageService && typeof window.storageService.normalizeAttachmentMeta === 'function') {
        normalized = window.storageService.normalizeAttachmentMeta(source);
    }
    const base = normalized || {};
    const url = String(base.url || base.downloadURL || source.url || source.downloadURL || source.comprovanteUrl || source.anexoUrl || '').trim();
    return {
        ...source,
        ...base,
        url,
        downloadURL: url,
        storagePath: base.storagePath || source.storagePath || source.comprovanteStoragePath || source.path || null,
        name: base.name || source.name || source.fileName || 'arquivo',
        fileName: base.fileName || source.fileName || source.name || 'arquivo',
        contentType: base.contentType || source.contentType || source.mimeType || '',
        size: typeof base.size === 'number' ? base.size : (typeof source.size === 'number' ? source.size : null),
        uploadedAt: base.uploadedAt || source.uploadedAt || source.createdAt || source.data || null,
        uploadedBy: base.uploadedBy || source.uploadedBy || null,
        module: source.module || base.module || 'financas',
        legacy: legacy === true || base.legacy === true || source.legacy === true
    };
}

async function uploadAttachmentMetaForConta(file, tipo, contaId, uploadOptions = {}) {
    if (!file) return null;
    if (!window.storageService || typeof window.storageService.uploadFile !== 'function') return null;
    return uploadFinanceStorageMeta(file, `financas/anexos/${tipo}/${String(contaId)}`, {
        tipo,
        entityId: String(contaId)
    }, uploadOptions);
}

async function uploadFinanceStorageMeta(file, path, extra = {}, uploadOptions = {}) {
    if (!file) return null;
    if (!window.storageService || typeof window.storageService.uploadFile !== 'function') return null;
    let uploadResult = null;
    if (typeof window.storageService.uploadAttachment === 'function') {
        uploadResult = await window.storageService.uploadAttachment(file, path, {
            module: 'financas',
            ...extra,
            name: file && file.name ? String(file.name) : 'arquivo',
            fileName: file && file.name ? String(file.name) : 'arquivo',
            contentType: file && file.type ? String(file.type) : '',
            size: file && typeof file.size === 'number' ? file.size : null
        }, uploadOptions);
    } else if (typeof window.storageService.uploadFileWithPath === 'function') {
        uploadResult = await window.storageService.uploadFileWithPath(file, path, uploadOptions);
    } else {
        const urlOnly = await window.storageService.uploadFile(file, path, uploadOptions);
        uploadResult = { url: urlOnly, storagePath: null };
    }
    const meta = normalizeFinanceAttachmentMeta({
        ...(uploadResult || {}),
        module: 'financas',
        ...extra,
        name: file && file.name ? String(file.name) : ((uploadResult && (uploadResult.name || uploadResult.fileName)) || 'arquivo'),
        fileName: file && file.name ? String(file.name) : ((uploadResult && (uploadResult.fileName || uploadResult.name)) || 'arquivo'),
        contentType: file && file.type ? String(file.type) : ((uploadResult && uploadResult.contentType) || ''),
        size: file && typeof file.size === 'number' ? file.size : (uploadResult && typeof uploadResult.size === 'number' ? uploadResult.size : null),
        uploadedAt: (uploadResult && uploadResult.uploadedAt) || new Date().toISOString()
    });
    return meta && meta.url ? meta : null;
}

async function anexarArquivoContaInternal(contaId, tipo, file) {
    let uploadedMeta = null;
    try {
        if (!window.storageService || typeof window.storageService.uploadFile !== 'function') {
            mostrarNotificacao('Upload indisponível: Storage não inicializado.', 'warning');
            return;
        }
        const arr = tipo === 'receber' ? contasReceber : contasPagar;
        const conta = (arr || []).find(c => String(c && c.id) === String(contaId));
        if (!conta) {
            mostrarNotificacao('Conta não encontrada para anexar.', 'error');
            return;
        }

        mostrarNotificacao('Enviando anexo...', 'info');
        const meta = await uploadAttachmentMetaForConta(file, tipo, conta.id);
        uploadedMeta = meta;
        if (!meta || !meta.url) {
            mostrarNotificacao('Falha ao gerar URL do anexo.', 'error');
            return;
        }
        const original = cloneContaSnapshotForEdit(conta);
        const edited = cloneContaSnapshotForEdit(conta);
        edited.anexos.push(meta);
        const committed = await updateFinanceAccountAuthoritative(tipo, original, edited, {
            operationId: createFinanceOperationId('attach_account')
        });
        replaceFinanceAccountInMemory(tipo, conta.id, committed.account);
        renderAnexosModalTable();
        if (tipo === 'receber') carregarTabelaReceber(lastFiltroReceber || {});
        else carregarTabelaPagar(lastFiltroPagar || {});
        atualizarDashboard();
        mostrarNotificacao('Anexo adicionado com sucesso.', 'success');
    } catch (e) {
        console.error('Erro ao anexar arquivo:', e);
        if (uploadedMeta && e && e.financeReconciledAccount) {
            const remoteAttachments = getContaAttachments(e.financeReconciledAccount);
            const uploadedPath = resolveAttachmentStoragePath(uploadedMeta);
            const isReferenced = remoteAttachments.some((item) => isSameStorageObject(
                resolveAttachmentStoragePath(item),
                uploadedPath
            ));
            if (!isReferenced) await deleteStorageFileSafely(uploadedPath, uploadedMeta.url);
        }
        mostrarNotificacao('Falha ao anexar arquivo. Verifique permissões e tipo de arquivo.', 'error');
    } finally {
        // Habilitar a interface novamente
        const modal = document.getElementById('anexosModal');
        if (modal) modal.style.pointerEvents = 'auto';
        const fileInput = document.getElementById('anexoFileInput');
        if (fileInput) fileInput.disabled = false;
        try { window.mostrarLoading(false); } catch(_) {}
    }
}

async function substituirAnexoContaInternal(contaId, tipo, index, file) {
    try {
        if (!window.storageService || typeof window.storageService.uploadFile !== 'function') {
            mostrarNotificacao('Upload indisponível: Storage não inicializado.', 'warning');
            return;
        }
        const arr = tipo === 'receber' ? contasReceber : contasPagar;
        const conta = (arr || []).find(c => String(c && c.id) === String(contaId));
        if (!conta) {
            mostrarNotificacao('Conta não encontrada para substituir anexo.', 'error');
            return;
        }

        const attachments = getContaAttachments(conta);
        const target = attachments[index];
        if (!target) {
            mostrarNotificacao('Anexo não encontrado para substituição.', 'warning');
            return;
        }

        const previousStoragePath = resolveAttachmentStoragePath(target);
        mostrarNotificacao('Enviando novo anexo...', 'info');
        const newMeta = await uploadAttachmentMetaForConta(file, tipo, conta.id, {
            replaceStoragePath: previousStoragePath
        });
        if (!newMeta || !newMeta.url) {
            mostrarNotificacao('Falha ao gerar URL do anexo.', 'error');
            return;
        }
        newMeta.name = newMeta.name || target.name || 'arquivo';
        newMeta.fileName = newMeta.fileName || target.fileName || newMeta.name;
        newMeta.contentType = newMeta.contentType || target.contentType || '';

        const original = cloneContaSnapshotForEdit(conta);
        const isTopLevelReceipt = !original.anexos.some((item) => String(item && item.url) === String(target.url))
            && String(original.comprovanteUrl || '') === String(target.url);
        if (isTopLevelReceipt) {
            await updateFinancePaymentReceiptAuthoritative(tipo, original, 'total', {
                url: newMeta.url,
                storagePath: resolveAttachmentStoragePath(newMeta)
            }, createFinanceOperationId('replace_receipt'));
        } else {
            const edited = cloneContaSnapshotForEdit(conta);
            applyAttachmentReplacement(edited, index, newMeta);
            const committed = await updateFinanceAccountAuthoritative(tipo, original, edited, {
                operationId: createFinanceOperationId('replace_attachment')
            });
            replaceFinanceAccountInMemory(tipo, conta.id, committed.account);
        }
        const newStoragePath = resolveAttachmentStoragePath(newMeta);
        if (previousStoragePath && !isSameStorageObject(previousStoragePath, newStoragePath)) {
            await deleteStorageFileSafely(previousStoragePath, target.url);
        }
        renderAnexosModalTable();
        if (tipo === 'receber') carregarTabelaReceber(lastFiltroReceber || {});
        else carregarTabelaPagar(lastFiltroPagar || {});
        atualizarDashboard();
        mostrarNotificacao('Anexo substituído com sucesso.', 'success');
    } catch (e) {
        console.error('Erro ao substituir anexo:', e);
        mostrarNotificacao('Falha ao substituir anexo.', 'error');
    }
}

function getContaAttachments(conta) {
    const list = [];
    const push = (meta, legacy = false) => {
        const normalized = normalizeFinanceAttachmentMeta(meta, legacy);
        if (normalized && normalized.url) list.push(normalized);
    };
    if (Array.isArray(conta && conta.anexos)) {
        conta.anexos.forEach(a => {
            if (!a || typeof a !== 'object') return;
            push(a, false);
        });
    }

    const legacyUrls = [conta && conta.comprovanteUrl, conta && conta.anexoUrl]
        .filter(Boolean)
        .map(u => String(u));
    legacyUrls.forEach(url => {
        if (list.some(a => String(a.url) === url)) return;
        push({ url, storagePath: null, name: 'anexo', contentType: '', size: null, uploadedAt: null }, true);
    });

    return list;
}

function getFinanceAccountStorageReferences(conta) {
    const references = getContaAttachments(conta).slice();
    const history = Array.isArray(conta && conta.historicosPagamento)
        ? conta.historicosPagamento
        : [];
    history.forEach((payment) => {
        if (!payment || (!payment.comprovanteUrl && !payment.comprovanteStoragePath)) return;
        references.push(normalizeFinanceAttachmentMeta({
            url: payment.comprovanteUrl || '',
            storagePath: payment.comprovanteStoragePath || null,
            name: 'comprovante'
        }, true));
    });
    const seen = new Set();
    return references.filter((reference) => {
        const storagePath = resolveAttachmentStoragePath(reference);
        if (!storagePath || seen.has(storagePath)) return false;
        seen.add(storagePath);
        return true;
    });
}

async function cleanupDeletedFinanceAccountStorage(conta, operationId) {
    const pending = [];
    for (const reference of getFinanceAccountStorageReferences(conta)) {
        const storagePath = resolveAttachmentStoragePath(reference);
        const removed = await deleteStorageFileSafely(storagePath, reference.url);
        if (!removed) pending.push({ storagePath, url: reference.url || null });
    }
    if (pending.length) {
        const current = Array.isArray(window.__financePendingStorageReview)
            ? window.__financePendingStorageReview
            : [];
        window.__financePendingStorageReview = current.concat(pending.map((item) => ({
            ...item,
            operationId,
            createdAt: new Date().toISOString()
        }))).slice(-20);
    }
    return pending.length === 0;
}

function applyAttachmentReplacement(conta, index, newMeta) {
    const attachments = getContaAttachments(conta);
    const target = attachments[index];
    if (!target) return;

    if (Array.isArray(conta.anexos)) {
        const i = conta.anexos.findIndex(a => a && String(a.url) === String(target.url));
        if (i >= 0) {
            conta.anexos[i] = { ...(conta.anexos[i] || {}), ...newMeta };
        } else {
            conta.anexos.push(newMeta);
        }
    } else {
        conta.anexos = [newMeta];
    }
    if (String(conta.anexoUrl || '') === String(target.url)) conta.anexoUrl = newMeta.url;
    if (String(conta.comprovanteUrl || '') === String(target.url)) conta.comprovanteUrl = newMeta.url;
    conta.anexoUrl = newMeta.url;
}

function normalizeAttachmentsList(value) {
    const raw = Array.isArray(value)
        ? value
        : (value && typeof value === 'object' ? Object.values(value) : []);
    return raw
        .filter((item) => item && typeof item === 'object')
        .map((item) => normalizeFinanceAttachmentMeta(item, item.legacy === true))
        .filter((item) => item && (item.url || item.storagePath));
}

function cloneContaSnapshotForEdit(conta) {
    const source = conta && typeof conta === 'object' ? conta : {};
    const clone = JSON.parse(JSON.stringify(source));
    clone.anexos = normalizeAttachmentsList(clone.anexos);
    clone.historicosPagamento = Array.isArray(clone.historicosPagamento) ? clone.historicosPagamento : [];
    return clone;
}

function isFinanceDevLogEnabled() {
    try {
        if (window.__FINANCE_DEV_LOG__ === true) return true;
        if (window.__DEBUG_MODE__ === true) return true;
        if (window.localStorage && window.localStorage.getItem('finance_dev_log') === '1') return true;
    } catch (_) {}
    return false;
}

function financeDevLog(eventName, payload) {
    if (!isFinanceDevLogEnabled()) return;
    try {
        const stamp = new Date().toISOString();
        console.log(`[financas-dev][${stamp}] ${eventName}`, payload || {});
    } catch (_) {}
}

function extractStoragePathFromDownloadUrl(url) {
    try {
        const raw = String(url || '').trim();
        if (!raw) return null;
        const parsed = new URL(raw);
        const marker = '/o/';
        const idx = parsed.pathname.indexOf(marker);
        if (idx < 0) return null;
        const encodedPath = parsed.pathname.slice(idx + marker.length);
        if (!encodedPath) return null;
        return decodeURIComponent(encodedPath);
    } catch (_) {
        return null;
    }
}

function resolveAttachmentStoragePath(meta) {
    const source = meta && typeof meta === 'object' ? meta : {};
    const raw = String(
        source.storagePath
        || source.comprovanteStoragePath
        || source.path
        || extractStoragePathFromDownloadUrl(source.url || source.downloadURL || source.comprovanteUrl || source.anexoUrl)
        || ''
    ).trim();
    return String(extractStoragePathFromDownloadUrl(raw) || raw || '').trim();
}

function isSameStorageObject(a, b) {
    const left = String(a || '').trim();
    const right = String(b || '').trim();
    return !!left && !!right && left === right;
}

async function deleteStorageFileSafely(storagePath, url) {
    const candidates = [];
    const pushCandidate = (value) => {
        const v = String(value || '').trim();
        if (!v) return;
        if (!candidates.includes(v)) candidates.push(v);
    };
    pushCandidate(storagePath);
    pushCandidate(extractStoragePathFromDownloadUrl(url));
    if (!candidates.length && !url) return true;

    if (window.firebaseService && window.firebaseService.storage && typeof window.firebaseService.storage.delete === 'function') {
        for (const candidate of candidates) {
            try {
                await window.firebaseService.storage.delete(candidate);
                return true;
            } catch (_) {}
        }
    }
    if (url && window.firebase && typeof window.firebase.storage === 'function') {
        try {
            await window.firebase.storage().refFromURL(String(url)).delete();
            return true;
        } catch (_) {}
    }
    return false;
}

function resolveHistoricoPagamento(conta, registroRef) {
    if (!conta || typeof conta !== 'object') return null;
    if (registroRef === 'total') {
        return {
            kind: 'total',
            url: conta.comprovanteUrl || null,
            storagePath: conta.comprovanteStoragePath || null
        };
    }
    const idx = Number(registroRef);
    if (!Number.isInteger(idx) || idx < 0) return null;
    const historicos = Array.isArray(conta.historicosPagamento) ? conta.historicosPagamento : [];
    const pagamento = historicos[idx];
    if (!pagamento || typeof pagamento !== 'object') return null;
    return {
        kind: 'historico',
        index: idx,
        url: pagamento.comprovanteUrl || null,
        storagePath: pagamento.comprovanteStoragePath || null
    };
}

async function removerAnexoContaInternal(contaId, tipo, index) {
    try {
        const arr = tipo === 'receber' ? contasReceber : contasPagar;
        const conta = (arr || []).find(c => String(c && c.id) === String(contaId));
        if (!conta) {
            mostrarNotificacao('Conta não encontrada.', 'error');
            return;
        }
        const attachments = getContaAttachments(conta);
        const target = attachments[index];
        if (!target) {
            mostrarNotificacao('Anexo não encontrado.', 'warning');
            return;
        }

        if (!confirm('Remover este anexo?')) return;

        const original = cloneContaSnapshotForEdit(conta);
        const isTopLevelReceipt = !original.anexos.some((item) => String(item && item.url) === String(target.url))
            && String(original.comprovanteUrl || '') === String(target.url);
        if (isTopLevelReceipt) {
            await updateFinancePaymentReceiptAuthoritative(
                tipo,
                original,
                'total',
                { url: null, storagePath: null },
                createFinanceOperationId('remove_receipt')
            );
        } else {
            const edited = cloneContaSnapshotForEdit(conta);
            edited.anexos = edited.anexos.filter((item) => String(item && item.url) !== String(target.url));
            const committed = await updateFinanceAccountAuthoritative(tipo, original, edited, {
                operationId: createFinanceOperationId('remove_attachment')
            });
            replaceFinanceAccountInMemory(tipo, conta.id, committed.account);
        }
        await deleteStorageFileSafely(resolveAttachmentStoragePath(target), target.url);
        renderAnexosModalTable();
        if (tipo === 'receber') carregarTabelaReceber(lastFiltroReceber || {});
        else carregarTabelaPagar(lastFiltroPagar || {});
        atualizarDashboard();
        mostrarNotificacao('Anexo removido.', 'success');
    } catch (e) {
        console.error('Erro ao remover anexo:', e);
        mostrarNotificacao('Falha ao remover anexo.', 'error');
    }
}

function abrirModalAnexos(contaId, tipo) {
    try {
        window.__financeAttachmentsModalCtx = { contaId: String(contaId), tipo: String(tipo) };
        const modal = document.getElementById('anexosModal');
        const title = document.getElementById('anexosModalTitle');
        const meta = document.getElementById('anexosModalMeta');
        if (title) title.textContent = `Anexos • ${tipo === 'receber' ? 'Receber' : 'Pagar'}`;
        if (meta) meta.textContent = `Conta: ${String(contaId)}`;
        renderAnexosModalTable();
        if (modal) modal.style.display = 'block';
    } catch (_) {}
}

function renderAnexosModalTable() {
    const tbody = document.getElementById('anexosTableBody');
    if (!tbody) return;
    const ctx = window.__financeAttachmentsModalCtx || {};
    const contaId = ctx.contaId;
    const tipo = ctx.tipo;
    const arr = tipo === 'receber' ? contasReceber : contasPagar;
    const conta = (arr || []).find(c => String(c && c.id) === String(contaId));
    const metaEl = document.getElementById('anexosModalMeta');
    if (!conta) {
        tbody.innerHTML = '<tr><td colspan="5" style="text-align:center; padding: 14px;">Conta não encontrada</td></tr>';
        if (metaEl) metaEl.textContent = `Conta: ${String(contaId)}`;
        return;
    }
    const atts = getContaAttachments(conta);
    if (metaEl) metaEl.textContent = `Conta: ${String(contaId)}`;
    if (!atts.length) {
        tbody.innerHTML = '<tr><td colspan="5" style="text-align:center; padding: 14px;">Nenhum anexo cadastrado</td></tr>';
        return;
    }
    const fmtSize = (n) => {
        if (typeof n !== 'number' || !isFinite(n) || n <= 0) return '-';
        const kb = n / 1024;
        if (kb < 1024) return `${kb.toFixed(0)} KB`;
        return `${(kb / 1024).toFixed(1)} MB`;
    };
    const fmtDate = (s) => {
        try {
            if (!s) return '-';
            const d = new Date(String(s));
            if (isNaN(d.getTime())) return '-';
            return d.toLocaleString('pt-BR');
        } catch (_) { return '-'; }
    };
    const contaIdArg = getFinanceInlineStringArgument(conta.id);
    const tipoArg = getFinanceInlineStringArgument(tipo);

    tbody.innerHTML = atts.map((a, idx) => {
        const rawName = String(a.name || 'arquivo');
        const name = escapeFinanceHtml(rawName);
        const type = escapeFinanceHtml(a.contentType || (a.legacy ? 'legado' : '-'));
        const uploaded = escapeFinanceHtml(fmtDate(a.uploadedAt));
        const urlArg = getFinanceInlineStringArgument(a.url);
        const filenameArg = getFinanceInlineStringArgument(rawName);
        const storagePathArg = getFinanceInlineStringArgument(a.storagePath || '');
        
        // Criar função de download nativo para forçar download em vez de abrir nova aba
        const downloadBtnHtml = `
            <button type="button" class="btn btn-primary btn-small" style="min-width:28px;" onclick="baixarAnexoForcado(${urlArg}, ${filenameArg}, ${storagePathArg})" title="Baixar anexo">
                <i class="fas fa-download"></i>
            </button>
        `;

        return `
            <tr>
                <td title="${name}">${name}</td>
                <td>${type}</td>
                <td style="text-align:right;">${fmtSize(a.size)}</td>
                <td>${uploaded}</td>
                <td>
                    <button type="button" class="btn btn-primary btn-small" style="min-width:28px;" onclick="openFinanceAttachment(${urlArg})" title="Ver anexo">
                        <i class="fas fa-eye"></i>
                    </button>
                    ${downloadBtnHtml}
                    <button type="button" class="btn btn-primary btn-small" style="min-width:28px;" onclick="substituirAnexoConta(${contaIdArg}, ${tipoArg}, ${idx})" title="Substituir">
                        <i class="fas fa-upload"></i>
                    </button>
                    <button type="button" class="btn btn-danger btn-small" style="min-width:28px;" onclick="removerAnexoConta(${contaIdArg}, ${tipoArg}, ${idx})" title="Excluir">
                        <i class="fas fa-trash"></i>
                    </button>
                </td>
            </tr>
        `;
    }).join('');
}

function buildForcedDownloadUrl(rawUrl, filename) {
    try {
        const safeUrl = getSafeFinanceDownloadUrl(rawUrl);
        if (!safeUrl) throw new Error('URL de anexo inválida');
        const u = new URL(safeUrl);
        const name = String(filename || 'anexo_financas').trim() || 'anexo_financas';
        u.searchParams.set('response-content-disposition', `attachment; filename="${name}"`);
        return u.toString();
    } catch (_) {
        return '';
    }
}

// Download confiável sem XHR/fetch (evita CORS): usa Content-Disposition via query param
window.baixarAnexoForcado = function(url, filename, storagePath) {
    try {
        const cleanName = String(filename || 'anexo_financas').trim() || 'anexo_financas';
        const dlUrl = buildForcedDownloadUrl(url, cleanName);
        if (!dlUrl) throw new Error('URL de anexo inválida');
        mostrarNotificacao('Iniciando download...', 'info');
        const a = document.createElement('a');
        a.style.display = 'none';
        a.href = dlUrl;
        a.target = '_self';
        a.rel = 'noopener';
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
    } catch (e) {
        console.warn('Falha ao iniciar download, abrindo anexo:', e);
        openFinanceAttachment(url);
    }
};

function anexarArquivoContaPeloModal() {
    const ctx = window.__financeAttachmentsModalCtx || {};
    if (!ctx.contaId || !ctx.tipo) return;
    anexarArquivoConta(ctx.contaId, ctx.tipo);
}

function substituirAnexoConta(contaId, tipo, index) {
    try {
        ensureFinanceAttachmentInput();
        window.__financeAttachmentCtx = { contaId: String(contaId), tipo: String(tipo), mode: 'replace', index };
        const input = document.getElementById('financeAttachmentInput');
        if (input) input.click();
    } catch (_) {}
}

function removerAnexoConta(contaId, tipo, index) {
    removerAnexoContaInternal(contaId, tipo, index);
}

function anexarArquivoConta(contaId, tipo) {
    try {
        ensureFinanceAttachmentInput();
        window.__financeAttachmentCtx = { contaId: String(contaId), tipo: String(tipo) };
        const input = document.getElementById('financeAttachmentInput');
        if (input) input.click();
    } catch (_) {}
}

// ✅ NOVA FUNÇÃO: Verificar hash na URL para abrir aba correta
function verificarHashURL() {
    try {
        const hash = window.location.hash.substring(1); // Remove o #
        if (hash) {
            setTimeout(() => {
                if (hash === 'receber' || hash === 'pagar' || hash === 'dashboard') {
                    showTab(hash);
                }
            }, 500); // Aguardar carregamento completo
        }
    } catch (error) {
        console.warn('⚠️ Erro ao processar hash da URL:', error);
    }
}

// Função para mostrar loading global melhorado
function mostrarLoading(show = true, texto = 'Carregando...') {
    let overlay = document.getElementById('globalLoadingOverlay');
    if (!overlay && !show) return;
    
    if (!overlay) {
        overlay = document.createElement('div');
        overlay.id = 'globalLoadingOverlay';
        overlay.className = 'loading-overlay';
        overlay.innerHTML = `
            <div class="loading-content">
                <div class="loading-spinner"></div>
                <div class="loading-text">${texto}</div>
            </div>
        `;
        document.body.appendChild(overlay);
    }
    
    const textEl = overlay.querySelector('.loading-text');
    if (textEl) textEl.textContent = texto;

    if (show) {
        overlay.style.display = 'flex';
        requestAnimationFrame(() => overlay.classList.add('active'));
    } else {
        overlay.classList.remove('active');
        setTimeout(() => {
            overlay.style.display = 'none';
        }, 300);
    }
}

// Função para carregar dados
async function carregarDados() {
    try {
        try {
            if (window.financeGlobalOverlayTimer) clearTimeout(window.financeGlobalOverlayTimer);
        } catch (_) {}
        window.financeGlobalOverlayShown = false;
        window.financeGlobalOverlayTimer = setTimeout(() => {
            try {
                window.financeGlobalOverlayShown = true;
                // mostrarLoading(true, 'Sincronizando dados...');
            } catch (_) {}
        }, 600);
        // Overlay para carregamento inicial - DESATIVADO PARA LAZY LOADING
        /*
        try {
            const overlay = document.getElementById('financeLoadingOverlay');
            if (overlay) overlay.style.display = 'flex';
        } catch (_) {}
        */
        
        // Mostrar apenas um toast discreto
        if (window.Utils && window.Utils.showToast) {
            // window.Utils.showToast('Atualizando dados financeiros...', 'info');
        }

        window.financeInitialLoading = true;
        const firebaseAvailable = !!(window.firebaseService && typeof window.firebaseService.loadFromFirebase === 'function');
        const financeTenant = await ensureFinanceTenantContext();
        if (firebaseAvailable && !financeTenant) {
            contasReceber = [];
            contasPagar = [];
            clientes = [];
            fornecedores = [];
            funcionarios = [];
            window.financeTableOverlayOnce = true;
            carregarTabelaReceber();
            carregarTabelaPagar();
            atualizarDashboard();
            mostrarNotificacao('Empresa da sessão não identificada. Faça login novamente para carregar o Financeiro.', 'error');
            return;
        }
        financeSessionTenant = String(financeTenant || '');
        // Garantir que company_info esteja carregado em memória
        try {
            const ci = localStorage.getItem('company_info');
            if (ci) {
                const cachedCompany = JSON.parse(ci) || {};
                const cachedTenant = String(
                    cachedCompany.companyId
                    || cachedCompany.companyID
                    || cachedCompany.tenantId
                    || cachedCompany.id
                    || ''
                ).trim();
                window.companyInfo = cachedTenant === financeSessionTenant ? cachedCompany : null;
            } else {
                window.companyInfo = null;
            }
        } catch (e) { console.warn('Falha ao preparar companyInfo:', e); }
        
        const monthKey = getTodayISODateLocal().slice(0,7);
        
        // 2. Carregamento Paralelo de Dados (Otimizado)
        if (firebaseAvailable) {
            // BLAZE OPTIMIZATION: Use loadData with limit definitions to cap maximum reads per month chunk (Safety limit)
            const fetchOptions = { limitToLast: 1500, orderByKey: true };
            const promises = [
                (window.firebaseService.loadData ? window.firebaseService.loadData(`financas/receber/${monthKey}`, fetchOptions) : window.firebaseService.loadFromFirebase(`financas/receber/${monthKey}`)).catch(() => ({ data: [] })),
                (window.firebaseService.loadData ? window.firebaseService.loadData(`financas/pagar/${monthKey}`, fetchOptions) : window.firebaseService.loadFromFirebase(`financas/pagar/${monthKey}`)).catch(() => ({ data: [] })),
                window.firebaseService.loadFromFirebase(`finance_snapshots/${monthKey}`).catch(() => null)
            ];

            const [recRes, pagRes, snapRes] = await Promise.all(promises);

            contasReceber = (recRes && recRes.success && recRes.data) ? (Array.isArray(recRes.data) ? recRes.data : Object.values(recRes.data || {})) : [];
            contasPagar = (pagRes && pagRes.success && pagRes.data) ? (Array.isArray(pagRes.data) ? pagRes.data : Object.values(pagRes.data || {})) : [];
            
            window.financeSnapshot = (snapRes && snapRes.success && snapRes.data) ? snapRes.data : null;
            fornecedores = [];
            funcionarios = [];
            clientes = [];
        } else {
            contasReceber = [];
            contasPagar = [];
            clientes = [];
            fornecedores = [];
            funcionarios = [];
        }

        // Produção: não recuperar dados de localStorage para RTDB
        
        // Normalizar categorias carregadas (consistência histórica)
        try {
            contasReceber = (Array.isArray(contasReceber) ? contasReceber : []).map(c => {
                const categoria = normalizeCategoriaKey(c && c.categoria);
                const cliente = (typeof c?.cliente === 'string' && isAllCaps(c.cliente)) ? toTitleCasePt(c.cliente) : c?.cliente;
                const jurosTipo = normalizeJurosTipoKey(c && c.jurosTipo);
                const jurosTaxa = parseJurosTaxa(c && c.jurosTaxa);
                return { ...c, categoria, cliente, jurosTipo, jurosTaxa };
            });
            contasPagar = (Array.isArray(contasPagar) ? contasPagar : []).map(c => {
                const categoria = normalizeCategoriaKey(c && c.categoria);
                const fornecedor = (typeof c?.fornecedor === 'string' && isAllCaps(c.fornecedor)) ? toTitleCasePt(c.fornecedor) : c?.fornecedor;
                const funcionarioNome = (typeof c?.funcionarioNome === 'string' && isAllCaps(c.funcionarioNome)) ? toTitleCasePt(c.funcionarioNome) : c?.funcionarioNome;
                const jurosTipo = normalizeJurosTipoKey(c && c.jurosTipo);
                const jurosTaxa = parseJurosTaxa(c && c.jurosTaxa);
                return { ...c, categoria, fornecedor, funcionarioNome, jurosTipo, jurosTaxa };
            });
        // Produção: não persistir agregados em localStorage
    } catch (_) {}

        

        // Renderização inicial: evitar duplicidade com monthsLoaded
        window.financeTableOverlayOnce = true;
        
        // Sincronizar com cache local atualizado (para refletir edições recentes de outros módulos)
        if (window.firebaseService && typeof window.firebaseService.loadFromFirebase !== 'function') {
             // Se não tiver firebase, tenta recarregar do local storage se possível
             try {
                 const localPagar = localStorage.getItem('contasPagar');
                 if (localPagar) {
                     const parsed = JSON.parse(localPagar);
                     if (Array.isArray(parsed) && parsed.length > 0) {
                         // Mesclar com o que veio do firebase se for mais recente?
                         // Por enquanto, confiar no firebase se disponível.
                         if (contasPagar.length === 0) contasPagar = parsed;
                     }
                 }
             } catch(e) {}
        }

        carregarTabelaReceber(lastFiltroReceber || {});
        carregarTabelaPagar();
        
        // Em segundo plano (sem await na inicialização), carregar dados extras para os filtros
        (async () => {
            try {
                const [fornRes, funcRes, cliRes] = await Promise.all([
                    window.firebaseService.loadFromFirebase('fornecedores').catch(() => ({ success: false })),
                    window.firebaseService.loadFromFirebase('funcionarios').catch(() => ({ success: false })),
                    (window.clientService && typeof window.clientService.getClients === 'function') 
                        ? window.clientService.getClients(true).catch(() => []) 
                        : window.firebaseService.loadFromFirebase('clients').catch(() => ({ success: false }))
                ]);
                
                if (fornRes && fornRes.success && fornRes.data) {
                    fornecedores = Array.isArray(fornRes.data) ? fornRes.data : Object.values(fornRes.data);
                }
                if (funcRes && funcRes.success && funcRes.data) {
                    funcionarios = Array.isArray(funcRes.data) ? funcRes.data : Object.values(funcRes.data);
                }
                if (cliRes) {
                    if (Array.isArray(cliRes)) {
                        clientes = cliRes;
                    } else if (cliRes.success && cliRes.data) {
                        clientes = Array.isArray(cliRes.data) ? cliRes.data : Object.values(cliRes.data);
                    }
                }
                
                atualizarSelectFornecedores();
                atualizarSelectClientes();
            } catch (e) {
                console.warn("⚠️ Falha no background load de auxiliares:", e);
            }
        })();

        atualizarSelectCategorias();
        atualizarSelectTipos();
        /*
        try {
            const key = 'finance_categorias_tipos_migradas_v1';
            if (!localStorage.getItem(key)) {
                const resNorm = await normalizarFinanceiroCategoriasETipos({ dryRun: false });
                if (resNorm && resNorm.success) localStorage.setItem(key, '1');
            }
        } catch(_) {}
        */
        
        // ✅ CORREÇÃO: Atualizar dashboard após carregar dados
        atualizarDashboard();
        
        // ✅ CORREÇÃO: Reconfigurar datas após carregamento (caso tenham sido resetadas)
        configurarDatasDoMesAtual();
        
        // ✅ Forçar atualização do sininho de alertas global
        try {
            const menu = document.querySelector('main-menu');
            if (menu && typeof menu.recomputeSystemAlerts === 'function') {
                menu.recomputeSystemAlerts();
            }
        } catch (_) {}
        
        mostrarNotificacao("Sistema financeiro carregado com sucesso!", "success");
        try {
            if (window.financeGlobalOverlayTimer) {
                clearTimeout(window.financeGlobalOverlayTimer);
                window.financeGlobalOverlayTimer = null;
            }
        } catch (_) {}
        mostrarLoading(false);
        window.financeInitialLoading = false;
        window.financeInitializingFilters = false;
        
    } catch (error) {
        console.error("❌ Erro crítico ao carregar dados:", error);
        mostrarNotificacao("Erro ao carregar sistema financeiro", "error");
        try {
            if (window.financeGlobalOverlayTimer) {
                clearTimeout(window.financeGlobalOverlayTimer);
                window.financeGlobalOverlayTimer = null;
            }
        } catch (_) {}
        mostrarLoading(false);
        window.financeInitialLoading = false;
        
        // Fallback para arrays vazios em caso de erro crítico
        contasReceber = [];
        contasPagar = [];
        window.financeTableOverlayOnce = true;
        carregarTabelaReceber();
        carregarTabelaPagar();
    }
}

 

//

function configurarEventos() {
    // Eventos de submit dos formulários
    document.getElementById('receberForm').addEventListener('submit', salvarContaReceber);
    document.getElementById('pagarForm').addEventListener('submit', salvarContaPagar);
    document.getElementById('pagamentoForm').addEventListener('submit', confirmarPagamento);
    
    // Eventos de mudança no número de parcelas
    document.getElementById('receberParcelas').addEventListener('change', function() {
        if (parseInt(this.value) > 1) {
            document.getElementById('receberParcelasContainer').style.display = 'block';
        } else {
            document.getElementById('receberParcelasContainer').style.display = 'none';
        }
    });
    
    document.getElementById('pagarParcelas').addEventListener('change', function() {
        if (parseInt(this.value) > 1) {
            document.getElementById('pagarParcelasContainer').style.display = 'block';
        } else {
            document.getElementById('pagarParcelasContainer').style.display = 'none';
        }
    });

    const receberJurosTipoEl = document.getElementById('receberJurosTipo');
    if (receberJurosTipoEl) {
        receberJurosTipoEl.addEventListener('change', () => updateJurosRateFieldState('receber'));
    }
    const pagarJurosTipoEl = document.getElementById('pagarJurosTipo');
    if (pagarJurosTipoEl) {
        pagarJurosTipoEl.addEventListener('change', () => updateJurosRateFieldState('pagar'));
    }
    const receberTipoEl = document.getElementById('receberTipo');
    if (receberTipoEl) {
        receberTipoEl.addEventListener('change', function() {
            const isBoleto = this.value === 'boleto';
            const multaCont = document.getElementById('receberMultaContainer');
            if (multaCont) {
                multaCont.style.display = isBoleto ? 'block' : 'none';
            }
            if (isBoleto) {
                const multaField = document.getElementById('receberMultaTaxa');
                if (multaField && (!multaField.value || parseFloat(multaField.value) === 0)) {
                    multaField.value = '2.00';
                }
                const jurosTipoField = document.getElementById('receberJurosTipo');
                const jurosTaxaField = document.getElementById('receberJurosTaxa');
                if (jurosTipoField && (!jurosTipoField.value || jurosTipoField.value === 'none')) {
                    jurosTipoField.value = 'simples';
                    if (jurosTaxaField && (!jurosTaxaField.value || parseFloat(jurosTaxaField.value) === 0)) {
                        jurosTaxaField.value = '1.00';
                    }
                    updateJurosRateFieldState('receber');
                }
            }
        });
    }
    
    // Formatação sem símbolo para Valor Total (receber/pagar)
    ['receberValorTotal', 'pagarValorTotal', 'pagamentoValor'].forEach(campoId => {
        const campo = document.getElementById(campoId);
        if (campo) {
            campo.addEventListener('blur', function() {
                this.value = formatCurrencyNoSymbol(this.value);
            });
        }
    });
    // Auto-filtrar ao alterar filtros
    const autoFilters = [
        'filtroReceberStatus','filtroReceberCliente','filtroReceberDataInicio','filtroReceberDataFim','filtroReceberNumeroPedido',
        'filtroReceberCategoria','filtroReceberTipo',
        'filtroPagarStatus','filtroPagarFornecedor','filtroPagarNumeroPedido','filtroPagarDataInicio','filtroPagarDataFim',
        'filtroPagarCategoria','filtroPagarTipo'
    ];
    window.financeInitializingFilters = true;
    autoFilters.forEach(id => {
        const el = document.getElementById(id);
        if (!el) return;
        el.addEventListener('change', function(){
            if (window.financeInitializingFilters) return;
            if (id.startsWith('filtroReceber')) filtrarContas('receber'); else filtrarContas('pagar');
        });
        if (el.tagName === 'INPUT' && el.type === 'text') {
            const deb = debounce(function(){
                if (window.financeInitializingFilters) return;
                if (id.startsWith('filtroReceber')) filtrarContas('receber'); else filtrarContas('pagar');
            }, 220);
            el.addEventListener('keyup', deb);
        }
    });
    ['relContaOrigem', 'tipoRelatorio', 'relDataInicio', 'relDataFim'].forEach((id) => {
        const field = document.getElementById(id);
        if (field && field.dataset.reportInvalidationBound !== '1') {
            field.dataset.reportInvalidationBound = '1';
            field.addEventListener('change', () => {
                if (id === 'relContaOrigem') syncFinanceReportTypeOptions();
                invalidateFinanceReport();
            });
        }
    });
    syncFinanceReportTypeOptions();
    // Atualizar estado dos ícones de colunas customizadas
    updateCustomColumnsIcon('receber');
    updateCustomColumnsIcon('pagar');

    if (!window.financeCadastroListenersBound) {
        window.addEventListener('clients:updated', async function() {
            try {
                if (window.clientService && typeof window.clientService.getClients === 'function') {
                    clientes = await window.clientService.getClients(true);
                    atualizarSelectClientes();
                }
            } catch (error) {
                console.warn('⚠️ Falha ao atualizar lista de clientes após cadastro:', error);
            }
        });
        window.financeCadastroListenersBound = true;
    }
    window.financeInitializingFilters = false;
}

async function imprimirTabela(tipo) {
    // 1. Abrir a janela IMEDIATAMENTE para garantir o contexto de interação do usuário
    const win = window.open('', '_blank');
    if (!win) {
        mostrarNotificacao('O bloqueador de pop-ups impediu a abertura do relatório.', 'warning');
        return;
    }

    // 2. Mostrar feedback imediato de carregamento na nova janela
    win.document.open();
    win.document.write(`
        <!DOCTYPE html>
        <html>
            <head><title>Carregando Relatório...</title></head>
            <body style="font-family:sans-serif; display:flex; align-items:center; justify-content:center; height:100vh; margin:0; background:#f8fafc; color:#64748b;">
                <div style="text-align:center;">
                    <div style="font-size:24px; font-weight:bold; color:#0f172a; margin-bottom:10px;">Preparando seu relatório...</div>
                    <div style="font-size:14px;">Processando dados e formatando layout financeiro.</div>
                </div>
            </body>
        </html>
    `);
    win.document.close();

    try {
        const filtro = {};
        if (tipo === 'receber') {
            filtro.status = document.getElementById('filtroReceberStatus')?.value || '';
            filtro.clienteId = document.getElementById('filtroReceberCliente')?.value || '';
            filtro.categoria = document.getElementById('filtroReceberCategoria')?.value || '';
            filtro.tipo = document.getElementById('filtroReceberTipo')?.value || '';
            filtro.pedidoNumero = document.getElementById('filtroReceberNumeroPedido')?.value || '';
            filtro.dataInicio = document.getElementById('filtroReceberDataInicio')?.value || '';
            filtro.dataFim = document.getElementById('filtroReceberDataFim')?.value || '';
        } else {
            filtro.status = document.getElementById('filtroPagarStatus')?.value || '';
            filtro.fornecedorId = document.getElementById('filtroPagarFornecedor')?.value || '';
            filtro.categoria = document.getElementById('filtroPagarCategoria')?.value || '';
            filtro.tipo = document.getElementById('filtroPagarTipo')?.value || '';
            filtro.pedidoNumero = document.getElementById('filtroPagarNumeroPedido')?.value || '';
            filtro.dataInicio = document.getElementById('filtroPagarDataInicio')?.value || '';
            filtro.dataFim = document.getElementById('filtroPagarDataFim')?.value || '';
        }

        let items = tipo === 'receber' ? computeFilteredReceber(filtro) : computeFilteredPagar(filtro);
        const sel = tipo === 'receber'
            ? Array.from(window.selReceberSelection || new Set()).map(String)
            : Array.from(window.selPagarSelection || new Set()).map(String);
        
        if (sel.length > 0) {
            const base = tipo === 'receber' ? (Array.isArray(contasReceber) ? contasReceber.slice() : []) : (Array.isArray(contasPagar) ? contasPagar.slice() : []);
            const hojeTs = getTodayStartTimestampLocal();
            items = base.filter(it => sel.includes(String(it.id))).map(conta => {
                const copia = { ...conta };
                const valorOriginal = parseCurrencyValue(copia.valorOriginal ?? copia.valor);
                const storedRestante = typeof copia.valorRestante !== 'undefined' && copia.valorRestante !== null ? parseCurrencyValue(copia.valorRestante) : -1;
                let valorPago = parseCurrencyValue(copia.valorPago ?? 0);
                if (Array.isArray(copia.historicosPagamento)) {
                    valorPago = copia.historicosPagamento.reduce((s, h) => s + parseCurrencyValue(h.valor), 0);
                }
                const pagoCents = Math.round(valorPago * 100);
                const valorRestante = (storedRestante >= 0) ? storedRestante : Math.max(0, Math.round(valorOriginal * 100) - pagoCents) / 100;
                copia.valorOriginal = valorOriginal;
                copia.valorPago = valorPago;
                copia.valorRestante = valorRestante;
                let sNorm = (copia.status || 'pendente').toLowerCase();
                if (Math.round(valorRestante * 100) === 0) sNorm = 'pago';
                else if (pagoCents > 0) sNorm = 'parcial';
                else if (sNorm === 'pendente') {
                    const ts = getContaVencimentoTimestamp(copia);
                    if (ts && ts < hojeTs) sNorm = 'vencido';
                }
                copia.status = sNorm;
                return copia;
            });
        }

        if (Array.isArray(items)) {
            items.sort((a, b) => (getContaVencimentoTimestamp(a) ?? 0) - (getContaVencimentoTimestamp(b) ?? 0));
        }

        const totalsByStatus = {};
        let tOrig = 0, tJuros = 0, tGeral = 0;

        const itemsWithInfo = items.map(conta => {
            const info = getContaFinanceInfo(conta);
            const statusFinal = info.statusNorm;
            const valDisplay = statusFinal === 'pago' ? 0 : (statusFinal === 'parcial' ? info.valorRestante : info.valorOriginal);
            const totalComJuros = statusFinal === 'pago' ? 0 : info.totalAtualizado;
            const jurosLinha = Math.max(0, info.jurosAberto || 0);

            if (statusFinal !== 'pago') {
                totalsByStatus[statusFinal] = (totalsByStatus[statusFinal] || 0) + totalComJuros;
                tOrig += valDisplay;
                tJuros += jurosLinha;
                tGeral += totalComJuros;
            }
            return { conta, info, statusFinal, valDisplay, totalComJuros, jurosLinha };
        });

        const company = await prepareFinanceReportCompany();
        const helper = getFinanceReportDocumentHelper();
        const headerTitle = tipo === 'receber' ? 'Relatório de Contas a Receber' : 'Relatório de Contas a Pagar';
        const periodo = `${filtro.dataInicio ? formatDate(filtro.dataInicio) : '-'} a ${filtro.dataFim ? formatDate(filtro.dataFim) : '-'}`;
        
        const safeClientes = Array.isArray(clientes) ? clientes : [];
        const safeFornecedores = Array.isArray(fornecedores) ? fornecedores : [];
        const safeFuncionarios = Array.isArray(funcionarios) ? funcionarios : [];
        const entityLabel = tipo === 'receber' ? 'Cliente' : 'Fornecedor';
        const entityValue = (tipo === 'receber')
            ? (safeClientes.find(c => String(c.id) === String(filtro.clienteId))?.nome || 'Todos')
            : (safeFornecedores.find(f => String(f.id) === String(filtro.fornecedorId))?.nome || safeFuncionarios.find(f => String(f.id) === String(filtro.fornecedorId))?.nome || 'Todos');

        const labelMap = { pedidoNumero:'Doc', cliente:'Cliente', fornecedor:'Fornecedor', descricao:'Descrição', valorOriginal:'Original', valorPago:'Pago', valor:'Saldo', juros:'Juros', totalGeral:'Total', vencimento:'Venc.', dataEmissao:'Emissão', status:'Status', categoria:'Categoria', tipo:'Tipo' };
        const columnClassMap = {
            pedidoNumero: 'finance-print-nowrap finance-print-doc',
            cliente:'', fornecedor:'', descricao:'finance-print-description',
            valorOriginal: 'right finance-print-nowrap finance-print-money',
            valorPago: 'right finance-print-nowrap finance-print-money',
            valor: 'right finance-print-nowrap finance-print-money bold',
            juros: 'right finance-print-nowrap finance-print-money juros-val',
            totalGeral: 'right finance-print-nowrap finance-print-money bold',
            vencimento: 'finance-print-nowrap finance-print-date',
            dataEmissao: 'finance-print-nowrap finance-print-date',
            status: 'finance-print-nowrap finance-print-status',
            categoria: '', tipo: ''
        };
        const printPrefs = sanitizePrintPreferencesFor(tipo);
        const baseOrder = printPrefs && Array.isArray(printPrefs.order) ? printPrefs.order : defaultPrintColumns[tipo] || ['pedidoNumero','cliente','descricao','valor','vencimento','dataEmissao','juros','status'];
        const visible = printPrefs && printPrefs.visible ? printPrefs.visible : {};
        const order = baseOrder.filter(k => visible[k] !== false);
        
        const _cellVal = (conta, info, statusFinal, valDisplay, totalComJuros, jurosLinha, k) => {
            const map = {
                pedidoNumero: conta.pedidoNumero || conta.numero || '-',
                cliente: tipo === 'receber' ? (conta.cliente?.nome || conta.cliente || 'N/I') : '',
                fornecedor: tipo === 'pagar' ? (conta.fornecedor || conta.funcionarioNome || 'N/I') : '',
                descricao: conta.descricao || '-',
                valorOriginal: formatCurrency(info.valorOriginal),
                valorPago: formatCurrency(info.valorPago),
                valor: formatCurrency(valDisplay),
                juros: formatCurrency(jurosLinha),
                totalGeral: formatCurrency(totalComJuros),
                vencimento: formatDate(conta.dataVencimento || conta.vencimento),
                dataEmissao: conta.dataEmissao ? formatDate(conta.dataEmissao) : '-',
                status: statusFinal.toUpperCase(),
                categoria: conta.categoria || '',
                tipo: conta.tipo || ''
            };
            return map[k] !== undefined ? map[k] : '-';
        };
        const thead = `<thead><tr>${order.map(k => `<th class="${columnClassMap[k] || ''}">${labelMap[k]}</th>`).join('')}</tr></thead>`;
        const tbody = itemsWithInfo.map(({ conta, info, statusFinal, valDisplay, totalComJuros, jurosLinha }) => `
            <tr>${order.map(k => `<td class="${columnClassMap[k] || 'finance-print-nowrap'}">${escapeFinanceHtml(_cellVal(conta, info, statusFinal, valDisplay, totalComJuros, jurosLinha, k))}</td>`).join('')}</tr>
        `).join('');

        const summaryItems = Object.entries(totalsByStatus).map(([st, sum]) => `<tr><td>Subtotal ${escapeFinanceHtml(st.toUpperCase())}</td><td class="right">${escapeFinanceHtml(formatCurrency(sum))}</td></tr>`).join('');
        const bodyHtml = `
            <section class="sisweb-print-section">
                <div class="finance-print-meta">
                    <div><strong>Período:</strong> ${escapeFinanceHtml(periodo)}</div>
                    <div><strong>${escapeFinanceHtml(entityLabel)}:</strong> ${escapeFinanceHtml(entityValue)}</div>
                    ${sel.length > 0 ? `<div><strong>Seleção:</strong> ${sel.length} itens</div>` : ''}
                </div>
                <table class="sisweb-print-table finance-print-table">
                    <colgroup>
                        ${order.map(() => '<col>').join('\n                        ')}
                    </colgroup>
                    ${thead}<tbody>${tbody || `<tr><td colspan="${order.length || 1}">Nenhum dado</td></tr>`}</tbody>
                </table>
                <table class="finance-print-totals">
                    <tbody>
                        ${summaryItems}
                        <tr><td>Principal acumulado</td><td class="right">${escapeFinanceHtml(formatCurrency(tOrig))}</td></tr>
                        <tr><td>Encargos acumulados</td><td class="right finance-print-interest">${escapeFinanceHtml(formatCurrency(tJuros))}</td></tr>
                        <tr class="finance-print-grand-total"><td>Total geral atualizado</td><td class="right">${escapeFinanceHtml(formatCurrency(tGeral))}</td></tr>
                    </tbody>
                </table>
            </section>`;
        const printOptions = buildFinanceReportHeaderOptions(company, headerTitle, {
            subtitle: periodo,
            metaRows: [`${entityLabel}: ${entityValue}`]
        });
        const prepared = await helper.preparePrintOptions({
            ...printOptions,
            bodyHtml,
            compact: itemsWithInfo.length > 18,
            targetWindow: win,
            printDelay: 300,
            extraCss: `
                @page { size: A4; margin: 8mm; }
                .sisweb-print-page { max-width: 100%; }
                .sisweb-print-section { break-inside: auto; page-break-inside: auto; }
                .finance-print-meta { display:flex; flex-wrap:wrap; gap:8px 20px; margin-bottom:12px; }
                .finance-print-table { width: 100%; table-layout: fixed; }
                .finance-print-table th { padding:4px; text-transform:uppercase; font-size:7.8px; }
                .finance-print-table td { padding:4px; font-size:8px; line-height:1.25; }
                .finance-print-nowrap { white-space:nowrap; overflow-wrap:normal; word-break:normal; }
                .finance-print-description { overflow-wrap:anywhere; }
                .right { text-align:right; }
                .finance-print-totals { width:min(100%, 420px); margin-left:auto; }
                .finance-print-totals td { padding:7px 10px; }
                .finance-print-interest { color:#b91c1c; }
                .finance-print-grand-total { font-size:12px; font-weight:800; }
            `
        });
        window.SiswebCommercePdf.printHtmlDocument(prepared);
        
    } catch (e) {
        console.error('Erro ao imprimir:', e);
        if (win) win.close();
        mostrarNotificacao('Erro na geração do relatório.', 'error');
    }
}

function getFiltroReceberFromUI() {
    try {
        const status = document.getElementById('filtroReceberStatus')?.value || '';
        const clienteId = document.getElementById('filtroReceberCliente')?.value || '';
        const categoria = document.getElementById('filtroReceberCategoria')?.value || '';
        const tipoSel = document.getElementById('filtroReceberTipo')?.value || '';
        const pedidoNumero = document.getElementById('filtroReceberNumeroPedido')?.value || '';
        const dataInicio = document.getElementById('filtroReceberDataInicio')?.value || '';
        const dataFim = document.getElementById('filtroReceberDataFim')?.value || '';
        const f = { status, clienteId, categoria, tipo: tipoSel, pedidoNumero, dataInicio, dataFim };
        return f;
    } catch (_) {
        return {};
    }
}

function getFiltroPagarFromUI() {
    try {
        const status = document.getElementById('filtroPagarStatus')?.value || '';
        const fornecedorId = document.getElementById('filtroPagarFornecedor')?.value || '';
        const categoria = document.getElementById('filtroPagarCategoria')?.value || '';
        const tipoSel = document.getElementById('filtroPagarTipo')?.value || '';
        const pedidoNumero = document.getElementById('filtroPagarNumeroPedido')?.value || '';
        const dataInicio = document.getElementById('filtroPagarDataInicio')?.value || '';
        const dataFim = document.getElementById('filtroPagarDataFim')?.value || '';
        const f = { status, fornecedorId, categoria, tipo: tipoSel, pedidoNumero, dataInicio, dataFim };
        return f;
    } catch (_) {
        return {};
    }
}

function normalizeStatusFilterKey(raw) {
    try {
        const s = String(raw || '').trim().toLowerCase();
        if (!s) return '';
        const noAcc = s.normalize('NFD').replace(/[\u0300-\u036f]/g, '');
        const cleaned = noAcc.replace(/\s+/g, '_').replace(/[^a-z0-9_]/g, '');
        if (cleaned === 'em_aberto' || cleaned === 'aberto') return 'em_aberto';
        if (cleaned === 'todos' || cleaned === 'todas' || cleaned === 'all') return 'todos';
        return cleaned;
    } catch (_) {
        return String(raw || '').trim().toLowerCase();
    }
}

function clearFinanceReportCompanyCache() {
    financeReportCompanyCache = null;
}

function hasFinanceReportCompanyIdentity(company) {
    if (!company || typeof company !== 'object') return false;
    const name = String(company.nome || company.name || '').trim();
    const cnpj = String(company.cnpj || company.taxId || '').trim();
    return (!!name && name !== 'Empresa não informada')
        || (!!cnpj && cnpj !== '-')
        || !!(company.logo || company.logoUrl || company.logoStoragePath || company.logoPath);
}

async function getFinanceReportCompanyProfile(options = {}) {
    const tenantId = String(financeSessionTenant || '').trim();
    if (!tenantId) throw new Error('Tenant autenticado não confirmado para o relatório.');

    if (options.force === true) clearFinanceReportCompanyCache();
    if (financeReportCompanyCache && financeReportCompanyCache.tenantId === tenantId) {
        if (financeReportCompanyCache.company) return { ...financeReportCompanyCache.company };
        if (financeReportCompanyCache.promise) return { ...(await financeReportCompanyCache.promise) };
    }

    const pending = (async () => {
        if (window.__siswebFirebaseServiceReady) await window.__siswebFirebaseServiceReady;
        const service = window.firebaseService;
        if (!service || typeof service.getCompanyProfileForReport !== 'function') {
            throw new Error('Perfil empresarial indisponível para o relatório.');
        }

        const result = await service.getCompanyProfileForReport({ companyId: tenantId });
        if (!result || result.success === false) {
            throw new Error('Perfil empresarial não confirmado para o relatório.');
        }
        const company = result.data || result;
        const returnedTenant = String(
            result.companyId
            || (company && (company.companyId || company.tenantId || company.id))
            || ''
        ).trim();
        if (!company || returnedTenant !== tenantId || !hasFinanceReportCompanyIdentity(company)) {
            throw new Error('Perfil empresarial divergente do tenant autenticado.');
        }

        const normalized = {
            ...company,
            id: tenantId,
            companyId: tenantId,
            tenantId,
            nome: company.nome || company.name || '',
            name: company.name || company.nome || '',
            endereco: company.endereco || company.address || '',
            address: company.address || company.endereco || '',
            telefone: company.telefone || company.phone || '',
            phone: company.phone || company.telefone || ''
        };
        if (String(financeSessionTenant || '').trim() !== tenantId) {
            throw new Error('Tenant alterado durante a preparação do relatório.');
        }
        financeReportCompanyCache = { tenantId, company: normalized, preparedCompany: null, promise: null };
        return normalized;
    })();

    financeReportCompanyCache = { tenantId, company: null, preparedCompany: null, promise: pending };
    try {
        return { ...(await pending) };
    } catch (error) {
        if (financeReportCompanyCache && financeReportCompanyCache.promise === pending) {
            clearFinanceReportCompanyCache();
        }
        throw error;
    }
}

async function prepareFinanceReportCompany(options = {}) {
    const tenantId = String(financeSessionTenant || '').trim();
    if (!options.force && financeReportCompanyCache
        && financeReportCompanyCache.tenantId === tenantId
        && financeReportCompanyCache.preparedCompany) {
        return { ...financeReportCompanyCache.preparedCompany };
    }

    const company = await getFinanceReportCompanyProfile(options);
    const helper = window.SiswebCommercePdf;
    if (!helper || typeof helper.resolveCompanyLogoDataUrl !== 'function') {
        throw new Error('Gerador compartilhado de documentos indisponível.');
    }
    const logoDataUrl = await helper.resolveCompanyLogoDataUrl(company, {
        timeoutMs: options.logoTimeoutMs || 10000
    });
    const prepared = logoDataUrl
        ? { ...company, logo: logoDataUrl, logoUrl: logoDataUrl, logoDataUrl, logoSvg: false }
        : { ...company, logo: '', logoUrl: '', logoDataUrl: '' };
    if (String(financeSessionTenant || '').trim() !== tenantId) {
        throw new Error('Tenant alterado durante a preparação do relatório.');
    }
    financeReportCompanyCache = { tenantId, company: { ...company }, preparedCompany: prepared, promise: null };
    return { ...prepared };
}

function getFinanceReportDocumentHelper() {
    const helper = window.SiswebCommercePdf;
    if (!helper
        || typeof helper.buildPrintHeader !== 'function'
        || typeof helper.preparePrintOptions !== 'function'
        || typeof helper.printHtmlDocument !== 'function'
        || typeof helper.exportTableReportPdf !== 'function') {
        throw new Error('Gerador compartilhado de documentos indisponível.');
    }
    return helper;
}

function buildFinanceReportHeaderOptions(company, title, options = {}) {
    return {
        company,
        title,
        documentTitle: title,
        badgeText: 'Financeiro',
        subtitle: options.subtitle || '',
        metaRows: Array.isArray(options.metaRows) ? options.metaRows.filter(Boolean) : []
    };
}

function buildFinanceReportPreviewHeader(company, model) {
    const options = buildFinanceReportHeaderOptions(company, model.titulo, {
        subtitle: `${model.origemLabel} | ${formatDate(model.dataInicio)} a ${formatDate(model.dataFim)}`
    });
    return window.SiswebCommercePdf.buildPrintHeader(options);
}

const defaultPrintColumns = {
    receber: ['pedidoNumero','cliente','descricao','valor','vencimento','dataEmissao','juros','status','categoria','tipo'],
    pagar: ['pedidoNumero','fornecedor','descricao','valor','vencimento','dataEmissao','juros','status','categoria','tipo']
};

function getPrintPreferencesKey(tipo) {
    try {
        const svc = window.firebaseService || window.FirebaseService;
        let tenant = null;
        if (svc && typeof svc.getTenantId === 'function') {
            tenant = svc.getTenantId();
        }
        if (!tenant && window.appTenantId) {
            tenant = window.appTenantId;
        }
        if (!tenant) {
            const raw = localStorage.getItem('company_info');
            if (raw) {
                const obj = JSON.parse(raw);
                tenant = obj && (obj.companyId || obj.companyID || obj.tenantId || obj.id);
            }
        }
        if (tenant) return `company_${String(tenant)}__printPrefs_finance_${tipo}`;
    } catch (_) {}
    return `printPrefs_finance_${tipo}`;
}

function getPrintPreferences(tipo) {
    try {
        const key = getPrintPreferencesKey(tipo);
        const local = localStorage.getItem(key);
        const fromLocal = local ? JSON.parse(local) : null;
        return fromLocal;
    } catch (_) { return null; }
}

function enforceJurosAfterVencimento(order) {
    const arr = Array.isArray(order) ? [...order] : [];
    const idxJ = arr.indexOf('juros');
    const idxV = arr.indexOf('vencimento');
    if (idxJ === -1 || idxV === -1) return arr;
    if (idxJ === idxV + 1) return arr;
    arr.splice(idxJ, 1);
    const newIdxV = arr.indexOf('vencimento');
    arr.splice(newIdxV + 1, 0, 'juros');
    return arr;
}

function sanitizePrintPreferencesFor(tipo) {
    try {
        const prefs = getPrintPreferences(tipo);
        const baseOrder = defaultPrintColumns[tipo];
        if (!baseOrder) return;
        const orderRaw = (prefs && Array.isArray(prefs.order) && prefs.order.length > 0) ? prefs.order : baseOrder;
        const order = enforceJurosAfterVencimento([...orderRaw.filter(k => baseOrder.includes(k)), ...baseOrder.filter(k => !orderRaw.includes(k))]);
        const visRaw = (prefs && prefs.visible) ? prefs.visible : Object.fromEntries(baseOrder.map(k=>[k,true]));
        const visible = Object.fromEntries(baseOrder.map(k => [k, visRaw[k] !== false]));
        savePrintPreferences(tipo, { order, visible }, { persistRemote: false });
    } catch (_) {}
}

function sanitizeAllPrintPreferences() {
    try {
        sanitizePrintPreferencesFor('receber');
        sanitizePrintPreferencesFor('pagar');
    } catch (_) {}
}

async function savePrintPreferences(tipo, prefs, options = {}) {
    try {
        const key = getPrintPreferencesKey(tipo);
        localStorage.setItem(key, JSON.stringify(prefs));
        updateCustomColumnsIcon(tipo);
        const shouldPersistRemote = options.persistRemote !== false && !!financeSessionTenant;
        if (shouldPersistRemote && window.firebaseService && typeof window.firebaseService.updatePaths === 'function') {
            const updates = {}; updates[`printPreferences/finance/${tipo}`] = prefs; expectFinanceWrite(await window.firebaseService.updatePaths(updates), 'Preferências de impressão', { atomic: true });
        }
    } catch (e) { console.warn('Falha ao salvar preferências de impressão:', e); }
}

function resetPrintPreferences(tipo) {
    try {
        const key = getPrintPreferencesKey(tipo); localStorage.removeItem(key);
        updateCustomColumnsIcon(tipo);
    } catch (_) {}
}

function updateCustomColumnsIcon(tipo) {
    try {
        const has = !!getPrintPreferences(tipo);
        const el = document.querySelector(tipo==='receber'? '#receber .btn.btn-secondary[onclick*="openColumnsConfig"]' : '#pagar .btn.btn-secondary[onclick*="openColumnsConfig"]');
        if (el) {
            if (has) el.classList.add('active'); else el.classList.remove('active');
        }
    } catch (_) {}
}

let columnsConfigEditing = { tipo: null, order: [], visible: {} };

function openColumnsConfig(tipo) {
    try {
        columnsConfigEditing.tipo = tipo;
        const prefs = getPrintPreferences(tipo);
        const baseOrder = defaultPrintColumns[tipo];
        const orderRaw = (prefs && prefs.order && prefs.order.length>0) ? [...prefs.order] : [...baseOrder];
        columnsConfigEditing.order = enforceJurosAfterVencimento([...orderRaw.filter(k => baseOrder.includes(k)), ...baseOrder.filter(k => !orderRaw.includes(k))]);
        const visibleRaw = (prefs && prefs.visible) ? { ...prefs.visible } : Object.fromEntries(baseOrder.map(k=>[k,true]));
        columnsConfigEditing.visible = Object.fromEntries(baseOrder.map(k => [k, visibleRaw[k] !== false]));
        renderColumnsList();
        document.getElementById('printColumnsModal').style.display = 'block';
    } catch (e) { console.warn('Falha ao abrir configuração de colunas:', e); }
}

function toggleColumnVisible(colKey, visible) {
    columnsConfigEditing.visible[colKey] = !!visible;
}

function renderColumnsList() {
    const tipo = columnsConfigEditing.tipo;
    if (!tipo) return;
    const labelMap = { pedidoNumero:'Pedido Nº', cliente:'Cliente', fornecedor:'Fornecedor', descricao:'Descrição', valor:'Valor', juros:'Juros', vencimento:'Vencimento', dataEmissao:'Emissão', status:'Status', categoria:'Categoria', tipo:'Tipo' };
    document.getElementById('printColumnsModalTitle').textContent = `Configurar colunas (${tipo.toUpperCase()})`;
    const list = document.getElementById('printColumnsList');
    if (!list) return;
    list.innerHTML = columnsConfigEditing.order.map(colKey => {
        const checked = columnsConfigEditing.visible[colKey] ? 'checked' : '';
        const label = labelMap[colKey];
        return `
            <div class="columns-item" data-col="${colKey}">
                <span>${label}</span>
                <span>
                    <label style="margin-right:8px;"><input type="checkbox" ${checked} onchange="toggleColumnVisible('${colKey}', this.checked)"> Exibir</label>
                    <button type="button" onclick="moveColumn('${colKey}', -1)"><i class="fas fa-arrow-up"></i></button>
                    <button type="button" onclick="moveColumn('${colKey}', 1)"><i class="fas fa-arrow-down"></i></button>
                </span>
            </div>
        `;
    }).join('');
}

function moveColumn(colKey, dir) {
    const idx = columnsConfigEditing.order.findIndex(k => k === colKey);
    if (idx < 0) return;
    const newIdx = idx + dir;
    if (newIdx < 0 || newIdx >= columnsConfigEditing.order.length) return;
    const arr = columnsConfigEditing.order;
    const [el] = arr.splice(idx, 1);
    arr.splice(newIdx, 0, el);
    renderColumnsList();
}

function saveColumnsConfig() {
    try {
        const prefs = { order: columnsConfigEditing.order, visible: columnsConfigEditing.visible };
        savePrintPreferences(columnsConfigEditing.tipo, prefs);
        fecharModal('printColumnsModal');
        // Reaplicar imediatamente na tabela corrente
        if (columnsConfigEditing.tipo === 'receber') {
            filtrarContas('receber');
        } else {
            filtrarContas('pagar');
        }
    } catch (e) { console.warn('Falha ao salvar colunas:', e); }
}

function computeFilteredReceber(filtro = {}) {
    let contasFiltradas = contasReceber.filter(conta => conta && conta.id);
    contasFiltradas = contasFiltradas.filter(c => {
        const o = String(c.origem || '').toLowerCase();
        return o === 'pedido_venda' || o === 'manual';
    });
    const hojeTs = getTodayStartTimestampLocal();
    contasFiltradas.forEach(conta => {
        conta.jurosTipo = normalizeJurosTipoKey(conta.jurosTipo);
        conta.jurosTaxa = parseJurosTaxa(conta.jurosTaxa || 0);
        const valorOriginal = parseCurrencyValue(conta.valorOriginal ?? conta.valor);
        let valorPago = parseCurrencyValue(conta.valorPago ?? 0);
        if (Array.isArray(conta.historicosPagamento) && conta.historicosPagamento.length > 0) {
            const somaHistoricos = conta.historicosPagamento.reduce((sum, h) => sum + parseCurrencyValue(h.valor), 0);
            if (somaHistoricos > valorPago) valorPago = somaHistoricos;
        }
        const originalCents = Math.round(valorOriginal * 100);
        const pagoCents = Math.round(valorPago * 100);
        const restanteCents = Math.max(0, originalCents - pagoCents);
        const valorRestante = restanteCents / 100;
        conta.valorOriginal = originalCents / 100;
        conta.valorPago = pagoCents / 100;
        conta.valorRestante = valorRestante;
        let statusNorm = (conta.status || 'pendente').toLowerCase();
        if (restanteCents === 0) statusNorm = 'pago';
        else if (pagoCents > 0) statusNorm = 'parcial';
        else if (statusNorm === 'pendente') {
            const ts = getContaVencimentoTimestamp(conta);
            if (ts !== null && ts < hojeTs) statusNorm = 'vencido';
        }
        conta.status = statusNorm;
    });
    const statusFilter = (filtro.status || '').toLowerCase();
    if (statusFilter === 'todos' || statusFilter === 'all' || statusFilter === 'todas') {
    } else if (statusFilter === 'em_aberto') {
        contasFiltradas = contasFiltradas.filter(c => parseCurrencyValue(c.valorRestante ?? (c.valor ?? 0)) > 0);
    } else if (statusFilter) {
        contasFiltradas = contasFiltradas.filter(c => (c.status || '').toLowerCase() === statusFilter);
    } else {
        contasFiltradas = contasFiltradas.filter(c => parseCurrencyValue(c.valorRestante ?? (c.valor ?? 0)) > 0);
    }
    if (filtro.clienteId) {
        const needleId = String(filtro.clienteId).trim().toLowerCase();
        contasFiltradas = contasFiltradas.filter(c => {
            const cid = String(c.clienteId || c.clientId || (c.cliente && typeof c.cliente === 'object' ? (c.cliente.id || c.cliente.clientId) : '') || '').trim().toLowerCase();
            const cname = String((c.cliente && typeof c.cliente === 'object' ? (c.cliente.nome || c.cliente.name) : c.cliente) || c.clienteNome || '').trim().toLowerCase();
            return cid === needleId || (needleId.length > 2 && cname === needleId);
        });
    }
    if (filtro.categoria && String(filtro.categoria).toLowerCase() !== 'todos') {
        const catKey = normalizeCategoriaKey(filtro.categoria);
        const tipoKeys = {
            'a_vista':1,'a_prazo':1,'entrada':1,'parcela':1,'parcelado':1,
            'cheque_pre':1,'boleto':1,'pix':1,'transferencia':1,'cartao':1
        };
        contasFiltradas = contasFiltradas.filter(c => {
            const catCmp = normalizeCategoriaKey(c.categoria);
            if (tipoKeys[catKey]) {
                const tipoCmp = resolveFinanceTipoOperacional(c);
                return catCmp === catKey || tipoCmp === catKey;
            }
            return catCmp === catKey;
        });
    }
    if (filtro.tipo && String(filtro.tipo).toLowerCase() !== 'todos') {
        const tkey = normalizeTipoKey(filtro.tipo);
        contasFiltradas = contasFiltradas.filter(c => resolveFinanceTipoOperacional(c) === tkey);
    }
    if (filtro.pedidoNumero) {
        const needle = String(filtro.pedidoNumero).trim().toLowerCase();
        contasFiltradas = contasFiltradas.filter(c => String(c.pedidoNumero || c.numero || '').toLowerCase().includes(needle));
    }
    const inicioTs = normalizeDateToTimestamp(filtro.dataInicio);
    const rawFimTs = normalizeDateToTimestamp(filtro.dataFim);
    const fimTs = rawFimTs !== null ? rawFimTs + 86400000 - 1 : null;
    if (inicioTs) contasFiltradas = contasFiltradas.filter(c => {
        const tsVenc = getContaVencimentoTimestamp(c);
        const tsEmi = normalizeDateToTimestamp(c && c.dataEmissao);
        return (tsVenc !== null && tsVenc >= inicioTs) || (tsEmi !== null && tsEmi >= inicioTs);
    });
    if (fimTs) contasFiltradas = contasFiltradas.filter(c => {
        const tsVenc = getContaVencimentoTimestamp(c);
        const tsEmi = normalizeDateToTimestamp(c && c.dataEmissao);
        return (tsVenc !== null && tsVenc <= fimTs) || (tsEmi !== null && tsEmi <= fimTs);
    });
    contasFiltradas.sort((a, b) => { const ta = getContaVencimentoTimestamp(a) ?? 0; const tb = getContaVencimentoTimestamp(b) ?? 0; return ta - tb; });
    return contasFiltradas;
}

function computeFilteredPagar(filtro = {}) {
    let contasFiltradas = [...contasPagar];
    contasFiltradas = contasFiltradas.filter(c => {
        const o = String(c.origem || '').toLowerCase();
        return o === 'pedido_compra' || o === 'manual';
    });
    const hojeTs = getTodayStartTimestampLocal();
    contasFiltradas.forEach(conta => {
        conta.jurosTipo = normalizeJurosTipoKey(conta.jurosTipo);
        conta.jurosTaxa = parseJurosTaxa(conta.jurosTaxa || 0);
        const valorOriginal = parseCurrencyValue(conta.valorOriginal ?? conta.valor);
        let valorPago = parseCurrencyValue(conta.valorPago ?? 0);
        if (Array.isArray(conta.historicosPagamento) && conta.historicosPagamento.length > 0) {
            const somaHistoricos = conta.historicosPagamento.reduce((sum, h) => sum + parseCurrencyValue(h.valor), 0);
            if (somaHistoricos > valorPago) valorPago = somaHistoricos;
        }
        const originalCents = Math.round(valorOriginal * 100);
        const pagoCents = Math.round(valorPago * 100);
        const restanteCents = Math.max(0, originalCents - pagoCents);
        const valorRestante = restanteCents / 100;
        conta.valorOriginal = originalCents / 100;
        conta.valorPago = pagoCents / 100;
        conta.valorRestante = valorRestante;
        let statusNorm = (conta.status || 'pendente').toLowerCase();
        const ts = getContaVencimentoTimestamp(conta);
        if (restanteCents === 0) statusNorm = 'pago';
        else if (pagoCents > 0) statusNorm = 'parcial';
        else if (statusNorm === 'pendente' && ts !== null && ts < hojeTs) statusNorm = 'vencido';
        conta.status = statusNorm;
        try {
            const origem = String(conta.origem || '').toLowerCase();
            const pedidoNumero = conta.pedidoNumero || conta.numero || conta.documento || (origem === 'pedido_compra' ? (conta.pedidoNumero || conta.numero || conta.documento || conta.origemId) : '');
            conta.pedidoNumero = pedidoNumero || '';
        } catch (_) {}
    });
    const statusFilter = (filtro.status || '').toLowerCase();
    if (statusFilter === 'todos' || statusFilter === 'all' || statusFilter === 'todas') {
    } else if (statusFilter === 'em_aberto') {
        contasFiltradas = contasFiltradas.filter(c => parseCurrencyValue(c.valorRestante ?? (c.valor ?? 0)) > 0);
    } else if (statusFilter) {
        contasFiltradas = contasFiltradas.filter(c => (c.status || '').toLowerCase() === statusFilter);
    } else {
        contasFiltradas = contasFiltradas.filter(c => parseCurrencyValue(c.valorRestante ?? (c.valor ?? 0)) > 0);
    }
    if (filtro.fornecedorId) {
        const needleId = String(filtro.fornecedorId).trim().toLowerCase();
        contasFiltradas = contasFiltradas.filter(c => {
            const fid = String(c.fornecedorId || c.funcionarioId || (c.fornecedor && typeof c.fornecedor === 'object' ? (c.fornecedor.id || c.fornecedor.fornecedorId) : '') || '').trim().toLowerCase();
            const fname = String((c.fornecedor && typeof c.fornecedor === 'object' ? (c.fornecedor.nome || c.fornecedor.name) : c.fornecedor) || c.fornecedorNome || c.funcionarioNome || '').trim().toLowerCase();
            return fid === needleId || (needleId.length > 2 && fname === needleId);
        });
    }
    if (filtro.categoria && String(filtro.categoria).toLowerCase() !== 'todos') {
        const catKey = normalizeCategoriaKey(filtro.categoria);
        const tipoKeys = {
            'a_vista':1,'a_prazo':1,'entrada':1,'parcela':1,'parcelado':1,
            'cheque_pre':1,'boleto':1,'pix':1,'transferencia':1,'cartao':1
        };
        contasFiltradas = contasFiltradas.filter(c => {
            const catCmp = normalizeCategoriaKey(c.categoria);
            if (tipoKeys[catKey]) {
                const tipoCmp = resolveFinanceTipoOperacional(c);
                return catCmp === catKey || tipoCmp === catKey;
            }
            return catCmp === catKey;
        });
    }
    if (filtro.tipo && String(filtro.tipo).toLowerCase() !== 'todos') {
        const tkey = normalizeTipoKey(filtro.tipo);
        contasFiltradas = contasFiltradas.filter(c => resolveFinanceTipoOperacional(c) === tkey);
    }
    if (filtro.pedidoNumero) {
        const needle = String(filtro.pedidoNumero).trim().toLowerCase();
        contasFiltradas = contasFiltradas.filter(c => String(c.pedidoNumero || c.numero || '').toLowerCase().includes(needle));
    }
    const inicioTs = normalizeDateToTimestamp(filtro.dataInicio);
    const rawFimTs = normalizeDateToTimestamp(filtro.dataFim);
    const fimTs = rawFimTs !== null ? rawFimTs + 86400000 - 1 : null;
    if (inicioTs) contasFiltradas = contasFiltradas.filter(c => {
        const tsVenc = getContaVencimentoTimestamp(c);
        const tsEmi = normalizeDateToTimestamp(c && c.dataEmissao);
        return (tsVenc !== null && tsVenc >= inicioTs) || (tsEmi !== null && tsEmi >= inicioTs);
    });
    if (fimTs) contasFiltradas = contasFiltradas.filter(c => {
        const tsVenc = getContaVencimentoTimestamp(c);
        const tsEmi = normalizeDateToTimestamp(c && c.dataEmissao);
        return (tsVenc !== null && tsVenc <= fimTs) || (tsEmi !== null && tsEmi <= fimTs);
    });
    contasFiltradas.sort((a, b) => { const ta = getContaVencimentoTimestamp(a) ?? 0; const tb = getContaVencimentoTimestamp(b) ?? 0; return ta - tb; });
    return contasFiltradas;
}

// Funções de paginação
function renderPaginacaoReceber(totalItems) {
    const container = document.getElementById('receberPagination');
    if (!container) return;
    const totalPages = Math.max(1, Math.ceil((totalItems || 0) / PAGE_SIZE));
    if (currentPageReceber > totalPages) currentPageReceber = totalPages;
    const prevPage = Math.max(1, currentPageReceber - 1);
    const nextPage = Math.min(totalPages, currentPageReceber + 1);
    const prevBtn = currentPageReceber > 1
        ? `<button class="btn btn-small" onclick="mudarPaginaReceber(${prevPage})" aria-label="Página anterior"><i class='fas fa-chevron-left'></i> Anterior</button>`
        : `<span class="btn btn-small" style="opacity:.5;cursor:not-allowed;" aria-disabled="true"><i class='fas fa-chevron-left'></i> Anterior</span>`;
    const nextBtn = currentPageReceber < totalPages
        ? `<button class="btn btn-small" onclick="mudarPaginaReceber(${nextPage})" aria-label="Próxima página">Próximo <i class='fas fa-chevron-right'></i></button>`
        : `<span class="btn btn-small" style="opacity:.5;cursor:not-allowed;" aria-disabled="true">Próximo <i class='fas fa-chevron-right'></i></span>`;

    // Botões numéricos
    let numberButtons = '';
    for (let p = 1; p <= totalPages; p++) {
        if (p === currentPageReceber) {
            numberButtons += `<span class="btn btn-small" style="background:#e9ecef;color:#333;cursor:default;">${p}</span>`;
        } else {
            numberButtons += `<button class="btn btn-small" onclick="mudarPaginaReceber(${p})" aria-label="Ir para página ${p}">${p}</button>`;
        }
    }
    container.innerHTML = `
        ${prevBtn}
        ${numberButtons}
        ${nextBtn}
        <span style="margin-left:10px; color:#555;"> Página ${currentPageReceber} de ${totalPages} ( ${totalItems} itens )</span>
    `;
}

function renderPaginacaoPagar(totalItems) {
    const container = document.getElementById('pagarPagination');
    if (!container) return;
    const totalPages = Math.max(1, Math.ceil((totalItems || 0) / PAGE_SIZE));
    if (currentPagePagar > totalPages) currentPagePagar = totalPages;
    const prevPage = Math.max(1, currentPagePagar - 1);
    const nextPage = Math.min(totalPages, currentPagePagar + 1);
    const prevBtn = currentPagePagar > 1
        ? `<button class="btn btn-small" onclick="mudarPaginaPagar(${prevPage})" aria-label="Página anterior"><i class='fas fa-chevron-left'></i> Anterior</button>`
        : `<span class="btn btn-small" style="opacity:.5;cursor:not-allowed;" aria-disabled="true"><i class='fas fa-chevron-left'></i> Anterior</span>`;
    const nextBtn = currentPagePagar < totalPages
        ? `<button class="btn btn-small" onclick="mudarPaginaPagar(${nextPage})" aria-label="Próxima página">Próximo <i class='fas fa-chevron-right'></i></button>`
        : `<span class="btn btn-small" style="opacity:.5;cursor:not-allowed;" aria-disabled="true">Próximo <i class='fas fa-chevron-right'></i></span>`;

    // Botões numéricos
    let numberButtons = '';
    for (let p = 1; p <= totalPages; p++) {
        if (p === currentPagePagar) {
            numberButtons += `<span class="btn btn-small" style="background:#e9ecef;color:#333;cursor:default;">${p}</span>`;
        } else {
            numberButtons += `<button class="btn btn-small" onclick="mudarPaginaPagar(${p})" aria-label="Ir para página ${p}">${p}</button>`;
        }
    }
    container.innerHTML = `
        ${prevBtn}
        ${numberButtons}
        ${nextBtn}
        <span style="margin-left:10px; color:#555;"> Página ${currentPagePagar} de ${totalPages} ( ${totalItems} itens )</span>
    `;
}

function mudarPaginaReceber(novaPagina) {
    currentPageReceber = Math.max(1, parseInt(novaPagina, 10) || 1);
    carregarTabelaReceber(lastFiltroReceber || {});
}

function mudarPaginaPagar(novaPagina) {
    currentPagePagar = Math.max(1, parseInt(novaPagina, 10) || 1);
    carregarTabelaPagar(lastFiltroPagar || {});
}

// Funções de navegação entre tabs
function showTab(tabName) {
    // ✅ CORREÇÃO: Resetar estado de edição e botão ao trocar de aba
    if (window.contaEmEdicao) {
        window.contaEmEdicao = null;
        ['pagarForm', 'receberForm'].forEach(function(formId) {
            const btn = document.getElementById(formId)?.querySelector('button[type="submit"]');
            if (btn) btn.innerHTML = '<i class="fas fa-save"></i> Salvar';
        });
    }
    // Ocultar todas as tabs
    const tabContents = document.querySelectorAll('.tab-content');
    tabContents.forEach(tab => tab.classList.remove('active'));

    // Remover classe active de todas as tabs
    const tabs = document.querySelectorAll('.tab');
    tabs.forEach(tab => tab.classList.remove('active'));

    // Mostrar tab selecionada
    const content = document.getElementById(tabName);
    if (content) content.classList.add('active');

    // Marcar o botão da tab como ativo, mesmo em chamadas programáticas
    const tabButton = document.querySelector(`.tabs .tab[data-tab="${tabName}"]`);
    if (tabButton) tabButton.classList.add('active');

    // ✅ Atualizar hash da URL para estabilidade e deep-link
    try { window.location.hash = tabName; } catch (e) { /* noop */ }

    // Carregar dados específicos da tab
    if (tabName === 'dashboard') {
        atualizarDashboard();
        gerarGraficoFluxoCaixa();
    } else if (tabName === 'receber') {
        carregarTabelaReceber(lastFiltroReceber || {});
        try { prepareNumeroReceber(); } catch(_) {}
    } else if (tabName === 'pagar') {
        carregarTabelaPagar(lastFiltroPagar || {});
        try { prepareNumeroPagar(); } catch(_) {}
    } else if (tabName === 'fluxo') {
        // ✅ CORREÇÃO: Reconfigurar datas ao abrir aba
        configurarDatasDoMesAtual();
        gerarFluxoCaixa();
    } else if (tabName === 'relatorios') {
        // ✅ CORREÇÃO: Reconfigurar datas ao abrir aba
        configurarDatasDoMesAtual();
    }
}

// Funções do Dashboard
async function atualizarDashboard() {
    try {
        const now = new Date();
        const curMk = formatISODateLocal(now).slice(0,7);
        const prev = new Date(now); prev.setMonth(prev.getMonth()-1);
        const next = new Date(now); next.setMonth(next.getMonth()+1);
        const monthsWindow = [formatISODateLocal(prev).slice(0,7), curMk, formatISODateLocal(next).slice(0,7)];
        await ensureReceberMonths(monthsWindow);
        await ensurePagarMonths(monthsWindow);
    } catch (e) { console.warn('⚠️ Pré-carregamento de meses para dashboard falhou:', e); }
    
    const hoje = new Date();
    const proximos30Dias = new Date();
    proximos30Dias.setDate(hoje.getDate() + 30);
    const proximos30DiasStr = formatISODateLocal(proximos30Dias);
    const hojeStr = formatISODateLocal(hoje);
    
    // ✅ CORREÇÃO: Calcular totais com filtros mais precisos
    const contasReceberPendentes = contasReceber.filter(c => {
        const status = (c.status || 'pendente').toLowerCase();
        return status === 'pendente' || status === 'parcial';
    });
    
    const contasPagarPendentes = contasPagar.filter(c => {
        const status = (c.status || 'pendente').toLowerCase();
        return status === 'pendente' || status === 'parcial';
    });
    
    // Calcular valores considerando pagamentos parciais
    let totalReceber = contasReceberPendentes.reduce((total, conta) => {
        // Para contas parciais, usar valor restante; para outras, valor total
        const valorRestante = conta.status === 'parcial' ? 
            (conta.valorRestante || (conta.valor - (conta.valorPago || 0))) : 
            (conta.valor || 0);
        return total + valorRestante;
    }, 0);
    
    let totalPagar = contasPagarPendentes.reduce((total, conta) => {
        // Para contas parciais, usar valor restante; para outras, valor total
        const valorRestante = conta.status === 'parcial' ? 
            (conta.valorRestante || (conta.valor - (conta.valorPago || 0))) : 
            (conta.valor || 0);
        return total + valorRestante;
    }, 0);

    try {
        const snap = window.financeSnapshot;
        if (snap && snap.totals) {
            const t = snap.totals;
            if (typeof t.receberAberto === 'number') totalReceber = t.receberAberto;
            if (typeof t.pagarAberto === 'number') totalPagar = t.pagarAberto;
        }
    } catch (_) {}
    
    // ✅ MELHORIA: Saldo projetado considerando apenas próximos 30 dias
    const receberProximos30 = contasReceberPendentes
        .filter(c => getContaVencimentoISO(c) && getContaVencimentoISO(c) <= proximos30DiasStr)
        .reduce((total, conta) => {
            const status = (conta.status||'pendente').toLowerCase();
            const restante = status === 'parcial' ? 
                toNumber(conta.valorRestante || (toNumber(conta.valor) - toNumber(conta.valorPago || 0))) : 
                toNumber(conta.valor || 0);
            return total + Math.max(0, restante);
        }, 0);
    
    const pagarProximos30 = contasPagarPendentes
        .filter(c => getContaVencimentoISO(c) && getContaVencimentoISO(c) <= proximos30DiasStr)
        .reduce((total, conta) => {
            const status = (conta.status||'pendente').toLowerCase();
            const restante = status === 'parcial' ? 
                toNumber(conta.valorRestante || (toNumber(conta.valor) - toNumber(conta.valorPago || 0))) : 
                toNumber(conta.valor || 0);
            return total + Math.max(0, restante);
        }, 0);
    
    const saldoProjetado = receberProximos30 - pagarProximos30;
    
    // ✅ CORREÇÃO: Atualizar cards com dados corretos
    const totalReceberElement = document.getElementById('totalReceber');
    const totalPagarElement = document.getElementById('totalPagar');
    const saldoProjetadoElement = document.getElementById('saldoProjetado');
    const contasReceberElement = document.getElementById('contasReceber');
    const contasPagarElement = document.getElementById('contasPagar');
    
    if (totalReceberElement) {
        totalReceberElement.textContent = formatCurrency(totalReceber);
    }
    if (totalPagarElement) {
        totalPagarElement.textContent = formatCurrency(totalPagar);
    }
    if (saldoProjetadoElement) {
        saldoProjetadoElement.textContent = formatCurrency(saldoProjetado);
        // ✅ MELHORIA: Cor do saldo baseada no valor
        saldoProjetadoElement.style.color = saldoProjetado >= 0 ? '#28a745' : '#dc3545';
    }
    if (contasReceberElement) {
        contasReceberElement.textContent = `${contasReceberPendentes.length} contas`;
    }
    if (contasPagarElement) {
        contasPagarElement.textContent = `${contasPagarPendentes.length} contas`;
    }
    
    // Calcular resumo financeiro
    atualizarResumoFinanceiro();
    
    // ✅ NOVO: Verificar contas vencendo
    try {
        // Desativado a pedido do usuário: o sininho de alertas global já cuida disso
        /*
        const allowFinanceDueToasts = String(localStorage.getItem('sisweb_finance_toasts_vencimento') || '') === '1';
        if (allowFinanceDueToasts) {
            verificarContasVencendo();
        }
        */
    } catch (_) {}
}

async function atualizarSnapshotMensal() {
    try {
        const monthKey = getTodayISODateLocal().slice(0,7);
        const hojeTs = getTodayStartTimestampLocal();
        const getTs = (c) => {
            try { return getContaVencimentoTimestamp(c); } catch(_) { return null; }
        };
        const emAbertoReceber = (Array.isArray(contasReceber)?contasReceber:[]).filter(c => String((c.status||'')).toLowerCase() !== 'pago');
        const emAbertoPagar = (Array.isArray(contasPagar)?contasPagar:[]).filter(c => String((c.status||'')).toLowerCase() !== 'pago');
        const sumRest = (arr) => arr.reduce((s,c)=>{
            const vo = parseCurrencyValue(c.valorOriginal ?? c.valor ?? 0);
            let vp = parseCurrencyValue(c.valorPago ?? 0);
            if (Array.isArray(c.historicosPagamento) && c.historicosPagamento.length>0) {
                const sh = c.historicosPagamento.reduce((sum,h)=> sum + parseCurrencyValue(h.valor), 0);
                if (sh > vp) vp = sh;
            }
            return s + Math.max(0, vo - vp);
        }, 0);
        const totalReceberAberto = sumRest(emAbertoReceber);
        const totalPagarAberto = sumRest(emAbertoPagar);
        const vencidasReceber = emAbertoReceber.filter(c => { const ts=getTs(c); return ts!==null && ts < hojeTs; });
        const vencidasPagar = emAbertoPagar.filter(c => { const ts=getTs(c); return ts!==null && ts < hojeTs; });
        const totalReceberVencidas = sumRest(vencidasReceber);
        const totalPagarVencidas = sumRest(vencidasPagar);
        const snapshot = {
            month: monthKey,
            totals: {
                receberAberto: totalReceberAberto,
                pagarAberto: totalPagarAberto,
                receberVencidas: totalReceberVencidas,
                pagarVencidas: totalPagarVencidas
            },
            counts: {
                receberAberto: emAbertoReceber.length,
                pagarAberto: emAbertoPagar.length,
                receberVencidas: vencidasReceber.length,
                pagarVencidas: vencidasPagar.length
            },
            updatedAt: new Date().toISOString()
        };
        if (window.firebaseService && typeof window.firebaseService.saveToFirebase === 'function') {
            try { expectFinanceWrite(await window.firebaseService.saveToFirebase('finance_snapshots', monthKey, snapshot), 'Atualização do resumo financeiro'); }
            catch(e) { /* noop: snapshot é opcional */ }
        }
    } catch (_) { /* noop */ }
}

// ✅ NOVO: Sistema de alertas para contas vencendo
function verificarContasVencendo() {
    const hojeDate = new Date();
    const hoje = formatISODateLocal(hojeDate);
    const proximos3Dias = new Date(hojeDate);
    proximos3Dias.setDate(proximos3Dias.getDate() + 3);
    const proximos3DiasStr = formatISODateLocal(proximos3Dias);
    const monthsWindow = (function(){
        const curMk = formatISODateLocal(hojeDate).slice(0,7);
        const prev = new Date(hojeDate); prev.setMonth(prev.getMonth()-1);
        const next = new Date(hojeDate); next.setMonth(next.getMonth()+1);
        return [formatISODateLocal(prev).slice(0,7), curMk, formatISODateLocal(next).slice(0,7)];
    })();
    const computeAndNotify = () => {
        const fr = window.lastFiltroReceber || {};
        const fp = window.lastFiltroPagar || {};
        const inicioTsR = fr && fr.dataInicio ? normalizeDateToTimestamp(fr.dataInicio) : null;
        const fimTsR = fr && fr.dataFim ? normalizeDateToTimestamp(fr.dataFim) : null;
        const inicioTsP = fp && fp.dataInicio ? normalizeDateToTimestamp(fp.dataInicio) : null;
        const fimTsP = fp && fp.dataFim ? normalizeDateToTimestamp(fp.dataFim) : null;
        const withinR = (c) => {
            const ts = getContaVencimentoTimestamp(c);
            return ts !== null && (!inicioTsR || ts >= inicioTsR) && (!fimTsR || ts <= fimTsR);
        };
        const withinP = (c) => {
            const ts = getContaVencimentoTimestamp(c);
            return ts !== null && (!inicioTsP || ts >= inicioTsP) && (!fimTsP || ts <= fimTsP);
        };
        const receberVencidas = contasReceber.filter(c => {
            const status = (c.status||'pendente').toLowerCase();
            const vencISO = getContaVencimentoISO(c);
            return (status === 'pendente' || status === 'parcial') && withinR(c) && vencISO && vencISO < hoje;
        });
        const pagarVencidas = contasPagar.filter(c => {
            const status = (c.status||'pendente').toLowerCase();
            const vencISO = getContaVencimentoISO(c);
            return (status === 'pendente' || status === 'parcial') && withinP(c) && vencISO && vencISO < hoje;
        });
        const receberVencendo = contasReceber.filter(c => {
            const status = (c.status||'pendente').toLowerCase();
            const vencISO = getContaVencimentoISO(c);
            return (status === 'pendente' || status === 'parcial') && withinR(c) && vencISO && vencISO >= hoje && vencISO <= proximos3DiasStr;
        });
        const pagarVencendo = contasPagar.filter(c => {
            const status = (c.status||'pendente').toLowerCase();
            const vencISO = getContaVencimentoISO(c);
            return (status === 'pendente' || status === 'parcial') && withinP(c) && vencISO && vencISO >= hoje && vencISO <= proximos3DiasStr;
        });
        return {
            receberVencidas,
            pagarVencidas,
            receberVencendo,
            pagarVencendo
        };
    };
    const fr = (window.lastFiltroReceber || {});
    const fp = (window.lastFiltroPagar || {});
    Promise.resolve()
        .then(()=>ensureReceberDataForRange(fr && (fr.dataInicio || fr.dataFim) ? fr : { dataInicio: monthsWindow[0]+'-01', dataFim: monthsWindow[2]+'-28' }))
        .then(()=>ensurePagarDataForRange(fp && (fp.dataInicio || fp.dataFim) ? fp : { dataInicio: monthsWindow[0]+'-01', dataFim: monthsWindow[2]+'-28' }))
        .then(computeAndNotify)
        .catch(()=>computeAndNotify());
}

function atualizarResumoFinanceiro() {
    const hoje = formatISODateLocal(new Date());
    const proximos7Dias = new Date();
    proximos7Dias.setDate(proximos7Dias.getDate() + 7);
    const proximos7DiasStr = formatISODateLocal(proximos7Dias);
    
    // Contas vencidas (receber)
    let receberVencidas = contasReceber
        .filter(c => ['pendente','parcial'].includes((c.status||'pendente').toLowerCase()) && getContaVencimentoISO(c) && getContaVencimentoISO(c) < hoje)
        .reduce((total, conta) => {
            const status = (conta.status||'pendente').toLowerCase();
            const restante = status === 'parcial' ? (conta.valorRestante || (conta.valor - (conta.valorPago || 0))) : (conta.valor || 0);
            return total + Math.max(0, restante);
        }, 0);
    
    // Contas vencidas (pagar)
    let pagarVencidas = contasPagar
        .filter(c => ['pendente','parcial'].includes((c.status||'pendente').toLowerCase()) && getContaVencimentoISO(c) && getContaVencimentoISO(c) < hoje)
        .reduce((total, conta) => {
            const status = (conta.status||'pendente').toLowerCase();
            const restante = status === 'parcial' ? (conta.valorRestante || (conta.valor - (conta.valorPago || 0))) : (conta.valor || 0);
            return total + Math.max(0, restante);
        }, 0);
    
    // Vencendo hoje
    const vencendoHoje = [
        ...contasReceber.filter(c => ['pendente','parcial'].includes((c.status||'pendente').toLowerCase()) && getContaVencimentoISO(c) === hoje),
        ...contasPagar.filter(c => ['pendente','parcial'].includes((c.status||'pendente').toLowerCase()) && getContaVencimentoISO(c) === hoje)
    ].reduce((total, conta) => {
        const status = (conta.status||'pendente').toLowerCase();
        const restante = status === 'parcial' ? (conta.valorRestante || (conta.valor - (conta.valorPago || 0))) : (conta.valor || 0);
        return total + Math.max(0, restante);
    }, 0);
    
    // Próximos 7 dias
    const proximos7DiasTotal = [
        ...contasReceber.filter(c => ['pendente','parcial'].includes((c.status||'pendente').toLowerCase()) && getContaVencimentoISO(c) && getContaVencimentoISO(c) >= hoje && getContaVencimentoISO(c) <= proximos7DiasStr),
        ...contasPagar.filter(c => ['pendente','parcial'].includes((c.status||'pendente').toLowerCase()) && getContaVencimentoISO(c) && getContaVencimentoISO(c) >= hoje && getContaVencimentoISO(c) <= proximos7DiasStr)
    ].reduce((total, conta) => {
        const status = (conta.status||'pendente').toLowerCase();
        const restante = status === 'parcial' ? (conta.valorRestante || (conta.valor - (conta.valorPago || 0))) : (conta.valor || 0);
        return total + Math.max(0, restante);
    }, 0);
    
    try {
        const snap = window.financeSnapshot;
        const fresh = snap && (snap.updatedAt || snap.timestamp);
        const freshMs = typeof fresh === 'string' ? Date.parse(fresh) : (typeof fresh === 'number' ? fresh : 0);
        const isFresh = freshMs && (Date.now() - freshMs) < (10 * 60 * 1000);
        if (isFresh && snap && snap.totals) {
            const t = snap.totals;
            if (typeof t.receberVencidas === 'number') receberVencidas = t.receberVencidas;
            if (typeof t.pagarVencidas === 'number') pagarVencidas = t.pagarVencidas;
        }
    } catch (_) {}
    
    // Atualizar elementos
    document.getElementById('receberVencidas').textContent = formatCurrency(receberVencidas);
    document.getElementById('pagarVencidas').textContent = formatCurrency(pagarVencidas);
    document.getElementById('vencendoHoje').textContent = formatCurrency(vencendoHoje);
    document.getElementById('proximos7Dias').textContent = formatCurrency(proximos7DiasTotal);
}

function gerarGraficoFluxoCaixa() {
    const ctx = document.getElementById('fluxoCaixaChart').getContext('2d');
    
    if (fluxoCaixaChart) {
        fluxoCaixaChart.destroy();
    }
    
    // Gerar dados para os próximos 30 dias
    const dados = gerarDadosFluxoCaixa(30);
    
    fluxoCaixaChart = new Chart(ctx, {
        type: 'line',
        data: {
            labels: dados.labels,
            datasets: [{
                label: 'Entradas',
                data: dados.entradas,
                borderColor: '#28a745',
                backgroundColor: 'rgba(40, 167, 69, 0.1)',
                tension: 0.4
            }, {
                label: 'Saídas',
                data: dados.saidas,
                borderColor: '#dc3545',
                backgroundColor: 'rgba(220, 53, 69, 0.1)',
                tension: 0.4
            }, {
                label: 'Saldo Acumulado',
                data: dados.saldoAcumulado,
                borderColor: '#007bff',
                backgroundColor: 'rgba(0, 123, 255, 0.1)',
                tension: 0.4,
                yAxisID: 'y1'
            }]
        },
        options: {
            responsive: true,
            scales: {
                y: {
                    beginAtZero: true,
                    position: 'left'
                },
                y1: {
                    type: 'linear',
                    display: true,
                    position: 'right',
                    grid: {
                        drawOnChartArea: false
                    }
                }
            }
        }
    });
}

function gerarDadosFluxoCaixa(dias) {
    const hoje = new Date();
    const labels = [];
    const entradas = [];
    const saidas = [];
    const saldoAcumulado = [];
    let saldoAtual = 0;
    
    for (let i = 0; i < dias; i++) {
        const data = new Date(hoje);
        data.setDate(hoje.getDate() + i);
        const dataStr = formatISODateLocal(data);
        
        labels.push(data.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' }));
        
        // Calcular entradas do dia
        const entradasDia = contasReceber
            .filter(c => getContaVencimentoISO(c) === dataStr && ['pendente','parcial'].includes((c.status||'pendente').toLowerCase()))
            .reduce((total, conta) => {
                const status = (conta.status||'pendente').toLowerCase();
                const restante = status === 'parcial' ? toNumber(conta.valorRestante || (toNumber(conta.valor) - toNumber(conta.valorPago || 0))) : toNumber(conta.valor || 0);
                return total + Math.max(0, restante);
            }, 0);
        
        // Calcular saídas do dia
        const saidasDia = contasPagar
            .filter(c => getContaVencimentoISO(c) === dataStr && ['pendente','parcial'].includes((c.status||'pendente').toLowerCase()))
            .reduce((total, conta) => {
                const status = (conta.status||'pendente').toLowerCase();
                const restante = status === 'parcial' ? toNumber(conta.valorRestante || (toNumber(conta.valor) - toNumber(conta.valorPago || 0))) : toNumber(conta.valor || 0);
                return total + Math.max(0, restante);
            }, 0);
        
        entradas.push(entradasDia);
        saidas.push(saidasDia);
        
        saldoAtual += entradasDia - saidasDia;
        saldoAcumulado.push(saldoAtual);
    }
    
    return { labels, entradas, saidas, saldoAcumulado };
}

// Funções de Contas a Receber
async function salvarContaReceber(event) {
    event.preventDefault();
    
    try {
        // ✅ CORREÇÃO: IDs corretos dos campos do HTML
        const clienteSel = document.getElementById('receberCliente').value;
        const descricao = document.getElementById('receberDescricao').value;
        const valorTotal = parseCurrencyValue(document.getElementById('receberValorTotal').value);
        const parcelas = parseInt(document.getElementById('receberParcelas').value);
        const dataEmissao = document.getElementById('receberDataEmissao')?.value || '';
        const dataVencimento = document.getElementById('receberDataVencimento').value;
        const categoriaValor = document.getElementById('receberCategoria').value || 'vendas';
        const tipoValor = (document.getElementById('receberTipo')?.value || 'receber');
        const jurosTipo = normalizeJurosTipoKey(document.getElementById('receberJurosTipo')?.value || 'none');
        const jurosTaxa = parseJurosTaxa(document.getElementById('receberJurosTaxa')?.value || 0);
        const multaTaxa = parseJurosTaxa(document.getElementById('receberMultaTaxa')?.value || 0);
        const observacoes = document.getElementById('receberObservacoes').value;
        const anexoManualFile = document.getElementById('receberAnexoManual')?.files?.[0] || null;

        const descricaoNorm = isAllCaps(descricao) ? toTitleCasePt(descricao) : descricao;
        const observacoesNorm = isAllCaps(observacoes) ? toTitleCasePt(observacoes) : observacoes;

        if (!clienteSel || !descricao || !valorTotal || !parcelas || !dataVencimento) {
            try {
                const msg = 'Por favor, preencha todos os campos obrigatórios.';
                if (typeof window.__toast === 'function') window.__toast(msg, 'warning');
                else if (window.Utils && window.Utils.showToast) window.Utils.showToast(msg, 'warning');
            } catch (_) {}
            return;
        }
        const receberForm = document.getElementById('receberForm');
        if (!window.contaEmEdicao && receberForm && receberForm.__financePendingCreate) {
            const retriedAccounts = await retryPendingFinanceCreation('receber', receberForm);
            carregarTabelaReceber();
            limparFormulario('receberForm');
            try { await atualizarSnapshotMensal(); } catch(_) {}
            try { atualizarSelectCategorias(); atualizarSelectTipos(); } catch(_) {}
            mostrarNotificacao(
                `${retriedAccounts.length} parcela(s) de conta a receber confirmada(s) com sucesso!`,
                'success'
            );
            return;
        }

        // 🔎 Resolver nome do cliente a partir do ID selecionado
        const clienteObj = Array.isArray(clientes) ? clientes.find(c => String(c.id) === String(clienteSel)) : null;
        const clienteNomeRaw = clienteObj ? (clienteObj.nome || clienteObj.name || clienteObj.nomeCompleto || String(clienteSel)) : String(clienteSel);
        const clienteNome = isAllCaps(clienteNomeRaw) ? toTitleCasePt(clienteNomeRaw) : clienteNomeRaw;

        // 🏷️ Mapear categoria para rótulo humano quando for forma de pagamento
        const categoriaKey = normalizeCategoriaKey(categoriaValor);
        const categoriaLabel = getBaseCategoriaKeys().includes(categoriaKey) ? categoriaKey : 'outros';
        const tipoKey = normalizeTipoKey(tipoValor || 'receber');

        // ✅ NOVO: Verificar se estamos editando uma conta existente
        const novasContas = [];
        if (window.contaEmEdicao && window.contaEmEdicao.tipo === 'receber') {
            if (window.__financeSaving) {
                console.warn('⚠️ Salvamento já em andamento, ignorando clique duplo.');
                return;
            }
            window.__financeSaving = true;
            window.__financeSaveInProgress = true;
            const receberSubmitBtn = document.getElementById('receberForm')?.querySelector('button[type="submit"]');
            setSubmitButtonLoading(receberSubmitBtn, true, 'Salvando...');
            
            const index = contasReceber.findIndex(c => c.id == window.contaEmEdicao.id);
            if (index === -1) throw new Error('Conta a receber não encontrada para edição.');
            
            // Usar o ID original e preservar dados importantes
            const contaOriginal = window.contaEmEdicao.contaOriginal;
            const valorPagoOrig = parseCurrencyValue(contaOriginal.valorPago || 0);
            const anexosOrig = normalizeAttachmentsList(contaOriginal.anexos);
            const historicosOrig = Array.isArray(contaOriginal.historicosPagamento) ? [...contaOriginal.historicosPagamento] : [];
            const valorOriginalEdit = valorTotal;
            const valorRestanteEdit = Math.max(0, (Math.round(valorOriginalEdit * 100) - Math.round(valorPagoOrig * 100)) / 100);
            const hojeISO = getTodayISODateLocal();
            const vencISO = String(dataVencimento || '').slice(0, 10);
            const isOverdue = (!!vencISO && vencISO < hojeISO) && (valorRestanteEdit > 0);
            const statusCalc = (valorRestanteEdit === 0) ? 'pago' : (isOverdue ? 'vencido' : (valorPagoOrig > 0 ? 'parcial' : 'pendente'));
            const conta = {
                id: contaOriginal.id, // ✅ MANTER ID ORIGINAL
                cliente: clienteNome,
                clienteId: clienteSel,
                descricao: descricaoNorm,
                valor: valorTotal,
                valorOriginal: valorOriginalEdit, // ✅ Valor original preservado ou ajustado
                valorRestante: valorRestanteEdit, // ✅ Recalcular restante com base em valorPago
                dataEmissao: normalizeDateISOInput(dataEmissao) || '',
                dataVencimento: vencISO,
                status: statusCalc, // ✅ Recalcular status com base em vencimento e pagamentos
                categoria: categoriaLabel,
                tipo: tipoKey,
                jurosTipo,
                jurosTaxa,
                multaTaxa,
                jurosBaseDate: contaOriginal.jurosBaseDate || null,
                observacoes: observacoesNorm,
                parcela: 1,
                totalParcelas: 1,
                valorTotal: valorTotal,
                origem: contaOriginal.origem || 'manual', // ✅ PRESERVAR ORIGEM
                origemId: contaOriginal.origemId, // ✅ PRESERVAR ORIGEM ID
                pedidoNumero: contaOriginal.pedidoNumero || '', // ✅ PRESERVAR Nº do Pedido
                documento: contaOriginal.documento || contaOriginal.pedidoNumero || '', // ✅ PRESERVAR documento se existir
                numero: contaOriginal.numero || contaOriginal.pedidoNumero || '',
                romaneioData: (contaOriginal.romaneioData ?? null),
                romaneioCliente: (contaOriginal.romaneioCliente ?? null),
                romaneioEspecies: Array.isArray(contaOriginal.romaneioEspecies) ? contaOriginal.romaneioEspecies : null,
                created: contaOriginal.created || new Date().toISOString(),
                updated: new Date().toISOString(), // ✅ MARCAR COMO ATUALIZADA
                // ✅ NOVO: Preservar histórico e campos de pagamento
                historicosPagamento: historicosOrig,
                valorPago: parseCurrencyValue(contaOriginal.valorPago || 0),
                dataPagamento: contaOriginal.dataPagamento || null,
                metodoPagamento: contaOriginal.metodoPagamento || contaOriginal.metodo_pagamento || null,
                observacoesPagamento: contaOriginal.observacoesPagamento || contaOriginal.observacoes_pagamento || null,
                anexos: anexosOrig,
                anexoUrl: contaOriginal.anexoUrl || null,
                comprovanteUrl: contaOriginal.comprovanteUrl || null,
                comprovanteStoragePath: contaOriginal.comprovanteStoragePath || null
            };

            // ✅ FIX: Bloco de compatibilidade removido para evitar reversão de correção de categorias
            // A função editarConta já normaliza a exibição. Ao salvar, respeitamos o que está no formulário.
            /* 
            try {
                const tipoKeys = { ... };
                // ...
            } catch(_) {} 
            */
            
            // Salvar somente a conta editada
            try {
                const mkOld = String((contaOriginal.dataVencimento || contaOriginal.vencimento || '').slice(0,7) || getTodayISODateLocal().slice(0,7));
                const mkNew = String((conta.dataVencimento || conta.vencimento || '').slice(0,7) || getTodayISODateLocal().slice(0,7));
                if (anexoManualFile) {
                    try {
                        const meta = await uploadAttachmentMetaForConta(anexoManualFile, 'receber', conta.id);
                        if (meta) {
                            const anexosUpdated = normalizeAttachmentsList(conta.anexos);
                            anexosUpdated.push(meta);
                            conta.anexos = anexosUpdated;
                            conta.anexoUrl = meta.url;
                        }
                    } catch (uploadErr) {
                        console.warn('Falha ao anexar arquivo manual na edição de receber:', uploadErr);
                    }
                }
                const authoritativeEdit = await updateFinanceAccountAuthoritative('receber', contaOriginal, conta);
                contasReceber[index] = authoritativeEdit.account;
                financeDevLog('edit.receber.persist', {
                    id: String(conta.id),
                    mkOld,
                    mkNew,
                    anexosCount: Array.isArray(conta.anexos) ? conta.anexos.length : 0,
                    hasAnexoUrl: !!conta.anexoUrl,
                    hasComprovanteUrl: !!conta.comprovanteUrl
                });
                try {
                    window.financeMonthsLoadedReceber = window.financeMonthsLoadedReceber || new Set();
                    if (mkOld) window.financeMonthsLoadedReceber.add(mkOld);
                    if (mkNew) window.financeMonthsLoadedReceber.add(mkNew);
                    const monthsWatch = Array.from(new Set([mkOld, mkNew].filter(Boolean)));
                    if (monthsWatch.length) subscribeReceberMonths(monthsWatch);
                    financeDevLog('edit.receber.subscribe', { id: String(conta.id), monthsWatch });
                } catch (_) {}
            } catch(errSave) {
                console.error('❌ Erro ao salvar conta editada no RTDB:', errSave);
                window.__financeSaveInProgress = false;
                const msg = String((errSave && errSave.message) || errSave || '').toLowerCase();
                if (msg.includes('permission_denied') || msg.includes('permission denied')) {
                    try { mostrarNotificacao('Sessão expirada ou sem permissão. Faça login novamente.', 'error'); } catch(_) {}
                    try { if (window.firebaseService && window.firebaseService.authService && window.firebaseService.authService.logout) await window.firebaseService.authService.logout(); } catch(_) {}
                    try { setTimeout(() => { window.location.href = 'login.html'; }, 500); } catch(_) {}
                    return;
                }
                mostrarNotificacao('Erro ao salvar conta editada no banco. Verifique os campos.', 'error');
                return;
            }
            
            // Limpar estado de edição
            window.contaEmEdicao = null;
            try { limparFormulario('receberForm'); } catch(_) {}
            try { const parcelasField = document.getElementById('receberParcelas'); if (parcelasField) parcelasField.disabled = false; } catch(_) {}
            try { prepareNumeroReceber(); } catch(_) {}
            window.__financeSaveInProgress = false;
            window.__financeSaving = false;
            try { const rs = document.getElementById('receberForm')?.querySelector('button[type="submit"]'); setSubmitButtonLoading(rs, false); } catch(_) {}
            try { carregarTabelaReceber(lastFiltroReceber || {}); } catch(_) {}
            try { atualizarSelectCategorias(); atualizarSelectTipos(); } catch(_) {}
            mostrarNotificacao('Conta a receber editada com sucesso!', 'success');
            return;
        } else {
            // ✅ CRIAÇÃO DE NOVA CONTA (comportamento original)
        const parcelConfigsReceber = getGeneratedParcelConfigs('receber', parcelas, valorTotal, dataVencimento);
        const totalParcelasReceber = Math.max(1, parcelConfigsReceber.length || parcelas);
        const numeroInputEl = document.getElementById('receberNumero');
        const manualNumeroBase = (numeroInputEl && numeroInputEl.value) ? numeroInputEl.value : await getNextManualNumero();
        for (let i = 0; i < totalParcelasReceber; i++) {
            const cfg = parcelConfigsReceber[i] || {};
            const valorParcela = parseCurrencyValue(cfg.valor || 0);
            const dataParcela = normalizeDateISOInput(cfg.data || dataVencimento);

            const conta = {
                    id: generateUniqueId('CR'),
                cliente: clienteNome,
                    clienteId: clienteSel, // Para compatibilidade com filtros
                descricao: `${descricaoNorm} (${i + 1}/${totalParcelasReceber})`,
                valor: valorParcela,
                valorOriginal: valorParcela, // ✅ NOVO: Valor original da parcela
                valorRestante: valorParcela, // ✅ NOVO: Valor restante a receber
                dataEmissao: normalizeDateISOInput(dataEmissao) || '',
                dataVencimento: dataParcela,
                status: 'pendente',
                    categoria: categoriaLabel,
                tipo: tipoKey,
                jurosTipo,
                jurosTaxa,
                multaTaxa,
                jurosBaseDate: null,
                observacoes: observacoesNorm,
                parcela: i + 1,
                totalParcelas: totalParcelasReceber,
                    valorTotal: valorTotal,
                    origem: 'manual', // Diferencia de contas vindas de outros módulos
                    numero: totalParcelasReceber === 1 ? manualNumeroBase : `${manualNumeroBase}-${String(i + 1).padStart(2, '0')}`,
                    created: new Date().toISOString()
            };

            novasContas.push(conta);
        }

        const anexosPorParcelaReceber = getGeneratedParcelAttachmentFiles('receber');
        if ((anexoManualFile || Object.keys(anexosPorParcelaReceber).length > 0) && novasContas.length > 0) {
            for (let i = 0; i < novasContas.length; i++) {
                const conta = novasContas[i];
                const fileDaParcela = anexosPorParcelaReceber[i] || null;
                const fileToUpload = fileDaParcela || anexoManualFile;
                if (!fileToUpload) continue;
                try {
                    const meta = await uploadAttachmentMetaForConta(fileToUpload, 'receber', conta.id);
                    if (meta) {
                        conta.anexos = normalizeAttachmentsList(conta.anexos);
                        conta.anexos.push(meta);
                        conta.anexoUrl = meta.url;
                    }
                } catch (uploadErr) {
                    console.warn('Falha ao anexar arquivo manual em conta a receber:', uploadErr);
                }
            }
        }

        }

        if (!window.contaEmEdicao) {
            const form = document.getElementById('receberForm');
            const operationId = createFinanceOperationId('create_receber');
            if (form) form.__financePendingCreate = { tipo: 'receber', operationId, accounts: novasContas };
            try {
                const committed = await createFinanceAccountsAuthoritative('receber', novasContas, operationId);
                novasContas.splice(0, novasContas.length, ...committed.accounts);
                if (form) form.__financePendingCreate = null;
            } catch (error) {
                if (form && isDefinitiveFinanceCreateError(error)) {
                    form.__financePendingCreate = null;
                    await cleanupRejectedFinanceCreateUploads(novasContas);
                }
                throw error;
            }
        }
        if (!window.contaEmEdicao) {
            mergeFinanceCreatedAccounts('receber', novasContas);
            mostrarNotificacao(`${novasContas.length} parcela(s) de conta a receber salva(s) com sucesso!`, 'success');
        }
        
        carregarTabelaReceber();
        limparFormulario('receberForm');
        try { await atualizarSnapshotMensal(); } catch(_) {}
        try { atualizarSelectCategorias(); atualizarSelectTipos(); } catch(_) {}
        
    } catch (error) {
        console.error('❌ Erro ao salvar conta a receber:', error);
        window.__financeSaveInProgress = false;
        window.__financeSaving = false;
        try { const rs = document.getElementById('receberForm')?.querySelector('button[type="submit"]'); setSubmitButtonLoading(rs, false); } catch(_) {}
        const msg = String((error && error.message) || error || '').toLowerCase();
        if (msg.includes('permission_denied') || msg.includes('permission denied')) {
            try { mostrarNotificacao('Sessão expirada ou sem permissão. Faça login novamente.', 'error'); } catch(_) {}
            try { if (window.firebaseService && window.firebaseService.authService && window.firebaseService.authService.logout) await window.firebaseService.authService.logout(); } catch(_) {}
            try { setTimeout(() => { window.location.href = 'login.html'; }, 500); } catch(_) {}
            return;
        }
        mostrarNotificacao('Erro ao salvar conta a receber. Tente novamente.', 'error');
    }
}

async function salvarContaPagar(event) {
    event.preventDefault();
    
    try {
        const fornecedorSelect = document.getElementById('pagarFornecedor');
        const fornecedorId = fornecedorSelect?.value || '';
        const fornecedorNomeRaw = fornecedorSelect ? (fornecedorSelect.options[fornecedorSelect.selectedIndex]?.text || '') : '';
        const fornecedorNome = isAllCaps(fornecedorNomeRaw) ? toTitleCasePt(fornecedorNomeRaw) : fornecedorNomeRaw;
        const descricao = document.getElementById('pagarDescricao')?.value || '';
        const valorTotal = parseCurrencyValue(document.getElementById('pagarValorTotal')?.value || 0);
        const parcelas = parseInt(document.getElementById('pagarParcelas')?.value || '0');
        const dataEmissao = document.getElementById('pagarDataEmissao')?.value || '';
        const dataVencimento = document.getElementById('pagarDataVencimento')?.value || '';
        const categoria = document.getElementById('pagarCategoria')?.value || '';
        const tipo = document.getElementById('pagarTipo')?.value || 'pagar';
        const jurosTipo = normalizeJurosTipoKey(document.getElementById('pagarJurosTipo')?.value || 'none');
        const jurosTaxa = parseJurosTaxa(document.getElementById('pagarJurosTaxa')?.value || 0);
        const observacoes = document.getElementById('pagarObservacoes')?.value || '';
        const anexoManualFile = document.getElementById('pagarAnexoManual')?.files?.[0] || null;

        const descricaoNorm = isAllCaps(descricao) ? toTitleCasePt(descricao) : descricao;
        const observacoesNorm = isAllCaps(observacoes) ? toTitleCasePt(observacoes) : observacoes;

        if (!fornecedorId || !descricao || !valorTotal || !parcelas || !dataVencimento || !categoria) {
            try {
                const msg = 'Por favor, preencha todos os campos obrigatórios.';
                if (typeof window.__toast === 'function') window.__toast(msg, 'warning');
                else if (window.Utils && window.Utils.showToast) window.Utils.showToast(msg, 'warning');
            } catch (_) {}
            return;
        }
        const pagarForm = document.getElementById('pagarForm');
        if (!window.contaEmEdicao && pagarForm && pagarForm.__financePendingCreate) {
            const retriedAccounts = await retryPendingFinanceCreation('pagar', pagarForm);
            carregarTabelaPagar(lastFiltroPagar || {});
            limparFormulario('pagarForm');
            try { await atualizarSnapshotMensal(); } catch(_) {}
            try { atualizarSelectCategorias(); atualizarSelectTipos(); } catch(_) {}
            mostrarNotificacao(
                `${retriedAccounts.length} parcela(s) de conta a pagar confirmada(s) com sucesso!`,
                'success'
            );
            return;
        }

        if (window.contaEmEdicao && window.contaEmEdicao.tipo === 'pagar') {
            if (window.__financeSaving) {
                console.warn('⚠️ Salvamento já em andamento, ignorando clique duplo.');
                return;
            }            window.__financeSaving = true;
            window.__financeSaveInProgress = true;
            const pagarSubmitBtn = document.getElementById('pagarForm')?.querySelector('button[type="submit"]');
            setSubmitButtonLoading(pagarSubmitBtn, true, 'Salvando...');
            const editId = window.contaEmEdicao.id;
            const contaOriginal = window.contaEmEdicao.contaOriginal || {};
            const contaIndex = contasPagar.findIndex(c => c && String(c.id) === String(editId));
            if (contaIndex === -1) {
                window.__financeSaveInProgress = false;
                window.__financeSaving = false;
                setSubmitButtonLoading(pagarSubmitBtn, false);
            mostrarNotificacao('Conta não encontrada para edição.', 'error');
                return;
            }
            const conta = { ...contasPagar[contaIndex] };
            conta.fornecedorId = fornecedorId;
            conta.fornecedor = fornecedorNome;
            conta.descricao = descricaoNorm;
            const valorPago = parseCurrencyValue(conta.valorPago || 0);
            conta.valorOriginal = valorTotal;
            conta.valor = valorTotal;
            conta.valorRestante = Math.max(0, (Math.round(valorTotal * 100) - Math.round(valorPago * 100)) / 100);
            conta.dataEmissao = normalizeDateISOInput(dataEmissao) || '';
            conta.dataVencimento = normalizeDateISOInput(dataVencimento);
            if (conta.valorRestante === 0) {
                conta.status = 'pago';
            } else if (valorPago > 0) {
                conta.status = 'parcial';
            } else {
                conta.status = 'pendente';
            }
            const categoriaKey = normalizeCategoriaForFinanceSave(categoria, 'outros');
            const tipoKey = applyContaFinanceiroTipoPagamento(conta, tipo, 'pagar');
            conta.categoria = categoriaKey;
            conta.jurosTipo = jurosTipo;
            conta.jurosTaxa = jurosTaxa;
            conta.jurosBaseDate = conta.jurosBaseDate || contaOriginal.jurosBaseDate || null;
            conta.observacoes = observacoesNorm;
            conta.totalParcelas = conta.totalParcelas || 1;
            
            // ✅ Preservar anexos na edição
            conta.anexos = normalizeAttachmentsList(contaOriginal.anexos);
            conta.anexoUrl = contaOriginal.anexoUrl || null;
            conta.comprovanteUrl = contaOriginal.comprovanteUrl || null;
            conta.comprovanteStoragePath = contaOriginal.comprovanteStoragePath || null;
            if (anexoManualFile) {
                try {
                    const meta = await uploadAttachmentMetaForConta(anexoManualFile, 'pagar', conta.id);
                    if (meta) {
                        conta.anexos = normalizeAttachmentsList(conta.anexos);
                        conta.anexos.push(meta);
                        conta.anexoUrl = meta.url;
                    }
                } catch (uploadErr) {
                    console.warn('Falha ao anexar arquivo manual na edição de pagar:', uploadErr);
                }
            }
            
            const mkOld = getMonthKeyFromDateVal(window.contaEmEdicao.contaOriginal && (window.contaEmEdicao.contaOriginal.dataVencimento || window.contaEmEdicao.contaOriginal.vencimento));
            const mkNew = getMonthKeyFromDateVal(conta.dataVencimento || conta.vencimento);
            const authoritativeEdit = await updateFinanceAccountAuthoritative('pagar', contaOriginal, conta);
            contasPagar[contaIndex] = authoritativeEdit.account;
            financeDevLog('edit.pagar.persist', {
                id: String(conta.id),
                mkOld,
                mkNew,
                tipoPagamento: tipoKey,
                categoria: categoriaKey,
                anexosCount: Array.isArray(conta.anexos) ? conta.anexos.length : 0,
                hasAnexoUrl: !!conta.anexoUrl,
                hasComprovanteUrl: !!conta.comprovanteUrl
            });
            try {
                window.financeMonthsLoadedPagar = window.financeMonthsLoadedPagar || new Set();
                if (mkOld) window.financeMonthsLoadedPagar.add(mkOld);
                if (mkNew) window.financeMonthsLoadedPagar.add(mkNew);
                const monthsWatch = Array.from(new Set([mkOld, mkNew].filter(Boolean)));
                if (monthsWatch.length) subscribePagarMonths(monthsWatch);
                financeDevLog('edit.pagar.subscribe', { id: String(conta.id), monthsWatch });
            } catch (_) {}
            carregarTabelaPagar(lastFiltroPagar || {});
            limparFormulario('pagarForm');
            try { const parcelasField = document.getElementById('pagarParcelas'); if (parcelasField) parcelasField.disabled = false; } catch(_) {}
            try { prepareNumeroPagar(); } catch(_) {}
            window.contaEmEdicao = null;
            window.__financeSaveInProgress = false;
            window.__financeSaving = false;
            setSubmitButtonLoading(pagarSubmitBtn, false);
            mostrarNotificacao('Conta a pagar editada com sucesso!', 'success');
            try { atualizarSelectCategorias(); atualizarSelectTipos(); } catch(_) {}
            return;
        }

        const parcelConfigsPagar = getGeneratedParcelConfigs('pagar', parcelas, valorTotal, dataVencimento);
        const totalParcelasPagar = Math.max(1, parcelConfigsPagar.length || parcelas);
        const novasContas = [];

        const numeroInputP = document.getElementById('pagarNumero');
        let manualNumeroBaseP = (numeroInputP && numeroInputP.value) ? numeroInputP.value : '';
        if (!manualNumeroBaseP || manualNumeroBaseP === 'Gerado automaticamente...') {
            manualNumeroBaseP = await getNextManualNumeroPagar();
        }
        for (let i = 0; i < totalParcelasPagar; i++) {
            const cfg = parcelConfigsPagar[i] || {};
            const valorParcela = parseCurrencyValue(cfg.valor || 0);
            const dataParcela = normalizeDateISOInput(cfg.data || dataVencimento);
            const categoriaKey = normalizeCategoriaForFinanceSave(categoria, 'outros');
            const tipoKey = normalizeTipoPagamentoForFinanceSave(tipo, 'pagar');

            const conta = {
                id: generateUniqueId('CP'),
                fornecedorId: fornecedorId,
                fornecedor: fornecedorNome,
                descricao: `${descricaoNorm} (${i + 1}/${totalParcelasPagar})`,
                valor: valorParcela,
                valorOriginal: valorParcela,
                valorRestante: valorParcela,
                dataEmissao: normalizeDateISOInput(dataEmissao) || '',
                dataVencimento: dataParcela,
                status: 'pendente',
                categoria: categoriaKey,
                tipo: tipoKey,
                tipoPagamento: tipoKey,
                tipo_pagamento: tipoKey,
                jurosTipo,
                jurosTaxa,
                jurosBaseDate: null,
                observacoes: observacoesNorm,
                parcela: i + 1,
                totalParcelas: totalParcelasPagar,
                valorTotal: valorTotal,
                origem: 'manual',
                numero: totalParcelasPagar === 1 ? manualNumeroBaseP : `${manualNumeroBaseP}-${String(i + 1).padStart(2, '0')}`
            };

            novasContas.push(conta);
        }

        const anexosPorParcelaPagar = getGeneratedParcelAttachmentFiles('pagar');
        if ((anexoManualFile || Object.keys(anexosPorParcelaPagar).length > 0) && novasContas.length > 0) {
            for (let i = 0; i < novasContas.length; i++) {
                const conta = novasContas[i];
                const fileDaParcela = anexosPorParcelaPagar[i] || null;
                const fileToUpload = fileDaParcela || anexoManualFile;
                if (!fileToUpload) continue;
                try {
                    const meta = await uploadAttachmentMetaForConta(fileToUpload, 'pagar', conta.id);
                    if (meta) {
                        conta.anexos = normalizeAttachmentsList(conta.anexos);
                        conta.anexos.push(meta);
                        conta.anexoUrl = meta.url;
                    }
                } catch (uploadErr) {
                    console.warn('Falha ao anexar arquivo manual em conta a pagar:', uploadErr);
                }
            }
        }

        const form = document.getElementById('pagarForm');
        const operationId = createFinanceOperationId('create_pagar');
        if (form) form.__financePendingCreate = { tipo: 'pagar', operationId, accounts: novasContas };
        try {
            const committed = await createFinanceAccountsAuthoritative('pagar', novasContas, operationId);
            novasContas.splice(0, novasContas.length, ...committed.accounts);
            if (form) form.__financePendingCreate = null;
        } catch (error) {
            if (form && isDefinitiveFinanceCreateError(error)) {
                form.__financePendingCreate = null;
                await cleanupRejectedFinanceCreateUploads(novasContas);
            }
            throw error;
        }
        mergeFinanceCreatedAccounts('pagar', novasContas);
        
        carregarTabelaPagar(lastFiltroPagar || {});
        limparFormulario('pagarForm');
        try { await atualizarSnapshotMensal(); } catch(_) {}
        try { atualizarSelectCategorias(); atualizarSelectTipos(); } catch(_) {}
        
        mostrarNotificacao(`${novasContas.length} parcela(s) de conta a pagar salva(s) com sucesso!`, 'success');
        
    } catch (error) {
        console.error('❌ Erro ao salvar conta a pagar:', error);
        window.__financeSaveInProgress = false;
        window.__financeSaving = false;
        try { const ps = document.getElementById('pagarForm')?.querySelector('button[type="submit"]'); setSubmitButtonLoading(ps, false); } catch(_) {}
        const msg = String((error && error.message) || error || '').toLowerCase();
        if (msg.includes('permission_denied') || msg.includes('permission denied')) {
            try { mostrarNotificacao('Sessão expirada ou sem permissão. Faça login novamente.', 'error'); } catch(_) {}
            try { if (window.firebaseService && window.firebaseService.authService && window.firebaseService.authService.logout) await window.firebaseService.authService.logout(); } catch(_) {}
            try { setTimeout(() => { window.location.href = 'login.html'; }, 500); } catch(_) {}
            return;
        }
        mostrarNotificacao('Erro ao salvar conta a pagar. Tente novamente.', 'error');
    }
}
function gerarParcelas(tipo) {
    if (window.contaEmEdicao && window.contaEmEdicao.tipo === tipo) { return; }
    const numeroParcelas = parseInt(document.getElementById(`${tipo}Parcelas`).value);
    const valorTotal = parseCurrencyValue(document.getElementById(`${tipo}ValorTotal`).value);
    const dataVencimento = document.getElementById(`${tipo}DataVencimento`).value;
    
    if (!valorTotal || !dataVencimento || !numeroParcelas || numeroParcelas < 1) {
        try {
            const msg = 'Preencha o valor total, data de vencimento e número de parcelas válido.';
            if (typeof window.__toast === 'function') window.__toast(msg, 'warning');
            else if (window.Utils && window.Utils.showToast) window.Utils.showToast(msg, 'warning');
        } catch (_) {}
        return;
    }
    
    const valorParcela = valorTotal / numeroParcelas;
    const container = document.getElementById(`${tipo}ParcelasList`);
    if (!container) return;

    const existingState = captureGeneratedParcelState(tipo);
    if (existingState.length > 0) {
        const confirmar = confirm('As parcelas serão geradas novamente. Deseja manter anexos e ajustes já informados quando possível?');
        if (!confirmar) return;
    }

    const defaultConfigs = buildDefaultParcelConfigs(valorTotal, numeroParcelas, dataVencimento);
    const mergedConfigs = defaultConfigs.map((cfg, idx) => {
        const prev = existingState[idx];
        return {
            valor: prev && typeof prev.valor === 'number' ? prev.valor : cfg.valor,
            data: prev && prev.data ? normalizeDateISOInput(prev.data) : cfg.data,
            file: prev && prev.file ? prev.file : null
        };
    });

    container.innerHTML = '';
    window.generatedParcelAttachmentCache = window.generatedParcelAttachmentCache || {};
    window.generatedParcelAttachmentCache[tipo] = {};

    for (let i = 0; i < mergedConfigs.length; i++) {
        const parcelaDiv = document.createElement('div');
        parcelaDiv.className = 'installment-row';
        parcelaDiv.setAttribute('data-parcela-index', String(i));
        const dataParcela = normalizeDateISOInput(mergedConfigs[i].data || dataVencimento);
        const valorParcelaAtual = parseCurrencyValue(mergedConfigs[i].valor || valorParcela);
        parcelaDiv.innerHTML = `
            <span class="parcel-label">Parcela ${i + 1}/${mergedConfigs.length}</span>
            <input type="text" class="parcel-value-input" value="${formatCurrencyNoSymbol(valorParcelaAtual)}" onchange="onParcelaValorChange('${tipo}', ${i})">
            <input type="date" class="parcel-date-input" value="${dataParcela}">
            <input type="file" id="${tipo}ParcelaAnexo_${i}" accept="image/*,application/pdf" style="display:none;" onchange="onParcelaAttachmentSelected('${tipo}', ${i})">
            <button type="button" id="${tipo}ParcelaAnexoBtn_${i}" class="btn btn-info btn-small parcel-attach-btn" onclick="handleParcelaAttachmentAction('${tipo}', ${i})" title="Anexar arquivo na parcela">
                <i class="fas fa-paperclip"></i>
            </button>
            <button type="button" class="btn btn-danger btn-small" onclick="removerParcela(this)">
                <i class="fas fa-trash"></i>
            </button>
        `;
        container.appendChild(parcelaDiv);
        if (mergedConfigs[i].file) {
            window.generatedParcelAttachmentCache[tipo][i] = mergedConfigs[i].file;
        }
        updateParcelaAttachmentButtonState(tipo, i);
    }
    
    document.getElementById(`${tipo}ParcelasContainer`).style.display = 'block';
}

function removerParcela(button) {
    const row = button ? button.closest('.installment-row') : null;
    if (!row) return;
    const container = row.parentElement;
    row.remove();
    const tipo = container && container.id === 'pagarParcelasList' ? 'pagar' : 'receber';
    reindexGeneratedParcelRows(tipo);
}

function getMonthKeyFromDateVal(val) {
    try {
        if (val === undefined || val === null) return getTodayISODateLocal().slice(0,7);
        const s = String(val).trim();
        if (!s) return getTodayISODateLocal().slice(0,7);
        // YYYY-MM
        if (/^\d{4}-\d{2}$/.test(s)) return s;
        // YYYY-MM-DD
        if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s.slice(0,7);
        // DD/MM/YYYY
        if (/^\d{2}\/\d{2}\/\d{4}$/.test(s)) {
            const [d, m, y] = s.split('/');
            return `${y}-${m}`;
        }
        const dt = parseDateLocalSafe(s);
        if (!isNaN(dt.getTime())) return formatISODateLocal(dt).slice(0,7);
        return getTodayISODateLocal().slice(0,7);
    } catch(_) {
        return getTodayISODateLocal().slice(0,7);
    }
}

function listMonthsBetween(inicioVal, fimVal) {
    const startMk = getMonthKeyFromDateVal(inicioVal);
    const endMk = getMonthKeyFromDateVal(fimVal);
    if (!inicioVal && !fimVal) return [getTodayISODateLocal().slice(0,7)];
    const res = [];
    const [sy, sm] = startMk.split('-').map(x=>parseInt(x,10));
    const [ey, em] = endMk.split('-').map(x=>parseInt(x,10));
    let y = sy, m = sm;
    while (y < ey || (y === ey && m <= em)) {
        res.push(`${String(y).padStart(4,'0')}-${String(m).padStart(2,'0')}`);
        m += 1; if (m > 12) { m = 1; y += 1; }
    }
    return res;
}

function getTodayISODateLocal() {
    return formatISODateLocal(new Date());
}

function getTodayISODateUTC() {
    // ✅ Dia civil atual no fuso do negócio (America/Sao_Paulo), alinhado com o
    // backend (functions/finance-functions.js todayDayNumber). Evita que às 21h
    // locais o dia UTC já vire o seguinte e contas vencendo hoje pareçam ter
    // 1 dia de atraso. Mantém Date.UTC apenas na conversão para timestamp.
    try {
        return new Date().toLocaleDateString('en-CA', { timeZone: 'America/Sao_Paulo' });
    } catch (_) {
        const now = new Date();
        const y = now.getUTCFullYear();
        const m = String(now.getUTCMonth() + 1).padStart(2, '0');
        const d = String(now.getUTCDate()).padStart(2, '0');
        return `${y}-${m}-${d}`;
    }
}

function getTodayStartTimestampLocal() {
    return normalizeDateToTimestamp(getTodayISODateUTC()) || 0;
}

function mergeFinanceMonthData(existingArr, incomingArr, monthKey, tombstoneStorageKey) {
    const existing = Array.isArray(existingArr) ? existingArr : [];
    const incomingRaw = Array.isArray(incomingArr) ? incomingArr : [];
    const tomb = getDeletedIdsSet(tombstoneStorageKey);
    const incoming = incomingRaw.filter((conta) => conta && conta.id && !tomb.has(String(conta.id)));
    const incomingIds = new Set(incoming.map((conta) => String(conta.id)));
    const filteredByMonth = existing.filter((conta) => getMonthKeyFromDateVal(conta && (conta.dataVencimento || conta.vencimento)) !== monthKey);
    const baseWithoutIncoming = filteredByMonth.filter((conta) => !incomingIds.has(String(conta && conta.id)));
    return baseWithoutIncoming.concat(incoming);
}

async function ensureReceberDataForRange(filtro) {
    try {
        window.financeMonthsLoadedReceber = window.financeMonthsLoadedReceber || new Set();
        const months = listMonthsBetween(filtro?.dataInicio, filtro?.dataFim);
        // Se não há período, ampliar levemente para pegar mês anterior e próximo
        if (!filtro?.dataInicio && !filtro?.dataFim) {
            const cur = new Date();
            const curMk = formatISODateLocal(cur).slice(0,7);
            const prev = new Date(cur); prev.setMonth(prev.getMonth()-1);
            const next = new Date(cur); next.setMonth(next.getMonth()+1);
            months.push(formatISODateLocal(prev).slice(0,7));
            months.push(formatISODateLocal(next).slice(0,7));
        }
        const uniqMonths = Array.from(new Set(months));
        const toLoad = uniqMonths.filter(mk => !window.financeMonthsLoadedReceber.has(mk));
        const msgEl = document.getElementById('financeLoadingMessage');
        const cntEl = document.getElementById('financeLoadingCounter');
        const total = toLoad.length;
        let done = 0;
        let anyRemoteSuccess = false;
        let anyRemoteFail = false;
        if (total > 0 && msgEl) msgEl.textContent = 'Carregando meses (Receber)...';
        if (total > 0 && cntEl) cntEl.textContent = `0/${total}`;
        const overlay = document.getElementById('financeLoadingOverlay');
        if (total > 0 && overlay) overlay.style.display = 'flex';
        if (toLoad.length === 0) return;
        const results = await Promise.all(toLoad.map(async (mk) => {
            try {
                const rec = await window.firebaseService.loadFromFirebase(`financas/receber/${mk}`);
                done += 1;
                if (cntEl) cntEl.textContent = `${done}/${total} (${mk})`;
                return { mk, rec };
            } catch (e) {
                done += 1;
                if (cntEl) cntEl.textContent = `${done}/${total} (${mk})`;
                return { mk, rec: { success: false, data: [] } };
            }
        }));

        results.forEach(({ mk, rec }) => {
            const arr = (rec && rec.success && rec.data) ? (Array.isArray(rec.data) ? rec.data : Object.values(rec.data || {})) : [];
            contasReceber = mergeFinanceMonthData(contasReceber, arr, mk, 'contasReceber_deletedIds');
            anyRemoteSuccess = anyRemoteSuccess || (rec && rec.success === true);
            anyRemoteFail = anyRemoteFail || (!rec || rec.success === false);
            window.financeMonthsLoadedReceber.add(mk);
        });
        // Limpar contador ao concluir
        if (cntEl) setTimeout(()=>{ cntEl.textContent = ''; }, 600);
        if (overlay) overlay.style.display = 'none';
        // Atualizar badge offline conforme resultados
        window.financeOffline = (!!window.firebaseAuthDisabled) || (anyRemoteFail && !anyRemoteSuccess);
        updateOfflineBadge();
        try {
            window.dispatchEvent(new CustomEvent('finance:monthsLoaded', { detail: { tipo: 'receber', months: uniqMonths, loaded: toLoad } }));
        } catch(_) {}
        try { subscribeReceberMonths(uniqMonths); } catch(_) {}
    } catch (e) { console.warn('ensureReceberDataForRange falhou:', e); }
}

// Removido: utilitários de migração e listagem de meses locais

// Migração e carregamento massivo removidos em produção

async function carregarTabelaReceber(filtro = {}) {
    const uiFiltro = getFiltroReceberFromUI();
    const hasIncoming = !!(filtro && Object.keys(filtro).length > 0);
    const hasUi = !!(uiFiltro && Object.keys(uiFiltro).length > 0);
    const effective = hasIncoming ? { ...(hasUi ? uiFiltro : {}), ...filtro } : (hasUi ? uiFiltro : (lastFiltroReceber || {}));
    lastFiltroReceber = { ...effective };
    window.lastFiltroReceber = lastFiltroReceber;
    filtro = lastFiltroReceber;
    const overlay = document.getElementById('financeLoadingOverlay');
    const shouldOverlay = !!(window.financeInitialLoading || window.financeTableOverlayOnce);
    if (overlay && shouldOverlay) { overlay.style.display = 'flex'; window.financeLoadingCount = (window.financeLoadingCount||0) + 1; }
    const tbody = document.getElementById('receberTable');
    if (tbody) {
        tbody.innerHTML = '<tr><td colspan="8" style="text-align: center; padding: 20px; color: #2c3e50;"><i class="fas fa-spinner fa-spin"></i> Carregando contas a receber...</td></tr>';
    }
    
    // ✅ CORREÇÃO: Limpar dados inválidos antes de carregar
    limparDadosInvalidos();
    try { await ensureReceberDataForRange(filtro); } catch(_) {}
    
    // ✅ CORREÇÃO: Filtrar apenas contas válidas (não nulas/undefined)
    let contasFiltradas = contasReceber.filter(conta => conta && conta.id);
    
    // ✅ Dedup por ID para evitar duplicação na tabela
    const seenIdsReceber = new Set();
    contasFiltradas = contasFiltradas.filter(c => { if (!c || !c.id) return true; const k = String(c.id); if (seenIdsReceber.has(k)) return false; seenIdsReceber.add(k); return true; });

    // ✅ Normalizar campos e status pago/parcial/vencido
    const hojeTs = getTodayStartTimestampLocal();
    contasFiltradas.forEach(conta => {
        conta.jurosTipo = normalizeJurosTipoKey(conta.jurosTipo);
        conta.jurosTaxa = parseJurosTaxa(conta.jurosTaxa || 0);
        const valorOriginal = parseCurrencyValue(conta.valorOriginal ?? conta.valor);
        let valorPago = parseCurrencyValue(conta.valorPago ?? 0);
        if (Array.isArray(conta.historicosPagamento) && conta.historicosPagamento.length > 0) {
            const somaHistoricos = conta.historicosPagamento.reduce((sum, h) => sum + parseCurrencyValue(h.valor), 0);
            if (somaHistoricos > valorPago) valorPago = somaHistoricos;
        }
        // ✅ Calcular em centavos para evitar erro de ponto flutuante
        const originalCents = Math.round(valorOriginal * 100);
        const pagoCents = Math.round(valorPago * 100);
        const restanteStored = parseCurrencyValue(conta.valorRestante);
        const restanteLegacy = Math.max(0, originalCents - pagoCents) / 100;
        const restanteBase = Number.isFinite(restanteStored) && restanteStored >= 0 ? restanteStored : restanteLegacy;
        const restanteCents = Math.round(Math.max(0, restanteBase) * 100);
        const valorRestante = restanteCents / 100;
        conta.valorOriginal = originalCents / 100;
        conta.valorPago = pagoCents / 100;
        conta.valorRestante = valorRestante;

        let statusNorm = (conta.status || 'pendente').toLowerCase();
        if (restanteCents === 0) {
            statusNorm = 'pago';
        } else if (pagoCents > 0) {
            statusNorm = 'parcial';
        } else if (statusNorm === 'pendente') {
            const ts = getContaVencimentoTimestamp(conta);
            if (ts !== null && ts < hojeTs) {
                statusNorm = 'vencido';
            }
        }
        conta.status = statusNorm;
    });

    
    
    // ✅ Aplicar filtro de status (normalizado) ou excluir 'pago' por padrão
    const statusFilter = normalizeStatusFilterKey(filtro.status || '');
    if (statusFilter === 'todos') {
        // Exibir todos os status
    } else if (statusFilter === 'em_aberto') {
        contasFiltradas = contasFiltradas.filter(c => parseCurrencyValue(c.valorRestante ?? (c.valor ?? 0)) > 0);
    } else if (statusFilter) {
        contasFiltradas = contasFiltradas.filter(c => (c.status || '').toLowerCase() === statusFilter);
    } else {
        contasFiltradas = contasFiltradas.filter(c => parseCurrencyValue(c.valorRestante ?? (c.valor ?? 0)) > 0);
    }
    
    // Filtros adicionais (cliente, categoria e datas)
    if (filtro.clienteId) {
        const needleId = String(filtro.clienteId).trim().toLowerCase();
        contasFiltradas = contasFiltradas.filter(c => {
            const cid = String(c.clienteId || c.clientId || (c.cliente && typeof c.cliente === 'object' ? (c.cliente.id || c.cliente.clientId) : '') || '').trim().toLowerCase();
            const cname = String((c.cliente && typeof c.cliente === 'object' ? (c.cliente.nome || c.cliente.name) : c.cliente) || c.clienteNome || '').trim().toLowerCase();
            return cid === needleId || (needleId.length > 2 && cname === needleId);
        });
    }
    if (filtro.pedidoNumero) {
        const needle = String(filtro.pedidoNumero).trim().toLowerCase();
        contasFiltradas = contasFiltradas.filter(c => String(c.pedidoNumero || c.numero || '').toLowerCase().includes(needle));
    }
    if (filtro.categoria && String(filtro.categoria).toLowerCase() !== 'todos') {
        const catKey = normalizeCategoriaKey(filtro.categoria);
        const tipoKeys = { 'a_vista':1,'a_prazo':1,'entrada':1,'parcela':1,'parcelado':1,'cheque_pre':1,'boleto':1,'pix':1,'transferencia':1,'cartao':1 };
        contasFiltradas = contasFiltradas.filter(c => {
            const catCmp = normalizeCategoriaKey(c.categoria);
            if (tipoKeys[catKey]) {
                const tipoCmp = resolveFinanceTipoOperacional(c);
                return catCmp === catKey || tipoCmp === catKey;
            }
            return catCmp === catKey;
        });
    }
    if (filtro.tipo && String(filtro.tipo).toLowerCase() !== 'todos') {
        const tkey = normalizeTipoKey(filtro.tipo);
        contasFiltradas = contasFiltradas.filter(c => resolveFinanceTipoOperacional(c) === tkey);
    }
    
    // ✅ Comparação robusta por datas (normalizadas para timestamp com inclusão de dia final completo)
    const inicioTs = normalizeDateToTimestamp(filtro.dataInicio);
    const rawFimTs = normalizeDateToTimestamp(filtro.dataFim);
    const fimTs = rawFimTs !== null ? rawFimTs + 86400000 - 1 : null;

    if (inicioTs) {
        contasFiltradas = contasFiltradas.filter(c => {
            const ts = getContaVencimentoTimestamp(c);
            return ts !== null && ts >= inicioTs;
        });
    }
    
    if (fimTs) {
        contasFiltradas = contasFiltradas.filter(c => {
            const ts = getContaVencimentoTimestamp(c);
            return ts !== null && ts <= fimTs;
        });
    }
    
    // Ordenar por data de vencimento
    contasFiltradas.sort((a, b) => {
        const ta = getContaVencimentoTimestamp(a) ?? 0;
        const tb = getContaVencimentoTimestamp(b) ?? 0;
        return ta - tb;
    });
    
    const prefs = getPrintPreferences('receber');
    const defaultCols = defaultPrintColumns.receber;
    const allowed = new Set(defaultCols);
    const orderRaw = (prefs && Array.isArray(prefs.order) && prefs.order.length > 0) ? prefs.order : defaultCols;
    const order = enforceJurosAfterVencimento([...orderRaw.filter(k => allowed.has(k)), ...defaultCols.filter(k => !orderRaw.includes(k))]);
    const visibleRaw = (prefs && prefs.visible) ? prefs.visible : Object.fromEntries(defaultCols.map(k=>[k,true]));
    const visible = Object.fromEntries([...allowed].map(k => [k, visibleRaw[k] !== false]));
    const labelMap = { pedidoNumero:'Pedido Nº', cliente:'Cliente', fornecedor:'Fornecedor', descricao:'Descrição', valor:'Valor', juros:'Juros', vencimento:'Vencimento', dataEmissao:'Emissão', status:'Status', categoria:'Categoria', tipo:'Tipo' };
    const theadEl = document.getElementById('receberTableHead');
    if (theadEl) {
        const selTh = `<th style="width:36px; text-align:center;"><input type="checkbox" id="selReceberAll" onchange="toggleSelecionarTodosReceber(this.checked)" aria-label="Selecionar todos"></th>`;
        const headHtml = `<tr>${selTh}${order.filter(k=>visible[k]).map(k=>labelMap[k]).filter(Boolean).map(lbl=>`<th>${lbl}</th>`).join('')}<th class="actions-head">Ações</th></tr>`;
        if (window.receberHeaderHtml !== headHtml) { theadEl.innerHTML = headHtml; window.receberHeaderHtml = headHtml; }
    }
    const totalItems = contasFiltradas.length;
    if (totalItems === 0) {
        const colsCount = order.filter(k=>visible[k]).length + 2;
        tbody.innerHTML = `<tr><td colspan="${colsCount}" style="text-align: center;">Nenhuma conta a receber encontrada</td></tr>`;
        renderPaginacaoReceber(0);
        if (overlay && shouldOverlay) {
            window.financeLoadingCount = Math.max(0, (window.financeLoadingCount||0) - 1);
            if (window.financeLoadingCount === 0) overlay.style.display = 'none';
            window.financeTableOverlayOnce = false; window.financeFilterOverlayActive = false;
        }
        if (contasFiltradas.length === 0) return;
    }

    const totalPages = Math.max(1, Math.ceil(totalItems / PAGE_SIZE));
    if (currentPageReceber > totalPages) currentPageReceber = totalPages;
    const startIndex = (currentPageReceber - 1) * PAGE_SIZE;
    const endIndex = startIndex + PAGE_SIZE;
    const pageItems = contasFiltradas.slice(startIndex, endIndex);

    const rowsHtml = pageItems.map(conta => {
        let nomeCliente = 'Cliente não encontrado';
        if (conta.cliente) {
            if (typeof conta.cliente === 'object') {
                nomeCliente = conta.cliente.nome || conta.cliente.name || conta.cliente.nomeCompleto || 'Nome não informado';
            } else {
                nomeCliente = conta.cliente;
            }
        } else if (conta.clienteId) {
            const clienteEncontrado = clientes.find(c => c.id === conta.clienteId);
            if (clienteEncontrado) {
                nomeCliente = clienteEncontrado.nome || clienteEncontrado.name || clienteEncontrado.nomeCompleto || 'Nome não informado';
            }
        }

        const rawStatus = String(conta.status || 'pendente').toLowerCase();
        const statusNorm = ['pendente', 'parcial', 'pago', 'vencido'].includes(rawStatus) ? rawStatus : 'pendente';
        const statusExibir = statusNorm.toUpperCase();
        let valorExibir = conta.valor;
        let tooltipValor = '';
        if (statusNorm === 'parcial') {
            const valorRestante = conta.valorRestante || conta.valor;
            valorExibir = valorRestante;
            const valorOriginal = conta.valorOriginal || conta.valor;
            const valorPago = conta.valorPago || 0;
            tooltipValor = `title="Valor original: ${formatCurrency(valorOriginal)} | Já pago: ${formatCurrency(valorPago)} | Restante: ${formatCurrency(valorRestante)}"`;
        }
        const jurosInfo = getContaJurosDisplay(conta);

        let tipoConta = 'Manual';
        if (conta.origem === 'romaneio_tl' && conta.origemId) {
            const romaneioMatch = conta.origemId.match(/^TL_(\d+)_/);
            if (romaneioMatch) {
                const timestamp = romaneioMatch[1];
                tipoConta = `TL N° ${timestamp}`;
            } else {
                tipoConta = `TL N° ${conta.origemId}`;
            }
        } else if (conta.origem === 'romaneio_pct' && conta.origemId) {
            const romaneioId = conta.origemId;
            if (/^\d+$/.test(romaneioId)) {
                tipoConta = `PCT N° ${romaneioId}`;
            } else {
                const romMatch = romaneioId.match(/(\d+)/);
                if (romMatch) tipoConta = `PCT N° ${romMatch[1]}`; else tipoConta = `PCT N° ${romaneioId}`;
            }
        }

        const prefsRow = getPrintPreferences('receber');
        const defCols = defaultPrintColumns.receber;
        const allowedRow = new Set(defCols);
        const orderRawRow = (prefsRow && Array.isArray(prefsRow.order) && prefsRow.order.length > 0) ? prefsRow.order : defCols;
        const orderRow = enforceJurosAfterVencimento([...orderRawRow.filter(k => allowedRow.has(k)), ...defCols.filter(k => !orderRawRow.includes(k))]);
        const visibleRawRow = (prefsRow && prefsRow.visible) ? prefsRow.visible : Object.fromEntries(defCols.map(k=>[k,true]));
        const visibleRow = Object.fromEntries([...allowedRow].map(k => [k, visibleRawRow[k] !== false]));
        const rowCells = [];
        orderRow.forEach(colKey => {
            if (!visibleRow[colKey]) return;
            switch (colKey) {
                case 'pedidoNumero': rowCells.push(`<td style="text-align:center;">${escapeFinanceHtml(conta.pedidoNumero || conta.numero || '-')}</td>`); break;
                case 'cliente': rowCells.push(`<td>${escapeFinanceHtml(nomeCliente)}</td>`); break;
                case 'descricao': rowCells.push(`<td>${escapeFinanceHtml(conta.descricao || '-')}</td>`); break;
                case 'valor': rowCells.push(`<td style="text-align: right;" ${tooltipValor}>${formatCurrency(valorExibir)}</td>`); break;
                case 'juros': rowCells.push(`<td style="text-align: right;" ${jurosInfo.tooltip}>${formatCurrency(jurosInfo.juros)}</td>`); break;
                case 'vencimento': rowCells.push(`<td style="text-align: center;">${formatDate(conta.dataVencimento || conta.vencimento)}</td>`); break;
                case 'dataEmissao': rowCells.push(`<td style="text-align: center;">${conta.dataEmissao ? formatDate(conta.dataEmissao) : '-'}</td>`); break;
                case 'status': rowCells.push(`<td style="text-align: center;"><span class="status-indicator status-${statusNorm}">${escapeFinanceHtml(statusExibir)}</span></td>`); break;
                case 'categoria': rowCells.push(`<td>${escapeFinanceHtml(getCategoriaLabel(conta.categoria))}</td>`); break;
                case 'tipo': rowCells.push(`<td>${escapeFinanceHtml(getTipoLabel(resolveFinanceTipoOperacional(conta)))}</td>`); break;
            }
        });

        const disabledSel = '';
        const isSelected = (()=>{ try { return (window.selReceberSelection || new Set()).has(String(conta.id)); } catch(_) { return false; } })();
        const primaryAttachmentUrl = getSafeFinanceDownloadUrl(getContaPrimaryAttachmentUrl(conta));
        const accountIdArg = getFinanceInlineStringArgument(conta.id);
        const attachmentArg = getFinanceInlineStringArgument(primaryAttachmentUrl);
        const accountIdAttr = escapeFinanceHtml(conta.id);
        return `
        <tr data-conta-id="${accountIdAttr}" data-status="${statusNorm}">
            <td style="text-align:center;"><input type="checkbox" class="sel-receber" onchange="onReceberSelectChange(this)" ${disabledSel} ${isSelected?'checked':''} aria-label="Selecionar conta"></td>
            ${rowCells.join('')}
            <td class="actions-cell" style="text-align: left; white-space: nowrap;">
                <div class="actions-inline">
                    ${statusNorm === 'pendente' || statusNorm === 'parcial' || statusNorm === 'vencido' ? `
                        <button onclick="abrirModalPagamento(${accountIdArg}, 'receber')" class="btn btn-success btn-small" style="min-width: 28px;" title="${statusNorm === 'parcial' ? 'Completar Recebimento' : 'Registrar Recebimento'}">
                            <i class="fas fa-check"></i>
                        </button>
                    ` : `
                        <div style="width: 28px; min-width: 28px; height: 28px; display: inline-block;"></div>
                    `}
                    ${shouldShowBoletoLamina(conta, 'receber') ? `
                        <button onclick="abrirBoletoPixLamina(${accountIdArg}, 'receber')" class="btn btn-warning btn-small boleto-pix-btn" style="min-width: 28px; background-color: #f59e0b; border-color: #d97706; color: white;" title="Gerar Lâmina de Cobrança PIX">
                            <i class="fas fa-barcode"></i>
                        </button>
                    ` : ''}
                    <button onclick="editarConta(${accountIdArg}, 'receber')" class="btn btn-primary btn-small" style="min-width: 28px;" title="Editar">
                        <i class="fas fa-edit"></i>
                    </button>
                    ${((Array.isArray(conta.historicosPagamento) && conta.historicosPagamento.length > 0) || statusNorm === 'parcial' || statusNorm === 'pago' || (conta.valorPago && conta.valorPago > 0) || !!conta.dataPagamento) ? `
                        <button onclick="verHistoricoPagamentos(${accountIdArg}, 'receber')" class="btn btn-warning btn-small" style="min-width: 28px;" title="Histórico de Pagamentos">
                            <i class="fas fa-history"></i>
                        </button>
                    ` : ''}
                    <button onclick="${primaryAttachmentUrl ? `openFinanceAttachment(${attachmentArg})` : `abrirModalAnexos(${accountIdArg}, 'receber')`}" class="btn btn-info btn-small" style="min-width: 28px;" title="${primaryAttachmentUrl ? 'Ver Anexo' : 'Anexar arquivo'}">
                        <i class="fas ${primaryAttachmentUrl ? 'fa-eye' : 'fa-paperclip'}"></i>
                    </button>
                    <button onclick="excluirConta(${accountIdArg}, 'receber')" class="btn btn-danger btn-small" style="min-width: 28px;" title="Excluir">
                        <i class="fas fa-trash"></i>
                    </button>
                </div>
            </td>
        </tr>
        `;
    });
    if (rowsHtml.length > 300) { renderRowsChunked(tbody, rowsHtml, 300); } else { tbody.innerHTML = rowsHtml.join(''); }
    renderPaginacaoReceber(totalItems);
    try { updateReceberSelectionCount(); } catch(_) {}
    if (overlay && shouldOverlay) {
        window.financeLoadingCount = Math.max(0, (window.financeLoadingCount||0) - 1);
        if (window.financeLoadingCount === 0) overlay.style.display = 'none';
    }
    window.financeTableOverlayOnce = false; window.financeFilterOverlayActive = false;
    try { atualizarSelectTipos(); } catch(_) {}
}

async function carregarTabelaPagar(filtro = {}) {
    const uiFiltro = getFiltroPagarFromUI();
    const hasIncoming = !!(filtro && Object.keys(filtro).length > 0);
    const hasUi = !!(uiFiltro && Object.keys(uiFiltro).length > 0);
    const effective = hasIncoming ? { ...(hasUi ? uiFiltro : {}), ...filtro } : (hasUi ? uiFiltro : (lastFiltroPagar || {}));
    lastFiltroPagar = { ...effective };
    window.lastFiltroPagar = lastFiltroPagar;
    filtro = lastFiltroPagar;
    const overlay = document.getElementById('financeLoadingOverlay');
    const shouldOverlay = !!(window.financeInitialLoading || window.financeTableOverlayOnce);
    if (overlay && shouldOverlay) { overlay.style.display = 'flex'; window.financeLoadingCount = (window.financeLoadingCount||0) + 1; }
    const tbody = document.getElementById('pagarTable');
    if (tbody) {
        tbody.innerHTML = '<tr><td colspan="8" style="text-align: center; padding: 20px; color: #2c3e50;"><i class="fas fa-spinner fa-spin"></i> Carregando contas a pagar...</td></tr>';
    }
    
    // ✅ CORREÇÃO: Limpar dados inválidos antes de carregar
    limparDadosInvalidos();
    try { await ensurePagarDataForRange(filtro); } catch(_) {}
    
    let contasFiltradas = [...contasPagar];
    
    // ✅ Dedup por ID para evitar duplicação na tabela
    const seenIdsPagar = new Set();
    contasFiltradas = contasFiltradas.filter(c => { if (!c || !c.id) return true; const k = String(c.id); if (seenIdsPagar.has(k)) return false; seenIdsPagar.add(k); return true; });

    // ✅ Normalizar campos e status pago/parcial/vencido
    const hojeTs = getTodayStartTimestampLocal();
    contasFiltradas.forEach(conta => {
        conta.jurosTipo = normalizeJurosTipoKey(conta.jurosTipo);
        conta.jurosTaxa = parseJurosTaxa(conta.jurosTaxa || 0);
        const valorOriginal = parseCurrencyValue(conta.valorOriginal ?? conta.valor);
        let valorPago = parseCurrencyValue(conta.valorPago ?? 0);
        if (Array.isArray(conta.historicosPagamento) && conta.historicosPagamento.length > 0) {
            const somaHistoricos = conta.historicosPagamento.reduce((sum, h) => sum + parseCurrencyValue(h.valor), 0);
            if (somaHistoricos > valorPago) valorPago = somaHistoricos;
        }
        const originalCents = Math.round(valorOriginal * 100);
        const pagoCents = Math.round(valorPago * 100);
        const restanteStored = parseCurrencyValue(conta.valorRestante);
        const restanteLegacy = Math.max(0, originalCents - pagoCents) / 100;
        const restanteBase = Number.isFinite(restanteStored) && restanteStored >= 0 ? restanteStored : restanteLegacy;
        const restanteCents = Math.round(Math.max(0, restanteBase) * 100);
        const valorRestante = restanteCents / 100;
        conta.valorOriginal = originalCents / 100;
        conta.valorPago = pagoCents / 100;
        conta.valorRestante = valorRestante;

        let statusNorm = (conta.status || 'pendente').toLowerCase();
        const ts = getContaVencimentoTimestamp(conta);
        if (restanteCents === 0) {
            statusNorm = 'pago';
        } else if (pagoCents > 0) {
            statusNorm = 'parcial';
        } else if (statusNorm === 'pendente' && ts !== null && ts < hojeTs) {
            statusNorm = 'vencido';
        }
        conta.status = statusNorm;
        // Mapear número do pedido quando origem for pedido de compra
        try {
            const origem = String(conta.origem || '').toLowerCase();
            const pedidoNumero = conta.pedidoNumero || conta.numero || conta.documento || (origem === 'pedido_compra' ? (conta.pedidoNumero || conta.numero || conta.documento || conta.origemId) : '');
            conta.pedidoNumero = pedidoNumero || '';
        } catch (_) { /* noop */ }
    });

    
    
    // ✅ Aplicar filtro de status normalizado ou excluir 'pago' por padrão
    const statusFilter = normalizeStatusFilterKey(filtro.status || '');
    if (statusFilter === 'todos') {
        // Exibir todos os status
    } else if (statusFilter === 'em_aberto') {
        contasFiltradas = contasFiltradas.filter(c => parseCurrencyValue(c.valorRestante ?? (c.valor ?? 0)) > 0);
    } else if (statusFilter) {
        contasFiltradas = contasFiltradas.filter(c => (c.status || '').toLowerCase() === statusFilter);
    } else {
        contasFiltradas = contasFiltradas.filter(c => parseCurrencyValue(c.valorRestante ?? (c.valor ?? 0)) > 0);
    }
    
    // Filtros adicionais (fornecedor, categoria e outros)
    if (filtro.fornecedorId) {
        const needleId = String(filtro.fornecedorId).trim().toLowerCase();
        contasFiltradas = contasFiltradas.filter(c => {
            const fid = String(c.fornecedorId || c.funcionarioId || (c.fornecedor && typeof c.fornecedor === 'object' ? (c.fornecedor.id || c.fornecedor.fornecedorId) : '') || '').trim().toLowerCase();
            const fname = String((c.fornecedor && typeof c.fornecedor === 'object' ? (c.fornecedor.nome || c.fornecedor.name) : c.fornecedor) || c.fornecedorNome || c.funcionarioNome || '').trim().toLowerCase();
            return fid === needleId || (needleId.length > 2 && fname === needleId);
        });
    }
    if (filtro.pedidoNumero) {
        const needle = String(filtro.pedidoNumero).trim().toLowerCase();
        contasFiltradas = contasFiltradas.filter(c => String(c.pedidoNumero || c.numero || '').toLowerCase().includes(needle));
    }
    if (filtro.categoria && String(filtro.categoria).toLowerCase() !== 'todos') {
        const catKey = normalizeCategoriaKey(filtro.categoria);
        const tipoKeys = { 'a_vista':1,'a_prazo':1,'entrada':1,'parcela':1,'parcelado':1,'cheque_pre':1,'boleto':1,'pix':1,'transferencia':1,'cartao':1 };
        contasFiltradas = contasFiltradas.filter(c => {
            const catCmp = normalizeCategoriaKey(c.categoria);
            if (tipoKeys[catKey]) {
                const tipoCmp = resolveFinanceTipoOperacional(c);
                return catCmp === catKey || tipoCmp === catKey;
            }
            return catCmp === catKey;
        });
    }
    if (filtro.tipo && String(filtro.tipo).toLowerCase() !== 'todos') {
        const tkey = normalizeTipoKey(filtro.tipo);
        contasFiltradas = contasFiltradas.filter(c => resolveFinanceTipoOperacional(c) === tkey);
    }
    
    // ✅ Comparação robusta por datas (normalizadas para timestamp com inclusão de dia final completo)
    const inicioTs = normalizeDateToTimestamp(filtro.dataInicio);
    const rawFimTs = normalizeDateToTimestamp(filtro.dataFim);
    const fimTs = rawFimTs !== null ? rawFimTs + 86400000 - 1 : null;

    if (inicioTs) {
        contasFiltradas = contasFiltradas.filter(c => {
            const ts = getContaVencimentoTimestamp(c);
            return ts !== null && ts >= inicioTs;
        });
    }
    
    if (fimTs) {
        contasFiltradas = contasFiltradas.filter(c => {
            const ts = getContaVencimentoTimestamp(c);
            return ts !== null && ts <= fimTs;
        });
    }
    
    // Ordenar por data de vencimento
    contasFiltradas.sort((a, b) => {
        const ta = getContaVencimentoTimestamp(a) ?? 0;
        const tb = getContaVencimentoTimestamp(b) ?? 0;
        return ta - tb;
    });
    
    const prefs = getPrintPreferences('pagar');
    const defaultCols = defaultPrintColumns.pagar;
    const allowed = new Set(defaultCols);
    const orderRaw = (prefs && Array.isArray(prefs.order) && prefs.order.length > 0) ? prefs.order : defaultCols;
    const order = enforceJurosAfterVencimento([...orderRaw.filter(k => allowed.has(k)), ...defaultCols.filter(k => !orderRaw.includes(k))]);
    const visibleRaw = (prefs && prefs.visible) ? prefs.visible : Object.fromEntries(defaultCols.map(k=>[k,true]));
    const visible = Object.fromEntries([...allowed].map(k => [k, visibleRaw[k] !== false]));
    const labelMap = { pedidoNumero:'Pedido Nº', cliente:'Cliente', fornecedor:'Fornecedor', descricao:'Descrição', valor:'Valor', juros:'Juros', vencimento:'Vencimento', dataEmissao:'Emissão', status:'Status', categoria:'Categoria', tipo:'Tipo' };
    const theadEl = document.getElementById('pagarTableHead');
    if (theadEl) {
        const selTh = `<th style="width:36px; text-align:center;"><input type="checkbox" id="selPagarAll" onchange="toggleSelecionarTodosPagar(this.checked)" aria-label="Selecionar todos"></th>`;
        const headHtml = `<tr>${selTh}${order.filter(k=>visible[k]).map(k=>labelMap[k]).filter(Boolean).map(lbl=>`<th>${lbl}</th>`).join('')}<th class="actions-head">Ações</th></tr>`;
        if (window.pagarHeaderHtml !== headHtml) { theadEl.innerHTML = headHtml; window.pagarHeaderHtml = headHtml; }
    }
    const totalItems = contasFiltradas.length;
    if (totalItems === 0) {
        const colsCount = order.filter(k=>visible[k]).length + 2;
        tbody.innerHTML = `<tr><td colspan="${colsCount}" style="text-align: center;">Nenhuma conta a pagar encontrada</td></tr>`;
        renderPaginacaoPagar(0);
        if (overlay && shouldOverlay) {
            window.financeLoadingCount = Math.max(0, (window.financeLoadingCount||0) - 1);
            if (window.financeLoadingCount === 0) overlay.style.display = 'none';
            window.financeTableOverlayOnce = false; window.financeFilterOverlayActive = false;
        }
        if (contasFiltradas.length === 0) return;
    }
    
    const totalPages = Math.max(1, Math.ceil(totalItems / PAGE_SIZE));
    if (currentPagePagar > totalPages) currentPagePagar = totalPages;
    const startIndex = (currentPagePagar - 1) * PAGE_SIZE;
    const endIndex = startIndex + PAGE_SIZE;
    const pageItems = contasFiltradas.slice(startIndex, endIndex);

    const rowsHtml2 = pageItems.map(conta => {
        const rawStatus = String(conta.status || 'pendente').toLowerCase();
        const statusNorm = ['pendente', 'parcial', 'pago', 'vencido'].includes(rawStatus) ? rawStatus : 'pendente';
        const statusExibir = statusNorm.toUpperCase();
        const temHistorico = (Array.isArray(conta.historicosPagamento) && conta.historicosPagamento.length > 0) || (conta.valorPago && conta.valorPago > 0) || !!conta.dataPagamento;
        const nomeFornecedor = conta.fornecedor || conta.funcionarioNome || 'Fornecedor não encontrado';
        let valorExibir = conta.valor;
        let tooltipValor = '';
        if (statusNorm === 'parcial') {
            const valorOriginal = typeof conta.valorOriginal === 'number' ? conta.valorOriginal : parseCurrencyValue(conta.valor);
            const valorPago = typeof conta.valorPago === 'number' ? conta.valorPago : parseCurrencyValue(conta.valorPago || 0);
            const restante = typeof conta.valorRestante === 'number' ? conta.valorRestante : Math.max(0, valorOriginal - valorPago);
            valorExibir = restante;
            tooltipValor = `title="Valor original: ${formatCurrency(valorOriginal)} | Já pago: ${formatCurrency(valorPago)} | Restante: ${formatCurrency(restante)}"`;
        }
        const jurosInfo = getContaJurosDisplay(conta);
        const prefsRow = getPrintPreferences('pagar');
        const defCols = defaultPrintColumns.pagar;
        const allowedRow = new Set(defCols);
        const orderRawRow = (prefsRow && Array.isArray(prefsRow.order) && prefsRow.order.length > 0) ? prefsRow.order : defCols;
        const orderRow = enforceJurosAfterVencimento([...orderRawRow.filter(k => allowedRow.has(k)), ...defCols.filter(k => !orderRawRow.includes(k))]);
        const visibleRawRow = (prefsRow && prefsRow.visible) ? prefsRow.visible : Object.fromEntries(defCols.map(k=>[k,true]));
        const visibleRow = Object.fromEntries([...allowedRow].map(k => [k, visibleRawRow[k] !== false]));
        const rowCells = [];
        orderRow.forEach(colKey => {
            if (!visibleRow[colKey]) return;
            switch (colKey) {
                case 'pedidoNumero': rowCells.push(`<td style="text-align:center;">${escapeFinanceHtml(conta.pedidoNumero || conta.numero || '-')}</td>`); break;
                case 'fornecedor': rowCells.push(`<td>${escapeFinanceHtml(nomeFornecedor)}</td>`); break;
                case 'descricao': rowCells.push(`<td>${escapeFinanceHtml(conta.descricao || '-')}</td>`); break;
                case 'valor': rowCells.push(`<td style="text-align: right;" ${tooltipValor}>${formatCurrency(valorExibir)}</td>`); break;
                case 'juros': rowCells.push(`<td style="text-align: right;" ${jurosInfo.tooltip}>${formatCurrency(jurosInfo.juros)}</td>`); break;
                case 'vencimento': rowCells.push(`<td style="text-align: center;">${formatDate(conta.dataVencimento || conta.vencimento)}</td>`); break;
                case 'dataEmissao': rowCells.push(`<td style="text-align: center;">${conta.dataEmissao ? formatDate(conta.dataEmissao) : '-'}</td>`); break;
                case 'status': rowCells.push(`<td style="text-align: center;"><span class="status-indicator status-${statusNorm}">${escapeFinanceHtml(statusExibir)}</span></td>`); break;
                case 'categoria': rowCells.push(`<td>${escapeFinanceHtml(getCategoriaLabel(conta.categoria))}</td>`); break;
                case 'tipo': rowCells.push(`<td>${escapeFinanceHtml(getTipoLabel(resolveFinanceTipoOperacional(conta)))}</td>`); break;
            }
        });
    const disabledSel = '';
    const isSelected = (()=>{ try { return (window.selPagarSelection || new Set()).has(String(conta.id)); } catch(_) { return false; } })();
    const primaryAttachmentUrl = getSafeFinanceDownloadUrl(getContaPrimaryAttachmentUrl(conta));
    const accountIdArg = getFinanceInlineStringArgument(conta.id);
    const attachmentArg = getFinanceInlineStringArgument(primaryAttachmentUrl);
    const accountIdAttr = escapeFinanceHtml(conta.id);
    return `
    <tr data-conta-id="${accountIdAttr}" data-status="${statusNorm}">
        <td style="text-align:center;"><input type="checkbox" class="sel-pagar" onchange="onPagarSelectChange(this)" ${disabledSel} ${isSelected?'checked':''} aria-label="Selecionar conta"></td>
        ${rowCells.join('')}
        <td class="actions-cell" style="text-align: left; white-space: nowrap;">
            <div class="actions-inline">
                ${statusNorm === 'pendente' || statusNorm === 'parcial' || statusNorm === 'vencido' ? `
                    <button onclick="abrirModalPagamento(${accountIdArg}, 'pagar')" class="btn btn-success btn-small" style="min-width: 28px;" title="${statusNorm === 'parcial' ? 'Completar Pagamento' : 'Registrar Pagamento'}">
                            <i class="fas fa-check"></i>
                        </button>
                    ` : `
                        <div style="width: 28px; min-width: 28px; height: 28px; display: inline-block;"></div>
                    `}
                    ${shouldShowBoletoLamina(conta, 'pagar') ? `
                        <button onclick="abrirBoletoPixLamina(${accountIdArg}, 'pagar')" class="btn btn-warning btn-small boleto-pix-btn" style="min-width: 28px; background-color: #f59e0b; border-color: #d97706; color: white;" title="Gerar Lâmina de Cobrança PIX">
                            <i class="fas fa-barcode"></i>
                        </button>
                    ` : ''}
                    <button onclick="editarConta(${accountIdArg}, 'pagar')" class="btn btn-primary btn-small" style="min-width: 28px;" title="Editar">
                        <i class="fas fa-edit"></i>
                    </button>
                    ${temHistorico || statusNorm === 'parcial' || statusNorm === 'pago' ? `
                        <button onclick="verHistoricoPagamentos(${accountIdArg}, 'pagar')" class="btn btn-warning btn-small" style="min-width: 28px;" title="Histórico de Pagamentos">
                            <i class="fas fa-history"></i>
                        </button>
                    ` : ''}
                    <button onclick="${primaryAttachmentUrl ? `openFinanceAttachment(${attachmentArg})` : `abrirModalAnexos(${accountIdArg}, 'pagar')`}" class="btn btn-info btn-small" style="min-width: 28px;" title="${primaryAttachmentUrl ? 'Ver Anexo' : 'Anexar arquivo'}">
                        <i class="fas ${primaryAttachmentUrl ? 'fa-eye' : 'fa-paperclip'}"></i>
                    </button>
                    <button onclick="excluirConta(${accountIdArg}, 'pagar')" class="btn btn-danger btn-small" style="min-width: 28px;" title="Excluir">
                        <i class="fas fa-trash"></i>
                    </button>
                </div>
            </td>
        </tr>
        `;
    });
    if (rowsHtml2.length > 300) { renderRowsChunked(tbody, rowsHtml2, 300); } else { tbody.innerHTML = rowsHtml2.join(''); }
    renderPaginacaoPagar(totalItems);
    try { updatePagarSelectionCount(); } catch(_) {}
    if (overlay && shouldOverlay) {
        window.financeLoadingCount = Math.max(0, (window.financeLoadingCount||0) - 1);
        if (window.financeLoadingCount === 0) overlay.style.display = 'none';
    }
    window.financeTableOverlayOnce = false; window.financeFilterOverlayActive = false;
    try { atualizarSelectTipos(); } catch(_) {}
}

async function ensureReceberMonths(months) {
    try {
        if (!Array.isArray(months) || months.length === 0) return;
        window.financeMonthsLoadedReceber = window.financeMonthsLoadedReceber || new Set();
        const uniqMonths = Array.from(new Set(months));
        const toLoad = uniqMonths.filter(mk => !window.financeMonthsLoadedReceber.has(mk));
        const msgEl = document.getElementById('financeLoadingMessage');
        const cntEl = document.getElementById('financeLoadingCounter');
        const total = toLoad.length;
        if (total === 0) return;
        let done = 0;
        let anyRemoteSuccess = false;
        let anyRemoteFail = false;
        if (msgEl) msgEl.textContent = 'Carregando meses (Receber)...';
        if (cntEl) cntEl.textContent = `0/${total}`;
        const results = await Promise.all(toLoad.map(async (mk) => {
            try {
                const rec = await window.firebaseService.loadFromFirebase(`financas/receber/${mk}`);
                done += 1;
                if (cntEl) cntEl.textContent = `${done}/${total} (${mk})`;
                return { mk, rec };
            } catch (e) {
                done += 1;
                if (cntEl) cntEl.textContent = `${done}/${total} (${mk})`;
                return { mk, rec: { success: false, data: [] } };
            }
        }));

        results.forEach(({ mk, rec }) => {
            const arr = (rec && rec.success && rec.data) ? (Array.isArray(rec.data) ? rec.data : Object.values(rec.data || {})) : [];
            contasReceber = mergeFinanceMonthData(contasReceber, arr, mk, 'contasReceber_deletedIds');
            anyRemoteSuccess = anyRemoteSuccess || (rec && rec.success === true);
            anyRemoteFail = anyRemoteFail || (!rec || rec.success === false);
            window.financeMonthsLoadedReceber.add(mk);
        });
        if (cntEl) setTimeout(()=>{ cntEl.textContent = ''; }, 600);
        window.financeOffline = (!!window.firebaseAuthDisabled) || (anyRemoteFail && !anyRemoteSuccess);
        updateOfflineBadge();
        try {
            window.dispatchEvent(new CustomEvent('finance:monthsLoaded', { detail: { tipo: 'receber', months: uniqMonths, loaded: toLoad } }));
        } catch(_) {}
        try { subscribeReceberMonths(uniqMonths); } catch(_) {}
    } catch (e) { console.warn('ensureReceberMonths falhou:', e); }
}

async function ensurePagarDataForRange(filtro) {
    try {
        window.financeMonthsLoadedPagar = window.financeMonthsLoadedPagar || new Set();
        const months = listMonthsBetween(filtro?.dataInicio, filtro?.dataFim);
        if (!filtro?.dataInicio && !filtro?.dataFim) {
            const cur = new Date();
            const curMk = formatISODateLocal(cur).slice(0,7);
            const prev = new Date(cur); prev.setMonth(prev.getMonth()-1);
            const next = new Date(cur); next.setMonth(next.getMonth()+1);
            months.push(formatISODateLocal(prev).slice(0,7));
            months.push(formatISODateLocal(next).slice(0,7));
        }
        const uniqMonths = Array.from(new Set(months));
        const toLoad = uniqMonths.filter(mk => !window.financeMonthsLoadedPagar.has(mk));
        const msgEl = document.getElementById('financeLoadingMessage');
        const cntEl = document.getElementById('financeLoadingCounter');
        const total = toLoad.length;
        let done = 0;
        let anyRemoteSuccess = false;
        let anyRemoteFail = false;
        if (total > 0 && msgEl) msgEl.textContent = 'Carregando meses (Pagar)...';
        if (total > 0 && cntEl) cntEl.textContent = `0/${total}`;
        const overlay = document.getElementById('financeLoadingOverlay');
        if (total > 0 && overlay) overlay.style.display = 'flex';
        if (toLoad.length === 0) return;
        const results = await Promise.all(toLoad.map(async (mk) => {
            try {
                const pag = await window.firebaseService.loadFromFirebase(`financas/pagar/${mk}`);
                done += 1;
                if (cntEl) cntEl.textContent = `${done}/${total} (${mk})`;
                return { mk, pag };
            } catch (e) {
                done += 1;
                if (cntEl) cntEl.textContent = `${done}/${total} (${mk})`;
                return { mk, pag: { success: false, data: [] } };
            }
        }));

        results.forEach(({ mk, pag }) => {
            const arr = (pag && pag.success && pag.data) ? (Array.isArray(pag.data) ? pag.data : Object.values(pag.data || {})) : [];
            contasPagar = mergeFinanceMonthData(contasPagar, arr, mk, 'contasPagar_deletedIds');
            anyRemoteSuccess = anyRemoteSuccess || (pag && pag.success === true);
            anyRemoteFail = anyRemoteFail || (!pag || pag.success === false);
            window.financeMonthsLoadedPagar.add(mk);
        });
        if (cntEl) setTimeout(()=>{ cntEl.textContent = ''; }, 600);
        if (overlay) overlay.style.display = 'none';
        window.financeOffline = (!!window.firebaseAuthDisabled) || (anyRemoteFail && !anyRemoteSuccess);
        updateOfflineBadge();
        try {
            window.dispatchEvent(new CustomEvent('finance:monthsLoaded', { detail: { tipo: 'pagar', months: uniqMonths, loaded: toLoad } }));
        } catch(_) {}
        try { subscribePagarMonths(uniqMonths); } catch(_) {}
    } catch (e) { console.warn('ensurePagarDataForRange falhou:', e); }
}

async function ensurePagarMonths(months) {
    try {
        if (!Array.isArray(months) || months.length === 0) return;
        window.financeMonthsLoadedPagar = window.financeMonthsLoadedPagar || new Set();
        const uniqMonths = Array.from(new Set(months));
        const toLoad = uniqMonths.filter(mk => !window.financeMonthsLoadedPagar.has(mk));
        const msgEl = document.getElementById('financeLoadingMessage');
        const cntEl = document.getElementById('financeLoadingCounter');
        const total = toLoad.length;
        if (total === 0) return;
        let done = 0;
        let anyRemoteSuccess = false;
        let anyRemoteFail = false;
        if (msgEl) msgEl.textContent = 'Carregando meses (Pagar)...';
        if (cntEl) cntEl.textContent = `0/${total}`;
        const results = await Promise.all(toLoad.map(async (mk) => {
            try {
                const pag = await window.firebaseService.loadFromFirebase(`financas/pagar/${mk}`);
                done += 1;
                if (cntEl) cntEl.textContent = `${done}/${total} (${mk})`;
                return { mk, pag };
            } catch (e) {
                done += 1;
                if (cntEl) cntEl.textContent = `${done}/${total} (${mk})`;
                return { mk, pag: { success: false, data: [] } };
            }
        }));

        results.forEach(({ mk, pag }) => {
            const arr = (pag && pag.success && pag.data) ? (Array.isArray(pag.data) ? pag.data : Object.values(pag.data || {})) : [];
            contasPagar = mergeFinanceMonthData(contasPagar, arr, mk, 'contasPagar_deletedIds');
            anyRemoteSuccess = anyRemoteSuccess || (pag && pag.success === true);
            anyRemoteFail = anyRemoteFail || (!pag || pag.success === false);
            window.financeMonthsLoadedPagar.add(mk);
        });
        if (cntEl) setTimeout(()=>{ cntEl.textContent = ''; }, 600);
        window.financeOffline = (!!window.firebaseAuthDisabled) || (anyRemoteFail && !anyRemoteSuccess);
        updateOfflineBadge();
        try {
            window.dispatchEvent(new CustomEvent('finance:monthsLoaded', { detail: { tipo: 'pagar', months: uniqMonths, loaded: toLoad } }));
        } catch(_) {}
        try { subscribePagarMonths(uniqMonths); } catch(_) {}
    } catch (e) { console.warn('ensurePagarMonths falhou:', e); }
}

async function carregarMaisMeses(tipo) {
    try {
        window.financeMonthsLoadedReceber = window.financeMonthsLoadedReceber || new Set();
        window.financeMonthsLoadedPagar = window.financeMonthsLoadedPagar || new Set();
        const set = tipo === 'receber' ? window.financeMonthsLoadedReceber : window.financeMonthsLoadedPagar;
        const curArr = Array.from(set);
        if (curArr.length === 0) {
            const cur = new Date();
            const curMk = formatISODateLocal(cur).slice(0,7);
            const prev = new Date(cur); prev.setMonth(prev.getMonth()-1);
            const next = new Date(cur); next.setMonth(next.getMonth()+1);
            const months = [formatISODateLocal(prev).slice(0,7), curMk, formatISODateLocal(next).slice(0,7)];
            const overlay = document.getElementById('financeLoadingOverlay');
            if (overlay) { overlay.style.display = 'flex'; window.financeLoadingCount = (window.financeLoadingCount||0) + 1; }
            if (tipo === 'receber') {
                await ensureReceberMonths(months);
                carregarTabelaReceber(lastFiltroReceber || {});
            } else {
                await ensurePagarMonths(months);
                carregarTabelaPagar(lastFiltroPagar || {});
            }
            if (overlay) {
                window.financeLoadingCount = Math.max(0, (window.financeLoadingCount||0) - 1);
                if (window.financeLoadingCount === 0) overlay.style.display = 'none';
            }
            return;
        }
        const oldest = curArr.reduce((a, b) => (a < b ? a : b));
        const parts = oldest.split('-').map(x=>parseInt(x,10));
        const oy = parts[0];
        const om = parts[1];
        const newMonths = [];
        let y = oy;
        let m = om;
        for (let i = 1; i <= 3; i++) {
            m -= 1;
            if (m < 1) { m = 12; y -= 1; }
            const mk = `${String(y).padStart(4,'0')}-${String(m).padStart(2,'0')}`;
            if (!set.has(mk)) newMonths.push(mk);
        }
        if (newMonths.length === 0) return;
        const overlay = document.getElementById('financeLoadingOverlay');
        if (overlay) { overlay.style.display = 'flex'; window.financeLoadingCount = (window.financeLoadingCount||0) + 1; }
        if (tipo === 'receber') {
            await ensureReceberMonths(newMonths);
            carregarTabelaReceber(lastFiltroReceber || {});
        } else {
            await ensurePagarMonths(newMonths);
            carregarTabelaPagar(lastFiltroPagar || {});
        }
        if (overlay) {
            window.financeLoadingCount = Math.max(0, (window.financeLoadingCount||0) - 1);
            if (window.financeLoadingCount === 0) overlay.style.display = 'none';
        }
    } catch (error) {
        console.error('Erro ao carregar mais meses:', error);
        try { mostrarNotificacao('Erro ao carregar mais meses', 'error'); } catch(_) {}
    }
}

function getNamespacedPath(basePath) {
    try {
        const svc = window.firebaseService;
        const tenant = svc && svc.getCurrentTenantId ? svc.getCurrentTenantId() : null;
        if (tenant && !/^companies\//.test(basePath)) return `companies/${tenant}/${basePath}`;
        return basePath;
    } catch(_) { return basePath; }
}

function subscribeReceberMonths(months) {
    try {
        window.financeReceberListeners = window.financeReceberListeners || new Map();
        const want = Array.from(new Set(months || []));
        const have = Array.from(window.financeReceberListeners.keys());
        // Unsubscribe removed
        have.forEach(mk => {
            if (!want.includes(mk)) {
                const rec = window.financeReceberListeners.get(mk);
                if (rec && rec.refs && rec.handlers) {
                    try { (rec.refs||[]).forEach((r, i) => { try { r.off('value', (rec.handlers||[])[i]); } catch(_) {} }); } catch(_) {}
                } else if (rec && rec.ref && rec.handler) { try { rec.ref.off('value', rec.handler); } catch(_) {} }
                window.financeReceberListeners.delete(mk);
            }
        });
        // Subscribe new
        want.forEach(mk => {
            if (window.financeReceberListeners.has(mk)) return;
            const db = window.firebaseService && window.firebaseService.database;
            if (!db) return;
            const svc = window.firebaseService;
            const tenant = svc && svc.getCurrentTenantId ? svc.getCurrentTenantId() : null;
            const nsPath = getNamespacedPath(`financas/receber/${mk}`);
            const paths = [ nsPath ]; // ✅ CORREÇÃO: Apenas namespace de inquilino para evitar falha de permissão e vazamento de dados
            const refs = [];
            const handlers = [];
            paths.forEach((pathStr, idx) => {
                try {
                    const r = db.ref(pathStr);
                    const h = (snapshot) => {
                        try {
                            const data = snapshot && snapshot.val ? snapshot.val() : (snapshot ? snapshot.val() : null);
                            const arr = data ? (Array.isArray(data) ? data : Object.values(data || {})) : [];
                            contasReceber = mergeFinanceMonthData(contasReceber, arr, mk, 'contasReceber_deletedIds');
                            financeDevLog('listener.receber.applied', { month: mk, records: Array.isArray(arr) ? arr.length : 0 });
                            window.financeOffline = false; updateOfflineBadge();
                            if (!window.__financeSaveInProgress) {
                                carregarTabelaReceber(lastFiltroReceber || {});
                            }
                        } catch(e) { console.warn('recv onValue merge falhou:', e); }
                    };
                    r.on('value', h);
                    refs.push(r); handlers.push(h);
                } catch(_) {}
            });
            window.financeReceberListeners.set(mk, { refs, handlers });
        });
    } catch(e) { console.warn('subscribeReceberMonths falhou:', e); }
}

function subscribePagarMonths(months) {
    try {
        window.financePagarListeners = window.financePagarListeners || new Map();
        const want = Array.from(new Set(months || []));
        const have = Array.from(window.financePagarListeners.keys());
        have.forEach(mk => {
            if (!want.includes(mk)) {
                const rec = window.financePagarListeners.get(mk);
                if (rec && rec.refs && rec.handlers) { try { (rec.refs||[]).forEach((r,i)=>{ try { r.off('value', (rec.handlers||[])[i]); } catch(_) {} }); } catch(_) {} }
                else if (rec && rec.ref && rec.handler) { try { rec.ref.off('value', rec.handler); } catch(_) {} }
                window.financePagarListeners.delete(mk);
            }
        });
        want.forEach(mk => {
            if (window.financePagarListeners.has(mk)) return;
            const db = window.firebaseService && window.firebaseService.database;
            if (!db) return;
            const svc = window.firebaseService;
            const tenant = svc && svc.getCurrentTenantId ? svc.getCurrentTenantId() : null;
            const nsPath = getNamespacedPath(`financas/pagar/${mk}`);
            const paths = [ nsPath ]; // ✅ CORREÇÃO: Apenas namespace de inquilino para evitar falha de permissão e vazamento de dados
            const refs = []; const handlers = [];
            paths.forEach(pathStr => {
                try {
                    const r = db.ref(pathStr);
                    const h = (snapshot) => {
                        try {
                            const data = snapshot && snapshot.val ? snapshot.val() : (snapshot ? snapshot.val() : null);
                            const arr = data ? (Array.isArray(data) ? data : Object.values(data || {})) : [];
                            contasPagar = mergeFinanceMonthData(contasPagar, arr, mk, 'contasPagar_deletedIds');
                            financeDevLog('listener.pagar.applied', { month: mk, records: Array.isArray(arr) ? arr.length : 0 });
                            window.financeOffline = false; updateOfflineBadge();
                            if (!window.__financeSaveInProgress) {
                                carregarTabelaPagar(lastFiltroPagar || {});
                            }
                        } catch(e) { console.warn('pagar onValue merge falhou:', e); }
                    };
                    r.on('value', h);
                    refs.push(r); handlers.push(h);
                } catch(_) {}
            });
            window.financePagarListeners.set(mk, { refs, handlers });
        });
    } catch(e) { console.warn('subscribePagarMonths falhou:', e); }
}

function detachFinanceListeners() {
    try {
        if (window.financeReceberListeners) {
            window.financeReceberListeners.forEach(rec => { try { (rec.refs||[]).forEach((r,i)=>{ try { r.off('value', (rec.handlers||[])[i]); } catch(_) {} }); } catch(_) {} });
            window.financeReceberListeners.clear();
        }
        if (window.financePagarListeners) {
            window.financePagarListeners.forEach(rec => { try { (rec.refs||[]).forEach((r,i)=>{ try { r.off('value', (rec.handlers||[])[i]); } catch(_) {} }); } catch(_) {} });
            window.financePagarListeners.clear();
        }
    } catch(_) {}
}

function clearFinancePrivateSessionState() {
    detachFinanceListeners();
    clearFinanceReportCompanyCache();
    contasReceber = [];
    contasPagar = [];
    clientes = [];
    fornecedores = [];
    funcionarios = [];
    contaAtualEdicao = null;
    tipoContaAtual = '';
    financeSessionTenant = '';
    window.selReceberSelection = new Set();
    window.selPagarSelection = new Set();
    window.financeMonthsLoadedReceber = new Set();
    window.financeMonthsLoadedPagar = new Set();
    window.financeReportMonthsConfirmedReceber = new Set();
    window.financeReportMonthsConfirmedPagar = new Set();
    window.__financeReportState = null;
    window.__financePendingStorageReview = [];
    const paymentForm = document.getElementById('pagamentoForm');
    clearFinancePaymentAttemptState(paymentForm);
}

try {
    window.addEventListener('beforeunload', detachFinanceListeners);
    window.addEventListener('pagehide', clearFinancePrivateSessionState);
    window.addEventListener('pageshow', (event) => {
        if (event && event.persisted) window.location.reload();
    });
    window.addEventListener('sisweb:session-state', (event) => {
        const detail = event && event.detail || {};
        if (detail.authenticated !== true) {
            clearFinancePrivateSessionState();
            return;
        }
        if (detail.tenantReady !== true) return;
        const currentTenant = String(
            window.firebaseService && typeof window.firebaseService.getCurrentTenantId === 'function'
                ? window.firebaseService.getCurrentTenantId() || ''
                : ''
        );
        if (financeSessionTenant && currentTenant && currentTenant !== financeSessionTenant) {
            clearFinancePrivateSessionState();
        }
        financeSessionTenant = currentTenant;
    });
} catch(_) {}

// Reaplicar render após meses carregados (rede lenta)
try {
    window.addEventListener('finance:monthsLoaded', (ev) => {
        try {
            try { if (window.firebaseService && typeof window.firebaseService.flushLocalOps === 'function') window.firebaseService.flushLocalOps(); } catch(_) {}
            try { updateOfflineBadge(); } catch(_) {}
        } catch(_) {}
    });
    window.addEventListener('firebaseServiceReady', () => { try { updateOfflineBadge(); } catch(_) {} });
    window.addEventListener('firebaseReady', () => { try { updateOfflineBadge(); } catch(_) {} });
    window.addEventListener('online', () => { try { updateOfflineBadge(); } catch(_) {} });
    window.addEventListener('offline', () => { try { updateOfflineBadge(); } catch(_) {} });
    window.addEventListener('finance:enqueueMonths', (ev) => {
        try {
            const tipo = ev && ev.detail && ev.detail.tipo;
            const months = ev && ev.detail && ev.detail.months || [];
            window.financeTableOverlayOnce = true;
            if (tipo === 'receber') {
                ensureReceberMonths(months).then(()=>carregarTabelaReceber(lastFiltroReceber || {}));
            } else if (tipo === 'pagar') {
                ensurePagarMonths(months).then(()=>carregarTabelaPagar(lastFiltroPagar || {}));
            }
        } catch(_) {}
    });
} catch(_) {}

function filtrarContas(tipo) {
    try {
        window.financeFilterOverlayActive = false;
    } catch (_) {}
    window.financeTableOverlayOnce = false;
    const filtro = {};
    
        if (tipo === 'receber') {
            currentPageReceber = 1; // resetar página ao filtrar
            filtro.status = document.getElementById('filtroReceberStatus').value;
            filtro.clienteId = document.getElementById('filtroReceberCliente').value;
            filtro.categoria = document.getElementById('filtroReceberCategoria')?.value || '';
            filtro.tipo = document.getElementById('filtroReceberTipo')?.value || '';
            filtro.pedidoNumero = document.getElementById('filtroReceberNumeroPedido')?.value || '';
            filtro.dataInicio = document.getElementById('filtroReceberDataInicio').value;
            filtro.dataFim = document.getElementById('filtroReceberDataFim').value;
            carregarTabelaReceber(filtro);
        } else {
            currentPagePagar = 1; // resetar página ao filtrar
            filtro.status = document.getElementById('filtroPagarStatus').value;
            filtro.fornecedorId = document.getElementById('filtroPagarFornecedor').value;
            filtro.categoria = document.getElementById('filtroPagarCategoria')?.value || '';
            filtro.tipo = document.getElementById('filtroPagarTipo')?.value || '';
            filtro.pedidoNumero = document.getElementById('filtroPagarNumeroPedido')?.value || '';
            filtro.dataInicio = document.getElementById('filtroPagarDataInicio').value;
            filtro.dataFim = document.getElementById('filtroPagarDataFim').value;
            carregarTabelaPagar(filtro);
        }
}

// Funções de pagamento/recebimento
function isPaymentModalBusy() {
    const form = document.getElementById('pagamentoForm');
    return !!form && form.dataset.financeBusy === 'true';
}

function setPaymentModalBusy(busy) {
    const form = document.getElementById('pagamentoForm');
    const modal = document.getElementById('pagamentoModal');
    if (!form || !modal) return;
    form.dataset.financeBusy = busy ? 'true' : 'false';
    form.setAttribute('aria-busy', busy ? 'true' : 'false');
    modal.querySelectorAll('button').forEach((button) => {
        if (busy) {
            button.dataset.financeWasDisabled = button.disabled ? 'true' : 'false';
            button.disabled = true;
        } else if (button.dataset.financeWasDisabled !== undefined) {
            button.disabled = button.dataset.financeWasDisabled === 'true';
            delete button.dataset.financeWasDisabled;
        }
    });
}

function getFinanceModalFocusable(modal) {
    if (!modal) return [];
    return Array.from(modal.querySelectorAll('button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'))
        .filter((element) => !element.disabled && element.getAttribute('aria-hidden') !== 'true');
}

function openFinanceModalDialog(modalId, preferredFocusSelector) {
    const modal = document.getElementById(modalId);
    if (!modal) return;
    if (String(modal.style.display || '').toLowerCase() !== 'block') {
        financeModalPreviousFocus = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    }
    modal.style.display = 'block';
    modal.setAttribute('aria-hidden', 'false');
    if (modalId === 'pagamentoModal') setPaymentModalBusy(false);
    updateFinanceModalBodyScrollLock();
    const focusTarget = preferredFocusSelector ? modal.querySelector(preferredFocusSelector) : null;
    const fallbackTarget = getFinanceModalFocusable(modal)[0] || modal.querySelector('.modal-content');
    const target = focusTarget || fallbackTarget;
    if (target) {
        if (!target.hasAttribute('tabindex') && !target.matches('button, input, select, textarea, [href]')) target.setAttribute('tabindex', '-1');
        window.requestAnimationFrame(() => target.focus());
    }
}

function handleFinanceModalKeydown(event) {
    const modal = document.getElementById('pagamentoModal');
    if (!modal || String(modal.style.display || '').toLowerCase() !== 'block') return;
    if (event.key === 'Escape') {
        event.preventDefault();
        if (!isPaymentModalBusy()) fecharModal('pagamentoModal');
        return;
    }
    if (event.key !== 'Tab') return;
    const focusable = getFinanceModalFocusable(modal);
    if (!focusable.length) {
        event.preventDefault();
        return;
    }
    const first = focusable[0];
    const last = focusable[focusable.length - 1];
    if (!modal.contains(document.activeElement)) {
        event.preventDefault();
        first.focus();
    } else if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
    } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
    }
}

if (!window.__financePaymentDialogKeyboardBound) {
    document.addEventListener('keydown', handleFinanceModalKeydown);
    window.__financePaymentDialogKeyboardBound = true;
}

function abrirModalPagamento(contaId, tipo) {
    contaAtualEdicao = contaId;
    tipoContaAtual = tipo;
    
    const conta = tipo === 'receber' 
        ? (contasReceber.find(c => c.id === contaId) || contasReceber.find(c => c.id == contaId) || contasReceber.find(c => String(c.id) === String(contaId)))
        : (contasPagar.find(c => c.id === contaId) || contasPagar.find(c => c.id == contaId) || contasPagar.find(c => String(c.id) === String(contaId)));
    
    if (!conta) {
        try {
            const msg = 'Conta não encontrada';
            if (typeof window.__toast === 'function') window.__toast(msg, 'error', { duration: 5000 });
            else if (window.Utils && window.Utils.showToast) window.Utils.showToast(msg, 'error');
        } catch (_) {}
        return;
    }
    
    // ✅ CORREÇÃO: Restaurar formulário antes de configurar (caso tenha sido usado para histórico)
    const form = document.getElementById('pagamentoForm');
    clearFinancePaymentAttemptState(form, { uncertain: !!form.__financePendingPaymentUpload });
    const originalContent = form.getAttribute('data-original-content');
    if (originalContent) {
        form.innerHTML = originalContent;
        form.removeAttribute('data-original-content');
    }
    
    // Configurar modal
    document.getElementById('pagamentoModalTitle').textContent = 
        tipo === 'receber' ? 'Registrar Recebimento' : 'Registrar Pagamento';
    
    const statusNorm = String((conta.status || '')).toLowerCase();
    const valorOriginalNum = parseCurrencyValue(conta.valorOriginal ?? conta.valor);
    const valorPagoNum = parseCurrencyValue(conta.valorPago ?? 0);
    const valorRestanteNum = (conta.valorRestante !== undefined && conta.valorRestante !== null)
        ? parseCurrencyValue(conta.valorRestante)
        : Math.max(0, valorOriginalNum - valorPagoNum);
    const jurosInfo = computeContaJurosInfo(conta);
    const valorExibirNum = (statusNorm === 'pago')
        ? parseCurrencyValue(conta.valor)
        : parseCurrencyValue(jurosInfo.totalComJuros);
    document.getElementById('pagamentoValor').value = formatCurrencyNoSymbol(valorExibirNum);
    document.getElementById('pagamentoData').value = getTodayISODateLocal();
    
    // Limpar campos opcionais
    document.getElementById('pagamentoMetodo').value = 'dinheiro';
    document.getElementById('pagamentoObservacoes').value = '';
    
    // ✅ CORREÇÃO: Adicionar informação se for conta parcial ou se houver histórico
    if (conta.status === 'parcial' || (conta.historicosPagamento && conta.historicosPagamento.length > 0) || valorRestanteNum === 0) {
        const valorOriginal = valorOriginalNum;
        const valorPago = valorPagoNum;
        const infoDiv = document.createElement('div');
        infoDiv.id = 'infoPagamentoParcial';
        infoDiv.innerHTML = `
            <div style="background: #e3f2fd; padding: 10px; border-radius: 4px; margin-bottom: 10px; border-left: 4px solid #2196f3;">
                <strong>Informações do Pagamento:</strong><br>
                Valor original: ${formatCurrency(valorOriginal)}<br>
                Já pago: ${formatCurrency(valorPago)}<br>
                Valor restante: ${formatCurrency(valorRestanteNum)}<br>
                Juros atraso: ${formatCurrency(jurosInfo.juros)}<br>
                Total com juros: ${formatCurrency(jurosInfo.totalComJuros)}
            </div>
        `;
        
        // Remover info anterior se existir
        const infoAnterior = document.getElementById('infoPagamentoParcial');
        if (infoAnterior) {
            infoAnterior.remove();
        }
        
        // Inserir info antes do formulário
        form.insertBefore(infoDiv, form.firstChild);
    }
    
    // Abrir modal
    openFinanceModalDialog('pagamentoModal', '#pagamentoData');
}

// Seleção Receber
function onReceberSelectChange(input) {
    try { window.selReceberSelection = window.selReceberSelection || new Set(); } catch(_) {}
    const tr = input.closest('tr'); if (!tr) return;
    const id = tr.getAttribute('data-conta-id'); if (!id) return;
    if (input.checked) window.selReceberSelection.add(String(id)); else window.selReceberSelection.delete(String(id));
    updateReceberSelectionCount();
}

function toggleSelecionarTodosReceber(checked) {
    try { window.selReceberSelection = window.selReceberSelection || new Set(); } catch(_) {}
    const filtro = {};
    try {
        filtro.status = document.getElementById('filtroReceberStatus').value;
        filtro.clienteId = document.getElementById('filtroReceberCliente').value;
        filtro.categoria = document.getElementById('filtroReceberCategoria')?.value || '';
        filtro.tipo = document.getElementById('filtroReceberTipo')?.value || '';
        filtro.pedidoNumero = document.getElementById('filtroReceberNumeroPedido')?.value || '';
        filtro.dataInicio = document.getElementById('filtroReceberDataInicio').value;
        filtro.dataFim = document.getElementById('filtroReceberDataFim').value;
    } catch(_) {}
    let allItems = [];
    try { allItems = computeFilteredReceber(filtro) || []; } catch(_) { allItems = []; }
    const ids = allItems.map(c => String(c.id)).filter(Boolean);
    if (checked) { ids.forEach(id => window.selReceberSelection.add(id)); }
    else { ids.forEach(id => window.selReceberSelection.delete(id)); }
    const rows = Array.from(document.querySelectorAll('#receberTable tr'));
    rows.forEach(r => {
        const cb = r.querySelector('.sel-receber');
        if (!cb || cb.disabled) return;
        cb.checked = checked;
    });
    updateReceberSelectionCount();
}

function updateReceberSelectionCount() {
    const el = document.getElementById('receberSelCount'); if (!el) return;
    const selected = Array.from(window.selReceberSelection || new Set()).map(String);
    const count = selected.length;
    const base = Array.isArray(contasReceber) ? contasReceber : [];
    const totalSelecionado = base
        .filter((conta) => selected.includes(String(conta && conta.id)))
        .reduce((sum, conta) => {
            const statusNorm = String(conta && conta.status || 'pendente').toLowerCase();
            const valor = statusNorm === 'parcial'
                ? parseCurrencyValue((conta && conta.valorRestante) ?? (conta && conta.valor) ?? 0)
                : parseCurrencyValue((conta && conta.valor) ?? 0);
            return sum + valor;
        }, 0);
    el.textContent = `${count} selecionados • Total Selecionado: ${formatCurrency(totalSelecionado)}`;
}

// Seleção Pagar
function onPagarSelectChange(input) {
    try { window.selPagarSelection = window.selPagarSelection || new Set(); } catch(_) { window.selPagarSelection = new Set(); }
    const tr = input.closest('tr'); if (!tr) return;
    const rawId = tr.getAttribute('data-conta-id');
    if (!rawId || rawId === 'undefined' || rawId === 'null') return;
    const id = String(rawId);
    if (input.checked) window.selPagarSelection.add(id); else window.selPagarSelection.delete(id);
    updatePagarSelectionCount();
}

function toggleSelecionarTodosPagar(checked) {
    try { window.selPagarSelection = window.selPagarSelection || new Set(); } catch(_) { window.selPagarSelection = new Set(); }
    const rows = Array.from(document.querySelectorAll('#pagarTable tr'));
    rows.forEach(r => {
        const cb = r.querySelector('.sel-pagar');
        if (!cb || cb.disabled) return;
        const rawId = r.getAttribute('data-conta-id');
        if (!rawId || rawId === 'undefined' || rawId === 'null') return;
        const id = String(rawId);
        
        cb.checked = checked;
        if (checked) window.selPagarSelection.add(id);
        else window.selPagarSelection.delete(id);
    });
    updatePagarSelectionCount();
}

function updatePagarSelectionCount() {
    const el = document.getElementById('pagarSelCount'); if (!el) return;
    const selected = Array.from(window.selPagarSelection || new Set()).map(String);
    const count = selected.length;
    const base = Array.isArray(contasPagar) ? contasPagar : [];
    const totalSelecionado = base
        .filter((conta) => selected.includes(String(conta && conta.id)))
        .reduce((sum, conta) => {
            const statusNorm = String(conta && conta.status || 'pendente').toLowerCase();
            let valor = 0;
            if (statusNorm === 'parcial') {
                const valorOriginal = parseCurrencyValue((conta && conta.valorOriginal) ?? (conta && conta.valor) ?? 0);
                const valorPago = parseCurrencyValue((conta && conta.valorPago) ?? 0);
                const restante = parseCurrencyValue((conta && conta.valorRestante) ?? Math.max(0, valorOriginal - valorPago));
                valor = restante;
            } else {
                valor = parseCurrencyValue((conta && conta.valor) ?? 0);
            }
            return sum + valor;
        }, 0);
    el.textContent = `${count} selecionados • Total Selecionado: ${formatCurrency(totalSelecionado)}`;
}

// Função para ver histórico de pagamentos
async function anexarComprovanteHistorico(contaId, tipo = 'receber', registroRef = 'total') {
    try {
        const arr = tipo === 'receber' ? contasReceber : contasPagar;
        const conta = (arr || []).find(c => String(c && c.id) === String(contaId));
        if (!conta) {
            mostrarNotificacao('Conta não encontrada.', 'error');
            return;
        }
        if (!window.storageService || typeof window.storageService.uploadFile !== 'function') {
            mostrarNotificacao('Upload indisponível: Storage não inicializado.', 'warning');
            return;
        }
        const input = document.createElement('input');
        input.type = 'file';
        input.accept = 'image/*,application/pdf';
        input.style.display = 'none';
        input.addEventListener('change', async (event) => {
            try {
                const file = event && event.target && event.target.files ? event.target.files[0] : null;
                if (!file) return;
                const previous = resolveHistoricoPagamento(conta, registroRef);
                const previousStoragePath = resolveAttachmentStoragePath(previous);
                const uploadMeta = await uploadAttachmentMetaForConta(file, tipo, conta.id, {
                    replaceStoragePath: previousStoragePath
                });
                const nextUrl = uploadMeta && uploadMeta.url ? uploadMeta.url : null;
                const nextStoragePath = uploadMeta && uploadMeta.storagePath ? uploadMeta.storagePath : null;
                if (!nextUrl) {
                    mostrarNotificacao('Falha ao anexar comprovante.', 'error');
                    return;
                }

                await updateFinancePaymentReceiptAuthoritative(tipo, conta, registroRef, {
                    url: nextUrl,
                    storagePath: nextStoragePath
                }, createFinanceOperationId('attach_receipt'));
                if (previous && previous.url && !isSameStorageObject(previousStoragePath, nextStoragePath)) {
                    await deleteStorageFileSafely(previousStoragePath || previous.storagePath, previous.url);
                }
                if (tipo === 'receber') await carregarTabelaReceber(lastFiltroReceber || {});
                else await carregarTabelaPagar(lastFiltroPagar || {});
                atualizarDashboard();
                verHistoricoPagamentos(contaId, tipo);
                mostrarNotificacao('Comprovante anexado com sucesso.', 'success');
            } catch (error) {
                console.error('Erro ao anexar comprovante no histórico:', error);
                const errCode = (error && (error.code || '')).toString();
                if (errCode === 'storage/quota-exceeded' || (error && error.message && error.message.includes('quota-exceeded'))) {
                    mostrarNotificacao(
                        '⚠️ Cota de armazenamento esgotada! Contate o administrador para fazer upgrade do plano Firebase Storage.',
                        'error'
                    );
                } else {
                    mostrarNotificacao('Não foi possível anexar comprovante no histórico.', 'error');
                }
            } finally {
                if (input.parentNode) input.parentNode.removeChild(input);
            }
        }, { once: true });
        document.body.appendChild(input);
        input.click();
    } catch (error) {
        console.error('Erro ao iniciar anexo no histórico:', error);
        mostrarNotificacao('Não foi possível iniciar o anexo.', 'error');
    }
}

async function excluirComprovanteHistorico(contaId, tipo = 'receber', registroRef = 'total') {
    try {
        const arr = tipo === 'receber' ? contasReceber : contasPagar;
        const conta = (arr || []).find(c => String(c && c.id) === String(contaId));
        if (!conta) {
            mostrarNotificacao('Conta não encontrada.', 'error');
            return;
        }
        const current = resolveHistoricoPagamento(conta, registroRef);
        if (!current || !current.url) {
            mostrarNotificacao('Comprovante não encontrado.', 'warning');
            return;
        }
        if (!confirm('Remover comprovante deste registro?')) return;

        await updateFinancePaymentReceiptAuthoritative(
            tipo,
            conta,
            registroRef,
            { url: null, storagePath: null },
            createFinanceOperationId('remove_receipt')
        );
        await deleteStorageFileSafely(current.storagePath, current.url);
        if (tipo === 'receber') await carregarTabelaReceber(lastFiltroReceber || {});
        else await carregarTabelaPagar(lastFiltroPagar || {});
        atualizarDashboard();
        verHistoricoPagamentos(contaId, tipo);
        mostrarNotificacao('Comprovante removido com sucesso.', 'success');
    } catch (error) {
        console.error('Erro ao remover comprovante do histórico:', error);
        mostrarNotificacao('Não foi possível remover o comprovante.', 'error');
    }
}

function verHistoricoPagamentos(contaId, tipo = 'receber') {
    // ✅ CORREÇÃO: Suportar tanto receber quanto pagar
    const conta = tipo === 'receber' 
        ? (contasReceber.find(c => c.id === contaId) || contasReceber.find(c => c.id == contaId) || contasReceber.find(c => String(c.id) === String(contaId)))
        : (contasPagar.find(c => c.id === contaId) || contasPagar.find(c => c.id == contaId) || contasPagar.find(c => String(c.id) === String(contaId)));
    
    if (!conta) {
        try {
            const msg = 'Conta não encontrada';
            if (typeof window.__toast === 'function') window.__toast(msg, 'error', { duration: 5000 });
            else if (window.Utils && window.Utils.showToast) window.Utils.showToast(msg, 'error');
        } catch (_) {}
        return;
    }
    
    const toCents = (v) => {
        const n = typeof v === 'number' ? v : parseCurrencyValue(v);
        if (!isFinite(n) || isNaN(n)) return 0;
        return Math.round(n * 100);
    };
    const valorOriginalNum = parseCurrencyValue(conta.valorOriginal ?? conta.valor ?? 0);
    const timeline = buildContaJurosTimeline(conta);
    let totalPagoNum = timeline.rows.reduce((sum, r) => sum + (r.pagamentoCents / 100), 0);
    const statusNorm = String(conta.status || '').toLowerCase();
    if (totalPagoNum <= 0 && statusNorm === 'pago') totalPagoNum = valorOriginalNum;
    const pagoCents = toCents(totalPagoNum);
    const restanteCentsRaw = timeline.saldoFinalCents;
    const restanteCents = restanteCentsRaw <= 1 ? 0 : restanteCentsRaw;
    const valorRestanteNum = restanteCents / 100;
    const openPeriod = getOpenJurosPeriod(conta, timeline);
    const jurosAbertoNum = computeJurosByPeriod(valorRestanteNum, conta.jurosTaxa, openPeriod.dias, conta.jurosTipo);
    const valorRestanteAtualizadoNum = valorRestanteNum + jurosAbertoNum;
    const periodoInicioAberto = formatDate(openPeriod.tsStart);
    const periodoFimAberto = formatDate(openPeriod.tsEnd);
    const hasJurosConfigured = normalizeJurosTipoKey(conta && conta.jurosTipo) !== 'none' && parseJurosTaxa(conta && conta.jurosTaxa) > 0;

    
    
    const escapeHtml = escapeFinanceHtml;
    const contaIdArg = getFinanceInlineStringArgument(contaId);
    const tipoArg = getFinanceInlineStringArgument(tipo);

    let historico = '<div style="overflow-x:hidden; width:100%;">';
    historico += '<table style="width: 100%; border-collapse: collapse; table-layout: fixed; font-size:11px; line-height:1.1;">';
    historico += '<colgroup><col style="width:12%;"><col style="width:13%;"><col style="width:14%;"><col style="width:14%;"><col style="width:10%;"><col style="width:23%;"><col style="width:7%;"><col style="width:7%;"></colgroup>';
    historico += '<thead><tr style="background: #f5f5f5;"><th style="padding: 4px 5px; border: 1px solid #ddd; white-space: nowrap;">Data</th><th style="padding: 4px 5px; border: 1px solid #ddd; white-space: nowrap;">Juros Período</th><th style="padding: 4px 5px; border: 1px solid #ddd; white-space: nowrap;">Pagamento</th><th style="padding: 4px 5px; border: 1px solid #ddd; white-space: nowrap;">Saldo Após</th><th style="padding: 4px 5px; border: 1px solid #ddd; white-space: nowrap;">Método</th><th style="padding: 4px 5px; border: 1px solid #ddd; white-space: nowrap;">Observações</th><th style="padding: 4px 5px; border: 1px solid #ddd; text-align: center; white-space: nowrap;">Anexo</th><th style="padding: 4px 5px; border: 1px solid #ddd; text-align: center; white-space: nowrap;">Ações</th></tr></thead>';
    historico += '<tbody>';
    
    // ✅ CORREÇÃO: Exibir histórico de pagamentos parciais se existir
    if (timeline.rows.length > 0) {
        timeline.rows.forEach((row, index) => {
            const pagamento = row.originalRef || {};
            const historicoIndex = Number.isInteger(pagamento.__idx) ? pagamento.__idx : index;
            const comprovanteUrl = getSafeFinanceDownloadUrl(pagamento.comprovanteUrl);
            const comprovanteUrlArg = getFinanceInlineStringArgument(comprovanteUrl);
            const metodo = escapeHtml(pagamento.metodo || '-');
            const observacoes = escapeHtml(pagamento.observacoes || '-');
            historico += `
                <tr>
                    <td style="padding: 3px 5px; border: 1px solid #ddd; white-space: nowrap;">${formatDate(pagamento.data)}</td>
                    <td style="padding: 3px 5px; border: 1px solid #ddd; text-align: right; white-space: nowrap;" title="Dias atraso no período: ${row.diasAtraso}">${formatCurrency(row.jurosCents / 100)}</td>
                    <td style="padding: 3px 5px; border: 1px solid #ddd; text-align: right; white-space: nowrap;">${formatCurrency(row.pagamentoCents / 100)}</td>
                    <td style="padding: 3px 5px; border: 1px solid #ddd; text-align: right; white-space: nowrap;">${formatCurrency(row.saldoDepoisCents / 100)}</td>
                    <td style="padding: 3px 5px; border: 1px solid #ddd; white-space: nowrap; overflow:hidden; text-overflow:ellipsis;">${metodo}</td>
                    <td style="padding: 3px 5px; border: 1px solid #ddd; white-space: nowrap; overflow:hidden; text-overflow:ellipsis;">${observacoes}</td>
                    <td style="padding: 3px 5px; border: 1px solid #ddd; text-align: center;">
                        ${comprovanteUrl
                            ? `<button type="button" class="btn btn-sm btn-info" onclick="openFinanceAttachment(${comprovanteUrlArg})" title="Ver Comprovante" style="padding:1px 5px; font-size:11px;"><i class="fas fa-eye"></i></button>`
                            : `<button type="button" class="btn btn-sm btn-outline-secondary" onclick="anexarComprovanteHistorico(${contaIdArg}, ${tipoArg}, ${historicoIndex})" title="Anexar comprovante" style="padding:1px 5px; font-size:11px;"><i class="fas fa-paperclip" style="opacity:.75;"></i></button>`}
                    </td>
                    <td style="padding: 3px 5px; border: 1px solid #ddd; text-align: center;">
                        <button type="button" onclick="excluirPagamento(${contaIdArg}, ${tipoArg}, ${historicoIndex}, this)" class="btn btn-sm btn-danger" title="Excluir pagamento" style="padding:1px 5px; font-size:11px;"><i class="fas fa-trash"></i></button>
                    </td>
                </tr>
            `;
        });
    } else if (statusNorm === 'pago' && conta.dataPagamento) {
        const comprovanteUrl = getSafeFinanceDownloadUrl(conta.comprovanteUrl);
        const comprovanteUrlArg = getFinanceInlineStringArgument(comprovanteUrl);
        const metodo = escapeHtml(conta.metodoPagamento || 'Não informado');
        const observacoes = escapeHtml(conta.observacoesPagamento || 'Pagamento completo');
        // ✅ CORREÇÃO: Para contas pagas sem histórico, exibir o pagamento único
        historico += `
            <tr>
                <td style="padding: 3px 5px; border: 1px solid #ddd; white-space: nowrap;">${formatDate(conta.dataPagamento)}</td>
                <td style="padding: 3px 5px; border: 1px solid #ddd; text-align: right; white-space: nowrap;">${formatCurrency(0)}</td>
                <td style="padding: 3px 5px; border: 1px solid #ddd; text-align: right; white-space: nowrap;">${formatCurrency(valorOriginalNum)}</td>
                <td style="padding: 3px 5px; border: 1px solid #ddd; text-align: right; white-space: nowrap;">${formatCurrency(0)}</td>
                <td style="padding: 3px 5px; border: 1px solid #ddd; white-space: nowrap; overflow:hidden; text-overflow:ellipsis;">${metodo}</td>
                <td style="padding: 3px 5px; border: 1px solid #ddd; white-space: nowrap; overflow:hidden; text-overflow:ellipsis;">${observacoes}</td>
                <td style="padding: 3px 5px; border: 1px solid #ddd; text-align: center;">
                    ${comprovanteUrl
                        ? `<button type="button" class="btn btn-sm btn-info" onclick="openFinanceAttachment(${comprovanteUrlArg})" title="Ver Comprovante" style="padding:1px 5px; font-size:11px;"><i class="fas fa-eye"></i></button>`
                        : `<button type="button" class="btn btn-sm btn-outline-secondary" onclick="anexarComprovanteHistorico(${contaIdArg}, ${tipoArg}, 'total')" title="Anexar comprovante" style="padding:1px 5px; font-size:11px;"><i class="fas fa-paperclip" style="opacity:.75;"></i></button>`}
                </td>
                <td style="padding: 3px 5px; border: 1px solid #ddd; text-align: center;">
                    <button type="button" onclick="excluirPagamento(${contaIdArg}, ${tipoArg}, 'total', this)" class="btn btn-sm btn-danger" title="Excluir pagamento" style="padding:1px 5px; font-size:11px;"><i class="fas fa-trash"></i></button>
                </td>
            </tr>
        `;
    } else {
        historico += '<tr><td colspan="8" style="padding: 8px; text-align: center; border: 1px solid #ddd;">Nenhum pagamento registrado</td></tr>';
    }
    
    historico += '</tbody></table></div>';
    
    const resumoStepRows = [];
    resumoStepRows.push(`<tr><td style="padding:3px 6px; border:1px solid #e5e7eb; font-size:11px; line-height:1.1;">Valor original</td><td style="padding:3px 6px; border:1px solid #e5e7eb; text-align:right; font-size:11px; line-height:1.1; white-space:nowrap;">${formatCurrency(valorOriginalNum)}</td></tr>`);
    if (timeline.rows.length > 0) {
        timeline.rows.forEach((row) => {
            if (hasJurosConfigured) {
                resumoStepRows.push(`<tr><td style="padding:3px 6px; border:1px solid #e5e7eb; font-size:11px; line-height:1.1;">Juros acumulado</td><td style="padding:3px 6px; border:1px solid #e5e7eb; text-align:right; font-size:11px; line-height:1.1; white-space:nowrap;">${formatCurrency(row.jurosCents / 100)}</td></tr>`);
                resumoStepRows.push(`<tr><td style="padding:3px 6px; border:1px solid #e5e7eb; font-size:11px; line-height:1.1;">Valor total</td><td style="padding:3px 6px; border:1px solid #e5e7eb; text-align:right; font-size:11px; line-height:1.1; white-space:nowrap;">${formatCurrency(row.saldoAntesCents / 100)}</td></tr>`);
            }
            resumoStepRows.push(`<tr><td style="padding:3px 6px; border:1px solid #e5e7eb; font-size:11px; line-height:1.1;">Total pago</td><td style="padding:3px 6px; border:1px solid #e5e7eb; text-align:right; font-size:11px; line-height:1.1; white-space:nowrap;">${formatCurrency(row.pagamentoCents / 100)}</td></tr>`);
            resumoStepRows.push(`<tr><td style="padding:3px 6px; border:1px solid #e5e7eb; font-size:11px; line-height:1.1;">Valor restante</td><td style="padding:3px 6px; border:1px solid #e5e7eb; text-align:right; font-size:11px; line-height:1.1; white-space:nowrap;">${formatCurrency(row.saldoDepoisCents / 100)}</td></tr>`);
        });
    } else {
        if (hasJurosConfigured) {
            resumoStepRows.push(`<tr><td style="padding:3px 6px; border:1px solid #e5e7eb; font-size:11px; line-height:1.1;">Juros acumulado</td><td style="padding:3px 6px; border:1px solid #e5e7eb; text-align:right; font-size:11px; line-height:1.1; white-space:nowrap;">${formatCurrency(0)}</td></tr>`);
            resumoStepRows.push(`<tr><td style="padding:3px 6px; border:1px solid #e5e7eb; font-size:11px; line-height:1.1;">Valor total</td><td style="padding:3px 6px; border:1px solid #e5e7eb; text-align:right; font-size:11px; line-height:1.1; white-space:nowrap;">${formatCurrency(valorOriginalNum)}</td></tr>`);
        }
        resumoStepRows.push(`<tr><td style="padding:3px 6px; border:1px solid #e5e7eb; font-size:11px; line-height:1.1;">Total pago</td><td style="padding:3px 6px; border:1px solid #e5e7eb; text-align:right; font-size:11px; line-height:1.1; white-space:nowrap;">${formatCurrency(totalPagoNum)}</td></tr>`);
        resumoStepRows.push(`<tr><td style="padding:3px 6px; border:1px solid #e5e7eb; font-size:11px; line-height:1.1;">Valor restante</td><td style="padding:3px 6px; border:1px solid #e5e7eb; text-align:right; font-size:11px; line-height:1.1; white-space:nowrap;">${formatCurrency(valorRestanteNum)}</td></tr>`);
    }
    if (hasJurosConfigured && jurosAbertoNum > 0.009) {
        resumoStepRows.push(`<tr><td style="padding:3px 6px; border:1px solid #e5e7eb; font-size:11px; line-height:1.1;">Juros acumulado</td><td style="padding:3px 6px; border:1px solid #e5e7eb; text-align:right; font-size:11px; line-height:1.1; white-space:nowrap;">${formatCurrency(jurosAbertoNum)} (contado do período em aberto)</td></tr>`);
        resumoStepRows.push(`<tr><td style="padding:3px 6px; border:1px solid #e5e7eb; font-size:11px; line-height:1.1;">Período do juros em aberto</td><td style="padding:3px 6px; border:1px solid #e5e7eb; text-align:right; font-size:11px; line-height:1.1; white-space:nowrap;">${periodoInicioAberto} até ${periodoFimAberto}</td></tr>`);
        resumoStepRows.push(`<tr><td style="padding:3px 6px; border:1px solid #e5e7eb; font-size:11px; line-height:1.1;">Valor restante</td><td style="padding:3px 6px; border:1px solid #e5e7eb; text-align:right; font-size:11px; line-height:1.1; white-space:nowrap;">${formatCurrency(valorRestanteAtualizadoNum)}</td></tr>`);
    }
    historico += `
        <div style="margin-top: 10px; padding: 8px; background: #f9f9f9; border-radius: 4px;">
            <strong>Resumo:</strong>
            <div style="overflow-x:auto;">
            <table style="width:100%; border-collapse: collapse; margin-top: 6px; table-layout: fixed;">
                <tbody>${resumoStepRows.join('')}</tbody>
            </table>
            </div>
        </div>
    `;
    
    // Usar o modal existente do sistema em vez de criar um novo
    document.getElementById('pagamentoModalTitle').textContent = 'Histórico de Pagamentos';
    
    // Criar conteúdo para o modal existente
    const modalContent = `
        <div style="padding: 10px;">
            ${historico}
            <div style="text-align: center; margin-top: 20px;">
                <button type="button" onclick="imprimirHistoricoConta(${contaIdArg}, ${tipoArg})" class="btn btn-success" style="margin-right:10px;">Imprimir</button>
                <button type="button" data-payment-modal-close onclick="fecharModal('pagamentoModal')" class="btn btn-primary">Fechar</button>
            </div>
        </div>
    `;
    
    // Substituir o conteúdo do formulário temporariamente
    const form = document.getElementById('pagamentoForm');
    const originalStored = form.getAttribute('data-original-content');
    const formOriginal = originalStored ? originalStored : form.innerHTML;
    form.innerHTML = modalContent;
    
    // Guardar conteúdo original (apenas uma vez) para restaurar depois
    if (!originalStored) {
        form.setAttribute('data-original-content', formOriginal);
    }
    
    // Abrir modal
    openFinanceModalDialog('pagamentoModal', '#pagamentoForm button');
}

async function imprimirHistoricoConta(contaId, tipo) {
    let win = null;
    try {
        const lista = tipo === 'receber' ? contasReceber : contasPagar;
        const conta = lista.find(c => c.id === contaId) || lista.find(c => String(c.id) === String(contaId));
        if (!conta) { 
            try {
                const msg = 'Conta não encontrada';
                if (typeof window.__toast === 'function') window.__toast(msg, 'error', { duration: 5000 });
                else if (window.Utils && window.Utils.showToast) window.Utils.showToast(msg, 'error');
            } catch (_) {}
            return; 
        }
        win = window.open('', '_blank');
        if (!win) {
            mostrarNotificacao('O bloqueador de pop-ups impediu a abertura do histórico.', 'warning');
            return;
        }
        win.document.open();
        win.document.write('<!doctype html><html lang="pt-BR"><head><meta charset="utf-8"><title>Preparando histórico</title></head><body><p role="status">Preparando histórico financeiro...</p></body></html>');
        win.document.close();
        const company = await prepareFinanceReportCompany();
        const helper = getFinanceReportDocumentHelper();
        const nome = tipo === 'receber' ? (conta.cliente ? (typeof conta.cliente === 'object' ? (conta.cliente.nome || conta.cliente.name || 'Nome não informado') : conta.cliente) : (clientes.find(c=>c.id===conta.clienteId)?.nome || 'Cliente não encontrado')) : (conta.fornecedor || conta.funcionarioNome || 'Fornecedor não encontrado');
        const statusNorm = (conta.status || 'pendente').toUpperCase();
        const valorOriginalNum = parseCurrencyValue(conta.valorOriginal ?? conta.valor);
        const timeline = buildContaJurosTimeline(conta);
        const valorPagoNum = timeline.rows.reduce((sum, r) => sum + (r.pagamentoCents / 100), 0);
        const restanteNum = Math.max(0, timeline.saldoFinalCents / 100);
        const openPeriod = getOpenJurosPeriod(conta, timeline);
        const jurosAbertoNum = computeJurosByPeriod(restanteNum, conta.jurosTaxa, openPeriod.dias, conta.jurosTipo);
        const restanteAtualizadoNum = restanteNum + jurosAbertoNum;
        const periodoInicioAberto = formatDate(openPeriod.tsStart);
        const periodoFimAberto = formatDate(openPeriod.tsEnd);
        const hasJurosConfigured = normalizeJurosTipoKey(conta && conta.jurosTipo) !== 'none' && parseJurosTaxa(conta && conta.jurosTaxa) > 0;
        const headerTitle = tipo === 'receber' ? 'Histórico de Pagamentos - Contas a Receber' : 'Histórico de Pagamentos - Contas a Pagar';
        const meta = `
            <div class="filters">
                <div><strong>${tipo==='receber'?'Cliente':'Fornecedor'}:</strong> ${escapeFinanceHtml(nome)}</div>
                ${conta.pedidoNumero ? `<div><strong>Nº Pedido:</strong> ${escapeFinanceHtml(conta.pedidoNumero)}</div>` : ''}
                ${conta.numero ? `<div><strong>Número:</strong> ${escapeFinanceHtml(conta.numero)}</div>` : ''}
                ${conta.descricao ? `<div><strong>Descrição:</strong> ${escapeFinanceHtml(conta.descricao)}</div>` : ''}
                ${conta.categoria ? `<div><strong>Categoria:</strong> ${escapeFinanceHtml(conta.categoria)}</div>` : ''}
                ${conta.tipo ? `<div><strong>Tipo:</strong> ${escapeFinanceHtml(conta.tipo)}</div>` : ''}
                ${conta.vencimento || conta.dataVencimento ? `<div><strong>Vencimento:</strong> ${formatDate(conta.dataVencimento || conta.vencimento)}</div>` : ''}
                <div><strong>Status:</strong> ${escapeFinanceHtml(statusNorm)}</div>
            </div>
        `;
        const resumoRows = [];
        resumoRows.push(`<tr><td>Valor Original</td><td class="right">${formatCurrency(valorOriginalNum)}</td></tr>`);
        if (timeline.rows.length > 0) {
            timeline.rows.forEach((r) => {
                if (hasJurosConfigured) {
                    resumoRows.push(`<tr><td>Juros Acumulado</td><td class="right">${formatCurrency(r.jurosCents / 100)}</td></tr>`);
                    resumoRows.push(`<tr><td>Valor Total</td><td class="right">${formatCurrency(r.saldoAntesCents / 100)}</td></tr>`);
                }
                resumoRows.push(`<tr><td>Total Pago</td><td class="right">${formatCurrency(r.pagamentoCents / 100)}</td></tr>`);
                resumoRows.push(`<tr><td>Valor Restante</td><td class="right">${formatCurrency(r.saldoDepoisCents / 100)}</td></tr>`);
            });
        } else {
            if (hasJurosConfigured) {
                resumoRows.push(`<tr><td>Juros Acumulado</td><td class="right">${formatCurrency(0)}</td></tr>`);
                resumoRows.push(`<tr><td>Valor Total</td><td class="right">${formatCurrency(valorOriginalNum)}</td></tr>`);
            }
            resumoRows.push(`<tr><td>Total Pago</td><td class="right">${formatCurrency(valorPagoNum)}</td></tr>`);
            resumoRows.push(`<tr><td>Valor Restante</td><td class="right">${formatCurrency(restanteNum)}</td></tr>`);
        }
        if (hasJurosConfigured && jurosAbertoNum > 0.009) {
            resumoRows.push(`<tr><td>Juros Acumulado</td><td class="right">${formatCurrency(jurosAbertoNum)} (contado do período em aberto)</td></tr>`);
            resumoRows.push(`<tr><td>Período do Juros em Aberto</td><td class="right">${periodoInicioAberto} até ${periodoFimAberto}</td></tr>`);
            resumoRows.push(`<tr><td>Valor Restante</td><td class="right">${formatCurrency(restanteAtualizadoNum)}</td></tr>`);
        }
        const resumo = `
            <div style="overflow-x:auto;">
            <table style="width:100%; table-layout:auto;">
                <thead><tr><th>Campo</th><th>Valor</th></tr></thead>
                <tbody>${resumoRows.join('')}</tbody>
            </table>
            </div>
        `;
        let pagamentosRows = '';
        if (timeline.rows.length > 0) {
            pagamentosRows = timeline.rows.map(r => `
                <tr>
                    <td class="center nowrap">${formatDate(r.data)}</td>
                    <td class="right nowrap">${formatCurrency(r.jurosCents / 100)}</td>
                    <td class="right nowrap">${formatCurrency(r.pagamentoCents / 100)}</td>
                    <td class="right nowrap">${formatCurrency(r.saldoDepoisCents / 100)}</td>
                    <td class="clip">${escapeFinanceHtml(r.metodo || '-')}</td>
                    <td class="clip">${escapeFinanceHtml(r.observacoes || '-')}</td>
                </tr>
            `).join('');
        } else if (statusNorm === 'PAGO' && conta.dataPagamento) {
            pagamentosRows = `
                <tr>
                    <td class="center nowrap">${formatDate(conta.dataPagamento)}</td>
                    <td class="right nowrap">${formatCurrency(0)}</td>
                    <td class="right nowrap">${formatCurrency(valorOriginalNum)}</td>
                    <td class="right nowrap">${formatCurrency(0)}</td>
                    <td class="clip">${escapeFinanceHtml(conta.metodoPagamento || 'Não informado')}</td>
                    <td class="clip">${escapeFinanceHtml(conta.observacoesPagamento || 'Pagamento completo')}</td>
                </tr>
            `;
        }
        const pagamentos = `
            <table style="margin-top:10px; width:100%; table-layout:fixed;">
                <colgroup><col style="width:12%;"><col style="width:14%;"><col style="width:14%;"><col style="width:14%;"><col style="width:12%;"><col style="width:34%;"></colgroup>
                <thead><tr><th>Data</th><th>Juros Período</th><th>Pagamento</th><th>Saldo Após</th><th>Método</th><th>Observações</th></tr></thead>
                <tbody>${pagamentosRows || `<tr><td colspan="6" class="center">Sem pagamentos registrados</td></tr>`}</tbody>
            </table>
        `;
        const prepared = await helper.preparePrintOptions({
            ...buildFinanceReportHeaderOptions(company, headerTitle, {
                subtitle: formatDate(formatISODateLocal(new Date())),
                metaRows: [`${tipo === 'receber' ? 'Cliente' : 'Fornecedor'}: ${nome}`]
            }),
            bodyHtml: `<section class="sisweb-print-section">${meta}${resumo}${pagamentos}</section>`,
            targetWindow: win,
            printDelay: 250,
            extraCss: `
                .filters { display:flex; flex-wrap:wrap; gap:8px 16px; margin-bottom:10px; }
                table { table-layout:auto; }
                .right { text-align:right; }
                .center { text-align:center; }
                .nowrap { white-space:nowrap; }
                .clip { overflow-wrap:anywhere; }
            `
        });
        window.SiswebCommercePdf.printHtmlDocument(prepared);
    } catch (e) {
        console.warn('Falha ao imprimir histórico:', e);
        if (win && !win.closed) win.close();
        mostrarNotificacao('Não foi possível preparar o histórico para impressão.', 'error');
    }
}

// Função para editar conta
// ✅ Helper para verificar se um valor é um TIPO financeiro conhecido
function isTipoFinanceiro(val) {
    const tipos = [
        'a_vista', 'à vista', 'a vista',
        'receber',
        'pagar',
        'entrada',
        'parcela',
        'cheque_pre', 'cheque-pré', 'cheque pre',
        'boleto',
        'pix',
        'cartao', 'cartão',
        'dinheiro',
        'transferencia', 'transferência',
        'cheque',
        'permuta'
    ];
    return tipos.includes(String(val || '').toLowerCase().trim());
}

function getBaseCategoriaKeys() {
    return [
        'vendas',
        'compras',
        'servicos',
        'carrego',
        'mes_fechado',
        'quinzena_1',
        'quinzena_2',
        'ferias',
        'rescisao',
        'multas',
        'taxas',
        'outros'
    ];
}

function getBaseTipoKeys() {
    return [
        'a_vista',
        'receber',
        'pagar',
        'entrada',
        'parcela',
        'cheque_pre',
        'boleto',
        'pix',
        'cartao',
        'permuta'
    ];
}

function ensureCategoriaOptions(select, tipo, contaCategoria) {
    if (!select) return;
    const defaults = getBaseCategoriaKeys();
    const existing = new Set(Array.from(select.options).map(o => String(o.value)));
    defaults.forEach(k => {
        if (!existing.has(k)) {
            const opt = document.createElement('option');
            opt.value = k;
            opt.textContent = getCategoriaLabel(k);
            select.appendChild(opt);
            existing.add(k);
        }
    });
    const list = tipo === 'receber' ? (contasReceber || []) : (contasPagar || []);
    const keys = list.map(c => normalizeCategoriaKey(c && c.categoria)).filter(Boolean);
    if (contaCategoria) keys.push(normalizeCategoriaKey(contaCategoria));
    Array.from(new Set(keys)).forEach(k => {
        if (!existing.has(k)) {
            const opt = document.createElement('option');
            opt.value = k;
            opt.textContent = getCategoriaLabel(k);
            select.appendChild(opt);
            existing.add(k);
        }
    });
}

function scrollToForm(formId) {
    try {
        const form = document.getElementById(formId);
        if (!form) return;
        requestAnimationFrame(() => {
            try { form.scrollIntoView({ behavior: 'smooth', block: 'start' }); } catch(_) {}
        });
    } catch(_) {}
}

async function editarConta(id, tipo) {
    // ✅ Prevenir duplo clique
    if (window.__financeEditing) return;
    window.__financeEditing = true;
    try {
        let conta;
        
        if (tipo === 'receber') {
            // ✅ CORREÇÃO: Busca mais robusta para encontrar a conta
            conta = contasReceber.find(c => c.id === id) || 
                    contasReceber.find(c => c.id == id) || 
                    contasReceber.find(c => String(c.id) === String(id));
        } else {
            conta = contasPagar.find(c => c.id === id) || 
                    contasPagar.find(c => c.id == id) || 
                    contasPagar.find(c => String(c.id) === String(id));
        }

        if (!conta) {
            mostrarNotificacao('Conta não encontrada.', 'error');
            return;
        }

        try {
            const statusLower = String(conta.status || '').toLowerCase();
            const temHistorico = Array.isArray(conta.historicosPagamento) && conta.historicosPagamento.length > 0;
            const temPago = parseCurrencyValue(conta.valorPago || 0) > 0 || !!conta.dataPagamento;
            const temRecebiveis = temHistorico || temPago || statusLower === 'parcial' || statusLower === 'pago';
            if (temRecebiveis) {
                const msg = tipo === 'receber'
                    ? 'Atenção: esta conta possui recebimentos registrados. A edição será limitada.'
                    : 'Atenção: esta conta possui pagamentos registrados. A edição será limitada.';
                mostrarNotificacao(msg, 'warning');
            }
        } catch(_) {}

        // ✅ CORREÇÃO: Mudar para a aba correta com validação
        if (tipo === 'receber') {
            // Marcar estado de edição ANTES de abrir a aba para evitar resets
            window.contaEmEdicao = { id, tipo, contaOriginal: cloneContaSnapshotForEdit(conta) };
            const tabReceber = document.querySelector('[data-tab="receber"]');
            if (tabReceber) {
                tabReceber.click();
            }
            
            // ✅ CORREÇÃO: Usar IDs corretos do HTML e carregar dados corretamente
            const clienteField = document.getElementById('receberCliente');
            const descricaoField = document.getElementById('receberDescricao');
            const valorField = document.getElementById('receberValorTotal');
            const parcelasField = document.getElementById('receberParcelas');
            const dataField = document.getElementById('receberDataVencimento');
            const categoriaField = document.getElementById('receberCategoria');
            const tipoFieldRec = document.getElementById('receberTipo');
            const jurosTipoField = document.getElementById('receberJurosTipo');
            const jurosTaxaField = document.getElementById('receberJurosTaxa');
            const observacoesField = document.getElementById('receberObservacoes');
            const gerarBtnReceber = document.getElementById('receberGerarParcelasBtn');
            
            ensureCategoriaOptions(categoriaField, 'receber', conta.categoria);

            // ✅ CORREÇÃO: Executar preenchimento em blocos para evitar travamento
            // 1. Preenchimento de dados síncronos (não dependem de clientes)
            if (descricaoField) descricaoField.value = conta.descricao || '';
            if (valorField) {
                valorField.value = formatCurrencyNoSymbol(conta.valor || conta.valorOriginal || 0);
            }
            if (parcelasField) { parcelasField.value = conta.totalParcelas || 1; parcelasField.disabled = true; }
            if (dataField) {
                const rawVenc = conta.dataVencimento ?? conta.vencimento ?? '';
                const iso = normalizeDateISOInput(rawVenc);
                dataField.value = iso;
            }
            const emissaoFieldRec = document.getElementById('receberDataEmissao');
            if (emissaoFieldRec) emissaoFieldRec.value = normalizeDateISOInput(conta.dataEmissao || '');
            if (observacoesField) observacoesField.value = conta.observacoes || '';
            if (jurosTipoField) jurosTipoField.value = normalizeJurosTipoKey(conta.jurosTipo);
            if (jurosTaxaField) jurosTaxaField.value = parseJurosTaxa(conta.jurosTaxa || 0);
            updateJurosRateFieldState('receber');
            const multaTaxaField = document.getElementById('receberMultaTaxa');
            const multaCont = document.getElementById('receberMultaContainer');
            if (multaTaxaField) multaTaxaField.value = parseJurosTaxa(conta.multaTaxa ?? 2);
            if (multaCont) {
                multaCont.style.display = String(conta.tipo || '').toLowerCase().trim() === 'boleto' ? 'block' : 'none';
            }
            
            try {
                const numeroInput = document.getElementById('receberNumero');
                if (numeroInput) { numeroInput.value = conta.numero || conta.pedidoNumero || ''; numeroInput.readOnly = true; }
            } catch(_) {}

            const cont = document.getElementById('receberParcelasContainer');
            if (cont) cont.style.display = 'none';
            if (gerarBtnReceber) gerarBtnReceber.style.display = 'none';

            // ✅ CORREÇÃO PADRONIZADA: Separar Categoria de Tipo
            if (categoriaField && tipoFieldRec) {
                let catAtual = String(conta.categoria || '').toLowerCase().trim();
                let tipoAtual = String(conta.tipo || '').toLowerCase().trim();
                
                const normalizeTipo = (t) => {
                    const map = {
                        'à vista': 'a_vista', 'a vista': 'a_vista',
                        'a prazo': 'a_prazo',
                        'cheque-pré': 'cheque_pre', 'cheque pre': 'cheque_pre',
                        'cartão': 'cartao'
                    };
                    return map[t] || t;
                };
                
                catAtual = normalizeCategoriaKey(normalizeTipo(catAtual));
                tipoAtual = normalizeTipo(tipoAtual);

                if (isTipoFinanceiro(catAtual)) {
                    if (!tipoAtual || tipoAtual === 'a_vista' || tipoAtual === 'undefined') {
                        tipoFieldRec.value = normalizeTipoKey(catAtual);
                    }
                    categoriaField.value = 'vendas';
                    if (categoriaField.selectedIndex === -1) categoriaField.value = 'outros';
                } else {
                    const options = Array.from(categoriaField.options).map(o => o.value);
                    if (options.includes(catAtual)) {
                        categoriaField.value = catAtual;
                    } else {
                        if (catAtual === 'serviços') categoriaField.value = 'servicos';
                        else categoriaField.value = 'outros';
                    }
                }

                if (tipoAtual && isTipoFinanceiro(tipoAtual)) {
                    tipoFieldRec.value = normalizeTipoKey(tipoAtual);
                }
                
                
            }

            // ✅ CORREÇÃO ASSÍNCRONA: Carregar clientes sem bloquear o resto
            setTimeout(async () => {
                try {
                    // 1. Garantir que clientes estão carregados
                    if (!clientes || clientes.length === 0) {
                        if (typeof getDataAsync === 'function') {
                            clientes = await getDataAsync('clients') || [];
                        } else if (window.clientService && window.clientService.getClients) {
                            clientes = await window.clientService.getClients();
                        }
                        if (typeof atualizarSelectClientes === 'function') {
                            atualizarSelectClientes();
                        }
                    }

                    // 2. Preencher campo cliente
                    if (clienteField) {
                        let nomeCliente = '';
                        let clienteId = '';
                        
                        if (typeof conta.cliente === 'object' && conta.cliente !== null) {
                            nomeCliente = conta.cliente.nome || conta.cliente.name || conta.cliente.nomeCompleto || '';
                            clienteId = conta.cliente.id || conta.clienteId || '';
                        } else {
                            nomeCliente = conta.cliente || '';
                            clienteId = conta.clienteId || '';
                        }
                        
                        if (isAllCaps(nomeCliente)) nomeCliente = toTitleCasePt(nomeCliente);

                        let clienteEncontrado = null;
                        if (clienteId) {
                            clienteEncontrado = clientes.find(c => String(c.id) === String(clienteId));
                            if (clienteEncontrado) {
                                clienteField.value = clienteEncontrado.id;
                            } else {
                                const tempOption = document.createElement('option');
                                tempOption.value = clienteId;
                                tempOption.textContent = nomeCliente || 'Cliente não identificado';
                                tempOption.selected = true;
                                clienteField.appendChild(tempOption);
                                clienteField.value = clienteId;
                            }
                        } else if (nomeCliente) {
                            clienteEncontrado = clientes.find(c => (c.nome || c.name || c.nomeCompleto) === nomeCliente);
                            if (clienteEncontrado) {
                                clienteField.value = clienteEncontrado.id;
                            } else {
                                const tempOption = document.createElement('option');
                                tempOption.value = 'temp_' + Date.now();
                                tempOption.textContent = nomeCliente;
                                tempOption.selected = true;
                                clienteField.appendChild(tempOption);
                                clienteField.value = tempOption.value;
                            }
                        }
                    }
                    
                    // 3. Bloquear campos APENAS se houver recebimentos/pagamentos parciais registrados
                    try {
                        const statusLower = String(conta.status || '').toLowerCase();
                        const temHistorico = Array.isArray(conta.historicosPagamento) && conta.historicosPagamento.length > 0;
                        const valorPagoNum = parseCurrencyValue(conta.valorPago || 0);
                        const temPagoEfetivo = valorPagoNum > 0;
                        const lockFinanceiro = temHistorico || temPagoEfetivo || statusLower === 'parcial' || statusLower === 'pago';
                        
                        if (valorField) valorField.disabled = lockFinanceiro;
                        if (dataField) dataField.disabled = lockFinanceiro;
                        if (parcelasField) parcelasField.disabled = true; // Conta individual preserva estrutura
                        if (clienteField) clienteField.disabled = lockFinanceiro;
                        if (tipoFieldRec) tipoFieldRec.disabled = lockFinanceiro;
                        if (categoriaField) categoriaField.disabled = lockFinanceiro;
                        if (jurosTipoField) jurosTipoField.disabled = lockFinanceiro;
                        if (jurosTaxaField) jurosTaxaField.disabled = lockFinanceiro;
                    } catch(_) {}
                    
                } catch (errCli) {
                    console.warn('Erro ao carregar clientes na edição:', errCli);
                }
            }, 50); // Pequeno delay para garantir renderização da aba
            updateManualAttachmentButtonState('receber');
            scrollToForm('receberForm');
        } else {
            const tabPagar = document.querySelector('[data-tab="pagar"]');
            if (tabPagar) {
                tabPagar.click();
            }
            
            // ✅ CORREÇÃO: Usar IDs corretos do HTML e carregar dados corretamente
            const fornecedorField = document.getElementById('pagarFornecedor');
            const descricaoField = document.getElementById('pagarDescricao');
            const valorField = document.getElementById('pagarValorTotal');
            const parcelasField = document.getElementById('pagarParcelas');
            const dataField = document.getElementById('pagarDataVencimento');
            const categoriaField = document.getElementById('pagarCategoria');
            const tipoField = document.getElementById('pagarTipo');
            const jurosTipoField = document.getElementById('pagarJurosTipo');
            const jurosTaxaField = document.getElementById('pagarJurosTaxa');
            const observacoesField = document.getElementById('pagarObservacoes');
            const gerarBtn = document.getElementById('pagarGerarParcelasBtn');

            ensureCategoriaOptions(categoriaField, 'pagar', conta.categoria);
            
            // ✅ VALIDAÇÃO: Verificar se os campos existem antes de usar
            if (fornecedorField) {
                // ✅ CORREÇÃO: Primeiro garantir que os fornecedores estão carregados
                try {
                    // Recarregar fornecedores se necessário
                    if (!fornecedores || fornecedores.length === 0) {
                        fornecedores = await getDataAsync('fornecedores') || [];
                        atualizarSelectFornecedores();
                    }
                    
                    // Se tem fornecedorId, buscar dados completos do fornecedor
                    if (conta.fornecedorId) {
                        const fornecedor = fornecedores.find(f => f.id === conta.fornecedorId);
                        if (fornecedor) {
                            // ✅ CORREÇÃO: Definir valor do select corretamente
                            fornecedorField.value = conta.fornecedorId;
                        } else {
                            // ✅ FALLBACK: Criar opção temporária se fornecedor não existir no select
                            const tempOption = document.createElement('option');
                            tempOption.value = conta.fornecedorId || 'temp';
                            let nomeTemp = conta.fornecedor || conta.funcionarioNome || 'Funcionário';
                            if (isAllCaps(nomeTemp)) nomeTemp = toTitleCasePt(nomeTemp);
                            tempOption.textContent = nomeTemp;
                            tempOption.selected = true;
                            fornecedorField.appendChild(tempOption);
                        }
                    } else {
                        // ✅ FALLBACK: Para contas antigas sem fornecedorId
                        const tempOption = document.createElement('option');
                        tempOption.value = 'temp';
                        let nomeTemp2 = conta.fornecedor || conta.funcionarioNome || 'Funcionário';
                        if (isAllCaps(nomeTemp2)) nomeTemp2 = toTitleCasePt(nomeTemp2);
                        tempOption.textContent = nomeTemp2;
                        tempOption.selected = true;
                        fornecedorField.appendChild(tempOption);
                    }
                } catch (error) {
                    console.warn('⚠️ Erro ao processar fornecedor, criando opção temporária:', error);
                    // ✅ FALLBACK FINAL: Criar opção temporária
                    const tempOption = document.createElement('option');
                    tempOption.value = 'temp';
                    let nomeTemp3 = conta.fornecedor || conta.funcionarioNome || 'Funcionário';
                    if (isAllCaps(nomeTemp3)) nomeTemp3 = toTitleCasePt(nomeTemp3);
                    tempOption.textContent = nomeTemp3;
                    tempOption.selected = true;
                    fornecedorField.appendChild(tempOption);
                }
            }
            if (descricaoField) descricaoField.value = conta.descricao || '';
            if (valorField) {
                valorField.value = formatCurrencyNoSymbol(conta.valor || conta.valorOriginal || 0);
            }
            if (parcelasField) { parcelasField.value = conta.totalParcelas || 1; parcelasField.disabled = true; }
            const cont = document.getElementById('pagarParcelasContainer');
            if (cont) cont.style.display = 'none';
            if (gerarBtn) gerarBtn.style.display = 'none';
            if (dataField) {
                const rawVenc = conta.dataVencimento ?? conta.vencimento ?? '';
                const iso = normalizeDateISOInput(rawVenc);
                dataField.value = iso;
            }
            const emissaoFieldPag = document.getElementById('pagarDataEmissao');
            if (emissaoFieldPag) emissaoFieldPag.value = normalizeDateISOInput(conta.dataEmissao || '');
            // ✅ CORREÇÃO PADRONIZADA: Separar Categoria de Tipo (Pagar)
            if (categoriaField && tipoField) {
                // Lógica específica para folha de pagamento (mantida)
                if (conta.origem === 'folha_pagamento') {
                    let catAtual = normalizeCategoriaKey(conta.categoria || '');
                    if (catAtual) {
                        categoriaField.value = catAtual;
                    } else if (categoriaField.selectedIndex === -1) {
                        categoriaField.value = 'outros';
                    }
                    if (!tipoField.value || tipoField.value === 'undefined') {
                        tipoField.value = 'a_vista';
                    }
                } else {
                    let catAtual = String(conta.categoria || '').toLowerCase().trim();
                    let tipoAtual = String(resolveFinanceTipoOperacional(conta) || '').toLowerCase().trim();
                    
                    // Normalizar chaves
                    const normalizeTipo = (t) => {
                         const map = {
                             'à vista': 'a_vista', 'a vista': 'a_vista',
                             'a prazo': 'a_prazo',
                             'cheque-pré': 'cheque_pre', 'cheque pre': 'cheque_pre',
                             'cartão': 'cartao'
                         };
                         return map[t] || t;
                    };
                    catAtual = normalizeCategoriaKey(normalizeTipo(catAtual));
                    tipoAtual = normalizeTipo(tipoAtual);

                    // 1. Verificar se a Categoria é um Tipo
                    if (isTipoFinanceiro(catAtual)) {
                        // Migração silenciosa de Categoria -> Tipo
                        if (!tipoAtual || tipoAtual === 'a_vista' || tipoAtual === 'undefined') {
                            tipoField.value = normalizeTipoKey(catAtual);
                        }
                        // Default para pagar
                        categoriaField.value = 'compras'; 
                        if (categoriaField.selectedIndex === -1) categoriaField.value = 'outros';
                    } else {
                        // Categoria válida ou desconhecida
                        const options = Array.from(categoriaField.options).map(o => o.value);
                        if (options.includes(catAtual)) {
                            categoriaField.value = catAtual;
                        } else {
                            if (catAtual === 'serviços') categoriaField.value = 'servicos';
                            else categoriaField.value = 'outros';
                        }
                    }

                    // 2. Garantir Tipo
                    if (tipoAtual && isTipoFinanceiro(tipoAtual)) {
                        tipoField.value = normalizeTipoKey(tipoAtual);
                    }
                }
                // Log discreto apenas se debug ativo
                
            }
            if (observacoesField) observacoesField.value = conta.observacoes || '';
            if (jurosTipoField) jurosTipoField.value = normalizeJurosTipoKey(conta.jurosTipo);
            if (jurosTaxaField) jurosTaxaField.value = parseJurosTaxa(conta.jurosTaxa || 0);
            updateJurosRateFieldState('pagar');
                try {
                    const statusLower = String(conta.status || '').toLowerCase();
                    const temHistorico = Array.isArray(conta.historicosPagamento) && conta.historicosPagamento.length > 0;
                    const valorPagoNum = parseCurrencyValue(conta.valorPago || 0);
                    const temPagoEfetivo = valorPagoNum > 0;
                    const lockFinanceiro = temHistorico || temPagoEfetivo || statusLower === 'parcial' || statusLower === 'pago';
                    
                    if (valorField) valorField.disabled = lockFinanceiro;
                    if (dataField) dataField.disabled = lockFinanceiro;
                    if (parcelasField) parcelasField.disabled = true; // Conta individual preserva estrutura
                    if (fornecedorField) fornecedorField.disabled = lockFinanceiro;
                    if (tipoField) tipoField.disabled = lockFinanceiro;
                    if (categoriaField) categoriaField.disabled = lockFinanceiro;
                    if (jurosTipoField) jurosTipoField.disabled = lockFinanceiro;
                    if (jurosTaxaField) jurosTaxaField.disabled = lockFinanceiro;
                } catch(_) {}
            updateManualAttachmentButtonState('pagar');
            scrollToForm('pagarForm');
        }

        // ✅ CORREÇÃO: NÃO remover a conta aqui - apenas carregar para edição
        // A remoção deve acontecer apenas quando a edição for salva, não ao carregar
        // Isso evita que a conta desapareça se o usuário cancelar a edição
        
        // ✅ NOVO: Marcar que estamos editando uma conta existente (caso não tenha sido marcado antes)
        if (!window.contaEmEdicao || window.contaEnEdicao?.id !== id) {
            window.contaEmEdicao = { id, tipo, contaOriginal: cloneContaSnapshotForEdit(conta) };
        }
        updateManualAttachmentButtonState(tipo);

        // ✅ Alterar texto do botão de submit para "Atualizar" quando editando
        try {
            const formId = tipo === 'receber' ? 'receberForm' : 'pagarForm';
            const btn = document.getElementById(formId)?.querySelector('button[type="submit"]');
            if (btn) btn.innerHTML = '<i class="fas fa-edit"></i> Atualizar';
        } catch(_) {}
    } catch (error) {
        console.error('❌ Erro ao editar conta:', error);
        try {
            const msg = 'Erro ao carregar dados para edição. Tente novamente.';
            if (typeof window.__toast === 'function') window.__toast(msg, 'error', { duration: 5000 });
            else if (window.Utils && window.Utils.showToast) window.Utils.showToast(msg, 'error');
        } catch (_) {}
    } finally {
        window.__financeEditing = false;
    }
}

// Função para confirmar pagamento
async function confirmarPagamento(event) {
    event.preventDefault();
    const form = document.getElementById('pagamentoForm');
    const paymentAccountId = String(contaAtualEdicao || '').trim();
    const paymentType = String(tipoContaAtual || '').trim().toLowerCase();
    const submitBtn = form ? form.querySelector('button[type="submit"]') : null;
    setSubmitButtonLoading(submitBtn, true, 'Registrando...');
    setPaymentModalBusy(true);

    try {
        const valorEl = document.getElementById('pagamentoValor');
        const dataEl = document.getElementById('pagamentoData');
        const metodoEl = document.getElementById('pagamentoMetodo');
        const obsEl = document.getElementById('pagamentoObservacoes');
        if (!valorEl || !dataEl || !metodoEl) {
            setSubmitButtonLoading(submitBtn, false);
            mostrarNotificacao('Formulário de pagamento não está ativo.', 'warning');
            return;
        }
        const valorPago = parseCurrencyValue(valorEl.value);
        const dataPagamento = dataEl.value;
        const metodoPagamento = metodoEl.value;
        const observacoesPagamentoRaw = obsEl ? obsEl.value : '';
        const observacoesPagamento = isAllCaps(observacoesPagamentoRaw) ? toTitleCasePt(observacoesPagamentoRaw) : observacoesPagamentoRaw;
        
        if (!valorPago || valorPago <= 0) {
            setSubmitButtonLoading(submitBtn, false);
            mostrarNotificacao('Por favor, insira um valor válido.', 'warning');
            return;
        }
        
        if (!dataPagamento) {
            setSubmitButtonLoading(submitBtn, false);
            mostrarNotificacao('Por favor, informe a data do pagamento.', 'warning');
            return;
        }

        // ✅ CORREÇÃO: Usar variáveis globais para identificar a conta
        if (!paymentAccountId || !['receber', 'pagar'].includes(paymentType)) {
            setSubmitButtonLoading(submitBtn, false);
            mostrarNotificacao('Erro: conta não identificada para pagamento.', 'error');
            return;
        }

        const conta = paymentType === 'receber'
            ? contasReceber.find(c => String(c && c.id) === paymentAccountId)
            : contasPagar.find(c => String(c && c.id) === paymentAccountId);

        if (!conta) {
            setSubmitButtonLoading(submitBtn, false);
            mostrarNotificacao('Conta não encontrada.', 'error');
            return;
        }
        mostrarNotificacao('Registrando pagamento...', 'info');

        const financeDbg = (...args) => { try { if (window.__DEBUG_MODE__) console.log(...args); } catch (_) {} };
        const monthKey = getMonthKeyFromDateVal(conta.dataVencimento || conta.vencimento);
        const expected = buildFinanceExpectedState(conta);
        const jurosNoMomento = computeContaJurosInfo(conta, dataPagamento);
        const jurosCents = financeMoneyToCents(jurosNoMomento.juros || 0);
        const pagamentoCents = financeMoneyToCents(valorPago);
        const exigivelCents = financeMoneyToCents(expected.valorRestante) + jurosCents;
        if (pagamentoCents > exigivelCents) {
            setSubmitButtonLoading(submitBtn, false);
            mostrarNotificacao(`O valor informado supera o saldo exigível de ${formatCurrency(exigivelCents / 100)}.`, 'warning');
            return;
        }

        const operationId = form.dataset.financeOperationId || createFinanceOperationId('payment');
        form.dataset.financeOperationId = operationId;
        let pendingUpload = form.__financePendingPaymentUpload || null;
        const fileInput = document.getElementById('pagamentoComprovante');
        const file = fileInput && fileInput.files ? fileInput.files[0] : null;
        if (file && !pendingUpload) {
            const subfolder = paymentType === 'receber' ? 'recebimentos' : 'pagamentos';
            pendingUpload = await uploadFinanceStorageMeta(file, `financas/${subfolder}/${conta.id}`, {
                tipo: paymentType,
                entityId: String(conta.id),
                finalidade: 'comprovante-pagamento'
            });
            form.__financePendingPaymentUpload = pendingUpload || null;
        }

        const comprovanteUrl = pendingUpload && pendingUpload.url ? pendingUpload.url : null;
        const comprovanteStoragePath = pendingUpload && pendingUpload.storagePath ? pendingUpload.storagePath : null;
        const historicos = (Array.isArray(conta.historicosPagamento) ? conta.historicosPagamento : [])
            .map((item) => ({ ...(item || {}) }));
        historicos.push({
            data: dataPagamento,
            valor: pagamentoCents / 100,
            metodo: metodoPagamento,
            observacoes: observacoesPagamento || `${paymentType === 'receber' ? 'Recebimento' : 'Pagamento'} de ${formatCurrency(pagamentoCents / 100)}`,
            comprovanteUrl,
            comprovanteStoragePath,
            jurosAplicado: jurosCents / 100,
            diasAtraso: Math.max(0, Number(jurosNoMomento.diasAtraso || 0)),
            operationId
        });
        const novoPagoCents = financeMoneyToCents(expected.valorPago) + pagamentoCents;
        const novoRestanteCents = Math.max(0, exigivelCents - pagamentoCents);
        const quitado = novoRestanteCents === 0;
        const patch = {
            historicosPagamento: historicos,
            valorPago: novoPagoCents / 100,
            valorRestante: novoRestanteCents / 100,
            status: quitado ? 'pago' : 'parcial',
            dataPagamento: quitado ? dataPagamento : null,
            metodoPagamento,
            observacoesPagamento: observacoesPagamento || null,
            jurosBaseDate: dataPagamento
        };
        if (comprovanteUrl || comprovanteStoragePath) {
            patch.comprovanteUrl = comprovanteUrl;
            patch.comprovanteStoragePath = comprovanteStoragePath;
        }

        financeDbg('[financas][baixa:start]', {
            tipo: paymentType,
            historyLength: expected.historyLength,
            revision: expected.revision,
            remainingCents: financeMoneyToCents(expected.valorRestante)
        });

        let authoritativeAccount;
        try {
            const result = await callFinanceCallable('financeRegisterPayment', {
                tipo: paymentType,
                mes: monthKey,
                contaId: String(conta.id),
                operationId,
                expected,
                patch
            });
            authoritativeAccount = replaceFinanceAccountInMemory(paymentType, conta.id, result.account);
        } catch (transactionError) {
            let reconciledAccount = null;
            try {
                reconciledAccount = await reconcileFinanceAccount(paymentType, monthKey, conta.id);
            } catch (_) {}
            if (financeOperationWasCommitted(reconciledAccount, operationId, 'register')) {
                authoritativeAccount = reconciledAccount;
            } else {
                if (reconciledAccount && pendingUpload) {
                    await deleteStorageFileSafely(comprovanteStoragePath, comprovanteUrl);
                    clearFinancePaymentAttemptState(form);
                }
                throw transactionError;
            }
        }

        clearFinancePaymentAttemptState(form);
        window.__financeLastBaixa = { tipo: paymentType, revision: Number(authoritativeAccount.revision || 0), at: new Date().toISOString() };
        if (paymentType === 'receber') await carregarTabelaReceber(lastFiltroReceber || {});
        else await carregarTabelaPagar(lastFiltroPagar || {});
        atualizarDashboard();
        try { await atualizarSnapshotMensal(); } catch(_) {}

        const baixaLabel = paymentType === 'receber' ? 'Recebimento' : 'Pagamento';
        setPaymentModalBusy(false);
        fecharModal('pagamentoModal');
        mostrarNotificacao(`${baixaLabel} de ${formatCurrency(pagamentoCents / 100)} confirmado com sucesso!`, 'success');
        
    } catch (error) {
        console.error('❌ Erro ao confirmar pagamento:', error);
        const rawMessage = String(error && error.message ? error.message : error || '');
        const isConflict = /aborted|conflito|stale-state/i.test(`${error && error.code || ''} ${rawMessage}`);
        mostrarNotificacao(
            isConflict
                ? 'A conta foi alterada em outra sessão. Os dados foram reconciliados; revise e tente novamente.'
                : 'Não foi possível confirmar a baixa no servidor. Os dados do formulário foram preservados.',
            'error'
        );
    } finally {
        setSubmitButtonLoading(submitBtn, false);
        setPaymentModalBusy(false);
    }
}

// Função para excluir um pagamento (parcial ou total)
async function excluirPagamento(contaId, tipo = 'receber', registroRef, triggerButton = null) {
    const deleteKey = `${String(tipo)}:${String(contaId)}:${String(registroRef)}`;
    window.__financeDeleteInFlight = window.__financeDeleteInFlight || new Set();
    if (window.__financeDeleteInFlight.has(deleteKey)) return;
    const confirmed = window.confirm('Excluir este pagamento? O saldo da conta será recalculado.');
    if (!confirmed) return;
    window.__financeDeleteInFlight.add(deleteKey);
    if (triggerButton) triggerButton.disabled = true;
    setPaymentModalBusy(true);
    try {
        // Localizar conta com busca robusta
        const conta = tipo === 'receber'
            ? (contasReceber.find(c => c.id === contaId) || contasReceber.find(c => c.id == contaId) || contasReceber.find(c => String(c.id) === String(contaId)))
            : (contasPagar.find(c => c.id === contaId) || contasPagar.find(c => c.id == contaId) || contasPagar.find(c => String(c.id) === String(contaId)));

        if (!conta) {
            mostrarNotificacao('Conta não encontrada.', 'error');
            return;
        }

        const financeDbg = (...args) => { try { if (window.__DEBUG_MODE__) console.log(...args); } catch (_) {} };
        const monthKey = getMonthKeyFromDateVal(conta.dataVencimento || conta.vencimento);
        const expected = buildFinanceExpectedState(conta);
        const valorOriginalCents = financeMoneyToCents(conta.valorOriginal ?? conta.valor ?? 0);
        const nextHistory = (Array.isArray(conta.historicosPagamento) ? conta.historicosPagamento : [])
            .map((item) => ({ ...(item || {}) }));

        // Exclusão sem diálogo de confirmação; feedback via toast

        const comprovantesParaRemover = [];
        const registrarComprovanteRemovido = (url, storagePath) => {
            const u = String(url || '').trim();
            const p = resolveAttachmentStoragePath({ url: u, storagePath });
            if (!u && !p) return;
            if (comprovantesParaRemover.some((item) => String(item.url || '') === u && String(item.storagePath || '') === p)) return;
            comprovantesParaRemover.push({ url: u || null, storagePath: p || null });
        };

        // Exclusão de pagamento completo (sem histórico)
        if (registroRef === 'total' || registroRef === 'full') {
            registrarComprovanteRemovido(conta.comprovanteUrl || null, conta.comprovanteStoragePath || null);
            (Array.isArray(conta.historicosPagamento) ? conta.historicosPagamento : []).forEach((pagamento) => {
                registrarComprovanteRemovido(pagamento && pagamento.comprovanteUrl, pagamento && pagamento.comprovanteStoragePath);
            });
            nextHistory.length = 0;
        } else {
            // Exclusão de pagamento parcial (registro no histórico)
            const idx = parseInt(registroRef, 10);
            if (isNaN(idx) || idx < 0 || idx >= nextHistory.length) {
                mostrarNotificacao('Registro de pagamento não encontrado.', 'warning');
                return;
            }
            const pagamentoRemovido = nextHistory[idx] || {};
            registrarComprovanteRemovido(pagamentoRemovido.comprovanteUrl || null, pagamentoRemovido.comprovanteStoragePath || null);
            nextHistory.splice(idx, 1);
        }

        const somaHistoricosCents = nextHistory.reduce((sum, payment) => sum + financeMoneyToCents(payment && payment.valor), 0);
        const jurosHistoricosCents = nextHistory.reduce((sum, payment) => sum + financeMoneyToCents(payment && payment.jurosAplicado), 0);
        const restanteCents = Math.max(0, valorOriginalCents + jurosHistoricosCents - somaHistoricosCents);
        const ultimoPagamento = nextHistory.length ? nextHistory[nextHistory.length - 1] : null;
        const ultimoComAnexo = nextHistory.slice().reverse().find((payment) => payment && (payment.comprovanteUrl || payment.comprovanteStoragePath));
        const status = restanteCents === 0 ? 'pago' : (somaHistoricosCents > 0 ? 'parcial' : 'pendente');
        const patch = {
            historicosPagamento: nextHistory,
            valorPago: somaHistoricosCents / 100,
            valorRestante: restanteCents / 100,
            status,
            dataPagamento: status === 'pago' && ultimoPagamento ? ultimoPagamento.data : null,
            metodoPagamento: ultimoPagamento && ultimoPagamento.metodo ? String(ultimoPagamento.metodo) : null,
            observacoesPagamento: ultimoPagamento && ultimoPagamento.observacoes ? String(ultimoPagamento.observacoes) : null,
            comprovanteUrl: ultimoComAnexo && ultimoComAnexo.comprovanteUrl ? String(ultimoComAnexo.comprovanteUrl) : null,
            comprovanteStoragePath: ultimoComAnexo && ultimoComAnexo.comprovanteStoragePath ? String(ultimoComAnexo.comprovanteStoragePath) : null,
            jurosBaseDate: ultimoPagamento && ultimoPagamento.data ? ultimoPagamento.data : null
        };
        const pendingKey = `${tipo}:${monthKey}:${String(conta.id)}:${String(registroRef)}`;
        window.__financeDeleteOperations = window.__financeDeleteOperations || {};
        const operationId = window.__financeDeleteOperations[pendingKey] || createFinanceOperationId('delete');
        window.__financeDeleteOperations[pendingKey] = operationId;

        financeDbg('[financas][excluirPagamento]', {
            tipo,
            historyLength: expected.historyLength,
            revision: expected.revision,
            nextHistoryLength: nextHistory.length
        });

        let authoritativeAccount;
        try {
            const result = await callFinanceCallable('financeDeletePayment', {
                tipo,
                mes: monthKey,
                contaId: String(conta.id),
                operationId,
                expected,
                patch
            });
            authoritativeAccount = replaceFinanceAccountInMemory(tipo, conta.id, result.account);
        } catch (transactionError) {
            let reconciledAccount = null;
            try {
                reconciledAccount = await reconcileFinanceAccount(tipo, monthKey, conta.id);
            } catch (_) {}
            if (financeOperationWasCommitted(reconciledAccount, operationId, 'delete')) {
                authoritativeAccount = reconciledAccount;
            } else {
                if (reconciledAccount) delete window.__financeDeleteOperations[pendingKey];
                throw transactionError;
            }
        }
        delete window.__financeDeleteOperations[pendingKey];

        for (const meta of comprovantesParaRemover) {
            await deleteStorageFileSafely(meta.storagePath, meta.url);
        }

        if (tipo === 'receber') await carregarTabelaReceber(lastFiltroReceber || {});
        else await carregarTabelaPagar(lastFiltroPagar || {});
        atualizarDashboard();
        mostrarNotificacao('Pagamento excluído com sucesso!', 'success');

        // Atualizar visualização do histórico no modal
        verHistoricoPagamentos(authoritativeAccount.id || contaId, tipo);

    } catch (error) {
        console.error('❌ Erro ao excluir pagamento:', error);
        mostrarNotificacao('Erro ao excluir pagamento. Tente novamente.', 'error');
    } finally {
        window.__financeDeleteInFlight.delete(deleteKey);
        if (triggerButton) triggerButton.disabled = false;
        setPaymentModalBusy(false);
    }
}

// ✅ NOVA FUNÇÃO: Limpar dados inválidos das contas
function limparDadosInvalidos() {
    // Filtrar contas a receber válidas
    const contasReceberValidas = contasReceber.filter(conta => 
        conta && 
        conta.id && 
        conta.cliente !== undefined && 
        conta.descricao !== undefined &&
        conta.valor !== undefined &&
        !isNaN(conta.valor)
    );
    
    // Filtrar contas a pagar válidas
    const contasPagarValidas = contasPagar.filter(conta => 
        conta && 
        conta.id && 
        (conta.fornecedor !== undefined || conta.funcionarioNome !== undefined) &&
        conta.descricao !== undefined &&
        conta.valor !== undefined &&
        !isNaN(conta.valor)
    );
    
    // Atualizar arrays apenas se houve mudança
    if (contasReceberValidas.length !== contasReceber.length) {
        contasReceber.length = 0;
        contasReceber.push(...contasReceberValidas);
    }
    
    if (contasPagarValidas.length !== contasPagar.length) {
        contasPagar.length = 0;
        contasPagar.push(...contasPagarValidas);
    }
}

function updateOfflineBadge() {
    try {
        const badge = document.getElementById('connectionBadge');
        const online = evaluateOnlineStatus();
        const isOffline = !online;
        if (badge) {
            badge.textContent = online ? 'Modo Online' : 'Modo Offline';
            badge.style.display = 'inline-block';
            badge.style.background = online ? '#28a745' : '#ffc107';
            badge.style.color = online ? '#ffffff' : '#212529';
        }
        const msgEl = document.getElementById('financeLoadingMessage');
        if (msgEl && isOffline) msgEl.textContent = 'Carregando dados (Modo Offline)';
        setOnlineStatus(online);
    } catch(_) {}
}

function evaluateOnlineStatus() {
    try {
        const svc = window.firebaseService;
        const st = (svc && typeof svc.isFirebaseOperational === 'function') ? svc.isFirebaseOperational() : null;
        const browserOnline = (typeof navigator !== 'undefined' && 'onLine' in navigator) ? navigator.onLine : true;
        const authBlocked = !!window.firebaseAuthDisabled;
        const offlineFlag = !!window.financeOffline;
        const firebaseOk = !!(st && st.operational);
        return browserOnline && firebaseOk && !authBlocked && !offlineFlag;
    } catch(_) { return false; }
}

function setOnlineStatus(online) {
    try {
        const prevOnline = !window.financeOffline;
        window.financeOffline = !online;
        if (online !== prevOnline) {
            const ev = new CustomEvent('finance:status', { detail: { online, ts: Date.now() } });
            window.dispatchEvent(ev);
        }
    } catch(_) {}
}

// ✅ NOVA FUNÇÃO: Reativar botão do romaneio (TL ou PCT)
async function reativarBotaoRomaneio(romaneioId, tipo = 'tl') {
    try {
        const tipoLabel = tipo.toUpperCase();
        
        const service = window.firebaseService || window.firebaseServiceTL || window.FirebaseService;
        if (!service || typeof service.loadFromFirebase !== 'function') {
            console.warn(`⚠️ FirebaseService não disponível para reativar botão do romaneio ${tipoLabel}`);
            return;
        }
        
        const collection = tipo === 'pct' ? 'romaneios/pct' : 'romaneios/tl';
        const result = await service.loadFromFirebase(collection);
        const romaneiosFirebase = result && result.success !== false ? (result.data || result) : null;
        const lista = window.RomaneioDataUtils && typeof window.RomaneioDataUtils.normalizeRomaneioCollection === 'function'
            ? window.RomaneioDataUtils.normalizeRomaneioCollection(romaneiosFirebase, { type: tipo === 'pct' ? 'PCT' : 'TL' })
            : (Array.isArray(romaneiosFirebase)
                ? romaneiosFirebase
                : Object.entries(romaneiosFirebase || {}).map(([key, value]) => ({ id: value && value.id || key, firebaseKey: key, ...(value || {}) })));
        const romaneioAtual = lista.find((r) => String(r.id) === String(romaneioId) || String(r.firebaseKey || '') === String(romaneioId));
        if (romaneioAtual) {
            
            
            // Reativar o botão (remover flag de lançado)
            const registroId = String(romaneioAtual.firebaseKey || romaneioAtual.key || romaneioAtual.id || romaneioId);
            const registroAtualizado = {
                ...romaneioAtual,
                contasReceberLancado: false,
                contasReceberReativadoEm: new Date().toISOString()
            };
            
            // Notificar sistema de preservação PCT se disponível
            if (tipo === 'pct' && window.PreservacaoFinanceirasPCT) {
                window.PreservacaoFinanceirasPCT.atualizarPropriedadeFinanceira(
                    romaneioId, 
                    'contasReceberLancado', 
                    false
                );
                window.PreservacaoFinanceirasPCT.atualizarPropriedadeFinanceira(
                    romaneioId, 
                    'contasReceberReativadoEm', 
                    new Date().toISOString()
                );
            }
            
            
            
            // ✅ CORREÇÃO: Atualizar APENAS o registro alvo no caminho canônico.
            if (typeof service.saveToFirebase === 'function') {
                expectFinanceWrite(await service.saveToFirebase(collection, registroId, registroAtualizado), 'Reativação do romaneio');
            } else if (typeof service.saveData === 'function') {
                await service.saveData(`${collection}/${registroId}`, registroAtualizado);
            }
            
            // ✅ MELHORIA: Forçar atualização do modal correspondente
            const modalObj = tipo === 'pct' ? window.ModalListaRomaneiosPCT : window.ModalListaRomaneios;
            const modalLabel = tipo === 'pct' ? 'PCT' : 'TL';
            
            // ✅ NOVO: Para PCT, usar função local se disponível
            if (tipo === 'pct' && window.ModalListaRomaneiosPCT && typeof window.ModalListaRomaneiosPCT.reativarBotaoRomaneio === 'function') {
                try {
                    await window.ModalListaRomaneiosPCT.reativarBotaoRomaneio(romaneioId, 'pct');
                    return;
                } catch (error) {
                    console.error(`❌ Erro na reativação PCT local:`, error);
                    // Continua com o método padrão abaixo
                }
            }
            
            if (modalObj) {
                // Atualizar estado local primeiro
                if (modalObj.state && modalObj.state.romaneios) {
                    const romaneioIndex = modalObj.state.romaneios.findIndex(r => r.id === romaneioId);
                    if (romaneioIndex !== -1) {
                        modalObj.state.romaneios[romaneioIndex].contasReceberLancado = false;
                        modalObj.state.romaneios[romaneioIndex].contasReceberReativadoEm = new Date().toISOString();
                    }
                }
                
                // ✅ CORREÇÃO: Múltiplas tentativas de atualização para garantir sincronização
                const atualizarModal = async () => {
                    try {
                        // Tentativa 1: Recarregar dados do Firebase
                        if (typeof modalObj.loadRomaneios === 'function') {
                            await modalObj.loadRomaneios();
                        } else {
                            console.warn(`⚠️ Função loadRomaneios não encontrada no modal ${modalLabel}`);
                        }
                        
                        // Tentativa 2: Renderizar lista
                        if (typeof modalObj.renderRomaneiosList === 'function') {
                            modalObj.renderRomaneiosList();
                        } else {
                            console.warn(`⚠️ Função renderRomaneiosList não encontrada no modal ${modalLabel}`);
                        }
                        
                        // Tentativa 3: Forçar refresh se disponível (específico para PCT)
                        if (tipo === 'pct' && typeof modalObj.forcarRefreshFirebase === 'function') {
                            await modalObj.forcarRefreshFirebase();
                        }
                        
                        // Tentativa 4: Refresh genérico
                        if (typeof modalObj.refresh === 'function') {
                            await modalObj.refresh();
                        }
                        
                    } catch (error) {
                        console.error(`❌ Erro ao atualizar modal ${modalLabel}:`, error);
                        // Fallback final: apenas renderizar
                        if (typeof modalObj.renderRomaneiosList === 'function') {
                            modalObj.renderRomaneiosList();
                        }
                    }
                };
                
                // Executar atualização com delay
                setTimeout(atualizarModal, 300);
                // Segunda tentativa para garantir
                setTimeout(atualizarModal, 1000);
            }
            
            // ✅ NOVO: Notificação global para PCT refresh
            if (tipo === 'pct') {
                // Criar evento customizado para notificar quando PCT estiver disponível
                window.addEventListener('ModalListaRomaneiosPCTCarregado', function() {
                    if (window.ModalListaRomaneiosPCT && typeof window.ModalListaRomaneiosPCT.forcarRefreshFirebase === 'function') {
                        setTimeout(() => {
                            window.ModalListaRomaneiosPCT.forcarRefreshFirebase();
                        }, 500);
                    }
                }, { once: true }); // Executar apenas uma vez
                
                // Se já estiver disponível, executar imediatamente
                if (window.ModalListaRomaneiosPCT && typeof window.ModalListaRomaneiosPCT.forcarRefreshFirebase === 'function') {
                    setTimeout(() => {
                        window.ModalListaRomaneiosPCT.forcarRefreshFirebase();
                    }, 1000);
                }
                
                // ✅ NOVO: Usar função global como backup
                setTimeout(() => {
                    if (window.forcarRefreshModalPCT) {
                        window.forcarRefreshModalPCT();
                    }
                }, 2000);
                
                // ✅ CORREÇÃO CRÍTICA: Forçar refresh direto via postMessage
                try {
                    // Tentar usar localStorage como canal de comunicação
                    localStorage.setItem('pctRefreshTrigger', JSON.stringify({
                        action: 'forceRefresh',
                        romaneioId: romaneioId,
                        timestamp: Date.now()
                    }));
                    
                    // Limpar após 1 segundo
                    setTimeout(() => {
                        localStorage.removeItem('pctRefreshTrigger');
                    }, 1000);
                } catch (error) {
                    console.error(`❌ PCT: Erro ao enviar mensagem de refresh:`, error);
                }
            }
        } else {
            console.warn('⚠️ Romaneio não encontrado no Firebase para reativação');
        }
        
    } catch (error) {
        console.error('❌ Erro ao reativar botão do romaneio:', error);
    }
}

// Função para excluir conta
async function excluirConta(id, tipo) {
    const normalizedType = tipo === 'receber' ? 'receber' : 'pagar';
    const accountId = String(id);
    const lockKey = `${normalizedType}:${accountId}`;
    window.__financeAccountDeleteInFlight = window.__financeAccountDeleteInFlight || new Set();
    if (window.__financeAccountDeleteInFlight.has(lockKey)) return;
    try {
        const target = normalizedType === 'receber' ? contasReceber : contasPagar;
        const index = target.findIndex((conta) => String(conta && conta.id) === accountId);
        if (index < 0) {
            mostrarNotificacao('Conta não encontrada para exclusão.', 'warning');
            return;
        }
        if (!confirm('Tem certeza que deseja excluir esta conta?')) return;
        window.__financeAccountDeleteInFlight.add(lockKey);
        const contaExcluida = target[index];
        const month = getMonthKeyFromDateVal(contaExcluida.dataVencimento || contaExcluida.vencimento);
        const operationId = createFinanceOperationId('delete_account');
        const result = await callFinanceCallable('financeDeleteAccount', {
            tipo: normalizedType,
            mes: month,
            contaId: accountId,
            operationId,
            expected: buildFinanceExpectedState(contaExcluida)
        });
        if (result.deleted !== true) throw new Error('Servidor não confirmou a exclusão da conta.');

        target.splice(index, 1);
        const storageClean = await cleanupDeletedFinanceAccountStorage(contaExcluida, operationId);
        const tombstoneKey = normalizedType === 'receber'
            ? 'contasReceber_deletedIds'
            : 'contasPagar_deletedIds';
        try { addTombstone(tombstoneKey, accountId, month); } catch (_) {}
        try { await saveDataAsync(normalizedType === 'receber' ? 'contasReceber' : 'contasPagar', target); } catch (_) {}

        if (normalizedType === 'receber') {
            if (contaExcluida.origem === 'romaneio_tl' && contaExcluida.origemId) {
                await reativarBotaoRomaneio(contaExcluida.origemId);
            } else if (contaExcluida.origem === 'romaneio_pct' && contaExcluida.origemId) {
                await reativarBotaoRomaneio(contaExcluida.origemId, 'pct');
            }
            carregarTabelaReceber();
        } else {
            carregarTabelaPagar();
        }
        atualizarDashboard();
        try { await atualizarSnapshotMensal(); } catch (_) {}
        mostrarNotificacao(
            storageClean
                ? `Conta a ${normalizedType === 'receber' ? 'receber' : 'pagar'} excluída com sucesso!`
                : 'Conta excluída; alguns anexos ficaram pendentes de limpeza no Storage.',
            storageClean ? 'success' : 'warning'
        );
    } catch (error) {
        console.error('❌ Erro ao excluir conta:', error);
        try {
            const msg = error && error.message ? error.message : 'Erro ao excluir conta. Tente novamente.';
            if (typeof window.__toast === 'function') window.__toast(msg, 'error', { duration: 5000 });
            else if (window.Utils && window.Utils.showToast) window.Utils.showToast(msg, 'error');
        } catch (_) {}
    } finally {
        window.__financeAccountDeleteInFlight.delete(lockKey);
    }
}

// Funções de fluxo de caixa
function gerarFluxoCaixa() {
    const dataInicio = document.getElementById('fluxoDataInicio').value;
    const dataFim = document.getElementById('fluxoDataFim').value;
    
    if (!dataInicio || !dataFim) {
        try {
            const msg = 'Selecione o período para gerar o fluxo de caixa';
            if (typeof window.__toast === 'function') window.__toast(msg, 'warning');
            else if (window.Utils && window.Utils.showToast) window.Utils.showToast(msg, 'warning');
        } catch (_) {}
        return;
    }
    
    // Gerar gráfico detalhado
    gerarGraficoFluxoDetalhado(dataInicio, dataFim);
    
    // Gerar tabela
    gerarTabelaFluxo(dataInicio, dataFim);
}

function gerarGraficoFluxoDetalhado(dataInicio, dataFim) {
    const ctx = document.getElementById('fluxoDetalhadoChart').getContext('2d');
    
    if (fluxoDetalhadoChart) {
        fluxoDetalhadoChart.destroy();
    }
    
    const dados = calcularFluxoPeriodo(dataInicio, dataFim);
    
    fluxoDetalhadoChart = new Chart(ctx, {
        type: 'bar',
        data: {
            labels: dados.labels,
            datasets: [{
                label: 'Entradas',
                data: dados.entradas,
                backgroundColor: 'rgba(40, 167, 69, 0.8)',
                borderColor: '#28a745',
                borderWidth: 1
            }, {
                label: 'Saídas',
                data: dados.saidas,
                backgroundColor: 'rgba(220, 53, 69, 0.8)',
                borderColor: '#dc3545',
                borderWidth: 1
            }]
        },
        options: {
            responsive: true,
            scales: {
                y: {
                    beginAtZero: true
                }
            }
        }
    });
}

function gerarTabelaFluxo(dataInicio, dataFim) {
    const tbody = document.getElementById('fluxoTable');
    const dados = calcularFluxoPeriodo(dataInicio, dataFim);
    
    let saldoAcumulado = 0;
    
    tbody.innerHTML = dados.labels.map((label, index) => {
        const entradas = dados.entradas[index];
        const saidas = dados.saidas[index];
        const saldoDia = entradas - saidas;
        saldoAcumulado += saldoDia;
        
        return `
            <tr>
                <td>${label}</td>
                <td style="text-align: right; color: #28a745;">${formatCurrency(entradas)}</td>
                <td style="text-align: right; color: #dc3545;">${formatCurrency(saidas)}</td>
                <td style="text-align: right; color: ${saldoDia >= 0 ? '#28a745' : '#dc3545'};">
                    ${formatCurrency(saldoDia)}
                </td>
                <td style="text-align: right; color: ${saldoAcumulado >= 0 ? '#28a745' : '#dc3545'};">
                    ${formatCurrency(saldoAcumulado)}
                </td>
            </tr>
        `;
    }).join('');
}

function calcularFluxoPeriodo(dataInicio, dataFim) {
    const inicio = new Date(dataInicio);
    const fim = new Date(dataFim);
    const labels = [];
    const entradas = [];
    const saidas = [];
    
    for (let data = new Date(inicio); data <= fim; data.setDate(data.getDate() + 1)) {
        const dataStr = data.toISOString().split('T')[0];
        
        labels.push(data.toLocaleDateString('pt-BR'));
        
        // Calcular entradas do dia
        const entradasDia = contasReceber
            .filter(c => c.dataVencimento === dataStr && c.status === 'pago')
            .reduce((total, conta) => total + (conta.valorPago || conta.valor || 0), 0);
        
        // Calcular saídas do dia
        const saidasDia = contasPagar
            .filter(c => c.dataVencimento === dataStr && c.status === 'pago')
            .reduce((total, conta) => total + (conta.valorPago || conta.valor || 0), 0);
        
        entradas.push(entradasDia);
        saidas.push(saidasDia);
    }
    
    return { labels, entradas, saidas };
}

// Relatórios: uma única fonte para tela, impressão e PDF.
const FINANCE_REPORT_TITLES = Object.freeze({
    inadimplencia: 'Relatório de Inadimplência',
    faturamento: 'Relatório de Faturamento',
    pagamentos: 'Relatório de Pagamentos',
    categorias: 'Análise por Categorias',
    clientes: 'Ranking de Clientes',
    fornecedores: 'Ranking de Fornecedores'
});

const FINANCE_REPORT_ORIGIN_LABELS = Object.freeze({
    receber: 'Contas a Receber',
    pagar: 'Contas a Pagar'
});

const FINANCE_REPORT_TYPE_OPTIONS = Object.freeze({
    receber: Object.freeze([
        { value: 'inadimplencia', label: 'Inadimplência' },
        { value: 'faturamento', label: 'Faturamento por Período' },
        { value: 'categorias', label: 'Análise por Categorias' },
        { value: 'clientes', label: 'Ranking de Clientes' }
    ]),
    pagar: Object.freeze([
        { value: 'inadimplencia', label: 'Inadimplência' },
        { value: 'pagamentos', label: 'Pagamentos por Período' },
        { value: 'categorias', label: 'Análise por Categorias' },
        { value: 'fornecedores', label: 'Ranking de Fornecedores' }
    ])
});

function syncFinanceReportTypeOptions() {
    const originSelect = document.getElementById('relContaOrigem');
    const typeSelect = document.getElementById('tipoRelatorio');
    if (!originSelect || !typeSelect) return;
    const origem = String(originSelect.value || 'receber').trim();
    const options = FINANCE_REPORT_TYPE_OPTIONS[origem] || FINANCE_REPORT_TYPE_OPTIONS.receber;
    const currentValue = String(typeSelect.value || '').trim();
    typeSelect.replaceChildren();
    options.forEach((item) => {
        const option = document.createElement('option');
        option.value = item.value;
        option.textContent = item.label;
        typeSelect.appendChild(option);
    });
    typeSelect.value = options.some((item) => item.value === currentValue)
        ? currentValue
        : options[0].value;
}

function escapeFinanceHtml(value) {
    return String(value === undefined || value === null ? '' : value)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
}

function getFinanceInlineStringArgument(value) {
    return escapeFinanceHtml(JSON.stringify(String(value === undefined || value === null ? '' : value)));
}

function getSafeFinanceImageUrl(value) {
    const raw = String(value || '').trim();
    if (!raw) return '';
    if (/^data:image\/(?:png|jpeg|jpg|gif|webp);base64,[A-Za-z0-9+/=]+$/i.test(raw)) return raw;
    if (/^blob:/i.test(raw)) return raw;
    try {
        const parsed = new URL(raw, window.location.origin);
        return /^(https?:)$/.test(parsed.protocol) ? parsed.href : '';
    } catch (_) {
        return '';
    }
}

function getSafeFinanceDownloadUrl(value) {
    const raw = String(value || '').trim();
    if (!raw) return '';
    try {
        const parsed = new URL(raw);
        const host = String(parsed.hostname || '').toLowerCase();
        if (
            parsed.protocol !== 'https:'
            || !(host === 'firebasestorage.googleapis.com' || host.endsWith('.firebasestorage.app'))
        ) return '';
        return parsed.href;
    } catch (_) {
        return '';
    }
}

function openFinanceAttachment(value) {
    const safeUrl = getSafeFinanceDownloadUrl(value);
    if (!safeUrl) {
        mostrarNotificacao('O anexo informado não possui uma URL segura.', 'error');
        return null;
    }
    const opened = window.open(safeUrl, '_blank', 'noopener,noreferrer');
    if (opened) opened.opener = null;
    return opened;
}

window.openFinanceAttachment = openFinanceAttachment;

function getFinanceReportRange() {
    const origem = String(document.getElementById('relContaOrigem')?.value || '').trim();
    const tipo = String(document.getElementById('tipoRelatorio')?.value || '').trim();
    const dataInicio = String(document.getElementById('relDataInicio')?.value || '').trim();
    const dataFim = String(document.getElementById('relDataFim')?.value || '').trim();
    const validTypes = FINANCE_REPORT_TYPE_OPTIONS[origem];
    if (!validTypes) throw new Error('Origem das contas inválida.');
    if (!FINANCE_REPORT_TITLES[tipo] || !validTypes.some((item) => item.value === tipo)) {
        throw new Error('Tipo de relatório inválido para a origem selecionada.');
    }
    if (!/^\d{4}-\d{2}-\d{2}$/.test(dataInicio) || !/^\d{4}-\d{2}-\d{2}$/.test(dataFim)) {
        throw new Error('Informe a data inicial e a data final do relatório.');
    }
    if (dataInicio > dataFim) throw new Error('A data inicial não pode ser posterior à data final.');
    return { origem, tipo, dataInicio, dataFim, signature: `${origem}|${tipo}|${dataInicio}|${dataFim}` };
}

function normalizeFinanceReportCollection(raw) {
    if (Array.isArray(raw)) return raw.filter(Boolean);
    if (!raw || typeof raw !== 'object') return [];
    return Object.entries(raw).map(([id, value]) => ({ ...(value || {}), id: String((value && value.id) || id) }));
}

async function loadFinanceReportMonthsStrict(tipo, months) {
    const service = window.firebaseService;
    if (!service || typeof service.loadFromFirebase !== 'function') throw new Error('Firebase indisponível para carregar o relatório.');
    const normalizedMonths = Array.from(new Set((months || []).filter((month) => /^\d{4}-\d{2}$/.test(String(month)))));
    const confirmedKey = tipo === 'receber' ? 'financeReportMonthsConfirmedReceber' : 'financeReportMonthsConfirmedPagar';
    const loadedKey = tipo === 'receber' ? 'financeMonthsLoadedReceber' : 'financeMonthsLoadedPagar';
    window[confirmedKey] = window[confirmedKey] || new Set();
    window[loadedKey] = window[loadedKey] || new Set();
    const results = await Promise.all(normalizedMonths.map(async (month) => {
        if (window[confirmedKey].has(month)) return null;
        const result = await service.loadFromFirebase(`financas/${tipo}/${month}`);
        if (!result || result.success !== true) throw new Error(`Não foi possível confirmar a partição ${month} do relatório.`);
        return { month, data: result.data };
    }));
    
    results.forEach((res) => {
        if (!res) return;
        const records = normalizeFinanceReportCollection(res.data);
        if (tipo === 'receber') contasReceber = mergeFinanceMonthData(contasReceber, records, res.month, 'contasReceber_deletedIds');
        else contasPagar = mergeFinanceMonthData(contasPagar, records, res.month, 'contasPagar_deletedIds');
        window[confirmedKey].add(res.month);
        window[loadedKey].add(res.month);
    });
    if (tipo === 'receber') subscribeReceberMonths(normalizedMonths);
    else subscribePagarMonths(normalizedMonths);
}

async function loadAllFinanceReportPartitionsStrict(tipo) {
    const service = window.firebaseService;
    if (!service || typeof service.loadFromFirebase !== 'function') throw new Error('Firebase indisponível para carregar o relatório.');
    const result = await service.loadFromFirebase(`financas/${tipo}`);
    if (!result || result.success !== true) throw new Error('Não foi possível confirmar todas as partições do relatório.');
    const partitions = result.data && typeof result.data === 'object' ? result.data : {};
    const months = Object.keys(partitions).filter((month) => /^\d{4}-\d{2}$/.test(month));
    for (const month of months) {
        const records = normalizeFinanceReportCollection(partitions[month]);
        if (tipo === 'receber') contasReceber = mergeFinanceMonthData(contasReceber, records, month, 'contasReceber_deletedIds');
        else contasPagar = mergeFinanceMonthData(contasPagar, records, month, 'contasPagar_deletedIds');
    }
    const confirmedKey = tipo === 'receber' ? 'financeReportMonthsConfirmedReceber' : 'financeReportMonthsConfirmedPagar';
    const loadedKey = tipo === 'receber' ? 'financeMonthsLoadedReceber' : 'financeMonthsLoadedPagar';
    window[confirmedKey] = window[confirmedKey] || new Set();
    window[loadedKey] = window[loadedKey] || new Set();
    months.forEach((month) => { window[confirmedKey].add(month); window[loadedKey].add(month); });
    if (tipo === 'receber') subscribeReceberMonths(months);
    else subscribePagarMonths(months);
}

async function ensureFinanceReportScope({ origem, tipo, dataInicio, dataFim }) {
    if (['faturamento', 'pagamentos'].includes(tipo)) {
        await loadAllFinanceReportPartitionsStrict(origem);
        return;
    }
    const months = listMonthsBetween(dataInicio, dataFim);
    await loadFinanceReportMonthsStrict(origem, months);
}

function isFinanceDateInRange(value, start, end) {
    const ts = normalizeDateToTimestamp(value);
    const startTs = normalizeDateToTimestamp(start);
    const endTs = normalizeDateToTimestamp(end);
    if (ts === null || startTs === null || endTs === null) return false;
    const endOfDayTs = endTs + 86400000 - 1;
    return ts >= startTs && ts <= endOfDayTs;
}

function getFinancePartyName(conta, tipo) {
    const candidate = tipo === 'receber' ? conta && conta.cliente : conta && conta.fornecedor;
    if (candidate && typeof candidate === 'object') {
        return candidate.nome || candidate.name || candidate.nomeCompleto || candidate.razaoSocial || candidate.fantasia || 'Não identificado';
    }
    if (typeof candidate === 'string' && candidate.trim()) return candidate.trim();
    if (tipo === 'pagar' && conta && conta.funcionarioNome) return String(conta.funcionarioNome);
    return 'Não identificado';
}

function buildFinanceReportModel({ origem, tipo, dataInicio, dataFim, signature }) {
    const records = origem === 'receber' ? contasReceber : contasPagar;
    const partyLabel = origem === 'receber' ? 'Cliente' : 'Fornecedor';
    const model = {
        origem,
        origemLabel: FINANCE_REPORT_ORIGIN_LABELS[origem],
        tipo,
        signature,
        titulo: FINANCE_REPORT_TITLES[tipo],
        dataInicio,
        dataFim,
        columns: [],
        rows: [],
        summaries: []
    };

    const isEligibleRecord = (conta) => (
        origem !== 'pagar'
        || conta.origem !== 'folha_pagamento'
        || conta.funcionarioAtivo !== false
    );

    if (tipo === 'inadimplencia') {
        const today = getTodayISODateLocal();
        model.rows = records
            .filter((conta) => isFinanceDateInRange(conta.dataVencimento || conta.vencimento, dataInicio, dataFim))
            .filter(isEligibleRecord)
            .map((conta) => {
                const info = getContaFinanceInfo(conta);
                const due = normalizeDateISOInput(conta.dataVencimento || conta.vencimento || '');
                if (!due || due >= today || !['pendente', 'parcial', 'vencido'].includes(info.statusNorm)) return null;
                return {
                    parte: getFinancePartyName(conta, origem),
                    descricao: conta.descricao || '',
                    numero: conta.pedidoNumero || conta.numero || '',
                    vencimento: due,
                    diasAtraso: Math.max(0, Math.floor((getTodayStartTimestampLocal() - normalizeDateToTimestamp(due)) / 86400000)),
                    categoria: getCategoriaLabel(conta.categoria),
                    valor: Math.max(0, parseCurrencyValue(info.totalAtualizado || info.valorRestante || 0))
                };
            })
            .filter(Boolean)
            .sort((a, b) => a.vencimento.localeCompare(b.vencimento));
        const total = model.rows.reduce((sum, row) => sum + row.valor, 0);
        model.columns = [
            { key: 'parte', label: partyLabel },
            { key: 'descricao', label: 'Descrição' }, { key: 'numero', label: 'Número' },
            { key: 'vencimento', label: 'Vencimento', format: 'date' }, { key: 'diasAtraso', label: 'Dias em atraso' },
            { key: 'categoria', label: 'Categoria' }, { key: 'valor', label: 'Saldo atualizado', format: 'currency' }
        ];
        model.summaries = [
            { label: `Total ${origem === 'receber' ? 'a receber' : 'a pagar'} em atraso`, value: total, format: 'currency' },
            { label: 'Títulos vencidos', value: model.rows.length }
        ];
    } else if (['faturamento', 'pagamentos'].includes(tipo)) {
        const rows = [];
        records.filter(isEligibleRecord).forEach((conta) => {
            const history = Array.isArray(conta.historicosPagamento) ? conta.historicosPagamento : [];
            if (history.length) {
                history.forEach((payment) => {
                    const paymentDate = payment && (payment.data || payment.dataPagamento);
                    if (!isFinanceDateInRange(paymentDate, dataInicio, dataFim)) return;
                    rows.push({
                        parte: getFinancePartyName(conta, origem),
                        descricao: conta.descricao || '',
                        numero: conta.pedidoNumero || conta.numero || '',
                        data: paymentDate,
                        metodo: payment.metodo || payment.formaPagamento || conta.metodoPagamento || resolveFinanceTipoOperacional(conta) || '',
                        valor: parseCurrencyValue(payment.valor || 0)
                    });
                });
                return;
            }
            const info = getContaFinanceInfo(conta);
            const paidDate = conta.dataPagamento || (origem === 'receber' ? conta.dataRecebimento : '');
            if (info.statusNorm === 'pago' && isFinanceDateInRange(paidDate, dataInicio, dataFim)) {
                rows.push({
                    parte: getFinancePartyName(conta, origem),
                    descricao: conta.descricao || '',
                    numero: conta.pedidoNumero || conta.numero || '',
                    data: paidDate,
                    metodo: conta.metodoPagamento || resolveFinanceTipoOperacional(conta) || '',
                    valor: parseCurrencyValue(info.valorPago || info.valorOriginal || 0)
                });
            }
        });
        model.rows = rows.sort((a, b) => a.data.localeCompare(b.data));
        const total = model.rows.reduce((sum, row) => sum + row.valor, 0);
        const isReceivable = origem === 'receber';
        model.columns = [
            { key: 'parte', label: partyLabel }, { key: 'descricao', label: 'Descrição' },
            { key: 'numero', label: 'Número' }, { key: 'data', label: `Data do ${isReceivable ? 'recebimento' : 'pagamento'}`, format: 'date' },
            { key: 'metodo', label: 'Método' }, { key: 'valor', label: `Valor ${isReceivable ? 'recebido' : 'pago'}`, format: 'currency' }
        ];
        model.summaries = [
            { label: isReceivable ? 'Total faturado' : 'Total pago', value: total, format: 'currency' },
            { label: `Número de ${isReceivable ? 'recebimentos' : 'pagamentos'}`, value: model.rows.length },
            { label: `Valor médio por ${isReceivable ? 'recebimento' : 'pagamento'}`, value: model.rows.length ? total / model.rows.length : 0, format: 'currency' }
        ];
    } else {
        const isCategories = tipo === 'categorias';
        const grouped = new Map();
        records
            .filter((conta) => isFinanceDateInRange(conta.dataVencimento || conta.vencimento, dataInicio, dataFim))
            .filter(isEligibleRecord)
            .forEach((conta) => {
                const keyName = isCategories ? getCategoriaLabel(conta.categoria) : getFinancePartyName(conta, origem);
                const current = grouped.get(keyName) || { nome: keyName, quantidade: 0, total: 0 };
                current.quantidade += 1;
                current.total += parseCurrencyValue(getContaFinanceInfo(conta).valorOriginal || conta.valor || 0);
                grouped.set(keyName, current);
            });
        model.rows = Array.from(grouped.values())
            .sort((a, b) => b.total - a.total)
            .map((row, index) => ({ posicao: index + 1, ...row }));
        model.columns = [
            { key: 'posicao', label: 'Posição' },
            { key: 'nome', label: isCategories ? 'Categoria' : partyLabel },
            { key: 'quantidade', label: 'Quantidade' }, { key: 'total', label: 'Valor total', format: 'currency' }
        ];
        model.summaries = [{ label: 'Total geral', value: model.rows.reduce((sum, row) => sum + row.total, 0), format: 'currency' }];
    }
    return model;
}

function formatFinanceReportValue(value, format) {
    if (format === 'currency') return formatCurrency(parseCurrencyValue(value || 0));
    if (format === 'date') return formatDate(value);
    return String(value === undefined || value === null || value === '' ? '-' : value);
}

function renderFinanceReportModel(model) {
    const summaries = model.summaries.map((item) => `
        <div class="summary-row"><span>${escapeFinanceHtml(item.label)}</span><strong>${escapeFinanceHtml(formatFinanceReportValue(item.value, item.format))}</strong></div>
    `).join('');
    const table = model.rows.length ? `
        <div class="table-container finance-report-table-wrap" role="region" aria-label="Dados do relatório" tabindex="0">
            <table class="table finance-report-table">
                <caption class="finance-sr-only">${escapeFinanceHtml(model.titulo)}</caption>
                <thead><tr>${model.columns.map((column) => `<th>${escapeFinanceHtml(column.label)}</th>`).join('')}</tr></thead>
                <tbody>${model.rows.map((row) => `<tr>${model.columns.map((column) => `<td>${escapeFinanceHtml(formatFinanceReportValue(row[column.key], column.format))}</td>`).join('')}</tr>`).join('')}</tbody>
            </table>
        </div>
    ` : '<p class="finance-report-empty">Nenhum dado encontrado para o período informado.</p>';
    return `
        <div class="finance-report-period">
            <strong>Origem:</strong> ${escapeFinanceHtml(model.origemLabel)}
            <span aria-hidden="true">|</span>
            <strong>Período:</strong> ${escapeFinanceHtml(formatDate(model.dataInicio))} a ${escapeFinanceHtml(formatDate(model.dataFim))}
        </div>
        ${summaries}${table}
    `;
}

function invalidateFinanceReport() {
    window.__financeReportRequestId = Number(window.__financeReportRequestId || 0) + 1;
    window.__financeReportState = null;
    const result = document.getElementById('relatorioResult');
    const content = document.getElementById('relatorioContent');
    if (content) content.replaceChildren();
    if (result) result.style.display = 'none';
}

function setFinanceReportBusy(busy) {
    const actions = document.querySelector('.report-actions');
    if (actions) actions.setAttribute('aria-busy', busy ? 'true' : 'false');
    document.querySelectorAll('.report-actions button').forEach((button) => {
        if (busy) {
            button.dataset.financeWasDisabled = button.disabled ? 'true' : 'false';
            button.disabled = true;
        } else if (button.dataset.financeWasDisabled !== undefined) {
            button.disabled = button.dataset.financeWasDisabled === 'true';
            delete button.dataset.financeWasDisabled;
        }
    });
    window.__financeReportBusy = busy;
}

function getFinanceReportFriendlyError(error) {
    const raw = String(error && error.message ? error.message : error || '');
    const code = String(error && error.code || '');
    if (/permission|unauth|auth\//i.test(`${code} ${raw}`)) {
        return 'Sua sessão não pôde acessar todos os dados do relatório. Entre novamente e tente de novo.';
    }
    if (/network|offline|unavailable|failed to fetch/i.test(`${code} ${raw}`)) {
        return 'Não foi possível confirmar os dados online. Verifique a conexão e tente novamente.';
    }
    return 'Não foi possível gerar o relatório com segurança. Revise o período e tente novamente.';
}

async function gerarRelatorio(options = {}) {
    const alreadyBusy = window.__financeReportBusy === true;
    if (alreadyBusy && options.allowWhenBusy !== true) return null;
    const resultElement = document.getElementById('relatorioResult');
    const titleElement = document.getElementById('relatorioTitulo');
    const contentElement = document.getElementById('relatorioContent');
    if (!resultElement || !titleElement || !contentElement) return null;
    const ownsBusyState = !alreadyBusy;
    if (ownsBusyState) setFinanceReportBusy(true);
    resultElement.style.display = 'block';
    resultElement.setAttribute('aria-busy', 'true');
    titleElement.textContent = 'Gerando relatório';
    contentElement.textContent = 'Carregando e confirmando todas as partições do período...';
    window.__financeReportState = null;
    const requestId = Number(window.__financeReportRequestId || 0) + 1;
    window.__financeReportRequestId = requestId;
    try {
        const range = getFinanceReportRange();
        await ensureFinanceReportScope(range);
        if (window.__financeReportRequestId !== requestId) return null;
        const model = buildFinanceReportModel(range);
        const company = await prepareFinanceReportCompany();
        if (window.__financeReportRequestId !== requestId) return null;
        model.company = company;
        titleElement.textContent = model.titulo;
        const header = buildFinanceReportPreviewHeader(company, model);
        contentElement.innerHTML = `${header}${renderFinanceReportModel(model)}`;
        window.__financeReportState = model;
        return model;
    } catch (error) {
        if (window.__financeReportRequestId !== requestId) return null;
        const friendlyMessage = getFinanceReportFriendlyError(error);
        titleElement.textContent = 'Relatório não gerado';
        contentElement.textContent = friendlyMessage;
        mostrarNotificacao(friendlyMessage, 'error');
        return null;
    } finally {
        resultElement.setAttribute('aria-busy', 'false');
        if (ownsBusyState) setFinanceReportBusy(false);
    }
}

function sanitizeFinanceCsvCell(value) {
    let text = String(value === undefined || value === null ? '' : value).replace(/\r?\n/g, ' ');
    if (/^[\t ]*[=+\-@]/.test(text)) text = `'${text}`;
    return `"${text.replace(/"/g, '""')}"`;
}

function downloadFinanceCsv(headers, rows, filename, summaries = []) {
    if (!Array.isArray(rows) || rows.length === 0) throw new Error('Nenhum dado encontrado para exportar.');
    const csvLines = [headers.map((header) => sanitizeFinanceCsvCell(header.label)).join(',')];
    rows.forEach((row) => {
        csvLines.push(headers.map((header) => sanitizeFinanceCsvCell(formatFinanceReportValue(row[header.key], header.format))).join(','));
    });
    if (summaries.length) {
        csvLines.push('');
        summaries.forEach((summary) => csvLines.push([
            sanitizeFinanceCsvCell(summary.label),
            sanitizeFinanceCsvCell(formatFinanceReportValue(summary.value, summary.format))
        ].join(',')));
    }
    const blob = new Blob(['\ufeff' + csvLines.join('\r\n')], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `${String(filename || 'relatorio').replace(/[^A-Za-z0-9_-]/g, '_')}.csv`;
    document.body.appendChild(link);
    link.click();
    link.remove();
    setTimeout(() => URL.revokeObjectURL(url), 0);
}

async function getCurrentFinanceReportModel(options = {}) {
    const range = getFinanceReportRange();
    const current = window.__financeReportState;
    if (current && current.signature === range.signature) return current;
    const generated = await gerarRelatorio({ allowWhenBusy: options.allowWhenBusy === true });
    if (!generated) throw new Error('Gere um relatório válido antes de exportar.');
    return generated;
}

function buildFinanceReportPrintBody(model) {
    const summaries = model.summaries.map((item) => `
        <tr>
            <td>${escapeFinanceHtml(item.label)}</td>
            <td class="right">${escapeFinanceHtml(formatFinanceReportValue(item.value, item.format))}</td>
        </tr>
    `).join('');
    const table = model.rows.length ? `
        <table class="sisweb-print-table finance-report-print-table">
            <thead>
                <tr>${model.columns.map((column) => `<th>${escapeFinanceHtml(column.label)}</th>`).join('')}</tr>
            </thead>
            <tbody>
                ${model.rows.map((row) => `
                    <tr>${model.columns.map((column) => `
                        <td class="${column.format === 'currency' ? 'right finance-report-print-nowrap' : column.format === 'date' ? 'finance-report-print-nowrap' : ''}">
                            ${escapeFinanceHtml(formatFinanceReportValue(row[column.key], column.format))}
                        </td>
                    `).join('')}</tr>
                `).join('')}
            </tbody>
        </table>
    ` : '<p class="finance-report-print-empty">Nenhum dado encontrado para o período informado.</p>';
    return `
        <section class="sisweb-print-section">
            <div class="finance-report-print-meta">
                <div><strong>Origem:</strong> ${escapeFinanceHtml(model.origemLabel)}</div>
                <div><strong>Período:</strong> ${escapeFinanceHtml(formatDate(model.dataInicio))} a ${escapeFinanceHtml(formatDate(model.dataFim))}</div>
            </div>
            ${summaries ? `<table class="finance-report-print-summary"><tbody>${summaries}</tbody></table>` : ''}
            <div class="finance-report-print-table-wrap">${table}</div>
        </section>
    `;
}

async function imprimirRelatorioAtual() {
    if (window.__financeReportBusy === true) return null;
    const win = window.open('', '_blank');
    if (!win) {
        mostrarNotificacao('O bloqueador de pop-ups impediu a abertura do relatório.', 'warning');
        return null;
    }
    win.document.open();
    win.document.write(`
        <!DOCTYPE html>
        <html lang="pt-BR">
            <head><meta charset="UTF-8"><title>Preparando relatório</title></head>
            <body style="font-family:Arial,sans-serif;display:flex;align-items:center;justify-content:center;min-height:100vh;margin:0;background:#f8fafc;color:#475569;">
                <div style="text-align:center;padding:24px;">
                    <strong style="display:block;font-size:22px;color:#0f172a;margin-bottom:8px;">Preparando seu relatório...</strong>
                    <span>Confirmando dados e formatando a impressão.</span>
                </div>
            </body>
        </html>
    `);
    win.document.close();
    setFinanceReportBusy(true);
    try {
        const model = await getCurrentFinanceReportModel({ allowWhenBusy: true });
        const helper = getFinanceReportDocumentHelper();
        const company = model.company || await prepareFinanceReportCompany();
        model.company = company;
        const prepared = await helper.preparePrintOptions({
            ...buildFinanceReportHeaderOptions(company, model.titulo, {
                subtitle: `${model.origemLabel} | ${formatDate(model.dataInicio)} a ${formatDate(model.dataFim)}`
            }),
            bodyHtml: buildFinanceReportPrintBody(model),
            targetWindow: win,
            printDelay: 300,
            extraCss: `
                @page { size: A4; margin: 8mm; }
                .sisweb-print-page { max-width: 100%; }
                .sisweb-print-section { break-inside: auto; page-break-inside: auto; }
                .finance-report-print-meta { display:flex; flex-wrap:wrap; gap:8px 20px; margin-bottom:12px; }
                .finance-report-print-summary { width:min(100%, 420px); margin:0 0 14px auto; border-collapse:collapse; }
                .finance-report-print-summary td { border:1px solid #cbd5e1; padding:7px 10px; }
                .finance-report-print-table-wrap { width:100%; overflow:visible; }
                .finance-report-print-table { width:100%; table-layout:auto; border-collapse:collapse; }
                .finance-report-print-table th { padding:5px; font-size:8px; text-transform:uppercase; }
                .finance-report-print-table td { padding:5px; font-size:8.4px; line-height:1.25; overflow-wrap:anywhere; }
                .finance-report-print-nowrap { white-space:nowrap; overflow-wrap:normal; word-break:normal; }
                .finance-report-print-empty { padding:16px; text-align:center; border:1px solid #cbd5e1; }
                .right { text-align:right; }
            `
        });
        return helper.printHtmlDocument(prepared);
    } catch (error) {
        const friendlyMessage = getFinanceReportFriendlyError(error);
        win.document.open();
        win.document.write(`
            <!DOCTYPE html>
            <html lang="pt-BR">
                <head><meta charset="UTF-8"><title>Relatório não gerado</title></head>
                <body style="font-family:Arial,sans-serif;padding:32px;color:#7f1d1d;background:#fff7f7;">
                    <h1 style="font-size:22px;">Relatório não gerado</h1>
                    <p>${escapeFinanceHtml(friendlyMessage)}</p>
                </body>
            </html>
        `);
        win.document.close();
        mostrarNotificacao(friendlyMessage, 'error');
        return null;
    } finally {
        setFinanceReportBusy(false);
    }
}

async function exportarDados(formato) {
    if (window.__financeReportBusy === true) return;
    setFinanceReportBusy(true);
    try {
        const model = await getCurrentFinanceReportModel({ allowWhenBusy: true });
        if (formato === 'excel') {
            downloadFinanceCsv(model.columns, model.rows, `relatorio_${model.tipo}_${getTodayISODateLocal()}`, model.summaries);
            mostrarNotificacao('Relatório exportado em CSV.', 'success');
        } else if (formato === 'pdf') {
            await exportarPDF(model);
        }
    } catch (error) {
        mostrarNotificacao(getFinanceReportFriendlyError(error), 'error');
    } finally {
        setFinanceReportBusy(false);
    }
}

function exportarTabela(tipo, formato) {
    if (formato !== 'excel') return;
    const allFiltered = tipo === 'receber'
        ? computeFilteredReceber(lastFiltroReceber || {})
        : computeFilteredPagar(lastFiltroPagar || {});
    const selected = tipo === 'receber' ? (window.selReceberSelection || new Set()) : (window.selPagarSelection || new Set());
    const data = selected.size ? allFiltered.filter((conta) => selected.has(String(conta.id))) : allFiltered;
    exportarTabelaExcel(data, `contas_${tipo}_${getTodayISODateLocal()}`, tipo);
}

function exportarTabelaExcel(data, filename, tipo) {
    try {
        const printPrefs = sanitizePrintPreferencesFor(tipo);
        const baseOrder = printPrefs && Array.isArray(printPrefs.order) ? printPrefs.order : defaultPrintColumns[tipo] || ['pedidoNumero','cliente','fornecedor','descricao','valor','vencimento','dataEmissao','juros','status','categoria','tipo'];
        const visible = printPrefs && printPrefs.visible ? printPrefs.visible : {};
        const order = baseOrder.filter(k => visible[k] !== false);
        const formatMap = { vencimento: 'date', dataEmissao: 'date', valor: 'currency', juros: 'currency' };
        const columns = order.map((k) => ({
            key: k,
            label: labelMap[k] || k,
            ...(formatMap[k] ? { format: formatMap[k] } : {})
        }));
        const rows = (data || []).map((conta) => {
            const info = getContaFinanceInfo(conta);
            const row = {};
            order.forEach((k) => {
                switch (k) {
                    case 'pedidoNumero': row.pedidoNumero = conta.pedidoNumero || conta.numero || ''; break;
                    case 'cliente': row.cliente = tipo === 'receber' ? getFinancePartyName(conta, tipo) : ''; break;
                    case 'fornecedor': row.fornecedor = tipo === 'pagar' ? getFinancePartyName(conta, tipo) : ''; break;
                    case 'descricao': row.descricao = conta.descricao || ''; break;
                    case 'valor': row.valor = info.totalAtualizado; break;
                    case 'juros': row.juros = Math.max(0, info.jurosAberto || 0); break;
                    case 'vencimento': row.vencimento = conta.dataVencimento || conta.vencimento || ''; break;
                    case 'dataEmissao': row.dataEmissao = conta.dataEmissao || ''; break;
                    case 'status': row.status = info.statusNorm; break;
                    case 'categoria': row.categoria = getCategoriaLabel(conta.categoria); break;
                    case 'tipo': row.tipo = conta.tipo || ''; break;
                    default: row[k] = (conta[k] !== undefined && conta[k] !== null) ? String(conta[k]) : '';
                }
            });
            return row;
        });
        downloadFinanceCsv(columns, rows, filename);
        mostrarNotificacao('Dados filtrados exportados em CSV.', 'success');
    } catch (error) {
        mostrarNotificacao(String(error && error.message ? error.message : 'Falha ao exportar os dados.'), 'error');
    }
}

async function exportarPDF(model) {
    getFinanceReportDocumentHelper();
    const company = model.company || await prepareFinanceReportCompany();
    const result = await window.SiswebCommercePdf.exportTableReportPdf({
        ...buildFinanceReportHeaderOptions(company, model.titulo, {
            subtitle: `${model.origemLabel} | ${formatDate(model.dataInicio)} a ${formatDate(model.dataFim)}`
        }),
        fileName: `relatorio_${model.origem}_${model.tipo}_${getTodayISODateLocal()}.pdf`,
        shareText: 'PDF de relatório financeiro gerado pelo Sisweb.',
        summaryRows: model.summaries.map((item) => ({
            label: item.label,
            value: formatFinanceReportValue(item.value, item.format)
        })),
        columns: model.columns.map((column) => ({
            label: column.label,
            key: column.key,
            align: column.format === 'currency' ? 'right' : 'left'
        })),
        rows: model.rows.map((row) => model.columns.map((column) => (
            formatFinanceReportValue(row[column.key], column.format)
        ))),
        emptyText: 'Nenhum dado encontrado para o período informado.',
        orientation: 'landscape'
    });
    if (result && result.mode !== 'cancelled') {
        const message = result.mode === 'share'
            ? 'PDF pronto para compartilhar ou imprimir.'
            : `PDF gerado: ${result.fileName}`;
        mostrarNotificacao(message, 'success');
    }
    return result;
}

// ✅ NOVO: Funções de Backup e Restore
function fazerBackup() {
    try {
        const dadosBackup = {
            contasReceber: contasReceber,
            contasPagar: contasPagar,
            dataBackup: new Date().toISOString(),
            versao: '1.0',
            sistema: 'Sistema Financeiro SISWEB'
        };
        
        const dadosJson = JSON.stringify(dadosBackup, null, 2);
        const blob = new Blob([dadosJson], { type: 'application/json' });
        
        const link = document.createElement('a');
        link.href = URL.createObjectURL(blob);
        link.download = `backup_financeiro_${new Date().toISOString().split('T')[0]}.json`;
        link.click();
        
        mostrarNotificacao('Backup realizado com sucesso!', 'success');
        
    } catch (error) {
        console.error('Erro ao fazer backup:', error);
        mostrarNotificacao('Erro ao fazer backup dos dados', 'error');
    }
}

function restaurarBackup(event) {
    const arquivo = event.target.files[0];
    
    if (!arquivo) {
        return;
    }
    
    if (arquivo.type !== 'application/json') {
        mostrarNotificacao('Por favor, selecione um arquivo JSON válido', 'error');
        return;
    }
    
    if (!confirm('⚠️ ATENÇÃO: Esta operação irá substituir todos os dados atuais. Deseja continuar?')) {
        event.target.value = ''; // Limpar input
        return;
    }
    
    const reader = new FileReader();
    reader.onload = async function(e) {
        try {
            const dadosBackup = JSON.parse(e.target.result);
            
            // Validar estrutura do backup
            if (!dadosBackup.contasReceber || !dadosBackup.contasPagar) {
                throw new Error('Arquivo de backup inválido: estrutura incorreta');
            }
            
            if (!Array.isArray(dadosBackup.contasReceber) || !Array.isArray(dadosBackup.contasPagar)) {
                throw new Error('Arquivo de backup inválido: dados corrompidos');
            }
            
            mostrarLoading(true);
            
            // Restaurar dados
            contasReceber = dadosBackup.contasReceber;
            contasPagar = dadosBackup.contasPagar;
            
            // Salvar no Firebase
            // Produção: restaurar somente em memória; persistência agregada desativada
            
            // Atualizar interface
            carregarTabelaReceber();
            carregarTabelaPagar();
            atualizarDashboard();
            
            mostrarLoading(false);
            mostrarNotificacao(
                `Backup restaurado com sucesso! ${contasReceber.length} contas a receber e ${contasPagar.length} contas a pagar restauradas.`, 
                'success'
            );
            
            // Mostrar informações do backup
            if (dadosBackup.dataBackup) {
            }
            
        } catch (error) {
            console.error('Erro ao restaurar backup:', error);
            mostrarLoading(false);
            mostrarNotificacao(`Erro ao restaurar backup: ${error.message}`, 'error');
        }
        
        // Limpar input
        event.target.value = '';
    };
    
    reader.onerror = function() {
        mostrarNotificacao('Erro ao ler o arquivo de backup', 'error');
        event.target.value = '';
    };
    
    reader.readAsText(arquivo);
}

function limparTodosDados() {
    const confirmacao1 = confirm('⚠️ ATENÇÃO: Esta operação irá REMOVER PERMANENTEMENTE todos os dados financeiros!');
    
    if (!confirmacao1) {
        return;
    }
    
    const confirmacao2 = confirm('🚨 ÚLTIMA CONFIRMAÇÃO: Tem certeza absoluta que deseja apagar TODOS os dados? Esta ação NÃO PODE ser desfeita!');
    
    if (!confirmacao2) {
        return;
    }
    
    const senhaConfirmacao = prompt('Digite "CONFIRMAR" para prosseguir com a exclusão de todos os dados:');
    
    if (senhaConfirmacao !== 'CONFIRMAR') {
        mostrarNotificacao('Operação cancelada - senha incorreta', 'info');
        return;
    }
    
    try {
        mostrarLoading(true);
        
        // Limpar arrays
        contasReceber = [];
        contasPagar = [];
        
        // Limpar Firebase
        Promise.resolve().then(() => {
            // Atualizar interface
            carregarTabelaReceber();
            carregarTabelaPagar();
            atualizarDashboard();
            
            mostrarLoading(false);
            mostrarNotificacao('Todos os dados foram removidos com sucesso', 'success');
            
        }).catch(error => {
            console.error('Erro ao limpar dados:', error);
            mostrarLoading(false);
            mostrarNotificacao('Erro ao limpar dados do Firebase', 'error');
        });
        
    } catch (error) {
        console.error('Erro ao limpar dados:', error);
        mostrarLoading(false);
        mostrarNotificacao('Erro ao limpar dados', 'error');
    }
}

// Funções auxiliares
function atualizarSelectClientes() {
    const selects = ['receberCliente', 'filtroReceberCliente'];
    
    // ✅ CORREÇÃO: Garantir que clientes é um array
    if (!clientes || !Array.isArray(clientes)) {
        console.warn('⚠️ clientes não é um array:', typeof clientes, clientes);
        clientes = [];
        return;
    }
    
    selects.forEach(selectId => {
        const select = document.getElementById(selectId);
        if (select) {
            const opcaoInicial = selectId.includes('filtro') ? 
                '<option value="">Todos os clientes</option>' : 
                '<option value="">Selecione um cliente</option>';
            
            select.innerHTML = opcaoInicial;
            
            clientes.forEach(cliente => {
                const option = document.createElement('option');
                option.value = cliente.id;
                let nome = cliente.nome || cliente.name || cliente.nomeCompleto || 'Nome não informado';
                if (isAllCaps(nome)) nome = toTitleCasePt(nome);
                option.textContent = nome;
                select.appendChild(option);
            });
        }
    });
}

function replaceFinanceSelectOptions(select, initialLabel, items) {
    if (!select) return;
    const fragment = document.createDocumentFragment();
    const initial = document.createElement('option');
    initial.value = '';
    initial.textContent = String(initialLabel || 'Selecione');
    fragment.appendChild(initial);
    (items || []).forEach((item) => {
        const option = document.createElement('option');
        option.value = String(item && item.value !== undefined ? item.value : '');
        option.textContent = String(item && item.label !== undefined ? item.label : '');
        fragment.appendChild(option);
    });
    select.replaceChildren(fragment);
}

function atualizarSelectFornecedores() {
    const selects = ['pagarFornecedor', 'filtroPagarFornecedor'];
    if (!Array.isArray(fornecedores)) fornecedores = [];
    if (!Array.isArray(funcionarios)) funcionarios = [];
    const combined = [];
    fornecedores.forEach(f => {
        let nome = f.nome || f.name;
        if (isAllCaps(nome)) nome = toTitleCasePt(nome);
        combined.push({ id: String(f.id), nome });
    });
    funcionarios.forEach(f => {
        let nome = f.nome || f.name;
        if (isAllCaps(nome)) nome = toTitleCasePt(nome);
        combined.push({ id: String(f.id), nome });
    });
    selects.forEach(selectId => {
        const select = document.getElementById(selectId);
        if (!select) return;
        replaceFinanceSelectOptions(
            select,
            selectId.includes('filtro') ? 'Todos os fornecedores' : 'Selecione um fornecedor',
            combined.map((item) => ({ value: item.id, label: item.nome || '' })),
        );
    });
}

function atualizarFiltros() {
    atualizarSelectClientes();
    atualizarSelectFornecedores();
    atualizarSelectCategorias();
    atualizarSelectTipos();
}

function limparFormulario(formId) {
    document.getElementById(formId).reset();
    
    // ✅ NOVO: Limpar estado de edição ao limpar formulário
    if (window.contaEmEdicao) {
        window.contaEmEdicao = null;
    }
    
    // ✅ CORREÇÃO: Reconfigurar todas as datas após limpar formulário
    const datasConfiguradas = configurarDatasDoMesAtual();
    
    if (formId === 'receberForm') {
        document.getElementById('receberParcelasContainer').style.display = 'none';
        const listRec = document.getElementById('receberParcelasList');
        if (listRec) listRec.innerHTML = '';
        if (window.generatedParcelAttachmentCache) window.generatedParcelAttachmentCache.receber = {};
        
        ['receberValorTotal', 'receberDataVencimento', 'receberParcelas', 'receberCliente', 'receberTipo', 'receberCategoria', 'receberJurosTipo', 'receberJurosTaxa', 'receberMultaTaxa'].forEach(id => {
            const el = document.getElementById(id);
            if (el) el.disabled = false;
        });
        const numInput = document.getElementById('receberNumero');
        if (numInput) numInput.readOnly = false;

        const jurosTipoRec = document.getElementById('receberJurosTipo');
        const jurosTaxaRec = document.getElementById('receberJurosTaxa');
        const multaTaxaRec = document.getElementById('receberMultaTaxa');
        const multaContRec = document.getElementById('receberMultaContainer');
        if (jurosTipoRec) jurosTipoRec.value = 'none';
        if (jurosTaxaRec) jurosTaxaRec.value = '0';
        if (multaTaxaRec) multaTaxaRec.value = '2';
        if (multaContRec) multaContRec.style.display = 'none';
        updateJurosRateFieldState('receber');
        const gerarBtnR = document.getElementById('receberGerarParcelasBtn');
        if (gerarBtnR) gerarBtnR.style.display = 'inline-block';
        updateManualAttachmentButtonState('receber');
    } else if (formId === 'pagarForm') {
        document.getElementById('pagarParcelasContainer').style.display = 'none';
        const listPag = document.getElementById('pagarParcelasList');
        if (listPag) listPag.innerHTML = '';
        if (window.generatedParcelAttachmentCache) window.generatedParcelAttachmentCache.pagar = {};
        
        ['pagarValorTotal', 'pagarDataVencimento', 'pagarParcelas', 'pagarFornecedor', 'pagarTipo', 'pagarCategoria', 'pagarJurosTipo', 'pagarJurosTaxa'].forEach(id => {
            const el = document.getElementById(id);
            if (el) el.disabled = false;
        });
        const numInput = document.getElementById('pagarNumero');
        if (numInput) numInput.readOnly = false;

        const jurosTipoPag = document.getElementById('pagarJurosTipo');
        const jurosTaxaPag = document.getElementById('pagarJurosTaxa');
        if (jurosTipoPag) jurosTipoPag.value = 'none';
        if (jurosTaxaPag) jurosTaxaPag.value = '0';
        updateJurosRateFieldState('pagar');
        const gerarBtn = document.getElementById('pagarGerarParcelasBtn');
        if (gerarBtn) gerarBtn.style.display = 'inline-block';
        updateManualAttachmentButtonState('pagar');
    }
    
    // ✅ Resetar botão de submit para "Salvar"
    try {
        const btn = document.getElementById(formId)?.querySelector('button[type="submit"]');
        if (btn) btn.innerHTML = '<i class="fas fa-save"></i> Salvar';
    } catch(_) {}
}

function updateFinanceModalBodyScrollLock() {
    try {
        const openModal = Array.from(document.querySelectorAll('.modal')).some((modal) => {
            if (!modal) return false;
            const styleDisplay = String(modal.style.display || '').toLowerCase();
            if (styleDisplay === 'block') return true;
            const computed = window.getComputedStyle ? window.getComputedStyle(modal).display : '';
            return String(computed || '').toLowerCase() === 'block';
        });
        document.body.style.overflow = openModal ? 'hidden' : '';
    } catch (_) {}
}

function fecharModal(modalId, options = {}) {
    if (modalId === 'pagamentoModal' && isPaymentModalBusy() && options.force !== true) {
        mostrarNotificacao('Aguarde a conclusão da operação financeira.', 'info');
        return false;
    }
    const modal = document.getElementById(modalId);
    if (modal) {
        modal.style.display = 'none';
        modal.setAttribute('aria-hidden', 'true');
    }
    
    if (modalId === 'pagamentoModal') {
        const form = document.getElementById('pagamentoForm');
        const hasUncertainUpload = !!form.__financePendingPaymentUpload;
        clearFinancePaymentAttemptState(form, { uncertain: hasUncertainUpload });
        
        // Verificar se há conteúdo original salvo (caso seja modal de histórico)
        const originalContent = form.getAttribute('data-original-content');
        if (originalContent) {
            // Restaurar conteúdo original do formulário
            form.innerHTML = originalContent;
            form.removeAttribute('data-original-content');
        } else {
            // Reset normal do formulário
            form.reset();
            
            // ✅ MELHORIA: Restaurar valores padrão
            const hoje = getTodayISODateLocal();
            document.getElementById('pagamentoData').value = hoje;
            document.getElementById('pagamentoMetodo').value = 'dinheiro';
        }
        
        // Limpar informações de pagamento parcial
        const infoParcial = document.getElementById('infoPagamentoParcial');
        if (infoParcial) {
            infoParcial.remove();
        }
        
        // ✅ CRÍTICO: Limpar variáveis de controle
        contaAtualEdicao = null;
        tipoContaAtual = '';
        if (hasUncertainUpload) {
            mostrarNotificacao('O comprovante ficou aguardando reconciliação segura antes da limpeza.', 'info');
        }
    }
    updateFinanceModalBodyScrollLock();
    if (modalId === 'pagamentoModal' && financeModalPreviousFocus && document.contains(financeModalPreviousFocus)) {
        financeModalPreviousFocus.focus();
        financeModalPreviousFocus = null;
    }
    return true;
}

function limparFiltros(tipo) {
    try {
        if (tipo === 'receber') {
            const setVal = (id, val) => { const el = document.getElementById(id); if (el) el.value = val; };
            setVal('filtroReceberStatus', 'em_aberto');
            setVal('filtroReceberCliente', '');
            setVal('filtroReceberCategoria', '');
            setVal('filtroReceberTipo', '');
            setVal('filtroReceberNumeroPedido', '');
            setVal('filtroReceberDataInicio', '');
            setVal('filtroReceberDataFim', '');
            try { window.selReceberSelection = new Set(); } catch(_) {}
            try {
                const all = Array.from(document.querySelectorAll('#receberTable .sel-receber'));
                all.forEach(cb => { cb.checked = false; });
            } catch(_) {}
            try { const sa = document.getElementById('selReceberAll'); if (sa) sa.checked = false; } catch(_) {}
            updateReceberSelectionCount();
            filtrarContas('receber');
        } else if (tipo === 'pagar') {
            const setVal = (id, val) => { const el = document.getElementById(id); if (el) el.value = val; };
            setVal('filtroPagarStatus', 'em_aberto');
            setVal('filtroPagarFornecedor', '');
            setVal('filtroPagarCategoria', '');
            setVal('filtroPagarTipo', '');
            setVal('filtroPagarNumeroPedido', '');
            setVal('filtroPagarDataInicio', '');
            setVal('filtroPagarDataFim', '');
            try { window.selPagarSelection = new Set(); } catch(_) {}
            try {
                const all = Array.from(document.querySelectorAll('#pagarTable .sel-pagar'));
                all.forEach(cb => { cb.checked = false; });
            } catch(_) {}
            try { const sa = document.getElementById('selPagarAll'); if (sa) sa.checked = false; } catch(_) {}
            updatePagarSelectionCount();
            filtrarContas('pagar');
        }
    } catch (e) {
        console.warn('Falha ao limpar filtros:', e);
    }
}

// Funções de formatação
function formatCurrency(value) {
    if (value === undefined || value === null) return 'R$ 0,00';
    const numValue = typeof value === 'string' ? parseFloat(value.replace(/[^\d.,]/g, '').replace(',', '.')) : parseFloat(value);
    if (isNaN(numValue)) return 'R$ 0,00';
    return numValue.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

function formatCurrencyNoSymbol(value) {
    const num = parseCurrencyValue(value);
    return Number(num).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function isAllCaps(text) {
    if (!text) return false;
    const letters = text.replace(/[^A-Za-zÀ-ÿ]/g, '');
    if (!letters) return false;
    return letters === letters.toUpperCase();
}

function toTitleCasePt(text) {
    if (!text) return text;
    const acronyms = new Set(['CPF','CNPJ','RG','IE','IM','NF','NFE','NF-E','CTE','PIX','IPTU','IPVA','ISS','ICMS','IPI','PIS','COFINS','CSLL','MEI','ME','LTDA','EIRELI','S/A','SA']);
    const normalizeSpaces = s => s.replace(/\s+/g, ' ').trim();
    const capitalize = w => w ? (w.charAt(0).toUpperCase() + w.slice(1).toLowerCase()) : w;
    const fixToken = (token) => {
        const clean = token.replace(/^[\s]+|[\s]+$/g, '');
        if (acronyms.has(clean.toUpperCase())) return clean.toUpperCase();
        // Hyphen or slash separated parts
        return clean.split(/([\-\/])/).map(part => {
            if (part === '-' || part === '/') return part;
            return capitalize(part);
        }).join('');
    };
    const s = normalizeSpaces(String(text));
    return s.split(' ').map(fixToken).join(' ');
}

function parseCurrencyValue(value) {
    if (!value) return 0;
    if (typeof value === 'number') return value;
    
    const numericValue = value.toString()
        .replace(/[^\d,.-]/g, '')
        .replace(/\./g, '')
        .replace(',', '.');
    
    return parseFloat(numericValue) || 0;
}

// Helpers numéricos e de vencimento
function toNumber(value) {
    return typeof value === 'number' ? value : parseCurrencyValue(value);
}

function readTombstones(key) {
    try {
        const raw = localStorage.getItem(key);
        if (!raw) return [];
        const arr = JSON.parse(raw);
        if (!Array.isArray(arr)) return [];
        return arr.map(x => {
            if (x && typeof x === 'object') {
                return { id: String(x.id || x), monthKey: String(x.monthKey || ''), deletedAt: Number(x.deletedAt || 0) || 0 };
            }
            return { id: String(x), monthKey: '', deletedAt: 0 };
        });
    } catch(_) { return []; }
}

function writeTombstones(key, items) {
    try {
        const out = Array.isArray(items) ? items.map(x => ({ id: String(x.id), monthKey: String(x.monthKey || ''), deletedAt: Number(x.deletedAt || 0) || 0 })) : [];
        localStorage.setItem(key, JSON.stringify(out));
    } catch(_) {}
}

function getDeletedIdsSet(key) {
    try {
        const items = readTombstones(key);
        return new Set(items.map(x => String(x.id)));
    } catch(_) { return new Set(); }
}

function addTombstone(key, id, monthKey) {
    try {
        const items = readTombstones(key);
        const sid = String(id);
        let found = false;
        const now = Date.now();
        const updated = items.map(x => {
            if (String(x.id) === sid) {
                found = true;
                return { id: sid, monthKey: String(monthKey || x.monthKey || ''), deletedAt: now };
            }
            return x;
        });
        if (!found) updated.push({ id: sid, monthKey: String(monthKey || ''), deletedAt: now });
        writeTombstones(key, updated);
    } catch(_) {}
}

function monthKeyFromTimestamp(ms) {
    try {
        const d = new Date(ms);
        if (isNaN(d.getTime())) return new Date().toISOString().slice(0,7);
        return `${String(d.getFullYear()).padStart(4,'0')}-${String(d.getMonth()+1).padStart(2,'0')}`;
    } catch(_) { return new Date().toISOString().slice(0,7); }
}

function getCleanupIntervalMs() {
    try {
        const ovRaw = localStorage.getItem('financasCleanupIntervalHours');
        if (ovRaw) {
            const ov = parseInt(String(ovRaw), 10);
            if (!isNaN(ov) && ov > 0) return ov * 60 * 60 * 1000;
        }
    } catch(_) {}
    try {
        const size = (Array.isArray(window.contasReceber) ? window.contasReceber.length : 0) + (Array.isArray(window.contasPagar) ? window.contasPagar.length : 0);
        if (size > 5000) return 2 * 60 * 60 * 1000;
        if (size > 2000) return 4 * 60 * 60 * 1000;
        return 6 * 60 * 60 * 1000;
    } catch(_) { return 6 * 60 * 60 * 1000; }
}

async function repairTombstones(key, basePath) {
    try {
        const svc = window.firebaseService;
        if (!svc || typeof svc.loadFromFirebase !== 'function') return;
        const items = readTombstones(key);
        if (!items.length) return;
        const now = new Date();
        const range = [];
        for (let i = -24; i <= 6; i++) {
            const d = new Date(now);
            d.setMonth(d.getMonth() + i);
            range.push(d.toISOString().slice(0,7));
        }
        const loaded = key.indexOf('Receber') !== -1 ? Array.from(window.financeMonthsLoadedReceber || []) : Array.from(window.financeMonthsLoadedPagar || []);
        const months = Array.from(new Set([...loaded, ...range]));
        let changed = false;
        for (let i = 0; i < items.length; i++) {
            const t = items[i];
            if (t && (!t.monthKey || String(t.monthKey).trim() === '')) {
                let foundMk = '';
                for (const mk of months) {
                    try {
                        const res = await svc.loadFromFirebase(`${basePath}/${mk}/${t.id}`);
                        const exists = res && res.success && res.data !== null && res.data !== undefined;
                        if (exists) {
                            foundMk = mk;
                            break;
                        }
                    } catch(_) {}
                }
                if (!foundMk) foundMk = monthKeyFromTimestamp(t.deletedAt || Date.now());
                items[i] = { id: String(t.id), monthKey: String(foundMk), deletedAt: Number(t.deletedAt || Date.now()) };
                changed = true;
            }
        }
        if (changed) writeTombstones(key, items);
    } catch(_) {}
}

async function cleanupTombstones() {
    try {
        const threshold = 48 * 60 * 60 * 1000;
        const now = Date.now();
        const svc = window.firebaseService;
        if (!svc || typeof svc.loadFromFirebase !== 'function') return;
        const cleanOne = async (key, basePath) => {
            await repairTombstones(key, basePath);
            const items = readTombstones(key);
            const keep = [];
            for (const t of items) {
                const age = now - (Number(t.deletedAt || 0) || 0);
                if (!t.monthKey || age < threshold) { keep.push(t); continue; }
                try {
                    const res = await svc.loadFromFirebase(`${basePath}/${t.monthKey}/${t.id}`);
                    const exists = res && res.success && res.data !== null && res.data !== undefined;
                    if (exists) {
                        keep.push(t);
                    }
                } catch(_) { keep.push(t); }
            }
            writeTombstones(key, keep);
        };
        await cleanOne('contasReceber_deletedIds', 'contasReceber');
        await cleanOne('contasPagar_deletedIds', 'contasPagar');
    } catch(_) {}
}
function normalizeTipoKey(val) {
    let raw = String(val || '').trim().toLowerCase();
    raw = raw.normalize('NFD').replace(/[\u0300-\u036f]/g, '');
    raw = raw.replace(/\s+/g, ' ').replace(/-/g, '_');
    const map = {
        'a vista': 'a_vista', 'a_vista': 'a_vista',
        'a prazo': 'parcela', 'a_prazo': 'parcela',
        'receber': 'receber',
        'pagar': 'pagar',
        'entrada': 'entrada',
        'parcela': 'parcela', 'parcelado': 'parcela',
        'cheque pre': 'cheque_pre', 'cheque_pre': 'cheque_pre', 'cheque-pre': 'cheque_pre',
        'cheque': 'cheque',
        'boleto': 'boleto',
        'pix': 'pix',
        'transferencia': 'transferencia', 'transferencia bancaria': 'transferencia',
        'cartao': 'cartao', 'cartao credito': 'cartao', 'cartao debito': 'cartao',
        'permuta': 'permuta'
    };
    return map[raw] || raw;
}

function getTipoLabel(val) {
    const m = {
        'a_vista':'À Vista',
        'receber':'Receber',
        'pagar':'Pagar',
        'entrada':'Entrada',
        'parcela':'Parcela',
        'cheque_pre':'Cheque-pré',
        'cheque':'Cheque',
        'boleto':'Boleto',
        'pix':'Pix',
        'transferencia':'Transferência',
        'cartao':'Cartão',
        'permuta':'Permuta'
    };
    const k = normalizeTipoKey(val);
    return m[k] || (val || 'Não informado');
}

function resolveFinanceTipoOperacional(conta) {
    const tipoPagamento = normalizeTipoKey(conta && conta.tipoPagamento);
    const tipo = normalizeTipoKey(conta && conta.tipo);
    if (tipoPagamento && tipoPagamento !== 'pagar' && tipoPagamento !== 'receber') return tipoPagamento;
    if (tipo && tipo !== 'pagar' && tipo !== 'receber') return tipo;
    return tipoPagamento || tipo || '';
}

function shouldShowBoletoLamina(conta, tipoConta) {
    return String(tipoConta || '').toLowerCase() === 'receber' && resolveFinanceTipoOperacional(conta) === 'boleto';
}

function getFinanceSacadoReferenceId(conta) {
    const cliente = conta && conta.cliente;
    const candidate = (conta && conta.clienteId)
        || (cliente && typeof cliente === 'object' ? (cliente.id || cliente.clienteId) : cliente);
    if (typeof candidate !== 'string' && typeof candidate !== 'number') return '';
    const id = String(candidate).trim();
    return id && !/[.#$\[\]\/]/.test(id) ? id : '';
}

function getCategoriaLabel(val) {
    const map = {
        'vendas': 'Vendas',
        'compras': 'Compras',
        'servicos': 'Serviços', 'serviços': 'Serviços', 'servicos': 'Serviços',
        'carrego': 'Carrego',
        'mes_fechado': 'Mês Fechado',
        'quinzena_1': '1° Quinzena',
        'quinzena_2': '2° Quinzena',
        'ferias': 'Férias', 'férias': 'Férias',
        'rescisao': 'Rescisão', 'rescisão': 'Rescisão',
        'multas': 'Multas',
        'taxas': 'Taxas',
        'outros': 'Outros',
    };
    const k = String(val || '').toLowerCase();
    return map[k] || getTipoLabel(k) || (val || 'Não informado');
}

function normalizeCategoriaKey(val) {
    let raw = String(val || '').trim().toLowerCase();
    raw = raw.normalize('NFD').replace(/[\u0300-\u036f]/g, '');
    raw = raw.replace(/[!?.]/g, '').replace(/\s+/g, ' ');
    const map = {
        'vendas': 'vendas',
        'compras': 'compras',
        'servicos': 'servicos', 'serviços': 'servicos', 'servicoes': 'servicos',
        'carrego': 'carrego',
        'ferias': 'ferias', 'férias': 'ferias',
        'rescisao': 'rescisao', 'recisao': 'rescisao', 'rescisão': 'rescisao',
        'multas': 'multas',
        'taxas': 'taxas', 'taxa': 'taxas',
        'mes fechado': 'mes_fechado', 'mês fechado': 'mes_fechado', 'folha de pagamento': 'mes_fechado',
        'salarios': 'mes_fechado', 'salários': 'mes_fechado',
        'impostos': 'taxas',
        'outros': 'outros',
        '1 quinzena': 'quinzena_1',
        '1a quinzena': 'quinzena_1',
        '1ª quinzena': 'quinzena_1',
        '1o quinzena': 'quinzena_1',
        '1º quinzena': 'quinzena_1',
        '1° quinzena': 'quinzena_1',
        'primeira quinzena': 'quinzena_1',
        '2 quinzena': 'quinzena_2',
        '2a quinzena': 'quinzena_2',
        '2ª quinzena': 'quinzena_2',
        '2o quinzena': 'quinzena_2',
        '2º quinzena': 'quinzena_2',
        '2° quinzena': 'quinzena_2',
        'segunda quinzena': 'quinzena_2',
        // Formas/tipos aceitos como categoria
        'a vista': 'a_vista', 'à vista': 'a_vista', 'a_vista': 'a_vista',
        'a prazo': 'parcela', 'a_prazo': 'parcela',
        'receber': 'receber',
        'pagar': 'pagar',
        'entrada': 'entrada',
        'parcela': 'parcela',
        'cheque pre': 'cheque_pre', 'cheque-pré': 'cheque_pre', 'cheque_pre': 'cheque_pre',
        'boleto': 'boleto',
        'pix': 'pix',
        'transferencia': 'transferencia', 'transferência': 'transferencia',
        'cartao': 'cartao', 'cartão': 'cartao',
        'permuta': 'permuta'
    };
    return map[raw] || raw;
}

function normalizeCategoriaForFinanceSave(val, fallback = 'outros') {
    const key = normalizeCategoriaKey(val);
    if (!key || key === 'undefined' || key === 'null') return fallback;
    return key;
}

function normalizeTipoPagamentoForFinanceSave(val, fallback = 'pagar') {
    const key = normalizeTipoKey(val || fallback);
    if (!key || key === 'undefined' || key === 'null') return fallback;
    return key;
}

function applyContaFinanceiroTipoPagamento(conta, val, fallback = 'pagar') {
    const tipoKey = normalizeTipoPagamentoForFinanceSave(val, fallback);
    if (conta && typeof conta === 'object') {
        conta.tipo = tipoKey;
        conta.tipoPagamento = tipoKey;
        conta.tipo_pagamento = tipoKey;
    }
    return tipoKey;
}

function resolveCategoriaPadrao(conta, tipoConta) {
    const origem = String(conta && conta.origem || '').toLowerCase();
    const origemTipo = String(conta && conta.origemTipo || '').toLowerCase();
    const desc = String(conta && conta.descricao || '').toLowerCase();
    let cat = normalizeCategoriaKey(conta && conta.categoria);
    if (origem === 'folha_pagamento') {
        if (cat === 'quinzena_1' || desc.includes('1° quinzena') || desc.includes('1ª quinzena')) return 'quinzena_1';
        if (cat === 'quinzena_2' || desc.includes('2° quinzena') || desc.includes('2ª quinzena')) return 'quinzena_2';
        if (origemTipo === 'quinzena') return 'quinzena_1';
        if (origemTipo === 'mes') return desc.includes('quinzena') ? 'quinzena_2' : 'mes_fechado';
        if (desc.includes('mes fechado') || desc.includes('mês fechado')) return 'mes_fechado';
    }
    if (origem === 'vendas' || origem === 'romaneio_tl' || origem === 'romaneio_pct') return 'vendas';
    if (origem === 'compras') return 'compras';
    if (isTipoFinanceiro(cat)) {
        return tipoConta === 'receber' ? 'vendas' : 'compras';
    }
    if (!cat || cat === 'undefined') {
        return tipoConta === 'receber' ? 'vendas' : 'compras';
    }
    if (!getBaseCategoriaKeys().includes(cat)) return 'outros';
    return cat;
}

function resolveTipoPgtoPadrao(conta, tipoConta) {
    let tipo = normalizeTipoKey(conta && (conta.tipo || conta.tipoPagamento));
    if (!tipo || tipo === 'undefined') {
        return tipoConta === 'receber' ? 'receber' : 'pagar';
    }
    const allowed = new Set(getBaseTipoKeys());
    if (!allowed.has(tipo)) {
        return tipoConta === 'receber' ? 'receber' : 'pagar';
    }
    return tipo;
}

async function normalizarFinanceiroCategoriasETipos({ dryRun = false } = {}) {
    try {
        const svc = window.firebaseService;
        if (!svc || typeof svc.loadFromFirebase !== 'function') {
            mostrarNotificacao('Serviço financeiro indisponível para normalização.', 'error');
            return { success: false };
        }
        const roots = ['contasReceber', 'contasPagar'];
        const updates = {};
        const normalizeLocal = (arr, tipoConta) => {
            if (!Array.isArray(arr)) return;
            arr.forEach(conta => {
                if (!conta) return;
                const catNew = resolveCategoriaPadrao(conta, tipoConta);
                const tipoNew = resolveTipoPgtoPadrao(conta, tipoConta);
                conta.categoria = catNew;
                conta.tipo = tipoNew;
            });
        };
        normalizeLocal(window.contasReceber, 'receber');
        normalizeLocal(window.contasPagar, 'pagar');
        const applyConta = (root, conta, path) => {
            if (!conta || !conta.id) return;
            const tipoConta = root === 'contasReceber' ? 'receber' : 'pagar';
            const catNew = resolveCategoriaPadrao(conta, tipoConta);
            const tipoNew = resolveTipoPgtoPadrao(conta, tipoConta);
            if (catNew !== conta.categoria || tipoNew !== conta.tipo) {
                updates[path] = { ...conta, categoria: catNew, tipo: tipoNew };
            }
        };
        for (const root of roots) {
            const res = await svc.loadFromFirebase(root);
            const data = (res && res.success && res.data) ? res.data : null;
            if (!data) continue;
            if (Array.isArray(data)) {
                data.forEach(conta => {
                    const mk = getMonthKeyFromDateVal(conta && (conta.dataVencimento || conta.vencimento));
                    const path = `${root}/${mk}/${conta.id}`;
                    applyConta(root, conta, path);
                });
                continue;
            }
            if (typeof data === 'object') {
                Object.entries(data).forEach(([key, value]) => {
                    if (/^\d{4}-\d{2}$/.test(key) && value && typeof value === 'object') {
                        Object.entries(value).forEach(([id, conta]) => {
                            const path = `${root}/${key}/${id}`;
                            applyConta(root, conta, path);
                        });
                    } else if (value && typeof value === 'object' && (value.id || value.descricao)) {
                        const path = `${root}/${key}`;
                        applyConta(root, value, path);
                    }
                });
            }
        }
        const keys = Object.keys(updates);
        if (!keys.length) return { success: true, updated: 0 };
        if (dryRun) return { success: true, updated: keys.length };
        if (typeof svc.updatePaths === 'function') {
            expectFinanceWrite(await svc.updatePaths(updates), 'Normalização financeira', { atomic: true });
        } else if (typeof svc.saveToFirebase === 'function') {
            for (const [path, payload] of Object.entries(updates)) {
                const parts = String(path).split('/');
                const key = parts.pop();
                const base = parts.join('/');
                expectFinanceWrite(await svc.saveToFirebase(base, key, payload), 'Normalização financeira');
            }
        } else {
            mostrarNotificacao('Serviço financeiro indisponível para normalização.', 'error');
            return { success: false };
        }
        return { success: true, updated: keys.length };
    } catch (e) {
        try { mostrarNotificacao('Falha ao normalizar categorias e tipos.', 'error'); } catch(_) {}
        return { success: false, error: e };
    }
}

function getContaVencimentoISO(conta) {
    const raw = (conta && (conta.dataVencimento ?? conta.vencimento)) || '';
    return normalizeDateISOInput(raw);
}

function normalizeJurosTipoKey(value) {
    const v = String(value || '').toLowerCase().trim();
    if (v === 'simples' || v === 'juros_simples' || v === 'simple') return 'simples';
    if (v === 'composto' || v === 'juros_composto' || v === 'compound') return 'composto';
    return 'none';
}

function parseJurosTaxa(value) {
    const n = Number(String(value ?? '').replace(',', '.'));
    if (!Number.isFinite(n) || n <= 0) return 0;
    return n;
}

function computeJurosByPeriod(baseValue, taxaMensalPercent, diasAtraso, tipoJuros) {
    const base = parseCurrencyValue(baseValue || 0);
    const taxa = parseJurosTaxa(taxaMensalPercent || 0) / 100;
    const dias = Math.max(0, Number(diasAtraso) || 0);
    if (base <= 0 || taxa <= 0 || dias <= 0 || normalizeJurosTipoKey(tipoJuros) === 'none') return 0;
    const meses = dias / 30;
    if (normalizeJurosTipoKey(tipoJuros) === 'composto') return Math.max(0, base * (Math.pow(1 + taxa, meses) - 1));
    return Math.max(0, base * taxa * meses);
}

function computeContaJurosInfo(conta, referenceDate = null) {
    const tipo = normalizeJurosTipoKey(conta && conta.jurosTipo);
    const taxa = parseJurosTaxa(conta && conta.jurosTaxa);
    const status = String((conta && conta.status) || 'pendente').toLowerCase();
    const tsVenc = getContaVencimentoTimestamp(conta);
    const tsBaseJuros = normalizeDateToTimestamp(conta && conta.jurosBaseDate);
    const tsEmissao = normalizeDateToTimestamp(conta && conta.dataEmissao);
    const tsRef = referenceDate ? normalizeDateToTimestamp(referenceDate) : getTodayStartTimestampLocal();
    const tsStart = Math.max(tsVenc || 0, tsBaseJuros || 0, tsEmissao || 0);
    const diasAtraso = (tsVenc && tsRef && tsRef > tsStart) ? Math.floor((tsRef - tsStart) / 86400000) : 0;
    if (!tsVenc || !tsRef || tsRef <= tsStart || taxa <= 0 || tipo === 'none' || status === 'pago') {
        const baseNoJuros = status === 'parcial'
            ? parseCurrencyValue((conta && conta.valorRestante) ?? (conta && conta.valor) ?? 0)
            : parseCurrencyValue((conta && conta.valorOriginal) ?? (conta && conta.valor) ?? 0);
        return { tipo, taxa, diasAtraso, base: baseNoJuros, juros: 0, totalComJuros: baseNoJuros };
    }
    const base = status === 'parcial'
        ? parseCurrencyValue((conta && conta.valorRestante) ?? (conta && conta.valor) ?? 0)
        : parseCurrencyValue((conta && conta.valorOriginal) ?? (conta && conta.valor) ?? 0);
    const juros = computeJurosByPeriod(base, taxa, diasAtraso, tipo);
    const totalComJuros = base + juros;
    return { tipo, taxa, diasAtraso, base, juros, totalComJuros };
}

/**
 * ═══════════════════════════════════════════════════════════════════════════════
 * FUNÇÃO UNIFICADA DE CÁLCULO FINANCEIRO — FONTE ÚNICA DA VERDADE
 * ═══════════════════════════════════════════════════════════════════════════════
 * Usa buildContaJurosTimeline() para derivar todos os valores de uma conta,
 * garantindo que tabela, impressão e histórico exibam exatamente os mesmos números.
 *
 * Para contas SEM juros ou SEM historico: fallback para lógica simples.
 * Para contas COM pagamentos parciais + juros: usa a timeline completa.
 *
 * Retorna:
 *   valorOriginal  — valor inicial da conta (sem juros)
 *   valorPago      — total de dinheiro efetivamente pago
 *   valorRestante  — saldo atual após todos os pagamentos e juros aplicados
 *   jurosAberto    — juros do período em aberto (desde último pagamento até hoje)
 *   totalAtualizado — valorRestante + jurosAberto (valor exigível hoje)
 *   jurosAcumulado — total de juros já aplicados nos pagamentos históricos
 *   statusNorm     — status calculado (pago/parcial/pendente/vencido)
 *   diasAtraso     — dias de atraso do período aberto atual
 * ═══════════════════════════════════════════════════════════════════════════════
 */
function getContaFinanceInfo(conta) {
    if (!conta) return {
        valorOriginal: 0, valorPago: 0, valorRestante: 0,
        jurosAberto: 0, totalAtualizado: 0, jurosAcumulado: 0,
        statusNorm: 'pendente', diasAtraso: 0,
        tooltip: ''
    };

    const statusRaw = String(conta.status || 'pendente').toLowerCase();
    const tipo = normalizeJurosTipoKey(conta.jurosTipo);
    const taxa = parseJurosTaxa(conta.jurosTaxa);
    const temJuros = tipo !== 'none' && taxa > 0;
    const temHistorico = Array.isArray(conta.historicosPagamento) && conta.historicosPagamento.length > 0;

    // ─── CAMINHO 1: Conta paga sem juros complexos ───────────────────────────
    if (statusRaw === 'pago' && !temHistorico) {
        const valorOriginal = parseCurrencyValue(conta.valorOriginal ?? conta.valor ?? 0);
        return {
            valorOriginal,
            valorPago: valorOriginal,
            valorRestante: 0,
            jurosAberto: 0,
            totalAtualizado: 0,
            jurosAcumulado: 0,
            statusNorm: 'pago',
            diasAtraso: 0,
            tooltip: 'title="Conta paga"'
        };
    }

    // ─── CAMINHO 2: Conta com histórico de pagamentos (usa timeline completa) ─
    if (temHistorico || (temJuros && statusRaw === 'parcial')) {
        const timeline = buildContaJurosTimeline(conta);
        const valorOriginal = timeline.valorInicialCents / 100;
        const valorPago = timeline.rows.reduce((s, r) => s + r.pagamentoCents, 0) / 100;
        const valorRestante = Math.max(0, timeline.saldoFinalCents / 100);
        const jurosAcumulado = timeline.totalJurosCents / 100;

        // Juros do período em aberto (desde último pagamento até hoje)
        const openPeriod = getOpenJurosPeriod(conta, timeline);
        const jurosAberto = (temJuros && valorRestante > 0)
            ? computeJurosByPeriod(valorRestante, taxa, openPeriod.dias, tipo)
            : 0;
        const totalAtualizado = valorRestante + jurosAberto;

        // Status calculado com precisão de centavo
        const restanteCents = Math.round(valorRestante * 100);
        let statusNorm = statusRaw;
        if (restanteCents <= 1) {
            statusNorm = 'pago';
        } else if (valorPago > 0) {
            statusNorm = 'parcial';
        } else if (statusNorm === 'pendente') {
            const tsVenc = getContaVencimentoTimestamp(conta);
            if (tsVenc && tsVenc < getTodayStartTimestampLocal()) statusNorm = 'vencido';
        }

        const tipoLabel = tipo === 'composto' ? 'Composto' : (tipo === 'simples' ? 'Simples' : 'Sem juros');
        const tooltip = `title="Tipo: ${tipoLabel} | Taxa: ${taxa.toFixed(2)}% | Dias atraso: ${openPeriod.dias} | Juros período aberto: ${formatCurrency(jurosAberto)} | Juros acumulado histórico: ${formatCurrency(jurosAcumulado)}"`;

        return {
            valorOriginal,
            valorPago,
            valorRestante,
            jurosAberto,
            totalAtualizado,
            jurosAcumulado,
            statusNorm,
            diasAtraso: openPeriod.dias,
            tooltip
        };
    }

    // ─── CAMINHO 3: Conta simples (pendente/parcial sem histórico) ───────────
    const valorOriginal = parseCurrencyValue(conta.valorOriginal ?? conta.valor ?? 0);
    const valorPago = parseCurrencyValue(conta.valorPago ?? 0);
    const valorRestante = statusRaw === 'parcial'
        ? parseCurrencyValue(conta.valorRestante ?? Math.max(0, valorOriginal - valorPago))
        : valorOriginal;

    const tsVenc = getContaVencimentoTimestamp(conta);
    const tsBaseJuros = normalizeDateToTimestamp(conta.jurosBaseDate);
    const tsEmissao = normalizeDateToTimestamp(conta && conta.dataEmissao);
    const tsHoje = getTodayStartTimestampLocal();

    // ✅ Juros MORA + CONTRATUAIS: projeta o cálculo até hoje se estiver vencida
    const tsInicio = Math.max(tsBaseJuros || 0, tsEmissao || 0) || tsVenc || tsHoje;
    const tsFim = (tsVenc && tsHoje > tsVenc) ? tsHoje : (tsVenc || tsHoje);
    const diasTotalCalculo = (tsFim > tsInicio) ? Math.floor((tsFim - tsInicio) / 86400000) : 0;
    const diasContrato = diasTotalCalculo;
    const jurosAberto = (temJuros && valorRestante > 0 && diasTotalCalculo > 0)
        ? computeJurosByPeriod(valorRestante, taxa, diasTotalCalculo, tipo)
        : 0;
    const totalAtualizado = valorRestante + jurosAberto;
    const diasAtraso = (tsVenc && tsHoje > tsVenc) ? Math.floor((tsHoje - tsVenc) / 86400000) : 0;

    let statusNorm = statusRaw;
    if (statusNorm === 'pendente' && tsVenc && tsVenc < tsHoje) statusNorm = 'vencido';

    const tipoLabel = tipo === 'composto' ? 'Composto' : (tipo === 'simples' ? 'Simples' : 'Sem juros');
    const tooltip = `title="Tipo: ${tipoLabel} | Taxa: ${taxa.toFixed(2)}% | Dias contrato: ${diasContrato} | Juros: ${formatCurrency(jurosAberto)}"`;

    return {
        valorOriginal,
        valorPago,
        valorRestante,
        jurosAberto,
        totalAtualizado,
        jurosAcumulado: 0,
        statusNorm,
        diasAtraso,
        tooltip
    };
}

function getContaJurosDisplay(conta) {
    // ✅ Wrapper sobre getContaFinanceInfo para manter compatibilidade com tabela e impressão
    const info = getContaFinanceInfo(conta);
    const base = info.statusNorm === 'parcial' ? info.valorRestante
               : (info.statusNorm === 'pago'   ? 0
               :  info.valorOriginal);
    return {
        totalComJuros: info.totalAtualizado > 0 ? info.totalAtualizado : base,
        juros: info.jurosAberto + info.jurosAcumulado,
        diasAtraso: info.diasAtraso,
        tooltip: info.tooltip
    };
}

function buildContaJurosTimeline(conta) {
    const toCents = (v) => {
        const n = typeof v === 'number' ? v : parseCurrencyValue(v);
        if (!isFinite(n) || isNaN(n)) return 0;
        return Math.round(n * 100);
    };
    const valorInicialCents = toCents(parseCurrencyValue(conta && (conta.valorOriginal ?? conta.valor) || 0));
    const tipo = normalizeJurosTipoKey(conta && conta.jurosTipo);
    const taxa = parseJurosTaxa(conta && conta.jurosTaxa);
    const tsVenc = getContaVencimentoTimestamp(conta);
    const tsBaseJuros = normalizeDateToTimestamp(conta && conta.jurosBaseDate);
    const tsEmissao = normalizeDateToTimestamp(conta && conta.dataEmissao);
    const historicosRaw = Array.isArray(conta && conta.historicosPagamento) ? conta.historicosPagamento : [];
    const historicos = historicosRaw
        .map((h, idx) => ({ ...h, __idx: idx, __ts: normalizeDateToTimestamp(h && h.data) || 0 }))
        .sort((a, b) => (a.__ts - b.__ts) || (a.__idx - b.__idx));
    let saldoCents = valorInicialCents;
    let tsBase = tsVenc || tsEmissao || null;
    let totalJurosCents = 0;
    const rows = [];
    historicos.forEach((h) => {
        const pagamentoCents = Math.max(0, toCents(h && h.valor));
        const tsPg = normalizeDateToTimestamp(h && h.data) || tsBase || tsVenc || getTodayStartTimestampLocal();
        const tsStart = Math.max(tsVenc || 0, tsBase || 0, tsEmissao || 0) || tsPg;
        const dias = Math.max(0, Math.floor((tsPg - tsStart) / 86400000));
        let jurosCents = 0;
        if (tipo !== 'none' && taxa > 0 && saldoCents > 0 && dias > 0) {
            jurosCents = Math.round(computeJurosByPeriod(saldoCents / 100, taxa, dias, tipo) * 100);
        } else if (Number.isFinite(Number(h && h.jurosAplicado)) && Number(h.jurosAplicado) > 0) {
            jurosCents = toCents(Number(h.jurosAplicado));
        }
        const saldoAntesCents = Math.max(0, saldoCents + jurosCents);
        const pagoAplicadoCents = Math.min(saldoAntesCents, pagamentoCents);
        const saldoDepoisCents = Math.max(0, saldoAntesCents - pagoAplicadoCents);
        totalJurosCents += jurosCents;
        rows.push({
            data: h && h.data,
            metodo: h && h.metodo,
            observacoes: h && h.observacoes,
            comprovanteUrl: h && h.comprovanteUrl,
            comprovanteStoragePath: h && h.comprovanteStoragePath,
            pagamentoCents: pagoAplicadoCents,
            jurosCents,
            saldoAntesCents,
            saldoDepoisCents,
            diasAtraso: dias,
            originalRef: h
        });
        saldoCents = saldoDepoisCents;
        tsBase = tsPg;
    });
    return {
        tipo,
        taxa,
        valorInicialCents,
        totalJurosCents,
        saldoFinalCents: saldoCents,
        lastPaymentTimestamp: tsBase || null,
        rows
    };
}

function getOpenJurosPeriod(conta, timeline) {
    const tsVenc = getContaVencimentoTimestamp(conta) || 0;
    const tsEmissao = normalizeDateToTimestamp(conta && conta.dataEmissao) || 0;
    const tsLast = (timeline && timeline.lastPaymentTimestamp) ? timeline.lastPaymentTimestamp : 0;
    const tsStart = Math.max(tsVenc, tsLast, tsEmissao) || getTodayStartTimestampLocal();
    const tsEnd = getTodayStartTimestampLocal();
    const dias = Math.max(0, Math.floor((tsEnd - tsStart) / 86400000));
    return { tsStart, tsEnd, dias };
}

function formatDate(dateValue) {
    if (dateValue === undefined || dateValue === null) return '';
    if (typeof dateValue === 'number') {
        const d = new Date(dateValue);
        const dd = String(d.getDate()).padStart(2, '0');
        const mm = String(d.getMonth() + 1).padStart(2, '0');
        const yy = d.getFullYear();
        return `${dd}/${mm}/${yy}`;
    }
    const s = String(dateValue).trim();
    // YYYY-MM-DD (interpretar como data local, sem UTC)
    if (/^\d{4}-\d{2}-\d{2}$/.test(s)) {
        const [y, m, d] = s.split('-').map(Number);
        const dd = String(d).padStart(2, '0');
        const mm = String(m).padStart(2, '0');
        return `${dd}/${mm}/${y}`;
    }
    // DD/MM/YYYY
    if (/^\d{2}\/\d{2}\/\d{4}$/.test(s)) {
        return s;
    }
    // Fallback genérico
    const d = parseDateLocalSafe(s);
    return isNaN(d.getTime()) ? '-' : d.toLocaleDateString('pt-BR');
}

// ✅ NORMALIZAÇÃO DE DATAS PARA COMPARAÇÃO (UTC — alinhado com backend)
function normalizeDateToTimestamp(value) {
    if (!value && value !== 0) return null;
    if (typeof value === 'number') {
        return value;
    }
    if (typeof value === 'string') {
        const v = value.trim();
        if (/^\d{4}-\d{2}-\d{2}$/.test(v)) {
            const [y, m, d] = v.split('-').map(Number);
            const t = Date.UTC(y, m - 1, d);
            return isNaN(t) ? null : t;
        }
        if (/^\d{2}\/\d{2}\/\d{4}$/.test(v)) {
            const [d, m, y] = v.split('/');
            const t = Date.UTC(Number(y), Number(m) - 1, Number(d));
            return isNaN(t) ? null : t;
        }
        const t = new Date(v).getTime();
        return isNaN(t) ? null : t;
    }
    const t = new Date(value).getTime();
    return isNaN(t) ? null : t;
}

// ✅ Timestamp de vencimento aceitando `dataVencimento` ou `vencimento`
function getContaVencimentoTimestamp(conta) {
    const raw = (conta && (conta.dataVencimento ?? conta.vencimento)) || null;
    return normalizeDateToTimestamp(raw);
}

function generateUniqueId(prefix = '') {
    const timestamp = new Date().getTime();
    const random = Math.floor(Math.random() * 10000);
    return `${prefix}${timestamp}${random}`;
}

async function getNextManualNumero() {
    const result = await callFinanceCallable('financeNextSequence', {
        sequence: 'contasReceberManual',
        operationId: createFinanceOperationId('sequence_rx')
    });
    if (!/^RX\d{6,}$/.test(String(result.numero || ''))) throw new Error('Sequência RX inválida retornada pelo servidor.');
    return String(result.numero);
}

async function getNextManualNumeroPagar() {
    const result = await callFinanceCallable('financeNextSequence', {
        sequence: 'contasPagarManual',
        operationId: createFinanceOperationId('sequence_px')
    });
    if (!/^PX\d{6,}$/.test(String(result.numero || ''))) throw new Error('Sequência PX inválida retornada pelo servidor.');
    return String(result.numero);
}

async function prepareNumeroPagar() {
    try {
        const input = document.getElementById('pagarNumero');
        if (!input) return;
        const ed = window.contaEmEdicao && window.contaEmEdicao.tipo === 'pagar' ? window.contaEmEdicao.contaOriginal : null;
        if (ed) {
            const numero = ed.numero || ed.documento || '';
            input.value = numero;
            input.readOnly = true;
            return;
        }
        // ✅ PADRONIZAÇÃO: Comportamento igual ao Receber (geração no salvamento)
        input.value = 'Gerado automaticamente...';
        input.readOnly = true;
        input.dataset.auto = 'true';
    } catch(_) {}
}

// ✅ CORREÇÃO: Funções de armazenamento usando Firebase diretamente
async function getData(key) {
    try {
        // ✅ CORREÇÃO: Usar Firebase diretamente se disponível
        if (window.database) {
            try {
                const { ref, get } = await import('https://www.gstatic.com/firebasejs/10.7.1/firebase-database.js');
                const dataRef = ref(window.database, key);
                const snapshot = await get(dataRef);
                
                if (snapshot.exists()) {
                    const data = snapshot.val();
                    return Array.isArray(data) ? data : Object.values(data || {});
                }
            } catch (firebaseError) {
                console.warn(`⚠️ Erro ao carregar ${key} do Firebase:`, firebaseError);
            }
        }
        
        // Fallback para localStorage
        const data = localStorage.getItem(key);
        return data ? JSON.parse(data) : null;
    } catch (error) {
        console.error(`❌ Erro ao recuperar dados de '${key}':`, error);
        return null;
    }
}

async function saveData(key, data) {
    try {
        // Normalizar categorias antes de salvar coleções financeiras
        if ((key === 'contasReceber' || key === 'contasPagar') && Array.isArray(data)) {
            try {
                data = data.map(c => ({ ...c, categoria: normalizeCategoriaKey(c && c.categoria) }));
            } catch (_) {}
        }
        // ✅ Sanitizar dados para evitar 'undefined' (Firebase não permite)
        const sanitize = (val) => {
            if (val === undefined) return null;
            if (val === null) return null;
            if (Array.isArray(val)) return val.map(sanitize);
            if (typeof val === 'object') {
                const out = {};
                for (const k in val) {
                    if (!Object.prototype.hasOwnProperty.call(val, k)) continue;
                    const v = val[k];
                    out[k] = sanitize(v);
                }
                return out;
            }
            return val;
        };
        const safeData = sanitize(data);
        // Produção: não salvar agregados financeiros em localStorage
        if (key !== 'contasReceber' && key !== 'contasPagar') {
            localStorage.setItem(key, JSON.stringify(safeData));
        }
        
        // Em produção não gravar agregados 'contasReceber' e 'contasPagar' no RTDB
        if (key !== 'contasReceber' && key !== 'contasPagar') {
            if (window.database && window.firebaseRef && window.firebaseSet) {
                try {
                    const dataRef = window.firebaseRef(window.database, key);
                    await window.firebaseSet(dataRef, safeData);
                } catch (firebaseError) {
                    console.warn(`⚠️ Erro ao salvar ${key} no Firebase:`, firebaseError);
                }
            } else {
                console.warn(`⚠️ Firebase não disponível para salvar ${key}`);
            }
        }
        
        return true;
    } catch (error) {
        console.error(`❌ Erro ao salvar dados em '${key}':`, error);
        return false;
    }
}

// Expor funções globalmente
window.showTab = showTab;
window.gerarParcelas = gerarParcelas;
window.removerParcela = removerParcela;
window.filtrarContas = filtrarContas;
window.imprimirHistoricoConta = imprimirHistoricoConta;
window.abrirModalPagamento = abrirModalPagamento;
window.verHistoricoPagamentos = verHistoricoPagamentos;
window.editarConta = editarConta;
window.excluirConta = excluirConta;
window.anexarArquivoConta = anexarArquivoConta;
window.abrirModalAnexos = abrirModalAnexos;
window.anexarArquivoContaPeloModal = anexarArquivoContaPeloModal;
window.substituirAnexoConta = substituirAnexoConta;
window.removerAnexoConta = removerAnexoConta;
window.onManualAttachmentSelected = onManualAttachmentSelected;
window.handleManualAttachmentAction = handleManualAttachmentAction;
window.onParcelaAttachmentSelected = onParcelaAttachmentSelected;
window.handleParcelaAttachmentAction = handleParcelaAttachmentAction;
window.onParcelaValorChange = onParcelaValorChange;
window.anexarComprovanteHistorico = anexarComprovanteHistorico;
window.excluirComprovanteHistorico = excluirComprovanteHistorico;
window.mudarPaginaReceber = mudarPaginaReceber;
window.mudarPaginaPagar = mudarPaginaPagar;
window.excluirPagamento = excluirPagamento;
window.reativarBotaoRomaneio = reativarBotaoRomaneio;
window.limparDadosInvalidos = limparDadosInvalidos;

    window.gerarFluxoCaixa = gerarFluxoCaixa;
    window.gerarRelatorio = gerarRelatorio;
    window.imprimirRelatorioAtual = imprimirRelatorioAtual;
    window.limparFormulario = limparFormulario;
window.fecharModal = fecharModal;
window.exportarDados = exportarDados;
window.exportarTabela = exportarTabela;
window.fazerBackup = fazerBackup;
window.restaurarBackup = restaurarBackup;
window.limparTodosDados = limparTodosDados;
// ==============================
// Helpers de Data (ISO local)
// ==============================
function formatISODateLocal(dateObj) {
    try {
        const y = dateObj.getFullYear();
        const m = String(dateObj.getMonth() + 1).padStart(2, '0');
        const d = String(dateObj.getDate()).padStart(2, '0');
        return `${y}-${m}-${d}`;
    } catch {
        return '';
    }
}

function parseDateLocalSafe(str) {
    if (window.parseDateLocal) return window.parseDateLocal(str);
    if (!str) return null;
    if (str instanceof Date) return str;
    let s = String(str).trim();
    const m1 = s.match(/^(\d{4})-(\d{2})-(\d{2})/);
    if (m1) return new Date(parseInt(m1[1],10), parseInt(m1[2],10)-1, parseInt(m1[3],10));
    return new Date(s);
}

function formatISODateUTC(dateObj) {
    try {
        const y = dateObj.getUTCFullYear();
        const m = String(dateObj.getUTCMonth() + 1).padStart(2, '0');
        const d = String(dateObj.getUTCDate()).padStart(2, '0');
        return `${y}-${m}-${d}`;
    } catch {
        return '';
    }
}

function normalizeDateISOInput(raw) {
    if (!raw && raw !== 0) return '';
    // Já no formato YYYY-MM-DD
    if (typeof raw === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(raw)) return raw;
    // Formato brasileiro DD/MM/YYYY
    if (typeof raw === 'string' && /^\d{2}\/\d{2}\/\d{4}$/.test(raw)) {
        const [d, m, y] = raw.split('/').map(Number);
        return `${y}-${String(m).padStart(2,'0')}-${String(d).padStart(2,'0')}`;
    }
    // Timestamp numérico ou string numérica
    const num = Number(raw);
    if (Number.isFinite(num)) {
        const dt = new Date(num);
        // ✅ Usar componentes LOCAIS para manter consistência com a exibição (tabela usa toLocaleDateString)
        return formatISODateLocal(dt);
    }
    // Fallback tentando construir Date a partir da string
    const dt = new Date(String(raw));
    if (!isNaN(dt.getTime())) return formatISODateLocal(dt);
    return '';
}
// Toast queue to avoid overlapping
(function(){
    const queue = [];
    let showing = false;
    function next(){
        if (showing) return;
        const item = queue.shift();
        if (!item) return;
        showing = true;
        try {
            if (window.ToastManager && typeof window.ToastManager[item.type] === 'function') {
                window.ToastManager[item.type](item.msg, item.title || '', item.duration);
            } else if (typeof window.mostrarNotificacaoOriginal === 'function') {
                window.mostrarNotificacaoOriginal(item.msg, item.type);
            }
        } catch (_) {}
        setTimeout(() => { showing = false; next(); }, item.duration || 4000);
    }
    function enqueue(msg, type = 'success', duration){
        queue.push({ msg, type, duration: duration || (type==='error'?6000 : type==='warning'?4500 : 3000) });
        next();
    }
    // Patch global notification functions
    if (window.mostrarNotificacao && !window.mostrarNotificacaoOriginal) {
        window.mostrarNotificacaoOriginal = window.mostrarNotificacao;
        window.mostrarNotificacao = function(msg, type){ enqueue(msg, type); };
    }
    if (window.ToastManager) {
        ['success','warning','error','info'].forEach(fn => {
            const orig = window.ToastManager[fn];
            window.ToastManager[fn] = function(msg, title, duration){ enqueue(msg, fn, duration); };
            window.ToastManager[fn].original = orig;
        });
    }
    window.financeNotify = enqueue;
})();

function atualizarSelectCategorias() {
    try {
        const selectRec = document.getElementById('filtroReceberCategoria');
        const selectPag = document.getElementById('filtroPagarCategoria');
        const uniqKeys = (arr) => Array.from(new Map(arr.map(x => [normalizeCategoriaKey(x), x])).keys());
        const baseKeys = getBaseCategoriaKeys();
        if (selectRec) {
            const catsRecKeys = uniqKeys([...baseKeys, ...((contasReceber || []).map(c => c && c.categoria).filter(Boolean))])
                .filter(k => String(k || '').trim() !== '')
                .sort((a,b)=>String(getCategoriaLabel(a)).localeCompare(String(getCategoriaLabel(b)),'pt-BR',{sensitivity:'base'}));
            replaceFinanceSelectOptions(
                selectRec,
                'Todas',
                catsRecKeys.map((key) => ({ value: key, label: getCategoriaLabel(key) })),
            );
        }
        if (selectPag) {
            const catsPagKeys = uniqKeys([...baseKeys, ...((contasPagar || []).map(c => c && c.categoria).filter(Boolean))])
                .filter(k => String(k || '').trim() !== '')
                .sort((a,b)=>String(getCategoriaLabel(a)).localeCompare(String(getCategoriaLabel(b)),'pt-BR',{sensitivity:'base'}));
            replaceFinanceSelectOptions(
                selectPag,
                'Todas',
                catsPagKeys.map((key) => ({ value: key, label: getCategoriaLabel(key) })),
            );
        }
    } catch (e) { console.warn('Falha ao atualizar categorias:', e); }
}

function atualizarSelectTipos() {
    try {
        const selectRec = document.getElementById('filtroReceberTipo');
        const selectPag = document.getElementById('filtroPagarTipo');
        const uniqKeys = (arr) => Array.from(new Map(arr.map(x => [normalizeTipoKey(x), normalizeTipoKey(x)])).keys());
        const baseKeys = getBaseTipoKeys();
        // Receber: aplicar período atual (se definido)
        if (selectRec) {
            const inicioVal = document.getElementById('filtroReceberDataInicio')?.value || '';
            const fimVal = document.getElementById('filtroReceberDataFim')?.value || '';
            const inicioTs = normalizeDateToTimestamp(inicioVal);
            const fimTs = normalizeDateToTimestamp(fimVal);
            const inRangeRec = (contasReceber || []).filter(c => {
                const ts = getContaVencimentoTimestamp(c);
                if (inicioTs && ts !== null && ts < inicioTs) return false;
                if (fimTs && ts !== null && ts > fimTs) return false;
                return true;
            });
            const tiposRecKeys = uniqKeys([...baseKeys, ...(inRangeRec.map(c => resolveFinanceTipoOperacional(c)).filter(Boolean))])
                .filter(k => String(k || '').trim() !== '')
                .sort((a,b)=>String(getTipoLabel(a)).localeCompare(String(getTipoLabel(b)),'pt-BR',{sensitivity:'base'}));
            replaceFinanceSelectOptions(
                selectRec,
                'Todos',
                tiposRecKeys.map((key) => ({ value: key, label: getTipoLabel(key) })),
            );
        }
        // Pagar: aplicar período atual (se definido)
        if (selectPag) {
            const inicioVal = document.getElementById('filtroPagarDataInicio')?.value || '';
            const fimVal = document.getElementById('filtroPagarDataFim')?.value || '';
            const inicioTs = normalizeDateToTimestamp(inicioVal);
            const fimTs = normalizeDateToTimestamp(fimVal);
            const inRangePag = (contasPagar || []).filter(c => {
                const ts = getContaVencimentoTimestamp(c);
                if (inicioTs && ts !== null && ts < inicioTs) return false;
                if (fimTs && ts !== null && ts > fimTs) return false;
                return true;
            });
            const tiposPagKeys = uniqKeys([...baseKeys, ...(inRangePag.map(c => resolveFinanceTipoOperacional(c)).filter(Boolean))])
                .filter(k => String(k || '').trim() !== '')
                .sort((a,b)=>String(getTipoLabel(a)).localeCompare(String(getTipoLabel(b)),'pt-BR',{sensitivity:'base'}));
            replaceFinanceSelectOptions(
                selectPag,
                'Todos',
                tiposPagKeys.map((key) => ({ value: key, label: getTipoLabel(key) })),
            );
        }
    } catch (e) { console.warn('Falha ao atualizar tipos:', e); }
}
function renderRowsChunked(tbody, rowsHtml, chunkSize = 300) {
    try {
        tbody.innerHTML = '';
        let i = 0;
        function appendChunk() {
            const end = Math.min(i + chunkSize, rowsHtml.length);
            const frag = rowsHtml.slice(i, end).join('');
            if (frag) tbody.insertAdjacentHTML('beforeend', frag);
            i = end;
            if (i < rowsHtml.length) setTimeout(appendChunk, 0);
        }
        appendChunk();
    } catch(_) {
        try { tbody.innerHTML = rowsHtml.join(''); } catch(__) {}
    }
}

async function abrirBoletoPixLamina(contaId, tipo) {
    try {
        const tipoConta = String(tipo || '').toLowerCase();
        if (tipoConta !== 'receber') {
            throw new Error('A Lâmina de Cobrança PIX é exclusiva para contas a receber.');
        }
        mostrarLoading(true, 'Gerando Lâmina de Cobrança PIX...');
        const lista = typeof contasReceber !== 'undefined' ? contasReceber : (window.contasReceber || []);
        const conta = lista.find(c => String(c.id) === String(contaId));
        if (!conta) {
            throw new Error('Conta não encontrada.');
        }

        const empresa = await prepareFinanceReportCompany();

        const validPix = window.PixBrCode.validateCompanyPix(empresa);
        if (!validPix.valid) {
            mostrarNotificacao('Complete os dados PIX da Empresa em Cadastro > Empresa antes de gerar a lâmina.', 'warning');
            mostrarLoading(false);
            return;
        }

        // Tentar obter dados do cliente/fornecedor (sacado)
        let sacado = null;
        const sacadoId = getFinanceSacadoReferenceId(conta);
        if (sacadoId && window.firebaseService && typeof window.firebaseService.loadFromFirebase === 'function') {
            const path = `clients/${sacadoId}`;
            try {
                const res = await window.firebaseService.loadFromFirebase(path);
                if (res && res.success) {
                    sacado = res.data;
                }
            } catch (_) {}
        }

        // Busca local fallback no array de clientes/fornecedores carregados na página
        if (!sacado) {
            const cObj = conta.cliente;
            if (cObj && typeof cObj === 'object') {
                sacado = {
                    nome: cObj.nome || cObj.name || cObj.nomeCompleto || cObj.razaoSocial,
                    cnpj: cObj.cnpj || cObj.cpf || cObj.cnpjCpf || cObj.documento,
                    documento: cObj.documento || cObj.cnpj || cObj.cpf,
                    endereco: cObj.endereco || cObj.address
                };
            } else {
                const searchName = String(cObj || sacadoId || conta.clienteNome || conta.fornecedorNome || '');
                if (typeof clientes !== 'undefined' && Array.isArray(clientes)) {
                    sacado = clientes.find(c => String(c.id) === String(sacadoId) || (c.nome || c.name || c.nomeCompleto || '').toLowerCase() === searchName.toLowerCase());
                }
                
                if (!sacado && searchName) {
                    sacado = {
                        nome: searchName,
                        documento: conta.clienteDocumento || conta.documento || conta.cpfCnpj || conta.cnpjCpf
                    };
                }
            }
        }

        const financeInfo = typeof getContaFinanceInfo === 'function' ? getContaFinanceInfo(conta) : null;

        await window.CommerceBoletoPixPdf.abrirLaminaPix({
            conta,
            empresa,
            pixProfile: empresa,
            sacado,
            financeInfo
        });
        
        mostrarLoading(false);
    } catch (err) {
        console.error('Erro ao gerar lâmina PIX:', err);
        mostrarNotificacao('Erro ao gerar Lâmina PIX: ' + err.message, 'error');
        mostrarLoading(false);
    }
}
