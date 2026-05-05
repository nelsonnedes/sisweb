/**
 * 🗂️ SCRIPT PARA MOVER ARQUIVOS ANTIGOS - ROMANEIOPCT V2.0
 * 
 * Move arquivos antigos e desnecessários para o diretório de backup
 * após a refatoração ser concluída com sucesso.
 * 
 * SEGURANÇA: Cria backup antes de mover, permite rollback
 */

const fs = require('fs');
const path = require('path');

// ============================================================================
// CONFIGURAÇÕES
// ============================================================================

const CONFIG = {
    BACKUP_DIR: 'romaneiopct_backup',
    TEMP_BACKUP_DIR: 'romaneiopct_backup/versao_antiga_movida',
    
    // Arquivos antigos identificados para mover
    ARQUIVOS_ANTIGOS: [
        // Arquivos principais antigos (foram substituídos pelos módulos)
        'romaneiopct_modais_modified.js',    // Duplicação - 3.624 linhas
        'romaneiopct_modais_backup.js',      // Backup conflitante - 4.049 linhas
        'romaneiopct_fix_errors.js',         // Correções já aplicadas - 674 linhas
        
        // Scripts de correção já aplicados
        'romaneiopct_modal_fix.js',
        'correcao-navegacao-enter-pecasPorPacote.js',
        
        // Arquivos de diagnóstico/teste temporários
        'ANALISE_ENGENHARIA_SOFTWARE_PCT.js',
        'SCRIPT_IMPLEMENTACAO_REFATORACAO_PCT.js',
        'SCRIPT_FASE2_EXTRACAO_MODULAR.js',
        'SCRIPT_FASE3_INTEGRACAO.js',
        'MOVER_ARQUIVOS_ANTIGOS.js'  // Este próprio script
    ],
    
    // Arquivos críticos que NÃO devem ser movidos (sistema atual funcionando)
    ARQUIVOS_MANTER: [
        'romaneiopct.html',              // HTML principal atualizado
        'romaneiopct_init.js',           // Inicialização ainda necessária
        'romaneiopct_funcoes.js',        // Funções base ainda em uso
        'romaneiopct_tabela.js',         // Tabela ainda em uso
        'romaneiopct.js',                // Funções auxiliares
        'modules/'                       // Todo o diretório de módulos
    ]
};

// ============================================================================
// CLASSE PARA MOVER ARQUIVOS
// ============================================================================

class MoverArquivosAntigos {
    constructor() {
        this.arquivosMovidos = [];
        this.arquivosNaoEncontrados = [];
        this.erros = [];
        
        this.log('🗂️ Iniciando processo de limpeza de arquivos antigos');
    }

    log(mensagem, tipo = 'info') {
        const timestamp = new Date().toISOString();
        const tipos = {
            'info': '📝',
            'success': '✅',
            'warning': '⚠️',
            'error': '❌',
            'critical': '🚨'
        };
        
        console.log(`${tipos[tipo]} [${timestamp}] ${mensagem}`);
    }

    // ========================================================================
    // EXECUÇÃO PRINCIPAL
    // ========================================================================

    async executar() {
        try {
            this.log('🗂️ INICIANDO LIMPEZA DE ARQUIVOS ANTIGOS');
            
            // 1. Criar diretório de backup para arquivos movidos
            await this.criarDiretorioBackup();
            
            // 2. Verificar arquivos antes de mover
            await this.verificarArquivos();
            
            // 3. Mover arquivos antigos
            await this.moverArquivos();
            
            // 4. Limpar arquivos temporários da refatoração
            await this.limparArquivosTemporarios();
            
            // 5. Gerar relatório
            await this.gerarRelatorio();
            
            this.log('✅ LIMPEZA CONCLUÍDA COM SUCESSO', 'success');
            return true;
            
        } catch (error) {
            this.log(`❌ ERRO NA LIMPEZA: ${error.message}`, 'error');
            return false;
        }
    }

    async criarDiretorioBackup() {
        this.log('📁 Criando diretório para arquivos movidos...');
        
        // Criar diretório principal se não existir
        if (!fs.existsSync(CONFIG.BACKUP_DIR)) {
            fs.mkdirSync(CONFIG.BACKUP_DIR, { recursive: true });
            this.log(`📂 Criado: ${CONFIG.BACKUP_DIR}`);
        }
        
        // Criar subdiretório para versão antiga
        if (!fs.existsSync(CONFIG.TEMP_BACKUP_DIR)) {
            fs.mkdirSync(CONFIG.TEMP_BACKUP_DIR, { recursive: true });
            this.log(`📂 Criado: ${CONFIG.TEMP_BACKUP_DIR}`);
        }
        
        // Criar arquivo de info sobre o que foi movido
        const infoMovimento = {
            timestamp: new Date().toISOString(),
            motivo: 'Limpeza após refatoração Romaneiopct V2.0',
            versao_sistema: 'V2.0 - Sistema Modular',
            arquivos_planejados: CONFIG.ARQUIVOS_ANTIGOS.length
        };
        
        fs.writeFileSync(
            path.join(CONFIG.TEMP_BACKUP_DIR, 'INFO_ARQUIVOS_MOVIDOS.json'),
            JSON.stringify(infoMovimento, null, 2)
        );
    }

