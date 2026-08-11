'use strict';

/**
 * sentry-functions.js — Espelho e consulta do Sentry para o painel admin.
 *
 * Arquitetura (Opção C — híbrida):
 *  - `sentrySyncIssues`  (callable, superadmin): consulta a Sentry API sob
 *    demanda e grava/atualiza o resumo sanitizado dos issues em
 *    system/sentry/issues no RTDB (leitura realtime no admin, custo zero).
 *  - `sentryGetIssueDetail` (callable, superadmin): retorna detalhes completos
 *    de um issue (com eventos recentes e topo do stack) para o botão
 *    "Copiar relatório" do admin — sem gravar nada.
 *  - `sentryWebhook`     (HTTP, token secreto no path): recebe webhooks do
 *    Sentry (novo issue/alerta) e grava o resumo sanitizado no RTDB em
 *    tempo real — alimenta o sininho do admin.
 *
 * SEGURANÇA:
 *  - O token da Sentry API (SENTRY_API_TOKEN) e o token do webhook
 *    (SENTRY_WEBHOOK_TOKEN) vivem APENAS em secrets das Functions.
 *  - Toda escrita vai para system/sentry/*, que nas rules do RTDB tem
 *    .write:false (só o Admin SDK das Functions escreve) e .read restrito
 *    a auth.token.superadmin == true.
 *  - Nenhum payload de dados é gravado: apenas metadados do issue
 *    (título, nível, página, company_id, release, contagens, datas) e o
 *    topo do stack com redação de campos sensíveis.
 */

const admin = require('firebase-admin');
const crypto = require('crypto');
const { onCall: onCallV2, onRequest: onRequestV2, HttpsError: HttpsErrorV2 } = require('firebase-functions/v2/https');
const { defineSecret } = require('firebase-functions/params');

let isCallerSuperAdminFn = null;

function configure(deps) {
    if (deps && typeof deps.isCallerSuperAdmin === 'function') {
        isCallerSuperAdminFn = deps.isCallerSuperAdmin;
    }
}

// ─── Configuração ───────────────────────────────────────────────────────────
const SENTRY_API_TOKEN = defineSecret('SENTRY_API_TOKEN');
const SENTRY_WEBHOOK_TOKEN = defineSecret('SENTRY_WEBHOOK_TOKEN');

const SENTRY_ORG = String(process.env.SENTRY_ORG || 'nelson-nedes-do-rosario-brito').trim();
const SENTRY_PROJECT = String(process.env.SENTRY_PROJECT || 'javascript-nextjs').trim();
const SENTRY_BASE = 'https://sentry.io';

const RTDB_ISSUES_PATH = 'system/sentry/issues';
const RTDB_META_PATH = 'system/sentry/meta';
const RTDB_WEBHOOK_PATH = 'system/sentry/webhook';

const MAX_ISSUES_STORED = 300;
const MAX_EVENT_FRAMES = 8;
const MAX_EVENTS_DETAIL = 5;

// Campos sensíveis redigidos em qualquer texto gravado/retornado
const SENSITIVE_PATTERN = /(password|passwd|senha|token|secret|authorization|cookie|api[_-]?key|credit|card|cvv|ssn|cpf)/i;

const LEVEL_ORDER = { fatal: 0, error: 1, warning: 2, info: 3, debug: 4 };

// ─── Helpers ────────────────────────────────────────────────────────────────

function redact(value, maxLen) {
    let text = String(value == null ? '' : value);
    if (SENSITIVE_PATTERN.test(text)) text = text.replace(SENSITIVE_PATTERN, '[REDACTED]');
    if (maxLen && text.length > maxLen) text = text.slice(0, maxLen) + '…';
    return text;
}

function safeTags(issue) {
    const tags = {};
    const raw = issue && issue.tags && typeof issue.tags === 'object' ? issue.tags : {};
    const allowed = ['company_id', 'companyId', 'page', 'release', 'data_issue', 'data_path', 'data_op', 'data_collection', 'app'];
    for (const key of allowed) {
        const value = raw[key] !== undefined && raw[key] !== null ? raw[key] : null;
        if (value !== null) tags[key] = redact(value, 200);
    }
    return tags;
}

