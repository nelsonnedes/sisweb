#!/usr/bin/env node
/**
 * 🔐 Script para Aplicar Regras de Segurança do Firebase
 * 
 * Este script facilita a aplicação das regras de segurança no Firebase Realtime Database
 * sem necessidade de usar o console manualmente.
 * 
 * Uso:
 *   node apply-firebase-rules.js [dev|prod] [--force]
 * 
 * Opções:
 *   - dev: Aplica regras de desenvolvimento (mais permissivas)
 *   - prod: Aplica regras de produção (mais restritivas)
 *   --force: Força a aplicação sem confirmação
 */

const fs = require('fs');
const path = require('path');

// Cores para output
const colors = {
    reset: '\x1b[0m',
    bright: '\x1b[1m',
    green: '\x1b[32m',
    yellow: '\x1b[33m',
    red: '\x1b[31m',
    blue: '\x1b[34m',
    cyan: '\x1b[36m'
};

function log(message, color = colors.reset) {
    console.log(`${color}${message}${colors.reset}`);
}

function error(message) {
    log(`❌ ${message}`, colors.red);
}

function success(message) {
    log(`✅ ${message}`, colors.green);
}

function warning(message) {
    log(`⚠️  ${message}`, colors.yellow);
}

function info(message) {
    log(`ℹ️  ${message}`, colors.cyan);
}

// Verificar se Firebase CLI está instalado
function checkFirebaseCLI() {
    try {
        const { execSync } = require('child_process');
        execSync('firebase --version', { stdio: 'ignore' });
        return true;
    } catch (err) {
        return false;
    }
}

