'use strict';

/**
 * mfa-functions.js — Autenticação de dois fatores (TOTP) para Super Admin.
 *
 * Arquitetura (Opção A — TOTP RFC 6238, sem dependência externa):
 *  - Geração/verificação de códigos TOTP (HMAC-SHA1, 6 dígitos, 30s) via crypto.
 *  - Secret armazenado CRIPTOGRAFADO (AES-256-GCM) em `system/superadmin/{uid}/mfa`.
 *    A proteção primária são as rules RTDB (system/* tem .write:false — só o
 *    Admin SDK escreve — e .read restrito a auth.token.superadmin); a cifração
 *    é defesa em profundidade (o secret nunca fica em plain text no DB).
 *  - Nenhum toque no login de tenants comuns: o gate 2FA é aplicado apenas
 *    quando o UID pertence à allowlist superadmin E o MFA está habilitado.
 *
 * Callables (todas exigem superadmin):
 *  - superAdminMfaStatus  → { enabled, hasSecret }
 *  - superAdminMfaSetup   → gera secret, grava cifrado (enabled=false), devolve
 *                           { secret (uma única vez), otpauthUri, label }
 *  - superAdminMfaConfirm → valida código contra o secret pendente e ativa (enabled=true)
 *  - superAdminMfaVerify  → valida código contra o secret ATIVO (desafio de login)
 *  - superAdminMfaDisable → remove o MFA do superadmin
 */

const admin = require('firebase-admin');
const crypto = require('crypto');
const functionsV1 = require('firebase-functions/v1');

// ─── Configuração externalizada (top-level, não espalhada) ──────────────────
const MFA_ISSUER = 'SisWeb';
const MFA_DIGITS = 6;
const MFA_PERIOD_SECONDS = 30;
const MFA_WINDOW = 1; // tolerância ±1 janela de 30s
const MFA_BASE_PATH = 'system/superadmin'; // protegido pelas rules (write:false)
const MFA_KEY_SALT = 'sisweb-mfa-v1';

const BASE32_ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';

let configuredSuperAdminResolver = async () => false;

function configure(options = {}) {
    if (typeof options.isCallerSuperAdmin !== 'function') {
        throw new TypeError('isCallerSuperAdmin é obrigatório para configurar MFA Functions.');
    }
    configuredSuperAdminResolver = options.isCallerSuperAdmin;
}

// ─── Base32 (RFC 4648, sem padding) ─────────────────────────────────────────
function base32Decode(input) {
    const str = String(input || '').toUpperCase().replace(/=+$/g, '').replace(/[\s-]/g, '');
    let bits = 0;
    let value = 0;
    const output = [];
    for (let i = 0; i < str.length; i += 1) {
        const idx = BASE32_ALPHABET.indexOf(str.charAt(i));
        if (idx < 0) continue;
        value = (value << 5) | idx;
        bits += 5;
        if (bits >= 8) {
            output.push((value >>> (bits - 8)) & 0xff);
            bits -= 8;
        }
    }
    return Buffer.from(output);
}

function base32Encode(buffer) {
    let bits = 0;
    let value = 0;
    let output = '';
    for (let i = 0; i < buffer.length; i += 1) {
        value = (value << 8) | buffer[i];
        bits += 8;
        while (bits >= 5) {
            output += BASE32_ALPHABET.charAt((value >>> (bits - 5)) & 31);
            bits -= 5;
        }
    }
    if (bits > 0) {
        output += BASE32_ALPHABET.charAt((value << (5 - bits)) & 31);
    }
    return output;
}

function generateSecret(bytes = 20) {
    return base32Encode(crypto.randomBytes(bytes));
}

// ─── HOTP/TOTP (RFC 4226/6238, HMAC-SHA1) ───────────────────────────────────
function totpCounter(nowMs) {
    return Math.floor(nowMs / 1000 / MFA_PERIOD_SECONDS);
}

