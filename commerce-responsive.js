(function () {
    const ACTION_LABEL = 'Ações';

    function normalizeLabel(value) {
        return String(value || '')
            .replace(/\s+/g, ' ')
            .replace(/Selecionar todos/gi, '')
            .trim();
    }

    function labelFromHeader(th, index) {
        if (!th) return '';
        const explicit = th.getAttribute('data-label') || th.getAttribute('aria-label') || '';
        if (explicit) return normalizeLabel(explicit);
        const text = normalizeLabel(th.textContent || '');
        if (text) return text;
        const dataCol = th.getAttribute('data-col') || '';
        if (dataCol) return dataCol.charAt(0).toUpperCase() + dataCol.slice(1);
        return `Campo ${index + 1}`;
    }

    function isActionsCell(label, cell) {
        if (/aç(õ|o)es|acoes/i.test(label)) return true;
        if (cell && (cell.classList.contains('acoes-cell') || cell.classList.contains('actions-col'))) return true;
        const buttons = cell ? cell.querySelectorAll('button, .btn, a.btn-primary, a.btn-danger, a.btn-warning') : [];
        const text = normalizeLabel(cell ? cell.textContent : '');
        return buttons.length > 0 && text.length <= 40;
    }

    function enhanceTable(table) {
        if (!table || table.dataset.commerceResponsiveBound === '1') return;
        table.dataset.commerceResponsiveBound = '1';
        const wrapper = table.closest('.table-responsive');
        if (wrapper) wrapper.classList.add('mobile-cards');
    }

    function applyLabels(table) {
        if (!table) return;
        enhanceTable(table);
        const headers = Array.from(table.querySelectorAll('thead th'));
        if (!headers.length) return;
        const labels = headers.map(labelFromHeader);
        const bodyRows = table.tBodies && table.tBodies.length
            ? Array.from(table.tBodies).flatMap((tbody) => Array.from(tbody.rows || []))
            : Array.from(table.querySelectorAll('tr')).filter((tr) => !tr.closest('thead'));
        bodyRows.forEach((row) => {
            Array.from(row.cells || []).forEach((cell, index) => {
                if (cell.colSpan && cell.colSpan > 1) {
                    cell.classList.add('commerce-full-row');
                    if (!cell.dataset.label) cell.dataset.label = '';
                    return;
                }
                const label = normalizeLabel(cell.dataset.label || labels[index] || '');
                if (label) cell.dataset.label = label;
                if (isActionsCell(label, cell)) {
                    cell.dataset.label = ACTION_LABEL;
                    cell.classList.add('commerce-actions-cell');
                    const actionWrap = cell.querySelector('.acoes-buttons') || cell.querySelector('.actions-container');
                    if (actionWrap) actionWrap.classList.add('commerce-actions-wrap');
                }
                cell.querySelectorAll('button:not([type])').forEach((button) => {
                    button.type = 'button';
                });
                cell.querySelectorAll('button').forEach((button) => {
                    if (!button.getAttribute('aria-label')) {
                        const title = button.getAttribute('title');
                        const text = normalizeLabel(button.textContent || '');
                        if (title || text) button.setAttribute('aria-label', title || text);
                    }
                });
            });
        });
    }

    function enhanceAllCommerceTables(root) {
        const scope = root && root.querySelectorAll ? root : document;
        scope.querySelectorAll('.table-responsive table, table.table').forEach(applyLabels);
    }

    function init() {
        enhanceAllCommerceTables(document);
        const observer = new MutationObserver((mutations) => {
            let shouldRun = false;
            for (const mutation of mutations) {
                if (mutation.type === 'childList' && mutation.addedNodes && mutation.addedNodes.length) {
                    shouldRun = true;
                    break;
                }
            }
            if (shouldRun) window.requestAnimationFrame(() => enhanceAllCommerceTables(document));
        });
        observer.observe(document.body, { childList: true, subtree: true });
        window.SiswebCommerceResponsive = { enhanceAll: () => enhanceAllCommerceTables(document) };
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init, { once: true });
    } else {
        init();
    }
})();