function cleanIssue(issue) {
    if (!issue || typeof issue !== 'object') return null;
    const tags = safeTags(issue);
    const meta = issue.metadata && typeof issue.metadata === 'object' ? issue.metadata : {};
    return {
        id: redact(issue.id, 32),
        shortId: redact(issue.shortId, 32),
        title: redact(issue.title, 220),
        level: String(issue.level || 'error').slice(0, 16),
        status: String(issue.status || 'unresolved').slice(0, 24),
        isUnhandled: issue.isUnhandled === true,
        type: redact(meta.type, 60),
        message: redact(meta.value, 300),
        firstSeen: String(issue.firstSeen || '').slice(0, 40),
        lastSeen: String(issue.lastSeen || '').slice(0, 40),
        count: Math.max(0, parseInt(issue.count, 10) || 0),
        userCount: Math.max(0, parseInt(issue.userCount, 10) || 0),
        tags,
        project: String((issue.project && issue.project.slug) || SENTRY_PROJECT).slice(0, 80)
    };
}

function safeEvent(ev) {
    if (!ev || typeof ev !== 'object') return null;
    const exc = ev.exception && Array.isArray(ev.exception.values) ? ev.exception.values[0] : null;
    const frames = [];
    if (exc && exc.stacktrace && Array.isArray(exc.stacktrace.frames)) {
        for (const f of exc.stacktrace.frames.slice(-MAX_EVENT_FRAMES)) {
            frames.push({
                filename: redact(f.filename, 160),
                function: redact(f.function || '<anon>', 120),
                line: f.lineNo || null,
                col: f.colNo || null,
                inApp: f.inApp === true
            });
        }
    }
    const request = ev.request && typeof ev.request === 'object' ? ev.request : {};
    return {
        eventID: redact(ev.eventID, 40),
        timestamp: String(ev.timestamp || ev.dateReceived || '').slice(0, 40),
        level: String(ev.level || '').slice(0, 16),
        message: redact(exc && exc.value ? exc.value : (ev.message || ''), 300),
        type: redact(exc && exc.type ? exc.type : '', 80),
        url: redact(request.url, 240),
        frames,
        tags: safeTags(ev)
    };
}

async function sentryApiGet(path, token) {
    const res = await fetch(SENTRY_BASE + path, {
        method: 'GET',
        headers: {
            Authorization: 'Bearer ' + token,
            Accept: 'application/json'
        }
    });
    const text = await res.text();
    let body = null;
    try { body = text ? JSON.parse(text) : null; } catch (_) { body = null; }
    if (!res.ok) {
        const detail = body && body.detail ? String(body.detail).slice(0, 200) : (body && body.error ? String(body.error).slice(0, 200) : 'HTTP ' + res.status);
        const err = new Error('Sentry API: ' + detail);
        err.status = res.status;
        throw err;
    }
    return body;
}

function levelRank(level) {
    return LEVEL_ORDER[String(level || 'error')] != null ? LEVEL_ORDER[String(level || 'error')] : 3;
}

async function assertSuperAdminCall(request) {
    if (typeof isCallerSuperAdminFn !== 'function') {
        throw new HttpsErrorV2('failed-precondition', 'Sentry functions não configuradas no bootstrap.');
    }
    if (!(await isCallerSuperAdminFn(request))) {
        throw new HttpsErrorV2('permission-denied', 'Apenas SuperAdmin pode acessar o monitoramento do Sentry.');
    }
}

async function writeIssues(issues, syncMeta) {
    const ref = admin.database().ref(RTDB_ISSUES_PATH);
    const metaRef = admin.database().ref(RTDB_META_PATH);
    const existingSnap = await ref.orderByKey().limitToLast(MAX_ISSUES_STORED * 2).get().catch(() => null);
    const existingKeys = existingSnap && existingSnap.exists() ? Object.keys(existingSnap.val()) : [];

    const updates = {};
    for (const clean of issues) {
        if (!clean || !clean.id) continue;
        updates[clean.id] = {
            ...clean,
            syncedAt: new Date().toISOString(),
            source: syncMeta.source || 'sync'
        };
    }

    // Prune: remove issues antigos além do teto (os mais antigos por firstSeen)
    const allKeys = Array.from(new Set([...existingKeys, ...Object.keys(updates)]));
    const pruneCandidates = [];
    for (const key of allKeys) {
        if (updates[key]) continue;
        pruneCandidates.push(key);
    }
    let beyond = Math.max(0, allKeys.length - MAX_ISSUES_STORED);
    pruneCandidates.sort((a, b) => a.localeCompare(b));
    while (beyond > 0 && pruneCandidates.length > 0) {
        updates[pruneCandidates.shift()] = null;
        beyond--;
    }

    if (Object.keys(updates).length > 0) {
        await ref.update(updates);
    }
    await metaRef.update(syncMeta);
    return { stored: Object.keys(updates).filter((k) => updates[k] !== null).length, total: allKeys.length };
}

