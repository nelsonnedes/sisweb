'use strict';

const crypto = require('crypto');
const admin = require('firebase-admin');
const functionsV1 = require('firebase-functions/v1');

const ACTIVE_SUBSCRIPTIONS = new Set(['active', 'trial_active']);
const ACCOUNT_TYPES = new Set(['receber', 'pagar']);
const FINANCE_STATUSES = new Set(['pendente', 'parcial', 'pago', 'vencido']);
const INACTIVE_STATUSES = new Set([
    'inactive',
    'inativo',
    'blocked',
    'bloqueado',
    'disabled',
    'suspended',
]);
const FINANCIAL_PATCH_FIELDS = new Set([
    'historicosPagamento',
    'valorPago',
    'valorRestante',
    'status',
    'dataPagamento',
    'metodoPagamento',
    'observacoesPagamento',
    'comprovanteUrl',
    'comprovanteStoragePath',
    'jurosBaseDate',
]);
const HISTORY_FIELDS = new Set([
    'data',
    'valor',
    'metodo',
    'observacoes',
    'comprovanteUrl',
    'comprovanteStoragePath',
    'jurosAplicado',
    'diasAtraso',
    'jurosTipoAplicado',
    'jurosTaxaAplicada',
    'operationId',
]);
const REQUIRED_PATCH_FIELDS = [
    'historicosPagamento',
    'valorPago',
    'valorRestante',
    'status',
];
const MAX_HISTORY_ITEMS = 5000;
const INTERNAL_OPERATIONS_FIELD = '_financeOperations';
const MAX_ACCOUNT_OPERATION_RECORDS = 128;
const MAX_SEQUENCE_OPERATION_RECORDS = 256;
const MAX_CREATE_ACCOUNTS = 120;
const FINANCE_ROLES = new Set(['owner', 'admin', 'company_admin', 'finance', 'financial', 'financeiro']);
const EDITABLE_ACCOUNT_FIELDS = new Set([
    'id',
    'cliente',
    'clienteId',
    'fornecedor',
    'fornecedorId',
    'funcionarioNome',
    'descricao',
    'valor',
    'valorOriginal',
    'dataVencimento',
    'vencimento',
    'categoria',
    'tipo',
    'tipoPagamento',
    'formaPagamento',
    'jurosTipo',
    'jurosTaxa',
    'observacoes',
    'parcela',
    'totalParcelas',
    'valorTotal',
    'anexos',
]);
const CREATABLE_MANUAL_ACCOUNT_FIELDS = new Set([
    'id',
    'cliente',
    'clienteId',
    'fornecedor',
    'fornecedorId',
    'descricao',
    'valor',
    'valorOriginal',
    'valorRestante',
    'dataVencimento',
    'vencimento',
    'status',
    'categoria',
    'tipo',
    'tipoPagamento',
    'tipo_pagamento',
    'formaPagamento',
    'jurosTipo',
    'jurosTaxa',
    'jurosBaseDate',
    'observacoes',
    'parcela',
    'totalParcelas',
    'valorTotal',
    'anexos',
    'anexoUrl',
    'origem',
    'numero',
    'created',
]);

let configuredSuperAdminResolver = async () => false;

class FinanceValidationError extends Error {
    constructor(message, reason = 'validation') {
        super(message);
        this.name = 'FinanceValidationError';
        this.reason = reason;
    }
}

function isPlainObject(value) {
    if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
    const prototype = Object.getPrototypeOf(value);
    return prototype === Object.prototype || prototype === null;
}

function hasOwn(source, key) {
    return Object.prototype.hasOwnProperty.call(source, key);
}

function normalizePathSegment(value, label) {
    const normalized = String(value === undefined || value === null ? '' : value).trim();
    if (!normalized) {
        throw new FinanceValidationError(`${label} é obrigatório.`);
    }
    if (normalized.length > 160 || /[.#$\[\]/\u0000-\u001f\u007f]/.test(normalized)) {
        throw new FinanceValidationError(`${label} é inválido.`);
    }
    return normalized;
}

function normalizeOperationId(value) {
    const operationId = String(value || '').trim();
    if (!/^[A-Za-z0-9_-]{8,128}$/.test(operationId)) {
        throw new FinanceValidationError(
            'operationId deve ter de 8 a 128 caracteres alfanuméricos, "_" ou "-".',
        );
    }
    return operationId;
}

function normalizeAccountType(value) {
    const type = String(value || '').trim().toLowerCase();
    if (!ACCOUNT_TYPES.has(type)) {
        throw new FinanceValidationError('tipo deve ser "receber" ou "pagar".');
    }
    return type;
}

function normalizeMonth(value) {
    const month = String(value || '').trim();
    if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(month)) {
        throw new FinanceValidationError('mes deve usar o formato YYYY-MM.');
    }
    return month;
}

function normalizeStatus(value, label = 'status') {
    const status = String(value || '').trim().toLowerCase();
    if (!FINANCE_STATUSES.has(status)) {
        throw new FinanceValidationError(`${label} financeiro é inválido.`);
    }
    return status;
}

function moneyToCents(value, label) {
    if (typeof value !== 'number' && typeof value !== 'string') {
        throw new FinanceValidationError(`${label} deve ser um valor monetário.`);
    }
    const raw = typeof value === 'string' ? value.trim() : String(value);
    if (!/^-?\d+(?:\.\d{1,2})?$/.test(raw)) {
        throw new FinanceValidationError(`${label} deve respeitar precisão de centavos.`);
    }
    const number = Number(raw);
    const cents = Math.round(number * 100);
    if (!Number.isFinite(number) || !Number.isSafeInteger(cents) || cents < 0) {
        throw new FinanceValidationError(`${label} é inválido.`);
    }
    return cents;
}

function normalizeInteger(value, label, minimum = 0) {
    const number = typeof value === 'number' ? value : Number(value);
    if (!Number.isSafeInteger(number) || number < minimum) {
        throw new FinanceValidationError(`${label} deve ser um inteiro válido.`);
    }
    return number;
}

function normalizeNullableText(value, label, maxLength) {
    if (value === null) return null;
    if (typeof value !== 'string') {
        throw new FinanceValidationError(`${label} deve ser texto ou null.`);
    }
    const text = value.trim();
    if (text.length > maxLength) {
        throw new FinanceValidationError(`${label} excede o tamanho permitido.`);
    }
    return text || null;
}

function normalizeDate(value, label, nullable = true) {
    if (value === null && nullable) return null;
    const date = String(value || '').trim();
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
        throw new FinanceValidationError(`${label} deve usar o formato YYYY-MM-DD.`);
    }
    const parsed = new Date(`${date}T00:00:00.000Z`);
    if (Number.isNaN(parsed.getTime()) || parsed.toISOString().slice(0, 10) !== date) {
        throw new FinanceValidationError(`${label} é inválida.`);
    }
    return date;
}

function normalizeInterestType(value) {
    const type = String(value || '').trim().toLowerCase();
    if (type === 'simples' || type === 'juros_simples' || type === 'simple') return 'simples';
    if (type === 'composto' || type === 'juros_composto' || type === 'compound') return 'composto';
    return 'none';
}

function parseInterestRate(value) {
    const rate = Number(String(value === undefined || value === null ? '' : value).replace(',', '.'));
    return Number.isFinite(rate) && rate > 0 ? rate : 0;
}

function dateToDayNumber(value) {
    if (value === undefined || value === null || value === '') return null;
    if (typeof value === 'number' && Number.isFinite(value)) {
        const date = new Date(value);
        if (Number.isNaN(date.getTime())) return null;
        return Math.floor(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()) / 86400000);
    }
    const raw = String(value).trim();
    let year;
    let month;
    let day;
    if (/^\d{4}-\d{2}-\d{2}$/.test(raw)) {
        [year, month, day] = raw.split('-').map(Number);
    } else if (/^\d{2}\/\d{2}\/\d{4}$/.test(raw)) {
        [day, month, year] = raw.split('/').map(Number);
    } else {
        const parsed = new Date(raw);
        if (Number.isNaN(parsed.getTime())) return null;
        year = parsed.getUTCFullYear();
        month = parsed.getUTCMonth() + 1;
        day = parsed.getUTCDate();
    }
    const timestamp = Date.UTC(year, month - 1, day);
    const parsed = new Date(timestamp);
    if (
        parsed.getUTCFullYear() !== year
        || parsed.getUTCMonth() !== month - 1
        || parsed.getUTCDate() !== day
    ) return null;
    return Math.floor(timestamp / 86400000);
}

function dateToMonthKey(value) {
    if (value === undefined || value === null || value === '') return null;
    const raw = String(value).trim();
    if (/^\d{4}-\d{2}-\d{2}$/.test(raw) && dateToDayNumber(raw) !== null) {
        return raw.slice(0, 7);
    }
    if (/^\d{2}\/\d{2}\/\d{4}$/.test(raw) && dateToDayNumber(raw) !== null) {
        const [day, month, year] = raw.split('/');
        return `${year}-${month}`;
    }
    const parsed = new Date(raw);
    if (Number.isNaN(parsed.getTime())) return null;
    return `${parsed.getUTCFullYear()}-${String(parsed.getUTCMonth() + 1).padStart(2, '0')}`;
}

function computeInterestForPeriod(account, principalCents, startDay, endDay) {
    const type = normalizeInterestType(account && account.jurosTipo);
    const rate = parseInterestRate(account && account.jurosTaxa);
    const daysLate = startDay > 0 && endDay !== null && endDay > startDay
        ? endDay - startDay
        : 0;
    if (type === 'none' || rate <= 0 || principalCents <= 0 || daysLate <= 0) {
        return { interestCents: 0, daysLate };
    }
    const principal = principalCents / 100;
    const monthlyRate = rate / 100;
    const months = daysLate / 30;
    const interest = type === 'composto'
        ? principal * (Math.pow(1 + monthlyRate, months) - 1)
        : principal * monthlyRate * months;
    const interestCents = Math.round(Math.max(0, interest) * 100);
    if (!Number.isSafeInteger(interestCents)) {
        throw new FinanceValidationError('Configuração de juros da conta é inválida.');
    }
    return { interestCents, daysLate };
}

