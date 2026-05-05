/**
 * 📱 RESPONSIVE MANAGER - GERENCIADOR DE RESPONSIVIDADE
 * 
 * Sistema inteligente de responsividade que otimiza a interface
 * baseado no dispositivo, tamanho da tela e performance
 * 
 * 🎯 RECURSOS:
 * - Detecção inteligente de dispositivo
 * - Adaptação automática de layout
 * - Otimização de performance por dispositivo
 * - Lazy loading responsivo
 * - Redimensionamento inteligente
 * 
 * @version 1.0.0
 * @author Sistema Modular SISWEB
 */

class ResponsiveManager {
    constructor() {
        this.config = {
            // Breakpoints otimizados
            breakpoints: {
                xs: 480,
                sm: 576,
                md: 768,
                lg: 992,
                xl: 1200,
                xxl: 1400
            },
            
            // Configurações por dispositivo
            deviceOptimizations: {
                mobile: {
                    lazyLoad: true,
                    reduceAnimations: true,
                    simplifyCharts: true,
                    limitTableRows: 5
                },
                tablet: {
                    lazyLoad: true,
                    reduceAnimations: false,
                    simplifyCharts: false,
                    limitTableRows: 10
                },
                desktop: {
                    lazyLoad: false,
                    reduceAnimations: false,
                    simplifyCharts: false,
                    limitTableRows: -1 // sem limite
                }
            },
            
            // Performance thresholds
            performanceThresholds: {
                slow: 3000, // 3 segundos
                medium: 1500, // 1.5 segundos
                fast: 500 // 0.5 segundos
            }
        };

        this.state = {
            currentBreakpoint: 'lg',
            deviceType: 'desktop',
            orientation: 'landscape',
            isTouch: false,
            performanceLevel: 'fast',
            viewportWidth: window.innerWidth,
            viewportHeight: window.innerHeight,
            pixelRatio: window.devicePixelRatio || 1
        };

        this.observers = {
            resize: new Set(),
            orientation: new Set(),
            breakpoint: new Set()
        };

        this.init();
    }

    /**
     * 🚀 INICIALIZAÇÃO
     */
    init() {
        // Garantir que DOM esteja pronto antes de iniciar
        if (document.readyState === 'loading') {
            document.addEventListener('DOMContentLoaded', () => this.init());
            return;
        }

        console.log('📱 Inicializando Responsive Manager...');
        
        this.detectDevice();
        this.detectPerformance();
        this.setupEventListeners();
        this.setupOfflineDetection(); // Nova função de detecção offline
        this.applyInitialOptimizations();
        
        console.log('📱 Responsive Manager inicializado:', this.state);
    }

    /**
     * 🌐 DETECÇÃO DE CONEXÃO (OFFLINE/ONLINE)
     */
    setupOfflineDetection() {
        // Estado inicial
        this.handleConnectionChange(navigator.onLine);

        // Listeners do navegador
        window.addEventListener('online', () => this.handleConnectionChange(true));
        window.addEventListener('offline', () => this.handleConnectionChange(false));

        // Integração com FirebaseService (se disponível)
        // Verifica periodicamente se a variável global mudou
        setInterval(() => {
            if (window.firebaseConnected === false && navigator.onLine) {
                // Se o navegador diz que tem internet, mas o Firebase diz que não,
                // pode ser um bloqueio ou falha específica do serviço.
                // Mas para o usuário, "sem conexão com o servidor" é similar a offline.
                // Opcional: mostrar mensagem específica "Servidor indisponível"
            }
        }, 5000);
    }

    handleConnectionChange(isOnline) {
        if (isOnline) {
            document.body.classList.remove('offline-mode');
            this.hideOfflineMessage();
            console.log('🌐 Conexão restabelecida. Sincronizando...');
            // Aqui poderia disparar um evento de sincronização se houvesse fila
        } else {
            document.body.classList.add('offline-mode');
            this.showOfflineMessage();
            console.log('🚫 Sem conexão. Modo offline ativado.');
        }
    }

