// Verificar se a classe já foi definida para evitar redefinição
// Menu Component v2.3 - Correção navegação submenus - 2025-01-08 15:45
// Force cache break: 20250108154500
// CORREÇÃO: Força navegação manual dos links dos submenus para evitar preventDefault fantasma
(function setupSiswebPWA() {
    if (typeof window === 'undefined' || window.__siswebPWAInitialized) return;
    window.__siswebPWAInitialized = true;

    const PWA_VERSION = '2026-06-11-profile-admin-v1';
    const state = {
        deferredPrompt: null,
        floatingButton: null,
        updateChecksBound: false
    };

    function resolveRootAsset(path) {
        const normalized = String(path || '').replace(/^\/+/, '');
        if (window.location.protocol === 'http:' || window.location.protocol === 'https:') {
            return `/${normalized}`;
        }
        const isInSubfolder = (window.location.pathname || '').includes('/folha_pagamento/');
        return isInSubfolder ? `../${normalized}` : normalized;
    }

    function isStandalone() {
        return (window.matchMedia && window.matchMedia('(display-mode: standalone)').matches)
            || window.navigator.standalone === true;
    }

    function ensureManifest() {
        try {
            if (!document.querySelector('link[rel="manifest"]')) {
                const link = document.createElement('link');
                link.rel = 'manifest';
                link.href = resolveRootAsset('manifest.json');
                document.head.appendChild(link);
            }

            if (!document.querySelector('meta[name="theme-color"]')) {
                const meta = document.createElement('meta');
                meta.name = 'theme-color';
                meta.content = '#0f172a';
                document.head.appendChild(meta);
            }

            if (!document.querySelector('link[rel="icon"][sizes="192x192"]')) {
                const icon = document.createElement('link');
                icon.rel = 'icon';
                icon.type = 'image/png';
                icon.sizes = '192x192';
                icon.href = resolveRootAsset('assets/icons/icon-192x192.png');
                document.head.appendChild(icon);
            }

            if (!document.querySelector('link[rel="apple-touch-icon"]')) {
                const appleIcon = document.createElement('link');
                appleIcon.rel = 'apple-touch-icon';
                appleIcon.sizes = '180x180';
                appleIcon.href = resolveRootAsset('assets/icons/apple-touch-icon.png');
                document.head.appendChild(appleIcon);
            }
        } catch (error) {
            console.warn('[PWA] Falha ao configurar manifest:', error);
        }
    }

    function createFloatingButton() {
        if (state.floatingButton) return state.floatingButton;
        if (!document.body) return null;

        const button = document.createElement('button');
        button.id = 'sisweb-pwa-install-btn';
        button.type = 'button';
        button.setAttribute('aria-label', 'Instalar Sisweb');
        button.innerHTML = '<i class="fas fa-download" aria-hidden="true"></i><span>Instalar Sisweb</span>';
        button.style.cssText = [
            'position:fixed',
            'right:18px',
            'bottom:18px',
            'z-index:99998',
            'display:none',
            'align-items:center',
            'gap:8px',
            'border:0',
            'border-radius:8px',
            'background:#2c3e50',
            'color:#fff',
            'padding:11px 14px',
            'font:600 14px/1.2 Arial,sans-serif',
            'box-shadow:0 10px 24px rgba(0,0,0,.22)',
            'cursor:pointer'
        ].join(';');
        button.addEventListener('click', promptInstall);
        document.body.appendChild(button);
        state.floatingButton = button;
        return button;
    }

    function setInstallVisibility(visible) {
        const shouldShow = Boolean(visible && state.deferredPrompt && !isStandalone());
        const button = shouldShow ? createFloatingButton() : state.floatingButton;

        if (button) {
            button.style.display = shouldShow ? 'inline-flex' : 'none';
        }

        document.querySelectorAll('.pwa-install-link').forEach((link) => {
            link.style.display = shouldShow ? 'block' : 'none';
        });
    }

    function showInstallOption() {
        if (!document.body) {
            window.addEventListener('DOMContentLoaded', showInstallOption, { once: true });
            return;
        }
        setInstallVisibility(true);
    }

    async function promptInstall(event) {
        if (event && typeof event.preventDefault === 'function') {
            event.preventDefault();
        }

        if (!state.deferredPrompt) {
            if (window.__toast) {
                window.__toast('A instalação ainda não está disponível neste navegador.', 'info');
            }
            return;
        }

        const promptEvent = state.deferredPrompt;
        state.deferredPrompt = null;
        setInstallVisibility(false);
        promptEvent.prompt();

        try {
            await promptEvent.userChoice;
        } catch (error) {
            console.warn('[PWA] Falha ao concluir prompt de instalação:', error);
        }
    }

    function bindInstallLinks(root) {
        const container = root || document;
        container.querySelectorAll('.pwa-install-link').forEach((link) => {
            if (link.__siswebPwaBound) return;
            link.__siswebPwaBound = true;
            link.addEventListener('click', promptInstall);
        });
        setInstallVisibility(true);
    }

    function bindControllerReload(shouldReloadOnChange) {
        if (!shouldReloadOnChange || !navigator.serviceWorker || navigator.serviceWorker.__siswebReloadBound) {
            return;
        }

        navigator.serviceWorker.__siswebReloadBound = true;
        navigator.serviceWorker.addEventListener('controllerchange', () => {
            try {
                sessionStorage.setItem('siswebPwaUpdateReady', PWA_VERSION);
            } catch (_) {}
            try {
                if (typeof window.__toast === 'function') {
                    window.__toast('Atualização Sisweb pronta. Ao abrir a próxima tela, o app já usará a versão nova.', 'info');
                }
            } catch (_) {}
        });
    }

    function bindWorkerMessages() {
        if (!navigator.serviceWorker || navigator.serviceWorker.__siswebMessageBound) {
            return;
        }
        navigator.serviceWorker.__siswebMessageBound = true;
        navigator.serviceWorker.addEventListener('message', (event) => {
            const data = event && event.data ? event.data : null;
            if (!data || data.type !== 'SISWEB_PWA_UPDATED' || !data.version) return;
            if (String(data.version) === PWA_VERSION) return;
            try {
                sessionStorage.setItem('siswebPwaUpdateReady', String(data.version));
            } catch (_) {}
            try {
                if (typeof window.__toast === 'function') {
                    window.__toast('Atualização Sisweb pronta. Continue navegando normalmente.', 'info');
                }
            } catch (_) {}
        });
    }

    function setupUpdateChecks(registration) {
        if (!registration || state.updateChecksBound) return;
        state.updateChecksBound = true;
        let lastUpdateCheckAt = 0;

        const checkForUpdate = (force = false) => {
            try {
                const now = Date.now();
                if (!force && (now - lastUpdateCheckAt) < 10000) return;
                lastUpdateCheckAt = now;
                if (registration.waiting && navigator.serviceWorker.controller) {
                    registration.waiting.postMessage({ type: 'SKIP_WAITING' });
                }
                const update = registration.update();
                if (update && typeof update.catch === 'function') {
                    update.catch((error) => console.warn('[PWA] Falha ao verificar atualização:', error));
                }
            } catch (error) {
                console.warn('[PWA] Falha ao verificar atualização:', error);
            }
        };

        window.addEventListener('focus', checkForUpdate);
        window.addEventListener('online', () => checkForUpdate(true));
        window.addEventListener('pageshow', () => checkForUpdate(true));
        document.addEventListener('visibilitychange', () => {
            if (!document.hidden) checkForUpdate(true);
        });
        window.setInterval(checkForUpdate, 30 * 60 * 1000);
        window.setTimeout(() => checkForUpdate(true), 1500);
        window.setTimeout(() => checkForUpdate(true), 8000);
        window.SiswebPWACheckForUpdate = () => checkForUpdate(true);
    }

    async function registerServiceWorker() {
        if (!('serviceWorker' in navigator)) return;
        if (window.location.protocol !== 'http:' && window.location.protocol !== 'https:') return;

        const hadController = Boolean(navigator.serviceWorker.controller);
        bindControllerReload(hadController);
        bindWorkerMessages();

        try {
            const registration = await navigator.serviceWorker.register(resolveRootAsset('sw.js'), { scope: '/' });

            if (registration.waiting && hadController) {
                registration.waiting.postMessage({ type: 'SKIP_WAITING' });
            }

            registration.addEventListener('updatefound', () => {
                const newWorker = registration.installing;
                if (!newWorker) return;
                newWorker.addEventListener('statechange', () => {
                    if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
                        newWorker.postMessage({ type: 'SKIP_WAITING' });
                    }
                });
            });

            setupUpdateChecks(registration);
            const update = registration.update();
            if (update && typeof update.catch === 'function') {
                update.catch((error) => console.warn('[PWA] Falha ao verificar atualização:', error));
            }
        } catch (error) {
            console.warn('[PWA] Falha ao registrar service worker:', error);
        }
    }

    ensureManifest();

    window.addEventListener('beforeinstallprompt', (event) => {
        event.preventDefault();
        state.deferredPrompt = event;
        showInstallOption();
    });

    window.addEventListener('appinstalled', () => {
        state.deferredPrompt = null;
        setInstallVisibility(false);
        if (window.__toast) {
            window.__toast('Sisweb instalado com sucesso.', 'success');
        }
    });

    if (document.readyState === 'complete') {
        registerServiceWorker();
    } else {
        window.addEventListener('load', registerServiceWorker, { once: true });
    }

    window.SiswebPWA = {
        version: PWA_VERSION,
        bindInstallLinks,
        promptInstall,
        refreshInstallVisibility: () => setInstallVisibility(true),
        checkForUpdate: () => (typeof window.SiswebPWACheckForUpdate === 'function' ? window.SiswebPWACheckForUpdate() : null)
    };
})();

