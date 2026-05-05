// Verificar se a classe já foi definida para evitar redefinição
// Menu Component v2.3 - Correção navegação submenus - 2025-01-08 15:45
// Force cache break: 20250108154500
// CORREÇÃO: Força navegação manual dos links dos submenus para evitar preventDefault fantasma
if (!customElements.get('main-menu')) {
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

        buildSettingsGreetingHtml() {
            const greetingName = this.getFirstName();
            const visual = this.getSubscriptionVisualState();
            const tone = String(visual && visual.tone ? visual.tone : 'yellow');
            const summary = String(visual && visual.summary ? visual.summary : this.getSubscriptionSummaryText());
            return `<i class="fas fa-user"></i><span class="greeting-name">Olá ${greetingName}</span><span class="greeting-meta"><span class="subscription-inline"><span class="subscription-indicator subscription-${tone}"></span>${summary}</span></span>`;
        }

        async refreshSettingsUserInfo() {
            try {
                await this.hydrateCurrentSessionProfile();
            } catch (_) {}
            try {
                const node = this.querySelector('.settings-dropdown .user-info span');
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
                    .menu-item-container {
                        position: relative;
                        display: inline-block;
                    }
                    
                    .dropdown-content {
                        display: none;
                        position: absolute;
                        top: 100%;
                        left: 0;
                        background-color: #f9f9f9;
                        min-width: 180px;
                        box-shadow: 0px 8px 16px 0px rgba(0,0,0,0.2);
                        z-index: 999;
                        border-radius: 4px;
                        margin-top: 5px;
                    }

                    .alerts-dropdown { position: relative; }
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
                    
                    .dropdown-content a {
                        color: #2c3e50;
                        padding: 12px 16px;
                        text-decoration: none;
                        display: block;
                        font-weight: normal;
                    }
                    
                    .dropdown-content a:hover {
                        background-color: #f1f1f1;
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
                        max-width: 205px;
                        vertical-align: middle;
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
                </style>
                <button class="menu-toggle" id="menuToggleBtn"><i class="fas fa-bars"></i></button>
                <div class="sidebar-overlay" id="sidebarOverlay"></div>
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
                    
                    <div class="alerts-dropdown">
                        <div class="menu-item-trigger" style="display:flex; align-items:center; gap:8px; cursor:pointer;">
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
                        <div class="menu-item-trigger" style="display:flex; align-items:center; gap:8px; cursor:pointer;">
                            <i class="fas fa-cog settings-icon"></i>
                            <span class="menu-label-mobile" style="display:none; color:white; font-family:Arial;">Configurações</span>
                        </div>
                        <div class="dropdown-content">
                            <div class="user-info">
                                <span>${greetingHtml}</span>
                            </div>
                            ${showBusinessModules ? `
                            <a href="${this.resolveUrl('user-profile.html')}"><i class="fas fa-user-edit"></i> Meu Perfil</a>
                            ${isAdmin ? `<a href="${this.resolveUrl('admin.html?tab=status')}"><i class="fas fa-tools"></i> Diagnóstico / Migração</a>` : ''}
                            <a href="${this.resolveUrl('subscription-status.html')}"><i class="fas fa-star"></i> Assinatura</a>
                            <a href="${this.resolveUrl('company.html')}"><i class="fas fa-building"></i> Empresa</a>
                            <a href="${this.resolveUrl('ajuda.html')}" class="help-page-link"><i class="fas fa-book-open"></i> Ajuda</a>
                            <a href="#" class="about-link"><i class="fas fa-info-circle"></i> Sobre</a>
                            ` : ''}
                            ${isAdmin ? `
                            <div class="admin-section">
                                ${adminContext.canDashboard ? `<a href="${this.resolveUrl('admin.html?tab=dashboard')}" class="admin-link"><i class="fas fa-shield-alt"></i> Painel Admin</a>` : ''}
                                ${adminContext.canSubscriptions ? `<a href="${this.resolveUrl('admin.html?tab=subscriptions')}" class="admin-link"><i class="fas fa-clipboard-list"></i> Gerenciar Assinaturas</a>` : ''}
                                ${adminContext.canSettings ? `<a href="${this.resolveUrl('admin.html?tab=settings')}" class="admin-link"><i class="fas fa-user-cog"></i> Configurações Admin</a>` : ''}
                                ${(adminContext.canSettings || adminContext.canDashboard || adminContext.canSubscriptions) ? `<a href="${this.resolveUrl('admin-access-governance.html')}" class="admin-link"><i class="fas fa-user-shield"></i> Governança de Acesso</a>` : ''}
                                ${''}
                            </div>
                            ` : ''}
                            <div class="user-info">
                                <a href="#" class="logout-link"><i class="fas fa-sign-out-alt"></i> Sair</a>
                            </div>
                        </div>
                    </div>
                </div>
            `;

            // Configurar eventos de dropdown
            this.setupDropdowns();
            this.setupMobileSidebar();
            
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
            const settingsIcon = this.querySelector('.settings-icon');
            const settingsDropdown = this.querySelector('.settings-dropdown .dropdown-content');
            if (settingsIcon && settingsDropdown) {
                settingsIcon.addEventListener('click', function(e) {
                    e.preventDefault();
                    e.stopPropagation();
                    
                    // Fechar outros dropdowns
                    document.querySelectorAll('.dropdown-content.show-dropdown').forEach(d => {
                        if (d !== settingsDropdown) {
                            d.classList.remove('show-dropdown');
                        }
                    });
                    
                    settingsDropdown.classList.toggle('show-dropdown');
                });
            }

            const alertsIcon = this.querySelector('.alerts-icon');
            const alertsDropdown = this.querySelector('.alerts-panel');
            if (alertsIcon && alertsDropdown) {
                alertsIcon.addEventListener('click', (e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    document.querySelectorAll('.dropdown-content.show-dropdown').forEach(d => {
                        if (d !== alertsDropdown) d.classList.remove('show-dropdown');
                    });
                    alertsDropdown.classList.toggle('show-dropdown');

                    if (alertsDropdown.classList.contains('show-dropdown')) {
                        try { this.recomputeSystemAlerts(); } catch (_) {}
                        try { this.renderAlerts(); } catch (_) {}
                    }
                });
            }

            // Logout
            const logoutLink = this.querySelector('.logout-link');
            if (logoutLink) {
                logoutLink.addEventListener('click', async function(e) {
                    e.preventDefault();
                    await performSafeLogout('logout_menu');
                });
            }

            // About
            const aboutLink = this.querySelector('.about-link');
            if (aboutLink) {
                aboutLink.addEventListener('click', function(e) {
                    e.preventDefault();
                    if (typeof window.showAbout === 'function') {
                        window.showAbout();
                    } else {
                        alert('Informações sobre o sistema não disponíveis no momento.');
                    }
                });
            }

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
                    }
                    if (alertsDropdown) {
                        alertsDropdown.classList.remove('show-dropdown');
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
            setTimeout(() => this.refreshSettingsUserInfo(), 800);
            setTimeout(() => this.refreshSettingsUserInfo(), 2000);
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
                    return { isAdmin: true, canDashboard: true, canSubscriptions: true, canSettings: true };
                }
                const users = JSON.parse(localStorage.getItem('users') || '[]');
                const userDetails = users.find((u) => (u.uid || u.id || u.userId) === uid || (currentUser && u.email === currentUser.email));
                const userPerms = userDetails && userDetails.adminPermissions ? userDetails.adminPermissions : {};
                const hasUserPermissions = !!(userPerms.dashboard || userPerms.subscriptions || userPerms.settings);
                if (hasUserPermissions && userDetails.adminActive !== false) {
                    return {
                        isAdmin: true,
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
                        canDashboard: rolePerms.dashboard === true,
                        canSubscriptions: rolePerms.subscriptions === true,
                        canSettings: rolePerms.settings === true
                    };
                }
                return { isAdmin: false, canDashboard: false, canSubscriptions: false, canSettings: false };
            } catch (error) {
                console.error('Erro ao verificar permissões de admin:', error);
                return { isAdmin: false, canDashboard: false, canSubscriptions: false, canSettings: false };
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
                    const messageHtml = href
                        ? `<a class="alerts-item-message" href="${href.replace(/"/g,'&quot;')}">${message}</a>`
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
            return { isAdmin, uid: uid || 'anon', tenantId: tenantId || 'default' };
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
                    const res = await window.firebaseService.loadFromFirebase(path);
                    return res && res.success ? res.data : (res && res.data ? res.data : res);
                }
            } catch (_) {}
            return null;
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
                const func2 = await this.loadNamespaced('folha/funcionarios') || [];
                const funcionariosRaw = [...this.normalizeArrayLike(func1), ...this.normalizeArrayLike(func2)];
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
                <div class="contact-item"><i class="fas fa-envelope"></i><a href="mailto:nedes1@hotmail.com">nedes1@hotmail.com</a></div>
                <div class="contact-item"><i class="fas fa-phone"></i><a href="tel:+5591991311049">(91) 9 9131-1049</a></div>
            </div>
            <div class="about-foot">© 2024 Sisweb. Todos os direitos reservados.</div>
        </div>
    </div>
