import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { test } from 'node:test';

const require = createRequire(import.meta.url);
const { __test } = require('../functions/mfa-functions.js');
const {
    base32Decode,
    generateSecret,
    totp,
    verifyTotp,
    encryptSecret,
    decryptSecret,
    buildOtpAuthUri
} = __test;

// Vetores oficiais RFC 6238 (Appendix B, HMAC-SHA1, 8 dígitos, secret ASCII "12345678901234567890")
const RFC_SECRET = '12345678901234567890';
const RFC_VECTORS = [
    { time: 59, otp: '94287082' },
    { time: 1111111109, otp: '07081804' },
    { time: 1111111111, otp: '14050471' },
    { time: 1234567890, otp: '89005924' },
    { time: 2000000000, otp: '69279037' },
    { time: 20000000000, otp: '65353130' }
];

test('TOTP: implementação reproduz os vetores oficiais RFC 6238 (SHA1, 8 dígitos)', () => {
    const secretBuffer = Buffer.from(RFC_SECRET, 'ascii');
    for (const v of RFC_VECTORS) {
        const counter = Math.floor(v.time / 30);
        assert.equal(totp(secretBuffer, counter, 8), v.otp, `falha em time=${v.time}`);
    }
});

test('TOTP: base32Decode/generateSecret geram secret válido (20 bytes) e decodificável', () => {
    const secret = generateSecret();
    assert.ok(/^[A-Z2-7]+$/.test(secret), 'secret deve ser base32 válido');
    assert.equal(secret.length, 32, '20 bytes base32 = 32 caracteres');
    const decoded = base32Decode(secret);
    assert.equal(decoded.length, 20, 'base32 decodifica de volta para 20 bytes');
});

test('TOTP: base32Decode é determinístico (RFC 4648)', () => {
    const decoded = base32Decode('JBSWY3DPEHPK3PXP');
    assert.equal(decoded.toString('hex'), '48656c6c6f21deadbeef', 'decodificação base32 padrão');
});

test('verifyTotp: aceita código correto na janela e rejeita inválidos', () => {
    const secret = generateSecret();
    const now = Date.now();
    const counter = Math.floor(now / 1000 / 30);
    const correct = totp(base32Decode(secret), counter, 6);

    assert.equal(verifyTotp(secret, correct, { nowMs: now }), true, 'código correto aceito');
    assert.equal(verifyTotp(secret, '000000', { nowMs: now }), false, 'código errado rejeitado');
    assert.equal(verifyTotp(secret, 'abc', { nowMs: now }), false, 'entrada não numérica rejeitada');
    assert.equal(verifyTotp('', correct, { nowMs: now }), false, 'secret vazio rejeitado');
});

test('verifyTotp: janela ±1 aceita código do passo anterior/seguinte', () => {
    const secret = generateSecret();
    const base = Date.now();
    const counter = Math.floor(base / 1000 / 30);
    const prev = totp(base32Decode(secret), counter - 1, 6);
    const next = totp(base32Decode(secret), counter + 1, 6);
    assert.equal(verifyTotp(secret, prev, { nowMs: base }), true, 'código do passo anterior aceito');
    assert.equal(verifyTotp(secret, next, { nowMs: base }), true, 'código do passo seguinte aceito');
});

test('cifração: encrypt/decrypt roundtrip preserva o secret e detecta adulteração', () => {
    const plain = 'JBSWY3DPEHPK3PXP';
    const payload = encryptSecret(plain);
    assert.notEqual(payload.data, plain, 'dado cifrado não é o plain text');
    assert.equal(decryptSecret(payload), plain, 'roundtrip restaura o secret');

    const tampered = { ...payload, data: Buffer.from('tampered').toString('base64') };
    assert.equal(decryptSecret(tampered), null, 'adulteração retorna null');
});

test('buildOtpAuthUri: gera URI otpauth://totp com parâmetros corretos', () => {
    const uri = buildOtpAuthUri('JBSWY3DPEHPK3PXP', 'super@sisweb.com');
    assert.ok(uri.startsWith('otpauth://totp/'), 'scheme otpauth://totp');
    assert.match(uri, /secret=JBSWY3DPEHPK3PXP/, 'secret presente');
    assert.match(uri, /issuer=SisWeb/, 'issuer presente');
    assert.match(uri, /algorithm=SHA1/, 'algorithm SHA1');
    assert.match(uri, /digits=6/, '6 dígitos');
    assert.match(uri, /period=30/, 'período 30s');
});

test('módulo: expõe as 5 callables e __test para registro no index.js', () => {
    const mfa = require('../functions/mfa-functions.js');
    for (const name of ['superAdminMfaStatus', 'superAdminMfaSetup', 'superAdminMfaConfirm', 'superAdminMfaVerify', 'superAdminMfaDisable']) {
        assert.ok(mfa[name], `callable ${name} deve estar exportada`);
    }
    assert.ok(mfa.configure, 'configure deve estar exportado');
    assert.ok(mfa.__test, '__test deve estar exportado para os testes');
});
