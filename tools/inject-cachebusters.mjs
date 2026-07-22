#!/usr/bin/env node
/**
 * inject-cachebusters.mjs
 *
 * Lê todos os arquivos HTML do diretório raiz, encontra tags <script src="...">
 * que referenciam arquivos .js locais com cachebuster `?v=...`, computa o
 * hash SHA-256 dos primeiros 8 bytes do arquivo .js real e substitui o
 * cachebuster pelo hash (primeiros 12 caracteres hex).
 *
 * Uso:
 *   node tools/inject-cachebusters.mjs
 *
 * Isso substitui IN-PLACE os arquivos HTML. Execute ANTES de firebase deploy.
 */

import { readFileSync, writeFileSync, existsSync, statSync, readdirSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { join, dirname, extname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..');

function hashFile(filePath) {
    if (!existsSync(filePath)) return null;
    const stat = statSync(filePath);
    if (!stat.isFile()) return null;
    // Lê os primeiros 64KB para hash rápido (suficiente para uniqueness)
    const fd = readFileSync(filePath);
    const hash = createHash('sha256').update(fd).digest('hex');
    return hash.slice(0, 12); // primeiros 12 hex chars = 48 bits
}

function processHtml(filePath) {
    let html = readFileSync(filePath, 'utf-8');
    const original = html;

    // Regex: <script src="CAMINHO?v=QUALQUER_COISA">
    // Também captura document.write('<script src="...") e import('./...')
    const scriptTagRegex = /(<script[^>]*src\s*=\s*["'])([^"']+?)(\?v=[^"'\s]*)?(["'][^>]*>)/gi;
    const docWriteRegex = /(document\.write\s*\(\s*['"]<script[^>]*src\s*=\s*["'])([^"']+?)(\?v=[^"'\s]*)?(["'][^>]*><\\\/script>['"]\s*\))/gi;
    const importRegex = /(import\s*\(\s*['"]\.\/)([^"']+?)(\?v=[^"'\s]*)?(["'][\s)]*\))/gi;
    // Regex: import { ... } from './file.js?v=...'
    // Captura imports estáticos de ES Module
    const staticImportRegex = /(import\s+\{[^}]*\}\s+from\s+['"]\.\/)([^"']+?\.js)(\?v=[^"'\s]*)?(['"])/gi;

    let changed = false;

    // 1) Tags <script src="...">
    html = html.replace(scriptTagRegex, (match, prefix, srcPath, existingV, suffix) => {
        if (!srcPath.endsWith('.js')) return match;
        // Pular URLs absolutas (http, https, //)
        if (srcPath.startsWith('http') || srcPath.startsWith('//')) return match;

        const absPath = join(ROOT, srcPath);
        const h = hashFile(absPath);
        if (!h) return match; // arquivo não encontrado, deixa como está

        const newV = `?v=${h}`;
        changed = changed || (existingV !== newV);
        return `${prefix}${srcPath}${newV}${suffix}`;
    });

    // 2) document.write('<script src="...">')
    html = html.replace(docWriteRegex, (match, prefix, srcPath, existingV, suffix) => {
        if (!srcPath.endsWith('.js')) return match;
        if (srcPath.startsWith('http') || srcPath.startsWith('//')) return match;

        const absPath = join(ROOT, srcPath);
        const h = hashFile(absPath);
        if (!h) return match;

        const newV = `?v=${h}`;
        changed = changed || (existingV !== newV);
        return `${prefix}${srcPath}${newV}${suffix}`;
    });

    // 3) import('./file.js?v=...')
    html = html.replace(importRegex, (match, prefix, srcPath, existingV, suffix) => {
        if (!srcPath.endsWith('.js')) return match;
        const absPath = join(ROOT, srcPath);
        const h = hashFile(absPath);
        if (!h) return match;

        const newV = `?v=${h}`;
        changed = changed || (existingV !== newV);
        return `${prefix}${srcPath}${newV}${suffix}`;
    });

    // 4) import { ... } from './file.js?v=...' (ES Module static import)
    html = html.replace(staticImportRegex, (match, prefix, srcPath, existingV, suffix) => {
        if (!srcPath.endsWith('.js')) return match;
        if (srcPath.startsWith('http') || srcPath.startsWith('//')) return match;

        const absPath = join(ROOT, srcPath);
        const h = hashFile(absPath);
        if (!h) return match;

        const newV = `?v=${h}`;
        changed = changed || (existingV !== newV);
        return `${prefix}${srcPath}${newV}${suffix}`;
    });

    if (changed) {
        writeFileSync(filePath, html, 'utf-8');
        console.log(`  ✓ ${filePath.replace(ROOT, '').replace(/\\/g, '/')} — cachebusters atualizados`);
        return true;
    }
    return false;
}

// ─── Main ─────────────────────────────────────────────────────────────────
console.log('\n🔧 Injetando cachebusters dinâmicos...\n');

const htmlFiles = readdirSync(ROOT).filter(f => f.endsWith('.html'));
let updated = 0;
let total = 0;

for (const file of htmlFiles) {
    const filePath = join(ROOT, file);
    if (processHtml(filePath)) updated++;
    total++;
}

console.log(`\n✅ ${updated} arquivos atualizados de ${total} HTMLs processados.\n`);
