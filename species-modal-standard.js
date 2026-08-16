(function(global) {
    'use strict';

    const tools = global.SiswebSpecies || {};

    function normalizeNameKey(value) {
        if (tools.normalizeNameKey) return tools.normalizeNameKey(value);
        return String(value || '')
            .normalize('NFD')
            .replace(/[\u0300-\u036f]/g, '')
            .toLowerCase()
            .replace(/[^a-z0-9]+/g, ' ')
            .replace(/\s+/g, ' ')
            .trim();
    }

    function getDisplayName(specie) {
        if (tools.getDisplayName) return tools.getDisplayName(specie);
        return String((specie && (specie.especie || specie.nome || specie.name || specie.nomeComum)) || '').trim();
    }

    function getScientificName(specie) {
        if (tools.getScientificName) return tools.getScientificName(specie);
        return String((specie && (specie.nomeCientifico || specie.scientificName || specie.scientific || specie.descricao || specie.description || specie.decription)) || '').trim();
    }

    function normalizeList(rawData) {
        if (!rawData) return [];
        if (tools.normalizeList) return tools.normalizeList(rawData);
        const list = Array.isArray(rawData)
            ? rawData.map((item, index) => {
                const value = item && typeof item === 'object' ? item : {};
                const key = String(index);
                return {
                    ...value,
                    id: key,
                    key,
                    firebaseKey: key,
                    originalId: value.originalId || value.id || value.key || key
                };
            })
            : Object.keys(rawData || {}).map((key) => {
                const item = rawData[key] || {};
                return {
                    ...item,
                    id: key,
                    key,
                    firebaseKey: key,
                    originalId: item.originalId || item.id || item.key || key
                };
            });
        const seen = new Set();
        const parseRecordTime = (item) => {
            const updated = item && item.updatedAt;
            if (typeof updated === 'number') return updated;
            if (typeof updated === 'string') {
                const parsed = Date.parse(updated);
                if (!Number.isNaN(parsed)) return parsed;
            }
            const created = item && item.createdAt;
            if (typeof created === 'number') return created;
            if (typeof created === 'string') {
                const parsed = Date.parse(created);
                if (!Number.isNaN(parsed)) return parsed;
            }
            const numericId = parseFloat((item && (item.originalId || item.id)) || '');
            const keyedRecordBias = item && String(item.id || '') === String(item.originalId || '') ? 0.5 : 0;
            return Number.isNaN(numericId) ? keyedRecordBias : numericId + keyedRecordBias;
        };
        return list
            .filter(item => item && typeof item === 'object')
            .map((item, index) => ({
                ...item,
                id: item.firebaseKey || item.key || item.id || `specie_${index}`,
                especie: getDisplayName(item),
                nomeCientifico: getScientificName(item)
            }))
            .sort((a, b) => parseRecordTime(b) - parseRecordTime(a))
            .filter((item) => {
                const key = normalizeNameKey(getDisplayName(item));
                if (!key || seen.has(key)) return false;
                seen.add(key);
                return true;
            });
    }

    function parseStorageValue(value) {
        if (!value) return [];
        try {
            const parsed = JSON.parse(value);
            return normalizeList(parsed);
        } catch (_) {
            return [];
        }
    }

    function resolveTenantId() {
        try {
            const services = [global.firebaseService, global.firebaseServiceTL, global.FirebaseService];
            for (const svc of services) {
                if (!svc) continue;
                if (typeof svc.getCurrentTenantId === 'function') {
                    const tenant = svc.getCurrentTenantId();
                    if (tenant) return String(tenant);
                }
                if (typeof svc.getTenantId === 'function') {
                    const tenant = svc.getTenantId();
                    if (tenant) return String(tenant);
                }
            }
        } catch (_) {}
        try {
            if (global.appTenantId) return String(global.appTenantId);
            if (global.companyInfo) {
                const info = global.companyInfo;
                const id = info.companyId || info.companyID || info.tenantId || info.id;
                if (id) return String(id);
            }
        } catch (_) {}
        try {
            const storageKeys = ['company_info', 'companyInfo', 'currentUser', 'persistentUser'];
            for (const storageKey of storageKeys) {
                const raw = localStorage.getItem(storageKey);
                if (!raw) continue;
                const info = JSON.parse(raw);
                const id = info && (info.companyId || info.companyID || info.tenantId || info.id || info.company_id);
                if (id) return String(id);
            }
        } catch (_) {}
        return '';
    }

    function pushUnique(list, value) {
        const item = String(value || '').trim();
        if (item && !list.includes(item)) list.push(item);
    }

    function getTenantStorageKeys(baseKey) {
        const key = String(baseKey || '').trim();
        const tenantId = resolveTenantId();
        const keys = [];
        if (!key) return keys;

        if (tenantId) {
            try {
                const services = [global.firebaseService, global.firebaseServiceTL, global.FirebaseService];
                for (const svc of services) {
                    if (svc && typeof svc.getNamespacedPath === 'function') {
                        pushUnique(keys, svc.getNamespacedPath(key));
                    }
                }
            } catch (_) {}
            pushUnique(keys, `companies/${tenantId}/${key}`);
            pushUnique(keys, `company_${tenantId}__${key}`);
            return keys;
        }

        pushUnique(keys, `companies/__no_tenant__/${key}`);
        return keys;
    }

    function isTenantSpeciesStorageKey(key, tenantId) {
        const value = String(key || '');
        if (!/(^|__|\/)(especies|especies_cache)$/.test(value)) return false;
        if (!tenantId) {
            return value === 'companies/__no_tenant__/especies'
                || value === 'companies/__no_tenant__/especies_cache';
        }
        return value === `companies/${tenantId}/especies`
            || value === `companies/${tenantId}/especies_cache`
            || value === `company_${tenantId}__especies`
            || value === `company_${tenantId}__especies_cache`;
    }

    function getSpeciesList(extraSource) {
        if (typeof extraSource === 'function') {
            try {
                const list = extraSource();
                if (Array.isArray(list) && list.length) return normalizeList(list);
            } catch (_) {}
        } else if (Array.isArray(extraSource) && extraSource.length) {
            return normalizeList(extraSource);
        }

        const sources = [];
        const tenantId = resolveTenantId();

        if (typeof extraSource === 'function') {
            try { sources.push(extraSource()); } catch (_) {}
        } else if (extraSource) {
            sources.push(extraSource);
        }

        try {
            if (global.SiswebSpeciesStore && typeof global.SiswebSpeciesStore.getCached === 'function') {
                sources.push(global.SiswebSpeciesStore.getCached());
            }
        } catch (_) {}

        try {
            if (global.speciesManagerInstance && Array.isArray(global.speciesManagerInstance.species)) {
                sources.push(global.speciesManagerInstance.species);
            }
        } catch (_) {}

        ['especies', 'especies_cache'].forEach((key) => {
            getTenantStorageKeys(key).forEach((storageKey) => {
                try { sources.push(parseStorageValue(localStorage.getItem(storageKey))); } catch (_) {}
            });
        });

        try {
            for (let i = 0; i < localStorage.length; i += 1) {
                const key = localStorage.key(i);
                if (!isTenantSpeciesStorageKey(key, tenantId)) continue;
                sources.push(parseStorageValue(localStorage.getItem(key)));
            }
        } catch (_) {}

        try {
            if (typeof global.getData === 'function') {
                sources.push(global.getData('especies'));
            }
        } catch (_) {}

        const combined = [];
        sources.forEach((source) => {
            normalizeList(source).forEach(item => combined.push(item));
        });

        return normalizeList(combined);
    }

    function escapeHtml(value) {
        if (tools.escapeHtml) return tools.escapeHtml(value);
        return String(value == null ? '' : value).replace(/[&<>"']/g, (char) => ({
            '&': '&amp;',
            '<': '&lt;',
            '>': '&gt;',
            '"': '&quot;',
            "'": '&#39;'
        }[char]));
    }

    function resolveElement(value, fallbackSelectors, root) {
        if (value && value.nodeType === 1) return value;
        const scope = root || document;
        if (typeof value === 'string') return scope.querySelector(value);
        for (const selector of fallbackSelectors) {
            const found = scope.querySelector(selector);
            if (found) return found;
        }
        return null;
    }

    function ensureAfter(input, element) {
        if (!input || !element || element.parentNode) return;
        input.insertAdjacentElement('afterend', element);
    }

    function getExactDuplicate(name, currentId, source) {
        const key = normalizeNameKey(name);
        if (!key) return null;
        const id = String(currentId || '').trim();
        return getSpeciesList(source).find((specie) => {
            const specieIds = [specie && specie.id, specie && specie.key, specie && specie.firebaseKey, specie && specie.originalId]
                .map(value => String(value || '').trim())
                .filter(Boolean);
            return normalizeNameKey(getDisplayName(specie)) === key && (!id || !specieIds.includes(id));
        }) || null;
    }

    function buildSuggestion(specie, context) {
        const item = document.createElement('div');
        item.className = 'species-modal-suggestion';
        item.setAttribute('role', 'option');
        item.innerHTML = `
            <div class="species-suggestion-name">${escapeHtml(getDisplayName(specie))}</div>
            ${getScientificName(specie) ? `<div class="species-suggestion-scientific">${escapeHtml(getScientificName(specie))}</div>` : ''}
        `;
        item.addEventListener('pointerdown', (event) => {
            event.preventDefault();
            context.nameInput.value = getDisplayName(specie);
            if (context.scientificInput) context.scientificInput.value = getScientificName(specie);
            hideSuggestions(context);
            updateDuplicateHint(context);
            context.nameInput.dispatchEvent(new Event('input', { bubbles: true }));
            context.nameInput.dispatchEvent(new Event('change', { bubbles: true }));
            if (typeof context.onSelect === 'function') context.onSelect(specie);
        });
        return item;
    }

    function showSuggestions(context) {
        if (!context || !context.nameInput || document.activeElement !== context.nameInput) return;
        const reserve = context.reserve;
        if (!reserve) return;
        const query = normalizeNameKey(context.nameInput.value);
        const list = getSpeciesList(context.getSpeciesList);
        const matches = list
            .filter((specie) => {
                if (!query) return true;
                return normalizeNameKey(getDisplayName(specie)).includes(query)
                    || normalizeNameKey(getScientificName(specie)).includes(query);
            })
            .slice(0, 10);

        reserve.innerHTML = '';
        if (!matches.length) {
            reserve.classList.remove('is-open');
            context.nameInput.setAttribute('aria-expanded', 'false');
            return;
        }

        const box = document.createElement('div');
        box.className = 'species-modal-suggestions';
        box.setAttribute('role', 'listbox');
        matches.forEach(specie => box.appendChild(buildSuggestion(specie, context)));
        reserve.appendChild(box);
        reserve.classList.add('is-open');
        context.nameInput.setAttribute('aria-expanded', 'true');
    }

    function hideSuggestions(context) {
        if (!context || !context.reserve || !context.nameInput) return;
        context.reserve.classList.remove('is-open');
        context.reserve.innerHTML = '';
        context.nameInput.setAttribute('aria-expanded', 'false');
    }

    function updateDuplicateHint(context) {
        if (!context || !context.nameInput || !context.hint) return null;
        const currentId = (context.idInput && context.idInput.value) || context.currentId || '';
        const duplicate = getExactDuplicate(context.nameInput.value, currentId, context.getSpeciesList);
        if (duplicate) {
            context.hint.textContent = `Espécie já cadastrada: ${getDisplayName(duplicate)}. Selecione a opção existente para evitar duplicidade.`;
            context.hint.classList.add('is-visible');
            return duplicate;
        }
        context.hint.textContent = '';
        context.hint.classList.remove('is-visible');
        return null;
    }

    function applyStructure(modal, nameInput, scientificInput) {
        const content = modal.querySelector('.modal-content');
        const header = modal.querySelector('.modal-header');
        const title = modal.querySelector('#speciesModalTitle, #modalTitle, .modal-title, h2, h3');
        const form = modal.querySelector('#speciesForm, form');
        const footer = modal.querySelector('.modal-footer, .form-actions, .form-actions');

        modal.classList.add('species-standard-modal');
        if (content) content.classList.add('species-standard-modal-content');
        if (header) header.classList.add('species-standard-header');
        if (title) title.classList.add('species-standard-title');
        modal.querySelectorAll('.close, .close-modal').forEach(el => el.classList.add('species-standard-close'));
        if (form) form.classList.add('species-standard-form');
        if (footer) footer.classList.add('species-standard-actions');

        [nameInput, scientificInput].forEach((field) => {
            if (!field) return;
            const group = field.closest('.form-group') || field.parentElement;
            const label = group ? group.querySelector('label') : null;
            if (group) group.classList.add('species-standard-field');
            if (label) label.classList.add('species-standard-label');
            field.classList.add(field.tagName === 'TEXTAREA' ? 'species-standard-textarea' : 'species-standard-input');
        });
    }

    function ensureReserveAndHint(nameInput) {
        const reserveId = `${nameInput.id || 'speciesName'}SuggestionsReserve`;
        let reserve = document.getElementById(reserveId);
        if (!reserve) {
            reserve = document.createElement('div');
            reserve.id = reserveId;
            reserve.className = 'species-name-suggestions-reserve';
            reserve.setAttribute('aria-hidden', 'true');
            ensureAfter(nameInput, reserve);
        }

        let hint = document.getElementById('speciesNameDuplicateHint');
        if (!hint) {
            hint = document.createElement('div');
            hint.id = 'speciesNameDuplicateHint';
            hint.className = 'species-duplicate-hint';
            hint.setAttribute('aria-live', 'polite');
            reserve.insertAdjacentElement('afterend', hint);
        }

        return { reserve, hint };
    }

    function enhance(options) {
        const opts = options || {};
        const modal = resolveElement(opts.modal, ['#speciesModal']);
        if (!modal) return null;

        const nameInput = resolveElement(opts.nameInput, ['#speciesName', '#name', '#especie-nome'], modal);
        const scientificInput = resolveElement(opts.scientificInput, ['#speciesDescription', '#speciesDesc', '#scientificName', '#especie-cientifico'], modal);
        const idInput = resolveElement(opts.idInput, ['#speciesId', '#especie-id'], modal);
        if (!nameInput) return null;

        applyStructure(modal, nameInput, scientificInput);

        nameInput.setAttribute('autocomplete', 'off');
        nameInput.setAttribute('role', 'combobox');
        nameInput.setAttribute('aria-autocomplete', 'list');
        nameInput.setAttribute('aria-expanded', 'false');
        nameInput.setAttribute('data-species-autocomplete', 'true');
        nameInput.setAttribute('data-species-layout', 'reserved');
        if (!nameInput.placeholder) nameInput.placeholder = 'Ex.: Ipê, Cedro, Tauari';
        if (scientificInput && !scientificInput.placeholder) scientificInput.placeholder = 'Ex.: Handroanthus albus';

        const { reserve, hint } = ensureReserveAndHint(nameInput);
        nameInput.setAttribute('aria-controls', reserve.id);

        const context = {
            modal,
            nameInput,
            scientificInput,
            idInput,
            reserve,
            hint,
            getSpeciesList: opts.getSpeciesList,
            onSelect: opts.onSelect
        };

        nameInput.__siswebSpeciesModalContext = context;
        if (!nameInput.__siswebSpeciesModalBound) {
            nameInput.addEventListener('focus', () => {
                showSuggestions(nameInput.__siswebSpeciesModalContext);
                updateDuplicateHint(nameInput.__siswebSpeciesModalContext);
            });
            nameInput.addEventListener('input', () => {
                showSuggestions(nameInput.__siswebSpeciesModalContext);
                updateDuplicateHint(nameInput.__siswebSpeciesModalContext);
            });
            nameInput.addEventListener('change', () => updateDuplicateHint(nameInput.__siswebSpeciesModalContext));
            nameInput.addEventListener('keydown', (event) => {
                if (event.key === 'Escape' || event.key === 'Tab') hideSuggestions(nameInput.__siswebSpeciesModalContext);
            });
            nameInput.addEventListener('blur', () => {
                setTimeout(() => {
                    const ctx = nameInput.__siswebSpeciesModalContext;
                    const active = document.activeElement;
                    if (!ctx || active === ctx.nameInput || (ctx.reserve && ctx.reserve.contains(active))) return;
                    hideSuggestions(ctx);
                }, 160);
            });
            global.addEventListener('blur', () => hideSuggestions(nameInput.__siswebSpeciesModalContext));
            nameInput.__siswebSpeciesModalBound = true;
        }

        updateDuplicateHint(context);
        return context;
    }

    function duplicateFromInput(options) {
        const opts = options || {};
        const modal = resolveElement(opts.modal, ['#speciesModal']);
        const nameInput = resolveElement(opts.nameInput, ['#speciesName', '#name', '#especie-nome'], modal || document);
        const idInput = resolveElement(opts.idInput, ['#speciesId', '#especie-id'], modal || document);
        if (!nameInput) return null;
        return getExactDuplicate(nameInput.value, idInput ? idInput.value : opts.currentId, opts.getSpeciesList);
    }

    function showModal(modal) {
        const target = resolveElement(modal, ['#speciesModal']);
        if (!target) return null;
        target.classList.add('species-standard-modal', 'is-open');
        target.style.display = 'flex';
        target.setAttribute('aria-hidden', 'false');
        return target;
    }

    function hideModal(modal) {
        const target = resolveElement(modal, ['#speciesModal']);
        if (!target) return null;
        target.classList.remove('is-open');
        target.style.display = 'none';
        target.setAttribute('aria-hidden', 'true');
        return target;
    }

    function isElementVisible(element) {
        if (!element) return false;
        const style = global.getComputedStyle ? global.getComputedStyle(element) : element.style;
        const rect = typeof element.getBoundingClientRect === 'function'
            ? element.getBoundingClientRect()
            : { width: element.offsetWidth, height: element.offsetHeight };
        return style.display !== 'none'
            && style.visibility !== 'hidden'
            && style.opacity !== '0'
            && (element.offsetWidth > 0 || element.offsetHeight > 0 || rect.width > 0 || rect.height > 0);
    }

    function hideInlineFieldSuggestions(input) {
        if (!input) return;
        const container = input.closest('.autocomplete-container') || document;
        const suggestions = container.querySelector('.autocomplete-suggestions, .species-field-suggestions')
            || document.getElementById('especieSuggestions');
        if (!suggestions) return;
        suggestions.style.display = 'none';
        suggestions.innerHTML = '';
        input.setAttribute('aria-expanded', 'false');
    }

    function openSpeciesListModalFromField(input, options) {
        const opts = options || {};
        const field = input && input.nodeType === 1 ? input : null;
        const minChars = Number.isFinite(Number(opts.minChars)) ? Number(opts.minChars) : 3;
        const value = String((field && field.value) || '').trim();

        if (!field
            || field.dataset.suppressSuggestions === 'true'
            || value.length < minChars
            || (opts.requireFocus !== false && document.activeElement !== field)) {
            return false;
        }

        if (opts.hideInlineSuggestions !== false) {
            hideInlineFieldSuggestions(field);
        }

        const existingModal = document.getElementById('speciesListModal');
        if (isElementVisible(existingModal)) return true;

        if (typeof opts.beforeOpen === 'function') {
            try { opts.beforeOpen(field); } catch (_) {}
        }

        const openers = [
            () => (typeof global.openSpeciesListModal === 'function' ? global.openSpeciesListModal() : null),
            () => (global.ModalEspeciesPCT && typeof global.ModalEspeciesPCT.openModal === 'function' ? global.ModalEspeciesPCT.openModal() : null),
            () => (global.ModalEspecies && typeof global.ModalEspecies.openModal === 'function' ? global.ModalEspecies.openModal() : null),
            () => (global.speciesManagerInstance && typeof global.speciesManagerInstance.openModal === 'function' ? global.speciesManagerInstance.openModal() : null)
        ];

        for (const opener of openers) {
            try {
                const result = opener();
                if (result !== null && result !== undefined) return true;
                if (isElementVisible(document.getElementById('speciesListModal'))) return true;
            } catch (error) {
                console.warn('Falha ao abrir lista de espécies pelo campo:', error);
            }
        }

        return false;
    }

    function bindSpeciesField(input, options) {
        const field = resolveElement(input, [], document);
        if (!field || field.__siswebSpeciesFieldListBound) return field || null;

        const opts = {
            minChars: field.dataset.speciesListMinChars || 3,
            hideInlineSuggestions: field.dataset.speciesListHideInline !== 'false',
            ...(options || {})
        };

        field.setAttribute('autocomplete', 'off');
        field.setAttribute('data-species-list-on-type', 'true');

        const run = () => openSpeciesListModalFromField(field, opts);
        field.addEventListener('input', run);
        field.__siswebSpeciesFieldListBound = true;
        return field;
    }

    function bindSpeciesFields(targets, options) {
        const items = typeof targets === 'string'
            ? document.querySelectorAll(targets)
            : targets;
        if (!items) return [];
        return Array.from(items)
            .map(item => bindSpeciesField(item, options))
            .filter(Boolean);
    }

    function autoBindSpeciesFields() {
        bindSpeciesFields('[data-species-list-on-type="true"]');
    }

    if (typeof global.showSpeciesSuggestions !== 'function') {
        global.showSpeciesSuggestions = function(input) {
            return openSpeciesListModalFromField(input, { minChars: 3 });
        };
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', autoBindSpeciesFields, { once: true });
    } else {
        autoBindSpeciesFields();
    }

    global.SiswebSpeciesModal = {
        enhance,
        getSpeciesList,
        getExactDuplicate,
        duplicateFromInput,
        showModal,
        hideModal,
        openSpeciesListModalFromField,
        bindSpeciesField,
        bindSpeciesFields,
        normalizeNameKey,
        getDisplayName,
        getScientificName
    };
})(window);