function hotp(secretBuffer, counter, digits) {
    const buf = Buffer.alloc(8);
    buf.writeBigUInt64BE(BigInt(counter));
    const hmac = crypto.createHmac('sha1', secretBuffer).update(buf).digest();
    const offset = hmac[hmac.length - 1] & 0x0f;
    const binCode = ((hmac[offset] & 0x7f) << 24)
        | (hmac[offset + 1] << 16)
        | (hmac[offset + 2] << 8)
        | hmac[offset + 3];
    return (binCode % Math.pow(10, digits)).toString().padStart(digits, '0');
}

function totp(secretBuffer, counter, digits = MFA_DIGITS) {
    return hotp(secretBuffer, counter, digits);
}

function verifyTotp(secretBase32, code, opts = {}) {
    const digits = opts.digits || MFA_DIGITS;
    const window = opts.window == null ? MFA_WINDOW : opts.window;
    const nowMs = opts.nowMs || Date.now();
    const secretBuffer = base32Decode(secretBase32);
    if (secretBuffer.length === 0) return false;
    const normalized = String(code || '').trim().replace(/\s+/g, '');
    if (!new RegExp(`^\\d{${digits}}$`).test(normalized)) return false;
    const counter = totpCounter(nowMs);
    for (let i = -window; i <= window; i += 1) {
        if (totp(secretBuffer, counter + i, digits) === normalized) return true;
    }
    return false;
}

// ─── Cifração do secret em repouso (defesa em profundidade) ─────────────────
function deriveEncryptionKey() {
    const seed = String(
        process.env.SUPERADMIN_UIDS
        || process.env.SUPER_ADMIN_UIDS_RAW
        || 'sisweb'
    ) + '::' + MFA_KEY_SALT;
    return crypto.createHash('sha256').update(seed).digest();
}

function encryptSecret(plain) {
    const key = deriveEncryptionKey();
    const iv = crypto.randomBytes(12);
    const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);
    const data = Buffer.concat([cipher.update(plain, 'utf8'), cipher.final()]);
    const tag = cipher.getAuthTag();
    return {
        v: 1,
        iv: iv.toString('base64'),
        data: data.toString('base64'),
        tag: tag.toString('base64')
    };
}

function decryptSecret(payload) {
    if (!payload || payload.v !== 1 || !payload.iv || !payload.data || !payload.tag) return null;
    const key = deriveEncryptionKey();
    const decipher = crypto.createDecipheriv('aes-256-gcm', key, Buffer.from(payload.iv, 'base64'));
    decipher.setAuthTag(Buffer.from(payload.tag, 'base64'));
    try {
        return Buffer.concat([
            decipher.update(Buffer.from(payload.data, 'base64')),
            decipher.final()
        ]).toString('utf8');
    } catch (_) {
        return null;
    }
}

// ─── Helpers de acesso ──────────────────────────────────────────────────────
async function requireSuperAdmin(context) {
    const allowed = await configuredSuperAdminResolver(context);
    if (!allowed) {
        throw new functionsV1.https.HttpsError('permission-denied', 'Apenas superadmin pode executar esta operação.');
    }
    return String(context.auth.uid);
}

function mfaRefFor(uid) {
    return admin.database().ref(`${MFA_BASE_PATH}/${uid}/mfa`);
}

function callerLabel(context, uid) {
    const email = context && context.auth && context.auth.token && context.auth.token.email;
    return String(email || uid || '');
}

function buildOtpAuthUri(secret, label) {
    const encodedLabel = encodeURIComponent(`${MFA_ISSUER}:${label}`);
    const query = `secret=${encodeURIComponent(secret)}&issuer=${encodeURIComponent(MFA_ISSUER)}&algorithm=SHA1&digits=${MFA_DIGITS}&period=${MFA_PERIOD_SECONDS}`;
    return `otpauth://totp/${encodedLabel}?${query}`;
}