    showOfflineMessage() {
        let msg = document.getElementById('offline-message-banner');
        if (!msg) {
            msg = document.createElement('div');
            msg.id = 'offline-message-banner';
            msg.innerHTML = `
                <div class="offline-content">
                    <i class="fas fa-wifi-slash"></i>
                    <span>
                        <strong>Sem conexão com a internet.</strong><br>
                        O sistema está operando em modo local. Seus dados serão sincronizados automaticamente assim que a conexão for restabelecida.
                        Outros usuários não verão suas alterações até a sincronização.
                    </span>
                    <button onclick="this.parentElement.parentElement.style.display='none'">&times;</button>
                </div>
            `;
            // Estilos Inline para garantir visualização
            msg.style.cssText = `
                position: fixed;
                bottom: 20px;
                left: 50%;
                transform: translateX(-50%);
                background-color: #333;
                color: white;
                padding: 15px 20px;
                border-radius: 8px;
                box-shadow: 0 4px 15px rgba(0,0,0,0.3);
                z-index: 9999;
                display: flex;
                align-items: center;
                min-width: 300px;
                max-width: 90%;
                border-left: 5px solid #e74c3c;
                animation: slideUp 0.3s ease-out;
            `;
            
            const style = document.createElement('style');
            style.textContent = `
                #offline-message-banner .offline-content { display: flex; align-items: center; gap: 15px; width: 100%; }
                #offline-message-banner i { font-size: 24px; color: #e74c3c; }
                #offline-message-banner span { flex: 1; font-size: 14px; line-height: 1.4; }
                #offline-message-banner button { background: none; border: none; color: #aaa; font-size: 20px; cursor: pointer; padding: 0 5px; }
                #offline-message-banner button:hover { color: white; }
                @keyframes slideUp { from { transform: translate(-50%, 100%); opacity: 0; } to { transform: translate(-50%, 0); opacity: 1; } }
            `;
            document.head.appendChild(style);
            document.body.appendChild(msg);
        } else {
            msg.style.display = 'flex';
        }
    }

    hideOfflineMessage() {
        const msg = document.getElementById('offline-message-banner');
        if (msg) {
            msg.style.display = 'none';
        }
    }

    /**
     * 🔍 DETECÇÃO DE DISPOSITIVO
     */
    detectDevice() {
        const width = window.innerWidth;
        const userAgent = navigator.userAgent.toLowerCase();
        
        // Detectar tipo de dispositivo
        this.state.isTouch = 'ontouchstart' in window || navigator.maxTouchPoints > 0;
        
        if (width < this.config.breakpoints.md) {
            this.state.deviceType = 'mobile';
        } else if (width < this.config.breakpoints.xl) {
            this.state.deviceType = 'tablet';
        } else {
            this.state.deviceType = 'desktop';
        }
        
        // Detectar breakpoint atual
        this.state.currentBreakpoint = this.getBreakpoint(width);
        
        // Detectar orientação
        this.state.orientation = width > window.innerHeight ? 'landscape' : 'portrait';
        
        // Atualizar viewport
        this.state.viewportWidth = width;
        this.state.viewportHeight = window.innerHeight;
        
        // Adicionar classes CSS para styling
        this.updateCSSClasses();
    }

    /**
     * 📊 DETECÇÃO DE PERFORMANCE
     */
    detectPerformance() {
        if (!window.performance) {
            this.state.performanceLevel = 'medium';
            return;
        }

        // Medir performance de carregamento
        const loadTime = performance.now();
        
        if (loadTime < this.config.performanceThresholds.fast) {
            this.state.performanceLevel = 'fast';
        } else if (loadTime < this.config.performanceThresholds.medium) {
            this.state.performanceLevel = 'medium';
        } else {
            this.state.performanceLevel = 'slow';
        }

        // Detectar hardware limitado
        if (navigator.hardwareConcurrency && navigator.hardwareConcurrency < 4) {
            this.state.performanceLevel = 'slow';
        }

        // Detectar conexão lenta
        if (navigator.connection) {
            const connection = navigator.connection;
            if (connection.effectiveType === '2g' || connection.effectiveType === 'slow-2g') {
                this.state.performanceLevel = 'slow';
            }
        }
    }

    /**
     * 📏 OBTER BREAKPOINT ATUAL
     */
    getBreakpoint(width) {
        if (width < this.config.breakpoints.xs) return 'xs';
        if (width < this.config.breakpoints.sm) return 'sm';
        if (width < this.config.breakpoints.md) return 'md';
        if (width < this.config.breakpoints.lg) return 'lg';
        if (width < this.config.breakpoints.xl) return 'xl';
        return 'xxl';
    }

