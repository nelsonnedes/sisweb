/**
 * SisWeb Migration System - Configuração de Exemplo
 * 
 * Este arquivo contém exemplos de configuração para o sistema de migração.
 * Copie este arquivo para 'config.js' e ajuste as configurações conforme necessário.
 * 
 * @version 1.0.0
 * @author SisWeb Migration Team
 * @created 2024-01-15
 */

// ============================================================================
// CONFIGURAÇÃO DO FIREBASE
// ============================================================================

export const FIREBASE_CONFIG_EXAMPLE = {
    // Substitua pelos valores do seu projeto Firebase
    apiKey: "AIzaSyExample123456789abcdefghijklmnop",
    authDomain: "sisweb-projeto.firebaseapp.com",
    databaseURL: "https://sisweb-projeto-default-rtdb.firebaseio.com/",
    projectId: "sisweb-projeto",
    storageBucket: "sisweb-projeto.appspot.com",
    messagingSenderId: "123456789012",
    appId: "1:123456789012:web:abcdef123456789012345678"
};

// ============================================================================
// CONFIGURAÇÃO DA MIGRAÇÃO
// ============================================================================

export const MIGRATION_CONFIG_EXAMPLE = {
    // Estratégia de migração
    strategy: 'hybrid', // 'hybrid', 'firebase-first', 'localStorage-first'
    
    // Configurações de segurança
    security: {
        backupEnabled: true,
        backupLocation: 'download', // 'download', 'localStorage', 'firebase'
        dataValidation: true,
        encryptSensitiveData: false, // Implementar se necessário
        maxBackupSize: 50 * 1024 * 1024 // 50MB
    },
    
    // Configurações de performance
    performance: {
        batchSize: 10,
        delayBetweenBatches: 1000, // ms
        maxRetries: 3,
        timeout: 30000, // 30 segundos
        enableCache: true,
        cacheExpiration: 300000 // 5 minutos
    },
    
    // Configurações de logging
    logging: {
        verbose: false,
        logLevel: 'info', // 'debug', 'info', 'warn', 'error'
        logToConsole: true,
        logToFile: false,
        maxLogSize: 10 * 1024 * 1024 // 10MB
    },
    
    // Chaves prioritárias para migração
    priorityKeys: [
        'clients',
        'especies',
        'romaneiosTora',
        'romaneiosPct',
        'romaneiosTL',
        'orcamentos',
        'fornecedores'
    ],
    
    // Chaves a serem ignoradas
    ignoreKeys: [
        '__test__',
        'debug',
        'temp_',
        'cache_',
        'session_'
    ],
    
    // Configurações específicas por tipo de dados
    dataTypeConfigs: {
        clients: {
            validate: true,
            backup: true,
            firebasePath: 'clients',
            batchSize: 5 // Menor para dados grandes
        },
        especies: {
            validate: true,
            backup: true,
            firebasePath: 'especies',
            batchSize: 10
        },
        romaneiosTora: {
            validate: true,
            backup: true,
            firebasePath: 'romaneiosTora',
            batchSize: 3 // Menor para dados complexos
        }
    }
};

// ============================================================================
// CONFIGURAÇÃO DO DATABASE ADAPTER
// ============================================================================

export const ADAPTER_CONFIG_EXAMPLE = {
    strategy: 'hybrid',
    
    // Configurações de cache
    cache: {
        enabled: true,
        maxSize: 100, // Número máximo de itens
        ttl: 300000, // 5 minutos
        cleanupInterval: 60000 // 1 minuto
    },
    
    // Configurações de sincronização
    sync: {
        autoSync: true,
        syncInterval: 30000, // 30 segundos
        conflictResolution: 'firebase-wins', // 'firebase-wins', 'localStorage-wins', 'merge'
        maxSyncRetries: 3
    },
    
    // Configurações de fallback
    fallback: {
        enabled: true,
        fallbackToLocalStorage: true,
        fallbackTimeout: 5000,
        retryOnFailure: true
    },
    
    // Configurações de rede
    network: {
        enableOfflineMode: true,
        offlineQueueSize: 100,
        networkCheckInterval: 10000, // 10 segundos
        connectionTimeout: 15000 // 15 segundos
    }
};