// ─── 1) Sync sob demanda pela Sentry API ─────────────────────────────────────
exports.sentrySyncIssues = onCallV2(
    { region: 'us-central1', secrets: [SENTRY_API_TOKEN] },
    async (request) => {
        await assertSuperAdminCall(request);
        const token = SENTRY_API_TOKEN.value();
        if (!token) {
            throw new HttpsErrorV2('failed-precondition', 'SENTRY_API_TOKEN não configurado (secrete nas Cloud Functions).');
        }
        const VALID_STATS = new Set(['', '24h', '14d']);
        const requested = String((request && request.data && request.data.statsPeriod) || '').replace(/[^a-zA-Z0-9]/g, '');
        const statsPeriod = VALID_STATS.has(requested) ? requested : '14d';
        const query = String((request && request.data && request.data.query) || '').slice(0, 200);
        const params = new URLSearchParams({ statsPeriod, limit: '100' });
        if (query) params.set('query', query);
        const path = '/api/0/projects/' + encodeURIComponent(SENTRY_ORG) + '/' + encodeURIComponent(SENTRY_PROJECT) + '/issues/?' + params.toString();

        let issues;
        try {
            issues = await sentryApiGet(path, token);
        } catch (e) {
            const status = e && e.status;
            if (status === 401 || status === 403) {
                throw new HttpsErrorV2('permission-denied', 'Token da Sentry API inválido ou sem permissão project:read.');
            }
            throw new HttpsErrorV2('unavailable', 'Falha ao consultar a Sentry API: ' + (e && e.message ? e.message : String(e)));
        }

        const clean = (Array.isArray(issues) ? issues : []).map(cleanIssue).filter(Boolean);
        clean.sort((a, b) => levelRank(a.level) - levelRank(b.level) || String(a.lastSeen).localeCompare(String(b.lastSeen)));

        const nowIso = new Date().toISOString();
        const result = await writeIssues(clean, {
            lastSyncAt: nowIso,
            total: clean.length,
            source: 'sync',
            org: SENTRY_ORG,
            project: SENTRY_PROJECT
        });
        return { success: true, count: clean.length, stored: result.stored, syncedAt: nowIso };
    }
);

// ─── 2) Detalhe de um issue (para "Copiar relatório") ───────────────────────
exports.sentryGetIssueDetail = onCallV2(
    { region: 'us-central1', secrets: [SENTRY_API_TOKEN] },
    async (request) => {
        await assertSuperAdminCall(request);
        const token = SENTRY_API_TOKEN.value();
        if (!token) {
            throw new HttpsErrorV2('failed-precondition', 'SENTRY_API_TOKEN não configurado (secrete nas Cloud Functions).');
        }
        const issueId = String(request && request.data && request.data.issueId || '').replace(/[^0-9]/g, '').slice(0, 16);
        if (!issueId) {
            throw new HttpsErrorV2('invalid-argument', 'issueId inválido.');
        }

        let issue;
        let events;
        try {
            issue = await sentryApiGet('/api/0/issues/' + issueId + '/', token);
            const eventsRes = await sentryApiGet('/api/0/issues/' + issueId + '/events/?limit=' + MAX_EVENTS_DETAIL, token);
            events = (Array.isArray(eventsRes) ? eventsRes : []).map(safeEvent).filter(Boolean);
        } catch (e) {
            const status = e && e.status;
            if (status === 404) throw new HttpsErrorV2('not-found', 'Issue não encontrado na Sentry.');
            if (status === 401 || status === 403) {
                throw new HttpsErrorV2('permission-denied', 'Token da Sentry API inválido ou sem permissão.');
            }
            throw new HttpsErrorV2('unavailable', 'Falha ao consultar a Sentry API: ' + (e && e.message ? e.message : String(e)));
        }

        return {
            success: true,
            issue: cleanIssue(issue),
            events,
            requestedAt: new Date().toISOString()
        };
    }
);

