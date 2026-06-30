/**
 * SISTEMA DE NOTIFICAÇÕES UI
 * Interface visual para feedback do usuário
 * 
 * @author Sistema de Excelência Firebase
 * @version 2.0.0
 * @created 2024
 */

import stateManager, { EVENT_TYPES } from '../../services/stateManager.js';
import { UI_CONFIG } from '../../constants/app-constants.js';
import logger from '../../utils/logger.js';

// =============================================================================
// TIPOS DE NOTIFICAÇÃO
// =============================================================================
const NOTIFICATION_TYPES = {
    SUCCESS: 'success',
    ERROR: 'error',
    WARNING: 'warning',
    INFO: 'info',
    LOADING: 'loading'
};

// =============================================================================
// CLASSE PRINCIPAL DE NOTIFICAÇÕES
// =============================================================================
class NotificationSystem {
    constructor() {
        this.notifications = new Map();
        this.container = null;
        this.isInitialized = false;
        
        this.initialize();
    }

    /**
     * Inicializa o sistema de notificações
     */
    initialize() {
        // Cria container de notificações
        this.createContainer();
        
        // Conecta com StateManager
        this.setupStateListeners();
        
        this.isInitialized = true;
        logger.success('Sistema de notificações inicializado', '🔔 NOTIFICATIONS');
    }

    /**
     * Cria container HTML para notificações
     */
    createContainer() {
        // Remove container existente se houver
        const existing = document.getElementById('notifications-container');
        if (existing) {
            existing.remove();
        }

        // Cria novo container
        this.container = document.createElement('div');
        this.container.id = 'notifications-container';
        this.container.className = 'notifications-container';
        
        // Estilos inline para garantir funcionamento imediato
        this.container.style.cssText = `
            position: fixed;
            top: 20px;
            right: 20px;
            z-index: 9999;
            max-width: 400px;
            pointer-events: none;
        `;

        document.body.appendChild(this.container);
    }

    /**
     * Configura listeners do StateManager
     */
    setupStateListeners() {
        // Mensagens de sucesso
        stateManager.on(EVENT_TYPES.SUCCESS_MESSAGE, (data) => {
            this.show(data.message, NOTIFICATION_TYPES.SUCCESS);
        });

        // Mensagens de erro
        stateManager.on(EVENT_TYPES.ERROR_OCCURRED, (data) => {
            this.show(data.message, NOTIFICATION_TYPES.ERROR);
        });

        // Estados de carregamento
        stateManager.on(EVENT_TYPES.LOADING_CHANGED, (data) => {
            this.handleLoadingState(data);
        });

        // Sincronização de dados
        stateManager.on(EVENT_TYPES.DATA_SYNCED, (data) => {
            this.show(
                `${data.collection} sincronizados (${data.count} itens)`,
                NOTIFICATION_TYPES.INFO,
                { duration: 2000 }
            );
        });
    }

    // =========================================================================
    // MÉTODOS PÚBLICOS
    // =========================================================================

    /**
     * Mostra notificação
     */
    show(message, type = NOTIFICATION_TYPES.INFO, options = {}) {
        if (!this.isInitialized) {
            console.warn('Sistema de notificações não inicializado');
            return;
        }

        const config = {
            duration: UI_CONFIG.TIMEOUTS.NOTIFICATION_DURATION,
            persistent: false,
            showProgress: true,
            ...options
        };

        const id = this.generateId();
        const notification = this.createNotification(id, message, type, config);
        
        this.notifications.set(id, {
            element: notification,
            type,
            config,
            timestamp: Date.now()
        });

        // Adiciona ao container
        this.container.appendChild(notification);
        
        // Anima entrada
        this.animateIn(notification);

        // Remove automaticamente se não for persistente
        if (!config.persistent) {
            setTimeout(() => this.hide(id), config.duration);
        }

        logger.ui('notification_shown', `${type}: ${message}`);
        return id;
    }

    /**
     * Esconde notificação
     */
    hide(id) {
        const notification = this.notifications.get(id);
        if (!notification) return;

        this.animateOut(notification.element, () => {
            if (notification.element.parentNode) {
                notification.element.parentNode.removeChild(notification.element);
            }
            this.notifications.delete(id);
        });
    }

    /**
     * Limpa todas as notificações
     */
    clear() {
        this.notifications.forEach((notification, id) => {
            this.hide(id);
        });
    }

