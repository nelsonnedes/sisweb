#!/usr/bin/env node

const admin = require('firebase-admin');
const crypto = require('crypto');
const fs = require('fs');

const DEFAULT_DATABASE_URL = 'https://sisweb-7ce82-default-rtdb.asia-southeast1.firebasedatabase.app';
const DEFAULT_STORAGE_BUCKET = 'sisweb-7ce82.firebasestorage.app';
const MIGRATION_TIMEOUT_MS = Number(process.env.MIGRATE_COMPANY_LOGOS_TIMEOUT_MS || 120000);

function parseArgs(argv) {
  const options = {
    apply: false,
    cleanupBase64: false,
    forceExisting: false,
    companyId: '',
    limit: 0
  };

  argv.forEach((arg) => {
    const raw = String(arg || '').trim();
    if (raw === '--apply') options.apply = true;
    else if (raw === '--cleanup-base64') options.cleanupBase64 = true;
    else if (raw === '--force-existing') options.forceExisting = true;
    else if (raw.startsWith('--company-id=')) options.companyId = raw.slice('--company-id='.length).trim();
    else if (raw.startsWith('--limit=')) options.limit = Math.max(0, parseInt(raw.slice('--limit='.length), 10) || 0);
  });

  return options;
}

function assertCredentialPath() {
  const credentialPath = String(process.env.GOOGLE_APPLICATION_CREDENTIALS || '').trim();
  if (credentialPath && !fs.existsSync(credentialPath)) {
    throw new Error(`Credencial Firebase nao encontrada em GOOGLE_APPLICATION_CREDENTIALS: ${credentialPath}`);
  }
}

