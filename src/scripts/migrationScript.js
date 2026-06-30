/**
 * SCRIPT DE MIGRAÇÃO SISWEB
 * 
 * Migra dados do localStorage para Firebase de forma segura e incremental
 * Mantém backup completo e permite rollback em caso de problemas
 * Suporta migração seletiva e validação de integridade dos dados
 * 
 * @author SisWeb Migration Team
 * @version 1.0.0
 * @created 2024
 */

import { databaseAdapter } from '../services/databaseAdapter.js';
import { firebaseService } from '../services/firebaseService.unified.js';

/**
 * CONFIGURAÇÃO DA MIGRAÇÃO
 */
const MIGRATION_CONFIG = {
    // Configurações de segurança
    backupEnabled: true,
    backupLocation: 'migration_backup',
    validateData: true,
    dryRun: false, // true para testar sem alterar dados
    
    // Configurações de performance
    batchSize: 10,
    delayBetweenBatches: 1000, // ms
    maxRetries: 3,
    retryDelay: 2000, // ms
    
    // Configurações de logging
    verbose: true,
    logFile: 'migration.log',
    
    // Chaves prioritárias para migração
    priorityKeys: [
        'clients',
        'especies',
        'romaneiosTora',
        'romaneiosPct',
        'romaneiosTL'
    ],
    
    // Chaves a serem ignoradas
    ignoreKeys: [
        '__test__',
        'debug',
        'temporary'
    ]
};

/**
 * CLASSE PRINCIPAL DE MIGRAÇÃO
 */
class SisWebMigration {
    constructor(config = {}) {
        this.config = { ...MIGRATION_CONFIG, ...config };
        this.migrationLog = [];
        this.errors = [];
        this.backupData = {};
        this.migrationStats = {
            totalItems: 0,
            processed: 0,
            successful: 0,
            failed: 0,
            skipped: 0,
            startTime: null,
            endTime: null
        };
        this.interrupted = false;
    }

    persistLocalValue(key, data) {
        try {
            if (typeof window !== 'undefined' && window.SiswebStorage && typeof window.SiswebStorage.write === 'function') {
                return window.SiswebStorage.write(key, data) !== false;
            }
        } catch (_) {}
        localStorage.setItem(key, typeof data === 'string' ? data : JSON.stringify(data));
        return true;
    }

    /**
     * EXECUTAR MIGRAÇÃO COMPLETA
     */
    async executeMigration() {
        try {
            this.log('🚀 Iniciando migração SisWeb localStorage → Firebase');
            this.migrationStats.startTime = new Date();

            // 1. Verificar pré-requisitos
            await this.checkPrerequisites();

            // 2. Criar backup completo
            if (this.config.backupEnabled) {
                await this.createBackup();
            }

            // 3. Analisar dados do localStorage
            const localData = await this.analyzeLocalStorage();

            // 4. Executar migração por prioridade
            await this.migrateByPriority(localData);

            // 5. Validar migração
            await this.validateMigration();

            // 6. Definir tempo final ANTES do relatório
            this.migrationStats.endTime = new Date();
            
            // 7. Relatório final
            this.generateReport();

            this.log('✅ Migração concluída com sucesso!');

            return {
                success: true,
                stats: this.migrationStats,
                log: this.migrationLog,
                errors: this.errors
            };

        } catch (error) {
            this.migrationStats.endTime = new Date();
            this.logError('❌ Falha na migração:', error);
            
            return {
                success: false,
                error: error.message,
                stats: this.migrationStats,
                log: this.migrationLog,
                errors: this.errors
            };
        }
    }

    /**
     * VERIFICAR PRÉ-REQUISITOS
     */
    async checkPrerequisites() {
        this.log('🔍 Verificando pré-requisitos...');

        // Verificar localStorage
        if (!localStorage) {
            throw new Error('localStorage não disponível');
        }

        // Verificar Firebase
        const firebaseStatus = firebaseService.isFirebaseOperational();
        if (!firebaseStatus.operational) {
            throw new Error(`Firebase não operacional: ${firebaseStatus.message}`);
        }

        // Verificar conexão de rede
        if (!navigator.onLine) {
            throw new Error('Conexão com internet necessária para migração');
        }

        // Verificar adaptador de banco
        const adapterStatus = databaseAdapter.getStatus();
        if (adapterStatus.services.firebase !== 'available') {
            throw new Error('Database Adapter não conseguiu conectar ao Firebase');
        }

        this.log('✅ Pré-requisitos atendidos');
    }