function computeCanonicalInterest(account, current, paymentDate) {
    const dueDay = dateToDayNumber(account && (account.dataVencimento ?? account.vencimento));
    const baseDay = dateToDayNumber(account && account.jurosBaseDate);
    const paymentDay = dateToDayNumber(paymentDate);
    const startDay = Math.max(dueDay === null ? 0 : dueDay, baseDay === null ? 0 : baseDay);
    if (current.status === 'pago') return { interestCents: 0, daysLate: 0 };
    return computeInterestForPeriod(account, current.remainingCents, startDay, paymentDay);
}

function stableStringify(value) {
    if (Array.isArray(value)) {
        return `[${value.map((item) => stableStringify(item)).join(',')}]`;
    }
    if (isPlainObject(value)) {
        const keys = Object.keys(value).sort();
        return `{${keys.map((key) => `${JSON.stringify(key)}:${stableStringify(value[key])}`).join(',')}}`;
    }
    return JSON.stringify(value);
}

function pruneOperationRecords(records, limit, orderField) {
    const entries = Object.entries(isPlainObject(records) ? records : {});
    if (entries.length <= limit) return Object.fromEntries(entries);
    entries.sort(([, left], [, right]) => {
        const leftOrder = Number(left && left[orderField]) || 0;
        const rightOrder = Number(right && right[orderField]) || 0;
        if (leftOrder !== rightOrder) return rightOrder - leftOrder;
        return String(right && right.completedAt || '').localeCompare(String(left && left.completedAt || ''));
    });
    return Object.fromEntries(entries.slice(0, limit));
}

function normalizeHistoryEntry(input, index) {
    if (!isPlainObject(input)) {
        throw new FinanceValidationError(`historicosPagamento[${index}] é inválido.`);
    }
    const unknown = Object.keys(input).filter((key) => !HISTORY_FIELDS.has(key));
    if (unknown.length) {
        throw new FinanceValidationError(
            `Campo não permitido no histórico: ${unknown[0]}.`,
        );
    }

    const entry = {
        data: normalizeDate(input.data, `historicosPagamento[${index}].data`, false),
        valor: moneyToCents(input.valor, `historicosPagamento[${index}].valor`) / 100,
    };
    if (entry.valor <= 0) {
        throw new FinanceValidationError(`historicosPagamento[${index}].valor deve ser positivo.`);
    }
    if (hasOwn(input, 'metodo')) {
        entry.metodo = normalizeNullableText(
            input.metodo,
            `historicosPagamento[${index}].metodo`,
            120,
        );
    }
    if (hasOwn(input, 'observacoes')) {
        entry.observacoes = normalizeNullableText(
            input.observacoes,
            `historicosPagamento[${index}].observacoes`,
            2000,
        );
    }
    if (hasOwn(input, 'comprovanteUrl')) {
        entry.comprovanteUrl = normalizeNullableText(
            input.comprovanteUrl,
            `historicosPagamento[${index}].comprovanteUrl`,
            4096,
        );
    }
    if (hasOwn(input, 'comprovanteStoragePath')) {
        entry.comprovanteStoragePath = normalizeNullableText(
            input.comprovanteStoragePath,
            `historicosPagamento[${index}].comprovanteStoragePath`,
            1024,
        );
    }
    if (hasOwn(input, 'jurosAplicado')) {
        entry.jurosAplicado = moneyToCents(
            input.jurosAplicado,
            `historicosPagamento[${index}].jurosAplicado`,
        ) / 100;
    }
    if (hasOwn(input, 'diasAtraso')) {
        entry.diasAtraso = normalizeInteger(
            input.diasAtraso,
            `historicosPagamento[${index}].diasAtraso`,
        );
    }
    if (hasOwn(input, 'jurosTipoAplicado')) {
        entry.jurosTipoAplicado = normalizeInterestType(input.jurosTipoAplicado);
    }
    if (hasOwn(input, 'jurosTaxaAplicada')) {
        const rate = parseInterestRate(input.jurosTaxaAplicada);
        if (rate > 1000) {
            throw new FinanceValidationError(
                `historicosPagamento[${index}].jurosTaxaAplicada é inválida.`,
            );
        }
        entry.jurosTaxaAplicada = rate;
    }
    if (hasOwn(input, 'operationId')) {
        entry.operationId = normalizeOperationId(input.operationId);
    }
    return entry;
}

function normalizeHistory(input) {
    if (!Array.isArray(input) || input.length > MAX_HISTORY_ITEMS) {
        throw new FinanceValidationError('historicosPagamento deve ser uma lista válida.');
    }
    return input.map((entry, index) => normalizeHistoryEntry(entry, index));
}

function normalizeExpectedState(input) {
    if (!isPlainObject(input)) {
        throw new FinanceValidationError('expected é obrigatório.');
    }
    const required = ['historyLength', 'valorPago', 'valorRestante', 'status', 'revision'];
    for (const key of required) {
        if (!hasOwn(input, key)) {
            throw new FinanceValidationError(`expected.${key} é obrigatório.`);
        }
    }
    return {
        historyLength: normalizeInteger(input.historyLength, 'expected.historyLength'),
        valorPagoCents: moneyToCents(input.valorPago, 'expected.valorPago'),
        valorRestanteCents: moneyToCents(input.valorRestante, 'expected.valorRestante'),
        status: normalizeStatus(input.status, 'expected.status'),
        revision: normalizeInteger(input.revision, 'expected.revision'),
    };
}

function normalizeFinancialPatch(input) {
    if (!isPlainObject(input)) {
        throw new FinanceValidationError('patch financeiro é obrigatório.');
    }
    const unknown = Object.keys(input).filter((key) => !FINANCIAL_PATCH_FIELDS.has(key));
    if (unknown.length) {
        throw new FinanceValidationError(`Campo financeiro não permitido: ${unknown[0]}.`);
    }
    for (const key of REQUIRED_PATCH_FIELDS) {
        if (!hasOwn(input, key)) {
            throw new FinanceValidationError(`patch.${key} é obrigatório.`);
        }
    }

    const patch = {
        historicosPagamento: normalizeHistory(input.historicosPagamento),
        valorPago: moneyToCents(input.valorPago, 'patch.valorPago') / 100,
        valorRestante: moneyToCents(input.valorRestante, 'patch.valorRestante') / 100,
        status: normalizeStatus(input.status, 'patch.status'),
    };
    if (hasOwn(input, 'dataPagamento')) {
        patch.dataPagamento = normalizeDate(input.dataPagamento, 'patch.dataPagamento');
    }
    if (hasOwn(input, 'jurosBaseDate')) {
        patch.jurosBaseDate = normalizeDate(input.jurosBaseDate, 'patch.jurosBaseDate');
    }
    for (const [key, maxLength] of [
        ['metodoPagamento', 120],
        ['observacoesPagamento', 2000],
        ['comprovanteUrl', 4096],
        ['comprovanteStoragePath', 1024],
    ]) {
        if (hasOwn(input, key)) {
            patch[key] = normalizeNullableText(input[key], `patch.${key}`, maxLength);
        }
    }
    return patch;
}

function normalizeSequenceRequest(data) {
    const payload = isPlainObject(data) ? data : {};
    const sequence = String(payload.sequence || '').trim();
    let sequenceType = '';
    if (sequence === 'contasReceberManual') sequenceType = 'receber';
    if (sequence === 'contasPagarManual') sequenceType = 'pagar';
    if (sequence && !sequenceType) {
        throw new FinanceValidationError('sequence financeira é inválida.');
    }
    const requestedType = payload.tipo || payload.type;
    const type = normalizeAccountType(requestedType || sequenceType);
    if (sequenceType && requestedType && normalizeAccountType(requestedType) !== sequenceType) {
        throw new FinanceValidationError('tipo e sequence financeiros são incompatíveis.');
    }
    return {
        type,
        sequenceKey: type === 'receber' ? 'contasReceberManual' : 'contasPagarManual',
        prefix: type === 'receber' ? 'RX' : 'PX',
        operationId: normalizeOperationId(payload.operationId),
    };
}

function normalizePaymentRequest(data) {
    const payload = isPlainObject(data) ? data : {};
    const expected = normalizeExpectedState(payload.expected);
    const patchInput = payload.patch || payload.financePatch || payload.financialPatch;
    const patch = normalizeFinancialPatch(patchInput);
    return {
        type: normalizeAccountType(payload.tipo || payload.type),
        month: normalizeMonth(payload.mes || payload.month),
        accountId: normalizePathSegment(payload.contaId || payload.accountId, 'contaId'),
        operationId: normalizeOperationId(payload.operationId),
        expected,
        patch,
    };
}

function normalizeAccountCreateRequest(data) {
    const payload = isPlainObject(data) ? data : {};
    if (!Array.isArray(payload.accounts) || payload.accounts.length === 0) {
        throw new FinanceValidationError('Ao menos uma conta financeira é obrigatória.');
    }
    if (payload.accounts.length > MAX_CREATE_ACCOUNTS) {
        throw new FinanceValidationError(`O lote não pode exceder ${MAX_CREATE_ACCOUNTS} contas.`);
    }
    const accounts = payload.accounts.map((item, index) => {
        const source = isPlainObject(item) && isPlainObject(item.account) ? item.account : item;
        if (!isPlainObject(source)) {
            throw new FinanceValidationError(`Conta ${index + 1} é inválida.`);
        }
        const serialized = stableStringify(source);
        if (serialized.length > 250000) {
            throw new FinanceValidationError(`Conta ${index + 1} excede o tamanho permitido.`);
        }
        const accountId = normalizePathSegment(source.id, `accounts[${index}].id`);
        const dueDate = normalizeDate(
            source.dataVencimento ?? source.vencimento,
            `accounts[${index}].dataVencimento`,
            false,
        );
        const inferredMonth = dateToMonthKey(dueDate);
        const month = normalizeMonth(
            (isPlainObject(item) && (item.mes || item.month)) || inferredMonth,
        );
        if (month !== inferredMonth) {
            throw new FinanceValidationError(
                `Partição mensal da conta ${index + 1} não corresponde ao vencimento.`,
            );
        }
        return { accountId, month, account: source };
    });
    const ids = new Set();
    for (const item of accounts) {
        if (ids.has(item.accountId)) {
            throw new FinanceValidationError('O lote contém IDs de conta duplicados.');
        }
        ids.add(item.accountId);
    }
    return {
        type: normalizeAccountType(payload.tipo || payload.type),
        operationId: normalizeOperationId(payload.operationId),
        accounts,
    };
}

