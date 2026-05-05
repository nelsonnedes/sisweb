/**
 * SISTEMA DE LOGGING PROFISSIONAL
 * Sistema avançado de logs com diferentes níveis e formatação
 * 
 * @author Sistema de Excelência Firebase
 * @version 2.0.0
 * @created 2024
 */

import { DEV_CONFIG } from '../constants/app-constants.js';

// =============================================================================
// NÍVEIS DE LOG
// =============================================================================
const LOG_LEVELS = {
    ERROR: 0,
    WARN: 1,
    INFO: 2,
    DEBUG: 3
};

const LOG_LEVEL_NAMES = {
    0: 'ERROR',
    1: 'WARN',
    2: 'INFO',
    3: 'DEBUG'
};

// =============================================================================
// CORES PARA CONSOLE
// =============================================================================
const LOG_COLORS = {
    ERROR: '#ff4757',   // Vermelho
    WARN: '#ffa502',    // Laranja
    INFO: '#2196F3',    // Azul
    DEBUG: '#9c88ff',   // Roxo
    SUCCESS: '#2ecc71', // Verde
    PERFORMANCE: '#f39c12' // Amarelo
};

// =============================================================================
// CLASSE PRINCIPAL DO LOGGER
// =============================================================================
class Logger {
    constructor() {
        this.logLevel = this.getLogLevel();
        this.performanceMarks = new Map();
        this.isEnabled = DEV_CONFIG.DEBUG_MODE;
    }

    /**
     * Determina o nível de log baseado na configuração
     */
    getLogLevel() {
        const level = DEV_CONFIG.LOG_LEVEL.toLowerCase();
        switch (level) {
            case 'error': return LOG_LEVELS.ERROR;
            case 'warn': return LOG_LEVELS.WARN;
            case 'info': return LOG_LEVELS.INFO;
            case 'debug': return LOG_LEVELS.DEBUG;
            default: return LOG_LEVELS.INFO;
        }
    }

    /**
     * Formata uma mensagem de log com timestamp e contexto
     */
    formatMessage(level, message, context = '') {
        const timestamp = new Date().toLocaleTimeString('pt-BR', {
            hour12: false,
            timeZone: 'America/Sao_Paulo'
        });
        
        const levelName = LOG_LEVEL_NAMES[level];
        const contextStr = context ? ` [${context}]` : '';
        
        return `[${timestamp}] ${levelName}${contextStr}: ${message}`;
    }

    /**
     * Aplica estilo ao log no console
     */
    getLogStyle(level) {
        const color = LOG_COLORS[LOG_LEVEL_NAMES[level]];
        return `color: ${color}; font-weight: bold;`;
    }

    /**
     * Executa o log se o nível permitir
     */
    log(level, message, context = '', data = null) {
        if (!this.isEnabled || level > this.logLevel) {
            return;
        }

        const formattedMessage = this.formatMessage(level, message, context);
        const style = this.getLogStyle(level);

        switch (level) {
            case LOG_LEVELS.ERROR:
                console.error(`%c${formattedMessage}`, style);
                if (data) console.error(data);
                break;
            case LOG_LEVELS.WARN:
                console.warn(`%c${formattedMessage}`, style);
                if (data) console.warn(data);
                break;
            case LOG_LEVELS.INFO:
                console.info(`%c${formattedMessage}`, style);
                if (data) console.info(data);
                break;
            case LOG_LEVELS.DEBUG:
                console.debug(`%c${formattedMessage}`, style);
                if (data) console.debug(data);
                break;
        }
    }

    // =========================================================================
    // MÉTODOS PÚBLICOS DE LOG
    // =========================================================================

    /**
     * Log de erro
     */
    error(message, context = '', data = null) {
        this.log(LOG_LEVELS.ERROR, message, context, data);
        
        // Em produção, enviar para serviço de monitoramento
        if (!DEV_CONFIG.DEBUG_MODE) {
            this.sendToMonitoringService('error', message, context, data);
        }
    }

    /**
     * Log de warning
     */
    warn(message, context = '', data = null) {
        this.log(LOG_LEVELS.WARN, message, context, data);
    }

    /**
     * Log de informação
     */
    info(message, context = '', data = null) {
        this.log(LOG_LEVELS.INFO, message, context, data);
    }

    /**
     * Log de debug
     */
    debug(message, context = '', data = null) {
        this.log(LOG_LEVELS.DEBUG, message, context, data);
    }

    /**
     * Log de sucesso (sempre visível)
     */
    success(message, context = '', data = null) {
        if (!this.isEnabled) return;
        
        const formattedMessage = this.formatMessage(LOG_LEVELS.INFO, `✅ ${message}`, context);
        console.log(`%c${formattedMessage}`, `color: ${LOG_COLORS.SUCCESS}; font-weight: bold;`);
        if (data) console.log(data);
    }

    // =========================================================================
    // MONITORAMENTO DE PERFORMANCE
    // =========================================================================

    /**
     * Inicia medição de performance
     */
    startPerformance(operationName) {
        if (!DEV_CONFIG.PERFORMANCE_MONITORING) return;
        
        this.performanceMarks.set(operationName, performance.now());
        this.debug(`Iniciando medição: ${operationName}`, 'PERFORMANCE');
    }

