#!/usr/bin/env node

/**
 * test/finance-whitelist-audit.test.mjs
 *
 * Auditoria automatizada de whitelists do módulo financeiro.
 *
 * Extrai os campos usados no frontend (financas.js — conta.field)
 * e compara com as whitelists do backend (functions/finance-functions.js):
 *   - CREATABLE_MANUAL_ACCOUNT_FIELDS (criação manual)
 *   - EDITABLE_ACCOUNT_FIELDS (edição)
 *   - FINANCIAL_PATCH_FIELDS (baixa/pagamento)
 *
 * Uso:
 *   node test/finance-whitelist-audit.test.mjs        # saída verbosa
 *   node test/finance-whitelist-audit.test.mjs --ci    # saída silenciosa, exit code
 *   node test/finance-whitelist-audit.test.mjs --json  # saída JSON
 *
 * Exit codes:
 *   0 = OK (todos os campos do frontend estão cobertos ou ignorados intencionalmente)
 *   1 = FALHA (campo crítico do frontend NÃO está na whitelist)
 *   2 = ERRO (não foi possível ler/parsear os arquivos)
 */

import { readFileSync, existsSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, '..');

// ─── Config ────────────────────────────────────────────────────────────────

const BACKEND_FILE = resolve(ROOT, 'functions', 'finance-functions.js');
const FRONTEND_FILE = resolve(ROOT, 'financas.js');

// Campos do frontend que são intencionalmente NÃO enviados na CRIAÇÃO.
// Estes campos são gerenciados exclusivamente pelo patch de baixa ou são
// derivados de leitura. Ignorá-los na comparação de CREATE é correto.
const INTENTIONAL_CREATE_ONLY = new Set([
    'cnpjCpf',              // Apenas display, mapeado para cliente/fornecedor
    'fornecedorNome',       // Mapeado para 'fornecedor' antes do envio
    'clienteNome',          // Mapeado para 'cliente' antes do envio
    'valorPago',            // Gerenciado via patch de baixa (FINANCIAL_PATCH_FIELDS)
    'dataPagamento',        // Gerenciado via patch de baixa
    'metodoPagamento',      // Gerenciado via patch de baixa
    'observacoesPagamento', // Gerenciado via patch de baixa
    'comprovanteUrl',       // Gerenciado via patch de baixa
    'comprovanteStoragePath',// Gerenciado via patch de baixa
    'historicosPagamento',  // Gerenciado via patch de baixa
    'dataRecebimento',      // Derivação de leitura
    'funcionarioAtivo',     // Derivação de leitura
    'funcionarioNome',      // Derivação de leitura / edit-only
    'origemId',             // Apenas usado em lógica de romaneio, não enviado
    'origemTipo',           // Apenas usado em lógica de romaneio, não enviado
]);

// Campos do frontend que NÃO estão em EDITABLE_ACCOUNT_FIELDS mas é
// INTENCIONAL — o backend os ignora silenciosamente (não rejeita) ou
// são computados/copiados pelo backend durante a edição.
// Listar aqui para não poluir o relatório com falsos positivos.
const INTENTIONAL_EDIT_ONLY = new Set([
    'anexoUrl',             // Derivado de 'anexos' pelo backend pós-edição
    'cnpjCpf',              // Apenas display
    'comprovanteStoragePath',// Gerenciado via patch
    'comprovanteUrl',       // Gerenciado via patch
    'dataPagamento',        // Gerenciado via patch
    'dataRecebimento',      // Derivação de leitura
    'funcionarioAtivo',     // Derivação de leitura
    'historicosPagamento',  // Gerenciado via patch
    'jurosBaseDate',        // Gerenciado via patch de baixa
    'metodoPagamento',      // Gerenciado via patch
    'numero',               // Imutável após criação
    'observacoesPagamento', // Gerenciado via patch
    'origem',               // Imutável após criação
    'origemId',             // Imutável após criação
    'origemTipo',           // Imutável após criação
    'pedidoNumero',         // ← adicionado ao EDITABLE no fix anterior; mantido aqui p/ segurança
    'status',               // Recomputado pelo backend
    'tipo_pagamento',       // Sinônimo de 'tipoPagamento' (ambos aceitos)
    'valorPago',            // Recomputado pelo backend
    'valorRestante',        // Recomputado pelo backend
    'created',              // Imutável
]);

// Campos que a criação envia e que são ESPERADOS no patch de baixa.
// Usado para verificar se FINANCIAL_PATCH_FIELDS está completo.
const PATCH_MANAGED_FIELDS = new Set([
    'historicosPagamento', 'valorPago', 'valorRestante', 'status',
    'dataPagamento', 'metodoPagamento', 'observacoesPagamento',
    'comprovanteUrl', 'comprovanteStoragePath', 'jurosBaseDate',
]);

