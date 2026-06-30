/**
 * SERVIÇO DE NOTIFICAÇÕES PUSH
 * Sistema completo de notificações em tempo real
 * 
 * @author Sistema de Excelência Firebase
 * @version 4.0.0
 * @created 2024
 */

import { messaging, getToken, onMessage } from '../constants/app-constants.js';
import authService from './authService.js';
import stateManager from './stateManager.js';
import { getNotificationSystem } from '../components/ui/notifications.js';
import logger from '../utils/logger.js';

// =============================================================================
// CLASSE PRINCIPAL DE NOTIFICAÇÕES PUSH
// =============================================================================
class PushService {
    constructor() {
        this.isSupported = 'serviceWorker' in navigator && 'PushManager' in window;
        this.registration = null;
        this.currentToken = null;
        this.permission = 'default';
        this.isInitialized = false;
        this.subscribers = new Map();
        this.notificationQueue = [];
        this.retryAttempts = 0;
        this.maxRetryAttempts = 3;
        
        this.initialize();
    }

    /**
     * Inicializa o serviço de push
     */
    async initialize() {
        try {
            if (!this.isSupported) {
                logger.warn('Push notifications não suportadas neste browser', '🔔 PUSH');
                return;
            }

            await this.setupServiceWorker();
            await this.checkPermissions();
            await this.setupMessageHandler();
            
            this.isInitialized = true;
            logger.success('Serviço de push inicializado', '🔔 PUSH');
            
        } catch (error) {
            logger.error('Erro ao inicializar serviço de push', '🔔 PUSH', error);
        }
    }

    /**
     * Configura service worker
     */
    async setupServiceWorker() {
        try {
            this.registration = await navigator.serviceWorker.register('/sw.js', {
                scope: '/',
                updateViaCache: 'none'
            });

            // Espera o service worker estar pronto
            await navigator.serviceWorker.ready;
            
            logger.success('Service Worker registrado para push', '🔔 PUSH');
            
        } catch (error) {
            logger.error('Erro ao registrar Service Worker', '🔔 PUSH', error);
            throw error;
        }
    }

    /**
     * Verifica permissões de notificação
     */
    async checkPermissions() {
        this.permission = await Notification.permission;
        
        if (this.permission === 'granted') {
            await this.initializeToken();
        }
        
        logger.info(`Permissão de notificação: ${this.permission}`, '🔔 PUSH');
    }

    /**
     * Configura handler de mensagens em foreground
     */
    setupMessageHandler() {
        if (messaging) {
            onMessage(messaging, (payload) => {
                this.handleForegroundMessage(payload);
            });
        }
    }

    // =========================================================================
    // MÉTODOS PÚBLICOS
    // =========================================================================

    /**
     * Solicita permissão para notificações
     */
    async requestPermission() {
        try {
            if (!this.isSupported) {
                throw new Error('Notificações push não suportadas');
            }

            const permission = await Notification.requestPermission();
            this.permission = permission;
            
            if (permission === 'granted') {
                await this.initializeToken();
                logger.success('Permissão para notificações concedida', '🔔 PUSH');
                return true;
            } else {
                logger.warn('Permissão para notificações negada', '🔔 PUSH');
                return false;
            }
            
        } catch (error) {
            logger.error('Erro ao solicitar permissão', '🔔 PUSH', error);
            return false;
        }
    }

    /**
     * Inicializa token FCM
     */
    async initializeToken() {
        try {
            if (!messaging) {
                logger.warn('Firebase Messaging não disponível', '🔔 PUSH');
                return;
            }

            const vapidKey = process.env.FIREBASE_VAPID_KEY || 'YOUR_VAPID_KEY';
            
            this.currentToken = await getToken(messaging, {
                vapidKey: vapidKey,
                serviceWorkerRegistration: this.registration
            });

            if (this.currentToken) {
                logger.success('Token FCM obtido', '🔔 PUSH');
                await this.saveTokenToServer();
            } else {
                logger.warn('Não foi possível obter token FCM', '🔔 PUSH');
            }
            
        } catch (error) {
            logger.error('Erro ao obter token FCM', '🔔 PUSH', error);
        }
    }

