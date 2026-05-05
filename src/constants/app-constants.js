/**
 * CONSTANTES CENTRALIZADAS DO SISTEMA ROMANEIO TORA
 * Arquivo de configuração para manter consistência em todo o projeto
 * 
 * @author Sistema de Excelência Firebase
 * @version 2.0.0
 * @created 2024
 */

// =============================================================================
// CONFIGURAÇÕES FIREBASE
// =============================================================================
export const FIREBASE_CONFIG = {
    // Coleções principais
    COLLECTIONS: {
        ROMANEIOS_TORA: 'romaneiosTora',
        FORNECEDORES: 'fornecedores', 
        ESPECIES: 'especies',
        USUARIOS: 'usuarios',
        EMPRESAS: 'empresas',
        CONFIGURACOES: 'configuracoes'
    },
    
    // Timeouts e retry
    TIMEOUTS: {
        SAVE_TIMEOUT: 15000,      // 15 segundos
        LOAD_TIMEOUT: 10000,      // 10 segundos  
        RETRY_ATTEMPTS: 3,        // 3 tentativas
        RETRY_DELAY: 1000         // 1 segundo entre tentativas
    },
    
    // Cache settings
    CACHE: {
        TTL: 300000,              // 5 minutos em millisegundos
        MAX_SIZE: 100,            // Máximo 100 items em cache
        STORAGE_KEY: 'firebase_cache_v2'
    }
};

// =============================================================================
// CONSTANTES DE CÁLCULO DE VOLUME
// =============================================================================
export const VOLUME_CALCULATIONS = {
    // Fatores de calibração (mantendo a lógica original)
    CALIBRATION: {
        REFERENCE_DIAMETER: 225,      // cm - diâmetro de referência
        REFERENCE_LENGTH: 850,        // cm - comprimento de referência  
        REFERENCE_VOLUME: 2.689,      // m³ - volume de referência
        ADJUSTMENT_FACTOR: 0.07958    // Fator de ajuste calibrado
    },
    
    // Precisão dos cálculos
    PRECISION: {
        VOLUME_DECIMALS: 3,           // Casas decimais para volumes
        PRICE_DECIMALS: 2,            // Casas decimais para preços
        DIMENSION_DECIMALS: 1         // Casas decimais para dimensões
    },
    
    // Limites de validação
    LIMITS: {
        MIN_DIAMETER: 5,              // cm - diâmetro mínimo
        MAX_DIAMETER: 500,            // cm - diâmetro máximo
        MIN_LENGTH: 50,               // cm - comprimento mínimo  
        MAX_LENGTH: 2000,             // cm - comprimento máximo
        MIN_PRICE: 0,                 // R$ - preço mínimo
        MAX_PRICE: 10000              // R$ - preço máximo por m³
    }
};

// =============================================================================
// CONFIGURAÇÕES DE INTERFACE
// =============================================================================
export const UI_CONFIG = {
    // Paginação
    PAGINATION: {
        DEFAULT_PAGE_SIZE: 10,        // Itens por página
        MAX_PAGE_SIZE: 100,           // Máximo de itens por página
        VISIBLE_PAGES: 5              // Páginas visíveis na paginação
    },
    
    // Timeouts de UI
    TIMEOUTS: {
        NOTIFICATION_DURATION: 4000,  // 4 segundos
        DEBOUNCE_DELAY: 300,          // 300ms para debounce
        LOADING_DELAY: 100,           // 100ms antes de mostrar loading
        AUTO_SAVE_DELAY: 2000         // 2 segundos para auto-save
    },
    
    // Mensagens
    MESSAGES: {
        SUCCESS: {
            SAVE: 'Dados salvos com sucesso!',
            DELETE: 'Item excluído com sucesso!',
            UPDATE: 'Dados atualizados com sucesso!',
            LOAD: 'Dados carregados com sucesso!'
        },
        ERROR: {
            SAVE: 'Erro ao salvar dados. Tente novamente.',
            DELETE: 'Erro ao excluir item. Tente novamente.', 
            LOAD: 'Erro ao carregar dados. Verifique sua conexão.',
            VALIDATION: 'Dados inválidos. Verifique os campos.',
            NETWORK: 'Erro de conexão. Tente novamente.'
        },
        WARNING: {
            UNSAVED_CHANGES: 'Existem alterações não salvas. Deseja continuar?',
            DELETE_CONFIRM: 'Tem certeza que deseja excluir este item?',
            CLEAR_FORM: 'Deseja limpar todos os campos?'
        }
    }
};