// Campos que são MANDATÓRIOS em cada whitelist — se faltarem, é falha.
const REQUIRED_IN_CREATE = new Set([
    'id', 'descricao', 'valor', 'valorOriginal',
    'dataVencimento', 'categoria', 'tipo',
]);
const REQUIRED_IN_EDIT = new Set([
    'id', 'descricao', 'valor', 'valorOriginal',
    'dataVencimento', 'categoria', 'tipo',
]);
const REQUIRED_IN_PATCH = new Set([
    'historicosPagamento', 'valorPago', 'valorRestante', 'status',
]);

// ─── Parsers ───────────────────────────────────────────────────────────────

/**
 * Extrai os campos de uma definição "new Set([\n  'campo1',\n  'campo2',\n])"
 */
function parseSetDefinition(text, setLabel) {
    const sets = [];
    const re = /(?:const|let|var)\s+(\w+)\s*=\s*new\s+Set\s*\(\s*\[([\s\S]*?)\]\s*\)/g;
    let match;
    while ((match = re.exec(text)) !== null) {
        const name = match[1];
        const body = match[2];
        const fields = [...body.matchAll(/'([^']+)'/g)].map(m => m[1]).sort();
        sets.push({ name, fields });
    }
    const target = sets.find(s => s.name === setLabel);
    if (!target) {
        throw new Error(`Set "${setLabel}" não encontrado em ${BACKEND_FILE}`);
    }
    return target.fields;
}

/**
 * Extrai campos usados no frontend (conta.X, account.X) em todo o arquivo
 * financas.js, filtrando falsos positivos (métodos de array, protótipo, etc.).
 */