    /**
     * Mostra notificação de sucesso
     */
    success(message, options = {}) {
        return this.show(message, NOTIFICATION_TYPES.SUCCESS, options);
    }

    /**
     * Mostra notificação de erro
     */
    error(message, options = {}) {
        return this.show(message, NOTIFICATION_TYPES.ERROR, {
            duration: 6000, // Erros ficam mais tempo
            ...options
        });
    }

    /**
     * Mostra notificação de aviso
     */
    warning(message, options = {}) {
        return this.show(message, NOTIFICATION_TYPES.WARNING, options);
    }

    /**
     * Mostra notificação de informação
     */
    info(message, options = {}) {
        return this.show(message, NOTIFICATION_TYPES.INFO, options);
    }

    /**
     * Mostra notificação de carregamento
     */
    loading(message, options = {}) {
        return this.show(message, NOTIFICATION_TYPES.LOADING, {
            persistent: true,
            showProgress: false,
            ...options
        });
    }

    // =========================================================================
    // MÉTODOS PRIVADOS
    // =========================================================================

    /**
     * Gera ID único para notificação
     */
    generateId() {
        return 'notification_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
    }

    /**
     * Cria elemento HTML da notificação
     */
    createNotification(id, message, type, config) {
        const allowedTypes = Object.values(NOTIFICATION_TYPES);
        const safeType = allowedTypes.includes(type) ? type : NOTIFICATION_TYPES.INFO;
        const notification = document.createElement('div');
        notification.id = id;
        notification.className = `notification notification-${safeType}`;
        notification.style.cssText = this.getNotificationStyles(safeType);

        // Ícone baseado no tipo
        const icon = this.getIcon(safeType);
        
        const content = document.createElement('div');
        content.className = 'notification-content';

        const iconEl = document.createElement('div');
        iconEl.className = 'notification-icon';
        iconEl.textContent = icon;

        const messageEl = document.createElement('div');
        messageEl.className = 'notification-message';
        messageEl.textContent = String(message == null ? '' : message);

        const closeButton = document.createElement('button');
        closeButton.className = 'notification-close';
        closeButton.type = 'button';
        closeButton.setAttribute('aria-label', 'Fechar notificação');
        closeButton.textContent = '×';
        closeButton.onclick = () => this.hide(id);

        content.appendChild(iconEl);
        content.appendChild(messageEl);
        content.appendChild(closeButton);
        notification.appendChild(content);

        // Barra de progresso se necessário
        if (config.showProgress) {
            notification.insertAdjacentHTML('beforeend', this.createProgressBar(config.duration));
        }

        // Torna o elemento interativo
        notification.style.pointerEvents = 'auto';

        return notification;
    }

    /**
     * Obtém estilos CSS para notificação
     */
    getNotificationStyles(type) {
        const baseStyles = `
            margin-bottom: 10px;
            border-radius: 8px;
            box-shadow: 0 4px 12px rgba(0,0,0,0.15);
            overflow: hidden;
            transform: translateX(100%);
            transition: all 0.3s ease;
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
            font-size: 14px;
            max-width: 100%;
            position: relative;
        `;

        const typeStyles = {
            [NOTIFICATION_TYPES.SUCCESS]: `
                background: linear-gradient(135deg, #2ecc71, #27ae60);
                color: white;
                border-left: 4px solid #1e8449;
            `,
            [NOTIFICATION_TYPES.ERROR]: `
                background: linear-gradient(135deg, #e74c3c, #c0392b);
                color: white;
                border-left: 4px solid #a93226;
            `,
            [NOTIFICATION_TYPES.WARNING]: `
                background: linear-gradient(135deg, #f39c12, #e67e22);
                color: white;
                border-left: 4px solid #d35400;
            `,
            [NOTIFICATION_TYPES.INFO]: `
                background: linear-gradient(135deg, #3498db, #2980b9);
                color: white;
                border-left: 4px solid #1f4e79;
            `,
            [NOTIFICATION_TYPES.LOADING]: `
                background: linear-gradient(135deg, #9b59b6, #8e44ad);
                color: white;
                border-left: 4px solid #6c3483;
            `
        };

        return baseStyles + (typeStyles[type] || typeStyles[NOTIFICATION_TYPES.INFO]);
    }