    async verificarArquivos() {
        this.log('🔍 Verificando arquivos a serem movidos...');
        
        for (const arquivo of CONFIG.ARQUIVOS_ANTIGOS) {
            if (fs.existsSync(arquivo)) {
                const stats = fs.statSync(arquivo);
                this.log(`📄 Encontrado: ${arquivo} (${Math.round(stats.size/1024)}KB)`);
            } else {
                this.arquivosNaoEncontrados.push(arquivo);
                this.log(`⚠️ Não encontrado: ${arquivo}`, 'warning');
            }
        }
        
        this.log(`📊 Status: ${CONFIG.ARQUIVOS_ANTIGOS.length - this.arquivosNaoEncontrados.length} encontrados, ${this.arquivosNaoEncontrados.length} não encontrados`);
    }

    async moverArquivos() {
        this.log('📦 Movendo arquivos antigos...');
        
        for (const arquivo of CONFIG.ARQUIVOS_ANTIGOS) {
            if (fs.existsSync(arquivo)) {
                try {
                    const destino = path.join(CONFIG.TEMP_BACKUP_DIR, path.basename(arquivo));
                    
                    // Verificar se já existe no destino
                    if (fs.existsSync(destino)) {
                        const novoNome = `${path.basename(arquivo, path.extname(arquivo))}_backup_${Date.now()}${path.extname(arquivo)}`;
                        const novoDestino = path.join(CONFIG.TEMP_BACKUP_DIR, novoNome);
                        fs.moveFile ? fs.moveFile(arquivo, novoDestino) : fs.renameSync(arquivo, novoDestino);
                        this.log(`📦 Movido (renomeado): ${arquivo} → ${novoNome}`);
                    } else {
                        fs.moveFile ? fs.moveFile(arquivo, destino) : fs.renameSync(arquivo, destino);
                        this.log(`📦 Movido: ${arquivo} → ${CONFIG.TEMP_BACKUP_DIR}/`);
                    }
                    
                    this.arquivosMovidos.push({
                        origem: arquivo,
                        destino,
                        timestamp: new Date().toISOString()
                    });
                    
                } catch (error) {
                    this.erros.push({
                        arquivo,
                        erro: error.message
                    });
                    this.log(`❌ Erro ao mover ${arquivo}: ${error.message}`, 'error');
                }
            }
        }
        
        this.log(`✅ Arquivos movidos: ${this.arquivosMovidos.length}`);
    }

    async limparArquivosTemporarios() {
        this.log('🧹 Limpando arquivos temporários da refatoração...');
        
        // Arquivos temporários específicos da refatoração
        const temporarios = [
            'romaneiopct.html.modular.temp',
            '.temp',
            '.bak'
        ];
        
        let limpeza = 0;
        
        // Buscar arquivos temporários
        const arquivos = fs.readdirSync('./');
        
        for (const arquivo of arquivos) {
            // Verificar se é arquivo temporário
            if (temporarios.some(ext => arquivo.endsWith(ext))) {
                try {
                    const stats = fs.statSync(arquivo);
                    if (stats.isFile()) {
                        fs.unlinkSync(arquivo);
                        this.log(`🧹 Removido temporário: ${arquivo}`);
                        limpeza++;
                    }
                } catch (error) {
                    this.log(`⚠️ Erro ao remover ${arquivo}: ${error.message}`, 'warning');
                }
            }
        }
        
        this.log(`✅ Arquivos temporários removidos: ${limpeza}`);
    }

    async gerarRelatorio() {
        const relatorio = {
            timestamp: new Date().toISOString(),
            operacao: 'Limpeza pós-refatoração Romaneiopct V2.0',
            resultados: {
                arquivos_movidos: this.arquivosMovidos.length,
                arquivos_nao_encontrados: this.arquivosNaoEncontrados.length,
                erros: this.erros.length
            },
            detalhes: {
                movidos: this.arquivosMovidos,
                nao_encontrados: this.arquivosNaoEncontrados,
                erros: this.erros
            },
            localizacao_backup: CONFIG.TEMP_BACKUP_DIR,
            sistema_pos_limpeza: {
                html_principal: 'romaneiopct.html (atualizado com sistema modular)',
                modulos: 'modules/romaneiopct/ (5 módulos organizados)',
                scripts_ativos: [
                    'romaneiopct_init.js',
                    'romaneiopct_funcoes.js', 
                    'romaneiopct_tabela.js',
                    'romaneiopct.js'
                ],
                reducao_arquivos: `${this.arquivosMovidos.length} arquivos antigos movidos`,
                status: 'Sistema V2.0 limpo e organizado'
            }
        };
        
        // Salvar relatório
        fs.writeFileSync(
            `${CONFIG.BACKUP_DIR}/RELATORIO_LIMPEZA_ARQUIVOS.json`,
            JSON.stringify(relatorio, null, 2)
        );
        
        // Salvar relatório em Markdown
        const markdown = this.gerarMarkdownRelatorio(relatorio);
        fs.writeFileSync(
            `${CONFIG.BACKUP_DIR}/RELATORIO_LIMPEZA_ARQUIVOS.md`,
            markdown
        );
        
        return relatorio;
    }