`;

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
            #aboutModal .about-foot { margin-top: 10px; font-size: 12px; color: #64748b; }
        `;
        document.head.appendChild(aboutStyle);
    }
    return aboutModal;
}

function __siswebInitGlobalModals() {
    try {
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
                if (aboutModal && event.target === aboutModal) aboutModal.style.display = 'none';
                if (helpModal && event.target === helpModal) helpModal.style.display = 'none';
            });
            window.addEventListener('keydown', function(e) {
                if (!e || e.key !== 'Escape') return;
                const aboutModal = document.getElementById('aboutModal');
                const helpModal = document.getElementById('helpModal');
                if (aboutModal && aboutModal.style.display === 'block') aboutModal.style.display = 'none';
                if (helpModal && helpModal.style.display === 'block') helpModal.style.display = 'none';
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
        const cleaned = String(value || '').replace(/\s+/g, ' ').trim();
        if (!cleaned) return '';
        if (/^(carregando|loading|aguarde)([\s\.\-…:]*)$/i.test(cleaned)) return '';
        return cleaned;
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
            const aboutLink = document.querySelector('a.about-link');
            if (aboutLink) {
                e.preventDefault();
                aboutLink.click();
            }
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
            <p>&copy; 2024 Sistema de <span class="global-footer-module"></span>. Todos os direitos reservados.</p>
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