function normalizeAccountEditRequest(data) {
    const payload = isPlainObject(data) ? data : {};
    if (!isPlainObject(payload.account)) {
        throw new FinanceValidationError('Conta editada é obrigatória.');
    }
    const serialized = stableStringify(payload.account);
    if (serialized.length > 250000) {
        throw new FinanceValidationError('Conta editada excede o tamanho permitido.');
    }
    return {
        type: normalizeAccountType(payload.tipo || payload.type),
        fromMonth: normalizeMonth(payload.mesOrigem || payload.fromMonth || payload.mes || payload.month),
        toMonth: normalizeMonth(payload.mesDestino || payload.toMonth || payload.mes || payload.month),
        accountId: normalizePathSegment(payload.contaId || payload.accountId, 'contaId'),
        operationId: normalizeOperationId(payload.operationId),
        expected: normalizeExpectedState(payload.expected),
        account: payload.account,
    };
}

function normalizeAccountDeleteRequest(data) {
    const payload = isPlainObject(data) ? data : {};
    return {
        type: normalizeAccountType(payload.tipo || payload.type),
        month: normalizeMonth(payload.mes || payload.month),
        accountId: normalizePathSegment(payload.contaId || payload.accountId, 'contaId'),
        operationId: normalizeOperationId(payload.operationId),
        expected: normalizeExpectedState(payload.expected),
    };
}

function normalizeReceiptUpdateRequest(data) {
    const payload = isPlainObject(data) ? data : {};
    const rawReference = payload.registroRef === undefined ? 'total' : payload.registroRef;
    const reference = String(rawReference).trim().toLowerCase();
    if (!/^(?:total|full|\d{1,4})$/.test(reference)) {
        throw new FinanceValidationError('Referência do comprovante é inválida.');
    }
    const receipt = isPlainObject(payload.receipt) ? payload.receipt : {};
    return {
        type: normalizeAccountType(payload.tipo || payload.type),
        month: normalizeMonth(payload.mes || payload.month),
        accountId: normalizePathSegment(payload.contaId || payload.accountId, 'contaId'),
        operationId: normalizeOperationId(payload.operationId),
        expected: normalizeExpectedState(payload.expected),
        reference,
        receipt: {
            comprovanteUrl: normalizeNullableText(
                receipt.comprovanteUrl ?? receipt.url ?? null,
                'receipt.comprovanteUrl',
                4096,
            ),
            comprovanteStoragePath: normalizeNullableText(
                receipt.comprovanteStoragePath ?? receipt.storagePath ?? null,
                'receipt.comprovanteStoragePath',
                1024,
            ),
        },
    };
}

function currentFinancialState(account) {
    const history = Array.isArray(account.historicosPagamento) ? account.historicosPagamento : [];
    const historyPaidCents = history.reduce((sum, entry, index) => {
        try {
            return sum + moneyToCents(entry && entry.valor, `histórico remoto ${index}`);
        } catch (_) {
            return sum;
        }
    }, 0);
    const status = normalizeStatus(account.status || 'pendente', 'status remoto');
    const originalValue = hasOwn(account, 'valorOriginal') ? account.valorOriginal : account.valor;
    const originalCents = moneyToCents(originalValue, 'valor original remoto');
    const paidCents = hasOwn(account, 'valorPago')
        ? moneyToCents(account.valorPago, 'valorPago remoto')
        : (status === 'pago' && history.length === 0 ? originalCents : historyPaidCents);
    const remainingCents = hasOwn(account, 'valorRestante')
        ? moneyToCents(account.valorRestante, 'valorRestante remoto')
        : (status === 'pago' ? 0 : Math.max(0, originalCents - paidCents));
    return {
        history,
        historyLength: history.length,
        paidCents,
        remainingCents,
        originalCents,
        status,
        revision: hasOwn(account, 'revision')
            ? normalizeInteger(account.revision, 'revision remota')
            : 0,
    };
}

function expectedStateMatches(current, expected) {
    return current.historyLength === expected.historyLength
        && current.paidCents === expected.valorPagoCents
        && current.remainingCents === expected.valorRestanteCents
        && current.status === expected.status
        && current.revision === expected.revision;
}

function assertResultStatus(patch) {
    const paidCents = moneyToCents(patch.valorPago, 'patch.valorPago');
    const remainingCents = moneyToCents(patch.valorRestante, 'patch.valorRestante');
    if (remainingCents === 0) {
        if (patch.status !== 'pago' || remainingCents !== 0) {
            throw new FinanceValidationError('Status pago exige saldo restante zerado.');
        }
        return;
    }
    if (paidCents > 0 && patch.status !== 'parcial') {
        throw new FinanceValidationError('Saldo pago parcial exige status parcial.');
    }
    if (paidCents === 0 && !new Set(['pendente', 'vencido']).has(patch.status)) {
        throw new FinanceValidationError('Conta sem pagamento exige status pendente ou vencido.');
    }
}

function historiesHavePrefix(currentHistory, nextHistory) {
    if (nextHistory.length < currentHistory.length) return false;
    for (let index = 0; index < currentHistory.length; index += 1) {
        if (stableStringify(currentHistory[index]) !== stableStringify(nextHistory[index])) {
            return false;
        }
    }
    return true;
}

function isOrderedHistorySubset(currentHistory, nextHistory) {
    let nextIndex = 0;
    for (const currentEntry of currentHistory) {
        if (
            nextIndex < nextHistory.length
            && stableStringify(currentEntry) === stableStringify(nextHistory[nextIndex])
        ) {
            nextIndex += 1;
        }
    }
    return nextIndex === nextHistory.length;
}

function normalizeManualAttachment(attachment, index, companyId) {
    if (!isPlainObject(attachment)) {
        throw new FinanceValidationError(`Anexo financeiro ${index + 1} é inválido.`);
    }
    const url = normalizeNullableText(
        String(attachment.url || attachment.downloadURL || '').trim() || null,
        `anexos[${index}].url`,
        4096,
    );
    const storagePath = normalizeNullableText(
        String(attachment.storagePath || attachment.fullPath || '').trim() || null,
        `anexos[${index}].storagePath`,
        1024,
    );
    if (!url || !storagePath) {
        throw new FinanceValidationError(
            `Anexo financeiro ${index + 1} exige URL e caminho do Storage.`,
        );
    }
    assertReceiptReference({
        comprovanteUrl: url,
        comprovanteStoragePath: storagePath,
    }, companyId);
    const normalized = {
        url,
        downloadURL: url,
        storagePath,
        name: normalizeNullableText(
            String(attachment.name || attachment.fileName || 'arquivo'),
            `anexos[${index}].name`,
            255,
        ) || 'arquivo',
        fileName: normalizeNullableText(
            String(attachment.fileName || attachment.name || 'arquivo'),
            `anexos[${index}].fileName`,
            255,
        ) || 'arquivo',
        contentType: normalizeNullableText(
            String(attachment.contentType || attachment.mimeType || ''),
            `anexos[${index}].contentType`,
            160,
        ),
        module: 'financas',
    };
    if (attachment.size !== undefined && attachment.size !== null) {
        normalized.size = normalizeInteger(attachment.size, `anexos[${index}].size`);
    }
    if (attachment.uploadedAt) {
        normalized.uploadedAt = normalizeNullableText(
            String(attachment.uploadedAt),
            `anexos[${index}].uploadedAt`,
            80,
        );
    }
    return normalized;
}

function buildCanonicalCreatedAccount(item, request, companyId, nowIso) {
    const source = item.account;
    const unknown = Object.keys(source).filter((key) => !CREATABLE_MANUAL_ACCOUNT_FIELDS.has(key));
    if (unknown.length) {
        throw new FinanceValidationError(`Campo não permitido na criação manual: ${unknown[0]}.`);
    }
    if (String(source.id) !== item.accountId) {
        throw new FinanceValidationError('ID da conta manual é incompatível.');
    }
    if (source.origem && String(source.origem).trim().toLowerCase() !== 'manual') {
        throw new FinanceValidationError('A callable de criação aceita apenas contas manuais.');
    }

    const dueDate = normalizeDate(
        source.dataVencimento ?? source.vencimento,
        'dataVencimento',
        false,
    );
    if (dateToMonthKey(dueDate) !== item.month) {
        throw new FinanceValidationError('Partição mensal não corresponde ao vencimento da conta.');
    }
    const originalCents = moneyToCents(
        hasOwn(source, 'valorOriginal') ? source.valorOriginal : source.valor,
        'valorOriginal',
    );
    if (originalCents <= 0) {
        throw new FinanceValidationError('valorOriginal deve ser positivo.');
    }
    if (moneyToCents(source.valor, 'valor') !== originalCents) {
        throw new FinanceValidationError('valor e valorOriginal devem ser iguais na criação.');
    }
    if (
        hasOwn(source, 'valorRestante')
        && moneyToCents(source.valorRestante, 'valorRestante') !== originalCents
    ) {
        throw new FinanceValidationError('valorRestante deve corresponder ao valor original.');
    }
    const totalCents = hasOwn(source, 'valorTotal')
        ? moneyToCents(source.valorTotal, 'valorTotal')
        : originalCents;
    if (totalCents <= 0) {
        throw new FinanceValidationError('valorTotal deve ser positivo.');
    }

    const installment = hasOwn(source, 'parcela')
        ? normalizeInteger(source.parcela, 'parcela', 1)
        : 1;
    const installmentCount = hasOwn(source, 'totalParcelas')
        ? normalizeInteger(source.totalParcelas, 'totalParcelas', 1)
        : 1;
    if (installment > installmentCount) {
        throw new FinanceValidationError('parcela não pode exceder totalParcelas.');
    }
    const interestType = normalizeInterestType(source.jurosTipo);
    const interestRate = parseInterestRate(source.jurosTaxa);
    if (interestRate > 1000 || (interestType === 'none' && interestRate !== 0)) {
        throw new FinanceValidationError('Configuração de juros manual é inválida.');
    }

    const rawAttachments = source.anexos === undefined ? [] : source.anexos;
    if (!Array.isArray(rawAttachments) || rawAttachments.length > 100) {
        throw new FinanceValidationError('Lista de anexos financeiros é inválida.');
    }
    const attachments = rawAttachments.map((attachment, index) => (
        normalizeManualAttachment(attachment, index, companyId)
    ));
    const lastAttachment = attachments.length ? attachments[attachments.length - 1] : null;
    if (
        source.anexoUrl
        && (!lastAttachment || String(source.anexoUrl) !== String(lastAttachment.url))
    ) {
        throw new FinanceValidationError('anexoUrl não corresponde ao último anexo validado.');
    }

    const dueDay = dateToDayNumber(dueDate);
    const todayDay = dateToDayNumber(nowIso);
    const status = dueDay !== null && todayDay !== null && dueDay < todayDay
        ? 'vencido'
        : 'pendente';
    const account = {
        id: item.accountId,
        descricao: normalizeNullableText(String(source.descricao || ''), 'descricao', 2000),
        valor: originalCents / 100,
        valorOriginal: originalCents / 100,
        valorRestante: originalCents / 100,
        valorPago: 0,
        dataVencimento: dueDate,
        status,
        categoria: normalizeNullableText(String(source.categoria || ''), 'categoria', 160),
        tipo: normalizeNullableText(String(source.tipo || ''), 'tipo', 160),
        jurosTipo: interestType,
        jurosTaxa: interestRate,
        observacoes: normalizeNullableText(String(source.observacoes || ''), 'observacoes', 5000),
        parcela: installment,
        totalParcelas: installmentCount,
        valorTotal: totalCents / 100,
        origem: 'manual',
        numero: normalizeNullableText(String(source.numero || ''), 'numero', 160),
        created: nowIso,
        revision: 0,
    };
    const partyField = request.type === 'receber' ? 'cliente' : 'fornecedor';
    const partyIdField = request.type === 'receber' ? 'clienteId' : 'fornecedorId';
    account[partyField] = normalizeNullableText(
        String(source[partyField] || ''),
        partyField,
        500,
    );
    account[partyIdField] = normalizeNullableText(
        String(source[partyIdField] || ''),
        partyIdField,
        160,
    );
    if (
        !account.descricao
        || !account.categoria
        || !account.tipo
        || !account.numero
        || !account[partyField]
        || !account[partyIdField]
    ) {
        throw new FinanceValidationError(
            'Descrição, categoria, tipo, número e contraparte são obrigatórios.',
        );
    }
    for (const key of ['tipoPagamento', 'tipo_pagamento', 'formaPagamento']) {
        if (hasOwn(source, key)) {
            account[key] = normalizeNullableText(String(source[key] || ''), key, 160);
        }
    }
    if (attachments.length) {
        account.anexos = attachments;
        account.anexoUrl = lastAttachment.url;
    }
    return account;
}

