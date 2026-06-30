(function () {
    'use strict';

    const STYLE_ID = 'romaneio-table-enhancements-style';

    function ensureStyles() {
        if (document.getElementById(STYLE_ID)) return;
        const style = document.createElement('style');
        style.id = STYLE_ID;
        style.textContent = `
            .romaneio-scroll-x {
                max-width: 100%;
                overflow-x: auto !important;
                overflow-y: visible;
                -webkit-overflow-scrolling: touch;
            }

            .romaneio-scroll-x table {
                width: 100%;
                border-collapse: collapse;
            }

            .romaneio-sortable-table thead th.sortable {
                cursor: pointer;
                user-select: none;
                white-space: nowrap;
                position: relative;
            }

            .romaneio-sortable-table thead th.sortable:focus-visible {
                outline: 2px solid #1d4ed8;
                outline-offset: -2px;
            }

            .romaneio-sortable-table thead th.sortable::after {
                content: '⇅';
                font-size: 10px;
                margin-left: 6px;
                opacity: 0.45;
            }

            .romaneio-sortable-table thead th.sort-active::after {
                opacity: 1;
            }

            .romaneio-sortable-table thead th.sort-asc::after {
                content: '▲';
            }

            .romaneio-sortable-table thead th.sort-desc::after {
                content: '▼';
            }

            .romaneio-sort-indicator {
                display: none !important;
            }
        `;
        document.head.appendChild(style);
    }

    function ensureHorizontalScroll(tableSelector, minWidth) {
        ensureStyles();
        const table = typeof tableSelector === 'string' ? document.querySelector(tableSelector) : tableSelector;
        if (!table) return null;

        const wrapper = table.closest('.table-responsive') || table.parentElement;
        if (wrapper) {
            wrapper.classList.add('romaneio-scroll-x');
            wrapper.style.maxWidth = '100%';
            wrapper.style.overflowX = 'auto';
            wrapper.style.WebkitOverflowScrolling = 'touch';
        }

        if (minWidth) {
            const currentMinWidth = parseFloat(window.getComputedStyle(table).minWidth) || 0;
            const requestedMinWidth = parseFloat(minWidth) || 0;
            if (!currentMinWidth || requestedMinWidth > currentMinWidth) {
                table.style.minWidth = typeof minWidth === 'number' ? `${minWidth}px` : minWidth;
            }
        }

        return table;
    }

    function normalizeText(value) {
        return String(value || '')
            .normalize('NFD')
            .replace(/[\u0300-\u036f]/g, '')
            .trim()
            .toLowerCase();
    }

    function parseNumber(value) {
        if (value === null || value === undefined || value === '') return null;
        if (typeof value === 'number') return Number.isFinite(value) ? value : null;

        const raw = String(value).trim();
        if (!raw) return null;

        const cleaned = raw
            .replace(/[^\d,.-]/g, '')
            .replace(/\.(?=\d{3}(\D|$))/g, '')
            .replace(',', '.');

        if (!cleaned || cleaned === '-' || cleaned === '.' || cleaned === '-.') return null;
        const parsed = Number(cleaned);
        return Number.isFinite(parsed) ? parsed : null;
    }

    function getValue(item, column) {
        if (!item || !column) return '';
        if (typeof column.accessor === 'function') return column.accessor(item);
        return item[column.key];
    }

    function compareValues(a, b, column) {
        const valueA = getValue(a, column);
        const valueB = getValue(b, column);

        if (column.type === 'number') {
            const numA = parseNumber(valueA);
            const numB = parseNumber(valueB);
            if (numA === null && numB === null) return 0;
            if (numA === null) return 1;
            if (numB === null) return -1;
            return numA - numB;
        }

        const numA = parseNumber(valueA);
        const numB = parseNumber(valueB);
        if (numA !== null && numB !== null) return numA - numB;

        return normalizeText(valueA).localeCompare(normalizeText(valueB), 'pt-BR', {
            numeric: true,
            sensitivity: 'base'
        });
    }

    function updateSortIndicators(table) {
        const sortKey = table.dataset.sortKey || '';
        const sortDir = table.dataset.sortDir || 'asc';
        table.querySelectorAll('thead th[data-sort-key]').forEach((th) => {
            Array.from(th.children)
                .filter((child) => child.classList && child.classList.contains('romaneio-sort-indicator'))
                .forEach((indicator) => indicator.remove());
            const isSorted = th.dataset.sortKey === sortKey;
            const isSortable = th.dataset.sortable !== 'false' && th.dataset.sortKey !== 'acoes';

            th.classList.remove('sort-active', 'sort-asc', 'sort-desc', 'is-sorted');
            th.classList.toggle('sortable', isSortable);
            th.classList.toggle('romaneio-sortable-th', isSortable);

            if (isSorted && isSortable) {
                th.classList.add('sort-active', sortDir === 'desc' ? 'sort-desc' : 'sort-asc', 'is-sorted');
            }

            th.setAttribute('aria-sort', isSorted ? (sortDir === 'desc' ? 'descending' : 'ascending') : 'none');
        });
    }

    function applySortFromTable(config) {
        const table = typeof config.tableSelector === 'string' ? document.querySelector(config.tableSelector) : config.tableSelector;
        if (!table) return;

        const sortKey = table.dataset.sortKey;
        if (!sortKey) return;

        const columns = config.columns || [];
        const column = columns.find((col) => col && col.key === sortKey);
        if (!column || column.sortable === false) return;

        const items = typeof config.getItems === 'function' ? config.getItems() : [];
        if (!Array.isArray(items) || items.length < 2) return;

        const direction = table.dataset.sortDir === 'desc' ? -1 : 1;
        items.sort((a, b) => compareValues(a, b, column) * direction);
    }

    function bindSortableHeaders(config) {
        const table = ensureHorizontalScroll(config.tableSelector, config.minWidth);
        if (!table) return;

        const columns = config.columns || [];
        table.classList.add('romaneio-sortable-table');

        table.querySelectorAll('thead th').forEach((th, index) => {
            const column = columns[index];
            if (!column) return;

            th.dataset.sortKey = column.key;
            th.setAttribute('data-sort-key', column.key);

            if (column.sortable === false) {
                th.dataset.sortable = 'false';
                th.classList.remove('sortable', 'romaneio-sortable-th', 'sort-active', 'sort-asc', 'sort-desc');
                return;
            }

            th.dataset.sortable = 'true';
            th.classList.add('sortable', 'romaneio-sortable-th');
            th.tabIndex = 0;
            th.title = th.title || 'Clique para ordenar';

            if (th.dataset.sortBound === '1') return;
            th.dataset.sortBound = '1';

            const sort = () => {
                const currentKey = table.dataset.sortKey;
                const currentDir = table.dataset.sortDir || 'asc';
                table.dataset.sortKey = column.key;
                table.dataset.sortDir = currentKey === column.key && currentDir === 'asc' ? 'desc' : 'asc';
                table.dataset.sortDirection = table.dataset.sortDir;

                if (typeof config.setPage === 'function') config.setPage(1);
                applySortFromTable(config);
                updateSortIndicators(table);
                if (typeof config.render === 'function') config.render();
            };

            th.addEventListener('click', sort);
            th.addEventListener('keydown', (event) => {
                if (event.key !== 'Enter' && event.key !== ' ') return;
                event.preventDefault();
                sort();
            });
        });

        updateSortIndicators(table);
    }

    const ROMANEIO_CANONICAL_PATHS = {
        pct: 'romaneios/pct',
        tl: 'romaneios/tl',
        pes: 'romaneios/pes',
        tora: 'romaneios/tora',
        pre: 'preromaneios',
        preromaneio: 'preromaneios',
        preromaneios: 'preromaneios'
    };

    function normalizeRomaneioType(type) {
        return normalizeText(type || '').replace(/[^a-z0-9]/g, '');
    }

    function getCanonicalRomaneioPath(type) {
        const key = normalizeRomaneioType(type);
        return ROMANEIO_CANONICAL_PATHS[key] || String(type || '').trim();
    }

    function isTechnicalKey(key) {
        const value = String(key || '').trim();
        return !value || value.charAt(0) === '_' || value === 'metadata' || value === 'undefined' || value === 'null';
    }

    function getRomaneioRecordId(record, fallback = '') {
        if (!record || typeof record !== 'object') return String(fallback || '').trim();
        return String(
            record.id ||
            record.romaneioId ||
            record.firebaseKey ||
            record.key ||
            record.numero ||
            record.numeroRomaneio ||
            fallback ||
            ''
        ).trim();
    }

    function getRomaneioItems(record) {
        if (!record || typeof record !== 'object') return [];
        const raw = record.itens || record.items || record.romaneioItems || [];
        if (Array.isArray(raw)) return raw.filter(Boolean);
        if (raw && typeof raw === 'object') {
            return Object.entries(raw)
                .filter(([key, value]) => !isTechnicalKey(key) && value && typeof value === 'object')
                .map(([, value]) => value);
        }
        return [];
    }

    function isValidRomaneioRecord(record, fallbackKey = '') {
        if (!record || typeof record !== 'object') return false;
        const id = getRomaneioRecordId(record, fallbackKey);
        const keyCandidates = [fallbackKey, record.firebaseKey, record.key, record.id, record.numero]
            .filter((value) => value !== undefined && value !== null && String(value).trim() !== '');
        if (keyCandidates.some(isTechnicalKey)) return false;
        if (!id || isTechnicalKey(id)) return false;

        const businessKeys = [
            'numero', 'numeroRomaneio', 'cliente', 'clienteNome', 'fornecedor', 'fornecedorNome',
            'data', 'dataEmissao', 'dataHora', 'timestamp', 'itens', 'items', 'romaneioItems',
            'totais', 'totalVolume', 'totalValor', 'tipo', 'status', 'especie'
        ];
        const hasBusinessField = businessKeys.some((key) => record[key] !== undefined && record[key] !== null && record[key] !== '');
        return hasBusinessField || getRomaneioItems(record).length > 0;
    }

    function normalizeRomaneioCollection(raw, options = {}) {
        const data = raw && raw.data !== undefined ? raw.data : raw;
        const type = options.type ? String(options.type).toUpperCase() : '';
        if (!data) return [];

        const entries = Array.isArray(data)
            ? data.map((item, index) => [String(index), item])
            : (typeof data === 'object' ? Object.entries(data) : []);

        return entries
            .filter(([key, value]) => value && typeof value === 'object' && isValidRomaneioRecord(value, key))
            .map(([key, value]) => {
                const id = getRomaneioRecordId(value, key);
                return {
                    ...value,
                    id,
                    firebaseKey: value.firebaseKey || value.key || key || id,
                    tipo: value.tipo || type
                };
            });
    }

    function parseRomaneioTimestamp(record) {
        if (!record || typeof record !== 'object') return 0;
        const candidates = [
            record._metadata && record._metadata.lastUpdated,
            record.updatedAt,
            record.updated,
            record.lastModified,
            record.atualizadoEm,
            record.dataEmissao,
            record.data,
            record.dataHora,
            record.dataCriacao,
            record.createdAt,
            record.created,
            record.criadoEm,
            record.savedAt,
            record.timestamp
        ];

        for (const candidate of candidates) {
            if (candidate === undefined || candidate === null || candidate === '') continue;
            if (typeof candidate === 'number' && Number.isFinite(candidate)) return candidate;
            const parsed = Date.parse(candidate);
            if (!Number.isNaN(parsed)) return parsed;
            const numeric = Number(candidate);
            if (Number.isFinite(numeric) && numeric > 0) return numeric;
        }

        const id = getRomaneioRecordId(record);
        const match = id.match(/(\d{10,})/);
        return match ? Number(match[1]) || 0 : 0;
    }

    function sortRomaneiosByRecency(list) {
        return (Array.isArray(list) ? list : []).sort((a, b) => parseRomaneioTimestamp(b) - parseRomaneioTimestamp(a));
    }

    function normalizePrintMode(mode) {
        const normalized = String(mode || 'completo').trim().toLowerCase().replace(/-/g, '_');
        if (normalized === 'sem_preco_unitario') return 'sem_preco_unitario';
        if (normalized === 'sem_preco') return 'sem_preco';
        return 'completo';
    }

    window.RomaneioTableEnhancements = {
        bindSortableHeaders,
        applySortFromTable,
        ensureHorizontalScroll,
        parseNumber
    };

    window.RomaneioDataUtils = {
        getCanonicalRomaneioPath,
        getRomaneioItems,
        getRomaneioRecordId,
        isTechnicalKey,
        isValidRomaneioRecord,
        normalizePrintMode,
        normalizeRomaneioCollection,
        parseRomaneioTimestamp,
        sortRomaneiosByRecency
    };
})();
