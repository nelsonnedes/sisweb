// ============================================================================
// ADMIN UI COMPONENTS
// ============================================================================
// Substituição de alerts, prompts e confirms nativos por modais modernos assíncronos.

window.AdminUI = (function() {
    
    function createOverlay() {
        const overlay = document.createElement('div');
        overlay.className = 'modal-overlay';
        overlay.style.zIndex = '9999'; // Acima de outros modais
        return overlay;
    }

    function createContainer() {
        const container = document.createElement('div');
        container.className = 'modal-container';
        container.style.maxWidth = '400px';
        container.style.textAlign = 'center';
        return container;
    }

    function createTitle(text) {
        const title = document.createElement('h3');
        title.className = 'modal-title';
        title.style.marginBottom = '12px';
        title.style.borderBottom = 'none';
        title.textContent = text;
        return title;
    }

    function createBody(text) {
        const body = document.createElement('p');
        body.className = 'modal-body';
        body.style.marginBottom = '24px';
        body.textContent = text;
        return body;
    }

    function createActionsContainer() {
        const actions = document.createElement('div');
        actions.className = 'modal-actions';
        actions.style.justifyContent = 'center';
        return actions;
    }

    function mountAndShow(overlay) {
        document.body.appendChild(overlay);
        // Force reflow
        void overlay.offsetWidth;
        overlay.classList.add('active');
    }

    function unmount(overlay) {
        overlay.classList.remove('active');
        setTimeout(() => {
            if (document.body.contains(overlay)) {
                document.body.removeChild(overlay);
            }
        }, 200);
    }

    return {
        alert: function(message, title = 'Aviso') {
            return new Promise((resolve) => {
                const overlay = createOverlay();
                const container = createContainer();
                
                const titleEl = createTitle(title);
                const bodyEl = createBody(message);
                const actions = createActionsContainer();
                
                const btnOk = document.createElement('button');
                btnOk.className = 'btn primary';
                btnOk.textContent = 'OK';
                btnOk.onclick = () => {
                    unmount(overlay);
                    resolve();
                };
                
                actions.appendChild(btnOk);
                container.appendChild(titleEl);
                container.appendChild(bodyEl);
                container.appendChild(actions);
                overlay.appendChild(container);
                
                mountAndShow(overlay);
            });
        },

        confirm: function(message, title = 'Confirmação') {
            return new Promise((resolve) => {
                const overlay = createOverlay();
                const container = createContainer();
                
                const titleEl = createTitle(title);
                const bodyEl = createBody(message);
                const actions = createActionsContainer();
                
                const btnCancel = document.createElement('button');
                btnCancel.className = 'btn';
                btnCancel.textContent = 'Cancelar';
                btnCancel.onclick = () => {
                    unmount(overlay);
                    resolve(false);
                };
                
                const btnConfirm = document.createElement('button');
                btnConfirm.className = 'btn primary';
                btnConfirm.textContent = 'Confirmar';
                btnConfirm.onclick = () => {
                    unmount(overlay);
                    resolve(true);
                };
                
                actions.appendChild(btnCancel);
                actions.appendChild(btnConfirm);
                container.appendChild(titleEl);
                container.appendChild(bodyEl);
                container.appendChild(actions);
                overlay.appendChild(container);
                
                mountAndShow(overlay);
            });
        },

        prompt: function(message, defaultValue = '', title = 'Entrada necessária') {
            return new Promise((resolve) => {
                const overlay = createOverlay();
                const container = createContainer();
                
                const titleEl = createTitle(title);
                const bodyEl = createBody(message);
                
                const input = document.createElement('input');
                input.type = 'text';
                input.className = 'modal-field-value';
                input.style.width = '100%';
                input.style.boxSizing = 'border-box';
                input.style.marginBottom = '24px';
                input.style.background = '#ffffff';
                input.value = defaultValue;
                
                const actions = createActionsContainer();
                
                const btnCancel = document.createElement('button');
                btnCancel.className = 'btn';
                btnCancel.textContent = 'Cancelar';
                btnCancel.onclick = () => {
                    unmount(overlay);
                    resolve(null);
                };
                
                const btnConfirm = document.createElement('button');
                btnConfirm.className = 'btn primary';
                btnConfirm.textContent = 'Confirmar';
                btnConfirm.onclick = () => {
                    unmount(overlay);
                    resolve(input.value);
                };
                
                actions.appendChild(btnCancel);
                actions.appendChild(btnConfirm);
                container.appendChild(titleEl);
                container.appendChild(bodyEl);
                container.appendChild(input);
                container.appendChild(actions);
                overlay.appendChild(container);
                
                mountAndShow(overlay);
                input.focus();
            });
        },

        toast: function(message, type = 'info') {
            let container = document.getElementById('admin-toast-container');
            if (!container) {
                container = document.createElement('div');
                container.id = 'admin-toast-container';
                container.className = 'toast-container';
                document.body.appendChild(container);
            }

            const safeType = ['success', 'error', 'warning', 'info'].includes(type) ? type : 'info';
            const toast = document.createElement('div');
            toast.className = `toast toast-${safeType}`;

            let iconClass = 'fa-info-circle';
            let title = 'Informação';
            if (safeType === 'success') { iconClass = 'fa-check-circle'; title = 'Sucesso'; }
            if (safeType === 'error') { iconClass = 'fa-exclamation-circle'; title = 'Erro'; }
            if (safeType === 'warning') { iconClass = 'fa-exclamation-triangle'; title = 'Aviso'; }

            const iconWrapper = document.createElement('div');
            iconWrapper.className = 'toast-icon';
            const icon = document.createElement('i');
            icon.className = `fas ${iconClass}`;
            iconWrapper.appendChild(icon);

            const content = document.createElement('div');
            content.className = 'toast-content';
            const titleEl = document.createElement('div');
            titleEl.className = 'toast-title';
            titleEl.textContent = title;
            const messageEl = document.createElement('div');
            messageEl.className = 'toast-message';
            messageEl.textContent = String(message == null ? '' : message);
            content.appendChild(titleEl);
            content.appendChild(messageEl);

            const closeButton = document.createElement('button');
            closeButton.className = 'toast-close';
            closeButton.type = 'button';
            closeButton.setAttribute('aria-label', 'Fechar notificação');
            const closeIcon = document.createElement('i');
            closeIcon.className = 'fas fa-times';
            closeButton.appendChild(closeIcon);

            toast.appendChild(iconWrapper);
            toast.appendChild(content);
            toast.appendChild(closeButton);

            container.appendChild(toast);

            const closeBtn = closeButton;
            let hideTimeout;

            const removeToast = () => {
                toast.classList.add('toast-hide');
                setTimeout(() => {
                    if (toast.parentElement) toast.parentElement.removeChild(toast);
                }, 300);
            };

            closeBtn.onclick = () => {
                clearTimeout(hideTimeout);
                removeToast();
            };

            hideTimeout = setTimeout(removeToast, safeType === 'error' ? 5000 : 3000);
        },

        modal: function(options) {
            return new Promise((resolve) => {
                const overlay = createOverlay();
                
                const container = document.createElement('div');
                container.className = 'modal-container';
                container.style.width = options.width || '500px';
                container.style.maxWidth = '95%';
                container.style.maxHeight = '90vh';
                container.style.overflowY = 'auto';
                container.style.textAlign = 'left';
                container.style.position = 'relative';
                
                const closeBtnTop = document.createElement('button');
                closeBtnTop.innerHTML = '<i class="fas fa-times"></i>';
                closeBtnTop.style.cssText = 'position:absolute;top:15px;right:15px;background:none;border:none;font-size:20px;cursor:pointer;color:#64748b;';
                closeBtnTop.onclick = () => { unmount(overlay); resolve('close'); };
                container.appendChild(closeBtnTop);
                
                const titleEl = createTitle(options.title || '');
                titleEl.style.paddingRight = '30px';
                
                const bodyContainer = document.createElement('div');
                bodyContainer.style.marginBottom = '24px';
                if (typeof options.body === 'string') {
                    bodyContainer.innerHTML = options.body;
                } else if (options.body instanceof Node) {
                    bodyContainer.appendChild(options.body);
                }
                
                const actions = createActionsContainer();
                actions.style.justifyContent = 'flex-end';
                
                if (Array.isArray(options.actions)) {
                    options.actions.forEach(act => {
                        const btn = document.createElement('button');
                        btn.className = act.className || 'btn';
                        btn.innerHTML = act.label;
                        btn.onclick = () => {
                            if (act.action === 'close') {
                                unmount(overlay);
                                resolve('close');
                            } else if (typeof act.onClick === 'function') {
                                act.onClick(overlay, resolve);
                            } else {
                                unmount(overlay);
                                resolve(act.action);
                            }
                        };
                        actions.appendChild(btn);
                    });
                }
                
                container.appendChild(titleEl);
                container.appendChild(bodyContainer);
                if (options.actions && options.actions.length > 0) {
                    container.appendChild(actions);
                }
                
                overlay.appendChild(container);
                mountAndShow(overlay);
            });
        }
    };
})();