function extractFrontendFields(source) {
    const fields = new Set();
    const IGNORE_METHODS = new Set([
        'forEach', 'map', 'filter', 'find', 'length', 'push',
        'sort', 'includes', 'some', 'every', 'indexOf',
        'reduce', 'keys', 'values', 'entries', 'constructor',
        'prototype', 'toString', 'hasOwnProperty',
    ]);

    // 1. conta.propriedade =
    const assignmentRe = /conta\s*\.\s*([a-zA-Z_$][a-zA-Z0-9_$]*)\s*=/g;
    let m;
    while ((m = assignmentRe.exec(source)) !== null) {
        if (!IGNORE_METHODS.has(m[1])) fields.add(m[1]);
    }

    // 2. conta["propriedade"] =
    const bracketRe = /conta\s*\[\s*['"]([^'"]+)['"]\s*\]\s*=/g;
    while ((m = bracketRe.exec(source)) !== null) {
        fields.add(m[1]);
    }

    // 3. account.propriedade = / account.propriedade:
    const accountFieldRe = /account\s*\.\s*([a-zA-Z_$][a-zA-Z0-9_$]*)\s*(?:[=:]|\|\||\?\?)/g;
    while ((m = accountFieldRe.exec(source)) !== null) {
        if (!IGNORE_METHODS.has(m[1])) fields.add(m[1]);
    }

    // 4. Object.assign(conta, { ... })
    const assignRe = /Object\s*\.\s*assign\s*\(\s*conta\s*,\s*\{([^}]+)\}/g;
    while ((m = assignRe.exec(source)) !== null) {
        const keyRe = /['"]?([a-zA-Z_$][a-zA-Z0-9_$]*)['"]?\s*:/g;
        let km;
        while ((km = keyRe.exec(m[1])) !== null) {
            fields.add(km[1]);
        }
    }

    return [...fields].sort();
}

/**
 * Extrai APENAS campos usados no fluxo de pagamento (função confirmarPagamento).
 * Estes devem estar cobertos por FINANCIAL_PATCH_FIELDS.
 */
function extractPaymentFields(source) {
    const fields = new Set();

    // Encontra a função confirmarPagamento
    const startMatch = source.match(/async\s+function\s+confirmarPagamento/);
    if (!startMatch) return [...fields].sort();
    const startIdx = startMatch.index;

    // Extrai ~5000 chars da função
    const snippet = source.slice(startIdx, startIdx + 5000);

    // Captura conta.propriedade = dentro de confirmarPagamento
    const re = /conta\s*\.\s*([a-zA-Z_$][a-zA-Z0-9_$]*)\s*(?:=|:)/g;
    let m;
    while ((m = re.exec(snippet)) !== null) {
        if (!['forEach', 'map', 'filter', 'find', 'length', 'push',
              'sort', 'includes', 'some', 'every', 'indexOf',
              'reduce', 'keys', 'values', 'entries', 'constructor',
              'prototype', 'toString', 'hasOwnProperty',
             ].includes(m[1])) {
            fields.add(m[1]);
        }
    }

    return [...fields].sort();
}

// ─── Comparador ────────────────────────────────────────────────────────────

function findGaps(frontendFields, whitelist, label, ignoreFields = new Set(), mode = 'strict') {
    const whitelistSet = new Set(whitelist);
    const frontendSet = new Set(frontendFields);

    const missing = [];  // No frontend, mas deveria estar (apenas warn)
    const unexpected = []; // Na whitelist mas não no frontend (apenas info)
    const critical = [];  // No frontend, NÃO está na whitelist, e não está em ignoreFields

    // Mode 'strict': gaps são críticos (criação — backend rejeita)
    // Mode 'warn': gaps são apenas avisos (edição — backend ignora silenciosamente)
    // Mode 'patch': compara apenas campos gerenciados via patch

    if (mode === 'patch') {
        // Para patch, verifica apenas se campos gerenciados via patch estão
        // cobertos pela whitelist. Ignora campos de criação/edição.
        for (const field of PATCH_MANAGED_FIELDS) {
            if (frontendSet.has(field) && !whitelistSet.has(field)) {
                critical.push(field);
            }
            if (!whitelistSet.has(field)) {
                missing.push(field);
            }
        }
    } else {
        for (const field of frontendFields) {
            if (!whitelistSet.has(field) && !ignoreFields.has(field)) {
                critical.push(field);
            }
        }

        for (const field of whitelist) {
            if (!frontendSet.has(field)) {
                unexpected.push(field);
            }
        }
    }

    // Verifica campos obrigatórios
    const requiredMissing = [];
    const requiredFields = label === 'criação' ? REQUIRED_IN_CREATE
        : label === 'edição' ? REQUIRED_IN_EDIT
        : label === 'baixa' ? REQUIRED_IN_PATCH
        : new Set();

    for (const req of requiredFields) {
        if (!whitelistSet.has(req)) {
            requiredMissing.push(req);
        }
    }

    return { missing, unexpected, critical, requiredMissing };
}

// ─── Relatório ─────────────────────────────────────────────────────────────

function formatReport(backend, frontendFields, results) {
    const lines = [];
    const divider = '─'.repeat(72);

    lines.push('');
    lines.push(divider);
    lines.push('  AUDITORIA DE WHITELISTS — MÓDULO FINANCEIRO');
    lines.push(divider);
    lines.push('');
    lines.push(`  Backend : ${BACKEND_FILE}`);
    lines.push(`  Frontend: ${FRONTEND_FILE}`);
    lines.push('');
    lines.push(`  Total campos frontend: ${frontendFields.length}`);
    lines.push(`  CREATABLE_MANUAL_ACCOUNT_FIELDS : ${backend.create.length}`);
    lines.push(`  EDITABLE_ACCOUNT_FIELDS          : ${backend.edit.length}`);
    lines.push(`  FINANCIAL_PATCH_FIELDS           : ${backend.patch.length}`);
    lines.push('');

    let hasCritical = false;

    for (const { label, result } of results) {
        lines.push(`  ── ${label.toUpperCase()} ──`);
        lines.push(`     Whitelist: ${result.label}  |  Modo: ${result.mode}`);
        lines.push('');

        const modeLabel = result.mode === 'strict' ? '🔴 CRÍTICO'
            : result.mode === 'warn' ? '🟡 ATENÇÃO'
            : result.mode === 'patch' ? '🔴 CRÍTICO (patch)'
            : '🔴';

        if (result.requiredMissing.length > 0) {
            lines.push(`     ❌ CAMPOS OBRIGATÓRIOS AUSENTES:`);
            for (const f of result.requiredMissing) {
                lines.push(`        - ${f}`);
            }
            lines.push('');
            hasCritical = true;
        }

        if (result.critical.length > 0) {
            lines.push(`     ${modeLabel} — Frontend envia, mas whitelist NÃO permite:`);
            for (const f of result.critical) {
                lines.push(`        - ${f}`);
            }
            lines.push('');
            hasCritical = hasCritical || result.mode !== 'warn';
        } else {
            lines.push(`     ✅ Nenhum gap — frontend e whitelist estão alinhados.`);
            lines.push('');
        }

        if (result.missing.length > 0) {
            const prefix = result.mode === 'patch'
                ? '     ⚠️  Campos gerenciados via patch NÃO estão na whitelist FINANCIAL_PATCH_FIELDS:'
                : '     ⚠️  Campos no frontend ignorados intencionalmente:';
            lines.push(prefix);
            for (const f of result.missing.sort()) {
                lines.push(`        - ${f}`);
            }
            lines.push('');
        }

        if (result.unexpected.length > 0) {
            lines.push(`     ℹ️  Campos na whitelist sem uso direto no frontend:`);
            for (const f of result.unexpected) {
                lines.push(`        - ${f}`);
            }
            lines.push('');
        }
    }

    lines.push(divider);
    if (hasCritical) {
        lines.push('  ❌ FALHA — Corrija os campos críticos antes do deploy.');
    } else {
        lines.push('  ✅ OK — Todas as whitelists estão alinhadas com o frontend.');
    }
    lines.push(divider);
    lines.push('');

    return { text: lines.join('\n'), hasCritical };
}

function buildJsonOutput(backend, frontendFields, paymentFields, results) {
    return {
        backend: {
            CREATABLE_MANUAL_ACCOUNT_FIELDS: backend.create,
            EDITABLE_ACCOUNT_FIELDS: backend.edit,
            FINANCIAL_PATCH_FIELDS: backend.patch,
        },
        frontendFields,
        paymentFields,
        results: results.map(r => ({
            whitelist: r.label,
            mode: r.mode,
            critical: r.result.critical,
            requiredMissing: r.result.requiredMissing,
            whitelistOnly: r.result.unexpected,
            pass: r.result.critical.length === 0 && r.result.requiredMissing.length === 0,
        })),
        // Modo 'warn' (edição) não causa falha — backend ignora campos extras silenciosamente
        pass: results.every(r =>
            (r.result.critical.length === 0 || r.mode === 'warn') &&
            r.result.requiredMissing.length === 0
        ),
    };
}

// ─── Main ──────────────────────────────────────────────────────────────────

async function main() {
    const args = process.argv.slice(2);
    const isCI = args.includes('--ci');
    const isJSON = args.includes('--json');

    // 1. Validar arquivos
    const errors = [];
    if (!existsSync(BACKEND_FILE)) errors.push(`Backend não encontrado: ${BACKEND_FILE}`);
    if (!existsSync(FRONTEND_FILE)) errors.push(`Frontend não encontrado: ${FRONTEND_FILE}`);
    if (errors.length > 0) {
        for (const e of errors) console.error(`[ERRO] ${e}`);
        process.exit(2);
    }

    // 2. Ler arquivos
    let backendSource;
    let frontendSource;
    try {
        backendSource = readFileSync(BACKEND_FILE, 'utf-8');
        frontendSource = readFileSync(FRONTEND_FILE, 'utf-8');
    } catch (err) {
        console.error(`[ERRO] Falha ao ler arquivos: ${err.message}`);
        process.exit(2);
    }

    // 3. Parsear whitelists do backend
    let backend;
    try {
        backend = {
            create: parseSetDefinition(backendSource, 'CREATABLE_MANUAL_ACCOUNT_FIELDS'),
            edit: parseSetDefinition(backendSource, 'EDITABLE_ACCOUNT_FIELDS'),
            patch: parseSetDefinition(backendSource, 'FINANCIAL_PATCH_FIELDS'),
        };
    } catch (err) {
        console.error(`[ERRO] Falha ao parsear backend: ${err.message}`);
        process.exit(2);
    }

    // 4. Extrair campos do frontend
    const frontendFields = extractFrontendFields(frontendSource);

    // 5. Extrair campos específicos do fluxo de pagamento
    const paymentFields = extractPaymentFields(frontendSource);

    // 6. Comparar
    const results = [
        {
            label: 'criação manual',
            mode: 'strict',
            result: findGaps(frontendFields, backend.create, 'criação', INTENTIONAL_CREATE_ONLY, 'strict'),
        },
        {
            label: 'edição (backend ignora silenciosamente extras)',
            mode: 'warn',
            result: findGaps(frontendFields, backend.edit, 'edição', INTENTIONAL_EDIT_ONLY, 'warn'),
        },
        {
            label: 'baixa (FINANCIAL_PATCH_FIELDS)',
            mode: 'patch',
            result: findGaps(paymentFields, backend.patch, 'baixa', new Set(), 'patch'),
        },
    ];

    // 6. Saída
    if (isJSON) {
        const output = buildJsonOutput(backend, frontendFields, paymentFields, results);
        console.log(JSON.stringify(output, null, 2));
        process.exit(output.pass ? 0 : 1);
    }

    const report = formatReport(backend, frontendFields, results);
    if (!isCI) {
        console.log(report.text);
        console.log('  Campos do frontend extraídos:');
        for (const f of frontendFields) {
            console.log(`    - ${f}`);
        }
        console.log('');
        console.log('  Campos usados no fluxo de pagamento (confirmarPagamento):');
        for (const f of paymentFields) {
            console.log(`    - ${f}`);
        }
        console.log('');
    }

    process.exit(report.hasCritical ? 1 : 0);
}

main();
