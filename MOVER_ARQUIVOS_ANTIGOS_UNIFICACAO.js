/**
 * 🗂️ SCRIPT PARA MOVER ARQUIVOS ANTIGOS - UNIFICAÇÃO ROMANEIOPCT
 * 
 * Após a unificação do sistema romaneiopct, este script move os arquivos
 * antigos para backup, mantendo apenas o sistema unificado em produção.
 * 
 * Data: Dezembro 2024
 * Versão: 1.0 Unificação
 */

const fs = require('fs');
const path = require('path');

// ========================================
// CONFIGURAÇÃO DOS ARQUIVOS
// ========================================

const CONFIG = {
    BACKUP_DIR: 'romaneiopct_backup_unificacao',
    TIMESTAMP: new Date().toISOString().replace(/[:.]/g, '-').split('T')[0]
};

// ✅ ARQUIVOS ANTIGOS A SEREM MOVIDOS PARA BACKUP
const ARQUIVOS_ANTIGOS = [
    // Sistema antigo principal
    'romaneiopct_modais.js',           // 200KB - ARQUIVO GIGANTE → SUBSTITUÍDO
    'romaneiopct_init.js',             // 49KB  - SUBSTITUÍDO POR romaneiopct-main.js
    'romaneiopct_tabela.js',           // 57KB  - SUBSTITUÍDO POR romaneiopct-tabela.js (unificado)
    'romaneiopct.js',                  // 24KB  - FUNCIONALIDADES INTEGRADAS
    
    // Arquivos de correção (integrados no sistema unificado)
    'romaneiopct_fix_errors.js',       // Correções integradas
    'romaneiopct_modal_fix.js',        // Correções integradas
    'correcao-navegacao-enter-pecasPorPacote.js', // Integrado em romaneiopct-main.js
    
    // Arquivos duplicados/conflitantes  
    'romaneiopct_modais_modified.js',  // Duplicação removida
    'romaneiopct_modais_backup.js',    // Backup conflitante
    
    // Scripts de teste e correção pontuais
    'teste-navegacao-enter-pecasPorPacote.js',
    'romaneiopct-client-modal-fix.js'
];

// ✅ ARQUIVOS DO SISTEMA UNIFICADO (MANTER)
const ARQUIVOS_UNIFICADOS = [
    'romaneiopct.html',                // HTML atualizado
    'romaneiopct-main.js',             // Sistema principal unificado
    'romaneiopct-tabela.js',           // Sistema de tabela unificado
    'romaneiopct-calculos.js',         // Cálculos específicos PCT
    'romaneiopct-impressao.js',        // Sistema de impressão unificado
    
    // Sistemas reutilizados (já existentes)
    'species-manager.js',              // Sistema unificado de espécies
    'standardized-client-modal.js',    // Sistema unificado de clientes
    'utils.js',                        // Utilitários core
    'data-functions.js',               // Funções de dados
    'auth.js',                         // Autenticação
    'validation-system.js',            // Sistema de validação
    'cache-system.js'                  // Sistema de cache
];

// ========================================
// FUNÇÕES AUXILIARES
// ========================================

function criarDiretorioBackup() {
    const backupPath = path.join(__dirname, CONFIG.BACKUP_DIR);
    
    if (!fs.existsSync(backupPath)) {
        fs.mkdirSync(backupPath, { recursive: true });
        console.log(`📁 Diretório de backup criado: ${backupPath}`);
    }
    
    return backupPath;
}

function arquivoExiste(arquivo) {
    return fs.existsSync(path.join(__dirname, arquivo));
}

function moverArquivo(arquivo, backupDir) {
    const origem = path.join(__dirname, arquivo);
    const destino = path.join(backupDir, arquivo);
    
    try {
        if (fs.existsSync(origem)) {
            fs.renameSync(origem, destino);
            console.log(`✅ Movido: ${arquivo} → backup/`);
            return true;
        } else {
            console.log(`⚠️ Arquivo não encontrado: ${arquivo}`);
            return false;
        }
    } catch (error) {
        console.error(`❌ Erro ao mover ${arquivo}:`, error.message);
        return false;
    }
}

function obterTamanhoArquivo(arquivo) {
    try {
        const stats = fs.statSync(arquivo);
        return stats.size;
    } catch (error) {
        return 0;
    }
}