    /**
     * Envia notificação local
     */
    async showNotification(title, options = {}) {
        try {
            if (this.permission !== 'granted') {
                logger.warn('Sem permissão para exibir notificação', '🔔 PUSH');
                return;
            }

            const defaultOptions = {
                body: '',
                icon: '/assets/icons/icon-192x192.png',
                badge: '/icons/badge-72x72.png',
                image: null,
                tag: 'sisweb-notification',
                renotify: true,
                requireInteraction: false,
                silent: false,
                vibrate: [200, 100, 200],
                timestamp: Date.now(),
                actions: [
                    {
                        action: 'open',
                        title: 'Abrir',
                        icon: '/icons/action-open.png'
                    },
                    {
                        action: 'close',
                        title: 'Fechar',
                        icon: '/icons/action-close.png'
                    }
                ],
                data: {
                    url: '/',
                    source: 'sisweb'
                }
            };

            const finalOptions = { ...defaultOptions, ...options };
            
            if (this.registration) {
                await this.registration.showNotification(title, finalOptions);
            } else {
                new Notification(title, finalOptions);
            }
            
            logger.success('Notificação exibida', '🔔 PUSH');
            
        } catch (error) {
            logger.error('Erro ao exibir notificação', '🔔 PUSH', error);
        }
    }

    /**
     * Programa notificação agendada
     */
    async scheduleNotification(title, options, delay) {
        try {
            setTimeout(() => {
                this.showNotification(title, options);
            }, delay);
            
            logger.info(`Notificação agendada para ${delay}ms`, '🔔 PUSH');
            
        } catch (error) {
            logger.error('Erro ao agendar notificação', '🔔 PUSH', error);
        }
    }

    /**
     * Cancela todas as notificações
     */
    async clearAllNotifications() {
        try {
            if (this.registration) {
                const notifications = await this.registration.getNotifications();
                notifications.forEach(notification => notification.close());
                logger.info('Todas as notificações foram fechadas', '🔔 PUSH');
            }
        } catch (error) {
            logger.error('Erro ao limpar notificações', '🔔 PUSH', error);
        }
    }

    /**
     * Subscreve a um tópico de notificações
     */
    subscribe(topic, callback) {
        if (!this.subscribers.has(topic)) {
            this.subscribers.set(topic, new Set());
        }
        this.subscribers.get(topic).add(callback);
        
        logger.info(`Subscrito ao tópico: ${topic}`, '🔔 PUSH');
    }

    /**
     * Remove subscrição de um tópico
     */
    unsubscribe(topic, callback) {
        if (this.subscribers.has(topic)) {
            this.subscribers.get(topic).delete(callback);
            
            if (this.subscribers.get(topic).size === 0) {
                this.subscribers.delete(topic);
            }
        }
        
        logger.info(`Removido do tópico: ${topic}`, '🔔 PUSH');
    }

    // =========================================================================
    // TIPOS DE NOTIFICAÇÕES ESPECÍFICAS
    // =========================================================================

    /**
     * Notificação de novo romaneio
     */
    async notifyNewRomaneio(romaneio) {
        const title = '📋 Novo Romaneio Criado';
        const options = {
            body: `Romaneio ${romaneio.numeroRomaneio} de ${romaneio.fornecedor?.nome || 'fornecedor não informado'}`,
            tag: 'new-romaneio',
            data: {
                type: 'romaneio',
                id: romaneio.id,
                url: `/?page=romaneios&id=${romaneio.id}`
            },
            actions: [
                {
                    action: 'view',
                    title: 'Visualizar',
                    icon: '/icons/action-view.png'
                },
                {
                    action: 'edit',
                    title: 'Editar',
                    icon: '/icons/action-edit.png'
                }
            ]
        };

        await this.showNotification(title, options);
        this.notifySubscribers('romaneio:created', romaneio);
    }