function createAccountsFingerprint(request, canonicalEntries) {
    return crypto.createHash('sha256').update(stableStringify({
        kind: 'create',
        type: request.type,
        accounts: canonicalEntries.map((entry) => {
            const account = { ...entry.account };
            delete account.created;
            delete account.status;
            return { month: entry.month, account };
        }),
    })).digest('hex');
}

function buildAccountsCreateTreeMutation(currentTree, request, canonicalEntries, nowIso) {
    const tree = isPlainObject(currentTree) ? currentTree : {};
    const fingerprint = createAccountsFingerprint(request, canonicalEntries);
    const existing = [];
    for (const entry of canonicalEntries) {
        let match = null;
        for (const [month, bucket] of Object.entries(tree)) {
            if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(month) || !isPlainObject(bucket)) continue;
            if (isPlainObject(bucket[entry.account.id])) {
                if (match) return { outcome: 'conflict', reason: 'duplicate-remote-id' };
                match = bucket[entry.account.id];
            }
        }
        existing.push(match);
    }
    if (existing.some(Boolean)) {
        const allIdempotent = existing.every((account) => {
            const prior = account
                && isPlainObject(account[INTERNAL_OPERATIONS_FIELD])
                ? account[INTERNAL_OPERATIONS_FIELD][request.operationId]
                : null;
            return prior && prior.kind === 'create' && prior.fingerprint === fingerprint;
        });
        return allIdempotent
            ? { outcome: 'idempotent', tree, accounts: existing }
            : { outcome: 'conflict', reason: 'account-exists' };
    }

    const nextTree = { ...tree };
    const accounts = [];
    for (const entry of canonicalEntries) {
        const bucket = isPlainObject(nextTree[entry.month]) ? nextTree[entry.month] : {};
        const account = {
            ...entry.account,
            [INTERNAL_OPERATIONS_FIELD]: {
                [request.operationId]: {
                    kind: 'create',
                    fingerprint,
                    revision: 0,
                    completedAt: nowIso,
                },
            },
        };
        nextTree[entry.month] = { ...bucket, [account.id]: account };
        accounts.push(account);
    }
    return { outcome: 'commit', tree: nextTree, accounts };
}

function assertRegisterMutation(account, current, patch, operationId, nowIso) {
    const history = patch.historicosPagamento;
    if (
        history.length !== current.historyLength + 1
        || !historiesHavePrefix(current.history, history)
    ) {
        throw new FinanceValidationError('Registro deve acrescentar exatamente um item ao histórico.');
    }
    const payment = history[history.length - 1];
    if (payment.operationId && payment.operationId !== operationId) {
        throw new FinanceValidationError('operationId do histórico não corresponde à operação.');
    }
    const paymentDay = dateToDayNumber(payment.data);
    const todayDay = dateToDayNumber(nowIso);
    const previousPayment = current.history.length
        ? current.history[current.history.length - 1]
        : null;
    const previousDay = Math.max(
        dateToDayNumber(account && account.jurosBaseDate) || 0,
        dateToDayNumber(previousPayment && previousPayment.data) || 0,
    );
    if (paymentDay === null || (previousDay > 0 && paymentDay < previousDay)) {
        throw new FinanceValidationError('Data do pagamento não pode anteceder a última baixa.');
    }
    if (todayDay !== null && paymentDay > todayDay) {
        throw new FinanceValidationError('Data do pagamento não pode estar no futuro.');
    }
    const paymentCents = moneyToCents(payment.valor, 'valor do pagamento');
    const informedInterestCents = hasOwn(payment, 'jurosAplicado')
        ? moneyToCents(payment.jurosAplicado, 'juros do pagamento')
        : 0;
    const canonicalInterest = computeCanonicalInterest(account, current, payment.data);
    if (informedInterestCents !== canonicalInterest.interestCents) {
        throw new FinanceValidationError('Juros do pagamento não correspondem ao cálculo da conta.');
    }
    const informedDaysLate = hasOwn(payment, 'diasAtraso')
        ? normalizeInteger(payment.diasAtraso, 'dias de atraso do pagamento')
        : 0;
    if (informedDaysLate !== canonicalInterest.daysLate) {
        throw new FinanceValidationError('Dias de atraso não correspondem ao cálculo da conta.');
    }
    if (patch.jurosBaseDate !== payment.data) {
        throw new FinanceValidationError('Data-base de juros deve corresponder ao pagamento.');
    }
    const expectedPaymentDate = patch.status === 'pago' ? payment.data : null;
    if ((patch.dataPagamento || null) !== expectedPaymentDate) {
        throw new FinanceValidationError('Data de quitação não corresponde ao resultado da baixa.');
    }
    if ((patch.metodoPagamento || null) !== (payment.metodo || null)) {
        throw new FinanceValidationError('Método de pagamento não corresponde ao histórico acrescentado.');
    }
    const nextPaidCents = moneyToCents(patch.valorPago, 'patch.valorPago');
    const nextRemainingCents = moneyToCents(patch.valorRestante, 'patch.valorRestante');
    if (nextPaidCents !== current.paidCents + paymentCents) {
        throw new FinanceValidationError('valorPago não corresponde ao pagamento acrescentado.');
    }
    const exigibleCents = current.remainingCents + canonicalInterest.interestCents;
    if (paymentCents > exigibleCents) {
        throw new FinanceValidationError('Pagamento excede o valor exigível.');
    }
    if (nextRemainingCents !== exigibleCents - paymentCents) {
        throw new FinanceValidationError('valorRestante não corresponde ao patch calculado.');
    }
    assertResultStatus(patch);
    const canonicalPayment = {
        ...payment,
        operationId,
        jurosTipoAplicado: normalizeInterestType(account && account.jurosTipo),
        jurosTaxaAplicada: parseInterestRate(account && account.jurosTaxa),
    };
    return {
        ...patch,
        historicosPagamento: [
            ...history.slice(0, -1),
            canonicalPayment,
        ],
    };
}

function buildCanonicalHistoryAfterDelete(account, current, history) {
    const dueDay = dateToDayNumber(account && (account.dataVencimento ?? account.vencimento)) || 0;
    let baseDay = dueDay;
    let remainingCents = current.originalCents;
    let paidCents = 0;
    const canonicalHistory = history.map((payment, index) => {
        const paymentDay = dateToDayNumber(payment && payment.data);
        if (paymentDay === null || (baseDay > 0 && paymentDay < baseDay)) {
            throw new FinanceValidationError(`Data do pagamento remanescente ${index + 1} é inválida.`);
        }
        const interestAccount = {
            ...account,
            jurosTipo: hasOwn(payment, 'jurosTipoAplicado')
                ? payment.jurosTipoAplicado
                : account && account.jurosTipo,
            jurosTaxa: hasOwn(payment, 'jurosTaxaAplicada')
                ? payment.jurosTaxaAplicada
                : account && account.jurosTaxa,
        };
        const interest = computeInterestForPeriod(
            interestAccount,
            remainingCents,
            Math.max(dueDay, baseDay),
            paymentDay,
        );
        const paymentCents = moneyToCents(payment.valor, 'valor do histórico');
        const exigibleCents = remainingCents + interest.interestCents;
        if (paymentCents > exigibleCents) {
            throw new FinanceValidationError('Histórico remanescente excede o saldo recalculado.');
        }
        remainingCents = exigibleCents - paymentCents;
        paidCents += paymentCents;
        baseDay = Math.max(baseDay, paymentDay);
        return {
            ...payment,
            jurosAplicado: interest.interestCents / 100,
            diasAtraso: interest.daysLate,
        };
    });
    return { canonicalHistory, paidCents, remainingCents };
}