    /**
     * CRIAR BACKUP COMPLETO
     */
    async createBackup() {
        this.log('💾 Criando backup completo do localStorage...');

        try {
            for (let i = 0; i < localStorage.length; i++) {
                const key = localStorage.key(i);
                const value = localStorage.getItem(key);
                
                try {
                    this.backupData[key] = JSON.parse(value);
                } catch (parseError) {
                    // Manter como string se não for JSON válido
                    this.backupData[key] = value;
                }
            }

            // Salvar backup em arquivo JSON se em ambiente suportado
            if (this.config.backupEnabled) {
                const backupString = JSON.stringify(this.backupData, null, 2);
                
                // Tentar salvar no localStorage também com chave especial
                try {
                    this.persistLocalValue(this.config.backupLocation, backupString);
                    this.log(`✅ Backup criado: ${Object.keys(this.backupData).length} chaves`);
                } catch (error) {
                    this.log(`⚠️ Aviso: Não foi possível salvar backup no localStorage: ${error.message}`);
                }
            }

        } catch (error) {
            throw new Error(`Falha ao criar backup: ${error.message}`);
        }
    }

    /**
     * ANALISAR DADOS DO LOCALSTORAGE
     */
    async analyzeLocalStorage() {
        this.log('📊 Analisando dados do localStorage...');

        const analysis = {
            totalKeys: 0,
            dataByCategory: {},
            estimatedSize: 0,
            problematicKeys: []
        };

        for (let i = 0; i < localStorage.length; i++) {
            const key = localStorage.key(i);
            const value = localStorage.getItem(key);

            // Pular chaves ignoradas
            if (this.config.ignoreKeys.includes(key)) {
                continue;
            }

            analysis.totalKeys++;
            analysis.estimatedSize += value.length;

            // Categorizar dados
            const category = this.categorizeKey(key);
            if (!analysis.dataByCategory[category]) {
                analysis.dataByCategory[category] = {
                    keys: [],
                    totalSize: 0,
                    validItems: 0,
                    invalidItems: 0
                };
            }

            analysis.dataByCategory[category].keys.push(key);
            analysis.dataByCategory[category].totalSize += value.length;

            // Validar estrutura dos dados
            try {
                const parsedData = JSON.parse(value);
                if (this.validateDataStructure(key, parsedData)) {
                    analysis.dataByCategory[category].validItems++;
                } else {
                    analysis.dataByCategory[category].invalidItems++;
                    analysis.problematicKeys.push(key);
                }
            } catch (error) {
                analysis.dataByCategory[category].invalidItems++;
                analysis.problematicKeys.push(key);
            }
        }

        this.migrationStats.totalItems = analysis.totalKeys;

        this.log(`📈 Análise concluída:`);
        this.log(`   • Total de chaves: ${analysis.totalKeys}`);
        this.log(`   • Tamanho estimado: ${this.formatBytes(analysis.estimatedSize)}`);
        this.log(`   • Chaves problemáticas: ${analysis.problematicKeys.length}`);

        if (analysis.problematicKeys.length > 0) {
            this.log(`⚠️ Chaves com problemas: ${analysis.problematicKeys.join(', ')}`);
        }

        return analysis;
    }

    /**
     * MIGRAR POR PRIORIDADE
     */
    async migrateByPriority(analysis) {
        this.log('🔄 Iniciando migração por prioridade...');

        // Primeiro, migrar chaves prioritárias
        for (const priorityKey of this.config.priorityKeys) {
            if (localStorage.getItem(priorityKey)) {
                await this.migrateKey(priorityKey, 'priority');
            }
        }

        // Depois, migrar outras chaves
        for (let i = 0; i < localStorage.length; i++) {
            const key = localStorage.key(i);
            
            // Pular se já migrado ou deve ser ignorado
            if (this.config.priorityKeys.includes(key) || 
                this.config.ignoreKeys.includes(key) ||
                key === this.config.backupLocation) {
                continue;
            }

            await this.migrateKey(key, 'standard');

            // Verificar se migração foi interrompida
            if (this.interrupted) {
                this.log('⏸️ Migração interrompida pelo usuário');
                break;
            }
        }
    }