    /**
     * Finaliza medição de performance
     */
    endPerformance(operationName) {
        if (!DEV_CONFIG.PERFORMANCE_MONITORING) return;
        
        const startTime = this.performanceMarks.get(operationName);
        if (!startTime) {
            this.warn(`Medição não encontrada: ${operationName}`, 'PERFORMANCE');
            return;
        }

        const duration = performance.now() - startTime;
        this.performanceMarks.delete(operationName);

        // Log colorido para performance
        const color = duration > DEV_CONFIG.SLOW_OPERATION_THRESHOLD 
            ? LOG_COLORS.ERROR 
            : LOG_COLORS.PERFORMANCE;
        
        const icon = duration > DEV_CONFIG.SLOW_OPERATION_THRESHOLD ? '🐌' : '⚡';
        
        console.log(
            `%c${icon} [PERFORMANCE] ${operationName}: ${duration.toFixed(2)}ms`,
            `color: ${color}; font-weight: bold;`
        );

        // Alerta para operações lentas
        if (duration > DEV_CONFIG.SLOW_OPERATION_THRESHOLD) {
            this.warn(
                `Operação lenta detectada: ${operationName} (${duration.toFixed(2)}ms)`,
                'PERFORMANCE'
            );
        }

        return duration;
    }

    // =========================================================================
    // LOGS ESPECÍFICOS DO SISTEMA
    // =========================================================================

    /**
     * Log para operações Firebase
     */
    firebase(operation, collection, data = null) {
        this.info(`Firebase ${operation}`, `🔥 ${collection}`, data);
    }

    /**
     * Log para operações de cálculo
     */
    calculation(operation, values, result) {
        this.debug(
            `Cálculo ${operation}: ${JSON.stringify(values)} = ${result}`,
            '🧮 CALC'
        );
    }

    /**
     * Log para operações de UI
     */
    ui(action, element, data = null) {
        this.debug(`UI ${action}`, `🎨 ${element}`, data);
    }

    /**
     * Log para validações
     */
    validation(field, value, isValid, message = '') {
        const status = isValid ? '✅' : '❌';
        const logLevel = isValid ? LOG_LEVELS.DEBUG : LOG_LEVELS.WARN;
        
        this.log(
            logLevel,
            `${status} Validação ${field}: ${value} ${message}`,
            '🔍 VALIDATION'
        );
    }

    // =========================================================================
    // LOGS AGRUPADOS
    // =========================================================================

    /**
     * Inicia um grupo de logs
     */
    group(title, collapsed = false) {
        if (!this.isEnabled) return;
        
        if (collapsed) {
            console.groupCollapsed(`🔽 ${title}`);
        } else {
            console.group(`🔽 ${title}`);
        }
    }

    /**
     * Finaliza um grupo de logs
     */
    groupEnd() {
        if (!this.isEnabled) return;
        console.groupEnd();
    }

    // =========================================================================
    // UTILITÁRIOS
    // =========================================================================

    /**
     * Log de tabela (útil para arrays e objetos)
     */
    table(data, columns = null) {
        if (!this.isEnabled) return;
        
        if (columns) {
            console.table(data, columns);
        } else {
            console.table(data);
        }
    }

    /**
     * Limpa o console
     */
    clear() {
        if (!this.isEnabled) return;
        console.clear();
        this.info('Console limpo', '🧹 SYSTEM');
    }

    /**
     * Envia dados para serviço de monitoramento (placeholder)
     */
    sendToMonitoringService(level, message, context, data) {
        // Integração preparada para serviços como Sentry/Firebase Analytics
        try {
            const payload = {
                level: LOG_LEVEL_NAMES[level],
                message,
                context,
                data: data ? JSON.stringify(data) : null,
                timestamp: new Date().toISOString(),
                url: window.location.href,
                userAgent: navigator.userAgent
            };
            
            // Exemplo de integração futura com Analytics
            if (window.firebaseService && typeof window.firebaseService.logEvent === 'function') {
                window.firebaseService.logEvent('app_error', payload);
            }
            
            // Armazenar localmente erros críticos para debug futuro se não houver internet
            if (level === LOG_LEVELS.ERROR) {
                const errorLog = JSON.parse(localStorage.getItem('sisweb_error_log') || '[]');
                errorLog.unshift(payload);
                if (errorLog.length > 50) errorLog.pop(); // Manter apenas os últimos 50
                localStorage.setItem('sisweb_error_log', JSON.stringify(errorLog));
            }
        } catch (e) {
            console.warn('Falha ao enviar log para monitoramento', e);
        }
    }

    // =========================================================================
    // WRAPPER PARA FUNÇÕES
    // =========================================================================

    /**
     * Wrapper para medir performance de funções
     */
    wrapFunction(fn, name) {
        return (...args) => {
            this.startPerformance(name);
            try {
                const result = fn.apply(this, args);
                
                // Se for uma Promise, aguardar para medir
                if (result && typeof result.then === 'function') {
                    return result
                        .then(res => {
                            this.endPerformance(name);
                            return res;
                        })
                        .catch(err => {
                            this.endPerformance(name);
                            this.error(`Erro em ${name}`, 'WRAPPER', err);
                            throw err;
                        });
                } else {
                    this.endPerformance(name);
                    return result;
                }
            } catch (error) {
                this.endPerformance(name);
                this.error(`Erro em ${name}`, 'WRAPPER', error);
                throw error;
            }
        };
    }
}

// =============================================================================
// INSTÂNCIA GLOBAL
// =============================================================================
const logger = new Logger();

// =============================================================================
// EXPORTAÇÕES
// =============================================================================
export default logger;

// Exportar métodos individuais para uso direto
export const {
    error,
    warn,
    info,
    debug,
    success,
    firebase,
    calculation,
    ui,
    validation,
    startPerformance,
    endPerformance,
    group,
    groupEnd,
    table,
    clear,
    wrapFunction
} = logger; 