// ============================================================================
// CONFIGURAÇÃO DE DESENVOLVIMENTO
// ============================================================================

export const DEV_CONFIG = {
    // Configurações para ambiente de desenvolvimento
    enableDebugMode: true,
    mockFirebase: false, // Para testes sem Firebase
    simulateNetworkDelay: false,
    networkDelayMs: 1000,
    
    // Dados de teste
    generateTestData: true,
    testDataSize: {
        clients: 10,
        especies: 5,
        romaneios: 15
    },
    
    // Configurações de teste
    testing: {
        enableDryRun: true,
        validateAfterMigration: true,
        createTestBackup: true,
        cleanupAfterTest: false
    }
};

// ============================================================================
// CONFIGURAÇÃO DE PRODUÇÃO
// ============================================================================

export const PROD_CONFIG = {
    // Configurações para ambiente de produção
    enableDebugMode: false,
    strictValidation: true,
    mandatoryBackup: true,
    
    // Configurações de segurança aprimoradas
    security: {
        requireConfirmation: true,
        maxMigrationAttempts: 3,
        lockoutDuration: 300000, // 5 minutos
        auditLog: true
    },
    
    // Configurações de performance otimizadas
    performance: {
        batchSize: 5, // Menor para maior segurança
        delayBetweenBatches: 2000, // Maior delay
        maxRetries: 5,
        timeout: 60000 // 1 minuto
    }
};

// ============================================================================
// CONFIGURAÇÃO DE MONITORAMENTO
// ============================================================================

export const MONITORING_CONFIG = {
    // Métricas a serem coletadas
    metrics: {
        migrationDuration: true,
        itemsPerSecond: true,
        errorRate: true,
        memoryUsage: true,
        networkLatency: true
    },
    
    // Alertas
    alerts: {
        errorThreshold: 0.1, // 10% de erro
        slowMigrationThreshold: 60000, // 1 minuto
        memoryThreshold: 100 * 1024 * 1024, // 100MB
        enableEmailAlerts: false,
        enableConsoleAlerts: true
    },
    
    // Relatórios
    reporting: {
        generateReport: true,
        includeDetailedStats: true,
        includeErrorDetails: true,
        exportFormat: 'json' // 'json', 'csv', 'html'
    }
};

// ============================================================================
// CONFIGURAÇÃO DE INTERFACE
// ============================================================================

export const UI_CONFIG = {
    // Configurações da interface web
    theme: 'default', // 'default', 'dark', 'light'
    
    // Configurações de atualização
    updateInterval: 1000, // 1 segundo
    showDetailedProgress: true,
    showRealTimeLogs: true,
    maxLogLines: 1000,
    
    // Configurações de notificação
    notifications: {
        enabled: true,
        showSuccess: true,
        showErrors: true,
        showWarnings: true,
        autoHide: true,
        hideDelay: 5000 // 5 segundos
    },
    
    // Configurações de confirmação
    confirmations: {
        beforeMigration: true,
        beforeRollback: true,
        beforeDataClear: true,
        beforeBackupRestore: true
    }
};

// ============================================================================
// CONFIGURAÇÃO PERSONALIZADA
// ============================================================================

export const CUSTOM_CONFIG = {
    // Adicione suas configurações personalizadas aqui
    
    // Exemplo: Configurações específicas da empresa
    company: {
        name: "SisWeb",
        environment: "production", // "development", "staging", "production"
        version: "1.0.0",
        supportEmail: "suporte@sisweb.com"
    },
    
    // Exemplo: Configurações de integração
    integrations: {
        enableAnalytics: false,
        enableErrorReporting: false,
        enablePerformanceMonitoring: false
    },
    
    // Exemplo: Configurações de compliance
    compliance: {
        enableDataAudit: true,
        retainAuditLogs: true,
        auditLogRetention: 90, // dias
        enableDataEncryption: false
    }
};