// Carregar arquivo de regras
function loadRulesFile(env) {
    const filename = env === 'prod' ? 'firebase-rules-production.json' : 'firebase-rules-development.json';
    const filepath = path.join(__dirname, filename);
    
    if (!fs.existsSync(filepath)) {
        error(`Arquivo não encontrado: ${filename}`);
        process.exit(1);
    }
    
    try {
        const raw = fs.readFileSync(filepath, 'utf8');
        // Remover comentários // e /* ... */ para permitir JSON com comentários
        const noBlockComments = raw.replace(/\/*[\s\S]*?\*\//g, '');
        const noLineComments = noBlockComments.replace(/(^|\s)\/\/.*$/gm, '');
        const content = noLineComments;
        let rules = {};
        try {
            rules = JSON.parse(content);
        } catch (parseErr) {
            warning(`Falha ao parsear JSON (comentários detectados). Prosseguindo sem estatísticas detalhadas.`);
        }
        return { content, rules };
    } catch (err) {
        error(`Erro ao ler arquivo ${filename}: ${err.message}`);
        process.exit(1);
    }
}

// Aplicar regras via Firebase CLI
function applyRules(env, force = false) {
    const { content, rules } = loadRulesFile(env);
    
    log('\n🔐 Aplicação de Regras de Segurança do Firebase', colors.bright + colors.cyan);
    log('═══════════════════════════════════════════════════', colors.cyan);
    
    // Verificar Firebase CLI
    if (!checkFirebaseCLI()) {
        error('Firebase CLI não está instalado!');
        info('Instale com: npm install -g firebase-tools');
        process.exit(1);
    }
    
    // Mostrar informações
    info(`Ambiente: ${env === 'prod' ? 'PRODUÇÃO' : 'DESENVOLVIMENTO'}`);
    info(`Arquivo: firebase-rules-${env === 'prod' ? 'production' : 'development'}.json`);
    info(`Projeto: sisweb-7ce82`);
    
    // Estatísticas das regras
    log(`\n📊 Estatísticas das Regras:`, colors.bright);
    if (rules && rules.rules) {
        const ruleCount = Object.keys(rules.rules).length;
        log(`   - Total de paths: ${ruleCount}`);
        // Contar validações
        let validationCount = 0;
        function countValidations(obj) {
            for (const key in obj) {
                if (key === '.validate') validationCount++;
                if (key === '.read') log(`   - Leitura: ${obj[key]}`);
                if (key === '.write') log(`   - Escrita: ${obj[key]}`);
                if (typeof obj[key] === 'object' && obj[key] !== null) {
                    countValidations(obj[key]);
                }
            }
        }
        countValidations(rules.rules);
    } else {
        log('   - (Estatísticas indisponíveis; arquivo contém comentários não removíveis)', colors.yellow);
    }
    
    // Confirmar aplicação
    if (!force) {
        log(`\n⚠️  ATENÇÃO: Você está prestes a aplicar regras ${env === 'prod' ? 'RESTRITIVAS' : 'PERMISSIVAS'}`, colors.yellow);
        log(`   Estas regras ${env === 'prod' ? 'exigem autenticação e validações rigorosas' : 'permitem acesso sem autenticação'}`);
        log(`\n   Continuar? (yes/no): `, colors.cyan);
    }
    
    // Aplicar regras
    if (force || process.stdin.readableLength) {
        log('\n🚀 Aplicando regras...', colors.bright + colors.blue);
        
        try {
            const { execSync } = require('child_process');
            
            // Copiar arquivo para firebase.json temporariamente
            const tempFirebaseJson = path.join(__dirname, 'firebase.json.temp');
            const firebaseJsonPath = path.join(__dirname, 'firebase.json');
            
            // Ler firebase.json original
            let firebaseConfig = {};
            if (fs.existsSync(firebaseJsonPath)) {
                firebaseConfig = JSON.parse(fs.readFileSync(firebaseJsonPath, 'utf8'));
            }
            
            // Atualizar configuração de regras
            firebaseConfig.database = {
                rules: `firebase-rules-${env === 'prod' ? 'production' : 'development'}.json`
            };
            
            // Salvar backup
            if (fs.existsSync(firebaseJsonPath)) {
                fs.copyFileSync(firebaseJsonPath, tempFirebaseJson);
            }
            
            // Salvar firebase.json atualizado
            fs.writeFileSync(firebaseJsonPath, JSON.stringify(firebaseConfig, null, 2));
            
            // Aplicar via Firebase CLI
            execSync('firebase deploy --only database:rules', { 
                stdio: 'inherit',
                cwd: __dirname 
            });
            
            // Restaurar firebase.json
            if (fs.existsSync(tempFirebaseJson)) {
                fs.copyFileSync(tempFirebaseJson, firebaseJsonPath);
                fs.unlinkSync(tempFirebaseJson);
            }
            
            success('Regras aplicadas com sucesso!');
            log('\n📋 Próximos Passos:', colors.bright + colors.cyan);
            log('   1. Verifique as regras no Firebase Console');
            log('   2. Teste as funcionalidades do sistema');
            log('   3. Monitore os logs para erros');
            
            if (env === 'prod') {
                log('\n🔒 Regras de PRODUÇÃO aplicadas:', colors.bright + colors.green);
                log('   - Autenticação obrigatória');
                log('   - Validações rigorosas');
                log('   - Isolamento de dados por usuário');
            }
            
        } catch (err) {
            error(`Erro ao aplicar regras: ${err.message}`);
            
            // Restaurar firebase.json em caso de erro
            if (fs.existsSync(tempFirebaseJson)) {
                fs.copyFileSync(tempFirebaseJson, firebaseJsonPath);
                fs.unlinkSync(tempFirebaseJson);
            }
            
            process.exit(1);
        }
    }
}

// Verificar argumentos da linha de comando
const args = process.argv.slice(2);
const env = args[0] || 'dev';
const force = args.includes('--force');

if (!['dev', 'prod'].includes(env)) {
    error(`Ambiente inválido: ${env}`);
    log('\nUso: node apply-firebase-rules.js [dev|prod] [--force]');
    log('\nExemplos:');
    log('  node apply-firebase-rules.js dev          # Desenvolvimento');
    log('  node apply-firebase-rules.js prod         # Produção');
    log('  node apply-firebase-rules.js prod --force # Produção sem confirmação');
    process.exit(1);
}

// Aplicar regras
applyRules(env, force);

log('\n✨ Concluído!', colors.bright + colors.green);