// =============================================================================
// CONFIGURAÇÕES DE VALIDAÇÃO
// =============================================================================
export const VALIDATION_CONFIG = {
    // Campos obrigatórios
    REQUIRED_FIELDS: {
        ROMANEIO: ['data', 'fornecedor'],
        ITEM: ['especie', 'rodo', 'comprimento', 'preco'],
        FORNECEDOR: ['nome', 'cidade', 'estado'],
        ESPECIE: ['nome']
    },
    
    // Regex patterns
    PATTERNS: {
        PHONE: /^\(\d{2}\)\s\d{4,5}-\d{4}$/,
        EMAIL: /^[^\s@]+@[^\s@]+\.[^\s@]+$/,
        CURRENCY: /^\d+([.,]\d{1,2})?$/,
        DIMENSION: /^\d+([.,]\d{1})?$/
    },
    
    // Limites de caracteres
    LIMITS: {
        NOME_MIN: 2,
        NOME_MAX: 100,
        DESCRICAO_MAX: 500,
        OBSERVACAO_MAX: 1000
    }
};

// =============================================================================
// CONFIGURAÇÕES DE IMPRESSÃO/RELATÓRIOS
// =============================================================================
export const PRINT_CONFIG = {
    // Formatos de impressão
    FORMATS: {
        COMPLETO: 'completo',
        RESUMIDO: 'resumido', 
        RESUMO_ESPECIES: 'resumo_especies'
    },
    
    // Configurações de página
    PAGE: {
        ORIENTATION: 'landscape',
        MARGIN: '10mm',
        HEADER_HEIGHT: '60px',
        FOOTER_HEIGHT: '40px'
    },
    
    // Itens por página para impressão
    ITEMS_PER_PAGE: {
        COMPLETO: 15,
        RESUMIDO: 25,
        RESUMO_ESPECIES: 30
    }
};

// =============================================================================
// CONFIGURAÇÕES DE RESPONSIVIDADE
// =============================================================================
export const RESPONSIVE_CONFIG = {
    // Breakpoints
    BREAKPOINTS: {
        MOBILE: 768,
        TABLET: 1024,
        DESKTOP: 1200
    },
    
    // Configurações por dispositivo
    MOBILE: {
        ITEMS_PER_PAGE: 5,
        HIDE_COLUMNS: ['oco1', 'oco2', 'desconto'],
        COMPACT_MODE: true
    },
    
    TABLET: {
        ITEMS_PER_PAGE: 8,
        HIDE_COLUMNS: ['oco1', 'oco2'],
        COMPACT_MODE: false
    },
    
    DESKTOP: {
        ITEMS_PER_PAGE: 10,
        HIDE_COLUMNS: [],
        COMPACT_MODE: false
    }
};

// =============================================================================
// UTILITÁRIOS DE FORMATAÇÃO
// =============================================================================
export const FORMAT_CONFIG = {
    // Formatação de números
    NUMBER: {
        LOCALE: 'pt-BR',
        CURRENCY: 'BRL',
        VOLUME_SUFFIX: 'm³',
        DIMENSION_SUFFIX: 'cm'
    },
    
    // Formatação de datas
    DATE: {
        LOCALE: 'pt-BR',
        TIMEZONE: 'America/Sao_Paulo',
        INPUT_FORMAT: 'YYYY-MM-DD',
        DISPLAY_FORMAT: 'DD/MM/YYYY',
        TIMESTAMP_FORMAT: 'DD/MM/YYYY HH:mm:ss'
    }
};

// =============================================================================
// CONFIGURAÇÕES DE DESENVOLVIMENTO
// =============================================================================
export const DEV_CONFIG = {
    // Logs
    DEBUG_MODE: true,
    LOG_LEVEL: 'info', // 'error', 'warn', 'info', 'debug'
    
    // Performance monitoring
    PERFORMANCE_MONITORING: true,
    SLOW_OPERATION_THRESHOLD: 1000, // ms
    
    // Modo offline para desenvolvimento
    OFFLINE_MODE: false
};

// =============================================================================
// EXPORTAÇÃO CONSOLIDADA
// =============================================================================
export default {
    FIREBASE_CONFIG,
    VOLUME_CALCULATIONS,
    UI_CONFIG,
    VALIDATION_CONFIG,
    PRINT_CONFIG,
    RESPONSIVE_CONFIG,
    FORMAT_CONFIG,
    DEV_CONFIG
}; 