// ============================================================================
// FUNÇÃO PARA MESCLAR CONFIGURAÇÕES
// ============================================================================

/**
 * Mescla configurações baseadas no ambiente
 * @param {string} environment - 'development', 'staging', 'production'
 * @returns {Object} Configuração mesclada
 */
export function getMergedConfig(environment = 'development') {
    const baseConfig = {
        ...MIGRATION_CONFIG_EXAMPLE,
        adapter: ADAPTER_CONFIG_EXAMPLE,
        monitoring: MONITORING_CONFIG,
        ui: UI_CONFIG,
        custom: CUSTOM_CONFIG
    };
    
    switch (environment) {
        case 'development':
            return {
                ...baseConfig,
                ...DEV_CONFIG,
                firebase: FIREBASE_CONFIG_EXAMPLE
            };
            
        case 'production':
            return {
                ...baseConfig,
                ...PROD_CONFIG,
                firebase: FIREBASE_CONFIG_EXAMPLE // Substitua pela config de produção
            };
            
        default:
            return baseConfig;
    }
}

// ============================================================================
// VALIDAÇÃO DE CONFIGURAÇÃO
// ============================================================================

/**
 * Valida se a configuração está correta
 * @param {Object} config - Configuração a ser validada
 * @returns {Object} Resultado da validação
 */
export function validateConfig(config) {
    const errors = [];
    const warnings = [];
    
    // Validar Firebase config
    if (!config.firebase) {
        errors.push('Configuração do Firebase não encontrada');
    } else {
        const required = ['apiKey', 'authDomain', 'databaseURL', 'projectId'];
        required.forEach(field => {
            if (!config.firebase[field]) {
                errors.push(`Campo obrigatório do Firebase não encontrado: ${field}`);
            }
        });
    }
    
    // Validar configurações de migração
    if (config.performance?.batchSize > 50) {
        warnings.push('Tamanho do lote muito grande, pode causar problemas de performance');
    }
    
    if (config.performance?.delayBetweenBatches < 500) {
        warnings.push('Delay muito pequeno entre lotes, pode sobrecarregar o Firebase');
    }
    
    // Validar estratégia
    const validStrategies = ['hybrid', 'firebase-first', 'localStorage-first'];
    if (!validStrategies.includes(config.strategy)) {
        errors.push(`Estratégia inválida: ${config.strategy}`);
    }
    
    return {
        valid: errors.length === 0,
        errors,
        warnings
    };
}

// ============================================================================
// EXEMPLO DE USO
// ============================================================================

/*
// Como usar este arquivo:

// 1. Importar as configurações
import { getMergedConfig, validateConfig } from './config.example.js';

// 2. Obter configuração para o ambiente atual
const config = getMergedConfig('development');

// 3. Validar configuração
const validation = validateConfig(config);
if (!validation.valid) {
    console.error('Configuração inválida:', validation.errors);
    return;
}

// 4. Usar a configuração
const migration = new SisWebMigration(config);
await migration.executeMigration();
*/

// ============================================================================
// NOTAS IMPORTANTES
// ============================================================================

/*
IMPORTANTE:
1. Nunca commite credenciais reais do Firebase no controle de versão
2. Use variáveis de ambiente para configurações sensíveis
3. Teste sempre as configurações em ambiente de desenvolvimento primeiro
4. Mantenha backups das configurações de produção
5. Documente qualquer mudança nas configurações

SEGURANÇA:
- As configurações de exemplo contêm valores fictícios
- Substitua todos os valores pelos reais do seu projeto
- Configure adequadamente as regras de segurança do Firebase
- Use HTTPS sempre em produção

PERFORMANCE:
- Ajuste o batchSize baseado no tamanho dos seus dados
- Monitore o uso de memória durante migrações grandes
- Configure timeouts apropriados para sua rede
- Use cache quando apropriado para melhorar performance
*/
