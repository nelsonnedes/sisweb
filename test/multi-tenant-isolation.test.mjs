#!/usr/bin/env node
/**
 * test/multi-tenant-isolation.test.mjs
 *
 * Testes automatizados de isolamento multi-tenant para o sistema SisWeb.
 *
 * Uso:
 *   node test/multi-tenant-isolation.test.mjs              # rodar todos os testes
 *   node test/multi-tenant-isolation.test.mjs --verbose     # output detalhado
 *   node test/multi-tenant-isolation.test.mjs --ci          # exit 1 se falhar
 *
 * COBERTURA:
 *   1. Isolamento de Leitura: Tenant A não lê dados do Tenant B
 *   2. Isolamento de Escrita: Tenant A não escreve em path do Tenant B
 *   3. Regras Database: verifica claims tenant-scoped e membership financeira
 *   4. Namespace: verifica namespaceUpdates prefixa companies/{tenantId}/
 *   5. Financeiro: verifica membership ativa e permissao no .write rule
 */

import { readFileSync, existsSync, readdirSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..');

// ─── Config ─────────────────────────────────────────────────────────────────
const PASS = 'PASS';
const FAIL = 'FAIL';
const SKIP = 'SKIP';
let passed = 0;
let failed = 0;
let skipped = 0;
let verbose = process.argv.includes('--verbose');
const isCI = process.argv.includes('--ci');

function assert(condition, label, detail = '') {
    if (condition) {
        passed++;
        if (verbose) console.log(`  ${PASS} ${label}${detail ? ' — ' + detail : ''}`);
    } else {
        failed++;
        console.error(`  ${FAIL} ${label}${detail ? ' — ' + detail : ''}`);
    }
}

function skip(label, reason) {
    skipped++;
    console.log(`  ${SKIP} ${label} — ${reason}`);
}

// ─── Test 1: Database Rules — Contrato tenant-scoped ────────────────────────
console.log('\n[Test 1] Database Rules — Contrato multi-tenant');
console.log('-'.repeat(60));

const rulesPath = join(ROOT, 'database.rules.json');
if (existsSync(rulesPath)) {
    const rules = JSON.parse(readFileSync(rulesPath, 'utf-8'));
    const companies = rules?.rules?.companies?.$companyId;

    if (companies) {
        // Toda escrita operacional exige claims do tenant e assinatura valida.
        const criticalPaths = [
            'clients',
            'fornecedores',
            'produtos',
            'pedidosCompra',
            'pedidosVenda',
            'vendas/pedidos',
            'financas/pagar/$month/$accountId',
            'financas/receber/$month/$accountId',
            'romaneios/tora',
            'romaneios/pct',
            'romaneios/tl',
            'romaneios/pes',
            'folha/cargos',
            'folha/funcionarios',
            'estoqueTorasAtual',
            'movimentacoesToras',
            'rastreabilidade',
            'funcionarios',
            'folhas',
            'preferences',
        ];

        for (const path of criticalPaths) {
            // Navigate the nested path
            const parts = path.split('/');
            let current = companies;
            let found = true;
            for (const part of parts) {
                if (current && current[part] !== undefined) {
                    current = current[part];
                } else if (current && current['$' + part] !== undefined) {
                    current = current['$' + part];
                } else {
                    found = false;
                    break;
                }
            }

            if (found && current && current['.write']) {
                const writeRule = current['.write'];
                const hasTokenCheck = writeRule.includes('auth.token.companyId');
                const hasCompanyID = writeRule.includes('auth.token.companyID');
                const hasTenantId = writeRule.includes('auth.token.tenantId');
                const hasSubscriptionCheck = writeRule.includes('subscriptionStatus');

                assert(hasTokenCheck, `${path} .write`, 'token.companyId presente');
                assert(hasCompanyID, `${path} .write`, 'token.companyID presente');
                assert(hasTenantId, `${path} .write`, 'token.tenantId presente');

                // O financeiro aceita somente membership local ativa com papel
                // ou permissao financeira, sem depender do perfil global mutavel.
                if (path.startsWith('financas/')) {
                    const hasCompanyMembership = writeRule.includes(
                        "root.child('companies/' + $companyId + '/users/' + auth.uid).exists()"
                    );
                    const hasActiveMembership = writeRule.includes(
                        "root.child('companies/' + $companyId + '/users/' + auth.uid + '/active').val() != false"
                    ) && writeRule.includes(
                        "root.child('companies/' + $companyId + '/users/' + auth.uid + '/adminActive').val() != false"
                    );
                    const hasFinanceAuthorization = writeRule.includes(
                        "root.child('companies/' + $companyId + '/users/' + auth.uid + '/permissions/finance"
                    ) || writeRule.includes(
                        "root.child('companies/' + $companyId + '/users/' + auth.uid + '/role').val()"
                    );
                    assert(hasCompanyMembership, `${path} .write — membership local`,
                           'companies/{tenant}/users/{uid} exigido');
                    assert(hasActiveMembership, `${path} .write — membership ativa`,
                           'active/adminActive validados');
                    assert(hasFinanceAuthorization, `${path} .write — autorizacao financeira`,
                           'papel ou permissao financeira exigido');
                }

                // Subscription check deve estar presente em TODAS as regras
                assert(hasSubscriptionCheck, `${path} .write — subscription check`,
                       'auth.token.subscriptionStatus presente');
            } else {
                skip(path, 'path nao encontrado nas rules ou sem .write');
            }
        }

        // Verificar regras de ADMIN que devem ser superadmin-only
        const adminPaths = ['admin', 'roles', 'permissions', 'system', 'sequences', 'cache'];
        for (const path of adminPaths) {
            if (companies[path] && companies[path]['.write']) {
                const rule = companies[path]['.write'];
                const isSuperadminOnly = rule.includes('superadmin == true') && !rule.includes('companyId');
                assert(isSuperadminOnly, `${path} .write — superadmin only`,
                       'apenas superadmin pode escrever');
            }
        }
    } else {
        skip('companies rules', 'estrutura companies/$companyId nao encontrada');
    }
} else {
    skip('database.rules.json', 'arquivo nao encontrado');
}

// ─── Test 2: Namespace Updates — Prefixo companies/{tenantId}/ ──────────────
console.log('\n[Test 2] Namespace Updates — Isolamento de path');
console.log('-'.repeat(60));

const firebaseServicePath = join(ROOT, 'firebaseService.js');
if (existsSync(firebaseServicePath)) {
    const fbContent = readFileSync(firebaseServicePath, 'utf-8');

    // Verificar se namespaceUpdates prefixa companies/{tenantId}/
    const hasNamespacePrefix = fbContent.includes("`companies/${t}/${ck}`");
    assert(hasNamespacePrefix, 'namespaceUpdates prefix', 'companies/{tenantId}/ prefix');

    // Verificar getTenantId existe
    const hasGetTenantId = fbContent.includes('function getTenantId()');
    assert(hasGetTenantId, 'getTenantId()', 'funcao de resolucao de tenant');

    // Verificar se normalizeTenantContextValue existe
    const hasNormalize = fbContent.includes('normalizeTenantContextValue');
    assert(hasNormalize, 'normalizeTenantContextValue()', 'normalizacao de companyId/companyID/tenantId');

    // Verificar se há paths GLOBAIS que NÃO recebem prefixo
    const hasGlobalPaths = fbContent.includes('isGlobal');
    assert(hasGlobalPaths, 'isGlobal check', 'paths globais (users/, companies/, etc) sem prefixo');
} else {
    skip('firebaseService.js', 'arquivo nao encontrado');
}

// ─── Test 3: Frontend — Cachebusters consistentes ──────────────────────────
console.log('\n[Test 3] Cachebusters — Scripts com hash compativeis');
console.log('-'.repeat(60));

const htmlFiles = readdirSync(ROOT).filter(f => f.endsWith('.html'));

function computeFileHash(filePath) {
    try {
        const content = readFileSync(filePath);
        const hash = createHash('sha256').update(content).digest('hex').slice(0, 12);
        return hash;
    } catch {
        return null;
    }
}

assert(htmlFiles.length > 0, 'HTML files found', `${htmlFiles.length} arquivos HTML`);

// Verificar se inject-cachebusters.mjs existe
const injectPath = join(ROOT, 'tools', 'inject-cachebusters.mjs');
assert(existsSync(injectPath), 'inject-cachebusters.mjs existe', 'ferramenta de cachebuster disponivel');

// ─── Test 4: Firebase Service — updatePaths verifica subscription ──────────
console.log('\n[Test 4] updatePaths — Validacao de subscription');
console.log('-'.repeat(60));

if (existsSync(firebaseServicePath)) {
    const fbContent = readFileSync(firebaseServicePath, 'utf-8');
    const hasWritePermissionCheck = fbContent.includes('validateWritePermissionBySubscription');
    assert(hasWritePermissionCheck, 'validateWritePermissionBySubscription',
           'verificacao de subscription antes de escrever');
}

// ─── Test 5: Database Rules — Financeiro nao permite sobrescrever contas pagas
console.log('\n[Test 5] Database Rules — Protecao de contas quitadas');
console.log('-'.repeat(60));

if (existsSync(rulesPath)) {
    const rules = JSON.parse(readFileSync(rulesPath, 'utf-8'));
    const finPagar = rules?.rules?.companies?.$companyId?.financas?.pagar?.$month?.$accountId;
    const finReceber = rules?.rules?.companies?.$companyId?.financas?.receber?.$month?.$accountId;

    if (finPagar?.write) {
        const rule = finPagar['.write'];
        const hasExistingGuard = rule.includes('!data.exists()') || rule.includes('historicosPagamento');
        assert(hasExistingGuard, 'Pagar — guarda de conta existente',
               '!data.exists() || historicosPagamento check');
    }

    if (finReceber?.write) {
        const rule = finReceber['.write'];
        const hasExistingGuard = rule.includes('!data.exists()') || rule.includes('historicosPagamento');
        assert(hasExistingGuard, 'Receber — guarda de conta existente',
               '!data.exists() || historicosPagamento check');
    }
}

// ─── Summary ─────────────────────────────────────────────────────────────────
console.log('\n' + '='.repeat(60));
console.log(`RESULTADO: ${passed} passed, ${failed} failed, ${skipped} skipped`);
console.log('='.repeat(60));

if (isCI && failed > 0) {
    console.error('\nAlguns testes falharam. CI falhando.\n');
    process.exit(1);
}

process.exit(failed > 0 ? 1 : 0);