function assertDeleteMutation(account, current, patch, nowIso) {
    const history = patch.historicosPagamento;
    const removedHistory = history.length < current.historyLength;
    const removesLegacyPayment = current.historyLength === 0 && current.paidCents > 0;
    if ((!removedHistory && !removesLegacyPayment) || !isOrderedHistorySubset(current.history, history)) {
        throw new FinanceValidationError('Exclusão deve apenas remover pagamentos do histórico atual.');
    }
    const recalculated = buildCanonicalHistoryAfterDelete(account, current, history);
    if (recalculated.paidCents > current.paidCents) {
        throw new FinanceValidationError('valorPago remanescente excede o total atual.');
    }
    const lastPayment = recalculated.canonicalHistory.length
        ? recalculated.canonicalHistory[recalculated.canonicalHistory.length - 1]
        : null;
    const expectedInterestBaseDate = lastPayment ? lastPayment.data : null;
    const dueDay = dateToDayNumber(account && (account.dataVencimento ?? account.vencimento));
    const todayDay = dateToDayNumber(nowIso);
    const status = recalculated.remainingCents === 0
        ? 'pago'
        : (recalculated.paidCents > 0
            ? 'parcial'
            : (dueDay !== null && todayDay !== null && dueDay < todayDay ? 'vencido' : 'pendente'));
    const lastWithReceipt = recalculated.canonicalHistory.slice().reverse()
        .find((payment) => payment && (payment.comprovanteUrl || payment.comprovanteStoragePath));
    const canonicalPatch = {
        ...patch,
        historicosPagamento: recalculated.canonicalHistory,
        valorPago: recalculated.paidCents / 100,
        valorRestante: recalculated.remainingCents / 100,
        status,
        dataPagamento: status === 'pago' && lastPayment ? lastPayment.data : null,
        metodoPagamento: lastPayment && lastPayment.metodo ? lastPayment.metodo : null,
        observacoesPagamento: lastPayment && lastPayment.observacoes ? lastPayment.observacoes : null,
        comprovanteUrl: lastWithReceipt && lastWithReceipt.comprovanteUrl ? lastWithReceipt.comprovanteUrl : null,
        comprovanteStoragePath: lastWithReceipt && lastWithReceipt.comprovanteStoragePath
            ? lastWithReceipt.comprovanteStoragePath
            : null,
        jurosBaseDate: expectedInterestBaseDate,
    };
    assertResultStatus(canonicalPatch);
    return canonicalPatch;
}

function operationFingerprint(kind, request) {
    return crypto.createHash('sha256').update(stableStringify({
        kind,
        expected: request.expected,
        patch: request.patch,
    })).digest('hex');
}

function buildAccountMutation(currentValue, request, kind, nowIso) {
    if (!isPlainObject(currentValue)) {
        return { outcome: 'not-found' };
    }
    const operationsValue = currentValue[INTERNAL_OPERATIONS_FIELD];
    if (operationsValue !== undefined && !isPlainObject(operationsValue)) {
        return { outcome: 'conflict', reason: 'invalid-remote-operations' };
    }
    const operations = operationsValue || {};
    const fingerprint = operationFingerprint(kind, request);
    const priorOperation = operations[request.operationId];
    if (priorOperation) {
        if (priorOperation.kind === kind && priorOperation.fingerprint === fingerprint) {
            return { outcome: 'idempotent', account: currentValue };
        }
        return { outcome: 'conflict', reason: 'operation-reused' };
    }

    let current;
    try {
        current = currentFinancialState(currentValue);
    } catch (_) {
        return { outcome: 'conflict', reason: 'invalid-remote-state' };
    }
    if (!expectedStateMatches(current, request.expected)) {
        return { outcome: 'conflict', reason: 'stale-state' };
    }

    let effectivePatch = request.patch;
    try {
        if (kind === 'register') {
            effectivePatch = assertRegisterMutation(
                currentValue,
                current,
                request.patch,
                request.operationId,
                nowIso,
            );
        } else {
            effectivePatch = assertDeleteMutation(currentValue, current, request.patch, nowIso);
        }
    } catch (error) {
        if (error instanceof FinanceValidationError) {
            return { outcome: 'invalid', reason: error.message };
        }
        throw error;
    }

    const revision = current.revision + 1;
    const nextOperations = {
        ...operations,
        [request.operationId]: {
            kind,
            fingerprint,
            revision,
            completedAt: nowIso,
        },
    };
    const account = {
        ...currentValue,
        ...effectivePatch,
        revision,
        [INTERNAL_OPERATIONS_FIELD]: pruneOperationRecords(
            nextOperations,
            MAX_ACCOUNT_OPERATION_RECORDS,
            'revision',
        ),
    };
    return { outcome: 'commit', account };
}

function buildSequenceMutation(currentValue, request, nowIso) {
    const source = typeof currentValue === 'number'
        ? { current: currentValue }
        : (isPlainObject(currentValue) ? currentValue : {});
    if (source.operations !== undefined && !isPlainObject(source.operations)) {
        return { outcome: 'conflict', reason: 'invalid-remote-operations' };
    }
    const operations = source.operations || {};
    const priorOperation = operations[request.operationId];
    if (priorOperation) {
        if (
            priorOperation.type === request.type
            && typeof priorOperation.numero === 'string'
            && Number.isSafeInteger(priorOperation.current)
        ) {
            return {
                outcome: 'idempotent',
                value: source,
                numero: priorOperation.numero,
                current: priorOperation.current,
            };
        }
        return { outcome: 'conflict', reason: 'operation-reused' };
    }
    const current = source.current === undefined
        ? 0
        : Number(source.current);
    if (!Number.isSafeInteger(current) || current < 0 || current >= Number.MAX_SAFE_INTEGER) {
        return { outcome: 'conflict', reason: 'invalid-sequence' };
    }
    const next = current + 1;
    const numero = `${request.prefix}${String(next).padStart(6, '0')}`;
    const nextOperations = {
        ...operations,
        [request.operationId]: {
            type: request.type,
            numero,
            current: next,
            completedAt: nowIso,
        },
    };
    const value = {
        ...source,
        current: next,
        last: numero,
        operations: pruneOperationRecords(
            nextOperations,
            MAX_SEQUENCE_OPERATION_RECORDS,
            'current',
        ),
    };
    return { outcome: 'commit', value, numero, current: next };
}

function accountEditFingerprint(request) {
    const editable = {};
    for (const key of EDITABLE_ACCOUNT_FIELDS) {
        if (hasOwn(request.account, key)) editable[key] = request.account[key];
    }
    return crypto.createHash('sha256').update(stableStringify({
        kind: 'edit',
        fromMonth: request.fromMonth,
        toMonth: request.toMonth,
        accountId: request.accountId,
        expected: request.expected,
        editable,
    })).digest('hex');
}

