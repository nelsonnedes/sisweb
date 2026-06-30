#!/usr/bin/env node

const admin = require('firebase-admin');
const fs = require('fs');

const DEFAULT_DATABASE_URL = 'https://sisweb-7ce82-default-rtdb.asia-southeast1.firebasedatabase.app';
const AUDIT_TIMEOUT_MS = Number(process.env.AUDIT_COMPANY_LOGOS_TIMEOUT_MS || 60000);

function assertCredentialPath() {
  const credentialPath = String(process.env.GOOGLE_APPLICATION_CREDENTIALS || '').trim();
  if (credentialPath && !fs.existsSync(credentialPath)) {
    throw new Error(`Credencial Firebase não encontrada em GOOGLE_APPLICATION_CREDENTIALS: ${credentialPath}`);
  }
}

function withTimeout(promise, label) {
  let timer = null;
  const timeout = new Promise((_, reject) => {
    timer = setTimeout(() => {
      reject(new Error(`${label} excedeu ${AUDIT_TIMEOUT_MS}ms. Verifique credenciais, rede e FIREBASE_DATABASE_URL.`));
    }, AUDIT_TIMEOUT_MS);
  });
  return Promise.race([promise, timeout]).finally(() => {
    if (timer) clearTimeout(timer);
  });
}

function isBase64Like(value) {
  const raw = String(value || '').trim();
  if (!raw) return false;
  if (raw.startsWith('data:image/')) return true;
  return /^[A-Za-z0-9+/=]+$/.test(raw) && raw.length > 1000;
}

function estimateBytes(value) {
  const raw = String(value || '').trim();
  if (!raw) return 0;
  const comma = raw.indexOf(',');
  const payload = raw.startsWith('data:') && comma >= 0 ? raw.slice(comma + 1) : raw;
  return Math.max(0, Math.floor((payload.length * 3) / 4));
}

function pickLogoFields(company = {}) {
  const profile = company.profile && typeof company.profile === 'object' ? company.profile : {};
  return {
    rootLogo: company.logo || '',
    rootLogoBase64: company.logoBase64 || '',
    rootLogoData: company.logoData || '',
    profileLogo: profile.logo || '',
    profileLogoBase64: profile.logoBase64 || '',
    profileLogoData: profile.logoData || '',
    logoUrl: profile.logoUrl || company.logoUrl || '',
    logoStoragePath: profile.logoStoragePath || profile.logoPath || company.logoStoragePath || company.logoPath || ''
  };
}

async function main() {
  assertCredentialPath();
  if (!admin.apps.length) {
    admin.initializeApp({
      credential: admin.credential.applicationDefault(),
      databaseURL: process.env.FIREBASE_DATABASE_URL || DEFAULT_DATABASE_URL
    });
  }

  const snap = await withTimeout(admin.database().ref('companies').get(), 'Leitura de companies');
  const companies = snap.exists() && snap.val() && typeof snap.val() === 'object' ? snap.val() : {};
  const candidates = [];
  let withStorage = 0;
  let withUrl = 0;
  let estimatedBytes = 0;

  Object.entries(companies).forEach(([companyId, company]) => {
    const fields = pickLogoFields(company || {});
    if (fields.logoStoragePath) withStorage += 1;
    if (fields.logoUrl || /^https?:\/\//i.test(String(fields.profileLogo || fields.rootLogo || ''))) withUrl += 1;

    const base64Fields = Object.entries(fields)
      .filter(([key, value]) => /logo/i.test(key) && isBase64Like(value))
      .map(([key, value]) => {
        const bytes = estimateBytes(value);
        estimatedBytes += bytes;
        return { field: key, estimatedBytes: bytes };
      });

    if (base64Fields.length) {
      const profile = company && company.profile && typeof company.profile === 'object' ? company.profile : {};
      candidates.push({
        companyId,
        name: profile.name || profile.nome || company.name || company.nome || '',
        cnpj: profile.cnpj || company.cnpj || '',
        hasStoragePath: !!fields.logoStoragePath,
        hasLogoUrl: !!fields.logoUrl,
        base64Fields
      });
    }
  });

  const summary = {
    checkedCompanies: Object.keys(companies).length,
    companiesWithStorageLogo: withStorage,
    companiesWithLogoUrl: withUrl,
    companiesWithBase64Logo: candidates.length,
    estimatedBase64Bytes: estimatedBytes,
    dryRun: true,
    generatedAt: new Date().toISOString(),
    candidates
  };

  console.log(JSON.stringify(summary, null, 2));
}

main()
  .catch((error) => {
    console.error(JSON.stringify({
      success: false,
      error: error && error.message ? error.message : String(error)
    }, null, 2));
    process.exitCode = 1;
  })
  .finally(async () => {
    await Promise.all(admin.apps.map((app) => app.delete().catch(() => {})));
  });