    /**
     * Notificação de atualização de romaneio
     */
    async notifyRomaneioUpdate(romaneio) {
        const title = '✏️ Romaneio Atualizado';
        const options = {
            body: `Romaneio ${romaneio.numeroRomaneio} foi modificado`,
            tag: 'update-romaneio',
            data: {
                type: 'romaneio',
                id: romaneio.id,
                url: `/?page=romaneios&id=${romaneio.id}`
            }
        };

        await this.showNotification(title, options);
        this.notifySubscribers('romaneio:updated', romaneio);
    }

    /**
     * Notificação de sincronização offline
     */
    async notifyOfflineSync(count) {
        const title = '🔄 Dados Sincronizados';
        const options = {
            body: `${count} registro(s) foram sincronizados quando a conexão foi restaurada`,
            tag: 'offline-sync',
            data: {
                type: 'sync',
                count: count
            }
        };

        await this.showNotification(title, options);
    }

    /**
     * Notificação de erro crítico
     */
    async notifyError(message, details = {}) {
        const title = '⚠️ Erro no Sistema';
        const options = {
            body: message,
            tag: 'system-error',
            requireInteraction: true,
            data: {
                type: 'error',
                details: details
            },
            actions: [
                {
                    action: 'reload',
                    title: 'Recarregar',
                    icon: '/icons/action-reload.png'
                }
            ]
        };

        await this.showNotification(title, options);
    }

    /**
     * Notificação de reminder
     */
    async notifyReminder(message, actionUrl = '/') {
        const title = '⏰ Lembrete';
        const options = {
            body: message,
            tag: 'reminder',
            data: {
                type: 'reminder',
                url: actionUrl
            }
        };

        await this.showNotification(title, options);
    }

    // =========================================================================
    // MANIPULADORES DE EVENTOS
    // =========================================================================

    /**
     * Manipula mensagens recebidas em foreground
     */
    handleForegroundMessage(payload) {
        try {
            const { notification, data } = payload;
            
            if (notification) {
                // Mostra notificação via sistema UI em vez de push
                const notificationSystem = getNotificationSystem();
                notificationSystem.info(notification.body, notification.title);
            }
            
            // Processa dados customizados
            if (data) {
                this.processNotificationData(data);
            }
            
            logger.info('Mensagem em foreground processada', '🔔 PUSH');
            
        } catch (error) {
            logger.error('Erro ao processar mensagem em foreground', '🔔 PUSH', error);
        }
    }

    /**
     * Processa dados da notificação
     */
    processNotificationData(data) {
        try {
            const { type, action, payload } = data;
            
            switch (type) {
                case 'romaneio':
                    this.handleRomaneioNotification(action, payload);
                    break;
                    
                case 'sync':
                    this.handleSyncNotification(action, payload);
                    break;
                    
                case 'system':
                    this.handleSystemNotification(action, payload);
                    break;
                    
                default:
                    logger.info(`Tipo de notificação desconhecido: ${type}`, '🔔 PUSH');
            }
            
        } catch (error) {
            logger.error('Erro ao processar dados da notificação', '🔔 PUSH', error);
        }
    }

    /**
     * Manipula notificações de romaneio
     */
    handleRomaneioNotification(action, payload) {
        switch (action) {
            case 'created':
                stateManager.emit('romaneio:created', payload);
                break;
                
            case 'updated':
                stateManager.emit('romaneio:updated', payload);
                break;
                
            case 'deleted':
                stateManager.emit('romaneio:deleted', payload);
                break;
        }
    }

    /**
     * Manipula notificações de sincronização
     */
    handleSyncNotification(action, payload) {
        if (action === 'completed') {
            stateManager.emit('sync:completed', payload);
        }
    }

    /**
     * Manipula notificações do sistema
     */
    handleSystemNotification(action, payload) {
        switch (action) {
            case 'update-available':
                this.handleUpdateAvailable(payload);
                break;
                
            case 'maintenance':
                this.handleMaintenanceMode(payload);
                break;
        }
    }