    /**
     * MIGRAR CHAVE ESPECÍFICA
     */
    async migrateKey(key, priority = 'standard') {
        const startTime = Date.now();
        this.log(`🔄 Migrando: ${key} (${priority})`);

        try {
            // Obter dados do localStorage
            const localData = localStorage.getItem(key);
            if (!localData) {
                this.migrationStats.skipped++;
                return;
            }

            let parsedData;
            try {
                parsedData = JSON.parse(localData);
            } catch (parseError) {
                // Se não é JSON válido, verificar se é uma string simples válida
                if (this.isValidSimpleValue(key, localData)) {
                    parsedData = localData; // Manter como string
                    this.log(`📝 Tratando ${key} como valor simples: "${localData}"`);
                } else {
                    this.logError(`❌ Erro ao fazer parse de ${key}:`, parseError);
                    this.migrationStats.failed++;
                    return;
                }
            }

            // Validar dados antes da migração
            if (this.config.validateData && !this.validateDataStructure(key, parsedData)) {
                this.logError(`❌ Dados inválidos para ${key}, pulando migração`);
                this.migrationStats.skipped++;
                return;
            }

            // Executar migração (ou simular se dry run)
            if (this.config.dryRun) {
                this.log(`🧪 DRY RUN: Simulando migração de ${key}`);
                await this.delay(100); // Simular tempo de processamento
            } else {
                // Migrar usando o adaptador
                const result = await databaseAdapter.saveData(key, parsedData);
                
                if (!result.success) {
                    throw new Error(result.error || 'Falha ao salvar no Firebase');
                }

                // Verificar se dados foram salvos corretamente
                const verification = await databaseAdapter.loadData(key);
                if (!verification.success || !verification.data) {
                    throw new Error('Falha na verificação pós-migração');
                }
            }

            const duration = Date.now() - startTime;
            this.log(`✅ ${key} migrado com sucesso (${duration}ms)`);
            this.migrationStats.successful++;

        } catch (error) {
            this.logError(`❌ Falha ao migrar ${key}:`, error);
            this.migrationStats.failed++;

            // Tentar novamente se configurado
            if (this.config.maxRetries > 0) {
                await this.retryMigration(key, 1);
            }
        } finally {
            this.migrationStats.processed++;
        }

        // Delay entre migrações para não sobrecarregar
        if (this.config.delayBetweenBatches > 0) {
            await this.delay(this.config.delayBetweenBatches);
        }
    }

    /**
     * VERIFICAR SE É UM VALOR SIMPLES VÁLIDO
     */
    isValidSimpleValue(key, value) {
        // Chaves que podem conter strings simples
        const simpleValueKeys = [
            'lastSuccessfulPage',
            'currentPage',
            'theme',
            'language',
            'lastRoute'
        ];
        
        // Chaves que podem conter números como string
        const numericValueKeys = [
            'pageLoadCount',
            'sessionCount',
            'lastLoginTime'
        ];
        
        // Chaves que podem conter boolean como string
        const booleanValueKeys = [
            'clientMigrationCompleted',
            'firstTime',
            'tutorialCompleted'
        ];
        
        if (simpleValueKeys.some(pattern => key.includes(pattern))) {
            return typeof value === 'string' && value.length > 0;
        }
        
        if (numericValueKeys.some(pattern => key.includes(pattern))) {
            return !isNaN(value);
        }
        
        if (booleanValueKeys.some(pattern => key.includes(pattern))) {
            return value === 'true' || value === 'false' || value === true || value === false;
        }
        
        return false;
    }

