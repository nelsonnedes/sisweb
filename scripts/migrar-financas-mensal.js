const consoleEl = document.getElementById('console');
const statusEl = document.getElementById('status');
const btnDryRun = document.getElementById('btnDryRun');
const btnMigrar = document.getElementById('btnMigrar');
const btnLimpar = document.getElementById('btnLimpar');
const toggleReceber = document.getElementById('toggleReceber');
const togglePagar = document.getElementById('togglePagar');

function log(message) {
    const timestamp = new Date().toLocaleTimeString('pt-BR');
    consoleEl.textContent += `[${timestamp}] ${message}\n`;
    consoleEl.scrollTop = consoleEl.scrollHeight;
}

const originalLog = console.log;
const originalWarn = console.warn;
const originalError = console.error;

console.log = function (...args) {
    originalLog.apply(console, args);
    log(args.join(' '));
};

console.warn = function (...args) {
    originalWarn.apply(console, args);
    log('⚠️ ' + args.join(' '));
};

console.error = function (...args) {
    originalError.apply(console, args);
    log('❌ ' + args.join(' '));
};

function setStatus(type, text) {
    statusEl.className = `status ${type}`;
    statusEl.textContent = text;
}

function readOptions() {
    return {
        includeReceber: !!toggleReceber.checked,
        includePagar: !!togglePagar.checked,
        batchSize: 150
    };
}

async function ensureMigrationFn() {
    if (typeof window.migrarFinanceiroLegado !== 'function') {
        throw new Error('Função migrarFinanceiroLegado não encontrada. Confirme que firebaseService.js foi carregado.');
    }
    if (!window.firebaseService || typeof window.firebaseService.getTenantId !== 'function') {
        throw new Error('firebaseService não disponível.');
    }
    const tenant = window.firebaseService.getTenantId();
    if (!tenant) {
        throw new Error('Tenant não detectado. Faça login e selecione a empresa.');
    }
    return tenant;
}

window.executarDryRun = async function executarDryRun() {
    btnDryRun.disabled = true;
    btnMigrar.disabled = true;
    btnLimpar.disabled = true;
    consoleEl.textContent = '';
    setStatus('running', '🔍 Executando dry-run (sem gravar)...');

    try {
        const tenant = await ensureMigrationFn();
        console.log(`🏢 Empresa (tenant): ${tenant}`);
        const options = readOptions();
        const res = await window.migrarFinanceiroLegado({
            ...options,
            dryRun: true,
            deleteOld: false
        });
        console.log('📊 Resultado (dry-run):', JSON.stringify(res, null, 2));
        setStatus('success', '✅ Dry-run concluído.');
        btnMigrar.disabled = false;
        btnLimpar.disabled = false;
    } catch (e) {
        setStatus('error', '❌ Falha no dry-run.');
        console.error(e && e.message ? e.message : e);
    } finally {
        btnDryRun.disabled = false;
    }
};

window.executarMigracao = async function executarMigracao() {
    if (!confirm('Confirmar migração? Isso vai CRIAR registros em financas/* (não apaga o legado).')) return;
    btnDryRun.disabled = true;
    btnMigrar.disabled = true;
    btnLimpar.disabled = true;
    consoleEl.textContent = '';
    setStatus('running', '🚀 Migrando (sem apagar legado)...');

    try {
        const tenant = await ensureMigrationFn();
        console.log(`🏢 Empresa (tenant): ${tenant}`);
        const options = readOptions();
        const res = await window.migrarFinanceiroLegado({
            ...options,
            dryRun: false,
            deleteOld: false
        });
        console.log('📊 Resultado (migração):', JSON.stringify(res, null, 2));
        if (res && res.success === false) {
            setStatus('error', '❌ Migração finalizada com erro.');
        } else {
            setStatus('success', '✅ Migração concluída. Agora valide no Financeiro.');
        }
        btnDryRun.disabled = false;
        btnLimpar.disabled = false;
    } catch (e) {
        setStatus('error', '❌ Falha na migração.');
        console.error(e && e.message ? e.message : e);
        btnDryRun.disabled = false;
    }
};

window.executarLimpezaLegado = async function executarLimpezaLegado() {
    const msg = 'Confirmar limpeza do legado? Isso REMOVE registros antigos em contasReceber/contasPagar que já foram migrados (sem conflitos).';
    if (!confirm(msg)) return;
    btnDryRun.disabled = true;
    btnMigrar.disabled = true;
    btnLimpar.disabled = true;
    consoleEl.textContent = '';
    setStatus('running', '🗑️ Limpando legado...');

    try {
        const tenant = await ensureMigrationFn();
        console.log(`🏢 Empresa (tenant): ${tenant}`);
        const options = readOptions();
        const res = await window.migrarFinanceiroLegado({
            ...options,
            dryRun: false,
            deleteOld: true
        });
        console.log('📊 Resultado (limpeza):', JSON.stringify(res, null, 2));
        if (res && res.success === false) {
            setStatus('error', '❌ Limpeza finalizada com erro.');
        } else {
            setStatus('success', '✅ Limpeza concluída.');
        }
    } catch (e) {
        setStatus('error', '❌ Falha na limpeza.');
        console.error(e && e.message ? e.message : e);
    } finally {
        btnDryRun.disabled = false;
        btnMigrar.disabled = false;
        btnLimpar.disabled = false;
    }
};