    /**
     * Manipula atualização disponível
     */
    handleUpdateAvailable(payload) {
        const title = '🔄 Atualização Disponível';
        const options = {
            body: 'Uma nova versão do SisWeb está disponível',
            tag: 'update-available',
            requireInteraction: true,
            data: {
                type: 'update',
                version: payload.version
            },
            actions: [
                {
                    action: 'update',
                    title: 'Atualizar Agora',
                    icon: '/icons/action-update.png'
                },
                {
                    action: 'later',
                    title: 'Mais Tarde',
                    icon: '/icons/action-later.png'
                }
            ]
        };

        this.showNotification(title, options);
    }

    /**
     * Manipula modo de manutenção
     */
    handleMaintenanceMode(payload) {
        const title = '🛠️ Manutenção Programada';
        const options = {
            body: `Sistema entrará em manutenção em ${payload.startTime}`,
            tag: 'maintenance',
            requireInteraction: true,
            data: {
                type: 'maintenance',
                startTime: payload.startTime,
                duration: payload.duration
            }
        };

        this.showNotification(title, options);
    }

    // =========================================================================
    // MÉTODOS DE UTILIDADE
    // =========================================================================

    /**
     * Salva token no servidor
     */
    async saveTokenToServer() {
        try {
            if (!this.currentToken) return;

            const user = authService.getCurrentUser();
            if (!user) return;

            const tokenData = {
                token: this.currentToken,
                userId: user.uid,
                device: this.getDeviceInfo(),
                timestamp: new Date().toISOString()
            };

            await stateManager.firebaseService.save('push_tokens', tokenData);
            logger.success('Token FCM salvo no servidor', '🔔 PUSH');
            
        } catch (error) {
            logger.error('Erro ao salvar token no servidor', '🔔 PUSH', error);
        }
    }

    /**
     * Obtém informações do dispositivo
     */
    getDeviceInfo() {
        return {
            userAgent: navigator.userAgent,
            platform: navigator.platform,
            language: navigator.language,
            online: navigator.onLine,
            cookieEnabled: navigator.cookieEnabled,
            screen: {
                width: screen.width,
                height: screen.height,
                colorDepth: screen.colorDepth
            }
        };
    }

    /**
     * Notifica subscribers de um tópico
     */
    notifySubscribers(topic, data) {
        if (this.subscribers.has(topic)) {
            const callbacks = this.subscribers.get(topic);
            callbacks.forEach(callback => {
                try {
                    callback(data);
                } catch (error) {
                    logger.error(`Erro em callback do tópico ${topic}`, '🔔 PUSH', error);
                }
            });
        }
    }

    /**
     * Testa notificação
     */
    async testNotification() {
        const title = '🧪 Notificação de Teste';
        const options = {
            body: 'Esta é uma notificação de teste do SisWeb',
            tag: 'test-notification',
            data: {
                type: 'test',
                timestamp: Date.now()
            }
        };

        await this.showNotification(title, options);
    }

    // =========================================================================
    // GETTERS E STATUS
    // =========================================================================

    /**
     * Verifica se notificações estão habilitadas
     */
    isEnabled() {
        return this.permission === 'granted' && this.isSupported;
    }

    /**
     * Obtém status do serviço
     */
    getStatus() {
        return {
            supported: this.isSupported,
            permission: this.permission,
            hasToken: !!this.currentToken,
            initialized: this.isInitialized,
            subscriberCount: this.subscribers.size
        };
    }

    /**
     * Obtém token atual
     */
    getCurrentToken() {
        return this.currentToken;
    }

    /**
     * Atualiza configurações
     */
    updateSettings(settings) {
        // Implementar atualização de configurações
        logger.info('Configurações de push atualizadas', '🔔 PUSH');
    }
}

// =============================================================================
// INSTÂNCIA GLOBAL
// =============================================================================
const pushService = new PushService();

// Disponibiliza globalmente
window.pushService = pushService;

// =============================================================================
// EXPORTAÇÕES
// =============================================================================
export default pushService;

export const {
    requestPermission,
    showNotification,
    scheduleNotification,
    clearAllNotifications,
    subscribe,
    unsubscribe,
    notifyNewRomaneio,
    notifyRomaneioUpdate,
    notifyOfflineSync,
    notifyError,
    notifyReminder,
    testNotification,
    isEnabled,
    getStatus,
    getCurrentToken
} = pushService;