    /**
     * TENTAR NOVAMENTE MIGRAÇÃO
     */
    async retryMigration(key, attempt) {
        if (attempt > this.config.maxRetries) {
            this.logError(`❌ Máximo de tentativas excedido para ${key}`);
            return;
        }

        this.log(`🔄 Tentativa ${attempt}/${this.config.maxRetries} para ${key}`);
        
        await this.delay(this.config.retryDelay);
        
        try {
            await this.migrateKey(key);
        } catch (error) {
            await this.retryMigration(key, attempt + 1);
        }
    }

    /**
     * VALIDAR MIGRAÇÃO
     */
    async validateMigration() {
        if (this.config.dryRun) {
            this.log('🧪 Pulando validação (modo dry run)');
            return;
        }

        this.log('🔍 Validando integridade da migração...');

        let validationErrors = 0;

        for (const priorityKey of this.config.priorityKeys) {
            if (localStorage.getItem(priorityKey)) {
                const localData = JSON.parse(localStorage.getItem(priorityKey));
                const firebaseResult = await databaseAdapter.loadData(priorityKey);

                if (!firebaseResult.success) {
                    this.logError(`❌ Validação falhou para ${priorityKey}: não encontrado no Firebase`);
                    validationErrors++;
                    continue;
                }

                // Comparação básica de estrutura
                if (!this.compareDataStructure(localData, firebaseResult.data)) {
                    this.logError(`❌ Validação falhou para ${priorityKey}: estruturas diferentes`);
                    validationErrors++;
                }
            }
        }

        if (validationErrors === 0) {
            this.log('✅ Validação da migração bem-sucedida');
        } else {
            this.log(`⚠️ Validação encontrou ${validationErrors} problemas`);
        }
    }

    /**
     * GERAR RELATÓRIO FINAL
     */
    generateReport() {
        const duration = this.migrationStats.endTime - this.migrationStats.startTime;
        
        this.log('\n📊 RELATÓRIO FINAL DA MIGRAÇÃO');
        this.log('=' .repeat(50));
        this.log(`⏱️ Duração total: ${this.formatDuration(duration)}`);
        this.log(`📦 Total de itens: ${this.migrationStats.totalItems}`);
        this.log(`✅ Migrados com sucesso: ${this.migrationStats.successful}`);
        this.log(`❌ Falharam: ${this.migrationStats.failed}`);
        this.log(`⏭️ Pulados: ${this.migrationStats.skipped}`);
        this.log(`📈 Taxa de sucesso: ${((this.migrationStats.successful / this.migrationStats.totalItems) * 100).toFixed(1)}%`);
        
        if (this.errors.length > 0) {
            this.log(`\n⚠️ ERROS ENCONTRADOS (${this.errors.length}):`);
            this.errors.forEach((error, index) => {
                this.log(`${index + 1}. ${error}`);
            });
        }

        this.log('\n🎯 RECOMENDAÇÕES PÓS-MIGRAÇÃO:');
        if (this.migrationStats.failed === 0) {
            this.log('✅ Migração 100% bem-sucedida - sistema pronto para usar Firebase');
            this.log('💡 Considere alterar estratégia do adaptador para "firebase-first"');
        } else {
            this.log('⚠️ Algumas migrações falharam - revisar erros antes de alterar estratégia');
            this.log('🔄 Execute validação manual dos dados críticos');
        }
        
        this.log('🔒 Mantenha backup do localStorage até confirmar estabilidade');
        this.log('=' .repeat(50));
    }

    /**
     * UTILITÁRIOS DE MIGRAÇÃO
     */
    categorizeKey(key) {
        if (key.includes('client') || key.includes('fornecedor')) return 'clients';
        if (key.includes('species') || key.includes('especie')) return 'especies';
        if (key.includes('romaneio')) return 'romaneios';
        if (key.includes('orcamento')) return 'orcamentos';
        if (key.includes('preference') || key.includes('config')) return 'settings';
        return 'other';
    }