function formatarTamanho(bytes) {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

// ========================================
// FUNÇÃO PRINCIPAL
// ========================================

async function executarUnificacao() {
    console.log('🚀 INICIANDO UNIFICAÇÃO ROMANEIOPCT');
    console.log('=====================================');
    
    // ✅ CRIAR DIRETÓRIO DE BACKUP
    const backupDir = criarDiretorioBackup();
    
    // ✅ RELATÓRIO INICIAL
    console.log('\n📊 ANÁLISE DO SISTEMA ATUAL:');
    
    let totalArquivosAntigos = 0;
    let tamanhoTotalAntigo = 0;
    let totalArquivosUnificados = 0;
    let tamanhoTotalUnificado = 0;
    
    // Analisar arquivos antigos
    console.log('\n📋 Arquivos antigos identificados:');
    ARQUIVOS_ANTIGOS.forEach(arquivo => {
        if (arquivoExiste(arquivo)) {
            const tamanho = obterTamanhoArquivo(path.join(__dirname, arquivo));
            console.log(`  📄 ${arquivo} (${formatarTamanho(tamanho)})`);
            totalArquivosAntigos++;
            tamanhoTotalAntigo += tamanho;
        }
    });
    
    // Analisar arquivos unificados
    console.log('\n📋 Arquivos do sistema unificado:');
    ARQUIVOS_UNIFICADOS.forEach(arquivo => {
        if (arquivoExiste(arquivo)) {
            const tamanho = obterTamanhoArquivo(path.join(__dirname, arquivo));
            console.log(`  📄 ${arquivo} (${formatarTamanho(tamanho)})`);
            totalArquivosUnificados++;
            tamanhoTotalUnificado += tamanho;
        }
    });
    
    console.log('\n📊 RESUMO:');
    console.log(`  📁 Arquivos antigos: ${totalArquivosAntigos} (${formatarTamanho(tamanhoTotalAntigo)})`);
    console.log(`  📁 Sistema unificado: ${totalArquivosUnificados} (${formatarTamanho(tamanhoTotalUnificado)})`);
    console.log(`  🎯 Redução estimada: ${formatarTamanho(tamanhoTotalAntigo - tamanhoTotalUnificado)}`);
    
    // ✅ CONFIRMAÇÃO DO USUÁRIO
    console.log('\n⚠️  ATENÇÃO: Esta operação moverá os arquivos antigos para backup.');
    console.log('   Certifique-se de que o sistema unificado está funcionando corretamente.');
    
    // Para execução automatizada, remover esta parte
    const readline = require('readline');
    const rl = readline.createInterface({
        input: process.stdin,
        output: process.stdout
    });
    
    const resposta = await new Promise(resolve => {
        rl.question('\n🤔 Deseja continuar com a unificação? (s/n): ', resolve);
    });
    
    rl.close();
    
    if (resposta.toLowerCase() !== 's' && resposta.toLowerCase() !== 'sim') {
        console.log('❌ Operação cancelada pelo usuário.');
        return;
    }
    
    // ✅ MOVER ARQUIVOS ANTIGOS
    console.log('\n🔄 MOVENDO ARQUIVOS ANTIGOS PARA BACKUP...');
    
    let arquivosMovidos = 0;
    let erros = 0;
    
    for (const arquivo of ARQUIVOS_ANTIGOS) {
        if (moverArquivo(arquivo, backupDir)) {
            arquivosMovidos++;
        } else {
            erros++;
        }
    }
    
    // ✅ CRIAR ARQUIVO DE INFORMAÇÕES
    const infoUnificacao = {
        data: new Date().toISOString(),
        versao: '1.0',
        operacao: 'Unificação Romaneiopct',
        arquivosMovidos: arquivosMovidos,
        erros: erros,
        sistemaAnterior: {
            arquivos: totalArquivosAntigos,
            tamanho: tamanhoTotalAntigo,
            principal: 'romaneiopct_modais.js (200KB)'
        },
        sistemaUnificado: {
            arquivos: totalArquivosUnificados,
            tamanho: tamanhoTotalUnificado,
            arquivos_principais: [
                'romaneiopct-main.js',
                'romaneiopct-tabela.js', 
                'romaneiopct-calculos.js',
                'romaneiopct-impressao.js'
            ]
        },
        beneficios: [
            'Sistema modular e organizado',
            'Redução significativa de código',
            'Eliminação de duplicações',
            'Fácil manutenção',
            'Funcionalidades PCT preservadas 100%'
        ]
    };
    
    fs.writeFileSync(
        path.join(backupDir, 'INFO_UNIFICACAO.json'),
        JSON.stringify(infoUnificacao, null, 2)
    );
    
    // ✅ RELATÓRIO FINAL
    console.log('\n🎉 UNIFICAÇÃO CONCLUÍDA COM SUCESSO!');
    console.log('=====================================');
    console.log(`📁 Arquivos movidos para backup: ${arquivosMovidos}`);
    console.log(`❌ Erros: ${erros}`);
    console.log(`📂 Localização do backup: ${backupDir}`);
    
    console.log('\n✅ SISTEMA ROMANEIOPCT UNIFICADO ATIVO:');
    console.log('  📄 romaneiopct.html (interface atualizada)');
    console.log('  📄 romaneiopct-main.js (sistema principal)');
    console.log('  📄 romaneiopct-tabela.js (gestão de tabela)');
    console.log('  📄 romaneiopct-calculos.js (cálculos PCT)');
    console.log('  📄 romaneiopct-impressao.js (impressão PCT)');
    
    console.log('\n🎯 PRÓXIMOS PASSOS:');
    console.log('  1. Testar todas as funcionalidades do sistema');
    console.log('  2. Validar campo pecasPorPacote');
    console.log('  3. Testar sistema de impressão');
    console.log('  4. Verificar navegação Enter');
    console.log('  5. Confirmar salvamento de romaneios');
    
    console.log('\n💡 ROLLBACK: Se necessário, restaure os arquivos do backup.');
}

// ========================================
// EXECUÇÃO
// ========================================

if (require.main === module) {
    executarUnificacao().catch(error => {
        console.error('❌ Erro na unificação:', error);
        process.exit(1);
    });
}

module.exports = { executarUnificacao };

console.log('📋 Script de unificação carregado. Execute com: node MOVER_ARQUIVOS_ANTIGOS_UNIFICACAO.js');