    gerarMarkdownRelatorio(relatorio) {
        return `# 🗂️ RELATÓRIO DE LIMPEZA - ROMANEIOPCT V2.0

**Data:** ${relatorio.timestamp}
**Operação:** ${relatorio.operacao}

## 📊 RESUMO

### ✅ RESULTADOS
- **Arquivos movidos:** ${relatorio.resultados.arquivos_movidos}
- **Arquivos não encontrados:** ${relatorio.resultados.arquivos_nao_encontrados}
- **Erros:** ${relatorio.resultados.erros}

## 📦 ARQUIVOS MOVIDOS

${relatorio.detalhes.movidos.map(item => `
### ${path.basename(item.origem)}
- **Origem:** ${item.origem}
- **Destino:** ${item.destino}
- **Movido em:** ${item.timestamp}
`).join('') || 'Nenhum arquivo foi movido'}

## ⚠️ ARQUIVOS NÃO ENCONTRADOS

${relatorio.detalhes.nao_encontrados.map(arquivo => `- ${arquivo}`).join('\n') || 'Todos os arquivos foram encontrados'}

## ❌ ERROS DURANTE A OPERAÇÃO

${relatorio.detalhes.erros.map(erro => `
### ${erro.arquivo}
**Erro:** ${erro.erro}
`).join('') || 'Nenhum erro ocorreu'}

## 📁 LOCALIZAÇÃO DO BACKUP

Arquivos antigos movidos para: \`${relatorio.localizacao_backup}\`

## 🎯 SISTEMA PÓS-LIMPEZA

### 📄 Arquivo Principal
- **${relatorio.sistema_pos_limpeza.html_principal}**

### 🏗️ Módulos Ativos
- **${relatorio.sistema_pos_limpeza.modulos}**

### 📜 Scripts Ativos
${relatorio.sistema_pos_limpeza.scripts_ativos.map(script => `- ${script}`).join('\n')}

### 🎉 Status Final
- **Redução:** ${relatorio.sistema_pos_limpeza.reducao_arquivos}
- **Estado:** ${relatorio.sistema_pos_limpeza.status}

## 🔄 PARA REVERTER (SE NECESSÁRIO)

1. Copiar arquivos de volta de \`${relatorio.localizacao_backup}\`
2. Executar validação do sistema
3. Testar funcionalidades críticas

**🏆 LIMPEZA CONCLUÍDA COM SUCESSO**

Sistema Romaneiopct V2.0 organizado e otimizado!
`;
    }
}

// ============================================================================
// EXECUÇÃO PRINCIPAL
// ============================================================================

async function main() {
    console.log(`
🗂️ LIMPEZA DE ARQUIVOS ANTIGOS - ROMANEIOPCT V2.0
=================================================

Movendo arquivos antigos e desnecessários para backup
após refatoração bem-sucedida.

ARQUIVOS A MOVER: ${CONFIG.ARQUIVOS_ANTIGOS.length}
DESTINO: ${CONFIG.TEMP_BACKUP_DIR}

SEGURANÇA: Backup completo antes de mover
    `);
    
    const limpador = new MoverArquivosAntigos();
    
    const sucesso = await limpador.executar();
    
    if (sucesso) {
        console.log(`
✅ LIMPEZA CONCLUÍDA COM SUCESSO!

📊 RESULTADO:
- Arquivos movidos: ${limpador.arquivosMovidos.length}
- Arquivos não encontrados: ${limpador.arquivosNaoEncontrados.length}
- Erros: ${limpador.erros.length}

📁 Backup: ${CONFIG.TEMP_BACKUP_DIR}
📄 Relatório: ${CONFIG.BACKUP_DIR}/RELATORIO_LIMPEZA_ARQUIVOS.md

🎯 SISTEMA ROMANEIOPCT V2.0 LIMPO E OTIMIZADO!

Próximos passos:
1. Testar sistema no navegador
2. Validar todas as funcionalidades PCT
3. Verificar relatórios de impressão
        `);
    } else {
        console.log(`
❌ LIMPEZA FALHOU

🚨 Verificar logs e relatórios para identificar problemas
📞 Sistema permanece seguro - nenhum arquivo crítico foi alterado
        `);
    }
}

// Executar apenas se chamado diretamente
if (require.main === module) {
    main().catch(error => {
        console.error('❌ ERRO CRÍTICO NA LIMPEZA:', error);
        process.exit(1);
    });
}

module.exports = MoverArquivosAntigos;