function buildAccountEditTreeMutation(currentTree, request, nowIso) {
    const tree = isPlainObject(currentTree) ? currentTree : {};
    const fromBucket = isPlainObject(tree[request.fromMonth]) ? tree[request.fromMonth] : {};
    const toBucket = isPlainObject(tree[request.toMonth]) ? tree[request.toMonth] : {};
    const currentValue = fromBucket[request.accountId];
    const targetValue = toBucket[request.accountId];
    const fingerprint = accountEditFingerprint(request);

    if (!isPlainObject(currentValue)) {
        const prior = isPlainObject(targetValue)
            && isPlainObject(targetValue[INTERNAL_OPERATIONS_FIELD])
            ? targetValue[INTERNAL_OPERATIONS_FIELD][request.operationId]
            : null;
        if (prior && prior.kind === 'edit' && prior.fingerprint === fingerprint) {
            return { outcome: 'idempotent', tree, account: targetValue };
        }
        return { outcome: 'not-found' };
    }
    if (
        request.fromMonth !== request.toMonth
        && isPlainObject(targetValue)
        && targetValue !== currentValue
    ) {
        return { outcome: 'conflict', reason: 'target-exists' };
    }

    const operationsValue = currentValue[INTERNAL_OPERATIONS_FIELD];
    if (operationsValue !== undefined && !isPlainObject(operationsValue)) {
        return { outcome: 'conflict', reason: 'invalid-remote-operations' };
    }
    const operations = operationsValue || {};
    const priorOperation = operations[request.operationId];
    if (priorOperation) {
        if (priorOperation.kind === 'edit' && priorOperation.fingerprint === fingerprint) {
            return { outcome: 'idempotent', tree, account: currentValue };
        }
        return { outcome: 'conflict', reason: 'operation-reused' };
    }
    let current;
    try {
        current = currentFinancialState(currentValue);
    } catch (_) {
        return { outcome: 'conflict', reason: 'invalid-remote-state' };
    }
    if (!expectedStateMatches(current, request.expected)) {
        return { outcome: 'conflict', reason: 'stale-state' };
    }
    if (hasOwn(request.account, 'id') && String(request.account.id) !== request.accountId) {
        return { outcome: 'invalid', reason: 'ID da conta editada é incompatível.' };
    }
    if (current.historyLength > 0 || current.paidCents > 0) {
        try {
            const requestedOriginal = hasOwn(request.account, 'valorOriginal')
                ? moneyToCents(request.account.valorOriginal, 'valorOriginal editado')
                : (hasOwn(request.account, 'valor')
                    ? moneyToCents(request.account.valor, 'valor editado')
                    : current.originalCents);
            const currentDueDay = dateToDayNumber(
                currentValue.dataVencimento ?? currentValue.vencimento,
            );
            const requestedDueDay = dateToDayNumber(
                request.account.dataVencimento
                ?? request.account.vencimento
                ?? currentValue.dataVencimento
                ?? currentValue.vencimento,
            );
            const currentInterestType = normalizeInterestType(currentValue.jurosTipo);
            const requestedInterestType = normalizeInterestType(
                hasOwn(request.account, 'jurosTipo')
                    ? request.account.jurosTipo
                    : currentValue.jurosTipo,
            );
            const currentInterestRate = parseInterestRate(currentValue.jurosTaxa);
            const requestedInterestRate = parseInterestRate(
                hasOwn(request.account, 'jurosTaxa')
                    ? request.account.jurosTaxa
                    : currentValue.jurosTaxa,
            );
            if (
                requestedOriginal !== current.originalCents
                || requestedDueDay !== currentDueDay
                || requestedInterestType !== currentInterestType
                || requestedInterestRate !== currentInterestRate
            ) {
                return {
                    outcome: 'invalid',
                    reason: 'Valor, vencimento e juros não podem mudar após a primeira baixa.',
                };
            }
        } catch (error) {
            return {
                outcome: 'invalid',
                reason: error instanceof FinanceValidationError
                    ? error.message
                    : 'Campos financeiros imutáveis são inválidos.',
            };
        }
    }

    const account = { ...currentValue };
    for (const key of EDITABLE_ACCOUNT_FIELDS) {
        if (hasOwn(request.account, key)) account[key] = request.account[key];
    }
    if (hasOwn(request.account, 'anexos')) {
        try {
            assertAccountAttachmentChanges(
                currentValue,
                request.account.anexos,
                request.authorizedCompanyId,
            );
        } catch (error) {
            return {
                outcome: 'invalid',
                reason: error instanceof FinanceValidationError ? error.message : 'Anexos financeiros são inválidos.',
            };
        }
        const lastAttachment = request.account.anexos.length
            ? request.account.anexos[request.account.anexos.length - 1]
            : null;
        account.anexoUrl = lastAttachment && (lastAttachment.url || lastAttachment.downloadURL)
            ? String(lastAttachment.url || lastAttachment.downloadURL)
            : null;
    }
    account.id = request.accountId;
    let originalCents;
    try {
        const requestedOriginal = hasOwn(request.account, 'valorOriginal')
            ? request.account.valorOriginal
            : (hasOwn(request.account, 'valor') ? request.account.valor : current.originalCents / 100);
        originalCents = moneyToCents(requestedOriginal, 'valor original editado');
        if (originalCents <= 0) {
            throw new FinanceValidationError('Valor original editado deve ser positivo.');
        }
        if (
            hasOwn(request.account, 'valor')
            && hasOwn(request.account, 'valorOriginal')
            && moneyToCents(request.account.valor, 'valor editado') !== originalCents
        ) {
            throw new FinanceValidationError('valor e valorOriginal editados são incompatíveis.');
        }
    } catch (error) {
        return {
            outcome: 'invalid',
            reason: error instanceof FinanceValidationError ? error.message : 'Valor editado é inválido.',
        };
    }
    try {
        const canonicalDueDate = normalizeDate(
            account.dataVencimento ?? account.vencimento,
            'vencimento editado',
            false,
        );
        const canonicalInterestType = normalizeInterestType(account.jurosTipo);
        const canonicalInterestRate = parseInterestRate(account.jurosTaxa);
        if (
            canonicalInterestRate > 1000
            || (canonicalInterestType === 'none' && canonicalInterestRate !== 0)
        ) {
            throw new FinanceValidationError('Configuração de juros editada é inválida.');
        }
        account.dataVencimento = canonicalDueDate;
        if (hasOwn(account, 'vencimento')) account.vencimento = canonicalDueDate;
        account.jurosTipo = canonicalInterestType;
        account.jurosTaxa = canonicalInterestRate;
    } catch (error) {
        return {
            outcome: 'invalid',
            reason: error instanceof FinanceValidationError
                ? error.message
                : 'Configuração financeira editada é inválida.',
        };
    }
    const retainedInterestCents = current.history.reduce((sum, payment, index) => {
        if (!hasOwn(payment || {}, 'jurosAplicado')) return sum;
        try {
            return sum + moneyToCents(payment.jurosAplicado, `juros remoto ${index}`);
        } catch (_) {
            return sum;
        }
    }, 0);
    const totalHistoricalValueCents = originalCents + retainedInterestCents;
    if (totalHistoricalValueCents < current.paidCents) {
        return { outcome: 'invalid', reason: 'Valor editado não pode ser inferior ao total já pago.' };
    }
    const expectedToMonth = dateToMonthKey(account.dataVencimento ?? account.vencimento);
    if (!expectedToMonth || expectedToMonth !== request.toMonth) {
        return { outcome: 'invalid', reason: 'Partição de destino não corresponde ao vencimento editado.' };
    }
    const remainingCents = totalHistoricalValueCents - current.paidCents;
    const dueDay = dateToDayNumber(account.dataVencimento ?? account.vencimento);
    const todayDay = dateToDayNumber(nowIso);
    const status = remainingCents === 0
        ? 'pago'
        : (current.paidCents > 0
            ? 'parcial'
            : (dueDay !== null && todayDay !== null && dueDay < todayDay ? 'vencido' : 'pendente'));
    const revision = current.revision + 1;
    account.valor = originalCents / 100;
    account.valorOriginal = originalCents / 100;
    account.valorTotal = originalCents / 100;
    account.valorPago = current.paidCents / 100;
    account.valorRestante = remainingCents / 100;
    account.status = status;
    account.revision = revision;
    account.updated = nowIso;
    account[INTERNAL_OPERATIONS_FIELD] = pruneOperationRecords({
        ...operations,
        [request.operationId]: {
            kind: 'edit',
            fingerprint,
            revision,
            completedAt: nowIso,
        },
    }, MAX_ACCOUNT_OPERATION_RECORDS, 'revision');

    const nextTree = { ...tree };
    if (request.fromMonth === request.toMonth) {
        nextTree[request.fromMonth] = { ...fromBucket, [request.accountId]: account };
    } else {
        const nextFromBucket = { ...fromBucket };
        delete nextFromBucket[request.accountId];
        nextTree[request.fromMonth] = nextFromBucket;
        nextTree[request.toMonth] = { ...toBucket, [request.accountId]: account };
    }
    return { outcome: 'commit', tree: nextTree, account };
}

function accountDeleteFingerprint(request) {
    return crypto.createHash('sha256').update(stableStringify({
        kind: 'delete-account',
        type: request.type,
        accountId: request.accountId,
        expected: request.expected,
    })).digest('hex');
}

function buildAccountDeleteTreeMutation(currentTree, request) {
    const tree = isPlainObject(currentTree) ? currentTree : {};
    const matches = [];
    for (const [month, bucket] of Object.entries(tree)) {
        if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(month) || !isPlainObject(bucket)) continue;
        if (isPlainObject(bucket[request.accountId])) {
            matches.push({ month, bucket, account: bucket[request.accountId] });
        }
    }
    if (matches.length === 0) return { outcome: 'not-found' };
    if (matches.length > 1) return { outcome: 'conflict', reason: 'duplicate-remote-id' };

    const match = matches[0];
    let current;
    try {
        current = currentFinancialState(match.account);
    } catch (_) {
        return { outcome: 'conflict', reason: 'invalid-remote-state' };
    }
    if (!expectedStateMatches(current, request.expected)) {
        return { outcome: 'conflict', reason: 'stale-state' };
    }
    const nextBucket = { ...match.bucket };
    delete nextBucket[request.accountId];
    return {
        outcome: 'commit',
        tree: { ...tree, [match.month]: nextBucket },
        account: match.account,
        deletedMonth: match.month,
    };
}

function buildReceiptMutation(currentValue, request, nowIso) {
    if (!isPlainObject(currentValue)) return { outcome: 'not-found' };
    const operationsValue = currentValue[INTERNAL_OPERATIONS_FIELD];
    if (operationsValue !== undefined && !isPlainObject(operationsValue)) {
        return { outcome: 'conflict', reason: 'invalid-remote-operations' };
    }
    const operations = operationsValue || {};
    const fingerprint = crypto.createHash('sha256').update(stableStringify({
        kind: 'receipt',
        reference: request.reference,
        receipt: request.receipt,
        expected: request.expected,
    })).digest('hex');
    const priorOperation = operations[request.operationId];
    if (priorOperation) {
        if (priorOperation.kind === 'receipt' && priorOperation.fingerprint === fingerprint) {
            return { outcome: 'idempotent', account: currentValue };
        }
        return { outcome: 'conflict', reason: 'operation-reused' };
    }
    let current;
    try {
        current = currentFinancialState(currentValue);
    } catch (_) {
        return { outcome: 'conflict', reason: 'invalid-remote-state' };
    }
    if (!expectedStateMatches(current, request.expected)) {
        return { outcome: 'conflict', reason: 'stale-state' };
    }
    const account = { ...currentValue };
    if (request.reference === 'total' || request.reference === 'full') {
        account.comprovanteUrl = request.receipt.comprovanteUrl;
        account.comprovanteStoragePath = request.receipt.comprovanteStoragePath;
    } else {
        const index = Number(request.reference);
        if (!Number.isSafeInteger(index) || index < 0 || index >= current.history.length) {
            return { outcome: 'invalid', reason: 'Registro de pagamento não encontrado.' };
        }
        const history = current.history.map((entry) => ({ ...(entry || {}) }));
        history[index].comprovanteUrl = request.receipt.comprovanteUrl;
        history[index].comprovanteStoragePath = request.receipt.comprovanteStoragePath;
        account.historicosPagamento = history;
        const lastWithReceipt = history.slice().reverse().find((entry) => (
            entry && (entry.comprovanteUrl || entry.comprovanteStoragePath)
        ));
        account.comprovanteUrl = lastWithReceipt && lastWithReceipt.comprovanteUrl
            ? lastWithReceipt.comprovanteUrl
            : null;
        account.comprovanteStoragePath = lastWithReceipt && lastWithReceipt.comprovanteStoragePath
            ? lastWithReceipt.comprovanteStoragePath
            : null;
    }
    const revision = current.revision + 1;
    account.revision = revision;
    account[INTERNAL_OPERATIONS_FIELD] = pruneOperationRecords({
        ...operations,
        [request.operationId]: {
            kind: 'receipt',
            fingerprint,
            revision,
            completedAt: nowIso,
        },
    }, MAX_ACCOUNT_OPERATION_RECORDS, 'revision');
    return { outcome: 'commit', account };
}

function isInactiveAccessRecord(snapshot) {
    if (!snapshot || typeof snapshot.exists !== 'function' || !snapshot.exists()) return false;
    const value = snapshot.val();
    if (!isPlainObject(value)) return false;
    const status = String(value.status || value.accountStatus || '').trim().toLowerCase();
    return value.active === false
        || value.adminActive === false
        || value.enabled === false
        || value.disabled === true
        || INACTIVE_STATUSES.has(status);
}

function accessRecordAllowsFinance(value) {
    if (!isPlainObject(value)) return false;
    const role = String(value.role || value.profileRole || '').trim().toLowerCase();
    if (FINANCE_ROLES.has(role)) return true;
    const permissions = isPlainObject(value.permissions) ? value.permissions
        : (isPlainObject(value.adminPermissions) ? value.adminPermissions : {});
    for (const key of ['finance', 'financas', 'financial']) {
        const permission = permissions[key];
        if (permission === true) return true;
        if (isPlainObject(permission) && (
            permission.write === true
            || permission.manage === true
            || permission.enabled === true
        )) return true;
    }
    return false;
}

