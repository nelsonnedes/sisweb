#!/usr/bin/env node
/**
 * audit-cachebusters.mjs
 *
 * Audita todos os arquivos HTML do projeto para identificar:
 * - Cachebusters estáticos vs dinâmicos (hash)
 * - Conflitos de versão entre scripts (mesmo .js com diferentes ?v=)
 * - Scripts sem cachebuster
 * - Múltiplas versões do Firebase SDK
 * - URLs externas vs locais
 */

import { readFileSync, readdirSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..');

const htmlFiles = readdirSync(ROOT).filter(f => f.endsWith('.html')).sort();

// Coletores
const scriptEntries = []; // { html, src, v, isHash, isExternal }
const firebaseSDKs = [];

function isHashVersion(v) {
    if (!v) return false;
    return /^[0-9a-f]{12}$/.test(v);
}

function analyzeHtml(filePath) {
    const html = readFileSync(filePath, 'utf-8');
    const fileName = filePath.replace(ROOT, '').replace(/\\/g, '/');

    // Encontra todos <script src="...">
    const scriptRegex = /<script[^>]*src\s*=\s*["']([^"']+?)(?:\?v=([^"'\s]*))?["']/gi;
    let match;
    while ((match = scriptRegex.exec(html)) !== null) {
        const src = match[1];
        const v = match[2] || null;
        const isExternal = src.startsWith('http') || src.startsWith('//') || src.startsWith('https');
        const isHash = isHashVersion(v);

        scriptEntries.push({ html: fileName, src, v, isHash, isExternal });

        // Detectar Firebase SDK
        if (src.includes('firebase')) {
            const versionMatch = src.match(/firebase[-.](\d+\.\d+\.\d+)/);
            if (versionMatch) {
                firebaseSDKs.push({ html: fileName, src, version: versionMatch[1] });
            } else if (v && /^\d/.test(v)) {
                firebaseSDKs.push({ html: fileName, src, version: v });
            }
        }
    }

    // Encontra document.write('<script src="...">')
    const docWriteRegex = /document\.write\s*\(\s*['"]<script[^>]*src\s*=\s*["']([^"']+?)(?:\?v=([^"'\s]*))?["']/gi;
    while ((match = docWriteRegex.exec(html)) !== null) {
        const src = match[1];
        const v = match[2] || null;
        scriptEntries.push({ html: fileName, src, v, isHash: isHashVersion(v), isExternal: src.startsWith('http') || src.startsWith('//') });
    }

    // Encontra import('./...')
    const importRegex = /import\s*\(\s*['"]\.\/([^"']+?)(?:\?v=([^"'\s]*))?["']/gi;
    while ((match = importRegex.exec(html)) !== null) {
        const src = match[1];
        const v = match[2] || null;
        scriptEntries.push({ html: fileName, src, v, isHash: isHashVersion(v), isExternal: false });
    }
}

// ─── Processar todos HTMLs ────────────────────────────────────────────────
for (const file of htmlFiles) {
    analyzeHtml(join(ROOT, file));
}

// ─── Relatório ────────────────────────────────────────────────────────────
console.log('\n' + '='.repeat(80));
console.log('📋 AUDITORIA DE CACHEBUSTERS — SISWEB');
console.log('='.repeat(80));

// 1. Estatísticas gerais
const totalScripts = scriptEntries.length;
const localScripts = scriptEntries.filter(e => !e.isExternal);
const externalScripts = scriptEntries.filter(e => e.isExternal);
const withHash = scriptEntries.filter(e => e.isHash && !e.isExternal);
const withStatic = localScripts.filter(e => e.v && !e.isHash);
const withoutVersion = localScripts.filter(e => !e.v);

console.log(`\n📊 Estatísticas:\n`);
console.log(`   Total de referências a scripts: ${totalScripts}`);
console.log(`   Scripts locais: ${localScripts.length}`);
console.log(`   Scripts externos: ${externalScripts.length}`);
console.log(`   Locais com hash dinâmico: ${withHash.length}`);
console.log(`   Locais com versionamento estático: ${withStatic.length}`);
console.log(`   Locais SEM cachebuster: ${withoutVersion.length}`);

// 2. Scripts locais SEM cachebuster
if (withoutVersion.length > 0) {
    console.log(`\n⚠️  SCRIPTS LOCAIS SEM CACHEBUSTER:\n`);
    for (const e of withoutVersion) {
        const exists = existsSync(join(ROOT, e.src)) ? '✅' : '❌';
        console.log(`   ${exists} ${e.html.padEnd(35)} ${e.src}`);
    }
}

// 3. Scripts com versionamento ESTÁTICO (não atualizados pelo inject-cachebusters)
if (withStatic.length > 0) {
    console.log(`\n⚠️  SCRIPTS COM VERSIONAMENTO ESTÁTICO (não-hash):\n`);
    for (const e of withStatic) {
        console.log(`   ${e.html.padEnd(35)} ${e.src} ?v=${e.v}`);
    }
}

// 4. Conflitos: mesmo .js com versões diferentes
const srcMap = {};
for (const e of localScripts) {
    if (!srcMap[e.src]) srcMap[e.src] = [];
    srcMap[e.src].push({ html: e.html, v: e.v, isHash: e.isHash });
}
console.log(`\n🔍 CONFLITOS DE VERSÃO (mesmo .js com versões diferentes):\n`);
let hasConflict = false;
for (const [src, refs] of Object.entries(srcMap)) {
    const versions = [...new Set(refs.map(r => r.v))].filter(Boolean);
    const hashVersions = refs.filter(r => r.isHash).length;
    const staticVersions = refs.filter(r => r.v && !r.isHash).length;
    if (versions.length > 1 || (hashVersions > 0 && staticVersions > 0)) {
        console.log(`   ⚠️  ${src}:`);
        for (const r of refs) {
            const tipo = r.isHash ? 'hash' : (r.v ? `static(${r.v})` : 'none');
            console.log(`        ${r.html.padEnd(35)} ${tipo}`);
        }
        console.log();
        hasConflict = true;
    }
}
if (!hasConflict) console.log(`   ✅ Nenhum conflito de versão encontrado.\n`);

// 5. Firebase SDK - versões múltiplas
console.log(`🔌 FIREBASE SDK:\n`);
const fbVersions = {};
for (const fb of firebaseSDKs) {
    if (!fbVersions[fb.version]) fbVersions[fb.version] = [];
    fbVersions[fb.version].push({ html: fb.html, src: fb.src });
}
if (Object.keys(fbVersions).length > 0) {
    for (const [ver, refs] of Object.entries(fbVersions)) {
        console.log(`   📦 v${ver}: ${refs.length} referência(s)`);
        for (const r of refs) {
            console.log(`        ${r.html.padEnd(35)} ${r.src}`);
        }
    }
    if (Object.keys(fbVersions).length > 1) {
        console.log(`\n   ⚠️  MÚLTIPLAS VERSÕES DO FIREBASE SDK DETECTADAS!\n`);
        console.log(`   Isso pode causar problemas de compatibilidade entre módulos.`);
        console.log(`   Recomendado: unificar para uma única versão.\n`);
    }
} else {
    console.log(`   Nenhum Firebase SDK detectado.\n`);
}

// 6. Top 10 HTMLs com mais scripts
console.log(`📄 HTMLs COM MAIS SCRIPTS:\n`);
const htmlCount = {};
for (const e of scriptEntries) {
    htmlCount[e.html] = (htmlCount[e.html] || 0) + 1;
}
const sorted = Object.entries(htmlCount).sort((a, b) => b[1] - a[1]).slice(0, 10);
for (const [html, count] of sorted) {
    console.log(`   ${count.toString().padStart(3)} scripts  ${html}`);
}

console.log('\n' + '='.repeat(80));
console.log('📋 FIM DA AUDITORIA');
console.log('='.repeat(80) + '\n');
