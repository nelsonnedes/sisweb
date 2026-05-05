const admin = require('firebase-admin');
const fs = require('fs');
const path = require('path');

const serviceAccount = require(path.resolve(__dirname, '..', 'service-account.json'));
if (!admin.apps.length) {
    admin.initializeApp({
        credential: admin.credential.cert(serviceAccount),
        databaseURL: 'https://sisweb-7ce82-default-rtdb.asia-southeast1.firebasedatabase.app'
    });
}

function readApiKey() {
    const source = fs.readFileSync(path.resolve(__dirname, '..', 'firebaseService.js'), 'utf8');
    const match = source.match(/apiKey:\s*"([^"]+)"/);
    if (!match) throw new Error('apiKey não encontrada em firebaseService.js');
    return String(match[1] || '');
}

async function callCallable(url, idToken, data) {
    const response = await fetch(url, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${idToken}`
        },
        body: JSON.stringify({ data: data || {} })
    });
    const payload = await response.json();
    if (!response.ok || payload.error) {
        throw new Error(`${url} falhou: ${JSON.stringify(payload)}`);
    }
    return payload.result || payload;
}

async function main() {
    const apiKey = readApiKey();
    const uid = 'HfrQ6ObQq2aSEoeEE4Ng9jpAolB3';
    const customToken = await admin.auth().createCustomToken(uid);
    const signInResp = await fetch(`https://identitytoolkit.googleapis.com/v1/accounts:signInWithCustomToken?key=${apiKey}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token: customToken, returnSecureToken: true })
    });
    const signInData = await signInResp.json();
    if (!signInResp.ok || !signInData.idToken) {
        throw new Error(`signInWithCustomToken falhou: ${JSON.stringify(signInData)}`);
    }
    const idToken = signInData.idToken;
    const createResult = await callCallable('https://us-central1-sisweb-7ce82.cloudfunctions.net/createPixPayment', idToken, { plan: 'monthly' });
    const payment = createResult.payment || {};
    const paymentId = String(payment.paymentId || '').trim();
    if (!paymentId) throw new Error(`createPixPayment sem paymentId: ${JSON.stringify(createResult)}`);
    console.log('SMOKE_CREATE_OK', JSON.stringify({ paymentId, status: payment.status, amount: payment.amount }));
    const dbSnap = await admin.database().ref(`subscriptionPayments/${paymentId}`).get();
    console.log('SMOKE_RTDB_OK', dbSnap.exists() ? 'exists' : 'missing', paymentId);
    const revalidateResult = await callCallable('https://us-central1-sisweb-7ce82.cloudfunctions.net/revalidatePixPayment', idToken, { paymentId });
    const revalidatePayment = revalidateResult.payment || {};
    console.log('SMOKE_REVALIDATE_OK', JSON.stringify({
        paymentId: revalidatePayment.paymentId || paymentId,
        status: revalidatePayment.status || '',
        providerStatus: revalidatePayment.providerStatus || ''
    }));
    const webhookNoTokenResp = await fetch('https://us-central1-sisweb-7ce82.cloudfunctions.net/mercadoPagoWebhook', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({})
    });
    console.log('SMOKE_WEBHOOK_NO_TOKEN_STATUS', webhookNoTokenResp.status);
    const webhookToken = String(process.env.MERCADO_PAGO_WEBHOOK_TOKEN_LOCAL || '').trim();
    const webhookWithTokenResp = await fetch(`https://us-central1-sisweb-7ce82.cloudfunctions.net/mercadoPagoWebhook?token=${encodeURIComponent(webhookToken)}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({})
    });
    const webhookWithTokenData = await webhookWithTokenResp.json();
    console.log('SMOKE_WEBHOOK_TOKEN_STATUS', webhookWithTokenResp.status, JSON.stringify(webhookWithTokenData));
}

main()
    .then(async () => {
        try { await Promise.all(admin.apps.map((app) => app.delete())); } catch (_) {}
        process.exit(0);
    })
    .catch(async (error) => {
        console.error('SMOKE_PIX_FAILED', error && error.message ? error.message : error);
        try { await Promise.all(admin.apps.map((app) => app.delete())); } catch (_) {}
        process.exit(1);
    });