async function hasLegacyOperationalOwnerFinanceAccess(db, resolved) {
    const [userSnapshot, profileSnapshot] = await Promise.all([
        db.ref(`users/${resolved.uid}`).get(),
        db.ref(`companies/${resolved.companyId}/profile`).get(),
    ]);
    if (!userSnapshot || !userSnapshot.exists() || !profileSnapshot || !profileSnapshot.exists()) {
        return false;
    }
    if (isInactiveAccessRecord(userSnapshot)) return false;
    const user = userSnapshot.val();
    const profile = profileSnapshot.val();
    if (!isPlainObject(user) || !isPlainObject(profile)) return false;
    const userCompanyId = String(user.companyId || '').trim();
    const userEmail = String(user.email || '').trim().toLowerCase();
    const profileEmail = String(profile.email || '').trim().toLowerCase();
    return userCompanyId === resolved.companyId
        && !!userEmail
        && userEmail === profileEmail;
}

function isSiswebStorageBucket(bucketName) {
    const projectId = String(process.env.GCLOUD_PROJECT || process.env.GCP_PROJECT || 'sisweb-7ce82').trim();
    const bucket = String(bucketName || '').trim().toLowerCase();
    return bucket === `${projectId}.firebasestorage.app`
        || bucket === `${projectId}.appspot.com`;
}