// ─── 2b) Resolver um issue (marcar como resolvido na Sentry) ────────────────
exports.sentryResolveIssue = onCallV2(
    { region: 'us-central1', secrets: [SENTRY_API_TOKEN] },
    async (request) => {
        await assertSuperAdminCall(request);
        const token = SENTRY_API_TOKEN.value();
        if (!token) {
            throw new HttpsErrorV2('failed-precondition', 'SENTRY_API_TOKEN não configurado (secrete nas Cloud Functions).');
        }
        const issueId = String(request && request.data && request.data.issueId || '').replace(/[^0-9]/g, '').slice(0, 16);
        if (!issueId) {
            throw new HttpsErrorV2('invalid-argument', 'issueId inválido.');
        }

        let issue;
        try {
            const res = await fetch(SENTRY_BASE + '/api/0/issues/' + issueId + '/', {
                method: 'PUT',
                headers: {
                    Authorization: 'Bearer ' + token,
                    Accept: 'application/json',
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ status: 'resolved' })
            });
            const text = await res.text();
            let body = null;
            try { body = text ? JSON.parse(text) : null; } catch (_) { body = null; }
            if (!res.ok) {
                const detail = body && body.detail ? String(body.detail).slice(0, 200) : (body && body.error ? String(body.error).slice(0, 200) : 'HTTP ' + res.status);
                const err = new Error('Sentry API: ' + detail);
                err.status = res.status;
                throw err;
            }
            issue = body;
        } catch (e) {
            const status = e && e.status;
            if (status === 404) throw new HttpsErrorV2('not-found', 'Issue não encontrado na Sentry.');
            if (status === 401 || status === 403) {
                throw new HttpsErrorV2('permission-denied', 'Token da Sentry API inválido ou sem permissão.');
            }
            throw new HttpsErrorV2('unavailable', 'Falha ao resolver o issue na Sentry: ' + (e && e.message ? e.message : String(e)));
        }

        // Atualizar o RTDB para refletir o novo status (mantém histórico com status resolved)
        const clean = cleanIssue(issue);
        if (clean && clean.id) {
            try {
                await admin.database().ref(RTDB_ISSUES_PATH + '/' + clean.id).update({
                    ...clean,
                    resolvedAt: new Date().toISOString(),
                    source: 'resolve'
                });
            } catch (dbError) {
                console.warn('⚠️ Falha ao atualizar RTDB após resolver issue:', dbError);
            }
        }

        return { success: true, issue: clean, resolvedAt: new Date().toISOString() };
    }
);

// ─── 3) Webhook do Sentry (push realtime → sininho) ─────────────────────────
exports.sentryWebhook = onRequestV2(
    { region: 'us-central1', secrets: [SENTRY_WEBHOOK_TOKEN], cors: false },
    async (request, response) => {
        const expected = SENTRY_WEBHOOK_TOKEN.value();
        const got = String(request.query.token || '').trim();
        const headerGot = String(request.headers['x-sisweb-token'] || request.headers['x-sentry-webhook-token'] || '').trim();
        const candidate = got || headerGot;
        let valid = false;
        if (expected && candidate) {
            const a = Buffer.from(expected);
            const b = Buffer.from(candidate);
            valid = a.length === b.length && crypto.timingSafeEqual(a, b);
        }
        if (!valid) {
            response.status(401).json({ ok: false, error: 'invalid_token' });
            return;
        }
        if (request.method !== 'POST') {
            response.status(405).json({ ok: false, error: 'method_not_allowed' });
            return;
        }

        const payload = request.body && typeof request.body === 'object' ? request.body : {};
        const action = String(payload.action || '').slice(0, 32);
        const issueRaw = payload.data && typeof payload.data === 'object' ? payload.data.issue : null;
        const clean = issueRaw ? cleanIssue(issueRaw) : null;

        const webhookMeta = {
            lastAt: new Date().toISOString(),
            action,
            issueId: clean ? clean.id : null,
            ok: !!clean
        };
        try {
            if (clean && clean.id) {
                await admin.database().ref(RTDB_ISSUES_PATH + '/' + clean.id).update({
                    ...clean,
                    syncedAt: webhookMeta.lastAt,
                    source: 'webhook'
                });
            }
            await admin.database().ref(RTDB_WEBHOOK_PATH).update(webhookMeta);
        } catch (e) {
            webhookMeta.writeError = String((e && e.message) || e).slice(0, 200);
            response.status(200).json({ ok: false, stored: false, error: webhookMeta.writeError });
            return;
        }
        response.status(200).json({ ok: true, stored: !!clean });
    }
);

// Compatível com o padrão `financeFunctions.configure({...})` do index.js
exports.configure = configure;
