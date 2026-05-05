import fs from 'node:fs';
import path from 'node:path';

const inputPath = process.argv[2] || 'c:\\Sisweb\\sisweb-7ce82-default-rtdb-export (12).json';
const outputPath = process.argv[3] || 'c:\\Sisweb\\sisweb-7ce82-default-rtdb-export (12)-normalized.json';
const reportPath = process.argv[4] || 'c:\\Sisweb\\sisweb-7ce82-default-rtdb-export (12)-normalized-report.json';

const raw = fs.readFileSync(inputPath, 'utf8');
const json = JSON.parse(raw);

function toStr(v) {
    return String(v || '').trim();
}

function nowIso() {
    return new Date().toISOString();
}

function normalizeCliente(item, fallbackId) {
    const nome = toStr(item?.name || item?.nome);
    const estado = toStr(item?.state || item?.estado);
    const cidade = toStr(item?.city || item?.cidade);
    const telefone = toStr(item?.phone || item?.telefone);
    const endereco = toStr(item?.address || item?.endereco);
    const numero = toStr(item?.number || item?.numero);
    const bairro = toStr(item?.neighborhood || item?.bairro);
    const obs = toStr(item?.obs || item?.observacoes || item?.observations);
    const createdAt = item?.createdAt || item?.created || nowIso();
    const updatedAt = item?.updatedAt || item?.updated || nowIso();
    const id = toStr(item?.id || fallbackId || `CLI_${Date.now()}`);
    return {
        ...item,
        id,
        nome,
        name: nome,
        nomeCompleto: toStr(item?.nomeCompleto || nome),
        cnpj: toStr(item?.cnpj),
        estado,
        state: estado,
        cidade,
        city: cidade,
        telefone,
        phone: telefone,
        email: toStr(item?.email),
        endereco,
        address: endereco,
        numero,
        number: numero,
        bairro,
        neighborhood: bairro,
        obs,
        observacoes: obs,
        observations: obs,
        tipo: 'cliente',
        category: 'cliente',
        status: toStr(item?.status || 'ativo'),
        createdAt,
        updatedAt,
        created: createdAt,
        updated: updatedAt
    };
}

function normalizeFornecedor(item, fallbackId) {
    const nome = toStr(item?.name || item?.nome);
    const estado = toStr(item?.state || item?.estado);
    const cidade = toStr(item?.city || item?.cidade);
    const telefone = toStr(item?.phone || item?.telefone);
    const endereco = toStr(item?.address || item?.endereco);
    const obs = toStr(item?.obs || item?.observacoes || item?.observations);
    const createdAt = item?.createdAt || item?.created || nowIso();
    const updatedAt = item?.updatedAt || item?.updated || nowIso();
    const id = toStr(item?.id || fallbackId || `FOR_${Date.now()}`);
    const inscricao = toStr(item?.inscricaoEstadual || item?.stateRegistration);
    return {
        ...item,
        id,
        nome,
        name: nome,
        cnpj: toStr(item?.cnpj),
        inscricaoEstadual: inscricao,
        stateRegistration: inscricao,
        endereco,
        address: endereco,
        numero: toStr(item?.numero || item?.number),
        number: toStr(item?.number || item?.numero),
        bairro: toStr(item?.bairro || item?.neighborhood),
        neighborhood: toStr(item?.neighborhood || item?.bairro),
        estado,
        state: estado,
        cidade,
        city: cidade,
        telefone,
        phone: telefone,
        email: toStr(item?.email),
        observacoes: obs,
        observations: obs,
        obs,
        tipo: 'fornecedor',
        category: 'fornecedor',
        status: toStr(item?.status || 'ativo'),
        createdAt,
        updatedAt,
        created: createdAt,
        updated: updatedAt
    };
}

function qualityScore(entity) {
    const fields = ['name', 'cnpj', 'stateRegistration', 'phone', 'email', 'address', 'number', 'neighborhood', 'city', 'state', 'obs'];
    let score = 0;
    for (const f of fields) {
        if (toStr(entity?.[f])) score += 1;
    }
    const ts = Date.parse(entity?.updatedAt || entity?.updated || entity?.createdAt || entity?.created || '');
    if (!Number.isNaN(ts)) score += ts / 1e15;
    return score;
}

function normalizeNode(node, normalizeFn) {
    const map = node && typeof node === 'object' ? node : {};
    const groups = new Map();

    for (const key of Object.keys(map)) {
        const value = map[key];
        if (!value || typeof value !== 'object') continue;
        const normalized = normalizeFn(value, key);
        const canonicalId = toStr(normalized.id || key);
        if (!canonicalId) continue;
        if (!groups.has(canonicalId)) groups.set(canonicalId, []);
        groups.get(canonicalId).push({ key, value: normalized });
    }

    const out = {};
    let skippedNoName = 0;
    let mergedDuplicates = 0;

    for (const [id, entries] of groups.entries()) {
        const valid = entries.filter(e => toStr(e.value.name || e.value.nome));
        if (valid.length === 0) {
            skippedNoName += entries.length;
            continue;
        }
        valid.sort((a, b) => qualityScore(b.value) - qualityScore(a.value));
        out[id] = valid[0].value;
        mergedDuplicates += Math.max(0, valid.length - 1);
    }

    return {
        out,
        stats: {
            before: Object.keys(map).length,
            after: Object.keys(out).length,
            skippedNoName,
            mergedDuplicates
        }
    };
}

function getCompaniesRoot(doc) {
    if (doc?.companies && typeof doc.companies === 'object') return doc.companies;
    if (doc?.sisweb?.companies && typeof doc.sisweb.companies === 'object') return doc.sisweb.companies;
    return null;
}

const report = {
    inputPath,
    outputPath,
    reportPath,
    processedAt: nowIso(),
    companies: {}
};

const companiesRoot = getCompaniesRoot(json);
if (!companiesRoot) {
    throw new Error('Estrutura de companies não encontrada no JSON');
}

for (const companyId of Object.keys(companiesRoot)) {
    const company = companiesRoot[companyId];
    if (!company || typeof company !== 'object') continue;
    const clientsNorm = normalizeNode(company.clients || {}, normalizeCliente);
    const fornecedoresNorm = normalizeNode(company.fornecedores || {}, normalizeFornecedor);
    company.clients = clientsNorm.out;
    company.fornecedores = fornecedoresNorm.out;
    report.companies[companyId] = {
        clients: clientsNorm.stats,
        fornecedores: fornecedoresNorm.stats
    };
}

fs.writeFileSync(outputPath, JSON.stringify(json, null, 2), 'utf8');
fs.writeFileSync(reportPath, JSON.stringify(report, null, 2), 'utf8');

console.log(JSON.stringify({
    ok: true,
    outputPath: path.resolve(outputPath),
    reportPath: path.resolve(reportPath),
    companies: Object.keys(report.companies).length
}, null, 2));