function resolveStorageBucketFromUrl(parsed) {
    const host = String(parsed && parsed.hostname || '').toLowerCase();
    if (host.endsWith('.firebasestorage.app')) return host;
    if (host !== 'firebasestorage.googleapis.com') return '';
    const match = String(parsed.pathname || '').match(/\/b\/([^/]+)\/o\//);
    return match ? decodeURIComponent(match[1]).toLowerCase() : '';
}

function assertReceiptReference(entry, companyId) {
    const source = isPlainObject(entry) ? entry : {};
    const url = String(source.comprovanteUrl || '').trim();
    const storagePath = String(source.comprovanteStoragePath || '').trim().replace(/^\/+/, '');
    if (!url && !storagePath) return;
    const expectedPrefix = `companies/${companyId}/financas/`;
    if (!storagePath.startsWith(expectedPrefix)) {
        throw new FinanceValidationError('Caminho do comprovante não pertence ao tenant autenticado.');
    }
    let parsed;
    try {
        parsed = new URL(url);
    } catch (_) {
        throw new FinanceValidationError('URL do comprovante é inválida.');
    }
    const host = String(parsed.hostname || '').toLowerCase();
    if (
        parsed.protocol !== 'https:'
        || !(host === 'firebasestorage.googleapis.com' || host.endsWith('.firebasestorage.app'))
    ) {
        throw new FinanceValidationError('URL do comprovante não pertence ao Firebase Storage.');
    }
    if (!isSiswebStorageBucket(resolveStorageBucketFromUrl(parsed))) {
        throw new FinanceValidationError('Bucket do comprovante não pertence ao projeto Sisweb.');
    }
    const markerIndex = parsed.pathname.indexOf('/o/');
    let urlStoragePath = '';
    try {
        urlStoragePath = markerIndex >= 0
            ? decodeURIComponent(parsed.pathname.slice(markerIndex + 3)).replace(/^\/+/, '')
            : '';
    } catch (_) {
        throw new FinanceValidationError('URL do comprovante possui caminho inválido.');
    }
    if (urlStoragePath !== storagePath) {
        throw new FinanceValidationError('URL e caminho do comprovante são incompatíveis.');
    }
}

function assertAccountAttachmentChanges(currentValue, nextAttachments, companyId) {
    if (!Array.isArray(nextAttachments) || nextAttachments.length > 100) {
        throw new FinanceValidationError('Lista de anexos financeiros é inválida.');
    }
    const currentAttachments = Array.isArray(currentValue && currentValue.anexos)
        ? currentValue.anexos
        : [];
    nextAttachments.forEach((attachment, index) => {
        if (!isPlainObject(attachment)) {
            throw new FinanceValidationError(`Anexo financeiro ${index + 1} é inválido.`);
        }
        if (currentAttachments.some((current) => stableStringify(current) === stableStringify(attachment))) {
            return;
        }
        if (
            !String(attachment.url || attachment.downloadURL || '').trim()
            || !String(attachment.storagePath || attachment.fullPath || '').trim()
        ) {
            throw new FinanceValidationError(
                `Anexo financeiro ${index + 1} exige URL e caminho do Storage.`,
            );
        }
        assertReceiptReference({
            comprovanteUrl: attachment.url || attachment.downloadURL || '',
            comprovanteStoragePath: attachment.storagePath || attachment.fullPath || '',
        }, companyId);
    });
}

function assertPaymentReceiptRequest(request, companyId, kind) {
    if (kind !== 'register') return;
    const history = request.patch.historicosPagamento;
    assertReceiptReference(history[history.length - 1], companyId);
    if (request.patch.comprovanteUrl || request.patch.comprovanteStoragePath) {
        assertReceiptReference(request.patch, companyId);
    }
}

function resolveAuthenticatedTenant(context) {
    if (!context || !context.auth || !context.auth.uid) {
        throw new FinanceValidationError('Autenticação obrigatória.', 'unauthenticated');
    }
    const token = isPlainObject(context.auth.token) ? context.auth.token : {};
    if (!token.companyId) {
        throw new FinanceValidationError(
            'Tenant autenticado ausente no token.',
            'permission-denied',
        );
    }
    return {
        uid: String(context.auth.uid),
        companyId: normalizePathSegment(token.companyId, 'companyId do token'),
        subscriptionStatus: String(token.subscriptionStatus || '').trim().toLowerCase(),
    };
}

async function assertFinanceAccess(context, db, isSuperAdmin) {
    const resolved = resolveAuthenticatedTenant(context);
    const superAdmin = await isSuperAdmin(context);
    if (!superAdmin && !ACTIVE_SUBSCRIPTIONS.has(resolved.subscriptionStatus)) {
        throw new FinanceValidationError(
            'Assinatura sem acesso financeiro ativo.',
            'permission-denied',
        );
    }
    const [memberSnapshot, roleSnapshot] = await Promise.all([
        db.ref(`companies/${resolved.companyId}/users/${resolved.uid}`).get(),
        db.ref(`roles/${resolved.uid}`).get(),
    ]);
    if (!superAdmin && (!memberSnapshot || !memberSnapshot.exists())) {
        throw new FinanceValidationError(
            'Membership financeira não encontrada para o tenant.',
            'permission-denied',
        );
    }
    if (isInactiveAccessRecord(memberSnapshot) || isInactiveAccessRecord(roleSnapshot)) {
        throw new FinanceValidationError(
            'Membro ou perfil de acesso financeiro está inativo.',
            'permission-denied',
        );
    }
    if (!superAdmin) {
        const member = memberSnapshot.val();
        const role = roleSnapshot && roleSnapshot.exists() ? roleSnapshot.val() : null;
        const roleCompanyId = String(role && (role.companyId || role.companyID || role.tenantId) || '').trim();
        const roleMatchesTenant = !!roleCompanyId && roleCompanyId === resolved.companyId;
        const explicitFinanceAccess = accessRecordAllowsFinance(member)
            || (roleMatchesTenant && accessRecordAllowsFinance(role));
        const operationalOwnerAccess = explicitFinanceAccess
            ? false
            : await hasLegacyOperationalOwnerFinanceAccess(db, resolved);
        if (!explicitFinanceAccess && !operationalOwnerAccess) {
            throw new FinanceValidationError(
                'Permissão financeira não concedida para o membro.',
                'permission-denied',
            );
        }
    }
    return resolved;
}

function configure(options = {}) {
    if (typeof options.isCallerSuperAdmin !== 'function') {
        throw new TypeError('isCallerSuperAdmin é obrigatório para configurar Finance Functions.');
    }
    configuredSuperAdminResolver = options.isCallerSuperAdmin;
}

function createHandlers(options = {}) {
    const database = options.database || (() => admin.database());
    const HttpsError = options.HttpsError || functionsV1.https.HttpsError;
    const isSuperAdmin = options.isSuperAdmin
        || ((context) => configuredSuperAdminResolver(context));
    const now = options.now || (() => new Date().toISOString());

    function throwInputAsHttps(error) {
        if (!(error instanceof FinanceValidationError)) throw error;
        const code = error.reason === 'unauthenticated'
            ? 'unauthenticated'
            : (error.reason === 'permission-denied' ? 'permission-denied' : 'invalid-argument');
        throw new HttpsError(code, error.message);
    }

    async function runAuthorized(context, action) {
        try {
            const db = database();
            const access = await assertFinanceAccess(context, db, isSuperAdmin);
            return await action(db, access);
        } catch (error) {
            if (error instanceof HttpsError) throw error;
            if (error instanceof FinanceValidationError) throwInputAsHttps(error);
            throw new HttpsError('unavailable', 'Transação financeira indisponível.');
        }
    }

    async function financeNextSequence(data, context) {
        return runAuthorized(context, async (db, access) => {
            let request;
            try {
                request = normalizeSequenceRequest(data);
            } catch (error) {
                throwInputAsHttps(error);
            }
            const reference = db.ref(
                `companies/${access.companyId}/sequences/${request.sequenceKey}`,
            );
            let decision;
            const transaction = await reference.transaction((current) => {
                decision = buildSequenceMutation(current, request, now());
                return decision.outcome === 'commit' ? decision.value
                    : (decision.outcome === 'idempotent' ? current : undefined);
            }, undefined, false);
            if (!decision || decision.outcome === 'conflict' || !transaction.committed) {
                throw new HttpsError('aborted', 'Conflito na sequência financeira.');
            }
            const authoritative = transaction.snapshot.val();
            const operation = authoritative
                && authoritative.operations
                && authoritative.operations[request.operationId];
            if (!operation || !operation.numero) {
                throw new HttpsError('internal', 'Sequência financeira sem confirmação autoritativa.');
            }
            return {
                success: true,
                tipo: request.type,
                numero: operation.numero,
                current: operation.current,
                idempotent: decision.outcome === 'idempotent',
            };
        });
    }

    async function financeCreateAccounts(data, context) {
        return runAuthorized(context, async (db, access) => {
            let request;
            let canonicalEntries;
            const nowIso = now();
            try {
                request = normalizeAccountCreateRequest(data);
                canonicalEntries = request.accounts.map((item) => ({
                    month: item.month,
                    account: buildCanonicalCreatedAccount(
                        item,
                        request,
                        access.companyId,
                        nowIso,
                    ),
                }));
            } catch (error) {
                throwInputAsHttps(error);
            }
            const reference = db.ref(`companies/${access.companyId}/financas/${request.type}`);
            let decision;
            const transaction = await reference.transaction((current) => {
                decision = buildAccountsCreateTreeMutation(
                    current,
                    request,
                    canonicalEntries,
                    nowIso,
                );
                return decision.outcome === 'commit' ? decision.tree
                    : (decision.outcome === 'idempotent' ? current : undefined);
            }, undefined, false);
            if (!decision || decision.outcome === 'conflict' || !transaction.committed) {
                throw new HttpsError('aborted', 'Conflito ao criar contas financeiras.');
            }
            const tree = transaction.snapshot.val() || {};
            const accounts = canonicalEntries.map((entry) => (
                tree && tree[entry.month] && tree[entry.month][entry.account.id]
            ));
            if (accounts.some((account) => !isPlainObject(account))) {
                throw new HttpsError('internal', 'Criação financeira sem confirmação autoritativa.');
            }
            return {
                success: true,
                idempotent: decision.outcome === 'idempotent',
                accounts,
            };
        });
    }

    async function financeUpdateAccount(data, context) {
        return runAuthorized(context, async (db, access) => {
            let request;
            try {
                request = normalizeAccountEditRequest(data);
                request.authorizedCompanyId = access.companyId;
            } catch (error) {
                throwInputAsHttps(error);
            }
            const reference = db.ref(`companies/${access.companyId}/financas/${request.type}`);
            let decision;
            const transaction = await reference.transaction((current) => {
                decision = buildAccountEditTreeMutation(current, request, now());
                return decision.outcome === 'commit' ? decision.tree
                    : (decision.outcome === 'idempotent' ? current : undefined);
            }, undefined, false);
            if (!decision || decision.outcome === 'not-found') {
                throw new HttpsError('not-found', 'Conta financeira não encontrada para edição.');
            }
            if (decision.outcome === 'invalid') {
                throw new HttpsError('invalid-argument', decision.reason);
            }
            if (decision.outcome === 'conflict' || !transaction.committed) {
                throw new HttpsError('aborted', 'Conflito ao editar a conta financeira.');
            }
            const tree = transaction.snapshot.val() || {};
            const account = tree
                && tree[request.toMonth]
                && tree[request.toMonth][request.accountId];
            if (!isPlainObject(account)) {
                throw new HttpsError('internal', 'Edição financeira sem confirmação autoritativa.');
            }
            return {
                success: true,
                idempotent: decision.outcome === 'idempotent',
                revision: account.revision,
                account,
            };
        });
    }

    async function financeDeleteAccount(data, context) {
        return runAuthorized(context, async (db, access) => {
            let request;
            try {
                request = normalizeAccountDeleteRequest(data);
            } catch (error) {
                throwInputAsHttps(error);
            }
            const fingerprint = accountDeleteFingerprint(request);
            const ledgerReference = db.ref(
                `companies/${access.companyId}/finance_operations/accountDeletes/${request.type}`,
            );
            const priorSnapshot = await ledgerReference.child(request.operationId).get();
            if (priorSnapshot && priorSnapshot.exists()) {
                const prior = priorSnapshot.val();
                if (
                    isPlainObject(prior)
                    && prior.kind === 'delete-account'
                    && prior.fingerprint === fingerprint
                    && prior.accountId === request.accountId
                ) {
                    return {
                        success: true,
                        deleted: true,
                        idempotent: true,
                        month: prior.deletedMonth || request.month,
                    };
                }
                throw new HttpsError('aborted', 'operationId já foi usado em outra exclusão.');
            }

            const reference = db.ref(
                `companies/${access.companyId}/financas/${request.type}`,
            );
            let decision;
            const transaction = await reference.transaction((current) => {
                decision = buildAccountDeleteTreeMutation(current, request);
                return decision.outcome === 'commit' ? decision.tree : undefined;
            }, undefined, false);
            if (!decision || decision.outcome === 'not-found') {
                const retrySnapshot = await ledgerReference.child(request.operationId).get();
                if (retrySnapshot && retrySnapshot.exists()) {
                    const prior = retrySnapshot.val();
                    if (prior && prior.fingerprint === fingerprint) {
                        return {
                            success: true,
                            deleted: true,
                            idempotent: true,
                            month: prior.deletedMonth || request.month,
                        };
                    }
                }
                throw new HttpsError('not-found', 'Conta financeira não encontrada para exclusão.');
            }
            if (decision.outcome === 'conflict' || !transaction.committed) {
                throw new HttpsError('aborted', 'Conflito ao excluir a conta financeira.');
            }
            const completedAt = now();
            let idempotencyRecorded = true;
            try {
                await ledgerReference.transaction((current) => {
                    const records = isPlainObject(current) ? current : {};
                    return pruneOperationRecords({
                        ...records,
                        [request.operationId]: {
                            kind: 'delete-account',
                            fingerprint,
                            accountId: request.accountId,
                            requestedMonth: request.month,
                            deletedMonth: decision.deletedMonth,
                            completedAt,
                        },
                    }, MAX_SEQUENCE_OPERATION_RECORDS, 'completedAt');
                }, undefined, false);
            } catch (_) {
                idempotencyRecorded = false;
            }
            return {
                success: true,
                deleted: true,
                idempotent: false,
                idempotencyRecorded,
                month: decision.deletedMonth,
            };
        });
    }

    async function financeUpdatePaymentReceipt(data, context) {
        return runAuthorized(context, async (db, access) => {
            let request;
            try {
                request = normalizeReceiptUpdateRequest(data);
                assertReceiptReference(request.receipt, access.companyId);
            } catch (error) {
                throwInputAsHttps(error);
            }
            const reference = db.ref(
                `companies/${access.companyId}/financas/${request.type}/${request.month}/${request.accountId}`,
            );
            let decision;
            const transaction = await reference.transaction((current) => {
                decision = buildReceiptMutation(current, request, now());
                return decision.outcome === 'commit' ? decision.account
                    : (decision.outcome === 'idempotent' ? current : undefined);
            }, undefined, false);
            if (!decision || decision.outcome === 'not-found') {
                throw new HttpsError('not-found', 'Conta financeira não encontrada.');
            }
            if (decision.outcome === 'invalid') {
                throw new HttpsError('invalid-argument', decision.reason);
            }
            if (decision.outcome === 'conflict' || !transaction.committed) {
                throw new HttpsError('aborted', 'Conflito ao atualizar o comprovante financeiro.');
            }
            const account = transaction.snapshot.val();
            if (!isPlainObject(account)) {
                throw new HttpsError('internal', 'Comprovante sem confirmação autoritativa.');
            }
            return {
                success: true,
                idempotent: decision.outcome === 'idempotent',
                revision: account.revision,
                account,
            };
        });
    }

    async function mutatePayment(data, context, kind) {
        return runAuthorized(context, async (db, access) => {
            let request;
            try {
                request = normalizePaymentRequest(data);
                assertPaymentReceiptRequest(request, access.companyId, kind);
            } catch (error) {
                throwInputAsHttps(error);
            }
            const reference = db.ref(
                `companies/${access.companyId}/financas/${request.type}/${request.month}/${request.accountId}`,
            );
            let decision;
            const transaction = await reference.transaction((current) => {
                decision = buildAccountMutation(current, request, kind, now());
                return decision.outcome === 'commit' ? decision.account
                    : (decision.outcome === 'idempotent' ? current : undefined);
            }, undefined, false);
            if (!decision || decision.outcome === 'not-found') {
                throw new HttpsError('not-found', 'Conta financeira não encontrada.');
            }
            if (decision.outcome === 'invalid') {
                throw new HttpsError('invalid-argument', decision.reason);
            }
            if (decision.outcome === 'conflict' || !transaction.committed) {
                throw new HttpsError('aborted', 'Conflito com a versão atual da conta financeira.');
            }
            const account = transaction.snapshot.val();
            if (!isPlainObject(account)) {
                throw new HttpsError('internal', 'Conta financeira sem confirmação autoritativa.');
            }
            return {
                success: true,
                idempotent: decision.outcome === 'idempotent',
                revision: account.revision,
                account,
            };
        });
    }

    return {
        financeNextSequence,
        financeCreateAccounts,
        financeUpdateAccount,
        financeDeleteAccount,
        financeUpdatePaymentReceipt,
        financeRegisterPayment: (data, context) => mutatePayment(data, context, 'register'),
        financeDeletePayment: (data, context) => mutatePayment(data, context, 'delete'),
    };
}

const handlers = createHandlers();

exports.configure = configure;
exports.financeNextSequence = functionsV1.https.onCall(handlers.financeNextSequence);
exports.financeCreateAccounts = functionsV1.https.onCall(handlers.financeCreateAccounts);
exports.financeUpdateAccount = functionsV1.https.onCall(handlers.financeUpdateAccount);
exports.financeDeleteAccount = functionsV1.https.onCall(handlers.financeDeleteAccount);
exports.financeUpdatePaymentReceipt = functionsV1.https.onCall(handlers.financeUpdatePaymentReceipt);
exports.financeRegisterPayment = functionsV1.https.onCall(handlers.financeRegisterPayment);
exports.financeDeletePayment = functionsV1.https.onCall(handlers.financeDeletePayment);
exports.__test = {
    FinanceValidationError,
    accessRecordAllowsFinance,
    assertFinanceAccess,
    assertPaymentReceiptRequest,
    assertReceiptReference,
    assertDeleteMutation,
    assertRegisterMutation,
    buildAccountsCreateTreeMutation,
    buildCanonicalCreatedAccount,
    buildAccountMutation,
    buildAccountDeleteTreeMutation,
    buildAccountEditTreeMutation,
    buildReceiptMutation,
    buildSequenceMutation,
    createHandlers,
    currentFinancialState,
    expectedStateMatches,
    isInactiveAccessRecord,
    moneyToCents,
    normalizeExpectedState,
    normalizeFinancialPatch,
    normalizeOperationId,
    normalizePaymentRequest,
    normalizeAccountCreateRequest,
    normalizeAccountEditRequest,
    normalizeAccountDeleteRequest,
    normalizeReceiptUpdateRequest,
    normalizeSequenceRequest,
    pruneOperationRecords,
    resolveAuthenticatedTenant,
    stableStringify,
};