    /**
     * 🎨 ATUALIZAR CLASSES CSS
     */
    updateCSSClasses() {
        const body = document.body || document.documentElement;
        if (!body || !body.classList) {
            // Aguardar DOM pronto e tentar novamente
            document.addEventListener('DOMContentLoaded', () => {
                try { this.updateCSSClasses(); } catch (_) {}
            }, { once: true });
            return;
        }
        
        // Remover classes antigas
        try {
            body.classList.remove('device-mobile', 'device-tablet', 'device-desktop');
            body.classList.remove('perf-slow', 'perf-medium', 'perf-fast');
            body.classList.remove('touch-device', 'no-touch');
        } catch (_) {}
        
        // Adicionar novas classes
        try {
            body.classList.add(`device-${this.state.deviceType}`);
            body.classList.add(`perf-${this.state.performanceLevel}`);
            body.classList.add(this.state.isTouch ? 'touch-device' : 'no-touch');
            body.classList.add(`bp-${this.state.currentBreakpoint}`);
        } catch (_) {}
    }

    /**
     * 🔧 APLICAR OTIMIZAÇÕES INICIAIS
     */
    applyInitialOptimizations() {
        const optimizations = this.config.deviceOptimizations[this.state.deviceType];
        
        // Aplicar otimizações de performance
        if (this.state.performanceLevel === 'slow') {
            this.enablePerformanceMode();
        }
        
        // Otimizações por dispositivo
        if (optimizations.reduceAnimations) {
            this.reduceAnimations();
        }
        
        if (optimizations.lazyLoad) {
            this.enableLazyLoading();
        }
        
        // Otimizações específicas para mobile
        if (this.state.deviceType === 'mobile') {
            this.optimizeForMobile();
        }
    }

    /**
     * ⚡ MODO DE ALTA PERFORMANCE
     */
    enablePerformanceMode() {
        document.body.classList.add('performance-mode');
        
        // Reduzir transições
        const style = document.createElement('style');
        style.textContent = `
            .performance-mode * {
                transition-duration: 0.1s !important;
                animation-duration: 0.1s !important;
            }
            .performance-mode .chart-container canvas {
                image-rendering: pixelated;
            }
        `;
        document.head.appendChild(style);
        
        console.log('⚡ Modo de alta performance ativado');
    }

    /**
     * 🎭 REDUZIR ANIMAÇÕES
     */
    reduceAnimations() {
        document.body.classList.add('reduced-animations');
        
        const style = document.createElement('style');
        style.textContent = `
            .reduced-animations * {
                transition-duration: 0.2s !important;
                animation-duration: 0.2s !important;
            }
            .reduced-animations .fade-in {
                animation: none !important;
                opacity: 1 !important;
            }
        `;
        document.head.appendChild(style);
    }

    /**
     * 📱 OTIMIZAÇÕES PARA MOBILE
     */
    optimizeForMobile() {
        // Adicionar viewport meta se não existir
        if (!document.querySelector('meta[name="viewport"]')) {
            const viewport = document.createElement('meta');
            viewport.name = 'viewport';
            viewport.content = 'width=device-width, initial-scale=1.0, user-scalable=no';
            document.head.appendChild(viewport);
        }
        
        // Prevenir zoom em inputs
        const inputs = document.querySelectorAll('input, select, textarea');
        inputs.forEach(input => {
            if (input.style.fontSize === '' || parseFloat(input.style.fontSize) < 16) {
                input.style.fontSize = '16px';
            }
        });
        
        // Otimizar tabelas para mobile
        this.optimizeTablesForMobile();
        
        console.log('📱 Otimizações mobile aplicadas');
    }

    /**
     * 📊 OTIMIZAR TABELAS PARA MOBILE
     */
    optimizeTablesForMobile() {
        const tables = document.querySelectorAll('.data-table');
        
        tables.forEach(table => {
            if (this.state.deviceType === 'mobile') {
                // Converter para layout de cards
                this.convertTableToCards(table);
            }
        });
    }

    convertTableToCards(table) {
        const headers = Array.from(table.querySelectorAll('th')).map(th => th.textContent);
        const rows = Array.from(table.querySelectorAll('tbody tr'));
        
        rows.forEach(row => {
            const cells = Array.from(row.querySelectorAll('td'));
            cells.forEach((cell, index) => {
                if (headers[index]) {
                    cell.setAttribute('data-label', headers[index]);
                }
            });
        });
        
        table.classList.add('mobile-cards');
    }

    /**
     * 🔄 LAZY LOADING
     */
    enableLazyLoading() {
        // Lazy loading para gráficos
        const charts = document.querySelectorAll('.chart-container');
        
        if ('IntersectionObserver' in window) {
            const observer = new IntersectionObserver((entries) => {
                entries.forEach(entry => {
                    if (entry.isIntersecting) {
                        const chart = entry.target;
                        chart.classList.add('load-chart');
                        observer.unobserve(chart);
                    }
                });
            }, { threshold: 0.1 });
            
            charts.forEach(chart => observer.observe(chart));
        }
    }