    /**
     * Obtém ícone para tipo de notificação
     */
    getIcon(type) {
        const icons = {
            [NOTIFICATION_TYPES.SUCCESS]: '✅',
            [NOTIFICATION_TYPES.ERROR]: '❌',
            [NOTIFICATION_TYPES.WARNING]: '⚠️',
            [NOTIFICATION_TYPES.INFO]: 'ℹ️',
            [NOTIFICATION_TYPES.LOADING]: '⏳'
        };

        return icons[type] || icons[NOTIFICATION_TYPES.INFO];
    }

    /**
     * Cria barra de progresso
     */
    createProgressBar(duration) {
        return `
            <div class="notification-progress" style="
                position: absolute;
                bottom: 0;
                left: 0;
                height: 3px;
                background: rgba(255,255,255,0.3);
                width: 100%;
                animation: notificationProgress ${duration}ms linear;
            "></div>
            <style>
                @keyframes notificationProgress {
                    from { width: 100%; }
                    to { width: 0%; }
                }
            </style>
        `;
    }

    /**
     * Anima entrada da notificação
     */
    animateIn(element) {
        // Força reflow para garantir que a animação funcione
        element.offsetHeight;
        
        requestAnimationFrame(() => {
            element.style.transform = 'translateX(0)';
            element.style.opacity = '1';
        });
    }

    /**
     * Anima saída da notificação
     */
    animateOut(element, callback) {
        element.style.transform = 'translateX(100%)';
        element.style.opacity = '0';
        
        setTimeout(() => {
            if (callback) callback();
        }, 300);
    }

    /**
     * Manipula estados de carregamento
     */
    handleLoadingState(data) {
        const { type, isLoading } = data;
        
        if (isLoading) {
            const loadingMessages = {
                romaneios: 'Carregando romaneios...',
                fornecedores: 'Carregando fornecedores...',
                especies: 'Carregando espécies...',
                saving: 'Salvando dados...'
            };

            const message = loadingMessages[type] || 'Carregando...';
            const id = `loading_${type}`;
            
            // Remove notificação de carregamento anterior se existir
            this.hide(id);
            
            // Cria nova notificação de carregamento
            const notification = this.createNotification(id, message, NOTIFICATION_TYPES.LOADING, {
                persistent: true,
                showProgress: false
            });
            
            this.notifications.set(id, {
                element: notification,
                type: NOTIFICATION_TYPES.LOADING,
                config: { persistent: true },
                timestamp: Date.now()
            });

            this.container.appendChild(notification);
            this.animateIn(notification);
        } else {
            // Remove notificação de carregamento
            this.hide(`loading_${type}`);
        }
    }

    /**
     * Adiciona estilos CSS globais
     */
    injectStyles() {
        if (document.getElementById('notifications-styles')) return;

        const styles = document.createElement('style');
        styles.id = 'notifications-styles';
        styles.textContent = `
            .notification-content {
                display: flex;
                align-items: center;
                padding: 12px 16px;
                gap: 10px;
            }

            .notification-icon {
                font-size: 18px;
                flex-shrink: 0;
            }

            .notification-message {
                flex: 1;
                font-weight: 500;
                line-height: 1.4;
            }

            .notification-close {
                background: none;
                border: none;
                color: currentColor;
                font-size: 20px;
                cursor: pointer;
                padding: 0;
                width: 24px;
                height: 24px;
                display: flex;
                align-items: center;
                justify-content: center;
                border-radius: 50%;
                opacity: 0.7;
                transition: opacity 0.2s;
                flex-shrink: 0;
            }

            .notification-close:hover {
                opacity: 1;
                background: rgba(255,255,255,0.1);
            }

            @media (max-width: 768px) {
                .notifications-container {
                    left: 10px;
                    right: 10px;
                    top: 10px;
                    max-width: none;
                }

                .notification {
                    margin-bottom: 8px;
                }

                .notification-content {
                    padding: 10px 12px;
                    font-size: 13px;
                }
            }
        `;

        document.head.appendChild(styles);
    }
}

// =============================================================================
// INSTÂNCIA GLOBAL
// =============================================================================
const notificationSystem = new NotificationSystem();

// Injeta estilos
notificationSystem.injectStyles();

// Disponibiliza globalmente para uso no HTML
window.notificationSystem = notificationSystem;

// =============================================================================
// EXPORTAÇÕES
// =============================================================================
export default notificationSystem;

// Exportar métodos principais
export const {
    show,
    hide,
    clear,
    success,
    error,
    warning,
    info,
    loading
} = notificationSystem;

// Exportar tipos para facilitar uso
export { NOTIFICATION_TYPES }; 