function withTimeout(promise, label) {
  let timer = null;
  const timeout = new Promise((_, reject) => {
    timer = setTimeout(() => {
      reject(new Error(`${label} excedeu ${MIGRATION_TIMEOUT_MS}ms. Verifique credenciais, rede e Firebase.`));
    }, MIGRATION_TIMEOUT_MS);
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

function parseBase64Image(value) {
  const raw = String(value || '').trim();
  if (!isBase64Like(raw)) throw new Error('Valor nao parece uma imagem base64.');

  let contentType = '';
  let payload = raw;
  const match = raw.match(/^data:([^;,]+);base64,(.+)$/);
  if (match) {
    contentType = match[1];
    payload = match[2];
  }

  const buffer = Buffer.from(payload, 'base64');
  if (!buffer.length) throw new Error('Imagem base64 vazia.');

  if (!contentType) {
    if (buffer.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))) {
      contentType = 'image/png';
    } else if (buffer.subarray(0, 3).equals(Buffer.from([0xff, 0xd8, 0xff]))) {
      contentType = 'image/jpeg';
    } else if (buffer.subarray(0, 4).toString('ascii') === 'RIFF' && buffer.subarray(8, 12).toString('ascii') === 'WEBP') {
      contentType = 'image/webp';
    } else if (buffer.subarray(0, 3).toString('ascii') === 'GIF') {
      contentType = 'image/gif';
    } else {
      contentType = 'image/png';
    }
  }

  const extByType = {
    'image/jpeg': 'jpg',
    'image/jpg': 'jpg',
    'image/png': 'png',
    'image/webp': 'webp',
    'image/gif': 'gif',
    'image/svg+xml': 'svg'
  };

  return {
    buffer,
    contentType,
    extension: extByType[contentType] || 'png'
  };
}

function sanitizeFilePart(value) {
  return String(value || 'logo').replace(/[^\w.\-]+/g, '_').slice(0, 80) || 'logo';
}

function collectLogoSources(company = {}) {
  const profile = company.profile && typeof company.profile === 'object' ? company.profile : {};
  return [
    { path: `profile/logo`, value: profile.logo },
    { path: `profile/logoBase64`, value: profile.logoBase64 },
    { path: `profile/logoData`, value: profile.logoData },
    { path: `logo`, value: company.logo },
    { path: `logoBase64`, value: company.logoBase64 },
    { path: `logoData`, value: company.logoData }
  ].filter((item) => isBase64Like(item.value));
}

function getExistingStorageInfo(company = {}) {
  const profile = company.profile && typeof company.profile === 'object' ? company.profile : {};
  return {
    logoUrl: String(profile.logoUrl || company.logoUrl || '').trim(),
    logoStoragePath: String(profile.logoStoragePath || profile.logoPath || company.logoStoragePath || company.logoPath || '').trim()
  };
}

function buildDownloadUrl(bucketName, storagePath, token) {
  return `https://firebasestorage.googleapis.com/v0/b/${bucketName}/o/${encodeURIComponent(storagePath)}?alt=media&token=${token}`;
}

async function uploadLogoToStorage(bucket, companyId, source, parsed) {
  const now = new Date().toISOString();
  const token = crypto.randomUUID();
  const safeCompanyId = sanitizeFilePart(companyId);
  const storagePath = `companies/${safeCompanyId}/profile/logo/migrated-${Date.now()}.${parsed.extension}`;
  const file = bucket.file(storagePath);

  await withTimeout(file.save(parsed.buffer, {
    resumable: false,
    metadata: {
      contentType: parsed.contentType,
      metadata: {
        firebaseStorageDownloadTokens: token,
        companyId: String(companyId),
        module: 'company-profile',
        kind: 'logo-migration',
        sourceField: source.path,
        migratedAt: now
      }
    }
  }), `Upload da logo ${companyId}`);

  return {
    storagePath,
    downloadURL: buildDownloadUrl(bucket.name, storagePath, token),
    updatedAt: now
  };
}

function buildUpdates(companyId, upload, parsed, source, options) {
  const base = `companies/${companyId}`;
  const updates = {
    [`${base}/logo`]: upload.downloadURL,
    [`${base}/logoUrl`]: upload.downloadURL,
    [`${base}/logoStoragePath`]: upload.storagePath,
    [`${base}/logoPath`]: upload.storagePath,
    [`${base}/logoFileName`]: `migrated-logo.${parsed.extension}`,
    [`${base}/logoContentType`]: parsed.contentType,
    [`${base}/logoSize`]: parsed.buffer.length,
    [`${base}/logoUpdatedAt`]: upload.updatedAt,
    [`${base}/profile/logo`]: upload.downloadURL,
    [`${base}/profile/logoUrl`]: upload.downloadURL,
    [`${base}/profile/logoStoragePath`]: upload.storagePath,
    [`${base}/profile/logoPath`]: upload.storagePath,
    [`${base}/profile/logoFileName`]: `migrated-logo.${parsed.extension}`,
    [`${base}/profile/logoContentType`]: parsed.contentType,
    [`${base}/profile/logoSize`]: parsed.buffer.length,
    [`${base}/profile/logoUpdatedAt`]: upload.updatedAt,
    [`${base}/profile/logoMigratedAt`]: upload.updatedAt,
    [`${base}/profile/logoMigrationSourceField`]: source.path
  };

  if (options.cleanupBase64) {
    [`${base}/logoBase64`, `${base}/logoData`, `${base}/profile/logoBase64`, `${base}/profile/logoData`]
      .forEach((path) => {
        updates[path] = null;
      });
  }

  return updates;
}

function buildCleanupBase64Updates(companyId) {
  const base = `companies/${companyId}`;
  return {
    [`${base}/logoBase64`]: null,
    [`${base}/logoData`]: null,
    [`${base}/profile/logoBase64`]: null,
    [`${base}/profile/logoData`]: null
  };
}

async function main() {
  const options = parseArgs(process.argv.slice(2));
  assertCredentialPath();

  if (!admin.apps.length) {
    admin.initializeApp({
      credential: admin.credential.applicationDefault(),
      databaseURL: process.env.FIREBASE_DATABASE_URL || DEFAULT_DATABASE_URL,
      storageBucket: process.env.FIREBASE_STORAGE_BUCKET || DEFAULT_STORAGE_BUCKET
    });
  }

  const companiesSnap = await withTimeout(admin.database().ref('companies').get(), 'Leitura de companies');
  const companies = companiesSnap.exists() && companiesSnap.val() && typeof companiesSnap.val() === 'object'
    ? companiesSnap.val()
    : {};
  const bucket = admin.storage().bucket();
  const results = [];
  let scanned = 0;
  let planned = 0;
  let migrated = 0;
  let skippedNoBase64 = 0;
  let skippedExistingStorage = 0;
  let cleanedBase64 = 0;
  let failed = 0;

  for (const [companyId, company] of Object.entries(companies)) {
    if (options.companyId && String(companyId) !== String(options.companyId)) continue;
    if (options.limit && scanned >= options.limit) break;
    scanned += 1;

    const sources = collectLogoSources(company || {});
    if (!sources.length) {
      skippedNoBase64 += 1;
      continue;
    }

    const existing = getExistingStorageInfo(company || {});
    if ((existing.logoUrl || existing.logoStoragePath) && !options.forceExisting) {
      if (options.cleanupBase64) {
        planned += 1;
        if (!options.apply) {
          results.push({
            companyId,
            action: 'dry-run-cleanup-existing-storage',
            sourceFields: sources.map((item) => item.path),
            existing
          });
          continue;
        }
        await withTimeout(
          admin.database().ref().update(buildCleanupBase64Updates(companyId)),
          `Limpeza de base64 ${companyId}`
        );
        cleanedBase64 += 1;
        results.push({
          companyId,
          action: 'cleaned-existing-storage-base64',
          sourceFields: sources.map((item) => item.path),
          existing
        });
        continue;
      }
      skippedExistingStorage += 1;
      results.push({
        companyId,
        action: 'skipped-existing-storage',
        sourceFields: sources.map((item) => item.path),
        existing
      });
      continue;
    }

    const source = sources[0];
    try {
      const parsed = parseBase64Image(source.value);
      const plannedStoragePath = `companies/${sanitizeFilePart(companyId)}/profile/logo/migrated-${Date.now()}.${parsed.extension}`;
      planned += 1;

      if (!options.apply) {
        results.push({
          companyId,
          action: 'dry-run',
          sourceField: source.path,
          allBase64Fields: sources.map((item) => item.path),
          contentType: parsed.contentType,
          bytes: parsed.buffer.length,
          plannedStoragePath
        });
        continue;
      }

      const upload = await uploadLogoToStorage(bucket, companyId, source, parsed);
      const updates = buildUpdates(companyId, upload, parsed, source, options);
      await withTimeout(admin.database().ref().update(updates), `Atualizacao do perfil ${companyId}`);
      migrated += 1;
      results.push({
        companyId,
        action: 'migrated',
        sourceField: source.path,
        allBase64Fields: sources.map((item) => item.path),
        storagePath: upload.storagePath,
        downloadURL: upload.downloadURL,
        contentType: parsed.contentType,
        bytes: parsed.buffer.length,
        cleanupBase64: options.cleanupBase64
      });
    } catch (error) {
      failed += 1;
      results.push({
        companyId,
        action: 'failed',
        sourceField: source.path,
        error: error && error.message ? error.message : String(error)
      });
    }
  }

  console.log(JSON.stringify({
    success: failed === 0,
    apply: options.apply,
    cleanupBase64: options.cleanupBase64,
    forceExisting: options.forceExisting,
    companyId: options.companyId || null,
    scannedCompanies: scanned,
    plannedMigrations: planned,
    migratedCompanies: migrated,
    skippedNoBase64,
    skippedExistingStorage,
    cleanedBase64,
    failed,
    generatedAt: new Date().toISOString(),
    results
  }, null, 2));
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
