'use strict';

const functions = require('firebase-functions');
const admin = require('firebase-admin');

const AUDIT_PATH = 'users';

function text(value, maxLength) {
    return String(value == null ? '' : value).trim().slice(0, maxLength);
}

function safeAccessSnapshot(value) {
    if (!value || typeof value !== 'object' || Array.isArray(value)) return {};
    const result = {};
    Object.keys(value).slice(0, 24).forEach((key) => {
        const item = value[key];
        if (typeof item === 'string') result[text(key, 64)] = text(item, 160);
        else if (typeof item === 'boolean' || typeof item === 'number') result[text(key, 64)] = item;
    });
    return result;
}

function resolveAuth(requestOrData, maybeContext) {
    const isV2 = requestOrData && typeof requestOrData === 'object' && Object.prototype.hasOwnProperty.call(requestOrData, 'data') && (Object.prototype.hasOwnProperty.call(requestOrData, 'auth') || Object.prototype.hasOwnProperty.call(requestOrData, 'rawRequest'));
    if (isV2) return { data: requestOrData.data || {}, auth: requestOrData.auth || null, rawRequest: requestOrData.rawRequest || null };
    return { data: requestOrData || {}, auth: maybeContext && maybeContext.auth ? maybeContext.auth : null, rawRequest: maybeContext && maybeContext.rawRequest ? maybeContext.rawRequest : null };
}

function getClientIp(rawRequest, dataUserAgent) {
    try {
        const headers = (rawRequest && rawRequest.headers) || {};
        const xff = String(headers['x-forwarded-for'] || headers['X-Forwarded-For'] || '').split(',')[0].trim();
        const realIp = String(headers['x-real-ip'] || headers['X-Real-Ip'] || '').trim();
        const remote = String((rawRequest && (rawRequest.ip || rawRequest.socket?.remoteAddress)) || '').trim();
        const candidate = (xff || realIp || remote || '').trim();
        if (!candidate || candidate === '::1' || candidate === '127.0.0.1') return candidate || '-';
        return candidate.slice(0, 45);
    } catch (_) { return '-'; }
}

function getUserAgent(rawRequest, dataUserAgent) {
    try {
        const headers = (rawRequest && rawRequest.headers) || {};
        const headerUa = String(headers['user-agent'] || headers['User-Agent'] || '').trim();
        const candidate = String(dataUserAgent || headerUa || '').trim();
        return candidate ? candidate.slice(0, 220) : '-';
    } catch (_) { return String(dataUserAgent || '-').slice(0, 220); }
}

exports.recordAdminAccessDenied = functions.https.onCall(async (requestOrData, maybeContext) => {
    const { data, auth, rawRequest } = resolveAuth(requestOrData, maybeContext);
    if (!auth || !auth.uid) {
        throw new functions.https.HttpsError('unauthenticated', 'Apenas usuários autenticados podem registrar auditoria.');
    }

    const uid = text(auth.uid, 128);
    const token = auth.token || {};
    const ip = getClientIp(rawRequest, null);
    const userAgent = getUserAgent(rawRequest, data && data.userAgent);
    const record = {
        at: new Date().toISOString(),
        reason: text(data && data.reason, 120) || 'admin_access_denied',
        page: 'admin.html',
        path: text(data && data.path, 300),
        uid,
        email: text(token.email, 180),
        username: text(token.name || token.displayName, 180),
        access: safeAccessSnapshot(data && data.access),
        userAgent,
        ip,
        recordedBy: uid,
    };
    const ref = admin.database().ref(`${AUDIT_PATH}/${uid}/securityAudit/adminAccessDenied`).push();
    await ref.set(record);
    return { ok: true, id: ref.key };
});