// ─── Handlers ───────────────────────────────────────────────────────────────
const handlers = {
    async superAdminMfaStatus(data, context) {
        const uid = await requireSuperAdmin(context);
        const snap = await mfaRefFor(uid).get();
        const record = snap.exists() ? snap.val() : {};
        return {
            success: true,
            enabled: record.enabled === true,
            hasSecret: !!record.secret,
            createdAt: record.createdAt || null
        };
    },

    async superAdminMfaSetup(data, context) {
        const uid = await requireSuperAdmin(context);
        const label = callerLabel(context, uid);
        const secret = generateSecret();
        const now = Date.now();
        await mfaRefFor(uid).set({
            enabled: false,
            secret: encryptSecret(secret),
            createdAt: now,
            lastVerifiedAt: null
        });
        return {
            success: true,
            secret, // devolvido UMA única vez para exibição do QR
            otpauthUri: buildOtpAuthUri(secret, label),
            label,
            issuer: MFA_ISSUER,
            digits: MFA_DIGITS,
            period: MFA_PERIOD_SECONDS
        };
    },

    async superAdminMfaConfirm(data, context) {
        const uid = await requireSuperAdmin(context);
        const code = String((data && data.code) || '').trim();
        if (!code) {
            throw new functionsV1.https.HttpsError('invalid-argument', 'Código é obrigatório.');
        }
        const snap = await mfaRefFor(uid).get();
        if (!snap.exists()) {
            throw new functionsV1.https.HttpsError('failed-precondition', 'Nenhuma configuração MFA pendente.');
        }
        const record = snap.val();
        const secret = decryptSecret(record.secret);
        if (!secret || !verifyTotp(secret, code)) {
            return { success: true, ok: false };
        }
        await mfaRefFor(uid).update({ enabled: true, lastVerifiedAt: Date.now() });
        return { success: true, ok: true };
    },

    async superAdminMfaVerify(data, context) {
        const uid = await requireSuperAdmin(context);
        const code = String((data && data.code) || '').trim();
        if (!code) {
            throw new functionsV1.https.HttpsError('invalid-argument', 'Código é obrigatório.');
        }
        const snap = await mfaRefFor(uid).get();
        if (!snap.exists()) {
            return { success: true, ok: true }; // sem MFA cadastrado → nada a verificar
        }
        const record = snap.val();
        if (record.enabled !== true) {
            return { success: true, ok: true }; // MFA não ativo → login prossegue
        }
        const secret = decryptSecret(record.secret);
        const ok = !!secret && verifyTotp(secret, code);
        if (ok) {
            await mfaRefFor(uid).update({ lastVerifiedAt: Date.now() });
        }
        return { success: true, ok };
    },

    async superAdminMfaDisable(data, context) {
        const uid = await requireSuperAdmin(context);
        await mfaRefFor(uid).remove();
        return { success: true, ok: true };
    }
};

// ─── Exports ────────────────────────────────────────────────────────────────
exports.configure = configure;
exports.superAdminMfaStatus = functionsV1.https.onCall(handlers.superAdminMfaStatus);
exports.superAdminMfaSetup = functionsV1.https.onCall(handlers.superAdminMfaSetup);
exports.superAdminMfaConfirm = functionsV1.https.onCall(handlers.superAdminMfaConfirm);
exports.superAdminMfaVerify = functionsV1.https.onCall(handlers.superAdminMfaVerify);
exports.superAdminMfaDisable = functionsV1.https.onCall(handlers.superAdminMfaDisable);

exports.__test = {
    BASE32_ALPHABET,
    base32Decode,
    base32Encode,
    generateSecret,
    totpCounter,
    hotp,
    totp,
    verifyTotp,
    deriveEncryptionKey,
    encryptSecret,
    decryptSecret,
    buildOtpAuthUri,
    createHandlers: (deps = {}) => ({
        superAdminMfaStatus: handlers.superAdminMfaStatus,
        superAdminMfaSetup: handlers.superAdminMfaSetup,
        superAdminMfaConfirm: handlers.superAdminMfaConfirm,
        superAdminMfaVerify: handlers.superAdminMfaVerify,
        superAdminMfaDisable: handlers.superAdminMfaDisable
    })
};