    /**
     * 🔊 EVENT LISTENERS
     */
    setupEventListeners() {
        // Resize otimizado com debounce
        let resizeTimeout;
        window.addEventListener('resize', () => {
            clearTimeout(resizeTimeout);
            resizeTimeout = setTimeout(() => {
                this.handleResize();
            }, 150);
        });
        
        // Orientação
        window.addEventListener('orientationchange', () => {
            setTimeout(() => this.handleOrientationChange(), 100);
        });
        
        // Visibility change para pausar animações quando não visível
        document.addEventListener('visibilitychange', () => {
            if (document.hidden) {
                document.body.classList.add('paused');
            } else {
                document.body.classList.remove('paused');
            }
        });
    }

    /**
     * 📏 MANIPULAR REDIMENSIONAMENTO
     */
    handleResize() {
        const oldBreakpoint = this.state.currentBreakpoint;
        const oldDeviceType = this.state.deviceType;
        
        this.detectDevice();
        
        // Notificar observers de resize
        this.observers.resize.forEach(callback => callback(this.state));
        
        // Notificar mudança de breakpoint
        if (oldBreakpoint !== this.state.currentBreakpoint) {
            this.observers.breakpoint.forEach(callback => callback(this.state.currentBreakpoint, oldBreakpoint));
            console.log(`📏 Breakpoint mudou: ${oldBreakpoint} → ${this.state.currentBreakpoint}`);
        }
        
        // Reaplica otimizações se tipo de dispositivo mudou
        if (oldDeviceType !== this.state.deviceType) {
            this.applyInitialOptimizations();
        }
    }

    /**
     * 🔄 MANIPULAR MUDANÇA DE ORIENTAÇÃO
     */
    handleOrientationChange() {
        const oldOrientation = this.state.orientation;
        this.detectDevice();
        
        if (oldOrientation !== this.state.orientation) {
            this.observers.orientation.forEach(callback => callback(this.state.orientation, oldOrientation));
            console.log(`🔄 Orientação mudou: ${oldOrientation} → ${this.state.orientation}`);
        }
    }

    /**
     * 🔔 SISTEMA DE OBSERVERS
     */
    onResize(callback) {
        this.observers.resize.add(callback);
    }

    onOrientationChange(callback) {
        this.observers.orientation.add(callback);
    }

    onBreakpointChange(callback) {
        this.observers.breakpoint.add(callback);
    }

    // Remover observers
    offResize(callback) {
        this.observers.resize.delete(callback);
    }

    offOrientationChange(callback) {
        this.observers.orientation.delete(callback);
    }

    offBreakpointChange(callback) {
        this.observers.breakpoint.delete(callback);
    }

    /**
     * 📊 INFORMAÇÕES DO SISTEMA
     */
    getState() {
        return { ...this.state };
    }

    getDeviceInfo() {
        return {
            type: this.state.deviceType,
            breakpoint: this.state.currentBreakpoint,
            orientation: this.state.orientation,
            isTouch: this.state.isTouch,
            performance: this.state.performanceLevel,
            viewport: {
                width: this.state.viewportWidth,
                height: this.state.viewportHeight
            }
        };
    }

    /**
     * 🧪 UTILITÁRIOS
     */
    isMobile() {
        return this.state.deviceType === 'mobile';
    }

    isTablet() {
        return this.state.deviceType === 'tablet';
    }

    isDesktop() {
        return this.state.deviceType === 'desktop';
    }

    isTouch() {
        return this.state.isTouch;
    }

    isSlowDevice() {
        return this.state.performanceLevel === 'slow';
    }

    matchBreakpoint(breakpoint) {
        const currentBpIndex = Object.keys(this.config.breakpoints).indexOf(this.state.currentBreakpoint);
        const targetBpIndex = Object.keys(this.config.breakpoints).indexOf(breakpoint);
        
        return currentBpIndex >= targetBpIndex;
    }
}

// 🌐 INSTÂNCIA GLOBAL
window.responsiveManager = new ResponsiveManager();

// 📤 FUNÇÕES DE CONVENIÊNCIA
window.isMobile = () => window.responsiveManager.isMobile();
window.isTablet = () => window.responsiveManager.isTablet();
window.isDesktop = () => window.responsiveManager.isDesktop();
window.isTouch = () => window.responsiveManager.isTouch();

console.log('📱 Responsive Manager carregado com sucesso!');