    validateDataStructure(key, data) {
        if (data === null || data === undefined) return false;

        // Se é um valor simples válido, aceitar
        if (typeof data === 'string' || typeof data === 'number' || typeof data === 'boolean') {
            return this.isValidSimpleValue(key, data) || this.isImportantBusinessData(key, data);
        }

        // Validações específicas por tipo de dados
        if (key.includes('client') || key.includes('fornecedor')) {
            return Array.isArray(data) && data.every(item => item && (item.nome || item.razaoSocial));
        }
        
        if (key.includes('species') || key.includes('especie')) {
            return Array.isArray(data) && data.every(item => item && (item.especie || item.nome || item.name));
        }
        
        if (key.includes('romaneio')) {
            return Array.isArray(data) && data.every(item => item && item.numero);
        }

        return true; // Validação genérica para outros tipos
    }

    /**
     * VERIFICAR SE É DADO IMPORTANTE DO NEGÓCIO
     */
    isImportantBusinessData(key, data) {
        // Dados que sempre devem ser migrados mesmo sendo valores simples
        const businessKeys = [
            'currentUser',
            'companies',
            'persistentUser'
        ];
        
        return businessKeys.some(pattern => key.includes(pattern));
    }

    compareDataStructure(local, firebase) {
        // Remover metadados do Firebase para comparação
        const cleanFirebase = { ...firebase };
        delete cleanFirebase._metadata;
        delete cleanFirebase.createdAt;
        delete cleanFirebase.updatedAt;

        // Comparação básica de chaves principais
        if (Array.isArray(local) && Array.isArray(cleanFirebase)) {
            return local.length === cleanFirebase.length;
        }

        if (typeof local === 'object' && typeof cleanFirebase === 'object') {
            const localKeys = Object.keys(local).sort();
            const firebaseKeys = Object.keys(cleanFirebase).sort();
            return JSON.stringify(localKeys) === JSON.stringify(firebaseKeys);
        }

        return JSON.stringify(local) === JSON.stringify(cleanFirebase);
    }

    /**
     * CONTROLES DE MIGRAÇÃO
     */
    pauseMigration() {
        this.interrupted = true;
        this.log('⏸️ Migração pausada pelo usuário');
    }

    resumeMigration() {
        this.interrupted = false;
        this.log('▶️ Migração retomada');
    }

    async rollbackMigration() {
        this.log('🔄 Iniciando rollback da migração...');

        if (!this.config.backupEnabled || !this.backupData) {
            throw new Error('Backup não disponível para rollback');
        }

        try {
            // Restaurar dados do backup
            for (const [key, value] of Object.entries(this.backupData)) {
                this.persistLocalValue(key, typeof value === 'string' ? value : JSON.stringify(value));
            }

            this.log('✅ Rollback concluído com sucesso');
            return { success: true };

        } catch (error) {
            this.logError('❌ Falha no rollback:', error);
            return { success: false, error: error.message };
        }
    }

    /**
     * UTILITÁRIOS GERAIS
     */
    log(message) {
        const timestamp = new Date().toISOString();
        const logEntry = `[${timestamp}] ${message}`;
        
        this.migrationLog.push(logEntry);
        
        if (this.config.verbose) {
            console.log(logEntry);
        }
    }

    logError(message, error = null) {
        const fullMessage = error ? `${message} ${error.message}` : message;
        this.log(fullMessage);
        this.errors.push(fullMessage);
    }

    delay(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }

