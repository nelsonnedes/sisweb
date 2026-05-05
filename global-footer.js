(function () {
    if (window.__siswebFooterStandaloneBootstrap) return;
    window.__siswebFooterStandaloneBootstrap = true;
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
        contact.addEventListener('click', function (e) {
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
        const update = function () { setFooterModuleName(footer); };
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
        if (!document.getElementById('global-system-footer-style')) {
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
            document.head.appendChild(style);
        }
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