if (window.customElements && !window.customElements.get('main-menu')) {
    async function performSafeLogout(reason) {
        if (window.__logoutInProgress) return;
        window.__logoutInProgress = true;
        const isInSubfolder = (location.pathname || '').includes('/folha_pagamento/');
        const loginUrl = isInSubfolder ? '../login.html' : 'login.html';
        const currentPath = window.location.pathname + (window.location.search || '') + (window.location.hash || '');
        try {
            if (window.FolhaUtils && window.FolhaUtils.showToast) {
                window.FolhaUtils.showToast('Saindo…', 'info', 2000);
            }
            const authService = window.firebaseService && window.firebaseService.authService ? window.firebaseService.authService : null;
            const signOutFn = authService && typeof authService.signOut === 'function' ? authService.signOut : null;
            const logoutFn = authService && typeof authService.logout === 'function' ? authService.logout : null;
            if (signOutFn) {
                await signOutFn();
            } else if (logoutFn && logoutFn !== window.logout) {
                await logoutFn();
            } else if (typeof window.firebaseSignOut === 'function' && window.firebaseSignOut !== window.logout) {
                await window.firebaseSignOut();
            }
        } catch (err) {
            console.error('Erro no logout:', err);
        } finally {
            try {
                localStorage.removeItem('currentUser');
                localStorage.removeItem('persistentUser');
                localStorage.removeItem('auth');
                if (typeof window.clearSiswebDurableAuthSession === 'function') {
                    window.clearSiswebDurableAuthSession();
                } else {
                    localStorage.removeItem('siswebAuthSession');
                }
                if (typeof window.clearSiswebCompanyContextCache === 'function') {
                    window.clearSiswebCompanyContextCache();
                } else {
                    localStorage.removeItem('company_info');
                    window.companyInfo = null;
                    window.appTenantId = null;
                }
                sessionStorage.clear();
            } catch {}
            const isLoginPage = /(^|\/)login\.html$/i.test(window.location.pathname || '');
            if (!isLoginPage) {
                window.location.replace(`${loginUrl}?logout=1&reason=${encodeURIComponent(reason || 'logout_menu')}&redirect=${encodeURIComponent(currentPath)}`);
            }
            window.__logoutInProgress = false;
        }
    }

    class MenuComponent extends HTMLElement {
        constructor() {
            super();
        }

        getHomeUrl() {
            // Detectar se estamos em produção (Firebase Hosting) ou desenvolvimento
            const hostname = window.location.hostname;
            const isProduction = hostname.includes('sisweb-7ce82.web.app') || hostname.includes('sisweb-7ce82.firebaseapp.com');
            
            if (isProduction) {
                // Em produção, sempre usar URL absoluta para a raiz
                return 'https://sisweb-7ce82.web.app/index.html';
            } else {
                // Em desenvolvimento, verificar se estamos em subfolder
                const currentPath = window.location.pathname;
                const isInSubfolder = currentPath.includes('/folha_pagamento/');
                
                if (isInSubfolder) {
                    return '../index.html';  // Voltar para a raiz
                } else {
                    return 'index.html';     // Já estamos na raiz
                }
            }
        }

        resolveUrl(relativePath) {
            // Para folha de pagamento, ajustar caminhos relativos
            const currentPath = window.location.pathname;
            const isInSubfolder = currentPath.includes('/folha_pagamento/');
            
            if (isInSubfolder && !relativePath.startsWith('http') && !relativePath.startsWith('../')) {
                return '../' + relativePath;
            }
            
            return relativePath;
        }

        getFirstName() {
            try {
                const payload = this.getCurrentSessionProfile();
                const baseName = String(
                    payload.displayName
                    || payload.name
                    || payload.username
                    || payload.email
                    || ''
                ).trim();
                if (!baseName) return 'Usuário';
                const pure = baseName.includes('@') ? baseName.split('@')[0] : baseName;
                const first = String(pure).split(' ').filter(Boolean)[0] || 'Usuário';
                return first.charAt(0).toUpperCase() + first.slice(1);
            } catch (_) {
                return 'Usuário';
            }
        }

        getCurrentSessionProfile() {
            try {
                const currentUser = JSON.parse(localStorage.getItem('currentUser') || 'null') || {};
                const persistentUser = JSON.parse(localStorage.getItem('persistentUser') || 'null') || {};
                const authUser = (typeof window !== 'undefined' && window.firebaseAuthUser) ? window.firebaseAuthUser : {};
                const usersRaw = JSON.parse(localStorage.getItem('users') || '[]');
                const users = Array.isArray(usersRaw) ? usersRaw : (usersRaw && typeof usersRaw === 'object' ? Object.values(usersRaw) : []);
                const uid = String(currentUser.uid || currentUser.id || currentUser.userId || persistentUser.uid || persistentUser.id || persistentUser.userId || authUser.uid || '').trim();
                const email = String(currentUser.email || persistentUser.email || authUser.email || '').toLowerCase().trim();
                const details = users.find((u) => {
                    const uUid = String((u && (u.uid || u.id || u.userId)) || '').trim();
                    const uEmail = String((u && u.email) || '').toLowerCase().trim();
                    return (uid && uUid && uid === uUid) || (email && uEmail && email === uEmail);
                }) || {};
                const live = this.__liveProfile && typeof this.__liveProfile === 'object' ? this.__liveProfile : {};
                return { ...details, ...currentUser, ...persistentUser, ...authUser, ...live, uid: uid || live.uid || '', email: email || details.email || live.email || '' };
            } catch (_) {
                return {};
            }
        }

        async hydrateCurrentSessionProfile() {
            try {
                const base = this.getCurrentSessionProfile();
                let merged = { ...base };
                if (typeof window.getCurrentUserDetails === 'function') {
                    try {
                        const details = await window.getCurrentUserDetails();
                        if (details && typeof details === 'object') {
                            merged = { ...merged, ...details };
                        }
                    } catch (_) {}
                }
                const uid = String(merged.uid || merged.id || merged.userId || '').trim();
                if (uid && (!merged.displayName && !merged.username || !merged.subscription)) {
                    try {
                        if (window.firebaseService && typeof window.firebaseService.loadFromFirebase === 'function') {
                            const profileRes = await window.firebaseService.loadFromFirebase(`users/${uid}`);
                            const profile = profileRes && profileRes.success ? profileRes.data : profileRes;
                            if (profile && typeof profile === 'object') {
                                merged = { ...merged, ...profile };
                            }
                        } else if (window.firebaseService && typeof window.firebaseService.loadData === 'function') {
                            const profileRes = await window.firebaseService.loadData(`users/${uid}`);
                            const profile = profileRes && profileRes.success ? profileRes.data : profileRes;
                            if (profile && typeof profile === 'object') {
                                merged = { ...merged, ...profile };
                            }
                        }
                    } catch (_) {}
                }
                this.__liveProfile = { ...merged };
                try {
                    const current = JSON.parse(localStorage.getItem('currentUser') || 'null') || {};
                    localStorage.setItem('currentUser', JSON.stringify({ ...current, ...merged }));
                } catch (_) {}
                return merged;
            } catch (_) {
                return this.getCurrentSessionProfile();
            }
        }

        getSubscriptionDaysLabel(payload, statusKey) {
            try {
                const user = payload && typeof payload === 'object' ? payload : {};
                const key = String(statusKey || '').toLowerCase();
                if (key === 'trial_active') {
                    const start = user.trialStart ? new Date(user.trialStart) : null;
                    if (!start || Number.isNaN(start.getTime())) return 'dias indisp.';
                    const settings = JSON.parse(localStorage.getItem('subscriptionSettingsCache') || 'null') || {};
                    const trialDays = parseInt(settings.freeTrialDays, 10) || 30;
                    const elapsed = Math.ceil((Date.now() - start.getTime()) / (1000 * 60 * 60 * 24));
                    const left = Math.max(0, trialDays - elapsed);
                    return `${left} dia(s)`;
                }
                const endDateRaw = user.subscription && user.subscription.endDate ? user.subscription.endDate : '';
                const endDate = endDateRaw ? new Date(endDateRaw) : null;
                if (!endDate || Number.isNaN(endDate.getTime())) {
                    if (key === 'active') return 'sem prazo';
                    return 'dias indisp.';
                }
                const diff = Math.ceil((endDate.getTime() - Date.now()) / (1000 * 60 * 60 * 24));
                if (diff < 0) return 'expirado';
                return `${diff} dia(s)`;
            } catch (_) {
                return 'dias indisp.';
            }
        }

        getSubscriptionBadgeText() {
            try {
                const payload = this.getCurrentSessionProfile();
                const planType = String(
                    (payload.subscription && (payload.subscription.planKey || payload.subscription.key || payload.subscription.type))
                    || (payload.pendingPayment && (payload.pendingPayment.planKey || payload.pendingPayment.plan))
                    || payload.plan
                    || payload.planType
                    || payload.subscriptionType
                    || ''
                ).toLowerCase();
                if (planType === 'free_trial' || planType === 'trial' || planType === 'trial_active' || planType === 'teste_ativo') return 'Free Trial';
                if (planType === 'monthly' || planType === 'mensal') return 'Mensal';
                if (planType === 'quarterly' || planType === 'trimestral' || planType === 'annual' || planType === 'anual') return 'Trimestral';
                if (planType === 'premium') return 'Premium';
                const statusKey = window.resolveSubscriptionStatus && typeof window.resolveSubscriptionStatus === 'function'
                    ? String(window.resolveSubscriptionStatus(payload) || '')
                    : String(payload.subscriptionStatus || payload.status || '');
                const lower = statusKey.toLowerCase();
                if (lower === 'active') return 'Premium';
                if (lower === 'trial_active' || lower === 'trial' || lower === 'teste_ativo') return 'Free Trial';
                if (lower === 'pending' || lower === 'pending_grace' || lower === 'pendente') return 'Pendente';
                if (lower === 'blocked' || lower === 'bloqueado') return 'Bloqueado';
                if (lower === 'expired' || lower === 'expirado') return 'Expirado';
                return 'Assinatura';
            } catch (_) {
                return 'Assinatura';
            }
        }

        getSubscriptionSummaryText() {
            try {
                const payload = this.getCurrentSessionProfile();
                const statusKey = window.resolveSubscriptionStatus && typeof window.resolveSubscriptionStatus === 'function'
                    ? String(window.resolveSubscriptionStatus(payload) || '')
                    : String(payload.subscriptionStatus || payload.status || '');
                const plan = this.getSubscriptionBadgeText();
                const days = this.getSubscriptionDaysLabel(payload, statusKey);
                return `${plan} • ${days}`;
            } catch (_) {
                return `${this.getSubscriptionBadgeText()} • dias indisp.`;
            }
        }

        getSubscriptionVisualState() {
            try {
                const payload = this.getCurrentSessionProfile();
                const statusKey = window.resolveSubscriptionStatus && typeof window.resolveSubscriptionStatus === 'function'
                    ? String(window.resolveSubscriptionStatus(payload) || '')
                    : String(payload.subscriptionStatus || payload.status || '');
                const summary = this.getSubscriptionSummaryText();
                const lowerStatus = String(statusKey || '').toLowerCase();
                const lowerSummary = String(summary || '').toLowerCase();
                if (lowerStatus === 'blocked' || lowerStatus === 'expired' || lowerSummary.includes('expirado')) {
                    return { summary, tone: 'red' };
                }
                if (lowerStatus === 'pending' || lowerStatus === 'pending_grace' || lowerSummary.includes('pendente')) {
                    return { summary, tone: 'yellow' };
                }
                if (lowerSummary.includes('sem prazo')) {
                    return { summary, tone: 'green' };
                }
                const dayMatch = String(summary).match(/(\d+)\s*dia/);
                const days = dayMatch ? parseInt(dayMatch[1], 10) : NaN;
                if (Number.isFinite(days)) {
                    if (days <= 5) return { summary, tone: 'red' };
                    if (days <= 15) return { summary, tone: 'yellow' };
                    return { summary, tone: 'green' };
                }
                if (lowerStatus === 'active' || lowerStatus === 'trial_active') return { summary, tone: 'green' };
                return { summary, tone: 'yellow' };
            } catch (_) {
                return { summary: this.getSubscriptionSummaryText(), tone: 'yellow' };
            }
        }

        escapeHtml(value) {
            return String(value || '')
                .replace(/&/g, '&amp;')
                .replace(/</g, '&lt;')
                .replace(/>/g, '&gt;')
                .replace(/"/g, '&quot;')
                .replace(/'/g, '&#39;');
        }

        getDisplayEmail() {
            try {
                const payload = this.getCurrentSessionProfile();
                const email = String(payload.email || '').trim();
                return email || 'Conta Sisweb';
            } catch (_) {
                return 'Conta Sisweb';
            }
        }

        buildSettingsGreetingHtml() {
            const greetingName = this.escapeHtml(this.getFirstName());
            const email = this.escapeHtml(this.getDisplayEmail());
            const visual = this.getSubscriptionVisualState();
            const tone = String(visual && visual.tone ? visual.tone : 'yellow');
            const summary = this.escapeHtml(visual && visual.summary ? visual.summary : this.getSubscriptionSummaryText());
            const initial = this.escapeHtml(String(greetingName || 'U').charAt(0).toUpperCase() || 'U');
            return `
                <div class="settings-profile-card">
                    <div class="settings-profile-main">
                        <span class="settings-avatar">${initial}</span>
                        <div class="settings-profile-copy">
                            <strong class="greeting-name">Olá ${greetingName}</strong>
                            <span class="greeting-email">${email}</span>
                        </div>
                    </div>
                    <span class="subscription-inline subscription-pill-${tone}">
                        <span class="subscription-indicator subscription-${tone}"></span>${summary}
                    </span>
                </div>
            `;
        }

        async refreshSettingsUserInfo() {
            try {
                await this.hydrateCurrentSessionProfile();
            } catch (_) {}
            try {
                const node = this.querySelector('.settings-dropdown .settings-profile-card-slot');
                if (!node) return;
                node.innerHTML = this.buildSettingsGreetingHtml();
            } catch (_) {}
        }

        connectedCallback() {
            try {
                if (!window.__toast) {
                    var containerId='__toast_container__',lastMsg='',lastAt=0,MAX_TOASTS=4;
                    function ensure(){var c=document.getElementById(containerId);if(!c){c=document.createElement('div');c.id=containerId;c.style.cssText='position:fixed;top:16px;right:16px;z-index:99999;display:flex;flex-direction:column;gap:8px;pointer-events:none;';document.body.appendChild(c);}return c;}
                    function color(t){if(t==='error')return'#c0392b';if(t==='success')return'#27ae60';if(t==='warning')return'#f39c12';return'#2c3e50';}
                    window.__toast=function(message,type,opts){try{var now=Date.now(),s=String(message||'');if(s===lastMsg&&now-lastAt<500)return;lastMsg=s;lastAt=now;var c=ensure();while(c.children.length>=MAX_TOASTS){try{c.removeChild(c.firstElementChild);}catch(e){break;}}var t=document.createElement('div');t.setAttribute('role','status');t.style.cssText='background:'+color(type)+';color:#fff;padding:10px 14px;border-radius:8px;box-shadow:0 4px 12px rgba(0,0,0,0.25);font:14px/1.4 system-ui;max-width:420px;display:flex;align-items:center;gap:10px;pointer-events:auto;';var txt=document.createElement('div');txt.textContent=s;txt.title=s;txt.style.cssText='flex:1;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;';var close=document.createElement('button');close.textContent='×';close.style.cssText='background:transparent;border:0;color:#fff;font-size:16px;line-height:1;cursor:pointer;';close.onclick=function(){try{c.removeChild(t);}catch(e){}};t.appendChild(txt);t.appendChild(close);c.appendChild(t);var dDefault=(type==='error'?0:(type==='warning'?4000:3000));var d=(opts&&typeof opts.duration==='number')?opts.duration:dDefault;if(d>0){setTimeout(function(){try{c.removeChild(t);}catch(e){}},d);}}catch(e){}};
                }
                var originalAlert = window.alert;
                window.alert = function(msg){var m=String(msg||'');var lower=m.toLowerCase();var type=(lower.includes('erro')||lower.includes('error')||lower.includes('❌'))?'error':(lower.includes('sucesso')||lower.includes('✅'))?'success':'info';window.__toast(m,type,{duration:type==='error'?0:3000});};
                if (window.Utils && typeof window.Utils.showToast === 'function') {
                    window.Utils.showToast = function(message,type){window.__toast(message,type);}
                }
            } catch(_) {}
            // Verificar se o usuário atual é admin
            const adminContext = this.getAdminContext();
            const isAdmin = adminContext.isAdmin;
            const showBusinessModules = !isAdmin;
            const homeUrl = isAdmin ? this.resolveUrl('admin.html?tab=dashboard') : this.getHomeUrl();
            const greetingHtml = this.buildSettingsGreetingHtml();
            
            this.innerHTML = `
                <style>
                    /* Estilos inline para garantir consistência */
                    .sisweb-menu-shell {
                        display: flex;
                        align-items: center;
                        gap: 8px;
                        background-color: #2c3e50;
                        border-radius: 8px;
                        margin-bottom: 20px;
                        padding: 10px;
                    }
                    .sisweb-menu-shell .menu {
                        flex: 1 1 auto;
                        min-width: 0;
                        background: transparent;
                        border-radius: 0;
                        margin-bottom: 0;
                        padding: 0;
                    }
                    .sisweb-menu-shell .menu-item {
                        color: #ffffff;
                        text-decoration: none;
                        font-weight: 700;
                        padding: 10px 15px;
                        white-space: nowrap;
                        display: inline-flex;
                        align-items: center;
                        gap: 6px;
                        min-height: 40px;
                        border-radius: 6px;
                        box-sizing: border-box;
                        line-height: 1.2;
                    }
                    .sisweb-menu-shell .menu-item:hover,
                    .sisweb-menu-shell .menu-item:focus-visible {
                        background: rgba(255,255,255,0.08);
                        color: #ffffff;
                        text-decoration: none;
                        outline: none;
                    }
                    .sisweb-menu-shell .menu-item i {
                        margin-right: 5px;
                        flex: 0 0 auto;
                    }
                    .menu-quick-actions {
                        display: flex;
                        align-items: center;
                        justify-content: flex-end;
                        gap: 6px;
                        margin-left: auto;
                    }
                    .menu-quick-actions .alerts-dropdown,
                    .menu-quick-actions .settings-dropdown {
                        margin-left: 0;
                    }
                    .menu-quick-actions .menu-item-trigger {
                        width: 40px;
                        height: 40px;
                        display: inline-flex !important;
                        align-items: center;
                        justify-content: center;
                        padding: 0;
                    }
                    .menu-quick-actions .menu-label-mobile {
                        display: none !important;
                    }
                    .menu-item-container {
                        position: relative;
                        display: inline-block;
                    }
                    
                    .sisweb-menu-shell .dropdown-content {
                        display: none;
                        position: absolute;
                        top: 100%;
                        left: 0;
                        background-color: #f9f9f9;
                        min-width: 200px;
                        width: max-content;
                        max-width: 300px;
                        box-shadow: 0px 8px 16px 0px rgba(0,0,0,0.2);
                        z-index: 5000;
                        border-radius: 4px;
                        margin-top: 5px;
                    }
                    .sisweb-menu-shell .dropdown-content.show-dropdown {
                        display: block !important;
                    }

                    .alerts-dropdown { position: relative; }
                    .menu-item-trigger {
                        color: #fff;
                        border-radius: 4px;
                        min-height: 40px;
                        box-sizing: border-box;
                    }
                    .menu-item-trigger:hover,
                    .menu-item-trigger:focus-visible {
                        background: rgba(255,255,255,0.08);
                        outline: none;
                    }
                    .mobile-menu-link,
                    .mobile-logout-link {
                        display: none;
                    }
                    .alerts-panel {
                        right: 0;
                        left: auto;
                        width: min(420px, calc(100vw - 24px));
                        max-width: 420px;
                    }
                    .alerts-list {
                        max-height: 280px;
                        overflow-y: auto;
                        overflow-x: hidden;
                    }
                    .alerts-item {
                        display: block;
                        padding: 8px 12px;
                        border-bottom: 1px solid #e5e7eb;
                    }
                    .alerts-item.unread {
                        background: #f8fafc;
                    }
                    .alerts-item.sev-error { border-left: 4px solid #dc2626; background: #fef2f2; }
                    .alerts-item.sev-warning { border-left: 4px solid #f59e0b; background: #fffbeb; }
                    .alerts-item.sev-info { border-left: 4px solid #2563eb; background: #eff6ff; }
                    .alerts-item.sev-success { border-left: 4px solid #16a34a; background: #f0fdf4; }
                    .alerts-item:last-child { border-bottom: 0; }
                    .alerts-item-title {
                        display: block;
                        font-size: 12px;
                        color: #0f172a;
                        margin-bottom: 4px;
                        line-height: 1.35;
                        white-space: normal;
                        word-break: break-word;
                    }
                    .alerts-item-message {
                        display: block;
                        font-size: 12px;
                        color: #475569;
                        line-height: 1.4;
                        white-space: normal;
                        word-break: break-word;
                        overflow-wrap: anywhere;
                    }
                    a.alerts-item-message { color: #2563eb; text-decoration: none; }
                    a.alerts-item-message:hover { text-decoration: underline; }

                    .alerts-actions .btn {
                        border: 1px solid #cbd5e1;
                        background: #ffffff;
                        border-radius: 8px;
                        padding: 4px 8px;
                        cursor: pointer;
                        color: #1e293b;
                        font-weight: 600;
                        font-size: 12px;
                        display: inline-flex;
                        align-items: center;
                        gap: 6px;
                    }
                    .alerts-actions .btn:hover { background: #f1f5f9; }

                    .alerts-empty {
                        padding: 14px 12px;
                        color: #64748b;
                        font-size: 12px;
                    }
                    
                    .sisweb-menu-shell .dropdown-content a {
                        color: #2c3e50;
                        padding: 12px 16px;
                        text-decoration: none;
                        display: block;
                        font-weight: normal;
                        white-space: nowrap;
                        overflow: hidden;
                        text-overflow: ellipsis;
                    }
                    
                    .sisweb-menu-shell .dropdown-content a:hover,
                    .sisweb-menu-shell .dropdown-content a:focus-visible {
                        background-color: #f1f1f1;
                        text-decoration: none;
                        outline: none;
                    }
                    
                    .show-dropdown {
                        display: block !important;
                    }
                    
                    .admin-section {
                        border-top: 1px solid #eee;
                        padding-top: 5px;
                        margin-top: 5px;
                    }
                    
                    .admin-link {
                        background-color: #fef5f5;
                    }
                    
                    .admin-link i {
                        color: #e74c3c;
                    }
                    .settings-dropdown .settings-panel {
                        right: 0;
                        left: auto;
                        min-width: 320px;
                        width: min(360px, calc(100vw - 24px));
                        max-width: min(360px, calc(100vw - 24px));
                        padding: 10px;
                        background: #ffffff;
                        border: 1px solid #dbe3ef;
                        border-radius: 14px;
                        box-shadow: 0 18px 42px rgba(15, 23, 42, 0.18);
                        overflow: hidden;
                    }
                    .settings-profile-card-slot {
                        padding: 0;
                        margin: 0 0 8px;
                        border: 0;
                        color: #102033;
                    }
                    .settings-profile-card {
                        display: grid;
                        gap: 10px;
                        padding: 12px;
                        border-radius: 12px;
                        background: linear-gradient(135deg, #f8fafc, #eef6ff);
                        border: 1px solid #dbeafe;
                    }
                    .settings-profile-main {
                        display: flex;
                        align-items: center;
                        gap: 10px;
                        min-width: 0;
                    }
                    .settings-avatar {
                        width: 40px;
                        height: 40px;
                        border-radius: 12px;
                        display: inline-flex;
                        align-items: center;
                        justify-content: center;
                        background: #1e3a8a;
                        color: #ffffff;
                        font-weight: 800;
                        flex: 0 0 auto;
                    }
                    .settings-profile-copy {
                        display: grid;
                        min-width: 0;
                    }
                    .settings-dropdown .user-info .greeting-name,
                    .settings-profile-copy .greeting-name {
                        color: #102033;
                        font-size: 0.96rem;
                        line-height: 1.2;
                        font-weight: 800;
                        overflow: hidden;
                        text-overflow: ellipsis;
                        white-space: nowrap;
                    }
                    .greeting-email {
                        color: #64748b;
                        font-size: 0.76rem;
                        line-height: 1.3;
                        overflow: hidden;
                        text-overflow: ellipsis;
                        white-space: nowrap;
                    }
                    .settings-section {
                        display: grid;
                        gap: 4px;
                        padding: 8px 0;
                        border-top: 1px solid #edf2f7;
                    }
                    .settings-section:first-of-type {
                        border-top: 0;
                    }
                    .settings-section-title {
                        color: #64748b;
                        font-size: 11px;
                        font-weight: 800;
                        letter-spacing: 0;
                        text-transform: uppercase;
                        padding: 2px 8px 4px;
                    }
                    .settings-dropdown .settings-action {
                        display: flex;
                        align-items: center;
                        gap: 10px;
                        min-height: 40px;
                        padding: 10px 11px;
                        border-radius: 10px;
                        color: #1e293b;
                        white-space: normal;
                    }
                    .settings-dropdown .settings-action i {
                        width: 18px;
                        text-align: center;
                        color: #2563eb;
                        flex: 0 0 auto;
                    }
                    .settings-dropdown .settings-action:hover,
                    .settings-dropdown .settings-action:focus-visible {
                        background: #f1f5f9;
                        text-decoration: none;
                        outline: none;
                    }
                    .settings-dropdown .admin-section {
                        border-top: 1px solid #fee2e2;
                        background: #fff7f7;
                        margin: 4px -2px 0;
                        padding: 9px 2px;
                        border-radius: 12px;
                    }
                    .settings-dropdown .admin-section .settings-section-title {
                        color: #991b1b;
                    }
                    .settings-dropdown .admin-link.settings-action i {
                        color: #dc2626;
                    }
                    .settings-exit {
                        padding-bottom: 0;
                    }
                    .settings-exit .logout-link {
                        color: #b91c1c;
                        font-weight: 800;
                    }
                    .settings-exit .logout-link i {
                        color: #dc2626;
                    }
                    .settings-dropdown .user-info span {
                        display: flex;
                        flex-wrap: wrap;
                        align-items: center;
                        column-gap: 6px;
                        row-gap: 2px;
                        white-space: normal;
                        overflow-wrap: anywhere;
                        line-height: 1.25;
                    }
                    .settings-dropdown .user-info .greeting-name {
                        font-size: 1rem;
                        font-weight: 600;
                    }
                    .settings-dropdown .user-info .greeting-meta {
                        display: inline-flex;
                        width: auto;
                        padding-left: 4px;
                    }
                    .subscription-inline {
                        display: inline-flex;
                        align-items: center;
                        gap: 4px;
                        font-size: 0.78rem;
                        line-height: 1.2;
                        max-width: 100%;
                        vertical-align: middle;
                        padding: 7px 9px;
                        border-radius: 999px;
                        background: #ffffff;
                        border: 1px solid #dbe3ef;
                        color: #1e293b;
                    }
                    .subscription-indicator {
                        width: 8px;
                        height: 8px;
                        border-radius: 50%;
                        display: inline-block;
                    }
                    .subscription-green {
                        background: #16a34a;
                    }
                    .subscription-yellow {
                        background: #f59e0b;
                    }
                    .subscription-red {
                        background: #dc2626;
                    }
                    @media (max-width: 520px) {
                        .settings-dropdown .user-info .greeting-meta {
                            padding-left: 4px;
                        }
                        .subscription-inline {
                            font-size: 0.74rem;
                            max-width: 185px;
                        }
                    }
                    @media (max-width: 1024px) {
                        .sisweb-menu-shell {
                            position: relative;
                            background: transparent;
                            border-radius: 0;
                            padding: 0;
                            margin-bottom: 10px;
                            justify-content: space-between;
                        }
                        .sisweb-menu-shell .menu {
                            background-color: #2c3e50;
                            padding: 60px 20px 20px;
                            border-radius: 0;
                            margin: 0;
                        }
                        .menu-quick-actions {
                            gap: 8px;
                            margin-left: 0;
                        }
                        .menu-quick-actions .alerts-dropdown,
                        .menu-quick-actions .settings-dropdown {
                            width: auto;
                            margin-top: 0;
                            position: relative;
                        }
                        .menu-quick-actions .alerts-dropdown .dropdown-content,
                        .menu-quick-actions .settings-dropdown .dropdown-content {
                            position: absolute;
                            top: calc(100% + 8px);
                            right: 0;
                            left: auto;
                            width: min(360px, calc(100vw - 20px));
                            max-width: min(360px, calc(100vw - 20px));
                            background: #ffffff;
                            color: #1f2937;
                            box-shadow: 0 16px 32px rgba(15, 23, 42, 0.22);
                            border: 1px solid #e5e7eb;
                        }
                        .menu-quick-actions .dropdown-content a {
                            color: #2c3e50;
                        }
                        .menu-quick-actions .menu-item-trigger {
                            width: 42px;
                            height: 42px;
                            padding: 0;
                            border: 1px solid rgba(44, 62, 80, 0.16);
                            border-radius: 10px;
                            background: #2c3e50;
                            box-shadow: 0 2px 8px rgba(15, 23, 42, 0.12);
                        }
                        .mobile-menu-link,
                        .mobile-logout-link {
                            display: flex;
                            align-items: center;
                            gap: 8px;
                            color: #fff !important;
                        }
                        .mobile-menu-link.mobile-support-link {
                            background: rgba(255,255,255,0.08);
                            border-left: 3px solid rgba(255,255,255,0.35);
                        }
                        .mobile-logout-link {
                            margin-top: 10px;
                        }
                    }
                </style>
                <div class="sisweb-menu-shell">
                    <button class="menu-toggle" id="menuToggleBtn" aria-label="Abrir menu"><i class="fas fa-bars"></i></button>
                    <div class="menu" id="mainMenuContainer">
                    <a href="${homeUrl}" class="menu-item"><i class="fas fa-home"></i> Home</a>
                    
                    ${showBusinessModules ? `
                    <!-- Vendas Dropdown -->
                    <div class="menu-item-container">
                        <a href="#" class="menu-item vendas-menu"><i class="fas fa-shopping-cart"></i> Vendas <i class="fas fa-caret-down"></i></a>
                        <div class="dropdown-content vendas-dropdown">
                            <a href="${this.resolveUrl('vendas.html')}"><i class="fas fa-shopping-cart"></i> Sistema de Vendas</a>
                            <a href="${this.resolveUrl('notas-fiscais.html')}"><i class="fas fa-receipt"></i> Notas Fiscais</a>
                            <a href="${this.resolveUrl('mdf-e.html')}"><i class="fas fa-truck"></i> Emissão de MDF-e</a>
                        </div>
                    </div>
                    
                    <!-- Estoque Dropdown -->
                    <div class="menu-item-container">
                        <a href="#" class="menu-item estoque-menu"><i class="fas fa-boxes"></i> Estoque <i class="fas fa-caret-down"></i></a>
                        <div class="dropdown-content estoque-dropdown">
                        <a href="${this.resolveUrl('compras.html')}"><i class="fas fa-shopping-bag"></i> Sistema de Compras</a>
                        <a href="${this.resolveUrl('estoque.html')}"><i class="fas fa-warehouse"></i> Controle de Estoque</a>
                        </div>
                    </div>
                    
                    <!-- Financeiro Dropdown -->
                    <div class="menu-item-container">
                        <a href="#" class="menu-item financeiro-menu"><i class="fas fa-dollar-sign"></i> Financeiro <i class="fas fa-caret-down"></i></a>
                        <div class="dropdown-content financeiro-dropdown">
                            <a href="${this.resolveUrl('financas.html')}"><i class="fas fa-chart-line"></i> Sistema Financeiro</a>
                            <a href="${this.resolveUrl('folha_pagamento/folha.html')}"><i class="fas fa-file-invoice-dollar"></i> Folha de Pagamento</a>
                        </div>
                    </div>
                    
                    <!-- Cadastros Dropdown -->
                    <div class="menu-item-container">
                        <a href="#" class="menu-item cadastros-menu"><i class="fas fa-database"></i> Cadastros <i class="fas fa-caret-down"></i></a>
                        <div class="dropdown-content cadastros-dropdown">
                            <a href="${this.resolveUrl('client.html')}"><i class="fas fa-user"></i> Cliente</a>
                            <a href="${this.resolveUrl('fornecedor.html')}"><i class="fas fa-truck"></i> Fornecedor</a>
                            <a href="${this.resolveUrl('species.html')}"><i class="fas fa-leaf"></i> Espécie</a>
                            <a href="${this.resolveUrl('importar_especies.html')}"><i class="fas fa-upload"></i> Importar Especies</a>
                        </div>
                    </div>
                    
                    <!-- Romaneios Dropdown -->
                    <div class="menu-item-container">
                        <a href="#" class="menu-item romaneios-menu"><i class="fas fa-file-alt"></i> Romaneios <i class="fas fa-caret-down"></i></a>
                        <div class="dropdown-content romaneios-dropdown">
                            <a href="${this.resolveUrl('preromaneio.html')}"><i class="fas fa-calculator"></i> Pré-Romaneio</a>
                            <a href="${this.resolveUrl('romaneiotl.html')}"><i class="fas fa-tree"></i> Romaneio TL</a>
                            <a href="${this.resolveUrl('romaneiopct.html')}"><i class="fas fa-percentage"></i> Romaneio PC</a>
                            <a href="${this.resolveUrl('romaneiopes.html')}"><i class="fas fa-ruler"></i> Romaneio Pés</a>
                            <a href="${this.resolveUrl('romaneiotora.html')}"><i class="fas fa-circle"></i> Romaneio Tora</a>
                            <a href="${this.resolveUrl('ajudabitolas.html')}"><i class="fas fa-question-circle"></i> Ajuda com Espessura</a>
                        </div>
                    </div>
                    ` : ''}
                    <a href="${this.resolveUrl('ajuda.html')}" class="menu-item mobile-menu-link"><i class="fas fa-book-open"></i> Ajuda</a>
                    ${!adminContext.isSuperAdmin ? `<a href="#" class="menu-item mobile-menu-link mobile-support-link support-link"><i class="fas fa-headset"></i> Suporte</a>` : ''}
                    ${showBusinessModules ? `<a href="${this.resolveUrl('subscription-status.html')}" class="menu-item mobile-menu-link"><i class="fas fa-star"></i> Assinatura</a>` : ''}
                    <a href="#" class="menu-item mobile-logout-link logout-link"><i class="fas fa-sign-out-alt"></i> Sair</a>
                    </div>
                    <div class="menu-quick-actions" aria-label="Ações rápidas">
                        <div class="alerts-dropdown">
                            <div class="menu-item-trigger alerts-trigger" role="button" tabindex="0" aria-haspopup="true" aria-expanded="false" style="display:flex; align-items:center; gap:8px; cursor:pointer;">
                                <i class="fas fa-bell alerts-icon"></i>
                                <span class="menu-label-mobile" style="display:none; color:white; font-family:Arial;">Alertas</span>
                            </div>
                            <span class="alerts-badge" style="display:none;">0</span>
                            <div class="dropdown-content alerts-panel">
                                <div class="user-info">
                                    <span><i class="fas fa-bell"></i> Alertas</span>
                                </div>
                                <div class="alerts-actions" style="display:flex; gap:8px; padding: 0 12px 10px;">
                                    <button type="button" class="btn small" id="alertsMarkReadBtn"><i class="fas fa-check"></i><span>Marcar lidos</span></button>
                                    <button type="button" class="btn small" id="alertsClearBtn"><i class="fas fa-broom"></i><span>Limpar</span></button>
                                </div>
                                <div class="alerts-list"></div>
                            </div>
                        </div>

                        <!-- Configurações Dropdown -->
                        <div class="settings-dropdown">
                            <div class="menu-item-trigger settings-trigger" role="button" tabindex="0" aria-haspopup="true" aria-expanded="false" style="display:flex; align-items:center; gap:8px; cursor:pointer;">
                                <i class="fas fa-cog settings-icon"></i>
                                <span class="menu-label-mobile" style="display:none; color:white; font-family:Arial;">Configurações</span>
                            </div>
                            <div class="dropdown-content settings-panel">
                                <div class="user-info settings-profile-card-slot">
                                    ${greetingHtml}
                                </div>
                                <div class="settings-section">
                                    <span class="settings-section-title">Conta</span>
                                    <a href="#" class="settings-action pwa-install-link" style="display:none;"><i class="fas fa-download"></i> Instalar aplicativo</a>
                                    <a href="${this.resolveUrl('user-profile.html')}" class="settings-action"><i class="fas fa-user-edit"></i> Meu Perfil</a>
                                </div>
                                ${showBusinessModules ? `
                                <div class="settings-section">
                                    <span class="settings-section-title">Operação</span>
                                    ${isAdmin ? `<a href="${this.resolveUrl('admin.html?tab=status')}" class="settings-action"><i class="fas fa-tools"></i> Diagnóstico / Migração</a>` : ''}
                                    <a href="${this.resolveUrl('subscription-status.html')}" class="settings-action"><i class="fas fa-star"></i> Assinatura</a>
                                    <a href="${this.resolveUrl('company.html')}" class="settings-action"><i class="fas fa-building"></i> Empresa</a>
                                </div>
                                ` : ''}
                                <div class="settings-section">
                                    <span class="settings-section-title">Ajuda</span>
                                    <a href="${this.resolveUrl('ajuda.html')}" class="settings-action help-page-link"><i class="fas fa-book-open"></i> Ajuda</a>
                                    ${!adminContext.isSuperAdmin ? `<a href="#" class="support-link settings-action"><i class="fas fa-headset"></i> Suporte</a>` : ''}
                                    <a href="#" class="settings-action about-link"><i class="fas fa-info-circle"></i> Sobre</a>
                                </div>
                                ${isAdmin ? `
                                <div class="settings-section admin-section">
                                    <span class="settings-section-title">Administração</span>
                                    ${adminContext.canDashboard ? `<a href="${this.resolveUrl('admin.html?tab=dashboard')}" class="admin-link settings-action"><i class="fas fa-shield-alt"></i> Painel Admin</a>` : ''}
                                    ${adminContext.canSubscriptions ? `<a href="${this.resolveUrl('admin.html?tab=subscriptions')}" class="admin-link settings-action"><i class="fas fa-clipboard-list"></i> Gerenciar Assinaturas</a>` : ''}
                                    ${adminContext.canSettings ? `<a href="${this.resolveUrl('admin.html?tab=settings')}" class="admin-link settings-action"><i class="fas fa-user-cog"></i> Configurações Admin</a>` : ''}
                                    ${adminContext.isSuperAdmin ? `<a href="${this.resolveUrl('admin.html?tab=support')}" class="admin-link settings-action"><i class="fas fa-headset"></i> Fila de Suporte</a>` : ''}
                                    ${(adminContext.canSettings || adminContext.canDashboard || adminContext.canSubscriptions) ? `<a href="${this.resolveUrl('admin-access-governance.html')}" class="admin-link settings-action"><i class="fas fa-user-shield"></i> Governança de Acesso</a>` : ''}
                                    ${''}
                                </div>
                                ` : ''}
                                <div class="settings-section settings-exit">
                                    <a href="#" class="settings-action logout-link"><i class="fas fa-sign-out-alt"></i> Sair</a>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
                <div class="sidebar-overlay" id="sidebarOverlay"></div>
            `;

            // Configurar eventos de dropdown
            this.setupDropdowns();
            this.setupMobileSidebar();
            if (window.SiswebPWA && typeof window.SiswebPWA.bindInstallLinks === 'function') {
                window.SiswebPWA.bindInstallLinks(this);
            }
            
            // ✅ CORREÇÃO CRÍTICA: Forçar navegação manual dos links dos submenus
            this.setupSubmenuNavigation();
        }

        setupMobileSidebar() {
            const toggleBtn = this.querySelector('#menuToggleBtn');
            const menuContainer = this.querySelector('#mainMenuContainer');
            const overlay = this.querySelector('#sidebarOverlay');

            if (toggleBtn && menuContainer && overlay) {
                const toggleSidebar = () => {
                    menuContainer.classList.toggle('active');
                    overlay.classList.toggle('active');
                };

                toggleBtn.addEventListener('click', toggleSidebar);
                overlay.addEventListener('click', toggleSidebar);
            }
        }

        setupDropdowns() {
            // Vendas dropdown
            const vendasMenu = this.querySelector('.vendas-menu');
            const vendasDropdown = this.querySelector('.vendas-dropdown');
            
            if (vendasMenu && vendasDropdown) {
                vendasMenu.addEventListener('click', function(e) {
                    e.preventDefault();
                    e.stopPropagation();
                    
                    // Fechar outros dropdowns antes de abrir este
                    document.querySelectorAll('.dropdown-content.show-dropdown').forEach(d => {
                        if (d !== vendasDropdown) {
                            d.classList.remove('show-dropdown');
                        }
                    });
                    
                    // Toggle do dropdown atual
                    vendasDropdown.classList.toggle('show-dropdown');
                });
            }

            // Estoque dropdown
            const estoqueMenu = this.querySelector('.estoque-menu');
            const estoqueDropdown = this.querySelector('.estoque-dropdown');
            if (estoqueMenu && estoqueDropdown) {
                estoqueMenu.addEventListener('click', function(e) {
                    e.preventDefault();
                    e.stopPropagation();
                    
                    // Fechar outros dropdowns
                    document.querySelectorAll('.dropdown-content.show-dropdown').forEach(d => {
                        if (d !== estoqueDropdown) {
                            d.classList.remove('show-dropdown');
                        }
                    });
                    
                    estoqueDropdown.classList.toggle('show-dropdown');
                });
            }

            // Financeiro dropdown
            const financeiroMenu = this.querySelector('.financeiro-menu');
            const financeiroDropdown = this.querySelector('.financeiro-dropdown');
            if (financeiroMenu && financeiroDropdown) {
                financeiroMenu.addEventListener('click', function(e) {
                    e.preventDefault();
                    e.stopPropagation();
                    
                    // Fechar outros dropdowns
                    document.querySelectorAll('.dropdown-content.show-dropdown').forEach(d => {
                        if (d !== financeiroDropdown) {
                            d.classList.remove('show-dropdown');
                        }
                    });
                    
                    financeiroDropdown.classList.toggle('show-dropdown');
                });
            }

            // Cadastros dropdown
            const cadastrosMenu = this.querySelector('.cadastros-menu');
            const cadastrosDropdown = this.querySelector('.cadastros-dropdown');
            if (cadastrosMenu && cadastrosDropdown) {
                cadastrosMenu.addEventListener('click', function(e) {
                    e.preventDefault();
                    e.stopPropagation();
                    
                    // Fechar outros dropdowns
                    document.querySelectorAll('.dropdown-content.show-dropdown').forEach(d => {
                        if (d !== cadastrosDropdown) {
                            d.classList.remove('show-dropdown');
                        }
                    });
                    
                    cadastrosDropdown.classList.toggle('show-dropdown');
                });
            }

            // Romaneios dropdown
            const romaneiosMenu = this.querySelector('.romaneios-menu');
            const romaneiosDropdown = this.querySelector('.romaneios-dropdown');
            if (romaneiosMenu && romaneiosDropdown) {
                romaneiosMenu.addEventListener('click', function(e) {
                    e.preventDefault();
                    e.stopPropagation();
                    
                    // Fechar outros dropdowns
                    document.querySelectorAll('.dropdown-content.show-dropdown').forEach(d => {
                        if (d !== romaneiosDropdown) {
                            d.classList.remove('show-dropdown');
                        }
                    });
                    
                    romaneiosDropdown.classList.toggle('show-dropdown');
                });
            }

            // Settings dropdown
            const settingsTrigger = this.querySelector('.settings-dropdown .menu-item-trigger');
            const settingsDropdown = this.querySelector('.settings-dropdown .dropdown-content');
            if (settingsTrigger && settingsDropdown) {
                const toggleSettings = (e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    
                    // Fechar outros dropdowns
                    document.querySelectorAll('.dropdown-content.show-dropdown').forEach(d => {
                        if (d !== settingsDropdown) {
                            d.classList.remove('show-dropdown');
                        }
                    });
                    
                    const opened = settingsDropdown.classList.toggle('show-dropdown');
                    settingsTrigger.setAttribute('aria-expanded', opened ? 'true' : 'false');
                };
                settingsTrigger.addEventListener('click', toggleSettings);
                settingsTrigger.addEventListener('keydown', (e) => {
                    if (e.key === 'Enter' || e.key === ' ') toggleSettings(e);
                });
            }

            const alertsTrigger = this.querySelector('.alerts-dropdown .menu-item-trigger');
            const alertsDropdown = this.querySelector('.alerts-panel');
            if (alertsTrigger && alertsDropdown) {
                const openAlerts = () => {
                    document.querySelectorAll('.dropdown-content.show-dropdown').forEach(d => {
                        if (d !== alertsDropdown) d.classList.remove('show-dropdown');
                    });
                    alertsDropdown.classList.add('show-dropdown');
                    alertsTrigger.setAttribute('aria-expanded', 'true');
                    try { this.recomputeSystemAlerts(); } catch (_) {}
                    try { this.renderAlerts(); } catch (_) {}
                };
                const closeAlerts = () => {
                    alertsDropdown.classList.remove('show-dropdown');
                    alertsTrigger.setAttribute('aria-expanded', 'false');
                };
                const toggleAlerts = (e) => {
                    e.preventDefault();
                    e.stopPropagation();

                    if (alertsDropdown.classList.contains('show-dropdown')) closeAlerts();
                    else openAlerts();
                };
                alertsTrigger.addEventListener('click', toggleAlerts);
                alertsTrigger.addEventListener('keydown', (e) => {
                    if (e.key === 'Enter' || e.key === ' ') toggleAlerts(e);
                });
                const alertsShell = this.querySelector('.alerts-dropdown');
                if (alertsShell) {
                    let closeHoverTimer = null;
                    const canOpenOnHover = () => {
                        try {
                            return !!(window.matchMedia && window.matchMedia('(hover: hover) and (pointer: fine)').matches);
                        } catch (_) {
                            return false;
                        }
                    };
                    alertsShell.addEventListener('mouseenter', () => {
                        if (!canOpenOnHover()) return;
                        if (closeHoverTimer) clearTimeout(closeHoverTimer);
                        openAlerts();
                    });
                    alertsShell.addEventListener('mouseleave', () => {
                        if (!canOpenOnHover()) return;
                        if (closeHoverTimer) clearTimeout(closeHoverTimer);
                        closeHoverTimer = setTimeout(closeAlerts, 180);
                    });
                }
            }

            // Logout
            const logoutLinks = this.querySelectorAll('.logout-link');
            logoutLinks.forEach((logoutLink) => {
                logoutLink.addEventListener('click', async function(e) {
                    e.preventDefault();
                    await performSafeLogout('logout_menu');
                });
            });

            // Support
            const supportLinks = this.querySelectorAll('.support-link');
            supportLinks.forEach((supportLink) => {
                supportLink.addEventListener('click', function(e) {
                    e.preventDefault();
                    if (typeof window.showSupport === 'function') {
                        window.showSupport();
                    } else {
                        alert('Suporte indisponível no momento.');
                    }
                });
            });

            // About
            const aboutLinks = this.querySelectorAll('.about-link');
            aboutLinks.forEach((aboutLink) => {
                aboutLink.addEventListener('click', function(e) {
                    e.preventDefault();
                    if (typeof window.showAbout === 'function') {
                        window.showAbout();
                    } else {
                        alert('Informações sobre o sistema não disponíveis no momento.');
                    }
                });
            });

            // Fechar dropdowns ao clicar fora
            document.addEventListener('click', (e) => {
                // Lista de todos os dropdowns com elementos válidos
                const dropdowns = [
                    { menu: vendasMenu, dropdown: vendasDropdown },
                    { menu: estoqueMenu, dropdown: estoqueDropdown },
                    { menu: financeiroMenu, dropdown: financeiroDropdown },
                    { menu: cadastrosMenu, dropdown: cadastrosDropdown },
                    { menu: romaneiosMenu, dropdown: romaneiosDropdown }
                ];

                // Verificar se clicou em algum menu ou dropdown
                let clickedInsideMenu = false;
                
                dropdowns.forEach(item => {
                    if (item.menu && item.dropdown) {
                        if (item.menu.contains(e.target) || item.dropdown.contains(e.target)) {
                            clickedInsideMenu = true;
                        }
                    }
                });
                
                // Verificar settings dropdown
                const settingsContainer = this.querySelector('.settings-dropdown');
                const alertsContainer = this.querySelector('.alerts-dropdown');
                if ((settingsContainer && settingsContainer.contains(e.target)) || (alertsContainer && alertsContainer.contains(e.target))) {
                    clickedInsideMenu = true;
                }
                
                // Se clicou fora de todos os menus, fechar dropdowns
                if (!clickedInsideMenu) {
                    dropdowns.forEach(item => {
                        if (item.dropdown) {
                            item.dropdown.classList.remove('show-dropdown');
                        }
                    });
                    
                    if (settingsDropdown) {
                        settingsDropdown.classList.remove('show-dropdown');
                        if (settingsTrigger) settingsTrigger.setAttribute('aria-expanded', 'false');
                    }
                    if (alertsDropdown) {
                        alertsDropdown.classList.remove('show-dropdown');
                        if (alertsTrigger) alertsTrigger.setAttribute('aria-expanded', 'false');
                    }
                }
            });

            const markReadBtn = this.querySelector('#alertsMarkReadBtn');
            if (markReadBtn && !markReadBtn._bound) {
                markReadBtn.addEventListener('click', (e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    try { this.markSystemAlertsAsRead(); } catch (_) {}
                    try { this.renderAlerts(); } catch (_) {}
                });
                markReadBtn._bound = true;
            }
            const clearBtn = this.querySelector('#alertsClearBtn');
            if (clearBtn && !clearBtn._bound) {
                clearBtn.addEventListener('click', (e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    if (!confirm('Limpar todas as mensagens de alerta?')) return;
                    try { this.clearSystemAlerts(); } catch (_) {}
                    try { this.renderAlerts(); } catch (_) {}
                });
                clearBtn._bound = true;
            }

            if (!this._alertsUpdateBound) {
                this._alertsUpdateBound = true;
                window.addEventListener('systemAlerts:updated', () => {
                    try { this.renderAlerts(); } catch (_) {}
                });
                window.addEventListener('storage', (e) => {
                    if (!e || !e.key) return;
                    if (String(e.key) === this.getAlertsStorageKey()) {
                        try { this.renderAlerts(); } catch (_) {}
                    }
                });
            }
            this.renderAlerts();
            this.refreshSettingsUserInfo();
            const refreshUserInfoLater = () => {
                const node = this.querySelector('.settings-dropdown .settings-profile-card-slot');
                const before = node ? node.innerHTML : '';
                this.refreshSettingsUserInfo().finally(() => {
                    if (node && node.innerHTML === before) return;
                });
            };
            setTimeout(refreshUserInfoLater, 800);
            try {
                window.addEventListener('storage', () => this.refreshSettingsUserInfo());
            } catch (_) {}

            try {
                if (!window.getSystemAlerts) {
                    window.getSystemAlerts = () => {
                        try {
                            const key = this.getAlertsStorageKey();
                            const raw = localStorage.getItem(key);
                            const parsed = raw ? JSON.parse(raw) : [];
                            return Array.isArray(parsed) ? parsed : [];
                        } catch (_) {
                            return [];
                        }
                    };
                }
                if (!window.markSystemAlertsRead) {
                    window.markSystemAlertsRead = () => {
                        try { this.markSystemAlertsAsRead(); } catch (_) {}
                    };
                }
                if (!window.clearSystemAlerts) {
                    window.clearSystemAlerts = () => {
                        try { this.clearSystemAlerts(); } catch (_) {}
                    };
                }
                window.SiswebAdminOperationalAlerts = {
                    ...(window.SiswebAdminOperationalAlerts || {}),
                    recordFirebaseBillingError: (error, extra = {}) => {
                        const payload = {
                            status: 'blocked',
                            source: 'browser',
                            message: typeof error === 'string' ? error : (error && (error.message || error.error || error.lastError)) || String(error || ''),
                            details: error && typeof error === 'object' ? error : null,
                            billingUrl: 'https://console.cloud.google.com/billing/linkedaccount?project=sisweb-7ce82',
                            updatedAt: new Date().toISOString(),
                            ...((extra && typeof extra === 'object') ? extra : {})
                        };
                        try { localStorage.setItem('sisweb_admin_deploy_last_error', JSON.stringify(payload)); } catch (_) {}
                        try { this.recomputeSystemAlerts(); } catch (_) {}
                        try { this.renderAlerts(); } catch (_) {}
                        try { window.dispatchEvent(new CustomEvent('systemAlerts:updated')); } catch (_) {}
                        return payload;
                    },
                    clearFirebaseBillingError: () => {
                        [
                            'sisweb_admin_firebase_billing_status',
                            'sisweb_firebase_billing_status',
                            'sisweb_admin_deploy_last_error',
                            'sisweb_deploy_last_error',
                            'sisweb_operational_last_error'
                        ].forEach((key) => {
                            try { localStorage.removeItem(key); } catch (_) {}
                        });
                        try { this.recomputeSystemAlerts(); } catch (_) {}
                        try { this.renderAlerts(); } catch (_) {}
                        try { window.dispatchEvent(new CustomEvent('systemAlerts:updated')); } catch (_) {}
                    }
                };
            } catch (_) {}

            try {
                if (!this._alertsRecomputeTimer) {
                    this._alertsRecomputeTimer = setInterval(() => {
                        try { this.recomputeSystemAlerts(); } catch (_) {}
                    }, 5 * 60 * 1000);
                }
            } catch (_) {}

            // ✅ CORREÇÃO: Consolidar as múltiplas chamadas em uma única execução com debounce.
            // Antes: 4 chamadas simultâneas (hydrateProfile.then, hydrateProfile.catch, catch-fallback, 2x setTimeout)
            // causavam cascata de queries duplicadas no Firebase a cada mount do componente.
            try {
                this.hydrateCurrentSessionProfile().catch(() => {}).finally(() => {
                    // Única chamada após hidratação do perfil — com pequeno atraso para
                    // garantir que o Firebase esteja conectado e o tenant resolvido
                    try { this.recomputeSystemAlerts(); } catch (_) {}
                });
            } catch (_) {
                // Fallback síncrono caso hydrateCurrentSessionProfile lance exceção
                setTimeout(() => { try { this.recomputeSystemAlerts(); } catch (_) {} }, 1200);
            }
        }
        
        // ✅ MÉTODO ADICIONADO: Forçar navegação manual dos links dos submenus
        setupSubmenuNavigation() {
            // Selecionar todos os links dos submenus (exceto os com href="#")
            const submenuLinks = this.querySelectorAll('.dropdown-content a[href]:not([href="#"])');
            const isPreviewEnv = (location.hostname === 'localhost');
            
            submenuLinks.forEach(link => {
                // Adicionar listener que força a navegação manual
                link.addEventListener('click', function(e) {
                    // Logs para diagnóstico
                    console.log('🔗 Click capturado no submenu:', link.href);
                    console.log('🎯 Href original:', link.getAttribute('href'));
                    
                    // Verificar se é um link válido
                    const href = link.getAttribute('href');
                    if (href && href !== '#' && !href.startsWith('javascript:')) {
                        if (isPreviewEnv) {
                            // No preview da IDE, deixar o navegador tratar a navegação padrão
                            console.log('🧭 Preview: deixando navegação padrão do link');
                            return true;
                        } else {
                            // Evitar navegação duplicada do navegador + navegação manual
                            e.preventDefault();
                            e.stopImmediatePropagation();
                            
                            // Navegação forçada manual (produção)
                            console.log('🚀 Forçando navegação para:', href);
                            window.location.href = href;
                            
                            // Prevenir qualquer outro handler
                            return false;
                        }
                    }
                }, true); // UseCapture = true para capturar antes de outros listeners
            });
            
            console.log(`✅ Navegação forçada configurada para ${submenuLinks.length} links de submenu`);
        }
        
        // Verificar se o usuário atual é admin
        getAdminContext() {
            try {
                const currentUser = JSON.parse(localStorage.getItem('currentUser'));
                const persistentUser = JSON.parse(localStorage.getItem('persistentUser') || 'null');
                const uid = (currentUser && (currentUser.uid || currentUser.id || currentUser.userId))
                    || (persistentUser && (persistentUser.uid || persistentUser.id || persistentUser.userId));
                if (window.isSuperAdminUid && typeof window.isSuperAdminUid === 'function' && window.isSuperAdminUid(uid)) {
                    return { isAdmin: true, isSuperAdmin: true, canDashboard: true, canSubscriptions: true, canSettings: true };
                }
                const users = JSON.parse(localStorage.getItem('users') || '[]');
                const userDetails = users.find((u) => (u.uid || u.id || u.userId) === uid || (currentUser && u.email === currentUser.email));
                const userPerms = userDetails && userDetails.adminPermissions ? userDetails.adminPermissions : {};
                const hasUserPermissions = !!(userPerms.dashboard || userPerms.subscriptions || userPerms.settings);
                if (hasUserPermissions && userDetails.adminActive !== false) {
                    return {
                        isAdmin: true,
                        isSuperAdmin: false,
                        canDashboard: userPerms.dashboard === true,
                        canSubscriptions: userPerms.subscriptions === true,
                        canSettings: userPerms.settings === true
                    };
                }
                const roles = JSON.parse(localStorage.getItem('roles') || '{}');
                const role = roles && uid ? roles[String(uid)] : null;
                const rolePerms = role && role.permissions ? role.permissions : {};
                const hasRolePermissions = !!(rolePerms.dashboard || rolePerms.subscriptions || rolePerms.settings);
                if (hasRolePermissions && role.active !== false) {
                    return {
                        isAdmin: true,
                        isSuperAdmin: false,
                        canDashboard: rolePerms.dashboard === true,
                        canSubscriptions: rolePerms.subscriptions === true,
                        canSettings: rolePerms.settings === true
                    };
                }
                return { isAdmin: false, isSuperAdmin: false, canDashboard: false, canSubscriptions: false, canSettings: false };
            } catch (error) {
                console.error('Erro ao verificar permissões de admin:', error);
                return { isAdmin: false, isSuperAdmin: false, canDashboard: false, canSubscriptions: false, canSettings: false };
            }
        }

        checkIfAdmin() {
            return this.getAdminContext().isAdmin;
        }

        renderAlerts() {
            try {
                const listEl = this.querySelector('.alerts-list');
                const badgeEl = this.querySelector('.alerts-badge');
                if (!listEl || !badgeEl) return;
                const alerts = typeof window.getSystemAlerts === 'function' ? window.getSystemAlerts() : [];
                const unread = alerts.filter((a) => !a.read).length;
                badgeEl.textContent = String(unread);
                badgeEl.style.display = unread > 0 ? 'inline-flex' : 'none';
                if (!alerts.length) {
                    listEl.innerHTML = '<div class="alerts-empty">Nenhum alerta no momento.</div>';
                    return;
                }
                listEl.innerHTML = alerts.slice(0, 8).map((a) => {
                    const title = String(a.title || 'Alerta').replace(/</g, '&lt;').replace(/>/g, '&gt;');
                    const message = String(a.message || '').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/\n/g, '<br>');
                    const href = a && a.href ? String(a.href) : '';
                    const sevRaw = String((a && (a.severity || a.type)) || '').toLowerCase();
                    const sev = (sevRaw === 'error' || sevRaw === 'danger')
                        ? 'sev-error'
                        : (sevRaw === 'warning' || sevRaw === 'warn')
                            ? 'sev-warning'
                            : (sevRaw === 'success')
                                ? 'sev-success'
                                : sevRaw
                                    ? 'sev-info'
                                    : '';
                    const cls = `alerts-item${sev ? ' ' + sev : ''}${a && a.read ? '' : ' unread'}`;
                    const hrefEscaped = href.replace(/"/g,'&quot;');
                    const targetAttr = /^https?:\/\//i.test(href) ? ' target="_blank" rel="noopener noreferrer"' : '';
                    const messageHtml = href
                        ? `<a class="alerts-item-message" href="${hrefEscaped}"${targetAttr}>${message}</a>`
                        : `<span class="alerts-item-message">${message}</span>`;
                    return `<div class="${cls}"><strong class="alerts-item-title">${title}</strong>${messageHtml}</div>`;
                }).join('');
            } catch (_) {}
        }

        getAlertsContext() {
            const adminContext = this.getAdminContext();
            const isAdmin = !!(adminContext && adminContext.isAdmin);
            const profile = this.getCurrentSessionProfile();
            const uid = String(profile.uid || profile.id || profile.userId || '').trim();
            let tenantId = '';
            try {
                if (window.appTenantId) tenantId = String(window.appTenantId || '').trim();
            } catch (_) {}
            if (!tenantId) {
                try {
                    const ci = JSON.parse(localStorage.getItem('company_info') || 'null') || {};
                    tenantId = String(ci.id || ci.companyId || ci.tenantId || '').trim();
                } catch (_) {}
            }
            return { isAdmin, isSuperAdmin: !!(adminContext && adminContext.isSuperAdmin), uid: uid || 'anon', tenantId: tenantId || 'default' };
        }

        getAlertsStorageKey() {
            const ctx = this.getAlertsContext();
            if (ctx.isAdmin) return `sisweb_alerts_admin__${ctx.uid}`;
            return `sisweb_alerts__${ctx.tenantId}__${ctx.uid}`;
        }

        readAlertsStore() {
            try {
                const key = this.getAlertsStorageKey();
                const raw = localStorage.getItem(key);
                const parsed = raw ? JSON.parse(raw) : [];
                return Array.isArray(parsed) ? parsed : [];
            } catch (_) {
                return [];
            }
        }

        writeAlertsStore(alerts) {
            try {
                const key = this.getAlertsStorageKey();
                localStorage.setItem(key, JSON.stringify(Array.isArray(alerts) ? alerts : []));
                try { window.dispatchEvent(new CustomEvent('systemAlerts:updated')); } catch (_) {}
            } catch (_) {}
        }

        markSystemAlertsAsRead() {
            try {
                const current = this.readAlertsStore();
                const next = current.map((a) => ({ ...a, read: true }));
                this.writeAlertsStore(next);
            } catch (_) {}
        }

        clearSystemAlerts() {
            try {
                this.writeAlertsStore([]);
            } catch (_) {}
        }

        formatBRL(value) {
            try {
                const n = Number(value || 0);
                return n.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
            } catch (_) {
                return 'R$ 0,00';
            }
        }

        getAlertsPreferences() {
            const defaults = {
                detailMaxItems: 3,
                finance: {
                    includeTomorrow: true,
                    includeToday: true,
                    includeOverdue: true
                },
                folha: {
                    feriasWarnDays: 30,
                    feriasCriticalDays: 15,
                    aniversarioWarnDays: 7,
                    aniversarioCriticalDays: 3
                },
                estoque: {
                    lowDefaultMin: 3,
                    criticalQty: 1
                }
            };
            try {
                const ctx = this.getAlertsContext();
                const key = ctx.isAdmin ? `sisweb_alerts_prefs_admin__${ctx.uid}` : `sisweb_alerts_prefs__${ctx.tenantId}__${ctx.uid}`;
                const raw = localStorage.getItem(key);
                if (!raw) return defaults;
                const parsed = JSON.parse(raw);
                if (!parsed || typeof parsed !== 'object') return defaults;
                return {
                    ...defaults,
                    ...parsed,
                    finance: { ...defaults.finance, ...(parsed.finance || {}) },
                    folha: { ...defaults.folha, ...(parsed.folha || {}) },
                    estoque: { ...defaults.estoque, ...(parsed.estoque || {}) }
                };
            } catch (_) {
                return defaults;
            }
        }

        toDateOnly(d) {
            const dt = d instanceof Date ? d : new Date(d);
            if (Number.isNaN(dt.getTime())) return null;
            return new Date(dt.getFullYear(), dt.getMonth(), dt.getDate());
        }

        daysDiff(a, b) {
            const da = this.toDateOnly(a);
            const db = this.toDateOnly(b);
            if (!da || !db) return null;
            return Math.round((db.getTime() - da.getTime()) / (1000 * 60 * 60 * 24));
        }

        monthKey(date) {
            const d = date instanceof Date ? date : new Date(date);
            if (Number.isNaN(d.getTime())) return '';
            const y = d.getFullYear();
            const m = String(d.getMonth() + 1).padStart(2, '0');
            return `${y}-${m}`;
        }

        addMonths(date, months) {
            const d = date instanceof Date ? new Date(date.getTime()) : new Date(date);
            if (Number.isNaN(d.getTime())) return null;
            const m = d.getMonth() + months;
            d.setMonth(m);
            return d;
        }

        normalizeArrayLike(data) {
            if (!data) return [];
            if (Array.isArray(data)) return data.filter(Boolean);
            if (typeof data === 'object') return Object.values(data || {}).filter(Boolean);
            return [];
        }

        isContaBaixada(conta) {
            const s = String((conta && (conta.status || conta.situacao || conta.state)) || '').toLowerCase();
            if (!s) return false;
            return s.includes('pago') || s.includes('receb') || s.includes('liquid') || s.includes('baix') || s.includes('cancel');
        }

        parseContaVencimento(conta) {
            const raw = (conta && (conta.dataVencimento || conta.vencimento || conta.dueDate || conta.data_vencimento || conta.dataVenc || conta.data)) || '';
            const dt = raw ? new Date(raw) : null;
            if (!dt || Number.isNaN(dt.getTime())) return null;
            return this.toDateOnly(dt);
        }

        parseContaValor(conta) {
            const raw = conta && (conta.valor || conta.amount || conta.total || conta.valorTotal || conta.valor_total);
            const n = Number(raw || 0);
            return Number.isFinite(n) ? n : 0;
        }

        async loadNamespaced(path) {
            try {
                if (window.firebaseService && typeof window.firebaseService.loadFromFirebase === 'function') {
                    const res = await window.firebaseService.loadFromFirebase(path, { canonicalOnly: true });
                    return res && res.success ? res.data : (res && res.data ? res.data : res);
                }
            } catch (_) {}
            return null;
        }

        parseOperationalJson(raw) {
            try {
                if (!raw) return null;
                if (typeof raw !== 'string') return raw;
                const trimmed = raw.trim();
                if (!trimmed) return null;
                if ((trimmed.startsWith('{') && trimmed.endsWith('}')) || (trimmed.startsWith('[') && trimmed.endsWith(']'))) {
                    return JSON.parse(trimmed);
                }
                return { message: trimmed };
            } catch (_) {
                return { message: String(raw || '') };
            }
        }

        removeOperationalAccents(value) {
            try {
                return String(value || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
            } catch (_) {
                return String(value || '').toLowerCase();
            }
        }

        collectOperationalSignals(raw, source) {
            const signals = [];
            const pushSignal = (value, fallbackId) => {
                if (!value && value !== 0) return;
                if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') {
                    signals.push({ id: fallbackId || source || 'signal', message: String(value), source });
                    return;
                }
                if (typeof value !== 'object') return;
                const hasSignalShape = [
                    'status', 'state', 'situacao', 'message', 'error', 'lastError',
                    'deployError', 'billingStatus', 'faturamentoStatus', 'billingUrl',
                    'consoleUrl', 'href', 'amount', 'valor'
                ].some((key) => Object.prototype.hasOwnProperty.call(value, key));
                if (hasSignalShape) {
                    signals.push({ ...value, id: value.id || fallbackId || source || 'signal', source });
                    return;
                }
                Object.entries(value || {}).forEach(([key, child]) => pushSignal(child, key));
            };
            if (Array.isArray(raw)) raw.forEach((item, index) => pushSignal(item, `${source || 'signal'}_${index}`));
            else pushSignal(raw, source);
            return signals;
        }

        flattenOperationalText(value, depth = 0) {
            if (value === null || typeof value === 'undefined' || depth > 2) return '';
            if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') return String(value);
            if (Array.isArray(value)) return value.slice(0, 12).map((item) => this.flattenOperationalText(item, depth + 1)).filter(Boolean).join(' ');
            if (typeof value === 'object') {
                return Object.entries(value).slice(0, 30).map(([key, child]) => `${key} ${this.flattenOperationalText(child, depth + 1)}`).filter(Boolean).join(' ');
            }
            return '';
        }

        isClosedOperationalSignal(signal) {
            const statusText = this.removeOperationalAccents([
                signal && signal.status,
                signal && signal.state,
                signal && signal.situacao,
                signal && signal.billingStatus,
                signal && signal.faturamentoStatus
            ].filter(Boolean).join(' '));
            if (signal && signal.active === false) return true;
            if (!statusText) return false;
            return /\b(ok|paid|pago|quitado|resolved|resolvido|closed|fechado|clear|limpo|inactive|inativo)\b/.test(statusText);
        }

        matchesFirebaseBillingDeployError(text) {
            const normalized = this.removeOperationalAccents(text);
            if (!normalized) return false;
            return (
                normalized.includes('please check billing account')
                || normalized.includes('check billing account associated')
                || (
                    normalized.includes('generateuploadurl')
                    && normalized.includes('write access')
                    && normalized.includes('denied')
                    && normalized.includes('billing')
                )
                || (
                    normalized.includes('cloud functions')
                    && normalized.includes('write access')
                    && normalized.includes('denied')
                    && normalized.includes('billing')
                )
                || (
                    normalized.includes('billing account')
                    && (normalized.includes('denied') || normalized.includes('disabled') || normalized.includes('overdue') || normalized.includes('past due'))
                )
            );
        }

        isFirebaseBillingOpenSignal(signal) {
            if (!signal || this.isClosedOperationalSignal(signal)) return false;
            const budgetRatio = Math.max(
                Number(signal.usagePercent || signal.costRatio || 0),
                Number(signal.alertThresholdExceeded || 0),
                Number(signal.forecastThresholdExceeded || 0)
            );
            if (Number.isFinite(budgetRatio) && budgetRatio >= 0.8) return true;
            const statusText = this.removeOperationalAccents([
                signal.status,
                signal.state,
                signal.situacao,
                signal.billingStatus,
                signal.faturamentoStatus
            ].filter(Boolean).join(' '));
            const fullText = this.removeOperationalAccents(this.flattenOperationalText(signal));
            if (this.matchesFirebaseBillingDeployError(fullText)) return true;
            if (/\b(open|opened|overdue|past_due|past due|blocked|billing_blocked|pending|pendente|aberto|em aberto|atrasado|em atraso|vencido|bloqueado)\b/.test(statusText)) return true;
            return (
                (fullText.includes('firebase') || fullText.includes('billing') || fullText.includes('faturamento') || fullText.includes('fatura'))
                && (
                    fullText.includes('fatura em aberto')
                    || fullText.includes('fatura em atraso')
                    || fullText.includes('pagamento pendente')
                    || fullText.includes('faturamento bloqueado')
                    || fullText.includes('billing blocked')
                    || fullText.includes('past due')
                    || fullText.includes('overdue')
                )
            );
        }

        resolveFirebaseBillingUrl(signal) {
            const raw = signal && (signal.billingUrl || signal.consoleUrl || signal.href || signal.url);
            const href = String(raw || '').trim();
            if (/^https?:\/\//i.test(href)) return href;
            if (signal && (signal.budgetDisplayName || signal.alertThresholdExceeded || signal.forecastThresholdExceeded || signal.usagePercent)) {
                return 'https://console.cloud.google.com/billing/budgets?project=sisweb-7ce82';
            }
            return 'https://console.cloud.google.com/billing/linkedaccount?project=sisweb-7ce82';
        }

        readLocalAdminOperationalSignals() {
            const keys = [
                'sisweb_admin_firebase_billing_status',
                'sisweb_firebase_billing_status',
                'sisweb_admin_deploy_last_error',
                'sisweb_deploy_last_error',
                'sisweb_operational_last_error'
            ];
            const signals = [];
            keys.forEach((key) => {
                try {
                    const raw = localStorage.getItem(key);
                    if (!raw) return;
                    signals.push(...this.collectOperationalSignals(this.parseOperationalJson(raw), `local:${key}`));
                } catch (_) {}
            });
            try {
                if (window.__siswebDeployLastError) {
                    signals.push(...this.collectOperationalSignals(window.__siswebDeployLastError, 'window.__siswebDeployLastError'));
                }
            } catch (_) {}
            return signals;
        }

        buildAdminFirebaseBillingAlert(signal, now) {
            const createdAt = now.toISOString();
            const dayKey = createdAt.slice(0, 10);
            const fullText = this.flattenOperationalText(signal);
            const isDeployBlocked = this.matchesFirebaseBillingDeployError(fullText);
            const statusText = this.removeOperationalAccents([
                signal && signal.status,
                signal && signal.state,
                signal && signal.situacao,
                signal && signal.billingStatus,
                signal && signal.faturamentoStatus
            ].filter(Boolean).join(' '));
            const rawAmount = signal && (signal.amount || signal.valor || signal.total || signal.value);
            const amountText = rawAmount
                ? (typeof rawAmount === 'number' ? this.formatBRL(rawAmount) : String(rawAmount))
                : '';
            const detail = String(
                (signal && (signal.message || signal.error || signal.lastError || signal.deployError || signal.details || signal.statusMessage))
                || ''
            ).trim();
            const clippedDetail = detail ? detail.replace(/\s+/g, ' ').slice(0, 260) : '';
            const budgetRatio = Math.max(
                Number(signal && (signal.usagePercent || signal.costRatio || 0)),
                Number(signal && (signal.alertThresholdExceeded || 0)),
                Number(signal && (signal.forecastThresholdExceeded || 0))
            );
            const isBudgetSignal = Number.isFinite(budgetRatio) && budgetRatio > 0;
            if (isBudgetSignal) {
                const percent = Math.round(budgetRatio * 1000) / 10;
                const budgetName = String(signal && signal.budgetDisplayName || 'Google Cloud Billing').trim();
                return {
                    id: `admin_google_cloud_budget__${dayKey}`,
                    title: 'Google Cloud • Orçamento',
                    message: `Orçamento ${budgetName} atingiu ${String(percent).replace('.', ',')}% do limite configurado. Clique para abrir Budgets e revisar consumo/faturas.`,
                    href: this.resolveFirebaseBillingUrl(signal),
                    severity: budgetRatio >= 1 ? 'error' : 'warning',
                    createdAt,
                    read: false
                };
            }
            const statusPart = amountText ? ` Valor informado: ${amountText}.` : '';
            const title = isDeployBlocked ? 'Firebase • Deploy bloqueado' : 'Firebase • Faturamento';
            const message = isDeployBlocked
                ? `Deploy/Cloud Functions bloqueado por faturamento ou conta de billing sem write access.${statusPart} Clique para abrir o painel de faturamento e regularizar.`
                : `Fatura do Firebase em aberto, pendente ou em atraso detectada.${statusPart} Clique para abrir o painel de faturamento antes que deploys e serviços sejam bloqueados.`;
            return {
                id: `admin_firebase_billing_${isDeployBlocked ? 'deploy_blocked' : 'open'}__${dayKey}`,
                title,
                message: clippedDetail ? `${message}\nDetalhe: ${clippedDetail}` : message,
                href: this.resolveFirebaseBillingUrl(signal),
                severity: (isDeployBlocked || /blocked|bloqueado|overdue|atrasado|atraso|vencido|past due/.test(statusText)) ? 'error' : 'warning',
                createdAt,
                read: false
            };
        }

        async getAdminOperationalAlerts(ctx, now) {
            const adminContext = this.getAdminContext();
            if (!((ctx && ctx.isSuperAdmin) || (adminContext && adminContext.isSuperAdmin))) return [];
            const signals = [];
            const remotePaths = [
                'system/operationalAlerts/firebaseBilling',
                'system/deployHealth/firebase',
                'system/googleCloudBilling/summary',
                'system/googleCloudBilling/budgetNotifications'
            ];
            for (const path of remotePaths) {
                try {
                    const data = await this.loadNamespaced(path);
                    signals.push(...this.collectOperationalSignals(data, path));
                } catch (_) {}
            }
            signals.push(...this.readLocalAdminOperationalSignals());
            const active = signals.filter((signal) => this.isFirebaseBillingOpenSignal(signal));
            if (!active.length) return [];
            active.sort((a, b) => {
                const aText = this.flattenOperationalText(a);
                const bText = this.flattenOperationalText(b);
                const aScore = this.matchesFirebaseBillingDeployError(aText) ? 2 : 1;
                const bScore = this.matchesFirebaseBillingDeployError(bText) ? 2 : 1;
                return bScore - aScore;
            });
            return [this.buildAdminFirebaseBillingAlert(active[0], now)];
        }

        async computeAlertsForUser(ctx) {
            const alerts = [];
            const now = new Date();
            const today = this.toDateOnly(now);
            const tomorrow = this.addMonths(today, 0);
            if (tomorrow) tomorrow.setDate(tomorrow.getDate() + 1);
            const prefs = this.getAlertsPreferences();

            const companyExists = (() => {
                try {
                    const ci = JSON.parse(localStorage.getItem('company_info') || 'null') || {};
                    const id = String(ci.id || ci.companyId || '').trim();
                    return !!id;
                } catch (_) {
                    return false;
                }
            })();
            if (!companyExists || ctx.tenantId === 'default') {
                alerts.push({
                    id: `missing_company__${ctx.uid}`,
                    title: 'Cadastro pendente',
                    message: 'Clique para Cadastrar Empresa',
                    href: 'https://sisweb-7ce82.web.app/company.html',
                    severity: 'warning',
                    createdAt: now.toISOString(),
                    read: false
                });
            }

            try {
                const profile = this.getCurrentSessionProfile();
                const statusKey = window.resolveSubscriptionStatus && typeof window.resolveSubscriptionStatus === 'function'
                    ? String(window.resolveSubscriptionStatus(profile) || '')
                    : String(profile.subscriptionStatus || profile.status || '');
                const lower = statusKey.toLowerCase();
                let daysLeft = null;
                if (lower === 'trial_active' && profile.trialStart) {
                    const start = new Date(profile.trialStart);
                    const settings = JSON.parse(localStorage.getItem('subscriptionSettingsCache') || 'null') || {};
                    const trialDays = parseInt(settings.freeTrialDays, 10) || 30;
                    const elapsed = Math.ceil((Date.now() - start.getTime()) / (1000 * 60 * 60 * 24));
                    daysLeft = Math.max(0, trialDays - elapsed);
                } else if (profile.subscription && profile.subscription.endDate) {
                    const end = new Date(profile.subscription.endDate);
                    daysLeft = Math.ceil((end.getTime() - Date.now()) / (1000 * 60 * 60 * 24));
                }
                if (Number.isFinite(daysLeft) && daysLeft <= 5) {
                    const dailyId = `sub_exp__${ctx.uid}__${today.toISOString().slice(0,10)}`;
                    alerts.push({
                        id: dailyId,
                        title: 'Assinatura',
                        message: daysLeft < 0 ? 'Assinatura expirada. Regularize para evitar bloqueio.' : `Assinatura vence em ${daysLeft} dia(s).`,
                        href: this.resolveUrl('subscription-status.html'),
                        severity: daysLeft <= 1 ? 'error' : 'warning',
                        createdAt: now.toISOString(),
                        read: false
                    });
                }
            } catch (_) {}

            if (ctx.tenantId !== 'default') try {
                const mk = this.monthKey(today);
                const mkPrev = this.monthKey(this.addMonths(today, -1));
                const mkNext = this.monthKey(this.addMonths(today, 1));
                const keys = [mkPrev, mk, mkNext].filter(Boolean);

                const loadFin = async (kind) => {
                    const all = [];
                    for (const k of keys) {
                        const data = await this.loadNamespaced(`financas/${kind}/${k}`);
                        this.normalizeArrayLike(data).forEach((item) => all.push(item));
                    }
                    return all;
                };

                const receber = await loadFin('receber');
                const pagar = await loadFin('pagar');

                const buildFinanceAlerts = (items, label, href) => {
                    const open = (items || []).filter((c) => c && !this.isContaBaixada(c));
                    const buckets = {
                        tomorrow: [],
                        today: [],
                        overdue: []
                    };
                    open.forEach((c) => {
                        const v = this.parseContaVencimento(c);
                        if (!v) return;
                        const d = this.daysDiff(v, today);
                        if (d === 1) buckets.tomorrow.push(c);
                        else if (d === 0) buckets.today.push(c);
                        else if (d != null && d < 0) buckets.overdue.push(c);
                    });
                    const sum = (arr) => (arr || []).reduce((acc, c) => acc + this.parseContaValor(c), 0);
                    const fmtContaLabel = (c) => {
                        const raw = c && (c.descricao || c.historico || c.nome || c.clienteNome || c.fornecedorNome || c.numero || c.documento || c.id);
                        return String(raw || '-').trim() || '-';
                    };
                    const top = (arr, sortFn) => {
                        const max = Math.max(0, parseInt(prefs.detailMaxItems, 10) || 3);
                        const copy = (arr || []).slice();
                        if (typeof sortFn === 'function') copy.sort(sortFn);
                        return copy.slice(0, max);
                    };
                    const detailsText = (arr, mode) => {
                        const list = top(arr, mode === 'overdue'
                            ? (a,b) => {
                                const da = this.parseContaVencimento(a);
                                const db = this.parseContaVencimento(b);
                                const aa = da ? this.daysDiff(da, today) : 0;
                                const bb = db ? this.daysDiff(db, today) : 0;
                                return (aa || 0) - (bb || 0);
                            }
                            : (a,b) => this.parseContaValor(b) - this.parseContaValor(a)
                        );
                        return list.map((c) => {
                            const v = this.parseContaVencimento(c);
                            const d = v ? this.daysDiff(v, today) : null;
                            const dayLabel = d == null ? '' : (d < 0 ? ` ${Math.abs(d)}d` : ` ${d}d`);
                            return `${fmtContaLabel(c)} (${this.formatBRL(this.parseContaValor(c))}${dayLabel})`;
                        }).join(' • ');
                    };

                    if (prefs.finance.includeTomorrow && buckets.tomorrow.length) {
                        alerts.push({
                            id: `fin_${label}_tomorrow__${today.toISOString().slice(0,10)}`,
                            title: `Finanças • ${label}`,
                            message: `${buckets.tomorrow.length} vencendo em 1 dia • ${this.formatBRL(sum(buckets.tomorrow))}${detailsText(buckets.tomorrow, 'soon') ? `\n${detailsText(buckets.tomorrow, 'soon')}` : ''}`,
                            href,
                            severity: 'warning',
                            createdAt: now.toISOString(),
                            read: false
                        });
                    }
                    if (prefs.finance.includeToday && buckets.today.length) {
                        alerts.push({
                            id: `fin_${label}_today__${today.toISOString().slice(0,10)}`,
                            title: `Finanças • ${label}`,
                            message: `${buckets.today.length} vence hoje • ${this.formatBRL(sum(buckets.today))}${detailsText(buckets.today, 'today') ? `\n${detailsText(buckets.today, 'today')}` : ''}`,
                            href,
                            severity: 'warning',
                            createdAt: now.toISOString(),
                            read: false
                        });
                    }
                    if (prefs.finance.includeOverdue && buckets.overdue.length) {
                        alerts.push({
                            id: `fin_${label}_overdue__${today.toISOString().slice(0,10)}`,
                            title: `Finanças • ${label}`,
                            message: `${buckets.overdue.length} atrasada(s) • ${this.formatBRL(sum(buckets.overdue))}${detailsText(buckets.overdue, 'overdue') ? `\n${detailsText(buckets.overdue, 'overdue')}` : ''}`,
                            href,
                            severity: 'error',
                            createdAt: now.toISOString(),
                            read: false
                        });
                    }
                };

                buildFinanceAlerts(receber, 'A Receber', this.resolveUrl('financas.html'));
                buildFinanceAlerts(pagar, 'A Pagar', this.resolveUrl('financas.html'));
            } catch (_) {}

            if (ctx.tenantId !== 'default') try {
                const func1 = await this.loadNamespaced('funcionarios') || [];
                const funcionariosRaw = this.normalizeArrayLike(func1);
                const uniqueFuncs = new Map();
                funcionariosRaw.forEach(f => {
                    if (f && f.id && !uniqueFuncs.has(f.id)) uniqueFuncs.set(f.id, f);
                });
                const funcionarios = Array.from(uniqueFuncs.values()).filter((f) => f && f.ativo !== false);
                if (funcionarios.length) {
                    const upcomingFerias = [];
                    const upcomingBirth = [];
                    const formatDate = (d) => {
                        try { return new Date(d).toLocaleDateString('pt-BR'); } catch (_) { return '-'; }
                    };
                    const parseDateString = (str) => {
                        if (!str) return null;
                        if (str instanceof Date) return str;
                        let s = String(str).trim();
                        const m1 = s.match(/^(\d{4})-(\d{2})-(\d{2})/);
                        if (m1) return new Date(parseInt(m1[1],10), parseInt(m1[2],10)-1, parseInt(m1[3],10));
                        const m2 = s.match(/^(\d{2})\/(\d{2})\/(\d{4})/);
                        if (m2) return new Date(parseInt(m2[3],10), parseInt(m2[2],10)-1, parseInt(m2[1],10));
                        const dt = new Date(s);
                        if (!Number.isNaN(dt.getTime())) {
                            if (s.includes('T00:00:00Z')) {
                                return new Date(dt.getTime() + dt.getTimezoneOffset() * 60000);
                            }
                            return dt;
                        }
                        return null;
                    };
                    funcionarios.forEach((f) => {
                        const adm = f.dataAdmissional || f.admissao || f.dataAdmissao;
                        const tipoContrato = String(f.tipoContrato || f.contrato || '').toLowerCase();
                        if (adm && tipoContrato === 'clt') {
                            const admDt = parseDateString(adm);
                            if (admDt && !Number.isNaN(admDt.getTime())) {
                                const anos = today.getFullYear() - admDt.getFullYear();
                                let nextVenc = new Date(admDt.getFullYear() + anos, admDt.getMonth(), admDt.getDate());
                                if (nextVenc < today && anos > 0) {
                                    nextVenc.setFullYear(nextVenc.getFullYear() + 1);
                                } else if (anos === 0) {
                                    nextVenc.setFullYear(nextVenc.getFullYear() + 1);
                                }
                                
                                let lastVenc = new Date(nextVenc.getFullYear() - 1, nextVenc.getMonth(), nextVenc.getDate());
                                if (lastVenc <= admDt) {
                                    lastVenc = null;
                                }

                                const dLeftNext = this.daysDiff(today, this.toDateOnly(nextVenc));
                                const dLeftLast = lastVenc ? this.daysDiff(today, this.toDateOnly(lastVenc)) : null;
                                
                                let targetVenc = null;
                                let dLeft = null;
                                
                                if (dLeftLast !== null && dLeftLast <= 0 && dLeftLast >= -365) {
                                    targetVenc = lastVenc;
                                    dLeft = dLeftLast;
                                } else if (dLeftNext <= prefs.folha.feriasWarnDays) {
                                    targetVenc = nextVenc;
                                    dLeft = dLeftNext;
                                }
                                
                                if (targetVenc && dLeft != null) {
                                    const salario = Number(f.salarioBase || f.salario || 0);
                                    const provisao = salario ? salario + (salario / 3) : 0;
                                    upcomingFerias.push({ nome: f.nome || '-', venc: targetVenc, provisao, dLeft });
                                }
                            }
                        }
                        const nasc = f.dataNascimento || f.nascimento || f.dataNasc;
                        if (nasc) {
                            const nd = parseDateString(nasc);
                            if (nd && !Number.isNaN(nd.getTime())) {
                                const next = new Date(today.getFullYear(), nd.getMonth(), nd.getDate());
                                if (next < today) next.setFullYear(next.getFullYear() + 1);
                                const days = this.daysDiff(today, next);
                                if (days != null && days >= 0 && days <= prefs.folha.aniversarioWarnDays) {
                                    upcomingBirth.push({ nome: f.nome || '-', data: next, days });
                                }
                            }
                        }
                    });
                    if (upcomingFerias.length) {
                        upcomingFerias.sort((a,b) => new Date(a.venc) - new Date(b.venc));
                        const first = upcomingFerias[0];
                        const topFerias = upcomingFerias.slice(0, Math.max(1, parseInt(prefs.detailMaxItems, 10) || 3));
                        const details = topFerias.map((x) => `${x.nome} (${formatDate(x.venc)}${x.dLeft < 0 ? ' - Vencida' : ''})`).join(' • ');
                        alerts.push({
                            id: `folha_ferias__${today.toISOString().slice(0,10)}`,
                            title: 'Folha • Férias CLT',
                            message: `${upcomingFerias.length} vencimento(s) de férias (vencidas ou próximas).\nPróximo: ${first.nome} em ${formatDate(first.venc)}\n${details}`,
                            href: this.resolveUrl('folha_pagamento/folha.html'),
                            severity: first.dLeft != null && first.dLeft <= prefs.folha.feriasCriticalDays ? 'error' : 'warning',
                            createdAt: now.toISOString(),
                            read: false
                        });
                    }
                    if (upcomingBirth.length) {
                        upcomingBirth.sort((a,b) => new Date(a.data) - new Date(b.data));
                        const first = upcomingBirth[0];
                        const topBirth = upcomingBirth.slice(0, Math.max(1, parseInt(prefs.detailMaxItems, 10) || 3));
                        const details = topBirth.map((x) => `${x.nome} (${formatDate(x.data)})`).join(' • ');
                        alerts.push({
                            id: `folha_anivers__${today.toISOString().slice(0,10)}`,
                            title: 'Folha • Aniversários',
                            message: `${upcomingBirth.length} aniversário(s) em até ${prefs.folha.aniversarioWarnDays} dias. Próximo: ${first.nome} em ${formatDate(first.data)}\n${details}`,
                            href: this.resolveUrl('folha_pagamento/folha.html'),
                            severity: first.days != null && first.days <= prefs.folha.aniversarioCriticalDays ? 'warning' : 'info',
                            createdAt: now.toISOString(),
                            read: false
                        });
                    }
                }
            } catch (_) {}

            if (ctx.tenantId !== 'default') try {
                const produtosRaw = await this.loadNamespaced('estoqueProdutos');
                const produtos = this.normalizeArrayLike(produtosRaw);
                const low = [];
                produtos.forEach((p) => {
                    if (!p) return;
                    const qtd = Number(p.quantidade || 0);
                    const min = Number(p.estoqueMinimo || p.minEstoque || p.quantidadeMinima || prefs.estoque.lowDefaultMin);
                    if (Number.isFinite(qtd) && Number.isFinite(min) && qtd > 0 && qtd <= min) {
                        low.push({ nome: p.nome || p.id || '-', qtd, min });
                    }
                });
                if (low.length) {
                    low.sort((a,b) => a.qtd - b.qtd);
                    const first = low[0];
                    const topLow = low.slice(0, Math.max(1, parseInt(prefs.detailMaxItems, 10) || 3));
                    const details = topLow.map((x) => `${x.nome} (${String(x.qtd).replace('.',',')})`).join(' • ');
                    alerts.push({
                        id: `estoque_baixo__${today.toISOString().slice(0,10)}`,
                        title: 'Estoque • Almoxarifado',
                        message: `${low.length} produto(s) com estoque baixo (<= mínimo). Ex.: ${first.nome} (${String(first.qtd).replace('.',',')})\n${details}`,
                        href: this.resolveUrl('estoque.html#produtos'),
                        severity: first.qtd <= prefs.estoque.criticalQty ? 'error' : 'warning',
                        createdAt: now.toISOString(),
                        read: false
                    });
                }
            } catch (_) {}

            if (ctx.tenantId !== 'default') try {
                const pedidosRaw = await this.loadNamespaced('vendas/pedidos');
                const pedidos = this.normalizeArrayLike(pedidosRaw);
                const pagamentosRaw = await this.loadNamespaced('vendas/pagamentos_carrego');
                const pagamentos = this.normalizeArrayLike(pagamentosRaw);
                
                const pagosSet = new Set(pagamentos.filter(x => x && x.status === 'pago').map(x => String(x.pedidoId)));
                
                const normalizeStr = (s) => String(s || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim().toLowerCase();
                const isCarregoName = (raw) => {
                    const base = normalizeStr(raw).replace(/[^a-z0-9]+/g, ' ').trim();
                    return base === 'carrego' || base.startsWith('carrego ') || base.endsWith(' carrego') || base.includes(' carrego ');
                };
                
                const parseNumberFlexible = (value) => {
                    if (value === undefined || value === null) return 0;
                    if (typeof value === 'number') return value;
                    const s = value.toString().replace(/[^\d,.-]/g, '').replace(/\./g, '').replace(',', '.');
                    return parseFloat(s) || 0;
                };

                let totalCarregoM3 = 0;
                let carregosCount = 0;

                pedidos.forEach(pedido => {
                    if (!pedido) return;
                    if (String(pedido.status || '').trim().toLowerCase() === 'cancelado') return;
                    if (pagosSet.has(String(pedido.id))) return;
                    if (pedido.carregoPago === true) return;
                    
                    const itens = Array.isArray(pedido.itens) ? pedido.itens : [];
                    const carregoItem = itens.find(it => isCarregoName(it.produtoNome || it.nome || it.produto));
                    
                    if (carregoItem) {
                        const raw = (typeof carregoItem.quantidade !== 'undefined') ? carregoItem.quantidade : (typeof carregoItem.volume !== 'undefined' ? carregoItem.volume : carregoItem.m3);
                        const vol = parseNumberFlexible(raw);
                        
                        if (vol > 0) {
                            totalCarregoM3 += vol;
                            carregosCount++;
                        }
                    }
                });

                if (totalCarregoM3 > 0) {
                    alerts.push({
                        id: `vendas_carregos__${today.toISOString().slice(0,10)}`,
                        title: 'Vendas • Carregos',
                        message: `${carregosCount} pedido(s) com carrego pendente, totalizando ${totalCarregoM3.toFixed(3).replace('.', ',')} m³ disponíveis.`,
                        href: this.resolveUrl('vendas.html'),
                        severity: 'info',
                        createdAt: now.toISOString(),
                        read: false
                    });
                }
            } catch (_) {}

            return alerts;
        }

        async computeAlertsForAdmin(ctx) {
            const alerts = [];
            const now = new Date();
            try {
                const operationalAlerts = await this.getAdminOperationalAlerts(ctx, now);
                operationalAlerts.forEach((alert) => alerts.push(alert));
            } catch (_) {}
            try {
                if (window.firebaseService && typeof window.firebaseService.getOpenExtensionRequests === 'function') {
                    const result = await window.firebaseService.getOpenExtensionRequests();
                    const items = result && result.success && result.data && Array.isArray(result.data.requests) ? result.data.requests : [];
                    if (items.length) {
                        alerts.push({
                            id: `admin_ext_requests__${now.toISOString().slice(0,10)}`,
                            title: 'Admin • Status',
                            message: `${items.length} solicitação(ões) de prorrogação aberta(s)`,
                            href: this.resolveUrl('admin.html?tab=status'),
                            severity: 'warning',
                            createdAt: now.toISOString(),
                            read: false
                        });
                    }
                }
            } catch (_) {}
            return alerts;
        }

        async recomputeSystemAlerts() {
            // ✅ CORREÇÃO: Throttle interno para evitar execuções paralelas/simultâneas.
            // Se já há uma execução em andamento (_recomputeInFlight), aguarda ela terminar
            // antes de iniciar outra, ou descarta se chamada em menos de 2s.
            if (this._recomputeInFlight) return;
            const now = Date.now();
            if (this._lastRecomputeAt && (now - this._lastRecomputeAt) < 2000) return;
            this._recomputeInFlight = true;
            this._lastRecomputeAt = now;
            try {
                const ctx = this.getAlertsContext();
                if (!ctx.uid) return;
                const existing = this.readAlertsStore();
                const existingReadById = new Map(existing.map((a) => [String(a && a.id), !!(a && a.read)]));
                const computed = ctx.isAdmin ? await this.computeAlertsForAdmin(ctx) : await this.computeAlertsForUser(ctx);
                const merged = (computed || []).map((a) => ({
                    ...a,
                    read: existingReadById.has(String(a.id)) ? existingReadById.get(String(a.id)) : !!a.read
                }));
                merged.sort((a,b) => String(b.createdAt || '').localeCompare(String(a.createdAt || '')));
                this.writeAlertsStore(merged.slice(0, 40));
            } finally {
                this._recomputeInFlight = false;
            }
        }

        resolveAlertsStorageKey() {
            return this.getAlertsStorageKey();
        }

        markSystemAlertsAsRead() {
            try {
                const current = this.readAlertsStore();
                const next = current.map((a) => ({ ...a, read: true }));
                this.writeAlertsStore(next);
            } catch (_) {}
        }

        clearSystemAlerts() {
            try {
                this.writeAlertsStore([]);
            } catch (_) {}
        }
    }

    window.parseDateLocal = function(str) {
        if (!str) return null;
        if (str instanceof Date) return str;
        let s = String(str).trim();
        const m1 = s.match(/^(\d{4})-(\d{2})-(\d{2})/);
        if (m1) return new Date(parseInt(m1[1],10), parseInt(m1[2],10)-1, parseInt(m1[3],10));
        const m2 = s.match(/^(\d{2})\/(\d{2})\/(\d{4})/);
        if (m2) return new Date(parseInt(m2[3],10), parseInt(m2[2],10)-1, parseInt(m2[1],10));
        const dt = new Date(s);
        if (!Number.isNaN(dt.getTime())) {
            if (s.includes('T00:00:00Z') || (s.length === 10 && s.includes('-'))) {
                return new Date(dt.getTime() + dt.getTimezoneOffset() * 60000);
            }
            return dt;
        }
        return null;
    };

    // Define o custom element apenas se ainda não foi definido
    customElements.define('main-menu', MenuComponent);
}

const __siswebHelpModalTemplate = `
    <div class="help-content" role="dialog" aria-modal="true" aria-label="Ajuda">
        <span class="close" onclick="window.closeHelpModal && window.closeHelpModal()">&times;</span>
        <h2>Ajuda</h2>
        <div class="help-section">
            <h3>Guia Rápido de Uso do Sistema</h3>
            <p>Use este painel para entender o fluxo ideal por módulo e reduzir erros operacionais.</p>
            <ul>
                <li>Cadastre a empresa em Empresa e confirme os dados obrigatórios.</li>
                <li>Cadastre Clientes, Fornecedores e Espécies.</li>
                <li>Gere Pré-Romaneios e depois emita romaneios TL, PCT, PÉS ou TORA.</li>
                <li>Acompanhe Financeiro, Estoque e Folha no menu principal.</li>
            </ul>
        </div>
        <div class="help-section">
            <h3>Manual completo</h3>
            <p>Abra o manual com busca e prints para ver o passo a passo de cada tela.</p>
            <a class="help-cta" href="ajuda.html"><i class="fas fa-book"></i> Abrir Manual e Ajuda</a>
        </div>
        <div class="help-section">
            <h3>Atalhos</h3>
            <div class="help-quick">
                <a href="ajuda.html#empresa">Empresa</a>
                <a href="ajuda.html#clientes">Clientes</a>
                <a href="ajuda.html#romaneios">Romaneios</a>
                <a href="ajuda.html#financas">Finanças</a>
                <a href="ajuda.html#estoque">Estoque</a>
                <a href="ajuda.html#folha">Folha</a>
            </div>
        </div>
    </div>
`;

const __siswebAboutModalTemplate = `
    <div class="about-content" role="dialog" aria-modal="true" aria-label="Sobre">
        <span class="close" onclick="window.closeAboutModal && window.closeAboutModal()">&times;</span>
        <h2>Sobre</h2>
        <div class="developer-card">
            <div class="developer-info">
                <div class="developer-avatar"><i class="fas fa-user"></i></div>
                <div class="developer-name">
                    <h3>Sisweb</h3>
                    <span>Sistema de Gestão</span>
                </div>
            </div>
            <div class="contact-info">
                <button type="button" class="about-support-button" onclick="window.showSupport && window.showSupport()"><i class="fas fa-headset"></i> Abrir suporte</button>
            </div>
            <div class="about-foot">© 2024 Sisweb. Todos os direitos reservados.</div>
        </div>
    </div>
`;

const __siswebSupportModalTemplate = `
    <div class="support-content" role="dialog" aria-modal="true" aria-label="Suporte Sisweb">
        <span class="close" onclick="window.closeSupportModal && window.closeSupportModal()">&times;</span>
        <h2><i class="fas fa-headset"></i> Suporte Sisweb</h2>
        <p class="support-lead">Abra um ticket, acompanhe respostas do Admin e mantenha o histórico da solicitação no próprio sistema.</p>
        <div class="support-mode-tabs" role="tablist" aria-label="Opções do suporte">
            <button type="button" id="siswebSupportNewTab" class="support-mode-tab active" onclick="window.switchSiswebSupportView && window.switchSiswebSupportView('new')"><i class="fas fa-plus-circle"></i> Novo ticket</button>
            <button type="button" id="siswebSupportListTab" class="support-mode-tab" onclick="window.switchSiswebSupportView && window.switchSiswebSupportView('tickets')"><i class="fas fa-comments"></i> Meus tickets</button>
        </div>
        <div id="siswebSupportNewPanel" class="support-panel active">
            <div id="siswebSupportContext" class="support-context"></div>
            <label for="siswebSupportMessage" class="support-label">Mensagem</label>
            <textarea id="siswebSupportMessage" rows="5" placeholder="Descreva o que aconteceu, qual funcionario/pedido/relatorio foi usado e o resultado esperado."></textarea>
            <div class="support-attachment-field">
                <label for="siswebSupportAttachments" class="support-label"><i class="fas fa-paperclip"></i> Anexos</label>
                <input type="file" id="siswebSupportAttachments" accept="image/png,image/jpeg,image/webp,image/gif,application/pdf" multiple>
                <div id="siswebSupportAttachmentsList" class="support-attachment-list">Opcional: ate 3 prints ou PDF, com tratamento para economizar armazenamento.</div>
            </div>
            <div class="support-actions">
                <button type="button" class="support-action support-ticket" onclick="window.sendSiswebSupportTicket && window.sendSiswebSupportTicket()"><i class="fas fa-paper-plane"></i> Enviar ticket</button>
                <button type="button" class="support-action support-whatsapp" onclick="window.sendSiswebSupportWhatsApp && window.sendSiswebSupportWhatsApp()"><i class="fab fa-whatsapp"></i> WhatsApp</button>
                <button type="button" class="support-action support-email" onclick="window.sendSiswebSupportEmail && window.sendSiswebSupportEmail()"><i class="fas fa-envelope"></i> E-mail</button>
                <button type="button" class="support-action support-copy" onclick="window.copySiswebSupportContext && window.copySiswebSupportContext()"><i class="fas fa-copy"></i> Copiar dados</button>
            </div>
        </div>
        <div id="siswebSupportTicketsPanel" class="support-panel">
            <div class="support-tickets-toolbar">
                <div>
                    <strong>Meus tickets</strong>
                    <span id="siswebSupportTicketsMeta">Carregando...</span>
                </div>
                <button type="button" class="support-action support-secondary" onclick="window.loadSiswebSupportTickets && window.loadSiswebSupportTickets()"><i class="fas fa-sync-alt"></i> Atualizar</button>
            </div>
            <div id="siswebSupportTicketsList" class="support-ticket-list">
                <div class="support-empty">Abra o suporte para carregar seus tickets.</div>
            </div>
            <div id="siswebSupportThreadPanel" class="support-thread-panel" hidden>
                <div class="support-thread-header">
                    <button type="button" class="support-link-button" onclick="window.clearSiswebSupportActiveTicket && window.clearSiswebSupportActiveTicket()"><i class="fas fa-arrow-left"></i> Voltar para lista</button>
                    <div id="siswebSupportThreadSummary"></div>
                </div>
                <div id="siswebSupportThread" class="support-thread"></div>
                <label for="siswebSupportReplyMessage" class="support-label">Responder neste ticket</label>
                <textarea id="siswebSupportReplyMessage" rows="4" placeholder="Digite uma resposta para o Admin..."></textarea>
                <div class="support-attachment-field">
                    <label for="siswebSupportReplyAttachments" class="support-label"><i class="fas fa-paperclip"></i> Anexos da resposta</label>
                    <input type="file" id="siswebSupportReplyAttachments" accept="image/png,image/jpeg,image/webp,image/gif,application/pdf" multiple>
                    <div id="siswebSupportReplyAttachmentsList" class="support-attachment-list">Opcional: ate 3 prints ou PDF.</div>
                </div>
                <div class="support-actions">
                    <button type="button" class="support-action support-ticket" onclick="window.sendSiswebSupportTicketReply && window.sendSiswebSupportTicketReply()"><i class="fas fa-reply"></i> Enviar resposta</button>
                    <button type="button" class="support-action support-secondary" onclick="window.closeSiswebSupportTicket && window.closeSiswebSupportTicket()"><i class="fas fa-check"></i> Marcar resolvido</button>
                </div>
            </div>
        </div>
        <div id="siswebSupportFeedback" class="support-feedback" role="status" aria-live="polite"></div>
    </div>
`;

const SISWEB_SUPPORT_DRAFT_PREFIX = 'siswebSupportDraft:v1:';
const SISWEB_SUPPORT_ATTACHMENT_MAX_FILES = 3;
const SISWEB_SUPPORT_ATTACHMENT_MAX_UPLOAD_BYTES = 6 * 1024 * 1024;
const SISWEB_SUPPORT_ATTACHMENT_MAX_IMAGE_SOURCE_BYTES = 12 * 1024 * 1024;
const SISWEB_SUPPORT_ATTACHMENT_ALLOWED_TYPES = /^(image\/(png|jpe?g|webp|gif)|application\/pdf)$/i;
let __siswebStorageServiceLoadPromise = null;

function __siswebEscapeHtml(value) {
    return String(value == null ? '' : value).replace(/[&<>"']/g, function(ch) {
        return ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[ch] || ch;
    });
}

function __siswebReadJsonStorage(keys) {
    const storageList = [];
    try { if (window.localStorage) storageList.push(window.localStorage); } catch (_) {}
    try { if (window.sessionStorage) storageList.push(window.sessionStorage); } catch (_) {}
    for (const storage of storageList) {
        for (const key of keys) {
            try {
                const raw = storage.getItem(key);
                if (!raw) continue;
                const parsed = JSON.parse(raw);
                if (parsed && typeof parsed === 'object') return parsed;
            } catch (_) {}
        }
    }
    return null;
}

function __siswebNormalizeModuleName(value) {
    let cleaned = String(value || '').replace(/\s+/g, ' ').trim();
    if (!cleaned) return '';
    if (/^(carregando|loading|aguarde)([\s\.\-…:]*)$/i.test(cleaned)) return '';
    cleaned = cleaned.replace(/^Sistema\s+de\s+Sistema\s+de\s+/i, 'Sistema de ');
    return cleaned;
}

function __siswebInferSupportModuleName() {
    const titlePart = __siswebNormalizeModuleName((document.title || '').split(' - ')[0]);
    if (titlePart) return titlePart;
    const selectors = ['h1.main-title', '.main-title', 'h1.page-title', '.page-title', 'h1'];
    for (const selector of selectors) {
        const el = document.querySelector(selector);
        const candidate = __siswebNormalizeModuleName(el && el.textContent);
        if (candidate) return candidate;
    }
    const pathName = (window.location.pathname || '').split('/').pop() || '';
    const fallbackName = pathName.replace('.html', '').replace(/[-_]/g, ' ').trim();
    return __siswebNormalizeModuleName(fallbackName) || 'Sisweb';
}

function __siswebGetSupportConfig() {
    const stored = __siswebReadJsonStorage(['siswebSupportConfig', 'supportConfig']) || {};
    const globalConfig = window.SISWEB_SUPPORT_CONFIG || window.siswebSupportConfig || {};
    const config = { ...stored, ...globalConfig };
    return {
        email: String(config.email || config.supportEmail || config.paymentSupportEmail || 'nedes1@hotmail.com').trim(),
        whatsapp: String(config.whatsapp || config.whatsappPhone || config.phone || '+5591991311049').trim(),
        whatsappDisplay: String(config.whatsappDisplay || config.phoneDisplay || '(91) 9 9131-1049').trim()
    };
}

function __siswebGetSupportContext() {
    const current = __siswebReadJsonStorage(['currentUser', 'user', 'siswebCurrentUser']) || {};
    const persistent = __siswebReadJsonStorage(['persistentUser', 'siswebPersistentUser']) || {};
    const company = __siswebReadJsonStorage(['company_info', 'currentCompany', 'siswebCurrentCompany']) || {};
    const companyId = String(
        current.companyId || current.companyID || current.tenantId ||
        persistent.companyId || persistent.companyID || persistent.tenantId ||
        company.companyId || company.companyID || company.tenantId || company.id ||
        window.appTenantId || ''
    ).trim();
    const userName = String(current.displayName || current.username || current.nome || persistent.displayName || persistent.username || persistent.nome || '').trim();
    const userEmail = String(current.email || persistent.email || '').trim();
    const uid = String(current.uid || current.id || persistent.uid || persistent.id || '').trim();
    return {
        moduleName: __siswebInferSupportModuleName(),
        url: window.location.href,
        path: window.location.pathname || '',
        companyId,
        userName,
        userEmail,
        uid,
        generatedAt: new Date().toLocaleString('pt-BR')
    };
}

function __siswebGetSupportDraftKey(ctx) {
    const companyPart = String((ctx && ctx.companyId) || 'sem-tenant').replace(/[^\w.-]+/g, '_').slice(0, 80);
    const pathPart = String((ctx && ctx.path) || 'inicio').replace(/[^\w.-]+/g, '_').slice(-120);
    return `${SISWEB_SUPPORT_DRAFT_PREFIX}${companyPart}:${pathPart}`;
}

function __siswebSaveSupportDraft(message, ctx) {
    const text = String(message || '').trim();
    if (!text) return;
    try {
        const supportCtx = ctx || __siswebGetSupportContext();
        window.localStorage.setItem(__siswebGetSupportDraftKey(supportCtx), JSON.stringify({
            message: text.slice(0, 2000),
            module: supportCtx.moduleName,
            companyId: supportCtx.companyId || '',
            path: supportCtx.path || '',
            updatedAt: new Date().toISOString()
        }));
    } catch (_) {}
}

function __siswebLoadSupportDraft(ctx) {
    try {
        const raw = window.localStorage.getItem(__siswebGetSupportDraftKey(ctx || __siswebGetSupportContext()));
        if (!raw) return null;
        const parsed = JSON.parse(raw);
        return parsed && typeof parsed.message === 'string' ? parsed : null;
    } catch (_) {
        return null;
    }
}

function __siswebClearSupportDraft(ctx) {
    try {
        window.localStorage.removeItem(__siswebGetSupportDraftKey(ctx || __siswebGetSupportContext()));
    } catch (_) {}
}

function __siswebRestoreSupportDraft(ctx) {
    const messageEl = document.getElementById('siswebSupportMessage');
    if (!messageEl || String(messageEl.value || '').trim()) return;
    const draft = __siswebLoadSupportDraft(ctx);
    if (!draft || !draft.message) return;
    messageEl.value = draft.message;
    __siswebSetSupportFeedback('Rascunho local restaurado. Envie quando estiver online.', '');
}

function __siswebBindSupportDraftAutosave() {
    const messageEl = document.getElementById('siswebSupportMessage');
    if (!messageEl || messageEl.dataset.supportDraftBound === 'true') return;
    messageEl.dataset.supportDraftBound = 'true';
    messageEl.addEventListener('input', function() {
        const text = String(messageEl.value || '').trim();
        const ctx = __siswebGetSupportContext();
        if (text) {
            __siswebSaveSupportDraft(text, ctx);
        } else {
            __siswebClearSupportDraft(ctx);
        }
    });
}

function __siswebRenderSupportContext() {
    const ctx = __siswebGetSupportContext();
    window.__siswebLastSupportContext = ctx;
    const contextEl = document.getElementById('siswebSupportContext');
    if (!contextEl) return ctx;
    const rows = [
        ['Módulo', ctx.moduleName],
        ['URL', ctx.url],
        ['Empresa/Tenant', ctx.companyId || 'não identificado'],
        ['Usuário', ctx.userName || ctx.userEmail || ctx.uid || 'não identificado'],
        ['Gerado em', ctx.generatedAt]
    ];
    contextEl.innerHTML = rows.map(function(row) {
        return `<div class="support-context-row"><strong>${__siswebEscapeHtml(row[0])}</strong><span>${__siswebEscapeHtml(row[1])}</span></div>`;
    }).join('');
    return ctx;
}

function __siswebSetSupportFeedback(message, type) {
    const feedback = document.getElementById('siswebSupportFeedback');
    if (!feedback) return;
    feedback.textContent = String(message || '');
    feedback.className = `support-feedback ${type || ''}`.trim();
}

function __siswebBuildSupportText() {
    const ctx = __siswebGetSupportContext();
    const messageEl = document.getElementById('siswebSupportMessage');
    const message = String((messageEl && messageEl.value) || '').trim();
    return [
        'Solicitação de suporte Sisweb',
        `Módulo: ${ctx.moduleName}`,
        `URL: ${ctx.url}`,
        `Empresa/Tenant: ${ctx.companyId || 'não identificado'}`,
        `Usuário: ${ctx.userName || ctx.userEmail || ctx.uid || 'não identificado'}`,
        `Gerado em: ${ctx.generatedAt}`,
        message ? `Mensagem: ${message}` : ''
    ].filter(Boolean).join('\n');
}

const __siswebSupportState = {
    tickets: [],
    activeTicketId: '',
    loadedAt: 0
};

function __siswebResolveRootScriptPath(fileName) {
    const normalized = String(fileName || '').replace(/^\/+/, '');
    if (window.location.protocol === 'http:' || window.location.protocol === 'https:') {
        return `/${normalized}`;
    }
    const isInSubfolder = (window.location.pathname || '').includes('/folha_pagamento/');
    return isInSubfolder ? `../${normalized}` : normalized;
}

async function __siswebResolveFirebaseService(requiredFunction) {
    const required = String(requiredFunction || '').trim();
    const current = window.firebaseService;
    if (current && (!required || typeof current[required] === 'function')) {
        return current;
    }

    try {
        const version = window.SiswebPWA && window.SiswebPWA.version ? String(window.SiswebPWA.version) : String(Date.now());
        const moduleUrl = `${__siswebResolveRootScriptPath('firebaseService.js')}?v=${encodeURIComponent(version)}`;
        const imported = await import(moduleUrl);
        const merged = { ...(window.firebaseService || {}), ...imported };
        if (imported && imported.authService) {
            merged.authService = imported.authService;
        }
        window.firebaseService = merged;
        if (!required || typeof merged[required] === 'function') {
            return merged;
        }
    } catch (error) {
        console.warn('[Suporte Sisweb] Falha ao carregar firebaseService atualizado:', error);
    }

    return null;
}

async function __siswebResolveSupportAuthUser(service) {
    try {
        const authService = service && service.authService ? service.authService : null;
        if (authService && typeof authService.getCurrentUser === 'function') {
            return await authService.getCurrentUser();
        }
        if (service && service.auth && service.auth.currentUser) {
            return service.auth.currentUser;
        }
    } catch (error) {
        console.warn('[Suporte Sisweb] Falha ao validar autenticação Firebase:', error);
    }
    return null;
}

function __siswebFormatBytes(bytes) {
    const value = Number(bytes || 0);
    if (!Number.isFinite(value) || value <= 0) return '';
    if (value >= 1024 * 1024) return `${(value / 1024 / 1024).toFixed(1)} MB`;
    return `${Math.max(1, Math.round(value / 1024))} KB`;
}

function __siswebSupportAttachmentIds(scope) {
    const isReply = scope === 'reply';
    return {
        input: isReply ? 'siswebSupportReplyAttachments' : 'siswebSupportAttachments',
        list: isReply ? 'siswebSupportReplyAttachmentsList' : 'siswebSupportAttachmentsList'
    };
}

function __siswebGetSelectedSupportFiles(scope) {
    const ids = __siswebSupportAttachmentIds(scope);
    const input = document.getElementById(ids.input);
    return input && input.files ? Array.from(input.files) : [];
}

function __siswebValidateSupportAttachmentFile(file) {
    if (!file) throw new Error('Arquivo de suporte não informado.');
    const type = String(file.type || '').toLowerCase();
    const size = Number(file.size || 0);
    if (!SISWEB_SUPPORT_ATTACHMENT_ALLOWED_TYPES.test(type)) {
        throw new Error(`Arquivo "${file.name || 'anexo'}" inválido. Use PNG, JPG, WEBP, GIF ou PDF.`);
    }
    if (type === 'application/pdf' && size > SISWEB_SUPPORT_ATTACHMENT_MAX_UPLOAD_BYTES) {
        throw new Error(`PDF "${file.name || 'anexo'}" acima de 6MB.`);
    }
    if (type.startsWith('image/') && size > SISWEB_SUPPORT_ATTACHMENT_MAX_IMAGE_SOURCE_BYTES) {
        throw new Error(`Imagem "${file.name || 'anexo'}" acima de 12MB.`);
    }
}

function __siswebRenderSelectedSupportAttachments(scope) {
    const ids = __siswebSupportAttachmentIds(scope);
    const listEl = document.getElementById(ids.list);
    if (!listEl) return;
    const files = __siswebGetSelectedSupportFiles(scope);
    if (!files.length) {
        listEl.textContent = scope === 'reply'
            ? 'Opcional: ate 3 prints ou PDF.'
            : 'Opcional: ate 3 prints ou PDF, com tratamento para economizar armazenamento.';
        listEl.classList.remove('has-files');
        return;
    }
    listEl.classList.add('has-files');
    listEl.innerHTML = files.map((file) => {
        const icon = String(file.type || '').toLowerCase() === 'application/pdf' ? 'fa-file-pdf' : 'fa-image';
        return `<span><i class="fas ${icon}"></i>${__siswebEscapeHtml(file.name || 'anexo')} <small>${__siswebEscapeHtml(__siswebFormatBytes(file.size))}</small></span>`;
    }).join('');
}

function __siswebBindSupportAttachmentInputs() {
    ['new', 'reply'].forEach((scope) => {
        const ids = __siswebSupportAttachmentIds(scope);
        const input = document.getElementById(ids.input);
        if (!input || input.dataset.supportAttachmentBound === 'true') return;
        input.dataset.supportAttachmentBound = 'true';
        input.addEventListener('change', function() {
            const files = __siswebGetSelectedSupportFiles(scope);
            try {
                if (files.length > SISWEB_SUPPORT_ATTACHMENT_MAX_FILES) {
                    throw new Error(`Selecione no máximo ${SISWEB_SUPPORT_ATTACHMENT_MAX_FILES} anexos por mensagem.`);
                }
                files.forEach(__siswebValidateSupportAttachmentFile);
                __siswebRenderSelectedSupportAttachments(scope);
            } catch (error) {
                input.value = '';
                __siswebRenderSelectedSupportAttachments(scope);
                __siswebSetSupportFeedback((error && error.message) || 'Anexo inválido.', 'error');
            }
        });
        __siswebRenderSelectedSupportAttachments(scope);
    });
}

function __siswebClearSupportAttachments(scope) {
    const ids = __siswebSupportAttachmentIds(scope);
    const input = document.getElementById(ids.input);
    if (input) input.value = '';
    __siswebRenderSelectedSupportAttachments(scope);
}

function __siswebLoadScriptOnce(src, id) {
    return new Promise((resolve, reject) => {
        const existing = document.getElementById(id);
        if (existing && existing.dataset.loaded === 'true') {
            resolve();
            return;
        }
        if (existing) {
            existing.addEventListener('load', () => resolve(), { once: true });
            existing.addEventListener('error', () => reject(new Error(`Falha ao carregar ${src}`)), { once: true });
            return;
        }
        const script = document.createElement('script');
        script.id = id;
        script.src = src;
        script.defer = true;
        script.onload = function() {
            script.dataset.loaded = 'true';
            resolve();
        };
        script.onerror = function() {
            reject(new Error(`Falha ao carregar ${src}`));
        };
        document.head.appendChild(script);
    });
}

async function __siswebResolveStorageService(service) {
    if (!window.firebaseService && service) window.firebaseService = service;
    if (window.storageService && typeof window.storageService.uploadSupportAttachment === 'function') {
        return window.storageService;
    }
    if (!__siswebStorageServiceLoadPromise) {
        const version = window.SiswebPWA && window.SiswebPWA.version ? String(window.SiswebPWA.version) : String(Date.now());
        const src = `${__siswebResolveRootScriptPath('storageService.js')}?v=${encodeURIComponent(version)}`;
        __siswebStorageServiceLoadPromise = __siswebLoadScriptOnce(src, 'sisweb-storage-service-script')
            .then(() => window.storageService || null)
            .catch((error) => {
                __siswebStorageServiceLoadPromise = null;
                throw error;
            });
    }
    const storageService = await __siswebStorageServiceLoadPromise;
    if (!storageService || typeof storageService.uploadSupportAttachment !== 'function') {
        throw new Error('Serviço de anexos de suporte indisponível.');
    }
    return storageService;
}

async function __siswebUploadSupportAttachments(scope, ctx, ticketId, role, service, authUser) {
    const files = __siswebGetSelectedSupportFiles(scope);
    if (!files.length) return [];
    if (__siswebIsPublicSupportMode()) {
        throw new Error('Anexos de ticket ficam disponíveis somente após login.');
    }
    if (files.length > SISWEB_SUPPORT_ATTACHMENT_MAX_FILES) {
        throw new Error(`Selecione no máximo ${SISWEB_SUPPORT_ATTACHMENT_MAX_FILES} anexos por mensagem.`);
    }
    files.forEach(__siswebValidateSupportAttachmentFile);
    const storageService = await __siswebResolveStorageService(service);
    const attachments = [];
    const uid = String((authUser && authUser.uid) || (ctx && ctx.uid) || '').trim();
    const companyId = String((ctx && ctx.companyId) || '').trim();
    for (let i = 0; i < files.length; i += 1) {
        const file = files[i];
        __siswebSetSupportFeedback(`Tratando e enviando anexo ${i + 1}/${files.length}...`, '');
        const meta = await storageService.uploadSupportAttachment(file, {
            companyId,
            uid,
            ticketId: ticketId || `novo-${Date.now()}`,
            role: role || 'customer'
        });
        attachments.push({
            name: meta.name || meta.fileName || file.name || `anexo-${i + 1}`,
            fileName: meta.fileName || meta.name || file.name || `anexo-${i + 1}`,
            url: meta.url || meta.downloadURL || '',
            downloadURL: meta.downloadURL || meta.url || '',
            storagePath: meta.storagePath || meta.path || '',
            contentType: meta.contentType || file.type || '',
            size: Number(meta.size || file.size || 0),
            originalSize: Number(meta.originalSize || file.size || 0),
            compressed: meta.compressed === true,
            uploadedAt: meta.uploadedAt || new Date().toISOString()
        });
    }
    return attachments;
}

function __siswebNormalizeSupportAttachmentsForRender(value) {
    return (Array.isArray(value) ? value : [])
        .map((item) => item && typeof item === 'object' ? item : null)
        .filter(Boolean)
        .filter((item) => String(item.url || item.downloadURL || '').trim());
}

function __siswebRenderSupportAttachments(attachments) {
    const list = __siswebNormalizeSupportAttachmentsForRender(attachments);
    if (!list.length) return null;
    const wrap = document.createElement('div');
    wrap.className = 'support-message-attachments';
    list.forEach((attachment, index) => {
        const url = String(attachment.url || attachment.downloadURL || '').trim();
        const contentType = String(attachment.contentType || '').toLowerCase();
        const link = document.createElement('a');
        link.href = url;
        link.target = '_blank';
        link.rel = 'noopener noreferrer';
        link.className = 'support-attachment-link';
        const icon = document.createElement('i');
        icon.className = contentType === 'application/pdf' ? 'fas fa-file-pdf' : 'fas fa-image';
        const span = document.createElement('span');
        span.textContent = attachment.name || attachment.fileName || `Anexo ${index + 1}`;
        link.appendChild(icon);
        link.appendChild(span);
        const sizeLabel = __siswebFormatBytes(attachment.size);
        if (sizeLabel) {
            const small = document.createElement('small');
            small.textContent = sizeLabel;
            link.appendChild(small);
        }
        wrap.appendChild(link);
    });
    return wrap;
}

function __siswebSupportResultData(result) {
    if (result && result.data && typeof result.data === 'object') return result.data;
    return result && typeof result === 'object' ? result : {};
}

function __siswebSupportStatusLabel(status) {
    const key = String(status || '').toLowerCase();
    const labels = {
        open: 'Aberto',
        waiting_support: 'Aguardando suporte',
        waiting_customer: 'Aguardando você',
        resolved: 'Resolvido',
        closed: 'Fechado'
    };
    return labels[key] || 'Aberto';
}

function __siswebSupportPriorityLabel(priority) {
    const key = String(priority || '').toLowerCase();
    const labels = {
        low: 'Baixa',
        normal: 'Normal',
        high: 'Alta',
        critical: 'Crítica'
    };
    return labels[key] || 'Normal';
}

function __siswebIsPublicSupportMode() {
    return window.__siswebSupportPublicMode === true;
}

function __siswebSupportDateLabel(value) {
    if (!value) return '-';
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return String(value);
    return date.toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' });
}

function __siswebRenderSupportMessage(message) {
    const role = String((message && message.authorRole) || '').toLowerCase();
    const isSupport = role === 'superadmin' || role === 'support';
    const isInternal = String((message && message.visibility) || '') === 'internal';
    const item = document.createElement('div');
    item.className = `support-message${isInternal ? ' internal' : (isSupport ? ' support' : ' customer')}`;
    const meta = document.createElement('div');
    meta.className = 'support-message-meta';
    const author = document.createElement('span');
    author.textContent = `${(message && (message.authorName || message.authorEmail || message.authorRole)) || 'Usuário'}${isInternal ? ' • nota interna' : ''}`;
    const date = document.createElement('span');
    date.textContent = __siswebSupportDateLabel(message && message.createdAt);
    const text = document.createElement('div');
    text.className = 'support-message-text';
    text.textContent = (message && message.message) || '';
    meta.appendChild(author);
    meta.appendChild(date);
    item.appendChild(meta);
    item.appendChild(text);
    const attachments = __siswebRenderSupportAttachments(message && message.attachments);
    if (attachments) item.appendChild(attachments);
    return item;
}

function __siswebSetSupportTicketsMeta(text) {
    const meta = document.getElementById('siswebSupportTicketsMeta');
    if (meta) meta.textContent = String(text || '');
}

function __siswebRenderSupportTicketsList(items) {
    const listEl = document.getElementById('siswebSupportTicketsList');
    if (!listEl) return;
    const list = Array.isArray(items) ? items : [];
    __siswebSetSupportTicketsMeta(`${list.length} ticket${list.length === 1 ? '' : 's'}`);
    listEl.innerHTML = '';
    if (!list.length) {
        const empty = document.createElement('div');
        empty.className = 'support-empty';
        empty.textContent = 'Nenhum ticket aberto ainda. Crie um novo ticket para falar com o Admin.';
        listEl.appendChild(empty);
        return;
    }
    list.forEach((ticket) => {
        const card = document.createElement('button');
        card.type = 'button';
        card.className = 'support-ticket-card';
        card.dataset.ticketId = String(ticket.id || '');
        const status = document.createElement('span');
        status.className = `support-ticket-status status-${String(ticket.status || 'open').replace(/[^\w-]+/g, '')}`;
        status.textContent = __siswebSupportStatusLabel(ticket.status);
        const title = document.createElement('strong');
        title.textContent = ticket.subject || 'Suporte Sisweb';
        const meta = document.createElement('small');
        meta.textContent = `${ticket.module || 'Sisweb'} • ${__siswebSupportDateLabel(ticket.updatedAt || ticket.createdAt)} • ${__siswebSupportPriorityLabel(ticket.priority)}`;
        const preview = document.createElement('span');
        preview.className = 'support-ticket-card-preview';
        preview.textContent = ticket.lastMessagePreview || 'Sem prévia de mensagem.';
        card.appendChild(status);
        card.appendChild(title);
        card.appendChild(meta);
        card.appendChild(preview);
        card.addEventListener('click', function() {
            __siswebOpenSupportTicket(String(ticket.id || ''));
        });
        listEl.appendChild(card);
    });
}

function __siswebClearSupportActiveTicket() {
    __siswebSupportState.activeTicketId = '';
    const panel = document.getElementById('siswebSupportThreadPanel');
    if (panel) panel.hidden = true;
    const reply = document.getElementById('siswebSupportReplyMessage');
    if (reply) reply.value = '';
}

function __siswebSwitchSupportView(view) {
    const next = __siswebIsPublicSupportMode() ? 'new' : (view === 'tickets' ? 'tickets' : 'new');
    const newPanel = document.getElementById('siswebSupportNewPanel');
    const ticketsPanel = document.getElementById('siswebSupportTicketsPanel');
    const newTab = document.getElementById('siswebSupportNewTab');
    const ticketsTab = document.getElementById('siswebSupportListTab');
    if (newPanel) newPanel.classList.toggle('active', next === 'new');
    if (ticketsPanel) ticketsPanel.classList.toggle('active', next === 'tickets');
    if (newTab) newTab.classList.toggle('active', next === 'new');
    if (ticketsTab) ticketsTab.classList.toggle('active', next === 'tickets');
    if (!__siswebIsPublicSupportMode() && next === 'tickets' && (!__siswebSupportState.loadedAt || Date.now() - __siswebSupportState.loadedAt > 30000)) {
        __siswebLoadMySupportTickets({ silent: true });
    }
}

async function __siswebLoadMySupportTickets(options) {
    const listEl = document.getElementById('siswebSupportTicketsList');
    if (__siswebIsPublicSupportMode()) {
        if (listEl) listEl.innerHTML = '<div class="support-empty">Histórico de tickets disponível após registro e login.</div>';
        __siswebSetSupportTicketsMeta('registro necessário');
        return;
    }
    const service = await __siswebResolveFirebaseService('listMySupportTickets');
    if (!service || typeof service.listMySupportTickets !== 'function') {
        if (listEl) listEl.innerHTML = '<div class="support-empty">Histórico indisponível. Atualize o sistema ou use WhatsApp/e-mail.</div>';
        __siswebSetSupportTicketsMeta('indisponível');
        return;
    }
    const authUser = await __siswebResolveSupportAuthUser(service);
    if (!authUser) {
        if (listEl) listEl.innerHTML = '<div class="support-empty">Entre novamente no Sisweb para carregar seus tickets com segurança.</div>';
        __siswebSetSupportTicketsMeta('login necessário');
        return;
    }
    if (listEl) listEl.innerHTML = '<div class="support-empty">Carregando seus tickets...</div>';
    __siswebSetSupportTicketsMeta('Carregando...');
    try {
        const result = await service.listMySupportTickets({ limit: 30 });
        const data = __siswebSupportResultData(result);
        if (!result || result.success === false || data.success === false) {
            throw new Error((result && result.error) || (data && data.error) || 'Falha ao carregar tickets.');
        }
        __siswebSupportState.tickets = Array.isArray(data.items) ? data.items : [];
        __siswebSupportState.loadedAt = Date.now();
        __siswebRenderSupportTicketsList(__siswebSupportState.tickets);
        if (!options || !options.silent) __siswebSetSupportFeedback('Tickets atualizados.', 'success');
    } catch (error) {
        if (listEl) listEl.innerHTML = `<div class="support-empty">${__siswebEscapeHtml((error && error.message) || 'Erro ao carregar tickets.')}</div>`;
        __siswebSetSupportTicketsMeta('erro');
        if (!options || !options.silent) __siswebSetSupportFeedback((error && error.message) || 'Erro ao carregar tickets.', 'error');
    }
}

function __siswebRenderSupportThread(ticket, messages) {
    const panel = document.getElementById('siswebSupportThreadPanel');
    const summary = document.getElementById('siswebSupportThreadSummary');
    const thread = document.getElementById('siswebSupportThread');
    if (panel) panel.hidden = false;
    if (summary) {
        summary.innerHTML = `
            <strong>${__siswebEscapeHtml(ticket.subject || 'Suporte Sisweb')}</strong>
            <span>${__siswebEscapeHtml(__siswebSupportStatusLabel(ticket.status))} • ${__siswebEscapeHtml(ticket.module || 'Sisweb')} • ${__siswebEscapeHtml(__siswebSupportDateLabel(ticket.updatedAt || ticket.createdAt))}</span>
        `;
    }
    if (!thread) return;
    thread.innerHTML = '';
    const list = Array.isArray(messages) ? messages : [];
    if (!list.length) {
        const empty = document.createElement('div');
        empty.className = 'support-empty';
        empty.textContent = 'Nenhuma mensagem encontrada para este ticket.';
        thread.appendChild(empty);
    } else {
        list.forEach((message) => thread.appendChild(__siswebRenderSupportMessage(message)));
    }
    thread.scrollTop = thread.scrollHeight;
}

async function __siswebOpenSupportTicket(ticketId) {
    const safeTicketId = String(ticketId || '').trim();
    if (!safeTicketId) return;
    const service = await __siswebResolveFirebaseService('getSupportTicket');
    if (!service || typeof service.getSupportTicket !== 'function') {
        __siswebSetSupportFeedback('Serviço de ticket indisponível.', 'error');
        return;
    }
    __siswebSupportState.activeTicketId = safeTicketId;
    const thread = document.getElementById('siswebSupportThread');
    if (thread) thread.innerHTML = '<div class="support-empty">Carregando conversa...</div>';
    try {
        const result = await service.getSupportTicket(safeTicketId);
        const data = __siswebSupportResultData(result);
        if (!result || result.success === false || data.success === false || !data.ticket) {
            throw new Error((result && result.error) || (data && data.error) || 'Falha ao abrir ticket.');
        }
        __siswebRenderSupportThread(data.ticket, Array.isArray(data.messages) ? data.messages : []);
    } catch (error) {
        __siswebSetSupportFeedback((error && error.message) || 'Erro ao abrir ticket.', 'error');
    }
}

async function __siswebSendSupportTicketReply() {
    const ticketId = __siswebSupportState.activeTicketId;
    const reply = document.getElementById('siswebSupportReplyMessage');
    const message = String((reply && reply.value) || '').trim();
    const service = await __siswebResolveFirebaseService('addSupportTicketMessage');
    const files = __siswebGetSelectedSupportFiles('reply');
    if (!ticketId) {
        __siswebSetSupportFeedback('Selecione um ticket antes de responder.', 'error');
        return;
    }
    if ((!message || message.length < 2) && !files.length) {
        __siswebSetSupportFeedback('Digite uma resposta ou anexe um print antes de enviar.', 'error');
        if (reply && typeof reply.focus === 'function') reply.focus();
        return;
    }
    if (!service || typeof service.addSupportTicketMessage !== 'function') {
        __siswebSetSupportFeedback('Serviço de resposta indisponível.', 'error');
        return;
    }
    const authUser = await __siswebResolveSupportAuthUser(service);
    if (!authUser) {
        __siswebSetSupportFeedback('Entre novamente no Sisweb para responder com segurança.', 'error');
        return;
    }
    try {
        const ctx = __siswebGetSupportContext();
        const attachments = await __siswebUploadSupportAttachments('reply', ctx, ticketId, 'customer', service, authUser);
        __siswebSetSupportFeedback('Enviando resposta...', '');
        const result = await service.addSupportTicketMessage(ticketId, message || 'Anexo enviado para análise.', { visibility: 'customer', attachments });
        const data = __siswebSupportResultData(result);
        if (!result || result.success === false || data.success === false) {
            throw new Error((result && result.error) || (data && data.error) || 'Falha ao enviar resposta.');
        }
        if (reply) reply.value = '';
        __siswebClearSupportAttachments('reply');
        __siswebSetSupportFeedback('Resposta enviada para o Admin.', 'success');
        await __siswebLoadMySupportTickets({ silent: true });
        await __siswebOpenSupportTicket(ticketId);
    } catch (error) {
        __siswebSetSupportFeedback((error && error.message) || 'Erro ao responder ticket.', 'error');
    }
}

async function __siswebCloseSupportTicket() {
    const ticketId = __siswebSupportState.activeTicketId;
    const service = await __siswebResolveFirebaseService('updateSupportTicketStatus');
    if (!ticketId) {
        __siswebSetSupportFeedback('Selecione um ticket antes de marcar como resolvido.', 'error');
        return;
    }
    if (!service || typeof service.updateSupportTicketStatus !== 'function') {
        __siswebSetSupportFeedback('Serviço de status indisponível.', 'error');
        return;
    }
    try {
        const result = await service.updateSupportTicketStatus(ticketId, { status: 'closed' });
        const data = __siswebSupportResultData(result);
        if (!result || result.success === false || data.success === false) {
            throw new Error((result && result.error) || (data && data.error) || 'Falha ao fechar ticket.');
        }
        __siswebSetSupportFeedback('Ticket marcado como resolvido.', 'success');
        await __siswebLoadMySupportTickets({ silent: true });
        await __siswebOpenSupportTicket(ticketId);
    } catch (error) {
        __siswebSetSupportFeedback((error && error.message) || 'Erro ao fechar ticket.', 'error');
    }
}

function ensureSystemHelpModal() {
    let helpModal = document.getElementById('helpModal');
    if (!helpModal) {
        helpModal = document.createElement('div');
        helpModal.id = 'helpModal';
        helpModal.className = 'help-modal';
        helpModal.innerHTML = __siswebHelpModalTemplate;
        document.body.appendChild(helpModal);
    }
    let helpStyle = document.getElementById('sisweb-help-modal-style');
    if (!helpStyle) {
        helpStyle = document.createElement('style');
        helpStyle.id = 'sisweb-help-modal-style';
        helpStyle.textContent = `
            #helpModal {
                position: fixed;
                inset: 0;
                display: none;
                align-items: center;
                justify-content: center;
                background: rgba(15, 23, 42, 0.55);
                z-index: 2147483647 !important;
                padding: 18px;
            }
            #helpModal .help-content {
                width: min(720px, calc(100vw - 24px));
                max-height: min(80vh, 860px);
                overflow: auto;
                background: #ffffff;
                border-radius: 14px;
                box-shadow: 0 14px 40px rgba(0,0,0,0.35);
                padding: 16px;
                position: relative;
            }
            #helpModal .close {
                position: absolute;
                top: 10px;
                right: 12px;
                width: 34px;
                height: 34px;
                border-radius: 10px;
                display: inline-flex;
                align-items: center;
                justify-content: center;
                cursor: pointer;
                font-size: 22px;
                line-height: 1;
                color: #0f172a;
                background: #f1f5f9;
            }
            #helpModal .close:hover { background: #e2e8f0; }
            #helpModal .help-cta {
                display: inline-flex;
                align-items: center;
                gap: 8px;
                padding: 10px 12px;
                border-radius: 10px;
                border: 1px solid #dbeafe;
                background: #eff6ff;
                color: #1d4ed8;
                text-decoration: none;
                font-weight: 600;
                margin-top: 6px;
            }
            #helpModal .help-cta:hover { background: #dbeafe; }
            #helpModal .help-quick {
                display: flex;
                flex-wrap: wrap;
                gap: 8px;
                margin-top: 8px;
            }
            #helpModal .help-quick a {
                display: inline-flex;
                padding: 7px 10px;
                border-radius: 999px;
                border: 1px solid #e5e7eb;
                background: #f8fafc;
                color: #0f172a;
                text-decoration: none;
                font-size: 12px;
            }
            #helpModal .help-quick a:hover { background: #eef2ff; }
            #helpModal .help-gallery {
                display: grid;
                grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));
                gap: 12px;
                margin-top: 10px;
            }
            #helpModal .help-shot {
                margin: 0;
                border: 1px solid #e5e7eb;
                border-radius: 10px;
                overflow: hidden;
                background: #fff;
            }
            #helpModal .help-shot img {
                width: 100%;
                height: 120px;
                object-fit: cover;
                display: block;
                background: #f8fafc;
            }
            #helpModal .help-shot figcaption {
                padding: 8px;
                font-size: 12px;
                color: #334155;
            }
        `;
        document.head.appendChild(helpStyle);
    }
    return helpModal;
}

function ensureSystemAboutModal() {
    let aboutModal = document.getElementById('aboutModal');
    if (!aboutModal) {
        aboutModal = document.createElement('div');
        aboutModal.id = 'aboutModal';
        aboutModal.className = 'about-modal';
        aboutModal.innerHTML = __siswebAboutModalTemplate;
        document.body.appendChild(aboutModal);
    }
    let aboutStyle = document.getElementById('sisweb-about-modal-style');
    if (!aboutStyle) {
        aboutStyle = document.createElement('style');
        aboutStyle.id = 'sisweb-about-modal-style';
        aboutStyle.textContent = `
            #aboutModal {
                position: fixed;
                inset: 0;
                display: none;
                align-items: center;
                justify-content: center;
                background: rgba(15, 23, 42, 0.55);
                z-index: 2147483647 !important;
                padding: 18px;
            }
            #aboutModal .about-content {
                width: min(640px, calc(100vw - 24px));
                max-height: min(80vh, 820px);
                overflow: auto;
                background: #ffffff;
                border-radius: 14px;
                box-shadow: 0 14px 40px rgba(0,0,0,0.35);
                padding: 16px;
                position: relative;
            }
            #aboutModal .close {
                position: absolute;
                top: 10px;
                right: 12px;
                width: 34px;
                height: 34px;
                border-radius: 10px;
                display: inline-flex;
                align-items: center;
                justify-content: center;
                cursor: pointer;
                font-size: 22px;
                line-height: 1;
                color: #0f172a;
                background: #f1f5f9;
            }
            #aboutModal .close:hover { background: #e2e8f0; }
            #aboutModal .developer-card { border: 1px solid #e5e7eb; border-radius: 12px; padding: 14px; background: #fff; }
            #aboutModal .developer-info { display: flex; gap: 12px; align-items: center; margin-bottom: 10px; }
            #aboutModal .developer-avatar { width: 46px; height: 46px; border-radius: 12px; display: flex; align-items: center; justify-content: center; background: #eff6ff; color: #2563eb; }
            #aboutModal .developer-name h3 { margin: 0; font-size: 16px; color: #0f172a; }
            #aboutModal .developer-name span { color: #64748b; font-size: 12px; }
            #aboutModal .contact-info { display: grid; gap: 8px; }
            #aboutModal .contact-item { display: flex; gap: 10px; align-items: center; font-size: 13px; color: #0f172a; }
            #aboutModal .contact-item i { color: #64748b; }
            #aboutModal .contact-item a { color: #2563eb; text-decoration: none; }
            #aboutModal .contact-item a:hover { text-decoration: underline; }
            #aboutModal .about-support-button {
                border: 0;
                border-radius: 10px;
                padding: 10px 12px;
                cursor: pointer;
                display: inline-flex;
                align-items: center;
                justify-content: center;
                gap: 8px;
                font-weight: 700;
                color: #ffffff;
                background: #1d4ed8;
            }
            #aboutModal .about-foot { margin-top: 10px; font-size: 12px; color: #64748b; }
        `;
        document.head.appendChild(aboutStyle);
    }
    return aboutModal;
}

function ensureSystemSupportModal() {
    let supportModal = document.getElementById('supportModal');
    if (!supportModal) {
        supportModal = document.createElement('div');
        supportModal.id = 'supportModal';
        supportModal.className = 'support-modal';
        supportModal.innerHTML = __siswebSupportModalTemplate;
        document.body.appendChild(supportModal);
    }
    let supportStyle = document.getElementById('sisweb-support-modal-style');
    if (!supportStyle) {
        supportStyle = document.createElement('style');
        supportStyle.id = 'sisweb-support-modal-style';
        supportStyle.textContent = `
            #supportModal {
                position: fixed;
                inset: 0;
                display: none;
                align-items: center;
                justify-content: center;
                background: rgba(15, 23, 42, 0.55);
                z-index: 2147483647 !important;
                padding: 18px;
            }
            #supportModal .support-content {
                width: min(680px, calc(100vw - 24px));
                max-height: min(86vh, 820px);
                overflow: auto;
                background: #ffffff;
                border-radius: 14px;
                box-shadow: 0 14px 40px rgba(0,0,0,0.35);
                padding: 18px;
                position: relative;
            }
            #supportModal .close {
                position: absolute;
                top: 10px;
                right: 12px;
                width: 34px;
                height: 34px;
                border-radius: 10px;
                display: inline-flex;
                align-items: center;
                justify-content: center;
                cursor: pointer;
                font-size: 22px;
                line-height: 1;
                color: #0f172a;
                background: #f1f5f9;
            }
            #supportModal .close:hover { background: #e2e8f0; }
            #supportModal h2 {
                display: flex;
                align-items: center;
                gap: 10px;
                margin: 0 44px 8px 0;
                color: #0f172a;
                font-size: 20px;
            }
            #supportModal .support-lead {
                margin: 0 0 12px;
                color: #475569;
                font-size: 14px;
            }
            #supportModal .support-mode-tabs {
                display: grid;
                grid-template-columns: repeat(2, minmax(0, 1fr));
                gap: 8px;
                margin: 0 0 12px;
                padding: 4px;
                border: 1px solid #e2e8f0;
                border-radius: 12px;
                background: #f8fafc;
            }
            #supportModal .support-mode-tab {
                border: 0;
                border-radius: 9px;
                padding: 10px 12px;
                cursor: pointer;
                display: inline-flex;
                align-items: center;
                justify-content: center;
                gap: 8px;
                color: #334155;
                background: transparent;
                font-weight: 700;
            }
            #supportModal .support-mode-tab.active {
                color: #ffffff;
                background: #1d4ed8;
                box-shadow: 0 6px 16px rgba(29, 78, 216, 0.18);
            }
            #supportModal .support-panel {
                display: none;
            }
            #supportModal .support-panel.active {
                display: block;
            }
            #supportModal .support-context {
                display: grid;
                gap: 7px;
                padding: 12px;
                border: 1px solid #e2e8f0;
                border-radius: 10px;
                background: #f8fafc;
                margin-bottom: 12px;
            }
            #supportModal .support-context-row {
                display: grid;
                grid-template-columns: minmax(110px, 0.34fr) minmax(0, 1fr);
                gap: 10px;
                font-size: 13px;
                color: #334155;
            }
            #supportModal .support-context-row strong { color: #0f172a; }
            #supportModal .support-context-row span {
                overflow-wrap: anywhere;
                word-break: break-word;
            }
            #supportModal .support-label {
                display: block;
                margin-bottom: 6px;
                color: #0f172a;
                font-weight: 700;
                font-size: 13px;
            }
            #supportModal textarea {
                width: 100%;
                min-height: 128px;
                resize: vertical;
                box-sizing: border-box;
                border: 1px solid #cbd5e1;
                border-radius: 10px;
                padding: 10px 12px;
                font: 14px/1.45 Arial, sans-serif;
                color: #0f172a;
                background: #ffffff;
            }
            #supportModal textarea:focus {
                border-color: #2563eb;
                outline: 2px solid rgba(37, 99, 235, 0.18);
            }
            #supportModal .support-attachment-field {
                margin-top: 10px;
                padding: 10px;
                border: 1px dashed #cbd5e1;
                border-radius: 10px;
                background: #f8fafc;
            }
            #supportModal.support-public-mode .support-attachment-field {
                display: none !important;
            }
            #supportModal .support-attachment-field input[type="file"] {
                width: 100%;
                font-size: 13px;
                color: #334155;
            }
            #supportModal .support-attachment-list {
                display: flex;
                flex-wrap: wrap;
                gap: 6px;
                margin-top: 7px;
                color: #64748b;
                font-size: 12px;
            }
            #supportModal .support-attachment-list.has-files span {
                display: inline-flex;
                align-items: center;
                gap: 5px;
                max-width: 100%;
                border: 1px solid #dbeafe;
                border-radius: 999px;
                background: #eff6ff;
                color: #1e40af;
                padding: 4px 8px;
                overflow-wrap: anywhere;
            }
            #supportModal .support-attachment-list small {
                color: #64748b;
            }
            #supportModal .support-actions {
                display: flex;
                flex-wrap: wrap;
                gap: 8px;
                margin-top: 12px;
            }
            #supportModal .support-action {
                border: 0;
                border-radius: 10px;
                padding: 10px 12px;
                cursor: pointer;
                display: inline-flex;
                align-items: center;
                gap: 8px;
                font-weight: 700;
                color: #ffffff;
                background: #334155;
            }
            #supportModal .support-action:hover { filter: brightness(0.96); }
            #supportModal .support-ticket { background: #0f766e; }
            #supportModal .support-whatsapp { background: #15803d; }
            #supportModal .support-email { background: #1d4ed8; }
            #supportModal .support-copy { background: #475569; }
            #supportModal .support-secondary { background: #64748b; }
            #supportModal .support-tickets-toolbar {
                display: flex;
                align-items: center;
                justify-content: space-between;
                gap: 10px;
                margin-bottom: 10px;
            }
            #supportModal .support-tickets-toolbar strong {
                display: block;
                color: #0f172a;
                font-size: 14px;
            }
            #supportModal .support-tickets-toolbar span {
                display: block;
                margin-top: 2px;
                color: #64748b;
                font-size: 12px;
            }
            #supportModal .support-ticket-list {
                display: grid;
                gap: 8px;
                max-height: 220px;
                overflow: auto;
                padding-right: 2px;
                margin-bottom: 12px;
            }
            #supportModal .support-ticket-card {
                width: 100%;
                text-align: left;
                border: 1px solid #e2e8f0;
                border-radius: 12px;
                background: #ffffff;
                padding: 10px 12px;
                cursor: pointer;
                display: grid;
                gap: 4px;
                color: #0f172a;
            }
            #supportModal .support-ticket-card:hover {
                border-color: #93c5fd;
                background: #f8fbff;
            }
            #supportModal .support-ticket-status {
                width: fit-content;
                border-radius: 999px;
                padding: 3px 8px;
                background: #e0f2fe;
                color: #0369a1;
                font-size: 11px;
                font-weight: 800;
            }
            #supportModal .support-ticket-status.status-waiting_customer { background: #fef3c7; color: #92400e; }
            #supportModal .support-ticket-status.status-waiting_support { background: #dbeafe; color: #1d4ed8; }
            #supportModal .support-ticket-status.status-closed,
            #supportModal .support-ticket-status.status-resolved { background: #dcfce7; color: #166534; }
            #supportModal .support-ticket-card small {
                color: #64748b;
                line-height: 1.35;
            }
            #supportModal .support-ticket-card-preview {
                color: #334155;
                font-size: 13px;
                line-height: 1.35;
                overflow-wrap: anywhere;
            }
            #supportModal .support-empty {
                border: 1px dashed #cbd5e1;
                border-radius: 12px;
                padding: 12px;
                color: #64748b;
                background: #f8fafc;
                font-size: 13px;
            }
            #supportModal .support-thread-panel {
                border: 1px solid #e2e8f0;
                border-radius: 12px;
                background: #f8fafc;
                padding: 12px;
            }
            #supportModal .support-thread-header {
                display: grid;
                gap: 8px;
                margin-bottom: 10px;
            }
            #supportModal .support-thread-header strong {
                display: block;
                color: #0f172a;
                overflow-wrap: anywhere;
            }
            #supportModal .support-thread-header span {
                display: block;
                margin-top: 2px;
                color: #64748b;
                font-size: 12px;
            }
            #supportModal .support-link-button {
                width: fit-content;
                border: 0;
                background: transparent;
                color: #1d4ed8;
                cursor: pointer;
                font-weight: 700;
                padding: 0;
            }
            #supportModal .support-thread {
                display: grid;
                gap: 8px;
                max-height: 260px;
                overflow: auto;
                margin-bottom: 12px;
                padding-right: 2px;
            }
            #supportModal .support-message {
                border: 1px solid #e5e7eb;
                border-radius: 12px;
                padding: 9px 10px;
                background: #ffffff;
            }
            #supportModal .support-message.support {
                background: #eff6ff;
                border-color: #bfdbfe;
            }
            #supportModal .support-message.customer {
                background: #f0fdf4;
                border-color: #bbf7d0;
            }
            #supportModal .support-message.internal {
                display: none;
            }
            #supportModal .support-message-meta {
                display: flex;
                justify-content: space-between;
                gap: 8px;
                color: #64748b;
                font-size: 11px;
                margin-bottom: 5px;
            }
            #supportModal .support-message-text {
                white-space: pre-wrap;
                overflow-wrap: anywhere;
                color: #0f172a;
                font-size: 13px;
                line-height: 1.45;
            }
            #supportModal .support-message-attachments {
                display: flex;
                flex-wrap: wrap;
                gap: 6px;
                margin-top: 8px;
            }
            #supportModal .support-attachment-link {
                display: inline-flex;
                align-items: center;
                gap: 6px;
                max-width: 100%;
                border: 1px solid #bfdbfe;
                border-radius: 999px;
                background: #ffffff;
                color: #1d4ed8;
                padding: 5px 8px;
                font-size: 12px;
                font-weight: 700;
                text-decoration: none;
                overflow-wrap: anywhere;
            }
            #supportModal .support-attachment-link:hover {
                background: #eff6ff;
            }
            #supportModal .support-attachment-link small {
                color: #64748b;
                font-weight: 600;
            }
            #supportModal .support-feedback {
                min-height: 18px;
                margin-top: 10px;
                font-size: 13px;
                color: #475569;
            }
            #supportModal .support-feedback.success { color: #15803d; }
            #supportModal .support-feedback.error { color: #b91c1c; }
            #aboutModal .about-support-button {
                border: 0;
                border-radius: 10px;
                padding: 10px 12px;
                cursor: pointer;
                display: inline-flex;
                align-items: center;
                justify-content: center;
                gap: 8px;
                font-weight: 700;
                color: #ffffff;
                background: #1d4ed8;
            }
            @media (max-width: 520px) {
                #supportModal {
                    align-items: stretch;
                    padding: 10px;
                }
                #supportModal .support-content {
                    width: 100%;
                    max-height: calc(100vh - 20px);
                    border-radius: 10px;
                    padding: 14px;
                }
                #supportModal .support-context-row {
                    grid-template-columns: 1fr;
                    gap: 3px;
                }
                #supportModal .support-actions {
                    display: grid;
                    grid-template-columns: 1fr;
                }
                #supportModal .support-action {
                    justify-content: center;
                    min-height: 44px;
                }
                #supportModal .support-mode-tabs,
                #supportModal .support-tickets-toolbar,
                #supportModal .support-message-meta {
                    grid-template-columns: 1fr;
                    display: grid;
                }
                #supportModal .support-tickets-toolbar .support-action {
                    width: 100%;
                }
                #supportModal .support-ticket-list,
                #supportModal .support-thread {
                    max-height: 30vh;
                }
            }
        `;
        document.head.appendChild(supportStyle);
    }
    __siswebRenderSupportContext();
    return supportModal;
}

function __siswebInitGlobalModals() {
    try {
        if (typeof window.switchSiswebSupportView !== 'function') {
            window.switchSiswebSupportView = __siswebSwitchSupportView;
        }
        if (typeof window.loadSiswebSupportTickets !== 'function') {
            window.loadSiswebSupportTickets = function() { return __siswebLoadMySupportTickets(); };
        }
        if (typeof window.clearSiswebSupportActiveTicket !== 'function') {
            window.clearSiswebSupportActiveTicket = __siswebClearSupportActiveTicket;
        }
        if (typeof window.sendSiswebSupportTicketReply !== 'function') {
            window.sendSiswebSupportTicketReply = __siswebSendSupportTicketReply;
        }
        if (typeof window.closeSiswebSupportTicket !== 'function') {
            window.closeSiswebSupportTicket = __siswebCloseSupportTicket;
        }
        if (typeof window.showAbout !== 'function') {
            window.showAbout = function() {
                const aboutModal = ensureSystemAboutModal();
                if (aboutModal) aboutModal.style.display = 'block';
            };
        }
        if (typeof window.closeAboutModal !== 'function') {
            window.closeAboutModal = function() {
                const aboutModal = ensureSystemAboutModal();
                if (aboutModal) aboutModal.style.display = 'none';
            };
        }
        if (typeof window.showSupport !== 'function') {
            window.showSupport = function() {
                const aboutModal = document.getElementById('aboutModal');
                if (aboutModal) aboutModal.style.display = 'none';
                const supportModal = ensureSystemSupportModal();
                if (supportModal) supportModal.classList.toggle('support-public-mode', __siswebIsPublicSupportMode());
                const ctx = __siswebRenderSupportContext();
                __siswebBindSupportDraftAutosave();
                __siswebBindSupportAttachmentInputs();
                __siswebRestoreSupportDraft(ctx);
                __siswebSwitchSupportView('new');
                if (supportModal) supportModal.style.display = 'flex';
                if (!__siswebIsPublicSupportMode()) {
                    setTimeout(function() { __siswebLoadMySupportTickets({ silent: true }); }, 80);
                }
                const messageEl = document.getElementById('siswebSupportMessage');
                if (messageEl && typeof messageEl.focus === 'function') {
                    setTimeout(function() { try { messageEl.focus(); } catch (_) {} }, 80);
                }
            };
        }
        if (typeof window.closeSupportModal !== 'function') {
            window.closeSupportModal = function() {
                const supportModal = ensureSystemSupportModal();
                if (supportModal) supportModal.style.display = 'none';
            };
        }
        if (typeof window.sendSiswebSupportWhatsApp !== 'function') {
            window.sendSiswebSupportWhatsApp = function() {
                const config = __siswebGetSupportConfig();
                const phone = String(config.whatsapp || '').replace(/\D+/g, '');
                if (!phone) {
                    __siswebSetSupportFeedback('WhatsApp de suporte não configurado.', 'error');
                    return;
                }
                const text = __siswebBuildSupportText();
                window.open(`https://wa.me/${phone}?text=${encodeURIComponent(text)}`, '_blank', 'noopener,noreferrer');
                __siswebSetSupportFeedback(`Abrindo WhatsApp ${config.whatsappDisplay || config.whatsapp}.`, 'success');
            };
        }
        if (typeof window.sendSiswebSupportTicket !== 'function') {
            window.sendSiswebSupportTicket = async function() {
                if (__siswebIsPublicSupportMode()) {
                    __siswebSetSupportFeedback('Para abrir ticket com histórico, registre-se ou entre no Sisweb. Visitantes podem usar WhatsApp, e-mail ou copiar os dados.', 'error');
                    return;
                }
                const service = await __siswebResolveFirebaseService('createSupportTicket');
                if (!service || typeof service.createSupportTicket !== 'function') {
                    __siswebSetSupportFeedback('Envio de ticket indisponível. Use WhatsApp, e-mail ou copie os dados.', 'error');
                    return;
                }
                const authUser = await __siswebResolveSupportAuthUser(service);
                if (!authUser) {
                    __siswebSetSupportFeedback('Entre novamente no Sisweb para enviar ticket com segurança.', 'error');
                    return;
                }
                const messageEl = document.getElementById('siswebSupportMessage');
                const message = String((messageEl && messageEl.value) || '').trim();
                const files = __siswebGetSelectedSupportFiles('new');
                if ((!message || message.length < 4) && !files.length) {
                    __siswebSetSupportFeedback('Descreva a necessidade ou anexe um print antes de enviar o ticket.', 'error');
                    if (messageEl && typeof messageEl.focus === 'function') messageEl.focus();
                    return;
                }
                const ctx = __siswebGetSupportContext();
                if (window.navigator && window.navigator.onLine === false) {
                    __siswebSaveSupportDraft(message, ctx);
                    __siswebSetSupportFeedback('Sem conexão agora. Rascunho salvo neste dispositivo para envio posterior.', 'error');
                    return;
                }
                const button = document.querySelector('#supportModal .support-ticket');
                if (button) {
                    button.disabled = true;
                    button.dataset.originalText = button.textContent || 'Enviar ticket';
                    button.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Enviando';
                }
                __siswebSetSupportFeedback('Enviando ticket de suporte...', '');
                try {
                    const attachments = await __siswebUploadSupportAttachments('new', ctx, '', 'customer', service, authUser);
                    const result = await service.createSupportTicket({
                        subject: `Suporte - ${ctx.moduleName}`,
                        message: message || 'Anexo enviado para análise.',
                        module: ctx.moduleName,
                        path: ctx.path,
                        url: ctx.url,
                        companyId: ctx.companyId || '',
                        attachments,
                        clientContext: {
                            displayMode: (window.matchMedia && window.matchMedia('(display-mode: standalone)').matches) ? 'standalone' : 'browser',
                            viewport: `${window.innerWidth || 0}x${window.innerHeight || 0}`,
                            userAgent: window.navigator && window.navigator.userAgent ? window.navigator.userAgent : '',
                            platform: window.navigator && window.navigator.platform ? window.navigator.platform : '',
                            language: window.navigator && window.navigator.language ? window.navigator.language : ''
                        }
                    });
                    if (!result || result.success === false) {
                        throw new Error((result && result.error) || 'Falha ao enviar ticket.');
                    }
                    const ticketId = result.data && (result.data.ticketId || (result.data.ticket && result.data.ticket.id));
                    __siswebSetSupportFeedback(`Ticket enviado com sucesso${ticketId ? `: ${ticketId}` : ''}.`, 'success');
                    if (messageEl) messageEl.value = '';
                    __siswebClearSupportAttachments('new');
                    __siswebClearSupportDraft(ctx);
                    await __siswebLoadMySupportTickets({ silent: true });
                    if (ticketId) {
                        __siswebSwitchSupportView('tickets');
                        await __siswebOpenSupportTicket(ticketId);
                    }
                } catch (error) {
                    __siswebSaveSupportDraft(message, ctx);
                    __siswebSetSupportFeedback((error && error.message) || 'Não foi possível enviar o ticket.', 'error');
                } finally {
                    if (button) {
                        button.disabled = false;
                        button.innerHTML = '<i class="fas fa-paper-plane"></i> Enviar ticket';
                    }
                }
            };
        }
        if (typeof window.sendSiswebSupportEmail !== 'function') {
            window.sendSiswebSupportEmail = async function() {
                const config = __siswebGetSupportConfig();
                if (!config.email) {
                    __siswebSetSupportFeedback('E-mail de suporte não configurado.', 'error');
                    return;
                }
                const ctx = __siswebGetSupportContext();
                const subject = `Suporte Sisweb - ${ctx.moduleName}`;
                const body = __siswebBuildSupportText();
                if (__siswebIsPublicSupportMode()) {
                    const messageEl = document.getElementById('siswebSupportMessage');
                    const message = String((messageEl && messageEl.value) || '').trim();
                    if (!message || message.length < 8) {
                        __siswebSetSupportFeedback('Descreva sua dúvida antes de enviar o e-mail.', 'error');
                        if (messageEl && typeof messageEl.focus === 'function') messageEl.focus();
                        return;
                    }
                    const service = await __siswebResolveFirebaseService('sendPublicSupportEmail');
                    if (!service || typeof service.sendPublicSupportEmail !== 'function') {
                        __siswebSetSupportFeedback('Envio direto indisponível. Use WhatsApp ou copie os dados.', 'error');
                        return;
                    }
                    const button = document.querySelector('#supportModal .support-email');
                    if (button) {
                        button.disabled = true;
                        button.dataset.originalText = button.textContent || 'E-mail';
                        button.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Enviando';
                    }
                    __siswebSetSupportFeedback('Enviando e-mail para o Admin...', '');
                    try {
                        const result = await service.sendPublicSupportEmail({
                            source: 'subscription-public',
                            module: ctx.moduleName || 'Assinatura pública',
                            subject,
                            message,
                            url: ctx.url,
                            path: ctx.path,
                            promoCode: (new URLSearchParams(window.location.search || '')).get('cupom') || '',
                            clientFingerprint: `${window.innerWidth || 0}x${window.innerHeight || 0}:${navigator.language || ''}`,
                            clientContext: {
                                displayMode: (window.matchMedia && window.matchMedia('(display-mode: standalone)').matches) ? 'standalone' : 'browser',
                                viewport: `${window.innerWidth || 0}x${window.innerHeight || 0}`,
                                userAgent: window.navigator && window.navigator.userAgent ? window.navigator.userAgent : '',
                                platform: window.navigator && window.navigator.platform ? window.navigator.platform : '',
                                language: window.navigator && window.navigator.language ? window.navigator.language : ''
                            },
                            website: ''
                        });
                        if (!result || result.success === false || (result.data && result.data.success === false)) {
                            throw new Error((result && result.error) || (result && result.data && result.data.error) || 'Falha ao enviar e-mail.');
                        }
                        __siswebClearSupportDraft(ctx);
                        __siswebSetSupportFeedback('E-mail enviado ao Admin com sucesso. Você também pode registrar-se para acompanhar tickets com histórico.', 'success');
                    } catch (error) {
                        __siswebSaveSupportDraft(message, ctx);
                        __siswebSetSupportFeedback((error && error.message) || 'Não foi possível enviar o e-mail agora.', 'error');
                    } finally {
                        if (button) {
                            button.disabled = false;
                            button.innerHTML = '<i class="fas fa-envelope"></i> E-mail';
                        }
                    }
                    return;
                }
                window.location.href = `mailto:${config.email}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
                __siswebSetSupportFeedback(`Abrindo e-mail para ${config.email}.`, 'success');
            };
        }
        if (typeof window.copySiswebSupportContext !== 'function') {
            window.copySiswebSupportContext = async function() {
                const text = __siswebBuildSupportText();
                try {
                    if (navigator.clipboard && typeof navigator.clipboard.writeText === 'function') {
                        await navigator.clipboard.writeText(text);
                        __siswebSetSupportFeedback('Dados de suporte copiados.', 'success');
                        return;
                    }
                } catch (_) {}
                const tmp = document.createElement('textarea');
                tmp.value = text;
                tmp.setAttribute('readonly', 'readonly');
                tmp.style.position = 'fixed';
                tmp.style.opacity = '0';
                document.body.appendChild(tmp);
                tmp.select();
                try {
                    document.execCommand('copy');
                    __siswebSetSupportFeedback('Dados de suporte copiados.', 'success');
                } catch (_) {
                    __siswebSetSupportFeedback('Não foi possível copiar automaticamente.', 'error');
                }
                document.body.removeChild(tmp);
            };
        }
        if (typeof window.showHelp !== 'function') {
            window.showHelp = function() {
                const helpModal = ensureSystemHelpModal();
                if (helpModal) helpModal.style.display = 'block';
            };
        }
        if (typeof window.closeHelpModal !== 'function') {
            window.closeHelpModal = function() {
                const helpModal = ensureSystemHelpModal();
                if (helpModal) helpModal.style.display = 'none';
            };
        }
        if (typeof window.logout !== 'function') {
            window.logout = async function() {
                return performSafeLogout('logout_fallback');
            };
        }
        if (!window.__siswebGlobalModalsBound) {
            window.__siswebGlobalModalsBound = true;
            window.addEventListener('click', function(event) {
                const aboutModal = document.getElementById('aboutModal');
                const helpModal = document.getElementById('helpModal');
                const supportModal = document.getElementById('supportModal');
                if (aboutModal && event.target === aboutModal) aboutModal.style.display = 'none';
                if (helpModal && event.target === helpModal) helpModal.style.display = 'none';
                if (supportModal && event.target === supportModal) supportModal.style.display = 'none';
            });
            window.addEventListener('keydown', function(e) {
                if (!e || e.key !== 'Escape') return;
                const aboutModal = document.getElementById('aboutModal');
                const helpModal = document.getElementById('helpModal');
                const supportModal = document.getElementById('supportModal');
                if (aboutModal && aboutModal.style.display === 'block') aboutModal.style.display = 'none';
                if (helpModal && helpModal.style.display === 'block') helpModal.style.display = 'none';
                if (supportModal && supportModal.style.display !== 'none') supportModal.style.display = 'none';
            });
        }
    } catch (_) {}
}

if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', __siswebInitGlobalModals);
} else {
    __siswebInitGlobalModals();
}

(function() {
    if (window.__siswebFooterBootstrap) return;
    window.__siswebFooterBootstrap = true;
    function normalizeModuleName(value) {
        return __siswebNormalizeModuleName(value);
    }
    function inferModuleName() {
        const titlePart = normalizeModuleName((document.title || '').split(' - ')[0]);
        if (titlePart) return titlePart;
        const selectors = ['h1.main-title', '.main-title', 'h1.page-title', '.page-title', 'h1'];
        for (const selector of selectors) {
            const el = document.querySelector(selector);
            const candidate = normalizeModuleName(el && el.textContent);
            if (candidate) return candidate;
        }
        const pathName = (window.location.pathname || '').split('/').pop() || '';
        const fallbackName = pathName.replace('.html', '').replace(/[-_]/g, ' ').trim();
        return normalizeModuleName(fallbackName) || 'Módulo';
    }
    function setFooterModuleName(footer) {
        const node = footer && footer.querySelector('.global-footer-module');
        if (node) node.textContent = inferModuleName();
    }
    function bindFooterContact(footer) {
        if (!footer) return;
        const contact = footer.querySelector('.global-footer-contact');
        if (!contact || contact.dataset.bound === '1') return;
        contact.dataset.bound = '1';
        contact.addEventListener('click', function(e) {
            e.preventDefault();
            if (typeof window.showSupport === 'function') window.showSupport();
        });
    }
    function bindFooterTitleObserver(footer) {
        if (!footer || window.__siswebFooterTitleObserverBound) return;
        window.__siswebFooterTitleObserverBound = true;
        const update = function() { setFooterModuleName(footer); };
        const titleEl = document.querySelector('head > title');
        if (titleEl && window.MutationObserver) {
            const observer = new MutationObserver(update);
            observer.observe(titleEl, { childList: true, subtree: true, characterData: true });
        }
        setTimeout(update, 300);
        setTimeout(update, 1200);
    }
    function ensureFooter() {
        if (!document || !document.body) return;
        const existingFooter = document.querySelector('.global-system-footer');
        if (existingFooter) {
            setFooterModuleName(existingFooter);
            bindFooterContact(existingFooter);
            bindFooterTitleObserver(existingFooter);
            return;
        }
        const legacyFooter = Array.from(document.querySelectorAll('footer, .footer')).find((el) => /direitos reservados/i.test(el.textContent || ''));
        const style = document.createElement('style');
        style.id = 'global-system-footer-style';
        style.textContent = `
            .global-system-footer {
                margin-top: 28px;
                padding: 18px 12px 10px;
                text-align: center;
                border-top: 1px solid #e5e7eb;
                color: #6b7280;
                font-size: 13px;
                line-height: 1.6;
                background: transparent;
            }
            .global-system-footer a {
                color: #1d4ed8;
                text-decoration: none;
                font-weight: 600;
            }
            .global-system-footer a:hover { text-decoration: underline; }
            @media print {
                .global-system-footer { display: none !important; }
            }
        `;
        if (!document.getElementById(style.id)) document.head.appendChild(style);
        const footer = legacyFooter || document.createElement('footer');
        footer.className = 'global-system-footer';
        footer.removeAttribute('style');
        footer.innerHTML = `
            <p>&copy; 2024 <span class="global-footer-module"></span>. Todos os direitos reservados.</p>
            <p>Desenvolvido por Nelson Brito <a href="#" class="global-footer-contact">Fale Conosco</a>.</p>
        `;
        setFooterModuleName(footer);
        bindFooterContact(footer);
        bindFooterTitleObserver(footer);
        if (!legacyFooter) document.body.appendChild(footer);
    }
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', ensureFooter);
    else ensureFooter();
})();