    formatBytes(bytes) {
        if (bytes === 0) return '0 Bytes';
        const k = 1024;
        const sizes = ['Bytes', 'KB', 'MB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
    }

    formatDuration(ms) {
        const seconds = Math.floor(ms / 1000);
        const minutes = Math.floor(seconds / 60);
        const hours = Math.floor(minutes / 60);

        if (hours > 0) {
            return `${hours}h ${minutes % 60}m ${seconds % 60}s`;
        } else if (minutes > 0) {
            return `${minutes}m ${seconds % 60}s`;
        } else {
            return `${seconds}s`;
        }
    }
}

/**
 * FUNÇÕES DE CONVENIÊNCIA PARA EXECUÇÃO
 */

/**
 * Executar migração completa com configurações padrão
 */
export async function executeMigration(customConfig = {}) {
    const migration = new SisWebMigration(customConfig);
    return await migration.executeMigration();
}

/**
 * Executar migração apenas de uma chave específica
 */
export async function migrateSpecificKey(key, config = {}) {
    const migration = new SisWebMigration(config);
    await migration.checkPrerequisites();
    if (config.backupEnabled !== false) {
        await migration.createBackup();
    }
    await migration.migrateKey(key);
    return migration.migrationStats;
}

/**
 * Apenas validar integridade sem migrar
 */
export async function validateOnly(config = {}) {
    const migration = new SisWebMigration({ ...config, dryRun: true });
    await migration.checkPrerequisites();
    const analysis = await migration.analyzeLocalStorage();
    return {
        analysis,
        recommendations: migration.generateRecommendations(analysis)
    };
}

/**
 * Criar backup do localStorage
 */
export async function createBackupOnly(config = {}) {
    const migration = new SisWebMigration(config);
    await migration.createBackup();
    return migration.backupData;
}

/**
 * Interface para execução via UI
 */
export class MigrationUI {
    constructor(containerId) {
        this.container = document.getElementById(containerId);
        this.migration = null;
        this.setupUI();
    }

    setupUI() {
        this.container.innerHTML = `
            <div class="migration-panel">
                <h3>🔄 Migração SisWeb</h3>
                <div class="migration-status">
                    <div id="migration-progress"></div>
                    <div id="migration-log"></div>
                </div>
                <div class="migration-controls">
                    <button id="start-migration" class="btn btn-primary">Iniciar Migração</button>
                    <button id="dry-run" class="btn btn-secondary">Teste (Dry Run)</button>
                    <button id="pause-migration" class="btn btn-warning" disabled>Pausar</button>
                    <button id="stop-migration" class="btn btn-danger" disabled>Parar</button>
                </div>
            </div>
        `;

        this.setupEventListeners();
    }

    setupEventListeners() {
        document.getElementById('start-migration').addEventListener('click', () => this.startMigration());
        document.getElementById('dry-run').addEventListener('click', () => this.startMigration(true));
        document.getElementById('pause-migration').addEventListener('click', () => this.pauseMigration());
        document.getElementById('stop-migration').addEventListener('click', () => this.stopMigration());
    }

    async startMigration(dryRun = false) {
        const config = { 
            ...MIGRATION_CONFIG, 
            dryRun,
            verbose: false // UI controlará o log
        };

        this.migration = new SisWebMigration(config);
        
        // Interceptar logs para mostrar na UI
        const originalLog = this.migration.log;
        this.migration.log = (message) => {
            originalLog.call(this.migration, message);
            this.updateLog(message);
        };

        this.setControlsState(true);
        
        const result = await this.migration.executeMigration();
        
        this.setControlsState(false);
        this.showResult(result);
    }

    pauseMigration() {
        if (this.migration) {
            this.migration.pauseMigration();
        }
    }

    stopMigration() {
        if (this.migration) {
            this.migration.pauseMigration();
            this.setControlsState(false);
        }
    }

    updateLog(message) {
        const logElement = document.getElementById('migration-log');
        logElement.innerHTML += `<div>${message}</div>`;
        logElement.scrollTop = logElement.scrollHeight;
    }

    setControlsState(migrating) {
        document.getElementById('start-migration').disabled = migrating;
        document.getElementById('dry-run').disabled = migrating;
        document.getElementById('pause-migration').disabled = !migrating;
        document.getElementById('stop-migration').disabled = !migrating;
    }

    showResult(result) {
        const status = result.success ? '✅ Sucesso' : '❌ Falhou';
        this.updateLog(`\n${status}: Migração finalizada`);
        
        if (result.stats) {
            this.updateLog(`📊 Estatísticas: ${result.stats.successful}/${result.stats.totalItems} migrados`);
        }
    }
}

// Exportar classe principal
export { SisWebMigration };

// Disponibilizar globalmente se necessário
if (typeof window !== 'undefined') {
    window.SisWebMigration = SisWebMigration;
    window.migrationUtils = {
        executeMigration,
        migrateSpecificKey,
        validateOnly,
        createBackupOnly
    };
    console.log('🌐 Migration Script disponível globalmente');
}

console.log('🚀 Migration Script carregado'); 
